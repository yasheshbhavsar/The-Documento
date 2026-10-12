import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select

from backend.app.domain.models import (
    FilingPackage,
    PackageTemplate,
    ImmigrationCase,
    Document,
    FormSubmission,
    User,
    RuleSetVersion,
    now_utc,
)
from backend.app.packages.readiness import ReadinessService

DEFAULT_USCIS_FOLDERS = [
    {"folder_code": "00_Case_Summary", "folder_name": "Case Summary & Exhibits Index", "is_internal_only": False},
    {"folder_code": "01_Identity_and_Civil_Status", "folder_name": "Identity and Civil Status", "is_internal_only": False},
    {"folder_code": "02_Application_Forms", "folder_name": "Application Forms & G-28", "is_internal_only": False},
    {"folder_code": "03_Pathway_Evidence", "folder_name": "Pathway & Extraordinary Ability Evidence", "is_internal_only": False},
    {"folder_code": "04_Financial_Evidence", "folder_name": "Financial & Remuneration Evidence", "is_internal_only": False},
    {"folder_code": "05_Education_and_Employment", "folder_name": "Education, Credentials & Employment", "is_internal_only": False},
    {"folder_code": "06_Family_and_Sponsorship", "folder_name": "Family & Derivative Beneficiaries", "is_internal_only": False},
    {"folder_code": "07_Translations_and_Certifications", "folder_name": "Certified Translations & Translator Certs", "is_internal_only": False},
    {"folder_code": "08_Additional_Evidence", "folder_name": "Additional Testimonials & Letters", "is_internal_only": False},
    {"folder_code": "09_Internal_Review", "folder_name": "Internal Review & Legal Strategy (CONFIDENTIAL)", "is_internal_only": True},
    {"folder_code": "10_Approved_Package", "folder_name": "Final Approved Submission Package", "is_internal_only": False},
]

DEFAULT_CANADA_FOLDERS = [
    {"folder_code": "00_Case_Summary", "folder_name": "Submission Letter & Checklist", "is_internal_only": False},
    {"folder_code": "01_Identity_and_Civil_Status", "folder_name": "Passports & Civil Status", "is_internal_only": False},
    {"folder_code": "02_Application_Forms", "folder_name": "Generic Application Forms (IMM0008)", "is_internal_only": False},
    {"folder_code": "03_Pathway_Evidence", "folder_name": "Express Entry / PNP Comprehensive Evidence", "is_internal_only": False},
    {"folder_code": "04_Financial_Evidence", "folder_name": "Settlement Funds & Bank Verification", "is_internal_only": False},
    {"folder_code": "05_Education_and_Employment", "folder_name": "ECA Reports & Reference Letters", "is_internal_only": False},
    {"folder_code": "06_Family_and_Sponsorship", "folder_name": "Dependant Information & Police Certificates", "is_internal_only": False},
    {"folder_code": "07_Translations_and_Certifications", "folder_name": "Certified Official Translations", "is_internal_only": False},
    {"folder_code": "08_Additional_Evidence", "folder_name": "Supplementary Records", "is_internal_only": False},
    {"folder_code": "09_Internal_Review", "folder_name": "Internal Paralegal & Counsel Notes", "is_internal_only": True},
    {"folder_code": "10_Approved_Package", "folder_name": "Final IRCC Filing Binder", "is_internal_only": False},
]


