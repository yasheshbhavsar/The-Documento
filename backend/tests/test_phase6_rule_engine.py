"""Comprehensive tests for Phase 6: Immigration Rules, Official Sources, and Requirement Engine."""
from datetime import datetime, timezone
import hashlib
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import get_db
from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    Document,
    DocumentExtractedField,
    OfficialSource,
    SourceSnapshot,
    RuleSet,
    RuleSetVersion,
    RuleRequirement,
    CaseRequirementEvaluation,
    CaseTask,
)
from backend.app.rules.declarative_evaluator import (
    evaluate_requirement,
    evaluate_condition,
    ALLOWED_OPERATORS,
)
from backend.app.rules.rule_engine import evaluate_case_requirements
from backend.app.rules.affected_cases_detector import identify_and_queue_affected_cases
from backend.app.rules.pilot_data import seed_eb1a_pilot


@pytest.fixture
def test_setup(db: Session):
    """Sets up test organization and users with distinct roles."""
    org = Organization(
        name="Phase 6 Test Law Firm",
        slug=f"p6-firm-{uuid.uuid4().hex[:6]}",
    )
    db.add(org)
    db.flush()

    # Rule Editor
    editor = User(
        email=f"editor-{uuid.uuid4().hex[:6]}@law.com",
        full_name="Rule Editor Specialist",
        password_hash="test-hash",
        status="active",
    )
    # Rule Approver
    approver = User(
        email=f"approver-{uuid.uuid4().hex[:6]}@law.com",
        full_name="Senior Rules Approver",
        password_hash="test-hash",
        status="active",
    )
    # Case Manager
    case_manager = User(
        email=f"cm-{uuid.uuid4().hex[:6]}@law.com",
        full_name="Senior Case Manager",
        password_hash="test-hash",
        status="active",
    )
    # Master Admin
    admin = User(
        email=f"admin-{uuid.uuid4().hex[:6]}@law.com",
        full_name="Managing Partner Admin",
        password_hash="test-hash",
        status="active",
    )

    db.add_all([editor, approver, case_manager, admin])
    db.commit()
    db.refresh(org)

    return {
        "org": org,
        "editor": editor,
        "approver": approver,
        "case_manager": case_manager,
        "admin": admin,
    }


def test_declarative_evaluator_operators_and_ast_safety():
    """Verifies declarative evaluation operators are bounded and safe."""
    context = {
        "case": {"visa_category": "EB-1A", "priority_date": "2024-01-01"},
        "applicant": {"nationality": "GB", "publications_count": 15},
    }

    # Equality
    assert evaluate_condition({"field": "case.visa_category", "op": "eq", "value": "EB-1A"}, context)
    assert not evaluate_condition({"field": "case.visa_category", "op": "eq", "value": "O-1A"}, context)

    # Greater than / less than
    assert evaluate_condition({"field": "applicant.publications_count", "op": "gte", "value": 10}, context)
    assert not evaluate_condition({"field": "applicant.publications_count", "op": "lt", "value": 5}, context)

    # In list
    assert evaluate_condition({"field": "applicant.nationality", "op": "in", "value": ["GB", "CA", "AU"]}, context)
    assert not evaluate_condition({"field": "applicant.nationality", "op": "in", "value": ["DE", "FR"]}, context)

    # Compound 'all' and 'any'
    compound = {
        "all": [
            {"field": "case.visa_category", "op": "eq", "value": "EB-1A"},
            {"field": "applicant.publications_count", "op": "gt", "value": 10},
        ]
    }
    assert evaluate_condition(compound, context)

    # Disallowed operators safely return False without executing anything
    assert not evaluate_condition({"field": "case.visa_category", "op": "__import__", "value": "os"}, context)


