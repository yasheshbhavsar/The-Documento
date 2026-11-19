"use client";

import React, { useState } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

type PreviewTab = "dashboard" | "checklist" | "timeline_tasks" | "ai_intelligence" | "collaboration";

export function DocumentoPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("dashboard");
  const [ocrConfidence, setOcrConfidence] = useState<number>(99.4);
  const [bentoExhibitIdx, setBentoExhibitIdx] = useState<0 | 1>(0);
  const [auditViewMode, setAuditViewMode] = useState<"timeline" | "entity">("timeline");

  // Interactive state for synthetic case
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-e2");
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>("ALL");
  const [tasks, setTasks] = useState([
    {
      id: "t-1",
      title: "Resolve employment start date discrepancy with Applicant",
      assignee: "Senior Case Manager",
      priority: "high",
      completed: false,
      dueDate: "In 2 days",
    },
    {
      id: "t-2",
      title: "Finalize Express Entry e-APR submission letter & IMM 5669 Schedule A",
      assignee: "Lead RCIC / Counsel",
      priority: "high",
      completed: false,
      dueDate: "In 5 days",
    },
    {
      id: "t-3",
      title: "Verify WES ECA equivalency & IELTS General CLB 9 validity window",
      assignee: "Documento Intelligence Engine",
      priority: "medium",
      completed: true,
      dueDate: "Completed",
    },
    {
      id: "t-4",
      title: "Validate passport expiry & 60-day post-ITA e-APR submission clock",
      assignee: "Documento Vault Integrity Check",
      priority: "medium",
      completed: true,
      dueDate: "Completed",
    },
  ]);

  const [findingStatus, setFindingStatus] = useState<"pending" | "resolved" | "escalated">("pending");
  const [chatMessages, setChatMessages] = useState([
    {
      id: "m-1",
      sender: "firm",
      senderName: "Assigned Senior Paralegal",
      text: "Our automated IRCC intake check flagged that Exhibit E-2 (Employer NOC 21231 Reference Letter) lists a different employment start date than your IMM 5669 Personal History. Could you confirm which date your payroll records show?",
      time: "Yesterday, 3:15 PM",
    },
    {
      id: "m-2",
      sender: "client",
      senderName: "Principal Applicant",
      text: "Confirmed: September 1 was contract orientation prior to full-time payroll start on October 1. An HR confirmation addendum has been uploaded to prevent any IRCC mismatch.",
      time: "Today, 10:20 AM",
    },
  ]);
  const [sampleReplyInput, setSampleReplyInput] = useState<string>("");

  const sampleDocs = [
    {
      id: "doc-a1",
      title: "Passport_Bio_Page_Applicant.pdf",
      category: "Identity",
      exhibitCode: "Exhibit A-1",
      batesCode: "BATES EX-A1-001",
      size: "2.4 MB",
      hash: "e3b0c442...a53b",
      status: "verified",
      criterion: "Biographical & ICAO MRZ Identity Verification (IRCC)",
      pages: 2,
    },
    {
      id: "doc-b1",
      title: "WES_ECA_Masters_Equivalency.pdf",
      category: "Education",
      exhibitCode: "Exhibit B-1",
      batesCode: "BATES EX-B1-003",
      size: "4.1 MB",
      hash: "cb8825fc...21ad",
      status: "verified",
      criterion: "Educational Credential Assessment (IRPR s. 75 / CRS Education)",
      pages: 1,
    },
    {
      id: "doc-c1",
      title: "IELTS_General_CLB9_Scorecard.pdf",
      category: "Language",
      exhibitCode: "Exhibit C-1",
      batesCode: "BATES EX-C1-004",
      size: "1.9 MB",
      hash: "8f4a2109...b76c",
      status: "verified",
      criterion: "Official Language Benchmark (CLB 9 — Valid 2-Year Window)",
      pages: 2,
    },
    {
      id: "doc-d1",
      title: "CRA_NOA_And_Settlement_Funds.pdf",
      category: "Financial",
      exhibitCode: "Exhibit D-1",
      batesCode: "BATES EX-D1-018",
      size: "5.2 MB",
      hash: "19c3e982...98f4",
      status: "verified",
      criterion: "Proof of Settlement Funds & CRA Line 15000 Income Audit",
      pages: 14,
    },
    {
      id: "doc-e2",
      title: "Employer_NOC21231_Reference_Letter.pdf",
      category: "Employment",
      exhibitCode: "Exhibit E-2",
      batesCode: "BATES EX-E2-040",
      size: "1.8 MB",
      hash: "7f83b165...9f80",
      status: "flagged",
      criterion: "Skilled Work Experience — NOC 2021 TEER 1 (21231) Lead Statement",
      pages: 4,
    },
    {
      id: "doc-f1",
      title: "IMM_5669_Schedule_A_And_IMM_5406.pdf",
      category: "IRCC Forms",
      exhibitCode: "Form Draft",
      batesCode: "FORM DRAFT IMM-5669",
      size: "1.2 MB",
      hash: "3c990211...de51",
      status: "pending_review",
      criterion: "IRCC Background Declaration (IMM 5669) & Family Info (IMM 5406)",
      pages: 8,
    },
  ];

  const filteredDocs = sampleDocs.filter(
    (d) => docCategoryFilter === "ALL" || d.category === docCategoryFilter
  );

  const selectedDoc = sampleDocs.find((d) => d.id === selectedDocId) || sampleDocs[0];

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleSendSampleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleReplyInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender: "firm",
        senderName: "Lead RCIC / Immigration Counsel",
        text: sampleReplyInput.trim(),
        time: "Just now",
      },
    ]);
    setSampleReplyInput("");
  };

  const tabList = [
    {
      id: "dashboard" as PreviewTab,
      label: "Case Overview",
      accessibleLabel: "1. Case Overview & Pipeline (Case Overview)",
      badge: "68% Ready",
    },
    {
      id: "checklist" as PreviewTab,
      label: "Documents",
      accessibleLabel: "2. Document Vault & Checklist (Documents)",
      badge: `${sampleDocs.length} Exhibits`,
    },
    {
      id: "timeline_tasks" as PreviewTab,
      label: "Milestones",
      accessibleLabel: "3. Procedural Milestones & Tasks (Milestones)",
      badge: `${tasks.filter((t) => !t.completed).length} Pending`,
    },
    {
      id: "ai_intelligence" as PreviewTab,
      label: "AI Checks",
      accessibleLabel: "4. AI Evidentiary Checks (AI Checks)",
      badge: findingStatus === "resolved" ? "Resolved" : "1 Flag",
    },
    {
      id: "collaboration" as PreviewTab,
      label: "Client Messages",
      accessibleLabel: "5. Client & Legal Coordination (Client Messages)",
      badge: "Active",
    },
  ];

  return (
    <section
      id="preview"
      className="preview-section"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "88px 24px",
        background: "#FFFFFF",
        borderBottom: "1px solid #DCE7E3",
      }}
    >
      <InteractiveSectionBackground variant="dot-matrix" />

      <div style={{ maxWidth: "1240px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Section Editorial Header */}
        <div
          className="section-header-reveal animate-on-scroll"
          data-motion="up"
          style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 48px auto" }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#07594F",
              marginBottom: "12px",
            }}
          >
            Canada IRCC Evidence Architecture
          </div>

          <h2
            style={{
              fontSize: "clamp(28px, 3.4vw, 42px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: "0 0 16px 0",
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
            }}
          >
            From raw Canadian case files to IRCC-ready filings.
          </h2>

          <p
            style={{
              fontSize: "15.5px",
              color: "#475955",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "680px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Unstructured passports, CRA NOAs, language scores, and NOC reference letters become an indexed, tamper-evident Canadian e-APR dossier ready for RCIC and counsel adjudication.
          </p>
        </div>

        {/* 3-Step Bento Architecture: Source -> Cross-Exhibit Audit -> Counsel Sign-Off */}
        <div
          className="stagger-children animate-on-scroll"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px",
            marginBottom: "44px",
            alignItems: "stretch",
          }}
        >
          {/* Card 1: Forensic Source Record */}
          <div
            className="floating-card spotlight-card hover-lift"
            style={{
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              boxShadow: "0 4px 18px rgba(6, 60, 61, 0.04)",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#07594F",
                      background: "#EAF5EF",
                      padding: "3px 9px",
                      borderRadius: "6px",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Source Record
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "monospace",
                      color: "#169B77",
                      fontWeight: 700,
                      background: "#F1F6F4",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {bentoExhibitIdx === 0 ? "BATES EX-A1-001" : "BATES EX-D1-018"}
                  </span>
                </div>

                {/* Interactive Exhibit Micro-Tabs */}
                <div
                  style={{
                    display: "inline-flex",
                    gap: "2px",
                    background: "#F1F6F4",
                    padding: "3px",
                    borderRadius: "6px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setBentoExhibitIdx(0)}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 650,
                      cursor: "pointer",
                      background: bentoExhibitIdx === 0 ? "#FFFFFF" : "transparent",
                      color: bentoExhibitIdx === 0 ? "#063C3D" : "#5D6E7F",
                      boxShadow: bentoExhibitIdx === 0 ? "0 1px 3px rgba(6,60,61,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Exh. A-1
                  </button>
                  <button
                    type="button"
                    onClick={() => setBentoExhibitIdx(1)}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 650,
                      cursor: "pointer",
                      background: bentoExhibitIdx === 1 ? "#FFFFFF" : "transparent",
                      color: bentoExhibitIdx === 1 ? "#063C3D" : "#5D6E7F",
                      boxShadow: bentoExhibitIdx === 1 ? "0 1px 3px rgba(6,60,61,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Exh. D-1
                  </button>
                </div>
              </div>

              <h3
                style={{
                  fontSize: "17.5px",
                  fontWeight: 700,
                  color: "#063C3D",
                  letterSpacing: "-0.015em",
                  margin: "0 0 8px 0",
                  fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                }}
              >
                {bentoExhibitIdx === 0 ? "Passport_Bio_Page_Applicant.pdf" : "CRA_NOA_And_Settlement_Funds.pdf"}
              </h3>
              <p style={{ fontSize: "13.5px", color: "#526663", lineHeight: 1.55, margin: "0 0 18px 0" }}>
                Biometric passport MRZ and Canadian financial exhibits anchored by coordinate-linked extraction.
              </p>

              {/* Extraction Confidence Summary */}
              <div
                style={{
                  background: "#F8FAF9",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  border: "1px solid #DCE5E1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#445451", fontWeight: 600 }}>
                    {bentoExhibitIdx === 0 ? "Exhibit A-1 • 2 pgs" : "Exhibit D-1 • 14 pgs"}
                  </span>
                  <span style={{ color: "#0D6866", fontWeight: 700 }}>
                    {ocrConfidence.toFixed(1)}% AI Extraction Confidence
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    borderRadius: "999px",
                    background: "#DCE5E1",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, ocrConfidence))}%`,
                      height: "100%",
                      background: "#0D6866",
                      borderRadius: "999px",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "11.5px",
                color: "#6E7F7C",
                paddingTop: "12px",
                borderTop: "1px solid #EAEFEA",
              }}
            >
              <span>Tamper-evident vault</span>
              <code style={{ fontSize: "11px", color: "#07594F", fontWeight: 600 }}>
                {bentoExhibitIdx === 0 ? "e3b0c442...a53b" : "19c3e982...98f4"}
              </code>
            </div>
          </div>

          {/* Card 2: Extracted Fact & Audit Flag */}
          <div
            className="floating-card floating-card-focal spotlight-card hover-lift"
            style={{
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background: "#FFFFFF",
              border: findingStatus === "resolved" ? "1.5px solid #169B77" : "1.5px solid #0D6866",
              borderRadius: "14px",
              boxShadow: "0 8px 24px -6px rgba(6, 60, 61, 0.08)",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "18px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: findingStatus === "resolved" ? "#176B50" : "#8A5A10",
                    background: findingStatus === "resolved" ? "#EAF6F0" : "#FEF7EA",
                    padding: "3px 9px",
                    borderRadius: "6px",
                  }}
                >
                  {findingStatus === "resolved" ? "Discrepancy Resolved" : "Cross-Exhibit Audit"}
                </span>

                {/* Interactive Audit View Switcher */}
                <div
                  style={{
                    display: "inline-flex",
                    gap: "2px",
                    background: "#F1F6F4",
                    padding: "3px",
                    borderRadius: "6px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAuditViewMode("timeline")}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 650,
                      cursor: "pointer",
                      background: auditViewMode === "timeline" ? "#FFFFFF" : "transparent",
                      color: auditViewMode === "timeline" ? "#063C3D" : "#5D6E7F",
                      boxShadow: auditViewMode === "timeline" ? "0 1px 3px rgba(6,60,61,0.08)" : "none",
                    }}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditViewMode("entity")}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 650,
                      cursor: "pointer",
                      background: auditViewMode === "entity" ? "#FFFFFF" : "transparent",
                      color: auditViewMode === "entity" ? "#063C3D" : "#5D6E7F",
                      boxShadow: auditViewMode === "entity" ? "0 1px 3px rgba(6,60,61,0.08)" : "none",
                    }}
                  >
                    Entities
                  </button>
                </div>
              </div>

              <h3
                style={{
                  fontSize: "17.5px",
                  fontWeight: 700,
                  color: "#063C3D",
                  letterSpacing: "-0.015em",
                  margin: "0 0 8px 0",
                  fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                }}
              >
                Principal Applicant (Canada Express Entry)
              </h3>
              <p style={{ fontSize: "13.5px", color: "#526663", lineHeight: 1.55, margin: "0 0 18px 0" }}>
                Cross-document verification flags date variances between NOC letters and IMM 5669 before IRCC submission.
              </p>

              <div
                style={{
                  background: findingStatus === "resolved" ? "#F4FAF7" : "#FFFBF2",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  border: `1px solid ${findingStatus === "resolved" ? "rgba(22, 155, 119, 0.28)" : "rgba(217, 119, 6, 0.25)"}`,
                }}
              >
                {auditViewMode === "timeline" ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>Exhibit E-2 (NOC 21231 Letter)</div>
                      <div style={{ fontWeight: 700, color: "#063C3D" }}>Sept 1, 2021</div>
                    </div>
                    <span style={{ color: "#D97706", fontSize: "11px", fontWeight: 700, background: "#FEF7EA", padding: "2px 6px", borderRadius: "4px" }}>
                      variance
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>IMM 5669 History (Exh. E-1)</div>
                      <div style={{ fontWeight: 700, color: "#063C3D" }}>Oct 1, 2021</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "#063C3D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Toronto Cloud Systems Inc. (NOC 21231)</span>
                    <span style={{ color: "#0D6866", fontWeight: 700 }}>3 Exhibits Linked</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: "18px", paddingTop: "12px", borderTop: "1px solid #EAEFEA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#526663", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600 }}>Evidentiary Readiness</span>
                <span style={{ fontWeight: 750, color: "#063C3D" }}>{findingStatus === "resolved" ? "94%" : "68%"}</span>
              </div>
              <div style={{ width: "100%", height: "4px", background: "#EAF5EF", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    width: findingStatus === "resolved" ? "94%" : "68%",
                    height: "100%",
                    background: findingStatus === "resolved" ? "#169B77" : "#D97706",
                    borderRadius: "999px",
                    transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Counsel Review & Adjudication */}
          <div
            className="floating-card spotlight-card hover-lift"
            style={{
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              boxShadow: "0 4px 18px rgba(6, 60, 61, 0.04)",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "18px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#063C3D",
                    background: "#EAF5EF",
                    padding: "3px 9px",
                    borderRadius: "6px",
                  }}
                >
                  Counsel Sign-Off
                </span>
                <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 700 }}>
                  IMM 5476 Verified
                </span>
              </div>

              <h3
                style={{
                  fontSize: "17.5px",
                  fontWeight: 700,
                  color: "#063C3D",
                  letterSpacing: "-0.015em",
                  margin: "0 0 8px 0",
                  fontFamily: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
                }}
              >
                Assigned Lead RCIC / Counsel
              </h3>
              <p style={{ fontSize: "13.5px", color: "#526663", lineHeight: 1.55, margin: "0 0 18px 0" }}>
                Licensed RCICs and immigration counsel retain non-delegable legal authority over every discrepancy resolution and IRCC package.
              </p>

              <div
                style={{
                  background: "#F8FAF9",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  border: "1px solid #DCE5E1",
                }}
              >
                {findingStatus === "resolved" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontWeight: 700, color: "#07594F", fontSize: "12.5px" }}>
                      Addendum Authorized
                    </span>
                    <button
                      type="button"
                      onClick={() => setFindingStatus("pending")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "1px solid #DCE5E1",
                        background: "#FFFFFF",
                        color: "#063C3D",
                        fontSize: "11px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFindingStatus("resolved")}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontSize: "12.5px",
                      fontWeight: 650,
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                  >
                    Authorize Clarification Addendum
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                fontSize: "11.5px",
                color: "#6E7F7C",
                paddingTop: "12px",
                borderTop: "1px solid #EAEFEA",
              }}
            >
              Human-led representation • CICC # R709421
            </div>
          </div>
        </div>

        {/* Clean & Restrained Interactive Workspace Container */}
        <div
          className="animate-on-scroll spotlight-card"
          data-ui="true"
          data-motion="scale"
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 8px 30px rgba(6, 60, 61, 0.05)",
            overflow: "hidden",
          }}
        >
          {/* Compact Case Header */}
          <div
            style={{
              background: "#F8FAF9",
              borderBottom: "1px solid #DCE5E1",
              padding: "14px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#063C3D" }}>
                Active Canadian Case Docket: Principal Applicant
              </span>
              <span style={{ fontSize: "12px", color: "#BDCDC7" }}>•</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0D6866" }}>
                Canada Express Entry (FSWP / CEC — e-APR)
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  background: "#EAF5EF",
                  color: "#063C3D",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "6px",
                  border: "1px solid #B9DED4",
                }}
              >
                Readiness: 68%
              </span>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#5D6E7F",
                }}
              >
                IRCC Casework Studio
              </span>
            </div>
          </div>

          {/* Tab Selector Bar */}
          <div
            role="tablist"
            aria-label="Interactive case workspace sections"
            style={{
              display: "flex",
              borderBottom: "1px solid #DCE5E1",
              background: "#FFFFFF",
              padding: "0 12px",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {tabList.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`workspace-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`workspace-panel-${tab.id}`}
                  aria-label={tab.accessibleLabel}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "12px 18px",
                    fontSize: "13px",
                    fontWeight: isSelected ? 700 : 550,
                    color: isSelected ? "#063C3D" : "#445451",
                    border: "none",
                    background: "transparent",
                    borderBottom: isSelected ? "3px solid #0D6866" : "3px solid transparent",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    whiteSpace: "nowrap",
                    transition: "color 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: isSelected ? "#DDEFE8" : "#F1F6F4",
                      color: isSelected ? "#063C3D" : "#6E7F7C",
                      fontSize: "11px",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      fontWeight: 650,
                    }}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Case Overview */}
          {activeTab === "dashboard" && (
            <div
              id="workspace-panel-dashboard"
              role="tabpanel"
              aria-labelledby="workspace-tab-dashboard"
              style={{ padding: "24px", minHeight: "380px" }}
            >
              {/* Aligned Key Summary Strip */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Filing Readiness
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 750, color: "#063C3D" }}>68%</div>
                  <div style={{ fontSize: "12px", color: "#176B50", marginTop: "3px", fontWeight: 600 }}>
                    ✓ CRS 518 Verified • 4 of 6 Exhibits Cleared
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Active Status
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#8A5A10" }}>
                    Waiting on Firm Counsel
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
                    Client has 0 pending requests
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Post-ITA 60-Day Clock
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    42 Days Remaining
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                    IRCC e-APR statutory deadline
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Supervising Representative
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    Assigned Lead RCIC / Counsel
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                    CICC Reg. # R709421 (IMM 5476)
                  </div>
                </div>
              </div>

              {/* Single Five-Stage Progression Line */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#063C3D", marginBottom: "12px" }}>
                  Case Progression Pipeline:
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {[
                    { step: "Intake", status: "completed", desc: "English/Gujarati/Hindi form" },
                    { step: "Documents", status: "completed", desc: "6 IRCC exhibits hashed" },
                    { step: "Review", status: "active", desc: "1 NOC date flag under review" },
                    { step: "Package", status: "pending", desc: "CIC/IRCC 5-folder assembly" },
                    { step: "RCIC Sign-off", status: "pending", desc: "Final IRCC e-APR gate" },
                  ].map((s, idx) => {
                    const isCompleted = s.status === "completed";
                    const isActive = s.status === "active";
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid",
                          borderColor: isCompleted ? "#B9DED4" : isActive ? "#0D6866" : "#E2E8E4",
                          background: isCompleted ? "#F0F8F5" : isActive ? "#DDEFE8" : "#FFFFFF",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: isActive ? "#063C3D" : isCompleted ? "#176B50" : "#445451",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{idx + 1}. {s.step}</span>
                          <span>{isCompleted ? "✓" : isActive ? "●" : "○"}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "3px" }}>
                          {s.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Restrained Guidance Callout */}
              <div
                style={{
                  background: "#F8FAF9",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "12.5px",
                  color: "#445451",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ color: "#07594F", fontWeight: 700 }}>Casework Note:</span>
                <span>
                  Select any tab above to examine the Document Vault, procedural tasks, AI discrepancy resolution desk, or client communication thread.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Documents */}
          {activeTab === "checklist" && (
            <div
              id="workspace-panel-checklist"
              role="tabpanel"
              aria-labelledby="workspace-tab-checklist"
              style={{ padding: "24px", minHeight: "380px" }}
            >
              {/* Category Filter Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#6E7F7C", marginRight: "4px" }}>
                  Filter:
                </span>
                {["ALL", "Identity", "Education", "Language", "Financial", "Employment", "IRCC Forms"].map((cat) => {
                  const isCatSelected = docCategoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDocCategoryFilter(cat)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: isCatSelected ? "#0D6866" : "#DCE5E1",
                        background: isCatSelected ? "#0D6866" : "#FFFFFF",
                        color: isCatSelected ? "#FFFFFF" : "#445451",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Master-Detail Document Layout */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
                {/* Left: Document List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDoc.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDocId(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDocId(doc.id);
                          }
                        }}
                        style={{
                          padding: "11px 14px",
                          borderRadius: "8px",
                          border: "1px solid",
                          borderColor: isSelected ? "#0D6866" : "#DCE5E1",
                          background: isSelected ? "#F1F6F4" : "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          transition: "border-color 0.12s ease",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#063C3D",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {doc.exhibitCode}: {doc.title}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                            {doc.category} • {doc.pages} pages • {doc.size}
                          </div>
                        </div>

                        {doc.status === "verified" && (
                          <span style={{ background: "#EAF6F0", color: "#176B50", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", flexShrink: 0 }}>
                            Verified
                          </span>
                        )}
                        {doc.status === "flagged" && (
                          <span style={{ background: "#FEF7EA", color: "#8A5A10", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", flexShrink: 0 }}>
                            Flagged
                          </span>
                        )}
                        {doc.status === "pending_review" && (
                          <span style={{ background: "#F1F6F4", color: "#445451", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", flexShrink: 0 }}>
                            Draft Form
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right: Selected Document Detail Preview Card */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 750, color: "#0D6866", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Exhibit Metadata Inspector
                    </span>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#6E7F7C" }}>
                      SHA-256: {selectedDoc.hash}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0", lineHeight: 1.35 }}>
                    {selectedDoc.title}
                  </h3>

                  <div style={{ fontSize: "12.5px", color: "#445451", marginBottom: "12px", lineHeight: 1.45 }}>
                    <strong>Regulatory Mapping:</strong> {selectedDoc.criterion}
                  </div>

                  <div style={{ background: "#F8FAF9", borderRadius: "6px", border: "1px solid #DCE5E1", padding: "10px 12px", marginBottom: "12px", fontSize: "11.5px", color: "#445451" }}>
                    <div style={{ marginBottom: "3px" }}>• <strong>Vault Storage:</strong> Encrypted AES-256 at Rest</div>
                    <div style={{ marginBottom: "3px" }}>• <strong>AI Status:</strong> Parsed &amp; Coordinates Indexed</div>
                    <div>• <strong>Integrity Audit:</strong> Immutable Hash Registered</div>
                  </div>

                  {selectedDoc.status === "flagged" && (
                    <div style={{ background: "#FEF7EA", border: "1px solid #F6D8A6", borderRadius: "6px", padding: "10px 12px", fontSize: "12px", color: "#8A5A10", lineHeight: 1.45 }}>
                      ⚠️ <strong>Discrepancy Detected:</strong> Employment start date variance on Page 2. See AI Checks tab to review attorney disposition.
                    </div>
                  )}

                  {selectedDoc.status === "verified" && (
                    <div style={{ background: "#EAF6F0", border: "1px solid #B9DED4", borderRadius: "6px", padding: "10px 12px", fontSize: "12px", color: "#176B50", lineHeight: 1.45 }}>
                      ✓ <strong>Filing Ready:</strong> Formatted and indexed for petition bundle inclusion.
                    </div>
                  )}

                  {selectedDoc.status === "pending_review" && (
                    <div style={{ background: "#F1F6F4", border: "1px solid #DCE5E1", borderRadius: "6px", padding: "10px 12px", fontSize: "12px", color: "#445451", lineHeight: 1.45 }}>
                      Form Draft: Awaiting attorney final review before submission bundle assembly.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Milestones & Tasks */}
          {activeTab === "timeline_tasks" && (
            <div
              id="workspace-panel-timeline_tasks"
              role="tabpanel"
              aria-labelledby="workspace-tab-timeline_tasks"
              style={{ padding: "24px", minHeight: "380px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    Active Case Task Docket
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    Interactive: Click checkboxes to toggle task completion.
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "#0D6866", fontWeight: 700 }}>
                  {tasks.filter((t) => t.completed).length} of {tasks.length} Completed
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    style={{
                      background: task.completed ? "#F8FDFB" : "#FFFFFF",
                      border: "1px solid",
                      borderColor: task.completed ? "#B9DED4" : "#DCE5E1",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      cursor: "pointer",
                      transition: "border-color 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => { }} // controlled by wrapper click
                        style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: "#0D6866" }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 650,
                            color: task.completed ? "#6E7F7C" : "#063C3D",
                            textDecoration: task.completed ? "line-through" : "none",
                          }}
                        >
                          {task.title}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#6E7F7C", marginTop: "2px" }}>
                          Assignee: {task.assignee}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 650,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: task.completed ? "#EAF6F0" : task.priority === "high" ? "#FEF7EA" : "#F1F6F4",
                        color: task.completed ? "#176B50" : task.priority === "high" ? "#8A5A10" : "#445451",
                        flexShrink: 0,
                      }}
                    >
                      {task.completed ? "Done" : task.dueDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AI Evidentiary Checks */}
          {activeTab === "ai_intelligence" && (
            <div
              id="workspace-panel-ai_intelligence"
              role="tabpanel"
              aria-labelledby="workspace-tab-ai_intelligence"
              style={{ padding: "24px", minHeight: "380px" }}
            >
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                  AI Discrepancy Detection &amp; Attorney Adjudication Desk
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                  Automated checks highlight potential variances across exhibits for licensed attorney review. Suggestions do not constitute legal conclusions.
                </div>
              </div>

              {/* Finding Card */}
              <div
                style={{
                  border: "1px solid",
                  borderColor: findingStatus === "resolved" ? "#B9DED4" : findingStatus === "escalated" ? "#0D6866" : "#F6D8A6",
                  background: findingStatus === "resolved" ? "#F8FDFB" : findingStatus === "escalated" ? "#F1F6F4" : "#FFFDF8",
                  borderRadius: "8px",
                  padding: "18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: findingStatus === "resolved" ? "#EAF6F0" : findingStatus === "escalated" ? "#DDEFE8" : "#FEF7EA",
                        color: findingStatus === "resolved" ? "#176B50" : findingStatus === "escalated" ? "#063C3D" : "#8A5A10",
                      }}
                    >
                      {findingStatus === "resolved"
                        ? "STATUS: RESOLVED BY COUNSEL"
                        : findingStatus === "escalated"
                          ? "STATUS: ESCALATED TO SENIOR PARTNER"
                          : "FLAG: TIMELINE DISCREPANCY"}
                    </span>
                    <span style={{ fontSize: "11.5px", color: "#6E7F7C" }}>Confidence: 94%</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#6E7F7C", fontFamily: "monospace" }}>
                    Rule: IRCC-EE-NOC21231-CHRONO
                  </span>
                </div>

                <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0" }}>
                  Employment Start Date Variance (Sept 1 vs Oct 1, 2021)
                </h4>

                <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                  Exhibit E-2 (Employer NOC 21231 Reference Letter, Page 2, Para 3) lists skilled employment commencement as <strong>September 1, 2021</strong>. However, Exhibit E-1 (IMM 5669 Personal History) states start date as <strong>October 2021</strong> — a mismatch that can trigger an IRCC Procedural Fairness Letter (PFL).
                </p>

                <div style={{ background: "#FFFFFF", padding: "8px 12px", borderRadius: "6px", border: "1px solid #DCE5E1", fontSize: "11.5px", color: "#063C3D", marginBottom: "14px" }}>
                  <strong>Source Provenance:</strong> [Employer_NOC21231_Reference_Letter.pdf • Page 2 • Bounding Box: (x: 140, y: 320, w: 410, h: 45)]
                </div>

                {/* Adjudication Action Controls */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {findingStatus === "pending" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setFindingStatus("resolved")}
                        style={{
                          background: "#0D6866",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        ✓ Mark Clarified with HR Addendum
                      </button>
                      <button
                        type="button"
                        onClick={() => setFindingStatus("escalated")}
                        style={{
                          background: "#FFFFFF",
                          color: "#063C3D",
                          border: "1px solid #DCE5E1",
                          padding: "8px 14px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Escalate to Senior Partner
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFindingStatus("pending")}
                      style={{
                        background: "#F1F6F4",
                        color: "#063C3D",
                        border: "1px solid #DCE5E1",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Reset / Reopen Adjudication
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Client Messages */}
          {activeTab === "collaboration" && (
            <div
              id="workspace-panel-collaboration"
              role="tabpanel"
              aria-labelledby="workspace-tab-collaboration"
              style={{ padding: "24px", minHeight: "380px" }}
            >
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                  Case Coordination &amp; Document Request Thread
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                  Direct communication thread linking applicant and assigned legal counsel.
                </div>
              </div>

              {/* Chat Message Stream */}
              <div
                style={{
                  background: "#F8FAF9",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginBottom: "14px",
                  maxHeight: "260px",
                  overflowY: "auto",
                }}
              >
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      background: msg.sender === "firm" ? "#FFFFFF" : "#EAF6F0",
                      border: "1px solid",
                      borderColor: msg.sender === "firm" ? "#DCE5E1" : "#B9DED4",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      maxWidth: "85%",
                      alignSelf: msg.sender === "firm" ? "flex-start" : "flex-end",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D" }}>
                        {msg.senderName}
                      </span>
                      <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{msg.time}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Illustrative Reply Bar */}
              <form onSubmit={handleSendSampleReply} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Test reply: e.g., 'Uploaded the amended HR confirmation letter'..."
                  value={sampleReplyInput}
                  onChange={(e) => setSampleReplyInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
