"""Comprehensive test suite for Phase 6: Rules & Checklist Engine.

Validates all Phase 6 deliverables:
1. Exact Phase 6 Rule JSON Schema conformance.
2. Country Registry (Canada first, USA second, AU/NZ core next, UK, Germany, Russia).
3. Pathway Taxonomy across all 8 standard categories.
4. Coverage Matrix with SUPPORTED, PARTIAL, UNVERIFIED, UNSUPPORTED states.
5. Authentic Production Rule Packs (no placeholder examples in production).
6. Fact-Grounded Checklist Generation with Applicant Facts evaluation.
7. Safe Stop Guarantee (no unrelated fallback checklists for unsupported/unverified pathways).
8. Stale/Unverified Rules exclusion.
9. Case Pinning and Explicit Migration (updates do not silently rewrite active cases).
10. Professional Review & Verification Attestation.
"""
from datetime import datetime, timezone, timedelta
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.main import app
from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    RuleSet,
    RuleSetVersion,
    RuleRequirement,
    AuditEvent,
)
from backend.app.rules.taxonomy import (
    CoverageStatus,
    PathwayCategory,
    COUNTRY_REGISTRY,
    PATHWAY_TAXONOMY,
    get_country_registry,
    get_pathways_by_jurisdiction,
    get_pathway_coverage,
    get_coverage_matrix,
)
from backend.app.rules.seed_production_packs import seed_production_rule_packs
from backend.app.rules.checklist_generator import generate_pathway_checklist, is_rule_stale
from backend.app.rules.case_migration import (
    get_case_pinned_checklist,
    compare_rule_versions,
    migrate_case_rule_version,
)


@pytest.fixture
def phase6_setup(db: Session):
    """Sets up organization, users, and clients for Phase 6 testing."""
    org = Organization(
        name="Phase 6 Immigration Law Group",
        slug=f"p6-law-{uuid.uuid4().hex[:6]}",
    )
    db.add(org)
    db.flush()

    admin = User(
        email=f"partner-{uuid.uuid4().hex[:6]}@lawgroup.com",
        full_name="Senior Partner RCIC/Esq",
        password_hash="test-pass-hash",
        status="active",
    )
    db.add(admin)
    db.flush()

    client = ClientProfile(
        organization_id=org.id,
        user_id=admin.id,
        first_name="Priya",
        last_name="Sharma",
        email=f"priya-{uuid.uuid4().hex[:6]}@client.com",
        nationality="IND",
    )
    db.add(client)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client.id,
        case_number=f"CAS-P6-{uuid.uuid4().hex[:6].upper()}",
        jurisdiction="CA",
        visa_category="CA_EXPRESS_ENTRY_FSW",
        title="Express Entry FSW Application",
        status="active",
    )


    db.add(case)
    db.commit()

    return {
        "org": org,
        "admin": admin,
        "client": client,
        "case": case,
    }


def test_country_registry_priority_order():
    """Validates country registry priorities: Canada first, USA second, AU/NZ core next, UK partial, Germany/Russia unverified."""
    countries = get_country_registry()
    codes = [c.code for c in countries]

    assert codes[0] == "CA", "Canada must be Priority 1"
    assert codes[1] == "US", "USA must be Priority 2"
    assert "AU" in codes[2:4] and "NZ" in codes[2:4], "Australia and New Zealand must be Priority 3 core"
    assert codes[4] == "GB", "UK must follow core jurisdictions"
    assert "DE" in codes[5:] and "RU" in codes[5:], "Germany and Russia must be listed later"

    ca = COUNTRY_REGISTRY["CA"]
    assert "IRCC" in ca.primary_authority
    assert ca.coverage_status == CoverageStatus.SUPPORTED

    us = COUNTRY_REGISTRY["US"]
    assert "USCIS" in us.primary_authority
    assert us.coverage_status == CoverageStatus.SUPPORTED

    de = COUNTRY_REGISTRY["DE"]
    assert de.coverage_status == CoverageStatus.UNVERIFIED


