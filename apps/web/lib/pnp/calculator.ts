/**
 * Official Canadian Provincial Nominee Program (PNP) — Multi-Province EOI & Selection Engine
 *
 * Implements the verified 2026 official provincial government scoring grids starting cleanly at 0 points
 * (zero sample scenarios / zero pre-filled values):
 *
 * 1. Ontario — OINP (Ontario Workforce Priority Stream EOI • Updated Oct 5, 2026 • Max 132 pts / 117 Self-Employed Physician)
 *    Note: Legacy Masters Graduate (closed May 30, 2026) & PhD Graduate (closed June 26, 2026) streams retired.
 * 2. British Columbia — BC PNP (Skills Immigration Registration System / SIRS • Care, Build & Innovate • Max 200 pts)
 * 3. Alberta — AAIP (Worker Expression of Interest Points Grid • Human Capital 69 + Economic 31 • Max 100 pts)
 * 4. Saskatchewan — SINP (International Skilled Worker Points Assessment Grid • Pass Mark 60 • Max 110 pts)
 * 5. Manitoba — MPNP (Expression of Interest Ranking Grid • Max 1,000 pts with up to -200 Risk Assessment deductions)
 * 6. Prince Edward Island — PEI PNP (Express Entry & Workforce EOI Grid • Max 100 pts)
 */

import {
  CLBLevel,
  isEnglishTest,
  isFrenchTest,
  LanguageAbilities,
  LanguageTestType,
} from "../crs/calculator";

export type PnpProvinceId =
  | "ontario_oinp"
  | "bc_pnp"
  | "alberta_aaip"
  | "saskatchewan_sinp"
  | "manitoba_mpnp"
  | "pei_pnp";

export type SharedPnpEducationLevel =
  | ""
  | "secondary_or_less"
  | "trade_certificate"
  | "one_year_post_secondary"
  | "two_year_post_secondary"
  | "bachelors_three_year"
  | "two_or_more_degrees"
  | "post_grad_diploma"
  | "masters"
  | "doctoral_or_md";

export type NocTeerCategory = "" | "teer_0_1" | "teer_2_3" | "teer_4_5";

export type NocBroadCategory =
  | ""
  | "cat_3_health"
  | "cat_7_trades_transport"
  | "cat_2_stem_natural_applied"
  | "cat_0_1_4_8_9_mgmt_biz_edu_mfg"
  | "cat_5_6_arts_sales_service";

// --- Ontario OINP Specific Types ---
export type OinpWorkExperienceTier =
  | ""
  | "none_or_under_6m"
  | "general_on_6_to_11m"
  | "general_on_12m_plus"
  | "job_offer_role_6_to_12m"
  | "job_offer_role_13_to_24m"
  | "job_offer_role_24m_plus";

export type OinpLegalStatus = "" | "work_permit" | "study_permit" | "other_or_outside";

export type OinpCraEarningsBracket =
  | ""
  | "under_30k"
  | "30k_to_49k"
  | "50k_to_69k"
  | "70k_to_79k"
  | "80k_plus";

export type OinpWorkRegion =
  | ""
  | "northern_ontario"
  | "outside_gta_other"
  | "gta_excluding_toronto"
  | "city_of_toronto";

export type OinpCanadianCredentials = "" | "none" | "one_credential" | "two_or_more";

// --- BC PNP Specific Types ---
export type BcRelatedWorkYears =
  | ""
  | "none"
  | "under_1yr"
  | "1_to_2yr"
  | "2_to_3yr"
  | "3_to_4yr"
  | "4_to_5yr"
  | "5yr_plus";

export type BcEducationLocation = "" | "outside_canada" | "canada_outside_bc" | "inside_bc";

export type BcEmploymentArea =
  | ""
  | "area_1_metro_vancouver"
  | "area_2_squamish_abbotsford_chilliwack"
  | "area_3_rest_of_bc";

// --- Alberta AAIP Specific Types ---
export type AaipEducationLocation = "" | "outside_canada" | "other_province" | "alberta";

export type AaipTotalWorkMonths = "" | "none" | "under_6m" | "6_to_11m" | "12m_plus";

export type AaipCanadianWorkLocation = "" | "none_under_6m" | "other_province_6m" | "alberta_6m";

export type AaipJobLocation = "" | "calgary_edmonton_cma" | "rural_or_outside_cma";

// --- Saskatchewan SINP Specific Types ---
export type SinpRecentWorkYears = 0 | 1 | 2 | 3 | 4 | 5;
export type SinpOlderWorkYears = 0 | 1 | 2 | 3 | 4 | 5;
export type SinpSectorType = "" | "priority_sector" | "capped_sector" | "standard_sector";

// --- Manitoba MPNP Specific Types ---
export type MpnpWorkYears = 0 | 1 | 2 | 3 | 4;

export type MpnpAdaptabilityPrimary =
  | ""
  | "none"
  | "ongoing_mb_employment_or_strategic_ita"
  | "close_relative_mb"
  | "previous_mb_work_6m"
  | "mb_post_sec_2yr"
  | "mb_post_sec_1yr"
  | "distant_relative_or_friend_mb";

// --- PEI PNP Specific Types ---
export type PeiPathwayMode = "with_job_offer" | "without_job_offer";
export type PeiWorkYears = "" | "none" | "1yr" | "2_to_3yr" | "4_to_5yr" | "6yr_plus";

export interface PnpCalculatorInput {
  activeProvince: PnpProvinceId;

  // Shared Core Human Capital Inputs (all start unselected -> 0 points)
  age: number | null;
  educationLevel: SharedPnpEducationLevel;
  hasValidLanguageTest: boolean | null;
  firstLanguageTest: LanguageTestType;
  firstLanguage: LanguageAbilities;
  secondLanguageTest: LanguageTestType;
  secondLanguage: LanguageAbilities;

  // Shared Wage Helper (used by OINP & BC PNP; null = unselected -> 0 pts)
  hourlyWage: number | null;

  // 1. Ontario OINP Specifics
  oinpIsSelfEmployedPhysician: boolean;
  oinpWorkExperience: OinpWorkExperienceTier;
  oinpNocTeer: NocTeerCategory;
  oinpNocBroadCategory: NocBroadCategory;
  oinpLegalStatus: OinpLegalStatus;
  oinpCraEarnings: OinpCraEarningsBracket;
  oinpWorkRegion: OinpWorkRegion;
  oinpCanadianCredentials: OinpCanadianCredentials;

  // 2. British Columbia BC PNP Specifics
  bcRelatedWorkYears: BcRelatedWorkYears;
  bcHas1YrCanadianRelatedWork: boolean | null;
  bcCurrentlyWorkingFullTimeInBcRole: boolean | null;
  bcEducationLocation: BcEducationLocation;
  bcHasEligibleProfessionalDesignation: boolean | null;
  bcEmploymentArea: BcEmploymentArea;
  bcHasRegionalExperienceOrAlumni: boolean | null;

  // 3. Alberta AAIP Specifics
  aaipEducationLocation: AaipEducationLocation;
  aaipTotalWorkDuration: AaipTotalWorkMonths;
  aaipCanadianWorkLocation: AaipCanadianWorkLocation;
  aaipHasFamilyInAlberta: boolean | null;
  aaipHasValidJobOffer: boolean | null;
  aaipIsPriorityRuralTourismOrPolice: boolean | null;
  aaipJobLocation: AaipJobLocation;
  aaipIsRegulatedAndLicensedInAlberta: boolean | null;

  // 4. Saskatchewan SINP Specifics
  sinpRecentWorkYears: SinpRecentWorkYears | null;
  sinpOlderWorkYears: SinpOlderWorkYears | null;
  sinpHasJobApprovalLetter: boolean | null;
  sinpHasCloseRelativeInSk: boolean | null;
  sinpHasPastSkWork12Months: boolean | null;
  sinpHasPastSkStudy1Year: boolean | null;
  sinpSectorType: SinpSectorType;

  // 5. Manitoba MPNP Specifics
  mpnpWorkYearsPast5: MpnpWorkYears | null;
  mpnpRecognizedByProvincialLicense: boolean | null;
  mpnpPrimaryAdaptability: MpnpAdaptabilityPrimary;
  mpnpRegionalOutsideWinnipeg: boolean | null;
  mpnpRiskWorkedOtherProvince: boolean | null;
  mpnpRiskStudiedOtherProvince: boolean | null;

  // 6. Prince Edward Island PEI PNP Specifics
  peiPathwayMode: PeiPathwayMode;
  peiWorkYears: PeiWorkYears;
  peiWorkingInPeiOnPermit: boolean | null;
  peiJobRelatedToStudy: boolean | null;
  peiHas1YrContinuousPeiWork: boolean | null;
  peiHasCloseFamilyInPei: boolean | null;
  peiGraduatedFromPeiInstitution: boolean | null;
  peiSpouseLanguageOrWorkQualified: boolean | null;
  peiPropertyOrChildInPeiSchool: boolean | null;
}

export interface PnpLedgerItem {
  id: string;
  label: string;
  points: number;
  maxPoints: number;
  isDeduction?: boolean;
  detailNote?: string;
}

export interface PnpSectionBreakdown {
  id: string;
  title: string;
  points: number;
  maxPoints: number;
  isDeductionSection?: boolean;
  items: PnpLedgerItem[];
}

export interface PnpDrawBenchmark {
  id: string;
  streamName: string;
  recentCutoff: number;
  cutoffRangeLabel: string;
  meetsCutoff: boolean;
  pointsDelta: number;
  expressEntryAligned: boolean;
  note: string;
}

export interface PnpOptimizationTip {
  id: string;
  title: string;
  actionSummary: string;
  pointsGain: number;
  projectedTotal: number;
  previewInput: PnpCalculatorInput;
}

