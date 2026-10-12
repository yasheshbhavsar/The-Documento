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
      <div className="p-6 bg-slate-900 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-300 font-semibold uppercase tracking-wider">
              <span>Case: {checklist.case_number}</span>
              <span>•</span>
              <span>Evaluated: {new Date(checklist.evaluated_at).toLocaleString()}</span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-white">Deterministic Case Readiness Checklist</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Internal checklist auditing 10 statutory and procedural dimensions required prior to submission package assembly.
            </p>
          </div>

          {/* Assembly Status & Action */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400">Package Assembly Readiness</div>
              <div className="text-base font-bold mt-0.5">
                {checklist.is_ready_for_package_assembly ? (
                  <span className="text-emerald-400 flex items-center gap-1 justify-end">
                    ✓ Clear for Assembly
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 justify-end">
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
                className={`px-4 py-2.5 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 ${
                  checklist.is_ready_for_package_assembly
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                }`}
              >
                {isLoading ? "Assembling..." : "Assemble Filing Package"}
              </button>
            )}
          </div>
        </div>

        {/* Regulatory Ethics Disclaimer Box */}
        <div className="mt-5 p-3.5 bg-slate-800/80 rounded-lg border border-slate-700 text-xs flex items-start gap-3 text-slate-300">
          <span className="text-blue-400 text-base">🛡️</span>
          <div>
            <span className="font-bold text-white">Regulatory Disclaimer: </span>
            {checklist.prohibition_disclaimer ||
              "Readiness means only that the defined internal checks have been evaluated. Under legal ethics guidelines, this software does not calculate or display a probability of government approval."}
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