def test_pathway_taxonomy_coverage_categories():
    """Validates that pathway taxonomy covers required categories."""
    categories = {p.category for p in PATHWAY_TAXONOMY.values()}
    assert PathwayCategory.PR_RESIDENCE in categories
    assert PathwayCategory.STUDY in categories
    assert PathwayCategory.WORK in categories
    assert PathwayCategory.FAMILY in categories
    assert PathwayCategory.CITIZENSHIP in categories

    ca_pathways = get_pathways_by_jurisdiction("CA")
    assert any(p.pathway_key == "CA_EXPRESS_ENTRY_FSW" for p in ca_pathways)
    assert any(p.pathway_key == "CA_STUDY_PERMIT" for p in ca_pathways)

    us_pathways = get_pathways_by_jurisdiction("US")
    assert any(p.pathway_key == "US_H1B" for p in us_pathways)
    assert any(p.pathway_key == "US_EB1A" for p in us_pathways)


def test_coverage_matrix_structure():
    """Validates that coverage matrix reports accurate summary and per-country metrics."""
    matrix = get_coverage_matrix()
    summary = matrix["coverage_summary"]

    assert summary["total_countries"] >= 7
    assert summary["supported_countries"] >= 4  # CA, US, AU, NZ
    assert summary["total_pathways"] >= 10

    # Ensure no country is unmapped
    for country_item in matrix["countries"]:
        c = country_item["country"]
        assert c["code"] in COUNTRY_REGISTRY
        assert country_item["pathways_count"] >= 1


def test_production_rule_pack_seeding_and_no_placeholders(db: Session, phase6_setup):
    """Validates seeding production rule packs for CA, US, AU, NZ and verifies ZERO placeholder sources."""
    org = phase6_setup["org"]
    admin = phase6_setup["admin"]

    result = seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)
    assert result["status"] == "success"
    assert result["seeded_packs_count"] >= 4

    # Verify requirements have authentic, real government URLs (no 'official-source.example')
    reqs = db.scalars(
        select(RuleRequirement).where(RuleRequirement.organization_id == org.id)
    ).all()
    assert len(reqs) >= 15

    for req in reqs:
        assert req.source_url is not None, f"Rule {req.code} missing source_url"
        assert "example.com" not in req.source_url, f"Rule {req.code} has placeholder URL: {req.source_url}"
        assert "official-source.example" not in req.source_url, f"Rule {req.code} has placeholder URL: {req.source_url}"
        assert (
            "canada.ca" in req.source_url
            or "uscis.gov" in req.source_url
            or "doleta.gov" in req.source_url
            or "homeaffairs.gov.au" in req.source_url
            or "immigration.govt.nz" in req.source_url
            or req.source_url.endswith(".gov")
        ), f"Rule {req.code} has unverified source URL: {req.source_url}"


        # Verify approver is populated
        assert req.approved_by is not None, f"Rule {req.code} missing human approver"


def test_exact_phase6_rule_json_conformance(db: Session, phase6_setup):
    """Verifies that to_phase6_dict() outputs the exact JSON specification required by prompt:
    {
      "rule_id": "CA-EXAMPLE-001",
      "jurisdiction": "CA",
      "pathway": "EXAMPLE_PATHWAY",
      "requirement_key": "identity.passport",
      "status": "DRAFT_UNVERIFIED",
      "source_url": "https://official-source.example/",
      "effective_from": "YYYY-MM-DD",
      "effective_to": null,
      "last_verified_at": null,
      "version": 1,
      "approved_by": null
    }
    """
    org = phase6_setup["org"]
    admin = phase6_setup["admin"]

    seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)

    fsw_req = db.scalar(
        select(RuleRequirement)
        .where(
            RuleRequirement.organization_id == org.id,
            RuleRequirement.code == "CA-FSW-ID-001",
        )
    )
    assert fsw_req is not None

    rule_dict = fsw_req.to_phase6_dict()

    # Exact key checks
    required_keys = [
        "rule_id",
        "jurisdiction",
        "pathway",
        "requirement_key",
        "status",
        "source_url",
        "effective_from",
        "effective_to",
        "last_verified_at",
        "version",
        "approved_by",
    ]
    for key in required_keys:
        assert key in rule_dict, f"Missing key '{key}' in Phase 6 JSON dict"

    assert rule_dict["rule_id"] == "CA-FSW-ID-001"
    assert rule_dict["jurisdiction"] == "CA"
    assert rule_dict["requirement_key"] == "identity.passport"
    assert rule_dict["status"] == "VERIFIED"
    assert rule_dict["version"] >= 1
    assert "canada.ca" in rule_dict["source_url"]


