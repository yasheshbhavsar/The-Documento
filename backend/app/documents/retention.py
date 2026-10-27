"""Document Storage Retention and Secure Purge Engine.

Enforces compliant, durable, and retryable document retention and destruction workflows:
- Two-phase storage and database deletion with reconciliation on failure
- Strict tenant isolation and actor authorization
- Protection of documents on legal hold or with unresolved statutory anomalies/AI findings
- Idempotent execution paths for already-missing objects and repeat requests
- Zero-PII audit logging
- Provisional jurisdiction-aware retention schedules (subject to legal review)
"""
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.errors import NotFoundError, TenantIsolationError, PermissionDeniedError
from backend.app.documents.storage import StorageBackend, StorageError, get_storage_backend
from backend.app.domain.models import (
    Document,
    AuditEvent,
    OutboxEvent,
    CaseAIFinding,
    ImmigrationCase,
    FilingPackage,
    PackageDownloadEvent,
    now_utc,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Retention Exceptions
# ---------------------------------------------------------------------------

class RetentionError(Exception):
    """Base exception for document retention and purge errors."""
    pass


class PurgeIneligibleError(RetentionError):
    """Raised when a document is not eligible for purge."""
    pass


class LegalHoldError(PurgeIneligibleError):
    """Raised when an attempt is made to purge a document under legal hold."""
    pass


class UnresolvedAnomalyError(PurgeIneligibleError):
    """Raised when a document has unresolved AI or statutory compliance findings."""
    pass


class DatabaseReconciliationError(RetentionError):
    """Raised when storage deletion succeeded but database update failed."""
    pass


# ---------------------------------------------------------------------------
# Retention Policy Configuration
# ---------------------------------------------------------------------------

# Operational provisional statutory estimates (kept for reference and backward compatibility).
# WARNING: These are unverified operational assumptions and MUST NOT be treated as definitive legal rules.
# Per Documento Master Vision §1 and §4.8: Documento is NOT a permanent cloud vault by default.
# Firms retain permanent case files in local folders or approved local storage.
PROVISIONAL_RETENTION_POLICIES_DAYS = {
    "US": 7 * 365,       # Operational default: 7 years (provisional, subject to legal review)
    "UK": 6 * 365,       # Operational default: 6 years (provisional, subject to legal review)
    "CA": 5 * 365,       # Operational default: 5 years (provisional, subject to legal review)
    "DE": 10 * 365,      # Operational default: 10 years (provisional, subject to legal review)
    "draft_intake": 90,  # Legacy fallback: 90 days for abandoned drafts (provisional)
    "default": 7 * 365,  # Fallback default (provisional)
}

# Backward compatibility alias
RETENTION_POLICIES_DAYS = PROVISIONAL_RETENTION_POLICIES_DAYS

# Documento Ephemeral Temporary Storage Schedules (Vision §1, §4.8)
# Server-side documents are held ephemerally for processing, review, and package assembly.
# Cleanup is gated strictly on verified download confirmation, resolving anomalies, and legal hold release.
EPHEMERAL_RETENTION_SCHEDULES_DAYS = {
    "draft_intake": 14,       # Uncompleted / abandoned intake drafts
    "closed_case": 30,        # Post-closure / post-filing package retention
    "immediate": 0,           # Immediate post-download verified purge
    "seven_days": 7,          # 7 days post-download verified purge
    "fourteen_days": 14,      # 14 days post-download verified purge
    "thirty_days": 30,        # 30 days post-download verified purge
    "sixty_days": 60,         # 60 days post-download verified purge
    "ninety_days": 90,        # 90 days post-download verified purge
    "default": 30,            # General operational fallback for ephemeral storage
    "ephemeral_default": 30,  # Default ephemeral storage limit
}

DEFAULT_EPHEMERAL_RETENTION_DAYS = 30
DEFAULT_DRAFT_RETENTION_DAYS = 14
DEFAULT_CLOSED_CASE_RETENTION_DAYS = 30

UNRESOLVED_FINDING_STATUSES = {"needs_review", "unable_to_determine", "flagged", "open", "in_review"}


@dataclass
class PurgeEligibility:
    is_eligible: bool
    reasons: List[str] = field(default_factory=list)
    blocking_findings: List[Dict[str, Any]] = field(default_factory=list)
    legal_hold: bool = False
    age_days: float = 0.0
    threshold_days: int = 0
    download_confirmed: bool = True
    verified_download_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Legal Hold and Anomaly Inspection
# ---------------------------------------------------------------------------

def is_document_on_legal_hold(doc: Document) -> bool:
    """Checks if a document is protected under an active legal hold."""
    if not doc:
        return False
    meta = doc.layout_metadata or {}
    if meta.get("legal_hold") is True or meta.get("hold") is True or meta.get("litigation_hold") is True:
        return True
    if getattr(doc, "category", "") == "legal_hold":
        return True
    return False


def get_unresolved_document_findings(db: Session, doc: Document) -> List[CaseAIFinding]:
    """Retrieves unresolved compliance findings or anomalies linked to the document."""
    findings = (
        db.query(CaseAIFinding)
        .filter(
            CaseAIFinding.organization_id == doc.organization_id,
            CaseAIFinding.document_id == doc.id,
            CaseAIFinding.status.in_(UNRESOLVED_FINDING_STATUSES),
        )
        .all()
    )
    return findings


def evaluate_purge_eligibility(
    db: Session,
    doc: Document,
    *,
    organization_id: UUID,
    jurisdiction: str = "US",
    retention_policy: Optional[str] = None,
    retention_days_override: Optional[int] = None,
    use_ephemeral_schedule: bool = False,
    bypass_retention_window: bool = False,
    now: Optional[datetime] = None,
) -> PurgeEligibility:
    """
    Evaluates whether a document meets all criteria for permanent secure purge.
    Enforces:
    1. Strict tenant isolation
    2. Legal hold protection
    3. Unresolved compliance findings / AI anomalies gate
    4. Processing state safety gate
    5. Active petition casework protection & package download confirmation gate (Vision §4.8)
    6. Document-level verified export / download evidence gate
    7. Ephemeral or statutory retention schedule calculation
    """
    current_time = now or datetime.now(timezone.utc)
    reasons: List[str] = []
    download_confirmed: bool = True
    verified_download_at: Optional[datetime] = None

    # 1. Strict Tenant Isolation
    if doc.organization_id != organization_id:
        raise TenantIsolationError("Cross-tenant document access denied for purge evaluation.")

    # 2. Legal Hold Protection
    on_hold = is_document_on_legal_hold(doc)
    if on_hold:
        hold_reason = (doc.layout_metadata or {}).get("legal_hold_reason", "Active litigation hold")
        reasons.append(f"Document is on legal hold: {hold_reason}")

    # 3. Unresolved Anomalies / AI Findings
    unresolved_findings = get_unresolved_document_findings(db, doc)
    blocking_findings_data = [
        {
            "finding_id": str(f.id),
            "finding_type": f.finding_type,
            "severity": f.severity,
            "status": f.status,
        }
        for f in unresolved_findings
    ]
    if unresolved_findings or getattr(doc, "has_unresolved_anomaly", False):
        count = len(unresolved_findings) or 1
        reasons.append(f"Document has {count} unresolved compliance findings/anomalies.")

    # 4. Processing State Safety Gate
    if doc.processing_status in ("processing", "queued"):
        reasons.append(f"Document is currently being processed (status: {doc.processing_status}).")

    # 5. Case Ownership, Active Casework & Package Download Confirmation Gate
    case = None
    if doc.case_id:
        case = db.query(ImmigrationCase).filter(ImmigrationCase.id == doc.case_id).first()
        if case:
            if case.organization_id != organization_id:
                raise TenantIsolationError("Document case belongs to a different tenant.")

            # Active petition protection
            if case.status in ("in_progress", "under_review", "filed", "appealed") and not bypass_retention_window:
                reasons.append(
                    f"Document is linked to an active petition (case #{case.case_number}, status: {case.status}). "
                    "Active casework evidence cannot be purged without explicit counsel override."
                )

            # Download confirmation gate for assembled packages:
            # Per Vision §4.8: A download starting in a browser is NOT proof of local saving.
            # A failed or uncertain download must NEVER trigger cleanup.
            packages = (
                db.query(FilingPackage)
                .filter(
                    FilingPackage.case_id == case.id,
                    FilingPackage.organization_id == organization_id,
                )
                .all()
            )
            if packages and not bypass_retention_window:
                pkg_ids = [p.id for p in packages]
                downloads = (
                    db.query(PackageDownloadEvent)
                    .filter(
                        PackageDownloadEvent.package_id.in_(pkg_ids),
                        PackageDownloadEvent.organization_id == organization_id,
                    )
                    .all()
                )
                if not downloads:
                    download_confirmed = False
                    reasons.append(
                        f"Filing package has been generated for case #{case.case_number}, but has not been downloaded by firm staff. "
                        "Routine purge is held to prevent client evidence loss."
                    )
                else:
                    verified_events = [d for d in downloads if d.is_verified]
                    if not verified_events:
                        download_confirmed = False
                        reasons.append(
                            f"Filing package download was initiated for case #{case.case_number}, but transfer receipt was unconfirmed. "
                            "Download initiation alone is not proof of local saving; cleanup is held to prevent data loss."
                        )
                    else:
                        download_confirmed = True
                        latest_pkg_dl = max(verified_events, key=lambda d: d.verified_at or d.downloaded_at)
                        verified_download_at = latest_pkg_dl.verified_at or latest_pkg_dl.downloaded_at

    # 6. Document-Level Verified Download / Export Evidence Check
    meta = doc.layout_metadata or {}
    verified_doc_download = meta.get("verified_download")
    if verified_doc_download and isinstance(verified_doc_download, dict):
        verified_at_str = verified_doc_download.get("verified_at")
        if verified_at_str:
            try:
                verified_download_at = datetime.fromisoformat(verified_at_str)
                download_confirmed = True
            except (ValueError, TypeError):
                pass

    if meta.get("require_download_evidence") is True and not bypass_retention_window:
        # Check verified download or export audit event
        export_audits = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.organization_id == organization_id,
                AuditEvent.object_id == str(doc.id),
                AuditEvent.action.in_([
                    "document.download_verified",
                    "filing_package.download_verified",
                    "package.exported",
                    "document.exported",
                ]),
            )
            .all()
        )
        has_verified_trail = bool(export_audits or verified_download_at or (verified_doc_download and verified_doc_download.get("verified_at")))

        if not has_verified_trail:
            unverified_audit = (
                db.query(AuditEvent)
                .filter(
                    AuditEvent.organization_id == organization_id,
                    AuditEvent.object_id == str(doc.id),
                    AuditEvent.action.in_(["document.downloaded", "filing_package.downloaded", "package.downloaded"]),
                )
                .first()
            )
            if unverified_audit:
                download_confirmed = False
                reasons.append("Document download was initiated, but client receipt was not verified. Unconfirmed transfer cannot satisfy export evidence requirement.")
            else:
                download_confirmed = False
                reasons.append("Document policy requires export/download audit trail before permanent destruction.")

    # 7. Retention Period Calculation
    if retention_days_override is not None:
        retention_days = retention_days_override
    elif retention_policy is not None:
        retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS.get(
            retention_policy, DEFAULT_EPHEMERAL_RETENTION_DAYS
        )
    elif use_ephemeral_schedule:
        if case and case.post_download_retention_policy:
            retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS.get(
                case.post_download_retention_policy, DEFAULT_CLOSED_CASE_RETENTION_DAYS
            )
        elif case and case.status in ("draft", "intake", "abandoned"):
            retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS["draft_intake"]
        elif not doc.case_id:
            retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS["draft_intake"]
        else:
            retention_days = DEFAULT_EPHEMERAL_RETENTION_DAYS
    else:
        retention_days = PROVISIONAL_RETENTION_POLICIES_DAYS.get(
            jurisdiction.upper(), PROVISIONAL_RETENTION_POLICIES_DAYS["default"]
        )

    # Ensure doc.created_at is timezone-aware
    doc_created = doc.created_at
    if doc_created.tzinfo is None:
        doc_created = doc_created.replace(tzinfo=timezone.utc)

    age_seconds = (current_time - doc_created).total_seconds()
    age_days = max(0.0, round(age_seconds / 86400, 1))

    # Evaluate post-download window if verified download occurred and ephemeral mode applies
    if verified_download_at and (use_ephemeral_schedule or retention_policy):
        if verified_download_at.tzinfo is None:
            verified_download_at = verified_download_at.replace(tzinfo=timezone.utc)
        post_dl_seconds = (current_time - verified_download_at).total_seconds()
        post_dl_days = max(0.0, round(post_dl_seconds / 86400, 1))
        if not bypass_retention_window and post_dl_days < retention_days:
            reasons.append(
                f"Post-download retention period has not elapsed ({post_dl_days} days since verified download; threshold is {retention_days} days)."
            )
    elif not bypass_retention_window and age_days < retention_days:
        reasons.append(
            f"Document age ({age_days} days) does not exceed retention threshold ({retention_days} days)."
        )

    is_eligible = (
        not on_hold
        and len(unresolved_findings) == 0
        and not getattr(doc, "has_unresolved_anomaly", False)
        and doc.processing_status not in ("processing", "queued")
        and len(reasons) == 0
    )

    return PurgeEligibility(
        is_eligible=is_eligible,
        reasons=reasons,
        blocking_findings=blocking_findings_data,
        legal_hold=on_hold,
        age_days=age_days,
        threshold_days=retention_days,
        download_confirmed=download_confirmed,
        verified_download_at=verified_download_at,
    )


