"""complete_technical_foundation_schema

Revision ID: d5ff8ca2fc47
Revises: 18c7dc3c2b8a
Create Date: 2026-10-11 15:38:47.255251

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd5ff8ca2fc47'
down_revision: Union[str, Sequence[str], None] = '18c7dc3c2b8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")

    # 1. Update organizations with slug and updated_at
    with op.batch_alter_table('organizations') as batch_op:
        batch_op.add_column(sa.Column('slug', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index('ix_organizations_slug', ['slug'], unique=True)

    # 2. Update users with full_name, password_hash, phone, mfa, updated_at
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('full_name', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('password_hash', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('phone', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('is_mfa_enabled', sa.Boolean(), server_default='false', nullable=False))
        batch_op.add_column(sa.Column('mfa_secret', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Update roles with description, is_system_role, created_at
    with op.batch_alter_table('roles') as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('is_system_role', sa.Boolean(), server_default='true', nullable=False))
        batch_op.add_column(sa.Column('created_at', sa.DateTime(timezone=True), nullable=True))

    # 4. Create branches
    op.create_table(
        'branches',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('code', sa.String(length=32), nullable=False),
        sa.Column('country', sa.String(length=3), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('organization_id', 'code', name='uq_branch_org_code'),
    )
    op.create_index('ix_branches_organization_id', 'branches', ['organization_id'])

    # 5. Create teams
    op.create_table(
        'teams',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('branch_id', uuid_type, sa.ForeignKey('branches.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_teams_organization_id', 'teams', ['organization_id'])
    op.create_index('ix_teams_branch_id', 'teams', ['branch_id'])

    # 6. Create permissions & role_permissions
    op.create_table(
        'permissions',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('code', sa.String(length=100), nullable=False, unique=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
    )
    op.create_index('ix_permissions_code', 'permissions', ['code'])

    op.create_table(
        'role_permissions',
        sa.Column('role_id', uuid_type, sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('permission_id', uuid_type, sa.ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    )

    # 7. Create organization_memberships & membership_roles
    op.create_table(
        'organization_memberships',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('branch_id', uuid_type, sa.ForeignKey('branches.id', ondelete='SET NULL'), nullable=True),
        sa.Column('team_id', uuid_type, sa.ForeignKey('teams.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_org_membership_user'),
    )
    op.create_index('ix_organization_memberships_org_id', 'organization_memberships', ['organization_id'])
    op.create_index('ix_organization_memberships_user_id', 'organization_memberships', ['user_id'])

    op.create_table(
        'membership_roles',
        sa.Column('membership_id', uuid_type, sa.ForeignKey('organization_memberships.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', uuid_type, sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 8. Create invitations, sessions, password_reset_tokens
    op.create_table(
        'invitations',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('inviter_user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('role_code', sa.String(length=64), nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_invitations_org_id', 'invitations', ['organization_id'])
    op.create_index('ix_invitations_token_hash', 'invitations', ['token_hash'])

    op.create_table(
        'sessions',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False, unique=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])
    op.create_index('ix_sessions_org_id', 'sessions', ['organization_id'])
    op.create_index('ix_sessions_token_hash', 'sessions', ['token_hash'])

    op.create_table(
        'password_reset_tokens',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_pwd_reset_tokens_user_id', 'password_reset_tokens', ['user_id'])
    op.create_index('ix_pwd_reset_tokens_token_hash', 'password_reset_tokens', ['token_hash'])

    # 9. Create client_profiles, immigration_cases, case_assignments
    op.create_table(
        'client_profiles',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('date_of_birth', sa.DateTime(timezone=True), nullable=True),
        sa.Column('nationality', sa.String(length=3), nullable=False),
        sa.Column('passport_number_hash', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_client_profiles_org_id', 'client_profiles', ['organization_id'])
    op.create_index('ix_client_profiles_email', 'client_profiles', ['email'])

    op.create_table(
        'immigration_cases',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', uuid_type, sa.ForeignKey('client_profiles.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('case_number', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('jurisdiction', sa.String(length=3), nullable=False),
        sa.Column('visa_category', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='intake'),
        sa.Column('priority_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('organization_id', 'case_number', name='uq_case_org_number'),
    )
    op.create_index('ix_cases_org_id', 'immigration_cases', ['organization_id'])
    op.create_index('ix_cases_client_id', 'immigration_cases', ['client_id'])
    op.create_index('ix_cases_case_number', 'immigration_cases', ['case_number'])

    op.create_table(
        'case_assignments',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_in_case', sa.String(length=64), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('case_id', 'user_id', 'role_in_case', name='uq_case_user_role'),
    )
    op.create_index('ix_case_assignments_case_id', 'case_assignments', ['case_id'])
    op.create_index('ix_case_assignments_user_id', 'case_assignments', ['user_id'])

    # 10. Create notifications
    op.create_table(
        'notifications',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False, server_default='info'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_notifications_org_id', 'notifications', ['organization_id'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])


def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('case_assignments')
    op.drop_table('immigration_cases')
    op.drop_table('client_profiles')
    op.drop_table('password_reset_tokens')
    op.drop_table('sessions')
    op.drop_table('invitations')
    op.drop_table('membership_roles')
    op.drop_table('organization_memberships')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
    op.drop_table('teams')
    op.drop_table('branches')

    with op.batch_alter_table('roles') as batch_op:
        batch_op.drop_column('created_at')
        batch_op.drop_column('is_system_role')
        batch_op.drop_column('description')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('mfa_secret')
        batch_op.drop_column('is_mfa_enabled')
        batch_op.drop_column('phone')
        batch_op.drop_column('password_hash')
        batch_op.drop_column('full_name')

    with op.batch_alter_table('organizations') as batch_op:
        batch_op.drop_index('ix_organizations_slug')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('slug')