def test_safe_stop_on_unsupported_pathway(db: Session, phase6_setup):
    """CRITICAL: Unsupported pathway stops safely with SUPPORTED / PARTIAL / UNVERIFIED / UNSUPPORTED state;
    no unrelated fallback checklist is ever generated.
    """
    org = phase6_setup["org"]

    # 1. Non-existent / unmapped pathway in registered jurisdiction
    result = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction="CA",
        pathway="CA_UNSUPPORTED_NONEXISTENT_VISA",
    )
    assert result["status"] == "UNSUPPORTED"
    assert result["is_supported"] is False
    assert result["can_generate_checklist"] is False
    assert result["checklist"] == [], "Unsupported pathway must return zero checklist items (no fallback)"
    assert "SAFE STOP" in result["disclaimer"]

    # 2. Entirely unmapped jurisdiction
    result2 = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction="XX",
        pathway="XX_ANY_VISA",
    )
    assert result2["status"] == "UNSUPPORTED"
    assert result2["checklist"] == [], "Unmapped jurisdiction must stop safely with zero items"


def test_safe_stop_on_unverified_pathway(db: Session, phase6_setup):
    """CRITICAL: Unverified pathways (e.g. Germany Chancenkarte, Russia VKS) stop safely with UNVERIFIED status.
    Draft or unverified rules cannot be presented as current for legal filings.
    """
    org = phase6_setup["org"]

    result = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction="DE",
        pathway="DE_CHANCENKARTE",
    )
    assert result["status"] == "UNVERIFIED"
    assert result["is_supported"] is False
    assert result["can_generate_checklist"] is False
    assert result["checklist"] == [], "Unverified pathway must return zero checklist items"
    assert "Stale/unverified rules cannot be presented as current" in result["disclaimer"]


def test_fact_grounded_checklist_generation(db: Session, phase6_setup):
    """Validates applicant facts evaluation:
    Express Entry FSW waives proof of settlement funds if applicant has a valid Canadian job offer.
    """
    org = phase6_setup["org"]
    admin = phase6_setup["admin"]

    seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)

    # Case A: Applicant without Canadian job offer -> settlement funds is applicable
    facts_no_offer = {
        "has_valid_canadian_job_offer": False,
        "family_size": 1,
    }
    checklist_a = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction="CA",
        pathway="CA_EXPRESS_ENTRY_FSW",
        applicant_facts=facts_no_offer,
    )
    assert checklist_a["status"] == "SUPPORTED"
    assert checklist_a["is_supported"] is True
    assert len(checklist_a["checklist"]) > 0

    funds_item_a = next(
        (item for item in checklist_a["checklist"] if item["rule_id"] == "CA-FSW-FUNDS-005"),
        None,
    )
    assert funds_item_a is not None, "Settlement funds requirement must be in checklist when no job offer"
    assert funds_item_a["is_applicable"] is True

    # Case B: Applicant WITH valid Canadian job offer -> settlement funds is waived
    facts_with_offer = {
        "has_valid_canadian_job_offer": True,
        "family_size": 1,
    }

    checklist_b = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction="CA",
        pathway="CA_EXPRESS_ENTRY_FSW",
        applicant_facts=facts_with_offer,
    )
    assert checklist_b["status"] == "SUPPORTED"
    funds_item_b = next(
        (item for item in checklist_b["checklist"] if item["rule_id"] == "CA-FSW-FUNDS-005"),
        None,
    )
    assert funds_item_b is None, "Settlement funds requirement must be excluded from applicable checklist when applicant has job offer"


