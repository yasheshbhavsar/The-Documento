"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { DocumentoLogo } from "../components/common/DocumentoLogo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client error to monitoring console
    console.error("[Documento UI Engine Error Boundary]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8F7F2 0%, #EAF2EE 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        color: "#063C3D",
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "540px",
          width: "100%",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "20px",
          border: "1px solid rgba(220, 229, 225, 0.9)",
          boxShadow: "0 24px 60px rgba(6, 60, 61, 0.16)",
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "20px" }}>
          <DocumentoLogo size="lg" showWordmark={true} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 12px",
            borderRadius: "20px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            fontSize: "12px",
            fontWeight: 700,
            color: "#B91C1C",
            marginBottom: "16px",
            fontFamily: "monospace",
          }}
        >
          <span>EVIDENTIARY RUNTIME RECOVERY</span>
        </div>

        <h1
          style={{
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            margin: "0 0 12px 0",
            fontFamily: "var(--font-display, Inter, sans-serif)",
            color: "#063C3D",
          }}
        >
          Workspace Session Interrupted
        </h1>

        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#445451",
            margin: "0 0 20px 0",
          }}
        >
          An unexpected interface anomaly occurred while processing case state. Tenant data isolation and evidentiary archives remain completely safe and untampered.
        </p>

        {error.message && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#F8F7F2",
              border: "1px solid #E2E8F0",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#64748B",
              marginBottom: "24px",
              textAlign: "left",
              overflowX: "auto",
              maxHeight: "100px",
            }}
          >
            {error.message}
            {error.digest && (
              <div style={{ marginTop: "4px", color: "#94A3B8" }}>
                Digest: {error.digest}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => reset()}
            className="hover-lift"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "11px 22px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0D6866 0%, #063C3D 100%)",
              color: "#FFFFFF",
              fontWeight: 650,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(6, 60, 61, 0.2)",
              transition: "all 0.16s ease",
            }}
          >
            ↻ Retry Active View
          </button>

          <Link
            href="/"
            className="hover-lift"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "11px 20px",
              borderRadius: "10px",
              background: "#FFFFFF",
              border: "1px solid #B9DED4",
              color: "#063C3D",
              fontWeight: 600,
              fontSize: "13px",
              textDecoration: "none",
              transition: "all 0.16s ease",
            }}
          >
            Return to Case Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
