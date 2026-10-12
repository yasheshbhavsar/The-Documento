import React, { useEffect, useRef } from "react";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "md",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Close on Escape key and manage focus
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Focus modal container
    modalRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthMap = {
    sm: "420px",
    md: "560px",
    lg: "740px",
    xl: "960px",
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 12px)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          width: "100%",
          maxWidth: maxWidthMap[maxWidth],
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <h2
              id="modal-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--quiet, #64748b)",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border, #e2e8f0)",
              background: "var(--surface-subtle, #f1f5f9)",
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
