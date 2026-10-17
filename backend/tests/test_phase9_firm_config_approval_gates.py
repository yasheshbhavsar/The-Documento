"""Tests for Phase 9 — Firm Configuration and Approval Gates.

Covers:
1. Owner/managing admin configures roles, country/pathway enablement, folder structure,
   checklist versions, reminders/escalations, inactivity policy, review stages, approval owners,
   templates, and rejection reasons across 10 governance domains.
2. Essential safeguards cannot be disabled under any circumstances.
3. Configuration changes track actor, timestamp, old/new version, reason, effective date.
4. Existing cases do not silently inherit configuration changes (version pinning and explicit migration).
5. Initial consultation and preliminary assessment remain strictly separated from retained-client preparation.
6. Substantive preparation starts only after configured manager/senior authorization, accounts clearance,
   and original counsellor confirmation (tripartite clearance gate).
7. Five decoupled orthogonal state machines (Payment, Preparation, Review, Submission Authorization, Handover Authorization).
8. Progressive review stages (Officer initial review -> Senior review -> Lawyer review).
9. Ready-to-submit hold mechanisms (accounts/counsellor concerns or client decision).
10. Optional automatic reminders and manual control (manual reminders and acknowledgements).
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.core.errors import ConflictError, ValidationError, EntityNotFoundError
from backend.app.domain.case_lifecycle import (
    CaseLifecycleService,
    ClientEngagementType,
    HandoverAuthorizationStatus,
    PaymentClearanceStatus,
    PreparationStatus,
    ProgressiveReviewStage,
    ReviewStatus,
    SubmissionAuthorizationStatus,
)
from backend.app.domain.firm_config_service import (
    FirmConfigDomain,
    FirmConfigService,
    IMMUTABLE_SAFEGUARDS,
)
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseNote,
    CaseTask,
    ClientProfile,
    FirmConfigurationAuditLog,
    ImmigrationCase,
    Organization,
    OrganizationMembership,
    Role,
    MembershipRole,
    User,
    now_utc,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


def _create_user(db: Session, email: str, full_name: str) -> User:
    u = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("securepass123"),
        status="active",
    )
    db.add(u)
    db.flush()
    return u


def _setup_firm_test_fixtures(db: Session):
    org = Organization(name="Aegis Global Migration Law", slug=f"aegis-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    admin_user = _create_user(db, f"owner-{uuid.uuid4().hex[:6]}@aegis.com", "Managing Partner Victoria")
    counsellor_user = _create_user(db, f"counsellor-{uuid.uuid4().hex[:6]}@aegis.com", "Counsellor Marcus")
    lawyer_user = _create_user(db, f"lawyer-{uuid.uuid4().hex[:6]}@aegis.com", "Senior Counsel Elena")
    caseworker_user = _create_user(db, f"cw-{uuid.uuid4().hex[:6]}@aegis.com", "Officer David")

    admin_role = db.query(Role).filter(Role.code == RoleCode.ORGANIZATION_ADMIN).first()
    if not admin_role:
        admin_role = Role(name="Admin", code=RoleCode.ORGANIZATION_ADMIN)
        db.add(admin_role)
        db.flush()

    m_admin = OrganizationMembership(organization_id=org.id, user_id=admin_user.id, status="active")
    db.add(m_admin)
    db.flush()
    db.add(MembershipRole(membership_id=m_admin.id, role_id=admin_role.id))

    client = ClientProfile(
        organization_id=org.id,
        user_id=None,
        first_name="Rohan",
        last_name="Sharma",
        email=f"rohan-{uuid.uuid4().hex[:6]}@client.com",
        nationality="IND",
        created_at=now_utc(),
    )
    db.add(client)
    db.flush()
    db.commit()

    admin_ctx = AuthContext(
        user_id=admin_user.id,
        organization_id=org.id,
        email=admin_user.email,
        roles=(RoleCode.ORGANIZATION_ADMIN, RoleCode.MASTER_ADMIN),
    )

    return {
        "org": org,
        "admin": admin_user,
        "admin_ctx": admin_ctx,
        "counsellor": counsellor_user,
        "lawyer": lawyer_user,
        "caseworker": caseworker_user,
        "client": client,
    }


def test_firm_configuration_defaults_and_domains(db: Session):
    """Verifies that all 10 governance domains and immutable safeguards are loaded with defaults."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id

    config = FirmConfigService.get_firm_configuration(db, org_id)

    expected_domains = [
        "roles",
        "country_pathway_enablement",
        "folder_structure",
        "checklist_versions",
        "reminders_escalations",
        "inactivity_policy",
        "review_stages",
        "approval_owners",
        "templates",
        "rejection_reasons",
    ]
    for domain in expected_domains:
        assert domain in config["domains"], f"Missing domain {domain} in firm configuration"

    # Meta version
    assert config["version"] == 1

    # Safeguards
    safeguards = config["immutable_safeguards"]
    for sg_key, sg_meta in IMMUTABLE_SAFEGUARDS.items():
        assert safeguards.get(sg_key) is not None


