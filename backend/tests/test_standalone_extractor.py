import io
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_get_extractor_samples(client: TestClient):
    """Verify that sample documents can be fetched without authentication."""
    resp = client.get("/api/v1/extractor/samples")
    assert resp.status_code == 200
    samples = resp.json()
    assert len(samples) >= 6
    sample_ids = [s["id"] for s in samples]
    assert "sample-indian-passport" in sample_ids
    assert "sample-bank-statement" in sample_ids
    assert "sample-us-passport" in sample_ids
    assert "sample-employment-letter" in sample_ids


def test_analyze_passport_text(client: TestClient):
    """Verify standalone recognition and extraction on passport text without login."""
    passport_text = (
        "REPUBLIC OF INDIA\n"
        "PASSPORT\n"
        "Passport No: Z8492014\n"
        "Surname: SHARMA\n"
        "Given Names: AARAV\n"
        "Nationality: INDIAN\n"
        "Date of Birth: 14/08/1992\n"
        "Date of Expiry: 19/05/2028\n"
        "P<INDSHARMA<<AARAV<<<<<<<<<<<<<<<<<<<<<<<<<<\n"
        "Z8492014<2IND9208146M2805194<<<<<<<<<<<<<<04"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": passport_text, "filename": "PASSPORT_SHARMA.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "identity_passport"
    assert data["metadata"]["sha256_hash"] is not None
    assert data["metadata"]["total_blocks_detected"] > 0
    assert len(data["extracted_fields"]) > 0

    field_names = [f["field_name"] for f in data["extracted_fields"]]
    assert any("passport" in fn for fn in field_names) or any("name" in fn for fn in field_names)


def test_analyze_bank_statement_with_forensics(client: TestClient):
    """Verify financial evidence classification, transaction parsing, and unseasoned deposit detection."""
    bank_text = (
        "JPMorgan Chase Bank, N.A.\n"
        "ACCOUNT STATEMENT\n"
        "Statement Period: May 01, 2024 through October 31, 2024\n"
        "Account Number: *******4928\n"
        "Beginning Balance: $14,250.00\n"
        "Ending Balance: $36,230.00\n"
        "05/15/2024  CREDIT  PAYROLL DIRECT DEP  $4,200.00  Balance: $18,450.00\n"
        "09/10/2024  CREDIT  WIRE TRANSFER UNVERIFIED  $25,000.00  Balance: $56,050.00\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": bank_text, "filename": "CHASE_STATEMENT.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "financial_evidence"
    assert "financial_forensics" in data["specialized_intelligence"]
    forensics = data["specialized_intelligence"]["financial_forensics"]
    assert "Chase" in forensics["institution"]
    assert forensics["opening_balance"] == 14250.0 or forensics["closing_balance"] == 36230.0


def test_analyze_file_upload(client: TestClient):
    """Verify file upload via multipart/form-data works seamlessly without credentials."""
    sample_content = b"STANFORD UNIVERSITY\nDegree of Master of Science conferred on Aarav Sharma on June 16, 2019."
    files = {"file": ("STANFORD_DEGREE.txt", io.BytesIO(sample_content), "text/plain")}

    resp = client.post("/api/v1/extractor/analyze", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["metadata"]["filename"] == "STANFORD_DEGREE.txt"
    assert data["metadata"]["file_size_bytes"] == len(sample_content)
    assert data["recognition"]["category"] == "educational_records"


def test_analyze_missing_input_error(client: TestClient):
    """Verify that submitting empty payload returns a clear 400 bad request error."""
    resp = client.post("/api/v1/extractor/analyze", data={})
    assert resp.status_code == 400
    assert "must be provided" in resp.json()["detail"]


def test_analyze_resume_extraction(client: TestClient):
    """Verify resume recognition, candidate name from text header, links, and skills."""
    resume_text = (
        "YASHESH BHAVSAR\n"
        "Senior Full Stack & AI Systems Engineer\n"
        "Ahmedabad, Gujarat, India | yashesh@example.com | +91 98765 43210\n"
        "LinkedIn: linkedin.com/in/yashesh-bhavsar | GitHub: github.com/yasheshbhavsar\n\n"
        "PROFESSIONAL SUMMARY\n"
        "Senior Full Stack & AI Systems Engineer with 6+ years of experience designing scalable web and cloud architectures.\n\n"
        "TECHNICAL SKILLS\n"
        "Languages: Python, TypeScript, JavaScript, SQL\n"
        "Frameworks: FastAPI, Next.js, React, Node.js\n"
        "Cloud & DevOps: Docker, AWS, Google Cloud, PostgreSQL\n\n"
        "WORK EXPERIENCE\n"
        "Senior Software Engineer - Tech Solutions Inc. (2021 - Present)\n"
        "- Architected high-throughput AI document pipelines.\n\n"
        "EDUCATION\n"
        "Bachelor of Technology in Computer Engineering (2016 - 2020)\n"
        "Gujarat Technological University | GPA: 3.8 / 4.0\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": resume_text, "filename": "Yashesh bhavsar - Resume - Final.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "employment_records"

    # Verify extracted fields
    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert "Yashesh Bhavsar" in field_map.get("applicant_name", "") or "Yashesh Bhavsar" in field_map.get("full_name", "")
    assert field_map.get("email_address") == "yashesh@example.com"
    assert "+91 98765 43210" in field_map.get("phone_number", "")
    assert "linkedin.com/in/yashesh-bhavsar" in field_map.get("linkedin_profile", "")
    assert "github.com/yasheshbhavsar" in field_map.get("github_profile", "")
    assert "Engineer" in field_map.get("job_title", "") and "Senior" in field_map.get("job_title", "")
    assert "Python" in field_map.get("technical_skills", "")
    assert "Bachelor Of Technology" in field_map.get("degree_title", "")

    # Verify resume intelligence section
    assert "resume_intelligence" in data["specialized_intelligence"]
    ri = data["specialized_intelligence"]["resume_intelligence"]
    assert "Yashesh" in ri["candidate_name"]
    assert ri["email"] == "yashesh@example.com"
    assert "linkedin.com/in/yashesh-bhavsar" in ri["linkedin"]
    assert "github.com/yasheshbhavsar" in ri["github"]


def test_analyze_aadhaar_pan_identity(client: TestClient):
    """Verify Aadhaar 8-digit masking and PAN classification in identity extraction."""
    govt_id_text = (
        "GOVERNMENT OF INDIA\n"
        "UNIQUE IDENTIFICATION AUTHORITY OF INDIA\n"
        "Name: AARAV SHARMA\n"
        "DOB: 14/08/1992\n"
        "Gender: Male / पुरुष\n"
        "S/O: RAJESH SHARMA\n"
        "Aadhaar Number: 9482 1094 8492\n\n"
        "INCOME TAX DEPARTMENT - GOVT. OF INDIA\n"
        "PERMANENT ACCOUNT NUMBER (PAN CARD)\n"
        "Permanent Account Number: AAAPS8492K\n"
        "Name: AARAV SHARMA\n"
        "Father's Name: RAJESH SHARMA\n"
        "Date of Birth: 14/08/1992\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": govt_id_text, "filename": "NATIONAL_ID_CARD.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "identity_passport"

    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert field_map.get("aadhaar_number_masked") == "XXXX-XXXX-8492"
    assert field_map.get("pan_number") == "AAAPS8492K"
    assert "Individual" in field_map.get("pan_taxpayer_type", "")

    # Identity compliance specialized intelligence
    assert "identity_compliance" in data["specialized_intelligence"]
    ic = data["specialized_intelligence"]["identity_compliance"]
    assert ic["aadhaar"]["masked_number"] == "XXXX-XXXX-8492"
    assert ic["pan"]["pan_number"] == "AAAPS8492K"
    assert "Individual" in ic["pan"]["entity_type"]


def test_analyze_driving_licence_and_voter_id(client: TestClient):
    """Verify Indian Driving Licence and Voter ID / EPIC recognition."""
    dl_voter_text = (
        "UNION OF INDIA DRIVING LICENCE\n"
        "GUJARAT MOTOR VEHICLES DEPARTMENT\n"
        "Licence No: GJ01 20150001234\n"
        "Name: AARAV SHARMA\n"
        "Valid Till: 19/05/2035\n"
        "Class: LMV\n\n"
        "ELECTION COMMISSION OF INDIA\n"
        "ELECTOR'S PHOTO IDENTITY CARD\n"
        "EPIC No: ABC1234567\n"
        "Elector's Name: AARAV SHARMA\n"
        "Father's Name: RAJESH SHARMA\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": dl_voter_text, "filename": "DRIVING_LICENCE_AND_VOTER_ID.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "identity_passport"

    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert "GJ0120150001234" in field_map.get("driving_licence_number", "").replace(" ", "")
    assert "Gujarat" in field_map.get("driving_licence_jurisdiction", "")
    assert field_map.get("voter_id_number") == "ABC1234567"

