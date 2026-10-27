import React, { useState, useEffect } from "react";
import { DataTable } from "../common/DataTable";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  ImmigrationCase,
  DocumentItem,
  MessageItem,
  NotificationItem,
  InvoiceItem,
  InProgressFormItem,
  ClientPendingActionItem,
  ClientAppointmentItem,
  VisaAppointment,
} from "../../lib/types";
import { DocumentInspectorModal } from "../modals/DocumentInspectorModal";
import { WaitingStateBanner } from "../portal/WaitingStateBanner";
import { DocumentRequestManager } from "../portal/DocumentRequestManager";
import { SecureMessagingHub } from "../portal/SecureMessagingHub";
import { ClientOnboardingWizard } from "../portal/ClientOnboardingWizard";
import { ConfigurableFormViewer } from "../forms/ConfigurableFormViewer";
import { api, FALLBACK_FORM_SUBMISSION, FALLBACK_WAITING_STATE } from "../../lib/api";
import { VisaFileUpdatesView, FALLBACK_VISA_FILE_UPDATES, VisaFileUpdateItem } from "../portal/VisaFileUpdatesView";
import { DirectDocumentUploader } from "../portal/DirectDocumentUploader";
import { CaseOfficerChatBanner } from "../portal/CaseOfficerChatBanner";
import { FamilyDocumentIntakeHub } from "../portal/FamilyDocumentIntakeHub";
import {
  ClientLanguage,
  CLIENT_TRANSLATIONS,
  getSavedClientLanguage,
  saveClientLanguage,
} from "../../lib/clientLocalization";
import { ClientLanguageBar } from "../portal/ClientLanguageBar";

