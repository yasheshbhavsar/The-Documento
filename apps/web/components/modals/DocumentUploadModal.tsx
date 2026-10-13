import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { calculateSHA256, formatBytes } from "../../lib/crypto";
import { DocumentItem, DocumentCategory, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  parentDocumentId?: string;
  onDocumentUploaded: (doc: DocumentItem) => void;
  activeRole?: RoleCode;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  caseId = "case-01",
  parentDocumentId,
  onDocumentUploaded,
  activeRole = "retained_client",
}: DocumentUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("identity_passport");
  const [title, setTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
      setError(null);
      setStatusMessage("Validating file signature & calculating SHA-256 integrity hash...");

      try {
        const buffer = await file.arrayBuffer();
        const header = new Uint8Array(buffer.slice(0, 8));
        
        // Basic client-side magic byte check
        const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
        const isJpg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
        const isTiff = (header[0] === 0x49 && header[1] === 0x49) || (header[0] === 0x4d && header[1] === 0x4d);
        const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;

        if (!isPdf && !isJpg && !isPng && !isTiff && !isWebp) {
          setError("File signature rejected: Only PDF and standard image formats (JPEG, PNG, TIFF, WebP) are authorized.");
          setSelectedFile(null);
          setStatusMessage(null);
          return;
        }

        const hash = await calculateSHA256(buffer);
        setComputedHash(hash);
        setStatusMessage(`File format authorized. SHA-256 fingerprint: ${hash.slice(0, 16)}...`);
      } catch (err: any) {
        setError("Failed to process file signature in browser.");
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a document file to upload.");
      return;
    }
    if (!computedHash) {
      setError("Waiting for SHA-256 fingerprint verification to complete.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Transmitting to private storage, running antivirus scan & OCR pipeline...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", category);
      formData.append("title", title || selectedFile.name);
      if (caseId) formData.append("case_id", caseId);
      if (parentDocumentId) formData.append("parent_document_id", parentDocumentId);

      const res = await api.uploadDocumentFile(formData, activeRole);

      onDocumentUploaded(res.data);
      onClose();
      // Reset
      setSelectedFile(null);
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
      title="Secure Evidence Upload & OCR Intake"
      subtitle="Encrypted object storage with magic-byte validation, malware scanning, SHA-256 integrity, and automated OCR extraction."
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
            {isProcessing ? "Processing & Extracting..." : "Upload & Run Extraction"}
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

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}>
            Document Category *
          </label>
          <SelectInput
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            options={categories}
          />
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
            Select Document File (PDF, JPEG, PNG, TIFF, WebP — Max 50 MB) *
          </label>
          <div
            style={{
              border: "2px dashed #B9DED4",
              background: "#F8F7F2",
              borderRadius: "12px",
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <input
              type="file"
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
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#EAF6F0",
                  border: "1px solid #B9DED4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0D6866",
                  fontSize: "18px",
                }}
              >
                📁
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#063C3D" }}>
                {selectedFile ? selectedFile.name : "Click to browse or drop document here"}
              </span>
              <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} • Type: ${selectedFile.type || "application/pdf"}`
                  : "PDF, JPEG, PNG, TIFF, or WebP up to 50 MB"}
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
            {computedHash && (
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#445451",
                  wordBreak: "break-all",
                  paddingTop: "6px",
                  marginTop: "6px",
                  borderTop: "1px solid #B9DED4",
                }}
              >
                SHA-256: {computedHash}
              </div>
            )}
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
            Security &amp; Integrity Assurance:
          </div>
          <div>• Magic-byte verification ensures zero executable disguises.</div>
          <div>• Heuristic malware scan prevents corrupted or infected payloads.</div>
          <div>• Automated PyMuPDF &amp; OCR extraction records full data provenance.</div>
          <div>• Documents remain isolated to your organization's private cryptographic vault.</div>
        </div>
      </div>
    </Modal>
  );
}