export interface PnpProvinceResult {
  provinceId: PnpProvinceId;
  provinceCode: "ON" | "BC" | "AB" | "SK" | "MB" | "PE";
  provinceName: string;
  programShortName: string;
  officialStreamTitle: string;
  officialPortalUrl: string;
  lastUpdatedLabel: string;
  totalScore: number;
  maxScore: number;
  minimumPassMark: number | null;
  meetsPassMark: boolean;
  hasAnyInput: boolean;
  expressEntryBonusPoints: 600;
  sections: PnpSectionBreakdown[];
  advisories: string[];
  benchmarks: PnpDrawBenchmark[];
}

export const PNP_PROVINCE_META: Array<{
  id: PnpProvinceId;
  code: "ON" | "BC" | "AB" | "SK" | "MB" | "PE";
  provinceName: string;
  shortName: string;
  maxScore: number;
  passMarkLabel: string;
}> = [
  {
    id: "ontario_oinp",
    code: "ON",
    provinceName: "Ontario",
    shortName: "OINP",
    maxScore: 132,
    passMarkLabel: "EOI Ranked (Max 132)",
  },
  {
    id: "bc_pnp",
    code: "BC",
    provinceName: "British Columbia",
    shortName: "BC PNP",
    maxScore: 200,
    passMarkLabel: "SIRS Ranked (Max 200)",
  },
  {
    id: "alberta_aaip",
    code: "AB",
    provinceName: "Alberta",
    shortName: "AAIP",
    maxScore: 100,
    passMarkLabel: "Worker EOI (Max 100)",
  },
  {
    id: "saskatchewan_sinp",
    code: "SK",
    provinceName: "Saskatchewan",
    shortName: "SINP",
    maxScore: 110,
    passMarkLabel: "Min 60 / 110 Pass Mark",
  },
  {
    id: "manitoba_mpnp",
    code: "MB",
    provinceName: "Manitoba",
    shortName: "MPNP",
    maxScore: 1000,
    passMarkLabel: "EOI Ranked (Max 1,000)",
  },
  {
    id: "pei_pnp",
    code: "PE",
    provinceName: "Prince Edward Island",
    shortName: "PEI PNP",
    maxScore: 100,
    passMarkLabel: "EOI Ranked (Max 100)",
  },
];

export const DEFAULT_PNP_INPUT: PnpCalculatorInput = {
  activeProvince: "ontario_oinp",

  age: null,
  educationLevel: "",
  hasValidLanguageTest: null,
  firstLanguageTest: "none",
  firstLanguage: { speaking: 0, listening: 0, reading: 0, writing: 0 },
  secondLanguageTest: "none",
  secondLanguage: { speaking: 0, listening: 0, reading: 0, writing: 0 },

  hourlyWage: null,

  oinpIsSelfEmployedPhysician: false,
  oinpWorkExperience: "",
  oinpNocTeer: "",
  oinpNocBroadCategory: "",
  oinpLegalStatus: "",
  oinpCraEarnings: "",
  oinpWorkRegion: "",
  oinpCanadianCredentials: "",

  bcRelatedWorkYears: "",
  bcHas1YrCanadianRelatedWork: null,
  bcCurrentlyWorkingFullTimeInBcRole: null,
  bcEducationLocation: "",
  bcHasEligibleProfessionalDesignation: null,
  bcEmploymentArea: "",
  bcHasRegionalExperienceOrAlumni: null,

  aaipEducationLocation: "",
  aaipTotalWorkDuration: "",
  aaipCanadianWorkLocation: "",
  aaipHasFamilyInAlberta: null,
  aaipHasValidJobOffer: null,
  aaipIsPriorityRuralTourismOrPolice: null,
  aaipJobLocation: "",
  aaipIsRegulatedAndLicensedInAlberta: null,

  sinpRecentWorkYears: null,
  sinpOlderWorkYears: null,
  sinpHasJobApprovalLetter: null,
  sinpHasCloseRelativeInSk: null,
  sinpHasPastSkWork12Months: null,
  sinpHasPastSkStudy1Year: null,
  sinpSectorType: "",

  mpnpWorkYearsPast5: null,
  mpnpRecognizedByProvincialLicense: null,
  mpnpPrimaryAdaptability: "",
  mpnpRegionalOutsideWinnipeg: null,
  mpnpRiskWorkedOtherProvince: null,
  mpnpRiskStudiedOtherProvince: null,

  peiPathwayMode: "with_job_offer",
  peiWorkYears: "",
  peiWorkingInPeiOnPermit: null,
  peiJobRelatedToStudy: null,
  peiHas1YrContinuousPeiWork: null,
  peiHasCloseFamilyInPei: null,
  peiGraduatedFromPeiInstitution: null,
  peiSpouseLanguageOrWorkQualified: null,
  peiPropertyOrChildInPeiSchool: null,
};

export function convertAnnualSalaryToHourlyWage(
  annualSalary: number,
  hoursPerWeek: number = 37.5
): number {
  if (!Number.isFinite(annualSalary) || annualSalary <= 0) return 0;
  const safeHours = hoursPerWeek > 0 ? hoursPerWeek : 37.5;
  return Math.round((annualSalary / (safeHours * 52)) * 100) / 100;
}

interface LanguageSummary {
  hasValidFirst: boolean;
  hasValidSecond: boolean;
  minFirstClb: number;
  minSecondClb: number;
  minEnglishClb: number;
  minFrenchNclc: number;
  firstIsFrench: boolean;
}

function summarizeLanguages(input: PnpCalculatorInput): LanguageSummary {
  const hasValidFirst =
    input.hasValidLanguageTest === true && input.firstLanguageTest !== "none";

  const minFirstClb = hasValidFirst
    ? Math.min(
        input.firstLanguage.speaking,
        input.firstLanguage.listening,
        input.firstLanguage.reading,
        input.firstLanguage.writing
      )
    : 0;

  const hasValidSecond =
    hasValidFirst &&
    input.secondLanguageTest !== "none" &&
    isFrenchTest(input.secondLanguageTest) !== isFrenchTest(input.firstLanguageTest);

  const minSecondClb = hasValidSecond
    ? Math.min(
        input.secondLanguage.speaking,
        input.secondLanguage.listening,
        input.secondLanguage.reading,
        input.secondLanguage.writing
      )
    : 0;

  let minEnglishClb = 0;
  let minFrenchNclc = 0;

  if (hasValidFirst) {
    if (isEnglishTest(input.firstLanguageTest)) {
      minEnglishClb = minFirstClb;
      if (hasValidSecond && isFrenchTest(input.secondLanguageTest)) {
        minFrenchNclc = minSecondClb;
      }
    } else if (isFrenchTest(input.firstLanguageTest)) {
      minFrenchNclc = minFirstClb;
      if (hasValidSecond && isEnglishTest(input.secondLanguageTest)) {
        minEnglishClb = minSecondClb;
      }
    }
  }

  return {
    hasValidFirst,
    hasValidSecond,
    minFirstClb,
    minSecondClb,
    minEnglishClb,
    minFrenchNclc,
    firstIsFrench: hasValidFirst && isFrenchTest(input.firstLanguageTest),
  };
}

function checkSharedHasInput(input: PnpCalculatorInput): boolean {
  return (
    input.age !== null ||
    input.educationLevel !== "" ||
    input.hasValidLanguageTest !== null ||
    input.firstLanguageTest !== "none" ||
    input.hourlyWage !== null
  );
}

// ============================================================================
// 1. ONTARIO — OINP (Ontario Workforce Priority Stream EOI • Max 132 / 117)
// ============================================================================

