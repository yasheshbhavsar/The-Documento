import type { ReactNode } from "react";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documento — Immigration Case Intelligence & Management",
  description: "Clarity through organized documents, requirements, deadlines, and case workflows for immigration law firms and applicants.",
  icons: {
    icon: "/documento-logo.png",
    apple: "/documento-logo.png",
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

