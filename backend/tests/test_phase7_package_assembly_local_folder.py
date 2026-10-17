import io
import json
import uuid
import zipfile
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.main import app
from backend.app.db.session import get_db
from backend.app.domain.models import (
    Organization,
    OrganizationMembership,
    User,
    ClientProfile,
    ImmigrationCase,
    Document,
    CaseAIFinding,
    FilingPackage,
    PackageTemplate,
    PackageDownloadEvent,
    AuditEvent,
    now_utc,
)
from backend.app.packages.local_archive import (
    sanitize_filename,
    normalize_relative_path,
    disambiguate_relative_path,
    assert_safe_zip_entry,
    build_canonical_phase7_manifest,
    generate_manifest_text_report,
    generate_word_compatible_html_report,
    generate_pdf_manifest_report,
    build_package_local_zip_archive,
    CANADA_LOCAL_FOLDERS,
)
from backend.app.packages.builder import (
    PackageBuilderService,
    DEFAULT_CANADA_FOLDERS,
    DEFAULT_USCIS_FOLDERS,
)
from backend.app.packages.eligibility import PackageEligibilityPolicy, evaluate_document_for_package
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


# --- Fixtures ---

@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


@pytest.fixture
def test_setup(db: Session):
    org = Organization(name="Phase 7 Test Firm", slug=f"p7-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    manager = User(
        email="manager_p7@firm.com",
        full_name="Managing Officer Paralegal",
        password_hash=hash_password("Pass123!"),
        status="active",
    )
    client_user = User(
        email="client_p7@example.com",
        full_name="Applicant Client",
        password_hash=hash_password("Pass123!"),
        status="active",
    )
    db.add_all([manager, client_user])
    db.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=manager.id,
        status="active",
    )
    db.add(membership)
    db.flush()

    profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Amina",
        last_name="Chen",
        email=client_user.email,
        nationality="CAN",
    )
    db.add(profile)
    db.flush()

    case_ca = ImmigrationCase(
        organization_id=org.id,
        client_id=profile.id,
        case_number="CASE-CA-2026-001",
        title="Canada Express Entry Federal Skilled Worker",
        jurisdiction="CA",
        visa_category="Express Entry",
        status="active",
        post_download_retention_policy="seven_days",
    )
    case_us = ImmigrationCase(
        organization_id=org.id,
        client_id=profile.id,
        case_number="CASE-US-2026-002",
        title="US Alien of Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="active",
        post_download_retention_policy="immediate",
    )
    db.add_all([case_ca, case_us])
    db.flush()

    return {
        "org": org,
        "manager": manager,
        "client": client_user,
        "profile": profile,
        "case_ca": case_ca,
        "case_us": case_us,
    }


# --- Unit Tests: Local Archive Security & Determinism ---

def test_safe_filename_sanitization():
    # Path traversal & illegal chars
    assert sanitize_filename("../../../secret.pdf") == "secret.pdf"
    assert sanitize_filename("folder/sub/doc:test*?.pdf") == "doc_test__.pdf"
    assert sanitize_filename("doc\x00with\x1fnull.pdf") == "docwithnull.pdf"
    # Windows reserved device names
    assert sanitize_filename("CON.pdf") == "FILE_CON.pdf"
    assert sanitize_filename("nul.txt") == "FILE_nul.txt"
    assert sanitize_filename("com1.pdf") == "FILE_com1.pdf"
    assert sanitize_filename("lpt2.dat") == "FILE_lpt2.dat"
    # Clean fallback
    assert sanitize_filename("") == "document.pdf"
    assert sanitize_filename("...") == "document.pdf"


def test_normalized_relative_path_traversal_rejection():
    # Clean paths
    assert normalize_relative_path("01_Identity", "Principal", "Passport.pdf") == "01_Identity/Principal/Passport.pdf"
    assert normalize_relative_path("DOCUMENTS\\SubFolder", "File.pdf") == "DOCUMENTS/SubFolder/File.pdf"

    # Traversal attempts must raise ValueError
    with pytest.raises(ValueError, match="Path traversal segment '..' is strictly forbidden"):
        normalize_relative_path("..", "etc", "passwd")

    with pytest.raises(ValueError, match="Path traversal segment '..' is strictly forbidden"):
        normalize_relative_path("01_Identity", "../secret.pdf")