export function DocumentProgressionStepper({
  status,
  processingStatus,
  verificationStatus,
}: {
  status: string;
  processingStatus?: string;
  verificationStatus?: string;
}) {
  // Vision §4.5: Separate dimensions must NOT silently pass each other.
  // Receipt ≠ Acceptance ≠ Package Readiness (distinct server-authoritative states).

  // Step 1: Uploaded (receipt only)
  const isUploaded = status === "uploaded" || status === "received" || !!processingStatus;

  // Step 2: Under Review OR Rejected (human verification dimension)
  const isRejected = verificationStatus === "rejected" || status === "correction_required";
  const isUnderReview =
    !isRejected &&
    status !== "uploaded" &&
    status !== "received" &&
    (verificationStatus === "pending" ||
     verificationStatus === "review" ||
     status === "under_review" ||
     (processingStatus === "completed" && verificationStatus !== "verified" && verificationStatus !== "accepted"));

  // Step 3: Accepted (human verification passed)
  const isAccepted = verificationStatus === "verified" || verificationStatus === "accepted" || status === "accepted";

  // Step 4: Package-Ready (backend eligibility + all 6 dimensions passed)
  const isPackageReady =
    !isRejected && (status === "package_ready" || status === "ready" || status === "filed");

  const currentStep = isPackageReady
    ? 4
    : isAccepted
    ? 3
    : (isUnderReview || isRejected)
    ? 2
    : 1;

  const steps = [
    { num: 1, label: "Uploaded", desc: "Receipt confirmed" },
    { num: 2, label: isRejected ? "Correction Req." : "Under Review", desc: isRejected ? "Revise & resubmit" : "Human review in progress" },
    { num: 3, label: "Accepted", desc: "Verification passed" },
    { num: 4, label: "Package-Ready", desc: "All 6 dimensions passed; ready for filing" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: "#F8FAF9",
        border: "1px solid #DCE5E1",
        borderRadius: "20px",
        padding: "3px 8px",
        fontSize: "11px",
      }}
      aria-label={`Document progression stage: ${steps[currentStep - 1]?.label}`}
    >
      {steps.map((st, idx) => {
        const isDone = st.num < currentStep;
        const isCurrent = st.num === currentStep;
        const isStepRejected = isRejected && st.num === 2;

        return (
          <React.Fragment key={st.num}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontWeight: isCurrent ? 750 : 500,
                color: isStepRejected
                  ? "#DC2626"
                  : isCurrent
                  ? "#0D6866"
                  : isDone
                  ? "#166534"
                  : "#94A3B8",
              }}
            >
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  fontWeight: 800,
                  background: isStepRejected
                    ? "#FEE2E2"
                    : isCurrent
                    ? "#0D6866"
                    : isDone
                    ? "#DCFCE7"
                    : "#E2E8F0",
                  color: isStepRejected
                    ? "#DC2626"
                    : isCurrent
                    ? "#FFFFFF"
                    : isDone
                    ? "#166534"
                    : "#64748B",
                  border: isStepRejected
                    ? "1px solid #FCA5A5"
                    : isCurrent
                    ? "1px solid #0D6866"
                    : "none",
                }}
              >
                {isStepRejected ? "✕" : isDone ? "✓" : st.num}
              </span>
              <span title={st.desc}>{st.label}</span>
            </span>
            {idx < steps.length - 1 && (
              <span style={{ color: "#CBD5E1", fontSize: "10px" }}>➔</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface ClientPortalProps {
  myCase: ImmigrationCase | null;
  documents?: DocumentItem[];
  messages?: MessageItem[];
  notifications?: NotificationItem[];
  invoices?: InvoiceItem[];
  onOpenUploadModal: () => void;
  onOpenQuestionnaireModal: () => void;
  onSendMessage: (content: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
}

export function ClientPortal({
  myCase,
  documents = [],
  messages = [],
  notifications = [],
  invoices = [],
  onOpenUploadModal,
  onOpenQuestionnaireModal,
  onSendMessage,
  onMarkNotificationRead,
  onDocumentUpdated,
}: ClientPortalProps) {
  const [clientLanguage, setClientLanguage] = useState<ClientLanguage>(getSavedClientLanguage);

  const handleLanguageChange = (newLang: ClientLanguage) => {
    setClientLanguage(newLang);
    saveClientLanguage(newLang);
  };

  const t = CLIENT_TRANSLATIONS[clientLanguage];

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "updates"
    | "checklist"
    | "profile"
    | "questionnaire"
    | "forms"
    | "documents"
    | "milestones"
    | "messages"
    | "billing"
    | "settings"
  >("overview");

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [selectedDocForInspection, setSelectedDocForInspection] = useState<DocumentItem | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatPromptText, setChatPromptText] = useState("");
  const [checklistApplicantFilter, setChecklistApplicantFilter] = useState<string>("all");
  const [checklistStatusFilter, setChecklistStatusFilter] = useState<string>("all");
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);
  const [visaAppointments, setVisaAppointments] = useState<VisaAppointment[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (myCase?.id) {
      api.getVisaAppointments({ case_id: myCase.id })
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          if (isMounted && list.length > 0) {
            setVisaAppointments(list);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [myCase?.id]);

  const isDemoCase = myCase?.case_number === "CASE-US-8841";
  const isCanada =
    myCase?.jurisdiction?.toLowerCase().includes("canada") ||
    (myCase?.visa_category || "").toLowerCase().includes("canada") ||
    (myCase?.visa_category || "").toLowerCase().includes("study permit");
  const clientName = myCase?.client_name || "Primary Applicant";
  const clientInitials =
    clientName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PA";

  const updatesCount = isDemoCase ? 5 : 1;
  const checklistCount = isDemoCase ? 8 : isCanada ? 6 : 5;

  const caseSpecificUpdates: VisaFileUpdateItem[] = isDemoCase
    ? FALLBACK_VISA_FILE_UPDATES
    : isCanada
    ? [
        {
          id: `update-${myCase?.id || "ca"}-01`,
          timestamp: "Today • Just now",
          relativeTime: "Just now",
          category: "evidence",
          title: `Representation Activated & IRCC File Opened (#${myCase?.case_number || "CASE"})`,
          officialReference: `IRCC Ref #${myCase?.case_number || "CASE"}`,
          statusBadge: {
            label: "Active Matter",
            bg: "#DCFCE7",
            color: "#166534",
            border: "#86EFAC",
          },
          officerName: myCase?.assigned_manager || "Vanguard Immigration Law Group",
          officerRole: "Supervising Case Manager",
          summary: `Representation formally activated for ${myCase?.client_name || "Client"} (${myCase?.visa_category || "Canada Study Permit"}). Designated file created in Vanguard Client Transparency Portal. DLI acceptance and PAL attestation intake initiated.`,
          legalSignificance: `Formal legal representation established. Document intake and statutory verification active under IRPA / IRPR guidelines.`,
          actionRequired: false,
        },
      ]
    : [
        {
          id: `update-${myCase?.id || "gen"}-01`,
          timestamp: "Today • Just now",
          relativeTime: "Just now",
          category: "evidence",
          title: `Representation Retainer Executed & Case Docket Opened (#${myCase?.case_number || "CASE"})`,
          officialReference: `Docket #${myCase?.case_number || "CASE"}`,
          statusBadge: {
            label: "Active Matter",
            bg: "#DCFCE7",
            color: "#166534",
            border: "#86EFAC",
          },
          officerName: myCase?.assigned_manager || "Vanguard Immigration Law Group",
          officerRole: "Supervising Case Manager",
          summary: `Client onboarding completed. Initial case file opened for ${myCase?.visa_category || "Immigration Matter"}. Evidentiary document gathering in progress.`,
          legalSignificance: `Establishes formal client representation and legal confidentiality under counsel supervision.`,
          actionRequired: false,
        },
      ];

  const applicantRequirementGroups = isDemoCase
    ? [
        {
          id: "primary",
          name: "Dr. Elena Rostova (Primary Applicant)",
          role: "Principal Beneficiary • EB-1A Extraordinary Ability",
          avatar: "ER",
          items: [
            {
              id: "chk-1",
              title: "Foreign Passport Identity & Photo Page",
              status: "accepted" as const,
              statutoryBasis: "8 CFR § 204.5(a) Identity Proof",
              notes: "Valid through June 2031. Verified by Sarah Vance, Esq.",
            },
            {
              id: "chk-2",
              title: "Ph.D. Degree & Official US Academic Credential Evaluation",
              status: "accepted" as const,
              statutoryBasis: "8 CFR § 204.5(k)(2) Advanced Degree",
              notes: "U.S. Equivalency certified by Trustfort Credential Evaluations.",
            },
            {
              id: "chk-3",
              title: "Peer-Reviewed Scholarly Articles & Citation Metric Record",
              status: "received" as const,
              statutoryBasis: "8 CFR § 204.5(h)(3)(vi) Scholarly Articles",
              notes: "14 articles and verified h-index 24 submitted; under attorney analysis.",
            },
            {
              id: "chk-4",
              title: "Independent Expert Reference & Testimonial Letters (3 Letters)",
              status: "rejected" as const,
              statutoryBasis: "8 CFR § 204.5(h)(3)(v) Major Significance",
              rejectionReasonCode: "INCOMPLETE_DOCUMENT",
              rejectionReasonLabel: "Incomplete Document or Missing Pages",
              clientExplanation:
                "Letter 2 from Prof. H. Zhang lacks the referee's complete curriculum vitae and independent relationship verification. Please re-upload updated package with full credentials.",
              notes: "Correction required immediately.",
            },
            {
              id: "chk-5",
              title: "Biographical Intake Questionnaire (Form I-140)",
              status: "received" as const,
              statutoryBasis: "USCIS Form I-140 Part 4",
              notes: "65% completed. Part 4 alien travel history pending completion.",
            },
          ],
        },
        {
          id: "spouse",
          name: "Dmitri Rostov (Spouse)",
          role: "Derivative Beneficiary • Adjustment of Status (Form I-485)",
          avatar: "DR",
          items: [
            {
              id: "chk-6",
              title: "Foreign Passport Identity Page",
              status: "accepted" as const,
              statutoryBasis: "8 CFR § 245.2 Identity Proof",
              notes: "Valid through 2030. Unexpired foreign travel document.",
            },
            {
              id: "chk-7",
              title: "Official Government Marriage Certificate",
              status: "accepted" as const,
              statutoryBasis: "8 CFR § 204.2(a)(2) Spousal Relationship",
              notes: "Apostille authenticated and certified copy filed.",
            },
            {
              id: "chk-8",
              title: "Certified English Translation of Marriage Record",
              status: "rejected" as const,
              statutoryBasis: "8 CFR § 103.2(b)(3) Foreign Language Translation",
              rejectionReasonCode: "MISSING_PAGES",
              rejectionReasonLabel: "Missing Pages or Declaration",
              clientExplanation:
                "The Cyrillic marriage certificate was uploaded without the certified translator's formal declaration of competence. Please re-upload the complete certified translation document.",
              notes: "Correction required before package seal.",
            },
          ],
        },
        {
          id: "child",
          name: "Sofia Rostova (Child)",
          role: "Derivative Child • Form I-485 Supplement",
          avatar: "SR",
          items: [
            {
              id: "chk-9",
              title: "Foreign Birth Certificate with Parentage",
              status: "required" as const,
              statutoryBasis: "8 CFR § 204.2(d)(2) Parent-Child Relationship",
              notes: "Civil record showing parentage required for adjustment.",
            },
            {
              id: "chk-10",
              title: "USCIS Standard Passport Style Photographs",
              status: "outstanding" as const,
              statutoryBasis: "Form I-485 Instructions Part 8",
              notes: "Two identical 2x2 color photographs required before interview.",
            },
          ],
        },
      ]
    : isCanada
    ? [
        {
          id: "primary",
          name: `${clientName} (Primary Applicant)`,
          role: `Principal Beneficiary • ${myCase?.visa_category || "Canada Study Permit"}`,
          avatar: clientInitials,
          items: [
            {
              id: "chk-ca-01",
              title: "Designated Learning Institution (DLI) Letter of Acceptance (LOA)",
              status: "accepted" as const,
              statutoryBasis: "IRPR § 211.1 - Acceptance at DLI",
              notes: "Official unconditional acceptance letter from accredited DLI verified.",
            },
            {
              id: "chk-ca-02",
              title: "Provincial Attestation Letter (PAL 2024 Mandate)",
              status: "received" as const,
              statutoryBasis: "IRCC Ministerial Instructions 2024 - Study Cap Quota",
              notes: "Provincial study permit allocation quota confirmation under review.",
            },
            {
              id: "chk-ca-03",
              title: "Guaranteed Investment Certificate (GIC $20,635 Minimum)",
              status: "received" as const,
              statutoryBasis: "IRCC Financial Sufficiency Guideline 2024",
              notes: "Deposit receipt from CDIC-participating Canadian financial institution submitted.",
            },
            {
              id: "chk-ca-04",
              title: "Primary Passport & Identity Travel Document",
              status: "accepted" as const,
              statutoryBasis: "IRPR § 52 - Valid Travel Document",
              notes: "Machine-readable international passport biodata page verified by caseworker.",
            },
            {
              id: "chk-ca-05",
              title: "SDS Language Proficiency Result (IELTS 6.0+ / PTE 60+)",
              status: "required" as const,
              statutoryBasis: "IRCC Student Direct Stream Language Threshold",
              notes: "Language test report scorecard taken within last 24 months required.",
            },
            {
              id: "chk-ca-06",
              title: "IRCC Upfront Medical Examination (eMedical Sheet)",
              status: "outstanding" as const,
              statutoryBasis: "IRPR § 29 - Medical Examination of Foreign Nationals",
              notes: "Panel physician examination sheet with UMI/IME tracking barcode.",
            },
          ],
        },
      ]
    : [
        {
          id: "primary",
          name: `${clientName} (Primary Applicant)`,
          role: `Principal Beneficiary • ${myCase?.visa_category || "Immigration Matter"}`,
          avatar: clientInitials,
          items: [
            {
              id: "chk-gen-01",
              title: "Foreign Passport Identity & Photo Page",
              status: "accepted" as const,
              statutoryBasis: "Statutory Identity Verification",
              notes: "Valid travel document registered and verified by case manager.",
            },
            {
              id: "chk-gen-02",
              title: "Signed Legal Retainer & Representation Form",
              status: "accepted" as const,
              statutoryBasis: "Formal Representation Authority",
              notes: "Executed representation agreement active.",
            },
            {
              id: "chk-gen-03",
              title: "Biographical Intake Questionnaire",
              status: "received" as const,
              statutoryBasis: "Standard Statutory Intake",
              notes: "Submitted responses under legal review.",
            },
            {
              id: "chk-gen-04",
              title: "Proof of Financial Support & Banking Statements",
              status: "required" as const,
              statutoryBasis: "Financial Sufficiency Criteria",
              notes: "Recent official statements showing sufficient settlement funds required.",
            },
            {
              id: "chk-gen-05",
              title: "Supporting Category Credentials & Evidence",
              status: "outstanding" as const,
              statutoryBasis: "Pathway Grounding",
              notes: "Specific pathway documents requested by your assigned case manager.",
            },
          ],
        },
      ];

  // In-Progress Questionnaires & Forms
  const [inProgressForms, setInProgressForms] = useState<InProgressFormItem[]>(() => {
    if (!myCase) return [];
    return [
      {
        form_id: `form-intake-${myCase.id}`,
        form_title:
          myCase.case_number === "CASE-US-8841" || myCase.visa_category.includes("EB-1")
            ? "Form I-140 Immigrant Petition Questionnaire"
            : `${myCase.visa_category} Statutory Intake Questionnaire`,
        completion_percentage: myCase.case_number === "CASE-US-8841" ? 65 : (myCase.readiness_score || 20),
        last_saved_at: new Date().toISOString(),
        applicant_name: myCase.client_name,
        estimated_minutes_remaining: 15,
      },
    ];
  });

  // Pending Actions
  const [pendingActions, setPendingActions] = useState<ClientPendingActionItem[]>(() => {
    if (!myCase) return [];
    return [
      {
        id: "act-1",
        title:
          myCase.case_number === "CASE-US-8841"
            ? "Re-upload Certified Translation of Foreign Marriage Record"
            : "Upload Government Passport Identity Page",
        description:
          myCase.case_number === "CASE-US-8841"
            ? "Paralegal flagged blurry signature on translation certification. Please upload a clear 300 DPI scan."
            : "Submit a high-resolution scan of your biographical passport page matching official records.",
        due_date: myCase.case_number === "CASE-US-8841" ? "In 2 days (Oct 22)" : (myCase.deadline ? `Before ${myCase.deadline}` : "Pending initial intake"),
        priority: "high",
        action_type: "document_upload",
        target_applicant: myCase.case_number === "CASE-US-8841" ? "Dmitri Rostova (Spouse)" : myCase.client_name,
      },
    ];
  });

  // Upcoming Appointments
  const [upcomingAppointments, setUpcomingAppointments] = useState<ClientAppointmentItem[]>(() => {
    if (!myCase) return [];
    if (myCase.case_number === "CASE-US-8841") {
      return [
        {
          id: "appt-1",
          title: "USCIS Biometrics Appointment",
          appointment_type: "biometrics",
          date_time: "November 04, 2026 at 09:30 AM PST",
          location: "USCIS Application Support Center — San Jose, CA",
          officer_or_venue: "ASC Officer / Biometrics Tech",
          instructions: "Bring unexpired passport and Form I-797C appointment notice.",
          can_reschedule: true,
        },
        {
          id: "appt-2",
          title: "Strategy Video Consultation with Lead Attorney",
          appointment_type: "attorney_strategy",
          date_time: "October 28, 2026 at 02:00 PM PST",
          location: "Secure Video Conference Link (LexImmigration)",
          officer_or_venue: "Sarah Jenkins, Esq.",
          instructions: "Review petition exhibit list prior to video consultation.",
          can_reschedule: true,
        },
      ];
    }
    return [];
  });

  const missingDocs = documents.filter((d) => d.status === "missing" || d.status === "action_needed");
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Milestones progression
  const milestones = isCanada
    ? [
        { name: "Legal Retainer Executed", done: true, date: "October 20, 2026", desc: "Representation agreement executed and dedicated Canadian immigration file opened." },
        { name: "DLI Acceptance & PAL Verification", done: true, date: "October 22, 2026", desc: "Designated Learning Institution LOA and Provincial Attestation Letter verified under national cap." },
        { name: "Financial Proof & GIC Issuance", done: false, date: "In Progress (Current)", desc: "Guaranteed Investment Certificate (GIC $20,635+) and student financial dossier assembly." },
        { name: "IRCC Portal Packaging & Upfront Medicals", done: false, date: "Est. November 10, 2026", desc: "Final eMedical validation, Statement of Purpose (SOP), and IRCC portal filing preparation." },
        { name: "Biometrics (BIL) & Final IRCC Decision", done: false, date: "Est. December 2026", desc: "Biometrics Instruction Letter enrollment and final study permit visa issuance." },
      ]
    : [
        { name: "Legal Retainer Executed", done: true, date: "August 10, 2026", desc: "Representation agreement executed and trust escrow funded." },
        { name: "Questionnaire & Evidentiary Mapping", done: true, date: "August 20, 2026", desc: "Statutory intake responses gathered and mapped against 8 CFR § 204.5." },
        { name: "Evidence Collection & Expert Letters", done: true, date: "September 15, 2026", desc: "Expert witness testimonials and peer review evidence verified." },
        { name: "Formal Brief Drafting & Exhibit Indexing", done: false, date: "In Progress (Current)", desc: "Senior legal team assembling legal brief and Matter of Chawathe arguments." },
        { name: "Final Client Approval & Submission to USCIS", done: false, date: "Est. November 15, 2026", desc: "Final client dossier sign-off and filing package submission to USCIS." },
      ];

  // Navigation Items
  const navItems = [
    {
      key: "overview" as const,
      label: t.navOverview,
      buttonText: `🏠 ${t.navOverview}`,
      icon: "🏠",
      count: null,
    },
    {
      key: "updates" as const,
      label: t.navUpdates,
      buttonText: `📑 ${t.navUpdates}${myCase ? ` (${updatesCount})` : ""}`,
      icon: "📑",
      count: myCase ? updatesCount : null,
    },
    {
      key: "checklist" as const,
      label: "Per-Applicant Checklist",
      buttonText: `✅ Per-Applicant Checklist${myCase ? ` (${checklistCount})` : ""}`,
      icon: "✅",
      count: myCase ? checklistCount : null,
    },
    {
      key: "documents" as const,
      label: t.navDocuments,
      buttonText: `📄 ${t.navDocuments} (${documents.length})`,
      icon: "📄",
      count: documents.length,
    },
    {
      key: "messages" as const,
      label: t.navMessages,
      buttonText: `💬 ${t.navMessages} (${messages.length})`,
      icon: "💬",
      count: messages.length,
    },
    {
      key: "questionnaire" as const,
      label: t.navQuestionnaire,
      buttonText: `📝 ${t.navQuestionnaire}`,
      icon: "📝",
      count: null,
    },
    {
      key: "forms" as const,
      label: t.navForms,
      buttonText: `📋 ${t.navForms}`,
      icon: "📋",
      count: null,
    },
    {
      key: "milestones" as const,
      label: t.navMilestones,
      buttonText: `🏁 ${t.navMilestones}`,
      icon: "🏁",
      count: null,
    },
    {
      key: "profile" as const,
      label: t.navProfile,
      buttonText: `👤 ${t.navProfile}`,
      icon: "👤",
      count: null,
    },
    {
      key: "billing" as const,
      label: t.navBilling,
      buttonText: `💳 ${t.navBilling}`,
      icon: "💳",
      count: invoices.length,
    },
    {
      key: "settings" as const,
      label: t.navSettings,
      buttonText: `⚙️ ${t.navSettings}`,
      icon: "⚙️",
      count: null,
    },
  ];

  const handleNavClick = (key: typeof activeTab) => {
    setActiveTab(key);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .documento-applicant-sidebar {
            position: fixed !important;
            left: ${isMobileMenuOpen ? '0' : '-280px'} !important;
            width: 270px !important;
            z-index: 1000 !important;
            transition: left 0.3s ease-in-out !important;
            box-shadow: 2px 0 8px rgba(6, 60, 61, 0.15) !important;
          }
          .documento-applicant-mobile-bar {
            display: flex !important;
          }
          .documento-main-content {
            padding: 16px !important;
          }
          .documento-action-buttons {
            flex-direction: column !important;
          }
          .documento-action-buttons button {
            width: 100% !important;
          }
        }
      `}</style>
      <div
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
          aria-label="Applicant Navigation Sidebar"
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
          className="documento-applicant-sidebar"
        >
        {/* Active Case Summary Card */}
        <div
          style={{
            padding: "20px 18px 16px 18px",
            borderBottom: "1px solid #DCE5E1",
          }}
        >
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#063C3D",
                  fontFamily: "monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {myCase ? `${t.caseLabel} #${myCase.case_number}` : "No Active Case"}
              </span>
              <span
                style={{
                  background: myCase ? "#EAF6F0" : "#F1F5F9",
                  color: myCase ? "#176B50" : "#64748B",
                  fontSize: "10px",
                  fontWeight: 650,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: myCase ? "1px solid #B9DED4" : "1px solid #CBD5E1",
                }}
              >
                {myCase ? t.activeStatus : "Pending Intake"}
              </span>
            </div>
            <div style={{ fontSize: "12px", fontWeight: 650, color: "#172322", lineHeight: 1.3 }}>
              {myCase ? myCase.visa_category : "Initial Client Intake"}
            </div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
              {myCase ? t.stageLabel : "Awaiting Counsel Scoping"}
            </div>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav
          aria-label="Portal Navigation"
          style={{
            flex: 1,
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#6E7F7C",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "4px 10px 8px 10px",
            }}
          >
            {t.sectionsHeader}
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleNavClick(item.key)}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 12px 9px 14px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #B9DED4" : "1px solid transparent",
                  background: isActive ? "#EAF6F0" : "transparent",
                  color: isActive ? "#0D6866" : "#445451",
                  fontSize: "13px",
                  fontWeight: isActive ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#F8F7F2";
                    e.currentTarget.style.color = "#063C3D";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#445451";
                  }
                }}
              >
                {isActive && (
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
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {item.count !== null && item.count > 0 && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "10px",
                      background: isActive ? "#0D6866" : "#F1F6F4",
                      color: isActive ? "#FFFFFF" : "#445451",
                      border: `1px solid ${isActive ? "#0D6866" : "#DCE5E1"}`,
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Assigned Case Processing Officer Footer Card */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #DCE5E1",
            background: "#FAFAF7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
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
                SJ
              </div>
              <span
                style={{
                  position: "absolute",
                  bottom: "-1px",
                  right: "-1px",
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  backgroundColor: "#22C55E",
                  border: "1.5px solid #FFFFFF",
                }}
                title="Officer Online"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {myCase?.assigned_manager || (myCase ? "Sarah Jenkins, Esq." : "Unassigned Counsel")}
              </div>
              <div style={{ fontSize: "11px", color: "#0D6866", fontWeight: 650, lineHeight: 1.2 }}>
                {t.assignedOfficerTitle}
              </div>
              <div style={{ fontSize: "10px", color: "#6E7F7C", marginTop: "1px" }}>
                {t.onlineNowText}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "7px 10px",
              borderRadius: "6px",
              border: "1px solid #B9DED4",
              background: "#EAF6F0",
              color: "#0D6866",
              fontSize: "11px",
              fontWeight: 650,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t.chatWithOfficerButton}
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT AREA (Clean SaaS Grid Layout)
          ========================================================================= */}
      <main
        style={{
          flex: 1,
          padding: "24px 32px 64px 32px",
          maxWidth: "1320px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Dedicated Bilingual Language Support Banner for Retained Clients */}
        <ClientLanguageBar
          currentLanguage={clientLanguage}
          onLanguageChange={handleLanguageChange}
        />

        {/* Mobile Navigation Drawer Toggle if on narrow screen */}
        <div
          style={{
            display: "none",
            marginBottom: "16px",
            background: "#FFFFFF",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #DCE5E1",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="documento-applicant-mobile-bar"
        >
          <span style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
            Section: {navItems.find((n) => n.key === activeTab)?.label}
          </span>
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="applicant-mobile-sections-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
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
            ☰ Switch Section
          </button>
        </div>

        {isMobileMenuOpen && (
          <div
            id="applicant-mobile-sections-menu"
            role="menu"
            aria-label="Applicant Portal Mobile Navigation"
            style={{
              marginBottom: "16px",
              background: "#FFFFFF",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              boxShadow: "0 4px 12px rgba(6, 60, 61, 0.08)",
            }}
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => handleNavClick(item.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: isActive ? "1px solid #B9DED4" : "1px solid transparent",
                    background: isActive ? "#EAF6F0" : "transparent",
                    color: isActive ? "#0D6866" : "#445451",
                    fontSize: "13px",
                    fontWeight: isActive ? 650 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.count !== null && item.count > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "10px",
                        background: isActive ? "#0D6866" : "#F1F6F4",
                        color: isActive ? "#FFFFFF" : "#445451",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* =========================================================================
            TAB 1: OVERVIEW DASHBOARD
            ========================================================================= */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Page Heading & Secondary Metadata */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "14px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 750,
                      color: "#063C3D",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {t.navOverview}
                  </h1>
                  <span
                    style={{
                      background: "#EAF6F0",
                      color: "#176B50",
                      fontSize: "11px",
                      fontWeight: 650,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid #B9DED4",
                    }}
                  >
                    {myCase?.visa_category || "Initial Client Intake"}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#445451",
                    lineHeight: 1.4,
                  }}
                >
                  {myCase ? (
                    <>
                      Welcome to Your Immigration Transparency Portal, {myCase.client_name} • <strong>Case Ref: {myCase.case_number}</strong> • Jurisdiction: <strong>{myCase.jurisdiction}</strong>
                    </>
                  ) : (
                    <>
                      Welcome to Your Immigration Transparency Portal • <strong>Initial Setup Ready</strong> • Onboard your first matter to begin tracking
                    </>
                  )}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("updates")}
                  style={{
                    background: "#063C3D",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 5px rgba(6, 60, 61, 0.2)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>📑 {t.navUpdates}</span>
                  {myCase && (
                    <span
                      style={{
                        background: "#22C55E",
                        color: "#FFFFFF",
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: "10px",
                      }}
                    >
                      5
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onOpenUploadModal}
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 5px rgba(13, 104, 102, 0.2)",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#063C3D";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#0D6866";
                  }}
                >
                  <span>+ Upload Evidence</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("messages")}
                  style={{
                    background: "#EAF6F0",
                    color: "#0D6866",
                    border: "1px solid #B9DED4",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>💬 Chat with Officer</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenQuestionnaireModal}
                  style={{
                    background: "#FFFFFF",
                    color: "#063C3D",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F8F7F2";
                    e.currentTarget.style.borderColor = "#B9DED4";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.borderColor = "#DCE5E1";
                  }}
                >
                  <span>Guided Questionnaire</span>
                </button>
              </div>
            </div>

            {/* Contextual Onboarding Checklist (Only shown when genuinely incomplete and case is active) */}
            {!onboardingDismissed && myCase && (
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1.5px solid #B9DED4",
                  borderRadius: "14px",
                  padding: "18px 22px",
                  boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ flex: 1, minWidth: "280px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px" }}>📋</span>
                    <strong style={{ fontSize: "14px", color: "#063C3D", fontWeight: 700 }}>
                      Intake &amp; Onboarding Requirements
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        background: "#EAF6F0",
                        color: "#0D6866",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid #B9DED4",
                      }}
                    >
                      Step 3 of 4
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
                    Your petition is currently in <strong>Evidence Gathering &amp; Review</strong>. Complete your biographical intake responses to unlock formal attorney brief compilation.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onOpenQuestionnaireModal}
                    style={{
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontWeight: 650,
                      borderRadius: "8px",
                      padding: "8px 16px",
                    }}
                  >
                    Continue Questionnaire →
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    style={{
                      background: "#FFFFFF",
                      color: "#063C3D",
                      border: "1px solid #B9DED4",
                      borderRadius: "8px",
                      fontWeight: 600,
                      padding: "8px 14px",
                    }}
                    onClick={() => setIsOnboardingModalOpen(true)}
                  >
                    Complete Onboarding Wizard →
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: "#6E7F7C", borderRadius: "8px" }}
                    onClick={() => setOnboardingDismissed(true)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Missing Document Action Alert if any */}
            {missingDocs.length > 0 && (
              <div
                role="alert"
                style={{
                  padding: "16px 20px",
                  background: "#FEF7EA",
                  border: "1px solid #FCD34D",
                  borderRadius: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#8A5A10", display: "block" }}>
                      Action Requested: {missingDocs.length} Document(s) Awaiting Upload
                    </strong>
                    <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                      Your legal team requested: {missingDocs.map((d) => d.title).join(", ")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenUploadModal}
                  style={{ background: "#8A5A10", color: "#FFFFFF", border: "none" }}
                >
                  Upload Requested Document
                </Button>
              </div>
            )}

            {/* Primary Next-Action Card & Task Ownership Separation */}
            {myCase ? (
              <WaitingStateBanner
                waitingState={FALLBACK_WAITING_STATE}
                caseId={myCase.id}
                onActionClick={(item) => {
                  if (item.type === "document_request") {
                    setActiveTab("documents");
                  } else if (item.type === "questionnaire") {
                    setIsOnboardingModalOpen(true);
                  }
                }}
              />
            ) : (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px dashed #B9DED4",
                  borderRadius: "14px",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📂</div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                  Awaiting Case File Setup by Legal Team
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748B", maxWidth: "560px", marginInline: "auto", lineHeight: 1.5 }}>
                  Your secure portal account is active. Your legal team (firm Owner or Lead Paralegal) will configure your immigration matter, upload initial petition filings, and assign required checklists. You will be notified as soon as actions are ready.
                </p>
              </div>
            )}

            {/* In-Progress Forms, Pending Actions & Upcoming Appointments Card */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #B9DED4",
                borderRadius: "14px",
                padding: "20px 24px",
                boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  borderBottom: "1px solid #DCE5E1",
                  paddingBottom: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>⚡</span>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
                      In-Progress Forms, Pending Actions &amp; Appointments
                    </h3>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                    Resume unfinished questionnaires, clear client blockers, and track scheduled official appointments.
                  </p>
                </div>
                <Badge variant="review">
                  {inProgressForms.length} Forms In Progress • {pendingActions.length} Pending Actions
                </Badge>
              </div>

              {rescheduleNotice && (
                <div
                  style={{
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "12px",
                    color: "#0D6866",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>✓ {rescheduleNotice}</span>
                  <button
                    type="button"
                    onClick={() => setRescheduleNotice(null)}
                    style={{ background: "transparent", border: "none", color: "#0D6866", cursor: "pointer", fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                  gap: "16px",
                }}
              >
                {/* 1. In-Progress Forms (Save / Resume) */}
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#063C3D" }}>📝 In-Progress Forms</strong>
                      <span style={{ fontSize: "11px", color: "#64748B" }}>Auto-Saved</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {inProgressForms.length === 0 ? (
                        <div style={{ padding: "16px 12px", textAlign: "center", color: "#64748B", fontSize: "12px", background: "#FFFFFF", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                          No questionnaires currently pending.
                        </div>
                      ) : (
                        inProgressForms.map((frm) => (
                        <div
                          key={frm.form_id}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <div>
                              <strong style={{ fontSize: "12px", color: "#0F172A", display: "block" }}>
                                {frm.form_title}
                              </strong>
                              <span style={{ fontSize: "11px", color: "#64748B" }}>
                                For: {frm.applicant_name} • ~{frm.estimated_minutes_remaining} min left
                              </span>
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 750, color: "#0D6866" }}>
                              {frm.completion_percentage}%
                            </span>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "#E2E8F0", borderRadius: "3px", margin: "8px 0" }}>
                            <div
                              style={{
                                width: `${frm.completion_percentage}%`,
                                height: "100%",
                                background: "#0D6866",
                                borderRadius: "3px",
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "10px", color: "#94A3B8" }}>
                              Saved {new Date(frm.last_saved_at).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenQuestionnaireModal();
                              }}
                              style={{
                                background: "#0D6866",
                                color: "#FFF",
                                border: "none",
                                borderRadius: "4px",
                                padding: "4px 10px",
                                fontSize: "11px",
                                fontWeight: 650,
                                cursor: "pointer",
                              }}
                            >
                              Resume Form →
                            </button>
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                </div>

                {/* 2. Pending Actions Counter & Checklist */}
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#063C3D" }}>⚠️ Pending Actions</strong>
                      <span
                        style={{
                          background: "#FEE2E2",
                          color: "#991B1B",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "10px",
                        }}
                      >
                        {pendingActions.length} Actions Required
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {pendingActions.length === 0 ? (
                        <div style={{ padding: "16px 12px", textAlign: "center", color: "#64748B", fontSize: "12px", background: "#FFFFFF", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                          No urgent client actions pending at this stage.
                        </div>
                      ) : (
                        pendingActions.map((act) => (
                        <div
                          key={act.id}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #FECACA",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <strong style={{ fontSize: "12px", color: "#991B1B" }}>{act.title}</strong>
                            <Badge variant={act.priority === "high" ? "action" : "warning"} size="sm">
                              {act.priority.toUpperCase()}
                            </Badge>
                          </div>
                          <p style={{ margin: "0", fontSize: "11px", color: "#475569", lineHeight: "1.4" }}>
                            {act.description}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", color: "#DC2626", fontWeight: 650 }}>
                              ⏰ {act.due_date}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (act.action_type === "document_upload") {
                                  onOpenUploadModal();
                                } else {
                                  onOpenQuestionnaireModal();
                                }
                              }}
                              style={{
                                background: "#DC2626",
                                color: "#FFF",
                                border: "none",
                                borderRadius: "4px",
                                padding: "4px 10px",
                                fontSize: "11px",
                                fontWeight: 650,
                                cursor: "pointer",
                              }}
                            >
                              Take Action →
                            </button>
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                </div>

                {/* 3. Upcoming Official Appointments */}
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#063C3D" }}>📅 Upcoming Appointments</strong>
                      <span style={{ fontSize: "11px", color: "#166534", fontWeight: 650 }}>Confirmed</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {visaAppointments.length > 0 ? (
                        visaAppointments.map((va: any) => {
                          const is221g = va.status_221g === true || va.status_221g === "active" || va.appointment_status === "221g" || va.appointment_status === "administrative_processing_221g";
                          const slipColor = (va.status_221g_color || "pink").toUpperCase();
                          const centerTitle = va.vac_center || va.vac_center_name || va.vac_city || va.consular_post || "Visa Application Centre";
                          const providerName = (va.vac_provider || (centerTitle.toLowerCase().includes("vfs") ? "VFS Global" : centerTitle.toLowerCase().includes("bls") ? "BLS" : "U.S. Consulate")).toUpperCase();
                          const ofcSlot = va.ofc_biometrics_slot || va.ofc_appointment_datetime;
                          const consularSlot = va.consular_interview_slot || va.consular_appointment_datetime;
                          const isDropbox = va.dropbox_eligible || va.is_dropbox_eligible;
                          const awb = va.tracking_number_blue_dart || va.courier_awb;
                          const courierPartner = va.courier_partner || "Blue Dart";
                          const courierStatus = va.courier_status || "In Transit";
                          const evidenceNotes = va.status_221g_requested_evidence || (is221g ? va.notes : null);

                          return (
                            <div
                              key={va.id}
                              style={{
                                background: is221g ? "#FFFBEB" : "#FFFFFF",
                                border: is221g ? "1px solid #FCD34D" : "1px solid #CBD5E1",
                                borderRadius: "8px",
                                padding: "10px 12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                                <div>
                                  <strong style={{ fontSize: "12px", color: is221g ? "#92400E" : "#063C3D" }}>
                                    🏛️ {centerTitle}
                                  </strong>
                                  <div style={{ fontSize: "11px", color: "#64748B" }}>
                                    {providerName} • Confirmation #{va.confirmation_number || va.ds160_ceac_barcode || "CONFIRMED"}
                                  </div>
                                </div>
                                <Badge variant={is221g ? "warning" : "success"} size="sm">
                                  {is221g ? `221(g) ${slipColor} SLIP` : String(va.appointment_status || "SCHEDULED").toUpperCase()}
                                </Badge>
                              </div>

                              {ofcSlot && (
                                <div style={{ fontSize: "11px", color: "#0F172A", fontWeight: 600 }}>
                                  📸 OFC Biometrics: {new Date(ofcSlot).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}

                              {consularSlot && (
                                <div style={{ fontSize: "11px", color: "#0F172A", fontWeight: 600 }}>
                                  🎙️ Consular Interview: {new Date(consularSlot).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}

                              {isDropbox && (
                                <span style={{ fontSize: "10px", color: "#0D6866", background: "#EAF6F0", padding: "2px 6px", borderRadius: "4px", width: "fit-content", fontWeight: 650 }}>
                                  ✓ Interview Waiver / Dropbox Eligible
                                </span>
                              )}

                              {awb && (
                                <div style={{ fontSize: "10px", color: "#475569", background: "#F1F5F9", padding: "4px 8px", borderRadius: "4px" }}>
                                  📦 Courier: {courierPartner} (AWB #{awb}) • Status: {courierStatus}
                                </div>
                              )}

                              {is221g && evidenceNotes && (
                                <div style={{ fontSize: "11px", color: "#B45309", background: "#FEF3C7", padding: "6px 8px", borderRadius: "4px", marginTop: "2px" }}>
                                  ⚠️ <strong>221(g) Action Required:</strong> {evidenceNotes}
                                </div>
                              )}

                              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRescheduleNotice(`Calendar invitation for ${centerTitle} generated.`);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: "4px 8px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    background: "#EAF6F0",
                                    color: "#0D6866",
                                    border: "1px solid #B9DED4",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Add to Calendar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRescheduleNotice(`Reschedule inquiry sent to case manager for ${centerTitle}.`);
                                  }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    background: "#FFF",
                                    color: "#64748B",
                                    border: "1px solid #CBD5E1",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Request Reschedule
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : upcomingAppointments.length === 0 ? (
                        <div style={{ padding: "16px 12px", textAlign: "center", color: "#64748B", fontSize: "12px", background: "#FFFFFF", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                          No upcoming appointments scheduled.
                        </div>
                      ) : (
                        upcomingAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                            <strong style={{ fontSize: "12px", color: "#063C3D" }}>{apt.title}</strong>
                            <Badge variant="success" size="sm">
                              {apt.appointment_type.replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                          <span style={{ fontSize: "11px", color: "#0F172A", fontWeight: 650 }}>
                            🗓️ {apt.date_time}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748B" }}>
                            📍 {apt.location}
                          </span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#475569", fontStyle: "italic" }}>
                            {apt.instructions}
                          </p>
                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleNotice(`Calendar invitation for "${apt.title}" generated.`);
                              }}
                              style={{
                                flex: 1,
                                padding: "4px 8px",
                                fontSize: "10px",
                                fontWeight: 600,
                                background: "#EAF6F0",
                                color: "#0D6866",
                                border: "1px solid #B9DED4",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Add to Calendar
                            </button>
                            {apt.can_reschedule && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleNotice(
                                    `Reschedule request submitted to your caseworker for ${apt.title}. Expect confirmation within 24 business hours.`
                                  );
                                }}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  background: "#FFF",
                                  color: "#64748B",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                }}
                              >
                                Request Reschedule
                              </button>
                            )}
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Preview of Visa Application File Updates on Overview */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #B9DED4",
                borderRadius: "14px",
                padding: "20px 24px",
                boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #DCE5E1",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>📑</span>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                      {t.latestUpdatesHeader}
                    </h3>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                    {isCanada
                      ? "Live synchronization with IRCC & Vanguard Case Docket."
                      : isDemoCase
                      ? "Live synchronization with USCIS Texas Service Center & Vanguard Case Docket."
                      : `Live synchronization with ${myCase?.jurisdiction || "Immigration Authority"} & Vanguard Case Docket.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("updates")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    background: "#EAF6F0",
                    color: "#0D6866",
                    border: "1px solid #B9DED4",
                    fontSize: "12px",
                    fontWeight: 650,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>{t.viewAllUpdatesButton || t.viewAllUpdatesLink}</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {!myCase || caseSpecificUpdates.length === 0 ? (
                  <div style={{ padding: "20px 16px", textAlign: "center", color: "#6E7F7C", fontSize: "13px", background: "#F8F7F2", borderRadius: "8px", border: "1px dashed #DCE5E1" }}>
                    No visa docket updates yet. Official government notifications will populate here once your petition is filed with immigration authorities.
                  </div>
                ) : (
                  caseSpecificUpdates.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab("updates")}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "10px",
                      background: "#F8F7F2",
                      border: "1px solid #DCE5E1",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#0D6866";
                      e.currentTarget.style.background = "#F1F8F6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#DCE5E1";
                      e.currentTarget.style.background = "#F8F7F2";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{
                            background: item.statusBadge.bg,
                            color: item.statusBadge.color,
                            border: `1px solid ${item.statusBadge.border}`,
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {item.statusBadge.label}
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#6E7F7C" }}>
                          {item.relativeTime}
                        </span>
                        <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#063C3D" }}>
                          • {item.officialReference}
                        </span>
                      </div>
                      <strong style={{ fontSize: "13px", color: "#063C3D", display: "block" }}>
                        {item.title}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#445451", display: "block", marginTop: "2px" }}>
                        {item.summary}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#0D6866", fontWeight: 650 }}>
                        View Details →
                      </span>
                    </div>
                  </div>
                )))}
              </div>
            </div>

            {/* Documented Case Progress Stepper */}
            {myCase && (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "14px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #DCE5E1",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                    {t.milestonesTitle}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                    Current phase: <strong>Phase 3 of 5 (Evidence Collection &amp; Expert Evaluation)</strong>
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#0D6866",
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    padding: "4px 10px",
                    borderRadius: "6px",
                  }}
                >
                  82% Readiness Complete
                </span>
              </div>

              {/* Milestone sequence */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                {milestones.map((m, idx) => (
                  <div
                    key={m.name}
                    style={{
                      background: m.done ? "#F1F8F6" : idx === 3 ? "#FFFFFF" : "#F8F7F2",
                      border: `1px solid ${m.done ? "#B9DED4" : idx === 3 ? "#0D6866" : "#DCE5E1"}`,
                      borderRadius: "8px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: m.done ? "#176B50" : idx === 3 ? "#0D6866" : "#DCE5E1",
                          color: "#FFFFFF",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {m.done ? "✓" : idx + 1}
                      </span>
                      <strong
                        style={{
                          fontSize: "12px",
                          color: m.done ? "#176B50" : idx === 3 ? "#063C3D" : "#6E7F7C",
                          lineHeight: 1.3,
                        }}
                      >
                        {m.name}
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: "11px", color: "#6E7F7C", lineHeight: 1.4 }}>
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Balanced Lower Section: Case Details & Notifications */}
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
              {/* My Petition Details */}
              <Card
                title="My Petition Details"
                subtitle="Active legal representation under Vanguard Immigration Law Group LLP."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "13px" }}>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        CASE NUMBER
                      </span>
                      <strong style={{ fontSize: "15px", color: "#063C3D" }}>
                        {myCase?.case_number || "Pending Case Opening"}
                      </strong>
                    </div>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        PETITION TYPE
                      </span>
                      <strong style={{ color: "#063C3D" }}>
                        {myCase?.visa_category || "Initial Intake Scoping"}
                      </strong>
                    </div>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        PRIMARY LAWYER
                      </span>
                      <span style={{ color: "#172322", fontWeight: 600 }}>
                        {myCase?.assigned_manager || "Unassigned (Intake Pending)"}
                      </span>
                    </div>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        TARGET JURISDICTION
                      </span>
                      <span style={{ color: "#172322", fontWeight: 600 }}>
                        {myCase?.jurisdiction || "Pending Determination"}
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #DCE5E1", paddingTop: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 650, color: "#063C3D" }}>Petition Filing Readiness</span>
                      <strong style={{ color: "#0D6866" }}>{myCase ? `${myCase.readiness_score}% Complete` : "0% (Setup Phase)"}</strong>
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "#E7EFEB", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${myCase ? (myCase.readiness_score || 0) : 0}%`, height: "100%", backgroundColor: "#0D6866" }} />
                    </div>
                    <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "6px", lineHeight: 1.4 }}>
                      Workflow progress measures evidentiary milestone completion and does not predict USCIS processing time or statutory approval outcome.
                    </div>
                  </div>
                </div>
              </Card>

              {/* Notifications & Recent Activity */}
              <Card
                title="Recent Notifications & Alerts"
                subtitle="Official case updates from your legal team."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "20px 14px", textAlign: "center", color: "#6E7F7C", fontSize: "12px", background: "#F8F7F2", borderRadius: "8px", border: "1px dashed #DCE5E1" }}>
                      No notifications yet. Direct notices from your legal team will appear here.
                    </div>
                  ) : (
                    notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      style={{
                        padding: "12px 14px",
                        background: n.status === "unread" ? "#EAF6F0" : "#F8F7F2",
                        border: `1px solid ${n.status === "unread" ? "#B9DED4" : "#DCE5E1"}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "13px", color: "#063C3D" }}>{n.title}</strong>
                        {n.status === "unread" && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#0D6866",
                              color: "#FFFFFF",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            New
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>{n.body}</p>
                    </div>
                  )))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: VISA APPLICATION FILE UPDATES
            ========================================================================= */}
        {activeTab === "updates" && (
          <VisaFileUpdatesView
            myCase={myCase}
            language={clientLanguage}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenUploadModal={onOpenUploadModal}
          />
        )}

        {/* =========================================================================
            TAB: PER-APPLICANT EVIDENTIARY CHECKLIST
            ========================================================================= */}
        {activeTab === "checklist" && (
          !myCase ? (
            <div
              data-testid="checklist-empty-state"
              style={{
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "16px",
                padding: "48px 32px",
                textAlign: "center",
                maxWidth: "680px",
                margin: "40px auto",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>📋</div>
              <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                No Evidentiary Checklist Configured
              </h3>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                Your legal team (firm Owner or Lead Paralegal) has not yet published an evidentiary checklist for your matter. Once your petition file is configured, per-applicant requirements and verification stages will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header Card */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 750, color: "#063C3D" }}>
                      Per-Applicant Evidentiary Checklist
                    </h2>
                    <Badge variant="review">
                      {isCanada ? "IRPA § 30(1) / IRPR Part 12 Grounded" : isDemoCase ? "8 CFR § 204.5 Grounded" : "Statutory Regulations Grounded"}
                    </Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#445451" }}>
                    {isCanada
                      ? "Individualized requirements for Canada Study Permit under IRCC guidelines. Review exact verification states, document progression pipelines, and required filings."
                      : "Individualized requirements grouped per family member. Review exact verification states, document progression pipelines, and structured rejection remedies."}
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={onOpenUploadModal}>
                  + Upload Document
                </Button>
              </div>

              {/* Applicant Filter Tabs */}
              <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
                {(isDemoCase
                  ? [
                      { key: "all", label: "All Family Members", count: 10 },
                      { key: "primary", label: "Dr. Elena Rostova (Primary)", count: 5 },
                      { key: "spouse", label: "Dmitri Rostov (Spouse)", count: 3 },
                      { key: "child", label: "Sofia Rostova (Child)", count: 2 },
                    ]
                  : [
                      { key: "all", label: "All Applicants", count: checklistCount },
                      { key: "primary", label: `${clientName} (Primary)`, count: checklistCount },
                    ]
                ).map((flt) => {
                  const active = checklistApplicantFilter === flt.key;
                  return (
                    <button
                      key={flt.key}
                      type="button"
                      onClick={() => setChecklistApplicantFilter(flt.key)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: active ? 700 : 550,
                        background: active ? "#063C3D" : "#F4F6F5",
                        color: active ? "#FFFFFF" : "#445451",
                        border: active ? "1px solid #063C3D" : "1px solid #DCE5E1",
                        cursor: "pointer",
                      }}
                    >
                      {flt.label} ({flt.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Applicant Requirement Groups */}
            {applicantRequirementGroups
              .filter(
                (grp) =>
                  checklistApplicantFilter === "all" || grp.id === checklistApplicantFilter
              )
              .map((grp) => (
                <div
                  key={grp.id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    padding: "20px 24px",
                    boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "50%",
                          background: "#0D6866",
                          color: "#FFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
                        {grp.avatar}
                      </div>
                      <div>
                        <strong style={{ fontSize: "15px", color: "#063C3D", display: "block" }}>
                          {grp.name}
                        </strong>
                        <span style={{ fontSize: "12px", color: "#64748B" }}>{grp.role}</span>
                      </div>
                    </div>
                    <Badge variant="neutral">{grp.items.length} Requirements</Badge>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {grp.items.map((it) => {
                      const isRejected = it.status === "rejected";
                      const isAccepted = it.status === "accepted";
                      const isRequired = it.status === "required";
                      const isOutstanding = it.status === "outstanding";

                      return (
                        <div
                          key={it.id}
                          style={{
                            background: isRejected ? "#FEF2F2" : "#F8FAF9",
                            border: `1px solid ${isRejected ? "#FECACA" : "#E2E8F0"}`,
                            borderRadius: "10px",
                            padding: "14px 16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                            <div>
                              <strong style={{ fontSize: "14px", color: isRejected ? "#991B1B" : "#0F172A" }}>
                                {it.title}
                              </strong>
                              <small style={{ display: "block", color: "#64748B", marginTop: "2px" }}>
                                Statutory Basis: {it.statutoryBasis}
                              </small>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <Badge
                                variant={
                                  isAccepted
                                    ? "success"
                                    : isRejected
                                    ? "action"
                                    : isRequired
                                    ? "warning"
                                    : isOutstanding
                                    ? "neutral"
                                    : "review"
                                }
                              >
                                {isAccepted
                                  ? "✓ ACCEPTED"
                                  : isRejected
                                  ? "✕ REJECTED (CORRECTION REQ.)"
                                  : it.status.toUpperCase()}
                              </Badge>
                              <DocumentProgressionStepper
                                status={it.status}
                                verificationStatus={isAccepted ? "verified" : isRejected ? "rejected" : undefined}
                              />
                            </div>
                          </div>

                          {it.notes && (
                            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#475569" }}>
                              {it.notes}
                            </p>
                          )}

                          {/* Structured Rejection Explanation Alert */}
                          {isRejected && (
                            <div
                              style={{
                                background: "#FFFFFF",
                                border: "1.5px solid #F87171",
                                borderRadius: "8px",
                                padding: "12px 14px",
                                marginTop: "6px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "14px" }}>⚠️</span>
                                <strong style={{ fontSize: "12px", color: "#B91C1C" }}>
                                  Correction Required: [{it.rejectionReasonCode}] {it.rejectionReasonLabel}
                                </strong>
                              </div>
                              <p style={{ margin: "0", fontSize: "12px", color: "#7F1D1D", lineHeight: "1.4" }}>
                                <strong>Caseworker Explanation:</strong> {it.clientExplanation}
                              </p>
                              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={onOpenUploadModal}
                                  style={{ background: "#DC2626", color: "#FFFFFF" }}
                                >
                                  Re-Upload Document →
                                </Button>
                              </div>
                            </div>
                          )}

                          {isRequired && (
                            <div style={{ marginTop: "4px" }}>
                              <Button variant="secondary" size="sm" onClick={onOpenUploadModal}>
                                Upload Required Document →
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* =========================================================================
            TAB 2: UPLOAD DOCUMENTS (Evidence & Uploads)
            ========================================================================= */}
        {activeTab === "documents" && (
          !myCase ? (
            <div
              data-testid="documents-empty-state"
              style={{
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "16px",
                padding: "48px 32px",
                textAlign: "center",
                maxWidth: "680px",
                margin: "40px auto",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>📄</div>
              <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                No Documents Requested Yet
              </h3>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                Your legal team (firm Owner or Lead Paralegal) has not yet activated a petition matter or issued document requests for your account. You will receive an alert as soon as evidence collection checklists are configured.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Phase 4 — Family Intake & Mobile-First Camera Scanning Hub */}
            <FamilyDocumentIntakeHub
              caseId={myCase.id}
              clientName={myCase.client_name}
              onDocumentUploaded={() => {
                // Trigger refresh if needed
              }}
            />

            {/* Direct In-Tab Drag-and-Drop Document Uploader */}
            <DirectDocumentUploader
              caseId={myCase?.id}
              language={clientLanguage}
              onDocumentUploaded={(newDoc) => {
                onDocumentUpdated?.(newDoc);
              }}
            />

            <DocumentRequestManager
              caseId={myCase?.id}
              isStaffMode={false}
              onUploadEvidence={() => onOpenUploadModal()}
            />

            <Card
              title="My Evidence Checklist & Uploaded Files"
              subtitle="All documents are verified with SHA-256 fingerprinting for privacy and tamper-proof storage with automated OCR extraction."
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenUploadModal}
                  style={{ background: "#0D6866", color: "#FFFFFF" }}
                >
                  + Upload Evidence File
                </Button>
              }
            >
              <DataTable
                columns={[
                  {
                    key: "title",
                    header: "Document Title",
                    render: (d) => (
                      <div>
                        <strong style={{ display: "block", color: "#063C3D" }}>{d.title}</strong>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: "#F1F6F4",
                              color: "#445451",
                              border: "1px solid #DCE5E1",
                            }}
                          >
                            v{d.version || 1} {d.is_current_version ? "(Current)" : "(Superseded)"}
                          </span>
                          <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{d.file_size || "1.5 MB"}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "category",
                    header: "Evidentiary Category",
                    render: (d) => (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#EAF6F0",
                          color: "#0D6866",
                          border: "1px solid #B9DED4",
                          fontWeight: 600,
                        }}
                      >
                        {(d.category || "").replace(/_/g, " ")}
                      </span>
                    ),
                  },
                  {
                    key: "processing_status",
                    header: "Processing",
                    render: (d) => {
                      const pStatus = d.processing_status || "completed";
                      return (
                        <Badge variant={pStatus === "completed" ? "success" : pStatus === "failed" ? "action" : "warning"}>
                          {pStatus.toUpperCase()}
                        </Badge>
                      );
                    },
                  },
                  {
                    key: "verification_status",
                    header: "Legal Verification",
                    render: (d) => {
                      const vStatus = d.verification_status || (d.status === "verified" ? "verified" : "unverified");
                      return (
                        <Badge variant={vStatus === "verified" ? "success" : vStatus === "rejected" ? "action" : "review"}>
                          {vStatus === "verified" ? "✓ VERIFIED" : vStatus.toUpperCase()}
                        </Badge>
                      );
                    },
                  },
                  {
                    key: "progression_state",
                    header: "Progression Pipeline",
                    render: (d) => (
                      <DocumentProgressionStepper
                        status={d.status}
                        processingStatus={d.processing_status}
                        verificationStatus={d.verification_status}
                      />
                    ),
                  },
                  {
                    key: "extracted_fields",
                    header: "Extracted Data",
                    render: (d) => (
                      <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 600 }}>
                        {d.extracted_fields?.length || 0} fields
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Action",
                    render: (d) => (
                      <Button variant="outline" size="sm" onClick={() => setSelectedDocForInspection(d)}>
                        Inspect Dossier
                      </Button>
                    ),
                  },
                ]}
                data={documents}
                keyExtractor={(d) => d.id}
              />
            </Card>
          </div>
        )
      )}

        {/* =========================================================================
            TAB 3: GUIDED QUESTIONNAIRE
            ========================================================================= */}
        {activeTab === "questionnaire" && (
          !myCase ? (
            <div
              data-testid="questionnaire-empty-state"
              style={{
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "16px",
                padding: "48px 32px",
                textAlign: "center",
                maxWidth: "680px",
                margin: "40px auto",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>📝</div>
              <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                No Questionnaire Configured
              </h3>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                Your legal team has not assigned any questionnaires to your matter yet.
              </p>
            </div>
          ) : (
            <Card
              title="Guided Statutory Evidentiary Questionnaire"
              subtitle="Map your career accomplishments directly against USCIS 8 CFR § 204.5(h)(3) criteria."
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenQuestionnaireModal}
                  style={{ background: "#0D6866", color: "#FFFFFF" }}
                >
                  Open Guided Wizard →
                </Button>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { criterion: "1. Scholarly Articles & Scientific Publications", status: "Completed (14 papers submitted)", verified: true },
                  { criterion: "2. Participation as a Judge / Peer Reviewer", status: "Completed (28 verified reviews)", verified: true },
                  { criterion: "3. Original Scientific Contributions of Major Significance", status: "In Review by Attorney", verified: false },
                  { criterion: "4. Leading or Critical Role in Distinguished Organizations", status: "Draft Saved (Awaiting CEO letter)", verified: false },
                ].map((item) => (
                  <div
                    key={item.criterion}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      background: "#F8F7F2",
                      border: "1px solid #DCE5E1",
                      borderRadius: "8px",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>{item.criterion}</strong>
                      <span style={{ fontSize: "13px", color: "#445451" }}>{item.status}</span>
                    </div>
                    <Badge variant={item.verified ? "success" : "review"}>
                      {item.verified ? "VERIFIED ✓" : "IN PROGRESS"}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )
        )}

        {/* =========================================================================
            TAB 4: FORMS REVIEW
            ========================================================================= */}
        {activeTab === "forms" && (
          !myCase ? (
            <div
              data-testid="forms-empty-state"
              style={{
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "16px",
                padding: "48px 32px",
                textAlign: "center",
                maxWidth: "680px",
                margin: "40px auto",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>📋</div>
              <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                No Forms Ready for Review
              </h3>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                Your petition forms will be generated once your legal team compiles your evidentiary materials.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <ConfigurableFormViewer
                submission={FALLBACK_FORM_SUBMISSION}
                userRole="retained_client"
              />
            </div>
          )
        )}

        {/* =========================================================================
            TAB 5: CASE MILESTONES
            ========================================================================= */}
        {activeTab === "milestones" && (
          !myCase ? (
            <div
              data-testid="milestones-empty-state"
              style={{
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "16px",
                padding: "48px 32px",
                textAlign: "center",
                maxWidth: "680px",
                margin: "40px auto",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>🏁</div>
              <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                No Case Milestones Initialized
              </h3>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                Your legal pathway milestones will be displayed here once your petition matter is opened by your law firm.
              </p>
            </div>
          ) : (
            <Card
              title="Immigration Pathway Milestones"
              subtitle="Transparent progress tracking towards petition filing and adjudication."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {milestones.map((m, idx) => (
                  <div key={m.name} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: m.done ? "#176B50" : "#F1F6F4",
                        border: `2px solid ${m.done ? "#176B50" : "#BDCDC7"}`,
                        color: m.done ? "#FFFFFF" : "#6E7F7C",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >
                      {m.done ? "✓" : idx + 1}
                    </div>
                    <div style={{ flex: 1, paddingBottom: "12px", borderBottom: idx < milestones.length - 1 ? "1px solid #DCE5E1" : "none" }}>
                      <strong style={{ fontSize: "14px", color: m.done ? "#063C3D" : "#445451", display: "block" }}>
                        {m.name}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#6E7F7C" }}>{m.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        )}

        {/* =========================================================================
            TAB 6: CHAT WITH CASE PROCESSING OFFICER (Lawyer Messages)
            ========================================================================= */}
        {activeTab === "messages" && (
          !myCase ? (
            <div
              data-testid="messages-empty-state"
              style={{
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "16px",
                padding: "48px 32px",
                textAlign: "center",
                maxWidth: "680px",
                margin: "40px auto",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>💬</div>
              <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                Direct Attorney Communication Pending
              </h3>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                Direct encrypted messaging with your supervising attorney and lead paralegal will activate once your immigration petition is formally initialized.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <CaseOfficerChatBanner
                caseNumber={myCase?.case_number}
                visaCategory={myCase?.visa_category}
                language={clientLanguage}
                onSelectPrompt={(prompt) => {
                  setChatPromptText(prompt);
                }}
              />

              <SecureMessagingHub
                caseId={myCase?.id}
                isStaffMode={false}
                language={clientLanguage}
                initialReplyText={chatPromptText}
                onSendMessage={(content) => onSendMessage?.(content)}
              />
            </div>
          )
        )}

        {/* =========================================================================
            TAB 7: APPLICANT PROFILE
            ========================================================================= */}
        {activeTab === "profile" && (
          <Card title="Principal Applicant & Dependent Information" subtitle="Civil biodata matching official travel passports.">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  background: "#F8F7F2",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  fontSize: "13px",
                }}
              >
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>LEGAL NAME</span>
                  <strong style={{ color: "#063C3D", fontSize: "14px" }}>
                    {myCase ? myCase.client_name : "Applicant Name Pending"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>DATE OF BIRTH</span>
                  <span style={{ color: "#172322" }}>
                    {myCase?.case_number === "CASE-US-8841" ? "1988-04-12" : (myCase ? "Verified on Passport" : "Pending Intake Submission")}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>CITIZENSHIP / NATIONALITY</span>
                  <span style={{ color: "#172322" }}>
                    {myCase?.case_number === "CASE-US-8841" ? "Ukraine" : (myCase ? myCase.jurisdiction : "Pending Intake")}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>CURRENT RESIDENCE</span>
                  <span style={{ color: "#172322" }}>
                    {myCase?.case_number === "CASE-US-8841" ? "Palo Alto, California, United States" : (myCase ? "Primary Residence on Record" : "Pending Intake")}
                  </span>
                </div>
              </div>

              <h4 style={{ margin: "6px 0 0", fontSize: "14px", color: "#063C3D", fontWeight: 700 }}>
                Dependents (Derivative Beneficiaries)
              </h4>
              {myCase?.case_number === "CASE-US-8841" ? (
                <div style={{ padding: "12px 14px", border: "1px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", background: "#FFFFFF" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#063C3D" }}>Alexander Rostova (Spouse)</strong>
                    <Badge variant="neutral">Derivative Beneficiary</Badge>
                  </div>
                  <small style={{ color: "#6E7F7C" }}>DOB: 1987-11-04 • Nationality: Ukraine • Marriage Certificate verified</small>
                </div>
              ) : (
                <div style={{ padding: "16px", border: "1px dashed #CBD5E1", borderRadius: "8px", fontSize: "12px", color: "#64748B", textAlign: "center", background: "#FFFFFF" }}>
                  No derivative beneficiaries on file for this petition.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* =========================================================================
            TAB 8: RETAINERS & INVOICES
            ========================================================================= */}
        {activeTab === "billing" && (
          <Card title="Retainer Account & Payment Ledger" subtitle="Attorney trust account balances and fee invoices.">
            {invoices.length === 0 ? (
              <div
                data-testid="billing-empty-state"
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "#64748B",
                  background: "#F8FAF9",
                  borderRadius: "8px",
                  border: "1px dashed #CBD5E1",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>💳</div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700, color: "#1E293B" }}>
                  No Invoices or Retainer Ledgers
                </h4>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  No trust retainer invoices have been issued by the firm yet. Invoices published by your legal team will appear here with instant receipt verification.
                </p>
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: "invoice_number", header: "Invoice #", render: (i) => <strong style={{ color: "#063C3D" }}>{i.invoice_number}</strong> },
                  { key: "case_number", header: "Case Reference", render: (i) => <span>{i.case_number}</span> },
                  { key: "amount", header: "Amount", render: (i) => <strong style={{ color: "#0D6866" }}>${i.amount.toLocaleString()}.00</strong> },
                  {
                    key: "status",
                    header: "Status",
                    render: (i) => (
                      <Badge variant={i.status === "paid" ? "success" : i.status === "in_trust" ? "info" : "warning"}>
                        {i.status.toUpperCase()}
                      </Badge>
                    ),
                  },
                  { key: "due_date", header: "Date", render: (i) => <span>{i.due_date}</span> },
                ]}
                data={invoices}
                keyExtractor={(i) => i.id}
              />
            )}
          </Card>
        )}

        {/* =========================================================================
            TAB 9: PRIVACY & SECURITY
            ========================================================================= */}
        {activeTab === "settings" && (
          <Card
            title="Privacy, Multi-Factor Authentication & Account Settings"
            subtitle="Tenant isolation and security controls for your client account."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#063C3D" }}>Two-Factor Authentication (MFA)</strong>
                  <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Protects your immigration documents with an authenticator app.</p>
                </div>
                <Badge variant="success">MFA Enabled</Badge>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#063C3D" }}>Tenant Isolation Guarantee</strong>
                  <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Your data is isolated and protected by server-side object authorization.</p>
                </div>
                <Badge variant="success">Encrypted &amp; Isolated</Badge>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#063C3D" }}>Export Case Evidence Archive</strong>
                  <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Download a complete cryptographically verified ZIP of all uploaded files.</p>
                </div>
                <Button variant="outline" size="sm">Export Records</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Document Dossier Inspector Modal */}
        <DocumentInspectorModal
          isOpen={!!selectedDocForInspection}
          onClose={() => setSelectedDocForInspection(null)}
          document={selectedDocForInspection}
          onDocumentUpdated={(updated) => {
            onDocumentUpdated?.(updated);
            setSelectedDocForInspection(updated);
          }}
          activeRole="retained_client"
          defaultViewMode="workbench"
        />

        {/* Guided Client Onboarding Wizard Modal */}
        {isOnboardingModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "rgba(6, 60, 61, 0.5)",
              backdropFilter: "blur(6px)",
            }}
          >
            <ClientOnboardingWizard
              isModal={true}
              onClose={() => setIsOnboardingModalOpen(false)}
              onComplete={() => setIsOnboardingModalOpen(false)}
            />
          </div>
        )}
      </main>
    </div>
    </>
  );
}
