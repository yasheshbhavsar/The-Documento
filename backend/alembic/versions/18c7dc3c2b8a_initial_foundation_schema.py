"""initial_foundation_schema

Revision ID: 18c7dc3c2b8a
Revises: 
Create Date: 2026-10-11 15:19:32.045031

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '18c7dc3c2b8a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    """Upgrade schema to initial foundation."""
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")

    op.create_table(
        'organizations',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        'roles',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('code', sa.String(length=64), nullable=False, unique=True),
        sa.Column('name', sa.String(length=120), nullable=False),
    )

    op.create_table(
        'users',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('auth_subject', sa.String(length=255), nullable=True),
        sa.UniqueConstraint('organization_id', 'email', name='uq_user_org_email'),
    )
    op.create_index('ix_users_organization_id', 'users', ['organization_id'])
    op.create_index('ix_users_auth_subject', 'users', ['auth_subject'])

    op.create_table(
        'user_roles',
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', uuid_type, sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('scope', json_type, nullable=False, server_default='{}'),
    )

    op.create_table(
        'audit_events',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('actor_id', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('object_type', sa.String(length=100), nullable=False),
        sa.Column('object_id', sa.String(length=255), nullable=False),
        sa.Column('metadata_json', json_type, nullable=False, server_default='{}'),
        sa.Column('before_hash', sa.String(length=128), nullable=True),
        sa.Column('after_hash', sa.String(length=128), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_audit_events_organization_id', 'audit_events', ['organization_id'])
    op.create_index('ix_audit_events_actor_id', 'audit_events', ['actor_id'])
    op.create_index('ix_audit_events_occurred_at', 'audit_events', ['occurred_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('audit_events')
    op.drop_table('user_roles')
    op.drop_table('users')
    op.drop_table('roles')
    op.drop_table('organizations')
