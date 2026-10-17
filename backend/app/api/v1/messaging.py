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
    ImmigrationCase,
    Message,
    MessageThread,
    User,
)
from backend.app.notifications.service import NotificationService
from backend.app.security.auth import AuthContext, get_auth_context

router = APIRouter(prefix="/messaging", tags=["messaging"])


# --- Schemas ---

class ThreadCreateRequest(BaseModel):
    case_id: uuid.UUID
    subject: str = Field(..., min_length=2, max_length=255)
    thread_type: str = Field(default="general", max_length=64, description="client_inquiry, case_update, document_request, general, team_chat")
    channel_category: str = Field(default="client", max_length=32, description="'client' for client-facing, 'team' for staff-only")
    initial_message: str | None = None
    is_internal: bool = Field(default=False, description="Staff-only internal note thread")
    attachment_document_ids: list[uuid.UUID] = Field(default_factory=list)


class ThreadResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    case_id: uuid.UUID
    case_number: str
    subject: str
    thread_type: str
    channel_category: str = "client"
    is_internal: bool = False
    status: str
    created_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    messages_count: int = 0
    unread_count: int = 0
    last_message_preview: str | None = None


class MessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)
    is_internal: bool = Field(default=False, description="Whether this is a staff-only internal note")
    attachment_document_ids: list[uuid.UUID] = Field(default_factory=list)


class MessageResponse(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    sender_role: str
    content: str
    is_internal: bool
    attachment_document_ids: list[str]
    delivery_status: str
    read_at: datetime | None
    delivered_at: datetime | None
    created_at: datetime


class DeliveryWebhookRequest(BaseModel):
    delivery_status: str = Field(..., description="'delivered' or 'failed'")
    error_message: str | None = None


class ManagerConversationOverviewItem(BaseModel):
    thread_id: uuid.UUID
    case_id: uuid.UUID
    case_number: str
    client_name: str
    assigned_officer_name: str
    subject: str
    channel_category: str
    is_internal: bool
    status: str
    total_messages_count: int
    unread_count: int
    last_message_preview: str | None
    last_message_at: datetime
    last_sender_role: str | None


# --- Helpers ---

def _assert_user_can_access_thread(
    thread: MessageThread,
    ctx: AuthContext,
    db: Session,
) -> None:
    ctx.assert_organization_access(thread.organization_id)
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == thread.case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", thread.case_id)
    client_user_id = case.client.user_id if case.client else None
    authorized_deps = [d.user_id for d in case.client.dependants if d.is_authorized_to_view_case and d.user_id] if case.client else []
    assigned_user_ids = [a.user_id for a in case.assignments]
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        authorized_dependant_user_ids=authorized_deps,
        assigned_user_ids=assigned_user_ids,
    )

    # Strict client boundary: Clients can NEVER access internal team chats or staff notes
    is_team_or_internal = (
        thread.is_internal
        or getattr(thread, "channel_category", "") == "team"
        or thread.thread_type in ("team", "team_chat", "internal", "staff_only")
    )
    if ctx.is_retained_client() and is_team_or_internal:
        raise PermissionDeniedError("Client access denied: Internal team chats and staff notes are strictly confidential")


# --- Endpoints ---

