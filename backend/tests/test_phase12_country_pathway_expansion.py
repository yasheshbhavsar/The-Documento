"""Comprehensive Phase 12 Country and Pathway Expansion Test Suite.

Validates:
1. Priority 1: Canada pathways (defined inventory, IRCC source-linked, professional review, regression tests, visible status).
2. Priority 2: USA pathways (independent validation per pathway, zero legacy monolithic assumptions).
3. Priority 3: Australia & New Zealand (strict jurisdictional separation, separate authorities, distinct templates).
4. Priority 4: UK & Germany/Europe (country-specific rules; EU/Schengen is NOT a universal checklist).
5. Priority 5: Russia & other emerging destinations (UNVERIFIED safe-stop, no fallback checklists without validation).
6. Application Families: Broad coverage across 8 standard categories (Visitor, Study, Work, Family, PR/Residence,
   Citizenship, Humanitarian/Protection, Extensions/Renewals).
7. Rule Engine: Safe-stop refusals for unverified/unsupported pathways, partial coverage warnings, EU/Schengen notices.
8. API Endpoints: Filtered taxonomy queries, country registry, coverage matrix, and pathway validation dossier retrieval.
"""

from datetime import datetime, timezone
import uuid
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.main import app
from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    RuleSet,
    RuleRequirement,
)
from backend.app.rules.taxonomy import (
    CoverageStatus,
    PathwayCategory,
    COUNTRY_REGISTRY,
    PATHWAY_TAXONOMY,
    get_country_registry,
    get_pathways_by_jurisdiction,
    get_pathways_by_category,
    get_pathway_coverage,
    get_pathway_dossier,
    get_coverage_matrix,
)
from backend.app.rules.seed_production_packs import seed_production_rule_packs
from backend.app.rules.checklist_generator import generate_pathway_checklist


@pytest.fixture
def phase12_setup(db: Session):
    """Sets up organization and admin user for Phase 12 tests."""
    org = Organization(
        name="Phase 12 Global Expansion Law Group",
        slug=f"p12-law-{uuid.uuid4().hex[:6]}",
    )
    db.add(org)
    db.flush()

    admin = User(
        email=f"global-director-{uuid.uuid4().hex[:6]}@lawgroup.com",
        full_name="Global Practice Director & RCIC",
        password_hash="test-pass-hash",
        status="active",
    )
    db.add(admin)
    db.flush()

    seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)

    return {
        "org": org,
        "admin": admin,
    }


# ============================================================================
# PRIORITY 1: CANADA PATHWAYS VALIDATION
# ============================================================================


class TestPriority1CanadaPathways:
    """Validate Priority 1: Canada pathways have defined inventory, source links,
    professional review sign-off, regression test tags, and visible status.
    """

    def test_canada_jurisdiction_metadata(self):
        ca = COUNTRY_REGISTRY["CA"]
        assert ca.coverage_status == CoverageStatus.SUPPORTED
        assert "IRCC" in ca.primary_authority
        assert ca.priority_tier == 1
        assert "canada.ca" in ca.official_source_registry_url
        assert ca.release_conditions_status.get("defined_inventory") is True
        assert ca.release_conditions_status.get("source_linked_rule_pack") is True
        assert ca.release_conditions_status.get("professional_review") is True
        assert ca.release_conditions_status.get("regression_tests") is True
        assert ca.release_conditions_status.get("visible_status") is True

    def test_canada_pathway_inventory(self):
        ca_pathways = get_pathways_by_jurisdiction("CA")
        assert len(ca_pathways) >= 4

        keys = {p.pathway_key for p in ca_pathways}
        expected = {
            "CA_EXPRESS_ENTRY_FSW",
            "CA_STUDY_PERMIT",
            "CA_SPOUSAL_SPONSORSHIP",
            "CA_PGWP",
        }
        assert expected.issubset(keys)

    def test_canada_pathway_dossiers_and_reviews(self):
        for key in ["CA_EXPRESS_ENTRY_FSW", "CA_STUDY_PERMIT", "CA_SPOUSAL_SPONSORSHIP", "CA_PGWP"]:
            dossier = get_pathway_dossier(key)
            assert dossier is not None
            p = dossier["pathway"]
            assert p["coverage_status"] == CoverageStatus.SUPPORTED
            assert "IRP" in p["statutory_reference"]
            assert p["professional_reviewer"] is not None and len(p["professional_reviewer"]) > 0
            assert p["regression_test_suite"] is not None and len(p["regression_test_suite"]) > 0
            assert "canada.ca" in p["official_source_url"]

    def test_canada_rule_packs_in_db(self, db: Session, phase12_setup):
        org = phase12_setup["org"]
        ca_rulesets = db.scalars(
            select(RuleSet).where(RuleSet.organization_id == org.id, RuleSet.jurisdiction == "CA")
        ).all()
        program_codes = {rs.code for rs in ca_rulesets}
        assert "CA-EXPRESS-ENTRY-FSW" in program_codes
        assert "CA-STUDY-PERMIT" in program_codes
        assert "CA-SPOUSAL-SPONSORSHIP" in program_codes
        assert "CA-PGWP" in program_codes


