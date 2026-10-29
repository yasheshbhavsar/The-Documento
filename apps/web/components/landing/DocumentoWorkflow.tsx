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

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % WORKFLOW_STAGES.length;
    setActiveStepId(WORKFLOW_STAGES[nextIdx].id);
  };

  const handlePrev = () => {
    const prevIdx = (activeIndex - 1 + WORKFLOW_STAGES.length) % WORKFLOW_STAGES.length;
    setActiveStepId(WORKFLOW_STAGES[prevIdx].id);
  };

  return (
    <section
      id="workflow"
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
        {/* LEFT COLUMN: ~1/3 (Intro & Numbered Step Navigation) */}
        <div
          className="animate-on-scroll wf-col-left"
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
            <span>6-Stage Casework Journey</span>
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
            From overwhelming paperwork to an organized process.
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
            Every stage in Documento replaces administrative friction with transparent milestones, deterministic checklists, and strict attorney accountability.
          </p>

          {/* Vertical Numbered Step Selector */}
          <div
            role="tablist"
            aria-label="Workflow Stages"
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
              Casework Progression
            </div>

            {WORKFLOW_STAGES.map((s) => {
              const isSelected = s.id === activeStepId;
              return (
                <button
                  key={s.id}
                  role="tab"
                  id={`tab-step-${s.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-step-${s.id}`}
                  type="button"
                  onClick={() => setActiveStepId(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
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
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: isSelected ? "#07594F" : "#7B8E8B",
                    }}
                  >
                    {s.step}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Active Stage Explanation, Operations, & Preview) */}
        <div
          className="animate-on-scroll delay-150 wf-col-right"
          role="tabpanel"
          id={`panel-step-${activeStage.id}`}
          aria-labelledby={`tab-step-${activeStage.id}`}
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            borderTop: "1px solid #DCE7E3",
            paddingTop: "24px",
          }}
        >
          {/* Header Row: Stage count badge and Navigation Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#07594F",
                background: "#EAF5EF",
                border: "1px solid #DCE7E3",
                padding: "3px 10px",
                borderRadius: "12px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Stage {activeStage.step} of 06
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #DCE7E3",
                  background: "#FFFFFF",
                  color: "#07594F",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                ← Previous Stage
              </button>

              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#07594F",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Next Stage →
              </button>
            </div>
          </div>

          {/* Active Stage Heading & Short Summary */}
          <h3
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#073D40",
              margin: "0 0 8px 0",
              lineHeight: 1.25,
            }}
          >
            {activeStage.title}
          </h3>

          <p
            style={{
              fontSize: "16px",
              color: "#07594F",
              fontWeight: 600,
              margin: "0 0 16px 0",
              lineHeight: 1.5,
            }}
          >
            {activeStage.shortSummary}
          </p>

          <p
            style={{
              fontSize: "15px",
              color: "#5D6E7F",
              margin: "0 0 28px 0",
              lineHeight: 1.65,
            }}
          >
            {activeStage.purpose}
          </p>

          {/* Functionality List */}
          <div style={{ marginBottom: "28px" }}>
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#7B8E8B",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "12px",
              }}
            >
              Operational Capabilities in this Stage
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {activeStage.documentoFunctionality.map((func, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#FFFFFF",
                    border: "1px solid #DCE7E3",
                    fontSize: "14px",
                    color: "#073D40",
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      color: "#169B77",
                      fontWeight: 700,
                      marginTop: "1px",
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span>{func}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Preview Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE7E3",
              borderLeft: "3px solid #169B77",
              borderRadius: "8px",
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#07594F" }}>
                {activeStage.samplePreview.badge}
              </span>
              <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#7B8E8B" }}>
                Verified Casework State
              </span>
            </div>

            <div style={{ fontSize: "15px", fontWeight: 700, color: "#073D40", marginBottom: "10px" }}>
              {activeStage.samplePreview.headline}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {activeStage.samplePreview.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: "13px",
                    color: "#5D6E7F",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#169B77" }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .wf-col-left,
              .wf-col-right {
                grid-column: span 12 !important;
                position: static !important;
              }
            }
          `,
        }}
      />
    </section>
  );
}
