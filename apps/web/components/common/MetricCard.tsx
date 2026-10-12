import React, { useState } from "react";
import { Badge } from "./Badge";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  meaning: string; // Mandatory defined meaning
  onDrilldown?: () => void;
  drilldownLabel?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  isLiveApi?: boolean;
  statusBadge?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  subtext,
  meaning,
  onDrilldown,
  drilldownLabel = "View details →",
  trend,
  isLiveApi = false,
  statusBadge,
}: MetricCardProps) {
  const [showMeaning, setShowMeaning] = useState(false);

  return (
    <article
      className="metric-card-box"
      style={{
        background: "var(--surface, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "var(--radius, 12px)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "12px",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        position: "relative",
      }}
    >
      {/* Top row: Label & Info Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--muted, #475569)",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {statusBadge}
          {isLiveApi ? (
            <Badge variant="success" size="sm">Live</Badge>
          ) : (
            <Badge variant="neutral" size="sm">Fixture</Badge>
          )}
          <button
            type="button"
            onClick={() => setShowMeaning((prev) => !prev)}
            aria-label={`Definition for ${label}`}
            title="Click to view definition"
            className={`metric-info-btn ${showMeaning ? "active" : ""}`}
            suppressHydrationWarning
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
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Meaning Banner (Expandable/Accessible) */}
      {showMeaning && (
        <div
          role="note"
          aria-live="polite"
          style={{
            background: "var(--info-soft, #f0f9ff)",
            border: "1px solid #bae6fd",
            color: "var(--info, #0369a1)",
            padding: "8px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            lineHeight: 1.4,
          }}
        >
          <strong>Defined Meaning:</strong> {meaning}
        </div>
      )}

      {/* Metric Value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <strong
          style={{
            fontSize: "30px",
            fontWeight: 800,
            color: "var(--text, #0f172a)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}
        </strong>
        {trend && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: trend.isPositive ? "var(--success, #15803d)" : "var(--critical, #b91c1c)",
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            {trend.isPositive ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>

      {/* Subtext and Drilldown Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          borderTop: "1px solid var(--surface-subtle, #f1f5f9)",
          paddingTop: "10px",
          marginTop: "4px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--quiet, #64748b)" }}>
          {subtext || "Updated in real-time"}
        </span>
        {onDrilldown && (
          <button
            type="button"
            onClick={onDrilldown}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent, #1d4ed8)",
              fontSize: "12px",
              fontWeight: 650,
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "4px",
              transition: "text-decoration 0.1s ease",
            }}
          >
            {drilldownLabel}
          </button>
        )}
      </div>
    </article>
  );
}
