import React from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "critical"
  | "info"
  | "neutral"
  | "verified"
  | "review"
  | "action";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  showDot = true,
  className = "",
}: BadgeProps) {
  // Map domain states to token variants
  const resolvedVariant =
    variant === "verified"
      ? "success"
      : variant === "review"
      ? "info"
      : variant === "action"
      ? "critical"
      : variant;

  const styleMap: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    success: {
      bg: "var(--success-soft, #f0fdf4)",
      text: "var(--success, #15803d)",
      dot: "#22c55e",
      border: "#bbf7d0",
    },
    warning: {
      bg: "var(--warning-soft, #fffbeb)",
      text: "var(--warning, #b45309)",
      dot: "#f59e0b",
      border: "#fde68a",
    },
    critical: {
      bg: "var(--critical-soft, #fef2f2)",
      text: "var(--critical, #b91c1c)",
      dot: "#ef4444",
      border: "#fecaca",
    },
    info: {
      bg: "var(--info-soft, #f0f9ff)",
      text: "var(--info, #0369a1)",
      dot: "#0284c7",
      border: "#bae6fd",
    },
    neutral: {
      bg: "var(--surface-subtle, #f1f5f9)",
      text: "var(--muted, #475569)",
      dot: "#94a3b8",
      border: "#e2e8f0",
    },
  };

  const current = styleMap[resolvedVariant] || styleMap.neutral;
  const padding = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? "11px" : "12px";

  return (
    <span
      className={`inline-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: "9999px",
        background: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        lineHeight: 1.2,
      }}
    >
      {showDot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: current.dot,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
