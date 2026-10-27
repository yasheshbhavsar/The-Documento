import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.domain.models import (
    FormSchema,
    FormSchemaVersion,
    FormSubmission,
    ImmigrationCase,
    ClientProfile,
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    User,
    now_utc,
)
from backend.app.ai.comparators import (
    compare_dates_of_birth,
    compare_document_numbers,
    compare_names,
)

# Standard Seed Schemas
from backend.app.forms.schemas_catalog import DOS_DS160_SCHEMA, IRCC_IMM5257_SCHEMA

USCIS_I140_SCHEMA = {
    "sections": [
        {
            "id": "part1_petitioner",
            "title": "Part 1. Information About the Person or Organization Filing This Petition",
            "description": "Petitioner identifying and contact information.",
            "fields": [
                {
                    "key": "petitioner_is_self",
                    "label": "Is the beneficiary self-petitioning?",
                    "field_type": "boolean",
                    "required": True,
                    "default": True,
                    "source_mapping_hint": "case.is_self_petition",
                },
                {
                    "key": "petitioner_family_name",
                    "label": "Family Name (Last Name)",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "profile.last_name",
                },
                {
                    "key": "petitioner_given_name",
                    "label": "Given Name (First Name)",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "profile.first_name",
                },
                {
                    "key": "petitioner_company_name",
                    "label": "Company or Organization Name (if petitioning organization)",
                    "field_type": "text",
                    "required": False,
                    "conditional": {
                        "depends_on_field": "petitioner_is_self",
                        "operator": "equals",
                        "expected_value": False,
                    },
                },
                {
                    "key": "petitioner_email",
                    "label": "Primary Contact Email Address",
                    "field_type": "text",
                    "required": True,
                    "validation_rules": {"regex": r"^[^@\s]+@[^@\s]+\.[^@\s]+$"},
                    "source_mapping_hint": "profile.email",
                },
            ],
        },
        {
            "id": "part2_petition_type",
            "title": "Part 2. Petition Type & Classification",
            "description": "Select the statutory immigrant classification being sought.",
            "fields": [
                {
                    "key": "visa_classification",
                    "label": "Requested Immigrant Classification",
                    "field_type": "select",
                    "required": True,
                    "options": [
                        {"value": "EB1A_EXTRAORDINARY", "label": "Alien of Extraordinary Ability (INA § 203(b)(1)(A))"},
                        {"value": "EB1B_PROFESSOR", "label": "Outstanding Professor or Researcher (INA § 203(b)(1)(B))"},
                        {"value": "EB1C_MANAGER", "label": "Multinational Executive or Manager (INA § 203(b)(1)(C))"},
                        {"value": "EB2_NIW", "label": "Member of Professions with Advanced Degree / NIW (INA § 203(b)(2))"},
                    ],
                    "default": "EB1A_EXTRAORDINARY",
                    "source_mapping_hint": "case.visa_category",
                },
            ],
        },
        {
            "id": "part3_beneficiary_bio",
            "title": "Part 3. Information About the Alien (Beneficiary)",
            "description": "Biographical data and identity identifiers matching passport.",
            "fields": [
                {
                    "key": "beneficiary_family_name",
                    "label": "Beneficiary Family Name (Last Name)",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "profile.last_name",
                },
                {
                    "key": "beneficiary_given_name",
                    "label": "Beneficiary Given Name (First Name)",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "profile.first_name",
                },
                {
                    "key": "beneficiary_dob",
                    "label": "Date of Birth (YYYY-MM-DD)",
                    "field_type": "date",
                    "required": True,
                    "source_mapping_hint": "profile.date_of_birth",
                },
                {
                    "key": "beneficiary_country_of_birth",
                    "label": "Country of Birth",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "profile.nationality",
                },
                {
                    "key": "beneficiary_country_of_citizenship",
                    "label": "Country of Citizenship or Nationality",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "profile.nationality",
                },
                {
                    "key": "beneficiary_alien_number",
                    "label": "Alien Registration Number (A-Number, if any)",
                    "field_type": "alien_number",
                    "required": False,
                    "is_sensitive": True,
                    "validation_rules": {"regex": r"^(A\d{9}|)$"},
                    "source_mapping_hint": "doc.ocr.alien_number",
                },
                {
                    "key": "beneficiary_ssn",
                    "label": "U.S. Social Security Number (if any)",
                    "field_type": "ssn",
                    "required": False,
                    "is_sensitive": True,
                    "validation_rules": {"regex": r"^(\d{3}-\d{2}-\d{4}|)$"},
                    "source_mapping_hint": "doc.ocr.ssn",
                },
                {
                    "key": "beneficiary_passport_number",
                    "label": "Current Passport Number",
                    "field_type": "passport",
                    "required": True,
                    "is_sensitive": True,
                    "source_mapping_hint": "doc.ocr.passport_number",
                },
            ],
        },
        {
            "id": "part4_endeavor",
            "title": "Part 4. Processing Information & Proposed Endeavor",
            "description": "Details of the qualifying professional endeavor in the United States.",
            "fields": [
                {
                    "key": "proposed_occupation",
                    "label": "Job Title / Professional Endeavor Description",
                    "field_type": "text",
                    "required": True,
                    "source_mapping_hint": "case.title",
                },
                {
                    "key": "soc_code",
                    "label": "Standard Occupational Classification (SOC) Code",
                    "field_type": "text",
                    "required": False,
                    "validation_rules": {"regex": r"^(\d{2}-\d{4}|)$"},
                },
                {
                    "key": "prior_removal_proceedings",
                    "label": "Has the beneficiary ever been in removal, exclusion, or deportation proceedings?",
                    "field_type": "boolean",
                    "required": True,
                    "default": False,
                    "is_sensitive": True,
                },
                {
                    "key": "prior_removal_explanation",
                    "label": "If yes, explain circumstances and dates of proceedings:",
                    "field_type": "textarea",
                    "required": True,
                    "is_sensitive": True,
                    "conditional": {
                        "depends_on_field": "prior_removal_proceedings",
                        "operator": "equals",
                        "expected_value": True,
                    },
                },
            ],
        },
    ]
}


