"use client";

import React, { useState } from "react";
import { EvidenceBackedSummary } from "../../lib/types";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";

interface EvidenceSummaryModalProps {
  summary: EvidenceBackedSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceSummaryModal: React.FC<EvidenceSummaryModalProps> = ({
  summary,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

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

  if (!isOpen || !summary) return null;

  const handleCopyMarkdown = () => {
    if (summary.summary_markdown) {
      navigator.clipboard.writeText(summary.summary_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        aria-labelledby="evidence-summary-modal-title"
        style={{
          background: "var(--surface, #ffffff)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "860px",
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
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Badge variant="action">{summary.jurisdiction} • {summary.visa_category}</Badge>
              <span style={{ fontSize: "12px", color: "var(--quiet, #64748b)" }}>
                Case: {summary.case_number}
              </span>
            </div>
            <h2 id="evidence-summary-modal-title" style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text, #172322)" }}>
              Evidence-Backed Case Brief — {summary.applicant_name}
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
            }}
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Verified Facts with exact document citations */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--text, #0f172a)" }}>
              ✅ Grounded Facts from Primary Evidence ({summary.verified_facts.length})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {summary.verified_facts.map((fact, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "var(--surface-subtle, #f8fafc)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--quiet, #64748b)", textTransform: "uppercase" }}>
                      {fact.category} • {fact.key}
                    </span>
                  </div>
                  <strong style={{ fontSize: "13px", color: "var(--text, #0f172a)" }}>
                    {fact.value}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#2563eb", marginTop: "2px" }}>
                    Source: [{fact.source_document}, Page {fact.source_page}]
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Statutory Evidence */}
          {summary.missing_statutory_evidence && summary.missing_statutory_evidence.length > 0 && (
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "#b91c1c" }}>
                ⚠️ Missing Statutory Requirements ({summary.missing_statutory_evidence.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {summary.missing_statutory_evidence.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      fontSize: "13px",
                      color: "#991b1b",
                    }}
                  >
                    • {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Clarification Questions */}
          {summary.suggested_clarification_questions && summary.suggested_clarification_questions.length > 0 && (
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--text, #0f172a)" }}>
                💬 Formulated Clarification Questions
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {summary.suggested_clarification_questions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      fontSize: "13px",
                    }}
                  >
                    <p style={{ margin: "0 0 4px 0", color: "#1e40af", fontWeight: 500, fontStyle: "italic" }}>
                      "{q.question}"
                    </p>
                    <span style={{ fontSize: "11px", color: "#3b82f6" }}>
                      Legal Rationale: {q.rationale}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explicit Uncertainty Disclosures */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--quiet, #64748b)" }}>
              ⚖️ Uncertainty & Statutory Limitations Disclosures
            </h3>
            <div
              style={{
                padding: "14px",
                borderRadius: "8px",
                background: "var(--surface-subtle, #f8fafc)",
                border: "1px dashed var(--border, #cbd5e1)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "12px",
                color: "var(--muted, #64748b)",
              }}
            >
              {summary.uncertainty_disclosures.map((u, idx) => (
                <div key={idx}>• {u}</div>
              ))}
            </div>
          </div>
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
          <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
            {copied ? "✓ Copied Markdown" : "📋 Copy Formatted Brief"}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
