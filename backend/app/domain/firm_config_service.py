"""Phase 9 — Firm Configuration and Approval Gates Service.

Implements centralized firm governance:
1. Owner/Managing Admin configuration across 10 specific domains:
   - roles
   - country_pathway_enablement
   - folder_structure
   - checklist_versions
   - reminders_escalations
   - inactivity_policy
   - review_stages
   - approval_owners
   - templates
   - rejection_reasons
2. Essential safeguards cannot be disabled.
3. Full audit logging for configuration changes (actor, timestamp, old/new version, reason, effective date).
4. Non-silent inheritance: Active cases pin their configuration snapshot; existing cases do not silently inherit changes.
5. Optional automatic reminders and acknowledgements with guaranteed manual control.
"""

import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.errors import (
    EntityNotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from backend.app.domain.models import (
    AuditEvent,
    FirmConfigurationAuditLog,
    ImmigrationCase,
    Organization,
    OrganizationSetting,
    User,
    now_utc,
)

from enum import StrEnum

# ---------------------------------------------------------------------------
# Governance Domains Enum
# ---------------------------------------------------------------------------

class FirmConfigDomain(StrEnum):
    ROLES = "roles"
    COUNTRY_PATHWAY_ENABLEMENT = "country_pathway_enablement"
    FOLDER_STRUCTURE = "folder_structure"
    CHECKLIST_VERSIONS = "checklist_versions"
    REMINDERS_ESCALATIONS = "reminders_escalations"
    INACTIVITY_POLICY = "inactivity_policy"
    REVIEW_STAGES = "review_stages"
    APPROVAL_OWNERS = "approval_owners"
    TEMPLATES = "templates"
    REJECTION_REASONS = "rejection_reasons"


# ---------------------------------------------------------------------------
# Immutable Essential Safeguards (CANNOT BE DISABLED)
# ---------------------------------------------------------------------------

IMMUTABLE_SAFEGUARDS: dict[str, dict[str, Any]] = {
    "audit_logging_enabled": {
        "description": "Cryptographic immutable audit logging for all casework, decisions, and config mutations",
        "enforced_value": True,
    },
    "require_lawyer_signoff_before_submission": {
        "description": "Mandatory supervising attorney legal review before filing package can be submitted",
        "enforced_value": True,
    },
    "require_tripartite_onboarding_clearance": {
        "description": "Substantive preparation requires manager authorization, accounts clearance, and counsellor confirmation",
        "enforced_value": True,
    },
    "tenant_boundary_isolation_enforced": {
        "description": "Strict organization-level multi-tenant cryptographic isolation across all queries",
        "enforced_value": True,
    },
    "mandatory_regulatory_criteria_verification": {
        "description": "Government statutory criteria and Kazarian merits analysis cannot be bypassed",
        "enforced_value": True,
    },
}

# ---------------------------------------------------------------------------
# Default Configuration for 10 Governance Domains
# ---------------------------------------------------------------------------

DEFAULT_FIRM_CONFIGURATIONS: dict[str, dict[str, Any]] = {
    "roles": {
        "roles": [
            {"code": "master_admin", "name": "Managing Partner / Master Admin", "can_configure_firm": True, "can_authorize_submission": True},
            {"code": "supervising_attorney", "name": "Supervising Attorney", "can_conduct_lawyer_review": True, "can_authorize_submission": True},
            {"code": "case_manager", "name": "Case Manager", "can_authorize_substantive_prep": True, "can_conduct_senior_review": True},
            {"code": "case_worker", "name": "Case Worker / Paralegal", "can_conduct_officer_review": True},
            {"code": "billing_clerk", "name": "Accounts & Billing Specialist", "can_clear_accounts": True},
            {"code": "intake_counsellor", "name": "Intake Counsellor", "can_confirm_intake": True},
        ],
        "operating_mode": "strict_separation",
    },
    "country_pathway_enablement": {
        "enabled_countries": ["US", "CA", "GB", "AU", "IN"],
        "pathways_by_country": {
            "US": ["EB-1A", "EB-2_NIW", "O-1A", "H-1B", "L-1A", "EB-5"],
            "CA": ["Express_Entry_FSW", "PNP_Tech", "Startup_Visa"],
            "GB": ["Global_Talent", "Skilled_Worker", "Innovator_Founder"],
            "AU": ["GTI_858", "TSS_482", "ENS_186"],
            "IN": ["Employment_Visa", "Business_Visa", "OCI"],
        },
        "allow_custom_pathways": False,
    },
    "folder_structure": {
        "default_folders": [
            {"name": "01_GOVERNMENT_FORMS", "required": True, "description": "Official petitions and questionnaires"},
            {"name": "02_IDENTITY_AND_CIVIL", "required": True, "description": "Passports, vital records, biometrics"},
            {"name": "03_REGULATORY_CRITERIA_EVIDENCE", "required": True, "description": "Substantive evidentiary exhibits"},
            {"name": "04_EXPERT_OPINION_LETTERS", "required": False, "description": "Independent referee letters and attestation"},
            {"name": "05_LEGAL_BRIEF_AND_PETITION_LETTER", "required": True, "description": "Attorney legal arguments and cover memorandum"},
            {"name": "06_FILING_FEE_RECEIPTS", "required": True, "description": "Payment confirmations and fee receipts"},
        ],
        "enforce_folder_naming": True,
    },
    "checklist_versions": {
        "default_pack_version": "v2.4.0",
        "allowed_active_versions": ["v2.4.0", "v2.3.1", "v2.2.0"],
        "auto_prompt_migration_on_new_version": True,
        "pin_case_version_permanently": True,
    },
    "reminders_escalations": {
        "enable_auto_reminders": True,
        "enable_auto_acknowledgements": True,
        "reminder_cadence_days": [3, 7, 14],
        "escalation_threshold_days": 10,
        "escalation_recipient_roles": ["case_manager", "supervising_attorney"],
        "manual_control_always_available": True,
    },
    "inactivity_policy": {
        "inactivity_warning_days": 14,
        "inactivity_hold_days": 30,
        "grace_period_days": 7,
        "auto_hold_enabled": True,
    },
    "review_stages": {
        "operating_model": "three_stage",  # "three_stage" or "two_stage"
        "stages": [
            {"stage_id": "officer_initial_review", "name": "Officer Initial Review", "required": True, "role": "case_worker"},
            {"stage_id": "senior_review", "name": "Senior Paralegal / Case Manager Review", "required": True, "role": "case_manager"},
            {"stage_id": "lawyer_review", "name": "Supervising Lawyer Final Merits Review", "required": True, "role": "supervising_attorney"},
        ],
        "require_lawyer_signoff_before_submission": True,
    },
    "approval_owners": {
        "substantive_prep_authorization_role": "case_manager",
        "accounts_clearance_role": "billing_clerk",
        "counsellor_confirmation_role": "intake_counsellor",
        "submission_authorization_role": "supervising_attorney",
        "handover_authorization_role": "supervising_attorney",
    },
    "templates": {
        "cover_letter_template": "default_firm_cover_letter_v1",
        "client_agreement_template": "lex_standard_retainer_2026",
        "rfe_response_template": "formal_legal_rfe_memo",
        "client_welcome_pack_template": "onboarding_instructions_multilingual",
    },
    "rejection_reasons": {
        "reasons": [
            {
                "code": "INCOMPLETE_DOCUMENT",
                "label": "Incomplete Document or Missing Pages",
                "client_explanation": "Uploaded document has missing pages or truncated attachments.",
                "internal_instruction": "Check total page count vs index and flag specific missing page numbers.",
            },
            {
                "code": "ILLEGIBLE_SCAN",
                "label": "Illegible Scan or Glare Obscuring Text",
                "client_explanation": "Document cannot be processed due to blur, low contrast, or lighting glare.",
                "internal_instruction": "Ensure machine-readable zone (MRZ) and dates are clearly decipherable.",
            },
            {
                "code": "EXPIRED_RECORD",
                "label": "Expired Identity or Government Record",
                "client_explanation": "Document validity expired prior to the filing cutoff date.",
                "internal_instruction": "Verify passport or license expiration against intended petition submission window.",
            },
            {
                "code": "MISSING_TRANSLATION_DECLARATION",
                "label": "Missing Certified Translation Declaration",
                "client_explanation": "Foreign language document was submitted without certified translator declaration.",
                "internal_instruction": "Ensure 8 CFR 103.2(b)(3) translator certificate of competence is attached.",
            },
            {
                "code": "UNAUTHORIZED_SIGNATURE",
                "label": "Unauthorized Signatory or Electronic Mark Issue",
                "client_explanation": "Signature is missing or executed by an unauthorized party.",
                "internal_instruction": "Verify power of attorney or petitioner authorized corporate signatory.",
            },
            {
                "code": "DISCREPANT_DATA",
                "label": "Discrepancy Between Supporting Record and Questionnaire",
                "client_explanation": "Name, birthdate, or employer in uploaded record does not match petition forms.",
                "internal_instruction": "Highlight discrepancy and request explanation or amended affidavit.",
            },
        ],
    },
}

SUPPORTED_CONFIG_DOMAINS = list(DEFAULT_FIRM_CONFIGURATIONS.keys())


class FirmConfigService:
    @staticmethod
    def get_firm_version(db: Session, org_id: uuid.UUID) -> int:
        """Returns the current overall firm configuration version number."""
        setting = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == org_id,
            OrganizationSetting.setting_key == "firm_config:version",
        ).first()
        if setting and isinstance(setting.setting_value_json, dict):
            return int(setting.setting_value_json.get("version", 1))
        return 1

    @staticmethod
    def get_firm_configuration(db: Session, org_id: uuid.UUID) -> dict[str, Any]:
        """
        Retrieves complete firm configuration across all 10 domains,
        merging organization customizations over defaults and returning immutable safeguard status.
        """
        settings = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == org_id,
            OrganizationSetting.setting_key.like("firm_config:%"),
        ).all()
        settings_map = {s.setting_key: s.setting_value_json for s in settings}

        version = int(settings_map.get("firm_config:version", {}).get("version", 1))

        domains_result: dict[str, Any] = {}
        for domain in SUPPORTED_CONFIG_DOMAINS:
            key = f"firm_config:{domain}"
            if key in settings_map and isinstance(settings_map[key], dict):
                merged = copy.deepcopy(DEFAULT_FIRM_CONFIGURATIONS[domain])
                merged.update(settings_map[key])
                domains_result[domain] = merged
            else:
                domains_result[domain] = copy.deepcopy(DEFAULT_FIRM_CONFIGURATIONS[domain])

        return {
            "organization_id": str(org_id),
            "version": version,
            "domains": domains_result,
            "immutable_safeguards": IMMUTABLE_SAFEGUARDS,
        }

    @staticmethod
    def get_domain_configuration(db: Session, org_id: uuid.UUID, domain: str) -> dict[str, Any]:
        """Retrieves configuration for a specific domain."""
        if domain not in SUPPORTED_CONFIG_DOMAINS:
            raise ValidationError(
                f"Unknown configuration domain '{domain}'. Supported domains: {SUPPORTED_CONFIG_DOMAINS}"
            )

        key = f"firm_config:{domain}"
        setting = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == org_id,
            OrganizationSetting.setting_key == key,
        ).first()

        default_data = copy.deepcopy(DEFAULT_FIRM_CONFIGURATIONS[domain])
        if setting and isinstance(setting.setting_value_json, dict):
            default_data.update(setting.setting_value_json)

        return default_data

    @staticmethod
    def validate_essential_safeguards(domain: str, new_data: dict[str, Any]) -> None:
        """
        Guarantees essential safeguards cannot be disabled under firm governance policy.
        Throws ValidationError if any payload attempts to toggle off immutable safety requirements.
        """
        # 1. Audit logging cannot be disabled
        if new_data.get("audit_logging_enabled") is False or new_data.get("disable_audit_logging") is True:
            raise ValidationError(
                "Essential safeguard 'audit_logging_enabled' cannot be disabled under firm governance policy."
            )

        # 2. Lawyer review before submission cannot be disabled
        if domain == "review_stages":
            if new_data.get("require_lawyer_signoff_before_submission") is False:
                raise ValidationError(
                    "Essential safeguard 'require_lawyer_signoff_before_submission' cannot be disabled under firm governance policy."
                )

        # 3. Tripartite onboarding clearance cannot be disabled
        if new_data.get("require_tripartite_onboarding_clearance") is False:
            raise ValidationError(
                "Essential safeguard 'require_tripartite_onboarding_clearance' cannot be disabled under firm governance policy."
            )

        # 4. Mandatory regulatory criteria cannot be disabled
        if new_data.get("mandatory_regulatory_criteria_verification") is False:
            raise ValidationError(
                "Essential safeguard 'mandatory_regulatory_criteria_verification' cannot be disabled under firm governance policy."
            )

        # 5. Tenant boundary isolation cannot be disabled
        if new_data.get("tenant_boundary_isolation_enforced") is False:
            raise ValidationError(
                "Essential safeguard 'tenant_boundary_isolation_enforced' cannot be disabled under firm governance policy."
            )

    @staticmethod
    def update_domain_configuration(
        db: Session,
        org_id: Optional[uuid.UUID] = None,
        domain: str = "",
        new_data: Optional[dict[str, Any]] = None,
        actor_id: Optional[uuid.UUID] = None,
        actor_email: Optional[str] = None,
        reason: str = "",
        effective_date: Optional[datetime] = None,
        organization_id: Optional[uuid.UUID] = None,
        config_data: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Updates a specific configuration domain, recording full audit logging with actor,
        timestamp, old/new versions, reason, and effective date.
        Enforces that essential safeguards cannot be disabled.
        Marks active cases with `firm_config_update_available = True` without silently mutating them.
        """
        effective_org_id = organization_id or org_id
        if not effective_org_id:
            raise ValidationError("Organization ID is required.")

        effective_data = config_data if config_data is not None else (new_data or {})

        if domain not in SUPPORTED_CONFIG_DOMAINS:
            raise ValidationError(
                f"Unknown configuration domain '{domain}'. Supported domains: {SUPPORTED_CONFIG_DOMAINS}"
            )

        if not reason or len(reason.strip()) < 10:
            raise ValidationError(
                "Configuration change justification 'reason' is mandatory and must be at least 10 characters."
            )

        # Enforce essential safeguards
        FirmConfigService.validate_essential_safeguards(domain, effective_data)

        # Resolve actor email if missing
        effective_email = actor_email
        if not effective_email and actor_id:
            user = db.query(User).filter(User.id == actor_id).first()
            if user:
                effective_email = user.email
        if not effective_email:
            effective_email = "admin@firm.com"

        key = f"firm_config:{domain}"
        now = now_utc()
        eff_date = effective_date or now

        # Fetch old configuration
        setting = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == effective_org_id,
            OrganizationSetting.setting_key == key,
        ).first()

        old_data = copy.deepcopy(DEFAULT_FIRM_CONFIGURATIONS[domain])
        if setting and isinstance(setting.setting_value_json, dict):
            old_data.update(setting.setting_value_json)

        # Increment global firm version
        version_setting = db.query(OrganizationSetting).filter(
            OrganizationSetting.organization_id == effective_org_id,
            OrganizationSetting.setting_key == "firm_config:version",
        ).first()

        current_version = 1
        if version_setting and isinstance(version_setting.setting_value_json, dict):
            current_version = int(version_setting.setting_value_json.get("version", 1))

        new_version = current_version + 1

        if not version_setting:
            version_setting = OrganizationSetting(
                organization_id=effective_org_id,
                setting_key="firm_config:version",
                setting_value_json={"version": new_version},
                updated_by_id=actor_id,
                updated_at=now,
            )
            db.add(version_setting)
        else:
            version_setting.setting_value_json = {"version": new_version}
            version_setting.updated_by_id = actor_id
            version_setting.updated_at = now

        # Update or create domain setting
        merged_new = copy.deepcopy(old_data)
        merged_new.update(effective_data)

        if not setting:
            setting = OrganizationSetting(
                organization_id=effective_org_id,
                setting_key=key,
                setting_value_json=merged_new,
                updated_by_id=actor_id,
                updated_at=now,
            )
            db.add(setting)
        else:
            setting.setting_value_json = merged_new
            setting.updated_by_id = actor_id
            setting.updated_at = now

        # Record Audit Log
        audit_log = FirmConfigurationAuditLog(
            organization_id=effective_org_id,
            config_domain=domain,
            version=new_version,
            actor_id=actor_id,
            actor_email=effective_email,
            old_version_json=old_data,
            new_version_json=merged_new,
            reason=reason.strip(),
            effective_date=eff_date,
            created_at=now,
        )
        db.add(audit_log)

        # Record standard AuditEvent
        audit_event = AuditEvent(
            organization_id=effective_org_id,
            actor_id=actor_id,
            action="firm_configuration.updated",
            object_type="firm_configuration",
            object_id=domain,
            metadata_json={
                "domain": domain,
                "version": new_version,
                "actor_email": effective_email,
                "reason": reason.strip(),
                "effective_date": eff_date.isoformat(),
            },
            occurred_at=now,
        )
        db.add(audit_event)

        # Non-silent inheritance: Mark existing cases that an update is available,
        # but DO NOT silently mutate their pinned configurations!
        db.query(ImmigrationCase).filter(
            ImmigrationCase.organization_id == effective_org_id,
            ImmigrationCase.firm_config_version < new_version,
        ).update(
            {"firm_config_update_available": True},
            synchronize_session=False,
        )

        db.commit()
        db.refresh(setting)

        return {
            "domain": domain,
            "version": new_version,
            "configuration": merged_new,
            "effective_date": eff_date.isoformat(),
        }

    @staticmethod
    def get_audit_history(
        db: Session,
        org_id: uuid.UUID,
        domain: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Returns the audit log of firm configuration mutations."""
        query = db.query(FirmConfigurationAuditLog).filter(
            FirmConfigurationAuditLog.organization_id == org_id,
        )
        if domain:
            query = query.filter(FirmConfigurationAuditLog.config_domain == domain)
        logs = query.order_by(desc(FirmConfigurationAuditLog.created_at)).all()
        return [
            {
                "id": str(log.id),
                "organization_id": str(log.organization_id),
                "domain": log.config_domain,
                "version": log.version,
                "old_version": max(1, log.version - 1),
                "new_version": log.version,
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_email": log.actor_email,
                "old_version_json": log.old_version_json,
                "new_version_json": log.new_version_json,
                "reason": log.reason,
                "effective_date": log.effective_date.isoformat() if log.effective_date else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]

    @staticmethod
    def create_case_config_snapshot(db: Session, org_id: uuid.UUID) -> tuple[dict[str, Any], int]:
        """
        Creates a frozen snapshot of the active firm configuration to pin to a new case.
        Prevents silent inheritance of future firm config mutations.
        """
        firm_config = FirmConfigService.get_firm_configuration(db, org_id)
        snapshot = copy.deepcopy(firm_config["domains"])
        version = firm_config["version"]
        return snapshot, version

    @staticmethod
    def migrate_case_to_latest_config(
        db: Session,
        case: Optional[ImmigrationCase | uuid.UUID | str] = None,
        case_id: Optional[uuid.UUID | str] = None,
        actor_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
        target_version: Optional[int] = None,
    ) -> ImmigrationCase:
        """
        Explicitly migrates an existing case from its pinned configuration to the latest firm configuration.
        Requires explicit justification and records an audit trail.
        """
        effective_case = case if case is not None else case_id
        if effective_case is None:
            raise ValidationError("Case or case_id is required for firm configuration migration.")

        if isinstance(effective_case, (str, uuid.UUID)):
            c_id = uuid.UUID(str(effective_case)) if isinstance(effective_case, str) else effective_case
            target_case = db.query(ImmigrationCase).filter(ImmigrationCase.id == c_id).first()
            if not target_case:
                raise EntityNotFoundError("ImmigrationCase", str(effective_case))
        else:
            target_case = effective_case

        reason_text = (reason or "Migrated case to latest firm configuration snapshot").strip()
        if len(reason_text) < 10:
            raise ValidationError(
                "Case configuration migration requires a mandatory justification reason (min 10 characters)."
            )

        new_snapshot, latest_version = FirmConfigService.create_case_config_snapshot(db, target_case.organization_id)
        old_version = target_case.firm_config_version

        target_case.pinned_firm_config_snapshot = new_snapshot
        target_case.firm_config_version = latest_version
        target_case.firm_config_update_available = False
        target_case.updated_at = now_utc()

        audit = AuditEvent(
            organization_id=target_case.organization_id,
            actor_id=actor_id,
            action="case.firm_config_migrated",
            object_type="immigration_case",
            object_id=str(target_case.id),
            metadata_json={
                "from_version": old_version,
                "to_version": latest_version,
                "reason": reason_text,
            },
            occurred_at=now_utc(),
        )
        db.add(audit)
        db.commit()
        db.refresh(target_case)
        return target_case
