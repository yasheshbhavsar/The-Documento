"""Company Operations API Router

Provides endpoints for staff membership management, work reassignment, internal workload & capacity views,
organization settings, and access & activity audit reporting.
"""
import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.operations.service import CompanyOperationsService
from backend.app.security.auth import AuthContext, require_permission

router = APIRouter(prefix="/operations", tags=["operations"])


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
