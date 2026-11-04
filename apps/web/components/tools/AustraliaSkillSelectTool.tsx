"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { CobrandedAgencyLeadWidget } from "../agency/CobrandedAgencyLeadWidget";
import { CalculatorCountrySwitchBar } from "./CalculatorCountrySwitchBar";
import { CountryCalculatorHeroCard } from "./CountryVisualIdentity";
import {
  AuAgeBand,
  AuEducationTier,
  AuEnglishLevel,
  AuLocalWorkBand,
  AuOverseasWorkBand,
  AuPartnerSkillsTier,
  AuSkillSelectInput,
  AuVisaSubclass,
  calculateAustraliaSkillSelect,
  DEFAULT_AU_INPUT,
  generateAustraliaTips,
} from "../../lib/global-calculators/australia";

const SUBCLASS_META: Array<{
  id: AuVisaSubclass;
  code: string;
  title: string;
  bonusLabel: string;
}> = [
  {
    id: "subclass_189",
    code: "189",
    title: "Skilled Independent (PR)",
    bonusLabel: "+0 Nomination pts",
  },
  {
    id: "subclass_190",
    code: "190",
    title: "Skilled Nominated (PR)",
    bonusLabel: "+5 State Nomination",
  },
  {
    id: "subclass_491",
    code: "491",
    title: "Skilled Regional → 191 PR",
    bonusLabel: "+15 Regional / Family",
  },
];

