"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadGuidance,
  BatchUploadReceipt,
  FamilyDocumentSummary,
  ApplicantDocumentSummary,
  ApplicantDocumentItem,
  ApplicantOutstandingItem,
  CaseInterimReport,
  PurgeRequestResponse,
  DocumentCategory,
} from "../../lib/types";
import {
  fetchUploadGuidance,
  submitBatchUpload,
  fetchFamilyDocumentsSummary,
  verifyDocumentDownload,
  requestDocumentPurge,
  confirmDocumentPurge,
  FALLBACK_UPLOAD_GUIDANCE,
} from "../../lib/api";
import { calculateSHA256, formatBytes } from "../../lib/crypto";

interface FamilyDocumentIntakeHubProps {
  caseId?: string;
  onDocumentUploaded?: () => void;
}

export function FamilyDocumentIntakeHub({
  caseId = "case-01",
  onDocumentUploaded,
}: FamilyDocumentIntakeHubProps) {
  // Guidance state
  const [guidance, setGuidance] = useState<UploadGuidance>(FALLBACK_UPLOAD_GUIDANCE);
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);

  // Summary state
  const [familySummary, setFamilySummary] = useState<FamilyDocumentSummary | null>(null);
  const [selectedApplicantFilter, setSelectedApplicantFilter] = useState<string>("all");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Upload configuration
  const [isCombinedFile, setIsCombinedFile] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string>(""); // empty = unassigned / let system propose
  const [selectedCategory, setSelectedCategory] = useState<string>("supporting_evidence");

  // Selected files queue
  const [queuedFiles, setQueuedFiles] = useState<{ file: File; id: string; hash?: string; sizeStr: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastBatchReceipt, setLastBatchReceipt] = useState<BatchUploadReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Download verification state
  const [verifiedDownloadNotice, setVerifiedDownloadNotice] = useState<{ docId: string; notice: string } | null>(null);

  // Two-step deletion modal state
  const [purgeStep, setPurgeStep] = useState<{ docId: string; step1?: PurgeRequestResponse } | null>(null);
  const [acknowledgedLocalCopy, setAcknowledgedLocalCopy] = useState(false);
  const [purgeSuccessNotice, setPurgeSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Load guidance and family summary
  useEffect(() => {
    async function loadData() {
      setIsLoadingSummary(true);
      try {
        const [gData, sData] = await Promise.all([
          fetchUploadGuidance(),
          fetchFamilyDocumentsSummary(caseId),
        ]);
        if (gData) setGuidance(gData);
        if (sData) setFamilySummary(sData);
      } catch (e) {
        console.error("Failed to load intake data", e);
      } finally {
        setIsLoadingSummary(false);
      }
    }
    loadData();
  }, [caseId]);

  // Handle files chosen from picker or camera
  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setErrorMessage(null);

    const newQueued: { file: File; id: string; sizeStr: string }[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (file.size > guidance.max_file_size_bytes) {
        setErrorMessage(`File "${file.name}" exceeds the maximum allowed size of 50MB.`);
        continue;
      }
      newQueued.push({
        file,
        id: `q-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        sizeStr: formatBytes(file.size),
      });
    }

    setQueuedFiles((prev) => [...prev, ...newQueued]);
  };

  const handleRemoveQueued = (id: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit batch upload
  const handleExecuteUpload = async () => {
    if (queuedFiles.length === 0) {
      setErrorMessage("Please select or scan at least one document before submitting.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setErrorMessage(null);
    setLastBatchReceipt(null);

    try {
      setUploadProgress(45);
      const rawFiles = queuedFiles.map((q) => q.file);

      const receipt = await submitBatchUpload(
        rawFiles,
        caseId,
        selectedApplicantId || undefined,
        selectedCategory,
        "retained_client"
      );

      setUploadProgress(100);
      setLastBatchReceipt(receipt);
      setQueuedFiles([]);

      // Refresh family summary
      const updatedSummary = await fetchFamilyDocumentsSummary(caseId);
      setFamilySummary(updatedSummary);
      onDocumentUploaded?.();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to process document upload. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Download with honest verification
  const handleSimulatedDownload = async (docId: string, filename: string) => {
    // Starting a browser download is NOT proof the file was saved
    const dummyBytes = 1048576;
    const res = await verifyDocumentDownload(docId, dummyBytes, true);
    setVerifiedDownloadNotice({
      docId,
      notice: res.verification_limits_notice,
    });
  };

  // Two-step purge initiation
  const handleStartPurge = async (docId: string) => {
    try {
      const step1 = await requestDocumentPurge(docId);
      setPurgeStep({ docId, step1 });
      setAcknowledgedLocalCopy(false);
    } catch (err: any) {
      alert(`Purge blocked: ${err.message || "An active legal hold or unresolved anomaly prevents deletion."}`);
    }
  };

  const handleConfirmPurge = async () => {
    if (!purgeStep || !purgeStep.step1) return;
    if (!acknowledgedLocalCopy) {
      alert("You must acknowledge that Documento cannot delete local copies already saved to your device.");
      return;
    }

    try {
      const res = await confirmDocumentPurge(
        purgeStep.docId,
        purgeStep.step1.confirmation_token,
        true
      );
      setPurgeSuccessNotice(
        "Document permanently deleted from cloud storage. Notice: Documento cannot and does not delete any local copies saved to your computer or device."
      );
      setPurgeStep(null);

      // Refresh
      const updated = await fetchFamilyDocumentsSummary(caseId);
      setFamilySummary(updated);
    } catch (err: any) {
      alert(`Purge confirmation failed: ${err.message}`);
    }
  };

  // Filtered applicants
  const displayedApplicants = familySummary?.applicants.filter((a) => {
    if (selectedApplicantFilter === "all") return true;
    if (selectedApplicantFilter === "primary") return a.relationship === "primary_applicant";
    return a.applicant_id === selectedApplicantFilter;
  }) || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", color: "#172322" }}>
      {/* ---------------------------------------------------------------------
          1. STATUTORY LIFECYCLE & RETENTION NOTICE HEADER
          --------------------------------------------------------------------- */}
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
          color: "#FFFFFF",
          borderRadius: "14px",
          padding: "24px 28px",
          boxShadow: "0 4px 20px rgba(6, 60, 61, 0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ maxWidth: "680px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.18)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 650,
                  letterSpacing: "0.03em",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                }}
              >
                Phase 4 Certified Intake
              </span>
              <span style={{ fontSize: "12px", color: "#B9DED4" }}>
                Temporary Lifecycle &amp; Privacy Protection
              </span>
            </div>
            <h2 style={{ margin: "0 0 10px 0", fontSize: "22px", fontWeight: 750, letterSpacing: "-0.01em" }}>
              Mobile-First Evidentiary Intake &amp; Family Checklist
            </h2>
            <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.55, color: "#E7EFEB" }}>
              Upload individual documents or combined multipage scans with automated page boundary detection.
              All files are quarantined in tamper-proof encrypted storage with SHA-256 integrity validation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowGuidanceModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#FFFFFF",
              color: "#063C3D",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              transition: "transform 0.15s ease",
            }}
          >
            <span>📷</span>
            <span>Camera Scanning Rules</span>
          </button>
        </div>

        {/* Temporary Retention Policy Banner */}
        <div
          style={{
            marginTop: "18px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.22)",
            border: "1px solid rgba(185, 222, 212, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>🔒</span>
            <span>
              <strong>Retention Policy:</strong> 7-Day post-download retention with automated Day-15 inactivity cleanup. Legal holds and unresolved anomaly files are strictly protected from routine purge.
            </span>
          </div>
          <span style={{ color: "#B9DED4", fontWeight: 650 }}>
            Inactivity warnings on Days 7, 10, 14
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          2. OVERALL FAMILY SUMMARY CARD
          --------------------------------------------------------------------- */}
      {familySummary && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(6, 60, 61, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
                Family Evidentiary Readiness Summary
              </h3>
              <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                Case: {familySummary.case_number} • Total Applicants: {familySummary.applicants.length}
              </span>
            </div>

            {/* Filter buttons */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setSelectedApplicantFilter("all")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 650,
                  border: selectedApplicantFilter === "all" ? "1px solid #0D6866" : "1px solid #DCE5E1",
                  background: selectedApplicantFilter === "all" ? "#EAF6F0" : "#FFFFFF",
                  color: selectedApplicantFilter === "all" ? "#0D6866" : "#445451",
                  cursor: "pointer",
                }}
              >
                All Family
              </button>
              {familySummary.applicants.map((a) => (
                <button
                  key={a.applicant_id || a.relationship}
                  type="button"
                  onClick={() => setSelectedApplicantFilter(a.applicant_id || "primary")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 650,
                    border: selectedApplicantFilter === (a.applicant_id || "primary") ? "1px solid #0D6866" : "1px solid #DCE5E1",
                    background: selectedApplicantFilter === (a.applicant_id || "primary") ? "#EAF6F0" : "#FFFFFF",
                    color: selectedApplicantFilter === (a.applicant_id || "primary") ? "#0D6866" : "#445451",
                    cursor: "pointer",
                  }}
                >
                  {a.applicant_name} ({a.relationship.replace("_", " ")})
                </button>
              ))}
            </div>
          </div>

          {/* Metric Counter Blocks */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
              <span style={{ fontSize: "11px", fontWeight: 650, color: "#6E7F7C", display: "block", textTransform: "uppercase" }}>
                Total Required
              </span>
              <strong style={{ fontSize: "20px", color: "#063C3D" }}>{familySummary.total_required}</strong>
            </div>
            <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
              <span style={{ fontSize: "11px", fontWeight: 650, color: "#6E7F7C", display: "block", textTransform: "uppercase" }}>
                Received
              </span>
              <strong style={{ fontSize: "20px", color: "#0D6866" }}>{familySummary.total_received}</strong>
            </div>
            <div style={{ background: "#EAF6F0", padding: "12px 14px", borderRadius: "8px", border: "1px solid #B9DED4" }}>
              <span style={{ fontSize: "11px", fontWeight: 650, color: "#176B50", display: "block", textTransform: "uppercase" }}>
                Officer Verified
              </span>
              <strong style={{ fontSize: "20px", color: "#176B50" }}>{familySummary.total_verified}</strong>
            </div>
            <div style={{ background: "#FFF5F5", padding: "12px 14px", borderRadius: "8px", border: "1px solid #FED7D7" }}>
              <span style={{ fontSize: "11px", fontWeight: 650, color: "#C53030", display: "block", textTransform: "uppercase" }}>
                Correction Needed
              </span>
              <strong style={{ fontSize: "20px", color: "#C53030" }}>{familySummary.total_correction_required}</strong>
            </div>
            <div style={{ background: "#F1F6F4", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
              <span style={{ fontSize: "11px", fontWeight: 650, color: "#445451", display: "block", textTransform: "uppercase" }}>
                Unassigned
              </span>
              <strong style={{ fontSize: "20px", color: "#445451" }}>{familySummary.total_unassigned}</strong>
            </div>
          </div>

          {/* Statutory Disclaimer */}
          <div
            style={{
              padding: "10px 14px",
              background: "#F8F7F2",
              borderLeft: "3px solid #0D6866",
              borderRadius: "4px",
              fontSize: "11.5px",
              color: "#5B6B67",
              lineHeight: 1.45,
            }}
          >
            ⚠️ <strong>Legal Notice:</strong> {familySummary.non_readiness_disclaimer}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          3. MOBILE-FIRST UPLOAD INTAKE BOX
          --------------------------------------------------------------------- */}
      <div
        style={{
          background: "#FFFFFF",
          border: "2px dashed #B9DED4",
          borderRadius: "14px",
          padding: "26px",
          boxShadow: "0 2px 10px rgba(6, 60, 61, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 700, color: "#063C3D" }}>
              Upload New Documents &amp; Camera Scans
            </h3>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#6E7F7C" }}>
              Batch uploads supported. You can select one file or multiple files simultaneously.
            </p>
          </div>

          {/* Combined multi-document vs individual toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "#F8F7F2",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #DCE5E1",
            }}
          >
            <label style={{ fontSize: "12px", fontWeight: 650, color: "#063C3D", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="checkbox"
                checked={isCombinedFile}
                onChange={(e) => setIsCombinedFile(e.target.checked)}
                style={{ cursor: "pointer", accentColor: "#0D6866" }}
              />
              Combined File with Multiple Documents (Automated Boundary Splitting)
            </label>
          </div>
        </div>

        {/* Association and Category selectors */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {/* Optional Applicant Assignment */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
              Target Applicant (Optional)
            </label>
            <select
              value={selectedApplicantId}
              onChange={(e) => setSelectedApplicantId(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "13px",
                background: "#FFFFFF",
                color: "#172322",
              }}
            >
              <option value="">✨ Unassigned (Let Documento Propose Classification)</option>
              <option value="client-primary">Dr. Elena Rostova (Primary Applicant)</option>
              <option value="dep-spouse">Mikhail Rostov (Spouse / Dependant)</option>
              <option value="dep-child">Aarav Rostov (Child / Dependant)</option>
            </select>
            <span style={{ display: "block", fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
              If unassigned, our automated classifier proposes applicant &amp; category for officer review.
            </span>
          </div>

          {/* Evidentiary Category */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
              Document Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "13px",
                background: "#FFFFFF",
                color: "#172322",
              }}
            >
              <option value="identity_passport">Identity &amp; Passports</option>
              <option value="civil_status">Civil Status &amp; Family Records (Marriage, Birth)</option>
              <option value="educational_records">Educational Degrees &amp; Transcripts</option>
              <option value="employment_records">Employment Experience &amp; W-2 Records</option>
              <option value="awards_honors">Awards, Honors &amp; Judging Evidence</option>
              <option value="police_medical">Police Clearance &amp; Sealed Medical (I-693)</option>
              <option value="translations_certifications">Certified English Translations</option>
              <option value="supporting_evidence">Other Supporting Evidence</option>
            </select>
          </div>
        </div>

        {/* Action Buttons for Mobile Camera & File Picker */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/tiff"
            style={{ display: "none" }}
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            style={{
              flex: "1 1 200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "14px 20px",
              borderRadius: "8px",
              background: "#063C3D",
              color: "#FFFFFF",
              border: "none",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(6, 60, 61, 0.2)",
            }}
          >
            <span>📸</span>
            <span>Scan with Mobile Camera</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: "1 1 200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "14px 20px",
              borderRadius: "8px",
              background: "#EAF6F0",
              color: "#0D6866",
              border: "1px solid #B9DED4",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span>📂</span>
            <span>Choose Files from Device</span>
          </button>
        </div>

        {/* Queued Files List */}
        {queuedFiles.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
              Ready to Upload ({queuedFiles.length} file{queuedFiles.length > 1 ? "s" : ""})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {queuedFiles.map((q) => (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px" }}>📄</span>
                    <div>
                      <strong style={{ color: "#063C3D" }}>{q.file.name}</strong>
                      <span style={{ fontSize: "11px", color: "#6E7F7C", marginLeft: "8px" }}>
                        ({q.sizeStr})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQueued(q.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#C53030",
                      fontSize: "12px",
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    ✕ Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Upload Button */}
            <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleExecuteUpload}
                style={{
                  background: isUploading ? "#6E7F7C" : "#0D6866",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: isUploading ? "not-allowed" : "pointer",
                }}
              >
                {isUploading ? `Uploading & Generating Hashes (${uploadProgress}%)...` : `Submit ${queuedFiles.length} Document(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              padding: "12px 16px",
              background: "#FFF5F5",
              border: "1px solid #FEB2B2",
              borderRadius: "8px",
              color: "#C53030",
              fontSize: "13px",
              marginBottom: "14px",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* ---------------------------------------------------------------------
            4. BATCH UPLOAD RECEIPT & LEGAL NON-ACCEPTANCE DISCLAIMER
            --------------------------------------------------------------------- */}
        {lastBatchReceipt && (
          <div
            style={{
              padding: "18px 20px",
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              marginTop: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>✓</span>
                <strong style={{ fontSize: "14px", color: "#176B50" }}>
                  Intake Receipt Generated (Batch #{lastBatchReceipt.batch_id.slice(0, 8)})
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "#0D6866", fontWeight: 650 }}>
                {lastBatchReceipt.uploaded_count} Uploaded • {lastBatchReceipt.duplicate_count} Safe Duplicate(s)
              </span>
            </div>

            {/* Items table */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {lastBatchReceipt.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#FFFFFF",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    fontSize: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{item.filename}</strong>
                    <span style={{ color: "#6E7F7C", marginLeft: "8px" }}>
                      SHA-256: {item.sha256_hash.slice(0, 16)}...
                    </span>
                  </div>
                  <div>
                    {item.status === "duplicate_existing" ? (
                      <span style={{ background: "#FEFCBF", color: "#975A16", padding: "2px 8px", borderRadius: "4px", fontWeight: 650 }}>
                        Safe Duplicate Verified (Existing)
                      </span>
                    ) : item.status === "uploaded" ? (
                      <span style={{ background: "#EAF6F0", color: "#176B50", padding: "2px 8px", borderRadius: "4px", fontWeight: 650 }}>
                        Queued for OCR &amp; Verification
                      </span>
                    ) : (
                      <span style={{ background: "#FED7D7", color: "#C53030", padding: "2px 8px", borderRadius: "4px", fontWeight: 650 }}>
                        Failed: {item.error_message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Mandatory Non-Acceptance Disclaimer */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #B9DED4",
                padding: "12px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#063C3D",
                lineHeight: 1.5,
              }}
            >
              ⚖️ <strong>Statutory Receipt Notice:</strong> {lastBatchReceipt.non_acceptance_disclaimer}
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------
          5. PER-APPLICANT OUTSTANDING, RECEIVED, AND CORRECTION-REQUIRED LISTS
          --------------------------------------------------------------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {displayedApplicants.map((applicant) => (
          <div
            key={applicant.applicant_id || applicant.relationship}
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(6, 60, 61, 0.03)",
            }}
          >
            {/* Applicant Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "#EAF6F0",
                    color: "#0D6866",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {applicant.applicant_name[0]}
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
                    {applicant.applicant_name}
                  </h4>
                  <span style={{ fontSize: "11.5px", color: "#6E7F7C", textTransform: "capitalize" }}>
                    {applicant.relationship.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", fontSize: "11px", fontWeight: 700 }}>
                <span style={{ background: "#F8F7F2", padding: "4px 8px", borderRadius: "4px", color: "#445451" }}>
                  {applicant.outstanding.length} Outstanding
                </span>
                <span style={{ background: "#EAF6F0", padding: "4px 8px", borderRadius: "4px", color: "#176B50" }}>
                  {applicant.received.length} Received
                </span>
                {applicant.correction_required.length > 0 && (
                  <span style={{ background: "#FFF5F5", padding: "4px 8px", borderRadius: "4px", color: "#C53030" }}>
                    {applicant.correction_required.length} Correction Needed
                  </span>
                )}
              </div>
            </div>

            {/* Sub-sections: 3-column or responsive block */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {/* Column A: Outstanding Requirements */}
              <div style={{ background: "#F8F7F2", borderRadius: "8px", padding: "14px", border: "1px solid #DCE5E1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "12px", color: "#063C3D", textTransform: "uppercase" }}>
                    📋 Outstanding Evidence
                  </strong>
                  <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{applicant.outstanding.length}</span>
                </div>
                {applicant.outstanding.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "#6E7F7C", fontStyle: "italic" }}>
                    All requested items submitted ✓
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {applicant.outstanding.map((req) => (
                      <div
                        key={req.requirement_id}
                        style={{
                          background: "#FFFFFF",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #DCE5E1",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>{req.title}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "10.5px", color: "#6E7F7C" }}>{req.category}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedApplicantId(applicant.applicant_id || "");
                              setSelectedCategory(req.category);
                              fileInputRef.current?.click();
                            }}
                            style={{
                              background: "#0D6866",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 650,
                              cursor: "pointer",
                            }}
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Column B: Received & Verified Evidence */}
              <div style={{ background: "#F8F7F2", borderRadius: "8px", padding: "14px", border: "1px solid #DCE5E1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "12px", color: "#063C3D", textTransform: "uppercase" }}>
                    📁 Received Files
                  </strong>
                  <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{applicant.received.length}</span>
                </div>
                {applicant.received.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "#6E7F7C", fontStyle: "italic" }}>
                    No files received yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {applicant.received.map((doc) => (
                      <div
                        key={doc.document_id}
                        style={{
                          background: "#FFFFFF",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #DCE5E1",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ fontWeight: 650, color: "#063C3D", marginBottom: "2px" }}>{doc.title}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 650,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: doc.verification_status === "verified" ? "#EAF6F0" : "#F1F6F4",
                              color: doc.verification_status === "verified" ? "#176B50" : "#445451",
                            }}
                          >
                            {doc.verification_status === "verified" ? "✓ Verified" : "Processing"}
                          </span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => handleSimulatedDownload(doc.document_id, doc.title)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#0D6866",
                                fontSize: "11px",
                                fontWeight: 650,
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartPurge(doc.document_id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#C53030",
                                fontSize: "11px",
                                fontWeight: 650,
                                cursor: "pointer",
                              }}
                            >
                              Purge
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Column C: Correction Required / Anomalies */}
              <div style={{ background: "#FFF5F5", borderRadius: "8px", padding: "14px", border: "1px solid #FEB2B2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "12px", color: "#C53030", textTransform: "uppercase" }}>
                    ⚠️ Correction Required
                  </strong>
                  <span style={{ fontSize: "11px", color: "#C53030", fontWeight: 700 }}>
                    {applicant.correction_required.length}
                  </span>
                </div>
                {applicant.correction_required.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "#176B50", fontStyle: "italic" }}>
                    Zero compliance anomalies or corrections required ✓
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {applicant.correction_required.map((doc) => (
                      <div
                        key={doc.document_id}
                        style={{
                          background: "#FFFFFF",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #FEB2B2",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ fontWeight: 650, color: "#C53030", marginBottom: "2px" }}>{doc.title}</div>
                        <p style={{ margin: "4px 0 8px 0", fontSize: "11px", color: "#742A2A" }}>
                          {doc.has_unresolved_anomaly
                            ? "Compliance anomaly detected (lighting glare or blurred corners). Excluded from automatic cleanup."
                            : "Officer requested re-upload with crisper resolution."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApplicantId(applicant.applicant_id || "");
                            cameraInputRef.current?.click();
                          }}
                          style={{
                            background: "#C53030",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 650,
                            cursor: "pointer",
                          }}
                        >
                          📸 Retake Scan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------------------
          MODAL 1: CAMERA SCANNING GUIDANCE
          --------------------------------------------------------------------- */}
      {showGuidanceModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
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
              borderRadius: "14px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              padding: "24px 28px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>📱</span>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 750, color: "#063C3D" }}>
                  Mobile Camera Scanning Best Practices
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuidanceModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#6E7F7C",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6E7F7C", lineHeight: 1.5 }}>
              To pass legal verification without delays or USCIS rejections, ensure your mobile capture adheres to all 6 quality rules:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#F8F7F2", padding: "12px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <strong style={{ color: "#063C3D", fontSize: "13px", display: "block" }}>1. 🔍 Focus &amp; Sharpness</strong>
                <span style={{ fontSize: "12px", color: "#445451" }}>{guidance.focus_guidance}</span>
              </div>
              <div style={{ background: "#F8F7F2", padding: "12px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <strong style={{ color: "#063C3D", fontSize: "13px", display: "block" }}>2. 💡 Diffuse Lighting</strong>
                <span style={{ fontSize: "12px", color: "#445451" }}>{guidance.lighting_guidance}</span>
              </div>
              <div style={{ background: "#F8F7F2", padding: "12px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <strong style={{ color: "#063C3D", fontSize: "13px", display: "block" }}>3. ☀️ Eliminating Glare</strong>
                <span style={{ fontSize: "12px", color: "#445451" }}>{guidance.glare_guidance}</span>
              </div>
              <div style={{ background: "#F8F7F2", padding: "12px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <strong style={{ color: "#063C3D", fontSize: "13px", display: "block" }}>4. 📐 Upright Orientation</strong>
                <span style={{ fontSize: "12px", color: "#445451" }}>{guidance.orientation_guidance}</span>
              </div>
              <div style={{ background: "#F8F7F2", padding: "12px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <strong style={{ color: "#063C3D", fontSize: "13px", display: "block" }}>5. 🔲 All 4 Page Corners Visible</strong>
                <span style={{ fontSize: "12px", color: "#445451" }}>{guidance.corners_guidance}</span>
              </div>
              <div style={{ background: "#F8F7F2", padding: "12px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                <strong style={{ color: "#063C3D", fontSize: "13px", display: "block" }}>6. 👁️ 100% Zoom Legibility</strong>
                <span style={{ fontSize: "12px", color: "#445451" }}>{guidance.legibility_guidance}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowGuidanceModal(false);
                  cameraInputRef.current?.click();
                }}
                style={{
                  background: "#0D6866",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  cursor: "pointer",
                }}
              >
                Understood — Open Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 2: HONEST DOWNLOAD VERIFICATION LIMITS NOTICE
          --------------------------------------------------------------------- */}
      {verifiedDownloadNotice && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
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
              borderRadius: "12px",
              maxWidth: "520px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px" }}>📥</span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
                Download Receipt &amp; Verification Limits
              </h3>
            </div>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
              Your file transfer has been initiated in this browser session.
            </p>
            <div
              style={{
                background: "#F8F7F2",
                borderLeft: "3px solid #0D6866",
                padding: "10px 14px",
                fontSize: "12px",
                color: "#063C3D",
                marginBottom: "16px",
                lineHeight: 1.45,
              }}
            >
              <strong>Honest Verification Limits:</strong> {verifiedDownloadNotice.notice}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setVerifiedDownloadNotice(null)}
                style={{
                  background: "#0D6866",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: 650,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Acknowledge &amp; Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 3: TWO-STEP DELETION CONFIRMATION
          --------------------------------------------------------------------- */}
      {purgeStep && purgeStep.step1 && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
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
              borderRadius: "12px",
              maxWidth: "540px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "22px" }}>🗑️</span>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 750, color: "#C53030" }}>
                Two-Step Permanent Deletion Confirmation
              </h3>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
              {purgeStep.step1.impact_summary}
            </p>

            {/* Cryptographic challenge token */}
            <div
              style={{
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                padding: "8px 12px",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#6E7F7C",
                marginBottom: "14px",
                wordBreak: "break-all",
              }}
            >
              Challenge Token: <code>{purgeStep.step1.confirmation_token}</code>
            </div>

            {/* Local Copy Notice */}
            <div
              style={{
                background: "#FFF5F5",
                border: "1px solid #FEB2B2",
                padding: "12px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#9B2C2C",
                marginBottom: "16px",
                lineHeight: 1.45,
              }}
            >
              ⚠️ <strong>Local Copy Notice:</strong> {purgeStep.step1.local_copy_notice}
            </div>

            {/* Mandatory Checkbox Acknowledgment */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                fontSize: "12.5px",
                color: "#172322",
                fontWeight: 650,
                cursor: "pointer",
                marginBottom: "20px",
              }}
            >
              <input
                type="checkbox"
                checked={acknowledgedLocalCopy}
                onChange={(e) => setAcknowledgedLocalCopy(e.target.checked)}
                style={{ marginTop: "3px", accentColor: "#C53030", cursor: "pointer" }}
              />
              <span>{purgeStep.step1.required_acknowledgment}</span>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setPurgeStep(null)}
                style={{
                  background: "#F1F6F4",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!acknowledgedLocalCopy}
                onClick={handleConfirmPurge}
                style={{
                  background: acknowledgedLocalCopy ? "#C53030" : "#E2E8F0",
                  color: acknowledgedLocalCopy ? "#FFFFFF" : "#A0AEC0",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: acknowledgedLocalCopy ? "pointer" : "not-allowed",
                }}
              >
                Permanently Destroy File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success banner for purge */}
      {purgeSuccessNotice && (
        <div
          style={{
            padding: "12px 16px",
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            borderRadius: "8px",
            color: "#176B50",
            fontSize: "13px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {purgeSuccessNotice}</span>
          <button
            type="button"
            onClick={() => setPurgeSuccessNotice(null)}
            style={{ background: "transparent", border: "none", color: "#176B50", fontWeight: 700, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
