/**
 * Official Canadian Express Entry — Comprehensive Ranking System (CRS) Engine
 *
 * Replicates the official IRCC / Canada.ca Ministerial Instructions & CRS Tool:
 * - Starts cleanly at 0 CRS points with unselected fields (zero sample/mock pre-fills)
 * - Section A: Core / Human Capital Factors
 *   • Nov 2026 Labour Market Integration Standard ("nov_2026_lmi"): Max 570 single / 530 with spouse
 *   • Mar 2025 – Oct 2026 Baseline ("mar_2025_no_job_offer"): Max 500 single / 460 with spouse
 * - Section B: Spouse or Common-Law Partner Factors (Max 40)
 * - Section C: Skill Transferability Factors (Max 100 across 3 combinations, each sub-capped at 50)
 * - Section D: Additional Points (Max 600: PNP 600, French NCLC 7+ 25/50, Canadian Study 15/30, Sibling 15)
 * - Total CRS Ceiling: 1,270 ("nov_2026_lmi") or 1,200 ("mar_2025_no_job_offer")
 */

export type MaritalStatus =
  | "never_married"
  | "married"
  | "common_law"
  | "divorced_separated"
  | "legally_separated"
  | "annulled"
  | "widowed";

export type EducationLevel =
  | "less_than_secondary"
  | "secondary"
  | "one_year_post_secondary"
  | "two_year_post_secondary"
  | "bachelors_or_three_year"
  | "two_or_more_credentials"
  | "masters_or_professional"
  | "doctoral_phd";

export type CanadianEducationCredential =
  | "none"
  | "secondary_or_less"
  | "one_or_two_year"
  | "three_year_or_masters_phd";

export type LanguageTestType =
  | "ielts_gt"
  | "celpip_g"
  | "pte_core"
  | "clb_direct"
  | "tef_canada"
  | "tcf_canada"
  | "nclc_direct"
  | "none";

export type ActiveLanguageTestType = Exclude<LanguageTestType, "none">;

/**
 * Standardized CLB / NCLC integer scale:
 * 0 = Unselected ("Select score...") -> 0 points
 * 3 = Less than CLB/NCLC 4 -> 0 points
 * 4..9 = CLB/NCLC 4..9
 * 10 = CLB/NCLC 10 or more
 */
export type CLBLevel = 0 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type ScoredCLBLevel = Exclude<CLBLevel, 0>;

export interface LanguageAbilities {
  speaking: CLBLevel;
  listening: CLBLevel;
  reading: CLBLevel;
  writing: CLBLevel;
}

export type CanadianWorkYears = 0 | 1 | 2 | 3 | 4 | 5;
export type ForeignWorkYears = 0 | 1 | 2 | 3;
export type PrimaryOccupationTeer = "teer_0_1" | "teer_2_3";

export type HighWageTier =
  | "none_or_below_1_3x"
  | "tier_1_3x_to_1_5x"
  | "tier_1_5x_to_2_0x"
  | "tier_2_0x_or_more";

export type CrsPolicyVersion = "nov_2026_lmi" | "mar_2025_no_job_offer";

export interface CrsCalculatorInput {
  policyVersion: CrsPolicyVersion;

  // 1 & 2. Marital & Spouse Status ("" / null = not yet answered -> 0 pts)
  maritalStatus: MaritalStatus | "";
  spouseIsCanadianCitizenOrPR: boolean | null;
  spouseAccompanying: boolean | null;

  // 3. Age (null = not yet selected -> 0 pts; 17 = "17 or under", 47 = "47 or older")
  age: number | null;

  // 4. Education & Canadian Credential ("" / null = not yet selected -> 0 pts)
  educationLevel: EducationLevel | "";
  hasCanadianDegree: boolean | null;
  canadianEducationCredential: CanadianEducationCredential;
  canadianStudyMeetsDliRules?: boolean;

  // 5. Official Languages (null / "none" / 0 = not yet selected -> 0 pts)
  hasValidLanguageTest: boolean | null;
  firstLanguageTest: LanguageTestType;
  firstLanguage: LanguageAbilities;
  secondLanguageTest: LanguageTestType;
  secondLanguage: LanguageAbilities;

  // 6. Work Experience & Labour Market Integration
  primaryOccupationTeer?: PrimaryOccupationTeer;
  canadianWorkYears: CanadianWorkYears | null;
  canadianWorkWageTier: HighWageTier;
  foreignWorkYears: ForeignWorkYears | null;
  hasCertificateOfQualification: boolean | null;
  highWageJobOfferTier: HighWageTier;

  // 7. Additional Points
  hasProvincialNomination: boolean | null;
  hasSiblingInCanada: boolean | null;

  // 8. Accompanying Spouse / Common-Law Partner Factors
  spouseEducationLevel: EducationLevel | "";
  spouseCanadianWorkYears: CanadianWorkYears | null;
  spouseLanguageTest: LanguageTestType;
  spouseLanguage: LanguageAbilities;
}

export interface AbilityBandOption {
  clb: ScoredCLBLevel;
  scoreLabel: string;
  clbLabel: string;
}

export interface RawScoreRangeSpec {
  min: number;
  max: number;
  step: number;
  placeholder: string;
}

export interface CrsBreakdown {
  withSpouse: boolean;
  policyVersion: CrsPolicyVersion;
  grandTotalCap: number;

  coreHumanCapital: {
    age: number;
    education: number;
    firstOfficialLanguage: number;
    firstLanguagePerAbility: {
      speaking: number;
      listening: number;
      reading: number;
      writing: number;
    };
    secondOfficialLanguage: number;
    secondLanguagePerAbility: {
      speaking: number;
      listening: number;
      reading: number;
      writing: number;
    };
    secondLanguageRaw: number;
    secondLanguageCap: number;
    labourMarketIntegration: number;
    labourMarketSectionCap: number;
    canadianWorkDurationPoints: number;
    canadianWorkHighWageBonus: number;
    highWageJobOfferPoints: number;
    labourMarketWinningPath: "canadian_work" | "high_wage_job_offer" | "none";
    rawSubtotal: number;
    sectionCap: number;
    total: number;
  };

  spouseFactors: {
    education: number;
    firstOfficialLanguage: number;
    languagePerAbility: {
      speaking: number;
      listening: number;
      reading: number;
      writing: number;
    };
    canadianWorkExperience: number;
    sectionCap: number;
    total: number;
  };

  skillTransferability: {
    educationWithLanguage: number;
    educationWithCanadianWork: number;
    educationSubtotalCapped: number;
    foreignWorkWithLanguage: number;
    foreignWorkWithCanadianWork: number;
    foreignWorkSubtotalCapped: number;
    certificateOfQualificationWithLanguage: number;
    rawSubtotal: number;
    sectionCap: number;
    total: number;
  };

  additionalPoints: {
    siblingInCanada: number;
    frenchLanguageSkills: number;
    postSecondaryEducationInCanada: number;
    provincialNomination: number;
    rawSubtotal: number;
    sectionCap: number;
    total: number;
  };

  diagnostics: {
    hasAnyInput: boolean;
    hasCoreProfileCompleted: boolean;
    minFirstLanguageCLB: number;
    minEnglishCLB: number;
    minFrenchNCLC: number;
    lowestFirstLangAbility: keyof LanguageAbilities;
    fswLanguageEligible: boolean;
    fswSelectionPoints: number;
    fswEligible: boolean;
    cecTeer01Eligible: boolean;
    cecTeer23Eligible: boolean;
    cecEligible: boolean;
    fstLanguageEligible: boolean;
    fstEligible: boolean;
    expressEntryPoolEligible: boolean;
    poolIneligibilityReasons: string[];
    frenchCategoryEligible: boolean;
    nonAccompanyingSpouseComparisonScore: number | null;
    swappedLanguageComparisonScore: number | null;
    languageSwapGain: number;
    nextBirthdayAgeLoss: number;
    educationConsistencyWarning: string | null;
  };

  grandTotal: number;
}

export interface CrsOptimizationTip {
  id: string;
  title: string;
  actionSummary: string;
  pointsGain: number;
  projectedTotal: number;
  category: "language" | "french" | "work" | "education" | "spouse" | "pnp";
  previewInput: CrsCalculatorInput;
}

export type StreamEligibilityStatus =
  | "eligible"
  | "occupation_dependent"
  | "ineligible";

export interface ExpressEntryDrawBenchmark {
  id: string;
  streamName: string;
  recentCutoff: number;
  cutoffRangeLabel: string;
  categoryNote: string;
  meetsCutoff: boolean;
  pointsDelta: number;
  eligibilityStatus: StreamEligibilityStatus;
  eligibilityReason: string;
}