def test_disambiguate_relative_path_collision_handling():
    allocated = set()
    first = disambiguate_relative_path("02_Documents/Passport.pdf", allocated, version=1)
    assert first == "02_Documents/Passport.pdf"
    assert "02_Documents/Passport.pdf" in allocated

    # Duplicate: next version
    second = disambiguate_relative_path("02_Documents/Passport.pdf", allocated, version=2)
    assert second == "02_Documents/Passport_v2.pdf"
    assert "02_Documents/Passport_v2.pdf" in allocated

    # Duplicate again: sequential fallback
    third = disambiguate_relative_path("02_Documents/Passport.pdf", allocated, version=2)
    assert third == "02_Documents/Passport_2.pdf"
    assert "02_Documents/Passport_2.pdf" in allocated


def test_zip_slip_protection():
    # Valid entries
    assert_safe_zip_entry("01_Identity/Passport.pdf")
    assert_safe_zip_entry("manifest.json")

    # Invalid: absolute paths
    with pytest.raises(ValueError, match="Zip slip protection: Absolute paths forbidden"):
        assert_safe_zip_entry("/etc/passwd")

    with pytest.raises(ValueError, match="Zip slip protection: Absolute paths forbidden"):
        assert_safe_zip_entry("\\Windows\\System32\\calc.exe")

    # Invalid: path traversal
    with pytest.raises(ValueError, match="Zip slip protection: Path traversal '..' forbidden"):
        assert_safe_zip_entry("../evil.sh")

    with pytest.raises(ValueError, match="Zip slip protection: Path traversal '..' forbidden"):
        assert_safe_zip_entry("01_Identity/../../evil.sh")


def test_canonical_phase7_manifest_schema_and_determinism():
    inc_docs = [
        {
            "document_id": "doc-uuid-1",
            "version": 1,
            "relative_path": "02_Documents/Passport.pdf",
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "review_status": "HUMAN_VERIFIED",
        },
        {
            "document_id": "doc-uuid-2",
            "version": 2,
            "relative_path": "01_Cic_Correspondence/ITA_Letter.pdf",
            "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
            "review_status": "HUMAN_VERIFIED",
        },
    ]
    exc_docs = [
        {
            "document_id": "doc-uuid-99",
            "version": 1,
            "reason_code": "UNRESOLVED_ANOMALY",
        }
    ]

    manifest = build_canonical_phase7_manifest(
        case_reference="CASE-CA-2026-001",
        generated_by="user-officer-01",
        package_template_version="v1.0.0",
        checklist_rule_version="IRCC-EE-2026.1",
        included_documents=inc_docs,
        excluded_documents=exc_docs,
        generated_at="2026-10-17T12:00:00Z",
    )

    # Validate exact top-level keys
    assert manifest["case_reference"] == "CASE-CA-2026-001"
    assert manifest["generated_at"] == "2026-10-17T12:00:00Z"
    assert manifest["generated_by"] == "user-officer-01"
    assert manifest["package_template_version"] == "v1.0.0"
    assert manifest["checklist_rule_version"] == "IRCC-EE-2026.1"
    assert isinstance(manifest["documents"], list)
    assert isinstance(manifest["exclusions"], list)

    # Validate document items
    doc1 = manifest["documents"][0]
    assert "document_version_id" in doc1
    assert "relative_path" in doc1
    assert "sha256" in doc1
    assert doc1["review_status"] == "HUMAN_VERIFIED"

    # Deterministic sort order (01_Cic_Correspondence before 02_Documents)
    assert manifest["documents"][0]["relative_path"] == "01_Cic_Correspondence/ITA_Letter.pdf"
    assert manifest["documents"][1]["relative_path"] == "02_Documents/Passport.pdf"

    # Validate exclusions
    exc1 = manifest["exclusions"][0]
    assert exc1["document_version_id"] == "doc-uuid-99:v1"
    assert exc1["reason_code"] == "UNRESOLVED_ANOMALY"


# --- Unit Tests: Report Generation (TXT, Word, PDF) ---

