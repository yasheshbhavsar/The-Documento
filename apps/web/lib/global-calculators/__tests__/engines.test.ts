import { describe, it, expect } from "vitest";
import {
  ALL_GLOBAL_CALCULATORS,
  CALCULATOR_COUNTRY_GROUPS,
} from "../../calculators/catalog";
import {
  calculateAustraliaSkillSelect,
  DEFAULT_AU_INPUT,
} from "../australia";
import {
  calculateNzSmc,
  DEFAULT_NZ_INPUT,
  generateNzTips,
  NZ_SMC_MEDIAN_WAGE_2026,
} from "../newZealand";
import {
  calculateUkSkilledWorker,
  DEFAULT_UK_INPUT,
  getUkRequiredSalaryFloor,
  UK_HOURLY_FLOOR_STANDARD_2026,
} from "../uk";
import {
  calculateGermanyPr,
  DE_BLUE_CARD_REDUCED_2026,
  DE_BLUE_CARD_STANDARD_2026,
  DEFAULT_GERMANY_INPUT,
} from "../germany";

describe("Global PR Calculators Country Catalog & 4 Statutory Engines (2026 Audited)", () => {
  it("groups all 6 PR & skilled migration calculators cleanly across 5 countries", () => {
    expect(CALCULATOR_COUNTRY_GROUPS.map((g) => g.countryId)).toEqual([
      "canada",
      "australia",
      "new_zealand",
      "united_kingdom",
      "germany",
    ]);
    expect(ALL_GLOBAL_CALCULATORS.length).toBe(6);
  });

  it("enforces strict 0-point default state across Australia, New Zealand, UK, and Germany", () => {
    const auZero = calculateAustraliaSkillSelect(DEFAULT_AU_INPUT);
    expect(auZero.hasAnyInput).toBe(false);
    expect(auZero.totalScore).toBe(0);
    expect(auZero.scoresBySubclass).toEqual({
      subclass_189: 0,
      subclass_190: 0,
      subclass_491: 0,
    });

    const nzZero = calculateNzSmc(DEFAULT_NZ_INPUT);
    expect(nzZero.hasAnyInput).toBe(false);
    expect(nzZero.totalClaimablePoints).toBe(0);

    const ukZero = calculateUkSkilledWorker(DEFAULT_UK_INPUT);
    expect(ukZero.hasAnyInput).toBe(false);
    expect(ukZero.totalPoints).toBe(0);

    const deZero = calculateGermanyPr(DEFAULT_GERMANY_INPUT);
    expect(deZero.hasAnyInput).toBe(false);
    expect(deZero.totalPoints).toBe(0);
  });

  it("calculates Australia Schedule 6D accurately including +10 Specialist STEM Research, 20-pt employment cap advisory, and age 45+ gate", () => {
    const res = calculateAustraliaSkillSelect({
      ...DEFAULT_AU_INPUT,
      activeSubclass: "subclass_189",
      ageBand: "25_to_32",
      englishLevel: "proficient",
      overseasWork: "8yr_plus",
      australianWork: "5_to_7yr",
      educationTier: "bachelors_or_masters",
      meetsAustralianStudyRequirement: true,
      hasSpecialistStemResearchQualification: true,
      partnerTier: "single_or_au_citizen_pr_partner",
    });

    // Age (30) + Proficient (10) + Work Capped (20) + Masters (15) + AU Study (5) + Specialist STEM Research (10) + Single (10) = 100
    expect(res.breakdown.overseasEmploymentRaw).toBe(15);
    expect(res.breakdown.australianEmploymentRaw).toBe(15);
    expect(res.breakdown.combinedEmploymentCapped).toBe(20);
    expect(res.breakdown.specialistStem).toBe(10);
    expect(res.scoresBySubclass.subclass_189).toBe(100);
    expect(res.scoresBySubclass.subclass_190).toBe(105);
    expect(res.scoresBySubclass.subclass_491).toBe(115);
    expect(res.advisoryNotes.some((n) => n.includes("statutory maximum of 20 points"))).toBe(true);
    expect(res.eligibleToSubmitEoi).toBe(true);

    // Part 6D.7A STEM points blocked if Australian Study Requirement is explicitly false OR education is Diploma/Trade
    const stemBlocked = calculateAustraliaSkillSelect({
      ...DEFAULT_AU_INPUT,
      meetsAustralianStudyRequirement: false,
      hasSpecialistStemResearchQualification: true,
    });
    expect(stemBlocked.breakdown.specialistStem).toBe(0);
    expect(stemBlocked.advisoryNotes.some((n) => n.includes("Part 6D.7A"))).toBe(true);

    const stemBlockedByDiploma = calculateAustraliaSkillSelect({
      ...DEFAULT_AU_INPUT,
      educationTier: "diploma_or_trade",
      meetsAustralianStudyRequirement: true,
      hasSpecialistStemResearchQualification: true,
    });
    expect(stemBlockedByDiploma.breakdown.specialistStem).toBe(0);
    expect(stemBlockedByDiploma.advisoryNotes.some((n) => n.includes("Part 6D.7A"))).toBe(true);

    // Age 45+ is statutorily ineligible even if points >= 65
    const overAge = calculateAustraliaSkillSelect({
      ...DEFAULT_AU_INPUT,
      activeSubclass: "subclass_491",
      ageBand: "45_plus",
      englishLevel: "superior",
      australianWork: "8yr_plus",
      educationTier: "doctorate_phd",
      partnerTier: "single_or_au_citizen_pr_partner",
    });
    expect(overAge.totalScore).toBe(85);
    expect(overAge.eligibleToSubmitEoi).toBe(false);
  });

  it("calculates New Zealand Aug 24, 2026 SMC rules: Master's Bachelor nuance, Amber List 1.2x wage, Trades pathway, and 3-pt anchor tips", () => {
    expect(NZ_SMC_MEDIAN_WAGE_2026).toBe(35.0);

    // Overseas Bachelor (4) + 1.5x wage ($52.50 -> 3) -> Non-stacking takes max(4, 3) = 4 + 2yr NZ work (+2) = 6 pts!
    const sixPt = calculateNzSmc({
      ...DEFAULT_NZ_INPUT,
      ageStatus: "under_56_eligible",
      hasEnglishIelts65OrEquivalent: true,
      hasAccreditedNzJobOrOffer: true,
      anzscoSkillTier: "anzsco_1_to_3",
      nzHourlyWageNzd: 52.5,
      qualificationTier: "overseas_bachelor_or_level_8",
      nzSkilledWorkYears: "2yr",
    });
    expect(sixPt.breakdown.primaryAnchorPoints).toBe(4);
    expect(sixPt.totalClaimablePoints).toBe(6);
    expect(sixPt.meetsSixPointRoute).toBe(true);

    // NZ Master's without prior Bachelor's gets 5 pts vs 6 pts with prior Bachelor's + 30 wks FT study
    const nzMastersNoBach = calculateNzSmc({
      ...DEFAULT_NZ_INPUT,
      qualificationTier: "nz_masters_no_bachelor_level_9",
    });
    expect(nzMastersNoBach.breakdown.qualificationPoints).toBe(5);

    // Amber List ANZSCO 1-3 on Skilled Work Experience pathway requires BOTH 1.2x median wage ($42.00/hr) AND 5+ yrs IN NZ
    const amberUnderPaid = calculateNzSmc({
      ...DEFAULT_NZ_INPUT,
      ageStatus: "under_56_eligible",
      hasEnglishIelts65OrEquivalent: true,
      hasAccreditedNzJobOrOffer: true,
      anzscoSkillTier: "anzsco_1_to_3_amber",
      nzHourlyWageNzd: 40.0, // Meets 1.1x ($38.50) but below 1.2x ($42.00)!
      nzSkilledWorkYears: "5yr_plus",
      totalRelevantWorkYears: "5yr_plus",
    });
    expect(amberUnderPaid.meetsSkilledWorkExperiencePathway).toBe(false);

    const amberShortTenure = calculateNzSmc({
      ...DEFAULT_NZ_INPUT,
      ageStatus: "under_56_eligible",
      hasEnglishIelts65OrEquivalent: true,
      hasAccreditedNzJobOrOffer: true,
      anzscoSkillTier: "anzsco_1_to_3_amber",
      nzHourlyWageNzd: 42.0,
      nzSkilledWorkYears: "2yr", // Only 2 yrs in NZ — Amber List requires 5+ yrs in NZ!
      totalRelevantWorkYears: "5yr_plus",
    });
    expect(amberShortTenure.meetsSkilledWorkExperiencePathway).toBe(false);
    expect(amberShortTenure.prerequisiteWarnings.some((w) => w.includes("Amber List Tenure"))).toBe(true);

    const amberMet = calculateNzSmc({
      ...DEFAULT_NZ_INPUT,
      ageStatus: "under_56_eligible",
      hasEnglishIelts65OrEquivalent: true,
      hasAccreditedNzJobOrOffer: true,
      anzscoSkillTier: "anzsco_1_to_3_amber",
      nzHourlyWageNzd: 42.0,
      nzSkilledWorkYears: "5yr_plus",
      totalRelevantWorkYears: "5yr_plus",
    });
    expect(amberMet.meetsSkilledWorkExperiencePathway).toBe(true);

    // Red List ANZSCO 1-3 is excluded from Skilled Work Experience & Trades pathways, eligible only via 6-Point SMC route
    const redList = calculateNzSmc({
      ...DEFAULT_NZ_INPUT,
      ageStatus: "under_56_eligible",
      hasEnglishIelts65OrEquivalent: true,
      hasAccreditedNzJobOrOffer: true,
      anzscoSkillTier: "anzsco_1_to_3_red",
      nzHourlyWageNzd: 45.0,
      qualificationTier: "phd_level_10_any", // 6 pts
      nzSkilledWorkYears: "5yr_plus",
      totalRelevantWorkYears: "5yr_plus",
      isEligibleTradeOrTechnicianRole: true,
    });
    expect(redList.meetsSkilledWorkExperiencePathway).toBe(false);
    expect(redList.meetsTradesTechnicianPathway).toBe(false);
    expect(redList.meetsSixPointRoute).toBe(true);
    expect(redList.prerequisiteWarnings.some((w) => w.includes("Red List Occupation Rule"))).toBe(true);

    // 3-point primary anchor (e.g. 2-3yr NZ registration) receives 3-year NZ work top-up tip
    const threePtInput = {
      ...DEFAULT_NZ_INPUT,
      ageStatus: "under_56_eligible" as const,
      hasEnglishIelts65OrEquivalent: true,
      hasAccreditedNzJobOrOffer: true,
      anzscoSkillTier: "anzsco_1_to_3" as const,
      nzHourlyWageNzd: 36,
      nzRegistrationTier: "2_to_3_years_training" as const,
    };
    const threePtRes = calculateNzSmc(threePtInput);
    const tips = generateNzTips(threePtInput, threePtRes);
    expect(tips.some((t) => t.id === "nz_topup_work")).toBe(true);
  });

  it("calculates UK 70-Point Skilled Worker including £17.13/hr hourly floor dilution, Pre-2024 £31,300 transitional tier, and ILR warning", () => {
    expect(UK_HOURLY_FLOOR_STANDARD_2026).toBe(17.13);
    expect(getUkRequiredSalaryFloor("option_a_standard", 40000, 37.5)).toBe(41700);
    expect(getUkRequiredSalaryFloor("transitional_pre_apr_2024", 30000, 37.5)).toBe(31300);

    // At 48 hrs/wk on Option A, £41,700/yr dilutes to £16.71/hr (< £17.13/hr) AND going rate pro-rates!
    const diluted48h = calculateUkSkilledWorker({
      hasValidCosFromLicensedSponsor: true,
      meetsEligibleRqfSkillLevel: true,
      meetsEnglishCefrRequirement: true,
      tradeableCategory: "option_a_standard",
      annualSalaryGbp: 41700,
      occupationGoingRateGbp: 35000, // pro-rates to £44,800 at 48h, while £17.13 * 48 * 52 = £42,756
      weeklyContractHours: 48,
      ukResidenceYears: "0_to_2yr",
      passedLifeInUkAndAbsencesUnder180: false,
    });
    expect(diluted48h.hourlyFloorMet).toBe(false);
    expect(diluted48h.breakdown.tradeablePoints).toBe(0);
    expect(diluted48h.visaEligible).toBe(false);

    // New Entrant earning £35,000 @ 37.5h meets 70 pts for Visa now, but triggers 5-year ILR £41,700 warning!
    const neRes = calculateUkSkilledWorker({
      hasValidCosFromLicensedSponsor: true,
      meetsEligibleRqfSkillLevel: true,
      meetsEnglishCefrRequirement: true,
      tradeableCategory: "option_e_new_entrant",
      annualSalaryGbp: 35000,
      occupationGoingRateGbp: 41700,
      weeklyContractHours: 37.5,
      ukResidenceYears: "0_to_2yr",
      passedLifeInUkAndAbsencesUnder180: false,
    });
    expect(neRes.totalPoints).toBe(70);
    expect(neRes.visaEligible).toBe(true);
    expect(neRes.ilrReadyNow).toBe(false);
    expect(neRes.ilrSalaryWarning).toContain("£41,700");

    // SW 24.3: Immigration Salary List (Option D) retains £33,400 general settlement threshold at 5-year ILR
    const islRes = calculateUkSkilledWorker({
      hasValidCosFromLicensedSponsor: true,
      meetsEligibleRqfSkillLevel: true,
      meetsEnglishCefrRequirement: true,
      tradeableCategory: "option_d_immigration_salary_list",
      annualSalaryGbp: 35000,
      occupationGoingRateGbp: 33400,
      weeklyContractHours: 37.5,
      ukResidenceYears: "5yr_plus",
      passedLifeInUkAndAbsencesUnder180: true,
    });
    expect(islRes.requiredIlrSalaryGbp).toBe(33400);
    expect(islRes.ilrSalaryWarning).toBeNull();
    expect(islRes.ilrReadyNow).toBe(true);

    // Universal £17.13/hr floor applies to Option E (New Entrant): £33,400 @ 45 hrs/wk = £14.27/hr (< £17.13/hr)
    const neDiluted = calculateUkSkilledWorker({
      hasValidCosFromLicensedSponsor: true,
      meetsEligibleRqfSkillLevel: true,
      meetsEnglishCefrRequirement: true,
      tradeableCategory: "option_e_new_entrant",
      annualSalaryGbp: 33400,
      occupationGoingRateGbp: 33400,
      weeklyContractHours: 45,
      ukResidenceYears: "0_to_2yr",
      passedLifeInUkAndAbsencesUnder180: false,
    });
    expect(neDiluted.hourlyFloorMet).toBe(false);
    expect(neDiluted.visaEligible).toBe(false);

    // SW 14.3: Weekly hours > 48 pro-rate the general salary threshold as well (50h/48h * £41,700 = £43,438; hourly £17.13 * 50 * 52 = £44,538)
    expect(getUkRequiredSalaryFloor("option_a_standard", 30000, 50)).toBe(44538);
  });

  it("calculates Germany § 20b AufenthG 6-Point Chancenkarte, itemized prerequisite gaps, and 2026 EU Blue Card 21/27-mo PR", () => {
    expect(DE_BLUE_CARD_STANDARD_2026).toBe(50700);
    expect(DE_BLUE_CARD_REDUCED_2026).toBe(45934.2);

    // Shortage (1) + 5yr work (3) + German B1 (2) + English C1 (1) + Age <=35 (2) = 9 pts
    const ck = calculateGermanyPr({
      ...DEFAULT_GERMANY_INPUT,
      qualificationStatus: "foreign_degree_or_2yr_vocational",
      isShortageOccupationMangelberuf: true,
      workExperience: "5yr_plus_in_7",
      germanLevel: "b1",
      englishLevel: "c1_or_higher",
      ageBand: "35_or_under",
      hasFinancialProofSperrkonto: true,
      germanJobOfferGrossEur: 47500,
    });
    expect(ck.totalPoints).toBe(9);
    expect(ck.chancenkarteEligible).toBe(true);
    expect(ck.blueCard.usesReducedThreshold).toBe(true);
    expect(ck.blueCard.eligibleForBlueCard).toBe(true);
    expect(ck.blueCard.prMonthsTimeline).toBe(21);

    // Defizitbescheid holder with €55,000 offer gets flagged for regulated license completion before Blue Card switch
    const defizitBc = calculateGermanyPr({
      ...DEFAULT_GERMANY_INPUT,
      qualificationStatus: "partial_recognition_defizitbescheid",
      germanJobOfferGrossEur: 55000,
    });
    expect(defizitBc.blueCard.needsFullRecognitionForRegulatedRole).toBe(true);
    expect(defizitBc.prerequisiteGaps.length).toBeGreaterThanOrEqual(2);
  });
});
