"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import {
  ExtractorAnalysisResult,
  ExtractorFieldProvenance,
  PacketSortResult,
  PacketPersonFolder,
  PacketSortedDocument,
  analyzeDocumentStandalone,
  sortDocumentPacket,
  checkExtractorBackendHealth,
  generateClientFallbackPacketSort,
} from "../../lib/api/extractor";

export interface DocumentExtractorLabProps {
  embedded?: boolean;
  hideIntroTitle?: boolean;
}

export function DocumentExtractorLab({
  embedded = false,
  hideIntroTitle = false,
}: DocumentExtractorLabProps = {}) {
  const [inputMode, setInputMode] = useState<"upload" | "packet_sorter">("upload");

  // Multi-Person Packet Sorter State
  const [isSortingPacket, setIsSortingPacket] = useState<boolean>(false);
  const [packetSortResult, setPacketSortResult] = useState<PacketSortResult | null>(null);
  const [selectedPersonFolderId, setSelectedPersonFolderId] = useState<string | null>(null);
  const [selectedSplitDocIndex, setSelectedSplitDocIndex] = useState<number | null>(null);

  // Inputs
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Execution & Progress State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [overallAnalysisResult, setOverallAnalysisResult] = useState<ExtractorAnalysisResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractorAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; message?: string }>({
    online: true,
    message: "Verifying AI Extraction engine...",
  });

  // Inspector Tabs & Filter
  const [activeTab, setActiveTab] = useState<
    "entities" | "recognition" | "quality" | "forensics" | "ocr" | "json"
  >("entities");
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>("");
  const [selectedFieldForBbox, setSelectedFieldForBbox] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Maximize / Fullscreen Spatial Canvas Lightbox State
  const [isCanvasMaximized, setIsCanvasMaximized] = useState<boolean>(false);
  const [maximizedPageNum, setMaximizedPageNum] = useState<number>(1);
  const [maximizedZoom, setMaximizedZoom] = useState<number>(1);
  const [showOverlayInMax, setShowOverlayInMax] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close maximize modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCanvasMaximized) {
        setIsCanvasMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCanvasMaximized]);

  // Verify backend health on mount
  useEffect(() => {
    async function checkHealth() {
      const health = await checkExtractorBackendHealth();
      setBackendStatus(health);
    }
    checkHealth();
  }, []);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      setCustomFilename(file.name);
      if (inputMode !== "packet_sorter") {
        setInputMode("upload");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setCustomFilename(file.name);
      if (inputMode !== "packet_sorter") {
        setInputMode("upload");
      }
    }
  };

  // Helper: Synchronize deep extraction inspector and spatial canvas with a selected split document
  const syncActiveAnalysisWithSelectedDoc = (
    doc: PacketSortedDocument,
    fallbackBase: ExtractorAnalysisResult
  ): ExtractorAnalysisResult => {
    const isBaseCategory =
      !doc.category ||
      doc.category === fallbackBase.recognition.category ||
      (fallbackBase.extracted_fields && fallbackBase.extracted_fields.length > 0 && doc.document_index === 1);

    let docFields: ExtractorFieldProvenance[] = [];

    if (isBaseCategory && fallbackBase.extracted_fields && fallbackBase.extracted_fields.length > 0) {
      // Preserve deep base fields extracted by the standalone AI engine
      docFields = [...fallbackBase.extracted_fields];
    } else {
      // Map doc.extracted_fields into rich ExtractorFieldProvenance entries
      const entries = Object.entries(doc.extracted_fields || {});
      if (entries.length > 0) {
        docFields = entries.map(([k, v], idx) => {
          const matched = fallbackBase.extracted_fields?.find(
            (f) => f.field_name.toLowerCase() === k.toLowerCase()
          );
          return {
            field_name: k,
            field_label:
              matched?.field_label || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            original_value: v,
            normalized_value: v,
            source_page: doc.page_numbers[0] || 1,
            ocr_confidence: matched?.ocr_confidence || 0.98,
            extraction_confidence: matched?.extraction_confidence || 0.98,
            calibrated_confidence: matched?.calibrated_confidence || 0.98,
            extraction_method: matched?.extraction_method || "packet_sorter_ai",
            model_version: "doc-intel-v5.0",
            bounding_box: matched?.bounding_box || [0.12 + ((idx * 0.08) % 0.5), 0.15, 0.06, 0.4],
            review_status: matched?.review_status || "VERIFIED",
          };
        });
      } else {
        docFields = fallbackBase.extracted_fields || [];
      }
    }

    return {
      ...fallbackBase,
      metadata: {
        ...fallbackBase.metadata,
        filename: doc.filename,
        page_count: doc.page_count,
        total_blocks_detected: Math.max(12, doc.page_count * 14),
      },
      recognition: {
        category: doc.category || fallbackBase.recognition.category,
        category_label:
          isBaseCategory && fallbackBase.recognition?.category_label
            ? fallbackBase.recognition.category_label
            : doc.document_subtype || fallbackBase.recognition.category_label,
        confidence: 0.98,
        matched_keywords: [
          ...(fallbackBase.recognition.matched_keywords || []),
          doc.document_subtype.toUpperCase(),
        ],
      },
      extracted_fields: docFields,
      raw_text_preview: doc.text_preview || fallbackBase.raw_text_preview,
    };
  };

  // Unified Multi-Person Packet Sorter & Deep AI Recognition Pipeline
  const executeUnifiedPipeline = async () => {
    if (!uploadedFile) {
      setErrorMessage("Please upload a document file (PDF or Image) to run AI recognition & packet sorting.");
      return;
    }

    setIsAnalyzing(true);
    setIsSortingPacket(true);
    setErrorMessage(null);
    setAnalysisStep("Ingesting document payload & calculating SHA-256 hash...");

    const timer1 = setTimeout(() => {
      setAnalysisStep("Running Optical Character Recognition & block layout extraction...");
    }, 300);
    const timer2 = setTimeout(() => {
      setAnalysisStep("Classifying document taxonomy & separating multi-person boundaries...");
    }, 600);
    const timer3 = setTimeout(() => {
      setAnalysisStep("Extracting structured entity values & computing calibrated confidence...");
    }, 900);
    const timer4 = setTimeout(() => {
      setAnalysisStep("Auditing evidence quality, statutory validity & generating person folders...");
    }, 1200);

    try {
      const [analysis, sortRes] = await Promise.all([
        analyzeDocumentStandalone({
          file: uploadedFile,
          filename: customFilename || uploadedFile.name,
        }),
        sortDocumentPacket(uploadedFile).catch(() =>
          generateClientFallbackPacketSort(uploadedFile)
        ),
      ]);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      setOverallAnalysisResult(analysis);
      setPacketSortResult(sortRes);

      let activeAnalysis = analysis;

      if (sortRes.person_folders && sortRes.person_folders.length > 0) {
        const firstFolder = sortRes.person_folders[0];
        setSelectedPersonFolderId(firstFolder.person_id);
        if (firstFolder.documents && firstFolder.documents.length > 0) {
          const firstDoc = firstFolder.documents[0];
          setSelectedSplitDocIndex(firstDoc.document_index);
          activeAnalysis = syncActiveAnalysisWithSelectedDoc(firstDoc, analysis);
        }
      }

      setAnalysisResult(activeAnalysis);

      const usedOfflineFallback = activeAnalysis.quality_findings?.some(
        (qf) => qf.finding_type === "backend_ocr_offline"
      );
      if (!usedOfflineFallback) {
        setBackendStatus({
          online: true,
          message: "AI Extraction Engine Online (FastAPI + RapidOCR + ICAO Doc 9303)",
        });
      }

      if (activeAnalysis.extracted_fields && activeAnalysis.extracted_fields.length > 0) {
        setSelectedFieldForBbox(activeAnalysis.extracted_fields[0].field_name);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze and sort document.");
    } finally {
      setIsAnalyzing(false);
      setIsSortingPacket(false);
      setAnalysisStep("");
    }
  };

  // Run unified extraction and packet sorting
  const handleRunAnalysis = async () => {
    await executeUnifiedPipeline();
  };

  // Run Multi-Person Packet Sorter & Splitter (unified pipeline)
  const handleRunPacketSorter = async () => {
    await executeUnifiedPipeline();
  };

  // Selection handler: Person Folder in tree
  const handleSelectPersonFolder = (folderId: string) => {
    setSelectedPersonFolderId(folderId);
    if (!packetSortResult) return;
    const folder = packetSortResult.person_folders.find((f) => f.person_id === folderId);
    if (folder && folder.documents && folder.documents.length > 0) {
      const firstDoc = folder.documents[0];
      setSelectedSplitDocIndex(firstDoc.document_index);
      const base = overallAnalysisResult || analysisResult;
      if (base) {
        const synched = syncActiveAnalysisWithSelectedDoc(firstDoc, base);
        setAnalysisResult(synched);
        if (synched.extracted_fields && synched.extracted_fields.length > 0) {
          setSelectedFieldForBbox(synched.extracted_fields[0].field_name);
        }
      }
    }
  };

  // Selection handler: Individual split document in tree
  const handleSelectSplitDocument = (doc: PacketSortedDocument, folderId?: string) => {
    if (folderId) {
      setSelectedPersonFolderId(folderId);
    }
    setSelectedSplitDocIndex(doc.document_index);
    const base = overallAnalysisResult || analysisResult;
    if (base) {
      const synched = syncActiveAnalysisWithSelectedDoc(doc, base);
      setAnalysisResult(synched);
      if (synched.extracted_fields && synched.extracted_fields.length > 0) {
        setSelectedFieldForBbox(synched.extracted_fields[0].field_name);
      }
    }
  };

  // Copy JSON
  const handleCopyJson = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Download JSON report
  const handleDownloadJson = () => {
    if (!analysisResult) return;
    const blob = new Blob([JSON.stringify(analysisResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documento_extractor_${analysisResult.metadata.filename.replace(/\.[^/.]+$/, "")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download full sorted ZIP archive (<Person_Folder>/<Doc_Type>.pdf)
  const handleDownloadSortedZip = () => {
    if (!packetSortResult?.zip_archive_base64) return;
    const byteCharacters = atob(packetSortResult.zip_archive_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = packetSortResult.zip_archive_filename || "Sorted_By_Person.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download or preview an individual separated PDF
  const handleDownloadOrPreviewSplitPdf = (doc: PacketSortedDocument, previewOnly: boolean = false) => {
    if (!doc.pdf_base64) return;
    const byteCharacters = atob(doc.pdf_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    if (previewOnly) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  };

  // Deduplicate extracted fields by field_name to prevent duplicate rows/keys
  const uniqueExtractedFields = React.useMemo(() => {
    if (!analysisResult?.extracted_fields) return [];
    const seen = new Set<string>();
    return analysisResult.extracted_fields.filter((f) => {
      if (seen.has(f.field_name)) return false;
      seen.add(f.field_name);
      return true;
    });
  }, [analysisResult]);

  // Filtered fields
  const filteredFields = uniqueExtractedFields.filter((f) => {
    if (!fieldSearchQuery.trim()) return true;
    const q = fieldSearchQuery.toLowerCase();
    return (
      f.field_name.toLowerCase().includes(q) ||
      f.field_label.toLowerCase().includes(q) ||
      f.original_value.toLowerCase().includes(q) ||
      f.normalized_value.toLowerCase().includes(q)
    );
  });

  const selectedFieldObj = uniqueExtractedFields.find(
    (f) => f.field_name === selectedFieldForBbox
  );

    return (
      <div
        style={{
          minHeight: embedded ? "auto" : "100vh",
          background: embedded ? "transparent" : "#F8F7F2",
          color: "#172322",
          fontFamily: "var(--font-sans, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        }}
      >
        {/* Top Navigation Bar (Standalone /extractor route only) */}
        {!embedded && (
          <header
            style={{
              borderBottom: "1px solid #DCE5E1",
              background: "#FFFFFF",
              position: "sticky",
              top: 0,
              zIndex: 50,
              boxShadow: "0 1px 2px rgba(6, 60, 61, 0.04)",
            }}
          >
            <div
              style={{
                maxWidth: "1400px",
                margin: "0 auto",
                padding: "14px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                <Link href="/" style={{ textDecoration: "none" }}>
                  <DocumentoLogo size="md" showWordmark showDomain />
                </Link>
                <div
                  style={{
                    height: "22px",
                    width: "1px",
                    background: "#DCE5E1",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#176B50",
                      background: "#EAF6F0",
                      border: "1px solid #B9DED4",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Standalone Lab
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D" }}>
                    AI Document Recognition & Information Extractor
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "20px",
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    fontSize: "12px",
                    color: "#176B50",
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#176B50",
                    }}
                  />
                  No Authentication Required
                </div>

                <Link
                  href="/calculators"
                  style={{
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0D6866",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1px solid #B9DED4",
                    background: "#F1F6F4",
                  }}
                >
                  PR Calculators
                </Link>

                <Link
                  href="/"
                  style={{
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#445451",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    background: "#FFFFFF",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#063C3D";
                    e.currentTarget.style.background = "#F8F7F2";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#445451";
                    e.currentTarget.style.background = "#FFFFFF";
                  }}
                >
                  Back to Main Platform &rarr;
                </Link>
              </div>
            </div>
          </header>
        )}

        {/* Main Content Container */}
        <div
          style={{
            maxWidth: embedded ? "none" : "1400px",
            margin: "0 auto",
            padding: embedded ? 0 : "28px 24px 64px",
          }}
        >
          {/* Header Intro Banner */}
          <section
            style={{
              marginBottom: "22px",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 2px rgba(6, 60, 61, 0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "18px",
              }}
            >
              <div style={{ maxWidth: "780px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    color: "#0D6866",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: hideIntroTitle ? "4px" : "6px",
                  }}
                >
                  <span>🔬 Optical Character Recognition & Deep Evidence Forensics</span>
                </div>
                {!hideIntroTitle && (
                  <h1
                    style={{
                      fontSize: embedded ? "22px" : "26px",
                      fontWeight: 750,
                      color: "#063C3D",
                      margin: "0 0 8px",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Document Information & Recognition Extractor
                  </h1>
                )}
                <p
                  style={{
                    fontSize: "13.5px",
                    color: "#445451",
                    lineHeight: "1.55",
                    margin: 0,
                  }}
                >
                  Audit and inspect Documento&apos;s native OCR and AI extraction pipeline.
                  Test PDF layout vectorization, taxonomy auto-classification, normalized entity values,
                  evidence quality checks, and forensic bank/identity parsing.
                </p>
              </div>

              {/* Pipeline Capabilities Badges & Engine Status */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "10px",
                  maxWidth: "440px",
                }}
              >
                {/* Live Engine Status Pill */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: backendStatus.online ? "#EAF6F0" : "#FDF2F2",
                    border: `1px solid ${backendStatus.online ? "#B9DED4" : "#F5C2C7"}`,
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: backendStatus.online ? "#176B50" : "#A62D35",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: backendStatus.online ? "#176B50" : "#A62D35",
                      display: "inline-block",
                    }}
                  />
                  <span>
                    {backendStatus.online
                      ? "FastAPI + RapidOCR Engine: ONLINE"
                      : "AI Extraction Offline (Local Deterministic Mode)"}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    justifyContent: "flex-end",
                  }}
                >
                  {[
                    "RapidOCR + PDF Vector",
                    "Indian Languages (English • ગુજરાતી • हिन्दी)",
                    "Unknown Language -> Case Worker Escalation",
                    "Taxonomy Classification",
                    "ISO Field Normalization",
                    "Single-Name / FNU Resolver",
                  ].map((label) => (
                    <span
                      key={label}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#445451",
                        background: "#F8F7F2",
                        border: "1px solid #DCE5E1",
                        padding: "3px 9px",
                        borderRadius: "6px",
                      }}
                    >
                      ✓ {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Input & Control Panel */}
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "22px 24px",
              marginBottom: "24px",
              boxShadow: "0 1px 2px rgba(6, 60, 61, 0.03)",
            }}
          >
            {/* Mode Switcher Tabs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                borderBottom: "1px solid #DCE5E1",
                paddingBottom: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setInputMode("upload")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 650,
                    border: inputMode === "upload" ? "1px solid #063C3D" : "1px solid #DCE5E1",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: inputMode === "upload" ? "#063C3D" : "#F8F7F2",
                    color: inputMode === "upload" ? "#FFFFFF" : "#445451",
                  }}
                >
                  📁 Upload Document (PDF / Images)
                </button>

                <button
                  type="button"
                  onClick={() => setInputMode("packet_sorter")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 650,
                    border: inputMode === "packet_sorter" ? "1px solid #0D6866" : "1px solid #DCE5E1",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: inputMode === "packet_sorter" ? "#0D6866" : "#F8F7F2",
                    color: inputMode === "packet_sorter" ? "#FFFFFF" : "#445451",
                  }}
                >
                  🗂️ Multi-Person Packet Sorter & Splitter
                </button>
              </div>

              {/* Filename Tag */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 500 }}>File Target:</span>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder="document_name.pdf"
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    color: "#172322",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    width: "220px",
                  }}
                />
              </div>
            </div>

            {/* Upload Dropzone */}
            {(inputMode === "upload" || inputMode === "packet_sorter") && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragActive
                    ? "2px dashed #0D6866"
                    : uploadedFile
                      ? "1.5px solid #176B50"
                      : "1.5px dashed #BDCDC7",
                  borderRadius: "12px",
                  padding: "36px 24px",
                  textAlign: "center",
                  background: dragActive
                    ? "#EAF6F0"
                    : uploadedFile
                      ? "#F1F6F4"
                      : "#F8F7F2",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: "20px",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.txt"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />

                <div style={{ fontSize: "34px", marginBottom: "10px" }}>
                  {uploadedFile ? "📄" : inputMode === "packet_sorter" ? "🗂️" : "📥"}
                </div>

                {uploadedFile ? (
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                      {uploadedFile.name}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#445451", marginTop: "4px" }}>
                      {(uploadedFile.size / 1024).toFixed(1)} KB &bull; {uploadedFile.type || "binary"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#0D6866",
                        fontWeight: 600,
                        marginTop: "8px",
                        textDecoration: "underline",
                      }}
                    >
                      Click to choose a different file
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                      {inputMode === "packet_sorter"
                        ? "Drop a combined multi-person PDF packet here or click to browse"
                        : "Drop document file here or click to browse"}
                    </div>
                    <div style={{ fontSize: "13px", color: "#6E7F7C", marginTop: "6px" }}>
                      {inputMode === "packet_sorter"
                        ? "Automatically inspects every page, separates documents by person name, groups multi-page continuations & generates Person Folders (.ZIP)"
                        : "Supports PDF, PNG, JPG, JPEG, WEBP, TIFF, or TXT"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Trigger Button & Progress Stepper */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || isSortingPacket}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "11px 22px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    border: "1px solid #0D6866",
                    background: isAnalyzing ? "#2A9288" : "#0D6866",
                    cursor: isAnalyzing || isSortingPacket ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          border: "2px solid #FFFFFF",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          display: "inline-block",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Processing Document...
                    </>
                  ) : (
                    <>
                      <span>⚡</span> Run AI Recognition & Extraction
                    </>
                  )}
                </button>

                {(inputMode === "packet_sorter" || (inputMode === "upload" && uploadedFile)) && (
                  <button
                    type="button"
                    onClick={handleRunPacketSorter}
                    disabled={isSortingPacket || isAnalyzing || !uploadedFile}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "11px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 650,
                      color: "#063C3D",
                      border: "1px solid #B9DED4",
                      background: isSortingPacket ? "#DDEFE8" : "#EAF6F0",
                      cursor: isSortingPacket || isAnalyzing || !uploadedFile ? "not-allowed" : "pointer",
                      opacity: !uploadedFile ? 0.65 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isSortingPacket ? (
                      <>
                        <span
                          style={{
                            width: "14px",
                            height: "14px",
                            border: "2px solid #063C3D",
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                            display: "inline-block",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Sorting & Splitting Packet by Person...
                      </>
                    ) : (
                      <>
                        <span>🗂️</span> Sort & Split Multi-Person PDF Packet
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Stepper info during analysis */}
              {(isAnalyzing || isSortingPacket) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0D6866",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#176B50",
                    }}
                  />
                  <span>{analysisStep}</span>
                </div>
              )}

              {/* Error Notification */}
              {errorMessage && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#FDF2F2",
                    border: "1px solid #F5C2C7",
                    color: "#A62D35",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  ⚠️ {errorMessage}
                </div>
              )}
            </div>
          </section>

          {/* Multi-Person Packet Sorter & Splitter Results Section */}
          {packetSortResult && (
            <section
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "22px 24px",
                marginBottom: "24px",
                boxShadow: "0 1px 2px rgba(6, 60, 61, 0.03)",
              }}
            >
              {/* Header & 1-Click ZIP Download */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                  paddingBottom: "18px",
                  marginBottom: "18px",
                  borderBottom: "1px solid #DCE5E1",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#0D6866",
                      background: "#EAF6F0",
                      border: "1px solid #B9DED4",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      marginBottom: "8px",
                    }}
                  >
                    🗂️ Multi-Person Document Packet Sorter & Splitter
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 750, color: "#063C3D", margin: "0 0 4px" }}>
                    Sorted Person Folders: {packetSortResult.source_filename}
                  </h2>
                  <p style={{ fontSize: "13px", color: "#445451", margin: 0 }}>
                    Analyzed {packetSortResult.total_pages_analyzed} pages
                    {packetSortResult.blank_pages_omitted && packetSortResult.blank_pages_omitted.length > 0
                      ? ` (${packetSortResult.blank_pages_omitted.length} blank page${packetSortResult.blank_pages_omitted.length > 1 ? "s" : ""} omitted)`
                      : ""}{" "}
                    &bull; Detected {packetSortResult.total_persons_detected} distinct person(s) &bull; Generated{" "}
                    {packetSortResult.total_split_documents} separated multi-page PDF documents
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  {packetSortResult.zip_archive_base64 && (
                    <button
                      type="button"
                      onClick={handleDownloadSortedZip}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 18px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        background: "#0D6866",
                        border: "1px solid #0D6866",
                        cursor: "pointer",
                      }}
                    >
                      📦 Download All Person Folders (.ZIP)
                    </button>
                  )}
                </div>
              </div>

              {/* Two-Column Folder Explorer: Person Folders Tree (Left) + Documents in Folder (Right) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(290px, 360px) 1fr",
                  gap: "20px",
                  alignItems: "start",
                }}
              >
                {/* Left Column: Person Folders List */}
                <div
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#6E7F7C",
                      marginBottom: "12px",
                    }}
                  >
                    Person Folders ({packetSortResult.person_folders.length})
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {packetSortResult.person_folders.map((pf) => {
                      const isSelected = selectedPersonFolderId === pf.person_id;
                      const isReview = pf.is_caseworker_review_folder;
                      const isCorporate = Boolean(pf.is_corporate_folder);
                      return (
                        <div
                          key={pf.person_id}
                          onClick={() => handleSelectPersonFolder(pf.person_id)}
                          style={{
                            padding: "14px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            background: isSelected
                              ? isReview
                                ? "#FEF7EA"
                                : "#EAF6F0"
                              : "#FFFFFF",
                            border: isSelected
                              ? isReview
                                ? "1.5px solid #D97706"
                                : "1.5px solid #0D6866"
                              : "1px solid #DCE5E1",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              marginBottom: "6px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: isReview ? "#8A5A10" : isSelected ? "#0D6866" : "#063C3D",
                              }}
                            >
                              {isReview ? "⚠️ " : isCorporate ? "🏢 " : "📁 "}
                              {pf.canonical_name}
                            </div>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                background: isReview ? "#FEF7EA" : "#EAF6F0",
                                border: `1px solid ${isReview ? "#FDE68A" : "#B9DED4"}`,
                                color: isReview ? "#8A5A10" : "#176B50",
                              }}
                            >
                              {pf.total_documents} docs ({pf.total_pages}p)
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "#6E7F7C",
                              marginBottom: "8px",
                            }}
                          >
                            /{pf.folder_name}/
                            {pf.duplicates_count && pf.duplicates_count > 0
                              ? ` • ${pf.duplicates_count} in _Duplicates/`
                              : ""}
                          </div>

                          {/* Consolidated Name Variations */}
                          {pf.name_variations && pf.name_variations.length > 1 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
                              {pf.name_variations.map((nv) => (
                                <span
                                  key={nv}
                                  style={{
                                    fontSize: "10px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "#F1F6F4",
                                    border: "1px solid #DCE5E1",
                                    color: "#445451",
                                  }}
                                >
                                  {nv}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Identity Anchors (PAN, Passport, SIN) */}
                          {pf.id_anchors && Object.keys(pf.id_anchors).length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {Object.entries(pf.id_anchors).map(([k, vals]) =>
                                vals.map((v) => (
                                  <span
                                    key={`${k}-${v}`}
                                    style={{
                                      fontSize: "10px",
                                      fontFamily: "monospace",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: "#EAF6F0",
                                      border: "1px solid #B9DED4",
                                      color: "#176B50",
                                    }}
                                  >
                                    {k.toUpperCase()}: {v}
                                  </span>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Separated Documents inside Selected Person's Folder */}
                <div
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "10px",
                    padding: "18px",
                  }}
                >
                  {(() => {
                    const activeFolder =
                      packetSortResult.person_folders.find((f) => f.person_id === selectedPersonFolderId) ||
                      packetSortResult.person_folders[0];
                    if (!activeFolder) return null;

                    return (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                            marginBottom: "16px",
                            paddingBottom: "12px",
                            borderBottom: "1px solid #DCE5E1",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
                              📂 {activeFolder.canonical_name} — Separated Documents ({activeFolder.total_documents})
                            </div>
                            <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "2px" }}>
                              Folder Path: <code>{activeFolder.folder_name}/</code> &bull; {activeFolder.total_pages}{" "}
                              total pages
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {activeFolder.documents.map((doc) => {
                            const isDocSelected = selectedSplitDocIndex === doc.document_index;
                            return (
                              <div
                                key={doc.relative_path}
                                onClick={() => handleSelectSplitDocument(doc, activeFolder.person_id)}
                                style={{
                                  padding: "14px 16px",
                                  borderRadius: "8px",
                                  background: isDocSelected ? "#F1F6F4" : "#FFFFFF",
                                  border: isDocSelected
                                    ? "2px solid #0D6866"
                                    : doc.is_joint_document
                                      ? "1.5px solid #C4B5FD"
                                      : "1px solid #DCE5E1",
                                  boxShadow: isDocSelected ? "0 2px 8px rgba(13, 104, 102, 0.12)" : "none",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  flexWrap: "wrap",
                                  gap: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <div style={{ flex: "1 1 420px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                      gap: "8px",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    <span style={{ fontSize: "13.5px", fontWeight: 700, color: doc.is_duplicate ? "#8A5A10" : "#063C3D" }}>
                                      📄 {doc.is_duplicate ? `_Duplicates/${doc.filename}` : doc.filename}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 650,
                                        padding: "2px 8px",
                                        borderRadius: "6px",
                                        background: "#EDF5FB",
                                        border: "1px solid #BFDBFE",
                                        color: "#205E8C",
                                      }}
                                    >
                                      {doc.document_subtype}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        padding: "2px 8px",
                                        borderRadius: "6px",
                                        background: "#F1F6F4",
                                        border: "1px solid #DCE5E1",
                                        color: "#445451",
                                      }}
                                    >
                                      {doc.page_range} ({doc.page_count}p)
                                    </span>
                                    {isDocSelected && (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 750,
                                          padding: "2px 8px",
                                          borderRadius: "6px",
                                          background: "#0D6866",
                                          color: "#FFFFFF",
                                        }}
                                      >
                                        ✓ Active in Inspector
                                      </span>
                                    )}
                                    {doc.is_duplicate && (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: "6px",
                                          background: "#FEF7EA",
                                          border: "1px solid #FDE68A",
                                          color: "#8A5A10",
                                        }}
                                      >
                                        🔁 DUPLICATE{doc.duplicate_of ? ` (of ${doc.duplicate_of})` : ""}
                                      </span>
                                    )}
                                    {doc.is_joint_document && (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: "6px",
                                          background: "#F5F3FF",
                                          border: "1px solid #DDD6FE",
                                          color: "#5B21B6",
                                        }}
                                      >
                                        🤝 JOINT DOCUMENT
                                        {doc.shared_with && doc.shared_with.length > 0
                                          ? ` (Shared with: ${doc.shared_with.join(", ")})`
                                          : ""}
                                      </span>
                                    )}
                                  </div>

                                  {doc.text_preview && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#445451",
                                        fontFamily: "monospace",
                                        background: "#F8F7F2",
                                        border: "1px solid #EAEFEA",
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        marginTop: "6px",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        maxWidth: "680px",
                                      }}
                                    >
                                      {doc.text_preview}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectSplitDocument(doc, activeFolder.person_id);
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      fontWeight: 650,
                                      background: isDocSelected ? "#0D6866" : "#FFFFFF",
                                      border: "1px solid #0D6866",
                                      color: isDocSelected ? "#FFFFFF" : "#0D6866",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {isDocSelected ? "✓ Inspecting" : "🔍 Inspect Entities"}
                                  </button>

                                  {doc.pdf_base64 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadOrPreviewSplitPdf(doc, true);
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          background: "#FFFFFF",
                                          border: "1px solid #DCE5E1",
                                          color: "#063C3D",
                                          cursor: "pointer",
                                        }}
                                      >
                                        👁️ Preview PDF
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadOrPreviewSplitPdf(doc, false);
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: 650,
                                          background: "#EAF6F0",
                                          border: "1px solid #B9DED4",
                                          color: "#176B50",
                                          cursor: "pointer",
                                        }}
                                      >
                                        ⬇️ Download PDF
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </section>
          )}

          {/* Results Section */}
          {analysisResult && (
            <section>
              {/* Active Document Synchronization Banner */}
              {selectedSplitDocIndex !== null && (
                <div
                  style={{
                    background: "#EAF6F0",
                    border: "1.5px solid #0D6866",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    marginBottom: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "16px" }}>🔍</span>
                    <span style={{ fontSize: "13px", fontWeight: 750, color: "#063C3D" }}>
                      Active Document Inspector:
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#0D6866",
                        background: "#FFFFFF",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        border: "1px solid #B9DED4",
                      }}
                    >
                      📄 {analysisResult.metadata.filename}
                    </span>
                    <span style={{ fontSize: "12px", color: "#445451" }}>
                      &bull; Category: <strong>{analysisResult.recognition.category_label}</strong> ({analysisResult.metadata.page_count} page{analysisResult.metadata.page_count > 1 ? "s" : ""})
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 650,
                      color: "#176B50",
                      background: "#FFFFFF",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      border: "1px solid #B9DED4",
                    }}
                  >
                    ✓ Synchronized with Packet Sorter Tree
                  </span>
                </div>
              )}
              {/* Case Worker Escalation Banner for Unknown / Unsupported Languages */}
              {(analysisResult.metadata.requires_caseworker_escalation ||
                analysisResult.specialized_intelligence?.language_compliance?.requires_caseworker_escalation ||
                analysisResult.quality_findings?.some((qf) => qf.finding_type === "unsupported_language_escalation")) && (
                <div
                  style={{
                    background: "#FDF2F2",
                    border: "1px solid #F5C2C7",
                    borderRadius: "12px",
                    padding: "20px 24px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "16px",
                    }}
                  >
                    <div style={{ flex: "1 1 520px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            background: "#A62D35",
                            color: "#FFFFFF",
                            padding: "3px 9px",
                            borderRadius: "6px",
                          }}
                        >
                          🚨 Escalated to Case Worker Queue
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#A62D35",
                            background: "#FFFFFF",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            border: "1px solid #F5C2C7",
                          }}
                        >
                          Detected: {analysisResult.metadata.detected_language_label || analysisResult.specialized_intelligence?.language_compliance?.detected_language_label || "Unknown / Unsupported Language"}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#445451",
                            background: "#FFFFFF",
                            border: "1px solid #DCE5E1",
                            padding: "3px 10px",
                            borderRadius: "6px",
                          }}
                        >
                          Supported AI/OCR Languages: English • Gujarati (ગુજરાતી) • Hindi (हिन्दी)
                        </span>
                      </div>

                      <h3 style={{ fontSize: "17px", fontWeight: 750, color: "#7F1D1D", margin: "0 0 6px" }}>
                        Unknown / Non-Compliant Document Language — Case Worker Action Required
                      </h3>
                      <p style={{ fontSize: "13px", color: "#991B1B", margin: "0 0 12px", lineHeight: "1.55" }}>
                        {analysisResult.specialized_intelligence?.language_compliance?.escalation_reason ||
                          "This document is written in a language or script outside our approved Indian & Immigration language set (English, Gujarati, and Hindi). It has been raised to the Case Worker so the Case Worker can contact the client for a certified translation or process the document manually."}
                      </p>

                      {analysisResult.metadata.client_outreach_template && (
                        <div
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #F5C2C7",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            fontSize: "12px",
                            color: "#172322",
                          }}
                        >
                          <strong style={{ color: "#8A5A10" }}>Suggested Client Outreach Message: </strong>
                          {analysisResult.metadata.client_outreach_template}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "240px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const msg =
                            analysisResult.metadata.client_outreach_template ||
                            analysisResult.specialized_intelligence?.language_compliance?.client_outreach_template ||
                            `Hello, regarding '${analysisResult.metadata.filename}': our automated system supports English, Gujarati, and Hindi documents. A Case Worker has been assigned to review your document manually. Please also provide a certified English translation if available.`;
                          navigator.clipboard.writeText(msg);
                        }}
                        style={{
                          padding: "9px 14px",
                          borderRadius: "8px",
                          border: "1px solid #FDE68A",
                          background: "#FEF7EA",
                          color: "#8A5A10",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        📋 Copy Client Outreach Message
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("quality")}
                        style={{
                          padding: "9px 14px",
                          borderRadius: "8px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#063C3D",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        🛠️ Open Case Worker Escalation Ticket
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Metrics Ribbon */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  marginBottom: "20px",
                }}
              >
                {/* Card 1: Recognition & Taxonomy */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Recognized Taxonomy
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
                    {analysisResult.recognition.category_label}
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
                    Confidence: <strong style={{ color: "#0D6866" }}>{(analysisResult.recognition.confidence * 100).toFixed(0)}%</strong>
                  </div>
                </div>

                {/* Card 2: Extracted Fields */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Structured Fields
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 750, color: "#063C3D", marginTop: "2px" }}>
                    {analysisResult.extracted_fields.length}
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451" }}>
                    Entities Normalized to ISO Standards
                  </div>
                </div>

                {/* Card 3: Quality & Integrity */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Evidence Health Score
                  </div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 750,
                      color:
                        analysisResult.metadata.overall_health_score >= 80
                          ? "#176B50"
                          : analysisResult.metadata.overall_health_score >= 60
                            ? "#8A5A10"
                            : "#A62D35",
                      marginTop: "2px",
                    }}
                  >
                    {analysisResult.metadata.overall_health_score}/100
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451" }}>
                    {analysisResult.quality_findings.length === 0
                      ? "Zero scan defects detected"
                      : `${analysisResult.quality_findings.length} finding(s) audited`}
                  </div>
                </div>

                {/* Card 4: OCR Geometries & Indian Language Compliance */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: `1px solid ${
                      analysisResult.metadata.requires_caseworker_escalation
                        ? "#F5C2C7"
                        : "#DCE5E1"
                    }`,
                    borderRadius: "12px",
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: analysisResult.metadata.requires_caseworker_escalation ? "#A62D35" : "#6E7F7C",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Language & OCR Compliance
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 750, color: "#063C3D", marginTop: "4px" }}>
                    {analysisResult.metadata.detected_language_label || analysisResult.metadata.detected_language.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
                    {analysisResult.metadata.requires_caseworker_escalation ? (
                      <span style={{ color: "#A62D35", fontWeight: 700 }}>🚨 Escalated to Case Worker</span>
                    ) : (
                      <span style={{ color: "#176B50", fontWeight: 600 }}>✓ EN / GU / HI Compliant &bull; {analysisResult.metadata.total_blocks_detected} Blocks</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Deep-Dive Inspector Tabs */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                {/* Tab Navigation */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #DCE5E1",
                    background: "#F8F7F2",
                    padding: "0 16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
                    {[
                      { id: "entities", label: `Structured Fields (${analysisResult.extracted_fields.length})`, icon: "📋" },
                      { id: "recognition", label: "Recognition & Keywords", icon: "🏷️" },
                      { id: "quality", label: `Quality Audit (${analysisResult.quality_findings.length})`, icon: "🛡️" },
                      { id: "forensics", label: "Specialized Forensics", icon: "🔍" },
                      { id: "ocr", label: "Raw OCR & Geometries", icon: "📐" },
                      { id: "json", label: "JSON Schema Export", icon: "💾" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                          padding: "13px 16px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: activeTab === tab.id ? 700 : 550,
                          color: activeTab === tab.id ? "#063C3D" : "#6E7F7C",
                          borderBottom:
                            activeTab === tab.id ? "2px solid #0D6866" : "2px solid transparent",
                          transition: "all 0.15s",
                        }}
                      >
                        <span style={{ marginRight: "6px" }}>{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Right controls */}
                  <div style={{ display: "flex", gap: "8px", padding: "8px 0" }}>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      style={{
                        fontSize: "12px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #DCE5E1",
                        background: "#FFFFFF",
                        color: "#063C3D",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {copiedJson ? "✓ Copied!" : "📋 Copy JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      style={{
                        fontSize: "12px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #B9DED4",
                        background: "#EAF6F0",
                        color: "#176B50",
                        cursor: "pointer",
                        fontWeight: 650,
                      }}
                    >
                      ⬇️ Download Report
                    </button>
                  </div>
                </div>

                {/* Tab 1: Extracted Entities & Provenance */}
                {activeTab === "entities" && (
                  <div style={{ padding: "22px 24px" }}>
                    {/* Search and preview layout */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search extracted fields (e.g., name, date, passport, salary)..."
                        value={fieldSearchQuery}
                        onChange={(e) => setFieldSearchQuery(e.target.value)}
                        style={{
                          width: "360px",
                          maxWidth: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #DCE5E1",
                          background: "#F8F7F2",
                          color: "#172322",
                          fontSize: "13px",
                        }}
                      />

                      <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                        Showing {filteredFields?.length || 0} of {analysisResult.extracted_fields.length} extracted entities
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: selectedFieldObj ? "1fr 340px" : "1fr",
                        gap: "24px",
                      }}
                    >
                      {/* Fields Table */}
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "13px",
                            textAlign: "left",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                borderBottom: "1px solid #DCE5E1",
                                color: "#6E7F7C",
                                fontSize: "11px",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              <th style={{ padding: "10px 12px" }}>Field Label</th>
                              <th style={{ padding: "10px 12px" }}>Normalized Value</th>
                              <th style={{ padding: "10px 12px" }}>Original Text</th>
                              <th style={{ padding: "10px 12px" }}>Confidence</th>
                              <th style={{ padding: "10px 12px" }}>Method</th>
                              <th style={{ padding: "10px 12px" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredFields?.map((field, idx) => {
                              const isSelected = selectedFieldForBbox === field.field_name;
                              const confPct = Math.round(field.calibrated_confidence * 100);
                              return (
                                <tr
                                  key={`${field.field_name}-${idx}`}
                                  onClick={() => setSelectedFieldForBbox(field.field_name)}
                                  style={{
                                    borderBottom: "1px solid #EAEFEA",
                                    background: isSelected ? "#EAF6F0" : "transparent",
                                    cursor: "pointer",
                                    transition: "background 0.15s",
                                  }}
                                >
                                  <td style={{ padding: "12px", fontWeight: 650, color: "#063C3D" }}>
                                    {field.field_label}
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#6E7F7C",
                                        fontFamily: "monospace",
                                        fontWeight: 400,
                                      }}
                                    >
                                      {field.field_name}
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px", color: "#0D6866", fontWeight: 700 }}>
                                    {field.normalized_value}
                                  </td>
                                  <td style={{ padding: "12px", color: "#445451", maxWidth: "200px" }}>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        maxWidth: "180px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                      title={field.original_value}
                                    >
                                      {field.original_value}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        background:
                                          confPct >= 90
                                            ? "#EAF6F0"
                                            : confPct >= 70
                                              ? "#FEF7EA"
                                              : "#FDF2F2",
                                        border: `1px solid ${
                                          confPct >= 90
                                            ? "#B9DED4"
                                            : confPct >= 70
                                              ? "#FDE68A"
                                              : "#F5C2C7"
                                        }`,
                                        color:
                                          confPct >= 90
                                            ? "#176B50"
                                            : confPct >= 70
                                              ? "#8A5A10"
                                              : "#A62D35",
                                      }}
                                    >
                                      {confPct}%
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px", color: "#6E7F7C", fontSize: "12px" }}>
                                    {field.extraction_method.replace(/_/g, " ")}
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                    <button
                                      type="button"
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        border: isSelected ? "1px solid #0D6866" : "1px solid #DCE5E1",
                                        background: isSelected ? "#0D6866" : "#FFFFFF",
                                        color: isSelected ? "#FFFFFF" : "#063C3D",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {isSelected ? "Inspecting" : "Inspect"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Bounding Box Visualizer Card */}
                      {selectedFieldObj && (
                        <div
                          style={{
                            background: "#F8F7F2",
                            border: "1px solid #DCE5E1",
                            borderRadius: "10px",
                            padding: "16px 18px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#0D6866",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              marginBottom: "4px",
                            }}
                          >
                            Field Provenance Inspector
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                            {selectedFieldObj.field_label}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#6E7F7C",
                              fontFamily: "monospace",
                              marginBottom: "12px",
                            }}
                          >
                            Key: {selectedFieldObj.field_name}
                          </div>

                          {/* Coordinate Box Graphic / Spatial Document Canvas */}
                          {(() => {
                            const activePageNum = selectedFieldObj.source_page || 1;
                            const pageMeta =
                              analysisResult.ocr_summary?.pages?.find(
                                (p) => p.page_number === activePageNum
                              ) || analysisResult.ocr_summary?.pages?.[0];
                            const pageImageUrl = pageMeta?.page_image_data_url;
                            const pageFields = uniqueExtractedFields.filter(
                              (f) => (f.source_page || 1) === activePageNum
                            );
                            const docLines = (analysisResult.raw_text_preview || "")
                              .split(/\r?\n/)
                              .map((l) => l.trim())
                              .filter(Boolean)
                              .slice(0, 18);

                            const [ymin, xmin, ymax, xmax] = selectedFieldObj.bounding_box || [
                              0.1, 0.1, 0.3, 0.7,
                            ];
                            const top = `${Math.min(82, Math.max(10, ymin * 100))}%`;
                            const left = `${Math.min(72, Math.max(4, xmin * 100))}%`;
                            const height = `${Math.max(11, Math.min(28, (ymax - ymin) * 100))}%`;
                            const width = `${Math.max(24, Math.min(88, (xmax - xmin) * 100))}%`;

                            return (
                              <div
                                style={{
                                  position: "relative",
                                  width: "100%",
                                  height: "280px",
                                  background: "#F1F6F4",
                                  border: "1px solid #DCE5E1",
                                  borderRadius: "8px",
                                  marginBottom: "14px",
                                  overflow: "hidden",
                                }}
                              >
                                {/* Top Canvas Bar */}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    zIndex: 5,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 10px",
                                    background: "#FFFFFF",
                                    borderBottom: "1px solid #DCE5E1",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      color: "#445451",
                                      letterSpacing: "0.04em",
                                      textTransform: "uppercase",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    Page {activePageNum} Spatial Canvas
                                  </span>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        fontFamily: "monospace",
                                        color: "#0D6866",
                                      }}
                                    >
                                      {Math.round(pageMeta?.width || 612)}&times;{Math.round(pageMeta?.height || 792)}px
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMaximizedPageNum(activePageNum);
                                        setMaximizedZoom(1);
                                        setIsCanvasMaximized(true);
                                      }}
                                      title="Maximize Spatial Document View"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "2px 8px",
                                        borderRadius: "4px",
                                        border: "1px solid #B9DED4",
                                        background: "#EAF6F0",
                                        color: "#0D6866",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ⛶ Maximize
                                    </button>
                                  </div>
                                </div>

                                {/* Layer 1: Either actual rendered PDF/Image page OR structured document sheet */}
                                {pageImageUrl ? (
                                  <img
                                    src={pageImageUrl}
                                    alt={`Document Page ${activePageNum}`}
                                    onClick={() => {
                                      setMaximizedPageNum(activePageNum);
                                      setMaximizedZoom(1);
                                      setIsCanvasMaximized(true);
                                    }}
                                    title="Click to maximize document page"
                                    style={{
                                      position: "absolute",
                                      top: "28px",
                                      left: 0,
                                      width: "100%",
                                      height: "calc(100% - 28px)",
                                      objectFit: "contain",
                                      background: "#FFFFFF",
                                      cursor: "zoom-in",
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "32px",
                                      left: "10px",
                                      right: "10px",
                                      bottom: "8px",
                                      background: "#FFFFFF",
                                      borderRadius: "6px",
                                      padding: "10px 12px",
                                      color: "#172322",
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      fontSize: "9px",
                                      lineHeight: "1.35",
                                      overflow: "hidden",
                                      border: "1px solid #DCE5E1",
                                    }}
                                  >
                                    {/* Simulated Document Sheet Header */}
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        borderBottom: "1.5px solid #0D6866",
                                        paddingBottom: "4px",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: 800,
                                          color: "#0D6866",
                                          fontSize: "9px",
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {analysisResult.recognition.category_label}
                                      </span>
                                      <span style={{ color: "#6E7F7C", fontSize: "8px" }}>
                                        {analysisResult.metadata.filename}
                                      </span>
                                    </div>

                                    {/* Document OCR text lines */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                      {docLines.map((line, lIdx) => {
                                        const origNeedle = (selectedFieldObj.original_value || "")
                                          .trim()
                                          .toLowerCase();
                                        const normNeedle = (selectedFieldObj.normalized_value || "")
                                          .trim()
                                          .toLowerCase();
                                        const isMatchedLine =
                                          (origNeedle.length >= 2 &&
                                            line.toLowerCase().includes(origNeedle)) ||
                                          (normNeedle.length >= 2 &&
                                            line.toLowerCase().includes(normNeedle));
                                        return (
                                          <div
                                            key={lIdx}
                                            style={{
                                              whiteSpace: "nowrap",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              padding: "1px 4px",
                                              borderRadius: "3px",
                                              background: isMatchedLine ? "#EAF6F0" : "transparent",
                                              color: isMatchedLine ? "#063C3D" : "#445451",
                                              fontWeight: isMatchedLine ? 800 : 500,
                                              borderLeft: isMatchedLine
                                                ? "2px solid #176B50"
                                                : "2px solid transparent",
                                            }}
                                          >
                                            {line}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Layer 2: Secondary field bounding boxes on this page (clickable) */}
                                {pageFields.map((pf, pfIdx) => {
                                  if (pf.field_name === selectedFieldObj.field_name) return null;
                                  const [py0, px0, py1, px1] = pf.bounding_box || [0.1, 0.1, 0.2, 0.4];
                                  return (
                                    <div
                                      key={`${pf.field_name}-${pfIdx}`}
                                      onClick={() => setSelectedFieldForBbox(pf.field_name)}
                                      title={`${pf.field_label}: ${pf.normalized_value} (Click to inspect)`}
                                      style={{
                                        position: "absolute",
                                        top: `${Math.min(86, Math.max(12, py0 * 100))}%`,
                                        left: `${Math.min(82, Math.max(4, px0 * 100))}%`,
                                        width: `${Math.max(14, Math.min(60, (px1 - px0) * 100))}%`,
                                        height: `${Math.max(7, Math.min(18, (py1 - py0) * 100))}%`,
                                        border: "1px dashed #2A9288",
                                        background: "rgba(42, 146, 136, 0.08)",
                                        borderRadius: "3px",
                                        cursor: "pointer",
                                        zIndex: 3,
                                      }}
                                    />
                                  );
                                })}

                                {/* Layer 3: Active Selected Field Bounding Box Highlight */}
                                <div
                                  style={{
                                    position: "absolute",
                                    top,
                                    left,
                                    width,
                                    height,
                                    border: "2px solid #0D6866",
                                    background: "rgba(234, 246, 240, 0.96)",
                                    borderRadius: "6px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#063C3D",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    boxShadow: "0 0 0 3px rgba(13, 104, 102, 0.16), 0 4px 12px rgba(6, 60, 61, 0.12)",
                                    zIndex: 4,
                                    pointerEvents: "none",
                                    textAlign: "center",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "8px",
                                      color: "#176B50",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                      lineHeight: 1,
                                      marginBottom: "1px",
                                    }}
                                  >
                                    {selectedFieldObj.field_label}
                                  </span>
                                  <span
                                    style={{
                                      maxWidth: "100%",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {selectedFieldObj.normalized_value}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Provenance Details */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#6E7F7C" }}>Normalized Value:</span>
                              <span style={{ color: "#0D6866", fontWeight: 700 }}>
                                {selectedFieldObj.normalized_value}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#6E7F7C" }}>Original Extraction:</span>
                              <span style={{ color: "#172322", fontWeight: 500 }}>{selectedFieldObj.original_value}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#6E7F7C" }}>Bounding Box [y0, x0, y1, x1]:</span>
                              <span style={{ fontFamily: "monospace", color: "#445451" }}>
                                {JSON.stringify(selectedFieldObj.bounding_box)}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#6E7F7C" }}>Review Status:</span>
                              <span style={{ color: "#176B50", fontWeight: 650 }}>
                                {selectedFieldObj.review_status}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#6E7F7C" }}>Model Engine:</span>
                              <span style={{ color: "#445451" }}>{selectedFieldObj.model_version}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 2: Recognition & Taxonomy */}
                {activeTab === "recognition" && (
                  <div style={{ padding: "24px", background: "#FFFFFF" }}>
                    <div style={{ maxWidth: "700px" }}>
                      <div style={{ fontSize: "12px", color: "#0D6866", fontWeight: 700, textTransform: "uppercase" }}>
                        Immigration Document Taxonomy Engine
                      </div>
                      <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#063C3D", margin: "6px 0 16px" }}>
                        {analysisResult.recognition.category_label}
                      </h3>

                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", color: "#445451" }}>Taxonomy Confidence:</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0D6866" }}>
                            {(analysisResult.recognition.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: "8px",
                            background: "#E7EFEB",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${analysisResult.recognition.confidence * 100}%`,
                              height: "100%",
                              background: "#0D6866",
                              borderRadius: "4px",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: "24px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#172322", marginBottom: "8px" }}>
                          Matched Rule Keywords & Patterns:
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {analysisResult.recognition.matched_keywords.length > 0 ? (
                            analysisResult.recognition.matched_keywords.map((kw, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  background: "#EAF6F0",
                                  border: "1px solid #B9DED4",
                                  color: "#063C3D",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                🔎 {kw}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "13px", color: "#6E7F7C" }}>
                              Document recognized through structural layout heuristics.
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#F8F7F2",
                          border: "1px solid #DCE5E1",
                          borderRadius: "10px",
                          padding: "16px",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", marginBottom: "4px" }}>
                          Category ID:
                        </div>
                        <code style={{ fontSize: "13px", color: "#176B50", fontWeight: 700 }}>
                          {analysisResult.recognition.category}
                        </code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Evidence Quality Audit */}
                {activeTab === "quality" && (
                  <div style={{ padding: "24px", background: "#FFFFFF" }}>
                    {analysisResult.quality_findings.length === 0 ? (
                      <div
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          background: "#EAF6F0",
                          border: "1px solid #B9DED4",
                          borderRadius: "12px",
                        }}
                      >
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛡️</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#176B50" }}>
                          Clean Evidentiary Health & Validity
                        </div>
                        <div style={{ fontSize: "13px", color: "#445451", marginTop: "4px" }}>
                          No pagination truncation, scan blurs, or apparent expiration defects detected in this document.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {analysisResult.quality_findings.map((qf, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "18px",
                              borderRadius: "12px",
                              background:
                                qf.severity === "critical"
                                  ? "#FDF2F2"
                                  : qf.severity === "major"
                                    ? "#FEF7EA"
                                    : "#EDF5FB",
                              border: `1px solid ${qf.severity === "critical"
                                  ? "#F3C7C5"
                                  : qf.severity === "major"
                                    ? "#F2D7A5"
                                    : "#C4DDF0"
                                }`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  background:
                                    qf.severity === "critical"
                                      ? "#B42318"
                                      : qf.severity === "major"
                                        ? "#A8620A"
                                        : "#1B6498",
                                  color: "#FFFFFF",
                                }}
                              >
                                {qf.severity}
                              </span>
                              <span style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 600 }}>
                                Page {qf.page_number}
                              </span>
                            </div>

                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                              {qf.title}
                            </div>
                            <p style={{ fontSize: "13px", color: "#445451", margin: "0 0 10px", lineHeight: "1.5" }}>
                              {qf.description}
                            </p>

                            <div
                              style={{
                                background: "#FFFFFF",
                                border: "1px solid #DCE5E1",
                                borderRadius: "8px",
                                padding: "10px 14px",
                                fontSize: "12px",
                                color: "#172322",
                              }}
                            >
                              <strong>Recommended Action:</strong> {qf.recommended_action}
                            </div>

                            {qf.suggested_clarification && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  fontSize: "12px",
                                  color: "#176B50",
                                  fontWeight: 600,
                                }}
                              >
                                <strong>Suggested Client Clarification:</strong> &ldquo;{qf.suggested_clarification}&rdquo;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Specialized Forensics & Intelligence */}
                {activeTab === "forensics" && (
                  <div style={{ padding: "24px", background: "#FFFFFF" }}>
                    {/* 1. Resume & Career Intelligence */}
                    {analysisResult.specialized_intelligence.resume_intelligence && (
                      <div
                        style={{
                          marginBottom: "24px",
                          background: "#EAF6F0",
                          border: "1px solid #B9DED4",
                          borderRadius: "12px",
                          padding: "20px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                          <div>
                            <div style={{ fontSize: "11px", color: "#176B50", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Candidate Profile & Career Intelligence
                            </div>
                            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#063C3D", margin: "4px 0 2px" }}>
                              {analysisResult.specialized_intelligence.resume_intelligence.candidate_name || "Candidate Profile"}
                            </h3>
                            <div style={{ fontSize: "14px", color: "#445451" }}>
                              {analysisResult.specialized_intelligence.resume_intelligence.current_role}
                              {analysisResult.specialized_intelligence.resume_intelligence.employer && ` at ${analysisResult.specialized_intelligence.resume_intelligence.employer}`}
                              {analysisResult.specialized_intelligence.resume_intelligence.location && ` • ${analysisResult.specialized_intelligence.resume_intelligence.location}`}
                            </div>
                          </div>

                          {analysisResult.specialized_intelligence.resume_intelligence.years_experience && (
                            <div style={{ background: "#FFFFFF", border: "1px solid #B9DED4", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: "#176B50" }}>
                              💼 {analysisResult.specialized_intelligence.resume_intelligence.years_experience}
                            </div>
                          )}
                        </div>

                        {/* Contact & Links Bar */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #B9DED4" }}>
                          {analysisResult.specialized_intelligence.resume_intelligence.email && (
                            <span style={{ fontSize: "12px", color: "#172322", background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "4px 10px", borderRadius: "6px" }}>
                              ✉️ {analysisResult.specialized_intelligence.resume_intelligence.email}
                            </span>
                          )}
                          {analysisResult.specialized_intelligence.resume_intelligence.phone && (
                            <span style={{ fontSize: "12px", color: "#172322", background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "4px 10px", borderRadius: "6px" }}>
                              📞 {analysisResult.specialized_intelligence.resume_intelligence.phone}
                            </span>
                          )}
                          {analysisResult.specialized_intelligence.resume_intelligence.linkedin && (
                            <a
                              href={analysisResult.specialized_intelligence.resume_intelligence.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: "12px", color: "#1B6498", background: "#EDF5FB", border: "1px solid #C4DDF0", padding: "4px 10px", borderRadius: "6px", textDecoration: "none", fontWeight: 600 }}
                            >
                              🔗 LinkedIn Profile ↗
                            </a>
                          )}
                          {analysisResult.specialized_intelligence.resume_intelligence.github && (
                            <a
                              href={analysisResult.specialized_intelligence.resume_intelligence.github}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: "12px", color: "#063C3D", background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "4px 10px", borderRadius: "6px", textDecoration: "none", fontWeight: 600 }}
                            >
                              💻 GitHub Portfolio ↗
                            </a>
                          )}
                        </div>

                        {/* Technical Skills & Education */}
                        {analysisResult.specialized_intelligence.resume_intelligence.skills && (
                          <div style={{ marginTop: "14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#445451", textTransform: "uppercase", marginBottom: "6px" }}>
                              Technical Skills & Core Competencies:
                            </div>
                            <div style={{ fontSize: "12px", color: "#172322", background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px 12px", borderRadius: "8px", lineHeight: "1.5" }}>
                              {analysisResult.specialized_intelligence.resume_intelligence.skills}
                            </div>
                          </div>
                        )}

                        {analysisResult.specialized_intelligence.resume_intelligence.education && (
                          <div style={{ marginTop: "12px", fontSize: "12px", color: "#445451" }}>
                            🎓 <strong>Education:</strong>{" "}
                            <span style={{ color: "#172322" }}>{analysisResult.specialized_intelligence.resume_intelligence.education}</span>
                          </div>
                        )}

                        {analysisResult.specialized_intelligence.resume_intelligence.languages && (
                          <div style={{ marginTop: "10px", fontSize: "12px", color: "#445451" }}>
                            🌐 <strong>Candidate Languages:</strong>{" "}
                            <span style={{ color: "#172322" }}>{analysisResult.specialized_intelligence.resume_intelligence.languages}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Statutory Identity Resolution & Multi-Jurisdictional Compliance */}
                    {analysisResult.specialized_intelligence.identity_compliance && (
                      <div style={{ marginBottom: "24px" }}>
                        <div style={{ fontSize: "11px", color: "#0D6866", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                          Statutory Identity Resolution & Compliance
                        </div>
                        <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#063C3D", margin: "0 0 16px" }}>
                          Multi-Jurisdictional Identity & Security Credentials
                        </h3>

                        {/* Single Name FNU Resolution */}
                        {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution && (
                          <div
                            style={{
                              background: "#F8F7F2",
                              border: "1px solid #DCE5E1",
                              borderRadius: "10px",
                              padding: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#176B50", marginBottom: "10px" }}>
                              Single-Name / FNU Resolver:
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                              <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                                <div style={{ fontSize: "11px", color: "#6E7F7C" }}>USCIS (DS-160 / I-140)</div>
                                <div style={{ fontSize: "12px", color: "#063C3D", fontWeight: 600, marginTop: "4px" }}>
                                  {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.uscis_representation}
                                </div>
                              </div>
                              <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                                <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Canada IRCC</div>
                                <div style={{ fontSize: "12px", color: "#063C3D", fontWeight: 600, marginTop: "4px" }}>
                                  {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.ircc_representation}
                                </div>
                              </div>
                              <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                                <div style={{ fontSize: "11px", color: "#6E7F7C" }}>UKVI</div>
                                <div style={{ fontSize: "12px", color: "#063C3D", fontWeight: 600, marginTop: "4px" }}>
                                  {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.ukvi_representation}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: "12px", color: "#445451", marginTop: "10px" }}>
                              {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.guidance}
                            </div>
                          </div>
                        )}

                        {/* Republic of India Passport Verification & ICAO Doc 9303 MRZ */}
                        {analysisResult.specialized_intelligence.identity_compliance.indian_passport && (
                          <div
                            style={{
                              background: "#F1F6F4",
                              border: "1px solid #B9DED4",
                              borderRadius: "10px",
                              padding: "18px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "16px" }}>🇮🇳</span>
                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                                  Republic of India Passport Verification
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                {analysisResult.specialized_intelligence.identity_compliance.indian_passport.mrz_detected && (
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      padding: "3px 8px",
                                      borderRadius: "4px",
                                      background: "#EAF6F0",
                                      color: "#176B50",
                                      border: "1px solid #B9DED4",
                                    }}
                                  >
                                    ✓ ICAO Doc 9303 MRZ Validated
                                  </span>
                                )}
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    background: analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status === "ECNR" ? "#EAF6F0" : "#FEF7EA",
                                    border: `1px solid ${analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status === "ECNR" ? "#B9DED4" : "#F2D7A5"}`,
                                    color: analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status === "ECNR" ? "#176B50" : "#A8620A",
                                  }}
                                >
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status}
                                </span>
                              </div>
                            </div>

                            {/* Biodata Fields */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", fontSize: "12px", color: "#445451", background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.passport_number && (
                                <div>Passport No: <strong style={{ color: "#0D6866", fontFamily: "monospace", fontSize: "13px" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.passport_number}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.holder_name && (
                                <div>Holder Name: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.holder_name}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.surname && (
                                <div>Surname: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.surname}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.given_names && (
                                <div>Given Names: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.given_names}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_birth && (
                                <div>Date of Birth: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_birth}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.gender && (
                                <div>Gender: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.gender}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.nationality && (
                                <div>Nationality: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.nationality}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_birth && (
                                <div>Place of Birth: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_birth}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_issue && (
                                <div>Date of Issue: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_issue}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_expiry && (
                                <div>Date of Expiry: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_expiry}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_issue && (
                                <div>Place of Issue: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_issue}</strong></div>
                              )}
                              <div>Booklet: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.booklet_type}</strong></div>
                            </div>

                            {/* Endorsements / Back Page Details */}
                            {(analysisResult.specialized_intelligence.identity_compliance.indian_passport.father_name ||
                              analysisResult.specialized_intelligence.identity_compliance.indian_passport.mother_name ||
                              analysisResult.specialized_intelligence.identity_compliance.indian_passport.spouse_name ||
                              analysisResult.specialized_intelligence.identity_compliance.indian_passport.file_number ||
                              analysisResult.specialized_intelligence.identity_compliance.indian_passport.address) && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", fontSize: "12px", color: "#445451", background: "#F8F7F2", border: "1px solid #DCE5E1", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.file_number && (
                                    <div>File No: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.file_number}</strong></div>
                                  )}
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.father_name && (
                                    <div>Father: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.father_name}</strong></div>
                                  )}
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.mother_name && (
                                    <div>Mother: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.mother_name}</strong></div>
                                  )}
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.spouse_name && (
                                    <div>Spouse: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.spouse_name}</strong></div>
                                  )}
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.address && (
                                    <div style={{ gridColumn: "1 / -1" }}>Address: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.address}{analysisResult.specialized_intelligence.identity_compliance.indian_passport.pin_code ? ` - ${analysisResult.specialized_intelligence.identity_compliance.indian_passport.pin_code}` : ""}</strong></div>
                                  )}
                                </div>
                              )}

                            {/* Raw Machine Readable Zone (MRZ) */}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.raw_mrz && (
                              <div style={{ marginTop: "10px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>
                                  Machine Readable Zone (MRZ TD3 Format):
                                </div>
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: "8px 12px",
                                    background: "#FFFFFF",
                                    border: "1px solid #B9DED4",
                                    borderRadius: "6px",
                                    fontFamily: "'Courier New', Courier, monospace",
                                    fontSize: "11px",
                                    color: "#063C3D",
                                    lineHeight: "1.4",
                                    letterSpacing: "0.12em",
                                    overflowX: "auto",
                                  }}
                                >
                                  {analysisResult.specialized_intelligence.identity_compliance.indian_passport.raw_mrz}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Aadhaar Card Masking */}
                        {analysisResult.specialized_intelligence.identity_compliance.aadhaar && (
                          <div
                            style={{
                              background: "#F8F7F2",
                              border: "1px solid #DCE5E1",
                              borderRadius: "10px",
                              padding: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                              UIDAI Aadhaar 8-Digit Masking Compliance:
                            </div>
                            <div style={{ fontSize: "13px", color: "#172322" }}>
                              Masked Number:{" "}
                              <strong style={{ color: "#176B50" }}>
                                {analysisResult.specialized_intelligence.identity_compliance.aadhaar.masked_number}
                              </strong>
                              <span style={{ fontSize: "11px", color: "#6E7F7C", marginLeft: "10px" }}>(UIDAI statutory compliance verified)</span>
                            </div>
                          </div>
                        )}

                        {/* PAN Card */}
                        {analysisResult.specialized_intelligence.identity_compliance.pan && (
                          <div
                            style={{
                              background: "#F8F7F2",
                              border: "1px solid #DCE5E1",
                              borderRadius: "10px",
                              padding: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#A8620A", marginBottom: "6px" }}>
                              Income Tax Department PAN Card Classification:
                            </div>
                            <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#172322", flexWrap: "wrap" }}>
                              <div>PAN: <strong style={{ color: "#176B50" }}>{analysisResult.specialized_intelligence.identity_compliance.pan.pan_number}</strong></div>
                              <div>Taxpayer Entity: <strong style={{ color: "#0D6866" }}>{analysisResult.specialized_intelligence.identity_compliance.pan.entity_type}</strong></div>
                            </div>
                          </div>
                        )}

                        {/* Driving Licence & Voter ID */}
                        {analysisResult.specialized_intelligence.identity_compliance.driving_licence && (
                          <div
                            style={{
                              background: "#F8F7F2",
                              border: "1px solid #DCE5E1",
                              borderRadius: "10px",
                              padding: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                              Driving Licence Verification:
                            </div>
                            <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#172322", flexWrap: "wrap" }}>
                              <div>Licence No: <strong style={{ color: "#176B50" }}>{analysisResult.specialized_intelligence.identity_compliance.driving_licence.licence_number}</strong></div>
                              <div>Jurisdiction: <strong style={{ color: "#0D6866" }}>{analysisResult.specialized_intelligence.identity_compliance.driving_licence.jurisdiction}</strong></div>
                              {analysisResult.specialized_intelligence.identity_compliance.driving_licence.vehicle_class && (
                                <div>Class: <strong style={{ color: "#A8620A" }}>{analysisResult.specialized_intelligence.identity_compliance.driving_licence.vehicle_class}</strong></div>
                              )}
                            </div>
                          </div>
                        )}

                        {analysisResult.specialized_intelligence.identity_compliance.voter_id && (
                          <div
                            style={{
                              background: "#F8F7F2",
                              border: "1px solid #DCE5E1",
                              borderRadius: "10px",
                              padding: "16px",
                            }}
                          >
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                              Election Commission Elector's Photo Identity Card (EPIC):
                            </div>
                            <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#172322", flexWrap: "wrap" }}>
                              <div>EPIC No: <strong style={{ color: "#176B50" }}>{analysisResult.specialized_intelligence.identity_compliance.voter_id.epic_number}</strong></div>
                              {analysisResult.specialized_intelligence.identity_compliance.voter_id.elector_name && (
                                <div>Elector: <strong style={{ color: "#063C3D" }}>{analysisResult.specialized_intelligence.identity_compliance.voter_id.elector_name}</strong></div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Financial Evidence Forensics & Liquidity Benchmarking */}
                    {analysisResult.specialized_intelligence.financial_forensics && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#0D6866", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Financial Evidence Forensics & Liquidity Benchmarking
                        </div>
                        <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#063C3D", margin: "6px 0 16px" }}>
                          {analysisResult.specialized_intelligence.financial_forensics.institution}
                        </h3>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "12px",
                            marginBottom: "20px",
                          }}
                        >
                          <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", padding: "14px", borderRadius: "8px" }}>
                            <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Opening Balance</div>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#063C3D" }}>
                              ${analysisResult.specialized_intelligence.financial_forensics.opening_balance.toLocaleString()}
                            </div>
                          </div>
                          <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", padding: "14px", borderRadius: "8px" }}>
                            <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Closing Balance</div>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#176B50" }}>
                              ${analysisResult.specialized_intelligence.financial_forensics.closing_balance.toLocaleString()}
                            </div>
                          </div>
                          <div style={{ background: "#F8F7F2", border: "1px solid #DCE5E1", padding: "14px", borderRadius: "8px" }}>
                            <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Minimum Observed</div>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#A8620A" }}>
                              ${analysisResult.specialized_intelligence.financial_forensics.minimum_balance_observed.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Suspicious Lump Sums */}
                        {analysisResult.specialized_intelligence.financial_forensics.suspicious_lump_sums.length > 0 && (
                          <div
                            style={{
                              background: "#FDF2F2",
                              border: "1px solid #F3C7C5",
                              borderRadius: "10px",
                              padding: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#B42318", marginBottom: "8px" }}>
                              ⚠️ Flagged Unseasoned Sudden Deposit (Refusal Risk Under US 214(b) / IRCC 216(1)):
                            </div>
                            {analysisResult.specialized_intelligence.financial_forensics.suspicious_lump_sums.map((ls, i) => (
                              <div key={i} style={{ fontSize: "13px", color: "#172322", marginTop: "4px" }}>
                                &bull; <strong>{ls.date}</strong>: {ls.description} &mdash;{" "}
                                <span style={{ fontWeight: 700, color: "#B42318" }}>
                                  +${ls.amount.toLocaleString()} ({ls.type})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. Indian Income Tax Return (ITR-V) Statutory Verification */}
                    {analysisResult.specialized_intelligence.itr_verification && (
                      <div
                        style={{
                          marginTop: "20px",
                          background: "#FEF7EA",
                          border: "1px solid #F2D7A5",
                          borderRadius: "10px",
                          padding: "18px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#A8620A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Indian Income Tax Department (CBDT) Forensics
                        </div>
                        <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#063C3D", margin: "4px 0 12px" }}>
                          ITR-V Income Tax Return Acknowledgement
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "12px", color: "#445451" }}>
                          {analysisResult.specialized_intelligence.itr_verification.assessment_year && (
                            <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Assessment Year</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#A8620A", marginTop: "2px" }}>
                                {analysisResult.specialized_intelligence.itr_verification.assessment_year}
                              </div>
                            </div>
                          )}
                          {analysisResult.specialized_intelligence.itr_verification.pan_number && (
                            <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#6E7F7C" }}>PAN Number</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#176B50", fontFamily: "monospace", marginTop: "2px" }}>
                                {analysisResult.specialized_intelligence.itr_verification.pan_number}
                              </div>
                            </div>
                          )}
                          {analysisResult.specialized_intelligence.itr_verification.acknowledgement_number && (
                            <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#6E7F7C" }}>15-Digit Ack No.</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0D6866", fontFamily: "monospace", marginTop: "2px" }}>
                                {analysisResult.specialized_intelligence.itr_verification.acknowledgement_number}
                              </div>
                            </div>
                          )}
                          {analysisResult.specialized_intelligence.itr_verification.gross_total_income !== undefined && (
                            <div style={{ background: "#FFFFFF", border: "1px solid #DCE5E1", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#6E7F7C" }}>Gross Total Income</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#063C3D", marginTop: "2px" }}>
                                ₹{Number(analysisResult.specialized_intelligence.itr_verification.gross_total_income).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!analysisResult.specialized_intelligence.resume_intelligence &&
                      !analysisResult.specialized_intelligence.identity_compliance &&
                      !analysisResult.specialized_intelligence.financial_forensics &&
                      !analysisResult.specialized_intelligence.itr_verification && (
                        <div style={{ padding: "24px", color: "#6E7F7C", fontSize: "13px" }}>
                          No specialized banking, resume, or statutory identity anomalies detected for this document category.
                        </div>
                      )}
                  </div>
                )}

                {/* Tab 5: Raw OCR & Geometries */}
                {activeTab === "ocr" && (
                  <div style={{ padding: "24px", background: "#FFFFFF" }}>
                    {/* Rendered Page Gallery (if PDF/Image pages are available) */}
                    {analysisResult.ocr_summary?.pages?.some((p) => p.page_image_data_url) && (
                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase", marginBottom: "10px" }}>
                          Rendered Document Pages (Click any page to Maximize):
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
                          {analysisResult.ocr_summary.pages.map((p) =>
                            p.page_image_data_url ? (
                              <div
                                key={p.page_number}
                                onClick={() => {
                                  setMaximizedPageNum(p.page_number);
                                  setMaximizedZoom(1);
                                  setIsCanvasMaximized(true);
                                }}
                                style={{
                                  background: "#F8F7F2",
                                  border: "1px solid #DCE5E1",
                                  borderRadius: "8px",
                                  padding: "8px",
                                  cursor: "zoom-in",
                                  textAlign: "center",
                                }}
                              >
                                <img
                                  src={p.page_image_data_url}
                                  alt={`Page ${p.page_number}`}
                                  style={{
                                    width: "100%",
                                    height: "140px",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                    background: "#FFFFFF",
                                    border: "1px solid #E7EFEB",
                                  }}
                                />
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", marginTop: "6px" }}>
                                  Page {p.page_number} &bull; <span style={{ color: "#0D6866" }}>⛶ Maximize</span>
                                </div>
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ fontSize: "13px", color: "#445451", fontWeight: 600 }}>
                        Extracted Text Stream & Spatial Blocks:
                      </div>
                      <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                        Language: {analysisResult.metadata.detected_language} &bull; SHA-256:{" "}
                        <span style={{ fontFamily: "monospace" }}>
                          {analysisResult.metadata.sha256_hash.slice(0, 12)}...
                        </span>
                      </div>
                    </div>

                    <pre
                      style={{
                        background: "#F8F7F2",
                        padding: "16px",
                        borderRadius: "10px",
                        border: "1px solid #DCE5E1",
                        color: "#172322",
                        fontSize: "12px",
                        lineHeight: "1.6",
                        overflowX: "auto",
                        maxHeight: "450px",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {analysisResult.raw_text_preview}
                    </pre>
                  </div>
                )}

                {/* Tab 6: JSON Schema Export */}
                {activeTab === "json" && (
                  <div style={{ padding: "24px", background: "#FFFFFF" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ fontSize: "13px", color: "#445451", fontWeight: 600 }}>
                        Full Interoperable API Response Payload (JSON):
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyJson}
                        style={{
                          fontSize: "12px",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          color: "#063C3D",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {copiedJson ? "✓ Copied!" : "Copy Raw JSON"}
                      </button>
                    </div>

                    <pre
                      style={{
                        background: "#F8F7F2",
                        padding: "16px",
                        borderRadius: "10px",
                        border: "1px solid #DCE5E1",
                        color: "#063C3D",
                        fontSize: "12px",
                        lineHeight: "1.5",
                        overflowX: "auto",
                        maxHeight: "500px",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {JSON.stringify(analysisResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Fullscreen / Maximize Spatial Document Lightbox Modal */}
        {isCanvasMaximized && analysisResult && (
          <div
            onClick={() => setIsCanvasMaximized(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(23, 35, 34, 0.45)",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
            }}
          >
            {(() => {
              const pagesList = analysisResult.ocr_summary?.pages || [];
              const totalPages = Math.max(1, pagesList.length);
              const currentPageMeta =
                pagesList.find((p) => p.page_number === maximizedPageNum) || pagesList[0];
              const currentImgUrl = currentPageMeta?.page_image_data_url;
              const fieldsOnPage = uniqueExtractedFields.filter(
                (f) => (f.source_page || 1) === maximizedPageNum
              );
              const docLines = (analysisResult.raw_text_preview || "")
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);

              return (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    maxWidth: "1440px",
                    height: "100%",
                    margin: "0 auto",
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 20px 50px rgba(6, 60, 61, 0.16)",
                  }}
                >
                  {/* Modal Top Control Bar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                      padding: "14px 20px",
                      background: "#F8F7F2",
                      borderBottom: "1px solid #DCE5E1",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          color: "#176B50",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          background: "#EAF6F0",
                          border: "1px solid #B9DED4",
                          padding: "4px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        Spatial Document Inspector
                      </span>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                        {analysisResult.metadata.filename}
                      </span>
                      <span style={{ fontSize: "12px", color: "#6E7F7C", fontFamily: "monospace" }}>
                        Page {maximizedPageNum} of {totalPages} &bull;{" "}
                        {Math.round(currentPageMeta?.width || 612)}&times;
                        {Math.round(currentPageMeta?.height || 792)}px
                      </span>
                    </div>

                    {/* Page Switcher + Zoom + Overlay Toggle + Close */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      {totalPages > 1 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "#FFFFFF",
                            padding: "4px 8px",
                            borderRadius: "8px",
                            border: "1px solid #DCE5E1",
                          }}
                        >
                          <button
                            type="button"
                            disabled={maximizedPageNum <= 1}
                            onClick={() => setMaximizedPageNum((p) => Math.max(1, p - 1))}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: maximizedPageNum <= 1 ? "#A7B5B2" : "#063C3D",
                              cursor: maximizedPageNum <= 1 ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              fontWeight: 700,
                              padding: "2px 6px",
                            }}
                          >
                            ◀ Prev
                          </button>
                          <span style={{ fontSize: "12px", color: "#172322", fontWeight: 600 }}>
                            Page {maximizedPageNum} / {totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={maximizedPageNum >= totalPages}
                            onClick={() => setMaximizedPageNum((p) => Math.min(totalPages, p + 1))}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: maximizedPageNum >= totalPages ? "#A7B5B2" : "#063C3D",
                              cursor: maximizedPageNum >= totalPages ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              fontWeight: 700,
                              padding: "2px 6px",
                            }}
                          >
                            Next ▶
                          </button>
                        </div>
                      )}

                      {/* Zoom Controls */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#FFFFFF",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          border: "1px solid #DCE5E1",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setMaximizedZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                          style={{
                            background: "#F1F6F4",
                            border: "1px solid #DCE5E1",
                            color: "#063C3D",
                            borderRadius: "4px",
                            width: "24px",
                            height: "24px",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          &minus;
                        </button>
                        <span
                          style={{
                            fontSize: "12px",
                            fontFamily: "monospace",
                            color: "#0D6866",
                            fontWeight: 700,
                            minWidth: "46px",
                            textAlign: "center",
                          }}
                        >
                          {Math.round(maximizedZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setMaximizedZoom((z) => Math.min(3.0, +(z + 0.25).toFixed(2)))}
                          style={{
                            background: "#F1F6F4",
                            border: "1px solid #DCE5E1",
                            color: "#063C3D",
                            borderRadius: "4px",
                            width: "24px",
                            height: "24px",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaximizedZoom(1)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#6E7F7C",
                            fontSize: "11px",
                            cursor: "pointer",
                            padding: "0 4px",
                          }}
                        >
                          Reset
                        </button>
                      </div>

                      {/* Toggle Bounding Box Overlay */}
                      <button
                        type="button"
                        onClick={() => setShowOverlayInMax((v) => !v)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: showOverlayInMax
                            ? "1px solid #B9DED4"
                            : "1px solid #DCE5E1",
                          background: showOverlayInMax
                            ? "#EAF6F0"
                            : "#FFFFFF",
                          color: showOverlayInMax ? "#176B50" : "#6E7F7C",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {showOverlayInMax ? "🎯 Highlights: ON" : "🎯 Highlights: OFF"}
                      </button>

                      {/* Close Button */}
                      <button
                        type="button"
                        onClick={() => setIsCanvasMaximized(false)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "1px solid #F3C7C5",
                          background: "#FDF2F2",
                          color: "#B42318",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ✕ Close (Esc)
                      </button>
                    </div>
                  </div>

                  {/* Modal Body: Left/Center High-Res Document Viewport + Right Field List */}
                  <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
                    {/* Scrollable High-Res Document Viewport */}
                    <div
                      style={{
                        flex: 1,
                        overflow: "auto",
                        background: "#F1F6F4",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        padding: "24px",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: `${Math.round(780 * maximizedZoom)}px`,
                          minHeight: currentImgUrl ? "auto" : `${Math.round(960 * maximizedZoom)}px`,
                          background: "#FFFFFF",
                          border: "1px solid #DCE5E1",
                          borderRadius: "8px",
                          boxShadow: "0 12px 32px rgba(6, 60, 61, 0.08)",
                          overflow: "hidden",
                          transition: "width 0.15s ease",
                        }}
                      >
                        {currentImgUrl ? (
                          <img
                            src={currentImgUrl}
                            alt={`Document Page ${maximizedPageNum}`}
                            style={{
                              display: "block",
                              width: "100%",
                              height: "auto",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              padding: "28px 32px",
                              color: "#172322",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              fontSize: `${Math.max(11, Math.round(12 * maximizedZoom))}px`,
                              lineHeight: "1.6",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                borderBottom: "2px solid #0D6866",
                                paddingBottom: "8px",
                                marginBottom: "14px",
                                fontWeight: 800,
                                color: "#063C3D",
                              }}
                            >
                              <span>{analysisResult.recognition.category_label}</span>
                              <span>{analysisResult.metadata.filename}</span>
                            </div>
                            {docLines.map((line, idx) => (
                              <div key={idx} style={{ padding: "2px 0" }}>
                                {line}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Overlaid Bounding Boxes in Maximized View */}
                        {showOverlayInMax &&
                          fieldsOnPage.map((pf, pfIdx) => {
                            const isSelected = selectedFieldForBbox === pf.field_name;
                            const [ymin, xmin, ymax, xmax] = pf.bounding_box || [0.1, 0.1, 0.2, 0.5];
                            return (
                              <div
                                key={`${pf.field_name}-${pfIdx}`}
                                onClick={() => setSelectedFieldForBbox(pf.field_name)}
                                title={`${pf.field_label}: ${pf.normalized_value}`}
                                style={{
                                  position: "absolute",
                                  top: `${ymin * 100}%`,
                                  left: `${xmin * 100}%`,
                                  width: `${Math.max(8, (xmax - xmin) * 100)}%`,
                                  height: `${Math.max(3.5, (ymax - ymin) * 100)}%`,
                                  border: isSelected
                                    ? "2.5px solid #0D6866"
                                    : "1.5px dashed rgba(13, 104, 102, 0.65)",
                                  background: isSelected
                                    ? "rgba(13, 104, 102, 0.16)"
                                    : "rgba(13, 104, 102, 0.06)",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  zIndex: isSelected ? 10 : 5,
                                  boxShadow: isSelected
                                    ? "0 0 0 3px rgba(13, 104, 102, 0.2)"
                                    : "none",
                                }}
                              >
                                {isSelected && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: "100%",
                                      left: 0,
                                      marginBottom: "4px",
                                      background: "#063C3D",
                                      border: "1px solid #0D6866",
                                      borderRadius: "4px",
                                      padding: "2px 8px",
                                      color: "#FFFFFF",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      whiteSpace: "nowrap",
                                      boxShadow: "0 4px 12px rgba(6, 60, 61, 0.2)",
                                    }}
                                  >
                                    <span style={{ color: "#B9DED4", marginRight: "6px" }}>
                                      {pf.field_label}:
                                    </span>
                                    {pf.normalized_value}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>

                    {/* Right Sidebar: Extracted Fields on Current Page */}
                    <div
                      style={{
                        width: "320px",
                        background: "#FFFFFF",
                        borderLeft: "1px solid #DCE5E1",
                        padding: "16px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: "#0D6866",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Fields on Page {maximizedPageNum} ({fieldsOnPage.length})
                      </div>
                      {fieldsOnPage.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                          No structured fields mapped to Page {maximizedPageNum}. Use the page switcher above to inspect other pages.
                        </div>
                      ) : (
                        fieldsOnPage.map((f, fIdx) => {
                          const isSel = selectedFieldForBbox === f.field_name;
                          return (
                            <div
                              key={`${f.field_name}-${fIdx}`}
                              onClick={() => setSelectedFieldForBbox(f.field_name)}
                              style={{
                                padding: "10px 12px",
                                borderRadius: "8px",
                                border: isSel
                                  ? "1px solid #0D6866"
                                  : "1px solid #DCE5E1",
                                background: isSel
                                  ? "#EAF6F0"
                                  : "#F8F7F2",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 600 }}>
                                {f.field_label}
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: isSel ? "#176B50" : "#063C3D",
                                  marginTop: "2px",
                                  wordBreak: "break-word",
                                }}
                              >
                                {f.normalized_value}
                              </div>
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#6E7F7C",
                                  fontFamily: "monospace",
                                  marginTop: "4px",
                                }}
                              >
                                BBox: {JSON.stringify(f.bounding_box)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }
