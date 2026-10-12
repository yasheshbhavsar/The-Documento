from sqlalchemy.orm import Session
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.domain import models
from backend.app.domain.models import Role, Permission, RolePermission
from backend.app.security.rbac import ROLE_PERMISSIONS, RoleCode

ROLE_SEEDS = [
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        for code, name, desc in ROLE_SEEDS:
            role = db.query(Role).filter_by(code=code).first()
            if role is None:
                db.add(Role(code=code, name=name, description=desc))
        db.commit()


if __name__ == "__main__":
    init_db()
