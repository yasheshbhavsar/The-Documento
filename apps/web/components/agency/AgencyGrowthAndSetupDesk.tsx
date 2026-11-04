"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserContext } from "../../lib/types";
import {
  AGENCY_PLAN_SPECS,
  AgencyKybApplication,
  AgencySupportTicket,
  AgencyTeamInviteRecord,
  AgencyTenantRecord,
  CalculatorAgencyLeadRecord,
  KybDocType,
  SOVEREIGN_CORRIDORS,
  StatutoryRuleBroadcast,
  buildKybUploadedDocMeta,
  createAgencySupportTicket,
  getAgencyApplications,
  getAgencyForOrganization,
  getAgencySupportTickets,
  getAgencyTeamInvites,
  getCalculatorAgencyLeads,
  getStatutoryRuleBroadcasts,
  inviteAgencyTeamMember,
  markCalculatorLeadStatus,
  saveAgencyDay0Setup,
  toggleBreakGlassSupportGrant,
  uploadKybDocumentToApplication,
} from "../../lib/agencyPlatformStore";

interface AgencyGrowthAndSetupDeskProps {
  currentUser?: UserContext;
  onOpenCreateClient?: () => void;
  onConvertLeadToClient?: (lead: CalculatorAgencyLeadRecord) => void;
}

