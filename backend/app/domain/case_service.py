import re
import uuid
from datetime import datetime, timezone
from enum import StrEnum
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.core.errors import ConflictError, PermissionDeniedError, ValidationError
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
from backend.app.security.auth import AuthContext
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import hash_opaque_token


class CaseStage(StrEnum):
    INQUIRY = "inquiry"
    INTAKE = "intake"
    AWAITING_DOCUMENTS = "awaiting_documents"
    PROCESSING = "processing"
    INTERNAL_REVIEW = "internal_review"
    AWAITING_CLIENT = "awaiting_client"
    READY_FOR_APPROVAL = "ready_for_approval"
    APPROVED_FOR_SUBMISSION = "approved_for_submission"
    SUBMITTED = "submitted"
    DECISION_RECEIVED = "decision_received"
    CLOSED = "closed"
    ARCHIVED = "archived"
    REOPENED = "reopened"


# Controlled, configurable lifecycle transitions
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    CaseStage.INQUIRY: {CaseStage.INTAKE, CaseStage.CLOSED},
    CaseStage.INTAKE: {CaseStage.AWAITING_DOCUMENTS, CaseStage.PROCESSING, CaseStage.CLOSED},
    CaseStage.AWAITING_DOCUMENTS: {
        CaseStage.PROCESSING,
        CaseStage.AWAITING_CLIENT,
        CaseStage.INTERNAL_REVIEW,
        CaseStage.CLOSED,
    },
    CaseStage.PROCESSING: {
        CaseStage.INTERNAL_REVIEW,
        CaseStage.AWAITING_DOCUMENTS,
        CaseStage.AWAITING_CLIENT,
        CaseStage.READY_FOR_APPROVAL,
        CaseStage.CLOSED,
    },
    CaseStage.INTERNAL_REVIEW: {
        CaseStage.PROCESSING,
        CaseStage.READY_FOR_APPROVAL,
        CaseStage.AWAITING_DOCUMENTS,
        CaseStage.AWAITING_CLIENT,
        CaseStage.CLOSED,
    },
    CaseStage.AWAITING_CLIENT: {
        CaseStage.PROCESSING,
        CaseStage.INTERNAL_REVIEW,
        CaseStage.AWAITING_DOCUMENTS,
        CaseStage.CLOSED,
    },
    CaseStage.READY_FOR_APPROVAL: {
        CaseStage.APPROVED_FOR_SUBMISSION,
        CaseStage.INTERNAL_REVIEW,
        CaseStage.PROCESSING,
        CaseStage.CLOSED,
    },
    CaseStage.APPROVED_FOR_SUBMISSION: {
        CaseStage.SUBMITTED,
        CaseStage.INTERNAL_REVIEW,
        CaseStage.CLOSED,
    },
    CaseStage.SUBMITTED: {
        CaseStage.DECISION_RECEIVED,
        CaseStage.AWAITING_DOCUMENTS,
        CaseStage.CLOSED,
    },
    CaseStage.DECISION_RECEIVED: {
        CaseStage.CLOSED,
        CaseStage.PROCESSING,
        CaseStage.REOPENED,
    },
    CaseStage.CLOSED: {
        CaseStage.ARCHIVED,
        CaseStage.REOPENED,
    },
    CaseStage.ARCHIVED: {
        CaseStage.REOPENED,
    },
    CaseStage.REOPENED: {
        CaseStage.INTAKE,
        CaseStage.PROCESSING,
        CaseStage.INTERNAL_REVIEW,
        CaseStage.CLOSED,
    },
}

STAFF_ROLES = {
    RoleCode.MASTER_ADMIN.value,
    RoleCode.COMPANY_ADMIN.value,
    RoleCode.SENIOR_REVIEWER.value,
    RoleCode.CASE_MANAGER.value,
    RoleCode.CASE_WORKER.value,
    RoleCode.ORGANIZATION_ADMIN.value,
}

ELEVATED_ROLES = {
    RoleCode.MASTER_ADMIN.value,
    RoleCode.COMPANY_ADMIN.value,
    RoleCode.SENIOR_REVIEWER.value,
    RoleCode.ORGANIZATION_ADMIN.value,
}


