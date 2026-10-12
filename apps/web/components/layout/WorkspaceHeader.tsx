import React, { useState } from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { UserContext, UserExperience } from "../../lib/types";

interface WorkspaceHeaderProps {
  currentUser: UserContext;
  onLogout: () => void;
  onSwitchRole: (role: UserExperience) => void;
  isLiveBackend?: boolean;
}

export function WorkspaceHeader({
  currentUser,
  onLogout,
  onSwitchRole,
  isLiveBackend = true,
}: WorkspaceHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getRoleLabel = (exp: UserExperience) => {
    switch (exp) {
      case "master_admin":
        return "Managing Partner";
      case "case_manager":
        return "Lead Paralegal";
      case "client_applicant":
        return "Retained Client";
    }
  };

  const getWorkspaceTitle = (exp: UserExperience) => {
    switch (exp) {
      case "master_admin":
        return "Executive Command Center";
      case "case_manager":
        return "Casework & Evidence Hub";
      case "client_applicant":
        return "Applicant Transparency Portal";
    }
  };

  return (
    <header
      style={{
        background: "#063C3D",
        color: "#F8F7F2",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        borderBottom: "1px solid rgba(185, 222, 212, 0.2)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 10px rgba(6, 60, 61, 0.15)",
      }}
    >
      {/* Left: Documento Brand + Tenant Info */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <DocumentoLogo size="sm" showWordmark={false} />
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
            Documento
          </span>
        </div>

        <div style={{ height: "18px", width: "1px", background: "rgba(185, 222, 212, 0.25)" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "12px", fontWeight: 650, color: "#FFFFFF", lineHeight: 1.2 }}>
            {currentUser.organization_name}
          </span>
          <span style={{ fontSize: "11px", color: "#B9DED4", lineHeight: 1.2 }}>
            {getWorkspaceTitle(currentUser.experience)}
          </span>
        </div>
      </div>

      {/* Right: Status & User Profile Menu */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Backend health */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "14px",
            background: "rgba(23, 107, 80, 0.35)",
            border: "1px solid rgba(185, 222, 212, 0.25)",
            fontSize: "11px",
            color: "#B9DED4",
            fontWeight: 550,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#2A9288",
              boxShadow: "0 0 6px #2A9288",
            }}
          />
          <span>{isLiveBackend ? "FastAPI Live" : "Sandbox"}</span>
        </div>

        {/* User Profile Dropdown Button */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(185, 222, 212, 0.25)",
              borderRadius: "24px",
              padding: "4px 12px 4px 6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              color: "#FFFFFF",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
          >
            {/* Avatar Circle */}
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#0D6866",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #B9DED4",
              }}
            >
              {getInitials(currentUser.full_name)}
            </div>

            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: 650, color: "#FFFFFF", lineHeight: 1.2 }}>
                {currentUser.full_name}
              </div>
              <div style={{ fontSize: "10px", color: "#B9DED4", lineHeight: 1.1 }}>
                {getRoleLabel(currentUser.experience)}
              </div>
            </div>

            <span style={{ fontSize: "10px", color: "#B9DED4", marginLeft: "2px" }}>▼</span>
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "260px",
                background: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #DCE5E1",
                boxShadow: "0 12px 32px rgba(6, 60, 61, 0.15)",
                padding: "8px",
                zIndex: 200,
                color: "#172322",
                animation: "fadeIn 0.15s ease",
              }}
            >
              {/* User Summary Header */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F6F4" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                  {currentUser.full_name}
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C", wordBreak: "break-all" }}>
                  {currentUser.email}
                </div>
                <div style={{ marginTop: "6px" }}>
                  <span
                    style={{
                      background: "#DDEFE8",
                      color: "#063C3D",
                      fontSize: "10px",
                      fontWeight: 650,
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    Tenant: {currentUser.organization_id}
                  </span>
                </div>
              </div>

              {/* Demo Role Switcher Section (inside menu for evaluators) */}
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #F1F6F4" }}>
                <div style={{ fontSize: "11px", fontWeight: 650, color: "#6E7F7C", marginBottom: "6px", textTransform: "uppercase" }}>
                  Switch Persona (Demo):
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchRole("master_admin");
                      setIsProfileMenuOpen(false);
                    }}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "none",
                      background: currentUser.experience === "master_admin" ? "#EAF6F0" : "transparent",
                      color: currentUser.experience === "master_admin" ? "#176B50" : "#445451",
                      fontSize: "12px",
                      fontWeight: 550,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>🏛️ Managing Partner</span>
                    {currentUser.experience === "master_admin" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchRole("case_manager");
                      setIsProfileMenuOpen(false);
                    }}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "none",
                      background: currentUser.experience === "case_manager" ? "#EAF6F0" : "transparent",
                      color: currentUser.experience === "case_manager" ? "#176B50" : "#445451",
                      fontSize: "12px",
                      fontWeight: 550,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>⚖️ Lead Paralegal</span>
                    {currentUser.experience === "case_manager" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchRole("client_applicant");
                      setIsProfileMenuOpen(false);
                    }}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "none",
                      background: currentUser.experience === "client_applicant" ? "#EAF6F0" : "transparent",
                      color: currentUser.experience === "client_applicant" ? "#176B50" : "#445451",
                      fontSize: "12px",
                      fontWeight: 550,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>👤 Retained Client</span>
                    {currentUser.experience === "client_applicant" && <span>✓</span>}
                  </button>
                </div>
              </div>

              {/* Logout button */}
              <div style={{ padding: "6px 4px 2px 4px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout();
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#FDF2F2",
                    color: "#A62D35",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign Out of Documento</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
