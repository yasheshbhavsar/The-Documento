/**
 * Documento Minimal Section Design Tokens
 * Matched to Documento Minimal Section Design Guide
 */
export const landingTokens = {
  colors: {
    bg: "#FAF9F6",         // Warm ivory section surface
    heading: "#073D40",    // Headings and strong text
    primary: "#07594F",    // Buttons, active controls, links
    primaryHover: "#05413A",
    accent: "#169B77",     // Small indicators, left indicators, active lines
    mint: "#EAF5EF",       // Selected row and subtle highlights
    body: "#5D6E7F",       // Supporting copy
    muted: "#7B8E8B",      // Secondary metadata & captions
    divider: "#DCE7E3",    // Fine borders and separators
    surface: "#FFFFFF",    // Inputs or clean inner panels
    borderSubtle: "rgba(7, 89, 79, 0.12)",
  },
  typography: {
    fontDisplay: "var(--font-display, Inter, sans-serif)",
    fontBody: "var(--font-body, Inter, sans-serif)",
    eyebrow: {
      fontSize: "12px",
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: "#07594F",
    },
    heading: {
      fontSize: "clamp(32px, 3.6vw, 46px)",
      fontWeight: 700,
      color: "#073D40",
      lineHeight: 1.16,
      letterSpacing: "-0.025em",
    },
    subheading: {
      fontSize: "16px",
      color: "#5D6E7F",
      lineHeight: 1.6,
    },
  },
  layout: {
    maxWidth: "1280px",
    verticalPadding: "88px 24px",
    gap: "56px",
    borderRadius: "10px",
  },
} as const;

