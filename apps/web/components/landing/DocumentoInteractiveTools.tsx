"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

interface DocumentoInteractiveToolsProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

interface CasePreset {
  id: string;
  tabLabel: string;
  status: "Available" | "Planned";
  title: string;
  desc: string;
  fitScore: string;
  fitVerdict: string;
  pillars: Array<{
    tag: string;
    title: string;
    detail: string;
  }>;
}

const CASE_PRESETS: CasePreset[] = [
  {
    id: "ca-pr",
    tabLabel: "Canada Express Entry & PNP",
    status: "Available",
    title: "Canada Express Entry (FSWP / CEC) & PNP",
    desc: "CRS score optimization, NOC 2021 TEER duty matching, WES ECA verification, post-ITA 60-day e-APR assembly, and provincial nominee tracking.",
    fitScore: "100% Codified IRCC Fit",
    fitVerdict: "Eliminates hours of manual CRS/PNP recalculation, NOC reference auditing, and post-ITA e-APR document indexing.",
    pillars: [
      { tag: "CRS & PNP", title: "Live Points & Draws", detail: "Official CRS and Provincial Nominee scoring aligned to IRCC human-capital criteria." },
      { tag: "NOC 2021", title: "TEER Duty Verification", detail: "Cross-checks employer reference letters and IMM 5669 timelines to prevent PFLs." },
      { tag: "60-Day SLA", title: "Post-ITA e-APR Clock", detail: "Tracks police clearances, medicals, and settlement funds before statutory expiry." },
    ],
  },
  {
    id: "ca-super-visa",
    tabLabel: "Canada Super Visa & TRV",
    status: "Available",
    title: "Canada Super Visa & Visitor Visa (TRV)",
    desc: "Automated LICO household income checks from Canadian host CRA NOAs, privacy-shielded sponsor upload portals, $100k+ medical insurance verification, and IMM 5257/5707 packaging.",
    fitScore: "100% Codified IRCC Fit",
    fitVerdict: "Collects private Canadian host CRA NOAs securely while verifying LICO benchmarks and $100k+ medical insurance binders automatically.",
    pillars: [
      { tag: "LICO / NOA", title: "Host Income Validator", detail: "Extracts CRA NOA Line 15000 and validates against IRCC family-size LICO tables." },
      { tag: "Sponsor Link", title: "Privacy-Shielded Portal", detail: "Canadian hosts upload tax and payroll docs directly without exposing financials." },
      { tag: "IMM 5257e", title: "Insurance & Form Audit", detail: "Verifies 365-day medical coverage ($100k+ CAD) and compiles 5-folder TRV packages." },
    ],
  },
  {
    id: "ca-study-work",
    tabLabel: "Canada Study, PGWP & SOWP",
    status: "Available",
    title: "Canada Study Permits, PGWP & SOWP",
    desc: "DLI Letter of Acceptance & Provincial Attestation Letter (PAL) validation, GIC living funds checks, 180-day PGWP filing countdowns, and IMM 1294/5710 work permit workflows.",
    fitScore: "100% Codified IRCC Fit",
    fitVerdict: "Prevents avoidable Study Permit, PGWP, and Spousal Open Work Permit refusals under current IRCC cap and TEER reforms.",
    pillars: [
      { tag: "DLI & PAL", title: "Cap & Funds Verification", detail: "Checks DLI LOA numbers, PAL allocations, and GIC living-cost thresholds." },
      { tag: "180-Day PGWP", title: "Graduation & Language Gate", detail: "Monitors the 180-day post-completion clock, full-time transcripts, and CLB scores." },
      { tag: "SOWP / TEER", title: "Spousal Eligibility Matrix", detail: "Verifies principal spouse graduate study or qualifying TEER 0–3 work status." },
    ],
  },
  {
    id: "ca-family-lmia",
    tabLabel: "Canada Family & LMIA Work",
    status: "Available",
    title: "Canada Spousal Sponsorship & LMIA Work Permits",
    desc: "Bona fide relationship timelines, sponsor undertaking & IMM 1344/5532 assembly, plus ESDC LMIA confirmation and employer-specific work permit compliance.",
    fitScore: "100% Codified IRCC Fit",
    fitVerdict: "Structures complex relationship proof and employer LMIA / IMP packages into R10-complete CIC/IRCC 5-folder dossiers.",
    pillars: [
      { tag: "IMM 1344/5532", title: "Sponsorship Integrity", detail: "Cross-checks sponsor and applicant timelines, cohabitation proof, and CRA NOAs." },
      { tag: "ESDC LMIA", title: "TFWP & IMP Compliance", detail: "Tracks positive LMIA expiry, NOC 2021 wage thresholds, and Offer of Employment #s." },
      { tag: "5-Folder", title: "IRCC Package Assembly", detail: "Compiles sequential exhibit tabs with IMM 5476 representative sign-off." },
    ],
  },
  {
    id: "us-uk",
    tabLabel: "US (USCIS) & UK (UKVI)",
    status: "Available",
    title: "Cross-Border US (EB-1A / NIW / H-1B) & UK Global Talent",
    desc: "Secondary cross-border operational coverage for North American and Commonwealth firms handling US Form I-140/I-129 petitions and UKVI Global Talent or Skilled Worker filings.",
    fitScore: "Cross-Border Operational Fit",
    fitVerdict: "Lets Canadian practices serve cross-border US and UK corporate clients inside the exact same audited workspace.",
    pillars: [
      { tag: "USCIS I-140", title: "EB-1A, NIW & H-1B", detail: "Kazarian & Dhanasar matrices, LCA wage tracking, and Form I-140/I-129 workflows." },
      { tag: "UKVI Rule", title: "UK Global Talent & Skilled", detail: "10-document / 3-page guardrails and CoS salary threshold checks." },
      { tag: "SHA-256", title: "Unified Practice Vault", detail: "Single RBAC, billing, and evidentiary standard across CA, US, and UK dockets." },
    ],
  },
  {
    id: "de-bluecard",
    tabLabel: "Germany & Australia (Planned)",
    status: "Planned",
    title: "Germany EU Blue Card & Australia Pilot",
    desc: "Roadmap expansion for BAMF salary threshold validation, Anabin H+ degree comparability, Chancenkarte points simulation, and Australia Subclass 858/482 workflows.",
    fitScore: "Expansion Roadmap",
    fitVerdict: "Engineered for Fachkräfteeinwanderungsgesetz (FEG) and Australian Department of Home Affairs standards.",
    pillars: [
      { tag: "H+ Check", title: "Anabin Database Matcher", detail: "Foreign tertiary degree comparability and H+ institution check." },
      { tag: "BAMF / TSMIT", title: "Salary Threshold Validators", detail: "Automated checks for EU Blue Card and Australian skilled tiers." },
      { tag: "SHA-256", title: "Universal Vault Ready", detail: "Cryptographic SHA-256 exhibit storage immediately operational." },
    ],
  },
];