def test_requirement_statuses_lifecycle_and_blocking():
    """Verifies all distinct requirement evaluation statuses:
    complete, missing, needs_review, unknown, not_applicable, expired, blocked.
    """
    req = {
        "code": "REQ-101",
        "title": "Evidence of Major Prize",
        "is_mandatory": True,
        "requires_human_review": True,
        "applicability_conditions": {"field": "case.visa_category", "op": "eq", "value": "EB-1A"},
        "accepted_evidence_types": ["award_certificate"],
        "validation_rules": [{"check": "field_present", "field_name": "award_title"}],
        "blocking_dependencies": ["REQ-ID"],
    }

    # 1. Not applicable when pathway does not match
    non_matching_context = {"case": {"visa_category": "H-1B"}}
    res = evaluate_requirement(req, non_matching_context, [])
    assert res["status"] == "not_applicable"
    assert not res["is_applicable"]

    matching_context = {"case": {"visa_category": "EB-1A"}}

    # 2. Blocked when prerequisite dependency is not complete
    res = evaluate_requirement(req, matching_context, [], blocking_results={"REQ-ID": "missing"})
    assert res["status"] == "blocked"
    assert "REQ-ID" in res["blocking_reasons"]

    # 3. Missing when evidence document is not provided
    res = evaluate_requirement(req, matching_context, [], blocking_results={"REQ-ID": "complete"})
    assert res["status"] == "missing"

    # 4. Expired when document contains an expired date
    expired_doc = {
        "id": "doc-1",
        "category": "award_certificate",
        "title": "Expired Award Certificate",
        "verification_status": "verified",
        "extracted_fields": [{"field_name": "expiration_date", "normalized_value": "2020-01-01T00:00:00Z"}],
    }
    res = evaluate_requirement(req, matching_context, [expired_doc], blocking_results={"REQ-ID": "complete"})
    assert res["status"] == "expired"

    # 5. Unknown / validation failed when document is present but lacks required fields (presence != satisfaction)
    incomplete_doc = {
        "id": "doc-2",
        "category": "award_certificate",
        "title": "Award Letter",
        "verification_status": "verified",
        "extracted_fields": [],  # missing award_title field!
    }
    res = evaluate_requirement(req, matching_context, [incomplete_doc], blocking_results={"REQ-ID": "complete"})
    assert res["status"] == "unknown"
    assert any("award_title" in f for f in res["validation_details"])

    # 6. Needs review when document is valid and field is present, but human caseworker has not verified it yet
    unverified_valid_doc = {
        "id": "doc-3",
        "category": "award_certificate",
        "title": "Legitimate Award",
        "verification_status": "pending",  # Not yet human-verified
        "extracted_fields": [{"field_name": "award_title", "normalized_value": "ACM Doctoral Award"}],
    }
    res = evaluate_requirement(req, matching_context, [unverified_valid_doc], blocking_results={"REQ-ID": "complete"})
    assert res["status"] == "needs_review"
    assert res["requires_human_signoff"]

    # 7. Complete when all evidence, validations, and human verification pass
    verified_doc = {
        "id": "doc-4",
        "category": "award_certificate",
        "title": "Verified Award",
        "verification_status": "verified",
        "extracted_fields": [{"field_name": "award_title", "normalized_value": "ACM Doctoral Award"}],
    }
    res = evaluate_requirement(req, matching_context, [verified_doc], blocking_results={"REQ-ID": "complete"})
    assert res["status"] == "complete"


def test_official_source_snapshot_hashing_and_diffing(client: TestClient, db: Session, test_setup):
    """Verifies source registration, cryptographic snapshot capture, and comparison."""
    org = test_setup["org"]
    editor = test_setup["editor"]

    source = OfficialSource(
        organization_id=org.id,
        jurisdiction="US",
        authority="USCIS",
        title="USCIS Policy Manual Vol 6 Part F Ch 2",
        url="https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2",
        scope_limitations="Covers EB-1A extraordinary ability evidentiary standards.",
    )
    db.add(source)
    db.commit()

    snap_1_text = "Standard 8 CFR 204.5(h) guidance. 10 criteria."
    snap_1 = SourceSnapshot(
        organization_id=org.id,
        source_id=source.id,
        content_hash=hashlib.sha256(snap_1_text.encode("utf-8")).hexdigest(),
        raw_content=snap_1_text,
        publication_date=datetime(2023, 1, 1, tzinfo=timezone.utc),
        created_by_user_id=editor.id,
    )

    snap_2_text = "Standard 8 CFR 204.5(h) guidance. 10 criteria.\nUpdated STEM criteria clarification."
    snap_2 = SourceSnapshot(
        organization_id=org.id,
        source_id=source.id,
        content_hash=hashlib.sha256(snap_2_text.encode("utf-8")).hexdigest(),
        raw_content=snap_2_text,
        publication_date=datetime(2023, 9, 12, tzinfo=timezone.utc),
        created_by_user_id=editor.id,
    )
    db.add_all([snap_1, snap_2])
    db.commit()

    # Compare snapshots using API endpoint logic
    # Authenticate as editor
    headers = {"X-User-Id": str(editor.id), "X-Org-Id": str(org.id), "X-User-Role": "rule_editor"}
    resp = client.get(
        f"/api/v1/rules/sources/{source.id}/snapshots/compare?from_id={snap_1.id}&to_id={snap_2.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_changes"] is True
    assert any("+Updated STEM" in line for line in data["diff_lines"])


