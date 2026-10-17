"""phase11_reliability_security_operations

Revision ID: g1a2b3c4d5e6
Revises: f5e6a7b8c9d1
Create Date: 2026-10-17 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'f5e6a7b8c9d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Create completed_application_summaries table
    op.create_table(
        "completed_application_summaries",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_number", sa.String(64), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("visa_category", sa.String(64), nullable=False),
        sa.Column("jurisdiction", sa.String(32), server_default="US", nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completion_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_officer_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_officer_name", sa.String(255), nullable=False),
        sa.Column("assigned_officer_email", sa.String(255), nullable=False),
        sa.Column("assigned_officer_role", sa.String(64), server_default="lead_attorney", nullable=False),
        sa.Column("adjudication_outcome", sa.String(64), server_default="APPROVED", nullable=False),
        sa.Column("official_reference_number", sa.String(128), nullable=True),
        sa.Column("cleanup_executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("purged_files_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_comp_app_org_case", "completed_application_summaries", ["organization_id", "case_id"])
    op.create_index("ix_comp_app_completed_at", "completed_application_summaries", ["organization_id", "completion_date"])

    # 2. Create case_withdrawal_tombstones table
    op.create_table(
        "case_withdrawal_tombstones",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_number", sa.String(64), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_address", sa.String(500), nullable=True),
        sa.Column("client_contact_phone", sa.String(64), nullable=True),
        sa.Column("client_email", sa.String(255), nullable=False),
        sa.Column("intended_application_type", sa.String(64), nullable=False),
        sa.Column("jurisdiction", sa.String(32), server_default="US", nullable=False),
        sa.Column("executed_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("executed_by_name", sa.String(255), nullable=False),
        sa.Column("withdrawal_reason", sa.Text(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pre_withdrawal_state_snapshot_json", json_type, server_default="{}", nullable=False),
        sa.Column("formal_authority_withdrawal_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("formal_authority_status", sa.String(64), server_default="not_applicable", nullable=False),
        sa.Column("formal_authority_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_withdrawn_org_case", "case_withdrawal_tombstones", ["organization_id", "case_id"])
    op.create_index("ix_withdrawn_date", "case_withdrawal_tombstones", ["organization_id", "executed_at"])

    # 3. Create firm_export_requests table
    op.create_table(
        "firm_export_requests",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(32), server_default="pending", nullable=False),
        sa.Column("export_type", sa.String(32), server_default="self_service", nullable=False),
        sa.Column("contractual_entitlement_verified", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("archive_url", sa.String(500), nullable=True),
        sa.Column("archive_sha256", sa.String(64), nullable=True),
        sa.Column("archive_size_bytes", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("support_ticket_id", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_firm_export_org", "firm_export_requests", ["organization_id", "status"])

    # 4. Create privacy_legal_reviews table
    op.create_table(
        "privacy_legal_reviews",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("jurisdiction", sa.String(32), nullable=False, unique=True),
        sa.Column("market_name", sa.String(100), nullable=False),
        sa.Column("statutory_framework", sa.String(255), nullable=False),
        sa.Column("review_status", sa.String(32), server_default="approved", nullable=False),
        sa.Column("legal_counsel_signoff_by", sa.String(255), nullable=False),
        sa.Column("signoff_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mandatory_safeguards_json", json_type, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_privacy_reviews_jurisdiction", "privacy_legal_reviews", ["jurisdiction"])


def downgrade() -> None:
    op.drop_table("privacy_legal_reviews")
    op.drop_table("firm_export_requests")
    op.drop_table("case_withdrawal_tombstones")
    op.drop_table("completed_application_summaries")