export function isFrenchTest(test: LanguageTestType): boolean {
  return test === "tef_canada" || test === "tcf_canada" || test === "nclc_direct";
}

export function isEnglishTest(test: LanguageTestType): boolean {
  return (
    test === "ielts_gt" ||
    test === "celpip_g" ||
    test === "pte_core" ||
    test === "clb_direct"
  );
}

export function getAllowedSecondLanguageTests(
  firstTest: LanguageTestType
): LanguageTestType[] {
  if (isEnglishTest(firstTest)) {
    return ["none", "tef_canada", "tcf_canada", "nclc_direct"];
  }
  if (isFrenchTest(firstTest)) {
    return ["none", "ielts_gt", "celpip_g", "pte_core", "clb_direct"];
  }
  return ["none"];
}

export const LANGUAGE_TEST_LABELS: Record<LanguageTestType, string> = {
  none: "Not applicable / No second official language test",
  ielts_gt: "IELTS General Training (English)",
  celpip_g: "CELPIP-G General (English)",
  pte_core: "PTE Core — Pearson (English)",
  clb_direct: "Direct CLB Level (English — Already Converted)",
  tef_canada: "TEF Canada (French — Équivalence ancien score)",
  tcf_canada: "TCF Canada (French)",
  nclc_direct: "Direct NCLC Level (French — Already Converted)",
};

const SCORE_BAND_TABLES: Record<
  ActiveLanguageTestType,
  Record<keyof LanguageAbilities, Record<ScoredCLBLevel, string>>
> = {
  celpip_g: {
    speaking: { 10: "10 – 12", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "M, 0 – 3" },
    listening: { 10: "10 – 12", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "M, 0 – 3" },
    reading: { 10: "10 – 12", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "M, 0 – 3" },
    writing: { 10: "10 – 12", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "M, 0 – 3" },
  },
  ielts_gt: {
    speaking: {
      10: "7.5 – 9.0",
      9: "7.0",
      8: "6.5",
      7: "6.0",
      6: "5.5",
      5: "5.0",
      4: "4.0 – 4.5",
      3: "0 – 3.5",
    },
    listening: {
      10: "8.5 – 9.0",
      9: "8.0",
      8: "7.5",
      7: "6.0 – 7.0",
      6: "5.5",
      5: "5.0",
      4: "4.5",
      3: "0 – 4.0",
    },
    reading: {
      10: "8.0 – 9.0",
      9: "7.0 – 7.5",
      8: "6.5",
      7: "6.0",
      6: "5.0 – 5.5",
      5: "4.0 – 4.5",
      4: "3.5",
      3: "0 – 3.0",
    },
    writing: {
      10: "7.5 – 9.0",
      9: "7.0",
      8: "6.5",
      7: "6.0",
      6: "5.5",
      5: "5.0",
      4: "4.0 – 4.5",
      3: "0 – 3.5",
    },
  },
  pte_core: {
    speaking: {
      10: "89 – 90",
      9: "84 – 88",
      8: "76 – 83",
      7: "68 – 75",
      6: "59 – 67",
      5: "51 – 58",
      4: "42 – 50",
      3: "0 – 41",
    },
    listening: {
      10: "89 – 90",
      9: "82 – 88",
      8: "71 – 81",
      7: "60 – 70",
      6: "50 – 59",
      5: "39 – 49",
      4: "28 – 38",
      3: "0 – 27",
    },
    reading: {
      10: "88 – 90",
      9: "78 – 87",
      8: "69 – 77",
      7: "60 – 68",
      6: "51 – 59",
      5: "42 – 50",
      4: "33 – 41",
      3: "0 – 32",
    },
    writing: {
      10: "90",
      9: "88 – 89",
      8: "79 – 87",
      7: "69 – 78",
      6: "60 – 68",
      5: "51 – 59",
      4: "41 – 50",
      3: "0 – 40",
    },
  },
  clb_direct: {
    speaking: { 10: "CLB 10+", 9: "CLB 9", 8: "CLB 8", 7: "CLB 7", 6: "CLB 6", 5: "CLB 5", 4: "CLB 4", 3: "Below CLB 4" },
    listening: { 10: "CLB 10+", 9: "CLB 9", 8: "CLB 8", 7: "CLB 7", 6: "CLB 6", 5: "CLB 5", 4: "CLB 4", 3: "Below CLB 4" },
    reading: { 10: "CLB 10+", 9: "CLB 9", 8: "CLB 8", 7: "CLB 7", 6: "CLB 6", 5: "CLB 5", 4: "CLB 4", 3: "Below CLB 4" },
    writing: { 10: "CLB 10+", 9: "CLB 9", 8: "CLB 8", 7: "CLB 7", 6: "CLB 6", 5: "CLB 5", 4: "CLB 4", 3: "Below CLB 4" },
  },
  tef_canada: {
    speaking: {
      10: "393 – 450",
      9: "371 – 392",
      8: "349 – 370",
      7: "310 – 348",
      6: "271 – 309",
      5: "226 – 270",
      4: "181 – 225",
      3: "0 – 180",
    },
    listening: {
      10: "316 – 360",
      9: "298 – 315",
      8: "280 – 297",
      7: "249 – 279",
      6: "217 – 248",
      5: "181 – 216",
      4: "145 – 180",
      3: "0 – 144",
    },
    reading: {
      10: "263 – 300",
      9: "248 – 262",
      8: "233 – 247",
      7: "207 – 232",
      6: "181 – 206",
      5: "151 – 180",
      4: "121 – 150",
      3: "0 – 120",
    },
    writing: {
      10: "393 – 450",
      9: "371 – 392",
      8: "349 – 370",
      7: "310 – 348",
      6: "271 – 309",
      5: "226 – 270",
      4: "181 – 225",
      3: "0 – 180",
    },
  },
  tcf_canada: {
    speaking: {
      10: "16 – 20",
      9: "14 – 15",
      8: "12 – 13",
      7: "10 – 11",
      6: "7 – 9",
      5: "6",
      4: "4 – 5",
      3: "0 – 3",
    },
    listening: {
      10: "549 – 699",
      9: "523 – 548",
      8: "503 – 522",
      7: "458 – 502",
      6: "398 – 457",
      5: "369 – 397",
      4: "331 – 368",
      3: "0 – 330",
    },
    reading: {
      10: "549 – 699",
      9: "524 – 548",
      8: "499 – 523",
      7: "453 – 498",
      6: "406 – 452",
      5: "375 – 405",
      4: "342 – 374",
      3: "0 – 341",
    },
    writing: {
      10: "16 – 20",
      9: "14 – 15",
      8: "12 – 13",
      7: "10 – 11",
      6: "7 – 9",
      5: "6",
      4: "4 – 5",
      3: "0 – 3",
    },
  },
  nclc_direct: {
    speaking: { 10: "NCLC 10+", 9: "NCLC 9", 8: "NCLC 8", 7: "NCLC 7", 6: "NCLC 6", 5: "NCLC 5", 4: "NCLC 4", 3: "Below NCLC 4" },
    listening: { 10: "NCLC 10+", 9: "NCLC 9", 8: "NCLC 8", 7: "NCLC 7", 6: "NCLC 6", 5: "NCLC 5", 4: "NCLC 4", 3: "Below NCLC 4" },
    reading: { 10: "NCLC 10+", 9: "NCLC 9", 8: "NCLC 8", 7: "NCLC 7", 6: "NCLC 6", 5: "NCLC 5", 4: "NCLC 4", 3: "Below NCLC 4" },
    writing: { 10: "NCLC 10+", 9: "NCLC 9", 8: "NCLC 8", 7: "NCLC 7", 6: "NCLC 6", 5: "NCLC 5", 4: "NCLC 4", 3: "Below NCLC 4" },
  },
};

export function getAbilityBandOptions(
  test: ActiveLanguageTestType,
  ability: keyof LanguageAbilities
): AbilityBandOption[] {
  const prefix = isFrenchTest(test) ? "NCLC" : "CLB";
  const isDirect = test === "clb_direct" || test === "nclc_direct";
  const levels: ScoredCLBLevel[] = [10, 9, 8, 7, 6, 5, 4, 3];
  return levels.map((clb) => {
    const band = SCORE_BAND_TABLES[test][ability][clb];
    const clbLabel =
      clb === 10 ? `${prefix} 10+` : clb === 3 ? `< ${prefix} 4` : `${prefix} ${clb}`;
    return {
      clb,
      scoreLabel: isDirect ? band : `${band} (${clbLabel})`,
      clbLabel,
    };
  });
}

