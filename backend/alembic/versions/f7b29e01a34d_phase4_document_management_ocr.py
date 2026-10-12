"""phase4_document_management_ocr

Revision ID: f7b29e01a34d
Revises: e6a18d34b5c7
Create Date: 2026-10-11 17:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f7b29e01a34d'
down_revision: Union[str, Sequence[str], None] = 'e6a18d34b5c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.UUID(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

    # 1. documents table
    op.create_table(
        'documents',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('client_id', uuid_type, sa.ForeignKey('client_profiles.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('uploaded_by_user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=64), server_default='supporting_evidence', nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=False, index=True),
        sa.Column('byte_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('parent_document_id', uuid_type, sa.ForeignKey('documents.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('is_current_version', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('malware_scan_status', sa.String(length=32), server_default='clean', nullable=False),
        sa.Column('malware_scan_details', sa.String(length=255), nullable=True),
        sa.Column('processing_status', sa.String(length=32), server_default='pending', nullable=False),
        sa.Column('processing_error', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('verification_status', sa.String(length=32), server_default='unverified', nullable=False),
        sa.Column('verified_by_user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        sa.Column('detected_language', sa.String(length=16), nullable=True),
        sa.Column('page_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('ocr_applied', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('layout_metadata', json_type, server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    with op.batch_alter_table('documents') as batch_op:
        batch_op.create_index('ix_documents_org_case', ['organization_id', 'case_id'], unique=False)
        batch_op.create_index('ix_documents_org_status', ['organization_id', 'processing_status'], unique=False)
        batch_op.create_index('ix_documents_org_hash', ['organization_id', 'sha256_hash'], unique=False)
        batch_op.create_index('ix_documents_category', ['organization_id', 'category'], unique=False)

    # 2. document_upload_sessions table
    op.create_table(
        'document_upload_sessions',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('case_id', uuid_type, sa.ForeignKey('immigration_cases.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('idempotency_key', sa.String(length=128), nullable=False, index=True),
        sa.Column('expected_filename', sa.String(length=255), nullable=False),
        sa.Column('expected_mime_type', sa.String(length=100), nullable=False),
        sa.Column('expected_byte_size', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=32), server_default='initiated', nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    with op.batch_alter_table('document_upload_sessions') as batch_op:
        batch_op.create_index('ix_upload_sessions_org_key', ['organization_id', 'idempotency_key'], unique=False)

    # 3. document_extracted_fields table
    op.create_table(
        'document_extracted_fields',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('organization_id', uuid_type, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('document_id', uuid_type, sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('field_label', sa.String(length=150), nullable=False),
        sa.Column('original_value', sa.Text(), nullable=False),
        sa.Column('normalized_value', sa.Text(), nullable=True),
        sa.Column('source_page', sa.Integer(), server_default='1', nullable=False),
        sa.Column('source_location', json_type, nullable=True),
        sa.Column('extraction_method', sa.String(length=64), server_default='native_pdf_text', nullable=False),
        sa.Column('model_version', sa.String(length=64), nullable=True),
        sa.Column('ocr_confidence', sa.Float(), nullable=True),
        sa.Column('extraction_confidence', sa.Float(), nullable=True),
        sa.Column('validation_status', sa.String(length=32), server_default='unvalidated', nullable=False),
        sa.Column('is_manually_corrected', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('corrected_value', sa.Text(), nullable=True),
        sa.Column('corrected_by_user_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('corrected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('correction_reason', sa.Text(), nullable=True),
        sa.Column('correction_history', json_type, server_default='[]', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    with op.batch_alter_table('document_extracted_fields') as batch_op:
        batch_op.create_index('ix_extracted_fields_doc', ['document_id', 'field_name'], unique=False)


def downgrade() -> None:
    op.drop_table('document_extracted_fields')
    op.drop_table('document_upload_sessions')
    op.drop_table('documents')
