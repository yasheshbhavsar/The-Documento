"use client";

import React, { useState } from "react";

export function DocumentoTrust() {
  const [activePrincipleIdx, setActivePrincipleIdx] = useState<number>(0);

  const principles = [
    {
      title: "Human-in-the-Loop Review",
      description:
        "Consequential filings, legal arguments, and client submissions require licensed attorney adjudication and authorization.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07594F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          className="animate-on-scroll trust-col-left"
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
            <span>Trust &amp; Governance</span>
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
            Built for qualified legal judgment, not unverified automation.
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
            Immigration casework demands accountable human oversight. Documento is engineered to support licensed legal professionals with structured evidence organization—never to replace their judgment.
          </p>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Principles & Operational Boundaries Matrix) */}
        <div
          className="animate-on-scroll delay-150 trust-col-right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            borderTop: "1px solid #DCE7E3",
          }}
        >
          {/* Principles Rows */}
          <div style={{ marginBottom: "32px" }}>
            {principles.map((p, idx) => {
              const isSelected = activePrincipleIdx === idx;
              return (
                <div
                  key={p.title}
                  id={`principle-row-${idx}`}
                  onClick={() => setActivePrincipleIdx(idx)}
                  style={{
                    padding: "20px 0",
                    borderBottom: "1px solid #DCE7E3",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "18px",
                    background: isSelected ? "rgba(234, 245, 239, 0.3)" : "transparent",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "#EAF5EF",
                      border: "1px solid #DCE7E3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#073D40", margin: "0 0 4px 0" }}>
                      {p.title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "#5D6E7F", lineHeight: 1.6, margin: 0 }}>
                      {p.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Operational Boundaries Header */}
          <div style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#073D40",
                margin: "0 0 6px 0",
              }}
            >
              Clear Operational Boundaries
            </h3>
            <p style={{ fontSize: "14px", color: "#5D6E7F", lineHeight: 1.5, margin: 0 }}>
              Responsible legal technology requires unambiguous separation between administrative assistance and formal legal representation.
            </p>
          </div>

          {/* Two-Column Operational Boundaries */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            {/* Helps With */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #DCE7E3",
                borderTop: "3px solid #169B77",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ color: "#07594F", fontWeight: 700, fontSize: "15px" }}>✓</span>
                <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#073D40" }}>
                  Documento helps with
                </span>
              </div>

              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#5D6E7F", lineHeight: 1.5 }}>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                  <span><strong>Document organization:</strong> Structuring client records and exhibits in an audited repository.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                  <span><strong>Administrative checks:</strong> Verifying completeness against published criteria and identifying missing items.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                  <span><strong>Source-linked discrepancy flags:</strong> Highlighting date, name, or employer variances across exhibits for human review.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#169B77", fontWeight: 700 }}>•</span>
                  <span><strong>Workflow transparency:</strong> Providing clear status tracking and waiting-state visibility between teams and applicants.</span>
                </li>
              </ul>
            </div>

            {/* Does Not Do */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #DCE7E3",
                borderTop: "3px solid #8A5A10",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ color: "#A62D35", fontWeight: 700, fontSize: "15px" }}>✕</span>
                <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#073D40" }}>
                  Documento does not do
                </span>
              </div>

              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#5D6E7F", lineHeight: 1.5 }}>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#A62D35", fontWeight: 700 }}>•</span>
                  <span><strong>Replace legal professionals:</strong> Software cannot substitute for the legal analysis, strategy, and advice of licensed counsel.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#A62D35", fontWeight: 700 }}>•</span>
                  <span><strong>Guarantee immigration outcomes:</strong> No petition approval, expedite request, or visa issuance can ever be guaranteed.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#A62D35", fontWeight: 700 }}>•</span>
                  <span><strong>Make final legal determinations:</strong> AI suggestions are unadjudicated findings that require attorney verification.</span>
                </li>
                <li style={{ display: "flex", gap: "8px" }}>
                  <span style={{ color: "#A62D35", fontWeight: 700 }}>•</span>
                  <span><strong>Claim government endorsement:</strong> Documento is independent software not affiliated with or endorsed by any immigration authority.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Legal Disclaimer Box */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: "#EAF5EF",
              border: "1px solid #DCE7E3",
              fontSize: "12px",
              color: "#5D6E7F",
              lineHeight: 1.5,
            }}
          >
            <strong>Legal Disclaimer:</strong> Documento is an immigration casework and evidence intelligence platform, not an immigration law firm. Documento does not provide legal advice, representation, or opinions, and is not affiliated with or endorsed by USCIS, the Department of Homeland Security, the UK Home Office, IRCC, or any government authority. Consequential petition filings require the evaluation and signature of a licensed immigration attorney or accredited representative.
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .trust-col-left,
              .trust-col-right {
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
