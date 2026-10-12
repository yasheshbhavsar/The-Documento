import React from "react";

export type AlertType = "success" | "warning" | "critical" | "info";

export interface AlertBannerProps {
  type?: AlertType;
  title?: string;
  message: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
}

export function AlertBanner({
  type = "info",
  title,
  message,
  action,
  onDismiss,
}: AlertBannerProps) {
  const styles: Record<AlertType, { bg: string; border: string; text: string; icon: string }> = {
    success: {
      bg: "var(--success-soft, #f0fdf4)",
      border: "#bbf7d0",
      text: "var(--success, #15803d)",
      icon: "✓",
    },
    warning: {
      bg: "var(--warning-soft, #fffbeb)",
      border: "#fde68a",
      text: "var(--warning, #b45309)",
      icon: "⚠",
    },
    critical: {
      bg: "var(--critical-soft, #fef2f2)",
      border: "#fecaca",
      text: "var(--critical, #b91c1c)",
      icon: "✖",
    },
    info: {
      bg: "var(--info-soft, #f0f9ff)",
      border: "#bae6fd",
      text: "var(--info, #0369a1)",
      icon: "ℹ",
    },
  };

  const current = styles[type];

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        background: current.bg,
        border: `1px solid ${current.border}`,
        borderRadius: "var(--radius-sm, 8px)",
        color: current.text,
        fontSize: "13px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: "14px",
            lineHeight: 1.4,
          }}
          aria-hidden="true"
        >
          {current.icon}
        </span>
        <div>
          {title && <strong style={{ display: "block", marginBottom: "2px" }}>{title}</strong>}
          <span>{message}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: "14px",
              opacity: 0.75,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
