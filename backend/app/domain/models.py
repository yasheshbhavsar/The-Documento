import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Float,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    branches: Mapped[list["Branch"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    teams: Mapped[list["Team"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    memberships: Mapped[list["OrganizationMembership"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    cases: Mapped[list["ImmigrationCase"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    client_profiles: Mapped[list["ClientProfile"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    official_sources: Mapped[list["OfficialSource"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    rule_sets: Mapped[list["RuleSet"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    form_schemas: Mapped[list["FormSchema"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    package_templates: Mapped[list["PackageTemplate"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    service_items: Mapped[list["ServiceItem"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    client_engagements: Mapped[list["ClientEngagement"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    payment_records: Mapped[list["PaymentRecord"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    settings: Mapped[list["OrganizationSetting"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    processing_runs: Mapped[list["DocumentProcessingRun"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    outbox_events: Mapped[list["OutboxEvent"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_branch_org_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    country: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO Alpha-2/3
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="branches")
    teams: Mapped[list["Team"]] = relationship(back_populates="branch")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="teams")
    branch: Mapped[Branch | None] = relationship(back_populates="teams")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")  # active, suspended, pending
    is_mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    auth_subject: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    memberships: Mapped[list["OrganizationMembership"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    client_profile: Mapped["ClientProfile | None"] = relationship(back_populates="user")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    permissions: Mapped[list["RolePermission"]] = relationship(back_populates="role", cascade="all, delete-orphan")


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)  # organization, case, document, billing, audit
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)

    role: Mapped[Role] = relationship(back_populates="permissions")
    permission: Mapped[Permission] = relationship()


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_membership_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")  # active, invited, suspended
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")
    roles: Mapped[list["MembershipRole"]] = relationship(back_populates="membership", cascade="all, delete-orphan")


class MembershipRole(Base):
    __tablename__ = "membership_roles"

    membership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organization_memberships.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    membership: Mapped[OrganizationMembership] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship()


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    inviter_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    role_code: Mapped[str] = mapped_column(String(64), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nationality: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO Alpha-3
    passport_number_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="client_profiles")
    user: Mapped[User | None] = relationship(back_populates="client_profile")
    cases: Mapped[list["ImmigrationCase"]] = relationship(back_populates="client")
    dependants: Mapped[list["ClientDependant"]] = relationship(back_populates="primary_client", cascade="all, delete-orphan")
    consents: Mapped[list["ClientConsent"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    document_requests: Mapped[list["DocumentRequest"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    questionnaires: Mapped[list["ClientQuestionnaire"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    engagements: Mapped[list["ClientEngagement"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class ImmigrationCase(Base):
    __tablename__ = "immigration_cases"
    __table_args__ = (
        UniqueConstraint("organization_id", "case_number", name="uq_case_org_number"),
        Index("ix_cases_org_status", "organization_id", "status"),
        Index("ix_cases_org_jurisdiction", "organization_id", "jurisdiction"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    case_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(3), nullable=False)  # US, CA, GB, AU
    visa_category: Mapped[str] = mapped_column(String(64), nullable=False)  # EB-1A, O-1A, H-1B, L-1A
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="intake")
    priority_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="cases")
    client: Mapped[ClientProfile] = relationship(back_populates="cases")
    assignments: Mapped[list["CaseAssignment"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    milestones: Mapped[list["CaseMilestone"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    notes: Mapped[list["CaseNote"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    tasks: Mapped[list["CaseTask"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    consents: Mapped[list["ClientConsent"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    ai_findings: Mapped[list["CaseAIFinding"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    requirement_evaluations: Mapped[list["CaseRequirementEvaluation"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    document_requests: Mapped[list["DocumentRequest"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    message_threads: Mapped[list["MessageThread"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    questionnaires: Mapped[list["ClientQuestionnaire"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    form_submissions: Mapped[list["FormSubmission"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    filing_packages: Mapped[list["FilingPackage"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    engagements: Mapped[list["ClientEngagement"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="case", cascade="all, delete-orphan")


class CaseAssignment(Base):
    __tablename__ = "case_assignments"
    __table_args__ = (UniqueConstraint("case_id", "user_id", "role_in_case", name="uq_case_user_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_in_case: Mapped[str] = mapped_column(String(64), nullable=False)  # lead_attorney, case_manager, reviewer
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    case: Mapped[ImmigrationCase] = relationship(back_populates="assignments")
    user: Mapped[User] = relationship()


class ClientDependant(Base):
    __tablename__ = "client_dependants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    primary_client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    relationship_type: Mapped[str] = mapped_column(String(64), nullable=False)  # spouse, child, parent, sibling, dependent, sponsor, other
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nationality: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO Alpha-3
    passport_number_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_authorized_to_view_case: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    primary_client: Mapped[ClientProfile] = relationship(back_populates="dependants")
    user: Mapped[User | None] = relationship()


class ClientConsent(Base):
    __tablename__ = "client_consents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=True, index=True)
    consent_type: Mapped[str] = mapped_column(String(64), nullable=False)  # representation_g28, data_processing_gdpr, communication_consent, fee_agreement
    granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    document_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    client: Mapped[ClientProfile] = relationship(back_populates="consents")
    case: Mapped[ImmigrationCase | None] = relationship(back_populates="consents")


class CaseMilestone(Base):
    __tablename__ = "case_milestones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    stage: Mapped[str] = mapped_column(String(64), nullable=False)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, completed, overdue, waived
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    case: Mapped[ImmigrationCase] = relationship(back_populates="milestones")


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    note_type: Mapped[str] = mapped_column(String(64), default="internal", nullable=False)  # internal, client_communication, legal_strategy, status_update
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_client_visible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    case: Mapped[ImmigrationCase] = relationship(back_populates="notes")
    author: Mapped[User | None] = relationship()


class CaseTask(Base):
    __tablename__ = "case_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)  # critical, high, medium, low
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, in_progress, completed, cancelled
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    case: Mapped[ImmigrationCase] = relationship(back_populates="tasks")
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_user_id])
    completed_by: Mapped[User | None] = relationship(foreign_keys=[completed_by_user_id])


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    object_type: Mapped[str] = mapped_column(String(100), nullable=False)
    object_id: Mapped[str] = mapped_column(String(255), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    before_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    after_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="info")  # info, warning, deadline, case_update, new_request, new_message, review_request
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    channel: Mapped[str] = mapped_column(String(32), default="in_app", nullable=False)  # in_app, email
    delivery_status: Mapped[str] = mapped_column(String(32), default="delivered", nullable=False)  # queued, sent, delivered, failed
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_org_case", "organization_id", "case_id"),
        Index("ix_documents_org_status", "organization_id", "processing_status"),
        Index("ix_documents_org_hash", "organization_id", "sha256_hash"),
        Index("ix_documents_category", "organization_id", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=True, index=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="supporting_evidence")
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    is_current_version: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    malware_scan_status: Mapped[str] = mapped_column(String(32), default="clean", nullable=False)  # pending, clean, infected, skipped
    malware_scan_details: Mapped[str | None] = mapped_column(String(255), nullable=True)

    processing_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, processing, completed, failed, needs_review
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # CRITICAL REQUIREMENT: Verification status is strictly distinct from processing status!
    verification_status: Mapped[str] = mapped_column(String(32), default="unverified", nullable=False)  # unverified, under_review, verified, rejected
    verified_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    detected_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ocr_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="documents")
    case: Mapped[ImmigrationCase | None] = relationship(back_populates="documents")
    client: Mapped[ClientProfile | None] = relationship(back_populates="documents")
    uploaded_by: Mapped[User | None] = relationship(foreign_keys=[uploaded_by_user_id])
    verified_by: Mapped[User | None] = relationship(foreign_keys=[verified_by_user_id])
    extracted_fields: Mapped[list["DocumentExtractedField"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    processing_runs: Mapped[list["DocumentProcessingRun"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentUploadSession(Base):
    __tablename__ = "document_upload_sessions"
    __table_args__ = (
        Index("ix_upload_sessions_org_key", "organization_id", "idempotency_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    expected_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    expected_mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    expected_byte_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="initiated", nullable=False)  # initiated, completed, expired, failed
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class DocumentExtractedField(Base):
    __tablename__ = "document_extracted_fields"
    __table_args__ = (
        Index("ix_extracted_fields_doc", "document_id", "field_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    field_name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. passport_number, date_of_birth
    field_label: Mapped[str] = mapped_column(String(150), nullable=False)
    original_value: Mapped[str] = mapped_column(Text, nullable=False)  # Raw unnormalized value as extracted
    normalized_value: Mapped[str | None] = mapped_column(Text, nullable=True)  # Normalized representation (ISO format)

    source_page: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source_location: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Bounding box coordinates

    extraction_method: Mapped[str] = mapped_column(String(64), nullable=False, default="native_pdf_text")  # native_pdf_text, ocr_tesseract, pattern_heuristic, layout_parser
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    extraction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    validation_status: Mapped[str] = mapped_column(String(32), default="unvalidated", nullable=False)  # unvalidated, valid, flagged, corrected

    is_manually_corrected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    corrected_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    correction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    correction_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    document: Mapped[Document] = relationship(back_populates="extracted_fields")
    corrected_by: Mapped[User | None] = relationship(foreign_keys=[corrected_by_user_id])


class DocumentProcessingRun(Base):
    __tablename__ = "document_processing_runs"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_processing_run_org_idempotency"),
        Index("ix_processing_runs_org_status", "organization_id", "status"),
        Index("ix_processing_runs_doc_stage", "document_id", "stage"),
        Index("ix_processing_runs_org_doc", "organization_id", "document_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    run_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(32), default="queued", nullable=False)  # queued, preprocessing, ocr, classification, extraction, evaluating, completed, failed
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False)  # queued, processing, completed, failed, cancelled
    trigger_type: Mapped[str] = mapped_column(String(32), default="upload", nullable=False)  # upload, reprocess, manual_retry
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="processing_runs")
    document: Mapped[Document] = relationship(back_populates="processing_runs")


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        Index("ix_outbox_org_status", "organization_id", "status"),
        Index("ix_outbox_status_created", "status", "created_at"),
        Index("ix_outbox_agg", "aggregate_type", "aggregate_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    event_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. document.processing.requested, document.processed
    aggregate_type: Mapped[str] = mapped_column(String(64), nullable=False)  # document, case, client
    aggregate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, published, failed
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="outbox_events")


class CaseAIFinding(Base):
    __tablename__ = "case_ai_findings"
    __table_args__ = (
        Index("ix_ai_findings_case_severity", "case_id", "severity"),
        Index("ix_ai_findings_case_status", "case_id", "status"),
        Index("ix_ai_findings_org_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)

    finding_type: Mapped[str] = mapped_column(String(64), nullable=False)  # consistency_discrepancy, document_quality, form_conflict, missing_checklist_evidence, statutory_evidence_gap, unclear_information
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="major")  # critical, major, minor, informational
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="needs_review")  # needs_review, unable_to_determine, resolved, dismissed

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_location: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {document_id, document_title, page, bounding_box, field_name}
    related_documents: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # [{id, title, version}]
    related_fields: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # ["passport_number", "ds160_number"]
    relevant_requirement: Mapped[str | None] = mapped_column(String(255), nullable=True)

    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    clarification_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    uncertainty_limitations: Mapped[str] = mapped_column(Text, nullable=False)

    linked_task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("case_tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    rule_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_confirmed_contradiction: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_action: Mapped[str | None] = mapped_column(String(32), nullable=True)  # resolve, dismiss, escalate
    resolution_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    case: Mapped[ImmigrationCase] = relationship(back_populates="ai_findings")
    document: Mapped[Document | None] = relationship()
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewer_id])
    linked_task: Mapped[CaseTask | None] = relationship()


class OfficialSource(Base):
    __tablename__ = "official_sources"
    __table_args__ = (
        Index("ix_official_sources_org_jurisdiction", "organization_id", "jurisdiction"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    jurisdiction: Mapped[str] = mapped_column(String(3), nullable=False)  # US, CA, GB, AU, NZ, DE, RU
    authority: Mapped[str] = mapped_column(String(120), nullable=False)  # USCIS, DOS, IRCC, UKVI, etc.
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    scope_limitations: Mapped[str] = mapped_column(Text, nullable=False)
    last_retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="official_sources")
    snapshots: Mapped[list["SourceSnapshot"]] = relationship(back_populates="source", cascade="all, delete-orphan")


class SourceSnapshot(Base):
    __tablename__ = "source_snapshots"
    __table_args__ = (
        Index("ix_source_snapshots_source_time", "source_id", "retrieval_timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("official_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    retrieval_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    publication_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False)
    snapshot_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    source: Mapped[OfficialSource] = relationship(back_populates="snapshots")
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_user_id])


class RuleSet(Base):
    __tablename__ = "rule_sets"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_ruleset_org_code"),
        Index("ix_rulesets_org_pathway", "organization_id", "jurisdiction", "program_pathway"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    jurisdiction: Mapped[str] = mapped_column(String(3), nullable=False)
    authority: Mapped[str] = mapped_column(String(120), nullable=False)
    program_pathway: Mapped[str] = mapped_column(String(100), nullable=False)  # EB-1A, O-1A, Skilled Worker
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="rule_sets")
    versions: Mapped[list["RuleSetVersion"]] = relationship(back_populates="rule_set", cascade="all, delete-orphan", foreign_keys="RuleSetVersion.rule_set_id")


class RuleSetVersion(Base):
    __tablename__ = "rule_set_versions"
    __table_args__ = (
        UniqueConstraint("rule_set_id", "version_number", name="uq_ruleset_version_number"),
        Index("ix_ruleset_versions_status", "rule_set_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rule_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g., "1.0.0"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")  # draft, under_review, validated, published, superseded, suspended
    official_source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("official_sources.id", ondelete="SET NULL"), nullable=True, index=True)
    source_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    publication_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    rule_set: Mapped[RuleSet] = relationship(back_populates="versions", foreign_keys=[rule_set_id])
    official_source: Mapped[OfficialSource | None] = relationship()
    source_snapshot: Mapped[SourceSnapshot | None] = relationship()
    author: Mapped[User | None] = relationship(foreign_keys=[author_user_id])
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_user_id])
    requirements: Mapped[list["RuleRequirement"]] = relationship(back_populates="rule_set_version", cascade="all, delete-orphan")


class RuleRequirement(Base):
    __tablename__ = "rule_requirements"
    __table_args__ = (
        UniqueConstraint("rule_set_version_id", "code", name="uq_req_version_code"),
        Index("ix_requirements_version_cat", "rule_set_version_id", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_set_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rule_set_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)  # statutory_criteria, mandatory_identity, health_clearance, etc.
    statutory_citation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    applicability_conditions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    accepted_evidence_types: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    validation_rules: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    review_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocking_dependencies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    rule_set_version: Mapped[RuleSetVersion] = relationship(back_populates="requirements")


class CaseRequirementEvaluation(Base):
    __tablename__ = "case_requirement_evaluations"
    __table_args__ = (
        Index("ix_case_eval_case_time", "case_id", "evaluated_at"),
        Index("ix_case_eval_version", "rule_set_version_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_set_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rule_set_versions.id", ondelete="RESTRICT"), nullable=False, index=True)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    evaluator_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # complete, missing, needs_review, unknown, not_applicable, expired, blocked
    overall_fulfillment_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    requirement_results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_superseded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    case: Mapped[ImmigrationCase] = relationship(back_populates="requirement_evaluations")
    rule_set_version: Mapped[RuleSetVersion] = relationship()
    evaluator: Mapped[User | None] = relationship(foreign_keys=[evaluator_user_id])


class DocumentRequest(Base):
    __tablename__ = "document_requests"
    __table_args__ = (
        Index("ix_doc_requests_org_case", "organization_id", "case_id"),
        Index("ix_doc_requests_status", "organization_id", "status"),
        Index("ix_doc_requests_client", "organization_id", "requested_from_client_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    requested_from_client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    dependant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("client_dependants.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="supporting_evidence")
    rationale: Mapped[str] = mapped_column(Text, nullable=False)  # Why it is requested
    statutory_requirement_code: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., EB1A-CRIT-AWARDS
    accepted_formats: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # ["application/pdf", "image/png", "image/jpeg"]
    acceptable_alternatives: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    translation_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)  # Certified English translation instructions

    status: Mapped[str] = mapped_column(String(32), default="requested", nullable=False)  # draft, requested, submitted, under_review, approved, rejected, cancelled
    fulfilled_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # [{status, changed_by, timestamp, notes}]

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    case: Mapped[ImmigrationCase] = relationship(back_populates="document_requests")
    requested_by: Mapped[User | None] = relationship(foreign_keys=[requested_by_user_id])
    client: Mapped[ClientProfile] = relationship(back_populates="document_requests")
    dependant: Mapped[ClientDependant | None] = relationship()
    fulfilled_document: Mapped[Document | None] = relationship()
    comments: Mapped[list["DocumentRequestComment"]] = relationship(back_populates="request", cascade="all, delete-orphan")


class DocumentRequestComment(Base):
    __tablename__ = "document_request_comments"
    __table_args__ = (
        Index("ix_doc_req_comments_req", "request_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    request: Mapped[DocumentRequest] = relationship(back_populates="comments")
    user: Mapped[User] = relationship()


class MessageThread(Base):
    __tablename__ = "message_threads"
    __table_args__ = (
        Index("ix_threads_org_case", "organization_id", "case_id"),
        Index("ix_threads_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    thread_type: Mapped[str] = mapped_column(String(64), default="general", nullable=False)  # client_inquiry, case_update, document_request, general
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)  # open, resolved, archived
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    case: Mapped[ImmigrationCase] = relationship(back_populates="message_threads")
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_user_id])
    messages: Mapped[list["Message"]] = relationship(back_populates="thread", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_thread_time", "thread_id", "created_at"),
        Index("ix_messages_internal", "thread_id", "is_internal"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    thread_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("message_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # STRICT PRIVACY & PERMISSION: If is_internal is True, this message is STAFF ONLY.
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attachment_document_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    delivery_status: Mapped[str] = mapped_column(String(32), default="sent", nullable=False)  # pending, sent, delivered, failed
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    thread: Mapped[MessageThread] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship()


class ClientQuestionnaire(Base):
    __tablename__ = "client_questionnaires"
    __table_args__ = (
        Index("ix_questionnaires_client_status", "client_id", "status"),
        Index("ix_questionnaires_case", "case_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="in_progress", nullable=False)  # in_progress, submitted, under_review, reviewed, locked
    sections_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    responses_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    client: Mapped[ClientProfile] = relationship(back_populates="questionnaires")
    case: Mapped[ImmigrationCase | None] = relationship(back_populates="questionnaires")
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_user_id])


# --- Phase 8 Application Forms, Readiness Checks & Package Builder ---


class FormSchema(Base):
    __tablename__ = "form_schemas"
    __table_args__ = (
        UniqueConstraint("organization_id", "form_code", name="uq_form_schema_org_code"),
        Index("ix_form_schemas_jurisdiction_pathway", "organization_id", "jurisdiction", "pathway"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    form_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # e.g. USCIS_I140, USCIS_G28, USCIS_I485, IRCC_IMM0008, UKVI_SKILLED_WORKER
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(3), nullable=False)  # US, CA, GB, AU
    pathway: Mapped[str] = mapped_column(String(64), nullable=False)  # EB-1A, NIW, O-1A, Express Entry, Global Talent
    edition_date: Mapped[str | None] = mapped_column(String(32), nullable=True)  # e.g. 12/01/25
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)  # draft, active, deprecated
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="form_schemas")
    versions: Mapped[list["FormSchemaVersion"]] = relationship(back_populates="schema", cascade="all, delete-orphan")


class FormSchemaVersion(Base):
    __tablename__ = "form_schema_versions"
    __table_args__ = (
        UniqueConstraint("schema_id", "version_number", name="uq_form_schema_version_num"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schema_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("form_schemas.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. v2026.1
    schema_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # sections, fields, validations, conditionals, sensitivity
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    schema: Mapped[FormSchema] = relationship(back_populates="versions")
    submissions: Mapped[list["FormSubmission"]] = relationship(back_populates="schema_version")


class FormSubmission(Base):
    __tablename__ = "form_submissions"
    __table_args__ = (
        Index("ix_form_sub_case", "case_id"),
        Index("ix_form_sub_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    form_schema_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("form_schema_versions.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)  # draft, in_review, confirmed, approved, rejected
    # answers_json maps field_key -> {value, source_type, source_id, source_label, is_confirmed, confirmed_by_user_id, confirmed_at}
    answers_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    has_unconfirmed_ai_fields: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sensitive_fields_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reviewer_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    revision_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # [{revision, updated_by, timestamp, changes_summary}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    case: Mapped[ImmigrationCase] = relationship(back_populates="form_submissions")
    schema_version: Mapped[FormSchemaVersion] = relationship(back_populates="submissions")
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewer_user_id])


class PackageTemplate(Base):
    __tablename__ = "package_templates"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_package_template_org_name"),
        Index("ix_pkg_templates_jur_pathway", "organization_id", "jurisdiction", "pathway"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g. USCIS Standard Immigrant Petition Assembly
    jurisdiction: Mapped[str] = mapped_column(String(3), nullable=False)  # US, CA, GB, AU
    pathway: Mapped[str] = mapped_column(String(64), nullable=False)  # EB-1A, NIW, O-1A, Express Entry
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    folder_structure: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="package_templates")
    packages: Mapped[list["FilingPackage"]] = relationship(back_populates="template")


class FilingPackage(Base):
    __tablename__ = "filing_packages"
    __table_args__ = (
        Index("ix_packages_case", "case_id"),
        Index("ix_packages_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    package_template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("package_templates.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version_number: Mapped[str] = mapped_column(String(32), default="v1.0.0", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)  # draft, readiness_passed, in_review, senior_review, client_confirmed, approved, locked, rejected
    readiness_checklist_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    manifest_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    package_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256 root hash of manifest
    rule_set_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("rule_set_versions.id", ondelete="SET NULL"), nullable=True, index=True)
    approval_chain_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submission_method: Mapped[str] = mapped_column(String(64), default="manual_filing", nullable=False)  # manual_filing, lockbox_assembly, verified_official_api
    submission_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship()
    case: Mapped[ImmigrationCase] = relationship(back_populates="filing_packages")
    template: Mapped[PackageTemplate | None] = relationship(back_populates="packages")
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_user_id])
    rule_set_version: Mapped["RuleSetVersion | None"] = relationship()


class ServiceItem(Base):
    __tablename__ = "service_items"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_service_org_code"),
        Index("ix_services_org_jur", "organization_id", "jurisdiction"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. EB1A_FULL, NIW_PETITION, O1A_EXTRAORDINARY
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    jurisdiction: Mapped[str] = mapped_column(String(3), nullable=False, default="US")
    visa_category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pricing_model: Mapped[str] = mapped_column(String(32), default="fixed", nullable=False)  # fixed, hourly, milestone
    base_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    estimated_duration_days: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="service_items")


class ClientEngagement(Base):
    __tablename__ = "client_engagements"
    __table_args__ = (
        UniqueConstraint("organization_id", "engagement_number", name="uq_engagement_org_number"),
        Index("ix_engagements_org_client", "organization_id", "client_id"),
        Index("ix_engagements_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("immigration_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("service_items.id", ondelete="SET NULL"), nullable=True, index=True)
    engagement_number: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)  # draft, active, completed, terminated
    retainer_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    agreed_fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    billing_terms: Mapped[str] = mapped_column(String(64), default="fixed_split", nullable=False)  # fixed_split, upfront, milestone, hourly
    responsible_attorney_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    signed_agreement_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="client_engagements")
    client: Mapped[ClientProfile] = relationship(back_populates="engagements")
    case: Mapped[ImmigrationCase | None] = relationship(back_populates="engagements")
    service: Mapped[ServiceItem | None] = relationship()
    responsible_attorney: Mapped[User | None] = relationship()
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="engagement")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("organization_id", "invoice_number", name="uq_invoice_org_number"),
        Index("ix_invoices_org_client", "organization_id", "client_id"),
        Index("ix_invoices_status", "organization_id", "status"),
        Index("ix_invoices_due_date", "organization_id", "due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("immigration_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    engagement_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("client_engagements.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False)
    issue_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    balance_due: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)  # draft, issued, partially_paid, paid, overdue, void, refunded
    payment_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)  # stripe_verified, manual_wire, check, ach
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="invoices")
    client: Mapped[ClientProfile] = relationship(back_populates="invoices")
    case: Mapped[ImmigrationCase | None] = relationship(back_populates="invoices")
    engagement: Mapped[ClientEngagement | None] = relationship(back_populates="invoices")
    line_items: Mapped[list["InvoiceLineItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["PaymentRecord"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("service_items.id", ondelete="SET NULL"), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    line_type: Mapped[str] = mapped_column(String(32), default="service_fee", nullable=False)  # service_fee, filing_fee, translation, courier, discount

    invoice: Mapped[Invoice] = relationship(back_populates="line_items")
    service: Mapped[ServiceItem | None] = relationship()


class PaymentRecord(Base):
    __tablename__ = "payment_records"
    __table_args__ = (
        Index("ix_payments_org_inv", "organization_id", "invoice_id"),
        Index("ix_payments_status", "organization_id", "status"),
        Index("ix_payments_date", "organization_id", "payment_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_reference: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(64), default="credit_card_tokenized", nullable=False)  # credit_card_tokenized, ach_bank_transfer, wire_transfer, check
    status: Mapped[str] = mapped_column(String(32), default="succeeded", nullable=False)  # succeeded, pending, failed, refunded, partially_refunded
    refunded_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    provider_charge_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    card_brand: Mapped[str | None] = mapped_column(String(32), nullable=True)  # visa, mastercard, amex (NO raw card PAN stored!)
    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)  # e.g. 4242
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="payment_records")
    invoice: Mapped[Invoice] = relationship(back_populates="payments")
    client: Mapped[ClientProfile] = relationship()


class OrganizationSetting(Base):
    __tablename__ = "organization_settings"
    __table_args__ = (
        UniqueConstraint("organization_id", "setting_key", name="uq_org_setting_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    setting_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    setting_value_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="settings")
    updated_by: Mapped[User | None] = relationship()