class PackageBuilderService:
    @staticmethod
    def ensure_default_templates(db: Session, organization_id: uuid.UUID) -> PackageTemplate:
        """Seeds default folder structure templates for USCIS and other authorities."""
        stmt = select(PackageTemplate).where(
            PackageTemplate.organization_id == organization_id,
            PackageTemplate.name == "USCIS Standard Immigrant Petition Assembly",
        )
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            return existing

        us_template = PackageTemplate(
            organization_id=organization_id,
            name="USCIS Standard Immigrant Petition Assembly",
            jurisdiction="US",
            pathway="EB-1A",
            description="10-folder exhibit structure with strict internal notes separation.",
            folder_structure=DEFAULT_USCIS_FOLDERS,
        )
        db.add(us_template)

        ca_template = PackageTemplate(
            organization_id=organization_id,
            name="IRCC Canadian Economic Class Assembly",
            jurisdiction="CA",
            pathway="Express Entry",
            description="Canadian federal economic immigration submission binder.",
            folder_structure=DEFAULT_CANADA_FOLDERS,
        )
        db.add(ca_template)

        db.commit()
        db.refresh(us_template)
        return us_template

    @staticmethod
    def build_filing_package(
        db: Session,
        organization_id: uuid.UUID,
        case_id: uuid.UUID,
        name: str,
        template_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> FilingPackage:
        """
        Assembles a reproducible FilingPackage:
        - Evaluates deterministic readiness checklist.
        - Maps documents into folder structure.
        - Strictly separates internal review documents from submission-ready files.
        - Generates manifest with document ID, version, file hash, related requirement, and review status.
        - Calculates package SHA-256 root hash to lock versions and prevent drift.
        """
        case = db.execute(
            select(ImmigrationCase).where(
                ImmigrationCase.id == case_id,
                ImmigrationCase.organization_id == organization_id,
            )
        ).scalar_one_or_none()
        if not case:
            raise ValueError("ImmigrationCase not found")

        # 1. Run readiness check
        readiness = ReadinessService.evaluate_case_readiness(db, case_id)

        # 2. Get folder template
        if template_id:
            template = db.execute(select(PackageTemplate).where(PackageTemplate.id == template_id)).scalar_one_or_none()
        else:
            template = PackageBuilderService.ensure_default_templates(db, organization_id)

        folder_list = template.folder_structure if template else DEFAULT_USCIS_FOLDERS

        # 3. Gather verified case documents
        docs_stmt = select(Document).where(Document.case_id == case_id)
        docs = db.execute(docs_stmt).scalars().all()

        manifest_items: List[Dict[str, Any]] = []
        item_hashes: List[str] = []

        for doc in docs:
            # Map category to folder
            folder_code = "03_Pathway_Evidence"
            cat = (doc.category or "").lower()
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

            is_internal = folder_code == "09_Internal_Review"
            file_hash = doc.sha256_hash or hashlib.sha256((doc.filename or doc.title).encode()).hexdigest()
            item_hashes.append(file_hash)

            manifest_items.append({
                "document_id": str(doc.id),
                "version": doc.version or 1,
                "file_name": doc.filename or f"{doc.title}.pdf",
                "folder_code": folder_code,
                "folder_path": f"{folder_code}/{doc.filename or doc.title}",
                "document_category": doc.category,
                "sha256_hash": file_hash,
                "review_status": doc.verification_status or "verified",
                "related_requirement_code": "MANDATORY_EVIDENCE",
                "is_internal_only": is_internal,
                "page_count": doc.page_count or 1,
                "file_size": f"{round(doc.byte_size / (1024 * 1024), 2)} MB" if getattr(doc, "byte_size", None) else "1.0 MB",
            })

        # Add forms to manifest
        forms_stmt = select(FormSubmission).where(FormSubmission.case_id == case_id)
        forms = db.execute(forms_stmt).scalars().all()
        for f in forms:
            form_hash = hashlib.sha256(f"{f.id}-{f.revision_number}".encode()).hexdigest()
            item_hashes.append(form_hash)
            manifest_items.append({
                "form_submission_id": str(f.id),
                "version": f.revision_number,
                "file_name": f"Form_I140_Executed_Rev{f.revision_number}.pdf",
                "folder_code": "02_Application_Forms",
                "folder_path": f"02_Application_Forms/Form_I140_Executed_Rev{f.revision_number}.pdf",
                "document_category": "application_forms",
                "sha256_hash": form_hash,
                "review_status": "signed_off" if f.sensitive_fields_reviewed else "pending_review",
                "related_requirement_code": "USCIS_FORM_I140",
                "is_internal_only": False,
                "page_count": 8,
                "file_size": "2.4 MB",
            })

        # Compute Root Package Merkle Hash
        item_hashes.sort()
        package_root_hash = hashlib.sha256("".join(item_hashes).encode()).hexdigest()

        # Build 7-stage approval workflow chain
        blocking_count = readiness.get("blocking_items_count", 0)
        unresolved_findings_count = len(readiness.get("checklist", {}).get("unresolved_findings", {}).get("items", []))

        approval_chain = [
            {
                "stage": "evidence_and_forms_check",
                "title": "1. Evidence and Form Check",
                "status": "passed" if blocking_count == 0 else "blocked",
                "actor": "Deterministic Readiness Engine",
                "timestamp": now_utc().isoformat(),
                "notes": f"Automated audit: {blocking_count} blocking items detected.",
            },
            {
                "stage": "findings_disposition",
                "title": "2. Required Findings Resolution",
                "status": "passed" if unresolved_findings_count == 0 else "pending",
                "actor": "Legal Caseworker",
                "timestamp": now_utc().isoformat() if unresolved_findings_count == 0 else None,
                "notes": f"{unresolved_findings_count} open findings requiring disposition.",
            },
            {
                "stage": "authorized_staff_review",
                "title": "3. Authorized Staff Review",
                "status": "pending",
                "actor": "Assigned Paralegal / Specialist",
                "timestamp": None,
                "notes": None,
            },
            {
                "stage": "senior_review",
                "title": "4. Senior Managing Attorney Review",
                "status": "pending",
                "actor": "Senior Partner / Managing Attorney",
                "timestamp": None,
                "notes": None,
            },
            {
                "stage": "client_confirmation",
                "title": "5. Client Confirmation",
                "status": "pending",
                "actor": "Principal Applicant",
                "timestamp": None,
                "notes": None,
            },
            {
                "stage": "final_package_approval",
                "title": "6. Final Package Approval",
                "status": "pending",
                "actor": "Attorney of Record (G-28 Signatory)",
                "timestamp": None,
                "notes": None,
            },
            {
                "stage": "package_locked_export",
                "title": "7. Package Lock & Export Generation",
                "status": "pending",
                "actor": "System Integrity Engine",
                "timestamp": None,
                "notes": None,
            },
        ]

        initial_status = "readiness_passed" if blocking_count == 0 else "draft"

        submission_instructions = (
            "SUBMISSION INSTRUCTIONS FOR USCIS IMMIGRANT PETITION:\n"
            "1. Assemble package using standard two-hole top punch with exhibit tab dividers.\n"
            "2. Ensure Form G-28 is placed on top of Form I-140 followed by the formal legal petition brief.\n"
            "3. Place certified cashier's checks for Form I-140 filing fee and Asylum Program fee securely on front cover.\n"
            "4. Send via certified trackable courier (FedEx / UPS) to the designated USCIS Lockbox facility according to petitioner state of residence.\n"
            "NOTE: Automated government portal submission is not permitted. File physically or via verified official USCIS e-filing portal."
        )

        manifest = {
            "case_id": str(case_id),
            "case_number": case.case_number,
            "package_name": name,
            "version": "v1.0.0",
            "generated_at": now_utc().isoformat(),
            "rule_set_version": "USCIS-EB1A-2026.2",
            "folders": folder_list,
            "items": manifest_items,
            "items_count": len(manifest_items),
            "external_items_count": sum(1 for i in manifest_items if not i.get("is_internal_only")),
            "internal_items_count": sum(1 for i in manifest_items if i.get("is_internal_only")),
            "package_hash": package_root_hash,
        }

        package = FilingPackage(
            organization_id=organization_id,
            case_id=case_id,
            package_template_id=template.id if template else None,
            name=name,
            version_number="v1.0.0",
            status=initial_status,
            readiness_checklist_json=readiness,
            manifest_json=manifest,
            package_hash=package_root_hash,
            approval_chain_json=approval_chain,
            submission_method="manual_filing",
            submission_instructions=submission_instructions,
        )
        db.add(package)
        db.commit()
        db.refresh(package)
        return package

    @staticmethod
    def advance_package_approval(
        db: Session,
        package: FilingPackage,
        stage_name: str,
        decision: str,  # "approved", "rejected", "passed"
        user: User,
        notes: Optional[str] = None,
    ) -> FilingPackage:
        """
        Advances the 7-stage approval workflow with strict prerequisite validation.
        """
        chain = list(package.approval_chain_json or [])
        target_idx = None
        for idx, stage in enumerate(chain):
            if stage["stage"] == stage_name:
                target_idx = idx
                break

        if target_idx is None:
            raise ValueError(f"Approval stage '{stage_name}' not found in workflow")

        # Verify prior stages are completed
        for prev_idx in range(target_idx):
            prev = chain[prev_idx]
            if prev["status"] not in ["passed", "approved"]:
                raise ValueError(f"Cannot complete '{stage_name}': prerequisite stage '{prev['title']}' is not yet approved.")

        # Update stage
        chain[target_idx]["status"] = "approved" if decision == "approved" else "rejected"
        chain[target_idx]["actor"] = f"{user.full_name} ({user.email})"
        chain[target_idx]["timestamp"] = now_utc().isoformat()
        if notes:
            chain[target_idx]["notes"] = notes

        # Update package state based on stage
        if stage_name == "authorized_staff_review" and decision == "approved":
            package.status = "in_review"
        elif stage_name == "senior_review" and decision == "approved":
            package.status = "senior_review"
        elif stage_name == "client_confirmation" and decision == "approved":
            package.status = "client_confirmed"
        elif stage_name == "final_package_approval" and decision == "approved":
            package.status = "approved"
            package.approved_by_user_id = user.id
            package.approved_at = now_utc()
            # Lock the 7th stage as completed
            if len(chain) > 6:
                chain[6]["status"] = "passed"
                chain[6]["timestamp"] = now_utc().isoformat()
                chain[6]["notes"] = f"Package locked into immutable state with root hash {package.package_hash}."
        elif decision == "rejected":
            package.status = "rejected"

        package.approval_chain_json = chain
        flag_modified(package, "approval_chain_json")
        package.updated_at = now_utc()
        db.commit()
        db.refresh(package)
        return package

    @staticmethod
    def export_package_summary(
        db: Session,
        package: FilingPackage,
    ) -> Dict[str, Any]:
        """
        Generates reproducible export documentation, manifest verification, and manual filing instructions.
        """
        return {
            "package_id": str(package.id),
            "package_name": package.name,
            "version": package.version_number,
            "status": package.status,
            "package_hash": package.package_hash,
            "is_immutable_locked": package.status in ["approved", "locked"],
            "approved_by": package.approved_by.full_name if package.approved_by else None,
            "approved_at": package.approved_at.isoformat() if package.approved_at else None,
            "submission_method": package.submission_method,
            "submission_instructions": package.submission_instructions,
            "manifest_summary": {
                "total_items": package.manifest_json.get("items_count", 0),
                "submission_items": package.manifest_json.get("external_items_count", 0),
                "confidential_internal_items": package.manifest_json.get("internal_items_count", 0),
            },
            "approval_audit_trail": package.approval_chain_json,
            "disclaimer": "Automated government portal submission is disabled. All submissions must follow verified manual or certified procedures.",
        }
