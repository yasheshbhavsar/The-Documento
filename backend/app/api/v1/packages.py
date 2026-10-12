import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.errors import EntityNotFoundError, PermissionDeniedError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    FilingPackage,
    PackageTemplate,
    ImmigrationCase,
    User,
    AuditEvent,
)
from backend.app.packages.readiness import ReadinessService
from backend.app.packages.builder import PackageBuilderService
from backend.app.security.auth import AuthContext, get_auth_context

router = APIRouter(prefix="/packages", tags=["packages"])


# --- Schemas ---

class BuildPackageRequest(BaseModel):
    name: str = Field(default="USCIS Immigrant Petition Submission Package", min_length=2, max_length=255)
    template_id: Optional[uuid.UUID] = None


class AdvanceApprovalRequest(BaseModel):
    stage: str = Field(..., description="Approval stage name")
    decision: str = Field(..., pattern="^(approved|rejected|passed)$")
    notes: Optional[str] = None


# --- Endpoints ---

@router.get("/cases/{case_id}/readiness")
def evaluate_case_readiness(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Evaluates the deterministic 10-point readiness checklist for an immigration case.
    Strictly reports internal statutory checks and evidence sufficiency.
    Does NOT calculate or output any probability of government approval.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    try:
        report = ReadinessService.evaluate_case_readiness(db, case_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return report


@router.get("/templates")
def list_package_templates(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Lists available folder templates (e.g. USCIS standard, IRCC Canadian economic)."""
    PackageBuilderService.ensure_default_templates(db, auth.organization_id)

    stmt = select(PackageTemplate).where(PackageTemplate.organization_id == auth.organization_id)
    templates = db.execute(stmt).scalars().all()
    return {
        "templates": [
            {
                "id": str(t.id),
                "name": t.name,
                "jurisdiction": t.jurisdiction,
                "pathway": t.pathway,
                "description": t.description,
                "folder_structure": t.folder_structure,
            }
            for t in templates
        ]
    }


@router.post("/cases/{case_id}/build", status_code=status.HTTP_201_CREATED)
def build_filing_package(
    case_id: uuid.UUID,
    payload: BuildPackageRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Assembles an evidence package:
    - Runs readiness checklist.
    - Maps documents into designated folders.
    - Strictly separates internal review documents from submission-ready files.
    - Pins document versions and calculates SHA-256 root manifest hash.
    - Initializes 7-stage approval workflow.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    try:
        package = PackageBuilderService.build_filing_package(
            db=db,
            organization_id=auth.organization_id,
            case_id=case_id,
            name=payload.name,
            template_id=payload.template_id,
            user_id=auth.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="filing_package.assembled",
        object_type="filing_package",
        object_id=str(package.id),
        metadata_json={
            "case_id": str(case_id),
            "version": package.version_number,
            "items_count": package.manifest_json.get("items_count", 0),
            "summary": f"Assembled package {package.name} (hash: {package.package_hash[:8]}...) for case {case.case_number}",
        },
    )
    db.add(audit)
    db.commit()

    return {
        "id": str(package.id),
        "case_id": str(package.case_id),
        "name": package.name,
        "version_number": package.version_number,
        "status": package.status,
        "package_hash": package.package_hash,
        "manifest": package.manifest_json,
        "approval_chain": package.approval_chain_json,
    }


@router.get("/{package_id}")
def get_filing_package_details(
    package_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """Retrieves full filing package manifest, folder tree, and approval chain."""
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    return {
        "id": str(package.id),
        "case_id": str(package.case_id),
        "name": package.name,
        "version_number": package.version_number,
        "status": package.status,
        "package_hash": package.package_hash,
        "manifest": package.manifest_json,
        "readiness_summary": package.readiness_checklist_json,
        "approval_chain": package.approval_chain_json,
        "approved_by": package.approved_by.full_name if package.approved_by else None,
        "approved_at": package.approved_at.isoformat() if package.approved_at else None,
        "submission_method": package.submission_method,
        "submission_instructions": package.submission_instructions,
        "created_at": package.created_at.isoformat(),
        "updated_at": package.updated_at.isoformat(),
    }


@router.post("/{package_id}/approval")
def advance_package_approval(
    package_id: uuid.UUID,
    payload: AdvanceApprovalRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Advances a stage in the 7-step approval workflow.
    Validates sequencing and authorized actor roles.
    """
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    user = db.execute(select(User).where(User.id == auth.user_id)).scalar_one()

    # Authorization rules for stages
    if payload.stage in ["senior_review", "final_package_approval"]:
        if not (auth.is_master_admin() or auth.is_company_admin() or auth.is_senior_reviewer() or auth.has_role("senior_attorney")):
            raise HTTPException(
                status_code=403,
                detail=f"Senior reviewer or admin role required to approve '{payload.stage}'.",
            )

    try:
        updated = PackageBuilderService.advance_package_approval(
            db=db,
            package=package,
            stage_name=payload.stage,
            decision=payload.decision,
            user=user,
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="filing_package.approval_advanced",
        object_type="filing_package",
        object_id=str(package.id),
        metadata_json={
            "stage": payload.stage,
            "decision": payload.decision,
            "package_status": updated.status,
            "summary": f"Approval stage '{payload.stage}' set to '{payload.decision}' by {user.full_name}",
        },
    )
    db.add(audit)
    db.commit()

    return {
        "id": str(updated.id),
        "status": updated.status,
        "approved_by": updated.approved_by.full_name if updated.approved_by else None,
        "approved_at": updated.approved_at.isoformat() if updated.approved_at else None,
        "approval_chain": updated.approval_chain_json,
    }


@router.get("/{package_id}/export")
def export_filing_package(
    package_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Produces reproducible package export summary with manual filing instructions.
    Explicitly refuses automated government portal submission.
    """
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    return PackageBuilderService.export_package_summary(db, package)
