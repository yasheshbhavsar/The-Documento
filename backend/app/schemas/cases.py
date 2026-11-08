import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field

from backend.app.domain.case_service import CaseStage


# --- Case Schemas ---

class CaseCreateRequest(BaseModel):
    client_id: uuid.UUID
    case_number: str = Field(..., min_length=3, max_length=64)
    title: str = Field(..., min_length=3, max_length=255)
    jurisdiction: str = Field(..., min_length=2, max_length=3)
    visa_category: str = Field(..., min_length=2, max_length=64)
    status: str = Field(default=CaseStage.INTAKE.value)
    priority_date: datetime | None = None
    case_manager_id: uuid.UUID | None = None
    lead_attorney_id: uuid.UUID | None = None
    reviewer_id: uuid.UUID | None = None
    client_engagement_type: str = Field(default="RETAINED_CLIENT", description="RETAINED_CLIENT, CONSULTATION_ONLY, PRELIMINARY_ASSESSMENT")
    is_retained: bool = True


class CaseUpdateRequest(BaseModel):
    title: str | None = None
    jurisdiction: str | None = None
    visa_category: str | None = None
    priority_date: datetime | None = None


class StatusTransitionRequest(BaseModel):
    status: str = Field(..., min_length=2, max_length=64)
    reason: str | None = None
    notes: str | None = None
    is_pathway_override: bool = False


class PreparationTransitionRequest(BaseModel):
    target_status: str = Field(..., description="CLEARANCE_PENDING, AUTHORIZED_FOR_PREPARATION, PREPARATION_IN_PROGRESS, READY_FOR_FINAL_REVIEW, READY_TO_SUBMIT, SUBMITTED")
    notes: str | None = None
    is_pathway_override: bool = False


class HoldRequest(BaseModel):
    hold_type: str = Field(default="client_request", description="client_request, billing_arrears, pending_official_record, administrative")
    reason: str = Field(..., min_length=3, max_length=255)


class ReleaseHoldRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=3, max_length=255)


class ReassignOwnerRequest(BaseModel):
    new_user_id: uuid.UUID
    role_in_case: str = Field(default="lead_attorney", description="lead_attorney, case_manager, reviewer")
    notify_client: bool = Field(default=False)


class WithdrawRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


class ReapplicationRequest(BaseModel):
    new_case_number: str = Field(..., min_length=3, max_length=64)
    reason: str = Field(..., min_length=3, max_length=255)
    title: str | None = None


class PaymentClearanceUpdateRequest(BaseModel):
    payment_status: str = Field(..., description="PENDING, PARTIALLY_PAID, PAID")
    notes: str | None = None


class TripartiteAuthorizationRequest(BaseModel):
    gate_type: str | None = Field(default=None, description="manager_authorization, accounts_clearance, counsellor_confirmation")
    auth_type: str | None = None
    authorized: bool = True
    notes: str | None = None
    reference_id: str | None = None
    waived: bool = False
    waiver_reason: str | None = None


class ProgressiveReviewRequest(BaseModel):
    stage: str = Field(..., description="OFFICER_INITIAL_REVIEW, SENIOR_REVIEW, LAWYER_REVIEW")
    outcome: str = Field(default="APPROVED", description="APPROVED, REJECTED, CHANGES_REQUESTED")
    comments: str | None = None
    notes: str | None = None
    checklist_verified: bool = True


class SubmissionAuthorizationRequest(BaseModel):
    action: str | None = Field(default=None, description="APPROVE, REJECT, HOLD_ACCOUNTS, HOLD_COUNSELLOR, HOLD_CLIENT_DECISION, RELEASE_HOLD")
    status: str | None = None
    notes: str | None = None
    reason: str | None = None


class HandoverAuthorizationRequest(BaseModel):
    authorized: bool = True
    target_status: str | None = None
    status: str | None = None
    notes: str | None = None
    reason: str | None = None