def test_manifest_report_generation_all_formats():
    manifest = {
        "case_reference": "CASE-CA-2026-001",
        "generated_at": "2026-10-17T12:00:00Z",
        "generated_by": "officer-42",
        "package_template_version": "v1.0.0",
        "checklist_rule_version": "IRCC-EE-2026.1",
        "documents": [
            {
                "document_version_id": "doc-1:v1",
                "relative_path": "02_Documents/Passport.pdf",
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "review_status": "HUMAN_VERIFIED",
            }
        ],
        "exclusions": [
            {
                "document_version_id": "doc-2:v1",
                "reason_code": "UNRESOLVED_ANOMALY",
            }
        ],
    }

    # 1. Text Report
    txt_report = generate_manifest_text_report(manifest, "Express Entry Application", "CA", "Interim Hold Dossier")
    assert "CASE-CA-2026-001" in txt_report
    assert "02_Documents/Passport.pdf" in txt_report
    assert "UNRESOLVED_ANOMALY" in txt_report
    assert "Package generation is an internal assembly workflow; it DOES NOT imply government submission" in txt_report

    # 2. Word-Compatible HTML Report
    word_bytes = generate_word_compatible_html_report(manifest, "Express Entry Application", "CA", "Interim Hold Dossier")
    assert isinstance(word_bytes, bytes)
    word_text = word_bytes.decode("utf-8")
    assert "CASE-CA-2026-001" in word_text
    assert "xmlns:w='urn:schemas-microsoft-com:office:word'" in word_text
    assert "UNRESOLVED_ANOMALY" in word_text

    # 3. PDF Report (PyMuPDF)
    pdf_bytes = generate_pdf_manifest_report(manifest, "Express Entry Application", "CA", "Interim Hold Dossier")
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    # PDF magic bytes
    assert pdf_bytes.startswith(b"%PDF-")


# --- Unit Tests: In-Memory ZIP Assembly ---

def test_build_package_local_zip_archive_structure():
    folder_structure = [
        {"folder_code": "01_Cic_Correspondence", "folder_name": "CIC CORRESPONDENCE"},
        {"folder_code": "02_Documents", "folder_name": "DOCUMENTS"},
        {"folder_code": "03_Forms", "folder_name": "FORMS"},
        {"folder_code": "04_Extra", "folder_name": "EXTRA"},
        {"folder_code": "05_Upload", "folder_name": "UPLOAD"},
    ]
    docs = [
        {
            "document_id": "doc-1",
            "version": 1,
            "file_name": "Passport.pdf",
            "folder_code": "02_Documents",
            "review_status": "HUMAN_VERIFIED",
            "binary_content": b"%PDF-1.4 Mock Passport Content",
        },
        {
            "document_id": "doc-2",
            "version": 1,
            "file_name": "ITA_Letter.pdf",
            "folder_code": "01_Cic_Correspondence",
            "review_status": "HUMAN_VERIFIED",
            "binary_content": b"%PDF-1.4 Mock ITA Letter",
        },
    ]
    exclusions = [
        {
            "document_id": "doc-blocked",
            "version": 1,
            "reason_code": "UNRESOLVED_ANOMALY",
        }
    ]

    zip_bytes, manifest = build_package_local_zip_archive(
        case_reference="CASE-CA-2026-001",
        package_name="Canada Economic Submission",
        package_template_version="v1.0.0",
        checklist_rule_version="IRCC-EE-2026.1",
        folder_structure=folder_structure,
        document_entries=docs,
        excluded_entries=exclusions,
        generated_by="officer-99",
    )

    # Inspect zip contents
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        namelist = zf.namelist()
        # Verify firm-configured folders
        assert "CIC CORRESPONDENCE/" in namelist
        assert "DOCUMENTS/" in namelist
        assert "FORMS/" in namelist
        assert "EXTRA/" in namelist
        assert "UPLOAD/" in namelist

        # Verify files in correct folders
        assert "DOCUMENTS/Passport.pdf" in namelist
        assert "CIC CORRESPONDENCE/ITA_Letter.pdf" in namelist

        # Verify root reports
        assert "manifest.json" in namelist
        assert "manifest.txt" in namelist
        assert "ocr_and_anomaly_report.txt" in namelist

        # Verify manifest.json matches exact Phase 7 schema
        manifest_data = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest_data["case_reference"] == "CASE-CA-2026-001"
        assert len(manifest_data["documents"]) == 2
        assert len(manifest_data["exclusions"]) == 1
        assert manifest_data["exclusions"][0]["reason_code"] == "UNRESOLVED_ANOMALY"


