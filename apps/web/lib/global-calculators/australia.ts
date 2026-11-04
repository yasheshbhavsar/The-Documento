/**
 * Australia SkillSelect General Skilled Migration (GSM) PR Points Engine
 *
 * Statutory Basis: Migration Regulations 1994 — Schedule 6D (Department of Home Affairs, 2026)
 * Covers:
 * - Subclass 189 (Skilled Independent Visa — Permanent Residence • +0 nomination pts)
 * - Subclass 190 (Skilled Nominated Visa — Permanent Residence • +5 state nomination pts)
 * - Subclass 491 (Skilled Work Regional Provisional -> Subclass 191 PR • +15 regional/family pts)
 *
 * Audited Statutory Nuances:
 * - Combined Overseas (max 15) + Australian (max 20) skilled employment strictly capped at 20 pts (Items 6D31–6D44)
 * - Specialist Educational Qualification (Part 6D.7A Item 6D7A1): Australian Master's by Research or Doctorate
 *   in designated STEM/ICT fields (>= 2 academic years in Australia) awards +10 points
 * - Regional Australia Study (+5 pts) requires meeting the 2-year Australian Study Requirement
 * - Strict age < 45 at invitation and minimum Competent English statutory gates
 *
 * Starts strictly at 0 points (all fields unselected, zero sample scenarios).
 */

export type AuVisaSubclass = "subclass_189" | "subclass_190" | "subclass_491";

export type AuAgeBand = "" | "18_to_24" | "25_to_32" | "33_to_39" | "40_to_44" | "45_plus";

export type AuEnglishLevel =
  | ""
  | "below_competent"
  | "competent"
  | "proficient"
  | "superior";

export type AuOverseasWorkBand = "" | "under_3yr" | "3_to_4yr" | "5_to_7yr" | "8yr_plus";

export type AuLocalWorkBand =
  | ""
  | "under_1yr"
  | "1_to_2yr"
  | "3_to_4yr"
  | "5_to_7yr"
  | "8yr_plus";

export type AuEducationTier =
  | ""
  | "none_or_secondary"
  | "diploma_or_trade"
  | "bachelors_or_masters"
  | "doctorate_phd";

export type AuPartnerSkillsTier =
  | ""
  | "single_or_au_citizen_pr_partner"
  | "partner_skilled_and_competent_english"
  | "partner_competent_english_only"
  | "partner_ineligible";

export interface AuSkillSelectInput {
  activeSubclass: AuVisaSubclass;
  ageBand: AuAgeBand;
  englishLevel: AuEnglishLevel;
  overseasWork: AuOverseasWorkBand;
  australianWork: AuLocalWorkBand;
  educationTier: AuEducationTier;
  meetsAustralianStudyRequirement: boolean | null;
  hasSpecialistStemResearchQualification: boolean | null;
  hasCredentialedCommunityLanguageNaati: boolean | null;
  hasProfessionalYearInAustralia: boolean | null;
  hasRegionalAustraliaStudy: boolean | null;
  partnerTier: AuPartnerSkillsTier;
}

export const DEFAULT_AU_INPUT: AuSkillSelectInput = {
  activeSubclass: "subclass_189",
  ageBand: "",
  englishLevel: "",
  overseasWork: "",
  australianWork: "",
  educationTier: "",
  meetsAustralianStudyRequirement: null,
  hasSpecialistStemResearchQualification: null,
  hasCredentialedCommunityLanguageNaati: null,
  hasProfessionalYearInAustralia: null,
  hasRegionalAustraliaStudy: null,
  partnerTier: "",
};

export interface AuSkillSelectResult {
  activeSubclass: AuVisaSubclass;
  hasAnyInput: boolean;
  totalScore: number;
  passMark: 65;
  meetsPassMark: boolean;
  eligibleToSubmitEoi: boolean;
  ineligibilityReasons: string[];
  advisoryNotes: string[];
  scoresBySubclass: Record<AuVisaSubclass, number>;
  breakdown: {
    age: number;
    english: number;
    overseasEmploymentRaw: number;
    australianEmploymentRaw: number;
    combinedEmploymentCapped: number;
    education: number;
    australianStudy: number;
    specialistStem: number;
    naatiCcl: number;
    professionalYear: number;
    regionalStudy: number;
    partnerSkills: number;
    nominationPoints: number;
  };
}

export interface AuOptimizationTip {
  id: string;
  title: string;
  actionSummary: string;
  pointsGain: number;
  projectedTotal: number;
  previewInput: AuSkillSelectInput;
}

