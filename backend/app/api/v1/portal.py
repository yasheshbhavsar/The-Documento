import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.app.core.errors import AuthenticationError, EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    AuditEvent,
    ClientConsent,
    ClientDependant,
    ClientProfile,
    ClientQuestionnaire,
    Document,
    DocumentRequest,
    ImmigrationCase,
    Invitation,
    MembershipRole,
    OrganizationMembership,
    Role,
    User,
)
from backend.app.notifications.service import NotificationService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import generate_secure_random_token, hash_opaque_token

router = APIRouter(prefix="/portal", tags=["portal"])


# --- Schemas ---

class ClientInviteRequest(BaseModel):
    case_id: uuid.UUID
    email: EmailStr
    full_name: str = Field(..., min_length=2)
    relationship_type: str = Field(default="primary_applicant", description="'primary_applicant' or 'spouse', 'dependant'")
    is_authorized_to_view_case: bool = True


class ClientInviteResponse(BaseModel):
    invitation_id: uuid.UUID
    email: str
    invitation_token: str
    expires_at: datetime
    message: str


class ClientActivationRequest(BaseModel):
    invitation_token: str
    password: str = Field(..., min_length=8)
    agreed_to_privacy: bool = Field(default=True)


class ClientProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    date_of_birth: datetime | None = None
    nationality: str | None = None
    passport_number: str | None = None


class DependantInput(BaseModel):
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    relationship_type: str = Field(..., description="spouse, child, parent, sibling, dependant")
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: datetime | None = None
    nationality: str = Field(default="USA", min_length=2, max_length=3)
    passport_number: str | None = None
    is_authorized_to_view_case: bool = Field(default=False)


class ConsentGrantRequest(BaseModel):
    consent_type: str = Field(..., description="representation_g28, data_processing_gdpr, privacy_policy, communication_consent")
    granted: bool = True
    case_id: uuid.UUID | None = None
    notes: str | None = None


class QuestionnaireSaveRequest(BaseModel):
    responses: dict = Field(default_factory=dict)
    submit_for_review: bool = False


class WaitingStateItem(BaseModel):
    id: str
    type: str  # document_request, questionnaire, consent, firm_review, drafting
    title: str
    description: str
    due_date: datetime | None = None
    priority: str = "medium"
    action_url: str | None = None


class WaitingStateResponse(BaseModel):
    waiting_on_client_count: int
    waiting_on_firm_count: int
    primary_next_action: WaitingStateItem | None
    waiting_on_client: list[WaitingStateItem]
    waiting_on_firm: list[WaitingStateItem]
    profile_completeness_percentage: float
    onboarding_completed: bool


# --- Phase 8 Per-Applicant Checklist Schemas ---

class ApplicantChecklistItem(BaseModel):
    id: str
    title: str
    category: str
    status: str  # "required", "received", "accepted", "rejected", "outstanding"
    is_mandatory: bool = True
    document_id: str | None = None
    filename: str | None = None
    lifecycle_state: str | None = None
    structured_reason_code: str | None = None
    client_explanation: str | None = None
    submitted_at: datetime | None = None


class ApplicantChecklistSection(BaseModel):
    applicant_id: str
    applicant_name: str
    relationship: str
    required_count: int
    received_count: int
    accepted_count: int
    rejected_count: int
    outstanding_count: int
    required_items: list[ApplicantChecklistItem]
    received_items: list[ApplicantChecklistItem]
    accepted_items: list[ApplicantChecklistItem]
    rejected_items: list[ApplicantChecklistItem]
    outstanding_items: list[ApplicantChecklistItem]


class PerApplicantChecklistResponse(BaseModel):
    case_id: uuid.UUID
    case_number: str
    overall_progress_percent: float
    total_required: int
    total_received: int
    total_accepted: int
    total_rejected: int
    total_outstanding: int
    applicants: list[ApplicantChecklistSection]


# --- Default Questionnaire Template ---

