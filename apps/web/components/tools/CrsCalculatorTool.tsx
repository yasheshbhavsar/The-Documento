"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CobrandedAgencyLeadWidget } from "../agency/CobrandedAgencyLeadWidget";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CountryCalculatorHeroCard } from "./CountryVisualIdentity";
import {
  ActiveLanguageTestType,
  calculateCrsScore,
  CanadianEducationCredential,
  CanadianWorkYears,
  CLBLevel,
  convertRawScoreToCLB,
  CrsCalculatorInput,
  CrsPolicyVersion,
  DEFAULT_CRS_INPUT,
  EducationLevel,
  evaluateExpressEntryDraws,
  ForeignWorkYears,
  generateCrsOptimizationTips,
  getAbilityBandOptions,
  getAllowedSecondLanguageTests,
  getRawScoreRangeSpec,
  HighWageTier,
  isFrenchTest,
  LANGUAGE_TEST_LABELS,
  LanguageAbilities,
  LanguageTestType,
  MaritalStatus,
  PrimaryOccupationTeer,
  swapFirstAndSecondLanguages,
} from "../../lib/crs/calculator";

const MARITAL_OPTIONS: Array<{ value: MaritalStatus; label: string }> = [
  { value: "never_married", label: "Never Married / Single" },
  { value: "married", label: "Married" },
  { value: "common_law", label: "Common-Law Partner" },
  { value: "divorced_separated", label: "Divorced / Separated" },
  { value: "legally_separated", label: "Legally Separated" },
  { value: "annulled", label: "Annulled Marriage" },
  { value: "widowed", label: "Widowed" },
];

const EDUCATION_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: "less_than_secondary", label: "Less than secondary school (high school)" },
  { value: "secondary", label: "Secondary diploma (high school graduation)" },
  {
    value: "one_year_post_secondary",
    label: "One-year degree, diploma or certificate from a university, college, trade or technical school",
  },
  {
    value: "two_year_post_secondary",
    label: "Two-year program at a university, college, trade or technical school",
  },
  {
    value: "bachelors_or_three_year",
    label: "Bachelor's degree OR a three or more year program at a university, college, trade or technical school",
  },
  {
    value: "two_or_more_credentials",
    label: "Two or more certificates, diplomas or degrees (one must be for a program of three or more years)",
  },
  {
    value: "masters_or_professional",
    label: "Master's degree, OR professional degree needed to practice in a licensed profession (MD, PharmD, JD, DVM, DDS, OD)",
  },
  {
    value: "doctoral_phd",
    label: "Doctoral level university degree (Ph.D.)",
  },
];

const AGE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 17, label: "17 years of age or less" },
  ...Array.from({ length: 29 }, (_, idx) => {
    const yr = 18 + idx;
    return { value: yr, label: `${yr} years of age` };
  }),
  { value: 47, label: "47 years of age or more" },
];

