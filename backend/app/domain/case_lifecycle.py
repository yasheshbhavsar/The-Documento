"""Phase 2 — Domain Model and Decoupled Case Lifecycle Engine.

Strictly enforces multi-dimensional state decoupling:
1. Commercial / Payment Clearance (Paid / Pending / Partially Paid)
2. Preparation & Drafting Progress (Clearance Pending -> Authorized -> In Progress -> Final Review -> Ready to Submit -> Submitted)
3. Operational State & Custody (Active / On Hold / Withdrawn / Completed / Archived)
4. Legal Review & Authorization (Not Started / Internal Review / Senior Review / Client Confirmed / Approved)
5. Adjudication Outcome (Pending / RFE / Approved / Refused / Appealed)

Key Invariants:
- Handover and submission authorization strictly requires PAID status (or approved fee waiver) AND Lead Attorney review approval.
- Holds suspend operational work but NEVER erase or pause statutory deadlines or milestones.
- Reapplications start fresh (CLEARANCE_PENDING) and link historical filings/engagements, but strictly prohibit automatic reuse of unverified old answers/documents.
"""

import uuid
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from backend.app.core.errors import (
    ConflictError,
    EntityNotFoundError,
    PermissionDeniedError,
    TenantIsolationError,
    ValidationError,
)
from backend.app.domain.models import (
    AuditEvent,
    CaseAIFinding,
    CaseAssignment,
    CaseHoldHistory,
    CaseInterimReport,
    CaseMilestone,
    CaseTask,
    Document,
    FilingPackage,
    ImmigrationCase,
    Organization,
    PackageDownloadEvent,
    User,
    now_utc,
)
from backend.app.security.auth import AuthContext
from backend.app.security.rbac import RoleCode


# ---------------------------------------------------------------------------
# Decoupled Lifecycle State Enums
# ---------------------------------------------------------------------------

class PaymentClearanceStatus(StrEnum):
    PENDING = "PENDING"                  # No retainer/fees verified
    PARTIALLY_PAID = "PARTIALLY_PAID"    # Initial retainer cleared; preparation permitted
    PAID = "PAID"                        # Fully paid or fee waiver granted; submission permitted


class PreparationStatus(StrEnum):
    CONSULTATION_ONLY = "CONSULTATION_ONLY"                    # Preliminary consultation only (not retained)
    PRELIMINARY_ASSESSMENT = "PRELIMINARY_ASSESSMENT"          # Initial assessment (not retained)
    CLEARANCE_PENDING = "CLEARANCE_PENDING"                    # Retained; conflict check & tripartite onboarding clearance pending
    AUTHORIZED_FOR_PREPARATION = "AUTHORIZED_FOR_PREPARATION"  # Tripartite cleared to initiate casework
    PREPARATION_IN_PROGRESS = "PREPARATION_IN_PROGRESS"        # Active drafting, questionnaire & evidence assembly
    READY_FOR_FINAL_REVIEW = "READY_FOR_FINAL_REVIEW"          # Forms complete, readiness checklist passed
    READY_TO_SUBMIT = "READY_TO_SUBMIT"                        # All approvals granted, package locked with SHA-256 root hash
    SUBMITTED = "SUBMITTED"                                    # Official filing dispatched to government agency


class OperationalState(StrEnum):
    ACTIVE = "ACTIVE"          # Standard day-to-day casework
    ON_HOLD = "ON_HOLD"        # Case suspended (Statutory deadlines strictly remain active)
    WITHDRAWN = "WITHDRAWN"    # Client or counsel terminated representation
    COMPLETED = "COMPLETED"    # Matter successfully concluded / adjudicated
    ARCHIVED = "ARCHIVED"      # Long-term retention / post-completion


class ReviewStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    INTERNAL_REVIEW = "INTERNAL_REVIEW"          # Caseworker / paralegal review
    OFFICER_INITIAL_REVIEW = "OFFICER_INITIAL_REVIEW" # Officer initial completeness & evidence check
    SENIOR_REVIEW = "SENIOR_REVIEW"              # Senior review / legal consistency
    LAWYER_REVIEW = "LAWYER_REVIEW"              # Supervising attorney legal merits review
    CLIENT_CONFIRMATION = "CLIENT_CONFIRMATION"  # Retained applicant review of draft forms
    APPROVED = "APPROVED"                        # Formally authorized for filing
    CHANGES_REQUESTED = "CHANGES_REQUESTED"      # Returned for edits/corrections


class AdjudicationOutcome(StrEnum):
    PENDING_ADJUDICATION = "PENDING_ADJUDICATION"
    REQUEST_FOR_EVIDENCE = "REQUEST_FOR_EVIDENCE"
    APPROVED = "APPROVED"
    REFUSED = "REFUSED"
    APPEALED = "APPEALED"
    WITHDRAWN = "WITHDRAWN"


class SubmissionAuthorizationStatus(StrEnum):
    UNAUTHORIZED = "UNAUTHORIZED"
    PENDING_LAWYER_SIGNOFF = "PENDING_LAWYER_SIGNOFF"
    AUTHORIZED_TO_FILE = "AUTHORIZED_TO_FILE"
    HELD_FOR_ACCOUNTS = "HELD_FOR_ACCOUNTS"
    HELD_FOR_COUNSELLOR = "HELD_FOR_COUNSELLOR"
    HELD_FOR_CLIENT_DECISION = "HELD_FOR_CLIENT_DECISION"
    NOT_REQUESTED = "UNAUTHORIZED"
    APPROVED = "AUTHORIZED_TO_FILE"
    READY_FOR_SUBMISSION = "AUTHORIZED_TO_FILE"