class FormService:
    @staticmethod
    def ensure_default_schemas(db: Session, organization_id: uuid.UUID) -> FormSchema:
        """Seeds standard versioned form schemas (USCIS I-140, DOS DS-160, IRCC IMM 5257, IMM 1294, IMM 5710) for the organization."""
        from backend.app.forms.schemas_catalog import (
            DOS_DS160_SCHEMA,
            IRCC_IMM5257_SCHEMA,
            IRCC_IMM1294_SCHEMA,
            IRCC_IMM5710_SCHEMA,
        )

        seed_configs = [
            {
                "form_code": "USCIS_I140",
                "name": "Immigrant Petition for Alien Worker (Form I-140)",
                "jurisdiction": "US",
                "pathway": "EB-1A",
                "edition_date": "04/01/24",
                "version_number": "v2026.1",
                "schema_json": USCIS_I140_SCHEMA,
            },
            {
                "form_code": "DOS_DS160",
                "name": "Online Nonimmigrant Visa Application (Form DS-160)",
                "jurisdiction": "US",
                "pathway": "ALL",
                "edition_date": "10/01/25",
                "version_number": "v2026.1",
                "schema_json": DOS_DS160_SCHEMA,
            },
            {
                "form_code": "IRCC_IMM5257",
                "name": "Application for Visitor Visa (Form IMM 5257)",
                "jurisdiction": "CA",
                "pathway": "TRV",
                "edition_date": "11/2025",
                "version_number": "v2026.1",
                "schema_json": IRCC_IMM5257_SCHEMA,
            },
            {
                "form_code": "IRCC_IMM1294",
                "name": "Application for Study Permit Made Outside of Canada (Form IMM 1294)",
                "jurisdiction": "CA",
                "pathway": "STUDY_PERMIT",
                "edition_date": "02/2026",
                "version_number": "v2026.1",
                "schema_json": IRCC_IMM1294_SCHEMA,
            },
            {
                "form_code": "IRCC_IMM5710",
                "name": "Application to Change Conditions or Extend Stay as a Worker / SOWP (Form IMM 5710)",
                "jurisdiction": "CA",
                "pathway": "WORK_PERMIT_SOWP",
                "edition_date": "01/2026",
                "version_number": "v2026.1",
                "schema_json": IRCC_IMM5710_SCHEMA,
            },
        ]

        primary_schema = None
        for cfg in seed_configs:
            stmt = select(FormSchema).where(
                FormSchema.organization_id == organization_id,
                FormSchema.form_code == cfg["form_code"],
            )
            existing = db.execute(stmt).scalar_one_or_none()
            if not existing:
                schema = FormSchema(
                    organization_id=organization_id,
                    form_code=cfg["form_code"],
                    name=cfg["name"],
                    jurisdiction=cfg["jurisdiction"],
                    pathway=cfg["pathway"],
                    edition_date=cfg["edition_date"],
                    status="active",
                )
                db.add(schema)
                db.flush()

                version = FormSchemaVersion(
                    schema_id=schema.id,
                    version_number=cfg["version_number"],
                    schema_json=cfg["schema_json"],
                    is_active=True,
                    published_at=now_utc(),
                )
                db.add(version)
                if not primary_schema:
                    primary_schema = schema
            else:
                if not primary_schema:
                    primary_schema = existing

        db.commit()
        if primary_schema:
            db.refresh(primary_schema)
        return primary_schema


    @staticmethod
    def _create_form_conflict_finding(
        db: Session,
        organization_id: uuid.UUID,
        case: ImmigrationCase,
        field_key: str,
        field_label: str,
        candidates: List[Dict[str, Any]],
        disparate_str: str,
    ) -> CaseAIFinding:
        """Records a statutory form conflict finding when disparate documents provide conflicting values."""
        existing = db.execute(
            select(CaseAIFinding).where(
                CaseAIFinding.case_id == case.id,
                CaseAIFinding.finding_type == "form_conflict",
                CaseAIFinding.status == "needs_review",
            )
        ).scalars().all()
        for ef in existing:
            if field_key in (ef.related_fields or []):
                return ef

        related_docs = [
            {
                "id": c.get("doc_id"),
                "title": c.get("doc_title", "Document"),
                "page": c.get("page", 1),
                "value": c.get("val"),
            }
            for c in candidates
            if c.get("doc_id")
        ]
        is_crit = any(k in field_key.lower() for k in ["passport", "dob", "birth", "alien", "ssn", "identity"])
        doc_id = None
        if candidates and candidates[0].get("doc_id"):
            try:
                doc_id = uuid.UUID(str(candidates[0]["doc_id"]))
            except (ValueError, TypeError):
                doc_id = None

        finding = CaseAIFinding(
            organization_id=organization_id,
            case_id=case.id,
            document_id=doc_id,
            finding_type="form_conflict",
            severity="critical" if is_crit else "major",
            status="needs_review",
            title=f"Form Conflict: Disparate {field_label} Across Documents",
            description=(
                f"Multiple evidentiary documents in case {case.case_number} extract conflicting values for "
                f"'{field_label}' ({field_key}): {disparate_str}. "
                f"In accordance with Master Vision anti-hallucination policy (§4.7), Documento has abstained "
                f"from auto-populating this statutory form field. Qualified counsel must review source records and "
                f"determine the controlling value."
            ),
            evidence_text=" | ".join(f"{c.get('doc_title', 'Record')} (p.{c.get('page', 1)}): '{c.get('val')}'" for c in candidates),
            source_location={"field_key": field_key, "candidates": candidates},
            related_documents=related_docs,
            related_fields=[field_key],
            relevant_requirement="8 CFR § 103.2(b)(1) & Statutory Form Evidentiary Consistency",
            recommended_action=f"Inspect original documents, verify which record is legally controlling, and manually confirm the {field_label} in the form editor.",
            clarification_question=f"Which document contains the accurate {field_label} for government submission?",
            uncertainty_limitations="Automated mapping detected conflicting evidentiary records. Qualified counsel must determine the controlling record.",
            is_confirmed_contradiction=True,
            confidence_score=0.99,
        )
        db.add(finding)
        return finding

    @staticmethod
    def populate_form_draft(
        db: Session,
        organization_id: uuid.UUID,
        case_id: uuid.UUID,
        schema_version_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
    ) -> FormSubmission:
        """
        Creates a new FormSubmission pre-populated only from authorized, available information.
        Every populated value retains its physical source provenance (document ID, physical page, confidence).
        AI-generated or auto-populated draft values strictly retain is_confirmed = False.
        When multiple documents produce conflicting values for a mapped field, the system NEVER guesses:
        it sets has_conflict = True, records candidate provenance, leaves the field unpopulated/unconfirmed,
        and logs a form_conflict finding requiring attorney qualification.
        """
        case = db.execute(
            select(ImmigrationCase).where(
                ImmigrationCase.id == case_id,
                ImmigrationCase.organization_id == organization_id,
            )
        ).scalar_one_or_none()
        if not case:
            raise ValueError("ImmigrationCase not found")

        schema_ver = db.execute(
            select(FormSchemaVersion).where(FormSchemaVersion.id == schema_version_id)
        ).scalar_one_or_none()
        if not schema_ver:
            raise ValueError("FormSchemaVersion not found")

        client = case.client
        schema_def = schema_ver.schema_json or {}
        sections = schema_def.get("sections", [])

        # Fetch verified OCR extracted fields for this case to provide document provenance
        ocr_stmt = (
            select(DocumentExtractedField, Document)
            .join(Document, DocumentExtractedField.document_id == Document.id)
            .where(
                Document.case_id == case_id,
                DocumentExtractedField.validation_status.in_(["valid", "verified", "corrected"]),
            )
            .order_by(Document.created_at.asc(), DocumentExtractedField.created_at.asc())
        )
        ocr_results = db.execute(ocr_stmt).all()

        # Group OCR candidates by canonical field name
        ocr_candidates: Dict[str, List[Dict[str, Any]]] = {}
        for field, doc in ocr_results:
            raw_val = field.normalized_value or field.original_value or ""
            val = str(raw_val).strip()
            if not val:
                continue
            canonical_name = field.field_name
            candidate_item = {
                "val": val,
                "doc_id": str(doc.id),
                "doc_title": doc.title,
                "doc_version": getattr(doc, "version", 1),
                "page": field.source_page or 1,
                "location": field.source_location,
                "confidence": field.extraction_confidence or field.ocr_confidence or 0.95,
                "extraction_method": field.extraction_method or "native_pdf_text",
                "field_id": str(field.id),
            }
            ocr_candidates.setdefault(canonical_name, []).append(candidate_item)
            # Aliasing for standard schema field variations
            if canonical_name in ("passport_number", "document_number"):
                ocr_candidates.setdefault("passport_number", []).append(candidate_item)
            if canonical_name in ("expiry_date", "passport_expiry_date", "passport_expiry"):
                ocr_candidates.setdefault("expiry_date", []).append(candidate_item)
            if canonical_name in ("issue_date", "passport_issue_date"):
                ocr_candidates.setdefault("issue_date", []).append(candidate_item)
            if canonical_name in ("alien_number", "a_number", "beneficiary_alien_number"):
                ocr_candidates.setdefault("alien_number", []).append(candidate_item)
            if canonical_name in ("ssn", "beneficiary_ssn"):
                ocr_candidates.setdefault("ssn", []).append(candidate_item)

        answers: Dict[str, Any] = {}
        total_fields = 0
        filled_fields = 0
        has_unconfirmed = False

        for section in sections:
            for f in section.get("fields", []):
                total_fields += 1
                key = f["key"]
                label = f.get("label", key)
                hint = f.get("source_mapping_hint", "")
                val = None
                source_type = "user_provided"
                source_id = None
                source_label = "Awaiting User Input"
                source_document_id = None
                source_page = None
                source_location = None
                extraction_confidence = None
                is_confirmed = False
                has_conflict = False
                conflicting_candidates = None
                conflict_reason = None

                # 1. Map from ClientProfile
                if (hint == "profile.first_name" or (not hint and key in ("beneficiary_given_name", "petitioner_given_name", "given_name", "given_names", "first_name"))) and client:
                    val = client.first_name
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = f"Client Profile (ID: {client.id})"
                    is_confirmed = True

                elif (hint == "profile.last_name" or (not hint and key in ("beneficiary_family_name", "petitioner_family_name", "family_name", "surname", "last_name"))) and client:
                    val = client.last_name
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = f"Client Profile (ID: {client.id})"
                    is_confirmed = True

                elif (hint == "profile.email" or (not hint and key in ("petitioner_email", "email", "client_email"))) and client:
                    val = client.email
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = "Client Profile Primary Email"
                    is_confirmed = True

                elif (hint == "profile.phone" or (not hint and key in ("phone", "phone_number", "contact_phone"))) and client and client.phone:
                    val = client.phone
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = "Client Profile Phone Record"
                    is_confirmed = True

                elif (hint == "profile.nationality" or (not hint and key in ("beneficiary_country_of_birth", "beneficiary_country_of_citizenship", "country_of_birth", "nationality", "citizenship", "country_of_issue", "passport_issuing_country", "place_of_birth_country", "current_residence_country"))) and client:
                    val = client.nationality
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = "Client Nationality Record"
                    is_confirmed = True

                elif (hint == "profile.pan_number" or (not hint and key in ("national_id_number", "pan_number"))) and client and (client.pan_number or client.aadhaar_number_masked):
                    val = client.pan_number or client.aadhaar_number_masked
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = "Client Civil ID Record"
                    is_confirmed = True

                elif (hint == "profile.date_of_birth" or (not hint and key in ("beneficiary_dob", "dob", "date_of_birth"))) and client:
                    client_dob = client.date_of_birth.strftime("%Y-%m-%d") if client.date_of_birth else None
                    dob_candidates = ocr_candidates.get("date_of_birth", [])
                    # Check for discrepancies between intake record and extracted passport/identity DOB
                    conflicts = []
                    if client_dob and dob_candidates:
                        for cand in dob_candidates:
                            cmp_res = compare_dates_of_birth(client_dob, cand["val"])
                            if not cmp_res.is_concordant:
                                conflicts.append(cand)
                    if conflicts:
                        has_conflict = True
                        has_unconfirmed = True
                        is_confirmed = False
                        val = None  # Never guess between intake and conflicting document
                        source_type = "document_ocr"
                        source_label = f"Conflict: Intake DOB ({client_dob}) vs Document OCR"
                        conflicting_candidates = [{"source": "client_profile", "val": client_dob, "doc_title": "Civil Intake Record", "page": 1}] + conflicts
                        conflict_reason = f"Intake record date of birth '{client_dob}' conflicts with extracted DOB '{conflicts[0]['val']}' in {conflicts[0]['doc_title']}."
                        FormService._create_form_conflict_finding(
                            db=db,
                            organization_id=organization_id,
                            case=case,
                            field_key=key,
                            field_label=label,
                            candidates=conflicting_candidates,
                            disparate_str=f"'{client_dob}' (Intake) vs '{conflicts[0]['val']}' ({conflicts[0]['doc_title']})",
                        )
                    elif client_dob:
                        val = client_dob
                        source_type = "client_profile"
                        source_id = str(client.id)
                        source_label = f"Client Civil DOB Record (Corroborated by {dob_candidates[0]['doc_title']})" if dob_candidates else "Client Civil DOB Record"
                        is_confirmed = True

                # 2. Map from ImmigrationCase
                elif hint == "case.visa_category" or (not hint and key in ("visa_classification", "purpose_of_trip")):
                    val = "EB1A_EXTRAORDINARY" if "EB-1A" in case.visa_category else case.visa_category
                    source_type = "client_profile"
                    source_id = str(case.id)
                    source_label = f"Case {case.case_number} Category"
                    is_confirmed = True

                elif hint == "case.is_self_petition" or (not hint and key == "petitioner_is_self"):
                    val = True
                    source_type = "client_profile"
                    source_id = str(case.id)
                    source_label = "Case Filing Structure"
                    is_confirmed = True

                elif hint == "case.title" or (not hint and key in ("proposed_occupation", "proposed_endeavor_summary")):
                    val = case.title
                    source_type = "ai_generated"
                    source_id = str(case.id)
                    source_label = "AI Extracted Proposed Endeavor (Draft)"
                    is_confirmed = False  # AI generated draft must remain unconfirmed
                    has_unconfirmed = True

                # 3. Map from Document OCR (with Multi-Document Conflict Detection)
                else:
                    canonical_key = None
                    if hint == "doc.ocr.passport_number" or key in ("beneficiary_passport_number", "passport_number"):
                        canonical_key = "passport_number"
                    elif hint == "doc.ocr.alien_number" or key in ("beneficiary_alien_number", "alien_number"):
                        canonical_key = "alien_number"
                    elif hint == "doc.ocr.ssn" or key in ("beneficiary_ssn", "ssn"):
                        canonical_key = "ssn"
                    elif hint in ("doc.ocr.expiry_date", "doc.ocr.passport_expiry_date") or key in ("passport_expiry", "passport_expiry_date"):
                        canonical_key = "expiry_date"
                    elif hint in ("doc.ocr.issue_date", "doc.ocr.passport_issue_date") or key in ("passport_issue_date",):
                        canonical_key = "issue_date"

                    if canonical_key and canonical_key in ocr_candidates:
                        raw_cands = ocr_candidates[canonical_key]
                        # Deduplicate candidates by unique field_id
                        seen_fids = set()
                        unique_cands = []
                        for c in raw_cands:
                            if c["field_id"] not in seen_fids:
                                seen_fids.add(c["field_id"])
                                unique_cands.append(c)

                        # Group by normalized value
                        norm_groups: Dict[str, List[Dict[str, Any]]] = {}
                        for c in unique_cands:
                            nv = c["val"].strip().upper() if canonical_key in ("passport_number", "alien_number", "ssn") else c["val"].strip()
                            norm_groups.setdefault(nv, []).append(c)

                        if len(norm_groups) > 1:
                            # MULTI-DOCUMENT CONFLICT DETECTED
                            has_conflict = True
                            has_unconfirmed = True
                            is_confirmed = False
                            val = None  # Never guess or silently pick one!
                            source_type = "document_ocr"
                            source_label = f"Conflict: {len(unique_cands)} documents provide disparate values"
                            conflicting_candidates = unique_cands
                            disparate_str = ", ".join(f"'{v}' ({len(docs)} doc)" for v, docs in norm_groups.items())
                            conflict_reason = (
                                f"Disparate values extracted across documents: {disparate_str}. "
                                f"Documento abstains from auto-populating without attorney qualification."
                            )
                            FormService._create_form_conflict_finding(
                                db=db,
                                organization_id=organization_id,
                                case=case,
                                field_key=key,
                                field_label=label,
                                candidates=unique_cands,
                                disparate_str=disparate_str,
                            )
                        elif len(norm_groups) == 1:
                            # Single concordant value across all documents
                            best_cand = unique_cands[0]
                            val = best_cand["val"]
                            has_conflict = False
                            source_type = "document_ocr"
                            source_id = best_cand["doc_id"]
                            source_label = f"Verified OCR: {best_cand['doc_title']}"
                            source_document_id = best_cand["doc_id"]
                            source_page = best_cand["page"]
                            source_location = best_cand["location"]
                            extraction_confidence = best_cand["confidence"]
                            is_confirmed = False  # OCR field must be human confirmed in form
                            has_unconfirmed = True

                    elif "default" in f:
                        val = f["default"]
                        source_type = "user_provided"
                        source_label = "Default Schema Value"
                        is_confirmed = True

                if val is not None and str(val).strip() != "":
                    filled_fields += 1

                answers[key] = {
                    "value": val,
                    "source_type": source_type,
                    "source_id": source_id,
                    "source_label": source_label,
                    "is_confirmed": is_confirmed,
                    "confirmed_by_user_id": str(user_id) if is_confirmed and user_id else None,
                    "confirmed_at": now_utc().isoformat() if is_confirmed else None,
                    "source_document_id": source_document_id,
                    "source_page": source_page,
                    "source_location": source_location,
                    "extraction_confidence": extraction_confidence,
                    "has_conflict": has_conflict,
                    "conflicting_candidates": conflicting_candidates if has_conflict else None,
                    "conflict_reason": conflict_reason if has_conflict else None,
                }

        completion = round((filled_fields / max(1, total_fields)) * 100, 1)

        submission = FormSubmission(
            organization_id=organization_id,
            case_id=case_id,
            form_schema_version_id=schema_version_id,
            status="draft",
            answers_json=answers,
            completion_percentage=completion,
            has_unconfirmed_ai_fields=has_unconfirmed,
            sensitive_fields_reviewed=False,
            revision_number=1,
            revision_history=[
                {
                    "revision": 1,
                    "updated_by": str(user_id) if user_id else "system_auto_population",
                    "timestamp": now_utc().isoformat(),
                    "changes_summary": "Initial draft population from authorized client profile & verified OCR fields.",
                }
            ],
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def update_submission_answers(
        db: Session,
        submission: FormSubmission,
        answer_updates: Dict[str, Any],
        user: User,
        notes: Optional[str] = None,
    ) -> FormSubmission:
        """
        Updates answers for a form submission, validating types and logging revision history.
        User-entered modifications are tagged source_type='user_provided' and is_confirmed=True.
        Manual overrides automatically resolve any corresponding form_conflict finding.
        """
        current_answers = dict(submission.answers_json or {})
        changed_keys = []

        schema_ver = submission.schema_version
        schema_def = schema_ver.schema_json or {}
        fields_by_key = {}
        for sec in schema_def.get("sections", []):
            for f in sec.get("fields", []):
                fields_by_key[f["key"]] = f

        for key, new_val in answer_updates.items():
            field_def = fields_by_key.get(key)
            if not field_def:
                continue

            # Validation checks
            regex_rule = field_def.get("validation_rules", {}).get("regex")
            if regex_rule and new_val is not None and str(new_val).strip() != "":
                if not re.match(regex_rule, str(new_val)):
                    raise ValueError(f"Field '{field_def['label']}' failed format validation.")

            # Date format validation
            if field_def.get("field_type") == "date" and new_val is not None and str(new_val).strip() != "":
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(new_val).strip()):
                    raise ValueError(f"Field '{field_def['label']}' must be in YYYY-MM-DD date format.")

            # Select option validation
            if field_def.get("field_type") == "select" and field_def.get("options") and new_val is not None:
                allowed_vals = [opt["value"] for opt in field_def["options"]]
                if new_val not in allowed_vals:
                    raise ValueError(f"Field '{field_def['label']}' value '{new_val}' is not one of allowed options: {', '.join(allowed_vals)}")

            existing_record = current_answers.get(key, {})
            was_conflicted = existing_record.get("has_conflict", False)

            current_answers[key] = {
                "value": new_val,
                "source_type": "user_provided",
                "source_id": str(user.id),
                "source_label": f"Edited by {user.full_name}",
                "is_confirmed": True,
                "confirmed_by_user_id": str(user.id),
                "confirmed_at": now_utc().isoformat(),
                "has_conflict": False,
                "conflict_resolved": was_conflicted,
            }
            changed_keys.append(key)

            # Auto-resolve any form_conflict finding for this case and field
            conflict_findings = db.execute(
                select(CaseAIFinding).where(
                    CaseAIFinding.case_id == submission.case_id,
                    CaseAIFinding.finding_type == "form_conflict",
                    CaseAIFinding.status == "needs_review",
                )
            ).scalars().all()
            for cf in conflict_findings:
                if key in (cf.related_fields or []):
                    cf.status = "resolved"
                    cf.resolution_action = "resolve"
                    cf.resolution_reason = notes or f"Attorney override: manually set to '{new_val}' by {user.full_name}"
                    cf.resolved_at = now_utc()
                    cf.reviewer_id = user.id
                    history = list(cf.resolution_history or [])
                    history.append({
                        "action": "resolved",
                        "by": user.full_name,
                        "timestamp": now_utc().isoformat(),
                        "reason": notes or f"Field '{key}' overridden in form submission revision {submission.revision_number + 1}",
                    })
                    cf.resolution_history = history

        # Check if any unconfirmed AI fields or unresolved conflicts remain
        has_unconfirmed = any(
            not rec.get("is_confirmed", False)
            for rec in current_answers.values()
            if rec.get("value") is not None or rec.get("has_conflict", False)
        )

        total_fields = len(fields_by_key)
        filled_count = sum(1 for rec in current_answers.values() if rec.get("value") is not None and str(rec.get("value")).strip() != "")
        completion = round((filled_count / max(1, total_fields)) * 100, 1)

        new_rev_number = submission.revision_number + 1
        history = list(submission.revision_history or [])
        history.append({
            "revision": new_rev_number,
            "updated_by": user.full_name,
            "user_id": str(user.id),
            "timestamp": now_utc().isoformat(),
            "changes_summary": notes or f"Updated {len(changed_keys)} fields: {', '.join(changed_keys[:5])}",
            "changed_fields": changed_keys,
        })

        submission.answers_json = current_answers
        submission.completion_percentage = completion
        submission.has_unconfirmed_ai_fields = has_unconfirmed
        submission.revision_number = new_rev_number
        submission.revision_history = history
        submission.updated_at = now_utc()

        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def confirm_field_answer(
        db: Session,
        submission: FormSubmission,
        field_key: str,
        user: User,
    ) -> FormSubmission:
        """Confirms an individual draft/AI-populated field answer."""
        current_answers = dict(submission.answers_json or {})
        if field_key not in current_answers:
            raise ValueError(f"Field '{field_key}' not found in submission answers")

        record = dict(current_answers[field_key])
        if record.get("has_conflict") and record.get("value") is None:
            raise ValueError(f"Field '{field_key}' has unresolved document conflicts. Please set the confirmed value before confirming.")

        record["is_confirmed"] = True
        record["has_conflict"] = False
        record["confirmed_by_user_id"] = str(user.id)
        record["confirmed_at"] = now_utc().isoformat()
        current_answers[field_key] = record

        # Resolve any associated form_conflict finding
        conflict_findings = db.execute(
            select(CaseAIFinding).where(
                CaseAIFinding.case_id == submission.case_id,
                CaseAIFinding.finding_type == "form_conflict",
                CaseAIFinding.status == "needs_review",
            )
        ).scalars().all()
        for cf in conflict_findings:
            if field_key in (cf.related_fields or []):
                cf.status = "resolved"
                cf.resolution_action = "resolve"
                cf.resolution_reason = f"Draft value confirmed by {user.full_name}"
                cf.resolved_at = now_utc()
                cf.reviewer_id = user.id

        has_unconfirmed = any(
            not rec.get("is_confirmed", False)
            for rec in current_answers.values()
            if rec.get("value") is not None or rec.get("has_conflict", False)
        )

        submission.answers_json = current_answers
        submission.has_unconfirmed_ai_fields = has_unconfirmed
        submission.updated_at = now_utc()
        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def review_sensitive_fields(
        db: Session,
        submission: FormSubmission,
        user: User,
        notes: str,
    ) -> FormSubmission:
        """Signoff designated for high-risk sensitive fields."""
        submission.sensitive_fields_reviewed = True
        submission.reviewer_user_id = user.id
        submission.reviewed_at = now_utc()
        submission.reviewer_notes = notes

        # Append to revision history
        history = list(submission.revision_history or [])
        history.append({
            "revision": submission.revision_number,
            "updated_by": user.full_name,
            "user_id": str(user.id),
            "timestamp": now_utc().isoformat(),
            "changes_summary": f"Designated sensitive fields review certified: {notes}",
        })
        submission.revision_history = history
        submission.updated_at = now_utc()
        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def finalize_submission(
        db: Session,
        submission: FormSubmission,
        user: User,
        target_status: str = "confirmed",
    ) -> FormSubmission:
        """
        Validates all filing-readiness criteria and locks the form submission.
        Blocks if required fields are missing, unconfirmed AI fields remain, sensitive fields are unreviewed,
        or unresolved multi-document conflicts persist.
        """
        blockers = []

        # Check required fields based on schema definition
        schema_ver = submission.schema_version
        schema_def = schema_ver.schema_json or {}
        answers = submission.answers_json or {}
        missing_required = []

        for sec in schema_def.get("sections", []):
            for f in sec.get("fields", []):
                if f.get("required", False):
                    # Check conditional visibility
                    cond = f.get("conditional")
                    if cond:
                        dep_key = cond.get("depends_on_field")
                        expected_val = cond.get("expected_value")
                        actual_val = answers.get(dep_key, {}).get("value")
                        if cond.get("operator") == "equals" and actual_val != expected_val:
                            continue  # Conditionally not applicable

                    ans_rec = answers.get(f["key"], {})
                    ans_val = ans_rec.get("value")
                    if ans_val is None or str(ans_val).strip() == "":
                        missing_required.append(f.get("label", f["key"]))

        if missing_required:
            blockers.append(f"Required fields missing: {', '.join(missing_required[:3])}.")

        if submission.has_unconfirmed_ai_fields:
            blockers.append("Form submission contains unconfirmed AI or draft answers.")
        if not submission.sensitive_fields_reviewed:
            blockers.append("Designated sensitive background fields have not been certified by counsel.")

        # Check for any remaining conflicts
        conflicted_keys = [k for k, v in answers.items() if v.get("has_conflict")]
        if conflicted_keys:
            blockers.append(f"Unresolved multi-document conflicts persist in fields: {', '.join(conflicted_keys)}.")

        if blockers:
            raise ValueError(f"Cannot finalize form submission: {' '.join(blockers)}")

        submission.status = target_status
        new_rev_number = submission.revision_number + 1
        history = list(submission.revision_history or [])
        history.append({
            "revision": new_rev_number,
            "updated_by": user.full_name,
            "user_id": str(user.id),
            "timestamp": now_utc().isoformat(),
            "changes_summary": f"Form locked and finalized as filing-ready (status: {target_status}).",
        })
        submission.revision_number = new_rev_number
        submission.revision_history = history
        submission.updated_at = now_utc()
        db.commit()
        db.refresh(submission)
        return submission

