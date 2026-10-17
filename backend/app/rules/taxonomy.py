"""Official Country Registry, Pathway Taxonomy, and Coverage Matrix for Documento Rules Engine.

Priority Order:
1. Canada first (IRCC) - Fully Supported
2. USA second (USCIS / DOS) - Fully Supported
3. Australia and New Zealand core next (Home Affairs / INZ) - Fully Supported
4. UK (UKVI) - Partial Coverage
5. Germany/Europe (BAMF), Russia (MVD) and others - Unverified / Unsupported

Long-term breadth is an ambition, not permission to market unvalidated pathways as complete.
Unsupported pathways stop safely with SUPPORTED / PARTIAL / UNVERIFIED / UNSUPPORTED state;
no unrelated fallback checklist is ever generated.
"""
from typing import Dict, List, Optional, Any
from enum import Enum
from pydantic import BaseModel, Field


class CoverageStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    PARTIAL = "PARTIAL"
    UNVERIFIED = "UNVERIFIED"
    UNSUPPORTED = "UNSUPPORTED"


class PathwayCategory(str, Enum):
    VISITOR = "visitor"
    STUDY = "study"
    WORK = "work"
    FAMILY = "family"
    PR_RESIDENCE = "pr_residence"
    CITIZENSHIP = "citizenship"
    HUMANITARIAN_PROTECTION = "humanitarian_protection"
    EXTENSION_RENEWAL_CHANGE = "extension_renewal_change"


class CountryRegistryItem(BaseModel):
    code: str = Field(..., description="ISO 2-letter country code")
    name: str
    primary_authority: str
    official_source_registry_url: str
    release_owner: str
    coverage_status: CoverageStatus
    priority_tier: int
    statutory_framework: str
    notes: str


class PathwayTaxonomyItem(BaseModel):
    pathway_key: str
    jurisdiction: str
    category: PathwayCategory
    title: str
    statutory_reference: str
    coverage_status: CoverageStatus
    official_source_url: str
    requires_provincial_or_state_clearance: bool = False
    description: str


# =========================================================================
# 1. COUNTRY REGISTRY
# =========================================================================

COUNTRY_REGISTRY: Dict[str, CountryRegistryItem] = {
    "CA": CountryRegistryItem(
        code="CA",
        name="Canada",
        primary_authority="Immigration, Refugees and Citizenship Canada (IRCC)",
        official_source_registry_url="https://www.canada.ca/en/immigration-refugees-citizenship.html",
        release_owner="Lead Canadian Immigration Counsel & Designated RCIC",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=1,
        statutory_framework="Immigration and Refugee Protection Act (S.C. 2001, c. 27); IRPR (SOR/2002-227)",
        notes="Priority 1 jurisdiction. Comprehensive Express Entry, Study Permit, and PGWP rule packs validated.",
    ),
    "US": CountryRegistryItem(
        code="US",
        name="United States",
        primary_authority="U.S. Citizenship and Immigration Services (USCIS) / Department of State (DOS)",
        official_source_registry_url="https://www.uscis.gov/policy-manual",
        release_owner="Senior US Immigration Partner (AILA Member)",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=2,
        statutory_framework="Immigration and Nationality Act (INA), 8 U.S.C.; 8 CFR; 22 CFR",
        notes="Priority 2 jurisdiction. EB-1A Extraordinary Ability and H-1B Specialty Occupation validated.",
    ),
    "AU": CountryRegistryItem(
        code="AU",
        name="Australia",
        primary_authority="Department of Home Affairs (Immi)",
        official_source_registry_url="https://immi.homeaffairs.gov.au",
        release_owner="MARA Registered Migration Agent",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=3,
        statutory_framework="Migration Act 1958 (Cth); Migration Regulations 1994",
        notes="Priority 3 core jurisdiction. Subclass 189 Skilled Independent and Subclass 482 TSS validated.",
    ),
    "NZ": CountryRegistryItem(
        code="NZ",
        name="New Zealand",
        primary_authority="Immigration New Zealand (INZ)",
        official_source_registry_url="https://www.immigration.govt.nz",
        release_owner="Licensed Immigration Adviser (NZIAA)",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=3,
        statutory_framework="Immigration Act 2009; INZ Operational Manual",
        notes="Priority 3 core jurisdiction. Skilled Migrant Category (SMC) Resident Visa validated.",
    ),
    "GB": CountryRegistryItem(
        code="GB",
        name="United Kingdom",
        primary_authority="UK Visas and Immigration (UKVI) / Home Office",
        official_source_registry_url="https://www.gov.uk/government/organisations/uk-visas-and-immigration",
        release_owner="UK Immigration Solicitor (SRA Regulated)",
        coverage_status=CoverageStatus.PARTIAL,
        priority_tier=4,
        statutory_framework="Immigration Act 1971; UK Immigration Rules Appendix Global Talent / Skilled Worker",
        notes="Partial coverage. Core statutory requirements mapped; endorsement bodies require manual verification.",
    ),
    "DE": CountryRegistryItem(
        code="DE",
        name="Germany / European Union",
        primary_authority="Federal Office for Migration and Refugees (BAMF) / Auswärtiges Amt",
        official_source_registry_url="https://www.bamf.de/EN",
        release_owner="European Migration Legal Specialist",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=5,
        statutory_framework="Aufenthaltsgesetz (AufenthG - German Residence Act); EU Blue Card Directive",
        notes="Unverified draft. Legal audit in progress; cannot be marketed or evaluated as active production rules.",
    ),
    "RU": CountryRegistryItem(
        code="RU",
        name="Russia",
        primary_authority="Main Directorate for Migration Affairs of the Ministry of Internal Affairs (MVD)",
        official_source_registry_url="https://мвд.рф",
        release_owner="Managing Legal Counsel",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=6,
        statutory_framework="Federal Law No. 115-FZ On the Legal Status of Foreign Citizens in the Russian Federation",
        notes="Unverified draft. Highly Qualified Specialist (VKS) rules pending bilateral treaty verification.",
    ),
}


