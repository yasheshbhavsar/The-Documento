import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.app.core.errors import ConflictError, EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.case_service import DuplicateMatch, detect_client_duplicates
from backend.app.domain.models import AuditEvent, ClientConsent, ClientDependant, ClientProfile, User
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import hash_opaque_token

router = APIRouter(prefix="/clients", tags=["clients"])


class DependantCreateRequest(BaseModel):
    relationship_type: str = Field(..., min_length=2, max_length=64, description="spouse, child, parent, sibling, dependent, sponsor, other")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: datetime | None = None
    nationality: str = Field(..., min_length=2, max_length=3)
    passport_number: str | None = Field(default=None, description="Plain passport number is hashed immediately")
    is_authorized_to_view_case: bool = Field(default=False, description="Whether this dependant has authorized portal visibility")
    user_id: uuid.UUID | None = None


class DependantResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    primary_client_id: uuid.UUID
    user_id: uuid.UUID | None
    relationship_type: str
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    date_of_birth: datetime | None
    nationality: str
    is_authorized_to_view_case: bool
    created_at: datetime


class ConsentCreateRequest(BaseModel):
    consent_type: str = Field(..., min_length=2, max_length=64, description="representation_g28, data_processing_gdpr, communication_consent, fee_agreement")
    granted: bool = True
    case_id: uuid.UUID | None = None
    ip_address: str | None = None
    document_hash: str | None = None
    notes: str | None = None


class ConsentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID
    case_id: uuid.UUID | None
    consent_type: str
    granted: bool
    granted_at: datetime
    revoked_at: datetime | None
    ip_address: str | None
    document_hash: str | None
    notes: str | None
    created_at: datetime


class ClientProfileCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = None
    date_of_birth: datetime | None = None
    nationality: str = Field(..., min_length=2, max_length=3)
    passport_number: str | None = Field(default=None, description="Plain passport number will be hashed, never stored raw")
    user_id: uuid.UUID | None = None
    aadhaar_number_masked: str | None = Field(default=None, max_length=16)
    pan_number: str | None = Field(default=None, max_length=16)
    voter_id: str | None = Field(default=None, max_length=32)
    passport_ecr_status: str = Field(default="NON_ECR", max_length=16)
    dependants: list[DependantCreateRequest] = []
    consents: list[ConsentCreateRequest] = []


class ClientProfileResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    first_name: str
    last_name: str
    email: str
    phone: str | None
    date_of_birth: datetime | None
    nationality: str
    aadhaar_number_masked: str | None = None
    pan_number: str | None = None
    voter_id: str | None = None
    passport_ecr_status: str = "NON_ECR"
    created_at: datetime
    dependants_count: int = 0
    cases_count: int = 0


class DuplicateCheckRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    nationality: str | None = None
    passport_number: str | None = None
    date_of_birth: datetime | None = None
    exclude_client_id: uuid.UUID | None = None


class DuplicateCheckResponse(BaseModel):
    has_duplicates: bool
    matches: list[DuplicateMatch]


@router.post("/check-duplicates", response_model=DuplicateCheckResponse)
def check_client_duplicates(
    payload: DuplicateCheckRequest,
    ctx: AuthContext = Depends(require_permission("case:read")),
    db: Session = Depends(get_db),
):
    """Checks for existing potential duplicates in the organization based on email, passport, phone, or name."""
    if ctx.is_retained_client():
        raise PermissionDeniedError("Retained clients cannot perform organization duplicate checks")

    matches = detect_client_duplicates(
        db=db,
        organization_id=ctx.organization_id,
        email=payload.email,
        phone=payload.phone,
        passport_number=payload.passport_number,
        first_name=payload.first_name,
        last_name=payload.last_name,
        nationality=payload.nationality,
        date_of_birth=payload.date_of_birth,
        exclude_client_id=payload.exclude_client_id,
    )
    return DuplicateCheckResponse(
        has_duplicates=len(matches) > 0,
        matches=matches,
    )


