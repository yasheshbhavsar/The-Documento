"""phase9_firm_config_and_approval_gates

Revision ID: f5e6a7b8c9d1
Revises: e7f8a9b0c1d2
Create Date: 2026-10-17 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f5e6a7b8c9d1'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Create firm_configuration_audit_logs table
    op.create_table(
        "firm_configuration_audit_logs",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("config_domain", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("actor_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_email", sa.String(255), nullable=False),
        sa.Column("old_version_json", json_type, nullable=False, server_default="{}"),
        sa.Column("new_version_json", json_type, nullable=False, server_default="{}"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("effective_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_firm_config_org_domain", "firm_configuration_audit_logs", ["organization_id", "config_domain"])
    op.create_index("ix_firm_config_domain", "firm_configuration_audit_logs", ["config_domain"])

    # 2. Add Phase 9 columns to immigration_cases
    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.add_column(sa.Column("client_engagement_type", sa.String(32), server_default="retained", nullable=False))
        batch_op.add_column(sa.Column("is_retained", sa.Boolean(), server_default=sa.text("true"), nullable=False))
        batch_op.add_column(sa.Column("submission_authorization_status", sa.String(32), server_default="UNAUTHORIZED", nullable=False))
        batch_op.add_column(sa.Column("handover_authorization_status", sa.String(32), server_default="RESTRICTED", nullable=False))
        batch_op.add_column(sa.Column("substantive_authorizations", json_type, server_default="{}", nullable=False))
        batch_op.add_column(sa.Column("pinned_firm_config_snapshot", json_type, server_default="{}", nullable=False))
        batch_op.add_column(sa.Column("firm_config_version", sa.Integer(), server_default="1", nullable=False))
        batch_op.add_column(sa.Column("firm_config_update_available", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        batch_op.create_index("ix_cases_sub_auth_status", ["submission_authorization_status"])
        batch_op.create_index("ix_cases_is_retained", ["is_retained"])


def downgrade() -> None:
    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.drop_index("ix_cases_is_retained")
        batch_op.drop_index("ix_cases_sub_auth_status")
        batch_op.drop_column("firm_config_update_available")
        batch_op.drop_column("firm_config_version")
        batch_op.drop_column("pinned_firm_config_snapshot")
        batch_op.drop_column("substantive_authorizations")
        batch_op.drop_column("handover_authorization_status")
        batch_op.drop_column("submission_authorization_status")
        batch_op.drop_column("is_retained")
        batch_op.drop_column("client_engagement_type")

    op.drop_table("firm_configuration_audit_logs")
