import React from "react";

interface DocumentoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  showDomain?: boolean;
  useImage?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    iconSizeClass: "w-[26px] h-[26px]",
    dimension: 26,
    gapClass: "gap-2",
    fontSizeClass: "text-base",
    subtitleSizeClass: "text-[10px]",
  },
  md: {
    iconSizeClass: "w-[34px] h-[34px]",
    dimension: 34,
    gapClass: "gap-2.5",
    fontSizeClass: "text-xl",
    subtitleSizeClass: "text-[11px]",
  },
  lg: {
    iconSizeClass: "w-[44px] h-[44px]",
    dimension: 44,
    gapClass: "gap-3",
    fontSizeClass: "text-[25px]",
    subtitleSizeClass: "text-xs",
  },
  xl: {
    iconSizeClass: "w-[56px] h-[56px]",
    dimension: 56,
    gapClass: "gap-3.5",
    fontSizeClass: "text-[32px]",
    subtitleSizeClass: "text-sm",
  },
};

export function DocumentoLogo({
  size = "md",
  showWordmark = true,
  showDomain = false,
  useImage = true,
  theme = "light",
  className = "",
}: DocumentoLogoProps) {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  return (
    <div
      className={`inline-flex items-center select-none no-underline ${config.gapClass} ${className}`}
      aria-label="Documento - Immigration Case Intelligence"
    >
      {/* Emblem */}
      <div
        className={`relative shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${config.iconSizeClass}`}
        suppressHydrationWarning
      >
        {useImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/documento-logo.png"
            alt="Documento emblem"
            width={config.dimension}
            height={config.dimension}
            className="w-full h-full object-contain block"
          />
        ) : (
          // Scalable Vector Graphic representation of the folded D document
          <svg
            viewBox="0 0 100 100"
            width={config.dimension}
            height={config.dimension}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
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
        <div className="flex flex-col leading-[1.1]">
          <div
            className={`font-bold tracking-[-0.03em] ${
              theme === "dark" ? "text-white" : "text-[#063C3D]"
            } ${config.fontSizeClass}`}
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
            }}
          >
            Documento
          </div>
          {showDomain && (
            <span
              className={`mt-[1px] font-medium tracking-[0.02em] ${
                theme === "dark" ? "text-[#99C5BC]" : "text-[#6E7F7C]"
              } ${config.subtitleSizeClass}`}
            >
              thedocumento.com
            </span>
          )}
        </div>
      )}
    </div>
  );
}