export function getRawScoreRangeSpec(
  test: ActiveLanguageTestType,
  ability: keyof LanguageAbilities
): RawScoreRangeSpec | null {
  switch (test) {
    case "ielts_gt":
      return { min: 0, max: 9, step: 0.5, placeholder: "0.0 – 9.0" };
    case "celpip_g":
      return { min: 0, max: 12, step: 1, placeholder: "0 – 12" };
    case "pte_core":
      return { min: 10, max: 90, step: 1, placeholder: "10 – 90" };
    case "tef_canada":
      if (ability === "speaking" || ability === "writing") {
        return { min: 0, max: 450, step: 1, placeholder: "0 – 450" };
      }
      if (ability === "listening") {
        return { min: 0, max: 360, step: 1, placeholder: "0 – 360" };
      }
      return { min: 0, max: 300, step: 1, placeholder: "0 – 300" };
    case "tcf_canada":
      if (ability === "speaking" || ability === "writing") {
        return { min: 0, max: 20, step: 1, placeholder: "0 – 20" };
      }
      return { min: 0, max: 699, step: 1, placeholder: "0 – 699" };
    default:
      return null;
  }
}

export function convertRawScoreToCLB(
  test: ActiveLanguageTestType,
  ability: keyof LanguageAbilities,
  rawScore: number
): ScoredCLBLevel {
  if (!Number.isFinite(rawScore) || rawScore < 0) return 3;

  if (test === "celpip_g" || test === "clb_direct" || test === "nclc_direct") {
    const fl = Math.floor(rawScore);
    if (fl >= 10) return 10;
    if (fl >= 4) return fl as ScoredCLBLevel;
    return 3;
  }

  if (test === "ielts_gt") {
    const s = Math.floor(rawScore * 2 + 1e-6) / 2;
    if (ability === "listening") {
      if (s >= 8.5) return 10;
      if (s >= 8.0) return 9;
      if (s >= 7.5) return 8;
      if (s >= 6.0) return 7;
      if (s >= 5.5) return 6;
      if (s >= 5.0) return 5;
      if (s >= 4.5) return 4;
      return 3;
    }
    if (ability === "reading") {
      if (s >= 8.0) return 10;
      if (s >= 7.0) return 9;
      if (s >= 6.5) return 8;
      if (s >= 6.0) return 7;
      if (s >= 5.0) return 6;
      if (s >= 4.0) return 5;
      if (s >= 3.5) return 4;
      return 3;
    }
    if (s >= 7.5) return 10;
    if (s >= 7.0) return 9;
    if (s >= 6.5) return 8;
    if (s >= 6.0) return 7;
    if (s >= 5.5) return 6;
    if (s >= 5.0) return 5;
    if (s >= 4.0) return 4;
    return 3;
  }

  if (test === "pte_core") {
    const s = Math.floor(rawScore);
    if (ability === "speaking") {
      if (s >= 89) return 10;
      if (s >= 84) return 9;
      if (s >= 76) return 8;
      if (s >= 68) return 7;
      if (s >= 59) return 6;
      if (s >= 51) return 5;
      if (s >= 42) return 4;
      return 3;
    }
    if (ability === "listening") {
      if (s >= 89) return 10;
      if (s >= 82) return 9;
      if (s >= 71) return 8;
      if (s >= 60) return 7;
      if (s >= 50) return 6;
      if (s >= 39) return 5;
      if (s >= 28) return 4;
      return 3;
    }
    if (ability === "reading") {
      if (s >= 88) return 10;
      if (s >= 78) return 9;
      if (s >= 69) return 8;
      if (s >= 60) return 7;
      if (s >= 51) return 6;
      if (s >= 42) return 5;
      if (s >= 33) return 4;
      return 3;
    }
    if (s >= 90) return 10;
    if (s >= 88) return 9;
    if (s >= 79) return 8;
    if (s >= 69) return 7;
    if (s >= 60) return 6;
    if (s >= 51) return 5;
    if (s >= 41) return 4;
    return 3;
  }

  if (test === "tef_canada") {
    const s = Math.floor(rawScore);
    if (ability === "speaking" || ability === "writing") {
      if (s >= 393) return 10;
      if (s >= 371) return 9;
      if (s >= 349) return 8;
      if (s >= 310) return 7;
      if (s >= 271) return 6;
      if (s >= 226) return 5;
      if (s >= 181) return 4;
      return 3;
    }
    if (ability === "listening") {
      if (s >= 316) return 10;
      if (s >= 298) return 9;
      if (s >= 280) return 8;
      if (s >= 249) return 7;
      if (s >= 217) return 6;
      if (s >= 181) return 5;
      if (s >= 145) return 4;
      return 3;
    }
    if (s >= 263) return 10;
    if (s >= 248) return 9;
    if (s >= 233) return 8;
    if (s >= 207) return 7;
    if (s >= 181) return 6;
    if (s >= 151) return 5;
    if (s >= 121) return 4;
    return 3;
  }

  if (test === "tcf_canada") {
    const s = Math.floor(rawScore);
    if (ability === "speaking" || ability === "writing") {
      if (s >= 16) return 10;
      if (s >= 14) return 9;
      if (s >= 12) return 8;
      if (s >= 10) return 7;
      if (s >= 7) return 6;
      if (s >= 6) return 5;
      if (s >= 4) return 4;
      return 3;
    }
    if (ability === "listening") {
      if (s >= 549) return 10;
      if (s >= 523) return 9;
      if (s >= 503) return 8;
      if (s >= 458) return 7;
      if (s >= 398) return 6;
      if (s >= 369) return 5;
      if (s >= 331) return 4;
      return 3;
    }
    if (s >= 549) return 10;
    if (s >= 524) return 9;
    if (s >= 499) return 8;
    if (s >= 453) return 7;
    if (s >= 406) return 6;
    if (s >= 375) return 5;
    if (s >= 342) return 4;
    return 3;
  }

  return 3;
}

// ============================================================================
// SECTION A TABLES: CORE / HUMAN CAPITAL FACTORS
// ============================================================================

const AGE_POINTS_SINGLE: Record<number, number> = {
  17: 0,
  18: 99,
  19: 105,
  20: 110,
  21: 110,
  22: 110,
  23: 110,
  24: 110,
  25: 110,
  26: 110,
  27: 110,
  28: 110,
  29: 110,
  30: 105,
  31: 99,
  32: 94,
  33: 88,
  34: 83,
  35: 77,
  36: 72,
  37: 66,
  38: 61,
  39: 55,
  40: 50,
  41: 39,
  42: 28,
  43: 17,
  44: 6,
  45: 0,
  46: 0,
  47: 0,
};

const AGE_POINTS_WITH_SPOUSE: Record<number, number> = {
  17: 0,
  18: 90,
  19: 95,
  20: 100,
  21: 100,
  22: 100,
  23: 100,
  24: 100,
  25: 100,
  26: 100,
  27: 100,
  28: 100,
  29: 100,
  30: 95,
  31: 90,
  32: 85,
  33: 80,
  34: 75,
  35: 70,
  36: 65,
  37: 60,
  38: 55,
  39: 50,
  40: 45,
  41: 35,
  42: 25,
  43: 15,
  44: 5,
  45: 0,
  46: 0,
  47: 0,
};

const EDUCATION_POINTS_SINGLE: Record<EducationLevel, number> = {
  less_than_secondary: 0,
  secondary: 30,
  one_year_post_secondary: 90,
  two_year_post_secondary: 98,
  bachelors_or_three_year: 120,
  two_or_more_credentials: 128,
  masters_or_professional: 135,
  doctoral_phd: 150,
};

const EDUCATION_POINTS_WITH_SPOUSE: Record<EducationLevel, number> = {
  less_than_secondary: 0,
  secondary: 28,
  one_year_post_secondary: 84,
  two_year_post_secondary: 91,
  bachelors_or_three_year: 112,
  two_or_more_credentials: 119,
  masters_or_professional: 126,
  doctoral_phd: 140,
};

const FIRST_LANG_POINTS_SINGLE: Record<CLBLevel, number> = {
  0: 0,
  3: 0,
  4: 6,
  5: 6,
  6: 9,
  7: 17,
  8: 23,
  9: 31,
  10: 34,
};

const FIRST_LANG_POINTS_WITH_SPOUSE: Record<CLBLevel, number> = {
  0: 0,
  3: 0,
  4: 6,
  5: 6,
  6: 8,
  7: 16,
  8: 22,
  9: 29,
  10: 32,
};

const SECOND_LANG_POINTS_PER_ABILITY: Record<CLBLevel, number> = {
  0: 0,
  3: 0,
  4: 0,
  5: 1,
  6: 1,
  7: 3,
  8: 3,
  9: 6,
  10: 6,
};

const CAN_WORK_POINTS_SINGLE: Record<CanadianWorkYears, number> = {
  0: 0,
  1: 40,
  2: 53,
  3: 64,
  4: 72,
  5: 80,
};

