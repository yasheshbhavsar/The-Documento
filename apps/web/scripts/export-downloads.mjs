import fs from 'node:fs';
import path from 'node:path';

const DOWNLOADS_DIR = 'C:\\Users\\Yashesh\\Downloads';

// Helper to strip imports and "use client" from component source
function cleanComponentSource(src) {
  return src
    .replace(/"use client";\s*/g, '')
    .replace(/import\s+React[^;]*;/g, '')
    .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]*['"];/g, '')
    .replace(/import\s+[^;]*from\s+['"][^'"]*['"];/g, '')
    .replace(/export\s+default\s+/g, '')
    .trim();
}

console.log('Building standalone Landing Page bundle...');

// Read individual components
const logoSrc = cleanComponentSource(fs.readFileSync('components/common/DocumentoLogo.tsx', 'utf-8'));
const navSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoNavbar.tsx', 'utf-8'));
const heroSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoHero.tsx', 'utf-8'));
const previewSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoPreview.tsx', 'utf-8'));
const coverageSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoCoverageExplorer.tsx', 'utf-8'));
const probSolSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoProblemSolution.tsx', 'utf-8'));
const workflowSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoWorkflow.tsx', 'utf-8'));
const toolsSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoInteractiveTools.tsx', 'utf-8'));
const capSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoCapabilities.tsx', 'utf-8'));
const trustSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoTrust.tsx', 'utf-8'));
const faqSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoFAQ.tsx', 'utf-8'));
const footerSrc = cleanComponentSource(fs.readFileSync('components/landing/DocumentoFooter.tsx', 'utf-8'));

// Extract css rules for animation on scroll
const animationCss = `
@keyframes animationIn {
  0% {
    opacity: 0;
    transform: translateY(28px);
    filter: blur(6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0px);
  }
}

.animate-on-scroll {
  animation: animationIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-play-state: paused !important;
  will-change: transform, opacity, filter;
}

.animate-on-scroll.animate {
  animation-play-state: running !important;
}

.delay-100 { animation-delay: 100ms !important; }
.delay-150 { animation-delay: 150ms !important; }
.delay-200 { animation-delay: 200ms !important; }
.delay-300 { animation-delay: 300ms !important; }
.delay-400 { animation-delay: 400ms !important; }

@media (prefers-reduced-motion: reduce) {
  .animate-on-scroll {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
  }
}

/* Base resets & typography */
:root {
  --brand-deep: #063C3D;
  --accent: #0D6866;
  --mint-light: #B9DED4;
  --mint-surface: #DDEFE8;
  --bg: #F8F7F2;
  --text: #172322;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Plus Jakarta Sans', var(--font-sans);
  --font-serif: 'Instrument Serif', Georgia, serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a, button, input, select, textarea {
  font: inherit;
}

:focus-visible {
  outline: 2px solid #0D6866 !important;
  outline-offset: 2px !important;
}

@media (min-width: 900px) {
  .md-nav-links {
    display: flex !important;
  }
  .md-nav-actions {
    display: flex !important;
  }
  .mobile-nav-toggle {
    display: none !important;
  }
}
`;

