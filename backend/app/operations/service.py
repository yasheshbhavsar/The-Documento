"""Company Operations Service

Manages employee memberships, branches, teams, case & task reassignments (including bulk transfers),
internal workload & capacity views, organization settings, and access & activity reporting.
"""
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session

from backend.app.core.errors import EntityNotFoundError, ValidationError
from backend.app.domain.models import (
    Organization,
    Branch,
    Team,
    User,
    Role,
    OrganizationMembership,
    MembershipRole,
    CaseAssignment,
    CaseTask,
    ImmigrationCase,
    OrganizationSetting,
    AuditEvent,
)


class CompanyOperationsService:
    @staticmethod
    def update_membership(
        db: Session,
        organization_id: uuid.UUID,
        membership_id: uuid.UUID,
        data: dict[str, Any],
        actor_id: uuid.UUID | None = None,
    ) -> OrganizationMembership:
        membership = db.query(OrganizationMembership).filter(
            OrganizationMembership.id == membership_id,
            OrganizationMembership.organization_id == organization_id,
        ).first()
        if not membership:
            raise EntityNotFoundError("OrganizationMembership", membership_id)

        now = datetime.now(timezone.utc)
        if "status" in data:
            membership.status = data["status"]

        if "branch_id" in data:
            branch_id_val = uuid.UUID(data["branch_id"]) if data["branch_id"] else None
            if branch_id_val:
                b = db.query(Branch).filter(Branch.id == branch_id_val, Branch.organization_id == organization_id).first()
                if not b:
                    raise EntityNotFoundError("Branch", branch_id_val)
            membership.branch_id = branch_id_val

        if "team_id" in data:
            team_id_val = uuid.UUID(data["team_id"]) if data["team_id"] else None
            if team_id_val:
                t = db.query(Team).filter(Team.id == team_id_val, Team.organization_id == organization_id).first()
                if not t:
                    raise EntityNotFoundError("Team", team_id_val)
            membership.team_id = team_id_val

        if "role_codes" in data:
            # Replace roles
            db.query(MembershipRole).filter(MembershipRole.membership_id == membership.id).delete()
            for code in data["role_codes"]:
                role = db.query(Role).filter(Role.code == code).first()
                if role:
                    db.add(MembershipRole(membership_id=membership.id, role_id=role.id, assigned_at=now))

        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="operations.membership_updated",
            object_type="organization_membership",
            object_id=str(membership.id),
            metadata_json={"user_id": str(membership.user_id), "status": membership.status},
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(membership)
        return membership

    @staticmethod
    def reassign_work(
        db: Session,
        organization_id: uuid.UUID,
        from_user_id: uuid.UUID,
        to_user_id: uuid.UUID,
        reassign_cases: bool = True,
        reassign_tasks: bool = True,
        case_ids: list[str] | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Transfers case assignments and pending tasks from one staff member to another (supports bulk)."""
        now = datetime.now(timezone.utc)
        to_user = db.query(User).filter(User.id == to_user_id).first()
        if not to_user:
            raise EntityNotFoundError("User", to_user_id)

        cases_reassigned = 0
        tasks_reassigned = 0

        if reassign_cases:
            case_assign_query = db.query(CaseAssignment).join(ImmigrationCase).filter(
                ImmigrationCase.organization_id == organization_id,
                CaseAssignment.user_id == from_user_id,
            )
            if case_ids:
                case_uuids = [uuid.UUID(cid) for cid in case_ids]
                case_assign_query = case_assign_query.filter(CaseAssignment.case_id.in_(case_uuids))

            assignments = case_assign_query.all()
            for a in assignments:
                # Check if to_user is already assigned with this role in case
                existing = db.query(CaseAssignment).filter(
                    CaseAssignment.case_id == a.case_id,
                    CaseAssignment.user_id == to_user_id,
                    CaseAssignment.role_in_case == a.role_in_case,
                ).first()
                if not existing:
                    a.user_id = to_user_id
                    a.assigned_at = now
                    cases_reassigned += 1
                else:
                    db.delete(a)
                    cases_reassigned += 1

        if reassign_tasks:
            task_query = db.query(CaseTask).filter(
                CaseTask.organization_id == organization_id,
                CaseTask.assigned_to_user_id == from_user_id,
                CaseTask.status != "completed",
            )
            if case_ids:
                case_uuids = [uuid.UUID(cid) for cid in case_ids]
                task_query = task_query.filter(CaseTask.case_id.in_(case_uuids))

            tasks = task_query.all()
            for t in tasks:
                t.assigned_to_user_id = to_user_id
                tasks_reassigned += 1

        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="operations.work_reassigned",
            object_type="reassignment",
            object_id=f"{from_user_id}->{to_user_id}",
            metadata_json={
                "from_user_id": str(from_user_id),
                "to_user_id": str(to_user_id),
                "cases_reassigned": cases_reassigned,
                "tasks_reassigned": tasks_reassigned,
            },
            occurred_at=now,
        )
        db.add(audit)
        db.commit()

        return {
            "from_user_id": str(from_user_id),
            "to_user_id": str(to_user_id),
            "cases_reassigned": cases_reassigned,
            "tasks_reassigned": tasks_reassigned,
            "reassigned_at": now.isoformat(),
        }

    @staticmethod
    def get_internal_workload(db: Session, organization_id: uuid.UUID) -> list[dict[str, Any]]:
        """Returns staff workload, capacity utilization, and pending task queues."""
        memberships = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.status == "active",
        ).all()

        workloads = []
        for m in memberships:
            user = m.user
            assigned_cases = db.query(CaseAssignment).join(ImmigrationCase).filter(
                ImmigrationCase.organization_id == organization_id,
                CaseAssignment.user_id == user.id,
                ImmigrationCase.status.notin_(("approved", "closed", "denied")),
            ).all()

            pending_tasks = db.query(CaseTask).filter(
                CaseTask.organization_id == organization_id,
                CaseTask.assigned_to_user_id == user.id,
                CaseTask.status != "completed",
            ).all()

            roles = [mr.role.code for mr in m.roles] if m.roles else []
            nominal_cap = 25
            active_cnt = len(assigned_cases)
            util_pct = round((active_cnt / nominal_cap) * 100, 1)

            workloads.append({
                "membership_id": str(m.id),
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "roles": roles,
                "branch_id": str(m.branch_id) if m.branch_id else None,
                "team_id": str(m.team_id) if m.team_id else None,
                "active_cases_count": active_cnt,
                "pending_tasks_count": len(pending_tasks),
                "capacity_utilization_pct": util_pct,
                "is_overloaded": util_pct > 100,
            })
        return workloads

    @staticmethod
    def get_organization_settings(db: Session, organization_id: uuid.UUID) -> dict[str, Any]:
        """Retrieves organization-wide settings with default fallback values."""
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        if not org:
            raise EntityNotFoundError("Organization", organization_id)

        settings_rows = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == organization_id
        ).all()
        settings_map = {s.setting_key: s.setting_value_json for s in settings_rows}

        return {
            "firm_name": settings_map.get("firm_name", {"value": org.name}).get("value", org.name),
            "billing_currency": settings_map.get("billing_currency", {"value": "USD"}).get("value", "USD"),
            "default_jurisdiction": settings_map.get("default_jurisdiction", {"value": "US"}).get("value", "US"),
            "invoice_prefix": settings_map.get("invoice_prefix", {"value": "INV"}).get("value", "INV"),
            "deadline_warning_days": settings_map.get("deadline_warning_days", {"value": 14}).get("value", 14),
            "require_two_step_case_closure": settings_map.get("require_two_step_case_closure", {"value": True}).get("value", True),
            "allow_client_portal_billing": settings_map.get("allow_client_portal_billing", {"value": True}).get("value", True),
        }

    @staticmethod
    def update_organization_setting(
        db: Session,
        organization_id: uuid.UUID,
        key: str,
        value: Any,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        setting = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == organization_id,
            OrganizationSetting.setting_key == key,
        ).first()

        if not setting:
            setting = OrganizationSetting(
                organization_id=organization_id,
                setting_key=key,
                setting_value_json={"value": value},
                updated_by_id=actor_id,
                updated_at=now,
            )
            db.add(setting)
        else:
            setting.setting_value_json = {"value": value}
            setting.updated_by_id = actor_id
            setting.updated_at = now

        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="operations.setting_updated",
            object_type="organization_setting",
            object_id=key,
            metadata_json={"key": key, "new_value": value},
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        return {key: value}

    @staticmethod
    def get_access_activity_report(
        db: Session,
        organization_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        action: str | None = None,
        limit: int = 50,
        export_audit: bool = False,
        exporter_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Queries audit log events.

        If export_audit is True, logs an immutable audit event recording the export itself.
        """
        query = db.query(AuditEvent).filter(AuditEvent.organization_id == organization_id)
        if actor_id:
            query = query.filter(AuditEvent.actor_id == actor_id)
        if action:
            query = query.filter(AuditEvent.action.ilike(f"%{action}%"))

        events = query.order_by(AuditEvent.occurred_at.desc()).limit(limit).all()

        if export_audit:
            now = datetime.now(timezone.utc)
            audit = AuditEvent(
                organization_id=organization_id,
                actor_id=exporter_id,
                action="governance.audit_report_exported",
                object_type="audit_report",
                object_id=str(organization_id),
                metadata_json={"record_count": len(events), "filters": {"actor_id": str(actor_id) if actor_id else None, "action": action}},
                occurred_at=now,
            )
            db.add(audit)
            db.commit()

        return [
            {
                "id": str(e.id),
                "action": e.action,
                "actor_id": str(e.actor_id) if e.actor_id else None,
                "object_type": e.object_type,
                "object_id": e.object_id,
                "occurred_at": e.occurred_at.isoformat(),
                "metadata": e.metadata_json,
            }
            for e in events
        ]
