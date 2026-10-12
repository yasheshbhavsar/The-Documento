import io
import uuid
from uuid import UUID

import pytest
import pymupdf
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.domain.models import (
    Document,
    DocumentExtractedField,
    Organization,
    ClientProfile,
    ImmigrationCase,
)


def create_synthetic_pdf(text_lines: list[str]) -> bytes:
    """Generates a valid synthetic PDF document in memory using PyMuPDF."""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)  # Standard Letter
    y = 72
    for line in text_lines:
        page.insert_text(pymupdf.Point(72, y), line, fontsize=12)
        y += 24
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_synthetic_passport_pdf() -> bytes:
    lines = [
        "PASSPORT / PASSEPORT",
        "UNITED STATES OF AMERICA",
        "Type: P  Code: USA  Passport No: C09812491",
        "Surname: ROSTOVA",
        "Given Names: ELENA",
        "Nationality: UNITED STATES OF AMERICA",
        "Date of Birth: 12 APR 1988",
        "Sex: F",
        "Place of Birth: CALIFORNIA, U.S.A.",
        "Date of Issue: 10 MAY 2021",
        "Date of Expiration: 09 MAY 2031",
        "Authority: United States Department of State",
        "P<USAROSTOVA<<ELENA<<<<<<<<<<<<<<<<<<<<<<<<<",
        "C098124914USA8804128F3105094<<<<<<<<<<<<<<06",
    ]
    return create_synthetic_pdf(lines)


def create_synthetic_diploma_pdf() -> bytes:
    lines = [
        "STANFORD UNIVERSITY",
        "THE TRUSTEES OF THE UNIVERSITY HAVE CONFERRED UPON",
        "ELENA ROSTOVA",
        "THE DEGREE OF DOCTOR OF PHILOSOPHY",
        "IN COMPUTER SCIENCE AND ARTIFICIAL INTELLIGENCE",
        "CUMULATIVE GPA: 3.96 / 4.00",
        "CONFERRED ON: 15 JUNE 2018",
    ]
    return create_synthetic_pdf(lines)


def create_synthetic_employment_pdf() -> bytes:
    lines = [
        "NEURALDYNAMICS AI TECHNOLOGIES INC.",
        "EMPLOYMENT VERIFICATION LETTER",
        "To Whom It May Concern:",
        "This letter certifies that Dr. Elena Rostova is employed full-time with our firm.",
        "Job Title: Senior AI Principal Research Scientist",
        "Employment Start Date: 01 September 2018",
        "Annual Salary: $245,000.00 USD per year",
        "Hours Per Week: 40 hours per week",
        "Duties: Leading foundation model alignment and neuro-symbolic reasoning.",
    ]
    return create_synthetic_pdf(lines)


def create_synthetic_bank_statement_pdf() -> bytes:
    lines = [
        "JPMORGAN CHASE BANK, N.A.",
        "PRIVATE CLIENT ACCOUNT STATEMENT",
        "Account Holder: Dr. Elena Rostova",
        "Account Number ending in: ...4921",
        "Statement Date: 30 September 2026",
        "Closing Balance: $148,250.75 USD",
        "Available Funds: $148,250.75 USD",
        "Total Deposits: $35,000.00",
    ]
    return create_synthetic_pdf(lines)





@pytest.fixture
def auth_headers():
    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    return {
        "X-Organization-Id": org_id,
        "X-User-Id": user_id,
        "X-User-Role": "case_manager",
    }


# =====================================================================
# A. SECURE UPLOAD & VALIDATION TESTS
# =====================================================================

def test_authorized_upload_session(client, auth_headers):
    idempotency_key = f"idem-{uuid.uuid4()}"
    res = client.post(
        "/api/v1/documents/upload-sessions",
        headers=auth_headers,
        json={
            "idempotency_key": idempotency_key,
            "filename": "Passport_Biodata.pdf",
            "mime_type": "application/pdf",
            "byte_size": 24000,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["idempotency_key"] == idempotency_key
    assert data["status"] == "initiated"
    assert "expires_at" in data


def test_reject_magic_byte_mismatch(client, auth_headers):
    # Fake PDF: text payload claiming to be application/pdf
    fake_content = b"This is just plain text, not a valid PDF header!"
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("fake.pdf", io.BytesIO(fake_content), "application/pdf")},
        data={"category": "identity_passport"},
    )
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]


def test_reject_dangerous_executable_payload(client, auth_headers):
    # Windows PE executable header (MZ) disguised as a PDF
    exe_content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("malicious.pdf", io.BytesIO(exe_content), "application/pdf")},
        data={"category": "supporting_evidence"},
    )
    assert res.status_code == 400
    assert "Executable or forbidden file format detected" in res.json()["detail"]


def test_reject_eicar_malware(client, auth_headers):
    # EICAR test string embedded in bytes
    eicar_bytes = b"%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF"
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("virus_sample.pdf", io.BytesIO(eicar_bytes), "application/pdf")},
    )
    assert res.status_code == 400
    assert "Malware scanning violation" in res.json()["detail"]


