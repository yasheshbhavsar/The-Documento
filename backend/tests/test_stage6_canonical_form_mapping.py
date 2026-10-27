import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    FormSchema,
    FormSchemaVersion,
    FormSubmission,
    now_utc,
)
from backend.app.forms.service import FormService, USCIS_I140_SCHEMA
from backend.app.forms.schemas_catalog import (
    DOS_DS160_SCHEMA,
    IRCC_IMM5257_SCHEMA,
    IRCC_IMM1294_SCHEMA,
    IRCC_IMM5710_SCHEMA,
)
from backend.app.packages.readiness import ReadinessService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


def create_user(db: Session, email: str, full_name: str) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password123"),
        status="active",
    )
    db.add(user)
    db.flush()
    return user


def setup_stage6_fixtures(db: Session):
    org = Organization(name="Lex Immigratio Global", slug=f"lex-s6-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    counsel_user = create_user(db, f"counsel-{uuid.uuid4().hex[:6]}@lex.com", "Jonathan Harker, Esq.")
    client_user = create_user(db, f"client-{uuid.uuid4().hex[:6]}@client.com", "Dr. Mina Murray")

    client_profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Mina",
        last_name="Murray",
        email=client_user.email,
        phone="+1-555-019-2834",
        nationality="GBR",
        pan_number="ABCDE1234F",
        date_of_birth=datetime(1991, 7, 24, tzinfo=timezone.utc),
    )
    db.add(client_profile)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-US-{uuid.uuid4().hex[:4].upper()}",
        title="Dr. Mina Murray - EB-1A Extraordinary Ability AI Research",
        jurisdiction="US",
        visa_category="EB-1A",
        status="active",
        operational_state="ACTIVE",
        payment_clearance_status="CLEARED",
        preparation_status="IN_PROGRESS",
    )
    db.add(case)
    db.flush()

    db.commit()

    return {
        "org": org,
        "counsel": counsel_user,
        "client_user": client_user,
        "client_profile": client_profile,
        "case": case,
    }


