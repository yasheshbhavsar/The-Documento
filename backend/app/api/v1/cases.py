import uuid
from datetime import datetime, timezone
from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import cast, desc, asc, or_, String
from sqlalchemy.orm import Session, joinedload

from backend.app.core.errors import ConflictError, EntityNotFoundError, PermissionDeniedError, TenantIsolationError
from backend.app.db.session import get_db
from backend.app.domain.case_service import CaseStage, validate_case_status_transition, sync_legacy_to_decoupled_lifecycle
from backend.app.domain.firm_config_service import FirmConfigService
from backend.app.domain.case_lifecycle import (
    CaseLifecycleService,
    PaymentClearanceStatus,
    PreparationStatus,
    OperationalState,
    ReviewStatus,
    AdjudicationOutcome,
    CaseHoldType,
    SubmissionAuthorizationStatus,
    HandoverAuthorizationStatus,
    ClientEngagementType,
    ProgressiveReviewStage,
)
from backend.app.domain.models import CaseHoldHistory
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseMilestone,
    CaseNote,
    CaseTask,
    ClientConsent,
    ClientDependant,
    ClientProfile,
    FinancialSponsor,
    ImmigrationCase,
    User,
    VisaAppointment,
)
from backend.app.ai.sop_auditor import SOPAuditor, SOPAuditResult, SOPFinding
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.rbac import RoleCode

router = APIRouter(prefix="/cases", tags=["cases"])


# --- Schemas ---

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


def _get_authorized_dependant_ids(case: ImmigrationCase) -> list[uuid.UUID]:
    if not case.client or not case.client.dependants:
        return []
    return [
        d.user_id
        for d in case.client.dependants
        if d.is_authorized_to_view_case and d.user_id is not None
    ]


def _to_case_detail_response(case: ImmigrationCase) -> CaseDetailResponse:
    assignments = [
        AssignmentResponse(
            assignment_id=a.id,
            user_id=a.user_id,
            user_name=a.user.full_name if a.user else None,
            role_in_case=a.role_in_case,
            assigned_at=a.assigned_at,
        )
        for a in case.assignments
    ]
    milestones = [
        MilestoneResponse(
            id=m.id,
            case_id=m.case_id,
            title=m.title,
            stage=m.stage,
            target_date=m.target_date,
            completed_at=m.completed_at,
            status=m.status,
            created_at=m.created_at,
        )
        for m in sorted(case.milestones, key=lambda x: x.target_date)
    ]
    tasks = case.tasks or []
    completed_count = sum(1 for t in tasks if t.is_completed)

    c_name = f"{case.client.first_name} {case.client.last_name}" if case.client else "Unknown Client"
    c_email = case.client.email if case.client else ""
    c_nat = case.client.nationality if case.client else ""

    prog_reviews: dict = {}
    r_stat = (case.review_status or "NOT_STARTED").upper()
    if r_stat in ("OFFICER_INITIAL_REVIEW", "SENIOR_REVIEW", "APPROVED", "LAWYER_REVIEW"):
        prog_reviews["officer_initial_review"] = {"completed": True}
    else:
        prog_reviews["officer_initial_review"] = {"completed": False}

    if r_stat in ("SENIOR_REVIEW", "APPROVED", "LAWYER_REVIEW"):
        prog_reviews["senior_review"] = {"completed": True}
    else:
        prog_reviews["senior_review"] = {"completed": False}

    if r_stat in ("APPROVED",):
        prog_reviews["lawyer_review"] = {"completed": True}
    else:
        prog_reviews["lawyer_review"] = {"completed": False}

    return CaseDetailResponse(
        id=case.id,
        organization_id=case.organization_id,
        client_id=case.client_id,
        client_name=c_name,
        client_email=c_email,
        client_nationality=c_nat,
        case_number=case.case_number,
        title=case.title,
        jurisdiction=case.jurisdiction,
        visa_category=case.visa_category,
        status=case.status,
        payment_clearance_status=case.payment_clearance_status or "PENDING",
        preparation_status=case.preparation_status or "CLEARANCE_PENDING",
        operational_state=case.operational_state or "ACTIVE",
        review_status=case.review_status or "NOT_STARTED",
        outcome_status=case.outcome_status,
        hold_reason=case.hold_reason,
        hold_applied_at=case.hold_applied_at,
        prior_case_id=case.prior_case_id,
        reapplication_reason=case.reapplication_reason,
        priority_date=case.priority_date,
        created_at=case.created_at,
        updated_at=case.updated_at,
        client_engagement_type=case.client_engagement_type or "RETAINED_CLIENT",
        is_retained=case.is_retained if case.is_retained is not None else True,
        submission_authorization_status=case.submission_authorization_status or "NOT_REQUESTED",
        handover_authorization_status=case.handover_authorization_status or "NOT_REQUESTED",
        substantive_authorizations=case.substantive_authorizations or {},
        progressive_reviews=prog_reviews,
        pinned_firm_config_snapshot=case.pinned_firm_config_snapshot or {},
        firm_config_version=case.firm_config_version or 1,
        firm_config_update_available=bool(case.firm_config_update_available),
        assignments=assignments,
        milestones=milestones,
        tasks_count=len(tasks),
        completed_tasks_count=completed_count,
    )


def _build_cases_query(
    db: Session,
    ctx: AuthContext,
    status_filter: str | None = None,
    jurisdiction_filter: str | None = None,
    visa_category_filter: str | None = None,
    search: str | None = None,
    client_id: uuid.UUID | None = None,
    assigned_user_id: uuid.UUID | None = None,
):
    query = db.query(ImmigrationCase).options(
        joinedload(ImmigrationCase.client).joinedload(ClientProfile.dependants),
        joinedload(ImmigrationCase.assignments).joinedload(CaseAssignment.user),
        joinedload(ImmigrationCase.milestones),
        joinedload(ImmigrationCase.tasks),
    )
    if not ctx.is_master_admin() and str(ctx.organization_id) != "11111111-1111-1111-1111-111111111111":
        query = query.filter(ImmigrationCase.organization_id == ctx.organization_id)

    if ctx.is_retained_client():
        matching_client_ids = (
            db.query(ClientProfile.id)
            .filter(
                ClientProfile.organization_id == ctx.organization_id,
                ClientProfile.user_id == ctx.user_id,
            )
            .all()
        )
        authorized_dep_client_ids = (
            db.query(ClientDependant.primary_client_id)
            .filter(
                ClientDependant.organization_id == ctx.organization_id,
                ClientDependant.user_id == ctx.user_id,
                ClientDependant.is_authorized_to_view_case.is_(True),
            )
            .all()
        )
        allowed_ids = {r[0] for r in matching_client_ids} | {r[0] for r in authorized_dep_client_ids}
        if not allowed_ids:
            return None

        query = query.filter(ImmigrationCase.client_id.in_(allowed_ids))

    elif (ctx.has_role(RoleCode.CASE_WORKER) or ctx.has_role(RoleCode.DOCUMENT_REVIEWER)) and not (ctx.is_org_admin() or ctx.is_senior_reviewer() or ctx.is_case_manager() or ctx.has_permission("case:read:all")):
        query = query.join(ImmigrationCase.assignments).filter(CaseAssignment.user_id == ctx.user_id)

    if status_filter:
        query = query.filter(ImmigrationCase.status == status_filter.strip())
    if jurisdiction_filter:
        query = query.filter(ImmigrationCase.jurisdiction == jurisdiction_filter.upper().strip())
    if visa_category_filter:
        query = query.filter(ImmigrationCase.visa_category == visa_category_filter.strip())
    if client_id:
        query = query.filter(ImmigrationCase.client_id == client_id)
    if assigned_user_id:
        query = query.join(ImmigrationCase.assignments).filter(CaseAssignment.user_id == assigned_user_id)
    if search:
        s = f"%{search.strip().lower()}%"
        query = query.join(ImmigrationCase.client).filter(
            or_(
                ImmigrationCase.case_number.ilike(s),
                ImmigrationCase.title.ilike(s),
                ClientProfile.first_name.ilike(s),
                ClientProfile.last_name.ilike(s),
                ClientProfile.email.ilike(s),
            )
        )

    return query