# ============================================================================
# PRIORITY 2: USA PATHWAYS VALIDATION (INDEPENDENT VALIDATION)
# ============================================================================


class TestPriority2USAPathways:
    """Validate Priority 2: USA pathways remove legacy hard-coded assumptions;
    each pathway is validated independently with distinct criteria.
    """

    def test_usa_jurisdiction_metadata(self):
        us = COUNTRY_REGISTRY["US"]
        assert us.coverage_status == CoverageStatus.SUPPORTED
        assert "USCIS" in us.primary_authority
        assert us.priority_tier == 2

    def test_usa_pathways_independent_statutes(self):
        us_pathways = {p.pathway_key: p for p in get_pathways_by_jurisdiction("US")}
        assert len(us_pathways) >= 4

        eb1a = us_pathways["US_EB1A"]
        h1b = us_pathways["US_H1B"]
        i485 = us_pathways["US_AOS_I485"]
        n400 = us_pathways["US_NATURALIZATION_N400"]

        assert "INA § 203(b)(1)(A)" in eb1a.statutory_reference
        assert "INA § 101(a)(15)(H)(i)(b)" in h1b.statutory_reference
        assert "INA § 245" in i485.statutory_reference
        assert "INA §" in n400.statutory_reference

        # Distinct regulatory categories
        assert eb1a.category == PathwayCategory.PR_RESIDENCE
        assert h1b.category == PathwayCategory.WORK
        assert i485.category == PathwayCategory.PR_RESIDENCE
        assert n400.category == PathwayCategory.CITIZENSHIP

    def test_usa_rule_packs_seed_and_execute(self, db: Session, phase12_setup):
        org = phase12_setup["org"]

        # Form I-485 AOS rule pack check
        res_i485 = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="US",
            pathway="US_AOS_I485",
        )
        assert res_i485["status"] == "SUPPORTED"
        assert res_i485["can_generate_checklist"] is True
        codes_i485 = {item["rule_id"] for item in res_i485["checklist"]}
        assert "US-I485-FORM-001" in codes_i485
        assert "US-I485-MED-003" in codes_i485

        # Form N-400 Naturalization rule pack check
        res_n400 = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="US",
            pathway="US_NATURALIZATION_N400",
        )
        assert res_n400["status"] == "SUPPORTED"
        assert res_n400["can_generate_checklist"] is True
        codes_n400 = {item["rule_id"] for item in res_n400["checklist"]}
        assert "US-N400-FORM-001" in codes_n400
        assert "US-N400-RESIDENCE-002" in codes_n400


# ============================================================================
# PRIORITY 3: AUSTRALIA & NEW ZEALAND INDEPENDENCE
# ============================================================================


