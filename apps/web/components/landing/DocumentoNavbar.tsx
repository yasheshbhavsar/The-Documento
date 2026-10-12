import React from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";

interface DocumentoNavbarProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
  isLiveBackend?: boolean;
}

export function DocumentoNavbar({
  onOpenLogin,
  isLiveBackend = true,
}: DocumentoNavbarProps) {
  return (
    <header
      role="banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 90,
        background: "rgba(248, 247, 242, 0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
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
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
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

          {/* Navigation Anchors */}
          <nav
            role="navigation"
            aria-label="Main Navigation"
            style={{
              display: "none",
              alignItems: "center",
              gap: "24px",
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
              display: "none",
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
            className="sm-status-badge"
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
            <span>{isLiveBackend ? "Engine Live" : "Sandbox"}</span>
          </div>

          {/* Client Portal Link */}
          <button
            type="button"
            onClick={() => onOpenLogin("client")}
            style={{
              background: "transparent",
              border: "none",
              color: "#445451",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: "8px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#063C3D";
              e.currentTarget.style.background = "#F1F6F4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#445451";
              e.currentTarget.style.background = "transparent";
            }}
          >
            Client Portal
          </button>

          {/* Sign In Button */}
          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            style={{
              background: "#FFFFFF",
              color: "#063C3D",
              border: "1px solid #DCE5E1",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.background = "#F8F7F2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.background = "#FFFFFF";
            }}
          >
            Sign In
          </button>

          {/* Primary CTA Button */}
          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            style={{
              background: "#0D6866",
              color: "#FFFFFF",
              border: "1px solid #063C3D",
              padding: "8px 18px",
              borderRadius: "8px",
              fontWeight: 650,
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
            <span>Access Portal</span>
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
        @media (min-width: 640px) {
          .sm-status-badge { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