class ManualReminderRequest(BaseModel):
    reminder_type: str = Field(default="GENERAL", description="GENERAL, CHECKLIST_OUTSTANDING, REVIEW_REQUIRED, PAYMENT_OVERDUE")
    recipient_role: str = Field(default="CLIENT", description="CLIENT, COUNSELLOR, REVIEWER, LAWYER, ACCOUNTS")
    recipient_type: str | None = None
    custom_message: str | None = None
    message: str | None = None


class ManualAcknowledgementRequest(BaseModel):
    acknowledgement_type: str = Field(default="RECEIPT", description="RECEIPT, REVIEW_COMPLETED, GATE_CLEARED")
    notes: str | None = None
    custom_message: str | None = None
    subject: str | None = None
    details: str | None = None


class CaseMigrateConfigRequest(BaseModel):
    reason: str = Field(..., min_length=10, description="Mandatory reason for updating case's pinned configuration rules")
    target_version: int | None = None


class CaseHoldHistoryResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    hold_type: str
    reason: str
    placed_by_id: uuid.UUID
    placed_at: datetime
    released_by_id: uuid.UUID | None = None
    released_at: datetime | None = None
    resolution_notes: str | None = None


class CaseCloseRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)
    notes: str | None = None


class CaseReopenRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)
    notes: str | None = None


class CaseArchiveRequest(BaseModel):
    reason: str | None = None


class CaseAssignmentRequest(BaseModel):
    user_id: uuid.UUID
    role_in_case: str = Field(..., min_length=2, max_length=64, description="lead_attorney, case_manager, reviewer")


class AssignmentResponse(BaseModel):
    assignment_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    role_in_case: str
    assigned_at: datetime


class MilestoneCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    stage: str = Field(..., min_length=2, max_length=64)
    target_date: datetime


class MilestoneUpdateRequest(BaseModel):
    title: str | None = None
    stage: str | None = None
    target_date: datetime | None = None
    status: str | None = Field(default=None, description="pending, completed, overdue, waived")
    completed_at: datetime | None = None


class MilestoneResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    title: str
    stage: str
    target_date: datetime
    completed_at: datetime | None
    status: str
    created_at: datetime


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    assigned_to_user_id: uuid.UUID | None = None
    due_date: datetime | None = None
    priority: str = Field(default="medium", description="critical, high, medium, low")


class TaskUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    assigned_to_user_id: uuid.UUID | None = None
    due_date: datetime | None = None
    priority: str | None = None
    status: str | None = None
    is_completed: bool | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    title: str
    description: str | None
    assigned_to_user_id: uuid.UUID | None
    assigned_to_name: str | None = None
    due_date: datetime | None
    priority: str
    status: str
    is_completed: bool
    completed_at: datetime | None
    completed_by_user_id: uuid.UUID | None
    created_at: datetime


class NoteCreateRequest(BaseModel):
    note_type: str = Field(default="internal", description="internal, client_communication, legal_strategy, status_update")
    content: str = Field(..., min_length=1)
    is_client_visible: bool = Field(default=False)


class NoteResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None = None
    note_type: str
    content: str
    is_client_visible: bool
    created_at: datetime
    updated_at: datetime


class TimelineEventResponse(BaseModel):
    id: uuid.UUID
    action: str
    actor_id: uuid.UUID | None
    occurred_at: datetime
    metadata: dict


class CaseDetailResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    client_email: str
    client_nationality: str
    case_number: str
    title: str
    jurisdiction: str
    visa_category: str
    status: str
    # Phase 2 Decoupled Lifecycle State
    payment_clearance_status: str = "PENDING"
    preparation_status: str = "CLEARANCE_PENDING"
    operational_state: str = "ACTIVE"
    review_status: str = "NOT_STARTED"
    outcome_status: str | None = None
    hold_reason: str | None = None
    hold_applied_at: datetime | None = None
    prior_case_id: uuid.UUID | None = None
    reapplication_reason: str | None = None
    priority_date: datetime | None
    created_at: datetime
    updated_at: datetime
    # Phase 9 Configuration & Approval Gates State
    client_engagement_type: str = "RETAINED_CLIENT"
    is_retained: bool = True
    submission_authorization_status: str = "NOT_REQUESTED"
    handover_authorization_status: str = "NOT_REQUESTED"
    substantive_authorizations: dict = {}
    progressive_reviews: dict = {}
    pinned_firm_config_snapshot: dict = {}
    firm_config_version: int = 1
    firm_config_update_available: bool = False
    assignments: list[AssignmentResponse] = []
    milestones: list[MilestoneResponse] = []
    tasks_count: int = 0
    completed_tasks_count: int = 0


