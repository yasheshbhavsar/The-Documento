interface DocumentoHeroProps {
  onOpenLogin: (portal?: "firm" | "client") => void;
}

export function DocumentoHero({ onOpenLogin }: DocumentoHeroProps) {
  return (
    <section
      id="hero"
      style={{
        position: "relative",
        padding: "64px 24px 72px 24px",
        background: "linear-gradient(180deg, #F8F7F2 0%, #FFFFFF 100%)",
        borderBottom: "1px solid #DCE5E1",
        overflow: "hidden",
      }}
    >
      {/* Subtle organic decorative glow in pale seafoam */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "5%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(185, 222, 212, 0.35) 0%, rgba(221, 239, 232, 0.1) 60%, transparent 80%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "-10%",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(221, 239, 232, 0.45) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
          {/* Eyebrow Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "24px",
              background: "#DDEFE8",
              border: "1px solid #B9DED4",
              color: "#063C3D",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              marginBottom: "24px",
              boxShadow: "0 1px 3px rgba(6, 60, 61, 0.05)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#0D6866",
              }}
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
              margin: "0 0 22px 0",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Every immigration case.
            <br />
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontWeight: 400,
                fontStyle: "italic",
                color: "#0D6866",
              }}
            >
              Clearer by design.
            </span>
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontSize: "clamp(16px, 2.2vw, 20px)",
              lineHeight: 1.6,
              color: "#445451",
              margin: "0 auto 36px auto",
              maxWidth: "720px",
              fontWeight: 400,
            }}
          >
            Bring documents, requirements, deadlines, and case progress into one intelligent workspace built for immigration teams and the people they serve.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "32px",
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
              <span>Access Workspaces</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <a
              href="#preview"
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
                e.currentTarget.style.background = "#F8F7F2";
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
              <span>View Case Pipeline Preview</span>
            </a>
          </div>
        </div>

        {/* Hero Visual Banner: Case Evidence & Verification Strip */}
        <div
          style={{
            marginTop: "54px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
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
                <polyline points="10 9 9 9 8 9" />
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
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
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
                Versioned Legal Rules
              </div>
              <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                Evaluate evidence against authoritative USCIS policy memos, statutory criteria, and filing requirements with audit diffs.
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
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
          </div>
        </div>
      </div>
    </section>
  );
}
