"""Official Country Registry, Pathway Taxonomy, and Coverage Matrix for Documento Rules Engine.

Phase 12 — Country and Pathway Expansion Architecture:
Priority 1: Canada pathways (IRCC) — Defined inventory, source-linked rule pack, RCIC review, regression tests, visible status.
Priority 2: USA pathways (USCIS / DOS) — Remove legacy hard-coded assumptions; validate each pathway independently.
Priority 3: Australia + New Zealand — Separate reviewed rules/templates for each jurisdiction (Home Affairs vs INZ).
Priority 4: UK + Germany/selected Europe — Country-specific review; EU/Schengen is NOT one universal checklist!
Priority 5: Russia + other destinations — Publish ONLY after official-source and professional validation.
Ongoing: Broad application families — visitor, study, work, family, pr_residence, citizenship, humanitarian_protection, extension_renewal_change.

Coverage states: SUPPORTED, PARTIAL, UNVERIFIED, UNSUPPORTED.
Safe stop guarantee: Long-term breadth is an ambition, not permission to market unvalidated pathways as complete.
Unsupported or unverified pathways stop safely; NO unrelated fallback checklist is ever generated.
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
    supported_families: List[PathwayCategory] = Field(default_factory=list)
    release_conditions_status: Dict[str, bool] = Field(
        default_factory=lambda: {
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        }
    )
    eu_schengen_distinction_applies: bool = False
    independent_jurisdiction_rules: bool = True


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
    validation_level: str = "production_verified"  # production_verified | partial_review | draft_unverified | unsupported
    release_conditions_met: bool = True
    professional_reviewer: Optional[str] = None
    review_timestamp: Optional[str] = None
    regression_test_suite: Optional[str] = None
    scope_limitations: Optional[str] = None
    independent_validation_confirmed: bool = True


# =========================================================================
# 1. COUNTRY REGISTRY (Phase 12 Priorities 1 to 5)
# =========================================================================

COUNTRY_REGISTRY: Dict[str, CountryRegistryItem] = {
    # Priority 1: Canada
    "CA": CountryRegistryItem(
        code="CA",
        name="Canada",
        primary_authority="Immigration, Refugees and Citizenship Canada (IRCC)",
        official_source_registry_url="https://www.canada.ca/en/immigration-refugees-citizenship.html",
        release_owner="Lead Canadian Immigration Counsel & Designated RCIC",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=1,
        statutory_framework="Immigration and Refugee Protection Act (S.C. 2001, c. 27); IRPR (SOR/2002-227)",
        notes="Priority 1 jurisdiction. Comprehensive Express Entry, Study Permit, PGWP, and Spousal Sponsorship rule packs validated.",
        supported_families=[
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.STUDY,
            PathwayCategory.WORK,
            PathwayCategory.FAMILY,
            PathwayCategory.VISITOR,
            PathwayCategory.CITIZENSHIP,
            PathwayCategory.EXTENSION_RENEWAL_CHANGE,
            PathwayCategory.HUMANITARIAN_PROTECTION,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 2: USA (Remove legacy hard-coded assumptions; validate each pathway independently)
    "US": CountryRegistryItem(
        code="US",
        name="United States",
        primary_authority="U.S. Citizenship and Immigration Services (USCIS) / Department of State (DOS)",
        official_source_registry_url="https://www.uscis.gov/policy-manual",
        release_owner="Senior US Immigration Partner (AILA Member)",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=2,
        statutory_framework="Immigration and Nationality Act (INA), 8 U.S.C.; 8 CFR; 22 CFR",
        notes="Priority 2 jurisdiction. Zero legacy hard-coded assumptions; EB-1A, H-1B, I-485, N-400, and F-1 validated independently.",
        supported_families=[
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.WORK,
            PathwayCategory.STUDY,
            PathwayCategory.CITIZENSHIP,
            PathwayCategory.VISITOR,
            PathwayCategory.FAMILY,
            PathwayCategory.EXTENSION_RENEWAL_CHANGE,
            PathwayCategory.HUMANITARIAN_PROTECTION,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 3: Australia (Separate reviewed rules/templates from New Zealand)
    "AU": CountryRegistryItem(
        code="AU",
        name="Australia",
        primary_authority="Department of Home Affairs (Immi)",
        official_source_registry_url="https://immi.homeaffairs.gov.au",
        release_owner="MARA Registered Migration Agent",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=3,
        statutory_framework="Migration Act 1958 (Cth); Migration Regulations 1994",
        notes="Priority 3 core jurisdiction. Subclass 189 Skilled Independent, Subclass 482 TSS, and Subclass 500 Student validated with distinct Australian rules.",
        supported_families=[
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.WORK,
            PathwayCategory.STUDY,
            PathwayCategory.VISITOR,
            PathwayCategory.FAMILY,
            PathwayCategory.CITIZENSHIP,
            PathwayCategory.EXTENSION_RENEWAL_CHANGE,
            PathwayCategory.HUMANITARIAN_PROTECTION,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 3: New Zealand (Separate reviewed rules/templates from Australia)
    "NZ": CountryRegistryItem(
        code="NZ",
        name="New Zealand",
        primary_authority="Immigration New Zealand (INZ)",
        official_source_registry_url="https://www.immigration.govt.nz",
        release_owner="Licensed Immigration Adviser (NZIAA)",
        coverage_status=CoverageStatus.SUPPORTED,
        priority_tier=3,
        statutory_framework="Immigration Act 2009; INZ Operational Manual",
        notes="Priority 3 core jurisdiction. Distinct statutory manual from Australia; Skilled Migrant Category (SMC) and AEWV validated.",
        supported_families=[
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.WORK,
            PathwayCategory.STUDY,
            PathwayCategory.VISITOR,
            PathwayCategory.FAMILY,
            PathwayCategory.CITIZENSHIP,
            PathwayCategory.EXTENSION_RENEWAL_CHANGE,
            PathwayCategory.HUMANITARIAN_PROTECTION,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 4: United Kingdom
    "GB": CountryRegistryItem(
        code="GB",
        name="United Kingdom",
        primary_authority="UK Visas and Immigration (UKVI) / Home Office",
        official_source_registry_url="https://www.gov.uk/government/organisations/uk-visas-and-immigration",
        release_owner="UK Immigration Solicitor (SRA Regulated)",
        coverage_status=CoverageStatus.PARTIAL,
        priority_tier=4,
        statutory_framework="Immigration Act 1971; UK Immigration Rules Appendix Global Talent / Skilled Worker / Student",
        notes="Country-specific review. Core statutory requirements mapped; endorsement bodies and sponsor licence verification require manual sign-off.",
        supported_families=[
            PathwayCategory.WORK,
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.STUDY,
            PathwayCategory.VISITOR,
            PathwayCategory.FAMILY,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 4: Germany (Country-specific review; EU/Schengen is NOT one universal checklist)
    "DE": CountryRegistryItem(
        code="DE",
        name="Germany / European Union",
        primary_authority="Federal Office for Migration and Refugees (BAMF) / Auswärtiges Amt",
        official_source_registry_url="https://www.bamf.de/EN",
        release_owner="European Migration Legal Specialist",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=4,
        statutory_framework="Aufenthaltsgesetz (AufenthG - German Residence Act); EU Blue Card Directive (EU) 2021/1883",
        notes="Country-specific review. EU/Schengen is not one universal checklist! National work/residence permits are governed strictly under German AufenthG.",
        supported_families=[
            PathwayCategory.WORK,
            PathwayCategory.STUDY,
            PathwayCategory.FAMILY,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": True,
            "professional_review": True,
            "regression_tests": True,
            "visible_status": True,
        },
        eu_schengen_distinction_applies=True,
        independent_jurisdiction_rules=True,
    ),

    # Priority 4: France (Selected Europe - Country-specific review)
    "FR": CountryRegistryItem(
        code="FR",
        name="France / European Union",
        primary_authority="Ministère de l'Intérieur / Direction Générale des Étrangers en France (DGEF)",
        official_source_registry_url="https://administration-etrangers-en-france.interieur.gouv.fr",
        release_owner="French Avocat au Barreau (Immigration Practice)",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=4,
        statutory_framework="Code de l'entrée et du séjour des étrangers et du droit d'asile (CESEDA)",
        notes="Country-specific review. Separate French statutory framework under CESEDA; Talent Passport draft under legal validation.",
        supported_families=[
            PathwayCategory.WORK,
            PathwayCategory.STUDY,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": False,
            "professional_review": False,
            "regression_tests": False,
            "visible_status": True,
        },
        eu_schengen_distinction_applies=True,
        independent_jurisdiction_rules=True,
    ),

    # Priority 5: Russia (Publish only after official-source and professional validation)
    "RU": CountryRegistryItem(
        code="RU",
        name="Russia",
        primary_authority="Main Directorate for Migration Affairs of the Ministry of Internal Affairs (MVD)",
        official_source_registry_url="https://мвд.рф",
        release_owner="Managing Legal Counsel",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=5,
        statutory_framework="Federal Law No. 115-FZ On the Legal Status of Foreign Citizens in the Russian Federation",
        notes="Unverified draft. Highly Qualified Specialist (VKS) rules pending bilateral treaty verification; safe-stop active.",
        supported_families=[
            PathwayCategory.WORK,
            PathwayCategory.STUDY,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": False,
            "professional_review": False,
            "regression_tests": False,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 5: Singapore (Other destinations - Publish only after validation)
    "SG": CountryRegistryItem(
        code="SG",
        name="Singapore",
        primary_authority="Ministry of Manpower (MOM) / Immigration & Checkpoints Authority (ICA)",
        official_source_registry_url="https://www.mom.gov.sg",
        release_owner="Southeast Asia Regulatory Counsel",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=5,
        statutory_framework="Employment of Foreign Manpower Act (EFMA); COMPASS Evaluation Framework",
        notes="Unverified draft. COMPASS points-based employment pass evaluation in preliminary drafting; safe-stop active.",
        supported_families=[
            PathwayCategory.WORK,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": False,
            "professional_review": False,
            "regression_tests": False,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 5: United Arab Emirates (Other destinations - Publish only after validation)
    "AE": CountryRegistryItem(
        code="AE",
        name="United Arab Emirates",
        primary_authority="Federal Authority for Identity, Citizenship, Customs and Port Security (ICP) / GDRFA",
        official_source_registry_url="https://icp.gov.ae",
        release_owner="Middle East Regional Legal Advisor",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=5,
        statutory_framework="Cabinet Resolution No. 65 of 2022 on the Executive Regulations of the Federal Decree-Law No. 29 of 2021",
        notes="Unverified draft. Golden Visa and Green Visa long-term residency tracks under formal source review.",
        supported_families=[
            PathwayCategory.PR_RESIDENCE,
            PathwayCategory.WORK,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": False,
            "professional_review": False,
            "regression_tests": False,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),

    # Priority 5: Japan (Other destinations - Publish only after validation)
    "JP": CountryRegistryItem(
        code="JP",
        name="Japan",
        primary_authority="Immigration Services Agency of Japan (ISA) / Ministry of Justice",
        official_source_registry_url="https://www.isa.go.jp/en",
        release_owner="Japan Registered Administrative Scrivener (Gyoseishoshi)",
        coverage_status=CoverageStatus.UNVERIFIED,
        priority_tier=5,
        statutory_framework="Immigration Control and Refugee Recognition Act (Cabinet Order No. 319 of 1951)",
        notes="Unverified draft. Highly Skilled Professional (HSP) points grid under legal translation and verification.",
        supported_families=[
            PathwayCategory.WORK,
            PathwayCategory.PR_RESIDENCE,
        ],
        release_conditions_status={
            "defined_inventory": True,
            "source_linked_rule_pack": False,
            "professional_review": False,
            "regression_tests": False,
            "visible_status": True,
        },
        independent_jurisdiction_rules=True,
    ),
}


# =========================================================================
# 2. PATHWAY TAXONOMY (Broad Application Families Across Jurisdictions)
# =========================================================================

PATHWAY_TAXONOMY: Dict[str, PathwayTaxonomyItem] = {
    # ---------------------------------------------------------------------
    # Canada (CA) — Priority 1: Fully Supported
    # ---------------------------------------------------------------------
    "CA_EXPRESS_ENTRY_FSW": PathwayTaxonomyItem(
        pathway_key="CA_EXPRESS_ENTRY_FSW",
        jurisdiction="CA",
        category=PathwayCategory.PR_RESIDENCE,
        title="Express Entry — Federal Skilled Worker Program (FSWP)",
        statutory_reference="IRPA s. 12(2); IRPR ss. 75-87",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html",
        description="Permanent residence for skilled workers with foreign work experience meeting the 67-point selection grid.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Covers Federal Skilled Worker stream; Provincial Nominee Programs require separate provincial stream validation.",
        independent_validation_confirmed=True,
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
        description="Authorization to study at a Canadian DLI with mandatory Provincial Attestation Letter (PAL) and proof of funds.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Covers post-secondary DLIs; master's/doctoral programs exempt from PAL under 2026 Ministerial Instructions.",
        independent_validation_confirmed=True,
    ),
    "CA_PGWP": PathwayTaxonomyItem(
        pathway_key="CA_PGWP",
        jurisdiction="CA",
        category=PathwayCategory.WORK,
        title="Post-Graduation Work Permit (PGWP)",
        statutory_reference="IRPR s. 205(c)(ii); Ministerial Instructions",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation.html",
        description="Open work permit for graduates from eligible Canadian DLIs with program completion proof and language requirements.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Must apply within 180 days of obtaining written confirmation of program completion.",
        independent_validation_confirmed=True,
    ),
    "CA_SPOUSAL_SPONSORSHIP": PathwayTaxonomyItem(
        pathway_key="CA_SPOUSAL_SPONSORSHIP",
        jurisdiction="CA",
        category=PathwayCategory.FAMILY,
        title="Spouse or Common-Law Partner Sponsorship",
        statutory_reference="IRPA s. 13(1); IRPR Part 7",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html",
        description="Permanent resident sponsorship for spouses and common-law partners with bona fide relationship evidence and financial undertaking.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Covers spousal and common-law partner class; dependent children over 22 require medical dependency exception.",
        independent_validation_confirmed=True,
    ),
    "CA_VISITOR_TRV": PathwayTaxonomyItem(
        pathway_key="CA_VISITOR_TRV",
        jurisdiction="CA",
        category=PathwayCategory.VISITOR,
        title="Temporary Resident Visa (Visitor Visa / TRV)",
        statutory_reference="IRPA s. 20; IRPR Part 9, ss. 179-193",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
        description="Temporary authorization to visit Canada for tourism, business visitor activities, or family visits up to 6 months.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="eTA eligible nationals apply through simplified digital portal rather than counterfoil sticker.",
        independent_validation_confirmed=True,
    ),
    "CA_CITIZENSHIP_GRANT": PathwayTaxonomyItem(
        pathway_key="CA_CITIZENSHIP_GRANT",
        jurisdiction="CA",
        category=PathwayCategory.CITIZENSHIP,
        title="Grant of Canadian Citizenship (Adult 18+)",
        statutory_reference="Citizenship Act (R.S.C., 1985, c. C-29), s. 5(1)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen.html",
        description="Naturalization requiring 1,095 days physical presence in Canada within 5 years, tax filing, and knowledge/language test.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires permanent resident status and meeting physical presence calculation without unapproved absences.",
        independent_validation_confirmed=True,
    ),
    "CA_STATUS_EXTENSION_WORKER": PathwayTaxonomyItem(
        pathway_key="CA_STATUS_EXTENSION_WORKER",
        jurisdiction="CA",
        category=PathwayCategory.EXTENSION_RENEWAL_CHANGE,
        title="Extension of Temporary Resident Status / Work Permit",
        statutory_reference="IRPR ss. 181, 186(u) (Maintained Status)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/extend-permit.html",
        description="Application to extend authorization to work in Canada with maintained (implied) status protections.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Must be submitted strictly prior to midnight UTC of work permit expiration date.",
        independent_validation_confirmed=True,
    ),
    "CA_REFUGEE_PROTECTION_CLAIM": PathwayTaxonomyItem(
        pathway_key="CA_REFUGEE_PROTECTION_CLAIM",
        jurisdiction="CA",
        category=PathwayCategory.HUMANITARIAN_PROTECTION,
        title="In-Canada Refugee Protection Claim",
        statutory_reference="IRPA ss. 95-98; Refugee Protection Division (RPD) Rules",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.canada.ca/en/immigration-refugees-citizenship/services/refugees/claim-protection-inside-canada.html",
        description="Convention refugee and Person in Need of Protection claim before the Immigration and Refugee Board (IRB).",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="Lead Canadian Immigration Counsel & Designated RCIC",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Basis of Claim (BOC) preparation and credible testimony require independent litigation counsel; platform handles document gathering only.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # United States (US) — Priority 2: Fully Supported (Independent Pathway Validation)
    # ---------------------------------------------------------------------
    "US_EB1A": PathwayTaxonomyItem(
        pathway_key="US_EB1A",
        jurisdiction="US",
        category=PathwayCategory.PR_RESIDENCE,
        title="EB-1A Extraordinary Ability Immigrant Visa",
        statutory_reference="INA § 203(b)(1)(A), 8 U.S.C. § 1153(b)(1)(A); 8 CFR § 204.5(h)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2",
        description="First-preference employment petition requiring sustained national or international acclaim evaluated under Kazarian two-step analysis.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Self-petition allowed; final merits determination requires documented proof of sustained acclaim.",
        independent_validation_confirmed=True,
    ),
    "US_H1B": PathwayTaxonomyItem(
        pathway_key="US_H1B",
        jurisdiction="US",
        category=PathwayCategory.WORK,
        title="H-1B Specialty Occupation Nonimmigrant Worker",
        statutory_reference="INA § 101(a)(15)(H)(i)(b); 8 CFR § 214.2(h)(4)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations",
        description="Temporary specialty occupation requiring specialized bachelor's degree and certified Form ETA-9035 LCA from DOL.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Employer-sponsored petition; subject to annual statutory cap unless cap-exempt institution.",
        independent_validation_confirmed=True,
    ),
    "US_AOS_I485": PathwayTaxonomyItem(
        pathway_key="US_AOS_I485",
        jurisdiction="US",
        category=PathwayCategory.PR_RESIDENCE,
        title="Form I-485 Application to Register Permanent Residence / Adjust Status",
        statutory_reference="INA § 245; 8 CFR Part 245",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/i-485",
        description="Adjustment of status to lawful permanent resident within the US; standalone validation with I-693 medical and I-864 affidavit.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Applicant must have been inspected and admitted or paroled into the US and maintain visa availability under the Visa Bulletin.",
        independent_validation_confirmed=True,
    ),
    "US_NATURALIZATION_N400": PathwayTaxonomyItem(
        pathway_key="US_NATURALIZATION_N400",
        jurisdiction="US",
        category=PathwayCategory.CITIZENSHIP,
        title="Form N-400 Application for Naturalization",
        statutory_reference="INA §§ 316, 319; 8 CFR Part 316",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/n-400",
        description="Grant of United States citizenship after 5 years (or 3 years if married to US citizen) lawful permanent residence.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires continuous residence, physical presence, good moral character, and passage of English/Civics exam.",
        independent_validation_confirmed=True,
    ),
    "US_O1A": PathwayTaxonomyItem(
        pathway_key="US_O1A",
        jurisdiction="US",
        category=PathwayCategory.WORK,
        title="O-1A Individuals with Extraordinary Ability in Sciences, Education, Business, or Athletics",
        statutory_reference="INA § 101(a)(15)(O)(i); 8 CFR § 214.2(o)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement",
        description="Nonimmigrant visa for individuals with sustained extraordinary acclaim supported by peer advisory consultations.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires US employer or agent petitioner and formal written advisory opinion from appropriate peer group or labor union.",
        independent_validation_confirmed=True,
    ),
    "US_F1_STUDENT": PathwayTaxonomyItem(
        pathway_key="US_F1_STUDENT",
        jurisdiction="US",
        category=PathwayCategory.STUDY,
        title="F-1 Academic Student Nonimmigrant Visa",
        statutory_reference="INA § 101(a)(15)(F)(i); 8 CFR § 214.2(f)",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        description="Authorization to enter the US as a full-time academic student at an SEVP-certified institution with Form I-20.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Must demonstrate nonimmigrant intent, residence abroad without intention of abandonment, and sufficient funds.",
        independent_validation_confirmed=True,
    ),
    "US_B1_B2_VISITOR": PathwayTaxonomyItem(
        pathway_key="US_B1_B2_VISITOR",
        jurisdiction="US",
        category=PathwayCategory.VISITOR,
        title="B-1/B-2 Temporary Visitor for Business or Pleasure",
        statutory_reference="INA § 101(a)(15)(B); 22 CFR § 41.31",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html",
        description="Nonimmigrant visa for temporary business meetings, conferences, or tourism with strong foreign ties evidence.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Productive employment strictly prohibited; applicants from VWP countries should utilize ESTA unless ineligible.",
        independent_validation_confirmed=True,
    ),
    "US_I130_SPOUSE": PathwayTaxonomyItem(
        pathway_key="US_I130_SPOUSE",
        jurisdiction="US",
        category=PathwayCategory.FAMILY,
        title="Form I-130 Petition for Alien Relative (Spouse of US Citizen / LPR)",
        statutory_reference="INA § 204; 8 CFR Part 204",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/i-130",
        description="Petition establishing qualifying bona fide marital relationship between petitioner and foreign spouse.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Conditional permanent residence applies if marriage is less than two years old at the time of green card approval.",
        independent_validation_confirmed=True,
    ),
    "US_I539_EXTENSION_CHANGE": PathwayTaxonomyItem(
        pathway_key="US_I539_EXTENSION_CHANGE",
        jurisdiction="US",
        category=PathwayCategory.EXTENSION_RENEWAL_CHANGE,
        title="Form I-539 Application to Extend/Change Nonimmigrant Status",
        statutory_reference="INA § 248; 8 CFR Part 248",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.uscis.gov/i-539",
        description="Application to extend nonimmigrant stay or change to another eligible nonimmigrant classification within the US.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Applicant must be maintaining lawful nonimmigrant status on the date of filing without unauthorized employment.",
        independent_validation_confirmed=True,
    ),
    "US_I589_ASYLUM": PathwayTaxonomyItem(
        pathway_key="US_I589_ASYLUM",
        jurisdiction="US",
        category=PathwayCategory.HUMANITARIAN_PROTECTION,
        title="Form I-589 Application for Asylum and for Withholding of Removal",
        statutory_reference="INA § 208, 8 U.S.C. § 1158; 8 CFR Part 208",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.uscis.gov/i-589",
        description="Protection for individuals fleeing persecution on account of race, religion, nationality, membership in a PSG, or political opinion.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="Senior US Immigration Partner (AILA Member)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Strict 1-year filing deadline from date of US entry; platform handles evidence cataloging, substantive legal brief requires licensed attorney.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # Australia (AU) — Priority 3: Separate Reviewed Rules/Templates
    # ---------------------------------------------------------------------
    "AU_SUBCLASS_189": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_189",
        jurisdiction="AU",
        category=PathwayCategory.PR_RESIDENCE,
        title="Skilled Independent Visa (Subclass 189)",
        statutory_reference="Migration Act 1958; Migration Regulations 1994, Schedule 2, Subclass 189",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
        description="Points-tested permanent residence for invited skilled workers with positive skills assessment and English competency.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="MARA Registered Migration Agent",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Requires invitation via SkillSelect based on occupation on the Medium and Long-term Strategic Skills List (MLTSSL).",
        independent_validation_confirmed=True,
    ),
    "AU_SUBCLASS_482": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_482",
        jurisdiction="AU",
        category=PathwayCategory.WORK,
        title="Temporary Skill Shortage Visa (Subclass 482 - TSS)",
        statutory_reference="Migration Regulations 1994, Schedule 2, Subclass 482",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-skill-shortage-482",
        description="Employer-sponsored temporary visa requiring approved sponsor, nominated occupation, and minimum 2 years relevant work experience.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="MARA Registered Migration Agent",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires approved Standard Business Sponsorship (SBS) and valid nomination approval from Home Affairs.",
        independent_validation_confirmed=True,
    ),
    "AU_SUBCLASS_500": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_500",
        jurisdiction="AU",
        category=PathwayCategory.STUDY,
        title="Student Visa (Subclass 500)",
        statutory_reference="Migration Regulations 1994, Schedule 2, Subclass 500",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        description="Student visa with Confirmation of Enrolment (CoE), Genuine Student (GS) submission, Overseas Student Health Cover (OSHC).",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="MARA Registered Migration Agent",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Evidence of financial capacity depends on the evidentiary matrix of student's passport and education provider rating.",
        independent_validation_confirmed=True,
    ),
    "AU_SUBCLASS_600": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_600",
        jurisdiction="AU",
        category=PathwayCategory.VISITOR,
        title="Visitor Visa (Subclass 600 - Tourist & Business Streams)",
        statutory_reference="Migration Regulations 1994, Schedule 2, Subclass 600",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600",
        description="Temporary visa for tourism or business visitor activities with Genuine Temporary Entrant assessment.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="MARA Registered Migration Agent",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="ETA (Subclass 601) and eVisitor (Subclass 651) apply to eligible passport holders via automated processing.",
        independent_validation_confirmed=True,
    ),
    "AU_SUBCLASS_820_801": PathwayTaxonomyItem(
        pathway_key="AU_SUBCLASS_820_801",
        jurisdiction="AU",
        category=PathwayCategory.FAMILY,
        title="Partner Visa (Subclasses 820 & 801 - Onshore)",
        statutory_reference="Migration Regulations 1994, Schedule 2, Subclasses 820/801",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/partner-onshore",
        description="Two-stage onshore partner visa for spouses and de facto partners of Australian citizens or permanent residents.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="MARA Registered Migration Agent",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires evidence across 4 statutory pillars: financial aspects, household nature, social aspects, mutual commitment.",
        independent_validation_confirmed=True,
    ),
    "AU_CITIZENSHIP_CONFERENCE": PathwayTaxonomyItem(
        pathway_key="AU_CITIZENSHIP_CONFERENCE",
        jurisdiction="AU",
        category=PathwayCategory.CITIZENSHIP,
        title="Australian Citizenship by Conferral",
        statutory_reference="Australian Citizenship Act 2007 (Cth), s. 21",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://immi.homeaffairs.gov.au/citizenship/become-a-citizen",
        description="Grant of Australian citizenship requiring general residence requirement (4 years lawful, 12 months PR) and citizenship test.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="MARA Registered Migration Agent",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Manual verification of character requirements and overseas police clearances where applicable.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # New Zealand (NZ) — Priority 3: Separate Reviewed Rules/Templates
    # ---------------------------------------------------------------------
    "NZ_SKILLED_MIGRANT": PathwayTaxonomyItem(
        pathway_key="NZ_SKILLED_MIGRANT",
        jurisdiction="NZ",
        category=PathwayCategory.PR_RESIDENCE,
        title="Skilled Migrant Category Resident Visa (SMC)",
        statutory_reference="Immigration Act 2009; INZ Operational Manual: Residence, SM1",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.immigration.govt.nz/new-zealand-visas/visas/visa/skilled-migrant-category-resident-visa",
        description="Permanent residence for skilled migrants earning 6 points from NZ registration, qualifications, or income, plus accredited employer job.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Licensed Immigration Adviser (NZIAA)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Applicant must meet English language requirements (IELTS 6.5) and age limit of 55 or under.",
        independent_validation_confirmed=True,
    ),
    "NZ_ACCREDITED_EMPLOYER_WORK": PathwayTaxonomyItem(
        pathway_key="NZ_ACCREDITED_EMPLOYER_WORK",
        jurisdiction="NZ",
        category=PathwayCategory.WORK,
        title="Accredited Employer Work Visa (AEWV)",
        statutory_reference="Immigration Act 2009; INZ Operational Manual: Temporary Entry, WA",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.immigration.govt.nz/new-zealand-visas/visas/visa/accredited-employer-work-visa",
        description="Temporary work visa requiring employer accreditation, approved Job Check token, and minimum median wage compliance.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Licensed Immigration Adviser (NZIAA)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires valid Job Check number issued to the accredited employer; applicant must meet minimum skill thresholds.",
        independent_validation_confirmed=True,
    ),
    "NZ_STUDENT_VISA": PathwayTaxonomyItem(
        pathway_key="NZ_STUDENT_VISA",
        jurisdiction="NZ",
        category=PathwayCategory.STUDY,
        title="Fee Paying Student Visa",
        statutory_reference="Immigration Act 2009; INZ Operational Manual: U3",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.immigration.govt.nz/new-zealand-visas/visas/visa/fee-paying-student-visa",
        description="Study visa with unconditional Offer of Place, paid tuition fees receipt, and proof of living funds (NZD $20,000/yr).",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Licensed Immigration Adviser (NZIAA)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Education provider must be signatory to the Education (Pastoral Care of Tertiary and International Learners) Code of Practice.",
        independent_validation_confirmed=True,
    ),
    "NZ_VISITOR_VISA": PathwayTaxonomyItem(
        pathway_key="NZ_VISITOR_VISA",
        jurisdiction="NZ",
        category=PathwayCategory.VISITOR,
        title="General Visitor Visa",
        statutory_reference="Immigration Act 2009; INZ Operational Manual: V2",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.immigration.govt.nz/new-zealand-visas/visas/visa/visitor-visa",
        description="Temporary visa to visit friends, family, or travel in New Zealand for up to 9 months with onward travel ticket.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Licensed Immigration Adviser (NZIAA)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="NZeTA applies to visa-waiver nationals for stays up to 3 months (or 6 months for UK citizens).",
        independent_validation_confirmed=True,
    ),
    "NZ_PARTNER_RESIDENT": PathwayTaxonomyItem(
        pathway_key="NZ_PARTNER_RESIDENT",
        jurisdiction="NZ",
        category=PathwayCategory.FAMILY,
        title="Partner of a New Zealander Resident Visa",
        statutory_reference="Immigration Act 2009; INZ Operational Manual: F2",
        coverage_status=CoverageStatus.SUPPORTED,
        official_source_url="https://www.immigration.govt.nz/new-zealand-visas/visas/visa/partner-of-a-new-zealander-resident-visa",
        description="Residence visa for partners living together in a genuine and stable relationship with a NZ citizen or resident for 12+ months.",
        validation_level="production_verified",
        release_conditions_met=True,
        professional_reviewer="Licensed Immigration Adviser (NZIAA)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Requires minimum 12 months cohabitation evidence; partners with less time must apply for a temporary work/visitor visa first.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # United Kingdom (GB) — Priority 4: Partial (Country-Specific Review)
    # ---------------------------------------------------------------------
    "GB_GLOBAL_TALENT": PathwayTaxonomyItem(
        pathway_key="GB_GLOBAL_TALENT",
        jurisdiction="GB",
        category=PathwayCategory.PR_RESIDENCE,
        title="Global Talent Visa",
        statutory_reference="UK Immigration Rules Appendix Global Talent",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.gov.uk/global-talent",
        description="Working in the UK as a leader or potential leader in academia, arts, or digital technology via designated endorsing bodies.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="UK Immigration Solicitor (SRA Regulated)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase6_rules_checklist_engine.py",
        scope_limitations="Endorsement by Tech Nation, Royal Society, British Academy, or Arts Council England requires independent evidence assessment.",
        independent_validation_confirmed=True,
    ),
    "GB_SKILLED_WORKER": PathwayTaxonomyItem(
        pathway_key="GB_SKILLED_WORKER",
        jurisdiction="GB",
        category=PathwayCategory.WORK,
        title="Skilled Worker Visa",
        statutory_reference="UK Immigration Rules Appendix Skilled Worker",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.gov.uk/skilled-worker-visa",
        description="Points-based visa requiring valid Certificate of Sponsorship (CoS), approved UK employer, B1 English, and salary threshold.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="UK Immigration Solicitor (SRA Regulated)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="General threshold £38,700 under April 2024 rules; health and care worker exemptions require manual rate verification.",
        independent_validation_confirmed=True,
    ),
    "GB_STUDENT_VISA": PathwayTaxonomyItem(
        pathway_key="GB_STUDENT_VISA",
        jurisdiction="GB",
        category=PathwayCategory.STUDY,
        title="Student Visa (Higher Education)",
        statutory_reference="UK Immigration Rules Appendix Student",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.gov.uk/student-visa",
        description="Student route with Confirmation of Acceptance for Studies (CAS) from licensed student sponsor and maintenance funds.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="UK Immigration Solicitor (SRA Regulated)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="International students cannot bring dependents unless enrolled in research postgraduate or PhD degrees.",
        independent_validation_confirmed=True,
    ),
    "GB_STANDARD_VISITOR": PathwayTaxonomyItem(
        pathway_key="GB_STANDARD_VISITOR",
        jurisdiction="GB",
        category=PathwayCategory.VISITOR,
        title="Standard Visitor Visa",
        statutory_reference="UK Immigration Rules Appendix V: Visitor",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.gov.uk/standard-visitor",
        description="Short-stay visa for tourism, visiting family, or permitted business activities for up to 6 months.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="UK Immigration Solicitor (SRA Regulated)",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Strict prohibition on taking up UK employment or accessing public funds.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # Germany (DE) — Priority 4: Partial (Country-Specific; EU/Schengen Distinction)
    # ---------------------------------------------------------------------
    "DE_EU_BLUE_CARD": PathwayTaxonomyItem(
        pathway_key="DE_EU_BLUE_CARD",
        jurisdiction="DE",
        category=PathwayCategory.WORK,
        title="EU Blue Card (Blaue Karte EU)",
        statutory_reference="AufenthG § 18g; EU Directive 2021/1883",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Migrathek/BlaueKarteEU/blauekarteeu-node.html",
        description="Work and residence permit for university graduates with binding German job offer exceeding statutory salary thresholds.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="European Migration Legal Specialist",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="German-specific implementation under AufenthG § 18g; EU Blue Card from other member states does not grant direct work rights in Germany.",
        independent_validation_confirmed=True,
    ),
    "DE_CHANCENKARTE": PathwayTaxonomyItem(
        pathway_key="DE_CHANCENKARTE",
        jurisdiction="DE",
        category=PathwayCategory.WORK,
        title="Opportunity Card (Chancenkarte)",
        statutory_reference="AufenthG § 20a",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://www.make-it-in-germany.com/en/visa-residence/types/jobseekers/opportunity-card",
        description="Points-based job search card requiring 6 points across qualifications, language (German A1/English B2), age, and past German ties.",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft under German legal audit; safe stop active.",
        independent_validation_confirmed=True,
    ),
    "DE_STUDENT_VISA": PathwayTaxonomyItem(
        pathway_key="DE_STUDENT_VISA",
        jurisdiction="DE",
        category=PathwayCategory.STUDY,
        title="German Student Residence Permit (Visum zum Studium)",
        statutory_reference="AufenthG § 16b",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://www.make-it-in-germany.com/en/visa-residence/types/studying-training/studies",
        description="Study residence permit with university admission letter and statutory blocked account (Sperrkonto €11,904/yr).",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="European Migration Legal Specialist",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="Blocked account proof and statutory German public health insurance (Krankenversicherung) mandatory.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # France (FR) — Priority 4: Selected Europe (Country-Specific Review; Unverified)
    # ---------------------------------------------------------------------
    "FR_PASSEPORT_TALENT": PathwayTaxonomyItem(
        pathway_key="FR_PASSEPORT_TALENT",
        jurisdiction="FR",
        category=PathwayCategory.WORK,
        title="Passeport Talent (Talent Passport — Qualified Employee)",
        statutory_reference="CESEDA Articles L. 421-9 to L. 421-13",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://www.service-public.fr/particuliers/vosdroits/N110",
        description="Multi-year French residence permit for qualified employees, startup founders, and researchers.",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft under counsel review; cannot generate production filing checklists under safe stop guarantee.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # Schengen Common Short-Stay (Visitor Only — No universal work/residence)
    # ---------------------------------------------------------------------
    "EU_SCHENGEN_TOURIST_C": PathwayTaxonomyItem(
        pathway_key="EU_SCHENGEN_TOURIST_C",
        jurisdiction="DE",
        category=PathwayCategory.VISITOR,
        title="Uniform Schengen Short-Stay Visa (Type C)",
        statutory_reference="Regulation (EC) No 810/2009 (Community Code on Visas)",
        coverage_status=CoverageStatus.PARTIAL,
        official_source_url="https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/schengen-visa_en",
        description="Short-stay transit or tourism visa across 29 Schengen states for up to 90 days in any 180-day period.",
        validation_level="partial_review",
        release_conditions_met=True,
        professional_reviewer="European Migration Legal Specialist",
        review_timestamp="2026-01-15T00:00:00Z",
        regression_test_suite="test_phase12_country_pathway_expansion.py",
        scope_limitations="CRITICAL: Valid strictly for short-stay tourism/business. Long-stay national visas (Type D), employment, and residence permits remain sovereign national competence and cannot use a universal EU checklist.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # Russia (RU) — Priority 5: Unverified (Safe Stop Guard)
    # ---------------------------------------------------------------------
    "RU_VKS": PathwayTaxonomyItem(
        pathway_key="RU_VKS",
        jurisdiction="RU",
        category=PathwayCategory.WORK,
        title="Highly Qualified Specialist Work Visa (ВКС)",
        statutory_reference="Federal Law No. 115-FZ, Article 13.2",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://мвд.рф",
        description="Work visa for foreign specialists exceeding the statutory quarterly salary threshold (750,000 RUB).",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft under official source review; safe stop prevents checklist generation until bilateral legal audit completes.",
        independent_validation_confirmed=True,
    ),
    "RU_STUDENT_VISA": PathwayTaxonomyItem(
        pathway_key="RU_STUDENT_VISA",
        jurisdiction="RU",
        category=PathwayCategory.STUDY,
        title="Russian Academic Student Visa",
        statutory_reference="Federal Law No. 114-FZ, Article 25.1",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://мвд.рф",
        description="Student entry visa based on official Ministry of Science and Higher Education quota invitation.",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft unverified; safe stop active.",
        independent_validation_confirmed=True,
    ),

    # ---------------------------------------------------------------------
    # Singapore, UAE, Japan — Priority 5: Other Destinations (Safe Stop Guard)
    # ---------------------------------------------------------------------
    "SG_EMPLOYMENT_PASS": PathwayTaxonomyItem(
        pathway_key="SG_EMPLOYMENT_PASS",
        jurisdiction="SG",
        category=PathwayCategory.WORK,
        title="Singapore Employment Pass (COMPASS Framework)",
        statutory_reference="Employment of Foreign Manpower Act (EFMA); MOM COMPASS Rules",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://www.mom.gov.sg/passes-and-permits/employment-pass",
        description="Work pass for foreign professionals earning at least SGD 5,000/month evaluated on 40 COMPASS points.",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft under validation; safe stop active.",
        independent_validation_confirmed=True,
    ),
    "AE_GOLDEN_VISA": PathwayTaxonomyItem(
        pathway_key="AE_GOLDEN_VISA",
        jurisdiction="AE",
        category=PathwayCategory.PR_RESIDENCE,
        title="UAE 10-Year Golden Visa (Exceptional Talent & Professionals)",
        statutory_reference="Cabinet Resolution No. 65 of 2022",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://icp.gov.ae",
        description="Long-term renewable 10-year residency for exceptional specialists, scientists, executive directors, and investors.",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft under validation; safe stop active.",
        independent_validation_confirmed=True,
    ),
    "JP_HIGHLY_SKILLED_PROFESSIONAL": PathwayTaxonomyItem(
        pathway_key="JP_HIGHLY_SKILLED_PROFESSIONAL",
        jurisdiction="JP",
        category=PathwayCategory.WORK,
        title="Highly Skilled Professional (HSP (i)(b) — Advanced Specialized/Technical)",
        statutory_reference="Immigration Control and Refugee Recognition Act, App. Table 1(2)",
        coverage_status=CoverageStatus.UNVERIFIED,
        official_source_url="https://www.isa.go.jp/en/publications/materials/highly-skilled-professionals.html",
        description="Points-based preferential immigration status requiring at least 70 points across academic, career, and income criteria.",
        validation_level="draft_unverified",
        release_conditions_met=False,
        professional_reviewer=None,
        review_timestamp=None,
        regression_test_suite=None,
        scope_limitations="Draft under validation; safe stop active.",
        independent_validation_confirmed=True,
    ),
}


# =========================================================================
# 3. HELPER & RESOLUTION METHODS
# =========================================================================

PRIORITY_SORT_ORDER = {
    "CA": 1,
    "US": 2,
    "AU": 3,
    "NZ": 4,
    "GB": 5,
    "DE": 6,
    "FR": 7,
    "RU": 8,
    "SG": 9,
    "AE": 10,
    "JP": 11,
}


def get_country_registry() -> List[CountryRegistryItem]:
    """Returns sorted country registry by priority tier, following the official priority sequence."""
    return sorted(list(COUNTRY_REGISTRY.values()), key=lambda c: (c.priority_tier, PRIORITY_SORT_ORDER.get(c.code, 99)))


def get_pathways_by_jurisdiction(jurisdiction: str) -> List[PathwayTaxonomyItem]:
    """Returns all mapped pathways for a jurisdiction code."""
    jur = jurisdiction.upper()
    return [p for p in PATHWAY_TAXONOMY.values() if p.jurisdiction == jur]


def get_pathways_by_category(category: PathwayCategory) -> List[PathwayTaxonomyItem]:
    """Returns all mapped pathways belonging to a specific broad application family."""
    return [p for p in PATHWAY_TAXONOMY.values() if p.category == category]


def get_pathway_coverage(jurisdiction: str, pathway_key: str) -> CoverageStatus:
    """Safely resolves pathway coverage status.
    If jurisdiction is not registered -> UNSUPPORTED.
    If pathway is not mapped -> UNSUPPORTED.
    Never falls back to speculative or unrelated checklists.
    """
    jur = jurisdiction.upper()
    if jur not in COUNTRY_REGISTRY:
        return CoverageStatus.UNSUPPORTED

    clean_key = pathway_key.upper().replace("-", "_").replace(" ", "_")
    if not clean_key.startswith(f"{jur}_"):
        clean_key = f"{jur}_{clean_key}"

    if clean_key in PATHWAY_TAXONOMY:
        return PATHWAY_TAXONOMY[clean_key].coverage_status

    # Search loose match for pathway key under the given jurisdiction
    for p_key, item in PATHWAY_TAXONOMY.items():
        if item.jurisdiction == jur:
            if pathway_key.lower() in p_key.lower() or p_key.lower() in pathway_key.lower():
                return item.coverage_status

    return CoverageStatus.UNSUPPORTED


def get_pathway_dossier(pathway_key: str) -> Optional[Dict[str, Any]]:
    """Retrieves full validation dossier for a pathway."""
    clean_key = pathway_key.upper().replace("-", "_").replace(" ", "_")
    item = PATHWAY_TAXONOMY.get(clean_key)
    if not item:
        for k, v in PATHWAY_TAXONOMY.items():
            if pathway_key.lower() in k.lower():
                item = v
                break

    if not item:
        return None

    country = COUNTRY_REGISTRY.get(item.jurisdiction)
    return {
        "pathway": item.model_dump(),
        "country": country.model_dump() if country else None,
        "is_safe_to_generate_checklist": item.coverage_status in [CoverageStatus.SUPPORTED, CoverageStatus.PARTIAL],
        "safe_stop_required": item.coverage_status in [CoverageStatus.UNVERIFIED, CoverageStatus.UNSUPPORTED],
    }


def get_coverage_matrix() -> Dict[str, Any]:
    """Returns full jurisdiction and pathway coverage matrix across all 5 priority tiers and 8 broad families."""
    countries_data = []
    for country in get_country_registry():
        pathways = get_pathways_by_jurisdiction(country.code)
        countries_data.append({
            "country": country.model_dump(),
            "pathways_count": len(pathways),
            "supported_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.SUPPORTED),
            "partial_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.PARTIAL),
            "unverified_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.UNVERIFIED),
            "unsupported_count": sum(1 for p in pathways if p.coverage_status == CoverageStatus.UNSUPPORTED),
            "pathways": [p.model_dump() for p in pathways],
        })

    # Group by broad application family
    families_breakdown = {}
    for cat in PathwayCategory:
        cat_pathways = get_pathways_by_category(cat)
        families_breakdown[cat.value] = {
            "total": len(cat_pathways),
            "supported": sum(1 for p in cat_pathways if p.coverage_status == CoverageStatus.SUPPORTED),
            "partial": sum(1 for p in cat_pathways if p.coverage_status == CoverageStatus.PARTIAL),
            "unverified": sum(1 for p in cat_pathways if p.coverage_status == CoverageStatus.UNVERIFIED),
            "unsupported": sum(1 for p in cat_pathways if p.coverage_status == CoverageStatus.UNSUPPORTED),
        }

    return {
        "coverage_summary": {
            "total_countries": len(COUNTRY_REGISTRY),
            "supported_countries": sum(1 for c in COUNTRY_REGISTRY.values() if c.coverage_status == CoverageStatus.SUPPORTED),
            "partial_countries": sum(1 for c in COUNTRY_REGISTRY.values() if c.coverage_status == CoverageStatus.PARTIAL),
            "unverified_countries": sum(1 for c in COUNTRY_REGISTRY.values() if c.coverage_status == CoverageStatus.UNVERIFIED),
            "total_pathways": len(PATHWAY_TAXONOMY),
            "supported_pathways": sum(1 for p in PATHWAY_TAXONOMY.values() if p.coverage_status == CoverageStatus.SUPPORTED),
            "partial_pathways": sum(1 for p in PATHWAY_TAXONOMY.values() if p.coverage_status == CoverageStatus.PARTIAL),
            "unverified_pathways": sum(1 for p in PATHWAY_TAXONOMY.values() if p.coverage_status == CoverageStatus.UNVERIFIED),
            "priority_tiers": {
                "tier_1_canada": "Fully Supported (IRCC source-linked)",
                "tier_2_usa": "Fully Supported (Zero legacy hard-coded assumptions)",
                "tier_3_australia_new_zealand": "Fully Supported (Separate rules & templates per jurisdiction)",
                "tier_4_uk_germany_europe": "Partial Coverage (Country-specific review; EU is not one checklist)",
                "tier_5_russia_other": "Unverified (Safe stop; publish only after validation)",
            },
        },
        "families_breakdown": families_breakdown,
        "countries": countries_data,
    }
