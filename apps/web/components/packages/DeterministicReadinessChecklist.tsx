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
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Passed
          </span>
        );
      case "warning":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Warning
          </span>
        );
      case "failed":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {item.is_blocking ? "Blocking Failure" : "Action Needed"}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            N/A
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="readiness-checklist">
      {/* Top Banner with Strict Regulatory Disclaimer */}
      <div style={{ padding: "24px", background: "#063C3D", color: "#FFFFFF" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#B9DED4", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>Case: {checklist.case_number}</span>
                <span>•</span>
                <span>Evaluated: {new Date(checklist.evaluated_at).toLocaleString()}</span>
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0 0", color: "#FFFFFF" }}>Deterministic Case Readiness Checklist</h2>
              <p style={{ fontSize: "12px", color: "#DDEFE8", margin: "4px 0 0 0", maxWidth: "600px" }}>
                Internal checklist auditing 10 statutory and procedural dimensions required prior to submission package assembly.
              </p>
            </div>

            {/* Assembly Status & Action */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#B9DED4" }}>Package Assembly Readiness</div>
                <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
                  {checklist.is_ready_for_package_assembly ? (
                    <span style={{ color: "#B9DED4", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                      ✓ Clear for Assembly
                    </span>
                  ) : (
                    <span style={{ color: "#FCA5A5", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
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
                    padding: "10px 18px",
                    fontSize: "12px",
                    fontWeight: 700,
                    borderRadius: "8px",
                    border: "none",
                    cursor: checklist.is_ready_for_package_assembly && !isLoading ? "pointer" : "not-allowed",
                    background: checklist.is_ready_for_package_assembly ? "#0D6866" : "rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    boxShadow: "0 1px 3px rgba(6, 60, 61, 0.2)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isLoading ? "Assembling..." : "Assemble Filing Package"}
                </button>
              )}
            </div>
          </div>

          {/* Regulatory Ethics Disclaimer Box */}
          <div style={{ marginTop: "12px", padding: "12px 16px", background: "rgba(13, 104, 102, 0.4)", borderRadius: "8px", border: "1px solid rgba(185, 222, 212, 0.25)", fontSize: "12px", display: "flex", alignItems: "flex-start", gap: "10px", color: "#F8F7F2" }}>
            <span style={{ fontSize: "16px" }}>🛡️</span>
            <div>
              <strong style={{ color: "#FFFFFF" }}>Regulatory Disclaimer: </strong>
              {checklist.prohibition_disclaimer ||
                "Readiness means only that the defined internal checks have been evaluated. Under legal ethics guidelines, this software does not calculate or display a probability of government approval."}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 divide-x divide-slate-200 bg-slate-50/50">
        <div className="p-4 text-center">
          <div className="text-xs text-slate-500">Evaluated Checks</div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">
            {checklist.total_checks_evaluated} / 10
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xs text-slate-500">Passed Checks</div>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {checklist.passed_checks_count}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xs text-slate-500">Warnings / Open Items</div>
          <div className="text-xl font-bold text-amber-600 mt-0.5">
            {checklist.warnings_count}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xs text-slate-500">Blocking Failures</div>
          <div className={`text-xl font-bold mt-0.5 ${checklist.blocking_failures_count > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {checklist.blocking_failures_count}
          </div>
        </div>
      </div>

      {/* The 10 Checklist Items */}
      <div className="p-6 divide-y divide-slate-100">
        {checklist.checks.map((item, idx) => (
          <div key={item.code} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                  {item.is_blocking && item.status !== "passed" && (
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      Blocking
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{item.summary}</p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 pl-9 md:pl-0">
              {getStatusBadge(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
