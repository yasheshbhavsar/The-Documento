"use client";

import React, { useState, useEffect } from "react";
import type { UserContext } from "../lib/types";
import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import { AuthenticatedWorkspaceShell } from "../components/layout/AuthenticatedWorkspaceShell";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { DocumentoHero } from "../components/landing/DocumentoHero";
import { DocumentoSignalStrip } from "../components/landing/DocumentoSignalStrip";
import { DocumentoPreview } from "../components/landing/DocumentoPreview";
import { DocumentoWorkflow } from "../components/landing/DocumentoWorkflow";
import { DocumentoCoverageExplorer } from "../components/landing/DocumentoCoverageExplorer";
import { DocumentoInteractiveTools } from "../components/landing/DocumentoInteractiveTools";
import { DocumentoTrust } from "../components/landing/DocumentoTrust";
import { DocumentoFAQ } from "../components/landing/DocumentoFAQ";
import { DocumentoFooter } from "../components/landing/DocumentoFooter";
import { WaveBackground } from "../components/landing/WaveBackground";
import { DocumentoLoginModal } from "../components/auth/DocumentoLoginModal";
import { useAnimationOnScroll } from "../components/landing/useAnimationOnScroll";

export default function Home() {
  return (
    <WorkspaceProvider>
      <DocumentoLandingOrWorkspace />
    </WorkspaceProvider>
  );
}

function DocumentoLandingOrWorkspace() {
  const { currentUser, isLiveBackend, bannerAlert, setBannerAlert, handleLoginSuccess } = useWorkspace();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginInitialPortal, setLoginInitialPortal] = useState<"firm" | "client">("firm");

  useAnimationOnScroll(".animate-on-scroll", true, currentUser);

  useEffect(() => {
    if (!isLoginModalOpen) return;
    if (typeof process !== "undefined" && process.env.VITEST) return;
    void import("../components/layout/WorkspaceHeader");
    void import("../components/dashboards/OwnerMasterDashboard");
    void import("../components/dashboards/EmployeeWorkspace");
    void import("../components/dashboards/ClientPortal");
  }, [isLoginModalOpen]);

  if (currentUser) {
    return <AuthenticatedWorkspaceShell />;
  }

  const handleOpenLogin = (portal: "firm" | "client" = "firm") => {
    setLoginInitialPortal(portal);
    setIsLoginModalOpen(true);
  };

  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {bannerAlert && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "#063C3D",
            color: "#FFFFFF",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(6, 60, 61, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span>{bannerAlert.message}</span>
          <button
            type="button"
            onClick={() => setBannerAlert(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}
      <WaveBackground>
        <DocumentoNavbar onOpenLogin={handleOpenLogin} isLiveBackend={isLiveBackend} />
        <DocumentoHero onOpenLogin={handleOpenLogin} />
        <DocumentoSignalStrip />
        <DocumentoPreview />
        <DocumentoWorkflow />
        <DocumentoCoverageExplorer />
        <DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />
        <DocumentoTrust />
        <DocumentoFAQ onOpenLogin={handleOpenLogin} />
        <DocumentoFooter onOpenLogin={handleOpenLogin} />
        <DocumentoLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(user: UserContext) => {
            handleLoginSuccess(user);
            setIsLoginModalOpen(false);
          }}
          initialPortal={loginInitialPortal}
        />
      </WaveBackground>
    </div>
  );
}
