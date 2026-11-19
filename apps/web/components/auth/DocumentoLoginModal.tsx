"use client";

import React, { useEffect } from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { AuthForm } from "./AuthForm";
import { UserContext } from "../../lib/types";

interface DocumentoLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserContext) => void;
  initialPortal?: "firm" | "client";
}

export function DocumentoLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  initialPortal = "firm",
}: DocumentoLoginModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(6, 60, 61, 0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "490px",
          background: "linear-gradient(180deg, #FFFFFF 0%, #FAFCFB 100%)",
          borderRadius: "20px",
          border: "1px solid rgba(185, 222, 212, 0.8)",
          boxShadow: "0 28px 70px rgba(6, 60, 61, 0.24), 0 8px 24px rgba(6, 60, 61, 0.08)",
          padding: "36px 32px 28px 32px",
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close login dialog"
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "#F1F6F4",
            border: "1px solid #DCE5E1",
            color: "#445451",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "16px",
            lineHeight: 1,
            transition: "all 0.15s ease",
          }}
        >
          ✕
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "12px" }}>
            <DocumentoLogo size="lg" showWordmark={true} />
          </div>
          <h2
            id="login-modal-title"
            style={{
              fontSize: "22px",
              fontWeight: 750,
              color: "#063C3D",
              margin: "0 0 6px 0",
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Sign in to Documento
          </h2>
          <p style={{ fontSize: "13px", color: "#6E7F7C", margin: 0 }}>
            Unified immigration casework and evidentiary intelligence
          </p>
        </div>

        <AuthForm
          idPrefix="auth"
          initialPortal={initialPortal}
          onLoginSuccess={onLoginSuccess}
        />

        {/* Security & Compliance Badge */}
        <div
          style={{
            borderTop: "1px solid #F1F6F4",
            marginTop: "16px",
            paddingTop: "16px",
            textAlign: "center",
            fontSize: "11px",
            color: "#6E7F7C",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#176B50" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>TLS 1.3 256-bit Encryption • Multi-Tenant Schema Isolation</span>
        </div>
      </div>
    </div>
  );
}
