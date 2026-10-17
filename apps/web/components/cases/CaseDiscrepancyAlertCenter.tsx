"use client";

import React, { useState, useEffect } from "react";
import { AIFinding, RouteFindingPayload, ApprovedRequestTemplate } from "../../lib/types";
import { api, draftClientRequest, getApprovedRequestTemplates } from "../../lib/api";

interface CaseDiscrepancyAlertCenterProps {
  caseId: string;
  findings: AIFinding[];
  onResolveFinding?: (findingId: string, note: string) => Promise<void>;
  onEscalateFinding?: (findingId: string, note: string) => Promise<void>;
  onRouteFinding?: (findingId: string, payload: RouteFindingPayload) => Promise<void>;
  onInspectDocument?: (docId: string) => void;
  currentUserRole?: string;
}

export function CaseDiscrepancyAlertCenter({
  caseId,
  findings,
  onResolveFinding,
  onEscalateFinding,
  onRouteFinding,
  onInspectDocument,
}: CaseDiscrepancyAlertCenterProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>("");
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [escalationNote, setEscalationNote] = useState<string>(
    "Escalated for senior immigration counsel legal disposition review."
  );
  const [routingId, setRoutingId] = useState<string | null>(null);
  const [routeOwnerUserId, setRouteOwnerUserId] = useState<string>("");
  const [routeNote, setRouteNote] = useState<string>("");
  const [routeDueDate, setRouteDueDate] = useState<string>("");
  const [routeClientTemplate, setRouteClientTemplate] = useState<string>("");
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Phase 10: Approved client request drafting
  const [draftingFindingId, setDraftingFindingId] = useState<string | null>(null);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>("NAME_DISCREPANCY_CLARIFICATION");
  const [draftInstructions, setDraftInstructions] = useState<string>("");
  const [draftDueDate, setDraftDueDate] = useState<string>("");
  const [draftSuccessNotice, setDraftSuccessNotice] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [approvedTemplates, setApprovedTemplates] = useState<ApprovedRequestTemplate[]>([]);

  useEffect(() => {
    getApprovedRequestTemplates()
      .then((templates) => {
        if (templates && templates.length > 0) {
          setApprovedTemplates(templates);
        }
      })
      .catch(() => {});
  }, []);

  // Filter discrepancies and contradictions for this case
  const caseDiscrepancies = findings.filter(
    (f) =>
      (f.case_id === caseId || !f.case_id) &&
      (f.finding_type === "consistency_discrepancy" ||
        f.finding_type === "direct_contradiction" ||
        f.category === "contradiction" ||
        f.category === "consistency" ||
        f.severity === "critical" ||
        f.severity === "major")
  );

  const activeDiscrepancies = caseDiscrepancies.filter((f) => f.status !== "resolved" && f.status !== "dismissed");
  const resolvedCount = caseDiscrepancies.filter((f) => f.status === "resolved").length;

  if (caseDiscrepancies.length === 0) {
    return (
      <div
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(6, 60, 61, 0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#DCFCE7",
              border: "1px solid #86EFAC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#166534",
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#166534" }}>
              Zero Cross-Document Discrepancies
            </span>
            <span style={{ fontSize: "13px", color: "#4B7268", marginLeft: "8px" }}>
              — All evidentiary records cross-match client profile.
            </span>
          </div>
        </div>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "20px",
            background: "#DCFCE7",
            color: "#166534",
            border: "1px solid #86EFAC",
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: 700,
          }}
        >
          ✓ Consistency Verified
        </span>
      </div>
    );
  }

  const handleStartResolve = (id: string) => {
    setResolvingId(id);
    setResolutionNote("");
    setEscalatingId(null);
    setRoutingId(null);
  };

  const handleConfirmResolve = async (findingId: string) => {
    if (!resolutionNote.trim()) return;
    setIsSubmitting(true);
    try {
      if (onResolveFinding) {
        await onResolveFinding(findingId, resolutionNote.trim());
      }
      setResolvingId(null);
      setResolutionNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEscalate = (finding: AIFinding) => {
    setEscalatingId(finding.id);
    setEscalationNote(
      "Major evidentiary concern escalated to senior immigration counsel for formal legal disposition under firm policy."
    );
    setResolvingId(null);
    setRoutingId(null);
  };

  const handleConfirmEscalate = async (findingId: string) => {
    setIsSubmitting(true);
    try {
      if (onEscalateFinding) {
        await onEscalateFinding(findingId, escalationNote.trim() || "Escalated for senior immigration counsel legal disposition review.");
      }
      setEscalatingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRoute = (finding: AIFinding) => {
    setRoutingId(finding.id);
    setRouteOwnerUserId(finding.owner_user_id || "senior_attorney");
    setRouteNote("");
    setRouteDueDate(finding.due_date ? finding.due_date.substring(0, 10) : "");
    setRouteClientTemplate(finding.client_facing_template || "");
    setResolvingId(null);
    setEscalatingId(null);
  };

  const handleConfirmRoute = async (findingId: string) => {
    if (!routeOwnerUserId.trim() || !routeNote.trim()) return;
    setIsSubmitting(true);
    try {
      const payload: RouteFindingPayload = {
        owner_user_id: routeOwnerUserId.trim(),
        note: routeNote.trim(),
        due_date: routeDueDate ? new Date(routeDueDate).toISOString() : undefined,
        client_facing_template: routeClientTemplate.trim() || undefined,
      };
      if (onRouteFinding) {
        await onRouteFinding(findingId, payload);
      } else {
        await api.routeFinding(caseId, findingId, payload);
      }
      setRoutingId(null);
    } catch (err) {
      console.error("Failed to route finding:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDraftRequest = (finding: AIFinding) => {
    setDraftingFindingId(finding.id);
    setResolvingId(null);
    setRoutingId(null);
    setEscalatingId(null);
    const initialTemplateCode =
      finding.finding_type === "identity_discrepancy" || finding.title?.toLowerCase().includes("passport")
        ? "PASSPORT_BIO_PAGE_UNCERTAINTY"
        : "NAME_DISCREPANCY_CLARIFICATION";
    setSelectedTemplateCode(initialTemplateCode);
    const tmpl = approvedTemplates.find((t) => t.template_code === initialTemplateCode);
    setDraftInstructions(finding.client_facing_template || tmpl?.default_instructions || "");
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (tmpl?.suggested_days_to_due || 7));
    setDraftDueDate(dueDate.toISOString().split("T")[0]);
    setDraftSuccessNotice(null);
  };

  const handleTemplateChange = (code: string) => {
    setSelectedTemplateCode(code);
    const tmpl = approvedTemplates.find((t) => t.template_code === code);
    if (tmpl) {
      setDraftInstructions(tmpl.default_instructions);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + tmpl.suggested_days_to_due);
      setDraftDueDate(dueDate.toISOString().split("T")[0]);
    }
  };

  const handleConfirmDraftRequest = async (findingId: string) => {
    setIsDrafting(true);
    try {
      const created = await draftClientRequest({
        case_id: caseId,
        template_code: selectedTemplateCode,
        finding_id: findingId,
        custom_instructions: draftInstructions,
        due_date: draftDueDate || undefined,
      });
      setDraftSuccessNotice(`Staff Draft Request created (ID: ${created.id.substring(0, 8)}...). Status: "draft" (private from client until staff approval).`);
      setTimeout(() => {
        setDraftingFindingId(null);
        setDraftSuccessNotice(null);
      }, 3500);
    } catch (err: any) {
      alert(err.message || "Failed to create draft request");
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: "14px",
        border: "1px solid #DCE5E1",
        background: "#FFFFFF",
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(6, 60, 61, 0.05)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Alert Header Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "14px 20px",
          background: activeDiscrepancies.length > 0 ? "#FFFBEB" : "#F8F7F2",
          borderBottom: "1px solid #DCE5E1",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: activeDiscrepancies.length > 0 ? "#D97706" : "#16A34A",
              boxShadow:
                activeDiscrepancies.length > 0
                  ? "0 0 0 3px rgba(217, 119, 6, 0.2)"
                  : "0 0 0 3px rgba(22, 163, 74, 0.2)",
              display: "inline-block",
            }}
          />
          <h4
            style={{
              margin: 0,
              fontWeight: 750,
              fontSize: "13px",
              color: "#063C3D",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Cross-Document Discrepancy & Consistency Audit
          </h4>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
              background: activeDiscrepancies.length > 0 ? "#FEF3C7" : "#EAF6F0",
              color: activeDiscrepancies.length > 0 ? "#92400E" : "#0D6866",
              border: activeDiscrepancies.length > 0 ? "1px solid #FCD34D" : "1px solid #B9DED4",
            }}
          >
            {activeDiscrepancies.length} Action Required
          </span>
          {resolvedCount > 0 && (
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 650,
                background: "#DCFCE7",
                color: "#166534",
                border: "1px solid #86EFAC",
              }}
            >
              {resolvedCount} Resolved
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#6E7F7C",
            fontWeight: 500,
            background: "#FFFFFF",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid #DCE5E1",
          }}
        >
          Evidence Grounded • Non-Binding Intelligence
        </div>
      </div>

      {/* Discrepancy Items List */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {caseDiscrepancies.map((finding) => {
          const isResolved = finding.status === "resolved";
          const isContradiction =
            finding.is_confirmed_contradiction ||
            finding.category === "contradiction" ||
            finding.finding_type === "direct_contradiction";
          const isExpanded = expandedFindingId === finding.id;
          const isResolving = resolvingId === finding.id;
          const isEscalating = escalatingId === finding.id;
          const isRouting = routingId === finding.id;
          const isDraftingFinding = draftingFindingId === finding.id;
          const isOverdue = finding.due_date ? new Date(finding.due_date).getTime() < Date.now() : false;

          let cardBg = "#FFFFFF";
          let borderLeftColor = "#D97706";
          let badgeBg = "#FEF3C7";
          let badgeColor = "#92400E";
          let badgeBorder = "#FCD34D";
          let badgeLabel = "ℹ️ Cross-Record Discrepancy";

          if (isResolved) {
            cardBg = "#F8FAF9";
            borderLeftColor = "#16A34A";
            badgeBg = "#DCFCE7";
            badgeColor = "#166534";
            badgeBorder = "#86EFAC";
            badgeLabel = "✓ RESOLVED";
          } else if (isContradiction) {
            cardBg = "#FFFDFD";
            borderLeftColor = "#DC2626";
            badgeBg = "#FEE2E2";
            badgeColor = "#991B1B";
            badgeBorder = "#FECACA";
            badgeLabel = "⚠️ Evidence Contradiction";
          }

          return (
            <div
              key={finding.id}
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #EAEFEA",
                borderLeft: `4px solid ${borderLeftColor}`,
                background: cardBg,
                transition: "background 0.15s ease",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* Top Row: Badges, Title, Action Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "280px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`,
                      }}
                    >
                      {badgeLabel}
                    </span>

                    {/* Owner User Badge */}
                    {finding.owner_user_id && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 650,
                          borderRadius: "6px",
                          background: "#F1F5F9",
                          color: "#334155",
                          border: "1px solid #CBD5E1",
                        }}
                      >
                        👤 Owner: {finding.owner_user_id}
                      </span>
                    )}

                    {/* Due Date Chip */}
                    {finding.due_date && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          borderRadius: "6px",
                          background: isOverdue ? "#FEE2E2" : "#EFF6FF",
                          color: isOverdue ? "#991B1B" : "#1D4ED8",
                          border: isOverdue ? "1px solid #FECACA" : "1px solid #BFDBFE",
                        }}
                      >
                        📅 Due: {new Date(finding.due_date).toLocaleDateString()}
                        {isOverdue && " (OVERDUE)"}
                      </span>
                    )}

                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#063C3D" }}>
                      {finding.title}
                    </span>
                  </div>

                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#445451", lineHeight: "1.5" }}>
                    {finding.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {!isResolved && !isResolving && !isEscalating && !isRouting && !isDraftingFinding && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartResolve(finding.id)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 650,
                          borderRadius: "6px",
                          background: "#EAF6F0",
                          color: "#0D6866",
                          border: "1px solid #B9DED4",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ✓ Resolve with Affidavit
                      </button>

                      <button
                        type="button"
                        data-testid={`draft-request-btn-${finding.id}`}
                        onClick={() => handleStartDraftRequest(finding)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 650,
                          borderRadius: "6px",
                          background: "#EEF2FF",
                          color: "#3730A3",
                          border: "1px solid #C7D2FE",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        📝 Draft Client Request
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartRoute(finding)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "6px",
                          background: "#F0FDF4",
                          color: "#166534",
                          border: "1px solid #86EFAC",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ↗ Route Issue
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEscalate(finding)}
                        disabled={isSubmitting}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "6px",
                          background: "#F8F7F2",
                          color: "#445451",
                          border: "1px solid #DCE5E1",
                          cursor: isSubmitting ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        Escalate
                      </button>
                    </>
                  )}

                  {/* Expand / Collapse Details */}
                  <button
                    type="button"
                    onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "12px",
                      color: "#0D6866",
                      fontWeight: 600,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {isExpanded ? "Hide Audit History ▲" : "View Audit History ▼"}
                  </button>
                </div>
              </div>

              {/* Evidentiary Reference Detail Card */}
              {finding.evidence_reference && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#475569", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        📑 Evidentiary Reference & Source Provenance
                      </span>
                      {finding.evidence_reference.document_id && (
                        <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748B" }}>
                          [Doc: {finding.evidence_reference.document_id.substring(0, 12)}...
                          {finding.evidence_reference.page !== undefined ? ` • Page ${finding.evidence_reference.page}` : ""}]
                        </span>
                      )}
                    </div>
                    {onInspectDocument && finding.evidence_reference.document_id && (
                      <button
                        type="button"
                        onClick={() => onInspectDocument(finding.evidence_reference!.document_id!)}
                        style={{
                          fontSize: "11px",
                          color: "#0D6866",
                          background: "#EAF6F0",
                          border: "1px solid #B9DED4",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Inspect Document
                      </button>
                    )}
                  </div>
                  {finding.evidence_reference.evidence_text && (
                    <div
                      style={{
                        color: "#1E293B",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        whiteSpace: "pre-wrap",
                        background: "#FFFFFF",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      "{finding.evidence_reference.evidence_text}"
                    </div>
                  )}
                </div>
              )}

              {/* Conflicting Evidence Snippets */}
              {finding.evidence_text && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F8F7F2",
                    border: "1px solid #E2EAE6",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#0D6866",
                      textTransform: "uppercase",
                      fontWeight: 750,
                      letterSpacing: "0.04em",
                      marginBottom: "4px",
                    }}
                  >
                    Evidentiary Grounding Comparison
                  </div>
                  <div
                    style={{
                      color: "#172322",
                      whiteSpace: "pre-line",
                      lineHeight: "1.5",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    {finding.evidence_text}
                  </div>
                </div>
              )}

              {/* Privileged Internal Risk Notes (Strictly Staff-Only) */}
              {finding.internal_risk_notes && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#FFF1F2",
                    border: "1px solid #FECDD3",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "#9F1239", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      🔒 PRIVILEGED INTERNAL FRAUD & RISK AUDIT
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        background: "#FFE4E6",
                        color: "#9F1239",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        border: "1px solid #FDA4AF",
                        fontWeight: 700,
                      }}
                    >
                      Staff Only — Not Shared with Client
                    </span>
                  </div>
                  <p style={{ margin: 0, color: "#881337", lineHeight: "1.5", fontSize: "12px" }}>
                    {finding.internal_risk_notes}
                  </p>
                  <div style={{ fontSize: "11px", color: "#9F1239", fontStyle: "italic", marginTop: "2px" }}>
                    Strict Compliance Rule: Internal fraud & risk notes are privileged work product. Discrepancies warrant objective clarification; do not declare statutory fraud or legal ineligibility without formal legal disposition.
                  </div>
                </div>
              )}

              {/* Pre-Approved Client Clarification Template */}
              {finding.client_facing_template && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#166534", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        ✉️ Pre-Approved Client Clarification Template
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#DCFCE7",
                          color: "#166534",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          border: "1px solid #86EFAC",
                          fontWeight: 700,
                        }}
                      >
                        Client Portal Ready
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleStartDraftRequest(finding)}
                        style={{
                          fontSize: "11px",
                          fontWeight: 650,
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "#EEF2FF",
                          border: "1px solid #C7D2FE",
                          color: "#3730A3",
                          cursor: "pointer",
                        }}
                      >
                        📝 Draft Formal Request
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (finding.client_facing_template) {
                            navigator.clipboard.writeText(finding.client_facing_template);
                            setCopiedTemplateId(finding.id);
                            setTimeout(() => setCopiedTemplateId(null), 2500);
                          }
                        }}
                        style={{
                          fontSize: "11px",
                          fontWeight: 650,
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "#FFFFFF",
                          border: "1px solid #86EFAC",
                          color: "#166534",
                          cursor: "pointer",
                        }}
                      >
                        {copiedTemplateId === finding.id ? "✓ Copied to Clipboard" : "📋 Copy Template"}
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      color: "#14532D",
                      background: "#FFFFFF",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #DCFCE7",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {finding.client_facing_template}
                  </div>
                </div>
              )}

              {/* Recommended Legal Strategy */}
              {finding.recommended_action && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#063C3D",
                    background: "#F1F6F4",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#0D6866", flexShrink: 0 }}>
                    Recommended Action:
                  </span>
                  <span style={{ color: "#172322" }}>{finding.recommended_action}</span>
                </div>
              )}

              {/* Inline Resolution Drawer */}
              {isResolving && (
                <div
                  style={{
                    marginTop: "6px",
                    padding: "16px",
                    background: "#FFFBEB",
                    border: "1.5px solid #FCD34D",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#92400E" }}>
                      Record Discrepancy Resolution & Legal Rationale
                    </span>
                    <button
                      type="button"
                      onClick={() => setResolvingId(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6E7F7C",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Mandatory Phase 5 Legal Policy Notice */}
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#FEF3C7",
                      border: "1px solid #FCD34D",
                      fontSize: "12px",
                      color: "#92400E",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      lineHeight: "1.4",
                    }}
                  >
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                    <div>
                      <strong>Policy Notice:</strong> Resolving this compliance finding clears the alert but{" "}
                      <strong>DOES NOT</strong> automatically make the document package-eligible. Mandatory compliance checks will re-run automatically during assembly.
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="e.g., Client executed name transliteration affidavit conforming with USCIS Form G-28..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #FCD34D",
                      background: "#FFFFFF",
                      color: "#172322",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />

                  {/* Quick-fill template chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[
                      "Client executed sworn name affidavit",
                      "Standardized transliteration matches passport bio",
                      "Evidence clarification letter drafted for exhibit index",
                      "Certified translation reconciles spelling variant",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setResolutionNote(chip)}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "#FEF3C7",
                          color: "#92400E",
                          border: "1px solid #FDE68A",
                          cursor: "pointer",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setResolvingId(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #DCE5E1",
                        color: "#445451",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmResolve(finding.id)}
                      disabled={isSubmitting || !resolutionNote.trim()}
                      style={{
                        padding: "6px 16px",
                        fontSize: "12px",
                        fontWeight: 650,
                        borderRadius: "6px",
                        background: "#0D6866",
                        color: "#FFFFFF",
                        border: "none",
                        cursor: isSubmitting || !resolutionNote.trim() ? "not-allowed" : "pointer",
                        opacity: isSubmitting || !resolutionNote.trim() ? 0.6 : 1,
                      }}
                    >
                      {isSubmitting ? "Recording..." : "Save Resolution & Sign Off"}
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Route / Reassign Issue Drawer */}
              {isRouting && (
                <div
                  style={{
                    marginTop: "6px",
                    padding: "16px",
                    background: "#F0FDF4",
                    border: "1.5px solid #86EFAC",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#166534" }}>
                      Route / Reassign Compliance Issue (Firm Policy)
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoutingId(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6E7F7C",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#DCFCE7",
                      border: "1px solid #86EFAC",
                      fontSize: "12px",
                      color: "#166534",
                      lineHeight: "1.4",
                    }}
                  >
                    <strong>Policy Standard:</strong> Authorized immigration officers, managers, or lawyers may route and reassign compliance issues. Major evidentiary concerns must be escalated before client contact; never guarantee refusal or ban outcomes.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#166534", marginBottom: "4px" }}>
                        Assignee User ID / Role:
                      </label>
                      <input
                        type="text"
                        value={routeOwnerUserId}
                        onChange={(e) => setRouteOwnerUserId(e.target.value)}
                        placeholder="e.g. senior_attorney, compliance_lead"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "1px solid #86EFAC",
                          background: "#FFFFFF",
                          color: "#172322",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#166534", marginBottom: "4px" }}>
                        Due Date (Optional):
                      </label>
                      <input
                        type="date"
                        value={routeDueDate}
                        onChange={(e) => setRouteDueDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "1px solid #86EFAC",
                          background: "#FFFFFF",
                          color: "#172322",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#166534", marginBottom: "4px" }}>
                      Routing Note / Instructions:
                    </label>
                    <textarea
                      rows={2}
                      value={routeNote}
                      onChange={(e) => setRouteNote(e.target.value)}
                      placeholder="e.g. Routed to senior counsel for statutory eligibility verification under INA 204..."
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid #86EFAC",
                        background: "#FFFFFF",
                        color: "#172322",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {/* Preset routing shortcuts */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[
                      { role: "senior_attorney", note: "Assign for senior attorney legal assessment" },
                      { role: "compliance_officer", note: "Route to compliance officer for high-risk verification" },
                      { role: "paralegal_lead", note: "Request applicant outreach and clarification from paralegal" },
                    ].map((preset) => (
                      <button
                        key={preset.role}
                        type="button"
                        onClick={() => {
                          setRouteOwnerUserId(preset.role);
                          setRouteNote(preset.note);
                        }}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "#DCFCE7",
                          color: "#166534",
                          border: "1px solid #86EFAC",
                          cursor: "pointer",
                        }}
                      >
                        + {preset.role}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#166534", marginBottom: "4px" }}>
                      Client-Facing Clarification Template (Optional):
                    </label>
                    <textarea
                      rows={2}
                      value={routeClientTemplate}
                      onChange={(e) => setRouteClientTemplate(e.target.value)}
                      placeholder="e.g. Dear Client, during document intake we noted a discrepancy in spelling..."
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid #86EFAC",
                        background: "#FFFFFF",
                        color: "#172322",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setRoutingId(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #DCE5E1",
                        color: "#445451",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmRoute(finding.id)}
                      disabled={isSubmitting || !routeOwnerUserId.trim() || !routeNote.trim()}
                      style={{
                        padding: "6px 16px",
                        fontSize: "12px",
                        fontWeight: 650,
                        borderRadius: "6px",
                        background: "#0D6866",
                        color: "#FFFFFF",
                        border: "none",
                        cursor: isSubmitting || !routeOwnerUserId.trim() || !routeNote.trim() ? "not-allowed" : "pointer",
                        opacity: isSubmitting || !routeOwnerUserId.trim() || !routeNote.trim() ? 0.6 : 1,
                      }}
                    >
                      {isSubmitting ? "Routing..." : "Confirm & Reassign Issue"}
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Escalation Drawer */}
              {isEscalating && (
                <div
                  style={{
                    marginTop: "6px",
                    padding: "16px",
                    background: "#FEF2F2",
                    border: "1.5px solid #F87171",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#991B1B" }}>
                      Escalate Discrepancy to Senior Immigration Counsel
                    </span>
                    <button
                      type="button"
                      onClick={() => setEscalatingId(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6E7F7C",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Mandatory Escalation Policy Notice */}
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#FEE2E2",
                      border: "1px solid #FECACA",
                      fontSize: "12px",
                      color: "#991B1B",
                      lineHeight: "1.4",
                    }}
                  >
                    <strong>Escalation Policy:</strong> Major concerns are escalated before client contact under firm policy. Reviewers must never guarantee refusal, denial, or statutory ineligibility outcomes to clients.
                  </div>

                  <textarea
                    rows={2}
                    value={escalationNote}
                    onChange={(e) => setEscalationNote(e.target.value)}
                    placeholder="Enter escalation justification and specific evidence concerns..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #F87171",
                      background: "#FFFFFF",
                      color: "#172322",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setEscalatingId(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #DCE5E1",
                        color: "#445451",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmEscalate(finding.id)}
                      disabled={isSubmitting}
                      style={{
                        padding: "6px 16px",
                        fontSize: "12px",
                        fontWeight: 650,
                        borderRadius: "6px",
                        background: "#DC2626",
                        color: "#FFFFFF",
                        border: "none",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                      }}
                    >
                      {isSubmitting ? "Escalating..." : "Confirm Escalation"}
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Draft Client Request Drawer (Phase 10 Staff Review Workflow) */}
              {isDraftingFinding && (
                <div
                  data-testid="draft-client-request-drawer"
                  style={{
                    marginTop: "8px",
                    padding: "16px",
                    background: "#F5F3FF",
                    border: "1.5px solid #DDD6FE",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>📝</span>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#4C1D95" }}>
                        Draft Client Request from Approved Regulatory Template
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#EDE9FE",
                          color: "#5B21B6",
                          border: "1px solid #C4B5FD",
                        }}
                      >
                        Requires Staff Review Before Send
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftingFindingId(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6B7280",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {draftSuccessNotice && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        background: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                        color: "#065F46",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      ✓ {draftSuccessNotice}
                    </div>
                  )}

                  {/* Guardrail Callout */}
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#EDE9FE",
                      border: "1px solid #DDD6FE",
                      fontSize: "11px",
                      color: "#4C1D95",
                      lineHeight: "1.4",
                    }}
                  >
                    <strong>Phase 10 Privacy Guardrail:</strong> Internal fraud & risk notes remain strictly private. The draft will be generated in <code>draft</code> status, hidden from the client portal until an authorized staff member explicitly reviews and authorizes dispatch.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#4C1D95", marginBottom: "4px" }}>
                        Select Approved Regulatory Template:
                      </label>
                      <select
                        value={selectedTemplateCode}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "1px solid #C4B5FD",
                          background: "#FFFFFF",
                          color: "#1F2937",
                        }}
                      >
                        {approvedTemplates.map((t) => (
                          <option key={t.template_code} value={t.template_code}>
                            {t.title} ({t.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#4C1D95", marginBottom: "4px" }}>
                        Response Due Date:
                      </label>
                      <input
                        type="date"
                        value={draftDueDate}
                        onChange={(e) => setDraftDueDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "1px solid #C4B5FD",
                          background: "#FFFFFF",
                          color: "#1F2937",
                        }}
                      />
                    </div>
                  </div>

                  {/* Legal context of active template */}
                  {(() => {
                    const activeTmpl = approvedTemplates.find((t) => t.template_code === selectedTemplateCode);
                    if (!activeTmpl) return null;
                    return (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#5B21B6",
                          background: "#FFFFFF",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #E9D5FF",
                        }}
                      >
                        <strong>Statutory Context:</strong> {activeTmpl.legal_context} • <strong>Reviewer Role:</strong> {activeTmpl.required_review_role}
                      </div>
                    );
                  })()}

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#4C1D95", marginBottom: "4px" }}>
                      Draft Instructions for Client (Editable prior to creation):
                    </label>
                    <textarea
                      rows={3}
                      value={draftInstructions}
                      onChange={(e) => setDraftInstructions(e.target.value)}
                      placeholder="Enter specific instructions for the client..."
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid #C4B5FD",
                        background: "#FFFFFF",
                        color: "#1F2937",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setDraftingFindingId(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        color: "#4B5563",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmDraftRequest(finding.id)}
                      disabled={isDrafting || !draftInstructions.trim()}
                      style={{
                        padding: "6px 16px",
                        fontSize: "12px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        background: "#4338CA",
                        color: "#FFFFFF",
                        border: "none",
                        cursor: isDrafting || !draftInstructions.trim() ? "not-allowed" : "pointer",
                        opacity: isDrafting || !draftInstructions.trim() ? 0.6 : 1,
                      }}
                    >
                      {isDrafting ? "Drafting..." : "Create Staff Draft Request"}
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Resolution Audit Trail */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "8px",
                    paddingTop: "10px",
                    borderTop: "1px solid #EAEFEA",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#6E7F7C",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Discrepancy Audit Trail
                  </div>
                  {finding.resolution_history && finding.resolution_history.length > 0 ? (
                    finding.resolution_history.map((hist, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#F8F7F2",
                          border: "1px solid #DCE5E1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>
                            {hist.action}:
                          </span>{" "}
                          <span style={{ color: "#172322" }}>{hist.note || hist.reason}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#6E7F7C", fontFamily: "monospace" }}>
                          {hist.reviewer_email || "Counsel"} • {new Date(hist.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "12px", color: "#6E7F7C", fontStyle: "italic" }}>
                      No prior resolution events recorded. Finding currently in initial flagged status.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