function calculateOntarioOinp(input: PnpCalculatorInput, lang: LanguageSummary): PnpProvinceResult {
  const hasProvinceInput =
    checkSharedHasInput(input) ||
    input.oinpIsSelfEmployedPhysician ||
    input.oinpWorkExperience !== "" ||
    input.oinpNocTeer !== "" ||
    input.oinpNocBroadCategory !== "" ||
    input.oinpLegalStatus !== "" ||
    input.oinpCraEarnings !== "" ||
    input.oinpWorkRegion !== "" ||
    input.oinpCanadianCredentials !== "";

  // 1. Ontario Work Experience (Max 18)
  const workMap: Record<OinpWorkExperienceTier, number> = {
    "": 0,
    none_or_under_6m: 0,
    general_on_6_to_11m: 6,
    general_on_12m_plus: 12,
    job_offer_role_6_to_12m: 12,
    job_offer_role_13_to_24m: 15,
    job_offer_role_24m_plus: 18,
  };
  const onWorkPts = workMap[input.oinpWorkExperience];

  // 2. Job Offer Hourly Wage (Max 15; exempt for self-employed physicians)
  let wagePts = 0;
  if (!input.oinpIsSelfEmployedPhysician && input.hourlyWage !== null) {
    if (input.hourlyWage >= 40) wagePts = 15;
    else if (input.hourlyWage >= 35) wagePts = 12;
    else if (input.hourlyWage >= 30) wagePts = 10;
    else if (input.hourlyWage >= 25) wagePts = 8;
    else if (input.hourlyWage >= 20) wagePts = 5;
  }

  // 3. NOC Broad Occupational Category (Max 10)
  const broadCatMap: Record<NocBroadCategory, number> = {
    "": 0,
    cat_3_health: 10,
    cat_7_trades_transport: 8,
    cat_2_stem_natural_applied: 6,
    cat_0_1_4_8_9_mgmt_biz_edu_mfg: 4,
    cat_5_6_arts_sales_service: 2,
  };
  const broadCatPts = broadCatMap[input.oinpNocBroadCategory];

  // 4. NOC TEER Category (Max 9)
  const teerMap: Record<NocTeerCategory, number> = {
    "": 0,
    teer_0_1: 9,
    teer_2_3: 6,
    teer_4_5: 0,
  };
  const teerPts = teerMap[input.oinpNocTeer];

  // 5. Legal Status in Canada (Max 10)
  const statusMap: Record<OinpLegalStatus, number> = {
    "": 0,
    work_permit: 10,
    study_permit: 5,
    other_or_outside: 0,
  };
  const statusPts = statusMap[input.oinpLegalStatus];

  // 6. Canadian Earnings History — Oct 5, 2026 Rule ($80,000+ = 10 pts)
  const earningsMap: Record<OinpCraEarningsBracket, number> = {
    "": 0,
    under_30k: 0,
    "30k_to_49k": 4,
    "50k_to_69k": 6,
    "70k_to_79k": 8,
    "80k_plus": 10,
  };
  const earningsPts = earningsMap[input.oinpCraEarnings];

  const employmentMax = input.oinpIsSelfEmployedPhysician ? 57 : 72;
  const employmentTotal = onWorkPts + wagePts + broadCatPts + teerPts + statusPts + earningsPts;

  // 7. Regionalization — Work Location (Max 15)
  const regionMap: Record<OinpWorkRegion, number> = {
    "": 0,
    northern_ontario: 15,
    outside_gta_other: 10,
    gta_excluding_toronto: 5,
    city_of_toronto: 0,
  };
  const regionPts = regionMap[input.oinpWorkRegion];

  // 8. Highest Level of Education (Max 10)
  const eduMap: Record<SharedPnpEducationLevel, number> = {
    "": 0,
    secondary_or_less: 0,
    trade_certificate: 5,
    one_year_post_secondary: 5,
    two_year_post_secondary: 5,
    bachelors_three_year: 6,
    two_or_more_degrees: 6,
    post_grad_diploma: 6,
    masters: 8,
    doctoral_or_md: 10,
  };
  const eduPts = eduMap[input.educationLevel];

  // 9. Canadian Education Credentials (Max 10)
  const canCredMap: Record<OinpCanadianCredentials, number> = {
    "": 0,
    none: 0,
    one_credential: 5,
    two_or_more: 10,
  };
  const canCredPts =
    input.educationLevel === "secondary_or_less" ? 0 : canCredMap[input.oinpCanadianCredentials];

  // 10. Official Language Ability (Max 15 — evaluates strongest single official language lowest band)
  const bestSingleClb = Math.max(lang.minFirstClb, lang.minSecondClb);
  let firstLangPts = 0;
  if (bestSingleClb >= 9) firstLangPts = 15;
  else if (bestSingleClb === 8) firstLangPts = 12;
  else if (bestSingleClb === 7) firstLangPts = 8;
  else if (bestSingleClb === 6) firstLangPts = 4;

  // 11. Knowledge of Official Languages (Max 10: 2 Official Languages @ CLB 6+ = 10 pts; 1 Official Language = 5 pts)
  let bilingualPts = 0;
  if (lang.minEnglishClb >= 6 && lang.minFrenchNclc >= 6) {
    bilingualPts = 10;
  } else if (bestSingleClb > 0) {
    bilingualPts = 5;
  }

  const maxScore = input.oinpIsSelfEmployedPhysician ? 117 : 132;
  const totalScore = Math.min(
    employmentTotal + regionPts + eduPts + canCredPts + firstLangPts + bilingualPts,
    maxScore
  );

  const advisories: string[] = [
    "Ontario permanently closed the legacy Masters Graduate (May 30, 2026) and PhD Graduate (June 26, 2026) streams; EOI rankings now run under the consolidated Ontario Workforce Priority (OWP) framework.",
    "Age is NOT scored in Ontario's EOI grid — candidates aged 35+ suffer zero age-decay penalty here.",
  ];
  if (input.educationLevel === "secondary_or_less" && input.oinpCanadianCredentials !== "" && input.oinpCanadianCredentials !== "none") {
    advisories.push(
      "Canadian Education Credential points (+5/+10) require a completed post-secondary DLI program of at least 1 academic year."
    );
  }

  const sections: PnpSectionBreakdown[] = [
    {
      id: "oinp_employment",
      title: "A. Employment, Occupation & CRA Earnings",
      points: employmentTotal,
      maxPoints: employmentMax,
      items: [
        { id: "on_work", label: "Ontario Work Experience", points: onWorkPts, maxPoints: 18 },
        ...(input.oinpIsSelfEmployedPhysician
          ? []
          : [{ id: "on_wage", label: "Job Offer Base Hourly Wage", points: wagePts, maxPoints: 15 }]),
        {
          id: "on_broad_noc",
          label: "NOC Broad Occupational Category",
          points: broadCatPts,
          maxPoints: 10,
        },
        { id: "on_teer", label: "NOC TEER Skill Level", points: teerPts, maxPoints: 9 },
        { id: "on_status", label: "Legal Status in Canada", points: statusPts, maxPoints: 10 },
        {
          id: "on_earnings",
          label: "CRA Earnings History (Oct 5, 2026 Tier)",
          points: earningsPts,
          maxPoints: 10,
        },
      ],
    },
    {
      id: "oinp_region",
      title: "B. Regional Immigration (Job Location)",
      points: regionPts,
      maxPoints: 15,
      items: [
        {
          id: "on_location",
          label: "Location of Ontario Job Offer",
          points: regionPts,
          maxPoints: 15,
        },
      ],
    },
    {
      id: "oinp_education",
      title: "C. Education & Canadian Credentials",
      points: eduPts + canCredPts,
      maxPoints: 20,
      items: [
        { id: "on_edu", label: "Highest Level of Education", points: eduPts, maxPoints: 10 },
        {
          id: "on_can_cred",
          label: "Canadian Post-Secondary Credentials",
          points: canCredPts,
          maxPoints: 10,
        },
      ],
    },
    {
      id: "oinp_language",
      title: "D. Official Languages & Bilingualism",
      points: firstLangPts + bilingualPts,
      maxPoints: 25,
      items: [
        {
          id: "on_first_lang",
          label: "Official Language Ability (Strongest Official Language)",
          points: firstLangPts,
          maxPoints: 15,
        },
        {
          id: "on_bilingual",
          label: "Knowledge of Official Languages (1 Lang = 5 • Bilingual = 10)",
          points: bilingualPts,
          maxPoints: 10,
        },
      ],
    },
  ];

  const benchmarks: PnpDrawBenchmark[] = [
    {
      id: "oinp_healthcare",
      streamName: "OINP Targeted — Healthcare & Physicians",
      recentCutoff: 64,
      cutoffRangeLabel: "58 – 72",
      meetsCutoff: totalScore >= 64,
      pointsDelta: totalScore - 64,
      expressEntryAligned: false,
      note: "Targeted draws for NOC Broad Category 3 health occupations & licensed physicians",
    },
    {
      id: "oinp_regional_redi",
      streamName: "OINP Regional / Northern & Outside GTA",
      recentCutoff: 71,
      cutoffRangeLabel: "66 – 78",
      meetsCutoff: totalScore >= 71,
      pointsDelta: totalScore - 71,
      expressEntryAligned: false,
      note: "Targets employers in Northern, Eastern, Central & Southwestern Ontario",
    },
    {
      id: "oinp_skilled_trades_stem",
      streamName: "OINP Priority — Skilled Trades & STEM",
      recentCutoff: 78,
      cutoffRangeLabel: "74 – 85",
      meetsCutoff: totalScore >= 78,
      pointsDelta: totalScore - 78,
      expressEntryAligned: false,
      note: "Targets NOC Broad Category 7 (Trades) & Category 2 (STEM/Engineering)",
    },
    {
      id: "oinp_general",
      streamName: "OINP General Workforce Priority Round",
      recentCutoff: 86,
      cutoffRangeLabel: "82 – 94",
      meetsCutoff: totalScore >= 86,
      pointsDelta: totalScore - 86,
      expressEntryAligned: false,
      note: "All-occupation employer job offer rounds across Ontario",
    },
  ];

  return {
    provinceId: "ontario_oinp",
    provinceCode: "ON",
    provinceName: "Ontario",
    programShortName: "OINP",
    officialStreamTitle: "Ontario Workforce Priority Stream — EOI Scoring System",
    officialPortalUrl: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    lastUpdatedLabel: "Oct 5, 2026 OINP Standard ($80k+ CRA Tier • Max 132)",
    totalScore,
    maxScore,
    minimumPassMark: null,
    meetsPassMark: hasProvinceInput && totalScore > 0,
    hasAnyInput: hasProvinceInput,
    expressEntryBonusPoints: 600,
    sections,
    advisories,
    benchmarks,
  };
}

// ============================================================================
// 2. BRITISH COLUMBIA — BC PNP (SIRS 200-Point Grid)
// ============================================================================