class TestPriority3AustraliaNewZealand:
    """Validate Priority 3: Separate reviewed rules and templates for Australia
    and New Zealand jurisdictions; no cross-contamination.
    """

    def test_australia_and_new_zealand_metadata(self):
        au = COUNTRY_REGISTRY["AU"]
        nz = COUNTRY_REGISTRY["NZ"]

        assert au.coverage_status == CoverageStatus.SUPPORTED
        assert nz.coverage_status == CoverageStatus.SUPPORTED
        assert "Department of Home Affairs" in au.primary_authority
        assert "Immigration New Zealand (INZ)" in nz.primary_authority
        assert au.priority_tier == 3
        assert nz.priority_tier == 3
        assert au.code != nz.code

    def test_distinct_statutes_and_pathways(self):
        au_pathways = get_pathways_by_jurisdiction("AU")
        nz_pathways = get_pathways_by_jurisdiction("NZ")

        assert len(au_pathways) >= 2
        assert len(nz_pathways) >= 2

        # Check AU statutes cite Migration Act / Regulations 1994
        for p in au_pathways:
            assert "Migration" in p.statutory_reference or "homeaffairs" in p.official_source_url

        # Check NZ statutes cite Immigration Act 2009
        for p in nz_pathways:
            assert "Immigration Act 2009" in p.statutory_reference or "immigration.govt.nz" in p.official_source_url

    def test_separate_rule_packs(self, db: Session, phase12_setup):
        org = phase12_setup["org"]

        res_au = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="AU",
            pathway="AU_SUBCLASS_482",
        )
        assert res_au["status"] == "SUPPORTED"
        assert res_au["can_generate_checklist"] is True
        au_codes = {item["rule_id"] for item in res_au["checklist"]}
        assert "AU-482-SBS-001" in au_codes

        res_nz = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="NZ",
            pathway="NZ_ACCREDITED_EMPLOYER_WORK",
        )
        assert res_nz["status"] == "SUPPORTED"
        assert res_nz["can_generate_checklist"] is True
        nz_codes = {item["rule_id"] for item in res_nz["checklist"]}
        assert "NZ-AEWV-JOBCHECK-001" in nz_codes


# ============================================================================
# PRIORITY 4: UK & GERMANY / SELECTED EUROPE (EU/SCHENGEN DISTINCTION)
# ============================================================================


class TestPriority4UKAndGermanyEurope:
    """Validate Priority 4: UK and Germany have country-specific reviews;
    EU/Schengen is recognized as NOT a universal checklist.
    """

    def test_uk_and_germany_metadata(self):
        gb = COUNTRY_REGISTRY["GB"]
        de = COUNTRY_REGISTRY["DE"]
        fr = COUNTRY_REGISTRY["FR"]

        assert gb.priority_tier == 4
        assert de.priority_tier == 4
        assert fr.priority_tier == 4

        # EU Schengen distinction flag
        assert de.eu_schengen_distinction_applies is True
        assert fr.eu_schengen_distinction_applies is True
        assert gb.eu_schengen_distinction_applies is False  # Post-Brexit UK is non-Schengen

    def test_germany_checklist_includes_eu_schengen_notice(self, db: Session, phase12_setup):
        org = phase12_setup["org"]
        checklist = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="DE",
            pathway="DE_EU_BLUE_CARD",
        )
        assert checklist["can_generate_checklist"] is True
        assert checklist.get("eu_schengen_notice") is not None
        assert "AufenthG" in checklist["eu_schengen_notice"]
        assert "universal checklist" in checklist["eu_schengen_notice"]

    def test_uk_skilled_worker_checklist(self, db: Session, phase12_setup):
        org = phase12_setup["org"]
        uk_res = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="GB",
            pathway="GB_SKILLED_WORKER",
        )
        assert uk_res["can_generate_checklist"] is True
        rule_ids = {r["rule_id"] for r in uk_res["checklist"]}
        assert "GB-SW-COS-001" in rule_ids
        assert "GB-SW-LANG-002" in rule_ids


# ============================================================================
# PRIORITY 5: RUSSIA & OTHER DESTINATIONS (SAFE-STOP ENFORCEMENT)
# ============================================================================