def test_essential_safeguards_cannot_be_disabled(db: Session):
    """Verifies that attempting to disable essential safeguards raises ValidationError."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id

    # Attempt to disable audit logging
    with pytest.raises(ValidationError) as exc_info:
        FirmConfigService.update_domain_configuration(
            db=db,
            organization_id=org_id,
            domain="roles",
            config_data={"audit_logging_enabled": False},
            actor_id=admin_id,
            reason="Attempting to disable essential audit log safeguard for testing",
        )
    assert "Essential safeguard" in str(exc_info.value)
    assert "audit_logging_enabled" in str(exc_info.value)

    # Attempt to disable lawyer review signoff
    with pytest.raises(ValidationError) as exc_info2:
        FirmConfigService.update_domain_configuration(
            db=db,
            organization_id=org_id,
            domain="review_stages",
            config_data={"require_lawyer_signoff_before_submission": False},
            actor_id=admin_id,
            reason="Attempting to bypass lawyer signoff for high volume",
        )
    assert "require_lawyer_signoff_before_submission" in str(exc_info2.value)


def test_configuration_audit_trail_and_reason_requirement(db: Session):
    """Verifies that config mutations enforce >= 10 char reason and produce an audit trail."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id

    # Short reason should fail
    with pytest.raises(ValidationError) as exc_info:
        FirmConfigService.update_domain_configuration(
            db=db,
            organization_id=org_id,
            domain="reminders_escalations",
            config_data={"auto_reminders_enabled": True, "first_reminder_days": 5},
            actor_id=admin_id,
            reason="short",
        )
    assert "at least 10 characters" in str(exc_info.value)

    # Valid reason succeeds and bumps version to 2
    res = FirmConfigService.update_domain_configuration(
        db=db,
        organization_id=org_id,
        domain="reminders_escalations",
        config_data={"auto_reminders_enabled": True, "first_reminder_days": 5},
        actor_id=admin_id,
        reason="Updated reminder policy to 5-day initial cadence per firm operating guidelines",
    )
    assert res["version"] == 2
    assert res["domain"] == "reminders_escalations"

    # Audit history query
    history = FirmConfigService.get_audit_history(db, org_id)
    assert len(history) == 1
    log = history[0]
    assert log["domain"] == "reminders_escalations"
    assert log["old_version"] == 1
    assert log["new_version"] == 2
    assert log["actor_id"] == str(admin_id)
    assert "5-day initial cadence" in log["reason"]


