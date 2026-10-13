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
      <div className="bg-[#0b2422] border border-[#1b3a36] rounded-xl p-4 text-xs flex items-center justify-between text-teal-200">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="font-semibold text-slate-100">Zero Cross-Document Discrepancies</span>
          <span className="text-slate-400">— All evidentiary records cross-match client profile.</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[11px] font-mono">
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
    <div className="rounded-xl border border-[#254641] bg-[#071d1b] overflow-hidden shadow-lg">
      {/* Alert Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0c2e2b] border-b border-[#254641]">
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 rounded-full ${activeDiscrepancies.length > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          <h4 className="font-semibold text-xs text-slate-100 tracking-wide uppercase font-display">
            Cross-Document Discrepancy & Consistency Audit
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
            {activeDiscrepancies.length} Action Required
          </span>
          {resolvedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
              {resolvedCount} Resolved
            </span>
          )}
        </div>
        <div className="text-[11px] text-teal-300 font-mono">
          Evidence Grounded • Non-Binding Intelligence
        </div>
      </div>

      {/* Discrepancy Items List */}
      <div className="divide-y divide-[#1b3a36]/70 p-1">
        {caseDiscrepancies.map((finding) => {
          const isResolved = finding.status === "resolved";
          const isContradiction = finding.is_confirmed_contradiction || finding.category === "contradiction" || finding.finding_type === "direct_contradiction";
          const isExpanded = expandedFindingId === finding.id;
          const isResolving = resolvingId === finding.id;

          return (
            <div
              key={finding.id}
              className={`p-3.5 transition-colors ${
                isResolved
                  ? "bg-[#061816]/60 opacity-80"
                  : isContradiction
                  ? "bg-rose-950/20 hover:bg-rose-950/30"
                  : "bg-[#08221f]/40 hover:bg-[#08221f]/80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${
                        isResolved
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                          : isContradiction
                          ? "bg-rose-950/90 text-rose-300 border-rose-800"
                          : "bg-amber-950/90 text-amber-300 border-amber-800"
                      }`}
                    >
                      {isResolved
                        ? "✓ RESOLVED"
                        : isContradiction
                        ? "⚠️ Evidence Contradiction"
                        : "ℹ️ Cross-Record Discrepancy"}
                    </span>

                    <span className="font-semibold text-xs text-slate-100">{finding.title}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{finding.description}</p>

                  {/* Conflicting Evidence Snippets */}
                  {finding.evidence_text && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#041211] border border-[#143330] text-xs font-mono">
                      <div className="text-[10px] text-teal-400 uppercase font-bold mb-1">
                        Evidentiary Grounding Comparison
                      </div>
                      <div className="text-slate-300 whitespace-pre-line leading-relaxed">
                        {finding.evidence_text}
                      </div>
                    </div>
                  )}

                  {/* Recommended Legal Strategy */}
                  {finding.recommended_action && (
                    <div className="text-xs text-teal-200 flex items-center gap-1.5 mt-1">
                      <span className="font-semibold text-teal-400">Recommended Action:</span>
                      <span>{finding.recommended_action}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {!isResolved && !isResolving && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartResolve(finding.id)}
                        className="px-2.5 py-1 text-xs rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-medium transition-colors"
                      >
                        ✓ Resolve with Affidavit
                      </button>
                      <button
                        onClick={() => handleConfirmEscalate(finding.id)}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 text-xs rounded bg-[#133c38] hover:bg-[#1a4e49] text-teal-200 border border-[#215751] transition-colors"
                      >
                        Escalate
                      </button>
                    </div>
                  )}

                  {/* Expand / Collapse Details */}
                  <button
                    onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                    className="text-[11px] text-teal-400 hover:text-teal-200 underline mt-1"
                  >
                    {isExpanded ? "Hide Audit History ▲" : "View Audit History ▼"}
                  </button>
                </div>
              </div>

              {/* Inline Resolution Drawer */}
              {isResolving && (
                <div className="mt-3 p-3 bg-[#051513] border border-teal-800/80 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-teal-300">
                      Record Discrepancy Resolution & Legal Rationale
                    </span>
                    <button
                      onClick={() => setResolvingId(null)}
                      className="text-slate-400 hover:text-slate-200 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="e.g., Client executed name transliteration affidavit conforming with USCIS Form G-28..."
                    className="w-full bg-[#081f1d] border border-teal-700 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-teal-400"
                  />
                  {/* Quick-fill template chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Client executed sworn name affidavit",
                      "Standardized transliteration matches passport bio",
                      "Evidence clarification letter drafted for exhibit index",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setResolutionNote(chip)}
                        className="text-[9px] px-2 py-0.5 bg-[#0d2825] hover:bg-[#133c38] text-teal-300 rounded border border-[#1b3a36]"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setResolvingId(null)}
                      className="px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConfirmResolve(finding.id)}
                      disabled={isSubmitting || !resolutionNote.trim()}
                      className="px-3 py-1 text-[11px] rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-semibold transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "Recording..." : "Save Resolution & Sign Off"}
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Resolution Audit Trail */}
              {isExpanded && finding.resolution_history && (
                <div className="mt-3 pt-2 border-t border-[#1b3a36] space-y-1.5 text-[11px]">
                  <div className="text-slate-400 font-semibold uppercase text-[10px]">
                    Discrepancy Audit Trail
                  </div>
                  {finding.resolution_history.map((hist, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[#051413] border border-[#143330] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-teal-300 uppercase">{hist.action}:</span>{" "}
                        <span className="text-slate-200">{hist.note || hist.reason}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {hist.reviewer_email || "Counsel"} • {new Date(hist.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
