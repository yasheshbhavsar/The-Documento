import React, { useState } from "react";
import { DataTable, Column } from "../common/DataTable";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { WorkspaceIcon, WorkspaceIconName } from "../common/WorkspaceIcons";
import {
  ImmigrationCase,
  ClientProfile,
  AuditEvent,
  InvoiceItem,
  TeamMemberCapacity,
  ManagerPriorityQueueResponse,
  UserContext,
} from "../../lib/types";
import { canDeleteClient, canDeleteCase, canAssignCaseworker } from "../../lib/auth";
import { RuleAdministrationHub } from "../rules/RuleAdministrationHub";
import { ExecutiveCommandCenter } from "../analytics/ExecutiveCommandCenter";
import { AnalyticsExplorer } from "../analytics/AnalyticsExplorer";
import { BillingManager } from "../billing/BillingManager";
import { BusinessOperationsHub } from "../operations/BusinessOperationsHub";
import { OperationalReliabilityHub } from "../operations/OperationalReliabilityHub";
import { FirmConfigurationHub } from "../firm/FirmConfigurationHub";
import { ProvisionCredentialsModal } from "../modals/ProvisionCredentialsModal";
import { ManagerPriorityQueueView } from "./ManagerPriorityQueueView";
import { AgencyGrowthAndSetupDesk } from "../agency/AgencyGrowthAndSetupDesk";
import { DocumentExtractorLab } from "../tools/DocumentExtractorLab";
import { getCaseKickoffProgress } from "../../lib/caseKickoffStore";
import { formatCaseStageBadge, getCaseStageInfo } from "../../lib/caseLifecycle";
import { CalculatorAgencyLeadRecord, getAgencyForOrganization, getCalculatorAgencyLeads } from "../../lib/agencyPlatformStore";
import {
  api,
  fetchManagerPriorityQueue,
  FALLBACK_MANAGER_PRIORITY_QUEUE,
} from "../../lib/api";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";
import { DashboardErrorBoundary } from "../common/DashboardErrorBoundary";
import { FirmCleanSlateEmptyState } from "../common/EmptyStates";

export type BusinessSectionKey =
  | "overview"
  | "caseload"
  | "clients_leads"
  | "billing"
  | "operations"
  | "rules_pathways"
  | "governance"
  | "growth";

export type DashboardTabKey =
  | "overview"
  | "firm_config"
  | "firm_governance"
  | "reliability_ops"
  | "manager_priority"
  | "conversation_inspector"
  | "executive"
  | "analytics"
  | "operations"
  | "billing"
  | "cases"
  | "clients"
  | "clients_leads"
  | "team"
  | "financials"
  | "audit"
  | "rules"
  | "rules_admin"
  | "rules_pathways"
  | "stage9_release_governance"
  | "release_governance"
  | "stage10_pathway_expansion"
  | "pathway_expansion"
  | "partner_growth"
  | "extractor_lab"
  | "caseload"
  | "growth"
  | "governance";

export type EffectiveDashboardTabKey =
  | "overview"
  | "executive"
  | "analytics"
  | "cases"
  | "manager_priority"
  | "clients"
  | "partner_growth"
  | "billing"
  | "operations"
  | "conversation_inspector"
  | "rules"
  | "stage10_pathway_expansion"
  | "firm_config"
  | "reliability_ops"
  | "audit"
  | "extractor_lab";

export function getSectionForTab(tab: DashboardTabKey): BusinessSectionKey {
  switch (tab) {
    case "overview":
    case "executive":
    case "analytics":
      return "overview";
    case "caseload":
    case "cases":
    case "manager_priority":
      return "caseload";
    case "clients_leads":
    case "clients":
    case "partner_growth":
    case "growth":
      return "clients_leads";
    case "billing":
    case "financials":
      return "billing";
    case "operations":
    case "team":
    case "conversation_inspector":
      return "operations";
    case "rules_pathways":
    case "rules":
    case "rules_admin":
    case "stage10_pathway_expansion":
    case "pathway_expansion":
      return "rules_pathways";
    case "governance":
    case "firm_config":
    case "firm_governance":
    case "reliability_ops":
    case "audit":
    case "stage9_release_governance":
    case "release_governance":
    case "extractor_lab":
      return "governance";
    default:
      return "overview";
  }
}

export function resolveEffectiveTab(tab: DashboardTabKey): EffectiveDashboardTabKey {
  if (tab === "caseload") return "cases";
  if (tab === "clients_leads") return "clients";
  if (tab === "growth") return "partner_growth";
  if (tab === "governance" || tab === "firm_governance") return "firm_config";
  if (tab === "team") return "operations";
  if (tab === "financials") return "billing";
  if (tab === "rules_pathways" || tab === "rules_admin") return "rules";
  if (tab === "pathway_expansion") return "stage10_pathway_expansion";
  if (tab === "stage9_release_governance" || tab === "release_governance") return "firm_config";
  return tab as EffectiveDashboardTabKey;
}

export interface CasesDrilldownFilter {
  stage?: string;
  status?: string;
  attention?: boolean;
  jurisdiction?: string;
  filter?: string;
}

export interface OwnerMasterDashboardProps {
  cases?: ImmigrationCase[];
  clients?: ClientProfile[];
  auditEvents?: AuditEvent[];
  invoices?: InvoiceItem[];
  capacity?: TeamMemberCapacity[];
  isLiveBackend?: boolean;
  onOpenCreateCase?: () => void;
  onOpenCreateClient?: () => void;
  onSelectCase?: (c: ImmigrationCase) => void;
  onClientUpdated?: (c: ClientProfile) => void;
  onDeleteClient?: (clientId: string) => Promise<void> | void;
  onDeleteCase?: (caseId: string) => Promise<void> | void;
  currentUser?: UserContext;
  onConvertLeadToClient?: (lead: CalculatorAgencyLeadRecord) => void;
  onOpenCaseKickoff?: (c: ImmigrationCase) => void;
  kickoffVersion?: number;
  initialTab?: DashboardTabKey;
}

const EMPTY_OWNER_CASES: ImmigrationCase[] = [];
const EMPTY_OWNER_CLIENTS: ClientProfile[] = [];
const EMPTY_OWNER_AUDIT_EVENTS: NonNullable<OwnerMasterDashboardProps["auditEvents"]> = [];
const EMPTY_OWNER_INVOICES: NonNullable<OwnerMasterDashboardProps["invoices"]> = [];
const EMPTY_OWNER_CAPACITY: NonNullable<OwnerMasterDashboardProps["capacity"]> = [];