const ABILITY_META: Array<{ key: keyof LanguageAbilities; label: string }> = [
  { key: "speaking", label: "Speaking" },
  { key: "listening", label: "Listening" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
];

const FIRST_LANG_TEST_ORDER: ActiveLanguageTestType[] = [
  "ielts_gt",
  "celpip_g",
  "pte_core",
  "clb_direct",
  "tef_canada",
  "tcf_canada",
  "nclc_direct",
];

type RawScoreInputMap = Record<
  "firstLanguage" | "secondLanguage" | "spouseLanguage",
  Record<keyof LanguageAbilities, string>
>;

const EMPTY_RAW_SCORES: RawScoreInputMap = {
  firstLanguage: { speaking: "", listening: "", reading: "", writing: "" },
  secondLanguage: { speaking: "", listening: "", reading: "", writing: "" },
  spouseLanguage: { speaking: "", listening: "", reading: "", writing: "" },
};

export function CrsCalculatorTool() {
  const [form, setForm] = useState<CrsCalculatorInput>(DEFAULT_CRS_INPUT);
  const [previousBeforePreview, setPreviousBeforePreview] =
    useState<CrsCalculatorInput | null>(null);
  const [useExactRawScores, setUseExactRawScores] = useState<boolean>(false);
  const [rawScores, setRawScores] = useState<RawScoreInputMap>(EMPTY_RAW_SCORES);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);
  const [expandedLedgerSection, setExpandedLedgerSection] = useState<
    Record<"core" | "spouse" | "transfer" | "additional", boolean>
  >({
    core: true,
    spouse: true,
    transfer: true,
    additional: true,
  });

  // Hydrate shared profile from URL (?crs=...) if present on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("crs");
      if (encoded) {
        const json = decodeURIComponent(atob(encoded));
        const parsed = JSON.parse(json) as Partial<CrsCalculatorInput>;
        if (parsed && typeof parsed === "object") {
          setForm({ ...DEFAULT_CRS_INPUT, ...parsed });
        }
      }
    } catch {
      // Ignore malformed query parameter
    }
  }, []);

  const breakdown = useMemo(() => calculateCrsScore(form), [form]);
  const tips = useMemo(() => generateCrsOptimizationTips(form, breakdown), [form, breakdown]);
  const drawBenchmarks = useMemo(
    () => evaluateExpressEntryDraws(breakdown.grandTotal, form, breakdown.diagnostics),
    [breakdown.grandTotal, form, breakdown.diagnostics]
  );

  const hasPartnerRelationship =
    form.maritalStatus === "married" || form.maritalStatus === "common_law";

  const allowedSecondTests = useMemo(
    () => getAllowedSecondLanguageTests(form.firstLanguageTest),
    [form.firstLanguageTest]
  );

  const updateForm = (patch: Partial<CrsCalculatorInput>) => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleFirstLanguageTestChange = (newTest: LanguageTestType) => {
    setPreviousBeforePreview(null);
    setRawScores((prev) => ({
      ...prev,
      firstLanguage: { speaking: "", listening: "", reading: "", writing: "" },
    }));
    setForm((prev) => {
      const nextAllowed = getAllowedSecondLanguageTests(newTest);
      const nextSecond = nextAllowed.includes(prev.secondLanguageTest)
        ? prev.secondLanguageTest
        : "none";
      return {
        ...prev,
        firstLanguageTest: newTest,
        firstLanguage:
          newTest === "none"
            ? { speaking: 0, listening: 0, reading: 0, writing: 0 }
            : prev.firstLanguage,
        secondLanguageTest: nextSecond,
        secondLanguage:
          nextSecond === "none"
            ? { speaking: 0, listening: 0, reading: 0, writing: 0 }
            : prev.secondLanguage,
      };
    });
  };

  const updateAbility = (
    target: "firstLanguage" | "secondLanguage" | "spouseLanguage",
    ability: keyof LanguageAbilities,
    clb: CLBLevel
  ) => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({
      ...prev,
      [target]: {
        ...prev[target],
        [ability]: clb,
      },
    }));
  };

  const handleRawScoreChange = (
    target: "firstLanguage" | "secondLanguage" | "spouseLanguage",
    test: ActiveLanguageTestType,
    ability: keyof LanguageAbilities,
    rawText: string
  ) => {
    setRawScores((prev) => ({
      ...prev,
      [target]: {
        ...prev[target],
        [ability]: rawText,
      },
    }));
    const trimmed = rawText.trim();
    if (!trimmed) {
      updateAbility(target, ability, 0);
      return;
    }
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      const convertedClb = convertRawScoreToCLB(test, ability, num);
      updateAbility(target, ability, convertedClb);
    }
  };

  const resetToZero = () => {
    setPreviousBeforePreview(null);
    setRawScores(EMPTY_RAW_SCORES);
    setForm((prev) => ({
      ...DEFAULT_CRS_INPUT,
      policyVersion: prev.policyVersion,
    }));
  };

  const handleSwapLanguages = () => {
    setPreviousBeforePreview(null);
    setRawScores(EMPTY_RAW_SCORES);
    setForm((prev) => swapFirstAndSecondLanguages(prev));
  };

  const handlePreviewTip = (previewInput: CrsCalculatorInput) => {
    setPreviousBeforePreview((prev) => prev ?? form);
    setForm(previewInput);
  };

  const handleUndoPreview = () => {
    if (!previousBeforePreview) return;
    setForm(previousBeforePreview);
    setPreviousBeforePreview(null);
  };

  const buildPlainTextSummary = (): string => {
    const ageDisplay =
      form.age === null
        ? "Not selected"
        : form.age === 47
          ? "47+"
          : form.age === 17
            ? "17 or under"
            : String(form.age);

    const lines = [
      "======================================================================",
      "THE DOCUMENTO — CANADIAN EXPRESS ENTRY CRS SCORE ASSESSMENT",
      "Based on Official IRCC / Canada.ca Ministerial Instructions",
      "======================================================================",
      `Rule Standard: ${
        form.policyVersion === "nov_2026_lmi"
          ? "Latest IRCC Standard (Nov 2026 Labour Market Integration — Max 1,270)"
          : "Mar 2025 – Oct 2026 IRCC Baseline (0 Job-Offer Points — Max 1,200)"
      }`,
      `Scoring Grid: ${
        breakdown.withSpouse
          ? "With Accompanying Spouse / Common-Law Partner"
          : "Single / Non-Accompanying Spouse Grid"
      }`,
      `Express Entry Pool Entry Status: ${
        breakdown.diagnostics.expressEntryPoolEligible
          ? "ELIGIBLE (Meets minimum FSW, CEC, or FST entry threshold)"
          : "NOT YET ELIGIBLE FOR POOL ENTRY"
      }`,
      `Estimated FSW Selection Grid Score: ${breakdown.diagnostics.fswSelectionPoints} / 100 (Pass mark: 67)`,
      "",
      `COMPREHENSIVE RANKING SYSTEM GRAND TOTAL: ${breakdown.grandTotal} / ${breakdown.grandTotalCap.toLocaleString()}`,
      "----------------------------------------------------------------------",
      `A. Core / Human Capital Factors:          ${breakdown.coreHumanCapital.total} / ${breakdown.coreHumanCapital.sectionCap}`,
      `   - Age (${ageDisplay}):                        ${breakdown.coreHumanCapital.age}`,
      `   - Level of Education:                  ${breakdown.coreHumanCapital.education}`,
      `   - First Official Language:             ${breakdown.coreHumanCapital.firstOfficialLanguage}`,
      `   - Second Official Language:            ${breakdown.coreHumanCapital.secondOfficialLanguage}`,
      `   - Labour Market / Canadian Work:       ${breakdown.coreHumanCapital.labourMarketIntegration}`,
      "",
      `B. Spouse / Common-Law Partner Factors:   ${breakdown.spouseFactors.total} / 40`,
      `   - Spouse Education:                    ${breakdown.spouseFactors.education}`,
      `   - Spouse First Official Language:      ${breakdown.spouseFactors.firstOfficialLanguage}`,
      `   - Spouse Canadian Work Experience:     ${breakdown.spouseFactors.canadianWorkExperience}`,
      "",
      `C. Skill Transferability Factors:         ${breakdown.skillTransferability.total} / 100`,
      `   - Education Transferability (Max 50):  ${breakdown.skillTransferability.educationSubtotalCapped}`,
      `   - Foreign Work Transferability (Max 50): ${breakdown.skillTransferability.foreignWorkSubtotalCapped}`,
      `   - Certificate of Qualification:        ${breakdown.skillTransferability.certificateOfQualificationWithLanguage}`,
      "",
      `D. Additional Points:                     ${breakdown.additionalPoints.total} / 600`,
      `   - Provincial Nomination (PNP):         ${breakdown.additionalPoints.provincialNomination}`,
      `   - French Language NCLC 7+ Bonus:       ${breakdown.additionalPoints.frenchLanguageSkills}`,
      `   - Post-Secondary Study in Canada:      ${breakdown.additionalPoints.postSecondaryEducationInCanada}`,
      `   - Sibling in Canada (Citizen/PR):      ${breakdown.additionalPoints.siblingInCanada}`,
      "----------------------------------------------------------------------",
      "Generated via The Documento (thedocumento.com/crs-calculator)",
      "Disclaimer: Informational calculation aligned with published IRCC tables; not legal advice.",
    ];
    return lines.join("\n");
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildPlainTextSummary());
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyShareLink = async () => {
    if (typeof window === "undefined") return;
    try {
      const encoded = btoa(encodeURIComponent(JSON.stringify(form)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?crs=${encodeURIComponent(encoded)}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([buildPlainTextSummary()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Documento_CRS_Score_${breakdown.grandTotal}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "8px",
    border: "1px solid #BDCDC7",
    background: "#FFFFFF",
    color: "#172322",
    fontSize: "14.5px",
    fontWeight: 500,
    lineHeight: 1.4,
    cursor: "pointer",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "14.5px",
    fontWeight: 650,
    color: "#172322",
    marginBottom: "8px",
  };

  const cardSectionStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #DCE5E1",
    borderRadius: "12px",
    padding: "28px",
  };

  const renderClbTag = (clb: CLBLevel, french: boolean) => {
    if (clb === 0) return "Not selected";
    const prefix = french ? "NCLC" : "CLB";
    if (clb === 10) return `${prefix} 10+`;
    if (clb === 3) return `< ${prefix} 4`;
    return `${prefix} ${clb}`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F7F2",
        color: "#172322",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Top Sticky Documento Navigation Bar */}
      <header
        className="crs-no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "#FFFFFF",
          borderBottom: "1px solid #DCE5E1",
        }}
      >
        <div
          style={{
            maxWidth: "1320px",
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              <DocumentoLogo size="md" showWordmark showDomain />
            </Link>
            <span
              aria-hidden="true"
              style={{ width: "1px", height: "20px", background: "#DCE5E1", display: "inline-block" }}
            />
            <span style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
              Canada Express Entry CRS Calculator
            </span>
          </div>

          <nav
            aria-label="Calculator Navigation"
            style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
          >
            {previousBeforePreview && (
              <button
                type="button"
                onClick={handleUndoPreview}
                style={{
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "1px solid #8A5A10",
                  background: "#FEF7EA",
                  color: "#8A5A10",
                  fontSize: "13px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                ↩ Undo Booster Preview
              </button>
            )}
            {breakdown.diagnostics.hasAnyInput && (
              <button
                type="button"
                onClick={resetToZero}
                style={{
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "1px solid #BDCDC7",
                  background: "#F1F6F4",
                  color: "#063C3D",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset to 0
              </button>
            )}
            <Link
              href="/"
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#445451",
                padding: "8px 12px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              Platform Overview
            </Link>
            <Link
              href="/calculators"
              style={{
                fontSize: "13.5px",
                fontWeight: 650,
                color: "#063C3D",
                background: "#F4F8F6",
                border: "1px solid #BDCDC7",
                padding: "7px 13px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              ← PR Calculators
            </Link>
            <Link
              href="/pnp-calculator"
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#063C3D",
                background: "#F4F8F6",
                border: "1px solid #DCE5E1",
                padding: "7px 13px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              PNP Points Calculator
            </Link>
            <Link
              href="/extractor"
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#0D6866",
                background: "#EAF5EF",
                padding: "8px 14px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              AI Document Lab
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                fontSize: "13.5px",
                fontWeight: 650,
                color: "#FFFFFF",
                background: "#063C3D",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Print Official Sheet
            </button>
          </nav>
        </div>
      </header>
      <div className="crs-no-print">
        <CalculatorCountrySwitchBar activeCalculatorId="ca_crs" />
      </div>

      {/* Main Content Container */}
      <main
        className="crs-main-container"
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
          padding: "36px 24px 96px 24px",
        }}
      >
        {/* Title & IRCC Ministerial Instructions Bar */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "24px",
            alignItems: "end",
            marginBottom: "28px",
            paddingBottom: "24px",
            borderBottom: "1px solid #DCE5E1",
          }}
        >
          <div className="crs-hero-left" style={{ gridColumn: "span 8" }}>
            <h1
              style={{
                fontSize: "clamp(28px, 3.4vw, 42px)",
                fontWeight: 750,
                color: "#063C3D",
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                margin: "0 0 12px 0",
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
              }}
            >
              Express Entry CRS Score Calculator
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "#445451",
                lineHeight: 1.55,
                margin: 0,
                maxWidth: "740px",
              }}
            >
              Replicates Immigration, Refugees and Citizenship Canada (IRCC) Ministerial Instructions across Core Human Capital, Spouse Factors, Skill Transferability, and Additional Points out of {breakdown.grandTotalCap.toLocaleString()}, plus FSW / CEC / FST pool-entry checks.
            </p>
          </div>

          {/* Policy Rule Switcher */}
          <div
            className="crs-hero-right crs-no-print"
            style={{
              gridColumn: "span 4",
            }}
          >
            <CountryCalculatorHeroCard
              countryId="canada"
              authorityLabel="IRCC Official Standard"
              headlineMetric={`Express Entry CRS • Max ${breakdown.grandTotalCap.toLocaleString()} Pts`}
            >
              <label
                htmlFor="crs-policy-version"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 650,
                  color: "#063C3D",
                  marginBottom: "5px",
                }}
              >
                IRCC Ministerial Instructions Standard
              </label>
              <select
                id="crs-policy-version"
                value={form.policyVersion}
                onChange={(e) => updateForm({ policyVersion: e.target.value as CrsPolicyVersion })}
                style={{
                  ...selectStyle,
                  padding: "7px 10px",
                  fontSize: "13px",
                }}
              >
                <option value="nov_2026_lmi">
                  Latest Canada.ca Standard (Nov 2026 Labour Market Integration • Max 1,270)
                </option>
                <option value="mar_2025_no_job_offer">
                  Mar 2025 – Oct 2026 Baseline (0 Job-Offer Points • Max 1,200)
                </option>
              </select>
            </CountryCalculatorHeroCard>
          </div>
        </section>

        {/* Main 12-Column Grid: Questionnaire (7) + Sticky Official CRS Ledger (5) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "28px",
            alignItems: "start",
          }}
        >
          {/* ================================================================
              LEFT COLUMN (7 cols): OFFICIAL CANADA.CA QUESTIONNAIRE
              ================================================================ */}
          <div
            className="crs-form-col"
            style={{
              gridColumn: "span 7",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* 1. Marital Status, Partner & Age */}
            <section style={cardSectionStyle} aria-labelledby="crs-sec-personal">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <h2
                  id="crs-sec-personal"
                  style={{
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Marital Status &amp; Age
                </h2>
                <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#0D6866" }}>
                  Age Score: {breakdown.coreHumanCapital.age} / {breakdown.withSpouse ? 100 : 110} pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="crs-marital" style={labelStyle}>
                    <span>What is your marital status?</span>
                  </label>
                  <select
                    id="crs-marital"
                    value={form.maritalStatus}
                    onChange={(e) => {
                      const val = e.target.value as MaritalStatus | "";
                      const isPartnered = val === "married" || val === "common_law";
                      updateForm({
                        maritalStatus: val,
                        spouseIsCanadianCitizenOrPR: isPartnered
                          ? form.spouseIsCanadianCitizenOrPR
                          : null,
                        spouseAccompanying: isPartnered ? form.spouseAccompanying : null,
                      });
                    }}
                    style={selectStyle}
                  >
                    <option value="">Select marital status...</option>
                    {MARITAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {hasPartnerRelationship && (
                  <div
                    style={{
                      background: "#F4F8F6",
                      border: "1px solid #DCE5E1",
                      borderRadius: "10px",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div style={labelStyle}>
                        <span>
                          Is your spouse or common-law partner a citizen or permanent resident of Canada?
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {[
                          { label: "Yes", value: true },
                          { label: "No", value: false },
                        ].map((choice) => {
                          const active = form.spouseIsCanadianCitizenOrPR === choice.value;
                          return (
                            <button
                              key={choice.label}
                              type="button"
                              onClick={() =>
                                updateForm({
                                  spouseIsCanadianCitizenOrPR: choice.value,
                                  spouseAccompanying: choice.value
                                    ? false
                                    : form.spouseAccompanying,
                                })
                              }
                              style={{
                                flex: 1,
                                padding: "9px 14px",
                                borderRadius: "8px",
                                border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                                background: active ? "#063C3D" : "#FFFFFF",
                                color: active ? "#FFFFFF" : "#172322",
                                fontWeight: 600,
                                fontSize: "14px",
                                cursor: "pointer",
                              }}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {form.spouseIsCanadianCitizenOrPR === false && (
                      <div>
                        <div style={labelStyle}>
                          <span>Will your spouse or common-law partner come with you to Canada?</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          {[
                            { label: "Yes (Accompanying)", value: true },
                            { label: "No (Non-Accompanying)", value: false },
                          ].map((choice) => {
                            const active = form.spouseAccompanying === choice.value;
                            return (
                              <button
                                key={choice.label}
                                type="button"
                                onClick={() => updateForm({ spouseAccompanying: choice.value })}
                                style={{
                                  flex: 1,
                                  padding: "9px 14px",
                                  borderRadius: "8px",
                                  border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                                  background: active ? "#063C3D" : "#FFFFFF",
                                  color: active ? "#FFFFFF" : "#172322",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  cursor: "pointer",
                                }}
                              >
                                {choice.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(form.spouseIsCanadianCitizenOrPR !== null ||
                      form.spouseAccompanying !== null) && (
                      <p style={{ margin: 0, fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
                        {breakdown.withSpouse
                          ? `IRCC evaluates you on the Accompanying Spouse grid (up to ${breakdown.coreHumanCapital.sectionCap} Core points + up to 40 Spouse points).`
                          : `Because your partner is a Canadian citizen/PR or non-accompanying, IRCC evaluates you on the Single Applicant grid (up to ${breakdown.coreHumanCapital.sectionCap} Core points).`}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="crs-age" style={labelStyle}>
                    <span>How old are you?</span>
                    <span style={{ fontSize: "12.5px", fontWeight: 500, color: "#445451" }}>
                      Peak points at ages 20–29
                    </span>
                  </label>
                  <select
                    id="crs-age"
                    value={form.age === null ? "" : form.age}
                    onChange={(e) =>
                      updateForm({
                        age: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select your age...</option>
                    {AGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {form.age !== null && breakdown.diagnostics.nextBirthdayAgeLoss > 0 && (
                    <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#8A5A10" }}>
                      Birthday Lock-In Advisory: Turning {form.age + 1} reduces your Age score by{" "}
                      <strong>{breakdown.diagnostics.nextBirthdayAgeLoss} pts</strong> unless you receive an Invitation to Apply (ITA) before your birthday.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 2. Education & Canadian Study */}
            <section style={cardSectionStyle} aria-labelledby="crs-sec-edu">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <h2
                  id="crs-sec-edu"
                  style={{
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Education &amp; Canadian Credentials
                </h2>
                <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#0D6866" }}>
                  Core: {breakdown.coreHumanCapital.education} pts
                  {breakdown.additionalPoints.postSecondaryEducationInCanada > 0
                    ? ` + ${breakdown.additionalPoints.postSecondaryEducationInCanada} CAN Bonus`
                    : ""}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="crs-education" style={labelStyle}>
                    <span>What is your level of education?</span>
                  </label>
                  <select
                    id="crs-education"
                    value={form.educationLevel}
                    onChange={(e) =>
                      updateForm({ educationLevel: e.target.value as EducationLevel | "" })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select highest level of education...</option>
                    {EDUCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#445451" }}>
                    Foreign credentials require an approved Educational Credential Assessment (ECA) issued within the last 5 years matching the Canadian equivalency above.
                  </p>
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>Have you earned a Canadian degree, diploma or certificate?</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[
                      { label: "Yes", value: true },
                      { label: "No", value: false },
                    ].map((choice) => {
                      const active = form.hasCanadianDegree === choice.value;
                      return (
                        <button
                          key={choice.label}
                          type="button"
                          onClick={() =>
                            updateForm({
                              hasCanadianDegree: choice.value,
                              canadianEducationCredential: choice.value
                                ? form.canadianEducationCredential
                                : "none",
                            })
                          }
                          style={{
                            flex: 1,
                            padding: "9px 14px",
                            borderRadius: "8px",
                            border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                            background: active ? "#063C3D" : "#FFFFFF",
                            color: active ? "#FFFFFF" : "#172322",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: "pointer",
                          }}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.hasCanadianDegree === true && (
                  <div
                    style={{
                      background: "#F4F8F6",
                      border: "1px solid #DCE5E1",
                      borderRadius: "10px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <label htmlFor="crs-can-edu" style={labelStyle}>
                        <span>Choose the best answer to describe this Canadian study level</span>
                      </label>
                      <select
                        id="crs-can-edu"
                        value={form.canadianEducationCredential}
                        onChange={(e) =>
                          updateForm({
                            canadianEducationCredential: e.target
                              .value as CanadianEducationCredential,
                          })
                        }
                        style={selectStyle}
                      >
                        <option value="none">Select Canadian credential level...</option>
                        <option value="secondary_or_less">
                          Secondary (high school) or less (+0 bonus pts)
                        </option>
                        <option value="one_or_two_year">
                          One- or two-year diploma or certificate (+15 bonus pts)
                        </option>
                        <option value="three_year_or_masters_phd">
                          Degree, diploma or certificate of three years or longer OR a Master&apos;s, professional or doctoral degree of at least one academic year (+30 bonus pts)
                        </option>
                      </select>
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        fontSize: "13px",
                        color: "#172322",
                        lineHeight: 1.5,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.canadianStudyMeetsDliRules !== false}
                        onChange={(e) =>
                          updateForm({ canadianStudyMeetsDliRules: e.target.checked })
                        }
                        style={{ marginTop: "3px", accentColor: "#063C3D", cursor: "pointer" }}
                      />
                      <span>
                        Studied full-time in Canada for at least 8 months at a Designated Learning Institution (DLI), with &lt;50% ESL/FSL or distance learning, and no return-home scholarship condition.
                      </span>
                    </label>

                    {breakdown.diagnostics.educationConsistencyWarning && (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "#FEF7EA",
                          border: "1px solid #F0D9B5",
                          fontSize: "12.5px",
                          color: "#8A5A10",
                          lineHeight: 1.5,
                        }}
                      >
                        {breakdown.diagnostics.educationConsistencyWarning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* 3. Official Languages (English & French) */}
            <section style={cardSectionStyle} aria-labelledby="crs-sec-lang">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <h2
                  id="crs-sec-lang"
                  style={{
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Official Languages Proficiency
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {form.hasValidLanguageTest === true && (
                    <button
                      type="button"
                      className="crs-no-print"
                      onClick={() => setUseExactRawScores((v) => !v)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: useExactRawScores ? "1px solid #063C3D" : "1px solid #BDCDC7",
                        background: useExactRawScores ? "#063C3D" : "#F4F8F6",
                        color: useExactRawScores ? "#FFFFFF" : "#063C3D",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      {useExactRawScores ? "✓ Exact Score Input Active" : "Type Exact Raw Scores"}
                    </button>
                  )}
                  <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#0D6866" }}>
                    {breakdown.coreHumanCapital.firstOfficialLanguage +
                      breakdown.coreHumanCapital.secondOfficialLanguage}{" "}
                    / {breakdown.withSpouse ? 150 : 160} pts
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Official Canada.ca Question 5 Gate: Test < 2 years old */}
                <div>
                  <div style={labelStyle}>
                    <span>
                      Are your official language test results valid and less than 2 years old?
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[
                      { label: "Yes (Valid < 2 Years)", value: true },
                      { label: "No / Not Taken Yet", value: false },
                    ].map((choice) => {
                      const active = form.hasValidLanguageTest === choice.value;
                      return (
                        <button
                          key={choice.label}
                          type="button"
                          onClick={() => updateForm({ hasValidLanguageTest: choice.value })}
                          style={{
                            flex: 1,
                            padding: "9px 14px",
                            borderRadius: "8px",
                            border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                            background: active ? "#063C3D" : "#FFFFFF",
                            color: active ? "#FFFFFF" : "#172322",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: "pointer",
                          }}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.hasValidLanguageTest === false && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "11px 14px",
                        borderRadius: "8px",
                        background: "#FDF2F2",
                        border: "1px solid #F2B8B5",
                        color: "#9E2A2B",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Express Entry Statutory Requirement:</strong> You must hold valid IRCC-approved language test results less than 2 years old to submit an Express Entry profile. Language and language-transferability points are 0.
                    </div>
                  )}
                </div>

                {form.hasValidLanguageTest === true && (
                  <>
                    {/* Bilingual Swap Optimization Guardrail */}
                    {breakdown.diagnostics.languageSwapGain > 0 && (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "#EAF6F0",
                          border: "1px solid #B9DED4",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div style={{ fontSize: "13px", color: "#063C3D", lineHeight: 1.5 }}>
                          <strong>+{breakdown.diagnostics.languageSwapGain} CRS pts available immediately:</strong>{" "}
                          Your second official language yields higher First Official Language &amp; Skill Transferability points.
                        </div>
                        <button
                          type="button"
                          onClick={handleSwapLanguages}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#063C3D",
                            color: "#FFFFFF",
                            fontSize: "12.5px",
                            fontWeight: 650,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Swap 1st &amp; 2nd Language (+{breakdown.diagnostics.languageSwapGain} pts)
                        </button>
                      </div>
                    )}

                    {/* First Official Language */}
                    <div>
                      <label htmlFor="crs-first-lang-test" style={labelStyle}>
                        <span>Which language test did you take for your first official language?</span>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0D6866" }}>
                          {breakdown.coreHumanCapital.firstOfficialLanguage} /{" "}
                          {breakdown.withSpouse ? 128 : 136} pts
                        </span>
                      </label>
                      <select
                        id="crs-first-lang-test"
                        value={form.firstLanguageTest}
                        onChange={(e) =>
                          handleFirstLanguageTestChange(e.target.value as LanguageTestType)
                        }
                        style={selectStyle}
                      >
                        <option value="none">Select first official language test...</option>
                        {FIRST_LANG_TEST_ORDER.map((t) => (
                          <option key={t} value={t}>
                            {LANGUAGE_TEST_LABELS[t]}
                          </option>
                        ))}
                      </select>

                      {form.firstLanguageTest === "tef_canada" && (
                        <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#8A5A10" }}>
                          IRCC Note: Enter scores from the &ldquo;Équivalence ancien score&rdquo; column (0–300 Reading, 0–360 Listening, 0–450 Writing/Speaking), not the /699 column.
                        </p>
                      )}

                      {form.firstLanguageTest !== "none" && (
                        <div
                          className="crs-ability-grid"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: "12px",
                            marginTop: "14px",
                          }}
                        >
                          {ABILITY_META.map(({ key, label }) => {
                            const activeFirstTest =
                              form.firstLanguageTest as ActiveLanguageTestType;
                            const options = getAbilityBandOptions(activeFirstTest, key);
                            const rawSpec = useExactRawScores
                              ? getRawScoreRangeSpec(activeFirstTest, key)
                              : null;
                            const abilityPts =
                              breakdown.coreHumanCapital.firstLanguagePerAbility[key];
                            const currentClb = form.firstLanguage[key];
                            const french = isFrenchTest(activeFirstTest);

                            return (
                              <div
                                key={key}
                                style={{
                                  background: "#F8F7F2",
                                  border: "1px solid #DCE5E1",
                                  borderRadius: "10px",
                                  padding: "12px",
                                }}
                              >
                                <label
                                  htmlFor={`first-lang-${key}`}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "13.5px",
                                    fontWeight: 650,
                                    color: "#172322",
                                    marginBottom: "6px",
                                  }}
                                >
                                  <span>{label}</span>
                                  <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                                    {renderClbTag(currentClb, french)} • {abilityPts} pts
                                  </span>
                                </label>
                                {rawSpec && (
                                  <input
                                    type="number"
                                    min={rawSpec.min}
                                    max={rawSpec.max}
                                    step={rawSpec.step}
                                    placeholder={`Exact score (${rawSpec.placeholder})`}
                                    value={rawScores.firstLanguage[key]}
                                    onChange={(e) =>
                                      handleRawScoreChange(
                                        "firstLanguage",
                                        activeFirstTest,
                                        key,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      ...selectStyle,
                                      padding: "7px 10px",
                                      fontSize: "13px",
                                      marginBottom: "6px",
                                    }}
                                  />
                                )}
                                <select
                                  id={`first-lang-${key}`}
                                  value={currentClb}
                                  onChange={(e) =>
                                    updateAbility(
                                      "firstLanguage",
                                      key,
                                      Number(e.target.value) as CLBLevel
                                    )
                                  }
                                  style={{ ...selectStyle, padding: "9px 10px", fontSize: "13.5px" }}
                                >
                                  <option value={0}>Select score...</option>
                                  {options.map((opt) => (
                                    <option key={opt.clb} value={opt.clb}>
                                      {opt.scoreLabel}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Second Official Language */}
                    {form.firstLanguageTest !== "none" && (
                      <div
                        style={{
                          borderTop: "1px solid #E7EFEB",
                          paddingTop: "18px",
                        }}
                      >
                        <label htmlFor="crs-second-lang-test" style={labelStyle}>
                          <span>Do you have valid test results for your second official language?</span>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0D6866" }}>
                            {breakdown.coreHumanCapital.secondOfficialLanguage} /{" "}
                            {breakdown.coreHumanCapital.secondLanguageCap} pts
                            {breakdown.additionalPoints.frenchLanguageSkills > 0
                              ? ` (+${breakdown.additionalPoints.frenchLanguageSkills} French Bonus)`
                              : ""}
                          </span>
                        </label>
                        <select
                          id="crs-second-lang-test"
                          value={form.secondLanguageTest}
                          onChange={(e) => {
                            const nextVal = e.target.value as LanguageTestType;
                            setRawScores((prev) => ({
                              ...prev,
                              secondLanguage: {
                                speaking: "",
                                listening: "",
                                reading: "",
                                writing: "",
                              },
                            }));
                            updateForm({
                              secondLanguageTest: nextVal,
                              secondLanguage:
                                nextVal === "none"
                                  ? { speaking: 0, listening: 0, reading: 0, writing: 0 }
                                  : form.secondLanguage,
                            });
                          }}
                          style={selectStyle}
                        >
                          {allowedSecondTests.map((t) => (
                            <option key={t} value={t}>
                              {LANGUAGE_TEST_LABELS[t]}
                            </option>
                          ))}
                        </select>

                        {form.secondLanguageTest === "tef_canada" && (
                          <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#8A5A10" }}>
                            IRCC Note: Enter scores from the &ldquo;Équivalence ancien score&rdquo; column (0–300 Reading, 0–360 Listening, 0–450 Writing/Speaking), not the /699 column.
                          </p>
                        )}

                        {form.secondLanguageTest !== "none" && (
                          <div
                            className="crs-ability-grid"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, 1fr)",
                              gap: "12px",
                              marginTop: "14px",
                            }}
                          >
                            {ABILITY_META.map(({ key, label }) => {
                              const activeSecondTest =
                                form.secondLanguageTest as ActiveLanguageTestType;
                              const options = getAbilityBandOptions(activeSecondTest, key);
                              const rawSpec = useExactRawScores
                                ? getRawScoreRangeSpec(activeSecondTest, key)
                                : null;
                              const currentClb = form.secondLanguage[key];
                              const abilityPts =
                                breakdown.coreHumanCapital.secondLanguagePerAbility[key];
                              const french = isFrenchTest(activeSecondTest);

                              return (
                                <div
                                  key={key}
                                  style={{
                                    background: "#F8F7F2",
                                    border: "1px solid #DCE5E1",
                                    borderRadius: "10px",
                                    padding: "12px",
                                  }}
                                >
                                  <label
                                    htmlFor={`second-lang-${key}`}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontSize: "13.5px",
                                      fontWeight: 650,
                                      color: "#172322",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    <span>{label}</span>
                                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                                      {renderClbTag(currentClb, french)} • {abilityPts} pts
                                    </span>
                                  </label>
                                  {rawSpec && (
                                    <input
                                      type="number"
                                      min={rawSpec.min}
                                      max={rawSpec.max}
                                      step={rawSpec.step}
                                      placeholder={`Exact score (${rawSpec.placeholder})`}
                                      value={rawScores.secondLanguage[key]}
                                      onChange={(e) =>
                                        handleRawScoreChange(
                                          "secondLanguage",
                                          activeSecondTest,
                                          key,
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        ...selectStyle,
                                        padding: "7px 10px",
                                        fontSize: "13px",
                                        marginBottom: "6px",
                                      }}
                                    />
                                  )}
                                  <select
                                    id={`second-lang-${key}`}
                                    value={currentClb}
                                    onChange={(e) =>
                                      updateAbility(
                                        "secondLanguage",
                                        key,
                                        Number(e.target.value) as CLBLevel
                                      )
                                    }
                                    style={{ ...selectStyle, padding: "9px 10px", fontSize: "13.5px" }}
                                  >
                                    <option value={0}>Select score...</option>
                                    {options.map((opt) => (
                                      <option key={opt.clb} value={opt.clb}>
                                        {opt.scoreLabel}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* 4. Work Experience & Labour Market Integration */}
            <section style={cardSectionStyle} aria-labelledby="crs-sec-work">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <h2
                  id="crs-sec-work"
                  style={{
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Work Experience &amp; Labour Market Integration
                </h2>
                <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#0D6866" }}>
                  Core: {breakdown.coreHumanCapital.labourMarketIntegration} /{" "}
                  {breakdown.coreHumanCapital.labourMarketSectionCap} pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="crs-can-work" style={labelStyle}>
                    <span>
                      In the last 10 years, how many years of skilled work experience in Canada do you have?
                    </span>
                  </label>
                  <select
                    id="crs-can-work"
                    value={form.canadianWorkYears === null ? "" : form.canadianWorkYears}
                    onChange={(e) =>
                      updateForm({
                        canadianWorkYears:
                          e.target.value === ""
                            ? null
                            : (Number(e.target.value) as CanadianWorkYears),
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select Canadian skilled work experience...</option>
                    <option value={0}>None or less than a year</option>
                    <option value={1}>1 year (1,560 hours full-time or equivalent)</option>
                    <option value={2}>2 years</option>
                    <option value={3}>3 years</option>
                    <option value={4}>4 years</option>
                    <option value={5}>5 years or more</option>
                  </select>
                  <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#445451" }}>
                    Must be paid, authorized employee work in NOC TEER 0, 1, 2, or 3 (excluding full-time student co-op and self-employed Canadian work).
                  </p>
                </div>

                <div>
                  <label htmlFor="crs-foreign-work" style={labelStyle}>
                    <span>
                      In the last 10 years, how many total years of foreign skilled work experience do you have?
                    </span>
                  </label>
                  <select
                    id="crs-foreign-work"
                    value={form.foreignWorkYears === null ? "" : form.foreignWorkYears}
                    onChange={(e) =>
                      updateForm({
                        foreignWorkYears:
                          e.target.value === ""
                            ? null
                            : (Number(e.target.value) as ForeignWorkYears),
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select foreign skilled work experience...</option>
                    <option value={0}>None or less than a year</option>
                    <option value={1}>1 year</option>
                    <option value={2}>2 years</option>
                    <option value={3}>3 years or more</option>
                  </select>
                </div>

                {((form.canadianWorkYears ?? 0) >= 1 || (form.foreignWorkYears ?? 0) >= 1) && (
                  <div>
                    <label htmlFor="crs-teer-category" style={labelStyle}>
                      <span>What is the NOC TEER category of your primary skilled occupation?</span>
                    </label>
                    <select
                      id="crs-teer-category"
                      value={form.primaryOccupationTeer ?? "teer_0_1"}
                      onChange={(e) =>
                        updateForm({
                          primaryOccupationTeer: e.target.value as PrimaryOccupationTeer,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="teer_0_1">
                        TEER 0 or TEER 1 (Management &amp; University-degree professions • CEC min CLB 7)
                      </option>
                      <option value="teer_2_3">
                        TEER 2 or TEER 3 (Technical, College diploma &amp; Skilled trades • CEC min CLB 5)
                      </option>
                    </select>
                  </div>
                )}

                <div>
                  <div style={labelStyle}>
                    <span>
                      Do you have a certificate of qualification from a Canadian province, territory or federal body?
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[
                      { label: "Yes (Skilled Trade Certificate)", value: true },
                      { label: "No", value: false },
                    ].map((choice) => {
                      const active = form.hasCertificateOfQualification === choice.value;
                      return (
                        <button
                          key={choice.label}
                          type="button"
                          onClick={() =>
                            updateForm({ hasCertificateOfQualification: choice.value })
                          }
                          style={{
                            flex: 1,
                            padding: "9px 14px",
                            borderRadius: "8px",
                            border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                            background: active ? "#063C3D" : "#FFFFFF",
                            color: active ? "#FFFFFF" : "#172322",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: "pointer",
                          }}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nov 2026 IRCC Labour Market Integration High-Wage Factors */}
                {form.policyVersion === "nov_2026_lmi" ? (
                  <div
                    style={{
                      background: "#F4F8F6",
                      border: "1px solid #DCE5E1",
                      borderRadius: "10px",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                      IRCC Labour Market Integration (High-Wage Occupation Tiers)
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
                      Candidates earn points for <strong>either</strong> Canadian work experience (duration + high-wage NOC bonus) <strong>or</strong> a qualifying high-wage job offer (LMIA no longer required) — whichever yields the higher score, never both. Thresholds (1.3×, 1.5×, 2.0×) follow IRCC&apos;s designated NOC national median wage multiples.
                    </p>

                    {(form.canadianWorkYears ?? 0) >= 1 && (
                      <div>
                        <label htmlFor="crs-can-work-wage" style={labelStyle}>
                          <span>High-wage NOC tier of your Canadian work experience (12+ months)</span>
                        </label>
                        <select
                          id="crs-can-work-wage"
                          value={form.canadianWorkWageTier}
                          onChange={(e) =>
                            updateForm({
                              canadianWorkWageTier: e.target.value as HighWageTier,
                            })
                          }
                          style={selectStyle}
                        >
                          <option value="none_or_below_1_3x">
                            Standard occupation / NOC median below 1.3× national median (+0 bonus)
                          </option>
                          <option value="tier_1_3x_to_1_5x">
                            1.3× to under 1.5× national median wage (+20 bonus pts)
                          </option>
                          <option value="tier_1_5x_to_2_0x">
                            1.5× to under 2.0× national median wage (+40 bonus pts)
                          </option>
                          <option value="tier_2_0x_or_more">
                            2.0× national median wage or higher (+70 bonus pts)
                          </option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label htmlFor="crs-job-offer-wage" style={labelStyle}>
                        <span>Do you hold a qualifying high-wage job offer in Canada?</span>
                      </label>
                      <select
                        id="crs-job-offer-wage"
                        value={form.highWageJobOfferTier}
                        onChange={(e) =>
                          updateForm({
                            highWageJobOfferTier: e.target.value as HighWageTier,
                          })
                        }
                        style={selectStyle}
                      >
                        <option value="none_or_below_1_3x">
                          No qualifying high-wage job offer (or NOC below 1.3× median — 0 pts)
                        </option>
                        <option value="tier_1_3x_to_1_5x">
                          Qualifying job offer at 1.3× to under 1.5× median wage (50 pts)
                        </option>
                        <option value="tier_1_5x_to_2_0x">
                          Qualifying job offer at 1.5× to under 2.0× median wage (70 pts)
                        </option>
                        <option value="tier_2_0x_or_more">
                          Qualifying job offer at 2.0× median wage or higher (100 pts)
                        </option>
                      </select>
                    </div>

                    {(breakdown.coreHumanCapital.canadianWorkDurationPoints > 0 ||
                      breakdown.coreHumanCapital.highWageJobOfferPoints > 0) && (
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: "#07594F",
                          background: "#EAF5EF",
                          padding: "8px 12px",
                          borderRadius: "8px",
                        }}
                      >
                        Applied Path:{" "}
                        {breakdown.coreHumanCapital.labourMarketWinningPath === "canadian_work"
                          ? `Canadian Work Experience (${breakdown.coreHumanCapital.canadianWorkDurationPoints} base + ${breakdown.coreHumanCapital.canadianWorkHighWageBonus} high-wage = ${breakdown.coreHumanCapital.labourMarketIntegration} pts)`
                          : `High-Wage Job Offer (${breakdown.coreHumanCapital.labourMarketIntegration} pts — exceeds Canadian Work path)`}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#FEF7EA",
                      border: "1px solid #F0D9B5",
                      borderRadius: "10px",
                      padding: "14px 16px",
                      fontSize: "13px",
                      color: "#8A5A10",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Mar 2025 – Oct 2026 Baseline Active (Max 1,200):</strong> Legacy LMIA / arranged employment points (50 / 200 pts) were removed by IRCC on March 25, 2025. Switch the policy selector above to evaluate November 2026 Labour Market Integration high-wage rules (Max 1,270).
                  </div>
                )}
              </div>
            </section>

            {/* 5. Additional Points (PNP & Family in Canada) */}
            <section style={cardSectionStyle} aria-labelledby="crs-sec-additional">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <h2
                  id="crs-sec-additional"
                  style={{
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Additional Points Factors
                </h2>
                <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#0D6866" }}>
                  Section D: {breakdown.additionalPoints.total} / 600 pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <div style={labelStyle}>
                    <span>
                      Do you have a nomination certificate from a province or territory (Express Entry PNP)?
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[
                      { label: "Yes (+600 pts)", value: true },
                      { label: "No", value: false },
                    ].map((choice) => {
                      const active = form.hasProvincialNomination === choice.value;
                      return (
                        <button
                          key={choice.label}
                          type="button"
                          onClick={() => updateForm({ hasProvincialNomination: choice.value })}
                          style={{
                            flex: 1,
                            padding: "9px 14px",
                            borderRadius: "8px",
                            border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                            background: active ? "#063C3D" : "#FFFFFF",
                            color: active ? "#FFFFFF" : "#172322",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: "pointer",
                          }}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: "12.5px", color: "#526663" }}>
                    Not nominated yet?{" "}
                    <Link
                      href="/pnp-calculator"
                      style={{ color: "#0D6866", fontWeight: 650, textDecoration: "underline" }}
                    >
                      Check your provincial EOI score across OINP, BC PNP, AAIP, SINP, MPNP &amp; PEI →
                    </Link>
                  </p>
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>
                      Do you or your spouse/common-law partner have at least one brother or sister living in Canada who is a citizen or permanent resident (18+)?
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[
                      { label: "Yes (+15 pts)", value: true },
                      { label: "No", value: false },
                    ].map((choice) => {
                      const active = form.hasSiblingInCanada === choice.value;
                      return (
                        <button
                          key={choice.label}
                          type="button"
                          onClick={() => updateForm({ hasSiblingInCanada: choice.value })}
                          style={{
                            flex: 1,
                            padding: "9px 14px",
                            borderRadius: "8px",
                            border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                            background: active ? "#063C3D" : "#FFFFFF",
                            color: active ? "#FFFFFF" : "#172322",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: "pointer",
                          }}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#445451" }}>
                    Includes sibling related by blood, marriage, common-law partnership, or adoption sharing a parent.
                  </p>
                </div>
              </div>
            </section>

            {/* 6. Accompanying Spouse or Common-Law Partner Factors */}
            {breakdown.withSpouse && (
              <section style={cardSectionStyle} aria-labelledby="crs-sec-spouse">
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "20px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid #E7EFEB",
                  }}
                >
                  <h2
                    id="crs-sec-spouse"
                    style={{
                      fontSize: "19px",
                      fontWeight: 700,
                      color: "#063C3D",
                      margin: 0,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    Spouse or Common-Law Partner Factors
                  </h2>
                  <span style={{ fontSize: "13.5px", fontWeight: 650, color: "#0D6866" }}>
                    Section B: {breakdown.spouseFactors.total} / 40 pts
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <label htmlFor="crs-spouse-edu" style={labelStyle}>
                      <span>Spouse&apos;s highest level of education (ECA-verified if foreign)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                        {breakdown.spouseFactors.education} / 10 pts
                      </span>
                    </label>
                    <select
                      id="crs-spouse-edu"
                      value={form.spouseEducationLevel}
                      onChange={(e) =>
                        updateForm({ spouseEducationLevel: e.target.value as EducationLevel | "" })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select spouse&apos;s level of education...</option>
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="crs-spouse-work" style={labelStyle}>
                      <span>
                        In the last 10 years, how many years of skilled work experience in Canada does your spouse have?
                      </span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                        {breakdown.spouseFactors.canadianWorkExperience} / 10 pts
                      </span>
                    </label>
                    <select
                      id="crs-spouse-work"
                      value={form.spouseCanadianWorkYears === null ? "" : form.spouseCanadianWorkYears}
                      onChange={(e) =>
                        updateForm({
                          spouseCanadianWorkYears:
                            e.target.value === ""
                              ? null
                              : (Number(e.target.value) as CanadianWorkYears),
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select spouse&apos;s Canadian work experience...</option>
                      <option value={0}>None or less than a year</option>
                      <option value={1}>1 year (+5 pts)</option>
                      <option value={2}>2 years (+7 pts)</option>
                      <option value={3}>3 years (+8 pts)</option>
                      <option value={4}>4 years (+9 pts)</option>
                      <option value={5}>5 years or more (+10 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="crs-spouse-lang" style={labelStyle}>
                      <span>Did your spouse take an approved language test (valid &lt; 2 years)?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                        {breakdown.spouseFactors.firstOfficialLanguage} / 20 pts
                      </span>
                    </label>
                    <select
                      id="crs-spouse-lang"
                      value={form.spouseLanguageTest}
                      onChange={(e) => {
                        const nextVal = e.target.value as LanguageTestType;
                        setRawScores((prev) => ({
                          ...prev,
                          spouseLanguage: {
                            speaking: "",
                            listening: "",
                            reading: "",
                            writing: "",
                          },
                        }));
                        updateForm({
                          spouseLanguageTest: nextVal,
                          spouseLanguage:
                            nextVal === "none"
                              ? { speaking: 0, listening: 0, reading: 0, writing: 0 }
                              : form.spouseLanguage,
                        });
                      }}
                      style={selectStyle}
                    >
                      {Object.entries(LANGUAGE_TEST_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          {val === "none" ? "Not applicable / No valid language test" : lbl}
                        </option>
                      ))}
                    </select>

                    {form.spouseLanguageTest === "tef_canada" && (
                      <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#8A5A10" }}>
                        IRCC Note: Enter scores from the &ldquo;Équivalence ancien score&rdquo; column on your spouse&apos;s TEF Canada certificate.
                      </p>
                    )}

                    {form.spouseLanguageTest !== "none" && (
                      <div
                        className="crs-ability-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: "12px",
                          marginTop: "14px",
                        }}
                      >
                        {ABILITY_META.map(({ key, label }) => {
                          const activeSpouseTest =
                            form.spouseLanguageTest as ActiveLanguageTestType;
                          const options = getAbilityBandOptions(activeSpouseTest, key);
                          const rawSpec = useExactRawScores
                            ? getRawScoreRangeSpec(activeSpouseTest, key)
                            : null;
                          const currentClb = form.spouseLanguage[key];
                          const abilityPts = breakdown.spouseFactors.languagePerAbility[key];
                          const french = isFrenchTest(activeSpouseTest);

                          return (
                            <div
                              key={key}
                              style={{
                                background: "#F8F7F2",
                                border: "1px solid #DCE5E1",
                                borderRadius: "10px",
                                padding: "12px",
                              }}
                            >
                              <label
                                htmlFor={`spouse-lang-${key}`}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  fontSize: "13.5px",
                                  fontWeight: 650,
                                  color: "#172322",
                                  marginBottom: "6px",
                                }}
                              >
                                <span>{label}</span>
                                <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                                  {renderClbTag(currentClb, french)} • {abilityPts} pts
                                </span>
                              </label>
                              {rawSpec && (
                                <input
                                  type="number"
                                  min={rawSpec.min}
                                  max={rawSpec.max}
                                  step={rawSpec.step}
                                  placeholder={`Exact score (${rawSpec.placeholder})`}
                                  value={rawScores.spouseLanguage[key]}
                                  onChange={(e) =>
                                    handleRawScoreChange(
                                      "spouseLanguage",
                                      activeSpouseTest,
                                      key,
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    ...selectStyle,
                                    padding: "7px 10px",
                                    fontSize: "13px",
                                    marginBottom: "6px",
                                  }}
                                />
                              )}
                              <select
                                id={`spouse-lang-${key}`}
                                value={currentClb}
                                onChange={(e) =>
                                  updateAbility(
                                    "spouseLanguage",
                                    key,
                                    Number(e.target.value) as CLBLevel
                                  )
                                }
                                style={{ ...selectStyle, padding: "9px 10px", fontSize: "13.5px" }}
                              >
                                <option value={0}>Select score...</option>
                                {options.map((opt) => (
                                  <option key={opt.clb} value={opt.clb}>
                                    {opt.scoreLabel}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ================================================================
              RIGHT COLUMN (5 cols): STICKY OFFICIAL SCORE LEDGER & BENCHMARKS
              ================================================================ */}
          <aside
            className="crs-ledger-col"
            aria-label="CRS Score Breakdown and Benchmarks"
            style={{
              gridColumn: "span 5",
              position: "sticky",
              top: "84px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            {/* Primary CRS Score Card */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #BDCDC7",
                borderRadius: "12px",
                padding: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: 650, color: "#445451" }}>
                  Comprehensive Ranking System Score
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 650,
                    color: "#07594F",
                    background: "#EAF5EF",
                    padding: "3px 10px",
                    borderRadius: "6px",
                  }}
                >
                  {breakdown.withSpouse ? "With Spouse Grid" : "Single Grid"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  marginTop: "8px",
                  marginBottom: "14px",
                }}
              >
                <span
                  data-testid="crs-grand-total"
                  style={{
                    fontSize: "56px",
                    fontWeight: 800,
                    color: "#063C3D",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                  }}
                >
                  {breakdown.grandTotal}
                </span>
                <span style={{ fontSize: "18px", fontWeight: 600, color: "#6E7F7C" }}>
                  / {breakdown.grandTotalCap.toLocaleString()} pts
                </span>
              </div>

              {/* Proportional Bar */}
              <div
                aria-hidden="true"
                style={{
                  height: "10px",
                  width: "100%",
                  background: "#E7EFEB",
                  borderRadius: "5px",
                  overflow: "hidden",
                  display: "flex",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    width: `${(breakdown.coreHumanCapital.total / breakdown.grandTotalCap) * 100}%`,
                    background: "#063C3D",
                  }}
                  title={`Core Human Capital: ${breakdown.coreHumanCapital.total}`}
                />
                {breakdown.spouseFactors.total > 0 && (
                  <div
                    style={{
                      width: `${(breakdown.spouseFactors.total / breakdown.grandTotalCap) * 100}%`,
                      background: "#0D6866",
                    }}
                    title={`Spouse Factors: ${breakdown.spouseFactors.total}`}
                  />
                )}
                <div
                  style={{
                    width: `${(breakdown.skillTransferability.total / breakdown.grandTotalCap) * 100}%`,
                    background: "#169B77",
                  }}
                  title={`Skill Transferability: ${breakdown.skillTransferability.total}`}
                />
                {breakdown.additionalPoints.total > 0 && (
                  <div
                    style={{
                      width: `${(breakdown.additionalPoints.total / breakdown.grandTotalCap) * 100}%`,
                      background: "#2A9288",
                    }}
                    title={`Additional Points: ${breakdown.additionalPoints.total}`}
                  />
                )}
              </div>

              {/* Day-0 Zero State Guidance vs Active Pool Diagnostics */}
              {!breakdown.diagnostics.hasAnyInput ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    fontSize: "13px",
                    color: "#445451",
                    lineHeight: 1.5,
                  }}
                >
                  Complete the questionnaire on the left to calculate your CRS score from 0.
                </div>
              ) : (
                <>
                  {breakdown.diagnostics.hasCoreProfileCompleted &&
                    !breakdown.diagnostics.expressEntryPoolEligible &&
                    breakdown.diagnostics.poolIneligibilityReasons.length > 0 && (
                      <div
                        style={{
                          marginBottom: "12px",
                          padding: "11px 13px",
                          borderRadius: "8px",
                          background: "#FEF7EA",
                          border: "1px solid #F0D9B5",
                          fontSize: "12.5px",
                          color: "#8A5A10",
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                          Pool Entry Gate Not Yet Met:
                        </div>
                        {breakdown.diagnostics.poolIneligibilityReasons.map((reason, idx) => (
                          <div key={idx}>• {reason}</div>
                        ))}
                      </div>
                    )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      paddingTop: "10px",
                      borderTop: "1px solid #E7EFEB",
                    }}
                  >
                    {[
                      {
                        label: `FSW (${breakdown.diagnostics.fswSelectionPoints}/100 • Pass 67)`,
                        ok: breakdown.diagnostics.fswEligible,
                      },
                      {
                        label:
                          (form.primaryOccupationTeer ?? "teer_0_1") === "teer_2_3"
                            ? "CEC TEER 2/3 (1yr + CLB 5+)"
                            : "CEC TEER 0/1 (1yr + CLB 7+)",
                        ok: breakdown.diagnostics.cecEligible,
                      },
                      {
                        label: "French Category (NCLC 7+)",
                        ok: breakdown.diagnostics.frenchCategoryEligible,
                      },
                      ...(form.hasCertificateOfQualification === true ||
                      breakdown.diagnostics.fstEligible
                        ? [
                            {
                              label: "FST Skilled Trades",
                              ok: breakdown.diagnostics.fstEligible,
                            },
                          ]
                        : []),
                    ].map((badge) => (
                      <span
                        key={badge.label}
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "4px 9px",
                          borderRadius: "6px",
                          background: badge.ok ? "#EAF6F0" : "#F1F6F4",
                          color: badge.ok ? "#176B50" : "#6E7F7C",
                          border: badge.ok ? "1px solid #B9DED4" : "1px solid #DCE5E1",
                        }}
                      >
                        {badge.ok ? "✓ " : "— "}
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Spouse Accompanying vs Non-Accompanying Comparison */}
              {breakdown.withSpouse &&
                breakdown.diagnostics.nonAccompanyingSpouseComparisonScore !== null && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "#F4F8F6",
                      border: "1px solid #DCE5E1",
                      fontSize: "13px",
                      color: "#172322",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <span>
                      Single / Non-accompanying comparison:{" "}
                      <strong>
                        {breakdown.diagnostics.nonAccompanyingSpouseComparisonScore} pts
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="crs-no-print"
                      onClick={() => updateForm({ spouseAccompanying: false })}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #BDCDC7",
                        borderRadius: "6px",
                        padding: "4px 9px",
                        fontSize: "12px",
                        fontWeight: 650,
                        color: "#063C3D",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Simulate Single
                    </button>
                  </div>
                )}

              {/* Official 4-Part IRCC Breakdown Ledger */}
              <div style={{ marginTop: "18px", borderTop: "1px solid #DCE5E1" }}>
                {/* Part A */}
                <div style={{ borderBottom: "1px solid #E7EFEB", padding: "12px 0" }}>
                  <button
                    type="button"
                    aria-expanded={expandedLedgerSection.core}
                    onClick={() =>
                      setExpandedLedgerSection((s) => ({ ...s, core: !s.core }))
                    }
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: 0,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#063C3D",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>A. Core / Human Capital</span>
                    <span>
                      {breakdown.coreHumanCapital.total} / {breakdown.coreHumanCapital.sectionCap}
                    </span>
                  </button>
                  {expandedLedgerSection.core && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        fontSize: "13px",
                        color: "#445451",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Age</span>
                        <span>{breakdown.coreHumanCapital.age}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Level of education</span>
                        <span>{breakdown.coreHumanCapital.education}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>First official language</span>
                        <span>{breakdown.coreHumanCapital.firstOfficialLanguage}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Second official language</span>
                        <span>{breakdown.coreHumanCapital.secondOfficialLanguage}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>
                          {form.policyVersion === "nov_2026_lmi"
                            ? "Labour market integration / CAN work"
                            : "Canadian work experience"}
                        </span>
                        <span>{breakdown.coreHumanCapital.labourMarketIntegration}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Part B */}
                <div style={{ borderBottom: "1px solid #E7EFEB", padding: "12px 0" }}>
                  <button
                    type="button"
                    aria-expanded={expandedLedgerSection.spouse}
                    onClick={() =>
                      setExpandedLedgerSection((s) => ({ ...s, spouse: !s.spouse }))
                    }
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: 0,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#063C3D",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>B. Spouse / Partner Factors</span>
                    <span>{breakdown.spouseFactors.total} / 40</span>
                  </button>
                  {expandedLedgerSection.spouse && breakdown.withSpouse && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        fontSize: "13px",
                        color: "#445451",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Spouse level of education</span>
                        <span>{breakdown.spouseFactors.education}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Spouse first official language</span>
                        <span>{breakdown.spouseFactors.firstOfficialLanguage}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Spouse Canadian work experience</span>
                        <span>{breakdown.spouseFactors.canadianWorkExperience}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Part C */}
                <div style={{ borderBottom: "1px solid #E7EFEB", padding: "12px 0" }}>
                  <button
                    type="button"
                    aria-expanded={expandedLedgerSection.transfer}
                    onClick={() =>
                      setExpandedLedgerSection((s) => ({ ...s, transfer: !s.transfer }))
                    }
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: 0,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#063C3D",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>C. Skill Transferability</span>
                    <span>{breakdown.skillTransferability.total} / 100</span>
                  </button>
                  {expandedLedgerSection.transfer && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        fontSize: "13px",
                        color: "#445451",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Education + Language / CAN Work (max 50)</span>
                        <span>{breakdown.skillTransferability.educationSubtotalCapped}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Foreign Work + Language / CAN Work (max 50)</span>
                        <span>{breakdown.skillTransferability.foreignWorkSubtotalCapped}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Trade Certificate + Language (max 50)</span>
                        <span>
                          {breakdown.skillTransferability.certificateOfQualificationWithLanguage}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Part D */}
                <div style={{ paddingTop: "12px" }}>
                  <button
                    type="button"
                    aria-expanded={expandedLedgerSection.additional}
                    onClick={() =>
                      setExpandedLedgerSection((s) => ({ ...s, additional: !s.additional }))
                    }
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: 0,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#063C3D",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>D. Additional Points</span>
                    <span>{breakdown.additionalPoints.total} / 600</span>
                  </button>
                  {expandedLedgerSection.additional && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        fontSize: "13px",
                        color: "#445451",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Provincial or territorial nomination</span>
                        <span>{breakdown.additionalPoints.provincialNomination}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>French language skills (NCLC 7+)</span>
                        <span>{breakdown.additionalPoints.frenchLanguageSkills}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Post-secondary education in Canada</span>
                        <span>{breakdown.additionalPoints.postSecondaryEducationInCanada}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Sibling in Canada (Citizen / PR)</span>
                        <span>{breakdown.additionalPoints.siblingInCanada}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Export / Copy / Share Bar */}
              <div
                className="crs-no-print"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "18px",
                  paddingTop: "14px",
                  borderTop: "1px solid #DCE5E1",
                }}
              >
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  style={{
                    flex: "1 1 150px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #063C3D",
                    background: "#063C3D",
                    color: "#FFFFFF",
                    fontSize: "12.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Download (.txt)
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #BDCDC7",
                    background: "#FFFFFF",
                    color: "#063C3D",
                    fontSize: "12.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {copiedSummary ? "Copied ✓" : "Copy Sheet"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #BDCDC7",
                    background: "#F4F8F6",
                    color: "#063C3D",
                    fontSize: "12.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {copiedShareLink ? "Link Copied ✓" : "Share Link"}
                </button>
              </div>

              <CobrandedAgencyLeadWidget
                calculatorId="canada-crs"
                calculatorTitle="Canada Express Entry CRS"
                countryCode="CA"
                liveScoreSummary={`${breakdown.grandTotal} CRS pts (${form.policyVersion === "nov_2026_lmi" ? "Nov 2026 LMI Grid" : "Current IRCC Grid"})`}
                hasCalculatedScore={breakdown.grandTotal > 0}
                scorePayload={{
                  grandTotal: breakdown.grandTotal,
                  policyVersion: form.policyVersion,
                }}
              />
            </div>

            {/* Recent Express Entry Draw Cutoffs Card */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  Recent Express Entry Draw Benchmarks
                </h3>
                <a
                  href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "12px", fontWeight: 600, color: "#0D6866" }}
                >
                  Canada.ca Rounds ↗
                </a>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {drawBenchmarks.map((b) => {
                  const fullyCompetitive =
                    b.meetsCutoff && b.eligibilityStatus === "eligible";
                  const occupationConditional =
                    b.meetsCutoff && b.eligibilityStatus === "occupation_dependent";
                  const ineligible = b.eligibilityStatus === "ineligible";

                  return (
                    <div
                      key={b.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: fullyCompetitive
                          ? "#EAF6F0"
                          : occupationConditional
                            ? "#F1F7F6"
                            : "#F8F7F2",
                        border: fullyCompetitive
                          ? "1px solid #B9DED4"
                          : occupationConditional
                            ? "1px solid #BDCDC7"
                            : "1px solid #DCE5E1",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 650, color: "#172322" }}>
                          {b.streamName}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#445451" }}>
                          Range: {b.cutoffRangeLabel} • {b.eligibilityReason}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: !breakdown.diagnostics.hasAnyInput
                              ? "#6E7F7C"
                              : ineligible
                                ? "#6E7F7C"
                                : b.meetsCutoff
                                  ? "#176B50"
                                  : "#8A5A10",
                          }}
                        >
                          {!breakdown.diagnostics.hasAnyInput
                            ? `Cutoff ~${b.recentCutoff}`
                            : ineligible
                              ? "Stream Ineligible"
                              : b.meetsCutoff
                                ? occupationConditional
                                  ? `+${b.pointsDelta} (Verify NOC)`
                                  : `+${b.pointsDelta} above ${b.recentCutoff}`
                                : `${Math.abs(b.pointsDelta)} below ${b.recentCutoff}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personalized What-If Score Boosters (only once user enters data) */}
            {tips.length > 0 && (
              <div
                className="crs-no-print"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "12px",
                  padding: "22px",
                }}
              >
                <h3
                  style={{
                    fontSize: "15.5px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: "0 0 12px 0",
                  }}
                >
                  Fastest Ways to Increase Your CRS Score
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {tips.map((tip) => (
                    <div
                      key={tip.id}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background: "#F4F8F6",
                        border: "1px solid #DCE5E1",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "6px",
                        }}
                      >
                        <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                          {tip.title}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 750,
                            color: "#07594F",
                            background: "#EAF5EF",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          +{tip.pointsGain} pts → {tip.projectedTotal}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "0 0 8px 0",
                          fontSize: "12.5px",
                          color: "#445451",
                          lineHeight: 1.5,
                        }}
                      >
                        {tip.actionSummary}
                      </p>
                      <button
                        type="button"
                        onClick={() => handlePreviewTip(tip.previewInput)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #BDCDC7",
                          background: "#FFFFFF",
                          color: "#063C3D",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        Preview Scenario →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Step: Audit Express Entry Evidence in AI Lab */}
            <div
              className="crs-no-print"
              style={{
                background: "#063C3D",
                color: "#FFFFFF",
                borderRadius: "12px",
                padding: "20px 22px",
              }}
            >
              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px" }}>
                Ready to verify your Express Entry documents?
              </div>
              <p
                style={{
                  margin: "0 0 14px 0",
                  fontSize: "13px",
                  color: "#DDEFE8",
                  lineHeight: 1.55,
                }}
              >
                Upload your Passport, IELTS/CELPIP/TEF certificate, ECA, T4/Pay Stubs, or merged packet to automatically sort and verify every field before your 60-day ITA deadline.
              </p>
              <Link
                href="/extractor"
                style={{
                  display: "inline-block",
                  background: "#FFFFFF",
                  color: "#063C3D",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Open AI Document Lab →
              </Link>
            </div>
          </aside>
        </div>

        {/* Statutory Footnote & Official Canada.ca Reference */}
        <footer
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid #DCE5E1",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "12.5px",
            color: "#445451",
            lineHeight: 1.6,
          }}
        >
          <div style={{ maxWidth: "880px" }}>
            <strong style={{ color: "#172322" }}>Official Regulatory Basis:</strong> Point calculations follow the{" "}
            <a
              href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              IRCC Ministerial Instructions respecting the Express Entry system (Canada.ca)
            </a>
            . Language conversions follow official IRCC CLB and NCLC equivalency tables for CELPIP-G, IELTS General Training, PTE Core, TEF Canada (ancien score), and TCF Canada. This calculator provides an informational estimate and does not constitute legal advice or an official Invitation to Apply (ITA).
          </div>
          <div style={{ fontWeight: 600, color: "#063C3D" }}>
            The Documento • Canadian Legal Ops Suite
          </div>
        </footer>
      </main>

      {/* Mobile Bottom Docked Score Summary Bar */}
      <div
        className="crs-mobile-score-bar crs-no-print"
        style={{
          display: "none",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 55,
          background: "#063C3D",
          color: "#FFFFFF",
          padding: "12px 20px",
          borderTop: "1px solid rgba(185, 222, 212, 0.25)",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "11.5px", color: "#B9DED4" }}>Live CRS Score</div>
          <div style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1.1 }}>
            {breakdown.grandTotal}{" "}
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#B9DED4" }}>
              / {breakdown.grandTotalCap.toLocaleString()}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector(".crs-ledger-col");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          style={{
            background: "#FFFFFF",
            color: "#063C3D",
            border: "none",
            padding: "9px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          View Breakdown ↓
        </button>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .crs-hero-left,
          .crs-hero-right,
          .crs-form-col,
          .crs-ledger-col {
            grid-column: span 12 !important;
            position: static !important;
          }
          .crs-mobile-score-bar {
            display: flex !important;
          }
          .crs-main-container {
            padding-bottom: 120px !important;
          }
        }
        @media (max-width: 600px) {
          .crs-ability-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media print {
          .crs-no-print {
            display: none !important;
          }
          body {
            background: #FFFFFF !important;
          }
          .crs-form-col,
          .crs-ledger-col {
            grid-column: span 12 !important;
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
