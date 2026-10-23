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
    User,
    now_utc,
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
        """Seeds standard versioned form schemas (USCIS I-140, DOS DS-160, IRCC IMM 5257) for the organization."""
        from backend.app.forms.schemas_catalog import DOS_DS160_SCHEMA, IRCC_IMM5257_SCHEMA

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
                "name": "Application for Visitor Visa / Study Permit (Form IMM 5257)",
                "jurisdiction": "CA",
                "pathway": "TRV_STUDY",
                "edition_date": "11/2025",
                "version_number": "v2026.1",
                "schema_json": IRCC_IMM5257_SCHEMA,
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
    def populate_form_draft(
        db: Session,
        organization_id: uuid.UUID,
        case_id: uuid.UUID,
        schema_version_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
    ) -> FormSubmission:
        """
        Creates a new FormSubmission pre-populated only from authorized, available information.
        Every populated value retains its source provenance or is marked as user-provided / ai-generated.
        AI-generated or auto-populated draft values have is_confirmed = False.
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
        )
        ocr_results = db.execute(ocr_stmt).all()
        ocr_field_map = {}
        for field, doc in ocr_results:
            ocr_field_map[field.field_name] = {
                "val": field.normalized_value or field.original_value,
                "doc_id": str(doc.id),
                "doc_title": doc.title,
            }

        answers: Dict[str, Any] = {}
        total_fields = 0
        filled_fields = 0
        has_unconfirmed = False

        for section in sections:
            for f in section.get("fields", []):
                total_fields += 1
                key = f["key"]
                hint = f.get("source_mapping_hint", "")
                val = None
                source_type = "user_provided"
                source_id = None
                source_label = "Awaiting User Input"
                is_confirmed = False

                # 1. Map from ClientProfile
                if hint == "profile.first_name" and client:
                    val = client.first_name
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = f"Client Profile (ID: {client.id})"
                    is_confirmed = True  # Verified client record
                elif hint == "profile.last_name" and client:
                    val = client.last_name
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = f"Client Profile (ID: {client.id})"
                    is_confirmed = True
                elif hint == "profile.email" and client:
                    val = client.email
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = f"Client Profile Primary Email"
                    is_confirmed = True
                elif hint == "profile.nationality" and client:
                    val = client.nationality
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = "Client Nationality Record"
                    is_confirmed = True
                elif hint == "profile.date_of_birth" and client and client.date_of_birth:
                    val = client.date_of_birth.strftime("%Y-%m-%d")
                    source_type = "client_profile"
                    source_id = str(client.id)
                    source_label = "Client Civil DOB Record"
                    is_confirmed = True

                # 2. Map from ImmigrationCase
                elif hint == "case.visa_category":
                    val = "EB1A_EXTRAORDINARY" if "EB-1A" in case.visa_category else case.visa_category
                    source_type = "client_profile"
                    source_id = str(case.id)
                    source_label = f"Case {case.case_number} Category"
                    is_confirmed = True
                elif hint == "case.is_self_petition":
                    val = True
                    source_type = "client_profile"
                    source_id = str(case.id)
                    source_label = "Case Filing Structure"
                    is_confirmed = True
                elif hint == "case.title":
                    val = case.title
                    source_type = "ai_generated"
                    source_id = str(case.id)
                    source_label = "AI Extracted Proposed Endeavor (Draft)"
                    is_confirmed = False  # AI generated draft must remain unconfirmed
                    has_unconfirmed = True

                # 3. Map from Document OCR
                elif hint == "doc.ocr.passport_number" and "passport_number" in ocr_field_map:
                    ocr = ocr_field_map["passport_number"]
                    val = ocr["val"]
                    source_type = "document_ocr"
                    source_id = ocr["doc_id"]
                    source_label = f"Verified OCR: {ocr['doc_title']}"
                    is_confirmed = False  # OCR field must be human confirmed in form
                    has_unconfirmed = True
                elif hint == "doc.ocr.alien_number" and "alien_number" in ocr_field_map:
                    ocr = ocr_field_map["alien_number"]
                    val = ocr["val"]
                    source_type = "document_ocr"
                    source_id = ocr["doc_id"]
                    source_label = f"Verified OCR: {ocr['doc_title']}"
                    is_confirmed = False
                    has_unconfirmed = True
                elif "default" in f:
                    val = f["default"]
                    source_type = "user_provided"
                    source_label = "Default Schema Value"
                    is_confirmed = True

                if val is not None:
                    filled_fields += 1

                answers[key] = {
                    "value": val,
                    "source_type": source_type,
                    "source_id": source_id,
                    "source_label": source_label,
                    "is_confirmed": is_confirmed,
                    "confirmed_by_user_id": str(user_id) if is_confirmed and user_id else None,
                    "confirmed_at": now_utc().isoformat() if is_confirmed else None,
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

            existing_record = current_answers.get(key, {})
            current_answers[key] = {
                "value": new_val,
                "source_type": "user_provided",
                "source_id": str(user.id),
                "source_label": f"Edited by {user.full_name}",
                "is_confirmed": True,
                "confirmed_by_user_id": str(user.id),
                "confirmed_at": now_utc().isoformat(),
            }
            changed_keys.append(key)

        # Check if any unconfirmed AI fields remain
        has_unconfirmed = any(
            not rec.get("is_confirmed", False)
            for rec in current_answers.values()
            if rec.get("value") is not None
        )

        total_fields = len(fields_by_key)
        filled_count = sum(1 for rec in current_answers.values() if rec.get("value") is not None)
        completion = round((filled_count / max(1, total_fields)) * 100, 1)

        new_rev_number = submission.revision_number + 1
        history = list(submission.revision_history or [])
        history.append({
            "revision": new_rev_number,
            "updated_by": user.full_name,
            "timestamp": now_utc().isoformat(),
            "changes_summary": notes or f"Updated {len(changed_keys)} fields: {', '.join(changed_keys[:5])}",
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
        record["is_confirmed"] = True
        record["confirmed_by_user_id"] = str(user.id)
        record["confirmed_at"] = now_utc().isoformat()
        current_answers[field_key] = record

        has_unconfirmed = any(
            not rec.get("is_confirmed", False)
            for rec in current_answers.values()
            if rec.get("value") is not None
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
        submission.updated_at = now_utc()
        db.commit()
        db.refresh(submission)
        return submission
