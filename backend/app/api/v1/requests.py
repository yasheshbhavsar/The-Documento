import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.errors import EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    AuditEvent,
    ClientProfile,
    Document,
    DocumentRequest,
    DocumentRequestComment,
    ImmigrationCase,
    User,
)
from backend.app.notifications.service import NotificationService
from backend.app.security.auth import AuthContext, get_auth_context

router = APIRouter(prefix="/requests", tags=["document_requests"])


# --- Pydantic Schemas ---

class DocumentRequestCreate(BaseModel):
    case_id: uuid.UUID
    requested_from_client_id: uuid.UUID
    dependant_id: uuid.UUID | None = None
    title: str = Field(..., min_length=2, max_length=255)
    description: str = Field(..., min_length=2)
    category: str = Field(default="supporting_evidence", max_length=64)
    rationale: str = Field(..., min_length=2, description="Why this evidence is needed")
    statutory_requirement_code: str | None = Field(default=None, max_length=100)
    accepted_formats: list[str] = Field(default_factory=lambda: ["application/pdf", "image/png", "image/jpeg"])
    acceptable_alternatives: str | None = None
    due_date: datetime | None = None
    instructions: str | None = None
    translation_guidance: str | None = None


class DocumentRequestResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    case_id: uuid.UUID
    requested_by_user_id: uuid.UUID | None
    requested_from_client_id: uuid.UUID
    dependant_id: uuid.UUID | None
    title: str
    description: str
    category: str
    rationale: str
    statutory_requirement_code: str | None
    accepted_formats: list[str]
    acceptable_alternatives: str | None
    due_date: datetime | None
    instructions: str | None
    translation_guidance: str | None
    status: str
    fulfilled_document_id: uuid.UUID | None
    rejection_reason: str | None
    status_history: list[dict]
    created_at: datetime
    updated_at: datetime
    comments_count: int = 0


class DocumentRequestRespondRequest(BaseModel):
    document_id: uuid.UUID
    response_notes: str | None = None


class DocumentRequestReviewRequest(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    rejection_reason: str | None = None
    review_notes: str | None = None


class DocumentRequestReplaceRequest(BaseModel):
    replacement_document_id: uuid.UUID
    explanation: str | None = None


class DraftRequestIn(BaseModel):
    case_id: uuid.UUID
    template_code: str
    finding_id: uuid.UUID | None = None
    custom_instructions: str | None = None
    due_date: datetime | None = None


class ApproveDraftRequestIn(BaseModel):
    title_override: str | None = None
    description_override: str | None = None
    instructions_override: str | None = None
    due_date_override: datetime | None = None
    review_notes: str | None = None


class CommentCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)
    is_internal: bool = Field(default=False)


