"""phase9_company_ops_billing_analytics

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-11 22:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Service Items (Service Catalog)
    op.create_table(
        "service_items",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("jurisdiction", sa.String(3), nullable=False, server_default="US"),
        sa.Column("visa_category", sa.String(64), nullable=True),
        sa.Column("pricing_model", sa.String(32), nullable=False, server_default="fixed"),
        sa.Column("base_fee", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("estimated_duration_days", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "code", name="uq_service_org_code"),
    )
    op.create_index("ix_services_org_jur", "service_items", ["organization_id", "jurisdiction"])

    # 2. Client Engagements (Retainers / Fee Agreements)
    op.create_table(
        "client_engagements",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("service_id", uuid_type, sa.ForeignKey("service_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("engagement_number", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("retainer_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("agreed_fee", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("billing_terms", sa.String(64), nullable=False, server_default="fixed_split"),
        sa.Column("responsible_attorney_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("signed_agreement_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "engagement_number", name="uq_engagement_org_number"),
    )
    op.create_index("ix_engagements_org_client", "client_engagements", ["organization_id", "client_id"])
    op.create_index("ix_engagements_status", "client_engagements", ["organization_id", "status"])

    # 3. Invoices
    op.create_table(
        "invoices",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("engagement_id", uuid_type, sa.ForeignKey("client_engagements.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_number", sa.String(64), nullable=False),
        sa.Column("issue_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("tax_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("discount_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("paid_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("balance_due", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("payment_provider", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "invoice_number", name="uq_invoice_org_number"),
    )
    op.create_index("ix_invoices_org_client", "invoices", ["organization_id", "client_id"])
    op.create_index("ix_invoices_status", "invoices", ["organization_id", "status"])
    op.create_index("ix_invoices_due_date", "invoices", ["organization_id", "due_date"])

    # 4. Invoice Line Items
    op.create_table(
        "invoice_line_items",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("invoice_id", uuid_type, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service_id", uuid_type, sa.ForeignKey("service_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("unit_price", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("line_type", sa.String(32), nullable=False, server_default="service_fee"),
    )
    op.create_index("ix_invoice_line_items_inv", "invoice_line_items", ["invoice_id"])

    # 5. Payment Records (Never storing raw PAN/card data)
    op.create_table(
        "payment_records",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", uuid_type, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transaction_reference", sa.String(128), unique=True, nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("payment_method", sa.String(64), nullable=False, server_default="credit_card_tokenized"),
        sa.Column("status", sa.String(32), nullable=False, server_default="succeeded"),
        sa.Column("refunded_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("provider_charge_id", sa.String(128), nullable=True),
        sa.Column("card_brand", sa.String(32), nullable=True),
        sa.Column("card_last4", sa.String(4), nullable=True),
        sa.Column("payment_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata_json", json_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payments_org_inv", "payment_records", ["organization_id", "invoice_id"])
    op.create_index("ix_payments_status", "payment_records", ["organization_id", "status"])
    op.create_index("ix_payments_date", "payment_records", ["organization_id", "payment_date"])

    # 6. Organization Settings
    op.create_table(
        "organization_settings",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("setting_key", sa.String(100), nullable=False),
        sa.Column("setting_value_json", json_type, nullable=False),
        sa.Column("updated_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "setting_key", name="uq_org_setting_key"),
    )
    op.create_index("ix_org_settings_key", "organization_settings", ["organization_id", "setting_key"])


def downgrade() -> None:
    op.drop_table("organization_settings")
    op.drop_table("payment_records")
    op.drop_table("invoice_line_items")
    op.drop_table("invoices")
    op.drop_table("client_engagements")
    op.drop_table("service_items")