# =========================================================================
# 2. PATHWAY TAXONOMY
# =========================================================================

PATHWAY_TAXONOMY: Dict[str, PathwayTaxonomyItem] = {
    # Canada (CA)
    "CA_EXPRESS_ENTRY_FSW": PathwayTaxonomyItem(
        pathway_key="CA_EXPRESS_ENTRY_FSW",
        jurisdiction="CA",
        category=PathwayCategory.PR_RESIDENCE,
        title="Express Entry — Federal Skilled Worker Program (FSWP)",
        statutory_reference="IRPA s. 12(2); IRPR ss. 75-87",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html",
        description="Permanent residence for skilled workers with foreign work experience meeting 67-point selection grid.",
    ),
    "CA_STUDY_PERMIT": PathwayTaxonomyItem(
        pathway_key="CA_STUDY_PERMIT",
        jurisdiction="CA",
        category=PathwayCategory.STUDY,
        title="Study Permit (Designated Learning Institution)",
        statutory_reference="IRPR Part 12, Division 2, ss. 211-222",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html",
        requires_provincial_or_state_clearance=True,
        description="Authorization to study at Canadian DLI with mandatory Provincial Attestation Letter (PAL).",
    ),
    "CA_PGWP": PathwayTaxonomyItem(
        pathway_key="CA_PGWP",
        jurisdiction="CA",
        category=PathwayCategory.WORK,
        title="Post-Graduation Work Permit (PGWP)",
        statutory_reference="IRPR s. 205(c)(ii); Ministerial Instructions",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation.html",
        description="Open work permit for graduates from eligible Canadian DLIs.",
    ),
    "CA_SPOUSAL_SPONSORSHIP": PathwayTaxonomyItem(
        pathway_key="CA_SPOUSAL_SPONSORSHIP",
        jurisdiction="CA",
        category=PathwayCategory.FAMILY,
        title="Spouse or Common-Law Partner Sponsorship",
        statutory_reference="IRPA s. 13(1); IRPR Part 7",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html",
        description="Permanent resident sponsorship for spouses with bona fide relationship evidence.",
    ),

    # United States (US)
    "US_EB1A": PathwayTaxonomyItem(
        pathway_key="US_EB1A",
        jurisdiction="US",
        category=PathwayCategory.PR_RESIDENCE,
        title="EB-1A Extraordinary Ability Immigrant Visa",
        statutory_reference="INA § 203(b)(1)(A), 8 U.S.C. § 1153(b)(1)(A); 8 CFR § 204.5(h)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2",
        description="First-preference employment petition requiring sustained national or international acclaim under Kazarian.",
    ),
    "US_H1B": PathwayTaxonomyItem(
        pathway_key="US_H1B",
        jurisdiction="US",
        category=PathwayCategory.WORK,
        title="H-1B Specialty Occupation Nonimmigrant Worker",
        statutory_reference="INA § 101(a)(15)(H)(i)(b); 8 CFR § 214.2(h)(4)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations",
        description="Temporary specialty occupation requiring specialized bachelor's degree and certified Form ETA-9035 LCA.",
    ),
    "US_AOS_I485": PathwayTaxonomyItem(
        pathway_key="US_AOS_I485",
        jurisdiction="US",
        category=PathwayCategory.PR_RESIDENCE,
        title="Form I-485 Application to Register Permanent Residence / Adjust Status",
        statutory_reference="INA § 245; 8 CFR Part 245",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/i-485",
        description="Adjustment of status to lawful permanent resident within the United States.",
    ),
    "US_NATURALIZATION_N400": PathwayTaxonomyItem(
        pathway_key="US_NATURALIZATION_N400",
        jurisdiction="US",
        category=PathwayCategory.CITIZENSHIP,
        title="Form N-400 Application for Naturalization",
        statutory_reference="INA §§ 316, 319; 8 CFR Part 316",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/n-400",
        description="Grant of United States citizenship after 5 years (or 3 years if married to US citizen) lawful residence.",
    ),

    # Australia (AU)
    "AU_SUBCLASS_189": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_189",
        jurisdiction="AU",
        category=PathwayCategory.PR_RESIDENCE,
        title="Skilled Independent Visa (Subclass 189)",
        statutory_reference="Migration Act 1958; Migration Regulations 1994, Schedule 2, Subclass 189",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
        description="Points-tested permanent residence for invited skilled workers not sponsored by an employer or state.",
    ),
    "AU_SUBCLASS_482": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_482",
        jurisdiction="AU",
        category=PathwayCategory.WORK,
        title="Temporary Skill Shortage Visa (Subclass 482 - TSS)",
        statutory_reference="Migration Regulations 1994, Schedule 2, Subclass 482",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-skill-shortage-482",
        description="Employer-sponsored temporary visa allowing businesses to address labor shortages.",
    ),
    "AU_SUBCLASS_500": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_500",
        jurisdiction="AU",
        category=PathwayCategory.STUDY,
        title="Student Visa (Subclass 500)",
        statutory_reference="Migration Regulations 1994, Schedule 2, Subclass 500",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        description="Student visa with Genuine Student (GS) criterion and Confirmation of Enrolment (CoE).",
    ),

    # New Zealand (NZ)
    "NZ_SKILLED_MIGRANT": PathwayTaxonomyItem(
        pathway_key="NZ_SKILLED_MIGRANT",
        jurisdiction="NZ",
        category=PathwayCategory.PR_RESIDENCE,
        title="Skilled Migrant Category Resident Visa (SMC)",
        statutory_reference="Immigration Act 2009; INZ Operational Manual: Residence, SM1",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.immigration.govt.nz/new-zealand-visas/visas/visa/skilled-migrant-category-resident-visa",
        description="Permanent residence for skilled migrants who earn 6 points and hold skilled employment with an accredited employer.",
    ),

    # United Kingdom (GB) - Partial
    "GB_GLOBAL_TALENT": PathwayTaxonomyItem(
        pathway_key="GB_GLOBAL_TALENT",
        jurisdiction="GB",
        category=PathwayCategory.PR_RESIDENCE,
        title="Global Talent Visa",
        statutory_reference="UK Immigration Rules Appendix Global Talent",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.gov.uk/global-talent",
        description="Working in the UK as a leader or potential leader in academia, arts, or digital technology.",
    ),
    "GB_SKILLED_WORKER": PathwayTaxonomyItem(
        pathway_key="GB_SKILLED_WORKER",
        jurisdiction="GB",
        category=PathwayCategory.WORK,
        title="Skilled Worker Visa",
        statutory_reference="UK Immigration Rules Appendix Skilled Worker",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.gov.uk/skilled-worker-visa",
        description="Points-based visa requiring a valid Certificate of Sponsorship (CoS) and minimum salary threshold.",
    ),

    # Germany (DE) - Unverified
    "DE_CHANCENKARTE": PathwayTaxonomyItem(
        pathway_key="DE_CHANCENKARTE",
        jurisdiction="DE",
        category=PathwayCategory.WORK,
        title="Opportunity Card (Chancenkarte)",
        statutory_reference="AufenthG § 20a",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://www.make-it-in-germany.com/en/visa-residence/types/jobseekers/opportunity-card",
        description="Points-based job search opportunity card for skilled workers in Germany.",
    ),
    "DE_EU_BLUE_CARD": PathwayTaxonomyItem(
        pathway_key="DE_EU_BLUE_CARD",
        jurisdiction="DE",
        category=PathwayCategory.WORK,
        title="EU Blue Card (Blaue Karte EU)",
        statutory_reference="AufenthG § 18g",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Migrathek/BlaueKarteEU/blauekarteeu-node.html",
        description="Work and residence permit for highly qualified non-EU academics with binding job offer.",
    ),

    # Russia (RU) - Unverified
    "RU_VKS": PathwayTaxonomyItem(
        pathway_key="RU_VKS",
        jurisdiction="RU",
        category=PathwayCategory.WORK,
        title="Highly Qualified Specialist Work Visa (ВКС)",
        statutory_reference="Federal Law No. 115-FZ, Article 13.2",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://мвд.рф",
        description="Work visa for foreign high-earning specialists exceeding statutory monthly salary floor.",
    ),
}


