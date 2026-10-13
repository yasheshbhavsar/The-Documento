"use client";

import React from "react";
import { PackageReadinessChecklist, ReadinessCheckItem } from "../../lib/types";

interface DeterministicReadinessChecklistProps {
  checklist: PackageReadinessChecklist;
  onAssemblePackage?: () => void;
  isLoading?: boolean;
}

export const DeterministicReadinessChecklist: React.FC<DeterministicReadinessChecklistProps> = ({
  checklist,
  onAssemblePackage,
  isLoading = false,
}) => {
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
    </div>
  );
};
