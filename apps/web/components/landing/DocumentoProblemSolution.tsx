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
    frictionTitle: "Missed Deadlines & Anxiety Over Who Acts Next",
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
      heading: "With Documento Milestones",
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
        "Staff turnover leaving cases without context or historical notes",
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

  const currentChallenge = CHALLENGES.find((c) => c.id === activeChallengeId) || CHALLENGES[0];

  return (
    <section
      id="comparison"
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
            <span>Real Problems • Practical Solutions</span>
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
            Immigration is complicated enough.
            <br />
            Managing it shouldn’t be.
          </h2>

          <p style={{ fontSize: "15px", color: "#445451", lineHeight: 1.55, margin: "0 auto 28px auto", maxWidth: "680px" }}>
            Structured evidence, declarative criteria, and clear task ownership replace administrative disorganization and avoidable casework delays.
          </p>

          {/* Compact Row of Challenge Selectors */}
          <div
            role="tablist"
            aria-label="Immigration challenges"
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {CHALLENGES.map((item, idx) => {
              const isSelected = activeChallengeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-controls={`panel-${item.id}`}
                  aria-selected={isSelected}
                  onClick={() => setActiveChallengeId(item.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: isSelected ? "#063C3D" : "#DCE5E1",
                    background: isSelected ? "#063C3D" : "#FFFFFF",
                    color: isSelected ? "#FFFFFF" : "#445451",
                    fontSize: "13px",
                    fontWeight: isSelected ? 650 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: isSelected ? "rgba(255,255,255,0.2)" : "#EAF2EE",
                      color: isSelected ? "#FFFFFF" : "#0D6866",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{item.category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Challenge Before-and-After Card */}
        <div
          id={`panel-${currentChallenge.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${currentChallenge.id}`}
          className="animate-on-scroll"
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 2px 12px rgba(6, 60, 61, 0.04)",
            overflow: "hidden",
          }}
        >
          {/* Category & Friction Title Header Banner */}
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
                {currentChallenge.category}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#063C3D",
                }}
              >
                {currentChallenge.frictionTitle}
              </h3>
            </div>
            <div style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 500 }}>
              Challenge {CHALLENGES.findIndex((c) => c.id === activeChallengeId) + 1} of {CHALLENGES.length}
            </div>
          </div>

          {/* Two Calm Columns (Side by Side on Desktop, Stacked on Mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: Without Documento */}
            <div
              className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-[#DCE5E1]"
              style={{
                background: "#FCFBF9",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "#F2EFE9",
                  border: "1px solid #E3DFD5",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#544D42",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "16px",
                }}
              >
                <span>✕ Without Documento</span>
              </div>

              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#172322",
                }}
              >
                {currentChallenge.traditionalPain.heading}
              </h4>

              <p
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "14px",
                  color: "#445451",
                  lineHeight: 1.6,
                }}
              >
                {currentChallenge.traditionalPain.description}
              </p>

              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 650,
                  color: "#6E7F7C",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: "12px",
                }}
              >
                Typical Bottlenecks
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentChallenge.traditionalPain.symptoms.slice(0, 3).map((symptom, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      fontSize: "13px",
                      color: "#445451",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#8C8275", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>—</span>
                    <span>{symptom}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: With Documento */}
            <div
              className="p-6 md:p-8"
              style={{
                background: "#FAFDFB",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "#DDEFE8",
                  border: "1px solid #B9DED4",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#063C3D",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "16px",
                }}
              >
                <span>✓ With Documento Workspace</span>
              </div>

              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#063C3D",
                }}
              >
                {currentChallenge.documentoSolution.heading}
              </h4>

              <p
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "14px",
                  color: "#445451",
                  lineHeight: 1.6,
                }}
              >
                {currentChallenge.documentoSolution.description}
              </p>

              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 650,
                  color: "#0D6866",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: "12px",
                }}
              >
                Operational Improvements
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentChallenge.documentoSolution.features.slice(0, 3).map((feat, idx) => (
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

              {/* Practical Outcome */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "#F0F7F4",
                  border: "1px solid #D1E5DC",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 700, color: "#063C3D" }}>Practical Outcome: </span>
                <span style={{ color: "#2E4744" }}>{currentChallenge.documentoSolution.practicalOutcome}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Responsible Boundaries Note */}
        <div
          style={{
            marginTop: "32px",
            padding: "16px 20px",
            borderRadius: "10px",
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            fontSize: "13px",
            color: "#556461",
            lineHeight: 1.55,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0D6866"
            strokeWidth="2"
            style={{ flexShrink: 0, marginTop: "2px" }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong style={{ color: "#063C3D" }}>Realistic Expectations:</strong> Documento optimizes evidence organization, administrative checklists, and team transparency. Software cannot eliminate all immigration friction, guarantee USCIS or IRCC processing timelines, or replace qualified attorney representation.
          </div>
        </div>
      </div>
    </section>
  );
}