def test_stale_rule_detection_and_exclusion(db: Session, phase6_setup):
    """CRITICAL: Stale/unverified rules (>365 days unverified or past effective_to) cannot be presented as current."""
    org = phase6_setup["org"]
    admin = phase6_setup["admin"]

    seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)

    # Fetch a rule and make it stale by setting last_verified_at to 400 days in the past
    req = db.scalar(
        select(RuleRequirement).where(
            RuleRequirement.organization_id == org.id,
            RuleRequirement.code == "CA-FSW-LANG-002",
        )
    )
    assert req is not None
    req.last_verified_at = datetime.now(timezone.utc) - timedelta(days=400)
    db.commit()

    as_of = datetime.now(timezone.utc)
    assert is_rule_stale(req, as_of) is True

    # Generate checklist: language test must be excluded from applicable checklist and listed in stale_rules_excluded
    result = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction="CA",
        pathway="CA_EXPRESS_ENTRY_FSW",
        as_of_date=as_of,
    )
    assert result["stale_rules_excluded_count"] >= 1
    stale_codes = [s["rule_id"] for s in result["stale_rules_excluded"]]
    assert "CA-FSW-LANG-002" in stale_codes

    active_codes = [c["rule_id"] for c in result["checklist"]]
    assert "CA-FSW-LANG-002" not in active_codes, "Stale rule must not be presented as current in active checklist"


def test_case_pinning_and_explicit_migration(db: Session, phase6_setup):
    """CRITICAL: Existing cases retain a pinned checklist snapshot; updates do not silently rewrite active cases."""
    org = phase6_setup["org"]
    admin = phase6_setup["admin"]
    case = phase6_setup["case"]

    seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)

    # 1. Generate and pin checklist for case
    gen_result = generate_pathway_checklist(
        db=db,
        org_id=org.id,
        jurisdiction=case.jurisdiction,
        pathway=case.visa_category,
        applicant_facts={"has_canadian_job_offer": False},
        case_id=case.id,
        pin_to_case=True,
    )
    assert gen_result["is_pinned_to_case"] is True

    db.refresh(case)
    assert case.pinned_checklist_snapshot is not None
    assert case.pinned_rule_version_id is not None
    initial_version_id = case.pinned_rule_version_id
    initial_pinned_items_count = len(case.pinned_checklist_snapshot["checklist"])

    # 2. Simulate publisher creating a new RuleSetVersion v2.0.0 with a modified requirement
    fsw_rs = db.scalar(
        select(RuleSet).where(
            RuleSet.organization_id == org.id,
            RuleSet.code == "CA-EXPRESS-ENTRY-FSW",
        )
    )
    v1 = db.get(RuleSetVersion, initial_version_id)

    v2 = RuleSetVersion(
        organization_id=org.id,
        rule_set_id=fsw_rs.id,
        version_number="2.0.0",
        status="published",
        change_summary="Version 2.0 with enhanced biometric and digital identity checks",
        author_user_id=admin.id,
        approved_by_user_id=admin.id,
        published_at=datetime.now(timezone.utc),
        approval_history=[{"action": "published", "by": "RCIC"}],
    )
    db.add(v2)
    db.flush()

    # Add a brand new requirement to v2
    new_req = RuleRequirement(
        organization_id=org.id,
        rule_set_version_id=v2.id,
        code="CA-FSW-BIO-008",
        requirement_key="biometrics.digital_id",
        title="Digital Biometrics Verification & IRCC Facial Match",
        description="Mandatory 2026 digital biometric verification standard.",
        category="statutory_criteria",
        is_mandatory=True,
        priority=8,
        status="VERIFIED",
        source_url="https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics.html",
        effective_from=datetime(2026, 1, 1, tzinfo=timezone.utc),
        last_verified_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        approved_by="Lead Canadian Immigration Counsel & RCIC",
    )
    db.add(new_req)

    # Copy passport requirement to v2
    p_req = db.scalar(select(RuleRequirement).where(RuleRequirement.rule_set_version_id == v1.id, RuleRequirement.code == "CA-FSW-ID-001"))
    if p_req:
        db.add(RuleRequirement(
            organization_id=org.id,
            rule_set_version_id=v2.id,
            code=p_req.code,
            requirement_key=p_req.requirement_key,
            title=p_req.title,
            description=p_req.description,
            category=p_req.category,
            is_mandatory=p_req.is_mandatory,
            priority=p_req.priority,
            status=p_req.status,
            source_url=p_req.source_url,
            effective_from=p_req.effective_from,
            last_verified_at=p_req.last_verified_at,
            approved_by=p_req.approved_by,
        ))
    db.commit()

    # Set alert that rule update is available, but DO NOT modify case snapshot automatically!
    case.rules_update_available = True
    case.latest_available_version_id = v2.id
    db.commit()

    # 3. Verify that the active case RETAINS its pinned v1.0.0 snapshot unchanged!
    db.refresh(case)
    pinned_info = get_case_pinned_checklist(case)
    assert pinned_info["is_pinned"] is True
    assert pinned_info["pinned_rule_version_id"] == str(initial_version_id)
    assert len(pinned_info["snapshot"]["checklist"]) == initial_pinned_items_count
    # Ensure the new biometric requirement is NOT in the pinned checklist
    pinned_codes = [c["rule_id"] for c in pinned_info["snapshot"]["checklist"]]
    assert "CA-FSW-BIO-008" not in pinned_codes, "Publishing v2 must NEVER silently alter active case checklist!"

    # 4. Compare versions
    diff = compare_rule_versions(v1, v2)
    assert diff["added_count"] >= 1
    added_codes = [a["code"] for a in diff["requirements_added"]]
    assert "CA-FSW-BIO-008" in added_codes

    # 5. Explicit Case Migration
    migration_result = migrate_case_rule_version(
        db=db,
        case=case,
        target_version_id=v2.id,
        migration_reason="Client approved upgrade to 2026 digital biometric standards.",
        authorized_user_id=admin.id,
        authorized_user_email=admin.email,
    )
    assert migration_result["success"] is True
    assert migration_result["to_version_number"] == "2.0.0"

    # Verify audit event was logged
    audit = db.scalar(
        select(AuditEvent).where(
            AuditEvent.organization_id == org.id,
            AuditEvent.action == "case.rule_pack_migrated",
            AuditEvent.object_id == str(case.id),
        )
    )
    assert audit is not None
    assert audit.metadata_json["to_version_number"] == "2.0.0"


    # Verify case state is now pinned to v2
    db.refresh(case)
    assert case.pinned_rule_version_id == v2.id
    assert case.rules_update_available is False
    migrated_pinned_codes = [c["rule_id"] for c in case.pinned_checklist_snapshot["checklist"]]
    assert "CA-FSW-BIO-008" in migrated_pinned_codes