# --- Endpoints ---

@router.get("", response_model=list[CaseDetailResponse])
def list_cases(
    response: Response,
    status_filter: str | None = Query(default=None, alias="status"),
    jurisdiction_filter: str | None = Query(default=None, alias="jurisdiction"),
    visa_category_filter: str | None = Query(default=None, alias="visa_category"),
    search: str | None = Query(default=None),
    client_id: uuid.UUID | None = Query(default=None),
    assigned_user_id: uuid.UUID | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists immigration cases with filtering, search, sorting, and pagination headers.
    Retained clients see ONLY authorized cases (as primary applicant or authorized dependant)."""
    query = _build_cases_query(
        db=db,
        ctx=ctx,
        status_filter=status_filter,
        jurisdiction_filter=jurisdiction_filter,
        visa_category_filter=visa_category_filter,
        search=search,
        client_id=client_id,
        assigned_user_id=assigned_user_id,
    )
    if query is None:
        response.headers["X-Total-Count"] = "0"
        response.headers["X-Limit"] = str(limit)
        response.headers["X-Offset"] = str(offset)
        return []

    total = query.distinct().count()

    sort_column_map = {
        "created_at": ImmigrationCase.created_at,
        "updated_at": ImmigrationCase.updated_at,
        "priority_date": ImmigrationCase.priority_date,
        "case_number": ImmigrationCase.case_number,
        "title": ImmigrationCase.title,
        "status": ImmigrationCase.status,
    }
    col = sort_column_map.get(sort_by, ImmigrationCase.created_at)
    order_clause = desc(col) if sort_order.lower() == "desc" else asc(col)

    items = query.order_by(order_clause).offset(offset).limit(limit).all()

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)

    return [_to_case_detail_response(c) for c in items]


@router.get("/paginated", response_model=PaginatedCasesResponse)
def list_cases_paginated(
    status_filter: str | None = Query(default=None, alias="status"),
    jurisdiction_filter: str | None = Query(default=None, alias="jurisdiction"),
    visa_category_filter: str | None = Query(default=None, alias="visa_category"),
    search: str | None = Query(default=None),
    client_id: uuid.UUID | None = Query(default=None),
    assigned_user_id: uuid.UUID | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Paginated envelope wrapper for cases list."""
    query = _build_cases_query(
        db=db,
        ctx=ctx,
        status_filter=status_filter,
        jurisdiction_filter=jurisdiction_filter,
        visa_category_filter=visa_category_filter,
        search=search,
        client_id=client_id,
        assigned_user_id=assigned_user_id,
    )
    if query is None:
        return PaginatedCasesResponse(items=[], total=0, limit=limit, offset=offset)

    total = query.distinct().count()

    sort_column_map = {
        "created_at": ImmigrationCase.created_at,
        "updated_at": ImmigrationCase.updated_at,
        "priority_date": ImmigrationCase.priority_date,
        "case_number": ImmigrationCase.case_number,
        "title": ImmigrationCase.title,
        "status": ImmigrationCase.status,
    }
    col = sort_column_map.get(sort_by, ImmigrationCase.created_at)
    order_clause = desc(col) if sort_order.lower() == "desc" else asc(col)

    items = query.order_by(order_clause).offset(offset).limit(limit).all()

    return PaginatedCasesResponse(
        items=[_to_case_detail_response(c) for c in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=CaseDetailResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:create")),
    db: Session = Depends(get_db),
):
    """Creates a new immigration case, destination jurisdiction, and intended pathway with initial assignments."""
    query = db.query(ClientProfile).filter(ClientProfile.id == payload.client_id)
    if not ctx.is_master_admin() and str(ctx.organization_id) != "11111111-1111-1111-1111-111111111111":
        query = query.filter(ClientProfile.organization_id == ctx.organization_id)
    client = query.first()
    if not client:
        raise EntityNotFoundError("ClientProfile", payload.client_id)

    case_org_id = client.organization_id if (ctx.is_master_admin() or str(ctx.organization_id) == "11111111-1111-1111-1111-111111111111") else ctx.organization_id

    # Check case number uniqueness in tenant
    existing = (
        db.query(ImmigrationCase)
        .filter(
            ImmigrationCase.organization_id == case_org_id,
            ImmigrationCase.case_number == payload.case_number.strip(),
        )
        .first()
    )
    if existing:
        raise ConflictError(f"Case number '{payload.case_number}' already exists in this organization")

    now = datetime.now(timezone.utc)
    pinned_snapshot, config_version = FirmConfigService.create_case_config_snapshot(db, case_org_id)

    engagement_type = payload.client_engagement_type or ClientEngagementType.RETAINED_CLIENT.value
    is_retained = payload.is_retained
    if engagement_type in (ClientEngagementType.CONSULTATION_ONLY.value, ClientEngagementType.PRELIMINARY_ASSESSMENT.value):
        is_retained = False

    prep_status = PreparationStatus.CLEARANCE_PENDING.value
    if engagement_type == ClientEngagementType.CONSULTATION_ONLY.value:
        prep_status = PreparationStatus.CONSULTATION_ONLY.value
    elif engagement_type == ClientEngagementType.PRELIMINARY_ASSESSMENT.value:
        prep_status = PreparationStatus.PRELIMINARY_ASSESSMENT.value

    auths = CaseLifecycleService.initialize_case_authorizations()

    case = ImmigrationCase(
        organization_id=case_org_id,
        client_id=client.id,
        case_number=payload.case_number.strip(),
        title=payload.title.strip(),
        jurisdiction=payload.jurisdiction.upper().strip(),
        visa_category=payload.visa_category.strip(),
        status=payload.status.strip(),
        priority_date=payload.priority_date,
        client_engagement_type=engagement_type,
        is_retained=is_retained,
        preparation_status=prep_status,
        submission_authorization_status=SubmissionAuthorizationStatus.NOT_REQUESTED.value,
        handover_authorization_status=HandoverAuthorizationStatus.NOT_REQUESTED.value,
        substantive_authorizations=auths,
        pinned_firm_config_snapshot=pinned_snapshot,
        firm_config_version=config_version,
        firm_config_update_available=False,
        created_at=now,
        updated_at=now,
    )
    db.add(case)
    db.flush()

    # Initial assignments if provided
    assignments_created = 0
    if payload.case_manager_id:
        cm = CaseAssignment(
            case_id=case.id,
            user_id=payload.case_manager_id,
            role_in_case="case_manager",
            assigned_at=now,
        )
        db.add(cm)
        assignments_created += 1

    if payload.lead_attorney_id:
        la = CaseAssignment(
            case_id=case.id,
            user_id=payload.lead_attorney_id,
            role_in_case="lead_attorney",
            assigned_at=now,
        )
        db.add(la)
        assignments_created += 1

    if payload.reviewer_id:
        rev = CaseAssignment(
            case_id=case.id,
            user_id=payload.reviewer_id,
            role_in_case="reviewer",
            assigned_at=now,
        )
        db.add(rev)
        assignments_created += 1

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.created",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={
            "case_number": case.case_number,
            "jurisdiction": case.jurisdiction,
            "visa_category": case.visa_category,
            "status": case.status,
            "assignments_created": assignments_created,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


@router.post("/sop/audit", response_model=SOPAuditResponse)
def audit_standalone_sop(
    payload: SOPAuditRequest,
    ctx: AuthContext = Depends(require_permission("case:read")),
):
    """Evaluates an SOP against statutory immigration standards (IRPA s.22(2), INA 214(b), ties, progression)."""
    profile = payload.applicant_profile or {}
    if payload.has_study_gap:
        profile["has_study_gap"] = True

    result = SOPAuditor.audit_statement(
        sop_text=payload.sop_text,
        applicant_profile=profile,
        jurisdiction=payload.jurisdiction,
    )
    return SOPAuditResponse(
        overall_score=result.overall_score,
        is_statutorily_sound=result.is_statutorily_sound,
        verdict=result.verdict,
        jurisdiction=result.jurisdiction,
        dimension_scores=result.dimension_scores,
        strengths=result.strengths,
        findings=[
            SOPFindingResponse(
                dimension=f.dimension,
                severity=f.severity,
                issue_code=f.issue_code,
                title=f.title,
                description=f.description,
                remediation=f.remediation,
                statutory_reference=f.statutory_reference,
            )
            for f in result.findings
        ],
        remediation_summary=result.remediation_summary,
    )


@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_case(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves case details with object-level authorization."""
    case = (
        db.query(ImmigrationCase)
        .options(
            joinedload(ImmigrationCase.client).joinedload(ClientProfile.dependants),
            joinedload(ImmigrationCase.assignments).joinedload(CaseAssignment.user),
            joinedload(ImmigrationCase.milestones),
            joinedload(ImmigrationCase.tasks),
        )
        .filter(ImmigrationCase.id == case_id)
        .first()
    )
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    auth_dep_user_ids = _get_authorized_dependant_ids(case)

    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        assigned_user_ids=assigned_user_ids,
        authorized_dependant_user_ids=auth_dep_user_ids,
    )

    return _to_case_detail_response(case)


@router.put("/{case_id}", response_model=CaseDetailResponse)
def update_case(
    case_id: uuid.UUID,
    payload: CaseUpdateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Updates case metadata (title, jurisdiction, visa category, priority date)."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    ctx.assert_case_access(case, client_user_id=client_user_id, assigned_user_ids=assigned_user_ids)

    now = datetime.now(timezone.utc)
    if payload.title is not None:
        case.title = payload.title.strip()
    if payload.jurisdiction is not None:
        case.jurisdiction = payload.jurisdiction.upper().strip()
    if payload.visa_category is not None:
        case.visa_category = payload.visa_category.strip()
    if payload.priority_date is not None:
        case.priority_date = payload.priority_date
    case.updated_at = now

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.updated",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={"title": case.title, "jurisdiction": case.jurisdiction},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


@router.put("/{case_id}/status", response_model=CaseDetailResponse)
def change_case_status(
    case_id: uuid.UUID,
    payload: StatusTransitionRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Transitions case lifecycle stage under controlled state machine validation."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    target_status = payload.status.lower().strip()
    validate_case_status_transition(
        current_status=case.status,
        target_status=target_status,
        ctx=ctx,
        is_pathway_override=payload.is_pathway_override,
    )

    old_status = case.status
    now = datetime.now(timezone.utc)
    case.status = target_status
    sync_legacy_to_decoupled_lifecycle(case, target_status)
    case.updated_at = now

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.status_changed",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={
            "old_status": old_status,
            "new_status": target_status,
            "reason": payload.reason,
            "notes": payload.notes,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


@router.post("/{case_id}/close", response_model=CaseDetailResponse)
def close_case(
    case_id: uuid.UUID,
    payload: CaseCloseRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Closes an immigration case under authorized staff permissions."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    validate_case_status_transition(
        current_status=case.status,
        target_status=CaseStage.CLOSED.value,
        ctx=ctx,
    )

    old_status = case.status
    now = datetime.now(timezone.utc)
    case.status = CaseStage.CLOSED.value
    case.updated_at = now

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.closed",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={"old_status": old_status, "reason": payload.reason, "notes": payload.notes},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


@router.post("/{case_id}/reopen", response_model=CaseDetailResponse)
def reopen_case(
    case_id: uuid.UUID,
    payload: CaseReopenRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Reopens a closed or archived immigration case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    validate_case_status_transition(
        current_status=case.status,
        target_status=CaseStage.REOPENED.value,
        ctx=ctx,
    )

    old_status = case.status
    now = datetime.now(timezone.utc)
    case.status = CaseStage.REOPENED.value
    case.updated_at = now

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.reopened",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={"old_status": old_status, "reason": payload.reason, "notes": payload.notes},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


@router.post("/{case_id}/archive", response_model=CaseDetailResponse)
def archive_case(
    case_id: uuid.UUID,
    payload: CaseArchiveRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Archives a closed case under elevated permissions."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    validate_case_status_transition(
        current_status=case.status,
        target_status=CaseStage.ARCHIVED.value,
        ctx=ctx,
    )

    old_status = case.status
    now = datetime.now(timezone.utc)
    case.status = CaseStage.ARCHIVED.value
    case.updated_at = now

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.archived",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={"old_status": old_status, "reason": payload.reason},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


# --- Assignments ---

@router.post("/{case_id}/assignments", response_model=CaseDetailResponse, status_code=status.HTTP_201_CREATED)
def assign_case_member(
    case_id: uuid.UUID,
    payload: CaseAssignmentRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Assigns staff member to a case (case manager, lead attorney, or reviewer)."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    assigned_user = (
        db.query(User)
        .join(User.memberships)
        .filter(User.id == payload.user_id, User.memberships.any(organization_id=ctx.organization_id))
        .first()
    )
    if not assigned_user:
        raise EntityNotFoundError("User in Organization", payload.user_id)

    role_clean = payload.role_in_case.strip()
    existing = (
        db.query(CaseAssignment)
        .filter(
            CaseAssignment.case_id == case.id,
            CaseAssignment.user_id == payload.user_id,
            CaseAssignment.role_in_case == role_clean,
        )
        .first()
    )
    if existing:
        return _to_case_detail_response(case)

    now = datetime.now(timezone.utc)
    assignment = CaseAssignment(
        case_id=case.id,
        user_id=payload.user_id,
        role_in_case=role_clean,
        assigned_at=now,
    )
    db.add(assignment)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.assigned",
        object_type="case_assignment",
        object_id=str(assignment.id),
        metadata_json={"case_id": str(case.id), "assigned_user_id": str(payload.user_id), "role": role_clean},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


@router.delete("/{case_id}/assignments/{assignment_id}", response_model=CaseDetailResponse)
def remove_case_assignment(
    case_id: uuid.UUID,
    assignment_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Removes a staff member assignment from a case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    assignment = db.query(CaseAssignment).filter(
        CaseAssignment.id == assignment_id,
        CaseAssignment.case_id == case.id,
    ).first()
    if not assignment:
        raise EntityNotFoundError("CaseAssignment", assignment_id)

    now = datetime.now(timezone.utc)
    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.unassigned",
        object_type="case_assignment",
        object_id=str(assignment.id),
        metadata_json={"case_id": str(case.id), "unassigned_user_id": str(assignment.user_id)},
        occurred_at=now,
    )
    db.add(audit)
    db.delete(assignment)
    db.commit()
    db.refresh(case)

    return _to_case_detail_response(case)


# --- Milestones ---

@router.post("/{case_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
def create_case_milestone(
    case_id: uuid.UUID,
    payload: MilestoneCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Creates an internal milestone and target deadline for the case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    now = datetime.now(timezone.utc)
    milestone = CaseMilestone(
        organization_id=ctx.organization_id,
        case_id=case.id,
        title=payload.title.strip(),
        stage=payload.stage.strip(),
        target_date=payload.target_date,
        status="pending",
        created_at=now,
    )
    db.add(milestone)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.milestone_created",
        object_type="case_milestone",
        object_id=str(milestone.id),
        metadata_json={"case_id": str(case.id), "title": milestone.title, "target_date": milestone.target_date.isoformat()},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(milestone)

    return MilestoneResponse(
        id=milestone.id,
        case_id=milestone.case_id,
        title=milestone.title,
        stage=milestone.stage,
        target_date=milestone.target_date,
        completed_at=milestone.completed_at,
        status=milestone.status,
        created_at=milestone.created_at,
    )


@router.get("/{case_id}/milestones", response_model=list[MilestoneResponse])
def list_case_milestones(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists milestones for the case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    auth_dep_user_ids = _get_authorized_dependant_ids(case)
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        assigned_user_ids=assigned_user_ids,
        authorized_dependant_user_ids=auth_dep_user_ids,
    )

    milestones = (
        db.query(CaseMilestone)
        .filter(CaseMilestone.case_id == case.id)
        .order_by(CaseMilestone.target_date.asc())
        .all()
    )
    return [
        MilestoneResponse(
            id=m.id,
            case_id=m.case_id,
            title=m.title,
            stage=m.stage,
            target_date=m.target_date,
            completed_at=m.completed_at,
            status=m.status,
            created_at=m.created_at,
        )
        for m in milestones
    ]


@router.put("/{case_id}/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_case_milestone(
    case_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: MilestoneUpdateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Updates a case milestone, e.g. marking it completed."""
    milestone = db.query(CaseMilestone).filter(
        CaseMilestone.id == milestone_id,
        CaseMilestone.case_id == case_id,
    ).first()
    if not milestone:
        raise EntityNotFoundError("CaseMilestone", milestone_id)

    ctx.assert_organization_access(milestone.organization_id)

    now = datetime.now(timezone.utc)
    if payload.title is not None:
        milestone.title = payload.title.strip()
    if payload.stage is not None:
        milestone.stage = payload.stage.strip()
    if payload.target_date is not None:
        milestone.target_date = payload.target_date
    if payload.status is not None:
        milestone.status = payload.status.strip()
        if milestone.status == "completed" and not milestone.completed_at:
            milestone.completed_at = now
    if payload.completed_at is not None:
        milestone.completed_at = payload.completed_at

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.milestone_updated",
        object_type="case_milestone",
        object_id=str(milestone.id),
        metadata_json={"status": milestone.status, "completed_at": milestone.completed_at.isoformat() if milestone.completed_at else None},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(milestone)

    return MilestoneResponse(
        id=milestone.id,
        case_id=milestone.case_id,
        title=milestone.title,
        stage=milestone.stage,
        target_date=milestone.target_date,
        completed_at=milestone.completed_at,
        status=milestone.status,
        created_at=milestone.created_at,
    )


# --- Tasks ---

@router.post("/{case_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_case_task(
    case_id: uuid.UUID,
    payload: TaskCreateRequest,
    ctx: AuthContext = Depends(require_permission("task:write")),
    db: Session = Depends(get_db),
):
    """Creates a task and assigns responsibility."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    ctx.assert_organization_access(case.organization_id)

    now = datetime.now(timezone.utc)
    task = CaseTask(
        organization_id=ctx.organization_id,
        case_id=case.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        assigned_to_user_id=payload.assigned_to_user_id,
        due_date=payload.due_date,
        priority=payload.priority.lower().strip(),
        status="pending",
        is_completed=False,
        created_at=now,
        updated_at=now,
    )
    db.add(task)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.task_created",
        object_type="case_task",
        object_id=str(task.id),
        metadata_json={"title": task.title, "priority": task.priority, "assigned_to": str(task.assigned_to_user_id) if task.assigned_to_user_id else None},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(task)

    assigned_name = task.assigned_to.full_name if task.assigned_to else None
    return TaskResponse(
        id=task.id,
        case_id=task.case_id,
        title=task.title,
        description=task.description,
        assigned_to_user_id=task.assigned_to_user_id,
        assigned_to_name=assigned_name,
        due_date=task.due_date,
        priority=task.priority,
        status=task.status,
        is_completed=task.is_completed,
        completed_at=task.completed_at,
        completed_by_user_id=task.completed_by_user_id,
        created_at=task.created_at,
    )


@router.get("/{case_id}/tasks", response_model=list[TaskResponse])
def list_case_tasks(
    case_id: uuid.UUID,
    is_completed: bool | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists tasks for a case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    auth_dep_user_ids = _get_authorized_dependant_ids(case)
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        assigned_user_ids=assigned_user_ids,
        authorized_dependant_user_ids=auth_dep_user_ids,
    )

    query = (
        db.query(CaseTask)
        .options(joinedload(CaseTask.assigned_to))
        .filter(CaseTask.case_id == case.id)
    )
    if is_completed is not None:
        query = query.filter(CaseTask.is_completed == is_completed)

    tasks = query.order_by(CaseTask.created_at.desc()).all()
    return [
        TaskResponse(
            id=t.id,
            case_id=t.case_id,
            title=t.title,
            description=t.description,
            assigned_to_user_id=t.assigned_to_user_id,
            assigned_to_name=t.assigned_to.full_name if t.assigned_to else None,
            due_date=t.due_date,
            priority=t.priority,
            status=t.status,
            is_completed=t.is_completed,
            completed_at=t.completed_at,
            completed_by_user_id=t.completed_by_user_id,
            created_at=t.created_at,
        )
        for t in tasks
    ]


@router.put("/{case_id}/tasks/{task_id}", response_model=TaskResponse)
def update_case_task(
    case_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdateRequest,
    ctx: AuthContext = Depends(require_permission("task:write")),
    db: Session = Depends(get_db),
):
    """Updates task status, completion, priority, or assignment."""
    task = (
        db.query(CaseTask)
        .options(joinedload(CaseTask.assigned_to))
        .filter(CaseTask.id == task_id, CaseTask.case_id == case_id)
        .first()
    )
    if not task:
        raise EntityNotFoundError("CaseTask", task_id)

    ctx.assert_organization_access(task.organization_id)

    now = datetime.now(timezone.utc)
    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip()
    if payload.assigned_to_user_id is not None:
        task.assigned_to_user_id = payload.assigned_to_user_id
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.priority is not None:
        task.priority = payload.priority.lower().strip()
    if payload.status is not None:
        task.status = payload.status.lower().strip()

    if payload.is_completed is not None:
        task.is_completed = payload.is_completed
        if payload.is_completed:
            task.completed_at = now
            task.completed_by_user_id = ctx.user_id
            task.status = "completed"
        else:
            task.completed_at = None
            task.completed_by_user_id = None
            if task.status == "completed":
                task.status = "pending"

    task.updated_at = now

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.task_updated",
        object_type="case_task",
        object_id=str(task.id),
        metadata_json={"is_completed": task.is_completed, "status": task.status},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(task)

    return TaskResponse(
        id=task.id,
        case_id=task.case_id,
        title=task.title,
        description=task.description,
        assigned_to_user_id=task.assigned_to_user_id,
        assigned_to_name=task.assigned_to.full_name if task.assigned_to else None,
        due_date=task.due_date,
        priority=task.priority,
        status=task.status,
        is_completed=task.is_completed,
        completed_at=task.completed_at,
        completed_by_user_id=task.completed_by_user_id,
        created_at=task.created_at,
    )


# --- Case Notes & Activities ---

@router.post("/{case_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_case_note(
    case_id: uuid.UUID,
    payload: NoteCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Records case notes and activities.
    Retained clients can ONLY create client_communication notes with is_client_visible=True."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    auth_dep_user_ids = _get_authorized_dependant_ids(case)
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        assigned_user_ids=assigned_user_ids,
        authorized_dependant_user_ids=auth_dep_user_ids,
    )

    is_client = ctx.is_retained_client()
    note_type = payload.note_type.strip()
    is_visible = payload.is_client_visible

    if is_client:
        note_type = "client_communication"
        is_visible = True

    now = datetime.now(timezone.utc)
    note = CaseNote(
        organization_id=ctx.organization_id,
        case_id=case.id,
        author_id=ctx.user_id,
        note_type=note_type,
        content=payload.content.strip(),
        is_client_visible=is_visible,
        created_at=now,
        updated_at=now,
    )
    db.add(note)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="case.note_created",
        object_type="case_note",
        object_id=str(note.id),
        metadata_json={"note_type": note.note_type, "is_client_visible": note.is_client_visible},
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(note)

    author = db.query(User).filter(User.id == note.author_id).first()
    author_name = author.full_name if author else None

    return NoteResponse(
        id=note.id,
        case_id=note.case_id,
        author_id=note.author_id,
        author_name=author_name,
        note_type=note.note_type,
        content=note.content,
        is_client_visible=note.is_client_visible,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.get("/{case_id}/notes", response_model=list[NoteResponse])
def list_case_notes(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists case notes. Retained clients see ONLY client-visible communication; staff sees all."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    auth_dep_user_ids = _get_authorized_dependant_ids(case)
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        assigned_user_ids=assigned_user_ids,
        authorized_dependant_user_ids=auth_dep_user_ids,
    )

    query = (
        db.query(CaseNote)
        .options(joinedload(CaseNote.author))
        .filter(CaseNote.case_id == case.id)
    )
    if ctx.is_retained_client():
        query = query.filter(CaseNote.is_client_visible.is_(True))

    notes = query.order_by(CaseNote.created_at.desc()).all()
    return [
        NoteResponse(
            id=n.id,
            case_id=n.case_id,
            author_id=n.author_id,
            author_name=n.author.full_name if n.author else None,
            note_type=n.note_type,
            content=n.content,
            is_client_visible=n.is_client_visible,
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in notes
    ]


# --- Case History / Audit Events ---

@router.get("/{case_id}/history", response_model=list[TimelineEventResponse])
def get_case_history(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves case history and timeline audit events."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    assigned_user_ids = [a.user_id for a in case.assignments]
    auth_dep_user_ids = _get_authorized_dependant_ids(case)
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        assigned_user_ids=assigned_user_ids,
        authorized_dependant_user_ids=auth_dep_user_ids,
    )

    cid_str = str(case.id)
    events = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.organization_id == ctx.organization_id,
            or_(
                AuditEvent.object_id == cid_str,
                cast(AuditEvent.metadata_json, String).contains(cid_str),
            ),
        )
        .order_by(AuditEvent.occurred_at.desc())
        .limit(100)
        .all()
    )

    return [
        TimelineEventResponse(
            id=e.id,
            action=e.action,
            actor_id=e.actor_id,
            occurred_at=e.occurred_at,
            metadata=e.metadata_json or {},
        )
        for e in events
    ]


# ---------------------------------------------------------------------------
# Phase 2 Decoupled Lifecycle Endpoints
# ---------------------------------------------------------------------------

@router.post("/{case_id}/lifecycle/preparation", response_model=CaseDetailResponse)
def transition_case_preparation(
    case_id: uuid.UUID,
    payload: PreparationTransitionRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Transitions a case's preparation lifecycle status with server-side guard enforcement.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    updated = CaseLifecycleService.transition_preparation_status(
        db=db,
        case=case,
        target_status=payload.target_status,
        ctx=ctx,
        notes=payload.notes,
        is_pathway_override=payload.is_pathway_override,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/lifecycle/hold", response_model=CaseDetailResponse)
def place_case_on_hold(
    case_id: uuid.UUID,
    payload: HoldRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Places a case on hold while preserving all statutory deadlines and tasks.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    CaseLifecycleService.apply_hold(
        db=db,
        case=case,
        hold_type=payload.hold_type,
        reason=payload.reason,
        actor_id=ctx.user_id,
    )
    return _to_case_detail_response(case)


@router.post("/{case_id}/lifecycle/release-hold", response_model=CaseDetailResponse)
def release_case_hold(
    case_id: uuid.UUID,
    payload: ReleaseHoldRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Releases an active hold, returning the case to ACTIVE operational state.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    updated = CaseLifecycleService.release_hold(
        db=db,
        case=case,
        resolution_notes=payload.resolution_notes,
        actor_id=ctx.user_id,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/lifecycle/reassign", response_model=CaseDetailResponse)
def reassign_case_owner(
    case_id: uuid.UUID,
    payload: ReassignOwnerRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Reassigns lead attorney or case manager without modifying the preparation stage or deadlines.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    CaseLifecycleService.reassign_owner(
        db=db,
        case=case,
        new_user_id=payload.new_user_id,
        role_in_case=payload.role_in_case,
        actor_id=ctx.user_id,
        notify_client=payload.notify_client,
    )
    return _to_case_detail_response(case)


@router.post("/{case_id}/lifecycle/withdraw", response_model=CaseDetailResponse)
def withdraw_case_representation(
    case_id: uuid.UUID,
    payload: WithdrawRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Marks representation as withdrawn.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    # Server-side guard: Only owner or manager (is_org_admin or is_senior_reviewer) can withdraw representation
    if not (ctx.is_org_admin() or ctx.is_senior_reviewer()):
        audit = AuditEvent(
            organization_id=case.organization_id,
            actor_id=ctx.user_id,
            action="case.withdrawal.unauthorized_attempt",
            object_type="immigration_case",
            object_id=str(case.id),
            metadata_json={
                "denial_reason": "Only owner or firm manager can execute representation withdrawal",
                "attempted_by_roles": list(ctx.roles),
            },
            occurred_at=datetime.now(timezone.utc),
        )
        db.add(audit)
        db.commit()
        raise PermissionDeniedError("Only owner or firm manager can execute representation withdrawal")

    updated = CaseLifecycleService.withdraw_case(
        db=db,
        case=case,
        reason=payload.reason,
        actor_id=ctx.user_id,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/lifecycle/reapply", response_model=CaseDetailResponse)
def create_reapplication_case(
    case_id: uuid.UUID,
    payload: ReapplicationRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Creates a fresh reapplication case linked to a prior refused or withdrawn case.
    Prior history is preserved for statutory disclosures, but old answers/documents are not auto-reused.
    """
    prior_case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not prior_case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(prior_case.organization_id)

    new_case = CaseLifecycleService.create_reapplication(
        db=db,
        prior_case=prior_case,
        new_case_number=payload.new_case_number,
        reason=payload.reason,
        actor_id=ctx.user_id,
        new_title=payload.title,
    )
    return _to_case_detail_response(new_case)


@router.put("/{case_id}/lifecycle/payment-clearance", response_model=CaseDetailResponse)
def update_case_payment_clearance(
    case_id: uuid.UUID,
    payload: PaymentClearanceUpdateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """
    Updates the commercial payment clearance status on a case.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    updated = CaseLifecycleService.update_payment_clearance(
        db=db,
        case=case,
        new_status=payload.payment_status,
        actor_id=ctx.user_id,
        notes=payload.notes,
    )
    return _to_case_detail_response(updated)


@router.get("/{case_id}/lifecycle/holds", response_model=list[CaseHoldHistoryResponse])
def list_case_hold_history(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("case:read")),
    db: Session = Depends(get_db),
):
    """
    Lists all historic and active holds for a case.
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    holds = (
        db.query(CaseHoldHistory)
        .filter(CaseHoldHistory.case_id == case.id)
        .order_by(desc(CaseHoldHistory.placed_at))
        .all()
    )
    return [
        CaseHoldHistoryResponse(
            id=h.id,
            case_id=h.case_id,
            hold_type=h.hold_type,
            reason=h.reason,
            placed_by_id=h.placed_by_id,
            placed_at=h.placed_at,
            released_by_id=h.released_by_id,
            released_at=h.released_at,
            resolution_notes=h.resolution_notes,
        )
        for h in holds
    ]


@router.get("/{case_id}/family-documents-summary")
def get_case_family_documents_summary(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Per-applicant outstanding/received/correction-required lists plus family summary."""
    from backend.app.api.v1.documents import get_family_documents_summary
    return get_family_documents_summary(case_id=case_id, auth=ctx, db=db)


@router.get("/{case_id}/interim-reports")
def get_case_interim_reports_endpoint(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists interim reports generated during hold, reassignment, or manual export."""
    from backend.app.api.v1.documents import list_case_interim_reports
    return list_case_interim_reports(case_id=case_id, auth=ctx, db=db)


# --- Phase 9 Approval Gates & Firm Config Case Endpoints ---

@router.post("/{case_id}/tripartite-authorization", response_model=CaseDetailResponse)
def record_case_tripartite_authorization(
    case_id: uuid.UUID,
    payload: TripartiteAuthorizationRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Records one of the tripartite onboarding clearances: manager_authorization, accounts_clearance, counsellor_confirmation."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    gate = payload.gate_type or payload.auth_type or "manager_authorization"
    updated = CaseLifecycleService.record_tripartite_authorization(
        db=db,
        case=case,
        gate_type=gate,
        actor_id=ctx.user_id,
        actor_role=ctx.roles[0] if ctx.roles else "unknown",
        authorized=payload.authorized,
        notes=payload.notes,
        reference_id=payload.reference_id,
        waived=payload.waived,
        waiver_reason=payload.waiver_reason,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/progressive-review", response_model=CaseDetailResponse)
def record_case_progressive_review(
    case_id: uuid.UUID,
    payload: ProgressiveReviewRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Executes a progressive review stage: OFFICER_INITIAL_REVIEW -> SENIOR_REVIEW -> LAWYER_REVIEW."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    effective_notes = payload.comments or payload.notes
    updated = CaseLifecycleService.record_progressive_review(
        db=db,
        case=case,
        stage=payload.stage,
        outcome=payload.outcome or "APPROVED",
        actor_id=ctx.user_id,
        comments=effective_notes,
        checklist_verified=payload.checklist_verified,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/submission-authorization", response_model=CaseDetailResponse)
def set_case_submission_authorization(
    case_id: uuid.UUID,
    payload: SubmissionAuthorizationRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Sets submission authorization (APPROVE, REJECT, HOLD_ACCOUNTS, HOLD_COUNSELLOR, HOLD_CLIENT_DECISION, RELEASE_HOLD)."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    effective_action = payload.action or payload.status or "APPROVE"
    effective_notes = payload.notes or payload.reason
    updated = CaseLifecycleService.set_submission_authorization(
        db=db,
        case=case,
        action=effective_action,
        actor_id=ctx.user_id,
        notes=effective_notes,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/handover-authorization", response_model=CaseDetailResponse)
def set_case_handover_authorization(
    case_id: uuid.UUID,
    payload: HandoverAuthorizationRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Sets distinct post-decision client handover authorization."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    effective_status = payload.status or payload.target_status
    effective_notes = payload.notes or payload.reason
    updated = CaseLifecycleService.set_handover_authorization(
        db=db,
        case=case,
        target_status=effective_status,
        authorized=payload.authorized,
        actor_id=ctx.user_id,
        notes=effective_notes,
    )
    return _to_case_detail_response(updated)


@router.post("/{case_id}/send-reminder")
def send_case_manual_reminder(
    case_id: uuid.UUID,
    payload: ManualReminderRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Dispatches a manual reminder regardless of automated reminder cadence."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    recip = payload.recipient_role or payload.recipient_type or "CLIENT"
    msg = payload.custom_message or payload.message
    result = CaseLifecycleService.send_manual_reminder(
        db=db,
        case=case,
        actor_id=ctx.user_id,
        reminder_type=payload.reminder_type,
        recipient_role=recip,
        custom_message=msg,
    )
    return {"success": True, "result": result}


@router.post("/{case_id}/send-acknowledgement")
def send_case_manual_acknowledgement(
    case_id: uuid.UUID,
    payload: ManualAcknowledgementRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Dispatches a manual formal acknowledgement to client or external stakeholders."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    effective_details = payload.details or payload.custom_message or payload.notes
    result = CaseLifecycleService.send_manual_acknowledgement(
        db=db,
        case=case,
        actor_id=ctx.user_id,
        acknowledgement_type=payload.acknowledgement_type,
        subject=payload.subject,
        details=effective_details,
        notes=effective_details,
    )
    return {"success": True, "result": result}


@router.post("/{case_id}/migrate-firm-config", response_model=CaseDetailResponse)
def migrate_case_firm_config(
    case_id: uuid.UUID,
    payload: CaseMigrateConfigRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Explicitly migrates case pinned configuration to the latest firm configuration version."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    updated = FirmConfigService.migrate_case_to_latest_config(
        db=db,
        case=case,
        actor_id=ctx.user_id,
        reason=payload.reason,
        target_version=payload.target_version,
    )
    return _to_case_detail_response(updated)


# --- Visa Appointment & Financial Sponsor Endpoints (Phase 2) ---

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


@router.get("/{case_id}/appointments", response_model=list[VisaAppointmentResponse])
def list_case_appointments(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists visa interview and VAC biometrics appointments for a case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    appointments = (
        db.query(VisaAppointment)
        .filter(
            VisaAppointment.organization_id == case.organization_id,
            VisaAppointment.case_id == case_id,
        )
        .order_by(VisaAppointment.created_at.desc())
        .all()
    )
    return [
        VisaAppointmentResponse(
            id=a.id,
            organization_id=a.organization_id,
            case_id=a.case_id,
            client_id=a.client_id,
            vac_center=a.vac_center,
            consular_post=a.consular_post,
            ofc_biometrics_slot=a.ofc_biometrics_slot,
            consular_interview_slot=a.consular_interview_slot,
            dropbox_eligible=a.dropbox_eligible,
            tracking_number_blue_dart=a.tracking_number_blue_dart,
            courier_status=a.courier_status,
            status_221g=a.status_221g,
            status_221g_color=a.status_221g_color,
            appointment_status=a.appointment_status,
            notes=a.notes,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in appointments
    ]


@router.post("/{case_id}/appointments", response_model=VisaAppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_case_appointment(
    case_id: uuid.UUID,
    payload: VisaAppointmentCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Schedules or logs a VAC biometrics or Consular interview appointment for a case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    now = datetime.now(timezone.utc)
    apppointment = VisaAppointment(
        organization_id=case.organization_id,
        case_id=case.id,
        client_id=case.client_id,
        vac_center=payload.vac_center.strip(),
        consular_post=payload.consular_post.strip(),
        ofc_biometrics_slot=payload.ofc_biometrics_slot,
        consular_interview_slot=payload.consular_interview_slot,
        dropbox_eligible=payload.dropbox_eligible,
        tracking_number_blue_dart=payload.tracking_number_blue_dart.strip() if payload.tracking_number_blue_dart else None,
        courier_status=payload.courier_status,
        status_221g=payload.status_221g,
        status_221g_color=payload.status_221g_color,
        appointment_status=payload.appointment_status,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(apppointment)
    db.commit()
    db.refresh(apppointment)
    return VisaAppointmentResponse(
        id=apppointment.id,
        organization_id=apppointment.organization_id,
        case_id=apppointment.case_id,
        client_id=apppointment.client_id,
        vac_center=apppointment.vac_center,
        consular_post=apppointment.consular_post,
        ofc_biometrics_slot=apppointment.ofc_biometrics_slot,
        consular_interview_slot=apppointment.consular_interview_slot,
        dropbox_eligible=apppointment.dropbox_eligible,
        tracking_number_blue_dart=apppointment.tracking_number_blue_dart,
        courier_status=apppointment.courier_status,
        status_221g=apppointment.status_221g,
        status_221g_color=apppointment.status_221g_color,
        appointment_status=apppointment.appointment_status,
        notes=apppointment.notes,
        created_at=apppointment.created_at,
        updated_at=apppointment.updated_at,
    )


@router.patch("/{case_id}/appointments/{appointment_id}", response_model=VisaAppointmentResponse)
def update_case_appointment(
    case_id: uuid.UUID,
    appointment_id: uuid.UUID,
    payload: VisaAppointmentUpdateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Updates appointment logistics (VAC, interview date, Blue Dart tracking, 221(g) slip)."""
    appt = db.query(VisaAppointment).filter(
        VisaAppointment.id == appointment_id,
        VisaAppointment.case_id == case_id,
        VisaAppointment.organization_id == ctx.organization_id,
    ).first()
    if not appt:
        raise EntityNotFoundError("VisaAppointment", appointment_id)

    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(appt, field, val)
    appt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(appt)
    return VisaAppointmentResponse(
        id=appt.id,
        organization_id=appt.organization_id,
        case_id=appt.case_id,
        client_id=appt.client_id,
        vac_center=appt.vac_center,
        consular_post=appt.consular_post,
        ofc_biometrics_slot=appt.ofc_biometrics_slot,
        consular_interview_slot=appt.consular_interview_slot,
        dropbox_eligible=appt.dropbox_eligible,
        tracking_number_blue_dart=appt.tracking_number_blue_dart,
        courier_status=appt.courier_status,
        status_221g=appt.status_221g,
        status_221g_color=appt.status_221g_color,
        appointment_status=appt.appointment_status,
        notes=appt.notes,
        created_at=appt.created_at,
        updated_at=appt.updated_at,
    )


@router.get("/{case_id}/sponsors", response_model=list[FinancialSponsorResponse])
def list_case_sponsors(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists financial sponsors / guarantors linked to a case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    sponsors = (
        db.query(FinancialSponsor)
        .filter(
            FinancialSponsor.organization_id == case.organization_id,
            FinancialSponsor.case_id == case_id,
        )
        .order_by(FinancialSponsor.created_at.desc())
        .all()
    )
    return [
        FinancialSponsorResponse(
            id=s.id,
            organization_id=s.organization_id,
            case_id=s.case_id,
            client_id=s.client_id,
            name=s.name,
            relationship=s.relationship,
            sponsor_type=s.sponsor_type,
            pan=s.pan,
            itr_gross_income=s.itr_gross_income,
            liquid_funds=s.liquid_funds,
            currency=s.currency,
            bank_name=s.bank_name,
            loan_sanction_amount=s.loan_sanction_amount,
            affidavit_doc_id=s.affidavit_doc_id,
            notes=s.notes,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in sponsors
    ]


@router.post("/{case_id}/sponsors", response_model=FinancialSponsorResponse, status_code=status.HTTP_201_CREATED)
def create_case_sponsor(
    case_id: uuid.UUID,
    payload: FinancialSponsorCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Registers a financial sponsor (ITR, funds, education loan, affidavit) for a case."""
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)
    ctx.assert_organization_access(case.organization_id)

    now = datetime.now(timezone.utc)
    sponsor = FinancialSponsor(
        organization_id=case.organization_id,
        case_id=case.id,
        client_id=case.client_id,
        name=payload.name.strip(),
        relationship_type=payload.relationship.strip(),
        sponsor_type=payload.sponsor_type,
        pan=payload.pan.upper().strip() if payload.pan else None,
        itr_gross_income=payload.itr_gross_income,
        liquid_funds=payload.liquid_funds,
        currency=payload.currency.upper().strip(),
        bank_name=payload.bank_name.strip() if payload.bank_name else None,
        loan_sanction_amount=payload.loan_sanction_amount,
        affidavit_doc_id=payload.affidavit_doc_id,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(sponsor)
    db.commit()
    db.refresh(sponsor)
    return FinancialSponsorResponse(
        id=sponsor.id,
        organization_id=sponsor.organization_id,
        case_id=sponsor.case_id,
        client_id=sponsor.client_id,
        name=sponsor.name,
        relationship=sponsor.relationship,
        sponsor_type=sponsor.sponsor_type,
        pan=sponsor.pan,
        itr_gross_income=sponsor.itr_gross_income,
        liquid_funds=sponsor.liquid_funds,
        currency=sponsor.currency,
        bank_name=sponsor.bank_name,
        loan_sanction_amount=sponsor.loan_sanction_amount,
        affidavit_doc_id=sponsor.affidavit_doc_id,
        notes=sponsor.notes,
        created_at=sponsor.created_at,
        updated_at=sponsor.updated_at,
    )


@router.delete("/{case_id}/sponsors/{sponsor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case_sponsor(
    case_id: uuid.UUID,
    sponsor_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Removes a financial sponsor linked to a case."""
    sponsor = db.query(FinancialSponsor).filter(
        FinancialSponsor.id == sponsor_id,
        FinancialSponsor.case_id == case_id,
        FinancialSponsor.organization_id == ctx.organization_id,
    ).first()
    if not sponsor:
        raise EntityNotFoundError("FinancialSponsor", sponsor_id)
    db.delete(sponsor)
    db.commit()
    return None


@router.post("/{case_id}/sop/audit", response_model=SOPAuditResponse)
def audit_case_sop(
    case_id: uuid.UUID,
    payload: SOPAuditRequest,
    ctx: AuthContext = Depends(require_permission("case:read")),
    db: Session = Depends(get_db),
):
    """Evaluates an SOP in the context of an existing case with sponsor and jurisdiction awareness."""
    case = db.query(ImmigrationCase).filter(
        ImmigrationCase.id == case_id,
        ImmigrationCase.organization_id == ctx.organization_id,
    ).first()
    if not case:
        raise EntityNotFoundError("Case", case_id)

    profile = dict(payload.applicant_profile or {})
    if payload.has_study_gap:
        profile["has_study_gap"] = True

    # Enrich with linked financial sponsors
    sponsors = db.query(FinancialSponsor).filter(
        FinancialSponsor.case_id == case_id,
        FinancialSponsor.organization_id == ctx.organization_id,
    ).all()
    if sponsors and "has_financial_sponsor" not in profile:
        profile["has_financial_sponsor"] = True
        profile["sponsors_count"] = len(sponsors)

    target_jurisdiction = payload.jurisdiction or case.jurisdiction or "CA"
    result = SOPAuditor.audit_statement(
        sop_text=payload.sop_text,
        applicant_profile=profile,
        jurisdiction=target_jurisdiction,
    )
    return SOPAuditResponse(
        overall_score=result.overall_score,
        is_statutorily_sound=result.is_statutorily_sound,
        verdict=result.verdict,
        jurisdiction=result.jurisdiction,
        dimension_scores=result.dimension_scores,
        strengths=result.strengths,
        findings=[
            SOPFindingResponse(
                dimension=f.dimension,
                severity=f.severity,
                issue_code=f.issue_code,
                title=f.title,
                description=f.description,
                remediation=f.remediation,
                statutory_reference=f.statutory_reference,
            )
            for f in result.findings
        ],
        remediation_summary=result.remediation_summary,
    )


