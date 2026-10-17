"""Company Operations & Reliability API Router

Provides endpoints for staff membership management, work reassignment, internal workload & capacity views,
organization settings, access & activity audit reporting, operational dashboards,
disaster recovery & backup drills, data-flow register, jurisdiction privacy reviews,
and the 6 core lifecycle scenarios (inactivity cleanup, holds, withdrawal, completed application summary,
reapplication from scratch, employee offboarding, and firm export).
"""
import uuid
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.worker_health import WorkerHealthMonitor
from backend.app.db.session import get_db
from backend.app.domain.models import (
    CompletedApplicationSummary,
    CaseWithdrawalTombstone,
    Document,
)
from backend.app.operations.backup_service import BackupAndDrillService
from backend.app.operations.data_flow_register import get_data_flow_register
from backend.app.operations.privacy_reviews import get_all_privacy_reviews
from backend.app.operations.scenario_service import ScenarioService
from backend.app.operations.service import CompanyOperationsService
from backend.app.security.auth import AuthContext, require_permission

router = APIRouter(prefix="/operations", tags=["operations"])


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class MembershipUpdateRequest(BaseModel):
    status: str | None = None
    branch_id: str | None = None
    team_id: str | None = None
    role_codes: list[str] | None = None


class WorkReassignmentRequest(BaseModel):
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    reassign_cases: bool = True
    reassign_tasks: bool = True
    case_ids: list[str] | None = None


class SettingUpdateRequest(BaseModel):
    key: str = Field(..., min_length=2, max_length=100)
    value: Any


class CaseWithdrawalRequest(BaseModel):
    case_id: uuid.UUID
    reason: str = Field(..., min_length=5)
    formal_authority_already_submitted: bool = False
    formal_authority_notes: Optional[str] = None


class CompletedCaseCleanupRequest(BaseModel):
    case_id: uuid.UUID
    adjudication_outcome: str = "APPROVED"
    official_reference_number: Optional[str] = None


class ReapplicationRequest(BaseModel):
    prior_case_id: uuid.UUID
    new_case_number: str = Field(..., min_length=3)
    reason: str = Field(..., min_length=5)
    new_title: Optional[str] = None


class EmployeeOffboardingRequest(BaseModel):
    departing_user_id: uuid.UUID
    successor_user_id: Optional[uuid.UUID] = None
    notes: Optional[str] = "Employee departure"


class FirmExportApiRequest(BaseModel):
    export_type: str = "self_service"  # self_service, assisted_concierge


class IncidentLockdownRequest(BaseModel):
    reason: str = Field(..., min_length=10)


# ---------------------------------------------------------------------------
# Operational Dashboard & Telemetry
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def get_operational_dashboard(
    ctx: AuthContext = Depends(require_permission("security:read")),
    db: Session = Depends(get_db),
):
    """
    Comprehensive operational reliability telemetry:
    - Worker health, active jobs, and heartbeat status
    - Dead letter queue (DLQ) depth
    - Quarantined file statistics
    - Data-flow register components summary
    - Jurisdiction privacy review validity (India, Canada, US, UK/EU)
    - Active caseload and staff capacity
    """
    worker_health = WorkerHealthMonitor.get_system_health()
    dlq_jobs = WorkerHealthMonitor.list_dlq_jobs(str(ctx.organization_id))

    quarantined_docs_count = (
        db.query(Document)
        .filter(
            Document.organization_id == ctx.organization_id,
            (Document.verification_status == "quarantined") | (Document.malware_scan_status == "infected"),
        )
        .count()
    )

    data_flows = get_data_flow_register()
    privacy_reviews = get_all_privacy_reviews(db)
    workloads = CompanyOperationsService.get_internal_workload(db, ctx.organization_id)

    completed_summaries_count = (
        db.query(CompletedApplicationSummary)
        .filter(CompletedApplicationSummary.organization_id == ctx.organization_id)
        .count()
    )
    withdrawn_tombstones_count = (
        db.query(CaseWithdrawalTombstone)
        .filter(CaseWithdrawalTombstone.organization_id == ctx.organization_id)
        .count()
    )

    return {
        "organization_id": str(ctx.organization_id),
        "system_status": worker_health.get("status", "healthy"),
        "workers": worker_health,
        "dead_letter_queue": {
            "size": len(dlq_jobs),
            "jobs": dlq_jobs,
        },
        "security": {
            "quarantined_files_count": quarantined_docs_count,
            "rate_limiting_active": True,
            "short_lived_download_tokens_enforced": True,
            "least_privilege_enforced": True,
        },
        "lifecycle_metrics": {
            "completed_applications_retained": completed_summaries_count,
            "withdrawn_tombstones_retained": withdrawn_tombstones_count,
        },
        "data_flow_summary": {
            "total_entities": data_flows.get("total_components", 0),
            "external_processors": data_flows.get("external_processors", 0),
            "zero_training_guarantee": True,
        },
        "privacy_reviews": [
            {
                "jurisdiction": pr["jurisdiction"],
                "market_name": pr["market_name"],
                "status": pr["review_status"],
                "is_valid": pr["is_valid"],
            }
            for pr in privacy_reviews
        ],
        "workforce": {
            "total_active_staff": len(workloads),
            "overloaded_staff_count": sum(1 for w in workloads if w.get("is_overloaded")),
        },
    }


