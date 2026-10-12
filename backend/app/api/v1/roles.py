from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.core.errors import PermissionDeniedError
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.rbac import (
    ROLE_PERMISSIONS,
    RoleCode,
    can_assign_permission,
    has_permission,
)

router = APIRouter(prefix="/roles", tags=["roles"])


class RoleInfo(BaseModel):
    code: str
    name: str
    description: str
    permissions: list[str]


class PermissionAssignmentRequest(BaseModel):
    permission: str = Field(..., min_length=3, max_length=100)


ROLE_DESCRIPTIONS = {
    RoleCode.MASTER_ADMIN.value: "Company Owner with full firm governance, billing, and administrative authority.",
    RoleCode.COMPANY_ADMIN.value: "Firm administrator managing teams, branches, cases, and staff assignments.",
    RoleCode.SENIOR_REVIEWER.value: "Senior legal reviewer authorizing submission readiness and dispositions.",
    RoleCode.CASE_MANAGER.value: "Immigration Case Manager assembling petitions, tracking milestones, and reviewing evidence.",
    RoleCode.DOCUMENT_REVIEWER.value: "Document Reviewer performing intake integrity checks and evidence triage.",
    RoleCode.FINANCE_STAFF.value: "Finance staff managing firm billing, client retainers, and trust accounts.",
    RoleCode.RETAINED_CLIENT.value: "Retained Client / Applicant portal with strictly scoped case and upload access.",
    RoleCode.RULE_EDITOR.value: "Specialized rule drafter configuring immigration pathway rules (cannot publish).",
    RoleCode.RULE_APPROVER.value: "Specialized rule approver verifying and publishing immigration rule versions.",
    RoleCode.SYSTEM_ADMIN.value: "System administrator managing infrastructure, logs, and observability.",
    RoleCode.AUDITOR.value: "Compliance auditor with read-only immutable audit trail access.",
}


@router.get("", response_model=list[RoleInfo])
def list_roles():
    """Returns all defined platform roles, descriptions, and assigned permissions."""
    results = []
    # Primary defined roles
    primary_roles = [
        RoleCode.MASTER_ADMIN,
        RoleCode.COMPANY_ADMIN,
        RoleCode.SENIOR_REVIEWER,
        RoleCode.CASE_MANAGER,
        RoleCode.DOCUMENT_REVIEWER,
        RoleCode.FINANCE_STAFF,
        RoleCode.RETAINED_CLIENT,
        RoleCode.RULE_EDITOR,
        RoleCode.RULE_APPROVER,
        RoleCode.SYSTEM_ADMIN,
        RoleCode.AUDITOR,
    ]
    for r in primary_roles:
        results.append(
            RoleInfo(
                code=r.value,
                name=r.value.replace("_", " ").title(),
                description=ROLE_DESCRIPTIONS.get(r.value, ""),
                permissions=sorted(list(ROLE_PERMISSIONS.get(r, set()))),
            )
        )
    return results


@router.post("/{role_code}/permissions")
def assign_role_permission(
    role_code: str,
    payload: PermissionAssignmentRequest,
    ctx: AuthContext = Depends(require_permission("role:manage")),
):
    """Configures permission assignment subject to protected platform-level boundaries."""
    role_clean = role_code.lower().strip()
    perm_clean = payload.permission.strip()

    # Enforce platform security boundaries
    allowed = can_assign_permission(
        assigner_roles=set(ctx.roles),
        target_role_code=role_clean,
        permission=perm_clean,
    )
    if not allowed:
        raise PermissionDeniedError(
            f"Assignment forbidden: '{perm_clean}' violates platform security boundaries for role '{role_clean}'"
        )

    # In a fully dynamic DB mapping, we add to role_permissions table.
    # In runtime map, ensure it is added
    try:
        r_enum = RoleCode(role_clean)
        ROLE_PERMISSIONS.setdefault(r_enum, set()).add(perm_clean)
    except ValueError:
        pass

    return {
        "status": "ok",
        "message": f"Permission '{perm_clean}' successfully assigned to role '{role_clean}'.",
        "role_code": role_clean,
        "permission": perm_clean,
    }
