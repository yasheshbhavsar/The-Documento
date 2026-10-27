"""Stage 8 AI Governance, Governed RAG, and Evaluation API Endpoints.

Enforces Stage 8 AI Governance (§6.6, §6.7, §8 of DOCUMENTO_MASTER_VISION.md):
- /api/v1/ai/rag/query: Governed RAG querying legal statutes & case evidence with citations.
- /api/v1/ai/evaluation/report: Live AI quality & production readiness evaluation suite.
- /api/v1/ai/tokens/usage: Firm AI token consumption, quotas, and cost accounting.
- /api/v1/ai/prompt-guard/scan: Adversarial prompt injection defense & defanging scanner.
- /api/v1/ai/cases/{case_id}/brief: Grounded evidentiary case briefing with uncertainty disclosures.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.models import Document, ImmigrationCase, CaseAIFinding
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.rbac import RoleCode
from backend.app.ai.rag_service import GovernedRAGService, GovernedRAGResponse
from backend.app.ai.evaluator import AIQualityEvaluator
from backend.app.ai.token_tracker import TokenBudgetManager
from backend.app.ai.prompt_guard import PromptGuard
from backend.app.ai.summarizer import generate_evidence_backed_case_summary
from backend.app.core.errors import NotFoundError

router = APIRouter(prefix="/ai", tags=["ai"])


# ==============================================================================
# SCHEMAS
# ==============================================================================

class RAGQueryRequest(BaseModel):
    case_id: uuid.UUID
    query: str = Field(..., min_length=2, max_length=1000)
    jurisdiction: Optional[str] = "US"
    visa_category: Optional[str] = "EB-1A"


class PromptGuardScanRequest(BaseModel):
    text: str = Field(..., max_length=10000)


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.post("/rag/query")
def query_governed_rag(
    payload: RAGQueryRequest,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
) -> Dict[str, Any]:
    """
    Executes a governed RAG query comparing case evidence against statutory authorities.
    Returns grounded citations, uncertainty disclosures, and prompt injection defense metrics.
    """
    case = (
        db.query(ImmigrationCase)
        .filter(
            ImmigrationCase.id == payload.case_id,
            ImmigrationCase.organization_id == auth_ctx.organization_id,
        )
        .first()
    )
    if not case:
        raise NotFoundError("Case not found or unauthorized")

    # Fetch case documents belonging strictly to this organization
    docs = (
        db.query(Document)
        .filter(
            Document.case_id == case.id,
            Document.organization_id == auth_ctx.organization_id,
            Document.is_purged == False,
        )
        .all()
    )

    doc_dicts = [
        {
            "id": str(d.id),
            "organization_id": str(d.organization_id),
            "title": d.title or d.filename,
            "filename": d.filename,
            "category": d.category,
            "verification_status": d.verification_status,
            "extracted_fields": [
                {
                    "field_name": ef.field_name,
                    "field_label": ef.field_label or ef.field_name,
                    "original_value": ef.original_value,
                    "normalized_value": ef.normalized_value,
                    "source_page": ef.source_page or 1,
                    "validation_status": ef.validation_status,
                }
                for ef in (d.extracted_fields or [])
            ],
        }
        for d in docs
    ]

    response: GovernedRAGResponse = GovernedRAGService.query_case_and_law(
        organization_id=auth_ctx.organization_id,
        case_id=case.id,
        query=payload.query,
        jurisdiction=payload.jurisdiction or case.jurisdiction or "US",
        visa_category=payload.visa_category or case.visa_category or "EB-1A",
        case_documents=doc_dicts,
        case_data={"case_number": case.case_number, "jurisdiction": case.jurisdiction, "visa_category": case.visa_category},
        client_data={
            "client_name": f"{case.client.first_name} {case.client.last_name}".strip()
            if getattr(case, "client", None)
            else ""
        },
        actor_id=auth_ctx.user_id,
    )

    return {
        "query": response.query,
        "answer": response.answer,
        "jurisdiction": response.jurisdiction,
        "visa_category": response.visa_category,
        "is_grounded": response.is_grounded,
        "evidence_found": response.evidence_found,
        "confidence_score": response.confidence_score,
        "citations": [
            {
                "source_type": c.source_type,
                "title": c.title,
                "reference_id": c.reference_id,
                "citation": c.citation,
                "page": c.page,
                "excerpt": c.excerpt,
                "is_verified_by_human": c.is_verified_by_human,
            }
            for c in response.citations
        ],
        "uncertainty_disclosures": response.uncertainty_disclosures,
        "missing_evidence_items": response.missing_evidence_items,
        "prompt_injection_flagged": response.prompt_injection_flagged,
        "prompt_risk_score": response.prompt_risk_score,
        "token_usage": response.token_usage,
        "legal_sufficiency_disclaimer": response.legal_sufficiency_disclaimer,
    }


@router.get("/evaluation/report")
def get_ai_evaluation_report(
    auth_ctx: AuthContext = Depends(get_auth_context),
) -> Dict[str, Any]:
    """
    Executes the comprehensive AI Quality and Production Readiness Evaluation Suite.
    Measures OCR character/word accuracy, classification F1, discrepancy precision/recall,
    prompt injection defense (100% block rate target), and zero cross-tenant contamination.
    """
    report = AIQualityEvaluator.run_full_evaluation_suite()
    return report


@router.get("/tokens/usage")
def get_firm_token_usage(
    auth_ctx: AuthContext = Depends(get_auth_context),
) -> Dict[str, Any]:
    """
    Returns aggregated token consumption, estimated USD cost, and monthly quota metrics
    for the authenticated organization.
    """
    return TokenBudgetManager.get_organization_usage(auth_ctx.organization_id)


@router.post("/prompt-guard/scan")
def scan_text_for_prompt_injection(
    payload: PromptGuardScanRequest,
    auth_ctx: AuthContext = Depends(get_auth_context),
) -> Dict[str, Any]:
    """
    Scans arbitrary text for adversarial prompt injection, jailbreaks, or instruction override patterns.
    Returns detected pattern labels, risk score, and defanged sanitized text.
    """
    is_flagged, detected_patterns, risk_score = PromptGuard.scan_for_injection(payload.text)
    sanitized = PromptGuard.sanitize_untrusted_text(payload.text)
    return {
        "is_flagged": is_flagged,
        "detected_patterns": detected_patterns,
        "risk_score": risk_score,
        "sanitized_text": sanitized,
    }


@router.get("/cases/{case_id}/brief")
def get_case_evidence_brief(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context),
) -> Dict[str, Any]:
    """
    Generates an evidence-backed case summary strictly grounded in uploaded case documents,
    with explicit uncertainty disclosures and clarification questions.
    """
    case = (
        db.query(ImmigrationCase)
        .filter(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth_ctx.organization_id,
        )
        .first()
    )
    if not case:
        raise NotFoundError("Case not found or unauthorized")

    docs = (
        db.query(Document)
        .filter(
            Document.case_id == case.id,
            Document.organization_id == auth_ctx.organization_id,
            Document.is_purged == False,
        )
        .all()
    )

    findings = (
        db.query(CaseAIFinding)
        .filter(
            CaseAIFinding.case_id == case.id,
            CaseAIFinding.organization_id == auth_ctx.organization_id,
        )
        .all()
    )

    doc_dicts = [
        {
            "id": str(d.id),
            "title": d.title or d.filename,
            "filename": d.filename,
            "category": d.category,
            "verification_status": d.verification_status,
            "ocr_applied": d.ocr_applied,
            "page_count": d.page_count or 1,
            "extracted_fields": [
                {
                    "field_name": ef.field_name,
                    "field_label": ef.field_label or ef.field_name,
                    "original_value": ef.original_value,
                    "normalized_value": ef.normalized_value,
                    "source_page": ef.source_page or 1,
                    "validation_status": ef.validation_status,
                    "extraction_confidence": ef.extraction_confidence or 0.95,
                }
                for ef in (d.extracted_fields or [])
            ],
        }
        for d in docs
    ]

    finding_dicts = [
        {
            "id": str(f.id),
            "severity": f.severity,
            "title": f.title,
            "description": f.description,
            "status": f.status,
            "clarification_question": f.clarification_question,
            "recommended_action": f.recommended_action,
            "uncertainty_limitations": getattr(f, "uncertainty_limitations", None),
        }
        for f in findings
    ]

    summary = generate_evidence_backed_case_summary(
        case_data={"case_number": case.case_number, "jurisdiction": case.jurisdiction, "visa_category": case.visa_category},
        client_data={"first_name": case.client.first_name if getattr(case, "client", None) else "", "last_name": case.client.last_name if getattr(case, "client", None) else ""},
        documents=doc_dicts,
        findings=finding_dicts,
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
