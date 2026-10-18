"""phase13_pilot_and_release_governance

Revision ID: h1a2b3c4d5e6
Revises: g1a2b3c4d5e6
Create Date: 2026-10-18 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'h1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'g1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Create pilot_cohorts table
    op.create_table(
        "pilot_cohorts",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cohort_name", sa.String(100), nullable=False),
        sa.Column("firm_tier", sa.String(32), server_default="small_firm", nullable=False),
        sa.Column("status", sa.String(32), server_default="active", nullable=False),
        sa.Column("max_cases_allowed", sa.Integer(), server_default="25", nullable=False),
        sa.Column("allowed_pathways_json", json_type, server_default="[]", nullable=False),
        sa.Column("synthetic_data_attestation", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("unapproved_ai_block_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("assigned_lead_email", sa.String(255), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("target_end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pilot_cohort_org_status", "pilot_cohorts", ["organization_id", "status"])

    # 2. Create pilot_stress_test_executions table
    op.create_table(
        "pilot_stress_test_executions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cohort_id", uuid_type, sa.ForeignKey("pilot_cohorts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scenario_key", sa.String(64), nullable=False),
        sa.Column("scenario_name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), server_default="passed", nullable=False),
        sa.Column("execution_notes", sa.Text(), nullable=False),
        sa.Column("metrics_json", json_type, server_default="{}", nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("executed_by_name", sa.String(255), nullable=False),
    )
    op.create_index("ix_stress_exec_org_scenario", "pilot_stress_test_executions", ["organization_id", "scenario_key"])
    op.create_index("ix_stress_exec_date", "pilot_stress_test_executions", ["organization_id", "executed_at"])

    # 3. Create pilot_kpi_benchmarks table
    op.create_table(
        "pilot_kpi_benchmarks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cohort_id", uuid_type, sa.ForeignKey("pilot_cohorts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("period_label", sa.String(64), nullable=False),
        sa.Column("pathway_key", sa.String(64), nullable=False),
        sa.Column("baseline_workflow_hours", sa.Float(), nullable=False),
        sa.Column("documento_workflow_hours", sa.Float(), nullable=False),
        sa.Column("time_saved_hours", sa.Float(), nullable=False),
        sa.Column("time_saved_percentage", sa.Float(), nullable=False),
        sa.Column("correction_rate_percentage", sa.Float(), nullable=False),
        sa.Column("false_positive_flags_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("missed_exceptions_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("package_rework_rate_percentage", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("operational_failures_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("operational_recovery_rate_percentage", sa.Float(), server_default="100.0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_kpi_benchmark_org", "pilot_kpi_benchmarks", ["organization_id", "period_label"])

    # 4. Create release_gate_evaluations table
    op.create_table(
        "release_gate_evaluations",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evaluated_by_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("evaluated_by_name", sa.String(255), nullable=False),
        sa.Column("evaluation_version", sa.String(32), nullable=False),
        sa.Column("overall_status", sa.String(32), server_default="PASSED", nullable=False),
        sa.Column("gates_json", json_type, server_default="{}", nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signed_off_by_owner", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("signoff_notes", sa.Text(), nullable=True),
        sa.Column("signed_off_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_release_gate_org_eval", "release_gate_evaluations", ["organization_id", "evaluation_version"])

    # 5. Create operational_runbooks table
    op.create_table(
        "operational_runbooks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("runbook_type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("metadata_json", json_type, server_default="{}", nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_by_name", sa.String(255), nullable=False),
    )
    op.create_index("ix_runbook_org_type", "operational_runbooks", ["organization_id", "runbook_type"])


def downgrade() -> None:
    op.drop_table("operational_runbooks")
    op.drop_table("release_gate_evaluations")
    op.drop_table("pilot_kpi_benchmarks")
    op.drop_table("pilot_stress_test_executions")
    op.drop_table("pilot_cohorts")
