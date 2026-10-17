"""Case Migration and Change Control Service for Phase 6.

Enforces strict invariants:
- Existing cases retain a pinned checklist snapshot; updates do not silently rewrite active cases.
- Migration to a new rule pack version is explicit, authorized, auditable, and documents diff impact.
"""
from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

try:
    from backend.app.domain.models import (
        ImmigrationCase,
        RuleSet,
        RuleSetVersion,
        RuleRequirement,
        AuditEvent,
    )
    from backend.app.rules.checklist_generator import generate_pathway_checklist
except ImportError:
    from app.domain.models import (
        ImmigrationCase,
        RuleSet,
        RuleSetVersion,
        RuleRequirement,
        AuditEvent,
    )
    from app.rules.checklist_generator import generate_pathway_checklist


def get_case_pinned_checklist(case: ImmigrationCase) -> Dict[str, Any]:
    """Returns the pinned checklist snapshot for an active case."""
    if not case.pinned_checklist_snapshot:
        return {
            "case_id": str(case.id),
            "is_pinned": False,
            "pinned_rule_version_id": None,
            "checklist": [],
            "message": "Case does not have a pinned rule pack snapshot.",
        }

    return {
        "case_id": str(case.id),
        "case_number": case.case_number,
        "is_pinned": True,
        "pinned_rule_version_id": str(case.pinned_rule_version_id) if case.pinned_rule_version_id else None,
        "snapshot_pinned_at": case.snapshot_pinned_at.isoformat() if case.snapshot_pinned_at else None,
        "rules_update_available": case.rules_update_available,
        "latest_available_version_id": str(case.latest_available_version_id) if case.latest_available_version_id else None,
        "snapshot": case.pinned_checklist_snapshot,
    }


def compare_rule_versions(from_version: RuleSetVersion, to_version: RuleSetVersion) -> Dict[str, Any]:
    """Calculates granular requirement diffs between two rule pack versions."""
    from_reqs = {r.code: r for r in from_version.requirements}
    to_reqs = {r.code: r for r in to_version.requirements}

    added = []
    removed = []
    modified = []
    unchanged = []

    for code, req in to_reqs.items():
        if code not in from_reqs:
            added.append({
                "code": req.code,
                "title": req.title,
                "category": req.category,
                "is_mandatory": req.is_mandatory,
            })
        else:
            old = from_reqs[code]
            changes = []
            if old.is_mandatory != req.is_mandatory:
                changes.append(f"Mandatory changed from {old.is_mandatory} to {req.is_mandatory}")
            if old.applicability_conditions != req.applicability_conditions:
                changes.append("Applicability conditions updated")
            if old.accepted_evidence_types != req.accepted_evidence_types:
                changes.append("Accepted evidence types updated")

            if changes:
                modified.append({
                    "code": req.code,
                    "title": req.title,
                    "changes": changes,
                })
            else:
                unchanged.append(req.code)

    for code, req in from_reqs.items():
        if code not in to_reqs:
            removed.append({
                "code": req.code,
                "title": req.title,
                "category": req.category,
            })

    return {
        "from_version": from_version.version_number,
        "to_version": to_version.version_number,
        "added_count": len(added),
        "removed_count": len(removed),
        "modified_count": len(modified),
        "unchanged_count": len(unchanged),
        "requirements_added": added,
        "requirements_removed": removed,
        "requirements_modified": modified,
    }


def migrate_case_rule_version(
    db: Session,
    case: ImmigrationCase,
    target_version_id: uuid.UUID,
    migration_reason: str,
    authorized_user_id: uuid.UUID,
    authorized_user_email: str = "counsel@lawfirm.com",
) -> Dict[str, Any]:
    """Explicitly migrates an existing case from its pinned rule version to a new target version.
    Never silently rewrites active cases; preserves audit trail and calculates diff impact.
    """
    target_version = db.get(RuleSetVersion, target_version_id)
    if not target_version or target_version.status != "published":
        raise ValueError("Target rule set version must exist and be in published status.")

    from_version_id = case.pinned_rule_version_id
    from_version = db.get(RuleSetVersion, from_version_id) if from_version_id else None

    # Calculate diff impact if prior version exists
    diff_report = {}
    if from_version:
        diff_report = compare_rule_versions(from_version, target_version)

    # Generate new checklist for the case
    applicant_facts = {
        "nationality": case.client.nationality if case.client else "USA",
    }
    new_checklist = generate_pathway_checklist(
        db=db,
        org_id=case.organization_id,
        jurisdiction=case.jurisdiction,
        pathway=case.visa_category,
        applicant_facts=applicant_facts,
        case_id=case.id,
        pin_to_case=True,
        rule_version_id=target_version.id,
    )


    # Update case state
    case.pinned_rule_version_id = target_version.id
    case.pinned_checklist_snapshot = new_checklist
    case.snapshot_pinned_at = datetime.now(timezone.utc)
    case.rules_update_available = False
    case.latest_available_version_id = target_version.id

    # Create immutable audit record
    audit = AuditEvent(
        organization_id=case.organization_id,
        action="case.rule_pack_migrated",
        object_type="immigration_case",
        object_id=str(case.id),
        actor_id=authorized_user_id,
        metadata_json={
            "case_number": case.case_number,
            "from_version_id": str(from_version_id) if from_version_id else None,
            "from_version_number": from_version.version_number if from_version else "unversioned",
            "to_version_id": str(target_version.id),
            "to_version_number": target_version.version_number,
            "migration_reason": migration_reason,
            "authorized_user_email": authorized_user_email,
            "diff_summary": diff_report,
        },
    )
    db.add(audit)

    db.commit()

    return {
        "success": True,
        "case_id": str(case.id),
        "case_number": case.case_number,
        "from_version_number": from_version.version_number if from_version else "unversioned",
        "to_version_number": target_version.version_number,
        "migrated_at": case.snapshot_pinned_at.isoformat(),
        "migration_reason": migration_reason,
        "impact": diff_report,
        "pinned_checklist": new_checklist,
        "audit_event_id": str(audit.id),
    }
