import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.errors import ConflictError, EntityNotFoundError, PermissionDeniedError, TenantIsolationError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    Organization,
    Branch,
    Team,
    User,
    OrganizationMembership,
    MembershipRole,
    Role,
    Invitation,
    AuditEvent,
)
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.rbac import RoleCode, can_assign_permission
from backend.app.security.tokens import generate_secure_random_token, hash_opaque_token

router = APIRouter(prefix="/organizations", tags=["organizations"])


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    created_at: datetime


class OrganizationUpdateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)


class BranchCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: str = Field(..., min_length=2, max_length=32)
    country: str = Field(..., min_length=2, max_length=3)
    city: str = Field(..., min_length=2, max_length=100)


class BranchResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    code: str
    country: str
    city: str
    created_at: datetime


class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = None
    branch_id: uuid.UUID | None = None


class TeamResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    branch_id: uuid.UUID | None
    name: str
    description: str | None
    created_at: datetime


class MemberResponse(BaseModel):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    status: str
    branch_id: uuid.UUID | None
    team_id: uuid.UUID | None
    roles: list[str]


class InvitationCreateRequest(BaseModel):
    email: EmailStr
    role_code: str = Field(..., description="Role to be assigned upon acceptance")


class InvitationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    role_code: str
    expires_at: datetime
    created_at: datetime
    invitation_token: str | None = None  # Returned for delivery via email or dev test


@router.get("/current", response_model=OrganizationResponse)
def get_current_organization(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves current organization profile with strict tenant boundary."""
    org = db.query(Organization).filter(Organization.id == ctx.organization_id).first()
    if not org:
        raise EntityNotFoundError("Organization", ctx.organization_id)
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        status=org.status,
        created_at=org.created_at,
    )


@router.put("/current", response_model=OrganizationResponse)
def update_current_organization(
    payload: OrganizationUpdateRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Updates organization profile (requires org:manage permission)."""
    org = db.query(Organization).filter(Organization.id == ctx.organization_id).first()
    if not org:
        raise EntityNotFoundError("Organization", ctx.organization_id)

    org.name = payload.name
    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        status=org.status,
        created_at=org.created_at,
    )


@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreateRequest,
    ctx: AuthContext = Depends(require_permission("branch:manage")),
    db: Session = Depends(get_db),
):
    """Creates a branch office under the caller's organization."""
    existing = (
        db.query(Branch)
        .filter(Branch.organization_id == ctx.organization_id, Branch.code == payload.code.upper().strip())
        .first()
    )
    if existing:
        raise ConflictError(f"Branch code '{payload.code}' already exists in this organization")

    branch = Branch(
        organization_id=ctx.organization_id,
        name=payload.name,
        code=payload.code.upper().strip(),
        country=payload.country.upper().strip(),
        city=payload.city.strip(),
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return BranchResponse(
        id=branch.id,
        organization_id=branch.organization_id,
        name=branch.name,
        code=branch.code,
        country=branch.country,
        city=branch.city,
        created_at=branch.created_at,
    )


@router.get("/branches", response_model=list[BranchResponse])
def list_branches(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists all branch offices strictly for the caller's organization."""
    branches = db.query(Branch).filter(Branch.organization_id == ctx.organization_id).all()
    return [
        BranchResponse(
            id=b.id,
            organization_id=b.organization_id,
            name=b.name,
            code=b.code,
            country=b.country,
            city=b.city,
            created_at=b.created_at,
        )
        for b in branches
    ]


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreateRequest,
    ctx: AuthContext = Depends(require_permission("team:manage")),
    db: Session = Depends(get_db),
):
    """Creates a practice team under the caller's organization."""
    if payload.branch_id:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id, Branch.organization_id == ctx.organization_id).first()
        if not branch:
            raise EntityNotFoundError("Branch", payload.branch_id)

    team = Team(
        organization_id=ctx.organization_id,
        branch_id=payload.branch_id,
        name=payload.name,
        description=payload.description,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return TeamResponse(
        id=team.id,
        organization_id=team.organization_id,
        branch_id=team.branch_id,
        name=team.name,
        description=team.description,
        created_at=team.created_at,
    )


@router.get("/teams", response_model=list[TeamResponse])
def list_teams(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists all teams strictly for the caller's organization."""
    teams = db.query(Team).filter(Team.organization_id == ctx.organization_id).all()
    return [
        TeamResponse(
            id=t.id,
            organization_id=t.organization_id,
            branch_id=t.branch_id,
            name=t.name,
            description=t.description,
            created_at=t.created_at,
        )
        for t in teams
    ]


@router.get("/members", response_model=list[MemberResponse])
def list_members(
    ctx: AuthContext = Depends(require_permission("user:manage")),
    db: Session = Depends(get_db),
):
    """Lists organization members and their assigned roles."""
    memberships = (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.organization_id == ctx.organization_id)
        .all()
    )

    results = []
    for m in memberships:
        user = m.user
        roles = [mr.role.code for mr in m.roles] if m.roles else []
        results.append(
            MemberResponse(
                membership_id=m.id,
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                status=m.status,
                branch_id=m.branch_id,
                team_id=m.team_id,
                roles=roles,
            )
        )
    return results


@router.post("/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: InvitationCreateRequest,
    ctx: AuthContext = Depends(require_permission("user:manage")),
    db: Session = Depends(get_db),
):
    """Creates an invitation to join the organization with a designated role."""
    settings = get_settings()
    email_clean = payload.email.lower().strip()

    # Enforce platform security boundaries on the invited role
    if not can_assign_permission(set(ctx.roles), payload.role_code, "org:member"):
        raise PermissionDeniedError(f"Cannot invite user with role '{payload.role_code}' under your permission level")

    raw_token = generate_secure_random_token(32)
    token_hash = hash_opaque_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.invitation_token_expire_days)

    invitation = Invitation(
        organization_id=ctx.organization_id,
        inviter_user_id=ctx.user_id,
        email=email_clean,
        role_code=payload.role_code,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(invitation)

    # Record audit event
    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="organization.invitation_created",
        object_type="invitation",
        object_id=str(invitation.id),
        metadata_json={"invited_email": email_clean, "role_code": payload.role_code},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(invitation)

    return InvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        email=invitation.email,
        role_code=invitation.role_code,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        invitation_token=raw_token,
    )
