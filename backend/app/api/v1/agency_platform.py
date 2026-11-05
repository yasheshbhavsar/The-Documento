"""
B2B Visa Agency KYB Onboarding, Co-Branded Calculator Lead Bridge & Documento HQ Super-Admin Control Plane Router.

Enforces two strict architectural invariants:
1. Two-Track KYB Verification (Regulated Immigration Counsel vs Registered Overseas Consultancy) before production tenant provisioning.
2. Zero-PII Platform Oversight: Documento HQ (`platform_super_admin` / `platform_ops`) inspects aggregate agency telemetry,
   quotas, MRR, and KYB credentials ONLY — never raw client names, passport scans, or case notes — with explicit
   Agency-Owner-granted 2-hour Break-Glass Support tokens logged in the tenant's immutable AuditEvent ledger.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.app.billing.service import BillingService
from backend.app.core.errors import ConflictError, EntityNotFoundError, PermissionDeniedError, ValidationError
from backend.app.db.session import get_db
from backend.app.domain.models import (
    AgencyOnboardingApplication,
    AgencyTenantGovernance,
    AuditEvent,
    CalculatorAgencyLead,
    DocumentProcessingRun,
    ImmigrationCase,
    MembershipRole,
    Organization,
    OrganizationMembership,
    Role,
    Session as UserSession,
    User,
)
from backend.app.security.auth import AuthContext, get_auth_context, require_permission
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import generate_secure_random_token, hash_opaque_token

router = APIRouter(prefix="/agency-platform", tags=["agency-platform"])

PLAN_DEFAULTS: dict[str, dict[str, Any]] = {
    "pilot_14d": {
        "mrr_usd": 0.0,
        "billing_status": "trialing",
        "seat_limit": 3,
        "monthly_case_quota": 15,
        "monthly_ai_extraction_quota": 150,
    },
    "boutique": {
        "mrr_usd": 199.0,
        "billing_status": "active",
        "seat_limit": 6,
        "monthly_case_quota": 50,
        "monthly_ai_extraction_quota": 600,
    },
    "growth": {
        "mrr_usd": 499.0,
        "billing_status": "active",
        "seat_limit": 18,
        "monthly_case_quota": 180,
        "monthly_ai_extraction_quota": 2500,
    },
    "enterprise": {
        "mrr_usd": 1190.0,
        "billing_status": "active",
        "seat_limit": 60,
        "monthly_case_quota": 750,
        "monthly_ai_extraction_quota": 10000,
    },
}


def _normalize_slug(raw: str) -> str:
    cleaned = re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower()).strip("-")
    return cleaned[:80] or f"agency-{uuid.uuid4().hex[:6]}"


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class AgencyOnboardingApplyRequest(BaseModel):
    legal_entity_name: str = Field(..., min_length=2, max_length=220)
    trading_name: str = Field(..., min_length=2, max_length=200)
    requested_slug: str = Field(..., min_length=2, max_length=100)
    hq_country: str = Field(..., min_length=2, max_length=64)
    hq_city: str = Field(..., min_length=2, max_length=120)
    corporate_domain: str = Field(..., min_length=3, max_length=160)
    tax_registration_id: str = Field(..., min_length=3, max_length=80)

    contact_full_name: str = Field(..., min_length=2, max_length=200)
    contact_work_email: EmailStr
    contact_phone: str | None = Field(default=None, max_length=60)
    owner_password: str | None = Field(default=None, min_length=8, max_length=128)

    kyb_track: str = Field(default="regulated_counsel", pattern="^(regulated_counsel|overseas_consultancy)$")
    regulatory_body: str = Field(..., min_length=2, max_length=64)
    license_number: str = Field(..., min_length=2, max_length=100)
    co_counsel_details: str | None = Field(default=None, max_length=255)

    target_corridors: list[str] = Field(default_factory=lambda: ["CA"])
    estimated_monthly_cases: int = Field(default=25, ge=1, le=10000)
    requested_seats: int = Field(default=5, ge=1, le=500)
    branch_count: int = Field(default=1, ge=1, le=100)
    selected_plan_tier: str = Field(default="growth", pattern="^(pilot_14d|boutique|growth|enterprise)$")

    dpa_accepted: bool = Field(...)
    zero_training_accepted: bool = Field(...)


class KybDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approve|request_clarification|reject)$")
    reviewer_notes: str | None = Field(default=None, max_length=1000)
    override_plan_tier: str | None = Field(default=None, pattern="^(pilot_14d|boutique|growth|enterprise)$")


class GovernancePatchRequest(BaseModel):
    plan_tier: str | None = Field(default=None, pattern="^(pilot_14d|boutique|growth|enterprise)$")
    seat_limit: int | None = Field(default=None, ge=1, le=1000)
    monthly_case_quota: int | None = Field(default=None, ge=1, le=50000)
    monthly_ai_extraction_quota: int | None = Field(default=None, ge=0, le=500000)
    status: str | None = Field(default=None, pattern="^(active|suspended)$")
    feature_flags: dict[str, bool] | None = None
    reason: str | None = Field(default=None, max_length=300)


class Day0SetupUpdateRequest(BaseModel):
    trading_name: str = Field(..., min_length=2, max_length=200)
    tagline: str | None = Field(default=None, max_length=220)
    primary_color: str = Field(default="#063C3D", max_length=16)
    cobranded_calculators_enabled: bool = True
    enabled_corridors: list[str] = Field(default_factory=list)


class SupportGrantRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=255)
    duration_minutes: int = Field(default=120, ge=15, le=240)


class CalculatorLeadSubmitRequest(BaseModel):
    applicant_name: str = Field(..., min_length=2, max_length=200)
    applicant_email: EmailStr
    applicant_phone: str | None = Field(default=None, max_length=60)
    calculator_id: str = Field(..., min_length=2, max_length=64)
    country_code: str = Field(..., min_length=2, max_length=8)
    score_summary: str = Field(..., min_length=2, max_length=160)
    score_payload: dict[str, Any] = Field(default_factory=dict)


class ClarificationResubmitRequest(BaseModel):
    license_number: str | None = Field(default=None, max_length=100)
    co_counsel_details: str = Field(..., min_length=3, max_length=255)


class CalculatorLeadStatusPatchRequest(BaseModel):
    lead_status: str = Field(..., pattern="^(new_lead|contacted|converted_to_client|archived)$")


# ---------------------------------------------------------------------------
# 1. Public B2B Agency Onboarding & Co-Branded Calculator Endpoints
# ---------------------------------------------------------------------------

@router.post("/onboarding/apply", status_code=status.HTTP_201_CREATED)
def submit_agency_onboarding_application(
    payload: AgencyOnboardingApplyRequest,
    db: Session = Depends(get_db),
):
    """Submits a B2B Visa Agency KYB application and returns instant Restricted Sandbox details."""
    if not payload.dpa_accepted or not payload.zero_training_accepted:
        raise ValidationError(
            "Both the GDPR/PIPEDA/DPDP Data Processing Addendum and Zero-AI-Training attestation must be accepted."
        )

    slug = _normalize_slug(payload.requested_slug)
    existing_org = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_org:
        raise ConflictError(f"Workspace slug '{slug}' is already claimed by an active partner agency.")

    app_record = AgencyOnboardingApplication(
        legal_entity_name=payload.legal_entity_name.strip(),
        trading_name=payload.trading_name.strip(),
        requested_slug=slug,
        hq_country=payload.hq_country.strip(),
        hq_city=payload.hq_city.strip(),
        corporate_domain=payload.corporate_domain.strip().lower(),
        tax_registration_id=payload.tax_registration_id.strip(),
        contact_full_name=payload.contact_full_name.strip(),
        contact_work_email=payload.contact_work_email.lower().strip(),
        contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
        kyb_track=payload.kyb_track,
        regulatory_body=payload.regulatory_body.strip(),
        license_number=payload.license_number.strip(),
        co_counsel_details=payload.co_counsel_details.strip() if payload.co_counsel_details else None,
        target_corridors_json=payload.target_corridors,
        estimated_monthly_cases=payload.estimated_monthly_cases,
        requested_seats=payload.requested_seats,
        branch_count=payload.branch_count,
        selected_plan_tier=payload.selected_plan_tier,
        dpa_accepted=payload.dpa_accepted,
        zero_training_accepted=payload.zero_training_accepted,
        kyb_status="pending_kyb",
    )
    db.add(app_record)

    if payload.owner_password:
        owner_email_norm = payload.contact_work_email.lower().strip()
        existing_user = db.query(User).filter(User.email == owner_email_norm).first()
        if not existing_user:
            db.add(
                User(
                    organization_id=None,
                    email=owner_email_norm,
                    name=payload.contact_full_name.strip(),
                    full_name=payload.contact_full_name.strip(),
                    password_hash=hash_password(payload.owner_password),
                    phone=payload.contact_phone.strip() if payload.contact_phone else None,
                    status="pending",
                )
            )

    db.commit()
    db.refresh(app_record)

    return {
        "application_id": str(app_record.id),
        "dossier_code": f"KYB-{str(app_record.id)[:8].upper()}",
        "requested_slug": app_record.requested_slug,
        "kyb_status": app_record.kyb_status,
        "sandbox_mode_ready": True,
        "cobranded_preview_url": f"/calculators?agency={app_record.requested_slug}",
        "created_at": app_record.created_at.isoformat(),
    }


@router.get("/onboarding/status/{application_id}")
def get_agency_onboarding_status(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Checks KYB review progress for a submitted B2B agency application."""
    app_record = (
        db.query(AgencyOnboardingApplication)
        .filter(AgencyOnboardingApplication.id == application_id)
        .first()
    )
    if not app_record:
        raise EntityNotFoundError("AgencyOnboardingApplication", application_id)

    return {
        "application_id": str(app_record.id),
        "trading_name": app_record.trading_name,
        "requested_slug": app_record.requested_slug,
        "kyb_status": app_record.kyb_status,
        "reviewer_notes": app_record.reviewer_notes,
        "provisioned_organization_id": (
            str(app_record.provisioned_organization_id) if app_record.provisioned_organization_id else None
        ),
        "reviewed_at": app_record.reviewed_at.isoformat() if app_record.reviewed_at else None,
    }