def test_upload_idempotency_and_sha256(client, db, auth_headers):
    org_id = UUID(auth_headers["X-Organization-Id"])
    org = Organization(id=org_id, name="Test Immigration Firm", slug=f"test-{uuid.uuid4().hex[:6]}")
    db.add(org)
    client_prof = ClientProfile(id=uuid.uuid4(), organization_id=org_id, first_name="Elena", last_name="Rostova", email="elena@example.com", nationality="USA")
    db.add(client_prof)
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_prof.id,
        case_number="CASE-2026-999",
        title="Extraordinary Ability EB-1A",
        jurisdiction="USA",
        visa_category="EB-1A",
    )
    db.add(case)
    db.commit()

    pdf_bytes = create_synthetic_passport_pdf()
    case_id = str(case.id)

    # 1. First upload
    res1 = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Elena_Passport.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"category": "identity_passport", "case_id": case_id},
    )
    assert res1.status_code == 201
    doc1 = res1.json()
    assert doc1["sha256_hash"] is not None
    assert doc1["version"] == 1

    # 2. Re-upload identical file to same case -> returns existing document (idempotent deduplication)
    res2 = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Elena_Passport.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"category": "identity_passport", "case_id": case_id},
    )
    assert res2.status_code == 201
    doc2 = res2.json()
    assert doc1["id"] == doc2["id"]
    assert doc1["sha256_hash"] == doc2["sha256_hash"]


def test_document_versioning(client, auth_headers):
    v1_bytes = create_synthetic_pdf(["Original Draft of Employment Offer", "Salary: $150,000"])
    v2_bytes = create_synthetic_pdf(["Updated Final Employment Offer", "Salary: $165,000", "Sign-on bonus: $20,000"])

    # Upload v1
    res1 = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Offer_Letter.pdf", io.BytesIO(v1_bytes), "application/pdf")},
        data={"title": "Offer Letter v1"},
    )
    assert res1.status_code == 201
    doc1 = res1.json()
    assert doc1["version"] == 1
    assert doc1["is_current_version"] is True

    # Upload v2 with parent_document_id
    res2 = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Offer_Letter_Final.pdf", io.BytesIO(v2_bytes), "application/pdf")},
        data={"title": "Offer Letter v2", "parent_document_id": doc1["id"]},
    )
    assert res2.status_code == 201
    doc2 = res2.json()
    assert doc2["version"] == 2
    assert doc2["is_current_version"] is True

    # Inspect versions endpoint
    v_res = client.get(f"/api/v1/documents/{doc2['id']}/versions", headers=auth_headers)
    assert v_res.status_code == 200
    versions = v_res.json()
    assert len(versions) == 2
    assert versions[0]["version"] == 1
    assert versions[0]["is_current_version"] is False
    assert versions[1]["version"] == 2
    assert versions[1]["is_current_version"] is True


def test_secure_download_with_short_lived_token(client, auth_headers):
    pdf_bytes = create_synthetic_passport_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Passport.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    doc = res.json()
    download_url = doc["download_url"]
    assert download_url is not None

    # Download with token
    dl_res = client.get(download_url)
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"
    assert dl_res.content == pdf_bytes

    # Attempt download with invalid/tampered token
    bad_res = client.get(f"/api/v1/documents/{doc['id']}/download?token=invalid.tampered.token")
    assert bad_res.status_code == 403


# =====================================================================
# B. PROCESSING, OCR & STRUCTURED EXTRACTION PROVENANCE TESTS
# =====================================================================

def test_passport_mrz_and_field_extraction(client, auth_headers):
    passport_bytes = create_synthetic_passport_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("US_Passport_Rostova.pdf", io.BytesIO(passport_bytes), "application/pdf")},
        data={"category": "identity_passport"},
    )
    assert res.status_code == 201
    doc = res.json()

    assert doc["processing_status"] == "completed"
    # CRITICAL: Verification status must remain unverified!
    assert doc["verification_status"] == "unverified"
    assert doc["detected_language"] == "en"
    assert doc["page_count"] == 1

    # Inspect extracted fields and provenance
    fields = {f["field_name"]: f for f in doc["extracted_fields"]}
    assert "passport_number" in fields
    assert fields["passport_number"]["original_value"] == "C09812491"
    assert fields["passport_number"]["source_page"] == 1
    assert fields["passport_number"]["ocr_confidence"] >= 0.90
    assert fields["passport_number"]["extraction_confidence"] >= 0.90
    assert fields["passport_number"]["validation_status"] == "unvalidated"

    assert "full_name" in fields
    assert "ROSTOVA" in fields["full_name"]["original_value"]

    assert "date_of_birth" in fields
    assert fields["date_of_birth"]["normalized_value"] == "1988-04-12"

    assert "nationality" in fields
    assert fields["nationality"]["normalized_value"] == "USA"