export function DocumentoInteractiveTools({ onOpenLogin }: DocumentoInteractiveToolsProps) {
  const [activePresetId, setActivePresetId] = useState<string>("ca-pr");
  const [exhibitCount, setExhibitCount] = useState<number>(28);
  const [activePersonaTab, setActivePersonaTab] = useState<"applicant" | "lawfirm">("applicant");
  const [waitingDemoState, setWaitingDemoState] = useState<"applicant" | "firm">("firm");

  const activePreset = CASE_PRESETS.find((p) => p.id === activePresetId) || CASE_PRESETS[0];
  const estimatedHoursSaved = Math.max(4, Math.round(exhibitCount * 0.45));

  return (
    <div>
      {/* SECTION 1: Case Matcher - "Is Documento right for your case?" */}
      <section
        id="case-fit-content"
        style={{
          position: "relative",
          padding: "88px 24px",
          scrollMarginTop: "80px",
          background: "#FFFFFF",
          borderBottom: "1px solid #DCE7E3",
        }}
      >
        <InteractiveSectionBackground variant="dot-matrix" />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "1240px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "36px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: ~1/3 (Intro & Pathway Selector) */}
          <div
            className="animate-on-scroll section-header-reveal tools-col-left"
            data-motion="left"
            style={{
              gridColumn: "span 4",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              position: "sticky",
              top: "100px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#07594F",
              }}
            >
              Case Compatibility
            </div>

            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 40px)",
                fontWeight: 700,
                color: "#063C3D",
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: 0,
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
              }}
            >
              Is Documento right for your case?
            </h2>

            <p
              style={{
                fontSize: "15px",
                color: "#475955",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Purpose-built for Canadian immigration consultants (RCICs), immigration law firms, and agencies handling IRCC filings, sponsor documents, and multi-lingual client intake.
            </p>

            {/* Vertical Pathway List */}
            <div
              role="navigation"
              aria-label="Supported Pathways"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "8px",
                borderTop: "1px solid #DCE5E1",
                paddingTop: "16px",
              }}
            >
              {CASE_PRESETS.map((preset) => {
                const isSelected = preset.id === activePresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setActivePresetId(preset.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 14px",
                      borderRadius: "8px",
                      background: isSelected ? "#07594F" : "#F8FAF9",
                      color: isSelected ? "#FFFFFF" : "#172322",
                      border: isSelected ? "1px solid #07594F" : "1px solid #DCE5E1",
                      fontSize: "13.5px",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{preset.tabLabel}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 650,
                        color: isSelected ? "#B9DED4" : preset.status === "Available" ? "#07594F" : "#8A5A10",
                      }}
                    >
                      {preset.status === "Available" ? "Verified" : "Planned"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: ~2/3 (Pathway Fit Dossier, Verdict & Pillars) */}
          <div
            className="animate-on-scroll delay-150 tools-col-right spotlight-card"
            data-motion="right"
            style={{
              gridColumn: "span 8",
              minWidth: 0,
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "32px",
              boxShadow: "0 4px 24px rgba(6, 60, 61, 0.04)",
            }}
          >
            {/* Status & Category */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: "6px",
                  background: activePreset.status === "Available" ? "#EAF5EF" : "#FEF7EA",
                  color: activePreset.status === "Available" ? "#07594F" : "#8A5A10",
                  border: `1px solid ${activePreset.status === "Available" ? "#B9DED4" : "#F6D8A6"}`,
                }}
              >
                {activePreset.status === "Available"
                  ? "Coverage Verified • Operational"
                  : "Expansion Pipeline • In Development"}
              </span>

              <span style={{ fontSize: "12.5px", fontWeight: 650, color: "#6E7F7C" }}>
                {activePreset.fitScore}
              </span>
            </div>

            <h3
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#063C3D",
                letterSpacing: "-0.02em",
                margin: "0 0 10px 0",
                lineHeight: 1.25,
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
              }}
            >
              {activePreset.title}
            </h3>

            <p
              style={{
                fontSize: "14.5px",
                color: "#475955",
                lineHeight: 1.6,
                margin: "0 0 24px 0",
              }}
            >
              {activePreset.desc}
            </p>

            {/* Law Firm Verdict Callout + Live Micro-UI Simulator */}
            <div
              style={{
                background: "#F8FAF9",
                border: "1px solid #DCE5E1",
                padding: "18px 20px",
                borderRadius: "10px",
                marginBottom: "24px",
                fontSize: "14px",
                color: "#063C3D",
                lineHeight: 1.55,
              }}
            >
              <div style={{ marginBottom: "14px" }}>
                <strong style={{ color: "#07594F" }}>Practice Verdict:</strong> {activePreset.fitVerdict}
              </div>

              {/* Interactive Micro-UI: Exhibit Volume & Time-Savings Simulator */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 240px" }}>
                  <span
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#063C3D",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Case Volume: {exhibitCount} Exhibits
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={85}
                    step={5}
                    value={exhibitCount}
                    aria-label="Simulate case exhibit volume"
                    onChange={(e) => setExhibitCount(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: "#169B77",
                      height: "4px",
                      cursor: "pointer",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#07594F",
                    background: "#EAF5EF",
                    borderRadius: "6px",
                    padding: "4px 12px",
                    border: "1px solid #B9DED4",
                  }}
                >
                  ~{estimatedHoursSaved} hrs paralegal assembly saved
                </span>
              </div>
            </div>

            {/* 3 Pillars */}
            <div
              className="stagger-children animate-on-scroll"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "28px",
              }}
            >
              {activePreset.pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  className="hover-lift spotlight-card"
                  style={{
                    background: "#F8FAF9",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "18px",
                  }}
                >
                  <div style={{ marginBottom: "10px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#07594F",
                        background: "#EAF5EF",
                        padding: "3px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {pillar.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                    {pillar.title}
                  </div>
                  <div style={{ fontSize: "12.8px", color: "#475955", lineHeight: 1.5 }}>
                    {pillar.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Button & Disclaimer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => onOpenLogin("firm")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#07594F",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 650,
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  {activePreset.status === "Available"
                    ? "Access Workspace for this Pathway →"
                    : "Join Jurisdiction Waitlist →"}
                </button>

                {activePreset.id.startsWith("ca-") && (
                  <>
                    <a
                      href="/calculators/canada-crs"
                      style={{
                        padding: "11px 18px",
                        borderRadius: "8px",
                        border: "1px solid #0D6866",
                        background: "#F8FAF9",
                        color: "#063C3D",
                        fontSize: "13.5px",
                        fontWeight: 650,
                        textDecoration: "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Open Official Canada CRS Calculator →
                    </a>
                    <a
                      href="/calculators/canada-pnp"
                      style={{
                        padding: "11px 18px",
                        borderRadius: "8px",
                        border: "1px solid #0D6866",
                        background: "#FFFFFF",
                        color: "#063C3D",
                        fontSize: "13.5px",
                        fontWeight: 650,
                        textDecoration: "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Open Official Canada PNP Calculator →
                    </a>
                  </>
                )}

                {activePreset.id === "us-uk" && (
                  <a
                    href="/calculators/uk-skilled-worker"
                    style={{
                      padding: "11px 18px",
                      borderRadius: "8px",
                      border: "1px solid #0D6866",
                      background: "#F8FAF9",
                      color: "#063C3D",
                      fontSize: "13.5px",
                      fontWeight: 650,
                      textDecoration: "none",
                    }}
                  >
                    Open UK 70-Point &amp; ILR Calculator →
                  </a>
                )}

                {activePreset.id === "de-bluecard" && (
                  <a
                    href="/calculators/germany-pr"
                    style={{
                      padding: "11px 18px",
                      borderRadius: "8px",
                      border: "1px solid #0D6866",
                      background: "#F8FAF9",
                      color: "#063C3D",
                      fontSize: "13.5px",
                      fontWeight: 650,
                      textDecoration: "none",
                    }}
                  >
                    Open Germany Chancenkarte &amp; Blue Card Calculator →
                  </a>
                )}

                <a
                  href="/calculators"
                  style={{
                    padding: "11px 18px",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    background: "#FFFFFF",
                    color: "#07594F",
                    fontSize: "13.5px",
                    fontWeight: 650,
                    textDecoration: "none",
                  }}
                >
                  All 5-Country PR Calculators →
                </a>
              </div>

              <span style={{ fontSize: "11.5px", color: "#6E7F7C" }}>
                Workflow guidance only. Does not substitute for formal legal representation.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Dedicated Experiences (Applicants vs Legal Teams) */}
      <section
        id="personas"
        style={{
          position: "relative",
          padding: "88px 24px",
          scrollMarginTop: "80px",
          borderBottom: "1px solid #DCE7E3",
        }}
      >
        <InteractiveSectionBackground variant="architectural-grid" />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "1240px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "36px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: ~1/3 */}
          <div
            className="animate-on-scroll section-header-reveal tools-col-left"
            data-motion="right"
            style={{
              gridColumn: "span 4",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              position: "sticky",
              top: "100px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#07594F",
              }}
            >
              Dedicated Experiences
            </div>

            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 40px)",
                fontWeight: 700,
                color: "#063C3D",
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: 0,
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
              }}
            >
              Built for applicants and legal teams alike.
            </h2>

            <p
              style={{
                fontSize: "15px",
                color: "#475955",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Canadian immigration casework succeeds when applicants, Canadian hosts, and representatives share complete clarity. Explore how Documento supports clients and licensed RCIC or legal teams.
            </p>

            {/* Persona Toggle */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "8px",
                borderTop: "1px solid #DCE5E1",
                paddingTop: "16px",
              }}
            >
              <button
                type="button"
                id="tab-applicant"
                aria-pressed={activePersonaTab === "applicant"}
                onClick={() => setActivePersonaTab("applicant")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: activePersonaTab === "applicant" ? "#07594F" : "#F8FAF9",
                  color: activePersonaTab === "applicant" ? "#FFFFFF" : "#172322",
                  border: activePersonaTab === "applicant" ? "1px solid #07594F" : "1px solid #DCE5E1",
                  fontSize: "13.5px",
                  fontWeight: activePersonaTab === "applicant" ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>For Retained Applicants</span>
                <span style={{ fontSize: "12px", color: activePersonaTab === "applicant" ? "#B9DED4" : "#0D6866" }}>→</span>
              </button>

              <button
                type="button"
                id="tab-lawfirm"
                aria-pressed={activePersonaTab === "lawfirm"}
                onClick={() => setActivePersonaTab("lawfirm")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: activePersonaTab === "lawfirm" ? "#07594F" : "#F8FAF9",
                  color: activePersonaTab === "lawfirm" ? "#FFFFFF" : "#172322",
                  border: activePersonaTab === "lawfirm" ? "1px solid #07594F" : "1px solid #DCE5E1",
                  fontSize: "13.5px",
                  fontWeight: activePersonaTab === "lawfirm" ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>For Legal Teams &amp; Law Firms</span>
                <span style={{ fontSize: "12px", color: activePersonaTab === "lawfirm" ? "#B9DED4" : "#0D6866" }}>→</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: ~2/3 (Persona Feature Rows) */}
          <div
            className="animate-on-scroll delay-150 tools-col-right"
            data-motion="left"
            style={{
              gridColumn: "span 8",
              minWidth: 0,
            }}
          >
            {activePersonaTab === "applicant" ? (
              <div className="stagger-children animate-on-scroll" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Applicant Row 1 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                    boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                      Know Exactly What Documents Are Needed
                    </h3>
                    <p style={{ fontSize: "14px", color: "#475955", lineHeight: 1.6, margin: 0 }}>
                      Receive structured IRCC checklists in English, Gujarati, or Hindi with sample templates and file guidelines so you upload the right documents the first time.
                    </p>
                  </div>
                </div>

                {/* Applicant Row 2 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                    boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                      <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: 0, fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                        Clear Waiting-State Transparency
                      </h3>
                      <button
                        type="button"
                        onClick={() => setWaitingDemoState((prev) => (prev === "firm" ? "applicant" : "firm"))}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid",
                          borderColor: waitingDemoState === "firm" ? "#B9DED4" : "#F6D8A6",
                          background: waitingDemoState === "firm" ? "#EAF5EF" : "#FEF7EA",
                          color: waitingDemoState === "firm" ? "#07594F" : "#8A5A10",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {waitingDemoState === "firm"
                          ? "Status: With Legal Team"
                          : "Status: Action Needed by Applicant"}
                      </button>
                    </div>
                    <p style={{ fontSize: "14px", color: "#475955", lineHeight: 1.6, margin: 0 }}>
                      Always see who acts next—whether your legal team is preparing filings or waiting on a specific document from you.
                    </p>
                  </div>
                </div>

                {/* Applicant Row 3 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                    boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                      Private &amp; Secure Direct Uploads
                    </h3>
                    <p style={{ fontSize: "14px", color: "#475955", lineHeight: 1.6, margin: 0 }}>
                      Upload passports, CRA NOAs, GICs, and identity records directly to an encrypted vault—with privacy-shielded magic links for Canadian Super Visa and Family sponsors.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="stagger-children animate-on-scroll" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Law Firm Row 1 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                    boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                      Automated Evidence Cross-Examination
                    </h3>
                    <p style={{ fontSize: "14px", color: "#475955", lineHeight: 1.6, margin: 0 }}>
                      Cross-verify passport MRZ fields, CRA NOA Line 15000 LICO thresholds, NOC 2021 dates, and IMM 5669 timelines automatically to prevent IRCC refusals and PFLs.
                    </p>
                  </div>
                </div>

                {/* Law Firm Row 2 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                    boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                      Deterministic Exhibit Index &amp; Assembly
                    </h3>
                    <p style={{ fontSize: "14px", color: "#475955", lineHeight: 1.6, margin: 0 }}>
                      Generate structured CIC/IRCC 5-folder filing dossiers, sequential exhibit tabs, and validated IMM packages deterministically without manual PDF merging.
                    </p>
                  </div>
                </div>

                {/* Law Firm Row 3 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                    boxShadow: "0 2px 12px rgba(6, 60, 61, 0.03)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0", fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)" }}>
                      Role-Based Access &amp; Ethical Walls
                    </h3>
                    <p style={{ fontSize: "14px", color: "#475955", lineHeight: 1.6, margin: 0 }}>
                      Enforce strict ethical walls separating applicant questions from private internal legal strategies and partner deliberations.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .tools-col-left,
              .tools-col-right {
                grid-column: span 12 !important;
                position: static !important;
              }
            }
          `,
        }}
      />
    </div>
  );
}