class PaginatedCasesResponse(BaseModel):
    items: list[CaseDetailResponse]
    total: int
    limit: int
    offset: int


class SOPAuditRequest(BaseModel):
    sop_text: str = Field(..., min_length=10)
    jurisdiction: str = Field(default="CA", min_length=2, max_length=10)
    applicant_profile: dict | None = None
    has_study_gap: bool | None = False


class SOPFindingResponse(BaseModel):
    dimension: str
    severity: str
    issue_code: str
    title: str
    description: str
    remediation: str
    statutory_reference: str | None = None


class SOPAuditResponse(BaseModel):
    overall_score: float
    is_statutorily_sound: bool
    verdict: str
    jurisdiction: str
    dimension_scores: dict[str, float]
    strengths: list[str]
    findings: list[SOPFindingResponse]
    remediation_summary: list[str]


# --- Visa Appointment & Financial Sponsor Schemas ---

class VisaAppointmentCreateRequest(BaseModel):
    vac_center: str = Field(..., min_length=2, max_length=120)
    consular_post: str = Field(..., min_length=2, max_length=120)
    ofc_biometrics_slot: datetime | None = None
    consular_interview_slot: datetime | None = None
    dropbox_eligible: bool = False
    tracking_number_blue_dart: str | None = None
    courier_status: str = Field(default="pending_pickup", max_length=64)
    status_221g: bool = False
    status_221g_color: str | None = Field(default=None, max_length=32)
    appointment_status: str = Field(default="scheduled", max_length=32)
    notes: str | None = None


class VisaAppointmentUpdateRequest(BaseModel):
    vac_center: str | None = None
    consular_post: str | None = None
    ofc_biometrics_slot: datetime | None = None
    consular_interview_slot: datetime | None = None
    dropbox_eligible: bool | None = None
    tracking_number_blue_dart: str | None = None
    courier_status: str | None = None
    status_221g: bool | None = None
    status_221g_color: str | None = None
    appointment_status: str | None = None
    notes: str | None = None


class VisaAppointmentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    case_id: uuid.UUID
    client_id: uuid.UUID
    case_number: str | None = None
    client_name: str | None = None
    visa_category: str | None = None
    vac_center: str
    consular_post: str
    ofc_biometrics_slot: datetime | None
    consular_interview_slot: datetime | None
    dropbox_eligible: bool
    tracking_number_blue_dart: str | None
    courier_status: str
    status_221g: bool
    status_221g_color: str | None
    appointment_status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class FinancialSponsorCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    relationship: str = Field(..., min_length=2, max_length=64)
    sponsor_type: str = Field(default="individual", max_length=32)
    pan: str | None = Field(default=None, max_length=32)
    itr_gross_income: float = Field(default=0.0, ge=0.0)
    liquid_funds: float = Field(default=0.0, ge=0.0)
    currency: str = Field(default="INR", max_length=3)
    bank_name: str | None = Field(default=None, max_length=120)
    loan_sanction_amount: float = Field(default=0.0, ge=0.0)
    affidavit_doc_id: uuid.UUID | None = None
    notes: str | None = None


class FinancialSponsorResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    case_id: uuid.UUID | None
    client_id: uuid.UUID
    name: str
    relationship: str
    sponsor_type: str
    pan: str | None
    itr_gross_income: float
    liquid_funds: float
    currency: str
    bank_name: str | None
    loan_sanction_amount: float
    affidavit_doc_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
