"""Client Inactivity Lifecycle Engine.

Enforces agreed lifecycle rules:
- Warns on Days 7, 10, 14 if no meaningful client/checklist progress.
- Applies agreed Day-15 cleanup to eligible files even if checklist is complete/incomplete.
- Internal-only staff activity strictly NEVER resets client inactivity.
- Unresolved anomaly files and legal holds are excluded from cleanup until resolved.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.documents.retention import (
    is_document_on_legal_hold,
    get_unresolved_document_findings,
    purge_document,
)
from backend.app.domain.models import (
    AuditEvent,
    Document,
    ImmigrationCase,
    Notification,
    now_utc,
)

logger = logging.getLogger("ai_immigration.documents.inactivity")


class DocumentInactivityService:
    @staticmethod
    def record_client_activity(
        db: Session,
        case: ImmigrationCase,
        activity_type: str = "client_upload",
        actor_id: Optional[UUID] = None,
    ) -> None:
        """
        Records meaningful client progress (upload, questionnaire response, client message).
        Resets inactivity warning levels.
        """
        now = now_utc()
        case.last_client_activity_at = now
        case.inactivity_warning_level = 0
        case.updated_at = now

        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=actor_id,
            action="case.client_activity_recorded",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "activity_type": activity_type,
                "recorded_at": now.isoformat(),
                "inactivity_counter_reset": True,
            },
            occurred_at=now,
        )
        db.add(audit)
        db.commit()

    @staticmethod
    def evaluate_case_inactivity(
        db: Session,
        case: ImmigrationCase,
        now: Optional[datetime] = None,
        system_actor_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates elapsed client inactivity and executes stage warnings or day-15 cleanup.
        """
        current_time = now or now_utc()
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        ref_time = case.last_client_activity_at or case.created_at
        if ref_time.tzinfo is None:
            ref_time = ref_time.replace(tzinfo=timezone.utc)

        elapsed_seconds = (current_time - ref_time).total_seconds()
        elapsed_days = max(0.0, round(elapsed_seconds / 86400.0, 2))

        result = {
            "case_id": str(case.id),
            "case_number": case.case_number,
            "elapsed_days": elapsed_days,
            "previous_warning_level": case.inactivity_warning_level,
            "current_warning_level": case.inactivity_warning_level,
            "action_taken": "none",
            "purged_documents_count": 0,
            "excluded_anomalies_count": 0,
            "excluded_holds_count": 0,
        }

        # Client profile user ID for notifications
        client_user_id = None
        if case.client and case.client.user_id:
            client_user_id = case.client.user_id

        # Day 7 Warning
        if elapsed_days >= 7.0 and case.inactivity_warning_level < 1:
            case.inactivity_warning_level = 1
            result["current_warning_level"] = 1
            result["action_taken"] = "day_7_warning"

            if client_user_id:
                notif = Notification(
                    organization_id=case.organization_id,
                    user_id=client_user_id,
                    title="Case Activity Reminder (Day 7)",
                    body=(
                        f"Notice: It has been 7 days since your last upload or checklist response "
                        f"for Case #{case.case_number}. Please submit outstanding documents to maintain file active status."
                    ),
                    type="warning",
                )
                db.add(notif)

            audit = AuditEvent(
                organization_id=case.organization_id,
                actor_id=system_actor_id,
                action="case.inactivity_warning_day_7",
                object_type="immigration_case",
                object_id=str(case.id),
                metadata_json={
                    "elapsed_days": elapsed_days,
                    "warning_level": 1,
                },
                occurred_at=current_time,
            )
            db.add(audit)
            db.commit()

        # Day 10 Warning
        elif elapsed_days >= 10.0 and case.inactivity_warning_level < 2:
            case.inactivity_warning_level = 2
            result["current_warning_level"] = 2
            result["action_taken"] = "day_10_warning"

            if client_user_id:
                notif = Notification(
                    organization_id=case.organization_id,
                    user_id=client_user_id,
                    title="Second Inactivity Reminder (Day 10)",
                    body=(
                        f"Second Notice: 10 days of inactivity on Case #{case.case_number}. "
                        f"Temporary files are scheduled for automatic lifecycle cleanup on Day 15 if no progress is made."
                    ),
                    type="warning",
                )
                db.add(notif)

            audit = AuditEvent(
                organization_id=case.organization_id,
                actor_id=system_actor_id,
                action="case.inactivity_warning_day_10",
                object_type="immigration_case",
                object_id=str(case.id),
                metadata_json={
                    "elapsed_days": elapsed_days,
                    "warning_level": 2,
                },
                occurred_at=current_time,
            )
            db.add(audit)
            db.commit()

        # Day 14 Urgent Warning
        elif elapsed_days >= 14.0 and case.inactivity_warning_level < 3:
            case.inactivity_warning_level = 3
            result["current_warning_level"] = 3
            result["action_taken"] = "day_14_urgent_warning"

            if client_user_id:
                notif = Notification(
                    organization_id=case.organization_id,
                    user_id=client_user_id,
                    title="FINAL NOTICE: Document Cleanup Scheduled Tomorrow (Day 14)",
                    body=(
                        f"Urgent: Case #{case.case_number} has been inactive for 14 days. "
                        f"In accordance with our temporary data lifecycle policy, eligible temporary files "
                        f"will be permanently cleaned up on Day 15."
                    ),
                    type="warning",
                )
                db.add(notif)

            audit = AuditEvent(
                organization_id=case.organization_id,
                actor_id=system_actor_id,
                action="case.inactivity_warning_day_14",
                object_type="immigration_case",
                object_id=str(case.id),
                metadata_json={
                    "elapsed_days": elapsed_days,
                    "warning_level": 3,
                },
                occurred_at=current_time,
            )
            db.add(audit)
            db.commit()

        # Day 15 Cleanup
        elif elapsed_days >= 15.0 and case.inactivity_warning_level < 4:
            case.inactivity_warning_level = 4
            result["current_warning_level"] = 4
            result["action_taken"] = "day_15_cleanup_applied"

            # Execute cleanup of eligible files
            documents = (
                db.query(Document)
                .filter(
                    Document.organization_id == case.organization_id,
                    Document.case_id == case.id,
                    Document.is_purged.is_(False),
                )
                .all()
            )

            purged_count = 0
            anomalies_count = 0
            holds_count = 0

            for doc in documents:
                # 1. Skip documents on legal hold
                if is_document_on_legal_hold(doc):
                    holds_count += 1
                    continue

                # 2. Skip documents with unresolved anomalies
                if getattr(doc, "has_unresolved_anomaly", False) or len(get_unresolved_document_findings(db, doc)) > 0:
                    anomalies_count += 1
                    continue

                # 3. Purge eligible document
                try:
                    purge_document(
                        db=db,
                        document_id=doc.id,
                        organization_id=case.organization_id,
                        actor_id=system_actor_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
                        reason="Automated 15-day client inactivity lifecycle cleanup",
                        bypass_retention_window=True,
                    )
                    purged_count += 1
                except Exception as e:
                    logger.warning("Failed to purge document %s during day 15 cleanup: %s", str(doc.id), e)

            result["purged_documents_count"] = purged_count
            result["excluded_anomalies_count"] = anomalies_count
            result["excluded_holds_count"] = holds_count

            audit = AuditEvent(
                organization_id=case.organization_id,
                actor_id=system_actor_id,
                action="case.inactivity_cleanup_applied",
                object_type="immigration_case",
                object_id=str(case.id),
                metadata_json={
                    "elapsed_days": elapsed_days,
                    "purged_count": purged_count,
                    "excluded_anomalies": anomalies_count,
                    "excluded_holds": holds_count,
                },
                occurred_at=current_time,
            )
            db.add(audit)
            db.commit()

        return result
