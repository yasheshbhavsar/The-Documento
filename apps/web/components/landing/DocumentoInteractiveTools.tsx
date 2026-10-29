"use client";

import React, { useState } from "react";
import { VERIFIED_PATHWAYS } from "./DocumentoCoverageExplorer";

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
    icon: string;
    title: string;
    detail: string;
  }>;
}

const CASE_PRESETS: CasePreset[] = [
  {
    id: "us-eb1a",
    tabLabel: "EB-1A & O-1A (US)",
    status: "Available",
    title: "EB-1A & O-1A Extraordinary Ability",
    desc: "10-criteria statutory matrix, Kazarian two-stage evaluation, citation extraction, and Form I-140/I-129 draft compilation.",
    fitScore: "100% Codified Statutory Fit",
    fitVerdict: "Eliminates 12+ hours of manual exhibit Bates-stamping, citation indexing, and Kazarian final merits analysis.",
    pillars: [
      { icon: "⚖️", title: "Statutory Rules Engine", detail: "8 CFR § 204.5(h) 10-criteria scorecard mapped to regulations." },
      { icon: "📑", title: "Automated Exhibit Index", detail: "Sequential tabs (Exhibits A-1 to E-12) stamped with SHA-256." },
      { icon: "🛡️", title: "Ethical Wall Isolation", detail: "Internal attorney work-product strictly quarantined from clients." },
    ],
  },
  {
    id: "us-eb2-niw",
    tabLabel: "EB-2 NIW (US)",
    status: "Available",
    title: "EB-2 National Interest Waiver (NIW)",
    desc: "Matter of Dhanasar 3-prong endeavor matrix, advanced degree credential verification, and government interest support evidence tracking.",
    fitScore: "100% Codified Statutory Fit",
    fitVerdict: "Systematizes Matter of Dhanasar into an objective, evidence-anchored petition docket.",
    pillars: [
      { icon: "🏛️", title: "Dhanasar 3-Prong Matrix", detail: "Substantial merit, national importance, and waiver justification." },
      { icon: "🎓", title: "Credential Verification", detail: "Foreign tertiary degree comparability and academic transcript auditing." },
      { icon: "📝", title: "Support Letters Docket", detail: "Tracks stakeholder, industry, and academic reference letters against prongs." },
    ],
  },
  {
    id: "ca-all",
    tabLabel: "Canada (Express Entry & Super Visa)",
    status: "Available",
    title: "Canada Express Entry & Super Visa",
    desc: "CRS point evaluation, NOC/TEER lead-statement matching, IRCC AcroForm XFA extraction, and automated LICO family calculations.",
    fitScore: "100% Codified Statutory Fit",
    fitVerdict: "Comprehensive Canadian legal ops across Express Entry, Super Visa, Study, and Work Permits.",
    pillars: [
      { icon: "🍁", title: "LICO & CRS Engine", detail: "Low Income Cut-Off family calculator and CRS points validation." },
      { icon: "📄", title: "AcroForm XFA Parser", detail: "Zero manual data re-entry from IMM 5257e with field-level audit." },
      { icon: "⏱️", title: "60-Day Post-ITA Countdown", detail: "Procedural deadline management with supervisor escalation alerts." },
    ],
  },
  {
    id: "uk-gtv",
    tabLabel: "UK Global Talent",
    status: "Available",
    title: "UK Global Talent Visa (Tech Nation & Sciences)",
    desc: "Stage 1 endorsement dossier builder, 10-document evidentiary limit enforcement, and reference letter audit tools.",
    fitScore: "100% Codified Statutory Fit",
    fitVerdict: "Guarantees strict adherence to the UKVI 10-document / 3-page rule and endorsing body criteria.",
    pillars: [
      { icon: "🇬🇧", title: "10-Document Limit Guardrail", detail: "Page-length and exhibit count constraints prevent rejections." },
      { icon: "💡", title: "Endorsing Criteria", detail: "Evidentiary mapping for Tech Nation and UKRI criteria." },
      { icon: "📑", title: "Dual-Stage Pipeline", detail: "Endorsement Stage 1 cleanly separated from Home Office Stage 2." },
    ],
  },
  {
    id: "de-bluecard",
    tabLabel: "Germany (Planned)",
    status: "Planned",
    title: "Germany EU Blue Card & Chancenkarte",
    desc: "BAMF minimum salary threshold validation, Anabin comparability checks, and points-based Opportunity Card simulator.",
    fitScore: "Expansion Roadmap",
    fitVerdict: "Engineered for Fachkräfteeinwanderungsgesetz (FEG) standards and Anabin degree equivalence.",
    pillars: [
      { icon: "🎓", title: "Anabin Database Matcher", detail: "Foreign tertiary degree comparability and H+ institution check." },
      { icon: "💶", title: "BAMF Salary Thresholds", detail: "Automated calculation for standard vs shortage occupation tiers." },
      { icon: "🛡️", title: "Universal Vault Ready", detail: "Cryptographic SHA-256 exhibit storage immediately operational." },
    ],
  },
];

