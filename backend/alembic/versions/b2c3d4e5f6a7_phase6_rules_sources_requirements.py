"""phase6_rules_sources_requirements

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-11 18:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Official Sources
    op.create_table(
        "official_sources",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jurisdiction", sa.String(3), nullable=False),
        sa.Column("authority", sa.String(120), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("scope_limitations", sa.Text(), nullable=False),
        sa.Column("last_retrieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_official_sources_org_jurisdiction", "official_sources", ["organization_id", "jurisdiction"])

    # 2. Source Snapshots
    op.create_table(
        "source_snapshots",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_id", uuid_type, sa.ForeignKey("official_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("retrieval_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("publication_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("raw_content", sa.Text(), nullable=False),
        sa.Column("snapshot_metadata", json_type, nullable=False),
        sa.Column("created_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_source_snapshots_source_time", "source_snapshots", ["source_id", "retrieval_timestamp"])

    # 3. Rule Sets
    op.create_table(
        "rule_sets",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jurisdiction", sa.String(3), nullable=False),
        sa.Column("authority", sa.String(120), nullable=False),
        sa.Column("program_pathway", sa.String(100), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("current_version_id", uuid_type, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "code", name="uq_ruleset_org_code"),
    )
    op.create_index("ix_rulesets_org_pathway", "rule_sets", ["organization_id", "jurisdiction", "program_pathway"])

    # 4. Rule Set Versions
    op.create_table(
        "rule_set_versions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_set_id", uuid_type, sa.ForeignKey("rule_sets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("official_source_id", uuid_type, sa.ForeignKey("official_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_snapshot_id", uuid_type, sa.ForeignKey("source_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("publication_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column("author_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_history", json_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rule_set_id", "version_number", name="uq_ruleset_version_number"),
    )
    op.create_index("ix_ruleset_versions_status", "rule_set_versions", ["rule_set_id", "status"])

    # 5. Rule Requirements
    op.create_table(
        "rule_requirements",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_set_version_id", uuid_type, sa.ForeignKey("rule_set_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("statutory_citation", sa.String(255), nullable=True),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("applicability_conditions", json_type, nullable=False),
        sa.Column("accepted_evidence_types", json_type, nullable=False),
        sa.Column("validation_rules", json_type, nullable=False),
        sa.Column("requires_human_review", sa.Boolean(), nullable=False),
        sa.Column("review_guidance", sa.Text(), nullable=True),
        sa.Column("blocking_dependencies", json_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rule_set_version_id", "code", name="uq_req_version_code"),
    )
    op.create_index("ix_requirements_version_cat", "rule_requirements", ["rule_set_version_id", "category"])

    # 6. Case Requirement Evaluations
    op.create_table(
        "case_requirement_evaluations",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_set_version_id", uuid_type, sa.ForeignKey("rule_set_versions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evaluator_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("overall_fulfillment_percentage", sa.Float(), nullable=False),
        sa.Column("requirement_results", json_type, nullable=False),
        sa.Column("is_superseded", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_case_eval_case_time", "case_requirement_evaluations", ["case_id", "evaluated_at"])
    op.create_index("ix_case_eval_version", "case_requirement_evaluations", ["rule_set_version_id"])


def downgrade() -> None:
    op.drop_table("case_requirement_evaluations")
    op.drop_table("rule_requirements")
    op.drop_table("rule_set_versions")
    op.drop_table("rule_sets")
    op.drop_table("source_snapshots")
    op.drop_table("official_sources")
