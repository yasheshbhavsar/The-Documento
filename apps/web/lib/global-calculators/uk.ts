/**
 * United Kingdom Skilled Worker (70-Point System) & 5-Year ILR Settlement Engine
 *
 * Statutory Basis: UK Home Office Immigration Rules — Appendix Skilled Worker & Settlement (2026 Standard)
 * - 50 Mandatory Non-Tradeable Points:
 *   1. Valid Certificate of Sponsorship (CoS) from licensed sponsor (20 pts)
 *   2. Eligible Skill Level — RQF Level 6+ or eligible ISL / Health & Care / Transitional role (20 pts)
 *   3. English Language Proficiency — CEFR B2 (new 2026 standard) / B1 transitional extensions (10 pts)
 * - 20 Tradeable Salary & Qualification Points (Options A–E, Transitional Option F & Health/Care):
 *   - Option A Standard: >= max(£41,700, pro-rated 100% SOC Going Rate, £17.13/hr floor) -> 20 pts
 *   - Option B Relevant PhD (Non-STEM): >= max(£37,500, pro-rated 90% Going Rate) -> 10 PhD + 10 Salary = 20 pts
 *   - Option C Relevant STEM PhD: >= max(£33,400, pro-rated 80% Going Rate) -> 20 pts
 *   - Option D Immigration Salary List (ISL): >= max(£33,400, pro-rated 100% Going Rate) -> 20 pts
 *   - Option E New Entrant (<26 / UK Graduate / Postdoc): >= max(£33,400, pro-rated 70% Going Rate) -> 20 pts
 *   - Transitional Pre-4 April 2024 Cohort (Option F): >= max(£31,300, pro-rated lower Going Rate) -> 20 pts
 *   - Health & Care / National Pay Scale: >= £25,000 (or national pay band) -> 20 pts
 * - Pro-rates SOC 2020 Going Rates against a 37.5-hour baseline week and checks the £17.13/hr statutory hourly minimum
 *   (counting at most 48 contracted hours/week per SW 14.3).
 *
 * Starts strictly at 0 points (all fields unselected, zero sample scenarios).
 */

export const UK_HOURLY_FLOOR_STANDARD_2026 = 17.13;

export type UkTradeableCategory =
  | ""
  | "option_a_standard"
  | "option_b_phd_general"
  | "option_c_phd_stem"
  | "option_d_immigration_salary_list"
  | "option_e_new_entrant"
  | "transitional_pre_apr_2024"
  | "health_and_care_scale";

export type UkContinuousResidenceYears = "" | "0_to_2yr" | "3_to_4yr" | "5yr_plus";

export interface UkSkilledWorkerInput {
  hasValidCosFromLicensedSponsor: boolean | null;
  meetsEligibleRqfSkillLevel: boolean | null;
  meetsEnglishCefrRequirement: boolean | null;
  tradeableCategory: UkTradeableCategory;
  annualSalaryGbp: number | null;
  occupationGoingRateGbp: number | null;
  weeklyContractHours?: number | null;
  ukResidenceYears: UkContinuousResidenceYears;
  passedLifeInUkAndAbsencesUnder180: boolean | null;
}

export const DEFAULT_UK_INPUT: UkSkilledWorkerInput = {
  hasValidCosFromLicensedSponsor: null,
  meetsEligibleRqfSkillLevel: null,
  meetsEnglishCefrRequirement: null,
  tradeableCategory: "",
  annualSalaryGbp: null,
  occupationGoingRateGbp: null,
  weeklyContractHours: null,
  ukResidenceYears: "",
  passedLifeInUkAndAbsencesUnder180: null,
};

export interface UkSkilledWorkerResult {
  hasAnyInput: boolean;
  totalPoints: number;
  passMark: 70;
  visaEligible: boolean;
  requiredVisaSalaryGbp: number;
  requiredIlrSalaryGbp: number;
  salaryShortfallGbp: number;
  effectiveHourlyRateGbp: number | null;
  hourlyFloorMet: boolean;
  ilrReadyNow: boolean;
  ilrSalaryWarning: string | null;
  breakdown: {
    sponsorshipCos: number;
    skillLevel: number;
    englishLanguage: number;
    mandatorySubtotal: number;
    tradeablePoints: number;
  };
}

export interface UkOptimizationTip {
  id: string;
  title: string;
  actionSummary: string;
  pointsGain: number;
  projectedTotal: number;
  previewInput: UkSkilledWorkerInput;
}

