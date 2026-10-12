"""Requirement evaluation engine.

Evaluates an ImmigrationCase against a configured RuleSetVersion.
Respects strict security constraints (declarative evaluation only, never arbitrary Python code).
Produces structured CaseRequirementEvaluation records with complete provenance.
"""
from datetime import datetime, timezone
import uuid
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

try:
    from backend.app.domain.models import (
        ImmigrationCase,
        Document,
        RuleSetVersion,
        RuleRequirement,
        CaseRequirementEvaluation,
    )
    from backend.app.rules.declarative_evaluator import evaluate_requirement
except ImportError:
    from app.domain.models import (
        ImmigrationCase,
        Document,
        RuleSetVersion,
        RuleRequirement,
        CaseRequirementEvaluation,
    )
    from app.rules.declarative_evaluator import evaluate_requirement


def build_case_context(case: ImmigrationCase) -> dict[str, Any]:
    """Extracts safe context dictionary from case and applicant profile for condition checking."""
    context: dict[str, Any] = {
        "case": {
            "id": str(case.id),
            "case_number": case.case_number,
            "jurisdiction": case.jurisdiction,
            "visa_category": case.visa_category,
            "status": case.status,
            "processing_stage": getattr(case, "processing_stage", getattr(case, "status", "intake")),
            "priority": getattr(case, "priority", "medium"),
            "target_submission_date": getattr(case, "target_submission_date", None).isoformat() if getattr(case, "target_submission_date", None) else None,
        },
        "applicant": {},
    }

    # If case has linked client or primary applicant
    if hasattr(case, "client") and case.client:
        context["applicant"] = {
            "id": str(case.client.id),
            "client_type": getattr(case.client, "client_type", None),
            "nationality": getattr(case.client, "nationality", None),
            "country_of_residence": getattr(case.client, "country_of_residence", None),
        }
    return context


def build_documents_context(documents: list[Document]) -> list[dict[str, Any]]:
    """Converts Document entities and their extracted fields into evaluator-ready dictionaries."""
    docs_context = []
    for doc in documents:
        # Extract fields
        extracted = []
        if hasattr(doc, "extracted_fields") and doc.extracted_fields:
            for f in doc.extracted_fields:
                extracted.append({
                    "field_name": f.field_name,
                    "original_value": f.original_value,
                    "normalized_value": f.normalized_value,
                    "ocr_confidence": f.ocr_confidence,
                    "is_verified": getattr(f, "is_verified", getattr(f, "validation_status", "valid") == "valid"),
                })

        doc_dict = {
            "id": str(doc.id),
            "title": doc.title,
            "category": doc.category,
            "file_name": getattr(doc, "filename", getattr(doc, "file_name", "")),
            "mime_type": doc.mime_type,
            "page_count": getattr(doc, "page_count", 1) or 1,
            "verification_status": getattr(doc, "verification_status", "pending") or "pending",
            "is_archived": getattr(doc, "is_archived", False),
            "extracted_fields": extracted,
        }
        docs_context.append(doc_dict)
    return docs_context