const CAN_WORK_POINTS_WITH_SPOUSE: Record<CanadianWorkYears, number> = {
  0: 0,
  1: 35,
  2: 46,
  3: 56,
  4: 63,
  5: 70,
};

const HIGH_WAGE_WORK_BONUS: Record<HighWageTier, number> = {
  none_or_below_1_3x: 0,
  tier_1_3x_to_1_5x: 20,
  tier_1_5x_to_2_0x: 40,
  tier_2_0x_or_more: 70,
};

const HIGH_WAGE_JOB_OFFER_POINTS: Record<HighWageTier, number> = {
  none_or_below_1_3x: 0,
  tier_1_3x_to_1_5x: 50,
  tier_1_5x_to_2_0x: 70,
  tier_2_0x_or_more: 100,
};

// ============================================================================
// SECTION B TABLES: SPOUSE / COMMON-LAW PARTNER FACTORS
// ============================================================================

const SPOUSE_EDUCATION_POINTS: Record<EducationLevel, number> = {
  less_than_secondary: 0,
  secondary: 2,
  one_year_post_secondary: 6,
  two_year_post_secondary: 7,
  bachelors_or_three_year: 8,
  two_or_more_credentials: 9,
  masters_or_professional: 10,
  doctoral_phd: 10,
};

const SPOUSE_LANG_POINTS_PER_ABILITY: Record<CLBLevel, number> = {
  0: 0,
  3: 0,
  4: 0,
  5: 1,
  6: 1,
  7: 3,
  8: 3,
  9: 5,
  10: 5,
};

const SPOUSE_CAN_WORK_POINTS: Record<CanadianWorkYears, number> = {
  0: 0,
  1: 5,
  2: 7,
  3: 8,
  4: 9,
  5: 10,
};

// ============================================================================
// FEDERAL SKILLED WORKER (FSW) 67/100 SELECTION FACTOR ESTIMATOR
// ============================================================================

const FSW_EDUCATION_POINTS: Record<EducationLevel, number> = {
  doctoral_phd: 25,
  masters_or_professional: 23,
  two_or_more_credentials: 22,
  bachelors_or_three_year: 21,
  two_year_post_secondary: 19,
  one_year_post_secondary: 15,
  secondary: 5,
  less_than_secondary: 0,
};

function computeFswSelectionPoints(
  input: CrsCalculatorInput,
  hasValidFirstLang: boolean,
  hasValidSecondLang: boolean
): number {
  if (!hasValidFirstLang) return 0;

  const abilities: CLBLevel[] = [
    input.firstLanguage.speaking,
    input.firstLanguage.listening,
    input.firstLanguage.reading,
    input.firstLanguage.writing,
  ];
  const minFirst = Math.min(...abilities);
  let langPts = 0;
  if (minFirst >= 7) {
    for (const c of abilities) {
      if (c >= 9) langPts += 6;
      else if (c === 8) langPts += 5;
      else if (c === 7) langPts += 4;
    }
  }
  if (hasValidSecondLang) {
    const minSecond = Math.min(
      input.secondLanguage.speaking,
      input.secondLanguage.listening,
      input.secondLanguage.reading,
      input.secondLanguage.writing
    );
    if (minSecond >= 5) langPts += 4;
  }

  const eduPts = input.educationLevel ? FSW_EDUCATION_POINTS[input.educationLevel] : 0;

  const canWork = input.canadianWorkYears ?? 0;
  const forWork = input.foreignWorkYears ?? 0;
  const totalSkilledYears = canWork + forWork;
  let workPts = 0;
  if (totalSkilledYears >= 6) workPts = 15;
  else if (totalSkilledYears >= 4) workPts = 13;
  else if (totalSkilledYears >= 2) workPts = 11;
  else if (totalSkilledYears === 1) workPts = 9;

  let agePts = 0;
  if (input.age !== null) {
    const age = Math.round(input.age);
    if (age >= 18 && age <= 35) agePts = 12;
    else if (age >= 36 && age <= 46) agePts = 47 - age;
  }

  let adaptabilityRaw = 0;
  if (canWork >= 1) adaptabilityRaw += 10;
  if (
    input.hasCanadianDegree === true &&
    input.canadianStudyMeetsDliRules !== false &&
    (input.canadianEducationCredential === "one_or_two_year" ||
      input.canadianEducationCredential === "three_year_or_masters_phd")
  ) {
    adaptabilityRaw += 5;
  }
  if (input.hasSiblingInCanada === true) adaptabilityRaw += 5;
  if (isScoredWithSpouse(input)) {
    if ((input.spouseCanadianWorkYears ?? 0) >= 1) adaptabilityRaw += 5;
    if (input.spouseLanguageTest !== "none") {
      const minSpouseClb = Math.min(
        input.spouseLanguage.speaking,
        input.spouseLanguage.listening,
        input.spouseLanguage.reading,
        input.spouseLanguage.writing
      );
      if (minSpouseClb >= 4) adaptabilityRaw += 5;
    }
  }
  const adaptabilityPts = Math.min(adaptabilityRaw, 10);

  return Math.min(langPts + eduPts + workPts + agePts + adaptabilityPts, 100);
}

// ============================================================================
// CORE ENGINE
// ============================================================================

export function isScoredWithSpouse(input: CrsCalculatorInput): boolean {
  const hasPartner = input.maritalStatus === "married" || input.maritalStatus === "common_law";
  if (!hasPartner) return false;
  if (input.spouseIsCanadianCitizenOrPR === true) return false;
  return input.spouseAccompanying === true;
}

export function swapFirstAndSecondLanguages(
  input: CrsCalculatorInput
): CrsCalculatorInput {
  if (input.secondLanguageTest === "none" || input.firstLanguageTest === "none") return input;
  return {
    ...input,
    firstLanguageTest: input.secondLanguageTest,
    firstLanguage: { ...input.secondLanguage },
    secondLanguageTest: input.firstLanguageTest,
    secondLanguage: { ...input.firstLanguage },
  };
}

function getEducationTransferabilityTier(level: EducationLevel | ""): 0 | 1 | 2 {
  if (!level || level === "less_than_secondary" || level === "secondary") return 0;
  if (
    level === "one_year_post_secondary" ||
    level === "two_year_post_secondary" ||
    level === "bachelors_or_three_year"
  ) {
    return 1;
  }
  return 2;
}

function checkHasAnyInput(input: CrsCalculatorInput): boolean {
  return (
    input.maritalStatus !== "" ||
    input.age !== null ||
    input.educationLevel !== "" ||
    input.hasCanadianDegree !== null ||
    input.hasValidLanguageTest !== null ||
    input.firstLanguageTest !== "none" ||
    input.canadianWorkYears !== null ||
    input.foreignWorkYears !== null ||
    input.hasCertificateOfQualification !== null ||
    input.highWageJobOfferTier !== "none_or_below_1_3x" ||
    input.hasProvincialNomination !== null ||
    input.hasSiblingInCanada !== null
  );
}