class HandoverAuthorizationStatus(StrEnum):
    RESTRICTED = "RESTRICTED"
    CLEARED_FOR_HANDOVER = "CLEARED_FOR_HANDOVER"
    HANDED_OVER = "HANDED_OVER"
    NOT_REQUESTED = "RESTRICTED"
    AUTHORIZED_FOR_HANDOVER = "CLEARED_FOR_HANDOVER"


class ClientEngagementType(StrEnum):
    CONSULTATION = "consultation"
    PRELIMINARY_ASSESSMENT = "preliminary_assessment"
    RETAINED = "retained"
    CONSULTATION_ONLY = "consultation"
    RETAINED_CLIENT = "retained"


class ProgressiveReviewStage(StrEnum):
    OFFICER_INITIAL_REVIEW = "officer_initial_review"
    SENIOR_REVIEW = "senior_review"
    LAWYER_REVIEW = "lawyer_review"


class CaseHoldType(StrEnum):
    CLIENT_REQUEST = "client_request"
    BILLING_ARREARS = "billing_arrears"
    PENDING_OFFICIAL_RECORD = "pending_official_record"
    ADMINISTRATIVE = "administrative"
    ACCOUNTS_HOLD = "accounts_hold"
    COUNSELLOR_HOLD = "counsellor_hold"
    CLIENT_DECISION_HOLD = "client_decision_hold"


# ---------------------------------------------------------------------------
# State Transition Definitions & Role Permissions
# ---------------------------------------------------------------------------

ALLOWED_PREPARATION_TRANSITIONS: dict[str, set[str]] = {
    PreparationStatus.CONSULTATION_ONLY: {
        PreparationStatus.PRELIMINARY_ASSESSMENT,
        PreparationStatus.CLEARANCE_PENDING,
    },
    PreparationStatus.PRELIMINARY_ASSESSMENT: {
        PreparationStatus.CLEARANCE_PENDING,
    },
    PreparationStatus.CLEARANCE_PENDING: {
        PreparationStatus.AUTHORIZED_FOR_PREPARATION,
    },
    PreparationStatus.AUTHORIZED_FOR_PREPARATION: {
        PreparationStatus.PREPARATION_IN_PROGRESS,
    },
    PreparationStatus.PREPARATION_IN_PROGRESS: {
        PreparationStatus.READY_FOR_FINAL_REVIEW,
    },
    PreparationStatus.READY_FOR_FINAL_REVIEW: {
        PreparationStatus.PREPARATION_IN_PROGRESS,  # If returned for corrections
        PreparationStatus.READY_TO_SUBMIT,
    },
    PreparationStatus.READY_TO_SUBMIT: {
        PreparationStatus.READY_FOR_FINAL_REVIEW,    # If amended before dispatch
        PreparationStatus.SUBMITTED,
    },
    PreparationStatus.SUBMITTED: {
        PreparationStatus.PREPARATION_IN_PROGRESS,  # In case of RFE/amendment
    },
}

STAFF_ROLES = {
    RoleCode.MASTER_ADMIN.value,
    RoleCode.COMPANY_ADMIN.value,
    RoleCode.SENIOR_REVIEWER.value,
    RoleCode.CASE_MANAGER.value,
    RoleCode.CASE_WORKER.value,
    RoleCode.ORGANIZATION_ADMIN.value,
}

ELEVATED_ROLES = {
    RoleCode.MASTER_ADMIN.value,
    RoleCode.COMPANY_ADMIN.value,
    RoleCode.SENIOR_REVIEWER.value,
    RoleCode.ORGANIZATION_ADMIN.value,
}


def sync_legacy_case_status(case: ImmigrationCase) -> None:
    """
    Synchronizes the legacy single-string `case.status` with the decoupled
    multi-dimensional state to maintain backwards compatibility for existing
    frontend views, reports, and legacy test assertions.
    """
    if case.operational_state == OperationalState.WITHDRAWN:
        case.status = "closed"
    elif case.operational_state == OperationalState.COMPLETED:
        case.status = "closed"
    elif case.operational_state == OperationalState.ARCHIVED:
        case.status = "archived"
    elif case.operational_state == OperationalState.ON_HOLD:
        # Maintain underlying preparation status while on hold
        pass
    else:
        # ACTIVE operational state mapping
        mapping = {
            PreparationStatus.CLEARANCE_PENDING.value: "inquiry",
            PreparationStatus.AUTHORIZED_FOR_PREPARATION.value: "intake",
            PreparationStatus.PREPARATION_IN_PROGRESS.value: "processing",
            PreparationStatus.READY_FOR_FINAL_REVIEW.value: "ready_for_approval",
            PreparationStatus.READY_TO_SUBMIT.value: "approved_for_submission",
            PreparationStatus.SUBMITTED.value: "submitted",
        }
        case.status = mapping.get(case.preparation_status, case.status)


# ---------------------------------------------------------------------------
# Core Lifecycle Service
# ---------------------------------------------------------------------------

