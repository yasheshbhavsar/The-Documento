"""phase2_decoupled_case_lifecycle

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-10-17 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Update immigration_cases with decoupled lifecycle fields
    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.add_column(sa.Column("payment_clearance_status", sa.String(32), nullable=False, server_default="PENDING"))
        batch_op.add_column(sa.Column("preparation_status", sa.String(32), nullable=False, server_default="CLEARANCE_PENDING"))
        batch_op.add_column(sa.Column("operational_state", sa.String(32), nullable=False, server_default="ACTIVE"))
        batch_op.add_column(sa.Column("review_status", sa.String(32), nullable=False, server_default="NOT_STARTED"))
        batch_op.add_column(sa.Column("outcome_status", sa.String(32), nullable=True))
        batch_op.add_column(sa.Column("hold_reason", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("hold_applied_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("hold_applied_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_case_hold_applied_by"), nullable=True))
        batch_op.add_column(sa.Column("prior_case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="SET NULL", name="fk_case_prior_case"), nullable=True))
        batch_op.add_column(sa.Column("reapplication_reason", sa.String(255), nullable=True))

    op.create_index("ix_cases_prep_status", "immigration_cases", ["organization_id", "preparation_status"])
    op.create_index("ix_cases_operational_state", "immigration_cases", ["organization_id", "operational_state"])
    op.create_index("ix_cases_payment_clearance", "immigration_cases", ["organization_id", "payment_clearance_status"])

    # 2. Update documents with applicant dependant assignment
    with op.batch_alter_table("documents") as batch_op:
        batch_op.add_column(sa.Column("applicant_dependant_id", uuid_type, sa.ForeignKey("client_dependants.id", ondelete="SET NULL", name="fk_doc_applicant_dependant"), nullable=True))

    # 3. Update filing_packages with prior filing and reapplication type
    with op.batch_alter_table("filing_packages") as batch_op:
        batch_op.add_column(sa.Column("prior_filing_id", uuid_type, sa.ForeignKey("filing_packages.id", ondelete="SET NULL", name="fk_pkg_prior_filing"), nullable=True))
        batch_op.add_column(sa.Column("reapplication_type", sa.String(64), nullable=True))

    # 4. Create package_download_events
    op.create_table(
        "package_download_events",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("package_id", uuid_type, sa.ForeignKey("filing_packages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("downloaded_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("downloaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("package_hash_at_download", sa.String(64), nullable=False),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("manifest_snapshot_json", json_type, nullable=False),
    )
    op.create_index("ix_pkg_downloads_pkg", "package_download_events", ["organization_id", "package_id"])
    op.create_index("ix_pkg_downloads_time", "package_download_events", ["organization_id", "downloaded_at"])

    # 5. Create case_hold_history
    op.create_table(
        "case_hold_history",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hold_type", sa.String(64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("placed_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("released_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_case_holds_case", "case_hold_history", ["organization_id", "case_id"])
    op.create_index("ix_case_holds_placed_at", "case_hold_history", ["organization_id", "placed_at"])


def downgrade() -> None:
    op.drop_table("case_hold_history")
    op.drop_table("package_download_events")

    op.drop_index("ix_cases_payment_clearance", table_name="immigration_cases")
    op.drop_index("ix_cases_operational_state", table_name="immigration_cases")
    op.drop_index("ix_cases_prep_status", table_name="immigration_cases")

    with op.batch_alter_table("filing_packages") as batch_op:
        batch_op.drop_column("reapplication_type")
        batch_op.drop_column("prior_filing_id")

    with op.batch_alter_table("documents") as batch_op:
        batch_op.drop_column("applicant_dependant_id")

    with op.batch_alter_table("immigration_cases") as batch_op:
        batch_op.drop_column("reapplication_reason")
        batch_op.drop_column("prior_case_id")
        batch_op.drop_column("hold_applied_by_id")
        batch_op.drop_column("hold_applied_at")
        batch_op.drop_column("hold_reason")
        batch_op.drop_column("outcome_status")
        batch_op.drop_column("review_status")
        batch_op.drop_column("operational_state")
        batch_op.drop_column("preparation_status")
        batch_op.drop_column("payment_clearance_status")

