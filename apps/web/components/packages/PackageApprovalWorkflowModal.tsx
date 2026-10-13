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
    <div
      data-testid="approval-workflow-modal"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(6, 60, 61, 0.55)",
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
          boxShadow: "0 24px 48px rgba(6, 60, 61, 0.25)",
          maxWidth: "920px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #DCE5E1",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "22px 28px",
            background: "linear-gradient(135deg, #063C3D 0%, #084B4C 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(185, 222, 212, 0.2)",
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
              <span>Auditable Approval Workflow</span>
              <span>•</span>
              <span>Exact Package: {packageItem.version_number}</span>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", margin: "6px 0 2px 0" }}>
              {packageItem.name}
            </h3>
            <p
              style={{
                fontSize: "11px",
                color: "#DDEFE8",
                fontFamily: "ui-monospace, monospace",
                margin: 0,
                maxWidth: "600px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={packageItem.package_hash}
            >
              Package Hash: {packageItem.package_hash}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#B9DED4",
              fontSize: "26px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body: Stepper & Controls */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            background: "#FFFFFF",
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: "12px 16px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#991B1B",
                fontWeight: 600,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* 7-Stage Horizontal Stepper */}
          <div
            style={{
              background: "#F8F9F8",
              padding: "18px",
              borderRadius: "12px",
              border: "1px solid #E2E8E4",
            }}
          >
            <h4
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#6E7F7C",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 14px 0",
              }}
            >
              7-Stage Formal Sequential Signoff Chain
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
                gap: "8px",
              }}
            >
              {chain.map((stg, idx) => {
                const isCurrent = stg.stage === activeStage;
                const isPassedOrApproved = stg.status === "passed" || stg.status === "approved";
                const isBlocked = stg.status === "blocked" || stg.status === "rejected";

                return (
                  <button
                    key={stg.stage}
                    type="button"
                    onClick={() => setActiveStage(stg.stage)}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: isCurrent ? "#EAF6F0" : "#FFFFFF",
                      border: isCurrent ? "1.5px solid #0D6866" : "1px solid #E2E8E4",
                      boxShadow: isCurrent ? "0 2px 6px rgba(13, 104, 102, 0.1)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", fontWeight: 700 }}>
                      <span style={{ color: "#6E7F7C" }}>#{idx + 1}</span>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "999px",
                          background: isPassedOrApproved ? "#10B981" : isBlocked ? "#EF4444" : "#F59E0B",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#172322",
                        marginTop: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={stg.title}
                    >
                      {stg.title.replace(/^\d+\.\s*/, "")}
                    </div>
                    <div style={{ fontSize: "10px", color: "#6E7F7C", textTransform: "capitalize", marginTop: "2px" }}>
                      {stg.status}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Stage Detail & Signoff Controls */}
          {currentStageObj && (
            <div
              style={{
                padding: "20px",
                border: "1.5px solid #E2E8E4",
                borderRadius: "12px",
                background: "#FFFFFF",
                boxShadow: "0 1px 4px rgba(0, 0, 0, 0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #E2E8E4",
                  paddingBottom: "12px",
                }}
              >
                <div>
                  <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#172322", margin: 0 }}>
                    {currentStageObj.title}
                  </h4>
                  <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "3px 0 0 0" }}>
                    Designated Signatory: <strong>{currentStageObj.actor || "Authorized Representative"}</strong>
                  </p>
                </div>
                <div>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      background:
                        currentStageObj.status === "approved" || currentStageObj.status === "passed"
                          ? "#ECFDF5"
                          : currentStageObj.status === "rejected" || currentStageObj.status === "blocked"
                          ? "#FEF2F2"
                          : "#FFFBEB",
                      color:
                        currentStageObj.status === "approved" || currentStageObj.status === "passed"
                          ? "#065F46"
                          : currentStageObj.status === "rejected" || currentStageObj.status === "blocked"
                          ? "#991B1B"
                          : "#92400E",
                      border:
                        currentStageObj.status === "approved" || currentStageObj.status === "passed"
                          ? "1px solid #A7F3D0"
                          : currentStageObj.status === "rejected" || currentStageObj.status === "blocked"
                          ? "1px solid #FECACA"
                          : "1px solid #FDE68A",
                    }}
                  >
                    {currentStageObj.status}
                  </span>
                </div>
              </div>

              {currentStageObj.notes && (
                <div style={{ padding: "12px 14px", background: "#F8FAF9", borderRadius: "8px", fontSize: "12px", color: "#374151" }}>
                  <strong style={{ color: "#172322" }}>Recorded Notes: </strong>
                  {currentStageObj.notes}
                </div>
              )}

              {currentStageObj.timestamp && (
                <div style={{ fontSize: "11px", color: "#6E7F7C", fontFamily: "ui-monospace, monospace" }}>
                  Completed At: {new Date(currentStageObj.timestamp).toLocaleString()}
                </div>
              )}

              {/* Action Buttons if Pending */}
              {currentStageObj.status === "pending" && (
                <div style={{ paddingTop: "6px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter audit signoff notes, statutory citations, or disposition remarks..."
                    style={{
                      width: "100%",
                      fontSize: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid #D1D5DB",
                      color: "#111827",
                      outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDecision("rejected")}
                      style={{
                        padding: "9px 16px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#DC2626",
                        background: "#FEF2F2",
                        borderRadius: "8px",
                        border: "1px solid #FCA5A5",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Reject / Request Revisions
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDecision("approved")}
                      style={{
                        padding: "9px 20px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        background: "#0D6866",
                        borderRadius: "8px",
                        border: "none",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: "0 2px 6px rgba(13, 104, 102, 0.25)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Certify & Approve Stage
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Filing Instructions Card (Mandatory External Submission Policy) */}
          <div
            style={{
              padding: "20px",
              background: "#FFFBEB",
              border: "1.5px solid #FCD34D",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#92400E", fontWeight: 700, fontSize: "14px" }}>
              <span>🏛️</span>
              <span>Official Filing Procedure & Automated Submission Disclaimer</span>
            </div>
            <p style={{ fontSize: "12px", color: "#78350F", lineHeight: "1.5", margin: 0 }}>
              In accordance with federal regulatory requirements, automatic submission of petitions to government portals is intentionally disclaimed and prohibited. All external filings must follow verified physical assembly or authorized legal practitioner manual portal submission.
            </p>

            {packageItem.manual_filing_instructions && (
              <div
                style={{
                  marginTop: "8px",
                  background: "#FFFFFF",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #FCD34D",
                  fontSize: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontWeight: 700, color: "#172322" }}>
                  Designated Courier Filing Address:
                </div>
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    color: "#374151",
                    background: "#F8FAF9",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid #E2E8E4",
                  }}
                >
                  {packageItem.manual_filing_instructions.primary_filing_address}
                </div>
                <div style={{ fontWeight: 700, color: "#172322", paddingTop: "6px" }}>
                  Mandatory Packaging Steps:
                </div>
                <ol style={{ paddingLeft: "20px", margin: 0, color: "#4B5563", lineHeight: "1.6" }}>
                  {packageItem.manual_filing_instructions.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            background: "#F8F9F8",
            borderTop: "1px solid #E2E8E4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#6E7F7C",
          }}
        >
          <span>Audit Log ID: {packageItem.id}</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#FFFFFF",
              border: "1.5px solid #DCE5E1",
              borderRadius: "8px",
              fontWeight: 700,
              color: "#374151",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
