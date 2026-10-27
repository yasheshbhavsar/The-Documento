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
  onFinalizeSubmission?: (targetStatus?: string) => Promise<void>;
}

export const ConfigurableFormViewer: React.FC<ConfigurableFormViewerProps> = ({
  submission: initialSubmission,
  schema,
  userRole = "case_manager",
  onUpdateAnswers,
  onConfirmField,
  onReviewSensitive,
  onFinalizeSubmission,
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

  const hasFormConflicts = Object.values(submission.answers || {}).some(
    (ans) => ans?.has_conflict === true
  );

  const handleFinalize = async () => {
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      if (onFinalizeSubmission) {
        await onFinalizeSubmission("confirmed");
      }
      setSubmission((prev) => ({
        ...prev,
        status: "confirmed",
        has_unconfirmed_ai_fields: false,
      }));
      setFeedbackMsg({ text: "Form draft certified and finalized as filing-ready.", type: "success" });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Failed to finalize form draft.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClientRole = userRole === "retained_client" || userRole === "applicant" || userRole === "client";

  return (
    <div
      data-testid="configurable-form-viewer"
      style={{
        background: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid #DCE5E1",
        boxShadow: "0 6px 24px rgba(6, 60, 61, 0.06)",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* Top Executive Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #084B4C 100%)",
          color: "#FFFFFF",
          padding: "24px 28px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          borderBottom: "1px solid rgba(185, 222, 212, 0.2)",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: "rgba(185, 222, 212, 0.18)",
                color: "#B9DED4",
                borderRadius: "6px",
                border: "1px solid rgba(185, 222, 212, 0.35)",
              }}
            >
              {submission.form_code}
            </span>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                background: "rgba(255, 255, 255, 0.12)",
                color: "#E2ECE9",
                borderRadius: "6px",
              }}
            >
              Version {submission.version_number}
            </span>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                borderRadius: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: submission.status === "draft" ? "#FEF3C7" : "#D1FAE5",
                color: submission.status === "draft" ? "#92400E" : "#065F46",
                border: submission.status === "draft" ? "1px solid #FCD34D" : "1px solid #6EE7B7",
              }}
            >
              {submission.status}
            </span>
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#FFFFFF",
              margin: "10px 0 4px 0",
              letterSpacing: "-0.01em",
            }}
          >
            {submission.form_name}
          </h2>
          <p style={{ fontSize: "12px", color: "#B9DED4", margin: 0 }}>
            Revisions: #{submission.revision_number} • Evaluated under jurisdiction legal standard
          </p>
        </div>

        {/* Completion & Revision Info */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div
            style={{
              textAlign: "right",
              background: "rgba(255, 255, 255, 0.08)",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#B9DED4",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "6px",
              }}
            >
              Answer Completeness
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end" }}>
              <div
                style={{
                  width: "120px",
                  background: "rgba(255, 255, 255, 0.2)",
                  borderRadius: "999px",
                  height: "8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(90deg, #34D399 0%, #10B981 100%)",
                    height: "8px",
                    borderRadius: "999px",
                    width: `${submission.completion_percentage}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: "15px", fontWeight: 800, color: "#FFFFFF" }}>
                {submission.completion_percentage}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            style={{
              padding: "9px 16px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "rgba(255, 255, 255, 0.14)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>📜</span> History ({submission.revision_history?.length || 1})
          </button>
        </div>
      </div>

      {/* AI Draft Warning Banner */}
      {submission.has_unconfirmed_ai_fields && (
        <div
          style={{
            padding: "14px 28px",
            background: "#FFFBEB",
            borderBottom: "1px solid #FCD34D",
            borderLeft: "5px solid #F59E0B",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", flex: 1, minWidth: "260px" }}>
            <span style={{ fontWeight: 800, color: "#92400E", whiteSpace: "nowrap" }}>
              ⚠️ UNCONFIRMED DRAFT ANSWERS:
            </span>
            <span style={{ color: "#78350F", lineHeight: "1.4" }}>
              This form contains auto-populated AI synthesis or OCR extraction drafts. Values must be confirmed by an authorized human prior to final approval.
            </span>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#92400E",
              background: "#FEF3C7",
              border: "1px solid #F59E0B",
              padding: "4px 12px",
              borderRadius: "999px",
              whiteSpace: "nowrap",
            }}
          >
            Confirmation Required
          </span>
        </div>
      )}

      {/* Evidence Conflict Warning Banner */}
      {hasFormConflicts && (
        <div
          data-testid="form-conflicts-banner"
          style={{
            padding: "14px 28px",
            background: "#FEF2F2",
            borderBottom: "1px solid #FECACA",
            borderLeft: "5px solid #EF4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", flex: 1, minWidth: "260px" }}>
            <span style={{ fontWeight: 800, color: "#991B1B", whiteSpace: "nowrap" }}>
              ⚠️ UNRESOLVED EVIDENCE CONFLICTS:
            </span>
            <span style={{ color: "#7F1D1D", lineHeight: "1.4" }}>
              Disparate statutory values extracted across applicant documents. The system abstains from guessing; attorney qualification required before filing readiness lock.
            </span>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#991B1B",
              background: "#FEE2E2",
              border: "1px solid #EF4444",
              padding: "4px 12px",
              borderRadius: "999px",
              whiteSpace: "nowrap",
            }}
          >
            Attorney Override Required
          </span>
        </div>
      )}

      {/* Feedback Message Notification */}
      {feedbackMsg && (
        <div
          style={{
            padding: "12px 28px",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: feedbackMsg.type === "success" ? "#ECFDF5" : "#FEF2F2",
            color: feedbackMsg.type === "success" ? "#065F46" : "#991B1B",
            borderBottom: feedbackMsg.type === "success" ? "1px solid #A7F3D0" : "1px solid #FECACA",
          }}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Body: Two-Pane Sidebar Sections + Form Fields */}
      <div style={{ display: "flex", flexDirection: "row", minHeight: "560px", background: "#FFFFFF" }}>
        {/* Section Navigation Tabs Sidebar */}
        <div
          style={{
            width: "300px",
            minWidth: "300px",
            maxWidth: "300px",
            borderRight: "1px solid #E2E8E4",
            background: "#F8F9F8",
            padding: "18px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#6E7F7C",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "6px 12px 10px 12px",
              borderBottom: "1px solid #E5EBE8",
              marginBottom: "4px",
            }}
          >
            Form Sections
          </div>
          {sections.map((sec, idx) => {
            const isActive = sec.id === activeSectionId;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionId(sec.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  lineHeight: "1.4",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  transition: "all 0.15s ease",
                  background: isActive ? "#EAF6F0" : "transparent",
                  color: isActive ? "#063C3D" : "#374151",
                  border: isActive ? "1.5px solid #0D6866" : "1.5px solid transparent",
                  boxShadow: isActive ? "0 2px 8px rgba(13, 104, 102, 0.08)" : "none",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: "1px",
                    background: isActive ? "#0D6866" : "#E2E8E4",
                    color: isActive ? "#FFFFFF" : "#4B5563",
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ flex: 1, wordBreak: "break-word" }}>{sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Form Section Content Pane */}
        <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto", background: "#FFFFFF" }}>
          {activeSection ? (
            <div>
              {/* Section Header */}
              <div
                style={{
                  borderBottom: "1px solid #E2E8E4",
                  paddingBottom: "16px",
                  marginBottom: "24px",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#172322",
                    margin: "0 0 6px 0",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {activeSection.title}
                </h3>
                {activeSection.description && (
                  <p style={{ fontSize: "13px", color: "#6E7F7C", margin: 0, lineHeight: "1.5" }}>
                    {activeSection.description}
                  </p>
                )}
              </div>

              {/* Fields List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {activeSection.fields.map((field) => {
                  if (!shouldShowField(field)) return null;

                  const answerRec: FormFieldAnswer | undefined = submission.answers[field.key];
                  const currentVal = formData[field.key] ?? "";
                  const isConfirmed = answerRec?.is_confirmed ?? false;
                  const sourceType = answerRec?.source_type || "user_provided";

                  return (
                    <div
                      key={field.key}
                      data-testid={`form-field-${field.key}`}
                      style={{
                        borderRadius: "12px",
                        padding: "18px 20px",
                        transition: "all 0.15s ease",
                        background: field.is_sensitive
                          ? "#FFFBF7"
                          : answerRec && !isConfirmed
                          ? "#F8FCFC"
                          : "#FAFAF8",
                        border: field.is_sensitive
                          ? "1.5px solid #FDBA74"
                          : answerRec && !isConfirmed
                          ? "1.5px solid #99D5CA"
                          : "1px solid #E5E7EB",
                        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.02)",
                      }}
                    >
                      {/* Field Top Row: Label, Sensitivity Badge, Provenance Pill, and Confirmation Button */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "8px",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#172322",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            margin: 0,
                          }}
                        >
                          {field.label}
                          {field.required && <span style={{ color: "#DC2626", fontWeight: "bold" }}>*</span>}
                          {field.is_sensitive && (
                            <span
                              style={{
                                padding: "2px 8px",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: "#FEE2E2",
                                color: "#991B1B",
                                borderRadius: "4px",
                                border: "1px solid #FCA5A5",
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                              }}
                            >
                              Sensitive Inadmissibility Field
                            </span>
                          )}
                        </label>

                        {/* Provenance Badge & Confirmation Status */}
                        {answerRec && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span
                              title={answerRec.source_label}
                              style={{
                                padding: "3px 10px",
                                fontSize: "11px",
                                fontWeight: 600,
                                borderRadius: "999px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background:
                                  sourceType === "client_profile"
                                    ? "#ECFDF5"
                                    : sourceType === "document_ocr"
                                    ? "#EFF6FF"
                                    : sourceType === "ai_generated"
                                    ? "#FFFBEB"
                                    : "#F3F4F6",
                                color:
                                  sourceType === "client_profile"
                                    ? "#065F46"
                                    : sourceType === "document_ocr"
                                    ? "#1E40AF"
                                    : sourceType === "ai_generated"
                                    ? "#92400E"
                                    : "#374151",
                                border:
                                  sourceType === "client_profile"
                                    ? "1px solid #A7F3D0"
                                    : sourceType === "document_ocr"
                                    ? "1px solid #BFDBFE"
                                    : sourceType === "ai_generated"
                                    ? "1px solid #FDE68A"
                                    : "1px solid #E5E7EB",
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "999px",
                                  background: "currentColor",
                                }}
                              />
                              {sourceType === "client_profile" && "Client Profile"}
                              {sourceType === "document_ocr" && "Verified OCR"}
                              {sourceType === "ai_generated" && "AI Draft"}
                              {sourceType === "user_provided" && "User Entry"}
                            </span>

                            {/* Confirmation Status */}
                            {isConfirmed ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#059669",
                                  background: "#D1FAE5",
                                  border: "1px solid #6EE7B7",
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                ✓ Confirmed
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleConfirmField(field.key)}
                                style={{
                                  padding: "4px 12px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#0D6866",
                                  color: "#FFFFFF",
                                  borderRadius: "6px",
                                  border: "none",
                                  cursor: isSubmitting ? "not-allowed" : "pointer",
                                  boxShadow: "0 1px 3px rgba(13, 104, 102, 0.2)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                Confirm Field Value
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Physical Evidence Provenance Details */}
                      {answerRec && (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                          {answerRec.source_label && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#4B5563",
                                fontFamily: "ui-monospace, monospace",
                                background: "#F3F4F6",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>📄</span> {answerRec.source_label}
                            </span>
                          )}
                          {answerRec.source_page !== undefined && answerRec.source_page !== null && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#065F46",
                                background: "#ECFDF5",
                                border: "1px solid #A7F3D0",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontWeight: 600,
                              }}
                            >
                              Page {answerRec.source_page}
                            </span>
                          )}
                          {answerRec.extraction_confidence !== undefined && answerRec.extraction_confidence !== null && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: answerRec.extraction_confidence >= 0.85 ? "#065F46" : "#92400E",
                                background: answerRec.extraction_confidence >= 0.85 ? "#D1FAE5" : "#FEF3C7",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontWeight: 700,
                              }}
                            >
                              {Math.round(answerRec.extraction_confidence * 100)}% Match
                            </span>
                          )}
                          {answerRec.source_location && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#6B7280",
                                fontStyle: "italic",
                              }}
                            >
                              ({answerRec.source_location})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Multi-Document Conflict Warning & Resolution Panel */}
                      {answerRec?.has_conflict && (
                        <div
                          data-testid={`conflict-alert-${field.key}`}
                          style={{
                            marginTop: "6px",
                            marginBottom: "14px",
                            padding: "12px 14px",
                            background: "#FEF2F2",
                            border: "1.5px solid #F87171",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#991B1B", fontWeight: 700 }}>
                            <span>⚠️</span>
                            <span>Multi-Document Evidence Conflict</span>
                          </div>
                          <p style={{ margin: "4px 0 8px 0", color: "#7F1D1D", lineHeight: "1.4" }}>
                            {answerRec.conflict_reason || "Conflicting evidence extracted across applicant documents. The system abstains from guessing; attorney qualification required."}
                          </p>

                          {answerRec.conflicting_candidates && answerRec.conflicting_candidates.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B" }}>
                                Disparate Candidate Values Extracted:
                              </span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {answerRec.conflicting_candidates.map((cand: any, cIdx: number) => (
                                  <div
                                    key={cIdx}
                                    style={{
                                      background: "#FFFFFF",
                                      border: "1px solid #FECACA",
                                      borderRadius: "6px",
                                      padding: "6px 10px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      fontSize: "11px",
                                    }}
                                  >
                                    <div>
                                      <strong style={{ color: "#111827" }}>{String(cand.value)}</strong>
                                      <span style={{ color: "#6B7280", marginLeft: "6px" }}>
                                        (Doc: {cand.document_id ? cand.document_id.slice(0, 8) : "ID"}... {cand.page ? `p.${cand.page}` : ""})
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleFieldChange(field.key, cand.value);
                                        setEditNotes(`Resolved multi-document conflict on ${field.label} adopting value from document ${cand.document_id}`);
                                      }}
                                      style={{
                                        padding: "3px 8px",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        background: "#0D6866",
                                        color: "#FFFFFF",
                                        border: "none",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Use This Value
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Input based on Field Type */}
                      {field.field_type === "boolean" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px" }}>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: "8px 18px",
                              borderRadius: "8px",
                              background: currentVal === true ? "#EAF6F0" : "#FFFFFF",
                              border: currentVal === true ? "1.5px solid #0D6866" : "1px solid #D1D5DB",
                              color: currentVal === true ? "#063C3D" : "#374151",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <input
                              type="radio"
                              name={field.key}
                              checked={currentVal === true}
                              onChange={() => handleFieldChange(field.key, true)}
                              style={{ accentColor: "#0D6866", width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            Yes
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: "8px 18px",
                              borderRadius: "8px",
                              background: currentVal === false ? "#EAF6F0" : "#FFFFFF",
                              border: currentVal === false ? "1.5px solid #0D6866" : "1px solid #D1D5DB",
                              color: currentVal === false ? "#063C3D" : "#374151",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <input
                              type="radio"
                              name={field.key}
                              checked={currentVal === false}
                              onChange={() => handleFieldChange(field.key, false)}
                              style={{ accentColor: "#0D6866", width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            No
                          </label>
                        </div>
                      ) : field.field_type === "select" ? (
                        <select
                          value={currentVal}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          style={{
                            width: "100%",
                            fontSize: "13px",
                            borderRadius: "8px",
                            border: "1.5px solid #D1D5DB",
                            padding: "10px 14px",
                            background: "#FFFFFF",
                            color: "#111827",
                            outline: "none",
                            transition: "border-color 0.15s ease",
                          }}
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
                          style={{
                            width: "100%",
                            fontSize: "13px",
                            borderRadius: "8px",
                            border: "1.5px solid #D1D5DB",
                            padding: "10px 14px",
                            background: "#FFFFFF",
                            color: "#111827",
                            outline: "none",
                            resize: "vertical",
                            lineHeight: "1.5",
                          }}
                        />
                      ) : (
                        <input
                          type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                          value={currentVal}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          style={{
                            width: "100%",
                            fontSize: "13px",
                            borderRadius: "8px",
                            border: "1.5px solid #D1D5DB",
                            padding: "10px 14px",
                            background: "#FFFFFF",
                            color: "#111827",
                            outline: "none",
                            transition: "border-color 0.15s ease",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Special Part 4 Sensitive Field Certification Block */}
              {activeSection.id === "part4_processing" && (
                <div
                  data-testid="sensitive-review-block"
                  style={{
                    marginTop: "32px",
                    padding: "24px",
                    background: "#FEF2F2",
                    border: "1.5px solid #FCA5A5",
                    borderRadius: "14px",
                    boxShadow: "0 4px 14px rgba(220, 38, 38, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                    <span style={{ fontSize: "24px", lineHeight: "1" }}>⚖️</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: "15px", fontWeight: 800, color: "#991B1B", margin: 0 }}>
                        Designated Sensitive-Field Legal Review Certification
                      </h4>
                      <p style={{ fontSize: "12px", color: "#7F1D1D", marginTop: "6px", marginBottom: 0, lineHeight: "1.5" }}>
                        Federal immigration regulations require formal attorney or designated specialist signoff certifying that grounds of inadmissibility (removal history, criminal convictions) have been reviewed. Clients are prohibited from self-certifying this requirement.
                      </p>

                      {submission.sensitive_fields_reviewed ? (
                        <div
                          style={{
                            marginTop: "16px",
                            padding: "16px",
                            background: "#FFFFFF",
                            borderRadius: "10px",
                            border: "1.5px solid #6EE7B7",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ fontWeight: 800, color: "#065F46", fontSize: "13px" }}>
                            ✓ CERTIFIED BY LEGAL COUNSEL
                          </span>
                          <p style={{ color: "#374151", margin: "6px 0 2px 0" }}>
                            Notes: {submission.reviewer_notes || "Statutory grounds reviewed."}
                          </p>
                          <p style={{ color: "#6B7280", fontSize: "11px", margin: 0 }}>
                            Certified at: {submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString() : "Confirmed"}
                          </p>
                        </div>
                      ) : (
                        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          {isClientRole ? (
                            <div
                              style={{
                                padding: "14px 16px",
                                background: "#FFFBEB",
                                border: "1px solid #FCD34D",
                                borderRadius: "10px",
                                fontSize: "12px",
                                color: "#92400E",
                                lineHeight: "1.5",
                              }}
                            >
                              ℹ️ You are viewing as a client applicant. Sensitive background certification must be completed by your retained legal counsel prior to formal package filing.
                            </div>
                          ) : (
                            <>
                              <textarea
                                rows={2}
                                value={sensitiveNotes}
                                onChange={(e) => setSensitiveNotes(e.target.value)}
                                placeholder="Enter certified counsel notes verifying review of police clearance, court documents, or no-record declarations..."
                                style={{
                                  width: "100%",
                                  fontSize: "12px",
                                  padding: "10px 14px",
                                  borderRadius: "8px",
                                  border: "1.5px solid #FCA5A5",
                                  background: "#FFFFFF",
                                  color: "#111827",
                                  outline: "none",
                                }}
                              />
                              <div>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={handleSignoffSensitive}
                                  style={{
                                    padding: "10px 20px",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#FFFFFF",
                                    background: "#DC2626",
                                    borderRadius: "8px",
                                    border: "none",
                                    cursor: isSubmitting ? "not-allowed" : "pointer",
                                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  Certify Sensitive Fields Review
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar for Section: Revision reason & Save button */}
              <div
                style={{
                  marginTop: "32px",
                  paddingTop: "20px",
                  borderTop: "1.5px solid #E2E8E4",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ flex: 1, minWidth: "280px", maxWidth: "480px" }}>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Revision reason (e.g. Updated client Alien number from historical approval notice)..."
                    style={{
                      width: "100%",
                      fontSize: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid #D1D5DB",
                      background: "#FAFAF8",
                      color: "#111827",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveAnswers}
                    style={{
                      padding: "11px 24px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#FFFFFF",
                      background: "#0D6866",
                      borderRadius: "8px",
                      border: "none",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 8px rgba(13, 104, 102, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>💾</span> Save & Record Revision #{submission.revision_number + 1}
                  </button>

                  {!isClientRole && submission.status !== "confirmed" && submission.status !== "approved" && (
                    <button
                      type="button"
                      data-testid="finalize-form-btn"
                      disabled={
                        isSubmitting ||
                        submission.has_unconfirmed_ai_fields ||
                        hasFormConflicts
                      }
                      onClick={handleFinalize}
                      style={{
                        padding: "11px 20px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        background:
                          submission.has_unconfirmed_ai_fields || hasFormConflicts
                            ? "#9CA3AF"
                            : "#059669",
                        borderRadius: "8px",
                        border: "none",
                        cursor:
                          submission.has_unconfirmed_ai_fields || hasFormConflicts
                            ? "not-allowed"
                            : isSubmitting
                            ? "wait"
                            : "pointer",
                        boxShadow: "0 2px 8px rgba(5, 150, 105, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.15s ease",
                      }}
                      title={
                        hasFormConflicts
                          ? "Resolve multi-document evidence conflicts before finalization"
                          : submission.has_unconfirmed_ai_fields
                          ? "Confirm all unconfirmed AI draft values before finalization"
                          : "Finalize and certify statutory form filing draft"
                      }
                    >
                      <span>🔒</span> Finalize & Lock Filing Form
                    </button>
                  )}

                  {submission.status === "confirmed" && (
                    <span
                      data-testid="form-certified-badge"
                      style={{
                        padding: "8px 16px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#065F46",
                        background: "#D1FAE5",
                        border: "1px solid #6EE7B7",
                        borderRadius: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      ✓ Certified Filing-Ready
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#6E7F7C", fontSize: "14px" }}>
              No section selected.
            </div>
          )}
        </div>
      </div>

      {/* Revision History Drawer Modal */}
      {showHistoryDrawer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(6, 60, 61, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              boxShadow: "0 20px 45px rgba(6, 60, 61, 0.25)",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #DCE5E1",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                background: "#063C3D",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#FFFFFF" }}>
                Revision History Log
              </h3>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#B9DED4",
                  fontSize: "24px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: 1,
                fontSize: "12px",
              }}
            >
              {(submission.revision_history || []).map((rev) => (
                <div
                  key={rev.revision}
                  style={{
                    padding: "14px 16px",
                    background: "#F8FAF9",
                    border: "1px solid #E2E8E4",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                      fontWeight: 700,
                      color: "#172322",
                    }}
                  >
                    <span>Revision #{rev.revision}</span>
                    <span style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 400 }}>
                      {new Date(rev.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ color: "#374151", margin: "4px 0", lineHeight: "1.4" }}>
                    {rev.changes_summary}
                  </p>
                  <p style={{ fontSize: "11px", color: "#6E7F7C", margin: "6px 0 0 0" }}>
                    Author: {rev.updated_by}
                  </p>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E2E8E4",
                background: "#F8FAF9",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                style={{
                  padding: "8px 20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "#E5E7EB",
                  color: "#374151",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
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