function calculateBcPnp(input: PnpCalculatorInput, lang: LanguageSummary): PnpProvinceResult {
  const hasProvinceInput =
    checkSharedHasInput(input) ||
    input.bcRelatedWorkYears !== "" ||
    input.bcHas1YrCanadianRelatedWork !== null ||
    input.bcCurrentlyWorkingFullTimeInBcRole !== null ||
    input.bcEducationLocation !== "" ||
    input.bcHasEligibleProfessionalDesignation !== null ||
    input.bcEmploymentArea !== "" ||
    input.bcHasRegionalExperienceOrAlumni !== null;

  // 1. Directly Related Work Experience (Max 40)
  const workBaseMap: Record<BcRelatedWorkYears, number> = {
    "": 0,
    none: 0,
    under_1yr: 1,
    "1_to_2yr": 4,
    "2_to_3yr": 8,
    "3_to_4yr": 12,
    "4_to_5yr": 16,
    "5yr_plus": 20,
  };
  const workBasePts = workBaseMap[input.bcRelatedWorkYears];
  const canWorkBonusPts = input.bcHas1YrCanadianRelatedWork === true ? 10 : 0;
  const currentBcJobBonusPts = input.bcCurrentlyWorkingFullTimeInBcRole === true ? 10 : 0;
  const workTotalPts = Math.min(workBasePts + canWorkBonusPts + currentBcJobBonusPts, 40);

  // 2. Highest Level of Education (Max 40)
  const bcEduBaseMap: Record<SharedPnpEducationLevel, number> = {
    "": 0,
    secondary_or_less: 0,
    trade_certificate: 5,
    one_year_post_secondary: 5,
    two_year_post_secondary: 5,
    bachelors_three_year: 15,
    two_or_more_degrees: 15,
    post_grad_diploma: 15,
    masters: 22,
    doctoral_or_md: 27,
  };
  const eduBasePts = bcEduBaseMap[input.educationLevel];
  const hasPostSec =
    input.educationLevel !== "" && input.educationLevel !== "secondary_or_less";
  const eduLocPts = !hasPostSec
    ? 0
    : input.bcEducationLocation === "inside_bc"
      ? 8
      : input.bcEducationLocation === "canada_outside_bc"
        ? 6
        : 0;
  const profDesigPts = input.bcHasEligibleProfessionalDesignation === true ? 5 : 0;
  const eduTotalPts = Math.min(eduBasePts + eduLocPts + profDesigPts, 40);

  // 3. Language Proficiency (Max 40)
  let langBasePts = 0;
  if (lang.minFirstClb >= 9) langBasePts = 30;
  else if (lang.minFirstClb === 8) langBasePts = 25;
  else if (lang.minFirstClb === 7) langBasePts = 20;
  else if (lang.minFirstClb === 6) langBasePts = 15;
  else if (lang.minFirstClb === 5) langBasePts = 10;
  else if (lang.minFirstClb === 4) langBasePts = 5;

  const dualLangBonusPts =
    lang.minEnglishClb >= 4 && lang.minFrenchNclc >= 4 ? 10 : 0;
  const langTotalPts = Math.min(langBasePts + dualLangBonusPts, 40);

  const humanCapitalTotal = workTotalPts + eduTotalPts + langTotalPts; // Max 120

  // 4. Economic Factor — Base Hourly Wage (Max 55: $16 = 1 pt ... $70+ = 55 pts)
  let wagePts = 0;
  if (input.hourlyWage !== null && input.hourlyWage >= 16) {
    if (input.hourlyWage >= 70) wagePts = 55;
    else wagePts = Math.max(0, Math.min(55, Math.floor(input.hourlyWage) - 15));
  }

  // 5. Economic Factor — Area of Employment Within B.C. (Max 25)
  const areaBasePts =
    input.bcEmploymentArea === "area_3_rest_of_bc"
      ? 15
      : input.bcEmploymentArea === "area_2_squamish_abbotsford_chilliwack"
        ? 5
        : 0;
  const eligibleForRegionalBonus =
    input.bcEmploymentArea === "area_2_squamish_abbotsford_chilliwack" ||
    input.bcEmploymentArea === "area_3_rest_of_bc";
  const regionalBonusPts =
    eligibleForRegionalBonus && input.bcHasRegionalExperienceOrAlumni === true ? 10 : 0;
  const areaTotalPts = Math.min(areaBasePts + regionalBonusPts, 25);

  const economicTotal = wagePts + areaTotalPts; // Max 80
  const totalScore = Math.min(humanCapitalTotal + economicTotal, 200);

  const advisories: string[] = [
    "BC PNP evaluates base hourly wage strictly ($16/hr = 1 pt up to $70+/hr = 55 pts), excluding overtime, tips, bonuses, and commissions.",
    "Choosing the Express Entry BC (EEBC) option adds +600 points to your federal CRS score once nominated.",
  ];
  if (input.bcEmploymentArea === "area_1_metro_vancouver" && input.bcHasRegionalExperienceOrAlumni === true) {
    advisories.push(
      "The +10 Regional Experience/Alumni bonus only applies when your B.C. job offer is located in Area 2 or Area 3 (outside Metro Vancouver)."
    );
  }
  if (
    input.bcHas1YrCanadianRelatedWork === true &&
    (input.bcRelatedWorkYears === "none" || input.bcRelatedWorkYears === "under_1yr")
  ) {
    advisories.push(
      "Consistency Check: Claiming the +10 Canadian Directly Related Work bonus requires at least 1 full year (12+ months) of total directly related work experience."
    );
  }

  const sections: PnpSectionBreakdown[] = [
    {
      id: "bc_human_capital",
      title: "A. Human Capital Factors (Max 120)",
      points: humanCapitalTotal,
      maxPoints: 120,
      items: [
        {
          id: "bc_work",
          label: "Directly Related Work Experience (+CAN / Current BC Bonuses)",
          points: workTotalPts,
          maxPoints: 40,
        },
        {
          id: "bc_edu",
          label: "Highest Level of Education (+BC/CAN & Designation Bonuses)",
          points: eduTotalPts,
          maxPoints: 40,
        },
        {
          id: "bc_lang",
          label: "Language Proficiency (+10 English & French CLB 4+ Bonus)",
          points: langTotalPts,
          maxPoints: 40,
        },
      ],
    },
    {
      id: "bc_economic",
      title: "B. Economic Factors (Max 80)",
      points: economicTotal,
      maxPoints: 80,
      items: [
        {
          id: "bc_wage",
          label: "Hourly Wage of the B.C. Job Offer ($16 – $70+/hr)",
          points: wagePts,
          maxPoints: 55,
        },
        {
          id: "bc_area",
          label: "Area of Employment in B.C. (+10 Regional Experience/Alumni)",
          points: areaTotalPts,
          maxPoints: 25,
        },
      ],
    },
  ];

  const benchmarks: PnpDrawBenchmark[] = [
    {
      id: "bc_care",
      streamName: "BC PNP Care — Healthcare & Early Childhood Educators",
      recentCutoff: 95,
      cutoffRangeLabel: "90 – 113",
      meetsCutoff: totalScore >= 95,
      pointsDelta: totalScore - 95,
      expressEntryAligned: true,
      note: "Targeted Care stream draws for priority health & ECE occupations (EEBC eligible)",
    },
    {
      id: "bc_build",
      streamName: "BC PNP Build — Priority Construction Trades",
      recentCutoff: 108,
      cutoffRangeLabel: "100 – 118",
      meetsCutoff: totalScore >= 108,
      pointsDelta: totalScore - 108,
      expressEntryAligned: true,
      note: "Targeted Build draws for qualified construction trades with SkilledTradesBC credentials",
    },
    {
      id: "bc_innovate",
      streamName: "BC PNP Innovate & General Skills Immigration",
      recentCutoff: 134,
      cutoffRangeLabel: "128 – 140",
      meetsCutoff: totalScore >= 134,
      pointsDelta: totalScore - 134,
      expressEntryAligned: true,
      note: "High-impact general/tech draws (B.C. also conducts high-wage $49–$62+/hr threshold rounds)",
    },
  ];

  return {
    provinceId: "bc_pnp",
    provinceCode: "BC",
    provinceName: "British Columbia",
    programShortName: "BC PNP",
    officialStreamTitle: "Skills Immigration Registration System (SIRS — Care, Build & Innovate)",
    officialPortalUrl: "https://www.welcomebc.ca/immigrate-to-b-c/skills-immigration",
    lastUpdatedLabel: "2026 BC PNP SIRS Standard (120 Human Capital + 80 Economic • Max 200)",
    totalScore,
    maxScore: 200,
    minimumPassMark: null,
    meetsPassMark: hasProvinceInput && totalScore > 0,
    hasAnyInput: hasProvinceInput,
    expressEntryBonusPoints: 600,
    sections,
    advisories,
    benchmarks,
  };
}

// ============================================================================
// 3. ALBERTA — AAIP (Worker Expression of Interest 100-Point Grid)
// ============================================================================

