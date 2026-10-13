"use client";

import React, { useState } from "react";
import { AIFinding } from "../../lib/types";

interface CaseDiscrepancyAlertCenterProps {
  caseId: string;
  findings: AIFinding[];
  onResolveFinding?: (findingId: string, note: string) => Promise<void>;
  onEscalateFinding?: (findingId: string, note: string) => Promise<void>;
  onInspectDocument?: (docId: string) => void;
}

export function CaseDiscrepancyAlertCenter({
  caseId,
  findings,
  onResolveFinding,
  onEscalateFinding,
  onInspectDocument,
}: CaseDiscrepancyAlertCenterProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Filter discrepancies and contradictions for this case
  const caseDiscrepancies = findings.filter(
    (f) =>
      (f.case_id === caseId || !f.case_id) &&
      (f.finding_type === "consistency_discrepancy" ||
        f.finding_type === "direct_contradiction" ||
        f.category === "contradiction" ||
        f.category === "consistency" ||
        f.severity === "critical" ||
        f.severity === "major")
  );

  const activeDiscrepancies = caseDiscrepancies.filter((f) => f.status !== "resolved" && f.status !== "dismissed");
  const resolvedCount = caseDiscrepancies.filter((f) => f.status === "resolved").length;

  if (caseDiscrepancies.length === 0) {
    return (
      <div
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(6, 60, 61, 0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#DCFCE7",
              border: "1px solid #86EFAC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#166534",
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#166534" }}>
              Zero Cross-Document Discrepancies
            </span>
            <span style={{ fontSize: "13px", color: "#4B7268", marginLeft: "8px" }}>
              — All evidentiary records cross-match client profile.
            </span>
          </div>
        </div>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "20px",
            background: "#DCFCE7",
            color: "#166534",
            border: "1px solid #86EFAC",
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: 700,
          }}
        >
          ✓ Consistency Verified
        </span>
      </div>
    );
  }

  const handleStartResolve = (id: string) => {
    setResolvingId(id);
    setResolutionNote("");
  };

  const handleConfirmResolve = async (findingId: string) => {
    if (!resolutionNote.trim()) return;
    setIsSubmitting(true);
    try {
      if (onResolveFinding) {
        await onResolveFinding(findingId, resolutionNote.trim());
      }
      setResolvingId(null);
      setResolutionNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmEscalate = async (findingId: string) => {
    setIsSubmitting(true);
    try {
      if (onEscalateFinding) {
        await onEscalateFinding(findingId, "Escalated for senior immigration counsel legal disposition review.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: "14px",
        border: "1px solid #DCE5E1",
        background: "#FFFFFF",
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(6, 60, 61, 0.05)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Alert Header Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "14px 20px",
          background: activeDiscrepancies.length > 0 ? "#FFFBEB" : "#F8F7F2",
          borderBottom: "1px solid #DCE5E1",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: activeDiscrepancies.length > 0 ? "#D97706" : "#16A34A",
              boxShadow:
                activeDiscrepancies.length > 0
                  ? "0 0 0 3px rgba(217, 119, 6, 0.2)"
                  : "0 0 0 3px rgba(22, 163, 74, 0.2)",
              display: "inline-block",
            }}
          />
          <h4
            style={{
              margin: 0,
              fontWeight: 750,
              fontSize: "13px",
              color: "#063C3D",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Cross-Document Discrepancy & Consistency Audit
          </h4>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
              background: activeDiscrepancies.length > 0 ? "#FEF3C7" : "#EAF6F0",
              color: activeDiscrepancies.length > 0 ? "#92400E" : "#0D6866",
              border: activeDiscrepancies.length > 0 ? "1px solid #FCD34D" : "1px solid #B9DED4",
            }}
          >
            {activeDiscrepancies.length} Action Required
          </span>
          {resolvedCount > 0 && (
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 650,
                background: "#DCFCE7",
                color: "#166534",
                border: "1px solid #86EFAC",
              }}
            >
              {resolvedCount} Resolved
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#6E7F7C",
            fontWeight: 500,
            background: "#FFFFFF",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid #DCE5E1",
          }}
        >
          Evidence Grounded • Non-Binding Intelligence
        </div>
      </div>

      {/* Discrepancy Items List */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {caseDiscrepancies.map((finding) => {
          const isResolved = finding.status === "resolved";
          const isContradiction =
            finding.is_confirmed_contradiction ||
            finding.category === "contradiction" ||
            finding.finding_type === "direct_contradiction";
          const isExpanded = expandedFindingId === finding.id;
          const isResolving = resolvingId === finding.id;

          let cardBg = "#FFFFFF";
          let borderLeftColor = "#D97706";
          let badgeBg = "#FEF3C7";
          let badgeColor = "#92400E";
          let badgeBorder = "#FCD34D";
          let badgeLabel = "ℹ️ Cross-Record Discrepancy";

          if (isResolved) {
            cardBg = "#F8FAF9";
            borderLeftColor = "#16A34A";
            badgeBg = "#DCFCE7";
            badgeColor = "#166534";
            badgeBorder = "#86EFAC";
            badgeLabel = "✓ RESOLVED";
          } else if (isContradiction) {
            cardBg = "#FFFDFD";
            borderLeftColor = "#DC2626";
            badgeBg = "#FEE2E2";
            badgeColor = "#991B1B";
            badgeBorder = "#FECACA";
            badgeLabel = "⚠️ Evidence Contradiction";
          }

          return (
            <div
              key={finding.id}
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #EAEFEA",
                borderLeft: `4px solid ${borderLeftColor}`,
                background: cardBg,
                transition: "background 0.15s ease",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {/* Top Row: Badges, Title, Action Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "280px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`,
                      }}
                    >
                      {badgeLabel}
                    </span>

                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#063C3D" }}>
                      {finding.title}
                    </span>
                  </div>

                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#445451", lineHeight: "1.5" }}>
                    {finding.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {!isResolved && !isResolving && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartResolve(finding.id)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 650,
                          borderRadius: "6px",
                          background: "#EAF6F0",
                          color: "#0D6866",
                          border: "1px solid #B9DED4",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ✓ Resolve with Affidavit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmEscalate(finding.id)}
                        disabled={isSubmitting}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "6px",
                          background: "#F8F7F2",
                          color: "#445451",
                          border: "1px solid #DCE5E1",
                          cursor: isSubmitting ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        Escalate
                      </button>
                    </>
                  )}

                  {/* Expand / Collapse Details */}
                  <button
                    type="button"
                    onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "12px",
                      color: "#0D6866",
                      fontWeight: 600,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {isExpanded ? "Hide Audit History ▲" : "View Audit History ▼"}
                  </button>
                </div>
              </div>

              {/* Conflicting Evidence Snippets */}
              {finding.evidence_text && (
                <div
                  style={{
                    marginTop: "4px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F8F7F2",
                    border: "1px solid #E2EAE6",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#0D6866",
                      textTransform: "uppercase",
                      fontWeight: 750,
                      letterSpacing: "0.04em",
                      marginBottom: "4px",
                    }}
                  >
                    Evidentiary Grounding Comparison
                  </div>
                  <div
                    style={{
                      color: "#172322",
                      whiteSpace: "pre-line",
                      lineHeight: "1.5",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    {finding.evidence_text}
                  </div>
                </div>
              )}

              {/* Recommended Legal Strategy */}
              {finding.recommended_action && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#063C3D",
                    background: "#F1F6F4",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#0D6866", flexShrink: 0 }}>
                    Recommended Action:
                  </span>
                  <span style={{ color: "#172322" }}>{finding.recommended_action}</span>
                </div>
              )}

              {/* Inline Resolution Drawer */}
              {isResolving && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "16px",
                    background: "#FFFBEB",
                    border: "1.5px solid #FCD34D",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#92400E" }}>
                      Record Discrepancy Resolution & Legal Rationale
                    </span>
                    <button
                      type="button"
                      onClick={() => setResolvingId(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6E7F7C",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="e.g., Client executed name transliteration affidavit conforming with USCIS Form G-28..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #FCD34D",
                      background: "#FFFFFF",
                      color: "#172322",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />

                  {/* Quick-fill template chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[
                      "Client executed sworn name affidavit",
                      "Standardized transliteration matches passport bio",
                      "Evidence clarification letter drafted for exhibit index",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setResolutionNote(chip)}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "#FEF3C7",
                          color: "#92400E",
                          border: "1px solid #FDE68A",
                          cursor: "pointer",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setResolvingId(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #DCE5E1",
                        color: "#445451",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmResolve(finding.id)}
                      disabled={isSubmitting || !resolutionNote.trim()}
                      style={{
                        padding: "6px 16px",
                        fontSize: "12px",
                        fontWeight: 650,
                        borderRadius: "6px",
                        background: "#0D6866",
                        color: "#FFFFFF",
                        border: "none",
                        cursor: isSubmitting || !resolutionNote.trim() ? "not-allowed" : "pointer",
                        opacity: isSubmitting || !resolutionNote.trim() ? 0.6 : 1,
                      }}
                    >
                      {isSubmitting ? "Recording..." : "Save Resolution & Sign Off"}
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Resolution Audit Trail */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid #EAEFEA",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#6E7F7C",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Discrepancy Audit Trail
                  </div>
                  {finding.resolution_history && finding.resolution_history.length > 0 ? (
                    finding.resolution_history.map((hist, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#F8F7F2",
                          border: "1px solid #DCE5E1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>
                            {hist.action}:
                          </span>{" "}
                          <span style={{ color: "#172322" }}>{hist.note || hist.reason}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#6E7F7C", fontFamily: "monospace" }}>
                          {hist.reviewer_email || "Counsel"} • {new Date(hist.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "12px", color: "#6E7F7C", fontStyle: "italic" }}>
                      No prior resolution events recorded. Finding currently in initial flagged status.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
