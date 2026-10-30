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
  {
    id: "requirements",
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
  {
    id: "deadlines",
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
  {
    id: "discrepancies",
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
];

export function DocumentoProblemSolution() {
  const [activeChallengeId, setActiveChallengeId] = useState<string>("documents");

  const currentChallenge = CHALLENGES.find((c) => c.id === activeChallengeId) || CHALLENGES[0];

  return (
    <section
      id="comparison"
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
          className="animate-on-scroll comp-col-left"
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
            <span>Real Problems • Practical Solutions</span>
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
            <span>Immigration is complicated enough.</span>{" "}
            <span>Managing it shouldn’t be.</span>
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
            Structured evidence, declarative criteria, and clear task ownership replace administrative disorganization and avoidable casework delays.
          </p>

          {/* Challenge Selector Rows */}
          <div
            role="tablist"
            aria-label="Casework Challenges"
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
              Select Casework Challenge
            </div>

            {CHALLENGES.map((ch) => {
              const isSelected = ch.id === activeChallengeId;
              return (
                <button
                  key={ch.id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => setActiveChallengeId(ch.id)}
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
                  <span>{ch.category}</span>
                  <span style={{ fontSize: "11px", color: isSelected ? "#07594F" : "#7B8E8B" }}>
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Side-by-side or stacked clean comparison) */}
        <div
          className="animate-on-scroll delay-150 comp-col-right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            borderTop: "1px solid #DCE7E3",
            paddingTop: "24px",
          }}
        >
          {/* Friction Title */}
          <div style={{ marginBottom: "20px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#07594F",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Current Challenge
            </span>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#073D40",
                margin: "4px 0 0 0",
              }}
            >
              {currentChallenge.frictionTitle}
            </h3>
          </div>

          {/* Two-Column Comparison Card Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            {/* The Traditional Hassle */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE7E3",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#8A5A10",
                  background: "#FEF7EA",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {currentChallenge.traditionalPain.heading}
              </div>

              <p style={{ fontSize: "13.5px", color: "#5D6E7F", lineHeight: 1.55, margin: "0 0 14px 0" }}>
                {currentChallenge.traditionalPain.description}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {currentChallenge.traditionalPain.symptoms.map((s, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#5D6E7F", lineHeight: 1.45 }}>
                    <span style={{ color: "#A62D35", fontWeight: 700, flexShrink: 0 }}>✕</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* With Documento Workflow */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE7E3",
                borderTop: "3px solid #169B77",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#07594F",
                  background: "#EAF5EF",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {currentChallenge.documentoSolution.heading}
              </div>

              <p style={{ fontSize: "13.5px", color: "#073D40", lineHeight: 1.55, margin: "0 0 14px 0" }}>
                {currentChallenge.documentoSolution.description}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {currentChallenge.documentoSolution.features.map((f, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#073D40", lineHeight: 1.45 }}>
                    <span style={{ color: "#169B77", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Practical Outcome Callout */}
          <div
            style={{
              background: "#EAF5EF",
              border: "1px solid #DCE7E3",
              borderLeft: "3px solid #169B77",
              borderRadius: "0 8px 8px 0",
              padding: "14px 18px",
              fontSize: "13.5px",
              color: "#073D40",
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "#07594F" }}>Practical Outcome:</strong> {currentChallenge.documentoSolution.practicalOutcome}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .comp-col-left,
              .comp-col-right {
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
