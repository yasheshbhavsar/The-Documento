"""Constrained declarative evaluation engine for immigration requirements.

CRITICAL SECURITY CONSTRAINT:
Never execute arbitrary database-stored Python code, eval(), or exec().
All evaluations are performed using strict declarative operators and bounded AST logic.
"""
from datetime import datetime, timezone
from typing import Any


ALLOWED_OPERATORS = {
    "eq": lambda a, b: str(a).strip().lower() == str(b).strip().lower() if a is not None and b is not None else a == b,
    "neq": lambda a, b: str(a).strip().lower() != str(b).strip().lower() if a is not None and b is not None else a != b,
    "ne": lambda a, b: str(a).strip().lower() != str(b).strip().lower() if a is not None and b is not None else a != b,
    "gt": lambda a, b: float(a) > float(b) if a is not None and b is not None else False,

    "gte": lambda a, b: float(a) >= float(b) if a is not None and b is not None else False,
    "lt": lambda a, b: float(a) < float(b) if a is not None and b is not None else False,
    "lte": lambda a, b: float(a) <= float(b) if a is not None and b is not None else False,
    "in": lambda a, b: str(a).strip().lower() in [str(x).strip().lower() for x in b] if a is not None and isinstance(b, (list, tuple, set)) else False,
    "not_in": lambda a, b: str(a).strip().lower() not in [str(x).strip().lower() for x in b] if a is not None and isinstance(b, (list, tuple, set)) else True,
    "contains": lambda a, b: str(b).lower() in str(a).lower() if a is not None else False,
    "exists": lambda a, _: a is not None and a != "",
    "is_empty": lambda a, _: a is None or a == "" or a == [],
}


def resolve_context_path(context: dict[str, Any], path: str) -> Any:
    """Safely extracts nested field values using dot notation (e.g. 'case.visa_category')."""
    if not path:
        return None
    parts = path.split(".")
    curr = context
    for p in parts:
        if isinstance(curr, dict):
            curr = curr.get(p)
        elif hasattr(curr, p):
            curr = getattr(curr, p)
        else:
            return None
        if curr is None:
            return None
    return curr


def evaluate_condition(condition: dict[str, Any], context: dict[str, Any]) -> bool:
    """Evaluates a single condition dictionary or compound 'all'/'any'/'none' structure."""
    if not condition:
        return True

    # Compound operators
    if "all" in condition and isinstance(condition["all"], list):
        return all(evaluate_condition(c, context) for c in condition["all"])
    if "any" in condition and isinstance(condition["any"], list):
        return any(evaluate_condition(c, context) for c in condition["any"])
    if "none" in condition and isinstance(condition["none"], list):
        return not any(evaluate_condition(c, context) for c in condition["none"])

    # Single leaf condition: {"field": "...", "op": "...", "value": ...}
    field_path = condition.get("field")
    op_name = condition.get("op", "eq").lower()
    expected_val = condition.get("value")

    if not field_path:
        return True

    actual_val = resolve_context_path(context, field_path)
    op_func = ALLOWED_OPERATORS.get(op_name)
    if not op_func:
        # Unknown operator safely returns False
        return False

    try:
        return bool(op_func(actual_val, expected_val))
    except Exception:
        return False


def is_document_expired(doc: dict[str, Any], now: datetime | None = None) -> bool:
    """Checks if a document or its extracted fields demonstrate an expired validity period."""
    if now is None:
        now = datetime.now(timezone.utc)

    # Check extracted fields for expiration_date
    extracted_fields = doc.get("extracted_fields", [])
    for f in extracted_fields:
        field_name = str(f.get("field_name", "")).lower()
        if "expir" in field_name:
            val = f.get("normalized_value") or f.get("original_value")
            if val:
                try:
                    # ISO or year-month-day
                    exp_dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
                    if exp_dt.tzinfo is None:
                        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                    if exp_dt < now:
                        return True
                except Exception:
                    pass
    return False


