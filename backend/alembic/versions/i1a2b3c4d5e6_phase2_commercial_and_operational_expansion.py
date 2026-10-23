"""phase2_commercial_and_operational_expansion

Revision ID: i1a2b3c4d5e6
Revises: h1a2b3c4d5e6
Create Date: 2026-10-21 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'i1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'h1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")

    # 1. Add Indian 18% GST and SAC 998311 columns to invoices
    op.add_column("invoices", sa.Column("gst_rate", sa.Float(), nullable=False, server_default="0.18"))
    op.add_column("invoices", sa.Column("cgst_amount", sa.Float(), nullable=False, server_default="0.0"))
    op.add_column("invoices", sa.Column("sgst_amount", sa.Float(), nullable=False, server_default="0.0"))
    op.add_column("invoices", sa.Column("igst_amount", sa.Float(), nullable=False, server_default="0.0"))
    op.add_column("invoices", sa.Column("sac_code", sa.String(16), nullable=False, server_default="998311"))
    op.add_column("invoices", sa.Column("gstin", sa.String(32), nullable=True))
    op.add_column("invoices", sa.Column("place_of_supply", sa.String(64), nullable=True))

    # 2. Add SAC and GST fields to invoice line items and service items
    op.add_column("invoice_line_items", sa.Column("sac_code", sa.String(16), nullable=False, server_default="998311"))
    op.add_column("invoice_line_items", sa.Column("gst_rate", sa.Float(), nullable=False, server_default="0.18"))

    op.add_column("service_items", sa.Column("sac_code", sa.String(16), nullable=False, server_default="998311"))
    op.add_column("service_items", sa.Column("gst_rate", sa.Float(), nullable=False, server_default="0.18"))

    # 3. Add Indian KYC fields to client profiles
    op.add_column("client_profiles", sa.Column("aadhaar_number_masked", sa.String(16), nullable=True))
    op.add_column("client_profiles", sa.Column("pan_number", sa.String(16), nullable=True))
    op.add_column("client_profiles", sa.Column("voter_id", sa.String(32), nullable=True))
    op.add_column("client_profiles", sa.Column("passport_ecr_status", sa.String(16), nullable=False, server_default="NON_ECR"))

    # 4. Create financial_sponsors table
    op.create_table(
        "financial_sponsors",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("relationship", sa.String(64), nullable=False),
        sa.Column("sponsor_type", sa.String(32), nullable=False, server_default="individual"),
        sa.Column("pan", sa.String(32), nullable=True),
        sa.Column("itr_gross_income", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("liquid_funds", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("bank_name", sa.String(120), nullable=True),
        sa.Column("loan_sanction_amount", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("affidavit_doc_id", uuid_type, nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sponsors_org_client", "financial_sponsors", ["organization_id", "client_id"])
    op.create_index("ix_sponsors_case", "financial_sponsors", ["organization_id", "case_id"])

    # 5. Create visa_appointments table
    op.create_table(
        "visa_appointments",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vac_center", sa.String(120), nullable=False),
        sa.Column("consular_post", sa.String(120), nullable=False),
        sa.Column("ofc_biometrics_slot", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consular_interview_slot", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dropbox_eligible", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tracking_number_blue_dart", sa.String(64), nullable=True),
        sa.Column("courier_status", sa.String(64), nullable=False, server_default="pending_pickup"),
        sa.Column("status_221g", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status_221g_color", sa.String(32), nullable=True),
        sa.Column("appointment_status", sa.String(32), nullable=False, server_default="scheduled"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_appointments_org_case", "visa_appointments", ["organization_id", "case_id"])
    op.create_index("ix_appointments_status", "visa_appointments", ["organization_id", "appointment_status"])
    op.create_index("ix_appointments_vac", "visa_appointments", ["organization_id", "vac_center"])


def downgrade() -> None:
    op.drop_index("ix_appointments_vac", table_name="visa_appointments")
    op.drop_index("ix_appointments_status", table_name="visa_appointments")
    op.drop_index("ix_appointments_org_case", table_name="visa_appointments")
    op.drop_table("visa_appointments")

    op.drop_index("ix_sponsors_case", table_name="financial_sponsors")
    op.drop_index("ix_sponsors_org_client", table_name="financial_sponsors")
    op.drop_table("financial_sponsors")

    op.drop_column("client_profiles", "passport_ecr_status")
    op.drop_column("client_profiles", "voter_id")
    op.drop_column("client_profiles", "pan_number")
    op.drop_column("client_profiles", "aadhaar_number_masked")

    op.drop_column("service_items", "gst_rate")
    op.drop_column("service_items", "sac_code")

    op.drop_column("invoice_line_items", "gst_rate")
    op.drop_column("invoice_line_items", "sac_code")

    op.drop_column("invoices", "place_of_supply")
    op.drop_column("invoices", "gstin")
    op.drop_column("invoices", "sac_code")
    op.drop_column("invoices", "igst_amount")
    op.drop_column("invoices", "sgst_amount")
    op.drop_column("invoices", "cgst_amount")
    op.drop_column("invoices", "gst_rate")