// Self-contained standalone React TSX file content
const standaloneTsxContent = `// Documento — Immigration Case Intelligence & Management
// Standalone Landing Page Component (Single-File Distribution)
// Generated for Yashesh • Light mode only • Brand colors: #063C3D, #0D6866, #B9DED4, #DDEFE8, #F8F7F2

"use client";

import React, { useState, useEffect, useMemo } from "react";

// ============================================================================
// STYLES & ANIMATION KEYFRAMES
// ============================================================================
export const LANDING_PAGE_STYLES = \`${animationCss}\`;

// ============================================================================
// HOOK: useAnimationOnScroll
// ============================================================================
export function useAnimationOnScroll(selector: string = ".animate-on-scroll", once: boolean = true) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(selector).forEach((el) => {
        el.classList.add("animate");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate");
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            entry.target.classList.remove("animate");
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [selector, once]);
}

// ============================================================================
// COMPONENT: DocumentoLogo
// ============================================================================
${logoSrc}

// ============================================================================
// COMPONENT: DocumentoLoginModal
// ============================================================================
interface DocumentoLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: any) => void;
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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
    setEmail(newPortal === "client" ? "dr.thorne@cambridge.edu" : "sarah.jenkins@vanguardlegal.com");
    setStatusMsg(null);
  };

  const handleQuickDemo = (roleName: string, demoEmail: string) => {
    setEmail(demoEmail);
    setIsLoading(true);
    setStatusMsg(\`Authenticating session for \${roleName}...\`);
    setTimeout(() => {
      setIsLoading(false);
      setStatusMsg(\`Welcome, \${roleName}! (Demo Mode Active)\`);
      setTimeout(() => {
        onClose();
        if (onLoginSuccess) onLoginSuccess({ name: roleName, email: demoEmail, portal });
      }, 700);
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg("Verifying credentials against security vault...");
    setTimeout(() => {
      setIsLoading(false);
      setStatusMsg("Access Granted • Launching Workspace...");
      setTimeout(() => {
        onClose();
        if (onLoginSuccess) onLoginSuccess({ email, portal });
      }, 700);
    }, 800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(6, 60, 61, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "480px",
          border: "1px solid #DCE5E1",
          boxShadow: "0 24px 64px rgba(6, 60, 61, 0.18)",
          padding: "32px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "none",
            border: "none",
            fontSize: "20px",
            color: "#6E7F7C",
            cursor: "pointer",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <DocumentoLogo size="md" showWordmark showDomain />
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#063C3D", margin: "16px 0 6px 0" }}>
            Sign In to Documento
          </h2>
          <p style={{ fontSize: "13px", color: "#6E7F7C", margin: 0 }}>
            Role-isolated access for law firms and retained applicants.
          </p>
        </div>

        {/* Portal Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#F8F7F2",
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
              padding: "9px 12px",
              border: "none",
              borderRadius: "7px",
              fontSize: "13px",
              fontWeight: portal === "firm" ? 700 : 500,
              background: portal === "firm" ? "#063C3D" : "transparent",
              color: portal === "firm" ? "#FFFFFF" : "#445451",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            ⚖️ Law Firm Portal
          </button>
          <button
            type="button"
            onClick={() => handlePortalSwitch("client")}
            style={{
              padding: "9px 12px",
              border: "none",
              borderRadius: "7px",
              fontSize: "13px",
              fontWeight: portal === "client" ? 700 : 500,
              background: portal === "client" ? "#063C3D" : "transparent",
              color: portal === "client" ? "#FFFFFF" : "#445451",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            👤 Client Portal
          </button>
        </div>

        {/* Quick Demo Selector */}
        <div style={{ marginBottom: "18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.04em" }}>
            Quick 1-Click Demo Profiles:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {portal === "firm" ? (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickDemo("Managing Partner", "eleanor.vance@vanguardlegal.com")}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid #B9DED4",
                    background: "#DDEFE8",
                    color: "#063C3D",
                    cursor: "pointer",
                  }}
                >
                  Eleanor Vance, Esq. (Partner)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo("Senior Paralegal", "sarah.jenkins@vanguardlegal.com")}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    background: "#F8F7F2",
                    color: "#063C3D",
                    cursor: "pointer",
                  }}
                >
                  Sarah Jenkins (Paralegal)
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleQuickDemo("Retained Applicant", "dr.thorne@cambridge.edu")}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #B9DED4",
                  background: "#DDEFE8",
                  color: "#063C3D",
                  cursor: "pointer",
                }}
              >
                Dr. Aris Thorne (EB-1A Applicant)
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
              Work Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "14px",
                outline: "none",
                color: "#172322",
              }}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                fontSize: "14px",
                outline: "none",
                color: "#172322",
              }}
            />
          </div>

          {statusMsg && (
            <div
              style={{
                padding: "10px",
                borderRadius: "8px",
                background: "#DDEFE8",
                border: "1px solid #B9DED4",
                color: "#063C3D",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "14px",
                textAlign: "center",
              }}
            >
              {statusMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              background: "#0D6866",
              color: "#FFFFFF",
              border: "none",
              fontSize: "14px",
              fontWeight: 650,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(13, 104, 102, 0.25)",
            }}
          >
            {isLoading ? "Authenticating..." : \`Sign In to \${portal === "firm" ? "Law Firm" : "Client"} Portal →\`}
          </button>
        </form>

        <div style={{ marginTop: "18px", textAlign: "center", fontSize: "12px", color: "#6E7F7C" }}>
          Protected by TLS 1.3 • AES-256 Multi-Tenant Isolation
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT: DocumentoNavbar
// ============================================================================
${navSrc}

// ============================================================================
// COMPONENT: DocumentoHero
// ============================================================================
${heroSrc}

// ============================================================================
// COMPONENT: DocumentoPreview
// ============================================================================
${previewSrc}

// ============================================================================
// COMPONENT: DocumentoCoverageExplorer
// ============================================================================
${coverageSrc}

// ============================================================================
// COMPONENT: DocumentoProblemSolution
// ============================================================================
${probSolSrc}

// ============================================================================
// COMPONENT: DocumentoWorkflow
// ============================================================================
${workflowSrc}

// ============================================================================
// COMPONENT: DocumentoInteractiveTools
// ============================================================================
${toolsSrc}

// ============================================================================
// COMPONENT: DocumentoCapabilities
// ============================================================================
${capSrc}

// ============================================================================
// COMPONENT: DocumentoTrust
// ============================================================================
${trustSrc}

// ============================================================================
// COMPONENT: DocumentoFAQ
// ============================================================================
${faqSrc}

// ============================================================================
// COMPONENT: DocumentoFooter
// ============================================================================
${footerSrc}

// ============================================================================
// MAIN EXPORT: DocumentoLandingPage
// ============================================================================
export default function DocumentoLandingPage() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [initialPortal, setInitialPortal] = useState<"firm" | "client">("firm");

  // Activate on-scroll reveal observer
  useAnimationOnScroll(".animate-on-scroll", true);

  const handleOpenLogin = (portal: "firm" | "client" = "firm") => {
    setInitialPortal(portal);
    setIsLoginOpen(true);
  };

  return (
    <div className="documento-landing-page-root" style={{ background: "#FFFFFF", minHeight: "100vh", color: "#172322" }}>
      {/* Inject Scoped CSS & Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: LANDING_PAGE_STYLES }} />

      {/* Navigation */}
      <DocumentoNavbar onOpenLogin={handleOpenLogin} isLiveBackend={true} />

      {/* Main Content Sections */}
      <main id="main-content">
        <DocumentoHero onOpenLogin={handleOpenLogin} />
        <DocumentoPreview />
        <DocumentoCoverageExplorer />
        <DocumentoProblemSolution />
        <DocumentoWorkflow />
        <DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />
        <DocumentoCapabilities />
        <DocumentoTrust />
        <DocumentoFAQ />
      </main>

      {/* Footer */}
      <DocumentoFooter onOpenLogin={handleOpenLogin} />

      {/* Authentication Modal */}
      <DocumentoLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        initialPortal={initialPortal}
        onLoginSuccess={(u) => {
          alert(\`Signed in successfully as \${u.email} (Portal: \${u.portal})\`);
        }}
      />
    </div>
  );
}
`;