export function getUkRequiredSalaryFloor(
  category: UkTradeableCategory,
  goingRateInput: number | null,
  weeklyContractHours: number | null = null
): number {
  const hours = weeklyContractHours && weeklyContractHours > 0 ? weeklyContractHours : 37.5;
  const proRataFactor = hours / 37.5;
  const baseGoingRate = goingRateInput && goingRateInput > 0 ? goingRateInput : 41700;
  const proRatedGoingRate = Math.round(baseGoingRate * proRataFactor);

  // Per SW 8.2–12.3 & SW 14.3:
  // 1) £17.13/hr minimum applies across all contracted hours on Options A–E
  // 2) Only the first 48 weekly hours count toward satisfying the flat general threshold (£41,700 / £37,500 / £33,400),
  //    so working >48 hrs/wk scales the gross annual salary needed to clear the 48-hour general floor.
  const hourlyFloorAnnualized = Math.ceil(UK_HOURLY_FLOOR_STANDARD_2026 * hours * 52);
  const over48GeneralMultiplier = hours > 48 ? hours / 48 : 1;
  const scaleGeneralForHours = (baseGeneral: number) =>
    Math.ceil(baseGeneral * over48GeneralMultiplier);

  switch (category) {
    case "option_a_standard":
      return Math.max(
        scaleGeneralForHours(41700),
        proRatedGoingRate,
        hours > 37.5 ? hourlyFloorAnnualized : 41700
      );
    case "option_b_phd_general":
      return Math.max(
        scaleGeneralForHours(37500),
        Math.round(proRatedGoingRate * 0.9),
        hours > 37.5 ? hourlyFloorAnnualized : 37500
      );
    case "option_c_phd_stem":
      return Math.max(
        scaleGeneralForHours(33400),
        Math.round(proRatedGoingRate * 0.8),
        hours > 37.5 ? hourlyFloorAnnualized : 33400
      );
    case "option_d_immigration_salary_list":
      return Math.max(
        scaleGeneralForHours(33400),
        proRatedGoingRate,
        hours > 37.5 ? hourlyFloorAnnualized : 33400
      );
    case "option_e_new_entrant":
      return Math.max(
        scaleGeneralForHours(33400),
        Math.round(proRatedGoingRate * 0.7),
        hours > 37.5 ? hourlyFloorAnnualized : 33400
      );
    case "transitional_pre_apr_2024":
      return Math.max(
        scaleGeneralForHours(31300),
        goingRateInput && goingRateInput > 0 ? proRatedGoingRate : 31300
      );
    case "health_and_care_scale":
      return goingRateInput && goingRateInput > 0
        ? Math.max(scaleGeneralForHours(25000), proRatedGoingRate)
        : scaleGeneralForHours(25000);
    default:
      return 41700;
  }
}

