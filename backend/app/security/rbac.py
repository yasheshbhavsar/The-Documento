from enum import StrEnum


class RoleCode(StrEnum):
    # Core defined roles
    MASTER_ADMIN = "master_admin"
    COMPANY_ADMIN = "company_admin"
    SENIOR_REVIEWER = "senior_reviewer"
    CASE_MANAGER = "case_manager"
    DOCUMENT_REVIEWER = "document_reviewer"
    FINANCE_STAFF = "finance_staff"
    RETAINED_CLIENT = "retained_client"

    # Rule & System roles
    RULE_EDITOR = "rule_editor"
    RULE_APPROVER = "rule_approver"
    SYSTEM_ADMIN = "system_admin"
    AUDITOR = "auditor"

    # Compatibility aliases
    ORGANIZATION_ADMIN = "organization_admin"
    CASE_WORKER = "case_worker"
    APPLICANT = "applicant"


ROLE_PERMISSIONS: dict[RoleCode, set[str]] = {
    RoleCode.MASTER_ADMIN: {
        "org:manage", "user:manage", "role:manage", "branch:manage", "team:manage",
        "billing:read", "billing:manage", "security:read", "audit:read",
        "analytics:read", "analytics:export", "assignment:manage",
        "case:read", "case:read:all", "case:write", "case:write:all", "case:create", "case:delete",
        "client:delete",
        "document:read", "document:read:all", "document:write", "document:verify",
        "task:write", "request:write", "package:prepare", "finding:disposition", "readiness:approve",
        "rules:manage", "rules:evaluate", "rule:draft", "rule:approve", "rule:publish", "source:write", "source:read",
    },
    RoleCode.COMPANY_ADMIN: {
        "org:manage", "user:manage", "branch:manage", "team:manage",
        "billing:read", "billing:manage", "security:read", "audit:read",
        "analytics:read", "analytics:export", "assignment:manage",
        "case:read", "case:read:all", "case:write", "case:write:all", "case:create",
        "client:delete",
        "document:read", "document:read:all", "document:write", "document:verify",
        "task:write", "request:write", "package:prepare", "finding:disposition", "readiness:approve",
        "rules:manage", "rules:evaluate", "rule:draft", "rule:approve", "rule:publish", "source:write", "source:read",
    },
    RoleCode.SENIOR_REVIEWER: {
        "case:read", "case:read:all", "case:write", "case:write:all",
        "client:delete",
        "document:read", "document:read:all", "document:write", "document:verify",
        "finding:disposition", "readiness:approve", "package:prepare",
        "task:write", "request:write", "rules:evaluate", "rule:approve", "rule:publish", "source:read",
        "analytics:read", "assignment:manage",
    },
    RoleCode.CASE_MANAGER: {
        "case:read", "case:read:all", "case:read:assigned", "case:write", "case:write:assigned", "case:create",
        "client:delete",
        "document:read", "document:read:all", "document:read:assigned", "document:write", "document:verify",
        "task:write", "request:write", "package:prepare", "finding:disposition",
        "rules:evaluate", "source:read", "assignment:manage",
    },
    RoleCode.DOCUMENT_REVIEWER: {
        "case:read", "case:read:assigned",
        "document:read", "document:read:assigned", "document:verify",
        "task:write",
    },
    RoleCode.FINANCE_STAFF: {
        "billing:read", "billing:manage", "case:read", "case:read:all", "analytics:read", "analytics:export",
    },
    RoleCode.RETAINED_CLIENT: {
        "case:read:own", "document:read:own", "document:upload:own", "request:respond:own", "billing:read:own",
    },
    RoleCode.RULE_EDITOR: {
        "rule:draft", "source:write",
    },
    RoleCode.RULE_APPROVER: {
        "rule:approve", "rule:publish", "source:read",
    },
    RoleCode.SYSTEM_ADMIN: {
        "system:manage", "observability:read",
    },
    RoleCode.AUDITOR: {
        "audit:read", "analytics:read",
    },
    # Compatibility aliases
    RoleCode.ORGANIZATION_ADMIN: {
        "org:manage", "user:manage", "role:manage", "branch:manage", "team:manage",
        "billing:read", "billing:manage", "security:read", "audit:read",
        "analytics:read", "analytics:export", "assignment:manage",
        "case:read", "case:read:all", "case:write", "case:write:all", "case:create",
        "client:delete",
        "document:read", "document:read:all", "document:write", "document:verify",
        "task:write", "request:write", "package:prepare", "finding:disposition", "readiness:approve",
    },
    RoleCode.CASE_WORKER: {
        "case:read", "case:read:assigned", "case:write", "case:write:assigned", "case:create",
        "document:read", "document:read:assigned", "document:write", "document:verify",
        "task:write", "request:write", "package:prepare", "assignment:manage",
    },
    RoleCode.APPLICANT: {
        "case:read:own", "document:read:own", "document:upload:own", "request:respond:own", "billing:read:own",
    },
}

# Protected platform-level boundaries: Client roles cannot receive internal operational permissions
CLIENT_RESTRICTED_PERMISSIONS = {
    "org:manage", "user:manage", "role:manage", "branch:manage", "team:manage",
    "billing:read", "billing:manage", "security:read", "audit:read",
    "analytics:read", "analytics:export", "assignment:manage",
    "case:read:all", "case:write:all", "case:create", "case:delete",
    "client:delete",
    "document:read:all", "document:verify", "rule:draft", "rule:approve", "rule:publish",
}

# Rule publication is strictly reserved to authorized approvers
PROTECTED_RULE_PERMISSIONS = {"rule:publish"}


def has_permission(role: RoleCode | str, permission: str) -> bool:
    try:
        r = RoleCode(role)
    except ValueError:
        return False
    return permission in ROLE_PERMISSIONS.get(r, set())


def can_assign_permission(assigner_roles: set[RoleCode | str], target_role_code: str, permission: str) -> bool:
    """Enforces protected platform-level security boundaries on permission assignments."""
    # 1. Retained clients can NEVER be granted staff/admin permissions
    if target_role_code in (RoleCode.RETAINED_CLIENT, RoleCode.APPLICANT):
        if permission in CLIENT_RESTRICTED_PERMISSIONS:
            return False

    # 2. Rule publication requires rule approver or system admin authority
    if permission in PROTECTED_RULE_PERMISSIONS:
        assigner_set = {str(r) for r in assigner_roles}
        if not (RoleCode.RULE_APPROVER in assigner_set or RoleCode.MASTER_ADMIN in assigner_set):
            return False

    # 3. Only master admin can grant administrative org:manage or role:manage
    if permission in {"org:manage", "role:manage"}:
        assigner_set = {str(r) for r in assigner_roles}
        if not (RoleCode.MASTER_ADMIN in assigner_set or RoleCode.ORGANIZATION_ADMIN in assigner_set):
            return False

    return True