def evaluate_case_requirements(
    db: Session,
    case: ImmigrationCase,
    rule_set_version: RuleSetVersion,
    evaluator_user_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> CaseRequirementEvaluation:
    """Evaluates all requirements of a RuleSetVersion for a case and persists a versioned evaluation."""
    if now is None:
        now = datetime.now(timezone.utc)

    # 1. Fetch case documents
    stmt = (
        select(Document)
        .where(
            Document.case_id == case.id,
            Document.is_current_version.is_(True),
        )
    )
    documents = list(db.scalars(stmt).all())

    # 2. Build contexts
    case_context = build_case_context(case)
    docs_context = build_documents_context(documents)

    # 3. Fetch requirements for this rule_set_version ordered by priority
    req_stmt = (
        select(RuleRequirement)
        .where(RuleRequirement.rule_set_version_id == rule_set_version.id)
        .order_by(RuleRequirement.priority.asc(), RuleRequirement.code.asc())
    )
    requirements = list(db.scalars(req_stmt).all())

    # 4. Evaluate requirements, passing cumulative results for dependency checking
    evaluated_results: list[dict[str, Any]] = []
    blocking_map: dict[str, str] = {}

    for req in requirements:
        req_dict = {
            "id": str(req.id),
            "code": req.code,
            "title": req.title,
            "description": req.description,
            "category": req.category,
            "statutory_citation": req.statutory_citation,
            "is_mandatory": req.is_mandatory,
            "priority": req.priority,
            "applicability_conditions": req.applicability_conditions or {},
            "accepted_evidence_types": req.accepted_evidence_types or [],
            "validation_rules": req.validation_rules or [],
            "requires_human_review": req.requires_human_review,
            "blocking_dependencies": req.blocking_dependencies or [],
        }

        res = evaluate_requirement(
            requirement=req_dict,
            case_context=case_context,
            documents=docs_context,
            blocking_results=blocking_map,
            now=now,
        )
        res["requirement_id"] = str(req.id)
        res["category"] = req.category
        res["statutory_citation"] = req.statutory_citation

        evaluated_results.append(res)
        blocking_map[req.code] = res["status"]

    # 5. Compute overall fulfillment percentage and overall status
    applicable_reqs = [r for r in evaluated_results if r["status"] != "not_applicable"]
    applicable_mandatory = [r for r in applicable_reqs if r.get("is_mandatory", True)]
    completed_mandatory = [r for r in applicable_mandatory if r["status"] == "complete"]

    if applicable_mandatory:
        fulfillment_pct = (len(completed_mandatory) / len(applicable_mandatory)) * 100.0
    elif applicable_reqs:
        completed_all = [r for r in applicable_reqs if r["status"] == "complete"]
        fulfillment_pct = (len(completed_all) / len(applicable_reqs)) * 100.0
    else:
        fulfillment_pct = 100.0

    # Determine overall status
    has_expired = any(r["status"] == "expired" for r in applicable_mandatory)
    has_blocked = any(r["status"] == "blocked" for r in applicable_mandatory)
    has_missing = any(r["status"] == "missing" for r in applicable_mandatory)
    has_needs_review = any(r["status"] == "needs_review" for r in applicable_mandatory)
    has_unknown = any(r["status"] == "unknown" for r in applicable_mandatory)

    if has_expired:
        overall_status = "expired"
    elif has_blocked:
        overall_status = "blocked"
    elif has_missing:
        overall_status = "missing"
    elif has_needs_review:
        overall_status = "needs_review"
    elif has_unknown:
        overall_status = "unknown"
    else:
        overall_status = "complete"

    summary_counts = {
        "total": len(evaluated_results),
        "applicable": len(applicable_reqs),
        "complete": sum(1 for r in evaluated_results if r["status"] == "complete"),
        "missing": sum(1 for r in evaluated_results if r["status"] == "missing"),
        "needs_review": sum(1 for r in evaluated_results if r["status"] == "needs_review"),
        "blocked": sum(1 for r in evaluated_results if r["status"] == "blocked"),
        "expired": sum(1 for r in evaluated_results if r["status"] == "expired"),
        "not_applicable": sum(1 for r in evaluated_results if r["status"] == "not_applicable"),
        "unknown": sum(1 for r in evaluated_results if r["status"] == "unknown"),
    }

    # 6. Mark previous evaluations for this case as superseded
    prev_stmt = (
        select(CaseRequirementEvaluation)
        .where(
            CaseRequirementEvaluation.case_id == case.id,
            CaseRequirementEvaluation.is_superseded.is_(False),
        )
    )
    for prev_eval in db.scalars(prev_stmt).all():
        prev_eval.is_superseded = True

    # 7. Persist new CaseRequirementEvaluation
    evaluation = CaseRequirementEvaluation(
        organization_id=case.organization_id,
        case_id=case.id,
        rule_set_version_id=rule_set_version.id,
        evaluated_at=now,
        evaluator_user_id=evaluator_user_id,
        status=overall_status,
        overall_fulfillment_percentage=round(fulfillment_pct, 1),
        requirement_results={
            "summary": summary_counts,
            "version_number": rule_set_version.version_number,
            "rule_set_id": str(rule_set_version.rule_set_id),
            "requirements": evaluated_results,
        },
        is_superseded=False,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation
