"use client";

import React, { useState, useEffect } from "react";
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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        background: isScrolled ? "rgba(248, 247, 242, 0.75)" : "rgba(248, 247, 242, 0.42)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "none",
        boxShadow: "none",
        transition: "all 0.25s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1360px",
          margin: "0 auto",
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        {/* Brand Logo & Engine Indicator (Logo style preserved exactly) */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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

          {/* Minimal Engine Status Pill */}
          <div
            style={{
              display: "none",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "9999px",
              background: "rgba(234, 246, 240, 0.72)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(185, 222, 212, 0.75)",
              fontSize: "11px",
              fontWeight: 650,
              color: "#176B50",
              letterSpacing: "0.02em",
              boxShadow: "0 1px 3px rgba(6, 60, 61, 0.04)",
            }}
            className="sm-engine-badge"
            title="FastAPI Python engine with isolated tenant boundaries & RapidOCR intelligence"
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
                display: "inline-block",
              }}
            />
            <span>{isLiveBackend ? "AI Engine Live" : "Sandbox Mode"}</span>
          </div>
        </div>

        {/* Floating Glass Capsule Navigation Bar (IntegratedBio / Modern Luxury Pill Aesthetic) */}
        <nav
          role="navigation"
          aria-label="Main Navigation"
          className="desktop-capsule-nav"
          style={{
            display: "none",
            alignItems: "center",
            gap: "22px",
            background: "rgba(255, 255, 255, 0.68)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.85)",
            borderRadius: "9999px",
            padding: "4px 5px 4px 22px",
            boxShadow: "0 6px 24px -2px rgba(6, 60, 61, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)",
          }}
        >
          {/* Text Links: Uppercase, Tracked, High-End Sans */}
          <a
            href="#preview"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#384A46",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
          >
            Platform
          </a>

          <a
            href="#coverage"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#384A46",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
          >
            Coverage
          </a>

          <a
            href="/extractor"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#384A46",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
            title="Try standalone OCR, entity extraction & evidence AI without logging in"
          >
            AI Lab
          </a>

          <button
            type="button"
            onClick={() => onOpenLogin("client")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#384A46",
              cursor: "pointer",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
          >
            Client Portal
          </button>

          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#384A46",
              cursor: "pointer",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
          >
            Sign In
          </button>

          {/* Dark Pill Action Button (Matches the reference "WORK WITH US" pill) */}
          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            style={{
              background: "linear-gradient(135deg, #063C3D 0%, #032525 100%)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "9px 20px",
              borderRadius: "9999px",
              fontWeight: 750,
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 10px rgba(6, 60, 61, 0.35)",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#0D6866";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(13, 104, 102, 0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #063C3D 0%, #032525 100%)";
              e.currentTarget.style.boxShadow = "0 2px 10px rgba(6, 60, 61, 0.35)";
            }}
          >
            <span>Get Started</span>
          </button>
        </nav>

        {/* Mobile Action Controls */}
        <div className="mobile-action-group" style={{ display: "none", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => onOpenLogin("firm")}
            style={{
              background: "#063C3D",
              color: "#FFFFFF",
              border: "none",
              padding: "7px 14px",
              borderRadius: "9999px",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Get Started
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              border: "1px solid #DCE5E1",
              borderRadius: "9999px",
              padding: "7px",
              color: "#063C3D",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
                fontSize: "13px",
                fontWeight: 650,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#063C3D",
                textDecoration: "none",
                padding: "8px 0",
                borderBottom: "1px solid #F1F6F4",
              }}
            >
              {link.label}
            </a>
          ))}

          <a
            href="/extractor"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontSize: "13px",
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#063C3D",
              textDecoration: "none",
              padding: "8px 0",
              borderBottom: "1px solid #F1F6F4",
            }}
          >
            🔬 AI Extractor Lab
          </a>

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
                borderRadius: "9999px",
                border: "1px solid #DCE5E1",
                background: "#F8F7F2",
                color: "#063C3D",
                fontSize: "11.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
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
                borderRadius: "9999px",
                border: "none",
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "11.5px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Firm Sign In
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 901px) {
          .desktop-capsule-nav { display: inline-flex !important; }
        }
        @media (max-width: 900px) {
          .mobile-action-group { display: inline-flex !important; }
        }
        @media (min-width: 640px) {
          .sm-engine-badge { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
