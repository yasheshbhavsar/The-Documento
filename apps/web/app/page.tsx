"use client";

import React, { useState, useEffect } from "react";
import { UserExperience, RoleCode, ImmigrationCase, ClientProfile, DocumentItem, CaseTask, AIFinding, MessageItem, NotificationItem, InvoiceItem, TeamMemberCapacity, AuditEvent } from "../lib/types";
import { api } from "../lib/api";
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
import { DocumentoLogo } from "../components/common/DocumentoLogo";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { DocumentoHero } from "../components/landing/DocumentoHero";
import { DocumentoPreview } from "../components/landing/DocumentoPreview";
import { DocumentoCapabilities } from "../components/landing/DocumentoCapabilities";
import { DocumentoWorkflow } from "../components/landing/DocumentoWorkflow";
import { DocumentoTrust } from "../components/landing/DocumentoTrust";
import { DocumentoFooter } from "../components/landing/DocumentoFooter";

export default function Home() {
  const [currentView, setCurrentView] = useState<"landing" | "workspace">("landing");
  const [activeExp, setActiveExp] = useState<UserExperience>("master_admin");
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [bannerAlert, setBannerAlert] = useState<{ type: "success" | "info" | "warning"; message: string } | null>(null);

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

  // Active role mapping
  const currentRole: RoleCode =
    activeExp === "master_admin"
      ? "master_admin"
      : activeExp === "case_manager"
      ? "case_manager"
      : "retained_client";

  // Initial data loading
  useEffect(() => {
    async function loadData() {
      const isHealthy = await api.checkBackendHealth();
      setIsLiveBackend(isHealthy);

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
    }

    loadData();
  }, [activeExp]);

  // Handlers
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

  const handleSelectRoleFromLanding = (role: UserExperience) => {
    setActiveExp(role);
    setCurrentView("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenWorkspaces = () => {
    setCurrentView("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg, #F8F7F2)" }}>
      {/* Documento Top Platform Bar */}
      <div className="persona-switcher-bar">
        <div className="persona-title">
          <DocumentoLogo size="sm" showWordmark={false} />
          <span style={{ fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>DOCUMENTO</span>
          <span style={{ color: "#B9DED4", margin: "0 2px", opacity: 0.5 }}>|</span>
          <span style={{ fontWeight: 400, color: "#B9DED4", fontSize: "12px" }}>
            {currentView === "landing" ? "Product Overview & Live Sandbox" : "Active Role Workspace"}
          </span>
          <span className="pulse-indicator"></span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {currentView === "workspace" && (
            <button
              type="button"
              onClick={() => setCurrentView("landing")}
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(185, 222, 212, 0.25)",
                color: "#FFFFFF",
                padding: "5px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>← Back to Overview</span>
            </button>
          )}

          <div className="persona-pills">
            <button
              type="button"
              className={`persona-pill ${currentView === "landing" ? "active" : ""}`}
              onClick={() => setCurrentView("landing")}
            >
              Landing Overview
            </button>
            <button
              type="button"
              className={`persona-pill ${currentView === "workspace" && activeExp === "master_admin" ? "active" : ""}`}
              onClick={() => {
                setActiveExp("master_admin");
                setCurrentView("workspace");
              }}
            >
              Partner View
            </button>
            <button
              type="button"
              className={`persona-pill ${currentView === "workspace" && activeExp === "case_manager" ? "active" : ""}`}
              onClick={() => {
                setActiveExp("case_manager");
                setCurrentView("workspace");
              }}
            >
              Paralegal Hub
            </button>
            <button
              type="button"
              className={`persona-pill ${currentView === "workspace" && activeExp === "client_applicant" ? "active" : ""}`}
              onClick={() => {
                setActiveExp("client_applicant");
                setCurrentView("workspace");
              }}
            >
              Client Portal
            </button>
          </div>
        </div>
      </div>

      {/* Global Alert Notification */}
      {bannerAlert && (
        <div style={{ padding: "12px 24px 0 24px" }}>
          <AlertBanner
            type={bannerAlert.type}
            message={bannerAlert.message}
            onDismiss={() => setBannerAlert(null)}
          />
        </div>
      )}

      {/* VIEW 1: Documento Brand & Product Landing Page */}
      {currentView === "landing" && (
        <div>
          <DocumentoNavbar
            onSelectRole={handleSelectRoleFromLanding}
            onOpenApp={handleOpenWorkspaces}
            isLiveBackend={isLiveBackend}
          />
          <DocumentoHero
            onOpenApp={handleOpenWorkspaces}
            onSelectRole={handleSelectRoleFromLanding}
          />
          <DocumentoPreview />
          <DocumentoCapabilities />
          <DocumentoWorkflow />
          <DocumentoTrust />
          <DocumentoFooter
            onSelectRole={handleSelectRoleFromLanding}
            onOpenApp={handleOpenWorkspaces}
          />
        </div>
      )}

      {/* VIEW 2: Interactive Role Workspaces */}
      {currentView === "workspace" && (
        <main style={{ padding: "16px 24px 48px 24px" }}>
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
              onDocumentUpdated={handleDocumentUpdated}
              onResolveFinding={handleResolveFinding}
              onDismissFinding={handleDismissFinding}
              onEscalateFinding={handleEscalateFinding}
            />
          )}

          {activeExp === "client_applicant" && (
            <ClientPortal
              myCase={cases[0] || null}
              documents={documents}
              messages={messages}
              notifications={notifications}
              invoices={invoices}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              onOpenQuestionnaireModal={() => setIsQuestionnaireOpen(true)}
              onSendMessage={handleSendMessage}
              onMarkNotificationRead={handleMarkNotificationRead}
              onDocumentUpdated={handleDocumentUpdated}
            />
          )}
        </main>
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
        onOpenWorkspace={() => setActiveExp("case_manager")}
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
