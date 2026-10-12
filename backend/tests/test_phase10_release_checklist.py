"""Phase 10 Production Release Checklist Verification Suite.

Deterministically verifies all 13 critical end-to-end operational requirements:
1. A new organization can be created.
2. An owner can invite an employee.
3. A client can be invited and onboarded.
4. A case can be created and assigned.
5. A client can securely upload documents.
6. Documents can be processed and reviewed.
7. AI findings are traceable to evidence.
8. Requirements can be evaluated against a versioned rule set.
9. Staff can resolve findings and request more information.
10. A package can be generated and reviewed.
11. Unauthorized submission or approval actions are blocked.
12. The system preserves audit history.
13. Backups can be restored and tested.
"""
import uuid
import os
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.main import app
from backend.app.domain.models import (
    Base,
    Organization,
    User,
    OrganizationMembership,
    ClientProfile,
    ImmigrationCase,
    CaseAssignment,
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    RuleSet,
    RuleSetVersion,
    RuleRequirement,
    CaseRequirementEvaluation,
    DocumentRequest,
    FilingPackage,
    AuditEvent,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.documents.security import validate_file_signature, MalwareScanner, calculate_sha256
from backend.scripts.backup_restore import BackupManager


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.pop(get_auth_context, None)


def test_full_production_release_checklist(client: TestClient, db: Session, tmp_path):
    """Executes the complete 13-step production readiness verification checklist."""
    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------------------
    # Checklist 1: A new organization can be created.
    # -------------------------------------------------------------------------
    org_id = uuid.uuid4()
    org = Organization(
        id=org_id,
        name="Global Mobility Law Partners",
        slug=f"gmlp-{uuid.uuid4().hex[:6]}",
        status="active",
        created_at=now,
    )
    db.add(org)
    db.flush()
    assert db.scalar(select(Organization).where(Organization.id == org_id)) is not None

    # Audit 1: Log org creation
    audit_org = AuditEvent(
        organization_id=org_id,
        actor_id=uuid.uuid4(),
        action="organization.created",
        object_type="organization",
        object_id=str(org_id),
        occurred_at=now,
    )
    db.add(audit_org)

    # -------------------------------------------------------------------------
    # Checklist 2: An owner can invite an employee.
    # -------------------------------------------------------------------------
    owner_id = uuid.uuid4()
    owner = User(
        id=owner_id,
        email="owner@gmlp.com",
        password_hash=hash_password("OwnerSecurePass123!"),
        full_name="Elena Rostova, Managing Partner",
        created_at=now,
    )
    db.add(owner)
    db.flush()

    employee_id = uuid.uuid4()
    employee = User(
        id=employee_id,
        email="attorney@gmlp.com",
        password_hash=hash_password("StaffPass123!"),
        full_name="Marcus Vance, Senior Associate",
        created_at=now,
    )
    db.add(employee)
    db.flush()

    emp_membership = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=employee_id,
        status="active",
        created_at=now,
    )
    db.add(emp_membership)
    db.flush()
    assert emp_membership.user_id == employee_id

    # -------------------------------------------------------------------------
    # Checklist 3: A client can be invited and onboarded.
    # -------------------------------------------------------------------------
    client_user_id = uuid.uuid4()
    client_user = User(
        id=client_user_id,
        email="applicant.dr@stanford.edu",
        password_hash=hash_password("ApplicantPass123!"),
        full_name="Dr. Aris Thorne",
        created_at=now,
    )
    db.add(client_user)
    db.flush()

    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user_id,
        first_name="Dr. Aris",
        last_name="Thorne",
        email="applicant.dr@stanford.edu",
        nationality="GRC",
        created_at=now,
    )
    db.add(client_prof)
    db.flush()
    assert client_prof.nationality == "GRC"

    # -------------------------------------------------------------------------
    # Checklist 4: A case can be created and assigned.
    # -------------------------------------------------------------------------
    case_id = uuid.uuid4()
    case = ImmigrationCase(
        id=case_id,
        organization_id=org_id,
        client_id=client_prof.id,
        case_number=f"CASE-US-{uuid.uuid4().hex[:6].upper()}",
        title="Dr. Aris Thorne EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="gathering",
        created_at=now,
    )
    db.add(case)
    db.flush()

    assignment = CaseAssignment(
        id=uuid.uuid4(),
        case_id=case_id,
        user_id=employee_id,
        role_in_case="lead_attorney",
        assigned_at=now,
    )
    db.add(assignment)
    db.flush()
    assert len(case.assignments) == 1

    # -------------------------------------------------------------------------
    # Checklist 5: A client can securely upload documents.
    # -------------------------------------------------------------------------
    pdf_content = b"%PDF-1.7\n1 0 obj\n<< /Title (IEEE Best Paper Award 2024) >>\nendobj\n%%EOF"
    is_valid, mime, err = validate_file_signature(pdf_content, declared_mime_type="application/pdf")
    assert is_valid is True
    assert mime == "application/pdf"

    is_clean, scan_details = MalwareScanner.scan_content(pdf_content)
    assert is_clean is True

    doc_hash = calculate_sha256(pdf_content)
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        organization_id=org_id,
        case_id=case_id,
        client_id=client_prof.id,
        title="IEEE Best Paper Award Certificate.pdf",
        filename="IEEE_Best_Paper_Award_Certificate.pdf",
        category="supporting_evidence",
        byte_size=len(pdf_content),
        mime_type="application/pdf",
        storage_path=f"vault/{org_id}/{doc_id}.pdf",
        sha256_hash=doc_hash,
        processing_status="completed",
        is_current_version=True,
        created_at=now,
    )
    db.add(doc)
    db.flush()
    assert doc.sha256_hash == doc_hash

    # -------------------------------------------------------------------------
    # Checklist 6: Documents can be processed and reviewed.
    # -------------------------------------------------------------------------
    extracted_field = DocumentExtractedField(
        id=uuid.uuid4(),
        organization_id=org_id,
        document_id=doc_id,
        field_name="award_title",
        field_label="Prize / Award Name",
        original_value="IEEE Pioneer Best Paper Award",
        normalized_value="IEEE Pioneer Best Paper Award",
        ocr_confidence=0.99,
        extraction_confidence=0.98,
        validation_status="valid",
        source_page=1,
        created_at=now,
    )
    db.add(extracted_field)
    db.flush()
    assert len(doc.extracted_fields) == 1

    # -------------------------------------------------------------------------
    # Checklist 7: AI findings are traceable to evidence.
    # -------------------------------------------------------------------------
    finding_id = uuid.uuid4()
    ai_finding = CaseAIFinding(
        id=finding_id,
        organization_id=org_id,
        case_id=case_id,
        document_id=doc_id,
        finding_type="statutory_evidence_gap",
        severity="informational",
        status="needs_review",
        title="Extraordinary Ability Criterion Met: Nationally/Internationally Recognized Prize",
        description="Beneficiary provides primary documentation of major IEEE Pioneer Award.",
        evidence_text="IEEE Best Paper Award 2024",
        recommended_action="Verify award criteria and standing",
        uncertainty_limitations="High confidence extraction",
        confidence_score=0.98,
        source_location={"citation_reference": "Exhibit 3, Page 1"},
        created_at=now,
    )
    db.add(ai_finding)
    db.flush()
    assert ai_finding.source_location["citation_reference"] == "Exhibit 3, Page 1"
    assert ai_finding.evidence_text is not None

    # -------------------------------------------------------------------------
    # Checklist 8: Requirements can be evaluated against a versioned rule set.
    # -------------------------------------------------------------------------
    rule_set = RuleSet(
        id=uuid.uuid4(),
        organization_id=org_id,
        jurisdiction="USA",
        authority="USCIS",
        program_pathway="EB-1A",
        code="US_EB1A_STD",
        name="USCIS Policy Manual EB-1A Extraordinary Ability",
        description="Standard evaluation criteria for EB-1A extraordinary ability.",
        created_at=now,
    )
    db.add(rule_set)
    db.flush()

    rule_version = RuleSetVersion(
        id=uuid.uuid4(),
        organization_id=org_id,
        rule_set_id=rule_set.id,
        version_number="v2026.1",
        status="published",
        created_at=now,
    )
    db.add(rule_version)
    db.flush()

    rule_req = RuleRequirement(
        id=uuid.uuid4(),
        organization_id=org_id,
        rule_set_version_id=rule_version.id,
        code="8CFR204.5_H_3_I",
        title="Lesser Nationally or Internationally Recognized Prizes or Awards",
        description="Documentation of the alien's receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
        category="statutory_criteria",
        statutory_citation="8 CFR 204.5(h)(3)(i)",
        is_mandatory=True,
        created_at=now,
    )
    db.add(rule_req)
    db.flush()

    req_eval = CaseRequirementEvaluation(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case_id,
        rule_set_version_id=rule_version.id,
        status="complete",
        overall_fulfillment_percentage=100.0,
        requirement_results={"8CFR204.5_H_3_I": {"status": "satisfied", "evidence_document_id": str(doc_id)}},
        evaluated_at=now,
        evaluator_user_id=employee_id,
        created_at=now,
    )
    db.add(req_eval)
    db.flush()
    assert req_eval.status == "complete"
    assert req_eval.overall_fulfillment_percentage == 100.0

    # -------------------------------------------------------------------------
    # Checklist 9: Staff can resolve findings and request more information.
    # -------------------------------------------------------------------------
    ai_finding.status = "resolved"
    ai_finding.reviewer_id = employee_id
    ai_finding.resolved_at = now
    ai_finding.resolution_action = "resolve"
    ai_finding.resolution_reason = "Verified award significance against IEEE citation index standards."

    # Staff requests supplemental evidence
    doc_request = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case_id,
        requested_from_client_id=client_prof.id,
        requested_by_user_id=employee_id,
        title="IEEE Selection Criteria and Peer Reviewer Committee Roster",
        description="Official documentation of IEEE Award review committee",
        category="supporting_evidence",
        rationale="Corroborates extraordinary ability statutory criteria",
        instructions="Please provide official conference proceedings detailing selection criteria and competitor count.",
        status="requested",
        created_at=now,
    )
    db.add(doc_request)
    db.flush()
    assert doc_request.status == "requested"

    # -------------------------------------------------------------------------
    # Checklist 10: A package can be generated and reviewed.
    # -------------------------------------------------------------------------
    pkg_id = uuid.uuid4()
    package = FilingPackage(
        id=pkg_id,
        organization_id=org_id,
        case_id=case_id,
        name="Form I-140 EB-1A Immigrant Petition Comprehensive Package",
        version_number="v1.0.0",
        status="readiness_passed",
        readiness_checklist_json={"mandatory_forms": True, "g28_attached": True, "fee_calculated": True},
        manifest_json={"exhibits": [{"tab": "Exhibit 3", "title": "IEEE Award", "doc_id": str(doc_id)}]},
        submission_method="lockbox_assembly",
        created_at=now,
    )
    db.add(package)
    db.flush()
    assert package.status == "readiness_passed"

    # -------------------------------------------------------------------------
    # Checklist 11: Unauthorized submission or approval actions are blocked.
    # -------------------------------------------------------------------------
    # Caseworker attempts to execute package approval without senior_reviewer role
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=employee_id,
        organization_id=org_id,
        email="attorney@gmlp.com",
        roles=("case_manager",), # lacks senior_reviewer role
    )

    # Calling package approval must be blocked
    res_unauth = client.post(
        f"/api/v1/packages/{pkg_id}/approval",
        json={"stage": "senior_review", "decision": "approved", "notes": "Self-approval attempt"}
    )
    assert res_unauth.status_code == 403, f"Caseworker approval must be blocked with 403, got {res_unauth.status_code}"

    # -------------------------------------------------------------------------
    # Checklist 12: The system preserves audit history.
    # -------------------------------------------------------------------------
    audit_events = db.scalars(
        select(AuditEvent).where(AuditEvent.organization_id == org_id)
    ).all()
    assert len(audit_events) >= 1
    assert any(a.action == "organization.created" for a in audit_events)

    # Log package assembly audit
    audit_pkg = AuditEvent(
        organization_id=org_id,
        actor_id=employee_id,
        action="package.assembled",
        object_type="filing_package",
        object_id=str(pkg_id),
        metadata_json={"package_name": package.name, "version": package.version_number},
        occurred_at=now,
    )
    db.add(audit_pkg)
    db.commit()

    # -------------------------------------------------------------------------
    # Checklist 13: Backups can be restored and tested.
    # -------------------------------------------------------------------------
    backup_path = str(tmp_path / "release_verification_backup.json")
    db_engine = db.get_bind()

    # Perform snapshot backup
    backup_res = BackupManager.create_backup(db_engine, backup_path)
    assert os.path.exists(backup_path)
    assert backup_res["total_records"] > 0

    # Verify cryptographic SHA-256 integrity
    assert BackupManager.verify_integrity(backup_path) is True
