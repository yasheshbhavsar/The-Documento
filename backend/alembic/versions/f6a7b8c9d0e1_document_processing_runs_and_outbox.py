"""document_processing_runs_and_outbox

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-13 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Document Processing Runs Table
    op.create_table(
        "document_processing_runs",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", uuid_type, sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("stage", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("trigger_type", sa.String(32), nullable=False, server_default="upload"),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metrics", json_type, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_processing_run_org_idempotency"),
    )
    op.create_index("ix_processing_runs_org_id", "document_processing_runs", ["organization_id"])
    op.create_index("ix_processing_runs_doc_id", "document_processing_runs", ["document_id"])
    op.create_index("ix_processing_runs_org_status", "document_processing_runs", ["organization_id", "status"])
    op.create_index("ix_processing_runs_doc_stage", "document_processing_runs", ["document_id", "stage"])
    op.create_index("ix_processing_runs_org_doc", "document_processing_runs", ["organization_id", "document_id"])
    op.create_index("ix_processing_runs_idempotency_key", "document_processing_runs", ["idempotency_key"])

    # 2. Outbox Events Table
    op.create_table(
        "outbox_events",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("aggregate_type", sa.String(64), nullable=False),
        sa.Column("aggregate_id", uuid_type, nullable=False),
        sa.Column("payload", json_type, nullable=False, server_default="{}"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_outbox_org_id", "outbox_events", ["organization_id"])
    op.create_index("ix_outbox_org_status", "outbox_events", ["organization_id", "status"])
    op.create_index("ix_outbox_status_created", "outbox_events", ["status", "created_at"])
    op.create_index("ix_outbox_agg", "outbox_events", ["aggregate_type", "aggregate_id"])


def downgrade() -> None:
    op.drop_index("ix_outbox_agg", table_name="outbox_events")
    op.drop_index("ix_outbox_status_created", table_name="outbox_events")
    op.drop_index("ix_outbox_org_status", table_name="outbox_events")
    op.drop_index("ix_outbox_org_id", table_name="outbox_events")
    op.drop_table("outbox_events")

    op.drop_index("ix_processing_runs_idempotency_key", table_name="document_processing_runs")
    op.drop_index("ix_processing_runs_org_doc", table_name="document_processing_runs")
    op.drop_index("ix_processing_runs_doc_stage", table_name="document_processing_runs")
    op.drop_index("ix_processing_runs_org_status", table_name="document_processing_runs")
    op.drop_index("ix_processing_runs_doc_id", table_name="document_processing_runs")
    op.drop_index("ix_processing_runs_org_id", table_name="document_processing_runs")
    op.drop_table("document_processing_runs")
