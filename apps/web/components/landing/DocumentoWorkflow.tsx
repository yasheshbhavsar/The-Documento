"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

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
  challenge: {
    category: string;
    frictionTitle: string;
    traditionalPain: {
      heading: string;
      description: string;
      symptoms: string[];
    };
    documentoSolution: {
      heading: string;
      description: string;
      features: string[];
      practicalOutcome: string;
    };
  };
}

export const WORKFLOW_STAGES: WorkflowStage[] = [
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
    challenge: {
      category: "Evidence Management",
      frictionTitle: "Scattered Documents & Version Confusion",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Documents arrive across disjointed email threads, chat scans, and temporary links. Outdated passport scans get mixed with renewed ones.",
        symptoms: [
          "Unclear which version of a CV or employment letter is the final draft",
          "Low-resolution scans rejected by government filing specifications",
          "Lost attachments requiring repeated follow-up requests to the applicant",
          "Zero cryptographic record of what exact file was provided",
        ],
      },
      documentoSolution: {
        heading: "With Documento Vault",
        description: "Every exhibit is uploaded to a centralized, encrypted repository anchored by SHA-256 Merkle root hashing and automated quality checks.",
        features: [
          "Centralized document checklist showing missing vs verified items",
          "Automated resolution, format, and multi-page validation upon upload",
          "Immutable SHA-256 exhibit fingerprinting preventing accidental overwrites",
          "Automatic sequential exhibit tab labeling (Exhibits A-1 through E-12)",
        ],
        practicalOutcome: "Missing or low-quality paperwork is identified immediately, eliminating repeated requests and preventing unindexed exhibit chaos.",
      },
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
    challenge: {
      category: "Statutory Criteria",
      frictionTitle: "Unclear Requirements & Regulatory Guesswork",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Applicants and staff rely on generic checklists without understanding how specific evidence maps to strict statutory criteria.",
        symptoms: [
          "Guessing whether 3 of 10 EB-1A regulatory criteria are satisfied",
          "Confusion over whether a reference letter meets Matter of Dhanasar prongs",
          "Filing petitions with weak or non-qualifying evidentiary categories",
          "Receiving preventable Requests for Evidence (RFEs) from adjudicators",
        ],
      },
      documentoSolution: {
        heading: "With Documento Rule Engine",
        description: "Evidence is systematically evaluated against versioned government policy memorandums and declarative statutory rules with audit diffs.",
        features: [
          "Declarative requirement matrices mapping evidence directly to statutory prongs",
          "Dhanasar 3-prong matrix mapping endeavors to national importance standards",
          "Kazarian two-stage evaluation scorecard for supervising attorney review",
          "Clear status flags: Satisfied, Partially Supported, or Evidence Needed",
        ],
        practicalOutcome: "Replaces vague guesswork with an explicit requirement scorecard that clarifies evidentiary readiness before petition assembly.",
      },
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
    challenge: {
      category: "Timeline & Bottlenecks",
      frictionTitle: "Missed Filing Windows & Procedural Anxiety",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Applicants constantly wonder about the status of their case while law firm staff struggle to track which client is holding up a filing.",
        symptoms: [
          "Applicants calling or emailing repeatedly just to ask 'any updates?'",
          "Unclear who owns the next action item (applicant, paralegal, or attorney)",
          "Priority dates and response clocks tracked on fragmented spreadsheets",
          "Last-minute panic before statutory filing expirations or age-out cutoffs",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Transparent case pipelines with dual waiting-state indicators, procedural clocks, and unambiguous task ownership.",
        features: [
          "Dual Waiting-State: Instantly shows 'Waiting on You' vs 'Waiting on Firm'",
          "Automated procedural milestone tracking across every casework stage",
          "Assigned task lists with explicit priority ratings and due date alerts",
          "Filing deadline countdown watches with supervisory escalations",
        ],
        practicalOutcome: "Drastically reduces status anxiety by making task ownership transparent and ensuring filing deadlines are visible to all parties.",
      },
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
    challenge: {
      category: "Data Integrity",
      frictionTitle: "Duplicated Data Entry & Inconsistent Facts",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Manually retyping names, passport numbers, and dates into multiple government forms leads to avoidable typos and fatal contradictions.",
        symptoms: [
          "Employment start date on CV contradicts dates in employment support letter",
          "Spelling discrepancies between birth certificates and foreign passports",
          "Duplicate records created across firm intake databases",
          "Inconsistencies discovered only when an RFE or refusal notice is issued",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Automated OCR cross-compares dates, entity names, and biographic facts across all exhibits, flagging anomalies for attorney adjudication.",
        features: [
          "Biographic entity extraction anchored to exact source coordinates and pages",
          "Cross-exhibit anomaly detection highlighting date and timeline conflicts",
          "Human-in-the-loop adjudication desk: attorneys resolve, dismiss, or clarify",
          "Automated form pre-population from verified primary source exhibits",
        ],
        practicalOutcome: "Catches contradictory dates and typographical discrepancies early, giving the legal team time to obtain clarifying documentation.",
      },
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
    challenge: {
      category: "Team Coordination",
      frictionTitle: "Client-Firm Coordination Gaps & Email Overload",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Legal advice and administrative requests get tangled in messy email chains, with confidential internal deliberations accidentally exposed.",
        symptoms: [
          "Important document requests buried beneath routine billing emails",
          "Staff wasting hours re-explaining translation and notarization rules",
          "Staff turnover leaving cases without context or historical notes",
          "Lack of security controls for sensitive personal biographic records",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Role-separated workspaces where applicants receive structured requests and law firms maintain private internal legal strategies.",
        features: [
          "Dedicated applicant portal with mobile-friendly questionnaire intake",
          "Formal document request threads with statutory explanations and guidance",
          "Strict multi-tenant isolation keeping internal attorney notes confidential",
          "Comprehensive audit log recording every view, edit, and export event",
        ],
        practicalOutcome: "Streamlines communication into organized, case-linked channels while maintaining strict client-attorney confidentiality boundaries.",
      },
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
    challenge: {
      category: "Package Assembly",
      frictionTitle: "Unindexed Bundles & Last-Minute Scrambling",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Manually renumbering hundreds of pages, typing exhibit tables of contents, and double-checking government form field mappings hours before deadline.",
        symptoms: [
          "Misnumbered exhibit tabs confusing adjudicators and prompting RFEs",
          "Missing statutory certifications or signature dates on filing forms",
          "Chaotic physical or PDF assembly taking full days of paralegal time",
          "No tamper-evident audit receipt of the filed dossier contents",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Automated package assembly compiles verified primary sources into Bates-stamped, indexed dossiers with complete audit manifests.",
        features: [
          "One-click deterministic exhibit index compilation",
          "Automated PDF bookmarking and sequential pagination",
          "Supervising attorney sign-off and gatekeeping validation",
          "Complete SHA-256 digital provenance manifest included",
        ],
        practicalOutcome: "Eliminates assembly scrambling and ensures every petition arrives at government adjudication flawlessly indexed and structured.",
      },
    },
  },
];

export function DocumentoWorkflow() {
  const [activeStepId, setActiveStepId] = useState<string>("intake");
  const [selectedCapIdx, setSelectedCapIdx] = useState<number>(0);

  const activeStage = WORKFLOW_STAGES.find((s) => s.id === activeStepId) || WORKFLOW_STAGES[0];
  const activeIndex = WORKFLOW_STAGES.findIndex((s) => s.id === activeStepId);
  const stageProgressPct = Math.round(((activeIndex + 1) / WORKFLOW_STAGES.length) * 100);

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % WORKFLOW_STAGES.length;
    setActiveStepId(WORKFLOW_STAGES[nextIdx].id);
    setSelectedCapIdx(0);
  };

  const handlePrev = () => {
    const prevIdx = (activeIndex - 1 + WORKFLOW_STAGES.length) % WORKFLOW_STAGES.length;
    setActiveStepId(WORKFLOW_STAGES[prevIdx].id);
    setSelectedCapIdx(0);
  };

  return (
    <section
      id="workflow"
      className="relative w-full"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "88px 24px",
        scrollMarginTop: "80px",
        background: "#F8FAF9",
        borderBottom: "1px solid rgba(13, 104, 102, 0.1)",
      }}
    >
      <InteractiveSectionBackground variant="architectural-grid" />

      {/* Anchor for #comparison links */}
      <div id="comparison" style={{ position: "relative", top: "-80px", visibility: "hidden" }} />

      <div style={{ maxWidth: "1240px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Section Header */}
        <div
          className="section-header-reveal animate-on-scroll"
          data-motion="up"
          style={{ textAlign: "center", maxWidth: "720px", margin: "0 auto 40px auto" }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 650,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#0D6866",
              marginBottom: "12px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#169B77" }} className="status-dot-pulse" />
            <span>Six-Stage Casework Flow</span>
          </span>

          <h2
            style={{
              fontSize: "clamp(28px, 3.5vw, 42px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: "0 0 14px 0",
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
            }}
          >
            From overwhelming paperwork to an organized process.
          </h2>

          <p style={{ fontSize: "16px", color: "#4F6360", lineHeight: 1.6, margin: 0 }}>
            Every stage replaces administrative friction with transparent milestones, deterministic checklists, and attorney accountability.
          </p>
        </div>

        {/* Minimal Horizontal 6-Stage Selector Rail */}
        <div
          role="tablist"
          aria-label="Workflow Stages"
          className="animate-on-scroll spotlight-card"
          data-motion="scale"
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "6px",
            background: "#FFFFFF",
            padding: "8px",
            borderRadius: "16px",
            border: "1px solid rgba(13, 104, 102, 0.12)",
            marginBottom: "24px",
            boxShadow: "0 10px 30px -12px rgba(6, 60, 61, 0.05)",
            overflowX: "auto",
          }}
        >
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
                className="hover-lift"
                onClick={() => {
                  setActiveStepId(s.id);
                  setSelectedCapIdx(0);
                }}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "6px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: isSelected ? "#EAF5EF" : "transparent",
                  border: isSelected ? "1px solid rgba(13, 104, 102, 0.22)" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                  minWidth: "140px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 650,
                      color: isSelected ? "#07594F" : "#7B8E8B",
                    }}
                  >
                    Stage {s.step}
                  </span>
                  {isSelected && (
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#169B77" }} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: isSelected ? 650 : 500,
                    color: isSelected ? "#063C3D" : "#526663",
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Studio Panel */}
        <div
          role="tabpanel"
          id={`panel-step-${activeStage.id}`}
          aria-labelledby={`tab-step-${activeStage.id}`}
          className="animate-on-scroll spotlight-card"
          data-motion="scale"
          style={{
            background: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid rgba(13, 104, 102, 0.14)",
            boxShadow: "0 20px 50px -16px rgba(6, 60, 61, 0.06)",
            overflow: "hidden",
          }}
        >
          {/* Top Stage Bar */}
          <div
            style={{
              padding: "16px 28px",
              background: "#FAFCFB",
              borderBottom: "1px solid rgba(13, 104, 102, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 650,
                  color: "#07594F",
                  background: "#EAF5EF",
                  padding: "4px 10px",
                  borderRadius: "999px",
                }}
              >
                Stage {activeStage.step} of 06
              </span>
              <span style={{ fontSize: "15px", fontWeight: 650, color: "#063C3D" }}>
                {activeStage.title}
              </span>
            </div>

            {/* Stepper Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(13, 104, 102, 0.18)",
                  background: "#FFFFFF",
                  color: "#063C3D",
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
                  padding: "7px 16px",
                  borderRadius: "8px",
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

          {/* Smooth Animated Stage Progress Hairline */}
          <div style={{ width: "100%", height: "2px", background: "#EEF4F1" }}>
            <div
              style={{
                width: `${stageProgressPct}%`,
                height: "100%",
                background: "#169B77",
                transition: "width 450ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>

          {/* Main 2-Column Editorial Stage Layout */}
          <div
            style={{
              padding: "32px 28px",
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: "32px",
              alignItems: "start",
            }}
          >
            {/* Left Column (7 of 12): Stage Purpose & Clean Capabilities List */}
            <div
              style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "22px" }}
              className="wf-left-col"
            >
              <div>
                <h3
                  style={{
                    fontSize: "20px",
                    color: "#063C3D",
                    fontWeight: 650,
                    letterSpacing: "-0.02em",
                    margin: "0 0 8px 0",
                    lineHeight: 1.35,
                  }}
                >
                  {activeStage.shortSummary}
                </h3>
                <p style={{ fontSize: "14.5px", color: "#526663", margin: 0, lineHeight: 1.6 }}>
                  {activeStage.purpose}
                </p>
              </div>

              {/* Clean Capabilities List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeStage.documentoFunctionality.map((func, i) => {
                  const isCapActive = selectedCapIdx === i;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedCapIdx(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: isCapActive ? "#F3FAF7" : "#FAFCFB",
                        border: isCapActive ? "1px solid rgba(13, 104, 102, 0.24)" : "1px solid rgba(13, 104, 102, 0.08)",
                        fontSize: "13.5px",
                        color: "#063C3D",
                        lineHeight: 1.45,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: isCapActive ? "#0D6866" : "#EAF5EF",
                          color: isCapActive ? "#FFFFFF" : "#0D6866",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {/* taste-skill-ignore */}
                        ✓
                      </span>
                      <span style={{ fontWeight: isCapActive ? 600 : 450 }}>{func}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column (5 of 12): Minimal Before -> After & Live Artifact */}
            <div
              style={{
                gridColumn: "span 5",
                background: "#F8FBFA",
                border: "1px solid rgba(13, 104, 102, 0.12)",
                borderRadius: "14px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
              className="wf-right-col"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 650, color: "#0D6866" }}>
                  {activeStage.samplePreview.badge}
                </span>
                <span style={{ fontSize: "11.5px", color: "#6E7F7C" }}>
                  {activeStage.challenge.category}
                </span>
              </div>

              <div style={{ fontSize: "15.5px", fontWeight: 650, color: "#063C3D", lineHeight: 1.35 }}>
                {activeStage.samplePreview.headline}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "14px", borderBottom: "1px solid rgba(13, 104, 102, 0.1)" }}>
                {activeStage.samplePreview.items.map((item, idx) => (
                  <div key={idx} style={{ fontSize: "13px", color: "#526663", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#169B77", flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Clean Outcome Summary */}
              <div>
                <div style={{ fontSize: "11.5px", fontWeight: 650, color: "#07594F", marginBottom: "4px" }}>
                  {activeStage.challenge.documentoSolution.heading}
                </div>
                <p style={{ fontSize: "13px", color: "#063C3D", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  {activeStage.challenge.documentoSolution.practicalOutcome}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 900px) {
              .wf-left-col,
              .wf-right-col {
                grid-column: span 12 !important;
              }
            }
          `,
        }}
      />
    </section>
  );
}

export default DocumentoWorkflow;