@router.get("/onboarding/lookup")
def lookup_agency_onboarding_dossier(
    q: str = Query(..., min_length=3, max_length=320),
    db: Session = Depends(get_db),
):
    """Looks up an existing KYB dossier by Dossier Code (`KYB-XXXXXXXX`) or Managing Partner work email."""
    needle = q.strip()
    matched: AgencyOnboardingApplication | None = None

    if "@" in needle:
        matched = (
            db.query(AgencyOnboardingApplication)
            .filter(AgencyOnboardingApplication.contact_work_email == needle.lower())
            .order_by(AgencyOnboardingApplication.created_at.desc())
            .first()
        )
    else:
        hex_prefix = needle.upper().replace("KYB-", "").strip()
        for candidate in db.query(AgencyOnboardingApplication).order_by(AgencyOnboardingApplication.created_at.desc()).all():
            if str(candidate.id).upper().replace("-", "").startswith(hex_prefix.replace("-", "")):
                matched = candidate
                break

    if not matched:
        raise EntityNotFoundError("AgencyOnboardingApplication", needle)

    return {
        "application_id": str(matched.id),
        "dossier_code": f"KYB-{str(matched.id)[:8].upper()}",
        "legal_entity_name": matched.legal_entity_name,
        "trading_name": matched.trading_name,
        "requested_slug": matched.requested_slug,
        "regulatory_body": matched.regulatory_body,
        "license_number": matched.license_number,
        "kyb_status": matched.kyb_status,
        "reviewer_notes": matched.reviewer_notes,
        "provisioned_organization_id": (
            str(matched.provisioned_organization_id) if matched.provisioned_organization_id else None
        ),
        "reviewed_at": matched.reviewed_at.isoformat() if matched.reviewed_at else None,
        "created_at": matched.created_at.isoformat(),
    }