function computeCrsInternal(
  input: CrsCalculatorInput,
  computeAlts: boolean
): CrsBreakdown {
  const withSpouse = isScoredWithSpouse(input);
  const isNov2026 = input.policyVersion === "nov_2026_lmi";
  const hasAnyInput = checkHasAnyInput(input);

  const clampedAge =
    input.age === null ? null : Math.max(17, Math.min(47, Math.round(input.age)));

  // -------------------------------------------------------------------------
  // A. Core / Human Capital Factors
  // -------------------------------------------------------------------------
  const agePts =
    clampedAge === null
      ? 0
      : withSpouse
        ? (AGE_POINTS_WITH_SPOUSE[clampedAge] ?? 0)
        : (AGE_POINTS_SINGLE[clampedAge] ?? 0);

  const eduPts = !input.educationLevel
    ? 0
    : withSpouse
      ? EDUCATION_POINTS_WITH_SPOUSE[input.educationLevel]
      : EDUCATION_POINTS_SINGLE[input.educationLevel];

  const hasValidFirstLang =
    input.hasValidLanguageTest === true && input.firstLanguageTest !== "none";

  const firstLangTable = withSpouse ? FIRST_LANG_POINTS_WITH_SPOUSE : FIRST_LANG_POINTS_SINGLE;
  const firstLangPerAbility = hasValidFirstLang
    ? {
        speaking: firstLangTable[input.firstLanguage.speaking],
        listening: firstLangTable[input.firstLanguage.listening],
        reading: firstLangTable[input.firstLanguage.reading],
        writing: firstLangTable[input.firstLanguage.writing],
      }
    : { speaking: 0, listening: 0, reading: 0, writing: 0 };

  const firstOfficialLanguagePts =
    firstLangPerAbility.speaking +
    firstLangPerAbility.listening +
    firstLangPerAbility.reading +
    firstLangPerAbility.writing;

  const secondLanguageCap = withSpouse ? 22 : 24;
  const hasValidSecondLang =
    hasValidFirstLang &&
    input.secondLanguageTest !== "none" &&
    isFrenchTest(input.secondLanguageTest) !== isFrenchTest(input.firstLanguageTest);

  const secondLanguagePerAbility = hasValidSecondLang
    ? {
        speaking: SECOND_LANG_POINTS_PER_ABILITY[input.secondLanguage.speaking],
        listening: SECOND_LANG_POINTS_PER_ABILITY[input.secondLanguage.listening],
        reading: SECOND_LANG_POINTS_PER_ABILITY[input.secondLanguage.reading],
        writing: SECOND_LANG_POINTS_PER_ABILITY[input.secondLanguage.writing],
      }
    : { speaking: 0, listening: 0, reading: 0, writing: 0 };

  const secondLanguageRaw =
    secondLanguagePerAbility.speaking +
    secondLanguagePerAbility.listening +
    secondLanguagePerAbility.reading +
    secondLanguagePerAbility.writing;
  const secondOfficialLanguagePts = Math.min(secondLanguageRaw, secondLanguageCap);

  // Labour Market Integration / Canadian Work Experience
  const canWorkYrs: CanadianWorkYears = input.canadianWorkYears ?? 0;
  const forWorkYrs: ForeignWorkYears = input.foreignWorkYears ?? 0;

  const canWorkDurationPts = withSpouse
    ? CAN_WORK_POINTS_WITH_SPOUSE[canWorkYrs]
    : CAN_WORK_POINTS_SINGLE[canWorkYrs];

  const labourMarketSectionCap = isNov2026
    ? withSpouse
      ? 140
      : 150
    : withSpouse
      ? 70
      : 80;

  let canWorkHighWageBonus = 0;
  let highWageJobOfferPts = 0;

  if (isNov2026) {
    if (canWorkYrs >= 1) {
      canWorkHighWageBonus = HIGH_WAGE_WORK_BONUS[input.canadianWorkWageTier];
    }
    highWageJobOfferPts = HIGH_WAGE_JOB_OFFER_POINTS[input.highWageJobOfferTier];
  }

  const workPathTotal = Math.min(
    canWorkDurationPts + canWorkHighWageBonus,
    labourMarketSectionCap
  );
  const jobOfferPathTotal = Math.min(highWageJobOfferPts, labourMarketSectionCap);

  let labourMarketPts = 0;
  let labourMarketWinningPath: "canadian_work" | "high_wage_job_offer" | "none" = "none";

  if (workPathTotal === 0 && jobOfferPathTotal === 0) {
    labourMarketPts = 0;
    labourMarketWinningPath = "none";
  } else if (workPathTotal >= jobOfferPathTotal) {
    labourMarketPts = workPathTotal;
    labourMarketWinningPath = "canadian_work";
  } else {
    labourMarketPts = jobOfferPathTotal;
    labourMarketWinningPath = "high_wage_job_offer";
  }

  const coreRawSubtotal =
    agePts + eduPts + firstOfficialLanguagePts + secondOfficialLanguagePts + labourMarketPts;

  const coreSectionCap = isNov2026
    ? withSpouse
      ? 530
      : 570
    : withSpouse
      ? 460
      : 500;
  const coreTotal = Math.min(coreRawSubtotal, coreSectionCap);

  // -------------------------------------------------------------------------
  // B. Spouse or Common-Law Partner Factors (Max 40)
  // -------------------------------------------------------------------------
  let spouseEduPts = 0;
  let spouseCanWorkPts = 0;
  let spouseLangPerAbility = { speaking: 0, listening: 0, reading: 0, writing: 0 };

  if (withSpouse) {
    spouseEduPts = input.spouseEducationLevel
      ? SPOUSE_EDUCATION_POINTS[input.spouseEducationLevel]
      : 0;
    spouseCanWorkPts = SPOUSE_CAN_WORK_POINTS[input.spouseCanadianWorkYears ?? 0];
    if (input.spouseLanguageTest !== "none") {
      spouseLangPerAbility = {
        speaking: SPOUSE_LANG_POINTS_PER_ABILITY[input.spouseLanguage.speaking],
        listening: SPOUSE_LANG_POINTS_PER_ABILITY[input.spouseLanguage.listening],
        reading: SPOUSE_LANG_POINTS_PER_ABILITY[input.spouseLanguage.reading],
        writing: SPOUSE_LANG_POINTS_PER_ABILITY[input.spouseLanguage.writing],
      };
    }
  }
  const spouseLangPts =
    spouseLangPerAbility.speaking +
    spouseLangPerAbility.listening +
    spouseLangPerAbility.reading +
    spouseLangPerAbility.writing;
  const spouseTotal = Math.min(spouseEduPts + spouseLangPts + spouseCanWorkPts, 40);

  // -------------------------------------------------------------------------
  // C. Skill Transferability Factors (Max 100)
  // -------------------------------------------------------------------------
  const abilitiesEntries: Array<[keyof LanguageAbilities, CLBLevel]> = [
    ["speaking", hasValidFirstLang ? input.firstLanguage.speaking : 0],
    ["listening", hasValidFirstLang ? input.firstLanguage.listening : 0],
    ["reading", hasValidFirstLang ? input.firstLanguage.reading : 0],
    ["writing", hasValidFirstLang ? input.firstLanguage.writing : 0],
  ];

  abilitiesEntries.sort((a, b) => a[1] - b[1]);
  const lowestFirstLangAbility = abilitiesEntries[0][0];
  const minFirstLangCLB = hasValidFirstLang ? abilitiesEntries[0][1] : 0;

  const eduTier = getEducationTransferabilityTier(input.educationLevel);
  let educationWithLanguage = 0;
  if (eduTier === 1) {
    if (minFirstLangCLB >= 9) educationWithLanguage = 25;
    else if (minFirstLangCLB >= 7) educationWithLanguage = 13;
  } else if (eduTier === 2) {
    if (minFirstLangCLB >= 9) educationWithLanguage = 50;
    else if (minFirstLangCLB >= 7) educationWithLanguage = 25;
  }

  let educationWithCanadianWork = 0;
  if (eduTier === 1) {
    if (canWorkYrs >= 2) educationWithCanadianWork = 25;
    else if (canWorkYrs === 1) educationWithCanadianWork = 13;
  } else if (eduTier === 2) {
    if (canWorkYrs >= 2) educationWithCanadianWork = 50;
    else if (canWorkYrs === 1) educationWithCanadianWork = 25;
  }

  const educationSubtotalCapped = Math.min(educationWithLanguage + educationWithCanadianWork, 50);

  let foreignWorkWithLanguage = 0;
  if (forWorkYrs === 1 || forWorkYrs === 2) {
    if (minFirstLangCLB >= 9) foreignWorkWithLanguage = 25;
    else if (minFirstLangCLB >= 7) foreignWorkWithLanguage = 13;
  } else if (forWorkYrs >= 3) {
    if (minFirstLangCLB >= 9) foreignWorkWithLanguage = 50;
    else if (minFirstLangCLB >= 7) foreignWorkWithLanguage = 25;
  }

  let foreignWorkWithCanadianWork = 0;
  if (forWorkYrs === 1 || forWorkYrs === 2) {
    if (canWorkYrs >= 2) foreignWorkWithCanadianWork = 25;
    else if (canWorkYrs === 1) foreignWorkWithCanadianWork = 13;
  } else if (forWorkYrs >= 3) {
    if (canWorkYrs >= 2) foreignWorkWithCanadianWork = 50;
    else if (canWorkYrs === 1) foreignWorkWithCanadianWork = 25;
  }

  const foreignWorkSubtotalCapped = Math.min(
    foreignWorkWithLanguage + foreignWorkWithCanadianWork,
    50
  );

  let certificateOfQualificationWithLanguage = 0;
  if (input.hasCertificateOfQualification === true) {
    if (minFirstLangCLB >= 7) certificateOfQualificationWithLanguage = 50;
    else if (minFirstLangCLB >= 5) certificateOfQualificationWithLanguage = 25;
  }

  const transferabilityRaw =
    educationSubtotalCapped +
    foreignWorkSubtotalCapped +
    certificateOfQualificationWithLanguage;
  const transferabilityTotal = Math.min(transferabilityRaw, 100);

  // -------------------------------------------------------------------------
  // D. Additional Points (Max 600)
  // -------------------------------------------------------------------------
  const siblingPts = input.hasSiblingInCanada === true ? 15 : 0;

  let minEnglishCLB = 0;
  let minFrenchNCLC = 0;

  if (hasValidFirstLang) {
    if (isEnglishTest(input.firstLanguageTest)) {
      minEnglishCLB = Math.min(
        input.firstLanguage.speaking,
        input.firstLanguage.listening,
        input.firstLanguage.reading,
        input.firstLanguage.writing
      );
      if (hasValidSecondLang && isFrenchTest(input.secondLanguageTest)) {
        minFrenchNCLC = Math.min(
          input.secondLanguage.speaking,
          input.secondLanguage.listening,
          input.secondLanguage.reading,
          input.secondLanguage.writing
        );
      }
    } else if (isFrenchTest(input.firstLanguageTest)) {
      minFrenchNCLC = Math.min(
        input.firstLanguage.speaking,
        input.firstLanguage.listening,
        input.firstLanguage.reading,
        input.firstLanguage.writing
      );
      if (hasValidSecondLang && isEnglishTest(input.secondLanguageTest)) {
        minEnglishCLB = Math.min(
          input.secondLanguage.speaking,
          input.secondLanguage.listening,
          input.secondLanguage.reading,
          input.secondLanguage.writing
        );
      }
    }
  }

  let frenchBonusPts = 0;
  if (minFrenchNCLC >= 7) {
    frenchBonusPts = minEnglishCLB >= 5 ? 50 : 25;
  }

  let canadianEduPts = 0;
  let educationConsistencyWarning: string | null = null;
  const studyDliEligible = input.canadianStudyMeetsDliRules !== false;

  if (input.hasCanadianDegree === true) {
    if (!studyDliEligible) {
      canadianEduPts = 0;
      educationConsistencyWarning =
        "Canadian study bonus (+15/+30) requires full-time in-person study in Canada (>= 8 months at a DLI, <50% distance learning or ESL/FSL).";
    } else if (
      input.educationLevel === "less_than_secondary" ||
      input.educationLevel === "secondary"
    ) {
      if (
        input.canadianEducationCredential === "one_or_two_year" ||
        input.canadianEducationCredential === "three_year_or_masters_phd"
      ) {
        canadianEduPts = 0;
        educationConsistencyWarning =
          "Your overall education is set to High School or less, so post-secondary Canadian study bonus points (+15/+30) cannot apply until you select your post-secondary credential above.";
      }
    } else if (
      (input.educationLevel === "one_year_post_secondary" ||
        input.educationLevel === "two_year_post_secondary") &&
      input.canadianEducationCredential === "three_year_or_masters_phd"
    ) {
      canadianEduPts = 15;
      educationConsistencyWarning =
        "Your overall education is set to a 1- or 2-year program, so Canadian study bonus is capped at +15 pts. Select Bachelor's/Master's/PhD above if you completed a 3+ year or graduate Canadian degree.";
    } else if (input.canadianEducationCredential === "one_or_two_year") {
      canadianEduPts = 15;
    } else if (input.canadianEducationCredential === "three_year_or_masters_phd") {
      canadianEduPts = 30;
    }
  }

  const pnpPts = input.hasProvincialNomination === true ? 600 : 0;

  const additionalRaw = siblingPts + frenchBonusPts + canadianEduPts + pnpPts;
  const additionalTotal = Math.min(additionalRaw, 600);

  const grandTotalCap = isNov2026 ? 1270 : 1200;
  const grandTotal = Math.min(
    coreTotal + spouseTotal + transferabilityTotal + additionalTotal,
    grandTotalCap
  );

  // -------------------------------------------------------------------------
  // Express Entry Minimum Pool Entry Diagnostics
  // -------------------------------------------------------------------------
  const hasCoreProfileCompleted =
    input.age !== null &&
    input.educationLevel !== "" &&
    input.hasValidLanguageTest !== null &&
    (input.canadianWorkYears !== null || input.foreignWorkYears !== null);

  const firstLangSpeaking = hasValidFirstLang ? input.firstLanguage.speaking : 0;
  const firstLangListening = hasValidFirstLang ? input.firstLanguage.listening : 0;
  const firstLangReading = hasValidFirstLang ? input.firstLanguage.reading : 0;
  const firstLangWriting = hasValidFirstLang ? input.firstLanguage.writing : 0;

  const fswLanguageEligible = hasValidFirstLang && minFirstLangCLB >= 7;
  const fswSelectionPoints = computeFswSelectionPoints(
    input,
    hasValidFirstLang,
    hasValidSecondLang
  );
  const fswEligible =
    fswLanguageEligible &&
    (canWorkYrs >= 1 || forWorkYrs >= 1) &&
    input.educationLevel !== "" &&
    input.educationLevel !== "less_than_secondary" &&
    fswSelectionPoints >= 67;

  const cecTeer01Eligible = hasValidFirstLang && canWorkYrs >= 1 && minFirstLangCLB >= 7;
  const cecTeer23Eligible = hasValidFirstLang && canWorkYrs >= 1 && minFirstLangCLB >= 5;

  const occupationTeer = input.primaryOccupationTeer ?? "teer_0_1";
  const cecEligible =
    occupationTeer === "teer_0_1" ? cecTeer01Eligible : cecTeer23Eligible;

  const fstLanguageEligible =
    hasValidFirstLang &&
    firstLangSpeaking >= 5 &&
    firstLangListening >= 5 &&
    firstLangReading >= 4 &&
    firstLangWriting >= 4;
  const fstEligible =
    fstLanguageEligible &&
    canWorkYrs + forWorkYrs >= 2 &&
    (input.hasCertificateOfQualification === true ||
      input.highWageJobOfferTier !== "none_or_below_1_3x");

  const expressEntryPoolEligible = cecEligible || fswEligible || fstEligible;
  const frenchCategoryEligible = expressEntryPoolEligible && minFrenchNCLC >= 7;

  const poolIneligibilityReasons: string[] = [];
  if (!expressEntryPoolEligible && hasAnyInput) {
    if (input.hasValidLanguageTest === false) {
      poolIneligibilityReasons.push(
        "Valid language test results (< 2 years old) are mandatory to enter the Express Entry pool."
      );
    } else if (!hasValidFirstLang || minFirstLangCLB === 0) {
      poolIneligibilityReasons.push(
        "Complete all 4 abilities of your first official language test to verify Express Entry pool eligibility."
      );
    } else if (canWorkYrs === 0 && forWorkYrs === 0) {
      poolIneligibilityReasons.push(
        "At least 1 year of skilled work experience (Canadian or Foreign in TEER 0–3) is required for CEC, FSW, or FST."
      );
    } else {
      if (canWorkYrs >= 1 && !cecEligible) {
        poolIneligibilityReasons.push(
          occupationTeer === "teer_0_1"
            ? "CEC in TEER 0/1 occupations requires minimum CLB/NCLC 7 across all 4 language abilities."
            : "CEC in TEER 2/3 occupations requires minimum CLB/NCLC 5 across all 4 language abilities."
        );
      }
      if (canWorkYrs === 0 && forWorkYrs >= 1) {
        if (!fswLanguageEligible) {
          poolIneligibilityReasons.push(
            "Federal Skilled Worker (FSW) requires minimum CLB/NCLC 7 in all 4 abilities of your first official language."
          );
        } else if (!input.educationLevel || input.educationLevel === "less_than_secondary") {
          poolIneligibilityReasons.push(
            "Federal Skilled Worker (FSW) requires at least a secondary school (high school) diploma."
          );
        } else if (fswSelectionPoints < 67) {
          poolIneligibilityReasons.push(
            `Federal Skilled Worker (FSW) requires at least 67/100 on the FSW Selection Factor Grid (estimated: ${fswSelectionPoints}/100).`
          );
        }
      }
    }
  }

  let nextBirthdayAgeLoss = 0;
  if (clampedAge !== null) {
    const nextAge = Math.min(47, clampedAge + 1);
    const nextAgePts = withSpouse
      ? (AGE_POINTS_WITH_SPOUSE[nextAge] ?? 0)
      : (AGE_POINTS_SINGLE[nextAge] ?? 0);
    nextBirthdayAgeLoss = Math.max(0, agePts - nextAgePts);
  }

  let nonAccompanyingSpouseComparisonScore: number | null = null;
  let swappedLanguageComparisonScore: number | null = null;
  let languageSwapGain = 0;

  if (computeAlts) {
    if (withSpouse) {
      const altSpouse = computeCrsInternal({ ...input, spouseAccompanying: false }, false);
      nonAccompanyingSpouseComparisonScore = altSpouse.grandTotal;
    }
    if (hasValidSecondLang && minFirstLangCLB > 0) {
      const altLang = computeCrsInternal(swapFirstAndSecondLanguages(input), false);
      swappedLanguageComparisonScore = altLang.grandTotal;
      if (altLang.grandTotal > grandTotal) {
        languageSwapGain = altLang.grandTotal - grandTotal;
      }
    }
  }

  return {
    withSpouse,
    policyVersion: input.policyVersion,
    grandTotalCap,
    coreHumanCapital: {
      age: agePts,
      education: eduPts,
      firstOfficialLanguage: firstOfficialLanguagePts,
      firstLanguagePerAbility: firstLangPerAbility,
      secondOfficialLanguage: secondOfficialLanguagePts,
      secondLanguagePerAbility,
      secondLanguageRaw,
      secondLanguageCap,
      labourMarketIntegration: labourMarketPts,
      labourMarketSectionCap,
      canadianWorkDurationPoints: canWorkDurationPts,
      canadianWorkHighWageBonus: canWorkHighWageBonus,
      highWageJobOfferPoints: highWageJobOfferPts,
      labourMarketWinningPath,
      rawSubtotal: coreRawSubtotal,
      sectionCap: coreSectionCap,
      total: coreTotal,
    },
    spouseFactors: {
      education: spouseEduPts,
      firstOfficialLanguage: spouseLangPts,
      languagePerAbility: spouseLangPerAbility,
      canadianWorkExperience: spouseCanWorkPts,
      sectionCap: 40,
      total: spouseTotal,
    },
    skillTransferability: {
      educationWithLanguage,
      educationWithCanadianWork,
      educationSubtotalCapped,
      foreignWorkWithLanguage,
      foreignWorkWithCanadianWork,
      foreignWorkSubtotalCapped,
      certificateOfQualificationWithLanguage,
      rawSubtotal: transferabilityRaw,
      sectionCap: 100,
      total: transferabilityTotal,
    },
    additionalPoints: {
      siblingInCanada: siblingPts,
      frenchLanguageSkills: frenchBonusPts,
      postSecondaryEducationInCanada: canadianEduPts,
      provincialNomination: pnpPts,
      rawSubtotal: additionalRaw,
      sectionCap: 600,
      total: additionalTotal,
    },
    diagnostics: {
      hasAnyInput,
      hasCoreProfileCompleted,
      minFirstLanguageCLB: minFirstLangCLB,
      minEnglishCLB,
      minFrenchNCLC,
      lowestFirstLangAbility,
      fswLanguageEligible,
      fswSelectionPoints,
      fswEligible,
      cecTeer01Eligible,
      cecTeer23Eligible,
      cecEligible,
      fstLanguageEligible,
      fstEligible,
      expressEntryPoolEligible,
      poolIneligibilityReasons,
      frenchCategoryEligible,
      nonAccompanyingSpouseComparisonScore,
      swappedLanguageComparisonScore,
      languageSwapGain,
      nextBirthdayAgeLoss,
      educationConsistencyWarning,
    },
    grandTotal,
  };
}

