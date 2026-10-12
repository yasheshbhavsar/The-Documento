"""phase5_ai_analysis_and_discrepancies

Revision ID: a1b2c3d4e5f6
Revises: f7b29e01a34d
Create Date: 2026-10-11 18:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f7b29e01a34d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    op.create_table(
        'case_ai_findings',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('document_id', uuid_type, sa.ForeignKey('documents.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('finding_type', sa.String(64), nullable=False),
        sa.Column('severity', sa.String(32), nullable=False, server_default='major'),
        sa.Column('status', sa.String(32), nullable=False, server_default='needs_review'),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidence_text', sa.Text(), nullable=True),
        sa.Column('source_location', json_type, nullable=True),
        sa.Column('related_documents', json_type, nullable=False, server_default='[]'),
        sa.Column('related_fields', json_type, nullable=False, server_default='[]'),
        sa.Column('relevant_requirement', sa.String(255), nullable=True),
        sa.Column('recommended_action', sa.Text(), nullable=False),
        sa.Column('clarification_question', sa.Text(), nullable=True),
        sa.Column('uncertainty_limitations', sa.Text(), nullable=False),
        sa.Column('linked_task_id', uuid_type, sa.ForeignKey('case_tasks.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('rule_id', sa.String(100), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('is_confirmed_contradiction', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('reviewer_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_action', sa.String(32), nullable=True),
        sa.Column('resolution_reason', sa.Text(), nullable=True),
        sa.Column('resolution_history', json_type, nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_ai_findings_case_severity', 'case_ai_findings', ['case_id', 'severity'])
    op.create_index('ix_ai_findings_case_status', 'case_ai_findings', ['case_id', 'status'])
    op.create_index('ix_ai_findings_org_status', 'case_ai_findings', ['organization_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_ai_findings_org_status', table_name='case_ai_findings')
    op.drop_index('ix_ai_findings_case_status', table_name='case_ai_findings')
    op.drop_index('ix_ai_findings_case_severity', table_name='case_ai_findings')
    op.drop_table('case_ai_findings')
