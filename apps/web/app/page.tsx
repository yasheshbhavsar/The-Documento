"use client";

import React, { useState } from "react";
import { UserContext, ImmigrationCase, ClientProfile } from "../lib/types";
import { api } from "../lib/api";
import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import { DashboardErrorBoundary } from "../components/common/DashboardErrorBoundary";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { SuperAdminControlPlane } from "../components/admin/SuperAdminControlPlane";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { CreateClientModal, ClientModalPrefill } from "../components/modals/CreateClientModal";
import { CreateCaseModal } from "../components/modals/CreateCaseModal";
import { PostOnboardingLaunchpadModal } from "../components/modals/PostOnboardingLaunchpadModal";
import { CalculatorAgencyLeadRecord } from "../lib/agencyPlatformStore";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { DocumentUploadModal } from "../components/modals/DocumentUploadModal";
import { GuidedQuestionnaireModal } from "../components/modals/GuidedQuestionnaireModal";
import { AlertBanner } from "../components/common/NotificationToast";
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
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { useAnimationOnScroll } from "../components/landing/useAnimationOnScroll";
import { useSmoothScroll } from "../components/landing/useSmoothScroll";

export default function Home() {
  return (
    <WorkspaceProvider>
      <DocumentoMainApp />
    </WorkspaceProvider>
  );
}

