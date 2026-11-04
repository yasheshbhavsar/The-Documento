"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CobrandedAgencyLeadWidget } from "../agency/CobrandedAgencyLeadWidget";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CountryCalculatorHeroCard } from "./CountryVisualIdentity";
import {
  ActiveLanguageTestType,
  CLBLevel,
  convertRawScoreToCLB,
  getAbilityBandOptions,
  getAllowedSecondLanguageTests,
  getRawScoreRangeSpec,
  isFrenchTest,
  LANGUAGE_TEST_LABELS,
  LanguageAbilities,
  LanguageTestType,
} from "../../lib/crs/calculator";
import {
  AaipCanadianWorkLocation,
  AaipEducationLocation,
  AaipJobLocation,
  AaipTotalWorkMonths,
  BcEducationLocation,
  BcEmploymentArea,
  BcRelatedWorkYears,
  calculateAllPnpProvinces,
  convertAnnualSalaryToHourlyWage,
  DEFAULT_PNP_INPUT,
  generatePnpOptimizationTips,
  MpnpAdaptabilityPrimary,
  MpnpWorkYears,
  NocBroadCategory,
  NocTeerCategory,
  OinpCanadianCredentials,
  OinpCraEarningsBracket,
  OinpLegalStatus,
  OinpWorkExperienceTier,
  OinpWorkRegion,
  PeiPathwayMode,
  PeiWorkYears,
  PNP_PROVINCE_META,
  PnpCalculatorInput,
  PnpProvinceId,
  SharedPnpEducationLevel,
  SinpOlderWorkYears,
  SinpRecentWorkYears,
  SinpSectorType,
} from "../../lib/pnp/calculator";

const PNP_AGE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 17, label: "17 years of age or less" },
  ...Array.from({ length: 33 }, (_, idx) => {
    const yr = 18 + idx;
    return { value: yr, label: `${yr} years of age` };
  }),
  { value: 51, label: "51 years of age or more" },
];

