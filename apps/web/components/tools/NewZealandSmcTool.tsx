"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CountryCalculatorHeroCard } from "./CountryVisualIdentity";
import {
  calculateNzSmc,
  DEFAULT_NZ_INPUT,
  generateNzTips,
  NZ_SMC_MEDIAN_WAGE_2026,
  NzAgeStatus,
  NzOccupationalRegistrationTier,
  NzQualificationTier,
  NzSkilledWorkYearsInNz,
  NzSmcInput,
  NzTotalRelevantWorkYears,
} from "../../lib/global-calculators/newZealand";

export function NewZealandSmcTool() {
  const [form, setForm] = useState<NzSmcInput>(DEFAULT_NZ_INPUT);
  const [previousBeforePreview, setPreviousBeforePreview] = useState<NzSmcInput | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const encoded = new URLSearchParams(window.location.search).get("nz");
      if (encoded) {
        const parsed = JSON.parse(decodeURIComponent(atob(encoded))) as Partial<NzSmcInput>;
        if (parsed && typeof parsed === "object") {
          setForm({ ...DEFAULT_NZ_INPUT, ...parsed });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const result = useMemo(() => calculateNzSmc(form), [form]);
  const tips = useMemo(() => generateNzTips(form, result), [form, result]);

  const updateForm = (patch: Partial<NzSmcInput>) => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const resetToZero = () => {
    setPreviousBeforePreview(null);
    setForm(DEFAULT_NZ_INPUT);
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

  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #DCE5E1",
    borderRadius: "12px",
    padding: "28px",
  };

  const renderYesNo = (val: boolean | null, onChange: (next: boolean) => void) => (
    <div style={{ display: "flex", gap: "10px" }}>
      {[
        { label: "Yes", value: true },
        { label: "No", value: false },
      ].map((c) => {
        const active = val === c.value;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(c.value)}
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
            {c.label}
          </button>
        );
      })}
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
        className="nz-no-print"
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
              New Zealand SMC Resident Calculator
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
      <CalculatorCountrySwitchBar activeCalculatorId="nz_smc" />

      <main style={{ maxWidth: "1320px", margin: "0 auto", padding: "36px 24px 96px 24px" }}>
        <section
          style={{
            marginBottom: "26px",
            paddingBottom: "22px",
            borderBottom: "1px solid #DCE5E1",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "24px",
            alignItems: "end",
          }}
        >
          <div className="nz-col-full" style={{ gridColumn: "span 8" }}>
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
              New Zealand Skilled Migrant Category (SMC) Calculator
            </h1>
            <p style={{ fontSize: "15.5px", color: "#445451", lineHeight: 1.55, margin: 0, maxWidth: "780px" }}>
              Implements Immigration New Zealand&apos;s August 24, 2026 SMC framework — evaluating the 6-Point Residence Grid (with overseas vs. NZ degree differentiation and NZD ${NZ_SMC_MEDIAN_WAGE_2026.toFixed(2)}/hr median wage multipliers) alongside the two new Experience and Trades residence pathways.
            </p>
          </div>

          <div className="nz-col-full" style={{ gridColumn: "span 4" }}>
            <CountryCalculatorHeroCard
              countryId="new_zealand"
              authorityLabel="Immigration New Zealand Standard"
              headlineMetric="Aug 24, 2026 Rules • 6-Pt Pass Mark (NZD $35/hr)"
              subMetric="6-Point Grid + Experience & Trades Pathways"
            />
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "28px", alignItems: "start" }}>
          <div className="nz-col-full" style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* 1. Mandatory Baseline Prerequisites */}
            <section style={cardStyle} aria-labelledby="nz-sec-prereq">
              <h2 id="nz-sec-prereq" style={{ fontSize: "19px", fontWeight: 700, color: "#063C3D", margin: "0 0 18px 0" }}>
                Mandatory SMC Baseline Prerequisites
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="nz-age" style={labelStyle}>
                    <span>Age on date of residence application</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Must be ≤ 55 years</span>
                  </label>
                  <select
                    id="nz-age"
                    value={form.ageStatus}
                    onChange={(e) => updateForm({ ageStatus: e.target.value as NzAgeStatus })}
                    style={selectStyle}
                  >
                    <option value="">Select age eligibility...</option>
                    <option value="under_56_eligible">55 years of age or younger (Eligible)</option>
                    <option value="56_or_older_ineligible">56 years of age or older (Ineligible for SMC)</option>
                  </select>
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>Do you meet the English language requirement (IELTS 6.5+ overall / PTE 58+ / eligible degree or citizenship)?</span>
                  </div>
                  {renderYesNo(form.hasEnglishIelts65OrEquivalent, (v) =>
                    updateForm({ hasEnglishIelts65OrEquivalent: v })
                  )}
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>Do you hold current full-time skilled employment (or job offer) with an INZ-Accredited New Zealand Employer?</span>
                  </div>
                  {renderYesNo(form.hasAccreditedNzJobOrOffer, (v) =>
                    updateForm({ hasAccreditedNzJobOrOffer: v })
                  )}
                </div>

                <div>
                  <label htmlFor="nz-anzsco" style={labelStyle}>
                    <span>ANZSCO / NOL Skill Level of your New Zealand role</span>
                  </label>
                  <select
                    id="nz-anzsco"
                    value={form.anzscoSkillTier}
                    onChange={(e) =>
                      updateForm({
                        anzscoSkillTier: e.target.value as NzSmcInput["anzscoSkillTier"],
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select occupation skill tier...</option>
                    <option value="anzsco_1_to_3">ANZSCO Skill Level 1, 2, or 3 Standard (≥ NZD $35.00/hr; 1.1× = $38.50/hr on Work Pathway)</option>
                    <option value="anzsco_1_to_3_amber">ANZSCO Skill Level 1–3 Amber List Role (≥ NZD $35.00/hr; 5 yrs NZ @ 1.2× = $42.00/hr on Work Pathway)</option>
                    <option value="anzsco_1_to_3_red">ANZSCO Skill Level 1–3 Red List Role (≥ NZD $35.00/hr • Excluded from Experience/Trades — 6-Pt Route Only)</option>
                    <option value="anzsco_4_to_5">ANZSCO Skill Level 4 or 5 (Requires ≥ 1.5× median wage = NZD $52.50/hr)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="nz-wage" style={labelStyle}>
                    <span>Guaranteed base hourly wage in New Zealand ($ NZD / hour)</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                      {result.breakdown.incomePoints > 0
                        ? `${result.breakdown.incomePoints} Income pts`
                        : "Median = NZD $35.00/hr"}
                    </span>
                  </label>
                  <input
                    id="nz-wage"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Enter NZD hourly rate (e.g. 38.50, 52.50, 70.00, 105.00)..."
                    value={form.nzHourlyWageNzd === null ? "" : form.nzHourlyWageNzd}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      updateForm({ nzHourlyWageNzd: raw === "" ? null : Number(raw) });
                    }}
                    style={{ ...selectStyle, cursor: "text" }}
                  />
                </div>
              </div>
            </section>

            {/* 2. Primary Skill Anchor + NZ Work Top-Up */}
            <section style={cardStyle} aria-labelledby="nz-sec-points">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                <h2 id="nz-sec-points" style={{ fontSize: "19px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  Primary Skill Anchor &amp; NZ Work Experience
                </h2>
                <span style={{ fontSize: "12.5px", fontWeight: 650, color: "#0D6866" }}>
                  Highest Single Anchor Used (Non-Stacking)
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="nz-qual" style={labelStyle}>
                    <span>Highest recognized qualification (Aug 24, 2026 Overseas vs. NZ Points)</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                      {result.breakdown.qualificationPoints} / 6 pts
                    </span>
                  </label>
                  <select
                    id="nz-qual"
                    value={form.qualificationTier}
                    onChange={(e) =>
                      updateForm({ qualificationTier: e.target.value as NzQualificationTier })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select recognized qualification...</option>
                    <option value="none_or_below_level_7">Below Level 4 or unrecognized qualification (0 pts)</option>
                    <option value="level_4_to_6_trade_tech">NZQCF Level 4–6 Certificate / Diploma (0 pts on 6-pt grid; eligible for Trades Pathway)</option>
                    <option value="overseas_bachelor_or_level_8">Overseas Level 7 Bachelor&apos;s OR Overseas Level 8 Honours / PG Diploma w/ Bachelor&apos;s (+4 pts)</option>
                    <option value="nz_bachelor_or_level_8">New Zealand Level 7 Bachelor&apos;s OR NZ Level 8 Honours / PG Diploma w/ Bachelor&apos;s (+5 pts)</option>
                    <option value="overseas_masters_level_9">Overseas Level 9 Master&apos;s Degree w/ supporting Bachelor&apos;s (+5 pts)</option>
                    <option value="nz_masters_no_bachelor_level_9">New Zealand Level 9 Master&apos;s without prior Bachelor&apos;s degree (+5 pts)</option>
                    <option value="nz_masters_30wk_level_9">New Zealand Level 9 Master&apos;s — ≥ 30 wks FT study in NZ + prior Bachelor&apos;s (+6 pts)</option>
                    <option value="phd_level_10_any">Level 10 Doctoral Degree / Ph.D. — NZ or Overseas (+6 pts)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="nz-reg" style={labelStyle}>
                    <span>Eligible New Zealand Occupational Registration (alternative primary anchor)</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                      {result.breakdown.registrationPoints} / 6 pts
                    </span>
                  </label>
                  <select
                    id="nz-reg"
                    value={form.nzRegistrationTier}
                    onChange={(e) =>
                      updateForm({
                        nzRegistrationTier: e.target.value as NzOccupationalRegistrationTier,
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select NZ statutory occupational registration...</option>
                    <option value="none">No eligible NZ statutory registration (0 pts)</option>
                    <option value="2_to_3_years_training">Registration requiring 2–3 years training — e.g. Nurses, Plumbers, Electricians (+3 pts)</option>
                    <option value="4_years_training">Registration requiring 4 years training — e.g. Teachers, Engineers, Pharmacists (+4 pts)</option>
                    <option value="5_years_training">Registration requiring 5 years training — e.g. Dentists, Optometrists (+5 pts)</option>
                    <option value="6_plus_years_training">Registration requiring 6+ years training — e.g. Medical Doctors, Veterinarians (+6 pts)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="nz-work-local" style={labelStyle}>
                    <span>Skilled full-time work experience gained IN New Zealand</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                      +{result.breakdown.nzWorkExperiencePoints} / 3 top-up pts
                    </span>
                  </label>
                  <select
                    id="nz-work-local"
                    value={form.nzSkilledWorkYears}
                    onChange={(e) =>
                      updateForm({ nzSkilledWorkYears: e.target.value as NzSkilledWorkYearsInNz })
                    }
                    style={selectStyle}
                  >
                    <option value="">Select NZ skilled work duration...</option>
                    <option value="none">Less than 12 months in New Zealand (0 pts)</option>
                    <option value="1yr">12 to 17 months in New Zealand (+1 pt)</option>
                    <option value="18_months">18 to 23 months in New Zealand (+1 pt • Meets Trades 18-mo threshold)</option>
                    <option value="2yr">24 to 35 months in New Zealand (+2 pts • Meets Standard 2-yr Work Pathway)</option>
                    <option value="3yr_plus">36 to 59 months (3–4 years) in New Zealand (+3 pts)</option>
                    <option value="5yr_plus">60+ months (5+ years) in New Zealand (+3 pts • Unlocks Amber List Pathway)</option>
                  </select>
                </div>

                {/* Aug 24, 2026 New Pathways Inputs */}
                <div style={{ paddingTop: "14px", borderTop: "1px solid #E7EFEB" }}>
                  <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#063C3D", marginBottom: "12px" }}>
                    Aug 24, 2026 Experience &amp; Trades Pathway Checks
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <label htmlFor="nz-total-work" style={labelStyle}>
                        <span>Total directly relevant work experience (NZ + overseas combined)</span>
                      </label>
                      <select
                        id="nz-total-work"
                        value={form.totalRelevantWorkYears}
                        onChange={(e) =>
                          updateForm({
                            totalRelevantWorkYears: e.target.value as NzTotalRelevantWorkYears,
                          })
                        }
                        style={selectStyle}
                      >
                        <option value="">Select total relevant work history...</option>
                        <option value="under_4yr">Less than 4 years</option>
                        <option value="4yr">4 to less than 5 years (Meets 4-yr Trades threshold)</option>
                        <option value="5yr_plus">5 or more years (Meets 5-yr Skilled Experience threshold)</option>
                      </select>
                    </div>

                    <div>
                      <div style={labelStyle}>
                        <span>Is your NZ occupation on INZ&apos;s Trades &amp; Technician Residence list?</span>
                      </div>
                      {renderYesNo(form.isEligibleTradeOrTechnicianRole, (v) =>
                        updateForm({ isEligibleTradeOrTechnicianRole: v })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Sticky Ledger */}
          <aside
            className="nz-col-full"
            style={{
              gridColumn: "span 5",
              position: "sticky",
              top: "84px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ background: "#FFFFFF", border: "1px solid #BDCDC7", borderRadius: "12px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "14px", fontWeight: 650, color: "#445451" }}>
                  New Zealand SMC Points Score
                </span>
                <span style={{ fontSize: "12px", fontWeight: 650, color: "#07594F", background: "#EAF5EF", padding: "3px 10px", borderRadius: "6px" }}>
                  Pass Mark: 6 / 6
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "8px 0 10px 0" }}>
                <span
                  data-testid="nz-grand-total"
                  style={{
                    fontSize: "56px",
                    fontWeight: 800,
                    color: "#063C3D",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                  }}
                >
                  {result.totalClaimablePoints}
                </span>
                <span style={{ fontSize: "18px", fontWeight: 600, color: "#6E7F7C" }}>/ 6 pts</span>
              </div>

              {/* Animated 6-Point Progress Meter */}
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
                      width: `${Math.min(100, Math.round((result.totalClaimablePoints / 6) * 100))}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: result.eligibleUnderAnySmcRoute ? "#169B77" : "#0D6866",
                      transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </div>
              </div>

              {!result.hasAnyInput ? (
                <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#F4F8F6", border: "1px solid #DCE5E1", fontSize: "13px", color: "#445451" }}>
                  Complete the questionnaire on the left to evaluate your New Zealand SMC score from 0.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {result.prerequisiteWarnings.map((w, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "9px 11px",
                        borderRadius: "8px",
                        background: "#FEF7EA",
                        border: "1px solid #F0D9B5",
                        fontSize: "12.5px",
                        color: "#8A5A10",
                      }}
                    >
                      {w}
                    </div>
                  ))}

                  {[
                    {
                      label: `1. Six-Point SMC Route (${result.totalClaimablePoints}/6 pts)`,
                      ok: result.meetsSixPointRoute,
                    },
                    {
                      label:
                        form.anzscoSkillTier === "anzsco_1_to_3_amber"
                          ? "2. Skilled Work Experience Route (Amber List: 5yr NZ @ 1.2× = $42/hr)"
                          : "2. Skilled Work Experience Route (5yr + 2yr NZ @ 1.1× = $38.50/hr)",
                      ok: result.meetsSkilledWorkExperiencePathway,
                    },
                    {
                      label: "3. Trades & Technician Route (Lvl 4+ + 4yr + 18mo NZ)",
                      ok: result.meetsTradesTechnicianPathway,
                    },
                  ].map((route) => (
                    <div
                      key={route.label}
                      style={{
                        padding: "9px 12px",
                        borderRadius: "8px",
                        background: route.ok ? "#EAF6F0" : "#F4F8F6",
                        border: route.ok ? "1px solid #B9DED4" : "1px solid #DCE5E1",
                        fontSize: "12.5px",
                        fontWeight: 650,
                        color: route.ok ? "#176B50" : "#526663",
                      }}
                    >
                      {route.ok ? "✓ Eligible: " : "— "}
                      {route.label}
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "14px",
                  borderTop: "1px solid #DCE5E1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                  fontSize: "13px",
                  color: "#445451",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Winning Primary Skill Anchor ({result.winningPrimaryCategory})</span>
                  <strong style={{ color: "#063C3D" }}>{result.breakdown.primaryAnchorPoints} / 6</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>NZ Skilled Work Experience Top-Up</span>
                  <strong style={{ color: "#063C3D" }}>{result.breakdown.nzWorkExperiencePoints} / 3</strong>
                </div>
              </div>

              <div className="nz-no-print" style={{ display: "flex", gap: "8px", marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #DCE5E1" }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `New Zealand SMC Score: ${result.totalClaimablePoints} / 6 pts | Eligible under any SMC route: ${result.eligibleUnderAnySmcRoute ? "YES" : "NO"}`
                      );
                      setCopiedSummary(true);
                      setTimeout(() => setCopiedSummary(false), 2500);
                    } catch {
                      // ignore
                    }
                  }}
                  style={{
                    flex: 1,
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
                  {copiedSummary ? "Copied Summary ✓" : "Copy Score Summary"}
                </button>
              </div>
            </div>

            {tips.length > 0 && (
              <div className="nz-no-print" style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "12px", padding: "22px" }}>
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", margin: "0 0 12px 0" }}>
                  Recommended Steps to Reach 6 SMC Points
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {tips.map((tip) => (
                    <div key={tip.id} style={{ padding: "12px", borderRadius: "8px", background: "#F4F8F6", border: "1px solid #DCE5E1" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>{tip.title}</span>
                        <span style={{ fontSize: "12px", fontWeight: 750, color: "#07594F" }}>
                          +{tip.pointsGain} → {tip.projectedTotal}/6
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
          .nz-col-full { grid-column: span 12 !important; position: static !important; }
        }
        @media print {
          .nz-no-print { display: none !important; }
          .nz-col-full { grid-column: span 12 !important; position: static !important; }
        }
      `}</style>
    </div>
  );
}