def test_existing_cases_do_not_silently_inherit_configuration(db: Session):
    """Verifies that cases pin configuration snapshots and require explicit migration to receive firm updates."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    # 1. Create case under v1
    v1_snapshot, v1_version = FirmConfigService.create_case_config_snapshot(db, org_id)
    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"CAS-PIN-{uuid.uuid4().hex[:4].upper()}",
        title="Skilled Worker Case",
        jurisdiction="GBR",
        visa_category="Skilled Worker",
        status="INTAKE",
        pinned_firm_config_snapshot=v1_snapshot,
        firm_config_version=v1_version,
        firm_config_update_available=False,
        substantive_authorizations=CaseLifecycleService.initialize_case_authorizations(),
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(case)
    db.commit()

    # 2. Update firm configuration to v2
    FirmConfigService.update_domain_configuration(
        db=db,
        organization_id=org_id,
        domain="checklist_versions",
        config_data={"tier2_version": "v2026.4"},
        actor_id=admin_id,
        reason="Upgrading Tier 2 checklist standard following Home Office spring updates",
    )

    db.refresh(case)
    # The existing case must NOT have automatically mutated its version or snapshot
    assert case.firm_config_version == 1
    assert case.firm_config_update_available is True
    assert case.pinned_firm_config_snapshot.get("checklist_versions", {}).get("tier2_version") != "v2026.4"

    # 3. Explicitly migrate the case to v2
    migrated_case = FirmConfigService.migrate_case_to_latest_config(db, case.id, admin_id)
    assert migrated_case.firm_config_version == 2
    assert migrated_case.firm_config_update_available is False
    assert migrated_case.pinned_firm_config_snapshot.get("checklist_versions", {}).get("tier2_version") == "v2026.4"


def test_consultation_and_preliminary_assessment_separated_from_preparation(db: Session):
    """Verifies that non-retained prospects in consultation or preliminary assessment cannot proceed to substantive preparation."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    # Create consultation-only case
    consultation_case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"CON-{uuid.uuid4().hex[:4].upper()}",
        title="Initial Consultation - Investment Visa",
        jurisdiction="USA",
        visa_category="EB-5",
        status="INTAKE",
        client_engagement_type=ClientEngagementType.CONSULTATION_ONLY.value,
        is_retained=False,
        preparation_status=PreparationStatus.CONSULTATION_ONLY.value,
        substantive_authorizations=CaseLifecycleService.initialize_case_authorizations(),
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(consultation_case)
    db.commit()

    # Attempt to transition to substantive preparation should be blocked
    with pytest.raises(ValidationError) as exc_info:
        CaseLifecycleService.transition_preparation_status(
            db=db,
            case=consultation_case,
            target_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
            ctx=fixtures["admin_ctx"],
        )
    assert "Cannot initiate substantive casework preparation for non-retained prospect" in str(exc_info.value)

    # Convert client to retained
    consultation_case.is_retained = True
    consultation_case.client_engagement_type = ClientEngagementType.RETAINED_CLIENT.value
    consultation_case.preparation_status = PreparationStatus.CLEARANCE_PENDING.value
    db.commit()

    # Still blocked because tripartite clearances are pending
    with pytest.raises(ValidationError) as exc_info2:
        CaseLifecycleService.transition_preparation_status(
            db=db,
            case=consultation_case,
            target_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
            ctx=fixtures["admin_ctx"],
        )
    assert "Substantive preparation blocked: missing required tripartite authorizations" in str(exc_info2.value)


