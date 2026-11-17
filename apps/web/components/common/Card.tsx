import React from "react";

export interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "flat" | "flush" | "subtle" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  title,
  subtitle,
  badge,
  actions,
  action,
  children,
  className = "",
  style,
  variant = "default",
  padding,
}: CardProps) {
  const headerActions = actions ?? action;
  const isTight = variant !== "default";

  // Compute padding based on prop or variant default
  let paddingValue = "20px";
  if (padding === "none") {
    paddingValue = "0px";
  } else if (padding === "sm") {
    paddingValue = "12px 14px";
  } else if (padding === "md") {
    paddingValue = "16px 20px";
  } else if (padding === "lg") {
    paddingValue = "24px 28px";
  } else if (variant === "flush") {
    paddingValue = "0px";
  }

  // Variant styling defaults
  let background = "var(--surface, #ffffff)";
  let border = "1px solid var(--border, #DCE5E1)";
  let borderRadius: string | number = "var(--radius, 12px)";
  let boxShadow = "var(--shadow, 0 1px 3px rgba(6, 60, 61, 0.05))";

  if (variant === "flat") {
    boxShadow = "none";
  } else if (variant === "flush") {
    border = "none";
    borderRadius = "0px";
    boxShadow = "none";
  } else if (variant === "subtle") {
    background = "var(--surface-subtle, #F8F7F2)";
    boxShadow = "none";
  } else if (variant === "ghost") {
    background = "transparent";
    border = "none";
    borderRadius = "0px";
    boxShadow = "none";
  }

  return (
    <div
      className={`card-container ${variant !== "default" ? `card-${variant}` : ""} ${className}`.trim()}
      data-variant={variant}
      style={{
        background,
        border,
        borderRadius,
        padding: paddingValue,
        boxShadow,
        display: "flex",
        flexDirection: "column",
        gap: variant === "flush" ? "10px" : "14px",
        ...style,
      }}
    >
      {(title || subtitle || badge || headerActions) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            borderBottom:
              variant === "ghost"
                ? "none"
                : variant === "flush"
                ? "1px solid var(--hairline, rgba(6, 60, 61, 0.08))"
                : "1px solid var(--surface-subtle, #F1F6F4)",
            paddingBottom: variant === "flush" ? "8px" : "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {title && (
                <h3
                  style={{
                    margin: 0,
                    fontSize: isTight ? "14px" : "16px",
                    fontWeight: isTight ? 650 : 700,
                    color: "var(--text, #172322)",
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
                  fontSize: isTight ? "12px" : "13px",
                  color: "var(--muted, #6E7F7C)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && <div style={{ display: "flex", gap: "8px" }}>{headerActions}</div>}
        </div>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