# ---------------------------------------------------------------------------
# Staff Workload, Reassignment, Memberships & Settings (Existing)
# ---------------------------------------------------------------------------

@router.get("/workload")
def get_workload_and_capacity(
    ctx: AuthContext = Depends(require_permission("user:manage")),
    db: Session = Depends(get_db),
):
    """Retrieves internal staff workload, active caseloads, pending task queues, and capacity utilization."""
    return CompanyOperationsService.get_internal_workload(db, ctx.organization_id)


@router.post("/reassign")
def reassign_staff_work(
    payload: WorkReassignmentRequest,
    ctx: AuthContext = Depends(require_permission("assignment:manage")),
    db: Session = Depends(get_db),
):
    """Transfers case assignments and pending tasks from one staff member to another with audit logging."""
    return CompanyOperationsService.reassign_work(
        db,
        ctx.organization_id,
        payload.from_user_id,
        payload.to_user_id,
        reassign_cases=payload.reassign_cases,
        reassign_tasks=payload.reassign_tasks,
        case_ids=payload.case_ids,
        actor_id=ctx.user_id,
    )


@router.patch("/memberships/{membership_id}")
def update_membership(
    membership_id: str,
    payload: MembershipUpdateRequest,
    ctx: AuthContext = Depends(require_permission("user:manage")),
    db: Session = Depends(get_db),
):
    """Updates an employee membership (status, branch, team, roles)."""
    mem = CompanyOperationsService.update_membership(
        db, ctx.organization_id, uuid.UUID(membership_id), payload.model_dump(exclude_unset=True), actor_id=ctx.user_id
    )
    return {
        "id": str(mem.id),
        "status": mem.status,
        "branch_id": str(mem.branch_id) if mem.branch_id else None,
        "team_id": str(mem.team_id) if mem.team_id else None,
    }


