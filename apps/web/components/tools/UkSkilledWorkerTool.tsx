"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CobrandedAgencyLeadWidget } from "../agency/CobrandedAgencyLeadWidget";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CountryCalculatorHeroCard } from "./CountryVisualIdentity";
import {
  calculateUkSkilledWorker,
  DEFAULT_UK_INPUT,
  generateUkTips,
  UK_HOURLY_FLOOR_STANDARD_2026,
  UkContinuousResidenceYears,
  UkSkilledWorkerInput,
  UkTradeableCategory,
} from "../../lib/global-calculators/uk";

export function UkSkilledWorkerTool() {
  const [form, setForm] = useState<UkSkilledWorkerInput>(DEFAULT_UK_INPUT);
  const [previousBeforePreview, setPreviousBeforePreview] =
    useState<UkSkilledWorkerInput | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("uk");
      if (encoded) {
        const parsed = JSON.parse(decodeURIComponent(atob(encoded))) as Partial<UkSkilledWorkerInput>;
        if (parsed && typeof parsed === "object") {
          setForm({ ...DEFAULT_UK_INPUT, ...parsed });
        }
      }
    } catch {
      // ignore malformed query param
    }
  }, []);

  const result = useMemo(() => calculateUkSkilledWorker(form), [form]);
  const tips = useMemo(() => generateUkTips(form, result), [form, result]);

  const updateForm = (patch: Partial<UkSkilledWorkerInput>) => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const resetToZero = () => {
    setPreviousBeforePreview(null);
    setForm(DEFAULT_UK_INPUT);
  };

  const buildPlainTextSummary = (): string => {
    return [
      "======================================================================",
      "THE DOCUMENTO — UK SKILLED WORKER (70-PT) & 5-YEAR ILR ASSESSMENT",
      "Statutory Basis: UK Home Office Appendix Skilled Worker & Settlement",
      "======================================================================",
      "",
      `TOTAL POINTS: ${result.totalPoints} / ${result.passMark} pts`,
      `Skilled Worker Visa Status: ${
        result.visaEligible ? "MEETS 70-POINT REQUIREMENT" : "BELOW 70-POINT REQUIREMENT"
      }`,
      `Required Visa Salary Floor: £${result.requiredVisaSalaryGbp.toLocaleString()}/yr`,
      `5-Year ILR Settlement Salary Floor: £${result.requiredIlrSalaryGbp.toLocaleString()}/yr`,
      `ILR Settlement Readiness: ${
        result.ilrReadyNow ? "ELIGIBLE FOR 5-YEAR ILR SETTLEMENT NOW" : "IN PROGRESS / NOT YET MET"
      }`,
      "----------------------------------------------------------------------",
      `Certificate of Sponsorship (CoS):        ${result.breakdown.sponsorshipCos} / 20`,
      `Eligible RQF 6+ / ISL Skill Level:       ${result.breakdown.skillLevel} / 20`,
      `English Language Proficiency (CEFR B2):  ${result.breakdown.englishLanguage} / 10`,
      `Mandatory Non-Tradeable Subtotal:        ${result.breakdown.mandatorySubtotal} / 50`,
      `Tradeable Salary & Qualification Points: ${result.breakdown.tradeablePoints} / 20`,
      "----------------------------------------------------------------------",
      "Generated via The Documento (thedocumento.com/calculators/uk-skilled-worker)",
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
          padding: "9px 18px",
          borderRadius: "8px",
          border: value === true ? "1.5px solid #063C3D" : "1px solid #BDCDC7",
          background: value === true ? "#063C3D" : "#FFFFFF",
          color: value === true ? "#FFFFFF" : "#172322",
          fontSize: "13.5px",
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
          padding: "9px 18px",
          borderRadius: "8px",
          border: value === false ? "1.5px solid #063C3D" : "1px solid #BDCDC7",
          background: value === false ? "#063C3D" : "#FFFFFF",
          color: value === false ? "#FFFFFF" : "#172322",
          fontSize: "13.5px",
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
        className="uk-no-print"
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
              UK Skilled Worker &amp; 5-Year ILR Calculator
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
      <CalculatorCountrySwitchBar activeCalculatorId="uk_skilled_ilr" />

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
          <div style={{ gridColumn: "span 8" }} className="uk-col-full">
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
              UK Home Office • Appendix Skilled Worker (70-Point Grid) &amp; 5-Year ILR
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
              United Kingdom 70-Point Skilled Worker &amp; ILR Calculator
            </h1>
            <p style={{ fontSize: "15.5px", lineHeight: 1.55, color: "#445451", margin: 0, maxWidth: "74ch" }}>
              Score your <strong>50 Mandatory Points</strong> (licensed CoS, RQF Level 6+ skill level, and
              CEFR B2 English) plus <strong>20 Tradeable Salary &amp; Qualification Points</strong> (Options
              A–E from <code>£41,700</code> standard down to <code>£33,400</code> New Entrant / STEM PhD /
              ISL or <code>£25,000</code> Health &amp; Care), and verify 5-year Indefinite Leave to Remain
              (ILR) settlement salary compliance.
            </p>
          </div>

          <div style={{ gridColumn: "span 4" }} className="uk-col-full">
            <CountryCalculatorHeroCard
              countryId="united_kingdom"
              authorityLabel="2026 Home Office Thresholds"
              headlineMetric="70 Points Total • £41,700 Standard Floor"
              subMetric="50 Mandatory + 20 Tradeable • 5-Yr ILR Audit"
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
          <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "22px" }} className="uk-col-full">
            {/* Section 1: 50 Mandatory Non-Tradeable Points */}
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
                  1. Mandatory Non-Tradeable Criteria (50 Points Required)
                </h2>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0D6866" }}>
                  {result.breakdown.mandatorySubtotal} / 50 pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#F8F7F2", border: "1px solid #DCE5E1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                      Valid Certificate of Sponsorship (CoS) from Home Office Licensed Sponsor
                    </span>
                    <span style={{ fontSize: "12.5px", fontWeight: 750, color: "#07594F" }}>20 pts</span>
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12.5px", color: "#5C6E6A" }}>
                    Genuine vacancy offered by an A-rated organization on the Register of Worker &amp; Temporary Worker Licensed Sponsors.
                  </p>
                  {renderYesNoButtons(
                    form.hasValidCosFromLicensedSponsor,
                    (v) => updateForm({ hasValidCosFromLicensedSponsor: v }),
                    "Yes — Licensed Sponsor CoS (+20)",
                    "No CoS Yet (0)"
                  )}
                </div>

                <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#F8F7F2", border: "1px solid #DCE5E1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                      Job at Appropriate Skill Level (RQF Level 6+ Graduate Role or Eligible ISL / Care SOC)
                    </span>
                    <span style={{ fontSize: "12.5px", fontWeight: 750, color: "#07594F" }}>20 pts</span>
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12.5px", color: "#5C6E6A" }}>
                    Under 2025/2026 Immigration Rules reforms, newly sponsored standard Skilled Worker occupations require RQF Level 6+ unless listed on the Immigration Salary List / Temporary Shortage List.
                  </p>
                  {renderYesNoButtons(
                    form.meetsEligibleRqfSkillLevel,
                    (v) => updateForm({ meetsEligibleRqfSkillLevel: v }),
                    "Yes — Eligible SOC Skill Level (+20)",
                    "No / Below Eligible RQF (0)"
                  )}
                </div>

                <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#F8F7F2", border: "1px solid #DCE5E1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                      English Language Proficiency (CEFR Level B2 Approved SELT / Degree Taught in English)
                    </span>
                    <span style={{ fontSize: "12.5px", fontWeight: 750, color: "#07594F" }}>10 pts</span>
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12.5px", color: "#5C6E6A" }}>
                    Verified across Reading, Writing, Speaking, and Listening via UKVI SELT, Ecctis-verified English-taught degree, or majority-English nationality (CEFR B2 for initial 2026 grants; B1 transitional extensions).
                  </p>
                  {renderYesNoButtons(
                    form.meetsEnglishCefrRequirement,
                    (v) => updateForm({ meetsEnglishCefrRequirement: v }),
                    "Yes — Meets English Requirement (+10)",
                    "Not Yet Verified (0)"
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: 20 Tradeable Salary & Qualification Points */}
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
                  2. Tradeable Salary &amp; Qualification Option (20 Points Required)
                </h2>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0D6866" }}>
                  {result.breakdown.tradeablePoints} / 20 pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="uk-tradeable-option" style={labelStyle}>
                    Appendix Skilled Worker Tradeable Points Option (Options A–E &amp; Health/Care)
                  </label>
                  <select
                    id="uk-tradeable-option"
                    value={form.tradeableCategory}
                    onChange={(e) => updateForm({ tradeableCategory: e.target.value as UkTradeableCategory })}
                    style={selectStyle}
                  >
                    <option value="">Select tradeable salary option... (0 pts)</option>
                    <option value="option_a_standard">
                      Option A — Standard Rate: ≥ £41,700/yr AND 100% of SOC Going Rate (20 pts)
                    </option>
                    <option value="option_b_phd_general">
                      Option B — Relevant Non-STEM PhD: ≥ £37,500/yr AND 90% of Going Rate (20 pts)
                    </option>
                    <option value="option_c_phd_stem">
                      Option C — Relevant STEM PhD: ≥ £33,400/yr AND 80% of Going Rate (20 pts)
                    </option>
                    <option value="option_d_immigration_salary_list">
                      Option D — Immigration Salary List (ISL) Role: ≥ £33,400/yr AND 100% Going Rate (20 pts)
                    </option>
                    <option value="option_e_new_entrant">
                      Option E — New Entrant (&lt;26 / UK Graduate Visa Switcher / Postdoc): ≥ £33,400/yr AND 70% Going Rate (20 pts)
                    </option>
                    <option value="health_and_care_scale">
                      Health &amp; Care / National Pay Scale Occupation: ≥ £25,000/yr or National Pay Band (20 pts)
                    </option>
                    <option value="transitional_pre_apr_2024">
                      Option F — Pre-4 April 2024 Continuous Skilled Worker Transitional Floor: ≥ £31,300/yr (20 pts)
                    </option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: "14px" }}>
                  <div>
                    <label htmlFor="uk-annual-salary" style={labelStyle}>
                      Guaranteed Annual Gross Base Salary (£ GBP / yr)
                    </label>
                    <input
                      id="uk-annual-salary"
                      type="number"
                      min={0}
                      step={500}
                      placeholder="e.g. 45000 (starts blank)"
                      value={form.annualSalaryGbp ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateForm({
                          annualSalaryGbp: raw === "" ? null : Math.max(0, Number(raw)),
                        });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label htmlFor="uk-going-rate" style={labelStyle}>
                      SOC 2020 Going Rate (£/yr @ 37.5h)
                    </label>
                    <input
                      id="uk-going-rate"
                      type="number"
                      min={0}
                      step={500}
                      placeholder="Default £41,700 if blank"
                      value={form.occupationGoingRateGbp ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateForm({
                          occupationGoingRateGbp: raw === "" ? null : Math.max(0, Number(raw)),
                        });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label htmlFor="uk-weekly-hours" style={labelStyle}>
                      Contracted Weekly Hours (hr/wk)
                    </label>
                    <input
                      id="uk-weekly-hours"
                      type="number"
                      min={1}
                      max={70}
                      step={0.5}
                      placeholder="Default 37.5 hr/wk"
                      value={form.weeklyContractHours ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateForm({
                          weeklyContractHours: raw === "" ? null : Math.max(1, Number(raw)),
                        });
                      }}
                      style={inputStyle}
                    />
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
                    Minimum Required Visa Salary Floor:{" "}
                    <strong style={{ color: "#063C3D" }}>
                      £{result.requiredVisaSalaryGbp.toLocaleString()}/yr
                    </strong>
                    {form.tradeableCategory !== "" &&
                      form.tradeableCategory !== "health_and_care_scale" &&
                      form.tradeableCategory !== "transitional_pre_apr_2024" && (
                        <span style={{ color: "#5C6E6A" }}>
                          {" "}
                          (≥ £{UK_HOURLY_FLOOR_STANDARD_2026}/hr
                          {result.effectiveHourlyRateGbp !== null
                            ? ` • Yours: £${result.effectiveHourlyRateGbp.toFixed(2)}/hr`
                            : ""}
                          )
                        </span>
                      )}
                  </span>
                  <span>
                    5-Year ILR Settlement Floor:{" "}
                    <strong style={{ color: "#063C3D" }}>
                      £{result.requiredIlrSalaryGbp.toLocaleString()}/yr
                    </strong>
                  </span>
                </div>
              </div>
            </section>

            {/* Section 3: 5-Year Indefinite Leave to Remain (ILR / Permanent Settlement) */}
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
                  3. 5-Year Indefinite Leave to Remain (ILR / Settlement) Diagnostic
                </h2>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#5C6E6A" }}>
                  UK Permanent Residence Audit
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label htmlFor="uk-residence-years" style={labelStyle}>
                    Qualifying Continuous Lawful UK Residence (Skilled Worker / Global Talent / Tier 2)
                  </label>
                  <select
                    id="uk-residence-years"
                    value={form.ukResidenceYears}
                    onChange={(e) =>
                      updateForm({ ukResidenceYears: e.target.value as UkContinuousResidenceYears })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select continuous UK residence duration...</option>
                    <option value="0_to_2yr">0 – 2 Years (Initial Visa / Planning Ahead)</option>
                    <option value="3_to_4yr">3 – 4 Years (Extension Stage — Prepare for ILR Salary Floor)</option>
                    <option value="5yr_plus">5+ Continuous Years Completed (Qualifying Settlement Window)</option>
                  </select>
                </div>

                <div>
                  <span style={labelStyle}>
                    Passed Life in the UK Test &amp; Rolling 12-Month Absences ≤ 180 Days?
                  </span>
                  {renderYesNoButtons(
                    form.passedLifeInUkAndAbsencesUnder180,
                    (v) => updateForm({ passedLifeInUkAndAbsencesUnder180: v }),
                    "Yes — Life in UK + ≤180d Absence Met",
                    "Not Yet Completed"
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right 5 Columns: Sticky UK Score Card */}
          <aside
            style={{
              gridColumn: "span 5",
              position: "sticky",
              top: "88px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
            className="uk-col-full"
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
                  UK Points-Based System Score
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: result.visaEligible ? "#E6F5EE" : "#F2F5F4",
                    color: result.visaEligible ? "#07634C" : "#445451",
                  }}
                >
                  {result.visaEligible ? "✓ 70/70 Visa Eligible" : `Pass Mark: ${result.passMark} pts`}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "6px 0 10px 0" }}>
                <span
                  data-testid="uk-grand-total"
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
                  / {result.passMark} pts
                </span>
              </div>

              {/* Animated 70-Point Progress Meter */}
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
                      width: `${Math.min(100, Math.round((result.totalPoints / 70) * 100))}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: result.visaEligible ? "#169B77" : "#0D6866",
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
                  Starts strictly at <strong>0 points</strong>. Confirm your 3 mandatory requirements
                  and enter your UK salary offer to test Skilled Worker &amp; 5-year ILR eligibility.
                </div>
              ) : result.visaEligible ? (
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
                  You satisfy all <strong>70 points</strong> (50 Mandatory + 20 Tradeable) for a UK
                  Skilled Worker visa.
                  {result.ilrReadyNow && (
                    <div style={{ marginTop: "6px", fontWeight: 700 }}>
                      ✓ You also satisfy the 5-Year Indefinite Leave to Remain (ILR) settlement requirements!
                    </div>
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
                  You need <strong>{Math.max(0, 70 - result.totalPoints)} more points</strong> to reach
                  70. Every mandatory criterion (50 pts) plus 20 tradeable salary points must be met.
                </div>
              )}

              {result.ilrSalaryWarning && (
                <div
                  data-testid="uk-ilr-warning"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#FEF7EA",
                    border: "1px solid #F1D7A8",
                    fontSize: "12.5px",
                    color: "#7A4F0D",
                    lineHeight: 1.5,
                    marginBottom: "16px",
                  }}
                >
                  {result.ilrSalaryWarning}
                </div>
              )}

              <div
                style={{
                  borderTop: "1px solid #DCE5E1",
                  paddingTop: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#445451",
                }}
              >
                {[
                  ["Licensed Sponsor CoS", `${result.breakdown.sponsorshipCos} / 20`],
                  ["RQF 6+ / Eligible Skill Level", `${result.breakdown.skillLevel} / 20`],
                  ["English Language (CEFR B2)", `${result.breakdown.englishLanguage} / 10`],
                  ["Tradeable Salary & PhD/ISL/NE", `${result.breakdown.tradeablePoints} / 20`],
                  [
                    "5-Year ILR Settlement Status",
                    result.ilrReadyNow ? "Ready Now ✓" : `£${result.requiredIlrSalaryGbp.toLocaleString()} @ Yr 5`,
                  ],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{lbl}</span>
                    <strong style={{ color: "#063C3D" }}>{val}</strong>
                  </div>
                ))}
              </div>

              <div
                className="uk-no-print"
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
                    a.download = `Documento_UK_Skilled_Worker_${result.totalPoints}pts.txt`;
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
                        `${window.location.origin}${window.location.pathname}?uk=${encodeURIComponent(encoded)}`
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

              <CobrandedAgencyLeadWidget
                calculatorId="uk-skilled-worker"
                calculatorTitle="UK 70-Point Skilled Worker & ILR"
                countryCode="UK"
                liveScoreSummary={`${result.totalPoints} / 70 pts (${result.visaEligible ? "Visa Eligible" : "Below 70 Pts"}${result.ilrReadyNow ? " • ILR Ready" : ""})`}
                hasCalculatedScore={result.totalPoints > 0}
                scorePayload={{
                  totalPoints: result.totalPoints,
                  visaEligible: result.visaEligible,
                  ilrReady: result.ilrReadyNow,
                }}
              />
            </div>

            {tips.length > 0 && (
              <div className="uk-no-print" style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "12px", padding: "22px" }}>
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", margin: "0 0 12px 0" }}>
                  Fastest Ways to Unlock 70 Points
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
          .uk-col-full {
            grid-column: span 12 !important;
            position: static !important;
          }
        }
        @media print {
          .uk-no-print { display: none !important; }
          .uk-col-full { grid-column: span 12 !important; position: static !important; }
        }
      `}</style>
    </div>
  );
}