def test_rest_api_endpoints(phase6_setup):
    """Validates the Phase 6 REST API endpoints through TestClient."""
    org = phase6_setup["org"]
    admin = phase6_setup["admin"]

    client = TestClient(app)

    headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(admin.id),
        "X-User-Role": "company_admin",
    }

    # 1. GET /api/v1/rules/countries
    resp = client.get("/api/v1/rules/countries", headers=headers)
    assert resp.status_code == 200
    countries = resp.json()
    assert len(countries) >= 7
    assert countries[0]["code"] == "CA"

    # 2. GET /api/v1/rules/taxonomy
    resp = client.get("/api/v1/rules/taxonomy?jurisdiction=CA", headers=headers)
    assert resp.status_code == 200
    ca_tax = resp.json()
    assert len(ca_tax) >= 2

    # 3. GET /api/v1/rules/coverage-matrix
    resp = client.get("/api/v1/rules/coverage-matrix", headers=headers)
    assert resp.status_code == 200
    matrix = resp.json()
    assert matrix["coverage_summary"]["total_countries"] >= 7

    # 4. POST /api/v1/rules/seed-production-packs
    resp = client.post("/api/v1/rules/seed-production-packs", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    # 5. POST /api/v1/rules/generate-checklist (Safe stop for unverified)
    resp = client.post(
        "/api/v1/rules/generate-checklist",
        json={"jurisdiction": "RU", "pathway": "RU_VKS"},
        headers=headers,
    )
    assert resp.status_code == 200
    ru_result = resp.json()
    assert ru_result["status"] == "UNVERIFIED"
    assert ru_result["checklist"] == []

    # 6. POST /api/v1/rules/generate-checklist (Supported CA FSW)
    resp = client.post(
        "/api/v1/rules/generate-checklist",
        json={
            "jurisdiction": "CA",
            "pathway": "CA_EXPRESS_ENTRY_FSW",
            "applicant_facts": {"has_valid_canadian_job_offer": False},

        },
        headers=headers,
    )
    assert resp.status_code == 200
    fsw_res = resp.json()
    assert fsw_res["status"] == "SUPPORTED"
    assert len(fsw_res["checklist"]) >= 5