const PNP_EDUCATION_OPTIONS: Array<{ value: SharedPnpEducationLevel; label: string }> = [
  { value: "secondary_or_less", label: "Secondary school (high school diploma) or less" },
  {
    value: "trade_certificate",
    label: "Apprenticeship or Skilled Trades Certificate / Journeyperson Diploma",
  },
  {
    value: "one_year_post_secondary",
    label: "One-year post-secondary certificate or diploma",
  },
  {
    value: "two_year_post_secondary",
    label: "Two-year post-secondary diploma or associate degree",
  },
  {
    value: "bachelors_three_year",
    label: "Bachelor's degree (3 or more years)",
  },
  {
    value: "two_or_more_degrees",
    label: "Two or more post-secondary credentials (at least one 2–3+ year program)",
  },
  {
    value: "post_grad_diploma",
    label: "Post-graduate certificate or diploma (requiring a prior degree)",
  },
  {
    value: "masters",
    label: "Master's degree",
  },
  {
    value: "doctoral_or_md",
    label: "Doctoral degree (Ph.D.) or Doctor of Medicine (M.D.)",
  },
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

type PnpRawScoreMap = Record<
  "firstLanguage" | "secondLanguage",
  Record<keyof LanguageAbilities, string>
>;

const EMPTY_RAW_SCORES: PnpRawScoreMap = {
  firstLanguage: { speaking: "", listening: "", reading: "", writing: "" },
  secondLanguage: { speaking: "", listening: "", reading: "", writing: "" },
};

function getMpnpBandPoints(clb: CLBLevel): number {
  if (clb >= 8) return 25;
  if (clb === 7) return 22;
  if (clb === 6) return 20;
  if (clb === 5) return 17;
  if (clb === 4) return 12;
  return 0;
}

export function PnpCalculatorTool() {
  const [form, setForm] = useState<PnpCalculatorInput>(DEFAULT_PNP_INPUT);
  const [previousBeforePreview, setPreviousBeforePreview] =
    useState<PnpCalculatorInput | null>(null);
  const [useExactRawScores, setUseExactRawScores] = useState<boolean>(false);
  const [rawScores, setRawScores] = useState<PnpRawScoreMap>(EMPTY_RAW_SCORES);
  const [showSalaryConverter, setShowSalaryConverter] = useState<boolean>(false);
  const [annualSalaryText, setAnnualSalaryText] = useState<string>("");
  const [hoursPerWeekText, setHoursPerWeekText] = useState<string>("37.5");
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Hydrate shared profile from URL (?pnp=...) if present on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("pnp");
      if (encoded) {
        const json = decodeURIComponent(atob(encoded));
        const parsed = JSON.parse(json) as Partial<PnpCalculatorInput>;
        if (parsed && typeof parsed === "object") {
          setForm({ ...DEFAULT_PNP_INPUT, ...parsed });
        }
      }
    } catch {
      // Ignore malformed query parameter
    }
  }, []);

  const allResults = useMemo(() => calculateAllPnpProvinces(form), [form]);
  const activeResult = allResults[form.activeProvince];
  const anyInputAcrossAll = useMemo(
    () => Object.values(allResults).some((r) => r.hasAnyInput),
    [allResults]
  );
  const tips = useMemo(
    () => generatePnpOptimizationTips(form, activeResult),
    [form, activeResult]
  );

  const allowedSecondTests = useMemo(
    () => getAllowedSecondLanguageTests(form.firstLanguageTest),
    [form.firstLanguageTest]
  );

  const updateForm = (patch: Partial<PnpCalculatorInput>) => {
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
    target: "firstLanguage" | "secondLanguage",
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
    target: "firstLanguage" | "secondLanguage",
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

  const handleSwapLanguages = () => {
    if (form.firstLanguageTest === "none" || form.secondLanguageTest === "none") return;
    setPreviousBeforePreview(null);
    setRawScores(EMPTY_RAW_SCORES);
    setForm((prev) => ({
      ...prev,
      firstLanguageTest: prev.secondLanguageTest,
      firstLanguage: { ...prev.secondLanguage },
      secondLanguageTest: prev.firstLanguageTest,
      secondLanguage: { ...prev.firstLanguage },
    }));
  };

  const handleApplyConvertedSalary = () => {
    const sal = Number(annualSalaryText);
    const hrs = Number(hoursPerWeekText) || 37.5;
    if (Number.isFinite(sal) && sal > 0) {
      const hourly = convertAnnualSalaryToHourlyWage(sal, hrs);
      updateForm({ hourlyWage: hourly });
    }
  };

  const resetToZero = () => {
    setPreviousBeforePreview(null);
    setRawScores(EMPTY_RAW_SCORES);
    setAnnualSalaryText("");
    setHoursPerWeekText("37.5");
    setForm((prev) => ({
      ...DEFAULT_PNP_INPUT,
      activeProvince: prev.activeProvince,
    }));
  };

  const handlePreviewTip = (previewInput: PnpCalculatorInput) => {
    setPreviousBeforePreview((prev) => prev ?? form);
    setForm(previewInput);
  };

  const handleUndoPreview = () => {
    if (!previousBeforePreview) return;
    setForm(previousBeforePreview);
    setPreviousBeforePreview(null);
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const buildPlainTextSummary = (): string => {
    const lines: string[] = [
      "======================================================================",
      "THE DOCUMENTO — CANADA PROVINCIAL NOMINEE PROGRAM (PNP) SCORE SHEET",
      `Active Province: ${activeResult.provinceName} (${activeResult.programShortName})`,
      `Stream Grid: ${activeResult.officialStreamTitle}`,
      `Regulatory Standard: ${activeResult.lastUpdatedLabel}`,
      "======================================================================",
      "",
      `PROVINCIAL EOI / SELECTION SCORE: ${activeResult.totalScore} / ${activeResult.maxScore.toLocaleString()}`,
      ...(activeResult.minimumPassMark !== null
        ? [
            `Minimum Statutory Pass Mark: ${activeResult.minimumPassMark} / ${activeResult.maxScore} (${
              activeResult.meetsPassMark ? "ELIGIBLE" : "BELOW PASS MARK"
            })`,
          ]
        : []),
      "Express Entry Enhanced Nomination Value: +600 Federal CRS Points",
      "----------------------------------------------------------------------",
    ];

    for (const sec of activeResult.sections) {
      lines.push(
        `${sec.title}: ${sec.points}${sec.isDeductionSection ? " pts" : ` / ${sec.maxPoints}`}`
      );
      for (const item of sec.items) {
        lines.push(
          `   - ${item.label}: ${item.points}${item.isDeduction ? " pts" : ` / ${item.maxPoints}`}`
        );
      }
      lines.push("");
    }

    lines.push("CROSS-PROVINCE SCORE COMPARISON (FROM SHARED HUMAN CAPITAL + INPUTS):");
    for (const meta of PNP_PROVINCE_META) {
      const r = allResults[meta.id];
      lines.push(
        `   - ${r.provinceName} (${r.programShortName}): ${r.totalScore} / ${r.maxScore.toLocaleString()}`
      );
    }

    lines.push(
      "----------------------------------------------------------------------",
      "Generated via The Documento (thedocumento.com/pnp-calculator)",
      "Disclaimer: Informational calculation aligned with published provincial PNP grids; not legal advice."
    );
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
      const shareUrl = `${window.location.origin}${window.location.pathname}?pnp=${encodeURIComponent(encoded)}`;
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
    a.download = `Documento_PNP_${activeResult.programShortName.replace(/\s+/g, "_")}_${activeResult.totalScore}.txt`;
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

  const renderYesNoButtons = (
    currentValue: boolean | null,
    onChange: (val: boolean) => void,
    yesLabel: string = "Yes",
    noLabel: string = "No",
    dangerYes: boolean = false
  ) => (
    <div style={{ display: "flex", gap: "10px" }}>
      {[
        { label: yesLabel, value: true },
        { label: noLabel, value: false },
      ].map((choice) => {
        const active = currentValue === choice.value;
        const useDanger = active && choice.value === true && dangerYes;
        return (
          <button
            key={choice.label}
            type="button"
            onClick={() => onChange(choice.value)}
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: "8px",
              border: useDanger
                ? "1px solid #991B1B"
                : active
                  ? "1px solid #063C3D"
                  : "1px solid #BDCDC7",
              background: useDanger ? "#991B1B" : active ? "#063C3D" : "#FFFFFF",
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
  );

  const minFirstClb =
    form.hasValidLanguageTest === true && form.firstLanguageTest !== "none"
      ? Math.min(
          form.firstLanguage.speaking,
          form.firstLanguage.listening,
          form.firstLanguage.reading,
          form.firstLanguage.writing
        )
      : 0;

  const previewConvertedHourly =
    annualSalaryText.trim() !== ""
      ? convertAnnualSalaryToHourlyWage(
          Number(annualSalaryText),
          Number(hoursPerWeekText) || 37.5
        )
      : 0;

  const showWageCard =
    form.activeProvince === "ontario_oinp" || form.activeProvince === "bc_pnp";

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
        className="pnp-no-print"
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
            <Link
              href="/"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              <DocumentoLogo size="md" showWordmark showDomain />
            </Link>
            <span
              aria-hidden="true"
              style={{
                width: "1px",
                height: "20px",
                background: "#DCE5E1",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
              Canada Provincial Nominee (PNP) Calculator
            </span>
          </div>

          <nav
            aria-label="PNP Calculator Navigation"
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
            {anyInputAcrossAll && (
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
              href="/crs-calculator"
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
              Federal CRS Calculator
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
      <div className="pnp-no-print">
        <CalculatorCountrySwitchBar activeCalculatorId="ca_pnp" />
      </div>

      {/* Main Content Container */}
      <main
        className="pnp-main-container"
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
          padding: "36px 24px 96px 24px",
        }}
      >
        {/* Hero Title & Active Statutory Authority Header */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "24px",
            alignItems: "end",
            marginBottom: "24px",
            paddingBottom: "22px",
            borderBottom: "1px solid #DCE5E1",
          }}
        >
          <div className="pnp-hero-left" style={{ gridColumn: "span 8" }}>
            <h1
              style={{
                fontSize: "clamp(28px, 3.3vw, 40px)",
                fontWeight: 750,
                color: "#063C3D",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                margin: "0 0 12px 0",
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
              }}
            >
              Provincial Nominee Program (PNP) Points Calculator
            </h1>
            <p
              style={{
                fontSize: "15.5px",
                color: "#445451",
                lineHeight: 1.55,
                margin: 0,
                maxWidth: "780px",
              }}
            >
              Calculates official 2026 Expression of Interest (EOI) and eligibility scores across Canada&apos;s six point-ranked Provincial Nominee Programs — sharing your core human capital across provinces so you can compare eligibility side by side from zero.
            </p>
          </div>

          <div className="pnp-hero-right pnp-no-print" style={{ gridColumn: "span 4" }}>
            <CountryCalculatorHeroCard
              countryId="canada"
              authorityLabel="Active Provincial Grid Standard"
              headlineMetric={activeResult.lastUpdatedLabel}
              subMetric="6 Provinces Scored Simultaneously (+600 CRS)"
            />
          </div>
        </section>

        {/* 6-Province Selector & Live Simultaneous Scoreboard */}
        <section
          aria-label="Select Provincial Nominee Program"
          style={{ marginBottom: "28px" }}
        >
          <div
            data-testid="pnp-province-tabs"
            className="pnp-province-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "10px",
            }}
          >
            {PNP_PROVINCE_META.map((meta) => {
              const res = allResults[meta.id];
              const isSelected = form.activeProvince === meta.id;
              return (
                <button
                  key={meta.id}
                  type="button"
                  data-testid={`pnp-tab-${meta.id}`}
                  aria-pressed={isSelected}
                  onClick={() => updateForm({ activeProvince: meta.id })}
                  style={{
                    textAlign: "left",
                    padding: "13px 14px",
                    borderRadius: "10px",
                    border: isSelected ? "1.5px solid #063C3D" : "1px solid #DCE5E1",
                    background: isSelected ? "#063C3D" : "#FFFFFF",
                    color: isSelected ? "#FFFFFF" : "#172322",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "8px",
                    transition: "background-color 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 750,
                        color: isSelected ? "#FFFFFF" : "#063C3D",
                      }}
                    >
                      {meta.shortName}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 650,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: isSelected ? "rgba(255,255,255,0.14)" : "#F1F6F4",
                        color: isSelected ? "#DDEFE8" : "#445451",
                      }}
                    >
                      {meta.code}
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: isSelected ? "#DDEFE8" : "#445451",
                        marginBottom: "4px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {meta.provinceName}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span
                        data-testid={`pnp-tab-score-${meta.id}`}
                        style={{
                          fontSize: "20px",
                          fontWeight: 800,
                          lineHeight: 1,
                          color: isSelected ? "#FFFFFF" : "#063C3D",
                        }}
                      >
                        {res.totalScore}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: isSelected ? "#B9DED4" : "#6E7F7C",
                        }}
                      >
                        / {res.maxScore.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <p
            style={{
              margin: "10px 0 0 0",
              fontSize: "12.5px",
              color: "#526663",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#063C3D" }}>Jurisdiction Coverage Note:</strong> Ontario, B.C., Alberta, Saskatchewan, Manitoba, and PEI operate transparent point-scored EOI grids. Atlantic &amp; Northern jurisdictions (Nova Scotia, New Brunswick, Newfoundland &amp; Labrador, Yukon, and NWT) select candidates through employer-backed or priority occupation intakes rather than public point rankings.
          </p>
        </section>

        {/* Main 12-Column Grid: Questionnaire (7) + Sticky Official Provincial Ledger (5) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "28px",
            alignItems: "start",
          }}
        >
          {/* ================================================================
              LEFT COLUMN (7 cols): SHARED HUMAN CAPITAL + PROVINCE FACTORS
              ================================================================ */}
          <div
            className="pnp-form-col"
            style={{
              gridColumn: "span 7",
              display: "flex",
              flexDirection: "column",
              gap: "22px",
            }}
          >
            {/* 1. Shared Core Human Capital Factors */}
            <section style={cardSectionStyle} aria-labelledby="pnp-sec-shared">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "18px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <div>
                  <h2
                    id="pnp-sec-shared"
                    style={{
                      fontSize: "19px",
                      fontWeight: 700,
                      color: "#063C3D",
                      margin: 0,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    Shared Core Human Capital
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#526663" }}>
                    Entered once and automatically mapped to all 6 provincial scoring tables.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 650,
                    color: "#0D6866",
                    whiteSpace: "nowrap",
                  }}
                >
                  Synced Across 6 Provinces
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Age */}
                <div>
                  <label htmlFor="pnp-age" style={labelStyle}>
                    <span>How old are you?</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                      {form.activeProvince === "ontario_oinp" || form.activeProvince === "bc_pnp"
                        ? "Not scored in ON / BC (Synced to AB, SK, MB, PE)"
                        : "Scored in active province"}
                    </span>
                  </label>
                  <select
                    id="pnp-age"
                    value={form.age ?? ""}
                    onChange={(e) =>
                      updateForm({
                        age: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select age...</option>
                    {PNP_AGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Highest Level of Education */}
                <div>
                  <label htmlFor="pnp-education" style={labelStyle}>
                    <span>What is your highest level of completed education (Canadian or ECA-verified)?</span>
                  </label>
                  <select
                    id="pnp-education"
                    value={form.educationLevel}
                    onChange={(e) =>
                      updateForm({
                        educationLevel: e.target.value as SharedPnpEducationLevel,
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select highest completed education...</option>
                    {PNP_EDUCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Official Languages */}
                <div
                  style={{
                    paddingTop: "14px",
                    borderTop: "1px solid #E7EFEB",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D" }}>
                      Official Languages (English &amp; French)
                    </div>

                    {form.hasValidLanguageTest === true && form.firstLanguageTest !== "none" && (
                      <div
                        className="pnp-no-print"
                        style={{
                          display: "inline-flex",
                          background: "#F1F6F4",
                          padding: "3px",
                          borderRadius: "8px",
                          border: "1px solid #DCE5E1",
                        }}
                      >
                        {[
                          { label: "Select Band Ranges", exact: false },
                          { label: "Type Exact Raw Scores", exact: true },
                        ].map((mode) => {
                          const active = useExactRawScores === mode.exact;
                          return (
                            <button
                              key={mode.label}
                              type="button"
                              onClick={() => setUseExactRawScores(mode.exact)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "6px",
                                border: "none",
                                background: active ? "#FFFFFF" : "transparent",
                                color: active ? "#063C3D" : "#445451",
                                fontSize: "12px",
                                fontWeight: active ? 650 : 500,
                                cursor: "pointer",
                              }}
                            >
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Valid test < 2 years gate */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={labelStyle}>
                      <span>Are your language test results less than two years old?</span>
                    </div>
                    {renderYesNoButtons(form.hasValidLanguageTest, (val) =>
                      updateForm({ hasValidLanguageTest: val })
                    )}
                    {form.hasValidLanguageTest === false && (
                      <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#8A5A10" }}>
                        Provincial Nominee Programs require valid IRCC-approved language test results less than 2 years old at submission. Language points are set to 0.
                      </p>
                    )}
                  </div>

                  {form.hasValidLanguageTest === true && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                      {/* First Official Language */}
                      <div>
                        <label htmlFor="pnp-first-lang-test" style={labelStyle}>
                          <span>Which language test did you take for your first official language?</span>
                          {form.firstLanguageTest !== "none" && (
                            <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                              Lowest Band:{" "}
                              {minFirstClb > 0
                                ? `${isFrenchTest(form.firstLanguageTest) ? "NCLC" : "CLB"} ${
                                    minFirstClb === 10 ? "10+" : minFirstClb === 3 ? "<4" : minFirstClb
                                  }`
                                : "Incomplete"}
                            </span>
                          )}
                        </label>
                        <select
                          id="pnp-first-lang-test"
                          value={form.firstLanguageTest}
                          onChange={(e) =>
                            handleFirstLanguageTestChange(e.target.value as LanguageTestType)
                          }
                          style={selectStyle}
                        >
                          <option value="none">Select approved language test...</option>
                          {FIRST_LANG_TEST_ORDER.map((t) => (
                            <option key={t} value={t}>
                              {LANGUAGE_TEST_LABELS[t]}
                            </option>
                          ))}
                        </select>

                        {form.firstLanguageTest === "tef_canada" && (
                          <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "#8A5A10" }}>
                            Note: Enter scores from the &ldquo;Équivalence ancien score&rdquo; column on your TEF Canada certificate.
                          </p>
                        )}

                        {form.firstLanguageTest !== "none" && (
                          <div
                            className="pnp-ability-grid"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, 1fr)",
                              gap: "12px",
                              marginTop: "14px",
                            }}
                          >
                            {ABILITY_META.map(({ key, label }) => {
                              const activeTest = form.firstLanguageTest as ActiveLanguageTestType;
                              const options = getAbilityBandOptions(activeTest, key);
                              const rawSpec = useExactRawScores
                                ? getRawScoreRangeSpec(activeTest, key)
                                : null;
                              const currentClb = form.firstLanguage[key];
                              const french = isFrenchTest(activeTest);

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
                                    htmlFor={`pnp-first-lang-${key}`}
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
                                      {renderClbTag(currentClb, french)}
                                      {form.activeProvince === "manitoba_mpnp"
                                        ? ` • ${getMpnpBandPoints(currentClb)} pts`
                                        : ""}
                                    </span>
                                  </label>

                                  {rawSpec && (
                                    <input
                                      type="number"
                                      min={rawSpec.min}
                                      max={rawSpec.max}
                                      step={rawSpec.step}
                                      aria-label={`Exact ${label} raw score`}
                                      placeholder={`Exact score (${rawSpec.placeholder})`}
                                      value={rawScores.firstLanguage[key]}
                                      onChange={(e) =>
                                        handleRawScoreChange(
                                          "firstLanguage",
                                          activeTest,
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
                                    id={`pnp-first-lang-${key}`}
                                    value={currentClb}
                                    onChange={(e) =>
                                      updateAbility(
                                        "firstLanguage",
                                        key,
                                        Number(e.target.value) as CLBLevel
                                      )
                                    }
                                    style={{
                                      ...selectStyle,
                                      padding: "9px 10px",
                                      fontSize: "13.5px",
                                    }}
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
                        <div style={{ paddingTop: "14px", borderTop: "1px solid #E7EFEB" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <label
                              htmlFor="pnp-second-lang-test"
                              style={{ ...labelStyle, marginBottom: 0 }}
                            >
                              <span>Do you have valid test results for your second official language?</span>
                            </label>

                            {form.secondLanguageTest !== "none" && (
                              <button
                                type="button"
                                onClick={handleSwapLanguages}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #BDCDC7",
                                  background: "#F4F8F6",
                                  color: "#063C3D",
                                  fontSize: "12px",
                                  fontWeight: 650,
                                  cursor: "pointer",
                                }}
                              >
                                ⇄ Swap 1st &amp; 2nd Languages
                              </button>
                            )}
                          </div>

                          <select
                            id="pnp-second-lang-test"
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
                                {t === "none" ? "Not applicable / No second language test" : LANGUAGE_TEST_LABELS[t]}
                              </option>
                            ))}
                          </select>

                          {form.secondLanguageTest !== "none" && (
                            <div
                              className="pnp-ability-grid"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "12px",
                                marginTop: "14px",
                              }}
                            >
                              {ABILITY_META.map(({ key, label }) => {
                                const activeSecond =
                                  form.secondLanguageTest as ActiveLanguageTestType;
                                const options = getAbilityBandOptions(activeSecond, key);
                                const rawSpec = useExactRawScores
                                  ? getRawScoreRangeSpec(activeSecond, key)
                                  : null;
                                const currentClb = form.secondLanguage[key];
                                const french = isFrenchTest(activeSecond);

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
                                      htmlFor={`pnp-second-lang-${key}`}
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
                                        {renderClbTag(currentClb, french)}
                                      </span>
                                    </label>

                                    {rawSpec && (
                                      <input
                                        type="number"
                                        min={rawSpec.min}
                                        max={rawSpec.max}
                                        step={rawSpec.step}
                                        aria-label={`Exact second language ${label} raw score`}
                                        placeholder={`Exact score (${rawSpec.placeholder})`}
                                        value={rawScores.secondLanguage[key]}
                                        onChange={(e) =>
                                          handleRawScoreChange(
                                            "secondLanguage",
                                            activeSecond,
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
                                      id={`pnp-second-lang-${key}`}
                                      value={currentClb}
                                      onChange={(e) =>
                                        updateAbility(
                                          "secondLanguage",
                                          key,
                                          Number(e.target.value) as CLBLevel
                                        )
                                      }
                                      style={{
                                        ...selectStyle,
                                        padding: "9px 10px",
                                        fontSize: "13.5px",
                                      }}
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
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 2. Base Hourly Wage & Annual Salary Converter (Ontario OINP & BC PNP) */}
            {showWageCard && (
              <section style={cardSectionStyle} aria-labelledby="pnp-sec-wage">
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid #E7EFEB",
                  }}
                >
                  <div>
                    <h2
                      id="pnp-sec-wage"
                      style={{
                        fontSize: "19px",
                        fontWeight: 700,
                        color: "#063C3D",
                        margin: 0,
                        letterSpacing: "-0.015em",
                      }}
                    >
                      Job Offer Base Hourly Wage (CAD)
                    </h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#526663" }}>
                      {form.activeProvince === "ontario_oinp"
                        ? "Scored in OINP steps ($20, $25, $30, $35, $40+/hr • Max 15 pts) and synced to BC PNP."
                        : "Scored on BC PNP's exact $16.00 – $70.00+/hr sliding scale (1 – 55 pts) and synced to OINP."}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="pnp-no-print"
                    onClick={() => setShowSalaryConverter((prev) => !prev)}
                    style={{
                      padding: "6px 11px",
                      borderRadius: "6px",
                      border: "1px solid #BDCDC7",
                      background: showSalaryConverter ? "#EAF5EF" : "#F4F8F6",
                      color: "#063C3D",
                      fontSize: "12px",
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    {showSalaryConverter ? "Hide Annual Salary Converter" : "Convert Annual Salary → $/hr"}
                  </button>
                </div>

                {form.activeProvince === "ontario_oinp" && form.oinpIsSelfEmployedPhysician ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "#EAF6F0",
                      border: "1px solid #B9DED4",
                      fontSize: "13.5px",
                      color: "#176B50",
                    }}
                  >
                    <strong>Self-Employed Physician Exemption Active:</strong> OINP exempts self-employed physicians under NOC 31100 / 31101 / 31102 from the job-offer hourly wage factor (scored out of 117 maximum points).
                  </div>
                ) : (
                  <div>
                    <label htmlFor="pnp-hourly-wage" style={labelStyle}>
                      <span>Base hourly wage on your Canadian job offer ($ CAD / hour, excluding bonuses &amp; overtime)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                        {form.hourlyWage !== null ? `$${form.hourlyWage.toFixed(2)}/hr` : "0 pts"}
                      </span>
                    </label>
                    <input
                      id="pnp-hourly-wage"
                      type="number"
                      min={0}
                      max={500}
                      step={0.25}
                      placeholder="Enter base hourly wage (e.g. 36.50)..."
                      value={form.hourlyWage === null ? "" : form.hourlyWage}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          updateForm({ hourlyWage: null });
                        } else {
                          const parsed = Number(raw);
                          if (!Number.isNaN(parsed) && parsed >= 0) {
                            updateForm({ hourlyWage: parsed });
                          }
                        }
                      }}
                      style={{ ...selectStyle, cursor: "text" }}
                    />

                    {showSalaryConverter && (
                      <div
                        className="pnp-no-print"
                        style={{
                          marginTop: "14px",
                          padding: "14px",
                          borderRadius: "10px",
                          background: "#F8F7F2",
                          border: "1px solid #DCE5E1",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: "12px",
                          alignItems: "end",
                        }}
                      >
                        <div>
                          <label
                            htmlFor="pnp-annual-salary"
                            style={{
                              display: "block",
                              fontSize: "12.5px",
                              fontWeight: 650,
                              color: "#172322",
                              marginBottom: "6px",
                            }}
                          >
                            Annual Base Salary ($ CAD)
                          </label>
                          <input
                            id="pnp-annual-salary"
                            type="number"
                            min={0}
                            step={500}
                            placeholder="e.g. 78000"
                            value={annualSalaryText}
                            onChange={(e) => setAnnualSalaryText(e.target.value)}
                            style={{ ...selectStyle, padding: "8px 10px", fontSize: "13.5px", cursor: "text" }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="pnp-weekly-hours"
                            style={{
                              display: "block",
                              fontSize: "12.5px",
                              fontWeight: 650,
                              color: "#172322",
                              marginBottom: "6px",
                            }}
                          >
                            Standard Hours / Week
                          </label>
                          <select
                            id="pnp-weekly-hours"
                            value={hoursPerWeekText}
                            onChange={(e) => setHoursPerWeekText(e.target.value)}
                            style={{ ...selectStyle, padding: "8px 10px", fontSize: "13.5px" }}
                          >
                            <option value="35">35.0 hours / week</option>
                            <option value="37.5">37.5 hours / week</option>
                            <option value="40">40.0 hours / week</option>
                          </select>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={handleApplyConvertedSalary}
                            disabled={previewConvertedHourly <= 0}
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              borderRadius: "8px",
                              border: "1px solid #063C3D",
                              background: previewConvertedHourly > 0 ? "#063C3D" : "#DCE5E1",
                              color: previewConvertedHourly > 0 ? "#FFFFFF" : "#6E7F7C",
                              fontSize: "13px",
                              fontWeight: 650,
                              cursor: previewConvertedHourly > 0 ? "pointer" : "not-allowed",
                            }}
                          >
                            {previewConvertedHourly > 0
                              ? `Apply $${previewConvertedHourly.toFixed(2)}/hr`
                              : "Enter salary above"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ================================================================
                3. ACTIVE PROVINCE STATUTORY FACTORS
                ================================================================ */}
            <section style={cardSectionStyle} aria-labelledby="pnp-sec-provincial">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #E7EFEB",
                }}
              >
                <div>
                  <h2
                    id="pnp-sec-provincial"
                    style={{
                      fontSize: "19px",
                      fontWeight: 700,
                      color: "#063C3D",
                      margin: 0,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {activeResult.provinceName} ({activeResult.programShortName}) Statutory Factors
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#526663" }}>
                    {activeResult.officialStreamTitle}
                  </p>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 650, color: "#0D6866" }}>
                  Max {activeResult.maxScore.toLocaleString()} pts
                </span>
              </div>

              {/* --- 3A. ONTARIO OINP --- */}
              {form.activeProvince === "ontario_oinp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "#F4F8F6",
                      border: "1px solid #DCE5E1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px",
                    }}
                  >
                    <label
                      htmlFor="oinp-physician-toggle"
                      style={{ fontSize: "13.5px", fontWeight: 600, color: "#172322", cursor: "pointer" }}
                    >
                      Applying as a licensed Self-Employed Physician in Ontario (NOC 31100 / 31101 / 31102 — Wage-Exempt 117-pt Grid)?
                    </label>
                    <input
                      id="oinp-physician-toggle"
                      type="checkbox"
                      checked={form.oinpIsSelfEmployedPhysician}
                      onChange={(e) =>
                        updateForm({ oinpIsSelfEmployedPhysician: e.target.checked })
                      }
                      style={{ width: "18px", height: "18px", accentColor: "#063C3D", cursor: "pointer" }}
                    />
                  </div>

                  <div>
                    <label htmlFor="oinp-work-exp" style={labelStyle}>
                      <span>Cumulative lawful work experience in Ontario</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 18 pts</span>
                    </label>
                    <select
                      id="oinp-work-exp"
                      value={form.oinpWorkExperience}
                      onChange={(e) =>
                        updateForm({
                          oinpWorkExperience: e.target.value as OinpWorkExperienceTier,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select Ontario work experience...</option>
                      <option value="none_or_under_6m">None or less than 6 months in Ontario (0 pts)</option>
                      <option value="general_on_6_to_11m">6 to less than 12 months general work in Ontario (+6 pts)</option>
                      <option value="general_on_12m_plus">12+ months general work in Ontario — different NOC (+12 pts)</option>
                      <option value="job_offer_role_6_to_12m">6 to 12 months in Ontario in your exact job-offer occupation (+12 pts)</option>
                      <option value="job_offer_role_13_to_24m">13 to 24 months in Ontario in your exact job-offer occupation (+15 pts)</option>
                      <option value="job_offer_role_24m_plus">More than 24 months in Ontario in your exact job-offer occupation (+18 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="oinp-broad-noc" style={labelStyle}>
                      <span>Job offer NOC 2021 Broad Occupational Category (1st digit of NOC)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 10 pts</span>
                    </label>
                    <select
                      id="oinp-broad-noc"
                      value={form.oinpNocBroadCategory}
                      onChange={(e) =>
                        updateForm({
                          oinpNocBroadCategory: e.target.value as NocBroadCategory,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select NOC Broad Category...</option>
                      <option value="cat_3_health">Category 3 — Health Occupations (+10 pts)</option>
                      <option value="cat_7_trades_transport">Category 7 — Trades, Transport &amp; Equipment Operators (+8 pts)</option>
                      <option value="cat_2_stem_natural_applied">Category 2 — Natural &amp; Applied Sciences / STEM (+6 pts)</option>
                      <option value="cat_0_1_4_8_9_mgmt_biz_edu_mfg">Categories 0, 1, 4, 8, 9 — Management, Business, Education, Law, Agriculture, Manufacturing (+4 pts)</option>
                      <option value="cat_5_6_arts_sales_service">Categories 5, 6 — Art, Culture, Recreation, Sales &amp; Service (+2 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="oinp-teer" style={labelStyle}>
                      <span>Job offer NOC TEER Skill Category (2nd digit of NOC)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 9 pts</span>
                    </label>
                    <select
                      id="oinp-teer"
                      value={form.oinpNocTeer}
                      onChange={(e) =>
                        updateForm({ oinpNocTeer: e.target.value as NocTeerCategory })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select NOC TEER level...</option>
                      <option value="teer_0_1">TEER 0 or TEER 1 — Management / University degree roles (+9 pts)</option>
                      <option value="teer_2_3">TEER 2 or TEER 3 — College diploma / Apprenticeship / Skilled trades (+6 pts)</option>
                      <option value="teer_4_5">TEER 4 or TEER 5 — Intermediate or Entry-level occupations (0 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="oinp-status" style={labelStyle}>
                      <span>Current legal status in Canada</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 10 pts</span>
                    </label>
                    <select
                      id="oinp-status"
                      value={form.oinpLegalStatus}
                      onChange={(e) =>
                        updateForm({ oinpLegalStatus: e.target.value as OinpLegalStatus })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select current immigration status...</option>
                      <option value="work_permit">Valid Canadian Work Permit or Maintained Work Authorization (+10 pts)</option>
                      <option value="study_permit">Valid Canadian Study Permit (+5 pts)</option>
                      <option value="other_or_outside">Visitor Record or Applying From Outside Canada (0 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="oinp-earnings" style={labelStyle}>
                      <span>Highest single-year Canadian employment income in past 5 years (CRA Notice of Assessment)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Oct 5, 2026 Tier • Max 10 pts</span>
                    </label>
                    <select
                      id="oinp-earnings"
                      value={form.oinpCraEarnings}
                      onChange={(e) =>
                        updateForm({ oinpCraEarnings: e.target.value as OinpCraEarningsBracket })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select highest CRA Notice of Assessment year...</option>
                      <option value="under_30k">Less than $30,000 CAD or no Canadian CRA Notice of Assessment (0 pts)</option>
                      <option value="30k_to_49k">$30,000 to $49,999 CAD (+4 pts)</option>
                      <option value="50k_to_69k">$50,000 to $69,999 CAD (+6 pts)</option>
                      <option value="70k_to_79k">$70,000 to $79,999 CAD (+8 pts)</option>
                      <option value="80k_plus">$80,000 CAD or more (+10 pts — Oct 5, 2026 top tier)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="oinp-region" style={labelStyle}>
                      <span>Regional location of your Ontario job offer</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 15 pts</span>
                    </label>
                    <select
                      id="oinp-region"
                      value={form.oinpWorkRegion}
                      onChange={(e) =>
                        updateForm({ oinpWorkRegion: e.target.value as OinpWorkRegion })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select Ontario work location...</option>
                      <option value="northern_ontario">Northern Ontario — Sudbury, Thunder Bay, Sault Ste. Marie, North Bay, Timmins (+15 pts)</option>
                      <option value="outside_gta_other">Outside GTA (excluding Northern ON) — Ottawa, Waterloo, London, Windsor, Hamilton, Kingston (+10 pts)</option>
                      <option value="gta_excluding_toronto">Greater Toronto Area excluding City of Toronto — Halton, Peel, York, Durham (+5 pts)</option>
                      <option value="city_of_toronto">City of Toronto (0 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="oinp-can-cred" style={labelStyle}>
                      <span>Completed Canadian post-secondary credentials (DLI programs ≥ 1 academic year)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 10 pts</span>
                    </label>
                    <select
                      id="oinp-can-cred"
                      value={form.oinpCanadianCredentials}
                      onChange={(e) =>
                        updateForm({
                          oinpCanadianCredentials: e.target.value as OinpCanadianCredentials,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select Canadian education credentials...</option>
                      <option value="none">No Canadian post-secondary credential (0 pts)</option>
                      <option value="one_credential">One completed Canadian post-secondary credential (+5 pts)</option>
                      <option value="two_or_more">Two or more completed Canadian post-secondary credentials (+10 pts)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* --- 3B. BRITISH COLUMBIA BC PNP --- */}
              {form.activeProvince === "bc_pnp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <label htmlFor="bc-related-work" style={labelStyle}>
                      <span>Directly related full-time (or FT-equivalent) work experience in past 10 years</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 20 base pts</span>
                    </label>
                    <select
                      id="bc-related-work"
                      value={form.bcRelatedWorkYears}
                      onChange={(e) =>
                        updateForm({ bcRelatedWorkYears: e.target.value as BcRelatedWorkYears })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select directly related experience...</option>
                      <option value="none">No directly related experience (0 pts)</option>
                      <option value="under_1yr">Less than 1 year (+1 pt)</option>
                      <option value="1_to_2yr">1 to less than 2 years (+4 pts)</option>
                      <option value="2_to_3yr">2 to less than 3 years (+8 pts)</option>
                      <option value="3_to_4yr">3 to less than 4 years (+12 pts)</option>
                      <option value="4_to_5yr">4 to less than 5 years (+16 pts)</option>
                      <option value="5yr_plus">5 or more years (+20 pts)</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Do you have at least 1 year of directly related work experience in Canada?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+10 pts</span>
                    </div>
                    {renderYesNoButtons(
                      form.bcHas1YrCanadianRelatedWork,
                      (val) => updateForm({ bcHas1YrCanadianRelatedWork: val }),
                      "Yes (+10 pts)",
                      "No"
                    )}
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Are you currently working full-time in B.C. for the supporting employer in the offered occupation?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+10 pts</span>
                    </div>
                    {renderYesNoButtons(
                      form.bcCurrentlyWorkingFullTimeInBcRole,
                      (val) => updateForm({ bcCurrentlyWorkingFullTimeInBcRole: val }),
                      "Yes (+10 pts)",
                      "No"
                    )}
                  </div>

                  <div>
                    <label htmlFor="bc-edu-loc" style={labelStyle}>
                      <span>Where did you complete your highest post-secondary credential?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max +8 pts</span>
                    </label>
                    <select
                      id="bc-edu-loc"
                      value={form.bcEducationLocation}
                      onChange={(e) =>
                        updateForm({ bcEducationLocation: e.target.value as BcEducationLocation })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select study location...</option>
                      <option value="inside_bc">Completed at an eligible institution inside British Columbia (+8 pts)</option>
                      <option value="canada_outside_bc">Completed in Canada outside British Columbia (+6 pts)</option>
                      <option value="outside_canada">Completed outside Canada or secondary school only (0 pts)</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Do you hold an eligible B.C. professional designation or SkilledTradesBC trade qualification?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                    </div>
                    {renderYesNoButtons(
                      form.bcHasEligibleProfessionalDesignation,
                      (val) => updateForm({ bcHasEligibleProfessionalDesignation: val }),
                      "Yes (+5 pts)",
                      "No"
                    )}
                  </div>

                  <div>
                    <label htmlFor="bc-area" style={labelStyle}>
                      <span>Area of employment within British Columbia</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 15 base pts</span>
                    </label>
                    <select
                      id="bc-area"
                      value={form.bcEmploymentArea}
                      onChange={(e) =>
                        updateForm({ bcEmploymentArea: e.target.value as BcEmploymentArea })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select B.C. regional area...</option>
                      <option value="area_1_metro_vancouver">Area 1 — Metro Vancouver Regional District (0 pts)</option>
                      <option value="area_2_squamish_abbotsford_chilliwack">Area 2 — Squamish, Abbotsford, Agassiz, Mission &amp; Chilliwack (+5 pts)</option>
                      <option value="area_3_rest_of_bc">Area 3 — Rest of B.C. including Victoria, Kelowna, Kamloops, Nanaimo, Prince George (+15 pts)</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Regional Experience or Alumni: 1+ year FT work OR public post-secondary graduation outside Metro Vancouver in past 5 years?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+10 pts (Area 2/3 job)</span>
                    </div>
                    {renderYesNoButtons(
                      form.bcHasRegionalExperienceOrAlumni,
                      (val) => updateForm({ bcHasRegionalExperienceOrAlumni: val }),
                      "Yes (+10 pts if Area 2/3)",
                      "No"
                    )}
                  </div>
                </div>
              )}

              {/* --- 3C. ALBERTA AAIP --- */}
              {form.activeProvince === "alberta_aaip" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <label htmlFor="aaip-edu-loc" style={labelStyle}>
                      <span>Where was your highest completed post-secondary education obtained?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max +10 pts</span>
                    </label>
                    <select
                      id="aaip-edu-loc"
                      value={form.aaipEducationLocation}
                      onChange={(e) =>
                        updateForm({
                          aaipEducationLocation: e.target.value as AaipEducationLocation,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select education location...</option>
                      <option value="alberta">Alberta publicly funded post-secondary institution (+10 pts)</option>
                      <option value="other_province">Other Canadian province or territory DLI (+6 pts)</option>
                      <option value="outside_canada">Outside Canada or secondary school only (0 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="aaip-work-dur" style={labelStyle}>
                      <span>Total full-time qualifying work experience (Canada + foreign combined)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 11 pts</span>
                    </label>
                    <select
                      id="aaip-work-dur"
                      value={form.aaipTotalWorkDuration}
                      onChange={(e) =>
                        updateForm({
                          aaipTotalWorkDuration: e.target.value as AaipTotalWorkMonths,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select total work duration...</option>
                      <option value="none">No qualifying work experience (0 pts)</option>
                      <option value="under_6m">Less than 6 months full-time (+3 pts)</option>
                      <option value="6_to_11m">6 to 11 months full-time (+7 pts)</option>
                      <option value="12m_plus">12 months or more full-time (+11 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="aaip-can-work" style={labelStyle}>
                      <span>Location of Canadian work experience (at least 6 months full-time)</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max +10 pts</span>
                    </label>
                    <select
                      id="aaip-can-work"
                      value={form.aaipCanadianWorkLocation}
                      onChange={(e) =>
                        updateForm({
                          aaipCanadianWorkLocation: e.target.value as AaipCanadianWorkLocation,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select Canadian work location...</option>
                      <option value="alberta_6m">At least 6 months full-time work in Alberta (+10 pts)</option>
                      <option value="other_province_6m">At least 6 months full-time work in another Canadian province (+6 pts)</option>
                      <option value="none_under_6m">None or less than 6 months in Canada (0 pts)</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Do you have a parent, child, or sibling (Citizen/PR aged 18+) currently residing in Alberta (excluding in-laws)?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+8 pts</span>
                    </div>
                    {renderYesNoButtons(
                      form.aaipHasFamilyInAlberta,
                      (val) => updateForm({ aaipHasFamilyInAlberta: val }),
                      "Yes (+8 pts)",
                      "No"
                    )}
                  </div>

                  <div style={{ paddingTop: "14px", borderTop: "1px solid #E7EFEB" }}>
                    <div style={labelStyle}>
                      <span>Do you have a bona fide permanent full-time Alberta job offer?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+10 base pts (unlocks 31 Economic pts)</span>
                    </div>
                    {renderYesNoButtons(
                      form.aaipHasValidJobOffer,
                      (val) => updateForm({ aaipHasValidJobOffer: val }),
                      "Yes (+10 pts)",
                      "No"
                    )}
                  </div>

                  {form.aaipHasValidJobOffer === true && (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "10px",
                        background: "#F8F7F2",
                        border: "1px solid #DCE5E1",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div>
                        <div style={labelStyle}>
                          <span>Is your Alberta job offer in a Priority Sector (Healthcare, Construction, Agriculture, Aviation), Rural Renewal, Tourism &amp; Hospitality, or Law Enforcement?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+6 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.aaipIsPriorityRuralTourismOrPolice,
                          (val) => updateForm({ aaipIsPriorityRuralTourismOrPolice: val }),
                          "Yes (+6 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <label htmlFor="aaip-job-loc" style={labelStyle}>
                          <span>Where is your Alberta workplace located?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max +5 pts</span>
                        </label>
                        <select
                          id="aaip-job-loc"
                          value={form.aaipJobLocation}
                          onChange={(e) =>
                            updateForm({ aaipJobLocation: e.target.value as AaipJobLocation })
                          }
                          style={selectStyle}
                        >
                          <option value="">Select Alberta workplace location...</option>
                          <option value="rural_or_outside_cma">Outside Calgary &amp; Edmonton Census Metropolitan Areas — Red Deer, Lethbridge, Fort McMurray, Grande Prairie, Medicine Hat (+5 pts)</option>
                          <option value="calgary_edmonton_cma">Inside Calgary CMA or Edmonton CMA (0 pts)</option>
                        </select>
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Is your offered occupation regulated or a designated trade in Alberta AND do you hold valid Alberta licensing/certification?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+10 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.aaipIsRegulatedAndLicensedInAlberta,
                          (val) => updateForm({ aaipIsRegulatedAndLicensedInAlberta: val }),
                          "Yes (+10 pts)",
                          "No"
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- 3D. SASKATCHEWAN SINP --- */}
              {form.activeProvince === "saskatchewan_sinp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <label htmlFor="sinp-recent-work" style={labelStyle}>
                      <span>Skilled full-time work experience in the MOST RECENT 5 years prior to application</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 10 pts</span>
                    </label>
                    <select
                      id="sinp-recent-work"
                      value={form.sinpRecentWorkYears === null ? "" : form.sinpRecentWorkYears}
                      onChange={(e) =>
                        updateForm({
                          sinpRecentWorkYears:
                            e.target.value === ""
                              ? null
                              : (Number(e.target.value) as SinpRecentWorkYears),
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select years in past 5 years...</option>
                      <option value={0}>Less than 1 year (0 pts)</option>
                      <option value={1}>1 year (+2 pts)</option>
                      <option value={2}>2 years (+4 pts)</option>
                      <option value={3}>3 years (+6 pts)</option>
                      <option value={4}>4 years (+8 pts)</option>
                      <option value={5}>5 years (+10 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sinp-older-work" style={labelStyle}>
                      <span>Skilled full-time work experience in the 6 to 10 years prior to application</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 5 pts</span>
                    </label>
                    <select
                      id="sinp-older-work"
                      value={form.sinpOlderWorkYears === null ? "" : form.sinpOlderWorkYears}
                      onChange={(e) =>
                        updateForm({
                          sinpOlderWorkYears:
                            e.target.value === ""
                              ? null
                              : (Number(e.target.value) as SinpOlderWorkYears),
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select years during years 6–10 ago...</option>
                      <option value={0}>Less than 1 year (0 pts)</option>
                      <option value={1}>1 year (0 pts per SINP grid)</option>
                      <option value={2}>2 years (+2 pts)</option>
                      <option value={3}>3 years (+3 pts)</option>
                      <option value={4}>4 years (+4 pts)</option>
                      <option value={5}>5 years (+5 pts)</option>
                    </select>
                  </div>

                  <div style={{ paddingTop: "14px", borderTop: "1px solid #E7EFEB" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", marginBottom: "12px" }}>
                      Factor II: Connection to Saskatchewan Labour Market &amp; Adaptability (Capped at 30 pts)
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div>
                        <div style={labelStyle}>
                          <span>Do you hold a valid SINP Job Approval Letter (JAL) for a high-skilled Saskatchewan job offer?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+30 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.sinpHasJobApprovalLetter,
                          (val) => updateForm({ sinpHasJobApprovalLetter: val }),
                          "Yes (+30 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Do you or your spouse have a close family relative in Saskatchewan (parent, sibling, grandparent, aunt/uncle, niece/nephew, or first cousin — Citizen/PR in SK 12+ mos)?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+20 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.sinpHasCloseRelativeInSk,
                          (val) => updateForm({ sinpHasCloseRelativeInSk: val }),
                          "Yes (+20 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Past Saskatchewan work experience (at least 12 months in past 5 years on a valid work permit)?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.sinpHasPastSkWork12Months,
                          (val) => updateForm({ sinpHasPastSkWork12Months: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Past Saskatchewan study experience (at least 1 full-time academic year at a recognized SK institution)?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.sinpHasPastSkStudy1Year,
                          (val) => updateForm({ sinpHasPastSkStudy1Year: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sinp-sector" style={labelStyle}>
                      <span>2026 SINP Occupational Sector Classification</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Intake Window Check</span>
                    </label>
                    <select
                      id="sinp-sector"
                      value={form.sinpSectorType}
                      onChange={(e) =>
                        updateForm({ sinpSectorType: e.target.value as SinpSectorType })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select occupational sector...</option>
                      <option value="priority_sector">Priority Sector — Healthcare, Agriculture, Skilled Trades, Tech, Mining, Manufacturing, Energy (Continuous 50%+ Allocation)</option>
                      <option value="standard_sector">Other Eligible TEER 0 / 1 / 2 / 3 Skilled Sector</option>
                      <option value="capped_sector">Capped Sector — Accommodation &amp; Food (15%), Trucking (5%), or Retail Trade (5%) [Scheduled Windows Only]</option>
                    </select>
                  </div>
                </div>
              )}

              {/* --- 3E. MANITOBA MPNP --- */}
              {form.activeProvince === "manitoba_mpnp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <label htmlFor="mpnp-work" style={labelStyle}>
                      <span>Full-time work experience in the past 5 years</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 75 base pts</span>
                    </label>
                    <select
                      id="mpnp-work"
                      value={form.mpnpWorkYearsPast5 === null ? "" : form.mpnpWorkYearsPast5}
                      onChange={(e) =>
                        updateForm({
                          mpnpWorkYearsPast5:
                            e.target.value === ""
                              ? null
                              : (Number(e.target.value) as MpnpWorkYears),
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select full-time work years in past 5 years...</option>
                      <option value={0}>Less than 1 year (0 pts)</option>
                      <option value={1}>1 year (+40 pts)</option>
                      <option value={2}>2 years (+50 pts)</option>
                      <option value={3}>3 years (+60 pts)</option>
                      <option value={4}>4 or more years (+75 pts)</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Are you fully recognized by Manitoba&apos;s provincial licensing body to practice in a regulated occupation (with 1+ yr experience)?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+100 pts</span>
                    </div>
                    {renderYesNoButtons(
                      form.mpnpRecognizedByProvincialLicense,
                      (val) => updateForm({ mpnpRecognizedByProvincialLicense: val }),
                      "Yes (+100 pts)",
                      "No"
                    )}
                  </div>

                  <div>
                    <label htmlFor="mpnp-adapt" style={labelStyle}>
                      <span>Factor 5: Highest Manitoba Connection / Adaptability Factor</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 500 pts</span>
                    </label>
                    <select
                      id="mpnp-adapt"
                      value={form.mpnpPrimaryAdaptability}
                      onChange={(e) =>
                        updateForm({
                          mpnpPrimaryAdaptability: e.target.value as MpnpAdaptabilityPrimary,
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select primary Manitoba connection...</option>
                      <option value="none">No established Manitoba connection yet (0 pts)</option>
                      <option value="ongoing_mb_employment_or_strategic_ita">Ongoing full-time Manitoba employment (6+ months) OR Strategic Recruitment Invitation (+500 pts)</option>
                      <option value="close_relative_mb">Close relative in Manitoba — Citizen/PR residing in MB 1+ year (+200 pts)</option>
                      <option value="previous_mb_work_6m">Previous work experience in Manitoba — 6+ continuous months in past 5 years (+100 pts)</option>
                      <option value="mb_post_sec_2yr">Completed 2-year+ post-secondary program in Manitoba in past 5 years (+100 pts)</option>
                      <option value="mb_post_sec_1yr">Completed 1-year post-secondary program in Manitoba in past 5 years (+50 pts)</option>
                      <option value="distant_relative_or_friend_mb">Close friend or distant relative residing in Manitoba 1+ year (+50 pts)</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>
                      <span>Regional Immigration: Planning to settle and work in Manitoba outside the Winnipeg Metropolitan Region?</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+50 pts (up to 500 cap)</span>
                    </div>
                    {renderYesNoButtons(
                      form.mpnpRegionalOutsideWinnipeg,
                      (val) => updateForm({ mpnpRegionalOutsideWinnipeg: val }),
                      "Yes (+50 pts)",
                      "No"
                    )}
                  </div>

                  {/* Risk Assessment Deductions */}
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      background: "#FEF7EA",
                      border: "1px solid #F0D9B5",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#8A5A10" }}>
                        Factor 6: Manitoba Risk Assessment (Mandatory Deduction Check)
                      </div>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#8A5A10" }}>
                        MPNP deducts points when candidates have prior work or post-secondary study ties to other Canadian provinces.
                      </p>
                    </div>

                    <div>
                      <div style={labelStyle}>
                        <span>Have you ever worked in another Canadian province outside Manitoba?</span>
                        <span style={{ fontSize: "12.5px", color: "#991B1B", fontWeight: 700 }}>
                          -100 pts if Yes
                        </span>
                      </div>
                      {renderYesNoButtons(
                        form.mpnpRiskWorkedOtherProvince,
                        (val) => updateForm({ mpnpRiskWorkedOtherProvince: val }),
                        "Yes (-100 pts)",
                        "No (0 deduction)",
                        true
                      )}
                    </div>

                    <div>
                      <div style={labelStyle}>
                        <span>Have you ever completed post-secondary study in another Canadian province outside Manitoba?</span>
                        <span style={{ fontSize: "12.5px", color: "#991B1B", fontWeight: 700 }}>
                          -100 pts if Yes
                        </span>
                      </div>
                      {renderYesNoButtons(
                        form.mpnpRiskStudiedOtherProvince,
                        (val) => updateForm({ mpnpRiskStudiedOtherProvince: val }),
                        "Yes (-100 pts)",
                        "No (0 deduction)",
                        true
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 3F. PRINCE EDWARD ISLAND PEI PNP --- */}
              {form.activeProvince === "pei_pnp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <div style={labelStyle}>
                      <span>PEI Expression of Interest Pathway Grid</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 100 pts</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {(
                        [
                          {
                            mode: "with_job_offer" as PeiPathwayMode,
                            label: "With PEI Job Offer (Work 15 / Emp 15)",
                          },
                          {
                            mode: "without_job_offer" as PeiPathwayMode,
                            label: "Without PEI Job Offer (Work 20 / Emp 10)",
                          },
                        ] as const
                      ).map((opt) => {
                        const active = form.peiPathwayMode === opt.mode;
                        return (
                          <button
                            key={opt.mode}
                            type="button"
                            onClick={() => updateForm({ peiPathwayMode: opt.mode })}
                            style={{
                              flex: 1,
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: active ? "1px solid #063C3D" : "1px solid #BDCDC7",
                              background: active ? "#063C3D" : "#FFFFFF",
                              color: active ? "#FFFFFF" : "#172322",
                              fontWeight: 650,
                              fontSize: "13.5px",
                              cursor: "pointer",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pei-work-years" style={labelStyle}>
                      <span>Continuous full-time work experience</span>
                      <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                        Max {form.peiPathwayMode === "with_job_offer" ? "15" : "20"} pts
                      </span>
                    </label>
                    <select
                      id="pei-work-years"
                      value={form.peiWorkYears}
                      onChange={(e) =>
                        updateForm({ peiWorkYears: e.target.value as PeiWorkYears })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select full-time work experience...</option>
                      <option value="none">Less than 1 year (0 pts)</option>
                      <option value="1yr">1 to less than 2 years (+5 pts)</option>
                      <option value="2_to_3yr">2 to less than 4 years (+10 pts)</option>
                      <option value="4_to_5yr">4 to less than 6 years (+15 pts)</option>
                      <option value="6yr_plus">
                        6 or more years (+{form.peiPathwayMode === "with_job_offer" ? "15" : "20"} pts)
                      </option>
                    </select>
                  </div>

                  <div style={{ paddingTop: "14px", borderTop: "1px solid #E7EFEB" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", marginBottom: "12px" }}>
                      PEI Employment Alignment Factors (Capped at{" "}
                      {form.peiPathwayMode === "with_job_offer" ? "15" : "10"} pts)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <div style={labelStyle}>
                          <span>Currently working in Prince Edward Island on a valid Canadian work permit?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiWorkingInPeiOnPermit,
                          (val) => updateForm({ peiWorkingInPeiOnPermit: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Is your employment / skilled work directly related to your completed post-secondary education?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiJobRelatedToStudy,
                          (val) => updateForm({ peiJobRelatedToStudy: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Do you have at least 1 year of continuous full-time work experience in PEI?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiHas1YrContinuousPeiWork,
                          (val) => updateForm({ peiHas1YrContinuousPeiWork: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ paddingTop: "14px", borderTop: "1px solid #E7EFEB" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", marginBottom: "12px" }}>
                      PEI Adaptability Factors (Capped at 15 pts total)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <div style={labelStyle}>
                          <span>Close family member in PEI (parent, sibling, child, aunt/uncle — Citizen/PR residing in PEI 12+ consecutive months)?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiHasCloseFamilyInPei,
                          (val) => updateForm({ peiHasCloseFamilyInPei: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Graduated from a publicly funded PEI post-secondary institution (minimum 2-year program)?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiGraduatedFromPeiInstitution,
                          (val) => updateForm({ peiGraduatedFromPeiInstitution: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Accompanying spouse/partner has CLB 6+ language proficiency OR at least 1 year of recent continuous work experience?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiSpouseLanguageOrWorkQualified,
                          (val) => updateForm({ peiSpouseLanguageOrWorkQualified: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>

                      <div>
                        <div style={labelStyle}>
                          <span>Own residential property in PEI for 12+ consecutive months OR dependent child enrolled in a PEI K–12 school for 6+ months?</span>
                          <span style={{ fontSize: "12.5px", color: "#0D6866" }}>+5 pts</span>
                        </div>
                        {renderYesNoButtons(
                          form.peiPropertyOrChildInPeiSchool,
                          (val) => updateForm({ peiPropertyOrChildInPeiSchool: val }),
                          "Yes (+5 pts)",
                          "No"
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ================================================================
              RIGHT COLUMN (5 cols): STICKY OFFICIAL PROVINCIAL SCORE LEDGER
              ================================================================ */}
          <aside
            className="pnp-ledger-col"
            aria-label="Provincial Score Breakdown and Benchmarks"
            style={{
              gridColumn: "span 5",
              position: "sticky",
              top: "84px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            {/* Primary Provincial Score Card */}
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
                  {activeResult.provinceName} ({activeResult.programShortName}) Score
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 650,
                    color: "#07594F",
                    background: "#EAF5EF",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeResult.minimumPassMark !== null
                    ? `Pass Mark: ${activeResult.minimumPassMark}`
                    : "EOI Ranked"}
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
                  data-testid="pnp-grand-total"
                  style={{
                    fontSize: "56px",
                    fontWeight: 800,
                    color: "#063C3D",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                  }}
                >
                  {activeResult.totalScore}
                </span>
                <span style={{ fontSize: "18px", fontWeight: 600, color: "#6E7F7C" }}>
                  / {activeResult.maxScore.toLocaleString()} pts
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
                    width: `${Math.min(
                      100,
                      Math.max(0, (activeResult.totalScore / activeResult.maxScore) * 100)
                    )}%`,
                    background: "#063C3D",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>

              {/* Day-0 Zero State Guidance vs Active Eligibility Gate */}
              {!activeResult.hasAnyInput ? (
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
                  Complete the questionnaire on the left to calculate your provincial EOI / selection score from 0.
                </div>
              ) : activeResult.minimumPassMark !== null ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: activeResult.meetsPassMark ? "#EAF6F0" : "#FEF7EA",
                    border: activeResult.meetsPassMark
                      ? "1px solid #B9DED4"
                      : "1px solid #F0D9B5",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: activeResult.meetsPassMark ? "#176B50" : "#8A5A10",
                    lineHeight: 1.5,
                  }}
                >
                  {activeResult.meetsPassMark
                    ? `✓ Meets ${activeResult.programShortName} Statutory Pass Mark (${activeResult.totalScore} / ${activeResult.minimumPassMark} minimum)`
                    : `Below ${activeResult.programShortName} Minimum Pass Mark: ${
                        activeResult.minimumPassMark - activeResult.totalScore
                      } more points needed to reach ${activeResult.minimumPassMark} / ${activeResult.maxScore}.`}
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    fontSize: "12.5px",
                    color: "#445451",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#063C3D" }}>Pool Ranking Mode:</strong>{" "}
                  {activeResult.programShortName} invites top-scoring candidates in targeted occupation, regional, and general EOI rounds.
                </div>
              )}

              {/* Statutory Section Breakdown */}
              <div style={{ marginTop: "18px", borderTop: "1px solid #DCE5E1" }}>
                {activeResult.sections.map((sec, idx) => {
                  const isOpen = !collapsedSections[sec.id];
                  const isLast = idx === activeResult.sections.length - 1;
                  return (
                    <div
                      key={sec.id}
                      style={{
                        borderBottom: isLast ? "none" : "1px solid #E7EFEB",
                        padding: isLast ? "12px 0 0 0" : "12px 0",
                      }}
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleSection(sec.id)}
                        style={{
                          width: "100%",
                          background: "none",
                          border: "none",
                          padding: 0,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "13.5px",
                          fontWeight: 700,
                          color:
                            sec.isDeductionSection && sec.points < 0 ? "#991B1B" : "#063C3D",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span>{sec.title}</span>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {sec.isDeductionSection
                            ? `${sec.points} pts`
                            : `${sec.points} / ${sec.maxPoints}`}
                        </span>
                      </button>

                      {isOpen && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                            fontSize: "12.5px",
                            color: "#445451",
                          }}
                        >
                          {sec.items.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "10px",
                                color:
                                  item.isDeduction && item.points < 0 ? "#991B1B" : "#445451",
                              }}
                            >
                              <span>{item.label}</span>
                              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                {item.isDeduction
                                  ? `${item.points}`
                                  : `${item.points} / ${item.maxPoints}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Export / Copy / Share Bar */}
              <div
                className="pnp-no-print"
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
                    flex: "1 1 140px",
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
                calculatorId="canada-pnp"
                calculatorTitle={`Canada PNP — ${activeResult.provinceName} (${activeResult.programShortName})`}
                countryCode="CA"
                liveScoreSummary={`${activeResult.totalScore} / ${activeResult.maxScore} ${activeResult.programShortName} pts`}
                hasCalculatedScore={activeResult.totalScore > 0}
                scorePayload={{
                  province: form.activeProvince,
                  totalScore: activeResult.totalScore,
                  maxScore: activeResult.maxScore,
                }}
              />
            </div>

            {/* Express Entry +600 CRS Bridge Card */}
            <div
              className="pnp-no-print"
              style={{
                background: "#EAF6F0",
                border: "1px solid #B9DED4",
                borderRadius: "12px",
                padding: "18px 20px",
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
                <span style={{ fontSize: "14px", fontWeight: 750, color: "#063C3D" }}>
                  Express Entry Enhanced Nomination Impact
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 750,
                    color: "#07594F",
                    background: "#FFFFFF",
                    border: "1px solid #B9DED4",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  +600 CRS pts
                </span>
              </div>
              <p
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "12.5px",
                  color: "#172322",
                  lineHeight: 1.5,
                }}
              >
                Receiving a provincial nomination through an Express Entry–aligned stream adds <strong>600 Additional Points</strong> to your federal CRS profile — virtually guaranteeing an IRCC Invitation to Apply.
              </p>
              <Link
                href="/crs-calculator"
                style={{
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#063C3D",
                  textDecoration: "underline",
                }}
              >
                Calculate your Federal Express Entry CRS Score →
              </Link>
            </div>

            {/* Recent 2026 Provincial Draw Benchmarks */}
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
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  {activeResult.programShortName} 2026 Draw Benchmarks
                </h3>
                <a
                  href={activeResult.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "12px", fontWeight: 600, color: "#0D6866", whiteSpace: "nowrap" }}
                >
                  Official {activeResult.programShortName} Portal ↗
                </a>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeResult.benchmarks.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background:
                        activeResult.hasAnyInput && b.meetsCutoff ? "#EAF6F0" : "#F8F7F2",
                      border:
                        activeResult.hasAnyInput && b.meetsCutoff
                          ? "1px solid #B9DED4"
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
                      <div style={{ fontSize: "11.5px", color: "#445451", marginTop: "2px" }}>
                        Range: {b.cutoffRangeLabel} • {b.note}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: !activeResult.hasAnyInput
                            ? "#6E7F7C"
                            : b.meetsCutoff
                              ? "#176B50"
                              : "#8A5A10",
                        }}
                      >
                        {!activeResult.hasAnyInput
                          ? `Cutoff ~${b.recentCutoff}`
                          : b.meetsCutoff
                            ? `+${b.pointsDelta} above ${b.recentCutoff}`
                            : `${Math.abs(b.pointsDelta)} below ${b.recentCutoff}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personalized What-If Score Boosters (only once user enters data) */}
            {tips.length > 0 && (
              <div
                className="pnp-no-print"
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
                  Fastest Ways to Boost Your {activeResult.programShortName} Score
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

            {/* Official Provincial Statutory Advisories */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "20px 22px",
              }}
            >
              <h3
                style={{
                  fontSize: "14.5px",
                  fontWeight: 700,
                  color: "#063C3D",
                  margin: "0 0 10px 0",
                }}
              >
                {activeResult.programShortName} 2026 Regulatory Notes
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "12.5px",
                  color: "#445451",
                  lineHeight: 1.55,
                }}
              >
                {activeResult.advisories.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>

            {/* Next Step: Audit PNP Evidence in AI Lab */}
            <div
              className="pnp-no-print"
              style={{
                background: "#063C3D",
                color: "#FFFFFF",
                borderRadius: "12px",
                padding: "20px 22px",
              }}
            >
              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px" }}>
                Preparing a Provincial Nominee application packet?
              </div>
              <p
                style={{
                  margin: "0 0 14px 0",
                  fontSize: "13px",
                  color: "#DDEFE8",
                  lineHeight: 1.55,
                }}
              >
                Upload Employer Job Offer forms, CRA Notices of Assessment, T4s, Pay Stubs, Work Permits, or Language Certificates to verify every field automatically.
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

        {/* Statutory Footnote & Provincial Government Authorities */}
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
            <strong style={{ color: "#172322" }}>Official Provincial Regulatory Basis:</strong>{" "}
            Point tables replicate published 2026 EOI &amp; assessment grids from{" "}
            <a
              href="https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              Ontario OINP (Oct 5, 2026)
            </a>
            ,{" "}
            <a
              href="https://www.welcomebc.ca/immigrate-to-b-c/skills-immigration"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              BC PNP SIRS
            </a>
            ,{" "}
            <a
              href="https://www.alberta.ca/aaip-worker-expression-of-interest"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              Alberta AAIP
            </a>
            ,{" "}
            <a
              href="https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              Saskatchewan SINP
            </a>
            ,{" "}
            <a
              href="https://immigratemanitoba.com/immigrate/skilled-worker/swm/ranking/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              Manitoba MPNP
            </a>
            , and{" "}
            <a
              href="https://www.princeedwardisland.ca/en/information/office-of-immigration/expression-of-interest"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0D6866", textDecoration: "underline" }}
            >
              PEI PNP
            </a>
            . Informational calculation only; does not constitute legal advice or a provincial nomination.
          </div>
          <div style={{ fontWeight: 600, color: "#063C3D" }}>
            The Documento • Canadian Legal Ops Suite
          </div>
        </footer>
      </main>

      {/* Mobile Bottom Docked Score Summary Bar */}
      <div
        className="pnp-mobile-score-bar pnp-no-print"
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
          <div style={{ fontSize: "11.5px", color: "#B9DED4" }}>
            Live {activeResult.programShortName} Score
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1.1 }}>
            {activeResult.totalScore}{" "}
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#B9DED4" }}>
              / {activeResult.maxScore.toLocaleString()}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector(".pnp-ledger-col");
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
        @media (max-width: 1100px) {
          .pnp-province-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 1024px) {
          .pnp-hero-left,
          .pnp-hero-right,
          .pnp-form-col,
          .pnp-ledger-col {
            grid-column: span 12 !important;
            position: static !important;
          }
          .pnp-mobile-score-bar {
            display: flex !important;
          }
          .pnp-main-container {
            padding-bottom: 120px !important;
          }
        }
        @media (max-width: 640px) {
          .pnp-province-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .pnp-ability-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media print {
          .pnp-no-print {
            display: none !important;
          }
          body {
            background: #FFFFFF !important;
          }
          .pnp-form-col,
          .pnp-ledger-col {
            grid-column: span 12 !important;
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}

