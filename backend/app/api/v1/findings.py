"""API endpoints for AI document analysis, discrepancy detection, and finding resolution."""
import uuid
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


class ResolveFindingIn(BaseModel):
    note: str = Field(..., min_length=3, description="Legal reviewer resolution rationale")


class DismissFindingIn(BaseModel):
    reason: str = Field(..., description="Structured dismissal reason")
    note: Optional[str] = Field(None, description="Optional caseworker notes")


class EscalateFindingIn(BaseModel):
    note: str = Field(..., min_length=3, description="Escalation explanation for senior counsel")


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

    return [
        AIFindingOut(
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
        for f in findings
    ]


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

    return [
        AIFindingOut(
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
        for f in findings
    ]


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

    report = audit_case_checklist(case.jurisdiction, case.visa_category, doc_dicts)
    return {
        "jurisdiction": report.jurisdiction,
        "visa_category": report.visa_category,
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

    checklist_report = audit_case_checklist(case.jurisdiction, case.visa_category, doc_dicts)

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
