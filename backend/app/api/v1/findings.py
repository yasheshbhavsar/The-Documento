"""API endpoints for AI document analysis, discrepancy detection, and finding resolution."""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.db.session import get_db
from backend.app.core.errors import NotFoundError, PermissionDeniedError
from backend.app.domain.models import CaseAIFinding, ImmigrationCase, Document
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.ai.review_service import (
    run_case_ai_analysis,
    resolve_finding,
    dismiss_finding,
    escalate_finding,
    route_finding,
    VALID_DISMISSAL_REASONS,
)
from backend.app.ai.checklist_engine import audit_case_checklist
from backend.app.ai.summarizer import generate_evidence_backed_case_summary


router = APIRouter(prefix="/cases/{case_id}/findings", tags=["AI Document Findings"])


class AIFindingOut(BaseModel):
    id: str
    case_id: str
    document_id: Optional[str] = None
    finding_type: str
    severity: str
    status: str
    title: str
    description: str
    evidence_text: Optional[str] = None
    source_location: Optional[dict] = None
    evidence_reference: Optional[dict] = None
    client_facing_template: Optional[str] = None
    internal_risk_notes: Optional[str] = None
    owner_user_id: Optional[str] = None
    due_date: Optional[str] = None
    related_documents: list = []
    related_fields: list = []
    relevant_requirement: Optional[str] = None
    recommended_action: str
    clarification_question: Optional[str] = None
    uncertainty_limitations: str
    linked_task_id: Optional[str] = None
    rule_id: Optional[str] = None
    confidence_score: Optional[float] = None
    is_confirmed_contradiction: bool = False
    reviewer_id: Optional[str] = None
    resolved_at: Optional[str] = None
    resolution_action: Optional[str] = None
    resolution_reason: Optional[str] = None
    resolution_history: list = []
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


def _to_finding_out(f: CaseAIFinding, is_client: bool = False) -> AIFindingOut:
    return AIFindingOut(
        id=str(f.id),
        case_id=str(f.case_id),
        document_id=str(f.document_id) if f.document_id else None,
        finding_type=f.finding_type,
        severity=f.severity,
        status=f.status,
        title=f.title,
        description=f.description,
        evidence_text=f.evidence_text,
        source_location=f.source_location,
        evidence_reference=f.evidence_reference or f.source_location,
        client_facing_template=f.client_facing_template or f.clarification_question,
        # PRIVACY ENFORCEMENT: Never leak internal risk notes to client portal!
        internal_risk_notes=None if is_client else f.internal_risk_notes,
        owner_user_id=str(f.owner_user_id) if f.owner_user_id else None,
        due_date=f.due_date.isoformat() if f.due_date else None,
        related_documents=f.related_documents or [],
        related_fields=f.related_fields or [],
        relevant_requirement=f.relevant_requirement,
        recommended_action=f.recommended_action,
        clarification_question=f.clarification_question,
        uncertainty_limitations=f.uncertainty_limitations,
        linked_task_id=str(f.linked_task_id) if f.linked_task_id else None,
        rule_id=f.rule_id,
        confidence_score=f.confidence_score,
        is_confirmed_contradiction=f.is_confirmed_contradiction,
        reviewer_id=str(f.reviewer_id) if f.reviewer_id else None,
        resolved_at=f.resolved_at.isoformat() if f.resolved_at else None,
        resolution_action=f.resolution_action,
        resolution_reason=f.resolution_reason,
        resolution_history=f.resolution_history or [],
        created_at=f.created_at.isoformat(),
        updated_at=f.updated_at.isoformat(),
    )


class ResolveFindingIn(BaseModel):
    note: str = Field(..., min_length=3, description="Legal reviewer resolution rationale")


class DismissFindingIn(BaseModel):
    reason: str = Field(..., description="Structured dismissal reason")
    note: Optional[str] = Field(None, description="Optional caseworker notes")


class EscalateFindingIn(BaseModel):
    note: str = Field(..., min_length=3, description="Escalation explanation for senior counsel")


class RouteFindingIn(BaseModel):
    owner_user_id: uuid.UUID = Field(..., description="Target officer or lawyer user ID under firm policy")
    note: str = Field(..., min_length=3, description="Routing instruction under firm policy")
    due_date: Optional[datetime] = Field(None, description="Updated anomaly remediation deadline")
    client_facing_template: Optional[str] = Field(None, description="Pre-approved client clarification template")


