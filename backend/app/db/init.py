from sqlalchemy.orm import Session
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.domain import models
from backend.app.domain.models import (
    MembershipRole,
    Organization,
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
    User,
)
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import ROLE_PERMISSIONS, RoleCode

ROLE_SEEDS = [
    (RoleCode.PLATFORM_SUPER_ADMIN.value, "Documento HQ Super Admin", "Platform-level B2B KYB provisioning and zero-PII governance"),
    (RoleCode.PLATFORM_OPS.value, "Documento HQ Operations", "Platform-level agency telemetry and support operations"),
    (RoleCode.MASTER_ADMIN.value, "Master Admin / Company Owner", "Full organization governance and administrative authority"),
    (RoleCode.COMPANY_ADMIN.value, "Company Admin", "Firm administrator managing branches, teams, cases, and staff"),
    (RoleCode.SENIOR_REVIEWER.value, "Senior Reviewer", "Senior legal reviewer authorizing submissions and dispositions"),
    (RoleCode.CASE_MANAGER.value, "Immigration Case Manager", "Caseworker assembling petitions, tracking milestones, and client communications"),
    (RoleCode.DOCUMENT_REVIEWER.value, "Document Reviewer", "Document intake and verification triage"),
    (RoleCode.FINANCE_STAFF.value, "Finance Staff", "Billing, retainers, and financial oversight"),
    (RoleCode.RETAINED_CLIENT.value, "Retained Client / Applicant", "Client portal access strictly scoped to own petition"),
    (RoleCode.RULE_EDITOR.value, "Rule Editor", "Specialized immigration pathway rule drafter"),
    (RoleCode.RULE_APPROVER.value, "Rule Approver", "Specialized immigration rule verifier and publisher"),
    (RoleCode.SYSTEM_ADMIN.value, "System Admin", "Infrastructure and observability manager"),
    (RoleCode.AUDITOR.value, "Auditor", "Read-only compliance audit trail observer"),
    # Compatibility aliases
    ("organization_admin", "Organization Admin (Legacy)", "Alias for master admin"),
    ("case_worker", "Case Worker (Legacy)", "Alias for case manager"),
    ("applicant", "Applicant (Legacy)", "Alias for retained client"),
]

PLATFORM_HQ_EMAIL = "hq.admin@documento.ai"
PLATFORM_HQ_INITIAL_PASSWORD = "DocumentoHQ2026!"


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        for code, name, desc in ROLE_SEEDS:
            role = db.query(Role).filter_by(code=code).first()
            if role is None:
                db.add(Role(code=code, name=name, description=desc))
        db.flush()

        # Bootstrap ONLY the Documento HQ Super-Admin operator (zero demo agencies, clients, or cases)
        hq_org = db.query(Organization).filter_by(slug="documento-hq").first()
        if hq_org is None:
            hq_org = Organization(
                name="Documento Platform Control Plane",
                slug="documento-hq",
                status="active",
            )
            db.add(hq_org)
            db.flush()

        hq_user = db.query(User).filter_by(email=PLATFORM_HQ_EMAIL).first()
        if hq_user is None:
            hq_user = User(
                organization_id=hq_org.id,
                email=PLATFORM_HQ_EMAIL,
                name="Documento HQ Operator",
                full_name="Documento HQ Operator",
                password_hash=hash_password(PLATFORM_HQ_INITIAL_PASSWORD),
                status="active",
            )
            db.add(hq_user)
            db.flush()

        hq_membership = (
            db.query(OrganizationMembership)
            .filter_by(organization_id=hq_org.id, user_id=hq_user.id)
            .first()
        )
        if hq_membership is None:
            hq_membership = OrganizationMembership(
                organization_id=hq_org.id,
                user_id=hq_user.id,
                status="active",
            )
            db.add(hq_membership)
            db.flush()
            hq_role = db.query(Role).filter_by(code=RoleCode.PLATFORM_SUPER_ADMIN.value).first()
            if hq_role is not None:
                db.add(MembershipRole(membership_id=hq_membership.id, role_id=hq_role.id))

        db.commit()


if __name__ == "__main__":
    init_db()