export function AgencyGrowthAndSetupDesk({
  currentUser,
  onOpenCreateClient,
  onConvertLeadToClient,
}: AgencyGrowthAndSetupDeskProps) {
  const organizationId = currentUser?.organization_id || "ten-vanguard";
  const [agency, setAgency] = useState<AgencyTenantRecord | null>(null);
  const [sandboxApp, setSandboxApp] = useState<AgencyKybApplication | null>(null);
  const [leads, setLeads] = useState<CalculatorAgencyLeadRecord[]>([]);
  const [teamInvites, setTeamInvites] = useState<AgencyTeamInviteRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<AgencySupportTicket[]>([]);
  const [ruleBroadcasts, setRuleBroadcasts] = useState<StatutoryRuleBroadcast[]>([]);

  // Branding & Corridor Setup State
  const [tradingNameDraft, setTradingNameDraft] = useState<string>("");
  const [taglineDraft, setTaglineDraft] = useState<string>("");
  const [bookingUrlDraft, setBookingUrlDraft] = useState<string>("");
  const [whatsappDraft, setWhatsappDraft] = useState<string>("");
  const [primaryColorDraft, setPrimaryColorDraft] = useState<string>("#063C3D");
  const [cobrandedEnabledDraft, setCobrandedEnabledDraft] = useState<boolean>(true);
  const [corridorsDraft, setCorridorsDraft] = useState<string[]>(["CA"]);

  // In-Workspace KYB Certificate Upload State (for 14-day trial agencies)
  const [kybUploadType, setKybUploadType] = useState<KybDocType>("practitioner_license");

  // Staff Invite State
  const [staffNameDraft, setStaffNameDraft] = useState<string>("");
  const [staffEmailDraft, setStaffEmailDraft] = useState<string>("");
  const [staffRoleDraft, setStaffRoleDraft] = useState<"case_manager" | "paralegal">("paralegal");
  const [staffBranchDraft, setStaffBranchDraft] = useState<string>("");
  const [staffError, setStaffError] = useState<string | null>(null);

  // Support Desk & Break-Glass Token State
  const [ticketCategoryDraft, setTicketCategoryDraft] =
    useState<AgencySupportTicket["category"]>("ocr_pipeline");
  const [ticketSubjectDraft, setTicketSubjectDraft] = useState<string>("");
  const [ticketMessageDraft, setTicketMessageDraft] = useState<string>("");
  const [ticketAttachGrantDraft, setTicketAttachGrantDraft] = useState<boolean>(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const [supportReasonDraft, setSupportReasonDraft] = useState<string>(
    "Diagnostic review of OCR pipeline & checklist rule mapping"
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const reloadState = () => {
    const record = getAgencyForOrganization(organizationId);
    setAgency(record);

    const cleanSlug = organizationId.replace(/^(sandbox-|ten-)/, "");
    const matchingApp =
      getAgencyApplications().find(
        (a) => a.requestedSlug === cleanSlug || a.provisionedOrganizationId === organizationId
      ) || null;
    setSandboxApp(matchingApp);

    if (record) {
      setTradingNameDraft(record.tradingName);
      setTaglineDraft(record.branding.tagline);
      setBookingUrlDraft(record.branding.consultationBookingUrl || "");
      setWhatsappDraft(record.branding.whatsappNumber || "");
      setPrimaryColorDraft(record.branding.primaryColor || "#063C3D");
      setCobrandedEnabledDraft(record.featureFlags.cobranded_calculators);
      setCorridorsDraft(record.enabledCorridors);
      setLeads(getCalculatorAgencyLeads(record.organizationId));
      setTeamInvites(getAgencyTeamInvites(record.organizationId));
      setSupportTickets(getAgencySupportTickets(record.organizationId));
      setRuleBroadcasts(getStatutoryRuleBroadcasts(record.enabledCorridors));
    }
  };

  useEffect(() => {
    reloadState();
  }, [organizationId]);

  if (!agency) {
    return (
      <div
        style={{
          padding: "24px",
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#445451",
        }}
      >
        Loading agency workspace configuration...
      </div>
    );
  }

  const cobrandedPath = `/calculators?agency=${agency.slug}`;
  const fullCobrandedUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${cobrandedPath}`
      : `https://thedocumento.com${cobrandedPath}`;

  const planSpec = AGENCY_PLAN_SPECS[agency.planTier];
  const newLeadsCount = leads.filter((l) => l.leadStatus === "new_lead").length;
  const contactedLeadsCount = leads.filter((l) => l.leadStatus === "contacted").length;
  const convertedLeadsCount = leads.filter((l) => l.leadStatus === "converted_to_client").length;

  // 4-Step Practical Launchpad Progress
  const stepBrandDone = Boolean(agency.branding.setupCompleted || agency.branding.consultationBookingUrl);
  const stepCorridorsDone = agency.enabledCorridors.length > 0;
  const uploadedKybDocs = sandboxApp?.uploadedDocuments || [];
  const stepKybDone = !currentUser?.is_sandbox_agency || uploadedKybDocs.length > 0;
  const stepTeamDone = agency.seatsUsed > 1 || teamInvites.length > 0;
  const completedStepsCount = [stepBrandDone, stepCorridorsDone, stepKybDone, stepTeamDone].filter(
    Boolean
  ).length;

  const handleToggleCorridor = (code: string) => {
    setCorridorsDraft((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const handleSaveSetup = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveAgencyDay0Setup(agency.organizationId, {
      tradingName: tradingNameDraft,
      tagline: taglineDraft,
      primaryColor: primaryColorDraft,
      cobrandedCalculatorsEnabled: cobrandedEnabledDraft,
      enabledCorridors: corridorsDraft,
      consultationBookingUrl: bookingUrlDraft,
      whatsappNumber: whatsappDraft,
    });
    if (updated) {
      reloadState();
      setSaveNotice(
        "Saved agency brand, consultation booking link, and active destination visa checklists."
      );
      setTimeout(() => setSaveNotice(null), 4000);
    }
  };

  const handleWorkspaceKybFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const meta = buildKybUploadedDocMeta(kybUploadType, file);
    const updatedApp = uploadKybDocumentToApplication(organizationId, meta);
    if (updatedApp) {
      setSandboxApp(updatedApp);
      setSaveNotice(
        `Uploaded ${file.name} (${meta.fileSizeKb} KB) to Documento HQ Verification Desk.`
      );
      setTimeout(() => setSaveNotice(null), 4000);
    }
    e.target.value = "";
  };

  const handleInviteStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    try {
      const invite = inviteAgencyTeamMember({
        organizationId: agency.organizationId,
        fullName: staffNameDraft,
        email: staffEmailDraft,
        role: staffRoleDraft,
        branchOffice: staffBranchDraft || agency.hqCity,
      });
      setStaffNameDraft("");
      setStaffEmailDraft("");
      setStaffBranchDraft("");
      reloadState();
      setSaveNotice(
        `Invited ${invite.fullName} (${invite.email}) — temporary passcode ${invite.passcode} active.`
      );
      setTimeout(() => setSaveNotice(null), 5000);
    } catch (err: any) {
      setStaffError(err?.message || "Unable to invite team member.");
    }
  };

  const handleSubmitSupportTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);
    try {
      const ticket = createAgencySupportTicket({
        organizationId: agency.organizationId,
        requesterEmail: currentUser?.email || agency.ownerEmail,
        category: ticketCategoryDraft,
        subject: ticketSubjectDraft,
        message: ticketMessageDraft,
        attachBreakGlassToken: ticketAttachGrantDraft,
      });
      setTicketSubjectDraft("");
      setTicketMessageDraft("");
      setTicketAttachGrantDraft(false);
      reloadState();
      setSaveNotice(`Support request ${ticket.ticketCode} sent to Documento HQ.`);
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: any) {
      setTicketError(err?.message || "Unable to submit support request.");
    }
  };

  const handleCopyUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullCobrandedUrl).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleLeadStatusChange = (
    lead: CalculatorAgencyLeadRecord,
    nextStatus: CalculatorAgencyLeadRecord["leadStatus"],
    openClientModal: boolean = false
  ) => {
    if (openClientModal && currentUser?.is_sandbox_agency) {
      if (onConvertLeadToClient) {
        onConvertLeadToClient(lead);
      } else if (onOpenCreateClient) {
        onOpenCreateClient();
      }
      return;
    }
    markCalculatorLeadStatus(lead.id, nextStatus);
    setLeads(getCalculatorAgencyLeads(agency.organizationId));
    if (openClientModal) {
      if (onConvertLeadToClient) {
        onConvertLeadToClient(lead);
      } else if (onOpenCreateClient) {
        onOpenCreateClient();
      }
    }
  };

  const handleToggleBreakGlass = (enable: boolean) => {
    const updated = toggleBreakGlassSupportGrant(
      agency.organizationId,
      enable,
      supportReasonDraft.trim() || "Diagnostic workflow inspection requested by Managing Partner",
      currentUser?.email || agency.ownerEmail
    );
    if (updated) {
      setAgency(updated);
      setSaveNotice(
        enable
          ? "Issued time-boxed 2-hour diagnostic token to Documento HQ Support."
          : "Immediately revoked Documento HQ diagnostic support token."
      );
      setTimeout(() => setSaveNotice(null), 4000);
    }
  };

  return (
    <div
      data-testid="agency-growth-setup-desk"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* 14-Day Trial / Pending KYB Banner + In-App Certificate Uploader */}
      {currentUser?.is_sandbox_agency && (
        <div
          data-testid="agency-sandbox-kyb-banner"
          style={{
            padding: "16px 20px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "13.5px", fontWeight: 750, color: "#92400E" }}>
                14-Day Partner Trial Active • Pending License / Trade Certificate Verification
              </div>
              <div style={{ fontSize: "12.5px", color: "#78350F", marginTop: "3px", maxWidth: "780px" }}>
                Your workspace for <strong>{agency.tradingName}</strong> is live for branding, checklist customization, and team setup. Live client passport uploads and public co-branded lead capture unlock automatically as soon as Documento HQ verifies your registration.
              </div>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                background: "#FEF3C7",
                color: "#92400E",
                border: "1px solid #FCD34D",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {sandboxApp?.kybStatus === "clarification_requested"
                ? "Clarification Requested"
                : "KYB Under Review"}
            </span>
          </div>

          {/* Inline Certificate Upload Bar inside Workspace */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              padding: "10px 12px",
              background: "#FFFFFF",
              border: "1px solid #FCD34D",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#445451" }}>
              <strong>Uploaded Proof ({uploadedKybDocs.length}):</strong>{" "}
              {uploadedKybDocs.length === 0
                ? "No certificate uploaded yet — attach your practitioner license or business registration below."
                : uploadedKybDocs.map((d) => `${d.fileName} (${d.fileSizeKb} KB)`).join(" · ")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <select
                aria-label="Verification document type"
                value={kybUploadType}
                onChange={(e) => setKybUploadType(e.target.value as KybDocType)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "12px",
                  background: "#FFFFFF",
                }}
              >
                <option value="practitioner_license">Practitioner License / Certificate</option>
                <option value="business_registration">Business Registration / Incorporation</option>
                <option value="principal_id">Principal Photo ID</option>
              </select>
              <label
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "#063C3D",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Upload Certificate PDF/JPG
                <input
                  type="file"
                  data-testid="workspace-kyb-file-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleWorkspaceKybFileChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {saveNotice && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            background: "#EAF6F0",
            border: "1px solid #B9DED4",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#063C3D",
          }}
        >
          {saveNotice}
        </div>
      )}

      {/* Practical 4-Step Agency Launchpad Strip */}
      <section
        data-testid="agency-launchpad-checklist"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "10px",
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 750, color: "#063C3D" }}>
              Agency Launchpad — Get Ready for Live Clients
            </h3>
            <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "2px" }}>
              Practical setup steps for {agency.tradingName} ({agency.hqCity}, {agency.hqCountry})
            </div>
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "6px",
              background: completedStepsCount === 4 ? "#EAF6F0" : "#F4F8F6",
              color: "#063C3D",
              border: "1px solid #DCE5E1",
            }}
          >
            {completedStepsCount} / 4 Completed
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            {
              done: stepBrandDone,
              title: "1. Brand & Booking URL",
              desc: agency.branding.consultationBookingUrl
                ? "Consultation booking CTA active"
                : "Add Calendly / booking link below",
            },
            {
              done: stepCorridorsDone,
              title: "2. Destination Checklists",
              desc: `${agency.enabledCorridors.join(", ")} statutory packs enabled`,
            },
            {
              done: stepKybDone,
              title: "3. License / KYB Proof",
              desc: !currentUser?.is_sandbox_agency
                ? `Verified (${agency.regulatoryBody})`
                : `${uploadedKybDocs.length} verification file(s) attached`,
            },
            {
              done: stepTeamDone,
              title: "4. Paralegals & Staff",
              desc: `${agency.seatsUsed} of ${agency.seatLimit} team seats active`,
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: `1px solid ${item.done ? "#B9DED4" : "#DCE5E1"}`,
                background: item.done ? "#F4FBF8" : "#F8FAF9",
              }}
            >
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#063C3D" }}>
                {item.done ? "✓ " : "○ "}
                {item.title}
              </div>
              <div style={{ fontSize: "11.5px", color: "#526360", marginTop: "3px" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Reconciled Partner Quota & Lead Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Partner Plan &amp; Registration
          </div>
          <div style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginTop: "6px" }}>
            {planSpec.label}
          </div>
          <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
            {agency.regulatoryBody} • {agency.licenseNumber}
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Team Seats &amp; Case Quotas
          </div>
          <div style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginTop: "6px" }}>
            {agency.seatsUsed} / {agency.seatLimit} Seats
          </div>
          <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
            {agency.casesActiveCount} / {agency.monthlyCaseQuota} Monthly Cases
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Co-Branded Calculator Leads
          </div>
          <div style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginTop: "6px" }}>
            {leads.length} Captured ({newLeadsCount} Unread)
          </div>
          <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
            {contactedLeadsCount} Contacted • {convertedLeadsCount} Retained
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Client File Privacy
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 750,
              color: agency.supportGrantActive ? "#B45309" : "#176B50",
              marginTop: "6px",
            }}
          >
            {agency.supportGrantActive ? "2h Support Token Active" : "Private to Your Firm"}
          </div>
          <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px" }}>
            {agency.supportGrantActive && agency.supportGrantExpiresAt
              ? `Expires ${new Date(agency.supportGrantExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Client passports & notes hidden from HQ"}
          </div>
        </div>
      </div>

      {/* Co-Branded PR Calculator Lead Link Card */}
      <section
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "10px",
          padding: "20px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            marginBottom: "14px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
              Your Co-Branded PR &amp; Skilled Migration Calculator Link
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#445451", maxWidth: "740px" }}>
              Embed this link on your website, Instagram bio, or WhatsApp auto-reply. Prospective clients calculate their Canada CRS/PNP, Australia SkillSelect, NZ SMC, UK 70-Pt, or Germany Chancenkarte points under your firm&apos;s banner and send their scorecard straight to your inbox below.
            </p>
          </div>
          <span
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "6px",
              background:
                !currentUser?.is_sandbox_agency && agency.featureFlags.cobranded_calculators
                  ? "#EAF6F0"
                  : "#FEF3C7",
              color:
                !currentUser?.is_sandbox_agency && agency.featureFlags.cobranded_calculators
                  ? "#176B50"
                  : "#92400E",
              border: `1px solid ${
                !currentUser?.is_sandbox_agency && agency.featureFlags.cobranded_calculators
                  ? "#B9DED4"
                  : "#FCD34D"
              }`,
            }}
          >
            {currentUser?.is_sandbox_agency
              ? "Activates Upon KYB Approval"
              : agency.featureFlags.cobranded_calculators
                ? "Live Lead Capture Active"
                : "Lead Capture Paused"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            padding: "10px 14px",
            background: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "8px",
          }}
        >
          <code
            data-testid="cobranded-calculator-url"
            style={{
              flex: 1,
              minWidth: "240px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#063C3D",
              wordBreak: "break-all",
            }}
          >
            {fullCobrandedUrl}
          </code>
          <button
            type="button"
            onClick={handleCopyUrl}
            style={{
              padding: "8px 14px",
              borderRadius: "7px",
              border: "1px solid #063C3D",
              background: "#063C3D",
              color: "#FFFFFF",
              fontSize: "12.5px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            {copiedLink ? "Copied Partner URL ✓" : "Copy Co-Branded Link"}
          </button>
          <Link
            href={cobrandedPath}
            style={{
              padding: "8px 14px",
              borderRadius: "7px",
              border: "1px solid #B9DED4",
              background: "#FFFFFF",
              color: "#0D6866",
              fontSize: "12.5px",
              fontWeight: 650,
              textDecoration: "none",
            }}
          >
            Open Co-Branded Preview ↗
          </Link>
        </div>
      </section>

      {/* Incoming Co-Branded Calculator Leads Table */}
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
            padding: "16px 20px",
            borderBottom: "1px solid #DCE5E1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
              Incoming PR Calculator Scorecard Leads ({leads.length})
            </h3>
            <div style={{ fontSize: "12px", color: "#6E7F7C", marginTop: "2px" }}>
              Prospective clients who submitted point assessments via <code>?agency={agency.slug}</code>
            </div>
          </div>
        </div>

        {leads.length === 0 ? (
          <div style={{ padding: "28px 20px", fontSize: "13px", color: "#6E7F7C", textAlign: "center" }}>
            No calculator scorecards submitted yet. Share <code>{cobrandedPath}</code> on your website or booking page to start receiving verified leads.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#F8F7F2", borderBottom: "1px solid #DCE5E1", textAlign: "left" }}>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#526360", textTransform: "uppercase" }}>
                    Applicant
                  </th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#526360", textTransform: "uppercase" }}>
                    Corridor &amp; Calculator
                  </th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#526360", textTransform: "uppercase" }}>
                    Submitted Scorecard
                  </th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#526360", textTransform: "uppercase" }}>
                    Status
                  </th>
                  <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, color: "#526360", textTransform: "uppercase", textAlign: "right" }}>
                    Intake Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} style={{ borderBottom: "1px solid #EEF3F0" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, color: "#172322" }}>{lead.applicantName}</div>
                      <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                        {lead.applicantEmail}
                        {lead.applicantPhone ? ` • ${lead.applicantPhone}` : ""}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#F1F6F4",
                          color: "#063C3D",
                          border: "1px solid #DCE5E1",
                          marginRight: "6px",
                        }}
                      >
                        {lead.countryCode}
                      </span>
                      <span style={{ color: "#172322", fontWeight: 600 }}>{lead.calculatorTitle}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 650, color: "#0D6866" }}>
                      {lead.scoreSummary}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background:
                            lead.leadStatus === "converted_to_client"
                              ? "#EAF6F0"
                              : lead.leadStatus === "contacted"
                                ? "#EFF6FF"
                                : "#FEF3C7",
                          color:
                            lead.leadStatus === "converted_to_client"
                              ? "#176B50"
                              : lead.leadStatus === "contacted"
                                ? "#1D4ED8"
                                : "#92400E",
                          border: "1px solid rgba(0,0,0,0.08)",
                        }}
                      >
                        {lead.leadStatus === "converted_to_client"
                          ? "Retained"
                          : lead.leadStatus === "contacted"
                            ? "Contacted"
                            : "New Lead"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {lead.leadStatus === "new_lead" && (
                          <button
                            type="button"
                            onClick={() => handleLeadStatusChange(lead, "contacted")}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "1px solid #DCE5E1",
                              background: "#FFFFFF",
                              color: "#172322",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Mark Contacted
                          </button>
                        )}
                        {lead.leadStatus !== "converted_to_client" && (
                          <button
                            type="button"
                            onClick={() => handleLeadStatusChange(lead, "converted_to_client", true)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "1px solid #0D6866",
                              background: "#0D6866",
                              color: "#FFFFFF",
                              fontSize: "12px",
                              fontWeight: 650,
                              cursor: "pointer",
                            }}
                          >
                            Convert to Client
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Operational Row 1: Firm Branding + Invite Paralegals & Counsellors */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Firm Branding, Booking URL & Corridors */}
        <form
          onSubmit={handleSaveSetup}
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
              Brand, Consultation Link &amp; Visa Checklists
            </h3>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "4px",
                background: stepBrandDone ? "#EAF6F0" : "#FEF3C7",
                color: stepBrandDone ? "#176B50" : "#92400E",
              }}
            >
              {stepBrandDone ? "Configured" : "Action Recommended"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                Public Brand / Trading Name
              </label>
              <input
                type="text"
                value={tradingNameDraft}
                onChange={(e) => setTradingNameDraft(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 11px",
                  borderRadius: "7px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                WhatsApp / Intake Phone
              </label>
              <input
                type="text"
                placeholder="+1 (416) 555-0192"
                value={whatsappDraft}
                onChange={(e) => setWhatsappDraft(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 11px",
                  borderRadius: "7px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
              Consultation Booking URL (Shown after applicants send their PR score)
            </label>
            <input
              type="url"
              placeholder="https://calendly.com/your-firm/pr-consultation"
              value={bookingUrlDraft}
              onChange={(e) => setBookingUrlDraft(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 11px",
                borderRadius: "7px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
              Co-Branded Calculator Tagline
            </label>
            <input
              type="text"
              value={taglineDraft}
              onChange={(e) => setTaglineDraft(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 11px",
                borderRadius: "7px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "6px" }}>
              Active Destination Visa Corridors
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {SOVEREIGN_CORRIDORS.map((c) => {
                const active = corridorsDraft.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleToggleCorridor(c.code)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: `1px solid ${active ? "#0D6866" : "#DCE5E1"}`,
                      background: active ? "#EAF6F0" : "#FFFFFF",
                      color: active ? "#063C3D" : "#526360",
                      fontSize: "12px",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "11.5px", color: "#5C6E6A", marginTop: "6px" }}>
              Unlocked checklists:{" "}
              {SOVEREIGN_CORRIDORS.filter((c) => corridorsDraft.includes(c.code))
                .flatMap((c) => c.unlockedChecklists)
                .slice(0, 5)
                .join(" · ")}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#172322", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cobrandedEnabledDraft}
              onChange={(e) => setCobrandedEnabledDraft(e.target.checked)}
              style={{ accentColor: "#0D6866" }}
            />
            <span>Accept public PR calculator scorecard leads via <code>?agency={agency.slug}</code></span>
          </label>

          <div>
            <button
              type="submit"
              style={{
                padding: "9px 16px",
                borderRadius: "7px",
                border: "1px solid #063C3D",
                background: "#063C3D",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Save Partner Configuration
            </button>
          </div>
        </form>

        {/* Invite Paralegals, Case Managers & Branch Staff */}
        <section
          data-testid="agency-team-invite-panel"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
                Invite Paralegals &amp; Case Managers
              </h3>
              <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "2px" }}>
                Provision real staff logins inside your {agency.seatLimit}-seat firm allocation
              </div>
            </div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D" }}>
              {agency.seatsUsed} / {agency.seatLimit} Seats
            </span>
          </div>

          {staffError && (
            <div
              role="alert"
              style={{
                padding: "8px 11px",
                borderRadius: "6px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {staffError}
            </div>
          )}

          <form onSubmit={handleInviteStaff} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                  Staff Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Simran Kaur"
                  value={staffNameDraft}
                  onChange={(e) => setStaffNameDraft(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                  Staff Work Email
                </label>
                <input
                  type="email"
                  placeholder="simran@yourfirm.com"
                  value={staffEmailDraft}
                  onChange={(e) => setStaffEmailDraft(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                  Workspace Role
                </label>
                <select
                  value={staffRoleDraft}
                  onChange={(e) => setStaffRoleDraft(e.target.value as "case_manager" | "paralegal")}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                    background: "#FFFFFF",
                  }}
                >
                  <option value="paralegal">Paralegal / Document Reviewer</option>
                  <option value="case_manager">Case Manager / Counsel</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "#172322", marginBottom: "4px" }}>
                  Branch Office
                </label>
                <input
                  type="text"
                  placeholder={agency.hqCity}
                  value={staffBranchDraft}
                  onChange={(e) => setStaffBranchDraft(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                data-testid="invite-agency-staff-btn"
                style={{
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "1px solid #0D6866",
                  background: "#0D6866",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                + Generate Staff Login &amp; Invite
              </button>
            </div>
          </form>

          {teamInvites.length > 0 && (
            <div style={{ borderTop: "1px solid #EEF3F0", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#526360", textTransform: "uppercase" }}>
                Provisioned Staff Accounts ({teamInvites.length})
              </div>
              {teamInvites.map((member) => (
                <div
                  key={member.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: "#F8FAF9",
                    border: "1px solid #DCE5E1",
                    fontSize: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong>{member.fullName}</strong> ({member.email}) ·{" "}
                    <span style={{ color: "#526360" }}>
                      {member.role === "case_manager" ? "Case Manager" : "Paralegal"} • {member.branchOffice}
                    </span>
                  </div>
                  <code style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D" }}>
                    Passcode: {member.passcode}
                  </code>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Operational Row 2: Live Statutory Bulletins + HQ Support Desk & Break-Glass Control */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Live Statutory Rule & Draw Bulletins from HQ */}
        <section
          data-testid="agency-statutory-bulletins"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
              Live Immigration Rule &amp; Cutoff Bulletins
            </h3>
            <div style={{ fontSize: "12px", color: "#5C6E6A", marginTop: "2px" }}>
              Synced automatically from Documento HQ to your checklists &amp; calculators ({agency.enabledCorridors.join(", ")})
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {ruleBroadcasts.slice(0, 4).map((rb) => (
              <div
                key={rb.id}
                style={{
                  padding: "11px 13px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#F8FAF9",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "#EAF6F0",
                      color: "#063C3D",
                      border: "1px solid #B9DED4",
                    }}
                  >
                    {rb.corridorCode}
                  </span>
                  <span style={{ fontSize: "11px", color: "#647571" }}>Effective {rb.effectiveDate}</span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#172322", marginTop: "5px" }}>
                  {rb.title}
                </div>
                <div style={{ fontSize: "12px", color: "#445451", marginTop: "3px", lineHeight: 1.45 }}>
                  {rb.summary}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Documento HQ Support Desk & Optional 2-Hour Break-Glass Token */}
        <div
          data-testid="agency-support-desk"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
              Documento HQ Partner Support &amp; Diagnostic Token
            </h3>
            <p style={{ margin: "4px 0 12px 0", fontSize: "12.5px", color: "#445451", lineHeight: 1.5 }}>
              Request seat upgrades, wire invoice receipts, checklist updates, or technical OCR assistance. Client files remain private unless you explicitly issue a 2-hour diagnostic token.
            </p>

            {ticketError && (
              <div
                role="alert"
                style={{
                  padding: "8px 11px",
                  borderRadius: "6px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#991B1B",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                {ticketError}
              </div>
            )}

            <form onSubmit={handleSubmitSupportTicket} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "8px" }}>
                <select
                  aria-label="Support category"
                  value={ticketCategoryDraft}
                  onChange={(e) => setTicketCategoryDraft(e.target.value as AgencySupportTicket["category"])}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "12.5px",
                    background: "#FFFFFF",
                  }}
                >
                  <option value="ocr_pipeline">OCR / Checklist Help</option>
                  <option value="billing_seats">Billing / Seat Upgrade</option>
                  <option value="statutory_rules">Visa Rule Question</option>
                  <option value="kyb_verification">KYB Verification</option>
                </select>
                <input
                  type="text"
                  placeholder="Subject (e.g. Expand seats or check CRS checklist)"
                  value={ticketSubjectDraft}
                  onChange={(e) => setTicketSubjectDraft(e.target.value)}
                  style={{
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "12.5px",
                  }}
                />
              </div>
              <textarea
                rows={2}
                placeholder="Describe how Documento HQ can help your firm..."
                value={ticketMessageDraft}
                onChange={(e) => setTicketMessageDraft(e.target.value)}
                style={{
                  padding: "8px 11px",
                  borderRadius: "7px",
                  border: "1px solid #CBD5E1",
                  fontSize: "12.5px",
                  fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#334441", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={ticketAttachGrantDraft}
                    onChange={(e) => setTicketAttachGrantDraft(e.target.checked)}
                    style={{ accentColor: "#0D6866" }}
                  />
                  <span>Attach 2-hour diagnostic token</span>
                </label>
                <button
                  type="submit"
                  data-testid="submit-agency-support-ticket-btn"
                  style={{
                    padding: "7px 13px",
                    borderRadius: "6px",
                    border: "1px solid #063C3D",
                    background: "#063C3D",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Send to HQ Support
                </button>
              </div>
            </form>

            {supportTickets.length > 0 && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {supportTickets.slice(0, 3).map((tkt) => (
                  <div
                    key={tkt.id}
                    style={{
                      padding: "9px 11px",
                      borderRadius: "7px",
                      background: tkt.status === "resolved" ? "#F4FBF8" : "#F8FAF9",
                      border: `1px solid ${tkt.status === "resolved" ? "#B9DED4" : "#DCE5E1"}`,
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#063C3D" }}>
                      <span>
                        {tkt.ticketCode}: {tkt.subject}
                      </span>
                      <span>{tkt.status === "resolved" ? "RESOLVED" : "OPEN"}</span>
                    </div>
                    {tkt.hqReply && (
                      <div style={{ marginTop: "4px", color: "#176B50", fontWeight: 600 }}>
                        HQ Reply: {tkt.hqReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Standalone Break-Glass Diagnostic Token Control */}
          <div style={{ borderTop: "1px solid #EEF3F0", paddingTop: "12px" }}>
            {!agency.supportGrantActive ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  id="break-glass-reason-input"
                  aria-label="Diagnostic Scope / Ticket Reason"
                  type="text"
                  value={supportReasonDraft}
                  onChange={(e) => setSupportReasonDraft(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "12.5px",
                  }}
                />
                <button
                  type="button"
                  data-testid="issue-break-glass-btn"
                  onClick={() => handleToggleBreakGlass(true)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "7px",
                    border: "1px solid #0D6866",
                    background: "#EAF6F0",
                    color: "#063C3D",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Issue 2-Hour Diagnostic Token to HQ
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ fontSize: "12px", color: "#92400E" }}>
                  <strong>Active 2h Grant:</strong> {agency.supportGrantReason}
                </div>
                <button
                  type="button"
                  data-testid="revoke-break-glass-btn"
                  onClick={() => handleToggleBreakGlass(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "7px",
                    border: "1px solid #B91C1C",
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Revoke Support Token Immediately
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