function DocumentoMainApp() {
  const {
    currentUser,
    activeExp,
    currentRoleCode,
    isLiveBackend,
    cases,
    clients,
    capacity,
    selectedCaseForKickoff,
    setSelectedCaseForKickoff,
    bannerAlert,
    setBannerAlert,
    refreshLiveTasksAndAudit,
    handleCaseCreated,
    handleCaseUpdated,
    handleClientCreated,
    handleClientUpdated,
    handleDocumentUploaded,
    handleLoginSuccess,
    handleLogout,
    handleResetToScratch,
  } = useWorkspace();

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginInitialPortal, setLoginInitialPortal] = useState<"firm" | "client">("firm");

  // Modals state
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [clientModalPrefill, setClientModalPrefill] = useState<ClientModalPrefill | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [selectedCaseForDrawer, setSelectedCaseForDrawer] = useState<ImmigrationCase | null>(null);
  const [selectedCaseForDetailModal, setSelectedCaseForDetailModal] = useState<ImmigrationCase | null>(null);

  // Initialize on-scroll reveal animations for landing page with currentUser trigger
  useAnimationOnScroll(".animate-on-scroll", true, currentUser);

  // Initialize smooth inertia scroll via Lenis strictly on the public landing page
  useSmoothScroll(!currentUser);

  // Auth Handlers
  const handleOpenLogin = (portal: "firm" | "client" = "firm") => {
    setLoginInitialPortal(portal);
    setIsLoginModalOpen(true);
  };

  // Restricted KYB Sandbox Guardrails & Lead-to-Client Conversion
  const guardSandboxAgencyAction = (actionName: string): boolean => {
    if (currentUser?.is_sandbox_agency) {
      setBannerAlert({
        type: "warning",
        message: `Restricted KYB Sandbox: Live ${actionName} unlocks automatically once Documento HQ verifies your regulatory license.`,
      });
      return false;
    }
    return true;
  };

  const handleOpenCreateCase = () => {
    if (!guardSandboxAgencyAction("case docket creation")) return;
    setIsCreateCaseOpen(true);
  };

  const handleOpenCreateClient = () => {
    if (!guardSandboxAgencyAction("client retention & portal credential issuance")) return;
    setClientModalPrefill(null);
    setIsCreateClientOpen(true);
  };

  const handleConvertLeadToClient = (lead: CalculatorAgencyLeadRecord) => {
    if (!guardSandboxAgencyAction("lead-to-client retention")) return;
    const parts = lead.applicantName.trim().split(/\s+/);
    const code = (lead.countryCode || "").toUpperCase();
    const titleLower = (lead.calculatorTitle || "").toLowerCase();

    let prefillJurisdiction = "United States (USCIS)";
    let prefillVisaCategory = "EB-1A Extraordinary Ability";

    if (code === "CA" || titleLower.includes("canada") || titleLower.includes("crs") || titleLower.includes("express entry")) {
      prefillJurisdiction = "Canada (IRCC)";
      prefillVisaCategory = titleLower.includes("study") ? "Canada Study Permit" : "Express Entry PNP";
    } else if (code === "UK" || code === "GB" || titleLower.includes("uk") || titleLower.includes("united kingdom")) {
      prefillJurisdiction = "United Kingdom (Home Office)";
      prefillVisaCategory = titleLower.includes("global talent")
        ? "Global Talent Tech Nation"
        : titleLower.includes("student")
          ? "UK Student Visa"
          : "UK Skilled Worker Visa";
    } else if (code === "AU" || titleLower.includes("australia") || titleLower.includes("skillselect")) {
      prefillJurisdiction = "Australia (Home Affairs)";
      prefillVisaCategory = titleLower.includes("student")
        ? "Australia Student Visa (Subclass 500)"
        : "Australia Global Talent";
    } else if (code === "DE" || titleLower.includes("germany") || titleLower.includes("chancenkarte") || titleLower.includes("blue card")) {
      prefillJurisdiction = "Germany (BAMF)";
      prefillVisaCategory = "Germany Opportunity Card (Chancenkarte)";
    } else if (titleLower.includes("h-1b")) {
      prefillVisaCategory = "H-1B Specialty Occupation";
    } else if (titleLower.includes("f-1")) {
      prefillVisaCategory = "US F-1 Academic Student";
    }

    setClientModalPrefill({
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "Applicant",
      email: lead.applicantEmail,
      phone: lead.applicantPhone || "",
      nationality: "",
      jurisdiction: prefillJurisdiction,
      visaCategory: prefillVisaCategory,
      leadScoreNote: `${lead.calculatorTitle} — ${lead.scoreSummary}`,
    });
    setIsCreateClientOpen(true);
  };

  const handleOpenUploadModal = () => {
    if (!guardSandboxAgencyAction("applicant PII document uploads")) return;
    setIsUploadModalOpen(true);
  };

  return (
    <div className="min-h-screen" style={{ background: currentUser ? "var(--bg, #F8F7F2)" : "#ffffff" }}>
      {/* Global Alert Notification (Floating Toast Notification) */}
      {bannerAlert && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            maxWidth: "420px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
          }}
        >
          <AlertBanner
            type={bannerAlert.type}
            message={bannerAlert.message}
            onDismiss={() => setBannerAlert(null)}
          />
        </div>
      )}

      {/* Actionable Production Disconnected Banner */}
      {!isLiveBackend && process.env.NODE_ENV === "production" && (
        <div
          role="alert"
          style={{
            background: "#991B1B",
            color: "#FFFFFF",
            padding: "10px 24px",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            position: "sticky",
            top: 0,
            zIndex: 9999,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚠️</span>
            <span>
              <strong>Production Alert:</strong> Documento API is currently unreachable. Mock fallback is disabled to protect database integrity.
            </span>
          </div>
          <button
            onClick={() => {
              api.checkBackendHealth().then((h) => {
                if (h) window.location.reload();
              });
            }}
            style={{
              background: "#FFFFFF",
              color: "#991B1B",
              border: "none",
              padding: "4px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            Reconnect
          </button>
        </div>
      )}

      {/* STATE A: PUBLIC LANDING PAGE (Clean, No dev bar) */}
      {!currentUser && (
        <WaveBackground>
          <DocumentoNavbar
            onOpenLogin={handleOpenLogin}
            isLiveBackend={isLiveBackend}
          />
          <DocumentoHero
            onOpenLogin={handleOpenLogin}
          />
          <DocumentoSignalStrip />

          {/* Beat 1: Evidence becomes clear */}
          <DocumentoPreview />

          {/* Beat 2: A case moves forward */}
          <DocumentoWorkflow />

          {/* Beat 3: Choose a route */}
          <DocumentoCoverageExplorer />

          {/* Beat 4: Fit and safeguards */}
          <DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />
          <DocumentoTrust />

          {/* Beat 5: Questions and action */}
          <DocumentoFAQ onOpenLogin={handleOpenLogin} />

          <DocumentoFooter
            onOpenLogin={handleOpenLogin}
          />

          {/* Top Tier Login Modal */}
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
      )}

      {/* STATE B: AUTHENTICATED ENTERPRISE WORKSPACE */}
      {currentUser && (activeExp === "platform_super_admin" || currentRoleCode === "platform_ops") && (
        <SuperAdminControlPlane onSignOut={handleLogout} />
      )}

      {currentUser && activeExp !== "platform_super_admin" && currentRoleCode !== "platform_ops" && (
        <div>
          <WorkspaceHeader
            currentUser={currentUser}
            onLogout={handleLogout}
            onResetToScratch={handleResetToScratch}
            isLiveBackend={isLiveBackend}
          />

          <main style={{ padding: 0 }}>
            <DashboardErrorBoundary
              sectionTitle="Role Workspace"
              sectionDescription="Role dashboard isolated view"
              isolateStateKey={activeExp}
            >
              {activeExp === "master_admin" && (
                <OwnerMasterDashboard
                  onOpenCreateCase={handleOpenCreateCase}
                  onOpenCreateClient={handleOpenCreateClient}
                  onConvertLeadToClient={handleConvertLeadToClient}
                  onSelectCase={(c) => setSelectedCaseForDrawer(c)}
                  onOpenCaseKickoff={(c) => setSelectedCaseForKickoff(c)}
                />
              )}

              {(activeExp === "case_manager" || activeExp === "paralegal") && (
                <EmployeeWorkspace
                  onSelectCase={(c) => setSelectedCaseForDrawer(c)}
                  onOpenUploadModal={handleOpenUploadModal}
                  onOpenCreateClient={handleOpenCreateClient}
                  onOpenCaseKickoff={(c) => setSelectedCaseForKickoff(c)}
                />
              )}

              {activeExp === "client_applicant" && (
                <ClientPortal
                  onOpenUploadModal={handleOpenUploadModal}
                  onOpenQuestionnaireModal={() => setIsQuestionnaireOpen(true)}
                />
              )}
            </DashboardErrorBoundary>
          </main>
        </div>
      )}

      {/* Modals & Drawers */}
      <CreateClientModal
        isOpen={isCreateClientOpen}
        onClose={() => {
          setIsCreateClientOpen(false);
          setClientModalPrefill(null);
        }}
        onClientCreated={handleClientCreated}
        onCaseCreated={handleCaseCreated}
        clients={clients}
        activeRole={currentRoleCode}
        initialPrefill={clientModalPrefill}
      />
      <CreateCaseModal
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
        clients={clients}
        onCaseCreated={handleCaseCreated}
        activeRole={currentRoleCode}
      />
      <PostOnboardingLaunchpadModal
        isOpen={!!selectedCaseForKickoff}
        onClose={() => setSelectedCaseForKickoff(null)}
        caseItem={
          selectedCaseForKickoff
            ? cases.find((c) => c.id === selectedCaseForKickoff.id) || selectedCaseForKickoff
            : null
        }
        clientItem={
          selectedCaseForKickoff
            ? clients.find(
                (cl) =>
                  cl.id === selectedCaseForKickoff.client_id ||
                  (selectedCaseForKickoff.client_name &&
                    `${cl.first_name} ${cl.last_name}`.trim().toLowerCase() ===
                      selectedCaseForKickoff.client_name.trim().toLowerCase())
              ) || null
            : null
        }
        teamCapacity={capacity}
        currentUser={currentUser}
        activeRole={currentRoleCode}
        onCaseUpdated={(updatedCase) => {
          handleCaseUpdated(updatedCase);
          setSelectedCaseForKickoff(updatedCase);
        }}
        onClientUpdated={handleClientUpdated}
        onDocumentUploaded={handleDocumentUploaded}
        onKickoffChanged={() => {
          void refreshLiveTasksAndAudit();
        }}
        onOpenCaseWorkspace={(c) => {
          setSelectedCaseForDetailModal(c);
        }}
      />
      <CaseDrilldownDrawer
        isOpen={!!selectedCaseForDrawer}
        onClose={() => setSelectedCaseForDrawer(null)}
        caseItem={selectedCaseForDrawer}
        onOpenCaseKickoff={(c) => setSelectedCaseForKickoff(c)}
        onOpenWorkspace={() => {
          if (selectedCaseForDrawer) {
            setSelectedCaseForDetailModal(selectedCaseForDrawer);
            setSelectedCaseForDrawer(null);
          }
        }}
        onOpenDetailModal={(c) => setSelectedCaseForDetailModal(c)}
      />
      <CaseDetailModal
        isOpen={!!selectedCaseForDetailModal}
        onClose={() => setSelectedCaseForDetailModal(null)}
        caseItem={selectedCaseForDetailModal}
        onCaseUpdated={handleCaseUpdated}
        activeRole={currentRoleCode}
      />
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        cases={
          activeExp === "client_applicant"
            ? cases.filter(
                (c) =>
                  c.client_id === currentUser?.id ||
                  (c.client_name &&
                    currentUser?.full_name &&
                    c.client_name.toLowerCase().includes(currentUser.full_name.toLowerCase()))
              )
            : cases
        }
        caseId={
          selectedCaseForDetailModal?.id ||
          (activeExp === "client_applicant"
            ? cases.find(
                (c) =>
                  c.client_id === currentUser?.id ||
                  (c.client_name &&
                    currentUser?.full_name &&
                    c.client_name.toLowerCase().includes(currentUser.full_name.toLowerCase()))
              )?.id
            : cases[0]?.id)
        }
        onDocumentUploaded={handleDocumentUploaded}
        activeRole={currentRoleCode}
      />
      <GuidedQuestionnaireModal
        isOpen={isQuestionnaireOpen}
        onClose={() => setIsQuestionnaireOpen(false)}
        onSaved={() => {
          setBannerAlert({
            type: "success",
            message: "Guided questionnaire responses saved and submitted for legal attorney brief preparation.",
          });
        }}
      />
    </div>
  );
}