def _check_case_access(db: Session, case_id: uuid.UUID, auth_ctx: AuthContext) -> ImmigrationCase:
    case = db.scalar(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
        )
    )
    if not case:
        raise NotFoundError("Immigration case not found.")

    auth_ctx.assert_organization_access(case.organization_id)
    auth_ctx.assert_case_access(case, client_user_id=case.client.user_id if case.client else None)
    return case


@router.get("", response_model=List[AIFindingOut])
def list_case_findings(
    case_id: uuid.UUID,
    severity: Optional[str] = Query(None, description="critical, major, minor, informational"),
    status: Optional[str] = Query(None, description="needs_review, unable_to_determine, resolved, dismissed"),
    finding_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Lists all AI analysis findings for a case with filtering."""
    _check_case_access(db, case_id, auth_ctx)

    stmt = select(CaseAIFinding).where(
        CaseAIFinding.case_id == case_id,
        CaseAIFinding.organization_id == auth_ctx.organization_id,
    )

    if severity:
        stmt = stmt.where(CaseAIFinding.severity == severity)
    if status:
        stmt = stmt.where(CaseAIFinding.status == status)
    if finding_type:
        stmt = stmt.where(CaseAIFinding.finding_type == finding_type)

    stmt = stmt.order_by(CaseAIFinding.created_at.desc())
    findings = db.scalars(stmt).all()

    return [_to_finding_out(f, auth_ctx.is_retained_client()) for f in findings]


@router.post("/analyze", response_model=List[AIFindingOut])
def trigger_case_ai_analysis(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Triggers AI document analysis, cross-document comparison, quality checks, and checklist audits."""
    if "case:write" not in auth_ctx.permissions and "finding:disposition" not in auth_ctx.permissions:
        raise PermissionDeniedError("Insufficient permissions to run case AI analysis.")

    _check_case_access(db, case_id, auth_ctx)
    findings = run_case_ai_analysis(db, case_id, auth_ctx.organization_id)

    return [_to_finding_out(f, auth_ctx.is_retained_client()) for f in findings]


@router.get("/checklist")
def get_case_checklist_audit(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Returns statutory pathway checklist audit report for the case."""
    case = _check_case_access(db, case_id, auth_ctx)

    doc_stmt = select(Document).where(
        Document.case_id == case_id,
        Document.organization_id == auth_ctx.organization_id,
        Document.is_current_version == True,
    )
    docs = db.scalars(doc_stmt).all()
    doc_dicts = [
        {
            "id": str(d.id),
            "title": d.title,
            "filename": d.filename,
            "category": d.category,
            "processing_status": d.processing_status,
            "verification_status": d.verification_status,
        }
        for d in docs
    ]

    report = audit_case_checklist(
        case.jurisdiction,
        case.visa_category,
        doc_dicts,
        checklist_snapshot=case.pinned_checklist_snapshot if getattr(case, "pinned_checklist_snapshot", None) else None,
    )
    return {
        "jurisdiction": report.jurisdiction,
        "visa_category": report.visa_category,
        "is_pinned": report.is_pinned,
        "version": report.version,
        "total_mandatory": report.total_mandatory,
        "satisfied_mandatory": report.satisfied_mandatory,
        "total_items": report.total_items,
        "satisfied_items": report.satisfied_items,
        "fulfillment_percentage": report.fulfillment_percentage,
        "items": [
            {
                "item_id": it.item_id,
                "label": it.label,
                "requirement_citation": it.requirement_citation,
                "is_mandatory": it.is_mandatory,
                "is_satisfied": it.is_satisfied,
                "matching_document_id": it.matching_document_id,
                "matching_document_title": it.matching_document_title,
                "notes": it.notes,
            }
            for it in report.items
        ],
    }


@router.get("/summary")
def get_case_evidence_summary(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Generates an evidence-backed case summary with explicit citations and uncertainty disclosures."""
    case = _check_case_access(db, case_id, auth_ctx)

    doc_stmt = select(Document).where(
        Document.case_id == case_id,
        Document.organization_id == auth_ctx.organization_id,
        Document.is_current_version == True,
    )
    docs = db.scalars(doc_stmt).all()

    doc_dicts = [
        {
            "id": str(d.id),
            "title": d.title,
            "filename": d.filename,
            "category": d.category,
            "page_count": d.page_count,
            "ocr_applied": d.ocr_applied,
            "verification_status": d.verification_status,
            "extracted_fields": [
                {
                    "field_name": f.field_name,
                    "field_label": f.field_label,
                    "original_value": f.original_value,
                    "normalized_value": f.corrected_value if f.is_manually_corrected else f.normalized_value,
                    "source_page": f.source_page,
                    "validation_status": f.validation_status,
                    "extraction_confidence": f.extraction_confidence,
                }
                for f in d.extracted_fields
            ],
        }
        for d in docs
    ]

    findings_stmt = select(CaseAIFinding).where(
        CaseAIFinding.case_id == case_id,
        CaseAIFinding.organization_id == auth_ctx.organization_id,
    )
    findings = db.scalars(findings_stmt).all()
    finding_dicts = [
        {
            "id": str(f.id),
            "severity": f.severity,
            "title": f.title,
            "description": f.description,
            "status": f.status,
            "is_confirmed_contradiction": f.is_confirmed_contradiction,
            "clarification_question": f.clarification_question,
            "recommended_action": f.recommended_action,
        }
        for f in findings
    ]

    checklist_report = audit_case_checklist(
        case.jurisdiction,
        case.visa_category,
        doc_dicts,
        checklist_snapshot=case.pinned_checklist_snapshot if getattr(case, "pinned_checklist_snapshot", None) else None,
    )

    summary = generate_evidence_backed_case_summary(
        case_data={"case_number": case.case_number, "jurisdiction": case.jurisdiction, "visa_category": case.visa_category},
        client_data={"first_name": case.client.first_name if case.client else "", "last_name": case.client.last_name if case.client else ""},
        documents=doc_dicts,
        findings=finding_dicts,
        checklist_report={
            "fulfillment_percentage": checklist_report.fulfillment_percentage,
            "satisfied_mandatory": checklist_report.satisfied_mandatory,
            "total_mandatory": checklist_report.total_mandatory,
            "missing_items": [
                {"label": m.label, "requirement_citation": m.requirement_citation, "is_mandatory": m.is_mandatory}
                for m in checklist_report.missing_items
            ],
        },
    )

    return {
        "case_number": summary.case_number,
        "jurisdiction": summary.jurisdiction,
        "visa_category": summary.visa_category,
        "generated_at": summary.generated_at,
        "verified_facts": summary.verified_facts,
        "potential_discrepancies": summary.potential_discrepancies,
        "uncertainty_disclosures": summary.uncertainty_disclosures,
        "suggested_clarification_questions": summary.suggested_clarification_questions,
        "summary_markdown": summary.summary_markdown,
    }


class SummarizeAuthorityRequestIn(BaseModel):
    authority_text: Optional[str] = Field(None, description="Direct text of the official authority notice")
    document_id: Optional[uuid.UUID] = Field(None, description="Document ID containing the scanned/uploaded notice")


@router.post("/summarize-authority-request")
def summarize_case_authority_request(
    case_id: uuid.UUID,
    payload: Optional[SummarizeAuthorityRequestIn] = None,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """
    Summarizes an official authority notice (RFE, NOID, PFL, 221g) against case evidence with grounded citations.
    """
    case = _check_case_access(db, case_id, auth_ctx)
    text = (payload.authority_text if payload else "") or ""
    doc_title = None

    if payload and payload.document_id:
        doc = db.query(Document).filter(
            Document.id == payload.document_id,
            Document.organization_id == auth_ctx.organization_id,
        ).first()
        if doc:
            doc_title = doc.title
            text = text or doc.extracted_text or ""

    if not text.strip():
        text = "Please submit additional supporting evidence regarding applicant eligibility and employment history."

    docs = db.scalars(
        select(Document).where(
            Document.case_id == case_id,
            Document.organization_id == auth_ctx.organization_id,
            Document.is_current_version == True,
        )
    ).all()

    doc_dicts = [
        {
            "id": str(d.id),
            "title": d.title,
            "filename": d.filename,
            "category": d.category,
            "page_count": d.page_count,
            "verification_status": d.verification_status,
        }
        for d in docs
    ]

    all_fields = []
    for d in docs:
        for f in d.extracted_fields:
            all_fields.append({
                "field_name": f.field_name,
                "field_label": f.field_label,
                "original_value": f.original_value,
                "normalized_value": f.corrected_value if f.is_manually_corrected else f.normalized_value,
                "source_page": f.source_page,
                "validation_status": f.validation_status,
                "extraction_confidence": f.extraction_confidence,
            })

    from backend.app.ai.summarizer import summarize_authority_request
    summary = summarize_authority_request(
        case_data={"case_number": case.case_number, "jurisdiction": case.jurisdiction},
        authority_request_text=text,
        case_documents=doc_dicts,
        extracted_fields=all_fields,
        document_title=doc_title,
    )

    return {
        "case_number": summary.case_number,
        "authority_name": summary.authority_name,
        "request_type": summary.request_type,
        "response_deadline": summary.response_deadline,
        "generated_at": summary.generated_at,
        "items_analyzed": [
            {
                "item_id": it.item_id,
                "authority_issue": it.authority_issue,
                "supporting_evidence_found": it.supporting_evidence_found,
                "is_addressed_by_case_record": it.is_addressed_by_case_record,
                "unaddressed_deficiency_notes": it.unaddressed_deficiency_notes,
            }
            for it in summary.items_analyzed
        ],
        "addressed_count": summary.addressed_count,
        "unaddressed_count": summary.unaddressed_count,
        "provenance": summary.provenance,
        "summary_markdown": summary.summary_markdown,
        "legal_sufficiency_disclaimer": summary.legal_sufficiency_disclaimer,
    }


@router.get("/{finding_id}", response_model=AIFindingOut)
def get_case_finding(
    case_id: uuid.UUID,
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Retrieves an individual finding, enforcing client privacy boundaries."""
    _check_case_access(db, case_id, auth_ctx)
    f = db.scalar(
        select(CaseAIFinding).where(
            CaseAIFinding.id == finding_id,
            CaseAIFinding.case_id == case_id,
            CaseAIFinding.organization_id == auth_ctx.organization_id,
        )
    )
    if not f:
        raise NotFoundError("Finding not found.")
    return _to_finding_out(f, auth_ctx.is_retained_client())


@router.put("/{finding_id}/resolve", response_model=AIFindingOut)
def resolve_case_finding(
    case_id: uuid.UUID,
    finding_id: uuid.UUID,
    payload: ResolveFindingIn,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Allows an authorized reviewer to resolve a finding with legal rationale."""
    if "finding:disposition" not in auth_ctx.permissions and "case:write" not in auth_ctx.permissions:
        raise PermissionDeniedError("Insufficient permissions to disposition AI findings.")

    _check_case_access(db, case_id, auth_ctx)
    try:
        f = resolve_finding(db, finding_id, auth_ctx.organization_id, auth_ctx.user_id, payload.note)
    except ValueError as e:
        raise NotFoundError(str(e))

    return _to_finding_out(f, auth_ctx.is_retained_client())


@router.put("/{finding_id}/dismiss", response_model=AIFindingOut)
def dismiss_case_finding(
    case_id: uuid.UUID,
    finding_id: uuid.UUID,
    payload: DismissFindingIn,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Allows an authorized reviewer to dismiss a finding with a required structured reason."""
    if "finding:disposition" not in auth_ctx.permissions and "case:write" not in auth_ctx.permissions:
        raise PermissionDeniedError("Insufficient permissions to disposition AI findings.")

    _check_case_access(db, case_id, auth_ctx)
    try:
        f = dismiss_finding(db, finding_id, auth_ctx.organization_id, auth_ctx.user_id, payload.reason, payload.note)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return _to_finding_out(f, auth_ctx.is_retained_client())


@router.put("/{finding_id}/escalate", response_model=AIFindingOut)
def escalate_case_finding(
    case_id: uuid.UUID,
    finding_id: uuid.UUID,
    payload: EscalateFindingIn,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Escalates a finding for senior attorney determination."""
    if "finding:disposition" not in auth_ctx.permissions and "case:write" not in auth_ctx.permissions:
        raise PermissionDeniedError("Insufficient permissions to escalate AI findings.")

    _check_case_access(db, case_id, auth_ctx)
    try:
        f = escalate_finding(db, finding_id, auth_ctx.organization_id, auth_ctx.user_id, payload.note)
    except ValueError as e:
        raise NotFoundError(str(e))

    return _to_finding_out(f, auth_ctx.is_retained_client())


@router.put("/{finding_id}/route", response_model=AIFindingOut)
def route_case_finding(
    case_id: uuid.UUID,
    finding_id: uuid.UUID,
    payload: RouteFindingIn,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
):
    """Allows authorized staff to route an anomaly or finding to a designated officer, manager, or lawyer under firm policy."""
    if "finding:disposition" not in auth_ctx.permissions and "case:write" not in auth_ctx.permissions:
        raise PermissionDeniedError("Insufficient permissions to route AI findings.")

    _check_case_access(db, case_id, auth_ctx)
    try:
        f = route_finding(
            db,
            finding_id,
            auth_ctx.organization_id,
            auth_ctx.user_id,
            payload.owner_user_id,
            payload.note,
            due_date=payload.due_date,
            client_facing_template=payload.client_facing_template,
        )
    except ValueError as e:
        raise NotFoundError(str(e))

    return _to_finding_out(f, auth_ctx.is_retained_client())
