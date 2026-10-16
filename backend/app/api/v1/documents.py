import io
import uuid
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Header,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.errors import (
    AppException,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    TenantIsolationError,
    ValidationError,
)
from backend.app.db.session import get_db
from backend.app.documents.processor import (
    process_document_pipeline,
    process_document_background_task,
)
from backend.app.documents.retention import (
    purge_document,
    apply_legal_hold,
    release_legal_hold,
    reconcile_divergent_documents,
    StorageRetentionManager,
    LegalHoldError,
    UnresolvedAnomalyError,
    PurgeIneligibleError,
    DatabaseReconciliationError,
)
from backend.app.documents.storage import get_storage_backend
from backend.app.documents.upload_service import (
    create_upload_session,
    generate_download_token,
    process_document_upload,
    verify_download_token,
)
from backend.app.domain.models import (
    AuditEvent,
    ClientDependant,
    ClientProfile,
    Document,
    DocumentExtractedField,
    DocumentProcessingRun,
    OutboxEvent,
    ImmigrationCase,
    now_utc,
)
from backend.app.security.auth import AuthContext, get_auth_context

router = APIRouter(prefix="/documents", tags=["documents"])


# --- Pydantic Schemas ---

class CreateUploadSessionRequest(BaseModel):
    idempotency_key: str = Field(..., max_length=128)
    filename: str = Field(..., max_length=255)
    mime_type: str = Field(..., max_length=100)
    byte_size: Optional[int] = None
    case_id: Optional[UUID] = None


class UploadSessionResponse(BaseModel):
    session_id: UUID
    idempotency_key: str
    expected_filename: str
    status: str
    expires_at: datetime


class ExtractedFieldResponse(BaseModel):
    id: UUID
    field_name: str
    field_label: str
    original_value: str
    normalized_value: Optional[str]
    source_page: int
    source_location: Optional[dict]
    extraction_method: str
    model_version: Optional[str]
    ocr_confidence: Optional[float]
    extraction_confidence: Optional[float]
    validation_status: str
    is_manually_corrected: bool
    corrected_value: Optional[str]
    corrected_at: Optional[datetime]
    correction_reason: Optional[str]
    correction_history: list[dict]


class DocumentSummaryResponse(BaseModel):
    id: UUID
    title: str
    filename: str
    category: str
    sha256_hash: str
    byte_size: int
    mime_type: str
    version: int
    is_current_version: bool
    processing_status: str
    verification_status: str
    detected_language: Optional[str]
    page_count: int
    ocr_applied: bool
    case_id: Optional[UUID]
    client_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(DocumentSummaryResponse):
    extracted_text: Optional[str] = None
    layout_metadata: dict = {}
    extracted_fields: list[ExtractedFieldResponse] = []
    verification_notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by_user_id: Optional[UUID] = None
    malware_scan_status: str
    malware_scan_details: Optional[str] = None
    processing_error: Optional[str] = None
    retry_count: int = 0
    download_url: Optional[str] = None
    active_run_id: Optional[UUID] = None
    active_run_stage: Optional[str] = None
    active_run_progress_percent: Optional[int] = None


class ProcessingRunResponse(BaseModel):
    id: UUID
    organization_id: UUID
    document_id: UUID
    run_number: int
    idempotency_key: str
    stage: str
    status: str
    trigger_type: str
    progress_percent: int
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metrics: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VerifyDocumentRequest(BaseModel):
    status: str = Field(..., pattern="^(verified|rejected|under_review)$")
    notes: Optional[str] = None


class CorrectFieldRequest(BaseModel):
    corrected_value: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=3)


class PurgeDocumentRequest(BaseModel):
    reason: str = Field("statutory_retention_expiry", min_length=3, max_length=255)
    bypass_retention_window: bool = False
    jurisdiction: str = Field("US", min_length=2, max_length=10)


class PurgeDocumentResponse(BaseModel):
    purged_document_id: str
    status: str
    storage_deleted: bool
    storage_already_missing: bool
    correlation_id: str
    reason: str
    audit_event_id: Optional[str] = None


class LegalHoldRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class RetentionEvaluationItem(BaseModel):
    document_id: str
    title: str
    case_id: Optional[str] = None
    created_at: str
    age_days: float
    retention_threshold_days: int
    is_eligible: bool
    legal_hold: bool
    blocking_reasons: list[str] = []
    status: str


# --- Authorization Helper ---

def assert_document_access(auth: AuthContext, doc: Document, db: Session) -> None:
    """Enforces strict tenant isolation and object-level permissions on documents."""
    auth.assert_organization_access(doc.organization_id)

    # Retained client access boundary
    if auth.is_retained_client():
        # 1. Directly uploaded by this user
        if doc.uploaded_by_user_id == auth.user_id:
            return

        # 2. Attached to a client profile matching this user
        if doc.client_id:
            client_profile = db.query(ClientProfile).filter(ClientProfile.id == doc.client_id).first()
            if client_profile and client_profile.user_id == auth.user_id:
                return

        # 3. Attached to a case the client or authorized dependant can access
        if doc.case_id:
            case = db.query(ImmigrationCase).filter(ImmigrationCase.id == doc.case_id).first()
            if case:
                client_user_id = case.client.user_id if case.client else None
                dep_user_ids = [
                    d.user_id
                    for d in db.query(ClientDependant)
                    .filter(
                        ClientDependant.primary_client_id == case.client_id,
                        ClientDependant.is_authorized_to_view_case.is_(True),
                        ClientDependant.user_id.is_not(None),
                    )
                    .all()
                ]
                auth.assert_case_access(
                    case=case,
                    client_user_id=client_user_id,
                    authorized_dependant_user_ids=dep_user_ids,
                )
                return

        raise PermissionDeniedError("Retained clients can only access documents linked to their own active petitions.")


def _to_detail_response(
    doc: Document,
    auth: AuthContext,
    active_run: Optional[DocumentProcessingRun] = None,
    db: Optional[Session] = None,
) -> DocumentDetailResponse:
    download_token = generate_download_token(doc.id, auth.user_id, auth.organization_id)
    fields = [
        ExtractedFieldResponse(
            id=f.id,
            field_name=f.field_name,
            field_label=f.field_label,
            original_value=f.original_value,
            normalized_value=f.normalized_value,
            source_page=f.source_page,
            source_location=f.source_location,
            extraction_method=f.extraction_method,
            model_version=f.model_version,
            ocr_confidence=f.ocr_confidence,
            extraction_confidence=f.extraction_confidence,
            validation_status=f.validation_status,
            is_manually_corrected=f.is_manually_corrected,
            corrected_value=f.corrected_value,
            corrected_at=f.corrected_at,
            correction_reason=f.correction_reason,
            correction_history=f.correction_history or [],
        )
        for f in (doc.extracted_fields or [])
    ]

    run_id = None
    run_stage = None
    run_progress = None
    if active_run:
        run_id = active_run.id
        run_stage = active_run.stage
        run_progress = active_run.progress_percent
    elif db is not None:
        latest_run = (
            db.query(DocumentProcessingRun)
            .filter(DocumentProcessingRun.document_id == doc.id)
            .order_by(DocumentProcessingRun.created_at.desc())
            .first()
        )
        if latest_run:
            run_id = latest_run.id
            run_stage = latest_run.stage
            run_progress = latest_run.progress_percent
    elif hasattr(doc, "processing_runs") and doc.processing_runs:
        latest_run = max(doc.processing_runs, key=lambda r: (r.run_number or 0, r.created_at or datetime.min))
        run_id = latest_run.id
        run_stage = latest_run.stage
        run_progress = latest_run.progress_percent

    return DocumentDetailResponse(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        category=doc.category,
        sha256_hash=doc.sha256_hash,
        byte_size=doc.byte_size,
        mime_type=doc.mime_type,
        version=doc.version,
        is_current_version=doc.is_current_version,
        processing_status=doc.processing_status,
        verification_status=doc.verification_status,
        detected_language=doc.detected_language,
        page_count=doc.page_count,
        ocr_applied=doc.ocr_applied,
        case_id=doc.case_id,
        client_id=doc.client_id,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        extracted_text=doc.extracted_text,
        layout_metadata=doc.layout_metadata or {},
        extracted_fields=fields,
        verification_notes=doc.verification_notes,
        verified_at=doc.verified_at,
        verified_by_user_id=doc.verified_by_user_id,
        malware_scan_status=doc.malware_scan_status,
        malware_scan_details=doc.malware_scan_details,
        processing_error=doc.processing_error,
        retry_count=doc.retry_count,
        download_url=f"/api/v1/documents/{doc.id}/download?token={download_token}",
        active_run_id=run_id,
        active_run_stage=run_stage,
        active_run_progress_percent=run_progress,
    )