@router.get("", response_model=list[ClientProfileResponse])
def list_clients(
    ctx: AuthContext = Depends(require_permission("case:read")),
    db: Session = Depends(get_db),
):
    """Lists retained clients strictly within the caller's organization."""
    if ctx.is_retained_client():
        raise PermissionDeniedError("Retained clients cannot browse firm client directories")

    clients = (
        db.query(ClientProfile)
        .filter(ClientProfile.organization_id == ctx.organization_id)
        .order_by(ClientProfile.created_at.desc())
        .all()
    )
    return [
        ClientProfileResponse(
            id=c.id,
            organization_id=c.organization_id,
            user_id=c.user_id,
            first_name=c.first_name,
            last_name=c.last_name,
            email=c.email,
            phone=c.phone,
            date_of_birth=c.date_of_birth,
            nationality=c.nationality,
            aadhaar_number_masked=c.aadhaar_number_masked,
            pan_number=c.pan_number,
            voter_id=c.voter_id,
            passport_ecr_status=c.passport_ecr_status or "NON_ECR",
            created_at=c.created_at,
            dependants_count=len(c.dependants),
            cases_count=len(c.cases),
        )
        for c in clients
    ]


@router.post("", response_model=ClientProfileResponse, status_code=status.HTTP_201_CREATED)
def create_client_profile(
    payload: ClientProfileCreate,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Creates a new retained client record, optionally including dependants and initial consents."""
    email_clean = payload.email.lower().strip()
    passport_hash = hash_opaque_token(payload.passport_number) if payload.passport_number else None
    now = datetime.now(timezone.utc)

    client = ClientProfile(
        organization_id=ctx.organization_id,
        user_id=payload.user_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email_clean,
        phone=payload.phone.strip() if payload.phone else None,
        date_of_birth=payload.date_of_birth,
        nationality=payload.nationality.upper().strip(),
        passport_number_hash=passport_hash,
        aadhaar_number_masked=payload.aadhaar_number_masked.strip() if payload.aadhaar_number_masked else None,
        pan_number=payload.pan_number.upper().strip() if payload.pan_number else None,
        voter_id=payload.voter_id.strip() if payload.voter_id else None,
        passport_ecr_status=payload.passport_ecr_status.upper().strip() if payload.passport_ecr_status else "NON_ECR",
        created_at=now,
    )
    db.add(client)
    db.flush()

    # Create optional dependants
    for dep in payload.dependants:
        dep_pass_hash = hash_opaque_token(dep.passport_number) if dep.passport_number else None
        d = ClientDependant(
            organization_id=ctx.organization_id,
            primary_client_id=client.id,
            user_id=dep.user_id,
            relationship_type=dep.relationship_type.strip(),
            first_name=dep.first_name.strip(),
            last_name=dep.last_name.strip(),
            email=dep.email.lower().strip() if dep.email else None,
            phone=dep.phone.strip() if dep.phone else None,
            date_of_birth=dep.date_of_birth,
            nationality=dep.nationality.upper().strip(),
            passport_number_hash=dep_pass_hash,
            is_authorized_to_view_case=dep.is_authorized_to_view_case,
            created_at=now,
            updated_at=now,
        )
        db.add(d)

    # Create optional consents
    for c in payload.consents:
        consent = ClientConsent(
            organization_id=ctx.organization_id,
            client_id=client.id,
            case_id=c.case_id,
            consent_type=c.consent_type.strip(),
            granted=c.granted,
            granted_at=now,
            ip_address=c.ip_address,
            document_hash=c.document_hash,
            notes=c.notes,
            created_at=now,
        )
        db.add(consent)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="client.created",
        object_type="client_profile",
        object_id=str(client.id),
        metadata_json={
            "nationality": client.nationality,
            "dependants_added": len(payload.dependants),
            "consents_recorded": len(payload.consents),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(client)

    return ClientProfileResponse(
        id=client.id,
        organization_id=client.organization_id,
        user_id=client.user_id,
        first_name=client.first_name,
        last_name=client.last_name,
        email=client.email,
        phone=client.phone,
        date_of_birth=client.date_of_birth,
        nationality=client.nationality,
        created_at=client.created_at,
        dependants_count=len(client.dependants),
        cases_count=len(client.cases),
    )


@router.get("/{client_id}", response_model=ClientProfileResponse)
def get_client_profile(
    client_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves client profile with object-level authorization."""
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise EntityNotFoundError("ClientProfile", client_id)

    ctx.assert_organization_access(client.organization_id)

    # Retained client can view if they are the primary client or an authorized dependant
    if ctx.is_retained_client():
        is_primary = client.user_id == ctx.user_id
        is_auth_dep = any(
            d.user_id == ctx.user_id and d.is_authorized_to_view_case
            for d in client.dependants
        )
        if not (is_primary or is_auth_dep):
            raise PermissionDeniedError("Retained clients can only access authorized client profiles")

    return ClientProfileResponse(
        id=client.id,
        organization_id=client.organization_id,
        user_id=client.user_id,
        first_name=client.first_name,
        last_name=client.last_name,
        email=client.email,
        phone=client.phone,
        date_of_birth=client.date_of_birth,
        nationality=client.nationality,
        created_at=client.created_at,
        dependants_count=len(client.dependants),
        cases_count=len(client.cases),
    )


@router.post("/{client_id}/dependants", response_model=DependantResponse, status_code=status.HTTP_201_CREATED)
def add_client_dependant(
    client_id: uuid.UUID,
    payload: DependantCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Adds an applicant dependant or family member under the client record."""
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise EntityNotFoundError("ClientProfile", client_id)

    ctx.assert_organization_access(client.organization_id)

    now = datetime.now(timezone.utc)
    passport_hash = hash_opaque_token(payload.passport_number) if payload.passport_number else None

    dep = ClientDependant(
        organization_id=ctx.organization_id,
        primary_client_id=client.id,
        user_id=payload.user_id,
        relationship_type=payload.relationship_type.strip(),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=payload.email.lower().strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        date_of_birth=payload.date_of_birth,
        nationality=payload.nationality.upper().strip(),
        passport_number_hash=passport_hash,
        is_authorized_to_view_case=payload.is_authorized_to_view_case,
        created_at=now,
        updated_at=now,
    )
    db.add(dep)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="client.dependant_added",
        object_type="client_dependant",
        object_id=str(dep.id),
        metadata_json={
            "client_id": str(client.id),
            "relationship_type": dep.relationship_type,
            "is_authorized_to_view_case": dep.is_authorized_to_view_case,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(dep)

    return DependantResponse(
        id=dep.id,
        organization_id=dep.organization_id,
        primary_client_id=dep.primary_client_id,
        user_id=dep.user_id,
        relationship_type=dep.relationship_type,
        first_name=dep.first_name,
        last_name=dep.last_name,
        email=dep.email,
        phone=dep.phone,
        date_of_birth=dep.date_of_birth,
        nationality=dep.nationality,
        is_authorized_to_view_case=dep.is_authorized_to_view_case,
        created_at=dep.created_at,
    )


@router.get("/{client_id}/dependants", response_model=list[DependantResponse])
def list_client_dependants(
    client_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists dependants under a client profile."""
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise EntityNotFoundError("ClientProfile", client_id)

    ctx.assert_organization_access(client.organization_id)

    if ctx.is_retained_client():
        is_primary = client.user_id == ctx.user_id
        is_auth_dep = any(
            d.user_id == ctx.user_id and d.is_authorized_to_view_case
            for d in client.dependants
        )
        if not (is_primary or is_auth_dep):
            raise PermissionDeniedError("Retained clients can only access their authorized dependants")

    deps = (
        db.query(ClientDependant)
        .filter(ClientDependant.primary_client_id == client.id)
        .order_by(ClientDependant.created_at.asc())
        .all()
    )
    return [
        DependantResponse(
            id=d.id,
            organization_id=d.organization_id,
            primary_client_id=d.primary_client_id,
            user_id=d.user_id,
            relationship_type=d.relationship_type,
            first_name=d.first_name,
            last_name=d.last_name,
            email=d.email,
            phone=d.phone,
            date_of_birth=d.date_of_birth,
            nationality=d.nationality,
            is_authorized_to_view_case=d.is_authorized_to_view_case,
            created_at=d.created_at,
        )
        for d in deps
    ]


@router.post("/{client_id}/consents", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
def record_client_consent(
    client_id: uuid.UUID,
    payload: ConsentCreateRequest,
    ctx: AuthContext = Depends(require_permission("case:write")),
    db: Session = Depends(get_db),
):
    """Records legal representation (e.g. G-28), GDPR, or privacy consent."""
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise EntityNotFoundError("ClientProfile", client_id)

    ctx.assert_organization_access(client.organization_id)

    now = datetime.now(timezone.utc)
    consent = ClientConsent(
        organization_id=ctx.organization_id,
        client_id=client.id,
        case_id=payload.case_id,
        consent_type=payload.consent_type.strip(),
        granted=payload.granted,
        granted_at=now,
        ip_address=payload.ip_address,
        document_hash=payload.document_hash,
        notes=payload.notes,
        created_at=now,
    )
    db.add(consent)

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="client.consent_recorded",
        object_type="client_consent",
        object_id=str(consent.id),
        metadata_json={
            "client_id": str(client.id),
            "consent_type": consent.consent_type,
            "granted": consent.granted,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(consent)

    return ConsentResponse(
        id=consent.id,
        organization_id=consent.organization_id,
        client_id=consent.client_id,
        case_id=consent.case_id,
        consent_type=consent.consent_type,
        granted=consent.granted,
        granted_at=consent.granted_at,
        revoked_at=consent.revoked_at,
        ip_address=consent.ip_address,
        document_hash=consent.document_hash,
        notes=consent.notes,
        created_at=consent.created_at,
    )


@router.get("/{client_id}/consents", response_model=list[ConsentResponse])
def list_client_consents(
    client_id: uuid.UUID,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Lists legal and privacy consents recorded for the client."""
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise EntityNotFoundError("ClientProfile", client_id)

    ctx.assert_organization_access(client.organization_id)

    if ctx.is_retained_client() and client.user_id != ctx.user_id:
        raise PermissionDeniedError("Retained clients can only access their own consents")

    consents = (
        db.query(ClientConsent)
        .filter(ClientConsent.client_id == client.id)
        .order_by(ClientConsent.created_at.desc())
        .all()
    )
    return [
        ConsentResponse(
            id=c.id,
            organization_id=c.organization_id,
            client_id=c.client_id,
            case_id=c.case_id,
            consent_type=c.consent_type,
            granted=c.granted,
            granted_at=c.granted_at,
            revoked_at=c.revoked_at,
            ip_address=c.ip_address,
            document_hash=c.document_hash,
            notes=c.notes,
            created_at=c.created_at,
        )
        for c in consents
    ]


@router.delete("/{client_id}", status_code=status.HTTP_200_OK)
def delete_client_profile(
    client_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("client:delete")),
    db: Session = Depends(get_db),
):
    """Deletes a retained client profile if permitted (Owner / Manager only; never paralegal or client)."""
    if ctx.is_retained_client():
        raise PermissionDeniedError("Retained clients cannot delete client records")

    # Strictly reject paralegals / caseworkers
    if ctx.has_role(RoleCode.CASE_WORKER) or ctx.has_role(RoleCode.DOCUMENT_REVIEWER) or ctx.has_role("paralegal") or ctx.has_role("case_worker"):
        raise PermissionDeniedError("Paralegals do not have permission to delete client records")

    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise EntityNotFoundError("ClientProfile", client_id)

    ctx.assert_organization_access(client.organization_id)

    # Check for active or linked cases - client_id has ondelete RESTRICT and is NOT NULL
    if len(client.cases) > 0:
        raise ConflictError(
            f"Cannot delete client with {len(client.cases)} associated case(s). Please delete or transfer cases before removing client profile."
        )

    now = datetime.now(timezone.utc)
    client_name = f"{client.first_name} {client.last_name}"
    client_email = client.email
    portal_user_id = client.user_id

    audit = AuditEvent(
        organization_id=ctx.organization_id,
        actor_id=ctx.user_id,
        action="client.deleted",
        object_type="client_profile",
        object_id=str(client.id),
        metadata_json={
            "client_name": client_name,
            "client_email": client_email,
            "deleted_by_roles": list(ctx.roles),
        },
        occurred_at=now,
    )
    db.add(audit)
    db.delete(client)

    # Clean up associated portal user credentials if provisioned
    if portal_user_id:
        portal_user = db.query(User).filter(User.id == portal_user_id).first()
        if portal_user:
            db.delete(portal_user)

    db.commit()

    return {"status": "success", "message": f"Client {client_name} deleted successfully", "id": str(client_id)}