export function calculateCrsScore(input: CrsCalculatorInput): CrsBreakdown {
  return computeCrsInternal(input, true);
}

// ============================================================================
// WHAT-IF SCORE OPTIMIZER & 2026 EXPRESS ENTRY BENCHMARKS
// ============================================================================

export function generateCrsOptimizationTips(
  input: CrsCalculatorInput,
  current: CrsBreakdown
): CrsOptimizationTip[] {
  // Do not generate speculative tips when the user hasn't entered a baseline profile yet
  if (!current.diagnostics.hasAnyInput || current.grandTotal === 0) {
    return [];
  }

  const tips: CrsOptimizationTip[] = [];

  // 0. Instant Win: Swap First & Second Official Languages if Second is stronger!
  if (
    current.diagnostics.languageSwapGain > 0 &&
    current.diagnostics.swappedLanguageComparisonScore !== null
  ) {
    const swappedInput = swapFirstAndSecondLanguages(input);
    tips.push({
      id: "swap_first_second_language",
      title: "Designate Your Stronger Language as First Official Language",
      actionSummary:
        "Your second official language currently scores higher on IRCC's First Official Language & Skill Transferability tables. Swapping their order boosts your CRS immediately with zero new exams.",
      pointsGain: current.diagnostics.languageSwapGain,
      projectedTotal: current.diagnostics.swappedLanguageComparisonScore,
      category: "language",
      previewInput: swappedInput,
    });
  }

  // 1. Reach CLB 9 across all 4 abilities in First Official Language
  if (input.firstLanguageTest !== "none" && current.diagnostics.minFirstLanguageCLB < 9) {
    const upgradedLang: LanguageAbilities = {
      speaking: Math.max(input.firstLanguage.speaking, 9) as CLBLevel,
      listening: Math.max(input.firstLanguage.listening, 9) as CLBLevel,
      reading: Math.max(input.firstLanguage.reading, 9) as CLBLevel,
      writing: Math.max(input.firstLanguage.writing, 9) as CLBLevel,
    };
    const previewInput: CrsCalculatorInput = {
      ...input,
      hasValidLanguageTest: true,
      firstLanguage: upgradedLang,
    };
    const sim = calculateCrsScore(previewInput);
    const gain = sim.grandTotal - current.grandTotal;
    if (gain > 0) {
      const bottleneckLabel = current.diagnostics.lowestFirstLangAbility;
      tips.push({
        id: "clb9_unlock",
        title: "Hit CLB/NCLC 9+ Across All 4 Language Skills",
        actionSummary: `Your lowest skill (${bottleneckLabel}) caps Skill Transferability. Reaching level 9 in all 4 skills (e.g. IELTS L 8.0 / R 7.0 / W 7.0 / S 7.0) unlocks top transferability combos.`,
        pointsGain: gain,
        projectedTotal: sim.grandTotal,
        category: "language",
        previewInput,
      });
    }
  } else if (
    input.firstLanguageTest !== "none" &&
    (input.firstLanguage.speaking < 10 ||
      input.firstLanguage.listening < 10 ||
      input.firstLanguage.reading < 10 ||
      input.firstLanguage.writing < 10)
  ) {
    const previewInput: CrsCalculatorInput = {
      ...input,
      hasValidLanguageTest: true,
      firstLanguage: { speaking: 10, listening: 10, reading: 10, writing: 10 },
    };
    const sim = calculateCrsScore(previewInput);
    const gain = sim.grandTotal - current.grandTotal;
    if (gain > 0) {
      tips.push({
        id: "clb10_max",
        title: "Maximize First Official Language to CLB/NCLC 10",
        actionSummary:
          "Advancing remaining level 9 skills to level 10 adds up to 3 extra core points per ability.",
        pointsGain: gain,
        projectedTotal: sim.grandTotal,
        category: "language",
        previewInput,
      });
    }
  }

  // 2. French NCLC 7+ Bilingual Bonus (+50 Additional + up to 12/24 Second Language)
  if (current.diagnostics.minFrenchNCLC < 7 && isEnglishTest(input.firstLanguageTest)) {
    const previewInput: CrsCalculatorInput = {
      ...input,
      hasValidLanguageTest: true,
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 },
    };
    const sim = calculateCrsScore(previewInput);
    const gain = sim.grandTotal - current.grandTotal;
    if (gain > 0) {
      tips.push({
        id: "french_nclc7",
        title: "Achieve NCLC 7 in French (TEF / TCF Canada)",
        actionSummary:
          "Scoring NCLC 7 across all 4 French skills adds up to +62 CRS points AND qualifies you for targeted French-proficiency Express Entry draws (~407–435 cutoff).",
        pointsGain: gain,
        projectedTotal: sim.grandTotal,
        category: "french",
        previewInput,
      });
    }
  }

  // 3. Add +1 Year of Canadian Skilled Work Experience
  const currentCanWork = input.canadianWorkYears ?? 0;
  if (currentCanWork < 5) {
    const nextYears = (currentCanWork + 1) as CanadianWorkYears;
    const previewInput: CrsCalculatorInput = {
      ...input,
      canadianWorkYears: nextYears,
    };
    const sim = calculateCrsScore(previewInput);
    const gain = sim.grandTotal - current.grandTotal;
    if (gain > 0) {
      tips.push({
        id: "canadian_work_plus_1",
        title:
          currentCanWork === 0
            ? "Complete 1 Year of Canadian Skilled Work (CEC)"
            : `Reach ${nextYears} Years of Canadian Work Experience`,
        actionSummary:
          currentCanWork === 0
            ? "1,560 hours of TEER 0–3 work in Canada unlocks Core points, Education/Foreign transferability, and Canadian Experience Class draws."
            : "Completing your next full year of TEER 0–3 Canadian work increases Core and Skill Transferability points.",
        pointsGain: gain,
        projectedTotal: sim.grandTotal,
        category: "work",
        previewInput,
      });
    }
  }

  // 4. Upgrade Education Credential (e.g., Two or more credentials / Master's)
  if (
    input.educationLevel === "bachelors_or_three_year" ||
    input.educationLevel === "two_year_post_secondary" ||
    input.educationLevel === "one_year_post_secondary"
  ) {
    const previewInput: CrsCalculatorInput = {
      ...input,
      educationLevel: "two_or_more_credentials",
    };
    const sim = calculateCrsScore(previewInput);
    const gain = sim.grandTotal - current.grandTotal;
    if (gain > 0) {
      tips.push({
        id: "two_or_more_degrees",
        title: "Add a 1-Year Post-Graduate Certificate ('Two or More Credentials')",
        actionSummary:
          "Pairing a 3+ year Bachelor's degree with an accredited 1-year diploma/certificate jumps into IRCC's upper Skill Transferability bracket.",
        pointsGain: gain,
        projectedTotal: sim.grandTotal,
        category: "education",
        previewInput,
      });
    }
  }

  // 5. Accompanying vs Non-Accompanying Spouse Check (or Spouse Language/ECA Boost)
  if (current.withSpouse) {
    const currentSpouseEduPts = input.spouseEducationLevel
      ? SPOUSE_EDUCATION_POINTS[input.spouseEducationLevel]
      : 0;
    const maxSpousePreview: CrsCalculatorInput = {
      ...input,
      spouseLanguageTest:
        input.spouseLanguageTest === "none" ? "ielts_gt" : input.spouseLanguageTest,
      spouseLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 },
      spouseEducationLevel:
        currentSpouseEduPts < 8 ? "bachelors_or_three_year" : input.spouseEducationLevel,
    };
    const simSpouse = calculateCrsScore(maxSpousePreview);
    const spouseBoostGain = simSpouse.grandTotal - current.grandTotal;

    if (
      current.diagnostics.nonAccompanyingSpouseComparisonScore !== null &&
      current.diagnostics.nonAccompanyingSpouseComparisonScore > current.grandTotal
    ) {
      const singleGain =
        current.diagnostics.nonAccompanyingSpouseComparisonScore - current.grandTotal;
      if (spouseBoostGain >= singleGain && spouseBoostGain > 0) {
        tips.push({
          id: "spouse_language_eca_boost",
          title: "Add Spouse Language Test (CLB 9+) & ECA",
          actionSummary: `Your accompanying spouse currently claims ${current.spouseFactors.total}/40 pts. Reaching CLB 9+ and verifying a degree lifts your couple score to ${simSpouse.grandTotal}.`,
          pointsGain: spouseBoostGain,
          projectedTotal: simSpouse.grandTotal,
          category: "spouse",
          previewInput: maxSpousePreview,
        });
      } else {
        tips.push({
          id: "spouse_non_accompanying_compare",
          title: "Evaluate Spouse Language/ECA vs. Non-Accompanying Grid",
          actionSummary: `Scoring on the Single/Non-Accompanying grid yields ${current.diagnostics.nonAccompanyingSpouseComparisonScore} (+${singleGain} pts), or your spouse can add up to 40 pts via language + ECA.`,
          pointsGain: singleGain,
          projectedTotal: current.diagnostics.nonAccompanyingSpouseComparisonScore,
          category: "spouse",
          previewInput: { ...input, spouseAccompanying: false },
        });
      }
    } else if (spouseBoostGain > 0) {
      tips.push({
        id: "spouse_language_eca_boost",
        title: "Maximize Accompanying Spouse Language (CLB 9+)",
        actionSummary: `Raising your spouse's language results toward CLB 9+ adds +${spouseBoostGain} pts under Section B.`,
        pointsGain: spouseBoostGain,
        projectedTotal: simSpouse.grandTotal,
        category: "spouse",
        previewInput: maxSpousePreview,
      });
    }
  }

  return tips.sort((a, b) => b.pointsGain - a.pointsGain).slice(0, 4);
}

