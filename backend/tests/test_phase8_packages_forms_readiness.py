import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.domain.models import (
    Organization,
    OrganizationMembership,
    Role,
    MembershipRole,
    User,
    ClientProfile,
    ImmigrationCase,
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    CaseRequirementEvaluation,
    DocumentRequest,
    FormSchema,
    FormSchemaVersion,
    FormSubmission,
    PackageTemplate,
    FilingPackage,
    now_utc,
)
from backend.app.forms.service import FormService
from backend.app.packages.readiness import ReadinessService
from backend.app.packages.builder import PackageBuilderService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


def create_mock_user(db: Session, email: str, full_name: str) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password123"),
        status="active",
    )
    db.add(user)
    db.flush()
    return user


def setup_phase8_fixtures(db: Session):
    org = Organization(name="Lex Immigration Global", slug=f"lex-pkg-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    staff_user = create_mock_user(db, f"staff-{uuid.uuid4().hex[:6]}@lex.com", "Sarah Jenkins, Esq.")
    senior_user = create_mock_user(db, f"partner-{uuid.uuid4().hex[:6]}@lex.com", "Elena Vance, Managing Partner")
    client_user = create_mock_user(db, f"client-{uuid.uuid4().hex[:6]}@client.com", "Dr. Elena Rostova")

    # Client Profile
    client_profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Elena",
        last_name="Rostova",
        email=client_user.email,
        nationality="UKR",
        date_of_birth=datetime(1988, 4, 12, tzinfo=timezone.utc),
    )
    db.add(client_profile)
    db.flush()

    # Case
    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-US-{uuid.uuid4().hex[:4].upper()}",
        title="Dr. Elena Rostova - EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="intake",
    )
    db.add(case)
    db.flush()

    # Documents
    doc1 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Elena_Rostova_Passport_Bio.pdf",
        filename="Elena_Rostova_Passport_Bio.pdf",
        category="identity_document",
        storage_path="/storage/Elena_Rostova_Passport_Bio.pdf",
        byte_size=2400000,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    doc2 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Form_G28_Executed.pdf",
        filename="Form_G28_Executed.pdf",
        category="application_forms",
        storage_path="/storage/Form_G28_Executed.pdf",
        byte_size=1100000,
        mime_type="application/pdf",
        sha256_hash="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    doc_internal = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Attorney_Strategy_Assessment_Memo.pdf",
        filename="Attorney_Strategy_Assessment_Memo.pdf",
        category="internal_memo",
        storage_path="/storage/Attorney_Strategy_Assessment_Memo.pdf",
        byte_size=500000,
        mime_type="application/pdf",
        sha256_hash="c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    db.add_all([doc1, doc2, doc_internal])
    db.flush()

    # OCR extracted field
    ocr_field = DocumentExtractedField(
        organization_id=org.id,
        document_id=doc1.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="EP8849201",
        normalized_value="EP8849201",
        validation_status="valid",
        extraction_confidence=0.99,
        created_at=now_utc(),
    )
    db.add(ocr_field)
    db.flush()

    db.commit()

    return {
        "org": org,
        "staff_user": staff_user,
        "senior_user": senior_user,
        "client_user": client_user,
        "client_profile": client_profile,
        "case": case,
        "doc1": doc1,
        "doc2": doc2,
        "doc_internal": doc_internal,
    }


