"""Standalone Document Information and Recognition Extractor API.

Completely public / unauthenticated endpoint to test, explore, and audit
the platform's OCR engine, Document Classification, Entity Extraction,
Evidence Quality Auditing, and specialized Identity/Financial Intelligence.
"""
from __future__ import annotations

import hashlib
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from backend.app.ai.financial_parser import FinancialIntelligenceEngine
from backend.app.ai.identity_resolver import IdentityResolver
from backend.app.ai.quality_detector import detect_document_quality_issues
from backend.app.extraction.classifier import CATEGORY_RULES, classify_document
from backend.app.extraction.service import (
    extract_structured_fields,
    format_field_extraction_provenance,
)
from backend.app.ocr.engine import (
    OCREngine,
    PageBlock,
    PageExtractionResult,
    detect_language,
)

router = APIRouter(prefix="/extractor", tags=["extractor"])


class AnalyzeTextRequest(BaseModel):
    text: str = Field(..., description="Raw text of the document to recognize and extract")
    filename: Optional[str] = Field("sample_document.txt", description="Optional filename to assist classification")
    declared_category: Optional[str] = Field(None, description="Optional declared category")


class ExtractorSample(BaseModel):
    id: str
    title: str
    category: str
    filename: str
    description: str
    text_content: str


# 6 Realistic Immigration Test Documents
SAMPLE_DOCUMENTS: list[dict[str, str]] = [
    {
        "id": "sample-indian-passport",
        "title": "Republic of India Passport (Bio & Endorsements)",
        "category": "identity_passport",
        "filename": "PASSPORT_SHARMA_AARAV.pdf",
        "description": "Standard 36-page regular passport with ECNR status, bio page and parents' endorsement.",
        "text_content": (
            "REPUBLIC OF INDIA / RÉPUBLIQUE DE L'INDE\n"
            "PASSPORT / PASSEPORT\n"
            "Type / Type: P  Country Code / Code du pays: IND  Passport No. / No du passeport: Z8492014\n"
            "Surname / Nom: SHARMA\n"
            "Given Name(s) / Prénoms: AARAV\n"
            "Nationality / Nationalité: INDIAN\n"
            "Sex / Sexe: M\n"
            "Date of Birth / Date de naissance: 14/08/1992\n"
            "Place of Birth / Lieu de naissance: AHMEDABAD, GUJARAT\n"
            "Place of Issue / Lieu de délivrance: AHMEDABAD\n"
            "Date of Issue / Date de délivrance: 20/05/2018\n"
            "Date of Expiry / Date d'expiration: 19/05/2028\n\n"
            "Page 36 - Endorsements & Details\n"
            "Name of Father / Legal Guardian: RAJESH SHARMA\n"
            "Name of Mother: PRIYA SHARMA\n"
            "Name of Spouse: ANANYA SHARMA\n"
            "Address: 402 SKYLINE APARTMENTS, BODAKDEV, AHMEDABAD, GUJARAT, 380054\n"
            "Old Passport No: M3491823  File No: AH106829104918\n"
            "Emigration Check: Emigration Check Not Required (ECNR)\n\n"
            "P<INDSHARMA<<AARAV<<<<<<<<<<<<<<<<<<<<<<<<<<\n"
            "Z8492014<2IND9208146M2805194<<<<<<<<<<<<<<04"
        ),
    },
    {
        "id": "sample-us-passport",
        "title": "United States Passport (ICAO Doc 9303)",
        "category": "identity_passport",
        "filename": "US_PASSPORT_JOHNSON_EMILY.pdf",
        "description": "US Dept of State passport bio page with machine-readable zone (MRZ Type 3).",
        "text_content": (
            "PASSPORT / PASSEPORT / PASAPORTE\n"
            "UNITED STATES OF AMERICA\n\n"
            "Type / Type: P  Code: USA  Passport No. / No. du passeport: 650291834\n"
            "Surname: JOHNSON\n"
            "Given Names: EMILY CLAIRE\n"
            "Nationality: UNITED STATES OF AMERICA\n"
            "Date of birth: 28 JAN 1995\n"
            "Place of birth: CALIFORNIA, U.S.A.\n"
            "Sex: F\n"
            "Date of issue: 12 MAR 2021\n"
            "Authority: United States Department of State\n"
            "Date of expiration: 11 MAR 2031\n\n"
            "P<USAJOHNSON<<EMILY<CLAIRE<<<<<<<<<<<<<<<<<<\n"
            "6502918341USA9501284F3103118<<<<<<<<<<<<<<02"
        ),
    },
    {
        "id": "sample-bank-statement",
        "title": "Chase Bank 6-Month Checking Statement (Forensics)",
        "category": "financial_evidence",
        "filename": "CHASE_BANK_STATEMENT_OCT2024.pdf",
        "description": "Multi-page bank statement with salary credits and an unseasoned $25,000 lump sum deposit.",
        "text_content": (
            "JPMorgan Chase Bank, N.A.\n"
            "P.O. Box 182051, Columbus, OH 43218\n\n"
            "ACCOUNT STATEMENT\n"
            "Statement Period: May 01, 2024 through October 31, 2024\n"
            "Account Number: *******4928\n"
            "Account Type: Chase Total Checking\n"
            "Account Holder: AARAV SHARMA\n\n"
            "ACCOUNT SUMMARY\n"
            "Beginning Balance: $14,250.00\n"
            "Deposits and Additions: $42,500.00\n"
            "ATM & Debit Card Withdrawals: $8,420.00\n"
            "Electronic Withdrawals: $12,100.00\n"
            "Ending Balance: $36,230.00\n"
            "Minimum Daily Balance: $11,400.00\n\n"
            "TRANSACTION DETAIL\n"
            "05/15/2024  CREDIT  PAYROLL DIRECT DEP TECHCORP INC  $4,200.00  Balance: $18,450.00\n"
            "06/15/2024  CREDIT  PAYROLL DIRECT DEP TECHCORP INC  $4,200.00  Balance: $22,650.00\n"
            "07/15/2024  CREDIT  PAYROLL DIRECT DEP TECHCORP INC  $4,200.00  Balance: $26,850.00\n"
            "08/15/2024  CREDIT  PAYROLL DIRECT DEP TECHCORP INC  $4,200.00  Balance: $31,050.00\n"
            "09/10/2024  CREDIT  WIRE TRANSFER INTL PRIVATE UNVERIFIED  $25,000.00  Balance: $56,050.00\n"
            "09/15/2024  CREDIT  PAYROLL DIRECT DEP TECHCORP INC  $4,200.00  Balance: $60,250.00\n"
            "10/05/2024  DEBIT   COLLEGE TUITION PAYMENT UNIV  -$24,000.00  Balance: $36,250.00\n"
            "Page 1 of 4"
        ),
    },
    {
        "id": "sample-employment-letter",
        "title": "Employment Verification & Experience Letter (Google LLC)",
        "category": "employment_records",
        "filename": "GOOGLE_EMPLOYMENT_VERIFICATION_SHARMA.pdf",
        "description": "Official company letterhead confirming job title, salary, SOC duties, and full-time status.",
        "text_content": (
            "GOOGLE LLC\n"
            "1600 Amphitheatre Parkway\n"
            "Mountain View, CA 94043\n\n"
            "Date: October 15, 2024\n"
            "To Whom It May Concern (USCIS / IRCC Visa Office):\n\n"
            "RE: EMPLOYMENT VERIFICATION AND EXPERIENCE LETTER - AARAV SHARMA\n\n"
            "This letter serves to confirm that Aarav Sharma has been continuously employed on a full-time basis "
            "with Google LLC since July 1, 2019 to the present date.\n\n"
            "Current Position: Staff Software Engineer (SOC Code: 15-1252.00 Software Developers)\n"
            "Annual Base Salary: $195,000.00 USD per annum\n"
            "Standard Hours: 40 hours per week (Permanent Full-Time)\n"
            "Work Location: Mountain View, California\n\n"
            "Primary Responsibilities & Duties:\n"
            "1. Architects distributed backend microservices and high-throughput real-time APIs.\n"
            "2. Directs engineering teams in designing secure cloud database schemas and automated CI/CD.\n"
            "3. Collaborates with cross-functional AI research teams on scalable inference optimization.\n\n"
            "Sincerely,\n\n"
            "Jennifer Vance\n"
            "Senior Director of Global Human Resources\n"
            "Google LLC\n"
            "Email: hr-verifications@google.com\n"
            "Phone: +1 (650) 253-0000"
        ),
    },
    {
        "id": "sample-degree-certificate",
        "title": "Stanford University Degree Certificate (Master of Science)",
        "category": "educational_records",
        "filename": "STANFORD_DEGREE_CERTIFICATE_SHARMA.pdf",
        "description": "Accredited US university degree diploma with graduation date, honors, and conferral seal.",
        "text_content": (
            "STANFORD UNIVERSITY\n"
            "The Trustees of Leland Stanford Junior University\n"
            "on the recommendation of the Academic Council have conferred on\n\n"
            "AARAV SHARMA\n\n"
            "the degree of\n"
            "MASTER OF SCIENCE IN COMPUTER SCIENCE\n\n"
            "with all the rights, privileges, and honors thereunto appertaining.\n"
            "Given at Stanford, in the State of California, on the Sixteenth Day of June\n"
            "in the year Two Thousand and Nineteen (June 16, 2019).\n\n"
            "Marc Tessier-Lavigne, President of the University\n"
            "Persis S. Drell, Provost\n"
            "Seal of Stanford University Affixed"
        ),
    },
    {
        "id": "sample-marriage-certificate",
        "title": "Government Marriage Certificate (Civil Registration)",
        "category": "civil_status_family",
        "filename": "MARRIAGE_CERTIFICATE_SHARMA.pdf",
        "description": "Official civil registration of marriage between bridegroom and bride with date and witness stamps.",
        "text_content": (
            "GOVERNMENT OF GUJARAT\n"
            "REGISTRATION OF MARRIAGES ACT, 2006\n"
            "MEMORANDUM OF MARRIAGE / CERTIFICATE OF MARRIAGE\n\n"
            "Certificate No: GUJ/AHM/2021/84920\n"
            "Date of Registration: 12/12/2021\n\n"
            "1. Date of Marriage: 28/11/2021\n"
            "2. Place of Marriage: Bodakdev, Ahmedabad, Gujarat\n\n"
            "FULL NAME OF THE BRIDEGROOM: AARAV SHARMA\n"
            "Age / Date of Birth: 14/08/1992 (Age 29)\n"
            "Father's Name: RAJESH SHARMA\n"
            "Usual Residence: Ahmedabad, Gujarat, India\n\n"
            "FULL NAME OF THE BRIDE: ANANYA PATEL\n"
            "Age / Date of Birth: 05/03/1994 (Age 27)\n"
            "Father's Name: KISHORE PATEL\n"
            "Usual Residence: Ahmedabad, Gujarat, India\n\n"
            "Registered under the authority of the Registrar of Marriages, Ahmedabad Municipal Corporation."
        ),
    },
    {
        "id": "sample-professional-resume",
        "title": "Professional Tech Resume / CV (Full Stack & AI Engineer)",
        "category": "employment_records",
        "filename": "RESUME_YASHESH_BHAVSAR.pdf",
        "description": "Modern software engineering resume with candidate contact, LinkedIn/GitHub, technical skills, and experience.",
        "text_content": (
            "YASHESH BHAVSAR\n"
            "Senior Full Stack & AI Systems Engineer\n"
            "Ahmedabad, Gujarat, India | yashesh@example.com | +91 98765 43210\n"
            "LinkedIn: linkedin.com/in/yashesh-bhavsar | GitHub: github.com/yasheshbhavsar\n\n"
            "PROFESSIONAL SUMMARY\n"
            "Results-driven Senior Full Stack & AI Systems Engineer with 6+ years of experience architecting "
            "high-performance web applications, enterprise microservices, and multimodal AI document processing pipelines.\n\n"
            "TECHNICAL SKILLS\n"
            "Languages: Python, TypeScript, JavaScript, SQL, HTML5, CSS3\n"
            "Frameworks: FastAPI, Next.js, React, Node.js, PyTorch, LangChain\n"
            "Cloud & Databases: PostgreSQL, Docker, AWS, Google Cloud, SQLite, Redis\n\n"
            "WORK EXPERIENCE\n"
            "Senior Software Engineer | Tech Solutions Global Inc. (2021 - Present)\n"
            "- Designed and deployed high-throughput document intelligence pipelines processing 500k+ pages monthly.\n"
            "- Implemented automated statutory identity resolution and real-time biometric verification.\n\n"
            "EDUCATION\n"
            "Bachelor of Technology in Computer Engineering (2016 - 2020)\n"
            "Gujarat Technological University | Cumulative GPA: 3.8 / 4.0\n"
        ),
    },
    {
        "id": "sample-aadhaar-pan-identity",
        "title": "Government Identity Cards (UIDAI Aadhaar & Income Tax PAN)",
        "category": "identity_passport",
        "filename": "GOVT_ID_AADHAAR_PAN_SHARMA.pdf",
        "description": "Indian National Identity & Tax cards verifying UIDAI 8-digit masking and PAN taxpayer classification.",
        "text_content": (
            "GOVERNMENT OF INDIA / UNIQUE IDENTIFICATION AUTHORITY OF INDIA\n"
            "MERA AADHAAR, MERI PEHCHAN\n\n"
            "Name: AARAV SHARMA\n"
            "DOB: 14/08/1992\n"
            "Gender: Male / पुरुष\n"
            "S/O: RAJESH SHARMA\n"
            "Address: 402 Skyline Apartments, Bodakdev, Ahmedabad, Gujarat - 380054\n"
            "Aadhaar No: 9482 1094 8492\n\n"
            "--------------------------------------------------\n"
            "INCOME TAX DEPARTMENT - GOVT. OF INDIA\n"
            "PERMANENT ACCOUNT NUMBER (PAN CARD)\n\n"
            "Permanent Account Number: AAAPS8492K\n"
            "Name: AARAV SHARMA\n"
            "Father's Name: RAJESH SHARMA\n"
            "Date of Birth: 14/08/1992\n"
            "Taxpayer Status: Individual / Person\n"
        ),
    },
]


