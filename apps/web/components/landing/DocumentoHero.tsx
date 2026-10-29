"use client";

import React, { useState, useRef, useEffect } from "react";
import RotatingText from "../ui/RotatingText";
import { Globe, type Marker } from "../ui/cobe-globe";
import OrbitImages from "../ui/OrbitImages";

const ROTATING_HERO_HEADLINES = [
  "Smarter Document Workflows.",
  "Clearer by Design.",
  "Workflows, Reimagined.",
  "AI-Powered Clarity.",
  "Complexity Made Simple.",
  "Evidence, Organized.",
  "A Clearer Way Forward.",
];

const JURISDICTION_MARKERS: Marker[] = [
  { id: "usa", location: [39.0, -98.0], label: "USA" },
  { id: "uk", location: [51.5074, -0.1278], label: "UK" },
  { id: "canada", location: [45.4215, -75.6972], label: "Canada" },
  { id: "australia", location: [-33.8688, 151.2093], label: "Australia" },
  { id: "germany", location: [52.5200, 13.4050], label: "Germany" },
];

const ORBIT_FLAG_ITEMS = [
  { src: "/flags/usa.png", alt: "USA (USCIS)" },
  { src: "/flags/uk.png", alt: "UK (UKVI)" },
  { src: "/flags/germany.png", alt: "Germany (BAMF)" },
  { src: "/flags/australia.png", alt: "Australia (DoHA)" },
  { src: "/flags/canada.png", alt: "Canada (IRCC)" },
];

interface DocumentoHeroProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