export function AustraliaSkillSelectTool() {
  const [form, setForm] = useState<AuSkillSelectInput>(DEFAULT_AU_INPUT);
  const [previousBeforePreview, setPreviousBeforePreview] =
    useState<AuSkillSelectInput | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("au");
      if (encoded) {
        const parsed = JSON.parse(decodeURIComponent(atob(encoded))) as Partial<AuSkillSelectInput>;
        if (parsed && typeof parsed === "object") {
          setForm({ ...DEFAULT_AU_INPUT, ...parsed });
        }
      }
    } catch {
      // ignore malformed query param
    }
  }, []);

  const result = useMemo(() => calculateAustraliaSkillSelect(form), [form]);
  const tips = useMemo(() => generateAustraliaTips(form, result), [form, result]);

  const updateForm = (patch: Partial<AuSkillSelectInput>) => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const resetToZero = () => {
    setPreviousBeforePreview(null);
    setForm((prev) => ({
      ...DEFAULT_AU_INPUT,
      activeSubclass: prev.activeSubclass,
    }));
  };

  const buildPlainTextSummary = (): string => {
    const activeMeta = SUBCLASS_META.find((s) => s.id === form.activeSubclass) ?? SUBCLASS_META[0];
    return [
      "======================================================================",
      "THE DOCUMENTO — AUSTRALIA SKILLSELECT GSM PR POINTS ASSESSMENT",
      "Statutory Basis: Migration Regulations 1994 — Schedule 6D",
      `Selected Visa Subclass: Subclass ${activeMeta.code} (${activeMeta.title})`,
      "======================================================================",
      "",
      `SKILLSELECT TOTAL SCORE: ${result.totalScore} pts (Statutory Pass Mark: ${result.passMark} pts)`,
      `EOI Eligibility Status: ${
        result.eligibleToSubmitEoi ? "ELIGIBLE FOR SKILLSELECT EOI" : "NOT YET ELIGIBLE"
      }`,
      "----------------------------------------------------------------------",
      `Age:                                     ${result.breakdown.age} / 30`,
      `English Language Ability:                ${result.breakdown.english} / 20`,
      `Combined Skilled Employment (Cap 20):    ${result.breakdown.combinedEmploymentCapped} / 20`,
      `Educational Qualifications:              ${result.breakdown.education} / 20`,
      `Australian Study Requirement:            ${result.breakdown.australianStudy} / 5`,
      `Specialist STEM Research Qualification:  ${result.breakdown.specialistStem} / 10`,
      `NAATI Credentialed Community Language:   ${result.breakdown.naatiCcl} / 5`,
      `Professional Year in Australia:          ${result.breakdown.professionalYear} / 5`,
      `Study in Regional Australia:             ${result.breakdown.regionalStudy} / 5`,
      `Partner Skills:                          ${result.breakdown.partnerSkills} / 10`,
      `State / Regional Nomination:             ${result.breakdown.nominationPoints} / 15`,
      "----------------------------------------------------------------------",
      `Comparison — Subclass 189: ${result.scoresBySubclass.subclass_189} | Subclass 190: ${result.scoresBySubclass.subclass_190} | Subclass 491: ${result.scoresBySubclass.subclass_491}`,
      "Generated via The Documento (thedocumento.com/calculators/australia-pr)",
    ].join("\n");
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

  const renderYesNo = (
    val: boolean | null,
    onChange: (next: boolean) => void,
    yesText: string = "Yes (+5 pts)"
  ) => (
    <div style={{ display: "flex", gap: "10px" }}>
      {[
        { label: yesText, value: true },
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
        className="au-no-print"
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
              Australia SkillSelect PR Calculator
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
      <CalculatorCountrySwitchBar activeCalculatorId="au_skillselect" />

      <main style={{ maxWidth: "1320px", margin: "0 auto", padding: "36px 24px 96px 24px" }}>
        <section
          style={{
            marginBottom: "24px",
            paddingBottom: "22px",
            borderBottom: "1px solid #DCE5E1",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "24px",
            alignItems: "end",
          }}
        >
          <div className="au-col-full" style={{ gridColumn: "span 8" }}>
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
              Australia SkillSelect PR Points Calculator
            </h1>
            <p style={{ fontSize: "15.5px", color: "#445451", lineHeight: 1.55, margin: 0, maxWidth: "760px" }}>
              Replicates Migration Regulations 1994 Schedule 6D across Subclasses 189 (Skilled Independent), 190 (State Nominated), and 491 (Skilled Work Regional Provisional → 191 PR) — enforcing the 65-point legislative pass mark, age-45 limit, and 20-point combined employment cap.
            </p>
          </div>

          <div className="au-col-full" style={{ gridColumn: "span 4" }}>
            <CountryCalculatorHeroCard
              countryId="australia"
              authorityLabel="Department of Home Affairs Standard"
              headlineMetric="Schedule 6D • Min 65 Pass Mark (< 45 Years)"
              subMetric="Subclasses 189, 190 (+5) & Regional 491 (+15)"
            />
          </div>
        </section>

        {/* 3-Subclass Simultaneous Selector */}
        <section
          aria-label="Select Australian Skilled Visa Subclass"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
            marginBottom: "28px",
          }}
        >
          {SUBCLASS_META.map((sub) => {
            const active = form.activeSubclass === sub.id;
            const subScore = result.scoresBySubclass[sub.id];
            return (
              <button
                key={sub.id}
                type="button"
                data-testid={`au-tab-${sub.id}`}
                aria-pressed={active}
                onClick={() => updateForm({ activeSubclass: sub.id })}
                style={{
                  textAlign: "left",
                  padding: "16px 18px",
                  borderRadius: "10px",
                  border: active ? "1.5px solid #063C3D" : "1px solid #DCE5E1",
                  background: active ? "#063C3D" : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#172322",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: active ? "#B9DED4" : "#0D6866" }}>
                    Subclass {sub.code} • {sub.bonusLabel}
                  </div>
                  <div style={{ fontSize: "14.5px", fontWeight: 700, marginTop: "3px" }}>
                    {sub.title}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    data-testid={`au-score-${sub.id}`}
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: active ? "#FFFFFF" : "#063C3D",
                    }}
                  >
                    {subScore}
                  </span>
                  <div style={{ fontSize: "11px", color: active ? "#DDEFE8" : "#6E7F7C" }}>
                    Pass 65
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "28px", alignItems: "start" }}>
          <div className="au-col-full" style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "22px" }}>
            <section style={cardStyle} aria-labelledby="au-sec-core">
              <h2 id="au-sec-core" style={{ fontSize: "19px", fontWeight: 700, color: "#063C3D", margin: "0 0 18px 0" }}>
                Age, English &amp; Qualifications
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="au-age" style={labelStyle}>
                    <span>Age at the time you are invited to apply</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>{result.breakdown.age} / 30 pts</span>
                  </label>
                  <select
                    id="au-age"
                    value={form.ageBand}
                    onChange={(e) => updateForm({ ageBand: e.target.value as AuAgeBand })}
                    style={selectStyle}
                  >
                    <option value="">Select age bracket...</option>
                    <option value="18_to_24">At least 18 but less than 25 years (+25 pts)</option>
                    <option value="25_to_32">At least 25 but less than 33 years (+30 pts — Peak)</option>
                    <option value="33_to_39">At least 33 but less than 40 years (+25 pts)</option>
                    <option value="40_to_44">At least 40 but less than 45 years (+15 pts)</option>
                    <option value="45_plus">45 years or older (0 pts — Statutorily Ineligible for GSM)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="au-english" style={labelStyle}>
                    <span>English language proficiency level</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>{result.breakdown.english} / 20 pts</span>
                  </label>
                  <select
                    id="au-english"
                    value={form.englishLevel}
                    onChange={(e) => updateForm({ englishLevel: e.target.value as AuEnglishLevel })}
                    style={selectStyle}
                  >
                    <option value="">Select English test tier...</option>
                    <option value="below_competent">Below Competent English (0 pts — Ineligible for EOI)</option>
                    <option value="competent">Competent English — IELTS 6.0+ / PTE 50+ each OR UK/US/CA/NZ/IE Passport (0 pts)</option>
                    <option value="proficient">Proficient English — IELTS 7.0+ / PTE 65+ / OET B+ in every band (+10 pts)</option>
                    <option value="superior">Superior English — IELTS 8.0+ / PTE 79+ / OET A in every band (+20 pts)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="au-education" style={labelStyle}>
                    <span>Highest recognized educational qualification</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>{result.breakdown.education} / 20 pts</span>
                  </label>
                  <select
                    id="au-education"
                    value={form.educationTier}
                    onChange={(e) => updateForm({ educationTier: e.target.value as AuEducationTier })}
                    style={selectStyle}
                  >
                    <option value="">Select highest recognized qualification...</option>
                    <option value="none_or_secondary">Secondary school or unassessed qualification (0 pts)</option>
                    <option value="diploma_or_trade">Australian Diploma / Trade Qualification OR Assessing Authority Award (+10 pts)</option>
                    <option value="bachelors_or_masters">Bachelor&apos;s Degree (or Master&apos;s / Honours Degree) (+15 pts)</option>
                    <option value="doctorate_phd">Doctorate (Ph.D.) from Australian or recognized university (+20 pts)</option>
                  </select>
                </div>
              </div>
            </section>

            <section style={cardStyle} aria-labelledby="au-sec-work">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                <h2 id="au-sec-work" style={{ fontSize: "19px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                  Skilled Employment in Past 10 Years
                </h2>
                <span style={{ fontSize: "13px", fontWeight: 650, color: "#0D6866" }}>
                  Combined Cap: {result.breakdown.combinedEmploymentCapped} / 20 pts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label htmlFor="au-overseas-work" style={labelStyle}>
                    <span>Overseas skilled employment (outside Australia in nominated/closely related ANZSCO)</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 15 pts</span>
                  </label>
                  <select
                    id="au-overseas-work"
                    value={form.overseasWork}
                    onChange={(e) => updateForm({ overseasWork: e.target.value as AuOverseasWorkBand })}
                    style={selectStyle}
                  >
                    <option value="">Select overseas skilled employment...</option>
                    <option value="under_3yr">Less than 3 years (0 pts)</option>
                    <option value="3_to_4yr">At least 3 but less than 5 years (+5 pts)</option>
                    <option value="5_to_7yr">At least 5 but less than 8 years (+10 pts)</option>
                    <option value="8yr_plus">At least 8 years (+15 pts)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="au-local-work" style={labelStyle}>
                    <span>Australian skilled employment (inside Australia in nominated/closely related ANZSCO)</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>Max 20 pts</span>
                  </label>
                  <select
                    id="au-local-work"
                    value={form.australianWork}
                    onChange={(e) => updateForm({ australianWork: e.target.value as AuLocalWorkBand })}
                    style={selectStyle}
                  >
                    <option value="">Select Australian skilled employment...</option>
                    <option value="under_1yr">Less than 1 year (0 pts)</option>
                    <option value="1_to_2yr">At least 1 but less than 3 years (+5 pts)</option>
                    <option value="3_to_4yr">At least 3 but less than 5 years (+10 pts)</option>
                    <option value="5_to_7yr">At least 5 but less than 8 years (+15 pts)</option>
                    <option value="8yr_plus">At least 8 years (+20 pts)</option>
                  </select>
                </div>
              </div>
            </section>

            <section style={cardStyle} aria-labelledby="au-sec-bonus">
              <h2 id="au-sec-bonus" style={{ fontSize: "19px", fontWeight: 700, color: "#063C3D", margin: "0 0 18px 0" }}>
                Australian Study, Accreditations &amp; Partner Skills
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={labelStyle}>
                    <span>Do you meet the 2-year Australian Study Requirement (CRICOS ≥ 92 weeks)?</span>
                  </div>
                  {renderYesNo(form.meetsAustralianStudyRequirement, (v) =>
                    updateForm({ meetsAustralianStudyRequirement: v })
                  )}
                </div>

                {form.meetsAustralianStudyRequirement === true && (
                  <div>
                    <div style={labelStyle}>
                      <span>Did you live and study in Designated Regional Australia while completing that qualification?</span>
                    </div>
                    {renderYesNo(form.hasRegionalAustraliaStudy, (v) =>
                      updateForm({ hasRegionalAustraliaStudy: v })
                    )}
                  </div>
                )}

                <div>
                  <div style={labelStyle}>
                    <span>Specialist Educational Qualification: Australian Master&apos;s by Research or Doctorate in STEM / ICT (≥ 2 academic years)?</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>
                      {result.breakdown.specialistStem} / 10 pts
                    </span>
                  </div>
                  {renderYesNo(
                    form.hasSpecialistStemResearchQualification,
                    (v) => updateForm({ hasSpecialistStemResearchQualification: v }),
                    "Yes (+10 pts)"
                  )}
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>Completed an approved Professional Year in Australia (Accounting, ICT/ACS, or Engineering in past 4 years)?</span>
                  </div>
                  {renderYesNo(form.hasProfessionalYearInAustralia, (v) =>
                    updateForm({ hasProfessionalYearInAustralia: v })
                  )}
                </div>

                <div>
                  <div style={labelStyle}>
                    <span>Hold NAATI Credentialed Community Language (CCL) accreditation?</span>
                  </div>
                  {renderYesNo(form.hasCredentialedCommunityLanguageNaati, (v) =>
                    updateForm({ hasCredentialedCommunityLanguageNaati: v })
                  )}
                </div>

                <div>
                  <label htmlFor="au-partner" style={labelStyle}>
                    <span>Partner / Marital Status (Schedule 6D Partner Skills)</span>
                    <span style={{ fontSize: "12.5px", color: "#0D6866" }}>{result.breakdown.partnerSkills} / 10 pts</span>
                  </label>
                  <select
                    id="au-partner"
                    value={form.partnerTier}
                    onChange={(e) => updateForm({ partnerTier: e.target.value as AuPartnerSkillsTier })}
                    style={selectStyle}
                  >
                    <option value="">Select marital / partner skills status...</option>
                    <option value="single_or_au_citizen_pr_partner">Single (unmarried / no partner) OR Partner is an Australian Citizen / PR (+10 pts)</option>
                    <option value="partner_skilled_and_competent_english">Partner is under 45, has Competent English &amp; Positive Skills Assessment (+10 pts)</option>
                    <option value="partner_competent_english_only">Partner has Competent English only (+5 pts)</option>
                    <option value="partner_ineligible">Partner does not hold Competent English and is not an Australian Citizen/PR (0 pts)</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          {/* Right Sticky Official Ledger */}
          <aside
            className="au-col-full"
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
                  SkillSelect Schedule 6D Score
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
                  Pass Mark: 65 pts
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "8px 0 10px 0" }}>
                <span
                  data-testid="au-grand-total"
                  style={{
                    fontSize: "56px",
                    fontWeight: 800,
                    color: "#063C3D",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                  }}
                >
                  {result.totalScore}
                </span>
                <span style={{ fontSize: "18px", fontWeight: 600, color: "#6E7F7C" }}>points</span>
              </div>

              {/* Animated 65-Point Pass-Mark Progress Meter */}
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
                      width: `${Math.min(100, Math.round((result.totalScore / 65) * 100))}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: result.eligibleToSubmitEoi ? "#169B77" : "#0D6866",
                      transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </div>
              </div>

              {!result.hasAnyInput ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    fontSize: "13px",
                    color: "#445451",
                  }}
                >
                  Complete the questionnaire on the left to calculate your Australia SkillSelect PR score from 0.
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: result.eligibleToSubmitEoi ? "#EAF6F0" : "#FEF7EA",
                    border: result.eligibleToSubmitEoi ? "1px solid #B9DED4" : "1px solid #F0D9B5",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: result.eligibleToSubmitEoi ? "#176B50" : "#8A5A10",
                    lineHeight: 1.5,
                  }}
                >
                  {result.ineligibilityReasons.length > 0 ? (
                    result.ineligibilityReasons.map((r, i) => <div key={i}>• {r}</div>)
                  ) : result.eligibleToSubmitEoi ? (
                    `✓ Meets 65-Point Legislative Pass Mark (+${result.totalScore - 65} above minimum)`
                  ) : (
                    `Below 65-Point Pass Mark: ${65 - result.totalScore} more points needed to lodge a valid EOI.`
                  )}
                </div>
              )}

              {result.advisoryNotes.length > 0 && (
                <div
                  data-testid="au-advisory-notes"
                  style={{
                    marginTop: "10px",
                    padding: "9px 11px",
                    borderRadius: "8px",
                    background: "#F4F8F6",
                    border: "1px solid #DCE5E1",
                    fontSize: "12px",
                    color: "#384A46",
                    lineHeight: 1.45,
                  }}
                >
                  {result.advisoryNotes.map((note, idx) => (
                    <div key={idx}>• {note}</div>
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
                {[
                  ["Age", `${result.breakdown.age} / 30`],
                  ["English Language", `${result.breakdown.english} / 20`],
                  ["Combined Skilled Employment", `${result.breakdown.combinedEmploymentCapped} / 20`],
                  ["Qualifications", `${result.breakdown.education} / 20`],
                  [
                    "AU Study + Regional + STEM",
                    `${
                      result.breakdown.australianStudy +
                      result.breakdown.regionalStudy +
                      result.breakdown.specialistStem
                    } / 20`,
                  ],
                  [
                    "Professional Year + NAATI CCL",
                    `${result.breakdown.professionalYear + result.breakdown.naatiCcl} / 10`,
                  ],
                  ["Partner Skills", `${result.breakdown.partnerSkills} / 10`],
                  ["State / Regional Nomination", `${result.breakdown.nominationPoints} / 15`],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{lbl}</span>
                    <strong style={{ color: "#063C3D" }}>{val}</strong>
                  </div>
                ))}
              </div>

              <div
                className="au-no-print"
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
                    a.download = `Documento_Australia_SkillSelect_${result.totalScore}.txt`;
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
                        `${window.location.origin}${window.location.pathname}?au=${encodeURIComponent(encoded)}`
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
                calculatorId="australia-pr"
                calculatorTitle="Australia SkillSelect PR (189 / 190 / 491)"
                countryCode="AU"
                liveScoreSummary={`${result.totalScore} pts (${form.activeSubclass.replace("subclass_", "Subclass ")} • ${result.eligibleToSubmitEoi ? "65+ Pass Met" : "Below 65 Pass"})`}
                hasCalculatedScore={result.totalScore > 0}
                scorePayload={{
                  totalScore: result.totalScore,
                  subclass: form.activeSubclass,
                  eligible: result.eligibleToSubmitEoi,
                }}
              />
            </div>

            {tips.length > 0 && (
              <div className="au-no-print" style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "12px", padding: "22px" }}>
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", margin: "0 0 12px 0" }}>
                  Fastest Ways to Increase Your SkillSelect Score
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
          .au-col-full {
            grid-column: span 12 !important;
            position: static !important;
          }
        }
        @media print {
          .au-no-print { display: none !important; }
          .au-col-full { grid-column: span 12 !important; position: static !important; }
        }
      `}</style>
    </div>
  );
}