def test_stage6_canonical_schemas_seeding_and_catalog(client: TestClient, db: Session):
    """
    Test 1: Verifies statutory form schemas catalog across jurisdictions:
    - USCIS Form I-140 (US, Immigrant Petition)
    - DOS Form DS-160 (US, Nonimmigrant Visa)
    - IRCC Form IMM 5257 (CA, Visitor Visa)
    - IRCC Form IMM 1294 (CA, Study Permit)
    - IRCC Form IMM 5710 (CA, Work Permit / SOWP)
    Confirms versioning, active status, conditional logic, and regex validation rules.
    """
    fixtures = setup_stage6_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["counsel"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["counsel"].email,
        roles=(RoleCode.CASE_MANAGER.value, RoleCode.SENIOR_REVIEWER.value),
    )

    # 1. List all schemas
    res = client.get("/api/v1/forms/schemas")
    assert res.status_code == 200
    schemas = res.json()["schemas"]

    form_codes = {s["form_code"] for s in schemas}
    assert "USCIS_I140" in form_codes
    assert "DOS_DS160" in form_codes
    assert "IRCC_IMM5257" in form_codes
    assert "IRCC_IMM1294" in form_codes
    assert "IRCC_IMM5710" in form_codes

    # 2. Check US jurisdiction filter
    res_us = client.get("/api/v1/forms/schemas?jurisdiction=US")
    assert res_us.status_code == 200
    us_codes = {s["form_code"] for s in res_us.json()["schemas"]}
    assert "USCIS_I140" in us_codes
    assert "DOS_DS160" in us_codes
    assert "IRCC_IMM5257" not in us_codes

    # 3. Check CA jurisdiction filter
    res_ca = client.get("/api/v1/forms/schemas?jurisdiction=CA")
    assert res_ca.status_code == 200
    ca_codes = {s["form_code"] for s in res_ca.json()["schemas"]}
    assert "IRCC_IMM5257" in ca_codes
    assert "IRCC_IMM1294" in ca_codes
    assert "IRCC_IMM5710" in ca_codes
    assert "USCIS_I140" not in ca_codes

    # 4. Check detailed schema structure for DS-160
    ds160_schema = next(s for s in schemas if s["form_code"] == "DOS_DS160")
    res_detail = client.get(f"/api/v1/forms/schemas/{ds160_schema['id']}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["active_version"]["version_number"] == "v2026.1"
    sections = detail["active_version"]["schema_definition"]["sections"]
    assert len(sections) >= 3

    # Verify passport number regex in DS-160
    sec1 = next(s for s in sections if s["id"] == "ds160_part1_personal")
    p_field = next(f for f in sec1["fields"] if f["key"] == "passport_number")
    assert p_field["source_mapping_hint"] == "doc.ocr.passport_number"
    assert "regex" in p_field["validation_rules"]


def test_stage6_form_evidence_provenance_and_calibration(client: TestClient, db: Session):
    """
    Test 2: Verifies physical source provenance tracking and human confirmation calibration:
    - Mapped values trace to source_document_id, source_page, and extraction_confidence.
    - AI-generated endeavor statement and OCR extracted fields strictly retain is_confirmed = False.
    - Verified client profile records are mapped with is_confirmed = True.
    """
    fixtures = setup_stage6_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["counsel"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["counsel"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case = fixtures["case"]
    org = fixtures["org"]
    client_profile = fixtures["client_profile"]

    # Upload single verified primary passport document
    passport_doc = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Mina_Murray_UK_Passport_Bio.pdf",
        filename="Mina_Murray_UK_Passport_Bio.pdf",
        category="identity_document",
        storage_path="documents/Mina_Murray_UK_Passport_Bio.pdf",
        byte_size=1850000,
        mime_type="application/pdf",
        sha256_hash="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    db.add(passport_doc)
    db.flush()

    extracted_passport = DocumentExtractedField(
        organization_id=org.id,
        document_id=passport_doc.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="987654321GBR",
        normalized_value="987654321",
        source_page=2,
        source_location={"page": 2, "box": [120, 350, 400, 380]},
        extraction_method="icao_mrz_engine",
        extraction_confidence=0.99,
        validation_status="verified",
        created_at=now_utc(),
    )
    db.add(extracted_passport)
    db.commit()

    # Draft I-140 Form
    res = client.post(f"/api/v1/forms/cases/{case.id}/submissions")
    assert res.status_code == 201
    submission = res.json()

    assert submission["status"] == "draft"
    assert submission["has_unconfirmed_ai_fields"] is True  # OCR and endeavor unconfirmed

    answers = submission["answers"]

    # 1. Profile Provenance
    given_name_ans = answers["beneficiary_given_name"]
    assert given_name_ans["value"] == "Mina"
    assert given_name_ans["source_type"] == "client_profile"
    assert given_name_ans["is_confirmed"] is True

    # 2. Document OCR Provenance with Physical Page & Confidence
    passport_ans = answers["beneficiary_passport_number"]
    assert passport_ans["value"] == "987654321"
    assert passport_ans["source_type"] == "document_ocr"
    assert passport_ans["source_document_id"] == str(passport_doc.id)
    assert passport_ans["source_page"] == 2
    assert passport_ans["extraction_confidence"] == 0.99
    assert passport_ans["has_conflict"] is False
    assert passport_ans["is_confirmed"] is False  # Strict human confirmation gate!

    # 3. AI-Generated Synthesis Provenance
    endeavor_ans = answers["proposed_occupation"]
    assert endeavor_ans["source_type"] == "ai_generated"
    assert endeavor_ans["is_confirmed"] is False


def test_stage6_multi_document_conflict_detection_and_finding(client: TestClient, db: Session):
    """
    Test 3: Verifies multi-document conflict detection (§4.4, §4.7):
    - When two uploaded documents extract disparate passport numbers, the system
      NEVER guesses or silently picks one.
    - It sets has_conflict = True, leaves value as None, records candidate provenance,
      and automatically logs a form_conflict CaseAIFinding.
    - Confirming the field without resolution is rejected.
    """
    fixtures = setup_stage6_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["counsel"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["counsel"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case = fixtures["case"]
    org = fixtures["org"]
    client_profile = fixtures["client_profile"]

    # Document 1: Primary UK Passport
    doc1 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Passport_Old_2020.pdf",
        filename="Passport_Old_2020.pdf",
        category="identity_document",
        storage_path="documents/Passport_Old_2020.pdf",
        byte_size=1200000,
        mime_type="application/pdf",
        sha256_hash="1111111111111111111111111111111111111111111111111111111111111111",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    # Document 2: Renewal UK Passport with differing number
    doc2 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Passport_Renewal_2025.pdf",
        filename="Passport_Renewal_2025.pdf",
        category="identity_document",
        storage_path="documents/Passport_Renewal_2025.pdf",
        byte_size=1300000,
        mime_type="application/pdf",
        sha256_hash="2222222222222222222222222222222222222222222222222222222222222222",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    db.add_all([doc1, doc2])
    db.flush()

    f1 = DocumentExtractedField(
        organization_id=org.id,
        document_id=doc1.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="OLD123456",
        normalized_value="OLD123456",
        source_page=1,
        validation_status="verified",
        extraction_confidence=0.98,
        created_at=now_utc(),
    )
    f2 = DocumentExtractedField(
        organization_id=org.id,
        document_id=doc2.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="NEW987654",
        normalized_value="NEW987654",
        source_page=1,
        validation_status="verified",
        extraction_confidence=0.99,
        created_at=now_utc(),
    )
    db.add_all([f1, f2])
    db.commit()

    # Draft form
    res = client.post(f"/api/v1/forms/cases/{case.id}/submissions")
    assert res.status_code == 201
    submission = res.json()
    submission_id = submission["id"]

    passport_ans = submission["answers"]["beneficiary_passport_number"]

    # Verify anti-hallucination abstention
    assert passport_ans["has_conflict"] is True
    assert passport_ans["value"] is None  # System refused to guess!
    assert passport_ans["is_confirmed"] is False
    assert len(passport_ans["conflicting_candidates"]) == 2
    assert "Disparate values extracted" in passport_ans["conflict_reason"]

    # Verify CaseAIFinding logged in database
    conflict_findings = db.execute(
        select(CaseAIFinding).where(
            CaseAIFinding.case_id == case.id,
            CaseAIFinding.finding_type == "form_conflict",
            CaseAIFinding.status == "needs_review",
        )
    ).scalars().all()
    assert len(conflict_findings) >= 1
    cf = conflict_findings[0]
    assert cf.is_confirmed_contradiction is True
    assert cf.severity == "critical"
    assert "beneficiary_passport_number" in cf.related_fields
    assert len(cf.related_documents) == 2

    # Attempt to confirm conflicted field without resolution must fail
    res_confirm = client.post(
        f"/api/v1/forms/submissions/{submission_id}/confirm-field",
        json={"field_key": "beneficiary_passport_number"},
    )
    assert res_confirm.status_code == 400
    assert "unresolved document conflicts" in res_confirm.json()["detail"]


def test_stage6_validation_attorney_override_and_conflict_resolution(client: TestClient, db: Session):
    """
    Test 4: Verifies schema format regex validation, attorney override, and automatic conflict resolution:
    - Malformed values fail schema regex validation with 400.
    - Valid attorney override resolves conflict, tags source as user_provided with attribution.
    - Linked CaseAIFinding is automatically updated to resolved.
    - Complete revision history is maintained with legal rationale.
    """
    fixtures = setup_stage6_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["counsel"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["counsel"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case = fixtures["case"]
    org = fixtures["org"]
    client_profile = fixtures["client_profile"]

    # Conflicting passports setup
    doc1 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="DocA.pdf",
        filename="DocA.pdf",
        category="identity_document",
        storage_path="documents/DocA.pdf",
        byte_size=1000,
        mime_type="application/pdf",
        sha256_hash="3333333333333333333333333333333333333333333333333333333333333333",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    doc2 = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="DocB.pdf",
        filename="DocB.pdf",
        category="identity_document",
        storage_path="documents/DocB.pdf",
        byte_size=1000,
        mime_type="application/pdf",
        sha256_hash="4444444444444444444444444444444444444444444444444444444444444444",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    db.add_all([doc1, doc2])
    db.flush()

    db.add(DocumentExtractedField(
        organization_id=org.id,
        document_id=doc1.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="NUM111",
        normalized_value="NUM111",
        source_page=1,
        validation_status="verified",
        created_at=now_utc(),
    ))
    db.add(DocumentExtractedField(
        organization_id=org.id,
        document_id=doc2.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="NUM222",
        normalized_value="NUM222",
        source_page=1,
        validation_status="verified",
        created_at=now_utc(),
    ))
    db.commit()

    # Draft form
    res = client.post(f"/api/v1/forms/cases/{case.id}/submissions")
    submission_id = res.json()["id"]

    # 1. Invalid regex check (malformed email)
    res_invalid_email = client.put(
        f"/api/v1/forms/submissions/{submission_id}",
        json={"answers": {"petitioner_email": "not-an-email"}},
    )
    assert res_invalid_email.status_code == 400
    assert "failed format validation" in res_invalid_email.json()["detail"]

    # 2. Invalid date format check
    res_invalid_date = client.put(
        f"/api/v1/forms/submissions/{submission_id}",
        json={"answers": {"beneficiary_dob": "24/07/1991"}},
    )
    assert res_invalid_date.status_code == 400
    assert "YYYY-MM-DD" in res_invalid_date.json()["detail"]

    # 3. Attorney valid override of conflicted passport number
    override_notes = "Verified DocB is current renewal passport valid through 2035; DocA was cancelled upon issuance."
    res_override = client.put(
        f"/api/v1/forms/submissions/{submission_id}",
        json={
            "answers": {
                "beneficiary_passport_number": "NUM222",
                "soc_code": "15-1221",
            },
            "notes": override_notes,
        },
    )
    assert res_override.status_code == 200
    updated = res_override.json()

    # Verify answers updated
    p_ans = updated["answers"]["beneficiary_passport_number"]
    assert p_ans["value"] == "NUM222"
    assert p_ans["has_conflict"] is False
    assert p_ans["is_confirmed"] is True
    assert p_ans["source_type"] == "user_provided"
    assert "Jonathan Harker" in p_ans["source_label"]

    # Verify revision history
    assert updated["revision_number"] == 2
    latest_rev = updated["revision_history"][-1]
    assert latest_rev["revision"] == 2
    assert latest_rev["updated_by"] == fixtures["counsel"].full_name
    assert override_notes in latest_rev["changes_summary"]

    # Verify CaseAIFinding auto-resolved
    resolved_finding = db.execute(
        select(CaseAIFinding).where(
            CaseAIFinding.case_id == case.id,
            CaseAIFinding.finding_type == "form_conflict",
        )
    ).scalars().first()
    assert resolved_finding is not None
    assert resolved_finding.status == "resolved"
    assert resolved_finding.resolution_action == "resolve"
    assert resolved_finding.reviewer_id == fixtures["counsel"].id


def test_stage6_sensitive_field_gate_and_finalization_lock(client: TestClient, db: Session):
    """
    Test 5: Verifies sensitive field review gate and submission finalization lock:
    - Form cannot be locked/finalized if incomplete or if sensitive fields are unreviewed.
    - Retained client is blocked with 403 from certifying sensitive fields or finalizing.
    - Once counsel certifies sensitive fields and confirms all answers, form successfully finalizes.
    - Readiness checklist passes cleanly.
    """
    fixtures = setup_stage6_fixtures(db)
    from backend.app.main import app

    # Counsel session
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["counsel"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["counsel"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case = fixtures["case"]
    org = fixtures["org"]
    client_profile = fixtures["client_profile"]

    # Single valid passport
    doc = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=client_profile.id,
        title="Valid_Passport.pdf",
        filename="Valid_Passport.pdf",
        category="identity_document",
        storage_path="documents/Valid_Passport.pdf",
        byte_size=1000,
        mime_type="application/pdf",
        sha256_hash="5555555555555555555555555555555555555555555555555555555555555555",
        verification_status="verified",
        processing_status="completed",
        created_at=now_utc(),
    )
    db.add(doc)
    db.flush()

    db.add(DocumentExtractedField(
        organization_id=org.id,
        document_id=doc.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="GB1234567",
        normalized_value="GB1234567",
        source_page=1,
        validation_status="verified",
        created_at=now_utc(),
    ))
    db.commit()

    # Create submission
    res = client.post(f"/api/v1/forms/cases/{case.id}/submissions")
    submission_id = res.json()["id"]

    # 1. Attempt to finalize before completion & sensitive review must fail
    res_fin_early = client.post(f"/api/v1/forms/submissions/{submission_id}/finalize")
    assert res_fin_early.status_code == 400
    assert "Cannot finalize form submission" in res_fin_early.json()["detail"]

    # 2. Client role blocked from sensitive review
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["client_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["client_user"].email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    res_client_review = client.post(
        f"/api/v1/forms/submissions/{submission_id}/review-sensitive",
        json={"notes": "Client attempting review"},
    )
    assert res_client_review.status_code == 403

    # Client blocked from finalize
    res_client_finalize = client.post(f"/api/v1/forms/submissions/{submission_id}/finalize")
    assert res_client_finalize.status_code == 403

    # Switch back to Counsel
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["counsel"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["counsel"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    # 3. Confirm all unconfirmed draft fields (passport & proposed endeavor)
    client.post(
        f"/api/v1/forms/submissions/{submission_id}/confirm-field",
        json={"field_key": "beneficiary_passport_number"},
    )
    client.post(
        f"/api/v1/forms/submissions/{submission_id}/confirm-field",
        json={"field_key": "proposed_occupation"},
    )

    # 4. Counsel certifies sensitive review
    res_review = client.post(
        f"/api/v1/forms/submissions/{submission_id}/review-sensitive",
        json={"notes": "Certified zero prior removal or criminal records under 8 CFR § 204.5."},
    )
    assert res_review.status_code == 200
    assert res_review.json()["sensitive_fields_reviewed"] is True

    # 5. Finalize submission
    res_final = client.post(
        f"/api/v1/forms/submissions/{submission_id}/finalize",
        json={"status": "confirmed"},
    )
    assert res_final.status_code == 200
    fin_data = res_final.json()
    assert fin_data["status"] == "confirmed"
    assert fin_data["has_unconfirmed_ai_fields"] is False
    assert fin_data["sensitive_fields_reviewed"] is True

    # 6. Check readiness evaluation
    readiness = ReadinessService.evaluate_case_readiness(db, case.id)
    # The form submission itself has zero defects
    assert readiness["checklist"]["incomplete_forms"]["count"] == 0
    assert len(readiness["checklist"]["incomplete_forms"]["items"]) == 0
