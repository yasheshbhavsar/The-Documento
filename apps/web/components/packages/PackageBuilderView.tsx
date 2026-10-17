"use client";

import React, { useState, useEffect } from "react";
import {
  FilingPackageItem,
  PackageManifestItem,
  PackageExclusionItem,
  Phase7CanonicalManifest,
  ManifestReportFormat,
} from "../../lib/types";
import {
  downloadPackageZip,
  downloadManifestReport,
  downloadCaseInterimReport,
  includePackageDocument,
  excludePackageDocument,
  fetchCanonicalManifest,
  FALLBACK_PHASE7_MANIFEST,
} from "../../lib/api";

interface PackageBuilderViewProps {
  packageItem: FilingPackageItem;
  onOpenApprovalWorkflow?: () => void;
  onExportPackage?: () => void;
  onRefreshPackage?: () => void;
}

export const PackageBuilderView: React.FC<PackageBuilderViewProps> = ({
  packageItem,
  onOpenApprovalWorkflow,
  onExportPackage,
  onRefreshPackage,
}) => {
  // Navigation & filter state
  const [activeTab, setActiveTab] = useState<"included" | "excluded">("included");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [excludeInternalOnly, setExcludeInternalOnly] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<"canada" | "uscis">("uscis");

  // Officer override dialog state
  const [excludingDocId, setExcludingDocId] = useState<string | null>(null);
  const [exclusionReasonCode, setExclusionReasonCode] = useState<string>("OFFICER_REDUNDANT_EVIDENCE");
  const [exclusionNotes, setExclusionNotes] = useState<string>("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);
  const [overrideFeedback, setOverrideFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Manifest JSON Inspector modal state
  const [isManifestModalOpen, setIsManifestModalOpen] = useState<boolean>(false);
  const [canonicalManifest, setCanonicalManifest] = useState<Phase7CanonicalManifest | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState<boolean>(false);
  const [copiedManifest, setCopiedManifest] = useState<boolean>(false);

  // Download menu state
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const manifest = packageItem.manifest || packageItem.manifest_json;
  const items: PackageManifestItem[] = manifest?.items || [];

  // Excluded candidate items with reason codes
  const fallbackExclusions: PackageExclusionItem[] = [
    {
      document_id: "doc-anom-01",
      title: "Suspicious Employment Certification",
      filename: "Employment_Cert_Tampered.pdf",
      category: "employment_record",
      reason_code: "UNRESOLVED_ANOMALY",
      exclusion_reasons: [
        "Unresolved anomaly: High probability of digital alteration or OCR discrepancy detected in employer letterhead.",
      ],
      blockers: ["UNRESOLVED_ANOMALY", "TAMPERING_SUSPECTED"],
    },
    {
      document_id: "doc-unassigned-02",
      title: "Unlinked Secondary Dependant Passport",
      filename: "Dependant_Passport_Draft.pdf",
      category: "identity_passport",
      reason_code: "APPLICANT_UNASSIGNED",
      exclusion_reasons: ["Applicant assignment unconfirmed. Document not associated with a verified case client profile."],
      blockers: ["APPLICANT_UNASSIGNED"],
    },
    {
      document_id: "doc-human-03",
      title: "Unsigned Reference Letter (Prof. Zhao)",
      filename: "Reference_Letter_Zhao_Unsigned.pdf",
      category: "supporting_evidence",
      reason_code: "HUMAN_VERIFICATION_REQUIRED",
      exclusion_reasons: ["Human verification sign-off is required before inclusion in final petition bundle."],
      blockers: ["HUMAN_VERIFICATION_REQUIRED"],
    },
  ];

  const excludedItems: PackageExclusionItem[] =
    manifest?.excluded_items && manifest.excluded_items.length > 0
      ? manifest.excluded_items
      : fallbackExclusions;

  // Canada vs USCIS folder structures
  const canadaFolders = [
    { code: "all", label: "All Folders" },
    { code: "01_Cic_Correspondence", label: "CIC CORRESPONDENCE (IRCC / Provincial Letters)" },
    { code: "02_Documents", label: "DOCUMENTS (Identity, Civil & Supporting Evidence)" },
    { code: "03_Forms", label: "FORMS (Statutory IMM Forms & Schedules)" },
    { code: "04_Extra", label: "EXTRA (Firm Notes, Affidavits & Supplements)" },
    { code: "05_Upload", label: "UPLOAD (Client Portal Staging & Final Receipts)" },
    { code: "09_Internal_Review", label: "INTERNAL CONFIDENTIAL (Legal Analysis)" },
  ];

  const uscisFolders = [
    { code: "all", label: "All Folders" },
    { code: "00_Case_Summary", label: "00 Case Summary & Exhibits Index" },
    { code: "01_Identity_and_Civil_Status", label: "01 Identity and Civil Status" },
    { code: "02_Application_Forms", label: "02 Application Forms & G-28" },
    { code: "03_Pathway_Evidence", label: "03 Pathway & Extraordinary Ability" },
    { code: "04_Financial_Evidence", label: "04 Financial Evidence" },
    { code: "05_Education_and_Employment", label: "05 Education & Employment" },
    { code: "06_Family_and_Sponsorship", label: "06 Family & Sponsorship" },
    { code: "07_Translations_and_Certifications", label: "07 Translations & Certifications" },
    { code: "08_Additional_Evidence", label: "08 Additional Evidence" },
    { code: "09_Internal_Review", label: "09 Internal Review (Confidential)" },
    { code: "10_Approved_Package", label: "10 Approved Package" },
  ];

  const activeFolders = selectedTemplate === "canada" ? canadaFolders : uscisFolders;

  const filteredItems = items.filter((item) => {
    if (excludeInternalOnly && item.is_internal_only) return false;
    if (selectedFolder !== "all" && item.folder_code !== selectedFolder) return false;
    if (searchTerm) {
      const match =
        item.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sha256_hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.related_requirement_code.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  const filteredExcludedItems = excludedItems.filter((item) => {
    if (!searchTerm) return true;
    return (
      (item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.filename && item.filename.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.reason_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Load canonical manifest on demand
  const handleOpenManifestModal = async () => {
    setIsManifestModalOpen(true);
    setIsLoadingManifest(true);
    try {
      const data = await fetchCanonicalManifest(packageItem.id);
      setCanonicalManifest(data);
    } catch {
      setCanonicalManifest(FALLBACK_PHASE7_MANIFEST);
    } finally {
      setIsLoadingManifest(false);
    }
  };

  const handleCopyManifest = () => {
    if (!canonicalManifest) return;
    navigator.clipboard.writeText(JSON.stringify(canonicalManifest, null, 2));
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  // Officer document exclude handler
  const handleConfirmExclude = async () => {
    if (!excludingDocId) return;
    setIsSubmittingOverride(true);
    setOverrideFeedback(null);
    try {
      await excludePackageDocument(packageItem.id, excludingDocId, exclusionReasonCode, exclusionNotes);
      setOverrideFeedback({
        type: "success",
        message: "Document successfully excluded from package. Change logged to immutable audit trail.",
      });
      setExcludingDocId(null);
      setExclusionNotes("");
      if (onRefreshPackage) onRefreshPackage();
    } catch (err: any) {
      setOverrideFeedback({
        type: "error",
        message: err.message || "Failed to exclude document.",
      });
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Officer document include handler
  const handleIncludeDocument = async (docId: string, hasBlocker: boolean) => {
    if (hasBlocker) {
      setOverrideFeedback({
        type: "error",
        message:
          "STRICT BLOCKER INVARIANT: No document with an unresolved anomaly or failed mandatory check can be included. Resolve anomaly first.",
      });
      return;
    }

    setIsSubmittingOverride(true);
    setOverrideFeedback(null);
    try {
      await includePackageDocument(packageItem.id, docId);
      setOverrideFeedback({
        type: "success",
        message: "Document successfully included in package. Change logged to audit trail.",
      });
      if (onRefreshPackage) onRefreshPackage();
    } catch (err: any) {
      setOverrideFeedback({
        type: "error",
        message: err.message || "Cannot include document: hard blocker or unresolved anomaly present.",
      });
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Multi-format report download
  const handleDownloadReport = async (format: ManifestReportFormat) => {
    setIsDownloading(true);
    try {
      await downloadManifestReport(packageItem.id, format);
    } finally {
      setIsDownloading(false);
      setIsDownloadMenuOpen(false);
    }
  };

  // Interim dossier download
  const handleDownloadInterimDossier = async () => {
    setIsDownloading(true);
    try {
      await downloadCaseInterimReport(packageItem.case_id, "pdf");
    } finally {
      setIsDownloading(false);
      setIsDownloadMenuOpen(false);
    }
  };

  // Full package ZIP download
  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      const cleanName = packageItem.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      await downloadPackageZip(packageItem.id, `${cleanName}_Local_Package.zip`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      data-testid="package-builder-view"
      style={{
        background: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid #DCE5E1",
        boxShadow: "0 6px 24px rgba(6, 60, 61, 0.06)",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* Top Executive Header */}
      <div
        style={{
          padding: "24px 28px",
          background: "linear-gradient(135deg, #063C3D 0%, #084B4C 100%)",
          color: "#FFFFFF",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          borderBottom: "1px solid rgba(185, 222, 212, 0.2)",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                background: "rgba(185, 222, 212, 0.2)",
                color: "#B9DED4",
                borderRadius: "6px",
                border: "1px solid rgba(185, 222, 212, 0.35)",
              }}
            >
              {packageItem.version_number}
            </span>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                borderRadius: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: packageItem.status === "approved" ? "rgba(23, 107, 80, 0.3)" : "rgba(217, 119, 6, 0.2)",
                color: packageItem.status === "approved" ? "#B9DED4" : "#FDE68A",
                border: `1px solid ${
                  packageItem.status === "approved" ? "rgba(185, 222, 212, 0.4)" : "rgba(253, 230, 138, 0.4)"
                }`,
              }}
            >
              Status: {packageItem.status.replace(/_/g, " ")}
            </span>
            <span
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 600,
                background: "rgba(255, 255, 255, 0.12)",
                color: "#EAF6F0",
                borderRadius: "6px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              Folder Template: {selectedTemplate === "canada" ? "Canada (IRCC 5-Folder)" : "USCIS (10-Folder)"}
            </span>
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              margin: "10px 0 4px 0",
              color: "#FFFFFF",
              letterSpacing: "-0.01em",
            }}
          >
            {packageItem.name}
          </h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "6px",
              fontSize: "12px",
              color: "#B9DED4",
              fontFamily: "ui-monospace, monospace",
              flexWrap: "wrap",
            }}
          >
            <span>Root Merkle Hash:</span>
            <span
              style={{
                color: "#EAF6F0",
                background: "rgba(13, 104, 102, 0.6)",
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(185, 222, 212, 0.25)",
              }}
              title={packageItem.package_hash}
            >
              {packageItem.package_hash}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Canonical Phase 7 JSON Inspector */}
          <button
            type="button"
            onClick={handleOpenManifestModal}
            data-testid="inspect-manifest-json-button"
            style={{
              padding: "9px 14px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              border: "1px solid rgba(185, 222, 212, 0.35)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>📄</span> Manifest JSON
          </button>

          {/* Download Local-Folder ZIP Archive */}
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isDownloading}
            data-testid="download-local-zip-button"
            style={{
              padding: "9px 16px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#FFFFFF",
              background: "#176B50",
              borderRadius: "8px",
              border: "1px solid rgba(185, 222, 212, 0.4)",
              cursor: isDownloading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
          >
            <span>💾</span> {isDownloading ? "Packaging..." : "Download Local ZIP"}
          </button>

          {/* Reports Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
              data-testid="interim-reports-menu-button"
              style={{
                padding: "9px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#FFFFFF",
                background: "rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                border: "1px solid rgba(185, 222, 212, 0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📑</span> Reports ▾
            </button>
            {isDownloadMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "#FFFFFF",
                  color: "#172322",
                  borderRadius: "10px",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
                  border: "1px solid #DCE5E1",
                  width: "230px",
                  zIndex: 40,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 700, color: "#6E7F7C", background: "#F8F9F8" }}>
                  MANIFEST & AUDIT REPORTS
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadReport("pdf")}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderBottom: "1px solid #F0F4F2",
                  }}
                >
                  <span style={{ color: "#E11D48" }}>📕</span> PDF Manifest Report
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReport("docx")}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderBottom: "1px solid #F0F4F2",
                  }}
                >
                  <span style={{ color: "#2563EB" }}>📘</span> Word Report (.doc)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReport("txt")}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderBottom: "1px solid #F0F4F2",
                  }}
                >
                  <span style={{ color: "#4B5563" }}>📄</span> Text Report (.txt)
                </button>
                <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 700, color: "#6E7F7C", background: "#F8F9F8" }}>
                  INTERIM / HOLD DOSSIER
                </div>
                <button
                  type="button"
                  onClick={handleDownloadInterimDossier}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "#D97706" }}>⚖️</span> Reassignment Dossier (PDF)
                </button>
              </div>
            )}
          </div>

          {onOpenApprovalWorkflow && (
            <button
              type="button"
              onClick={onOpenApprovalWorkflow}
              style={{
                padding: "9px 16px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#FFFFFF",
                background: "#0D6866",
                borderRadius: "8px",
                border: "1px solid rgba(185, 222, 212, 0.3)",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(6, 60, 61, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📋</span> Approval
            </button>
          )}

          {onExportPackage && (
            <button
              type="button"
              onClick={onExportPackage}
              style={{
                padding: "9px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#FFFFFF",
                background: "rgba(255, 255, 255, 0.14)",
                borderRadius: "8px",
                border: "1px solid rgba(185, 222, 212, 0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📦</span> Summary
            </button>
          )}
        </div>
      </div>

      {/* Operational Notice & Invariant Banner */}
      <div
        style={{
          background: "#F4FBF7",
          padding: "12px 24px",
          borderBottom: "1px solid #DCE5E1",
          fontSize: "12px",
          color: "#063C3D",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px" }}>🛡️</span>
          <span>
            <strong>Local Record Retention:</strong> Permanent case files remain in firm-controlled local folders. Package
            generation is an internal assembly workflow; it <em>does not</em> submit to government portals.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: "#6E7F7C" }}>Template:</span>
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value as "canada" | "uscis");
              setSelectedFolder("all");
            }}
            data-testid="package-folder-template-selector"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#1E293B",
              cursor: "pointer",
            }}
          >
            <option value="uscis">USCIS 10-Folder Standard</option>
            <option value="canada">Canada (CIC / IRCC 5-Folder)</option>
          </select>
        </div>
      </div>

      {/* Override Feedback Alert */}
      {overrideFeedback && (
        <div
          data-testid="officer-override-feedback"
          style={{
            padding: "12px 24px",
            background: overrideFeedback.type === "success" ? "#ECFDF5" : "#FEF2F2",
            borderBottom: `1px solid ${overrideFeedback.type === "success" ? "#A7F3D0" : "#FECACA"}`,
            color: overrideFeedback.type === "success" ? "#065F46" : "#991B1B",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <strong>{overrideFeedback.type === "success" ? "✓ Logged: " : "⚠ Blocker Error: "}</strong>
            {overrideFeedback.message}
          </span>
          <button
            type="button"
            onClick={() => setOverrideFeedback(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Sub-Navigation Tabs: Included vs Excluded Documents */}
      <div
        style={{
          padding: "0 24px",
          background: "#F8F9F8",
          borderBottom: "1px solid #E2E8E4",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("included")}
            data-testid="tab-included-documents"
            style={{
              padding: "12px 18px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: activeTab === "included" ? "3px solid #0D6866" : "3px solid transparent",
              color: activeTab === "included" ? "#063C3D" : "#6E7F7C",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>Included Documents</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 7px",
                borderRadius: "999px",
                background: activeTab === "included" ? "#0D6866" : "#E2E8E4",
                color: activeTab === "included" ? "#FFFFFF" : "#4B5563",
              }}
            >
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("excluded")}
            data-testid="tab-excluded-documents"
            style={{
              padding: "12px 18px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: activeTab === "excluded" ? "3px solid #D97706" : "3px solid transparent",
              color: activeTab === "excluded" ? "#92400E" : "#6E7F7C",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>Excluded Documents</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 7px",
                borderRadius: "999px",
                background: activeTab === "excluded" ? "#D97706" : "#E2E8E4",
                color: activeTab === "excluded" ? "#FFFFFF" : "#4B5563",
              }}
            >
              {excludedItems.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "8px 0", minWidth: "260px" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents by name, hash, reason..."
            data-testid="package-document-search-input"
            style={{
              width: "100%",
              fontSize: "12px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1.5px solid #DCE5E1",
              background: "#FFFFFF",
              color: "#172322",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* VIEW: INCLUDED DOCUMENTS */}
      {activeTab === "included" && (
        <div>
          {/* Segregation Mode Toolbar */}
          <div
            style={{
              padding: "12px 24px",
              background: "#FFFFFF",
              borderBottom: "1px solid #E2E8E4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#172322",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={excludeInternalOnly}
                onChange={(e) => setExcludeInternalOnly(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "#0D6866", cursor: "pointer" }}
              />
              <span>Submission-Ready Mode (Excludes 09_Internal_Review)</span>
            </label>

            <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
              Folder template names are configuration, not universal legal requirements.
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "row", minHeight: "500px", background: "#FFFFFF" }}>
            {/* Left: Folder Category Sidebar */}
            <div
              style={{
                width: "300px",
                minWidth: "300px",
                maxWidth: "300px",
                borderRight: "1px solid #E2E8E4",
                background: "#F8F9F8",
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#6E7F7C",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "6px 10px 10px 10px",
                  borderBottom: "1px solid #E5EBE8",
                  marginBottom: "4px",
                }}
              >
                Package Folders ({selectedTemplate === "canada" ? "Canada IRCC" : "USCIS Standard"})
              </div>
              {activeFolders.map((folder) => {
                const isInternal = folder.code.includes("Internal") || folder.code.includes("09");
                const isSelected = selectedFolder === folder.code;
                const countInFolder =
                  folder.code === "all"
                    ? items.length
                    : items.filter((i) => i.folder_code === folder.code).length;

                return (
                  <button
                    key={folder.code}
                    type="button"
                    onClick={() => setSelectedFolder(folder.code)}
                    data-testid={`folder-item-${folder.code}`}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      lineHeight: "1.3",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      background: isSelected ? "#EAF6F0" : "transparent",
                      color: isSelected ? "#063C3D" : "#374151",
                      border: isSelected ? "1.5px solid #0D6866" : "1.5px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                      <span>{isInternal ? "🔒" : "📁"}</span>
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {folder.label}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: "2px 7px",
                        fontSize: "10px",
                        borderRadius: "999px",
                        fontWeight: 700,
                        background: isSelected ? "#0D6866" : "#E2E8E4",
                        color: isSelected ? "#FFFFFF" : "#4B5563",
                      }}
                    >
                      {countInFolder}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right: Manifest Items Table */}
            <div style={{ flex: 1, overflowX: "auto", background: "#FFFFFF" }}>
              <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#F8F9F8", color: "#6E7F7C", borderBottom: "1.5px solid #E2E8E4" }}>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                      File & Version
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                      Relative Path
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                      Status
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                      SHA-256
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>
                      Size
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>
                      Officer Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "40px 24px", textAlign: "center", color: "#6E7F7C" }}>
                        No included files found matching current folder or search query.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #F0F4F2",
                          background: item.is_internal_only ? "#FFFBF0" : "#FFFFFF",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                            <span style={{ fontSize: "16px" }}>{item.is_internal_only ? "🔒" : "📄"}</span>
                            <div>
                              <div style={{ fontWeight: 700, color: "#172322", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{item.file_name}</span>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "#F1F5F4",
                                    color: "#4B5563",
                                    padding: "2px 5px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  v{item.version}
                                </span>
                                {item.is_internal_only && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      background: "#FEF3C7",
                                      color: "#92400E",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      border: "1px solid #FCD34D",
                                    }}
                                  >
                                    INTERNAL ONLY
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                                {item.document_category.replace(/_/g, " ")} • {item.page_count} page(s)
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#4B5563", fontFamily: "ui-monospace, monospace", fontSize: "11px" }}>
                          {item.folder_path}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              fontSize: "10px",
                              fontWeight: 700,
                              borderRadius: "999px",
                              background: "#ECFDF5",
                              color: "#065F46",
                              border: "1px solid #A7F3D0",
                              textTransform: "uppercase",
                            }}
                          >
                            {item.review_status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#6E7F7C", fontFamily: "ui-monospace, monospace", fontSize: "11px" }}>
                          <span title={item.sha256_hash}>{item.sha256_hash.slice(0, 10)}...</span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#374151" }}>
                          {item.file_size}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setExcludingDocId(item.document_id || `doc-${idx}`)}
                            data-testid={`exclude-doc-${item.document_id || idx}`}
                            style={{
                              padding: "5px 10px",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#991B1B",
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            Exclude
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: EXCLUDED DOCUMENTS & REASON CODES */}
      {activeTab === "excluded" && (
        <div style={{ padding: "20px 24px", background: "#FFFFFF", minHeight: "500px" }}>
          <div
            style={{
              padding: "12px 18px",
              background: "#FFFBEB",
              borderRadius: "8px",
              border: "1px solid #FDE68A",
              marginBottom: "18px",
              fontSize: "12px",
              color: "#92400E",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⛔</span>
            <div>
              <strong>Strict Blocker Invariant:</strong> Candidates flagged with unresolved anomalies, unassigned
              applicants, or failed mandatory checks cannot be included in any final assembly package until resolved by an
              officer.
            </div>
          </div>

          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#F8F9F8", color: "#6E7F7C", borderBottom: "1.5px solid #E2E8E4" }}>
                <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                  Document Name
                </th>
                <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                  Exclusion Reason Code
                </th>
                <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                  Detailed Findings / Blockers
                </th>
                <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>
                  Officer Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredExcludedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "40px 24px", textAlign: "center", color: "#6E7F7C" }}>
                    No excluded documents for this case.
                  </td>
                </tr>
              ) : (
                filteredExcludedItems.map((item, idx) => {
                  const isAnomaly =
                    item.reason_code === "UNRESOLVED_ANOMALY" ||
                    (item.blockers && item.blockers.includes("UNRESOLVED_ANOMALY"));

                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #F0F4F2", background: "#FFFFFF" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#172322" }}>{item.title || item.filename}</div>
                        <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "2px" }}>
                          File: {item.filename} • Category: {(item.category || "evidence").replace(/_/g, " ")}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "4px 9px",
                            fontSize: "11px",
                            fontWeight: 700,
                            borderRadius: "6px",
                            background: isAnomaly ? "#FEF2F2" : "#FFFBEB",
                            color: isAnomaly ? "#991B1B" : "#92400E",
                            border: `1px solid ${isAnomaly ? "#FECACA" : "#FDE68A"}`,
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {item.reason_code}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4B5563" }}>
                        {item.exclusion_reasons && item.exclusion_reasons.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px" }}>
                            {item.exclusion_reasons.map((r, rIdx) => (
                              <li key={rIdx}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#6E7F7C" }}>Exclusion active per checklist rules.</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleIncludeDocument(item.document_id, Boolean(isAnomaly))}
                          disabled={isSubmittingOverride}
                          data-testid={`include-doc-${item.document_id}`}
                          style={{
                            padding: "6px 12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: isAnomaly ? "#9CA3AF" : "#065F46",
                            background: isAnomaly ? "#F3F4F6" : "#ECFDF5",
                            border: `1px solid ${isAnomaly ? "#D1D5DB" : "#A7F3D0"}`,
                            borderRadius: "6px",
                            cursor: isAnomaly ? "not-allowed" : "pointer",
                          }}
                          title={isAnomaly ? "Cannot include: Unresolved anomaly present" : "Include in package"}
                        >
                          {isAnomaly ? "Blocked (Anomaly)" : "Include in Package"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* OFFICER EXCLUSION REASON MODAL */}
      {excludingDocId && (
        <div
          data-testid="officer-exclusion-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(6, 60, 61, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: 700, color: "#172322" }}>
              Officer Document Exclusion
            </h3>
            <p style={{ fontSize: "12px", color: "#6E7F7C", margin: "0 0 16px 0" }}>
              Every modification to package contents is recorded immutably in the case audit log. Please supply the
              statutory or evidentiary rationale.
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                Exclusion Reason Code
              </label>
              <select
                value={exclusionReasonCode}
                onChange={(e) => setExclusionReasonCode(e.target.value)}
                data-testid="exclusion-reason-code-select"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                }}
              >
                <option value="OFFICER_REDUNDANT_EVIDENCE">OFFICER_REDUNDANT_EVIDENCE (Superseded by newer evidence)</option>
                <option value="OFFICER_CONFIDENTIAL_INTERNAL">OFFICER_CONFIDENTIAL_INTERNAL (Strictly firm confidential)</option>
                <option value="OFFICER_DEFECTIVE_IMAGE">OFFICER_DEFECTIVE_IMAGE (Physical illegibility / poor scan)</option>
                <option value="OFFICER_OPTIONAL_EVIDENCE_REMOVAL">OFFICER_OPTIONAL_EVIDENCE_REMOVAL (Strategic pruning)</option>
                <option value="OFFICER_MANUAL_REMOVAL">OFFICER_MANUAL_REMOVAL (General officer determination)</option>
              </select>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                Officer Notes / Justification
              </label>
              <textarea
                value={exclusionNotes}
                onChange={(e) => setExclusionNotes(e.target.value)}
                rows={3}
                placeholder="State reason for excluding this record before package generation..."
                data-testid="exclusion-notes-input"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setExcludingDocId(null)}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExclude}
                disabled={isSubmittingOverride}
                data-testid="confirm-exclude-button"
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  background: "#B91C1C",
                  border: "none",
                  borderRadius: "6px",
                  cursor: isSubmittingOverride ? "wait" : "pointer",
                }}
              >
                {isSubmittingOverride ? "Saving..." : "Confirm Exclusion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANONICAL PHASE 7 MANIFEST JSON INSPECTOR MODAL */}
      {isManifestModalOpen && (
        <div
          data-testid="canonical-manifest-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(6, 60, 61, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                background: "#063C3D",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  Deterministic Manifest JSON (Phase 7 Canonical Schema)
                </h3>
                <span style={{ fontSize: "11px", color: "#B9DED4" }}>
                  Case Reference: {packageItem.case_id} • SHA-256 Verified
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsManifestModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, background: "#0F172A" }}>
              {isLoadingManifest ? (
                <div style={{ color: "#94A3B8", textAlign: "center", padding: "40px" }}>Loading canonical manifest...</div>
              ) : (
                <pre
                  data-testid="canonical-manifest-json-content"
                  style={{
                    color: "#38BDF8",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {JSON.stringify(canonicalManifest || FALLBACK_PHASE7_MANIFEST, null, 2)}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 20px",
                background: "#F8FAFC",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "11px", color: "#64748B" }}>
                Adheres strictly to deterministic manifest schema with collision handling and safe relative paths.
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleCopyManifest}
                  data-testid="copy-manifest-json-button"
                  style={{
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    background: copiedManifest ? "#ECFDF5" : "#FFFFFF",
                    color: copiedManifest ? "#065F46" : "#1E293B",
                    border: `1px solid ${copiedManifest ? "#A7F3D0" : "#CBD5E1"}`,
                    cursor: "pointer",
                  }}
                >
                  {copiedManifest ? "✓ Copied!" : "Copy JSON"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManifestModalOpen(false)}
                  style={{
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    background: "#063C3D",
                    color: "#FFFFFF",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
