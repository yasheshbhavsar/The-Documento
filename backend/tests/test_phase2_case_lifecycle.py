"""Tests for Phase 2 — Domain Model and Decoupled Case Lifecycle Architecture.

Verifies:
1. Multi-dimensional state decoupling (Payment, Preparation, Operational Hold, Review, Outcome).
2. Preparation lifecycle transitions and guard enforcement (Paid status and Review approval required for Ready to Submit).
3. Holds preservation: placing a case on hold suspends prep but strictly preserves statutory deadlines and tasks.
4. Hold release and resolution history.
5. Case reassignment without stage disruption.
6. Case withdrawal and audit trail.
7. Reapplication provenance: brand new case created from CLEARANCE_PENDING, linking prior_case_id, without stale auto-reuse.
8. Package download event auditing.
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest

from backend.app.domain.case_lifecycle import (
    CaseLifecycleService,
    PaymentClearanceStatus,
    PreparationStatus,
    OperationalState,
    ReviewStatus,
    AdjudicationOutcome,
    CaseHoldType,
)
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseHoldHistory,
    CaseMilestone,
    CaseTask,
    ClientProfile,
    FilingPackage,
    ImmigrationCase,
    Organization,
    PackageDownloadEvent,
    User,
    now_utc,
)
from backend.app.security.auth import AuthContext
from backend.app.security.rbac import RoleCode
from backend.app.core.errors import ValidationError, ConflictError


def _setup_org_and_users(db):
    org = Organization(name="Veritas Immigration Chambers", slug=f"veritas-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    attorney = User(
        email=f"attorney-{uuid.uuid4().hex[:6]}@veritas.com",
        full_name="Lead Attorney Vance",
        status="active",
    )
    caseworker = User(
        email=f"cw-{uuid.uuid4().hex[:6]}@veritas.com",
        full_name="Caseworker Morgan",
        status="active",
    )
    client_user = User(
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Applicant Elena Rostova",
        status="active",
    )
    db.add_all([attorney, caseworker, client_user])
    db.flush()

    client_profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Elena",
        last_name="Rostova",
        email=client_user.email,
        nationality="UKR",
    )
    db.add(client_profile)
    db.flush()

    return org, attorney, caseworker, client_profile


def test_case_lifecycle_preparation_guards(db):
    org, attorney, caseworker, client = _setup_org_and_users(db)
    now = now_utc()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client.id,
        case_number=f"EB1A-{uuid.uuid4().hex[:6]}",
        title="Elena Rostova EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="inquiry",
        payment_clearance_status=PaymentClearanceStatus.PENDING,
        preparation_status=PreparationStatus.CLEARANCE_PENDING,
        operational_state=OperationalState.ACTIVE,
        review_status=ReviewStatus.NOT_STARTED,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.commit()

    attorney_ctx = AuthContext(
        user_id=attorney.id,
        organization_id=org.id,
        email="attorney@test.com",
        roles=(RoleCode.SENIOR_REVIEWER.value,),
    )
    cw_ctx = AuthContext(
        user_id=caseworker.id,
        organization_id=org.id,
        email="caseworker@test.com",
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    # 1. Authorize preparation
    case = CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.AUTHORIZED_FOR_PREPARATION,
        ctx=attorney_ctx,
    )
    assert case.preparation_status == PreparationStatus.AUTHORIZED_FOR_PREPARATION
    assert case.status == "intake"

    # 2. Start preparation
    case = CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.PREPARATION_IN_PROGRESS,
        ctx=cw_ctx,
    )
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS
    assert case.status == "processing"

    # 3. Move to final review
    case = CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.READY_FOR_FINAL_REVIEW,
        ctx=cw_ctx,
    )
    assert case.preparation_status == PreparationStatus.READY_FOR_FINAL_REVIEW
    assert case.status == "ready_for_approval"

    # 4. Attempt transition to READY_TO_SUBMIT without review approval -> MUST FAIL
    with pytest.raises(ValidationError, match="Lead attorney review approval is strictly required"):
        CaseLifecycleService.transition_preparation_status(
            db=db,
            case=case,
            target_status=PreparationStatus.READY_TO_SUBMIT,
            ctx=attorney_ctx,
        )

    # Set review approved
    case.review_status = ReviewStatus.APPROVED
    db.commit()

    # 5. Attempt transition to READY_TO_SUBMIT with PENDING payment -> MUST FAIL
    with pytest.raises(ValidationError, match="Case must be fully PAID"):
        CaseLifecycleService.transition_preparation_status(
            db=db,
            case=case,
            target_status=PreparationStatus.READY_TO_SUBMIT,
            ctx=attorney_ctx,
        )

    # Set payment cleared to PAID
    CaseLifecycleService.update_payment_clearance(
        db=db,
        case=case,
        new_status=PaymentClearanceStatus.PAID,
        actor_id=attorney.id,
    )
    assert case.payment_clearance_status == PaymentClearanceStatus.PAID

    # 6. Now transition to READY_TO_SUBMIT succeeds
    case = CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.READY_TO_SUBMIT,
        ctx=attorney_ctx,
    )
    assert case.preparation_status == PreparationStatus.READY_TO_SUBMIT
    assert case.status == "approved_for_submission"

    # 7. Transition to SUBMITTED
    case = CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=PreparationStatus.SUBMITTED,
        ctx=attorney_ctx,
    )
    assert case.preparation_status == PreparationStatus.SUBMITTED
    assert case.outcome_status == AdjudicationOutcome.PENDING_ADJUDICATION
    assert case.status == "submitted"


def test_holds_preserve_deadlines_and_milestones(db):
    org, attorney, caseworker, client = _setup_org_and_users(db)
    now = now_utc()
    target_statutory_deadline = now + timedelta(days=30)
    target_task_deadline = now + timedelta(days=14)

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client.id,
        case_number=f"NIW-{uuid.uuid4().hex[:6]}",
        title="Hold Test Petition",
        jurisdiction="US",
        visa_category="EB-2 NIW",
        status="processing",
        payment_clearance_status=PaymentClearanceStatus.PARTIALLY_PAID,
        preparation_status=PreparationStatus.PREPARATION_IN_PROGRESS,
        operational_state=OperationalState.ACTIVE,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.flush()

    # Statutory milestone with hard deadline
    milestone = CaseMilestone(
        organization_id=org.id,
        case_id=case.id,
        title="USCIS RFE Statutory Window",
        stage="processing",
        target_date=target_statutory_deadline,
        status="pending",
        created_at=now,
    )
    # Operational task with due date
    task = CaseTask(
        organization_id=org.id,
        case_id=case.id,
        title="Obtain Certified Expert Letter",
        due_date=target_task_deadline,
        priority="critical",
        status="pending",
        is_completed=False,
        created_at=now,
        updated_at=now,
    )
    db.add_all([milestone, task])
    db.commit()

    # 1. Place case on hold
    hold_record = CaseLifecycleService.apply_hold(
        db=db,
        case=case,
        hold_type=CaseHoldType.CLIENT_REQUEST,
        reason="Client traveling internationally; temporarily paused communications.",
        actor_id=attorney.id,
    )

    assert case.operational_state == OperationalState.ON_HOLD
    assert "[CLIENT_REQUEST]" in case.hold_reason
    assert case.hold_applied_at is not None
    assert case.hold_applied_by_id == attorney.id

    # VERIFY STATUTORY GUARANTEE: Deadlines are strictly preserved and un-erased
    db.refresh(milestone)
    db.refresh(task)
    assert milestone.target_date.replace(tzinfo=None) == target_statutory_deadline.replace(tzinfo=None)
    assert task.due_date.replace(tzinfo=None) == target_task_deadline.replace(tzinfo=None)

    # 2. Attempting to transition preparation while on hold MUST FAIL
    attorney_ctx = AuthContext(
        user_id=attorney.id,
        organization_id=org.id,
        email="attorney@test.com",
        roles=(RoleCode.SENIOR_REVIEWER.value,),
    )
    with pytest.raises(ValidationError, match="Cannot advance preparation status while case is ON_HOLD"):
        CaseLifecycleService.transition_preparation_status(
            db=db,
            case=case,
            target_status=PreparationStatus.READY_FOR_FINAL_REVIEW,
            ctx=attorney_ctx,
        )

    # 3. Release hold
    released_case = CaseLifecycleService.release_hold(
        db=db,
        case=case,
        resolution_notes="Client returned from travel; passport received.",
        actor_id=attorney.id,
    )
    assert released_case.operational_state == OperationalState.ACTIVE
    assert released_case.hold_reason is None
    assert released_case.hold_applied_at is None

    # Verify hold history updated
    db.refresh(hold_record)
    assert hold_record.released_at is not None
    assert hold_record.released_by_id == attorney.id
    assert "Client returned from travel" in hold_record.resolution_notes


def test_reassignment_preserves_case_state(db):
    org, attorney, caseworker, client = _setup_org_and_users(db)
    now = now_utc()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client.id,
        case_number=f"O1A-{uuid.uuid4().hex[:6]}",
        title="Reassignment Test",
        jurisdiction="US",
        visa_category="O-1A",
        status="processing",
        preparation_status=PreparationStatus.PREPARATION_IN_PROGRESS,
        payment_clearance_status=PaymentClearanceStatus.PARTIALLY_PAID,
        operational_state=OperationalState.ACTIVE,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.commit()

    # Initial assignment
    assignment = CaseLifecycleService.reassign_owner(
        db=db,
        case=case,
        new_user_id=caseworker.id,
        role_in_case="case_manager",
        actor_id=attorney.id,
    )
    assert assignment.user_id == caseworker.id
    assert assignment.role_in_case == "case_manager"
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS

    # Reassign to attorney
    updated_assignment = CaseLifecycleService.reassign_owner(
        db=db,
        case=case,
        new_user_id=attorney.id,
        role_in_case="case_manager",
        actor_id=attorney.id,
    )
    assert updated_assignment.user_id == attorney.id
    # Ensure stage did not reset
    assert case.preparation_status == PreparationStatus.PREPARATION_IN_PROGRESS


def test_reapplication_provenance_and_no_auto_reuse(db):
    org, attorney, caseworker, client = _setup_org_and_users(db)
    now = now_utc()

    # Prior refused case
    prior_case = ImmigrationCase(
        organization_id=org.id,
        client_id=client.id,
        case_number="USCIS-EB1A-2025-001",
        title="Initial EB-1A Petition (Refused)",
        jurisdiction="US",
        visa_category="EB-1A",
        status="closed",
        preparation_status=PreparationStatus.SUBMITTED,
        operational_state=OperationalState.COMPLETED,
        outcome_status=AdjudicationOutcome.REFUSED,
        created_at=now - timedelta(days=120),
        updated_at=now - timedelta(days=10),
    )
    db.add(prior_case)
    db.commit()

    new_number = "USCIS-EB1A-2026-001-R1"
    reapplication = CaseLifecycleService.create_reapplication(
        db=db,
        prior_case=prior_case,
        new_case_number=new_number,
        reason="Prior petition denied on Kazarian final merits. Refiled with novel major awards and patent licensing revenue.",
        actor_id=attorney.id,
    )

    # Invariants verification
    assert reapplication.id != prior_case.id
    assert reapplication.prior_case_id == prior_case.id
    assert reapplication.case_number == new_number
    # Strictly starts from scratch
    assert reapplication.preparation_status == PreparationStatus.CLEARANCE_PENDING
    assert reapplication.payment_clearance_status == PaymentClearanceStatus.PENDING
    assert reapplication.operational_state == OperationalState.ACTIVE
    assert reapplication.review_status == ReviewStatus.NOT_STARTED
    assert reapplication.outcome_status is None

    # Check audit trail provenance
    audit = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.object_id == str(reapplication.id),
            AuditEvent.action == "case.reapplication_created",
        )
        .first()
    )
    assert audit is not None
    assert audit.metadata_json["prior_case_id"] == str(prior_case.id)
    assert audit.metadata_json["auto_reused_old_answers"] is False
    assert audit.metadata_json["fresh_verification_mandated"] is True


def test_package_download_event_logging(db):
    org, attorney, caseworker, client = _setup_org_and_users(db)
    now = now_utc()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client.id,
        case_number=f"PKG-{uuid.uuid4().hex[:6]}",
        title="Package Download Test",
        jurisdiction="US",
        visa_category="EB-1A",
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.flush()

    package = FilingPackage(
        organization_id=org.id,
        case_id=case.id,
        name="Official Filing Binder",
        package_hash="a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
        status="approved",
        manifest_json={"items_count": 8, "external_items_count": 7},
        created_at=now,
        updated_at=now,
    )
    db.add(package)
    db.commit()

    # Record download event
    event = CaseLifecycleService.record_download_event(
        db=db,
        package=package,
        user=attorney,
        ip_address="198.51.100.42",
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    )

    assert event.package_id == package.id
    assert event.downloaded_by_user_id == attorney.id
    assert event.package_hash_at_download == package.package_hash
    assert event.ip_address == "198.51.100.42"

    # Audit event verification
    audit = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.object_id == str(package.id),
            AuditEvent.action == "filing_package.downloaded",
        )
        .first()
    )
    assert audit is not None
    assert audit.metadata_json["package_hash"] == package.package_hash


def test_api_lifecycle_endpoints(client, db):
    org, attorney, caseworker, client_profile = _setup_org_and_users(db)
    now = now_utc()

    headers_admin = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(attorney.id),
        "X-User-Role": RoleCode.COMPANY_ADMIN.value,
    }

    # 1. Create case
    case_number = f"API-CASE-{uuid.uuid4().hex[:6]}"
    create_resp = client.post(
        "/api/v1/cases",
        json={
            "client_id": str(client_profile.id),
            "case_number": case_number,
            "title": "API Lifecycle Test Petition",
            "jurisdiction": "US",
            "visa_category": "EB-1A",
        },
        headers=headers_admin,
    )
    assert create_resp.status_code == 201
    case_data = create_resp.json()
    case_id = case_data["id"]

    # Verify default decoupled fields
    assert case_data["payment_clearance_status"] == "PENDING"
    assert case_data["preparation_status"] == "CLEARANCE_PENDING"
    assert case_data["operational_state"] == "ACTIVE"

    # 2. Update payment clearance
    pay_resp = client.put(
        f"/api/v1/cases/{case_id}/lifecycle/payment-clearance",
        json={"payment_status": "PARTIALLY_PAID", "notes": "Initial retainer cleared via Stripe"},
        headers=headers_admin,
    )
    assert pay_resp.status_code == 200
    assert pay_resp.json()["payment_clearance_status"] == "PARTIALLY_PAID"

    # 3. Transition preparation status
    prep_resp = client.post(
        f"/api/v1/cases/{case_id}/lifecycle/preparation",
        json={"target_status": "AUTHORIZED_FOR_PREPARATION", "notes": "Conflict check passed"},
        headers=headers_admin,
    )
    assert prep_resp.status_code == 200
    assert prep_resp.json()["preparation_status"] == "AUTHORIZED_FOR_PREPARATION"

    # 4. Place on hold
    hold_resp = client.post(
        f"/api/v1/cases/{case_id}/lifecycle/hold",
        json={
            "hold_type": "administrative",
            "reason": "Awaiting original foreign birth certificate courier delivery",
        },
        headers=headers_admin,
    )
    assert hold_resp.status_code == 200
    assert hold_resp.json()["operational_state"] == "ON_HOLD"
    assert "[ADMINISTRATIVE]" in hold_resp.json()["hold_reason"]

    # 5. List hold history
    holds_list_resp = client.get(f"/api/v1/cases/{case_id}/lifecycle/holds", headers=headers_admin)
    assert holds_list_resp.status_code == 200
    holds = holds_list_resp.json()
    assert len(holds) == 1
    assert holds[0]["hold_type"] == "administrative"

    # 6. Release hold
    release_resp = client.post(
        f"/api/v1/cases/{case_id}/lifecycle/release-hold",
        json={"resolution_notes": "Original certificate received and verified."},
        headers=headers_admin,
    )
    assert release_resp.status_code == 200
    assert release_resp.json()["operational_state"] == "ACTIVE"
    assert release_resp.json()["hold_reason"] is None

    # 7. Reassign owner
    reassign_resp = client.post(
        f"/api/v1/cases/{case_id}/lifecycle/reassign",
        json={"new_user_id": str(caseworker.id), "role_in_case": "case_manager"},
        headers=headers_admin,
    )
    assert reassign_resp.status_code == 200

    # 8. Withdraw case
    withdraw_resp = client.post(
        f"/api/v1/cases/{case_id}/lifecycle/withdraw",
        json={"reason": "Client accepted non-US academic appointment abroad."},
        headers=headers_admin,
    )
    assert withdraw_resp.status_code == 200
    assert withdraw_resp.json()["operational_state"] == "WITHDRAWN"

    # 9. Reapplication from withdrawn case
    reapply_resp = client.post(
        f"/api/v1/cases/{case_id}/lifecycle/reapply",
        json={
            "new_case_number": f"{case_number}-R1",
            "reason": "Client renewed US endeavor with new research sponsor.",
            "title": "Elena Rostova EB-1A Reapplication",
        },
        headers=headers_admin,
    )
    assert reapply_resp.status_code == 200
    new_case_data = reapply_resp.json()
    assert new_case_data["prior_case_id"] == case_id
    assert new_case_data["preparation_status"] == "CLEARANCE_PENDING"
    assert new_case_data["payment_clearance_status"] == "PENDING"
