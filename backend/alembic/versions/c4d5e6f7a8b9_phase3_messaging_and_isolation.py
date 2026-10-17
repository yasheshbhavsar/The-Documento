"""phase3_messaging_and_isolation

Revision ID: c4d5e6f7a8b9
Revises: f1a2b3c4d5e6
Create Date: 2026-10-17 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("message_threads") as batch_op:
        batch_op.add_column(sa.Column("channel_category", sa.String(32), server_default="client", nullable=False))
        batch_op.add_column(sa.Column("is_internal", sa.Boolean(), server_default=sa.text("false"), nullable=False))

    op.create_index("ix_threads_channel_cat", "message_threads", ["organization_id", "channel_category"])


def downgrade() -> None:
    op.drop_index("ix_threads_channel_cat", table_name="message_threads")
    with op.batch_alter_table("message_threads") as batch_op:
        batch_op.drop_column("is_internal")
        batch_op.drop_column("channel_category")