def normalize_phone(phone: str | None) -> str:
    if not phone:
        return ""
    return re.sub(r"\D", "", phone)


class DuplicateMatch(BaseModel):
    client_id: uuid.UUID
    client_name: str
    client_email: str
    match_type: str  # email, passport_hash, phone, name_and_dob
    confidence: str  # high, medium, low
    score: float
    details: str


def detect_client_duplicates(
    db: Session,
    organization_id: uuid.UUID,
    email: str | None = None,
    phone: str | None = None,
    passport_number: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    nationality: str | None = None,
    date_of_birth: datetime | None = None,
    exclude_client_id: uuid.UUID | None = None,
) -> list[DuplicateMatch]:
    """Detects potential duplicate client records within the same organization."""
    matches: list[DuplicateMatch] = []
    seen_client_ids: set[uuid.UUID] = set()

    # Query all clients in the organization
    query = db.query(ClientProfile).filter(ClientProfile.organization_id == organization_id)
    if exclude_client_id:
        query = query.filter(ClientProfile.id != exclude_client_id)
    clients = query.all()

    norm_email = email.strip().lower() if email else ""
    norm_phone = normalize_phone(phone)
    passport_hash = hash_opaque_token(passport_number) if passport_number else None
    norm_fn = first_name.strip().lower() if first_name else ""
    norm_ln = last_name.strip().lower() if last_name else ""
    norm_nat = nationality.strip().upper() if nationality else ""

    for c in clients:
        # 1. Exact Email Match
        if norm_email and c.email.lower().strip() == norm_email:
            matches.append(
                DuplicateMatch(
                    client_id=c.id,
                    client_name=f"{c.first_name} {c.last_name}",
                    client_email=c.email,
                    match_type="email",
                    confidence="high",
                    score=1.0,
                    details=f"Exact email match with registered client {c.first_name} {c.last_name}",
                )
            )
            seen_client_ids.add(c.id)
            continue

        # 2. Exact Passport Number Hash Match
        if passport_hash and c.passport_number_hash and c.passport_number_hash == passport_hash:
            matches.append(
                DuplicateMatch(
                    client_id=c.id,
                    client_name=f"{c.first_name} {c.last_name}",
                    client_email=c.email,
                    match_type="passport_hash",
                    confidence="high",
                    score=1.0,
                    details=f"Identical passport number hash with client {c.first_name} {c.last_name}",
                )
            )
            seen_client_ids.add(c.id)
            continue

        # 3. Phone Number Match
        if norm_phone and c.phone:
            c_phone_digits = normalize_phone(c.phone)
            if c_phone_digits and (c_phone_digits == norm_phone or (len(norm_phone) >= 7 and c_phone_digits.endswith(norm_phone[-7:]))):
                matches.append(
                    DuplicateMatch(
                        client_id=c.id,
                        client_name=f"{c.first_name} {c.last_name}",
                        client_email=c.email,
                        match_type="phone",
                        confidence="medium",
                        score=0.85,
                        details=f"Matching contact phone number with client {c.first_name} {c.last_name}",
                    )
                )
                seen_client_ids.add(c.id)
                continue

        # 4. Name and Nationality Match
        if norm_fn and norm_ln and c.first_name.lower().strip() == norm_fn and c.last_name.lower().strip() == norm_ln:
            if norm_nat and c.nationality.upper().strip() == norm_nat:
                matches.append(
                    DuplicateMatch(
                        client_id=c.id,
                        client_name=f"{c.first_name} {c.last_name}",
                        client_email=c.email,
                        match_type="name_and_nationality",
                        confidence="medium",
                        score=0.75,
                        details=f"Identical full name and nationality ({norm_nat}) with client {c.first_name} {c.last_name}",
                    )
                )
                seen_client_ids.add(c.id)
                continue

    # 5. Check if passport or email matches an existing Dependant
    if passport_hash or norm_email:
        dep_query = db.query(ClientDependant).filter(ClientDependant.organization_id == organization_id)
        dependants = dep_query.all()
        for d in dependants:
            if d.primary_client_id in seen_client_ids:
                continue
            if passport_hash and d.passport_number_hash and d.passport_number_hash == passport_hash:
                matches.append(
                    DuplicateMatch(
                        client_id=d.primary_client_id,
                        client_name=f"{d.first_name} {d.last_name} (Dependant)",
                        client_email=d.email or "(No email)",
                        match_type="dependant_passport_hash",
                        confidence="high",
                        score=0.95,
                        details=f"Passport number matches dependant {d.first_name} {d.last_name} ({d.relationship_type})",
                    )
                )
                seen_client_ids.add(d.primary_client_id)
            elif norm_email and d.email and d.email.lower().strip() == norm_email:
                matches.append(
                    DuplicateMatch(
                        client_id=d.primary_client_id,
                        client_name=f"{d.first_name} {d.last_name} (Dependant)",
                        client_email=d.email,
                        match_type="dependant_email",
                        confidence="medium",
                        score=0.80,
                        details=f"Email matches registered dependant {d.first_name} {d.last_name}",
                    )
                )
                seen_client_ids.add(d.primary_client_id)

    return matches


