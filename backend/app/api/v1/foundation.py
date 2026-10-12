import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.models import AuditEvent
from backend.app.audit.service import record_event
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.rbac import ROLE_PERMISSIONS
from backend.app.documents.storage import get_storage_backend

router = APIRouter(prefix="/foundation", tags=["foundation"])


class CurrentUserResponse(BaseModel):
    user_id: uuid.UUID
    organization_id: uuid.UUID
    subject: str
    roles: list[str]
    permissions: list[str]
    experience: str  # "master_admin" | "case_manager" | "client_applicant"


class AuditEventCreate(BaseModel):
    action: str = Field(..., max_length=100)
    object_type: str = Field(..., max_length=100)
    object_id: str = Field(..., max_length=255)
    metadata: dict = Field(default_factory=dict)
    before_hash: str | None = None
    after_hash: str | None = None


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    object_type: str
    object_id: str
    metadata_json: dict
    before_hash: str | None
    after_hash: str | None
    occurred_at: datetime


@router.get("/roles")
def roles() -> dict[str, list[str]]:
    return {role.value: sorted(perms) for role, perms in ROLE_PERMISSIONS.items()}


@router.get("/me", response_model=CurrentUserResponse)
def get_me(ctx: AuthContext = Depends(get_auth_context)):
    experience = "case_manager"
    if ctx.is_org_admin():
        experience = "master_admin"
    elif ctx.is_applicant():
        experience = "client_applicant"

    return CurrentUserResponse(
        user_id=ctx.user_id,
        organization_id=ctx.organization_id,
        subject=ctx.subject,
        roles=[r if isinstance(r, str) else r.value for r in ctx.roles],
        permissions=sorted(list(ctx.permissions)),
        experience=experience,
    )


@router.get("/audit-events", response_model=list[AuditEventResponse])
def list_audit_events(
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("audit:read")),
):
    """Lists audit events strictly constrained by the caller's organization boundary."""
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.organization_id == ctx.organization_id)
        .order_by(AuditEvent.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AuditEventResponse(
            id=e.id,
            organization_id=e.organization_id,
            actor_id=e.actor_id,
            action=e.action,
            object_type=e.object_type,
            object_id=e.object_id,
            metadata_json=e.metadata_json or {},
            before_hash=e.before_hash,
            after_hash=e.after_hash,
            occurred_at=e.occurred_at,
        )
        for e in events
    ]


@router.post("/audit-events", response_model=AuditEventResponse, status_code=status.HTTP_201_CREATED)
def create_audit_event(
    payload: AuditEventCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Records an audit event strictly attributed to the caller's organization and actor ID."""
    event = record_event(
        db,
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action=payload.action,
        object_type=payload.object_type,
        object_id=payload.object_id,
        metadata=payload.metadata,
        before_hash=payload.before_hash,
        after_hash=payload.after_hash,
    )
    db.commit()
    db.refresh(event)
    return AuditEventResponse(
        id=event.id,
        organization_id=event.organization_id,
        actor_id=event.actor_id,
        action=event.action,
        object_type=event.object_type,
        object_id=event.object_id,
        metadata_json=event.metadata_json or {},
        before_hash=event.before_hash,
        after_hash=event.after_hash,
        occurred_at=event.occurred_at,
    )


@router.get("/storage/status")
def storage_status(ctx: AuthContext = Depends(get_auth_context)):
    """Returns storage service status and isolation boundary."""
    storage = get_storage_backend()
    return {
        "backend_class": storage.__class__.__name__,
        "organization_id": str(ctx.organization_id),
        "status": "active",
        "immutable_originals": True,
    }
