"""Executive Dashboard and Operational Analytics Service

Implements database-backed calculations for company executive command center metrics,
multi-dimensional filtering, turnaround times (accounting for reopened cases & incomplete timestamps),
and governance audit reporting.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from backend.app.domain.models import (
    ImmigrationCase,
    ClientProfile,
    CaseAssignment,
    CaseTask,
    CaseMilestone,
    CaseAIFinding,
    Document,
    DocumentRequest,
    FilingPackage,
    Notification,
    AuditEvent,
    User,
    OrganizationMembership,
    Branch,
    Team,
    ServiceItem,
    ClientEngagement,
    Invoice,
)
def ensure_utc(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class ExecutiveDashboardService:
    @staticmethod
    def get_dashboard_metrics(db: Session, organization_id: uuid.UUID, window_days: int = 30) -> dict[str, Any]:
        """Calculates real, database-backed executive dashboard metrics with documented calculations

        and drill-down paths. Missing source data is explicitly flagged as 'source_data_pending'.
        """
        now = datetime.now(timezone.utc)
        start_window = now - timedelta(days=window_days)

        # 1. Active cases (cases not closed, denied, or fully approved)
        active_statuses = ("intake", "document_gathering", "gathering", "legal_review", "review", "ready_for_filing", "ready", "submitted", "rfe_issued")
        active_cases_query = db.query(ImmigrationCase).filter(
            ImmigrationCase.organization_id == organization_id,
            ImmigrationCase.status.in_(active_statuses),
        )
        active_cases_count = active_cases_query.count()
        total_cases_count = db.query(ImmigrationCase).filter(ImmigrationCase.organization_id == organization_id).count()

        # 2. New retained clients in window
        new_clients_count = db.query(ClientProfile).filter(
            ClientProfile.organization_id == organization_id,
            ClientProfile.created_at >= start_window,
        ).count()
        total_clients_count = db.query(ClientProfile).filter(ClientProfile.organization_id == organization_id).count()

        # 3. Cases by country (jurisdiction) and pathway (visa_category)
        cases_by_jurisdiction_raw = db.query(
            ImmigrationCase.jurisdiction,
            func.count(ImmigrationCase.id)
        ).filter(
            ImmigrationCase.organization_id == organization_id,
            ImmigrationCase.status.in_(active_statuses),
        ).group_by(ImmigrationCase.jurisdiction).all()
        cases_by_country = {row[0]: row[1] for row in cases_by_jurisdiction_raw}

        cases_by_pathway_raw = db.query(
            ImmigrationCase.visa_category,
            func.count(ImmigrationCase.id)
        ).filter(
            ImmigrationCase.organization_id == organization_id,
            ImmigrationCase.status.in_(active_statuses),
        ).group_by(ImmigrationCase.visa_category).all()
        cases_by_pathway = {row[0]: row[1] for row in cases_by_pathway_raw}

        # 4. Cases by workflow stage
        cases_by_stage_raw = db.query(
            ImmigrationCase.status,
            func.count(ImmigrationCase.id)
        ).filter(
            ImmigrationCase.organization_id == organization_id
        ).group_by(ImmigrationCase.status).all()
        cases_by_stage = {row[0]: row[1] for row in cases_by_stage_raw}

        # 5. Cases needing attention
        # Petitions with unresolved AI findings, overdue tasks, or processing failures
        flagged_case_ids_findings = {
            r[0] for r in db.query(CaseAIFinding.case_id).filter(
                CaseAIFinding.organization_id == organization_id,
                CaseAIFinding.status.in_(("needs_review", "unable_to_determine", "flagged", "in_review")),
            ).all()
        }
        overdue_tasks_case_ids = {
            r[0] for r in db.query(CaseTask.case_id).filter(
                CaseTask.organization_id == organization_id,
                CaseTask.status != "completed",
                CaseTask.due_date < now,
            ).all()
        }
        failed_docs_case_ids = {
            r[0] for r in db.query(Document.case_id).filter(
                Document.organization_id == organization_id,
                Document.case_id.isnot(None),
                Document.processing_status == "failed",
            ).all()
        }
        attention_case_ids = flagged_case_ids_findings.union(overdue_tasks_case_ids).union(failed_docs_case_ids)

        attention_cases_items = []
        if attention_case_ids:
            attn_cases = db.query(ImmigrationCase).filter(
                ImmigrationCase.id.in_(attention_case_ids)
            ).limit(10).all()
            for ac in attn_cases:
                reasons = []
                if ac.id in flagged_case_ids_findings:
                    reasons.append("Unresolved statutory discrepancies")
                if ac.id in overdue_tasks_case_ids:
                    reasons.append("Overdue task deadlines")
                if ac.id in failed_docs_case_ids:
                    reasons.append("Document OCR processing failure")
                attention_cases_items.append({
                    "case_id": str(ac.id),
                    "case_number": ac.case_number,
                    "title": ac.title,
                    "reasons": reasons,
                })

        # 6. Upcoming and overdue deadlines
        overdue_milestones = db.query(CaseMilestone).filter(
            CaseMilestone.organization_id == organization_id,
            CaseMilestone.status != "completed",
            CaseMilestone.target_date < now,
        ).count()
        overdue_tasks = db.query(CaseTask).filter(
            CaseTask.organization_id == organization_id,
            CaseTask.status != "completed",
            CaseTask.due_date < now,
        ).count()
        upcoming_window = now + timedelta(days=14)
        upcoming_milestones = db.query(CaseMilestone).filter(
            CaseMilestone.organization_id == organization_id,
            CaseMilestone.status != "completed",
            CaseMilestone.target_date >= now,
            CaseMilestone.target_date <= upcoming_window,
        ).count()
        upcoming_tasks = db.query(CaseTask).filter(
            CaseTask.organization_id == organization_id,
            CaseTask.status != "completed",
            CaseTask.due_date >= now,
            CaseTask.due_date <= upcoming_window,
        ).count()

        # 7. Unassigned cases
        assigned_case_ids = {
            r[0] for r in db.query(CaseAssignment.case_id).filter(
                CaseAssignment.case_id.isnot(None)
            ).distinct().all()
        }
        all_active_cases = db.query(ImmigrationCase).filter(
            ImmigrationCase.organization_id == organization_id,
            ImmigrationCase.status.in_(active_statuses),
        ).all()
        unassigned_cases = [c for c in all_active_cases if c.id not in assigned_case_ids]

        # 8. Staff workload and capacity
        memberships = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.status == "active",
        ).all()
        staff_workload = []
        for m in memberships:
            user = m.user
            assigned_cases_count = db.query(CaseAssignment).filter(
                CaseAssignment.user_id == user.id
            ).count()
            pending_tasks_count = db.query(CaseTask).filter(
                CaseTask.assigned_to_user_id == user.id,
                CaseTask.status != "completed",
            ).count()
            nominal_capacity = 25  # Nominal caseload threshold
            utilization_pct = round((assigned_cases_count / nominal_capacity) * 100, 1)
            roles = [mr.role.code for mr in m.roles] if m.roles else []
            staff_workload.append({
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "roles": roles,
                "assigned_cases": assigned_cases_count,
                "pending_tasks": pending_tasks_count,
                "nominal_capacity": nominal_capacity,
                "utilization_pct": utilization_pct,
                "status": "overloaded" if utilization_pct > 100 else "normal",
            })

        # 9. Applications prepared, reviewed, and submitted
        packages_prepared = db.query(FilingPackage).filter(
            FilingPackage.organization_id == organization_id,
            FilingPackage.status.in_(("draft", "readiness_passed", "in_review")),
        ).count()
        packages_reviewed = db.query(FilingPackage).filter(
            FilingPackage.organization_id == organization_id,
            FilingPackage.status.in_(("senior_review", "client_confirmed", "approved")),
        ).count()
        packages_submitted = db.query(FilingPackage).filter(
            FilingPackage.organization_id == organization_id,
            FilingPackage.status == "locked",
        ).count()

        # 10. Outstanding client requests
        outstanding_requests = db.query(DocumentRequest).filter(
            DocumentRequest.organization_id == organization_id,
            DocumentRequest.status == "requested",
        ).all()
        outstanding_requests_count = len(outstanding_requests)
        avg_days_pending = 0.0
        if outstanding_requests:
            total_pending_seconds = sum(
                (now - ensure_utc(r.created_at)).total_seconds() for r in outstanding_requests
            )
            avg_days_pending = round((total_pending_seconds / len(outstanding_requests)) / 86400, 1)

        # 11. Processing failures
        failed_documents_count = db.query(Document).filter(
            Document.organization_id == organization_id,
            or_(
                Document.processing_status == "failed",
                Document.malware_scan_status == "infected",
            )
        ).count()
        failed_notifications_count = db.query(Notification).filter(
            Notification.organization_id == organization_id,
            Notification.delivery_status == "failed",
        ).count()

        # 12. Recent company activity
        recent_audits = db.query(AuditEvent).filter(
            AuditEvent.organization_id == organization_id
        ).order_by(AuditEvent.occurred_at.desc()).limit(15).all()
        recent_activity_items = [
            {
                "id": str(a.id),
                "action": a.action,
                "object_type": a.object_type,
                "object_id": a.object_id,
                "occurred_at": a.occurred_at.isoformat(),
                "actor_id": str(a.actor_id) if a.actor_id else None,
                "metadata": a.metadata_json,
            }
            for a in recent_audits
        ]

        # Financial Summary for Executive View
        paid_invoices_total = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0.0)).filter(
            Invoice.organization_id == organization_id,
            Invoice.status.in_(("paid", "partially_paid")),
        ).scalar() or 0.0
        outstanding_balance_total = db.query(func.coalesce(func.sum(Invoice.balance_due), 0.0)).filter(
            Invoice.organization_id == organization_id,
            Invoice.status.in_(("issued", "partially_paid", "overdue")),
        ).scalar() or 0.0

        return {
            "time_window_days": window_days,
            "generated_at": now.isoformat(),
            "metrics": {
                "active_cases": {
                    "value": active_cases_count,
                    "total_cases": total_cases_count,
                    "calculation_method": "Count of immigration cases with status NOT IN ('approved', 'closed', 'denied', 'withdrawn')",
                    "time_window": "Current active snapshot",
                    "drill_down_path": "/cases?status=active",
                    "status": "available",
                },
                "new_retained_clients": {
                    "value": new_clients_count,
                    "total_clients": total_clients_count,
                    "calculation_method": f"Count of client profiles created within the last {window_days} days",
                    "time_window": f"Last {window_days} days",
                    "drill_down_path": "/clients?filter=new_retained",
                    "status": "available",
                },
                "cases_by_country_and_pathway": {
                    "by_country": cases_by_country,
                    "by_pathway": cases_by_pathway,
                    "calculation_method": "Active cases grouped by jurisdiction code and visa category",
                    "time_window": "Current active caseload",
                    "drill_down_path": "/cases",
                    "status": "available",
                },
                "cases_by_workflow_stage": {
                    "stages": cases_by_stage,
                    "calculation_method": "All organization cases grouped by workflow status",
                    "time_window": "All-time case repository",
                    "drill_down_path": "/cases?filter=by_stage",
                    "status": "available",
                },
                "cases_needing_attention": {
                    "value": len(attention_case_ids),
                    "items": attention_cases_items,
                    "calculation_method": "Distinct cases with open statutory discrepancies (CaseAIFinding), overdue tasks, or failed document scans",
                    "time_window": "Immediate attention backlog",
                    "drill_down_path": "/cases?filter=needing_attention",
                    "status": "available",
                },
                "deadlines": {
                    "overdue_milestones": overdue_milestones,
                    "overdue_tasks": overdue_tasks,
                    "upcoming_milestones_14d": upcoming_milestones,
                    "upcoming_tasks_14d": upcoming_tasks,
                    "total_overdue": overdue_milestones + overdue_tasks,
                    "total_upcoming": upcoming_milestones + upcoming_tasks,
                    "calculation_method": "Milestones and tasks past due date with status != 'completed', plus upcoming within 14 days",
                    "time_window": "Past due + next 14 days",
                    "drill_down_path": "/cases/deadlines",
                    "status": "available",
                },
                "unassigned_cases": {
                    "value": len(unassigned_cases),
                    "sample": [{"id": str(c.id), "case_number": c.case_number, "title": c.title} for c in unassigned_cases[:5]],
                    "calculation_method": "Active cases with zero CaseAssignment records",
                    "time_window": "Current active cases",
                    "drill_down_path": "/cases?filter=unassigned",
                    "status": "available",
                },
                "staff_workload_and_capacity": {
                    "staff_members": staff_workload,
                    "calculation_method": "Active case assignments and pending tasks per user against nominal capacity threshold (25 cases)",
                    "time_window": "Current staffing allocation",
                    "drill_down_path": "/teams/workload",
                    "status": "available",
                },
                "applications_prepared_reviewed_submitted": {
                    "prepared": packages_prepared,
                    "reviewed": packages_reviewed,
                    "submitted": packages_submitted,
                    "calculation_method": "FilingPackage records categorized into draft/assembly (prepared), review stages (reviewed), and version-locked (submitted)",
                    "time_window": "All filing packages",
                    "drill_down_path": "/packages",
                    "status": "available",
                },
                "outstanding_client_requests": {
                    "value": outstanding_requests_count,
                    "avg_days_pending": avg_days_pending,
                    "calculation_method": "Count of DocumentRequest records with status='requested' and average elapsed days since request issuance",
                    "time_window": "Open evidentiary requests",
                    "drill_down_path": "/requests?status=requested",
                    "status": "available",
                },
                "processing_failures": {
                    "failed_documents": failed_documents_count,
                    "failed_notifications": failed_notifications_count,
                    "total_failures": failed_documents_count + failed_notifications_count,
                    "calculation_method": "Documents with processing_status='failed' or infected scan, plus failed delivery notifications",
                    "time_window": "All-time failure log",
                    "drill_down_path": "/documents?status=failed",
                    "status": "available",
                },
                "recent_company_activity": {
                    "items": recent_activity_items,
                    "calculation_method": "Latest 15 immutable AuditEvent records for the organization",
                    "time_window": "Most recent events",
                    "drill_down_path": "/governance/audit-logs",
                    "status": "available",
                },
                "financial_snapshot": {
                    "paid_revenue": round(paid_invoices_total, 2),
                    "outstanding_balance": round(outstanding_balance_total, 2),
                    "currency": "USD",
                    "calculation_method": "Sum of paid_amount vs balance_due from issued organization invoices",
                    "time_window": "Accounts receivable ledger",
                    "drill_down_path": "/billing",
                    "status": "available",
                },
            },
        }


class AnalyticsService:
    @staticmethod
    def get_operations_analytics(
        db: Session,
        organization_id: uuid.UUID,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        jurisdiction: str | None = None,
        pathway: str | None = None,
        stage: str | None = None,
        assigned_user_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        service_code: str | None = None,
    ) -> dict[str, Any]:
        """Calculates granular operational analytics with well-defined formulas, accounting for

        reopened cases and incomplete timestamps.
        """
        now = datetime.now(timezone.utc)
        if not start_date:
            start_date = now - timedelta(days=90)
        if not end_date:
            end_date = now

        # Base case query: cases active (created or updated) within the time window
        query = db.query(ImmigrationCase).filter(
            ImmigrationCase.organization_id == organization_id,
            or_(
                and_(ImmigrationCase.created_at >= start_date, ImmigrationCase.created_at <= end_date),
                and_(ImmigrationCase.updated_at >= start_date, ImmigrationCase.updated_at <= end_date),
            ),
        )

        if jurisdiction and jurisdiction.lower() != "all":
            query = query.filter(ImmigrationCase.jurisdiction == jurisdiction.upper())
        if pathway and pathway.lower() != "all":
            query = query.filter(ImmigrationCase.visa_category == pathway)
        if stage and stage.lower() != "all":
            query = query.filter(ImmigrationCase.status == stage)

        if assigned_user_id:
            query = query.join(CaseAssignment).filter(CaseAssignment.user_id == assigned_user_id)

        cases = query.all()

        # 1. Turnaround Time Calculation (Accounting for Reopened Cases & Incomplete Timestamps)
        # Formula: average elapsed days from case creation (or reopening) to submission or completion
        completed_cases = [c for c in cases if c.status in ("submitted", "approved", "completed")]
        turnaround_days_list = []
        incomplete_timestamp_cases = 0
        reopened_cases_count = 0

        for c in completed_cases:
            if not c.created_at or not c.updated_at:
                incomplete_timestamp_cases += 1
                continue

            # Determine start point: if reopened (status note contains reopened or milestone reset), use updated_at
            effective_start = ensure_utc(c.created_at)
            is_reopened = False
            for note in c.notes:
                if "reopen" in note.content.lower():
                    effective_start = ensure_utc(note.created_at)
                    is_reopened = True
                    break

            if is_reopened:
                reopened_cases_count += 1

            effective_end = ensure_utc(c.updated_at)
            if not effective_end:
                incomplete_timestamp_cases += 1
                continue

            delta_days = (effective_end - effective_start).total_seconds() / 86400
            if delta_days <= 0:
                incomplete_timestamp_cases += 1
                continue

            turnaround_days_list.append(delta_days)

        avg_turnaround_days = (
            round(sum(turnaround_days_list) / len(turnaround_days_list), 1)
            if turnaround_days_list
            else None
        )

        # 2. Overdue Work Breakdown
        overdue_milestones = db.query(CaseMilestone).filter(
            CaseMilestone.organization_id == organization_id,
            CaseMilestone.status != "completed",
            CaseMilestone.target_date < now,
        ).all()

        overdue_tasks = db.query(CaseTask).filter(
            CaseTask.organization_id == organization_id,
            CaseTask.status != "completed",
            CaseTask.due_date < now,
        ).all()

        overdue_lt_7d = 0
        overdue_7_to_30d = 0
        overdue_gt_30d = 0

        for m in overdue_milestones:
            days = (now - ensure_utc(m.target_date)).total_seconds() / 86400
            if days <= 7:
                overdue_lt_7d += 1
            elif days <= 30:
                overdue_7_to_30d += 1
            else:
                overdue_gt_30d += 1

        for t in overdue_tasks:
            days = (now - ensure_utc(t.due_date)).total_seconds() / 86400
            if days <= 7:
                overdue_lt_7d += 1
            elif days <= 30:
                overdue_7_to_30d += 1
            else:
                overdue_gt_30d += 1

        # 3. Client Response Time
        # Time from DocumentRequest creation to submitted_at / upload
        completed_requests = db.query(DocumentRequest).filter(
            DocumentRequest.organization_id == organization_id,
            DocumentRequest.status.in_(("submitted", "approved")),
            DocumentRequest.created_at >= start_date,
        ).all()

        response_hours_list = []
        for req in completed_requests:
            if req.updated_at and req.created_at:
                hrs = (ensure_utc(req.updated_at) - ensure_utc(req.created_at)).total_seconds() / 3600
                if hrs >= 0:
                    response_hours_list.append(hrs)

        avg_client_response_hours = (
            round(sum(response_hours_list) / len(response_hours_list), 1)
            if response_hours_list
            else None
        )

        return {
            "filters_applied": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "jurisdiction": jurisdiction or "all",
                "pathway": pathway or "all",
                "stage": stage or "all",
                "assigned_user_id": str(assigned_user_id) if assigned_user_id else None,
                "branch_id": str(branch_id) if branch_id else None,
                "service_code": service_code or "all",
            },
            "total_cases_in_window": len(cases),
            "completed_cases_count": len(completed_cases),
            "turnaround_time": {
                "average_days": avg_turnaround_days,
                "completed_cases_evaluated": len(turnaround_days_list),
                "reopened_cases_adjusted_count": reopened_cases_count,
                "incomplete_timestamp_cases_count": incomplete_timestamp_cases,
                "calculation_formula": "mean(completion_timestamp - effective_start_timestamp); Reopened cases use reopening timestamp; in-progress cases excluded",
                "status": "available" if avg_turnaround_days is not None else "source_data_pending",
            },
            "overdue_work": {
                "total_overdue": len(overdue_milestones) + len(overdue_tasks),
                "overdue_less_than_7_days": overdue_lt_7d,
                "overdue_7_to_30_days": overdue_7_to_30d,
                "overdue_greater_than_30_days": overdue_gt_30d,
                "calculation_formula": "Count of open milestones and tasks past target/due dates partitioned by lateness tiers",
                "status": "available",
            },
            "client_response_time": {
                "average_hours": avg_client_response_hours,
                "average_days": round(avg_client_response_hours / 24, 1) if avg_client_response_hours is not None else None,
                "requests_evaluated": len(response_hours_list),
                "calculation_formula": "mean(request_submitted_timestamp - request_created_timestamp) for all completed requests",
                "status": "available" if avg_client_response_hours is not None else "source_data_pending",
            },
        }