def validate_case_status_transition(
    current_status: str,
    target_status: str,
    ctx: AuthContext,
    is_pathway_override: bool = False,
) -> None:
    """Validates whether a case status transition is allowed under the state machine and user permissions."""
    if ctx.is_retained_client():
        raise PermissionDeniedError("Retained clients and applicants cannot change case workflow stages")

    # Normalize
    curr = current_status.lower().strip()
    tgt = target_status.lower().strip()

    if curr == tgt:
        return

    # Check state machine transitions
    allowed = ALLOWED_TRANSITIONS.get(curr, set())
    if not is_pathway_override and tgt not in allowed:
        raise ValidationError(
            f"Invalid case workflow transition from '{curr}' to '{tgt}'. Allowed next stages: {sorted(list(allowed))}"
        )

    # Permission check for closing
    if tgt == CaseStage.CLOSED:
        if not any(r in STAFF_ROLES for r in ctx.roles):
            raise PermissionDeniedError("Only staff case managers or administrators can close a case")

    # Permission check for archiving
    if tgt == CaseStage.ARCHIVED:
        if not any(r in ELEVATED_ROLES for r in ctx.roles):
            raise PermissionDeniedError("Only senior reviewers or company administrators can archive a case")

    # Permission check for reopening
    if tgt == CaseStage.REOPENED:
        if not any(r in STAFF_ROLES for r in ctx.roles):
            raise PermissionDeniedError("Only staff case managers or administrators can reopen a closed or archived case")


def sync_legacy_to_decoupled_lifecycle(case: ImmigrationCase, target_legacy_status: str) -> None:
    """Synchronizes decoupled lifecycle fields when legacy status transition occurs."""
    tgt = target_legacy_status.lower().strip()
    if tgt in ("inquiry", "intake"):
        case.preparation_status = "AUTHORIZED_FOR_PREPARATION" if tgt == "intake" else "CLEARANCE_PENDING"
        case.operational_state = "ACTIVE"
    elif tgt in ("awaiting_documents", "processing", "awaiting_client"):
        case.preparation_status = "PREPARATION_IN_PROGRESS"
        case.operational_state = "ACTIVE"
    elif tgt in ("internal_review", "ready_for_approval"):
        case.preparation_status = "READY_FOR_FINAL_REVIEW"
        case.review_status = "SENIOR_REVIEW"
        case.operational_state = "ACTIVE"
    elif tgt == "approved_for_submission":
        case.preparation_status = "READY_TO_SUBMIT"
        case.review_status = "APPROVED"
        case.operational_state = "ACTIVE"
    elif tgt == "submitted":
        case.preparation_status = "SUBMITTED"
        case.outcome_status = "PENDING_ADJUDICATION"
        case.operational_state = "ACTIVE"
    elif tgt == "decision_received":
        case.preparation_status = "SUBMITTED"
        case.outcome_status = "APPROVED"
        case.operational_state = "COMPLETED"
    elif tgt == "closed":
        case.operational_state = "COMPLETED"
    elif tgt == "archived":
        case.operational_state = "ARCHIVED"
    elif tgt == "reopened":
        case.operational_state = "ACTIVE"
        case.preparation_status = "PREPARATION_IN_PROGRESS"

