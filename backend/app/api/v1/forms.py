import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.errors import EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    FormSchema,
    FormSchemaVersion,
    FormSubmission,
    ImmigrationCase,
    User,
    AuditEvent,
)
from backend.app.forms.service import FormService
from backend.app.security.auth import AuthContext, get_auth_context

router = APIRouter(prefix="/forms", tags=["forms"])


# --- Schemas ---

class FormAnswersUpdate(BaseModel):
    answers: Dict[str, Any]
    notes: Optional[str] = None


class FieldConfirmRequest(BaseModel):
    field_key: str


class SensitiveReviewRequest(BaseModel):
    notes: str = Field(..., min_length=2, description="Legal review notes certifying sensitive field review")


# --- Endpoints ---

@router.get("/schemas")
def list_form_schemas(
    jurisdiction: Optional[str] = None,
    pathway: Optional[str] = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Lists available versioned form schemas."""
    # Ensure standard seeded schemas exist
    FormService.ensure_default_schemas(db, auth.organization_id)

    stmt = select(FormSchema).where(FormSchema.organization_id == auth.organization_id)
    if jurisdiction:
        stmt = stmt.where(FormSchema.jurisdiction == jurisdiction.upper())
    if pathway:
        stmt = stmt.where(FormSchema.pathway == pathway)

    schemas = db.execute(stmt).scalars().all()
    results = []
    for s in schemas:
        versions = [
            {
                "id": str(v.id),
                "version_number": v.version_number,
                "is_active": v.is_active,
                "published_at": v.published_at.isoformat() if v.published_at else None,
            }
            for v in s.versions
        ]
        results.append({
            "id": str(s.id),
            "form_code": s.form_code,
            "name": s.name,
            "jurisdiction": s.jurisdiction,
            "pathway": s.pathway,
            "edition_date": s.edition_date,
            "status": s.status,
            "versions": versions,
        })
    return {"schemas": results}


@router.get("/schemas/{schema_id}")
def get_form_schema_details(
    schema_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Retrieves detailed form schema with sections and field definitions."""
    schema = db.execute(
        select(FormSchema).where(
            FormSchema.id == schema_id,
            FormSchema.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not schema:
        raise EntityNotFoundError("FormSchema", str(schema_id))

    latest_version = db.execute(
        select(FormSchemaVersion)
        .where(FormSchemaVersion.schema_id == schema_id, FormSchemaVersion.is_active == True)
        .order_by(FormSchemaVersion.created_at.desc())
    ).scalars().first()

    return {
        "id": str(schema.id),
        "form_code": schema.form_code,
        "name": schema.name,
        "jurisdiction": schema.jurisdiction,
        "pathway": schema.pathway,
        "edition_date": schema.edition_date,
        "status": schema.status,
        "active_version": {
            "id": str(latest_version.id) if latest_version else None,
            "version_number": latest_version.version_number if latest_version else None,
            "schema_definition": latest_version.schema_json if latest_version else {},
        } if latest_version else None,
    }


@router.post("/cases/{case_id}/submissions", status_code=status.HTTP_201_CREATED)
def create_form_submission(
    case_id: uuid.UUID,
    schema_version_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Creates a new draft form submission.
    Populates draft answers only from available, authorized information.
    Every populated value retains its source provenance or is marked as user-provided.
    AI-generated answers remain unconfirmed drafts until confirmed by an authorized person.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    # If schema_version_id not provided, find or seed default USCIS I-140 schema
    if not schema_version_id:
        default_schema = FormService.ensure_default_schemas(db, auth.organization_id)
        active_ver = db.execute(
            select(FormSchemaVersion).where(
                FormSchemaVersion.schema_id == default_schema.id,
                FormSchemaVersion.is_active == True,
            )
        ).scalars().first()
        if not active_ver:
            raise HTTPException(status_code=400, detail="No active version found for form schema")
        schema_version_id = active_ver.id

    try:
        submission = FormService.populate_form_draft(
            db=db,
            organization_id=auth.organization_id,
            case_id=case_id,
            schema_version_id=schema_version_id,
            user_id=auth.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Log audit event
    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="form_submission.created",
        object_type="form_submission",
        object_id=str(submission.id),
        metadata_json={
            "case_id": str(case_id),
            "completion": submission.completion_percentage,
            "has_unconfirmed": submission.has_unconfirmed_ai_fields,
            "summary": f"Created form draft {submission.schema_version.schema.form_code} for case {case.case_number}",
        },
    )
    db.add(audit)
    db.commit()

    return {
        "id": str(submission.id),
        "case_id": str(submission.case_id),
        "form_code": submission.schema_version.schema.form_code,
        "form_name": submission.schema_version.schema.name,
        "version_number": submission.schema_version.version_number,
        "status": submission.status,
        "completion_percentage": submission.completion_percentage,
        "has_unconfirmed_ai_fields": submission.has_unconfirmed_ai_fields,
        "sensitive_fields_reviewed": submission.sensitive_fields_reviewed,
        "revision_number": submission.revision_number,
        "answers": submission.answers_json,
    }


@router.get("/submissions/{submission_id}")
def get_form_submission(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Retrieves form submission with answers, field source provenance, and revision history."""
    submission = db.execute(
        select(FormSubmission).where(
            FormSubmission.id == submission_id,
            FormSubmission.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not submission:
        raise EntityNotFoundError("FormSubmission", str(submission_id))

    return {
        "id": str(submission.id),
        "case_id": str(submission.case_id),
        "form_code": submission.schema_version.schema.form_code,
        "form_name": submission.schema_version.schema.name,
        "version_number": submission.schema_version.version_number,
        "status": submission.status,
        "completion_percentage": submission.completion_percentage,
        "has_unconfirmed_ai_fields": submission.has_unconfirmed_ai_fields,
        "sensitive_fields_reviewed": submission.sensitive_fields_reviewed,
        "reviewer_notes": submission.reviewer_notes,
        "reviewed_at": submission.reviewed_at.isoformat() if submission.reviewed_at else None,
        "revision_number": submission.revision_number,
        "revision_history": submission.revision_history,
        "answers": submission.answers_json,
        "schema_definition": submission.schema_version.schema_json,
    }


@router.put("/submissions/{submission_id}")
def update_form_submission_answers(
    submission_id: uuid.UUID,
    payload: FormAnswersUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Updates submission answers and records revision history."""
    submission = db.execute(
        select(FormSubmission).where(
            FormSubmission.id == submission_id,
            FormSubmission.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not submission:
        raise EntityNotFoundError("FormSubmission", str(submission_id))

    user = db.execute(select(User).where(User.id == auth.user_id)).scalar_one()

    try:
        updated = FormService.update_submission_answers(
            db=db,
            submission=submission,
            answer_updates=payload.answers,
            user=user,
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": str(updated.id),
        "status": updated.status,
        "completion_percentage": updated.completion_percentage,
        "has_unconfirmed_ai_fields": updated.has_unconfirmed_ai_fields,
        "revision_number": updated.revision_number,
        "revision_history": updated.revision_history,
        "answers": updated.answers_json,
    }


@router.post("/submissions/{submission_id}/confirm-field")
def confirm_form_field(
    submission_id: uuid.UUID,
    payload: FieldConfirmRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Confirms an individual AI-generated or OCR-extracted draft answer."""
    submission = db.execute(
        select(FormSubmission).where(
            FormSubmission.id == submission_id,
            FormSubmission.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not submission:
        raise EntityNotFoundError("FormSubmission", str(submission_id))

    user = db.execute(select(User).where(User.id == auth.user_id)).scalar_one()

    try:
        updated = FormService.confirm_field_answer(
            db=db,
            submission=submission,
            field_key=payload.field_key,
            user=user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": str(updated.id),
        "field_key": payload.field_key,
        "has_unconfirmed_ai_fields": updated.has_unconfirmed_ai_fields,
        "field_record": updated.answers_json.get(payload.field_key),
    }


@router.post("/submissions/{submission_id}/review-sensitive")
def review_sensitive_fields(
    submission_id: uuid.UUID,
    payload: SensitiveReviewRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Designated signoff on high-risk sensitive fields by authorized staff."""
    if auth.is_retained_client() or auth.has_role("client"):
        raise HTTPException(status_code=403, detail="Clients cannot sign off on sensitive field review.")

    submission = db.execute(
        select(FormSubmission).where(
            FormSubmission.id == submission_id,
            FormSubmission.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not submission:
        raise EntityNotFoundError("FormSubmission", str(submission_id))

    user = db.execute(select(User).where(User.id == auth.user_id)).scalar_one()

    updated = FormService.review_sensitive_fields(
        db=db,
        submission=submission,
        user=user,
        notes=payload.notes,
    )

    return {
        "id": str(updated.id),
        "sensitive_fields_reviewed": updated.sensitive_fields_reviewed,
        "reviewed_by": user.full_name,
        "reviewed_at": updated.reviewed_at.isoformat() if updated.reviewed_at else None,
        "reviewer_notes": updated.reviewer_notes,
    }
