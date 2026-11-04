/**
 * Germany Chancenkarte (Opportunity Card 6-Point System) & EU Blue Card Fast-Track PR Engine
 *
 * Statutory Basis:
 * 1. § 20a & § 20b AufenthG — Chancenkarte (Opportunity Card, minimum 6 points OR direct full German equivalence)
 *    - Mandatory § 20a(5) Points-Route Baseline: Recognized 2+ yr vocational/university credential,
 *      German A1+ OR English B2+, and financial self-sufficiency (~€1,091/mo Sperrkonto or <=20 hr/wk job).
 *    - Direct Fachkraft (§ 20a(4)): Full German equivalence waives BOTH the 6-point test and language floor.
 * 2. § 18g & § 18c(2) AufenthG — EU Blue Card (2026 thresholds: €50,700 standard / €45,934.20 shortage, IT & recent grads)
 *    leading to fast-track Permanent Settlement (Niederlassungserlaubnis) in 21 months (German B1+) or 27 months (German A1).
 *
 * Starts strictly at 0 points (all fields unselected, zero sample scenarios).
 */

export const DE_BLUE_CARD_STANDARD_2026 = 50700;
export const DE_BLUE_CARD_REDUCED_2026 = 45934.2;

export type DeQualificationStatus =
  | ""
  | "none_below_2yr"
  | "foreign_degree_or_2yr_vocational"
  | "partial_recognition_defizitbescheid"
  | "full_german_equivalence_fachkraft";

export type DeWorkExperienceBand = "" | "under_2yr" | "2_to_4yr_in_5" | "5yr_plus_in_7";

export type DeGermanLevel = "" | "none" | "a1" | "a2" | "b1" | "b2_or_higher";

export type DeEnglishLevel = "" | "below_b2" | "b2" | "c1_or_higher";

export type DeAgeBand = "" | "35_or_under" | "36_to_40" | "41_plus";

export interface GermanyPrInput {
  qualificationStatus: DeQualificationStatus;
  isShortageOccupationMangelberuf: boolean | null;
  workExperience: DeWorkExperienceBand;
  germanLevel: DeGermanLevel;
  englishLevel: DeEnglishLevel;
  ageBand: DeAgeBand;
  hasPrior6MonthLegalStayInGermany: boolean | null;
  partnerQualifiesAndAppliesTogether: boolean | null;
  hasFinancialProofSperrkonto: boolean | null;

  // Optional EU Blue Card & Fast-Track Settlement Evaluator
  germanJobOfferGrossEur: number | null;
  graduatedWithinLast3YearsOrItSpecialist: boolean | null;
}

export const DEFAULT_GERMANY_INPUT: GermanyPrInput = {
  qualificationStatus: "",
  isShortageOccupationMangelberuf: null,
  workExperience: "",
  germanLevel: "",
  englishLevel: "",
  ageBand: "",
  hasPrior6MonthLegalStayInGermany: null,
  partnerQualifiesAndAppliesTogether: null,
  hasFinancialProofSperrkonto: null,
  germanJobOfferGrossEur: null,
  graduatedWithinLast3YearsOrItSpecialist: null,
};

export interface GermanyPrResult {
  hasAnyInput: boolean;
  totalPoints: number;
  passMark: 6;
  qualifiesViaDirectFachkraftWaiver: boolean;
  meetsBaselinePrerequisites: boolean;
  prerequisiteGaps: string[];
  chancenkarteEligible: boolean;
  blueCard: {
    hasSalaryInput: boolean;
    requiredSalaryEur: number;
    usesReducedThreshold: boolean;
    eligibleForBlueCard: boolean;
    needsFullRecognitionForRegulatedRole: boolean;
    prMonthsTimeline: 21 | 27;
  };
  breakdown: {
    partialRecognition: number;
    shortageOccupation: number;
    workExperience: number;
    germanLanguage: number;
    englishLanguage: number;
    age: number;
    priorGermanStay: number;
    partnerBonus: number;
  };
}