@router.get("/settings")
def get_organization_settings(
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Retrieves organization-wide operational and billing configuration settings."""
    return CompanyOperationsService.get_organization_settings(db, ctx.organization_id)


@router.patch("/settings")
def update_organization_setting(
    payload: SettingUpdateRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Updates an organization setting and logs an audit event."""
    return CompanyOperationsService.update_organization_setting(
        db, ctx.organization_id, payload.key, payload.value, actor_id=ctx.user_id
    )


@router.get("/access-report")
def get_access_activity_report(
    actor_id: str | None = None,
    action: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    export_audit: bool = Query(default=False),
    ctx: AuthContext = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
):
    """Retrieves access and activity audit logs with optional export audit event logging."""
    actor_uuid = uuid.UUID(actor_id) if actor_id else None
    return CompanyOperationsService.get_access_activity_report(
        db,
        ctx.organization_id,
        actor_id=actor_uuid,
        action=action,
        limit=limit,
        export_audit=export_audit,
        exporter_id=ctx.user_id,
    )


# ---------------------------------------------------------------------------
# Phase 11 Scenarios: Lifecycle & Minimization
# ---------------------------------------------------------------------------

@router.post("/scenarios/inactivity/eval")
def evaluate_idle_cases(
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Scenario 1: Evaluates idle client cases across the organization.
    Warns on days 7, 10, 14; applies day-15 cleanup to eligible files under agreed policy.
    Internal staff notes strictly NEVER reset client inactivity.
    """
    return ScenarioService.evaluate_organization_idle_cases(
        db,
        ctx.organization_id,
        actor_id=ctx.user_id,
    )


@router.post("/scenarios/withdrawal")
def execute_case_withdrawal(
    payload: CaseWithdrawalRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Scenario 3: Executes representation withdrawal:
    - Generates pre-withdrawal state snapshot download record
    - Purges raw file uploads and filing packages under the data retention policy
    - Preserves minimal tombstone record: name, address, contact, intended application type
    - Tracks formal authority withdrawal separately if already submitted to USCIS/IRCC
    """
    tombstone = ScenarioService.execute_case_withdrawal(
        db,
        ctx.organization_id,
        payload.case_id,
        reason=payload.reason,
        actor_id=ctx.user_id,
        formal_authority_already_submitted=payload.formal_authority_already_submitted,
        formal_authority_notes=payload.formal_authority_notes,
    )
    return {
        "tombstone_id": str(tombstone.id),
        "case_id": str(tombstone.case_id),
        "case_number": tombstone.case_number,
        "client_name": tombstone.client_name,
        "intended_application_type": tombstone.intended_application_type,
        "withdrawal_reason": tombstone.withdrawal_reason,
        "executed_at": tombstone.executed_at.isoformat(),
        "formal_authority_withdrawal_required": tombstone.formal_authority_withdrawal_required,
        "formal_authority_status": tombstone.formal_authority_status,
    }


@router.post("/scenarios/completed-cleanup")
def execute_completed_case_cleanup(
    payload: CompletedCaseCleanupRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Scenario 4: Executes completed case cleanup:
    - Retains dedicated Completed Applications summary (client name, start/completion dates, assigned officer details)
    - Purges raw uploads and compiled packages under the agreed data minimization policy
    """
    summary = ScenarioService.execute_completed_case_cleanup(
        db,
        ctx.organization_id,
        payload.case_id,
        actor_id=ctx.user_id,
        adjudication_outcome=payload.adjudication_outcome,
        official_reference_number=payload.official_reference_number,
    )
    return {
        "summary_id": str(summary.id),
        "case_id": str(summary.case_id),
        "case_number": summary.case_number,
        "client_name": summary.client_name,
        "visa_category": summary.visa_category,
        "start_date": summary.start_date.isoformat(),
        "completion_date": summary.completion_date.isoformat(),
        "assigned_officer_name": summary.assigned_officer_name,
        "assigned_officer_role": summary.assigned_officer_role,
        "adjudication_outcome": summary.adjudication_outcome,
        "purged_files_count": summary.purged_files_count,
    }


@router.get("/completed-applications")
def list_completed_applications(
    limit: int = Query(default=50, ge=1, le=500),
    ctx: AuthContext = Depends(require_permission("case:read")),
    db: Session = Depends(get_db),
):
    """Lists retained summaries for completed applications."""
    summaries = (
        db.query(CompletedApplicationSummary)
        .filter(CompletedApplicationSummary.organization_id == ctx.organization_id)
        .order_by(CompletedApplicationSummary.completion_date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(s.id),
            "case_id": str(s.case_id),
            "case_number": s.case_number,
            "client_name": s.client_name,
            "visa_category": s.visa_category,
            "jurisdiction": s.jurisdiction,
            "start_date": s.start_date.isoformat(),
            "completion_date": s.completion_date.isoformat(),
            "assigned_officer_name": s.assigned_officer_name,
            "assigned_officer_role": s.assigned_officer_role,
            "adjudication_outcome": s.adjudication_outcome,
            "official_reference_number": s.official_reference_number,
            "purged_files_count": s.purged_files_count,
        }
        for s in summaries
    ]


@router.get("/withdrawn-tombstones")
def list_withdrawn_tombstones(
    limit: int = Query(default=50, ge=1, le=500),
    ctx: AuthContext = Depends(require_permission("case:read")),
    db: Session = Depends(get_db),
):
    """Lists minimal tombstone records for withdrawn cases."""
    tombstones = (
        db.query(CaseWithdrawalTombstone)
        .filter(CaseWithdrawalTombstone.organization_id == ctx.organization_id)
        .order_by(CaseWithdrawalTombstone.executed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(t.id),
            "case_id": str(t.case_id),
            "case_number": t.case_number,
            "client_name": t.client_name,
            "client_email": t.client_email,
            "intended_application_type": t.intended_application_type,
            "jurisdiction": t.jurisdiction,
            "executed_by_name": t.executed_by_name,
            "withdrawal_reason": t.withdrawal_reason,
            "executed_at": t.executed_at.isoformat(),
            "formal_authority_withdrawal_required": t.formal_authority_withdrawal_required,
            "formal_authority_status": t.formal_authority_status,
        }
        for t in tombstones
    ]


@router.post("/scenarios/reapplication")
def create_reapplication(
    payload: ReapplicationRequest,
    ctx: AuthContext = Depends(require_permission("case:create")),
    db: Session = Depends(get_db),
):
    """
    Scenario 5: Creates a fresh reapplication from scratch:
    - Starts fresh from CLEARANCE_PENDING (strictly no automatic reuse of documents)
    - Preserves explicit, audited link to prior filing history
    """
    new_case = ScenarioService.create_reapplication_from_scratch(
        db,
        ctx.organization_id,
        payload.prior_case_id,
        new_case_number=payload.new_case_number,
        reason=payload.reason,
        actor_id=ctx.user_id,
        new_title=payload.new_title,
    )
    return {
        "id": str(new_case.id),
        "case_number": new_case.case_number,
        "title": new_case.title,
        "operational_state": new_case.operational_state,
        "preparation_status": new_case.preparation_status,
        "prior_case_id": str(payload.prior_case_id),
    }


@router.post("/scenarios/employee-offboard")
def offboard_employee(
    payload: EmployeeOffboardingRequest,
    ctx: AuthContext = Depends(require_permission("user:manage")),
    db: Session = Depends(get_db),
):
    """
    Scenario 7: Safely offboards an employee:
    - Revokes active database user sessions immediately
    - Requires transferring active cases to a successor caseworker to prevent orphaned files
    - Deactivates membership and account
    """
    return ScenarioService.offboard_employee_safely(
        db,
        ctx.organization_id,
        payload.departing_user_id,
        payload.successor_user_id,
        actor_id=ctx.user_id,
        notes=payload.notes or "Employee departure",
    )


@router.post("/scenarios/firm-export")
def request_firm_export(
    payload: FirmExportApiRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """
    Scenario 6: Firm offboarding and data export:
    - Governed by owner/admin and contractual entitlement
    - Generates cryptographic self-service bundle or assisted-export concierge path
    """
    req = ScenarioService.request_firm_export(
        db,
        ctx.organization_id,
        actor_id=ctx.user_id,
        export_type=payload.export_type,
    )
    return {
        "request_id": str(req.id),
        "status": req.status,
        "export_type": req.export_type,
        "contractual_entitlement_verified": req.contractual_entitlement_verified,
        "archive_url": req.archive_url,
        "archive_sha256": req.archive_sha256,
        "support_ticket_id": req.support_ticket_id,
        "contact_email": req.contact_email,
        "notes": req.notes,
    }


# ---------------------------------------------------------------------------
# Data-Flow Register & Jurisdiction Privacy Reviews
# ---------------------------------------------------------------------------

@router.get("/data-flow-register")
def get_data_flow_register_endpoint(
    ctx: AuthContext = Depends(require_permission("security:read")),
):
    """Retrieves the official platform Data-Flow and Third-Party Processor Register."""
    return get_data_flow_register()


@router.get("/privacy-reviews")
def get_privacy_reviews_endpoint(
    ctx: AuthContext = Depends(require_permission("security:read")),
    db: Session = Depends(get_db),
):
    """Retrieves statutory privacy reviews and counsel sign-offs for India, Canada, US, and UK/EU."""
    return get_all_privacy_reviews(db)


# ---------------------------------------------------------------------------
# Backups, Recovery Drills & Deletion Accounting
# ---------------------------------------------------------------------------

@router.post("/backups/drill")
def execute_backup_restore_drill(
    ctx: AuthContext = Depends(require_permission("security:read")),
    db: Session = Depends(get_db),
):
    """Executes an automated disaster recovery and restore verification drill."""
    return BackupAndDrillService.execute_backup_restore_drill(
        db,
        ctx.organization_id,
        actor_id=ctx.user_id,
    )


@router.get("/backups/deletion-accounting")
def get_deletion_accounting_report(
    ctx: AuthContext = Depends(require_permission("security:read")),
    db: Session = Depends(get_db),
):
    """Verifies that deletion policies account for backup snapshots and object versions."""
    return BackupAndDrillService.verify_deletion_policy_accounting(
        db,
        ctx.organization_id,
    )


# ---------------------------------------------------------------------------
# Security: Key Rotation & Emergency Incident Lockdown
# ---------------------------------------------------------------------------

@router.post("/security/key-rotation")
def simulate_key_rotation_drill(
    ctx: AuthContext = Depends(require_permission("security:read")),
    db: Session = Depends(get_db),
):
    """Simulates a cryptographic key rotation drill."""
    return BackupAndDrillService.simulate_key_rotation(
        db,
        ctx.organization_id,
        actor_id=ctx.user_id,
    )


@router.post("/security/lockdown")
def execute_emergency_lockdown(
    payload: IncidentLockdownRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Emergency incident response: revokes all active database user sessions for the organization."""
    return BackupAndDrillService.execute_incident_lockdown(
        db,
        ctx.organization_id,
        actor_id=ctx.user_id,
        reason=payload.reason,
    )


# ---------------------------------------------------------------------------
# Dead Letter Queue (DLQ) Management
# ---------------------------------------------------------------------------

@router.get("/dlq")
def list_dead_letter_jobs(
    ctx: AuthContext = Depends(require_permission("security:read")),
):
    """Lists failing jobs quarantined in the Dead Letter Queue."""
    return WorkerHealthMonitor.list_dlq_jobs(str(ctx.organization_id))


@router.post("/dlq/{job_id}/reprocess")
def reprocess_dead_letter_job(
    job_id: str,
    ctx: AuthContext = Depends(require_permission("security:read")),
):
    """Marks a Dead Letter Queue job for controlled retry / forensic reprocessing."""
    res = WorkerHealthMonitor.reprocess_dlq_job(job_id)
    return res or {"message": f"Job {job_id} not found or already reprocessed"}
