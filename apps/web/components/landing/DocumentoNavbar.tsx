import React from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";
import { UserExperience } from "../../lib/types";

interface DocumentoNavbarProps {
  onSelectRole: (role: UserExperience) => void;
  onOpenApp: () => void;
  isLiveBackend?: boolean;
}

export function DocumentoNavbar({
  onSelectRole,
  onOpenApp,
  isLiveBackend = true,
}: DocumentoNavbarProps) {
  return (
    <header
      role="banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 90,
        background: "rgba(248, 247, 242, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #DCE5E1",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <a
            href="#hero"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <DocumentoLogo size="md" showWordmark showDomain />
          </a>

          {/* Navigation Links */}
          <nav
            role="navigation"
            aria-label="Main Navigation"
            style={{
              display: "none",
              alignItems: "center",
              gap: "22px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#445451",
            }}
            className="md-nav-links"
          >
            <a
              href="#preview"
              style={{
                color: "#445451",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#445451")}
            >
              Interactive Preview
            </a>
            <a
              href="#capabilities"
              style={{
                color: "#445451",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#445451")}
            >
              Core Capabilities
            </a>
            <a
              href="#workflow"
              style={{
                color: "#445451",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#445451")}
            >
              4-Step Workflow
            </a>
            <a
              href="#trust"
              style={{
                color: "#445451",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#445451")}
            >
              Human Oversight
            </a>
          </nav>
        </div>

        {/* Right Action Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Health indicator */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "20px",
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              fontSize: "12px",
              fontWeight: 550,
              color: "#176B50",
            }}
            title="FastAPI Python engine with isolated tenant boundaries"
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#176B50",
                display: "inline-block",
              }}
            />
            {isLiveBackend ? "Engine Operational" : "Demo Sandbox"}
          </div>

          {/* Quick Role Direct Buttons */}
          <div
            style={{
              display: "none",
              alignItems: "center",
              gap: "4px",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "3px",
            }}
            className="lg-role-toggles"
          >
            <button
              type="button"
              onClick={() => onSelectRole("master_admin")}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                color: "#445451",
                padding: "5px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#DDEFE8";
                e.currentTarget.style.color = "#063C3D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#445451";
              }}
            >
              Partner
            </button>
            <button
              type="button"
              onClick={() => onSelectRole("case_manager")}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                color: "#445451",
                padding: "5px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#DDEFE8";
                e.currentTarget.style.color = "#063C3D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#445451";
              }}
            >
              Paralegal
            </button>
            <button
              type="button"
              onClick={() => onSelectRole("client_applicant")}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                color: "#445451",
                padding: "5px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#DDEFE8";
                e.currentTarget.style.color = "#063C3D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#445451";
              }}
            >
              Client
            </button>
          </div>

          {/* Primary CTA Button */}
          <button
            type="button"
            onClick={onOpenApp}
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              border: "1px solid #063C3D",
              padding: "8px 18px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#063C3D";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(6, 60, 61, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#0D6866";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(13, 104, 102, 0.2)";
            }}
          >
            <span>Open Workspaces</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .md-nav-links { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .lg-role-toggles { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