@router.post("/onboarding/{application_id}/clarification")
def resubmit_kyb_clarification(
    application_id: uuid.UUID,
    payload: ClarificationResubmitRequest,
    db: Session = Depends(get_db),
):
    """Allows an agency with `clarification_requested` status to supply updated license/co-counsel evidence."""
    app_record = (
        db.query(AgencyOnboardingApplication)
        .filter(AgencyOnboardingApplication.id == application_id)
        .first()
    )
    if not app_record:
        raise EntityNotFoundError("AgencyOnboardingApplication", application_id)
    if app_record.kyb_status != "clarification_requested":
        raise ValidationError("Only dossiers awaiting clarification can submit a clarification response.")

    if payload.license_number and payload.license_number.strip():
        app_record.license_number = payload.license_number.strip()
    app_record.co_counsel_details = payload.co_counsel_details.strip()
    app_record.kyb_status = "pending_kyb"
    db.commit()
    return {
        "application_id": str(app_record.id),
        "kyb_status": app_record.kyb_status,
        "co_counsel_details": app_record.co_counsel_details,
    }


@router.get("/public-agency/{slug}")
def get_public_cobranded_agency(
    slug: str,
    db: Session = Depends(get_db),
):
    """Returns safe public co-branding metadata for `/calculators?agency=<slug>`."""
    normalized = _normalize_slug(slug)
    org = db.query(Organization).filter(Organization.slug == normalized).first()
    if not org or org.status != "active":
        raise EntityNotFoundError("PartnerAgency", normalized)

    gov = (
        db.query(AgencyTenantGovernance)
        .filter(AgencyTenantGovernance.organization_id == org.id)
        .first()
    )
    flags = (gov.feature_flags_json if gov else {}) or {}
    if flags.get("cobranded_calculators") is False:
        raise PermissionDeniedError("Co-branded calculator portal is disabled for this agency.")

    branding = (gov.branding_json if gov else {}) or {}
    return {
        "slug": org.slug,
        "trading_name": gov.trading_name if gov else org.name,
        "regulatory_body": gov.regulatory_body if gov else "Verified Partner",
        "license_number": gov.license_number if gov else "KYB-VERIFIED",
        "hq_city": gov.hq_city if gov else "",
        "hq_country": gov.hq_country if gov else "",
        "primary_color": branding.get("primary_color", "#063C3D"),
        "tagline": branding.get(
            "tagline",
            "Submit your official 2026 PR points scorecard for counsel eligibility review.",
        ),
    }