export function DocumentoHero({ onOpenLogin }: DocumentoHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Guarantee seamless video playback across all browsers and devices
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const startPlayback = () => {
      const promise = video.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // Autoplay policy fallback: resume on user gesture
          const resume = () => {
            video.play().catch(() => {});
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("scroll", resume);
            window.removeEventListener("touchstart", resume);
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("scroll", resume, { once: true });
          window.addEventListener("touchstart", resume, { once: true });
        });
      }
    };

    if (video.readyState >= 2) {
      startPlayback();
    } else {
      video.addEventListener("loadeddata", startPlayback, { once: true });
      video.addEventListener("canplay", startPlayback, { once: true });
    }
  }, []);

  return (
    <section
      id="hero"
      suppressHydrationWarning
      style={{
        position: "relative",
        marginTop: "-72px",
        padding: "0 0 80px 0",
        background: "transparent",
        borderBottom: "1px solid #DCE7E3",
        overflow: "hidden",
      }}
    >
      {/* Upper Hero Stage: Video Waves & Messaging - Strictly Bounded Above the 3 Pillar Cards (The Blue Line) */}
      <div
        suppressHydrationWarning
        style={{
          position: "relative",
          padding: "108px 24px 38px 24px",
          overflow: "hidden",
        }}
      >
        {/* Top ambient aura flowing directly behind the sticky glass navbar */}
        <div
          suppressHydrationWarning
          style={{
            position: "absolute",
            top: "0",
            left: "50%",
            transform: "translate(-50%, -35%)",
            width: "1360px",
            height: "320px",
            borderRadius: "50%",
            background: "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(185, 222, 212, 0.6) 0%, rgba(221, 239, 232, 0.35) 50%, transparent 75%)",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Radiant ambient aura in soft seafoam to amplify wave luminosity & color depth */}
        <div
          suppressHydrationWarning
          style={{
            position: "absolute",
            top: "42%",
            left: "40%",
            transform: "translate(-50%, -50%)",
            width: "920px",
            height: "420px",
            borderRadius: "50%",
            background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(185, 222, 212, 0.45) 0%, rgba(221, 239, 232, 0.22) 55%, transparent 75%)",
            filter: "blur(55px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* High-Performance Looping Gradient Waves Video - Pinned exactly to the bounds of this Upper Stage */}
        <div
          suppressHydrationWarning
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
            maskImage: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%)",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 70%",
              display: "block",
              mixBlendMode: "multiply",
              filter: "invert(1) hue-rotate(180deg) saturate(2.4) contrast(1.35)",
              opacity: 1,
            }}
          >
            <source src="/videos/gradient-waves.webm" type="video/webm" />
            <source src="/gradient-waves.webm" type="video/webm" />
          </video>
        </div>

        <div
          suppressHydrationWarning
          className="documento-hero-stage-grid"
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            className="animate-on-scroll"
            suppressHydrationWarning
            style={{
              maxWidth: "720px",
              margin: "0",
              textAlign: "left",
            }}
          >
          {/* Eyebrow Badge */}
          <div
            className="documento-hero-badge"
            suppressHydrationWarning
            style={{ marginBottom: "16px", display: "inline-flex" }}
          >
            <span
              className="documento-hero-badge-dot"
              suppressHydrationWarning
            />
            <span>Immigration Case Management &amp; Evidence Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1
              style={{
                fontSize: "clamp(38px, 6vw, 64px)",
                fontWeight: 750,
                lineHeight: 1.1,
                letterSpacing: "-0.035em",
                color: "#063C3D",
                margin: "0 0 24px 0",
                textAlign: "left",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Every immigration case.
              <br />
              <span className="sr-only">Clearer by design.</span>
              <RotatingText
                texts={ROTATING_HERO_HEADLINES}
                effect="blur"
                direction="down"
                highlight={false}
                staggerFrom="center"
                staggerDuration={0.025}
                splitLevelClassName="overflow-hidden pb-0.5"
                rotationInterval={2600}
                blur={10}
                style={{
                  fontFamily: "var(--font-serif, Georgia, serif)",
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "#0D6866",
                  display: "inline-flex",
                }}
              />
            </h1>

          {/* Subheading emphasizing reduced administrative burden, organized evidence, and coordination */}
          <p
            style={{
              fontSize: "clamp(16px, 2.2vw, 20px)",
              lineHeight: 1.6,
              color: "#445451",
              margin: "0 0 36px 0",
              maxWidth: "760px",
              textAlign: "left",
              fontWeight: 400,
            }}
          >
            Eliminate administrative paperwork chaos. Documento organizes evidentiary exhibits, maps statutory requirements, tracks procedural filing clocks, and unifies applicants with their legal counsel in one transparent workspace.
          </p>

          {/* Prominent Primary Calls to Action */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "28px",
            }}
          >
            <button
              type="button"
              onClick={() => onOpenLogin("firm")}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                border: "1px solid #063C3D",
                padding: "14px 28px",
                borderRadius: "10px",
                fontWeight: 650,
                fontSize: "16px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 4px 14px rgba(13, 104, 102, 0.25)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#063C3D";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 60, 61, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0D6866";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(13, 104, 102, 0.25)";
              }}
            >
              <span>Get Started</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <a
              href="#workflow"
              style={{
                background: "#FFFFFF",
                color: "#063C3D",
                border: "1px solid #DCE5E1",
                padding: "14px 24px",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "16px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 4px rgba(6, 60, 61, 0.04)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0D6866";
                e.currentTarget.style.background = "#F4F7F6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#DCE5E1";
                e.currentTarget.style.background = "#FFFFFF";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="#0D6866" stroke="none" />
              </svg>
              <span>Explore How It Works</span>
            </a>

            <a
              href="#preview"
              style={{
                background: "transparent",
                color: "#0D6866",
                border: "1px solid transparent",
                padding: "14px 20px",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "15px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#DDEFE8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span>See the workflow ↓</span>
            </a>
          </div>

          {/* Quick Scope & Trust Verification Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              flexWrap: "wrap",
              gap: "16px",
              fontSize: "13px",
              color: "#6E7F7C",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>3 Verified Jurisdictions</strong> (US, UK, Canada)</span>
            </div>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>6 Operational Pathways</strong></span>
            </div>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>100% SHA-256 Provenance</strong></span>
            </div>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#176B50", fontWeight: 700 }}>✓</span>
              <span><strong>Mandatory Attorney Sign-Off</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D Jurisdictions Globe with Orbiting Country Flags */}
        <div
          className="documento-hero-globe-column"
          suppressHydrationWarning
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div
            className="documento-hero-globe-wrapper"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "660px",
              aspectRatio: "1 / 1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Soft luminous ambient aura behind globe and orbit */}
            <div
              style={{
                position: "absolute",
                inset: "-4%",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(185, 222, 212, 0.48) 0%, rgba(221, 239, 232, 0.22) 50%, transparent 72%)",
                filter: "blur(36px)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            {/* Orbiting Country Flags around the Centered Globe */}
            <OrbitImages
              images={ORBIT_FLAG_ITEMS}
              shape="ellipse"
              baseWidth={1400}
              radiusX={720}
              radiusY={220}
              rotation={-12}
              duration={26}
              itemSize={125}
              depth={0.65}
              showPath={true}
              pathColor="#0D6866"
              pathWidth={2.4}
              shadow={0}
              draggable={true}
              clickToFront={true}
              width="100%"
              height="100%"
              className="w-full h-full"
              centerContent={
                <div
                  style={{
                    position: "relative",
                    width: "clamp(340px, 85%, 560px)",
                    aspectRatio: "1 / 1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Globe
                    markers={[]}
                    arcs={[]}
                    markerColor={[0.051, 0.408, 0.400]}
                    baseColor={[0.051, 0.408, 0.400]}
                    glowColor={[0.74, 0.90, 0.85]}
                    dark={0}
                    mapBrightness={7}
                    markerSize={0.045}
                    speed={0.00268}
                    theta={0.22}
                    opacity={0.90}
                    canvasOpacity={0.98}
                    showMarkerLabels={false}
                    className="w-full h-full"
                  />
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>

      {/* Lower Hero Stage: Below The Line (3 Core Pillars & Live AI Dossier Showcase) */}
      <div
        suppressHydrationWarning
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Hero Visual Banner: 3 Core Pillars */}
        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Card 1 */}
          <a
            href="#preview"
            className="animate-on-scroll delay-100"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                100% Provenance Tracking
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                Every data extraction and timeline fact is anchored to exact source exhibit pages with cryptographic SHA-256 hashes.
              </div>
            </div>
          </a>

          {/* Card 2 */}
          <a
            href="#coverage"
            className="animate-on-scroll delay-200"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                Versioned Statutory Rules
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                Evaluate evidence against authoritative USCIS policy memos, statutory criteria, and filing guidelines with audit diffs.
              </div>
            </div>
          </a>

          {/* Card 3 */}
          <a
            href="#trust"
            className="animate-on-scroll delay-300"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0D6866";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#DCE5E1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#DDEFE8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#063C3D",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#063C3D", marginBottom: "4px" }}>
                Accountable Attorney Review
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                AI findings serve as assistive suggestions. Consequential petition filings require licensed attorney adjudication.
              </div>
            </div>
          </a>
        </div>

        {/* Illustrative AI Dossier Showcase */}
        <div
          id="hero-dossier-showcase"
          className="animate-on-scroll delay-300"
          style={{
            marginTop: "36px",
            borderRadius: "14px",
            padding: "20px 24px 24px 24px",
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            boxShadow: "0 4px 20px rgba(6, 60, 61, 0.04)",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Header: Restrained, Factual Context */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "16px",
              borderBottom: "1px solid #DCE5E1",
              marginBottom: "16px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#0D6866",
                  marginBottom: "4px",
                }}
              >
                Illustrative Document-Intelligence Preview
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                  Canadian Super Visa Case Dossier
                </span>
                <span
                  style={{
                    background: "#DDEFE8",
                    color: "#063C3D",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 650,
                  }}
                >
                  Applicant: Maria Elena Vasquez
                </span>
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
              Sample Dossier • Human Attorney Adjudication Required
            </div>
          </div>

          <LiveDossierHeroDemo onOpenLogin={onOpenLogin} />
        </div>
      </div>
    </section>
  );
}

const DOSSIER_DEMO_ITEMS = [
  {
    id: "imm5257",
    tabLabel: "IMM 5257 Form",
    hasIssue: true,
    filename: "IMM 5257 Application for Visitor Visa (Super Visa)",
    category: "Statutory Application Form",
    source: "IRCC AcroForm (v06-2023) • Page 3, Statutory Questions",
    status: {
      type: "attention" as const,
      badge: "Needs Attention",
      message: "Prior 2023 visa refusal declared. Flagged for attorney statutory statement review.",
    },
    fields: [
      { label: "Unique Client Identifier (UCI)", value: "8194028511", status: "Extracted", statusType: "neutral" as const },
      { label: "Inviting Host (Child in Canada)", value: "Lucas Vasquez (Toronto, ON)", status: "Verified", statusType: "ready" as const },
      { label: "Prior Refusal Disclosure", value: "Declared: 2023 Study Visa Refusal", status: "Needs Review", statusType: "attention" as const },
      { label: "Principal Applicant", value: "Maria Elena Vasquez", status: "Verified", statusType: "ready" as const },
    ],
  },
  {
    id: "medical",
    tabLabel: "Medical Assessment",
    filename: "eMedical Upfront Health Assessment Sheet",
    category: "Statutory Medical Admissibility",
    source: "IRCC eMedical Clinic Summary (IME #31849204)",
    status: {
      type: "ready" as const,
      badge: "Cleared",
      message: "No statutory health inadmissibility identified under IRPA § 38(1).",
    },
    fields: [
      { label: "Upfront Medical Identifier (UMI)", value: "U940182650", status: "Verified", statusType: "ready" as const },
      { label: "Immigration Medical Exam (IME)", value: "31849204", status: "Completed", statusType: "ready" as const },
      { label: "Designated Panel Physician", value: "Dr. Alistair Finch, MD", status: "Verified", statusType: "neutral" as const },
      { label: "Admissibility Determination", value: "Passed (Valid 12 Months)", status: "Cleared", statusType: "ready" as const },
    ],
  },
  {
    id: "finance",
    tabLabel: "Financial Proof (LICO)",
    filename: "Proof of Financial Support — CRA Notice of Assessment",
    category: "Financial Support & Eligibility",
    source: "CRA Notice of Assessment (2024 Tax Year)",
    status: {
      type: "ready" as const,
      badge: "Threshold Met",
      message: "Host income ($98,450 CAD) exceeds statutory LICO requirement ($44,530 CAD for 3-person household).",
    },
    fields: [
      { label: "Line 15000 Total Income", value: "$98,450 CAD", status: "Verified", statusType: "ready" as const },
      { label: "Statutory 2024 LICO Threshold", value: "$44,530 CAD (Household of 3)", status: "Exceeded", statusType: "ready" as const },
      { label: "CRA Tax Assessment Year", value: "2024 Tax Year", status: "Valid", statusType: "neutral" as const },
      { label: "Host Sponsor", value: "Lucas Vasquez", status: "Verified", statusType: "ready" as const },
    ],
  },
  {
    id: "insurance",
    tabLabel: "Super Visa Insurance",
    filename: "Comprehensive Super Visa Medical Insurance Policy",
    category: "Mandatory Healthcare Undertaking",
    source: "Canadian Underwriter Policy Certificate (AZ-CAN-SV-8841920)",
    status: {
      type: "ready" as const,
      badge: "Policy Validated",
      message: "Prepaid 365-day emergency medical coverage exceeds statutory $100,000 CAD minimum.",
    },
    fields: [
      { label: "Canadian Insurance Underwriter", value: "Allianz Global Assistance Canada", status: "Authorized", statusType: "neutral" as const },
      { label: "Emergency Medical Coverage", value: "$150,000 CAD (Prepaid 365 Days)", status: "Compliant", statusType: "ready" as const },
      { label: "Policy Deductible", value: "$0.00 CAD (Nil Deductible)", status: "Standard", statusType: "neutral" as const },
      { label: "Policy Status", value: "Active & Bound", status: "Valid", statusType: "ready" as const },
    ],
  },
];

function LiveDossierHeroDemo({ onOpenLogin }: { onOpenLogin: (portal?: "firm" | "client") => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeDoc = DOSSIER_DEMO_ITEMS[selectedIdx];

  return (
    <div>
      {/* Exhibit selector tabs */}
      <div
        role="tablist"
        aria-label="Super Visa sample documents"
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "12px",
          marginBottom: "16px",
          scrollbarWidth: "none",
        }}
      >
        {DOSSIER_DEMO_ITEMS.map((item, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={item.id}
              role="tab"
              id={`dossier-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`dossier-panel-${item.id}`}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              style={{
                background: isSelected ? "#0D6866" : "#FFFFFF",
                color: isSelected ? "#FFFFFF" : "#445451",
                border: isSelected ? "1px solid #063C3D" : "1px solid #DCE5E1",
                padding: "7px 13px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: isSelected ? 650 : 550,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                transition: "all 0.16s ease",
              }}
            >
              {item.hasIssue ? (
                <span
                  title="Needs attention"
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: isSelected ? "#FFD166" : "#D97706",
                  }}
                />
              ) : (
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: isSelected ? "#B9DED4" : "#9BB8B0",
                  }}
                />
              )}
              <span>{item.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Selected document detail panel */}
      <div
        role="tabpanel"
        id={`dossier-panel-${activeDoc.id}`}
        aria-labelledby={`dossier-tab-${activeDoc.id}`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Document Identity, Status Callout, Provenance, & CTA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#063C3D",
                margin: "0 0 4px 0",
                lineHeight: 1.35,
              }}
            >
              {activeDoc.filename}
            </h3>
            <div style={{ fontSize: "12.5px", color: "#6E7F7C" }}>
              Category: <span style={{ color: "#172322", fontWeight: 600 }}>{activeDoc.category}</span>
            </div>
          </div>

          {/* Attention / Ready Status Callout */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: activeDoc.status.type === "attention" ? "#FEF9EE" : "#F0F8F5",
              border: `1px solid ${activeDoc.status.type === "attention" ? "#F3DFB0" : "#B9DED4"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: activeDoc.status.type === "attention" ? "#F59E0B" : "#0D6866",
                  color: "#FFFFFF",
                }}
              >
                {activeDoc.status.type === "attention" ? "!" : "✓"}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: activeDoc.status.type === "attention" ? "#92400E" : "#063C3D",
                }}
              >
                {activeDoc.status.badge}
              </span>
            </div>
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.45,
                color: activeDoc.status.type === "attention" ? "#78350F" : "#284A43",
              }}
            >
              {activeDoc.status.message}
            </div>
          </div>

          {/* Compact Source Hint */}
          <div
            style={{
              fontSize: "11.5px",
              color: "#6E7F7C",
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontWeight: 600, color: "#445451" }}>Source:</span> {activeDoc.source}
          </div>

          {/* Route CTA */}
          <div>
            <button
              type="button"
              onClick={() => onOpenLogin("firm")}
              className="hover-lift"
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                border: "none",
                padding: "9px 16px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 650,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "background 0.15s ease",
              }}
            >
              <span>Open in Case Dossier Workbench</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Column: Representative Extracted Fields */}
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#6E7F7C",
              marginBottom: "10px",
            }}
          >
            Extracted Key Fields
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activeDoc.fields.map((field) => {
              const isAttention = field.statusType === "attention";
              const isReady = field.statusType === "ready";
              return (
                <div
                  key={field.label}
                  style={{
                    background: "#FFFFFF",
                    border: isAttention ? "1px solid #F3DFB0" : "1px solid #E4ECE8",
                    borderRadius: "8px",
                    padding: "9px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#6E7F7C",
                        marginBottom: "2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {field.label}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 650,
                        color: isAttention ? "#92400E" : "#172322",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {field.value}
                    </div>
                  </div>

                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: "11px",
                      fontWeight: 650,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: isAttention ? "#FEF3C7" : isReady ? "#DDEFE8" : "#E8ECEB",
                      color: isAttention ? "#92400E" : isReady ? "#063C3D" : "#445451",
                    }}
                  >
                    {field.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

