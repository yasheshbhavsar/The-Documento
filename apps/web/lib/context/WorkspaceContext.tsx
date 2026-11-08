"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  UserContext,
  UserExperience,
  RoleCode,
  ImmigrationCase,
  ClientProfile,
  DocumentItem,
  CaseTask,
  NotificationItem,
  AuditEvent,
  AIFinding,
  MessageItem,
  InvoiceItem,
  TeamMemberCapacity,
} from "../types";
import { api } from "../api";
import { purgeLegacyDemoStorageOnce } from "../agencyPlatformStore";
import { initCaseKickoffRecord } from "../caseKickoffStore";

export interface BannerAlert {
  type: "success" | "info" | "warning" | "critical";
  message: string;
}

export type ActiveRole =
  | "master_admin"
  | "case_manager"
  | "paralegal"
  | "client_applicant"
  | "super_admin";

export interface WorkspaceContextType {
  // Session & Authentication
  currentUser: UserContext | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserContext | null>>;
  activeRole: ActiveRole;
  activeExp: UserExperience;
  currentRoleCode: RoleCode;
  isLiveBackend: boolean;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Domain Collections
  cases: ImmigrationCase[];
  clients: ClientProfile[];
  documents: DocumentItem[];
  tasks: CaseTask[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  auditEvents: AuditEvent[];
  aiFindings: AIFinding[];
  messages: MessageItem[];
  invoices: InvoiceItem[];
  capacity: TeamMemberCapacity[];

  // Kickoff state
  kickoffVersion: number;
  selectedCaseForKickoff: ImmigrationCase | null;
  setSelectedCaseForKickoff: (c: ImmigrationCase | null) => void;

  // Global Feedback & UI State
  bannerAlert: BannerAlert | null;
  setBannerAlert: (alert: BannerAlert | null) => void;

  // Refresh methods
  refreshCases: () => Promise<void>;
  refreshClients: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshLiveTasksAndAudit: () => Promise<void>;

  // Central Domain Mutators
  handleCaseCreated: (
    newCase: ImmigrationCase,
    linkedClient?: ClientProfile,
    isNewClientOnboarding?: boolean
  ) => void;
  handleCaseUpdated: (updatedCase: ImmigrationCase) => void;
  handleClientCreated: (newClient: ClientProfile) => void;
  handleClientUpdated: (updatedClient: ClientProfile) => void;
  handleDeleteClient: (clientId: string) => Promise<void>;
  handleDocumentUploaded: (newDoc: DocumentItem) => void;
  handleDocumentUpdated: (updatedDoc: DocumentItem) => void;
  handleToggleTask: (taskId: string) => void;
  handleSendMessage: (content: string) => Promise<void>;
  handleMarkNotificationRead: (id: string) => Promise<void>;
  handleResolveFinding: (findingId: string, note: string) => Promise<void>;
  handleDismissFinding: (findingId: string, reason: string, note: string) => Promise<void>;
  handleEscalateFinding: (findingId: string, note: string) => Promise<void>;
  handleResetToScratch: () => void;
  handleLoginSuccess: (user: UserContext) => void;
  handleLogout: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export interface WorkspaceProviderProps {
  children: ReactNode;
  initialUser?: UserContext | null;
}

export function WorkspaceProvider({ children, initialUser }: WorkspaceProviderProps) {
  const [currentUser, setCurrentUser] = useState<UserContext | null>(initialUser ?? null);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bannerAlert, setBannerAlert] = useState<BannerAlert | null>(null);

  // Domain Collections
  const [cases, setCases] = useState<ImmigrationCase[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [aiFindings, setAiFindings] = useState<AIFinding[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [capacity, setCapacity] = useState<TeamMemberCapacity[]>([]);

  // Kickoff state
  const [selectedCaseForKickoff, setSelectedCaseForKickoff] = useState<ImmigrationCase | null>(null);
  const [kickoffVersion, setKickoffVersion] = useState<number>(0);

  // Load existing session from storage if present (only when initialUser was not passed)
  useEffect(() => {
    if (initialUser !== undefined) return;
    purgeLegacyDemoStorageOnce();
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
  }, [initialUser]);

  // Active role mapping based on authenticated user
  const activeRole: ActiveRole = useMemo(() => {
    if (!currentUser) return "master_admin";
    if (currentUser.role === "platform_super_admin" || currentUser.role === "platform_ops") return "super_admin";
    if (currentUser.experience === "client_applicant") return "client_applicant";
    if (currentUser.experience === "case_manager") return "case_manager";
    if (currentUser.experience === "paralegal") return "paralegal";
    return "master_admin";
  }, [currentUser]);

  const activeExp: UserExperience = currentUser ? currentUser.experience : "master_admin";
  const currentRoleCode: RoleCode = currentUser ? currentUser.role : "master_admin";

  // Auto-dismiss transient banner alerts after 4 seconds
  useEffect(() => {
    if (!bannerAlert) return;
    const timer = setTimeout(() => {
      setBannerAlert(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [bannerAlert]);

  // Memoized refresh methods
  const refreshCases = useCallback(async () => {
    try {
      const res = await api.getCases(currentRoleCode);
      setCases(res.data);
    } catch {
      // Non-blocking
    }
  }, [currentRoleCode]);

  const refreshClients = useCallback(async () => {
    try {
      const res = await api.getClients(currentRoleCode);
      setClients(res.data);
    } catch {
      // Non-blocking
    }
  }, [currentRoleCode]);

  const refreshDocuments = useCallback(async () => {
    try {
      const res = await api.getDocuments();
      setDocuments(res.data);
    } catch {
      // Non-blocking
    }
  }, []);

  const refreshLiveTasksAndAudit = useCallback(async () => {
    try {
      const [tasksRes, auditRes, invRes, msgRes] = await Promise.all([
        api.getTasks(),
        api.getAuditEvents(currentRoleCode),
        api.getInvoices(),
        api.getMessages(),
      ]);
      setTasks(tasksRes.data);
      setAuditEvents(auditRes.data);
      setInvoices(invRes.data);
      setMessages(msgRes.data);
    } catch {
      // Non-blocking state sync
    }
  }, [currentRoleCode]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const isHealthy = await api.checkBackendHealth();
      setIsLiveBackend(isHealthy);
      if (!isHealthy && process.env.NODE_ENV === "production") {
        setBannerAlert({
          type: "warning",
          message:
            "Documento Production API is unreachable. In-memory fallback is disabled in production to protect data integrity.",
        });
        setIsLoading(false);
        return;
      }

      if (
        !currentUser ||
        currentUser.role === "platform_super_admin" ||
        currentUser.role === "platform_ops"
      ) {
        setCases([]);
        setClients([]);
        setDocuments([]);
        setTasks([]);
        setAiFindings([]);
        setMessages([]);
        setInvoices([]);
        setCapacity([]);
        setIsLoading(false);
        return;
      }

      const [
        casesRes,
        clientsRes,
        docsRes,
        auditRes,
        notifsRes,
        tasksRes,
        findingsRes,
        msgsRes,
        invsRes,
        capRes,
      ] = await Promise.all([
        api.getCases(currentRoleCode),
        api.getClients(currentRoleCode),
        api.getDocuments(),
        api.getAuditEvents(currentRoleCode),
        api.getNotifications(currentRoleCode),
        api.getTasks(),
        api.getAIFindings(),
        api.getMessages(),
        api.getInvoices(),
        api.getTeamCapacity(),
      ]);

      setCases(casesRes.data);
      setClients(clientsRes.data);
      setDocuments(docsRes.data);
      setAuditEvents(auditRes.data);
      setNotifications(notifsRes.data);
      setTasks(tasksRes.data);
      setAiFindings(findingsRes.data);
      setMessages(msgsRes.data);
      setInvoices(invsRes.data);
      setCapacity(capRes.data);
    } catch (err: any) {
      setBannerAlert({
        type: "warning",
        message: err?.message || "Error communicating with Documento API",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentRoleCode, currentUser]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => n.status === "unread").length;
  }, [notifications]);

  // Central Domain Mutators
  const handleCaseCreated = useCallback(
    (
      newCase: ImmigrationCase,
      linkedClient?: ClientProfile,
      isNewClientOnboarding?: boolean
    ) => {
      initCaseKickoffRecord({
        caseId: newCase.id,
        caseNumber: newCase.case_number,
        clientId: newCase.client_id,
        assignedOfficer: newCase.assigned_manager || currentUser?.full_name,
      });
      setCases((prev) => [newCase, ...prev]);
      setKickoffVersion((v) => v + 1);
      setSelectedCaseForKickoff(newCase);
      setBannerAlert({
        type: "success",
        message: linkedClient
          ? isNewClientOnboarding !== false
            ? `Client ${linkedClient.first_name} ${linkedClient.last_name} onboarded and Case ${newCase.case_number} (${newCase.visa_category}) opened.`
            : `New Case ${newCase.case_number} (${newCase.visa_category}) opened for existing client ${linkedClient.first_name} ${linkedClient.last_name}.`
          : `Immigration Case ${newCase.case_number} created and assigned to lead counsel.`,
      });
      void refreshLiveTasksAndAudit();
    },
    [currentUser?.full_name, refreshLiveTasksAndAudit]
  );

  const handleCaseUpdated = useCallback((updatedCase: ImmigrationCase) => {
    setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
    setBannerAlert({
      type: "info",
      message: `Case ${updatedCase.case_number} details and milestone progress updated.`,
    });
  }, []);

  const handleClientCreated = useCallback(
    (newClient: ClientProfile) => {
      setClients((prev) => [newClient, ...prev]);
      setBannerAlert({
        type: "success",
        message: `Client ${newClient.first_name} ${newClient.last_name} retained and onboarding profile created.`,
      });
      void refreshLiveTasksAndAudit();
    },
    [refreshLiveTasksAndAudit]
  );

  const handleClientUpdated = useCallback((updatedClient: ClientProfile) => {
    setClients((prev) => prev.map((c) => (c.id === updatedClient.id ? updatedClient : c)));
    setBannerAlert({
      type: "success",
      message: `Credentials provisioned for client ${updatedClient.first_name} ${updatedClient.last_name}. Portal access status: ${updatedClient.portal_access_enabled ? "Active" : "Disabled"}.`,
    });
  }, []);

  const handleDeleteClient = useCallback(
    async (clientId: string) => {
      try {
        await api.deleteClient(clientId, currentRoleCode, true);

        // Find linked cases from current state
        const targetClient = clients.find((c) => c.id === clientId);
        const linkedCaseIds = cases
          .filter(
            (c) =>
              c.client_id === clientId ||
              (targetClient &&
                c.client_name &&
                c.client_name.toLowerCase().includes(`${targetClient.first_name} ${targetClient.last_name}`.toLowerCase()))
          )
          .map((c) => c.id);

        setClients((prev) => prev.filter((c) => c.id !== clientId));
        setCases((prev) => prev.filter((c) => !linkedCaseIds.includes(c.id) && c.client_id !== clientId));
        setDocuments((prev) => prev.filter((d) => !linkedCaseIds.includes(d.case_id)));
        setTasks((prev) => prev.filter((t) => !linkedCaseIds.includes(t.case_id)));

        setSelectedCaseForKickoff((prev) => {
          if (prev && (prev.client_id === clientId || linkedCaseIds.includes(prev.id))) {
            return null;
          }
          return prev;
        });

        // Clean up localStorage intake sheets
        if (typeof window !== "undefined") {
          for (const caseId of linkedCaseIds) {
            window.localStorage.removeItem(`documento_initial_info_sheet_${caseId}`);
            window.localStorage.removeItem(`documento_questionnaire_${caseId}`);
          }
          window.localStorage.removeItem(`documento_initial_info_sheet_${clientId}`);
          window.localStorage.removeItem(`documento_questionnaire_${clientId}`);
          window.localStorage.removeItem("documento_initial_info_sheet_record");
        }

        setBannerAlert({
          type: "success",
          message: "Retained client profile and associated case records successfully deleted.",
        });
        try {
          const auditRes = await api.getAuditEvents(currentRoleCode);
          setAuditEvents(auditRes.data);
        } catch {}
      } catch (err: any) {
        setBannerAlert({
          type: "critical",
          message: err?.message || "Failed to delete client profile.",
        });
      }
    },
    [currentRoleCode, clients, cases]
  );

  const handleDocumentUploaded = useCallback((newDoc: DocumentItem) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setBannerAlert({
      type: "success",
      message: `Document "${newDoc.title}" uploaded to secure vault with SHA-256 verification.`,
    });
  }, []);

  const handleDocumentUpdated = useCallback((updatedDoc: DocumentItem) => {
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    setBannerAlert({
      type: "info",
      message: `Document "${updatedDoc.title}" updated. Processing status: ${updatedDoc.processing_status}.`,
    });
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    void api.toggleTask(taskId);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextCompleted = !t.is_completed;
        return {
          ...t,
          is_completed: nextCompleted,
          status: nextCompleted ? "completed" : "pending",
        };
      })
    );
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const senderRole = activeExp === "client_applicant" ? "client" : "attorney";
      const newMsg = await api.sendMessage(content, senderRole);
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg.data]);
      }
      setBannerAlert({ type: "success", message: "Message sent securely to firm legal team." });
    },
    [activeExp]
  );

  const handleMarkNotificationRead = useCallback(async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
  }, []);

  const handleResolveFinding = useCallback(
    async (findingId: string, note: string) => {
      const finding = aiFindings.find((f) => f.id === findingId);
      const caseId = finding?.case_id || cases[0]?.id || "case-01";
      await api.resolveFinding(caseId, findingId, note || "Resolved by reviewer");
      setAiFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: "resolved" } : f))
      );
      setBannerAlert({ type: "success", message: "Discrepancy marked as resolved." });
    },
    [aiFindings, cases]
  );

  const handleDismissFinding = useCallback(
    async (findingId: string, reason: string, note: string) => {
      const finding = aiFindings.find((f) => f.id === findingId);
      const caseId = finding?.case_id || cases[0]?.id || "case-01";
      await api.dismissFinding(caseId, findingId, reason || "false_positive", note || "Dismissed by reviewer");
      setAiFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: "dismissed" } : f))
      );
      setBannerAlert({ type: "info", message: "Finding dismissed." });
    },
    [aiFindings, cases]
  );

  const handleEscalateFinding = useCallback(
    async (findingId: string, note: string) => {
      const finding = aiFindings.find((f) => f.id === findingId);
      const caseId = finding?.case_id || cases[0]?.id || "case-01";
      await api.escalateFinding(caseId, findingId, note || "Escalated for senior review");
      setAiFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: "needs_review" } : f))
      );
      setBannerAlert({ type: "warning", message: "Finding escalated to supervising attorney." });
    },
    [aiFindings, cases]
  );

  const handleResetToScratch = useCallback(() => {
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
        object_id: currentUser?.organization_id || "workspace",
        actor_email: currentUser?.email || "operator@workspace.local",
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
      message:
        "Workspace successfully reset to Day 0 clean slate (0 cases, 0 documents, 0 clients).",
    });
  }, [currentUser?.email, currentUser?.organization_id]);

  const handleLoginSuccess = useCallback((user: UserContext) => {
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("documento_user", JSON.stringify(user));
    }
    setBannerAlert({
      type: "success",
      message: `Welcome, ${user.full_name}. Authenticated to ${user.organization_name}.`,
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleLogout = useCallback(() => {
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
  }, []);

  const value: WorkspaceContextType = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      activeRole,
      activeExp,
      currentRoleCode,
      isLiveBackend,
      isLoading,
      setIsLoading,
      cases,
      clients,
      documents,
      tasks,
      notifications,
      unreadNotificationCount,
      auditEvents,
      aiFindings,
      messages,
      invoices,
      capacity,
      kickoffVersion,
      selectedCaseForKickoff,
      setSelectedCaseForKickoff,
      bannerAlert,
      setBannerAlert,
      refreshCases,
      refreshClients,
      refreshDocuments,
      refreshAll,
      refreshLiveTasksAndAudit,
      handleCaseCreated,
      handleCaseUpdated,
      handleClientCreated,
      handleClientUpdated,
      handleDeleteClient,
      handleDocumentUploaded,
      handleDocumentUpdated,
      handleToggleTask,
      handleSendMessage,
      handleMarkNotificationRead,
      handleResolveFinding,
      handleDismissFinding,
      handleEscalateFinding,
      handleResetToScratch,
      handleLoginSuccess,
      handleLogout,
    }),
    [
      currentUser,
      activeRole,
      activeExp,
      currentRoleCode,
      isLiveBackend,
      isLoading,
      cases,
      clients,
      documents,
      tasks,
      notifications,
      unreadNotificationCount,
      auditEvents,
      aiFindings,
      messages,
      invoices,
      capacity,
      kickoffVersion,
      selectedCaseForKickoff,
      bannerAlert,
      refreshCases,
      refreshClients,
      refreshDocuments,
      refreshAll,
      refreshLiveTasksAndAudit,
      handleCaseCreated,
      handleCaseUpdated,
      handleClientCreated,
      handleClientUpdated,
      handleDeleteClient,
      handleDocumentUploaded,
      handleDocumentUpdated,
      handleToggleTask,
      handleSendMessage,
      handleMarkNotificationRead,
      handleResolveFinding,
      handleDismissFinding,
      handleEscalateFinding,
      handleResetToScratch,
      handleLoginSuccess,
      handleLogout,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

export function useWorkspaceSafe(): WorkspaceContextType | null {
  return useContext(WorkspaceContext);
}