# --- Integration Tests: API Endpoints & Blocker Enforcement ---

def test_phase7_package_assembly_canada_folders_and_non_us_isolation(test_setup, db: Session):
    org = test_setup["org"]
    case_ca = test_setup["case_ca"]
    profile = test_setup["profile"]
    manager = test_setup["manager"]

    # Add eligible document to Canada case
    doc_pass = Document(
        organization_id=org.id,
        case_id=case_ca.id,
        client_id=profile.id,
        title="Valid Canadian Passport",
        filename="Passport_Scan.pdf",
        category="passport",
        storage_path="/storage/pass.pdf",
        byte_size=1024,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
    )
    # Add candidate document with unresolved anomaly
    doc_bad = Document(
        organization_id=org.id,
        case_id=case_ca.id,
        client_id=profile.id,
        title="Forged Employment Record",
        filename="Suspicious_Letter.pdf",
        category="employment_record",
        storage_path="/storage/bad.pdf",
        byte_size=2048,
        mime_type="application/pdf",
        sha256_hash="4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
        verification_status="unverified",
        processing_status="completed",
        malware_scan_status="clean",
        has_unresolved_anomaly=True,
    )
    db.add_all([doc_pass, doc_bad])
    db.flush()

    # Create unresolved AI anomaly finding on doc_bad
    finding = CaseAIFinding(
        organization_id=org.id,
        case_id=case_ca.id,
        document_id=doc_bad.id,
        finding_type="document_quality",
        severity="critical",
        status="needs_review",  # UNRESOLVED ANOMALY!
        title="Unresolved Anomaly: Potential Document Tampering",
        description="OCR discrepancy and layout irregularities detected.",
        recommended_action="Reject until physical review",
        uncertainty_limitations="High probability of alteration",
    )
    db.add(finding)
    db.commit()

    # 1. Build Package for Canada case
    package = PackageBuilderService.build_filing_package(
        db=db,
        organization_id=org.id,
        case_id=case_ca.id,
        name="Canada FSW Filing Package",
        user_id=manager.id,
    )

    # Invariant: Package generation NEVER sets case status to submitted
    assert case_ca.status != "submitted"

    # Invariant: Canada template folders are present
    folders = package.manifest_json.get("folders", [])
    folder_names = [f["folder_name"] for f in folders]
    assert "CIC CORRESPONDENCE" in folder_names
    assert "DOCUMENTS" in folder_names
    assert "FORMS" in folder_names
    assert "EXTRA" in folder_names
    assert "UPLOAD" in folder_names

    # Invariant: Bad document is EXCLUDED due to unresolved anomaly
    excluded = package.manifest_json.get("excluded_items", [])
    assert any(str(e.get("document_id")) == str(doc_bad.id) for e in excluded)

    # Invariant: Canonical Phase 7 manifest attached
    phase7_manifest = package.manifest_json.get("phase7_manifest")
    assert phase7_manifest is not None
    assert phase7_manifest["case_reference"] == case_ca.case_number
    assert len(phase7_manifest["documents"]) == 1
    assert phase7_manifest["documents"][0]["relative_path"].startswith("DOCUMENTS/")
    assert len(phase7_manifest["exclusions"]) == 1
    assert phase7_manifest["exclusions"][0]["reason_code"] == "UNRESOLVED_ANOMALY"


