import io
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select

from backend.app.core.errors import EntityNotFoundError, PermissionDeniedError, ValidationError, TenantIsolationError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    FilingPackage,
    PackageTemplate,
    PackageDownloadEvent,
    ImmigrationCase,
    Document,
    CaseAIFinding,
    User,
    AuditEvent,
    now_utc,
)
from backend.app.packages.readiness import ReadinessService
from backend.app.packages.builder import PackageBuilderService
from backend.app.packages.eligibility import (
    preview_package_eligibility,
    evaluate_document_for_package,
    UNRESOLVED_FINDING_STATUSES,
    PackageEligibilityPolicy,
)
from backend.app.packages.local_archive import (
    sanitize_filename,
    normalize_relative_path,
    build_canonical_phase7_manifest,
    generate_manifest_text_report,
    generate_word_compatible_html_report,
    generate_pdf_manifest_report,
    build_package_local_zip_archive,
)
from backend.app.security.rbac import RoleCode
from backend.app.security.auth import AuthContext, get_auth_context

router = APIRouter(prefix="/packages", tags=["packages"])


# --- Schemas ---

class BuildPackageRequest(BaseModel):
    name: str = Field(default="USCIS Immigrant Petition Submission Package", min_length=2, max_length=255)
    template_id: Optional[uuid.UUID] = None
    explicit_document_ids: Optional[List[uuid.UUID]] = None
    manual_inclusions: Optional[List[uuid.UUID]] = None
    manual_exclusions: Optional[List[uuid.UUID]] = None
    override_notes: Optional[str] = None


class AdvanceApprovalRequest(BaseModel):
    stage: str = Field(..., description="Approval stage name")
    decision: str = Field(..., pattern="^(approved|rejected|passed)$")
    notes: Optional[str] = None


class ExcludeDocumentRequest(BaseModel):
    reason_code: str = Field(default="OFFICER_DISCRETIONARY_EXCLUSION", max_length=64)
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


