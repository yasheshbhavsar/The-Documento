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
            <span>Traceability, Privacy &amp; Human Oversight</span>
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
            Built for qualified legal judgment, not unverified automation.
          </h2>
          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Immigration law has life-altering consequences. Documento guarantees that AI serves strictly as an accountable paralegal assistant under attorney direction.
          </p>
        </div>

        {/* 4 Pillars of Trust */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Pillar 1 */}
          <div
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
      </div>
    </section>
  );
}