@router.post("/threads", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: ThreadCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Creates a new case-linked message thread with an optional initial message.
    """
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

    # Clients can NEVER initiate internal team chats or staff notes
    if ctx.is_retained_client() and (payload.channel_category == "team" or payload.is_internal or payload.thread_type in ("team", "team_chat", "internal")):
        raise PermissionDeniedError("Clients cannot create internal team chats or staff-only notes")

    channel_category = "client" if ctx.is_retained_client() else payload.channel_category
    is_internal = False if ctx.is_retained_client() else (payload.is_internal or payload.channel_category == "team")

    now = datetime.now(timezone.utc)
    thread = MessageThread(
        organization_id=ctx.organization_id,
        case_id=payload.case_id,
        subject=payload.subject,
        thread_type=payload.thread_type,
        channel_category=channel_category,
        is_internal=is_internal,
        status="open",
        created_by_user_id=ctx.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.flush()

    last_preview = None
    if payload.initial_message:
        msg = Message(
            organization_id=ctx.organization_id,
            thread_id=thread.id,
            sender_id=ctx.user_id,
            content=payload.initial_message,
            is_internal=is_internal,
            attachment_document_ids=[str(doc_id) for doc_id in payload.attachment_document_ids],
            delivery_status="delivered",
            delivered_at=now,
            created_at=now,
        )
        db.add(msg)
        last_preview = payload.initial_message[:100]

    # Privacy-preserving audit logging: never copy sensitive message contents to audit trail
    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="messaging.thread_created",
        object_type="message_thread",
        object_id=str(thread.id),
        metadata_json={
            "case_id": str(thread.case_id),
            "thread_type": thread.thread_type,
            "channel_category": thread.channel_category,
            "is_internal": thread.is_internal,
            "has_initial_message": bool(payload.initial_message),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(thread)

    return ThreadResponse(
        id=thread.id,
        organization_id=thread.organization_id,
        case_id=thread.case_id,
        case_number=case.case_number,
        subject=thread.subject,
        thread_type=thread.thread_type,
        channel_category=thread.channel_category,
        is_internal=thread.is_internal,
        status=thread.status,
        created_by_user_id=thread.created_by_user_id,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        messages_count=1 if payload.initial_message else 0,
        unread_count=0,
        last_message_preview=last_preview,
    )


@router.get("/threads", response_model=list[ThreadResponse])
def list_threads(
    case_id: uuid.UUID | None = Query(default=None),
    thread_type: str | None = Query(default=None),
    channel_category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Lists message threads permitted for the user.
    Retained clients can only list client-facing threads for cases they own.
    Team chats and staff-only notes are strictly excluded for clients.
    """
    query = db.query(MessageThread).filter(MessageThread.organization_id == ctx.organization_id)

    if ctx.is_retained_client():
        # Strictly exclude internal team chats
        query = query.filter(
            MessageThread.is_internal == False,
            MessageThread.channel_category != "team",
            ~MessageThread.thread_type.in_(["team", "team_chat", "internal", "staff_only"]),
        )

    if case_id:
        query = query.filter(MessageThread.case_id == case_id)
    if thread_type:
        query = query.filter(MessageThread.thread_type == thread_type)
    if channel_category:
        query = query.filter(MessageThread.channel_category == channel_category)
    if status_filter:
        query = query.filter(MessageThread.status == status_filter)
    if search:
        query = query.filter(MessageThread.subject.ilike(f"%{search}%"))

    threads = query.order_by(MessageThread.updated_at.desc()).all()
    results: list[ThreadResponse] = []

    for t in threads:
        case = db.query(ImmigrationCase).filter(ImmigrationCase.id == t.case_id).first()
        if not case:
            continue

        client_user_id = case.client.user_id if case.client else None
        authorized_deps = [d.user_id for d in case.client.dependants if d.is_authorized_to_view_case and d.user_id] if case.client else []
        assigned_user_ids = [a.user_id for a in case.assignments]
        try:
            ctx.assert_case_access(
                case,
                client_user_id=client_user_id,
                authorized_dependant_user_ids=authorized_deps,
                assigned_user_ids=assigned_user_ids,
            )
        except PermissionDeniedError:
            continue

        # Check messages for this user (filtering out internal messages if client)
        msg_query = db.query(Message).filter(Message.thread_id == t.id)
        if ctx.is_retained_client():
            msg_query = msg_query.filter(Message.is_internal == False)

        all_msgs = msg_query.order_by(Message.created_at.asc()).all()
        last_msg = all_msgs[-1] if all_msgs else None
        unread = sum(1 for m in all_msgs if m.sender_id != ctx.user_id and m.read_at is None)

        results.append(
            ThreadResponse(
                id=t.id,
                organization_id=t.organization_id,
                case_id=t.case_id,
                case_number=case.case_number,
                subject=t.subject,
                thread_type=t.thread_type,
                channel_category=t.channel_category,
                is_internal=t.is_internal,
                status=t.status,
                created_by_user_id=t.created_by_user_id,
                created_at=t.created_at,
                updated_at=t.updated_at,
                messages_count=len(all_msgs),
                unread_count=unread,
                last_message_preview=last_msg.content[:80] if last_msg else None,
            )
        )

    return results


@router.get("/threads/{thread_id}/messages", response_model=list[MessageResponse])
def get_thread_messages(
    thread_id: uuid.UUID,
    search: str | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Retrieves all messages in a thread.
    CRITICAL SECURITY RULE: Clients can NEVER see internal staff notes (is_internal == True).
    """
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).first()
    if not thread:
        raise EntityNotFoundError("MessageThread", thread_id)

    _assert_user_can_access_thread(thread, ctx, db)

    query = db.query(Message).filter(Message.thread_id == thread.id)
    if ctx.is_retained_client():
        query = query.filter(Message.is_internal == False)

    if search:
        query = query.filter(Message.content.ilike(f"%{search}%"))

    messages = query.order_by(Message.created_at.asc()).all()

    response: list[MessageResponse] = []
    for m in messages:
        sender_role = "lawyer"
        if m.sender_id == ctx.user_id and ctx.is_retained_client():
            sender_role = "client"
        elif m.sender and hasattr(m.sender, "client_profile") and m.sender.client_profile:
            sender_role = "client"

        response.append(
            MessageResponse(
                id=m.id,
                thread_id=m.thread_id,
                sender_id=m.sender_id,
                sender_name=m.sender.full_name if m.sender else "Staff",
                sender_role=sender_role,
                content=m.content,
                is_internal=m.is_internal,
                attachment_document_ids=m.attachment_document_ids or [],
                delivery_status=m.delivery_status,
                read_at=m.read_at,
                delivered_at=m.delivered_at,
                created_at=m.created_at,
            )
        )

    return response


@router.post("/threads/{thread_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def post_message(
    thread_id: uuid.UUID,
    payload: MessageCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Posts a message to a thread.
    Staff can mark message as is_internal = True (staff-only note).
    Clients cannot create internal notes (strictly forced to False).
    """
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).first()
    if not thread:
        raise EntityNotFoundError("MessageThread", thread_id)

    _assert_user_can_access_thread(thread, ctx, db)

    is_internal = payload.is_internal
    if ctx.is_retained_client():
        is_internal = False  # Strict security rule

    now = datetime.now(timezone.utc)
    message = Message(
        organization_id=ctx.organization_id,
        thread_id=thread.id,
        sender_id=ctx.user_id,
        content=payload.content,
        is_internal=is_internal,
        attachment_document_ids=[str(d) for d in payload.attachment_document_ids],
        delivery_status="delivered",
        delivered_at=now,
        created_at=now,
    )
    db.add(message)

    thread.updated_at = now
    db.commit()
    db.refresh(message)

    # Privacy-preserving audit logging: never copy sensitive message contents to audit trail
    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="messaging.message_sent",
        object_type="message",
        object_id=str(message.id),
        metadata_json={
            "case_id": str(thread.case_id),
            "thread_id": str(thread.id),
            "is_internal": message.is_internal,
            "has_attachments": bool(message.attachment_document_ids),
            "char_count": len(message.content),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()

    # If client message, notify case manager. If staff message and not internal, notify client.
    user = db.query(User).filter(User.id == ctx.user_id).first()
    sender_name = user.full_name if user else "User"

    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == thread.case_id).first()
    if case and not is_internal:
        if ctx.is_retained_client():
            # Notify case staff
            for assign in case.assignments:
                NotificationService.create_notification(
                    db=db,
                    organization_id=ctx.organization_id,
                    user_id=assign.user_id,
                    title="New Client Message",
                    body=f"Message received from {sender_name} in thread: {thread.subject}",
                    notification_type="new_message",
                    channel="in_app",
                    metadata={"thread_id": str(thread.id), "case_id": str(case.id)},
                )
        else:
            # Notify client
            if case.client and case.client.user_id:
                NotificationService.create_notification(
                    db=db,
                    organization_id=ctx.organization_id,
                    user_id=case.client.user_id,
                    title="New Legal Team Message",
                    body=f"New confidential message received regarding petition {case.case_number}.",
                    notification_type="new_message",
                    channel="in_app",
                    metadata={"thread_id": str(thread.id), "case_id": str(case.id)},
                )

    sender_role = "client" if ctx.is_retained_client() else "lawyer"

    return MessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_id=message.sender_id,
        sender_name=sender_name,
        sender_role=sender_role,
        content=message.content,
        is_internal=message.is_internal,
        attachment_document_ids=message.attachment_document_ids or [],
        delivery_status=message.delivery_status,
        read_at=message.read_at,
        delivered_at=message.delivered_at,
        created_at=message.created_at,
    )