def test_tripartite_substantive_preparation_gate(db: Session):
    """Verifies manager authorization, accounts clearance, and counsellor confirmation are all required before substantive preparation."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"RET-{uuid.uuid4().hex[:4].upper()}",
        title="Retained O-1A Petition",
        jurisdiction="USA",
        visa_category="O-1A",
        status="INTAKE",
        client_engagement_type=ClientEngagementType.RETAINED_CLIENT.value,
        is_retained=True,
        preparation_status=PreparationStatus.CLEARANCE_PENDING.value,
        substantive_authorizations=CaseLifecycleService.initialize_case_authorizations(),
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(case)
    db.commit()

    # Step 1: Manager authorization
    CaseLifecycleService.record_tripartite_authorization(
        db=db,
        case=case,
        gate_type="manager_authorization",
        actor_id=admin_id,
        actor_role="managing_admin",
        authorized=True,
        notes="Manager verified scope and assigned team",
    )
    assert case.substantive_authorizations["manager_authorization"]["cleared"] is True
    # Still pending accounts and counsellor
    assert case.preparation_status == PreparationStatus.CLEARANCE_PENDING.value

    # Step 2: Accounts clearance
    CaseLifecycleService.record_tripartite_authorization(
        db=db,
        case=case,
        gate_type="accounts_clearance",
        actor_id=admin_id,
        actor_role="accounts",
        authorized=True,
        notes="Retainer invoice paid in full",
    )
    assert case.substantive_authorizations["accounts_clearance"]["cleared"] is True
    assert case.preparation_status == PreparationStatus.CLEARANCE_PENDING.value

    # Step 3: Counsellor confirmation
    CaseLifecycleService.record_tripartite_authorization(
        db=db,
        case=case,
        gate_type="counsellor_confirmation",
        actor_id=admin_id,
        actor_role="counsellor",
        authorized=True,
        notes="Signed legal engagement letter received from client",
    )
    assert case.substantive_authorizations["counsellor_confirmation"]["cleared"] is True

    # With all 3 cleared, status automatically promotes to AUTHORIZED_FOR_PREPARATION
    assert case.preparation_status == PreparationStatus.AUTHORIZED_FOR_PREPARATION.value

    # Now transitioning to PREPARATION_IN_PROGRESS succeeds
    CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
        ctx=fixtures["admin_ctx"],
    )
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS.value


def test_five_decoupled_state_machines(db: Session):
    """Verifies Payment, Preparation, Review, Submission Authorization, and Handover are fully distinct."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"DEC-{uuid.uuid4().hex[:4].upper()}",
        title="Decoupled States Test Case",
        jurisdiction="CAN",
        visa_category="Express Entry",
        status="ACTIVE",
        payment_clearance_status=PaymentClearanceStatus.PENDING.value,
        preparation_status=PreparationStatus.PREPARATION_IN_PROGRESS.value,
        review_status=ReviewStatus.NOT_STARTED.value,
        submission_authorization_status=SubmissionAuthorizationStatus.NOT_REQUESTED.value,
        handover_authorization_status=HandoverAuthorizationStatus.NOT_REQUESTED.value,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(case)
    db.commit()

    # Mutate payment clearance independently
    CaseLifecycleService.update_payment_clearance(
        db=db,
        case=case,
        new_status=PaymentClearanceStatus.PAID.value,
        actor_id=admin_id,
        notes="Client paid retainer invoice",
    )
    assert case.payment_clearance_status == PaymentClearanceStatus.PAID.value
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS.value
    assert case.review_status == ReviewStatus.NOT_STARTED.value

    # Mutate review status independently
    CaseLifecycleService.record_progressive_review(
        db=db,
        case=case,
        stage=ProgressiveReviewStage.OFFICER_INITIAL_REVIEW.value,
        outcome="APPROVED",
        actor_id=admin_id,
        comments="Initial officer review passed",
    )
    assert case.review_status == ReviewStatus.OFFICER_INITIAL_REVIEW.value
    assert case.submission_authorization_status == SubmissionAuthorizationStatus.NOT_REQUESTED.value

    # Mutate submission authorization independently
    CaseLifecycleService.set_submission_authorization(
        db=db,
        case=case,
        action="HOLD_ACCOUNTS",
        actor_id=admin_id,
        notes="Disbursement fees pending clearance",
    )
    assert case.submission_authorization_status == SubmissionAuthorizationStatus.HELD_FOR_ACCOUNTS.value
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS.value

    # Mutate handover authorization independently
    CaseLifecycleService.set_handover_authorization(
        db=db,
        case=case,
        authorized=True,
        actor_id=admin_id,
        notes="Client handover package authorized",
    )
    assert case.handover_authorization_status == HandoverAuthorizationStatus.AUTHORIZED_FOR_HANDOVER.value


