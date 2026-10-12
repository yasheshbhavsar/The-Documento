"use client";

import React, { useState } from "react";
import { FilingPackageItem, PackageApprovalStage } from "../../lib/types";

interface PackageApprovalWorkflowModalProps {
  packageItem: FilingPackageItem;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onAdvanceApproval?: (stage: string, decision: string, notes?: string) => Promise<void>;
}

export const PackageApprovalWorkflowModal: React.FC<PackageApprovalWorkflowModalProps> = ({
  packageItem,
  isOpen,
  onClose,
  userRole = "case_manager",
  onAdvanceApproval,
}) => {
  const [activeStage, setActiveStage] = useState<string>("authorized_staff_review");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const chain: PackageApprovalStage[] =
    packageItem.approval_chain || packageItem.approval_chain_json || [];

  const handleDecision = async (decision: "approved" | "rejected") => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (onAdvanceApproval) {
        await onAdvanceApproval(activeStage, decision, notes);
      }
      setNotes("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to advance package approval stage.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStageObj = chain.find((s) => s.stage === activeStage);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-testid="approval-workflow-modal">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-300 font-semibold uppercase tracking-wider">
              <span>Auditable Approval Workflow</span>
              <span>•</span>
              <span>Exact Package: {packageItem.version_number}</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{packageItem.name}</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xl" title={packageItem.package_hash}>
              Package Hash: {packageItem.package_hash}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold p-1 leading-none"
          >
            ×
          </button>
        </div>

        {/* Modal Body: Stepper & Controls */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* 7-Stage Horizontal Stepper */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
              7-Stage Formal Sequential Signoff Chain
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {chain.map((stg, idx) => {
                const isCurrent = stg.stage === activeStage;
                const isPassedOrApproved = stg.status === "passed" || stg.status === "approved";
                const isBlocked = stg.status === "blocked" || stg.status === "rejected";

                return (
                  <button
                    key={stg.stage}
                    type="button"
                    onClick={() => setActiveStage(stg.stage)}
                    className={`p-2.5 rounded-lg text-left transition border ${
                      isCurrent
                        ? "border-blue-600 bg-blue-50/80 shadow-xs ring-1 ring-blue-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500">#{idx + 1}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isPassedOrApproved
                            ? "bg-emerald-500"
                            : isBlocked
                            ? "bg-red-500"
                            : "bg-amber-400"
                        }`}
                      />
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 mt-1 line-clamp-1" title={stg.title}>
                      {stg.title.replace(/^\d+\.\s*/, "")}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                      {stg.status}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Stage Detail & Signoff Controls */}
          {currentStageObj && (
            <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{currentStageObj.title}</h4>
                  <p className="text-xs text-slate-500">
                    Designated Signatory: <strong>{currentStageObj.actor || "Authorized Representative"}</strong>
                  </p>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      currentStageObj.status === "approved" || currentStageObj.status === "passed"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : currentStageObj.status === "rejected" || currentStageObj.status === "blocked"
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {currentStageObj.status}
                  </span>
                </div>
              </div>

              {currentStageObj.notes && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Recorded Notes: </span>
                  {currentStageObj.notes}
                </div>
              )}

              {currentStageObj.timestamp && (
                <div className="text-[11px] text-slate-400 font-mono">
                  Completed At: {new Date(currentStageObj.timestamp).toLocaleString()}
                </div>
              )}

              {/* Action Buttons if Pending */}
              {currentStageObj.status === "pending" && (
                <div className="pt-2 space-y-3">
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter audit signoff notes, statutory citations, or disposition remarks..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDecision("rejected")}
                      className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition"
                    >
                      Reject / Request Revisions
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDecision("approved")}
                      className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                    >
                      Certify & Approve Stage
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Filing Instructions Card (Mandatory External Submission Policy) */}
          <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <span>🏛️</span>
              <span>Official Filing Procedure & Automated Submission Disclaimer</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              In accordance with federal regulatory requirements, automatic submission of petitions to government portals is intentionally disclaimed and prohibited. All external filings must follow verified physical assembly or authorized legal practitioner manual portal submission.
            </p>

            {packageItem.manual_filing_instructions && (
              <div className="mt-3 bg-white p-4 rounded-lg border border-amber-300 space-y-2 text-xs">
                <div className="font-bold text-slate-800">
                  Designated Courier Filing Address:
                </div>
                <div className="font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                  {packageItem.manual_filing_instructions.primary_filing_address}
                </div>
                <div className="font-bold text-slate-800 pt-2">
                  Mandatory Packaging Steps:
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                  {packageItem.manual_filing_instructions.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Audit Log ID: {packageItem.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
