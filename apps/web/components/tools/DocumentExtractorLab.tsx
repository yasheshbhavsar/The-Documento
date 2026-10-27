"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../common/DocumentoLogo";
import {
  ExtractorAnalysisResult,
  ExtractorSampleItem,
  fetchExtractorSamples,
  analyzeDocumentStandalone,
  checkExtractorBackendHealth,
  FALLBACK_SAMPLES,
} from "../../lib/api/extractor";

export function DocumentExtractorLab() {
  const [samples, setSamples] = useState<ExtractorSampleItem[]>(FALLBACK_SAMPLES);
  const [selectedSampleId, setSelectedSampleId] = useState<string>("sample-indian-passport");
  const [inputMode, setInputMode] = useState<"presets" | "upload" | "text">("presets");

  // Inputs
  const [pastedText, setPastedText] = useState<string>(FALLBACK_SAMPLES[0].text_content);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState<string>(FALLBACK_SAMPLES[0].filename);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Execution & Progress State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<ExtractorAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; message?: string }>({
    online: true,
    message: "Verifying OCR backend engine...",
  });

  // Inspector Tabs & Filter
  const [activeTab, setActiveTab] = useState<
    "entities" | "recognition" | "quality" | "forensics" | "ocr" | "json"
  >("entities");
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>("");
  const [selectedFieldForBbox, setSelectedFieldForBbox] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load samples on mount
  useEffect(() => {
    async function loadSamples() {
      const health = await checkExtractorBackendHealth();
      setBackendStatus(health);
      const data = await fetchExtractorSamples();
      if (data && data.length > 0) {
        setSamples(data);
        const initial = data.find((s) => s.id === "sample-indian-passport") || data[0];
        setSelectedSampleId(initial.id);
        setPastedText(initial.text_content);
        setCustomFilename(initial.filename);
      }
    }
    loadSamples();
  }, []);

  // When selected sample changes in preset mode
  const handleSelectSample = (sample: ExtractorSampleItem) => {
    setSelectedSampleId(sample.id);
    setPastedText(sample.text_content);
    setCustomFilename(sample.filename);
    setUploadedFile(null);
    setErrorMessage(null);
  };

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
      setInputMode("upload");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setCustomFilename(file.name);
      setInputMode("upload");
    }
  };

  // Run Extraction
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisStep("Ingesting document payload & calculating SHA-256 hash...");

    try {
      // Step simulator for UX feedback
      const timer1 = setTimeout(() => {
        setAnalysisStep("Running Optical Character Recognition & block layout extraction...");
      }, 350);
      const timer2 = setTimeout(() => {
        setAnalysisStep("Classifying document taxonomy & checking immigration rule patterns...");
      }, 700);
      const timer3 = setTimeout(() => {
        setAnalysisStep("Extracting structured entity values & computing calibrated confidence...");
      }, 1050);
      const timer4 = setTimeout(() => {
        setAnalysisStep("Auditing evidence quality, statutory validity & financial forensics...");
      }, 1400);

      let result: ExtractorAnalysisResult;

      if (inputMode === "upload" && uploadedFile) {
        result = await analyzeDocumentStandalone({
          file: uploadedFile,
          filename: customFilename || uploadedFile.name,
        });
      } else {
        const textToUse = pastedText.trim();
        if (!textToUse) {
          throw new Error("Please enter or paste document text, or upload a document file.");
        }
        result = await analyzeDocumentStandalone({
          rawText: textToUse,
          filename: customFilename || "sample_document.txt",
        });
      }

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      setAnalysisResult(result);
      if (result.extracted_fields && result.extracted_fields.length > 0) {
        setSelectedFieldForBbox(result.extracted_fields[0].field_name);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze document. Please check input.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
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

  // Filtered fields
  const filteredFields = analysisResult?.extracted_fields.filter((f) => {
    if (!fieldSearchQuery.trim()) return true;
    const q = fieldSearchQuery.toLowerCase();
    return (
      f.field_name.toLowerCase().includes(q) ||
      f.field_label.toLowerCase().includes(q) ||
      f.original_value.toLowerCase().includes(q) ||
      f.normalized_value.toLowerCase().includes(q)
    );
  });

  const selectedFieldObj = analysisResult?.extracted_fields.find(
    (f) => f.field_name === selectedFieldForBbox
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #062324 0%, #082F31 40%, #0A3B3E 100%)",
        color: "#F1F5F9",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Navigation Bar */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(6, 35, 36, 0.85)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
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
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <DocumentoLogo size="md" showWordmark showDomain />
            </Link>
            <div
              style={{
                height: "22px",
                width: "1px",
                background: "rgba(255, 255, 255, 0.15)",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#10B981",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "3px 8px",
                  borderRadius: "6px",
                }}
              >
                Standalone Lab
              </span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#E2E8F0" }}>
                AI Document Recognition & Information Extractor
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "20px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                fontSize: "12px",
                color: "#6EE7B7",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#10B981",
                  boxShadow: "0 0 8px #10B981",
                }}
              />
              No Authentication Required
            </div>

            <Link
              href="/"
              style={{
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
                color: "#94A3B8",
                padding: "6px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(255, 255, 255, 0.04)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#FFFFFF";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94A3B8";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
              }}
            >
              Back to Main Platform &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Header Intro Banner */}
        <section
          style={{
            marginBottom: "32px",
            background: "rgba(10, 48, 51, 0.6)",
            border: "1px solid rgba(20, 184, 166, 0.2)",
            borderRadius: "16px",
            padding: "24px 28px",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div style={{ maxWidth: "800px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#2DD4BF",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                <span>🔬 Optical Character Recognition & Deep Evidence Forensics</span>
              </div>
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  margin: "0 0 10px",
                  letterSpacing: "-0.02em",
                }}
              >
                Document Information & Recognition Extractor
              </h1>
              <p
                style={{
                  fontSize: "14px",
                  color: "#94A3B8",
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                Audit and inspect Documento&apos;s native OCR and AI extraction pipeline in isolation.
                Test PDF layout vectorization, taxonomy auto-classification, normalized entity values,
                evidence quality checks, and forensic bank/identity parsing—without linking to cases or
                requiring user credentials.
              </p>
            </div>

            {/* Pipeline Capabilities Badges & Engine Status */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "10px",
                maxWidth: "420px",
              }}
            >
              {/* Live Engine Status Pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: backendStatus.online ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  border: `1px solid ${backendStatus.online ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                  padding: "5px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: backendStatus.online ? "#34D399" : "#F87171",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: backendStatus.online ? "#10B981" : "#EF4444",
                    display: "inline-block",
                    boxShadow: backendStatus.online ? "0 0 8px #10B981" : "0 0 8px #EF4444",
                  }}
                />
                <span>
                  {backendStatus.online
                    ? "FastAPI + RapidOCR Engine: ONLINE"
                    : "Backend OCR Offline (Run 'npm run backend')"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                {[
                  { label: "RapidOCR + PDF Vector", color: "#10B981" },
                  { label: "Taxonomy Classification", color: "#38BDF8" },
                  { label: "ISO Field Normalization", color: "#A78BFA" },
                  { label: "Quality & Missing Pages", color: "#F59E0B" },
                  { label: "Unseasoned Fund Detection", color: "#EC4899" },
                  { label: "Single-Name / FNU Resolver", color: "#6EE7B7" },
                ].map((badge) => (
                  <span
                    key={badge.label}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: badge.color,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: `1px solid rgba(255, 255, 255, 0.1)`,
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    ✓ {badge.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Input & Control Panel */}
        <section
          style={{
            background: "rgba(10, 48, 51, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "32px",
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
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              paddingBottom: "16px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setInputMode("presets")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    inputMode === "presets"
                      ? "linear-gradient(135deg, #0D5254 0%, #176B50 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                  color: inputMode === "presets" ? "#FFFFFF" : "#94A3B8",
                  boxShadow:
                    inputMode === "presets" ? "0 4px 12px rgba(16, 185, 129, 0.2)" : "none",
                }}
              >
                ⭐ 1-Click Realistic Presets ({samples.length})
              </button>

              <button
                type="button"
                onClick={() => setInputMode("upload")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    inputMode === "upload"
                      ? "linear-gradient(135deg, #0D5254 0%, #176B50 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                  color: inputMode === "upload" ? "#FFFFFF" : "#94A3B8",
                  boxShadow:
                    inputMode === "upload" ? "0 4px 12px rgba(16, 185, 129, 0.2)" : "none",
                }}
              >
                📁 Upload Document (PDF / Images)
              </button>

              <button
                type="button"
                onClick={() => setInputMode("text")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    inputMode === "text"
                      ? "linear-gradient(135deg, #0D5254 0%, #176B50 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                  color: inputMode === "text" ? "#FFFFFF" : "#94A3B8",
                  boxShadow:
                    inputMode === "text" ? "0 4px 12px rgba(16, 185, 129, 0.2)" : "none",
                }}
              >
                ✍️ Paste Raw Text / OCR Stream
              </button>
            </div>

            {/* Filename Tag */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>File Target:</span>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="document_name.pdf"
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#E2E8F0",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  width: "220px",
                }}
              />
            </div>
          </div>

          {/* Preset Buttons Grid */}
          {inputMode === "presets" && (
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#94A3B8",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Select a Verified Immigration Document Preset:
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "12px",
                }}
              >
                {samples.map((sample) => {
                  const isSelected = selectedSampleId === sample.id;
                  return (
                    <div
                      key={sample.id}
                      onClick={() => handleSelectSample(sample)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        background: isSelected
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: isSelected
                          ? "1px solid #10B981"
                          : "1px solid rgba(255, 255, 255, 0.08)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                        }
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: isSelected ? "#34D399" : "#FFFFFF",
                          }}
                        >
                          {sample.title}
                        </span>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#10B981",
                              fontWeight: 700,
                              background: "rgba(16, 185, 129, 0.2)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#94A3B8",
                          margin: "0 0 6px",
                          lineHeight: "1.4",
                        }}
                      >
                        {sample.description}
                      </p>
                      <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>
                        📄 {sample.filename}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          {inputMode === "upload" && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: dragActive
                  ? "2px dashed #10B981"
                  : uploadedFile
                  ? "2px solid #059669"
                  : "2px dashed rgba(255, 255, 255, 0.2)",
                borderRadius: "12px",
                padding: "40px 24px",
                textAlign: "center",
                background: dragActive
                  ? "rgba(16, 185, 129, 0.1)"
                  : uploadedFile
                  ? "rgba(5, 150, 105, 0.1)"
                  : "rgba(0, 0, 0, 0.2)",
                cursor: "pointer",
                transition: "all 0.2s",
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

              <div style={{ fontSize: "36px", marginBottom: "12px" }}>
                {uploadedFile ? "📄" : "📥"}
              </div>

              {uploadedFile ? (
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#34D399" }}>
                    {uploadedFile.name}
                  </div>
                  <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
                    {(uploadedFile.size / 1024).toFixed(1)} KB &bull; {uploadedFile.type || "binary"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6EE7B7",
                      marginTop: "10px",
                      textDecoration: "underline",
                    }}
                  >
                    Click to choose a different file
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>
                    Drop document file here or click to browse
                  </div>
                  <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "6px" }}>
                    Supports PDF, PNG, JPG, JPEG, WEBP, TIFF, or TXT
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text Area Preview / Editor */}
          {(inputMode === "text" || inputMode === "presets") && (
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#94A3B8" }}>
                  Document Content (Raw Text / OCR Stream):
                </label>
                <div style={{ fontSize: "11px", color: "#64748B" }}>
                  {pastedText.length} characters &bull; {pastedText.split("\n").length} lines
                </div>
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste passport MRZ, bank statement transactions, marriage certificate text..."
                rows={9}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "8px",
                  color: "#E2E8F0",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  padding: "12px",
                  resize: "vertical",
                }}
              />
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
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 28px",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 700,
                color: "#FFFFFF",
                border: "none",
                background: isAnalyzing
                  ? "rgba(16, 185, 129, 0.5)"
                  : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                boxShadow: isAnalyzing
                  ? "none"
                  : "0 10px 25px -5px rgba(16, 185, 129, 0.4)",
                cursor: isAnalyzing ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {isAnalyzing ? (
                <>
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
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

            {/* Stepper info during analysis */}
            {isAnalyzing && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: "#34D399",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10B981",
                    boxShadow: "0 0 10px #10B981",
                  }}
                />
                <span>{analysisStep}</span>
              </div>
            )}

            {/* Error Notification */}
            {errorMessage && (
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#FCA5A5",
                  fontSize: "13px",
                }}
              >
                ⚠️ {errorMessage}
              </div>
            )}
          </div>
        </section>

        {/* Results Section */}
        {analysisResult && (
          <section>
            {/* Top Metrics Ribbon */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              {/* Card 1: Recognition & Taxonomy */}
              <div
                style={{
                  background: "rgba(10, 48, 51, 0.5)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#38BDF8", fontWeight: 700, textTransform: "uppercase" }}>
                  Recognized Taxonomy
                </div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", marginTop: "4px" }}>
                  {analysisResult.recognition.category_label}
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
                  Confidence: <strong style={{ color: "#38BDF8" }}>{(analysisResult.recognition.confidence * 100).toFixed(0)}%</strong>
                </div>
              </div>

              {/* Card 2: Extracted Fields */}
              <div
                style={{
                  background: "rgba(10, 48, 51, 0.5)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#10B981", fontWeight: 700, textTransform: "uppercase" }}>
                  Structured Fields
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", marginTop: "2px" }}>
                  {analysisResult.extracted_fields.length}
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                  Entities Normalized to ISO Standards
                </div>
              </div>

              {/* Card 3: Quality & Integrity */}
              <div
                style={{
                  background: "rgba(10, 48, 51, 0.5)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#F59E0B", fontWeight: 700, textTransform: "uppercase" }}>
                  Evidence Health Score
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color:
                      analysisResult.metadata.overall_health_score >= 80
                        ? "#10B981"
                        : analysisResult.metadata.overall_health_score >= 60
                        ? "#F59E0B"
                        : "#EF4444",
                    marginTop: "2px",
                  }}
                >
                  {analysisResult.metadata.overall_health_score}/100
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                  {analysisResult.quality_findings.length === 0
                    ? "Zero scan defects detected"
                    : `${analysisResult.quality_findings.length} finding(s) audited`}
                </div>
              </div>

              {/* Card 4: OCR Geometries */}
              <div
                style={{
                  background: "rgba(10, 48, 51, 0.5)",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#A78BFA", fontWeight: 700, textTransform: "uppercase" }}>
                  OCR Geometries
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF", marginTop: "4px" }}>
                  {analysisResult.metadata.total_blocks_detected} Text Blocks
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
                  Language: <strong>{analysisResult.metadata.detected_language.toUpperCase()}</strong> &bull; {analysisResult.metadata.page_count} Page(s)
                </div>
              </div>
            </div>

            {/* Deep-Dive Inspector Tabs */}
            <div
              style={{
                background: "rgba(10, 48, 51, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              {/* Tab Navigation */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(0, 0, 0, 0.2)",
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
                        padding: "14px 18px",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: activeTab === tab.id ? "#34D399" : "#94A3B8",
                        borderBottom:
                          activeTab === tab.id ? "2px solid #10B981" : "2px solid transparent",
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
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "#E2E8F0",
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
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#6EE7B7",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ⬇️ Download Report
                  </button>
                </div>
              </div>

              {/* Tab 1: Extracted Entities & Provenance */}
              {activeTab === "entities" && (
                <div style={{ padding: "24px" }}>
                  {/* Search and preview layout */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                      gap: "16px",
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
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        background: "rgba(0, 0, 0, 0.3)",
                        color: "#FFFFFF",
                        fontSize: "13px",
                      }}
                    />

                    <div style={{ fontSize: "12px", color: "#94A3B8" }}>
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
                              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#94A3B8",
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
                          {filteredFields?.map((field) => {
                            const isSelected = selectedFieldForBbox === field.field_name;
                            const confPct = Math.round(field.calibrated_confidence * 100);
                            return (
                              <tr
                                key={field.field_name}
                                onClick={() => setSelectedFieldForBbox(field.field_name)}
                                style={{
                                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                                  background: isSelected
                                    ? "rgba(16, 185, 129, 0.12)"
                                    : "transparent",
                                  cursor: "pointer",
                                  transition: "background 0.15s",
                                }}
                              >
                                <td style={{ padding: "12px", fontWeight: 600, color: "#FFFFFF" }}>
                                  {field.field_label}
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#64748B",
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {field.field_name}
                                  </div>
                                </td>
                                <td style={{ padding: "12px", color: "#34D399", fontWeight: 700 }}>
                                  {field.normalized_value}
                                </td>
                                <td style={{ padding: "12px", color: "#94A3B8", maxWidth: "200px" }}>
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
                                          ? "rgba(16, 185, 129, 0.2)"
                                          : confPct >= 70
                                          ? "rgba(245, 158, 11, 0.2)"
                                          : "rgba(239, 68, 68, 0.2)",
                                      color:
                                        confPct >= 90
                                          ? "#6EE7B7"
                                          : confPct >= 70
                                          ? "#FCD34D"
                                          : "#FCA5A5",
                                    }}
                                  >
                                    {confPct}%
                                  </span>
                                </td>
                                <td style={{ padding: "12px", color: "#64748B", fontSize: "12px" }}>
                                  {field.extraction_method.replace(/_/g, " ")}
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <button
                                    type="button"
                                    style={{
                                      fontSize: "11px",
                                      padding: "4px 8px",
                                      borderRadius: "4px",
                                      border: "1px solid rgba(255, 255, 255, 0.15)",
                                      background: isSelected
                                        ? "#10B981"
                                        : "rgba(255, 255, 255, 0.05)",
                                      color: isSelected ? "#FFFFFF" : "#E2E8F0",
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
                          background: "rgba(0, 0, 0, 0.35)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          borderRadius: "12px",
                          padding: "18px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#10B981",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            marginBottom: "6px",
                          }}
                        >
                          Field Provenance Inspector
                        </div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>
                          {selectedFieldObj.field_label}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748B",
                            fontFamily: "monospace",
                            marginBottom: "12px",
                          }}
                        >
                          Key: {selectedFieldObj.field_name}
                        </div>

                        {/* Coordinate Box Graphic */}
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            height: "180px",
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            marginBottom: "16px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "6px",
                              left: "8px",
                              fontSize: "10px",
                              color: "#64748B",
                            }}
                          >
                            Page {selectedFieldObj.source_page} Spatial Canvas
                          </div>

                          {/* Render Bounding Box */}
                          {(() => {
                            const [ymin, xmin, ymax, xmax] = selectedFieldObj.bounding_box || [0.1, 0.1, 0.3, 0.7];
                            const top = `${ymin * 100}%`;
                            const left = `${xmin * 100}%`;
                            const height = `${Math.max(12, (ymax - ymin) * 100)}%`;
                            const width = `${Math.max(20, (xmax - xmin) * 100)}%`;

                            return (
                              <div
                                style={{
                                  position: "absolute",
                                  top,
                                  left,
                                  width,
                                  height,
                                  border: "2px solid #10B981",
                                  background: "rgba(16, 185, 129, 0.25)",
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#FFFFFF",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px",
                                  boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)",
                                }}
                              >
                                {selectedFieldObj.normalized_value}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Provenance Details */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#94A3B8" }}>Normalized Value:</span>
                            <span style={{ color: "#34D399", fontWeight: 700 }}>
                              {selectedFieldObj.normalized_value}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#94A3B8" }}>Original Extraction:</span>
                            <span style={{ color: "#E2E8F0" }}>{selectedFieldObj.original_value}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#94A3B8" }}>Bounding Box [y0, x0, y1, x1]:</span>
                            <span style={{ fontFamily: "monospace", color: "#A78BFA" }}>
                              {JSON.stringify(selectedFieldObj.bounding_box)}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#94A3B8" }}>Review Status:</span>
                            <span style={{ color: "#FCD34D", fontWeight: 600 }}>
                              {selectedFieldObj.review_status}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#94A3B8" }}>Model Engine:</span>
                            <span style={{ color: "#64748B" }}>{selectedFieldObj.model_version}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Recognition & Taxonomy */}
              {activeTab === "recognition" && (
                <div style={{ padding: "24px" }}>
                  <div style={{ maxWidth: "700px" }}>
                    <div style={{ fontSize: "12px", color: "#38BDF8", fontWeight: 700, textTransform: "uppercase" }}>
                      Immigration Document Taxonomy Engine
                    </div>
                    <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF", margin: "6px 0 16px" }}>
                      {analysisResult.recognition.category_label}
                    </h3>

                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", color: "#94A3B8" }}>Taxonomy Confidence:</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#38BDF8" }}>
                          {(analysisResult.recognition.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "8px",
                          background: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${analysisResult.recognition.confidence * 100}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #38BDF8 0%, #10B981 100%)",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#E2E8F0", marginBottom: "8px" }}>
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
                                background: "rgba(56, 189, 248, 0.15)",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                color: "#7DD3FC",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              🔎 {kw}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "13px", color: "#64748B" }}>
                            Document recognized through structural layout heuristics.
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "10px",
                        padding: "16px",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>
                        Category ID:
                      </div>
                      <code style={{ fontSize: "13px", color: "#34D399" }}>
                        {analysisResult.recognition.category}
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Evidence Quality Audit */}
              {activeTab === "quality" && (
                <div style={{ padding: "24px" }}>
                  {analysisResult.quality_findings.length === 0 ? (
                    <div
                      style={{
                        padding: "32px",
                        textAlign: "center",
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.2)",
                        borderRadius: "12px",
                      }}
                    >
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛡️</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#34D399" }}>
                        Clean Evidentiary Health & Validity
                      </div>
                      <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
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
                                ? "rgba(239, 68, 68, 0.12)"
                                : qf.severity === "major"
                                ? "rgba(245, 158, 11, 0.12)"
                                : "rgba(56, 189, 248, 0.12)",
                            border: `1px solid ${
                              qf.severity === "critical"
                                ? "rgba(239, 68, 68, 0.3)"
                                : qf.severity === "major"
                                ? "rgba(245, 158, 11, 0.3)"
                                : "rgba(56, 189, 248, 0.3)"
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
                                    ? "#EF4444"
                                    : qf.severity === "major"
                                    ? "#F59E0B"
                                    : "#38BDF8",
                                color: "#FFFFFF",
                              }}
                            >
                              {qf.severity}
                            </span>
                            <span style={{ fontSize: "12px", color: "#94A3B8" }}>
                              Page {qf.page_number}
                            </span>
                          </div>

                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginBottom: "6px" }}>
                            {qf.title}
                          </div>
                          <p style={{ fontSize: "13px", color: "#CBD5E1", margin: "0 0 10px", lineHeight: "1.5" }}>
                            {qf.description}
                          </p>

                          <div
                            style={{
                              background: "rgba(0, 0, 0, 0.25)",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              fontSize: "12px",
                              color: "#E2E8F0",
                            }}
                          >
                            <strong>Recommended Action:</strong> {qf.recommended_action}
                          </div>

                          {qf.suggested_clarification && (
                            <div
                              style={{
                                marginTop: "8px",
                                fontSize: "12px",
                                color: "#6EE7B7",
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
                <div style={{ padding: "24px" }}>
                  {/* 1. Resume & Career Intelligence */}
                  {analysisResult.specialized_intelligence.resume_intelligence && (
                    <div
                      style={{
                        marginBottom: "24px",
                        background: "rgba(16, 185, 129, 0.06)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        borderRadius: "12px",
                        padding: "20px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#34D399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Candidate Profile & Career Intelligence
                          </div>
                          <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF", margin: "4px 0 2px" }}>
                            {analysisResult.specialized_intelligence.resume_intelligence.candidate_name || "Candidate Profile"}
                          </h3>
                          <div style={{ fontSize: "14px", color: "#94A3B8" }}>
                            {analysisResult.specialized_intelligence.resume_intelligence.current_role}
                            {analysisResult.specialized_intelligence.resume_intelligence.employer && ` at ${analysisResult.specialized_intelligence.resume_intelligence.employer}`}
                            {analysisResult.specialized_intelligence.resume_intelligence.location && ` • ${analysisResult.specialized_intelligence.resume_intelligence.location}`}
                          </div>
                        </div>

                        {analysisResult.specialized_intelligence.resume_intelligence.years_experience && (
                          <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10B981", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: "#6EE7B7" }}>
                            💼 {analysisResult.specialized_intelligence.resume_intelligence.years_experience}
                          </div>
                        )}
                      </div>

                      {/* Contact & Links Bar */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        {analysisResult.specialized_intelligence.resume_intelligence.email && (
                          <span style={{ fontSize: "12px", color: "#E2E8F0", background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: "6px" }}>
                            ✉️ {analysisResult.specialized_intelligence.resume_intelligence.email}
                          </span>
                        )}
                        {analysisResult.specialized_intelligence.resume_intelligence.phone && (
                          <span style={{ fontSize: "12px", color: "#E2E8F0", background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: "6px" }}>
                            📞 {analysisResult.specialized_intelligence.resume_intelligence.phone}
                          </span>
                        )}
                        {analysisResult.specialized_intelligence.resume_intelligence.linkedin && (
                          <a
                            href={analysisResult.specialized_intelligence.resume_intelligence.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "12px", color: "#38BDF8", background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "4px 10px", borderRadius: "6px", textDecoration: "none", fontWeight: 600 }}
                          >
                            🔗 LinkedIn Profile ↗
                          </a>
                        )}
                        {analysisResult.specialized_intelligence.resume_intelligence.github && (
                          <a
                            href={analysisResult.specialized_intelligence.resume_intelligence.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "12px", color: "#C084FC", background: "rgba(192, 132, 252, 0.15)", border: "1px solid rgba(192, 132, 252, 0.3)", padding: "4px 10px", borderRadius: "6px", textDecoration: "none", fontWeight: 600 }}
                          >
                            💻 GitHub Portfolio ↗
                          </a>
                        )}
                      </div>

                      {/* Technical Skills & Education */}
                      {analysisResult.specialized_intelligence.resume_intelligence.skills && (
                        <div style={{ marginTop: "14px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: "6px" }}>
                            Technical Skills & Core Competencies:
                          </div>
                          <div style={{ fontSize: "12px", color: "#E2E8F0", background: "rgba(0,0,0,0.3)", padding: "10px 12px", borderRadius: "8px", lineHeight: "1.5" }}>
                            {analysisResult.specialized_intelligence.resume_intelligence.skills}
                          </div>
                        </div>
                      )}

                      {analysisResult.specialized_intelligence.resume_intelligence.education && (
                        <div style={{ marginTop: "12px", fontSize: "12px", color: "#94A3B8" }}>
                          🎓 <strong>Education:</strong>{" "}
                          <span style={{ color: "#F1F5F9" }}>{analysisResult.specialized_intelligence.resume_intelligence.education}</span>
                        </div>
                      )}

                      {analysisResult.specialized_intelligence.resume_intelligence.languages && (
                        <div style={{ marginTop: "10px", fontSize: "12px", color: "#94A3B8" }}>
                          🌐 <strong>Candidate Languages:</strong>{" "}
                          <span style={{ color: "#F1F5F9" }}>{analysisResult.specialized_intelligence.resume_intelligence.languages}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Statutory Identity Resolution & Multi-Jurisdictional Compliance */}
                  {analysisResult.specialized_intelligence.identity_compliance && (
                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ fontSize: "11px", color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                        Statutory Identity Resolution & Compliance
                      </div>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 16px" }}>
                        Multi-Jurisdictional Identity & Security Credentials
                      </h3>

                      {/* Single Name FNU Resolution */}
                      {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution && (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}
                        >
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#34D399", marginBottom: "10px" }}>
                            Single-Name / FNU Resolver:
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                            <div style={{ background: "rgba(255,255,255,0.04)", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#94A3B8" }}>USCIS (DS-160 / I-140)</div>
                              <div style={{ fontSize: "12px", color: "#FFFFFF", marginTop: "4px" }}>
                                {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.uscis_representation}
                              </div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.04)", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#94A3B8" }}>Canada IRCC</div>
                              <div style={{ fontSize: "12px", color: "#FFFFFF", marginTop: "4px" }}>
                                {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.ircc_representation}
                              </div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.04)", padding: "10px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "11px", color: "#94A3B8" }}>UKVI</div>
                              <div style={{ fontSize: "12px", color: "#FFFFFF", marginTop: "4px" }}>
                                {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.ukvi_representation}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "10px" }}>
                            {analysisResult.specialized_intelligence.identity_compliance.single_name_resolution.guidance}
                          </div>
                        </div>
                      )}

                      {/* Republic of India Passport Verification & ICAO Doc 9303 MRZ */}
                      {analysisResult.specialized_intelligence.identity_compliance.indian_passport && (
                        <div
                          style={{
                            background: "rgba(56, 189, 248, 0.08)",
                            border: "1px solid rgba(56, 189, 248, 0.25)",
                            borderRadius: "10px",
                            padding: "18px",
                            marginBottom: "16px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "16px" }}>🇮🇳</span>
                              <div style={{ fontSize: "15px", fontWeight: 700, color: "#38BDF8" }}>
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
                                    background: "rgba(16, 185, 129, 0.2)",
                                    color: "#34D399",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
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
                                  background: analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status === "ECNR" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                                  color: analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status === "ECNR" ? "#34D399" : "#FCD34D",
                                }}
                              >
                                {analysisResult.specialized_intelligence.identity_compliance.indian_passport.emigration_check_status}
                              </span>
                            </div>
                          </div>

                          {/* Biodata Fields */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", fontSize: "12px", color: "#CBD5E1", background: "rgba(0,0,0,0.25)", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.passport_number && (
                              <div>Passport No: <strong style={{ color: "#38BDF8", fontFamily: "monospace", fontSize: "13px" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.passport_number}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.holder_name && (
                              <div>Holder Name: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.holder_name}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.surname && (
                              <div>Surname: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.surname}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.given_names && (
                              <div>Given Names: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.given_names}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_birth && (
                              <div>Date of Birth: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_birth}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.gender && (
                              <div>Gender: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.gender}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.nationality && (
                              <div>Nationality: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.nationality}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_birth && (
                              <div>Place of Birth: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_birth}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_issue && (
                              <div>Date of Issue: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_issue}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_expiry && (
                              <div>Date of Expiry: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.date_of_expiry}</strong></div>
                            )}
                            {analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_issue && (
                              <div>Place of Issue: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.place_of_issue}</strong></div>
                            )}
                            <div>Booklet: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.booklet_type}</strong></div>
                          </div>

                          {/* Endorsements / Back Page Details */}
                          {(analysisResult.specialized_intelligence.identity_compliance.indian_passport.father_name ||
                            analysisResult.specialized_intelligence.identity_compliance.indian_passport.mother_name ||
                            analysisResult.specialized_intelligence.identity_compliance.indian_passport.spouse_name ||
                            analysisResult.specialized_intelligence.identity_compliance.indian_passport.file_number ||
                            analysisResult.specialized_intelligence.identity_compliance.indian_passport.address) && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", fontSize: "12px", color: "#CBD5E1", background: "rgba(0,0,0,0.18)", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.file_number && (
                                <div>File No: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.file_number}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.father_name && (
                                <div>Father: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.father_name}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.mother_name && (
                                <div>Mother: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.mother_name}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.spouse_name && (
                                <div>Spouse: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.spouse_name}</strong></div>
                              )}
                              {analysisResult.specialized_intelligence.identity_compliance.indian_passport.address && (
                                <div style={{ gridColumn: "1 / -1" }}>Address: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.indian_passport.address}{analysisResult.specialized_intelligence.identity_compliance.indian_passport.pin_code ? ` - ${analysisResult.specialized_intelligence.identity_compliance.indian_passport.pin_code}` : ""}</strong></div>
                              )}
                            </div>
                          )}

                          {/* Raw Machine Readable Zone (MRZ) */}
                          {analysisResult.specialized_intelligence.identity_compliance.indian_passport.raw_mrz && (
                            <div style={{ marginTop: "10px" }}>
                              <div style={{ fontSize: "10px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>
                                Machine Readable Zone (MRZ TD3 Format):
                              </div>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: "8px 12px",
                                  background: "#050B14",
                                  border: "1px solid rgba(56, 189, 248, 0.3)",
                                  borderRadius: "6px",
                                  fontFamily: "'Courier New', Courier, monospace",
                                  fontSize: "11px",
                                  color: "#38BDF8",
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
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}
                        >
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#38BDF8", marginBottom: "6px" }}>
                            UIDAI Aadhaar 8-Digit Masking Compliance:
                          </div>
                          <div style={{ fontSize: "13px", color: "#FFFFFF" }}>
                            Masked Number:{" "}
                            <strong style={{ color: "#34D399" }}>
                              {analysisResult.specialized_intelligence.identity_compliance.aadhaar.masked_number}
                            </strong>
                            <span style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "10px" }}>(UIDAI statutory compliance verified)</span>
                          </div>
                        </div>
                      )}

                      {/* PAN Card */}
                      {analysisResult.specialized_intelligence.identity_compliance.pan && (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}
                        >
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#FBBF24", marginBottom: "6px" }}>
                            Income Tax Department PAN Card Classification:
                          </div>
                          <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#FFFFFF", flexWrap: "wrap" }}>
                            <div>PAN: <strong style={{ color: "#34D399" }}>{analysisResult.specialized_intelligence.identity_compliance.pan.pan_number}</strong></div>
                            <div>Taxpayer Entity: <strong style={{ color: "#38BDF8" }}>{analysisResult.specialized_intelligence.identity_compliance.pan.entity_type}</strong></div>
                          </div>
                        </div>
                      )}

                      {/* Driving Licence & Voter ID */}
                      {analysisResult.specialized_intelligence.identity_compliance.driving_licence && (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}
                        >
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#A78BFA", marginBottom: "6px" }}>
                            Driving Licence Verification:
                          </div>
                          <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#FFFFFF", flexWrap: "wrap" }}>
                            <div>Licence No: <strong style={{ color: "#34D399" }}>{analysisResult.specialized_intelligence.identity_compliance.driving_licence.licence_number}</strong></div>
                            <div>Jurisdiction: <strong style={{ color: "#38BDF8" }}>{analysisResult.specialized_intelligence.identity_compliance.driving_licence.jurisdiction}</strong></div>
                            {analysisResult.specialized_intelligence.identity_compliance.driving_licence.vehicle_class && (
                              <div>Class: <strong style={{ color: "#FCD34D" }}>{analysisResult.specialized_intelligence.identity_compliance.driving_licence.vehicle_class}</strong></div>
                            )}
                          </div>
                        </div>
                      )}

                      {analysisResult.specialized_intelligence.identity_compliance.voter_id && (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "16px",
                          }}
                        >
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#F472B6", marginBottom: "6px" }}>
                            Election Commission Elector's Photo Identity Card (EPIC):
                          </div>
                          <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#FFFFFF", flexWrap: "wrap" }}>
                            <div>EPIC No: <strong style={{ color: "#34D399" }}>{analysisResult.specialized_intelligence.identity_compliance.voter_id.epic_number}</strong></div>
                            {analysisResult.specialized_intelligence.identity_compliance.voter_id.elector_name && (
                              <div>Elector: <strong style={{ color: "#FFFFFF" }}>{analysisResult.specialized_intelligence.identity_compliance.voter_id.elector_name}</strong></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Financial Evidence Forensics & Liquidity Benchmarking */}
                  {analysisResult.specialized_intelligence.financial_forensics && (
                    <div>
                      <div style={{ fontSize: "11px", color: "#EC4899", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Financial Evidence Forensics & Liquidity Benchmarking
                      </div>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", margin: "6px 0 16px" }}>
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
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "8px" }}>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>Opening Balance</div>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>
                            ${analysisResult.specialized_intelligence.financial_forensics.opening_balance.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "8px" }}>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>Closing Balance</div>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#34D399" }}>
                            ${analysisResult.specialized_intelligence.financial_forensics.closing_balance.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "8px" }}>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>Minimum Observed</div>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#FCD34D" }}>
                            ${analysisResult.specialized_intelligence.financial_forensics.minimum_balance_observed.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Suspicious Lump Sums */}
                      {analysisResult.specialized_intelligence.financial_forensics.suspicious_lump_sums.length > 0 && (
                        <div
                          style={{
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "10px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}
                        >
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#FCA5A5", marginBottom: "8px" }}>
                            ⚠️ Flagged Unseasoned Sudden Deposit (Refusal Risk Under US 214(b) / IRCC 216(1)):
                          </div>
                          {analysisResult.specialized_intelligence.financial_forensics.suspicious_lump_sums.map((ls, i) => (
                            <div key={i} style={{ fontSize: "13px", color: "#FEE2E2", marginTop: "4px" }}>
                              &bull; <strong>{ls.date}</strong>: {ls.description} &mdash;{" "}
                              <span style={{ fontWeight: 700, color: "#EF4444" }}>
                                +${ls.amount.toLocaleString()} ({ls.type})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!analysisResult.specialized_intelligence.resume_intelligence &&
                    !analysisResult.specialized_intelligence.identity_compliance &&
                    !analysisResult.specialized_intelligence.financial_forensics && (
                      <div style={{ padding: "24px", color: "#94A3B8", fontSize: "13px" }}>
                        No specialized banking, resume, or statutory identity anomalies detected for this document category.
                      </div>
                    )}
                </div>
              )}

              {/* Tab 5: Raw OCR & Geometries */}
              {activeTab === "ocr" && (
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ fontSize: "13px", color: "#94A3B8" }}>
                      Extracted Text Stream & Spatial Blocks:
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B" }}>
                      Language: {analysisResult.metadata.detected_language} &bull; SHA-256:{" "}
                      <span style={{ fontFamily: "monospace" }}>
                        {analysisResult.metadata.sha256_hash.slice(0, 12)}...
                      </span>
                    </div>
                  </div>

                  <pre
                    style={{
                      background: "rgba(0, 0, 0, 0.5)",
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#E2E8F0",
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
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ fontSize: "13px", color: "#94A3B8" }}>
                      Full Interoperable API Response Payload (JSON):
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      style={{
                        fontSize: "12px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      {copiedJson ? "✓ Copied!" : "Copy Raw JSON"}
                    </button>
                  </div>

                  <pre
                    style={{
                      background: "rgba(0, 0, 0, 0.6)",
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#34D399",
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
      </main>
    </div>
  );
}
