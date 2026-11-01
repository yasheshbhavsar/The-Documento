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
    id: "us-eb1a",
    tabLabel: "EB-1A & O-1A (US)",
    status: "Available",
    title: "EB-1A & O-1A Extraordinary Ability",
    desc: "10-criteria statutory matrix, Kazarian two-stage evaluation, citation extraction, and Form I-140/I-129 draft compilation.",
    fitScore: "100% Codified Statutory Fit",
    fitVerdict: "Eliminates 12+ hours of manual exhibit Bates-stamping, citation indexing, and Kazarian final merits analysis.",
    pillars: [
      { tag: "8 CFR § 204.5(h)", title: "Statutory Rules Engine", detail: "10-criteria scorecard mapped directly to published regulations." },
      { tag: "SHA-256", title: "Automated Exhibit Index", detail: "Sequential tabs (Exhibits A-1 to E-12) stamped with cryptographic hashes." },
      { tag: "RBAC", title: "Ethical Wall Isolation", detail: "Internal attorney work-product strictly quarantined from clients." },
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
      { tag: "Prongs I–III", title: "Dhanasar 3-Prong Matrix", detail: "Substantial merit, national importance, and waiver justification." },
      { tag: "Degrees", title: "Credential Verification", detail: "Foreign tertiary degree comparability and academic transcript auditing." },
      { tag: "Letters", title: "Support Letters Docket", detail: "Tracks stakeholder, industry, and academic reference letters against prongs." },
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
      { tag: "IRCC", title: "LICO & CRS Engine", detail: "Low Income Cut-Off family calculator and CRS points validation." },
      { tag: "XFA XML", title: "AcroForm XFA Parser", detail: "Zero manual data re-entry from IMM 5257e with field-level audit." },
      { tag: "SLA", title: "60-Day Post-ITA Countdown", detail: "Procedural deadline management with supervisor escalation alerts." },
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
      { tag: "UKVI Rule", title: "10-Document Limit Guardrail", detail: "Page-length and exhibit count constraints prevent rejections." },
      { tag: "Stage 1", title: "Endorsing Criteria", detail: "Evidentiary mapping for Tech Nation and UKRI criteria." },
      { tag: "Stage 2", title: "Dual-Stage Pipeline", detail: "Endorsement Stage 1 cleanly separated from Home Office Stage 2." },
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
      { tag: "H+ Check", title: "Anabin Database Matcher", detail: "Foreign tertiary degree comparability and H+ institution check." },
      { tag: "BAMF", title: "BAMF Salary Thresholds", detail: "Automated calculation for standard vs shortage occupation tiers." },
      { tag: "SHA-256", title: "Universal Vault Ready", detail: "Cryptographic SHA-256 exhibit storage immediately operational." },
    ],
  },
];

