"""phase7_portal_requests_messaging_notifications

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-11 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. Update Notifications table with delivery status and channel
    with op.batch_alter_table("notifications") as batch_op:
        batch_op.add_column(sa.Column("channel", sa.String(32), server_default="in_app", nullable=False))
        batch_op.add_column(sa.Column("delivery_status", sa.String(32), server_default="delivered", nullable=False))
        batch_op.add_column(sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("delivery_error", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("metadata_json", json_type, server_default="{}", nullable=False))

    # 2. Document Requests
    op.create_table(
        "document_requests",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requested_from_client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dependant_id", uuid_type, sa.ForeignKey("client_dependants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(64), server_default="supporting_evidence", nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("statutory_requirement_code", sa.String(100), nullable=True),
        sa.Column("accepted_formats", json_type, server_default="[]", nullable=False),
        sa.Column("acceptable_alternatives", sa.Text(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("translation_guidance", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), server_default="requested", nullable=False),
        sa.Column("fulfilled_document_id", uuid_type, sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("status_history", json_type, server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_doc_requests_org_case", "document_requests", ["organization_id", "case_id"])
    op.create_index("ix_doc_requests_status", "document_requests", ["organization_id", "status"])
    op.create_index("ix_doc_requests_client", "document_requests", ["organization_id", "requested_from_client_id"])

    # 3. Document Request Comments
    op.create_table(
        "document_request_comments",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_id", uuid_type, sa.ForeignKey("document_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_doc_req_comments_req", "document_request_comments", ["request_id", "created_at"])

    # 4. Message Threads
    op.create_table(
        "message_threads",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("thread_type", sa.String(64), server_default="general", nullable=False),
        sa.Column("status", sa.String(32), server_default="open", nullable=False),
        sa.Column("created_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_threads_org_case", "message_threads", ["organization_id", "case_id"])
    op.create_index("ix_threads_status", "message_threads", ["organization_id", "status"])

    # 5. Messages
    op.create_table(
        "messages",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("thread_id", uuid_type, sa.ForeignKey("message_threads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("attachment_document_ids", json_type, server_default="[]", nullable=False),
        sa.Column("delivery_status", sa.String(32), server_default="sent", nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_messages_thread_time", "messages", ["thread_id", "created_at"])
    op.create_index("ix_messages_internal", "messages", ["thread_id", "is_internal"])

    # 6. Client Questionnaires
    op.create_table(
        "client_questionnaires",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", uuid_type, sa.ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", uuid_type, sa.ForeignKey("immigration_cases.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), server_default="in_progress", nullable=False),
        sa.Column("sections_json", json_type, server_default="[]", nullable=False),
        sa.Column("responses_json", json_type, server_default="{}", nullable=False),
        sa.Column("completion_percentage", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_questionnaires_client_status", "client_questionnaires", ["client_id", "status"])
    op.create_index("ix_questionnaires_case", "client_questionnaires", ["case_id"])


def downgrade() -> None:
    op.drop_table("client_questionnaires")
    op.drop_table("messages")
    op.drop_table("message_threads")
    op.drop_table("document_request_comments")
    op.drop_table("document_requests")
    with op.batch_alter_table("notifications") as batch_op:
        batch_op.drop_column("metadata_json")
        batch_op.drop_column("delivery_error")
        batch_op.drop_column("delivered_at")
        batch_op.drop_column("last_attempt_at")
        batch_op.drop_column("retry_count")
        batch_op.drop_column("delivery_status")
        batch_op.drop_column("channel")