def evaluate_requirement(
    requirement: dict[str, Any],
    case_context: dict[str, Any],
    documents: list[dict[str, Any]],
    blocking_results: dict[str, str] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Evaluates an individual declarative requirement against case context and documents.

    Returns a structured status result:
    - status: 'complete' | 'missing' | 'needs_review' | 'unknown' | 'not_applicable' | 'expired' | 'blocked'
    """
    if now is None:
        now = datetime.now(timezone.utc)

    code = requirement.get("code", "UNKNOWN_REQ")
    title = requirement.get("title", "")
    is_mandatory = requirement.get("is_mandatory", True)
    requires_human_review = requirement.get("requires_human_review", True)
    applicability = requirement.get("applicability_conditions", {})
    accepted_evidence = requirement.get("accepted_evidence_types", [])
    validation_rules = requirement.get("validation_rules", [])
    blocking_deps = requirement.get("blocking_dependencies", [])

    # 1. Evaluate Conditional Applicability
    if applicability and not evaluate_condition(applicability, case_context):
        return {
            "code": code,
            "title": title,
            "status": "not_applicable",
            "is_applicable": False,
            "is_mandatory": is_mandatory,
            "evidence_matched": [],
            "validation_details": ["Requirement conditions do not apply to this applicant/case profile"],
            "blocking_reasons": [],
            "requires_human_signoff": False,
            "human_signoff_completed": False,
        }

    # 2. Check Blocking Dependencies
    if blocking_deps and blocking_results:
        unresolved_deps = [dep for dep in blocking_deps if blocking_results.get(dep) != "complete"]
        if unresolved_deps:
            return {
                "code": code,
                "title": title,
                "status": "blocked",
                "is_applicable": True,
                "is_mandatory": is_mandatory,
                "evidence_matched": [],
                "validation_details": [f"Blocked by prerequisite requirement(s): {', '.join(unresolved_deps)}"],
                "blocking_reasons": unresolved_deps,
                "requires_human_signoff": requires_human_review,
                "human_signoff_completed": False,
            }

    # 3. Match Accepted Evidence
    matched_docs = []
    accepted_categories = []
    min_count = 1

    for ev_type in accepted_evidence:
        if isinstance(ev_type, str):
            accepted_categories.append(ev_type)
        elif isinstance(ev_type, dict):
            cat = ev_type.get("category")
            if cat:
                accepted_categories.append(cat)
            min_count = max(min_count, ev_type.get("min_count", 1))

    for doc in documents:
        doc_cat = doc.get("category")
        if doc_cat in accepted_categories:
            matched_docs.append(doc)

    if len(matched_docs) < min_count:
        return {
            "code": code,
            "title": title,
            "status": "missing",
            "is_applicable": True,
            "is_mandatory": is_mandatory,
            "evidence_matched": [],
            "validation_details": [f"Missing required evidence. Expected at least {min_count} document(s) in category: {', '.join(accepted_categories)}"],
            "blocking_reasons": ["evidence_missing"],
            "requires_human_signoff": requires_human_review,
            "human_signoff_completed": False,
        }

    # 4. Check for Apparent Expiration in Evidence
    for doc in matched_docs:
        if is_document_expired(doc, now):
            return {
                "code": code,
                "title": title,
                "status": "expired",
                "is_applicable": True,
                "is_mandatory": is_mandatory,
                "evidence_matched": [doc.get("id")],
                "validation_details": [f"Document '{doc.get('title')}' is past its legal validity expiration date"],
                "blocking_reasons": ["document_expired"],
                "requires_human_signoff": requires_human_review,
                "human_signoff_completed": False,
            }

    # 5. Evaluate Declarative Validation Checks
    validation_failures = []
    validation_successes = []

    for rule in validation_rules:
        check_name = rule.get("check")
        if check_name == "field_present":
            target_field = rule.get("field_name")
            has_field = False
            for d in matched_docs:
                for f in d.get("extracted_fields", []):
                    if f.get("field_name") == target_field and f.get("normalized_value"):
                        has_field = True
                        break
            if not has_field:
                validation_failures.append(f"Required field '{target_field}' not found in submitted evidence")
            else:
                validation_successes.append(f"Field '{target_field}' verified present")

        elif check_name == "min_pages":
            min_p = rule.get("min_pages", 1)
            for d in matched_docs:
                if d.get("page_count", 1) < min_p:
                    validation_failures.append(f"Document '{d.get('title')}' has {d.get('page_count')} page(s), minimum required is {min_p}")

        elif check_name == "verified_status":
            allowed_statuses = rule.get("values", ["verified"])
            unverified = [d.get("title") for d in matched_docs if d.get("verification_status") not in allowed_statuses]
            if unverified:
                validation_failures.append(f"Document(s) pending verification: {', '.join(unverified)}")

        elif check_name == "ocr_confidence_threshold":
            min_conf = rule.get("min_confidence", 0.70)
            for d in matched_docs:
                for f in d.get("extracted_fields", []):
                    if f.get("ocr_confidence") is not None and f.get("ocr_confidence") < min_conf:
                        validation_failures.append(f"Low OCR confidence ({f.get('ocr_confidence'):.2f}) on field '{f.get('field_name')}'")

    if validation_failures:
        # If failures exist, it needs human review or is blocked/unknown
        has_unverified = any("pending verification" in f for f in validation_failures)
        return {
            "code": code,
            "title": title,
            "status": "needs_review" if has_unverified else "unknown",
            "is_applicable": True,
            "is_mandatory": is_mandatory,
            "evidence_matched": [d.get("id") for d in matched_docs],
            "validation_details": validation_failures,
            "blocking_reasons": validation_failures,
            "requires_human_signoff": True,
            "human_signoff_completed": False,
        }

    # 6. Check Human Review Requirement
    # Documents matched and validation rules passed!
    # If the requirement specifies 'requires_human_review', human caseworkers must sign off before status is 'complete'.
    # Check if a verification sign-off is recorded on the documents or requirement sign-off
    all_docs_verified = all(d.get("verification_status") == "verified" for d in matched_docs)

    if requires_human_review and not all_docs_verified:
        return {
            "code": code,
            "title": title,
            "status": "needs_review",
            "is_applicable": True,
            "is_mandatory": is_mandatory,
            "evidence_matched": [d.get("id") for d in matched_docs],
            "validation_details": ["Evidence matches all criteria. Awaiting human legal professional sign-off."],
            "blocking_reasons": [],
            "requires_human_signoff": True,
            "human_signoff_completed": False,
        }

    # Fully complete!
    return {
        "code": code,
        "title": title,
        "status": "complete",
        "is_applicable": True,
        "is_mandatory": is_mandatory,
        "evidence_matched": [d.get("id") for d in matched_docs],
        "validation_details": ["All evidence requirements, declarative validations, and approvals satisfied."],
        "blocking_reasons": [],
        "requires_human_signoff": requires_human_review,
        "human_signoff_completed": all_docs_verified,
    }
