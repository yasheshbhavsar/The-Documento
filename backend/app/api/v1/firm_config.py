"""Phase 9 — Firm Configuration API Router.

Provides administrative control for Owners and Managing Admins to configure:
1. Roles & Permissions
2. Country & Pathway Enablement
3. Package Folder Structure
4. Checklist Versions
5. Reminders & Escalations
6. Inactivity Policy
7. Review Stages & Operating Model
8. Approval Owners
9. Templates
10. Rejection Reasons

Guarantees:
- Essential safeguards cannot be disabled.
- Full audit logging of changes (actor, timestamp, old/new version, reason, effective date).
- Non-silent inheritance (existing cases do not silently inherit changes).
"""

import uuid
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.errors import PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.firm_config_service import (
    FirmConfigService,
    SUPPORTED_CONFIG_DOMAINS,
    IMMUTABLE_SAFEGUARDS,
)
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.rbac import RoleCode

router = APIRouter(prefix="/organizations/{org_id}/firm-configuration", tags=["firm_configuration"])
tenant_firm_config_router = APIRouter(prefix="/firm-config", tags=["firm_configuration"])


# --- Schemas ---

class DomainConfigUpdateRequest(BaseModel):
    configuration: Optional[dict[str, Any]] = None
    config_data: Optional[dict[str, Any]] = None
    reason: str = Field(..., min_length=10, description="Mandatory audit justification for configuration change")
    effective_date: Optional[datetime] = None

    @property
    def data(self) -> dict[str, Any]:
        return self.config_data if self.config_data is not None else (self.configuration or {})


class AuditLogItemResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    config_domain: str
    version: int
    actor_id: Optional[uuid.UUID]
    actor_email: str
    old_version_json: dict[str, Any]
    new_version_json: dict[str, Any]
    reason: str
    effective_date: datetime
    created_at: datetime


def _check_elevated_admin(ctx: AuthContext) -> None:
    elevated_roles = {
        RoleCode.MASTER_ADMIN.value,
        RoleCode.COMPANY_ADMIN.value,
        RoleCode.ORGANIZATION_ADMIN.value,
    }
    if hasattr(RoleCode, "SUPERVISING_ATTORNEY"):
        elevated_roles.add(RoleCode.SUPERVISING_ATTORNEY.value)

    if not any(r in elevated_roles for r in ctx.roles):
        raise PermissionDeniedError(
            "Only managing partners, supervising attorneys, or administrators can mutate firm configuration."
        )


# --- Org Scoped Endpoints ---

@router.get("", status_code=status.HTTP_200_OK)
def get_complete_firm_configuration(
    org_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves complete firm configuration across all 10 governance domains and immutable safeguards."""
    ctx.assert_organization_access(org_id)
    return FirmConfigService.get_firm_configuration(db, org_id)


@router.get("/domains/{domain}", status_code=status.HTTP_200_OK)
def get_domain_configuration(
    org_id: uuid.UUID,
    domain: str,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves configuration for a specific governance domain."""
    ctx.assert_organization_access(org_id)
    return {
        "organization_id": str(org_id),
        "domain": domain,
        "configuration": FirmConfigService.get_domain_configuration(db, org_id, domain),
    }


@router.put("/domains/{domain}", status_code=status.HTTP_200_OK)
def update_domain_configuration(
    org_id: uuid.UUID,
    domain: str,
    payload: DomainConfigUpdateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Updates configuration for a specific domain with audit trail and safeguard enforcement."""
    ctx.assert_organization_access(org_id)
    _check_elevated_admin(ctx)

    actor_email = ctx.email or "admin@firm.internal"

    return FirmConfigService.update_domain_configuration(
        db=db,
        org_id=org_id,
        domain=domain,
        new_data=payload.data,
        actor_id=ctx.user_id,
        actor_email=actor_email,
        reason=payload.reason,
        effective_date=payload.effective_date,
    )


@router.get("/audit-log", status_code=status.HTTP_200_OK)
def get_firm_configuration_audit_log(
    org_id: uuid.UUID,
    domain: Optional[str] = Query(None, description="Optional domain filter"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Returns the append-only cryptographic audit history for all firm configuration changes."""
    ctx.assert_organization_access(org_id)
    return FirmConfigService.get_audit_history(db, org_id, domain=domain)


# --- Tenant Context Root Endpoints (/firm-config) ---

@tenant_firm_config_router.get("", status_code=status.HTTP_200_OK)
def get_current_firm_configuration(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves complete firm configuration for caller's current organization."""
    return FirmConfigService.get_firm_configuration(db, ctx.organization_id)


@tenant_firm_config_router.get("/audit-history", status_code=status.HTTP_200_OK)
@tenant_firm_config_router.get("/audit-log", status_code=status.HTTP_200_OK)
def get_current_firm_audit_log(
    domain: Optional[str] = Query(None, description="Optional domain filter"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves audit trail for caller's current organization."""
    return FirmConfigService.get_audit_history(db, ctx.organization_id, domain=domain)


@tenant_firm_config_router.get("/{domain}", status_code=status.HTTP_200_OK)
def get_current_domain_configuration(
    domain: str,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves single domain configuration for caller's organization."""
    return {
        "organization_id": str(ctx.organization_id),
        "domain": domain,
        "configuration": FirmConfigService.get_domain_configuration(db, ctx.organization_id, domain),
    }


@tenant_firm_config_router.put("/{domain}", status_code=status.HTTP_200_OK)
def update_current_domain_configuration(
    domain: str,
    payload: DomainConfigUpdateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Updates domain configuration for caller's organization."""
    _check_elevated_admin(ctx)
    actor_email = ctx.email or "admin@firm.internal"

    return FirmConfigService.update_domain_configuration(
        db=db,
        org_id=ctx.organization_id,
        domain=domain,
        new_data=payload.data,
        actor_id=ctx.user_id,
        actor_email=actor_email,
        reason=payload.reason,
        effective_date=payload.effective_date,
    )
