import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Sequence
from fastapi import Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.errors import AuthenticationError, PermissionDeniedError, TenantIsolationError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    User,
    Organization,
    OrganizationMembership,
    MembershipRole,
    Role,
    Session as UserSession,
    ImmigrationCase,
)
from backend.app.security.rbac import RoleCode, ROLE_PERMISSIONS, has_permission
from backend.app.security.tokens import decode_access_token, hash_opaque_token

DEFAULT_DEV_ORG_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
DEFAULT_DEV_USER_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")


@dataclass(frozen=True)
class AuthContext:
    user_id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    membership_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    roles: tuple[str, ...] = field(default_factory=tuple)
    subject: str = "authenticated_user"

    @property
    def permissions(self) -> frozenset[str]:
        perms: set[str] = set()
        for role_code in self.roles:
            perms.update(ROLE_PERMISSIONS.get(role_code, set()))
            # check enum value matching
            try:
                enum_role = RoleCode(role_code)
                perms.update(ROLE_PERMISSIONS.get(enum_role, set()))
            except ValueError:
                pass
        return frozenset(perms)

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def has_role(self, role: RoleCode | str) -> bool:
        role_str = str(role)
        return role_str in self.roles

    def is_master_admin(self) -> bool:
        return self.has_role(RoleCode.MASTER_ADMIN) or self.has_role(RoleCode.ORGANIZATION_ADMIN)

    def is_company_admin(self) -> bool:
        return self.is_master_admin() or self.has_role(RoleCode.COMPANY_ADMIN)

    def is_case_manager(self) -> bool:
        return self.has_role(RoleCode.CASE_MANAGER) or self.has_role(RoleCode.CASE_WORKER)

    def is_senior_reviewer(self) -> bool:
        return self.has_role(RoleCode.SENIOR_REVIEWER)

    def is_retained_client(self) -> bool:
        return (
            self.has_role(RoleCode.RETAINED_CLIENT)
            or self.has_role(RoleCode.APPLICANT)
            or self.has_role("client")
            or self.has_role("retained_client")
            or self.has_role("applicant")
        )

    def is_org_admin(self) -> bool:
        return self.is_company_admin() or self.is_master_admin()

    def is_applicant(self) -> bool:
        return self.is_retained_client()

    def assert_organization_access(self, target_org_id: uuid.UUID) -> None:
        """Enforces tenant isolation boundary. Cross-tenant access is strictly denied."""
        if self.organization_id != target_org_id:
            raise TenantIsolationError(
                f"Cross-tenant access forbidden: authenticated org {self.organization_id} cannot access org {target_org_id}"
            )

    def assert_case_access(
        self,
        case: ImmigrationCase,
        client_user_id: uuid.UUID | None = None,
        assigned_user_ids: Sequence[uuid.UUID] | None = None,
        authorized_dependant_user_ids: Sequence[uuid.UUID] | None = None,
    ) -> None:
        """Enforces object-level authorization for immigration cases."""
        self.assert_organization_access(case.organization_id)

        # Retained clients can only access cases where they are the designated client or authorized dependant
        if self.is_retained_client():
            is_client = client_user_id is not None and client_user_id == self.user_id
            is_auth_dep = (
                authorized_dependant_user_ids is not None
                and self.user_id in authorized_dependant_user_ids
            )
            if not (is_client or is_auth_dep):
                raise PermissionDeniedError(
                    "Retained clients can only access cases where they are the designated applicant or authorized dependant"
                )

        # Document reviewers are constrained to assigned cases if not admins
        if self.has_role(RoleCode.DOCUMENT_REVIEWER) and not self.is_company_admin():
            if assigned_user_ids is not None and self.user_id not in assigned_user_ids:
                raise PermissionDeniedError(
                    "Document reviewer access is restricted to assigned cases"
                )


async def get_auth_context(
    request: Request,
    authorization: str | None = Header(default=None),
    x_organization_id: str | None = Header(default=None),
    x_org_id: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthContext:
    """Authenticates the request from Bearer JWT, session cookie, or dev headers."""
    settings = get_settings()

    # 1. Check Bearer Token
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()

    # 2. Check Session Cookie fallback
    if not token:
        cookie_val = request.cookies.get(settings.session_cookie_name)
        if cookie_val:
            token = cookie_val

    # 3. If token present, decode and validate
    if token:
        try:
            payload = decode_access_token(token)
            user_id = uuid.UUID(payload["sub"])
            org_id = uuid.UUID(payload.get("org_id", str(DEFAULT_DEV_ORG_ID)))
            email = payload.get("email", "user@ai-immigration.local")
            roles_list = payload.get("roles", [RoleCode.MASTER_ADMIN.value])
            membership_id = uuid.UUID(payload["membership_id"]) if payload.get("membership_id") else None

            # Verify active session if session_id is present in payload
            session_id = None
            if payload.get("session_id"):
                try:
                    s_id = uuid.UUID(payload["session_id"])
                    user_session = db.query(UserSession).filter(
                        UserSession.id == s_id,
                        UserSession.revoked_at.is_(None),
                        UserSession.expires_at > datetime.now(timezone.utc),
                    ).first()
                    if not user_session:
                        raise AuthenticationError("Session has been revoked or expired")
                    session_id = s_id
                except (ValueError, TypeError):
                    pass

            return AuthContext(
                user_id=user_id,
                organization_id=org_id,
                membership_id=membership_id,
                email=email,
                roles=tuple(roles_list),
                session_id=session_id,
                subject=f"user:{user_id}",
            )
        except Exception as e:
            if settings.auth_required:
                raise AuthenticationError(f"Invalid authentication token: {e}")

    # 4. If auth is strictly required and no valid token found
    if settings.auth_required:
        raise AuthenticationError("Authentication required: valid session or Bearer token missing")

    # 5. In development/testing mode: allow test simulation headers
    resolved_org_id = x_organization_id or x_org_id
    try:
        org_id = uuid.UUID(resolved_org_id) if resolved_org_id else DEFAULT_DEV_ORG_ID
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Organization-Id format")

    try:
        user_id = uuid.UUID(x_user_id) if x_user_id else DEFAULT_DEV_USER_ID
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-User-Id format")

    roles: list[str] = []
    if x_user_role:
        role_clean = x_user_role.lower().strip()
        roles.append(role_clean)
    else:
        roles.append(RoleCode.MASTER_ADMIN.value)

    return AuthContext(
        user_id=user_id,
        organization_id=org_id,
        email="developer@ai-immigration.local",
        roles=tuple(roles),
        subject="local-development",
    )


def require_permission(permission: str):
    """Enforces server-side permission check."""
    def dependency(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not ctx.has_permission(permission):
            raise PermissionDeniedError(f"Action requires '{permission}' permission")
        return ctx
    return dependency


def require_role(role: RoleCode | str):
    """Enforces server-side role check."""
    def dependency(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not ctx.has_role(role):
            raise PermissionDeniedError(f"Action requires '{role}' role")
        return ctx
    return dependency


def require_master_admin(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if not ctx.is_master_admin():
        raise PermissionDeniedError("Master admin authority required")
    return ctx