def test_diploma_extraction_and_classification(client, auth_headers):
    diploma_bytes = create_synthetic_diploma_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Stanford_PhD.pdf", io.BytesIO(diploma_bytes), "application/pdf")},
        data={"category": "supporting_evidence"},  # Let classifier detect category
    )
    assert res.status_code == 201
    doc = res.json()

    assert doc["category"] == "educational_records"
    fields = {f["field_name"]: f for f in doc["extracted_fields"]}
    assert "degree_title" in fields
    assert "Doctor Of Philosophy" == fields["degree_title"]["normalized_value"] or "DOCTOR OF PHILOSOPHY" in fields["degree_title"]["original_value"].upper()
    assert "institution_name" in fields
    assert "Stanford University" == fields["institution_name"]["normalized_value"] or "STANFORD UNIVERSITY" in fields["institution_name"]["original_value"].upper()
    assert "gpa" in fields
    assert "3.96" in fields["gpa"]["original_value"]


def test_employment_letter_extraction(client, auth_headers):
    emp_bytes = create_synthetic_employment_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Employment_Letter.pdf", io.BytesIO(emp_bytes), "application/pdf")},
        data={"category": "employment_records"},
    )
    doc = res.json()
    fields = {f["field_name"]: f for f in doc["extracted_fields"]}

    assert "job_title" in fields
    assert "Senior AI Principal Research Scientist" in fields["job_title"]["original_value"]

    assert "annual_salary" in fields
    assert "245000.00 USD" == fields["annual_salary"]["normalized_value"]

    assert "employment_start_date" in fields
    assert fields["employment_start_date"]["normalized_value"] == "2018-09-01"


def test_financial_statement_extraction(client, auth_headers):
    bank_bytes = create_synthetic_bank_statement_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Chase_Statement.pdf", io.BytesIO(bank_bytes), "application/pdf")},
        data={"category": "financial_evidence"},
    )
    doc = res.json()
    fields = {f["field_name"]: f for f in doc["extracted_fields"]}

    assert "financial_institution" in fields
    assert "CHASE BANK" in fields["financial_institution"]["original_value"].upper() or "Chase Bank" in fields["financial_institution"]["normalized_value"]

    assert "closing_balance" in fields
    assert "148250.75 USD" == fields["closing_balance"]["normalized_value"]


# =====================================================================
# C. HUMAN VERIFICATION & FIELD CORRECTION AUDIT TRAIL TESTS
# =====================================================================

def test_human_verification_workflow(client, auth_headers):
    pdf_bytes = create_synthetic_passport_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Passport.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    doc = res.json()
    assert doc["verification_status"] == "unverified"

    # Human case manager certifies verification
    v_res = client.put(
        f"/api/v1/documents/{doc['id']}/verify",
        headers=auth_headers,
        json={"status": "verified", "notes": "Physical passport inspected and biometric chip match confirmed."},
    )
    assert v_res.status_code == 200
    updated = v_res.json()
    assert updated["verification_status"] == "verified"
    assert updated["verified_at"] is not None
    assert "Physical passport inspected" in updated["verification_notes"]


def test_field_correction_provenance_and_reprocessing(client, auth_headers):
    passport_bytes = create_synthetic_passport_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("Passport.pdf", io.BytesIO(passport_bytes), "application/pdf")},
    )
    doc = res.json()
    dob_field = next(f for f in doc["extracted_fields"] if f["field_name"] == "date_of_birth")

    # Correct DOB field
    corr_res = client.put(
        f"/api/v1/documents/{doc['id']}/fields/{dob_field['id']}",
        headers=auth_headers,
        json={
            "corrected_value": "1988-04-12",
            "reason": "Corrected format to align with sworn birth certificate registry",
        },
    )
    assert corr_res.status_code == 200
    corrected = corr_res.json()
    assert corrected["is_manually_corrected"] is True
    assert corrected["corrected_value"] == "1988-04-12"
    assert corrected["validation_status"] == "corrected"
    assert len(corrected["correction_history"]) == 1
    assert corrected["correction_history"][0]["new_value"] == "1988-04-12"

    # Reprocess document -> manual correction MUST be preserved
    reproc_res = client.post(f"/api/v1/documents/{doc['id']}/reprocess", headers=auth_headers)
    assert reproc_res.status_code == 200
    reproc_doc = reproc_res.json()
    reproc_dob = next(f for f in reproc_doc["extracted_fields"] if f["field_name"] == "date_of_birth")
    assert reproc_dob["is_manually_corrected"] is True
    assert reproc_dob["corrected_value"] == "1988-04-12"
    assert reproc_dob["validation_status"] == "corrected"


# =====================================================================
# D. SECURITY, TENANT ISOLATION & OBJECT-LEVEL ACCESS TESTS
# =====================================================================

def test_cross_tenant_document_isolation(client, auth_headers):
    # Org A uploads document
    pdf_bytes = create_synthetic_passport_pdf()
    res = client.post(
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("OrgA_Passport.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    doc = res.json()

    # Org B attempts to retrieve Org A document
    org_b_headers = {
        "X-Organization-Id": str(uuid.uuid4()),
        "X-User-Id": str(uuid.uuid4()),
        "X-User-Role": "master_admin",
    }
    b_res = client.get(f"/api/v1/documents/{doc['id']}", headers=org_b_headers)
    assert b_res.status_code == 403

    # Org B attempts to download Org A document
    dl_res = client.get(f"/api/v1/documents/{doc['id']}/download", headers=org_b_headers)
    assert dl_res.status_code == 403