DEFAULT_EB1A_SECTIONS = [
    {
        "id": "biographical",
        "title": "1. Biographical & Professional Identification",
        "description": "Full legal name, current academic or corporate title, and contact details matching passport.",
        "fields": [
            {"id": "current_employer", "label": "Current Employer or Institutional Affiliation", "type": "text", "required": True},
            {"id": "job_title", "label": "Current Professional Title", "type": "text", "required": True},
            {"id": "field_of_expertise", "label": "Specific Field of Extraordinary Ability", "type": "text", "required": True},
        ]
    },
    {
        "id": "prizes_awards",
        "title": "2. Nationally or Internationally Recognized Prizes/Awards",
        "description": "Detail all significant awards received for excellence in your field (8 CFR § 204.5(h)(3)(i)).",
        "fields": [
            {"id": "has_awards", "label": "Have you received major national or international awards?", "type": "boolean", "required": True},
            {"id": "awards_details", "label": "List award names, granting bodies, selection criteria, and dates", "type": "textarea", "required": False},
        ]
    },
    {
        "id": "scholarly_publications",
        "title": "3. Scholarly Articles & Citations",
        "description": "Published articles in major journals or international conference proceedings (8 CFR § 204.5(h)(3)(vi)).",
        "fields": [
            {"id": "total_articles_count", "label": "Approximate total number of peer-reviewed articles published", "type": "number", "required": True},
            {"id": "google_scholar_link", "label": "Google Scholar or Scopus Profile URL", "type": "url", "required": False},
            {"id": "total_citations", "label": "Total lifetime citations count", "type": "number", "required": False},
        ]
    },
    {
        "id": "peer_review",
        "title": "4. Participation as a Judge of the Work of Others",
        "description": "Peer reviewing for academic journals, grant evaluation, or conference program committees (8 CFR § 204.5(h)(3)(iv)).",
        "fields": [
            {"id": "has_judged_others", "label": "Have you acted as a peer reviewer or grant judge?", "type": "boolean", "required": True},
            {"id": "journals_reviewed_for", "label": "List major journals, conferences, or panels where you served as judge", "type": "textarea", "required": False},
            {"id": "verified_reviews_count", "label": "Approximate number of completed peer reviews", "type": "number", "required": False},
        ]
    },
]


# --- Helpers ---

