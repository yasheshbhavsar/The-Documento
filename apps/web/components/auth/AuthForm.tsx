"use client";

import React, { useState, useEffect } from "react";
import { UserContext, RoleCode } from "../../lib/types";
import { authenticateUser } from "../../lib/auth";
import { api, setAccessToken } from "../../lib/api";

export interface AuthFormProps {
  initialPortal?: "firm" | "client";
  onLoginSuccess: (user: UserContext) => void;
  idPrefix?: string;
}

export function AuthForm({
  initialPortal = "firm",
  onLoginSuccess,
  idPrefix = "auth",
}: AuthFormProps) {
  const [portal, setPortal] = useState<"firm" | "client">(initialPortal);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPortal(initialPortal);
    setErrorMessage(null);
  }, [initialPortal]);

  const handlePortalSwitch = (newPortal: "firm" | "client") => {
    setPortal(newPortal);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid business email address.");
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    api
      .login({ email, password })
      .then((liveRes) => {
        setIsLoading(false);
        if (liveRes.success && liveRes.access_token) {
          const fallbackUser = authenticateUser(email, portal, password).user;
          const isClient =
            portal === "client" ||
            (liveRes.user?.roles && liveRes.user.roles.includes("retained_client"));
          const normalizedEmail = email.trim().toLowerCase();
          const userObj: UserContext = {
            id: String(liveRes.user?.user_id || fallbackUser?.id || `usr-${normalizedEmail}`),
            email: normalizedEmail,
            full_name: fallbackUser?.full_name || normalizedEmail,
            organization_id: String(
              liveRes.user?.organization_id || fallbackUser?.organization_id || "org-active"
            ),
            organization_name: fallbackUser?.organization_name || "Partner Immigration Practice",
            role: isClient
              ? "retained_client"
              : fallbackUser?.role || (liveRes.user?.roles?.[0] as RoleCode) || "master_admin",
            experience: isClient
              ? "client_applicant"
              : fallbackUser?.experience || "master_admin",
            permissions:
              fallbackUser?.permissions ||
              (isClient
                ? ["portal:access", "documents:upload", "messages:send", "questionnaire:submit"]
                : ["*"]),
            agency_slug: fallbackUser?.agency_slug,
          };
          onLoginSuccess(userObj);
          return;
        }

        if (process.env.NODE_ENV === "production") {
          setErrorMessage(liveRes.error || "Authentication failed. Please verify your credentials.");
          return;
        }

        const res = authenticateUser(email, portal, password);
        if (res.success && res.user) {
          setAccessToken(null);
          onLoginSuccess(res.user);
          return;
        }

        setErrorMessage(
          res.error || liveRes.error || "Authentication failed. Please verify your credentials."
        );
      })
      .catch((err) => {
        setIsLoading(false);
        if (process.env.NODE_ENV === "production") {
          setErrorMessage(err?.message || "Failed to reach Documento authentication server.");
          return;
        }
        const res = authenticateUser(email, portal, password);
        if (res.success && res.user) {
          setAccessToken(null);
          onLoginSuccess(res.user);
        } else {
          setErrorMessage(res.error || "Authentication failed. Please verify your credentials.");
        }
      });
  };

  return (
    <div>
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
          data-testid="portal-tab-firm"
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
          data-testid="portal-tab-client"
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

      {/* Retained Client Credentials Policy Banner */}
      {portal === "client" && (
        <div
          data-testid="client-portal-policy-banner"
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: "#F1F6F4",
            border: "1px solid #B9DED4",
            color: "#063C3D",
            fontSize: "12px",
            lineHeight: 1.45,
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "14px", marginTop: "1px" }}>🔒</span>
          <span>
            <strong>Owner &amp; Lead Paralegal Provisioned:</strong> Client portal access requires
            temporary credentials issued directly by your firm Owner or Lead Paralegal. Until
            provided, sign-in is disabled.
          </span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="login-error-message"
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

      {/* Credentials Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor={`${idPrefix}-email-input`}
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
          <input
            id={`${idPrefix}-email-input`}
            data-testid="login-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={portal === "firm" ? "counsel@practice-domain.com" : "client@domain.com"}
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
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0D6866")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#DCE5E1")}
          />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label
            htmlFor={`${idPrefix}-password-input`}
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#172322",
              marginBottom: "6px",
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id={`${idPrefix}-password-input`}
              data-testid="login-password-input"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
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
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#0D6866")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#DCE5E1")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
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
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          data-testid="login-submit-btn"
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
        >
          {isLoading
            ? "Signing in..."
            : `Sign In to ${portal === "firm" ? "Firm Workspace" : "Client Portal"}`}
        </button>
      </form>

      {/* Partner Visa Agency Onboarding Link */}
      <div
        style={{
          marginTop: "18px",
          padding: "10px 12px",
          borderRadius: "8px",
          background: "#F8F7F2",
          border: "1px solid #DCE5E1",
          textAlign: "center",
          fontSize: "12px",
          color: "#445451",
        }}
      >
        New immigration law firm or visa agency?{" "}
        <a
          href="/agency-onboarding"
          style={{ color: "#0D6866", fontWeight: 700, textDecoration: "none" }}
        >
          Apply for Partner KYB Onboarding →
        </a>
      </div>
    </div>
  );
}