// Standalone HTML template that bundles React, Babel, and all components
const standaloneHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documento — Immigration Case Intelligence & Management</title>
  <meta name="description" content="Organized evidentiary exhibits, declarative statutory requirements, and unified case pipelines for immigration law firms and applicants." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;750&family=Plus+Jakarta+Sans:wght@500;600;700;750;800&display=swap" rel="stylesheet">
  <style>
${animationCss}
  </style>

  <!-- React 18, ReactDOM 18, and Babel Standalone for direct browser execution -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root">
    <div style="display: flex; height: 100vh; align-items: center; justify-content: center; flex-direction: column; gap: 14px; background: #F8F7F2; color: #063C3D;">
      <div style="font-weight: 700; font-size: 20px;">Documento</div>
      <div style="font-size: 14px; color: #6E7F7C;">Loading interactive landing page...</div>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect, useMemo } = React;

    // Hook: useAnimationOnScroll
    function useAnimationOnScroll(selector = ".animate-on-scroll", once = true) {
      useEffect(() => {
        if (!("IntersectionObserver" in window)) {
          document.querySelectorAll(selector).forEach((el) => el.classList.add("animate"));
          return;
        }

        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("animate");
              if (once) observer.unobserve(entry.target);
            } else if (!once) {
              entry.target.classList.remove("animate");
            }
          });
        }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

        document.querySelectorAll(selector).forEach((el) => observer.observe(el));
        return () => observer.disconnect();
      }, [selector, once]);
    }

