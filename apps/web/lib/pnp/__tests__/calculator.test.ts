import { describe, it, expect } from "vitest";
import {
  calculateAllPnpProvinces,
  calculatePnpScore,
  convertAnnualSalaryToHourlyWage,
  DEFAULT_PNP_INPUT,
  generatePnpOptimizationTips,
  PNP_PROVINCE_META,
  PnpCalculatorInput,
} from "../calculator";

describe("Official 2026 Canadian PNP Multi-Province Scoring Engine", () => {
  it("initializes every province strictly at 0 points with hasAnyInput: false and zero tips", () => {
    const all = calculateAllPnpProvinces(DEFAULT_PNP_INPUT);

    for (const meta of PNP_PROVINCE_META) {
      const res = all[meta.id];
      expect(res.totalScore).toBe(0);
      expect(res.hasAnyInput).toBe(false);
      expect(res.expressEntryBonusPoints).toBe(600);
      for (const sec of res.sections) {
        expect(sec.points).toBe(0);
      }
      expect(generatePnpOptimizationTips(DEFAULT_PNP_INPUT, res)).toEqual([]);
    }
  });

  it("converts annual salary to base hourly wage accurately", () => {
    expect(convertAnnualSalaryToHourlyWage(78000, 37.5)).toBe(40);
    expect(convertAnnualSalaryToHourlyWage(83200, 40)).toBe(40);
    expect(convertAnnualSalaryToHourlyWage(0, 37.5)).toBe(0);
  });

  it("scores Ontario OINP Oct 5, 2026 standard accurately up to 132 max (and 117 for self-employed physicians) with 0 age penalty", () => {
    const maxOinp: PnpCalculatorInput = {
      ...DEFAULT_PNP_INPUT,
      activeProvince: "ontario_oinp",
      age: 48, // Age is NOT scored in OINP — must still achieve 132/132
      educationLevel: "doctoral_or_md", // 10
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 }, // 15
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 }, // 10 bilingual
      hourlyWage: 42, // 15
      oinpWorkExperience: "job_offer_role_24m_plus", // 18
      oinpNocBroadCategory: "cat_3_health", // 10
      oinpNocTeer: "teer_0_1", // 9
      oinpLegalStatus: "work_permit", // 10
      oinpCraEarnings: "80k_plus", // 10 (Oct 5, 2026 bracket)
      oinpWorkRegion: "northern_ontario", // 15
      oinpCanadianCredentials: "two_or_more", // 10
    };

    const standardRes = calculatePnpScore(maxOinp);
    expect(standardRes.maxScore).toBe(132);
    expect(standardRes.totalScore).toBe(132);

    // Self-employed physician is exempt from the 15-pt wage factor -> 117/117
    const physicianRes = calculatePnpScore({
      ...maxOinp,
      oinpIsSelfEmployedPhysician: true,
    });
    expect(physicianRes.maxScore).toBe(117);
    expect(physicianRes.totalScore).toBe(117);

    // Monolingual official language candidate receives +5 pts under OINP "Knowledge of Official Languages: 1 Official Language"
    const monolingualClb7 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "ontario_oinp",
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 }, // 8 ability + 5 knowledge of 1 official language = 13
    });
    expect(monolingualClb7.totalScore).toBe(13);

    // Bilingual candidate where second test has higher CLB scores on strongest language (CLB 8 = 12) + 2 official languages (+10) = 22
    const strongerSecondLang = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "ontario_oinp",
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 6, listening: 6, reading: 6, writing: 6 },
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 8, listening: 8, reading: 8, writing: 8 },
    });
    expect(strongerSecondLang.totalScore).toBe(22);
  });

  it("scores BC PNP SIRS 200-point grid including exact $16–$70+/hr wage steps and Area 1 vs Area 2/3 regional bonus", () => {
    // Test exact sliding wage steps
    const wage16 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "bc_pnp",
      hourlyWage: 16,
    });
    expect(wage16.totalScore).toBe(1);

    const wage4550 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "bc_pnp",
      hourlyWage: 45.5, // floor(45.5) - 15 = 30
    });
    expect(wage4550.totalScore).toBe(30);

    // Area 1 (Metro Vancouver) must NOT grant the +10 regional experience/alumni bonus
    const area1 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "bc_pnp",
      bcEmploymentArea: "area_1_metro_vancouver",
      bcHasRegionalExperienceOrAlumni: true,
    });
    expect(area1.totalScore).toBe(0);

    // Full 200/200 BC PNP profile
    const maxBc = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "bc_pnp",
      educationLevel: "doctoral_or_md", // 27
      bcEducationLocation: "inside_bc", // +8
      bcHasEligibleProfessionalDesignation: true, // +5 = 40
      bcRelatedWorkYears: "5yr_plus", // 20
      bcHas1YrCanadianRelatedWork: true, // +10
      bcCurrentlyWorkingFullTimeInBcRole: true, // +10 = 40
      hasValidLanguageTest: true,
      firstLanguageTest: "celpip_g",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 }, // 30
      secondLanguageTest: "tcf_canada",
      secondLanguage: { speaking: 4, listening: 4, reading: 4, writing: 4 }, // +10 = 40
      hourlyWage: 72, // 55
      bcEmploymentArea: "area_3_rest_of_bc", // 15
      bcHasRegionalExperienceOrAlumni: true, // +10 = 25
    });
    expect(maxBc.totalScore).toBe(200);
  });

  it("scores Alberta AAIP 100-point grid (69 Human Capital + 31 Economic) including English 10 vs French 8 first-language rule", () => {
    const englishFirst = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "alberta_aaip",
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 6, listening: 6, reading: 6, writing: 6 },
    });
    expect(englishFirst.totalScore).toBe(10);

    const frenchFirst = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "alberta_aaip",
      hasValidLanguageTest: true,
      firstLanguageTest: "tef_canada",
      firstLanguage: { speaking: 6, listening: 6, reading: 6, writing: 6 },
    });
    expect(frenchFirst.totalScore).toBe(8);

    // Francophone candidate who ALSO holds English CLB 6+ receives max(10, 8) + 3 = 13 pts per AAIP official grid
    const frenchFirstWithEnglishClb6 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "alberta_aaip",
      hasValidLanguageTest: true,
      firstLanguageTest: "tef_canada",
      firstLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 },
      secondLanguageTest: "ielts_gt",
      secondLanguage: { speaking: 6, listening: 6, reading: 6, writing: 6 },
    });
    expect(frenchFirstWithEnglishClb6.totalScore).toBe(13);

    const maxAaip = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "alberta_aaip",
      age: 29, // 5
      educationLevel: "doctoral_or_md", // 12
      aaipEducationLocation: "alberta", // +10 = 22
      hasValidLanguageTest: true,
      firstLanguageTest: "celpip_g",
      firstLanguage: { speaking: 7, listening: 7, reading: 7, writing: 7 }, // 10
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 5, listening: 5, reading: 5, writing: 5 }, // +3 = 13
      aaipTotalWorkDuration: "12m_plus", // 11
      aaipCanadianWorkLocation: "alberta_6m", // +10 = 21
      aaipHasFamilyInAlberta: true, // 8 (69 HC)
      aaipHasValidJobOffer: true, // 10
      aaipIsPriorityRuralTourismOrPolice: true, // +6
      aaipJobLocation: "rural_or_outside_cma", // +5
      aaipIsRegulatedAndLicensedInAlberta: true, // +10 (31 Economic)
    });
    expect(maxAaip.totalScore).toBe(100);
  });

  it("scores Saskatchewan SINP 110-point grid, enforces 60-pt pass mark, 1-yr 6–10yr = 0 rule, and 30-pt Factor II cap", () => {
    // 1 year in 6–10 years ago yields 0 pts per SINP grid, while 2 years yields 2 pts
    const oneYrOlder = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "saskatchewan_sinp",
      sinpOlderWorkYears: 1,
    });
    expect(oneYrOlder.totalScore).toBe(0);
    expect(oneYrOlder.meetsPassMark).toBe(false);

    const twoYrOlder = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "saskatchewan_sinp",
      sinpOlderWorkYears: 2,
    });
    expect(twoYrOlder.totalScore).toBe(2);

    // Age 50 gets 8 pts, Age 51 gets 0 pts
    const age50 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "saskatchewan_sinp",
      age: 50,
    });
    expect(age50.totalScore).toBe(8);

    const age51 = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "saskatchewan_sinp",
      age: 51,
    });
    expect(age51.totalScore).toBe(0);

    // Factor II must cap strictly at 30 even if JAL (30) + Relative (20) + Past Work (5) + Past Study (5) = 60
    const maxSinp = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "saskatchewan_sinp",
      age: 30, // 12
      educationLevel: "masters", // 23
      sinpRecentWorkYears: 5, // 10
      sinpOlderWorkYears: 5, // 5
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 8, listening: 8, reading: 8, writing: 8 }, // 20
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 8, listening: 8, reading: 8, writing: 8 }, // 10 (Factor I = 80)
      sinpHasJobApprovalLetter: true, // 30
      sinpHasCloseRelativeInSk: true, // 20 (capped)
      sinpHasPastSkWork12Months: true, // 5 (capped)
      sinpHasPastSkStudy1Year: true, // 5 (capped)
    });
    expect(maxSinp.sections[1].points).toBe(30);
    expect(maxSinp.totalScore).toBe(110);
    expect(maxSinp.meetsPassMark).toBe(true);
  });

  it("scores Manitoba MPNP 1,000-point grid with per-band language scoring and -100 / -200 Risk Assessment deductions", () => {
    // Per-band language: CLB 8 (25) + CLB 7 (22) + CLB 6 (20) + CLB 5 (17) = 84 pts
    const perBand = calculatePnpScore({
      ...DEFAULT_PNP_INPUT,
      activeProvince: "manitoba_mpnp",
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 8, listening: 7, reading: 6, writing: 5 },
    });
    expect(perBand.totalScore).toBe(84);

    // Full 1,000-point profile vs -200 Risk Assessment deduction -> 800
    const maxMpnpBase: PnpCalculatorInput = {
      ...DEFAULT_PNP_INPUT,
      activeProvince: "manitoba_mpnp",
      age: 32, // 75
      educationLevel: "masters", // 125
      mpnpWorkYearsPast5: 4, // 75
      mpnpRecognizedByProvincialLicense: true, // +100 = 175
      hasValidLanguageTest: true,
      firstLanguageTest: "celpip_g",
      firstLanguage: { speaking: 8, listening: 8, reading: 8, writing: 8 }, // 100
      secondLanguageTest: "tef_canada",
      secondLanguage: { speaking: 5, listening: 5, reading: 5, writing: 5 }, // +25 = 125
      mpnpPrimaryAdaptability: "ongoing_mb_employment_or_strategic_ita", // 500
    };

    expect(calculatePnpScore(maxMpnpBase).totalScore).toBe(1000);

    const withRiskPenalties = calculatePnpScore({
      ...maxMpnpBase,
      mpnpRiskWorkedOtherProvince: true, // -100
      mpnpRiskStudiedOtherProvince: true, // -100
    });
    expect(withRiskPenalties.sections[2].points).toBe(-200);
    expect(withRiskPenalties.totalScore).toBe(800);
  });

  it("scores PEI PNP 100-point grid accurately across With-Job-Offer and Without-Job-Offer modes", () => {
    const maxPeiWithOffer: PnpCalculatorInput = {
      ...DEFAULT_PNP_INPUT,
      activeProvince: "pei_pnp",
      peiPathwayMode: "with_job_offer",
      age: 27, // 20
      educationLevel: "masters", // 15
      hasValidLanguageTest: true,
      firstLanguageTest: "ielts_gt",
      firstLanguage: { speaking: 9, listening: 9, reading: 9, writing: 9 }, // 20
      peiWorkYears: "6yr_plus", // 15 in with_job_offer mode
      peiWorkingInPeiOnPermit: true, // 5
      peiJobRelatedToStudy: true, // 5
      peiHas1YrContinuousPeiWork: true, // 5 = 15
      peiHasCloseFamilyInPei: true, // 5
      peiGraduatedFromPeiInstitution: true, // 5
      peiSpouseLanguageOrWorkQualified: true, // 5
      peiPropertyOrChildInPeiSchool: true, // capped at 15
    };
    expect(calculatePnpScore(maxPeiWithOffer).totalScore).toBe(100);

    // Without job offer: 6yr+ work yields 20, while PEI employment factors cap at 10 -> still 100 max
    const maxPeiWithoutOffer = calculatePnpScore({
      ...maxPeiWithOffer,
      peiPathwayMode: "without_job_offer",
    });
    expect(maxPeiWithoutOffer.totalScore).toBe(100);
  });
});