def test_rule_version_lifecycle_and_separation_of_duty(client: TestClient, db: Session, test_setup):
    """Verifies rule version state machine and strict separation of duties between editor and approver."""
    org = test_setup["org"]
    editor = test_setup["editor"]
    approver = test_setup["approver"]

    editor_headers = {"X-User-Id": str(editor.id), "X-Org-Id": str(org.id), "X-User-Role": "rule_editor"}
    approver_headers = {"X-User-Id": str(approver.id), "X-Org-Id": str(org.id), "X-User-Role": "rule_approver"}

    # 1. Editor creates Rule Set
    resp = client.post(
        "/api/v1/rules/sets",
        json={
            "jurisdiction": "GB",
            "authority": "UKVI",
            "program_pathway": "Global Talent",
            "code": "UK-UKVI-GT",
            "name": "UK Global Talent Visa Rules",
            "description": "Rules for exceptional talent and promise in digital technology.",
        },
        headers=editor_headers,
    )
    assert resp.status_code == 201
    ruleset_id = resp.json()["id"]

    # 2. Editor creates Version 1.0.0 (draft)
    resp = client.post(
        f"/api/v1/rules/sets/{ruleset_id}/versions",
        json={"version_number": "1.0.0", "change_summary": "Initial draft of Global Talent rules"},
        headers=editor_headers,
    )
    assert resp.status_code == 201
    version_id = resp.json()["id"]
    assert resp.json()["status"] == "draft"

    # 3. Editor transitions draft -> under_review
    resp = client.post(
        f"/api/v1/rules/versions/{version_id}/transition",
        json={"target_status": "under_review", "comments": "Submitted for legal review"},
        headers=editor_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "under_review"

    # 4. Editor CANNOT validate/approve (rule_editor lacks rule:approve)
    resp = client.post(
        f"/api/v1/rules/versions/{version_id}/transition",
        json={"target_status": "validated", "comments": "Self approval attempt"},
        headers=editor_headers,
    )
    assert resp.status_code == 403

    # 5. Approver transitions under_review -> validated
    resp = client.post(
        f"/api/v1/rules/versions/{version_id}/transition",
        json={"target_status": "validated", "comments": "Legal audit completed and passed"},
        headers=approver_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "validated"

    # 6. Approver publishes version
    resp = client.post(
        f"/api/v1/rules/versions/{version_id}/transition",
        json={"target_status": "published", "comments": "Published for operational use"},
        headers=approver_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


def test_affected_cases_detector_queues_review_tasks_without_silent_overwrites(db: Session, test_setup):
    """Verifies that publishing a new rule version identifies open cases and queues review tasks
    instead of silently overwriting historical case evaluations.
    """
    org = test_setup["org"]
    admin = test_setup["admin"]
    cm = test_setup["case_manager"]

    # Create rule set
    ruleset = RuleSet(
        organization_id=org.id,
        jurisdiction="US",
        authority="USCIS",
        program_pathway="EB-1A",
        code="US-EB1A-TEST",
        name="US EB-1A Rules",
        description="Test EB-1A",
    )
    db.add(ruleset)
    db.flush()

    v1 = RuleSetVersion(
        organization_id=org.id,
        rule_set_id=ruleset.id,
        version_number="1.0.0",
        status="published",
        author_user_id=admin.id,
    )
    db.add(v1)
    db.flush()
    ruleset.current_version_id = v1.id

    client_prof = ClientProfile(
        organization_id=org.id,
        first_name="Jane",
        last_name="Doe",
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        nationality="USA",
    )
    db.add(client_prof)
    db.flush()

    # Create 2 open cases in EB-1A
    case_1 = ImmigrationCase(
        organization_id=org.id,
        client_id=client_prof.id,
        case_number="US-EB1A-2026-001",
        title="EB-1A Petition 1",
        jurisdiction="US",
        visa_category="EB-1A",
        status="processing",
    )
    case_2 = ImmigrationCase(
        organization_id=org.id,
        client_id=client_prof.id,
        case_number="US-EB1A-2026-002",
        title="EB-1A Petition 2",
        jurisdiction="US",
        visa_category="EB-1A",
        status="awaiting_documents",
    )
    # Create 1 closed case (should NOT be affected)
    closed_case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_prof.id,
        case_number="US-EB1A-2026-003",
        title="EB-1A Petition 3",
        jurisdiction="US",
        visa_category="EB-1A",
        status="closed",
    )
    db.add_all([case_1, case_2, closed_case])
    db.flush()

    # Case 1 has prior evaluation under v1
    eval_1 = CaseRequirementEvaluation(
        organization_id=org.id,
        case_id=case_1.id,
        rule_set_version_id=v1.id,
        status="needs_review",
        overall_fulfillment_percentage=75.0,
        requirement_results={"version": "1.0.0"},
        is_superseded=False,
    )
    db.add(eval_1)
    db.commit()

    # Now create Version 2.0.0
    v2 = RuleSetVersion(
        organization_id=org.id,
        rule_set_id=ruleset.id,
        version_number="2.0.0",
        status="published",
        change_summary="Substantial revision to scientific criteria standards.",
        author_user_id=admin.id,
    )
    db.add(v2)
    db.commit()

    # Run affected cases detection
    impact = identify_and_queue_affected_cases(
        db=db,
        rule_set_version=v2,
        triggered_by_user_id=admin.id,
        create_review_tasks=True,
    )

    assert impact["affected_cases_count"] == 2  # case_1 and case_2
    assert impact["tasks_queued_count"] == 2

    # Verify historical evaluation of Case 1 was NOT silently modified or deleted!
    db.refresh(eval_1)
    assert eval_1.rule_set_version_id == v1.id
    assert eval_1.status == "needs_review"
    assert eval_1.overall_fulfillment_percentage == 75.0

    # Verify high-priority tasks were created for caseworker
    tasks = db.query(CaseTask).filter(CaseTask.case_id == case_1.id).all()
    assert len(tasks) == 1
    assert "Review rules update" in tasks[0].title
    assert tasks[0].priority == "high"


def test_eb1a_pilot_seeding_and_case_evaluation(db: Session, test_setup):
    """Verifies complete pilot rollout for US EB-1A and end-to-end requirement evaluation on a case."""
    org = test_setup["org"]
    admin = test_setup["admin"]

    # 1. Seed pilot
    pilot_version = seed_eb1a_pilot(db=db, org_id=org.id, user_id=admin.id)
    assert pilot_version.version_number == "1.0.0"
    assert pilot_version.status == "published"
    assert len(pilot_version.requirements) == 12

    client_prof = ClientProfile(
        organization_id=org.id,
        first_name="Elena",
        last_name="Rostova",
        email=f"elena-{uuid.uuid4().hex[:6]}@example.com",
        nationality="USA",
    )
    db.add(client_prof)
    db.flush()

    # 2. Create pilot case
    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_prof.id,
        case_number="US-EB1A-PILOT-01",
        title="Dr. Elena - EB-1A Pilot",
        jurisdiction="US",
        visa_category="EB-1A",
        status="processing",
    )
    db.add(case)
    db.flush()

    # Initial evaluation before documents: should show missing mandatory requirements
    eval_initial = evaluate_case_requirements(
        db=db,
        case=case,
        rule_set_version=pilot_version,
        evaluator_user_id=admin.id,
    )
    assert eval_initial.status in ["missing", "blocked"]
    assert eval_initial.overall_fulfillment_percentage < 50.0

    # 3. Add verified Passport document with required extracted fields
    passport_doc = Document(
        organization_id=org.id,
        case_id=case.id,
        title="Beneficiary Official Passport",
        category="passport",
        filename="passport_scan.pdf",
        storage_path="secure/passports/01.pdf",
        byte_size=1024,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        page_count=2,
        verification_status="verified",
    )
    db.add(passport_doc)
    db.flush()

    f1 = DocumentExtractedField(
        organization_id=org.id,
        document_id=passport_doc.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="Z98765432",
        normalized_value="Z98765432",
        ocr_confidence=0.98,
        validation_status="valid",
    )
    f2 = DocumentExtractedField(
        organization_id=org.id,
        document_id=passport_doc.id,
        field_name="date_of_birth",
        field_label="Date of Birth",
        original_value="1988-06-15",
        normalized_value="1988-06-15",
        ocr_confidence=0.99,
        validation_status="valid",
    )
    db.add_all([f1, f2])
    db.commit()

    # Re-evaluate
    eval_after_passport = evaluate_case_requirements(
        db=db,
        case=case,
        rule_set_version=pilot_version,
        evaluator_user_id=admin.id,
    )

    req_results = eval_after_passport.requirement_results["requirements"]
    id_req = next(r for r in req_results if r["code"] == "EB1A-MAND-ID")
    assert id_req["status"] == "complete"
    assert id_req["evidence_matched"] == [str(passport_doc.id)]

    # Verify previous evaluation was marked as superseded
    db.refresh(eval_initial)
    assert eval_initial.is_superseded is True
    assert eval_after_passport.is_superseded is False