@router.patch("/messages/{message_id}/read", response_model=MessageResponse)
def mark_message_read(
    message_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Marks a message as read with the current timestamp.
    """
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise EntityNotFoundError("Message", message_id)

    ctx.assert_organization_access(message.organization_id)
    thread = db.query(MessageThread).filter(MessageThread.id == message.thread_id).first()
    if thread:
        _assert_user_can_access_thread(thread, ctx, db)

    if not message.read_at and message.sender_id != ctx.user_id:
        message.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(message)

    sender_role = "client" if (message.sender and hasattr(message.sender, "client_profile") and message.sender.client_profile) else "lawyer"

    return MessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_id=message.sender_id,
        sender_name=message.sender.full_name if message.sender else "User",
        sender_role=sender_role,
        content=message.content,
        is_internal=message.is_internal,
        attachment_document_ids=message.attachment_document_ids or [],
        delivery_status=message.delivery_status,
        read_at=message.read_at,
        delivered_at=message.delivered_at,
        created_at=message.created_at,
    )


@router.post("/messages/{message_id}/delivery-webhook")
def delivery_webhook(
    message_id: uuid.UUID,
    payload: DeliveryWebhookRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Provider delivery status webhook. Only marks 'delivered' or 'failed' upon receipt confirmation.
    """
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise EntityNotFoundError("Message", message_id)

    ctx.assert_organization_access(message.organization_id)

    status_clean = payload.delivery_status.lower().strip()
    if status_clean not in ("delivered", "failed"):
        raise HTTPException(status_code=400, detail="Invalid delivery status")

    message.delivery_status = status_clean
    if status_clean == "delivered":
        message.delivered_at = datetime.now(timezone.utc)

    db.commit()
    return {"status": "ok", "message_id": str(message.id), "delivery_status": message.delivery_status}


@router.get("/manager-overview", response_model=list[ManagerConversationOverviewItem])
def get_manager_conversation_overview(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Manager/Owner workspace view of all officer-client conversations across the firm.
    Enforces that managers/owners have global review oversight to support continuous quality,
    while caseworkers and clients are strictly forbidden from viewing unauthorized threads.
    """
    if ctx.is_retained_client():
        raise PermissionDeniedError("Clients are strictly forbidden from management conversation audit queues.")

    is_firm_manager = (
        ctx.is_org_admin()
        or ctx.is_senior_reviewer()
        or ctx.is_case_manager()
        or ctx.has_permission("case:read:all")
    )
    if not is_firm_manager:
        raise PermissionDeniedError("Restricted to case managers, senior partners, and firm administrators.")

    threads = (
        db.query(MessageThread)
        .filter(MessageThread.organization_id == ctx.organization_id)
        .order_by(MessageThread.updated_at.desc())
        .all()
    )

    results: list[ManagerConversationOverviewItem] = []
    for t in threads:
        case = db.query(ImmigrationCase).filter(ImmigrationCase.id == t.case_id).first()
        if not case:
            continue

        assigned_officer = "Unassigned"
        if case.assignments:
            officer_user = case.assignments[0].user
            if officer_user:
                assigned_officer = officer_user.full_name

        all_msgs = (
            db.query(Message)
            .filter(Message.thread_id == t.id)
            .order_by(Message.created_at.asc())
            .all()
        )
        last_msg = all_msgs[-1] if all_msgs else None
        unread = sum(1 for m in all_msgs if m.read_at is None)

        last_sender_role = None
        if last_msg:
            sender = db.query(User).filter(User.id == last_msg.sender_id).first()
            if sender:
                client = db.query(ClientProfile).filter(ClientProfile.user_id == sender.id).first()
                last_sender_role = "client" if client else "officer"

        results.append(
            ManagerConversationOverviewItem(
                thread_id=t.id,
                case_id=t.case_id,
                case_number=case.case_number,
                client_name=f"{case.client.first_name} {case.client.last_name}" if case.client else "Client",
                assigned_officer_name=assigned_officer,
                subject=t.subject,
                channel_category=t.channel_category or "client",
                is_internal=t.is_internal,
                status=t.status,
                total_messages_count=len(all_msgs),
                unread_count=unread,
                last_message_preview=last_msg.content[:120] if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else t.updated_at,
                last_sender_role=last_sender_role,
            )
        )

    return results


@router.put("/messages/{message_id}")
@router.patch("/messages/{message_id}")
@router.delete("/messages/{message_id}")
def edit_or_delete_message(
    message_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
):
    """
    Client messages are strictly immutable after send/receive.
    Mistakes must be corrected by sending a new message.
    """
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Client messages are strictly immutable after send/receive. Send a new message to correct mistakes.",
    )

