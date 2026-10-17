"""phase4_upload_intake_and_lifecycle

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-10-17 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update immigration_cases with inactivity and post-download retention
    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.add_column(sa.Column("last_client_activity_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("inactivity_warning_level", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("post_download_retention_policy", sa.String(32), server_default="seven_days", nullable=False))

    # 2. Update documents with proposed assignment, boundaries, purge and anomaly tracking
    with op.batch_alter_table("documents") as batch_op:
        batch_op.add_column(sa.Column("proposed_category", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("proposed_applicant_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("is_assignment_confirmed", sa.Boolean(), server_default=sa.text("true"), nullable=False))
        batch_op.add_column(sa.Column("assignment_confirmed_by_id", sa.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column("sub_documents_metadata", sa.JSON(), server_default="[]", nullable=False))
        batch_op.add_column(sa.Column("is_purged", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        batch_op.add_column(sa.Column("purged_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("has_unresolved_anomaly", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        batch_op.add_column(sa.Column("anomaly_notes", sa.Text(), nullable=True))

    # 3. Update package_download_events with verification and post-download purge tracking
    with op.batch_alter_table("package_download_events") as batch_op:
        batch_op.add_column(sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        batch_op.add_column(sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("client_verification_payload", sa.JSON(), server_default="{}", nullable=False))
        batch_op.add_column(sa.Column("post_download_purge_scheduled_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("post_download_purged_at", sa.DateTime(timezone=True), nullable=True))

    # 4. Create case_interim_reports table
    op.create_table(
        "case_interim_reports",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("case_id", sa.UUID(as_uuid=True), sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_by_user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("trigger_action", sa.String(64), nullable=False),
        sa.Column("report_title", sa.String(255), nullable=False),
        sa.Column("manifest_snapshot_json", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("ocr_summary_json", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("anomaly_report_json", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("download_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_downloaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_case_interim_reports_case", "case_interim_reports", ["organization_id", "case_id"])
    op.create_index("ix_case_interim_reports_created", "case_interim_reports", ["organization_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_case_interim_reports_created", table_name="case_interim_reports")
    op.drop_index("ix_case_interim_reports_case", table_name="case_interim_reports")
    op.drop_table("case_interim_reports")

    with op.batch_alter_table("package_download_events") as batch_op:
        batch_op.drop_column("post_download_purged_at")
        batch_op.drop_column("post_download_purge_scheduled_at")
        batch_op.drop_column("client_verification_payload")
        batch_op.drop_column("verified_at")
        batch_op.drop_column("is_verified")

    with op.batch_alter_table("documents") as batch_op:
        batch_op.drop_column("anomaly_notes")
        batch_op.drop_column("has_unresolved_anomaly")
        batch_op.drop_column("purged_at")
        batch_op.drop_column("is_purged")
        batch_op.drop_column("sub_documents_metadata")
        batch_op.drop_column("assignment_confirmed_by_id")
        batch_op.drop_column("is_assignment_confirmed")
        batch_op.drop_column("proposed_applicant_name")
        batch_op.drop_column("proposed_category")

    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.drop_column("post_download_retention_policy")
        batch_op.drop_column("inactivity_warning_level")
        batch_op.drop_column("last_client_activity_at")
