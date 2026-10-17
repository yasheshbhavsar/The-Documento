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
        return self.has_role(RoleCode.CASE_MANAGER)

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
        """Enforces tenant isolation boundary. Cross-tenant access is strictly denied without metadata leakage."""
        if self.organization_id != target_org_id:
            raise TenantIsolationError(
                "Cross-tenant access forbidden: requested resource does not belong to authorized organization"
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
            eff_client_user_id = client_user_id
            if eff_client_user_id is None and hasattr(case, "client") and case.client:
                eff_client_user_id = getattr(case.client, "user_id", None)

            is_client = eff_client_user_id is not None and eff_client_user_id == self.user_id
            is_auth_dep = (
                authorized_dependant_user_ids is not None
                and self.user_id in authorized_dependant_user_ids
            )
            if not is_auth_dep and hasattr(case, "client") and case.client and hasattr(case.client, "dependants"):
                for dep in (case.client.dependants or []):
                    if getattr(dep, "is_authorized_to_view_case", False) and getattr(dep, "user_id", None) == self.user_id:
                        is_auth_dep = True
                        break

            if not (is_client or is_auth_dep):
                raise PermissionDeniedError(
                    "Retained clients can only access cases where they are the designated applicant or authorized dependant"
                )

        # Unassigned officers/caseworkers and document reviewers are constrained to assigned cases unless firm managers/admins
        is_firm_manager = (
            self.is_org_admin()
            or self.is_senior_reviewer()
            or self.is_case_manager()
            or self.has_permission("case:read:all")
        )
        if (
            self.has_role(RoleCode.CASE_WORKER)
            or self.has_role(RoleCode.DOCUMENT_REVIEWER)
        ) and not is_firm_manager:
            if assigned_user_ids is not None and self.user_id not in assigned_user_ids:
                raise PermissionDeniedError(
                    "Case access is restricted to assigned officers and case managers"
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

    # 2. Check Session Cookie fallback (only if not explicitly using dev/test simulation headers)
    has_sim_headers = bool(x_user_id or x_user_role)
    if not token and not has_sim_headers:
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

            # Verify active user in DB
            user = db.query(User).filter(User.id == user_id).first()
            if not user or user.status != "active":
                raise AuthenticationError("User account is inactive, deactivated, or revoked")

            # Verify active membership in DB if present
            if membership_id:
                membership = db.query(OrganizationMembership).filter(
                    OrganizationMembership.id == membership_id
                ).first()
                if not membership or membership.status != "active":
                    raise AuthenticationError("Organization membership is inactive or revoked")

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
                    raise AuthenticationError("Invalid session identifier in token")

            return AuthContext(
                user_id=user_id,
                organization_id=org_id,
                membership_id=membership_id,
                email=email,
                roles=tuple(roles_list),
                session_id=session_id,
                subject=f"user:{user_id}",
            )
        except AuthenticationError:
            raise
        except Exception as e:
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
