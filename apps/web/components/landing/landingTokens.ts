/**
 * Documento Minimal Section Design Tokens
 * Matched to Documento Section Design Guide with tighter, responsive rhythm
 */
export const landingTokens = {
  colors: {
    bg: "#ffffff",
    surfaceSubtle: "#F8FAF9",
    surfaceMuted: "#F1F6F4",
    heading: "#073D40",
    primary: "#07594F",
    primaryHover: "#05413A",
    accent: "#169B77",
    accentBright: "#2A9288",
    mint: "#EAF5EF",
    seafoam: "#DDEFE8",
    body: "#5D6E7F",
    textDark: "#172322",
    muted: "#7B8E8B",
    divider: "#DCE7E3",
    surface: "#FFFFFF",
    borderSubtle: "rgba(7, 89, 79, 0.12)",
    cardBorder: "#DCE7E3",
  },
  typography: {
    fontDisplay: "var(--font-display, 'Plus Jakarta Sans', Inter, sans-serif)",
    fontBody: "var(--font-body, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif)",
    eyebrow: {
      fontSize: "12px",
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: "#07594F",
    },
    heading: {
      fontSize: "clamp(26px, 3.2vw, 36px)",
      fontWeight: 700,
      color: "#073D40",
      lineHeight: 1.22,
      letterSpacing: "-0.025em",
    },
    subheading: {
      fontSize: "15px",
      color: "#5D6E7F",
      lineHeight: 1.55,
    },
  },
  layout: {
    maxWidth: "1240px",
    verticalPaddingDesktop: "56px 24px",
    verticalPaddingMobile: "36px 16px",
    gap: "28px",
    gapLarge: "36px",
    borderRadius: "12px",
    borderRadiusInner: "8px",
  },
} as const;