function calculateAlbertaAaip(input: PnpCalculatorInput, lang: LanguageSummary): PnpProvinceResult {
  const hasProvinceInput =
    checkSharedHasInput(input) ||
    input.aaipEducationLocation !== "" ||
    input.aaipTotalWorkDuration !== "" ||
    input.aaipCanadianWorkLocation !== "" ||
    input.aaipHasFamilyInAlberta !== null ||
    input.aaipHasValidJobOffer !== null ||
    input.aaipIsPriorityRuralTourismOrPolice !== null ||
    input.aaipJobLocation !== "" ||
    input.aaipIsRegulatedAndLicensedInAlberta !== null;

  // 1. Education (Max 12 + 10 = 22)
  const eduMap: Record<SharedPnpEducationLevel, number> = {
    "": 0,
    secondary_or_less: 0,
    trade_certificate: 7,
    one_year_post_secondary: 4,
    two_year_post_secondary: 4,
    bachelors_three_year: 7,
    two_or_more_degrees: 7,
    post_grad_diploma: 7,
    masters: 10,
    doctoral_or_md: 12,
  };
  const eduBasePts = eduMap[input.educationLevel];
  const hasPostSec =
    input.educationLevel !== "" && input.educationLevel !== "secondary_or_less";
  const eduLocPts = !hasPostSec
    ? 0
    : input.aaipEducationLocation === "alberta"
      ? 10
      : input.aaipEducationLocation === "other_province"
        ? 6
        : 0;

  // 2. Language Proficiency (Max 10 + 3 = 13)
  // Official AAIP Worker EOI Grid: Candidates with both English and French test results
  // receive base language points for whichever official language awards MORE points.
  const engAaipPts =
    lang.minEnglishClb >= 6
      ? 10
      : lang.minEnglishClb === 5
        ? 8
        : lang.minEnglishClb === 4
          ? 5
          : 0;
  const frAaipPts =
    lang.minFrenchNclc >= 6
      ? 8
      : lang.minFrenchNclc === 5
        ? 5
        : lang.minFrenchNclc === 4
          ? 3
          : 0;
  const firstLangPts = Math.max(engAaipPts, frAaipPts);
  const bilingualPts = lang.minEnglishClb >= 4 && lang.minFrenchNclc >= 4 ? 3 : 0;

  // 3. Work Experience (Max 11 + 10 = 21)
  const totalWorkMap: Record<AaipTotalWorkMonths, number> = {
    "": 0,
    none: 0,
    under_6m: 3,
    "6_to_11m": 7,
    "12m_plus": 11,
  };
  const totalWorkPts = totalWorkMap[input.aaipTotalWorkDuration];
  const canWorkLocPts =
    input.aaipCanadianWorkLocation === "alberta_6m"
      ? 10
      : input.aaipCanadianWorkLocation === "other_province_6m"
        ? 6
        : 0;

  // 4. Age (Max 5)
  let agePts = 0;
  if (input.age !== null) {
    if (input.age >= 21 && input.age <= 34) agePts = 5;
    else if (input.age >= 35 && input.age <= 49) agePts = 4;
    else if (input.age >= 18) agePts = 3;
  }

  // 5. Family Connection in Alberta (Max 8)
  const familyPts = input.aaipHasFamilyInAlberta === true ? 8 : 0;

  const humanCapitalTotal =
    eduBasePts + eduLocPts + firstLangPts + bilingualPts + totalWorkPts + canWorkLocPts + agePts + familyPts; // Max 69

  // Economic Factors (Max 31)
  const hasOffer = input.aaipHasValidJobOffer === true;
  const jobOfferBasePts = hasOffer ? 10 : 0;
  const priorityStreamBonusPts =
    hasOffer && input.aaipIsPriorityRuralTourismOrPolice === true ? 6 : 0;
  const jobLocationPts =
    hasOffer && input.aaipJobLocation === "rural_or_outside_cma" ? 5 : 0;
  const regulatedPts =
    hasOffer && input.aaipIsRegulatedAndLicensedInAlberta === true ? 10 : 0;

  const economicTotal =
    jobOfferBasePts + priorityStreamBonusPts + jobLocationPts + regulatedPts; // Max 31

  const totalScore = Math.min(humanCapitalTotal + economicTotal, 100);

  const advisories: string[] = [
    "AAIP allows only ONE active Worker EOI profile at a time ($135 submission fee upon invitation/application; EOIs remain valid for 12 months).",
    "Under AAIP's official grid, English CLB 6+ yields 10 pts while French NCLC 6+ yields 8 pts — candidates with both tests automatically receive base points for whichever language awards more (+3 pts if CLB/NCLC 4+ in both).",
  ];
  if (
    (input.aaipCanadianWorkLocation === "alberta_6m" ||
      input.aaipCanadianWorkLocation === "other_province_6m") &&
    (input.aaipTotalWorkDuration === "none" || input.aaipTotalWorkDuration === "under_6m")
  ) {
    advisories.push(
      "Consistency Check: Claiming 6+ months of Canadian/Alberta work location points requires selecting at least 6–11 months (or 12+ months) in Total Work Duration."
    );
  }

  const sections: PnpSectionBreakdown[] = [
    {
      id: "aaip_human_capital",
      title: "A. Human Capital Factors (Max 69)",
      points: humanCapitalTotal,
      maxPoints: 69,
      items: [
        {
          id: "aaip_edu",
          label: "Education Level (Max 12) + Canadian/Alberta Study Location (Max 10)",
          points: eduBasePts + eduLocPts,
          maxPoints: 22,
        },
        {
          id: "aaip_lang",
          label: "Language Proficiency (Max 10) + Bilingual Bonus (Max 3)",
          points: firstLangPts + bilingualPts,
          maxPoints: 13,
        },
        {
          id: "aaip_work",
          label: "Total Work Duration (Max 11) + Alberta/Canadian Work (Max 10)",
          points: totalWorkPts + canWorkLocPts,
          maxPoints: 21,
        },
        { id: "aaip_age", label: "Age at EOI Submission", points: agePts, maxPoints: 5 },
        {
          id: "aaip_family",
          label: "Parent, Child or Sibling in Alberta (Citizen/PR 18+)",
          points: familyPts,
          maxPoints: 8,
        },
      ],
    },
    {
      id: "aaip_economic",
      title: "B. Economic & Alberta Job Offer Factors (Max 31)",
      points: economicTotal,
      maxPoints: 31,
      items: [
        {
          id: "aaip_offer",
          label: "Permanent Full-Time Alberta Job Offer (+6 Priority Sector/RRS)",
          points: jobOfferBasePts + priorityStreamBonusPts,
          maxPoints: 16,
        },
        {
          id: "aaip_loc",
          label: "Job Location Outside Calgary & Edmonton CMAs",
          points: jobLocationPts,
          maxPoints: 5,
        },
        {
          id: "aaip_reg",
          label: "Regulated Occupation / Designated Trade Licensed in Alberta",
          points: regulatedPts,
          maxPoints: 10,
        },
      ],
    },
  ];

  const benchmarks: PnpDrawBenchmark[] = [
    {
      id: "aaip_healthcare",
      streamName: "AAIP Dedicated Healthcare Pathway (Express Entry & Non-EE)",
      recentCutoff: 53,
      cutoffRangeLabel: "48 – 60",
      meetsCutoff: totalScore >= 53,
      pointsDelta: totalScore - 53,
      expressEntryAligned: true,
      note: "Licensed physicians, RNs, LPNs, NPs, allied health professionals with Alberta job offer",
    },
    {
      id: "aaip_construction_trades",
      streamName: "AAIP Priority Sectors — Construction, Agriculture & Aviation",
      recentCutoff: 62,
      cutoffRangeLabel: "57 – 68",
      meetsCutoff: totalScore >= 62,
      pointsDelta: totalScore - 62,
      expressEntryAligned: true,
      note: "Targeted priority sector draws across Alberta Express Entry & Opportunity streams",
    },
    {
      id: "aaip_opportunity_general",
      streamName: "Alberta Opportunity Stream & Tech Pathway",
      recentCutoff: 68,
      cutoffRangeLabel: "64 – 74",
      meetsCutoff: totalScore >= 68,
      pointsDelta: totalScore - 68,
      expressEntryAligned: true,
      note: "General Alberta Opportunity Stream & Accelerated Tech draws",
    },
  ];

  return {
    provinceId: "alberta_aaip",
    provinceCode: "AB",
    provinceName: "Alberta",
    programShortName: "AAIP",
    officialStreamTitle: "Alberta Advantage Immigration Program — Worker EOI Grid",
    officialPortalUrl: "https://www.alberta.ca/aaip-worker-expression-of-interest",
    lastUpdatedLabel: "2026 AAIP Worker EOI Grid (69 Human Capital + 31 Economic • Max 100)",
    totalScore,
    maxScore: 100,
    minimumPassMark: null,
    meetsPassMark: hasProvinceInput && totalScore > 0,
    hasAnyInput: hasProvinceInput,
    expressEntryBonusPoints: 600,
    sections,
    advisories,
    benchmarks,
  };
}

// ============================================================================
// 4. SASKATCHEWAN — SINP (110-Point Assessment Grid • 60-Point Minimum)
// ============================================================================

