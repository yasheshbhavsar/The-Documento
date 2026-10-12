"""phase3_case_management_domain

Revision ID: e6a18d34b5c7
Revises: d5ff8ca2fc47
Create Date: 2026-10-11 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e6a18d34b5c7'
down_revision: Union[str, Sequence[str], None] = 'd5ff8ca2fc47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")

    # 1. Indexes on immigration_cases
    with op.batch_alter_table('immigration_cases') as batch_op:
        batch_op.create_index('ix_cases_org_status', ['organization_id', 'status'], unique=False)
        batch_op.create_index('ix_cases_org_jurisdiction', ['organization_id', 'jurisdiction'], unique=False)

    # 2. client_dependants table
    op.create_table(
        'client_dependants',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('primary_client_id', uuid_type, sa.ForeignKey('client_profiles.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('relationship_type', sa.String(length=64), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=True, index=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('date_of_birth', sa.DateTime(timezone=True), nullable=True),
        sa.Column('nationality', sa.String(length=3), nullable=False),
        sa.Column('passport_number_hash', sa.String(length=128), nullable=True),
        sa.Column('is_authorized_to_view_case', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 3. client_consents table
    op.create_table(
        'client_consents',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('client_id', uuid_type, sa.ForeignKey('client_profiles.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('consent_type', sa.String(length=64), nullable=False),
        sa.Column('granted', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('document_hash', sa.String(length=128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 4. case_milestones table
    op.create_table(
        'case_milestones',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('stage', sa.String(length=64), nullable=False),
        sa.Column('target_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=32), server_default='pending', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 5. case_notes table
    op.create_table(
        'case_notes',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('author_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('note_type', sa.String(length=64), server_default='internal', nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_client_visible', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 6. case_tasks table
    op.create_table(
        'case_tasks',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assigned_to_user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('priority', sa.String(length=32), server_default='medium', nullable=False),
        sa.Column('status', sa.String(length=32), server_default='pending', nullable=False),
        sa.Column('is_completed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_by_user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('case_tasks')
    op.drop_table('case_notes')
    op.drop_table('case_milestones')
    op.drop_table('client_consents')
    op.drop_table('client_dependants')

    with op.batch_alter_table('immigration_cases') as batch_op:
        batch_op.drop_index('ix_cases_org_jurisdiction')
        batch_op.drop_index('ix_cases_org_status')