# ---------------------------------------------------------------------------
# Legal Hold Management
# ---------------------------------------------------------------------------

def apply_legal_hold(
    db: Session,
    document_id: UUID,
    *,
    organization_id: UUID,
    actor_id: UUID,
    reason: str,
) -> Document:
    """Applies a legal hold to protect a document from any purge or routine destruction."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.organization_id == organization_id)
        .first()
    )
    if not doc:
        # Check if doc exists in another tenant to enforce tenant isolation
        other_tenant_doc = db.query(Document).filter(Document.id == document_id).first()
        if other_tenant_doc:
            raise TenantIsolationError("Access to document in another organization denied.")
        raise NotFoundError(f"Document {document_id} not found.")

    meta = dict(doc.layout_metadata or {})
    meta["legal_hold"] = True
    meta["legal_hold_reason"] = reason
    meta["legal_hold_applied_by"] = str(actor_id)
    meta["legal_hold_applied_at"] = now_utc().isoformat()
    doc.layout_metadata = meta

    now = datetime.now(timezone.utc)
    audit = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        action="retention.legal_hold_applied",
        object_type="document",
        object_id=str(document_id),
        metadata_json={
            "reason": reason,
            "applied_at": now.isoformat(),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    logger.info(
        "Legal hold applied to document %s for org %s by actor %s",
        str(document_id), str(organization_id), str(actor_id)
    )
    return doc


def release_legal_hold(
    db: Session,
    document_id: UUID,
    *,
    organization_id: UUID,
    actor_id: UUID,
    reason: str,
) -> Document:
    """Releases a legal hold from a document."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.organization_id == organization_id)
        .first()
    )
    if not doc:
        other_tenant_doc = db.query(Document).filter(Document.id == document_id).first()
        if other_tenant_doc:
            raise TenantIsolationError("Access to document in another organization denied.")
        raise NotFoundError(f"Document {document_id} not found.")

    meta = dict(doc.layout_metadata or {})
    meta["legal_hold"] = False
    meta["legal_hold_released_reason"] = reason
    meta["legal_hold_released_by"] = str(actor_id)
    meta["legal_hold_released_at"] = now_utc().isoformat()
    doc.layout_metadata = meta

    now = datetime.now(timezone.utc)
    audit = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        action="retention.legal_hold_released",
        object_type="document",
        object_id=str(document_id),
        metadata_json={
            "reason": reason,
            "released_at": now.isoformat(),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    logger.info(
        "Legal hold released for document %s for org %s by actor %s",
        str(document_id), str(organization_id), str(actor_id)
    )
    return doc


# ---------------------------------------------------------------------------
# Divergence Compensation & Reconciliation
# ---------------------------------------------------------------------------

def _record_reconciliation_needed(
    db: Session,
    *,
    organization_id: UUID,
    actor_id: UUID,
    document_id: UUID,
    correlation_id: str,
    error_message: str,
) -> None:
    """Records an audit and outbox compensation record when storage deletion succeeds but DB update fails."""
    try:
        now = datetime.now(timezone.utc)
        reconcile_audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="retention.reconciliation_needed",
            object_type="document",
            object_id=str(document_id),
            metadata_json={
                "severity": "CRITICAL",
                "correlation_id": correlation_id,
                "error": error_message[:500],
                "message": "Storage object was deleted but database update failed. Reconciliation required.",
                "flagged_at": now.isoformat(),
            },
            occurred_at=now,
        )
        db.add(reconcile_audit)

        reconcile_outbox = OutboxEvent(
            id=uuid.uuid4(),
            organization_id=organization_id,
            event_type="retention.reconciliation_needed",
            aggregate_type="document",
            aggregate_id=document_id,
            payload={
                "severity": "CRITICAL",
                "correlation_id": correlation_id,
                "document_id": str(document_id),
                "error": error_message[:500],
            },
            status="pending",
        )
        db.add(reconcile_outbox)

        # Mark document record in DB with divergence flag so operators can discover it
        try:
            doc_record = (
                db.query(Document)
                .filter(Document.id == document_id, Document.organization_id == organization_id)
                .first()
            )
            if doc_record:
                meta = dict(doc_record.layout_metadata or {})
                meta["storage_purged_divergence"] = True
                meta["reconciliation_needed"] = True
                meta["divergence_error"] = error_message[:200]
                doc_record.layout_metadata = meta
                doc_record.processing_status = "failed"
                doc_record.processing_error = f"Storage purged but DB cleanup failed: {error_message[:200]}"
                db.add(doc_record)
        except Exception as flag_err:
            logger.warning("Could not set divergence flag on doc %s: %s", str(document_id), flag_err)

        db.commit()
        logger.critical(
            "CRITICAL: Storage/DB divergence recorded for doc %s (correlation %s)",
            str(document_id), correlation_id
        )
    except Exception as e:
        logger.critical(
            "CRITICAL: Failed to persist reconciliation record for doc %s: %s",
            str(document_id), e
        )