def test_form_schema_listing_and_retrieval(client: TestClient, db: Session):
    """Verifies configurable form schemas, versioning, conditional fields, and validations."""
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value, RoleCode.SENIOR_REVIEWER.value),
    )

    # 1. List schemas
    res = client.get("/api/v1/forms/schemas")
    assert res.status_code == 200
    schemas = res.json()["schemas"]
    assert len(schemas) >= 1
    i140_schema = next((s for s in schemas if s["form_code"] == "USCIS_I140"), None)
    assert i140_schema is not None
    assert i140_schema["jurisdiction"] == "US"
    assert i140_schema["pathway"] == "EB-1A"
    assert len(i140_schema["versions"]) >= 1

    # 2. Get detailed schema
    schema_id = i140_schema["id"]
    res_detail = client.get(f"/api/v1/forms/schemas/{schema_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["active_version"] is not None
    sections = detail["active_version"]["schema_definition"]["sections"]
    assert len(sections) >= 3

    # Verify conditional field presence in Part 1
    part1 = next((sec for sec in sections if sec["id"] == "part1_petitioner"), None)
    assert part1 is not None
    company_field = next((f for f in part1["fields"] if f["key"] == "petitioner_company_name"), None)
    assert company_field is not None
    assert company_field["conditional"]["depends_on_field"] == "petitioner_is_self"


def test_form_draft_population_and_source_provenance(client: TestClient, db: Session):
    """
    Verifies that draft answers are populated only from available, authorized sources,
    every value retains its source provenance, and AI-generated fields remain unconfirmed.
    """
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case_id = fixtures["case"].id
    res = client.post(f"/api/v1/forms/cases/{case_id}/submissions")
    assert res.status_code == 201
    submission = res.json()
    assert submission["status"] == "draft"
    assert submission["completion_percentage"] > 0
    assert submission["has_unconfirmed_ai_fields"] is True  # Proposed endeavor or OCR unconfirmed

    answers = submission["answers"]

    # Verify Client Profile Provenance
    first_name_ans = answers["beneficiary_given_name"]
    assert first_name_ans["value"] == "Elena"
    assert first_name_ans["source_type"] == "client_profile"
    assert str(fixtures["client_profile"].id) in first_name_ans["source_id"]
    assert first_name_ans["is_confirmed"] is True

    # Verify OCR Provenance
    passport_ans = answers["beneficiary_passport_number"]
    assert passport_ans["value"] == "EP8849201"
    assert passport_ans["source_type"] == "document_ocr"
    assert "Elena_Rostova_Passport_Bio.pdf" in passport_ans["source_label"]
    assert passport_ans["is_confirmed"] is False  # Must remain draft until confirmed

    # Verify AI-Generated Draft Provenance
    endeavor_ans = answers["proposed_occupation"]
    assert endeavor_ans["source_type"] == "ai_generated"
    assert endeavor_ans["is_confirmed"] is False


def test_form_answer_updating_and_revision_history(client: TestClient, db: Session):
    """Verifies answer edits update provenance to user_provided and record revision history."""
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case_id = fixtures["case"].id
    res = client.post(f"/api/v1/forms/cases/{case_id}/submissions")
    submission_id = res.json()["id"]

    # Update answers
    update_payload = {
        "answers": {
            "beneficiary_alien_number": "A123456789",
            "soc_code": "15-1221",
        },
        "notes": "Added client Alien number from historical approval notice",
    }
    res_update = client.put(f"/api/v1/forms/submissions/{submission_id}", json=update_payload)
    assert res_update.status_code == 200
    updated = res_update.json()

    assert updated["revision_number"] == 2
    assert len(updated["revision_history"]) >= 2
    assert "Added client Alien number" in updated["revision_history"][-1]["changes_summary"]

    a_num_ans = updated["answers"]["beneficiary_alien_number"]
    assert a_num_ans["value"] == "A123456789"
    assert a_num_ans["source_type"] == "user_provided"
    assert a_num_ans["is_confirmed"] is True


def test_confirm_field_and_sensitive_fields_review(client: TestClient, db: Session):
    """Verifies confirmation of draft fields and designated sensitive-field review rules."""
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    # Staff session
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case_id = fixtures["case"].id
    res = client.post(f"/api/v1/forms/cases/{case_id}/submissions")
    submission_id = res.json()["id"]

    # 1. Confirm the OCR passport field
    res_confirm = client.post(
        f"/api/v1/forms/submissions/{submission_id}/confirm-field",
        json={"field_key": "beneficiary_passport_number"},
    )
    assert res_confirm.status_code == 200
    field_rec = res_confirm.json()["field_record"]
    assert field_rec["is_confirmed"] is True
    assert field_rec["confirmed_by_user_id"] == str(fixtures["staff_user"].id)

    # 2. Sensitive fields review by Staff
    res_review = client.post(
        f"/api/v1/forms/submissions/{submission_id}/review-sensitive",
        json={"notes": "Reviewed and verified zero prior removal or criminal records under 8 CFR § 204.5."},
    )
    assert res_review.status_code == 200
    assert res_review.json()["sensitive_fields_reviewed"] is True
    assert res_review.json()["reviewed_by"] == fixtures["staff_user"].full_name

    # 3. Client is blocked from reviewing sensitive fields
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["client_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["client_user"].email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    res_client_blocked = client.post(
        f"/api/v1/forms/submissions/{submission_id}/review-sensitive",
        json={"notes": "Attempting client self signoff"},
    )
    assert res_client_blocked.status_code == 403


def test_deterministic_readiness_checklist(client: TestClient, db: Session):
    """
    Verifies the deterministic 10-point readiness checklist.
    Verifies that NO probability of government approval is calculated or returned.
    """
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case_id = fixtures["case"].id

    res = client.get(f"/api/v1/packages/cases/{case_id}/readiness")
    assert res.status_code == 200
    data = res.json()

    assert data["case_id"] == str(case_id)
    assert "checklist" in data
    checklist = data["checklist"]

    # Verify all 10 checks are deterministically reported
    assert "applicable_requirements" in checklist
    assert "evidence_received" in checklist
    assert "missing_evidence" in checklist
    assert "unresolved_findings" in checklist
    assert "unverified_extracted_fields" in checklist
    assert "expired_documents" in checklist
    assert "incomplete_forms" in checklist
    assert "outstanding_client_responses" in checklist
    assert "pending_reviewer_decisions" in checklist
    assert "unmet_package_validation_criteria" in checklist

    # Verify strict prohibition on probability of approval
    assert "probability" not in data
    assert "approval_chance" not in data
    assert "prediction" not in data
    assert "Probability of approval is never generated or displayed" in data["compliance_notice"]


def test_package_builder_and_manifest_integrity(client: TestClient, db: Session):
    """
    Verifies folder structure assembly, internal vs submission document segregation,
    manifest SHA-256 calculation, and version locking.
    """
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case_id = fixtures["case"].id

    # Build package
    res = client.post(
        f"/api/v1/packages/cases/{case_id}/build",
        json={"name": "Dr. Rostova EB-1A Formal Submission Package"},
    )
    assert res.status_code == 201
    pkg = res.json()

    assert pkg["version_number"] == "v1.0.0"
    assert pkg["package_hash"] is not None
    assert len(pkg["package_hash"]) == 64  # Valid SHA-256 hex string

    manifest = pkg["manifest"]
    assert manifest["items_count"] >= 3
    assert manifest["internal_items_count"] >= 1  # Internal memo segregated
    assert manifest["external_items_count"] >= 2  # Passport and G-28

    # Verify confidential internal memo is placed in folder 09_Internal_Review
    memo_item = next(
        (i for i in manifest["items"] if i.get("file_name") == "Attorney_Strategy_Assessment_Memo.pdf"),
        None,
    )
    assert memo_item is not None
    assert memo_item["folder_code"] == "09_Internal_Review"
    assert memo_item["is_internal_only"] is True


def test_7_stage_approval_workflow(client: TestClient, db: Session):
    """
    Verifies the sequential 7-stage approval workflow with strict prerequisite validation.
    """
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    case_id = fixtures["case"].id

    # 1. Build package as staff
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    res_build = client.post(
        f"/api/v1/packages/cases/{case_id}/build",
        json={"name": "USCIS Immigrant Filing Package"},
    )
    package_id = res_build.json()["id"]

    # 2. Prerequisite check: cannot skip directly to final approval without senior review
    res_premature = client.post(
        f"/api/v1/packages/{package_id}/approval",
        json={"stage": "final_package_approval", "decision": "approved", "notes": "Premature attempt"},
    )
    assert res_premature.status_code in [400, 403]

    # 3. Staff Review
    res_staff = client.post(
        f"/api/v1/packages/{package_id}/approval",
        json={"stage": "authorized_staff_review", "decision": "approved", "notes": "Paralegal verified all exhibit tabs"},
    )
    assert res_staff.status_code == 200

    # 4. Senior Review by Managing Partner
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["senior_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["senior_user"].email,
        roles=(RoleCode.MASTER_ADMIN.value,),
    )
    res_senior = client.post(
        f"/api/v1/packages/{package_id}/approval",
        json={"stage": "senior_review", "decision": "approved", "notes": "Senior partner statutory review complete"},
    )
    assert res_senior.status_code == 200

    # 5. Client Confirmation
    res_client_conf = client.post(
        f"/api/v1/packages/{package_id}/approval",
        json={"stage": "client_confirmation", "decision": "approved", "notes": "Client verified factual declarations"},
    )
    assert res_client_conf.status_code == 200

    # 6. Final Package Approval
    res_final = client.post(
        f"/api/v1/packages/{package_id}/approval",
        json={"stage": "final_package_approval", "decision": "approved", "notes": "G-28 Signatory formal signoff"},
    )
    assert res_final.status_code == 200
    final_pkg = res_final.json()
    assert final_pkg["status"] == "approved"
    assert final_pkg["approved_by"] == fixtures["senior_user"].full_name
    assert final_pkg["approved_at"] is not None


def test_package_export_and_disclaimed_automated_portal_submission(client: TestClient, db: Session):
    """
    Verifies package export includes manual filing instructions and refuses automated submission.
    """
    fixtures = setup_phase8_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["senior_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["senior_user"].email,
        roles=(RoleCode.MASTER_ADMIN.value,),
    )

    case_id = fixtures["case"].id
    res_build = client.post(f"/api/v1/packages/cases/{case_id}/build", json={"name": "Export Test Package"})
    package_id = res_build.json()["id"]

    res_export = client.get(f"/api/v1/packages/{package_id}/export")
    assert res_export.status_code == 200
    export_data = res_export.json()

    assert export_data["package_id"] == package_id
    assert export_data["submission_method"] == "manual_filing"
    assert "USCIS Lockbox" in export_data["submission_instructions"]
    assert "Automated government portal submission is disabled" in export_data["disclaimer"]
