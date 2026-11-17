import React, { useState, useMemo } from "react";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  filterOptions?: {
    label: string;
    field: keyof T;
    options: { label: string; value: string }[];
  };
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  hideSearch?: boolean;
  isLoading?: boolean;
  skeletonRows?: number;
  variant?: "boxed" | "flush";
  className?: string;
  style?: React.CSSProperties;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  searchPlaceholder = "Search records...",
  searchFields = [],
  filterOptions,
  pageSize = 6,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription = "No data matches your current search or filter criteria.",
  actions,
  hideSearch = false,
  isLoading = false,
  skeletonRows,
  variant = "flush",
  className = "",
  style,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const isFlush = variant === "flush";

  // Filter and Search
  const filteredData = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.filter((item) => {
      // 1. Category/status filter
      if (filterOptions && activeFilter !== "all") {
        if (String(item[filterOptions.field]) !== activeFilter) {
          return false;
        }
      }

      // 2. Search term
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();

      if (searchFields.length > 0) {
        return searchFields.some((field) => {
          const val = item[field];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(lowerSearch);
        });
      }

      // Default search across all string/number fields
      return Object.values(item).some((val) =>
        val !== undefined && val !== null && String(val).toLowerCase().includes(lowerSearch)
      );
    });
  }, [data, searchTerm, activeFilter, filterOptions, searchFields]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return (
    <div
      className={`data-table-root ${isFlush ? "data-table-flush" : "data-table-boxed"} ${className}`.trim()}
      data-variant={variant}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        width: "100%",
        ...style,
      }}
    >
      {/* Controls Bar: Search, Filter, Actions */}
      {(!hideSearch || filterOptions || actions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, minWidth: "260px" }}>
            {/* Search Input */}
            {!hideSearch && (
              <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label={searchPlaceholder}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    fontSize: "13px",
                    border: "1px solid var(--border, #DCE5E1)",
                    borderRadius: "var(--radius-sm, 8px)",
                    background: "var(--surface, #ffffff)",
                    color: "var(--text, #172322)",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--quiet, #6E7F7C)",
                    pointerEvents: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-hidden="true"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
              </div>
            )}

          {/* Filter dropdown */}
          {filterOptions && (
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label={`Filter by ${filterOptions.label}`}
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-sm, 8px)",
                background: "var(--surface, #ffffff)",
                color: "var(--text, #0f172a)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All {filterOptions.label}s</option>
              {filterOptions.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {actions && <div style={{ display: "flex", gap: "8px" }}>{actions}</div>}
      </div>
    )}

      {/* Table Container */}
      <div
        className={`data-table-container ${isFlush ? "data-table-container-flush" : "data-table-container-boxed"}`}
        style={{
          border: isFlush ? "none" : "1px solid var(--border, #e2e8f0)",
          borderRadius: isFlush ? "0px" : "var(--radius, 12px)",
          overflow: "hidden",
          background: "var(--surface, #ffffff)",
          boxShadow: isFlush ? "none" : "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ background: "var(--surface-subtle, #F8F7F2)", borderBottom: "1px solid var(--border, #DCE5E1)" }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    tabIndex={col.sortable ? 0 : undefined}
                    aria-sort={sortKey === col.key ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                    onKeyDown={(e) => {
                      if (col.sortable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handleSort(col.key);
                      }
                    }}
                    style={{
                      padding: "10px 16px",
                      fontWeight: 600,
                      color: "var(--muted, #445451)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      width: col.width,
                      cursor: col.sortable ? "pointer" : "default",
                      userSelect: "none",
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span style={{ fontSize: "11px", color: sortKey === col.key ? "var(--accent)" : "var(--quiet)" }}>
                          {sortKey === col.key ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: skeletonRows ?? pageSize }).map((_, rIdx) => (
                  <tr
                    key={`dt-skeleton-row-${rIdx}`}
                    style={{
                      borderBottom: "1px solid var(--border, #DCE5E1)",
                    }}
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={`dt-skeleton-cell-${cIdx}`}
                        style={{
                          padding: "14px 16px",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          className="h-3.5 bg-slate-200/80 dark:bg-slate-700/80 rounded animate-pulse"
                          style={{
                            width: cIdx === 0 ? "70%" : cIdx === columns.length - 1 ? "40%" : "55%",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <tr
                    key={keyExtractor(row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={() => onRowClick && onRowClick(row)}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }}
                    style={{
                      borderBottom: idx === paginatedData.length - 1 ? "none" : "1px solid var(--border, #DCE5E1)",
                      cursor: onRowClick ? "pointer" : "default",
                      transition: "background-color 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (onRowClick) e.currentTarget.style.backgroundColor = "var(--surface-subtle, #F8F7F2)";
                    }}
                    onMouseLeave={(e) => {
                      if (onRowClick) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: "12px 16px",
                          color: "var(--text, #172322)",
                          verticalAlign: "middle",
                        }}
                      >
                        {col.render ? col.render(row) : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} style={{ padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: "var(--quiet, #6E7F7C)" }}
                        aria-hidden="true"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <strong style={{ fontSize: "15px", color: "var(--text, #0f172a)" }}>{emptyTitle}</strong>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #475569)", maxWidth: "340px" }}>
                        {emptyDescription}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border, #DCE5E1)",
            background: isFlush ? "var(--surface, #ffffff)" : "var(--surface-subtle, #F1F6F4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "var(--muted, #445451)",
          }}
        >
          <div>
            Showing <strong>{sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{" "}
            <strong>{Math.min(currentPage * pageSize, sortedData.length)}</strong> of{" "}
            <strong>{sortedData.length}</strong> entries
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontWeight: 600 }}>
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
