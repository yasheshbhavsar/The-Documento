import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { TextInput, SelectInput } from "../common/FormControls";
import {
  ClientProfile,
  DocumentItem,
  ImmigrationCase,
  RoleCode,
  TeamMemberCapacity,
  UserContext,
} from "../../lib/types";
import {
  api,
  createDocumentRequest,
  createInvoice,
  fetchDocumentRequests,
  recordInvoicePayment,
} from "../../lib/api";
import {
  getCaseKickoffProgress,
  getPathwayKickoffConfig,
  initCaseKickoffRecord,
  PathwayKickoffTemplateItem,
  updateCaseKickoffRecord,
} from "../../lib/caseKickoffStore";

interface PostOnboardingLaunchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: ImmigrationCase | null;
  clientItem: ClientProfile | null;
  teamCapacity?: TeamMemberCapacity[];
  currentUser?: UserContext | null;
  activeRole?: RoleCode;
  onCaseUpdated?: (updatedCase: ImmigrationCase) => void;
  onClientUpdated?: (updatedClient: ClientProfile) => void;
  onDocumentUploaded?: (newDoc: DocumentItem) => void;
  onKickoffChanged?: () => void;
  onOpenCaseWorkspace?: (caseItem: ImmigrationCase) => void;
}

export function PostOnboardingLaunchpadModal({
  isOpen,
  onClose,
  caseItem,
  clientItem,
  teamCapacity = [],
  currentUser,
  activeRole = "master_admin",
  onCaseUpdated,
  onClientUpdated,
  onDocumentUploaded,
  onKickoffChanged,
  onOpenCaseWorkspace,
}: PostOnboardingLaunchpadModalProps) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Step 1 state: Portal Login Packet & Handoff
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("ClientPass2026!");
  const [copiedPacket, setCopiedPacket] = useState(false);
  const [welcomeNote, setWelcomeNote] = useState("");
  const [welcomePostedToPortal, setWelcomePostedToPortal] = useState(false);

  // Step 2 state: Case Officer & Pathway Checklist
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [checklistItems, setChecklistItems] = useState<
    Array<PathwayKickoffTemplateItem & { selected: boolean }>
  >([]);
  const [customChecklistTitle, setCustomChecklistTitle] = useState("");
  const [checklistDueDate, setChecklistDueDate] = useState(
    () => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [enable12PageIntake, setEnable12PageIntake] = useState(true);

  // Step 3 state: Initial Retainer / Fee Schedule
  const [retainerMode, setRetainerMode] = useState<"issue_invoice" | "mark_paid" | "skip">(
    "issue_invoice"
  );
  const [retainerCurrency, setRetainerCurrency] = useState<string>("USD");
  const [retainerAmount, setRetainerAmount] = useState<string>("3500");
  const [retainerDescription, setRetainerDescription] = useState<string>("");
  const [retainerDueDate, setRetainerDueDate] = useState<string>(
    () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );

  // Step 4 state: Initial Counsel Uploads
  const [uploadedFilesInSession, setUploadedFilesInSession] = useState<DocumentItem[]>([]);
  const [selectedDocCategory, setSelectedDocCategory] = useState<string>("government_correspondence");

  // Re-read live kickoff state whenever modal opens or step completes
  const [kickoffRefreshTick, setKickoffRefreshTick] = useState(0);

  const firmName = currentUser?.organization_name || "Partner Immigration Counsel";
  const portalUrl =
    typeof window !== "undefined" ? `${window.location.origin}/login` : "https://app.documento.legal/login";

  const pathwayConfig = useMemo(
    () =>
      getPathwayKickoffConfig(
        caseItem?.jurisdiction || "United States (USCIS)",
        caseItem?.visa_category || "Immigration Petition"
      ),
    [caseItem?.jurisdiction, caseItem?.visa_category]
  );

  const kickoffProgress = useMemo(() => {
    if (!caseItem) {
      return {
        record: null,
        completedCount: 0,
        totalSteps: 4 as const,
        isComplete: false,
        nextStepIndex: 1 as const,
      };
    }
    return getCaseKickoffProgress(caseItem.id);
  }, [caseItem, kickoffRefreshTick]);

  // Available officers for Step 2
  const officerOptions = useMemo(() => {
    const names = new Set<string>();
    if (caseItem?.assigned_manager && caseItem.assigned_manager !== "Unassigned") {
      names.add(caseItem.assigned_manager);
    }
    if (currentUser?.full_name) {
      names.add(currentUser.full_name);
    }
    for (const tm of teamCapacity) {
      if (tm.name) names.add(tm.name);
    }
    if (names.size === 0) {
      names.add("Managing Counsel");
    }
    return Array.from(names).map((n) => ({ label: n, value: n }));
  }, [caseItem?.assigned_manager, currentUser?.full_name, teamCapacity]);

  useEffect(() => {
    if (!isOpen || !caseItem) return;

    const existingRec = initCaseKickoffRecord({
      caseId: caseItem.id,
      caseNumber: caseItem.case_number,
      clientId: caseItem.client_id,
      assignedOfficer: caseItem.assigned_manager || currentUser?.full_name,
    });
    const progress = getCaseKickoffProgress(caseItem.id);
    setActiveStep(progress.nextStepIndex);
    setStatusNotice(null);
    setErrorNotice(null);
    setCopiedPacket(false);
    setWelcomePostedToPortal(false);
    setUploadedFilesInSession([]);

    const clientFullName = clientItem
      ? `${clientItem.first_name} ${clientItem.last_name}`.trim()
      : caseItem.client_name || "Client";
    const tempPass = clientItem?.portal_temporary_password || "ClientPass2026!";
    const loginEmail = clientItem?.email || "applicant@example.com";

    setWelcomeNote(
      `Welcome ${clientFullName} — your ${caseItem.visa_category} case file (${caseItem.case_number}) is now open with ${firmName}.\n` +
        `Client Portal Login: ${portalUrl}\n` +
        `Email: ${loginEmail}\n` +
        `Temporary Password: ${tempPass}\n` +
        `Please sign in to complete your Applicant Background Questionnaire and upload your requested pathway documents.`
    );

    const defaultOfficer =
      existingRec.assignedOfficer ||
      caseItem.assigned_manager ||
      currentUser?.full_name ||
      officerOptions[0]?.value ||
      "Managing Counsel";
    setSelectedOfficer(defaultOfficer);

    setChecklistItems(
      pathwayConfig.items.map((item) => ({
        ...item,
        selected: true,
      }))
    );

    setRetainerCurrency(pathwayConfig.currency);
    setRetainerAmount(String(pathwayConfig.suggestedRetainerAmount));
    setRetainerDescription(
      `Stage 1 Legal Representation Retainer — ${caseItem.visa_category} (${caseItem.case_number})`
    );
    setKickoffRefreshTick((t) => t + 1);
  }, [isOpen, caseItem?.id]);

  if (!caseItem) return null;

  const resolvedClient: ClientProfile = clientItem || {
    id: caseItem.client_id || "client-fallback",
    organization_id: caseItem.organization_id || "firm-org",
    first_name: (caseItem.client_name || "Applicant").split(" ")[0],
    last_name: (caseItem.client_name || "").split(" ").slice(1).join(" ") || "Client",
    email: "applicant@portal.legal",
    nationality: "USA",
    created_at: caseItem.created_at || new Date().toISOString(),
    portal_credentials_provided: true,
    portal_access_enabled: true,
    portal_temporary_password: "ClientPass2026!",
  };

  const clientFullName = clientItem
    ? `${clientItem.first_name} ${clientItem.last_name}`.trim()
    : caseItem.client_name || `${resolvedClient.first_name} ${resolvedClient.last_name}`.trim();
  const clientEmail = clientItem?.email || resolvedClient.email;
  const hasPortalCredentials = Boolean(
    resolvedClient.portal_credentials_provided && resolvedClient.portal_access_enabled !== false
  );
  const currentTempPassword = resolvedClient.portal_temporary_password || "ClientPass2026!";

  const refreshProgress = () => {
    setKickoffRefreshTick((t) => t + 1);
    onKickoffChanged?.();
  };

  // --- STEP 1 HANDLERS ---
  const handleIssueCredentialsInline = async () => {
    setIsBusy(true);
    setErrorNotice(null);
    try {
      const res = await api.provisionClientCredentials(
        resolvedClient.id,
        newPasswordInput.trim() || "ClientPass2026!",
        true,
        activeRole
      );
      onClientUpdated?.(res.data);
      setStatusNotice(`Portal login credentials activated for ${res.data.email}.`);
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to provision credentials.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyLoginPacket = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(welcomeNote);
      }
      setCopiedPacket(true);
      setStatusNotice("Client login packet copied to clipboard.");
    } catch {
      setCopiedPacket(true);
    }
  };

  const handlePostWelcomeToPortal = async () => {
    if (!welcomeNote.trim()) return;
    setIsBusy(true);
    setErrorNotice(null);
    try {
      await api.sendMessage(welcomeNote.trim(), "attorney");
      setWelcomePostedToPortal(true);
      setStatusNotice("Welcome & onboarding instructions posted to Client Portal messages.");
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to post welcome note.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCompleteStep1 = () => {
    updateCaseKickoffRecord(caseItem.id, {
      caseNumber: caseItem.case_number,
      clientId: caseItem.client_id,
      step1CredentialsShared: true,
    });
    refreshProgress();
    setStatusNotice(null);
    setErrorNotice(null);
    setActiveStep(2);
  };

  // --- STEP 2 HANDLERS ---
  const handleAddCustomChecklistItem = () => {
    const trimmed = customChecklistTitle.trim();
    if (!trimmed) return;
    setChecklistItems((prev) => [
      ...prev,
      {
        code: `CUSTOM-${Date.now().toString().slice(-4)}`,
        title: trimmed,
        category: "supporting_evidence",
        citation: "Counsel Evidentiary Request",
        description: `Case-specific document requested by ${selectedOfficer || firmName}.`,
        mandatory: true,
        selected: true,
      },
    ]);
    setCustomChecklistTitle("");
  };

  const handleCompleteStep2 = async () => {
    const chosen = checklistItems.filter((i) => i.selected);
    if (chosen.length === 0) {
      setErrorNotice("Select at least one document request to dispatch to the client portal.");
      return;
    }

    setIsBusy(true);
    setErrorNotice(null);
    try {
      const officerRes = await api.assignCaseOfficer(
        caseItem.id,
        selectedOfficer,
        { markChecklistTaskComplete: true, advanceToAwaitingDocuments: true },
        activeRole
      );
      if (officerRes.data) {
        onCaseUpdated?.(officerRes.data);
      }

      const existingReqs = await fetchDocumentRequests(caseItem.id);
      const existingTitles = new Set(existingReqs.map((r) => r.title.trim().toLowerCase()));

      let newlyCreatedCount = 0;
      for (const item of chosen) {
        if (existingTitles.has(item.title.trim().toLowerCase())) continue;
        await createDocumentRequest({
          case_id: caseItem.id,
          requested_from_client_id: caseItem.client_id,
          title: item.title,
          description: item.description,
          category: item.category,
          rationale: `${item.citation} — Required for ${caseItem.visa_category}`,
          statutory_requirement_code: item.code,
          due_date: checklistDueDate,
          instructions: enable12PageIntake
            ? "Upload clear color PDF/JPEG scan and verify matching entries in your Applicant Background Questionnaire."
            : "Upload clear color PDF/JPEG scan (300 DPI minimum, all four corners visible).",
        });
        newlyCreatedCount += 1;
      }

      updateCaseKickoffRecord(caseItem.id, {
        caseNumber: caseItem.case_number,
        clientId: caseItem.client_id,
        step2ChecklistDispatched: true,
        assignedOfficer: selectedOfficer,
        dispatchedChecklistCount: chosen.length,
        intakeQuestionnaireEnabled: enable12PageIntake,
      });
      refreshProgress();
      setStatusNotice(
        `Assigned ${selectedOfficer} and dispatched ${newlyCreatedCount || chosen.length} document request(s) to ${clientFullName}'s portal.`
      );
      setActiveStep(3);
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to dispatch checklist.");
    } finally {
      setIsBusy(false);
    }
  };

  // --- STEP 3 HANDLERS ---
  const handleCompleteStep3 = async () => {
    if (retainerMode === "skip") {
      updateCaseKickoffRecord(caseItem.id, {
        caseNumber: caseItem.case_number,
        clientId: caseItem.client_id,
        step3RetainerConfigured: true,
        retainerMode: "skipped",
      });
      refreshProgress();
      setStatusNotice(null);
      setActiveStep(4);
      return;
    }

    const numericAmount = Number(retainerAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorNotice("Enter a valid positive retainer amount, or choose Skip.");
      return;
    }

    setIsBusy(true);
    setErrorNotice(null);
    try {
      const createdInv = await createInvoice({
        client_id: caseItem.client_id,
        client_name: clientFullName,
        case_id: caseItem.id,
        currency: retainerCurrency,
        due_date: new Date(retainerDueDate || Date.now()).toISOString(),
        tax_amount: 0,
        discount_amount: 0,
        line_items: [
          {
            description:
              retainerDescription.trim() ||
              `Stage 1 Legal Representation Retainer — ${caseItem.visa_category}`,
            quantity: 1,
            unit_price: numericAmount,
          },
        ],
      });

      if (retainerMode === "mark_paid" && createdInv?.id) {
        await recordInvoicePayment(createdInv.id, {
          amount: numericAmount,
          payment_method: "trust_escrow_transfer",
        });
      }

      updateCaseKickoffRecord(caseItem.id, {
        caseNumber: caseItem.case_number,
        clientId: caseItem.client_id,
        step3RetainerConfigured: true,
        retainerInvoiceNumber: createdInv?.invoice_number,
        retainerAmountLabel: `${retainerCurrency} ${numericAmount.toLocaleString()}`,
        retainerMode: retainerMode === "mark_paid" ? "paid" : "issued",
      });
      refreshProgress();
      setStatusNotice(
        retainerMode === "mark_paid"
          ? `Retainer receipt ${createdInv?.invoice_number} (${retainerCurrency} ${numericAmount.toLocaleString()}) recorded as Paid.`
          : `Retainer invoice ${createdInv?.invoice_number} (${retainerCurrency} ${numericAmount.toLocaleString()}) issued to client portal.`
      );
      setActiveStep(4);
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to save retainer invoice.");
    } finally {
      setIsBusy(false);
    }
  };

  // --- STEP 4 HANDLERS ---
  const handleQuickUploadFile = async (title: string, category: string, fileSizeLabel: string) => {
    setIsBusy(true);
    setErrorNotice(null);
    try {
      const pseudoHash = Array.from({ length: 64 }, (_, idx) =>
        ((title.charCodeAt(idx % title.length) + idx * 17 + Date.now()) % 16).toString(16)
      ).join("");
      const uploadRes = await api.uploadDocument(
        {
          title,
          category,
          file_size: fileSizeLabel,
          uploaded_by: currentUser?.full_name || "Assigned Counsel",
          sha256_hash: pseudoHash,
          case_id: caseItem.id,
        },
        activeRole
      );
      setUploadedFilesInSession((prev) => [uploadRes.data, ...prev]);
      onDocumentUploaded?.(uploadRes.data);

      const prevCount = kickoffProgress.record?.uploadedInitialDocCount || 0;
      updateCaseKickoffRecord(caseItem.id, {
        caseNumber: caseItem.case_number,
        clientId: caseItem.client_id,
        uploadedInitialDocCount: prevCount + 1,
      });
      refreshProgress();
      setStatusNotice(`Uploaded "${title}" to ${caseItem.case_number} evidentiary vault.`);
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to upload document.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDiskFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeMb = Math.max(0.1, file.size / (1024 * 1024)).toFixed(2);
    await handleQuickUploadFile(file.name, selectedDocCategory, `${sizeMb} MB`);
    e.target.value = "";
  };

  const handleFinishKickoff = (openWorkspaceAfter: boolean) => {
    updateCaseKickoffRecord(caseItem.id, {
      caseNumber: caseItem.case_number,
      clientId: caseItem.client_id,
      step4InitialDocsOrWorkspace: true,
      completedAt: new Date().toISOString(),
    });
    refreshProgress();
    onClose();
    if (openWorkspaceAfter) {
      onOpenCaseWorkspace?.(caseItem);
    }
  };

  const stepDefinitions: Array<{
    num: 1 | 2 | 3 | 4;
    shortTitle: string;
    done: boolean;
  }> = [
    {
      num: 1,
      shortTitle: "1. Portal Login Handoff",
      done: Boolean(kickoffProgress.record?.step1CredentialsShared),
    },
    {
      num: 2,
      shortTitle: "2. Officer & Checklist",
      done: Boolean(kickoffProgress.record?.step2ChecklistDispatched),
    },
    {
      num: 3,
      shortTitle: "3. Retainer & Billing",
      done: Boolean(kickoffProgress.record?.step3RetainerConfigured),
    },
    {
      num: 4,
      shortTitle: "4. Initial Docs & Launch",
      done: Boolean(kickoffProgress.record?.step4InitialDocsOrWorkspace),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Post-Onboarding Case Kickoff — ${caseItem.case_number}`}
      subtitle={`${clientFullName} • ${caseItem.jurisdiction} • ${caseItem.visa_category} (${kickoffProgress.completedCount}/4 steps completed)`}
      maxWidth="2xl"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            Finish Later (Saved {kickoffProgress.completedCount}/4)
          </Button>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {activeStep > 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  setErrorNotice(null);
                  setStatusNotice(null);
                  setActiveStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1));
                }}
                disabled={isBusy}
              >
                ← Back
              </Button>
            )}

            {activeStep === 1 && (
              <Button variant="primary" onClick={handleCompleteStep1} isLoading={isBusy}>
                Mark Login Shared &amp; Next →
              </Button>
            )}

            {activeStep === 2 && (
              <Button variant="primary" onClick={handleCompleteStep2} isLoading={isBusy}>
                Assign Officer &amp; Dispatch Checklist →
              </Button>
            )}

            {activeStep === 3 && (
              <Button variant="primary" onClick={handleCompleteStep3} isLoading={isBusy}>
                {retainerMode === "skip"
                  ? "Skip Billing & Next →"
                  : retainerMode === "mark_paid"
                    ? "Record Paid Retainer & Next →"
                    : "Issue Retainer Invoice & Next →"}
              </Button>
            )}

            {activeStep === 4 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleFinishKickoff(false)}
                  disabled={isBusy}
                >
                  Complete &amp; Return to Dashboard
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleFinishKickoff(true)}
                  disabled={isBusy}
                >
                  Complete Kickoff &amp; Open Case Workspace →
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div
        data-testid="post-onboarding-launchpad"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {/* 4-Step Progress Navigation Bar */}
        <div
          role="tablist"
          aria-label="Post-onboarding kickoff steps"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "6px",
            background: "#F8F7F2",
            padding: "6px",
            borderRadius: "8px",
            border: "1px solid #DCE5E1",
          }}
        >
          {stepDefinitions.map((step) => {
            const isCurrent = activeStep === step.num;
            return (
              <button
                key={step.num}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => {
                  setErrorNotice(null);
                  setStatusNotice(null);
                  setActiveStep(step.num);
                }}
                style={{
                  padding: "8px 8px",
                  borderRadius: "6px",
                  border: isCurrent
                    ? "1px solid #0D6866"
                    : step.done
                      ? "1px solid #B9DED4"
                      : "1px solid transparent",
                  background: isCurrent ? "#FFFFFF" : step.done ? "#EAF6F0" : "transparent",
                  color: isCurrent ? "#063C3D" : step.done ? "#176B50" : "#526360",
                  fontSize: "11.5px",
                  fontWeight: isCurrent || step.done ? 700 : 550,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "4px",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {step.shortTitle}
                </span>
                {step.done && (
                  <span aria-label="Completed" style={{ fontSize: "11px", color: "#176B50", flexShrink: 0 }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {statusNotice && (
          <div
            role="status"
            style={{
              padding: "10px 12px",
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              borderRadius: "6px",
              color: "#063C3D",
              fontSize: "12.5px",
              fontWeight: 600,
            }}
          >
            {statusNotice}
          </div>
        )}

        {errorNotice && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "6px",
              color: "#B91C1C",
              fontSize: "12.5px",
              fontWeight: 600,
            }}
          >
            {errorNotice}
          </div>
        )}

        {/* =====================================================================
            STEP 1: SHARE CLIENT PORTAL LOGIN PACKET
            ===================================================================== */}
        {activeStep === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "14px 16px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>
                    Step 1: Hand Off Client Transparency Portal Credentials
                  </strong>
                  <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    Send {clientFullName} their portal login so they can upload documents and fill out intake forms securely.
                  </span>
                </div>
                <Badge variant={hasPortalCredentials ? "success" : "warning"}>
                  {hasPortalCredentials ? "Portal Login Active" : "Credentials Not Issued"}
                </Badge>
              </div>

              {hasPortalCredentials ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "10px",
                    padding: "10px 12px",
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "6px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", color: "#6E7F7C", display: "block" }}>Portal Sign-In URL</span>
                    <code style={{ fontSize: "12px", color: "#063C3D", fontWeight: 650 }}>{portalUrl}</code>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "#6E7F7C", display: "block" }}>Client Login Email</span>
                    <strong style={{ fontSize: "12.5px", color: "#063C3D" }}>{clientEmail}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "#6E7F7C", display: "block" }}>Temporary Password</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <code data-testid="kickoff-temp-password" style={{ fontSize: "12.5px", fontWeight: 700, color: "#0D6866" }}>
                        {showTempPassword ? currentTempPassword : "••••••••••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() => setShowTempPassword((v) => !v)}
                        style={{
                          border: "1px solid #DCE5E1",
                          background: "#FFFFFF",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#063C3D",
                          cursor: "pointer",
                        }}
                      >
                        {showTempPassword ? "Hide" : "Reveal"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <TextInput
                      label="Set Temporary Client Portal Password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                    />
                  </div>
                  <Button variant="primary" size="sm" onClick={handleIssueCredentialsInline} isLoading={isBusy}>
                    Issue Portal Credentials Now
                  </Button>
                </div>
              )}

              <div>
                <label
                  htmlFor="kickoff-welcome-packet"
                  style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}
                >
                  Ready-to-Send Client Handoff Message (Email / WhatsApp / Portal Chat)
                </label>
                <textarea
                  id="kickoff-welcome-packet"
                  rows={5}
                  value={welcomeNote}
                  onChange={(e) => setWelcomeNote(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    background: "#FFFFFF",
                    color: "#172322",
                    fontSize: "12.5px",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Button variant="secondary" size="sm" onClick={handleCopyLoginPacket}>
                  {copiedPacket ? "✓ Copied Login Packet" : "📋 Copy Login Packet"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePostWelcomeToPortal}
                  disabled={isBusy || welcomePostedToPortal}
                >
                  {welcomePostedToPortal
                    ? "✓ Posted to Client Portal Chat"
                    : "💬 Post Welcome Note to Client Portal"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 2: ASSIGN CASE OFFICER & DISPATCH PATHWAY CHECKLIST
            ===================================================================== */}
        {activeStep === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "14px 16px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>
                  Step 2: Assign Case Officer &amp; Dispatch {caseItem.visa_category} Checklist
                </strong>
                <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                  Selected items immediately appear in {clientFullName}&apos;s Client Portal upload checklist with statutory citations.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <SelectInput
                  label="Assigned Case Officer / Lead Paralegal"
                  value={selectedOfficer}
                  onChange={(e) => setSelectedOfficer(e.target.value)}
                  options={officerOptions}
                />
                <TextInput
                  label="Client Upload Target Due Date"
                  type="date"
                  value={checklistDueDate}
                  onChange={(e) => setChecklistDueDate(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#063C3D",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={enable12PageIntake}
                  onChange={(e) => setEnable12PageIntake(e.target.checked)}
                />
                <span>Activate Applicant Background Questionnaire &amp; Guided Form in Client Portal</span>
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#172322" }}>
                  Pathway Evidentiary Checklist ({checklistItems.filter((i) => i.selected).length} selected):
                </span>
                {checklistItems.map((item, idx) => (
                  <label
                    key={item.code}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "9px 12px",
                      background: item.selected ? "#FFFFFF" : "#F8F7F2",
                      border: `1px solid ${item.selected ? "#B9DED4" : "#DCE5E1"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) =>
                        setChecklistItems((prev) =>
                          prev.map((row, rIdx) =>
                            rIdx === idx ? { ...row, selected: e.target.checked } : row
                          )
                        )
                      }
                      style={{ marginTop: "3px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "12.5px", color: "#063C3D" }}>{item.title}</strong>
                        <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 600 }}>
                          {item.citation}
                        </span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#526360", display: "block", marginTop: "2px" }}>
                        {item.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Add Case-Specific Document Request (Optional)"
                    placeholder="e.g. Prior Visa Refusal Letter or Provincial Nominee Certificate"
                    value={customChecklistTitle}
                    onChange={(e) => setCustomChecklistTitle(e.target.value)}
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddCustomChecklistItem}>
                  + Add Item
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 3: SET UP INITIAL RETAINER / FEE SCHEDULE
            ===================================================================== */}
        {activeStep === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "14px 16px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>
                  Step 3: Configure Initial Legal Retainer &amp; Trust Billing
                </strong>
                <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                  Syncs directly with Firm Billing Ledger and the client&apos;s Retainers &amp; Invoices tab.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
                {[
                  {
                    key: "issue_invoice" as const,
                    title: "Issue Stage-1 Invoice",
                    desc: "Client sees balance due in portal",
                  },
                  {
                    key: "mark_paid" as const,
                    title: "Retainer Already Paid",
                    desc: "Log paid receipt in firm ledger",
                  },
                  {
                    key: "skip" as const,
                    title: "Skip / External Billing",
                    desc: "Configure billing later",
                  },
                ].map((opt) => {
                  const selected = retainerMode === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setRetainerMode(opt.key)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: selected ? "1.5px solid #0D6866" : "1px solid #DCE5E1",
                        background: selected ? "#EAF6F0" : "#F8F7F2",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <strong style={{ fontSize: "12.5px", color: "#063C3D", display: "block" }}>
                        {opt.title}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#526360" }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {retainerMode !== "skip" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 160px", gap: "10px" }}>
                    <SelectInput
                      label="Currency"
                      value={retainerCurrency}
                      onChange={(e) => setRetainerCurrency(e.target.value)}
                      options={[
                        { label: "USD ($)", value: "USD" },
                        { label: "CAD (CA$)", value: "CAD" },
                        { label: "GBP (£)", value: "GBP" },
                        { label: "AUD (A$)", value: "AUD" },
                        { label: "EUR (€)", value: "EUR" },
                        { label: "INR (₹)", value: "INR" },
                      ]}
                    />
                    <TextInput
                      label="Stage-1 Retainer Amount"
                      type="number"
                      value={retainerAmount}
                      onChange={(e) => setRetainerAmount(e.target.value)}
                    />
                    <TextInput
                      label="Due Date"
                      type="date"
                      value={retainerDueDate}
                      onChange={(e) => setRetainerDueDate(e.target.value)}
                    />
                  </div>
                  <TextInput
                    label="Retainer Line-Item Description"
                    value={retainerDescription}
                    onChange={(e) => setRetainerDescription(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 4: UPLOAD INITIAL COUNSEL DOCUMENTS OR OPEN CASE WORKSPACE
            ===================================================================== */}
        {activeStep === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "14px 16px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>
                  Step 4: Upload Initial Counsel Records &amp; Launch Case Workspace
                </strong>
                <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                  Attach any files already on hand (such as {pathwayConfig.representationFormLabel} or passport bio-page), or jump straight into the live case dossier.
                </span>
              </div>

              <div
                style={{
                  padding: "12px",
                  background: "#F8F7F2",
                  border: "1px dashed #B9DED4",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ minWidth: "210px", flex: 1 }}>
                    <SelectInput
                      label="Document Category for Upload"
                      value={selectedDocCategory}
                      onChange={(e) => setSelectedDocCategory(e.target.value)}
                      options={[
                        { label: "Representation Form (G-28 / IMM 5476 / 956)", value: "government_correspondence" },
                        { label: "Passport & Identity Biodata", value: "identity_passport" },
                        { label: "Educational / Credential Record", value: "educational_records" },
                        { label: "Employment / Sponsor Record", value: "employment_records" },
                        { label: "Financial / Retainer Evidence", value: "financial_evidence" },
                      ]}
                    />
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "6px",
                      background: "#FFFFFF",
                      border: "1px solid #0D6866",
                      color: "#063C3D",
                      fontSize: "12.5px",
                      fontWeight: 650,
                      cursor: "pointer",
                      height: "36px",
                      boxSizing: "border-box",
                    }}
                  >
                    <span>📎 Upload PDF / Scan from Computer</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleDiskFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      handleQuickUploadFile(
                        `Executed_${pathwayConfig.representationFormLabel.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`,
                        "government_correspondence",
                        "0.42 MB"
                      )
                    }
                    disabled={isBusy}
                  >
                    + Log Executed {pathwayConfig.representationFormLabel.split("—")[0].trim()}
                  </Button>
                </div>

                {uploadedFilesInSession.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                    {uploadedFilesInSession.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          fontSize: "12px",
                          color: "#176B50",
                          fontWeight: 600,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>✓ {doc.title}</span>
                        <span>{doc.file_size}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kickoff Summary Ledger */}
              <div
                style={{
                  padding: "10px 12px",
                  background: "#F1F6F4",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "8px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <strong style={{ color: "#063C3D" }}>Portal Access:</strong>{" "}
                  <span style={{ color: "#445451" }}>
                    {kickoffProgress.record?.step1CredentialsShared
                      ? "Shared with client"
                      : hasPortalCredentials
                        ? "Active (ready to send)"
                        : "Pending"}
                  </span>
                </div>
                <div>
                  <strong style={{ color: "#063C3D" }}>Officer &amp; Checklist:</strong>{" "}
                  <span style={{ color: "#445451" }}>
                    {kickoffProgress.record?.step2ChecklistDispatched
                      ? `${kickoffProgress.record.assignedOfficer} (${kickoffProgress.record.dispatchedChecklistCount || 0} items)`
                      : "Pending dispatch"}
                  </span>
                </div>
                <div>
                  <strong style={{ color: "#063C3D" }}>Retainer Billing:</strong>{" "}
                  <span style={{ color: "#445451" }}>
                    {kickoffProgress.record?.step3RetainerConfigured
                      ? kickoffProgress.record.retainerMode === "skipped"
                        ? "External / Skipped"
                        : `${kickoffProgress.record.retainerAmountLabel || ""} (${kickoffProgress.record.retainerMode})`
                      : "Pending"}
                  </span>
                </div>
                <div>
                  <strong style={{ color: "#063C3D" }}>Initial Vault Docs:</strong>{" "}
                  <span style={{ color: "#445451" }}>
                    {(kickoffProgress.record?.uploadedInitialDocCount || 0) > 0
                      ? `${kickoffProgress.record?.uploadedInitialDocCount} file(s) logged`
                      : "Awaiting uploads"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
