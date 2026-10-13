import React from "react";

export function DocumentoCapabilities() {
  const capabilities = [
    {
      title: "Document Intelligence",
      tag: "Extraction & Vault",
      description:
        "Extracts names, dates, immigration numbers, and biographic entities from PDFs and scans, anchoring each fact to SHA-256 fingerprint records.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      title: "Requirement Mapping",
      tag: "Statutory Engine",
      description:
        "Evaluates evidence against versioned USCIS policy memos, statutory criteria (e.g. 8 CFR § 204.5), and jurisdictional guidelines with full audit diffs.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      title: "Case Coordination",
      tag: "Multi-Role Queues",
      description:
        "Seamless division of responsibilities across managing partners, senior paralegals, and review attorneys with workload capacity balancing.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: "Evidence Comparison",
      tag: "Timeline Alignment",
      description:
        "Cross-compares dates, employer entities, and travel histories across diverse exhibits to surface inconsistencies before package submission.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      title: "Client Collaboration",
      tag: "Intake & Requests",
      description:
        "Mobile-first applicant onboarding, guided multi-lingual questionnaires, explicit document requests, and dual waiting-state transparency.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      title: "Application Preparation",
      tag: "Readiness Checklists",
      description:
        "Deterministic filing verification, exhibit indexing, USCIS petition bundle assembly, and attorney sign-off workflows prior to physical or digital filing.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="capabilities"
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
            <span>Core Capabilities</span>
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
            Engineered for high-volume legal precision.
          </h2>
          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Every capability in Documento is structured to eliminate administrative chaos, prevent avoidable RFEs, and preserve full attorney accountability.
          </p>
        </div>

        {/* Capabilities Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "24px",
          }}
        >
          {capabilities.map((cap, i) => (
            <div
              key={i}
              style={{
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "14px",
                padding: "28px 26px",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0D6866";
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(6, 60, 61, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#DCE5E1";
                e.currentTarget.style.background = "#F8F7F2";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#DDEFE8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {cap.icon}
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 650,
                      color: "#063C3D",
                      background: "#E7EFEB",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {cap.tag}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: "0 0 10px 0",
                    fontFamily: "var(--font-display, Inter, sans-serif)",
                  }}
                >
                  {cap.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