class CaseLifecycleService:
    @staticmethod
    def transition_preparation_status(
        db: Session,
        case: ImmigrationCase,
        target_status: str | PreparationStatus,
        ctx: AuthContext,
        notes: Optional[str] = None,
        is_pathway_override: bool = False,
    ) -> ImmigrationCase:
        """
        Transitions a case through its preparation lifecycle stages with server-side guard enforcement.
        """
        if ctx.is_retained_client():
            raise PermissionDeniedError("Retained clients and applicants cannot transition case preparation stages")

        curr = case.preparation_status
        tgt = str(target_status).upper().strip()

        if curr == tgt:
            return case

        # Operational state check: Cannot prepare cases that are on hold or withdrawn
        if case.operational_state == OperationalState.ON_HOLD:
            raise ValidationError(
                f"Cannot advance preparation status while case is ON_HOLD. Hold reason: {case.hold_reason}"
            )
        if case.operational_state in (OperationalState.WITHDRAWN, OperationalState.COMPLETED, OperationalState.ARCHIVED):
            raise ValidationError(
                f"Cannot advance preparation status for a case with operational state '{case.operational_state}'."
            )

        # Phase 9 Guard: Initial consultation and preliminary assessment remain strictly separate from retained preparation
        substantive_stages = {
            PreparationStatus.AUTHORIZED_FOR_PREPARATION.value,
            PreparationStatus.PREPARATION_IN_PROGRESS.value,
            PreparationStatus.READY_FOR_FINAL_REVIEW.value,
            PreparationStatus.READY_TO_SUBMIT.value,
            PreparationStatus.SUBMITTED.value,
        }
        if tgt in substantive_stages:
            is_retained = getattr(case, "is_retained", True)
            engagement_type = getattr(case, "client_engagement_type", "retained")
            if (not is_retained or engagement_type in ("consultation", "preliminary_assessment")) and not is_pathway_override:
                raise ValidationError(
                    f"Cannot initiate substantive casework preparation for non-retained prospect in '{engagement_type}'. "
                    "Client must execute retainer agreement and clear onboarding gates."
                )

        # Phase 9 Guard: Substantive preparation starts only after configured manager/senior authorization,
        # accounts clearance, and original counsellor confirmation.
        substantive_active_stages = {
            PreparationStatus.PREPARATION_IN_PROGRESS.value,
            PreparationStatus.READY_FOR_FINAL_REVIEW.value,
            PreparationStatus.READY_TO_SUBMIT.value,
            PreparationStatus.SUBMITTED.value,
        }
        if tgt in substantive_active_stages:
            auths = getattr(case, "substantive_authorizations", None)
            if auths and not is_pathway_override:
                mgr_auth = auths.get("manager_authorization", {}).get("authorized", False) or auths.get("manager_authorization", {}).get("cleared", False)
                acct_clear = auths.get("accounts_clearance", {}).get("cleared", False) or auths.get("accounts_clearance", {}).get("authorized", False)
                couns_conf = auths.get("counsellor_confirmation", {}).get("confirmed", False) or auths.get("counsellor_confirmation", {}).get("cleared", False)

                missing = []
                if not mgr_auth:
                    missing.append("manager/senior authorization")
                if not acct_clear:
                    missing.append("accounts clearance")
                if not couns_conf:
                    missing.append("original counsellor confirmation")

                if missing:
                    raise ValidationError(
                        f"Substantive preparation blocked: missing required tripartite authorizations: {', '.join(missing)}."
                    )

        # Transition validation
        allowed = ALLOWED_PREPARATION_TRANSITIONS.get(curr, set())
        if not is_pathway_override and tgt not in allowed:
            raise ValidationError(
                f"Invalid preparation lifecycle transition from '{curr}' to '{tgt}'. Allowed next stages: {sorted(list(allowed))}"
            )

        # 1. Guard: Transition to AUTHORIZED_FOR_PREPARATION requires elevated role
        if tgt == PreparationStatus.AUTHORIZED_FOR_PREPARATION:
            if not (any(r in ELEVATED_ROLES for r in ctx.roles) or ctx.has_permission("readiness:approve")):
                raise PermissionDeniedError("Only senior reviewers, authorized professionals, or administrators can authorize case preparation")
            if getattr(case, "substantive_authorizations", None):
                auths = dict(case.substantive_authorizations)
                mgr = dict(auths.get("manager_authorization", {}))
                mgr["authorized"] = True
                mgr["cleared"] = True
                mgr["authorized_at"] = now_utc().isoformat()
                mgr["actor_id"] = str(ctx.user_id) if ctx.user_id else None
                mgr["actor_name"] = "Authorized Manager"
                auths["manager_authorization"] = mgr
                case.substantive_authorizations = auths

        # 2. Guard: Transition to READY_TO_SUBMIT requires:
        #    a) review_status == APPROVED
        #    b) payment_clearance_status == PAID (or partner fee waiver override)
        #    c) submission authorization not held for accounts/counsellor/client decision
        if tgt == PreparationStatus.READY_TO_SUBMIT:
            if not (any(r in ELEVATED_ROLES for r in ctx.roles) or ctx.has_permission("readiness:approve")):
                raise PermissionDeniedError("Only senior reviewers, authorized professionals, or administrators can authorize final package readiness for submission")

            if case.review_status != ReviewStatus.APPROVED:
                raise ValidationError(
                    f"Submission authorization blocked: case review status is '{case.review_status}'. "
                    "Lead attorney review approval is strictly required before a case can be marked READY_TO_SUBMIT."
                )

            if case.payment_clearance_status != PaymentClearanceStatus.PAID and not is_pathway_override:
                raise ValidationError(
                    f"Submission authorization blocked: payment status is '{case.payment_clearance_status}'. "
                    "Case must be fully PAID or possess an authorized partner fee waiver."
                )

            sub_auth_status = getattr(case, "submission_authorization_status", "UNAUTHORIZED")
            if sub_auth_status in (
                SubmissionAuthorizationStatus.HELD_FOR_ACCOUNTS.value,
                SubmissionAuthorizationStatus.HELD_FOR_COUNSELLOR.value,
                SubmissionAuthorizationStatus.HELD_FOR_CLIENT_DECISION.value,
            ):
                raise ValidationError(
                    f"Submission readiness blocked: case submission authorization is currently on hold ({sub_auth_status})."
                )

        # 3. Guard: Transition to SUBMITTED
        if tgt == PreparationStatus.SUBMITTED:
            if not any(r in STAFF_ROLES for r in ctx.roles):
                raise PermissionDeniedError("Staff permissions required to record a government filing submission")
            if case.preparation_status != PreparationStatus.READY_TO_SUBMIT and not is_pathway_override:
                raise ValidationError("Case must be in READY_TO_SUBMIT status before it can be marked as SUBMITTED")

            sub_auth_status = getattr(case, "submission_authorization_status", "UNAUTHORIZED")
            if sub_auth_status in (
                SubmissionAuthorizationStatus.HELD_FOR_ACCOUNTS.value,
                SubmissionAuthorizationStatus.HELD_FOR_COUNSELLOR.value,
                SubmissionAuthorizationStatus.HELD_FOR_CLIENT_DECISION.value,
            ):
                raise ValidationError(
                    f"Submission hold active: case submission authorization is currently on hold ({sub_auth_status})."
                )

            case.outcome_status = AdjudicationOutcome.PENDING_ADJUDICATION

        old_prep = case.preparation_status
        case.preparation_status = tgt
        case.updated_at = now_utc()
        sync_legacy_case_status(case)

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=ctx.user_id,
            action="case.preparation_status_transitioned",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "from_status": old_prep,
                "to_status": tgt,
                "notes": notes,
                "is_pathway_override": is_pathway_override,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def apply_hold(
        db: Session,
        case: ImmigrationCase,
        hold_type: str | CaseHoldType,
        reason: str,
        actor_id: uuid.UUID,
    ) -> CaseHoldHistory:
        """
        Places a case on hold while preserving all statutory deadlines and tasks.
        Statutory guarantee: Deadlines are NEVER erased or delayed by an operational hold.
        """
        if case.operational_state == OperationalState.ON_HOLD:
            raise ConflictError("Case is already in ON_HOLD state.")
        if case.operational_state in (OperationalState.WITHDRAWN, OperationalState.COMPLETED, OperationalState.ARCHIVED):
            raise ValidationError(f"Cannot place case in ON_HOLD state when operational state is '{case.operational_state}'.")

        normalized_hold_type = str(hold_type).lower().strip()
        now = now_utc()

        # Update case state
        case.operational_state = OperationalState.ON_HOLD
        case.hold_reason = f"[{normalized_hold_type.upper()}] {reason}"
        case.hold_applied_at = now
        case.hold_applied_by_id = actor_id
        case.updated_at = now

        # Record hold history event
        hold_record = CaseHoldHistory(
            organization_id=case.organization_id,
            case_id=case.id,
            hold_type=normalized_hold_type,
            reason=reason,
            placed_by_id=actor_id,
            placed_at=now,
        )
        db.add(hold_record)

        # Generate Phase 4 Interim Package & OCR/Anomaly Report on Hold
        docs = db.query(Document).filter(Document.case_id == case.id, Document.is_purged.is_(False)).all()
        findings = db.query(CaseAIFinding).filter(CaseAIFinding.case_id == case.id).all()
        manifest_snapshot = {
            "case_number": case.case_number,
            "operational_state": case.operational_state,
            "document_count": len(docs),
            "documents": [
                {
                    "id": str(d.id),
                    "title": d.title,
                    "category": d.category,
                    "version": d.version,
                    "verification_status": d.verification_status,
                    "processing_status": d.processing_status,
                    "sha256_hash": d.sha256_hash,
                }
                for d in docs
            ],
        }
        ocr_summary = {
            "processed_count": sum(1 for d in docs if d.processing_status == "completed"),
            "ocr_applied_count": sum(1 for d in docs if d.ocr_applied),
            "total_pages": sum(d.page_count for d in docs),
        }
        anomaly_report = {
            "unresolved_anomalies_count": sum(1 for d in docs if getattr(d, "has_unresolved_anomaly", False)),
            "open_findings_count": len([f for f in findings if f.status in ("open", "flagged", "needs_review")]),
            "findings": [
                {
                    "id": str(f.id),
                    "finding_type": f.finding_type,
                    "severity": f.severity,
                    "status": f.status,
                }
                for f in findings
            ],
        }
        interim_report = CaseInterimReport(
            organization_id=case.organization_id,
            case_id=case.id,
            created_by_user_id=actor_id,
            trigger_action="hold_applied",
            report_title=f"Interim Case Report (Hold Applied: {reason})",
            manifest_snapshot_json=manifest_snapshot,
            ocr_summary_json=ocr_summary,
            anomaly_report_json=anomaly_report,
            created_at=now,
        )
        db.add(interim_report)

        # Audit event (emphasizes that statutory deadlines remain active)
        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.hold_applied",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "hold_type": normalized_hold_type,
                "reason": reason,
                "statutory_deadlines_erased": False,
                "statutory_deadlines_active": True,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        db.refresh(hold_record)
        return hold_record

    @staticmethod
    def release_hold(
        db: Session,
        case: ImmigrationCase,
        resolution_notes: str,
        actor_id: uuid.UUID,
    ) -> ImmigrationCase:
        """
        Releases an active hold, returning the case to ACTIVE operational state.
        """
        if case.operational_state != OperationalState.ON_HOLD:
            raise ValidationError("Case is not currently on hold.")

        now = now_utc()
        # Find latest open hold history record
        latest_hold = (
            db.query(CaseHoldHistory)
            .filter(
                CaseHoldHistory.case_id == case.id,
                CaseHoldHistory.released_at.is_(None),
            )
            .order_by(desc(CaseHoldHistory.placed_at))
            .first()
        )

        if latest_hold:
            latest_hold.released_by_id = actor_id
            latest_hold.released_at = now
            latest_hold.resolution_notes = resolution_notes

        prev_reason = case.hold_reason
        case.operational_state = OperationalState.ACTIVE
        case.hold_reason = None
        case.hold_applied_at = None
        case.hold_applied_by_id = None
        case.updated_at = now
        sync_legacy_case_status(case)

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.hold_released",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "previous_hold_reason": prev_reason,
                "resolution_notes": resolution_notes,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def reassign_owner(
        db: Session,
        case: ImmigrationCase,
        new_user_id: uuid.UUID,
        role_in_case: str,
        actor_id: uuid.UUID,
        notify_client: bool = False,
    ) -> CaseAssignment:
        """
        Reassigns lead attorney or case manager without modifying the preparation stage or deadlines.
        """
        # Verify target user exists and belongs to same organization
        target_user = (
            db.query(User)
            .filter(User.id == new_user_id, User.status == "active")
            .first()
        )
        if not target_user:
            raise EntityNotFoundError("Active User", str(new_user_id))

        # Check existing assignment for this role
        existing = (
            db.query(CaseAssignment)
            .filter(
                CaseAssignment.case_id == case.id,
                CaseAssignment.role_in_case == role_in_case,
            )
            .first()
        )

        old_user_id = str(existing.user_id) if existing else None
        if existing:
            existing.user_id = new_user_id
            existing.assigned_at = now_utc()
            assignment = existing
        else:
            assignment = CaseAssignment(
                case_id=case.id,
                user_id=new_user_id,
                role_in_case=role_in_case,
                assigned_at=now_utc(),
            )
            db.add(assignment)

        case.updated_at = now_utc()

        # Generate Phase 4 Interim Transfer Report on Reassignment
        reassign_now = now_utc()
        docs = db.query(Document).filter(Document.case_id == case.id, Document.is_purged.is_(False)).all()
        findings = db.query(CaseAIFinding).filter(CaseAIFinding.case_id == case.id).all()
        transfer_manifest = {
            "case_number": case.case_number,
            "operational_state": case.operational_state,
            "document_count": len(docs),
            "reassigned_to": target_user.full_name,
            "documents": [
                {
                    "id": str(d.id),
                    "title": d.title,
                    "category": d.category,
                    "version": d.version,
                    "verification_status": d.verification_status,
                    "processing_status": d.processing_status,
                }
                for d in docs
            ],
        }
        transfer_ocr = {
            "processed_count": sum(1 for d in docs if d.processing_status == "completed"),
            "ocr_applied_count": sum(1 for d in docs if d.ocr_applied),
        }
        transfer_anomalies = {
            "unresolved_anomalies_count": sum(1 for d in docs if getattr(d, "has_unresolved_anomaly", False)),
            "open_findings_count": len([f for f in findings if f.status in ("open", "flagged", "needs_review")]),
        }
        reassign_report = CaseInterimReport(
            organization_id=case.organization_id,
            case_id=case.id,
            created_by_user_id=actor_id,
            trigger_action="owner_reassigned",
            report_title=f"Interim Transfer Report (Reassigned to {target_user.full_name})",
            manifest_snapshot_json=transfer_manifest,
            ocr_summary_json=transfer_ocr,
            anomaly_report_json=transfer_anomalies,
            created_at=reassign_now,
        )
        db.add(reassign_report)

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.owner_reassigned",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "role_in_case": role_in_case,
                "previous_user_id": old_user_id,
                "new_user_id": str(new_user_id),
                "new_user_name": target_user.full_name,
                "client_notified": notify_client,
            },
        )
        db.add(audit)

        if notify_client and case.client and case.client.user_id:
            from backend.app.notifications.service import NotificationService
            NotificationService.create_notification(
                db=db,
                organization_id=case.organization_id,
                user_id=case.client.user_id,
                title="Case Officer Assigned",
                body=f"Your case officer for {case.case_number} has been updated to {target_user.full_name}.",
                notification_type="case_update",
                channel="in_app",
                metadata={"case_id": str(case.id), "assigned_user_id": str(new_user_id)},
            )

        db.commit()
        db.refresh(assignment)
        return assignment

    @staticmethod
    def withdraw_case(
        db: Session,
        case: ImmigrationCase,
        reason: str,
        actor_id: uuid.UUID,
    ) -> ImmigrationCase:
        """
        Marks representation as withdrawn. Preserves immutable files and audit trail.
        """
        if case.operational_state == OperationalState.WITHDRAWN:
            raise ConflictError("Case is already withdrawn.")

        case.operational_state = OperationalState.WITHDRAWN
        case.status = "closed"
        case.updated_at = now_utc()

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.representation_withdrawn",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "reason": reason,
                "prior_preparation_status": case.preparation_status,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def create_reapplication(
        db: Session,
        prior_case: ImmigrationCase,
        new_case_number: str,
        reason: str,
        actor_id: uuid.UUID,
        new_title: Optional[str] = None,
    ) -> ImmigrationCase:
        """
        Creates a fresh reapplication case linked to a prior refused or withdrawn case.
        Strict regulatory guarantee:
        - Prior history is permanently linked for statutory disclosure (INA § 212).
        - Old questionnaire responses and unverified documents are NOT automatically copied or reused.
        - Reapplication starts fresh from CLEARANCE_PENDING.
        """
        # Verify case number uniqueness
        exists = (
            db.query(ImmigrationCase)
            .filter(
                ImmigrationCase.organization_id == prior_case.organization_id,
                ImmigrationCase.case_number == new_case_number,
            )
            .first()
        )
        if exists:
            raise ConflictError(f"Case number '{new_case_number}' is already registered in this organization.")

        now = now_utc()
        title = new_title or f"Reapplication: {prior_case.title}"

        new_case = ImmigrationCase(
            organization_id=prior_case.organization_id,
            client_id=prior_case.client_id,
            case_number=new_case_number,
            title=title,
            jurisdiction=prior_case.jurisdiction,
            visa_category=prior_case.visa_category,
            status="inquiry",
            priority_date=None,
            # Decoupled fresh lifecycle states
            payment_clearance_status=PaymentClearanceStatus.PENDING,
            preparation_status=PreparationStatus.CLEARANCE_PENDING,
            operational_state=OperationalState.ACTIVE,
            review_status=ReviewStatus.NOT_STARTED,
            outcome_status=None,
            # Explicit Reapplication History Linkage
            prior_case_id=prior_case.id,
            reapplication_reason=reason,
            created_at=now,
            updated_at=now,
        )
        db.add(new_case)
        db.flush()

        # Audit event establishing statutory provenance
        audit = AuditEvent(
            organization_id=prior_case.organization_id,
            actor_id=actor_id,
            action="case.reapplication_created",
            object_type="immigration_case",
            object_id=str(new_case.id),
            metadata_json={
                "prior_case_id": str(prior_case.id),
                "prior_case_number": prior_case.case_number,
                "reapplication_reason": reason,
                "auto_reused_old_answers": False,
                "auto_reused_old_documents": False,
                "fresh_verification_mandated": True,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(new_case)
        return new_case

    @staticmethod
    def record_download_event(
        db: Session,
        package: FilingPackage,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> PackageDownloadEvent:
        """
        Records an immutable download evidence event for a filing package.
        """
        now = now_utc()
        event = PackageDownloadEvent(
            organization_id=package.organization_id,
            package_id=package.id,
            downloaded_by_user_id=user.id,
            downloaded_at=now,
            package_hash_at_download=package.package_hash or "UNHASHED_DRAFT",
            ip_address=ip_address,
            user_agent=user_agent,
            manifest_snapshot_json=package.manifest_json or {},
        )
        db.add(event)

        audit = AuditEvent(
            organization_id=package.organization_id,
            actor_id=user.id,
            action="filing_package.downloaded",
            object_type="filing_package",
            object_id=str(package.id),
            metadata_json={
                "package_hash": package.package_hash,
                "package_status": package.status,
                "downloaded_by": f"{user.full_name} ({user.email})",
                "ip_address": ip_address,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def update_payment_clearance(
        db: Session,
        case: ImmigrationCase,
        new_status: str | PaymentClearanceStatus,
        actor_id: uuid.UUID,
        notes: Optional[str] = None,
    ) -> ImmigrationCase:
        """
        Updates commercial payment clearance status on a case.
        """
        tgt = str(new_status).upper().strip()
        if tgt not in [p.value for p in PaymentClearanceStatus]:
            raise ValidationError(f"Invalid payment clearance status: '{tgt}'")

        old_status = case.payment_clearance_status
        case.payment_clearance_status = tgt
        case.updated_at = now_utc()

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.payment_clearance_updated",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "old_status": old_status,
                "new_status": tgt,
                "notes": notes,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def initialize_case_authorizations(case: Optional[ImmigrationCase] = None) -> dict[str, Any]:
        """Initializes the tripartite onboarding authorization gates on a case."""
        default_auths = {
            "manager_authorization": {
                "authorized": False,
                "cleared": False,
                "authorized_at": None,
                "actor_id": None,
                "actor_name": None,
                "actor_role": None,
                "notes": None,
            },
            "accounts_clearance": {
                "cleared": False,
                "authorized": False,
                "cleared_at": None,
                "actor_id": None,
                "actor_name": None,
                "actor_role": None,
                "invoice_id": None,
                "notes": None,
            },
            "counsellor_confirmation": {
                "confirmed": False,
                "cleared": False,
                "authorized": False,
                "confirmed_at": None,
                "actor_id": None,
                "actor_name": None,
                "actor_role": None,
                "agreement_reference": None,
                "notes": None,
            },
        }
        if case is not None:
            case.substantive_authorizations = default_auths
        return default_auths

    @staticmethod
    def record_tripartite_authorization(
        db: Session,
        case: ImmigrationCase,
        auth_type: Optional[str] = None,
        gate_type: Optional[str] = None,
        actor_id: Optional[uuid.UUID] = None,
        actor_name: str = "Authorized Professional",
        actor_role: str = "authorized_role",
        authorized: bool = True,
        notes: Optional[str] = None,
        reference_id: Optional[str] = None,
        waived: bool = False,
        waiver_reason: Optional[str] = None,
    ) -> ImmigrationCase:
        """
        Records one of the tripartite onboarding authorizations required before substantive preparation can begin:
        1. manager_authorization (Case Manager or Supervising Attorney sign-off)
        2. accounts_clearance (Retainer payment / Billing verification)
        3. counsellor_confirmation (Intake Counsellor engagement confirmation)
        """
        valid_auth_types = {"manager_authorization", "accounts_clearance", "counsellor_confirmation"}
        norm_type = str(gate_type or auth_type or "").lower().strip()
        if norm_type not in valid_auth_types:
            raise ValidationError(f"Invalid authorization type '{norm_type}'. Must be one of: {sorted(list(valid_auth_types))}")

        auths = dict(getattr(case, "substantive_authorizations", {}) or {})
        now = now_utc()
        is_cleared = authorized or waived

        if norm_type == "manager_authorization":
            auths["manager_authorization"] = {
                "authorized": is_cleared,
                "cleared": is_cleared,
                "waived": waived,
                "waiver_reason": waiver_reason,
                "authorized_at": now.isoformat(),
                "actor_id": str(actor_id) if actor_id else None,
                "actor_name": actor_name,
                "actor_role": actor_role,
                "notes": notes,
            }
        elif norm_type == "accounts_clearance":
            auths["accounts_clearance"] = {
                "cleared": is_cleared,
                "authorized": is_cleared,
                "waived": waived,
                "waiver_reason": waiver_reason,
                "cleared_at": now.isoformat(),
                "actor_id": str(actor_id) if actor_id else None,
                "actor_name": actor_name,
                "actor_role": actor_role,
                "invoice_id": reference_id,
                "notes": notes,
            }
        elif norm_type == "counsellor_confirmation":
            auths["counsellor_confirmation"] = {
                "confirmed": is_cleared,
                "cleared": is_cleared,
                "authorized": is_cleared,
                "waived": waived,
                "waiver_reason": waiver_reason,
                "confirmed_at": now.isoformat(),
                "actor_id": str(actor_id) if actor_id else None,
                "actor_name": actor_name,
                "actor_role": actor_role,
                "agreement_reference": reference_id,
                "notes": notes,
            }

        # Auto-promote to AUTHORIZED_FOR_PREPARATION if all 3 are cleared and case is in CLEARANCE_PENDING
        mgr_ok = auths.get("manager_authorization", {}).get("cleared", False) or auths.get("manager_authorization", {}).get("authorized", False)
        acct_ok = auths.get("accounts_clearance", {}).get("cleared", False) or auths.get("accounts_clearance", {}).get("authorized", False)
        couns_ok = auths.get("counsellor_confirmation", {}).get("cleared", False) or auths.get("counsellor_confirmation", {}).get("confirmed", False)

        if mgr_ok and acct_ok and couns_ok and case.preparation_status == PreparationStatus.CLEARANCE_PENDING.value:
            case.preparation_status = PreparationStatus.AUTHORIZED_FOR_PREPARATION.value

        case.substantive_authorizations = auths
        case.updated_at = now

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action=f"case.onboarding_authorization.{norm_type}",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "auth_type": norm_type,
                "actor_name": actor_name,
                "actor_role": actor_role,
                "notes": notes,
                "reference_id": reference_id,
                "waived": waived,
            },
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def record_progressive_review(
        db: Session,
        case: ImmigrationCase,
        stage: str | ProgressiveReviewStage,
        actor_id: uuid.UUID,
        actor_name: str = "Authorized Reviewer",
        actor_role: str = "reviewer",
        decision: Optional[str] = None,
        outcome: Optional[str] = None,
        comments: Optional[str] = None,
        notes: Optional[str] = None,
        checklist_verified: bool = True,
    ) -> ImmigrationCase:
        """
        Records progressive professional review stages:
        1. officer_initial_review (Case Worker completeness & evidence check)
        2. senior_review (Senior Paralegal / Case Manager consistency check)
        3. lawyer_review (Supervising Attorney final legal merits sign-off)
        """
        stage_str = str(stage).lower().strip()
        decision_str = str(outcome or decision or "approved").lower().strip()
        effective_notes = comments or notes

        if decision_str not in ("approved", "changes_requested"):
            raise ValidationError(f"Invalid review decision '{decision_str}'. Must be 'approved' or 'changes_requested'.")

        if stage_str == ProgressiveReviewStage.OFFICER_INITIAL_REVIEW.value:
            if decision_str == "approved":
                case.review_status = ReviewStatus.OFFICER_INITIAL_REVIEW.value
            else:
                case.review_status = ReviewStatus.CHANGES_REQUESTED.value

        elif stage_str == ProgressiveReviewStage.SENIOR_REVIEW.value:
            if case.review_status not in (
                ReviewStatus.OFFICER_INITIAL_REVIEW.value,
                ReviewStatus.SENIOR_REVIEW.value,
                ReviewStatus.INTERNAL_REVIEW.value,
            ):
                raise ValidationError("Senior review requires completed officer initial review first.")
            if decision_str == "approved":
                case.review_status = ReviewStatus.SENIOR_REVIEW.value
            else:
                case.review_status = ReviewStatus.CHANGES_REQUESTED.value

        elif stage_str == ProgressiveReviewStage.LAWYER_REVIEW.value:
            if decision_str == "approved":
                case.review_status = ReviewStatus.APPROVED.value
            else:
                case.review_status = ReviewStatus.CHANGES_REQUESTED.value
        else:
            raise ValidationError(f"Unknown review stage '{stage_str}'. Must be one of: {[s.value for s in ProgressiveReviewStage]}")

        case.updated_at = now_utc()
        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action=f"case.review_stage.{stage_str}",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "stage": stage_str,
                "decision": decision_str,
                "actor_name": actor_name,
                "actor_role": actor_role,
                "notes": effective_notes,
                "checklist_verified": checklist_verified,
                "new_review_status": case.review_status,
            },
            occurred_at=now_utc(),
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def set_submission_authorization(
        db: Session,
        case: ImmigrationCase,
        target_status: Optional[str] = None,
        action: Optional[str] = None,
        actor_id: Optional[uuid.UUID] = None,
        actor_name: str = "Authorized Counsel",
        reason: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ImmigrationCase:
        """
        Updates submission authorization status or applies/releases submission holds:
        - AUTHORIZED_TO_FILE
        - HELD_FOR_ACCOUNTS
        - HELD_FOR_COUNSELLOR
        - HELD_FOR_CLIENT_DECISION
        - PENDING_LAWYER_SIGNOFF
        - UNAUTHORIZED
        """
        effective_reason = notes or reason
        act = (action or target_status or "").upper().strip()

        if act == "HOLD_ACCOUNTS":
            tgt = SubmissionAuthorizationStatus.HELD_FOR_ACCOUNTS.value
        elif act == "HOLD_COUNSELLOR":
            tgt = SubmissionAuthorizationStatus.HELD_FOR_COUNSELLOR.value
        elif act == "HOLD_CLIENT_DECISION":
            tgt = SubmissionAuthorizationStatus.HELD_FOR_CLIENT_DECISION.value
        elif act in ("RELEASE_HOLD", "READY_FOR_SUBMISSION"):
            tgt = SubmissionAuthorizationStatus.AUTHORIZED_TO_FILE.value
        elif act in ("APPROVE", "AUTHORIZED_TO_FILE"):
            tgt = SubmissionAuthorizationStatus.AUTHORIZED_TO_FILE.value
        elif act in ("REJECT", "UNAUTHORIZED"):
            tgt = SubmissionAuthorizationStatus.UNAUTHORIZED.value
        else:
            tgt = act

        if tgt not in [s.value for s in SubmissionAuthorizationStatus]:
            raise ValidationError(f"Invalid submission authorization status: '{tgt}'")

        if tgt == SubmissionAuthorizationStatus.AUTHORIZED_TO_FILE.value:
            if case.preparation_status != PreparationStatus.READY_TO_SUBMIT.value:
                raise ValidationError(
                    f"Submission authorization requires preparation status 'READY_TO_SUBMIT', currently '{case.preparation_status}'."
                )
            if case.review_status != ReviewStatus.APPROVED.value:
                raise ValidationError(
                    f"Submission authorization requires lawyer review status 'APPROVED', currently '{case.review_status}'."
                )
            if case.payment_clearance_status != PaymentClearanceStatus.PAID.value:
                raise ValidationError(
                    f"Submission authorization requires payment status 'PAID', currently '{case.payment_clearance_status}'."
                )

        old_status = getattr(case, "submission_authorization_status", SubmissionAuthorizationStatus.UNAUTHORIZED.value)
        case.submission_authorization_status = tgt
        case.updated_at = now_utc()

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.submission_authorization_updated",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "from_status": old_status,
                "to_status": tgt,
                "authorized_by": actor_name,
                "reason": effective_reason,
            },
            occurred_at=now_utc(),
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def set_handover_authorization(
        db: Session,
        case: ImmigrationCase,
        target_status: Optional[str | HandoverAuthorizationStatus] = None,
        authorized: bool = True,
        actor_id: Optional[uuid.UUID] = None,
        actor_name: str = "Authorized Counsel",
        reason: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ImmigrationCase:
        """
        Updates client handover authorization status:
        - RESTRICTED (Default: filing package/handover restricted)
        - CLEARED_FOR_HANDOVER (Manager/Supervising Attorney cleared for client release)
        - HANDED_OVER (Package or filings officially released to client)
        """
        if target_status:
            raw = str(target_status).upper().strip()
            if raw in ("AUTHORIZED_FOR_HANDOVER", "AUTHORIZED", "APPROVE", "CLEARED", "CLEARED_FOR_HANDOVER"):
                tgt = HandoverAuthorizationStatus.CLEARED_FOR_HANDOVER.value
            elif raw in ("NOT_REQUESTED", "UNAUTHORIZED", "REJECT", "RESTRICTED"):
                tgt = HandoverAuthorizationStatus.RESTRICTED.value
            elif raw in ("HANDED_OVER", "COMPLETED"):
                tgt = HandoverAuthorizationStatus.HANDED_OVER.value
            else:
                tgt = raw
        elif authorized:
            tgt = HandoverAuthorizationStatus.CLEARED_FOR_HANDOVER.value
        else:
            tgt = HandoverAuthorizationStatus.RESTRICTED.value

        if tgt not in [s.value for s in HandoverAuthorizationStatus]:
            raise ValidationError(f"Invalid handover authorization status: '{tgt}'")

        old_status = getattr(case, "handover_authorization_status", HandoverAuthorizationStatus.RESTRICTED.value)
        case.handover_authorization_status = tgt
        case.updated_at = now_utc()

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.handover_authorization_updated",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "from_status": old_status,
                "to_status": tgt,
                "authorized_by": actor_name,
                "reason": notes or reason,
            },
            occurred_at=now_utc(),
        )
        db.add(audit)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def send_manual_reminder(
        db: Session,
        case: ImmigrationCase,
        actor_id: uuid.UUID,
        actor_name: str = "Authorized Counsel",
        message: Optional[str] = None,
        custom_message: Optional[str] = None,
        reminder_type: str = "GENERAL",
        recipient_role: str = "CLIENT",
        delivery_channel: str = "email",
    ) -> dict[str, Any]:
        """
        Sends an immediate manual reminder to the client, guaranteed to remain available
        regardless of whether automatic reminders are enabled or disabled in firm configuration.
        """
        effective_message = custom_message or message or f"Reminder: Case {case.case_number} has pending action items."
        now = now_utc()
        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="client.reminder_sent_manually",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "channel": delivery_channel,
                "message": effective_message,
                "reminder_type": reminder_type,
                "recipient_role": recipient_role,
                "triggered_by": actor_name,
                "client_id": str(case.client_id),
                "timestamp": now.isoformat(),
            },
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        return {
            "status": "sent",
            "delivery_channel": delivery_channel,
            "reminder_type": reminder_type,
            "recipient_role": recipient_role,
            "recipient_case_number": case.case_number,
            "dispatched_at": now.isoformat(),
            "message": effective_message,
        }

    @staticmethod
    def send_manual_acknowledgement(
        db: Session,
        case: ImmigrationCase,
        actor_id: uuid.UUID,
        actor_name: str = "Authorized Counsel",
        subject: Optional[str] = None,
        details: Optional[str] = None,
        notes: Optional[str] = None,
        acknowledgement_type: str = "RECEIPT",
    ) -> dict[str, Any]:
        """
        Dispatches a formal manual case acknowledgement to the client or firm stakeholders.
        """
        effective_subject = subject or f"Formal Acknowledgement: {acknowledgement_type} for Case {case.case_number}"
        effective_details = details or notes or f"Action {acknowledgement_type} officially recorded."
        now = now_utc()
        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.acknowledgement_sent_manually",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "subject": effective_subject,
                "details": effective_details,
                "acknowledgement_type": acknowledgement_type,
                "triggered_by": actor_name,
                "client_id": str(case.client_id),
                "timestamp": now.isoformat(),
            },
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        return {
            "status": "sent",
            "subject": effective_subject,
            "acknowledgement_type": acknowledgement_type,
            "recipient_case_number": case.case_number,
            "dispatched_at": now.isoformat(),
            "details": effective_details,
        }


# Backwards compatibility alias
CaseLifecycleEngine = CaseLifecycleService

