"""Analytics API Router

Provides database-backed executive dashboard metrics, multi-dimensional operational analytics,
and authorized export endpoints with audit tracking.
"""
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.analytics.service import ExecutiveDashboardService, AnalyticsService
from backend.app.db.session import get_db
from backend.app.domain.models import AuditEvent
from backend.app.security.auth import AuthContext, require_permission

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard/executive")
def get_executive_dashboard(
    window_days: int = Query(default=30, ge=1, le=365),
    ctx: AuthContext = Depends(require_permission("analytics:read")),
    db: Session = Depends(get_db),
):
    """Retrieves all 12 real, database-backed executive dashboard metrics with documented formulas,

    time windows, and interactive drill-down paths.
    """
    return ExecutiveDashboardService.get_dashboard_metrics(db, ctx.organization_id, window_days)


@router.get("/operations")
def get_operations_analytics(
    start_date: str | None = None,
    end_date: str | None = None,
    jurisdiction: str | None = None,
    pathway: str | None = None,
    stage: str | None = None,
    assigned_user_id: str | None = None,
    branch_id: str | None = None,
    service_code: str | None = None,
    ctx: AuthContext = Depends(require_permission("analytics:read")),
    db: Session = Depends(get_db),
):
    """Calculates granular operational analytics: turnaround times (accounting for reopened cases &

    incomplete timestamps), overdue work breakdown, client response times, and completed cases.
    """
    s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00")) if start_date else None
    e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")) if end_date else None
    user_uuid = uuid.UUID(assigned_user_id) if assigned_user_id else None
    branch_uuid = uuid.UUID(branch_id) if branch_id else None

    return AnalyticsService.get_operations_analytics(
        db,
        ctx.organization_id,
        start_date=s_dt,
        end_date=e_dt,
        jurisdiction=jurisdiction,
        pathway=pathway,
        stage=stage,
        assigned_user_id=user_uuid,
        branch_id=branch_uuid,
        service_code=service_code,
    )


@router.get("/export")
def export_analytics_data(
    report_type: str = Query(default="executive_summary"),
    format: str = Query(default="json"),
    ctx: AuthContext = Depends(require_permission("analytics:export")),
    db: Session = Depends(get_db),
):
    """Exports authorized analytics data and records an immutable audit event for compliance tracking."""
    now = datetime.now(timezone.utc)
    data = ExecutiveDashboardService.get_dashboard_metrics(db, ctx.organization_id, window_days=30)

    # Log audit event for consequential report export
    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="governance.analytics_exported",
        object_type="analytics_report",
        object_id=report_type,
        metadata_json={"report_type": report_type, "format": format},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()

    return {
        "export_id": str(audit.id),
        "report_type": report_type,
        "format": format,
        "exported_at": now.isoformat(),
        "exported_by": str(ctx.user_id),
        "data": data,
    }
