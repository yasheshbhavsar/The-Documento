"use client";

import React, { useState } from "react";
import { DocumentoLogo } from "../common/DocumentoLogo";

interface DocumentoNavbarProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
  isLiveBackend?: boolean;
}

export function DocumentoNavbar({
  onOpenLogin,
  isLiveBackend = true,
}: DocumentoNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "#preview", label: "Interactive Preview" },
    { href: "#coverage", label: "Visa Coverage" },
    { href: "#comparison", label: "Problem & Solution" },
    { href: "#workflow", label: "6-Step Journey" },
    { href: "#pathway-finder", label: "Case Fit Check" },
    { href: "#trust", label: "Human Oversight" },
    { href: "#faq", label: "FAQ" },
  ];

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

          {/* Desktop Navigation Anchors */}
          <nav
            role="navigation"
            aria-label="Main Navigation"
            style={{
              display: "none",
              alignItems: "center",
              gap: "20px",
              fontSize: "13px",
              fontWeight: 550,
              color: "#445451",
            }}
            className="md-nav-links"
          >
            {navLinks.slice(0, 5).map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  color: "#445451",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#445451")}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#faq"
              style={{
                color: "#445451",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#445451")}
            >
              FAQ
            </a>
          </nav>
        </div>

        {/* Right Action Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Health indicator badge */}
          <div
            style={{
              display: "none",
              alignItems: "center",
              gap: "7px",
              padding: "5px 12px",
              borderRadius: "20px",
              background: "rgba(234, 246, 240, 0.85)",
              border: "1px solid rgba(185, 222, 212, 0.9)",
              fontSize: "12px",
              fontWeight: 600,
              color: "#176B50",
              boxShadow: "0 1px 3px rgba(6, 60, 61, 0.04)",
            }}
            className="sm-status-badge"
            title="FastAPI Python engine with isolated tenant boundaries & RapidOCR intelligence"
          >
            <span
              className="status-dot-pulse"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#176B50",
                display: "inline-block",
              }}
            />
            <span>{isLiveBackend ? "AI Engine Live" : "Sandbox Mode"}</span>
          </div>

          {/* Standalone AI Extractor Lab (No Login) */}
          <a
            href="/extractor"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "linear-gradient(135deg, rgba(6, 60, 61, 0.08) 0%, rgba(23, 107, 80, 0.12) 100%)",
              border: "1px solid rgba(23, 107, 80, 0.3)",
              color: "#063C3D",
              fontSize: "12px",
              fontWeight: 700,
              padding: "7px 12px",
              borderRadius: "8px",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#063C3D";
              e.currentTarget.style.color = "#FFFFFF";
              e.currentTarget.style.borderColor = "#063C3D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 60, 61, 0.08) 0%, rgba(23, 107, 80, 0.12) 100%)";
              e.currentTarget.style.color = "#063C3D";
              e.currentTarget.style.borderColor = "rgba(23, 107, 80, 0.3)";
            }}
            title="Try standalone OCR, entity extraction & evidence AI without logging in"
          >
            <span>🔬</span>
            <span>AI Extractor Lab</span>
          </a>

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
              transition: "all 0.18s ease",
            }}
            className="xs-portal-btn"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#063C3D";
              e.currentTarget.style.background = "#DDEFE8";
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
            className="xs-signin-btn hover-lift"
            style={{
              background: "#FFFFFF",
              color: "#063C3D",
              border: "1px solid #DCE5E1",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(6, 60, 61, 0.04)",
              transition: "all 0.18s ease",
            }}
          >
            Sign In
          </button>

          {/* Primary CTA Button */}
          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            className="hover-lift"
            style={{
              background: "linear-gradient(135deg, #0D6866 0%, #063C3D 100%)",
              color: "#FFFFFF",
              border: "1px solid #063C3D",
              padding: "8px 18px",
              borderRadius: "8px",
              fontWeight: 650,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 3px 10px rgba(13, 104, 102, 0.28)",
            }}
          >
            <span>Get Started</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="mobile-hamburger-btn"
            style={{
              display: "none",
              background: "transparent",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "8px",
              color: "#063C3D",
              cursor: "pointer",
            }}
          >
            {mobileMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid #DCE5E1",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.06)",
          }}
          className="mobile-menu-drawer"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#063C3D",
                textDecoration: "none",
                padding: "8px 0",
                borderBottom: "1px solid #F1F6F4",
              }}
            >
              {link.label}
            </a>
          ))}

          <div style={{ display: "flex", gap: "10px", paddingTop: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenLogin("client");
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#F8F7F2",
                color: "#063C3D",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Client Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenLogin("firm");
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: "#0D6866",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Firm Sign In
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .xs-signin-btn { display: none !important; }
          .xs-portal-btn { display: none !important; }
          .mobile-hamburger-btn { display: flex !important; }
        }
        @media (max-width: 900px) {
          .mobile-hamburger-btn { display: flex !important; }
        }
        @media (min-width: 901px) {
          .md-nav-links { display: flex !important; }
        }
        @media (min-width: 640px) {
          .sm-status-badge { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