@router.get("/samples", response_model=list[ExtractorSample])
def get_extractor_samples() -> list[dict[str, str]]:
    """Returns pre-configured immigration test documents for 1-click exploration."""
    return SAMPLE_DOCUMENTS


@router.post("/analyze")
async def analyze_document_standalone(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    declared_category: Optional[str] = Form(None),
) -> dict[str, Any]:
    """
    Public, unauthenticated standalone document recognition and information extractor.
    Accepts either an uploaded file (PDF, PNG, JPG, WEBP, TIFF) or raw text.
    Runs:
    1. OCREngine (PDF vector layout, RapidOCR, rotation correction, block coordinates)
    2. Document Classification (taxonomy recognition, confidence, keyword hits)
    3. Structured Field Extraction (normalized ISO values, bounding boxes, provenances)
    4. Evidence Quality Inspection (missing pagination, blur/faded scan, expiration checks)
    5. Specialized Financial & Identity Forensics (lump sums, Aadhaar masking, PAN, single names)
    """
    document_bytes: bytes = b""
    clean_filename = filename if isinstance(filename, str) and filename.strip() else None
    clean_raw_text = raw_text if isinstance(raw_text, str) and raw_text.strip() else None
    clean_declared_cat = declared_category if isinstance(declared_category, str) and declared_category.strip() else None

    content_filename: str = clean_filename or "document.txt"
    mime_type: str = "text/plain"

    if file is not None and hasattr(file, "filename") and file.filename:
        content_filename = clean_filename or file.filename
        document_bytes = await file.read()
        mime_type = file.content_type or "application/octet-stream"
    elif clean_raw_text:
        document_bytes = clean_raw_text.encode("utf-8")
        mime_type = "text/plain"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either an uploaded 'file' or 'raw_text' must be provided for extraction.",
        )

    file_size_bytes = len(document_bytes)
    sha256_hash = hashlib.sha256(document_bytes).hexdigest()

    # 1. OCR Extraction & Geometries
    pages: list[PageExtractionResult] = []
    if mime_type == "text/plain" or (mime_type == "application/octet-stream" and not document_bytes.startswith(b"%PDF")):
        # Pure text input
        text_str = document_bytes.decode("utf-8", errors="replace")
        blocks: list[PageBlock] = []
        for idx, line in enumerate(text_str.splitlines()):
            line_clean = line.strip()
            if line_clean:
                blocks.append(
                    PageBlock(
                        x0=50.0,
                        y0=40.0 + (idx * 22.0),
                        x1=550.0,
                        y1=58.0 + (idx * 22.0),
                        text=line_clean,
                        confidence=0.99,
                        block_idx=idx,
                    )
                )
        pages = [
            PageExtractionResult(
                page_number=1,
                text=text_str,
                ocr_applied=False,
                ocr_confidence=0.99,
                blocks=blocks,
                width=612.0,
                height=max(792.0, 60.0 + (len(blocks) * 22.0)),
                detected_rotation=0,
                is_rotation_corrected=False,
            )
        ]
    else:
        # PDF or Image byte payload
        try:
            pages = OCREngine.extract_document(document_bytes, mime_type=mime_type)
        except Exception:
            # Fallback text representation
            text_str = document_bytes.decode("latin1", errors="ignore")
            pages = [
                PageExtractionResult(
                    page_number=1,
                    text=text_str,
                    ocr_applied=True,
                    ocr_confidence=0.85,
                    blocks=[],
                    width=612.0,
                    height=792.0,
                    detected_rotation=0,
                    is_rotation_corrected=False,
                )
            ]

    full_extracted_text = "\n\n".join([f"--- PAGE {p.page_number} ---\n{p.text}" for p in pages]).strip()
    detected_lang = detect_language(full_extracted_text)

    # 2. Document Classification
    recognized_category, category_confidence = classify_document(
        full_extracted_text, filename=content_filename, declared_category=clean_declared_cat
    )

    # Match category details
    category_label = recognized_category.replace("_", " ").title()
    matched_rule = next((r for r in CATEGORY_RULES if r.get("category") == recognized_category), None)
    if matched_rule:
        category_label = matched_rule.get("label", category_label)

    # Find matched keyword highlights
    matched_keywords: list[str] = []
    if matched_rule:
        for pat in matched_rule.get("patterns", []):
            import re
            m = re.findall(pat, full_extracted_text, re.IGNORECASE)
            if m:
                matched_keywords.extend([str(item) for item in m[:2]])
    matched_keywords = list(dict.fromkeys(matched_keywords))[:8]

    # 3. Structured Field Extraction
    dummy_doc_id = uuid.uuid4()
    dummy_org_id = uuid.uuid4()
    extracted_fields = extract_structured_fields(
        document_id=dummy_doc_id,
        organization_id=dummy_org_id,
        category=recognized_category,
        pages=pages,
        document_bytes=document_bytes,
        mime_type=mime_type,
        filename=content_filename,
    )

    # Format fields into provenances and structured response
    formatted_fields: list[dict[str, Any]] = []
    for field in extracted_fields:
        prov = format_field_extraction_provenance(field)
        formatted_fields.append({
            "field_name": field.field_name,
            "field_label": field.field_label or field.field_name.replace("_", " ").title(),
            "original_value": field.original_value,
            "normalized_value": field.normalized_value or field.original_value,
            "source_page": field.source_page or 1,
            "ocr_confidence": field.ocr_confidence,
            "extraction_confidence": field.extraction_confidence,
            "calibrated_confidence": prov.get("confidence", 0.90),
            "extraction_method": field.extraction_method or "native_pdf_layout",
            "model_version": field.model_version or "doc-intel-v5.0",
            "bounding_box": prov.get("bounding_box", [0.1, 0.1, 0.2, 0.5]),
            "source_location": field.source_location,
            "review_status": prov.get("review_status", "NEEDS_HUMAN_REVIEW"),
        })

    # 4. Evidence Quality Inspection
    field_dicts_for_quality = [
        {"field_name": f["field_name"], "ocr_confidence": f["ocr_confidence"], "field_label": f["field_label"]}
        for f in formatted_fields
    ]
    raw_findings = detect_document_quality_issues(
        document_id=str(dummy_doc_id),
        title=content_filename,
        category=recognized_category,
        page_count=len(pages),
        extracted_text=full_extracted_text,
        extracted_fields=field_dicts_for_quality,
        ocr_applied=any(p.ocr_applied for p in pages),
    )

    quality_findings: list[dict[str, Any]] = []
    for qf in raw_findings:
        quality_findings.append({
            "finding_type": qf.finding_type,
            "severity": qf.severity,
            "title": qf.title,
            "description": qf.description,
            "evidence_text": qf.evidence_text,
            "page_number": qf.page_number,
            "recommended_action": qf.recommended_action,
            "uncertainty_limitations": qf.uncertainty_limitations,
            "suggested_clarification": qf.suggested_clarification,
        })

    # 5. Specialized AI & Forensics
    specialized_intelligence: dict[str, Any] = {}

    # Financial analysis
    if recognized_category == "financial_evidence" or "statement" in content_filename.lower() or "bank" in full_extracted_text.lower():
        try:
            bank_sum = FinancialIntelligenceEngine.parse_bank_statement_text(full_extracted_text)
            specialized_intelligence["financial_forensics"] = {
                "institution": bank_sum.financial_institution,
                "account_number_masked": bank_sum.account_number_masked,
                "statement_period": f"{bank_sum.statement_period_start or 'N/A'} - {bank_sum.statement_period_end or 'N/A'}",
                "opening_balance": bank_sum.opening_balance,
                "closing_balance": bank_sum.closing_balance,
                "minimum_balance_observed": bank_sum.minimum_balance_observed,
                "average_monthly_credits": bank_sum.average_monthly_credits,
                "currency": bank_sum.currency,
                "suspicious_lump_sums": [
                    {
                        "date": t.transaction_date,
                        "description": t.description,
                        "amount": t.amount,
                        "type": t.transaction_type,
                        "is_suspicious": t.is_suspicious_lump_sum,
                    }
                    for t in bank_sum.suspicious_lump_sums
                ],
                "risk_findings": bank_sum.risk_findings,
            }
        except Exception:
            pass

    # Resume & Career Intelligence analysis
    is_resume_doc = (
        recognized_category == "employment_records"
        or "resume" in content_filename.lower()
        or "cv" in content_filename.lower()
        or any(k in full_extracted_text.lower() for k in ("resume", "curriculum vitae", "technical skills", "professional summary"))
    )
    if is_resume_doc:
        cand_name = next((f["normalized_value"] for f in formatted_fields if f["field_name"] in ("applicant_name", "full_name")), None)
        email_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "email_address"), None)
        phone_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "phone_number"), None)
        role_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "job_title"), None)
        emp_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "employer_name"), None)
        li_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "linkedin_profile"), None)
        gh_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "github_profile"), None)
        loc_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "candidate_location"), None)
        skills_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "technical_skills"), None)
        deg_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "degree_title"), None)
        inst_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "institution_name"), None)
        years_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "years_of_experience"), None)
        lang_val = next((f["normalized_value"] for f in formatted_fields if f["field_name"] == "candidate_languages"), None)

        if any((cand_name, email_val, role_val, li_val, gh_val, skills_val)):
            edu_str = None
            if deg_val and inst_val:
                edu_str = f"{deg_val} | {inst_val}"
            elif deg_val or inst_val:
                edu_str = deg_val or inst_val

            specialized_intelligence["resume_intelligence"] = {
                "candidate_name": cand_name,
                "current_role": role_val,
                "employer": emp_val,
                "email": email_val,
                "phone": phone_val,
                "location": loc_val,
                "linkedin": li_val,
                "github": gh_val,
                "skills": skills_val,
                "education": edu_str,
                "languages": lang_val,
                "years_experience": years_val,
            }

    # Identity normalization analysis
    is_identity_doc = (
        recognized_category == "identity_passport"
        or any(k in full_extracted_text.lower() for k in ("passport", "aadhaar", "pan", "income tax", "uidai", "driving licence", "driver license", "voter id", "election commission", "epic"))
    )
    if is_identity_doc:
        ident_dict: dict[str, Any] = {}
        # Passport & MRZ checks
        ind_pass = IdentityResolver.parse_indian_passport(full_extracted_text)
        if ind_pass:
            ident_dict["indian_passport"] = {
                "passport_number": ind_pass.passport_number,
                "holder_name": ind_pass.holder_name,
                "surname": ind_pass.surname,
                "given_names": ind_pass.given_names,
                "date_of_birth": ind_pass.date_of_birth,
                "gender": ind_pass.gender,
                "place_of_birth": ind_pass.place_of_birth,
                "place_of_issue": ind_pass.place_of_issue,
                "date_of_issue": ind_pass.date_of_issue,
                "date_of_expiry": ind_pass.date_of_expiry,
                "emigration_check_status": ind_pass.emigration_check,
                "file_number": ind_pass.file_number,
                "booklet_type": ind_pass.booklet_type,
                "father_name": ind_pass.father_name,
                "mother_name": ind_pass.mother_name,
                "spouse_name": ind_pass.spouse_name,
                "address": ind_pass.address,
                "pin_code": ind_pass.pin_code,
                "nationality": ind_pass.nationality,
                "mrz_detected": ind_pass.mrz_detected,
                "raw_mrz": ind_pass.raw_mrz,
            }

        first_name = next((f["normalized_value"] for f in formatted_fields if f["field_name"] in ("given_names", "given_name", "first_name")), None)
        if not first_name and ind_pass and ind_pass.given_names:
            first_name = ind_pass.given_names

        last_name = next((f["normalized_value"] for f in formatted_fields if f["field_name"] in ("surname", "last_name")), None)
        if not last_name and ind_pass and ind_pass.surname:
            last_name = ind_pass.surname

        if first_name or last_name:
            single_name_res = IdentityResolver.resolve_single_name(first_name, last_name)
            ident_dict["single_name_resolution"] = {
                "is_single_name": single_name_res.is_single_name,
                "uscis_representation": f"Surname: {single_name_res.uscis_surname}, Given Name: {single_name_res.uscis_first_name}",
                "ircc_representation": f"Surname: {single_name_res.ircc_surname}, Given Name: '{single_name_res.ircc_given_name}'",
                "ukvi_representation": f"Family Name: {single_name_res.ukvi_family_name}, Given Name: '{single_name_res.ukvi_given_name}'",
                "guidance": single_name_res.guidance_notes,
            }

        aadhaar_res = IdentityResolver.parse_aadhaar(full_extracted_text)
        if aadhaar_res:
            ident_dict["aadhaar"] = {
                "is_valid": aadhaar_res.is_valid,
                "masked_number": aadhaar_res.masked_aadhaar_number,
                "holder_name": aadhaar_res.holder_name,
                "dob": aadhaar_res.date_of_birth,
                "gender": aadhaar_res.gender,
                "father_or_spouse": aadhaar_res.father_or_spouse_name,
            }

        pan_res = IdentityResolver.parse_pan(full_extracted_text)
        if pan_res:
            ident_dict["pan"] = {
                "is_valid": pan_res.is_valid,
                "pan_number": pan_res.pan_number,
                "entity_type": pan_res.entity_type,
                "holder_name": pan_res.holder_name,
                "fifth_char_surname_match": pan_res.fifth_char_surname_match,
            }

        dl_res = IdentityResolver.parse_driving_licence(full_extracted_text)
        if dl_res:
            ident_dict["driving_licence"] = {
                "is_valid": dl_res.is_valid,
                "licence_number": dl_res.licence_number,
                "jurisdiction": dl_res.jurisdiction,
                "holder_name": dl_res.holder_name,
                "expiry_date": dl_res.expiry_date,
                "vehicle_class": dl_res.vehicle_class,
            }

        voter_res = IdentityResolver.parse_voter_id(full_extracted_text)
        if voter_res:
            ident_dict["voter_id"] = {
                "is_valid": voter_res.is_valid,
                "epic_number": voter_res.epic_number,
                "elector_name": voter_res.elector_name,
                "relative_name": voter_res.relative_name,
            }

        if ident_dict:
            specialized_intelligence["identity_compliance"] = ident_dict

    # Overall calculation of document health
    critical_issues = sum(1 for qf in quality_findings if qf["severity"] == "critical")
    major_issues = sum(1 for qf in quality_findings if qf["severity"] == "major")
    overall_health_score = max(20, round(100 - (critical_issues * 30) - (major_issues * 15)))

    # Geometries summary
    total_blocks = sum(len(p.blocks) for p in pages)

    return {
        "status": "success",
        "metadata": {
            "filename": content_filename,
            "mime_type": mime_type,
            "file_size_bytes": file_size_bytes,
            "sha256_hash": sha256_hash,
            "page_count": len(pages),
            "detected_language": detected_lang,
            "total_blocks_detected": total_blocks,
            "overall_health_score": overall_health_score,
        },
        "recognition": {
            "category": recognized_category,
            "category_label": category_label,
            "confidence": category_confidence,
            "matched_keywords": matched_keywords,
        },
        "extracted_fields": formatted_fields,
        "quality_findings": quality_findings,
        "specialized_intelligence": specialized_intelligence,
        "ocr_summary": {
            "ocr_applied": any(p.ocr_applied for p in pages),
            "avg_page_confidence": round(sum(p.ocr_confidence for p in pages) / max(len(pages), 1), 2),
            "pages": [
                {
                    "page_number": p.page_number,
                    "width": p.width,
                    "height": p.height,
                    "ocr_applied": p.ocr_applied,
                    "ocr_confidence": p.ocr_confidence,
                    "rotation_corrected": p.is_rotation_corrected,
                    "detected_rotation": p.detected_rotation,
                    "block_count": len(p.blocks),
                    "blocks": [
                        {
                            "block_idx": b.block_idx,
                            "text": b.text,
                            "confidence": round(b.confidence, 2),
                            "coordinates": [b.x0, b.y0, b.x1, b.y1],
                        }
                        for b in p.blocks[:15]  # first 15 blocks per page for preview
                    ],
                }
                for p in pages
            ],
        },
        "raw_text_preview": full_extracted_text[:4000],
    }


@router.post("/analyze-text")
async def analyze_text_standalone(request: AnalyzeTextRequest) -> dict[str, Any]:
    """Convenience JSON endpoint to analyze and extract from text content directly."""
    return await analyze_document_standalone(
        file=None,
        raw_text=request.text,
        filename=request.filename,
        declared_category=request.declared_category,
    )
