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
    <div>
      {/* SECTION 1: Case Matcher - "Is Documento right for your case?" */}
      <section
        id="pathway-finder"
        style={{
          padding: "96px 24px",
          scrollMarginTop: "80px",
          background: "transparent",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "48px 56px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: ~1/3 (Intro & Pathway Selector) */}
          <div
            className="animate-on-scroll tools-col-left"
            style={{
              gridColumn: "span 4",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "sticky",
              top: "100px",
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 650,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#07594F",
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

            {/* Heading */}
            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 42px)",
                fontWeight: 700,
                color: "#073D40",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                margin: 0,
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Is Documento right for your case?
            </h2>

            {/* Subheading */}
            <p
              style={{
                fontSize: "15.5px",
                color: "#5D6E7F",
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
                marginTop: "8px",
                borderTop: "1px solid #DCE7E3",
                paddingTop: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 650,
                  color: "#7B8E8B",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "6px",
                }}
              >
                Select Casework Category
              </div>

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
                      padding: "9px 12px",
                      borderRadius: "6px",
                      background: isSelected ? "#EAF5EF" : "transparent",
                      color: isSelected ? "#073D40" : "#5D6E7F",
                      border: "none",
                      borderLeft: isSelected ? "3px solid #169B77" : "3px solid transparent",
                      fontSize: "13.5px",
                      fontWeight: isSelected ? 650 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "rgba(234, 245, 239, 0.45)";
                        e.currentTarget.style.color = "#073D40";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#5D6E7F";
                      }
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
            className="animate-on-scroll delay-150 tools-col-right"
            style={{
              gridColumn: "span 8",
              minWidth: 0,
              borderTop: "1px solid #DCE7E3",
              paddingTop: "24px",
            }}
          >
            {/* Status & Category */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 650,
                  padding: "3px 10px",
                  borderRadius: "12px",
                  background: activePreset.status === "Available" ? "#EAF5EF" : "#FEF7EA",
                  color: activePreset.status === "Available" ? "#07594F" : "#8A5A10",
                  border: `1px solid ${activePreset.status === "Available" ? "#DCE7E3" : "#F3DFB0"}`,
                }}
              >
                {activePreset.status === "Available"
                  ? "Coverage Verified • Operational"
                  : "Expansion Pipeline • In Development"}
              </span>

              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#7B8E8B" }}>
                {activePreset.fitScore}
              </span>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#073D40",
                margin: "0 0 10px 0",
                lineHeight: 1.25,
              }}
            >
              {activePreset.title}
            </h3>

            {/* Description */}
            <p
              style={{
                fontSize: "15px",
                color: "#5D6E7F",
                lineHeight: 1.6,
                margin: "0 0 20px 0",
              }}
            >
              {activePreset.desc}
            </p>

            {/* Law Firm Verdict Callout */}
            <div
              style={{
                background: "#EAF5EF",
                border: "1px solid #DCE7E3",
                borderLeft: "3px solid #169B77",
                padding: "14px 18px",
                borderRadius: "0 8px 8px 0",
                marginBottom: "24px",
                fontSize: "14px",
                color: "#073D40",
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "#07594F" }}>Law Firm Verdict:</strong> {activePreset.fitVerdict}
            </div>

            {/* 3 Pillars */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                marginBottom: "28px",
              }}
            >
              {activePreset.pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE7E3",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "8px" }}>{pillar.icon}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#073D40", marginBottom: "4px" }}>
                    {pillar.title}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#5D6E7F", lineHeight: 1.5 }}>
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
                  padding: "12px 22px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#07594F",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 650,
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#05413A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#07594F")}
              >
                {activePreset.status === "Available"
                  ? "Access Workspace for this Pathway →"
                  : "Join Jurisdiction Waitlist →"}
              </button>

              <span style={{ fontSize: "12px", color: "#7B8E8B" }}>
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
          padding: "88px 24px",
          scrollMarginTop: "80px",
          borderBottom: "1px solid #DCE7E3",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "48px 56px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: ~1/3 */}
          <div
            className="animate-on-scroll tools-col-left"
            style={{
              gridColumn: "span 4",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
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
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#07594F",
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
                fontSize: "clamp(28px, 3.2vw, 42px)",
                fontWeight: 700,
                color: "#073D40",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                margin: 0,
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Built for applicants and legal teams alike.
            </h2>

            <p
              style={{
                fontSize: "15.5px",
                color: "#5D6E7F",
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
                marginTop: "8px",
                borderTop: "1px solid #DCE7E3",
                paddingTop: "14px",
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
                  padding: "10px 14px",
                  borderRadius: "6px",
                  background: activePersonaTab === "applicant" ? "#EAF5EF" : "transparent",
                  color: activePersonaTab === "applicant" ? "#073D40" : "#5D6E7F",
                  border: "none",
                  borderLeft: activePersonaTab === "applicant" ? "3px solid #169B77" : "3px solid transparent",
                  fontSize: "13.5px",
                  fontWeight: activePersonaTab === "applicant" ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>For Retained Applicants</span>
                <span>👤</span>
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
                  padding: "10px 14px",
                  borderRadius: "6px",
                  background: activePersonaTab === "lawfirm" ? "#EAF5EF" : "transparent",
                  color: activePersonaTab === "lawfirm" ? "#073D40" : "#5D6E7F",
                  border: "none",
                  borderLeft: activePersonaTab === "lawfirm" ? "3px solid #169B77" : "3px solid transparent",
                  fontSize: "13.5px",
                  fontWeight: activePersonaTab === "lawfirm" ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>For Legal Teams &amp; Law Firms</span>
                <span>⚖️</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: ~2/3 (Persona Feature Rows) */}
          <div
            className="animate-on-scroll delay-150 tools-col-right"
            style={{
              gridColumn: "span 8",
              minWidth: 0,
              borderTop: "1px solid #DCE7E3",
            }}
          >
            {activePersonaTab === "applicant" ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Applicant Row 1 */}
                <div
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    📋
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 700, color: "#073D40", margin: "0 0 6px 0" }}>
                      Know Exactly What Documents Are Needed
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
                      Receive structured checklists with sample templates and file guidelines so you upload the right paperwork the first time.
                    </p>
                  </div>
                </div>

                {/* Applicant Row 2 */}
                <div
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    ⏳
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 700, color: "#073D40", margin: "0 0 6px 0" }}>
                      Clear Waiting-State Transparency
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
                      Always see who acts next—whether your legal team is preparing filings or waiting on a specific document from you.
                    </p>
                  </div>
                </div>

                {/* Applicant Row 3 */}
                <div
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    🔒
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 700, color: "#073D40", margin: "0 0 6px 0" }}>
                      Private &amp; Secure Direct Uploads
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
                      Upload sensitive identity documents straight to a private, encrypted vault with cryptographic audit protection.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Law Firm Row 1 */}
                <div
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    🔍
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 700, color: "#073D40", margin: "0 0 6px 0" }}>
                      Automated Evidence Cross-Examination
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
                      Cross-verify dates, entity spellings, and biographic facts across exhibits automatically to catch conflicting details early.
                    </p>
                  </div>
                </div>

                {/* Law Firm Row 2 */}
                <div
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    📑
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 700, color: "#073D40", margin: "0 0 6px 0" }}>
                      Deterministic Exhibit Index &amp; Assembly
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
                      Generate sequential exhibit tabs, tables of contents, and filing packages deterministically without manual PDF merging.
                    </p>
                  </div>
                </div>

                {/* Law Firm Row 3 */}
                <div
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    ⚖️
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17.5px", fontWeight: 700, color: "#073D40", margin: "0 0 6px 0" }}>
                      Strict Ethical Wall &amp; RBAC Control
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
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
