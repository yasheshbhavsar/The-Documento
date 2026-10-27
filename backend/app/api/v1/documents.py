import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
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
from backend.app.documents.boundaries import detect_document_boundaries, split_combined_document
from backend.app.documents.inactivity_service import DocumentInactivityService
from backend.app.documents.processor import (
    process_document_pipeline,
    process_document_background_task,
)
from backend.app.documents.retention import (
    purge_document,
    apply_legal_hold,
    release_legal_hold,
    reconcile_divergent_documents,
    is_document_on_legal_hold,
    get_unresolved_document_findings,
    StorageRetentionManager,
    LegalHoldError,
    UnresolvedAnomalyError,
    PurgeIneligibleError,
    DatabaseReconciliationError,
)
from backend.app.documents.security import (
    calculate_sha256,
    sanitize_filename,
    validate_file_signature,
    MalwareScanner,
)
from backend.app.documents.storage import get_storage_backend
from backend.app.documents.upload_service import (
    create_upload_session,
    generate_download_token,
    generate_purge_confirmation_token,
    process_document_upload,
    verify_download_token,
    verify_purge_confirmation_token,
)
from backend.app.domain.models import (
    AuditEvent,
    CaseAIFinding,
    CaseInterimReport,
    ClientDependant,
    ClientProfile,
    Document,
    DocumentExtractedField,
    DocumentProcessingRun,
    DocumentRequest,
    OutboxEvent,
    ImmigrationCase,
    PackageDownloadEvent,
    now_utc,
)
from backend.app.notifications.service import NotificationService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.ai.document_intelligence import (
    evaluate_document_six_dimensions,
    DocumentSixDimensionsReview,
    OCR_LEGAL_SUFFICIENCY_DISCLAIMER,
)
from backend.app.extraction.service import format_field_extraction_provenance

logger = logging.getLogger("ai_immigration.api.documents")

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
    applicant_dependant_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    proposed_category: Optional[str] = None
    proposed_applicant_name: Optional[str] = None
    is_assignment_confirmed: bool = True
    has_unresolved_anomaly: bool = False
    is_purged: bool = False
    lifecycle_state: str = "uploaded"
    structured_reason_code: Optional[str] = None
    client_explanation: Optional[str] = None


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
    sub_documents_metadata: list = []
    anomaly_notes: Optional[str] = None
    review_dimensions: Optional[dict] = None
    provenance_extractions: list[dict] = []
    three_tier_extractions: list[dict] = []
    legal_sufficiency_disclaimer: str = OCR_LEGAL_SUFFICIENCY_DISCLAIMER


# --- Phase 4 Statutory & Lifecycle Disclaimers ---

UPLOAD_NON_ACCEPTANCE_DISCLAIMER = (
    "Upload receipt is not acceptance or readiness. Document upload confirms receipt of your file in storage "
    "for verification and technical processing. Uploaded files must still be reviewed and verified by an "
    "authorized officer, and filing package eligibility is evaluated separately under applicable statutory rules."
)

FAMILY_SUMMARY_DISCLAIMER = (
    "Family checklist completion indicates intake progress only. Formal legal package readiness and eligibility "
    "are evaluated separately."
)

VERIFIED_DOWNLOAD_LIMITS_NOTICE = (
    "Verification confirms client-side receipt in the active browser session. Local storage persistence, backups, "
    "and user disk integrity cannot be verified by Documento after transfer."
)

LOCAL_COPY_NOTICE = (
    "Documento purges the server-side file and storage replica. Documento cannot and does not claim to delete any "
    "local copies or downloads that may have been saved to your personal computer, device, or external backup media."
)

REQUIRED_LOCAL_COPY_ACKNOWLEDGMENT = (
    "I understand that local copies already downloaded to my device cannot be deleted by Documento and remain my responsibility."
)


# --- Phase 4 Schemas ---

class UploadGuidanceResponse(BaseModel):
    focus_guidance: str
    lighting_guidance: str
    glare_guidance: str
    orientation_guidance: str
    corners_guidance: str
    legibility_guidance: str
    supported_mime_types: list[str]
    max_file_size_bytes: int
    non_acceptance_disclaimer: str


class BatchUploadItemReceipt(BaseModel):
    document_id: Optional[UUID] = None
    filename: str
    byte_size: int
    sha256_hash: str
    status: str  # uploaded, duplicate_existing, failed
    is_duplicate: bool = False
    existing_document_id: Optional[UUID] = None
    proposed_category: Optional[str] = None
    proposed_applicant_name: Optional[str] = None
    is_assignment_confirmed: bool = True
    error_message: Optional[str] = None


class BatchUploadReceiptResponse(BaseModel):
    batch_id: UUID
    total_files: int
    uploaded_count: int
    duplicate_count: int
    failed_count: int
    items: list[BatchUploadItemReceipt]
    non_acceptance_disclaimer: str


class SplitSectionDefinition(BaseModel):
    section_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=64)
    start_page: int = Field(..., ge=1)
    end_page: int = Field(..., ge=1)
    applicant_dependant_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    proposed_applicant_name: Optional[str] = None


class SplitSectionsRequest(BaseModel):
    sections: Optional[list[SplitSectionDefinition]] = None


class SplitSectionsResponse(BaseModel):
    parent_document_id: UUID
    sections_count: int
    created_documents: list[DocumentSummaryResponse]


class ConfirmAssignmentRequest(BaseModel):
    applicant_dependant_id: Optional[UUID] = None
    confirmed_category: Optional[str] = None


class ApplicantDocumentItem(BaseModel):
    document_id: UUID
    title: str
    category: str
    processing_status: str
    verification_status: str
    has_unresolved_anomaly: bool
    created_at: datetime


class ApplicantOutstandingItem(BaseModel):
    requirement_id: Optional[str] = None
    title: str
    category: str
    is_mandatory: bool = True


class ApplicantDocumentSummary(BaseModel):
    applicant_id: Optional[UUID]
    applicant_name: str
    relationship: str
    outstanding: list[ApplicantOutstandingItem] = []
    received: list[ApplicantDocumentItem] = []
    correction_required: list[ApplicantDocumentItem] = []


class FamilyDocumentsSummaryResponse(BaseModel):
    case_id: UUID
    case_number: str
    total_required: int
    total_received: int
    total_verified: int
    total_correction_required: int
    total_unassigned: int
    applicants: list[ApplicantDocumentSummary]
    unassigned_documents: list[DocumentSummaryResponse]
    non_readiness_disclaimer: str


class VerifyDocumentDownloadRequest(BaseModel):
    client_received_bytes: int = Field(..., ge=0)
    browser_storage_acknowledged: bool = True
    client_sha256_hash: Optional[str] = None
    client_timestamp: Optional[datetime] = None


class VerifyDocumentDownloadResponse(BaseModel):
    document_id: UUID
    is_verified: bool
    verified_at: datetime
    verification_limits_notice: str
    local_copy_notice: str


