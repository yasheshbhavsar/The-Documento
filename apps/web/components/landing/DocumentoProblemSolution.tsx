"use client";

import React, { useState } from "react";

interface ChallengeComparison {
  id: string;
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
}

const CHALLENGES: ChallengeComparison[] = [
  {
    id: "documents",
    category: "Evidence Management",
    frictionTitle: "Scattered Documents & Version Confusion",
    traditionalPain: {
      heading: "The Traditional Hassle",
      description: "Documents arrive across disjointed email threads, WhatsApp scans, and temporary cloud links. Outdated passport scans get mixed with renewed ones.",
      symptoms: [
        "Unclear which version of a CV or employment letter is the final draft",
        "Low-resolution scans rejected by government filing specifications",
        "Lost attachments requiring repeated requests to the applicant",
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
  {
    id: "requirements",
    category: "Statutory Criteria",
    frictionTitle: "Unclear Requirements & Regulatory Guesswork",
    traditionalPain: {
      heading: "The Traditional Hassle",
      description: "Applicants and staff rely on generic checklists without understanding how specific evidence maps to strict statutory criteria.",
      symptoms: [
        "Guessing whether 3 of 10 EB-1A regulatory criteria are actually satisfied",
        "Confusion over whether a reference letter meets Matter of Dhanasar prongs",
        "Filing petitions with weak or non-qualifying evidentiary categories",
        "Receiving preventable Requests for Evidence (RFEs) from USCIS or IRCC",
      ],
    },
    documentoSolution: {
      heading: "With Documento Rule Engine",
      description: "Evidence is systematically evaluated against versioned government policy memorandums and declarative statutory rules with audit diffs.",
      features: [
        "Declarative requirement matrices (e.g. 8 CFR § 204.5(h) 10-criteria tracker)",
        "Dhanasar 3-prong matrix mapping endeavors to national importance standards",
        "Kazarian two-stage evaluation scorecard for supervising attorney review",
        "Clear status flags: Satisfied, Partially Supported, or Evidence Needed",
      ],
      practicalOutcome: "Replaces vague guesswork with an explicit requirement scorecard that clarifies evidentiary readiness before petition assembly.",
    },
  },
  {
    id: "deadlines",
    category: "Timeline & Bottlenecks",
    frictionTitle: "Missed Deadlines & Anxiety Over Who Acts Next",
    traditionalPain: {
      heading: "The Traditional Hassle",
      description: "Applicants constantly wonder about the status of their case while law firm staff struggle to track which client is holding up a filing.",
      symptoms: [
        "Applicants calling or emailing repeatedly just to ask 'any updates?'",
        "Unclear who owns the next action item (applicant, paralegal, or attorney)",
        "Priority dates and 60-day response clocks tracked on fragmented spreadsheets",
        "Last-minute panic before statutory filing expirations or age-out cutoffs",
      ],
    },
    documentoSolution: {
      heading: "With Documento Milestones",
      description: "Transparent case pipelines with dual waiting-state indicators, procedural clocks, and unambiguous task ownership.",
      features: [
        "Dual Waiting-State: Instantly shows 'Waiting on You' vs 'Waiting on Firm'",
        "Automated procedural milestone tracking (Intake → Evidence → Review → Filed)",
        "Assigned task lists with explicit priority ratings and due date alerts",
        "Filing deadline countdown watches with supervisory escalations",
      ],
      practicalOutcome: "Drastically reduces status anxiety by making task ownership transparent and ensuring filing deadlines are visible to all parties.",
    },
  },
  {
    id: "discrepancies",
    category: "Data Integrity",
    frictionTitle: "Duplicated Data Entry & Inconsistent Facts",
    traditionalPain: {
      heading: "The Traditional Hassle",
      description: "Manually retyping names, passport numbers, and dates into multiple government forms leads to avoidable typos and fatal contradictions.",
      symptoms: [
        "Employment start date on CV says 'Sept 2021' while support letter says 'Oct 2021'",
        "Spelling discrepancies between birth certificates and foreign passports",
        "Duplicate records created across firm intake databases",
        "Inconsistencies discovered only when an RFE or NOID is issued",
      ],
    },
    documentoSolution: {
      heading: "With Documento Intelligence",
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
  {
    id: "coordination",
    category: "Team Coordination",
    frictionTitle: "Client-Firm Coordination Gaps & Email Overload",
    traditionalPain: {
      heading: "The Traditional Hassle",
      description: "Legal advice and administrative requests get tangled in messy email chains, with confidential internal deliberations accidentally exposed.",
      symptoms: [
        "Important document requests buried beneath routine billing emails",
        "Staff wasting hours re-explaining translation and notarization rules",
        "Paralegal turnover leaving cases without context or historical notes",
        "Lack of security controls for sensitive personal biographic records",
      ],
    },
    documentoSolution: {
      heading: "With Documento Portal",
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
];

export function DocumentoProblemSolution() {
  const [activeChallengeId, setActiveChallengeId] = useState<string>("documents");
  const [viewMode, setViewMode] = useState<"interactive" | "sidebyside">("interactive");

  const currentChallenge = CHALLENGES.find((c) => c.id === activeChallengeId) || CHALLENGES[0];

  return (
    <section
      id="comparison"
      style={{
        padding: "80px 24px",
        background: "#F8F7F2",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Header */}
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
            <span>Real Problems • Practical Solutions</span>
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
            Immigration is complicated enough.
            <br />
            Managing it shouldn’t be.
          </h2>

          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: "0 auto 28px auto", maxWidth: "700px" }}>
            Immigration petitions fail from administrative disorganization, missed deadlines, and inconsistent records—not lack of merit. Explore how Documento addresses the root causes of casework friction.
          </p>

          {/* Mode Switcher */}
          <div
            style={{
              display: "inline-flex",
              background: "#E7EFEB",
              borderRadius: "8px",
              padding: "3px",
              gap: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("interactive")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: viewMode === "interactive" ? 650 : 500,
                background: viewMode === "interactive" ? "#FFFFFF" : "transparent",
                color: viewMode === "interactive" ? "#063C3D" : "#445451",
                boxShadow: viewMode === "interactive" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              Interactive Challenge Explorer
            </button>
            <button
              type="button"
              onClick={() => setViewMode("sidebyside")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: viewMode === "sidebyside" ? 650 : 500,
                background: viewMode === "sidebyside" ? "#FFFFFF" : "transparent",
                color: viewMode === "sidebyside" ? "#063C3D" : "#445451",
                boxShadow: viewMode === "sidebyside" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              Full Side-by-Side Matrix
            </button>
          </div>
        </div>

        {/* View A: Interactive Challenge Explorer */}
        {viewMode === "interactive" && (
          <div>
            {/* Horizontal Tabs for 5 Challenges */}
            <div
              role="tablist"
              aria-label="Immigration challenges comparison"
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "16px",
                marginBottom: "24px",
              }}
            >
              {CHALLENGES.map((item) => {
                const isSelected = activeChallengeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveChallengeId(item.id)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "1px solid",
                      borderColor: isSelected ? "#0D6866" : "#DCE5E1",
                      background: isSelected ? "#0D6866" : "#FFFFFF",
                      color: isSelected ? "#FFFFFF" : "#063C3D",
                      fontSize: "13px",
                      fontWeight: 650,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: isSelected ? "0 2px 8px rgba(13, 104, 102, 0.2)" : "0 1px 3px rgba(0,0,0,0.02)",
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>{item.frictionTitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Challenge Detailed Comparison Card */}
            <div
              className="animate-on-scroll delay-150"
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #DCE5E1",
                boxShadow: "0 8px 30px rgba(6, 60, 61, 0.05)",
                overflow: "hidden",
              }}
            >
              {/* Category banner */}
              <div
                style={{
                  background: "#F1F6F4",
                  borderBottom: "1px solid #DCE5E1",
                  padding: "14px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      background: "#DDEFE8",
                      color: "#063C3D",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    {currentChallenge.category}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    {currentChallenge.frictionTitle}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                  Interactive Challenge {CHALLENGES.findIndex((c) => c.id === activeChallengeId) + 1} of {CHALLENGES.length}
                </div>
              </div>

              {/* Two Column Before / After Comparison */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                }}
              >
                {/* Left: Traditional Pain (Before) */}
                <div
                  style={{
                    padding: "32px 28px",
                    borderRight: "1px solid #DCE5E1",
                    background: "#FFFDFB",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#FBEAE8",
                      color: "#B42318",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      marginBottom: "14px",
                    }}
                  >
                    <span>✕ Without Documento (Status Quo)</span>
                  </div>

                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#912018",
                      margin: "0 0 10px 0",
                    }}
                  >
                    {currentChallenge.traditionalPain.heading}
                  </h3>

                  <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: "0 0 20px 0" }}>
                    {currentChallenge.traditionalPain.description}
                  </p>

                  <div style={{ fontSize: "13px", fontWeight: 650, color: "#172322", marginBottom: "10px" }}>
                    Common Breakdown Points:
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {currentChallenge.traditionalPain.symptoms.map((symptom, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#5F3735", lineHeight: 1.45 }}>
                        <span style={{ color: "#D92D20", fontWeight: 700, flexShrink: 0 }}>—</span>
                        <span>{symptom}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Documento Solution (After) */}
                <div
                  style={{
                    padding: "32px 28px",
                    background: "#FAFDFB",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#EAF6F0",
                      color: "#176B50",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      marginBottom: "14px",
                    }}
                  >
                    <span>✓ With Documento Workspace</span>
                  </div>

                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#063C3D",
                      margin: "0 0 10px 0",
                    }}
                  >
                    {currentChallenge.documentoSolution.heading}
                  </h3>

                  <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: "0 0 20px 0" }}>
                    {currentChallenge.documentoSolution.description}
                  </p>

                  <div style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D", marginBottom: "10px" }}>
                    Operational Improvements:
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
                    {currentChallenge.documentoSolution.features.map((feat, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#172322", lineHeight: 1.45 }}>
                        <span style={{ color: "#176B50", fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Practical outcome highlight */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: "#DDEFE8",
                      border: "1px solid #B9DED4",
                      fontSize: "13px",
                      color: "#063C3D",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Practical Outcome:</strong> {currentChallenge.documentoSolution.practicalOutcome}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View B: Full Side-by-Side Matrix Grid */}
        {viewMode === "sidebyside" && (
          <div style={{ display: "grid", gap: "20px" }}>
            {CHALLENGES.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "14px",
                  padding: "24px",
                  boxShadow: "0 2px 8px rgba(6, 60, 61, 0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <span style={{ background: "#DDEFE8", color: "#063C3D", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px" }}>
                    {idx + 1}. {item.category}
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D", margin: 0 }}>
                    {item.frictionTitle}
                  </h3>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "20px",
                  }}
                >
                  {/* Traditional */}
                  <div style={{ background: "#FFFBFB", border: "1px solid #F5D3D1", borderRadius: "10px", padding: "18px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#B42318", marginBottom: "6px" }}>
                      Traditional Friction
                    </div>
                    <p style={{ fontSize: "13px", color: "#5F3735", margin: "0 0 10px 0", lineHeight: 1.5 }}>
                      {item.traditionalPain.description}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {item.traditionalPain.symptoms.slice(0, 2).map((s, sIdx) => (
                        <div key={sIdx} style={{ fontSize: "12px", color: "#8E2B24" }}>
                          • {s}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Documento */}
                  <div style={{ background: "#F8FDFB", border: "1px solid #B9DED4", borderRadius: "10px", padding: "18px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#176B50", marginBottom: "6px" }}>
                      Documento Solution
                    </div>
                    <p style={{ fontSize: "13px", color: "#172322", margin: "0 0 10px 0", lineHeight: 1.5 }}>
                      {item.documentoSolution.description}
                    </p>
                    <div style={{ fontSize: "12px", color: "#063C3D", fontWeight: 600 }}>
                      ✓ {item.documentoSolution.practicalOutcome}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Responsible Boundaries Note */}
        <div
          style={{
            marginTop: "36px",
            padding: "16px 20px",
            borderRadius: "10px",
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "13px",
            color: "#6E7F7C",
            lineHeight: 1.5,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Realistic Expectations:</strong> Documento optimizes evidence organization, administrative checklists, and team transparency. Software cannot eliminate all immigration friction, guarantee USCIS or IRCC processing timelines, or replace qualified attorney representation.
          </div>
        </div>
      </div>
    </section>
  );
}
