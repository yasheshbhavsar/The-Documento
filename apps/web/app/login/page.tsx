"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { DocumentoLogo } from "../../components/common/DocumentoLogo";
import { AuthForm } from "../../components/auth/AuthForm";
import { UserContext } from "../../lib/types";

export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = (userObj: UserContext) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("documento_user", JSON.stringify(userObj));
      sessionStorage.removeItem("documento_user");
    }
    router.push(userObj.role === "platform_super_admin" ? "/super-admin" : "/");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8F7F2 0%, #FFFFFF 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        padding: "24px 16px",
      }}
    >
      {/* Top Bar with back link */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <a href="/" style={{ textDecoration: "none" }}>
          <DocumentoLogo size="md" showWordmark={true} />
        </a>
        <a
          href="/"
          style={{
            fontSize: "13px",
            color: "#0D6866",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>← Return to Documento Overview</span>
        </a>
      </div>

      {/* Center Card */}
      <div style={{ maxWidth: "460px", margin: "40px auto", width: "100%" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #DCE5E1",
            boxShadow: "0 20px 50px rgba(6, 60, 61, 0.1), 0 2px 8px rgba(6, 60, 61, 0.04)",
            padding: "36px 32px 30px 32px",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 750,
                color: "#063C3D",
                margin: "0 0 6px 0",
                letterSpacing: "-0.02em",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Sign in to Documento
            </h1>
            <p style={{ fontSize: "13px", color: "#6E7F7C", margin: 0 }}>
              Immigration case intelligence &amp; evidence platform
            </p>
          </div>

          <AuthForm idPrefix="page" initialPortal="firm" onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "12px", color: "#6E7F7C", padding: "16px" }}>
        © 2026 Documento. 256-bit TLS encrypted session • Strict Tenant Schema Boundaries.
      </div>
    </div>
  );
}