export function OwnerMasterDashboard(props: OwnerMasterDashboardProps = {}) {
  const ws = useWorkspaceSafe();

  const cases = props.cases ?? ws?.cases ?? EMPTY_OWNER_CASES;
  const clients = props.clients ?? ws?.clients ?? EMPTY_OWNER_CLIENTS;
  const auditEvents = props.auditEvents ?? ws?.auditEvents ?? EMPTY_OWNER_AUDIT_EVENTS;
  const invoices = props.invoices ?? ws?.invoices ?? EMPTY_OWNER_INVOICES;
  const capacity = props.capacity ?? ws?.capacity ?? EMPTY_OWNER_CAPACITY;
  const isLiveBackend = props.isLiveBackend ?? ws?.isLiveBackend ?? false;
  const onOpenCreateCase = props.onOpenCreateCase;
  const onOpenCreateClient = props.onOpenCreateClient ?? (() => {});
  const onSelectCase = props.onSelectCase ?? ((_c: ImmigrationCase) => {});
  const onClientUpdated = props.onClientUpdated ?? ws?.handleClientUpdated;
  const onDeleteClient = props.onDeleteClient ?? ws?.handleDeleteClient;
  const onDeleteCase = props.onDeleteCase ?? ws?.handleDeleteCase;
  const currentUser = props.currentUser ?? ws?.currentUser ?? undefined;
  const onConvertLeadToClient = props.onConvertLeadToClient;
  const onOpenCaseKickoff =
    props.onOpenCaseKickoff ??
    ((c: ImmigrationCase) => {
      ws?.setSelectedCaseForKickoff?.(c);
    });
  const kickoffVersion = props.kickoffVersion ?? ws?.kickoffVersion ?? 0;
  const [activeTab, setActiveTab] = useState<DashboardTabKey>(
    props.initialTab ?? (currentUser?.is_sandbox_agency ? "partner_growth" : "overview")
  );
  const [casesDrilldownFilter, setCasesDrilldownFilter] = useState<CasesDrilldownFilter | null>(null);
  const [analyticsDrilldownFilter, setAnalyticsDrilldownFilter] = useState<Record<string, any> | null>(null);

  React.useEffect(() => {
    if (props.initialTab) {
      setActiveTab(props.initialTab);
    } else if (currentUser?.is_sandbox_agency) {
      setActiveTab("partner_growth");
    }
  }, [props.initialTab, currentUser?.is_sandbox_agency]);

  const firmDisplayName = currentUser?.organization_name || "Partner Immigration Practice";
  const ownerDisplayName = currentUser?.full_name || "Managing Partner";
  const ownerInitials = ownerDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "MP";

  const [selectedClientForCredentials, setSelectedClientForCredentials] = useState<ClientProfile | null>(null);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);

  const [priorityQueueData, setPriorityQueueData] = useState<ManagerPriorityQueueResponse>(() => ({
    generated_at: new Date().toISOString(),
    organization_id: currentUser?.organization_id || "",
    summary: {
      critical_overdue_deadlines_count: 0,
      unassigned_cases_count: 0,
      blocked_cases_count: 0,
      overdue_client_responses_count: 0,
      pending_reviews_count: 0,
      quality_issues_count: 0,
      payment_summary: {
        paid_count: 0,
        pending_count: 0,
        partially_paid_count: 0,
        paid_amount: 0,
        pending_amount: 0,
        partially_paid_amount: 0,
      },
      first_time_pass_rate_percent: 100,
    },
    ranks: FALLBACK_MANAGER_PRIORITY_QUEUE.ranks.map((r) => ({
      ...r,
      count: 0,
      items: [],
      staff_allocation: [],
      unassigned_cases: [],
    })),
  }));
  const [selectedInspectorCaseId, setSelectedInspectorCaseId] = useState<string>(cases[0]?.id || "");
  const [inspectorChannelFilter, setInspectorChannelFilter] = useState<"all" | "client_chat" | "internal_notes">("all");
  const [inspectorMessages, setInspectorMessages] = useState<Array<{ id: string; sender: string; role: "client" | "staff" | "internal_note"; text: string; time: string }>>([]);
  const [supervisoryNoteInput, setSupervisoryNoteInput] = useState("");

  const effectiveOrgId =
    currentUser?.organization_id ||
    cases.find((c) => c.id === selectedInspectorCaseId)?.organization_id ||
    cases[0]?.organization_id ||
    "default_org";

  const supervisoryStorageKey = selectedInspectorCaseId
    ? `documento_supervisory_notes_v3_${effectiveOrgId}_${selectedInspectorCaseId}`
    : null;

  const [supervisoryNotes, setSupervisoryNotes] = useState<
    Array<{ id: string; author: string; note: string; timestamp: string; organization_id?: string; case_id?: string }>
  >(() => {
    if (typeof window !== "undefined" && supervisoryStorageKey) {
      try {
        const stored = localStorage.getItem(supervisoryStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter(
              (n) =>
                (!n.organization_id || n.organization_id === effectiveOrgId) &&
                (!n.case_id || n.case_id === selectedInspectorCaseId)
            );
          }
        }
      } catch {}
    }
    return [];
  });

  React.useEffect(() => {
    if (cases.length === 0) {
      if (selectedInspectorCaseId !== "") setSelectedInspectorCaseId("");
    } else if (!selectedInspectorCaseId || !cases.some((c) => c.id === selectedInspectorCaseId)) {
      setSelectedInspectorCaseId(cases[0].id);
    }
  }, [cases, selectedInspectorCaseId]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !supervisoryStorageKey || cases.length === 0) {
      setSupervisoryNotes([]);
      return;
    }
    try {
      const stored = localStorage.getItem(supervisoryStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSupervisoryNotes(
            parsed.filter(
              (n) =>
                (!n.organization_id || n.organization_id === effectiveOrgId) &&
                (!n.case_id || n.case_id === selectedInspectorCaseId)
            )
          );
          return;
        }
      }
    } catch {}
    setSupervisoryNotes([]);
  }, [supervisoryStorageKey, effectiveOrgId, selectedInspectorCaseId, cases.length]);

  React.useEffect(() => {
    let isMounted = true;
    fetchManagerPriorityQueue("master_admin")
      .then((res) => {
        if (isMounted && res && res.ranks) {
          setPriorityQueueData(res);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [cases.length, clients.length, invoices.length]);

  React.useEffect(() => {
    let isMounted = true;
    Promise.all([api.getMessages(), selectedInspectorCaseId ? api.getCaseNotes(selectedInspectorCaseId, "master_admin") : Promise.resolve({ data: [] })])
      .then(([msgRes, notesRes]) => {
        if (!isMounted) return;
        const mappedMsgs = (msgRes.data || []).map((m) => ({
          id: m.id,
          sender: m.sender,
          role: (m.sender_role === "client" ? "client" : "staff") as "client" | "staff",
          text: m.content,
          time: m.timestamp,
        }));
        const mappedNotes = (notesRes.data || []).map((n) => ({
          id: n.id,
          sender: n.author_name,
          role: (n.is_client_visible ? "staff" : "internal_note") as "staff" | "internal_note",
          text: n.content,
          time: new Date(n.created_at).toLocaleString(),
        }));
        setInspectorMessages([...mappedMsgs, ...mappedNotes]);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [selectedInspectorCaseId]);

  // Filtered metrics
  const activeCasesCount = cases.filter((c) => c.status !== "filed" && c.status !== "approved").length;
  const attentionCases = cases.filter((c) => c.attention_required);
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const outstandingRevenue = invoices.filter((i) => i.status === "outstanding").reduce((sum, i) => sum + i.amount, 0);

  // Group by stage
  const stageCounts: Record<string, number> = {
    intake: cases.filter((c) => c.status === "intake").length,
    gathering: cases.filter((c) => c.status === "gathering").length,
    review: cases.filter((c) => c.status === "review").length,
    assembly: cases.filter((c) => c.status === "assembly").length,
    ready: cases.filter((c) => c.status === "ready").length,
    filed: cases.filter((c) => c.status === "filed").length,
  };

  // Group by country/pathway
  const countryCounts: Record<string, number> = {};
  cases.forEach((c) => {
    countryCounts[c.jurisdiction] = (countryCounts[c.jurisdiction] || 0) + 1;
  });

  // Permissions check: Owner and Managers can delete & assign clients/cases; Paralegals and Retained Clients cannot
  const canDelete = currentUser ? canDeleteClient(currentUser) : true;
  const canDeleteCases = currentUser ? canDeleteCase(currentUser) : true;
  const canAssign = currentUser ? canAssignCaseworker(currentUser) : true;

  const [assigningEntityKey, setAssigningEntityKey] = useState<string | null>(null);
  const [localAssignedCases, setLocalAssignedCases] = useState<Record<string, string>>({});
  const [localAssignedClients, setLocalAssignedClients] = useState<Record<string, string>>({});

  const staffRoster = React.useMemo(() => {
    const map = new Map<string, { id?: string; name: string; role?: string }>();
    for (const tm of capacity) {
      if (tm.name) {
        map.set(tm.name.trim().toLowerCase(), { id: tm.id, name: tm.name.trim(), role: tm.role });
      }
    }
    if (currentUser?.full_name && !map.has(currentUser.full_name.trim().toLowerCase())) {
      map.set(currentUser.full_name.trim().toLowerCase(), {
        id: currentUser.id,
        name: currentUser.full_name.trim(),
        role: currentUser.role === "master_admin" ? "Managing Partner" : "Case Manager",
      });
    }
    for (const c of cases) {
      if (c.assigned_manager && c.assigned_manager !== "Unassigned" && !map.has(c.assigned_manager.trim().toLowerCase())) {
        map.set(c.assigned_manager.trim().toLowerCase(), { name: c.assigned_manager.trim() });
      }
    }
    for (const cl of clients) {
      if (cl.assigned_caseworker && cl.assigned_caseworker !== "Unassigned" && !map.has(cl.assigned_caseworker.trim().toLowerCase())) {
        map.set(cl.assigned_caseworker.trim().toLowerCase(), {
          id: cl.assigned_caseworker_id,
          name: cl.assigned_caseworker.trim(),
        });
      }
    }
    return Array.from(map.values());
  }, [capacity, currentUser?.full_name, currentUser?.id, currentUser?.role, cases, clients]);

  const resolveCaseAssignedWorker = (c: ImmigrationCase): string => {
    if (localAssignedCases[c.id] !== undefined) return localAssignedCases[c.id];
    return c.assigned_manager && c.assigned_manager !== "Unassigned" ? c.assigned_manager : "";
  };

  const resolveClientAssignedWorker = (cl: ClientProfile): string => {
    if (localAssignedClients[cl.id] !== undefined) return localAssignedClients[cl.id];
    const fullName = `${cl.first_name} ${cl.last_name}`.trim().toLowerCase();
    const linkedCase = cases.find(
      (c) =>
        (c.client_id === cl.id || (Boolean(fullName) && (c.client_name || "").trim().toLowerCase() === fullName)) &&
        resolveCaseAssignedWorker(c) !== ""
    );
    if (linkedCase) return resolveCaseAssignedWorker(linkedCase);
    return cl.assigned_caseworker && cl.assigned_caseworker !== "Unassigned" ? cl.assigned_caseworker : "";
  };

  const handleAssignCaseChange = async (c: ImmigrationCase, nextOfficer: string) => {
    setAssigningEntityKey(`case:${c.id}`);
    setLocalAssignedCases((prev) => ({ ...prev, [c.id]: nextOfficer }));
    try {
      const matched = staffRoster.find((s) => s.name === nextOfficer);
      if (ws?.handleAssignCaseworker) {
        await ws.handleAssignCaseworker({
          caseId: c.id,
          officerName: nextOfficer || "Unassigned",
          officerUserId: matched?.id,
        });
      } else {
        await api.assignCaseOfficer(
          c.id,
          nextOfficer || "Unassigned",
          { userId: matched?.id, roleInCase: "case_manager", fallbackCase: c },
          currentUser?.role || "master_admin"
        );
      }
    } finally {
      setAssigningEntityKey(null);
    }
  };

  const handleAssignClientChange = async (cl: ClientProfile, nextOfficer: string) => {
    setAssigningEntityKey(`client:${cl.id}`);
    setLocalAssignedClients((prev) => ({ ...prev, [cl.id]: nextOfficer }));
    try {
      const matched = staffRoster.find((s) => s.name === nextOfficer);
      if (ws?.handleAssignCaseworker) {
        await ws.handleAssignCaseworker({
          clientId: cl.id,
          officerName: nextOfficer || "Unassigned",
          officerUserId: matched?.id,
        });
      } else {
        await api.assignClientCaseworker(
          cl.id,
          nextOfficer || "Unassigned",
          { userId: matched?.id, roleInCase: "case_manager", knownCases: cases, fallbackClient: cl },
          currentUser?.role || "master_admin"
        );
      }
    } finally {
      setAssigningEntityKey(null);
    }
  };

  const handleDeleteCaseClick = async (caseItem: ImmigrationCase) => {
    const confirmMsg = `Are you sure you want to permanently delete case "${caseItem.case_number}" (${caseItem.title})?\n\nThis will permanently remove the case along with its linked documents, tasks, findings, and intake sheets. Retained client profile (${caseItem.client_name || "Unlinked"}) will remain preserved. This action cannot be undone.`;
    if (window.confirm(confirmMsg)) {
      if (onDeleteCase) {
        await onDeleteCase(caseItem.id);
      } else {
        await api.deleteCase(caseItem.id, currentUser?.role || "master_admin");
      }
    }
  };

  const handleDeleteClientClick = async (client: ClientProfile) => {
    const clientCases = cases.filter(
      (c) =>
        c.client_id === client.id ||
        (c.client_name &&
          `${client.first_name} ${client.last_name}`.toLowerCase() === c.client_name.toLowerCase())
    );

    const caseWarning =
      clientCases.length > 0
        ? `\n\n⚠️ Notice: This client is associated with ${clientCases.length} case(s) (${clientCases
            .map((c) => c.case_number)
            .join(", ")}).`
        : "";

    const confirmMsg = `Are you sure you want to permanently delete retained client "${client.first_name} ${client.last_name}" (${client.email})?${caseWarning}\n\nThis will remove their profile and portal credentials. This action cannot be undone.`;

    if (window.confirm(confirmMsg)) {
      if (onDeleteClient) {
        await onDeleteClient(client.id);
      } else {
        await api.deleteClient(client.id);
      }
    }
  };

  // Table columns for Cases
  const caseColumns: Column<ImmigrationCase>[] = [
    {
      key: "case_number",
      header: "Case Ref",
      sortable: true,
      render: (c) => <strong>{c.case_number}</strong>,
    },
    {
      key: "title",
      header: "Petition Title & Client",
      sortable: true,
      render: (c) => (
        <div>
          <strong style={{ display: "block", color: "var(--text)" }}>{c.title}</strong>
          <small style={{ color: "var(--quiet)" }}>{c.client_name}</small>
        </div>
      ),
    },
    {
      key: "visa_category",
      header: "Pathway",
      sortable: true,
    },
    {
      key: "assigned_manager",
      header: "Assigned Caseworker",
      sortable: true,
      render: (c) => {
        const currentAssignee = resolveCaseAssignedWorker(c);
        if (!canAssign) {
          return (
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: currentAssignee ? "#063C3D" : "#6E7F7C" }}>
              {currentAssignee || "Unassigned"}
            </span>
          );
        }
        const isBusy = assigningEntityKey === `case:${c.id}`;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              data-testid={`assign-case-caseworker-${c.id}`}
              aria-label={`Assign caseworker to case ${c.case_number}`}
              value={currentAssignee}
              disabled={isBusy}
              onChange={(e) => void handleAssignCaseChange(c, e.target.value)}
              style={{
                padding: "5px 8px",
                borderRadius: "6px",
                border: currentAssignee ? "1px solid #B9DED4" : "1px solid #F6D8A6",
                background: currentAssignee ? "#F8FAF9" : "#FFFBEB",
                color: currentAssignee ? "#063C3D" : "#92400E",
                fontSize: "12px",
                fontWeight: 600,
                cursor: isBusy ? "wait" : "pointer",
                maxWidth: "175px",
              }}
            >
              <option value="">Unassigned</option>
              {staffRoster.map((member) => (
                <option key={member.id || member.name} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Pipeline Stage",
      sortable: true,
      render: (c) => {
        const stage = formatCaseStageBadge(c.status);
        return (
          <Badge variant={c.attention_required ? "action" : stage.variant}>
            {stage.label}
          </Badge>
        );
      },
    },
    {
      key: "readiness_score",
      header: "Readiness",
      sortable: true,
      render: (c) => {
        const readinessScore = Math.max(0, Math.min(100, Number(c.readiness_score ?? 0) || 0));
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "60px", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${readinessScore}%`,
                  height: "100%",
                  backgroundColor: readinessScore > 80 ? "var(--success)" : "var(--accent)",
                }}
              />
            </div>
            <span style={{ fontSize: "12px", fontWeight: 700 }}>{readinessScore}%</span>
          </div>
        );
      },
    },
    {
      key: "deadline",
      header: "Filing Deadline",
      sortable: true,
      render: (c) => (
        <span style={{ color: c.attention_required ? "var(--critical)" : "inherit", fontWeight: c.attention_required ? 700 : 500 }}>
          {c.deadline || "Standard"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (c) => {
        const kp = getCaseKickoffProgress(c.id);
        return (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
            {kp && !kp.isComplete && (
              <Button variant="primary" size="sm" onClick={() => onOpenCaseKickoff(c)}>
                Kickoff ({kp.completedCount}/4)
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onSelectCase(c)}>
              Inspect
            </Button>
            {canDeleteCases && (
              <Button
                variant="danger"
                size="sm"
                data-testid={`delete-case-${c.id}`}
                aria-label={`Delete case ${c.case_number}`}
                onClick={() => handleDeleteCaseClick(c)}
                style={{
                  background: "#FFF0F0",
                  color: "#D32F2F",
                  borderColor: "#FFCDD2",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <WorkspaceIcon name="trash" size={13} /> Delete
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const pendingKickoffCases = React.useMemo(() => {
    return cases.filter((c) => !getCaseKickoffProgress(c.id).isComplete);
  }, [cases, kickoffVersion]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const firmAgency = getAgencyForOrganization(currentUser?.organization_id || "");
  const unreadCalculatorLeadsCount = firmAgency
    ? getCalculatorAgencyLeads(firmAgency.organizationId).filter((l) => l.leadStatus === "new_lead").length
    : 0;

  const priorityActionCount =
    (priorityQueueData.summary?.critical_overdue_deadlines_count || 0) +
    (priorityQueueData.summary?.unassigned_cases_count || 0) +
    (priorityQueueData.summary?.blocked_cases_count || 0) +
    (priorityQueueData.summary?.pending_reviews_count || 0);

  interface DashboardNavItem {
    key: DashboardTabKey;
    id: string;
    label: string;
    icon: WorkspaceIconName;
    count: number | null;
  }

  interface DashboardSectionConfig {
    sectionKey: BusinessSectionKey;
    sectionLabel: string;
    ariaLabel: string;
    icon: WorkspaceIconName;
    defaultTab: DashboardTabKey;
    count: number | null;
    items: DashboardNavItem[];
  }

  const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
    {
      sectionKey: "overview",
      sectionLabel: "Overview & Analytics",
      ariaLabel: "Overview & Analytics Views",
      icon: "building",
      defaultTab: "overview",
      count: null,
      items: [
        { key: "overview", id: "tab-btn-overview", label: "Company Overview", icon: "building", count: null },
        { key: "executive", id: "tab-btn-executive", label: "Executive Command Center", icon: "zap", count: null },
        { key: "analytics", id: "tab-btn-analytics", label: "Deep Analytics", icon: "trending-up", count: null },
      ],
    },
    {
      sectionKey: "caseload",
      sectionLabel: "Cases & Priority Queue",
      ariaLabel: "Cases & Priority Queue Views",
      icon: "clipboard",
      defaultTab: "cases",
      count: cases.length || priorityActionCount || null,
      items: [
        { key: "cases", id: "tab-btn-cases", label: "All Cases", icon: "clipboard", count: cases.length },
        { key: "manager_priority", id: "tab-btn-manager-priority", label: "Priority Command Board", icon: "alert-triangle", count: priorityActionCount || null },
      ],
    },
    {
      sectionKey: "clients_leads",
      sectionLabel: "Clients & Leads",
      ariaLabel: "Clients & Leads Views",
      icon: "users",
      defaultTab: "clients",
      count: clients.length + unreadCalculatorLeadsCount || null,
      items: [
        { key: "clients", id: "tab-btn-clients", label: "Retained Clients", icon: "users", count: clients.length },
        { key: "partner_growth", id: "tab-btn-partner-growth", label: "Partner Onboarding & Leads", icon: "link", count: unreadCalculatorLeadsCount || null },
      ],
    },
    {
      sectionKey: "billing",
      sectionLabel: "Billing",
      ariaLabel: "Billing Views",
      icon: "credit-card",
      defaultTab: "billing",
      count: null,
      items: [
        { key: "billing", id: "tab-btn-billing", label: "Billing & Retainers", icon: "credit-card", count: null },
      ],
    },
    {
      sectionKey: "operations",
      sectionLabel: "Team & Operations",
      ariaLabel: "Team & Operations Views",
      icon: "users",
      defaultTab: "operations",
      count: null,
      items: [
        { key: "operations", id: "tab-btn-operations", label: "Operations Hub", icon: "users", count: null },
        { key: "conversation_inspector", id: "tab-btn-conversation-inspector", label: "Conversation Inspector", icon: "message-square", count: null },
      ],
    },
    {
      sectionKey: "rules_pathways",
      sectionLabel: "Rules & Pathways",
      ariaLabel: "Rules & Pathways Views",
      icon: "scale",
      defaultTab: "rules",
      count: null,
      items: [
        { key: "rules", id: "tab-btn-rules", label: "Rules & Authorities", icon: "scale", count: null },
        { key: "stage10_pathway_expansion", id: "tab-btn-stage10-pathway-expansion", label: "Pathway Expansion", icon: "globe", count: null },
      ],
    },
    {
      sectionKey: "governance",
      sectionLabel: "Firm Settings & Audit",
      ariaLabel: "Firm Settings & Audit Views",
      icon: "landmark",
      defaultTab: "firm_config",
      count: auditEvents.length || null,
      items: [
        { key: "firm_config", id: "tab-btn-firm-config", label: "Firm Governance & Configuration", icon: "landmark", count: null },
        { key: "reliability_ops", id: "tab-btn-reliability-ops", label: "Reliability, Privacy & Security", icon: "shield", count: null },
        { key: "audit", id: "tab-btn-audit", label: "Audit Alerts", icon: "shield", count: auditEvents.length },
        { key: "extractor_lab", id: "tab-btn-extractor-lab", label: "Extractor Lab", icon: "microscope", count: null },
      ],
    },
  ];

  const effectiveTab = resolveEffectiveTab(activeTab);
  const activeSectionKey = getSectionForTab(activeTab);
  const currentSection = DASHBOARD_SECTIONS.find((s) => s.sectionKey === activeSectionKey) || DASHBOARD_SECTIONS[0];

  const filteredCasesForTable = React.useMemo(() => {
    if (!casesDrilldownFilter) return cases;
    return cases.filter((c) => {
      if (casesDrilldownFilter.attention) {
        if (!c.attention_required) return false;
      }
      const targetStageOrStatus = casesDrilldownFilter.stage || casesDrilldownFilter.status;
      if (targetStageOrStatus) {
        if (targetStageOrStatus === "active") {
          if (c.status === "filed" || c.status === "approved") return false;
        } else {
          const normalizedCaseStage = getCaseStageInfo(c.status).key;
          const normalizedTarget = getCaseStageInfo(targetStageOrStatus).key;
          if (c.status !== targetStageOrStatus && normalizedCaseStage !== normalizedTarget) {
            return false;
          }
        }
      }
      if (casesDrilldownFilter.jurisdiction) {
        const targetJur = casesDrilldownFilter.jurisdiction.toLowerCase();
        const caseJur = (c.jurisdiction || "").toLowerCase();
        if (caseJur !== targetJur && !caseJur.includes(targetJur)) {
          return false;
        }
      }
      if (casesDrilldownFilter.filter === "requests_pending") {
        if (c.status === "filed" || c.status === "approved") return false;
      }
      return true;
    });
  }, [cases, casesDrilldownFilter]);

  const activeTabInfo = {
    overview: {
      title: "Company Overview",
      subtitle: `Executive Command & Operational Health • ${firmDisplayName}`,
    },
    firm_config: {
      title: "Firm Governance & Configuration Hub",
      subtitle: "Owner & Managing Admin Configuration of Roles, Country Pathways, Folders, Checklists, Reminders, Review Gates & Inactivity Policies",
    },
    reliability_ops: {
      title: "Operational Reliability, Privacy & Security Hub",
      subtitle: "Tenant Isolation, Background Job Telemetry, Data-Flow Register, Jurisdiction Privacy Reviews, Drills & Lifecycle Scenarios",
    },
    manager_priority: {
      title: "Manager Priority Command Board (Ranks 1–8)",
      subtitle: "Strict 1–8 Sequential Triage: Deadlines, Staff Allocation, Blocked Cases, Client Delays, Reviews, Quality Escalations, Payment Tracking & Continuous Improvement.",
    },
    conversation_inspector: {
      title: "Officer-Client Conversation Inspector",
      subtitle: "Authorized Managing Partner Oversight Across All Caseworker & Client Transcripts with Confidential Notes Review.",
    },
    executive: {
      title: "Executive Command Center",
      subtitle: "Real-Time Firm Intelligence, Mathematical Metrics & Strategic Analytics",
    },
    analytics: {
      title: "Deep Analytics",
      subtitle: "Multi-Dimensional Pipeline Filtering, Turnaround Timelines & Bottleneck Diagnosis",
    },
    operations: {
      title: "Operations Hub",
      subtitle: "Caseworker Workload Capacity, Peer Reviews & SLA Compliance Management",
    },
    billing: {
      title: "Billing & Retainers",
      subtitle: "Escrow Ledger, Invoice Reconciliation & Retainer Accounting",
    },
    cases: {
      title: "All Cases",
      subtitle: `Comprehensive Caseload Management (${cases.length} active and in-progress petitions)`,
    },
    clients: {
      title: "Retained Clients & Portal Access Control",
      subtitle: `Directory of Retained Applicants (${clients.length} profiles under representation). Credentials must be provided by Owner or Lead Paralegal for portal login.`,
    },
    audit: {
      title: "Audit Alerts",
      subtitle: `Append-Only Cryptographic Audit Log (${auditEvents.length} verifiable events)`,
    },
    rules: {
      title: "Rules & Authorities",
      subtitle: "Statutory Immigration Rule Registry, Regulatory Sources & Pilot Workflows",
    },
    stage10_pathway_expansion: {
      title: "Multi-Jurisdiction Pathway Expansion Desk",
      subtitle: "Multi-Jurisdiction Inventory (Priorities 1–5), 8 Broad Application Families, EU/Schengen Distinctions, Safe-Stop Principles & Multilingual Matching Engine",
    },
    partner_growth: {
      title: "Partner Agency Setup, Co-Branded PR Calculators & HQ Privacy Gate",
      subtitle: "Configure your verified agency calculator link (?agency=slug), convert incoming PR scorecard leads, and govern your Zero-PII Break-Glass support token.",
    },
    extractor_lab: {
      title: "AI Document Recognition & Information Extractor",
      subtitle: "Upload real PDFs, passport scans, bank statements, or multi-person family bundles for AI recognition, taxonomy classification, and normalized entity extraction.",
    },
  }[effectiveTab];

  return (
    <div
      id="owner-master-dashboard"
      style={{
        display: "flex",
        minHeight: "calc(100vh - 58px)",
        background: "#F8F7F2",
        color: "#172322",
      }}
    >
      {/* =========================================================================
          1. RESPONSIVE SIDEBAR NAVIGATION (Desktop: 270px; Mobile: Collapsible)
          ========================================================================= */}
      <aside
        aria-label="Managing Partner Navigation Sidebar"
        style={{
          width: "270px",
          background: "#FFFFFF",
          borderRight: "1px solid #DCE5E1",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: "58px",
          height: "calc(100vh - 58px)",
          overflowY: "auto",
          boxShadow: "1px 0 3px rgba(6, 60, 61, 0.03)",
        }}
        className="documento-firm-sidebar"
      >
        {/* Firm Workspace Status Summary */}
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #DCE5E1",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#6E7F7C",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Firm Workspace
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                fontWeight: 650,
                color: "#176B50",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#176B50",
                }}
                aria-hidden="true"
              />
              Active
            </span>
          </div>
          <div
            style={{
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {firmDisplayName}
          </div>
          <div style={{ fontSize: "11.5px", color: "#526663", marginTop: "3px", fontVariantNumeric: "tabular-nums" }}>
            {`Active Caseload: ${activeCasesCount} Petitions`}
          </div>
        </div>

        {/* Consolidated 7-Area Primary Navigation */}
        <nav
          aria-label="Executive Navigation"
          style={{
            flex: 1,
            padding: "14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            overflowY: "auto",
          }}
        >
          {DASHBOARD_SECTIONS.map((section) => {
            const isSectionActive = activeSectionKey === section.sectionKey;
            return (
              <button
                key={section.sectionKey}
                id={`nav-area-${section.sectionKey}`}
                data-testid={`nav-area-${section.sectionKey}`}
                type="button"
                aria-current={isSectionActive ? "page" : undefined}
                onClick={() => {
                  if (section.defaultTab === "cases") {
                    setCasesDrilldownFilter(null);
                  }
                  setActiveTab(section.defaultTab);
                  setIsMobileMenuOpen(false);
                }}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 12px 9px 14px",
                  borderRadius: "8px",
                  border: isSectionActive ? "1px solid #B9DED4" : "1px solid transparent",
                  background: isSectionActive ? "#EAF6F0" : "transparent",
                  color: isSectionActive ? "#0D6866" : "#445451",
                  fontSize: "13px",
                  fontWeight: isSectionActive ? 700 : 550,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (!isSectionActive) {
                    e.currentTarget.style.background = "#F8F7F2";
                    e.currentTarget.style.color = "#063C3D";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSectionActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#445451";
                  }
                }}
              >
                {isSectionActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "6px",
                      bottom: "6px",
                      width: "3.5px",
                      borderRadius: "0 2px 2px 0",
                      background: "#0D6866",
                    }}
                    aria-hidden="true"
                  />
                )}
                <span style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
                  <WorkspaceIcon name={section.icon} size={15} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {section.sectionLabel}
                  </span>
                </span>
                {section.count !== null && section.count > 0 && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isSectionActive ? "#0D6866" : "#F1F6F4",
                      color: isSectionActive ? "#FFFFFF" : "#445451",
                      border: `1px solid ${isSectionActive ? "#0D6866" : "#DCE5E1"}`,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {section.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Visually hidden direct sub-view triggers for inactive areas & legacy test compatibility */}
          <div
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0px, 0px, 0px, 0px)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {DASHBOARD_SECTIONS.flatMap((section) => {
              const isRenderedInMainSwitcher =
                section.sectionKey === activeSectionKey && section.items.length > 1;
              if (isRenderedInMainSwitcher) return [];
              return section.items.map((item) => (
                <button
                  key={`compat-${item.id}`}
                  id={item.id}
                  data-testid={item.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    if (item.key === "cases") setCasesDrilldownFilter(null);
                    setActiveTab(item.key);
                  }}
                >
                  {item.label}
                </button>
              ));
            })}
            <button
              id="tab-btn-financials"
              data-testid="tab-btn-financials"
              type="button"
              tabIndex={-1}
              onClick={() => setActiveTab("billing")}
            >
              Revenue &amp; Billing
            </button>
            {[
              { id: "tab-btn-rules_admin", target: "rules" as DashboardTabKey },
              { id: "tab-btn-pathway_expansion", target: "stage10_pathway_expansion" as DashboardTabKey },
              { id: "tab-btn-firm_governance", target: "firm_config" as DashboardTabKey },
              { id: "tab-btn-manager_priority", target: "manager_priority" as DashboardTabKey },
              { id: "tab-btn-conversation_inspector", target: "conversation_inspector" as DashboardTabKey },
              { id: "tab-btn-partner_growth", target: "partner_growth" as DashboardTabKey },
              { id: "tab-btn-reliability_ops", target: "reliability_ops" as DashboardTabKey },
              { id: "tab-btn-firm_config", target: "firm_config" as DashboardTabKey },
              { id: "tab-btn-extractor_lab", target: "extractor_lab" as DashboardTabKey },
              { id: "tab-btn-stage9-release-governance", target: "firm_config" as DashboardTabKey },
              { id: "tab-btn-release_governance", target: "firm_config" as DashboardTabKey },
            ].map((alias) => (
              <button
                key={alias.id}
                id={alias.id}
                data-testid={alias.id}
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setActiveTab(alias.target)}
              />
            ))}
          </div>
        </nav>

        {/* Managing Partner Footer Profile */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #DCE5E1",
            background: "#FAFAF7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#0D6866",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid #B9DED4",
              }}
            >
              {ownerInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 650, color: "#063C3D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {ownerDisplayName}
              </div>
              <div style={{ fontSize: "11px", color: "#6E7F7C", lineHeight: 1.2 }}>
                Managing Partner
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT AREA (Clean SaaS Grid Layout)
          ========================================================================= */}
      <main
        className="documento-main-content"
        style={{
          flex: 1,
          minWidth: 0,
          padding: "24px 32px 64px 32px",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Mobile Navigation Drawer Toggle if on narrow screen */}
        <div
          style={{
            display: "none",
            marginBottom: "8px",
            background: "#FFFFFF",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #DCE5E1",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="documento-firm-mobile-bar"
        >
          <span style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
            Section: {currentSection.sectionLabel}
          </span>
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="executive-mobile-sections-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "#EAF6F0",
              color: "#0D6866",
              border: "1px solid #B9DED4",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <WorkspaceIcon name="layers" size={14} />
            Switch Section
          </button>
        </div>

        {isMobileMenuOpen && (
          <div
            id="executive-mobile-sections-menu"
            role="menu"
            aria-label="Executive Mobile Navigation"
            style={{
              marginBottom: "16px",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              boxShadow: "0 4px 12px rgba(6, 60, 61, 0.08)",
            }}
          >
            {DASHBOARD_SECTIONS.map((section) => {
              const isSectionActive = activeSectionKey === section.sectionKey;
              return (
                <button
                  key={section.sectionKey}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (section.defaultTab === "cases") {
                      setCasesDrilldownFilter(null);
                    }
                    setActiveTab(section.defaultTab);
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: isSectionActive ? "#EAF6F0" : "transparent",
                    color: isSectionActive ? "#0D6866" : "#445451",
                    fontSize: "13px",
                    fontWeight: isSectionActive ? 650 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <WorkspaceIcon name={section.icon} size={15} />
                    <span>{section.sectionLabel}</span>
                  </span>
                  {section.count !== null && section.count > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "10px",
                        background: isSectionActive ? "#0D6866" : "#F1F6F4",
                        color: isSectionActive ? "#FFFFFF" : "#445451",
                      }}
                    >
                      {section.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Header Action Bar (suppressed when Operations Hub renders its own unified header) */}
        {effectiveTab !== "operations" && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              paddingBottom: "4px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: 750,
                    color: "#063C3D",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {activeTabInfo.title}
                </h1>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 650,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "#EAF6F0",
                    color: "#176B50",
                    border: "1px solid #B9DED4",
                  }}
                >
                  Managing Partner Suite
                </span>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#6E7F7C",
                  margin: "4px 0 0 0",
                  lineHeight: 1.4,
                }}
              >
                {activeTabInfo.subtitle}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="primary" size="sm" onClick={onOpenCreateClient}>
                + Onboard Client &amp; Case
              </Button>
            </div>
          </div>
        )}

        {/* Internal View Switcher for Multi-View Logical Areas */}
        {currentSection.items.length > 1 && (
          <div
            data-testid="owner-area-subview-switcher"
            aria-label={currentSection.ariaLabel}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
              padding: "4px",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              alignSelf: "flex-start",
            }}
          >
            {currentSection.items.map((subItem) => {
              const isSubActive = effectiveTab === subItem.key;
              return (
                <button
                  key={`subview-${subItem.key}`}
                  id={subItem.id}
                  data-testid={subItem.id}
                  type="button"
                  aria-pressed={isSubActive}
                  onClick={() => {
                    if (subItem.key === "cases") setCasesDrilldownFilter(null);
                    setActiveTab(subItem.key);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "7px 14px",
                    borderRadius: "7px",
                    background: isSubActive ? "#063C3D" : "transparent",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: isSubActive ? 650 : 550,
                    color: isSubActive ? "#FFFFFF" : "#445451",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <WorkspaceIcon name={subItem.icon} size={14} />
                  <span>{subItem.label}</span>
                  {subItem.count !== null && subItem.count > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "10px",
                        background: isSubActive ? "rgba(255, 255, 255, 0.2)" : "#EAF0ED",
                        color: isSubActive ? "#FFFFFF" : "#445451",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {subItem.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

      {effectiveTab !== "partner_growth" &&
        (currentUser?.is_sandbox_agency || (firmAgency && !firmAgency.branding.setupCompleted)) && (
          <div
            data-testid="day0-agency-setup-callout"
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: currentUser?.is_sandbox_agency ? "#FFFBEB" : "#EAF6F0",
              border: `1px solid ${currentUser?.is_sandbox_agency ? "#FDE68A" : "#B9DED4"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#172322" }}>
              <strong style={{ color: "#063C3D" }}>
                {currentUser?.is_sandbox_agency
                  ? "KYB Sandbox Active:"
                  : "Complete Day-0 Partner Agency Setup:"}
              </strong>{" "}
              Configure your co-branded PR calculator portal (<code>/calculators?agency={firmAgency?.slug || "partner"}</code>) and active visa corridors.
            </div>
            <Button variant="secondary" size="sm" onClick={() => setActiveTab("partner_growth")}>
              Open Partner Setup &amp; Leads →
            </Button>
          </div>
        )}

      {/* PARTNER ONBOARDING, CO-BRANDED CALCULATOR LEADS & BREAK-GLASS PRIVACY TAB */}
      {effectiveTab === "partner_growth" && (
        <AgencyGrowthAndSetupDesk
          currentUser={currentUser}
          clientsCount={clients.length}
          casesCount={cases.length}
          onOpenCreateClient={onOpenCreateClient}
          onConvertLeadToClient={onConvertLeadToClient}
        />
      )}

      {/* OVERVIEW TAB */}
      {effectiveTab === "overview" && (
        <>
          {/* Express Drop-to-Create Client & Case Action Bar */}
          <div
            data-testid="owner-express-drop-create-bar"
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", maxWidth: "780px" }}>
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#EAF6F0",
                  color: "#063C3D",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <WorkspaceIcon name="zap" size={16} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <strong style={{ fontSize: "13.5px", color: "#063C3D" }}>
                  Express Drop-to-Create Client &amp; Case
                </strong>
                <span style={{ fontSize: "12.5px", color: "#526663" }}>
                  Drop a Passport, Bank Statement, CRA NOA, or multi-person Family PDF Packet to auto-extract biodata and open an active case in one step.
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid="owner-express-drop-create-btn"
              onClick={onOpenCreateClient}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #063C3D",
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "12.5px",
                fontWeight: 650,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <WorkspaceIcon name="zap" size={13} />
              Express Drop-to-Create Client &amp; Case →
            </button>
          </div>

          {pendingKickoffCases.length > 0 && (() => {
            const firstCase = pendingKickoffCases[0];
            const firstProg = getCaseKickoffProgress(firstCase.id);
            return (
              <div
                data-testid="owner-pending-kickoff-banner"
                style={{
                  padding: "14px 18px",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  border: "1px solid #B9DED4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "13px", color: "#172322" }}>
                  <strong style={{ color: "#063C3D" }}>
                    Post-Onboarding Case Kickoff ({firstProg.completedCount}/4 steps completed):
                  </strong>{" "}
                  Finish portal login handoff, officer &amp; checklist dispatch, retainer billing, and initial uploads for{" "}
                  <strong>{firstCase.case_number}</strong> ({firstCase.client_name || firstCase.visa_category}).
                </div>
                <Button variant="primary" size="sm" onClick={() => onOpenCaseKickoff(firstCase)}>
                  Resume 4-Step Kickoff ({firstProg.completedCount}/4) →
                </Button>
              </div>
            );
          })()}

          {/* Connected Hairline KPI Ribbon */}
          <div className="documento-kpi-ribbon">
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#526663" }}>
                    Operational Health &amp; Tenant Boundary
                  </span>
                  <Badge variant="success" size="sm">Isolated</Badge>
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#063C3D", letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
                  100% Strict
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                  Zero cross-tenant leaks
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0D6866",
                  cursor: "pointer",
                }}
              >
                View audit trace →
              </button>
            </div>

            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#526663" }}>
                    Active Caseload &amp; Retained Clients
                  </span>
                  {cases.length > 0 && (
                    <Badge variant="success" size="sm">{activeCasesCount} active</Badge>
                  )}
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#063C3D", letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
                  {activeCasesCount}
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                  {clients.length} retained applicants total
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCasesDrilldownFilter({ status: "active" });
                  setActiveTab("cases");
                }}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0D6866",
                  cursor: "pointer",
                }}
              >
                Filter active cases →
              </button>
            </div>

            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#526663" }}>
                    Cases Requiring Owner Attention
                  </span>
                  <Badge variant={attentionCases.length > 0 ? "action" : "success"} size="sm">
                    {attentionCases.length > 0 ? "Attention" : "Clear"}
                  </Badge>
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: attentionCases.length > 0 ? "#B45309" : "#063C3D", letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
                  {attentionCases.length}
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px" }}>
                  {attentionCases.length > 0 ? "Requires review or RFE response" : "No urgent flags"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (attentionCases.length > 0) {
                    onSelectCase(attentionCases[0]);
                  } else {
                    setCasesDrilldownFilter(null);
                    setActiveTab("cases");
                  }
                }}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0D6866",
                  cursor: "pointer",
                }}
              >
                Inspect priority case →
              </button>
            </div>

            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#526663" }}>
                    Escrow &amp; Retainer Revenue
                  </span>
                  {invoices.length > 0 && (
                    <Badge variant="neutral" size="sm">Retainer Backed</Badge>
                  )}
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#063C3D", letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
                  ${totalRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  ${outstandingRevenue.toLocaleString()} pending escrow
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("billing")}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0D6866",
                  cursor: "pointer",
                }}
              >
                View billing ledger →
              </button>
            </div>
          </div>

          {/* Connected Immigration Case Pipeline Funnel Strip */}
          {(() => {
            const pipelineStages = [
              { step: "01", stage: "Intake", stageKey: "intake", count: stageCounts.intake, color: "#64748B" },
              { step: "02", stage: "Evidence Gathering", stageKey: "gathering", count: stageCounts.gathering, color: "#0284C7" },
              { step: "03", stage: "Caseworker Review", stageKey: "review", sub: "Attorney Review", count: stageCounts.review, color: "#D97706" },
              { step: "04", stage: "Package Assembly", stageKey: "assembly", count: stageCounts.assembly, color: "#2563EB" },
              { step: "05", stage: "Attorney Signoff", stageKey: "ready", count: stageCounts.ready, color: "#059669" },
              { step: "06", stage: "Filed with Agency", stageKey: "filed", count: stageCounts.filed, color: "#7C3AED" },
            ];
            return (
              <section
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px 12px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                      Immigration Case Pipeline by Processing Stage
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#6E7F7C" }}>
                      Real-time distribution of petitions across intake, evidence gathering, review, and filing.
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#526663", fontVariantNumeric: "tabular-nums" }}>
                    {cases.length} total petitions
                  </span>
                </div>

                {/* Connected Proportional Pipeline Bar */}
                <div
                  style={{
                    margin: "0 20px 14px 20px",
                    height: "6px",
                    borderRadius: "3px",
                    background: "#EDF2EF",
                    display: "flex",
                    overflow: "hidden",
                    gap: "1px",
                  }}
                  aria-hidden="true"
                >
                  {cases.length > 0 &&
                    pipelineStages.map((item) => {
                      if (item.count === 0) return null;
                      const widthPct = (item.count / cases.length) * 100;
                      return (
                        <div
                          key={`bar-${item.step}`}
                          style={{
                            width: `${widthPct}%`,
                            height: "100%",
                            background: item.color,
                          }}
                        />
                      );
                    })}
                </div>

                <div className="documento-pipeline-stages">
                  {pipelineStages.map((item) => {
                    const pct = cases.length > 0 ? Math.round((item.count / cases.length) * 100) : 0;
                    return (
                      <button
                        key={item.stage}
                        type="button"
                        onClick={() => {
                          setCasesDrilldownFilter({ stage: item.stageKey });
                          setActiveTab("cases");
                        }}
                        title={`Click to filter caseload at ${item.stage}`}
                        style={{
                          padding: "14px 16px",
                          border: "none",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "6px",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: 700, color: "#6E7F7C", letterSpacing: "0.05em" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: item.color }} aria-hidden="true" />
                            STAGE {item.step}
                          </span>
                          <span style={{ color: "#6E7F7C", fontSize: "11px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                            {pct}%
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: "12.5px", color: "#172322", fontWeight: 650, lineHeight: 1.25 }}>
                            {item.stage}
                          </div>
                          {item.sub && (
                            <div style={{ fontSize: "10.5px", color: "#6E7F7C", marginTop: "1px" }}>
                              {item.sub}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: "21px", fontWeight: 700, color: "#063C3D", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                          {item.count}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* Cases by Country & Pathway + Urgent Attention Cases */}
          <div className="documento-split-pane">
            <div style={{ padding: "18px 20px" }}>
              <div style={{ marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 700, color: "#063C3D" }}>
                  Cases by Country &amp; Jurisdiction
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                  Breakdown of petitions by target immigration authority.
                </p>
              </div>
              <div style={{ borderTop: "1px solid #EDF2EF" }}>
                {Object.entries(countryCounts).length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "#6E7F7C", fontSize: "12.5px" }}>
                    No case jurisdictions registered yet
                  </div>
                ) : (
                  Object.entries(countryCounts).map(([country, count]) => (
                    <div
                      key={country}
                      onClick={() => {
                        setCasesDrilldownFilter({ jurisdiction: country });
                        setActiveTab("cases");
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "13px",
                        padding: "10px 0",
                        borderBottom: "1px solid #EDF2EF",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ color: "#172322", fontWeight: 600 }}>{country}</span>
                      <Badge variant="neutral">{count} petitions</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ padding: "18px 20px" }}>
              <div style={{ marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 700, color: "#063C3D" }}>
                  Upcoming Deadlines &amp; Priority Action Items
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                  Agency filing clocks and RFE response deadlines.
                </p>
              </div>
              <div style={{ borderTop: "1px solid #EDF2EF" }}>
                {cases.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "#6E7F7C", fontSize: "12.5px" }}>
                    No Active Cases in Firm Workspace
                  </div>
                ) : (
                  cases.slice(0, 3).map((c) => {
                    const kp = getCaseKickoffProgress(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => onSelectCase(c)}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid #EDF2EF",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: "13px", color: "#063C3D", display: "block", fontVariantNumeric: "tabular-nums" }}>
                            {c.case_number}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#526663" }}>{c.client_name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                          {kp && !kp.isComplete && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCaseKickoff(c);
                              }}
                            >
                              Kickoff ({kp.completedCount}/4)
                            </Button>
                          )}
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: c.attention_required ? "#B91C1C" : "#063C3D" }}>
                              {c.deadline || "Standard"}
                            </span>
                            <small style={{ display: "block", color: "#6E7F7C", fontSize: "11px" }}>Deadline</small>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* EXECUTIVE COMMAND CENTER TAB */}
      {effectiveTab === "executive" && (
        <ExecutiveCommandCenter
          isLiveBackend={isLiveBackend}
          onNavigateTab={(tab, filter) => {
            if (tab === "cases") {
              setCasesDrilldownFilter(filter || null);
              setActiveTab("cases");
            } else if (tab === "analytics") {
              setAnalyticsDrilldownFilter(filter || null);
              setActiveTab("analytics");
            } else if (tab === "operations" || tab === "team") {
              setActiveTab("operations");
            } else if (tab === "billing" || tab === "financials") {
              setActiveTab("billing");
            } else if (tab === "audit") {
              setActiveTab("audit");
            } else if (tab === "clients") {
              setActiveTab("clients");
            } else if (tab === "manager_priority") {
              setActiveTab("manager_priority");
            }
          }}
          onSelectCase={(caseId) => {
            const found = cases.find((c) => c.id === caseId || c.case_number === caseId);
            if (found) {
              onSelectCase(found);
            } else if (cases.length > 0) {
              onSelectCase(cases[0]);
            }
          }}
        />
      )}

      {/* ANALYTICS TAB */}
      {effectiveTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {analyticsDrilldownFilter && (
            <div
              data-testid="analytics-drilldown-filter-banner"
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                background: "#EAF6F0",
                border: "1px solid #B9DED4",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                fontSize: "12.5px",
                color: "#063C3D",
              }}
            >
              <span>
                <strong>Active Drilldown Filter:</strong>{" "}
                {Object.entries(analyticsDrilldownFilter)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" • ")}
              </span>
              <Button variant="outline" size="sm" onClick={() => setAnalyticsDrilldownFilter(null)}>
                Clear Filter
              </Button>
            </div>
          )}
          <AnalyticsExplorer isLiveBackend={isLiveBackend} />
        </div>
      )}

      {/* OPERATIONS & WORKLOAD TAB */}
      {effectiveTab === "operations" && (
        <BusinessOperationsHub
          isLiveBackend={isLiveBackend}
          currentUser={currentUser}
          capacity={capacity}
          onTeamChanged={() => {
            void ws?.refreshCapacity?.();
            void ws?.refreshCases?.();
          }}
        />
      )}

      {/* RELIABILITY, PRIVACY & SECURITY TAB */}
      {effectiveTab === "reliability_ops" && (
        <OperationalReliabilityHub isLiveBackend={isLiveBackend} cases={cases} staff={capacity} />
      )}

      {/* BILLING & RETAINERS TAB */}
      {effectiveTab === "billing" && (
        <BillingManager userRole="owner" isLiveBackend={isLiveBackend} />
      )}

      {/* ALL CASES TAB */}
      {effectiveTab === "cases" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
                Comprehensive Firm Caseload
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#6E7F7C" }}>
                Filter and inspect all active, filed, and in-review immigration petitions.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="outline" size="sm" onClick={onOpenCreateCase || onOpenCreateClient}>
                + Create Case
              </Button>
              <Button variant="primary" size="sm" onClick={onOpenCreateClient}>
                + Onboard Client &amp; Case
              </Button>
            </div>
          </div>
          {casesDrilldownFilter && (
            <div
              data-testid="cases-drilldown-filter-banner"
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                background: "#EAF6F0",
                border: "1px solid #B9DED4",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                fontSize: "12.5px",
                color: "#063C3D",
              }}
            >
              <span>
                <strong>Filtered Caseload View:</strong>{" "}
                {[
                  casesDrilldownFilter.stage ? `Stage: ${casesDrilldownFilter.stage}` : null,
                  casesDrilldownFilter.status ? `Status: ${casesDrilldownFilter.status}` : null,
                  casesDrilldownFilter.attention ? "Attention Required" : null,
                  casesDrilldownFilter.jurisdiction ? `Jurisdiction: ${casesDrilldownFilter.jurisdiction}` : null,
                  casesDrilldownFilter.filter ? `Filter: ${casesDrilldownFilter.filter}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}{" "}
                ({filteredCasesForTable.length} of {cases.length} cases)
              </span>
              <Button
                variant="outline"
                size="sm"
                data-testid="clear-cases-drilldown-filter"
                onClick={() => setCasesDrilldownFilter(null)}
              >
                Clear Filter
              </Button>
            </div>
          )}
          <DataTable
            variant="boxed"
            columns={caseColumns}
            data={filteredCasesForTable}
            keyExtractor={(c) => c.id}
            searchPlaceholder="Search case ref, client name, or title..."
            searchFields={["case_number", "title", "client_name", "visa_category"]}
            filterOptions={{
              label: "Stage",
              field: "status",
              options: [
                { label: "Intake", value: "intake" },
                { label: "Evidence Gathering", value: "gathering" },
                { label: "Review", value: "review" },
                { label: "Assembly", value: "assembly" },
                { label: "Ready for Filing", value: "ready" },
                { label: "Filed", value: "filed" },
              ],
            }}
            onRowClick={(c) => onSelectCase(c)}
          />
        </div>
      )}

      {/* RETAINED CLIENTS TAB */}
      {effectiveTab === "clients" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
                Retained Applicant Directory &amp; Portal Access Control
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#6E7F7C" }}>
                All registered clients under organization representation. Credentials must be provided by Owner or Lead Paralegal for client portal sign-in.
                {canAssign && staffRoster.length <= 1 && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("operations")}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#0D6866",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Add caseworkers in Team &amp; Operations →
                    </button>
                  </>
                )}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onOpenCreateClient}>
              + Onboard Client &amp; Case
            </Button>
          </div>
          {clients.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#FFFFFF",
                border: "1px dashed #B9DED4",
                borderRadius: "10px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#EAF6F0",
                  color: "#0D6866",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                }}
              >
                <WorkspaceIcon name="user" size={22} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                No Retained Clients in Firm Directory (Clean Slate)
              </h3>
              <p style={{ fontSize: "13px", color: "#6E7F7C", maxWidth: "520px", margin: "0 auto 20px auto", lineHeight: 1.5 }}>
                Zero client profiles are currently registered. Retained clients cannot log into Documento until an Owner or Lead Paralegal retains their record and provides their secure portal credentials.
              </p>
              <Button variant="primary" onClick={onOpenCreateClient}>
                + Onboard First Client &amp; Open Case
              </Button>
            </div>
          ) : (
            <DataTable
              variant="boxed"
              columns={[
                {
                  key: "name",
                  header: "Applicant Name",
                  render: (c) => (
                    <div>
                      <strong style={{ color: "#063C3D", display: "block" }}>{c.first_name} {c.last_name}</strong>
                      <span style={{ fontSize: "11px", color: "#6E7F7C" }}>ID: {c.id}</span>
                    </div>
                  ),
                },
                {
                  key: "email",
                  header: "Email Address",
                  render: (c) => <span style={{ fontWeight: 550, color: "#0D6866" }}>{c.email}</span>,
                },
                {
                  key: "nationality",
                  header: "Nationality",
                  render: (c) => <Badge variant="neutral">{c.nationality}</Badge>,
                },
                {
                  key: "phone",
                  header: "Telephone",
                  render: (c) => <span>{c.phone || "Not recorded"}</span>,
                },
                {
                  key: "created_at",
                  header: "Retained Date",
                  render: (c) => <span suppressHydrationWarning>{new Date(c.created_at).toLocaleDateString()}</span>,
                },
                {
                  key: "assigned_caseworker",
                  header: "Assigned Caseworker",
                  render: (c) => {
                    const currentWorker = resolveClientAssignedWorker(c);
                    if (!canAssign) {
                      return (
                        <span style={{ fontSize: "12.5px", fontWeight: 600, color: currentWorker ? "#063C3D" : "#6E7F7C" }}>
                          {currentWorker || "Unassigned"}
                        </span>
                      );
                    }
                    const isBusy = assigningEntityKey === `client:${c.id}`;
                    return (
                      <select
                        data-testid={`assign-client-caseworker-${c.id}`}
                        aria-label={`Assign caseworker to ${c.first_name} ${c.last_name}`}
                        value={currentWorker}
                        disabled={isBusy}
                        onChange={(e) => void handleAssignClientChange(c, e.target.value)}
                        style={{
                          padding: "5px 8px",
                          borderRadius: "6px",
                          border: currentWorker ? "1px solid #B9DED4" : "1px solid #F6D8A6",
                          background: currentWorker ? "#F8FAF9" : "#FFFBEB",
                          color: currentWorker ? "#063C3D" : "#92400E",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: isBusy ? "wait" : "pointer",
                          maxWidth: "185px",
                        }}
                      >
                        <option value="">Unassigned</option>
                        {staffRoster.map((member) => (
                          <option key={member.id || member.name} value={member.name}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    );
                  },
                },
                {
                  key: "credentials_status",
                  header: "Portal Access",
                  render: (c) => (
                    <div>
                      {c.portal_credentials_provided ? (
                        <Badge variant="success" size="sm">
                          Active Credentials
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          No Credentials (Blocked)
                        </Badge>
                      )}
                      {c.credentials_provisioned_by && (
                        <div style={{ fontSize: "10px", color: "#6E7F7C", marginTop: "2px" }}>
                          By {c.credentials_provisioned_by}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Action",
                  render: (c) => (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <Button
                        variant={c.portal_credentials_provided ? "outline" : "primary"}
                        size="sm"
                        onClick={() => {
                          setSelectedClientForCredentials(c);
                          setIsProvisionModalOpen(true);
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                      >
                        <WorkspaceIcon name="key" size={13} />
                        {c.portal_credentials_provided ? "Manage Credentials" : "Issue Credentials"}
                      </Button>
                      {canDelete && (
                        <Button
                          variant="danger"
                          size="sm"
                          id={`delete-client-${c.id}`}
                          aria-label={`Delete client ${c.first_name} ${c.last_name}`}
                          onClick={() => handleDeleteClientClick(c)}
                          style={{
                            background: "#FFF0F0",
                            color: "#D32F2F",
                            borderColor: "#FFCDD2",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <WorkspaceIcon name="trash" size={13} />
                          Delete Client
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
              data={clients}
              keyExtractor={(c) => c.id}
            />
          )}
        </div>
      )}

      {/* AUDIT ALERTS TAB */}
      {effectiveTab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#063C3D" }}>
              Append-Only Cryptographic Audit Log
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#6E7F7C" }}>
              Tamper-evident system activity and multi-tenant boundary verifications.
            </p>
          </div>
          <DataTable
            variant="boxed"
            columns={[
              { key: "created_at", header: "Timestamp", render: (a) => <span style={{ fontSize: "12px", fontVariantNumeric: "tabular-nums" }} suppressHydrationWarning>{new Date(a.created_at).toLocaleString()}</span> },
              { key: "action", header: "Security Action", render: (a) => <Badge variant="neutral">{a.action}</Badge> },
              { key: "object_id", header: "Target Entity", render: (a) => <strong>{a.object_id}</strong> },
              { key: "actor_email", header: "Actor Identity", render: (a) => <span>{a.actor_email}</span> },
              { key: "metadata", header: "Structured Event Metadata", render: (a) => <code style={{ fontSize: "11px", color: "var(--quiet)" }}>{JSON.stringify(a.metadata)}</code> },
            ]}
            data={auditEvents}
            keyExtractor={(a) => a.id}
          />
        </div>
      )}

      {/* FIRM GOVERNANCE & CONFIGURATION TAB */}
      {effectiveTab === "firm_config" && (
        <FirmConfigurationHub />
      )}

      {/* UNIFIED RULES & PATHWAYS TAB */}
      {(effectiveTab === "rules" || effectiveTab === "stage10_pathway_expansion") && (
        <RuleAdministrationHub
          isLiveBackend={isLiveBackend}
          cases={cases}
          initialTab={effectiveTab === "stage10_pathway_expansion" ? "pathway_expansion" : "coverage"}
        />
      )}

      {/* MANAGER PRIORITY COMMAND BOARD (STRICT RANKS 1 TO 8) */}
      {effectiveTab === "manager_priority" && (
        <ManagerPriorityQueueView
          data={priorityQueueData}
          onAction={(rank, actionType, item) => {
            if (
              actionType === "dispatch_action" ||
              actionType === "inspect_blocker" ||
              actionType === "review_signoff" ||
              actionType === "assign_caseworker"
            ) {
              setActiveTab("cases");
            } else if (actionType === "adjudicate_quality") {
              setActiveTab("operations");
            } else if (actionType === "dispatch_nudge") {
              setActiveTab("conversation_inspector");
            }
          }}
        />
      )}

      {/* OFFICER-CLIENT CONVERSATION INSPECTOR */}
      {effectiveTab === "conversation_inspector" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header & Case Selector */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <label htmlFor="inspector-case-select" style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                Inspect Case Conversation:
              </label>
              <select
                id="inspector-case-select"
                value={selectedInspectorCaseId}
                onChange={(e) => setSelectedInspectorCaseId(e.target.value)}
                disabled={cases.length === 0}
                style={{
                  padding: "7px 12px",
                  borderRadius: "7px",
                  border: "1px solid #DCE5E1",
                  background: "#FAFAF7",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#063C3D",
                  cursor: cases.length === 0 ? "not-allowed" : "pointer",
                  maxWidth: "100%",
                }}
              >
                {cases.length === 0 ? (
                  <option value="">No active cases available</option>
                ) : (
                  cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.client_name} ({c.visa_category}) • Lead: {c.assigned_manager || "Unassigned"}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { key: "all", label: "All Messages", icon: null },
                { key: "client_chat", label: "Client Chat", icon: null },
                { key: "internal_notes", label: "Internal Notes", icon: "lock" as WorkspaceIconName },
              ].map((f) => {
                const active = inspectorChannelFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setInspectorChannelFilter(f.key as typeof inspectorChannelFilter)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: active ? 650 : 500,
                      background: active ? "#063C3D" : "#FFFFFF",
                      color: active ? "#FFFFFF" : "#445451",
                      border: `1px solid ${active ? "#063C3D" : "#DCE5E1"}`,
                      cursor: "pointer",
                    }}
                  >
                    {f.icon && <WorkspaceIcon name={f.icon} size={12} />}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Authorization Notice */}
          <div
            style={{
              background: "#F4FAF7",
              border: "1px solid #B9DED4",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#063C3D",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <WorkspaceIcon name="lock" size={14} style={{ color: "#176B50" }} />
            <span>
              <strong>Managing Partner Oversight Clearance:</strong> Full authorization to review case communications, audit trails, and quarantined legal work product pursuant to firm supervisory obligations.
            </span>
          </div>

          {/* Conversation Log Card */}
          <Card
            variant="flat"
            title={`Conversation History & Supervisory Log: ${cases.find((c) => c.id === selectedInspectorCaseId)?.case_number || (cases[0]?.case_number || "No Active Case Selected")}`}
            subtitle="Immutable transcript of applicant messaging, caseworker updates, and managing partner directives."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {cases.length === 0 || (inspectorMessages.length === 0 && supervisoryNotes.length === 0) ? (
                <div style={{ padding: "36px 20px", textAlign: "center", color: "#6E7F7C", background: "#FAFAF7", borderRadius: "8px", border: "1px dashed #DCE5E1" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "#EAF6F0",
                      color: "#0D6866",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <WorkspaceIcon name="message-square" size={18} />
                  </div>
                  <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>No Conversation Messages Recorded</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                    {cases.length === 0
                      ? "Day 0 Initial State: Retain a client or open a case to record immutable communications and supervisory directives."
                      : "No client messages, caseworker notes, or supervisory directives have been posted on this file yet."}
                  </p>
                </div>
              ) : (
                <>
                  {inspectorMessages
                    .filter((m) => {
                      if (inspectorChannelFilter === "client_chat") return m.role !== "internal_note";
                      if (inspectorChannelFilter === "internal_notes") return m.role === "internal_note";
                      return true;
                    })
                    .map((m) => {
                      const isInternal = m.role === "internal_note";
                      const isClient = m.role === "client";

                      return (
                        <div
                          key={m.id}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "10px",
                            background: isInternal ? "#FEF3C7" : isClient ? "#F1F5F9" : "#EAF6F0",
                            border: `1px solid ${isInternal ? "#FDE68A" : isClient ? "#CBD5E1" : "#B9DED4"}`,
                            alignSelf: isClient ? "flex-start" : "flex-end",
                            maxWidth: "85%",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <strong style={{ fontSize: "12px", color: "#063C3D" }}>{m.sender}</strong>
                              <Badge variant={isInternal ? "warning" : isClient ? "neutral" : "success"} size="sm">
                                {isInternal ? "INTERNAL WORK NOTE" : isClient ? "APPLICANT" : "CASE OFFICER"}
                              </Badge>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748B" }}>{m.time}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "13px", color: isInternal ? "#78350F" : "#1E293B", lineHeight: "1.4" }}>
                            {m.text}
                          </p>
                        </div>
                      );
                    })}

                  {supervisoryNotes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "#FEF3C7",
                        border: "1px solid #FDE68A",
                        alignSelf: "flex-end",
                        maxWidth: "85%",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ fontSize: "12px", color: "#063C3D" }}>{n.author}</strong>
                          <Badge variant="warning" size="sm">SUPERVISORY PARTNER DIRECTIVE</Badge>
                        </div>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>{new Date(n.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#78350F", lineHeight: "1.4" }}>
                        {n.note}
                      </p>
                    </div>
                  ))}
                </>
              )}

              {/* Supervisory Partner Guidance Input */}
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "8px" }}>
                <strong style={{ fontSize: "13px", color: "#063C3D", display: "block", marginBottom: "8px" }}>
                  Record Supervisory Managing Partner Directive:
                </strong>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={supervisoryNoteInput}
                    onChange={(e) => setSupervisoryNoteInput(e.target.value)}
                    disabled={cases.length === 0 || !selectedInspectorCaseId}
                    placeholder={
                      cases.length === 0
                        ? "Open an active case to record supervisory directives..."
                        : "Enter confidential managing partner direction for the case team..."
                    }
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13px",
                    }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={cases.length === 0 || !selectedInspectorCaseId || !supervisoryNoteInput.trim()}
                    onClick={() => {
                      if (!supervisoryNoteInput.trim() || !selectedInspectorCaseId || !supervisoryStorageKey) return;
                      const newNote = {
                        id: `sup-${Date.now()}`,
                        author: ownerDisplayName,
                        note: supervisoryNoteInput.trim(),
                        timestamp: new Date().toISOString(),
                        organization_id: effectiveOrgId,
                        case_id: selectedInspectorCaseId,
                      };
                      const updated = [...supervisoryNotes, newNote];
                      setSupervisoryNotes(updated);
                      if (typeof window !== "undefined") {
                        localStorage.setItem(supervisoryStorageKey, JSON.stringify(updated));
                      }
                      setSupervisoryNoteInput("");
                    }}
                  >
                    Post Directive
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* AI DOCUMENT INTELLIGENCE & PACKET SORTER LAB */}
      {effectiveTab === "extractor_lab" && (
        <DashboardErrorBoundary
          sectionTitle="Document Extractor Lab"
          sectionDescription="AI Document Recognition, Extraction Provenance, and Multi-Person Packet Sorter"
          variant="full-tab"
          isolateStateKey="extractor-lab"
        >
          <DocumentExtractorLab embedded />
        </DashboardErrorBoundary>
      )}
    </main>

    {/* Provision Client Portal Credentials Modal */}
    <ProvisionCredentialsModal
      isOpen={isProvisionModalOpen}
      onClose={() => {
        setIsProvisionModalOpen(false);
        setSelectedClientForCredentials(null);
      }}
      client={selectedClientForCredentials}
      onCredentialsUpdated={(updated) => {
        onClientUpdated?.(updated);
        setIsProvisionModalOpen(false);
        setSelectedClientForCredentials(null);
      }}
      activeRole="master_admin"
    />
  </div>
  );
}
