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
    CaseAssignment,
    ImmigrationCase,
    Session as UserSession,
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


@router.post("/current/archive", response_model=OrganizationResponse)
def archive_current_organization(
    reason: str = "Organization archived by administrator",
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """
    Safely archives the current organization (soft-deletion) rather than hard cascading deletion.
    - Marks organization status as 'archived'.
    - Revokes active sessions of all members.
    - Preserves historical cases, evidence documents, and immutable audit logs.
    """
    if not (ctx.is_master_admin() or ctx.is_company_admin() or ctx.is_org_admin()):
        raise PermissionDeniedError("Only organization owners or administrators can archive the firm workspace")

    org = db.query(Organization).filter(Organization.id == ctx.organization_id).first()
    if not org:
        raise EntityNotFoundError("Organization", ctx.organization_id)

    now = datetime.now(timezone.utc)
    org.status = "archived"
    org.updated_at = now

    member_user_ids = [m.user_id for m in org.memberships]
    if member_user_ids:
        db.query(UserSession).filter(
            UserSession.organization_id == org.id,
            UserSession.revoked_at.is_(None),
        ).update({"revoked_at": now}, synchronize_session=False)

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=ctx.user_id,
        action="organization.archived",
        object_type="organization",
        object_id=str(org.id),
        metadata_json={
            "reason": reason,
            "archived_at": now.isoformat(),
            "actor_id": str(ctx.user_id),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        status=org.status,
        created_at=org.created_at,
    )


@router.delete("/current", response_model=OrganizationResponse)
def delete_current_organization(
    reason: str = "Organization archived by administrator",
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Alias for soft-deletion (archive) to prevent destructive relational cascade data loss."""
    return archive_current_organization(reason=reason, ctx=ctx, db=db)


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


class OffboardMemberRequest(BaseModel):
    transfer_cases_to_user_id: uuid.UUID | None = None
    reason: str = Field(..., min_length=3, max_length=500)


class OffboardMemberResponse(BaseModel):
    user_id: uuid.UUID
    organization_id: uuid.UUID
    membership_status: str
    user_status: str
    transferred_cases_count: int
    transferred_to_user_id: uuid.UUID | None = None
    sessions_revoked_count: int
    offboarded_at: datetime


@router.post("/members/{user_id}/offboard", response_model=OffboardMemberResponse)
def offboard_member(
    user_id: uuid.UUID,
    payload: OffboardMemberRequest,
    ctx: AuthContext = Depends(require_permission("user:manage")),
    db: Session = Depends(get_db),
):
    """
    Executes employee offboarding:
    - Only owner/manager (is_org_admin) can execute offboarding.
    - Transfers active cases to designated colleague, preserving history.
    - Sets membership to inactive and revokes all active sessions.
    - Logs audit events without leaking sensitive data.
    """
    if not ctx.is_org_admin():
        raise PermissionDeniedError("Only organization owners and administrators can offboard employees")

    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.organization_id == ctx.organization_id,
            OrganizationMembership.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise EntityNotFoundError("OrganizationMembership", user_id)

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise EntityNotFoundError("User", user_id)

    now = datetime.now(timezone.utc)
    transferred_count = 0

    # 1. Transfer active case assignments if requested
    if payload.transfer_cases_to_user_id:
        recipient = (
            db.query(User)
            .join(User.memberships)
            .filter(
                User.id == payload.transfer_cases_to_user_id,
                User.memberships.any(
                    organization_id=ctx.organization_id,
                    status="active",
                ),
            )
            .first()
        )
        if not recipient:
            raise EntityNotFoundError("Active Recipient User in Organization", payload.transfer_cases_to_user_id)

        active_assignments = (
            db.query(CaseAssignment)
            .join(CaseAssignment.case)
            .filter(
                CaseAssignment.user_id == user_id,
                ImmigrationCase.organization_id == ctx.organization_id,
            )
            .all()
        )
        for assign in active_assignments:
            old_uid = str(assign.user_id)
            assign.user_id = recipient.id
            assign.assigned_at = now
            transferred_count += 1

            audit = AuditEvent(
                organization_id=ctx.organization_id,
                actor_id=ctx.user_id,
                action="case.assignment_transferred",
                object_type="case_assignment",
                object_id=str(assign.id),
                metadata_json={
                    "case_id": str(assign.case_id),
                    "role_in_case": assign.role_in_case,
                    "previous_user_id": old_uid,
                    "transferred_to_user_id": str(recipient.id),
                    "offboarding_reason": payload.reason,
                },
                occurred_at=now,
            )
            db.add(audit)

    # 2. Deactivate membership
    membership.status = "inactive"

    # 3. Revoke all active sessions
    revoked_count = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .update({"revoked_at": now})
    )

    # 4. If no other active memberships, mark user inactive
    other_active = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.id != membership.id,
            OrganizationMembership.status == "active",
        )
        .count()
    )
    if other_active == 0:
        target_user.status = "inactive"

    # 5. Record audit event for employee offboarding
    audit_offboard = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="organization.employee_offboarded",
        object_type="user",
        object_id=str(user_id),
        metadata_json={
            "transferred_cases_count": transferred_count,
            "transferred_to_user_id": str(payload.transfer_cases_to_user_id) if payload.transfer_cases_to_user_id else None,
            "sessions_revoked": revoked_count,
            "reason": payload.reason,
        },
        occurred_at=now,
    )
    db.add(audit_offboard)
    db.commit()

    return OffboardMemberResponse(
        user_id=user_id,
        organization_id=ctx.organization_id,
        membership_status=membership.status,
        user_status=target_user.status,
        transferred_cases_count=transferred_count,
        transferred_to_user_id=payload.transfer_cases_to_user_id,
        sessions_revoked_count=revoked_count,
        offboarded_at=now,
    )

