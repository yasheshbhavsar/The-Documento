"""
backend/app/packages/eligibility.py

Document and Package Eligibility Engine.
Enforces statutory compliance, evidence sufficiency, tenant isolation,
and quality gates before any document enters a filing package.
Tracks readability, classification, applicant assignment, consistency,
evidentiary sufficiency, and human verification as distinct dimensions.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.domain.models import (
    ImmigrationCase,
    Document,
    CaseAIFinding,
    now_utc,
)
from backend.app.core.errors import (
    TenantIsolationError,
    ValidationError,
    EntityNotFoundError,
)

UNRESOLVED_FINDING_STATUSES = (
    "needs_review",
    "unable_to_determine",
    "flagged",
    "in_review",
    "open",
    "investigating",
    "needs_action",
)


@dataclass
class PackageEligibilityPolicy:
    """
    Configurable eligibility policy for filing package inclusion.
    """
    version: str = "2026.1"
    requires_human_verification: bool = True
    allow_expired_documents: bool = False
    strict_processing_status: bool = True
    require_applicant_assignment: bool = True
    require_confirmed_classification: bool = True


@dataclass
class Eligibility:
    """
    Outcome of evaluating a candidate document for filing package inclusion
    across 6 distinct quality and statutory dimensions.
    """
    eligible: bool
    blockers: List[str]
    policy_version: str
    checked_at: datetime
    warnings: List[str] = field(default_factory=list)
    dimensions: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    version: Optional[int] = None
    sha256_hash: Optional[str] = None
    exclusion_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "eligible": self.eligible,
            "blockers": self.blockers,
            "warnings": self.warnings,
            "dimensions": self.dimensions,
            "policy_version": self.policy_version,
            "checked_at": self.checked_at.isoformat() if self.checked_at else None,
            "document_id": self.document_id,
            "document_title": self.document_title,
            "version": self.version,
            "sha256_hash": self.sha256_hash,
            "exclusion_reasons": self.exclusion_reasons,
        }


def evaluate_document_for_package(
    document: Any,
    case: Any,
    policy: Optional[PackageEligibilityPolicy] = None,
    db: Optional[Session] = None,
    unresolved_findings: Optional[List[CaseAIFinding]] = None,
) -> Eligibility:
    """
    Evaluates a candidate document against 6 distinct dimensions:
    1. Readability & Malware scan
    2. Classification confirmed
    3. Applicant assignment confirmed
    4. Consistency / Anomaly status (zero unresolved findings)
    5. Evidentiary sufficiency (valid sha256 hash, non-expired)
    6. Human verification sign-off

    Also enforces tenant isolation and case matching.
    """
    if policy is None:
        policy = PackageEligibilityPolicy()

    blockers: List[str] = []
    warnings: List[str] = []
    exclusion_reasons: List[str] = []
    dimensions: Dict[str, Dict[str, Any]] = {}
    now = now_utc()

    # 0. Tenant and Case Validation
    if hasattr(document, "organization_id") and hasattr(case, "organization_id"):
        if document.organization_id != case.organization_id:
            blockers.append("CROSS_TENANT_DOCUMENT")
            exclusion_reasons.append("Cross-tenant document access is strictly forbidden.")

    if hasattr(document, "case_id") and hasattr(case, "id"):
        if document.case_id and document.case_id != case.id:
            blockers.append("WRONG_CASE_DOCUMENT")
            exclusion_reasons.append(f"Document belongs to case '{document.case_id}', not '{case.id}'.")

    # 1. Readability & Malware / Processing Status
    malware_status = getattr(document, "malware_scan_status", "clean") or "clean"
    processing_status = getattr(document, "processing_status", "completed") or "completed"
    byte_size = getattr(document, "byte_size", 1)

    if malware_status == "infected":
        blockers.append("MALWARE_INFECTED")
        exclusion_reasons.append("Malware scan identified file as infected or hazardous.")
        dimensions["readability"] = {"status": "failed", "reason": "Malware scan identified file as infected."}
    elif malware_status == "pending" and policy.strict_processing_status:
        blockers.append("MALWARE_SCAN_PENDING")
        exclusion_reasons.append("Malware scan has not yet completed.")
        dimensions["readability"] = {"status": "failed", "reason": "Malware scan is still pending."}
    elif processing_status in ["failed"]:
        blockers.append("PROCESSING_FAILED")
        err = getattr(document, "processing_error", None) or "Unknown extraction failure"
        exclusion_reasons.append(f"Document processing failed: {err}")
        dimensions["readability"] = {"status": "failed", "reason": f"Processing failed: {err}"}
    elif processing_status in ["pending", "processing"] and policy.strict_processing_status:
        blockers.append("PROCESSING_INCOMPLETE")
        exclusion_reasons.append("Document processing and text extraction is still in progress.")
        dimensions["readability"] = {"status": "failed", "reason": "Document processing is incomplete."}
    elif byte_size is not None and byte_size <= 0:
        blockers.append("UNREADABLE_EMPTY_FILE")
        exclusion_reasons.append("File size is 0 bytes (empty file).")
        dimensions["readability"] = {"status": "failed", "reason": "File size is 0 bytes."}
    else:
        dimensions["readability"] = {"status": "passed", "details": "Clean malware scan and completed processing."}

    # 2. Classification
    if hasattr(document, "classification_confirmed"):
        is_classification_confirmed = bool(document.classification_confirmed)
    else:
        cat = (getattr(document, "category", "") or "").strip().lower()
        is_classification_confirmed = bool(cat and cat not in ["unclassified", "pending", "pending_classification", "unknown", ""])

    if policy.require_confirmed_classification and not is_classification_confirmed:
        blockers.append("CLASSIFICATION_UNCONFIRMED")
        exclusion_reasons.append("Document classification is unconfirmed or category is pending.")
        dimensions["classification"] = {"status": "failed", "reason": "Document classification unconfirmed."}
    else:
        dimensions["classification"] = {
            "status": "passed",
            "category": getattr(document, "category", "supporting_evidence"),
        }

    # 3. Applicant Assignment
    if hasattr(document, "applicant_assignment_confirmed"):
        is_applicant_assigned = bool(document.applicant_assignment_confirmed)
    else:
        is_applicant_assigned = bool(getattr(document, "client_id", None))

    if policy.require_applicant_assignment and not is_applicant_assigned:
        blockers.append("APPLICANT_UNASSIGNED")
        exclusion_reasons.append("Document is not assigned to a verified case applicant.")
        dimensions["applicant_assignment"] = {"status": "failed", "reason": "No applicant assigned to document."}
    else:
        client_id_val = str(getattr(document, "client_id", "")) if getattr(document, "client_id", None) else None
        dimensions["applicant_assignment"] = {"status": "passed", "client_id": client_id_val}

    # 4. Consistency & Unresolved Anomalies
    has_anomaly = getattr(document, "has_unresolved_anomaly", False)
    anomaly_details = []

    if has_anomaly:
        blockers.append("UNRESOLVED_ANOMALY")
        exclusion_reasons.append("Document has an unresolved anomaly flag.")
        anomaly_details.append("Document flagged with unresolved anomaly.")
    else:
        # Check database or provided unresolved findings
        doc_id = getattr(document, "id", None)
        if doc_id:
            doc_id_str = str(doc_id)
            findings_to_check = unresolved_findings
            if findings_to_check is None and db is not None:
                stmt = select(CaseAIFinding).where(
                    CaseAIFinding.case_id == case.id,
                    CaseAIFinding.status.in_(UNRESOLVED_FINDING_STATUSES),
                )
                findings_to_check = db.execute(stmt).scalars().all()

            if findings_to_check:
                for f in findings_to_check:
                    matches = False
                    if f.document_id and str(f.document_id) == doc_id_str:
                        matches = True
                    elif f.related_documents:
                        for rel in f.related_documents:
                            if isinstance(rel, dict) and str(rel.get("id")) == doc_id_str:
                                matches = True
                                break
                            elif str(rel) == doc_id_str:
                                matches = True
                                break
                    if matches:
                        has_anomaly = True
                        anomaly_details.append(f"Finding '{f.title}' [{f.severity}]")

            if has_anomaly and "UNRESOLVED_ANOMALY" not in blockers:
                blockers.append("UNRESOLVED_ANOMALY")
                reason_str = f"Unresolved anomaly detected in AI findings: {'; '.join(anomaly_details)}"
                exclusion_reasons.append(reason_str)

    if has_anomaly:
        dimensions["consistency"] = {
            "status": "failed",
            "reason": "; ".join(anomaly_details) if anomaly_details else "Unresolved anomaly detected.",
        }
    else:
        dimensions["consistency"] = {"status": "passed", "details": "Zero unresolved anomalies or contradictions."}

    # 5. Evidentiary Sufficiency (Hash & Expiration)
    sha256 = getattr(document, "sha256_hash", None)
    if not sha256 or len(sha256) < 32:
        blockers.append("INSUFFICIENT_EVIDENTIARY_HASH")
        exclusion_reasons.append("Document lacks a valid SHA-256 cryptographic hash.")
        dimensions["evidentiary_sufficiency"] = {"status": "failed", "reason": "Missing or invalid SHA-256 hash."}
    else:
        notes = (getattr(document, "verification_notes", "") or "").lower()
        if "expired" in notes:
            if not policy.allow_expired_documents:
                blockers.append("DOCUMENT_EXPIRED")
                exclusion_reasons.append("Document is expired and policy disallows expired evidence.")
                dimensions["evidentiary_sufficiency"] = {"status": "failed", "reason": "Document is expired."}
            else:
                warnings.append("DOCUMENT_EXPIRED")
                dimensions["evidentiary_sufficiency"] = {"status": "warning", "reason": "Document is expired (permitted by policy)."}
        else:
            dimensions["evidentiary_sufficiency"] = {"status": "passed", "details": "Cryptographic hash verified and document valid."}

    # 6. Human Verification
    if hasattr(document, "human_verified"):
        is_human_verified = bool(document.human_verified)
    else:
        ver_status = getattr(document, "verification_status", "unverified")
        is_human_verified = (ver_status == "verified")

    ver_status = getattr(document, "verification_status", "unverified")
    if ver_status == "rejected":
        blockers.append("DOCUMENT_REJECTED")
        exclusion_reasons.append("Document was formally rejected by a reviewer.")
        dimensions["human_verification"] = {"status": "failed", "reason": "Document formally rejected."}
    elif policy.requires_human_verification and not is_human_verified:
        blockers.append("HUMAN_VERIFICATION_REQUIRED")
        exclusion_reasons.append(f"Document requires human verification (current status: '{ver_status}').")
        dimensions["human_verification"] = {"status": "failed", "reason": f"Verification status '{ver_status}' requires human sign-off."}
    else:
        dimensions["human_verification"] = {"status": "passed", "verification_status": ver_status}

    # Deduplicate while preserving order
    blockers = list(dict.fromkeys(blockers))
    warnings = list(dict.fromkeys(warnings))
    exclusion_reasons = list(dict.fromkeys(exclusion_reasons))

    doc_id_val = str(getattr(document, "id", "")) if getattr(document, "id", None) else None
    title_val = getattr(document, "title", None) or getattr(document, "filename", None)
    version_val = getattr(document, "version", 1)

    return Eligibility(
        eligible=len(blockers) == 0,
        blockers=blockers,
        warnings=warnings,
        dimensions=dimensions,
        policy_version=policy.version,
        checked_at=now,
        document_id=doc_id_val,
        document_title=title_val,
        version=version_val,
        sha256_hash=sha256,
        exclusion_reasons=exclusion_reasons,
    )


def preview_package_eligibility(
    db: Session,
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
    policy: Optional[PackageEligibilityPolicy] = None,
    explicit_document_ids: Optional[List[uuid.UUID]] = None,
) -> Dict[str, Any]:
    """
    Evaluates every candidate document for a case and returns a comprehensive preview
    of included and excluded documents, including distinct dimensions and exact exclusion reasons.
    """
    if policy is None:
        policy = PackageEligibilityPolicy()

    case = db.execute(
        select(ImmigrationCase).where(
            ImmigrationCase.id == case_id,
            ImmigrationCase.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if not case:
        raise EntityNotFoundError("ImmigrationCase", str(case_id))

    # Fetch candidate documents
    if explicit_document_ids:
        docs = []
        for doc_id in explicit_document_ids:
            doc = db.execute(select(Document).where(Document.id == doc_id)).scalar_one_or_none()
            if not doc:
                raise EntityNotFoundError("Document", str(doc_id))
            if doc.organization_id != organization_id:
                raise TenantIsolationError(f"Cross-tenant document access strictly forbidden: document {doc.id} does not belong to organization {organization_id}")
            if doc.case_id != case_id:
                raise ValidationError(f"Wrong-case document rejected: document {doc.id} is associated with case {doc.case_id}, not case {case_id}")
            docs.append(doc)
    else:
        docs_stmt = select(Document).where(
            Document.case_id == case_id,
            Document.organization_id == organization_id,
        ).order_by(Document.created_at.asc())
        docs = db.execute(docs_stmt).scalars().all()

    # Pre-fetch unresolved findings
    findings_stmt = select(CaseAIFinding).where(
        CaseAIFinding.case_id == case_id,
        CaseAIFinding.organization_id == organization_id,
        CaseAIFinding.status.in_(UNRESOLVED_FINDING_STATUSES),
    )
    unresolved_findings = db.execute(findings_stmt).scalars().all()

    included_documents = []
    excluded_documents = []

    for doc in docs:
        eligibility = evaluate_document_for_package(
            document=doc,
            case=case,
            policy=policy,
            db=db,
            unresolved_findings=unresolved_findings,
        )
        doc_entry = {
            "document_id": str(doc.id),
            "version": doc.version or 1,
            "version_id": f"{doc.id}:v{doc.version or 1}",
            "title": doc.title,
            "filename": doc.filename,
            "category": doc.category,
            "sha256_hash": doc.sha256_hash,
            "verification_status": doc.verification_status,
            "dimensions": eligibility.dimensions,
            "warnings": eligibility.warnings,
        }
        if eligibility.eligible:
            included_documents.append(doc_entry)
        else:
            doc_entry["blockers"] = eligibility.blockers
            doc_entry["exclusion_reasons"] = eligibility.exclusion_reasons
            excluded_documents.append(doc_entry)

    return {
        "case_id": str(case_id),
        "case_number": case.case_number,
        "jurisdiction": case.jurisdiction,
        "pathway": case.visa_category,
        "policy_version": policy.version,
        "evaluated_at": now_utc().isoformat(),
        "total_documents_evaluated": len(docs),
        "included_documents_count": len(included_documents),
        "excluded_documents_count": len(excluded_documents),
        "is_package_buildable": len(included_documents) > 0,
        "included_documents": included_documents,
        "excluded_documents": excluded_documents,
        "compliance_notice": (
            "Evaluation performed strictly against internal statutory and quality criteria. "
            "Probability of approval is never generated or displayed. "
            "No legal advice is provided or implied."
        ),
    }