def test_officer_cannot_include_document_with_unresolved_anomaly(test_setup, db: Session, client: TestClient):
    org = test_setup["org"]
    case_ca = test_setup["case_ca"]
    profile = test_setup["profile"]
    manager = test_setup["manager"]

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=manager.id,
        organization_id=org.id,
        email=manager.email,
        roles=(RoleCode.CASE_MANAGER.value, RoleCode.SENIOR_REVIEWER.value),
    )

    doc_bad = Document(
        organization_id=org.id,
        case_id=case_ca.id,
        client_id=profile.id,
        title="Altered Degree Certificate",
        filename="Degree_Fraud.pdf",
        category="educational_credential",
        storage_path="/storage/fraud.pdf",
        byte_size=2048,
        mime_type="application/pdf",
        sha256_hash="c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4",
        verification_status="unverified",
        processing_status="completed",
        malware_scan_status="clean",
        has_unresolved_anomaly=True,
    )
    db.add(doc_bad)
    db.flush()

    finding = CaseAIFinding(
        organization_id=org.id,
        case_id=case_ca.id,
        document_id=doc_bad.id,
        finding_type="document_quality",
        severity="critical",
        status="needs_review",  # UNRESOLVED
        title="Unresolved Anomaly in Degree Seal",
        description="Font mismatch and pixel distortion.",
        recommended_action="Verification required",
        uncertainty_limitations="High risk of falsification",
    )
    db.add(finding)
    db.commit()

    package = PackageBuilderService.build_filing_package(
        db=db,
        organization_id=org.id,
        case_id=case_ca.id,
        name="Interim Package",
        user_id=manager.id,
    )

    # Attempt to include document with unresolved anomaly -> MUST BE REJECTED
    resp = client.post(
        f"/api/v1/packages/{package.id}/documents/{doc_bad.id}/include",
    )
    assert resp.status_code in (400, 422)
    assert "Unresolved anomaly or blocker present" in resp.json()["detail"]

    # Verify no unresolved anomaly was included in package
    db.refresh(package)
    manifest_items = package.manifest_json.get("items", [])
    assert not any(str(i.get("document_id")) == str(doc_bad.id) for i in manifest_items)


def test_officer_can_include_and_exclude_eligible_document_with_audit_trail(test_setup, db: Session, client: TestClient):
    org = test_setup["org"]
    case_ca = test_setup["case_ca"]
    profile = test_setup["profile"]
    manager = test_setup["manager"]

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=manager.id,
        organization_id=org.id,
        email=manager.email,
        roles=(RoleCode.CASE_MANAGER.value, RoleCode.SENIOR_REVIEWER.value),
    )

    doc_valid = Document(
        organization_id=org.id,
        case_id=case_ca.id,
        client_id=profile.id,
        title="Additional Bank Statement",
        filename="Bank_Stmt_Oct.pdf",
        category="bank_statement",
        storage_path="/storage/bank.pdf",
        byte_size=1024,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
    )
    db.add(doc_valid)
    db.commit()

    package = PackageBuilderService.build_filing_package(
        db=db,
        organization_id=org.id,
        case_id=case_ca.id,
        name="Bank Package",
        user_id=manager.id,
    )

    # Exclude the document
    resp_exclude = client.post(
        f"/api/v1/packages/{package.id}/documents/{doc_valid.id}/exclude",
        json={"reason_code": "OFFICER_REDUNDANT_EVIDENCE", "notes": "Older bank statement superseded"},
    )
    assert resp_exclude.status_code == 200
    assert resp_exclude.json()["success"] is True

    # Verify audit event logged
    audit_exclude = db.execute(
        select(AuditEvent).where(
            AuditEvent.action == "filing_package.document_excluded",
            AuditEvent.object_id == str(package.id),
        )
    ).scalar_one_or_none()
    assert audit_exclude is not None
    assert audit_exclude.metadata_json["reason_code"] == "OFFICER_REDUNDANT_EVIDENCE"

    # Now include it back
    resp_include = client.post(
        f"/api/v1/packages/{package.id}/documents/{doc_valid.id}/include",
    )
    assert resp_include.status_code == 200
    assert resp_include.json()["success"] is True

    # Verify audit event logged
    audit_include = db.execute(
        select(AuditEvent).where(
            AuditEvent.action == "filing_package.document_included",
            AuditEvent.object_id == str(package.id),
        )
    ).scalar_one_or_none()
    assert audit_include is not None


