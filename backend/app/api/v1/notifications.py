import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.errors import EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.models import Notification
from backend.app.notifications.service import NotificationService
from backend.app.security.auth import AuthContext, get_auth_context, require_permission

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str
    type: str
    read_at: datetime | None
    channel: str
    delivery_status: str
    retry_count: int
    delivered_at: datetime | None
    delivery_error: str | None
    created_at: datetime


class NotificationCreateRequest(BaseModel):
    user_id: uuid.UUID
    title: str = Field(..., min_length=2, max_length=200)
    body: str = Field(..., min_length=2)
    type: str = Field(default="info", max_length=50)
    channel: str = Field(default="in_app", max_length=32)


class DeliveryWebhookRequest(BaseModel):
    delivery_status: str = Field(..., description="'delivered' or 'failed'")
    provider_receipt_id: str | None = None
    error_message: str | None = None


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    channel: str | None = Query(default=None),
    delivery_status: str | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists notifications strictly for the authenticated user and organization."""
    query = (
        db.query(Notification)
        .filter(
            Notification.organization_id == ctx.organization_id,
            Notification.user_id == ctx.user_id,
        )
    )
    if channel:
        query = query.filter(Notification.channel == channel)
    if delivery_status:
        query = query.filter(Notification.delivery_status == delivery_status)

    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()

    return [
        NotificationResponse(
            id=n.id,
            organization_id=n.organization_id,
            user_id=n.user_id,
            title=n.title,
            body=n.body,
            type=n.type,
            read_at=n.read_at,
            channel=n.channel or "in_app",
            delivery_status=n.delivery_status or "delivered",
            retry_count=n.retry_count or 0,
            delivered_at=n.delivered_at,
            delivery_error=n.delivery_error,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Marks a notification as read, enforcing strict user ownership."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise EntityNotFoundError("Notification", notification_id)

    ctx.assert_organization_access(notification.organization_id)
    if notification.user_id != ctx.user_id:
        raise PermissionDeniedError("Cannot mark another user's notification as read")

    if not notification.read_at:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)

    return NotificationResponse(
        id=notification.id,
        organization_id=notification.organization_id,
        user_id=notification.user_id,
        title=notification.title,
        body=notification.body,
        type=notification.type,
        read_at=notification.read_at,
        channel=notification.channel or "in_app",
        delivery_status=notification.delivery_status or "delivered",
        retry_count=notification.retry_count or 0,
        delivered_at=notification.delivered_at,
        delivery_error=notification.delivery_error,
        created_at=notification.created_at,
    )


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: NotificationCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Creates a notification using NotificationService with sanitized previews."""
    notification = NotificationService.create_notification(
        db=db,
        organization_id=ctx.organization_id,
        user_id=payload.user_id,
        title=payload.title,
        body=payload.body,
        notification_type=payload.type,
        channel=payload.channel,
    )

    return NotificationResponse(
        id=notification.id,
        organization_id=notification.organization_id,
        user_id=notification.user_id,
        title=notification.title,
        body=notification.body,
        type=notification.type,
        read_at=notification.read_at,
        channel=notification.channel or "in_app",
        delivery_status=notification.delivery_status or "delivered",
        retry_count=notification.retry_count or 0,
        delivered_at=notification.delivered_at,
        delivery_error=notification.delivery_error,
        created_at=notification.created_at,
    )


@router.post("/{notification_id}/delivery-webhook", response_model=NotificationResponse)
def delivery_webhook(
    notification_id: uuid.UUID,
    payload: DeliveryWebhookRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Simulates external delivery provider webhook (e.g. SendGrid / AWS SES / Postmark).
    Only transitions to 'delivered' when receipt is positively acknowledged.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise EntityNotFoundError("Notification", notification_id)

    ctx.assert_organization_access(notification.organization_id)

    status_clean = payload.delivery_status.lower().strip()
    if status_clean == "delivered":
        updated = NotificationService.confirm_provider_delivery(
            db=db,
            notification_id=notification_id,
            provider_receipt_id=payload.provider_receipt_id,
        )
    elif status_clean == "failed":
        updated = NotificationService.record_provider_failure(
            db=db,
            notification_id=notification_id,
            error_message=payload.error_message or "Provider rejected dispatch",
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid delivery status. Must be 'delivered' or 'failed'")

    return NotificationResponse(
        id=updated.id,
        organization_id=updated.organization_id,
        user_id=updated.user_id,
        title=updated.title,
        body=updated.body,
        type=updated.type,
        read_at=updated.read_at,
        channel=updated.channel or "in_app",
        delivery_status=updated.delivery_status or "delivered",
        retry_count=updated.retry_count or 0,
        delivered_at=updated.delivered_at,
        delivery_error=updated.delivery_error,
        created_at=updated.created_at,
    )


@router.post("/{notification_id}/retry", response_model=NotificationResponse)
def retry_notification(
    notification_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Safely retries dispatch of a failed notification with exponential retry limit."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise EntityNotFoundError("Notification", notification_id)

    ctx.assert_organization_access(notification.organization_id)
    updated = NotificationService.retry_failed_notification(db=db, notification_id=notification_id)

    return NotificationResponse(
        id=updated.id,
        organization_id=updated.organization_id,
        user_id=updated.user_id,
        title=updated.title,
        body=updated.body,
        type=updated.type,
        read_at=updated.read_at,
        channel=updated.channel or "in_app",
        delivery_status=updated.delivery_status or "delivered",
        retry_count=updated.retry_count or 0,
        delivered_at=updated.delivered_at,
        delivery_error=updated.delivery_error,
        created_at=updated.created_at,
    )


class NotificationCleanupResponse(BaseModel):
    organization_id: uuid.UUID
    cleaned_count: int
    older_than_days: int
    retention_cutoff: datetime


@router.post("/cleanup", response_model=NotificationCleanupResponse)
def cleanup_notifications(
    older_than_days: int = Query(default=90, ge=7, le=365),
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Enforces notification retention policy:
    Archives and purges read notifications older than `older_than_days` (default 90).
    """
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    count = NotificationService.cleanup_read_notifications(
        db=db,
        organization_id=ctx.organization_id,
        older_than_days=older_than_days,
    )
    return NotificationCleanupResponse(
        organization_id=ctx.organization_id,
        cleaned_count=count,
        older_than_days=older_than_days,
        retention_cutoff=cutoff,
    )

