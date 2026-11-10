from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field

from backend.app.ai.document_intelligence import OCR_LEGAL_SUFFICIENCY_DISCLAIMER


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


# --- Document Schemas ---

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
    layout_metadata: dict = Field(default_factory=dict)
    extracted_fields: list[ExtractedFieldResponse] = Field(default_factory=list)
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
    sub_documents_metadata: list = Field(default_factory=list)
    anomaly_notes: Optional[str] = None
    review_dimensions: Optional[dict] = None
    provenance_extractions: list[dict] = Field(default_factory=list)
    three_tier_extractions: list[dict] = Field(default_factory=list)
    legal_sufficiency_disclaimer: str = OCR_LEGAL_SUFFICIENCY_DISCLAIMER


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
    outstanding: list[ApplicantOutstandingItem] = Field(default_factory=list)
    received: list[ApplicantDocumentItem] = Field(default_factory=list)
    correction_required: list[ApplicantDocumentItem] = Field(default_factory=list)


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
    blocking_reasons: list[str] = Field(default_factory=list)
    status: str
