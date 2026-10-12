import React from "react";

export interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = "",
  style,
}: CardProps) {
  return (
    <div
      className={`card-container ${className}`}
      style={{
        background: "var(--surface, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "var(--radius, 12px)",
        padding: "20px",
        boxShadow: "var(--shadow, 0 1px 3px rgba(15, 23, 42, 0.05))",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        ...style,
      }}
    >
      {(title || subtitle || badge || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            borderBottom: "1px solid var(--surface-subtle, #f1f5f9)",
            paddingBottom: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {title && (
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "13px",
                  color: "var(--muted, #475569)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div style={{ display: "flex", gap: "8px" }}>{actions}</div>}
        </div>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
