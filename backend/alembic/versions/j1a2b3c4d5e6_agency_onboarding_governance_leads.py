"""agency_onboarding_governance_leads

Revision ID: j1a2b3c4d5e6
Revises: i1a2b3c4d5e6
Create Date: 2026-11-04 19:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "j1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "i1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

    op.create_table(
        "agency_onboarding_applications",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("legal_entity_name", sa.String(220), nullable=False),
        sa.Column("trading_name", sa.String(200), nullable=False),
        sa.Column("requested_slug", sa.String(100), nullable=False),
        sa.Column("hq_country", sa.String(64), nullable=False),
        sa.Column("hq_city", sa.String(120), nullable=False),
        sa.Column("corporate_domain", sa.String(160), nullable=False),
        sa.Column("tax_registration_id", sa.String(80), nullable=False),
        sa.Column("contact_full_name", sa.String(200), nullable=False),
        sa.Column("contact_work_email", sa.String(320), nullable=False),
        sa.Column("contact_phone", sa.String(60), nullable=True),
        sa.Column("kyb_track", sa.String(40), nullable=False, server_default="regulated_counsel"),
        sa.Column("regulatory_body", sa.String(64), nullable=False),
        sa.Column("license_number", sa.String(100), nullable=False),
        sa.Column("co_counsel_details", sa.String(255), nullable=True),
        sa.Column("target_corridors_json", json_type, nullable=False),
        sa.Column("estimated_monthly_cases", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("requested_seats", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("branch_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("selected_plan_tier", sa.String(40), nullable=False, server_default="growth"),
        sa.Column("dpa_accepted", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("zero_training_accepted", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("kyb_status", sa.String(40), nullable=False, server_default="pending_kyb"),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by_email", sa.String(320), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "provisioned_organization_id",
            uuid_type,
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("activation_token_hash", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agency_onb_status", "agency_onboarding_applications", ["kyb_status"])
    op.create_index("ix_agency_onb_slug", "agency_onboarding_applications", ["requested_slug"])
    op.create_index("ix_agency_onb_email", "agency_onboarding_applications", ["contact_work_email"])

    op.create_table(
        "agency_tenant_governance",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "organization_id",
            uuid_type,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("trading_name", sa.String(200), nullable=False),
        sa.Column("plan_tier", sa.String(40), nullable=False, server_default="growth"),
        sa.Column("mrr_usd", sa.Float(), nullable=False, server_default="499.0"),
        sa.Column("billing_status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("kyb_track", sa.String(40), nullable=False, server_default="regulated_counsel"),
        sa.Column("regulatory_body", sa.String(64), nullable=False, server_default="CICC"),
        sa.Column("license_number", sa.String(100), nullable=False, server_default="VERIFIED"),
        sa.Column("hq_country", sa.String(64), nullable=False, server_default="CA"),
        sa.Column("hq_city", sa.String(120), nullable=False, server_default="Toronto"),
        sa.Column("seat_limit", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("monthly_case_quota", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("monthly_ai_extraction_quota", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("ai_extractions_used_30d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("calculator_leads_30d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled_corridors_json", json_type, nullable=False),
        sa.Column("feature_flags_json", json_type, nullable=False),
        sa.Column("branding_json", json_type, nullable=False),
        sa.Column("support_grant_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("support_grant_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agency_tenant_gov_org", "agency_tenant_governance", ["organization_id"])

    op.create_table(
        "calculator_agency_leads",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "organization_id",
            uuid_type,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("agency_slug", sa.String(100), nullable=False),
        sa.Column("applicant_name", sa.String(200), nullable=False),
        sa.Column("applicant_email", sa.String(320), nullable=False),
        sa.Column("applicant_phone", sa.String(60), nullable=True),
        sa.Column("calculator_id", sa.String(64), nullable=False),
        sa.Column("country_code", sa.String(8), nullable=False),
        sa.Column("score_summary", sa.String(160), nullable=False),
        sa.Column("score_payload_json", json_type, nullable=False),
        sa.Column("lead_status", sa.String(32), nullable=False, server_default="new_lead"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_calc_leads_org", "calculator_agency_leads", ["organization_id", "created_at"])
    op.create_index("ix_calc_leads_slug", "calculator_agency_leads", ["agency_slug"])


def downgrade() -> None:
    op.drop_index("ix_calc_leads_slug", table_name="calculator_agency_leads")
    op.drop_index("ix_calc_leads_org", table_name="calculator_agency_leads")
    op.drop_table("calculator_agency_leads")

    op.drop_index("ix_agency_tenant_gov_org", table_name="agency_tenant_governance")
    op.drop_table("agency_tenant_governance")

    op.drop_index("ix_agency_onb_email", table_name="agency_onboarding_applications")
    op.drop_index("ix_agency_onb_slug", table_name="agency_onboarding_applications")
    op.drop_index("ix_agency_onb_status", table_name="agency_onboarding_applications")
    op.drop_table("agency_onboarding_applications")

