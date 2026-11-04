"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CountryCalculatorHeroCard } from "./CountryVisualIdentity";
import {
  calculateGermanyPr,
  DE_BLUE_CARD_REDUCED_2026,
  DE_BLUE_CARD_STANDARD_2026,
  DeAgeBand,
  DEFAULT_GERMANY_INPUT,
  DeEnglishLevel,
  DeGermanLevel,
  DeQualificationStatus,
  DeWorkExperienceBand,
  generateGermanyTips,
  GermanyPrInput,
} from "../../lib/global-calculators/germany";

export function GermanyPrCalculatorTool() {
  const [form, setForm] = useState<GermanyPrInput>(DEFAULT_GERMANY_INPUT);
  const [previousBeforePreview, setPreviousBeforePreview] =
    useState<GermanyPrInput | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("de");
      if (encoded) {
        const parsed = JSON.parse(decodeURIComponent(atob(encoded))) as Partial<GermanyPrInput>;
        if (parsed && typeof parsed === "object") {
          setForm({ ...DEFAULT_GERMANY_INPUT, ...parsed });
        }
      }
    } catch {
      // ignore malformed query param
    }
  }, []);

  const result = useMemo(() => calculateGermanyPr(form), [form]);
  const tips = useMemo(() => generateGermanyTips(form, result), [form, result]);

  const updateForm = (patch: Partial<GermanyPrInput>) => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const resetToZero = () => {
    setPreviousBeforePreview(null);
    setForm(DEFAULT_GERMANY_INPUT);
  };

  const buildPlainTextSummary = (): string => {
    return [
      "======================================================================",
      "THE DOCUMENTO — GERMANY CHANCENKARTE & EU BLUE CARD PR ASSESSMENT",
      "Statutory Basis: § 20a / § 20b & § 18g / § 18c(2) AufenthG (2026)",
      "======================================================================",
      "",
      `CHANCENKARTE POINTS: ${result.totalPoints} pts (Pass Mark: ${result.passMark} pts)`,
      `Direct Fachkraft Equivalence Waiver: ${
        result.qualifiesViaDirectFachkraftWaiver ? "YES (Points Waived)" : "NO"
      }`,
      `Chancenkarte Eligibility: ${
        result.chancenkarteEligible ? "ELIGIBLE FOR CHANCENKARTE" : "NOT YET ELIGIBLE"
      }`,
      `2026 EU Blue Card Status: ${
        result.blueCard.eligibleForBlueCard
          ? `ELIGIBLE -> Fast-Track PR in ${result.blueCard.prMonthsTimeline} Months`
          : `Requires €${result.blueCard.requiredSalaryEur.toLocaleString()}/yr`
      }`,
      "----------------------------------------------------------------------",
      `Partial Recognition (Defizitbescheid):   ${result.breakdown.partialRecognition} / 4`,
      `Shortage Occupation (Mangelberuf):       ${result.breakdown.shortageOccupation} / 1`,
      `Professional Work Experience:            ${result.breakdown.workExperience} / 3`,
      `German Language (A2=1, B1=2, B2+=3):     ${result.breakdown.germanLanguage} / 3`,
      `English Language (C1+=1):                ${result.breakdown.englishLanguage} / 1`,
      `Age (<=35=2, 36-40=1):                   ${result.breakdown.age} / 2`,
      `Prior 6-Month Legal German Stay:         ${result.breakdown.priorGermanStay} / 1`,
      `Qualifying Partner Applying Together:    ${result.breakdown.partnerBonus} / 1`,
      "----------------------------------------------------------------------",
      "Generated via The Documento (thedocumento.com/calculators/germany-pr)",
    ].join("\n");
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "8px",
    border: "1px solid #BDCDC7",
    background: "#FFFFFF",
    color: "#172322",
    fontSize: "14px",
    fontWeight: 500,
    outline: "none",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "8px",
    border: "1px solid #BDCDC7",
    background: "#FFFFFF",
    color: "#172322",
    fontSize: "14px",
    fontWeight: 500,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13.5px",
    fontWeight: 650,
    color: "#063C3D",
    marginBottom: "6px",
  };

  const renderYesNoButtons = (
    value: boolean | null,
    onChange: (next: boolean) => void,
    yesLabel = "Yes",
    noLabel = "No"
  ) => (
    <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          border: value === true ? "1.5px solid #063C3D" : "1px solid #BDCDC7",
          background: value === true ? "#063C3D" : "#FFFFFF",
          color: value === true ? "#FFFFFF" : "#172322",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          border: value === false ? "1.5px solid #063C3D" : "1px solid #BDCDC7",
          background: value === false ? "#063C3D" : "#FFFFFF",
          color: value === false ? "#FFFFFF" : "#172322",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {noLabel}
      </button>
    </div>
  );

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
      <header
        className="de-no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(18px) saturate(180%)",
          WebkitBackdropFilter: "blur(18px) saturate(180%)",
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
            <span aria-hidden="true" style={{ width: "1px", height: "20px", background: "#DCE5E1" }} />
            <span style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
              Germany Chancenkarte &amp; EU Blue Card PR Calculator
            </span>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {previousBeforePreview && (
              <button
                type="button"
                onClick={() => {
                  setForm(previousBeforePreview);
                  setPreviousBeforePreview(null);
                }}
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
            {result.hasAnyInput && (
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
      <CalculatorCountrySwitchBar activeCalculatorId="de_chancenkarte_bluecard" />

      <main style={{ maxWidth: "1320px", margin: "0 auto", padding: "36px 24px 96px 24px" }}>
        <section
          style={{
            marginBottom: "28px",
            paddingBottom: "22px",
            borderBottom: "1px solid #DCE5E1",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "24px",
            alignItems: "end",
          }}
        >
          <div style={{ gridColumn: "span 8" }} className="de-col-full">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 12px",
                borderRadius: "6px",
                background: "#E8F4F0",
                color: "#07594F",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Germany FEG • § 20b AufenthG Chancenkarte (6 Pts) &amp; § 18g EU Blue Card PR
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontSize: "clamp(26px, 3.1vw, 38px)",
                lineHeight: 1.12,
                letterSpacing: "-0.02em",
                color: "#063C3D",
                margin: "0 0 10px 0",
                fontWeight: 700,
              }}
            >
              Germany Chancenkarte &amp; EU Blue Card Fast-Track PR Calculator
            </h1>
            <p style={{ fontSize: "15.5px", lineHeight: 1.55, color: "#445451", margin: 0, maxWidth: "74ch" }}>
              Score your <strong>Chancenkarte (Opportunity Card)</strong> eligibility under Germany&apos;s{" "}
              <strong>6-Point Statutory Grid (§ 20b AufenthG)</strong> or direct{" "}
              <em>Fachkraft</em> equivalence, and test 2026 <strong>EU Blue Card</strong> salary thresholds
              (<code>€50,700</code> standard / <code>€45,934.20</code> shortage &amp; recent grads) for{" "}
              <strong>21-month or 27-month Permanent Settlement</strong> (<em>Niederlassungserlaubnis</em>).
            </p>
          </div>

          <div style={{ gridColumn: "span 4" }} className="de-col-full">
            <CountryCalculatorHeroCard
              countryId="germany"
              authorityLabel="2026 Statutory Standards"
              headlineMetric="6 Points Chancenkarte • €45,934–€50,700 Blue Card"
              subMetric="PR in 21 mos (German B1) or 27 mos (German A1)"
            />
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "28px",
            alignItems: "start",
          }}
        >
          {/* Left 7 Columns */}
          <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "22px" }} className="de-col-full">
            {/* Section 1: Baseline & Qualification Equivalence */}
            <section
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "26px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  1. Qualification Equivalence &amp; Baseline Prerequisites
                </h2>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0D6866" }}>
                  {result.qualifiesViaDirectFachkraftWaiver
                    ? "Direct Fachkraft Waiver"
                    : `${result.breakdown.partialRecognition + result.breakdown.shortageOccupation} / 5 pts`}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="de-qual" style={labelStyle}>
                    Academic / Vocational Qualification &amp; ANABIN / ZAB Recognition Status
                  </label>
                  <select
                    id="de-qual"
                    value={form.qualificationStatus}
                    onChange={(e) =>
                      updateForm({ qualificationStatus: e.target.value as DeQualificationStatus })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select qualification recognition status... (0 pts)</option>
                    <option value="none_below_2yr">
                      No State-Recognized 2+ Year Vocational Credential or Degree (Ineligible)
                    </option>
                    <option value="foreign_degree_or_2yr_vocational">
                      State-Recognized Foreign University Degree or 2+ Yr Vocational Training — Points Route Baseline (0 bonus pts)
                    </option>
                    <option value="partial_recognition_defizitbescheid">
                      Partial German Equivalence Notice (Defizitbescheid / Regulated License Adaptation) (+4 pts)
                    </option>
                    <option value="full_german_equivalence_fachkraft">
                      Full German Equivalence (ANABIN H+ &amp; Entspricht / Direct Fachkraft — Waives 6-Pt Requirement)
                    </option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 650, color: "#063C3D" }}>
                      Shortage Occupation (<em>Engpassberuf / Mangelberuf</em> — STEM, IT, Healthcare, Engineering, Trades)
                    </div>
                    <div style={{ fontSize: "12px", color: "#5C6E6A" }}>
                      +1 Chancenkarte point AND unlocks reduced €45,934.20 EU Blue Card threshold
                    </div>
                  </div>
                  {renderYesNoButtons(form.isShortageOccupationMangelberuf, (v) =>
                    updateForm({ isShortageOccupationMangelberuf: v })
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 650, color: "#063C3D" }}>
                      Proof of Financial Self-Sufficiency (<em>Sperrkonto</em> ~€1,091/mo or ≤20 hr/wk Side Job)
                    </div>
                    <div style={{ fontSize: "12px", color: "#5C6E6A" }}>
                      Mandatory baseline prerequisite for Chancenkarte issuance (§ 20a AufenthG)
                    </div>
                  </div>
                  {renderYesNoButtons(form.hasFinancialProofSperrkonto, (v) =>
                    updateForm({ hasFinancialProofSperrkonto: v })
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: § 20b AufenthG Points Factors */}
            <section
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "26px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  2. § 20b AufenthG Points Factors (Experience, Languages, Age &amp; Ties)
                </h2>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0D6866" }}>
                  {result.breakdown.workExperience +
                    result.breakdown.germanLanguage +
                    result.breakdown.englishLanguage +
                    result.breakdown.age +
                    result.breakdown.priorGermanStay +
                    result.breakdown.partnerBonus}{" "}
                  pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="de-work" style={labelStyle}>
                    Post-Qualification Professional Work Experience
                  </label>
                  <select
                    id="de-work"
                    value={form.workExperience}
                    onChange={(e) =>
                      updateForm({ workExperience: e.target.value as DeWorkExperienceBand })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select professional work experience... (0 pts)</option>
                    <option value="under_2yr">Less than 2 years in the last 5 years (0 pts)</option>
                    <option value="2_to_4yr_in_5">At least 2 years within the last 5 years (+2 pts)</option>
                    <option value="5yr_plus_in_7">At least 5 years within the last 7 years (+3 pts)</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                  <div>
                    <label htmlFor="de-german" style={labelStyle}>
                      German Language Proficiency (Goethe / Telc / TestDaF)
                    </label>
                    <select
                      id="de-german"
                      value={form.germanLevel}
                      onChange={(e) => updateForm({ germanLevel: e.target.value as DeGermanLevel })}
                      style={selectStyle}
                    >
                      <option value="">Select German CEFR level... (0 pts)</option>
                      <option value="none">No German Certificate (Requires English B2+ floor)</option>
                      <option value="a1">German CEFR A1 — Satisfies Language Baseline (0 bonus pts)</option>
                      <option value="a2">German CEFR A2 (+1 pt)</option>
                      <option value="b1">German CEFR B1 (+2 pts &amp; 21-Mo Blue Card PR)</option>
                      <option value="b2_or_higher">German CEFR B2 or C1/C2 (+3 pts &amp; 21-Mo PR)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="de-english" style={labelStyle}>
                      English Language Proficiency (CEFR)
                    </label>
                    <select
                      id="de-english"
                      value={form.englishLevel}
                      onChange={(e) =>
                        updateForm({ englishLevel: e.target.value as DeEnglishLevel })
                      }
                      style={selectStyle}
                    >
                      <option value="">Select English CEFR level... (0 pts)</option>
                      <option value="below_b2">Below CEFR B2 (Requires German A1+ floor)</option>
                      <option value="b2">English CEFR B2 — Satisfies Language Baseline (0 bonus pts)</option>
                      <option value="c1_or_higher">English CEFR C1 / C2 or Native Speaker (+1 pt)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="de-age" style={labelStyle}>
                    Applicant Age at Application
                  </label>
                  <select
                    id="de-age"
                    value={form.ageBand}
                    onChange={(e) => updateForm({ ageBand: e.target.value as DeAgeBand })}
                    style={selectStyle}
                  >
                    <option value="">Select age bracket... (0 pts)</option>
                    <option value="35_or_under">35 years or younger (+2 pts)</option>
                    <option value="36_to_40">36 to 40 years old (+1 pt)</option>
                    <option value="41_plus">41 years or older (0 pts)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 650, color: "#063C3D" }}>
                      Previous Continuous Legal Stay in Germany (≥ 6 Months in Last 5 Years)
                    </div>
                    <div style={{ fontSize: "12px", color: "#5C6E6A" }}>
                      Study, language, or work residence (Schengen tourist visits excluded; +1 pt)
                    </div>
                  </div>
                  {renderYesNoButtons(form.hasPrior6MonthLegalStayInGermany, (v) =>
                    updateForm({ hasPrior6MonthLegalStayInGermany: v })
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 650, color: "#063C3D" }}>
                      Spouse / Registered Partner Also Meets Chancenkarte Criteria &amp; Applies Together
                    </div>
                    <div style={{ fontSize: "12px", color: "#5C6E6A" }}>
                      Joint Opportunity Card partner bonus (+1 pt)
                    </div>
                  </div>
                  {renderYesNoButtons(form.partnerQualifiesAndAppliesTogether, (v) =>
                    updateForm({ partnerQualifiesAndAppliesTogether: v })
                  )}
                </div>
              </div>
            </section>

            {/* Section 3: 2026 EU Blue Card & Fast-Track Permanent Settlement */}
            <section
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "26px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  3. 2026 EU Blue Card &amp; Fast-Track Permanent Settlement (<em>Niederlassungserlaubnis</em>)
                </h2>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866" }}>
                  Optional Direct PR Route
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                  <div>
                    <label htmlFor="de-bluecard-salary" style={labelStyle}>
                      German Gross Annual Salary Offer (€ EUR / yr)
                    </label>
                    <input
                      id="de-bluecard-salary"
                      type="number"
                      min={0}
                      step={500}
                      placeholder="e.g. 54000 (optional)"
                      value={form.germanJobOfferGrossEur ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateForm({
                          germanJobOfferGrossEur: raw === "" ? null : Math.max(0, Number(raw)),
                        });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <span style={labelStyle}>
                      Graduated Within Last 3 Years OR IT Specialist (3+ Yrs Exp)?
                    </span>
                    {renderYesNoButtons(
                      form.graduatedWithinLast3YearsOrItSpecialist,
                      (v) => updateForm({ graduatedWithinLast3YearsOrItSpecialist: v }),
                      "Yes (€45,934.20 Floor)",
                      "No (Standard)"
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    fontSize: "12.5px",
                    color: "#334441",
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <span>
                    2026 Applicable EU Blue Card Floor:{" "}
                    <strong style={{ color: "#063C3D" }}>
                      €{result.blueCard.requiredSalaryEur.toLocaleString()}/yr
                    </strong>{" "}
                    ({result.blueCard.usesReducedThreshold ? `Reduced Bottleneck / New Grad` : `Standard €${DE_BLUE_CARD_STANDARD_2026.toLocaleString()}`})
                  </span>
                  <span>
                    PR Timeline:{" "}
                    <strong style={{ color: "#07594F" }}>
                      {result.blueCard.prMonthsTimeline} Months ({result.blueCard.prMonthsTimeline === 21 ? "German B1+" : "German A1"})
                    </strong>
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Right 5 Columns: Sticky Germany Score Card */}
          <aside
            style={{
              gridColumn: "span 5",
              position: "sticky",
              top: "88px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
            className="de-col-full"
          >
            <div
              style={{
                background: "#FFFFFF",
                border: "1.5px solid #063C3D",
                borderRadius: "14px",
                padding: "26px",
                boxShadow: "0 10px 28px rgba(6, 60, 61, 0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 750, color: "#0D6866", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Chancenkarte (§ 20b AufenthG)
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: result.chancenkarteEligible ? "#E6F5EE" : "#F2F5F4",
                    color: result.chancenkarteEligible ? "#07634C" : "#445451",
                  }}
                >
                  {result.qualifiesViaDirectFachkraftWaiver
                    ? "✓ Direct Fachkraft"
                    : result.chancenkarteEligible
                      ? "✓ Eligible (≥ 6 pts)"
                      : `Pass Mark: ${result.passMark} pts`}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "6px 0 10px 0" }}>
                <span
                  data-testid="de-grand-total"
                  style={{
                    fontFamily: "var(--font-display, Georgia, serif)",
                    fontSize: "56px",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: "#063C3D",
                  }}
                >
                  {result.totalPoints}
                </span>
                <span style={{ fontSize: "16px", color: "#5C6E6A", fontWeight: 600 }}>
                  / {result.passMark} pts required
                </span>
              </div>

              {/* Animated 6-Point Chancenkarte Progress Meter */}
              <div style={{ marginBottom: "14px" }}>
                <div
                  style={{
                    height: "7px",
                    borderRadius: "999px",
                    background: "#E7EFEB",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${
                        result.qualifiesViaDirectFachkraftWaiver
                          ? 100
                          : Math.min(100, Math.round((result.totalPoints / 6) * 100))
                      }%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: result.chancenkarteEligible ? "#169B77" : "#0D6866",
                      transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </div>
              </div>

              {!result.hasAnyInput ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    fontSize: "13px",
                    color: "#445451",
                    lineHeight: 1.5,
                    marginBottom: "16px",
                  }}
                >
                  Starts strictly at <strong>0 points</strong>. Select your qualification recognition,
                  experience, German/English CEFR levels, and optional German job offer to evaluate both
                  Chancenkarte and 21/27-month EU Blue Card PR.
                </div>
              ) : result.chancenkarteEligible ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    fontSize: "13px",
                    color: "#07594F",
                    lineHeight: 1.5,
                    marginBottom: "16px",
                  }}
                >
                  {result.qualifiesViaDirectFachkraftWaiver ? (
                    <>
                      You qualify via <strong>Direct <em>Fachkraft</em> Full Equivalence</strong> (6-point
                      test waived) with verified financial self-sufficiency.
                    </>
                  ) : (
                    <>
                      You meet both the <strong>6-point threshold ({result.totalPoints} pts)</strong> and
                      all mandatory Chancenkarte baseline prerequisites.
                    </>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#FEF7EA",
                    border: "1px solid #F1D7A8",
                    fontSize: "13px",
                    color: "#7A4F0D",
                    lineHeight: 1.5,
                    marginBottom: "16px",
                  }}
                >
                  {!result.qualifiesViaDirectFachkraftWaiver && result.totalPoints < 6 && (
                    <div>
                      Need <strong>{6 - result.totalPoints} more Chancenkarte point(s)</strong> (or Full
                      German Equivalence).
                    </div>
                  )}
                  {!result.meetsBaselinePrerequisites && (
                    <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      {result.prerequisiteGaps.map((gap, i) => (
                        <div key={i} style={{ fontSize: "12px" }}>
                          • {gap}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EU Blue Card Status Pill */}
              {result.blueCard.hasSalaryInput && (
                <div
                  data-testid="de-bluecard-banner"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: result.blueCard.eligibleForBlueCard ? "#EAF6F0" : "#F4F8F6",
                    border: result.blueCard.eligibleForBlueCard
                      ? "1px solid #B9DED4"
                      : "1px solid #DCE5E1",
                    fontSize: "12.5px",
                    color: result.blueCard.eligibleForBlueCard ? "#07594F" : "#445451",
                    lineHeight: 1.5,
                    marginBottom: "16px",
                  }}
                >
                  {result.blueCard.eligibleForBlueCard ? (
                    <>
                      <strong>✓ 2026 EU Blue Card Eligible:</strong> Qualifies for fast-track Permanent
                      Settlement (<em>Niederlassungserlaubnis</em>) in{" "}
                      <strong>{result.blueCard.prMonthsTimeline} months</strong>!
                    </>
                  ) : (
                    <>
                      <strong>EU Blue Card Check:</strong>{" "}
                      {result.blueCard.needsFullRecognitionForRegulatedRole ? (
                        <>
                          Salary meets the <strong>€{result.blueCard.requiredSalaryEur.toLocaleString()}/yr</strong>{" "}
                          2026 Blue Card floor, so once your <em>Defizitbescheid</em> adaptation or regulated license
                          is completed in Germany, you can switch directly to the{" "}
                          <strong>{result.blueCard.prMonthsTimeline}-month EU Blue Card PR track</strong>.
                        </>
                      ) : (
                        <>
                          Requires{" "}
                          <strong>€{result.blueCard.requiredSalaryEur.toLocaleString()}/yr</strong> (
                          {result.blueCard.usesReducedThreshold
                            ? `€${DE_BLUE_CARD_REDUCED_2026.toLocaleString()} reduced bottleneck/new-grad rate`
                            : "standard 2026 threshold"}
                          ) plus a recognized degree or eligible IT track.
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              <div
                style={{
                  borderTop: "1px solid #DCE5E1",
                  paddingTop: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                  fontSize: "13px",
                  color: "#445451",
                }}
              >
                {[
                  ["Partial Equivalence (Defizitbescheid)", `${result.breakdown.partialRecognition} / 4`],
                  ["Shortage Occupation (Mangelberuf)", `${result.breakdown.shortageOccupation} / 1`],
                  ["Professional Experience", `${result.breakdown.workExperience} / 3`],
                  ["German Language (A2–B2+)", `${result.breakdown.germanLanguage} / 3`],
                  ["English Language (C1+)", `${result.breakdown.englishLanguage} / 1`],
                  ["Age (≤35 / 36–40)", `${result.breakdown.age} / 2`],
                  [
                    "Prior Stay + Partner Bonus",
                    `${result.breakdown.priorGermanStay + result.breakdown.partnerBonus} / 2`,
                  ],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{lbl}</span>
                    <strong style={{ color: "#063C3D" }}>{val}</strong>
                  </div>
                ))}
              </div>

              <div
                className="de-no-print"
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
                  onClick={() => {
                    const blob = new Blob([buildPlainTextSummary()], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Documento_Germany_Chancenkarte_${result.totalPoints}pts.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 2000);
                  }}
                  style={{
                    flex: "1 1 130px",
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
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildPlainTextSummary());
                      setCopiedSummary(true);
                      setTimeout(() => setCopiedSummary(false), 2500);
                    } catch {
                      // ignore
                    }
                  }}
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
                  onClick={async () => {
                    if (typeof window === "undefined") return;
                    try {
                      const encoded = btoa(encodeURIComponent(JSON.stringify(form)));
                      await navigator.clipboard.writeText(
                        `${window.location.origin}${window.location.pathname}?de=${encodeURIComponent(encoded)}`
                      );
                      setCopiedShareLink(true);
                      setTimeout(() => setCopiedShareLink(false), 2500);
                    } catch {
                      // ignore
                    }
                  }}
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
            </div>

            {tips.length > 0 && (
              <div className="de-no-print" style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "12px", padding: "22px" }}>
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", margin: "0 0 12px 0" }}>
                  Fastest Ways to Reach 6 Points &amp; 21-Month PR
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {tips.map((tip) => (
                    <div key={tip.id} style={{ padding: "12px", borderRadius: "8px", background: "#F4F8F6", border: "1px solid #DCE5E1" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>{tip.title}</span>
                        <span style={{ fontSize: "12px", fontWeight: 750, color: "#07594F", whiteSpace: "nowrap" }}>
                          +{tip.pointsGain} pts → {tip.projectedTotal}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "12.5px", color: "#445451", lineHeight: 1.5 }}>
                        {tip.actionSummary}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviousBeforePreview((prev) => prev ?? form);
                          setForm(tip.previewInput);
                        }}
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
          </aside>
        </div>
      </main>

      <style>{`
        @media (max-width: 1024px) {
          .de-col-full {
            grid-column: span 12 !important;
            position: static !important;
          }
        }
        @media print {
          .de-no-print { display: none !important; }
          .de-col-full { grid-column: span 12 !important; position: static !important; }
        }
      `}</style>
    </div>
  );
}