export function DocumentoInteractiveTools({ onOpenLogin }: DocumentoInteractiveToolsProps) {
  const [activePresetId, setActivePresetId] = useState<string>("us-eb1a");
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
          overflow: "hidden",
          padding: "88px 24px",
          scrollMarginTop: "80px",
          borderBottom: "1px solid rgba(13, 104, 102, 0.1)",
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
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 650,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#0D6866",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#169B77",
                }}
              />
              <span>Case Compatibility</span>
            </div>

            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 40px)",
                fontWeight: 700,
                color: "#063C3D",
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: 0,
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Is Documento right for your case?
            </h2>

            <p
              style={{
                fontSize: "15.5px",
                color: "#4F6360",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Purpose-built for immigration law firms handling complex petitions, evidentiary exhibits, and client coordination.
            </p>

            {/* Vertical Pathway List */}
            <div
              role="navigation"
              aria-label="Supported Pathways"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                marginTop: "6px",
                borderTop: "1px solid rgba(13, 104, 102, 0.12)",
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
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: isSelected ? "#EAF5EF" : "transparent",
                      color: isSelected ? "#063C3D" : "#526663",
                      border: "none",
                      fontSize: "13.5px",
                      fontWeight: isSelected ? 650 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{preset.tabLabel}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: preset.status === "Available" ? "#07594F" : "#8A5A10",
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
              border: "1px solid rgba(13, 104, 102, 0.14)",
              borderRadius: "18px",
              padding: "32px",
              boxShadow: "0 20px 50px -16px rgba(6, 60, 61, 0.05)",
            }}
          >
            {/* Status & Category */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 650,
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: activePreset.status === "Available" ? "#EAF5EF" : "#FEF7EA",
                  color: activePreset.status === "Available" ? "#07594F" : "#8A5A10",
                }}
              >
                {activePreset.status === "Available"
                  ? "Coverage Verified • Operational"
                  : "Expansion Pipeline • In Development"}
              </span>

              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#6E7F7C" }}>
                {activePreset.fitScore}
              </span>
            </div>

            <h3
              style={{
                fontSize: "24px",
                fontWeight: 650,
                color: "#063C3D",
                letterSpacing: "-0.02em",
                margin: "0 0 10px 0",
                lineHeight: 1.25,
              }}
            >
              {activePreset.title}
            </h3>

            <p
              style={{
                fontSize: "15px",
                color: "#526663",
                lineHeight: 1.6,
                margin: "0 0 24px 0",
              }}
            >
              {activePreset.desc}
            </p>

            {/* Law Firm Verdict Callout + Live Micro-UI Simulator */}
            <div
              style={{
                background: "#F6FAF8",
                border: "1px solid rgba(13, 104, 102, 0.14)",
                padding: "18px 20px",
                borderRadius: "14px",
                marginBottom: "24px",
                fontSize: "14px",
                color: "#063C3D",
                lineHeight: 1.55,
              }}
            >
              <div style={{ marginBottom: "14px" }}>
                <strong style={{ color: "#07594F" }}>Law Firm Verdict:</strong> {activePreset.fitVerdict}
              </div>

              {/* Interactive Micro-UI: Exhibit Volume & Time-Savings Simulator */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(13, 104, 102, 0.12)",
                  borderRadius: "10px",
                  padding: "10px 16px",
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
                      fontSize: "12px",
                      fontWeight: 650,
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
                    fontWeight: 650,
                    color: "#07594F",
                    background: "#EAF5EF",
                    borderRadius: "999px",
                    padding: "4px 12px",
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
                    background: "#FAFCFB",
                    border: "1px solid rgba(13, 104, 102, 0.12)",
                    borderRadius: "12px",
                    padding: "18px",
                  }}
                >
                  <div style={{ marginBottom: "10px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 650,
                        color: "#0D6866",
                        background: "#EAF5EF",
                        padding: "3px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {pillar.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: "14.5px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
                    {pillar.title}
                  </div>
                  <div style={{ fontSize: "13px", color: "#526663", lineHeight: 1.5 }}>
                    {pillar.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Button & Disclaimer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <button
                type="button"
                onClick={() => onOpenLogin("firm")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#07594F",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
              >
                {activePreset.status === "Available"
                  ? "Access Workspace for this Pathway →"
                  : "Join Jurisdiction Waitlist →"}
              </button>

              <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
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
          overflow: "hidden",
          padding: "88px 24px",
          scrollMarginTop: "80px",
          borderBottom: "1px solid rgba(13, 104, 102, 0.1)",
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
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 650,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#0D6866",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#169B77",
                }}
              />
              <span>Dedicated Experiences</span>
            </div>

            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 40px)",
                fontWeight: 700,
                color: "#063C3D",
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: 0,
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Built for applicants and legal teams alike.
            </h2>

            <p
              style={{
                fontSize: "15.5px",
                color: "#4F6360",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Immigration case management works only when both sides have clarity. Explore how Documento tailors tools for retained applicants and practicing immigration professionals.
            </p>

            {/* Persona Toggle */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "6px",
                borderTop: "1px solid rgba(13, 104, 102, 0.12)",
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
                  padding: "11px 14px",
                  borderRadius: "8px",
                  background: activePersonaTab === "applicant" ? "#EAF5EF" : "transparent",
                  color: activePersonaTab === "applicant" ? "#063C3D" : "#526663",
                  border: "none",
                  fontSize: "13.5px",
                  fontWeight: activePersonaTab === "applicant" ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>For Retained Applicants</span>
                <span style={{ fontSize: "12px", color: "#0D6866" }}>→</span>
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
                  padding: "11px 14px",
                  borderRadius: "8px",
                  background: activePersonaTab === "lawfirm" ? "#EAF5EF" : "transparent",
                  color: activePersonaTab === "lawfirm" ? "#063C3D" : "#526663",
                  border: "none",
                  fontSize: "13.5px",
                  fontWeight: activePersonaTab === "lawfirm" ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>For Legal Teams &amp; Law Firms</span>
                <span style={{ fontSize: "12px", color: "#0D6866" }}>→</span>
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
                    border: "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
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
                    <h3 style={{ fontSize: "17.5px", fontWeight: 650, color: "#063C3D", margin: "0 0 6px 0" }}>
                      Know Exactly What Documents Are Needed
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#526663", lineHeight: 1.6, margin: 0 }}>
                      Receive structured checklists with sample templates and file guidelines so you upload the right paperwork the first time.
                    </p>
                  </div>
                </div>

                {/* Applicant Row 2 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
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
                      <h3 style={{ fontSize: "17.5px", fontWeight: 650, color: "#063C3D", margin: 0 }}>
                        Clear Waiting-State Transparency
                      </h3>
                      <button
                        type="button"
                        onClick={() => setWaitingDemoState((prev) => (prev === "firm" ? "applicant" : "firm"))}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border: "none",
                          background: waitingDemoState === "firm" ? "#EAF5EF" : "#FEF7EA",
                          color: waitingDemoState === "firm" ? "#07594F" : "#8A5A10",
                          fontSize: "11.5px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        {waitingDemoState === "firm"
                          ? "Status: With Legal Team"
                          : "Status: Action Needed by Applicant"}
                      </button>
                    </div>
                    <p style={{ fontSize: "14.5px", color: "#526663", lineHeight: 1.6, margin: 0 }}>
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
                    border: "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
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
                    <h3 style={{ fontSize: "17.5px", fontWeight: 650, color: "#063C3D", margin: "0 0 6px 0" }}>
                      Private &amp; Secure Direct Uploads
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#526663", lineHeight: 1.6, margin: 0 }}>
                      Upload sensitive identity documents straight to a private, encrypted vault with cryptographic audit protection.
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
                    border: "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
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
                    <h3 style={{ fontSize: "17.5px", fontWeight: 650, color: "#063C3D", margin: "0 0 6px 0" }}>
                      Automated Evidence Cross-Examination
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#526663", lineHeight: 1.6, margin: 0 }}>
                      Cross-verify dates, entity spellings, and biographic facts across exhibits automatically to catch conflicting details early.
                    </p>
                  </div>
                </div>

                {/* Law Firm Row 2 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
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
                    <h3 style={{ fontSize: "17.5px", fontWeight: 650, color: "#063C3D", margin: "0 0 6px 0" }}>
                      Deterministic Exhibit Index &amp; Assembly
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#526663", lineHeight: 1.6, margin: 0 }}>
                      Generate sequential exhibit tabs, tables of contents, and filing packages deterministically without manual PDF merging.
                    </p>
                  </div>
                </div>

                {/* Law Firm Row 3 */}
                <div
                  className="hover-lift spotlight-card"
                  style={{
                    padding: "24px 28px",
                    background: "#FFFFFF",
                    border: "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      color: "#07594F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 650, color: "#063C3D", margin: "0 0 6px 0" }}>
                      Strict Ethical Wall &amp; RBAC Control
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#526663", lineHeight: 1.6, margin: 0 }}>
                      Isolate internal supervisory attorney work product, legal strategy memos, and private partner notes from client portal access.
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
