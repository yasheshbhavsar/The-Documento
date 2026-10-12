"""Affected cases identification and review queuing.

When a published rule version is updated, superseded, or activated:
Identifies all active/open cases in the matching jurisdiction and pathway.
Avoids silently rewriting historical decisions or prior evaluations.
Instead, creates high-priority review tasks for caseworkers to review against the new rule version.
"""
from datetime import datetime, timezone
import uuid
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

try:
    from backend.app.domain.models import (
        ImmigrationCase,
        RuleSet,
        RuleSetVersion,
        CaseRequirementEvaluation,
        CaseTask,
    )
except ImportError:
    from app.domain.models import (
        ImmigrationCase,
        RuleSet,
        RuleSetVersion,
        CaseRequirementEvaluation,
        CaseTask,
    )


CLOSED_CASE_STATUSES = {"closed", "decision_received", "withdrawn", "rejected"}


def identify_and_queue_affected_cases(
    db: Session,
    rule_set_version: RuleSetVersion,
    triggered_by_user_id: uuid.UUID | None = None,
    create_review_tasks: bool = True,
) -> dict[str, Any]:
    """Finds open cases affected by a rule set version change and queues review tasks.

    Does NOT silently re-evaluate or overwrite existing case evaluations.
    """
    rule_set = db.get(RuleSet, rule_set_version.rule_set_id)
    if not rule_set:
        raise ValueError(f"Rule set {rule_set_version.rule_set_id} not found")

    # 1. Query all non-closed cases for this organization matching jurisdiction and program_pathway
    stmt = (
        select(ImmigrationCase)
        .where(
            and_(
                ImmigrationCase.organization_id == rule_set.organization_id,
                ImmigrationCase.jurisdiction == rule_set.jurisdiction,
                ImmigrationCase.visa_category == rule_set.program_pathway,
                ImmigrationCase.status.not_in(CLOSED_CASE_STATUSES),
            )
        )
    )
    open_cases = list(db.scalars(stmt).all())

    affected_cases = []
    created_task_ids = []

    for case in open_cases:
        # Check latest evaluation for this case
        latest_eval_stmt = (
            select(CaseRequirementEvaluation)
            .where(CaseRequirementEvaluation.case_id == case.id)
            .order_by(CaseRequirementEvaluation.evaluated_at.desc())
            .limit(1)
        )
        latest_eval = db.scalar(latest_eval_stmt)

        # A case is affected if:
        # 1. It has never been evaluated against this version, OR
        # 2. Its latest evaluation used an older or different rule_set_version
        is_affected = False
        prev_version_str = "None"
        prev_status = "un-evaluated"

        if not latest_eval:
            is_affected = True
        elif latest_eval.rule_set_version_id != rule_set_version.id:
            is_affected = True
            prev_status = latest_eval.status
            # Get old version number
            old_v = db.get(RuleSetVersion, latest_eval.rule_set_version_id)
            if old_v:
                prev_version_str = old_v.version_number
            else:
                prev_version_str = str(latest_eval.rule_set_version_id)

        if is_affected:
            case_entry = {
                "case_id": str(case.id),
                "case_number": case.case_number,
                "current_processing_stage": getattr(case, "processing_stage", getattr(case, "status", "intake")),
                "previous_evaluation_status": prev_status,
                "previous_rule_version": prev_version_str,
                "assigned_case_manager_id": str(getattr(case, "case_manager_id", None)) if getattr(case, "case_manager_id", None) else None,
            }

            if create_review_tasks:
                # Create a CaseTask for caseworker review
                task_title = f"Review rules update: {rule_set.name} v{rule_set_version.version_number}"
                task_desc = (
                    f"Official rules for {rule_set.jurisdiction} - {rule_set.program_pathway} were updated "
                    f"to version {rule_set_version.version_number} (Status: {rule_set_version.status}). "
                    f"Changes: {rule_set_version.change_summary or 'Standard revision'}. "
                    f"Please review case documents and re-evaluate requirements against updated rules."
                )
                cm_id = getattr(case, "case_manager_id", None)
                rev_id = getattr(case, "reviewer_id", None)
                assigned_user = cm_id or rev_id or triggered_by_user_id

                review_task = CaseTask(
                    organization_id=case.organization_id,
                    case_id=case.id,
                    title=task_title,
                    description=task_desc,
                    priority="high",
                    status="pending",
                    assigned_to_user_id=assigned_user,
                    is_completed=False,
                )
                db.add(review_task)
                db.flush()
                case_entry["task_id"] = str(review_task.id)
                created_task_ids.append(str(review_task.id))

            affected_cases.append(case_entry)

    if create_review_tasks and created_task_ids:
        db.commit()

    return {
        "rule_set_id": str(rule_set.id),
        "rule_set_code": rule_set.code,
        "rule_set_version_id": str(rule_set_version.id),
        "version_number": rule_set_version.version_number,
        "jurisdiction": rule_set.jurisdiction,
        "program_pathway": rule_set.program_pathway,
        "total_open_cases_inspected": len(open_cases),
        "affected_cases_count": len(affected_cases),
        "affected_cases": affected_cases,
        "tasks_queued_count": len(created_task_ids),
    }
