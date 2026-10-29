import React from "react";

interface CapabilityItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function DocumentoCapabilities() {
  const capabilities: CapabilityItem[] = [
    {
      title: "Intake & Organization",
      description:
        "Collect and structure client evidence in a centralized repository with automated categorization and cryptographic audit stamping.",
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
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      title: "OCR & Field Extraction",
      description:
        "Extract dates, biographic details, and form fields directly from PDFs and scanned documents to eliminate manual transcription.",
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
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      title: "Cross-Document Verification",
      description:
        "Compare dates, names, and employer entities across multiple exhibits to identify conflicting facts before filing.",
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
          <path d="m9 11 2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "Requirements Mapping",
      description:
        "Map submitted documents directly against visa criteria and jurisdictional checklists with real-time gap analysis.",
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
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      title: "Caseload Coordination",
      description:
        "Balance workflow across attorneys and paralegals with role-based permissions and strict ethical wall boundaries.",
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
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: "Package Assembly",
      description:
        "Generate sequential exhibit tabs, tables of contents, and organized filing packages ready for final legal review.",
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
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
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
        <div
          className="animate-on-scroll"
          style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 48px auto" }}
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
            <span>Core Capabilities</span>
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
            Engineered for high-volume legal precision.
          </h2>

          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Six core operational areas designed to organize evidence, extract key data, verify cross-document consistency, and assemble complete filing packages.
          </p>
        </div>

        {/* Capabilities Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
            gap: "20px",
          }}
        >
          {capabilities.map((cap, i) => (
            <div
              key={cap.title}
              className={`animate-on-scroll ${
                i % 3 === 0 ? "delay-100" : i % 3 === 1 ? "delay-200" : "delay-300"
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
                {cap.icon}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    color: "#063C3D",
                    margin: "0 0 8px 0",
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
