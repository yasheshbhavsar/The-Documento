"""AI-Assisted Client Request Drafter from Approved Templates.

Implements Phase 10 Requirements:
- Drafts client evidence requests from firm-approved regulatory templates.
- Enforces strict human-in-the-loop control: All AI-drafted requests enter
  'draft' status and CANNOT be transmitted to the client until an authorized
  staff member reviews, edits if needed, and explicitly approves dispatch.
- Protects internal confidentiality: Internal risk notes and suspicion notes
  are NEVER included in client-facing requests.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.errors import NotFoundError, PermissionDeniedError, ValidationError
from backend.app.domain.models import (
    AuditEvent,
    CaseAIFinding,
    ClientProfile,
    DocumentRequest,
    ImmigrationCase,
    now_utc,
)
from backend.app.notifications.service import NotificationService

logger = logging.getLogger("ai_immigration.ai.client_request_drafter")

# ---------------------------------------------------------------------------
# Approved Firm Request Templates
# ---------------------------------------------------------------------------
APPROVED_REQUEST_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "PASSPORT_BIO_PAGE_UNCERTAINTY": {
        "template_code": "PASSPORT_BIO_PAGE_UNCERTAINTY",
        "title": "Clear Passport Biographic Information Page",
        "category": "identity_passport",
        "rationale": "The currently submitted passport bio-page scan exhibits optical glare, partial cutoff, or indistinct machine-readable zone (MRZ) characters.",
        "description": "Please provide a complete, full-color, high-resolution scan of your passport identification page.",
        "instructions": "Ensure all 4 corners of the passport booklet are visible and the bottom two MRZ lines (P<...) are sharp, legible, and glare-free.",
        "translation_guidance": "If your passport is not in English or French, please also attach a certified English translation.",
        "acceptable_alternatives": "National identity card, citizen card, or consular certificate of identity.",
        "default_lead_days": 7,
    },
    "NAME_DISCREPANCY_CLARIFICATION": {
        "template_code": "NAME_DISCREPANCY_CLARIFICATION",
        "title": "One-and-the-Same Name Affidavit / Gazette Notification",
        "category": "civil_status_family",
        "rationale": "A variation in name spelling or name structure was detected between your primary passport and supporting civil or academic records.",
        "description": "Please provide formal documentation or an affidavit affirming the legal concordance of your name across documents.",
        "instructions": "Submit a sworn one-and-the-same affidavit executed before a notary public, a government gazette name change notification, or marriage certificate showing change of name.",
        "translation_guidance": "Certified English translation is mandatory for all vernacular affidavits.",
        "acceptable_alternatives": "Official deed poll or court order verifying name change.",
        "default_lead_days": 14,
    },
    "ACADEMIC_CREDENTIAL_EVALUATION": {
        "template_code": "ACADEMIC_CREDENTIAL_EVALUATION",
        "title": "Consolidated Academic Transcript and Degree Certificate",
        "category": "educational_records",
        "rationale": "Immigration regulations require verifiable transcripts demonstrating full curriculum completion and date of degree conferral.",
        "description": "Please provide your official university degree diploma and all semester marksheets.",
        "instructions": "Upload clear color copies of your final degree certificate along with consolidated or semester-wise marksheets indicating grades and credits.",
        "translation_guidance": "Provide certified translations of all foreign language diplomas and transcripts.",
        "acceptable_alternatives": "Provisional degree certificate issued by the university registrar accompanied by a letter of completion.",
        "default_lead_days": 14,
    },
    "EXPERIENCE_DUTIES_BREAKDOWN": {
        "template_code": "EXPERIENCE_DUTIES_BREAKDOWN",
        "title": "Detailed Employer Experience and Roles Verification Letter",
        "category": "employment_records",
        "rationale": "The current employer letter lacks the granular breakdown of technical duties, hours worked per week, or compensation required by immigration adjudicators.",
        "description": "Please obtain an updated experience certificate on official company letterhead.",
        "instructions": "The letter must state your job title, dates of employment, whether full-time (minimum 30 hours/week), annual compensation, and an itemized breakdown of principal daily duties.",
        "translation_guidance": "Must be accompanied by a certified English translation if issued in a foreign language.",
        "acceptable_alternatives": "Offer letter + promotion letters + recent 6 months pay slips + tax statement (Form 16 / W-2).",
        "default_lead_days": 21,
    },
    "FINANCIAL_SUFFICIENT_FUNDS": {
        "template_code": "FINANCIAL_SUFFICIENT_FUNDS",
        "title": "Official Bank Statement with Branch Verification Seal",
        "category": "financial_evidence",
        "rationale": "Visa authorities require continuous 6-month proof of unencumbered liquid funds without unseasoned or unverified lump sum deposits.",
        "description": "Please upload an official continuous 6-month bank statement.",
        "instructions": "Statements must reflect account holder name, account number, continuous daily balances, and bear the physical stamp/seal of the branch or QR verification watermark.",
        "translation_guidance": "Not applicable for English bank statements. Non-English statements must include certified translation of column headers.",
        "acceptable_alternatives": "Fixed deposit certificates accompanied by a bank confirmation letter affirming immediate liquid withdrawal capability.",
        "default_lead_days": 10,
    },
    "AUTHORITY_REQUEST_REBUTTAL": {
        "template_code": "AUTHORITY_REQUEST_REBUTTAL",
        "title": "Supplementary Evidentiary Documentation for Authority Notice",
        "category": "supporting_evidence",
        "rationale": "An official government notice (RFE / NOID / PFL) has been issued by immigration authorities with a strict statutory response deadline.",
        "description": "Please review the attached authority inquiries and supply supporting documentation.",
        "instructions": "Review each point outlined by your legal team and upload all corroborating records well ahead of the final filing deadline.",
        "translation_guidance": "Strictly provide certified English translations for all non-English evidence submitted in response to government notices.",
        "acceptable_alternatives": "Detailed signed client declaration addressing factual inquiries.",
        "default_lead_days": 14,
    },
}


def get_approved_request_templates() -> List[Dict[str, Any]]:
    """Returns the list of firm-approved client request templates."""
    return list(APPROVED_REQUEST_TEMPLATES.values())


def draft_client_request_from_template(
    db: Session,
    case_id: UUID,
    template_code: str,
    finding_id: Optional[UUID] = None,
    custom_instructions: Optional[str] = None,
    custom_due_date: Optional[datetime] = None,
    actor_id: Optional[UUID] = None,
    organization_id: Optional[UUID] = None,
) -> DocumentRequest:
    """
    Drafts a client document request using a pre-approved regulatory template.
    Strictly sets status='draft' so that staff review is mandatory before delivery to client.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise NotFoundError(f"Immigration case {case_id} not found.")

    org_id = organization_id or case.organization_id
    if not case.client:
        raise ValidationError("Cannot draft client request for a case with no associated client profile.")

    template = APPROVED_REQUEST_TEMPLATES.get(template_code)
    if not template:
        raise ValidationError(f"Template '{template_code}' is not an approved client request template.")

    now = now_utc()
    due_date = custom_due_date or (now + timedelta(days=template["default_lead_days"]))

    # Optional: Link finding context if drafted from an AI finding
    finding_title = ""
    finding_client_text = ""
    if finding_id:
        finding = db.query(CaseAIFinding).filter(
            CaseAIFinding.id == finding_id,
            CaseAIFinding.case_id == case_id,
        ).first()
        if finding:
            finding_title = f" ({finding.title})"
            # Use pre-approved client-facing template text, NEVER internal risk notes!
            finding_client_text = finding.client_facing_template or finding.clarification_question or ""

    instructions = template["instructions"]
    if finding_client_text:
        instructions = f"{instructions}\n\nSpecific Clarification: {finding_client_text}"
    if custom_instructions:
        instructions = f"{instructions}\n\nCaseworker Notes: {custom_instructions}"

    request_id = uuid.uuid4()
    initial_history = [
        {
            "status": "draft",
            "changed_by": str(actor_id or "system_ai_assistant"),
            "timestamp": now.isoformat(),
            "notes": f"AI drafted request from approved template '{template_code}'. Staff review mandatory before send.",
            "is_ai_drafted": True,
            "approved_template_id": template_code,
            "requires_staff_review": True,
        }
    ]

    doc_req = DocumentRequest(
        id=request_id,
        organization_id=org_id,
        case_id=case_id,
        requested_by_user_id=actor_id,
        requested_from_client_id=case.client_id,
        dependant_id=None,
        title=f"{template['title']}{finding_title}",
        description=template["description"],
        category=template["category"],
        rationale=template["rationale"],
        statutory_requirement_code=template_code,
        accepted_formats=["application/pdf", "image/png", "image/jpeg"],
        acceptable_alternatives=template.get("acceptable_alternatives"),
        due_date=due_date,
        instructions=instructions,
        translation_guidance=template.get("translation_guidance"),
        status="draft",  # CRITICAL: Draft status ensures client CANNOT see this until staff approves!
        status_history=initial_history,
        created_at=now,
        updated_at=now,
    )

    db.add(doc_req)

    # If linked to a finding, associate linked_task or record history
    if finding_id and finding:
        hist = list(finding.resolution_history or [])
        hist.append({
            "action": "client_request_drafted",
            "document_request_id": str(request_id),
            "template_code": template_code,
            "drafted_at": now.isoformat(),
            "drafted_by": str(actor_id),
        })
        finding.resolution_history = hist

    audit = AuditEvent(
        organization_id=org_id,
        actor_id=actor_id,
        action="document_request.draft_created",
        object_type="document_request",
        object_id=str(request_id),
        metadata_json={
            "case_id": str(case_id),
            "template_code": template_code,
            "status": "draft",
            "requires_staff_review": True,
            "linked_finding_id": str(finding_id) if finding_id else None,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc_req)

    return doc_req


def review_and_send_client_request(
    db: Session,
    request_id: UUID,
    reviewer_id: UUID,
    organization_id: UUID,
    title_override: Optional[str] = None,
    description_override: Optional[str] = None,
    instructions_override: Optional[str] = None,
    due_date_override: Optional[datetime] = None,
    review_notes: Optional[str] = None,
) -> DocumentRequest:
    """
    Authorizes and dispatches an AI-drafted client request after staff review.
    Transitions status from 'draft' -> 'requested', and notifies the client portal.
    """
    doc_req = db.query(DocumentRequest).filter(
        DocumentRequest.id == request_id,
        DocumentRequest.organization_id == organization_id,
    ).first()

    if not doc_req:
        raise NotFoundError(f"Document request {request_id} not found.")

    if doc_req.status != "draft":
        raise ValidationError(f"Document request {request_id} is in status '{doc_req.status}', not 'draft'.")

    now = now_utc()

    # Apply any staff overrides
    if title_override:
        doc_req.title = title_override.strip()
    if description_override:
        doc_req.description = description_override.strip()
    if instructions_override:
        doc_req.instructions = instructions_override.strip()
    if due_date_override:
        doc_req.due_date = due_date_override

    # Transition to requested
    doc_req.status = "requested"
    doc_req.requested_by_user_id = reviewer_id
    doc_req.updated_at = now

    hist = list(doc_req.status_history or [])
    hist.append({
        "status": "requested",
        "changed_by": str(reviewer_id),
        "timestamp": now.isoformat(),
        "notes": review_notes or "Staff reviewed and approved AI draft for client transmission.",
        "staff_review_completed": True,
    })
    doc_req.status_history = hist

    # Notify client portal
    client = db.query(ClientProfile).filter(ClientProfile.id == doc_req.requested_from_client_id).first()
    if client and client.user_id:
        NotificationService.create_notification(
            db=db,
            organization_id=organization_id,
            user_id=client.user_id,
            title="Evidence Request Issued",
            body=f"Your legal team requested documentation: '{doc_req.title}'. Please review details in your portal.",
            notification_type="new_request",
            channel="in_app",
            metadata={"case_id": str(doc_req.case_id), "request_id": str(doc_req.id)},
        )

    audit = AuditEvent(
        organization_id=organization_id,
        actor_id=reviewer_id,
        action="document_request.staff_approved_and_sent",
        object_type="document_request",
        object_id=str(request_id),
        metadata_json={
            "case_id": str(doc_req.case_id),
            "title": doc_req.title,
            "status": "requested",
            "reviewed_by": str(reviewer_id),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc_req)

    return doc_req