function calculateSaskatchewanSinp(
  input: PnpCalculatorInput,
  lang: LanguageSummary
): PnpProvinceResult {
  const hasProvinceInput =
    checkSharedHasInput(input) ||
    input.sinpRecentWorkYears !== null ||
    input.sinpOlderWorkYears !== null ||
    input.sinpHasJobApprovalLetter !== null ||
    input.sinpHasCloseRelativeInSk !== null ||
    input.sinpHasPastSkWork12Months !== null ||
    input.sinpHasPastSkStudy1Year !== null ||
    input.sinpSectorType !== "";

  // Factor I-A: Education and Training (Max 23)
  const sinpEduMap: Record<SharedPnpEducationLevel, number> = {
    "": 0,
    secondary_or_less: 0,
    trade_certificate: 20, // Journeyperson equivalent
    one_year_post_secondary: 12,
    two_year_post_secondary: 15,
    bachelors_three_year: 20,
    two_or_more_degrees: 20,
    post_grad_diploma: 20,
    masters: 23,
    doctoral_or_md: 23,
  };
  const eduPts = sinpEduMap[input.educationLevel];

  // Factor I-B: Skilled Work Experience (Max 10 recent + 5 older = 15)
  const recentYrs = input.sinpRecentWorkYears ?? 0;
  const recentWorkMap: Record<SinpRecentWorkYears, number> = {
    0: 0,
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
  };
  const recentWorkPts = recentWorkMap[recentYrs];

  const olderYrs = input.sinpOlderWorkYears ?? 0;
  const olderWorkMap: Record<SinpOlderWorkYears, number> = {
    0: 0,
    1: 0,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
  };
  const olderWorkPts = olderWorkMap[olderYrs];

  // Factor I-C: Language Ability (Max 20 First + 10 Second = 30)
  let firstLangPts = 0;
  if (lang.minFirstClb >= 8) firstLangPts = 20;
  else if (lang.minFirstClb === 7) firstLangPts = 18;
  else if (lang.minFirstClb === 6) firstLangPts = 16;
  else if (lang.minFirstClb === 5) firstLangPts = 14;
  else if (lang.minFirstClb === 4) firstLangPts = 12;

  let secondLangPts = 0;
  if (lang.hasValidSecond) {
    if (lang.minSecondClb >= 8) secondLangPts = 10;
    else if (lang.minSecondClb === 7) secondLangPts = 8;
    else if (lang.minSecondClb === 6) secondLangPts = 6;
    else if (lang.minSecondClb === 5) secondLangPts = 4;
    else if (lang.minSecondClb === 4) secondLangPts = 2;
  }

  // Factor I-D: Age (Max 12)
  let agePts = 0;
  if (input.age !== null) {
    if (input.age >= 22 && input.age <= 34) agePts = 12;
    else if (input.age >= 35 && input.age <= 45) agePts = 10;
    else if ((input.age >= 18 && input.age <= 21) || (input.age >= 46 && input.age <= 50)) {
      agePts = 8;
    }
  }

  const factor1Total =
    eduPts + recentWorkPts + olderWorkPts + firstLangPts + secondLangPts + agePts; // Max 80

  // Factor II: Connection to Saskatchewan Labour Market & Adaptability (Max 30)
  const jobOfferPts = input.sinpHasJobApprovalLetter === true ? 30 : 0;
  const familyPts = input.sinpHasCloseRelativeInSk === true ? 20 : 0;
  const pastWorkPts = input.sinpHasPastSkWork12Months === true ? 5 : 0;
  const pastStudyPts = input.sinpHasPastSkStudy1Year === true ? 5 : 0;
  const factor2Total = Math.min(jobOfferPts + familyPts + pastWorkPts + pastStudyPts, 30);

  const totalScore = Math.min(factor1Total + factor2Total, 110);
  const meetsPassMark = totalScore >= 60;

  const advisories: string[] = [
    "SINP International Skilled Worker requires a strict minimum pass mark of 60 / 110 points AND minimum CLB 4 language proficiency to enter the EOI pool.",
    "2026 SINP Sector Allocation Rule: Healthcare, Agriculture, Skilled Trades, Tech, Mining, Energy & Manufacturing enjoy continuous priority intake (50%+ of spots), whereas Accommodation/Food (15%), Trucking (5%), and Retail (5%) are strictly capped to scheduled intake windows.",
  ];
  if (input.sinpSectorType === "capped_sector") {
    advisories.push(
      "Capped Sector Advisory: Employers in Accommodation/Food, Trucking, or Retail can only submit Job Approval applications during scheduled SINP intake windows."
    );
  }
  if (hasProvinceInput && totalScore >= 60 && lang.minFirstClb < 4) {
    advisories.push(
      "Language Gate Warning: Although your points reach 60+, SINP International Skilled Worker statutorily requires a valid language test at CLB 4 or higher across all 4 bands to enter the EOI pool."
    );
  }

  const sections: PnpSectionBreakdown[] = [
    {
      id: "sinp_factor_1",
      title: "Factor I: Labour Market Success (Max 80)",
      points: factor1Total,
      maxPoints: 80,
      items: [
        { id: "sinp_edu", label: "Education and Training", points: eduPts, maxPoints: 23 },
        {
          id: "sinp_work",
          label: "Skilled Work Experience (Past 5 yrs + 6–10 yrs prior)",
          points: recentWorkPts + olderWorkPts,
          maxPoints: 15,
        },
        {
          id: "sinp_lang",
          label: "Official Language Ability (First Max 20 + Second Max 10)",
          points: firstLangPts + secondLangPts,
          maxPoints: 30,
        },
        { id: "sinp_age", label: "Age on Application Date", points: agePts, maxPoints: 12 },
      ],
    },
    {
      id: "sinp_factor_2",
      title: "Factor II: Connection to Saskatchewan & Adaptability (Max 30)",
      points: factor2Total,
      maxPoints: 30,
      items: [
        {
          id: "sinp_job",
          label: "High-Skilled Saskatchewan Employment Offer (JAL)",
          points: jobOfferPts,
          maxPoints: 30,
        },
        {
          id: "sinp_rel",
          label: "Close Family Relative in Saskatchewan (Citizen/PR 12+ mos)",
          points: familyPts,
          maxPoints: 20,
        },
        {
          id: "sinp_past",
          label: "Past Saskatchewan Work (+5) & Study (+5) Experience",
          points: pastWorkPts + pastStudyPts,
          maxPoints: 10,
        },
      ],
    },
  ];

  const benchmarks: PnpDrawBenchmark[] = [
    {
      id: "sinp_employment_offer",
      streamName: "SINP Employment Offer Subcategory (Priority Sectors)",
      recentCutoff: 60,
      cutoffRangeLabel: "60 Pass Mark",
      meetsCutoff: meetsPassMark && input.sinpHasJobApprovalLetter === true,
      pointsDelta: totalScore - 60,
      expressEntryAligned: false,
      note: "Continuous intake for priority sectors with an approved SINP Job Approval Letter & >= 60 pts",
    },
    {
      id: "sinp_ee_oid_priority",
      streamName: "SINP Express Entry & Occupations In-Demand (Healthcare/Agri/Tech)",
      recentCutoff: 69,
      cutoffRangeLabel: "66 – 75",
      meetsCutoff: meetsPassMark && totalScore >= 69,
      pointsDelta: totalScore - 69,
      expressEntryAligned: true,
      note: "Targeted priority NOC draws; Express Entry stream adds +600 federal CRS points",
    },
    {
      id: "sinp_ee_oid_general",
      streamName: "SINP Express Entry & OID — Broad Skilled Occupations",
      recentCutoff: 82,
      cutoffRangeLabel: "78 – 89",
      meetsCutoff: meetsPassMark && totalScore >= 82,
      pointsDelta: totalScore - 82,
      expressEntryAligned: true,
      note: "Higher competitive cutoff for non-priority occupations without a Saskatchewan job offer",
    },
  ];

  return {
    provinceId: "saskatchewan_sinp",
    provinceCode: "SK",
    provinceName: "Saskatchewan",
    programShortName: "SINP",
    officialStreamTitle: "International Skilled Worker — Points Assessment Grid",
    officialPortalUrl:
      "https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program",
    lastUpdatedLabel: "2026 SINP Standard (Pass Mark 60 / 110 • Priority Sector Rules)",
    totalScore,
    maxScore: 110,
    minimumPassMark: 60,
    meetsPassMark,
    hasAnyInput: hasProvinceInput,
    expressEntryBonusPoints: 600,
    sections,
    advisories,
    benchmarks,
  };
}

// ============================================================================
// 5. MANITOBA — MPNP (1,000-Point EOI Ranking Grid + Risk Assessment)
// ============================================================================

function scoreMpnpSingleBand(clb: CLBLevel): number {
  if (clb >= 8) return 25;
  if (clb === 7) return 22;
  if (clb === 6) return 20;
  if (clb === 5) return 17;
  if (clb === 4) return 12;
  return 0;
}

