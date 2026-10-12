"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentoLogo } from "../../components/common/DocumentoLogo";
import { DEMO_USERS, authenticateUser } from "../../lib/auth";
import { UserExperience } from "../../lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [portal, setPortal] = useState<"firm" | "client">("firm");
  const [email, setEmail] = useState<string>("sarah.jenkins@vanguardlegal.com");
  const [password, setPassword] = useState<string>("••••••••••••");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState<string | null>(null);

  const handlePortalSwitch = (newPortal: "firm" | "client") => {
    setPortal(newPortal);
    setErrorMessage(null);
    setForgotPasswordNotice(null);
    if (newPortal === "client") {
      setEmail("dr.thorne@cambridge.edu");
    } else {
      setEmail("sarah.jenkins@vanguardlegal.com");
    }
  };

  const handleQuickDemoSelect = (roleKey: UserExperience) => {
    const demoUser = DEMO_USERS[roleKey];
    setEmail(demoUser.email);
    setPassword("DocumentoDemo2026!");
    setPortal(roleKey === "client_applicant" ? "client" : "firm");
    setErrorMessage(null);

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Store session and redirect to main app
      if (typeof window !== "undefined") {
        localStorage.setItem("documento_user", JSON.stringify(demoUser));
      }
      router.push("/");
    }, 450);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid business email address.");
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage("Password must be at least 4 characters.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const res = authenticateUser(email, portal);
      if (res.success && res.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("documento_user", JSON.stringify(res.user));
        }
        router.push("/");
      } else {
        setErrorMessage(res.error || "Authentication failed. Please verify credentials.");
      }
    }, 500);
  };

  const handleSsoClick = (provider: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const targetUser = portal === "client" ? DEMO_USERS.client_applicant : DEMO_USERS.master_admin;
      const user = {
        ...targetUser,
        email: `${provider.toLowerCase().replace(/\s+/g, "")}@sso.vanguardlegal.com`,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("documento_user", JSON.stringify(user));
      }
      router.push("/");
    }, 600);
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
      <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

          {/* Segmented Portal Switcher */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px",
              background: "#F1F6F4",
              padding: "4px",
              borderRadius: "10px",
              marginBottom: "20px",
              border: "1px solid #DCE5E1",
            }}
          >
            <button
              type="button"
              onClick={() => handlePortalSwitch("firm")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                background: portal === "firm" ? "#FFFFFF" : "transparent",
                color: portal === "firm" ? "#063C3D" : "#445451",
                boxShadow: portal === "firm" ? "0 2px 6px rgba(6, 60, 61, 0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Firm &amp; Attorney
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch("client")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                background: portal === "client" ? "#FFFFFF" : "transparent",
                color: portal === "client" ? "#063C3D" : "#445451",
                boxShadow: portal === "client" ? "0 2px 6px rgba(6, 60, 61, 0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Client &amp; Applicant
            </button>
          </div>

          {/* One-Click Demo Personas */}
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "12px 14px",
              marginBottom: "22px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 650,
                color: "#0D6866",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Instant Demo Sign-In:</span>
              <span style={{ color: "#6E7F7C", textTransform: "none", fontWeight: 400 }}>1-click access</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handleQuickDemoSelect("master_admin")}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#063C3D",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0D6866";
                  e.currentTarget.style.background = "#DDEFE8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#DCE5E1";
                  e.currentTarget.style.background = "#FFFFFF";
                }}
              >
                🏛️ Partner
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSelect("case_manager")}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#063C3D",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0D6866";
                  e.currentTarget.style.background = "#DDEFE8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#DCE5E1";
                  e.currentTarget.style.background = "#FFFFFF";
                }}
              >
                ⚖️ Paralegal
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSelect("client_applicant")}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#063C3D",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0D6866";
                  e.currentTarget.style.background = "#DDEFE8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#DCE5E1";
                  e.currentTarget.style.background = "#FFFFFF";
                }}
              >
                👤 Client
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#FDF2F2",
                border: "1px solid #F8B4B4",
                color: "#A62D35",
                fontSize: "12px",
                fontWeight: 550,
                marginBottom: "16px",
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Forgot Password Notice */}
          {forgotPasswordNotice && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#EAF6F0",
                border: "1px solid #B9DED4",
                color: "#176B50",
                fontSize: "12px",
                fontWeight: 550,
                marginBottom: "16px",
              }}
            >
              {forgotPasswordNotice}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="page-email-input"
                style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#172322", marginBottom: "6px" }}
              >
                {portal === "firm" ? "Law Firm Business Email" : "Applicant Email Address"}
              </label>
              <input
                id="page-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  color: "#172322",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label
                  htmlFor="page-password-input"
                  style={{ fontSize: "13px", fontWeight: 600, color: "#172322" }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordNotice(`Password reset instructions sent to ${email}.`)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: "12px",
                    fontWeight: 550,
                    color: "#0D6866",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="page-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #DCE5E1",
                    background: "#FFFFFF",
                    fontSize: "14px",
                    color: "#172322",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6E7F7C",
                    fontSize: "14px",
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#445451", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: "#0D6866" }}
                />
                <span>Remember this workstation</span>
              </label>
              <span style={{ fontSize: "11px", color: "#6E7F7C" }}>30-day session</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: "10px",
                background: "#0D6866",
                color: "#FFFFFF",
                border: "1px solid #063C3D",
                fontWeight: 650,
                fontSize: "15px",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(13, 104, 102, 0.2)",
              }}
            >
              {isLoading ? "Signing in..." : `Sign In to ${portal === "firm" ? "Firm Workspace" : "Client Portal"}`}
            </button>
          </form>

          {/* SSO Separator */}
          <div style={{ display: "flex", alignItems: "center", margin: "22px 0 16px 0", color: "#6E7F7C", fontSize: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "#DCE5E1" }} />
            <span style={{ padding: "0 10px", textTransform: "uppercase", fontSize: "11px" }}>Or continue with SSO</span>
            <div style={{ flex: 1, height: "1px", background: "#DCE5E1" }} />
          </div>

          {/* SSO Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              type="button"
              onClick={() => handleSsoClick("Microsoft 365")}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                color: "#172322",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              🏢 Microsoft 365
            </button>
            <button
              type="button"
              onClick={() => handleSsoClick("Google Workspace")}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                color: "#172322",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              🌐 Google Workspace
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "12px", color: "#6E7F7C", padding: "16px" }}>
        © 2026 Documento. 256-bit TLS encrypted session • Strict Tenant Schema Boundaries.
      </div>
    </div>
  );
}
