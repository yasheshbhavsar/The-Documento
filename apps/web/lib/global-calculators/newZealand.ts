/**
 * New Zealand Skilled Migrant Category (SMC) Resident Visa Engine
 *
 * Statutory Basis: Immigration New Zealand (INZ) — Effective August 24, 2026 & March 9, 2026 NZD $35.00/hr Median Wage
 * Evaluates:
 * 1. Traditional 6-Point SMC Pathway (Primary Skill Anchor [3–6 pts, non-stacking] + NZ Skilled Work Top-Up [1–3 pts])
 *    - Reflects Aug 24, 2026 Overseas vs. New Zealand qualification point differentiation:
 *      • PhD (NZ or Overseas) = 6 pts
 *      • NZ Master's (>= 30 wks FT study in NZ + holds Bachelor's degree) = 6 pts
 *      • Overseas Master's (holds Bachelor's) OR NZ Master's without Bachelor's = 5 pts
 *      • NZ Level 8 Honours/PGDip/PGCert (holds Bachelor's) OR NZ Level 7 Bachelor's = 5 pts
 *      • Overseas Level 8 (holds Bachelor's) OR Overseas Level 7 Bachelor's = 4 pts
 * 2. New Skilled Work Experience Residence Pathway (ANZSCO 1–3, 5 yrs total + 2 yrs NZ @ >= 1.1x [$38.50/hr] or 1.2x [$42.00/hr] Amber List)
 * 3. New Trades & Technician Residence Pathway (Level 4+ cert, 4 yrs post-qual + 18 mos NZ @ >= 1.0x median wage [$35.00/hr])
 *
 * Starts strictly at 0 points (all fields unselected, zero sample scenarios).
 */

export const NZ_SMC_MEDIAN_WAGE_2026 = 35.0;

export type NzAgeStatus = "" | "under_56_eligible" | "56_or_older_ineligible";

export type NzQualificationTier =
  | ""
  | "none_or_below_level_7"
  | "level_4_to_6_trade_tech"
  | "overseas_bachelor_or_level_8"
  | "nz_bachelor_or_level_8"
  | "overseas_masters_level_9"
  | "nz_masters_no_bachelor_level_9"
  | "nz_masters_30wk_level_9"
  | "phd_level_10_any";

export type NzOccupationalRegistrationTier =
  | ""
  | "none"
  | "2_to_3_years_training"
  | "4_years_training"
  | "5_years_training"
  | "6_plus_years_training";

export type NzSkilledWorkYearsInNz =
  | ""
  | "none"
  | "1yr"
  | "18_months"
  | "2yr"
  | "3yr_plus"
  | "5yr_plus";

export type NzTotalRelevantWorkYears = "" | "under_4yr" | "4yr" | "5yr_plus";

export interface NzSmcInput {
  ageStatus: NzAgeStatus;
  hasEnglishIelts65OrEquivalent: boolean | null;
  hasAccreditedNzJobOrOffer: boolean | null;
  anzscoSkillTier:
    | ""
    | "anzsco_1_to_3"
    | "anzsco_1_to_3_amber"
    | "anzsco_1_to_3_red"
    | "anzsco_4_to_5";
  nzHourlyWageNzd: number | null;
  qualificationTier: NzQualificationTier;
  nzRegistrationTier: NzOccupationalRegistrationTier;
  nzSkilledWorkYears: NzSkilledWorkYearsInNz;
  totalRelevantWorkYears: NzTotalRelevantWorkYears;
  isEligibleTradeOrTechnicianRole: boolean | null;
}

export const DEFAULT_NZ_INPUT: NzSmcInput = {
  ageStatus: "",
  hasEnglishIelts65OrEquivalent: null,
  hasAccreditedNzJobOrOffer: null,
  anzscoSkillTier: "",
  nzHourlyWageNzd: null,
  qualificationTier: "",
  nzRegistrationTier: "",
  nzSkilledWorkYears: "",
  totalRelevantWorkYears: "",
  isEligibleTradeOrTechnicianRole: null,
};

