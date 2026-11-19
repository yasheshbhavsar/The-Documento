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
      const next = window.scrollY > 16;
      setIsScrolled((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#preview", label: "Platform" },
    { href: "#coverage", label: "Coverage" },
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
        background: isScrolled ? "#FFFFFF" : "rgba(255, 255, 255, 0.94)",
        borderBottom: isScrolled ? "1px solid #DCE7E3" : "1px solid rgba(220, 231, 227, 0.6)",
        transition: "background-color 0.18s ease, border-color 0.18s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1360px",
          margin: "0 auto",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        {/* Brand Logo & Engine Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a
            href="#hero"
            className="no-underline flex items-center"
            style={{ textDecoration: "none" }}
          >
            <DocumentoLogo size="md" showWordmark showDomain />
          </a>

          {/* Minimal Modern Engine Status Tag */}
          <div
            style={{
              display: "none",
              alignItems: "center",
              gap: "6px",
              padding: "3px 9px",
              borderRadius: "6px",
              background: "#F1F6F4",
              border: "1px solid #DCE7E3",
              fontSize: "11px",
              fontWeight: 650,
              color: "#07594F",
              letterSpacing: "0.02em",
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
                display: "inline-block",
              }}
            />
            <span>{isLiveBackend ? "AI Engine Live" : "Sandbox Mode"}</span>
          </div>
        </div>

        {/* Flush Modern Minimal Desktop Navigation */}
        <nav
          role="navigation"
          aria-label="Main Navigation"
          className="desktop-capsule-nav"
          style={{
            display: "none",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <a
            href="#preview"
            style={{
              fontSize: "13.5px",
              fontWeight: 500,
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
              fontSize: "13.5px",
              fontWeight: 500,
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
            href="/calculators"
            data-testid="nav-pr-calculators-link"
            style={{
              fontSize: "13.5px",
              fontWeight: 500,
              color: "#384A46",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
            title="Country-separated PR & Skilled Migration Calculators (CA, AU, NZ, UK, DE)"
          >
            PR Calculators
          </a>

          <a
            href="/extractor"
            style={{
              fontSize: "13.5px",
              fontWeight: 500,
              color: "#384A46",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
            title="Try standalone OCR, entity extraction & evidence AI without logging in"
          >
            AI Extractor Lab
          </a>

          <a
            href="/agency-onboarding"
            data-testid="nav-agency-onboarding-link"
            style={{
              fontSize: "13.5px",
              fontWeight: 600,
              color: "#0D6866",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#063C3D")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#0D6866")}
            title="KYB Onboarding & Partner Workspace Provisioning for Visa Agencies & Law Firms"
          >
            For Agencies
          </a>

          <button
            type="button"
            onClick={() => onOpenLogin("client")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: "13.5px",
              fontWeight: 500,
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
              fontSize: "13.5px",
              fontWeight: 500,
              color: "#384A46",
              cursor: "pointer",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D6866")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#384A46")}
          >
            Sign In
          </button>

          {/* Confident Flat Action Link */}
          <a
            href="/agency-onboarding"
            style={{
              background: "#07594F",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 18px",
              borderRadius: "8px",
              fontWeight: 650,
              fontSize: "13.5px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
              transition: "background-color 0.15s ease, transform 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#063C3D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#07594F";
            }}
          >
            <span>Get Started</span>
          </a>
        </nav>

        {/* Mobile Action Controls */}
        <div className="mobile-action-group" style={{ display: "none", alignItems: "center", gap: "8px" }}>
          <a
            href="/agency-onboarding"
            style={{
              background: "#07594F",
              color: "#FFFFFF",
              border: "none",
              padding: "7px 14px",
              borderRadius: "8px",
              fontWeight: 650,
              fontSize: "12.5px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Get Started
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            style={{
              background: "#F8FAF9",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "7px",
              color: "#063C3D",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {mobileMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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
            boxShadow: "0 8px 16px rgba(6, 60, 61, 0.04)",
          }}
          className="mobile-menu-drawer"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: "13.5px",
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

          <a
            href="/calculators"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontSize: "13.5px",
              fontWeight: 650,
              color: "#0D6866",
              textDecoration: "none",
              padding: "8px 0",
              borderBottom: "1px solid #F1F6F4",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>PR Calculators</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D" }}>5 Countries →</span>
          </a>

          <a
            href="/extractor"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontSize: "13.5px",
              fontWeight: 600,
              color: "#063C3D",
              textDecoration: "none",
              padding: "8px 0",
              borderBottom: "1px solid #F1F6F4",
            }}
          >
            AI Extractor Lab
          </a>

          <a
            href="/agency-onboarding"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontSize: "13.5px",
              fontWeight: 650,
              color: "#0D6866",
              textDecoration: "none",
              padding: "8px 0",
              borderBottom: "1px solid #F1F6F4",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>For Agencies</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D" }}>KYB Onboarding →</span>
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
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                color: "#063C3D",
                fontSize: "12.5px",
                fontWeight: 650,
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
                background: "#07594F",
                color: "#FFFFFF",
                fontSize: "12.5px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Sign In
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
