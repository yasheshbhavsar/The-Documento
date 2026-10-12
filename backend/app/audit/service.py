from uuid import UUID
from sqlalchemy.orm import Session
from backend.app.domain.models import AuditEvent

def record_event(db: Session, *, organization_id: UUID, actor_id: UUID | None, action: str,
                 object_type: str, object_id: str, metadata: dict | None = None,
                 before_hash: str | None = None, after_hash: str | None = None) -> AuditEvent:
    event = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        action=action,
        object_type=object_type,
        object_id=object_id,
        metadata_json=metadata or {},
        before_hash=before_hash,
        after_hash=after_hash,
    )
    db.add(event)
    return event
