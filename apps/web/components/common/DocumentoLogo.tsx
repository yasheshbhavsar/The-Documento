import React from "react";

interface DocumentoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  showDomain?: boolean;
  useImage?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

export function DocumentoLogo({
  size = "md",
  showWordmark = true,
  showDomain = false,
  useImage = true,
  theme = "light",
  className = "",
}: DocumentoLogoProps) {
  const pixelDimensions = {
    sm: { icon: 26, fontSize: "16px", subtitleSize: "10px", gap: "8px" },
    md: { icon: 34, fontSize: "20px", subtitleSize: "11px", gap: "10px" },
    lg: { icon: 44, fontSize: "25px", subtitleSize: "12px", gap: "12px" },
    xl: { icon: 56, fontSize: "32px", subtitleSize: "14px", gap: "14px" },
  }[size];

  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: pixelDimensions.gap,
        textDecoration: "none",
      }}
      aria-label="Documento - Immigration Case Intelligence"
    >
      {/* Emblem */}
      <div
        style={{
          width: pixelDimensions.icon,
          height: pixelDimensions.icon,
          position: "relative",
          flexShrink: 0,
          borderRadius: "8px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {useImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/documento-logo.png"
            alt="Documento emblem"
            width={pixelDimensions.icon}
            height={pixelDimensions.icon}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          // Scalable Vector Graphic representation of the folded D document
          <svg
            viewBox="0 0 100 100"
            width={pixelDimensions.icon}
            height={pixelDimensions.icon}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Deep teal outer D-body */}
            <path
              d="M20 16C20 12.6863 22.6863 10 26 10H55C69.9117 10 82 22.0883 82 37C82 45.4741 78.0772 52.9463 72 57.8V74C72 79.5228 67.5228 84 62 84H26C22.6863 84 20 81.3137 20 78V16Z"
              fill="#063C3D"
            />
            {/* Pale mint folded document ribbon */}
            <path
              d="M48 24C48 24 64 26 70 38C76 50 68 62 58 66C48 70 38 72 38 72L42 56C42 56 50 56 54 52C58 48 58 42 54 36C50 30 44 30 44 30L48 24Z"
              fill="#B9DED4"
            />
            {/* Inner layered document fold */}
            <path
              d="M32 30H46V64H32C29.7909 64 28 62.2091 28 60V34C28 31.7909 29.7909 30 32 30Z"
              fill="#0D6866"
            />
          </svg>
        )}
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <div
            style={{
              fontSize: pixelDimensions.fontSize,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: theme === "dark" ? "#FFFFFF" : "#063C3D",
              fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
            }}
          >
            Documento
          </div>
          {showDomain && (
            <span
              style={{
                fontSize: pixelDimensions.subtitleSize,
                letterSpacing: "0.02em",
                color: theme === "dark" ? "#99C5BC" : "#6E7F7C",
                fontWeight: 500,
                marginTop: "1px",
              }}
            >
              thedocumento.com
            </span>
          )}
        </div>
      )}
    </div>
  );
}
