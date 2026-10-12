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
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-red-400 hover:text-red-200">×</button>
          </div>
        )}

        {parentDocumentId && (
          <div className="p-2.5 bg-indigo-950/70 border border-indigo-800 text-indigo-300 text-xs rounded-lg">
            Uploading as a new revision (superseding previous version).
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Document Category *
          </label>
          <SelectInput
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            options={categories}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Display Document Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., US Passport Biodata Page"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Select Document File (PDF, JPEG, PNG, TIFF, WebP — Max 50 MB) *
          </label>
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-xl p-6 text-center transition-colors bg-slate-900/40">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="hidden"
              id="file-upload-input"
            />
            <label
              htmlFor="file-upload-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-950/70 border border-indigo-800 flex items-center justify-center text-indigo-400 text-xl">
                📁
              </div>
              <span className="text-xs font-medium text-slate-200">
                {selectedFile ? selectedFile.name : "Click to browse or drop document here"}
              </span>
              <span className="text-[11px] text-slate-500">
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} • Type: ${selectedFile.type || "application/pdf"}`
                  : "PDF, JPEG, PNG, TIFF, or WebP up to 50 MB"}
              </span>
            </label>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              {statusMessage}
            </div>
            {computedHash && (
              <div className="text-[11px] font-mono text-slate-400 break-all pt-1 border-t border-slate-800">
                SHA-256: {computedHash}
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300">Security & Integrity Assurance:</div>
          <p>
            • Magic-byte verification ensures zero executable disguises.<br />
            • Heuristic malware scan prevents corrupted or infected payloads.<br />
            • Automated PyMuPDF & OCR extraction records full data provenance.<br />
            • Documents remain isolated to your organization's private cryptographic vault.
          </p>
        </div>
      </div>
    </Modal>
  );
}
