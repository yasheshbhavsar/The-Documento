import type { ReactNode } from "react";
import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Immigration — Case Management Platform",
  description: "Multi-tenant AI-powered immigration case management and document intelligence system.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
