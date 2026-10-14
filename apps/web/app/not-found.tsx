"use client";

import React from "react";
import Link from "next/link";
import { DocumentoLogo } from "../components/common/DocumentoLogo";

export default function NotFound() {
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
          maxWidth: "520px",
          width: "100%",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "20px",
          border: "1px solid rgba(185, 222, 212, 0.8)",
          boxShadow: "0 20px 50px rgba(6, 60, 61, 0.12)",
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
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            fontSize: "12px",
            fontWeight: 700,
            color: "#991B1B",
            marginBottom: "16px",
            fontFamily: "monospace",
          }}
        >
          <span>HTTP 404 • RECORD UNRESOLVED</span>
        </div>

        <h1
          style={{
            fontSize: "26px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            margin: "0 0 12px 0",
            fontFamily: "var(--font-display, Inter, sans-serif)",
            color: "#063C3D",
          }}
        >
          Dossier Endpoint Not Located
        </h1>

        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#445451",
            margin: "0 0 28px 0",
          }}
        >
          The requested petition file, evidentiary exhibit, or administrative endpoint may have been archived, transferred, or relocated under a new cryptographic audit identifier.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link
            href="/"
            className="hover-lift"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0D6866 0%, #063C3D 100%)",
              color: "#FFFFFF",
              fontWeight: 650,
              fontSize: "13px",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(6, 60, 61, 0.2)",
              transition: "all 0.16s ease",
            }}
          >
            <span>Return to Case Intelligence Workspace</span>
            <span>→</span>
          </Link>

          <Link
            href="/login"
            className="hover-lift"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 18px",
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
            Access Law Firm Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