def get_country_registry() -> List[CountryRegistryItem]:
    """Returns sorted country registry by priority tier."""
    return sorted(list(COUNTRY_REGISTRY.values()), key=lambda c: c.priority_tier)


def get_pathways_by_jurisdiction(jurisdiction: str) -> List[PathwayTaxonomyItem]:
    """Returns all mapped pathways for a jurisdiction code."""
    jur = jurisdiction.upper()
    return [p for p in PATHWAY_TAXONOMY.values() if p.jurisdiction == jur]


def get_pathway_coverage(jurisdiction: str, pathway_key: str) -> CoverageStatus:
    """Safely resolves pathway coverage status.
    If jurisdiction is not registered -> UNSUPPORTED.
    If pathway is not mapped -> UNSUPPORTED.
    """
    jur = jurisdiction.upper()
    if jur not in COUNTRY_REGISTRY:
        return CoverageStatus.UNSUPPORTED

    # Match exact or normalized pathway
    clean_key = pathway_key.upper().replace("-", "_").replace(" ", "_")
    if not clean_key.startswith(f"{jur}_"):
        clean_key = f"{jur}_{clean_key}"

    if clean_key in PATHWAY_TAXONOMY:
        return PATHWAY_TAXONOMY[clean_key].coverage_status

    # Search loose match
    for p_key, item in PATHWAY_TAXONOMY.items():
        if item.jurisdiction == jur:
            if pathway_key.lower() in p_key.lower() or p_key.lower() in pathway_key.lower():
                return item.coverage_status

    return CoverageStatus.UNSUPPORTED


def get_coverage_matrix() -> Dict[str, Any]:
    """Returns full jurisdiction and pathway coverage matrix."""
    matrix = []
    for country in get_country_registry():
        pathways = get_pathways_by_jurisdiction(country.code)
        matrix.append({
            "country": country.model_dump(),
            "pathways_count": len(pathways),
            "supported_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.SUPPORTED),
            "partial_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.PARTIAL),
            "unverified_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.UNVERIFIED),
            "pathways": [p.model_dump() for p in pathways],
        })
    return {
        "coverage_summary": {
            "total_countries": len(COUNTRY_REGISTRY),
            "supported_countries": sum(1 for c in COUNTRY_REGISTRY.values() if c.coverage_status == CoverageStatus.SUPPORTED),
            "total_pathways": len(PATHWAY_TAXONOMY),
            "supported_pathways": sum(1 for p in PATHWAY_TAXONOMY.values() if p.coverage_status == CoverageStatus.SUPPORTED),
        },
        "countries": matrix,
    }