def test_download_zip_endpoint_and_reports(test_setup, db: Session, client: TestClient):
    org = test_setup["org"]
    case_ca = test_setup["case_ca"]
    profile = test_setup["profile"]
    manager = test_setup["manager"]

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=manager.id,
        organization_id=org.id,
        email=manager.email,
        roles=(RoleCode.CASE_MANAGER.value, RoleCode.SENIOR_REVIEWER.value),
    )

    doc_pass = Document(
        organization_id=org.id,
        case_id=case_ca.id,
        client_id=profile.id,
        title="Valid Canadian Passport",
        filename="Passport.pdf",
        category="passport",
        storage_path="/storage/pass.pdf",
        byte_size=1024,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
    )
    db.add(doc_pass)
    db.commit()

    package = PackageBuilderService.build_filing_package(
        db=db,
        organization_id=org.id,
        case_id=case_ca.id,
        name="Downloadable Filing Package",
        user_id=manager.id,
    )

    # 1. Test canonical manifest endpoint
    manifest_resp = client.get(f"/api/v1/packages/{package.id}/manifest")
    assert manifest_resp.status_code == 200
    manifest_body = manifest_resp.json()
    assert manifest_body["case_reference"] == case_ca.case_number
    assert "package_template_version" in manifest_body
    assert "checklist_rule_version" in manifest_body
    assert isinstance(manifest_body["documents"], list)

    # 2. Test ZIP download endpoint
    zip_resp = client.get(f"/api/v1/packages/{package.id}/download-zip")
    assert zip_resp.status_code == 200
    assert zip_resp.headers["content-type"] == "application/zip"
    assert "attachment; filename=" in zip_resp.headers["content-disposition"]

    # Verify ZIP structure
    with zipfile.ZipFile(io.BytesIO(zip_resp.content), "r") as zf:
        names = zf.namelist()
        assert "manifest.json" in names
        assert "manifest.txt" in names
        assert "ocr_and_anomaly_report.txt" in names
        assert "DOCUMENTS/" in names

    # 3. Test multi-format report endpoints (txt, docx, pdf)
    txt_resp = client.get(f"/api/v1/packages/{package.id}/report?format=txt")
    assert txt_resp.status_code == 200
    assert "text/plain" in txt_resp.headers["content-type"]
    assert case_ca.case_number in txt_resp.text

    docx_resp = client.get(f"/api/v1/packages/{package.id}/report?format=docx")
    assert docx_resp.status_code == 200
    assert "wordprocessingml" in docx_resp.headers["content-type"]

    pdf_resp = client.get(f"/api/v1/packages/{package.id}/report?format=pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF-")

    # 4. Test interim report endpoint for hold/reassignment
    interim_resp = client.get(f"/api/v1/packages/cases/{case_ca.id}/interim-report?format=pdf")
    assert interim_resp.status_code == 200
    assert interim_resp.content.startswith(b"%PDF-")


def test_failed_download_never_deletes_records(test_setup, db: Session, client: TestClient):
    org = test_setup["org"]
    case_us = test_setup["case_us"]
    profile = test_setup["profile"]
    manager = test_setup["manager"]

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=manager.id,
        organization_id=org.id,
        email=manager.email,
        roles=(RoleCode.CASE_MANAGER.value, RoleCode.SENIOR_REVIEWER.value),
    )

    doc = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=profile.id,
        title="US Passport",
        filename="US_Passport.pdf",
        category="passport",
        storage_path="/storage/us_pass.pdf",
        byte_size=1024,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
    )
    db.add(doc)
    db.commit()

    package = PackageBuilderService.build_filing_package(
        db=db,
        organization_id=org.id,
        case_id=case_us.id,
        name="US Permanent Package",
        user_id=manager.id,
    )

    # Simulate download
    resp = client.get(f"/api/v1/packages/{package.id}/download-zip")
    assert resp.status_code == 200

    # Even if download fails or is incomplete, records must NEVER be deleted
    pkg_check = db.execute(select(FilingPackage).where(FilingPackage.id == package.id)).scalar_one_or_none()
    assert pkg_check is not None
    doc_check = db.execute(select(Document).where(Document.id == doc.id)).scalar_one_or_none()
    assert doc_check is not None
    case_check = db.execute(select(ImmigrationCase).where(ImmigrationCase.id == case_us.id)).scalar_one_or_none()
    assert case_check is not None
