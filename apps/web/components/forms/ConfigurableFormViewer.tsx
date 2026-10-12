"use client";

import React, { useState } from "react";
import {
  FormSchemaItem,
  FormSubmissionItem,
  FormFieldAnswer,
  FormSchemaField,
  FormSchemaSection,
} from "../../lib/types";

interface ConfigurableFormViewerProps {
  submission: FormSubmissionItem;
  schema?: FormSchemaItem;
  userRole?: string;
  onUpdateAnswers?: (answers: Record<string, any>, notes?: string) => Promise<void>;
  onConfirmField?: (fieldKey: string) => Promise<void>;
  onReviewSensitive?: (notes: string) => Promise<void>;
}

export const ConfigurableFormViewer: React.FC<ConfigurableFormViewerProps> = ({
  submission: initialSubmission,
  schema,
  userRole = "case_manager",
  onUpdateAnswers,
  onConfirmField,
  onReviewSensitive,
}) => {
  const [submission, setSubmission] = useState<FormSubmissionItem>(initialSubmission);
  const [activeSectionId, setActiveSectionId] = useState<string>("part1_petitioner");
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    Object.entries(initialSubmission.answers || {}).forEach(([k, ans]) => {
      initial[k] = ans.value;
    });
    return initial;
  });
  const [editNotes, setEditNotes] = useState<string>("");
  const [sensitiveNotes, setSensitiveNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const sections: FormSchemaSection[] =
    submission.schema_definition?.sections ||
    schema?.versions[0]?.schema_definition?.sections ||
    [];

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  // Helper to check conditional display
  const shouldShowField = (field: FormSchemaField): boolean => {
    if (!field.conditional) return true;
    const { depends_on_field, operator, expected_value } = field.conditional;
    const parentVal = formData[depends_on_field];

    if (operator === "equals") return parentVal === expected_value;
    if (operator === "not_equals") return parentVal !== expected_value;
    return true;
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAnswers = async () => {
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      if (onUpdateAnswers) {
        await onUpdateAnswers(formData, editNotes || "User revised form answers");
      }
      setFeedbackMsg({ text: "Form answers updated and revision saved successfully.", type: "success" });
      setEditNotes("");
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Failed to update form answers.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmField = async (fieldKey: string) => {
    setIsSubmitting(true);
    try {
      if (onConfirmField) {
        await onConfirmField(fieldKey);
      }
      setSubmission((prev) => {
        const updated = { ...prev };
        if (updated.answers[fieldKey]) {
          updated.answers[fieldKey] = {
            ...updated.answers[fieldKey],
            is_confirmed: true,
            confirmed_at: new Date().toISOString(),
          };
        }
        return updated;
      });
      setFeedbackMsg({ text: `Field '${fieldKey}' successfully confirmed.`, type: "success" });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Error confirming field.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignoffSensitive = async () => {
    if (!sensitiveNotes.trim()) {
      alert("Please provide legal review notes certifying sensitive field review.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (onReviewSensitive) {
        await onReviewSensitive(sensitiveNotes);
      }
      setSubmission((prev) => ({
        ...prev,
        sensitive_fields_reviewed: true,
        reviewer_notes: sensitiveNotes,
        reviewed_at: new Date().toISOString(),
      }));
      setFeedbackMsg({ text: "Sensitive field certified by legal reviewer.", type: "success" });
      setSensitiveNotes("");
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Error reviewing sensitive fields.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClientRole = userRole === "retained_client" || userRole === "applicant" || userRole === "client";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="configurable-form-viewer">
      {/* Top Header */}
      <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
              {submission.form_code}
            </span>
            <span className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-300 rounded">
              Version {submission.version_number}
            </span>
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded uppercase ${
                submission.status === "draft"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
              }`}
            >
              {submission.status}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-2 text-white">{submission.form_name}</h2>
          <p className="text-xs text-slate-400 mt-1">
            Revisions: #{submission.revision_number} • Evaluated under jurisdiction legal standard
          </p>
        </div>

        {/* Completion & Revision Info */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400 mb-1">Answer Completeness</div>
            <div className="flex items-center gap-2">
              <div className="w-28 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${submission.completion_percentage}%` }}
                />
              </div>
              <span className="text-sm font-bold text-white">{submission.completion_percentage}%</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            History ({submission.revision_history?.length || 1})
          </button>
        </div>
      </div>

      {/* AI Draft Warning Banner */}
      {submission.has_unconfirmed_ai_fields && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 text-xs">
            <span className="font-bold">⚠️ UNCONFIRMED DRAFT ANSWERS:</span>
            <span>
              This form contains auto-populated AI synthesis or OCR extraction drafts. Values must be confirmed by an authorized human prior to final approval.
            </span>
          </div>
          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            Confirmation Required
          </span>
        </div>
      )}

      {feedbackMsg && (
        <div
          className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between ${
            feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200" : "bg-red-50 text-red-800 border-b border-red-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Main Body: Sidebar Sections + Form Fields */}
      <div className="flex flex-col md:flex-row min-h-[500px]">
        {/* Section Navigation Tabs */}
        <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/70 p-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">
            Form Sections
          </div>
          {sections.map((sec, idx) => {
            const isActive = sec.id === activeSectionId;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionId(sec.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-start gap-2 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${isActive ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {idx + 1}
                </span>
                <span className="line-clamp-2">{sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Form Section Content */}
        <div className="flex-1 p-6">
          {activeSection ? (
            <div>
              <div className="border-b border-slate-200 pb-4 mb-6">
                <h3 className="text-base font-bold text-slate-900">{activeSection.title}</h3>
                {activeSection.description && (
                  <p className="text-xs text-slate-500 mt-1">{activeSection.description}</p>
                )}
              </div>

              {/* Fields List */}
              <div className="space-y-6">
                {activeSection.fields.map((field) => {
                  if (!shouldShowField(field)) return null;

                  const answerRec: FormFieldAnswer | undefined = submission.answers[field.key];
                  const currentVal = formData[field.key] ?? "";
                  const isConfirmed = answerRec?.is_confirmed ?? false;
                  const sourceType = answerRec?.source_type || "user_provided";

                  return (
                    <div
                      key={field.key}
                      className={`p-4 rounded-xl border transition ${
                        field.is_sensitive
                          ? "border-amber-300 bg-amber-50/40"
                          : answerRec && !isConfirmed
                          ? "border-blue-200 bg-blue-50/20"
                          : "border-slate-200 bg-white"
                      }`}
                      data-testid={`form-field-${field.key}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 font-bold">*</span>}
                          {field.is_sensitive && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded border border-red-200">
                              Sensitive Inadmissibility Field
                            </span>
                          )}
                        </label>

                        {/* Provenance Badge */}
                        {answerRec && (
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full flex items-center gap-1 ${
                                sourceType === "client_profile"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : sourceType === "document_ocr"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : sourceType === "ai_generated"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                              title={answerRec.source_label}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {sourceType === "client_profile" && "Client Profile"}
                              {sourceType === "document_ocr" && "Verified OCR"}
                              {sourceType === "ai_generated" && "AI Draft"}
                              {sourceType === "user_provided" && "User Entry"}
                            </span>

                            {/* Confirmation Status */}
                            {isConfirmed ? (
                              <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                                ✓ Confirmed
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleConfirmField(field.key)}
                                className="px-2 py-0.5 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition shadow-xs"
                              >
                                Confirm Field Value
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Source Mapping Label Subtext */}
                      {answerRec?.source_label && (
                        <p className="text-[11px] text-slate-400 mb-2 font-mono">
                          Source: {answerRec.source_label}
                        </p>
                      )}

                      {/* Input based on Field Type */}
                      {field.field_type === "boolean" ? (
                        <div className="flex items-center gap-4 mt-1">
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={field.key}
                              checked={currentVal === true}
                              onChange={() => handleFieldChange(field.key, true)}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            Yes
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={field.key}
                              checked={currentVal === false}
                              onChange={() => handleFieldChange(field.key, false)}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            No
                          </label>
                        </div>
                      ) : field.field_type === "select" ? (
                        <select
                          value={currentVal}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">-- Select an option --</option>
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : field.field_type === "textarea" ? (
                        <textarea
                          rows={3}
                          value={currentVal}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      ) : (
                        <input
                          type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                          value={currentVal}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Special Part 4 Sensitive Field Certification Block */}
              {activeSection.id === "part4_processing" && (
                <div className="mt-8 p-5 bg-red-50 border border-red-200 rounded-xl" data-testid="sensitive-review-block">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚖️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-900">
                        Designated Sensitive-Field Legal Review Certification
                      </h4>
                      <p className="text-xs text-red-700 mt-1">
                        Federal immigration regulations require formal attorney or designated specialist signoff certifying that grounds of inadmissibility (removal history, criminal convictions) have been reviewed. Clients are prohibited from self-certifying this requirement.
                      </p>

                      {submission.sensitive_fields_reviewed ? (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-300 text-xs">
                          <span className="font-bold text-emerald-800">✓ CERTIFIED BY LEGAL COUNSEL</span>
                          <p className="text-slate-600 mt-1">Notes: {submission.reviewer_notes || "Statutory grounds reviewed."}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">
                            Certified at: {submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString() : "Confirmed"}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {isClientRole ? (
                            <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-xs text-amber-900">
                              ℹ️ You are viewing as a client applicant. Sensitive background certification must be completed by your retained legal counsel prior to formal package filing.
                            </div>
                          ) : (
                            <>
                              <textarea
                                rows={2}
                                value={sensitiveNotes}
                                onChange={(e) => setSensitiveNotes(e.target.value)}
                                placeholder="Enter certified counsel notes verifying review of police clearance, court documents, or no-record declarations..."
                                className="w-full text-xs p-2.5 rounded-lg border border-red-300 bg-white text-slate-900 focus:ring-2 focus:ring-red-500"
                              />
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSignoffSensitive}
                                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-sm transition"
                              >
                                Certify Sensitive Fields Review
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar for Section */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-1/2">
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Revision reason (e.g. Updated client Alien number from historical approval notice)..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveAnswers}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-2"
                  >
                    Save & Record Revision #{submission.revision_number + 1}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              No section selected.
            </div>
          )}
        </div>
      </div>

      {/* Revision History Drawer Modal */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Revision History Log</h3>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {(submission.revision_history || []).map((rev) => (
                <div key={rev.revision} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1 font-semibold text-slate-800">
                    <span>Revision #{rev.revision}</span>
                    <span className="text-[10px] text-slate-400">{new Date(rev.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-600">{rev.changes_summary}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Author: {rev.updated_by}</p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