export function evaluateExpressEntryDraws(
  crsScore: number,
  input?: CrsCalculatorInput,
  diagnostics?: CrsBreakdown["diagnostics"]
): ExpressEntryDrawBenchmark[] {
  const poolOk = diagnostics ? diagnostics.expressEntryPoolEligible : crsScore > 0;
  const frenchOk = diagnostics ? diagnostics.frenchCategoryEligible : false;
  const cecOk = diagnostics ? diagnostics.cecEligible : false;
  const has1YrWork = input
    ? (input.canadianWorkYears ?? 0) + (input.foreignWorkYears ?? 0) >= 1
    : false;
  const hasPnp = input ? input.hasProvincialNomination === true : crsScore >= 600;

  const rounds: Array<{
    id: string;
    streamName: string;
    recentCutoff: number;
    cutoffRangeLabel: string;
    categoryNote: string;
    eligibilityStatus: StreamEligibilityStatus;
    eligibilityReason: string;
  }> = [
    {
      id: "french_category",
      streamName: "French-Language Proficiency Category",
      recentCutoff: 420,
      cutoffRangeLabel: "407 – 435",
      categoryNote: "Requires NCLC 7+ in all 4 French abilities + Express Entry pool eligibility",
      eligibilityStatus: frenchOk ? "eligible" : "ineligible",
      eligibilityReason: frenchOk
        ? "Qualifies for French category draws"
        : !poolOk
          ? "Requires Express Entry pool eligibility + French NCLC 7+"
          : "Requires NCLC 7+ in all 4 French skills",
    },
    {
      id: "category_priority_nocs",
      streamName: "Category-Based (Healthcare, Education, Trades & STEM)",
      recentCutoff: 476,
      cutoffRangeLabel: "463 – 495",
      categoryNote: "Requires 12+ months experience (within last 3 yrs) in an eligible priority NOC",
      eligibilityStatus:
        poolOk && has1YrWork ? "occupation_dependent" : "ineligible",
      eligibilityReason:
        poolOk && has1YrWork
          ? "Verify your NOC is in an active IRCC priority category"
          : "Requires Express Entry pool eligibility + 12 months in eligible NOC",
    },
    {
      id: "cec_general",
      streamName: "Canadian Experience Class (CEC)",
      recentCutoff: 518,
      cutoffRangeLabel: "509 – 524",
      categoryNote: "Requires 1+ year skilled work in Canada within last 3 years",
      eligibilityStatus: cecOk ? "eligible" : "ineligible",
      eligibilityReason: cecOk
        ? "Meets CEC work & language requirements"
        : "Requires 1+ yr Canadian skilled work & CEC language threshold",
    },
    {
      id: "pnp_stream",
      streamName: "Provincial Nominee Program (PNP)",
      recentCutoff: 736,
      cutoffRangeLabel: "715 – 775",
      categoryNote: "Includes +600 provincial nomination certificate boost",
      eligibilityStatus: poolOk && hasPnp ? "eligible" : "ineligible",
      eligibilityReason:
        poolOk && hasPnp
          ? "Provincial nomination (+600) active"
          : !poolOk
            ? "Requires Express Entry pool eligibility + PNP certificate"
            : "Requires an Express Entry Provincial Nomination (+600)",
    },
  ];

  return rounds.map((r) => ({
    ...r,
    meetsCutoff: crsScore >= r.recentCutoff,
    pointsDelta: crsScore - r.recentCutoff,
  }));
}

