"use client";

import React, { useState, useEffect } from "react";
import { UserContext, UserExperience, RoleCode, ImmigrationCase, ClientProfile, DocumentItem, CaseTask, AIFinding, MessageItem, NotificationItem, InvoiceItem, TeamMemberCapacity, AuditEvent } from "../lib/types";
import { api } from "../lib/api";
import { DEMO_USERS } from "../lib/auth";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { CreateCaseModal } from "../components/modals/CreateCaseModal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { DocumentUploadModal } from "../components/modals/DocumentUploadModal";
import { GuidedQuestionnaireModal } from "../components/modals/GuidedQuestionnaireModal";
import { AlertBanner } from "../components/common/NotificationToast";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { DocumentoHero } from "../components/landing/DocumentoHero";
import { DocumentoPreview } from "../components/landing/DocumentoPreview";
import { DocumentoCoverageExplorer } from "../components/landing/DocumentoCoverageExplorer";
import { DocumentoProblemSolution } from "../components/landing/DocumentoProblemSolution";
import { DocumentoWorkflow } from "../components/landing/DocumentoWorkflow";
import { DocumentoInteractiveTools } from "../components/landing/DocumentoInteractiveTools";
import { DocumentoCapabilities } from "../components/landing/DocumentoCapabilities";
import { DocumentoTrust } from "../components/landing/DocumentoTrust";
import { DocumentoFAQ } from "../components/landing/DocumentoFAQ";
import { DocumentoFooter } from "../components/landing/DocumentoFooter";
import { WaveBackground } from "../components/landing/WaveBackground";
import { FluidSectionContainer } from "../components/landing/FluidSectionContainer";
import { DocumentoLoginModal } from "../components/auth/DocumentoLoginModal";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { useAnimationOnScroll } from "../components/landing/useAnimationOnScroll";
import { useSmoothScroll } from "../components/landing/useSmoothScroll";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginInitialPortal, setLoginInitialPortal] = useState<"firm" | "client">("firm");
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [bannerAlert, setBannerAlert] = useState<{ type: "success" | "info" | "warning" | "critical"; message: string } | null>(null);

  // Initialize on-scroll reveal animations for landing page with currentUser trigger
  useAnimationOnScroll(".animate-on-scroll", true, currentUser);

  // Initialize smooth inertia scroll via Lenis strictly on the public landing page
  useSmoothScroll(!currentUser);

  // Active role mapping based on authenticated user
  const activeExp: UserExperience = currentUser ? currentUser.experience : "master_admin";
  const currentRole: RoleCode = currentUser ? currentUser.role : "master_admin";

  // Core domain state
  const [cases, setCases] = useState<ImmigrationCase[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [aiFindings, setAiFindings] = useState<AIFinding[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [capacity, setCapacity] = useState<TeamMemberCapacity[]>([]);

  // Modals state
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [selectedCaseForDrawer, setSelectedCaseForDrawer] = useState<ImmigrationCase | null>(null);
  const [selectedCaseForDetailModal, setSelectedCaseForDetailModal] = useState<ImmigrationCase | null>(null);

  // Load existing session from storage if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("documento_user") || sessionStorage.getItem("documento_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UserContext;
          if (parsed && parsed.id) {
            setCurrentUser(parsed);
          }
        } catch {
          // ignore corrupted local storage
        }
      }
    }
  }, []);

  // Initial data loading when role changes
  useEffect(() => {
    async function loadData() {
      try {
        const isHealthy = await api.checkBackendHealth();
        setIsLiveBackend(isHealthy);
        if (!isHealthy && process.env.NODE_ENV === "production") {
          setBannerAlert({
            type: "warning",
            message: "Documento Production API is unreachable. In-memory fallback is disabled in production to protect data integrity.",
          });
          return;
        }

        const casesRes = await api.getCases(currentRole);
        setCases(casesRes.data);

        const clientsRes = await api.getClients(currentRole);
        setClients(clientsRes.data);

        const docsRes = await api.getDocuments();
        setDocuments(docsRes.data);

        const auditRes = await api.getAuditEvents(currentRole);
        setAuditEvents(auditRes.data);

        const notifsRes = await api.getNotifications(currentRole);
        setNotifications(notifsRes.data);

        const tasksRes = await api.getTasks();
        setTasks(tasksRes.data);

        const findingsRes = await api.getAIFindings();
        setAiFindings(findingsRes.data);

        const msgsRes = await api.getMessages();
        setMessages(msgsRes.data);

        const invsRes = await api.getInvoices();
        setInvoices(invsRes.data);

        const capRes = await api.getTeamCapacity();
        setCapacity(capRes.data);
      } catch (err: any) {
        setBannerAlert({
          type: "warning",
          message: err?.message || "Error communicating with Documento API",
        });
      }
    }

    loadData();
  }, [currentRole]);

  // Auth Handlers
  const handleOpenLogin = (portal: "firm" | "client" = "firm") => {
    setLoginInitialPortal(portal);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (user: UserContext) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("documento_user", JSON.stringify(user));
    }
    setBannerAlert({
      type: "success",
      message: `Welcome, ${user.full_name}. Authenticated to ${user.organization_name}.`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("documento_user");
      sessionStorage.removeItem("documento_user");
      // Instantly reveal landing page elements on next frame upon sign-out
      requestAnimationFrame(() => {
        if (typeof (window as any).initInViewAnimations === "function") {
          (window as any).initInViewAnimations();
        }
      });
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        window.scrollTo(0, 0);
      }
    }
    setBannerAlert({
      type: "info",
      message: "You have been safely signed out of Documento.",
    });
  };

  const handleSwitchRoleInWorkspace = (role: string | UserExperience) => {
    const demoUser = DEMO_USERS[role] || DEMO_USERS.master_admin;
    setCurrentUser(demoUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("documento_user", JSON.stringify(demoUser));
    }
    setBannerAlert(null);
  };

  // Auto-dismiss transient banner alerts after 4 seconds
  useEffect(() => {
    if (!bannerAlert) return;
    const timer = setTimeout(() => {
      setBannerAlert(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [bannerAlert]);

  // Domain Handlers
  const handleCaseCreated = (newCase: ImmigrationCase) => {
    setCases((prev) => [newCase, ...prev]);
    setBannerAlert({
      type: "success",
      message: `Immigration Case ${newCase.case_number} created and assigned to lead counsel.`,
    });
  };

  const handleClientCreated = (newClient: ClientProfile) => {
    setClients((prev) => [newClient, ...prev]);
    setBannerAlert({
      type: "success",
      message: `Client ${newClient.first_name} ${newClient.last_name} retained and onboarding profile created.`,
    });
  };

  const handleClientUpdated = (updatedClient: ClientProfile) => {
    setClients((prev) => prev.map((c) => (c.id === updatedClient.id ? updatedClient : c)));
    setBannerAlert({
      type: "success",
      message: `Credentials provisioned for client ${updatedClient.first_name} ${updatedClient.last_name}. Portal access status: ${updatedClient.portal_access_enabled ? "Active" : "Disabled"}.`,
    });
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await api.deleteClient(clientId, currentRole);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      setBannerAlert({
        type: "success",
        message: "Retained client profile successfully deleted from firm directory.",
      });
      try {
        const auditRes = await api.getAuditEvents(currentRole);
        setAuditEvents(auditRes.data);
      } catch {}
    } catch (err: any) {
      setBannerAlert({
        type: "critical",
        message: err?.message || "Failed to delete client profile.",
      });
    }
  };

  const handleCaseUpdated = (updatedCase: ImmigrationCase) => {
    setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
    setBannerAlert({
      type: "info",
      message: `Case ${updatedCase.case_number} details and milestone progress updated.`,
    });
  };

  const handleDocumentUploaded = (newDoc: DocumentItem) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setBannerAlert({
      type: "success",
      message: `Document "${newDoc.title}" uploaded to secure vault with SHA-256 verification.`,
    });
  };

  const handleDocumentUpdated = (updatedDoc: DocumentItem) => {
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    setBannerAlert({
      type: "info",
      message: `Document "${updatedDoc.title}" updated. Processing status: ${updatedDoc.processing_status}.`,
    });
  };

  const handleResolveFinding = async (findingId: string, note: string) => {
    const caseId = cases[0]?.id || "case-01";
    await api.resolveFinding(caseId, findingId, note || "Resolved by reviewer");
    setAiFindings((prev) => prev.map((f) => (f.id === findingId ? { ...f, status: "resolved" } : f)));
    setBannerAlert({ type: "success", message: "Discrepancy marked as resolved." });
  };

  const handleDismissFinding = async (findingId: string, reason: string, note: string) => {
    const caseId = cases[0]?.id || "case-01";
    await api.dismissFinding(caseId, findingId, reason || "false_positive", note || "Dismissed by reviewer");
    setAiFindings((prev) => prev.map((f) => (f.id === findingId ? { ...f, status: "dismissed" } : f)));
    setBannerAlert({ type: "info", message: "Finding dismissed." });
  };

  const handleEscalateFinding = async (findingId: string, note: string) => {
    const caseId = cases[0]?.id || "case-01";
    await api.escalateFinding(caseId, findingId, note || "Escalated for senior review");
    setAiFindings((prev) => prev.map((f) => (f.id === findingId ? { ...f, status: "needs_review" } : f)));
    setBannerAlert({ type: "warning", message: "Finding escalated to supervising attorney." });
  };

  const handleSendMessage = async (content: string) => {
    await api.sendMessage(content, "client");
    setBannerAlert({ type: "success", message: "Message sent securely to firm legal team." });
  };

  const handleMarkNotificationRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t))
    );
  };

  const handleResetToScratch = () => {
    api.resetToScratch();
    setCases([]);
    setClients([]);
    setDocuments([]);
    setTasks([]);
    setAiFindings([]);
    setMessages([]);
    setInvoices([]);
    setAuditEvents([
      {
        id: "audit-init",
        action: "workspace.initialized",
        object_type: "workspace",
        object_id: "org-vanguard",
        actor_email: currentUser?.email || "sarah.jenkins@vanguardlegal.com",
        created_at: new Date().toISOString(),
        metadata: {
          note: "Firm workspace started from scratch (Day 0). Zero mock cases and zero mock documents.",
        },
      },
    ]);
    setNotifications([
      {
        id: "notif-init",
        title: "Initial Setup Ready",
        body: "Firm workspace started from scratch. Onboard your first client or create your first immigration case to begin the live flow.",
        status: "unread",
        created_at: new Date().toISOString(),
      },
    ]);
    setBannerAlert({
      type: "info",
      message: "Workspace successfully reset to Day 0 clean slate (0 cases, 0 documents, 0 clients).",
    });
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
                setIsLiveBackend(h);
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
          <FluidSectionContainer>
            <DocumentoPreview />
            <DocumentoCoverageExplorer />
            <DocumentoProblemSolution />
            <DocumentoWorkflow />
            <DocumentoInteractiveTools
              onOpenLogin={handleOpenLogin}
            />
            <DocumentoCapabilities />
            <DocumentoTrust />
            <DocumentoFAQ />
          </FluidSectionContainer>
          <DocumentoFooter
            onOpenLogin={handleOpenLogin}
          />

          {/* Top Tier Login Modal */}
          <DocumentoLoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
            initialPortal={loginInitialPortal}
          />
        </WaveBackground>
      )}

      {/* STATE B: AUTHENTICATED ENTERPRISE WORKSPACE */}
      {currentUser && (
        <div>
          <WorkspaceHeader
            currentUser={currentUser}
            onLogout={handleLogout}
            onSwitchRole={handleSwitchRoleInWorkspace}
            onResetToScratch={handleResetToScratch}
            isLiveBackend={isLiveBackend}
          />

          <main style={{ padding: 0 }}>
            {activeExp === "master_admin" && (
              <OwnerMasterDashboard
                cases={cases}
                clients={clients}
                auditEvents={auditEvents}
                invoices={invoices}
                capacity={capacity}
                isLiveBackend={isLiveBackend}
                onOpenCreateCase={() => setIsCreateCaseOpen(true)}
                onOpenCreateClient={() => setIsCreateClientOpen(true)}
                onSelectCase={(c) => setSelectedCaseForDrawer(c)}
                onClientUpdated={handleClientUpdated}
                onDeleteClient={handleDeleteClient}
                currentUser={currentUser || undefined}
              />
            )}

            {activeExp === "case_manager" && (
              <EmployeeWorkspace
                cases={cases}
                clients={clients}
                documents={documents}
                tasks={tasks}
                aiFindings={aiFindings}
                messages={messages}
                onToggleTask={handleToggleTask}
                onSendMessage={handleSendMessage}
                onSelectCase={(c) => setSelectedCaseForDrawer(c)}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onOpenCreateClient={() => setIsCreateClientOpen(true)}
                onDocumentUpdated={handleDocumentUpdated}
                onClientUpdated={handleClientUpdated}
                onDeleteClient={handleDeleteClient}
                currentUser={currentUser || undefined}
                onResolveFinding={handleResolveFinding}
                onDismissFinding={handleDismissFinding}
                onEscalateFinding={handleEscalateFinding}
              />
            )}

            {activeExp === "client_applicant" && (() => {
              // Retained client must only see data manually assigned/updated for them by Owner/Paralegal
              const clientCase =
                cases.find(
                  (c) =>
                    c.client_id === currentUser?.id ||
                    (c.client_name &&
                      currentUser?.full_name &&
                      c.client_name.toLowerCase().includes(currentUser.full_name.toLowerCase()))
                ) || null;

              const clientDocuments = clientCase
                ? documents.filter((d) => d.case_id === clientCase.id)
                : [];
              const clientMessages = clientCase
                ? messages.filter((m) => m.sender_role === "client" || m.sender_role === "attorney")
                : [];
              const clientInvoices = clientCase
                ? invoices.filter(
                    (inv) =>
                      inv.case_number === clientCase.case_number ||
                      (inv.case_id && inv.case_id === clientCase.id)
                  )
                : [];

              return (
                <ClientPortal
                  myCase={clientCase}
                  documents={clientDocuments}
                  messages={clientMessages}
                  notifications={clientCase ? notifications : []}
                  invoices={clientInvoices}
                  onOpenUploadModal={() => setIsUploadModalOpen(true)}
                  onOpenQuestionnaireModal={() => setIsQuestionnaireOpen(true)}
                  onSendMessage={handleSendMessage}
                  onMarkNotificationRead={handleMarkNotificationRead}
                  onDocumentUpdated={handleDocumentUpdated}
                />
              );
            })()}
          </main>
        </div>
      )}


      {/* Modals & Drawers */}
      <CreateCaseModal
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
        clients={clients}
        onCaseCreated={handleCaseCreated}
        activeRole={currentRole}
      />
      <CreateClientModal
        isOpen={isCreateClientOpen}
        onClose={() => setIsCreateClientOpen(false)}
        onClientCreated={handleClientCreated}
        activeRole={currentRole}
      />
      <CaseDrilldownDrawer
        isOpen={!!selectedCaseForDrawer}
        onClose={() => setSelectedCaseForDrawer(null)}
        caseItem={selectedCaseForDrawer}
        onOpenWorkspace={() => handleSwitchRoleInWorkspace("case_manager")}
        onOpenDetailModal={(c) => setSelectedCaseForDetailModal(c)}
      />
      <CaseDetailModal
        isOpen={!!selectedCaseForDetailModal}
        onClose={() => setSelectedCaseForDetailModal(null)}
        caseItem={selectedCaseForDetailModal}
        onCaseUpdated={handleCaseUpdated}
        activeRole={currentRole}
      />
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDocumentUploaded={handleDocumentUploaded}
        activeRole={currentRole}
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
