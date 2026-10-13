"use client";

import React, { useState } from "react";

interface WorkflowStage {
  step: string;
  id: string;
  title: string;
  shortSummary: string;
  purpose: string;
  frictionAddressed: string;
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
    frictionAddressed: "Scattered introductory emails, uncoordinated intake forms, and duplicated client records.",
    documentoFunctionality: [
      "Multi-lingual guided questionnaire for applicants and dependants",
      "Automatic duplicate-record detection across historical firm archives",
      "Role-based assignment to supervising partner and primary paralegal",
      "Initial biographic record verification with passport name validation",
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
    frictionAddressed: "Vague checklists that leave applicants guessing which exhibits establish threshold eligibility.",
    documentoFunctionality: [
      "Versioned declarative rule sets linked to official USCIS policy manual editions",
      "Dynamic criteria scorecard showing satisfied vs needed evidentiary categories",
      "Dhanasar 3-prong matrix organizer for National Interest Waiver petitions",
      "Kazarian two-stage analysis framework for final merits evaluation",
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
    frictionAddressed: "Lost file attachments, unencrypted emails, blurry scans, and untracked document revisions.",
    documentoFunctionality: [
      "Direct client upload interface supporting mobile photos and high-res PDFs",
      "Cryptographic SHA-256 Merkle root hashing on every uploaded file",
      "Automated optical extraction of vital dates, names, and biographic entities",
      "Automatic exhibit classification into identity, academic, and support letter tiers",
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
    frictionAddressed: "Avoidable Requests for Evidence (RFEs) triggered by conflicting dates across CVs and employer letters.",
    documentoFunctionality: [
      "Cross-exhibit anomaly engine comparing dates and entity titles across files",
      "Discrepancy adjudication desk: attorneys resolve, dismiss, or escalate",
      "Source exhibit coordinate anchors linking findings to exact page locations",
      "Accountable human oversight: AI suggestions never alter files autonomously",
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
    frictionAddressed: "Status anxiety, repetitive 'any updates?' emails, and uncoordinated task handoffs.",
    documentoFunctionality: [
      "Dual waiting-state indicator ('Waiting on You' vs 'Waiting on Firm')",
      "Structured document requests with translation and notary instructions",
      "Assigned task docket with priority deadlines and automated reminders",
      "Strict multi-tenant security quarantining confidential attorney notes",
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
    frictionAddressed: "Hours wasted manually indexing exhibit tabs, numbering pages, and cross-checking checklists.",
    documentoFunctionality: [
      "Automated sequential exhibit tab generator (Exhibits A-1 through E-12)",
      "Comprehensive exhibit index and table of authorities compiler",
      "Pre-populated petition forms (e.g. Form I-140 / Form I-129) from verified exhibits",
      "Supervisory managing attorney sign-off with permanent audit trail",
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
        background: "#F8F7F2",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Section Header */}
        <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "820px", margin: "0 auto 48px auto" }}>
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
            <span>The 6-Stage Casework Journey</span>
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
            From overwhelming paperwork to an organized process.
          </h2>

          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Every stage in Documento replaces administrative friction with transparent milestones, deterministic checklists, and strict attorney accountability.
          </p>
        </div>

        {/* 6-Stage Interactive Stepper Header Bar */}
        <div
          className="animate-on-scroll delay-100"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "10px",
            marginBottom: "32px",
          }}
        >
          {WORKFLOW_STAGES.map((item, idx) => {
            const isSelected = item.id === activeStepId;
            const isPast = idx < activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveStepId(item.id)}
                style={{
                  background: isSelected ? "#063C3D" : isPast ? "#EAF6F0" : "#FFFFFF",
                  border: "1px solid",
                  borderColor: isSelected ? "#063C3D" : isPast ? "#B9DED4" : "#DCE5E1",
                  borderRadius: "12px",
                  padding: "14px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 4px 14px rgba(6, 60, 61, 0.18)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 750,
                      color: isSelected ? "#B9DED4" : isPast ? "#176B50" : "#6E7F7C",
                    }}
                  >
                    Stage {item.step}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: isSelected ? "#FFFFFF" : isPast ? "#176B50" : "#CBD5E1",
                    }}
                  >
                    {isPast ? "✓" : isSelected ? "●" : "○"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
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

        {/* Deep Dive Interactive Stage Detail Card */}
        <div
          className="animate-on-scroll delay-150"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "16px",
            boxShadow: "0 8px 30px rgba(6, 60, 61, 0.06)",
            padding: "36px 32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: "36px",
            alignItems: "center",
          }}
        >
          {/* Left Column: Stage Purpose, Friction Addressed & Capabilities */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span
                style={{
                  background: "#DDEFE8",
                  color: "#063C3D",
                  fontSize: "12px",
                  fontWeight: 750,
                  padding: "4px 10px",
                  borderRadius: "6px",
                }}
              >
                Stage {activeStage.step} of 06
              </span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0D6866" }}>
                {activeStage.title}
              </span>
            </div>

            <h3
              style={{
                fontSize: "24px",
                fontWeight: 750,
                color: "#063C3D",
                margin: "0 0 14px 0",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              {activeStage.shortSummary}
            </h3>

            {/* Purpose */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", marginBottom: "4px" }}>
                Stage Purpose
              </div>
              <p style={{ fontSize: "14px", color: "#172322", lineHeight: 1.55, margin: 0 }}>
                {activeStage.purpose}
              </p>
            </div>

            {/* Friction Addressed */}
            <div
              style={{
                background: "#FFFBFB",
                border: "1px solid #F5D3D1",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#B42318", marginBottom: "4px" }}>
                Friction Addressed &amp; Eliminated:
              </div>
              <div style={{ fontSize: "13px", color: "#5F3735", lineHeight: 1.5 }}>
                {activeStage.frictionAddressed}
              </div>
            </div>

            {/* Documento Built-in Features */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", marginBottom: "10px" }}>
                Documento Functionality Applied:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeStage.documentoFunctionality.map((feat, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#445451" }}>
                    <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Mockup / Visual State Demonstration */}
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span
                style={{
                  background: "#EAF6F0",
                  color: "#176B50",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "12px",
                }}
              >
                {activeStage.samplePreview.badge}
              </span>
              <span style={{ fontSize: "11px", color: "#6E7F7C" }}>Illustrative Data</span>
            </div>

            <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", marginBottom: "14px" }}>
              {activeStage.samplePreview.headline}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {activeStage.samplePreview.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E7EFEB",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "13px",
                    color: "#063C3D",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0D6866" }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Stepper Navigation Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #DCE5E1", paddingTop: "14px" }}>
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => setActiveStepId(WORKFLOW_STAGES[activeIndex - 1].id)}
                style={{
                  background: "transparent",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: activeIndex === 0 ? "#CBD5E1" : "#445451",
                  cursor: activeIndex === 0 ? "not-allowed" : "pointer",
                }}
              >
                ← Previous Stage
              </button>

              <button
                type="button"
                disabled={activeIndex === WORKFLOW_STAGES.length - 1}
                onClick={() => setActiveStepId(WORKFLOW_STAGES[activeIndex + 1].id)}
                style={{
                  background: activeIndex === WORKFLOW_STAGES.length - 1 ? "#F1F6F4" : "#0D6866",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 650,
                  color: activeIndex === WORKFLOW_STAGES.length - 1 ? "#CBD5E1" : "#FFFFFF",
                  cursor: activeIndex === WORKFLOW_STAGES.length - 1 ? "not-allowed" : "pointer",
                }}
              >
                Next Stage →
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer Note */}
        <div
          style={{
            marginTop: "32px",
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
