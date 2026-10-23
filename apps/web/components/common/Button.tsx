import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "outline-inverted" | "ghost" | "danger";
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
          background: "var(--accent, #0D6866)",
          color: "#ffffff",
          border: "1px solid transparent",
          boxShadow: "0 1px 2px rgba(6, 60, 61, 0.08)",
        };
      case "secondary":
        return {
          background: "var(--surface-subtle, #F1F6F4)",
          color: "var(--text, #172322)",
          border: "1px solid var(--border, #DCE5E1)",
        };
      case "outline":
        return {
          background: "transparent",
          color: "var(--text, #172322)",
          border: "1px solid var(--border-strong, #BDCDC7)",
        };
      case "outline-inverted":
        return {
          background: "rgba(255, 255, 255, 0.1)",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.35)",
        };
      case "ghost":
        return {
          background: "transparent",
          color: "var(--muted, #445451)",
          border: "1px solid transparent",
        };
      case "danger":
        return {
          background: "var(--critical, #A62D35)",
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
