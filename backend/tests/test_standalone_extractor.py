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
        "ROHAN VERMA\n"
        "Senior Full Stack & AI Systems Engineer\n"
        "Ahmedabad, Gujarat, India | rohan.verma@example.com | +91 98765 43210\n"
        "LinkedIn: linkedin.com/in/rohan-verma | GitHub: github.com/rohanverma\n\n"
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
        data={"raw_text": resume_text, "filename": "Rohan Verma - Resume - Final.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "employment_records"

    # Verify extracted fields
    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert "Rohan Verma" in field_map.get("applicant_name", "") or "Rohan Verma" in field_map.get("full_name", "")
    assert field_map.get("email_address") == "rohan.verma@example.com"
    assert "+91 98765 43210" in field_map.get("phone_number", "")
    assert "linkedin.com/in/rohan-verma" in field_map.get("linkedin_profile", "")
    assert "github.com/rohanverma" in field_map.get("github_profile", "")
    assert "Engineer" in field_map.get("job_title", "") and "Senior" in field_map.get("job_title", "")
    assert "Python" in field_map.get("technical_skills", "")
    assert "Bachelor Of Technology" in field_map.get("degree_title", "")

    # Verify resume intelligence section
    assert "resume_intelligence" in data["specialized_intelligence"]
    ri = data["specialized_intelligence"]["resume_intelligence"]
    assert "Rohan" in ri["candidate_name"]
    assert ri["email"] == "rohan.verma@example.com"
    assert "linkedin.com/in/rohan-verma" in ri["linkedin"]
    assert "github.com/rohanverma" in ri["github"]


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


def test_compare_same_person_document_set_all_dimensions(client: TestClient):
    """
    Verify that POST /api/v1/extractor/compare-set detects discrepancies across a set of the
    same person's documents for:
    1. Applicant Legal Name (middle name omission, '-kumar'/'-bhai' honorific expansion)
    2. Date of Birth (DOB year/day discrepancy)
    3. Parents' Names (Father's Name & Mother's Name changes / patronymic additions)
    4. Residential Address & PIN Code changes
    """
    payload = {
        "applicant_name": "Vikram Ramesh Mehta",
        "applicant_dob": "1965-05-14",
        "documents": [
            {
                "title": "PASSPORT_FRONT_BACK.pdf",
                "text": (
                    "REPUBLIC OF INDIA\n"
                    "Passport No: Z3948102\n"
                    "Surname: MEHTA\n"
                    "Given Name: VIKRAM RAMESH\n"
                    "Date of Birth: 14/05/1965\n"
                    "Father's Legal Name: RAMESH MEHTA\n"
                    "Mother's Legal Name: SAVITA MEHTA\n"
                    "Address: 204 SUNRISE APARTMENTS, NAVRANGPURA, AHMEDABAD - 380009\n"
                ),
            },
            {
                "title": "AADHAAR_CARD.pdf",
                "text": (
                    "GOVERNMENT OF INDIA\n"
                    "Name: Vikram Mehta\n"
                    "DOB: 14/05/1966\n"
                    "S/O: Rameshbhai Mohanbhai Mehta\n"
                    "Address: 12 SHIVALIK BUNGALOWS, SATELLITE, AHMEDABAD - 380015\n"
                    "4589 1234 9087\n"
                ),
            },
            {
                "title": "MARRIAGE_CERTIFICATE.pdf",
                "text": (
                    "MEMORANDUM OF MARRIAGE\n"
                    "Date of Marriage: 22/11/1991\n"
                    "Bridegroom Name: Vikramkumar Rameshbhai Mehta\n"
                    "Father's Name: Ramesh Mohanbhai Mehta\n"
                    "Mother's Name: Savitaben Ramesh Mehta\n"
                    "Address: 204 SUNRISE APARTMENTS, NAVRANGPURA, AHMEDABAD - 380009\n"
                ),
            },
        ],
    }

    resp = client.post("/api/v1/extractor/compare-set", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["documents_analyzed"] == 3

    dims = {d["dimension"] for d in data["discrepancies"]}
    assert "applicant_name" in dims
    assert "date_of_birth" in dims
    assert "father_name" in dims
    assert "mother_name" in dims
    assert "address" in dims


def test_english_gujarati_hindi_character_filtering_and_birth_certificate(client: TestClient):
    """
    Verify that:
    1. Only English, Gujarati (\u0A80-\u0AFF), and Hindi (\u0900-\u097F) characters are kept while
       non-supported scripts (Chinese/CJK, Cyrillic, Arabic) and dotted form leader lines ('........')
       are stripped.
    2. A bilingual Gujarati + English Birth Certificate with dotted leader lines and multi-line field
       placement accurately extracts Child Name, Sex, Date of Birth, Place of Birth, Mother's Name,
       Father's Name, Parents' Address, Registration No., and Date of Registration without ever
       emitting 'Of Mother . ........................' or dotted strings.
    """
    bilingual_birth_cert = (
        "BIRTH CERTIFICATE 中文测试 Привет مرحبا\n"
        "(જન્મ અને મરણ નોંધણી અધિનિયમ ૧૯૬૯ની કલમ ૧૨/૧૭ અને\n"
        "ગુજરાત જન્મ-મરણ નોંધણી નિયમો, ૨૦૦૪ નિયમ-૮/૧૩ મુજબ.\n"
        "(Issued under Section 12/17 of the Registration of Births and Deaths Act, 1969\n"
        "and Rule 8/13 of the Gujarat Registration of Births and Deaths Rules, 2004)\n"
        "આથી પ્રમાણિત કરવામાં આવે છે કે નીચેની માહિતી જન્મના મૂળ રેકર્ડમાંથી લેવામાં આવી છે. જે ગુજરાત રાજ્યનાં.........................\n"
        "જિલ્લાનાં ......................... તાલુકાનાં ......................... ગામ/શહેરના રજિસ્ટરમાં છે.\n"
        "This is to Certify that the following information has been taken from the original record of birth which is in the register\n"
        "for village/City .....KALOL............ of Taluka .....KALOL.......... of District ..GANDHINAGAR. Gujarat State\n"
        "૧. નામ : ..............................................\n"
        "AARAV\n"
        "1. Name : ..............................................\n"
        "૨. જાતિ (પુ./સ્ત્રી) : ..............................................\n"
        "Male\n"
        "2. Sex (M/F) : ..............................................\n"
        "૩. જન્મ તારીખ : ..............................................\n"
        "05/02/2005\n"
        "3. Date of Birth : ..............................................\n"
        "૪. જન્મ સ્થળ : ..............................................\n"
        "4. Place of Birth\n"
        "SUNRISE HOSPITAL KALOL\n"
        "૫. માતાનું નામ : ..............................................\n"
        "5. Name of Mother : ....MEERABEN.........................\n"
        "૬. પિતાનું નામ : ..............................................\n"
        "6. Name of Father\n"
        "RAJESHWAR DAHYABHAI SHARMA\n"
        "૭. બાળકના જન્મ સમયે માતા-પિતાનું સરનામું\n"
        "7. Address of parents at the time of Birth of child\n"
        "17,SURYODAY SOCIETY,\n"
        "KALOL\n"
        "..............................................................\n"
        "૮. માતા/પિતાનું કાયમી સરનામું\n"
        "8. Permanent Address of Parents\n"
        "17,SURYODAY SOCIETY,\n"
        "KALOL\n"
        "..............................................................\n"
        "૯. નોંધણી ક્રમાંક : ..............................................\n"
        "9. Registration No. : ....466................................\n"
        "૧૦. નોંધણીની તારીખ : ..............................................\n"
        "10. Date of Registration ......10/02/2005...................\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": bilingual_birth_cert, "filename": "8. PROOF OF RELATIONSHIP - SAMPLE.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "civil_status_family"
    assert data["metadata"]["detected_language"] == "gu"

    # Ensure CJK, Cyrillic, Arabic, and dotted runs were stripped from raw_text_preview
    cleaned_full = data["raw_text_preview"]
    assert "中文" not in cleaned_full
    assert "Привет" not in cleaned_full
    assert "مرحبا" not in cleaned_full
    assert "........" not in cleaned_full
    assert "જન્મ અને મરણ" in cleaned_full

    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert field_map.get("full_name") == "Aarav"
    assert field_map.get("applicant_name") == "Aarav"
    assert field_map.get("gender") == "Male"
    assert field_map.get("date_of_birth") == "2005-02-05"
    assert field_map.get("place_of_birth") == "Sunrise Hospital Kalol"
    assert field_map.get("mother_legal_name") == "Meeraben"
    assert field_map.get("father_legal_name") == "Rajeshwar Dahyabhai Sharma"
    assert "17, Suryoday Society, Kalol" in field_map.get("residential_address", "")
    assert field_map.get("birth_registration_number") == "466"
    assert field_map.get("birth_registration_date") == "2005-02-10"


def test_trilingual_indian_document_gujarati_hindi_english_compliance(client: TestClient):
    """
    Verify that a trilingual Indian document containing English, Gujarati (ગુજરાતી), and Hindi (हिन्दी)
    labels and Indic numerals (૦-૯ / ०-९) is fully compliant, does NOT escalate to the Case Worker,
    and normalizes Indic numerals into ISO dates.
    """
    trilingual_doc = (
        "ભારત સરકાર / भारत सरकार / GOVERNMENT OF INDIA\n"
        "जन्म प्रमाण पत्र / જન્મ પ્રમાણપત્ર / BIRTH CERTIFICATE\n"
        "નામ / नाम / Name: KAVYA DEVANG MEHTA\n"
        "જાતિ / लिंग: સ્ત્રી / महिला\n"
        "જન્મ તારીખ / जन्म तिथि: ૧૮/૦૪/૨૦૦૬\n"
        "જન્મ સ્થળ / जन्म स्थान: Suryam Hospital Kalol\n"
        "માતાનું નામ / माता का नाम: NEHABEN DEVANG MEHTA\n"
        "પિતાનું નામ / पिता का नाम: DEVANGKUMAR RAMESHBHAI MEHTA\n"
        "કાયમી સરનામું / स्थायी पता: 24, Shantiniketan Society, Kalol, Gandhinagar - 382721\n"
        "નોંધણી ક્રમાંક / पंजीकरण संख्या: ૮૧૪\n"
        "નોંધણીની તારીખ / पंजीकरण तिथि: ૨૨/૦૪/૨૦૦૬\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": trilingual_doc, "filename": "TRILINGUAL_GUJARAT_CERT.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["metadata"]["is_language_compliant"] is True
    assert data["metadata"]["requires_caseworker_escalation"] is False
    assert data["metadata"]["escalation_status"] == "COMPLIANT"
    assert data["metadata"]["detected_language"] in ("gu", "hi")

    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert field_map.get("full_name") == "Kavya Devang Mehta"
    assert field_map.get("gender") == "Female"
    assert field_map.get("date_of_birth") == "2006-04-18"
    assert field_map.get("mother_legal_name") == "Nehaben Devang Mehta"
    assert field_map.get("father_legal_name") == "Devangkumar Rameshbhai Mehta"
    assert field_map.get("birth_registration_number") == "814"
    assert field_map.get("birth_registration_date") == "2006-04-22"


def test_unknown_language_escalates_to_caseworker(client: TestClient):
    """
    Verify that any document in an unknown or unsupported language (outside English, Gujarati, and Hindi)
    is automatically flagged and raised to the Case Worker so the Case Worker can contact the client
    or work on the document manually.
    """
    spanish_doc = (
        "REPÚBLICA DE COLOMBIA - REGISTRADURÍA NACIONAL DEL ESTADO CIVIL\n"
        "CERTIFICADO DE NACIMIENTO Y REGISTRO CIVIL\n"
        "Nombre Completo: CARLOS ANDRÉS MENDOZA LÓPEZ\n"
        "Apellidos: MENDOZA LÓPEZ\n"
        "Fecha de Nacimiento: 19/07/1991\n"
        "Lugar de Nacimiento: Bogotá, Distrito Capital\n"
        "Nacionalidad: Colombiana\n"
        "Estado Civil: Casado\n"
        "Domicilio Actual: Calle 72 No. 10-34, Bogotá\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": spanish_doc, "filename": "FOREIGN_BIRTH_CERT_ES.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["metadata"]["detected_language"] == "unknown"
    assert data["metadata"]["is_language_compliant"] is False
    assert data["metadata"]["requires_caseworker_escalation"] is True
    assert data["metadata"]["escalation_status"] == "ESCALATED_TO_CASEWORKER"
    assert "Case Worker" in (data["metadata"]["caseworker_action"] or "")
    assert data["metadata"]["client_outreach_template"] is not None

    # Must also emit a critical quality finding raising the document to the Case Worker
    escalation_findings = [
        qf for qf in data["quality_findings"] if qf["finding_type"] == "unsupported_language_escalation"
    ]
    assert len(escalation_findings) == 1
    assert escalation_findings[0]["severity"] == "critical"
    assert "Case Worker" in escalation_findings[0]["title"]
    assert "Case Worker" in escalation_findings[0]["recommended_action"]


def test_handwritten_ocr_artifact_normalization_and_marriage_certificate(client: TestClient):
    """
    Verify that handwritten Indian certificate OCR artifacts (such as '-BHAT' for '-BHAI',
    'SHTLP' for 'SHILP', 'sonof'/'daughterof', 'tsiding at'/'n siding a', handwritten slashes
    read as '1' before 4-digit years like '14/0512008', spaced dates like '29- 7-2008',
    underscored serial numbers like '_8 2_', and interline surname placement) are
    deterministically normalized and extracted accurately.
    """
    handwritten_marriage_cert = (
        "Form II (See Rule 5)\n"
        "GOVERNMENT OF GUJARAT\n"
        "CERTIFICATE OF MARRIAGE\n"
        "This is to Certify that Shri ....DEVANSH..................................................\n"
        "sonof Shri ....RAMESHBHAT SHAH..................... tsiding at ...12, SHANTIVAN\n"
        "SOCIETY, KALOL............................................................................\n"
        "and ....SHTLPABEN................... daughterof Shri ..KARANBHAT......................\n"
        "n siding a ...VADODARA.............\n"
        "SHAH\n"
        "have furnished the particulars in Memorandum\n"
        "declaring that their marriage has been solemnized on 14/0512008ar KALOL\n"
        "and that the same has been registered on 29- 7-2008 at serial No _8 2_ of volume\n"
        "of register of marriages maintained under the Gujarat Registration of Marriages Act, 2006.\n"
        "Date : 29- 7-2008\n"
        "Place : Kalol\n"
    )

    resp = client.post(
        "/api/v1/extractor/analyze",
        data={"raw_text": handwritten_marriage_cert, "filename": "MARRIAGE_CERTIFICATE_HANDWRITTEN.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["recognition"]["category"] == "civil_status_family"

    field_map = {f["field_name"]: f["normalized_value"] for f in data["extracted_fields"]}
    assert field_map.get("groom_name") == "Devansh"
    assert field_map.get("father_legal_name") == "Rameshbhai Shah"
    assert field_map.get("bride_name") == "Shilpaben"
    assert field_map.get("bride_father_name") == "Karanbhai Shah"
    assert field_map.get("marriage_date") == "2008-05-14"
    assert field_map.get("marriage_registration_date") == "2008-07-29"
    assert field_map.get("marriage_certificate_number") == "82"
    assert "handwriting_recognition" in data["specialized_intelligence"]


def test_multi_person_packet_sorter_and_splitter(client: TestClient):
    """
    Verify that a combined multi-person PDF packet containing:
    - Person 1's Passport + 2-page Bank Statement (with concatenated/initial name variations)
    - Person 2's ITR Acknowledgement + Schedule continuation page (with Father's Name as metadata)
    - A Joint Marriage Certificate naming both Person 1 and Person 2
    is accurately separated into individual Person Folders, groups multi-page continuations,
    places the joint Marriage Certificate in both folders, and keeps Father's Name out of folder creation.
    """
    import fitz

    doc = fitz.open()

    # Page 1: Person 1 Passport (Vikram Arvindbhai Mehta)
    p1 = doc.new_page()
    p1.insert_text(
        (50, 70),
        "REPUBLIC OF INDIA\nPASSPORT\nSurname\nMEHTA\nGiven Name(s)\nVIKRAM ARVINDBHAI\n"
        "Passport No: K8877665\nDate of Birth: 12/04/1988\n"
        "P<INDMEHTA<<VIKRAM<ARVINDBHAI<<<<<<<<<<<<<<<\n"
        "K8877665<4IND8804126M3004112<<<<<<<<<<<<<<04",
    )

    # Page 2: Person 1 Bank Statement Page 1
    p2 = doc.new_page()
    p2.insert_text(
        (50, 70),
        "The Mehsana Urban Co-Operative Bank Ltd.\nStatement of Account\n"
        "Name VIKRAMARVINDBHAIMEHTA\nIFSC Code MSNU0000047\n"
        "Account Number 00471001009999\nStatement Period 01/01/2025 To 31/03/2025\n"
        "SNo. Date Description Debit Credit Balance\n1 2025-01-10 SALARY CREDIT 0.00 85,000.00 285,000.00",
    )

    # Page 3: Person 1 Bank Statement Page 2 (Continuation page without header name)
    p3 = doc.new_page()
    p3.insert_text(
        (50, 70),
        "Statement of Account\nSNo. Date Description Debit Credit Cheque No Balance\n"
        "Opening Balance 200,000.00\nTotal Credit 85,000.00\nClosing Balance 285,000.00\n"
        "-End of Statement-\nPage 2 of 2",
    )

    # Page 4: Person 2 ITR Acknowledgement (Kavita Vikram Mehta, with Father's Name as metadata)
    p4 = doc.new_page()
    p4.insert_text(
        (50, 70),
        "INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT\nAssessment Year 2024-25\n"
        "PAN ABCDE1234F\nName KAVITA VIKRAM MEHTA\nAddress 10, Shanti Park, Ahmedabad\nStatus Individual",
    )

    # Page 5: Person 2 ITR Computation Continuation Page (includes Father's Name 'Mohanlal Joshi')
    p5 = doc.new_page()
    p5.insert_text(
        (50, 70),
        "Name of Assessee KAVITA VIKRAM MEHTA Father's Name MOHANLAL JOSHI\n"
        "PAN : ABCDE1234F AY. 2024-2025\nComputation of Total Income\nGross Total Income 6,40,000",
    )

    # Page 6: Joint Marriage Certificate (Vikram Arvindbhai Mehta & Kavita Vikram Mehta)
    p6 = doc.new_page()
    p6.insert_text(
        (50, 70),
        "GOVERNMENT OF GUJARAT\nCertificate of Registration of Marriage\n"
        "This is to Certify that Shri VIKRAM Son of Shri ARVINDBHAI MEHTA residing at AHMEDABAD\n"
        "and KAVITA daughter of Shri MOHANLAL JOSHI residing at AHMEDABAD\n"
        "have furnished the particulars in Memorandum declaring that their marriage has been solemnized on 15/02/2015",
    )

    pdf_bytes = doc.tobytes()
    doc.close()

    resp = client.post(
        "/api/v1/extractor/sort-packet",
        files={"file": ("family_visa_packet.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "success"
    assert res["total_pages_analyzed"] == 6
    assert res["total_persons_detected"] == 2
    assert res["zip_archive_base64"]

    folders_by_name = {f["canonical_name"]: f for f in res["person_folders"]}
    assert "Vikram Arvindbhai Mehta" in folders_by_name
    assert "Kavita Vikram Mehta" in folders_by_name
    # Father's Name ('Mohanlal Joshi') must NEVER be created as a Person Folder
    assert not any("Mohanlal" in k for k in folders_by_name)

    vikram_docs = folders_by_name["Vikram Arvindbhai Mehta"]["documents"]
    kavita_docs = folders_by_name["Kavita Vikram Mehta"]["documents"]

    # Vikram has Passport (P1), 2-page Bank Statement (P2-P3), and Joint Marriage Certificate (P6)
    assert len(vikram_docs) == 3
    assert vikram_docs[1]["page_numbers"] == [2, 3]
    assert vikram_docs[2]["is_joint_document"] is True

    # Kavita has 2-page ITR (P4-P5) and Joint Marriage Certificate (P6)
    assert len(kavita_docs) == 2
    assert kavita_docs[0]["page_numbers"] == [4, 5]
    assert kavita_docs[1]["is_joint_document"] is True






