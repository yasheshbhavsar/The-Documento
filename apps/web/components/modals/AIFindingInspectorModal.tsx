"use client";

import React, { useState } from "react";
import { AIFinding, VALID_DISMISSAL_REASONS } from "../../lib/types";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";

interface AIFindingInspectorModalProps {
  finding: AIFinding | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (findingId: string, note: string) => Promise<void>;
  onDismiss: (findingId: string, reason: string, note: string) => Promise<void>;
  onEscalate: (findingId: string, note: string) => Promise<void>;
}

export const AIFindingInspectorModal: React.FC<AIFindingInspectorModalProps> = ({
  finding,
  isOpen,
  onClose,
  onResolve,
  onDismiss,
  onEscalate,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "disposition" | "history">("details");
  const [dispositionMode, setDispositionMode] = useState<"resolve" | "dismiss" | "escalate">("resolve");
  const [resolveNote, setResolveNote] = useState("");
  const [dismissReason, setDismissReason] = useState<string>(VALID_DISMISSAL_REASONS[0].value);
  const [dismissNote, setDismissNote] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [copiedQuestion, setCopiedQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !finding) return null;

  const handleCopyQuestion = () => {
    if (finding.clarification_question) {
      navigator.clipboard.writeText(finding.clarification_question);
      setCopiedQuestion(true);
      setTimeout(() => setCopiedQuestion(false), 2500);
    }
  };

  const handleResolve = async () => {
    if (!resolveNote.trim()) {
      setErrorMsg("Please provide an explanatory resolution note before completing this finding.");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onResolve(finding.id, resolveNote.trim());
      setResolveNote("");
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to resolve finding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (!dismissNote.trim()) {
      setErrorMsg("A detailed justification note is required to dismiss an AI discrepancy finding.");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onDismiss(finding.id, dismissReason, dismissNote.trim());
      setDismissNote("");
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to dismiss finding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalateNote.trim()) {
      setErrorMsg("Please provide guidance notes for senior counsel escalation.");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onEscalate(finding.id, escalateNote.trim());
      setEscalateNote("");
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to escalate finding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "action";
      case "major":
      case "warning":
        return "warning";
      case "minor":
        return "neutral";
      default:
        return "info";
    }
  };

  const isResolvedOrDismissed = finding.status === "resolved" || finding.status === "dismissed";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-finding-inspector-title"
        style={{
          background: "var(--surface, #ffffff)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "840px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--border, #e2e8f0)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            background: "var(--surface-subtle, #F1F6F4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1, paddingRight: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--quiet, #64748b)" }}>
                ID: {finding.id}
              </span>
              <Badge variant={getSeverityBadgeVariant(finding.severity)}>
                {finding.severity.toUpperCase()}
              </Badge>
              {finding.is_confirmed_contradiction ? (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "#fef2f2",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                  }}
                >
                  ⚠️ CONFIRMED CONTRADICTION
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "#eff6ff",
                    color: "#2563eb",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  ℹ️ POTENTIAL DISCREPANCY / VARIATION
                </span>
              )}
              <Badge variant={isResolvedOrDismissed ? "success" : "neutral"}>
                {finding.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <h2 id="ai-finding-inspector-title" style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text, #172322)" }}>
              {finding.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "var(--muted, #64748b)",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* TABS */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            padding: "0 24px",
            background: "var(--surface, #ffffff)",
          }}
        >
          <button
            onClick={() => setActiveTab("details")}
            style={{
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              color: activeTab === "details" ? "var(--primary, #0f172a)" : "var(--muted, #64748b)",
              borderBottom: activeTab === "details" ? "2px solid var(--primary, #0f172a)" : "2px solid transparent",
            }}
          >
            🔍 Evidence & Analysis
          </button>
          <button
            onClick={() => setActiveTab("disposition")}
            style={{
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              color: activeTab === "disposition" ? "var(--primary, #0f172a)" : "var(--muted, #64748b)",
              borderBottom: activeTab === "disposition" ? "2px solid var(--primary, #0f172a)" : "2px solid transparent",
            }}
          >
            ⚖️ Reviewer Disposition {isResolvedOrDismissed ? "(Completed)" : ""}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              color: activeTab === "history" ? "var(--primary, #0f172a)" : "var(--muted, #64748b)",
              borderBottom: activeTab === "history" ? "2px solid var(--primary, #0f172a)" : "2px solid transparent",
            }}
          >
            📜 Audit History ({finding.resolution_history?.length || 0})
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {errorMsg && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "6px",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "13px",
                border: "1px solid #fecaca",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* TAB 1: EVIDENCE & ANALYSIS */}
          {activeTab === "details" && (
            <>
              {/* Description & Observed Issue */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)", display: "block", marginBottom: "6px" }}>
                  Observed Issue & Context
                </label>
                <div
                  style={{
                    padding: "14px",
                    background: "var(--surface-subtle, #f8fafc)",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    color: "var(--text, #1e293b)",
                  }}
                >
                  {finding.description}
                </div>
              </div>

              {/* Cited Evidence & Source Location */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)", display: "block", marginBottom: "6px" }}>
                  Evidence & Traceable Source
                </label>
                <div
                  style={{
                    padding: "14px",
                    background: "#fdf8f6",
                    borderRadius: "8px",
                    border: "1px solid #fed7aa",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#9a3412" }}>📄 Document:</span>
                    <span style={{ fontSize: "13px", color: "var(--text, #1e293b)" }}>
                      {finding.source_location?.document_title || finding.related_documents?.[0]?.title || "Case Record"}
                    </span>
                    {(finding.source_location?.page || finding.related_documents?.[0]?.page) && (
                      <Badge variant="neutral">Page {finding.source_location?.page || finding.related_documents?.[0]?.page}</Badge>
                    )}
                  </div>
                  {finding.evidence_text && (
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#ffffff",
                        borderRadius: "6px",
                        border: "1px solid #ffedd5",
                        fontSize: "13px",
                        fontFamily: "monospace",
                        color: "#7c2d12",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {finding.evidence_text}
                    </div>
                  )}
                </div>
              </div>

              {/* Related Fields Comparison (if present) */}
              {finding.related_fields && finding.related_fields.length > 0 && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)", display: "block", marginBottom: "6px" }}>
                    Extracted Field Discrepancy Breakdown
                  </label>
                  <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "var(--surface-subtle, #f8fafc)", textAlign: "left" }}>
                          <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border, #e2e8f0)" }}>Field</th>
                          <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border, #e2e8f0)" }}>Raw Value</th>
                          <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border, #e2e8f0)" }}>Normalized Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finding.related_fields.map((rf, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{rf.field_label || rf.field_name}</td>
                            <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#b91c1c" }}>{rf.original_value || "—"}</td>
                            <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0369a1" }}>{rf.normalized_value || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Statutory Requirement & Recommendation */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)", display: "block", marginBottom: "6px" }}>
                    Relevant Statutory Framework
                  </label>
                  <div
                    style={{
                      padding: "12px",
                      background: "var(--surface-subtle, #f8fafc)",
                      borderRadius: "6px",
                      border: "1px solid var(--border, #e2e8f0)",
                      fontSize: "13px",
                      color: "var(--text, #1e293b)",
                    }}
                  >
                    <strong>{finding.relevant_requirement || finding.citation || "Case Consistency Benchmark"}</strong>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)", display: "block", marginBottom: "6px" }}>
                    Recommended Next Action
                  </label>
                  <div
                    style={{
                      padding: "12px",
                      background: "#f0fdf4",
                      borderRadius: "6px",
                      border: "1px solid #bbf7d0",
                      fontSize: "13px",
                      color: "#166534",
                      fontWeight: 500,
                    }}
                  >
                    {finding.recommended_action || "Review discrepancy with applicant prior to petition assembly."}
                  </div>
                </div>
              </div>

              {/* Suggested Clarification Question */}
              {finding.clarification_question && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)" }}>
                      Suggested Client / Sponsor Clarification Question
                    </label>
                    <Button variant="outline" size="sm" onClick={handleCopyQuestion}>
                      {copiedQuestion ? "✓ Copied to Clipboard" : "📋 Copy Question"}
                    </Button>
                  </div>
                  <div
                    style={{
                      padding: "14px",
                      background: "#eff6ff",
                      borderRadius: "8px",
                      border: "1px solid #bfdbfe",
                      fontSize: "13px",
                      color: "#1e40af",
                      lineHeight: "1.5",
                      fontStyle: "italic",
                    }}
                  >
                    "{finding.clarification_question}"
                  </div>
                </div>
              )}

              {/* Explicit Uncertainty & Guardrail Statement */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--quiet, #64748b)", display: "block", marginBottom: "6px" }}>
                  AI Uncertainty & Analytical Limitations
                </label>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--surface-subtle, #f8fafc)",
                    borderRadius: "6px",
                    border: "1px dashed var(--border, #cbd5e1)",
                    fontSize: "12px",
                    color: "var(--muted, #64748b)",
                  }}
                >
                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Limitation Notice:</strong> {finding.uncertainty_limitations || "Automated algorithmic check based exclusively on uploaded files."}
                  </p>
                  <span style={{ fontSize: "11px", color: "var(--quiet, #94a3b8)" }}>
                    ⚖️ Strict Platform Guardrail: The AI does not make definitive fraud determinations, invent evidence, or predict adjudication outcomes. Authorized legal professionals must review all findings.
                  </span>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: REVIEWER DISPOSITION */}
          {activeTab === "disposition" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {isResolvedOrDismissed ? (
                <div
                  style={{
                    padding: "16px",
                    background: "#f0fdf4",
                    borderRadius: "8px",
                    border: "1px solid #bbf7d0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>✅</span>
                    <strong style={{ color: "#166534", fontSize: "14px" }}>
                      This finding is currently {finding.status.toUpperCase()}
                    </strong>
                  </div>
                  {finding.resolution_reason && (
                    <div style={{ fontSize: "13px", color: "#14532d" }}>
                      <strong>Dismissal Reason:</strong> {finding.resolution_reason.replace("_", " ")}
                    </div>
                  )}
                  {finding.resolved_at && (
                    <div style={{ fontSize: "12px", color: "#15803d" }}>
                      <strong>Timestamp:</strong> {new Date(finding.resolved_at).toLocaleString()}
                    </div>
                  )}
                  <p style={{ fontSize: "13px", color: "#166534", margin: "4px 0 0 0" }}>
                    You can submit a new disposition below to update or re-evaluate the record.
                  </p>
                </div>
              ) : null}

              {/* Disposition Mode Selector */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "8px" }}>
                  Select Review Action
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setDispositionMode("resolve")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "6px",
                      border: dispositionMode === "resolve" ? "2px solid #16a34a" : "1px solid var(--border, #cbd5e1)",
                      background: dispositionMode === "resolve" ? "#f0fdf4" : "var(--surface, #ffffff)",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ color: "#16a34a", fontSize: "14px" }}>✓ Resolve Finding</div>
                    <div style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                      Issue addressed, reconciled, or documented in petition.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispositionMode("dismiss")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "6px",
                      border: dispositionMode === "dismiss" ? "2px solid #ca8a04" : "1px solid var(--border, #cbd5e1)",
                      background: dispositionMode === "dismiss" ? "#fefce8" : "var(--surface, #ffffff)",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ color: "#ca8a04", fontSize: "14px" }}>⊘ Dismiss with Reason</div>
                    <div style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                      Harmless transliteration, scan artifact, or exception.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispositionMode("escalate")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "6px",
                      border: dispositionMode === "escalate" ? "2px solid #dc2626" : "1px solid var(--border, #cbd5e1)",
                      background: dispositionMode === "escalate" ? "#fef2f2" : "var(--surface, #ffffff)",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ color: "#dc2626", fontSize: "14px" }}>⬆ Escalate Finding</div>
                    <div style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                      Flag for Supervising Counsel or Partner review.
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode-specific forms */}
              {dispositionMode === "resolve" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Resolution Rationale & Case Notes *
                    </label>
                    <textarea
                      rows={4}
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="e.g., Verified spelling difference is standard Cyrillic transliteration. Added alias 'Yelena' to Form I-140 Part 3."
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <Button variant="primary" onClick={handleResolve} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Confirm & Resolve Finding"}
                  </Button>
                </div>
              )}

              {dispositionMode === "dismiss" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Mandatory Structured Dismissal Reason *
                    </label>
                    <select
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: "13px",
                      }}
                    >
                      {VALID_DISMISSAL_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Legal Justification Note *
                    </label>
                    <textarea
                      rows={4}
                      value={dismissNote}
                      onChange={(e) => setDismissNote(e.target.value)}
                      placeholder="Explain why this finding is dismissed under the selected statutory reason..."
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <Button variant="secondary" onClick={handleDismiss} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Dismiss Finding with Recorded Reason"}
                  </Button>
                </div>
              )}

              {dispositionMode === "escalate" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Escalation Context & Legal Query *
                    </label>
                    <textarea
                      rows={4}
                      value={escalateNote}
                      onChange={(e) => setEscalateNote(e.target.value)}
                      placeholder="Explain the critical contradiction or evidentiary ambiguity requiring Senior Attorney determination..."
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <Button variant="danger" onClick={handleEscalate} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Escalate Finding to Senior Reviewer"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESOLUTION AUDIT HISTORY */}
          {activeTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(!finding.resolution_history || finding.resolution_history.length === 0) ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--muted, #64748b)" }}>
                  No resolution actions recorded yet. Finding is pending caseworker review.
                </div>
              ) : (
                finding.resolution_history.map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #e2e8f0)",
                      background: "var(--surface-subtle, #f8fafc)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "13px", textTransform: "capitalize" }}>
                          {entry.action} Action
                        </strong>
                        {entry.reason && (
                          <Badge variant="neutral">{entry.reason.replace("_", " ")}</Badge>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--quiet, #64748b)" }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {entry.reviewer_email && (
                      <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
                        Reviewed by: {entry.reviewer_email}
                      </span>
                    )}
                    {entry.note && (
                      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text, #1e293b)" }}>
                        "{entry.note}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            background: "var(--surface-subtle, #f8fafc)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--quiet, #64748b)" }}>
            Case: {finding.case_id} • Immutable Audit Preservation Active
          </span>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
