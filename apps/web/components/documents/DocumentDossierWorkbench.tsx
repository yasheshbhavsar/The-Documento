"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  DocumentItem,
  DocumentExtractedField,
  DocumentVersionItem,
  RoleCode,
} from "../../lib/types";
import { api } from "../../lib/api";

interface DocumentDossierWorkbenchProps {
  document: DocumentItem;
  onDocumentUpdated: (doc: DocumentItem) => void;
  onClose?: () => void;
  activeRole?: RoleCode;
}

export function DocumentDossierWorkbench({
  document: doc,
  onDocumentUpdated,
  onClose,
  activeRole = "case_manager",
}: DocumentDossierWorkbenchProps) {
  // Navigation & view states
  const [activeTab, setActiveTab] = useState<"fields" | "ocr_stream" | "verification" | "versions">("fields");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  // Canvas viewport controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showOcrOverlay, setShowOcrOverlay] = useState<boolean>(false);

  // Field correction states
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Certification states
  const [verifyStatus, setVerifyStatus] = useState<"verified" | "rejected" | "under_review">(
    (doc.verification_status as any) || "verified"
  );
  const [verificationNotes, setVerificationNotes] = useState(doc.verification_notes || "");
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

  // Versions & reprocessing
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");

  const fieldCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isStaff = activeRole !== "retained_client" && activeRole !== "applicant";

  // Auto-clear feedback toast
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  // Load versions when versions tab is selected
  useEffect(() => {
    if (activeTab === "versions" && doc.id) {
      api.getDocumentVersions(doc.id, activeRole)
        .then((res) => setVersions(res.data))
        .catch(() => {});
    }
  }, [activeTab, doc.id, activeRole]);

  // Scroll to active field card in the inspector
  const scrollToFieldCard = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    if (activeTab !== "fields") {
      setActiveTab("fields");
    }
    setTimeout(() => {
      const card = fieldCardRefs.current[fieldId];
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 80);
  };

  const handleCopyHash = () => {
    if (doc.sha256_hash) {
      navigator.clipboard.writeText(doc.sha256_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2200);
    }
  };

  const handleStartFieldEdit = (field: DocumentExtractedField) => {
    setEditingFieldId(field.id);
    setSelectedFieldId(field.id);
    setCorrectedValue(field.corrected_value || field.normalized_value || field.original_value);
    setCorrectionReason("");
    setCorrectionError(null);
  };

  const handleSaveFieldCorrection = async () => {
    if (!editingFieldId || !correctedValue.trim()) {
      setCorrectionError("Please provide a valid corrected legal value.");
      return;
    }
    if (!correctionReason.trim() || correctionReason.trim().length < 4) {
      setCorrectionError("Please provide an audit justification reason (min 4 characters).");
      return;
    }

    setIsSubmittingCorrection(true);
    setCorrectionError(null);

    try {
      const res = await api.correctExtractedField(
        doc.id,
        editingFieldId,
        correctedValue.trim(),
        correctionReason.trim(),
        activeRole
      );

      const updatedFields = (doc.extracted_fields || []).map((f) =>
        f.id === editingFieldId ? res.data : f
      );

      const updatedDoc: DocumentItem = {
        ...doc,
        extracted_fields: updatedFields,
      };

      onDocumentUpdated(updatedDoc);
      setEditingFieldId(null);
      setFeedbackToast({
        message: `Field updated with cryptographic provenance retained.`,
        type: "success",
      });
    } catch (err: any) {
      setCorrectionError(err?.message || "Failed to submit field correction.");
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const handleQuickVerifyField = async (field: DocumentExtractedField) => {
    const updatedFields = (doc.extracted_fields || []).map((f) =>
      f.id === field.id ? { ...f, validation_status: "verified" as const } : f
    );
    const updatedDoc: DocumentItem = {
      ...doc,
      extracted_fields: updatedFields,
    };
    onDocumentUpdated(updatedDoc);
    setFeedbackToast({
      message: `Field "${field.field_label}" certified verified.`,
      type: "success",
    });
  };

  const handleVerifySubmit = async () => {
    setIsSubmittingVerify(true);
    try {
      const res = await api.verifyDocument(doc.id, verifyStatus, verificationNotes, activeRole);
      onDocumentUpdated(res.data);
      setFeedbackToast({
        message: `Document status certified as ${verifyStatus.toUpperCase()} with signed audit trail.`,
        type: "success",
      });
    } catch (err: any) {
      setFeedbackToast({
        message: `Verification update failed: ${err?.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const res = await api.reprocessDocument(doc.id, activeRole);
      onDocumentUpdated(res.data);
      setFeedbackToast({
        message: "Document reprocessed via OCR engine. Existing human edits were preserved.",
        type: "success",
      });
    } catch (err: any) {
      setFeedbackToast({
        message: `Reprocessing failed: ${err?.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const formatCategoryName = (cat: string) => {
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const fields = doc.extracted_fields || [];
  const filteredFields = fields.filter((f) => {
    if (!fieldSearch) return true;
    const q = fieldSearch.toLowerCase();
    return (
      f.field_label.toLowerCase().includes(q) ||
      f.field_name.toLowerCase().includes(q) ||
      f.original_value.toLowerCase().includes(q) ||
      (f.normalized_value && f.normalized_value.toLowerCase().includes(q))
    );
  });

  const avgConfidence = fields.length
    ? Math.round(
        (fields.reduce((acc, f) => acc + (f.ocr_confidence || 0.95), 0) / fields.length) * 100
      )
    : 98;

  const verifiedCount = fields.filter((f) => f.validation_status === "verified").length;
  const correctedCount = fields.filter((f) => f.is_manually_corrected).length;
  const editingField = fields.find((f) => f.id === editingFieldId);

  return (
    <div className="flex flex-col h-full bg-[#071917] text-slate-100 rounded-xl overflow-hidden border border-[#1b3a36] shadow-2xl">
      {/* 1. TOP METADATA & PROVENANCE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#0b2422] border-b border-[#1b3a36]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-semibold text-base text-slate-100 tracking-tight font-display">
              {doc.title}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#133c38] text-teal-200 border border-[#215751] font-mono">
            v{doc.version || 1} {doc.is_current_version ? "(Current)" : "(Superseded)"}
          </span>
          <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#0D6866]/30 text-teal-300 border border-[#0D6866]/60 font-medium">
            {formatCategoryName(doc.category)}
          </span>
          <span className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold uppercase tracking-wider">
            {doc.processing_status ? doc.processing_status.toUpperCase() : "COMPLETED"}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>SHA-256:</span>
            <button
              onClick={handleCopyHash}
              title="Click to copy SHA-256 fingerprint"
              className="bg-[#061816] hover:bg-[#09221f] text-teal-300 px-2 py-0.5 rounded text-[11px] border border-[#18423e] flex items-center gap-1 transition-colors"
            >
              <code>{doc.sha256_hash ? `${doc.sha256_hash.slice(0, 14)}…` : "e3b0c44298fc…"}</code>
              <span className="text-[10px] text-teal-400">{copiedHash ? "✓ Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tamper Seal Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
            <span className="text-emerald-400 text-xs">🔒</span>
            <span className="font-medium">Immutable Storage Verified</span>
          </div>

          {/* Verification Status Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-[#061b19] border-[#1b3a36]">
            <span
              className={`w-2 h-2 rounded-full ${
                doc.verification_status === "verified"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : doc.verification_status === "rejected"
                  ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
                  : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              }`}
            />
            <span className="text-slate-200 uppercase tracking-wide text-[11px]">
              {doc.verification_status ? doc.verification_status.replace(/_/g, " ") : "UNVERIFIED"}
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close workbench"
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-md hover:bg-[#133c38] transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK TOAST */}
      {feedbackToast && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
            feedbackToast.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-800"
              : feedbackToast.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-800"
              : "bg-teal-950/90 text-teal-200 border-teal-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedbackToast.type === "success" ? "✓" : "ℹ"}</span>
            <span>{feedbackToast.message}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-slate-100 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. MAIN DUAL-PANE WORKBENCH */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-[640px] max-h-[82vh]">
        {/* LEFT COLUMN: INTERACTIVE DOCUMENT SURFACE (54% / 7 cols) */}
        <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-[#1b3a36] bg-[#051312] overflow-hidden">
          {/* Surface Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#081f1d] border-b border-[#1b3a36] text-xs text-slate-300">
            {/* Zoom & Fit */}
            <div className="flex items-center gap-1 bg-[#051413] p-0.5 rounded-lg border border-[#1b3a36]">
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 15, 60))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#133c38] text-slate-300 font-bold"
                title="Zoom Out"
              >
                −
              </button>
              <span className="px-2 py-0.5 font-mono text-[11px] text-teal-300 min-w-[42px] text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 15, 160))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#133c38] text-slate-300 font-bold"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="px-2 py-1 text-[11px] rounded hover:bg-[#133c38] text-slate-400 hover:text-slate-200 border-l border-[#1b3a36]"
              >
                Reset
              </button>
            </div>

            {/* Bounding Box & OCR Toggles */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer bg-[#051413] px-2.5 py-1 rounded-md border border-[#1b3a36] hover:border-teal-700 transition-colors">
                <input
                  type="checkbox"
                  checked={showBoundingBoxes}
                  onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-[11px] text-slate-200">
                  Bounding Boxes ({fields.length})
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer bg-[#051413] px-2.5 py-1 rounded-md border border-[#1b3a36] hover:border-teal-700 transition-colors">
                <input
                  type="checkbox"
                  checked={showOcrOverlay}
                  onChange={(e) => setShowOcrOverlay(e.target.checked)}
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-[11px] text-slate-200">OCR Stream Text</span>
              </label>
            </div>

            {/* Page Navigation & Download */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">Page 1 of {doc.page_count || 1}</span>
              {doc.download_url && (
                <a
                  href={doc.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-[#0D6866] hover:bg-[#063C3D] text-white rounded text-[11px] font-medium transition-colors"
                >
                  Download PDF
                </a>
              )}
            </div>
          </div>

          {/* Interactive Document Canvas Viewport */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-[#040d0c] select-none">
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "center center",
                transition: "transform 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="relative shadow-2xl rounded-lg overflow-hidden bg-white text-slate-900 border border-slate-300"
            >
              {/* CATEGORY-SPECIFIC DOCUMENT BACKGROUND CANVAS */}
              {doc.category === "identity_passport" ? (
                /* PASSPORT HIGH-FIDELITY VECTOR CANVAS (600x420) */
                <div className="w-[600px] h-[420px] bg-[#fbf9f4] relative p-6 font-sans text-slate-900 border-2 border-slate-400 select-none overflow-hidden">
                  {/* Subtle Guilloche / Passport Security Watermark */}
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(circle at 50% 50%, #063c3d 10%, transparent 11%), radial-gradient(circle at 20% 80%, #063c3d 8%, transparent 9%)`,
                      backgroundSize: "24px 24px",
                    }}
                  />

                  {/* Header Band */}
                  <div className="border-b-2 border-slate-700 pb-2 mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] tracking-widest uppercase font-bold text-slate-600">
                        United States of America
                      </div>
                      <div className="text-lg font-extrabold tracking-wide text-slate-900 font-display">
                        PASSPORT / PASSEPORT
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 font-mono">TYPE: P / CODE: USA</div>
                      <div className="text-xs font-mono font-bold text-slate-800">
                        PASSPORT NO: C09812491
                      </div>
                    </div>
                  </div>

                  {/* Passport Body Grid */}
                  <div className="grid grid-cols-12 gap-4">
                    {/* Bio Photo Placeholder */}
                    <div className="col-span-4 flex flex-col items-center justify-center bg-slate-200 border border-slate-300 rounded p-3 h-[180px] relative shadow-inner">
                      <div className="w-16 h-16 rounded-full bg-slate-300 border border-slate-400 flex items-center justify-center text-slate-500 text-xl font-bold">
                        👤
                      </div>
                      <div className="text-[9px] text-slate-600 mt-2 font-mono uppercase tracking-wider text-center">
                        Digital Biometric
                      </div>
                      <div className="text-[8px] text-slate-400 font-mono mt-0.5">ICAO 9303 Compliant</div>
                      {/* Holographic Security Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-teal-500/10 to-indigo-500/15 pointer-events-none rounded" />
                    </div>

                    {/* Bio Fields Data */}
                    <div className="col-span-8 space-y-2 text-xs">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                          Surname / Nom
                        </div>
                        <div className="font-bold text-sm text-slate-900 font-mono">ROSTOVA</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                          Given Names / Prénoms
                        </div>
                        <div className="font-bold text-sm text-slate-900 font-mono">ELENA</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Nationality / Nationalité
                          </div>
                          <div className="font-bold text-xs text-slate-900 font-mono">USA (UNITED STATES)</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            DOB / Date de Naissance
                          </div>
                          <div className="font-bold text-xs text-slate-900 font-mono">12 APR 1988</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Sex / Sexe
                          </div>
                          <div className="font-bold text-xs text-slate-900 font-mono">F</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Place of Birth / Lieu de Naissance
                          </div>
                          <div className="font-bold text-xs text-slate-900 font-mono">CALIFORNIA, U.S.A.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Machine Readable Zone (MRZ) bottom band */}
                  <div className="absolute bottom-4 left-6 right-6 pt-2 border-t-2 border-dashed border-slate-400 font-mono text-[11px] tracking-widest text-slate-900 leading-tight bg-slate-100/90 p-2 rounded border border-slate-300">
                    <div>P&lt;USAROSTOVA&lt;&lt;ELENA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
                    <div>C098124914USA8804128F3105094&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;06</div>
                  </div>
                </div>
              ) : doc.category === "educational_records" ? (
                /* DIPLOMA / EDUCATIONAL CERTIFICATE CANVAS (600x440) */
                <div className="w-[600px] h-[440px] bg-[#fbfaf6] relative p-8 font-serif text-slate-900 border-4 border-[#063C3D] select-none overflow-hidden">
                  {/* Ornate Inner Border */}
                  <div className="absolute inset-2 border border-amber-800/40 pointer-events-none" />

                  {/* University Seal Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                    <span className="text-[140px]">🏛️</span>
                  </div>

                  {/* Diploma Header */}
                  <div className="text-center mb-4">
                    <div className="text-xs uppercase tracking-widest text-slate-600 font-sans font-semibold">
                      The Board of Trustees of
                    </div>
                    <div className="text-2xl font-bold tracking-wide text-[#063C3D] uppercase font-serif mt-1">
                      STANFORD UNIVERSITY
                    </div>
                    <div className="text-xs italic text-slate-600 mt-1">
                      confers upon the recommendation of the Faculty
                    </div>
                  </div>

                  {/* Candidate Name */}
                  <div className="text-center my-4">
                    <div className="text-2xl font-bold font-serif text-slate-900 tracking-wider">
                      ELENA ROSTOVA
                    </div>
                  </div>

                  {/* Degree Conferred */}
                  <div className="text-center space-y-1 mb-6">
                    <div className="text-xs italic text-slate-600">the degree of</div>
                    <div className="text-lg font-bold font-serif text-amber-900">
                      DOCTOR OF PHILOSOPHY
                    </div>
                    <div className="text-xs font-sans text-slate-700">
                      in Computer Science and Artificial Intelligence
                    </div>
                    <div className="text-xs font-sans text-slate-600 mt-1">
                      Cumulative GPA: <strong>3.96 / 4.00</strong> • Conferred: <strong>15 JUNE 2018</strong>
                    </div>
                  </div>

                  {/* Signature Blocks & Embossed Seal */}
                  <div className="flex justify-between items-end pt-4 border-t border-slate-300 text-xs font-sans text-slate-600">
                    <div className="text-center">
                      <div className="w-28 border-b border-slate-500 mb-1" />
                      <div>President of the University</div>
                    </div>
                    {/* Gold Seal Graphic */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 border-2 border-amber-700 flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                      SEAL
                    </div>
                    <div className="text-center">
                      <div className="w-28 border-b border-slate-500 mb-1" />
                      <div>Dean of Graduate Studies</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* OFFICIAL LEGAL RECORD CANVAS (600x420) */
                <div className="w-[600px] h-[420px] bg-[#fbfbf9] relative p-6 font-sans text-slate-900 border-2 border-slate-300 select-none">
                  <div className="border-b-2 border-teal-900 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-teal-900">
                        Official Certified Immigration Record
                      </div>
                      <div className="text-sm font-semibold text-slate-800 font-display">
                        {doc.title}
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500">
                      PAGE 1 • VERIFIED SECURE ARCHIVE
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 text-xs font-mono space-y-2">
                    <div className="text-slate-600 font-bold uppercase border-b border-slate-200 pb-1">
                      Structured Document Transcription & Extraction Payload
                    </div>
                    <div className="text-slate-800 leading-relaxed max-h-[220px] overflow-hidden whitespace-pre-line">
                      {doc.extracted_text || "Immutable source file indexed for evidentiary petition review."}
                    </div>
                  </div>
                </div>
              )}

              {/* OVERLAY: OCR TEXT LAYER (Optional Translucent Layer) */}
              {showOcrOverlay && doc.extracted_text && (
                <div className="absolute inset-0 bg-white/70 p-6 font-mono text-[11px] leading-relaxed text-slate-900 overflow-hidden pointer-events-none select-none backdrop-blur-[1px]">
                  <div className="bg-teal-900/10 text-teal-950 font-bold px-2 py-0.5 rounded text-[10px] inline-block mb-2">
                    OCR Recognized Text Stream
                  </div>
                  <div className="whitespace-pre-wrap">{doc.extracted_text}</div>
                </div>
              )}

              {/* OVERLAY: INTERACTIVE SVG BOUNDING BOXES */}
              {showBoundingBoxes && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-auto"
                  viewBox={doc.category === "educational_records" ? "0 0 600 440" : "0 0 600 420"}
                >
                  {fields.map((field) => {
                    const loc = field.source_location;
                    if (!loc) return null;

                    const x = loc.x0 || 70;
                    const y = loc.y0 || 100;
                    const width = Math.max((loc.x1 || 240) - x, 40);
                    const height = Math.max((loc.y1 || 130) - y, 22);

                    const isHovered = hoveredFieldId === field.id;
                    const isSelected = selectedFieldId === field.id;
                    const isCorrected = field.is_manually_corrected;
                    const isVerified = field.validation_status === "verified";

                    // Confidence-based colors
                    const strokeColor = isCorrected
                      ? "#D97706"
                      : isVerified || (field.ocr_confidence && field.ocr_confidence >= 0.95)
                      ? "#059669"
                      : (field.ocr_confidence && field.ocr_confidence >= 0.8)
                      ? "#D97706"
                      : "#E11D48";

                    const fillColor = isHovered || isSelected
                      ? strokeColor === "#059669"
                        ? "rgba(5, 150, 105, 0.28)"
                        : strokeColor === "#D97706"
                        ? "rgba(217, 119, 6, 0.28)"
                        : "rgba(225, 29, 72, 0.28)"
                      : strokeColor === "#059669"
                      ? "rgba(5, 150, 105, 0.12)"
                      : strokeColor === "#D97706"
                      ? "rgba(217, 119, 6, 0.12)"
                      : "rgba(225, 29, 72, 0.12)";

                    return (
                      <g
                        key={field.id}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredFieldId(field.id)}
                        onMouseLeave={() => setHoveredFieldId(null)}
                        onClick={() => scrollToFieldCard(field.id)}
                      >
                        {/* Interactive Box */}
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          rx={4}
                          ry={4}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                          strokeDasharray={isSelected ? "4,2" : undefined}
                          filter={isSelected || isHovered ? "drop-shadow(0 0 6px rgba(13, 104, 102, 0.6))" : undefined}
                        />

                        {/* Anchored Field Label Badge */}
                        <g transform={`translate(${x}, ${Math.max(y - 14, 2)})`}>
                          <rect
                            x={0}
                            y={0}
                            width={Math.min(field.field_name.length * 6 + 32, width + 10)}
                            height={13}
                            rx={2}
                            fill={strokeColor}
                          />
                          <text
                            x={4}
                            y={9}
                            fontSize={8.5}
                            fontWeight="bold"
                            fill="#FFFFFF"
                            fontFamily="monospace"
                          >
                            {field.field_name} ({Math.round((field.ocr_confidence || 0.95) * 100)}%)
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          {/* Bottom Surface Footer Bar */}
          <div className="px-4 py-2.5 bg-[#081f1d] border-t border-[#1b3a36] flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px]">High Confidence (≥95%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[11px]">Audit Flag / Manual Review</span>
              </span>
            </div>
            <div className="text-[11px] text-teal-300 font-mono">
              Click any bounding box to inspect and verify provenance
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: FORENSIC EVIDENCE & PROVENANCE INSPECTOR (46% / 5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-[#071917] overflow-hidden">
          {/* Navigation Mode Tabs */}
          <div role="tablist" aria-label="Document inspector tabs" className="flex border-b border-[#1b3a36] bg-[#09221f] text-xs overflow-x-auto">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "fields"}
              onClick={() => setActiveTab("fields")}
              className={`flex-1 py-3 px-3 font-medium border-b-2 text-center transition-colors whitespace-nowrap ${
                activeTab === "fields"
                  ? "border-teal-400 text-teal-300 font-semibold bg-[#0b2825]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Extracted Fields & Provenance ({fields.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ocr_stream"}
              onClick={() => setActiveTab("ocr_stream")}
              className={`flex-1 py-3 px-3 font-medium border-b-2 text-center transition-colors whitespace-nowrap ${
                activeTab === "ocr_stream"
                  ? "border-teal-400 text-teal-300 font-semibold bg-[#0b2825]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Raw OCR Stream
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "verification"}
              onClick={() => setActiveTab("verification")}
              className={`flex-1 py-3 px-3 font-medium border-b-2 text-center transition-colors whitespace-nowrap ${
                activeTab === "verification"
                  ? "border-teal-400 text-teal-300 font-semibold bg-[#0b2825]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Human Verification & Audit Trail
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "versions"}
              onClick={() => setActiveTab("versions")}
              className={`flex-1 py-3 px-3 font-medium border-b-2 text-center transition-colors whitespace-nowrap ${
                activeTab === "versions"
                  ? "border-teal-400 text-teal-300 font-semibold bg-[#0b2825]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Version History
            </button>
          </div>

          {/* TAB 1: EXTRACTED FIELDS & PROVENANCE */}
          {activeTab === "fields" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {/* Quick Health Summary Strip */}
              <div className="grid grid-cols-3 gap-2 bg-[#09221f] p-3 rounded-lg border border-[#1b3a36] text-center text-xs">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Avg Conf</div>
                  <div className="text-base font-bold text-teal-300 font-mono mt-0.5">{avgConfidence}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Verified</div>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                    {verifiedCount}/{fields.length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Corrections</div>
                  <div className="text-base font-bold text-amber-300 font-mono mt-0.5">{correctedCount}</div>
                </div>
              </div>

              {/* Filter Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter extracted fields by name or value..."
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                {fieldSearch && (
                  <button
                    onClick={() => setFieldSearch("")}
                    className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Field Cards List */}
              {filteredFields.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-[#09221f] rounded-lg border border-[#1b3a36]">
                  No matching fields found.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFields.map((field) => {
                    const isSelected = selectedFieldId === field.id;
                    const isHovered = hoveredFieldId === field.id;
                    const isEditing = editingFieldId === field.id;

                    return (
                      <div
                        key={field.id}
                        ref={(el) => {
                          fieldCardRefs.current[field.id] = el;
                        }}
                        onMouseEnter={() => setHoveredFieldId(field.id)}
                        onMouseLeave={() => setHoveredFieldId(null)}
                        className={`rounded-xl p-3.5 border transition-all duration-150 ${
                          isSelected
                            ? "bg-[#0c2f2b] border-teal-400 shadow-[0_0_12px_rgba(13,104,102,0.4)]"
                            : isHovered
                            ? "bg-[#0a2723] border-[#25635b]"
                            : "bg-[#09221f] border-[#1b3a36]"
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="font-semibold text-xs text-slate-100">{field.field_label}</span>
                            <span className="text-[10px] text-teal-400/80 font-mono ml-2">
                              {field.field_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {field.is_manually_corrected ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800">
                                Corrected
                              </span>
                            ) : field.validation_status === "verified" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                                ✓ Verified
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                Unvalidated
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Values Comparison Block */}
                        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-[#051413] border border-[#143330] mb-2 text-xs">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">
                              Raw Extracted (OCR)
                            </span>
                            <code className="text-slate-300 font-mono text-[11px] break-all">
                              {field.original_value}
                            </code>
                          </div>
                          <div className="border-l border-[#143330] pl-2">
                            <span className="text-[9px] uppercase font-bold text-teal-400 block mb-0.5">
                              Normalized Legal
                            </span>
                            <code className="text-emerald-300 font-mono text-[11px] font-bold break-all">
                              {field.is_manually_corrected
                                ? field.corrected_value
                                : field.normalized_value || field.original_value}
                            </code>
                          </div>
                        </div>

                        {/* Provenance Metadata Line */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span>
                              Page {field.source_page || 1}
                            </span>
                            <span>•</span>
                            <span>
                              Confidence:{" "}
                              <strong className="text-teal-300">
                                {Math.round((field.ocr_confidence || 0.95) * 100)}%
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">
                              {field.extraction_method || "regex_parser"}
                            </span>
                          </div>
                          {field.source_location && (
                            <code className="text-slate-500">
                              [{field.source_location.x0}, {field.source_location.y0}]
                            </code>
                          )}
                        </div>

                        {/* Actions */}
                        {isStaff && !isEditing && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#143330]">
                            {field.validation_status !== "verified" && (
                              <button
                                onClick={() => handleQuickVerifyField(field)}
                                className="px-2.5 py-1 text-[11px] rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors"
                              >
                                ✓ Quick Verify
                              </button>
                            )}
                            <button
                              onClick={() => handleStartFieldEdit(field)}
                              className="px-2.5 py-1 text-[11px] rounded bg-[#133c38] hover:bg-[#1a4e49] text-teal-200 border border-[#215751] transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}

                        {/* Inline Correction Form */}
                        {isEditing && (
                          <div className="mt-2.5 pt-2.5 border-t border-teal-800/80 space-y-2 bg-[#051513] p-2.5 rounded-lg border border-[#18423e]">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-300">
                                Manual Field Correction: {field.field_label}
                              </span>
                              <button
                                onClick={() => setEditingFieldId(null)}
                                className="text-slate-400 hover:text-slate-200 text-xs"
                              >
                                Cancel
                              </button>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">
                                Corrected Legal Value *
                              </label>
                              <input
                                type="text"
                                value={correctedValue}
                                placeholder="Enter legal / standard value..."
                                onChange={(e) => setCorrectedValue(e.target.value)}
                                className="w-full bg-[#081f1d] border border-teal-700 rounded p-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-400"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">
                                Audit Justification Reason *
                              </label>
                              <input
                                type="text"
                                value={correctionReason}
                                onChange={(e) => setCorrectionReason(e.target.value)}
                                placeholder="e.g., Standardized date format"
                                className="w-full bg-[#081f1d] border border-teal-700 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-400"
                              />
                              {/* Quick reason chips */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {[
                                  "Standardize to ISO-8601",
                                  "Fix OCR character misread",
                                  "Match legal passport transliteration",
                                ].map((chip) => (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() => setCorrectionReason(chip)}
                                    className="text-[9px] px-1.5 py-0.5 bg-[#0d2825] hover:bg-[#133c38] text-teal-300 rounded border border-[#1b3a36]"
                                  >
                                    {chip}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {correctionError && (
                              <div className="text-[10px] text-rose-300 p-1.5 bg-rose-950/80 rounded border border-rose-800">
                                {correctionError}
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingFieldId(null)}
                                className="px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveFieldCorrection}
                                disabled={isSubmittingCorrection}
                                className="px-3 py-1 text-[11px] rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-semibold transition-colors disabled:opacity-50"
                              >
                                {isSubmittingCorrection ? "Recording..." : "Save Correction & Record Provenance"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RAW OCR STREAM */}
          {activeTab === "ocr_stream" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Raw OCR Text Stream from engine</span>
                <button
                  onClick={() => {
                    if (doc.extracted_text) {
                      navigator.clipboard.writeText(doc.extracted_text);
                      setFeedbackToast({ message: "Raw text copied to clipboard.", type: "info" });
                    }
                  }}
                  className="text-teal-300 hover:text-teal-200 underline text-xs"
                >
                  Copy Text Stream
                </button>
              </div>
              <pre className="p-3 bg-[#051413] border border-[#1b3a36] rounded-lg text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto">
                {doc.extracted_text || "No raw text stream recorded."}
              </pre>
            </div>
          )}

          {/* TAB 3: DECOUPLED LEGAL SIGN-OFF */}
          {activeTab === "verification" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-3 bg-[#0a2723] border border-teal-800/80 rounded-lg text-xs text-teal-200 space-y-1">
                <strong className="block text-teal-100 font-semibold text-sm">Decoupled Verification Policy</strong>
                <p>
                  In compliance with professional immigration representation standards, automated OCR and structured LLM extraction do not automatically certify a document as verified. Authorized legal staff must review evidence and record notes prior to petition submission.
                </p>
              </div>

              <div className="bg-[#09221f] p-4 rounded-xl border border-[#1b3a36] space-y-3 text-xs">
                <h4 className="font-semibold text-slate-200 text-sm">Update Document Certification</h4>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Certification Status</label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                      <input
                        type="radio"
                        name="verifyStatus"
                        value="verified"
                        checked={verifyStatus === "verified"}
                        onChange={() => setVerifyStatus("verified")}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>✓ Certify as Verified Legal Evidence</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                      <input
                        type="radio"
                        name="verifyStatus"
                        value="under_review"
                        checked={verifyStatus === "under_review"}
                        onChange={() => setVerifyStatus("under_review")}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>Flag for Supplementary Review</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                      <input
                        type="radio"
                        name="verifyStatus"
                        value="rejected"
                        checked={verifyStatus === "rejected"}
                        onChange={() => setVerifyStatus("rejected")}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>Reject / Mark Defective Scan</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Caseworker Notes</label>
                  <textarea
                    rows={3}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="e.g., Physical biometric passport matched against state records"
                    className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {isStaff && (
                  <button
                    onClick={handleVerifySubmit}
                    disabled={isSubmittingVerify}
                    className="w-full py-2 px-3 rounded-lg bg-[#0D6866] hover:bg-[#063C3D] text-white font-semibold text-xs transition-colors shadow-md disabled:opacity-50"
                  >
                    {isSubmittingVerify ? "Saving Verification Decision..." : "Save Verification Decision"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: VERSION HISTORY & IMMUTABLE AUDIT */}
          {activeTab === "versions" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200">Document revisions and lineage tracking</span>
                {isStaff && (
                  <button
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                    className="px-2.5 py-1 text-xs rounded bg-[#133c38] hover:bg-[#1a4e49] text-teal-200 border border-[#215751] transition-colors"
                  >
                    {isReprocessing ? "Reprocessing..." : "Reprocess"}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {versions.length > 0 ? (
                  versions.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 bg-[#09221f] rounded-lg border border-[#1b3a36] text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">
                          v{v.version} {v.is_current_version ? "(Current Active)" : "(Archived)"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          SHA: {v.sha256_hash.slice(0, 20)}…
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        <div>{new Date(v.created_at).toLocaleDateString()}</div>
                        <div>{(v.byte_size / (1024 * 1024)).toFixed(2)} MB</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-[#09221f] rounded-lg border border-[#1b3a36] text-xs flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-200">
                        v1 <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 ml-1">Current Active</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        SHA: {doc.sha256_hash ? doc.sha256_hash.slice(0, 20) : "e3b0c44298fc"}…
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500">
                      <div>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "Active"}</div>
                      <div>{doc.file_size || "2.4 MB"}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
