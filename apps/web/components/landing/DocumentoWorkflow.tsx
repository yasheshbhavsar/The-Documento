"use client";

import React, { useState } from "react";

interface WorkflowStage {
  step: string;
  id: string;
  title: string;
  shortSummary: string;
  purpose: string;
  documentoFunctionality: string[];
  samplePreview: {
    badge: string;
    headline: string;
    items: string[];
  };
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    step: "01",
    id: "intake",
    title: "Case Setup & Profile Intake",
    shortSummary: "Establish verified case records without messy email attachments.",
    purpose: "Create the primary case docket, configure petitioner and dependant profiles, and map target jurisdiction guidelines.",
    documentoFunctionality: [
      "Multi-lingual guided questionnaire for applicants and dependants",
      "Automatic duplicate-record detection across historical firm archives",
      "Role-based assignment to supervising partner and primary paralegal",
    ],
    samplePreview: {
      badge: "Stage 1 Active",
      headline: "Client Onboarding & Identity Registration",
      items: [
        "Applicant: Dr. Aris Thorne (PhD, Oxford)",
        "Jurisdiction: United States (USCIS EB-1A)",
        "Assigned: Eleanor Vance, Esq. (Lead Counsel)",
      ],
    },
  },
  {
    step: "02",
    id: "rules",
    title: "Requirements Mapping & Statutory Engine",
    shortSummary: "Evaluate case needs against versioned government criteria.",
    purpose: "Map the petition against authoritative statutory standards (e.g. 8 CFR § 204.5(h), Matter of Dhanasar, or UK Appendix Global Talent).",
    documentoFunctionality: [
      "Versioned declarative rule sets linked to official USCIS policy manual editions",
      "Dynamic criteria scorecard showing satisfied vs needed evidentiary categories",
      "Dhanasar 3-prong matrix organizer for National Interest Waiver petitions",
    ],
    samplePreview: {
      badge: "Statutory Check",
      headline: "Evidentiary Requirement Matrix",
      items: [
        "Criterion 1 (Scholarly Articles): 4 Papers Documented",
        "Criterion 2 (Original Contributions): Patent Verified",
        "Criterion 3 (Leading Role): MIT Group Head Verified",
      ],
    },
  },
  {
    step: "03",
    id: "vault",
    title: "Document Collection & OCR Vault",
    shortSummary: "Secure exhibit ingestion with immutable cryptographic hashing.",
    purpose: "Gather evidence directly from applicants with instant quality, format, and resolution validation.",
    documentoFunctionality: [
      "Direct client upload interface supporting mobile photos and high-res PDFs",
      "Cryptographic SHA-256 Merkle root hashing on every uploaded file",
      "Automated optical extraction of vital dates, names, and biographic entities",
    ],
    samplePreview: {
      badge: "Vault Ingested",
      headline: "Cryptographic Evidence Stamping",
      items: [
        "Exhibit A-1: Passport_Bio.pdf (SHA: e3b0c442...)",
        "Exhibit B-1: PhD_Diploma.pdf (SHA: cb8825fc...)",
        "Exhibit C-1: IEEE_Paper.pdf (SHA: 8f4a2109...)",
      ],
    },
  },
  {
    step: "04",
    id: "review",
    title: "Task & Anomaly Review (Human-in-the-Loop)",
    shortSummary: "Cross-examine facts across exhibits before petition drafting.",
    purpose: "Scan for chronological inconsistencies, typographical errors, and evidentiary contradictions.",
    documentoFunctionality: [
      "Cross-exhibit anomaly engine comparing dates and entity titles across files",
      "Discrepancy adjudication desk: attorneys resolve, dismiss, or escalate",
      "Source exhibit coordinate anchors linking findings to exact page locations",
    ],
    samplePreview: {
      badge: "Adjudication Desk",
      headline: "Cross-Document Discrepancy Flag",
      items: [
        "Flag: Employment start date (Sept 1 vs Oct 1, 2021)",
        "Source: Exhibit E-2 vs Exhibit E-1",
        "Action: Resolved by attorney with HR clarification addendum",
      ],
    },
  },
  {
    step: "05",
    id: "coordination",
    title: "Team Coordination & Client Messaging",
    shortSummary: "Unambiguous waiting states and transparent task ownership.",
    purpose: "Ensure both legal staff and applicants know exactly who holds the next action item.",
    documentoFunctionality: [
      "Dual waiting-state indicator ('Waiting on You' vs 'Waiting on Firm')",
      "Structured document requests with translation and notary instructions",
      "Assigned task docket with priority deadlines and automated reminders",
    ],
    samplePreview: {
      badge: "Active Alignment",
      headline: "Coordination & Milestone Clocks",
      items: [
        "Waiting on Firm: Supervising Attorney Brief Finalization",
        "Client Status: 0 Pending Requests",
        "Filing Clock: 32 Business Days to Target Submission",
      ],
    },
  },
  {
    step: "06",
    id: "assembly",
    title: "Filing Readiness & Package Assembly",
    shortSummary: "Deterministic bundle generation with sequential exhibit tabs.",
    purpose: "Compile indexed, submission-ready petition packages with full supervisory attorney approval.",
    documentoFunctionality: [
      "Automated sequential exhibit tab generator (Exhibits A-1 through E-12)",
      "Comprehensive exhibit index and table of authorities compiler",
      "Pre-populated petition forms from verified primary exhibits",
    ],
    samplePreview: {
      badge: "Bundle Assembled",
      headline: "Final Petition Dossier Verified",
      items: [
        "Form I-140 Petition: Verified & Attorney Authorized",
        "Exhibit Catalog: 6 Exhibits Indexed with SHA-256 Hashing",
        "Submission Status: Ready for USCIS Delivery",
      ],
    },
  },
];

