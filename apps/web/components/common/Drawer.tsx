import React, { useEffect, useRef } from "react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = "lg",
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthMap = {
    md: "460px",
    lg: "640px",
    xl: "840px",
  };

  return (
    <div
      className="drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 1000,
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        style={{
          background: "var(--surface, #ffffff)",
          borderLeft: "1px solid var(--border, #e2e8f0)",
          boxShadow: "-10px 0 25px -5px rgba(0, 0, 0, 0.1)",
          width: "100%",
          maxWidth: widthMap[width],
          height: "100%",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          animation: "slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #DCE5E1)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            background: "var(--surface, #ffffff)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2
                id="drawer-title"
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--text, #172322)",
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "13px",
                  color: "var(--muted, #6E7F7C)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--quiet, #6E7F7C)",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            background: "var(--bg, #F8F7F2)",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border, #DCE5E1)",
              background: "var(--surface, #ffffff)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