export interface NzSmcResult {
  hasAnyInput: boolean;
  totalClaimablePoints: number;
  rawUncappedPoints: number;
  passMark: 6;
  meetsSixPointRoute: boolean;
  meetsSkilledWorkExperiencePathway: boolean;
  meetsTradesTechnicianPathway: boolean;
  eligibleUnderAnySmcRoute: boolean;
  prerequisitesMet: boolean;
  prerequisiteWarnings: string[];
  winningPrimaryCategory: "none" | "qualification" | "registration" | "income";
  breakdown: {
    qualificationPoints: number;
    registrationPoints: number;
    incomePoints: number;
    primaryAnchorPoints: number;
    nzWorkExperiencePoints: number;
  };
}

export interface NzOptimizationTip {
  id: string;
  title: string;
  actionSummary: string;
  pointsGain: number;
  projectedTotal: number;
  previewInput: NzSmcInput;
}

export function calculateNzSmc(input: NzSmcInput): NzSmcResult {
  const hasAnyInput =
    input.ageStatus !== "" ||
    input.hasEnglishIelts65OrEquivalent !== null ||
    input.hasAccreditedNzJobOrOffer !== null ||
    input.anzscoSkillTier !== "" ||
    input.nzHourlyWageNzd !== null ||
    input.qualificationTier !== "" ||
    input.nzRegistrationTier !== "" ||
    input.nzSkilledWorkYears !== "" ||
    input.totalRelevantWorkYears !== "" ||
    input.isEligibleTradeOrTechnicianRole !== null;

  // 1. Qualification Anchor (Aug 24, 2026 Overseas vs NZ points)
  const qualMap: Record<NzQualificationTier, number> = {
    "": 0,
    none_or_below_level_7: 0,
    level_4_to_6_trade_tech: 0,
    overseas_bachelor_or_level_8: 4,
    nz_bachelor_or_level_8: 5,
    overseas_masters_level_9: 5,
    nz_masters_no_bachelor_level_9: 5,
    nz_masters_30wk_level_9: 6,
    phd_level_10_any: 6,
  };
  const qualificationPoints = qualMap[input.qualificationTier];

  // 2. NZ Occupational Registration Anchor
  const regMap: Record<NzOccupationalRegistrationTier, number> = {
    "": 0,
    none: 0,
    "2_to_3_years_training": 3,
    "4_years_training": 4,
    "5_years_training": 5,
    "6_plus_years_training": 6,
  };
  const registrationPoints = regMap[input.nzRegistrationTier];

  // 3. Income Multiplier Anchor (March 2026 NZD $35.00/hr baseline)
  let incomePoints = 0;
  const wage = input.nzHourlyWageNzd ?? 0;
  if (wage >= NZ_SMC_MEDIAN_WAGE_2026 * 3) {
    incomePoints = 6; // >= $105.00/hr
  } else if (wage >= NZ_SMC_MEDIAN_WAGE_2026 * 2) {
    incomePoints = 4; // >= $70.00/hr
  } else if (wage >= NZ_SMC_MEDIAN_WAGE_2026 * 1.5) {
    incomePoints = 3; // >= $52.50/hr
  }

  // Determine single winning Primary Skill Anchor (non-stacking per INZ rules)
  let winningPrimaryCategory: NzSmcResult["winningPrimaryCategory"] = "none";
  let primaryAnchorPoints = 0;
  if (
    qualificationPoints >= registrationPoints &&
    qualificationPoints >= incomePoints &&
    qualificationPoints > 0
  ) {
    primaryAnchorPoints = qualificationPoints;
    winningPrimaryCategory = "qualification";
  } else if (registrationPoints >= incomePoints && registrationPoints > 0) {
    primaryAnchorPoints = registrationPoints;
    winningPrimaryCategory = "registration";
  } else if (incomePoints > 0) {
    primaryAnchorPoints = incomePoints;
    winningPrimaryCategory = "income";
  }

  // 4. Skilled Work Experience in New Zealand (1–3 points; combines with any Primary Skill Anchor >= 3 pts)
  const nzWorkMap: Record<NzSkilledWorkYearsInNz, number> = {
    "": 0,
    none: 0,
    "1yr": 1,
    "18_months": 1,
    "2yr": 2,
    "3yr_plus": 3,
    "5yr_plus": 3,
  };
  const nzWorkRaw = nzWorkMap[input.nzSkilledWorkYears];
  const nzWorkExperiencePoints = primaryAnchorPoints >= 3 ? nzWorkRaw : 0;

  const rawUncappedPoints = primaryAnchorPoints + nzWorkExperiencePoints;
  const totalClaimablePoints = Math.min(6, rawUncappedPoints);

  // Check Mandatory Baseline Prerequisites
  const prerequisiteWarnings: string[] = [];
  if (input.ageStatus === "56_or_older_ineligible") {
    prerequisiteWarnings.push(
      "Age Limit: SMC Resident Visa applicants must be aged 55 or younger on the date of residence application."
    );
  }
  if (input.hasEnglishIelts65OrEquivalent === false) {
    prerequisiteWarnings.push(
      "English Requirement: Minimum IELTS 6.5 overall (or PTE 58 / recognized degree / citizenship) is mandatory."
    );
  }
  if (input.hasAccreditedNzJobOrOffer === false) {
    prerequisiteWarnings.push(
      "Accredited Employer Requirement: All SMC pathways require current skilled employment or a job offer with an INZ-Accredited New Zealand employer."
    );
  }
  if (input.anzscoSkillTier === "anzsco_1_to_3_red") {
    prerequisiteWarnings.push(
      "Red List Occupation Rule (Aug 24, 2026): Roles on INZ's Red List are excluded from the new Skilled Work Experience and Trades pathways and must qualify via the 6-Point SMC route."
    );
  }

  const minRequiredWage =
    input.anzscoSkillTier === "anzsco_4_to_5"
      ? NZ_SMC_MEDIAN_WAGE_2026 * 1.5
      : NZ_SMC_MEDIAN_WAGE_2026;

  const wageMeetsBaseline =
    input.nzHourlyWageNzd !== null && input.nzHourlyWageNzd >= minRequiredWage;

  if (input.nzHourlyWageNzd !== null && input.nzHourlyWageNzd < minRequiredWage) {
    prerequisiteWarnings.push(
      `Wage Floor: Your NZD $${input.nzHourlyWageNzd.toFixed(2)}/hr rate is below the required NZD $${minRequiredWage.toFixed(2)}/hr SMC threshold.`
    );
  }

  const prerequisitesMet =
    input.ageStatus === "under_56_eligible" &&
    input.hasEnglishIelts65OrEquivalent === true &&
    input.hasAccreditedNzJobOrOffer === true &&
    wageMeetsBaseline;

  const meetsSixPointRoute = prerequisitesMet && totalClaimablePoints >= 6;

  // Aug 24, 2026 Pathway 2: Skilled Work Experience Pathway
  // Standard ANZSCO 1–3: 5+ yrs total relevant work, 2+ yrs NZ skilled work @ >= 1.1x ($38.50/hr)
  // Amber List ANZSCO 1–3: 5+ yrs relevant skilled work IN NEW ZEALAND (incl. 2+ yrs @ >= 1.2x) & >= 1.2x ($42.00/hr)
  // Red List ANZSCO 1–3: Statutorily excluded from Experience & Trades pathways
  const has2YrNz =
    input.nzSkilledWorkYears === "2yr" ||
    input.nzSkilledWorkYears === "3yr_plus" ||
    input.nzSkilledWorkYears === "5yr_plus";
  const has5YrNz = input.nzSkilledWorkYears === "5yr_plus";
  const isStandardOrAmber1To3 =
    input.anzscoSkillTier === "anzsco_1_to_3" ||
    input.anzscoSkillTier === "anzsco_1_to_3_amber";
  const isAmberRole = input.anzscoSkillTier === "anzsco_1_to_3_amber";
  const experienceRouteWageFloor = isAmberRole
    ? NZ_SMC_MEDIAN_WAGE_2026 * 1.2
    : NZ_SMC_MEDIAN_WAGE_2026 * 1.1;

  if (
    isAmberRole &&
    input.nzSkilledWorkYears !== "" &&
    !has5YrNz &&
    totalClaimablePoints < 6
  ) {
    prerequisiteWarnings.push(
      "Amber List Tenure Rule (Aug 24, 2026): Amber List occupations require 5 full years of skilled work experience IN New Zealand (including ≥ 2 years at 1.2× median wage = NZD $42.00/hr) to use the Skilled Work Experience Pathway."
    );
  }

  const meetsSkilledWorkExperiencePathway =
    prerequisitesMet &&
    isStandardOrAmber1To3 &&
    input.totalRelevantWorkYears === "5yr_plus" &&
    (isAmberRole ? has5YrNz : has2YrNz) &&
    (input.nzHourlyWageNzd ?? 0) >= experienceRouteWageFloor;

  // Aug 24, 2026 Pathway 3: Trades & Technician Pathway
  // Eligible trade/tech ANZSCO 1–3 (non-Red List), Level 4+ qualification, 4+ yrs total post-qual work, 18+ mos NZ work, >= 1.0x median wage ($35.00/hr)
  const hasLevel4Plus =
    input.qualificationTier !== "" && input.qualificationTier !== "none_or_below_level_7";
  const has4YrTotal =
    input.totalRelevantWorkYears === "4yr" || input.totalRelevantWorkYears === "5yr_plus";
  const has18MoNz =
    input.nzSkilledWorkYears === "18_months" ||
    input.nzSkilledWorkYears === "2yr" ||
    input.nzSkilledWorkYears === "3yr_plus" ||
    input.nzSkilledWorkYears === "5yr_plus";
  const meetsTradesTechnicianPathway =
    prerequisitesMet &&
    input.isEligibleTradeOrTechnicianRole === true &&
    input.anzscoSkillTier === "anzsco_1_to_3" &&
    hasLevel4Plus &&
    has4YrTotal &&
    has18MoNz &&
    (input.nzHourlyWageNzd ?? 0) >= NZ_SMC_MEDIAN_WAGE_2026;

  return {
    hasAnyInput,
    totalClaimablePoints,
    rawUncappedPoints,
    passMark: 6,
    meetsSixPointRoute,
    meetsSkilledWorkExperiencePathway,
    meetsTradesTechnicianPathway,
    eligibleUnderAnySmcRoute:
      meetsSixPointRoute ||
      meetsSkilledWorkExperiencePathway ||
      meetsTradesTechnicianPathway,
    prerequisitesMet,
    prerequisiteWarnings,
    winningPrimaryCategory,
    breakdown: {
      qualificationPoints,
      registrationPoints,
      incomePoints,
      primaryAnchorPoints,
      nzWorkExperiencePoints,
    },
  };
}

