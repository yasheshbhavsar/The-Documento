"""Fact-Grounded Checklist Generation & Safe Stop Engine.

Adheres strictly to Phase 6 Core Invariants:
1. Checklist is generated from actual jurisdiction/pathway/applicant facts and an approved rule version.
2. Unsupported pathway stops safely with SUPPORTED / PARTIAL / UNVERIFIED / UNSUPPORTED state; NO unrelated fallback checklist!
3. Existing cases retain a pinned checklist snapshot; updates do not silently rewrite active cases.
4. Stale/unverified rules cannot be presented as current.
5. All requirements output exact Phase 6 JSON structure with version provenance and human approver.
"""
from datetime import datetime, timezone, timedelta
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

try:
    from backend.app.domain.models import (
        RuleSet,
        RuleSetVersion,
        RuleRequirement,
        ImmigrationCase,
    )
    from backend.app.rules.taxonomy import (
        CoverageStatus,
        get_pathway_coverage,
        PATHWAY_TAXONOMY,
        COUNTRY_REGISTRY,
    )
    from backend.app.rules.declarative_evaluator import evaluate_condition
except ImportError:
    from app.domain.models import (
        RuleSet,
        RuleSetVersion,
        RuleRequirement,
        ImmigrationCase,
    )
    from app.rules.taxonomy import (
        CoverageStatus,
        get_pathway_coverage,
        PATHWAY_TAXONOMY,
        COUNTRY_REGISTRY,
    )
    from app.rules.declarative_evaluator import evaluate_condition


MAX_VERIFICATION_AGE_DAYS = 365  # Rules older than 365 days without re-verification become STALE


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_rule_stale(req: RuleRequirement, as_of_date: datetime) -> bool:
    """Returns True if rule requirement is stale or expired."""
    if req.status in ["STALE", "DEPRECATED", "SUSPENDED"]:
        return True

    as_of = _ensure_utc(as_of_date) or datetime.now(timezone.utc)

    # Check effective_to date
    eff_to = _ensure_utc(req.effective_to)
    if eff_to and eff_to < as_of:
        return True

    # Check verification horizon
    last_ver = _ensure_utc(req.last_verified_at)
    if last_ver:
        age = as_of - last_ver
        if age > timedelta(days=MAX_VERIFICATION_AGE_DAYS):
            return True

    return False



