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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="package-builder-view">
      {/* Top Header */}
      <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
              {packageItem.version_number}
            </span>
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded uppercase ${
                packageItem.status === "approved"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
              }`}
            >
              Status: {packageItem.status.replace(/_/g, " ")}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-2 text-white">{packageItem.name}</h2>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono">
            <span>Root Merkle Hash:</span>
            <span className="text-blue-300 bg-slate-800 px-2 py-0.5 rounded truncate max-w-sm" title={packageItem.package_hash}>
              {packageItem.package_hash}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {onOpenApprovalWorkflow && (
            <button
              type="button"
              onClick={onOpenApprovalWorkflow}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <span>📋</span> Approval Workflow
            </button>
          )}

          {onExportPackage && (
            <button
              type="button"
              onClick={onExportPackage}
              className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>📦</span> Export Summary
            </button>
          )}
        </div>
      </div>

      {/* Package Segregation Filter Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Segregation Mode Toggle */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
            <input
              type="checkbox"
              checked={excludeInternalOnly}
              onChange={(e) => setExcludeInternalOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span>Submission-Ready Mode (Excludes 09_Internal_Review)</span>
          </label>

          <span className="text-xs text-slate-400">|</span>

          {/* Counts */}
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> of{" "}
            <strong>{items.length}</strong> files ({manifest?.internal_items_count || 1} internal confidential)
          </span>
        </div>

        {/* Search */}
        <div className="w-full md:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search manifest by name, hash, requirement..."
            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
          />
        </div>
      </div>

      {/* Main Folder Explorer + Manifest Table */}
      <div className="flex flex-col md:flex-row min-h-[480px]">
        {/* Left: Folder Category Sidebar */}
        <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/50 p-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1">
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
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{isInternal ? "🔒" : "📁"}</span>
                  <span className="truncate">{folder.label}</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                    isSelected ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {countInFolder}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Manifest Items Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-3">File Name & Version</th>
                <th className="p-3">Folder Path</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Status</th>
                <th className="p-3">SHA-256 Hash</th>
                <th className="p-3 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No files found in selected folder or matching filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50 transition ${
                      item.is_internal_only ? "bg-amber-50/30" : ""
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.is_internal_only ? "🔒" : "📄"}</span>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {item.file_name}
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                              v{item.version}
                            </span>
                            {item.is_internal_only && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300">
                                INTERNAL ONLY
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            Category: {item.document_category.replace(/_/g, " ")} • {item.page_count} page(s)
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px] truncate max-w-xs">
                      {item.folder_path}
                    </td>
                    <td className="p-3 text-slate-700 font-mono text-[11px]">
                      {item.related_requirement_code}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                        {item.review_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      <span className="truncate inline-block max-w-[120px]" title={item.sha256_hash}>
                        {item.sha256_hash.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-600">
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