export function DocumentoWorkflow() {
  const [activeStepId, setActiveStepId] = useState<string>("intake");

  const activeStage = WORKFLOW_STAGES.find((s) => s.id === activeStepId) || WORKFLOW_STAGES[0];
  const activeIndex = WORKFLOW_STAGES.findIndex((s) => s.id === activeStepId);

  return (
    <section
      id="workflow"
      style={{
        padding: "80px 24px",
        scrollMarginTop: "80px",
        background: "#F8F7F2",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        {/* Minimal Section Header */}
        <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 36px auto" }}>
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
              marginBottom: "14px",
            }}
          >
            <span>The 6-Stage Casework Journey</span>
          </div>

          <h2
            style={{
              fontSize: "clamp(26px, 3.6vw, 38px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              margin: "0 0 12px 0",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            From overwhelming paperwork to an organized process.
          </h2>

          <p style={{ fontSize: "15px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
            Every stage in Documento replaces administrative friction with transparent milestones, deterministic checklists, and strict attorney accountability.
          </p>
        </div>

        {/* 6-Stage Compact Step Navigator (Horizontal Grid on Desktop, Horizontal Scroll on Mobile) */}
        <div
          role="tablist"
          aria-label="Casework Journey Stages"
          className="flex md:grid md:grid-cols-6 gap-2 overflow-x-auto pb-2 mb-6"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          {WORKFLOW_STAGES.map((item, idx) => {
            const isSelected = item.id === activeStepId;
            const isPast = idx < activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`stage-tab-${item.id}`}
                aria-controls={`stage-panel-${item.id}`}
                aria-selected={isSelected}
                onClick={() => setActiveStepId(item.id)}
                className="flex-shrink-0 min-w-[190px] md:min-w-0"
                style={{
                  background: isSelected ? "#063C3D" : isPast ? "#F2F8F5" : "#FFFFFF",
                  border: "1px solid",
                  borderColor: isSelected ? "#063C3D" : isPast ? "#B9DED4" : "#DCE5E1",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 2px 8px rgba(6, 60, 61, 0.12)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: isSelected ? "#B9DED4" : isPast ? "#0D6866" : "#6E7F7C",
                      letterSpacing: "0.03em",
                    }}
                  >
                    STAGE {item.step}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: isSelected ? "#B9DED4" : isPast ? "#0D6866" : "#CBD5E1",
                    }}
                  >
                    {isPast ? "✓" : isSelected ? "●" : "○"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 650,
                    color: isSelected ? "#FFFFFF" : "#063C3D",
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Focused Active Stage Panel */}
        <div
          id={`stage-panel-${activeStage.id}`}
          role="tabpanel"
          aria-labelledby={`stage-tab-${activeStage.id}`}
          className="animate-on-scroll"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "14px",
            boxShadow: "0 2px 12px rgba(6, 60, 61, 0.04)",
            overflow: "hidden",
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              padding: "16px 24px",
              background: "#FAF9F5",
              borderBottom: "1px solid #DCE5E1",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  background: "#DDEFE8",
                  border: "1px solid #B9DED4",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#063C3D",
                }}
              >
                Stage {activeStage.step} of 06
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#063C3D",
                }}
              >
                {activeStage.title}
              </h3>
            </div>
            <div style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 500 }}>
              Casework Progression
            </div>
          </div>

          {/* Two-Column Stage Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-8">
            {/* Left: Purpose & Functionality (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h4
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: "0 0 12px 0",
                    lineHeight: 1.35,
                    fontFamily: "var(--font-display, Inter, sans-serif)",
                  }}
                >
                  {activeStage.shortSummary}
                </h4>

                {/* Short Purpose Statement */}
                <div style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#6E7F7C",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      marginBottom: "6px",
                    }}
                  >
                    Stage Purpose
                  </div>
                  <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
                    {activeStage.purpose}
                  </p>
                </div>

                {/* Up to 3 Concise Functionality Bullets */}
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#0D6866",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      marginBottom: "10px",
                    }}
                  >
                    Core Operational Capabilities
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                    {activeStage.documentoFunctionality.slice(0, 3).map((feat, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          fontSize: "13px",
                          color: "#172322",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: "#0D6866", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Stepper Navigation Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginTop: "28px",
                  paddingTop: "16px",
                  borderTop: "1px solid #DCE5E1",
                }}
              >
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveStepId(WORKFLOW_STAGES[activeIndex - 1].id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: activeIndex === 0 ? "#CBD5E1" : "#445451",
                    cursor: activeIndex === 0 ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  ← Previous Stage
                </button>

                <span style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 500 }}>
                  Stage {activeIndex + 1} of {WORKFLOW_STAGES.length}
                </span>

                <button
                  type="button"
                  disabled={activeIndex === WORKFLOW_STAGES.length - 1}
                  onClick={() => setActiveStepId(WORKFLOW_STAGES[activeIndex + 1].id)}
                  style={{
                    background: activeIndex === WORKFLOW_STAGES.length - 1 ? "#F1F6F4" : "#0D6866",
                    border: "none",
                    borderRadius: "6px",
                    padding: "7px 16px",
                    fontSize: "12px",
                    fontWeight: 650,
                    color: activeIndex === WORKFLOW_STAGES.length - 1 ? "#CBD5E1" : "#FFFFFF",
                    cursor: activeIndex === WORKFLOW_STAGES.length - 1 ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Next Stage →
                </button>
              </div>
            </div>

            {/* Right: Focused Sample Preview (5 cols) */}
            <div
              className="lg:col-span-5"
              style={{
                background: "#FAF9F5",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <span
                    style={{
                      background: "#DDEFE8",
                      border: "1px solid #B9DED4",
                      color: "#063C3D",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {activeStage.samplePreview.badge}
                  </span>
                  <span style={{ fontSize: "11px", color: "#6E7F7C" }}>Illustrative Data</span>
                </div>

                <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "12px" }}>
                  {activeStage.samplePreview.headline}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {activeStage.samplePreview.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E3EBE7",
                        borderRadius: "6px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        color: "#172322",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#0D6866",
                          flexShrink: 0,
                        }}
                      />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid #E3EBE7",
                  fontSize: "11px",
                  color: "#6E7F7C",
                  lineHeight: 1.4,
                }}
              >
                Demonstrates verified data artifacts recorded during Stage {activeStage.step}.
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer Note */}
        <div
          style={{
            marginTop: "28px",
            textAlign: "center",
            fontSize: "12px",
            color: "#6E7F7C",
          }}
        >
          Documento assists in organizing evidence and procedural tracking. The platform does not provide legal representation or guarantee immigration outcomes.
        </div>
      </div>
    </section>
  );
}