class CommentResponse(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    user_id: uuid.UUID
    author_name: str
    content: str
    is_internal: bool
    created_at: datetime


# --- Helpers ---

def _resolve_client_profile_for_user(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> ClientProfile | None:
    return (
        db.query(ClientProfile)
        .filter(ClientProfile.organization_id == org_id, ClientProfile.user_id == user_id)
        .first()
    )


# --- Endpoints ---

@router.post("", response_model=DocumentRequestResponse, status_code=status.HTTP_201_CREATED)
def create_document_request(
    payload: DocumentRequestCreate,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Staff creates a formal document request specifying rationale, acceptable formats,
    due date, translation guidance, and statutory requirement.
    """
    if ctx.is_retained_client():
        raise PermissionDeniedError("Clients cannot create document requests")

    ctx.assert_organization_access(ctx.organization_id)
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == payload.case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", payload.case_id)
    client_user_id = case.client.user_id if case.client else None
    authorized_deps = [d.user_id for d in case.client.dependants if d.is_authorized_to_view_case and d.user_id] if case.client else []
    assigned_user_ids = [a.user_id for a in case.assignments]
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        authorized_dependant_user_ids=authorized_deps,
        assigned_user_ids=assigned_user_ids,
    )

    client_profile = db.query(ClientProfile).filter(ClientProfile.id == payload.requested_from_client_id).first()
    if not client_profile:
        raise EntityNotFoundError("ClientProfile", payload.requested_from_client_id)

    now = datetime.now(timezone.utc)
    initial_history = [{
        "status": "requested",
        "changed_by": str(ctx.user_id),
        "timestamp": now.isoformat(),
        "notes": "Document request issued by staff",
    }]

    doc_req = DocumentRequest(
        organization_id=ctx.organization_id,
        case_id=payload.case_id,
        requested_by_user_id=ctx.user_id,
        requested_from_client_id=payload.requested_from_client_id,
        dependant_id=payload.dependant_id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        rationale=payload.rationale,
        statutory_requirement_code=payload.statutory_requirement_code,
        accepted_formats=payload.accepted_formats,
        acceptable_alternatives=payload.acceptable_alternatives,
        due_date=payload.due_date,
        instructions=payload.instructions,
        translation_guidance=payload.translation_guidance,
        status="requested",
        status_history=initial_history,
        created_at=now,
        updated_at=now,
    )
    db.add(doc_req)
    db.commit()
    db.refresh(doc_req)

    # Notify client if registered
    if client_profile.user_id:
        NotificationService.create_notification(
            db=db,
            organization_id=ctx.organization_id,
            user_id=client_profile.user_id,
            title="New Document Request Issued",
            body=f"Your legal team requested evidence: {payload.title}. Please review in your portal.",
            notification_type="new_request",
            channel="in_app",
            metadata={"case_id": str(payload.case_id), "request_id": str(doc_req.id)},
        )

    return DocumentRequestResponse(
        id=doc_req.id,
        organization_id=doc_req.organization_id,
        case_id=doc_req.case_id,
        requested_by_user_id=doc_req.requested_by_user_id,
        requested_from_client_id=doc_req.requested_from_client_id,
        dependant_id=doc_req.dependant_id,
        title=doc_req.title,
        description=doc_req.description,
        category=doc_req.category,
        rationale=doc_req.rationale,
        statutory_requirement_code=doc_req.statutory_requirement_code,
        accepted_formats=doc_req.accepted_formats,
        acceptable_alternatives=doc_req.acceptable_alternatives,
        due_date=doc_req.due_date,
        instructions=doc_req.instructions,
        translation_guidance=doc_req.translation_guidance,
        status=doc_req.status,
        fulfilled_document_id=doc_req.fulfilled_document_id,
        rejection_reason=doc_req.rejection_reason,
        status_history=doc_req.status_history,
        created_at=doc_req.created_at,
        updated_at=doc_req.updated_at,
        comments_count=0,
    )


@router.get("", response_model=list[DocumentRequestResponse])
def list_document_requests(
    case_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Lists document requests.
    CRITICAL AUTHORIZATION: Retained clients are strictly limited to their own requests.
    """
    query = db.query(DocumentRequest).filter(DocumentRequest.organization_id == ctx.organization_id)

    if ctx.is_retained_client():
        # Resolve client profile for the authenticated user
        client = _resolve_client_profile_for_user(db, ctx.organization_id, ctx.user_id)
        if not client:
            return []
        query = query.filter(DocumentRequest.requested_from_client_id == client.id)
        # PRIVACY ENFORCEMENT: Clients can NEVER see unapproved staff drafts!
        query = query.filter(DocumentRequest.status != "draft")

    if case_id:
        query = query.filter(DocumentRequest.case_id == case_id)
    if status_filter:
        query = query.filter(DocumentRequest.status == status_filter)

    requests = query.order_by(DocumentRequest.created_at.desc()).all()

    return [
        DocumentRequestResponse(
            id=r.id,
            organization_id=r.organization_id,
            case_id=r.case_id,
            requested_by_user_id=r.requested_by_user_id,
            requested_from_client_id=r.requested_from_client_id,
            dependant_id=r.dependant_id,
            title=r.title,
            description=r.description,
            category=r.category,
            rationale=r.rationale,
            statutory_requirement_code=r.statutory_requirement_code,
            accepted_formats=r.accepted_formats,
            acceptable_alternatives=r.acceptable_alternatives,
            due_date=r.due_date,
            instructions=r.instructions,
            translation_guidance=r.translation_guidance,
            status=r.status,
            fulfilled_document_id=r.fulfilled_document_id,
            rejection_reason=r.rejection_reason,
            status_history=r.status_history,
            created_at=r.created_at,
            updated_at=r.updated_at,
            comments_count=len(r.comments),
        )
        for r in requests
    ]


@router.get("/{request_id}", response_model=DocumentRequestResponse)
def get_document_request(
    request_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Fetches a single document request with strict object-level authorization."""
    req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not req:
        raise EntityNotFoundError("DocumentRequest", request_id)

    ctx.assert_organization_access(req.organization_id)

    if ctx.is_retained_client():
        client = _resolve_client_profile_for_user(db, ctx.organization_id, ctx.user_id)
        if not client or req.requested_from_client_id != client.id:
            raise PermissionDeniedError("Clients cannot access another client's document requests")

    return DocumentRequestResponse(
        id=req.id,
        organization_id=req.organization_id,
        case_id=req.case_id,
        requested_by_user_id=req.requested_by_user_id,
        requested_from_client_id=req.requested_from_client_id,
        dependant_id=req.dependant_id,
        title=req.title,
        description=req.description,
        category=req.category,
        rationale=req.rationale,
        statutory_requirement_code=req.statutory_requirement_code,
        accepted_formats=req.accepted_formats,
        acceptable_alternatives=req.acceptable_alternatives,
        due_date=req.due_date,
        instructions=req.instructions,
        translation_guidance=req.translation_guidance,
        status=req.status,
        fulfilled_document_id=req.fulfilled_document_id,
        rejection_reason=req.rejection_reason,
        status_history=req.status_history,
        created_at=req.created_at,
        updated_at=req.updated_at,
        comments_count=len(req.comments),
    )


@router.post("/{request_id}/respond", response_model=DocumentRequestResponse)
def respond_to_request(
    request_id: uuid.UUID,
    payload: DocumentRequestRespondRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Client responds to a document request by linking uploaded evidence.
    Transitions status to 'submitted'.
    """
    req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not req:
        raise EntityNotFoundError("DocumentRequest", request_id)

    ctx.assert_organization_access(req.organization_id)

    if ctx.is_retained_client():
        client = _resolve_client_profile_for_user(db, ctx.organization_id, ctx.user_id)
        if not client or req.requested_from_client_id != client.id:
            raise PermissionDeniedError("Cannot respond to another client's request")

    doc = db.query(Document).filter(Document.id == payload.document_id).first()
    if not doc:
        raise EntityNotFoundError("Document", payload.document_id)

    now = datetime.now(timezone.utc)
    req.fulfilled_document_id = doc.id
    req.status = "submitted"
    req.rejection_reason = None
    req.updated_at = now

    history = list(req.status_history)
    history.append({
        "status": "submitted",
        "changed_by": str(ctx.user_id),
        "timestamp": now.isoformat(),
        "notes": payload.response_notes or "Evidence submitted by client",
        "document_id": str(doc.id),
    })
    req.status_history = history

    db.commit()
    db.refresh(req)

    # Notify staff member who issued request
    if req.requested_by_user_id:
        NotificationService.create_notification(
            db=db,
            organization_id=ctx.organization_id,
            user_id=req.requested_by_user_id,
            title="Document Request Fulfilled",
            body=f"Client submitted evidence for: {req.title}. Ready for legal review.",
            notification_type="review_request",
            channel="in_app",
            metadata={"case_id": str(req.case_id), "request_id": str(req.id)},
        )

    return DocumentRequestResponse(
        id=req.id,
        organization_id=req.organization_id,
        case_id=req.case_id,
        requested_by_user_id=req.requested_by_user_id,
        requested_from_client_id=req.requested_from_client_id,
        dependant_id=req.dependant_id,
        title=req.title,
        description=req.description,
        category=req.category,
        rationale=req.rationale,
        statutory_requirement_code=req.statutory_requirement_code,
        accepted_formats=req.accepted_formats,
        acceptable_alternatives=req.acceptable_alternatives,
        due_date=req.due_date,
        instructions=req.instructions,
        translation_guidance=req.translation_guidance,
        status=req.status,
        fulfilled_document_id=req.fulfilled_document_id,
        rejection_reason=req.rejection_reason,
        status_history=req.status_history,
        created_at=req.created_at,
        updated_at=req.updated_at,
        comments_count=len(req.comments),
    )


@router.patch("/{request_id}/review", response_model=DocumentRequestResponse)
def review_document_request(
    request_id: uuid.UUID,
    payload: DocumentRequestReviewRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Staff reviews submitted evidence and marks it 'approved' or 'rejected'.
    Rejection requires a structured reason to guide client replacement.
    """
    if ctx.is_retained_client():
        raise PermissionDeniedError("Clients cannot adjudicate document requests")

    req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not req:
        raise EntityNotFoundError("DocumentRequest", request_id)

    ctx.assert_organization_access(req.organization_id)

    decision_clean = payload.decision.lower().strip()
    if decision_clean not in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be 'approved' or 'rejected'",
        )

    if decision_clean == "rejected" and not payload.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is mandatory when rejecting evidence",
        )

    now = datetime.now(timezone.utc)
    req.status = decision_clean
    req.rejection_reason = payload.rejection_reason if decision_clean == "rejected" else None
    req.updated_at = now

    history = list(req.status_history)
    history.append({
        "status": decision_clean,
        "changed_by": str(ctx.user_id),
        "timestamp": now.isoformat(),
        "notes": payload.review_notes or f"Staff review decision: {decision_clean}",
        "rejection_reason": payload.rejection_reason if decision_clean == "rejected" else None,
    })
    req.status_history = history

    db.commit()
    db.refresh(req)

    # Notify client
    client = db.query(ClientProfile).filter(ClientProfile.id == req.requested_from_client_id).first()
    if client and client.user_id:
        if decision_clean == "approved":
            NotificationService.create_notification(
                db=db,
                organization_id=ctx.organization_id,
                user_id=client.user_id,
                title="Evidence Accepted",
                body=f"Your submitted evidence for '{req.title}' has been reviewed and approved.",
                notification_type="case_status_change",
                channel="in_app",
                metadata={"request_id": str(req.id)},
            )
        else:
            NotificationService.create_notification(
                db=db,
                organization_id=ctx.organization_id,
                user_id=client.user_id,
                title="Evidence Resubmission Requested",
                body=f"Your submitted evidence for '{req.title}' was rejected. Please review feedback and replace document.",
                notification_type="new_request",
                channel="in_app",
                metadata={"request_id": str(req.id), "reason": payload.rejection_reason},
            )

    return DocumentRequestResponse(
        id=req.id,
        organization_id=req.organization_id,
        case_id=req.case_id,
        requested_by_user_id=req.requested_by_user_id,
        requested_from_client_id=req.requested_from_client_id,
        dependant_id=req.dependant_id,
        title=req.title,
        description=req.description,
        category=req.category,
        rationale=req.rationale,
        statutory_requirement_code=req.statutory_requirement_code,
        accepted_formats=req.accepted_formats,
        acceptable_alternatives=req.acceptable_alternatives,
        due_date=req.due_date,
        instructions=req.instructions,
        translation_guidance=req.translation_guidance,
        status=req.status,
        fulfilled_document_id=req.fulfilled_document_id,
        rejection_reason=req.rejection_reason,
        status_history=req.status_history,
        created_at=req.created_at,
        updated_at=req.updated_at,
        comments_count=len(req.comments),
    )


@router.post("/{request_id}/replace", response_model=DocumentRequestResponse)
def replace_rejected_document(
    request_id: uuid.UUID,
    payload: DocumentRequestReplaceRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Client replaces a rejected or unreadable document with a corrected version.
    """
    req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not req:
        raise EntityNotFoundError("DocumentRequest", request_id)

    ctx.assert_organization_access(req.organization_id)

    if ctx.is_retained_client():
        client = _resolve_client_profile_for_user(db, ctx.organization_id, ctx.user_id)
        if not client or req.requested_from_client_id != client.id:
            raise PermissionDeniedError("Cannot replace documents on another client's request")

    doc = db.query(Document).filter(Document.id == payload.replacement_document_id).first()
    if not doc:
        raise EntityNotFoundError("Document", payload.replacement_document_id)

    now = datetime.now(timezone.utc)
    old_doc_id = str(req.fulfilled_document_id) if req.fulfilled_document_id else "none"
    req.fulfilled_document_id = doc.id
    req.status = "submitted"
    req.rejection_reason = None
    req.updated_at = now

    history = list(req.status_history)
    history.append({
        "status": "submitted",
        "changed_by": str(ctx.user_id),
        "timestamp": now.isoformat(),
        "notes": f"Replaced previous document ({old_doc_id}) with new upload: {doc.title}. {payload.explanation or ''}",
        "replacement_document_id": str(doc.id),
    })
    req.status_history = history

    db.commit()
    db.refresh(req)

    # Notify staff
    if req.requested_by_user_id:
        NotificationService.create_notification(
            db=db,
            organization_id=ctx.organization_id,
            user_id=req.requested_by_user_id,
            title="Replacement Evidence Submitted",
            body=f"Client submitted replacement document for: {req.title}.",
            notification_type="review_request",
            channel="in_app",
            metadata={"request_id": str(req.id)},
        )

    return DocumentRequestResponse(
        id=req.id,
        organization_id=req.organization_id,
        case_id=req.case_id,
        requested_by_user_id=req.requested_by_user_id,
        requested_from_client_id=req.requested_from_client_id,
        dependant_id=req.dependant_id,
        title=req.title,
        description=req.description,
        category=req.category,
        rationale=req.rationale,
        statutory_requirement_code=req.statutory_requirement_code,
        accepted_formats=req.accepted_formats,
        acceptable_alternatives=req.acceptable_alternatives,
        due_date=req.due_date,
        instructions=req.instructions,
        translation_guidance=req.translation_guidance,
        status=req.status,
        fulfilled_document_id=req.fulfilled_document_id,
        rejection_reason=req.rejection_reason,
        status_history=req.status_history,
        created_at=req.created_at,
        updated_at=req.updated_at,
        comments_count=len(req.comments),
    )


@router.post("/{request_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def add_request_comment(
    request_id: uuid.UUID,
    payload: CommentCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Adds a question or response comment directly to the document request.
    Clients can only submit client-visible comments (is_internal is forced to False).
    """
    req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not req:
        raise EntityNotFoundError("DocumentRequest", request_id)

    ctx.assert_organization_access(req.organization_id)

    is_internal = payload.is_internal
    if ctx.is_retained_client():
        client = _resolve_client_profile_for_user(db, ctx.organization_id, ctx.user_id)
        if not client or req.requested_from_client_id != client.id:
            raise PermissionDeniedError("Cannot comment on another client's request")
        is_internal = False  # Clients cannot create internal notes

    user = db.query(User).filter(User.id == ctx.user_id).first()
    author_name = user.full_name if user else "Authenticated User"

    now = datetime.now(timezone.utc)
    comment = DocumentRequestComment(
        organization_id=ctx.organization_id,
        request_id=req.id,
        user_id=ctx.user_id,
        content=payload.content,
        is_internal=is_internal,
        created_at=now,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        request_id=comment.request_id,
        user_id=comment.user_id,
        author_name=author_name,
        content=comment.content,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
    )


@router.get("/{request_id}/comments", response_model=list[CommentResponse])
def list_request_comments(
    request_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Lists comments on a request.
    CRITICAL SECURITY RULE: Clients can NEVER see internal comments.
    """
    req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not req:
        raise EntityNotFoundError("DocumentRequest", request_id)

    ctx.assert_organization_access(req.organization_id)

    if ctx.is_retained_client():
        client = _resolve_client_profile_for_user(db, ctx.organization_id, ctx.user_id)
        if not client or req.requested_from_client_id != client.id:
            raise PermissionDeniedError("Cannot view comments on another client's request")

    query = db.query(DocumentRequestComment).filter(DocumentRequestComment.request_id == req.id)
    if ctx.is_retained_client():
        query = query.filter(DocumentRequestComment.is_internal == False)

    comments = query.order_by(DocumentRequestComment.created_at.asc()).all()

    return [
        CommentResponse(
            id=c.id,
            request_id=c.request_id,
            user_id=c.user_id,
            author_name=c.user.full_name if c.user else "User",
            content=c.content,
            is_internal=c.is_internal,
            created_at=c.created_at,
        )
        for c in comments
    ]


# ---------------------------------------------------------------------------
# Phase 10 AI-Assisted Request Drafting & Staff Review Approval
# ---------------------------------------------------------------------------

@router.get("/templates")
def list_approved_request_templates(
    ctx: AuthContext = Depends(get_auth_context),
):
    """Returns all pre-approved firm client request templates."""
    from backend.app.ai.client_request_drafter import get_approved_request_templates
    return get_approved_request_templates()


@router.post("/draft-from-template", response_model=DocumentRequestResponse)
def draft_request_from_template_endpoint(
    payload: DraftRequestIn,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Drafts a client document request using a pre-approved regulatory template.
    Strictly enters 'draft' status requiring staff review before transmission.
    """
    if ctx.is_retained_client():
        raise PermissionDeniedError("Clients cannot draft document requests.")

    from backend.app.ai.client_request_drafter import draft_client_request_from_template

    doc_req = draft_client_request_from_template(
        db=db,
        case_id=payload.case_id,
        template_code=payload.template_code,
        finding_id=payload.finding_id,
        custom_instructions=payload.custom_instructions,
        custom_due_date=payload.due_date,
        actor_id=ctx.user_id,
        organization_id=ctx.organization_id,
    )

    return DocumentRequestResponse(
        id=doc_req.id,
        organization_id=doc_req.organization_id,
        case_id=doc_req.case_id,
        requested_by_user_id=doc_req.requested_by_user_id,
        requested_from_client_id=doc_req.requested_from_client_id,
        dependant_id=doc_req.dependant_id,
        title=doc_req.title,
        description=doc_req.description,
        category=doc_req.category,
        rationale=doc_req.rationale,
        statutory_requirement_code=doc_req.statutory_requirement_code,
        accepted_formats=doc_req.accepted_formats,
        acceptable_alternatives=doc_req.acceptable_alternatives,
        due_date=doc_req.due_date,
        instructions=doc_req.instructions,
        translation_guidance=doc_req.translation_guidance,
        status=doc_req.status,
        fulfilled_document_id=doc_req.fulfilled_document_id,
        rejection_reason=doc_req.rejection_reason,
        status_history=doc_req.status_history,
        created_at=doc_req.created_at,
        updated_at=doc_req.updated_at,
        comments_count=0,
    )


@router.post("/{request_id}/approve-and-send", response_model=DocumentRequestResponse)
def approve_and_send_draft_request_endpoint(
    request_id: uuid.UUID,
    payload: ApproveDraftRequestIn | None = None,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Staff reviews, optionally edits, and explicitly approves an AI draft request for dispatch.
    Transitions status from 'draft' -> 'requested' and notifies the client portal.
    """
    if ctx.is_retained_client():
        raise PermissionDeniedError("Clients cannot approve or send document requests.")

    from backend.app.ai.client_request_drafter import review_and_send_client_request

    doc_req = review_and_send_client_request(
        db=db,
        request_id=request_id,
        reviewer_id=ctx.user_id,
        organization_id=ctx.organization_id,
        title_override=payload.title_override if payload else None,
        description_override=payload.description_override if payload else None,
        instructions_override=payload.instructions_override if payload else None,
        due_date_override=payload.due_date_override if payload else None,
        review_notes=payload.review_notes if payload else None,
    )

    return DocumentRequestResponse(
        id=doc_req.id,
        organization_id=doc_req.organization_id,
        case_id=doc_req.case_id,
        requested_by_user_id=doc_req.requested_by_user_id,
        requested_from_client_id=doc_req.requested_from_client_id,
        dependant_id=doc_req.dependant_id,
        title=doc_req.title,
        description=doc_req.description,
        category=doc_req.category,
        rationale=doc_req.rationale,
        statutory_requirement_code=doc_req.statutory_requirement_code,
        accepted_formats=doc_req.accepted_formats,
        acceptable_alternatives=doc_req.acceptable_alternatives,
        due_date=doc_req.due_date,
        instructions=doc_req.instructions,
        translation_guidance=doc_req.translation_guidance,
        status=doc_req.status,
        fulfilled_document_id=doc_req.fulfilled_document_id,
        rejection_reason=doc_req.rejection_reason,
        status_history=doc_req.status_history,
        created_at=doc_req.created_at,
        updated_at=doc_req.updated_at,
        comments_count=len(doc_req.comments) if doc_req.comments else 0,
    )
