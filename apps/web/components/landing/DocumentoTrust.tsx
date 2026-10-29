"use client";

import React from "react";

export function DocumentoTrust() {
  const principles = [
    {
      title: "Human-in-the-Loop Review",
      description:
        "Consequential filings, legal arguments, and client submissions require licensed attorney adjudication and authorization.",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0D6866"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
    },
    {
      title: "Evidence-Linked Findings",
      description:
        "Automated findings cite specific exhibit coordinates and page numbers, surfacing low-confidence indicators when text is ambiguous.",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0D6866"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6" />
          <path d="M8 11h6" />
        </svg>
      ),
    },
    {
      title: "Tenant & Role Isolation",
      description:
        "Internal legal strategies and firm notes are separated by role-based permissions and quarantined from client-facing portals.",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0D6866"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      title: "Provenance & Audit Trails",
      description:
        "Uploaded exhibits are recorded with cryptographic SHA-256 verification and immutable activity timestamps.",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0D6866"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="trust"
      style={{
        padding: "80px 24px",
        background: "#FFFFFF",
        borderBottom: "1px solid #DCE5E1",
        scrollMarginTop: "80px",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Section Header */}
        <div
          className="animate-on-scroll"
          style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto 48px auto" }}
        >
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
            <span>Trust &amp; Governance</span>
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
            Built for qualified legal judgment, not unverified automation.
          </h2>

          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Immigration casework demands accountable human oversight. Documento is engineered to support licensed legal professionals with structured evidence organization—never to replace their judgment.
          </p>
        </div>

        {/* 4 Core Trust Principles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          {principles.map((p, i) => (
            <div
              key={p.title}
              className={`animate-on-scroll ${
                i % 2 === 0 ? "delay-100" : "delay-200"
              }`}
              style={{
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "14px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                transition: "border-color 0.15s ease",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#DDEFE8",
                  border: "1px solid #B9DED4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {p.icon}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: "0 0 8px 0",
                    fontFamily: "var(--font-display, Inter, sans-serif)",
                  }}
                >
                  {p.title}
                </h3>
                <p style={{ fontSize: "13.5px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  {p.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Concise Two-Column Operational Boundaries */}
        <div
          className="animate-on-scroll delay-200"
          style={{
            background: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "16px",
            padding: "32px 28px",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 28px auto" }}>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#063C3D",
                margin: "0 0 8px 0",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Clear Operational Boundaries
            </h3>
            <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.5, margin: 0 }}>
              Responsible legal technology requires unambiguous separation between administrative assistance and formal legal representation.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "20px",
            }}
          >
            {/* What Documento helps with */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #B9DED4",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#DDEFE8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0D6866",
                    fontWeight: 700,
                    fontSize: "13px",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <h4
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: 0,
                  }}
                >
                  Documento helps with
                </h4>
              </div>

              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  fontSize: "13.5px",
                  color: "#445451",
                  lineHeight: 1.5,
                }}
              >
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#0D6866", fontWeight: 700 }}>•</span>
                  <span><strong>Document organization:</strong> Structuring client records and exhibits in an audited repository.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#0D6866", fontWeight: 700 }}>•</span>
                  <span><strong>Administrative checks:</strong> Verifying completeness against published criteria and identifying missing items.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#0D6866", fontWeight: 700 }}>•</span>
                  <span><strong>Source-linked discrepancy flags:</strong> Highlighting date, name, or employer variances across exhibits for human review.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#0D6866", fontWeight: 700 }}>•</span>
                  <span><strong>Workflow transparency:</strong> Providing clear status tracking and waiting-state visibility between teams and applicants.</span>
                </li>
              </ul>
            </div>

            {/* What Documento does not do */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2D7D5",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#F6ECEB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#8C4A47",
                    fontWeight: 700,
                    fontSize: "13px",
                    flexShrink: 0,
                  }}
                >
                  ✕
                </div>
                <h4
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#4A2825",
                    margin: 0,
                  }}
                >
                  Documento does not do
                </h4>
              </div>

              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  fontSize: "13.5px",
                  color: "#445451",
                  lineHeight: 1.5,
                }}
              >
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#8C4A47", fontWeight: 700 }}>•</span>
                  <span><strong>Replace legal professionals:</strong> Software cannot substitute for the legal analysis, strategy, and advice of licensed counsel.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#8C4A47", fontWeight: 700 }}>•</span>
                  <span><strong>Guarantee immigration outcomes:</strong> No petition approval, expedite request, or visa issuance can ever be guaranteed.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#8C4A47", fontWeight: 700 }}>•</span>
                  <span><strong>Make final legal determinations:</strong> AI suggestions are unadjudicated findings that require attorney verification.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#8C4A47", fontWeight: 700 }}>•</span>
                  <span><strong>Claim government endorsement:</strong> Documento is independent software not affiliated with or endorsed by any immigration authority.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Applicable Legal Disclaimer */}
          <div
            style={{
              marginTop: "24px",
              padding: "14px 18px",
              background: "#F2F0E8",
              borderRadius: "10px",
              border: "1px solid #DCE5E1",
              fontSize: "12px",
              color: "#5C6E6B",
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "#063C3D" }}>Legal Disclaimer:</strong> Documento is an evidence organization and casework intelligence platform, not an immigration law firm. Documento does not provide legal advice, opinions, or representation. Consequential petition filings and statutory determinations require evaluation by a licensed immigration attorney or accredited representative.
          </div>
        </div>
      </div>
    </section>
  );
}
