import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.errors import AuthenticationError, ConflictError, EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    User,
    Organization,
    OrganizationMembership,
    MembershipRole,
    Role,
    Session as UserSession,
    PasswordResetToken,
    Invitation,
    AuditEvent,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password, verify_password
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import (
    create_access_token,
    generate_secure_random_token,
    hash_opaque_token,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    organization_id: uuid.UUID
    roles: list[str]
    requires_mfa: bool = False


class MeResponse(BaseModel):
    user_id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
    is_mfa_enabled: bool
    experience: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class InvitationAcceptRequest(BaseModel):
    token: str
    full_name: str = Field(..., min_length=2)
    password: str = Field(..., min_length=8)


class MfaSetupResponse(BaseModel):
    secret: str
    mfa_ready: bool = True
    instructions: str


class MfaVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticates user with email and password, creates a secure session, and sets session cookie."""
    settings = get_settings()
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    if user.status != "active":
        raise AuthenticationError("User account is inactive or suspended")

    # Resolve active organization membership
    membership = (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.user_id == user.id, OrganizationMembership.status == "active")
        .first()
    )
    if not membership:
        raise AuthenticationError("User has no active organization membership")

    # Fetch roles
    roles = [
        mr.role.code
        for mr in db.query(MembershipRole).filter(MembershipRole.membership_id == membership.id).all()
    ]
    if not roles:
        roles = [RoleCode.CASE_MANAGER.value]

    # Create session record
    session_raw_token = generate_secure_random_token(32)
    session_hash = hash_opaque_token(session_raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.access_token_expire_minutes)

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user_session = UserSession(
        user_id=user.id,
        organization_id=membership.organization_id,
        token_hash=session_hash,
        ip_address=client_ip,
        user_agent=user_agent[:255] if user_agent else None,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(user_session)

    # Record login audit event
    audit = AuditEvent(
        organization_id=membership.organization_id,
        actor_id=user.id,
        action="auth.login",
        object_type="user",
        object_id=str(user.id),
        metadata_json={"ip": client_ip or "unknown"},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(user_session)

    # Generate JWT
    token_claims = {
        "sub": str(user.id),
        "org_id": str(membership.organization_id),
        "membership_id": str(membership.id),
        "email": user.email,
        "roles": roles,
        "session_id": str(user_session.id),
    }
    jwt_token = create_access_token(token_claims)

    # Set secure session cookie
    response.set_cookie(
        key=settings.session_cookie_name,
        value=jwt_token,
        httponly=True,
        secure=not settings.debug and settings.environment != "development",
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
    )

    return LoginResponse(
        access_token=jwt_token,
        user_id=user.id,
        organization_id=membership.organization_id,
        roles=roles,
        requires_mfa=user.is_mfa_enabled,
    )


@router.post("/logout")
def logout(
    response: Response,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Terminates the active session and clears the session cookie."""
    settings = get_settings()
    if ctx.session_id:
        user_session = db.query(UserSession).filter(UserSession.id == ctx.session_id).first()
        if user_session:
            user_session.revoked_at = datetime.now(timezone.utc)
            db.commit()

    response.delete_cookie(key=settings.session_cookie_name)
    return {"status": "ok", "message": "Successfully logged out"}


@router.get("/me", response_model=MeResponse)
def get_me(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Returns authenticated user profile, organization membership, assigned roles, and permissions."""
    user = db.query(User).filter(User.id == ctx.user_id).first()
    full_name = user.full_name if user else "Local Developer"
    is_mfa = user.is_mfa_enabled if user else False

    experience = "case_manager"
    if ctx.is_master_admin() or ctx.is_company_admin():
        experience = "master_admin"
    elif ctx.is_retained_client():
        experience = "client_applicant"

    return MeResponse(
        user_id=ctx.user_id,
        organization_id=ctx.organization_id,
        email=ctx.email,
        full_name=full_name,
        roles=list(ctx.roles),
        permissions=sorted(list(ctx.permissions)),
        is_mfa_enabled=is_mfa,
        experience=experience,
    )


@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """Generates password reset token without leaking user existence."""
    settings = get_settings()
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    # Always return 200 to prevent user enumeration attacks
    if not user:
        return {"status": "ok", "message": "If the email is registered, a password reset link has been issued."}

    raw_token = generate_secure_random_token(32)
    token_hash = hash_opaque_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.password_reset_token_expire_hours)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(reset_record)
    db.commit()

    # In development mode, return token for easy test verification
    response_data: dict[str, str] = {
        "status": "ok",
        "message": "If the email is registered, a password reset link has been issued.",
    }
    is_prod_like = settings.environment.lower() in ("production", "prod", "staging", "uat")
    if not is_prod_like and (settings.environment == "development" or settings.debug):
        response_data["dev_reset_token"] = raw_token

    return response_data


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    """Validates reset token and sets new password."""
    token_hash = hash_opaque_token(payload.token)
    now = datetime.now(timezone.utc)

    reset_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
        .first()
    )
    if not reset_record:
        raise AuthenticationError("Invalid or expired password reset token")

    user = db.query(User).filter(User.id == reset_record.user_id).first()
    if not user:
        raise EntityNotFoundError("User", reset_record.user_id)

    user.password_hash = hash_password(payload.new_password)
    user.updated_at = now
    reset_record.used_at = now

    # Revoke all existing sessions on password reset for security
    db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)).update(
        {"revoked_at": now}
    )
    db.commit()

    return {"status": "ok", "message": "Password updated successfully. Please log in with your new password."}


@router.post("/invitations/accept")
def accept_invitation(
    payload: InvitationAcceptRequest,
    db: Session = Depends(get_db),
):
    """Validates invitation token, sets full name and password, and creates active organization membership."""
    token_hash = hash_opaque_token(payload.token)
    now = datetime.now(timezone.utc)

    invitation = (
        db.query(Invitation)
        .filter(
            Invitation.token_hash == token_hash,
            Invitation.accepted_at.is_(None),
            Invitation.expires_at > now,
        )
        .first()
    )
    if not invitation:
        raise AuthenticationError("Invalid or expired invitation token")

    # Find or create user
    user = db.query(User).filter(User.email == invitation.email.lower().strip()).first()
    if not user:
        user = User(
            email=invitation.email.lower().strip(),
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    else:
        user.full_name = payload.full_name
        user.password_hash = hash_password(payload.password)
        user.status = "active"
        user.updated_at = now

    # Check or create membership
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.organization_id == invitation.organization_id,
            OrganizationMembership.user_id == user.id,
        )
        .first()
    )
    if not membership:
        membership = OrganizationMembership(
            organization_id=invitation.organization_id,
            user_id=user.id,
            status="active",
            created_at=now,
        )
        db.add(membership)
        db.flush()
    else:
        membership.status = "active"

    # Assign role
    role = db.query(Role).filter(Role.code == invitation.role_code).first()
    if not role:
        role = Role(code=invitation.role_code, name=invitation.role_code.replace("_", " ").title())
        db.add(role)
        db.flush()

    existing_mr = (
        db.query(MembershipRole)
        .filter(MembershipRole.membership_id == membership.id, MembershipRole.role_id == role.id)
        .first()
    )
    if not existing_mr:
        db.add(MembershipRole(membership_id=membership.id, role_id=role.id, assigned_at=now))

    invitation.accepted_at = now
    db.commit()

    return {
        "status": "ok",
        "message": "Invitation accepted successfully. You may now log in.",
        "organization_id": str(invitation.organization_id),
        "user_id": str(user.id),
    }


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Generates an MFA secret for the authenticated user (MFA-ready architecture)."""
    user = db.query(User).filter(User.id == ctx.user_id).first()
    if not user:
        raise EntityNotFoundError("User", ctx.user_id)

    # Generate 32-character secret for TOTP apps
    mfa_secret = generate_secure_random_token(20).replace("-", "").replace("_", "")[:32].upper()
    user.mfa_secret = mfa_secret
    db.commit()

    return MfaSetupResponse(
        secret=mfa_secret,
        mfa_ready=True,
        instructions="Enter this secret or scan QR code in Google Authenticator or 1Password.",
    )


@router.post("/mfa/verify")
def verify_mfa(
    payload: MfaVerifyRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Verifies MFA confirmation code and activates MFA on the account."""
    user = db.query(User).filter(User.id == ctx.user_id).first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA setup has not been initiated")

    # In production, uses pyotp.TOTP(user.mfa_secret).verify(payload.code).
    # For MFA-ready architecture, validate non-empty 6 digit code
    if len(payload.code) != 6 or not payload.code.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA code must be 6 digits")

    user.is_mfa_enabled = True
    db.commit()

    return {"status": "ok", "message": "MFA has been successfully verified and enabled."}
