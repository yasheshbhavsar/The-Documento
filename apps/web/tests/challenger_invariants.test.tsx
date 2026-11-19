import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import Home from "../app/page";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { DocumentoHero } from "../components/landing/DocumentoHero";
import { DocumentoFooter } from "../components/landing/DocumentoFooter";
import { DocumentoSignalStrip } from "../components/landing/DocumentoSignalStrip";
import { DocumentoPreview } from "../components/landing/DocumentoPreview";
import { DocumentoWorkflow } from "../components/landing/DocumentoWorkflow";
import { DocumentoCoverageExplorer } from "../components/landing/DocumentoCoverageExplorer";
import { DocumentoInteractiveTools } from "../components/landing/DocumentoInteractiveTools";
import { DocumentoTrust } from "../components/landing/DocumentoTrust";
import { DocumentoFAQ } from "../components/landing/DocumentoFAQ";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

describe("Challenger 2 — Contract Invariants & Dynamic Import Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("Invariant 1: Landing Hero & Footer boundaries preserve structure with zero demo PII", () => {
    const heroPath = path.resolve(__dirname, "../components/landing/DocumentoHero.tsx");
    const footerPath = path.resolve(__dirname, "../components/landing/DocumentoFooter.tsx");
    expect(fs.existsSync(heroPath)).toBe(true);
    expect(fs.existsSync(footerPath)).toBe(true);

    const heroContent = fs.readFileSync(heroPath, "utf8");
    const footerContent = fs.readFileSync(footerPath, "utf8");
    expect(heroContent).not.toMatch(/Maria\s+Elena\s+Vasquez|Lucas\s+Vasquez|Alistair\s+Finch/i);
    expect(footerContent.length).toBeGreaterThan(0);
  });

  it("Invariant 2: Dynamic lazy imports — AuthenticatedWorkspaceShell & apps/web/app/page.tsx preserve all 12 dynamic imports and prewarming logic", () => {
    const pageContent = fs.readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf8");
    const shellContent = fs.readFileSync(
      path.resolve(__dirname, "../components/layout/AuthenticatedWorkspaceShell.tsx"),
      "utf8"
    );

    const expectedDynamicComponents = [
      "WorkspaceHeader",
      "OwnerMasterDashboard",
      "SuperAdminControlPlane",
      "EmployeeWorkspace",
      "ClientPortal",
      "CreateClientModal",
      "CreateCaseModal",
      "PostOnboardingLaunchpadModal",
      "CaseDrilldownDrawer",
      "CaseDetailModal",
      "DocumentUploadModal",
      "GuidedQuestionnaireModal",
    ];

    expectedDynamicComponents.forEach((componentName) => {
      const pattern = new RegExp(`const\\s+${componentName}\\s*=\\s*dynamic\\(`, "g");
      expect(
        shellContent.match(pattern),
        `Dynamic import for ${componentName} must be defined using next/dynamic`
      ).not.toBeNull();
    });

    // Count total next/dynamic definitions in AuthenticatedWorkspaceShell.tsx
    const dynamicMatches = shellContent.match(/dynamic\(\(\)\s*=>\s*import\(/g);
    expect(dynamicMatches).not.toBeNull();
    expect(dynamicMatches?.length).toBe(12);

    // Verify prewarming logic on login modal open
    expect(pageContent).toContain("if (!isLoginModalOpen) return;");
    expect(pageContent).toContain("void import(\"../components/layout/WorkspaceHeader\");");
    expect(pageContent).toContain("void import(\"../components/dashboards/OwnerMasterDashboard\");");
    expect(pageContent).toContain("void import(\"../components/dashboards/EmployeeWorkspace\");");
    expect(pageContent).toContain("void import(\"../components/dashboards/ClientPortal\");");
  });

  it("Invariant 3: Anchor Targets — All 8 required anchors exist in rendered landing DOM", () => {
    const { container } = render(<Home />);

    const requiredAnchors = [
      "trust",
      "capabilities",
      "faq",
      "comparison",
      "pathway-finder",
      "preview",
      "workflow",
      "coverage",
    ];

    requiredAnchors.forEach((anchorId) => {
      const element = container.querySelector(`#${anchorId}`);
      expect(element, `Element with id="${anchorId}" must exist in the landing page DOM`).not.toBeNull();
    });
  });

  it("Invariant 4: Anchor Links — Navbar, Hero, and Footer navigation links reference valid anchors", () => {
    const { container } = render(<Home />);

    const allAnchorLinks = Array.from(container.querySelectorAll('a[href^="#"]'));
    expect(allAnchorLinks.length).toBeGreaterThan(0);

    const internalHrefs = new Set(
      allAnchorLinks
        .map((a) => a.getAttribute("href"))
        .filter((h): h is string => Boolean(h && h.startsWith("#")))
    );

    // Verify each referenced hash exists in the DOM
    internalHrefs.forEach((href) => {
      const targetId = href.slice(1);
      if (targetId === "hero") {
        // DocumentoHero top anchor or section
        const heroEl = container.querySelector("#hero") || container.querySelector("section");
        expect(heroEl).not.toBeNull();
      } else {
        const targetEl = container.querySelector(`#${targetId}`);
        expect(targetEl, `Anchor link href="${href}" must point to an existing DOM element id="${targetId}"`).not.toBeNull();
      }
    });
  });

  it("Invariant 5: Middle Components Animation Hook — Every middle section includes .animate-on-scroll element", () => {
    const sections = [
      { name: "DocumentoSignalStrip", ui: <DocumentoSignalStrip /> },
      { name: "DocumentoPreview", ui: <DocumentoPreview /> },
      { name: "DocumentoWorkflow", ui: <DocumentoWorkflow /> },
      { name: "DocumentoCoverageExplorer", ui: <DocumentoCoverageExplorer /> },
      { name: "DocumentoInteractiveTools", ui: <DocumentoInteractiveTools onOpenLogin={vi.fn()} /> },
      { name: "DocumentoTrust", ui: <DocumentoTrust /> },
      { name: "DocumentoFAQ", ui: <DocumentoFAQ /> },
    ];

    sections.forEach(({ name, ui }) => {
      const { container } = render(ui);
      const animatedEls = container.querySelectorAll(".animate-on-scroll");
      expect(
        animatedEls.length,
        `${name} must contain at least one .animate-on-scroll element for IntersectionObserver`
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("Invariant 6: Performance & Compositor — No heavy canvas or scroll wheel interception in middle sections", () => {
    const smoothScrollCode = fs.readFileSync(
      path.resolve(__dirname, "../components/landing/useSmoothScroll.ts"),
      "utf8"
    );
    // useSmoothScroll must remain a no-op to allow native 60/120Hz compositor scrolling
    expect(smoothScrollCode).toContain("no-op so native compositor scrolling runs unimpeded");

    // Middle landing components must not introduce <canvas> elements
    const middleComponentFiles = [
      "DocumentoSignalStrip.tsx",
      "DocumentoPreview.tsx",
      "DocumentoWorkflow.tsx",
      "DocumentoCoverageExplorer.tsx",
      "DocumentoInteractiveTools.tsx",
      "DocumentoTrust.tsx",
      "DocumentoFAQ.tsx",
    ];

    middleComponentFiles.forEach((file) => {
      const content = fs.readFileSync(
        path.resolve(__dirname, "../components/landing", file),
        "utf8"
      );
      expect(content).not.toContain("<canvas");
    });
  });
});