${logoSrc.replace(/export\s+/g, '')}
${navSrc.replace(/export\s+/g, '')}
${heroSrc.replace(/export\s+/g, '')}
${previewSrc.replace(/export\s+/g, '')}
${coverageSrc.replace(/export\s+/g, '')}
${probSolSrc.replace(/export\s+/g, '')}
${workflowSrc.replace(/export\s+/g, '')}
${toolsSrc.replace(/export\s+/g, '')}
${capSrc.replace(/export\s+/g, '')}
${trustSrc.replace(/export\s+/g, '')}
${faqSrc.replace(/export\s+/g, '')}
${footerSrc.replace(/export\s+/g, '')}

    // Modal
    function DocumentoLoginModal({ isOpen, onClose, initialPortal = "firm" }) {
      const [portal, setPortal] = useState(initialPortal);
      const [email, setEmail] = useState("sarah.jenkins@vanguardlegal.com");
      const [password, setPassword] = useState("••••••••••••");
      const [msg, setMsg] = useState("");

      if (!isOpen) return null;

      const handlePortalSwitch = (p) => {
        setPortal(p);
        setEmail(p === "client" ? "dr.thorne@cambridge.edu" : "sarah.jenkins@vanguardlegal.com");
        setMsg("");
      };

      const handleQuickDemo = (name, mail) => {
        setEmail(mail);
        setMsg("Authenticating session for " + name + "...");
        setTimeout(() => {
          setMsg("Welcome, " + name + "! (Interactive Demo Active)");
          setTimeout(() => onClose(), 700);
        }, 500);
      };

      const handleSubmit = (e) => {
        e.preventDefault();
        setMsg("Access Granted • Welcome to Documento!");
        setTimeout(() => onClose(), 600);
      };

      return (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(6, 60, 61, 0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "480px",
              border: "1px solid #DCE5E1",
              boxShadow: "0 24px 64px rgba(6, 60, 61, 0.18)",
              padding: "32px",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                position: "absolute",
                top: "18px",
                right: "18px",
                background: "none",
                border: "none",
                fontSize: "20px",
                color: "#6E7F7C",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <DocumentoLogo size="md" showWordmark showDomain />
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#063C3D", margin: "16px 0 6px 0" }}>
                Sign In to Documento
              </h2>
              <p style={{ fontSize: "13px", color: "#6E7F7C", margin: 0 }}>
                Role-isolated access for law firms and retained applicants.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#F8F7F2",
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
                  padding: "9px 12px",
                  border: "none",
                  borderRadius: "7px",
                  fontSize: "13px",
                  fontWeight: portal === "firm" ? 700 : 500,
                  background: portal === "firm" ? "#063C3D" : "transparent",
                  color: portal === "firm" ? "#FFFFFF" : "#445451",
                  cursor: "pointer",
                }}
              >
                ⚖️ Law Firm Portal
              </button>
              <button
                type="button"
                onClick={() => handlePortalSwitch("client")}
                style={{
                  padding: "9px 12px",
                  border: "none",
                  borderRadius: "7px",
                  fontSize: "13px",
                  fontWeight: portal === "client" ? 700 : 500,
                  background: portal === "client" ? "#063C3D" : "transparent",
                  color: portal === "client" ? "#FFFFFF" : "#445451",
                  cursor: "pointer",
                }}
              >
                👤 Client Portal
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", marginBottom: "8px" }}>
                1-Click Demo Profiles:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {portal === "firm" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo("Eleanor Vance, Esq.", "eleanor.vance@vanguardlegal.com")}
                      style={{ fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px", border: "1px solid #B9DED4", background: "#DDEFE8", color: "#063C3D", cursor: "pointer" }}
                    >
                      Eleanor Vance, Esq. (Partner)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo("Sarah Jenkins", "sarah.jenkins@vanguardlegal.com")}
                      style={{ fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px", border: "1px solid #DCE5E1", background: "#F8F7F2", color: "#063C3D", cursor: "pointer" }}
                    >
                      Sarah Jenkins (Paralegal)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuickDemo("Dr. Aris Thorne", "dr.thorne@cambridge.edu")}
                    style={{ fontSize: "11px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px", border: "1px solid #B9DED4", background: "#DDEFE8", color: "#063C3D", cursor: "pointer" }}
                  >
                    Dr. Aris Thorne (EB-1A Applicant)
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #DCE5E1", fontSize: "14px", outline: "none", color: "#172322" }}
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#063C3D", marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #DCE5E1", fontSize: "14px", outline: "none", color: "#172322" }}
                />
              </div>

              {msg && (
                <div style={{ padding: "10px", borderRadius: "8px", background: "#DDEFE8", border: "1px solid #B9DED4", color: "#063C3D", fontSize: "12px", fontWeight: 600, marginBottom: "14px", textAlign: "center" }}>
                  {msg}
                </div>
              )}

              <button
                type="submit"
                style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#0D6866", color: "#FFFFFF", border: "none", fontSize: "14px", fontWeight: 650, cursor: "pointer", boxShadow: "0 2px 8px rgba(13, 104, 102, 0.25)" }}
              >
                Sign In to {portal === "firm" ? "Law Firm" : "Client"} Portal →
              </button>
            </form>
          </div>
        </div>
      );
    }

    // App Component
    function App() {
      const [isLoginOpen, setIsLoginOpen] = useState(false);
      const [portal, setPortal] = useState("firm");

      useAnimationOnScroll(".animate-on-scroll", true);

      const handleOpenLogin = (p = "firm") => {
        setPortal(p);
        setIsLoginOpen(true);
      };

      return (
        <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
          <DocumentoNavbar onOpenLogin={handleOpenLogin} isLiveBackend={true} />
          <main>
            <DocumentoHero onOpenLogin={handleOpenLogin} />
            <DocumentoPreview />
            <DocumentoCoverageExplorer />
            <DocumentoProblemSolution />
            <DocumentoWorkflow />
            <DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />
            <DocumentoCapabilities />
            <DocumentoTrust />
            <DocumentoFAQ />
          </main>
          <DocumentoFooter onOpenLogin={handleOpenLogin} />
          <DocumentoLoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} initialPortal={portal} />
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
`;

// Target destination paths
const targetTsxPath = path.join(DOWNLOADS_DIR, 'DocumentoLandingPage.tsx');
const targetHtmlPath = path.join(DOWNLOADS_DIR, 'documento-landing-page.html');

console.log('Writing target files to Downloads folder...');
fs.writeFileSync(targetTsxPath, standaloneTsxContent, 'utf-8');
console.log('Wrote:', targetTsxPath, '(' + fs.statSync(targetTsxPath).size + ' bytes)');

fs.writeFileSync(targetHtmlPath, standaloneHtmlContent, 'utf-8');
console.log('Wrote:', targetHtmlPath, '(' + fs.statSync(targetHtmlPath).size + ' bytes)');

console.log('Done! Both functional landing page files are in Downloads.');
