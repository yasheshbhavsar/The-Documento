import React, { useState, useEffect } from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { UserContext, UserExperience } from "../../lib/types";
import { DEMO_USERS, authenticateUser } from "../../lib/auth";

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
  const [portal, setPortal] = useState<"firm" | "client">(initialPortal);
  const [email, setEmail] = useState<string>("sarah.jenkins@vanguardlegal.com");
  const [password, setPassword] = useState<string>("••••••••••••");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

    // Auto submit demo login smoothly
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess(demoUser);
    }, 400);
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
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || "Authentication failed. Please verify your credentials.");
      }
    }, 500);
  };

  const handleSsoClick = (provider: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Seamlessly log in as Lead Counsel via SSO
      const targetUser = portal === "client" ? DEMO_USERS.client_applicant : DEMO_USERS.master_admin;
      onLoginSuccess({
        ...targetUser,
        email: `${provider.toLowerCase().replace(/\s+/g, "")}@sso.vanguardlegal.com`,
      });
    }, 600);
  };

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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#DDEFE8";
            e.currentTarget.style.color = "#063C3D";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#F1F6F4";
            e.currentTarget.style.color = "#445451";
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

        {/* 1-Click Demo Evaluation Bar */}
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
            <span>One-Click Demo Personas:</span>
            <span style={{ color: "#6E7F7C", textTransform: "none", fontWeight: 400 }}>Test drive</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={() => handleQuickDemoSelect("master_admin")}
              className="hover-lift"
              style={{
                background: "linear-gradient(180deg, #FFFFFF 0%, #F4FAF7 100%)",
                border: "1px solid #B9DED4",
                borderRadius: "8px",
                padding: "8px 6px",
                fontSize: "11px",
                fontWeight: 650,
                color: "#063C3D",
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.05)",
                transition: "all 0.16s ease",
              }}
              title="Sarah Jenkins, Esq. (Managing Partner)"
            >
              <span style={{ fontSize: "14px" }}>🏛️</span>
              <span style={{ fontWeight: 700 }}>Partner</span>
              <span style={{ fontSize: "9px", color: "#6E7F7C", fontWeight: 500 }}>Managing</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoSelect("case_manager")}
              className="hover-lift"
              style={{
                background: "linear-gradient(180deg, #FFFFFF 0%, #F2F8F8 100%)",
                border: "1px solid #A2CFC7",
                borderRadius: "8px",
                padding: "8px 6px",
                fontSize: "11px",
                fontWeight: 650,
                color: "#0D6866",
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.05)",
                transition: "all 0.16s ease",
              }}
              title="Marcus Vance (Senior Paralegal)"
            >
              <span style={{ fontSize: "14px" }}>⚖️</span>
              <span style={{ fontWeight: 700 }}>Paralegal</span>
              <span style={{ fontSize: "9px", color: "#6E7F7C", fontWeight: 500 }}>Casework</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoSelect("client_applicant")}
              className="hover-lift"
              style={{
                background: "linear-gradient(180deg, #FFFFFF 0%, #F0F6FF 100%)",
                border: "1px solid #BFDBFE",
                borderRadius: "8px",
                padding: "8px 6px",
                fontSize: "11px",
                fontWeight: 650,
                color: "#1E40AF",
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                boxShadow: "0 1px 3px rgba(30, 64, 175, 0.05)",
                transition: "all 0.16s ease",
              }}
              title="Dr. Aris Thorne (EB-1A Applicant)"
            >
              <span style={{ fontSize: "14px" }}>👤</span>
              <span style={{ fontWeight: 700 }}>Client</span>
              <span style={{ fontSize: "9px", color: "#6E7F7C", fontWeight: 500 }}>Applicant</span>
            </button>
          </div>
        </div>

        {/* Error message */}
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
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Forgot password feedback */}
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

        {/* Credentials Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="auth-email-input"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#172322",
                marginBottom: "6px",
              }}
            >
              {portal === "firm" ? "Law Firm Business Email" : "Applicant Email Address"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="auth-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={portal === "firm" ? "attorney@vanguardlegal.com" : "applicant@domain.com"}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 36px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  color: "#172322",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0D6866")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#DCE5E1")}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6E7F7C"
                strokeWidth="2"
                style={{ position: "absolute", left: "12px", top: "12px", pointerEvents: "none" }}
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label
                htmlFor="auth-password-input"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#172322",
                }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setForgotPasswordNotice(`Password reset instructions dispatched to ${email}.`)}
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
                id="auth-password-input"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 36px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  color: "#172322",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0D6866")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#DCE5E1")}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6E7F7C"
                strokeWidth="2"
                style={{ position: "absolute", left: "12px", top: "12px", pointerEvents: "none" }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
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
                  padding: "2px 4px",
                }}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
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

          {/* Primary Submit Button */}
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
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = "#063C3D";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(6, 60, 61, 0.25)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = "#0D6866";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(13, 104, 102, 0.2)";
              }
            }}
          >
            {isLoading ? (
              <span>Authenticating Secure Session...</span>
            ) : (
              <>
                <span>Sign In to {portal === "firm" ? "Firm Workspace" : "Client Portal"}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Enterprise SSO Separator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "22px 0 16px 0",
            color: "#6E7F7C",
            fontSize: "12px",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "#DCE5E1" }} />
          <span style={{ padding: "0 10px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.03em" }}>
            Or continue with SSO
          </span>
          <div style={{ flex: 1, height: "1px", background: "#DCE5E1" }} />
        </div>

        {/* SSO Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
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
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F1F6F4";
              e.currentTarget.style.borderColor = "#0D6866";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.borderColor = "#DCE5E1";
            }}
          >
            <span style={{ fontSize: "14px" }}>🏢</span>
            <span>Microsoft 365</span>
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
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F1F6F4";
              e.currentTarget.style.borderColor = "#0D6866";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.borderColor = "#DCE5E1";
            }}
          >
            <span style={{ fontSize: "14px" }}>🌐</span>
            <span>Google Workspace</span>
          </button>
        </div>

        {/* Security & Compliance Badge */}
        <div
          style={{
            borderTop: "1px solid #F1F6F4",
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
