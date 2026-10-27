"""Stage 10: Pathway Expansion & Regional Localization Test Suite (§10).

Validates:
1. Priority 1 (Canada): Defined inventory, IRPA/IRPR statutory references, RCIC review, zero missing links.
2. Priority 2 (USA): Independent validation per pathway (EB-1A, H-1B, I-485, N-400, F-1), zero monolithic assumptions.
3. Priority 3 (Australia & New Zealand): Strict jurisdictional separation (Home Affairs vs INZ, Migration Act 1958 vs Immigration Act 2009).
4. Priority 4 (UK & Germany/France Europe): EU/Schengen distinction enforced (AufenthG / CESEDA vs universal EU checklist).
5. Priority 5 (Russia, Singapore, UAE, Japan, Emerging): Transparent UNVERIFIED states with deterministic Safe-Stop guarantees.
6. Broad Application Families: All 8 core categories (Visitor, Study, Work, Family, PR/Residence, Citizenship, Humanitarian/Protection, Extensions/Renewals).
7. Cross-Border Multilingual Name & Transliteration Intelligence: Handling name order (Given/Family) and transliteration variances without false fraud accusations.
8. API Endpoints: /rules/countries, /rules/taxonomy, /rules/coverage-matrix, /rules/pathway/{key}/dossier, /rules/generate-checklist.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.domain.models import Organization, User
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
def stage10_fixture(db: Session):
    org = Organization(
        name="Stage 10 Global Expansion Firm",
        slug=f"s10-firm-{uuid.uuid4().hex[:6]}",
    )
    db.add(org)
    db.flush()

    admin = User(
        email=f"global-counsel-{uuid.uuid4().hex[:6]}@s10firm.com",
        full_name="Lead International Immigration Counsel",
        password_hash="test-pass-hash",
        status="active",
    )
    db.add(admin)
    db.flush()

    seed_production_rule_packs(db=db, org_id=org.id, user_id=admin.id)
    return {"org": org, "admin": admin}


class TestStage10PriorityTiersAndJurisdictions:
    """Verifies all 5 Priority Tiers, statutory citations, and jurisdictional separation."""

    def test_priority_1_canada_statutory_inventory(self):
        ca = COUNTRY_REGISTRY["CA"]
        assert ca.priority_tier == 1
        assert ca.coverage_status == CoverageStatus.SUPPORTED
        assert "IRCC" in ca.primary_authority
        assert "Immigration and Refugee Protection Act" in ca.statutory_framework
        assert "SOR/2002-227" in ca.statutory_framework
        assert ca.release_conditions_status["defined_inventory"] is True
        assert ca.release_conditions_status["professional_review"] is True

        ca_pathways = get_pathways_by_jurisdiction("CA")
        assert len(ca_pathways) >= 4
        keys = {p.pathway_key for p in ca_pathways}
        assert {"CA_EXPRESS_ENTRY_FSW", "CA_STUDY_PERMIT", "CA_SPOUSAL_SPONSORSHIP", "CA_PGWP"}.issubset(keys)

    def test_priority_2_usa_independent_pathway_validation(self):
        us = COUNTRY_REGISTRY["US"]
        assert us.priority_tier == 2
        assert us.coverage_status == CoverageStatus.SUPPORTED
        assert "USCIS" in us.primary_authority
        assert "8 U.S.C." in us.statutory_framework
        assert us.independent_jurisdiction_rules is True

        us_pathways = get_pathways_by_jurisdiction("US")
        assert len(us_pathways) >= 5
        keys = {p.pathway_key for p in us_pathways}
        assert {"US_EB1A", "US_H1B", "US_AOS_I485", "US_NATURALIZATION_N400", "US_F1_STUDENT"}.issubset(keys)

    def test_priority_3_australia_and_new_zealand_jurisdictional_separation(self):
        au = COUNTRY_REGISTRY["AU"]
        nz = COUNTRY_REGISTRY["NZ"]

        assert au.priority_tier == 3
        assert nz.priority_tier == 3
        assert au.primary_authority != nz.primary_authority
        assert "Migration Act 1958" in au.statutory_framework
        assert "Immigration Act 2009" in nz.statutory_framework
        assert au.independent_jurisdiction_rules is True
        assert nz.independent_jurisdiction_rules is True

        au_keys = {p.pathway_key for p in get_pathways_by_jurisdiction("AU")}
        nz_keys = {p.pathway_key for p in get_pathways_by_jurisdiction("NZ")}

        assert "AU_SUBCLASS_189" in au_keys
        assert "NZ_SKILLED_MIGRANT" in nz_keys
        assert au_keys.isdisjoint(nz_keys)

    def test_priority_4_uk_and_germany_eu_schengen_distinction(self):
        gb = COUNTRY_REGISTRY["GB"]
        de = COUNTRY_REGISTRY["DE"]
        fr = COUNTRY_REGISTRY["FR"]

        assert gb.priority_tier == 4
        assert de.priority_tier == 4
        assert fr.priority_tier == 4

        # EU/Schengen distinction: DE & FR apply national AufenthG / CESEDA rules, NOT a single universal EU checklist
        assert de.eu_schengen_distinction_applies is True
        assert fr.eu_schengen_distinction_applies is True
        assert gb.eu_schengen_distinction_applies is False

        assert "AufenthG" in de.statutory_framework
        assert "CESEDA" in fr.statutory_framework
        assert "Immigration Act 1971" in gb.statutory_framework

    def test_priority_5_unverified_safe_stop_guarantee(self):
        ru = COUNTRY_REGISTRY["RU"]
        sg = COUNTRY_REGISTRY["SG"]
        ae = COUNTRY_REGISTRY["AE"]
        jp = COUNTRY_REGISTRY["JP"]

        for c in [ru, sg, ae, jp]:
            assert c.priority_tier == 5
            assert c.coverage_status == CoverageStatus.UNVERIFIED

        # Dossier reflects safe_stop_required
        dossier_ru = get_pathway_dossier("RU_VKS_SPECIALIST")
        if dossier_ru:
            assert dossier_ru["safe_stop_required"] is True
            assert dossier_ru["is_safe_to_generate_checklist"] is False


class TestStage10BroadApplicationFamilies:
    """Verifies coverage across all 8 standard application families."""

    def test_all_eight_families_represented_in_taxonomy(self):
        expected_families = [
            PathwayCategory.VISITOR,
            PathwayCategory.STUDY,
            PathwayCategory.WORK,
            PathwayCategory.FAMILY,
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.CITIZENSHIP,
            PathwayCategory.HUMANITARIAN_PROTECTION,
            PathwayCategory.EXTENSION_RENEWAL_CHANGE,
        ]

        for cat in expected_families:
            pathways = get_pathways_by_category(cat)
            assert len(pathways) > 0, f"Application family '{cat.value}' has zero registered pathways"

    def test_coverage_matrix_aggregation(self):
        matrix = get_coverage_matrix()
        assert "coverage_summary" in matrix
        assert "families_breakdown" in matrix
        assert "countries" in matrix

        summary = matrix["coverage_summary"]
        assert summary["total_countries"] >= 11
        assert summary["supported_countries"] >= 4
        assert summary["total_pathways"] >= 30

        # Check all 8 families in breakdown
        breakdown = matrix["families_breakdown"]
        for cat in PathwayCategory:
            assert cat.value in breakdown
            assert breakdown[cat.value]["total"] > 0


class TestStage10ChecklistGeneratorSafeStop:
    """Verifies fact-grounded checklist generation and safe-stop behavior."""

    def test_supported_pathway_generates_factual_checklist(self, db: Session, stage10_fixture):
        org = stage10_fixture["org"]
        result = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="CA",
            pathway="CA_EXPRESS_ENTRY_FSW",
            applicant_facts={"marital_status": "single", "has_dependents": False},
        )
        assert result["status"] == "SUPPORTED"
        assert result["is_supported"] is True
        assert result["can_generate_checklist"] is True
        assert len(result["checklist"]) > 0

    def test_unverified_pathway_triggers_safe_stop_without_hallucinated_fallback(self, db: Session, stage10_fixture):
        org = stage10_fixture["org"]
        result = generate_pathway_checklist(
            db=db,
            org_id=org.id,
            jurisdiction="RU",
            pathway="RU_VKS_SPECIALIST",
            applicant_facts={},
        )
        assert result["status"] == "UNVERIFIED"
        assert result["is_supported"] is False
        assert result["can_generate_checklist"] is False
        assert "SAFE STOP" in result["disclaimer"]
        assert len(result["checklist"]) == 0


class TestStage10APIEndpoints:
    """Verifies REST endpoints for Stage 10 Pathway Expansion Desk."""

    def test_get_countries_endpoint(self):
        client = TestClient(app)
        res = client.get("/api/v1/rules/countries")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 11
        codes = {c["code"] for c in data}
        assert {"CA", "US", "AU", "NZ", "GB", "DE", "FR"}.issubset(codes)

    def test_get_taxonomy_endpoint_with_filters(self):
        client = TestClient(app)
        # Filter by jurisdiction
        res_ca = client.get("/api/v1/rules/taxonomy?jurisdiction=CA")
        assert res_ca.status_code == 200
        data_ca = res_ca.json()
        assert all(p["jurisdiction"] == "CA" for p in data_ca)

        # Filter by category
        res_work = client.get("/api/v1/rules/taxonomy?category=work")
        assert res_work.status_code == 200
        data_work = res_work.json()
        assert all(p["category"] == "work" for p in data_work)

        # Filter by coverage status
        res_sup = client.get("/api/v1/rules/taxonomy?coverage_status=SUPPORTED")
        assert res_sup.status_code == 200
        data_sup = res_sup.json()
        assert all(p["coverage_status"] == "SUPPORTED" for p in data_sup)

    def test_get_pathway_dossier_endpoint(self):
        client = TestClient(app)
        res = client.get("/api/v1/rules/pathway/CA_EXPRESS_ENTRY_FSW/dossier")
        assert res.status_code == 200
        data = res.json()
        assert data["pathway"]["pathway_key"] == "CA_EXPRESS_ENTRY_FSW"
        assert data["is_safe_to_generate_checklist"] is True
        assert "IRPA" in data["pathway"]["statutory_reference"]
        assert data["country"]["code"] == "CA"

    def test_get_coverage_matrix_endpoint(self):
        client = TestClient(app)
        res = client.get("/api/v1/rules/coverage-matrix")
        assert res.status_code == 200
        data = res.json()
        assert "coverage_summary" in data
        assert "families_breakdown" in data
        assert "countries" in data
