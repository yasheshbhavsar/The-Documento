import { describe, expect, it } from "vitest";
import {
  calculateCrsScore,
  convertRawScoreToCLB,
  CrsCalculatorInput,
  DEFAULT_CRS_INPUT,
  evaluateExpressEntryDraws,
  generateCrsOptimizationTips,
} from "../calculator";

const BASE_ACTIVE_PROFILE: CrsCalculatorInput = {
  ...DEFAULT_CRS_INPUT,
  policyVersion: "nov_2026_lmi",
  maritalStatus: "never_married",
  age: 29,
  educationLevel: "masters_or_professional",
  hasCanadianDegree: false,
  canadianEducationCredential: "none",
  hasValidLanguageTest: true,
  firstLanguageTest: "ielts_gt",
  firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
  secondLanguageTest: "none",
  secondLanguage: { speaking: 0, listening: 0, reading: 0, writing: 0 },
  canadianWorkYears: 0,
  canadianWorkWageTier: "none_or_below_1_3x",
  foreignWorkYears: 0,
  hasCertificateOfQualification: false,
  highWageJobOfferTier: "none_or_below_1_3x",
  hasProvincialNomination: false,
  hasSiblingInCanada: false,
};

describe("Official Canada.ca CRS Score Calculator Engine (Audited)", () => {
  it("starts cleanly at 0 CRS points across every section with zero pre-filled sample values", () => {
    const res = calculateCrsScore(DEFAULT_CRS_INPUT);
    expect(res.grandTotal).toBe(0);
    expect(res.coreHumanCapital.total).toBe(0);
    expect(res.coreHumanCapital.age).toBe(0);
    expect(res.coreHumanCapital.education).toBe(0);
    expect(res.coreHumanCapital.firstOfficialLanguage).toBe(0);
    expect(res.coreHumanCapital.secondOfficialLanguage).toBe(0);
    expect(res.coreHumanCapital.labourMarketIntegration).toBe(0);
    expect(res.spouseFactors.total).toBe(0);
    expect(res.skillTransferability.total).toBe(0);
    expect(res.additionalPoints.total).toBe(0);
    expect(res.diagnostics.hasAnyInput).toBe(false);
    expect(res.diagnostics.hasCoreProfileCompleted).toBe(false);
    expect(generateCrsOptimizationTips(DEFAULT_CRS_INPUT, res)).toEqual([]);
  });

  it("scores classic FSW Outland Master's + CLB 9 + 3 yrs Foreign Work accurately (469 pts) & passes FSW 67/100 grid", () => {
    const input: CrsCalculatorInput = {
      ...BASE_ACTIVE_PROFILE,
      age: 29,
      educationLevel: "masters_or_professional",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      canadianWorkYears: 0,
      foreignWorkYears: 3,
    };

    const res = calculateCrsScore(input);
    expect(res.coreHumanCapital.age).toBe(110);
    expect(res.coreHumanCapital.education).toBe(135);
    expect(res.coreHumanCapital.firstOfficialLanguage).toBe(124);
    expect(res.coreHumanCapital.total).toBe(369);
    expect(res.skillTransferability.educationWithLanguage).toBe(50);
    expect(res.skillTransferability.foreignWorkWithLanguage).toBe(50);
    expect(res.skillTransferability.total).toBe(100);
    expect(res.grandTotal).toBe(469);

    // FSW 67-point grid: Lang 24 + Edu 23 + Work 11 + Age 12 = 70/100 (>= 67)
    expect(res.diagnostics.fswSelectionPoints).toBe(70);
    expect(res.diagnostics.fswEligible).toBe(true);
    expect(res.diagnostics.expressEntryPoolEligible).toBe(true);
  });

  it("distinguishes single Bachelor's degree (25 max transferability) from Two+ credentials (50 max)", () => {
    const bachelorRes = calculateCrsScore({
      ...BASE_ACTIVE_PROFILE,
      age: 25,
      educationLevel: "bachelors_or_three_year",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      canadianWorkYears: 0,
      foreignWorkYears: 0,
    });
    expect(bachelorRes.coreHumanCapital.education).toBe(120);
    expect(bachelorRes.skillTransferability.educationWithLanguage).toBe(25);
    // 0 Canadian + 0 Foreign work -> NOT eligible for Express Entry pool despite having CRS points!
    expect(bachelorRes.diagnostics.expressEntryPoolEligible).toBe(false);

    const twoCredRes = calculateCrsScore({
      ...BASE_ACTIVE_PROFILE,
      age: 25,
      educationLevel: "two_or_more_credentials",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      canadianWorkYears: 0,
      foreignWorkYears: 1,
    });
    expect(twoCredRes.coreHumanCapital.education).toBe(128);
    expect(twoCredRes.skillTransferability.educationWithLanguage).toBe(50);
    expect(twoCredRes.diagnostics.expressEntryPoolEligible).toBe(true);
  });

  it("enforces lowest-ability CLB bottleneck on Skill Transferability and surfaces CLB 9 tip", () => {
    const input: CrsCalculatorInput = {
      ...BASE_ACTIVE_PROFILE,
      age: 28,
      educationLevel: "masters_or_professional",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 8 },
      canadianWorkYears: 0,
      foreignWorkYears: 3,
    };
    const res = calculateCrsScore(input);
    expect(res.diagnostics.minFirstLanguageCLB).toBe(8);
    expect(res.skillTransferability.educationWithLanguage).toBe(25);
    expect(res.skillTransferability.foreignWorkWithLanguage).toBe(25);

    const tips = generateCrsOptimizationTips(input, res);
    const clb9Tip = tips.find((t) => t.id === "clb9_unlock");
    expect(clb9Tip).toBeDefined();
    expect(clb9Tip?.pointsGain).toBe(58);
  });

  it("caps Second Official Language at 22 with accompanying spouse vs 24 single, and awards +50 French bonus", () => {
    const withSpouseRes = calculateCrsScore({
      ...BASE_ACTIVE_PROFILE,
      maritalStatus: "married",
      spouseIsCanadianCitizenOrPR: false,
      spouseAccompanying: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
    });
    expect(withSpouseRes.withSpouse).toBe(true);
    expect(withSpouseRes.coreHumanCapital.secondLanguageRaw).toBe(24);
    expect(withSpouseRes.coreHumanCapital.secondOfficialLanguage).toBe(22);
    expect(withSpouseRes.additionalPoints.frenchLanguageSkills).toBe(50);

    const citizenSpouseRes = calculateCrsScore({
      ...BASE_ACTIVE_PROFILE,
      maritalStatus: "married",
      spouseIsCanadianCitizenOrPR: true,
      spouseAccompanying: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
    });
    expect(citizenSpouseRes.withSpouse).toBe(false);
    expect(citizenSpouseRes.coreHumanCapital.secondOfficialLanguage).toBe(24);
    expect(citizenSpouseRes.spouseFactors.total).toBe(0);
  });

  it("applies Nov 2026 Labour Market Integration 570/530 Core & 1,270 Grand Ceiling vs Mar 2025 500/460 & 1,200 Ceiling", () => {
    // No double counting: 1 yr CAN work (40) + 1.3x wage bonus (20) = 60 vs High-wage job offer 2.0x (100) -> 100
    const lmiJobWins = calculateCrsScore({
      ...BASE_ACTIVE_PROFILE,
      policyVersion: "nov_2026_lmi",
      maritalStatus: "never_married",
      canadianWorkYears: 1,
      canadianWorkWageTier: "tier_1_3x_to_1_5x",
      highWageJobOfferTier: "tier_2_0x_or_more",
    });
    expect(lmiJobWins.coreHumanCapital.labourMarketIntegration).toBe(100);
    expect(lmiJobWins.coreHumanCapital.labourMarketWinningPath).toBe("high_wage_job_offer");

    // Nov 2026 Single Ceiling: Age 25 (110) + PhD (150) + CLB 10x4 (136) + French 2nd (24) + 5yr CAN 2x wage (150) = 570 Core!
    // + Transferability (100) + PNP (600) = 1,270!
    const nov2026MaxSingleInput: CrsCalculatorInput = {
      ...BASE_ACTIVE_PROFILE,
      policyVersion: "nov_2026_lmi",
      age: 25,
      educationLevel: "doctoral_phd",
      firstLanguage: { speaking: 10, listening: 10, reading: 10, writing: 10 },
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      canadianWorkYears: 5,
      canadianWorkWageTier: "tier_2_0x_or_more",
      foreignWorkYears: 3,
      hasProvincialNomination: true,
      hasSiblingInCanada: true,
    };
    const nov2026MaxSingle = calculateCrsScore(nov2026MaxSingleInput);
    expect(nov2026MaxSingle.coreHumanCapital.sectionCap).toBe(570);
    expect(nov2026MaxSingle.coreHumanCapital.total).toBe(570);
    expect(nov2026MaxSingle.grandTotalCap).toBe(1270);
    expect(nov2026MaxSingle.grandTotal).toBe(1270);

    // Nov 2026 With Spouse Ceiling: Age 25 (100) + PhD (140) + CLB 10x4 (128) + French 2nd (22) + 5yr CAN 2x wage (140) = 530 Core + 40 Spouse = 570!
    const nov2026MaxSpouse = calculateCrsScore({
      ...nov2026MaxSingleInput,
      maritalStatus: "married",
      spouseIsCanadianCitizenOrPR: false,
      spouseAccompanying: true,
      hasSiblingInCanada: false,
      spouseEducationLevel: "doctoral_phd",
      spouseCanadianWorkYears: 5,
      spouseLanguageTest: "ielts_gt",
      spouseLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
    });
    expect(nov2026MaxSpouse.coreHumanCapital.sectionCap).toBe(530);
    expect(nov2026MaxSpouse.coreHumanCapital.total).toBe(530);
    expect(nov2026MaxSpouse.spouseFactors.total).toBe(40);
    expect(nov2026MaxSpouse.grandTotal).toBe(1270);

    // Mar 2025 Baseline Ceiling: maxes at 500 Core & 1,200 Grand Total
    const mar2025MaxSingle = calculateCrsScore({
      ...nov2026MaxSingleInput,
      policyVersion: "mar_2025_no_job_offer",
    });
    expect(mar2025MaxSingle.coreHumanCapital.sectionCap).toBe(500);
    expect(mar2025MaxSingle.coreHumanCapital.total).toBe(500);
    expect(mar2025MaxSingle.grandTotalCap).toBe(1200);
    expect(mar2025MaxSingle.grandTotal).toBe(1200);
  });

  it("detects bilingual First/Second Official Language swap opportunity (+69 pts when French NCLC 9 > English CLB 7)", () => {
    const subOptimalBilingual: CrsCalculatorInput = {
      ...BASE_ACTIVE_PROFILE,
      age: 28,
      educationLevel: "masters_or_professional",
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 }, // 68 pts
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 }, // 24 pts
      canadianWorkYears: 0,
      foreignWorkYears: 0,
    };

    const res = calculateCrsScore(subOptimalBilingual);
    // Current: Lang 68 + 24 = 92; Edu+Lang Transfer = 25; French bonus = 50
    // Swapped: Lang 124 + 12 = 136 (+44); Edu+Lang Transfer = 50 (+25); French bonus = 50 (+0) -> +69 total!
    expect(res.diagnostics.languageSwapGain).toBe(69);
    expect(res.diagnostics.swappedLanguageComparisonScore).toBe(res.grandTotal + 69);
  });

  it("converts exact raw scores accurately across IELTS GT, PTE Core, TEF Canada, and TCF Canada", () => {
    // IELTS GT Listening: 8.5 -> CLB 10, 8.0 -> CLB 9, 7.5 -> CLB 8, 6.0 -> CLB 7, 4.5 -> CLB 4
    expect(convertRawScoreToCLB("ielts_gt", "listening", 8.5)).toBe(10);
    expect(convertRawScoreToCLB("ielts_gt", "listening", 8.0)).toBe(9);
    expect(convertRawScoreToCLB("ielts_gt", "listening", 7.5)).toBe(8);
    expect(convertRawScoreToCLB("ielts_gt", "reading", 3.5)).toBe(4);

    // PTE Core Writing: 90 -> CLB 10, 88 -> CLB 9, 79 -> CLB 8, 69 -> CLB 7
    expect(convertRawScoreToCLB("pte_core", "writing", 90)).toBe(10);
    expect(convertRawScoreToCLB("pte_core", "writing", 89)).toBe(9);
    expect(convertRawScoreToCLB("pte_core", "writing", 79)).toBe(8);
    expect(convertRawScoreToCLB("pte_core", "writing", 69)).toBe(7);

    // TEF Canada (ancien score) Reading: 207 -> NCLC 7, 206 -> NCLC 6
    expect(convertRawScoreToCLB("tef_canada", "reading", 207)).toBe(7);
    expect(convertRawScoreToCLB("tef_canada", "reading", 206)).toBe(6);

    // TCF Canada Listening: 458 -> NCLC 7, Speaking: 10 -> NCLC 7
    expect(convertRawScoreToCLB("tcf_canada", "listening", 458)).toBe(7);
    expect(convertRawScoreToCLB("tcf_canada", "speaking", 10)).toBe(7);
  });

  it("guards against contradictory Canadian study bonus and marks English-only profiles ineligible for French draws", () => {
    const contradictoryEdu = calculateCrsScore({
      ...BASE_ACTIVE_PROFILE,
      educationLevel: "secondary",
      hasCanadianDegree: true,
      canadianEducationCredential: "three_year_or_masters_phd",
    });
    expect(contradictoryEdu.additionalPoints.postSecondaryEducationInCanada).toBe(0);
    expect(contradictoryEdu.diagnostics.educationConsistencyWarning).toBeTruthy();

    // English-only candidate with CRS > 420 must NOT be marked eligible for French Proficiency Draws
    const englishOnlyInput: CrsCalculatorInput = {
      ...BASE_ACTIVE_PROFILE,
      foreignWorkYears: 3, // 469 CRS (> 420 French cutoff), English only
      secondLanguageTest: "none",
    };
    const englishOnly = calculateCrsScore(englishOnlyInput);
    const draws = evaluateExpressEntryDraws(
      englishOnly.grandTotal,
      englishOnlyInput,
      englishOnly.diagnostics
    );
    const frenchDraw = draws.find((d) => d.id === "french_category");
    expect(frenchDraw?.meetsCutoff).toBe(true);
    expect(frenchDraw?.eligibilityStatus).toBe("ineligible");
  });
});
