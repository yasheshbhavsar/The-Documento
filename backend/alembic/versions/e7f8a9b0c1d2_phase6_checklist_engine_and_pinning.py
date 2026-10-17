"""phase6_checklist_engine_and_pinning

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-10-17 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Update rule_requirements table with Phase 6 statutory metadata
    with op.batch_alter_table("rule_requirements") as batch_op:
        batch_op.add_column(sa.Column("requirement_key", sa.String(128), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(32), server_default="DRAFT_UNVERIFIED", nullable=False))
        batch_op.add_column(sa.Column("source_url", sa.String(1024), nullable=True))
        batch_op.add_column(sa.Column("effective_from", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("effective_to", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("approved_by", sa.String(255), nullable=True))
        batch_op.create_index("ix_rule_requirements_key", ["requirement_key"])

    # 2. Update immigration_cases with pinned checklist snapshot and change control fields
    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.add_column(sa.Column("pinned_rule_version_id", uuid_type, nullable=True))
        batch_op.add_column(sa.Column("pinned_checklist_snapshot", json_type, server_default="{}", nullable=False))
        batch_op.add_column(sa.Column("snapshot_pinned_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("rules_update_available", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        batch_op.add_column(sa.Column("latest_available_version_id", uuid_type, nullable=True))
        batch_op.create_index("ix_cases_pinned_rule_version", ["pinned_rule_version_id"])


def downgrade() -> None:
    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.drop_index("ix_cases_pinned_rule_version")
        batch_op.drop_column("latest_available_version_id")
        batch_op.drop_column("rules_update_available")
        batch_op.drop_column("snapshot_pinned_at")
        batch_op.drop_column("pinned_checklist_snapshot")
        batch_op.drop_column("pinned_rule_version_id")

    with op.batch_alter_table("rule_requirements") as batch_op:
        batch_op.drop_index("ix_rule_requirements_key")
        batch_op.drop_column("approved_by")
        batch_op.drop_column("last_verified_at")
        batch_op.drop_column("effective_to")
        batch_op.drop_column("effective_from")
        batch_op.drop_column("source_url")
        batch_op.drop_column("status")
        batch_op.drop_column("requirement_key")
