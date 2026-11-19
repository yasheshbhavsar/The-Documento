import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { calculateSHA256, formatBytes } from "../../lib/crypto";
import { DocumentItem, DocumentCategory, ImmigrationCase, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";
import {
  detectCategoryAndRoleFromFilename,
  generateClientFallbackAnalysis,
} from "../../lib/api/extractor";
import {
  mapAnalysisToInitialInfoSheet,
  persistAndBroadcastAutoFill,
  queuePendingAutoFill,
} from "../../lib/documentAutoFillEngine";
import { enqueueRawClientPacket, extractSafeRawTextPreview } from "../../lib/rawClientPacketStore";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  cases?: ImmigrationCase[];
  parentDocumentId?: string;
  onDocumentUploaded: (doc: DocumentItem) => void;
  activeRole?: RoleCode;
  rawOnly?: boolean;
  raw_only?: boolean;
}

function normalizeDetectedCategory(raw: string): DocumentCategory {
  if (raw === "civil_status_family") return "civil_status";
  return (raw as DocumentCategory) || "supporting_evidence";
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  caseId,
  cases = [],
  parentDocumentId,
  onDocumentUploaded,
  activeRole,
  rawOnly = false,
  raw_only = false,
}: DocumentUploadModalProps) {
  const isRawClientUpload = Boolean(
    rawOnly || raw_only || activeRole === "retained_client" || activeRole === "applicant"
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || cases[0]?.id || "");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<DocumentCategory>("identity_passport");
  const [manualCategoryOverride, setManualCategoryOverride] = useState(false);
  const [detectedSummary, setDetectedSummary] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFile = selectedFiles[0] || null;

  React.useEffect(() => {
    if (isOpen) {
      if (caseId) {
        setSelectedCaseId(caseId);
      } else if (cases.length > 0 && !cases.some((c) => c.id === selectedCaseId)) {
        setSelectedCaseId(cases[0].id);
      }
    }
  }, [isOpen, caseId, cases, selectedCaseId]);

  const categories = [
    { label: "Passports and Identity Documents", value: "identity_passport" },
    { label: "Civil-Status and Family Documents", value: "civil_status" },
    { label: "Existing Visas and Residence Permits", value: "visas_residence_permits" },
    { label: "Educational Records (Degrees, Transcripts)", value: "educational_records" },
    { label: "Employment Records (Letters, Paystubs)", value: "employment_records" },
    { label: "Financial Evidence (Bank Statements)", value: "financial_evidence" },
    { label: "Travel Records (Entry Stamps, Itineraries)", value: "travel_records" },
    { label: "Insurance and Accommodation Evidence", value: "insurance_accommodation" },
    { label: "Police and Medical Documents", value: "police_medical" },
    { label: "Government Forms and Correspondence (I-797, Receipts)", value: "government_correspondence" },
    { label: "Translations and Certifications", value: "translations_certifications" },
    { label: "Other Supporting Evidence", value: "supporting_evidence" },
  ];

  const validateAndLoadFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setError(null);
    setStatusMessage("Checking file format and preparing upload...");

    try {
      for (const file of incoming) {
        const buffer = await file.arrayBuffer();
        const header = new Uint8Array(buffer.slice(0, 8));

        const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
        const isJpg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
        const isTiff = (header[0] === 0x49 && header[1] === 0x49) || (header[0] === 0x4d && header[1] === 0x4d);
        const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;

        if (!isPdf && !isJpg && !isPng && !isTiff && !isWebp) {
          setError("Unsupported file format: Only PDF and standard image formats (JPEG, PNG, TIFF, WebP) are accepted.");
          setSelectedFiles([]);
          setComputedHash(null);
          setStatusMessage(null);
          return;
        }
      }

      const primary = incoming[0];
      const primaryBuf = await primary.arrayBuffer();
      const hash = await calculateSHA256(primaryBuf);

      let snippet = "";
      try {
        snippet = (await primary.text()).slice(0, 1200);
      } catch {
        snippet = "";
      }
      const autoDetected = detectCategoryAndRoleFromFilename(primary.name, snippet);
      if (!manualCategoryOverride) {
        setCategory(normalizeDetectedCategory(autoDetected.category));
      }
      const roleLabel =
        autoDetected.personRole === "overseas_sponsor_host"
          ? `Overseas Sponsor${autoDetected.sponsorJurisdiction ? ` (${autoDetected.sponsorJurisdiction})` : ""}`
          : autoDetected.personRole === "canadian_crs_sibling"
            ? "+15 CRS Canadian Sibling"
            : autoDetected.personRole === "spouse_partner"
              ? "Spouse / Partner"
              : "Principal Applicant";
      setDetectedSummary(
        incoming.length === 1
          ? `Auto-Detected: ${autoDetected.subtypeLabel} • ${roleLabel}`
          : `Auto-Detected ${incoming.length} files (Primary: ${autoDetected.subtypeLabel} • ${roleLabel})`
      );

      setSelectedFiles(incoming);
      setTitle(
        incoming.length === 1
          ? primary.name.replace(/\.[^/.]+$/, "")
          : `${incoming.length} Documents (${primary.name.replace(/\.[^/.]+$/, "")} + ${incoming.length - 1} more)`
      );
      setComputedHash(hash);
      setStatusMessage(
        incoming.length === 1
          ? "File format verified and ready for upload."
          : `${incoming.length} files verified and ready for upload.`
      );
    } catch {
      setError("Failed to read file in browser.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await validateAndLoadFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select a document file to upload.");
      return;
    }
    if (!computedHash) {
      setError("Waiting for file verification to complete.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage(
      isRawClientUpload
        ? "Uploading your document(s) to your legal team for review..."
        : "Uploading to case file and running document text extraction..."
    );

    try {
      const targetCaseId = selectedCaseId || caseId || cases[0]?.id || "";
      let combinedFormData: Record<string, any> = {};
      let combinedProvenance: Record<string, any> = {};

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileSnippet = await extractSafeRawTextPreview(file);
        const detectedForFile = detectCategoryAndRoleFromFilename(file.name, fileSnippet.slice(0, 1200));
        const effectiveCategory =
          manualCategoryOverride || selectedFiles.length === 1
            ? category
            : normalizeDetectedCategory(detectedForFile.category);
        const effectiveTitle =
          selectedFiles.length === 1 && title.trim()
            ? title.trim()
            : file.name.replace(/\.[^/.]+$/, "");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", effectiveCategory);
        formData.append("title", effectiveTitle);
        if (targetCaseId) formData.append("case_id", targetCaseId);
        if (parentDocumentId && i === 0) formData.append("parent_document_id", parentDocumentId);
        if (isRawClientUpload) formData.append("raw_only", "true");

        // Single network upload — never send the same file over HTTP twice!
        const res = await api.uploadDocumentFile(formData, activeRole);

        if (isRawClientUpload) {
          const fileBuf = await file.arrayBuffer();
          const fileSha = await calculateSHA256(fileBuf);
          const vaultId =
            res.data?.id || `raw-modal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const rawPkt = enqueueRawClientPacket({
            file,
            vaultDocId: vaultId,
            caseId: targetCaseId || "default_client",
            title: effectiveTitle,
            sha256: fileSha,
            uploaderRole: "applicant",
            declaredCategory: effectiveCategory,
            rawTextPreview: fileSnippet,
          });
          onDocumentUploaded({
            ...(res.data || ({} as DocumentItem)),
            id: vaultId,
            case_id: targetCaseId || res.data?.case_id,
            title: effectiveTitle,
            filename: file.name,
            category: effectiveCategory,
            sha256_hash: fileSha,
            status: "under_review",
            processing_status: "pending",
            verification_status: "unverified",
            ocr_applied: false,
            extracted_fields: [],
            is_raw_packet: true,
            raw_packet_id: rawPkt.id,
            ai_lab_status: "pending",
            uploader_role: "applicant",
          });
        } else {
          try {
            if (res.data?.extracted_fields && res.data.extracted_fields.length > 0) {
              const sheetRes = mapAnalysisToInitialInfoSheet(res.data, combinedFormData);
              combinedFormData = sheetRes.updatedData;
              combinedProvenance = { ...combinedProvenance, ...sheetRes.provenance };
            } else {
              // Zero-network local extraction fallback for firm staff
              const localAnalysis = await generateClientFallbackAnalysis({
                file,
                rawText: fileSnippet.slice(0, 1200) || undefined,
                filename: file.name,
                declaredCategory: effectiveCategory,
              });
              const sheetRes = mapAnalysisToInitialInfoSheet(localAnalysis, combinedFormData);
              combinedFormData = sheetRes.updatedData;
              combinedProvenance = { ...combinedProvenance, ...sheetRes.provenance };
            }
          } catch {
            // Graceful non-blocking auto-fill mapping
          }

          onDocumentUploaded(res.data);
        }
      }

      if (!isRawClientUpload && Object.keys(combinedFormData).length > 0) {
        queuePendingAutoFill(targetCaseId || "default_client", {
          formData: combinedFormData,
          provenance: combinedProvenance,
          sourceFilename: selectedFiles[0].name,
        });
        persistAndBroadcastAutoFill(targetCaseId || "default_client", {
          formData: combinedFormData,
          provenance: combinedProvenance,
          sourceFilename: selectedFiles[0].name,
        });
      }

      onClose();
      setSelectedFiles([]);
      setManualCategoryOverride(false);
      setDetectedSummary(null);
      setComputedHash(null);
      setStatusMessage(null);
      setTitle("");
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRawClientUpload ? "Upload Document(s)" : "Secure Evidence Upload & OCR Intake"}
      subtitle="Upload clear, readable PDFs or photos (JPEG, PNG, TIFF, WebP). Multi-page files are supported automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={!selectedFile || !computedHash || isProcessing}
          >
            {isProcessing
              ? isRawClientUpload
                ? "Uploading..."
                : "Processing & Extracting..."
              : isRawClientUpload
                ? "Upload Document(s)"
                : "Upload & Run Extraction"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "#FDF2F2",
              border: "1px solid #FCA5A5",
              color: "#A62D35",
              fontSize: "12px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{
                background: "transparent",
                border: "none",
                fontWeight: 700,
                color: "#A62D35",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {parentDocumentId && (
          <div
            style={{
              padding: "10px 14px",
              background: "#EDF5FB",
              border: "1px solid #BAE6FD",
              color: "#0369A1",
              fontSize: "12px",
              borderRadius: "8px",
            }}
          >
            Uploading as a new revision (superseding previous version).
          </div>
        )}

        {cases.length > 0 && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}>
              Target Case / Petition *
            </label>
            <SelectInput
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              options={cases.map((c) => ({
                label: `${c.case_number} — ${c.title} (${c.client_name || "Applicant"})`,
                value: c.id,
              }))}
            />
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}>
            Document Category (Auto-Detected • Optional Override)
          </label>
          <SelectInput
            value={category}
            onChange={(e) => {
              setManualCategoryOverride(true);
              setCategory(e.target.value as DocumentCategory);
            }}
            options={categories}
          />
          {detectedSummary && (
            <div
              data-testid="upload-autodetected-summary"
              style={{
                marginTop: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 9px",
                borderRadius: "999px",
                background: "#EAF6F0",
                border: "1px solid #C6E7D8",
                color: "#176B50",
                fontSize: "11.5px",
                fontWeight: 600,
              }}
            >
              ✓ {detectedSummary}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}>
            Display Document Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., US Passport Biodata Page"
            style={{
              width: "100%",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "13px",
              color: "#172322",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}>
            Select Document File(s) (PDF, JPEG, PNG, TIFF, WebP — Single or Multi-File) *
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer?.files?.length) {
                void validateAndLoadFiles(Array.from(e.dataTransfer.files));
              }
            }}
            style={{
              border: "1.5px dashed #B9DED4",
              background: "#F8F7F2",
              borderRadius: "10px",
              padding: "22px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
              onChange={handleFileChange}
              disabled={isProcessing}
              style={{ display: "none" }}
              id="file-upload-input"
            />
            <label
              htmlFor="file-upload-input"
              style={{
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "#EAF6F0",
                  border: "1px solid #B9DED4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0D6866",
                  fontSize: "17px",
                }}
              >
                📁
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#063C3D" }}>
                {selectedFiles.length > 1
                  ? `${selectedFiles.length} files selected (${selectedFiles.map((f) => f.name).join(", ")})`
                  : selectedFile
                    ? selectedFile.name
                    : "Click to browse or drop document(s) here"}
              </span>
              <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                {selectedFile
                  ? `${formatBytes(selectedFiles.reduce((s, f) => s + f.size, 0))} • Single-pass upload & category detection`
                  : "PDF, JPEG, PNG, TIFF, or WebP up to 50 MB (supports multi-file selection)"}
              </span>
            </label>
          </div>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: "12px 14px",
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#176B50", fontWeight: 600 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#176B50" }} />
              {statusMessage}
            </div>
          </div>
        )}

        <div
          style={{
            padding: "12px 14px",
            background: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "8px",
            fontSize: "11px",
            color: "#445451",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
            Upload Standards &amp; Privacy:
          </div>
          <div>• Upload clear, readable PDFs or photos; multi-page files are supported automatically.</div>
          <div>• Automatic format verification ensures only valid PDF and image documents are accepted.</div>
          <div>• Uploaded documents are securely stored in your private case file for review by your legal team.</div>
        </div>
      </div>
    </Modal>
  );
}
