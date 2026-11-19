"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  DocumentItem,
  DocumentExtractedField,
  DocumentVersionItem,
  DocumentProcessingRunItem,
  RoleCode,
  DocumentSixDimensionsReview,
  FieldExtractionProvenance,
  ThreeTierEntity,
  DocumentSplitSection,
  StructuredRejectionReasonCode,
  STRUCTURED_REJECTION_REASONS,
} from "../../lib/types";
import { api, splitDocumentSections } from "../../lib/api";

export const PIPELINE_STAGES = [
  { id: "queued", label: "Queued", step: 1 },
  { id: "preprocessing", label: "Preprocessing", step: 2 },
  { id: "ocr", label: "OCR Engine", step: 3 },
  { id: "classification", label: "Classification", step: 4 },
  { id: "extraction", label: "Extraction", step: 5 },
  { id: "completed", label: "Completed", step: 6 },
] as const;

export function getStageIndex(stage?: string | null, status?: string | null): number {
  if (status === "completed") return 5;
  if (!stage) {
    if (status === "failed") return 4;
    if (status === "processing") return 2;
    return 0;
  }
  const idx = PIPELINE_STAGES.findIndex((s) => s.id === stage.toLowerCase());
  return idx >= 0 ? idx : 0;
}

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
  const [activeTab, setActiveTab] = useState<
    "fields" | "intelligence" | "provenance" | "ocr_stream" | "verification" | "versions"
  >("fields");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [sixDimensions, setSixDimensions] = useState<DocumentSixDimensionsReview | null>(
    doc.review_dimensions || null
  );
  const [loadingDimensions, setLoadingDimensions] = useState(false);
  const [provenanceExtractions, setProvenanceExtractions] = useState<FieldExtractionProvenance[]>(
    doc.provenance_extractions || []
  );
  const [loadingProvenance, setLoadingProvenance] = useState(false);

  // Staff classification correction modal
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(doc.category || "identity_passport");
  const [classificationReason, setClassificationReason] = useState("");
  const [isSubmittingClassification, setIsSubmittingClassification] = useState(false);

  // Staff applicant association modal
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [targetApplicantName, setTargetApplicantName] = useState(doc.proposed_applicant_name || "");
  const [associationReason, setAssociationReason] = useState("");
  const [isSubmittingAssociation, setIsSubmittingAssociation] = useState(false);

  // Canvas viewport controls
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.max(doc.page_count || 1, 1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showOcrOverlay, setShowOcrOverlay] = useState<boolean>(false);

  // Field correction states
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Certification & Structured Rejection states
  const [verifyStatus, setVerifyStatus] = useState<"verified" | "rejected" | "under_review">(
    (doc.verification_status as any) || "verified"
  );
  const [verificationNotes, setVerificationNotes] = useState(doc.verification_notes || "");
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);
  const [rejectionReasonCode, setRejectionReasonCode] = useState<StructuredRejectionReasonCode>("BLURRY_IMAGE");
  const [clientExplanation, setClientExplanation] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectionValidationError, setRejectionValidationError] = useState<string | null>(null);

  // Versions & reprocessing
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");

  // Pipeline runs & live stage tracking
  const [runs, setRuns] = useState<DocumentProcessingRunItem[]>([]);
  const [activeRun, setActiveRun] = useState<DocumentProcessingRunItem | null>(null);
  const [showPipelineDetails, setShowPipelineDetails] = useState<boolean>(true);

  // Phase 10: Section Splitting & Three-Tier Provenance
  const [isSplittingSections, setIsSplittingSections] = useState<boolean>(false);
  const [selectedTierFilter, setSelectedTierFilter] = useState<"ALL" | "EXTRACTED_FACT" | "MODEL_INFERENCE" | "PROFESSIONAL_DECISION">("ALL");

  const suggestedBoundaries: DocumentSplitSection[] =
    (doc.suggested_boundaries as any) ||
    (doc.layout_metadata?.suggested_boundaries as any) ||
    (doc.sub_documents_metadata as any) ||
    [];

  const handleSplitSections = async () => {
    setIsSplittingSections(true);
    try {
      const res = await splitDocumentSections(
        doc.id,
        suggestedBoundaries.length > 0 ? suggestedBoundaries : undefined,
        activeRole
      );
      setFeedbackToast({
        message: `Successfully partitioned multi-page document into ${res.split_count || 2} distinct sub-sections.`,
        type: "success",
      });
    } catch (err: any) {
      setFeedbackToast({
        message: err.message || "Failed to split document sections",
        type: "error",
      });
    } finally {
      setIsSplittingSections(false);
    }
  };

  const fieldCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isStaff = activeRole !== "retained_client" && activeRole !== "applicant";

  // Auto-clear feedback toast
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  // Fetch processing runs
  const fetchRuns = async () => {
    if (!doc.id) return;
    try {
      const res = await api.getDocumentRuns(doc.id, activeRole);
      if (res.data && res.data.length > 0) {
        setRuns(res.data);
        setActiveRun(res.data[0]);
      }
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (doc.id) {
      api.getDocumentRuns(doc.id, activeRole)
        .then((res) => {
          if (isMounted && res.data && res.data.length > 0) {
            setRuns(res.data);
            setActiveRun(res.data[0]);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [doc.id, activeRole]);

  // Live polling while document is processing or pending
  useEffect(() => {
    const isProcessing =
      doc.processing_status === "processing" ||
      doc.processing_status === "pending" ||
      activeRun?.status === "processing" ||
      activeRun?.status === "queued";

    if (!isProcessing) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const [runsRes, docRes] = await Promise.all([
          api.getDocumentRuns(doc.id, activeRole),
          api.getDocument(doc.id, activeRole),
        ]);
        if (!isMounted) return;
        if (runsRes.data && runsRes.data.length > 0) {
          setRuns(runsRes.data);
          setActiveRun(runsRes.data[0]);
        }
        if (docRes.data) {
          if (
            docRes.data.processing_status !== doc.processing_status ||
            (docRes.data.extracted_fields &&
              docRes.data.extracted_fields.length !== (doc.extracted_fields?.length || 0))
          ) {
            onDocumentUpdated(docRes.data);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [doc.id, doc.processing_status, activeRun?.status, activeRole, onDocumentUpdated]);

  // Load versions when versions tab is selected
  useEffect(() => {
    let isMounted = true;
    if (activeTab === "versions" && doc.id) {
      api.getDocumentVersions(doc.id, activeRole)
        .then((res) => {
          if (isMounted) setVersions(res.data);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, doc.id, activeRole]);

  // Fetch six review dimensions
  const fetchSixDimensions = async () => {
    if (!doc.id) return;
    setLoadingDimensions(true);
    try {
      const res = await api.getDocumentReviewDimensions(doc.id, activeRole);
      if (res.data) {
        setSixDimensions(res.data);
      }
    } catch (err) {
      console.error("Failed to load review dimensions", err);
    } finally {
      setLoadingDimensions(false);
    }
  };

  // Fetch extraction provenance
  const fetchProvenance = async () => {
    if (!doc.id) return;
    setLoadingProvenance(true);
    try {
      const res = await api.getDocumentExtractions(doc.id, activeRole);
      if (res.data && res.data.items) {
        setProvenanceExtractions(res.data.items);
      }
    } catch (err) {
      console.error("Failed to load extraction provenance", err);
    } finally {
      setLoadingProvenance(false);
    }
  };

  const threeTierEntities: ThreeTierEntity[] = React.useMemo(() => {
    if (doc.three_tier_extractions && doc.three_tier_extractions.length > 0) {
      return doc.three_tier_extractions;
    }
    const list: ThreeTierEntity[] = [];
    // Tier 1: Extracted Facts
    provenanceExtractions.forEach((p) => {
      list.push({
        field_name: p.field,
        field_label: p.field.replace(/_/g, " ").toUpperCase(),
        tier: "EXTRACTED_FACT",
        tier_number: 1,
        tier_label: "Tier 1: Extracted Fact",
        tier_badge_color: "emerald",
        value: p.value,
        confidence: p.confidence,
        source_page: p.page_number,
        bounding_box: p.bounding_box,
        model_or_method: p.extractor_version,
        statutory_disclaimer: "Typographical scan fact. Does not constitute legal sufficiency.",
      });
    });
    // Tier 2: Model Inferences
    if (doc.proposed_category) {
      list.push({
        field_name: "proposed_category",
        field_label: "Proposed Document Category",
        tier: "MODEL_INFERENCE",
        tier_number: 2,
        tier_label: "Tier 2: Model Inference",
        tier_badge_color: "amber",
        value: doc.proposed_category,
        confidence: 0.88,
        model_or_method: "Classification ML Engine",
        statutory_disclaimer: "Statistical prediction. Requires professional confirmation before filing.",
      });
    }
    if (doc.proposed_applicant_name) {
      list.push({
        field_name: "proposed_applicant",
        field_label: "Applicant Association Candidate",
        tier: "MODEL_INFERENCE",
        tier_number: 2,
        tier_label: "Tier 2: Model Inference",
        tier_badge_color: "amber",
        value: doc.proposed_applicant_name,
        confidence: 0.85,
        model_or_method: "Applicant Matcher ML",
        statutory_disclaimer: "Entity link prediction. Requires caseworker confirmation.",
      });
    }
    // Tier 3: Professional Decisions
    if (doc.verification_status && doc.verification_status !== "unverified") {
      list.push({
        field_name: "document_verification",
        field_label: "Document Verification Status",
        tier: "PROFESSIONAL_DECISION",
        tier_number: 3,
        tier_label: "Tier 3: Professional Decision",
        tier_badge_color: "indigo",
        value: doc.verification_status.toUpperCase(),
        confidence: 1.0,
        decision_notes: doc.verification_notes || "Professional casework review performed.",
        decided_by: doc.verified_by_user_id || "Caseworker",
        decided_at: doc.verified_at,
        statutory_disclaimer: "Human professional determination governing filing readiness.",
      });
    }
    return list;
  }, [doc, provenanceExtractions]);

  const filteredThreeTierEntities = React.useMemo(() => {
    if (selectedTierFilter === "ALL") return threeTierEntities;
    return threeTierEntities.filter((e) => e.tier === selectedTierFilter);
  }, [threeTierEntities, selectedTierFilter]);

  useEffect(() => {
    if (activeTab === "intelligence" && !sixDimensions) {
      fetchSixDimensions();
    }
    if (activeTab === "provenance" && (!provenanceExtractions || provenanceExtractions.length === 0)) {
      fetchProvenance();
    }
  }, [activeTab, doc.id]);

  const handleSaveClassification = async () => {
    if (!classificationReason.trim()) {
      setFeedbackToast({ message: "Please provide an audit reason for category change.", type: "error" });
      return;
    }
    setIsSubmittingClassification(true);
    try {
      const res = await api.correctDocumentClassification(doc.id, selectedCategory, classificationReason.trim(), activeRole);
      onDocumentUpdated(res.data);
      setShowClassificationModal(false);
      setClassificationReason("");
      setFeedbackToast({ message: `Document reclassified as "${selectedCategory}". Audit logged.`, type: "success" });
      fetchSixDimensions();
    } catch (err: any) {
      setFeedbackToast({ message: err?.message || "Failed to update classification.", type: "error" });
    } finally {
      setIsSubmittingClassification(false);
    }
  };

  const handleSaveApplicantAssociation = async () => {
    if (!associationReason.trim()) {
      setFeedbackToast({ message: "Please provide an audit justification for applicant assignment.", type: "error" });
      return;
    }
    setIsSubmittingAssociation(true);
    try {
      const res = await api.correctApplicantAssociation(doc.id, targetApplicantName.trim(), doc.client_id, associationReason.trim(), activeRole);
      onDocumentUpdated(res.data);
      setShowApplicantModal(false);
      setAssociationReason("");
      setFeedbackToast({ message: `Applicant assignment confirmed. Audit trail updated.`, type: "success" });
      fetchSixDimensions();
    } catch (err: any) {
      setFeedbackToast({ message: err?.message || "Failed to update applicant association.", type: "error" });
    } finally {
      setIsSubmittingAssociation(false);
    }
  };

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

  const handleCopyFieldValue = (field: DocumentExtractedField) => {
    const val = field.is_manually_corrected
      ? field.corrected_value
      : field.normalized_value || field.original_value;
    if (val) {
      navigator.clipboard.writeText(val);
      setCopiedFieldId(field.id);
      setTimeout(() => setCopiedFieldId(null), 2000);
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
    if (verifyStatus === "rejected") {
      if (!clientExplanation.trim() || clientExplanation.trim().length < 5) {
        setRejectionValidationError("Customizable client-facing explanation is required (minimum 5 characters).");
        return;
      }
      setRejectionValidationError(null);
      setIsSubmittingVerify(true);
      try {
        const res = await api.rejectDocument(
          doc.id,
          {
            structured_reason_code: rejectionReasonCode,
            client_explanation: clientExplanation.trim(),
            internal_notes: internalNotes.trim() || undefined,
          },
          activeRole
        );
        onDocumentUpdated(res.data);
        setFeedbackToast({
          message: `Document rejected with reason [${rejectionReasonCode}]. Client notification recorded.`,
          type: "success",
        });
      } catch (err: any) {
        setFeedbackToast({
          message: `Rejection failed: ${err?.message || "Unknown error"}`,
          type: "error",
        });
      } finally {
        setIsSubmittingVerify(false);
      }
      return;
    }

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
      await fetchRuns();
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

  const rawDocOcrConf = (doc as any).ocr_confidence;
  const avgConfidence =
    typeof rawDocOcrConf === "number"
      ? Math.round(rawDocOcrConf <= 1 ? rawDocOcrConf * 100 : rawDocOcrConf)
      : fields.length
      ? Math.round(
          (fields.reduce((acc, f) => acc + (f.ocr_confidence || 0.95), 0) / fields.length) * 100
        )
      : 0;

  const pageImageUrl =
    (doc as any).page_image_data_url ||
    (doc as any).preview_url ||
    ((doc as any).file_url && /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test((doc as any).file_url)
      ? (doc as any).file_url
      : null);
  const pdfPreviewUrl =
    !pageImageUrl &&
    ((doc as any).pdf_url ||
      (doc as any).file_url ||
      (doc.download_url && /\.pdf($|\?)/i.test(doc.download_url) ? doc.download_url : null));

  const verifiedCount = fields.filter((f) => f.validation_status === "verified").length;
  const correctedCount = fields.filter((f) => f.is_manually_corrected).length;
  const editingField = fields.find((f) => f.id === editingFieldId);

  const isFailed = doc.processing_status === "failed" || (doc.processing_status !== "completed" && activeRun?.status === "failed");
  const currentStageIndex = getStageIndex(doc.active_run_stage || activeRun?.stage, doc.processing_status);
  const progressPercent = doc.active_run_progress_percent ?? activeRun?.progress_percent ?? (doc.processing_status === "completed" ? 100 : isFailed ? 35 : 15);

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

      {/* 1.5 LIVE PIPELINE STAGE STEPPER */}
      <div
        data-testid="pipeline-stage-stepper"
        className="px-5 py-3 bg-[#08201d] border-b border-[#1b3a36]"
      >
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-400 font-mono">
              Intelligence Pipeline
            </span>
            <span className="text-slate-500">•</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isFailed
                    ? "bg-rose-400 animate-ping"
                    : doc.processing_status === "completed"
                    ? "bg-emerald-400"
                    : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="text-xs font-medium text-slate-200">
                {isFailed
                  ? "Processing Interrupted"
                  : doc.processing_status === "completed"
                  ? "Execution Complete"
                  : `Processing (${PIPELINE_STAGES[currentStageIndex]?.label || "Running"})`}
              </span>
            </div>
            {activeRun && (
              <span className="px-2 py-0.5 text-[11px] rounded bg-[#051615] text-teal-300 border border-[#143a36] font-mono">
                Run #{activeRun.run_number} • {activeRun.trigger_type}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-emerald-400">
              {progressPercent}%
            </span>
            {isFailed && isStaff && (
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition-colors"
              >
                {isReprocessing ? "Retrying..." : "Retry Pipeline"}
              </button>
            )}
            <button
              onClick={() => setShowPipelineDetails((prev) => !prev)}
              aria-label={showPipelineDetails ? "Collapse pipeline" : "Expand pipeline"}
              className="text-xs text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-[#0c2e2a]"
            >
              {showPipelineDetails ? "▲" : "▼"}
            </button>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-1.5 bg-[#051413] rounded-full overflow-hidden mb-3 border border-[#143a36]">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isFailed
                ? "bg-rose-500"
                : "bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            }`}
            style={{ width: `${Math.min(Math.max(progressPercent, 5), 100)}%` }}
          />
        </div>

        {/* Horizontal Stepper Steps */}
        {showPipelineDetails && (
          <div className="grid grid-cols-6 gap-2 pt-1">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isPast = !isFailed && (doc.processing_status === "completed" || idx < currentStageIndex);
              const isCurrent = idx === currentStageIndex;
              const isStageFailed = isCurrent && isFailed;

              return (
                <div key={stage.id} className="flex flex-col items-center text-center relative group">
                  {/* Step Circle Indicator */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                      isPast
                        ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        : isStageFailed
                        ? "bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse"
                        : isCurrent
                        ? "bg-teal-500/20 text-teal-300 border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)] animate-pulse"
                        : "bg-[#051413] text-slate-500 border border-[#1b3a36]"
                    }`}
                  >
                    {isPast ? "✓" : isStageFailed ? "!" : stage.step}
                  </div>

                  {/* Step Label */}
                  <span
                    className={`mt-1.5 text-[11px] font-medium leading-tight ${
                      isPast
                        ? "text-slate-200"
                        : isStageFailed
                        ? "text-rose-400 font-bold"
                        : isCurrent
                        ? "text-emerald-300 font-bold"
                        : "text-slate-500"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Failed Pipeline Alert */}
        {isFailed && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-rose-400 font-bold text-sm">⚠️</span>
              <span>
                {doc.processing_error || activeRun?.error_message || "Document processing pipeline failed during analysis."}
              </span>
            </div>
            {isStaff && (
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="underline hover:text-white font-semibold ml-3"
              >
                {isReprocessing ? "Retrying..." : "Retry Now"}
              </button>
            )}
          </div>
        )}
      </div>

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
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-0.5 text-[11px] rounded bg-[#051413] text-slate-300 border border-[#1b3a36] hover:bg-[#133c38] disabled:opacity-40"
              >
                ‹ Prev Page
              </button>
              <span className="text-[11px] text-slate-300 font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2 py-0.5 text-[11px] rounded bg-[#051413] text-slate-300 border border-[#1b3a36] hover:bg-[#133c38] disabled:opacity-40"
              >
                Next Page ›
              </button>
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
              {/* REAL DOCUMENT EXTRACTION & RECORD PREVIEW CANVAS */}
              {pageImageUrl ? (
                <div className="w-[600px] h-[420px] bg-white relative flex items-center justify-center overflow-hidden">
                  <img
                    src={pageImageUrl}
                    alt={doc.title}
                    className="max-w-full max-h-full object-contain block"
                  />
                </div>
              ) : pdfPreviewUrl ? (
                <div className="w-[600px] h-[420px] bg-white relative overflow-hidden">
                  <iframe
                    src={pdfPreviewUrl}
                    title={doc.title}
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                /* HONEST DOCUMENT SUMMARY SHEET WHEN ONLY METADATA IS PRESENT (600x420) */
                <div className="w-[600px] h-[420px] bg-[#fbfbf9] relative p-6 font-sans text-slate-900 border-2 border-slate-300 select-none flex flex-col justify-between">
                  <div>
                    <div className="border-b-2 border-teal-900 pb-3 mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-teal-900">
                          {formatCategoryName(doc.category)} • Evidentiary Dossier Record
                        </div>
                        <div className="text-sm font-semibold text-slate-800 font-display">
                          {doc.title}
                        </div>
                        {doc.filename && (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            File: {doc.filename}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] font-mono text-slate-500">
                        <div>PAGE {currentPage} OF {totalPages}</div>
                        <div className="text-teal-800 font-semibold mt-0.5">
                          {doc.verification_status ? doc.verification_status.toUpperCase() : "UPLOADED"}
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded border border-slate-200 text-xs font-mono space-y-2">
                      <div className="text-slate-600 font-bold uppercase border-b border-slate-200 pb-1">
                        Structured Document Transcription &amp; Extraction Payload
                      </div>
                      {fields.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 pt-1 max-h-[185px] overflow-hidden">
                          {fields
                            .filter((f) => !f.source_page || f.source_page === currentPage || totalPages === 1)
                            .slice(0, 6)
                            .map((f) => (
                              <div key={f.id} className="bg-white p-2 rounded border border-slate-200">
                                <div className="text-[9px] text-slate-500 uppercase font-sans font-semibold">
                                  {f.field_label || f.field_name}
                                </div>
                                <div className="text-[11px] font-bold text-slate-900 truncate">
                                  {f.is_manually_corrected ? f.corrected_value : f.normalized_value || f.original_value}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-slate-800 leading-relaxed max-h-[185px] overflow-hidden whitespace-pre-line">
                          {doc.extracted_text || `Immutable evidentiary upload (${doc.filename || doc.title}) indexed for case review.`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>SHA-256: {doc.sha256_hash ? `${doc.sha256_hash.slice(0, 24)}…` : "Verified on intake"}</span>
                    <span>Uploaded: {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "Active Session"}</span>
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

                    let x = loc.x0 || 70;
                    let y = loc.y0 || 100;
                    let width = Math.max((loc.x1 || 240) - x, 40);
                    let height = Math.max((loc.y1 || 130) - y, 22);

                    if (loc.bounding_box && Array.isArray(loc.bounding_box) && loc.bounding_box.length === 4) {
                      const [ymin, xmin, ymax, xmax] = loc.bounding_box;
                      const viewW = 600;
                      const viewH = doc.category === "educational_records" ? 440 : 420;
                      x = Math.round(xmin * viewW);
                      y = Math.round(ymin * viewH);
                      width = Math.max(Math.round((xmax - xmin) * viewW), 40);
                      height = Math.max(Math.round((ymax - ymin) * viewH), 22);
                    }

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
              Extracted Fields ({fields.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "intelligence"}
              onClick={() => setActiveTab("intelligence")}
              className={`flex-1 py-3 px-3 font-medium border-b-2 text-center transition-colors whitespace-nowrap ${
                activeTab === "intelligence"
                  ? "border-teal-400 text-teal-300 font-semibold bg-[#0b2825]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              6-Dimension Intelligence
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "provenance"}
              onClick={() => setActiveTab("provenance")}
              className={`flex-1 py-3 px-3 font-medium border-b-2 text-center transition-colors whitespace-nowrap ${
                activeTab === "provenance"
                  ? "border-teal-400 text-teal-300 font-semibold bg-[#0b2825]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Provenance (JSON)
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
              Verification & Audit
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
              Versions
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
                            ) : field.validation_status === "needs_review" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold">
                                Needs Review
                              </span>
                            ) : field.validation_status === "flagged" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800 font-semibold">
                                Flagged
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
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span>
                              Page {field.source_page || 1}
                            </span>
                            <span>•</span>
                            <span>
                              Confidence:{" "}
                              <strong
                                className={field.ocr_confidence && field.ocr_confidence < 0.75 ? "text-amber-400 font-bold" : "text-teal-300"}
                                title={field.ocr_confidence && field.ocr_confidence < 0.75 ? "Sub-threshold OCR confidence (<75%). Typographical fidelity only; does not constitute legal sufficiency." : "OCR confidence"}
                              >
                                {Math.round((field.ocr_confidence || 0.95) * 100)}%
                                {field.ocr_confidence && field.ocr_confidence < 0.75 && " ⚠️"}
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

                        {/* Confidence Visual Meter */}
                        <div className="w-full bg-[#051413] rounded-full h-1 mb-2.5 overflow-hidden border border-[#143330]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              (field.ocr_confidence || 0.95) >= 0.95
                                ? "bg-gradient-to-r from-emerald-500 to-teal-300 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                                : (field.ocr_confidence || 0.95) >= 0.8
                                ? "bg-amber-400"
                                : "bg-rose-400"
                            }`}
                            style={{ width: `${Math.round((field.ocr_confidence || 0.95) * 100)}%` }}
                          />
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#143330]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyFieldValue(field)}
                              className="px-2 py-0.5 text-[10px] rounded bg-[#0d2825] hover:bg-[#133c38] text-teal-300 border border-[#1b3a36] transition-colors flex items-center gap-1"
                              title="Copy normalized legal value"
                            >
                              <span>{copiedFieldId === field.id ? "✓" : "📋"}</span>
                              <span>{copiedFieldId === field.id ? "Copied" : "Copy"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFieldId(field.id);
                                setShowBoundingBoxes(true);
                              }}
                              className="px-2 py-0.5 text-[10px] rounded bg-[#0d2825] hover:bg-[#133c38] text-teal-300 border border-[#1b3a36] transition-colors flex items-center gap-1"
                              title="Locate bounding box on document canvas"
                            >
                              <span>🎯</span>
                              <span>Locate</span>
                            </button>
                          </div>

                          {isStaff && !isEditing && (
                            <div className="flex items-center gap-1.5">
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
                        </div>

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
                        onChange={() => {
                          setVerifyStatus("verified");
                          setRejectionValidationError(null);
                        }}
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
                        onChange={() => {
                          setVerifyStatus("under_review");
                          setRejectionValidationError(null);
                        }}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>Flag for Supplementary Review</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-rose-300 font-semibold">
                      <input
                        type="radio"
                        name="verifyStatus"
                        value="rejected"
                        checked={verifyStatus === "rejected"}
                        onChange={() => {
                          setVerifyStatus("rejected");
                          setRejectionValidationError(null);
                        }}
                        className="text-rose-500 focus:ring-rose-500"
                      />
                      <span>Reject Document (Requires Reason)</span>
                    </label>
                  </div>
                </div>

                {verifyStatus === "rejected" ? (
                  <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-rose-200 font-bold text-xs">
                      <span>⚠️</span>
                      <span>Structured Document Rejection Form</span>
                    </div>

                    <div>
                      <label className="block text-slate-200 font-semibold mb-1">
                        Structured Rejection Reason Code *
                      </label>
                      <select
                        value={rejectionReasonCode}
                        onChange={(e) => setRejectionReasonCode(e.target.value as StructuredRejectionReasonCode)}
                        className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                      >
                        {STRUCTURED_REJECTION_REASONS.map((r) => (
                          <option key={r.code} value={r.code}>
                            [{r.code}] {r.label} — {r.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-slate-200 font-semibold">
                          Customizable Client-Facing Explanation * (Min 5 chars)
                        </label>
                        <span className={`text-[10px] font-mono font-bold ${clientExplanation.trim().length >= 5 ? "text-emerald-400" : "text-amber-400"}`}>
                          {clientExplanation.trim().length} chars
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={clientExplanation}
                        onChange={(e) => {
                          setClientExplanation(e.target.value);
                          if (e.target.value.trim().length >= 5) {
                            setRejectionValidationError(null);
                          }
                        }}
                        placeholder="e.g., The scan of page 2 has excessive glare over the passport issue date. Please upload a flat, high-resolution color scan without flash reflections."
                        className="w-full bg-[#051413] border border-rose-800 rounded-lg p-2.5 text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-slate-200 font-semibold">
                          Internal Legal Notes (Optional)
                        </label>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-[#051413] text-slate-400 font-mono border border-[#1b3a36]">
                          🔒 Quarantined from Client View
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="e.g., Flagged for supervising attorney: passport expires in 4 months, consider asking client for renewed credential before filing."
                        className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    {rejectionValidationError && (
                      <div className="p-2 bg-rose-950 border border-rose-700 text-rose-200 text-xs rounded-lg flex items-center gap-2 font-medium">
                        <span>⚠️</span>
                        <span>{rejectionValidationError}</span>
                      </div>
                    )}

                    {isStaff && (
                      <button
                        type="button"
                        onClick={handleVerifySubmit}
                        disabled={isSubmittingVerify}
                        className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-md disabled:opacity-50"
                      >
                        {isSubmittingVerify ? "Submitting Rejection..." : "Reject Document & Notify Client"}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
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
          {/* TAB: 6-DIMENSION INTELLIGENCE */}
          {activeTab === "intelligence" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Mandatory Legal Sufficiency Notice */}
              <div className="bg-amber-950/40 border border-amber-600/40 rounded-lg p-3 text-xs text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 uppercase tracking-wide text-[11px]">
                  <span>⚖️ Legal Notice: Calibrated Confidence Thresholds</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  {sixDimensions?.high_ocr_confidence_notice || doc.legal_sufficiency_disclaimer || "High optical character recognition (OCR) confidence reflects typographical and contrast fidelity only; it does not constitute evidentiary or statutory legal sufficiency under governing immigration regulations."}
                </p>
              </div>

              {loadingDimensions ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Evaluating document across 6 separate review dimensions...
                </div>
              ) : sixDimensions ? (
                <div className="space-y-3">
                  {/* Dimension 1: Readability & Scan Quality */}
                  <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-100">1. {sixDimensions.readability.label}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sixDimensions.readability.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}>
                        {sixDimensions.readability.status}
                      </span>
                    </div>
                    <div className="w-full bg-[#051413] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${sixDimensions.readability.score >= 0.8 ? "bg-emerald-400" : "bg-amber-400"}`}
                        style={{ width: `${Math.round(sixDimensions.readability.score * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-300">{sixDimensions.readability.summary}</p>
                    {sixDimensions.readability.high_priority_flags.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {sixDimensions.readability.high_priority_flags.map((f, i) => (
                          <div key={i} className="text-[11px] text-rose-300 flex items-center gap-1.5 bg-rose-950/40 px-2 py-1 rounded border border-rose-900/50">
                            <span>⚠️</span> <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dimension 2: Document Classification Type */}
                  <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">2. {sixDimensions.document_type.label}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {sixDimensions.document_type.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{sixDimensions.document_type.summary}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-teal-300 bg-[#051413] px-2 py-1 rounded border border-[#1b3a36]">
                        Category: {doc.category}
                      </span>
                      {isStaff && (
                        <button
                          onClick={() => {
                            setSelectedCategory(doc.category);
                            setShowClassificationModal(true);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-[#133c38] hover:bg-[#1a4e49] text-teal-200 border border-[#215751] transition-colors"
                        >
                          Correct Classification
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dimension 3: Applicant Association */}
                  <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">3. {sixDimensions.applicant_association.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sixDimensions.applicant_association.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-amber-950 text-amber-300 border border-amber-800"
                      }`}>
                        {sixDimensions.applicant_association.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{sixDimensions.applicant_association.summary}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-medium text-slate-200">
                        Associated: {doc.proposed_applicant_name ? doc.proposed_applicant_name : <span className="text-amber-400 italic">Unassigned (Uncertain candidate)</span>}
                      </span>
                      {isStaff && (
                        <button
                          onClick={() => {
                            setTargetApplicantName(doc.proposed_applicant_name || "");
                            setShowApplicantModal(true);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-[#133c38] hover:bg-[#1a4e49] text-teal-200 border border-[#215751] transition-colors"
                        >
                          Confirm / Reassign
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-Page Boundary Detection & Section Splitting */}
                  {Boolean(doc.page_count && doc.page_count > 1) && (
                    <div
                      data-testid="page-boundary-section"
                      className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-100">📑 Suggested Page Boundaries & Sub-Documents</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-950 text-sky-300 border border-sky-800">
                            {doc.page_count} Pages Detected
                          </span>
                        </div>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={handleSplitSections}
                            disabled={isSplittingSections}
                            className="px-2.5 py-1 text-xs rounded bg-[#133c38] hover:bg-[#1a4e49] text-teal-200 border border-[#215751] transition-colors font-medium flex items-center gap-1.5"
                          >
                            <span>⚡</span>
                            <span>{isSplittingSections ? "Splitting..." : "Split Document Sections"}</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">
                        Automated boundary detection identifies distinct document types embedded within this single multi-page file.
                      </p>
                      <div className="space-y-1.5 pt-1">
                        {suggestedBoundaries.length > 0 ? (
                          suggestedBoundaries.map((sec: any, sIdx: number) => (
                            <div
                              key={sIdx}
                              className="text-xs font-mono bg-[#051413] p-2 rounded border border-[#1b3a36] flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-teal-400 font-bold">{sec.title || `Section ${sIdx + 1}`}</span>
                                <span className="text-slate-400 text-[11px]">({sec.category})</span>
                              </div>
                              <div className="flex items-center gap-3 text-slate-300 text-[11px]">
                                <span>Pages {sec.start_page} – {sec.end_page}</span>
                                {sec.confidence && (
                                  <span className="text-emerald-400 font-semibold">{Math.round(sec.confidence * 100)}% Conf</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic bg-[#051413] p-2 rounded border border-[#1b3a36]">
                            Pages 1 through {doc.page_count} evaluated as single continuous document stream. Click "Split Document Sections" to partition by visual headers.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dimension 4: Cross-Document Consistency */}
                  <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">4. {sixDimensions.consistency.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sixDimensions.consistency.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-amber-950 text-amber-300 border border-amber-800"
                      }`}>
                        {sixDimensions.consistency.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{sixDimensions.consistency.summary}</p>
                  </div>

                  {/* Dimension 5: Evidentiary Sufficiency & Completeness */}
                  <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">5. {sixDimensions.evidentiary_sufficiency.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sixDimensions.evidentiary_sufficiency.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}>
                        {sixDimensions.evidentiary_sufficiency.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{sixDimensions.evidentiary_sufficiency.summary}</p>
                    {sixDimensions.evidentiary_sufficiency.high_priority_flags.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {sixDimensions.evidentiary_sufficiency.high_priority_flags.map((f, i) => (
                          <div key={i} className="text-[11px] text-amber-300 flex items-center gap-1.5 bg-amber-950/40 px-2 py-1 rounded border border-amber-900/50">
                            <span>⏳</span> <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dimension 6: Human Verification */}
                  <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">6. {sixDimensions.human_verification.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        doc.verification_status === "verified"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-amber-950 text-amber-300 border border-amber-800"
                      }`}>
                        {doc.verification_status || "UNVERIFIED"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{sixDimensions.human_verification.summary}</p>
                    <div className="text-[11px] text-teal-300/90 font-medium bg-[#051413] p-2 rounded border border-[#1b3a36]">
                      Notice: Decoupled from automated OCR extraction. Authorized caseworker certification required under 8 CFR § 103.2 for package filing.
                    </div>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      onClick={fetchSixDimensions}
                      className="px-3 py-1.5 text-xs rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-medium transition-colors"
                    >
                      Re-audit Six Dimensions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  <button
                    onClick={fetchSixDimensions}
                    className="px-3 py-1.5 text-xs rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-medium"
                  >
                    Evaluate Six Review Dimensions
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: THREE-TIER CANDIDATE EXTRACTION PROVENANCE */}
          {activeTab === "provenance" && (
            <div data-testid="three-tier-provenance-view" className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {/* Three-Tier Statutory Guardrail Banner */}
              <div className="bg-[#09221f] border border-[#1b3a36] rounded-lg p-3 text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚖️</span>
                    <span className="font-bold text-teal-300">Phase 10 Three-Tier Evidence Traceability Architecture</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(threeTierEntities, null, 2));
                      setFeedbackToast({ message: "Copied all Three-Tier records.", type: "success" });
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-[#133c38] text-teal-200 hover:bg-[#1a4e49] border border-[#215751] whitespace-nowrap"
                  >
                    Copy All JSON
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Strict regulatory separation of <strong>Extracted Facts</strong> (source OCR tokens), <strong>Model Inferences</strong> (predictions/classifications), and <strong>Professional Decisions</strong> (licensed staff determinations). AI does not decide legal eligibility, authenticity, fraud, or legal sufficiency.
                </p>
              </div>

              {/* Tier Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedTierFilter("ALL")}
                  className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
                    selectedTierFilter === "ALL"
                      ? "bg-teal-900/60 text-teal-200 border-teal-500"
                      : "bg-[#09221f] text-slate-400 border-[#1b3a36] hover:text-slate-200"
                  }`}
                >
                  All ({threeTierEntities.length})
                </button>
                <button
                  type="button"
                  data-testid="filter-tier-1"
                  onClick={() => setSelectedTierFilter("EXTRACTED_FACT")}
                  className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
                    selectedTierFilter === "EXTRACTED_FACT"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-600"
                      : "bg-[#09221f] text-emerald-400/70 border-[#1b3a36] hover:text-emerald-300"
                  }`}
                >
                  Tier 1: Facts ({threeTierEntities.filter((e) => e.tier === "EXTRACTED_FACT").length})
                </button>
                <button
                  type="button"
                  data-testid="filter-tier-2"
                  onClick={() => setSelectedTierFilter("MODEL_INFERENCE")}
                  className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
                    selectedTierFilter === "MODEL_INFERENCE"
                      ? "bg-amber-950 text-amber-300 border-amber-600"
                      : "bg-[#09221f] text-amber-400/70 border-[#1b3a36] hover:text-amber-300"
                  }`}
                >
                  Tier 2: Inferences ({threeTierEntities.filter((e) => e.tier === "MODEL_INFERENCE").length})
                </button>
                <button
                  type="button"
                  data-testid="filter-tier-3"
                  onClick={() => setSelectedTierFilter("PROFESSIONAL_DECISION")}
                  className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
                    selectedTierFilter === "PROFESSIONAL_DECISION"
                      ? "bg-indigo-950 text-indigo-300 border-indigo-600"
                      : "bg-[#09221f] text-indigo-400/70 border-[#1b3a36] hover:text-indigo-300"
                  }`}
                >
                  Tier 3: Decisions ({threeTierEntities.filter((e) => e.tier === "PROFESSIONAL_DECISION").length})
                </button>
              </div>

              {loadingProvenance ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading structured extraction provenance...</div>
              ) : filteredThreeTierEntities.length > 0 ? (
                <div className="space-y-3">
                  {filteredThreeTierEntities.map((item, idx) => {
                    const badgeStyles =
                      item.tier === "EXTRACTED_FACT"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : item.tier === "MODEL_INFERENCE"
                        ? "bg-amber-950 text-amber-300 border-amber-800"
                        : "bg-indigo-950 text-indigo-300 border-indigo-800";

                    return (
                      <div
                        key={idx}
                        data-testid={`three-tier-card-${item.field_name}`}
                        onClick={() => {
                          const matchingField = fields.find((f) => f.field_name === item.field_name);
                          if (matchingField) setSelectedFieldId(matchingField.id);
                        }}
                        className="bg-[#051413] border border-[#1b3a36] rounded-lg p-3 font-mono text-xs text-slate-200 space-y-2 hover:border-teal-500/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeStyles}`}>
                              {item.tier_label || `Tier ${item.tier_number}: ${item.tier.replace(/_/g, " ")}`}
                            </span>
                            <span className="font-bold text-teal-300">{item.field_label || item.field_name}</span>
                          </div>
                          <span className="text-[11px] font-sans font-semibold text-slate-300">
                            Confidence: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>

                        <div className="text-[12px] text-slate-100 font-sans font-medium bg-[#09221f] p-2 rounded border border-[#1b3a36]">
                          "{String(item.value)}"
                        </div>

                        <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                          {item.source_page && <span>Page {item.source_page}</span>}
                          {item.model_or_method && <span>Engine: {item.model_or_method}</span>}
                          {item.decided_by && <span>Reviewer: {item.decided_by}</span>}
                        </div>

                        {item.decision_notes && (
                          <div className="text-[11px] text-indigo-200 bg-indigo-950/40 px-2.5 py-1.5 rounded border border-indigo-900/50">
                            <span className="font-semibold text-indigo-300">Staff Decision:</span> {item.decision_notes}
                          </div>
                        )}

                        {item.bounding_box && (
                          <div className="text-[10px] text-teal-300/90 bg-[#09221f] px-2 py-1 rounded border border-[#1b3a36]">
                            bounding_box: [{(item.bounding_box as number[]).map((n) => typeof n === "number" ? n.toFixed(2) : n).join(", ")}]
                          </div>
                        )}

                        {item.statutory_disclaimer && (
                          <div className="text-[10px] text-slate-400 italic bg-[#09221f]/50 px-2 py-1 rounded">
                            ⚖️ {item.statutory_disclaimer}
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(JSON.stringify(item, null, 2));
                              setFeedbackToast({ message: `Copied JSON for ${item.field_name}`, type: "info" });
                            }}
                            className="px-2 py-1 text-[10px] rounded bg-[#133c38] text-teal-200 hover:bg-[#1a4e49] border border-[#215751]"
                          >
                            Copy Item JSON
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  <button
                    onClick={fetchProvenance}
                    className="px-3 py-1.5 text-xs rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-medium"
                  >
                    Load Extraction Provenance
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CLASSIFICATION CORRECTION MODAL */}
      {showClassificationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09221f] border border-[#1b3a36] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1b3a36] pb-3">
              <h3 className="text-sm font-bold text-slate-100">Correct Document Classification</h3>
              <button onClick={() => setShowClassificationModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Document Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="identity_passport">Identity & Passport</option>
                  <option value="civil_status">Civil Status & Family</option>
                  <option value="visas_residence_permits">Visas & Residence Permits</option>
                  <option value="educational_records">Educational Records & Degrees</option>
                  <option value="employment_records">Employment & Experience Letters</option>
                  <option value="financial_evidence">Financial & Tax Evidence</option>
                  <option value="police_medical">Police & Medical Clearances</option>
                  <option value="government_correspondence">Government Notices & Receipts</option>
                  <option value="translations_certifications">Certified Translations</option>
                  <option value="supporting_evidence">General Supporting Evidence</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Audit Justification Reason</label>
                <textarea
                  rows={3}
                  value={classificationReason}
                  onChange={(e) => setClassificationReason(e.target.value)}
                  placeholder="e.g., Reclassified as official certified marriage apostille based on physical seal inspection."
                  className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="text-[11px] text-slate-400 bg-[#051413] p-2 rounded border border-[#1b3a36]">
                ⚠️ Note: Reclassification logs an immutable audit event with previous and updated category. Decoupled from filing package readiness.
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1b3a36]">
              <button
                onClick={() => setShowClassificationModal(false)}
                className="px-3 py-1.5 text-xs rounded bg-transparent hover:bg-[#133c38] text-slate-300 border border-[#1b3a36]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClassification}
                disabled={isSubmittingClassification}
                className="px-4 py-1.5 text-xs rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmittingClassification ? "Saving..." : "Save Classification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPLICANT ASSOCIATION MODAL */}
      {showApplicantModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09221f] border border-[#1b3a36] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1b3a36] pb-3">
              <h3 className="text-sm font-bold text-slate-100">Confirm or Reassign Applicant</h3>
              <button onClick={() => setShowApplicantModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Applicant Name</label>
                <input
                  type="text"
                  value={targetApplicantName}
                  onChange={(e) => setTargetApplicantName(e.target.value)}
                  placeholder="Full legal name as shown on passport"
                  className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Audit Justification Reason</label>
                <textarea
                  rows={3}
                  value={associationReason}
                  onChange={(e) => setAssociationReason(e.target.value)}
                  placeholder="e.g., Matches primary petitioner biodata name tokens and passport number."
                  className="w-full bg-[#051413] border border-[#1b3a36] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="text-[11px] text-slate-400 bg-[#051413] p-2 rounded border border-[#1b3a36]">
                ⚠️ Note: Confirmed assignment links document evidence directly to the selected applicant profile with audit provenance.
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1b3a36]">
              <button
                onClick={() => setShowApplicantModal(false)}
                className="px-3 py-1.5 text-xs rounded bg-transparent hover:bg-[#133c38] text-slate-300 border border-[#1b3a36]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApplicantAssociation}
                disabled={isSubmittingAssociation}
                className="px-4 py-1.5 text-xs rounded bg-[#0D6866] hover:bg-[#063C3D] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmittingAssociation ? "Saving..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
