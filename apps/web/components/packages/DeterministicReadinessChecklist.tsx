"use client";

import React, { useState, useEffect } from "react";
import {
  PackageReadinessChecklist,
  ReadinessCheckItem,
  PackageBlockerReport,
  BlockerExplanation,
} from "../../lib/types";
import { getPackageBlockersExplanation } from "../../lib/api";

interface DeterministicReadinessChecklistProps {
  checklist: PackageReadinessChecklist;
  onAssemblePackage?: () => void;
  isLoading?: boolean;
  caseId?: string;
  blockerReport?: PackageBlockerReport;
  onBlockerAction?: (actionUrl: string) => void;
}

export const DeterministicReadinessChecklist: React.FC<DeterministicReadinessChecklistProps> = ({
  checklist,
  onAssemblePackage,
  isLoading = false,
  caseId,
  blockerReport,
  onBlockerAction,
}) => {
  const targetCaseId = caseId || checklist.case_id;
  const [report, setReport] = useState<PackageBlockerReport | null>(blockerReport || null);
  const [loadingBlockers, setLoadingBlockers] = useState<boolean>(false);
  const [showBlockersSection, setShowBlockersSection] = useState<boolean>(true);

  useEffect(() => {
    if (blockerReport) {
      setReport(blockerReport);
      return;
    }
    if (targetCaseId) {
      let active = true;
      setLoadingBlockers(true);
      getPackageBlockersExplanation(targetCaseId)
        .then((res) => {
          if (active && res) {
            setReport(res);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoadingBlockers(false);
        });
      return () => {
        active = false;
      };
    }
  }, [targetCaseId, blockerReport]);
  const getStatusBadge = (item: ReadinessCheckItem) => {
    switch (item.status) {
      case "passed":
        return (
          <span
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "999px",
              background: "#ECFDF5",
              color: "#065F46",
              border: "1px solid #A7F3D0",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: "#10B981" }} />
            Passed
          </span>
        );
      case "warning":
        return (
          <span
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "999px",
              background: "#FFFBEB",
              color: "#92400E",
              border: "1px solid #FDE68A",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: "#F59E0B" }} />
            Warning
          </span>
        );
      case "failed":
        return (
          <span
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "999px",
              background: "#FEF2F2",
              color: "#991B1B",
              border: "1px solid #FECACA",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: "#EF4444" }} />
            {item.is_blocking ? "Blocking Failure" : "Action Needed"}
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "999px",
              background: "#F3F4F6",
              color: "#4B5563",
              border: "1px solid #E5E7EB",
            }}
          >
            N/A
          </span>
        );
    }
  };

  return (
    <div
      data-testid="readiness-checklist"
      style={{
        background: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid #DCE5E1",
        boxShadow: "0 6px 24px rgba(6, 60, 61, 0.06)",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* Top Banner with Strict Regulatory Disclaimer */}
      <div
        style={{
          padding: "24px 28px",
          background: "linear-gradient(135deg, #063C3D 0%, #084B4C 100%)",
          color: "#FFFFFF",
          borderBottom: "1px solid rgba(185, 222, 212, 0.2)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "11px",
                  color: "#B9DED4",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <span>Case: {checklist.case_number}</span>
                <span>•</span>
                <span>Evaluated: {new Date(checklist.evaluated_at).toLocaleString()}</span>
              </div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  margin: "6px 0 0 0",
                  color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                }}
              >
                Deterministic Case Readiness Checklist
              </h2>
              <p style={{ fontSize: "12px", color: "#DDEFE8", margin: "4px 0 0 0", maxWidth: "620px", lineHeight: "1.5" }}>
                Internal checklist auditing 10 statutory and procedural dimensions required prior to submission package assembly.
              </p>
            </div>

            {/* Assembly Status & Action */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <div
                style={{
                  textAlign: "right",
                  background: "rgba(255, 255, 255, 0.08)",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <div style={{ fontSize: "11px", color: "#B9DED4", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Package Assembly Readiness
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
                  {checklist.is_ready_for_package_assembly ? (
                    <span style={{ color: "#34D399", display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                      ✓ Clear for Assembly
                    </span>
                  ) : (
                    <span style={{ color: "#FCA5A5", display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                      ✕ Blocked by {checklist.blocking_failures_count} Check(s)
                    </span>
                  )}
                </div>
              </div>

              {onAssemblePackage && (
                <button
                  type="button"
                  disabled={!checklist.is_ready_for_package_assembly || isLoading}
                  onClick={onAssemblePackage}
                  style={{
                    padding: "11px 20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    borderRadius: "8px",
                    border: "none",
                    cursor: checklist.is_ready_for_package_assembly && !isLoading ? "pointer" : "not-allowed",
                    background: checklist.is_ready_for_package_assembly ? "#0D6866" : "rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    boxShadow: "0 2px 8px rgba(6, 60, 61, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isLoading ? "Assembling..." : "Assemble Filing Package"}
                </button>
              )}
            </div>
          </div>

          {/* Regulatory Ethics Disclaimer Box */}
          <div
            style={{
              marginTop: "8px",
              padding: "12px 18px",
              background: "rgba(13, 104, 102, 0.45)",
              borderRadius: "10px",
              border: "1px solid rgba(185, 222, 212, 0.3)",
              fontSize: "12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              color: "#F8F7F2",
              lineHeight: "1.5",
            }}
          >
            <span style={{ fontSize: "16px", marginTop: "1px" }}>🛡️</span>
            <div>
              <strong style={{ color: "#FFFFFF" }}>Regulatory Disclaimer: </strong>
              {checklist.prohibition_disclaimer ||
                "Readiness means only that the defined internal checks have been evaluated. Under legal ethics guidelines, this software does not calculate or display a probability of government approval."}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          borderBottom: "1px solid #E2E8E4",
          background: "#F8F9F8",
        }}
      >
        <div style={{ padding: "18px 24px", textAlign: "center", borderRight: "1px solid #E2E8E4" }}>
          <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Evaluated Checks
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#172322", marginTop: "4px" }}>
            {checklist.total_checks_evaluated} / 10
          </div>
        </div>
        <div style={{ padding: "18px 24px", textAlign: "center", borderRight: "1px solid #E2E8E4" }}>
          <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Passed Checks
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
            {checklist.passed_checks_count}
          </div>
        </div>
        <div style={{ padding: "18px 24px", textAlign: "center", borderRight: "1px solid #E2E8E4" }}>
          <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Warnings / Open Items
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#D97706", marginTop: "4px" }}>
            {checklist.warnings_count}
          </div>
        </div>
        <div style={{ padding: "18px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Blocking Failures
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: checklist.blocking_failures_count > 0 ? "#DC2626" : "#059669",
              marginTop: "4px",
            }}
          >
            {checklist.blocking_failures_count}
          </div>
        </div>
      </div>

      {/* The 10 Checklist Items */}
      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "10px", background: "#FFFFFF" }}>
        {checklist.checks.map((item, idx) => (
          <div
            key={item.code}
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              background: item.status === "failed" ? "#FFF8F8" : item.status === "warning" ? "#FFFDF5" : "#FAFAF8",
              border: item.status === "failed" ? "1.5px solid #FECACA" : item.status === "warning" ? "1.5px solid #FDE68A" : "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1, minWidth: "280px" }}>
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  background: item.status === "passed" ? "#EAF6F0" : item.status === "warning" ? "#FEF3C7" : "#FEE2E2",
                  color: item.status === "passed" ? "#063C3D" : item.status === "warning" ? "#92400E" : "#991B1B",
                  fontSize: "12px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                {idx + 1}
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#172322", margin: 0 }}>
                    {item.name}
                  </h4>
                  {item.is_blocking && item.status !== "passed" && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#DC2626",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        background: "#FEE2E2",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        border: "1px solid #FCA5A5",
                      }}
                    >
                      Blocking
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "4px 0 0 0", lineHeight: "1.4" }}>
                  {item.summary}
                </p>
              </div>
            </div>

            <div style={{ flexShrink: 0 }}>
              {getStatusBadge(item)}
            </div>
          </div>
        ))}
      </div>

      {/* Deterministic Blocker Explanations Section */}
      <div
        data-testid="deterministic-blockers-section"
        style={{
          borderTop: "2px solid #E2E8E4",
          background: "#F8FAF9",
          padding: "24px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🔍</span>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#172322", margin: 0 }}>
                Deterministic Blocker Explanations & Root Cause Traces
              </h3>
              {report && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: report.critical_blockers_count > 0 ? "#FEE2E2" : "#ECFDF5",
                    color: report.critical_blockers_count > 0 ? "#991B1B" : "#065F46",
                    border: report.critical_blockers_count > 0 ? "1px solid #FCA5A5" : "1px solid #A7F3D0",
                  }}
                >
                  {report.critical_blockers_count} Critical Blocker(s) • {report.warning_blockers_count} Warning(s)
                </span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "4px 0 0 0" }}>
              Translates deterministic package blockers and status/reason codes into explicit explanations with statutory context and remediation workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBlockersSection(!showBlockersSection)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid #D1D5DB",
              background: "#FFFFFF",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            {showBlockersSection ? "Collapse Explanations" : "Expand Explanations"}
          </button>
        </div>

        {showBlockersSection && (
          <div>
            {loadingBlockers ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#6E7F7C", fontSize: "12px" }}>
                Evaluating deterministic blocker rules across onboarding, holds, reviews, and documents...
              </div>
            ) : report?.blockers && report.blockers.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {report.blockers.map((b) => (
                  <div
                    key={b.blocker_code}
                    data-testid={`blocker-item-${b.blocker_code}`}
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "10px",
                      border: b.severity === "CRITICAL_BLOCKER" ? "1.5px solid #FECACA" : "1px solid #FDE68A",
                      padding: "16px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            fontFamily: "monospace",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: b.severity === "CRITICAL_BLOCKER" ? "#FEE2E2" : "#FEF3C7",
                            color: b.severity === "CRITICAL_BLOCKER" ? "#991B1B" : "#92400E",
                          }}
                        >
                          {b.blocker_code}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "monospace",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#F3F4F6",
                            color: "#4B5563",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          STATUS: {b.status_code}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#EEF2FF",
                            color: "#3730A3",
                          }}
                        >
                          {b.category.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: b.severity === "CRITICAL_BLOCKER" ? "#DC2626" : "#D97706",
                        }}
                      >
                        {b.severity === "CRITICAL_BLOCKER" ? "⛔ CRITICAL BLOCKER" : "⚠️ WARNING"}
                      </span>
                    </div>

                    <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "10px 0 4px 0" }}>
                      {b.title}
                    </h4>
                    <p style={{ fontSize: "13px", color: "#374151", margin: "0 0 8px 0", lineHeight: "1.5" }}>
                      {b.explanation}
                    </p>

                    {b.statutory_context && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#4B5563",
                          background: "#F9FAFB",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #E5E7EB",
                          marginBottom: "10px",
                        }}
                      >
                        <strong>Statutory / Governance Context:</strong> {b.statutory_context}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "8px",
                        paddingTop: "8px",
                        borderTop: "1px solid #F3F4F6",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "#065F46", fontWeight: 600 }}>
                        <span style={{ marginRight: "4px" }}>🔧</span> Remediation: {b.remediation_action}
                      </div>
                      {b.action_url && onBlockerAction && (
                        <button
                          type="button"
                          onClick={() => onBlockerAction(b.action_url!)}
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            background: "#0D6866",
                            color: "#FFFFFF",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Navigate to Resolve →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  color: "#065F46",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✓</span>
                <strong>Zero package assembly blockers detected.</strong> All onboarding clearances, progressive reviews, and document integrity checks are in ready state.
              </div>
            )}

            {/* Guardrail Disclaimer */}
            <div
              style={{
                marginTop: "14px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "#FEF3C7",
                border: "1px solid #FDE68A",
                color: "#92400E",
                fontSize: "11px",
                lineHeight: "1.4",
              }}
            >
              <strong>AI Guardrail:</strong> {report?.guardrail_notice || "AI does not decide legal eligibility, authenticity, fraud, or legal sufficiency. All blocker checks evaluate deterministic system rules."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
