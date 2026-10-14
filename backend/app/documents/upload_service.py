import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

import jwt
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.errors import NotFoundError, PermissionDeniedError, ValidationError
from backend.app.documents.security import (
    calculate_sha256,
    sanitize_filename,
    validate_file_signature,
    MalwareScanner,
)
from backend.app.documents.storage import get_storage_backend
from backend.app.domain.models import (
    Document,
    DocumentUploadSession,
    AuditEvent,
    DocumentProcessingRun,
    OutboxEvent,
    now_utc,
)


def create_upload_session(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
    idempotency_key: str,
    filename: str,
    mime_type: str,
    byte_size: int | None = None,
    case_id: UUID | None = None,
    expires_in_minutes: int = 30,
) -> DocumentUploadSession:
    """Creates an authorized, idempotent upload session."""
    # Check for existing active session with same idempotency key
    existing = (
        db.query(DocumentUploadSession)
        .filter(
            DocumentUploadSession.organization_id == organization_id,
            DocumentUploadSession.idempotency_key == idempotency_key,
        )
        .first()
    )
    if existing:
        if existing.expires_at > now_utc() and existing.status == "initiated":
            return existing

    expires_at = now_utc() + timedelta(minutes=expires_in_minutes)
    session = DocumentUploadSession(
        organization_id=organization_id,
        user_id=user_id,
        case_id=case_id,
        idempotency_key=idempotency_key,
        expected_filename=sanitize_filename(filename),
        expected_mime_type=mime_type,
        expected_byte_size=byte_size,
        status="initiated",
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def process_document_upload(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
    content: bytes,
    filename: str,
    category: str = "supporting_evidence",
    title: str | None = None,
    declared_mime_type: str | None = None,
    case_id: UUID | None = None,
    client_id: UUID | None = None,
    parent_document_id: UUID | None = None,
    idempotency_key: str | None = None,
) -> Document:
    """
    Executes secure upload validation pipeline:
    1. File signature & size validation
    2. Malware heuristic scanning
    3. SHA-256 integrity hashing
    4. Idempotency & deduplication check
    5. Versioning linking
    6. Isolated private storage persistence
    7. Database entity registration
    """
    safe_filename = sanitize_filename(filename)

    # 1. File signature & type validation
    is_valid_sig, detected_mime, sig_error = validate_file_signature(
        content, declared_mime_type, safe_filename
    )
    if not is_valid_sig:
        raise ValidationError(sig_error or "Invalid file signature.")

    # 2. Malware scanning integration
    is_clean, scan_details = MalwareScanner.scan_content(content, safe_filename)
    if not is_clean:
        raise ValidationError(f"Malware scanning violation: {scan_details}")

    # 3. SHA-256 integrity hash
    sha256_hash = calculate_sha256(content)

    # 4. Upload idempotency & deduplication
    # If the exact same file is uploaded for this case and org with the same hash or idempotency key
    if case_id:
        existing_doc = (
            db.query(Document)
            .filter(
                Document.organization_id == organization_id,
                Document.case_id == case_id,
                Document.sha256_hash == sha256_hash,
                Document.is_current_version.is_(True),
            )
            .first()
        )
        if existing_doc:
            # Idempotent re-upload of identical document content
            return existing_doc

    if idempotency_key:
        upload_session = (
            db.query(DocumentUploadSession)
            .filter(
                DocumentUploadSession.organization_id == organization_id,
                DocumentUploadSession.idempotency_key == idempotency_key,
            )
            .first()
        )
        if upload_session:
            upload_session.status = "completed"

    # 5. Versioning
    version = 1
    if parent_document_id:
        parent_doc = (
            db.query(Document)
            .filter(
                Document.id == parent_document_id,
                Document.organization_id == organization_id,
            )
            .first()
        )
        if not parent_doc:
            raise NotFoundError("Parent document specified for versioning not found.")

        # Increment version and supersede previous version
        version = parent_doc.version + 1
        parent_doc.is_current_version = False
        db.add(parent_doc)

    doc_id = uuid.uuid4()

    # 6. Private object storage persistence
    storage = get_storage_backend()
    storage_artifact = storage.store_file(
        organization_id=organization_id,
        file_id=doc_id,
        filename=f"v{version}_{safe_filename}",
        content=content,
        content_type=detected_mime,
    )

    # 7. Document DB record
    doc_title = title.strip() if title else safe_filename
    doc = Document(
        id=doc_id,
        organization_id=organization_id,
        case_id=case_id,
        client_id=client_id,
        uploaded_by_user_id=user_id,
        title=doc_title,
        filename=safe_filename,
        category=category,
        storage_path=storage_artifact.storage_path,
        sha256_hash=sha256_hash,
        byte_size=len(content),
        mime_type=detected_mime,
        version=version,
        parent_document_id=parent_document_id,
        is_current_version=True,
        malware_scan_status="clean",
        malware_scan_details=scan_details,
        processing_status="pending",
        verification_status="unverified",
    )
    db.add(doc)

    # 8. Record initial processing run and transactional outbox event
    effective_idempotency_key = idempotency_key or f"run-{doc_id}-{uuid.uuid4()}"
    existing_run = (
        db.query(DocumentProcessingRun)
        .filter(
            DocumentProcessingRun.organization_id == organization_id,
            DocumentProcessingRun.idempotency_key == effective_idempotency_key,
        )
        .first()
    )
    if existing_run:
        effective_idempotency_key = f"{effective_idempotency_key}-v{version}-{uuid.uuid4().hex[:6]}"

    run_id = uuid.uuid4()
    run = DocumentProcessingRun(
        id=run_id,
        organization_id=organization_id,
        document_id=doc_id,
        run_number=version,
        idempotency_key=effective_idempotency_key,
        stage="queued",
        status="queued",
        trigger_type="upload",
        progress_percent=0,
        metrics={},
    )
    db.add(run)

    outbox_event = OutboxEvent(
        id=uuid.uuid4(),
        organization_id=organization_id,
        event_type="document.processing.requested",
        aggregate_type="document",
        aggregate_id=doc_id,
        payload={
            "document_id": str(doc_id),
            "run_id": str(run_id),
            "organization_id": str(organization_id),
            "idempotency_key": effective_idempotency_key,
            "trigger": "upload",
        },
        status="pending",
    )
    db.add(outbox_event)

    # 9. Record audit event
    audit = AuditEvent(
        organization_id=organization_id,
        actor_id=user_id,
        action="document.uploaded",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "filename": safe_filename,
            "category": category,
            "version": version,
            "sha256_hash": sha256_hash,
            "byte_size": len(content),
            "mime_type": detected_mime,
        },
        after_hash=sha256_hash,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return doc


def generate_download_token(
    document_id: UUID,
    user_id: UUID,
    organization_id: UUID,
    expires_in_seconds: int = 300,
) -> str:
    """Generates a short-lived signed access token for secure streaming downloads."""
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "doc_id": str(document_id),
        "org_id": str(organization_id),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds),
        "iat": datetime.now(timezone.utc),
        "purpose": "doc_download",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def verify_download_token(token: str, expected_doc_id: UUID) -> dict:
    """Verifies and decodes a short-lived download token."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "doc_download":
            raise PermissionDeniedError("Invalid token purpose.")
        if payload.get("doc_id") != str(expected_doc_id):
            raise PermissionDeniedError("Download token does not match requested document.")
        return payload
    except jwt.ExpiredSignatureError:
        raise PermissionDeniedError("Download access URL has expired. Please request a fresh link.")
    except jwt.PyJWTError:
        raise PermissionDeniedError("Invalid or forged download token.")
