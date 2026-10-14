import type { ReactNode } from "react";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#063C3D",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Documento — Immigration Case Intelligence & Management Platform",
  description:
    "Unified casework intelligence, rapid OCR verification, statutory rule compliance, and forensic evidence tracking for modern immigration law firms and petitioners.",
  applicationName: "Documento",
  authors: [{ name: "Documento Legal Technologies Inc." }],
  keywords: [
    "immigration case intelligence",
    "immigration law firm software",
    "EB-1A petition",
    "O-1A visa management",
    "Super Visa",
    "Express Entry",
    "forensic OCR extraction",
    "statutory rules engine",
    "IRCC form automation",
    "USCIS evidentiary audit",
  ],
  metadataBase: new URL("https://thedocumento.com"),
  openGraph: {
    title: "Documento — Immigration Case Intelligence & Management",
    description:
      "Eliminate administrative casework chaos with verified evidence extraction, automated statutory rule checks, and transparent client coordination.",
    url: "https://thedocumento.com",
    siteName: "Documento",
    images: [
      {
        url: "/documento-logo.png",
        width: 512,
        height: 512,
        alt: "Documento Case Intelligence Emblem",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documento — Immigration Case Intelligence",
    description: "Every immigration case. Clearer by design.",
    images: ["/documento-logo.png"],
  },
  icons: {
    icon: "/documento-logo.png",
    apple: "/documento-logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/documento-logo.png" type="image/png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}


