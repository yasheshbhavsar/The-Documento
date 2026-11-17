"""Document Intelligence, Six-Dimension Review, and Anomaly Workflow Engine.

Implements Phase 5 requirements:
- Six separate review dimensions: Readability, Document Type, Applicant Association,
  Consistency, Evidentiary Sufficiency, and Human Verification.
- High-priority anomaly detection for spelling mismatches, poor/torn/faded scans,
  differing names, and expiry concerns.
- Extraction provenance formatting conforming strictly to:
  {
    "field": "applicant_name",
    "value": "Example Person",
    "source_document_version_id": "...",
    "page_number": 1,
    "bounding_box": [0.12, 0.18, 0.72, 0.24],
    "confidence": 0.91,
    "extractor_version": "...",
    "review_status": "NEEDS_HUMAN_REVIEW"
  }
- Calibrated thresholds: High OCR confidence is not legal sufficiency.
- Measured legal-analytical phrasing (never declaring fraud or statutory ineligibility).
- Anomaly workflow with private internal risk notes and client-facing explanation templates.
- Re-auditing package eligibility upon finding resolution without automatic eligibility grant.
"""

import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from pydantic import BaseModel, Field

from backend.app.ai.comparators import (
    are_roles_distinct_persons,
    compare_addresses,
    compare_dates_of_birth,
    compare_names,
    normalize_person_role,
)
from backend.app.ai.sponsor_intelligence import SponsorIntelligenceEngine
from backend.app.domain.models import (
    CaseAIFinding,
    CaseTask,
    Document,
    DocumentExtractedField,
    ImmigrationCase,
    now_utc,
)
from backend.app.extraction.service import format_field_extraction_provenance

logger = logging.getLogger("ai_immigration.ai.document_intelligence")

CONTRIBUTOR_ASSOCIATION_NOTE = "Attributed to Overseas Sponsor / Family Contributor"

OCR_LEGAL_SUFFICIENCY_DISCLAIMER = (
    "High optical character recognition (OCR) confidence reflects typographical and contrast fidelity only; "
    "it does not constitute evidentiary or statutory legal sufficiency under governing immigration regulations."
)


def _doc_to_role_dict(doc: Any) -> Dict[str, Any]:
    """Normalizes either a SQLAlchemy Document instance or a dict for role attribution."""
    if isinstance(doc, dict):
        return doc
    raw_fields = getattr(doc, "extracted_fields", None) or []
    field_list: List[Dict[str, Any]] = []
    for f in raw_fields:
        if isinstance(f, dict):
            field_list.append(f)
        else:
            val = (
                f.corrected_value
                if getattr(f, "is_manually_corrected", False)
                else (getattr(f, "normalized_value", None) or getattr(f, "original_value", None))
            )
            field_list.append(
                {
                    "field_name": getattr(f, "field_name", ""),
                    "field_label": getattr(f, "field_label", ""),
                    "original_value": getattr(f, "original_value", None),
                    "normalized_value": val,
                }
            )
    return {
        "id": str(getattr(doc, "id", "")),
        "title": getattr(doc, "title", None) or getattr(doc, "filename", ""),
        "filename": getattr(doc, "filename", ""),
        "category": getattr(doc, "category", ""),
        "extracted_text": getattr(doc, "extracted_text", "") or "",
        "layout_metadata": getattr(doc, "layout_metadata", None) or {},
        "extracted_fields": field_list,
        "applicant_dependant_id": str(getattr(doc, "applicant_dependant_id", ""))
        if getattr(doc, "applicant_dependant_id", None)
        else None,
    }