export function generateNzTips(
  input: NzSmcInput,
  current: NzSmcResult
): NzOptimizationTip[] {
  if (!current.hasAnyInput) return [];
  const tips: NzOptimizationTip[] = [];

  if (
    current.breakdown.primaryAnchorPoints >= 3 &&
    current.totalClaimablePoints < 6
  ) {
    const neededYrs = 6 - current.breakdown.primaryAnchorPoints;
    const targetWork: NzSkilledWorkYearsInNz =
      neededYrs <= 1 ? "1yr" : neededYrs === 2 ? "2yr" : "3yr_plus";
    const previewInput: NzSmcInput = {
      ...input,
      nzSkilledWorkYears: targetWork,
    };
    const sim = calculateNzSmc(previewInput);
    const gain = sim.totalClaimablePoints - current.totalClaimablePoints;
    if (gain > 0) {
      tips.push({
        id: "nz_topup_work",
        title: `Complete ${neededYrs} Year${neededYrs > 1 ? "s" : ""} of Skilled Work in New Zealand`,
        actionSummary: `Your ${current.breakdown.primaryAnchorPoints}-point primary skill anchor reaches the full 6-point residence threshold after ${neededYrs} year${neededYrs > 1 ? "s" : ""} on an Accredited Employer Work Visa (AEWV).`,
        pointsGain: gain,
        projectedTotal: sim.totalClaimablePoints,
        previewInput,
      });
    }
  }

  if (
    (input.nzHourlyWageNzd ?? 0) > 0 &&
    (input.nzHourlyWageNzd ?? 0) < 52.5 &&
    current.breakdown.primaryAnchorPoints === 0
  ) {
    const previewInput: NzSmcInput = {
      ...input,
      nzHourlyWageNzd: 52.5,
    };
    const sim = calculateNzSmc(previewInput);
    const gain = sim.totalClaimablePoints - current.totalClaimablePoints;
    if (gain > 0) {
      tips.push({
        id: "nz_1_5x_wage",
        title: "Reach 1.5× Median Wage (NZD $52.50/hr) Primary Income Anchor",
        actionSummary:
          "Without a Level 7+ degree or NZ registration, earning at least 1.5× the SMC median wage unlocks a 3-point primary skill anchor.",
        pointsGain: gain,
        projectedTotal: sim.totalClaimablePoints,
        previewInput,
      });
    }
  }

  return tips.slice(0, 3);
}
