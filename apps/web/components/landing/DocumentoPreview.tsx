import React, { useState } from "react";

export function DocumentoPreview() {
  const [activeTab, setActiveTab] = useState<"extraction" | "requirements" | "findings">("extraction");
  const [resolvedStatus, setResolvedStatus] = useState<boolean>(false);

  return (
    <section
      id="preview"
      style={{
        padding: "80px 24px",
        background: "#F8F7F2",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Section Header */}
        <div style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 40px auto" }}>
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
            <span>Interactive Product Preview</span>
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
            Transparent evidence extraction, mapped to legal criteria.
          </h2>
          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: 0 }}>
            Inspect how Documento organizes exhibits, cross-examines petition claims against original documents, and requires human attorney verification.
          </p>
        </div>

        {/* Preview Shell Container */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 8px 32px rgba(6, 60, 61, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Top Bar of the Interactive Mockup */}
          <div
            style={{
              background: "#F1F6F4",
              borderBottom: "1px solid #DCE5E1",
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#CBD5E1" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#CBD5E1" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#CBD5E1" }} />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
                CASE-US-8841: Dr. Aris Thorne • EB-1A Extraordinary Ability
              </div>
            </div>

            {/* Synthetic Data Label */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "6px",
                background: "#FEF7EA",
                border: "1px solid #F6D8A6",
                fontSize: "11px",
                fontWeight: 600,
                color: "#8A5A10",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Illustrative interface • Synthetic case data</span>
            </div>
          </div>

          {/* Interactive Navigation Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #DCE5E1",
              background: "#FFFFFF",
              padding: "0 20px",
              overflowX: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("extraction")}
              style={{
                padding: "14px 18px",
                fontSize: "13px",
                fontWeight: 600,
                color: activeTab === "extraction" ? "#0D6866" : "#445451",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === "extraction" ? "3px solid #0D6866" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>1. Evidence Extraction &amp; Cross-Check</span>
              <span
                style={{
                  background: activeTab === "extraction" ? "#DDEFE8" : "#F1F6F4",
                  color: activeTab === "extraction" ? "#063C3D" : "#6E7F7C",
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                }}
              >
                3 Verified
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("requirements")}
              style={{
                padding: "14px 18px",
                fontSize: "13px",
                fontWeight: 600,
                color: activeTab === "requirements" ? "#0D6866" : "#445451",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === "requirements" ? "3px solid #0D6866" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>2. Statutory Criteria Matrix</span>
              <span
                style={{
                  background: activeTab === "requirements" ? "#DDEFE8" : "#F1F6F4",
                  color: activeTab === "requirements" ? "#063C3D" : "#6E7F7C",
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                }}
              >
                3 / 3 Satisfied
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("findings")}
              style={{
                padding: "14px 18px",
                fontSize: "13px",
                fontWeight: 600,
                color: activeTab === "findings" ? "#0D6866" : "#445451",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === "findings" ? "3px solid #0D6866" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>3. Human Adjudication Desk</span>
              <span
                style={{
                  background: resolvedStatus ? "#EAF6F0" : "#FEF7EA",
                  color: resolvedStatus ? "#176B50" : "#8A5A10",
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                }}
              >
                {resolvedStatus ? "Resolved" : "1 Flag"}
              </span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div style={{ padding: "24px", minHeight: "360px" }}>
            {activeTab === "extraction" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
                    Multi-Document Field Cross-Verification
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    Source: Form I-140 Petition draft vs. Primary Identity &amp; Support Documents
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#F1F6F4", borderBottom: "1px solid #DCE5E1" }}>
                        <th style={{ padding: "10px 14px", color: "#063C3D", fontWeight: 600 }}>Extracted Field</th>
                        <th style={{ padding: "10px 14px", color: "#063C3D", fontWeight: 600 }}>Source Exhibit</th>
                        <th style={{ padding: "10px 14px", color: "#063C3D", fontWeight: 600 }}>Extracted Value</th>
                        <th style={{ padding: "10px 14px", color: "#063C3D", fontWeight: 600 }}>Vault Hash (SHA-256)</th>
                        <th style={{ padding: "10px 14px", color: "#063C3D", fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E7EFEB" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#172322" }}>Applicant Full Name</td>
                        <td style={{ padding: "12px 14px", color: "#445451" }}>Passport_Bio_Page.pdf (P. 1)</td>
                        <td style={{ padding: "12px 14px", color: "#063C3D", fontWeight: 550 }}>Aris Thorne</td>
                        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "11px", color: "#6E7F7C" }}>
                          e3b0c442...a53b
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ background: "#EAF6F0", color: "#176B50", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            Matched 100%
                          </span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #E7EFEB" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#172322" }}>Country of Birth</td>
                        <td style={{ padding: "12px 14px", color: "#445451" }}>Birth_Certificate_Certified.pdf (P. 1)</td>
                        <td style={{ padding: "12px 14px", color: "#063C3D", fontWeight: 550 }}>United Kingdom</td>
                        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "11px", color: "#6E7F7C" }}>
                          7f83b165...9f80
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ background: "#EAF6F0", color: "#176B50", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            Matched 100%
                          </span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #E7EFEB" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#172322" }}>Doctorate Conferred Date</td>
                        <td style={{ padding: "12px 14px", color: "#445451" }}>PhD_Diploma_Oxford.pdf (P. 1)</td>
                        <td style={{ padding: "12px 14px", color: "#063C3D", fontWeight: 550 }}>May 14, 2018</td>
                        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "11px", color: "#6E7F7C" }}>
                          cb8825fc...21ad
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ background: "#EAF6F0", color: "#176B50", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            Verified Source
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "#F1F6F4",
                    border: "1px solid #DCE5E1",
                    fontSize: "12px",
                    color: "#445451",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>
                    <strong>Cryptographic Vault Guarantee:</strong> Uploaded evidence cannot be silently modified. Every timestamp and checksum is immutable in the audit stream.
                  </span>
                </div>
              </div>
            )}

            {activeTab === "requirements" && (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
                    USCIS 8 CFR § 204.5(h)(3) Extraordinary Ability Criteria
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    Threshold: Satisfy at least 3 of 10 evidentiary criteria with substantial peer impact evidence.
                  </div>
                </div>

                <div style={{ display: "grid", gap: "12px" }}>
                  <div
                    style={{
                      border: "1px solid #B9DED4",
                      background: "#F8FBF9",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
                        Criterion 1: Authorship of Scholarly Articles in the Field
                      </div>
                      <div style={{ fontSize: "12px", color: "#445451", marginTop: "2px" }}>
                        4 peer-reviewed publications identified • 1,420 academic citations documented across IEEE &amp; Nature.
                      </div>
                    </div>
                    <span style={{ background: "#EAF6F0", color: "#176B50", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>
                      Satisfied (Exhibits A1–A4)
                    </span>
                  </div>

                  <div
                    style={{
                      border: "1px solid #B9DED4",
                      background: "#F8FBF9",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
                        Criterion 2: Original Scientific or Scholarly Contributions
                      </div>
                      <div style={{ fontSize: "12px", color: "#445451", marginTop: "2px" }}>
                        Patented quantum error-mitigation algorithm deployed by 3 Tier-1 research labs.
                      </div>
                    </div>
                    <span style={{ background: "#EAF6F0", color: "#176B50", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>
                      Satisfied (Exhibits B1–B6)
                    </span>
                  </div>

                  <div
                    style={{
                      border: "1px solid #B9DED4",
                      background: "#F8FBF9",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
                        Criterion 3: Leading or Critical Role in Distinguished Organizations
                      </div>
                      <div style={{ fontSize: "12px", color: "#445451", marginTop: "2px" }}>
                        Principal Research Scientist leading the Quantum Computing Architecture group.
                      </div>
                    </div>
                    <span style={{ background: "#EAF6F0", color: "#176B50", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>
                      Satisfied (Exhibits C1–C3)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "findings" && (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
                    AI Discrepancy Flag • Attorney Action Required
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    Documento flagged a minor date mismatch between the resume CV and the employer support letter.
                  </div>
                </div>

                <div
                  style={{
                    border: resolvedStatus ? "1px solid #B9DED4" : "1px solid #F6D8A6",
                    background: resolvedStatus ? "#F8FBF9" : "#FFFDF8",
                    borderRadius: "10px",
                    padding: "18px 20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span
                          style={{
                            background: resolvedStatus ? "#EAF6F0" : "#FEF7EA",
                            color: resolvedStatus ? "#176B50" : "#8A5A10",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "10px",
                          }}
                        >
                          {resolvedStatus ? "STATUS: RESOLVED BY COUNSEL" : "FLAG: TIMELINE DISCREPANCY"}
                        </span>
                        <span style={{ fontSize: "12px", color: "#6E7F7C" }}>Confidence: 94%</span>
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
                        Employment Start Date Variance (Sept 1 vs Oct 1, 2021)
                      </div>
                      <p style={{ fontSize: "13px", color: "#445451", margin: "0 0 10px 0", lineHeight: 1.5 }}>
                        Exhibit E-2 (Support Letter) states start date as <strong>September 1, 2021</strong>, whereas Exhibit E-1 (CV) indicates <strong>October 2021</strong>.
                      </p>
                      <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                        Source Anchor: [Exhibit_E2_SupportLetter.pdf, Page 2, Paragraph 3]
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {!resolvedStatus ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setResolvedStatus(true)}
                            style={{
                              background: "#0D6866",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Mark Clarified &amp; Resolved
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolvedStatus(true)}
                            style={{
                              background: "#FFFFFF",
                              color: "#445451",
                              border: "1px solid #DCE5E1",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Dismiss (Consultant Date)
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setResolvedStatus(false)}
                          style={{
                            background: "#F1F6F4",
                            color: "#063C3D",
                            border: "1px solid #DCE5E1",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reopen Inspection
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