function calculateManitobaMpnp(
  input: PnpCalculatorInput,
  lang: LanguageSummary
): PnpProvinceResult {
  const hasProvinceInput =
    checkSharedHasInput(input) ||
    input.mpnpWorkYearsPast5 !== null ||
    input.mpnpRecognizedByProvincialLicense !== null ||
    input.mpnpPrimaryAdaptability !== "" ||
    input.mpnpRegionalOutsideWinnipeg !== null ||
    input.mpnpRiskWorkedOtherProvince !== null ||
    input.mpnpRiskStudiedOtherProvince !== null;

  // Factor 1: Language Proficiency (Max 100 First + 25 Second = 125)
  const firstLangPts = lang.hasValidFirst
    ? scoreMpnpSingleBand(input.firstLanguage.speaking) +
      scoreMpnpSingleBand(input.firstLanguage.listening) +
      scoreMpnpSingleBand(input.firstLanguage.reading) +
      scoreMpnpSingleBand(input.firstLanguage.writing)
    : 0;
  const secondLangPts = lang.hasValidSecond && lang.minSecondClb >= 5 ? 25 : 0;
  const factor1Lang = Math.min(firstLangPts + secondLangPts, 125);

  // Factor 2: Age (Max 75)
  let factor2Age = 0;
  if (input.age !== null) {
    if (input.age >= 21 && input.age <= 45) factor2Age = 75;
    else if (input.age === 20 || input.age === 46) factor2Age = 40;
    else if (input.age === 19 || input.age === 47) factor2Age = 30;
    else if (input.age === 18 || input.age === 48) factor2Age = 20;
    else if (input.age === 49) factor2Age = 10;
  }

  // Factor 3: Work Experience in Past 5 Years (Max 75 + 100 = 175)
  const yrs = input.mpnpWorkYearsPast5 ?? 0;
  const workBaseMap: Record<MpnpWorkYears, number> = {
    0: 0,
    1: 40,
    2: 50,
    3: 60,
    4: 75,
  };
  const workBasePts = workBaseMap[yrs];
  const licenseBonusPts =
    yrs >= 1 && input.mpnpRecognizedByProvincialLicense === true ? 100 : 0;
  const factor3Work = Math.min(workBasePts + licenseBonusPts, 175);

  // Factor 4: Education (Max 125)
  const mpnpEduMap: Record<SharedPnpEducationLevel, number> = {
    "": 0,
    secondary_or_less: 0,
    trade_certificate: 70,
    one_year_post_secondary: 70,
    two_year_post_secondary: 100,
    bachelors_three_year: 110,
    two_or_more_degrees: 115,
    post_grad_diploma: 110,
    masters: 125,
    doctoral_or_md: 125,
  };
  const factor4Edu = mpnpEduMap[input.educationLevel];

  // Factor 5: Adaptability / Connection to Manitoba (Max 500)
  const adaptMap: Record<MpnpAdaptabilityPrimary, number> = {
    "": 0,
    none: 0,
    ongoing_mb_employment_or_strategic_ita: 500,
    close_relative_mb: 200,
    previous_mb_work_6m: 100,
    mb_post_sec_2yr: 100,
    mb_post_sec_1yr: 50,
    distant_relative_or_friend_mb: 50,
  };
  const adaptPrimaryPts = adaptMap[input.mpnpPrimaryAdaptability];
  const regionalOutsideWinnipegPts =
    adaptPrimaryPts > 0 &&
    adaptPrimaryPts < 500 &&
    input.mpnpRegionalOutsideWinnipeg === true
      ? 50
      : 0;
  const factor5Adapt = Math.min(adaptPrimaryPts + regionalOutsideWinnipegPts, 500);

  // Factor 6: Risk Assessment Deductions (0 to -200)
  const riskWorkDeduction = input.mpnpRiskWorkedOtherProvince === true ? -100 : 0;
  const riskStudyDeduction = input.mpnpRiskStudiedOtherProvince === true ? -100 : 0;
  const factor6RiskTotal = riskWorkDeduction + riskStudyDeduction; // 0, -100, or -200

  const grossSubtotal = factor1Lang + factor2Age + factor3Work + factor4Edu + factor5Adapt;
  const totalScore = Math.max(0, Math.min(1000, grossSubtotal + factor6RiskTotal));

  const advisories: string[] = [
    "MPNP scores First Official Language per individual skill band (up to 25 pts × 4 bands = 100 pts) rather than solely by your lowest band.",
    "Risk Assessment Penalty: Working (-100 pts) or studying (-100 pts) in another Canadian province deducts up to 200 points from your Manitoba EOI ranking.",
  ];
  if (factor5Adapt === 0 && hasProvinceInput) {
    advisories.push(
      "Manitoba Connection Gate: MPNP Skilled Worker streams require an established Manitoba connection (ongoing employment, Manitoba relative/supporter, past MB study/work, or Strategic Initiative invitation) to receive an LAA."
    );
  }

  const sections: PnpSectionBreakdown[] = [
    {
      id: "mpnp_human_capital",
      title: "Factors 1 – 4: Human Capital (Max 500)",
      points: factor1Lang + factor2Age + factor3Work + factor4Edu,
      maxPoints: 500,
      items: [
        {
          id: "mpnp_lang",
          label: "Factor 1: Language Proficiency (Per-Band Max 100 + 2nd Lang 25)",
          points: factor1Lang,
          maxPoints: 125,
        },
        { id: "mpnp_age", label: "Factor 2: Age (Peak 75 pts at ages 21–45)", points: factor2Age, maxPoints: 75 },
        {
          id: "mpnp_work",
          label: "Factor 3: Work Experience (Max 75 + 100 Provincial Licensing)",
          points: factor3Work,
          maxPoints: 175,
        },
        { id: "mpnp_edu", label: "Factor 4: Education", points: factor4Edu, maxPoints: 125 },
      ],
    },
    {
      id: "mpnp_adaptability",
      title: "Factor 5: Adaptability & Manitoba Demand (Max 500)",
      points: factor5Adapt,
      maxPoints: 500,
      items: [
        {
          id: "mpnp_conn",
          label: "Primary Manitoba Connection / Ongoing Employment",
          points: adaptPrimaryPts,
          maxPoints: 500,
        },
        {
          id: "mpnp_reg",
          label: "Regional Development Outside Winnipeg (+50 when < 500)",
          points: regionalOutsideWinnipegPts,
          maxPoints: 50,
        },
      ],
    },
    {
      id: "mpnp_risk",
      title: "Factor 6: Risk Assessment Deductions (Down to -200)",
      points: factor6RiskTotal,
      maxPoints: 0,
      isDeductionSection: true,
      items: [
        {
          id: "mpnp_risk_work",
          label: "Work Experience in Another Canadian Province",
          points: riskWorkDeduction,
          maxPoints: 0,
          isDeduction: true,
        },
        {
          id: "mpnp_risk_study",
          label: "Post-Secondary Study in Another Canadian Province",
          points: riskStudyDeduction,
          maxPoints: 0,
          isDeduction: true,
        },
      ],
    },
  ];

  const benchmarks: PnpDrawBenchmark[] = [
    {
      id: "mpnp_swo_strategic",
      streamName: "MPNP Skilled Worker Overseas (Strategic Recruitment / Close Relative)",
      recentCutoff: 632,
      cutoffRangeLabel: "585 – 715",
      meetsCutoff: factor5Adapt > 0 && totalScore >= 632,
      pointsDelta: totalScore - 632,
      expressEntryAligned: true,
      note: "Requires Manitoba supporter/initiative; Express Entry sub-pathway grants +600 CRS",
    },
    {
      id: "mpnp_swm_occupation",
      streamName: "MPNP Skilled Worker in Manitoba — Occupation-Specific Draws",
      recentCutoff: 785,
      cutoffRangeLabel: "740 – 825",
      meetsCutoff: factor5Adapt > 0 && totalScore >= 785,
      pointsDelta: totalScore - 785,
      expressEntryAligned: true,
      note: "Ongoing full-time Manitoba employment (+500 pts) typically anchors competitive SWM profiles",
    },
    {
      id: "mpnp_all_profiles",
      streamName: "MPNP General All-Occupation Rounds",
      recentCutoff: 842,
      cutoffRangeLabel: "810 – 870",
      meetsCutoff: factor5Adapt > 0 && totalScore >= 842,
      pointsDelta: totalScore - 842,
      expressEntryAligned: true,
      note: "General non-targeted Manitoba EOI Letters of Advice to Apply (LAAs)",
    },
  ];

  return {
    provinceId: "manitoba_mpnp",
    provinceCode: "MB",
    provinceName: "Manitoba",
    programShortName: "MPNP",
    officialStreamTitle: "Manitoba Expression of Interest (EOI) 1,000-Point Ranking Grid",
    officialPortalUrl: "https://immigratemanitoba.com/immigrate/skilled-worker/swm/ranking/",
    lastUpdatedLabel: "2026 MPNP EOI Ranking Standard (Max 1,000 • -200 Risk Assessment)",
    totalScore,
    maxScore: 1000,
    minimumPassMark: null,
    meetsPassMark: hasProvinceInput && factor5Adapt > 0,
    hasAnyInput: hasProvinceInput,
    expressEntryBonusPoints: 600,
    sections,
    advisories,
    benchmarks,
  };
}

// ============================================================================
// 6. PRINCE EDWARD ISLAND — PEI PNP (100-Point EOI Grid)
// ============================================================================

function calculatePeiPnp(input: PnpCalculatorInput, lang: LanguageSummary): PnpProvinceResult {
  const hasProvinceInput =
    checkSharedHasInput(input) ||
    input.peiWorkYears !== "" ||
    input.peiWorkingInPeiOnPermit !== null ||
    input.peiJobRelatedToStudy !== null ||
    input.peiHas1YrContinuousPeiWork !== null ||
    input.peiHasCloseFamilyInPei !== null ||
    input.peiGraduatedFromPeiInstitution !== null ||
    input.peiSpouseLanguageOrWorkQualified !== null ||
    input.peiPropertyOrChildInPeiSchool !== null;

  const withOffer = input.peiPathwayMode === "with_job_offer";

  // 1. Age (Max 20)
  let agePts = 0;
  if (input.age !== null) {
    if (input.age >= 25 && input.age <= 29) agePts = 20;
    else if (input.age >= 30 && input.age <= 44) agePts = 15;
    else if (input.age >= 45 && input.age <= 49) agePts = 10;
    else if (input.age >= 18 && input.age <= 24) agePts = 7;
  }

  // 2. Language (Max 20)
  let langPts = 0;
  if (lang.minFirstClb >= 9) langPts = 20;
  else if (lang.minFirstClb === 8) langPts = 15;
  else if (lang.minFirstClb === 7) langPts = 10;
  else if (withOffer && lang.minFirstClb >= 5) langPts = 5;

  if (lang.minEnglishClb >= 4 && lang.minFrenchNclc >= 4) {
    langPts = Math.min(20, langPts + 5);
  }

  // 3. Education (Max 15)
  const peiEduMap: Record<SharedPnpEducationLevel, number> = {
    "": 0,
    secondary_or_less: 0,
    trade_certificate: 10,
    one_year_post_secondary: 10,
    two_year_post_secondary: 10,
    bachelors_three_year: 12,
    two_or_more_degrees: 12,
    post_grad_diploma: 12,
    masters: 15,
    doctoral_or_md: 15,
  };
  const eduPts = peiEduMap[input.educationLevel];

  // 4. Work Experience (Max 15 with offer / Max 20 without offer)
  const workMax = withOffer ? 15 : 20;
  let workPts = 0;
  if (input.peiWorkYears === "6yr_plus") workPts = withOffer ? 15 : 20;
  else if (input.peiWorkYears === "4_to_5yr") workPts = 15;
  else if (input.peiWorkYears === "2_to_3yr") workPts = 10;
  else if (input.peiWorkYears === "1yr") workPts = 5;

  // 5. PEI Employment Factors (Max 15 with offer / Max 10 without offer)
  const empMax = withOffer ? 15 : 10;
  const permitPts = input.peiWorkingInPeiOnPermit === true ? 5 : 0;
  const relatedStudyPts = input.peiJobRelatedToStudy === true ? 5 : 0;
  const oneYrPeiPts = input.peiHas1YrContinuousPeiWork === true ? 5 : 0;
  const empPts = Math.min(permitPts + relatedStudyPts + oneYrPeiPts, empMax);

  // 6. Adaptability (Max 15: +5 per factor up to 15)
  const famPts = input.peiHasCloseFamilyInPei === true ? 5 : 0;
  const gradPts = input.peiGraduatedFromPeiInstitution === true ? 5 : 0;
  const spousePts = input.peiSpouseLanguageOrWorkQualified === true ? 5 : 0;
  const propChildPts = input.peiPropertyOrChildInPeiSchool === true ? 5 : 0;
  const adaptPts = Math.min(famPts + gradPts + spousePts + propChildPts, 15);

  const totalScore = Math.min(agePts + langPts + eduPts + workPts + empPts + adaptPts, 100);

  const advisories: string[] = [
    "PEI PNP holds scheduled monthly invitation draws prioritizing candidates currently living and working in PEI in Healthcare, Skilled Trades, Construction, and Childcare.",
    "Registering an EOI in PEI is free; Express Entry–aligned PEI nominations add +600 points to your federal CRS profile.",
  ];

  const sections: PnpSectionBreakdown[] = [
    {
      id: "pei_human_capital",
      title: `A. Human Capital Factors (Max ${55 + workMax})`,
      points: agePts + langPts + eduPts + workPts,
      maxPoints: 55 + workMax,
      items: [
        { id: "pei_age", label: "Age (Peak 20 pts at ages 25–29)", points: agePts, maxPoints: 20 },
        {
          id: "pei_lang",
          label: "Language Proficiency (+5 Bilingual Bonus up to 20)",
          points: langPts,
          maxPoints: 20,
        },
        { id: "pei_edu", label: "Completed Education Level", points: eduPts, maxPoints: 15 },
        {
          id: "pei_work",
          label: "Full-Time Skilled Work Experience",
          points: workPts,
          maxPoints: workMax,
        },
      ],
    },
    {
      id: "pei_employment_adapt",
      title: `B. PEI Employment & Adaptability (Max ${empMax + 15})`,
      points: empPts + adaptPts,
      maxPoints: empMax + 15,
      items: [
        {
          id: "pei_emp",
          label: "PEI Employment Alignment & Local Tenure",
          points: empPts,
          maxPoints: empMax,
        },
        {
          id: "pei_adapt",
          label: "PEI Adaptability (Family, PEI Alumni, Spouse, Property/School)",
          points: adaptPts,
          maxPoints: 15,
        },
      ],
    },
  ];

  const benchmarks: PnpDrawBenchmark[] = [
    {
      id: "pei_priority_in_province",
      streamName: "PEI Workforce & Express Entry (Living & Working in PEI — Priority Sectors)",
      recentCutoff: 62,
      cutoffRangeLabel: "55 – 68",
      meetsCutoff: totalScore >= 62,
      pointsDelta: totalScore - 62,
      expressEntryAligned: true,
      note: "Monthly PEI draws prioritizing Healthcare, Trades, Manufacturing & Childcare workers in PEI",
    },
    {
      id: "pei_general_ee",
      streamName: "PEI Express Entry & Skilled Workers Outside PEI",
      recentCutoff: 78,
      cutoffRangeLabel: "72 – 85",
      meetsCutoff: totalScore >= 78,
      pointsDelta: totalScore - 78,
      expressEntryAligned: true,
      note: "Competitive threshold when applying without existing PEI employment tenure",
    },
  ];

  return {
    provinceId: "pei_pnp",
    provinceCode: "PE",
    provinceName: "Prince Edward Island",
    programShortName: "PEI PNP",
    officialStreamTitle: `PEI Expression of Interest Grid (${
      withOffer ? "With PEI Job Offer" : "Without PEI Job Offer"
    })`,
    officialPortalUrl:
      "https://www.princeedwardisland.ca/en/information/office-of-immigration/expression-of-interest",
    lastUpdatedLabel: "2026 PEI PNP EOI Standard (Max 100 • Monthly Draw Schedule)",
    totalScore,
    maxScore: 100,
    minimumPassMark: null,
    meetsPassMark: hasProvinceInput && totalScore > 0,
    hasAnyInput: hasProvinceInput,
    expressEntryBonusPoints: 600,
    sections,
    advisories,
    benchmarks,
  };
}

