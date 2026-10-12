import uuid
from datetime import datetime, timezone
from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import cast, desc, asc, or_, String
from sqlalchemy.orm import Session, joinedload

from backend.app.core.errors import ConflictError, EntityNotFoundError, PermissionDeniedError, TenantIsolationError
from backend.app.db.session import get_db
from backend.app.domain.case_service import CaseStage, validate_case_status_transition
from backend.app.domain.models import (
    AuditEvent,
    CaseAssignment,
    CaseMilestone,
    CaseNote,
    CaseTask,
    ClientConsent,
    ClientDependant,
    ClientProfile,
    ImmigrationCase,
    User,
)
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
    priority_date: datetime | None
    created_at: datetime
    updated_at: datetime
    assignments: list[AssignmentResponse] = []
    milestones: list[MilestoneResponse] = []
    tasks_count: int = 0
    completed_tasks_count: int = 0


class PaginatedCasesResponse(BaseModel):
    items: list[CaseDetailResponse]
    total: int
    limit: int
    offset: int


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
        priority_date=case.priority_date,
        created_at=case.created_at,
        updated_at=case.updated_at,
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
    query = (
        db.query(ImmigrationCase)
        .options(
            joinedload(ImmigrationCase.client).joinedload(ClientProfile.dependants),
            joinedload(ImmigrationCase.assignments).joinedload(CaseAssignment.user),
            joinedload(ImmigrationCase.milestones),
            joinedload(ImmigrationCase.tasks),
        )
        .filter(ImmigrationCase.organization_id == ctx.organization_id)
    )

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

    elif ctx.has_role(RoleCode.DOCUMENT_REVIEWER) and not ctx.is_company_admin():
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
    client = (
        db.query(ClientProfile)
        .filter(
            ClientProfile.id == payload.client_id,
            ClientProfile.organization_id == ctx.organization_id,
        )
        .first()
    )
    if not client:
        raise EntityNotFoundError("ClientProfile", payload.client_id)

    # Check case number uniqueness in tenant
    existing = (
        db.query(ImmigrationCase)
        .filter(
            ImmigrationCase.organization_id == ctx.organization_id,
            ImmigrationCase.case_number == payload.case_number.strip(),
        )
        .first()
    )
    if existing:
        raise ConflictError(f"Case number '{payload.case_number}' already exists in this organization")

    now = datetime.now(timezone.utc)
    case = ImmigrationCase(
        organization_id=ctx.organization_id,
        client_id=client.id,
        case_number=payload.case_number.strip(),
        title=payload.title.strip(),
        jurisdiction=payload.jurisdiction.upper().strip(),
        visa_category=payload.visa_category.strip(),
        status=payload.status.strip(),
        priority_date=payload.priority_date,
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
