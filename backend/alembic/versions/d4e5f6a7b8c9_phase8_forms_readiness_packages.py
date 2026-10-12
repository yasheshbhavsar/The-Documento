"""phase8_forms_readiness_packages

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-11 21:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Form Schemas
    op.create_table(
        "form_schemas",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("form_code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("jurisdiction", sa.String(3), nullable=False),
        sa.Column("pathway", sa.String(64), nullable=False),
        sa.Column("edition_date", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "form_code", name="uq_form_schema_org_code"),
    )
    op.create_index("ix_form_schemas_org_code", "form_schemas", ["organization_id", "form_code"])
    op.create_index("ix_form_schemas_jurisdiction_pathway", "form_schemas", ["organization_id", "jurisdiction", "pathway"])

    # 2. Form Schema Versions
    op.create_table(
        "form_schema_versions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("schema_id", uuid_type, sa.ForeignKey("form_schemas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.String(32), nullable=False),
        sa.Column("schema_json", json_type, server_default="{}", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("schema_id", "version_number", name="uq_form_schema_version_num"),
    )
    op.create_index("ix_form_schema_versions_schema", "form_schema_versions", ["schema_id", "version_number"])

    # 3. Form Submissions
    op.create_table(
        "form_submissions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("form_schema_version_id", uuid_type, sa.ForeignKey("form_schema_versions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(32), server_default="draft", nullable=False),
        sa.Column("answers_json", json_type, server_default="{}", nullable=False),
        sa.Column("completion_percentage", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("has_unconfirmed_ai_fields", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("sensitive_fields_reviewed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("reviewer_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("revision_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("revision_history", json_type, server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_form_sub_case", "form_submissions", ["case_id"])
    op.create_index("ix_form_sub_status", "form_submissions", ["organization_id", "status"])

    # 4. Package Templates
    op.create_table(
        "package_templates",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("jurisdiction", sa.String(3), nullable=False),
        sa.Column("pathway", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("folder_structure", json_type, server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "name", name="uq_package_template_org_name"),
    )
    op.create_index("ix_pkg_templates_jur_pathway", "package_templates", ["organization_id", "jurisdiction", "pathway"])

    # 5. Filing Packages
    op.create_table(
        "filing_packages",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("package_template_id", uuid_type, sa.ForeignKey("package_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version_number", sa.String(32), server_default="v1.0.0", nullable=False),
        sa.Column("status", sa.String(32), server_default="draft", nullable=False),
        sa.Column("readiness_checklist_json", json_type, server_default="{}", nullable=False),
        sa.Column("manifest_json", json_type, server_default="{}", nullable=False),
        sa.Column("package_hash", sa.String(64), nullable=True),
        sa.Column("rule_set_version_id", uuid_type, sa.ForeignKey("rule_set_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approval_chain_json", json_type, server_default="[]", nullable=False),
        sa.Column("approved_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submission_method", sa.String(64), server_default="manual_filing", nullable=False),
        sa.Column("submission_instructions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_packages_case", "filing_packages", ["case_id"])
    op.create_index("ix_packages_status", "filing_packages", ["organization_id", "status"])


def downgrade() -> None:
    op.drop_table("filing_packages")
    op.drop_table("package_templates")
    op.drop_table("form_submissions")
    op.drop_table("form_schema_versions")
    op.drop_table("form_schemas")