// ============================================================================
// UNIFIED ENTRYPOINTS & OPTIMIZATION ENGINE
// ============================================================================

export function calculateAllPnpProvinces(
  input: PnpCalculatorInput
): Record<PnpProvinceId, PnpProvinceResult> {
  const lang = summarizeLanguages(input);
  return {
    ontario_oinp: calculateOntarioOinp(input, lang),
    bc_pnp: calculateBcPnp(input, lang),
    alberta_aaip: calculateAlbertaAaip(input, lang),
    saskatchewan_sinp: calculateSaskatchewanSinp(input, lang),
    manitoba_mpnp: calculateManitobaMpnp(input, lang),
    pei_pnp: calculatePeiPnp(input, lang),
  };
}

export function calculatePnpScore(input: PnpCalculatorInput): PnpProvinceResult {
  const all = calculateAllPnpProvinces(input);
  return all[input.activeProvince];
}

export function generatePnpOptimizationTips(
  input: PnpCalculatorInput,
  current: PnpProvinceResult
): PnpOptimizationTip[] {
  if (!current.hasAnyInput || current.totalScore === 0) {
    return [];
  }

  const tips: PnpOptimizationTip[] = [];
  const lang = summarizeLanguages(input);

  // 1. Upgrade First Official Language to CLB 9 across all 4 skills
  if (input.firstLanguageTest !== "none" && lang.minFirstClb < 9) {
    const previewInput: PnpCalculatorInput = {
      ...input,
      hasValidLanguageTest: true,
      firstLanguage: {
        speaking: Math.max(input.firstLanguage.speaking, 9) as CLBLevel,
        listening: Math.max(input.firstLanguage.listening, 9) as CLBLevel,
        reading: Math.max(input.firstLanguage.reading, 9) as CLBLevel,
        writing: Math.max(input.firstLanguage.writing, 9) as CLBLevel,
      },
    };
    const sim = calculatePnpScore(previewInput);
    const gain = sim.totalScore - current.totalScore;
    if (gain > 0) {
      tips.push({
        id: "pnp_clb9_boost",
        title: "Reach CLB/NCLC 9 Across All 4 Language Abilities",
        actionSummary: `Raising your lowest language band to CLB/NCLC 9 unlocks the top language tier in ${current.programShortName}.`,
        pointsGain: gain,
        projectedTotal: sim.totalScore,
        previewInput,
      });
    }
  }

  // 2. Bilingualism Bonus (French NCLC 6+ / NCLC 7+)
  if (isEnglishTest(input.firstLanguageTest) && lang.minFrenchNclc < 6) {
    const previewInput: PnpCalculatorInput = {
      ...input,
      hasValidLanguageTest: true,
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 },
    };
    const sim = calculatePnpScore(previewInput);
    const gain = sim.totalScore - current.totalScore;
    if (gain > 0) {
      tips.push({
        id: "pnp_bilingual_french",
        title: "Add French Proficiency (TEF / TCF Canada NCLC 7)",
        actionSummary: `Dual English + French proficiency unlocks ${current.programShortName}'s bilingualism bonus points and Francophone targeted draws.`,
        pointsGain: gain,
        projectedTotal: sim.totalScore,
        previewInput,
      });
    }
  }

  // 3. Province-Specific High-Impact Levers
  if (input.activeProvince === "ontario_oinp") {
    if (input.oinpWorkRegion === "city_of_toronto" || input.oinpWorkRegion === "gta_excluding_toronto") {
      const previewInput: PnpCalculatorInput = {
        ...input,
        oinpWorkRegion: "outside_gta_other",
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "oinp_regional_outside_gta",
          title: "Target an Employer Outside the Greater Toronto Area (GTA)",
          actionSummary:
            "Positions in Eastern, Central, or Southwestern Ontario score 10 regional points (15 in Northern Ontario) vs. 0 in Toronto.",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
    if ((input.hourlyWage ?? 0) > 0 && (input.hourlyWage ?? 0) < 40 && !input.oinpIsSelfEmployedPhysician) {
      const nextBracket =
        (input.hourlyWage ?? 0) < 25
          ? 25
          : (input.hourlyWage ?? 0) < 30
            ? 30
            : (input.hourlyWage ?? 0) < 35
              ? 35
              : 40;
      const previewInput: PnpCalculatorInput = { ...input, hourlyWage: nextBracket };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "oinp_next_wage_step",
          title: `Reach the $${nextBracket}.00/hr OINP Wage Step`,
          actionSummary: `OINP scores wages in strict steps — reaching $${nextBracket}.00/hr immediately steps up your wage tier.`,
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
  } else if (input.activeProvince === "bc_pnp") {
    if (input.bcEmploymentArea === "area_1_metro_vancouver") {
      const previewInput: PnpCalculatorInput = {
        ...input,
        bcEmploymentArea: "area_3_rest_of_bc",
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "bc_regional_area3",
          title: "Consider B.C. Regional Employment Outside Metro Vancouver (Area 3)",
          actionSummary:
            "Working in Area 3 (Victoria, Kelowna, Kamloops, Nanaimo, Prince George) adds +15 regional points (+25 with regional experience/study).",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
    if (input.bcCurrentlyWorkingFullTimeInBcRole !== true) {
      const previewInput: PnpCalculatorInput = {
        ...input,
        bcCurrentlyWorkingFullTimeInBcRole: true,
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "bc_current_employment",
          title: "Begin Full-Time Employment in B.C. With Supporting Employer",
          actionSummary:
            "Currently working full-time in B.C. in the offered role adds +10 Human Capital points on the SIRS grid.",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
  } else if (input.activeProvince === "alberta_aaip") {
    if (input.aaipHasValidJobOffer !== true) {
      const previewInput: PnpCalculatorInput = {
        ...input,
        aaipHasValidJobOffer: true,
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "aaip_job_offer",
          title: "Secure a Permanent Full-Time Alberta Job Offer",
          actionSummary:
            "An eligible Alberta job offer unlocks +10 base points (and up to 31 total Economic points with regional/regulated bonuses).",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
  } else if (input.activeProvince === "saskatchewan_sinp") {
    if (input.sinpHasJobApprovalLetter !== true) {
      const previewInput: PnpCalculatorInput = {
        ...input,
        sinpHasJobApprovalLetter: true,
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "sinp_jal_offer",
          title: "Obtain a Saskatchewan SINP Job Approval Letter (+30 pts)",
          actionSummary:
            "An approved high-skilled job offer in Saskatchewan awards the full 30/30 Factor II Connection points.",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
  } else if (input.activeProvince === "manitoba_mpnp") {
    if (input.mpnpPrimaryAdaptability !== "ongoing_mb_employment_or_strategic_ita") {
      const previewInput: PnpCalculatorInput = {
        ...input,
        mpnpPrimaryAdaptability: "ongoing_mb_employment_or_strategic_ita",
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "mpnp_ongoing_employment",
          title: "Complete 6+ Months Ongoing Full-Time Employment in Manitoba",
          actionSummary:
            "Ongoing Manitoba employment (or a Strategic Recruitment invitation) awards the maximum 500 Adaptability points.",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
  } else if (input.activeProvince === "pei_pnp") {
    if (input.peiWorkingInPeiOnPermit !== true) {
      const previewInput: PnpCalculatorInput = {
        ...input,
        peiWorkingInPeiOnPermit: true,
        peiPathwayMode: "with_job_offer",
      };
      const sim = calculatePnpScore(previewInput);
      const gain = sim.totalScore - current.totalScore;
      if (gain > 0) {
        tips.push({
          id: "pei_local_work",
          title: "Work in PEI on a Valid Work Permit (+PEI Priority Rounds)",
          actionSummary:
            "Working in PEI adds direct Employment points and qualifies your profile for PEI's primary monthly in-province draws.",
          pointsGain: gain,
          projectedTotal: sim.totalScore,
          previewInput,
        });
      }
    }
  }

  return tips.sort((a, b) => b.pointsGain - a.pointsGain).slice(0, 4);
}