class PurgeRequestResponse(BaseModel):
    confirmation_token: str
    document_id: UUID
    filename: str
    expires_at: datetime
    impact_summary: str
    local_copy_notice: str
    required_acknowledgment: str


class PurgeConfirmRequest(BaseModel):
    confirmation_token: str
    acknowledged_local_copy_notice: bool


class PurgeConfirmResponse(BaseModel):
    document_id: UUID
    purged: bool
    purged_at: datetime
    audit_correlation_id: str
    local_copy_notice: str


class ResolveAnomalyRequest(BaseModel):
    resolution_action: str = Field(..., pattern="^(mark_resolved|confirm_erroneous_and_purge)$")
    notes: str = Field(..., min_length=3)


class CaseInterimReportResponse(BaseModel):
    id: UUID
    case_id: UUID
    trigger_action: str
    report_title: str
    manifest_snapshot_json: dict
    ocr_summary_json: dict
    anomaly_report_json: dict
    created_at: datetime


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


class RejectDocumentRequest(BaseModel):
    structured_reason_code: str = Field(..., description="Structured reason code for rejection")
    client_explanation: str = Field(..., min_length=5, description="Customizable client-facing explanation")
    internal_notes: Optional[str] = None


class VerifyDocumentRequest(BaseModel):
    status: str = Field(..., pattern="^(verified|accepted|rejected|under_review)$")
    notes: Optional[str] = None
    structured_reason_code: Optional[str] = None
    client_explanation: Optional[str] = None


class CorrectFieldRequest(BaseModel):
    corrected_value: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=3)


class CorrectClassificationRequest(BaseModel):
    category: str = Field(..., min_length=2, max_length=64)
    reason: str = Field(..., min_length=3, max_length=500)


class CorrectApplicantAssociationRequest(BaseModel):
    client_id: Optional[UUID] = None
    applicant_dependant_id: Optional[UUID] = None
    applicant_name: Optional[str] = None
    reason: str = Field(..., min_length=3, max_length=500)


class DocumentExtractionsResponse(BaseModel):
    document_id: UUID
    version: int
    items: list[dict]
    count: int
    legal_sufficiency_disclaimer: str


class PurgeDocumentRequest(BaseModel):
    reason: str = Field("statutory_retention_expiry", min_length=3, max_length=255)
    bypass_retention_window: bool = False
    jurisdiction: str = Field("US", min_length=2, max_length=10)
    retention_policy: Optional[str] = None
    use_ephemeral_schedule: bool = False


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
    download_confirmed: bool = True
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


def compute_document_lifecycle_state(d: Document) -> str:
    """
    Computes unambiguous lifecycle state progression:
    - 'rejected': verification_status is rejected or correction required
    - 'package_ready': verified/accepted AND assigned to applicant/case AND zero unresolved anomalies
    - 'accepted': verified or accepted by officer
    - 'under_review': processing underway or officer review in progress
    - 'uploaded': initial intake received and malware scanned
    """
    v_status = (d.verification_status or "").lower()
    p_status = (d.processing_status or "").lower()
    if v_status in ("rejected", "correction_required"):
        return "rejected"
    if v_status in ("verified", "accepted"):
        has_anomaly = getattr(d, "has_unresolved_anomaly", False)
        is_assigned = getattr(d, "is_assignment_confirmed", True)
        if d.case_id and is_assigned and not has_anomaly:
            return "package_ready"
        return "accepted"
    if p_status in ("processing", "extracting", "running") or v_status in ("under_review", "review"):
        return "under_review"
    return "uploaded"


def parse_rejection_metadata(notes: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not notes:
        return None, None
    if notes.startswith("[") and "]" in notes:
        idx = notes.index("]")
        code = notes[1:idx].strip()
        explanation = notes[idx + 1:].strip()
        return code, explanation
    return None, notes


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

    reason_code, explanation = parse_rejection_metadata(doc.verification_notes)
    lifecycle = compute_document_lifecycle_state(doc)

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
        applicant_dependant_id=getattr(doc, "applicant_dependant_id", None),
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
        proposed_category=getattr(doc, "proposed_category", None),
        proposed_applicant_name=getattr(doc, "proposed_applicant_name", None),
        is_assignment_confirmed=getattr(doc, "is_assignment_confirmed", True),
        has_unresolved_anomaly=getattr(doc, "has_unresolved_anomaly", False),
        is_purged=getattr(doc, "is_purged", False),
        lifecycle_state=lifecycle,
        structured_reason_code=reason_code,
        client_explanation=explanation,
        sub_documents_metadata=getattr(doc, "sub_documents_metadata", []) or [],
        anomaly_notes=getattr(doc, "anomaly_notes", None),
        review_dimensions=(
            evaluate_document_six_dimensions(db, doc).model_dump()
            if db is not None
            else None
        ),
        provenance_extractions=[
            format_field_extraction_provenance(f, doc.version)
            for f in (doc.extracted_fields or [])
        ],
        three_tier_extractions=[
            __import__("backend.app.ai.provenance", fromlist=["format_three_tier_entity"]).format_three_tier_entity(
                field_id=str(f.id),
                field_name=f.field_name,
                field_label=f.field_label,
                raw_value=f.original_value,
                normalized_value=f.normalized_value,
                source_page=f.source_page,
                source_location=f.source_location,
                ocr_confidence=f.ocr_confidence or 0.95,
                extraction_confidence=f.extraction_confidence or 0.95,
                model_version=f.model_version or "doc-intel-v10.0",
                validation_status=f.validation_status,
                corrected_value=f.corrected_value,
                corrected_by_user_id=str(f.corrected_by_user_id) if f.corrected_by_user_id else None,
                corrected_at=f.corrected_at.isoformat() if f.corrected_at else None,
                correction_reason=f.correction_reason,
            )
            for f in (doc.extracted_fields or [])
        ],
        legal_sufficiency_disclaimer=OCR_LEGAL_SUFFICIENCY_DISCLAIMER,
    )


