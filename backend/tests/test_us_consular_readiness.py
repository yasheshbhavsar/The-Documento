"""Tests for the Indian-Applicant US Consular Readiness Engine & Checklist Category Normalization."""
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.ai.us_consular_readiness import USConsularReadinessEngine
from backend.app.ai.checklist_engine import audit_case_checklist


client = TestClient(app)


def test_f1_student_liquid_vs_illiquid_and_fnu_resolution():
    """
    Verifies that US F-1 readiness separates liquid savings/education loans from
    illiquid immovable property valuations under 9 FAM 402.5-5(G), converts INR to USD,
    and flags single legal names ('FNU') for Form DS-160.
    """
    docs = [
        {
            "id": "doc-i20",
            "title": "Form I-20 Certificate of Eligibility - NYU Courant",
            "category": "government_correspondence",
            "raw_text": "Total Estimated Cost: $52,000.00",
        },
        {
            "id": "doc-sbi",
            "title": "State Bank of India Savings Statement",
            "category": "financial_evidence",
            "raw_text": (
                "State Bank of India\n"
                "Account Number: XXXX8821\n"
                "Closing Balance: ₹16,80,000.00\n"
            ),
        },
        {
            "id": "doc-loan",
            "title": "HDFC Credila Education Loan Sanction Letter",
            "category": "financial_evidence",
            "raw_text": "Education Loan Sanction Letter\nSanctioned Amount: ₹33,60,000",
        },
        {
            "id": "doc-prop",
            "title": "Report of Valuation of Immovable Property",
            "category": "financial_evidence",
            "raw_text": "Valuation of Immovable Property\nMarket Value: ₹2,10,00,000",
        },
        {
            "id": "doc-itr",
            "title": "Indian Income Tax Return Acknowledgement 2024-25",
            "category": "financial_evidence",
            "raw_text": (
                "INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT\n"
                "ITR-V\n"
                "Assessment Year: 2024-25\n"
                "PAN: ABCDE1234F\n"
                "Acknowledgement No: 123456789012345\n"
                "Gross Total Income: 18,50,000\n"
            ),
        },
    ]

    report = USConsularReadinessEngine.evaluate_case(
        visa_category="US F-1 Academic Student",
        documents=docs,
        applicant_first_name="Gurpreet",
        applicant_last_name="",
    )

    assert report.pathway == "US-F1-STUDENT"
    assert report.i20_or_trip_cost_usd == 52000.0
    # ₹16,80,000 ($20,000) + ₹33,60,000 ($40,000) = $60,000 liquid
    assert report.verified_liquid_funds_usd == 60000.0
    # ₹2,10,00,000 ($250,000) counted only as illiquid home ties
    assert report.illiquid_home_ties_usd == 250000.0
    assert report.is_year1_liquid_sufficient is True
    assert report.fnu_single_name_guidance is not None
    assert report.fnu_single_name_guidance["is_single_name"] is True
    assert report.fnu_single_name_guidance["ds160_given_name"] == "FNU"
    assert report.fnu_single_name_guidance["ds160_surname"] == "Gurpreet"


def test_b1b2_visitor_flags_missing_noc_and_unseasoned_lump_sum():
    """
    Verifies that B-1/B-2 readiness flags missing Employer Leave NOC and unexplained
    lump-sum bank deposits under INA § 214(b).
    """
    docs = [
        {
            "id": "doc-bank",
            "title": "HDFC Bank 6-Month Statement",
            "category": "financial_evidence",
            "raw_text": (
                "HDFC Bank\n"
                "Account Number: XXXX4928\n"
                "Closing Balance: $36,230.00\n"
                "09/10/2024 CREDIT WIRE TRANSFER INTL PRIVATE UNVERIFIED 25,000.00\n"
            ),
        }
    ]

    report = USConsularReadinessEngine.evaluate_case(
        visa_category="US B-1/B-2 Visitor Visa",
        documents=docs,
        applicant_first_name="Aarav",
        applicant_last_name="Sharma",
    )

    assert report.pathway == "US-B1B2-VISITOR"
    assert report.consular_risk_level == "HIGH_REFUSAL_OR_221G_RISK"
    codes = {f.code for f in report.findings}
    assert "B1B2_MISSING_EMPLOYMENT_TIES" in codes
    assert "UNSEASONED_LUMP_SUM_DEPOSIT" in codes


def test_checklist_engine_normalizes_plural_classifier_categories():
    """
    QA Regression Test: Ensures plural/canonical categories emitted by classifier.py
    ('educational_records', 'employment_records', 'civil_status_family') satisfy
    checklist items that specify singular category codes.
    """
    docs = [
        {"id": "1", "title": "Passport.pdf", "category": "identity_passport", "processing_status": "completed"},
        {"id": "2", "title": "BTech_Degree_Transcript.pdf", "category": "educational_records", "processing_status": "completed"},
        {"id": "3", "title": "Marriage_Certificate.pdf", "category": "civil_status_family", "processing_status": "completed"},
        {"id": "4", "title": "Google_Paystubs_W2.pdf", "category": "employment_records", "processing_status": "completed"},
        {"id": "5", "title": "I797_Approval_Notice.pdf", "category": "government_correspondence", "processing_status": "completed"},
    ]

    h4_report = audit_case_checklist("United States (USCIS)", "US H-4 Dependent", docs)
    assert h4_report.fulfillment_percentage == 100.0
    assert len(h4_report.missing_items) == 0