def test_progressive_review_stages_and_safeguards(db: Session):
    """Verifies Officer Initial Review -> Senior Review -> Lawyer Review before submission."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"REV-{uuid.uuid4().hex[:4].upper()}",
        title="Progressive Review Case",
        jurisdiction="AUS",
        visa_category="Subclass 189",
        status="ACTIVE",
        preparation_status=PreparationStatus.READY_FOR_FINAL_REVIEW.value,
        review_status=ReviewStatus.NOT_STARTED.value,
        payment_clearance_status=PaymentClearanceStatus.PAID.value,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(case)
    db.commit()

    # Stage 1: Officer Initial Review
    CaseLifecycleService.record_progressive_review(
        db=db,
        case=case,
        stage=ProgressiveReviewStage.OFFICER_INITIAL_REVIEW.value,
        outcome="APPROVED",
        actor_id=admin_id,
        comments="Form fields and attachments checked",
    )
    assert case.review_status == ReviewStatus.OFFICER_INITIAL_REVIEW.value

    # Stage 2: Senior Review
    CaseLifecycleService.record_progressive_review(
        db=db,
        case=case,
        stage=ProgressiveReviewStage.SENIOR_REVIEW.value,
        outcome="APPROVED",
        actor_id=admin_id,
        comments="Senior casework review approved",
    )
    assert case.review_status == ReviewStatus.SENIOR_REVIEW.value

    # Stage 3: Lawyer Review
    CaseLifecycleService.record_progressive_review(
        db=db,
        case=case,
        stage=ProgressiveReviewStage.LAWYER_REVIEW.value,
        outcome="APPROVED",
        actor_id=admin_id,
        comments="Legal argument and compliance verified by qualified solicitor",
    )
    # Lawyer approval promotes overall review status to APPROVED
    assert case.review_status == ReviewStatus.APPROVED.value


def test_ready_to_submit_holds(db: Session):
    """Verifies that a case in READY_TO_SUBMIT can be held for accounts, counsellor concerns, or client decision."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"HLD-{uuid.uuid4().hex[:4].upper()}",
        title="Ready to Submit Hold Case",
        jurisdiction="GBR",
        visa_category="Innovator Founder",
        status="ACTIVE",
        payment_clearance_status=PaymentClearanceStatus.PAID.value,
        preparation_status=PreparationStatus.READY_TO_SUBMIT.value,
        review_status=ReviewStatus.APPROVED.value,
        submission_authorization_status=SubmissionAuthorizationStatus.APPROVED.value,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(case)
    db.commit()

    # Place hold for client decision
    CaseLifecycleService.set_submission_authorization(
        db=db,
        case=case,
        action="HOLD_CLIENT_DECISION",
        actor_id=admin_id,
        notes="Client requested delay due to travel schedule",
    )
    assert case.submission_authorization_status == SubmissionAuthorizationStatus.HELD_FOR_CLIENT_DECISION.value

    # Attempting to transition to SUBMITTED while hold is active fails
    with pytest.raises(ValidationError) as exc_info:
        CaseLifecycleService.transition_preparation_status(
            db=db,
            case=case,
            target_status=PreparationStatus.SUBMITTED.value,
            ctx=fixtures["admin_ctx"],
        )
    assert "Submission hold active" in str(exc_info.value)

    # Release hold
    CaseLifecycleService.set_submission_authorization(
        db=db,
        case=case,
        action="RELEASE_HOLD",
        actor_id=admin_id,
        notes="Client confirmed ready to proceed",
    )
    assert case.submission_authorization_status == SubmissionAuthorizationStatus.READY_FOR_SUBMISSION.value

    # Transition to SUBMITTED now succeeds
    CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.SUBMITTED.value,
        ctx=fixtures["admin_ctx"],
    )
    assert case.preparation_status == PreparationStatus.SUBMITTED.value


