"""sponsor_links_and_intake_sheet

Revision ID: k2b3c4d5e6f7
Revises: j1a2b3c4d5e6
Create Date: 2026-11-21 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "k2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "j1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

    op.create_table(
        "sponsor_contributor_links",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "organization_id",
            uuid_type,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case_id",
            uuid_type,
            sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("sponsor_role", sa.String(64), nullable=False),
        sa.Column("sponsor_name", sa.String(200), nullable=False),
        sa.Column("jurisdiction", sa.String(16), nullable=False, server_default="CA"),
        sa.Column("pathway", sa.String(64), nullable=False, server_default="CA-SUPER-VISA"),
        sa.Column("applicant_first_name", sa.String(120), nullable=False, server_default="Applicant"),
        sa.Column("privacy_shield", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("requested_items_json", json_type, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_by_user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sponsor_links_org_case", "sponsor_contributor_links", ["organization_id", "case_id"])
    op.create_index("ix_sponsor_links_token", "sponsor_contributor_links", ["token"], unique=True)
    op.create_index("ix_sponsor_links_expires", "sponsor_contributor_links", ["expires_at"])

    op.create_table(
        "sponsor_contribution_uploads",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "link_id",
            uuid_type,
            sa.ForeignKey("sponsor_contributor_links.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            uuid_type,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case_id",
            uuid_type,
            sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False, server_default="application/pdf"),
        sa.Column("category", sa.String(64), nullable=False, server_default="financial_evidence"),
        sa.Column("matched_item_id", sa.String(128), nullable=True),
        sa.Column("subtype_label", sa.String(200), nullable=False),
        sa.Column("statutory_badge", sa.String(255), nullable=True),
        sa.Column("storage_path", sa.String(500), nullable=True),
        sa.Column("sha256_hash", sa.String(64), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_private_to_firm", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("extracted_summary_json", json_type, nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sponsor_uploads_org_case", "sponsor_contribution_uploads", ["organization_id", "case_id"])
    op.create_index("ix_sponsor_uploads_link", "sponsor_contribution_uploads", ["link_id", "uploaded_at"])

    op.create_table(
        "client_intake_sheets",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "organization_id",
            uuid_type,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case_id",
            uuid_type,
            sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "client_id",
            uuid_type,
            sa.ForeignKey("client_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("payload_json", json_type, nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("completion_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "updated_by_user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_client_intake_org_case", "client_intake_sheets", ["organization_id", "case_id"])


def downgrade() -> None:
    op.drop_index("ix_client_intake_org_case", table_name="client_intake_sheets")
    op.drop_table("client_intake_sheets")

    op.drop_index("ix_sponsor_uploads_link", table_name="sponsor_contribution_uploads")
    op.drop_index("ix_sponsor_uploads_org_case", table_name="sponsor_contribution_uploads")
    op.drop_table("sponsor_contribution_uploads")

    op.drop_index("ix_sponsor_links_expires", table_name="sponsor_contributor_links")
    op.drop_index("ix_sponsor_links_token", table_name="sponsor_contributor_links")
    op.drop_index("ix_sponsor_links_org_case", table_name="sponsor_contributor_links")
    op.drop_table("sponsor_contributor_links")