/**
 * Clean Day-0 zero-state initial input: every field unselected, 0 CRS points across all sections.
 */
export const DEFAULT_CRS_INPUT: CrsCalculatorInput = {
  policyVersion: "nov_2026_lmi",
  maritalStatus: "",
  spouseIsCanadianCitizenOrPR: null,
  spouseAccompanying: null,
  age: null,
  educationLevel: "",
  hasCanadianDegree: null,
  canadianEducationCredential: "none",
  canadianStudyMeetsDliRules: true,
  hasValidLanguageTest: null,
  firstLanguageTest: "none",
  firstLanguage: {
    speaking: 0,
    listening: 0,
    reading: 0,
    writing: 0,
  },
  secondLanguageTest: "none",
  secondLanguage: {
    speaking: 0,
    listening: 0,
    reading: 0,
    writing: 0,
  },
  primaryOccupationTeer: "teer_0_1",
  canadianWorkYears: null,
  canadianWorkWageTier: "none_or_below_1_3x",
  foreignWorkYears: null,
  hasCertificateOfQualification: null,
  highWageJobOfferTier: "none_or_below_1_3x",
  hasProvincialNomination: null,
  hasSiblingInCanada: null,
  spouseEducationLevel: "",
  spouseCanadianWorkYears: null,
  spouseLanguageTest: "none",
  spouseLanguage: {
    speaking: 0,
    listening: 0,
    reading: 0,
    writing: 0,
  },
};
