"use client";

import React, { useState } from "react";

type PreviewTab = "dashboard" | "checklist" | "timeline_tasks" | "ai_intelligence" | "collaboration";

export function DocumentoPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("dashboard");

  // Interactive state for synthetic case
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-e2");
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>("ALL");
  const [tasks, setTasks] = useState([
    {
      id: "t-1",
      title: "Resolve employment start date discrepancy with Dr. Thorne",
      assignee: "Sarah Jenkins (Senior Paralegal)",
      priority: "high",
      completed: false,
      dueDate: "In 2 days",
    },
    {
      id: "t-2",
      title: "Finalize Kazarian Stage Two final merits memorandum",
      assignee: "Eleanor Vance, Esq. (Managing Attorney)",
      priority: "high",
      completed: false,
      dueDate: "In 5 days",
    },
    {
      id: "t-3",
      title: "Extract scholarly citations across IEEE & Nature publications",
      assignee: "Documento Intelligence Engine",
      priority: "medium",
      completed: true,
      dueDate: "Completed",
    },
    {
      id: "t-4",
      title: "Validate passport expiration date exceeds USCIS 6-month requirement",
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
      senderName: "Sarah Jenkins (Senior Paralegal)",
      text: "Dr. Thorne, our automated intake check identified that Exhibit E-2 lists your employment start date as Sept 1, 2021, whereas your CV states Oct 2021. Could you confirm which date your HR department officially recorded?",
      time: "Yesterday, 3:15 PM",
    },
    {
      id: "m-2",
      sender: "client",
      senderName: "Dr. Aris Thorne (Applicant)",
      text: "Hello Sarah. I officially commenced on September 1, 2021 as a visiting fellow before transitioning to full-time payroll on October 1. I have uploaded an HR confirmation letter clarifying both dates.",
      time: "Today, 10:20 AM",
    },
  ]);
  const [sampleReplyInput, setSampleReplyInput] = useState<string>("");

  const sampleDocs = [
    {
      id: "doc-a1",
      title: "Passport_Bio_Page_UK.pdf",
      category: "Identity",
      exhibitCode: "Exhibit A-1",
      size: "2.4 MB",
      hash: "e3b0c442...a53b",
      status: "verified",
      criterion: "Biographical & Identity Verification",
      pages: 2,
    },
    {
      id: "doc-b1",
      title: "PhD_Diploma_Oxford_Physics.pdf",
      category: "Academic",
      exhibitCode: "Exhibit B-1",
      size: "4.1 MB",
      hash: "cb8825fc...21ad",
      status: "verified",
      criterion: "Advanced Degree Threshold (8 CFR § 204.5(k))",
      pages: 1,
    },
    {
      id: "doc-c1",
      title: "IEEE_Quantum_Algorithm_Paper.pdf",
      category: "Publications",
      exhibitCode: "Exhibit C-1",
      size: "8.7 MB",
      hash: "8f4a2109...b76c",
      status: "verified",
      criterion: "Criterion 1: Authorship of Scholarly Articles (1,420 Citations)",
      pages: 14,
    },
    {
      id: "doc-d1",
      title: "US_Patent_US11489201_Quantum.pdf",
      category: "Patents",
      exhibitCode: "Exhibit D-1",
      size: "5.2 MB",
      hash: "19c3e982...98f4",
      status: "verified",
      criterion: "Criterion 2: Original Scientific Contribution",
      pages: 22,
    },
    {
      id: "doc-e2",
      title: "Employer_Support_Letter_MIT.pdf",
      category: "Support Letters",
      exhibitCode: "Exhibit E-2",
      size: "1.8 MB",
      hash: "7f83b165...9f80",
      status: "flagged",
      criterion: "Criterion 3: Critical Role in Distinguished Organization",
      pages: 4,
    },
    {
      id: "doc-f1",
      title: "Form_I-140_Draft_Part1-Part8.pdf",
      category: "Forms",
      exhibitCode: "Form Draft",
      size: "1.2 MB",
      hash: "3c990211...de51",
      status: "pending_review",
      criterion: "USCIS Immigrant Petition for Alien Worker",
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
        senderName: "Eleanor Vance, Esq. (Lead Counsel)",
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
      style={{
        padding: "72px 24px",
        background: "#F8F7F2",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        {/* Section Header */}
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
            <span>Interactive Operational Preview</span>
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
            Explore a representative case workspace.
          </h2>

          <p style={{ fontSize: "15px", color: "#445451", lineHeight: 1.55, margin: 0 }}>
            See how Documento organizes documents, identifies potential issues, and shows the next steps — all in one place.
          </p>
        </div>

        {/* Clean & Restrained Interactive Workspace Container */}
        <div
          className="animate-on-scroll delay-150"
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 4px 20px rgba(6, 60, 61, 0.05)",
            overflow: "hidden",
          }}
        >
          {/* Compact Case Header */}
          <div
            style={{
              background: "#FAFCFB",
              borderBottom: "1px solid #DCE5E1",
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                  CASE-US-8841: Dr. Aris Thorne
                </span>
                <span style={{ fontSize: "12px", color: "#A0B0AC" }}>•</span>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0D6866" }}>
                  EB-1A Extraordinary Ability (Form I-140)
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  background: "#DDEFE8",
                  color: "#063C3D",
                  fontSize: "11.5px",
                  fontWeight: 650,
                  padding: "3px 9px",
                  borderRadius: "6px",
                }}
              >
                Readiness: 68%
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 9px",
                  borderRadius: "6px",
                  background: "#FEF7EA",
                  border: "1px solid #F6D8A6",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#8A5A10",
                }}
              >
                <span>Illustrative Workspace • Synthetic Case Data</span>
              </span>
            </div>
          </div>

          {/* Compact Tab Selector Bar */}
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
                    padding: "12px 16px",
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
                      borderRadius: "10px",
                      fontWeight: 600,
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
                <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11.5px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Filing Readiness
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 750, color: "#063C3D" }}>68%</div>
                  <div style={{ fontSize: "12px", color: "#176B50", marginTop: "3px", fontWeight: 550 }}>
                    ✓ 3 of 10 Criteria Satisfied
                  </div>
                </div>

                <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11.5px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Active Status
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#8A5A10" }}>
                    Waiting on Firm Counsel
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
                    Client has 0 pending requests
                  </div>
                </div>

                <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11.5px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Target Submission Date
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    November 15, 2024
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                    32 business days remaining
                  </div>
                </div>

                <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "11.5px", color: "#6E7F7C", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Supervising Attorney
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    Eleanor Vance, Esq.
                  </div>
                  <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                    Lead Counsel (Bar # NY-4921)
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
                    { step: "Intake", status: "completed", desc: "Questionnaire submitted" },
                    { step: "Documents", status: "completed", desc: "6 exhibits verified" },
                    { step: "Review", status: "active", desc: "1 date flag under review" },
                    { step: "Package", status: "pending", desc: "Exhibit bundle assembly" },
                    { step: "Attorney Sign-off", status: "pending", desc: "Final USCIS evaluation" },
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
                          background: isCompleted ? "#F0F8F5" : isActive ? "#DDEFE8" : "#F8F7F2",
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

              {/* Restrained Progressive Tip */}
              <div
                style={{
                  background: "#FAFCFB",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "12.5px",
                  color: "#445451",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ color: "#0D6866", fontWeight: 700 }}>💡 Note:</span>
                <span>
                  Select any tab above to explore the Document Vault, procedural tasks, AI discrepancy resolution, or client messaging.
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
                <span style={{ fontSize: "12px", fontWeight: 650, color: "#6E7F7C", marginRight: "4px" }}>
                  Filter:
                </span>
                {["ALL", "Identity", "Academic", "Publications", "Patents", "Support Letters", "Forms"].map((cat) => {
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
                        fontWeight: 600,
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
                          padding: "10px 14px",
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
                              fontWeight: 650,
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
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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

                  <div style={{ background: "#FFFFFF", borderRadius: "6px", border: "1px solid #DCE5E1", padding: "10px 12px", marginBottom: "12px", fontSize: "11.5px", color: "#445451" }}>
                    <div style={{ marginBottom: "3px" }}>• <strong>Vault Storage:</strong> Encrypted AES-256 at Rest</div>
                    <div style={{ marginBottom: "3px" }}>• <strong>OCR Status:</strong> Parsed &amp; Coordinates Indexed</div>
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
                <div style={{ fontSize: "12px", color: "#0D6866", fontWeight: 650 }}>
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
                        onChange={() => {}} // controlled by wrapper click
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

              {/* Finding Card with Restrained Amber Review Treatment */}
              <div
                style={{
                  border: "1px solid",
                  borderColor: findingStatus === "resolved" ? "#B9DED4" : findingStatus === "escalated" ? "#0D6866" : "#F6D8A6",
                  background: findingStatus === "resolved" ? "#F8FDFB" : findingStatus === "escalated" ? "#F1F6F4" : "#FFFDF8",
                  borderRadius: "10px",
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
                    Rule: USCIS-CRIT-03-CHRONO
                  </span>
                </div>

                <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", margin: "0 0 6px 0" }}>
                  Employment Start Date Variance (Sept 1 vs Oct 1, 2021)
                </h4>

                <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                  Exhibit E-2 (MIT Employer Support Letter, Page 2, Para 3) lists appointment commencement as <strong>September 1, 2021</strong>. However, Exhibit E-1 (Curriculum Vitae) states full-time appointment as <strong>October 2021</strong>.
                </p>

                <div style={{ background: "#FFFFFF", padding: "8px 12px", borderRadius: "6px", border: "1px solid #DCE5E1", fontSize: "11.5px", color: "#063C3D", marginBottom: "14px" }}>
                  <strong>Source Provenance:</strong> [Exhibit_E2_SupportLetter.pdf • Page 2 • Bounding Box: (x: 140, y: 320, w: 410, h: 45)]
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
                  background: "#F8F7F2",
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