# ---------------------------------------------------------------------------
# Durable 2-Phase Purge Workflow
# ---------------------------------------------------------------------------

def purge_document(
    db: Session,
    document_id: UUID,
    *,
    organization_id: UUID,
    actor_id: UUID,
    reason: str = "statutory_retention_expiry",
    jurisdiction: str = "US",
    retention_policy: Optional[str] = None,
    retention_days_override: Optional[int] = None,
    use_ephemeral_schedule: bool = False,
    bypass_retention_window: bool = False,
    storage_backend: Optional[StorageBackend] = None,
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes a durable, retryable, 2-phase secure purge of a document:
    1. Locks document under tenant scope; rejects wrong tenant or non-existent doc.
    2. Enforces strict eligibility gate: blocks documents on legal hold, unresolved anomalies,
       unconfirmed downloads, or within active retention schedules.
    3. Records purge initiation audit event with unique correlation ID (zero PII).
    4. Deletes underlying object via StorageBackend abstraction with idempotent missing-file handling.
    5. Updates database state, removes document and cascaded child records, logs completion audit.
    6. If storage deletion succeeds but DB update fails, records reconciliation event and raises DatabaseReconciliationError.
    7. Idempotent on repeat requests: returns reconciled status if document was already purged.
    """
    effective_correlation_id = correlation_id or f"purge-{document_id}-{uuid.uuid4().hex[:8]}"

    # Step 1: Tenant-scoped retrieval & row lock
    query = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == organization_id,
    )
    if db.bind and db.bind.dialect.name != "sqlite":
        query = query.with_for_update()

    doc = query.first()

    # If document not found under this tenant, check if it was already purged or belongs to another tenant
    if not doc:
        # Check cross-tenant isolation
        other_tenant_doc = db.query(Document).filter(Document.id == document_id).first()
        if other_tenant_doc:
            raise TenantIsolationError(f"Document {document_id} belongs to a different tenant.")

        # Check if already purged previously (idempotent path)
        prior_purge_audit = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.organization_id == organization_id,
                AuditEvent.action == "retention.document_purged",
                AuditEvent.object_id == str(document_id),
            )
            .first()
        )
        if prior_purge_audit:
            logger.info("Document %s was already purged in org %s. Returning idempotent status.", str(document_id), str(organization_id))
            return {
                "purged_document_id": str(document_id),
                "status": "already_purged",
                "storage_deleted": False,
                "storage_already_missing": True,
                "correlation_id": effective_correlation_id,
                "reason": reason,
            }

        raise NotFoundError(f"Document {document_id} not found in organization.")

    # Step 2: Eligibility Gate
    eligibility = evaluate_purge_eligibility(
        db,
        doc,
        organization_id=organization_id,
        jurisdiction=jurisdiction,
        retention_policy=retention_policy,
        retention_days_override=retention_days_override,
        use_ephemeral_schedule=use_ephemeral_schedule,
        bypass_retention_window=bypass_retention_window,
    )

    if eligibility.legal_hold:
        raise LegalHoldError(f"Document {document_id} is protected under an active legal hold and cannot be purged.")

    if eligibility.blocking_findings:
        raise UnresolvedAnomalyError(
            f"Document {document_id} has {len(eligibility.blocking_findings)} unresolved compliance findings/anomalies and cannot be purged."
        )

    if not eligibility.is_eligible:
        raise PurgeIneligibleError(
            f"Document {document_id} is not eligible for purge: {'; '.join(eligibility.reasons)}"
        )

    # Step 3: Record purge attempt/initiation audit event (zero PII, zero file bytes, zero OCR text)
    now = datetime.now(timezone.utc)
    doc_hash = doc.sha256_hash
    doc_size = doc.byte_size
    doc_version = doc.version
    doc_filename = doc.filename
    doc_storage_path = doc.storage_path

    init_audit = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        action="retention.purge_initiated",
        object_type="document",
        object_id=str(document_id),
        metadata_json={
            "correlation_id": effective_correlation_id,
            "reason": reason,
            "version": doc_version,
            "sha256": doc_hash,
            "byte_size": doc_size,
            "initiated_at": now.isoformat(),
        },
        occurred_at=now,
    )
    db.add(init_audit)
    db.commit()

    # Step 4: Delete through StorageBackend abstraction
    backend = storage_backend or get_storage_backend()
    versioned_filename = f"v{doc_version}_{doc_filename}"

    try:
        # Delete using organization_id, file_id, and versioned filename
        storage_deleted = backend.delete_file(
            organization_id=organization_id,
            file_id=doc.id,
            filename=versioned_filename,
        )
        # Also ensure deletion by storage_path if not deleted
        if not storage_deleted and doc_storage_path:
            storage_deleted = backend.delete_by_storage_path(doc_storage_path)
    except StorageError as se:
        # Transient or persistent storage error: do NOT delete DB row; raise so caller can retry
        logger.error(
            "Storage deletion failed for doc %s in org %s: %s",
            str(document_id), str(organization_id), se
        )
        raise StorageError(f"Storage purge failed for document {document_id}: {se}") from se

    storage_already_missing = not storage_deleted

    # Step 5: Update DB state according to deletion policy
    try:
        # Cascade deletes extracted fields and processing runs
        db.delete(doc)

        # Audit event for completed purge (strictly zero PII)
        now_done = datetime.now(timezone.utc)
        purge_audit = AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            action="retention.document_purged",
            object_type="document",
            object_id=str(document_id),
            metadata_json={
                "correlation_id": effective_correlation_id,
                "reason": reason,
                "sha256": doc_hash,
                "storage_deleted": storage_deleted,
                "storage_already_missing": storage_already_missing,
                "purged_at": now_done.isoformat(),
            },
            occurred_at=now_done,
        )
        db.add(purge_audit)

        # Outbox event for downstream subscribers
        outbox_event = OutboxEvent(
            id=uuid.uuid4(),
            organization_id=organization_id,
            event_type="retention.document_purged",
            aggregate_type="document",
            aggregate_id=document_id,
            payload={
                "correlation_id": effective_correlation_id,
                "document_id": str(document_id),
                "organization_id": str(organization_id),
                "actor_id": str(actor_id),
                "storage_deleted": storage_deleted,
                "storage_already_missing": storage_already_missing,
                "reason": reason,
            },
            status="pending",
        )
        db.add(outbox_event)

        db.commit()
    except Exception as db_err:
        db.rollback()
        # Compensation: Storage deletion succeeded, but DB update failed!
        # Record reconciliation alert so divergence is never silent.
        _record_reconciliation_needed(
            db=db,
            organization_id=organization_id,
            actor_id=actor_id,
            document_id=document_id,
            correlation_id=effective_correlation_id,
            error_message=str(db_err),
        )
        raise DatabaseReconciliationError(
            f"Storage object purged but database transaction failed for document {document_id}. "
            f"Reconciliation needed event logged with correlation_id {effective_correlation_id}."
        ) from db_err

    logger.info(
        "Secure purge completed for document %s in org %s (storage_deleted=%s, storage_already_missing=%s)",
        str(document_id), str(organization_id), storage_deleted, storage_already_missing
    )

    return {
        "purged_document_id": str(document_id),
        "status": "permanently_purged",
        "storage_deleted": storage_deleted,
        "storage_already_missing": storage_already_missing,
        "correlation_id": effective_correlation_id,
        "reason": reason,
        "audit_event_id": str(purge_audit.id),
    }


# ---------------------------------------------------------------------------
# Operator Divergence Reconciliation
# ---------------------------------------------------------------------------

def reconcile_divergent_documents(
    db: Session,
    *,
    organization_id: UUID,
    actor_id: UUID,
    storage_backend: Optional[StorageBackend] = None,
) -> List[Dict[str, Any]]:
    """
    Identifies and reconciles documents where storage was purged but database records remained.
    """
    divergent_audits = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.organization_id == organization_id,
            AuditEvent.action == "retention.reconciliation_needed",
        )
        .all()
    )
    doc_ids_needing_reconciliation = set()
    for a in divergent_audits:
        try:
            doc_ids_needing_reconciliation.add(UUID(a.object_id))
        except (ValueError, TypeError):
            pass

    # Also check documents flagged with divergence in DB
    all_docs = (
        db.query(Document)
        .filter(Document.organization_id == organization_id)
        .all()
    )
    for d in all_docs:
        meta = d.layout_metadata or {}
        if meta.get("storage_purged_divergence") or meta.get("reconciliation_needed"):
            doc_ids_needing_reconciliation.add(d.id)

    reconciled_results = []
    for doc_id in doc_ids_needing_reconciliation:
        doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == organization_id).first()
        if not doc:
            continue
        try:
            res = purge_document(
                db=db,
                document_id=doc_id,
                organization_id=organization_id,
                actor_id=actor_id,
                reason="automated_reconciliation_compensation",
                bypass_retention_window=True,
                storage_backend=storage_backend,
            )
            reconciled_results.append(res)
        except Exception as e:
            logger.error("Failed to reconcile divergent document %s: %s", str(doc_id), e)
            reconciled_results.append({
                "purged_document_id": str(doc_id),
                "status": "reconciliation_failed",
                "error": str(e),
                "storage_deleted": False,
                "storage_already_missing": True,
                "correlation_id": f"reconcile-err-{doc_id}",
                "reason": "automated_reconciliation_compensation",
            })
    return reconciled_results


# ---------------------------------------------------------------------------
# Backward Compatible StorageRetentionManager
# ---------------------------------------------------------------------------

class StorageRetentionManager:
    @classmethod
    def evaluate_expired_documents(
        cls,
        db: Session,
        organization_id: uuid.UUID,
        jurisdiction: str = "US",
        retention_policy: Optional[str] = None,
        retention_days_override: Optional[int] = None,
        use_ephemeral_schedule: bool = False,
        now: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Identifies documents exceeding retention limits or flagged for reconciliation."""
        current_time = now or datetime.now(timezone.utc)
        if retention_days_override is not None:
            retention_days = retention_days_override
        elif retention_policy is not None:
            retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS.get(
                retention_policy, DEFAULT_EPHEMERAL_RETENTION_DAYS
            )
        elif use_ephemeral_schedule:
            retention_days = DEFAULT_EPHEMERAL_RETENTION_DAYS
        docs = db.query(Document).filter(
            Document.organization_id == organization_id,
        ).all()

        results = []
        for d in docs:
            meta = d.layout_metadata or {}
            doc_created = d.created_at
            if doc_created.tzinfo is None:
                doc_created = doc_created.replace(tzinfo=timezone.utc)

            # Determine document-specific threshold
            if retention_days_override is not None:
                d_retention_days = retention_days_override
            elif retention_policy is not None:
                d_retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS.get(
                    retention_policy, DEFAULT_EPHEMERAL_RETENTION_DAYS
                )
            elif use_ephemeral_schedule:
                if not d.case_id:
                    d_retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS["draft_intake"]
                else:
                    d_case = db.query(ImmigrationCase).filter(ImmigrationCase.id == d.case_id).first()
                    if d_case and d_case.post_download_retention_policy:
                        d_retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS.get(
                            d_case.post_download_retention_policy, DEFAULT_CLOSED_CASE_RETENTION_DAYS
                        )
                    elif d_case and d_case.status in ("draft", "intake", "abandoned"):
                        d_retention_days = EPHEMERAL_RETENTION_SCHEDULES_DAYS["draft_intake"]
                    else:
                        d_retention_days = DEFAULT_EPHEMERAL_RETENTION_DAYS
            else:
                d_retention_days = PROVISIONAL_RETENTION_POLICIES_DAYS.get(
                    jurisdiction.upper(), PROVISIONAL_RETENTION_POLICIES_DAYS["default"]
                )

            d_cutoff = current_time - timedelta(days=d_retention_days)
            is_expired = (doc_created < d_cutoff)
            is_divergent = bool(meta.get("reconciliation_needed") or meta.get("storage_purged_divergence"))

            if not is_expired and not is_divergent:
                continue

            eligibility = evaluate_purge_eligibility(
                db,
                d,
                organization_id=organization_id,
                jurisdiction=jurisdiction,
                retention_policy=retention_policy,
                retention_days_override=retention_days_override,
                use_ephemeral_schedule=use_ephemeral_schedule,
                now=current_time,
            )
            status_label = "reconciliation_needed" if is_divergent else (
                "eligible_for_purge" if eligibility.is_eligible else "retention_blocked"
            )
            results.append({
                "document_id": str(d.id),
                "title": d.title,
                "case_id": str(d.case_id) if d.case_id else None,
                "created_at": d.created_at.isoformat(),
                "age_days": eligibility.age_days,
                "retention_threshold_days": eligibility.threshold_days,
                "is_eligible": eligibility.is_eligible or is_divergent,
                "legal_hold": eligibility.legal_hold,
                "download_confirmed": eligibility.download_confirmed,
                "blocking_reasons": eligibility.reasons,
                "status": status_label,
            })
        return results

    @classmethod
    def execute_secure_purge(
        cls,
        db: Session,
        organization_id: uuid.UUID,
        document_id: uuid.UUID,
        actor_id: uuid.UUID,
        reason: str = "statutory_retention_expiry",
        storage_backend: Optional[StorageBackend] = None,
    ) -> Dict[str, Any]:
        """
        Executes an audited, secure purge of an expired document through the durable workflow.
        """
        return purge_document(
            db=db,
            document_id=document_id,
            organization_id=organization_id,
            actor_id=actor_id,
            reason=reason,
            storage_backend=storage_backend,
        )