def _to_summary_response(d: Document) -> DocumentSummaryResponse:
    reason_code, explanation = parse_rejection_metadata(d.verification_notes)
    lifecycle = compute_document_lifecycle_state(d)
    return DocumentSummaryResponse(
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
        applicant_dependant_id=getattr(d, "applicant_dependant_id", None),
        created_at=d.created_at,
        updated_at=d.updated_at,
        proposed_category=getattr(d, "proposed_category", None),
        proposed_applicant_name=getattr(d, "proposed_applicant_name", None),
        is_assignment_confirmed=getattr(d, "is_assignment_confirmed", True),
        has_unresolved_anomaly=getattr(d, "has_unresolved_anomaly", False),
        is_purged=getattr(d, "is_purged", False),
        lifecycle_state=lifecycle,
        structured_reason_code=reason_code,
        client_explanation=explanation,
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

    return [_to_summary_response(d) for d in docs]


@router.get("/retention/evaluations", response_model=list[RetentionEvaluationItem])
def get_retention_evaluations(
    jurisdiction: str = Query("US"),
    retention_policy: Optional[str] = Query(None),
    use_ephemeral_schedule: bool = Query(False),
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
        retention_policy=retention_policy,
        use_ephemeral_schedule=use_ephemeral_schedule,
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


# ---------------------------------------------------------------------------
# Phase 4 Intake, Guidance, Family Summary, and Interim Reports Endpoints
# (Declared before /{document_id} to avoid parameterized route masking)
# ---------------------------------------------------------------------------

@router.get("/upload-guidance", response_model=UploadGuidanceResponse)
def get_upload_guidance():
    """
    Returns mobile-first camera scanning guidance, quality checklist rules,
    file limits, and the legal non-acceptance disclaimer.
    """
    return UploadGuidanceResponse(
        focus_guidance="Hold device steady and tap the screen to ensure sharp focus on document text. Retake if blurry or smeared.",
        lighting_guidance="Use bright, even, and diffuse natural or room lighting. Avoid casting dark shadows from hands or the phone.",
        glare_guidance="Tilt document or device slightly (10-15 degrees) or disable flash when scanning glossy photos, IDs, or lamination to eliminate bright glare spots.",
        orientation_guidance="Ensure all pages are upright, vertically oriented, and right-side up before snapping or submitting.",
        corners_guidance="Position document flat on a contrasting background. All 4 page corners and outer edges must be completely visible inside the camera frame.",
        legibility_guidance="Text, serial numbers, stamps, dates, and signatures must remain crisply legible when zoomed to 100%.",
        supported_mime_types=["application/pdf", "image/jpeg", "image/png", "image/tiff"],
        max_file_size_bytes=52428800,
        non_acceptance_disclaimer=UPLOAD_NON_ACCEPTANCE_DISCLAIMER,
    )


@router.post("/upload-batch", response_model=BatchUploadReceiptResponse, status_code=status.HTTP_201_CREATED)
async def upload_batch_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    case_id: Optional[UUID] = Form(None),
    applicant_dependant_id: Optional[UUID] = Form(None),
    category: str = Form("supporting_evidence"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Mobile-first batch upload intake with safe duplicate handling, applicant association proposal,
    and non-readiness receipts.
    """
    if not files:
        raise ValidationError("No files provided for batch upload.")

    case = None
    client_id = None
    if case_id:
        case = db.query(ImmigrationCase).filter(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        ).first()
        if not case:
            raise NotFoundError("Referenced immigration case not found.")
        auth.assert_case_access(case)
        client_id = case.client_id

    selected_applicant_name = None
    if applicant_dependant_id and case:
        dep = db.query(ClientDependant).filter(
            ClientDependant.id == applicant_dependant_id,
            ClientDependant.primary_client_id == case.client_id,
        ).first()
        if not dep:
            raise NotFoundError("Referenced dependant applicant not found.")
        selected_applicant_name = f"{dep.first_name} {dep.last_name}"

    batch_id = uuid.uuid4()
    items: list[BatchUploadItemReceipt] = []
    uploaded_count = 0
    duplicate_count = 0
    failed_count = 0

    for file in files:
        safe_fname = sanitize_filename(file.filename or "upload.pdf")
        try:
            content = await file.read()
            if not content:
                items.append(BatchUploadItemReceipt(
                    filename=safe_fname,
                    byte_size=0,
                    sha256_hash="",
                    status="failed",
                    is_duplicate=False,
                    error_message="Uploaded file is empty (0 bytes).",
                ))
                failed_count += 1
                continue

            if len(content) > 52428800:
                items.append(BatchUploadItemReceipt(
                    filename=safe_fname,
                    byte_size=len(content),
                    sha256_hash="",
                    status="failed",
                    is_duplicate=False,
                    error_message="File size exceeds maximum allowed limit of 50MB.",
                ))
                failed_count += 1
                continue

            is_valid_sig, detected_mime, sig_error = validate_file_signature(content, file.content_type, safe_fname)
            if not is_valid_sig:
                items.append(BatchUploadItemReceipt(
                    filename=safe_fname,
                    byte_size=len(content),
                    sha256_hash="",
                    status="failed",
                    is_duplicate=False,
                    error_message=sig_error or "Invalid file signature.",
                ))
                failed_count += 1
                continue

            is_clean, scan_details = MalwareScanner.scan_content(content, safe_fname)
            if not is_clean:
                items.append(BatchUploadItemReceipt(
                    filename=safe_fname,
                    byte_size=len(content),
                    sha256_hash="",
                    status="failed",
                    is_duplicate=False,
                    error_message=f"Malware scanning violation: {scan_details}",
                ))
                failed_count += 1
                continue

            sha256_hash = calculate_sha256(content)

            # Safe duplicate handling: Check if exact hash exists in this case
            if case_id:
                existing_doc = (
                    db.query(Document)
                    .filter(
                        Document.organization_id == auth.organization_id,
                        Document.case_id == case_id,
                        Document.sha256_hash == sha256_hash,
                        Document.is_purged.is_(False),
                    )
                    .first()
                )
                if existing_doc:
                    duplicate_count += 1
                    items.append(BatchUploadItemReceipt(
                        document_id=existing_doc.id,
                        filename=existing_doc.filename,
                        byte_size=existing_doc.byte_size,
                        sha256_hash=existing_doc.sha256_hash,
                        status="duplicate_existing",
                        is_duplicate=True,
                        existing_document_id=existing_doc.id,
                        proposed_category=existing_doc.category,
                        is_assignment_confirmed=existing_doc.is_assignment_confirmed,
                    ))
                    continue

            # Proposal of applicant and category if omitted
            is_confirmed = True
            prop_applicant_name = selected_applicant_name
            assigned_dep_id = applicant_dependant_id
            prop_category = category

            if not assigned_dep_id and case:
                is_confirmed = False
                lower_fname = safe_fname.lower()
                matched_dep = None
                for dep in (case.client.dependants if case.client else []):
                    if dep.first_name.lower() in lower_fname or dep.last_name.lower() in lower_fname:
                        matched_dep = dep
                        break
                if matched_dep:
                    prop_applicant_name = f"{matched_dep.first_name} {matched_dep.last_name}"
                elif case.client:
                    prop_applicant_name = f"{case.client.first_name} {case.client.last_name}"
                else:
                    prop_applicant_name = "Unassigned Applicant"

                if "passport" in lower_fname or "id" in lower_fname:
                    prop_category = "identity"
                elif "degree" in lower_fname or "diploma" in lower_fname or "transcript" in lower_fname:
                    prop_category = "education"
                elif "bank" in lower_fname or "statement" in lower_fname:
                    prop_category = "financial"
                elif "birth" in lower_fname or "marriage" in lower_fname:
                    prop_category = "vital_records"
                elif "resume" in lower_fname or "cv" in lower_fname or "experience" in lower_fname:
                    prop_category = "experience"
                else:
                    prop_category = "supporting_evidence"

            doc_id = uuid.uuid4()
            storage = get_storage_backend()
            storage_artifact = storage.store_file(
                organization_id=auth.organization_id,
                file_id=doc_id,
                filename=f"v1_{safe_fname}",
                content=content,
                content_type=detected_mime,
            )

            doc = Document(
                id=doc_id,
                organization_id=auth.organization_id,
                case_id=case_id,
                client_id=client_id,
                applicant_dependant_id=assigned_dep_id,
                uploaded_by_user_id=auth.user_id,
                title=safe_fname,
                filename=safe_fname,
                category=prop_category,
                storage_path=storage_artifact.storage_path,
                sha256_hash=sha256_hash,
                byte_size=len(content),
                mime_type=detected_mime,
                version=1,
                is_current_version=True,
                malware_scan_status="clean",
                malware_scan_details=scan_details,
                processing_status="pending",
                verification_status="unverified",
                proposed_category=prop_category,
                proposed_applicant_name=prop_applicant_name,
                is_assignment_confirmed=is_confirmed,
            )
            db.add(doc)

            run_id = uuid.uuid4()
            run = DocumentProcessingRun(
                id=run_id,
                organization_id=auth.organization_id,
                document_id=doc_id,
                run_number=1,
                idempotency_key=f"batch-{batch_id}-{doc_id.hex[:8]}",
                stage="queued",
                status="queued",
                trigger_type="batch_upload",
                progress_percent=0,
            )
            db.add(run)

            outbox = OutboxEvent(
                id=uuid.uuid4(),
                organization_id=auth.organization_id,
                event_type="document.uploaded",
                aggregate_type="document",
                aggregate_id=doc_id,
                payload={
                    "document_id": str(doc_id),
                    "filename": safe_fname,
                    "sha256_hash": sha256_hash,
                    "batch_id": str(batch_id),
                    "is_assignment_confirmed": is_confirmed,
                },
                status="pending",
            )
            db.add(outbox)

            background_tasks.add_task(process_document_background_task, doc_id)

            items.append(BatchUploadItemReceipt(
                document_id=doc_id,
                filename=safe_fname,
                byte_size=len(content),
                sha256_hash=sha256_hash,
                status="uploaded",
                is_duplicate=False,
                proposed_category=prop_category,
                proposed_applicant_name=prop_applicant_name,
                is_assignment_confirmed=is_confirmed,
            ))
            uploaded_count += 1

        except Exception as e:
            logger.exception("Failed processing upload for file %s: %s", safe_fname, e)
            items.append(BatchUploadItemReceipt(
                filename=safe_fname,
                byte_size=0,
                sha256_hash="",
                status="failed",
                is_duplicate=False,
                error_message=str(e),
            ))
            failed_count += 1

    if case and uploaded_count > 0:
        DocumentInactivityService.record_client_activity(db, case, "batch_upload", auth.user_id)

    db.commit()

    return BatchUploadReceiptResponse(
        batch_id=batch_id,
        total_files=len(files),
        uploaded_count=uploaded_count,
        duplicate_count=duplicate_count,
        failed_count=failed_count,
        items=items,
        non_acceptance_disclaimer=UPLOAD_NON_ACCEPTANCE_DISCLAIMER,
    )


@router.get("/cases/{case_id}/family-documents-summary", response_model=FamilyDocumentsSummaryResponse)
def get_family_documents_summary(
    case_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Per-applicant outstanding/received/correction-required lists plus an overall family summary.
    Includes non-readiness disclaimer.
    """
    case = db.query(ImmigrationCase).filter(
        ImmigrationCase.id == case_id,
        ImmigrationCase.organization_id == auth.organization_id,
    ).first()
    if not case:
        raise NotFoundError(f"Case {case_id} not found.")
    auth.assert_case_access(case)

    all_docs = db.query(Document).filter(
        Document.case_id == case.id,
        Document.organization_id == auth.organization_id,
        Document.is_purged.is_(False),
    ).all()

    all_requests = db.query(DocumentRequest).filter(
        DocumentRequest.case_id == case.id,
        DocumentRequest.organization_id == auth.organization_id,
    ).all()

    applicants_list: list[ApplicantDocumentSummary] = []
    total_received = 0
    total_verified = 0
    total_correction = 0
    total_required = 0

    # 1. Primary Client
    primary_client = case.client
    primary_name = f"{primary_client.first_name} {primary_client.last_name}" if primary_client else "Primary Applicant"
    primary_docs = [d for d in all_docs if d.applicant_dependant_id is None and d.is_assignment_confirmed]
    primary_reqs = [r for r in all_requests if (getattr(r, "dependant_id", None) or getattr(r, "client_dependant_id", None)) is None]

    received_items = []
    correction_items = []
    for d in primary_docs:
        item = ApplicantDocumentItem(
            document_id=d.id,
            title=d.title,
            category=d.category,
            processing_status=d.processing_status,
            verification_status=d.verification_status,
            has_unresolved_anomaly=getattr(d, "has_unresolved_anomaly", False),
            created_at=d.created_at,
        )
        if d.verification_status == "rejected" or getattr(d, "has_unresolved_anomaly", False) or d.processing_status == "needs_review":
            correction_items.append(item)
            total_correction += 1
        else:
            received_items.append(item)
            total_received += 1
        if d.verification_status == "verified":
            total_verified += 1

    outstanding_items = []
    for r in primary_reqs:
        if r.status not in ("fulfilled", "waived", "approved"):
            outstanding_items.append(ApplicantOutstandingItem(
                requirement_id=str(r.id),
                title=r.title,
                category=getattr(r, "category", "supporting_evidence"),
                is_mandatory=getattr(r, "is_mandatory", True),
            ))
            total_required += 1

    applicants_list.append(ApplicantDocumentSummary(
        applicant_id=primary_client.id if primary_client else None,
        applicant_name=primary_name,
        relationship="primary_applicant",
        outstanding=outstanding_items,
        received=received_items,
        correction_required=correction_items,
    ))

    # 2. Dependants
    dependants = primary_client.dependants if primary_client else []
    for dep in dependants:
        dep_name = f"{dep.first_name} {dep.last_name}"
        dep_docs = [d for d in all_docs if d.applicant_dependant_id == dep.id and d.is_assignment_confirmed]
        dep_reqs = [r for r in all_requests if (getattr(r, "dependant_id", None) or getattr(r, "client_dependant_id", None)) == dep.id]

        dep_received = []
        dep_correction = []
        for d in dep_docs:
            item = ApplicantDocumentItem(
                document_id=d.id,
                title=d.title,
                category=d.category,
                processing_status=d.processing_status,
                verification_status=d.verification_status,
                has_unresolved_anomaly=getattr(d, "has_unresolved_anomaly", False),
                created_at=d.created_at,
            )
            if d.verification_status == "rejected" or getattr(d, "has_unresolved_anomaly", False) or d.processing_status == "needs_review":
                dep_correction.append(item)
                total_correction += 1
            else:
                dep_received.append(item)
                total_received += 1
            if d.verification_status == "verified":
                total_verified += 1

        dep_outstanding = []
        for r in dep_reqs:
            if r.status not in ("fulfilled", "waived", "approved"):
                dep_outstanding.append(ApplicantOutstandingItem(
                    requirement_id=str(r.id),
                    title=r.title,
                    category=getattr(r, "category", "supporting_evidence"),
                    is_mandatory=getattr(r, "is_mandatory", True),
                ))
                total_required += 1

        applicants_list.append(ApplicantDocumentSummary(
            applicant_id=dep.id,
            applicant_name=dep_name,
            relationship=dep.relationship,
            outstanding=dep_outstanding,
            received=dep_received,
            correction_required=dep_correction,
        ))

    unassigned = [d for d in all_docs if not d.is_assignment_confirmed]

    return FamilyDocumentsSummaryResponse(
        case_id=case.id,
        case_number=case.case_number,
        total_required=total_required,
        total_received=total_received,
        total_verified=total_verified,
        total_correction_required=total_correction,
        total_unassigned=len(unassigned),
        applicants=applicants_list,
        unassigned_documents=[_to_summary_response(d) for d in unassigned],
        non_readiness_disclaimer=FAMILY_SUMMARY_DISCLAIMER,
    )


@router.get("/cases/{case_id}/interim-reports", response_model=list[CaseInterimReportResponse])
def list_case_interim_reports(
    case_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Lists interim package reports and OCR/anomaly reports generated during holds,
    reassignments, or manual interim snapshots.
    """
    case = db.query(ImmigrationCase).filter(
        ImmigrationCase.id == case_id,
        ImmigrationCase.organization_id == auth.organization_id,
    ).first()
    if not case:
        raise NotFoundError(f"Case {case_id} not found.")
    auth.assert_case_access(case)

    reports = (
        db.query(CaseInterimReport)
        .filter(
            CaseInterimReport.case_id == case_id,
            CaseInterimReport.organization_id == auth.organization_id,
        )
        .order_by(CaseInterimReport.created_at.desc())
        .all()
    )
    return [
        CaseInterimReportResponse(
            id=r.id,
            case_id=r.case_id,
            trigger_action=r.trigger_action,
            report_title=r.report_title,
            manifest_snapshot_json=r.manifest_snapshot_json or {},
            ocr_summary_json=r.ocr_summary_json or {},
            anomaly_report_json=r.anomaly_report_json or {},
            created_at=r.created_at,
        )
        for r in reports
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


@router.post("/{document_id}/download-token")
def create_download_token(
    document_id: UUID,
    expires_in_seconds: int = Query(default=300, ge=30, le=900),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Generates a short-lived (default 300s) signed download access token for secure streaming download."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")
    assert_document_access(auth, doc, db)

    if doc.verification_status == "quarantined" or doc.malware_scan_status == "infected":
        raise PermissionDeniedError("Cannot generate download token for quarantined or infected document.")

    token = generate_download_token(doc.id, auth.user_id, auth.organization_id, expires_in_seconds=expires_in_seconds)
    return {
        "document_id": str(doc.id),
        "download_token": token,
        "expires_in_seconds": expires_in_seconds,
        "download_url": f"/api/v1/documents/{doc.id}/download?token={token}",
    }


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

    if doc.verification_status == "quarantined" or doc.malware_scan_status == "infected":
        raise PermissionDeniedError("Cannot download quarantined or infected document.")

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

    if doc.verification_status == "quarantined" or doc.malware_scan_status == "infected":
        raise PermissionDeniedError("Cannot preview quarantined or infected document.")

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
    if payload.structured_reason_code and payload.client_explanation:
        doc.verification_notes = f"[{payload.structured_reason_code}] {payload.client_explanation}"
    elif payload.notes:
        doc.verification_notes = payload.notes

    audit = AuditEvent(
        organization_id=doc.organization_id,
        actor_id=auth.user_id,
        action="document.verified" if payload.status != "rejected" else "document.rejected",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "status": payload.status,
            "notes": doc.verification_notes,
            "structured_reason_code": payload.structured_reason_code,
            "client_explanation": payload.client_explanation,
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return _to_detail_response(doc, auth, db=db)


@router.post("/{document_id}/reject", response_model=DocumentDetailResponse)
def reject_document(
    document_id: UUID,
    payload: RejectDocumentRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Rejects a document requiring a structured reason code and customizable client explanation.
    Enforces quality feedback, updates verification_status to 'rejected', links to related requests,
    logs an immutable audit event, and dispatches an actionable client notification.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)
    if auth.is_retained_client():
        raise PermissionDeniedError("Clients cannot reject legal documents.")

    doc.verification_status = "rejected"
    doc.verified_by_user_id = auth.user_id
    doc.verified_at = now_utc()
    doc.verification_notes = f"[{payload.structured_reason_code}] {payload.client_explanation}"
    if hasattr(doc, "anomaly_notes"):
        doc.anomaly_notes = payload.client_explanation

    # Update associated open document requests for this case if any match
    if doc.case_id:
        doc_requests = db.query(DocumentRequest).filter(
            DocumentRequest.organization_id == doc.organization_id,
            DocumentRequest.case_id == doc.case_id,
        ).all()
        for req in doc_requests:
            if req.title.lower() in (doc.title or "").lower() or (doc.category and doc.category in (req.category or "")):
                req.status = "rejected"
                req.rejection_reason = payload.client_explanation

    audit = AuditEvent(
        organization_id=doc.organization_id,
        actor_id=auth.user_id,
        action="document.rejected",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "structured_reason_code": payload.structured_reason_code,
            "client_explanation": payload.client_explanation,
            "internal_notes": payload.internal_notes,
            "document_title": doc.title,
        },
    )
    db.add(audit)

    # Dispatch notification to client
    if doc.uploaded_by_user_id:
        try:
            NotificationService.create_notification(
                db=db,
                organization_id=doc.organization_id,
                user_id=doc.uploaded_by_user_id,
                title=f"Action Required: Document Needs Correction ({doc.title or doc.filename})",
                body=payload.client_explanation,
                notification_type="processing_failure",
            )
        except Exception as e:
            logger.warning(f"Failed to dispatch rejection notification: {e}")

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


@router.get("/{document_id}/review-dimensions", response_model=DocumentSixDimensionsReview)
def get_document_review_dimensions(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Evaluates and returns the Phase 5 Six Separate Review Dimensions:
    1. Readability & Scan Quality
    2. Document Type
    3. Applicant Association
    4. Cross-Document Consistency
    5. Evidentiary Sufficiency & Completeness
    6. Human Verification (strictly decoupled from OCR)
    Includes high-priority anomaly flags and the mandatory OCR legal sufficiency disclaimer.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)

    return evaluate_document_six_dimensions(db, doc)


@router.get("/{document_id}/extractions", response_model=DocumentExtractionsResponse)
def get_document_extractions(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Returns candidate extractions retained strictly with normalized bounding box provenance:
    [ymin, xmin, ymax, xmax], confidence, extractor_version, and review_status.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)

    items = [
        format_field_extraction_provenance(f, doc.version)
        for f in (doc.extracted_fields or [])
    ]
    return DocumentExtractionsResponse(
        document_id=doc.id,
        version=doc.version,
        items=items,
        count=len(items),
        legal_sufficiency_disclaimer=OCR_LEGAL_SUFFICIENCY_DISCLAIMER,
    )


@router.put("/{document_id}/classification", response_model=DocumentDetailResponse)
def correct_document_classification(
    document_id: UUID,
    payload: CorrectClassificationRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Allows authorized staff to correct the document classification type.
    Creates an immutable audit trail with previous and new classification, reason, and actor.
    Retains decoupling from legal package readiness.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients cannot reclassify legal evidence.")

    prev_category = doc.category
    new_category = payload.category.strip()

    doc.category = new_category
    doc.proposed_category = None
    doc.is_assignment_confirmed = True
    doc.updated_at = now_utc()

    audit = AuditEvent(
        organization_id=doc.organization_id,
        actor_id=auth.user_id,
        action="document.classification_corrected",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "document_id": str(doc.id),
            "previous_category": prev_category,
            "new_category": new_category,
            "reason": payload.reason.strip(),
            "corrected_by": str(auth.user_id),
        },
        occurred_at=now_utc(),
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return _to_detail_response(doc, auth, db=db)


@router.put("/{document_id}/applicant-association", response_model=DocumentDetailResponse)
def correct_applicant_association(
    document_id: UUID,
    payload: CorrectApplicantAssociationRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Allows authorized staff to associate or re-assign a document to a specific applicant (client/dependant).
    Enforces tenant isolation, auto-resolves cross-document discrepancy findings against previous applicant,
    and creates an immutable audit trail with provenance.
    """
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == auth.organization_id,
    ).first()
    if not doc:
        raise NotFoundError("Document not found.")

    assert_document_access(auth, doc, db)
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients cannot re-assign applicant associations.")

    # 1. Target Applicant Validation & Tenant Isolation
    target_client = None
    target_dep = None

    if payload.applicant_dependant_id:
        target_dep = db.query(ClientDependant).filter(
            ClientDependant.id == payload.applicant_dependant_id,
            ClientDependant.organization_id == auth.organization_id,
        ).first()
        if not target_dep:
            raise NotFoundError("Referenced applicant dependant not found in organization.")

        target_client = db.query(ClientProfile).filter(
            ClientProfile.id == target_dep.primary_client_id,
            ClientProfile.organization_id == auth.organization_id,
        ).first()
        if not target_client:
            raise NotFoundError("Primary client for dependant not found in organization.")

        if payload.client_id and payload.client_id != target_dep.primary_client_id:
            raise PermissionDeniedError("Dependant does not belong to the specified client.")

    elif payload.client_id:
        target_client = db.query(ClientProfile).filter(
            ClientProfile.id == payload.client_id,
            ClientProfile.organization_id == auth.organization_id,
        ).first()
        if not target_client:
            raise NotFoundError("Referenced client profile not found in organization.")

    # 2. Previous applicant information
    prev_client_id = str(doc.client_id) if doc.client_id else None
    prev_dep_id = str(doc.applicant_dependant_id) if doc.applicant_dependant_id else None
    prev_applicant_name = doc.proposed_applicant_name

    # 3. New applicant assignment
    if target_dep:
        doc.client_id = target_dep.primary_client_id
        doc.applicant_dependant_id = target_dep.id
        doc.proposed_applicant_name = (
            payload.applicant_name.strip()
            if payload.applicant_name
            else f"{target_dep.first_name} {target_dep.last_name}".strip()
        )
    elif target_client:
        doc.client_id = target_client.id
        doc.applicant_dependant_id = None
        doc.proposed_applicant_name = (
            payload.applicant_name.strip()
            if payload.applicant_name
            else f"{target_client.first_name} {target_client.last_name}".strip()
        )
    elif payload.applicant_name:
        doc.proposed_applicant_name = payload.applicant_name.strip()

    now = now_utc()
    doc.is_assignment_confirmed = True
    doc.assignment_confirmed_by_id = auth.user_id
    doc.updated_at = now

    # 4. Cross-Document Findings Auto-Resolution:
    # Prior cross-document comparisons compared this document against the wrong applicant's profile/docs.
    open_statuses = ["open", "investigating", "needs_review", "needs_action"]
    relevant_finding_types = ["consistency_discrepancy", "applicant_association_ambiguity", "form_conflict"]

    doc_id_str = str(doc.id)
    case_findings = []
    if doc.case_id:
        case_findings = db.query(CaseAIFinding).filter(
            CaseAIFinding.organization_id == auth.organization_id,
            CaseAIFinding.case_id == doc.case_id,
            CaseAIFinding.status.in_(open_statuses),
            CaseAIFinding.finding_type.in_(relevant_finding_types),
        ).all()

    resolved_findings_count = 0
    for f in case_findings:
        is_match = False
        if f.document_id and str(f.document_id) == doc_id_str:
            is_match = True
        elif f.related_documents:
            for rel in f.related_documents:
                rel_id = rel.get("id") if isinstance(rel, dict) else str(rel)
                if rel_id == doc_id_str:
                    is_match = True
                    break

        if is_match:
            f.status = "resolved"
            f.resolution_action = "resolve"
            f.resolution_reason = (
                f"Auto-resolved upon document reassignment to applicant '{doc.proposed_applicant_name}': "
                f"{payload.reason.strip()}"
            )
            f.resolved_at = now
            f.reviewer_id = auth.user_id
            history = list(f.resolution_history or [])
            history.append({
                "action": "resolve",
                "reason": f.resolution_reason,
                "by": str(auth.user_id),
                "at": now.isoformat(),
            })
            f.resolution_history = history
            resolved_findings_count += 1

    if resolved_findings_count > 0:
        db.flush()

    remaining_open_findings = 0
    if doc.case_id:
        remaining_open_findings = db.query(CaseAIFinding).filter(
            CaseAIFinding.organization_id == auth.organization_id,
            CaseAIFinding.document_id == doc.id,
            CaseAIFinding.status.in_(open_statuses),
        ).count()

    if remaining_open_findings == 0:
        doc.has_unresolved_anomaly = False
        doc.anomaly_notes = None

    # 5. Record Immutable Audit Trail
    audit = AuditEvent(
        organization_id=doc.organization_id,
        actor_id=auth.user_id,
        action="document.applicant_association_corrected",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "document_id": str(doc.id),
            "previous_client_id": prev_client_id,
            "new_client_id": str(doc.client_id) if doc.client_id else None,
            "previous_applicant_dependant_id": prev_dep_id,
            "new_applicant_dependant_id": str(doc.applicant_dependant_id) if doc.applicant_dependant_id else None,
            "previous_applicant_name": prev_applicant_name,
            "new_applicant_name": doc.proposed_applicant_name,
            "is_assignment_confirmed": True,
            "assignment_confirmed_by_id": str(auth.user_id),
            "reason": payload.reason.strip(),
            "auto_resolved_findings_count": resolved_findings_count,
            "corrected_by": str(auth.user_id),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return _to_detail_response(doc, auth, db=db)


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
    retention_policy = payload.retention_policy if payload else None
    use_ephemeral = payload.use_ephemeral_schedule if payload else False

    try:
        result = purge_document(
            db=db,
            document_id=document_id,
            organization_id=auth.organization_id,
            actor_id=auth.user_id,
            reason=reason,
            jurisdiction=jurisdiction,
            retention_policy=retention_policy,
            use_ephemeral_schedule=use_ephemeral,
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


# ---------------------------------------------------------------------------
# Phase 4 Section Splitting, Assignment, Verification, and Deletion
# ---------------------------------------------------------------------------


@router.post("/{document_id}/split-sections", response_model=SplitSectionsResponse)
def split_sections_endpoint(
    document_id: UUID,
    payload: Optional[SplitSectionsRequest] = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Splits a multi-document combined file into individual section documents.
    If sections not provided, runs automated boundary detection across OCR layout pages.
    """
    doc = db.query(Document).filter(Document.id == document_id, Document.organization_id == auth.organization_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")
    assert_document_access(auth, doc, db)

    sections_data = []
    if payload and payload.sections:
        sections_data = [s.model_dump(mode="json") for s in payload.sections]
    else:
        layout = doc.layout_metadata or {}
        pages = layout.get("pages", [])
        if not pages and doc.page_count > 1:
            pages = [{"page_number": p, "text": f"Page {p} content"} for p in range(1, doc.page_count + 1)]
        detected = detect_document_boundaries(pages)
        sections_data = detected or [
            {
                "section_id": str(uuid.uuid4()),
                "title": f"{doc.title} - Section 1",
                "category": doc.category,
                "start_page": 1,
                "end_page": max(1, doc.page_count),
                "confidence": 0.9,
            }
        ]

    created = split_combined_document(db, doc, sections_data, auth.user_id)
    return SplitSectionsResponse(
        parent_document_id=doc.id,
        sections_count=len(created),
        created_documents=[_to_summary_response(c) for c in created],
    )


@router.post("/{document_id}/confirm-assignment", response_model=DocumentDetailResponse)
def confirm_assignment_endpoint(
    document_id: UUID,
    payload: ConfirmAssignmentRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Officer confirms or updates the proposed applicant assignment and category for a document.
    Enforces tenant isolation and auto-resolves cross-document discrepancy findings.
    """
    if auth.is_retained_client():
        raise PermissionDeniedError("Only authorized staff or officers can confirm document assignments.")

    doc = db.query(Document).filter(Document.id == document_id, Document.organization_id == auth.organization_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")

    prev_client_id = str(doc.client_id) if doc.client_id else None
    prev_dep_id = str(doc.applicant_dependant_id) if doc.applicant_dependant_id else None
    prev_applicant_name = doc.proposed_applicant_name

    now = now_utc()
    doc.is_assignment_confirmed = True
    doc.assignment_confirmed_by_id = auth.user_id

    if payload.applicant_dependant_id is not None:
        target_dep = db.query(ClientDependant).filter(
            ClientDependant.id == payload.applicant_dependant_id,
            ClientDependant.organization_id == auth.organization_id,
        ).first()
        if not target_dep:
            raise NotFoundError("Referenced applicant dependant not found in organization.")
        doc.applicant_dependant_id = target_dep.id
        doc.client_id = target_dep.primary_client_id
        doc.proposed_applicant_name = f"{target_dep.first_name} {target_dep.last_name}".strip()

    if payload.confirmed_category:
        doc.category = payload.confirmed_category
    doc.updated_at = now

    resolved_count = 0
    if payload.applicant_dependant_id is not None and str(payload.applicant_dependant_id) != prev_dep_id:
        open_statuses = ["open", "investigating", "needs_review", "needs_action"]
        relevant_types = ["consistency_discrepancy", "applicant_association_ambiguity", "form_conflict"]
        if doc.case_id:
            c_findings = db.query(CaseAIFinding).filter(
                CaseAIFinding.organization_id == auth.organization_id,
                CaseAIFinding.case_id == doc.case_id,
                CaseAIFinding.status.in_(open_statuses),
                CaseAIFinding.finding_type.in_(relevant_types),
            ).all()
            for f in c_findings:
                if (f.document_id and str(f.document_id) == str(doc.id)) or any(
                    (rel.get("id") if isinstance(rel, dict) else str(rel)) == str(doc.id)
                    for rel in (f.related_documents or [])
                ):
                    f.status = "resolved"
                    f.resolution_action = "resolve"
                    f.resolution_reason = f"Auto-resolved upon assignment confirmation to applicant '{doc.proposed_applicant_name}'."
                    f.resolved_at = now
                    f.reviewer_id = auth.user_id
                    history = list(f.resolution_history or [])
                    history.append({
                        "action": "resolve",
                        "reason": f.resolution_reason,
                        "by": str(auth.user_id),
                        "at": now.isoformat(),
                    })
                    f.resolution_history = history
                    resolved_count += 1

        if resolved_count > 0:
            db.flush()

        remaining_open = db.query(CaseAIFinding).filter(
            CaseAIFinding.organization_id == auth.organization_id,
            CaseAIFinding.document_id == doc.id,
            CaseAIFinding.status.in_(open_statuses),
        ).count()
        if remaining_open == 0:
            doc.has_unresolved_anomaly = False
            doc.anomaly_notes = None

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="document.assignment_confirmed",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "document_id": str(doc.id),
            "previous_client_id": prev_client_id,
            "new_client_id": str(doc.client_id) if doc.client_id else None,
            "previous_applicant_dependant_id": prev_dep_id,
            "new_applicant_dependant_id": str(doc.applicant_dependant_id) if doc.applicant_dependant_id else None,
            "previous_applicant_name": prev_applicant_name,
            "new_applicant_name": doc.proposed_applicant_name,
            "is_assignment_confirmed": True,
            "assignment_confirmed_by_id": str(auth.user_id),
            "category": doc.category,
            "confirmed_at": now.isoformat(),
            "auto_resolved_findings_count": resolved_count,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    return _to_detail_response(doc, auth, db=db)



@router.post("/{document_id}/verify-download", response_model=VerifyDocumentDownloadResponse)
def verify_document_download_endpoint(
    document_id: UUID,
    payload: VerifyDocumentDownloadRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Verifies client-side browser receipt of a document download.
    Enforces honest verification limits notice and local copy disclaimer.
    """
    doc = db.query(Document).filter(Document.id == document_id, Document.organization_id == auth.organization_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")
    assert_document_access(auth, doc, db)

    now = now_utc()
    meta = dict(doc.layout_metadata or {})
    meta["verified_download"] = {
        "verified_at": now.isoformat(),
        "client_received_bytes": payload.client_received_bytes,
        "browser_storage_acknowledged": payload.browser_storage_acknowledged,
        "client_sha256_hash": payload.client_sha256_hash,
        "verified_by_user_id": str(auth.user_id),
    }
    doc.layout_metadata = meta

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="document.download_verified",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={
            "client_received_bytes": payload.client_received_bytes,
            "browser_storage_acknowledged": payload.browser_storage_acknowledged,
            "verified_at": now.isoformat(),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()

    return VerifyDocumentDownloadResponse(
        document_id=doc.id,
        is_verified=True,
        verified_at=now,
        verification_limits_notice=VERIFIED_DOWNLOAD_LIMITS_NOTICE,
        local_copy_notice=LOCAL_COPY_NOTICE,
    )


@router.post("/{document_id}/purge-request", response_model=PurgeRequestResponse)
def request_document_purge(
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Step 1 of Two-Step Deletion:
    Validates legal hold and unresolved anomaly blockers, generates cryptographic challenge token,
    and returns mandatory local copy notice.
    """
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to initiate document purges.")

    doc = db.query(Document).filter(Document.id == document_id, Document.organization_id == auth.organization_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")

    if is_document_on_legal_hold(doc):
        raise ConflictError("Document is protected under an active legal hold and cannot be purged.")

    if getattr(doc, "has_unresolved_anomaly", False) or len(get_unresolved_document_findings(db, doc)) > 0:
        raise ConflictError(
            "Document has unresolved compliance anomalies or AI findings. "
            "Please review and resolve anomalies or use erroneous file deletion flow before purging."
        )

    token = generate_purge_confirmation_token(
        organization_id=auth.organization_id,
        document_id=doc.id,
        user_id=auth.user_id,
        expires_in_seconds=600,
    )
    expires_at = now_utc() + timedelta(seconds=600)

    return PurgeRequestResponse(
        confirmation_token=token,
        document_id=doc.id,
        filename=doc.filename,
        expires_at=expires_at,
        impact_summary=f"Document '{doc.filename}' (v{doc.version}) and all associated storage artifacts will be permanently destroyed.",
        local_copy_notice=LOCAL_COPY_NOTICE,
        required_acknowledgment=REQUIRED_LOCAL_COPY_ACKNOWLEDGMENT,
    )


@router.post("/{document_id}/purge-confirm", response_model=PurgeConfirmResponse)
def confirm_document_purge(
    document_id: UUID,
    payload: PurgeConfirmRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Step 2 of Two-Step Deletion:
    Validates challenge token, enforces local copy acknowledgment, and executes permanent deletion.
    """
    if auth.is_retained_client():
        raise PermissionDeniedError("Retained clients are not authorized to execute document purges.")

    if not payload.acknowledged_local_copy_notice:
        raise ValidationError(
            "Purge confirmation requires acknowledgment that Documento cannot delete local copies already downloaded to your device."
        )

    verify_purge_confirmation_token(payload.confirmation_token, document_id, auth.organization_id)

    doc = db.query(Document).filter(Document.id == document_id, Document.organization_id == auth.organization_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")

    if is_document_on_legal_hold(doc):
        raise ConflictError("Document is protected under an active legal hold and cannot be purged.")

    if getattr(doc, "has_unresolved_anomaly", False) or len(get_unresolved_document_findings(db, doc)) > 0:
        raise ConflictError("Document has unresolved compliance anomalies and cannot be purged.")

    res = purge_document(
        db=db,
        document_id=document_id,
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        reason="Two-step verified document destruction with local copy disclaimer acknowledgment",
        bypass_retention_window=True,
    )

    now = now_utc()
    return PurgeConfirmResponse(
        document_id=document_id,
        purged=True,
        purged_at=now,
        audit_correlation_id=res.get("correlation_id", str(uuid.uuid4())),
        local_copy_notice=LOCAL_COPY_NOTICE,
    )


@router.post("/{document_id}/resolve-anomaly")
def resolve_document_anomaly(
    document_id: UUID,
    payload: ResolveAnomalyRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Allows officer to review an unresolved anomaly file:
    - mark_resolved: Clears anomaly flag and notes officer review
    - confirm_erroneous_and_purge: Confirms the file was erroneous and purges it immediately
    """
    if auth.is_retained_client():
        raise PermissionDeniedError("Only authorized officers can resolve anomalies or purge erroneous files.")

    doc = db.query(Document).filter(Document.id == document_id, Document.organization_id == auth.organization_id).first()
    if not doc:
        raise NotFoundError(f"Document {document_id} not found.")

    now = now_utc()
    if payload.resolution_action == "mark_resolved":
        doc.has_unresolved_anomaly = False
        doc.anomaly_notes = f"[RESOLVED by {auth.user_id}] {payload.notes}"
        doc.updated_at = now

        audit = AuditEvent(
            organization_id=auth.organization_id,
            actor_id=auth.user_id,
            action="document.anomaly_resolved",
            object_type="document",
            object_id=str(doc.id),
            metadata_json={"notes": payload.notes, "resolved_at": now.isoformat()},
            occurred_at=now,
        )
        db.add(audit)
        db.commit()
        db.refresh(doc)
        return _to_detail_response(doc, auth, db=db)

    elif payload.resolution_action == "confirm_erroneous_and_purge":
        if is_document_on_legal_hold(doc):
            raise ConflictError("Document is protected under an active legal hold and cannot be purged.")

        doc.has_unresolved_anomaly = False

        try:
            purge_document(
                db=db,
                document_id=doc.id,
                organization_id=auth.organization_id,
                actor_id=auth.user_id,
                reason=f"Officer confirmed erroneous file purge: {payload.notes}",
                bypass_retention_window=True,
            )
        except (LegalHoldError, UnresolvedAnomalyError) as e:
            db.rollback()
            raise ConflictError(str(e))
        except PurgeIneligibleError as e:
            db.rollback()
            raise ValidationError(str(e))

        return {
            "document_id": str(document_id),
            "status": "purged_erroneous",
            "message": "Erroneous file has been permanently deleted from storage.",
            "notes": payload.notes,
            "local_copy_notice": LOCAL_COPY_NOTICE,
        }

