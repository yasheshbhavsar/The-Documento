"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

export interface WorkflowStage {
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
    shortSummary: "Establish verified Canadian case records without messy email or WhatsApp threads.",
    purpose: "Create the primary Canadian case docket, configure applicant, dependant, and Canadian host/sponsor profiles, and load the governing IRCC checklist.",
    documentoFunctionality: [
      "English, Gujarati, and Hindi guided intake questionnaires for applicants and dependants",
      "Privacy-shielded Canadian host & sponsor onboarding links for Super Visa and Family Class",
      "Role-based assignment to supervising RCIC or immigration lawyer and dedicated case manager",
    ],
    samplePreview: {
      badge: "Stage 1 Active",
      headline: "Client & Canadian Sponsor Onboarding",
      items: [
        "Applicant: Principal Applicant & Canadian Host (Verified Profile)",
        "Jurisdiction: Canada — IRCC (Express Entry / Super Visa / Study & Work)",
        "Assigned: Supervising RCIC / Immigration Counsel",
      ],
    },
    challenge: {
      category: "Evidence Management",
      frictionTitle: "Scattered Documents & Version Confusion",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Passports, CRA NOAs, and bank statements arrive across disjointed email threads, WhatsApp scans, and expiring links.",
        symptoms: [
          "Unclear which version of an employment reference letter or CRA NOA is the final copy",
          "Low-resolution scans rejected by IRCC portal size and legibility rules",
          "Lost attachments requiring repeated follow-up requests to applicants and Canadian sponsors",
          "Zero cryptographic record of what exact file was provided",
        ],
      },
      documentoSolution: {
        heading: "With Documento Vault",
        description: "Every Canadian exhibit is uploaded to a centralized, encrypted repository anchored by SHA-256 Merkle root hashing and automated quality checks.",
        features: [
          "Centralized IRCC document checklist showing missing vs verified items",
          "Automated resolution, format, and multi-page validation upon upload",
          "Immutable SHA-256 exhibit fingerprinting preventing accidental overwrites",
          "Automatic sequential exhibit tab labeling and 5-folder IRCC structuring",
        ],
        practicalOutcome: "Missing or low-quality paperwork is caught immediately, eliminating repeated client follow-ups and unindexed exhibit chaos.",
      },
    },
  },
  {
    step: "02",
    id: "rules",
    title: "Requirements Mapping & Statutory Engine",
    shortSummary: "Evaluate Canadian eligibility against versioned IRCC criteria and rules.",
    purpose: "Map each application against authoritative Canadian statutory standards (IRPA/IRPR, NOC 2021 TEER duties, Super Visa LICO tables, PAL rules, and CRS/PNP grids).",
    documentoFunctionality: [
      "Automated CRS score, Provincial Nominee (PNP), and Super Visa LICO household income checks",
      "NOC 2021 TEER lead-statement matching for Express Entry, SOWP, and LMIA work permits",
      "Study Permit DLI acceptance, Provincial Attestation Letter (PAL), and PGWP 180-day rule checks",
    ],
    samplePreview: {
      badge: "IRCC Statutory Check",
      headline: "Canadian Evidentiary Requirement Matrix",
      items: [
        "LICO / Funds Check: CRA NOA Line 15000 Exceeds Household Cutoff",
        "NOC 2021 Mapping: TEER 1 (21231) Duties Verified Against Reference Letter",
        "Eligibility Gate: PAL / IELTS CLB 9 / WES ECA Equivalency Cleared",
      ],
    },
    challenge: {
      category: "IRPA / IRPR Criteria",
      frictionTitle: "Unclear IRCC Requirements & Policy Guesswork",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Applicants and staff rely on outdated generic checklists without checking live LICO cutoffs, NOC 2021 TEER duties, or study cap PAL rules.",
        symptoms: [
          "Guessing whether host income meets the updated Super Visa LICO benchmark",
          "Submitting employer reference letters missing required NOC 2021 lead statements",
          "Missing Provincial Attestation Letter (PAL) or PGWP language eligibility rules",
          "Receiving preventable IRCC refusals or Procedural Fairness Letters (PFLs)",
        ],
      },
      documentoSolution: {
        heading: "With Documento Rule Engine",
        description: "Evidence is systematically evaluated against versioned IRPA/IRPR regulations, NOC 2021 definitions, and IRCC Ministerial Instructions.",
        features: [
          "Declarative requirement matrices mapping exhibits directly to IRCC criteria",
          "Automated LICO, CRS, PNP, and Study Permit living-cost threshold validation",
          "NOC 2021 TEER job-duty verification for supervising RCIC and counsel review",
          "Clear status flags: Satisfied, Partially Supported, or Evidence Needed",
        ],
        practicalOutcome: "Replaces policy guesswork with an explicit Canadian readiness scorecard before application assembly.",
      },
    },
  },
  {
    step: "03",
    id: "vault",
    title: "Document Collection & OCR Vault",
    shortSummary: "Secure exhibit ingestion with passport MRZ extraction and cryptographic hashing.",
    purpose: "Gather identity, financial, academic, and Canadian host records with instant OCR extraction and quality verification.",
    documentoFunctionality: [
      "ICAO & Indian passport MRZ extraction plus scanned PDF/image OCR parsing",
      "Automated CRA Notice of Assessment (NOA), GIC receipt, and $100k+ medical insurance inspection",
      "Cryptographic SHA-256 Merkle root hashing on every uploaded IRCC exhibit",
    ],
    samplePreview: {
      badge: "Vault Ingested",
      headline: "Cryptographic Canadian Evidence Stamping",
      items: [
        "Exhibit A-1: Passport_Bio_MRZ.pdf (SHA: e3b0c442...)",
        "Exhibit B-1: CRA_NOA_2025_Line15000.pdf (SHA: cb8825fc...)",
        "Exhibit C-1: SuperVisa_100k_Medical_Policy.pdf (SHA: 8f4a2109...)",
      ],
    },
    challenge: {
      category: "Timeline & Bottlenecks",
      frictionTitle: "Missed IRCC Clocks & Procedural Anxiety",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Applicants constantly wonder about their application status while staff struggle to track 60-day post-ITA e-APR and 180-day PGWP windows.",
        symptoms: [
          "Applicants calling or messaging repeatedly just to ask 'any IRCC updates?'",
          "Unclear who owns the next step (applicant, Canadian sponsor, or representative)",
          "60-day post-ITA, police certificate, and permit expiry clocks tracked on spreadsheets",
          "Last-minute panic before maintained status or study/work permit expirations",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Transparent Canadian case pipelines with dual waiting-state indicators, IRCC procedural clocks, and unambiguous task ownership.",
        features: [
          "Dual Waiting-State: Instantly shows 'Waiting on You' vs 'Waiting on Firm'",
          "Automated 60-day post-ITA e-APR and 180-day PGWP countdown tracking",
          "Assigned task lists with explicit priority ratings and due date alerts",
          "Permit expiration and biometrics deadline watches with supervisory escalations",
        ],
        practicalOutcome: "Eliminates status anxiety by making client, sponsor, and firm ownership transparent across every IRCC deadline.",
      },
    },
  },
  {
    step: "04",
    id: "review",
    title: "Task & Anomaly Review (Human-in-the-Loop)",
    shortSummary: "Cross-examine personal history and dates across exhibits before IRCC filing.",
    purpose: "Scan for chronological gaps, NOC date variances, and identity mismatches that can trigger IRCC misrepresentation findings or PFLs.",
    documentoFunctionality: [
      "Cross-exhibit anomaly engine comparing IMM 5669/5257 timelines against employer letters",
      "Discrepancy adjudication desk: RCICs and lawyers resolve, dismiss, or escalate",
      "Source exhibit coordinate anchors linking findings to exact page locations",
    ],
    samplePreview: {
      badge: "Adjudication Desk",
      headline: "Cross-Document IRCC Discrepancy Flag",
      items: [
        "Flag: Employment start date (Sept 1 vs Oct 1, 2021)",
        "Source: NOC Reference Letter vs IMM 5669 Personal History",
        "Action: Resolved by RCIC with HR clarification addendum",
      ],
    },
    challenge: {
      category: "Data Integrity",
      frictionTitle: "Duplicated Form Entry & Misrepresentation Risks",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Manually retyping passport numbers, travel history, and employment dates across IMM forms leads to avoidable contradictions.",
        symptoms: [
          "Employment start date on IMM 5669 contradicts dates on NOC reference letter",
          "Name spelling variances between Indian/foreign passports and birth certificates",
          "Unexplained personal history gaps triggering IRCC completeness rejections",
          "Discrepancies discovered only when an IRCC Procedural Fairness Letter arrives",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Automated OCR cross-compares dates, entity names, and biographic facts across all exhibits, flagging anomalies for representative adjudication.",
        features: [
          "Biographic entity extraction anchored to exact source coordinates and pages",
          "Cross-exhibit anomaly detection highlighting IMM form and timeline conflicts",
          "Human-in-the-loop adjudication desk: RCICs and counsel resolve or clarify",
          "Automated IMM form pre-population from verified primary source exhibits",
        ],
        practicalOutcome: "Catches contradictory dates and history gaps early, giving the practice time to attach clarifying addenda before submission.",
      },
    },
  },
  {
    step: "05",
    id: "coordination",
    title: "Team Coordination & Client Messaging",
    shortSummary: "Unambiguous waiting states across applicants, Canadian sponsors, and staff.",
    purpose: "Ensure representatives, applicants, and Canadian hosts know exactly who holds the next action item without exposing private financials.",
    documentoFunctionality: [
      "Dual waiting-state indicator ('Waiting on You' vs 'Waiting on Firm')",
      "Privacy-shielded sponsor upload portals so Canadian hosts submit CRA NOAs securely",
      "Structured document requests with certified translation and IRCC formatting guidance",
    ],
    samplePreview: {
      badge: "Active Alignment",
      headline: "Client, Sponsor & IRCC Milestone Clocks",
      items: [
        "Waiting on Firm: Supervising RCIC Submission Letter Finalization",
        "Client & Sponsor Status: 0 Pending Requests",
        "Post-ITA Clock: 42 Days Remaining to IRCC e-APR Deadline",
      ],
    },
    challenge: {
      category: "Team Coordination",
      frictionTitle: "Client-Sponsor Coordination Gaps & Email Overload",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Sensitive Canadian host tax notices, legal strategy notes, and client questions get tangled in unsecured email and chat threads.",
        symptoms: [
          "Canadian hosts hesitant to share CRA NOAs and pay stubs over shared family chats",
          "Staff wasting hours re-explaining certified translation and IRCC photo specs",
          "Staff turnover leaving Canadian files without context or historical notes",
          "Lack of role-based privacy walls for sensitive biographic and financial records",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Role-separated workspaces where applicants and Canadian hosts use dedicated portals while firms maintain private internal strategy.",
        features: [
          "Dedicated applicant portal with English, Gujarati, and Hindi intake",
          "Privacy-shielded magic-link portal for Canadian Super Visa & Family sponsors",
          "Strict multi-tenant isolation keeping internal RCIC/counsel notes confidential",
          "Comprehensive audit log recording every view, edit, and export event",
        ],
        practicalOutcome: "Streamlines client and Canadian sponsor communication while protecting family financial privacy and firm confidentiality.",
      },
    },
  },
  {
    step: "06",
    id: "assembly",
    title: "Filing Readiness & Package Assembly",
    shortSummary: "Deterministic bundle generation with sequential exhibit tabs.",
    purpose: "Compile IRCC-ready, 5-folder structured visa dossiers and validated IMM forms with mandatory representative sign-off.",
    documentoFunctionality: [
      "One-click CIC/IRCC 5-folder dossier assembly with sequential exhibit tabs",
      "Pre-populated IRCC forms (IMM 5257, IMM 1294, IMM 5710, IMM 5669, IMM 5476)",
      "Comprehensive exhibit index and SHA-256 provenance manifest for final RCIC review",
    ],
    samplePreview: {
      badge: "IRCC Bundle Assembled",
      headline: "Final Canadian Dossier Verified",
      items: [
        "IRCC Forms: IMM 5257 / IMM 5669 / IMM 5476 Verified & Authorized",
        "Dossier Package: 5-Folder IRCC Index with SHA-256 Hashing",
        "Submission Status: Ready for IRCC Portal Upload",
      ],
    },
    challenge: {
      category: "Package Assembly",
      frictionTitle: "Unindexed Bundles & Last-Minute IRCC Scrambling",
      traditionalPain: {
        heading: "The Traditional Hassle",
        description: "Manually merging PDFs to fit IRCC upload slots, renumbering exhibit indices, and cross-checking IMM form fields hours before deadline.",
        symptoms: [
          "Disorganized PDF merges exceeding IRCC portal file size limits or missing tabs",
          "Missing signatures or IMM 5476 representative forms causing R10 rejections",
          "Chaotic manual PDF compilation taking hours of case-manager time per file",
          "No tamper-evident audit receipt of the exact dossier uploaded to IRCC",
        ],
      },
      documentoSolution: {
        heading: "With Documento Workflow",
        description: "Automated package assembly compiles verified exhibits into structured CIC/IRCC 5-folder dossiers with complete audit manifests.",
        features: [
          "One-click CIC/IRCC 5-folder dossier compilation and exhibit indexing",
          "Automated PDF bookmarking, compression awareness, and pagination",
          "Supervising RCIC / immigration counsel sign-off gate before download",
          "Complete SHA-256 digital provenance manifest included",
        ],
        practicalOutcome: "Eliminates last-minute PDF scrambling and ensures every Canadian application is flawlessly indexed and R10-complete.",
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
        borderBottom: "1px solid #DCE7E3",
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
          style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 44px auto" }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#07594F",
              marginBottom: "12px",
            }}
          >
            Canada IRCC Operating Model
          </div>

          <h2
            style={{
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.14,
              letterSpacing: "-0.03em",
              margin: "0 0 16px 0",
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
            }}
          >
            From overwhelming paperwork to an organized process.
          </h2>

          <p
            style={{
              fontSize: "15.5px",
              color: "#475955",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "680px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            A transparent six-stage workflow engineered for Canadian immigration practices — from Super Visa host LICO verification and Study Permit PALs to Express Entry e-APR packaging.
          </p>
        </div>

        {/* Horizontal 6-Stage Timeline Selector Rail */}
        <div
          role="tablist"
          aria-label="Workflow Stages"
          className="animate-on-scroll spotlight-card"
          data-motion="scale"
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
            background: "#FFFFFF",
            padding: "8px",
            borderRadius: "14px",
            border: "1px solid #DCE5E1",
            marginBottom: "24px",
            boxShadow: "0 4px 20px rgba(6, 60, 61, 0.04)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {WORKFLOW_STAGES.map((s, idx) => {
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
                  borderRadius: "8px",
                  background: isSelected ? "#07594F" : "transparent",
                  border: isSelected ? "1px solid #07594F" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  minWidth: "150px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: isSelected ? "#B9DED4" : "#6E7F7C",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Stage {s.step}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#5EEAD4",
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: isSelected ? 700 : 550,
                    color: isSelected ? "#FFFFFF" : "#172322",
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
            borderRadius: "14px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 8px 30px rgba(6, 60, 61, 0.05)",
            overflow: "hidden",
          }}
        >
          {/* Top Stage Bar */}
          <div
            style={{
              padding: "16px 28px",
              background: "#F8FAF9",
              borderBottom: "1px solid #DCE5E1",
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
                  fontWeight: 700,
                  color: "#07594F",
                  background: "#EAF5EF",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  letterSpacing: "0.02em",
                }}
              >
                Stage {activeStage.step} of 06
              </span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
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
                  borderRadius: "6px",
                  border: "1px solid #DCE5E1",
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
                  borderRadius: "6px",
                  border: "none",
                  background: "#07594F",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Next Stage →
              </button>
            </div>
          </div>

          {/* Animated Stage Progress Indicator */}
          <div style={{ width: "100%", height: "3px", background: "#EEF4F1" }}>
            <div
              style={{
                width: `${stageProgressPct}%`,
                height: "100%",
                background: "#169B77",
                transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
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
            {/* Left Column (7 of 12): Stage Purpose & Capabilities Checklist */}
            <div
              style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "22px" }}
              className="wf-left-col"
            >
              <div>
                <h3
                  style={{
                    fontSize: "19px",
                    color: "#063C3D",
                    fontWeight: 700,
                    letterSpacing: "-0.015em",
                    margin: "0 0 8px 0",
                    lineHeight: 1.35,
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                  }}
                >
                  {activeStage.shortSummary}
                </h3>
                <p style={{ fontSize: "14.5px", color: "#526663", margin: 0, lineHeight: 1.6 }}>
                  {activeStage.purpose}
                </p>
              </div>

              {/* Verified Functionality Checklist */}
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
                        borderRadius: "8px",
                        background: isCapActive ? "#F1F6F4" : "#F8FAF9",
                        border: isCapActive ? "1px solid rgba(13, 104, 102, 0.28)" : "1px solid #DCE5E1",
                        fontSize: "13.5px",
                        color: "#063C3D",
                        lineHeight: 1.45,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
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
                        ✓
                      </span>
                      <span style={{ fontWeight: isCapActive ? 650 : 500 }}>{func}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column (5 of 12): Live Preview Folio & Outcome Summary */}
            <div
              style={{
                gridColumn: "span 5",
                background: "#F8FAF9",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
              className="wf-right-col"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#0D6866",
                    background: "#DDEFE8",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {activeStage.samplePreview.badge}
                </span>
                <span style={{ fontSize: "11.5px", color: "#6E7F7C", fontWeight: 600 }}>
                  {activeStage.challenge.category}
                </span>
              </div>

              <div style={{ fontSize: "15.5px", fontWeight: 700, color: "#063C3D", lineHeight: 1.35 }}>
                {activeStage.samplePreview.headline}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "16px", borderBottom: "1px solid #EAEFEA" }}>
                {activeStage.samplePreview.items.map((item, idx) => (
                  <div key={idx} style={{ fontSize: "13px", color: "#445451", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#169B77", flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Clean Outcome Summary */}
              <div>
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#07594F", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {activeStage.challenge.documentoSolution.heading}
                </div>
                <p style={{ fontSize: "13px", color: "#172322", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
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