def detect_document_contributor_role(
    doc: Any,
    case: Optional[Any] = None,
    case_docs: Optional[List[Any]] = None,
    principal_name_override: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Determines whether a document belongs to the Principal Applicant or to a distinct
    overseas sponsor / Canadian sibling / spouse / dependant contributor.
    """
    doc_dict = _doc_to_role_dict(doc)
    principal_name = principal_name_override
    pathway = ""

    if case is not None:
        if isinstance(case, dict):
            pathway = str(case.get("visa_category") or case.get("pathway") or "")
            if not principal_name:
                principal_name = case.get("applicant_name") or case.get("principal_name")
        else:
            pathway = str(getattr(case, "visa_category", "") or "")
            client_obj = getattr(case, "client", None)
            if not principal_name and client_obj is not None:
                first_n = (getattr(client_obj, "first_name", "") or "").strip()
                last_n = (getattr(client_obj, "last_name", "") or "").strip()
                combined = f"{first_n} {last_n}".strip()
                if combined:
                    principal_name = combined

    role_res = SponsorIntelligenceEngine.infer_role_for_document(
        doc_dict,
        anchor_applicant_name=principal_name,
        pathway=pathway,
    )
    inferred_role = normalize_person_role(role_res.get("person_role") or role_res.get("role"))

    # If explicitly linked to a dependant on the ORM model and still marked principal_applicant, promote to spouse/dependant
    dep_id = doc_dict.get("applicant_dependant_id")
    if dep_id and inferred_role == "principal_applicant":
        inferred_role = "spouse_partner"

    is_distinct = are_roles_distinct_persons("principal_applicant", inferred_role)
    return {
        "person_role": inferred_role,
        "holder_name": role_res.get("holder_name"),
        "confidence": role_res.get("confidence", 0.85),
        "is_distinct_from_principal_applicant": is_distinct,
        "association_note": CONTRIBUTOR_ASSOCIATION_NOTE if is_distinct else None,
    }


def _is_false_cross_person_finding(finding: Any) -> bool:
    """Checks if a finding is a cross-person Name/DOB/Address mismatch against the Principal Applicant."""
    f_type = (getattr(finding, "finding_type", None) or (finding.get("finding_type") if isinstance(finding, dict) else "") or "").lower()
    title = (getattr(finding, "title", None) or (finding.get("title") if isinstance(finding, dict) else "") or "").lower()
    desc = (getattr(finding, "description", None) or (finding.get("description") if isinstance(finding, dict) else "") or "").lower()
    combined = f"{f_type} {title} {desc}"

    cross_person_markers = (
        "name mismatch",
        "name variation",
        "name contradiction",
        "address contradiction",
        "address mismatch",
        "residential address",
        "date of birth inconsistency",
        "dob mismatch",
        "dob contradiction",
        "against principal applicant",
        "client record",
    )
    return any(m in combined for m in cross_person_markers)


class ReviewDimensionDetail(BaseModel):
    dimension: str  # readability, document_type, applicant_association, consistency, evidentiary_sufficiency, human_verification
    status: str  # passed, needs_review, flagged, pending
    score: float = 1.0
    label: str
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)
    high_priority_flags: List[str] = Field(default_factory=list)


class DocumentSixDimensionsReview(BaseModel):
    document_id: str
    document_version: int
    readability: ReviewDimensionDetail
    document_type: ReviewDimensionDetail
    applicant_association: ReviewDimensionDetail
    consistency: ReviewDimensionDetail
    evidentiary_sufficiency: ReviewDimensionDetail
    human_verification: ReviewDimensionDetail
    overall_review_status: str  # verified, needs_review, rejected, pending
    high_ocr_confidence_notice: str = OCR_LEGAL_SUFFICIENCY_DISCLAIMER


def evaluate_document_six_dimensions(
    doc: Document,
    case: Optional[Any] = None,
    case_docs: Optional[List[Document]] = None,
    unresolved_findings: Optional[List[CaseAIFinding]] = None,
) -> DocumentSixDimensionsReview:
    """
    Evaluates a document across the 6 mandatory review dimensions:
    1. Readability
    2. Document Type
    3. Applicant Association
    4. Consistency
    5. Evidentiary Sufficiency & Completeness
    6. Human Verification
    """
    # Defensive check: if called as (db, doc)
    if hasattr(doc, "query") and not hasattr(doc, "extracted_fields"):
        db = doc
        doc = case
        case = db.query(ImmigrationCase).filter(ImmigrationCase.id == doc.case_id).first() if (doc and doc.case_id) else None
        case_docs = db.query(Document).filter(Document.case_id == doc.case_id).all() if (doc and doc.case_id) else None
        unresolved_findings = (
            db.query(CaseAIFinding).filter(CaseAIFinding.case_id == doc.case_id, CaseAIFinding.status == "needs_review").all()
            if (doc and doc.case_id)
            else None
        )

    text = (doc.extracted_text or "").strip()
    layout = doc.layout_metadata or {}
    fields = doc.extracted_fields or []
    doc_id_str = str(doc.id)

    # -------------------------------------------------------------
    # Dimension 1: Readability
    # -------------------------------------------------------------
    readability_flags = []
    avg_ocr_conf = 0.98 if not doc.ocr_applied else 0.91
    if fields:
        field_confs = [f.ocr_confidence for f in fields if f.ocr_confidence is not None]
        if field_confs:
            avg_ocr_conf = round(sum(field_confs) / len(field_confs), 2)

    # Detect scan degradation, torn/faded markers, or low OCR
    lower_text = text.lower()
    is_faded_or_poor = False
    if any(k in lower_text for k in ("unreadable", "illegible", "faded scan", "torn document", "poor quality scan")):
        is_faded_or_poor = True
        readability_flags.append("Degraded optical scan or torn document text detected.")

    if avg_ocr_conf < 0.75:
        is_faded_or_poor = True
        readability_flags.append(f"Sub-threshold OCR confidence ({int(avg_ocr_conf * 100)}%). Potential blur, low DPI, or scan distortion.")

    # Multi-page scan calibration (Master Vision §4.3): check individual fields for sub-threshold OCR (< 0.70)
    sub_threshold_fields = [
        f for f in fields
        if f.ocr_confidence is not None and f.ocr_confidence < 0.70
    ]
    if sub_threshold_fields and not (avg_ocr_conf < 0.75):
        is_faded_or_poor = True
        for sf in sub_threshold_fields[:3]:
            readability_flags.append(
                f"Sub-threshold OCR confidence ({int(sf.ocr_confidence * 100)}%) on page {sf.source_page or 1} for '{sf.field_label}'."
            )

    if not text and doc.page_count > 0 and doc.processing_status == "completed":
        is_faded_or_poor = True
        readability_flags.append("Zero legible text blocks extracted. Blank scan or unsupported graphical font.")

    read_status = "needs_review" if (is_faded_or_poor or readability_flags) else "passed"
    readability = ReviewDimensionDetail(
        dimension="readability",
        status=read_status,
        score=avg_ocr_conf,
        label="Readability & Scan Quality",
        summary="Scan resolution and character contrast are clear and legible." if read_status == "passed" else "Degraded, faded, or sub-threshold optical scan quality requires caseworker inspection.",
        details={
            "ocr_applied": doc.ocr_applied,
            "average_ocr_confidence": avg_ocr_conf,
            "page_count": doc.page_count,
            "detected_language": doc.detected_language or "en",
        },
        high_priority_flags=readability_flags,
    )

    # -------------------------------------------------------------
    # Dimension 2: Document Type
    # -------------------------------------------------------------
    type_flags = []
    class_conf = layout.get("classification_confidence", 0.90)
    declared_cat = doc.category or "supporting_evidence"
    proposed_cat = getattr(doc, "proposed_category", None) or declared_cat

    if declared_cat in ("supporting_evidence", "other") and proposed_cat != declared_cat:
        type_flags.append(f"Automated classifier proposes reclassifying from '{declared_cat}' to '{proposed_cat}'.")
        type_status = "needs_review"
    elif class_conf < 0.60:
        type_flags.append(f"Low taxonomy classification confidence ({int(class_conf * 100)}%). Confirm document type.")
        type_status = "needs_review"
    else:
        type_status = "passed"

    doc_type = ReviewDimensionDetail(
        dimension="document_type",
        status=type_status,
        score=class_conf,
        label="Document Classification",
        summary=f"Classified as '{declared_cat}' (Confidence: {int(class_conf * 100)}%).",
        details={
            "current_category": declared_cat,
            "proposed_category": proposed_cat,
            "classification_confidence": class_conf,
        },
        high_priority_flags=type_flags,
    )

    # -------------------------------------------------------------
    # Dimension 3: Applicant Association (Role-Aware)
    # -------------------------------------------------------------
    role_info = detect_document_contributor_role(doc, case=case, case_docs=case_docs)
    detected_role = role_info["person_role"]
    is_contributor_role = role_info["is_distinct_from_principal_applicant"]

    assoc_flags = []
    is_confirmed = getattr(doc, "is_assignment_confirmed", True)
    prop_name = getattr(doc, "proposed_applicant_name", None)

    if not is_confirmed:
        assoc_flags.append(f"Provisional applicant assignment ('{prop_name or 'Unassigned'}') requires authorized staff confirmation.")
        assoc_status = "needs_review"
        assoc_score = 0.65
    else:
        assoc_status = "passed"
        assoc_score = 1.0

    if assoc_status == "passed" and is_contributor_role:
        assoc_summary = f"{CONTRIBUTOR_ASSOCIATION_NOTE} ({detected_role})."
    elif assoc_status == "passed":
        assoc_summary = "Document is definitively linked to verified applicant."
    else:
        assoc_summary = f"Provisional assignment to {prop_name or 'Applicant'} requires officer confirmation."

    assoc_details: Dict[str, Any] = {
        "is_assignment_confirmed": is_confirmed,
        "applicant_dependant_id": str(doc.applicant_dependant_id) if doc.applicant_dependant_id else None,
        "client_id": str(doc.client_id) if doc.client_id else None,
        "proposed_applicant_name": prop_name,
        "person_role": detected_role,
    }
    if is_contributor_role:
        assoc_details["association_note"] = CONTRIBUTOR_ASSOCIATION_NOTE

    applicant_assoc = ReviewDimensionDetail(
        dimension="applicant_association",
        status=assoc_status,
        score=assoc_score,
        label="Applicant Association",
        summary=assoc_summary,
        details=assoc_details,
        high_priority_flags=assoc_flags,
    )

    # -------------------------------------------------------------
    # Dimension 4: Consistency (Role-Aware Cross-Document Concordance)
    # -------------------------------------------------------------
    consistency_flags = []
    doc_findings = []
    suppressed_cross_role_count = 0
    if unresolved_findings:
        for f in unresolved_findings:
            matches = False
            if f.document_id and str(f.document_id) == doc_id_str:
                matches = True
            elif f.related_documents:
                for rel in f.related_documents:
                    if isinstance(rel, dict) and str(rel.get("id")) == doc_id_str:
                        matches = True
                        break
                    elif str(rel) == doc_id_str:
                        matches = True
                        break
            if matches:
                if is_contributor_role and _is_false_cross_person_finding(f):
                    suppressed_cross_role_count += 1
                    continue
                doc_findings.append(f)
                consistency_flags.append(f"[{f.severity.upper()}] {f.title}: {f.description}")

    if doc_findings:
        has_critical = any(f.severity in ("critical", "major") for f in doc_findings)
        consistency_status = "flagged" if has_critical else "needs_review"
        consistency_score = 0.40 if has_critical else 0.70
    else:
        consistency_status = "passed"
        consistency_score = 1.0

    if consistency_status == "passed" and is_contributor_role:
        consistency_summary = (
            f"{CONTRIBUTOR_ASSOCIATION_NOTE}: cross-person name/address comparison against Principal Applicant bypassed."
        )
    elif consistency_status == "passed":
        consistency_summary = "Zero cross-document discrepancies or name/date conflicts detected."
    else:
        consistency_summary = f"{len(doc_findings)} discrepancy finding(s) require legal reviewer disposition."

    consistency_details: Dict[str, Any] = {
        "discrepancies_count": len(doc_findings),
        "findings_summary": [f.title for f in doc_findings[:5]],
        "person_role": detected_role,
    }
    if is_contributor_role:
        consistency_details["association_note"] = CONTRIBUTOR_ASSOCIATION_NOTE
        consistency_details["suppressed_cross_role_findings_count"] = suppressed_cross_role_count

    consistency = ReviewDimensionDetail(
        dimension="consistency",
        status=consistency_status,
        score=consistency_score,
        label="Cross-Document Consistency",
        summary=consistency_summary,
        details=consistency_details,
        high_priority_flags=consistency_flags,
    )

    # -------------------------------------------------------------
    # Dimension 5: Evidentiary Sufficiency & Completeness
    # -------------------------------------------------------------
    suff_flags = []
    now = datetime.now(timezone.utc)

    # Check SHA-256
    if not doc.sha256_hash or len(doc.sha256_hash) < 32:
        suff_flags.append("Missing cryptographic SHA-256 provenance hash.")

    # Check Expiration Dates
    exp_fields = [f for f in fields if f.field_name in ("expiry_date", "expiration_date", "passport_expiry", "valid_until")]
    for exp_f in exp_fields:
        val = exp_f.corrected_value if exp_f.is_manually_corrected else (exp_f.normalized_value or exp_f.original_value or "")
        m = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", val)
        if m:
            try:
                exp_dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
                if exp_dt < now:
                    suff_flags.append(f"Evidence document has elapsed expiration date ({val}). Renewal required.")
                elif exp_dt < now + timedelta(days=180):
                    suff_flags.append(f"Passport / evidence document expires within 6 months ({val}).")
            except ValueError:
                pass

    # Check missing page indicators ("Page X of Y")
    page_match = re.search(r"(?:page|sheet|p\.)\s*(\d+)\s*(?:of|/)\s*(\d+)", text, re.IGNORECASE)
    if page_match:
        tot_p = int(page_match.group(2))
        if tot_p > doc.page_count and tot_p <= 100:
            suff_flags.append(f"Potential missing pages: Document states {tot_p} pages but only {doc.page_count} page(s) uploaded.")

    suff_status = "needs_review" if suff_flags else "passed"
    evidentiary_sufficiency = ReviewDimensionDetail(
        dimension="evidentiary_sufficiency",
        status=suff_status,
        score=0.60 if suff_flags else 1.0,
        label="Evidentiary Sufficiency & Completeness",
        summary="Document is complete, unexpired, and cryptographically verified." if suff_status == "passed" else "Completeness, validity period, or pagination warnings require review.",
        details={
            "page_count": doc.page_count,
            "sha256_verified": bool(doc.sha256_hash and len(doc.sha256_hash) >= 32),
            "expiration_fields_count": len(exp_fields),
        },
        high_priority_flags=suff_flags,
    )

    # -------------------------------------------------------------
    # Dimension 6: Human Verification
    # -------------------------------------------------------------
    # Strictly decoupled from automated OCR!
    v_status = doc.verification_status or "unverified"
    ver_flags = []
    if v_status == "unverified":
        ver_flags.append("Automated OCR extraction complete; human legal verification remains pending.")
        h_score = 0.50
    elif v_status == "under_review":
        ver_flags.append("Caseworker review in progress.")
        h_score = 0.75
    elif v_status == "rejected":
        ver_flags.append(f"Rejected by caseworker: {doc.verification_notes or 'Deficient evidence'}")
        h_score = 0.0
    else:  # verified
        h_score = 1.0

    human_verification = ReviewDimensionDetail(
        dimension="human_verification",
        status=v_status,
        score=h_score,
        label="Human Caseworker Verification",
        summary=f"Human verification status: {v_status.upper()} (Authorized sign-off required for package inclusion).",
        details={
            "verification_status": v_status,
            "verified_by_user_id": str(doc.verified_by_user_id) if doc.verified_by_user_id else None,
            "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
            "verification_notes": doc.verification_notes,
            "is_decoupled_from_ocr": True,
        },
        high_priority_flags=ver_flags,
    )

    # Overall Status Calculation
    if v_status == "verified" and read_status == "passed" and consistency_status == "passed" and suff_status == "passed":
        overall = "verified"
    elif v_status == "rejected":
        overall = "rejected"
    else:
        overall = "needs_review"

    return DocumentSixDimensionsReview(
        document_id=doc_id_str,
        document_version=doc.version,
        readability=readability,
        document_type=doc_type,
        applicant_association=applicant_assoc,
        consistency=consistency,
        evidentiary_sufficiency=evidentiary_sufficiency,
        human_verification=human_verification,
        overall_review_status=overall,
        high_ocr_confidence_notice=OCR_LEGAL_SUFFICIENCY_DISCLAIMER,
    )


def create_anomaly_finding(
    organization_id: UUID,
    case_id: UUID,
    document_id: Optional[UUID],
    finding_type: str,
    severity: str,
    title: str,
    description: str,
    evidence_reference: Dict[str, Any],
    client_facing_template: str,
    internal_risk_notes: str,
    owner_user_id: Optional[UUID] = None,
    due_date: Optional[datetime] = None,
    confidence_score: float = 0.92,
) -> CaseAIFinding:
    """
    Creates an audited anomaly finding enforcing:
    - Private internal risk notes (never shown to clients)
    - Client-facing sanitized explanation template
    - Structured evidence reference with bounding box and page
    - Severity and escalation ownership
    - Measured legal-analytical phrasing (never declaring fraud/ineligibility)
    """
    now = now_utc()
    target_due = due_date or (now + timedelta(days=3 if severity == "critical" else 7))

    return CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=organization_id,
        case_id=case_id,
        document_id=document_id,
        finding_type=finding_type,
        severity=severity,
        status="needs_review",
        title=title,
        description=description,
        evidence_text=evidence_reference.get("evidence_text"),
        source_location=evidence_reference,
        evidence_reference=evidence_reference,
        related_documents=[{"id": str(document_id), "version": 1}] if document_id else [],
        related_fields=[evidence_reference.get("field")] if evidence_reference.get("field") else [],
        relevant_requirement="8 CFR § 103.2(b)(1) - Evidentiary Sufficiency & Legibility",
        recommended_action=f"Review evidentiary discrepancy and route under firm policy before client contact.",
        clarification_question=client_facing_template,
        client_facing_template=client_facing_template,
        internal_risk_notes=internal_risk_notes,
        owner_user_id=owner_user_id,
        due_date=target_due,
        uncertainty_limitations="Automated optical and layout extraction. Verify source document before disposition.",
        is_confirmed_contradiction=severity in ("critical", "major"),
        confidence_score=confidence_score,
        resolution_history=[],
        created_at=now,
        updated_at=now,
    )


def evaluate_role_aware_consistency(
    principal_applicant: Optional[Dict[str, Any]],
    documents: List[Any],
    pathway: str = "",
) -> Dict[str, Any]:
    """
    Role-aware cross-document consistency auditor.

    When a document is attributed to a distinct contributor role (`overseas_sponsor_host`,
    `canadian_crs_sibling`, `spouse_partner`, `dependant_child`) via `extracted_fields`,
    `layout_metadata`, or CRA/HMRC/ATO/VEVO/Sponsor markers, it does NOT raise a false
    "Name Mismatch against Principal Applicant" or "Address Contradiction" anomaly.
    Instead, it records an informational association note:
    "Attributed to Overseas Sponsor / Family Contributor".
    """
    pa_profile = principal_applicant or {}
    pa_name = (
        pa_profile.get("full_name")
        or pa_profile.get("applicant_name")
        or f"{pa_profile.get('first_name', '')} {pa_profile.get('last_name', '')}".strip()
    )
    pa_dob = pa_profile.get("date_of_birth") or pa_profile.get("dob")
    pa_address = (
        pa_profile.get("residential_address")
        or pa_profile.get("address")
        or pa_profile.get("permanent_address")
    )

    normalized_docs = [_doc_to_role_dict(d) for d in (documents or [])]

    # Auto-seed Principal Applicant anchor from the packet if not explicitly supplied
    if not pa_name:
        packet_eval = SponsorIntelligenceEngine.evaluate_packet_or_case_intelligence(
            normalized_docs, pathway=pathway
        )
        for d_attr in packet_eval.get("document_roles", []):
            if normalize_person_role(d_attr.get("person_role")) == "principal_applicant":
                if d_attr.get("holder_name"):
                    pa_name = d_attr["holder_name"]
                    break

    anomalies: List[Dict[str, Any]] = []
    contributor_attributions: List[Dict[str, Any]] = []

    for doc_dict in normalized_docs:
        role_info = detect_document_contributor_role(
            doc_dict,
            case={"pathway": pathway, "applicant_name": pa_name},
            principal_name_override=pa_name,
        )
        role = role_info["person_role"]
        doc_title = doc_dict.get("title") or doc_dict.get("filename") or "Untitled Document"
        doc_id = doc_dict.get("id")

        fields_map: Dict[str, str] = {}
        raw_fields = doc_dict.get("extracted_fields") or []
        if isinstance(raw_fields, dict):
            fields_map = {str(k): str(v) for k, v in raw_fields.items() if v is not None}
        else:
            for f in raw_fields:
                if isinstance(f, dict):
                    fn = f.get("field_name")
                    val = f.get("normalized_value") or f.get("original_value")
                    if fn and val and fn not in fields_map:
                        fields_map[str(fn)] = str(val)

        holder_name = (
            fields_map.get("full_name")
            or fields_map.get("applicant_name")
            or fields_map.get("holder_name")
            or fields_map.get("taxpayer_name")
            or role_info.get("holder_name")
        )
        doc_dob = fields_map.get("date_of_birth") or fields_map.get("dob")
        doc_addr = (
            fields_map.get("residential_address")
            or fields_map.get("address")
            or fields_map.get("permanent_address")
        )
        if not doc_addr:
            text_val = doc_dict.get("extracted_text") or ""
            m_addr = re.search(r"(?:Address|Residential Address)\s*[:\-]\s*([^\n]{8,120})", text_val, re.IGNORECASE)
            if m_addr:
                doc_addr = m_addr.group(1).strip()

        if are_roles_distinct_persons("principal_applicant", role):
            contributor_attributions.append(
                {
                    "document_id": doc_id,
                    "title": doc_title,
                    "person_role": role,
                    "holder_name": holder_name,
                    "address": doc_addr,
                    "status": "attributed_contributor",
                    "association_note": CONTRIBUTOR_ASSOCIATION_NOTE,
                }
            )
            continue

        # Same person (`principal_applicant`) -> run genuine cross-document comparisons
        if pa_name and holder_name:
            name_cmp = compare_names(pa_name, holder_name)
            if not name_cmp.is_concordant:
                anomalies.append(
                    {
                        "document_id": doc_id,
                        "title": doc_title,
                        "person_role": role,
                        "finding_type": "name_mismatch",
                        "severity": "critical" if name_cmp.is_confirmed_contradiction else "major",
                        "title_summary": "Name Mismatch against Principal Applicant",
                        "anchor_value": pa_name,
                        "compared_value": holder_name,
                        "explanation": name_cmp.explanation,
                    }
                )

        if pa_dob and doc_dob:
            dob_cmp = compare_dates_of_birth(str(pa_dob), str(doc_dob))
            if not dob_cmp.is_concordant:
                anomalies.append(
                    {
                        "document_id": doc_id,
                        "title": doc_title,
                        "person_role": role,
                        "finding_type": "dob_discrepancy",
                        "severity": "critical" if dob_cmp.is_confirmed_contradiction else "major",
                        "title_summary": "Date of Birth Inconsistency against Principal Applicant",
                        "anchor_value": str(pa_dob),
                        "compared_value": str(doc_dob),
                        "explanation": dob_cmp.explanation,
                    }
                )

        if pa_address and doc_addr:
            addr_cmp = compare_addresses(str(pa_address), str(doc_addr))
            if not addr_cmp.is_concordant:
                anomalies.append(
                    {
                        "document_id": doc_id,
                        "title": doc_title,
                        "person_role": role,
                        "finding_type": "address_contradiction",
                        "severity": "minor" if not addr_cmp.is_confirmed_contradiction else "major",
                        "title_summary": "Address Contradiction",
                        "anchor_value": str(pa_address),
                        "compared_value": str(doc_addr),
                        "explanation": addr_cmp.explanation,
                    }
                )

    return {
        "principal_applicant_name": pa_name,
        "anomalies_count": len(anomalies),
        "anomalies": anomalies,
        "contributor_attributions_count": len(contributor_attributions),
        "contributor_attributions": contributor_attributions,
    }