class TestPriority5RussiaAndOtherDestinations:
    """Validate Priority 5: Destinations like Russia, Singapore, UAE, Japan
    are UNVERIFIED until validated; checklists MUST be refused (safe-stop).
    """

    def test_emerging_jurisdictions_unverified(self):
        ru = COUNTRY_REGISTRY["RU"]
        sg = COUNTRY_REGISTRY["SG"]
        ae = COUNTRY_REGISTRY["AE"]
        jp = COUNTRY_REGISTRY["JP"]

        assert ru.priority_tier == 5
        assert ru.coverage_status == CoverageStatus.UNVERIFIED
        assert sg.coverage_status == CoverageStatus.UNVERIFIED
        assert ae.coverage_status == CoverageStatus.UNVERIFIED
        assert jp.coverage_status == CoverageStatus.UNVERIFIED

    def test_unverified_pathway_safe_stop(self, db: Session, phase12_setup):
        org = phase12_setup["org"]

        # Russia Work Visa pathway checklist attempt (RU_VKS is UNVERIFIED)
        res_ru = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="RU",
            pathway="RU_VKS",
        )
        assert res_ru["status"] == "UNVERIFIED"
        assert res_ru["can_generate_checklist"] is False
        assert len(res_ru["checklist"]) == 0
        assert "SAFE STOP" in res_ru["disclaimer"]

        # Singapore EP pathway checklist attempt (SG_EMPLOYMENT_PASS is UNVERIFIED)
        res_sg = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="SG",
            pathway="SG_EMPLOYMENT_PASS",
        )
        assert res_sg["status"] == "UNVERIFIED"
        assert res_sg["can_generate_checklist"] is False
        assert len(res_sg["checklist"]) == 0


# ============================================================================
# BROAD APPLICATION FAMILIES COVERAGE
# ============================================================================


class TestBroadApplicationFamilies:
    """Validate all 8 application families are present in taxonomy:
    Visitor, Study, Work, Family, PR/Residence, Citizenship, Humanitarian/Protection,
    Extensions/Renewals.
    """

    @pytest.mark.parametrize(
        "category",
        [
            PathwayCategory.VISITOR,
            PathwayCategory.STUDY,
            PathwayCategory.WORK,
            PathwayCategory.FAMILY,
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.CITIZENSHIP,
            PathwayCategory.HUMANITARIAN_PROTECTION,
            PathwayCategory.EXTENSION_RENEWAL_CHANGE,
        ],
    )
    def test_category_has_pathways(self, category: PathwayCategory):
        pathways = get_pathways_by_category(category)
        assert len(pathways) > 0, f"Expected pathways for category {category.value}"


# ============================================================================
# API ENDPOINT VERIFICATION
# ============================================================================


class TestPathwayExpansionAPI:
    """Validate FastAPI endpoints for taxonomy query, filtering, and dossier lookup."""

    def test_get_countries_endpoint(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/countries")
        assert response.status_code == 200
        countries = response.json()
        assert len(countries) >= 7

        # Priority sort order verification: CA should be first, US second
        assert countries[0]["code"] == "CA"
        assert countries[1]["code"] == "US"

    def test_get_coverage_matrix_endpoint(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/coverage-matrix")
        assert response.status_code == 200
        matrix = response.json()
        assert "coverage_summary" in matrix
        assert "families_breakdown" in matrix
        assert "countries" in matrix

    def test_get_taxonomy_filtered_by_jurisdiction(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/taxonomy?jurisdiction=CA")
        assert response.status_code == 200
        pathways = response.json()
        assert len(pathways) >= 4
        for p in pathways:
            assert p["jurisdiction"] == "CA"

    def test_get_taxonomy_filtered_by_category(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/taxonomy?category=work")
        assert response.status_code == 200
        pathways = response.json()
        assert len(pathways) >= 4
        for p in pathways:
            assert p["category"] == "work"

    def test_get_taxonomy_filtered_by_coverage(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/taxonomy?coverage_status=UNVERIFIED")
        assert response.status_code == 200
        pathways = response.json()
        assert len(pathways) >= 2
        for p in pathways:
            assert p["coverage_status"] == "UNVERIFIED"

    def test_get_pathway_dossier_endpoint(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/pathway/CA_EXPRESS_ENTRY_FSW/dossier")
        assert response.status_code == 200
        dossier = response.json()
        assert dossier["pathway"]["pathway_key"] == "CA_EXPRESS_ENTRY_FSW"
        assert dossier["pathway"]["coverage_status"] == "SUPPORTED"
        assert dossier["is_safe_to_generate_checklist"] is True
        assert dossier["safe_stop_required"] is False
        assert dossier["pathway"]["professional_reviewer"] is not None

    def test_get_pathway_dossier_not_found(self):
        client = TestClient(app)
        response = client.get("/api/v1/rules/pathway/NON_EXISTENT_PATHWAY/dossier")
        assert response.status_code == 404