export function calculateUkSkilledWorker(input: UkSkilledWorkerInput): UkSkilledWorkerResult {
  const hasAnyInput =
    input.hasValidCosFromLicensedSponsor !== null ||
    input.meetsEligibleRqfSkillLevel !== null ||
    input.meetsEnglishCefrRequirement !== null ||
    input.tradeableCategory !== "" ||
    input.annualSalaryGbp !== null ||
    input.occupationGoingRateGbp !== null ||
    (input.weeklyContractHours !== undefined && input.weeklyContractHours !== null) ||
    input.ukResidenceYears !== "" ||
    input.passedLifeInUkAndAbsencesUnder180 !== null;

  const sponsorshipCos = input.hasValidCosFromLicensedSponsor === true ? 20 : 0;
  const skillLevel = input.meetsEligibleRqfSkillLevel === true ? 20 : 0;
  const englishLanguage = input.meetsEnglishCefrRequirement === true ? 10 : 0;
  const mandatorySubtotal = sponsorshipCos + skillLevel + englishLanguage;

  const effectiveCategory: UkTradeableCategory =
    input.tradeableCategory || (input.annualSalaryGbp !== null ? "option_a_standard" : "");

  const hours =
    input.weeklyContractHours && input.weeklyContractHours > 0
      ? input.weeklyContractHours
      : 37.5;

  const requiredVisaSalaryGbp = getUkRequiredSalaryFloor(
    effectiveCategory,
    input.occupationGoingRateGbp,
    hours
  );

  // Per SW 8.2–12.3 & SW 14.3, the £17.13/hr statutory hourly minimum applies across standard Options A–E
  const effectiveHourlyRateGbp =
    input.annualSalaryGbp !== null
      ? Number((input.annualSalaryGbp / (hours * 52)).toFixed(2))
      : null;

  const requires1713Hourly =
    effectiveCategory === "option_a_standard" ||
    effectiveCategory === "option_b_phd_general" ||
    effectiveCategory === "option_c_phd_stem" ||
    effectiveCategory === "option_d_immigration_salary_list" ||
    effectiveCategory === "option_e_new_entrant";
  const hourlyFloorMet =
    effectiveHourlyRateGbp === null ||
    !requires1713Hourly ||
    effectiveHourlyRateGbp >= UK_HOURLY_FLOOR_STANDARD_2026;

  let tradeablePoints = 0;
  if (effectiveCategory !== "" && input.annualSalaryGbp !== null) {
    if (input.annualSalaryGbp >= requiredVisaSalaryGbp && hourlyFloorMet) {
      tradeablePoints = 20;
    } else if (effectiveCategory === "option_b_phd_general") {
      tradeablePoints = 10;
    }
  }

  const totalPoints = mandatorySubtotal + tradeablePoints;
  const visaEligible =
    sponsorshipCos === 20 &&
    skillLevel === 20 &&
    englishLanguage === 10 &&
    tradeablePoints === 20;

  const salaryShortfallGbp =
    input.annualSalaryGbp !== null
      ? Math.max(0, requiredVisaSalaryGbp - input.annualSalaryGbp)
      : requiredVisaSalaryGbp;

  // ILR (Settlement) Salary Rule (Appendix Skilled Worker SW 24.3):
  // - Option D (Immigration Salary List / former SOL), Transitional Pre-4 Apr 2024, and Health & Care retain their
  //   category settlement general thresholds (£33,400 + 100% going rate for ISL; £31,300 transitional; £25,000 Health/Care).
  // - Option B/C (PhD) and Option E (New Entrant) discounts DO NOT apply at settlement — ILR requires >= max(£41,700, 100% going rate, £17.13/hr).
  const requiredIlrSalaryGbp =
    effectiveCategory === "option_d_immigration_salary_list" ||
    effectiveCategory === "health_and_care_scale" ||
    effectiveCategory === "transitional_pre_apr_2024"
      ? requiredVisaSalaryGbp
      : getUkRequiredSalaryFloor("option_a_standard", input.occupationGoingRateGbp, hours);

  const meetsIlrSalary =
    input.annualSalaryGbp !== null && input.annualSalaryGbp >= requiredIlrSalaryGbp;

  let ilrSalaryWarning: string | null = null;
  if (
    visaEligible &&
    !meetsIlrSalary &&
    effectiveCategory !== "option_d_immigration_salary_list" &&
    effectiveCategory !== "health_and_care_scale" &&
    effectiveCategory !== "transitional_pre_apr_2024"
  ) {
    ilrSalaryWarning = `ILR Settlement Advisory (SW 24.3): Discounted ${
      effectiveCategory === "option_e_new_entrant" ? "New Entrant" : "PhD"
    } thresholds qualify you for your Skilled Worker visa now, but 5-year Indefinite Leave to Remain (ILR) requires at least £${requiredIlrSalaryGbp.toLocaleString()}/yr at settlement.`;
  }

  const ilrReadyNow =
    visaEligible &&
    meetsIlrSalary &&
    input.ukResidenceYears === "5yr_plus" &&
    input.passedLifeInUkAndAbsencesUnder180 === true;

  return {
    hasAnyInput,
    totalPoints,
    passMark: 70,
    visaEligible,
    requiredVisaSalaryGbp,
    requiredIlrSalaryGbp,
    salaryShortfallGbp,
    effectiveHourlyRateGbp,
    hourlyFloorMet,
    ilrReadyNow,
    ilrSalaryWarning,
    breakdown: {
      sponsorshipCos,
      skillLevel,
      englishLanguage,
      mandatorySubtotal,
      tradeablePoints,
    },
  };
}

export function generateUkTips(
  input: UkSkilledWorkerInput,
  current: UkSkilledWorkerResult
): UkOptimizationTip[] {
  if (!current.hasAnyInput || current.visaEligible) return [];
  const tips: UkOptimizationTip[] = [];

  if (current.breakdown.tradeablePoints < 20 && input.annualSalaryGbp !== null) {
    const previewNewEntrant: UkSkilledWorkerInput = {
      ...input,
      tradeableCategory: "option_e_new_entrant",
    };
    const simNe = calculateUkSkilledWorker(previewNewEntrant);
    if (simNe.totalPoints > current.totalPoints) {
      tips.push({
        id: "uk_new_entrant_discount",
        title: "Check Option E New Entrant Eligibility (Under 26 or UK Graduate Switcher)",
        actionSummary: `Qualifying as a New Entrant reduces the going-rate threshold to 70% (min £33,400/yr) for up to 4 years.`,
        pointsGain: simNe.totalPoints - current.totalPoints,
        projectedTotal: simNe.totalPoints,
        previewInput: previewNewEntrant,
      });
    }

    const previewRaise: UkSkilledWorkerInput = {
      ...input,
      tradeableCategory: input.tradeableCategory || "option_a_standard",
      annualSalaryGbp: current.requiredVisaSalaryGbp,
    };
    const simRaise = calculateUkSkilledWorker(previewRaise);
    if (simRaise.totalPoints > current.totalPoints) {
      tips.push({
        id: "uk_meet_salary_floor",
        title: `Meet the £${current.requiredVisaSalaryGbp.toLocaleString()}/yr Guaranteed Base Salary Floor`,
        actionSummary: `Negotiating base pay up by £${current.salaryShortfallGbp.toLocaleString()}/yr unlocks all 20 Tradeable Salary Points.`,
        pointsGain: simRaise.totalPoints - current.totalPoints,
        projectedTotal: simRaise.totalPoints,
        previewInput: previewRaise,
      });
    }
  }

  return tips.slice(0, 3);
}
