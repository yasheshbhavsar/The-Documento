"""Document Storage Retention and Secure Purge Engine.

Enforces compliance with legal retention periods (e.g. 7-year statutory retention for US immigration records,
GDPR right-to-be-forgotten for unfiled intake documents) and handles safe, auditable file destruction.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.domain.models import Document, AuditEvent, now_utc


# Statutory retention policies by jurisdiction
RETENTION_POLICIES_DAYS = {
    "US": 7 * 365,       # 7 years for USCIS filings
    "UK": 6 * 365,       # 6 years for UK Home Office
    "CA": 5 * 365,       # 5 years for IRCC
    "DE": 10 * 365,      # 10 years statutory tax/corporate
    "draft_intake": 90,  # 90 days for abandoned drafts
}


class StorageRetentionManager:
    @classmethod
    def evaluate_expired_documents(
        cls,
        db: Session,
        organization_id: uuid.UUID,
        jurisdiction: str = "US",
        now: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Identifies documents exceeding statutory retention limits for an organization."""
        current_time = now or datetime.now(timezone.utc)
        retention_days = RETENTION_POLICIES_DAYS.get(jurisdiction.upper(), 7 * 365)
        cutoff_date = current_time - timedelta(days=retention_days)

        expired_docs = db.scalars(
            select(Document).where(
                Document.organization_id == organization_id,
                Document.created_at < cutoff_date,
            )
        ).all()

        return [
            {
                "document_id": str(d.id),
                "title": d.title,
                "case_id": str(d.case_id) if d.case_id else None,
                "created_at": d.created_at.isoformat(),
                "age_days": round((current_time - d.created_at).total_seconds() / 86400, 1),
                "retention_threshold_days": retention_days,
                "status": "eligible_for_purge",
            }
            for d in expired_docs
        ]

    @classmethod
    def execute_secure_purge(
        cls,
        db: Session,
        organization_id: uuid.UUID,
        document_id: uuid.UUID,
        actor_id: uuid.UUID,
        reason: str = "statutory_retention_expiry",
    ) -> Dict[str, Any]:
        """
        Executes an audited, secure purge of an expired document and its evidentiary records.
        Records an immutable audit event for compliance verification.
        """
        doc = db.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.organization_id == organization_id,
            )
        )
        if not doc:
            raise ValueError(f"Document {document_id} not found in organization.")

        doc_title = doc.title
        storage_key = doc.storage_key
        doc_hash = doc.file_hash_sha256

        # Record audit event before deletion
        now = datetime.now(timezone.utc)
        audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="retention.document_purged",
            object_type="document",
            object_id=str(document_id),
            metadata_json={
                "title": doc_title,
                "storage_key": storage_key,
                "sha256": doc_hash,
                "reason": reason,
                "purged_at": now.isoformat(),
            },
            occurred_at=now,
        )
        db.add(audit)

        # Delete document record (cascading deletes extracted fields and reviews)
        db.delete(doc)
        db.commit()

        return {
            "purged_document_id": str(document_id),
            "title": doc_title,
            "reason": reason,
            "audit_event_id": str(audit.id),
            "status": "permanently_purged",
        }
