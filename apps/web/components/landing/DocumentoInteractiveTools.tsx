"use client";

import React, { useState } from "react";
import { VERIFIED_PATHWAYS } from "./DocumentoCoverageExplorer";

interface DocumentoInteractiveToolsProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

export function DocumentoInteractiveTools({ onOpenLogin }: DocumentoInteractiveToolsProps) {
  // Tool 1: Guided "Is Documento right for my case?" State
  const [selectedCountry, setSelectedCountry] = useState<string>("US");
  const [selectedPathwayType, setSelectedPathwayType] = useState<string>("talent");
  const [selectedUserRole, setSelectedUserRole] = useState<"applicant" | "firm" | "corporate">("applicant");

  // Tool 2: Persona benefits switcher State
  const [activePersonaTab, setActivePersonaTab] = useState<"applicant" | "lawfirm">("applicant");

  // Determine suitability assessment
  const matchedCoverage = (() => {
    if (selectedCountry === "US") {
      if (selectedPathwayType === "talent") {
        return {
          status: "Available",
          title: "EB-1A & O-1A Extraordinary Ability",
          desc: "Fully operational. 10-criteria statutory matrix, Kazarian two-stage evaluation, citation extraction, and Form I-140/I-129 draft compilation.",
          pathwayId: "us-eb1a",
        };
      }
      if (selectedPathwayType === "residence") {
        return {
          status: "Available",
          title: "EB-2 National Interest Waiver (NIW)",
          desc: "Fully operational. Dhanasar 3-prong endeavor matrix, advanced degree credential verification, and government interest support evidence tracking.",
          pathwayId: "us-eb2-niw",
        };
      }
      if (selectedPathwayType === "transfer") {
        return {
          status: "Available",
          title: "L-1A Intracompany Transferee Executive/Manager",
          desc: "Fully operational. Corporate relationship hierarchy mapping, continuous foreign employment audit, and managerial duty verification.",
          pathwayId: "us-l1a",
        };
      }
    } else if (selectedCountry === "UK") {
      if (selectedPathwayType === "talent" || selectedPathwayType === "residence") {
        return {
          status: "Available",
          title: "UK Global Talent Visa (Tech Nation & Sciences)",
          desc: "Fully operational. Stage 1 endorsement dossier builder, 10-document evidentiary limit enforcement, and reference letter audit tools.",
          pathwayId: "uk-gtv",
        };
      }
    } else if (selectedCountry === "CA") {
      return {
        status: "Available",
        title: "Canada Express Entry (FSWP & PNP)",
        desc: "Fully operational. CRS point evaluation, NOC/TEER classification validation, and post-ITA 60-day evidentiary clock countdown.",
        pathwayId: "ca-ee",
      };
    } else if (selectedCountry === "AU") {
      return {
        status: "Planned",
        title: "Australia Global Talent Visa (Subclass 858)",
        desc: "Roadmap Scope. Expression of Interest (EOI) target sector criteria tagging and FWHIT financial threshold monitoring under development.",
        pathwayId: "au-gti",
      };
    } else if (selectedCountry === "DE") {
      return {
        status: "Planned",
        title: "Germany EU Blue Card & Chancenkarte",
        desc: "Roadmap Scope. BAMF minimum salary threshold validation, Anabin comparability checks, and points-based Opportunity Card simulator.",
        pathwayId: "de-bluecard",
      };
    }

    return {
      status: "Needs Confirmation",
      title: "Custom Case or Unlisted Category",
      desc: "Documento's core document vault, task tracking, and client messaging operate across general case files, but automated statutory rule evaluation for this specific category is not yet verified in our rule registry.",
      pathwayId: null,
    };
  })();

  return (
    <div style={{ background: "#FFFFFF" }}>
      {/* SECTION 1: Guided Selector - "Is Documento right for my case?" */}
      <section
        id="pathway-finder"
        style={{
          padding: "80px 24px",
          borderBottom: "1px solid #DCE5E1",
          background: "linear-gradient(180deg, #FFFFFF 0%, #F8F7F2 100%)",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {/* Header */}
          <div style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 40px auto" }}>
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
              <span>Interactive Guided Matcher</span>
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
              Is Documento right for your case?
            </h2>

            <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
              Select your destination, pathway focus, and role to check whether your immigration category is verified and operational in Documento. We do not collect private case data.
            </p>
          </div>

          {/* Guided Wizard Container */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #DCE5E1",
              boxShadow: "0 8px 32px rgba(6, 60, 61, 0.06)",
              padding: "36px 32px",
            }}
          >
            {/* Step 1: Destination Country */}
            <div style={{ marginBottom: "28px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#063C3D",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: "12px",
                }}
              >
                1. Select Destination Jurisdiction:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                {[
                  { id: "US", flag: "🇺🇸", name: "United States (USCIS)" },
                  { id: "UK", flag: "🇬🇧", name: "United Kingdom (UKVI)" },
                  { id: "CA", flag: "🇨🇦", name: "Canada (IRCC)" },
                  { id: "AU", flag: "🇦🇺", name: "Australia (Planned)" },
                  { id: "DE", flag: "🇩🇪", name: "Germany (Planned)" },
                  { id: "OTHER", flag: "🌐", name: "Other Jurisdiction" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCountry(item.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid",
                      borderColor: selectedCountry === item.id ? "#0D6866" : "#DCE5E1",
                      background: selectedCountry === item.id ? "#F1F6F4" : "#FFFFFF",
                      color: selectedCountry === item.id ? "#063C3D" : "#445451",
                      fontSize: "13px",
                      fontWeight: selectedCountry === item.id ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>{item.flag}</span>
                    <span style={{ textAlign: "left" }}>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Broad Pathway Category */}
            <div style={{ marginBottom: "28px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#063C3D",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: "12px",
                }}
              >
                2. Select Pathway Category:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                {[
                  { id: "talent", label: "Extraordinary Talent & High Skilled", hint: "EB-1A, O-1A, UK Global Talent" },
                  { id: "residence", label: "Permanent Residence / National Interest", hint: "EB-2 NIW, Canada Express Entry" },
                  { id: "transfer", label: "Multinational Corporate Transfer", hint: "L-1A Executive / Manager" },
                  { id: "other", label: "Other Employment or Family Category", hint: "Custom or non-statutory petition" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPathwayType(p.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid",
                      borderColor: selectedPathwayType === p.id ? "#0D6866" : "#DCE5E1",
                      background: selectedPathwayType === p.id ? "#F1F6F4" : "#FFFFFF",
                      color: "#063C3D",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: selectedPathwayType === p.id ? 700 : 600 }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
                      {p.hint}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: User Role */}
            <div style={{ marginBottom: "32px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#063C3D",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: "12px",
                }}
              >
                3. What describes your role?
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {[
                  { id: "applicant", label: "Retained Applicant / Beneficiary", icon: "👤" },
                  { id: "firm", label: "Law Firm Attorney / Paralegal", icon: "⚖️" },
                  { id: "corporate", label: "Corporate Mobility / HR Sponsor", icon: "🏢" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedUserRole(r.id as any)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: selectedUserRole === r.id ? "#063C3D" : "#DCE5E1",
                      background: selectedUserRole === r.id ? "#063C3D" : "#FFFFFF",
                      color: selectedUserRole === r.id ? "#FFFFFF" : "#445451",
                      fontSize: "13px",
                      fontWeight: selectedUserRole === r.id ? 650 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Match Result Display Card */}
            <div
              style={{
                borderRadius: "14px",
                border: "1px solid",
                borderColor:
                  matchedCoverage.status === "Available"
                    ? "#B9DED4"
                    : matchedCoverage.status === "Planned"
                    ? "#F6D8A6"
                    : "#DCE5E1",
                background:
                  matchedCoverage.status === "Available"
                    ? "#F8FDFB"
                    : matchedCoverage.status === "Planned"
                    ? "#FFFDF8"
                    : "#F8F7F2",
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>
                    {matchedCoverage.status === "Available" ? "✅" : matchedCoverage.status === "Planned" ? "⏳" : "ℹ️"}
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                    {matchedCoverage.title}
                  </span>
                </div>

                {matchedCoverage.status === "Available" && (
                  <span style={{ background: "#EAF6F0", color: "#176B50", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700 }}>
                    Coverage Verified • Operational
                  </span>
                )}
                {matchedCoverage.status === "Planned" && (
                  <span style={{ background: "#FEF7EA", color: "#8A5A10", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700 }}>
                    Expansion Pipeline • In Development
                  </span>
                )}
                {matchedCoverage.status === "Needs Confirmation" && (
                  <span style={{ background: "#E7EFEB", color: "#445451", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700 }}>
                    Requires Confirmation
                  </span>
                )}
              </div>

              <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.6, margin: "0 0 18px 0" }}>
                {matchedCoverage.desc}
              </p>

              {/* Role tailored hint */}
              <div
                style={{
                  fontSize: "13px",
                  color: "#063C3D",
                  background: "#FFFFFF",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  marginBottom: "20px",
                }}
              >
                {selectedUserRole === "applicant" && (
                  <span>
                    <strong>Applicant Experience:</strong> You receive an invite from your legal team with an interactive checklist, upload your evidence via mobile or desktop, and see transparent status indicators at each step.
                  </span>
                )}
                {selectedUserRole === "firm" && (
                  <span>
                    <strong>Law Firm Experience:</strong> Your attorneys and paralegals gain an automated exhibit docket, cross-document timeline verification, and declarative statutory evaluation rules.
                  </span>
                )}
                {selectedUserRole === "corporate" && (
                  <span>
                    <strong>Corporate Mobility Experience:</strong> Real-time visibility into employee immigration filings, petition status updates, and milestone timelines without manual email check-ins.
                  </span>
                )}
              </div>

              {/* Call to action */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {matchedCoverage.status === "Available" ? (
                  <button
                    type="button"
                    onClick={() => onOpenLogin(selectedUserRole === "applicant" ? "client" : "firm")}
                    style={{
                      background: "#0D6866",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 650,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(13, 104, 102, 0.25)",
                    }}
                  >
                    Access Workspace for this Pathway →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenLogin("firm")}
                    style={{
                      background: "#063C3D",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    Request Early Access / Consult Legal Ops →
                  </button>
                )}

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
          <div style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 40px auto" }}>
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
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                gap: "24px",
              }}
            >
              {/* Card 1 */}
              <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "14px", padding: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>📋</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Know Exactly What Documents Are Needed
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  No more vague email requests. Receive structured checklists with sample templates, resolution guidelines, and accepted translation rules so you upload the right document the first time.
                </p>
              </div>

              {/* Card 2 */}
              <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "14px", padding: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>⏳</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Clear Waiting-State Transparency
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Always know where your case stands. The dual waiting-state indicator shows whether the firm is drafting your legal petition or whether they are waiting on a specific document from you.
                </p>
              </div>

              {/* Card 3 */}
              <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "14px", padding: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>🔒</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Private &amp; Secure Direct Uploads
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Upload passports, tax transcripts, and degrees straight to an encrypted vault. Every file is stamped with SHA-256 verification so nothing is lost, altered, or exposed in unencrypted emails.
                </p>
              </div>
            </div>
          )}

          {activePersonaTab === "lawfirm" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                gap: "24px",
              }}
            >
              {/* Card 1 */}
              <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "14px", padding: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>🔍</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Automated Evidence Cross-Examination
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Cross-verify employment dates, entity spellings, and biographic facts across all exhibits automatically. Catch conflicting statements before submitting petitions to USCIS or IRCC.
                </p>
              </div>

              {/* Card 2 */}
              <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "14px", padding: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>📑</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Deterministic Exhibit Index &amp; Assembly
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Generate clean exhibit tables of contents, sequential exhibit tab stamps (Exhibits A-1 through E-12), and complete filing-ready dossiers in minutes instead of billing hours on manual PDF merging.
                </p>
              </div>

              {/* Card 3 */}
              <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "14px", padding: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>⚖️</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: "0 0 10px 0" }}>
                  Caseload Capacity &amp; Ethical Isolation
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  Balance active casework across managing partners, associate counsel, and paralegals. Internal legal strategies and confidential notes are strictly quarantined from the client portal view.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