export interface GermanyOptimizationTip {
  id: string;
  title: string;
  actionSummary: string;
  pointsGain: number;
  projectedTotal: number;
  previewInput: GermanyPrInput;
}

export function calculateGermanyPr(input: GermanyPrInput): GermanyPrResult {
  const hasAnyInput =
    input.qualificationStatus !== "" ||
    input.isShortageOccupationMangelberuf !== null ||
    input.workExperience !== "" ||
    input.germanLevel !== "" ||
    input.englishLevel !== "" ||
    input.ageBand !== "" ||
    input.hasPrior6MonthLegalStayInGermany !== null ||
    input.partnerQualifiesAndAppliesTogether !== null ||
    input.hasFinancialProofSperrkonto !== null ||
    input.germanJobOfferGrossEur !== null ||
    input.graduatedWithinLast3YearsOrItSpecialist !== null;

  // § 20b AufenthG Points Breakdown
  const partialRecognition =
    input.qualificationStatus === "partial_recognition_defizitbescheid" ? 4 : 0;

  const shortageOccupation = input.isShortageOccupationMangelberuf === true ? 1 : 0;

  const workMap: Record<DeWorkExperienceBand, number> = {
    "": 0,
    under_2yr: 0,
    "2_to_4yr_in_5": 2,
    "5yr_plus_in_7": 3,
  };
  const workExperience = workMap[input.workExperience];

  const germanMap: Record<DeGermanLevel, number> = {
    "": 0,
    none: 0,
    a1: 0,
    a2: 1,
    b1: 2,
    b2_or_higher: 3,
  };
  const germanLanguage = germanMap[input.germanLevel];

  const englishLanguage = input.englishLevel === "c1_or_higher" ? 1 : 0;

  const ageMap: Record<DeAgeBand, number> = {
    "": 0,
    "35_or_under": 2,
    "36_to_40": 1,
    "41_plus": 0,
  };
  const age = ageMap[input.ageBand];

  const priorGermanStay = input.hasPrior6MonthLegalStayInGermany === true ? 1 : 0;
  const partnerBonus = input.partnerQualifiesAndAppliesTogether === true ? 1 : 0;

  const totalPoints =
    partialRecognition +
    shortageOccupation +
    workExperience +
    germanLanguage +
    englishLanguage +
    age +
    priorGermanStay +
    partnerBonus;

  const qualifiesViaDirectFachkraftWaiver =
    input.qualificationStatus === "full_german_equivalence_fachkraft";

  // Baseline prerequisites for Points Route (§ 20a(5) AufenthG)
  const prerequisiteGaps: string[] = [];
  const hasBaseQual =
    input.qualificationStatus !== "" && input.qualificationStatus !== "none_below_2yr";

  if (hasAnyInput && !hasBaseQual) {
    prerequisiteGaps.push(
      "Base Qualification: Chancenkarte requires a state-recognized 2+ year vocational qualification or university degree."
    );
  }

  const meetsLangFloor =
    input.germanLevel === "a1" ||
    input.germanLevel === "a2" ||
    input.germanLevel === "b1" ||
    input.germanLevel === "b2_or_higher" ||
    input.englishLevel === "b2" ||
    input.englishLevel === "c1_or_higher";

  if (hasAnyInput && !qualifiesViaDirectFachkraftWaiver && !meetsLangFloor) {
    prerequisiteGaps.push(
      "Language Baseline: Points-route applicants must demonstrate at least German CEFR A1 OR English CEFR B2."
    );
  }

  if (hasAnyInput && input.hasFinancialProofSperrkonto !== true) {
    prerequisiteGaps.push(
      "Financial Self-Sufficiency: Confirm ~€1,091/month (€13,092/yr Sperrkonto) or a ≤20 hr/wk German part-time contract."
    );
  }

  const meetsBaselinePrerequisites =
    hasBaseQual &&
    (qualifiesViaDirectFachkraftWaiver || meetsLangFloor) &&
    input.hasFinancialProofSperrkonto === true;

  const chancenkarteEligible =
    meetsBaselinePrerequisites &&
    (qualifiesViaDirectFachkraftWaiver || totalPoints >= 6);

  // EU Blue Card 2026 & Fast-Track PR (Niederlassungserlaubnis)
  const usesReducedThreshold =
    input.isShortageOccupationMangelberuf === true ||
    input.graduatedWithinLast3YearsOrItSpecialist === true;
  const requiredSalaryEur = usesReducedThreshold
    ? DE_BLUE_CARD_REDUCED_2026
    : DE_BLUE_CARD_STANDARD_2026;

  const hasSalaryInput = input.germanJobOfferGrossEur !== null;
  const salaryMeetsBlueCard =
    hasSalaryInput && (input.germanJobOfferGrossEur ?? 0) >= requiredSalaryEur;
  const needsFullRecognitionForRegulatedRole =
    salaryMeetsBlueCard &&
    input.qualificationStatus === "partial_recognition_defizitbescheid" &&
    input.graduatedWithinLast3YearsOrItSpecialist !== true;

  const eligibleForBlueCard =
    salaryMeetsBlueCard &&
    (input.qualificationStatus === "full_german_equivalence_fachkraft" ||
      input.qualificationStatus === "foreign_degree_or_2yr_vocational" ||
      input.graduatedWithinLast3YearsOrItSpecialist === true);

  const prMonthsTimeline: 21 | 27 =
    input.germanLevel === "b1" || input.germanLevel === "b2_or_higher" ? 21 : 27;

  return {
    hasAnyInput,
    totalPoints,
    passMark: 6,
    qualifiesViaDirectFachkraftWaiver,
    meetsBaselinePrerequisites,
    prerequisiteGaps,
    chancenkarteEligible,
    blueCard: {
      hasSalaryInput,
      requiredSalaryEur,
      usesReducedThreshold,
      eligibleForBlueCard,
      needsFullRecognitionForRegulatedRole,
      prMonthsTimeline,
    },
    breakdown: {
      partialRecognition,
      shortageOccupation,
      workExperience,
      germanLanguage,
      englishLanguage,
      age,
      priorGermanStay,
      partnerBonus,
    },
  };
}

