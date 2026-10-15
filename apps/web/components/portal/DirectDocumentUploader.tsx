import React, { useState, useRef } from "react";
import { calculateSHA256, formatBytes } from "../../lib/crypto";
import { DocumentItem, DocumentCategory } from "../../lib/types";
import { ClientLanguage, CLIENT_TRANSLATIONS } from "../../lib/clientLocalization";

interface DirectDocumentUploaderProps {
  caseId?: string;
  onDocumentUploaded: (doc: DocumentItem) => void;
  onRequestSelectedCategory?: DocumentCategory;
  language?: ClientLanguage;
}

export function DirectDocumentUploader({
  caseId = "case-01",
  onDocumentUploaded,
  onRequestSelectedCategory,
  language = "en",
}: DirectDocumentUploaderProps) {
  const t = CLIENT_TRANSLATIONS[language];
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>(
    onRequestSelectedCategory || "educational_records"
  );
  const [title, setTitle] = useState("");
  const [officerNote, setOfficerNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHashing, setIsHashing] = useState(false);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [fileSizeStr, setFileSizeStr] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categories: { label: string; value: DocumentCategory; desc: string }[] = [
    { label: "Educational Records (Degrees, Transcripts)", value: "educational_records", desc: "Form I-140 / 8 CFR § 204.5(k)(3)" },
    { label: "Scholarly Publications & Citations", value: "scholarly_publications" as any, desc: "Peer-reviewed articles, patents, citations" },
    { label: "Peer Review & Judging Evidence", value: "judging_peer_review" as any, desc: "Journal review verifications, editorial boards" },
    { label: "Major Recognized Awards & Honors", value: "awards_honors" as any, desc: "National/international prizes of excellence" },
    { label: "Independent Expert Testimonial Letters", value: "expert_testimonials" as any, desc: "Letters from recognized domain authorities" },
    { label: "Passports & Travel Identity Documents", value: "identity_passport", desc: "Unexpired passport, Form I-94 travel history" },
    { label: "Civil-Status & Family Records", value: "civil_status", desc: "Marriage certificate, birth certificates" },
    { label: "Existing Visas & Approval Notices", value: "visas_residence_permits", desc: "Prior I-797 notices, F-1/H-1B/O-1 visa stamps" },
    { label: "Employment & Remuneration Records", value: "employment_records", desc: "Experience letters, W-2s, high salary proof" },
    { label: "Form I-693 Sealed Medical Examination", value: "police_medical", desc: "Designated civil surgeon medical report" },
    { label: "Certified English Translations & Affidavits", value: "translations_certifications", desc: "ATA certified translator credentials" },
    { label: "Other Supporting Evidence", value: "supporting_evidence", desc: "Exhibits, news media coverage, conference papers" },
  ];

  const handleProcessFile = async (file: File) => {
    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    setFileSizeStr(formatBytes(file.size));
    setError(null);
    setSuccessBanner(null);
    setIsHashing(true);

    try {
      const buffer = await file.arrayBuffer();
      const header = new Uint8Array(buffer.slice(0, 8));

      // Client-side magic bytes validation
      const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
      const isJpg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
      const isTiff = (header[0] === 0x49 && header[1] === 0x49) || (header[0] === 0x4d && header[1] === 0x4d);
      const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;

      if (!isPdf && !isJpg && !isPng && !isTiff && !isWebp) {
        setError("File signature rejected: Only PDF and standard image formats (JPEG, PNG, TIFF, WebP) are accepted for USCIS filings.");
        setSelectedFile(null);
        setComputedHash(null);
        setIsHashing(false);
        return;
      }

      const hash = await calculateSHA256(buffer);
      setComputedHash(hash);
    } catch (err) {
      setError("Failed to compute cryptographic hash for the selected file.");
      setComputedHash(null);
    } finally {
      setIsHashing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !computedHash) {
      setError("Please select a valid document file before submitting.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Simulate rapid server transmission and immediate local reactivity
      await new Promise((res) => setTimeout(res, 600));

      const newDoc: DocumentItem = {
        id: `doc-client-${Date.now()}`,
        case_id: caseId,
        title: title || selectedFile.name,
        category,
        file_size: fileSizeStr || "2.1 MB",
        sha256_hash: computedHash,
        version: 1,
        is_current_version: true,
        processing_status: "completed",
        verification_status: "unverified",
        status: "verified",
        created_at: new Date().toISOString(),
        extracted_fields: [
          { field_name: "Document Title", field_value: title || selectedFile.name, confidence: 0.99 },
          { field_name: "Evidentiary Category", field_value: category, confidence: 0.98 },
          { field_name: "Applicant Note", field_value: officerNote || "Uploaded via Client Portal", confidence: 1.0 },
        ],
      };

      onDocumentUploaded(newDoc);
      setSuccessBanner(
        `✅ Document "${newDoc.title}" submitted successfully! Assigned to Officer Sarah Jenkins, Esq. for statutory review.`
      );

      // Reset form
      setSelectedFile(null);
      setComputedHash(null);
      setTitle("");
      setOfficerNote("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError(err?.message || "Failed to submit document.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1.5px solid #B9DED4",
        borderRadius: "14px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📤</span>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
              {t.uploadHeaderTitle}
            </h2>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6E7F7C", lineHeight: 1.4 }}>
            {t.uploadHeaderSubtitle}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              background: "#EAF6F0",
              color: "#0D6866",
              border: "1px solid #B9DED4",
              fontSize: "11px",
              fontWeight: 650,
              padding: "3px 8px",
              borderRadius: "6px",
            }}
          >
            🔒 SHA-256 Tamper-Proof
          </span>
          <span
            style={{
              background: "#F8F7F2",
              color: "#445451",
              border: "1px solid #DCE5E1",
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "6px",
            }}
          >
            PDF / JPG / PNG / TIFF (Max 50MB)
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          role="status"
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            borderRadius: "8px",
            color: "#176B50",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: "transparent", border: "none", color: "#176B50", cursor: "pointer", fontSize: "14px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#FDF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "8px",
            color: "#991B1B",
            fontSize: "13px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Interactive Drag & Drop Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "#0D6866" : selectedFile ? "#176B50" : "#B9DED4"}`,
            background: isDragging ? "#EAF6F0" : selectedFile ? "#F1F8F6" : "#FAFAF7",
            borderRadius: "12px",
            padding: "28px 20px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
            position: "relative",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.webp"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {selectedFile ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "32px" }}>📄</span>
              <strong style={{ fontSize: "14px", color: "#063C3D" }}>{selectedFile.name}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#445451" }}>
                <span>{fileSizeStr}</span>
                <span>•</span>
                {isHashing ? (
                  <span style={{ color: "#D97706", fontWeight: 600 }}>Calculating SHA-256 fingerprint...</span>
                ) : computedHash ? (
                  <span
                    style={{
                      fontFamily: "monospace",
                      background: "#EAF6F0",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      color: "#0D6866",
                      fontSize: "11px",
                      border: "1px solid #B9DED4",
                    }}
                  >
                    SHA-256: {computedHash.slice(0, 16)}...
                  </span>
                ) : null}
              </div>
              <span style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
                Click or drop a different file to replace
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "36px", opacity: 0.85 }}>☁️</span>
              <strong style={{ fontSize: "14px", color: "#063C3D" }}>
                Drag &amp; drop document here, or <span style={{ color: "#0D6866", textDecoration: "underline" }}>browse files</span>
              </strong>
              <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                Supports official court records, diplomas, PDF briefs, high-resolution scans &amp; notarized translations
              </span>
            </div>
          )}
        </div>

        {/* Document Metadata Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px" }}>
          {/* Document Title */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>
              Document Title / Exhibit Description *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master's Degree Diploma & Transcripts"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FAFAF7",
                fontSize: "13px",
                color: "#172322",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Evidentiary Category */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>
              Evidentiary Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FAFAF7",
                fontSize: "13px",
                color: "#172322",
                boxSizing: "border-box",
                outline: "none",
              }}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Note for Case Processing Officer */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>
            {t.confidentialNoteLabel}
          </label>
          <textarea
            rows={2}
            value={officerNote}
            onChange={(e) => setOfficerNote(e.target.value)}
            placeholder={t.confidentialNotePlaceholder}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #DCE5E1",
              background: "#FAFAF7",
              fontSize: "13px",
              color: "#172322",
              boxSizing: "border-box",
              outline: "none",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        {/* Submission Action Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" }}>
          {selectedFile && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setComputedHash(null);
                setTitle("");
                setOfficerNote("");
              }}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#6E7F7C",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={!selectedFile || isProcessing || isHashing}
            style={{
              padding: "10px 20px",
              background: !selectedFile || isProcessing || isHashing ? "#BDCDC7" : "#0D6866",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 650,
              cursor: !selectedFile || isProcessing || isHashing ? "not-allowed" : "pointer",
              boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background 0.15s ease",
            }}
          >
            <span>
              {isProcessing
                ? t.uploadingButtonText
                : language === "en"
                ? "Upload & Submit to Officer →"
                : `${t.uploadButtonText} (Upload Document) →`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