def generate_pathway_checklist(
    db: Session,
    org_id: uuid.UUID,
    jurisdiction: str,
    pathway: str,
    applicant_facts: Optional[Dict[str, Any]] = None,
    as_of_date: Optional[datetime] = None,
    case_id: Optional[uuid.UUID] = None,
    pin_to_case: bool = False,
    rule_version_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:

    """Generates a tailored, fact-grounded checklist from approved rules, stopping safely on unvalidated pathways."""
    facts = applicant_facts or {}
    effective_as_of = as_of_date or datetime.now(timezone.utc)
    jur_upper = jurisdiction.upper()

    # Step 1: Query Coverage Matrix
    coverage = get_pathway_coverage(jur_upper, pathway)

    # Safe Stop: UNSUPPORTED
    if coverage == CoverageStatus.UNSUPPORTED:
        return {
            "status": "UNSUPPORTED",
            "jurisdiction": jur_upper,
            "pathway": pathway,
            "is_supported": False,
            "can_generate_checklist": False,
            "message": f"Pathway '{pathway}' in jurisdiction '{jur_upper}' is UNSUPPORTED. Documento adheres to strict validation standards and never presents unrelated fallback checklists.",
            "disclaimer": "SAFE STOP: Long-term breadth is an ambition, not permission to market unvalidated pathways as complete.",
            "checklist": [],
            "rule_version": None,
            "applicable_count": 0,
            "total_rules_count": 0,
        }

    # Safe Stop: UNVERIFIED
    if coverage == CoverageStatus.UNVERIFIED:
        return {
            "status": "UNVERIFIED",
            "jurisdiction": jur_upper,
            "pathway": pathway,
            "is_supported": False,
            "can_generate_checklist": False,
            "message": f"Pathway '{pathway}' in jurisdiction '{jur_upper}' is currently in DRAFT_UNVERIFIED status. Draft or unverified rules cannot be presented as current for legal filings under Documento policy.",
            "disclaimer": "SAFE STOP: Stale/unverified rules cannot be presented as current.",
            "checklist": [],
            "rule_version": None,
            "applicable_count": 0,
            "total_rules_count": 0,
        }

    # Step 2: Resolve Approved & Published RuleSetVersion
    # Match RuleSet by jurisdiction & program_pathway
    clean_pathway = pathway.upper().replace("-", "_")
    stmt = (
        select(RuleSet)
        .where(
            RuleSet.organization_id == org_id,
            RuleSet.jurisdiction == jur_upper,
        )
    )
    rulesets = db.scalars(stmt).all()
    target_rs = None
    for rs in rulesets:
        if (
            rs.program_pathway.upper() == clean_pathway
            or rs.code.upper().replace("-", "_") == clean_pathway
            or pathway.lower() in rs.program_pathway.lower()
            or rs.program_pathway.lower() in pathway.lower()
        ):
            target_rs = rs
            break

    if not target_rs:
        return {
            "status": "UNSUPPORTED",
            "jurisdiction": jur_upper,
            "pathway": pathway,
            "is_supported": False,
            "can_generate_checklist": False,
            "message": f"No rule pack found for '{pathway}' in organization registry. Safe stop triggered.",
            "disclaimer": "SAFE STOP: No unrelated fallback checklist permitted.",
            "checklist": [],
            "rule_version": None,
            "applicable_count": 0,
            "total_rules_count": 0,
        }

    # Resolve active published version
    target_version = None
    if rule_version_id:
        v = db.get(RuleSetVersion, rule_version_id)
        if v and v.status == "published":
            target_version = v
    elif target_rs.current_version_id:
        v = db.get(RuleSetVersion, target_rs.current_version_id)
        if v and v.status == "published":
            target_version = v


    if not target_version:
        # Fallback to latest published version
        v_stmt = (
            select(RuleSetVersion)
            .where(
                RuleSetVersion.rule_set_id == target_rs.id,
                RuleSetVersion.status == "published",
            )
            .order_by(RuleSetVersion.created_at.desc())
        )
        target_version = db.scalar(v_stmt)

    if not target_version:
        return {
            "status": "UNVERIFIED",
            "jurisdiction": jur_upper,
            "pathway": pathway,
            "is_supported": False,
            "can_generate_checklist": False,
            "message": f"Rule set '{target_rs.name}' has no approved published version. Draft rules cannot be presented as current.",
            "disclaimer": "SAFE STOP: Stale/unverified rules cannot be presented as current.",
            "checklist": [],
            "rule_version": None,
            "applicable_count": 0,
            "total_rules_count": 0,
        }

    # Step 3: Evaluate Requirements against Applicant Facts & Filter Stale Rules
    checklist_items = []
    stale_items = []
    applicable_count = 0

    evaluation_context = {
        "case": {
            "jurisdiction": jur_upper,
            "visa_category": pathway,
            "as_of_date": effective_as_of.strftime("%Y-%m-%d"),
        },
        "applicant": facts,
    }

    # Sort requirements by priority
    sorted_reqs = sorted(target_version.requirements, key=lambda r: (r.priority, r.code))

    for req in sorted_reqs:
        # Check staleness
        if is_rule_stale(req, effective_as_of):
            stale_items.append({
                "rule_id": req.code,
                "requirement_key": req.requirement_key or req.code.lower().replace("-", "."),
                "status": "STALE",
                "title": req.title,
                "reason": "Exceeded verification horizon or effective_to expiration date.",
            })
            continue

        # Evaluate applicability conditions
        is_applicable = True
        if req.applicability_conditions:
            is_applicable = evaluate_condition(req.applicability_conditions, evaluation_context)

        if is_applicable:
            applicable_count += 1

        rule_dict = req.to_phase6_dict(ruleset=target_rs, version=target_version)
        rule_dict["is_applicable"] = is_applicable
        rule_dict["requires_human_review"] = req.requires_human_review
        rule_dict["accepted_evidence_types"] = req.accepted_evidence_types or []
        rule_dict["blocking_dependencies"] = req.blocking_dependencies or []

        checklist_items.append(rule_dict)

    result_status = "SUPPORTED" if coverage == CoverageStatus.SUPPORTED else "PARTIAL"

    response = {
        "status": result_status,
        "jurisdiction": jur_upper,
        "pathway": pathway,
        "is_supported": True,
        "can_generate_checklist": True,
        "coverage_level": coverage.value,
        "rule_set_name": target_rs.name,
        "rule_version_id": str(target_version.id),
        "rule_version_number": target_version.version_number,
        "effective_as_of": effective_as_of.isoformat(),
        "total_rules_count": len(sorted_reqs),
        "applicable_count": applicable_count,
        "stale_rules_excluded_count": len(stale_items),
        "stale_rules_excluded": stale_items,
        "checklist": [item for item in checklist_items if item["is_applicable"]],
        "all_rules": checklist_items,
        "provenance": {
            "official_source_url": target_version.official_source.url if target_version.official_source else None,
            "source_authority": target_version.official_source.authority if target_version.official_source else target_rs.authority,
            "published_at": target_version.published_at.isoformat() if target_version.published_at else None,
            "approved_by": target_version.approved_by.full_name if target_version.approved_by else None,
        },
    }

    # Step 4: Handle Pinned Checklist Snapshot for Existing Cases
    if case_id:
        case = db.get(ImmigrationCase, case_id)
        if case and case.organization_id == org_id:
            # If case does not have a pinned checklist yet, or pin_to_case is explicitly True
            if not case.pinned_checklist_snapshot or pin_to_case:
                case.pinned_rule_version_id = target_version.id
                case.pinned_checklist_snapshot = response
                case.snapshot_pinned_at = datetime.now(timezone.utc)
                case.rules_update_available = False
                case.latest_available_version_id = target_version.id
                db.commit()
                response["is_pinned_to_case"] = True
                response["pinned_at"] = case.snapshot_pinned_at.isoformat()
            else:
                # Retain existing pinned snapshot! Do not silently overwrite!
                response["is_pinned_to_case"] = False
                response["case_retains_pinned_snapshot"] = True
                response["case_pinned_version_id"] = str(case.pinned_rule_version_id)
                # Check if update is available
                if case.pinned_rule_version_id != target_version.id:
                    case.rules_update_available = True
                    case.latest_available_version_id = target_version.id
                    db.commit()
                    response["case_rules_update_available"] = True

    return response