export function calculateAustraliaSkillSelect(input: AuSkillSelectInput): AuSkillSelectResult {
  const hasAnyInput =
    input.ageBand !== "" ||
    input.englishLevel !== "" ||
    input.overseasWork !== "" ||
    input.australianWork !== "" ||
    input.educationTier !== "" ||
    input.meetsAustralianStudyRequirement !== null ||
    input.hasSpecialistStemResearchQualification !== null ||
    input.hasCredentialedCommunityLanguageNaati !== null ||
    input.hasProfessionalYearInAustralia !== null ||
    input.hasRegionalAustraliaStudy !== null ||
    input.partnerTier !== "";

  const ageMap: Record<AuAgeBand, number> = {
    "": 0,
    "18_to_24": 25,
    "25_to_32": 30,
    "33_to_39": 25,
    "40_to_44": 15,
    "45_plus": 0,
  };
  const agePts = ageMap[input.ageBand];

  const engMap: Record<AuEnglishLevel, number> = {
    "": 0,
    below_competent: 0,
    competent: 0,
    proficient: 10,
    superior: 20,
  };
  const englishPts = engMap[input.englishLevel];

  const overseasMap: Record<AuOverseasWorkBand, number> = {
    "": 0,
    under_3yr: 0,
    "3_to_4yr": 5,
    "5_to_7yr": 10,
    "8yr_plus": 15,
  };
  const overseasRaw = overseasMap[input.overseasWork];

  const localMap: Record<AuLocalWorkBand, number> = {
    "": 0,
    under_1yr: 0,
    "1_to_2yr": 5,
    "3_to_4yr": 10,
    "5_to_7yr": 15,
    "8yr_plus": 20,
  };
  const localRaw = localMap[input.australianWork];

  // Schedule 6D Item 6D31/6D41: Combined Overseas + Australian skilled employment cannot exceed 20 points
  const combinedEmploymentCapped = Math.min(20, overseasRaw + localRaw);

  const eduMap: Record<AuEducationTier, number> = {
    "": 0,
    none_or_secondary: 0,
    diploma_or_trade: 10,
    bachelors_or_masters: 15,
    doctorate_phd: 20,
  };
  const eduPts = eduMap[input.educationTier];

  const auStudyPts = input.meetsAustralianStudyRequirement === true ? 5 : 0;

  // Schedule 6D Part 6D.7A Item 6D7A1: Specialist Educational Qualification = 10 points
  // Requires an Australian Master's by Research or Doctorate (>= 2 academic years in Australia) in STEM/ICT.
  const advisoryNotes: string[] = [];
  let stemPts = 0;
  const educationContradictsPostgradResearch =
    input.educationTier === "none_or_secondary" || input.educationTier === "diploma_or_trade";

  if (input.hasSpecialistStemResearchQualification === true) {
    if (input.meetsAustralianStudyRequirement === false || educationContradictsPostgradResearch) {
      advisoryNotes.push(
        "Schedule 6D Part 6D.7A Note: Specialist STEM Research points (+10) require an Australian Master's by Research or Doctoral degree of at least 2 academic years."
      );
    } else {
      stemPts = 10;
    }
  }

  if (input.hasRegionalAustraliaStudy === true && input.meetsAustralianStudyRequirement !== true) {
    advisoryNotes.push(
      "Schedule 6D Item 6D101 Note: Regional Australia Study points (+5) require also confirming 'Yes' to the 2-year Australian Study Requirement."
    );
  }

  if (overseasRaw + localRaw > 20) {
    advisoryNotes.push(
      `Employment Cap Applied: ${overseasRaw} overseas + ${localRaw} Australian skilled work points capped at the statutory maximum of 20 points.`
    );
  }

  const naatiPts = input.hasCredentialedCommunityLanguageNaati === true ? 5 : 0;
  const profYearPts = input.hasProfessionalYearInAustralia === true ? 5 : 0;
  const regionalStudyPts =
    input.meetsAustralianStudyRequirement === true && input.hasRegionalAustraliaStudy === true
      ? 5
      : 0;

  const partnerMap: Record<AuPartnerSkillsTier, number> = {
    "": 0,
    single_or_au_citizen_pr_partner: 10,
    partner_skilled_and_competent_english: 10,
    partner_competent_english_only: 5,
    partner_ineligible: 0,
  };
  const partnerPts = partnerMap[input.partnerTier];

  const baseScore189 =
    agePts +
    englishPts +
    combinedEmploymentCapped +
    eduPts +
    auStudyPts +
    stemPts +
    naatiPts +
    profYearPts +
    regionalStudyPts +
    partnerPts;

  const scoresBySubclass: Record<AuVisaSubclass, number> = !hasAnyInput
    ? {
        subclass_189: 0,
        subclass_190: 0,
        subclass_491: 0,
      }
    : {
        subclass_189: baseScore189,
        subclass_190: baseScore189 + 5,
        subclass_491: baseScore189 + 15,
      };

  const nominationPoints = !hasAnyInput
    ? 0
    : input.activeSubclass === "subclass_491"
      ? 15
      : input.activeSubclass === "subclass_190"
        ? 5
        : 0;

  const totalScore = scoresBySubclass[input.activeSubclass];

  const ineligibilityReasons: string[] = [];
  if (input.ageBand === "45_plus") {
    ineligibilityReasons.push(
      "Age Cutoff: Applicants aged 45 or older at the time of invitation are statutorily ineligible for Subclasses 189, 190, and 491."
    );
  }
  if (input.englishLevel === "below_competent") {
    ineligibilityReasons.push(
      "Minimum English Requirement: At least Competent English (IELTS 6.0 / PTE 50 in every band, or eligible passport) is mandatory."
    );
  }

  const meetsPassMark = totalScore >= 65;
  const eligibleToSubmitEoi =
    hasAnyInput &&
    meetsPassMark &&
    input.ageBand !== "45_plus" &&
    input.englishLevel !== "below_competent";

  return {
    activeSubclass: input.activeSubclass,
    hasAnyInput,
    totalScore,
    passMark: 65,
    meetsPassMark,
    eligibleToSubmitEoi,
    ineligibilityReasons,
    advisoryNotes,
    scoresBySubclass,
    breakdown: {
      age: agePts,
      english: englishPts,
      overseasEmploymentRaw: overseasRaw,
      australianEmploymentRaw: localRaw,
      combinedEmploymentCapped,
      education: eduPts,
      australianStudy: auStudyPts,
      specialistStem: stemPts,
      naatiCcl: naatiPts,
      professionalYear: profYearPts,
      regionalStudy: regionalStudyPts,
      partnerSkills: partnerPts,
      nominationPoints,
    },
  };
}

