import React from "react";

export function DocumentoWorkflow() {
  const steps = [
    {
      step: "01",
      title: "Organize & Intake",
      summary: "Gather evidence without back-and-forth email attachments.",
      details: [
        "Structured multi-lingual questionnaires for applicants & dependants",
        "Clear document upload requests with format & resolution checks",
        "Immutable SHA-256 hashing and secure cloud vault storage",
      ],
    },
    {
      step: "02",
      title: "Analyze & Extract",
      summary: "Automated document intelligence cross-checks every fact.",
      details: [
        "Optical extraction of vital dates, names, and passport details",
        "Cross-document timeline verification and anomaly detection",
        "Direct mapping of evidence against USCIS statutory requirements",
      ],
    },
    {
      step: "03",
      title: "Human Review",
      summary: "Qualified legal attorneys remain in absolute control.",
      details: [
        "AI findings presented as reviewable hints with confidence metrics",
        "Discrepancies require explicit attorney resolution or dismissal",
        "Confidential attorney notes and strategy strictly isolated from clients",
      ],
    },
    {
      step: "04",
      title: "Prepare & File",
      summary: "Deterministic readiness validation before petition filing.",
      details: [
        "Filing checklist verifies all required evidentiary exhibits",
        "Automated exhibit tab indexing and USCIS bundle compilation",
        "Supervisory legal partner sign-off and filing milestone tracking",
      ],
    },
  ];

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
        <div style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 54px auto" }}>
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
              fontWeight: 600,
              color: "#063C3D",
              marginBottom: "14px",
            }}
          >
            <span>The 4-Step Case Workflow</span>
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.2,
              letterSpacing: "-0.025em",
              margin: "0 0 14px 0",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            From intake to filing, every milestone is auditable.
          </h2>
          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Documento replaces guesswork with an explicit pipeline where status is unambiguous and human oversight is mandatory.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {steps.map((item, index) => (
            <div
              key={index}
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "14px",
                padding: "30px 24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 8px rgba(6, 60, 61, 0.03)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(6, 60, 61, 0.08)";
                e.currentTarget.style.borderColor = "#0D6866";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(6, 60, 61, 0.03)";
                e.currentTarget.style.borderColor = "#DCE5E1";
              }}
            >
              {/* Step indicator */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "#DDEFE8",
                  color: "#063C3D",
                  fontWeight: 750,
                  fontSize: "14px",
                  marginBottom: "18px",
                }}
              >
                {item.step}
              </div>

              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#063C3D",
                  margin: "0 0 8px 0",
                  fontFamily: "var(--font-display, Inter, sans-serif)",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#445451",
                  margin: "0 0 18px 0",
                  lineHeight: 1.5,
                  minHeight: "40px",
                }}
              >
                {item.summary}
              </p>

              <div
                style={{
                  borderTop: "1px solid #F1F6F4",
                  paddingTop: "14px",
                  marginTop: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {item.details.map((detail, dIdx) => (
                  <div
                    key={dIdx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      fontSize: "12px",
                      color: "#445451",
                      lineHeight: 1.45,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0D6866"
                      strokeWidth="2.5"
                      style={{ flexShrink: 0, marginTop: "2px" }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
