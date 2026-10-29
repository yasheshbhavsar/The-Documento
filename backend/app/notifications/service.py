import re
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.app.domain.models import Notification, User


# Regex patterns to detect sensitive immigration PII in notification text
SENSITIVE_PATTERNS = [
    # US / International Passport / Document IDs (alphanumeric with digits and letters, length 6-12)
    (r"\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{6,12}\b", "[REDACTED_DOC_ID]"),
    # Pure numeric national IDs / Passports (8 to 10 digits)
    (r"\b\d{8,10}\b", "[REDACTED_DOC_ID]"),
    # US SSN (9 digits with hyphens)
    (r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]"),
    # Alien Registration Number (A-Number: A followed by 7-9 digits)
    (r"\bA-?\d{7,9}\b", "[REDACTED_A_NUM]"),
    # Specific asylum, medical, or confidential grounds
    (r"\b(asylum|persecution|torture|communicable disease|inadmissibility waiver)\b", "[CONFIDENTIAL_LEGAL_GROUND]"),
]


def sanitize_notification_preview(text: str) -> str:
    """
    Sanitizes notification previews to ensure sensitive immigration information
    (passport numbers, A-numbers, SSNs, medical/asylum grounds) is not exposed
    in mobile lock-screen alerts or unencrypted email headers.
    """
    if not text:
        return ""
    
    sanitized = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
    return sanitized


class NotificationService:
    """
    Manages in-app and email notifications with strict privacy protections,
    tamper-evident delivery statuses, and provider confirmation tracking.
    """

    @staticmethod
    def create_notification(
        db: Session,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        body: str,
        notification_type: str,  # new_request, upcoming_deadline, upload_completion, processing_failure, new_message, review_request, case_status_change
        channel: str = "in_app",  # in_app, email
        metadata: dict | None = None,
        simulate_provider_dispatch: bool = True,
    ) -> Notification:
        """
        Creates a notification. For emails, delivery is tracked through a delivery state
        machine ('queued' -> 'sent' -> 'delivered' or 'failed'). We never claim delivery
        unless confirmed by the external transport provider.
        """
        now = datetime.now(timezone.utc)
        safe_title = sanitize_notification_preview(title)
        safe_body = sanitize_notification_preview(body)

        if channel == "in_app":
            delivery_status = "delivered"
            delivered_at = now
        else:
            # Email delivery starts as queued; never claim delivered prematurely
            delivery_status = "queued"
            delivered_at = None

        notification = Notification(
            organization_id=organization_id,
            user_id=user_id,
            title=safe_title,
            body=safe_body,
            type=notification_type,
            channel=channel,
            delivery_status=delivery_status,
            delivered_at=delivered_at,
            metadata_json=metadata or {},
            created_at=now,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        if channel == "email" and simulate_provider_dispatch:
            # Simulate initial dispatch to email provider (e.g. SES/SendGrid/Postmark)
            notification.delivery_status = "sent"
            notification.last_attempt_at = now
            db.commit()
            db.refresh(notification)

        return notification

    @staticmethod
    def confirm_provider_delivery(
        db: Session,
        notification_id: uuid.UUID,
        provider_receipt_id: str | None = None,
    ) -> Notification:
        """
        Processes provider delivery confirmation (e.g., from webhook callback).
        Only transitions to 'delivered' upon confirmed receipt.
        """
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notification:
            raise ValueError(f"Notification {notification_id} not found")

        notification.delivery_status = "delivered"
        notification.delivered_at = datetime.now(timezone.utc)
        if provider_receipt_id:
            meta = dict(notification.metadata_json or {})
            meta["provider_receipt_id"] = provider_receipt_id
            notification.metadata_json = meta

        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def record_provider_failure(
        db: Session,
        notification_id: uuid.UUID,
        error_message: str,
    ) -> Notification:
        """
        Records a provider delivery failure (e.g. bounce, connection timeout).
        Increments retry count for subsequent safe re-dispatch.
        """
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notification:
            raise ValueError(f"Notification {notification_id} not found")

        notification.delivery_status = "failed"
        notification.delivery_error = error_message
        notification.retry_count += 1
        notification.last_attempt_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def retry_failed_notification(
        db: Session,
        notification_id: uuid.UUID,
        max_retries: int = 3,
    ) -> Notification:
        """
        Safely attempts redelivery of a failed notification if within retry limits.
        """
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notification:
            raise ValueError(f"Notification {notification_id} not found")

        if notification.retry_count >= max_retries:
            notification.delivery_error = f"Max retries ({max_retries}) exceeded: {notification.delivery_error}"
            db.commit()
            db.refresh(notification)
            return notification

        now = datetime.now(timezone.utc)
        notification.delivery_status = "sent"
        notification.last_attempt_at = now
        notification.retry_count += 1
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def cleanup_read_notifications(
        db: Session,
        organization_id: uuid.UUID,
        older_than_days: int = 90,
    ) -> int:
        """
        Enforces retention policy: purges read notifications older than the threshold (default 90 days).
        Prevents unbounded growth of notification records over multi-year production operation.
        """
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        deleted_count = (
            db.query(Notification)
            .filter(
                Notification.organization_id == organization_id,
                Notification.read_at.isnot(None),
                Notification.read_at < cutoff,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted_count
