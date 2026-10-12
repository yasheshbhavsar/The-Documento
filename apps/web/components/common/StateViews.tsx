import React from "react";
import { Button } from "./Button";

export function LoadingState({ message = "Loading data..." }: { message?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: "12px",
        color: "var(--muted, #475569)",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          border: "3px solid var(--border, #e2e8f0)",
          borderTopColor: "var(--accent, #1d4ed8)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <span style={{ fontSize: "14px", fontWeight: 550 }}>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "📂",
  action,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--surface, #ffffff)",
        border: "1px dashed var(--border-strong, #cbd5e1)",
        borderRadius: "var(--radius, 12px)",
        gap: "10px",
      }}
    >
      <div style={{ fontSize: "32px" }}>{icon}</div>
      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text, #0f172a)" }}>
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #475569)", maxWidth: "380px" }}>
        {description}
      </p>
      {action && <div style={{ marginTop: "8px" }}>{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: "24px",
        background: "var(--critical-soft, #fef2f2)",
        border: "1px solid #fecaca",
        borderRadius: "var(--radius, 12px)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "18px" }}>⚠️</span>
        <strong style={{ fontSize: "15px", color: "var(--critical, #b91c1c)" }}>{title}</strong>
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "#991b1b" }}>{message}</p>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