export function generateGermanyTips(
  input: GermanyPrInput,
  current: GermanyPrResult
): GermanyOptimizationTip[] {
  if (!current.hasAnyInput || current.qualifiesViaDirectFachkraftWaiver) return [];
  const tips: GermanyOptimizationTip[] = [];

  if (input.germanLevel !== "b1" && input.germanLevel !== "b2_or_higher") {
    const previewB1: GermanyPrInput = { ...input, germanLevel: "b1" };
    const sim = calculateGermanyPr(previewB1);
    const gain = sim.totalPoints - current.totalPoints;
    if (gain > 0) {
      tips.push({
        id: "de_german_b1",
        title: "Reach German CEFR B1 (+2 Chancenkarte pts & 21-Month Fast-Track PR)",
        actionSummary:
          "German B1 adds +2 Opportunity Card points AND cuts EU Blue Card Permanent Residence (Niederlassungserlaubnis) from 27 months down to 21 months.",
        pointsGain: gain,
        projectedTotal: sim.totalPoints,
        previewInput: previewB1,
      });
    }
  }

  if (input.englishLevel !== "c1_or_higher") {
    const previewC1: GermanyPrInput = { ...input, englishLevel: "c1_or_higher" };
    const sim = calculateGermanyPr(previewC1);
    const gain = sim.totalPoints - current.totalPoints;
    if (gain > 0) {
      tips.push({
        id: "de_english_c1",
        title: "Certify English at CEFR C1 (IELTS 7.0+ / TOEFL 95+ -> +1 pt)",
        actionSummary:
          "English C1 satisfies the mandatory language baseline on its own AND awards +1 bonus point under § 20b AufenthG.",
        pointsGain: gain,
        projectedTotal: sim.totalPoints,
        previewInput: previewC1,
      });
    }
  }

  return tips.sort((a, b) => b.pointsGain - a.pointsGain).slice(0, 3);
}
