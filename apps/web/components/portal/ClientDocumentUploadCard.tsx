import React, { useState } from "react";
import { DocumentItem } from "../../lib/types";

export interface ClientDocumentUploadCardProps {
  documents: DocumentItem[];
  onOpenUploadModal: () => void;
  onOpenOcrModal?: () => void;
  overviewDocFilter: string;
  onFilterChange: (filter: string) => void;
  clientName?: string;
}

export function DocumentProgressionStepper({
  status,
  processingStatus,
  verificationStatus,
}: {
  status: string;
  processingStatus?: string;
  verificationStatus?: string;
}) {
  // Step 1: Uploaded (receipt only)
  const isUploaded = status === "uploaded" || status === "received" || !!processingStatus;

  // Step 2: Under Review OR Rejected (human verification dimension)
  const isRejected = verificationStatus === "rejected" || status === "correction_required";
  const isUnderReview =
    !isRejected &&
    status !== "uploaded" &&
    status !== "received" &&
    (verificationStatus === "pending" ||
     verificationStatus === "review" ||
     status === "under_review" ||
     (processingStatus === "completed" && verificationStatus !== "verified" && verificationStatus !== "accepted"));

  // Step 3: Accepted (human verification passed)
  const isAccepted = verificationStatus === "verified" || verificationStatus === "accepted" || status === "accepted";

  // Step 4: Package-Ready (backend eligibility + all 6 dimensions passed)
  const isPackageReady =
    !isRejected && (status === "package_ready" || status === "ready" || status === "filed");

  const currentStep = isPackageReady
    ? 4
    : isAccepted
    ? 3
    : (isUnderReview || isRejected)
    ? 2
    : 1;

  const steps = [
    { num: 1, label: "Uploaded", desc: "Receipt confirmed" },
    { num: 2, label: isRejected ? "Correction Req." : "Under Review", desc: isRejected ? "Revise & resubmit" : "Human review in progress" },
    { num: 3, label: "Accepted", desc: "Verification passed" },
    { num: 4, label: "Package-Ready", desc: "All 6 dimensions passed; ready for filing" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: "#F8FAF9",
        border: "1px solid #DCE5E1",
        borderRadius: "20px",
        padding: "3px 8px",
        fontSize: "11px",
      }}
      aria-label={`Document progression stage: ${steps[currentStep - 1]?.label}`}
    >
      {steps.map((st, idx) => {
        const isDone = st.num < currentStep;
        const isCurrent = st.num === currentStep;
        const isStepRejected = isRejected && st.num === 2;

        return (
          <React.Fragment key={st.num}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontWeight: isCurrent ? 750 : 500,
                color: isStepRejected
                  ? "#DC2626"
                  : isCurrent
                  ? "#0D6866"
                  : isDone
                  ? "#166534"
                  : "#94A3B8",
              }}
            >
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  fontWeight: 800,
                  background: isStepRejected
                    ? "#FEE2E2"
                    : isCurrent
                    ? "#0D6866"
                    : isDone
                    ? "#DCFCE7"
                    : "#E2E8F0",
                  color: isStepRejected
                    ? "#DC2626"
                    : isCurrent
                    ? "#FFFFFF"
                    : isDone
                    ? "#166534"
                    : "#64748B",
                }}
              >
                {isStepRejected ? "✕" : isDone ? "✓" : st.num}
              </span>
              <span>● {st.num}. {st.label}</span>
            </span>
            {idx < steps.length - 1 && (
              <span style={{ color: "#CBD5E1", fontSize: "10px" }}>›</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function ClientDocumentUploadCard({
  documents,
  onOpenUploadModal,
  onOpenOcrModal,
  overviewDocFilter,
  onFilterChange,
  clientName = "Primary Applicant",
}: ClientDocumentUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  // Status Counts
  const verifiedCount = documents.filter(
    (d) => (d.status as string) === "verified" || d.verification_status === "verified" || (d.status as string) === "accepted"
  ).length;

  const inReviewCount = documents.filter(
    (d) =>
      d.status === "under_review" ||
      d.verification_status === "under_review" ||
      (d.status as string) === "in_review" ||
      (d.verification_status as string) === "in_review" ||
      d.processing_status === "processing"
  ).length;

  const correctionCount = documents.filter(
    (d) =>
      (d.status as string) === "rejected" ||
      d.verification_status === "rejected" ||
      d.status === "action_needed"
  ).length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onOpenUploadModal();
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #DCE5E1",
        borderRadius: "12px",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Header and Title */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid #DCE5E1",
          paddingBottom: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ display: "inline-flex", alignItems: "center" }} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
              Required Document List &amp; Live Status
            </h3>
            <span
              style={{
                background: documents.length > 0 ? "#EAF6F0" : "#F1F5F9",
                color: documents.length > 0 ? "#0D6866" : "#64748B",
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "20px",
                border: `1px solid ${documents.length > 0 ? "#B9DED4" : "#CBD5E1"}`,
              }}
            >
              {documents.length} Document{documents.length === 1 ? "" : "s"} Uploaded
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#6E7F7C", lineHeight: 1.4 }}>
            Track evidentiary document collection, automated AI OCR extraction, legal verification, and correction notices.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {onOpenOcrModal && (
            <button
              type="button"
              onClick={onOpenOcrModal}
              style={{
                background: "#FFFFFF",
                color: "#0D6866",
                border: "1px solid #B9DED4",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "11.5px",
                fontWeight: 650,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                <path d="M9 18h6" />
                <path d="M10 22h4" />
              </svg>
              <span>OCR Standards</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenUploadModal}
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 650,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span>+ Upload Evidence File</span>
          </button>
        </div>
      </div>

      {/* Pillar 2 Real-Time Status Pills */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#6E7F7C",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Status Overview:
        </span>
        <span
          style={{
            background: "#DCFCE7",
            color: "#166534",
            border: "1px solid #86EFAC",
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "11.5px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span>✓</span> Verified: {verifiedCount}
        </span>
        <span
          style={{
            background: "#FEF3C7",
            color: "#92400E",
            border: "1px solid #FCD34D",
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "11.5px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
          </svg>
          <span>In Review: {inReviewCount}</span>
        </span>
        <span
          style={{
            background: correctionCount > 0 ? "#FEE2E2" : "#F8FAF9",
            color: correctionCount > 0 ? "#991B1B" : "#64748B",
            border: `1px solid ${correctionCount > 0 ? "#FECACA" : "#E2E8F0"}`,
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "11.5px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={correctionCount > 0 ? "#991B1B" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Correction Required: {correctionCount}</span>
        </span>
      </div>

      {/* Zero State or Filterable Evidence List */}
      {documents.length === 0 ? (
        <div
          data-testid="no-documents-uploaded"
          style={{
            textAlign: "center",
            padding: "32px 20px",
            background: "#F8FAF9",
            border: "1px dashed #B9DED4",
            borderRadius: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }} aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
            No Evidentiary Documents Uploaded Yet
          </h4>
          <p
            style={{
              margin: "0 0 14px 0",
              fontSize: "12.5px",
              color: "#6E7F7C",
              maxWidth: "460px",
              marginInline: "auto",
              lineHeight: 1.45,
            }}
          >
            Your document collection is currently empty. Upload your identity, civil status, or financial evidence files to initiate automated AI OCR extraction and legal verification.
          </p>
          <button
            type="button"
            onClick={onOpenUploadModal}
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "8px 18px",
              fontSize: "12.5px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            + Upload First Evidence File
          </button>
        </div>
      ) : (
        <>
          {/* Filter Buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {[
              { key: "all", label: `All Documents (${documents.length})` },
              {
                key: "rejected",
                label: `Correction Required (${correctionCount})`,
              },
              {
                key: "under_review",
                label: `Under Review (${inReviewCount})`,
              },
              {
                key: "accepted",
                label: `Accepted (${verifiedCount})`,
              },
            ].map((flt) => {
              const isActive = overviewDocFilter === flt.key;
              return (
                <button
                  key={flt.key}
                  type="button"
                  onClick={() => onFilterChange(flt.key)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "11.5px",
                    fontWeight: isActive ? 700 : 500,
                    borderRadius: "20px",
                    border: isActive ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                    background: isActive ? "#0D6866" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#445451",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {flt.label}
                </button>
              );
            })}
          </div>

          {/* Document Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {documents
              .filter((doc) => {
                const isAccepted = (doc.status as string) === "verified" || doc.verification_status === "verified" || (doc.status as string) === "accepted";
                const isRejected = (doc.status as string) === "rejected" || doc.verification_status === "rejected" || doc.status === "action_needed";
                const isReview =
                  doc.status === "under_review" ||
                  doc.verification_status === "under_review" ||
                  (doc.status as string) === "in_review" ||
                  (doc.verification_status as string) === "in_review" ||
                  doc.processing_status === "processing";

                if (overviewDocFilter === "action_needed" || overviewDocFilter === "rejected") return isRejected;
                if (overviewDocFilter === "under_review") return isReview;
                if (overviewDocFilter === "accepted") return isAccepted;
                return true;
              })
              .map((doc) => {
                const isAccepted = (doc.status as string) === "verified" || doc.verification_status === "verified" || (doc.status as string) === "accepted";
                const isRejected = (doc.status as string) === "rejected" || doc.verification_status === "rejected" || doc.status === "action_needed";
                const isReview =
                  doc.status === "under_review" ||
                  doc.verification_status === "under_review" ||
                  (doc.status as string) === "in_review" ||
                  (doc.verification_status as string) === "in_review";
                const isUploaded = (doc.status as string) === "uploaded" || doc.processing_status === "processing" || doc.processing_status === "pending";
                const isRequired = doc.status === "missing";

                return (
                  <div
                    key={doc.id}
                    style={{
                      background: isRejected ? "#FFFDFD" : isAccepted ? "#FAFCFA" : "#FFFFFF",
                      border: `1px solid ${isRejected ? "#FECACA" : isAccepted ? "#B9DED4" : "#DCE5E1"}`,
                      borderRadius: "8px",
                      padding: "12px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "13.5px", color: "#063C3D" }}>
                            {doc.title || doc.filename}
                          </strong>
                          <span
                            style={{
                              fontSize: "10.5px",
                              padding: "1.5px 6px",
                              borderRadius: "4px",
                              background: "#EAF6F0",
                              color: "#0D6866",
                              border: "1px solid #B9DED4",
                              fontWeight: 600,
                            }}
                          >
                            {(doc.category || "evidentiary").replace(/_/g, " ")}
                          </span>
                        </div>

                        <div style={{ fontSize: "11.5px", color: "#64748B", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <strong>Applicant:</strong> {doc.proposed_applicant_name || doc.uploaded_by || clientName}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
                            <strong>Statutory Basis:</strong> Evidentiary Proof
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#475569", marginTop: "2px", fontStyle: "italic" }}>
                          {doc.verification_notes || doc.processing_error || (isAccepted ? "Verified by legal team." : "File received on record.")}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        {isAccepted && (
                          <span
                            style={{
                              background: "#DCFCE7",
                              color: "#166534",
                              border: "1px solid #86EFAC",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>✓</span> ACCEPTED &amp; VERIFIED
                          </span>
                        )}
                        {isReview && (
                          <span
                            style={{
                              background: "#EAF6F0",
                              color: "#0D6866",
                              border: "1px solid #B9DED4",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0D6866" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
                            UNDER LEGAL REVIEW
                          </span>
                        )}
                        {isUploaded && (
                          <span
                            style={{
                              background: "#E0F2FE",
                              color: "#0369A1",
                              border: "1px solid #BAE6FD",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                            UPLOADED (OCR PROCESSING)
                          </span>
                        )}
                        {isRejected && (
                          <span
                            style={{
                              background: "#FEE2E2",
                              color: "#991B1B",
                              border: "1px solid #FECACA",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            CORRECTION REQUIRED
                          </span>
                        )}
                        {isRequired && (
                          <span
                            style={{
                              background: "#FEF3C7",
                              color: "#92400E",
                              border: "1px solid #FDE68A",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                            ACTION NEEDED / MISSING
                          </span>
                        )}

                        {(isRequired || isRejected) && (
                          <button
                            type="button"
                            onClick={onOpenUploadModal}
                            style={{
                              background: isRejected ? "#991B1B" : "#0D6866",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              fontSize: "11.5px",
                              fontWeight: 650,
                              cursor: "pointer",
                            }}
                          >
                            {isRejected ? "Re-Upload Document →" : "Upload File →"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progression Stepper */}
                    <div
                      style={{
                        background: "#F8FAF9",
                        borderTop: "1px solid #F1F5F9",
                        paddingTop: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
                        Pipeline:
                      </span>
                      <DocumentProgressionStepper
                        status={doc.status}
                        processingStatus={doc.processing_status}
                        verificationStatus={doc.verification_status}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
