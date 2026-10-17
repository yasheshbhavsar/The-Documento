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
    CaseAIFinding,
    User,
    RuleSetVersion,
    now_utc,
)
from backend.app.core.errors import (
    EntityNotFoundError,
    TenantIsolationError,
    ValidationError,
)
from backend.app.packages.readiness import ReadinessService
from backend.app.packages.eligibility import (
    PackageEligibilityPolicy,
    evaluate_document_for_package,
    UNRESOLVED_FINDING_STATUSES,
)
from backend.app.packages.local_archive import (
    sanitize_filename,
    normalize_relative_path,
    build_canonical_phase7_manifest,
)

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
    {"folder_code": "01_Cic_Correspondence", "folder_name": "CIC CORRESPONDENCE", "is_internal_only": False},
    {"folder_code": "02_Documents", "folder_name": "DOCUMENTS", "is_internal_only": False},
    {"folder_code": "03_Forms", "folder_name": "FORMS", "is_internal_only": False},
    {"folder_code": "04_Extra", "folder_name": "EXTRA", "is_internal_only": False},
    {"folder_code": "05_Upload", "folder_name": "UPLOAD", "is_internal_only": False},
    {"folder_code": "09_Internal_Review", "folder_name": "INTERNAL CONFIDENTIAL", "is_internal_only": True},
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
        if not existing:
            us_template = PackageTemplate(
                organization_id=organization_id,
                name="USCIS Standard Immigrant Petition Assembly",
                jurisdiction="US",
                pathway="EB-1A",
                description="10-folder exhibit structure with strict internal notes separation.",
                folder_structure=DEFAULT_USCIS_FOLDERS,
            )
            db.add(us_template)
        else:
            us_template = existing

        # Ensure Canada template
        ca_stmt = select(PackageTemplate).where(
            PackageTemplate.organization_id == organization_id,
            PackageTemplate.name == "IRCC Canadian Economic Class Assembly",
        )
        ca_template = db.execute(ca_stmt).scalar_one_or_none()
        if not ca_template:
            ca_template = PackageTemplate(
                organization_id=organization_id,
                name="IRCC Canadian Economic Class Assembly",
                jurisdiction="CA",
                pathway="Express Entry",
                description="Firm-configured Canadian folder template (CIC CORRESPONDENCE, DOCUMENTS, FORMS, EXTRA, UPLOAD).",
                folder_structure=DEFAULT_CANADA_FOLDERS,
            )
            db.add(ca_template)
        else:
            ca_template.folder_structure = DEFAULT_CANADA_FOLDERS
            flag_modified(ca_template, "folder_structure")

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
        explicit_document_ids: Optional[List[uuid.UUID]] = None,
        manual_inclusions: Optional[List[uuid.UUID]] = None,
        manual_exclusions: Optional[List[uuid.UUID]] = None,
        override_notes: Optional[str] = None,
        policy: Optional[PackageEligibilityPolicy] = None,
    ) -> FilingPackage:
        """
        Assembles a reproducible FilingPackage with strict backend eligibility enforcement:
        - Validates tenant isolation and case association for all selections.
        - Evaluates candidate documents across 6 distinct dimensions (readability,
          classification, applicant assignment, consistency, evidentiary sufficiency,
          human verification).
        - Rejects unsafe selections containing unresolved anomalies or blockers,
          even if UI/readiness endpoint is bypassed or explicit IDs are supplied.
        - Pins exact document versions, SHA-256 file hashes, and folder mappings.
        - Preserves case.status invariant: package generation NEVER sets case status to 'submitted'.
        - Generates reproducible Merkle root manifest hash.
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

        initial_case_status = case.status

        # 1. Cross-Tenant and Wrong-Case Validation for explicit selections
        explicit_or_manual_ids = []
        if explicit_document_ids:
            explicit_or_manual_ids.extend(explicit_document_ids)
        if manual_inclusions:
            explicit_or_manual_ids.extend(manual_inclusions)

        for check_id in explicit_or_manual_ids:
            target_doc = db.execute(select(Document).where(Document.id == check_id)).scalar_one_or_none()
            if not target_doc:
                raise EntityNotFoundError("Document", str(check_id))
            if target_doc.organization_id != organization_id:
                raise TenantIsolationError(
                    f"Cross-tenant document access strictly forbidden: document {check_id} does not belong to organization {organization_id}"
                )
            if target_doc.case_id != case_id:
                raise ValidationError(
                    f"Wrong-case document rejected: document {check_id} belongs to case {target_doc.case_id}, not case {case_id}"
                )

        # 2. Run readiness check (pathway-aware)
        readiness = ReadinessService.evaluate_case_readiness(db, case_id)

        # 3. Get folder template (pathway-aware)
        if template_id:
            template = db.execute(select(PackageTemplate).where(PackageTemplate.id == template_id)).scalar_one_or_none()
        else:
            PackageBuilderService.ensure_default_templates(db, organization_id)
            if case.jurisdiction == "CA":
                template = db.execute(
                    select(PackageTemplate).where(
                        PackageTemplate.organization_id == organization_id,
                        PackageTemplate.jurisdiction == "CA",
                    )
                ).scalars().first()
            else:
                template = db.execute(
                    select(PackageTemplate).where(
                        PackageTemplate.organization_id == organization_id,
                        PackageTemplate.jurisdiction == "US",
                    )
                ).scalars().first()

        folder_list = template.folder_structure if template else (
            DEFAULT_CANADA_FOLDERS if case.jurisdiction == "CA" else DEFAULT_USCIS_FOLDERS
        )

        # 4. Gather candidate documents
        if explicit_document_ids:
            # Explicit selection mode
            candidate_docs = [
                db.execute(select(Document).where(Document.id == did)).scalar_one()
                for did in explicit_document_ids
            ]
        else:
            # Default case document assembly
            docs_stmt = select(Document).where(
                Document.case_id == case_id,
                Document.organization_id == organization_id,
            ).order_by(Document.created_at.asc())
            candidate_docs = list(db.execute(docs_stmt).scalars().all())

            # Handle manual inclusions
            if manual_inclusions:
                included_existing_ids = {d.id for d in candidate_docs}
                for inc_id in manual_inclusions:
                    if inc_id not in included_existing_ids:
                        inc_doc = db.execute(select(Document).where(Document.id == inc_id)).scalar_one()
                        candidate_docs.append(inc_doc)

            # Handle manual exclusions
            if manual_exclusions:
                excluded_set = set(manual_exclusions)
                candidate_docs = [d for d in candidate_docs if d.id not in excluded_set]

        # 5. Fetch open findings for case
        findings_stmt = select(CaseAIFinding).where(
            CaseAIFinding.case_id == case_id,
            CaseAIFinding.organization_id == organization_id,
            CaseAIFinding.status.in_(UNRESOLVED_FINDING_STATUSES),
        )
        unresolved_findings = db.execute(findings_stmt).scalars().all()

        manifest_items: List[Dict[str, Any]] = []
        excluded_items: List[Dict[str, Any]] = []
        item_hashes: List[str] = []

        # 6. Evaluate every candidate document independently
        for doc in candidate_docs:
            eligibility = evaluate_document_for_package(
                document=doc,
                case=case,
                policy=policy,
                db=db,
                unresolved_findings=unresolved_findings,
            )

            # Hard blocker rejection if explicitly requested
            if not eligibility.eligible:
                if explicit_document_ids or (manual_inclusions and doc.id in manual_inclusions):
                    blocker_list = ", ".join(eligibility.blockers)
                    raise ValidationError(
                        f"Cannot build package: Unsafe document selection rejected. "
                        f"Document '{doc.filename or doc.title}' ({doc.id}) has blockers: {blocker_list}. "
                        f"Hard blockers cannot be bypassed."
                    )
                # Automatic assembly excludes document and records exact reason
                excluded_items.append({
                    "document_id": str(doc.id),
                    "version": doc.version or 1,
                    "version_id": f"{doc.id}:v{doc.version or 1}",
                    "file_name": doc.filename or f"{doc.title}.pdf",
                    "document_category": doc.category,
                    "sha256_hash": doc.sha256_hash,
                    "blockers": eligibility.blockers,
                    "warnings": eligibility.warnings,
                    "exclusion_reasons": eligibility.exclusion_reasons,
                    "dimensions": eligibility.dimensions,
                })
                continue

            # Detect if using Canada folder configuration
            is_canada_template = any(
                f.get("folder_name") in ["CIC CORRESPONDENCE", "DOCUMENTS", "FORMS", "EXTRA", "UPLOAD"]
                or f.get("folder_code") in ["01_Cic_Correspondence", "02_Documents", "03_Forms", "04_Extra", "05_Upload"]
                for f in folder_list
            )

            # Eligible document: map category to folder
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

            is_internal = folder_code == "09_Internal_Review"
            file_hash = doc.sha256_hash or hashlib.sha256((doc.filename or doc.title).encode()).hexdigest()
            item_hashes.append(file_hash)

            # Resolve folder name and clean filename
            matched_folder = next((f for f in folder_list if f.get("folder_code") == folder_code), None)
            folder_name = matched_folder.get("folder_name") if matched_folder else folder_code
            safe_fn = sanitize_filename(doc.filename or f"{doc.title}.pdf")
            rel_path = f"{folder_name}/{safe_fn}"

            manifest_items.append({
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
                "is_internal_only": is_internal,
                "page_count": doc.page_count or 1,
                "file_size": f"{round(doc.byte_size / (1024 * 1024), 2)} MB" if getattr(doc, "byte_size", None) else "1.0 MB",
                "eligibility_dimensions": {
                    dim: res.get("status") for dim, res in eligibility.dimensions.items()
                },
            })

        # 7. Add case form submissions
        forms_stmt = select(FormSubmission).where(
            FormSubmission.case_id == case_id,
            FormSubmission.organization_id == organization_id,
        )
        forms = db.execute(forms_stmt).scalars().all()
        for f in forms:
            form_code = "GENERIC_IMM" if case.jurisdiction == "CA" else "USCIS_I140"
            if f.schema_version and f.schema_version.schema:
                form_code = f.schema_version.schema.form_code

            # Invariant: Non-US pathways do not inherit US-only forms or instructions
            if case.jurisdiction != "US" and (form_code.startswith("USCIS_") or form_code.startswith("I-") or form_code.startswith("G-")):
                continue

            form_folder_code = "03_Forms" if is_canada_template else "02_Application_Forms"
            matched_folder = next((fld for fld in folder_list if fld.get("folder_code") == form_folder_code), None)
            form_folder_name = matched_folder.get("folder_name") if matched_folder else form_folder_code

            form_hash = hashlib.sha256(f"{f.id}-{f.revision_number}".encode()).hexdigest()
            item_hashes.append(form_hash)
            form_fn = sanitize_filename(f"Form_{form_code}_Executed_Rev{f.revision_number}.pdf")
            manifest_items.append({
                "form_submission_id": str(f.id),
                "version": f.revision_number,
                "version_id": f"{f.id}:v{f.revision_number}",
                "file_name": form_fn,
                "folder_code": form_folder_code,
                "folder_path": f"{form_folder_name}/{form_fn}",
                "document_category": "application_forms",
                "sha256_hash": form_hash,
                "review_status": "HUMAN_VERIFIED" if f.sensitive_fields_reviewed else "pending_review",
                "related_requirement_code": form_code,
                "is_internal_only": False,
                "page_count": 8,
                "file_size": "2.4 MB",
            })

        # 8. Deterministic item sort & Merkle Root Hash calculation
        manifest_items.sort(
            key=lambda i: (
                i.get("folder_code", ""),
                i.get("file_name", ""),
                i.get("document_id") or i.get("form_submission_id", ""),
            )
        )
        excluded_items.sort(
            key=lambda i: (
                i.get("file_name", ""),
                i.get("document_id", ""),
            )
        )

        template_ref = str(template.id) if template and getattr(template, "id", None) else "default"
        merkle_elements = [
            f"policy:{policy.version}",
            f"template:{template_ref}",
            f"jurisdiction:{case.jurisdiction}",
        ] + sorted(item_hashes)
        package_root_hash = hashlib.sha256("\n".join(merkle_elements).encode()).hexdigest()

        # 9. 7-stage approval workflow chain
        blocking_count = readiness.get("blocking_items_count", 0)
        unresolved_findings_count = len(unresolved_findings)

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
                "actor": "Attorney of Record (Signatory)",
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

        # 10. Pathway-aware submission instructions and rule set
        if case.jurisdiction == "CA":
            rule_set_version = "IRCC-EE-2026.1"
            submission_instructions = (
                "SUBMISSION INSTRUCTIONS FOR IRCC CANADIAN IMMIGRATION:\n"
                "1. Assemble submission package per IRCC document checklist order.\n"
                "2. Ensure all certified translations include translator affidavits and certified true copies.\n"
                "3. Upload via authorized IRCC Authorized Representative portal or file per provincial program instructions.\n"
                "NOTE: Automated government portal submission is not permitted. File per official IRCC procedures."
            )
        elif case.jurisdiction == "GB":
            rule_set_version = "UKVI-SWV-2026.1"
            submission_instructions = (
                "SUBMISSION INSTRUCTIONS FOR UKVI IMMIGRATION APPLICATION:\n"
                "1. Upload supporting documents to commercial partner portal (VFS Global / TLScontact).\n"
                "2. Retain original identity documents for physical biometric appointment.\n"
                "NOTE: Automated government portal submission is disabled."
            )
        else:
            rule_set_version = "USCIS-EB1A-2026.2"
            submission_instructions = (
                "SUBMISSION INSTRUCTIONS FOR USCIS IMMIGRANT PETITION:\n"
                "1. Assemble package using standard two-hole top punch with exhibit tab dividers.\n"
                "2. Ensure Form G-28 is placed on top of Form I-140 followed by the formal legal petition brief.\n"
                "3. Place certified cashier's checks for Form I-140 filing fee and Asylum Program fee securely on front cover.\n"
                "4. Send via certified trackable courier (FedEx / UPS) to the designated USCIS Lockbox facility according to petitioner state of residence.\n"
                "NOTE: Automated government portal submission is not permitted. File physically or via verified official USCIS e-filing portal."
            )

        # Build canonical Phase 7 manifest
        phase7_manifest = build_canonical_phase7_manifest(
            case_reference=case.case_number or f"CASE-{case.id}",
            generated_by=str(user_id) if user_id else "SYSTEM",
            package_template_version="v1.0.0",
            checklist_rule_version=rule_set_version,
            included_documents=manifest_items,
            excluded_documents=excluded_items,
        )

        manifest = {
            "case_id": str(case_id),
            "case_number": case.case_number,
            "package_name": name,
            "version": "v1.0.0",
            "generated_at": now_utc().isoformat(),
            "rule_set_version": rule_set_version,
            "policy_version": policy.version,
            "folders": folder_list,
            "items": manifest_items,
            "excluded_items": excluded_items,
            "items_count": len(manifest_items),
            "excluded_count": len(excluded_items),
            "external_items_count": sum(1 for i in manifest_items if not i.get("is_internal_only")),
            "internal_items_count": sum(1 for i in manifest_items if i.get("is_internal_only")),
            "package_hash": package_root_hash,
            "phase7_manifest": phase7_manifest,
            "compliance_notice": (
                "Evaluation performed strictly against internal statutory compliance and evidence sufficiency criteria. "
                "Probability of approval is never generated or displayed. "
                "No legal advice is provided or implied."
            ),
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

        # STRICT INVARIANT: Package generation never alters case.status to 'submitted'
        assert case.status != "submitted" or initial_case_status == "submitted", "Case status must never be mutated to submitted"
        case.status = initial_case_status

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


# Aliases for architectural flexibility and builder callers
PackageBuilder = PackageBuilderService
PackageBuilderService.generate_filing_package = PackageBuilderService.build_filing_package