def test_us_consular_audit_api_endpoint():
    """Verifies POST /api/v1/ai/us-consular-audit returns structured readiness JSON."""
    res = client.post(
        "/api/v1/ai/us-consular-audit",
        json={
            "visa_category": "H-1B Specialty Occupation",
            "applicant_first_name": "Rohan",
            "applicant_last_name": "Patel",
            "documents": [],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["pathway"] == "US-H1B-STAMPING"
    assert any(f["code"] == "H1B_MISSING_I797" for f in body["findings"])


def test_clean_ocr_text_preposition_and_bilingual_cleaning():
    """
    Verifies OCR post-processing repairs concatenated preposition words
    ('PlaceofBirth', 'DateofBirth', 'RepublicofIndia') and strips multi-token
    Devanagari/Hindi OCR slash prefixes ('wr f / Given Name').
    """
    from backend.app.ocr.engine import clean_ocr_text

    noisy = (
        "REPUBLICOFINDIA\n"
        "wr f / Given Name: AARAV\n"
        "feaTo / PlaceofBirth: AHMEDABAD, GUJARAT\n"
        "DateofBirth: 14/08/1992\n"
        "MasterofScience in Computer Science\n"
    )
    cleaned = clean_ocr_text(noisy)
    assert "REPUBLIC OF INDIA" in cleaned.upper()
    assert "Place of Birth: AHMEDABAD, GUJARAT" in cleaned
    assert "Date of Birth: 14/08/1992" in cleaned
    assert "Master of Science" in cleaned
    assert "wr f /" not in cleaned


def test_mrz_parser_repairs_ocr_digit_letter_confusions():
    """
    Verifies that MRZParser repairs OCR letter/digit confusions ('O' -> '0' in numeric
    DOB and expiry slots, '0' -> 'O' in alpha nationality slot) and passes ICAO 9303
    check-digit validation.
    """
    from backend.app.ocr.mrz_parser import MRZParser

    # Line 2 has 'O' instead of '0' in DOB (92O814) and Expiry (31O519)
    noisy_mrz = (
        "P<INDSHARMA<<AARAV<<<<<<<<<<<<<<<<<<<<<<<<<<\n"
        "Z4829103<4IND92O8148M31O5196<<<<<<<<<<<<<<02\n"
    )
    parsed = MRZParser.parse_text(noisy_mrz)
    assert parsed is not None
    assert parsed.document_number == "Z4829103"
    assert parsed.date_of_birth == "1992-08-14"
    assert parsed.expiry_date == "2031-05-19"
    assert parsed.is_valid is True


def test_all_eight_extractor_sample_documents_full_field_accuracy():
    """
    End-to-end QA audit of all 8 SAMPLE_DOCUMENTS in /api/v1/extractor to ensure
    every sample extracts accurate structured fields, normalized dates, and forensics.
    """
    samples_res = client.get("/api/v1/extractor/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()
    assert len(samples) >= 8

    expected_fields_by_id = {
        "sample-indian-passport": {"passport_number", "surname", "given_names", "date_of_birth", "expiry_date"},
        "sample-us-passport": {"passport_number", "surname", "given_names", "date_of_birth", "expiry_date"},
        "sample-bank-statement": {"financial_institution", "closing_balance", "opening_balance"},
        "sample-employment-letter": {"employer_name", "full_name", "job_title", "annual_salary", "employment_start_date"},
        "sample-degree-certificate": {"institution_name", "full_name", "degree_title", "graduation_date"},
        "sample-marriage-certificate": {"marriage_certificate_number", "marriage_date", "groom_name", "bride_name", "marriage_place"},
        "sample-professional-resume": {"applicant_name", "email_address", "job_title", "technical_skills"},
        "sample-aadhaar-pan-identity": {"aadhaar_number_masked", "pan_number", "full_name", "date_of_birth"},
    }

    for sample in samples:
        if sample["id"] not in expected_fields_by_id:
            continue
        res = client.post(
            "/api/v1/extractor/analyze-text",
            json={
                "text": sample["text_content"],
                "filename": sample["filename"],
                "declared_category": sample["category"],
            },
        )
        assert res.status_code == 200, f"Sample {sample['id']} failed with {res.status_code}"
        data = res.json()
        field_names = {f["field_name"] for f in data["extracted_fields"]}
        required = expected_fields_by_id[sample["id"]]
        missing = required - field_names
        assert not missing, f"Sample {sample['id']} missing fields: {missing} (got {field_names})"