def _get_client_for_user(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> ClientProfile | None:
    return (
        db.query(ClientProfile)
        .filter(ClientProfile.organization_id == org_id, ClientProfile.user_id == user_id)
        .first()
    )


# --- Endpoints ---

@router.post("/invite", response_model=ClientInviteResponse, status_code=status.HTTP_201_CREATED)
def invite_client(
    payload: ClientInviteRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Staff issues a secure portal onboarding invitation for a client or authorized family dependant.
    """
    if ctx.is_retained_client():
        raise PermissionDeniedError("Clients cannot issue portal invitations")

    ctx.assert_organization_access(ctx.organization_id)
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == payload.case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", payload.case_id)

    raw_token = generate_secure_random_token(32)
    token_hash = hash_opaque_token(raw_token)
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    expires_at = now + timedelta(days=7)

    email_clean = payload.email.lower().strip()

    invitation = Invitation(
        organization_id=ctx.organization_id,
        inviter_user_id=ctx.user_id,
        email=email_clean,
        role_code=RoleCode.RETAINED_CLIENT.value,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(invitation)

    # If primary applicant, ensure ClientProfile exists or link
    client = db.query(ClientProfile).filter(
        ClientProfile.organization_id == ctx.organization_id,
        ClientProfile.email == email_clean,
    ).first()

    if not client:
        names = payload.full_name.split(" ", 1)
        first_name = names[0]
        last_name = names[1] if len(names) > 1 else "Applicant"
        client = ClientProfile(
            organization_id=ctx.organization_id,
            first_name=first_name,
            last_name=last_name,
            email=email_clean,
            nationality="USA",
            created_at=now,
        )
        db.add(client)
        db.flush()

    db.commit()
    db.refresh(invitation)

    return ClientInviteResponse(
        invitation_id=invitation.id,
        email=invitation.email,
        invitation_token=raw_token,
        expires_at=invitation.expires_at,
        message="Client invitation generated successfully. Send token or onboarding activation link.",
    )


@router.post("/activate")
def activate_client_account(
    payload: ClientActivationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Client activates their account using the invitation token, sets their password,
    accepts required privacy notice, and is linked to their ClientProfile.
    """
    token_hash = hash_opaque_token(payload.invitation_token)
    now = datetime.now(timezone.utc)

    invitation = (
        db.query(Invitation)
        .filter(
            Invitation.token_hash == token_hash,
            Invitation.accepted_at.is_(None),
            Invitation.expires_at > now,
        )
        .first()
    )
    if not invitation:
        raise AuthenticationError("Invalid or expired invitation token")

    # Find or create user
    email_clean = invitation.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    client_profile = db.query(ClientProfile).filter(
        ClientProfile.organization_id == invitation.organization_id,
        ClientProfile.email == email_clean,
    ).first()

    full_name = f"{client_profile.first_name} {client_profile.last_name}" if client_profile else "Client User"

    if not user:
        user = User(
            email=email_clean,
            full_name=full_name,
            password_hash=hash_password(payload.password),
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    else:
        user.password_hash = hash_password(payload.password)
        user.status = "active"
        user.updated_at = now

    # Link user to client profile
    if client_profile:
        client_profile.user_id = user.id

    # Create membership if missing
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.organization_id == invitation.organization_id,
            OrganizationMembership.user_id == user.id,
        )
        .first()
    )
    if not membership:
        membership = OrganizationMembership(
            organization_id=invitation.organization_id,
            user_id=user.id,
            status="active",
            created_at=now,
        )
        db.add(membership)
        db.flush()

    # Assign retained_client role
    role = db.query(Role).filter(Role.code == RoleCode.RETAINED_CLIENT.value).first()
    if not role:
        role = Role(code=RoleCode.RETAINED_CLIENT.value, name="Retained Client")
        db.add(role)
        db.flush()

    existing_mr = (
        db.query(MembershipRole)
        .filter(MembershipRole.membership_id == membership.id, MembershipRole.role_id == role.id)
        .first()
    )
    if not existing_mr:
        db.add(MembershipRole(membership_id=membership.id, role_id=role.id, assigned_at=now))

    # Record initial privacy consent
    if payload.agreed_to_privacy and client_profile:
        client_ip = request.client.host if request.client else "unknown"
        consent = ClientConsent(
            organization_id=invitation.organization_id,
            client_id=client_profile.id,
            consent_type="privacy_policy",
            granted=True,
            granted_at=now,
            ip_address=client_ip,
            notes="Consented during account activation",
            created_at=now,
        )
        db.add(consent)

    invitation.accepted_at = now
    db.commit()

    return {
        "status": "ok",
        "message": "Account activated successfully. You can now log into your client transparency portal.",
        "user_id": str(user.id),
        "email": user.email,
    }


@router.get("/profile")
def get_client_profile(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Returns the client profile, associated dependants, cases, and consents.
    """
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        # Fallback if staff is testing or user is not linked
        user = db.query(User).filter(User.id == ctx.user_id).first()
        return {
            "first_name": user.full_name if user else "Client",
            "last_name": "",
            "email": ctx.email,
            "nationality": "USA",
            "dependants": [],
            "cases": [],
            "completeness_score": 50,
        }

    dependants_data = [
        {
            "id": str(d.id),
            "relationship_type": d.relationship_type,
            "first_name": d.first_name,
            "last_name": d.last_name,
            "email": d.email,
            "phone": d.phone,
            "date_of_birth": d.date_of_birth.isoformat() if d.date_of_birth else None,
            "nationality": d.nationality,
            "is_authorized_to_view_case": d.is_authorized_to_view_case,
        }
        for d in client.dependants
    ]

    cases_data = [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "title": c.title,
            "jurisdiction": c.jurisdiction,
            "visa_category": c.visa_category,
            "status": c.status,
        }
        for c in client.cases
    ]

    # Calculate profile completeness score
    score = 40
    if client.phone:
        score += 15
    if client.date_of_birth:
        score += 15
    if client.passport_number_hash:
        score += 15
    if client.dependants:
        score += 15
    score = min(score, 100)

    return {
        "id": str(client.id),
        "first_name": client.first_name,
        "last_name": client.last_name,
        "email": client.email,
        "phone": client.phone,
        "date_of_birth": client.date_of_birth.isoformat() if client.date_of_birth else None,
        "nationality": client.nationality,
        "passport_verified": client.passport_number_hash is not None,
        "dependants": dependants_data,
        "cases": cases_data,
        "completeness_score": score,
    }


@router.put("/profile")
def update_client_profile(
    payload: ClientProfileUpdateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Updates applicant profile biodata."""
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        raise EntityNotFoundError("ClientProfile", ctx.user_id)

    if payload.first_name is not None:
        client.first_name = payload.first_name
    if payload.last_name is not None:
        client.last_name = payload.last_name
    if payload.phone is not None:
        client.phone = payload.phone
    if payload.date_of_birth is not None:
        client.date_of_birth = payload.date_of_birth
    if payload.nationality is not None:
        client.nationality = payload.nationality
    if payload.passport_number is not None:
        client.passport_number_hash = hash_opaque_token(payload.passport_number)

    db.commit()
    db.refresh(client)
    return {"status": "ok", "message": "Profile updated successfully"}


@router.post("/dependants")
def add_dependant(
    payload: DependantInput,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Adds a family dependant for the authenticated principal applicant."""
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        raise EntityNotFoundError("ClientProfile", ctx.user_id)

    now = datetime.now(timezone.utc)
    pass_hash = hash_opaque_token(payload.passport_number) if payload.passport_number else None

    dep = ClientDependant(
        organization_id=ctx.organization_id,
        primary_client_id=client.id,
        relationship_type=payload.relationship_type,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        date_of_birth=payload.date_of_birth,
        nationality=payload.nationality,
        passport_number_hash=pass_hash,
        is_authorized_to_view_case=payload.is_authorized_to_view_case,
        created_at=now,
        updated_at=now,
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)

    return {
        "id": str(dep.id),
        "first_name": dep.first_name,
        "last_name": dep.last_name,
        "relationship_type": dep.relationship_type,
        "is_authorized_to_view_case": dep.is_authorized_to_view_case,
    }


@router.delete("/dependants/{dep_id}")
def delete_dependant(
    dep_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Deletes a dependant with ownership check."""
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        raise EntityNotFoundError("ClientProfile", ctx.user_id)

    dep = db.query(ClientDependant).filter(ClientDependant.id == dep_id).first()
    if not dep or dep.primary_client_id != client.id:
        raise EntityNotFoundError("ClientDependant", dep_id)

    db.delete(dep)
    db.commit()
    return {"status": "ok", "message": "Dependant removed"}


@router.get("/consents")
def list_consents(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists legal and privacy consents granted by the client."""
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        return []

    consents = db.query(ClientConsent).filter(ClientConsent.client_id == client.id).all()
    return [
        {
            "id": str(c.id),
            "consent_type": c.consent_type,
            "granted": c.granted,
            "granted_at": c.granted_at.isoformat(),
            "notes": c.notes,
        }
        for c in consents
    ]


@router.post("/consents")
def grant_consent(
    payload: ConsentGrantRequest,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Records client consent grant or revocation."""
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        raise EntityNotFoundError("ClientProfile", ctx.user_id)

    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)

    consent = ClientConsent(
        organization_id=ctx.organization_id,
        client_id=client.id,
        case_id=payload.case_id,
        consent_type=payload.consent_type,
        granted=payload.granted,
        granted_at=now,
        ip_address=client_ip,
        notes=payload.notes,
        created_at=now,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return {"status": "ok", "consent_id": str(consent.id)}


# --- Questionnaires ---

@router.get("/questionnaires")
def get_questionnaires(
    case_id: uuid.UUID | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Returns questionnaires for the authenticated client."""
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
    if not client:
        return []

    query = db.query(ClientQuestionnaire).filter(ClientQuestionnaire.client_id == client.id)
    if case_id:
        query = query.filter(ClientQuestionnaire.case_id == case_id)

    questionnaires = query.all()
    if not questionnaires:
        # Seed default EB-1A intake questionnaire
        now = datetime.now(timezone.utc)
        q = ClientQuestionnaire(
            organization_id=ctx.organization_id,
            client_id=client.id,
            case_id=case_id,
            title="EB-1A Extraordinary Ability Statutory Intake Questionnaire",
            status="in_progress",
            sections_json=DEFAULT_EB1A_SECTIONS,
            responses_json={},
            completion_percentage=0.0,
            created_at=now,
            updated_at=now,
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        questionnaires = [q]

    return [
        {
            "id": str(q.id),
            "title": q.title,
            "status": q.status,
            "completion_percentage": q.completion_percentage,
            "sections": q.sections_json,
            "responses": q.responses_json,
            "submitted_at": q.submitted_at.isoformat() if q.submitted_at else None,
            "reviewed_at": q.reviewed_at.isoformat() if q.reviewed_at else None,
            "reviewer_notes": q.reviewer_notes,
        }
        for q in questionnaires
    ]


@router.put("/questionnaires/{questionnaire_id}")
def save_questionnaire_responses(
    questionnaire_id: uuid.UUID,
    payload: QuestionnaireSaveRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Saves draft questionnaire responses or submits for legal review."""
    q = db.query(ClientQuestionnaire).filter(ClientQuestionnaire.id == questionnaire_id).first()
    if not q:
        raise EntityNotFoundError("ClientQuestionnaire", questionnaire_id)

    ctx.assert_organization_access(q.organization_id)
    if ctx.is_retained_client():
        client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)
        if not client or q.client_id != client.id:
            raise PermissionDeniedError("Cannot modify another client's questionnaire")

    now = datetime.now(timezone.utc)
    q.responses_json = payload.responses
    q.updated_at = now

    # Calculate completion percentage
    total_fields = sum(len(sec.get("fields", [])) for sec in q.sections_json)
    answered_fields = sum(1 for val in payload.responses.values() if val not in (None, "", False))
    q.completion_percentage = round((answered_fields / max(total_fields, 1)) * 100, 1)

    if payload.submit_for_review:
        q.status = "submitted"
        q.submitted_at = now

    db.commit()
    db.refresh(q)
    return {
        "status": "ok",
        "questionnaire_status": q.status,
        "completion_percentage": q.completion_percentage,
    }


# --- Waiting State & Next Action Engine ---

@router.get("/waiting-state", response_model=WaitingStateResponse)
def get_waiting_state(
    case_id: uuid.UUID | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Computes a clear, transparent breakdown of what is waiting on the client vs what is waiting on the firm.
    Clearly shows the immediate next action.
    """
    client = _get_client_for_user(db, ctx.organization_id, ctx.user_id)

    waiting_on_client: list[WaitingStateItem] = []
    waiting_on_firm: list[WaitingStateItem] = []

    client_id = client.id if client else None

    # 1. Open document requests
    req_query = db.query(DocumentRequest).filter(
        DocumentRequest.organization_id == ctx.organization_id,
        DocumentRequest.status.in_(["requested", "rejected"]),
    )
    if client_id:
        req_query = req_query.filter(DocumentRequest.requested_from_client_id == client_id)
    if case_id:
        req_query = req_query.filter(DocumentRequest.case_id == case_id)

    open_requests = req_query.all()
    for req in open_requests:
        is_rejected = req.status == "rejected"
        waiting_on_client.append(
            WaitingStateItem(
                id=str(req.id),
                type="document_request",
                title=f"{'Action Needed: Re-upload' if is_rejected else 'Upload Required'}: {req.title}",
                description=req.rejection_reason if is_rejected else req.description,
                due_date=req.due_date,
                priority="high" if is_rejected else "medium",
                action_url=f"/portal/requests/{req.id}",
            )
        )

    # 2. Submitted requests waiting on firm review
    submitted_query = db.query(DocumentRequest).filter(
        DocumentRequest.organization_id == ctx.organization_id,
        DocumentRequest.status == "submitted",
    )
    if client_id:
        submitted_query = submitted_query.filter(DocumentRequest.requested_from_client_id == client_id)
    for req in submitted_query.all():
        waiting_on_firm.append(
            WaitingStateItem(
                id=str(req.id),
                type="firm_review",
                title=f"Legal Review of Submitted Evidence: {req.title}",
                description="Your evidence was received and is currently being audited by your case manager.",
                due_date=None,
                priority="medium",
            )
        )

    # 3. Questionnaire completion
    q_query = db.query(ClientQuestionnaire).filter(ClientQuestionnaire.organization_id == ctx.organization_id)
    if client_id:
        q_query = q_query.filter(ClientQuestionnaire.client_id == client_id)
    for q in q_query.all():
        if q.status == "in_progress":
            waiting_on_client.append(
                WaitingStateItem(
                    id=str(q.id),
                    type="questionnaire",
                    title=f"Complete Intake Questionnaire ({q.completion_percentage}% done)",
                    description="Answer career accomplishments and statutory criteria questions.",
                    priority="high",
                    action_url="/portal/questionnaire",
                )
            )
        elif q.status == "submitted":
            waiting_on_firm.append(
                WaitingStateItem(
                    id=str(q.id),
                    type="firm_review",
                    title="Attorney Analysis of Evidentiary Questionnaire",
                    description="Our legal team is reviewing your questionnaire responses to map statutory evidence.",
                    priority="medium",
                )
            )

    # 4. Attorney brief and petition indexing
    waiting_on_firm.append(
        WaitingStateItem(
            id="drafting-brief",
            type="drafting",
            title="Formal Legal Brief & Kazarian Two-Part Argument Drafting",
            description="Our Senior Immigration Attorney is synthesizing your exhibits into the formal USCIS petition brief.",
            priority="low",
        )
    )

    # Resolve primary next action
    primary_next = waiting_on_client[0] if waiting_on_client else (waiting_on_firm[0] if waiting_on_firm else None)

    completeness = 85.0
    if client:
        completeness = 50.0
        if client.passport_number_hash:
            completeness += 20.0
        if not open_requests:
            completeness += 20.0
        if client.dependants:
            completeness += 10.0

    return WaitingStateResponse(
        waiting_on_client_count=len(waiting_on_client),
        waiting_on_firm_count=len(waiting_on_firm),
        primary_next_action=primary_next,
        waiting_on_client=waiting_on_client,
        waiting_on_firm=waiting_on_firm,
        profile_completeness_percentage=min(completeness, 100.0),
        onboarding_completed=len(waiting_on_client) == 0,
    )


# --- Phase 8 Per-Applicant Checklist Endpoint ---

@router.get("/cases/{case_id}/applicant-checklist", response_model=PerApplicantChecklistResponse)
def get_per_applicant_checklist(
    case_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """
    Per-applicant checklist: required, received, accepted, rejected/correction-required, outstanding.
    Categorizes statutory and firm-requested requirements per applicant (primary, spouse, child).
    """
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == case_id).first()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", case_id)

    client_user_id = case.client.user_id if case.client else None
    authorized_deps = [d.user_id for d in case.client.dependants if d.is_authorized_to_view_case and d.user_id] if case.client else []
    assigned_user_ids = [a.user_id for a in case.assignments]
    ctx.assert_case_access(
        case,
        client_user_id=client_user_id,
        authorized_dependant_user_ids=authorized_deps,
        assigned_user_ids=assigned_user_ids,
    )

    # 1. Fetch case documents & requests
    docs = db.query(Document).filter(
        Document.organization_id == ctx.organization_id,
        Document.case_id == case_id,
        Document.is_current_version.is_(True),
    ).all()

    requests = db.query(DocumentRequest).filter(
        DocumentRequest.organization_id == ctx.organization_id,
        DocumentRequest.case_id == case_id,
        DocumentRequest.status != "draft",
    ).all()

    # 2. Build applicant list
    applicant_configs = []
    if case.client:
        applicant_configs.append({
            "applicant_id": str(case.client.id),
            "applicant_name": f"{case.client.first_name} {case.client.last_name}",
            "relationship": "primary_applicant",
            "is_primary": True,
        })
        for dep in (case.client.dependants or []):
            applicant_configs.append({
                "applicant_id": str(dep.id),
                "applicant_name": f"{dep.first_name} {dep.last_name}",
                "relationship": dep.relationship_type or "dependant",
                "is_primary": False,
            })
    else:
        applicant_configs.append({
            "applicant_id": "primary",
            "applicant_name": "Primary Applicant",
            "relationship": "primary_applicant",
            "is_primary": True,
        })

    # Standard default baseline items per relationship
    primary_defaults = [
        {"id": "req-pass", "title": "Passport Identification (Biographical Page)", "category": "identity_passport"},
        {"id": "req-cv", "title": "Comprehensive Curriculum Vitae & Bibliography", "category": "employment_records"},
        {"id": "req-degree", "title": "Terminal Degree Diploma & Transcripts", "category": "educational_records"},
        {"id": "req-evidence", "title": "Statutory Extraordinary Ability Evidence Portfolio", "category": "supporting_evidence"},
    ]
    dep_defaults = [
        {"id": "req-dep-pass", "title": "Passport Identification Page", "category": "identity_passport"},
        {"id": "req-dep-vital", "title": "Civil Status Record (Marriage / Birth Certificate)", "category": "civil_status"},
    ]

    applicants_result: list[ApplicantChecklistSection] = []
    tot_req = 0
    tot_rec = 0
    tot_acc = 0
    tot_rej = 0
    tot_out = 0

    for cfg in applicant_configs:
        is_primary = cfg["is_primary"]
        app_id = cfg["applicant_id"]
        app_name = cfg["applicant_name"]
        rel = cfg["relationship"]

        # Match documents for this applicant
        app_docs = [
            d for d in docs
            if (
                str(d.client_id) == app_id
                or str(getattr(d, "applicant_dependant_id", None)) == app_id
                or (getattr(d, "proposed_applicant_name", None) and app_name.lower() in getattr(d, "proposed_applicant_name", "").lower())
                or (is_primary and not d.client_id and not getattr(d, "applicant_dependant_id", None))
            )
        ]

        # Match requests for this applicant
        app_reqs = [
            r for r in requests
            if (str(r.requested_from_client_id) == app_id or (is_primary and not r.requested_from_client_id))
        ]

        required_items: list[ApplicantChecklistItem] = []
        received_items: list[ApplicantChecklistItem] = []
        accepted_items: list[ApplicantChecklistItem] = []
        rejected_items: list[ApplicantChecklistItem] = []
        outstanding_items: list[ApplicantChecklistItem] = []

        # Map document requests
        for req in app_reqs:
            item = ApplicantChecklistItem(
                id=str(req.id),
                title=req.title,
                category=req.category or "supporting_evidence",
                status="required",
                is_mandatory=getattr(req, "is_mandatory", True),
            )
            required_items.append(item)
            if req.status == "rejected":
                rej_item = ApplicantChecklistItem(
                    id=str(req.id),
                    title=req.title,
                    category=req.category or "supporting_evidence",
                    status="rejected",
                    is_mandatory=getattr(req, "is_mandatory", True),
                    client_explanation=req.rejection_reason,
                )
                rejected_items.append(rej_item)
                outstanding_items.append(rej_item)
            elif req.status in ("requested", "pending"):
                outstanding_items.append(item)

        # Baseline fallback if requests not explicitly entered
        if not app_reqs:
            base_items = primary_defaults if is_primary else dep_defaults
            for b in base_items:
                it = ApplicantChecklistItem(
                    id=f"{b['id']}-{app_id}",
                    title=b["title"],
                    category=b["category"],
                    status="required",
                    is_mandatory=True,
                )
                required_items.append(it)

        # Categorize uploaded documents
        for doc in app_docs:
            v_status = (doc.verification_status or "").lower()
            code = None
            explanation = doc.verification_notes
            if doc.verification_notes and doc.verification_notes.startswith("[") and "]" in doc.verification_notes:
                idx = doc.verification_notes.index("]")
                code = doc.verification_notes[1:idx].strip()
                explanation = doc.verification_notes[idx + 1:].strip()

            lifecycle = "uploaded"
            if v_status in ("verified", "accepted"):
                lifecycle = "accepted"
            elif v_status in ("rejected", "correction_required"):
                lifecycle = "rejected"
            elif v_status == "under_review":
                lifecycle = "under_review"

            doc_item = ApplicantChecklistItem(
                id=str(doc.id),
                title=doc.title or doc.filename,
                category=doc.category or "supporting_evidence",
                status=lifecycle,
                is_mandatory=True,
                document_id=str(doc.id),
                filename=doc.filename,
                lifecycle_state=lifecycle,
                structured_reason_code=code,
                client_explanation=explanation,
                submitted_at=doc.created_at,
            )

            if lifecycle == "accepted":
                accepted_items.append(doc_item)
                received_items.append(doc_item)
            elif lifecycle == "rejected":
                rejected_items.append(doc_item)
                outstanding_items.append(doc_item)
            else:
                received_items.append(doc_item)

        # Unfulfilled required items -> outstanding
        received_categories = {d.category for d in received_items}
        for req_item in required_items:
            if req_item.category not in received_categories and req_item.id not in [o.id for o in outstanding_items]:
                out_item = ApplicantChecklistItem(
                    id=req_item.id,
                    title=req_item.title,
                    category=req_item.category,
                    status="outstanding",
                    is_mandatory=req_item.is_mandatory,
                )
                outstanding_items.append(out_item)

        sec = ApplicantChecklistSection(
            applicant_id=app_id,
            applicant_name=app_name,
            relationship=rel,
            required_count=len(required_items),
            received_count=len(received_items),
            accepted_count=len(accepted_items),
            rejected_count=len(rejected_items),
            outstanding_count=len(outstanding_items),
            required_items=required_items,
            received_items=received_items,
            accepted_items=accepted_items,
            rejected_items=rejected_items,
            outstanding_items=outstanding_items,
        )
        applicants_result.append(sec)

        tot_req += len(required_items)
        tot_rec += len(received_items)
        tot_acc += len(accepted_items)
        tot_rej += len(rejected_items)
        tot_out += len(outstanding_items)

    overall_progress = round((tot_acc / max(tot_req, 1)) * 100, 1)

    return PerApplicantChecklistResponse(
        case_id=case.id,
        case_number=case.case_number,
        overall_progress_percent=min(overall_progress, 100.0),
        total_required=tot_req,
        total_received=tot_rec,
        total_accepted=tot_acc,
        total_rejected=tot_rej,
        total_outstanding=tot_out,
        applicants=applicants_result,
    )