export function DocumentoInteractiveTools({ onOpenLogin }: DocumentoInteractiveToolsProps) {
  // Tool 1: Case Matcher State (single clean preset selection)
  const [activePresetId, setActivePresetId] = useState<string>("us-eb1a");

  // Tool 2: Persona benefits switcher State
  const [activePersonaTab, setActivePersonaTab] = useState<"applicant" | "lawfirm">("applicant");

  const activePreset = CASE_PRESETS.find((p) => p.id === activePresetId) || CASE_PRESETS[0];

  return (
    <div style={{ background: "#FFFFFF" }}>
      {/* SECTION 1: Case Matcher - "Is Documento right for your case?" */}
      <section
        id="pathway-finder"
        style={{
          padding: "72px 24px",
          scrollMarginTop: "80px",
          borderBottom: "1px solid #DCE5E1",
          background: "#F8F7F2",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          {/* Header */}
          <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "720px", margin: "0 auto 28px auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "#DDEFE8",
                border: "1px solid #B9DED4",
                fontSize: "12px",
                fontWeight: 650,
                color: "#063C3D",
                marginBottom: "12px",
              }}
            >
              <span>Case Compatibility</span>
            </div>

            <h2
              style={{
                fontSize: "clamp(26px, 3.4vw, 36px)",
                fontWeight: 700,
                color: "#063C3D",
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                margin: "0 0 10px 0",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Is Documento right for your case?
            </h2>

            <p style={{ fontSize: "15px", color: "#445451", lineHeight: 1.5, margin: 0 }}>
              Purpose-built for immigration law firms handling complex petitions, evidentiary exhibits, and client coordination.
            </p>
          </div>

          {/* Quick-Switch Horizontal Pathway Tabs */}
          <div
            className="animate-on-scroll"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            {CASE_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setActivePresetId(preset.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: "1px solid",
                    borderColor: isSelected ? "#063C3D" : "#DCE5E1",
                    background: isSelected ? "#063C3D" : "#FFFFFF",
                    color: isSelected ? "#FFFFFF" : "#445451",
                    fontSize: "13px",
                    fontWeight: isSelected ? 650 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 8px rgba(6, 60, 61, 0.15)" : "none",
                  }}
                >
                  {preset.tabLabel}
                </button>
              );
            })}
          </div>

          {/* Single Focused Case Fit Card */}
          <div
            className="animate-on-scroll delay-150"
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid",
              borderColor: activePreset.status === "Available" ? "#B9DED4" : "#F6D8A6",
              boxShadow: "0 2px 14px rgba(6, 60, 61, 0.05)",
              padding: "clamp(20px, 3.5vw, 32px)",
            }}
          >
            {/* Top row: Title, Fit Tag, and Operational Status Badge */}
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "18px", color: "#0D6866" }}>
                  {activePreset.status === "Available" ? "✓" : "⏳"}
                </span>
                <span style={{ fontSize: "19px", fontWeight: 700, color: "#063C3D" }}>
                  {activePreset.title}
                </span>
                <span
                  style={{
                    background: activePreset.status === "Available" ? "#E8F4F0" : "#FEF7EA",
                    border: `1px solid ${activePreset.status === "Available" ? "#B9DED4" : "#F6D8A6"}`,
                    color: activePreset.status === "Available" ? "#0D6866" : "#8A5A10",
                    padding: "3px 10px",
                    borderRadius: "14px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  ⚡ {activePreset.fitScore}
                </span>
              </div>

              <div>
                {activePreset.status === "Available" ? (
                  <span style={{ background: "#DDEFE8", border: "1px solid #B9DED4", color: "#063C3D", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                    Coverage Verified • Operational
                  </span>
                ) : (
                  <span style={{ background: "#FEF7EA", border: "1px solid #F6D8A6", color: "#8A5A10", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                    Expansion Pipeline • In Development
                  </span>
                )}
              </div>
            </div>

            {/* Concise Value Statement */}
            <div
              style={{
                background: "#F8F7F2",
                borderLeft: "3px solid #0D6866",
                padding: "12px 16px",
                borderRadius: "0 8px 8px 0",
                marginBottom: "20px",
                fontSize: "14px",
                color: "#172322",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "#0D6866" }}>Law Firm Verdict:</strong> {activePreset.fitVerdict}
            </div>

            {/* 3 Pillars Conveyed At a Glance */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              {activePreset.pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#FAFDFB",
                    border: "1px solid #DCE5E1",
                    borderRadius: "10px",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "16px" }}>{pillar.icon}</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>{pillar.title}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451", lineHeight: 1.45 }}>
                    {pillar.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
                paddingTop: "18px",
                borderTop: "1px solid #EAE6DC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => onOpenLogin("firm")}
                  style={{
                    background: activePreset.status === "Available" ? "#0D6866" : "#063C3D",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 8px rgba(13, 104, 102, 0.2)",
                  }}
                >
                  <span>
                    {activePreset.status === "Available" ? "Access Workspace for this Pathway" : "Request Early Access / Roadmap"}
                  </span>
                  <span>→</span>
                </button>

                <a
                  href="#coverage"
                  style={{
                    color: "#0D6866",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  View full coverage details in explorer
                </a>
              </div>

              <div style={{ fontSize: "11px", color: "#6E7F7C", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🛡️</span>
                <span>SHA-256 Merkle Provenance • Ethical Wall Privacy</span>
              </div>
            </div>

            <div
              style={{
                marginTop: "14px",
                fontSize: "11px",
                color: "#6E7F7C",
                lineHeight: 1.4,
              }}
            >
              Workflow guidance only. Documento does not determine legal eligibility, guarantee petition approval, or substitute for formal legal representation.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Persona-Specific Tailored Views (Applicants vs Legal Teams) */}
      <section
        id="personas"
        style={{
          padding: "80px 24px",
          background: "#FFFFFF",
          borderBottom: "1px solid #DCE5E1",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          {/* Header */}
          <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 40px auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 14px",
                borderRadius: "20px",
                background: "#DDEFE8",
                border: "1px solid #B9DED4",
                fontSize: "12px",
                fontWeight: 600,
                color: "#063C3D",
                marginBottom: "16px",
              }}
            >
              <span>Dedicated Experiences</span>
            </div>

            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 700,
                color: "#063C3D",
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                margin: "0 0 16px 0",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Built for applicants and legal teams alike.
            </h2>

            <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: "0 auto 28px auto" }}>
              Immigration case management works only when both sides have clarity. Explore how Documento tailors tools for retained applicants and practicing immigration professionals.
            </p>

            {/* Persona Toggle */}
            <div
              style={{
                display: "inline-flex",
                background: "#E7EFEB",
                borderRadius: "10px",
                padding: "4px",
                gap: "4px",
              }}
            >
              <button
                type="button"
                id="tab-applicant"
                aria-pressed={activePersonaTab === "applicant"}
                aria-controls="panel-applicant"
                onClick={() => setActivePersonaTab("applicant")}
                style={{
                  padding: "10px 22px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: activePersonaTab === "applicant" ? 700 : 500,
                  background: activePersonaTab === "applicant" ? "#FFFFFF" : "transparent",
                  color: activePersonaTab === "applicant" ? "#063C3D" : "#445451",
                  boxShadow: activePersonaTab === "applicant" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>👤</span>
                <span>For Applicants &amp; Beneficiaries</span>
              </button>

              <button
                type="button"
                id="tab-lawfirm"
                aria-pressed={activePersonaTab === "lawfirm"}
                aria-controls="panel-lawfirm"
                onClick={() => setActivePersonaTab("lawfirm")}
                style={{
                  padding: "10px 22px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: activePersonaTab === "lawfirm" ? 700 : 500,
                  background: activePersonaTab === "lawfirm" ? "#FFFFFF" : "transparent",
                  color: activePersonaTab === "lawfirm" ? "#063C3D" : "#445451",
                  boxShadow: activePersonaTab === "lawfirm" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>⚖️</span>
                <span>For Legal Teams &amp; Law Firms</span>
              </button>
            </div>
          </div>

          {/* Persona View Content */}
          {activePersonaTab === "applicant" && (
            <div
              id="panel-applicant"
              role="tabpanel"
              aria-labelledby="tab-applicant"
              className="animate-on-scroll delay-150"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                gap: "24px",
              }}
            >
              {/* Card 1 */}
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#DDEFE8",
                    border: "1px solid #B9DED4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}
                >
                  📋
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Know Exactly What Documents Are Needed
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Receive structured checklists with sample templates and file guidelines so you upload the right paperwork the first time.
                </p>
              </div>

              {/* Card 2 */}
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#DDEFE8",
                    border: "1px solid #B9DED4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}
                >
                  ⏳
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Clear Waiting-State Transparency
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Always see who acts next—whether your legal team is preparing filings or waiting on a specific document from you.
                </p>
              </div>

              {/* Card 3 */}
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#DDEFE8",
                    border: "1px solid #B9DED4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}
                >
                  🔒
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Private &amp; Secure Direct Uploads
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Upload sensitive identity documents straight to a centralized repository with tamper-evident audit protection.
                </p>
              </div>
            </div>
          )}

          {activePersonaTab === "lawfirm" && (
            <div
              id="panel-lawfirm"
              role="tabpanel"
              aria-labelledby="tab-lawfirm"
              className="animate-on-scroll delay-150"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                gap: "24px",
              }}
            >
              {/* Card 1 */}
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#DDEFE8",
                    border: "1px solid #B9DED4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}
                >
                  🔍
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Automated Evidence Cross-Examination
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Cross-verify dates, entity spellings, and biographic facts across exhibits automatically to catch conflicting details early.
                </p>
              </div>

              {/* Card 2 */}
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#DDEFE8",
                    border: "1px solid #B9DED4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}
                >
                  📑
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Deterministic Exhibit Index &amp; Assembly
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Generate sequential exhibit tabs, tables of contents, and filing packages deterministically without manual PDF merging.
                </p>
              </div>

              {/* Card 3 */}
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#DDEFE8",
                    border: "1px solid #B9DED4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                  }}
                >
                  ⚖️
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Caseload Capacity &amp; Ethical Isolation
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Balance active casework across attorneys and paralegals while keeping internal legal strategies quarantined from the client portal.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