@router.post("/public-agency/{slug}/calculator-leads", status_code=status.HTTP_201_CREATED)
def submit_cobranded_calculator_lead(
    slug: str,
    payload: CalculatorLeadSubmitRequest,
    db: Session = Depends(get_db),
):
    """Captures an applicant's PR points scorecard directly into a verified partner agency's lead inbox."""
    normalized = _normalize_slug(slug)
    org = db.query(Organization).filter(Organization.slug == normalized, Organization.status == "active").first()
    if not org:
        raise EntityNotFoundError("PartnerAgency", normalized)

    lead = CalculatorAgencyLead(
        organization_id=org.id,
        agency_slug=org.slug,
        applicant_name=payload.applicant_name.strip(),
        applicant_email=payload.applicant_email.lower().strip(),
        applicant_phone=payload.applicant_phone.strip() if payload.applicant_phone else None,
        calculator_id=payload.calculator_id.strip(),
        country_code=payload.country_code.strip().upper(),
        score_summary=payload.score_summary.strip(),
        score_payload_json=payload.score_payload,
        lead_status="new_lead",
    )
    db.add(lead)

    gov = (
        db.query(AgencyTenantGovernance)
        .filter(AgencyTenantGovernance.organization_id == org.id)
        .first()
    )
    if gov:
        gov.calculator_leads_30d = (gov.calculator_leads_30d or 0) + 1

    db.commit()
    db.refresh(lead)
    return {
        "lead_id": str(lead.id),
        "agency_slug": org.slug,
        "status": "submitted",
        "created_at": lead.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# 2. Agency Owner Day-0 Setup, Calculator Leads & Break-Glass Support Grants
# ---------------------------------------------------------------------------

@router.get("/current-firm/governance")
def get_current_firm_governance(
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Returns Day-0 setup state, plan quotas, co-branded URL, and break-glass support status for the current firm."""
    org = db.query(Organization).filter(Organization.id == ctx.organization_id).first()
    if not org:
        raise EntityNotFoundError("Organization", ctx.organization_id)

    gov = (
        db.query(AgencyTenantGovernance)
        .filter(AgencyTenantGovernance.organization_id == org.id)
        .first()
    )
    leads = (
        db.query(CalculatorAgencyLead)
        .filter(CalculatorAgencyLead.organization_id == org.id)
        .order_by(CalculatorAgencyLead.created_at.desc())
        .limit(25)
        .all()
    )
    now = datetime.now(timezone.utc)
    support_active = bool(
        gov
        and gov.support_grant_expires_at
        and gov.support_grant_expires_at.replace(tzinfo=timezone.utc) > now
    )

    return {
        "organization_id": str(org.id),
        "slug": org.slug,
        "trading_name": gov.trading_name if gov else org.name,
        "plan_tier": gov.plan_tier if gov else "growth",
        "seat_limit": gov.seat_limit if gov else 15,
        "monthly_case_quota": gov.monthly_case_quota if gov else 120,
        "monthly_ai_extraction_quota": gov.monthly_ai_extraction_quota if gov else 1500,
        "enabled_corridors": gov.enabled_corridors_json if gov else ["CA", "US", "UK"],
        "branding": gov.branding_json if gov else {"primary_color": "#063C3D", "setup_completed": False},
        "support_grant_active": support_active,
        "support_grant_expires_at": (
            gov.support_grant_expires_at.isoformat() if (gov and gov.support_grant_expires_at) else None
        ),
        "calculator_leads": [
            {
                "id": str(l.id),
                "applicant_name": l.applicant_name,
                "applicant_email": l.applicant_email,
                "applicant_phone": l.applicant_phone,
                "calculator_id": l.calculator_id,
                "country_code": l.country_code,
                "score_summary": l.score_summary,
                "lead_status": l.lead_status,
                "created_at": l.created_at.isoformat(),
            }
            for l in leads
        ],
    }


@router.put("/current-firm/day0-setup")
def update_current_firm_day0_setup(
    payload: Day0SetupUpdateRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Completes or updates the Agency Owner's Day-0 Firm Branding & Co-Branded Calculator configuration."""
    org = db.query(Organization).filter(Organization.id == ctx.organization_id).first()
    if not org:
        raise EntityNotFoundError("Organization", ctx.organization_id)

    gov = (
        db.query(AgencyTenantGovernance)
        .filter(AgencyTenantGovernance.organization_id == org.id)
        .first()
    )
    if not gov:
        gov = AgencyTenantGovernance(
            organization_id=org.id,
            trading_name=payload.trading_name.strip(),
        )
        db.add(gov)

    gov.trading_name = payload.trading_name.strip()
    gov.enabled_corridors_json = payload.enabled_corridors
    flags = dict(gov.feature_flags_json or {})
    flags["cobranded_calculators"] = payload.cobranded_calculators_enabled
    gov.feature_flags_json = flags
    gov.branding_json = {
        **(gov.branding_json or {}),
        "primary_color": payload.primary_color,
        "tagline": payload.tagline or "",
        "setup_completed": True,
    }

    db.add(
        AuditEvent(
            organization_id=org.id,
            actor_id=ctx.user_id,
            action="agency.day0_setup_completed",
            object_type="organization",
            object_id=str(org.id),
            metadata_json={"trading_name": gov.trading_name, "corridors": payload.enabled_corridors},
        )
    )
    db.commit()
    return {"status": "ok", "slug": org.slug, "trading_name": gov.trading_name, "setup_completed": True}


@router.patch("/current-firm/calculator-leads/{lead_id}")
def update_calculator_lead_status(
    lead_id: uuid.UUID,
    payload: CalculatorLeadStatusPatchRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Updates an incoming co-branded PR calculator lead status within the firm's isolated tenant."""
    lead = (
        db.query(CalculatorAgencyLead)
        .filter(
            CalculatorAgencyLead.id == lead_id,
            CalculatorAgencyLead.organization_id == ctx.organization_id,
        )
        .first()
    )
    if not lead:
        raise EntityNotFoundError("CalculatorAgencyLead", lead_id)

    lead.lead_status = payload.lead_status
    db.commit()
    return {"id": str(lead.id), "lead_status": lead.lead_status}


@router.post("/current-firm/support-grant")
def issue_break_glass_support_grant(
    payload: SupportGrantRequest,
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Grants Documento HQ time-boxed (default 2-hour) diagnostic access, audited in the firm's immutable ledger."""
    gov = (
        db.query(AgencyTenantGovernance)
        .filter(AgencyTenantGovernance.organization_id == ctx.organization_id)
        .first()
    )
    if not gov:
        org = db.query(Organization).filter(Organization.id == ctx.organization_id).first()
        gov = AgencyTenantGovernance(
            organization_id=ctx.organization_id,
            trading_name=org.name if org else "Agency Workspace",
        )
        db.add(gov)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=payload.duration_minutes)
    gov.support_grant_expires_at = expires_at
    gov.support_grant_reason = payload.reason.strip()

    db.add(
        AuditEvent(
            organization_id=ctx.organization_id,
            actor_id=ctx.user_id,
            action="agency.support_grant_issued",
            object_type="organization",
            object_id=str(ctx.organization_id),
            metadata_json={
                "reason": gov.support_grant_reason,
                "expires_at": expires_at.isoformat(),
                "duration_minutes": payload.duration_minutes,
            },
        )
    )
    db.commit()
    return {
        "status": "granted",
        "expires_at": expires_at.isoformat(),
        "reason": gov.support_grant_reason,
    }


@router.delete("/current-firm/support-grant")
def revoke_break_glass_support_grant(
    ctx: AuthContext = Depends(require_permission("org:manage")),
    db: Session = Depends(get_db),
):
    """Immediately revokes any active Documento HQ diagnostic support grant."""
    gov = (
        db.query(AgencyTenantGovernance)
        .filter(AgencyTenantGovernance.organization_id == ctx.organization_id)
        .first()
    )
    if gov:
        gov.support_grant_expires_at = None
        gov.support_grant_reason = None
        db.add(
            AuditEvent(
                organization_id=ctx.organization_id,
                actor_id=ctx.user_id,
                action="agency.support_grant_revoked",
                object_type="organization",
                object_id=str(ctx.organization_id),
                metadata_json={},
            )
        )
        db.commit()
    return {"status": "revoked"}


# ---------------------------------------------------------------------------
# 3. Documento HQ Super-Admin Control Plane (Zero-PII Cross-Tenant Oversight)
# ---------------------------------------------------------------------------

@router.get("/super-admin/overview")
def get_super_admin_network_overview(
    ctx: AuthContext = Depends(require_permission("platform:agencies:read")),
    db: Session = Depends(get_db),
):
    """Returns reconciled cross-agency KPIs for Documento HQ without touching raw applicant PII."""
    orgs = db.query(Organization).all()
    gov_by_org = {
        g.organization_id: g for g in db.query(AgencyTenantGovernance).all()
    }
    apps = db.query(AgencyOnboardingApplication).all()

    active_orgs = [o for o in orgs if o.status == "active"]
    suspended_orgs = [o for o in orgs if o.status in ("suspended", "archived")]
    pending_kyb = [a for a in apps if a.kyb_status == "pending_kyb"]
    clarification_kyb = [a for a in apps if a.kyb_status == "clarification_requested"]

    total_mrr = sum((gov_by_org[o.id].mrr_usd if o.id in gov_by_org else 0.0) for o in active_orgs)
    total_seats_provisioned = sum((gov_by_org[o.id].seat_limit if o.id in gov_by_org else 5) for o in active_orgs)
    total_active_staff = db.query(OrganizationMembership).filter(OrganizationMembership.status == "active").count()
    total_cases_network = db.query(ImmigrationCase).count()
    total_ai_runs = sum(
        max(
            db.query(DocumentProcessingRun).filter(DocumentProcessingRun.organization_id == o.id).count(),
            gov_by_org[o.id].ai_extractions_used_30d if o.id in gov_by_org else 0,
        )
        for o in orgs
    )
    total_calc_leads = sum(
        max(
            db.query(CalculatorAgencyLead).filter(CalculatorAgencyLead.organization_id == o.id).count(),
            gov_by_org[o.id].calculator_leads_30d if o.id in gov_by_org else 0,
        )
        for o in orgs
    )

    return {
        "zero_pii_boundary_enforced": True,
        "active_agencies_count": len(active_orgs),
        "suspended_agencies_count": len(suspended_orgs),
        "pending_kyb_count": len(pending_kyb),
        "clarification_kyb_count": len(clarification_kyb),
        "recurring_mrr_usd": round(total_mrr, 2),
        "seats_active": total_active_staff,
        "seats_provisioned": total_seats_provisioned,
        "network_cases_count": total_cases_network,
        "ai_extractions_30d": total_ai_runs,
        "calculator_leads_30d": total_calc_leads,
    }


@router.get("/super-admin/applications")
def list_super_admin_kyb_applications(
    status_filter: str | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("platform:kyb:review")),
    db: Session = Depends(get_db),
):
    """Lists B2B Visa Agency KYB onboarding applications for Documento HQ adjudication."""
    query = db.query(AgencyOnboardingApplication)
    if status_filter:
        query = query.filter(AgencyOnboardingApplication.kyb_status == status_filter)
    items = query.order_by(AgencyOnboardingApplication.created_at.desc()).all()
    return [
        {
            "id": str(a.id),
            "dossier_code": f"KYB-{str(a.id)[:8].upper()}",
            "legal_entity_name": a.legal_entity_name,
            "trading_name": a.trading_name,
            "requested_slug": a.requested_slug,
            "hq_country": a.hq_country,
            "hq_city": a.hq_city,
            "corporate_domain": a.corporate_domain,
            "tax_registration_id": a.tax_registration_id,
            "contact_full_name": a.contact_full_name,
            "contact_work_email": a.contact_work_email,
            "contact_phone": a.contact_phone,
            "kyb_track": a.kyb_track,
            "regulatory_body": a.regulatory_body,
            "license_number": a.license_number,
            "co_counsel_details": a.co_counsel_details,
            "target_corridors": a.target_corridors_json or [],
            "estimated_monthly_cases": a.estimated_monthly_cases,
            "requested_seats": a.requested_seats,
            "branch_count": a.branch_count,
            "selected_plan_tier": a.selected_plan_tier,
            "kyb_status": a.kyb_status,
            "reviewer_notes": a.reviewer_notes,
            "provisioned_organization_id": (
                str(a.provisioned_organization_id) if a.provisioned_organization_id else None
            ),
            "created_at": a.created_at.isoformat(),
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
        }
        for a in items
    ]


@router.post("/super-admin/applications/{application_id}/decision")
def adjudicate_kyb_application(
    application_id: uuid.UUID,
    payload: KybDecisionRequest,
    ctx: AuthContext = Depends(require_permission("platform:agencies:manage")),
    db: Session = Depends(get_db),
):
    """
    Approves, requests clarification, or rejects an agency KYB application.
    On `approve`, atomically provisions the Organization, AgencyTenantGovernance, Owner User,
    OrganizationMembership (`master_admin`), default service catalog, and one-time activation token.
    """
    app_record = (
        db.query(AgencyOnboardingApplication)
        .filter(AgencyOnboardingApplication.id == application_id)
        .first()
    )
    if not app_record:
        raise EntityNotFoundError("AgencyOnboardingApplication", application_id)

    if payload.decision in ("request_clarification", "reject") and (
        not payload.reviewer_notes or len(payload.reviewer_notes.strip()) < 5
    ):
        raise ValidationError(
            "A clear reviewer note (at least 5 characters) is required when requesting clarification or rejecting a KYB dossier."
        )

    now = datetime.now(timezone.utc)
    app_record.reviewer_notes = payload.reviewer_notes
    app_record.reviewed_by_email = ctx.email
    app_record.reviewed_at = now

    if payload.decision == "request_clarification":
        app_record.kyb_status = "clarification_requested"
        db.commit()
        return {"status": "clarification_requested", "application_id": str(app_record.id)}

    if payload.decision == "reject":
        app_record.kyb_status = "rejected"
        db.commit()
        return {"status": "rejected", "application_id": str(app_record.id)}

    # Approve & Provision Tenant Workspace
    if app_record.kyb_status == "approved" and app_record.provisioned_organization_id:
        raise ConflictError("This KYB application has already been approved and provisioned.")

    slug = _normalize_slug(app_record.requested_slug)
    if db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    plan_key = payload.override_plan_tier or app_record.selected_plan_tier
    plan_cfg = PLAN_DEFAULTS.get(plan_key, PLAN_DEFAULTS["growth"])

    org = Organization(
        name=app_record.legal_entity_name,
        slug=slug,
        status="active",
    )
    db.add(org)
    db.flush()

    gov = AgencyTenantGovernance(
        organization_id=org.id,
        trading_name=app_record.trading_name,
        plan_tier=plan_key,
        mrr_usd=plan_cfg["mrr_usd"],
        billing_status=plan_cfg["billing_status"],
        kyb_track=app_record.kyb_track,
        regulatory_body=app_record.regulatory_body,
        license_number=app_record.license_number,
        hq_country=app_record.hq_country,
        hq_city=app_record.hq_city,
        seat_limit=max(app_record.requested_seats, plan_cfg["seat_limit"]),
        monthly_case_quota=plan_cfg["monthly_case_quota"],
        monthly_ai_extraction_quota=plan_cfg["monthly_ai_extraction_quota"],
        enabled_corridors_json=app_record.target_corridors_json or ["CA"],
        feature_flags_json={
            "ai_lab": True,
            "cobranded_calculators": True,
            "multi_branch": app_record.branch_count > 1 or plan_key in ("growth", "enterprise"),
            "custom_rules": plan_key in ("growth", "enterprise"),
        },
        branding_json={
            "primary_color": "#063C3D",
            "tagline": f"Official PR & Visa Assessment Partner — {app_record.trading_name}",
            "setup_completed": False,
        },
    )
    db.add(gov)

    # Ensure Managing Partner user & master_admin role membership
    owner_email = app_record.contact_work_email.lower().strip()
    temp_password = f"DocPartner!{uuid.uuid4().hex[:6].upper()}"
    user = db.query(User).filter(User.email == owner_email).first()
    if not user:
        user = User(
            organization_id=org.id,
            email=owner_email,
            name=app_record.contact_full_name,
            full_name=app_record.contact_full_name,
            password_hash=hash_password(temp_password),
            phone=app_record.contact_phone,
            status="active",
        )
        db.add(user)
        db.flush()
    else:
        user.organization_id = org.id
        user.status = "active"
        db.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=user.id,
        status="active",
    )
    db.add(membership)
    db.flush()

    role_obj = db.query(Role).filter(Role.code == RoleCode.MASTER_ADMIN.value).first()
    if not role_obj:
        role_obj = Role(
            code=RoleCode.MASTER_ADMIN.value,
            name="Managing Partner / Firm Owner",
            description="Full intra-agency administrative control",
        )
        db.add(role_obj)
        db.flush()

    db.add(MembershipRole(membership_id=membership.id, role_id=role_obj.id))

    # Seed default service items for the newly provisioned agency
    BillingService.seed_default_services(db, org.id)

    raw_activation_token = generate_secure_random_token(24)
    app_record.kyb_status = "approved"
    app_record.provisioned_organization_id = org.id
    app_record.activation_token_hash = hash_opaque_token(raw_activation_token)

    db.add(
        AuditEvent(
            organization_id=org.id,
            actor_id=ctx.user_id,
            action="platform.agency_provisioned",
            object_type="organization",
            object_id=str(org.id),
            metadata_json={
                "application_id": str(app_record.id),
                "plan_tier": plan_key,
                "regulatory_body": app_record.regulatory_body,
                "license_number": app_record.license_number,
            },
            occurred_at=now,
        )
    )
    db.commit()

    return {
        "status": "approved",
        "application_id": str(app_record.id),
        "organization_id": str(org.id),
        "slug": org.slug,
        "owner_email": owner_email,
        "temporary_owner_password": temp_password,
        "activation_token": raw_activation_token,
        "cobranded_calculator_url": f"/calculators?agency={org.slug}",
    }


@router.get("/super-admin/agencies")
def list_super_admin_partner_agencies(
    ctx: AuthContext = Depends(require_permission("platform:agencies:read")),
    db: Session = Depends(get_db),
):
    """Lists all provisioned visa agencies with aggregate Zero-PII telemetry and health status."""
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()
    gov_by_org = {g.organization_id: g for g in db.query(AgencyTenantGovernance).all()}
    now = datetime.now(timezone.utc)

    results = []
    for o in orgs:
        gov = gov_by_org.get(o.id)
        seats_used = (
            db.query(OrganizationMembership)
            .filter(OrganizationMembership.organization_id == o.id, OrganizationMembership.status == "active")
            .count()
        )
        cases_count = db.query(ImmigrationCase).filter(ImmigrationCase.organization_id == o.id).count()
        seat_limit = gov.seat_limit if gov else 15
        case_quota = gov.monthly_case_quota if gov else 120
        ai_quota = gov.monthly_ai_extraction_quota if gov else 1500
        ai_used = gov.ai_extractions_used_30d if gov else 0

        if o.status != "active":
            health = "suspended"
        elif cases_count == 0 and (now - o.created_at.replace(tzinfo=timezone.utc)).days <= 14:
            health = "onboarding"
        elif cases_count == 0:
            health = "at_risk"
        else:
            health = "thriving"

        support_active = bool(
            gov
            and gov.support_grant_expires_at
            and gov.support_grant_expires_at.replace(tzinfo=timezone.utc) > now
        )

        results.append({
            "organization_id": str(o.id),
            "legal_entity_name": o.name,
            "trading_name": gov.trading_name if gov else o.name,
            "slug": o.slug,
            "status": o.status,
            "health": health,
            "plan_tier": gov.plan_tier if gov else "growth",
            "mrr_usd": gov.mrr_usd if gov else 499.0,
            "billing_status": gov.billing_status if gov else "active",
            "kyb_track": gov.kyb_track if gov else "regulated_counsel",
            "regulatory_body": gov.regulatory_body if gov else "CICC",
            "license_number": gov.license_number if gov else "VERIFIED",
            "hq_city": gov.hq_city if gov else "Toronto",
            "hq_country": gov.hq_country if gov else "CA",
            "seats_used": seats_used,
            "seat_limit": seat_limit,
            "cases_active_count": cases_count,
            "monthly_case_quota": case_quota,
            "ai_extractions_used_30d": ai_used,
            "monthly_ai_extraction_quota": ai_quota,
            "calculator_leads_30d": gov.calculator_leads_30d if gov else 0,
            "enabled_corridors": gov.enabled_corridors_json if gov else ["CA", "US", "UK"],
            "feature_flags": gov.feature_flags_json if gov else {
                "ai_lab": True,
                "cobranded_calculators": True,
                "multi_branch": True,
                "custom_rules": True,
            },
            "support_grant_active": support_active,
            "support_grant_expires_at": (
                gov.support_grant_expires_at.isoformat() if (gov and gov.support_grant_expires_at) else None
            ),
            "support_grant_reason": gov.support_grant_reason if support_active and gov else None,
            "created_at": o.created_at.isoformat(),
        })
    return results


@router.patch("/super-admin/agencies/{org_id}/governance")
def update_agency_tenant_governance(
    org_id: uuid.UUID,
    payload: GovernancePatchRequest,
    ctx: AuthContext = Depends(require_permission("platform:quotas:manage")),
    db: Session = Depends(get_db),
):
    """Updates an agency's SaaS tier, quotas, feature flags, or triggers emergency tenant freeze."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise EntityNotFoundError("Organization", org_id)

    gov = db.query(AgencyTenantGovernance).filter(AgencyTenantGovernance.organization_id == org.id).first()
    if not gov:
        gov = AgencyTenantGovernance(organization_id=org.id, trading_name=org.name)
        db.add(gov)

    now = datetime.now(timezone.utc)
    if payload.plan_tier:
        gov.plan_tier = payload.plan_tier
        gov.mrr_usd = PLAN_DEFAULTS[payload.plan_tier]["mrr_usd"]
        gov.billing_status = PLAN_DEFAULTS[payload.plan_tier]["billing_status"]

    if payload.seat_limit is not None:
        gov.seat_limit = payload.seat_limit
    if payload.monthly_case_quota is not None:
        gov.monthly_case_quota = payload.monthly_case_quota
    if payload.monthly_ai_extraction_quota is not None:
        gov.monthly_ai_extraction_quota = payload.monthly_ai_extraction_quota
    if payload.feature_flags is not None:
        gov.feature_flags_json = {**(gov.feature_flags_json or {}), **payload.feature_flags}

    if payload.status is not None and payload.status != org.status:
        org.status = payload.status
        gov.billing_status = "suspended" if payload.status == "suspended" else "active"
        if payload.status == "suspended":
            # Immediately revoke active sessions on emergency freeze without deleting data
            db.query(UserSession).filter(
                UserSession.organization_id == org.id,
                UserSession.revoked_at.is_(None),
            ).update({"revoked_at": now}, synchronize_session=False)

    db.add(
        AuditEvent(
            organization_id=org.id,
            actor_id=ctx.user_id,
            action="platform.agency_governance_updated",
            object_type="organization",
            object_id=str(org.id),
            metadata_json={
                "status": org.status,
                "plan_tier": gov.plan_tier,
                "seat_limit": gov.seat_limit,
                "monthly_case_quota": gov.monthly_case_quota,
                "monthly_ai_extraction_quota": gov.monthly_ai_extraction_quota,
                "reason": payload.reason or "Updated by Documento HQ Control Plane",
            },
            occurred_at=now,
        )
    )
    db.commit()
    return {
        "organization_id": str(org.id),
        "status": org.status,
        "plan_tier": gov.plan_tier,
        "mrr_usd": gov.mrr_usd,
        "seat_limit": gov.seat_limit,
        "monthly_case_quota": gov.monthly_case_quota,
        "monthly_ai_extraction_quota": gov.monthly_ai_extraction_quota,
        "feature_flags": gov.feature_flags_json,
    }


class SalesLedProvisionRequest(BaseModel):
    legal_entity_name: str = Field(..., min_length=2, max_length=220)
    trading_name: str = Field(..., min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=100)
    owner_full_name: str = Field(..., min_length=2, max_length=200)
    owner_email: EmailStr
    hq_country: str = Field(default="Canada", max_length=64)
    hq_city: str = Field(default="Toronto", max_length=120)
    kyb_track: str = Field(default="regulated_counsel", pattern="^(regulated_counsel|overseas_consultancy)$")
    regulatory_body: str = Field(default="CICC", max_length=64)
    license_number: str = Field(..., min_length=2, max_length=100)
    enabled_corridors: list[str] = Field(default_factory=lambda: ["CA"])
    plan_tier: str = Field(default="growth", pattern="^(pilot_14d|boutique|growth|enterprise)$")
    custom_mrr_usd: float | None = Field(default=None, ge=0.0)
    custom_seat_limit: int | None = Field(default=None, ge=1, le=1000)


@router.post("/super-admin/agencies/provision-direct", status_code=status.HTTP_201_CREATED)
def provision_sales_led_agency_direct(
    payload: SalesLedProvisionRequest,
    ctx: AuthContext = Depends(require_permission("platform:agencies:manage")),
    db: Session = Depends(get_db),
):
    """Sales-led agency provisioning after a demo call (custom deal MRR, seats, and instant workspace invite)."""
    slug = _normalize_slug(payload.slug or payload.trading_name)
    if db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    plan_cfg = PLAN_DEFAULTS.get(payload.plan_tier, PLAN_DEFAULTS["growth"])
    effective_mrr = (
        0.0
        if payload.plan_tier == "pilot_14d"
        else (payload.custom_mrr_usd if payload.custom_mrr_usd is not None else plan_cfg["mrr_usd"])
    )
    effective_seats = payload.custom_seat_limit or plan_cfg["seat_limit"]

    org = Organization(
        name=payload.legal_entity_name.strip(),
        slug=slug,
        status="active",
    )
    db.add(org)
    db.flush()

    gov = AgencyTenantGovernance(
        organization_id=org.id,
        trading_name=payload.trading_name.strip(),
        plan_tier=payload.plan_tier,
        mrr_usd=effective_mrr,
        billing_status="trialing" if payload.plan_tier == "pilot_14d" else "active",
        kyb_track=payload.kyb_track,
        regulatory_body=payload.regulatory_body,
        license_number=payload.license_number.strip(),
        hq_country=payload.hq_country.strip(),
        hq_city=payload.hq_city.strip(),
        seat_limit=effective_seats,
        monthly_case_quota=plan_cfg["monthly_case_quota"],
        monthly_ai_extraction_quota=plan_cfg["monthly_ai_extraction_quota"],
        enabled_corridors_json=payload.enabled_corridors or ["CA"],
        feature_flags_json={
            "ai_lab": True,
            "cobranded_calculators": True,
            "multi_branch": effective_seats >= 10 or payload.plan_tier == "enterprise",
            "custom_rules": payload.plan_tier != "pilot_14d",
        },
        branding_json={
            "primary_color": "#063C3D",
            "tagline": f"Official PR & Visa Assessment Partner — {payload.trading_name.strip()}",
            "setup_completed": False,
        },
    )
    db.add(gov)

    owner_email = payload.owner_email.lower().strip()
    temp_password = f"DocInvite!{uuid.uuid4().hex[:6].upper()}"
    user = db.query(User).filter(User.email == owner_email).first()
    if not user:
        user = User(
            organization_id=org.id,
            email=owner_email,
            name=payload.owner_full_name.strip(),
            full_name=payload.owner_full_name.strip(),
            password_hash=hash_password(temp_password),
            status="active",
        )
        db.add(user)
        db.flush()

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=user.id,
        status="active",
    )
    db.add(membership)
    db.flush()

    role_obj = db.query(Role).filter(Role.code == RoleCode.MASTER_ADMIN.value).first()
    if not role_obj:
        role_obj = Role(
            code=RoleCode.MASTER_ADMIN.value,
            name="Managing Partner / Firm Owner",
            description="Full intra-agency administrative control",
        )
        db.add(role_obj)
        db.flush()

    db.add(MembershipRole(membership_id=membership.id, role_id=role_obj.id))
    BillingService.seed_default_services(db, org.id)

    db.add(
        AuditEvent(
            organization_id=org.id,
            actor_id=ctx.user_id,
            action="platform.sales_led_provisioned",
            object_type="organization",
            object_id=str(org.id),
            metadata_json={
                "slug": slug,
                "plan_tier": payload.plan_tier,
                "mrr_usd": effective_mrr,
                "seat_limit": effective_seats,
            },
            occurred_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    return {
        "organization_id": str(org.id),
        "slug": slug,
        "owner_email": owner_email,
        "temporary_owner_password": temp_password,
        "mrr_usd": effective_mrr,
        "seat_limit": effective_seats,
        "cobranded_calculator_url": f"/calculators?agency={slug}",
    }


