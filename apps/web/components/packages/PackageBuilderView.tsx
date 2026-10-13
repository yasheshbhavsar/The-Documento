"use client";

import React, { useState } from "react";
import { FilingPackageItem, PackageManifestItem } from "../../lib/types";

interface PackageBuilderViewProps {
  packageItem: FilingPackageItem;
  onOpenApprovalWorkflow?: () => void;
  onExportPackage?: () => void;
}

export const PackageBuilderView: React.FC<PackageBuilderViewProps> = ({
  packageItem,
  onOpenApprovalWorkflow,
  onExportPackage,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [excludeInternalOnly, setExcludeInternalOnly] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const manifest = packageItem.manifest || packageItem.manifest_json;
  const items: PackageManifestItem[] = manifest?.items || [];

  // Folders list
  const folders = [
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {onOpenApprovalWorkflow && (
            <button
              type="button"
              onClick={onOpenApprovalWorkflow}
              style={{
                padding: "10px 18px",
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
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <span>📋</span> Approval Workflow
            </button>
          )}

          {onExportPackage && (
            <button
              type="button"
              onClick={onExportPackage}
              style={{
                padding: "10px 18px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#FFFFFF",
                background: "rgba(255, 255, 255, 0.14)",
                borderRadius: "8px",
                border: "1px solid rgba(185, 222, 212, 0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <span>📦</span> Export Summary
            </button>
          )}
        </div>
      </div>

      {/* Package Segregation Filter Toolbar */}
      <div
        style={{
          padding: "16px 24px",
          background: "#F8F9F8",
          borderBottom: "1px solid #E2E8E4",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          {/* Segregation Mode Toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#172322",
              cursor: "pointer",
              background: "#FFFFFF",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1.5px solid #DCE5E1",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
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

          <span style={{ color: "#D1D5DB" }}>|</span>

          {/* Counts */}
          <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
            Showing <strong style={{ color: "#172322" }}>{filteredItems.length}</strong> of{" "}
            <strong style={{ color: "#172322" }}>{items.length}</strong> files ({manifest?.internal_items_count || 1} internal confidential)
          </span>
        </div>

        {/* Search */}
        <div style={{ minWidth: "260px" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search manifest by name, hash, requirement..."
            style={{
              width: "100%",
              fontSize: "12px",
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1.5px solid #DCE5E1",
              background: "#FFFFFF",
              color: "#172322",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Main Folder Explorer + Manifest Table */}
      <div style={{ display: "flex", flexDirection: "row", minHeight: "520px", background: "#FFFFFF" }}>
        {/* Left: Folder Category Sidebar */}
        <div
          style={{
            width: "290px",
            minWidth: "290px",
            maxWidth: "290px",
            borderRight: "1px solid #E2E8E4",
            background: "#F8F9F8",
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
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
            Package Folders
          </div>
          {folders.map((folder) => {
            const isInternal = folder.code === "09_Internal_Review";
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
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  lineHeight: "1.35",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  transition: "all 0.15s ease",
                  background: isSelected ? "#EAF6F0" : "transparent",
                  color: isSelected ? "#063C3D" : "#374151",
                  border: isSelected ? "1.5px solid #0D6866" : "1.5px solid transparent",
                  boxShadow: isSelected ? "0 1px 4px rgba(13, 104, 102, 0.08)" : "none",
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
                    padding: "2px 8px",
                    fontSize: "10px",
                    borderRadius: "999px",
                    fontWeight: 700,
                    flexShrink: 0,
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
                <th style={{ padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  File Name & Version
                </th>
                <th style={{ padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Folder Path
                </th>
                <th style={{ padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Requirement
                </th>
                <th style={{ padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Status
                </th>
                <th style={{ padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  SHA-256 Hash
                </th>
                <th style={{ padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>
                  Size
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 24px", textAlign: "center", color: "#6E7F7C" }}>
                    No files found in selected folder or matching filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid #F0F4F2",
                      background: item.is_internal_only ? "#FFFBF0" : "#FFFFFF",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <span style={{ fontSize: "16px", marginTop: "2px" }}>
                          {item.is_internal_only ? "🔒" : "📄"}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, color: "#172322", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span>{item.file_name}</span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                background: "#F1F5F4",
                                color: "#4B5563",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid #DCE5E1",
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
                          <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "3px", textTransform: "capitalize" }}>
                            Category: {item.document_category.replace(/_/g, " ")} • {item.page_count} page(s)
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px", color: "#4B5563", fontFamily: "ui-monospace, monospace", fontSize: "11px", maxWidth: "220px", wordBreak: "break-all" }}>
                      {item.folder_path}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#063C3D",
                          background: "#EAF6F0",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid #B9DED4",
                          fontFamily: "ui-monospace, monospace",
                          display: "inline-block",
                        }}
                      >
                        {item.related_requirement_code}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          fontSize: "10px",
                          fontWeight: 700,
                          borderRadius: "999px",
                          background: "#ECFDF5",
                          color: "#065F46",
                          border: "1px solid #A7F3D0",
                          textTransform: "uppercase",
                          display: "inline-block",
                        }}
                      >
                        {item.review_status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", color: "#6E7F7C", fontFamily: "ui-monospace, monospace", fontSize: "11px" }}>
                      <span
                        style={{
                          maxWidth: "130px",
                          display: "inline-block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={item.sha256_hash}
                      >
                        {item.sha256_hash.slice(0, 12)}...
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#374151" }}>
                      {item.file_size}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
