"use client";

import React from "react";

/* =========================================================================
   1. TABLE SKELETON
   Matches DataTable.tsx geometry: search toolbar, header, shimmer rows, pagination
   ========================================================================= */

export interface TableSkeletonProps {
  rowCount?: number; // default: 6 (matches DataTable pageSize)
  columnCount?: number; // default: 5
  columnWidths?: (string | number)[];
  showHeader?: boolean; // default: true
  showSearch?: boolean; // default: true
  showPagination?: boolean; // default: true
  className?: string;
}

export function TableSkeleton({
  rowCount = 6,
  columnCount = 5,
  columnWidths,
  showHeader = true,
  showSearch = true,
  showPagination = true,
  className = "",
}: TableSkeletonProps) {
  const columns = Array.from({ length: columnCount });
  const rows = Array.from({ length: rowCount });

  return (
    <div
      role="status"
      aria-label="Loading table data"
      aria-busy="true"
      className={`w-full flex flex-col gap-3 ${className}`}
    >
      {/* Search & Filter Toolbar Placeholder */}
      {showSearch && (
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Search Input Box */}
            <div className="h-10 w-64 sm:w-72 bg-slate-200/70 dark:bg-slate-800/70 rounded-lg border border-[#DCE5E1] dark:border-slate-700 animate-pulse" />
            {/* Filter Pills */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-8 w-16 bg-slate-200/70 dark:bg-slate-800/70 rounded-full border border-[#DCE5E1] dark:border-slate-700 animate-pulse" />
              <div className="h-8 w-20 bg-slate-200/70 dark:bg-slate-800/70 rounded-full border border-[#DCE5E1] dark:border-slate-700 animate-pulse" />
            </div>
          </div>
          {/* Action Button Placeholder */}
          <div className="h-9 w-28 bg-[#0D6866]/10 dark:bg-teal-900/30 rounded-lg border border-[#0D6866]/20 dark:border-teal-700/30 animate-pulse" />
        </div>
      )}

      {/* Table Container */}
      <div className="border border-[#DCE5E1] dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            {/* Table Header */}
            {showHeader && (
              <thead>
                <tr className="bg-[#F1F6F4] dark:bg-slate-800/60 border-b border-[#DCE5E1] dark:border-slate-700">
                  {columns.map((_, idx) => (
                    <th
                      key={`th-skel-${idx}`}
                      style={{ width: columnWidths?.[idx] }}
                      className="px-4 py-3"
                    >
                      <div
                        className="h-3.5 bg-slate-300/80 dark:bg-slate-700 rounded animate-pulse"
                        style={{
                          width: idx === 0 ? "65%" : idx === columnCount - 1 ? "40%" : "50%",
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
            )}

            {/* Table Rows */}
            <tbody className="divide-y divide-[#DCE5E1]/70 dark:divide-slate-800">
              {rows.map((_, rIdx) => (
                <tr key={`tr-skel-${rIdx}`} className="bg-white dark:bg-slate-900">
                  {columns.map((_, cIdx) => (
                    <td key={`td-skel-${rIdx}-${cIdx}`} className="px-4 py-3.5 align-middle">
                      {cIdx === 0 ? (
                        /* Primary Column: Title + Subtitle */
                        <div className="space-y-1.5">
                          <div
                            className="h-4 bg-slate-200/70 dark:bg-slate-800/70 rounded animate-pulse"
                            style={{ width: `${65 + ((rIdx * 7) % 25)}%` }}
                          />
                          <div
                            className="h-2.5 bg-slate-100 dark:bg-slate-800/40 rounded animate-pulse"
                            style={{ width: `${40 + ((rIdx * 5) % 20)}%` }}
                          />
                        </div>
                      ) : cIdx === columnCount - 2 ? (
                        /* Status Column: Badge Pill */
                        <div className="h-5 w-20 bg-slate-200/70 dark:bg-slate-800/70 rounded-full border border-slate-200 dark:border-slate-700 animate-pulse" />
                      ) : cIdx === columnCount - 1 ? (
                        /* Action Column: Small Action Button */
                        <div className="h-7 w-16 bg-slate-200/70 dark:bg-slate-800/70 rounded-md border border-slate-200 dark:border-slate-700 animate-pulse ml-auto" />
                      ) : (
                        /* Regular Data Columns */
                        <div
                          className="h-3.5 bg-slate-200/70 dark:bg-slate-800/70 rounded animate-pulse"
                          style={{ width: `${50 + (((rIdx + cIdx) * 11) % 35)}%` }}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Placeholder */}
        {showPagination && (
          <div className="px-4 py-3 border-t border-[#DCE5E1] dark:border-slate-700 bg-[#F1F6F4] dark:bg-slate-800/60 flex items-center justify-between">
            <div className="h-3.5 w-32 bg-slate-200/70 dark:bg-slate-700 rounded animate-pulse" />
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-16 bg-slate-200/70 dark:bg-slate-700 rounded-md animate-pulse" />
              <div className="h-7 w-16 bg-slate-200/70 dark:bg-slate-700 rounded-md animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   2. METRIC CARD SKELETON & GRID
   Matches MetricCard.tsx geometry: label, status pill, large numeral, subtext, drilldown
   ========================================================================= */

export interface MetricCardSkeletonProps {
  hasDrilldown?: boolean;
  hasBadge?: boolean;
  className?: string;
}

export function MetricCardSkeleton({
  hasDrilldown = true,
  hasBadge = true,
  className = "",
}: MetricCardSkeletonProps) {
  return (
    <article
      role="status"
      aria-label="Loading metric"
      aria-busy="true"
      className={`bg-white dark:bg-slate-900 border border-[#DCE5E1] dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3 shadow-sm min-h-[148px] ${className}`}
    >
      {/* Top Row: Label & Status Indicator */}
      <div className="flex justify-between items-start gap-2">
        <div className="h-3.5 w-32 bg-slate-200/70 dark:bg-slate-800/70 rounded animate-pulse" />
        <div className="flex items-center gap-1.5">
          {hasBadge && (
            <div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 animate-pulse" />
          )}
          <div className="w-4 h-4 rounded-full bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
        </div>
      </div>

      {/* Middle: Metric Numeral & Subtext */}
      <div className="space-y-2 py-1">
        <div className="h-8 w-28 bg-slate-200/70 dark:bg-slate-800/70 rounded-md animate-pulse" />
        <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
      </div>

      {/* Bottom Row: Drilldown & Trend Pill */}
      {hasDrilldown && (
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="h-3 w-24 bg-slate-200/50 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full border border-emerald-100 dark:border-emerald-800/40 animate-pulse" />
        </div>
      )}
    </article>
  );
}

export interface CardGridSkeletonProps {
  count?: number; // default: 4
  columns?: 2 | 3 | 4;
  className?: string;
}

export function CardGridSkeleton({
  count = 4,
  columns = 4,
  className = "",
}: CardGridSkeletonProps) {
  const colClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div
      role="status"
      aria-label="Loading card grid"
      aria-busy="true"
      className={`grid ${colClass} gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <MetricCardSkeleton key={`grid-skel-${idx}`} />
      ))}
    </div>
  );
}

// Alias for MetricGridSkeleton
export const MetricGridSkeleton = CardGridSkeleton;

/* =========================================================================
   3. DETAIL DRAWER SKELETON
   Matches CaseDrilldownDrawer.tsx slide-over structure
   ========================================================================= */

export interface DetailDrawerSkeletonProps {
  className?: string;
}

export function DetailDrawerSkeleton({ className = "" }: DetailDrawerSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading case details drawer"
      aria-busy="true"
      className={`bg-white dark:bg-slate-900 h-full flex flex-col ${className}`}
    >
      {/* Drawer Header */}
      <div className="p-5 border-b border-[#DCE5E1] dark:border-slate-800 flex justify-between items-start">
        <div className="space-y-1.5 flex-1">
          <div className="h-5 w-36 bg-slate-200/70 dark:bg-slate-800/70 rounded animate-pulse" />
          <div className="h-3.5 w-52 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 animate-pulse" />
      </div>

      {/* Drawer Body Content */}
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Kickoff Banner Skeleton */}
        <div className="h-16 w-full bg-[#EAF6F0] dark:bg-teal-950/30 rounded-lg border border-[#B9DED4] dark:border-teal-800/40 p-3.5 flex justify-between items-center animate-pulse">
          <div className="space-y-1.5">
            <div className="h-3.5 w-44 bg-[#B9DED4] dark:bg-teal-800/60 rounded" />
            <div className="h-3 w-60 bg-[#DDEFE8] dark:bg-teal-900/50 rounded" />
          </div>
          <div className="h-7 w-20 bg-[#0D6866]/20 dark:bg-teal-700/30 rounded-md" />
        </div>

        {/* Stepper Timeline Skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-32 bg-slate-200/70 dark:bg-slate-800/70 rounded animate-pulse" />
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`drawer-step-${idx}`} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-200/70 dark:bg-slate-800/70 animate-pulse flex-shrink-0" />
                <div
                  className="h-3.5 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse"
                  style={{ width: `${40 + idx * 8}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Profile Card Skeleton */}
        <div className="p-4 bg-[#F8F7F2] dark:bg-slate-800/40 rounded-xl border border-[#DCE5E1] dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200/70 dark:bg-slate-700 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-slate-200/70 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#DCE5E1] dark:border-slate-700">
            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-[#DCE5E1] dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
        <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 animate-pulse" />
          <div className="h-9 w-36 bg-[#0D6866]/20 dark:bg-teal-700/30 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. DOSSIER SKELETON
   Supports variant="workbench" (DocumentDossierWorkbench) and variant="drawer" (CaseDrilldownDrawer)
   ========================================================================= */

export interface DossierSkeletonProps {
  variant?: "workbench" | "drawer";
  className?: string;
}

export function DossierSkeleton({
  variant = "workbench",
  className = "",
}: DossierSkeletonProps) {
  if (variant === "drawer") {
    return <DetailDrawerSkeleton className={className} />;
  }

  /* Workbench Split-Pane Variant */
  return (
    <div
      role="status"
      aria-label="Loading document dossier workbench"
      aria-busy="true"
      className={`flex flex-col h-full bg-[#071917] text-slate-100 rounded-xl overflow-hidden border border-[#1b3a36] shadow-2xl ${className}`}
    >
      {/* 1. Top Provenance & Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#0b2422] border-b border-[#1b3a36]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-500/50 animate-pulse" />
          <div className="h-5 w-48 bg-slate-700 rounded animate-pulse" />
          <div className="h-5 w-16 bg-[#133c38] rounded-full border border-[#215751] animate-pulse" />
          <div className="h-5 w-24 bg-emerald-950/80 rounded-full border border-emerald-800 animate-pulse" />
          <div className="h-5 w-36 bg-[#061816] rounded border border-[#18423e] animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-36 bg-emerald-950/60 rounded-md border border-emerald-800/60 animate-pulse" />
          <div className="h-6 w-24 bg-[#061b19] rounded-full border border-[#1b3a36] animate-pulse" />
        </div>
      </div>

      {/* 2. Pipeline Stepper Bar */}
      <div className="px-5 py-3 bg-[#08201d] border-b border-[#1b3a36]">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="h-3 w-36 bg-teal-900/60 rounded animate-pulse" />
          <div className="h-3 w-12 bg-emerald-800/60 rounded animate-pulse" />
        </div>
        {/* Track with 6 node dots */}
        <div className="flex items-center justify-between relative py-2">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-[#133c38] rounded" />
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`stepper-node-${idx}`}
              className="w-3.5 h-3.5 rounded-full bg-[#1b4e48] border-2 border-[#08201d] z-10 animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* 3. Split-Pane Workspace (7 cols left, 5 cols right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[580px] overflow-hidden">
        {/* Left Column: Document Surface Viewport (7 cols) */}
        <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-[#1b3a36] bg-[#051312] overflow-hidden">
          {/* Surface Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#081f1d] border-b border-[#1b3a36]">
            <div className="h-7 w-28 bg-[#051413] rounded-lg border border-[#1b3a36] animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-32 bg-[#051413] rounded-md border border-[#1b3a36] animate-pulse" />
              <div className="h-6 w-28 bg-[#051413] rounded-md border border-[#1b3a36] animate-pulse" />
            </div>
            <div className="h-6 w-24 bg-[#0D6866]/30 rounded animate-pulse" />
          </div>

          {/* Canvas Viewport: Simulated Paper Sheet */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#040d0c]">
            <div className="w-[480px] h-[600px] bg-white rounded-lg shadow-2xl p-8 flex flex-col justify-between select-none animate-pulse">
              {/* Document Header & Seal */}
              <div className="space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-200 mx-auto" />
                <div className="h-4 w-3/4 bg-slate-300 rounded mx-auto" />
                <div className="h-3 w-1/2 bg-slate-200 rounded mx-auto" />
              </div>

              {/* Body Paragraphs */}
              <div className="space-y-3">
                <div className="h-3 w-full bg-slate-200 rounded" />
                <div className="h-3 w-5/6 bg-slate-200 rounded" />
                <div className="h-3 w-4/5 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-200 rounded" />
                <div className="h-3 w-2/3 bg-slate-200 rounded" />
              </div>

              {/* Table / Form Block */}
              <div className="border border-slate-200 rounded p-3 space-y-2 bg-slate-50">
                <div className="h-3 w-1/3 bg-slate-300 rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-4 border-t border-slate-200">
                <div className="space-y-1">
                  <div className="w-24 h-0.5 bg-slate-300" />
                  <div className="h-2.5 w-20 bg-slate-200 rounded" />
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200" />
                <div className="space-y-1">
                  <div className="w-24 h-0.5 bg-slate-300" />
                  <div className="h-2.5 w-20 bg-slate-200 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Field Extraction Inspector (5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-[#071917] overflow-hidden">
          {/* Tabs Bar */}
          <div className="px-4 py-2.5 bg-[#081f1d] border-b border-[#1b3a36] flex items-center gap-1.5 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={`tab-skel-${idx}`}
                className="h-7 w-20 bg-[#0f2e2a] rounded-md border border-[#1b3a36] animate-pulse flex-shrink-0"
              />
            ))}
          </div>

          {/* Inspector Content & Field Cards */}
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {/* Search Input Skeleton */}
            <div className="h-9 w-full bg-[#0a221f] rounded-lg border border-[#1b3a36] animate-pulse" />

            {/* Field Extraction Cards */}
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`field-skel-${idx}`}
                className="p-3.5 bg-[#0b2422] rounded-lg border border-[#1b3a36] space-y-2.5"
              >
                <div className="flex justify-between items-center">
                  <div className="h-3.5 w-32 bg-slate-700 rounded animate-pulse" />
                  <div className="h-4 w-14 bg-teal-900/60 rounded-full border border-teal-800 animate-pulse" />
                </div>
                <div className="h-9 w-full bg-[#051413] rounded border border-[#18423e] animate-pulse" />
                <div className="flex justify-between items-center pt-1">
                  <div className="h-3 w-40 bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
