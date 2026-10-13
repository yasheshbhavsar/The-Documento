"use client";

import React from "react";

export function DocumentoTrust() {
  return (
    <section
      id="trust"
      style={{
        padding: "80px 24px",
        background: "#FFFFFF",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Section Header */}
        <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto 50px auto" }}>
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
            <span>Transparency, Privacy &amp; Legal Governance</span>
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
            Immigration law carries life-altering consequences. Documento guarantees that software serves strictly as an accountable evidence organizer under human attorney direction.
          </p>
        </div>

        {/* 4 Pillars of Architecture & Trust */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            marginBottom: "48px",
          }}
        >
          {/* Pillar 1 */}
          <div
            className="animate-on-scroll delay-100"
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "26px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                marginBottom: "16px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 8px 0" }}>
              Mandatory Human Sign-Off
            </h3>
            <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
              AI findings never directly alter legal submissions or approve petition packages. Only licensed attorneys or accredited legal representatives can adjudicate findings and authorize filing.
            </p>
          </div>

          {/* Pillar 2 */}
          <div
            className="animate-on-scroll delay-150"
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "26px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                marginBottom: "16px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 8px 0" }}>
              Zero Hallucinated Facts
            </h3>
            <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
              Every extracted field is strictly bound to its physical source exhibit coordinate and page number. If a document is blurred or ambiguous, Documento transparently flags low-confidence.
            </p>
          </div>

          {/* Pillar 3 */}
          <div
            className="animate-on-scroll delay-200"
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "26px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                marginBottom: "16px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 8px 0" }}>
              Multi-Tenant Role Isolation
            </h3>
            <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
              Internal attorney case notes, strategy assessments, and colleague deliberations are enforced by backend object-level security and are strictly inaccessible in the client portal.
            </p>
          </div>

          {/* Pillar 4 */}
          <div
            className="animate-on-scroll delay-300"
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "26px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                marginBottom: "16px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#063C3D", margin: "0 0 8px 0" }}>
              Versioned Statutory Citations
            </h3>
            <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
              Requirement criteria are linked to official USCIS policy manual editions and regulatory updates with effective date tracking, preventing reliance on obsolete statutory guidelines.
            </p>
          </div>
        </div>

        {/* Clear Transparency Box: What Documento Does vs What Documento Does NOT Do */}
        <div
          className="animate-on-scroll delay-200"
          style={{
            background: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 20px rgba(6, 60, 61, 0.04)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 750, color: "#063C3D", margin: "0 0 8px 0" }}>
              Our Clear Boundaries: What Documento Does &amp; Does Not Do
            </h3>
            <p style={{ fontSize: "14px", color: "#445451", margin: 0 }}>
              Transparency is the cornerstone of responsible immigration technology.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "24px",
            }}
          >
            {/* What Documento Does */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #B9DED4", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ color: "#176B50", fontWeight: 700, fontSize: "16px" }}>✓</span>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>What Documento Does</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#445451" }}>
                <div>• Organizes case files into an encrypted, SHA-256 verified exhibit vault</div>
                <div>• Evaluates uploaded evidence against published government criteria checklists</div>
                <div>• Flags date variances and potential discrepancies across exhibits for review</div>
                <div>• Provides dual waiting-state transparency between legal staff and applicants</div>
                <div>• Generates sequential exhibit tabs (Exhibits A-1 to E-12) and indexed catalogs</div>
              </div>
            </div>

            {/* What Documento Does NOT Do */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #F5D3D1", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ color: "#B42318", fontWeight: 700, fontSize: "16px" }}>✕</span>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#912018" }}>What Documento Does NOT Do</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#5F3735" }}>
                <div>• Does NOT provide legal advice, statutory opinions, or legal representation</div>
                <div>• Does NOT guarantee visa approval, interview waivers, or processing timelines</div>
                <div>• Does NOT file petitions with USCIS or foreign embassies without attorney authorization</div>
                <div>• Does NOT fabricate AI claims or allow unreviewed AI output into filings</div>
                <div>• Does NOT share client case records across organizational tenant boundaries</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