@router.get("/cases/{case_id}/blockers/explanation")
def get_package_blockers_explanation(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Synthesizes and explains all deterministic package blockers and approval gate holds
    using exact status and reason codes.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    from backend.app.packages.blocker_explainer import explain_package_blockers
    try:
        report = explain_package_blockers(db, case_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "case_id": report.case_id,
        "case_number": report.case_number,
        "organization_id": str(case.organization_id),
        "is_blocked": report.is_blocked,
        "total_blockers": report.total_blockers,
        "total_blockers_count": report.total_blockers,
        "critical_blockers_count": report.total_blockers,
        "total_warnings": report.total_warnings,
        "warning_blockers_count": report.total_warnings,
        "blockers": [
            {
                "code": b.code,
                "blocker_code": b.code,
                "category": b.category,
                "severity": b.severity,
                "status_code": b.status_code,
                "title": b.title,
                "explanation": b.explanation,
                "remediation_action": b.remediation_action,
                "evidence_references": b.evidence_references,
            }
            for b in report.blockers
        ],
        "warnings": [
            {
                "code": w.code,
                "blocker_code": w.code,
                "category": w.category,
                "severity": w.severity,
                "status_code": w.status_code,
                "title": w.title,
                "explanation": w.explanation,
                "remediation_action": w.remediation_action,
                "evidence_references": w.evidence_references,
            }
            for w in report.warnings
        ],
        "generated_at": report.generated_at,
        "evaluated_at": report.generated_at,
        "guardrail_notice": report.legal_sufficiency_disclaimer,
        "summary_markdown": report.summary_markdown,
        "legal_sufficiency_disclaimer": report.legal_sufficiency_disclaimer,
    }


@router.get("/cases/{case_id}/eligibility-preview")
def preview_case_package_eligibility(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Previews document eligibility across 6 distinct dimensions (readability, classification,
    applicant assignment, consistency, evidentiary sufficiency, human verification).
    Provides a clear preview of every included and excluded document with exact reasons for exclusion.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    return preview_package_eligibility(
        db=db,
        case_id=case_id,
        organization_id=auth.organization_id,
    )


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
    - Evaluates candidate documents across 6 dimensions.
    - Rejects unsafe selections (unresolved anomalies, unverified documents, etc.).
    - Maps documents into designated folders.
    - Strictly separates internal review documents from submission-ready files.
    - Pins document versions and calculates SHA-256 root manifest hash.
    - Initializes 7-stage approval workflow.
    - Never changes case.status to submitted.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    # Verify authorization for manual include/exclude overrides
    has_overrides = bool(
        payload.manual_inclusions or payload.manual_exclusions or payload.explicit_document_ids or payload.override_notes
    )
    if has_overrides:
        if auth.is_retained_client() or not (auth.is_case_manager() or auth.is_org_admin() or auth.is_senior_reviewer() or auth.has_role(RoleCode.CASE_MANAGER) or auth.has_role(RoleCode.SENIOR_REVIEWER) or auth.has_role("attorney")):
            raise PermissionDeniedError("Client role is not authorized to specify manual document inclusions or overrides.")

    try:
        package = PackageBuilderService.build_filing_package(
            db=db,
            organization_id=auth.organization_id,
            case_id=case_id,
            name=payload.name,
            template_id=payload.template_id,
            user_id=auth.user_id,
            explicit_document_ids=payload.explicit_document_ids,
            manual_inclusions=payload.manual_inclusions,
            manual_exclusions=payload.manual_exclusions,
            override_notes=payload.override_notes,
        )
    except (ValidationError, TenantIsolationError, EntityNotFoundError):
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Audit manual overrides if supplied
    if has_overrides:
        override_audit = AuditEvent(
            organization_id=auth.organization_id,
            actor_id=auth.user_id,
            action="filing_package.manual_override",
            object_type="filing_package",
            object_id=str(package.id),
            metadata_json={
                "case_id": str(case_id),
                "manual_inclusions": [str(d) for d in (payload.manual_inclusions or [])],
                "manual_exclusions": [str(d) for d in (payload.manual_exclusions or [])],
                "explicit_document_ids": [str(d) for d in (payload.explicit_document_ids or [])],
                "override_notes": payload.override_notes,
            },
        )
        db.add(override_audit)

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
            "excluded_count": package.manifest_json.get("excluded_count", 0),
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
        if not (auth.is_master_admin() or auth.is_company_admin() or auth.is_senior_reviewer() or auth.has_role("senior_attorney") or auth.has_permission("readiness:approve")):
            raise HTTPException(
                status_code=403,
                detail=f"Senior reviewer, authorized professional, or admin role required to approve '{payload.stage}'.",
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


from backend.app.domain.case_lifecycle import CaseLifecycleService


class RecordDownloadEventRequest(BaseModel):
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


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


@router.post("/{package_id}/download-event")
def record_package_download_event(
    package_id: uuid.UUID,
    payload: Optional[RecordDownloadEventRequest] = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Records an immutable package download evidence event with manifest snapshot and package hash.
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
    event = CaseLifecycleService.record_download_event(
        db=db,
        package=package,
        user=user,
        ip_address=payload.ip_address if payload else None,
        user_agent=payload.user_agent if payload else None,
    )
    return {
        "id": str(event.id),
        "package_id": str(event.package_id),
        "downloaded_by": f"{user.full_name} ({user.email})",
        "downloaded_at": event.downloaded_at.isoformat(),
        "package_hash": event.package_hash_at_download,
    }


class VerifyPackageDownloadRequest(BaseModel):
    client_received_bytes: int = Field(..., ge=0)
    browser_storage_acknowledged: bool = True
    client_sha256_hash: Optional[str] = None
    client_timestamp: Optional[datetime] = None


@router.post("/{package_id}/verify-download")
def verify_package_download(
    package_id: uuid.UUID,
    payload: VerifyPackageDownloadRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Verifies client-side browser receipt of a filing package download.
    Enforces honest disclosure of verification limits and schedules firm post-download retention.
    """
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    latest_event = (
        db.query(PackageDownloadEvent)
        .filter(
            PackageDownloadEvent.package_id == package_id,
            PackageDownloadEvent.organization_id == auth.organization_id,
        )
        .order_by(PackageDownloadEvent.downloaded_at.desc())
        .first()
    )
    if not latest_event:
        user = db.execute(select(User).where(User.id == auth.user_id)).scalar_one()
        latest_event = CaseLifecycleService.record_download_event(
            db=db,
            package=package,
            user=user,
        )

    now = now_utc()
    latest_event.is_verified = True
    latest_event.verified_at = now
    latest_event.client_verification_payload = {
        "client_received_bytes": payload.client_received_bytes,
        "browser_storage_acknowledged": payload.browser_storage_acknowledged,
        "client_sha256_hash": payload.client_sha256_hash,
        "client_timestamp": payload.client_timestamp.isoformat() if payload.client_timestamp else None,
        "verified_by_user_id": str(auth.user_id),
    }

    # Evaluate firm's post-download retention policy from parent case
    case = db.query(ImmigrationCase).filter(ImmigrationCase.id == package.case_id).first()
    policy = case.post_download_retention_policy if case else "seven_days"
    if policy == "immediate":
        latest_event.post_download_purge_scheduled_at = now
    else:
        latest_event.post_download_purge_scheduled_at = now + timedelta(days=7)

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="filing_package.download_verified",
        object_type="filing_package",
        object_id=str(package_id),
        metadata_json={
            "package_id": str(package_id),
            "verified_at": now.isoformat(),
            "retention_policy": policy,
            "purge_scheduled_at": latest_event.post_download_purge_scheduled_at.isoformat() if latest_event.post_download_purge_scheduled_at else None,
        },
        occurred_at=now,
    )
    db.add(audit)
    db.commit()

    return {
        "package_id": str(package_id),
        "is_verified": True,
        "verified_at": now.isoformat(),
        "post_download_retention_policy": policy,
        "post_download_purge_scheduled_at": latest_event.post_download_purge_scheduled_at.isoformat() if latest_event.post_download_purge_scheduled_at else None,
        "verification_limits_notice": (
            "Verification confirms client-side receipt in the active browser session. "
            "Local storage persistence, backups, and user disk integrity cannot be verified by Documento after transfer."
        ),
        "local_copy_notice": (
            "Documento cannot and does not claim to delete any local copies once downloaded to your device."
        ),
    }


# --- Phase 7 Endpoints ---

@router.get("/{package_id}/manifest")
def get_canonical_package_manifest(
    package_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Returns the deterministic Phase 7 manifest matching the exact required schema:
    {
      "case_reference": "CASE-…",
      "generated_at": "ISO-8601 timestamp",
      "generated_by": "user-id",
      "package_template_version": "…",
      "checklist_rule_version": "…",
      "documents": [{
        "document_version_id": "…",
        "relative_path": "01_Identity/Principal/Passport.pdf",
        "sha256": "…",
        "review_status": "HUMAN_VERIFIED"
      }],
      "exclusions": [{
        "document_version_id": "…",
        "reason_code": "UNRESOLVED_ANOMALY"
      }]
    }
    """
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    manifest_json = package.manifest_json or {}
    if "phase7_manifest" in manifest_json:
        return manifest_json["phase7_manifest"]

    case = db.execute(select(ImmigrationCase).where(ImmigrationCase.id == package.case_id)).scalar_one()
    rule_ver = manifest_json.get("rule_set_version", "IRCC-EE-2026.1" if case.jurisdiction == "CA" else "USCIS-EB1A-2026.2")
    canonical = build_canonical_phase7_manifest(
        case_reference=case.case_number or f"CASE-{case.id}",
        generated_by=str(package.approved_by_user_id or auth.user_id),
        package_template_version=package.version_number or "v1.0.0",
        checklist_rule_version=rule_ver,
        included_documents=manifest_json.get("items", []),
        excluded_documents=manifest_json.get("excluded_items", []),
        generated_at=manifest_json.get("generated_at"),
    )
    return canonical


@router.get("/{package_id}/download-zip")
def download_package_zip(
    package_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Assembles and streams a complete, secure local ZIP archive with:
    - Path traversal and Zip-Slip protection.
    - Firm-configured folder templates (e.g. Canada: CIC CORRESPONDENCE, DOCUMENTS, EXTRA, FORMS, UPLOAD).
    - Root manifest.json matching the exact canonical Phase 7 schema.
    - Human-readable manifest.txt and OCR/anomaly report.
    - Invariant: Permanent records remain in firm-controlled local folders.
    - Invariant: Failed or uncertain download NEVER triggers case or document deletion.
    """
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    case = db.execute(select(ImmigrationCase).where(ImmigrationCase.id == package.case_id)).scalar_one()
    manifest_json = package.manifest_json or {}
    folder_list = manifest_json.get("folders", [])
    items = manifest_json.get("items", [])
    excluded_items = manifest_json.get("excluded_items", [])
    rule_ver = manifest_json.get("rule_set_version", "IRCC-EE-2026.1" if case.jurisdiction == "CA" else "USCIS-EB1A-2026.2")

    zip_bytes, canonical_manifest = build_package_local_zip_archive(
        case_reference=case.case_number or f"CASE-{case.id}",
        package_name=package.name,
        package_template_version=package.version_number or "v1.0.0",
        checklist_rule_version=rule_ver,
        folder_structure=folder_list,
        document_entries=items,
        excluded_entries=excluded_items,
        generated_by=str(auth.user_id),
        case_title=case.title or "Immigration Filing",
        jurisdiction=case.jurisdiction or "CA",
        notes=package.submission_instructions,
    )

    # Record download event in DB
    user = db.execute(select(User).where(User.id == auth.user_id)).scalar_one()
    CaseLifecycleService.record_download_event(
        db=db,
        package=package,
        user=user,
    )

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="filing_package.zip_downloaded",
        object_type="filing_package",
        object_id=str(package_id),
        metadata_json={
            "case_id": str(package.case_id),
            "package_name": package.name,
            "items_count": len(items),
            "excluded_count": len(excluded_items),
            "zip_size_bytes": len(zip_bytes),
        },
    )
    db.add(audit)
    db.commit()

    safe_name = sanitize_filename(f"{case.case_number}_{package.name}").replace(".pdf", "")
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.zip"',
            "Content-Length": str(len(zip_bytes)),
        },
    )


@router.get("/{package_id}/report")
def download_package_report(
    package_id: uuid.UUID,
    format: str = Query("txt", pattern="^(txt|docx|doc|pdf)$"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Generates deterministic manifest and OCR/anomaly report as TXT, Word-compatible (.docx), or PDF
    for hold, reassignment, or interim packages.
    """
    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    case = db.execute(select(ImmigrationCase).where(ImmigrationCase.id == package.case_id)).scalar_one()
    manifest_json = package.manifest_json or {}
    canonical_manifest = manifest_json.get("phase7_manifest")
    if not canonical_manifest:
        rule_ver = manifest_json.get("rule_set_version", "IRCC-EE-2026.1" if case.jurisdiction == "CA" else "USCIS-EB1A-2026.2")
        canonical_manifest = build_canonical_phase7_manifest(
            case_reference=case.case_number or f"CASE-{case.id}",
            generated_by=str(auth.user_id),
            package_template_version=package.version_number or "v1.0.0",
            checklist_rule_version=rule_ver,
            included_documents=manifest_json.get("items", []),
            excluded_documents=manifest_json.get("excluded_items", []),
            generated_at=manifest_json.get("generated_at"),
        )

    safe_base = sanitize_filename(f"Manifest_Report_{case.case_number}_{package_id}")

    if format in ["docx", "doc"]:
        report_bytes = generate_word_compatible_html_report(
            manifest=canonical_manifest,
            case_title=case.title or "Immigration Matter",
            jurisdiction=case.jurisdiction or "CA",
            notes=package.submission_instructions,
        )
        return StreamingResponse(
            io.BytesIO(report_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_base}.doc"',
                "Content-Length": str(len(report_bytes)),
            },
        )
    elif format == "pdf":
        report_bytes = generate_pdf_manifest_report(
            manifest=canonical_manifest,
            case_title=case.title or "Immigration Matter",
            jurisdiction=case.jurisdiction or "CA",
            notes=package.submission_instructions,
        )
        return StreamingResponse(
            io.BytesIO(report_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_base}.pdf"',
                "Content-Length": str(len(report_bytes)),
            },
        )
    else:
        text_report = generate_manifest_text_report(
            manifest=canonical_manifest,
            case_title=case.title or "Immigration Matter",
            jurisdiction=case.jurisdiction or "CA",
            notes=package.submission_instructions,
        )
        report_bytes = text_report.encode("utf-8")
        return StreamingResponse(
            io.BytesIO(report_bytes),
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_base}.txt"',
                "Content-Length": str(len(report_bytes)),
            },
        )


@router.get("/cases/{case_id}/interim-report")
def get_case_interim_report(
    case_id: uuid.UUID,
    format: str = Query("txt", pattern="^(txt|docx|doc|pdf)$"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Generates deterministic manifest and OCR/anomaly report as TXT, Word, or PDF for
    hold or reassignment interim packages directly from case evidence.
    """
    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    # Evaluate preview
    preview = preview_package_eligibility(db, case_id, auth.organization_id)
    included = preview.get("eligible_documents", [])
    excluded = preview.get("ineligible_documents", [])

    canonical_manifest = build_canonical_phase7_manifest(
        case_reference=case.case_number or f"CASE-{case.id}",
        generated_by=str(auth.user_id),
        package_template_version="interim-v1.0.0",
        checklist_rule_version="IRCC-EE-2026.1" if case.jurisdiction == "CA" else "USCIS-EB1A-2026.2",
        included_documents=included,
        excluded_documents=excluded,
    )

    safe_base = sanitize_filename(f"Interim_Report_{case.case_number}_{case_id}")

    if format in ["docx", "doc"]:
        report_bytes = generate_word_compatible_html_report(
            manifest=canonical_manifest,
            case_title=case.title or "Immigration Matter (Interim Hold / Reassignment)",
            jurisdiction=case.jurisdiction or "CA",
            notes="INTERIM REPORT FOR CASE HOLD / REASSIGNMENT. Permanent records remain in firm-controlled local folders.",
        )
        return StreamingResponse(
            io.BytesIO(report_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_base}.doc"',
                "Content-Length": str(len(report_bytes)),
            },
        )
    elif format == "pdf":
        report_bytes = generate_pdf_manifest_report(
            manifest=canonical_manifest,
            case_title=case.title or "Immigration Matter (Interim Hold / Reassignment)",
            jurisdiction=case.jurisdiction or "CA",
            notes="INTERIM REPORT FOR CASE HOLD / REASSIGNMENT. Permanent records remain in firm-controlled local folders.",
        )
        return StreamingResponse(
            io.BytesIO(report_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_base}.pdf"',
                "Content-Length": str(len(report_bytes)),
            },
        )
    else:
        text_report = generate_manifest_text_report(
            manifest=canonical_manifest,
            case_title=case.title or "Immigration Matter (Interim Hold / Reassignment)",
            jurisdiction=case.jurisdiction or "CA",
            notes="INTERIM REPORT FOR CASE HOLD / REASSIGNMENT. Permanent records remain in firm-controlled local folders.",
        )
        report_bytes = text_report.encode("utf-8")
        return StreamingResponse(
            io.BytesIO(report_bytes),
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_base}.txt"',
                "Content-Length": str(len(report_bytes)),
            },
        )


@router.post("/{package_id}/documents/{document_id}/include")
def include_document_in_package(
    package_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Authorized officer adds an eligible document to the assembled package before download.
    STRICT INVARIANT: No unresolved anomaly or failed mandatory check can be included!
    Every change is logged with immutable AuditEvent.
    """
    if auth.is_retained_client() or not (auth.is_case_manager() or auth.is_org_admin() or auth.is_senior_reviewer() or auth.has_role(RoleCode.CASE_MANAGER) or auth.has_role(RoleCode.SENIOR_REVIEWER) or auth.has_role("attorney")):
        raise PermissionDeniedError("Client role is not authorized to modify package document inclusions.")

    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.organization_id == auth.organization_id,
            Document.case_id == package.case_id,
        )
    ).scalar_one_or_none()
    if not doc:
        raise EntityNotFoundError("Document", str(document_id))

    case = db.execute(select(ImmigrationCase).where(ImmigrationCase.id == package.case_id)).scalar_one()

    # Fetch open findings for case
    findings_stmt = select(CaseAIFinding).where(
        CaseAIFinding.case_id == case.id,
        CaseAIFinding.organization_id == auth.organization_id,
        CaseAIFinding.status.in_(UNRESOLVED_FINDING_STATUSES),
    )
    unresolved_findings = db.execute(findings_stmt).scalars().all()

    # Evaluate eligibility: Strict Blocker Invariant!
    eligibility = evaluate_document_for_package(
        document=doc,
        case=case,
        policy=PackageEligibilityPolicy(),
        db=db,
        unresolved_findings=unresolved_findings,
    )

    if not eligibility.eligible:
        blockers_str = ", ".join(eligibility.blockers)
        raise ValidationError(
            f"Cannot include document '{doc.filename or doc.title}': Unresolved anomaly or blocker present: [{blockers_str}]. "
            f"No unresolved anomaly or failed mandatory check can be included."
        )

    manifest_json = dict(package.manifest_json or {})
    items = list(manifest_json.get("items", []))
    excluded = list(manifest_json.get("excluded_items", []))
    folder_list = list(manifest_json.get("folders", []))

    # Remove from exclusions if present
    excluded = [e for e in excluded if str(e.get("document_id")) != str(document_id)]

    # Check if already in items
    existing_item = next((i for i in items if str(i.get("document_id")) == str(document_id)), None)
    if not existing_item:
        # Determine folder
        is_canada_template = any(
            f.get("folder_name") in ["CIC CORRESPONDENCE", "DOCUMENTS", "FORMS", "EXTRA", "UPLOAD"]
            or f.get("folder_code") in ["01_Cic_Correspondence", "02_Documents", "03_Forms", "04_Extra", "05_Upload"]
            for f in folder_list
        )
        cat = (doc.category or "").lower()
        title_low = (doc.title or "").lower()
        fn_low = (doc.filename or "").lower()

        if is_canada_template:
            if any(k in cat or k in title_low or k in fn_low for k in ["correspondence", "cic", "ircc", "ita", "letter", "email"]):
                folder_code = "01_Cic_Correspondence"
            elif any(k in cat or k in title_low or k in fn_low for k in ["form", "imm0008", "imm5669", "imm5406", "application_form"]):
                folder_code = "03_Forms"
            elif any(k in cat or k in title_low or k in fn_low for k in ["extra", "supplementary", "additional", "testimonial", "affidavit"]):
                folder_code = "04_Extra"
            elif any(k in cat or k in title_low or k in fn_low for k in ["upload", "portal", "screenshot", "receipt", "confirmation"]):
                folder_code = "05_Upload"
            elif any(k in cat or k in title_low or k in fn_low for k in ["internal", "memo", "strategy", "confidential"]):
                folder_code = "09_Internal_Review"
            else:
                folder_code = "02_Documents"
        else:
            folder_code = "03_Pathway_Evidence"
            if cat in ["passport", "visas_residence_permits", "identity_document"]:
                folder_code = "01_Identity_and_Civil_Status"
            elif cat in ["financial_evidence", "tax_record", "bank_statement"]:
                folder_code = "04_Financial_Evidence"
            elif cat in ["educational_credential", "degree", "diploma"]:
                folder_code = "05_Education_and_Employment"
            elif cat in ["civil_status", "marriage_certificate", "birth_certificate"]:
                folder_code = "06_Family_and_Sponsorship"
            elif cat in ["certified_translation", "translation"]:
                folder_code = "07_Translations_and_Certifications"
            elif cat in ["internal_memo", "lawyer_strategy", "conflict_check"]:
                folder_code = "09_Internal_Review"

        matched_folder = next((f for f in folder_list if f.get("folder_code") == folder_code), None)
        folder_name = matched_folder.get("folder_name") if matched_folder else folder_code
        safe_fn = sanitize_filename(doc.filename or f"{doc.title}.pdf")
        rel_path = f"{folder_name}/{safe_fn}"

        file_hash = doc.sha256_hash or hashlib.sha256((doc.filename or doc.title).encode()).hexdigest()
        items.append({
            "document_id": str(doc.id),
            "version": doc.version or 1,
            "version_id": f"{doc.id}:v{doc.version or 1}",
            "file_name": safe_fn,
            "folder_code": folder_code,
            "folder_path": rel_path,
            "document_category": doc.category,
            "sha256_hash": file_hash,
            "review_status": "HUMAN_VERIFIED" if (doc.verification_status or "").lower() in ["verified", "human_verified", "signed_off"] else (doc.verification_status or "pending_review"),
            "related_requirement_code": "MANDATORY_EVIDENCE",
            "is_internal_only": folder_code == "09_Internal_Review",
            "page_count": doc.page_count or 1,
            "file_size": f"{round(doc.byte_size / (1024 * 1024), 2)} MB" if getattr(doc, "byte_size", None) else "1.0 MB",
        })

    # Re-sort items
    items.sort(key=lambda i: (i.get("folder_code", ""), i.get("file_name", ""), i.get("document_id", "")))

    # Re-calculate package hash
    item_hashes = [i.get("sha256_hash", "") for i in items]
    merkle_elements = [
        f"policy:{manifest_json.get('policy_version', '1.0.0')}",
        f"jurisdiction:{case.jurisdiction}",
    ] + sorted(item_hashes)
    package_root_hash = hashlib.sha256("\n".join(merkle_elements).encode()).hexdigest()

    # Rebuild Phase 7 canonical manifest
    phase7_manifest = build_canonical_phase7_manifest(
        case_reference=case.case_number or f"CASE-{case.id}",
        generated_by=str(auth.user_id),
        package_template_version=package.version_number or "v1.0.0",
        checklist_rule_version=manifest_json.get("rule_set_version", "IRCC-EE-2026.1" if case.jurisdiction == "CA" else "USCIS-EB1A-2026.2"),
        included_documents=items,
        excluded_documents=excluded,
    )

    manifest_json["items"] = items
    manifest_json["excluded_items"] = excluded
    manifest_json["items_count"] = len(items)
    manifest_json["excluded_count"] = len(excluded)
    manifest_json["package_hash"] = package_root_hash
    manifest_json["phase7_manifest"] = phase7_manifest

    package.manifest_json = manifest_json
    package.package_hash = package_root_hash
    flag_modified(package, "manifest_json")

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="filing_package.document_included",
        object_type="filing_package",
        object_id=str(package_id),
        metadata_json={
            "case_id": str(package.case_id),
            "document_id": str(document_id),
            "document_title": doc.title,
            "filename": doc.filename,
            "new_items_count": len(items),
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(package)

    return {
        "success": True,
        "message": f"Document '{doc.title}' included in package.",
        "items_count": len(items),
        "excluded_count": len(excluded),
        "package_hash": package.package_hash,
        "manifest": package.manifest_json,
    }


@router.post("/{package_id}/documents/{document_id}/exclude")
def exclude_document_from_package(
    package_id: uuid.UUID,
    document_id: uuid.UUID,
    payload: Optional[ExcludeDocumentRequest] = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Authorized officer excludes a document from the assembled package before download.
    Reason code and notes are immutably logged with AuditEvent.
    """
    if auth.is_retained_client() or not (auth.is_case_manager() or auth.is_org_admin() or auth.is_senior_reviewer() or auth.has_role(RoleCode.CASE_MANAGER) or auth.has_role(RoleCode.SENIOR_REVIEWER) or auth.has_role("attorney")):
        raise PermissionDeniedError("Client role is not authorized to modify package document exclusions.")

    package = db.execute(
        select(FilingPackage).where(
            FilingPackage.id == package_id,
            FilingPackage.organization_id == auth.organization_id,
        )
    ).scalar_one_or_none()
    if not package:
        raise EntityNotFoundError("FilingPackage", str(package_id))

    manifest_json = dict(package.manifest_json or {})
    items = list(manifest_json.get("items", []))
    excluded = list(manifest_json.get("excluded_items", []))

    # Find item
    target_item = next((i for i in items if str(i.get("document_id")) == str(document_id)), None)
    if not target_item:
        raise EntityNotFoundError("Document in Package", str(document_id))

    # Remove from items
    items = [i for i in items if str(i.get("document_id")) != str(document_id)]

    reason_code = payload.reason_code if payload and payload.reason_code else "OFFICER_DISCRETIONARY_EXCLUSION"
    excluded.append({
        "document_id": str(document_id),
        "version": target_item.get("version", 1),
        "version_id": target_item.get("version_id", f"{document_id}:v1"),
        "file_name": target_item.get("file_name", "document.pdf"),
        "reason_code": reason_code,
        "notes": payload.notes if payload else None,
        "excluded_by": str(auth.user_id),
    })

    # Re-calculate hash
    case = db.execute(select(ImmigrationCase).where(ImmigrationCase.id == package.case_id)).scalar_one()
    item_hashes = [i.get("sha256_hash", "") for i in items]
    merkle_elements = [
        f"policy:{manifest_json.get('policy_version', '1.0.0')}",
        f"jurisdiction:{case.jurisdiction}",
    ] + sorted(item_hashes)
    package_root_hash = hashlib.sha256("\n".join(merkle_elements).encode()).hexdigest()

    phase7_manifest = build_canonical_phase7_manifest(
        case_reference=case.case_number or f"CASE-{case.id}",
        generated_by=str(auth.user_id),
        package_template_version=package.version_number or "v1.0.0",
        checklist_rule_version=manifest_json.get("rule_set_version", "IRCC-EE-2026.1" if case.jurisdiction == "CA" else "USCIS-EB1A-2026.2"),
        included_documents=items,
        excluded_documents=excluded,
    )

    manifest_json["items"] = items
    manifest_json["excluded_items"] = excluded
    manifest_json["items_count"] = len(items)
    manifest_json["excluded_count"] = len(excluded)
    manifest_json["package_hash"] = package_root_hash
    manifest_json["phase7_manifest"] = phase7_manifest

    package.manifest_json = manifest_json
    package.package_hash = package_root_hash
    flag_modified(package, "manifest_json")

    audit = AuditEvent(
        organization_id=auth.organization_id,
        actor_id=auth.user_id,
        action="filing_package.document_excluded",
        object_type="filing_package",
        object_id=str(package_id),
        metadata_json={
            "case_id": str(package.case_id),
            "document_id": str(document_id),
            "reason_code": reason_code,
            "notes": payload.notes if payload else None,
            "new_items_count": len(items),
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(package)

    return {
        "success": True,
        "message": f"Document excluded from package with reason '{reason_code}'.",
        "items_count": len(items),
        "excluded_count": len(excluded),
        "package_hash": package.package_hash,
        "manifest": package.manifest_json,
    }