def test_manual_reminders_and_acknowledgements(db: Session):
    """Verifies manual dispatch of reminders and acknowledgements."""
    fixtures = _setup_firm_test_fixtures(db)
    org_id = fixtures["org"].id
    admin_id = fixtures["admin"].id
    client = fixtures["client"]

    case = ImmigrationCase(
        organization_id=org_id,
        client_id=client.id,
        case_number=f"NOT-{uuid.uuid4().hex[:4].upper()}",
        title="Notifications Test Case",
        jurisdiction="USA",
        visa_category="H-1B",
        status="ACTIVE",
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(case)
    db.commit()

    # Send manual reminder
    rem_res = CaseLifecycleService.send_manual_reminder(
        db=db,
        case=case,
        actor_id=admin_id,
        reminder_type="CHECKLIST_OUTSTANDING",
        recipient_role="CLIENT",
        custom_message="Please upload your updated degree transcripts by Friday.",
    )
    assert rem_res["reminder_type"] == "CHECKLIST_OUTSTANDING"
    assert rem_res["recipient_role"] == "CLIENT"

    # Send manual acknowledgement
    ack_res = CaseLifecycleService.send_manual_acknowledgement(
        db=db,
        case=case,
        actor_id=admin_id,
        acknowledgement_type="RECEIPT",
        notes="Acknowledged receipt of bank verification letter.",
    )
    assert ack_res["acknowledgement_type"] == "RECEIPT"


def test_api_firm_config_and_case_gate_endpoints(client: TestClient, db: Session):
    """Verifies the REST API endpoints for firm configuration and case approval gates."""
    from backend.app.main import app

    fixtures = _setup_firm_test_fixtures(db)
    org = fixtures["org"]
    admin = fixtures["admin"]
    client_profile = fixtures["client"]

    auth = AuthContext(
        user_id=admin.id,
        organization_id=org.id,
        email=admin.email,
        roles=(RoleCode.ORGANIZATION_ADMIN, RoleCode.MASTER_ADMIN),
    )
    app.dependency_overrides[get_auth_context] = lambda: auth

    # 1. GET /api/v1/firm-config
    res = client.get("/api/v1/firm-config")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "roles" in data["domains"]
    assert "checklist_versions" in data["domains"]

    # 2. PUT /api/v1/firm-config/inactivity_policy
    put_res = client.put(
        "/api/v1/firm-config/inactivity_policy",
        json={
            "config_data": {"warning_days": 21, "auto_hold_days": 45},
            "reason": "Adjusting inactivity policy for busy spring consultation cycle",
        },
    )
    assert put_res.status_code == 200, put_res.text
    put_data = put_res.json()
    assert put_data["version"] == 2

    # 3. GET /api/v1/firm-config/audit-history
    hist_res = client.get("/api/v1/firm-config/audit-history")
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1

    # 4. POST /api/v1/cases (create case with Phase 9 pinning)
    case_res = client.post(
        "/api/v1/cases",
        json={
            "client_id": str(client_profile.id),
            "case_number": f"API-{uuid.uuid4().hex[:4].upper()}",
            "title": "API Test Retained Case",
            "jurisdiction": "USA",
            "visa_category": "L-1A",
            "client_engagement_type": "RETAINED_CLIENT",
            "is_retained": True,
        },
    )
    assert case_res.status_code == 201, case_res.text
    case_data = case_res.json()
    case_id = case_data["id"]
    assert case_data["firm_config_version"] == 2
    assert case_data["preparation_status"] == "CLEARANCE_PENDING"

    # 5. POST /api/v1/cases/{case_id}/tripartite-authorization
    gate_res = client.post(
        f"/api/v1/cases/{case_id}/tripartite-authorization",
        json={
            "gate_type": "manager_authorization",
            "authorized": True,
            "notes": "Manager confirmed team capacity via API",
        },
    )
    assert gate_res.status_code == 200
    assert gate_res.json()["substantive_authorizations"]["manager_authorization"]["cleared"] is True

    # 6. POST /api/v1/cases/{case_id}/send-reminder
    rem_res = client.post(
        f"/api/v1/cases/{case_id}/send-reminder",
        json={
            "reminder_type": "GENERAL",
            "recipient_role": "CLIENT",
            "custom_message": "Welcome to Veritas Law!",
        },
    )
    assert rem_res.status_code == 200
    assert rem_res.json()["success"] is True

    # 7. POST /api/v1/cases/{case_id}/send-acknowledgement
    ack_res = client.post(
        f"/api/v1/cases/{case_id}/send-acknowledgement",
        json={
            "acknowledgement_type": "GATE_CLEARED",
            "notes": "Acknowledged manager clearance",
        },
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["success"] is True

    # 8. POST /api/v1/cases/{case_id}/progressive-review with default outcome
    prog_res = client.post(
        f"/api/v1/cases/{case_id}/progressive-review",
        json={
            "stage": "officer_initial_review",
            "notes": "Officer completed documentary verification",
        },
    )
    assert prog_res.status_code == 200, prog_res.text
    prog_data = prog_res.json()
    assert prog_data["review_status"] == "OFFICER_INITIAL_REVIEW"
    assert prog_data["progressive_reviews"]["officer_initial_review"]["completed"] is True

    # 9. POST /api/v1/cases/{case_id}/submission-authorization with status and reason alias
    sub_res = client.post(
        f"/api/v1/cases/{case_id}/submission-authorization",
        json={
            "status": "HOLD_ACCOUNTS",
            "reason": "Retainer balance outstanding verification required",
        },
    )
    assert sub_res.status_code == 200, sub_res.text
    assert sub_res.json()["submission_authorization_status"] == "HELD_FOR_ACCOUNTS"

    # 10. POST /api/v1/cases/{case_id}/handover-authorization with status
    handover_res = client.post(
        f"/api/v1/cases/{case_id}/handover-authorization",
        json={
            "status": "AUTHORIZED_FOR_HANDOVER",
            "reason": "Client authorized for filing copy access",
        },
    )
    assert handover_res.status_code == 200, handover_res.text
    assert handover_res.json()["handover_authorization_status"] == "CLEARED_FOR_HANDOVER"

    # 11. POST /api/v1/cases/{case_id}/migrate-firm-config with justification reason
    mig_res = client.post(
        f"/api/v1/cases/{case_id}/migrate-firm-config",
        json={
            "reason": "Migrating matter to latest firm configuration rules version 2",
        },
    )
    assert mig_res.status_code == 200, mig_res.text
    mig_data = mig_res.json()
    assert mig_data["firm_config_version"] == 2
    assert mig_data["firm_config_update_available"] is False