export function generateAustraliaTips(
  input: AuSkillSelectInput,
  current: AuSkillSelectResult
): AuOptimizationTip[] {
  if (!current.hasAnyInput || current.totalScore === 0) return [];
  const tips: AuOptimizationTip[] = [];

  if (input.englishLevel !== "superior") {
    const previewInput: AuSkillSelectInput = { ...input, englishLevel: "superior" };
    const sim = calculateAustraliaSkillSelect(previewInput);
    const gain = sim.totalScore - current.totalScore;
    if (gain > 0) {
      tips.push({
        id: "au_superior_english",
        title: "Achieve Superior English (IELTS 8.0 / PTE 79+ All Bands)",
        actionSummary:
          "Superior English awards the maximum 20 English points on Schedule 6D — often the single decisive factor in Subclass 189/190 invitation rounds.",
        pointsGain: gain,
        projectedTotal: sim.totalScore,
        previewInput,
      });
    }
  }

  if (input.activeSubclass === "subclass_189") {
    const preview491: AuSkillSelectInput = { ...input, activeSubclass: "subclass_491" };
    const sim491 = calculateAustraliaSkillSelect(preview491);
    const gain = sim491.totalScore - current.totalScore;
    if (gain > 0) {
      tips.push({
        id: "au_subclass_491",
        title: "Apply for Regional State Nomination — Subclass 491 (+15 pts)",
        actionSummary:
          "State/territory regional nomination adds +15 points immediately and transitions to permanent residence (Subclass 191) after 3 years in regional Australia.",
        pointsGain: gain,
        projectedTotal: sim491.totalScore,
        previewInput: preview491,
      });
    }
  }

  if (input.hasCredentialedCommunityLanguageNaati !== true) {
    const previewNaati: AuSkillSelectInput = {
      ...input,
      hasCredentialedCommunityLanguageNaati: true,
    };
    const sim = calculateAustraliaSkillSelect(previewNaati);
    const gain = sim.totalScore - current.totalScore;
    if (gain > 0) {
      tips.push({
        id: "au_naati_ccl",
        title: "Pass the NAATI Credentialed Community Language (CCL) Test (+5 pts)",
        actionSummary:
          "Passing NAATI CCL in an approved community language adds +5 Schedule 6D points without requiring employer sponsorship.",
        pointsGain: gain,
        projectedTotal: sim.totalScore,
        previewInput: previewNaati,
      });
    }
  }

  return tips.sort((a, b) => b.pointsGain - a.pointsGain).slice(0, 3);
}
