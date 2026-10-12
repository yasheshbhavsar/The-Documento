import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  children,
  className = "",
  disabled,
  style,
  ...props
}: ButtonProps) {
  // Styles based on variant
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "primary":
        return {
          background: "var(--accent, #1d4ed8)",
          color: "#ffffff",
          border: "1px solid transparent",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        };
      case "secondary":
        return {
          background: "var(--surface-subtle, #f1f5f9)",
          color: "var(--text, #0f172a)",
          border: "1px solid var(--border, #e2e8f0)",
        };
      case "outline":
        return {
          background: "transparent",
          color: "var(--text, #0f172a)",
          border: "1px solid var(--border-strong, #cbd5e1)",
        };
      case "ghost":
        return {
          background: "transparent",
          color: "var(--muted, #475569)",
          border: "1px solid transparent",
        };
      case "danger":
        return {
          background: "var(--critical, #b91c1c)",
          color: "#ffffff",
          border: "1px solid transparent",
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case "sm":
        return {
          padding: "6px 12px",
          fontSize: "13px",
          minHeight: "36px",
        };
      case "lg":
        return {
          padding: "12px 24px",
          fontSize: "16px",
          minHeight: "48px",
        };
      case "md":
      default:
        return {
          padding: "8px 16px",
          fontSize: "14px",
          minHeight: "42px",
        };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 600,
    borderRadius: "var(--radius-sm, 8px)",
    cursor: disabled || isLoading ? "not-allowed" : "pointer",
    opacity: disabled || isLoading ? 0.65 : 1,
    transition: "all 0.15s ease",
    textDecoration: "none",
    outline: "none",
    ...getSizeStyles(),
    ...getVariantStyles(),
    ...style,
  };

  return (
    <button
      className={`btn btn-${variant} ${className}`}
      style={baseStyles}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            display: "inline-block",
            width: "14px",
            height: "14px",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
          aria-label="Loading..."
        />
      ) : (
        icon && <span className="btn-icon" aria-hidden="true">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