# --- API Routes ---

@router.post("/upload-sessions", response_model=UploadSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: CreateUploadSessionRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Creates an authorized upload session with an idempotency key."""
    session = create_upload_session(
        db=db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        idempotency_key=payload.idempotency_key,
        filename=payload.filename,
        mime_type=payload.mime_type,
        byte_size=payload.byte_size,
        case_id=payload.case_id,
    )
    return UploadSessionResponse(
        session_id=session.id,
        idempotency_key=session.idempotency_key,
        expected_filename=session.expected_filename,
        status=session.status,
        expires_at=session.expires_at,
    )


@router.post("/upload", response_model=DocumentDetailResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("supporting_evidence"),
    title: Optional[str] = Form(None),
    case_id: Optional[UUID] = Form(None),
    client_id: Optional[UUID] = Form(None),
    parent_document_id: Optional[UUID] = Form(None),
    idempotency_key: Optional[str] = Form(None),
    run_async: bool = Form(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    response: Response = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Secure document intake:
    - Validates file signature (magic bytes)
    - Anti-malware scanning verification
    - SHA-256 integrity hash
    - Idempotency deduplication
    - Tenant-isolated object storage
    - Asynchronous OCR & structured field extraction with data provenance
    """
    content = await file.read()
    if not content:
        raise ValidationError("Uploaded file is empty (0 bytes).")

    # If case_id provided, verify case access
    if case_id:
        case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
        if not case:
            raise NotFoundError("Referenced immigration case not found.")
        auth.assert_case_access(case)
        if not client_id:
            client_id = case.client_id

    doc = process_document_upload(
        db=db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        content=content,
        filename=file.filename or "document.pdf",
        category=category,
        title=title,
        declared_mime_type=file.content_type,
        case_id=case_id,
        client_id=client_id,
        parent_document_id=parent_document_id,
        idempotency_key=idempotency_key,
    )

    # Process extraction
    if run_async:
        if response is not None:
            response.status_code = status.HTTP_202_ACCEPTED
        background_tasks.add_task(process_document_background_task, doc.id)
    else:
        doc = process_document_pipeline(db, doc.id)

    return _to_detail_response(doc, auth, db=db)


@router.get("", response_model=list[DocumentSummaryResponse])
def list_documents(
    case_id: Optional[UUID] = Query(None),
    client_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    processing_status: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_only: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    response: Response = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists organization documents with filters, search, and pagination."""
    query = db.query(Document).filter(Document.organization_id == auth.organization_id)

    if current_only:
        query = query.filter(Document.is_current_version.is_(True))

    if case_id:
        query = query.filter(Document.case_id == case_id)
    if client_id:
        query = query.filter(Document.client_id == client_id)
    if category:
        query = query.filter(Document.category == category)
    if processing_status:
        query = query.filter(Document.processing_status == processing_status)
    if verification_status:
        query = query.filter(Document.verification_status == verification_status)
    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            (Document.title.ilike(search_filter))
            | (Document.filename.ilike(search_filter))
            | (Document.extracted_text.ilike(search_filter))
        )

    # Retained client access filter
    if auth.is_retained_client():
        # Get cases client is authorized to see
        client_profile = db.query(ClientProfile).filter(ClientProfile.user_id == auth.user_id).first()
        client_id_val = client_profile.id if client_profile else None
        query = query.filter(
            (Document.uploaded_by_user_id == auth.user_id)
            | (Document.client_id == client_id_val)
        )

    total = query.count()
    docs = query.order_by(Document.created_at.desc()).offset(offset).limit(limit).all()

    if response:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Limit"] = str(limit)
        response.headers["X-Offset"] = str(offset)

    return [
        DocumentSummaryResponse(
            id=d.id,
            title=d.title,
            filename=d.filename,
            category=d.category,
            sha256_hash=d.sha256_hash,
            byte_size=d.byte_size,
            mime_type=d.mime_type,
            version=d.version,
            is_current_version=d.is_current_version,
            processing_status=d.processing_status,
            verification_status=d.verification_status,
            detected_language=d.detected_language,
            page_count=d.page_count,
            ocr_applied=d.ocr_applied,
            case_id=d.case_id,
            client_id=d.client_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in docs
    ]


@router.get("/retention/evaluations", response_model=list[RetentionEvaluationItem])
def get_retention_evaluations(
    jurisdiction: str = Query("US"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists organization documents with their retention and purge eligibility status."""
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to view retention evaluations.")

    evaluations = StorageRetentionManager.evaluate_expired_documents(
        db=db,
        organization_id=auth.organization_id,
        jurisdiction=jurisdiction,
    )
    return [RetentionEvaluationItem(**e) for e in evaluations]


@router.post("/retention/reconcile", response_model=list[PurgeDocumentResponse])
def reconcile_documents_endpoint(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Reconciles documents where storage was purged but database records remained."""
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to reconcile documents.")

    results = reconcile_divergent_documents(
        db=db,
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
    )
    return [
        PurgeDocumentResponse(
            purged_document_id=r.get("purged_document_id", ""),
            status=r.get("status", "unknown"),
            storage_deleted=r.get("storage_deleted", False),
            storage_already_missing=r.get("storage_already_missing", True),
            correlation_id=r.get("correlation_id", "reconcile"),
            reason=r.get("reason", "reconciliation"),
            audit_event_id=r.get("audit_event_id"),
        )
        for r in results
    ]


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves full document dossier, extracted fields with data provenance, and status."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")

    assert_document_access(auth, doc, db)
    return _to_detail_response(doc, auth, db=db)


@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    token: Optional[str] = Query(None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Secure streaming download with short-lived token or active authentication."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    if token:
        verify_download_token(token, doc.id)
    else:
        assert_document_access(auth, doc, db)

    storage = get_storage_backend()
    content, actual_hash = storage.read_file(
        organization_id=doc.organization_id,
        file_id=doc.id,
        filename=f"v{doc.version}_{doc.filename}",
        expected_hash=doc.sha256_hash,
    )

    return StreamingResponse(
        io.BytesIO(content),
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.filename}"',
            "Content-Length": str(len(content)),
            "X-SHA256": actual_hash,
        },
    )


@router.get("/{document_id}/preview")
def preview_document(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Streams document for in-browser visual inspection."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)

    storage = get_storage_backend()
    content, actual_hash = storage.read_file(
        organization_id=doc.organization_id,
        file_id=doc.id,
        filename=f"v{doc.version}_{doc.filename}",
        expected_hash=doc.sha256_hash,
    )

    return StreamingResponse(
        io.BytesIO(content),
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{doc.filename}"',
            "Content-Length": str(len(content)),
            "X-SHA256": actual_hash,
        },
    )


@router.post("/{document_id}/reprocess", response_model=DocumentDetailResponse)
def reprocess_document(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Triggers re-extraction and OCR analysis while preserving prior human corrections."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)
    if auth.is_retained_client():
        raise PermissionDeniedError("Clients cannot trigger technical document reprocessing.")

    # Record new run and outbox event
    prior_runs_count = db.query(DocumentProcessingRun).filter_by(document_id=doc.id).count()
    run_id = uuid.uuid4()
    run = DocumentProcessingRun(
        id=run_id,
        organization_id=doc.organization_id,
        document_id=doc.id,
        run_number=prior_runs_count + 1,
        idempotency_key=f"reprocess-{doc.id}-{uuid.uuid4()}",
        stage="queued",
        status="queued",
        trigger_type="reprocess",
        progress_percent=0,
    )
    db.add(run)

    outbox_event = OutboxEvent(
        id=uuid.uuid4(),
        organization_id=doc.organization_id,
        event_type="document.processing.requested",
        aggregate_type="document",
        aggregate_id=doc.id,
        payload={
            "document_id": str(doc.id),
            "run_id": str(run_id),
            "organization_id": str(doc.organization_id),
            "trigger": "reprocess",
        },
        status="pending",
    )
    db.add(outbox_event)
    db.commit()

    doc = process_document_pipeline(db, doc.id)
    return _to_detail_response(doc, auth, db=db)


@router.get("/{document_id}/runs", response_model=list[ProcessingRunResponse])
def list_document_processing_runs(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Returns all processing runs for a document in descending chronological order."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)

    runs = (
        db.query(DocumentProcessingRun)
        .filter(DocumentProcessingRun.document_id == document_id)
        .order_by(DocumentProcessingRun.created_at.desc())
        .all()
    )
    return runs


@router.put("/{document_id}/verify", response_model=DocumentDetailResponse)
def verify_document(
    document_id: UUID,
    payload: VerifyDocumentRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Human verification workflow:
    Explicitly decoupled from automated OCR/extraction. Only authorized case workers,
    reviewers, or admins can mark a document as verified or rejected.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)
    if auth.is_retained_client():
        raise PermissionDeniedError("Clients cannot certify or verify legal evidence.")

    doc.verification_status = payload.status
    doc.verified_by_user_id = auth.user_id
    doc.verified_at = now_utc()
    doc.verification_notes = payload.notes

    audit = AuditEvent(
        organization_id=doc.organization_id,
        actor_id=auth.user_id,
        action="document.verified",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "status": payload.status,
            "notes": payload.notes,
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return _to_detail_response(doc, auth, db=db)


@router.put("/{document_id}/fields/{field_id}", response_model=ExtractedFieldResponse)
def correct_field(
    document_id: UUID,
    field_id: UUID,
    payload: CorrectFieldRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Manual human field correction:
    Preserves original extracted value, records audit correction history,
    user attribution, timestamp, and justification reason.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)
    if auth.is_retained_client():
        raise PermissionDeniedError("Clients cannot edit extracted metadata records directly.")

    field = (
        db.query(DocumentExtractedField)
        .filter(
            DocumentExtractedField.id == field_id,
            DocumentExtractedField.document_id == document_id,
        )
        .first()
    )
    if not field:
        raise NotFoundError("Extracted field not found.")

    # Record history
    history = list(field.correction_history or [])
    prev_val = field.corrected_value or field.normalized_value or field.original_value
    history.append(
        {
            "timestamp": now_utc().isoformat(),
            "user_id": str(auth.user_id),
            "previous_value": prev_val,
            "new_value": payload.corrected_value.strip(),
            "reason": payload.reason.strip(),
        }
    )

    field.is_manually_corrected = True
    field.corrected_value = payload.corrected_value.strip()
    field.corrected_by_user_id = auth.user_id
    field.corrected_at = now_utc()
    field.correction_reason = payload.reason.strip()
    field.correction_history = history
    field.validation_status = "corrected"

    audit = AuditEvent(
        organization_id=doc.organization_id,
        actor_id=auth.user_id,
        action="document_field.corrected",
        object_type="document_extracted_field",
        object_id=str(field.id),
        metadata_json={
            "document_id": str(doc.id),
            "field_name": field.field_name,
            "previous_value": prev_val,
            "new_value": field.corrected_value,
            "reason": payload.reason,
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(field)

    return ExtractedFieldResponse(
        id=field.id,
        field_name=field.field_name,
        field_label=field.field_label,
        original_value=field.original_value,
        normalized_value=field.normalized_value,
        source_page=field.source_page,
        source_location=field.source_location,
        extraction_method=field.extraction_method,
        model_version=field.model_version,
        ocr_confidence=field.ocr_confidence,
        extraction_confidence=field.extraction_confidence,
        validation_status=field.validation_status,
        is_manually_corrected=field.is_manually_corrected,
        corrected_value=field.corrected_value,
        corrected_at=field.corrected_at,
        correction_reason=field.correction_reason,
        correction_history=field.correction_history,
    )


@router.get("/{document_id}/versions", response_model=list[DocumentSummaryResponse])
def get_versions(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves document version history lineage."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)

    # Find root document
    root_id = doc.parent_document_id or doc.id
    while True:
        parent = db.query(Document).filter(Document.id == root_id).first()
        if parent and parent.parent_document_id:
            root_id = parent.parent_document_id
        else:
            break

    # Get all documents in this lineage
    versions = (
        db.query(Document)
        .filter(
            Document.organization_id == auth.organization_id,
            (Document.id == root_id) | (Document.parent_document_id == root_id),
        )
        .order_by(Document.version.asc())
        .all()
    )

    return [
        DocumentSummaryResponse(
            id=d.id,
            title=d.title,
            filename=d.filename,
            category=d.category,
            sha256_hash=d.sha256_hash,
            byte_size=d.byte_size,
            mime_type=d.mime_type,
            version=d.version,
            is_current_version=d.is_current_version,
            processing_status=d.processing_status,
            verification_status=d.verification_status,
            detected_language=d.detected_language,
            page_count=d.page_count,
            ocr_applied=d.ocr_applied,
            case_id=d.case_id,
            client_id=d.client_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in versions
    ]


@router.post("/{document_id}/purge", response_model=PurgeDocumentResponse)
def purge_document_endpoint(
    document_id: UUID,
    payload: Optional[PurgeDocumentRequest] = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Executes a permanent, audited purge of a document from both object storage and database.
    Restricted to organization staff and administrators.
    """
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to execute purge operations.")

    reason = payload.reason if payload else "statutory_retention_expiry"
    bypass_retention = payload.bypass_retention_window if payload else False
    jurisdiction = payload.jurisdiction if payload else "US"

    try:
        result = purge_document(
            db=db,
            document_id=document_id,
            organization_id=auth.organization_id,
            actor_id=auth.user_id,
            reason=reason,
            jurisdiction=jurisdiction,
            bypass_retention_window=bypass_retention,
        )
        return PurgeDocumentResponse(**result)
    except (LegalHoldError, UnresolvedAnomalyError) as e:
        raise ConflictError(str(e))
    except PurgeIneligibleError as e:
        raise ValidationError(str(e))
    except DatabaseReconciliationError as e:
        raise AppException(message=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/{document_id}/legal-hold", response_model=DocumentDetailResponse)
def apply_legal_hold_endpoint(
    document_id: UUID,
    payload: LegalHoldRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Applies a legal hold to protect a document from any purge or routine destruction."""
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to apply legal holds.")

    doc = apply_legal_hold(
        db=db,
        document_id=document_id,
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        reason=payload.reason,
    )
    return _to_detail_response(doc, auth, db=db)


@router.delete("/{document_id}/legal-hold", response_model=DocumentDetailResponse)
def release_legal_hold_endpoint(
    document_id: UUID,
    reason: str = Query("legal_hold_released"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Releases a legal hold from a document."""
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to release legal holds.")

    doc = release_legal_hold(
        db=db,
        document_id=document_id,
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        reason=reason,
    )
    return _to_detail_response(doc, auth, db=db)
