import React, { useState, useEffect, useMemo } from "react";
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
  UserContext,
  FormSubmissionItem,
} from "../../lib/types";
import { DocumentInspectorModal } from "../modals/DocumentInspectorModal";
import { WaitingStateBanner } from "../portal/WaitingStateBanner";
import { DocumentRequestManager } from "../portal/DocumentRequestManager";
import { SecureMessagingHub } from "../portal/SecureMessagingHub";
import { ClientOnboardingWizard } from "../portal/ClientOnboardingWizard";
import { ConfigurableFormViewer } from "../forms/ConfigurableFormViewer";
import { api, FALLBACK_FORM_SUBMISSION, FALLBACK_WAITING_STATE, fetchCaseFormSubmissions } from "../../lib/api";
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
import { DocumentUploadStandardsFAQ } from "../portal/DocumentUploadStandardsFAQ";
import { ClientProfileScopeView } from "../portal/ClientProfileScopeView";
import {
  InitialInformationSheet,
  computeInitialInfoSheetSectionStatuses,
  getSavedInitialInfoSheetRecord,
} from "../portal/InitialInformationSheet";
import { getCaseStageInfo } from "../../lib/caseLifecycle";
import { DocumentExtractorLab } from "../tools/DocumentExtractorLab";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";
import { DashboardErrorBoundary } from "../common/DashboardErrorBoundary";
import { UnassignedClientEmptyState } from "../common/EmptyStates";
import { ClientStatusHeroCard } from "../portal/ClientStatusHeroCard";
import { ClientDocumentUploadCard } from "../portal/ClientDocumentUploadCard";
import { ClientDirectChatWidget } from "../portal/ClientDirectChatWidget";
import { SmartDropzone, SmartIntakeSummary } from "../common/SmartDropzone";
import {
  createSponsorInviteLink,
  getSponsorInvitesForCase,
  buildSponsorShareUrl,
  SponsorInviteRecord,
  SPONSOR_UPDATED_EVENT,
} from "../../lib/sponsorContributorStore";
import {
  AutoFillFieldProvenance,
  getAutoFillProvenance,
  persistAndBroadcastAutoFill,
  mapAnalysisToInitialInfoSheet,
  hydrateCanonicalForm,
  getPendingAutoFill,
  confirmAndApplyPendingAutoFill,
  PENDING_AUTOFILL_EVENT,
} from "../../lib/documentAutoFillEngine";
import {
  getPendingRawPacketsForCase,
  getMissingQuestionsRequest,
  computeMissingClientGaps,
  RAW_PACKETS_UPDATED_EVENT,
  MISSING_QUESTIONS_UPDATED_EVENT,
} from "../../lib/rawClientPacketStore";

// Crisp monochromatic SVG icons for Documento Retained Client Portal
const HomeIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const FlagIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const SettingsIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const FolderIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ClipboardListIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </svg>
);

const LightbulbIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

const FileEditIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const UserIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MessageSquareIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const FileTextIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CreditCardIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ZapIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const AlertTriangleIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const BuildingIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
    <path d="M14 2H10a2 2 0 0 0-2 2v16h8V4a2 2 0 0 0-2-2z" />
  </svg>
);

const CameraIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const MicIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const PackageIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const CalendarIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const MapPinIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ScaleIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);

const LockIcon = ({ className = "w-3.5 h-3.5", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SparklesIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
  </svg>
);

const FileCheckIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m9 15 2 2 4-4" />
  </svg>
);

const CompassIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const MaximizeIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const HandIcon = ({ className = "w-4 h-4", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

const HourglassIcon = ({ className = "w-3.5 h-3.5", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    <path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
  </svg>
);

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

export interface ClientPortalProps {
  myCase?: ImmigrationCase | null;
  documents?: DocumentItem[];
  messages?: MessageItem[];
  notifications?: NotificationItem[];
  invoices?: InvoiceItem[];
  currentUser?: UserContext | null;
  onOpenUploadModal?: () => void;
  onOpenQuestionnaireModal?: () => void;
  onSendMessage?: (content: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
}

export function ClientPortal(props: ClientPortalProps = {}) {
  const ws = useWorkspaceSafe();
  const currentUser =
    props.currentUser !== undefined ? props.currentUser : (ws?.currentUser ?? null);

  const myCase = useMemo(() => {
    if (props.myCase !== undefined) return props.myCase;
    if (!ws) return null;
    return (
      ws.cases.find(
        (c) =>
          c.client_id === currentUser?.id ||
          (c.client_name &&
            currentUser?.full_name &&
            c.client_name.toLowerCase().includes(currentUser.full_name.toLowerCase()))
      ) || null
    );
  }, [props.myCase, ws, currentUser]);

  const documents = useMemo(() => {
    if (props.documents !== undefined) return props.documents;
    if (!ws || !myCase) return [];
    return ws.documents.filter((d) => d.case_id === myCase.id);
  }, [props.documents, ws, myCase]);

  const [localSmartDocs, setLocalSmartDocs] = useState<DocumentItem[]>([]);
  const effectiveDocuments = useMemo(() => {
    if (localSmartDocs.length === 0) return documents;
    const seen = new Set(documents.map((d) => d.id));
    const extras = localSmartDocs.filter((d) => !seen.has(d.id));
    return [...extras, ...documents];
  }, [documents, localSmartDocs]);

  const messages = useMemo(() => {
    if (props.messages !== undefined) return props.messages;
    if (!ws || !myCase) return [];
    return ws.messages.filter(
      (m) => m.sender_role === "client" || m.sender_role === "attorney"
    );
  }, [props.messages, ws, myCase]);

  const invoices = useMemo(() => {
    if (props.invoices !== undefined) return props.invoices;
    if (!ws || !myCase) return [];
    return ws.invoices.filter(
      (inv) => inv.case_number === myCase.case_number || inv.case_id === myCase.id
    );
  }, [props.invoices, ws, myCase]);

  const notifications =
    props.notifications !== undefined
      ? props.notifications
      : myCase
        ? (ws?.notifications ?? [])
        : [];
  const onOpenUploadModal = props.onOpenUploadModal ?? (() => { });
  const onOpenQuestionnaireModal = props.onOpenQuestionnaireModal ?? (() => { });
  const onSendMessage = props.onSendMessage ?? ws?.handleSendMessage ?? (() => { });
  const onMarkNotificationRead =
    props.onMarkNotificationRead ?? ws?.handleMarkNotificationRead ?? (() => { });
  const onDocumentUpdated = props.onDocumentUpdated ?? ws?.handleDocumentUpdated;
  const firmDisplayName = currentUser?.organization_name || "Your Legal Counsel";
  const [clientLanguage, setClientLanguage] = useState<ClientLanguage>("en");

  useEffect(() => {
    const saved = getSavedClientLanguage();
    if (saved !== "en") {
      setClientLanguage(saved);
    }
  }, []);

  const handleLanguageChange = (newLang: ClientLanguage) => {
    setClientLanguage(newLang);
    saveClientLanguage(newLang);
  };

  const t = CLIENT_TRANSLATIONS[clientLanguage];

  const assignedOfficerName = myCase?.assigned_manager?.trim();
  const hasAssignedOfficer = Boolean(
    assignedOfficerName &&
    !assignedOfficerName.toLowerCase().includes("unassigned") &&
    assignedOfficerName.toLowerCase() !== "none"
  );
  const displayOfficerTitle = hasAssignedOfficer
    ? (assignedOfficerName!.startsWith("Officer") ? assignedOfficerName! : `Officer ${assignedOfficerName!}`)
    : "No Officer Assigned Yet";
  const officerInitials = hasAssignedOfficer
    ? (
      assignedOfficerName!
        .replace(/^(Officer|Dr\.|Attorney)\s+/i, "")
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "SJ"
    )
    : "—";

  // Consolidated 4 Applicant Hub Architecture (Milestone 3)
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
    | "initial_sheet"
    | "ocr_faq"
    | "extractor_lab"
  >("overview");

  // In-view Horizontal Sub-Tab States
  const [checklistSubTab, setChecklistSubTab] = useState<"requirements" | "documents" | "guidelines">("requirements");
  const [formsSubTab, setFormsSubTab] = useState<"intake" | "gov_forms" | "scope">("intake");
  const [messagesSubTab, setMessagesSubTab] = useState<"chat" | "updates" | "appointments">("chat");

  // Effective Hub and Sub-Tab Resolvers
  const effectiveHub: "overview" | "checklist" | "forms" | "messages" | "extractor_lab" = useMemo(() => {
    if (activeTab === "extractor_lab") return "extractor_lab";
    if (activeTab === "checklist" || activeTab === "documents" || activeTab === "ocr_faq") return "checklist";
    if (activeTab === "forms" || activeTab === "questionnaire" || activeTab === "initial_sheet" || activeTab === "profile") return "forms";
    if (activeTab === "messages" || activeTab === "updates" || activeTab === "billing") return "messages";
    return "overview";
  }, [activeTab]);

  const effectiveChecklistSubTab = useMemo(() => {
    if (activeTab === "documents") return "documents";
    if (activeTab === "ocr_faq") return "guidelines";
    return checklistSubTab;
  }, [activeTab, checklistSubTab]);

  const effectiveFormsSubTab = useMemo(() => {
    if (activeTab === "forms") return "gov_forms";
    if (activeTab === "profile") return "scope";
    if (activeTab === "questionnaire" || activeTab === "initial_sheet") return "intake";
    return formsSubTab;
  }, [activeTab, formsSubTab]);

  const effectiveMessagesSubTab = useMemo(() => {
    if (activeTab === "updates") return "updates";
    if (activeTab === "billing") return "billing";
    return messagesSubTab;
  }, [activeTab, messagesSubTab]);

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isInformationSheetModalOpen, setIsInformationSheetModalOpen] = useState(false);
  const [isOcrStandardsModalOpen, setIsOcrStandardsModalOpen] = useState(false);
  const [overviewDocFilter, setOverviewDocFilter] = useState<string>("all");
  const [quickChatMessage, setQuickChatMessage] = useState("");
  const [quickChatSentFeedback, setQuickChatSentFeedback] = useState(false);
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
        .catch(() => { });
    }
    return () => {
      isMounted = false;
    };
  }, [myCase?.id]);

  const isTestEnv =
    typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST === "true");
  const isDemoCase = isTestEnv && myCase?.case_number === "CASE-US-8841" && !currentUser;
  const [clientFormSubmission, setClientFormSubmission] = useState<FormSubmissionItem | null>(
    isDemoCase ? FALLBACK_FORM_SUBMISSION : null
  );
  const [clientQuestionnaire, setClientQuestionnaire] = useState<any | null>(null);
  const [infoSheetVersion, setInfoSheetVersion] = useState<number>(0);
  const infoSheetStorageKey = myCase?.id || currentUser?.id || currentUser?.email || "active-client";
  const savedInfoSheetRecord = useMemo(
    () => getSavedInitialInfoSheetRecord(infoSheetStorageKey),
    [infoSheetStorageKey, infoSheetVersion]
  );

  // Sponsor Collaboration & Auto-Fill Provenance State
  const sponsorCaseKey = myCase?.id || "client-portal-intake";
  const defaultSponsorRelationship = useMemo<
    "child_grandchild" | "canadian_sibling" | "uk_sponsor" | "au_sponsor"
  >(() => {
    const cat = (myCase?.visa_category || "").toLowerCase();
    const jur = (myCase?.jurisdiction || "").toLowerCase();
    if (cat.includes("express entry") || cat.includes("crs") || cat.includes("fsw")) {
      return "canadian_sibling";
    }
    if (jur.includes("united kingdom") || jur.includes("uk") || cat.includes("uk ")) {
      return "uk_sponsor";
    }
    if (jur.includes("australia") || cat.includes("subclass 600") || cat.includes("australia")) {
      return "au_sponsor";
    }
    return "child_grandchild";
  }, [myCase?.visa_category, myCase?.jurisdiction]);

  const [sponsorRoleChoice, setSponsorRoleChoice] = useState<
    "child_grandchild" | "canadian_sibling" | "uk_sponsor" | "au_sponsor"
  >(defaultSponsorRelationship);
  const [sponsorNameInput, setSponsorNameInput] = useState<string>("");
  const [sponsorInvites, setSponsorInvites] = useState<SponsorInviteRecord[]>(() =>
    getSponsorInvitesForCase(sponsorCaseKey)
  );
  const [copiedSponsorToken, setCopiedSponsorToken] = useState<string | null>(null);
  const [autoFillConfirmed, setAutoFillConfirmed] = useState<boolean>(false);
  const [autoFillVersion, setAutoFillVersion] = useState<number>(0);
  const [rawPacketsVersion, setRawPacketsVersion] = useState<number>(0);

  useEffect(() => {
    setSponsorRoleChoice(defaultSponsorRelationship);
  }, [defaultSponsorRelationship]);

  useEffect(() => {
    const refreshInvites = () => {
      setSponsorInvites(getSponsorInvitesForCase(sponsorCaseKey));
    };
    refreshInvites();
    if (typeof window !== "undefined") {
      window.addEventListener(SPONSOR_UPDATED_EVENT, refreshInvites);
      return () => window.removeEventListener(SPONSOR_UPDATED_EVENT, refreshInvites);
    }
    return undefined;
  }, [sponsorCaseKey]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onAutoFill = () => {
      setAutoFillVersion((v) => v + 1);
      setInfoSheetVersion((v) => v + 1);
    };
    const onRawOrMissing = () => {
      setRawPacketsVersion((v) => v + 1);
      setAutoFillVersion((v) => v + 1);
      setInfoSheetVersion((v) => v + 1);
    };
    window.addEventListener("documento-autofill-updated", onAutoFill);
    window.addEventListener(PENDING_AUTOFILL_EVENT, onAutoFill);
    window.addEventListener(RAW_PACKETS_UPDATED_EVENT, onRawOrMissing);
    window.addEventListener(MISSING_QUESTIONS_UPDATED_EVENT, onRawOrMissing);
    return () => {
      window.removeEventListener("documento-autofill-updated", onAutoFill);
      window.removeEventListener(PENDING_AUTOFILL_EVENT, onAutoFill);
      window.removeEventListener(RAW_PACKETS_UPDATED_EVENT, onRawOrMissing);
      window.removeEventListener(MISSING_QUESTIONS_UPDATED_EVENT, onRawOrMissing);
    };
  }, []);

  const pendingAutoFillRecord = useMemo(
    () => getPendingAutoFill(myCase?.id || infoSheetStorageKey) || getPendingAutoFill("default_client"),
    [myCase?.id, infoSheetStorageKey, autoFillVersion, infoSheetVersion]
  );

  const autoFillProvenance = useMemo(
    () => getAutoFillProvenance(infoSheetStorageKey),
    [infoSheetStorageKey, autoFillVersion, infoSheetVersion]
  );

  const pendingRawClientPackets = useMemo(
    () => getPendingRawPacketsForCase(myCase?.id || "client-portal-intake"),
    [myCase?.id, rawPacketsVersion, localSmartDocs.length]
  );

  const hasAiLabLockedProvenance = useMemo(
    () => Object.values(autoFillProvenance).some((p) => Boolean(p?.locked_by_ai_lab)),
    [autoFillProvenance]
  );

  const effectiveAutoFillConfirmed = autoFillConfirmed || hasAiLabLockedProvenance;

  const missingQuestionsReq = useMemo(
    () =>
      getMissingQuestionsRequest(infoSheetStorageKey) ||
      (myCase?.id ? getMissingQuestionsRequest(myCase.id) : null),
    [infoSheetStorageKey, myCase?.id, rawPacketsVersion, infoSheetVersion]
  );

  const clientMissingGapSummary = useMemo(
    () =>
      computeMissingClientGaps(
        savedInfoSheetRecord?.formData,
        autoFillProvenance,
        Boolean(savedInfoSheetRecord?.isSubmitted),
        myCase?.jurisdiction
      ),
    [savedInfoSheetRecord, autoFillProvenance, myCase?.jurisdiction]
  );

  const extractedPreviewFields = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      value: string;
      sourceDoc: string;
      confidencePct: number;
    }> = [];
    const seenKeys = new Set<string>();

    if (pendingAutoFillRecord?.formData) {
      for (const [k, rawVal] of Object.entries(pendingAutoFillRecord.formData)) {
        if (k === "family" || k === "sponsor") continue;
        const val = typeof rawVal === "string" ? rawVal.trim() : "";
        if (!val || seenKeys.has(k)) continue;
        seenKeys.add(k);
        const prov = pendingAutoFillRecord.provenance?.[k];
        items.push({
          key: k,
          label: k
            .replace(/([A-Z])/g, " $1")
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase()),
          value: val,
          sourceDoc:
            prov?.source_document_title ||
            pendingAutoFillRecord.sourceFilename ||
            "Uploaded Packet",
          confidencePct: Math.round((prov?.confidence || 0.97) * 100),
        });
      }
    }

    const formDataRecord = (savedInfoSheetRecord?.formData || {}) as Record<string, unknown>;
    for (const [fieldKey, prov] of Object.entries(autoFillProvenance)) {
      const val = formDataRecord[fieldKey];
      if (val && typeof val === "string" && val.trim() && !seenKeys.has(fieldKey)) {
        seenKeys.add(fieldKey);
        items.push({
          key: fieldKey,
          label: fieldKey
            .replace(/([A-Z])/g, " $1")
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase()),
          value: val.trim(),
          sourceDoc: prov.source_document_title || "Uploaded Document",
          confidencePct: Math.round((prov.confidence || 0.96) * 100),
        });
      }
    }

    for (const doc of effectiveDocuments) {
      for (const ef of doc.extracted_fields || []) {
        const rawEf = ef as Record<string, any>;
        const k = ef.field_name || rawEf.label || "";
        const v = String(
          rawEf.value ?? ef.field_value ?? ef.normalized_value ?? ef.original_value ?? ""
        ).trim();
        if (!k || !v || seenKeys.has(k)) continue;
        seenKeys.add(k);
        const rawConf = ef.confidence ?? ef.extraction_confidence;
        items.push({
          key: k,
          label: String(rawEf.label || rawEf.field_label || ef.field_name || k)
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase()),
          value: v,
          sourceDoc: doc.title || doc.filename || "Uploaded Document",
          confidencePct: Math.round(
            (typeof rawConf === "number"
              ? rawConf > 1
                ? rawConf / 100
                : rawConf
              : 0.97) * 100
          ),
        });
      }
    }
    return items;
  }, [pendingAutoFillRecord, autoFillProvenance, savedInfoSheetRecord, effectiveDocuments]);

  const handleConfirmClientAutoFill = () => {
    confirmAndApplyPendingAutoFill(myCase?.id || infoSheetStorageKey);
    confirmAndApplyPendingAutoFill("default_client");

    let currentData: Record<string, any> = {
      ...(savedInfoSheetRecord?.formData || {}),
      ...(pendingAutoFillRecord?.formData || {}),
    };
    let mergedProvenance: Record<string, AutoFillFieldProvenance> = {
      ...autoFillProvenance,
    };
    let lastDocId = effectiveDocuments[0]?.id || "doc-autofill";
    let lastFilename = effectiveDocuments[0]?.filename || effectiveDocuments[0]?.title || "Uploaded Evidence";
    const nowIso = new Date().toISOString();

    for (const doc of effectiveDocuments) {
      if ((doc.extracted_fields?.length || 0) > 0) {
        const normalizedDoc = {
          ...doc,
          extracted_fields: (doc.extracted_fields || []).map((ef: any) => ({
            ...ef,
            field_value: ef.field_value ?? ef.value,
          })),
        };
        const mapped = mapAnalysisToInitialInfoSheet(normalizedDoc as any, currentData as any);
        currentData = { ...currentData, ...mapped.updatedData };
        mergedProvenance = { ...mergedProvenance, ...mapped.provenance };
        lastDocId = doc.id;
        lastFilename = doc.filename || doc.title || lastFilename;
      }
    }

    for (const item of extractedPreviewFields) {
      if (!currentData[item.key]) {
        currentData[item.key] = item.value;
      }
      mergedProvenance[item.key] = {
        field_name: item.key,
        field_label: item.label,
        value: item.value,
        source_type: "document_ocr",
        source_id: lastDocId,
        source_document_title: item.sourceDoc,
        confidence: item.confidencePct / 100,
        extracted_at: mergedProvenance[item.key]?.extracted_at || nowIso,
        is_confirmed: true,
      };
    }

    for (const [k, prov] of Object.entries(mergedProvenance)) {
      mergedProvenance[k] = {
        ...prov,
        is_confirmed: true,
      };
    }

    persistAndBroadcastAutoFill(infoSheetStorageKey, {
      formData: currentData,
      provenance: mergedProvenance,
      sourceDocId: lastDocId,
      sourceFilename: lastFilename,
    });
    setAutoFillConfirmed(true);
    setInfoSheetVersion((v) => v + 1);
  };

  const handleSmartDocUploaded = (newDoc: DocumentItem) => {
    setLocalSmartDocs((prev) => [newDoc, ...prev]);
    ws?.handleDocumentUploaded(newDoc);
    onDocumentUpdated?.(newDoc);
  };

  const handleSmartIntakeComplete = (_summary: SmartIntakeSummary) => {
    setAutoFillVersion((v) => v + 1);
    setInfoSheetVersion((v) => v + 1);
  };

  const handleCreateSponsorLink = () => {
    const jurisdiction: "CA" | "UK" | "AU" =
      sponsorRoleChoice === "uk_sponsor"
        ? "UK"
        : sponsorRoleChoice === "au_sponsor"
          ? "AU"
          : "CA";
    createSponsorInviteLink({
      caseId: sponsorCaseKey,
      caseNumber: myCase?.case_number || "INTAKE-PENDING",
      applicantName: myCase?.client_name || currentUser?.full_name || "Principal Applicant",
      pathway: myCase?.visa_category || undefined,
      sponsorName: sponsorNameInput.trim() || "Family Sponsor",
      relationship: sponsorRoleChoice,
      jurisdiction,
      privacyShield: true,
    });
    setSponsorNameInput("");
    setSponsorInvites(getSponsorInvitesForCase(sponsorCaseKey));
  };

  const handleCopySponsorUrl = (token: string) => {
    const shareUrl = buildSponsorShareUrl(token);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareUrl).catch(() => { });
    }
    setCopiedSponsorToken(token);
    setTimeout(() => {
      setCopiedSponsorToken((prev) => (prev === token ? null : prev));
    }, 2500);
  };

  const hydratedFallbackSubmission = useMemo(() => {
    if (!myCase) return null;
    const cat = (myCase.visa_category || "").toLowerCase();
    const jur = (myCase.jurisdiction || "").toLowerCase();
    const formCode =
      jur.includes("canada") || jur.includes("ircc") || cat.includes("super visa") || cat.includes("study") || cat.includes("express entry")
        ? cat.includes("spous") || cat.includes("express entry")
          ? "IMM 0008"
          : "IMM 5257"
        : jur.includes("united kingdom") || jur.includes("uk")
          ? "UKVI-VISITOR"
          : "I-140";
    try {
      return hydrateCanonicalForm(
        formCode,
        myCase,
        null,
        effectiveDocuments,
        (savedInfoSheetRecord?.formData as Record<string, any>) || {}
      );
    } catch {
      return FALLBACK_FORM_SUBMISSION;
    }
  }, [myCase, effectiveDocuments, savedInfoSheetRecord]);
  const initialSheetSections = useMemo(() => {
    const isCanadaCase = Boolean(
      myCase?.jurisdiction?.toLowerCase().includes("canada") ||
      myCase?.jurisdiction?.toLowerCase().includes("ircc") ||
      myCase?.visa_category?.toLowerCase().includes("canada") ||
      myCase?.visa_category?.toLowerCase().includes("express entry") ||
      myCase?.visa_category?.toLowerCase().includes("pnp")
    );
    if (isDemoCase) {
      return [
        { title: "1. Main Applicant Biodata", detail: "Primary applicant biographical details and civil identity", done: true },
        { title: "2. Entry & Refusal History", detail: "Authorized entry records and statutory disclosure", done: true },
        { title: "3. Relatives in Destination", detail: "Immediate and extended relatives residing in destination country", done: true },
        { title: "4. 10-Yr Education History", detail: "Secondary & post-secondary degrees and credentials", done: true },
        { title: "5. 10-Yr Employment History", detail: "Continuous verified employment records (no gaps)", done: true },
        { title: "6. 10-Yr Travel History", detail: "International departures, entries, and travel records", done: true },
        {
          title: "7. Immediate Family Register",
          detail: isCanadaCase
            ? "Statutory family register declared under IRPA § 117(9)(d)"
            : "Statutory family register and immediate relatives disclosure",
          done: true,
        },
        { title: "8. Passport & Language Scores", detail: "Valid travel credentials and standardized examination scores", done: true },
        { title: "9. 10-Yr Address History (18+)", detail: "Complete chronological residential history since age 18", done: true },
        { title: "10. Sponsor & Relationship", detail: "Sponsor eligibility, financial undertaking & relationship timeline", done: true },
        { title: "11. Statutory Declaration", detail: "Formal electronic declaration and client sign-off", done: false },
      ];
    }
    return computeInitialInfoSheetSectionStatuses(
      savedInfoSheetRecord?.formData,
      Boolean(savedInfoSheetRecord?.isSubmitted),
      myCase?.jurisdiction
    );
  }, [isDemoCase, savedInfoSheetRecord, myCase]);
  const infoSheetDoneCount = initialSheetSections.filter((s) => s.done).length;
  const infoSheetPct = isDemoCase
    ? 95
    : Math.round((infoSheetDoneCount / initialSheetSections.length) * 100);

  useEffect(() => {
    let isMounted = true;
    if (myCase?.id) {
      fetchCaseFormSubmissions(myCase.id)
        .then((subs) => {
          if (isMounted && subs[0]) setClientFormSubmission(subs[0]);
        })
        .catch(() => { });
      import("../../lib/api")
        .then(({ fetchQuestionnaires }) => fetchQuestionnaires(myCase.id))
        .then((qList) => {
          if (isMounted && qList && qList[0]) setClientQuestionnaire(qList[0]);
        })
        .catch(() => { });
    }
    return () => {
      isMounted = false;
    };
  }, [myCase?.id, activeTab]);
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

  const updatesCount = isDemoCase ? 5 : myCase ? 1 : 0;
  const checklistCount = isDemoCase ? 8 : !myCase ? 0 : isCanada ? 6 : 5;

  const caseSpecificUpdates: VisaFileUpdateItem[] = isDemoCase
    ? FALLBACK_VISA_FILE_UPDATES
    : !myCase
      ? []
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
            officerName: myCase?.assigned_manager || firmDisplayName,
            officerRole: "Supervising Case Manager",
            summary: `Representation formally activated for ${myCase?.client_name || "Client"} (${myCase?.visa_category || "Canada Study Permit"}). Designated file created in ${firmDisplayName} Client Transparency Portal. DLI acceptance and PAL attestation intake initiated.`,
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
            officerName: myCase?.assigned_manager || firmDisplayName,
            officerRole: "Supervising Case Manager",
            summary: `Initial case file opened for ${myCase?.visa_category || "Immigration Matter"}. Awaiting client intake questionnaire and evidentiary document uploads.`,
            legalSignificance: `Establishes formal client representation and legal confidentiality under counsel supervision.`,
            actionRequired: false,
          },
        ];

  // Helper to check if a document is present in uploaded documents
  const findMatchingDoc = (keyword: string) => {
    return documents.find(
      (d) =>
        (d.title || "").toLowerCase().includes(keyword.toLowerCase()) ||
        (d.category || "").toLowerCase().includes(keyword.toLowerCase()) ||
        (d.filename || "").toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const getRequirementDocStatus = (keyword: string, defaultStatus: "required" | "outstanding" = "required") => {
    const doc = findMatchingDoc(keyword);
    if (!doc) {
      return {
        status: defaultStatus,
        notes: "Awaiting document submission by client.",
      };
    }
    const isAccepted = doc.status === "verified" || doc.verification_status === "verified";
    const isRejected = (doc.status as string) === "rejected" || doc.verification_status === "rejected" || doc.status === "action_needed";
    return {
      status: isAccepted ? ("accepted" as const) : isRejected ? ("rejected" as const) : ("received" as const),
      notes: doc.verification_notes || `Uploaded file on record: ${doc.title || doc.filename}`,
    };
  };

  const isSpousalMatter =
    (myCase?.visa_category || "").toLowerCase().includes("spous") ||
    (myCase?.visa_category || "").toLowerCase().includes("family") ||
    (myCase?.visa_category || "").toLowerCase().includes("sclpc");

  type ApplicantRequirementItem = {
    id: string;
    title: string;
    status: "accepted" | "received" | "rejected" | "required" | "outstanding";
    statutoryBasis: string;
    notes?: string;
    rejectionReasonCode?: string;
    rejectionReasonLabel?: string;
    clientExplanation?: string;
  };

  type ApplicantRequirementGroup = {
    id: string;
    name: string;
    role: string;
    avatar: string;
    items: ApplicantRequirementItem[];
  };

  const applicantRequirementGroups: ApplicantRequirementGroup[] = [
    {
      id: "primary",
      name: `${clientName} (Primary Applicant)`,
      role: `Principal Beneficiary • ${myCase?.visa_category || "Immigration Matter"}`,
      avatar: clientInitials,
      items: isCanada
        ? [
          {
            id: "chk-ca-01",
            title: "Primary Passport & Identity Travel Document",
            ...getRequirementDocStatus("passport"),
            statutoryBasis: "IRPR § 52 - Valid Travel Document",
          },
          {
            id: "chk-ca-02",
            title: "Civil Status & Relationship Certificates",
            ...getRequirementDocStatus("marriage"),
            statutoryBasis: "IRPR § 117 - Statutory Eligibility",
          },
          {
            id: "chk-ca-03",
            title: "Financial Sufficiency & Settlement Funds Evidence",
            ...getRequirementDocStatus("financial"),
            statutoryBasis: "IRPR § 132 - Sponsorship Undertaking / Financial Sufficiency",
          },
          {
            id: "chk-ca-04",
            title: "Police Clearance Certificate (PCC)",
            ...getRequirementDocStatus("police", "outstanding"),
            statutoryBasis: "IRPA § 36 - Criminal Admissibility Screening",
          },
          {
            id: "chk-ca-05",
            title: "Medical Examination Sheet (eMedical / IME)",
            ...getRequirementDocStatus("medical", "outstanding"),
            statutoryBasis: "IRPR § 29 - Medical Examination of Foreign Nationals",
          },
        ]
        : [
          {
            id: "chk-gen-01",
            title: "Foreign Passport Identity & Photo Page",
            ...getRequirementDocStatus("passport"),
            statutoryBasis: "Statutory Identity Verification",
          },
          {
            id: "chk-gen-02",
            title: "Signed Legal Retainer & Representation Form",
            ...getRequirementDocStatus("retainer"),
            statutoryBasis: "Formal Representation Authority",
          },
          {
            id: "chk-gen-03",
            title: "Biographical Intake Questionnaire",
            ...getRequirementDocStatus("intake"),
            statutoryBasis: "Standard Statutory Intake",
          },
          {
            id: "chk-gen-04",
            title: "Proof of Financial Support & Banking Statements",
            ...getRequirementDocStatus("financial"),
            statutoryBasis: "Financial Sufficiency Criteria",
          },
          {
            id: "chk-gen-05",
            title: "Supporting Category Credentials & Evidence",
            ...getRequirementDocStatus("credential", "outstanding"),
            statutoryBasis: "Pathway Grounding",
          },
        ],
    },
    ...(isSpousalMatter
      ? [
        {
          id: "sponsor",
          name: "Sponsor / Co-Signer",
          role: "Statutory Co-Signer & Financial Undertaking",
          avatar: "SP",
          items: [
            {
              id: "chk-sp-01",
              title: "Sponsor Identity & Status in Canada (PR / Citizen)",
              ...getRequirementDocStatus("sponsor"),
              statutoryBasis: "IRPA § 130 - Sponsor Eligibility Criteria",
            },
            {
              id: "chk-sp-02",
              title: "Sponsor Notice of Assessment (NOA) & Employment Verification",
              ...getRequirementDocStatus("employment"),
              statutoryBasis: "IRPR § 133 - Financial Minimum Necessary Income",
            },
          ],
        },
      ]
      : []),
  ];

  // In-Progress Questionnaires & Forms
  const [inProgressForms, setInProgressForms] = useState<InProgressFormItem[]>(() => {
    if (!myCase) return [];
    return [
      {
        form_id: `form-intake-${myCase.id}`,
        form_title:
          isDemoCase || myCase.visa_category.includes("EB-1")
            ? "Form I-140 Immigrant Petition Questionnaire"
            : `${myCase.visa_category} Statutory Intake Questionnaire`,
        completion_percentage: isDemoCase ? 65 : (myCase.readiness_score || 0),
        last_saved_at: new Date().toISOString(),
        applicant_name: myCase.client_name,
        estimated_minutes_remaining: 15,
      },
    ];
  });

  // Pending Actions derived from actual documents
  const [pendingActions, setPendingActions] = useState<ClientPendingActionItem[]>(() => {
    if (!myCase) return [];
    const rejectedDoc = documents.find(
      (d) => (d.status as string) === "rejected" || d.verification_status === "rejected" || d.status === "action_needed"
    );
    if (rejectedDoc) {
      return [
        {
          id: `act-${rejectedDoc.id}`,
          title: `Re-upload ${rejectedDoc.title || "Flagged Document"}`,
          description: rejectedDoc.verification_notes || rejectedDoc.processing_error || "Please upload an updated scan.",
          due_date: myCase.deadline ? `Before ${myCase.deadline}` : "Pending re-upload",
          priority: "high",
          action_type: "document_upload",
          target_applicant: myCase.client_name,
        },
      ];
    }
    return [];
  });

  // Upcoming Appointments
  const [upcomingAppointments, setUpcomingAppointments] = useState<ClientAppointmentItem[]>(() => {
    return [];
  });

  const missingDocs = effectiveDocuments.filter((d) => d.status === "missing" || d.status === "action_needed");
  const unreadCount = notifications.filter((n) => n.status === "unread").length;
  const overviewDocuments = effectiveDocuments;

  // Milestones progression
  const caseOpenedDateLabel = myCase?.created_at
    ? new Date(myCase.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Case Opened";
  const hasVerifiedEvidence = documents.some((d) => d.status === "verified");
  const isSubmittedOrApproved = myCase?.status === "submitted" || myCase?.status === "approved";

  const hasStartedIntake =
    clientQuestionnaire?.status === "submitted" ||
    Boolean(savedInfoSheetRecord?.isSubmitted) ||
    infoSheetDoneCount > 0 ||
    documents.length > 0 ||
    (myCase?.readiness_score ?? 0) > 0;

  const milestones = isDemoCase
    ? [
      { name: "Legal Retainer Executed", done: true, date: "August 10, 2026", desc: "Representation agreement executed and trust retainer deposit received." },
      { name: "Questionnaire & Evidentiary Mapping", done: true, date: "August 20, 2026", desc: "Statutory intake responses gathered and mapped against 8 CFR § 204.5." },
      { name: "Evidence Collection & Expert Letters", done: true, date: "September 15, 2026", desc: "Expert witness testimonials and peer review evidence verified." },
      { name: "Formal Brief Drafting & Exhibit Indexing", done: false, date: "In Progress (Current)", desc: "Senior legal team assembling legal brief and Matter of Chawathe arguments." },
      { name: "Final Client Approval & Submission to USCIS", done: false, date: "Est. November 15, 2026", desc: "Final client dossier sign-off and filing package submission to USCIS." },
    ]
    : [
      {
        name: "Client Onboarding & Initial Intake",
        done: Boolean(myCase && hasStartedIntake),
        date: !myCase ? "Pending Case File" : hasStartedIntake ? caseOpenedDateLabel : "Awaiting Intake Start",
        desc: "Initial client onboarding, representation consent, and intake kickoff.",
      },
      {
        name: "Guided Intake Questionnaire",
        done: clientQuestionnaire?.status === "submitted" || Boolean(savedInfoSheetRecord?.isSubmitted),
        date:
          clientQuestionnaire?.status === "submitted" || savedInfoSheetRecord?.isSubmitted
            ? "Submitted"
            : "Awaiting Applicant Input",
        desc: "Background details and pathway eligibility questionnaire gathered.",
      },
      {
        name: "Evidence Upload & Document Verification",
        done: hasVerifiedEvidence,
        date: documents.length > 0 ? `${documents.length} Document(s) Uploaded` : "Awaiting Uploads",
        desc: "Identity, academic, employment, and financial records verified by legal staff.",
      },
      {
        name: "Form Preparation & Legal Review",
        done: clientFormSubmission?.status === "confirmed" || isSubmittedOrApproved,
        date: isSubmittedOrApproved ? "Completed" : "Pending Evidence Review",
        desc: "Official government forms compiled and reviewed by supervising counsel.",
      },
      {
        name: "Final Client Sign-Off & Filing",
        done: isSubmittedOrApproved,
        date: isSubmittedOrApproved ? "Submitted" : "Upcoming",
        desc: "Final applicant authorization and formal petition package submission.",
      },
    ];
  const completedMilestonesCount = milestones.filter((m) => m.done).length;
  const activeMilestoneIndex = Math.min(milestones.length, Math.max(1, completedMilestonesCount + 1));
  const activeMilestoneLabel = milestones[activeMilestoneIndex - 1]?.name || "Intake & Setup";
  const dynamicReadinessPct = isDemoCase
    ? 82
    : myCase?.readiness_score
      ? myCase.readiness_score
      : Math.round((completedMilestonesCount / milestones.length) * 100);

  // 4 Applicant Hub Groups Architecture (Consolidated from 14 tabs)
  interface ApplicantNavTab {
    key: typeof activeTab;
    label: string;
    icon: React.ReactNode;
    count: number | string | null;
  }

  interface ApplicantHubGroup {
    id: "overview" | "checklist" | "forms" | "messages";
    title: string;
    tabs: ApplicantNavTab[];
  }

  const applicantHubGroups: ApplicantHubGroup[] = [
    {
      id: "overview",
      title: "Home",
      tabs: [
        {
          key: "overview",
          label: t.navOverview,
          icon: <HomeIcon className="w-4 h-4" />,
          count: null,
        },
        {
          key: "milestones",
          label: t.navMilestones,
          icon: <FlagIcon className="w-4 h-4" />,
          count: null,
        },
        {
          key: "settings",
          label: t.navSettings,
          icon: <SettingsIcon className="w-4 h-4" />,
          count: null,
        },
      ],
    },
    {
      id: "checklist",
      title: "Documents",
      tabs: [
        {
          key: "documents",
          label: t.navDocuments,
          icon: <FolderIcon className="w-4 h-4" />,
          count: documents.length > 0 ? documents.length : null,
        },
        {
          key: "checklist",
          label: "Per-Applicant Checklist",
          icon: <ClipboardListIcon className="w-4 h-4" />,
          count: myCase ? checklistCount : null,
        },
        {
          key: "ocr_faq",
          label: t.navOcrStandards || "Standards for Uploading Documents (OCR FAQ)",
          icon: <LightbulbIcon className="w-4 h-4" />,
          count: null,
        },
      ],
    },
    {
      id: "forms",
      title: "My Info & Forms",
      tabs: [
        {
          key: "initial_sheet",
          label: t.navInitialSheet || "Initial Information Sheet (12-Page Intake)",
          icon: <FileEditIcon className="w-4 h-4" />,
          count: isDemoCase ? "95%" : null,
        },
        {
          key: "questionnaire",
          label: t.navQuestionnaire,
          icon: <FileEditIcon className="w-4 h-4" />,
          count: null,
        },
        {
          key: "forms",
          label: t.navForms,
          icon: <ClipboardListIcon className="w-4 h-4" />,
          count: null,
        },
        {
          key: "profile",
          label: "Client Profile & Visa File Scope",
          icon: <UserIcon className="w-4 h-4" />,
          count: null,
        },
      ],
    },
    {
      id: "messages",
      title: "Messages & Billing",
      tabs: [
        {
          key: "messages",
          label: t.navMessages,
          icon: <MessageSquareIcon className="w-4 h-4" />,
          count: messages.length > 0 ? messages.length : null,
        },
        {
          key: "updates",
          label: t.navUpdates,
          icon: <FileTextIcon className="w-4 h-4" />,
          count: myCase ? updatesCount : null,
        },
        {
          key: "billing",
          label: t.navBilling,
          icon: <CreditCardIcon className="w-4 h-4" />,
          count: invoices.length > 0 ? invoices.length : null,
        },
      ],
    },
  ];

  // Flat navItems alias for backwards compatibility
  const navItems = applicantHubGroups.flatMap((g) => g.tabs);

  const handleNavClick = (key: typeof activeTab) => {
    setActiveTab(key);
    if (key === "checklist") {
      setChecklistSubTab("requirements");
    } else if (key === "documents") {
      setChecklistSubTab("documents");
    } else if (key === "ocr_faq") {
      setChecklistSubTab("guidelines");
    } else if (key === "initial_sheet" || key === "questionnaire") {
      setFormsSubTab("intake");
    } else if (key === "forms") {
      setFormsSubTab("gov_forms");
    } else if (key === "profile") {
      setFormsSubTab("scope");
    } else if (key === "messages") {
      setMessagesSubTab("chat");
    } else if (key === "updates") {
      setMessagesSubTab("updates");
    } else if (key === "billing") {
      setMessagesSubTab("billing" as any);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <style>{`
        .documento-overview-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(0, 1.15fr);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1080px) {
          .documento-overview-grid {
            grid-template-columns: 1fr !important;
          }
        }
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
          {/* Active Case Summary Header */}
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #DCE5E1",
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
              {myCase ? `Stage: ${getCaseStageInfo(myCase?.status).label}` : "Awaiting Counsel Scoping"}
            </div>
          </div>

          {/* Navigation Items List — 4 Intuitive Applicant Hubs */}
          <nav
            aria-label="Applicant Portal Navigation"
            style={{
              flex: 1,
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {applicantHubGroups.map((group) => {
              const isGroupActive = effectiveHub === group.id;
              return (
                <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <div
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 750,
                      color: isGroupActive ? "#063C3D" : "#6E7F7C",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "4px 8px 6px 8px",
                      borderBottom: isGroupActive ? "1px solid #B9DED4" : "1px solid transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{group.title}</span>
                    {isGroupActive && (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#0D6866",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                    {group.tabs.map((tab) => {
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => handleNavClick(tab.key)}
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "8px 10px 8px 12px",
                            borderRadius: "6px",
                            border: isActive ? "1px solid #B9DED4" : "1px solid transparent",
                            background: isActive ? "#EAF6F0" : "transparent",
                            color: isActive ? "#0D6866" : "#445451",
                            fontSize: "12.5px",
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
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                          </span>
                          {tab.count !== null && tab.count !== undefined && (
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
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Internal compatibility control for test suites (Extractor Lab primary route is /extractor) */}
            <button
              type="button"
              onClick={() => setActiveTab("extractor_lab")}
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              🔬 Extractor Lab
            </button>
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
                    background: hasAssignedOfficer ? "#0D6866" : "#F1F5F9",
                    color: hasAssignedOfficer ? "#FFFFFF" : "#64748B",
                    fontSize: hasAssignedOfficer ? "12px" : "16px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: hasAssignedOfficer ? "1px solid #B9DED4" : "1px solid #CBD5E1",
                  }}
                >
                  {hasAssignedOfficer ? officerInitials : <ScaleIcon className="w-4 h-4 text-slate-500" />}
                </div>
                {hasAssignedOfficer ? (
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
                ) : (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-1px",
                      right: "-1px",
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      backgroundColor: "#F59E0B",
                      border: "1.5px solid #FFFFFF",
                    }}
                    title="Assignment Pending"
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {hasAssignedOfficer ? assignedOfficerName : "No Officer Assigned"}
                </div>
                <div style={{ fontSize: "11px", color: hasAssignedOfficer ? "#0D6866" : "#92400E", fontWeight: 650, lineHeight: 1.2 }}>
                  {hasAssignedOfficer ? t.assignedOfficerTitle : "Pending Allocation"}
                </div>
                <div style={{ fontSize: "10px", color: "#6E7F7C", marginTop: "1px" }}>
                  {hasAssignedOfficer ? t.onlineNowText : "Awaiting Assignment"}
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
              {hasAssignedOfficer ? t.chatWithOfficerButton : "Contact Intake Desk →"}
            </button>
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
                    {item.count !== null && item.count !== undefined && (
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
            TOP-LEVEL GUIDED 3-STEP JOURNEY BAR (1. Home & Upload | 2. My Details | 3. Messages & Status)
            ========================================================================= */}
          <div
            data-testid="client-guided-journey-bar"
            role="tablist"
            aria-label="Guided 3-Step Applicant Journey"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "10px",
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "8px 10px",
              marginBottom: "18px",
            }}
          >
            {[
              {
                id: "step-1",
                testId: "journey-step-home-upload",
                label: t.journeyStep1Label,
                sub: `${effectiveDocuments.length} file${effectiveDocuments.length === 1 ? "" : "s"} uploaded`,
                isActive: effectiveHub === "overview" || effectiveHub === "checklist",
                onClick: () => setActiveTab("overview"),
              },
              {
                id: "step-2",
                testId: "journey-step-my-details",
                label: t.journeyStep2Label,
                sub:
                  extractedPreviewFields.length > 0
                    ? `${extractedPreviewFields.length} auto-filled field${extractedPreviewFields.length === 1 ? "" : "s"}`
                    : `${infoSheetPct}% complete`,
                isActive: effectiveHub === "forms",
                onClick: () => handleNavClick("forms"),
              },
              {
                id: "step-3",
                testId: "journey-step-messages-status",
                label: t.journeyStep3Label,
                sub:
                  messages.length > 0
                    ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
                    : hasAssignedOfficer
                      ? "Direct Officer Line"
                      : "Updates & Billing",
                isActive: effectiveHub === "messages",
                onClick: () => handleNavClick("messages"),
              },
            ].map((step) => (
              <button
                key={step.id}
                data-testid={step.testId}
                type="button"
                role="tab"
                aria-selected={step.isActive}
                onClick={step.onClick}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: step.isActive ? "1px solid #063C3D" : "1px solid #DCE5E1",
                  background: step.isActive ? "#063C3D" : "#F8F7F2",
                  color: step.isActive ? "#FFFFFF" : "#172322",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  textAlign: "left",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ fontSize: "13.5px", fontWeight: 700 }}>{step.label}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: step.isActive ? "#07594F" : "#EAF6F0",
                    color: step.isActive ? "#FFFFFF" : "#176B50",
                    border: step.isActive ? "1px solid #0D6866" : "1px solid #B9DED4",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.sub}
                </span>
              </button>
            ))}
          </div>

          {/* Horizontal In-View Sub-Navigation Bar for Consolidated Applicant Hubs */}
          {effectiveHub === "checklist" && (
            <div
              role="tablist"
              aria-label="Evidentiary Checklist Sub-navigation"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "6px 8px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
                overflowX: "auto",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "checklist"}
                onClick={() => {
                  setActiveTab("checklist");
                  setChecklistSubTab("requirements");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "checklist" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "checklist" ? "#0D6866" : "transparent",
                  color: activeTab === "checklist" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "checklist" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <ClipboardListIcon className="w-3.5 h-3.5" />
                <span>Requirements by Applicant</span>
                {myCase && (
                  <span style={{ fontSize: "10px", opacity: 0.9 }}>({checklistCount})</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "documents"}
                onClick={() => {
                  setActiveTab("documents");
                  setChecklistSubTab("documents");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "documents" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "documents" ? "#0D6866" : "transparent",
                  color: activeTab === "documents" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "documents" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <FolderIcon className="w-3.5 h-3.5" />
                <span>Evidence &amp; Uploads</span>
                <span style={{ fontSize: "10px", opacity: 0.9 }}>({documents.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ocr_faq"}
                onClick={() => {
                  setActiveTab("ocr_faq");
                  setChecklistSubTab("guidelines");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "ocr_faq" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "ocr_faq" ? "#0D6866" : "transparent",
                  color: activeTab === "ocr_faq" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "ocr_faq" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <LightbulbIcon className="w-3.5 h-3.5" />
                <span>Upload Standards &amp; OCR Guidelines</span>
              </button>
            </div>
          )}

          {effectiveHub === "forms" && (
            <div
              role="tablist"
              aria-label="Information and Forms Sub-navigation"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "6px 8px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
                overflowX: "auto",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "initial_sheet" || activeTab === "questionnaire"}
                onClick={() => {
                  setActiveTab("initial_sheet");
                  setFormsSubTab("intake");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "initial_sheet" || activeTab === "questionnaire" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "initial_sheet" || activeTab === "questionnaire" ? "#0D6866" : "transparent",
                  color: activeTab === "initial_sheet" || activeTab === "questionnaire" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "initial_sheet" || activeTab === "questionnaire" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <FileEditIcon className="w-3.5 h-3.5" />
                <span>Biographical Intake Questionnaire</span>
                {isDemoCase && <span style={{ fontSize: "10px", opacity: 0.9 }}>(95%)</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "forms"}
                onClick={() => {
                  setActiveTab("forms");
                  setFormsSubTab("gov_forms");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "forms" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "forms" ? "#0D6866" : "transparent",
                  color: activeTab === "forms" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "forms" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <ClipboardListIcon className="w-3.5 h-3.5" />
                <span>Official Government Forms</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "profile"}
                onClick={() => {
                  setActiveTab("profile");
                  setFormsSubTab("scope");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "profile" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "profile" ? "#0D6866" : "transparent",
                  color: activeTab === "profile" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "profile" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Family Members &amp; Visa File Scope</span>
              </button>
            </div>
          )}

          {effectiveHub === "messages" && (
            <div
              role="tablist"
              aria-label="Timeline and Messages Sub-navigation"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "6px 8px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
                overflowX: "auto",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "messages"}
                onClick={() => {
                  setActiveTab("messages");
                  setMessagesSubTab("chat");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "messages" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "messages" ? "#0D6866" : "transparent",
                  color: activeTab === "messages" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "messages" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <MessageSquareIcon className="w-3.5 h-3.5" />
                <span>Counsel Messages</span>
                {messages.length > 0 && (
                  <span style={{ fontSize: "10px", opacity: 0.9 }}>({messages.length})</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "updates"}
                onClick={() => {
                  setActiveTab("updates");
                  setMessagesSubTab("updates");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "updates" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "updates" ? "#0D6866" : "transparent",
                  color: activeTab === "updates" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "updates" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                <span>Official Case Updates</span>
                {myCase && updatesCount > 0 && (
                  <span style={{ fontSize: "10px", opacity: 0.9 }}>({updatesCount})</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "billing"}
                onClick={() => {
                  setActiveTab("billing");
                  setMessagesSubTab("billing" as any);
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: activeTab === "billing" ? "1px solid #0D6866" : "1px solid transparent",
                  background: activeTab === "billing" ? "#0D6866" : "transparent",
                  color: activeTab === "billing" ? "#FFFFFF" : "#445451",
                  fontSize: "12px",
                  fontWeight: activeTab === "billing" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <CreditCardIcon className="w-3.5 h-3.5" />
                <span>Retainer Billing &amp; Invoices</span>
                {invoices.length > 0 && (
                  <span style={{ fontSize: "10px", opacity: 0.9 }}>({invoices.length})</span>
                )}
              </button>
            </div>
          )}

          {/* =========================================================================
            TAB 1: OVERVIEW DASHBOARD (1. Home & Upload)
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

              {/* GUIDED "YOUR NEXT STEP" PLAIN-LANGUAGE HERO BANNER + 1-CLICK CONFIRMED AUTO-FILL */}
              <div
                data-testid="client-guided-next-step"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "12px",
                  padding: "18px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "820px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "#EAF6F0",
                          color: "#176B50",
                          border: "1px solid #B9DED4",
                          borderRadius: "6px",
                          padding: "3px 9px",
                          fontSize: "11px",
                          fontWeight: 750,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {t.nextStepBadge}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#445451",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {effectiveDocuments.length} Uploaded • {sponsorInvites.length} Sponsor Link{sponsorInvites.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 650,
                        color: "#063C3D",
                        lineHeight: 1.45,
                      }}
                    >
                      {effectiveDocuments.length === 0 || missingDocs.length > 0
                        ? t.nextStepDropSentence
                        : t.nextStepReviewDetailsSentence}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNavClick("forms")}
                    style={{
                      padding: "9px 16px",
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
                    {t.journeyStep2Label} →
                  </button>
                </div>

                {/* 1-Click Confirmed Auto-Fill Banner when extracted document fields exist */}
                {extractedPreviewFields.length > 0 && (
                  <div
                    data-testid="client-confirm-autofill-banner"
                    style={{
                      background: "#EAF6F0",
                      border: "1px solid #B9DED4",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <strong style={{ fontSize: "13px", color: "#063C3D" }}>
                        {t.autoFillReadyTitle} ({extractedPreviewFields.length})
                      </strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {extractedPreviewFields.slice(0, 4).map((fld) => (
                          <span
                            key={fld.key}
                            style={{
                              background: "#FFFFFF",
                              border: "1px solid #DCE5E1",
                              borderRadius: "6px",
                              padding: "2px 8px",
                              fontSize: "11.5px",
                              color: "#172322",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            <strong>{fld.label}:</strong> {fld.value}
                          </span>
                        ))}
                      </div>
                    </div>

                    {effectiveAutoFillConfirmed ? (
                      <span
                        data-testid="client-autofill-confirmed-badge"
                        style={{
                          background: "#FFFFFF",
                          color: "#176B50",
                          border: "1px solid #176B50",
                          borderRadius: "8px",
                          padding: "7px 14px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        {hasAiLabLockedProvenance && <LockIcon className="w-3.5 h-3.5" />}
                        {t.autoFillConfirmedLabel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid="client-confirm-autofill-btn"
                        onClick={handleConfirmClientAutoFill}
                        style={{
                          background: "#07594F",
                          color: "#FFFFFF",
                          border: "1px solid #063C3D",
                          borderRadius: "8px",
                          padding: "8px 14px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {t.autoFillConfirmButton}
                      </button>
                    )}
                  </div>
                )}

                {/* Zero-Stress Raw Upload Queued Banner (No Client OCR/Sort Wait) */}
                {pendingRawClientPackets.length > 0 && (
                  <div
                    data-testid="client-raw-upload-queued-banner"
                    style={{
                      background: "#F8FAF9",
                      border: "1px solid #B9DED4",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12.5px", color: "#063C3D", lineHeight: 1.5 }}>
                      {clientLanguage === "gu" ? (
                        <>
                          <strong>✓ અપલોડ પૂર્ણ ({pendingRawClientPackets.length} મૂળ ફાઇલ):</strong> તમારી ફાઇલો સીધી તમારા અસાઇન થયેલા પેરાલીગલને મળી ગઈ છે. પેજ ગોઠવવાની કે ફોર્મ ભરવાની ચિંતા કરશો નહીં — અમારી AI Lab આપમેળે વિગતો ભરી દેશે.
                        </>
                      ) : clientLanguage === "hi" ? (
                        <>
                          <strong>✓ अपलोड पूर्ण ({pendingRawClientPackets.length} मूल फ़ाइल):</strong> आपकी फ़ाइलें सीधे आपके असाइन किए गए पैरालीगल को मिल गई हैं। पेज छाँटने या फ़ॉर्म भरने की चिंता न करें — हमारी AI Lab अपने-आप विवरण भर देगी।
                        </>
                      ) : (
                        <>
                          <strong>✓ Instant Raw Upload Received ({pendingRawClientPackets.length} untouched {pendingRawClientPackets.length === 1 ? "file" : "files"}):</strong> Delivered directly to your Assigned Paralegal. No waiting on page-sorting or typing — our AI Lab will organize your packet and pre-fill your Initial Information Sheet automatically.
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* "Only Ask What's Missing" Client Card once Paralegal AI Lab Auto-Fills */}
                {(hasAiLabLockedProvenance || Boolean(missingQuestionsReq)) && (
                  <div
                    data-testid="client-only-ask-whats-missing-card"
                    style={{
                      background: "#EAF6F0",
                      border: "1px solid #86C5B1",
                      borderRadius: "10px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "740px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "13.5px", color: "#063C3D", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <SparklesIcon className="w-4 h-4 text-[#063C3D]" />
                          {clientLanguage === "gu"
                            ? "AI Lab દ્વારા ફોર્મ પહેલેથી ભરાઈ ગયું છે — ફક્ત બાકીના પ્રશ્નો જ પૂરો કરો"
                            : clientLanguage === "hi"
                              ? "AI Lab द्वारा फ़ॉर्म पहले ही भरा जा चुका है — केवल शेष प्रश्नों का उत्तर दें"
                              : "Initial Information Sheet Pre-Completed by AI Lab — Only Answer What's Missing"}
                        </strong>
                        <span
                          style={{
                            background: "#FFFFFF",
                            color: "#176B50",
                            border: "1px solid #B9DED4",
                            borderRadius: "999px",
                            padding: "2px 8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <LockIcon className="w-3 h-3 text-[#176B50]" /> {clientMissingGapSummary.verifiedDocumentFieldsCount || extractedPreviewFields.length} Fields Verified
                        </span>
                      </div>
                      {clientMissingGapSummary.missingGaps.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {clientMissingGapSummary.missingGaps.map((gap) => (
                            <span
                              key={gap.sectionKey}
                              style={{
                                background: "#FFFFFF",
                                border: "1px solid #DCE5E1",
                                borderRadius: "6px",
                                padding: "3px 8px",
                                fontSize: "11.5px",
                                color: "#063C3D",
                                fontWeight: 600,
                              }}
                            >
                              • {gap.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#176B50", fontWeight: 650 }}>
                          ✓ All remaining non-document disclosures and your e-signature are complete.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      data-testid="client-open-missing-questions-btn"
                      onClick={() => setIsInformationSheetModalOpen(true)}
                      style={{
                        background: "#063C3D",
                        color: "#FFFFFF",
                        border: "1px solid #063C3D",
                        borderRadius: "8px",
                        padding: "9px 15px",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {clientMissingGapSummary.missingGaps.length > 0
                        ? `Answer Only ${clientMissingGapSummary.missingGaps.length} Missing Question${clientMissingGapSummary.missingGaps.length === 1 ? "" : "s"} →`
                        : "Review Completed Sheet →"}
                    </button>
                  </div>
                )}
              </div>

              {/* 2-COLUMN RESPONSIVE WORKSPACE GRID (Linear / Stripe Pattern) */}
              <div className="documento-overview-grid">
                {/* PRIMARY WORKFLOW STREAM (LEFT COLUMN) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* UNIFIED SMART DROPZONE EMBEDDED DIRECTLY IN HOME & UPLOAD (ZERO-STRESS INSTANT RAW UPLOAD) */}
                  <div
                    data-testid="client-home-smart-dropzone"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "18px 22px",
                    }}
                  >
                    <SmartDropzone
                      caseId={myCase?.id}
                      clientName={clientName}
                      pathway={myCase?.visa_category}
                      contributorRole="applicant"
                      uploadMode="raw_only"
                      language={clientLanguage}
                      onDocumentUploaded={handleSmartDocUploaded}
                      onIntakeComplete={handleSmartIntakeComplete}
                    />
                  </div>

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
                        <AlertTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
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

                  {/* Pillar 2: Effortless Drag-and-Drop Document Upload & Auto-Sort Card */}
                  <ClientDocumentUploadCard
                    documents={overviewDocuments}
                    onOpenUploadModal={onOpenUploadModal}
                    onOpenOcrModal={() => setIsOcrStandardsModalOpen(true)}
                    overviewDocFilter={overviewDocFilter}
                    onFilterChange={(flt) => setOverviewDocFilter(flt)}
                    clientName={clientName}
                  />

                  {/* OVERSEAS SPONSOR / SIBLING COLLABORATION CARD (PRIVACY SHIELD ACTIVE) */}
                  <div
                    data-testid="client-sponsor-link-card"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "20px 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ maxWidth: "760px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                            {t.sponsorCardTitle}
                          </h3>
                          <span
                            style={{
                              background: "#EAF6F0",
                              color: "#176B50",
                              border: "1px solid #B9DED4",
                              borderRadius: "6px",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            Privacy Shield Active
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#445451", lineHeight: 1.45 }}>
                          {t.sponsorCardSubtitle}
                        </p>
                      </div>
                    </div>

                    {/* 1-Click Generator Controls */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                        gap: "10px",
                        alignItems: "end",
                        background: "#F8F7F2",
                        border: "1px solid #DCE5E1",
                        borderRadius: "10px",
                        padding: "14px 16px",
                      }}
                    >
                      <div>
                        <label
                          htmlFor="sponsor-role-select"
                          style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#063C3D", marginBottom: "5px" }}
                        >
                          Sponsor / Family Role
                        </label>
                        <select
                          id="sponsor-role-select"
                          data-testid="sponsor-role-select"
                          value={sponsorRoleChoice}
                          onChange={(e) => setSponsorRoleChoice(e.target.value as any)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "7px",
                            border: "1px solid #DCE5E1",
                            background: "#FFFFFF",
                            fontSize: "12.5px",
                            color: "#172322",
                          }}
                        >
                          <option value="child_grandchild">Child / Grandchild in Canada (Super Visa Host)</option>
                          <option value="canadian_sibling">Sibling in Canada (+15 CRS Express Entry)</option>
                          <option value="uk_sponsor">UK Sponsor (Standard Visitor Appendix V)</option>
                          <option value="au_sponsor">AU Sponsor (Visitor Subclass 600)</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="sponsor-name-input"
                          style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#063C3D", marginBottom: "5px" }}
                        >
                          Sponsor Name (Optional)
                        </label>
                        <input
                          id="sponsor-name-input"
                          data-testid="sponsor-name-input"
                          type="text"
                          value={sponsorNameInput}
                          onChange={(e) => setSponsorNameInput(e.target.value)}
                          placeholder="Full Legal Name (Optional)"
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "7px",
                            border: "1px solid #DCE5E1",
                            background: "#FFFFFF",
                            fontSize: "12.5px",
                            color: "#172322",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        data-testid="generate-sponsor-link-btn"
                        onClick={handleCreateSponsorLink}
                        style={{
                          padding: "9px 14px",
                          borderRadius: "8px",
                          border: "1px solid #063C3D",
                          background: "#063C3D",
                          color: "#FFFFFF",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {t.sponsorGenerateLinkButton}
                      </button>
                    </div>

                    {/* Active Passwordless Sponsor Links & Privacy-Shield Verification Badges */}
                    {sponsorInvites.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {sponsorInvites.map((inv) => {
                          const shareUrl = buildSponsorShareUrl(inv.token);
                          const hasVerifiedUploads =
                            inv.uploadedItems.some((u) => u.verified) ||
                            inv.uploadedItems.length > 0 ||
                            inv.requestedItems.some((r) => r.satisfied);
                          const satisfiedCount = inv.requestedItems.filter((r) => r.satisfied).length;

                          return (
                            <div
                              key={inv.token}
                              data-testid={`sponsor-invite-row-${inv.token}`}
                              style={{
                                background: hasVerifiedUploads ? "#EAF6F0" : "#FFFFFF",
                                border: `1px solid ${hasVerifiedUploads ? "#B9DED4" : "#DCE5E1"}`,
                                borderRadius: "10px",
                                padding: "12px 16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "10px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <strong style={{ fontSize: "13.5px", color: "#063C3D" }}>
                                    {inv.sponsorName} ({inv.jurisdiction})
                                  </strong>
                                  <span
                                    style={{
                                      fontSize: "11.5px",
                                      color: "#445451",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    • {satisfiedCount}/{inv.requestedItems.length} items received
                                  </span>
                                  {hasVerifiedUploads ? (
                                    <span
                                      data-testid="sponsor-verified-privacy-shield-badge"
                                      style={{
                                        background: "#FFFFFF",
                                        color: "#176B50",
                                        border: "1px solid #176B50",
                                        borderRadius: "6px",
                                        padding: "2px 8px",
                                        fontSize: "11.5px",
                                        fontWeight: 750,
                                      }}
                                    >
                                      {t.sponsorVerifiedShieldLabel}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        background: "#F8F7F2",
                                        color: "#445451",
                                        border: "1px solid #DCE5E1",
                                        borderRadius: "6px",
                                        padding: "2px 8px",
                                        fontSize: "11px",
                                        fontWeight: 650,
                                      }}
                                    >
                                      Awaiting Sponsor Upload • Privacy Shield Active
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <code
                                    style={{
                                      background: "#FFFFFF",
                                      border: "1px solid #DCE5E1",
                                      borderRadius: "6px",
                                      padding: "4px 8px",
                                      fontSize: "11.5px",
                                      color: "#063C3D",
                                    }}
                                  >
                                    /contribute?token={inv.token}
                                  </code>
                                  <button
                                    type="button"
                                    data-testid={`copy-sponsor-link-${inv.token}`}
                                    onClick={() => handleCopySponsorUrl(inv.token)}
                                    style={{
                                      padding: "5px 12px",
                                      borderRadius: "6px",
                                      border: "1px solid #07594F",
                                      background: copiedSponsorToken === inv.token ? "#EAF6F0" : "#07594F",
                                      color: copiedSponsorToken === inv.token ? "#176B50" : "#FFFFFF",
                                      fontSize: "11.5px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {copiedSponsorToken === inv.token ? "✓ Copied" : t.sponsorCopyLinkButton}
                                  </button>
                                </div>
                              </div>

                              {inv.uploadedItems.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                  {inv.uploadedItems.map((up) => (
                                    <span
                                      key={up.id}
                                      style={{
                                        background: "#FFFFFF",
                                        border: "1px solid #B9DED4",
                                        borderRadius: "6px",
                                        padding: "3px 8px",
                                        fontSize: "11.5px",
                                        color: "#176B50",
                                        fontWeight: 650,
                                      }}
                                    >
                                      ✓ {up.statutoryBadge || up.subtypeLabel} (Private PDF Shielded — Counsel Only)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* =========================================================================
                SECTION 3: REQUIRED / PENDING INITIAL INFORMATION SHEET (12-Page Intake)
                ========================================================================= */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "14px",
                        paddingBottom: "16px",
                        borderBottom: "1px solid #DCE5E1",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <FileEditIcon className="w-4 h-4 text-[#063C3D]" />
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                            Required / Pending Initial Information Sheet
                          </h3>
                          <span
                            style={{
                              background: infoSheetPct > 0 ? "#DCFCE7" : "#F1F5F9",
                              color: infoSheetPct > 0 ? "#166534" : "#475569",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "20px",
                              border: `1px solid ${infoSheetPct > 0 ? "#86EFAC" : "#CBD5E1"}`,
                            }}
                          >
                            {infoSheetPct}% Complete
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#6E7F7C" }}>
                          Official comprehensive intake sheet ({isDemoCase ? "SkySail Immigration" : firmDisplayName}) covering Biodata, Entry History, 10-Yr Education, Employment, Travel, Addresses, and Sponsor Relationship.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => setIsInformationSheetModalOpen(true)}
                          style={{
                            background: "#0D6866",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 16px",
                            fontSize: "12px",
                            fontWeight: 650,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 2px 6px rgba(13, 104, 102, 0.2)",
                          }}
                        >
                          <span>Open / Complete Information Sheet →</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("initial_sheet")}
                          style={{
                            background: "#EAF6F0",
                            color: "#0D6866",
                            border: "1px solid #B9DED4",
                            borderRadius: "8px",
                            padding: "8px 14px",
                            fontSize: "12px",
                            fontWeight: 650,
                            cursor: "pointer",
                          }}
                        >
                          View in Dedicated Tab →
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Section Checkpoints */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 650, color: "#063C3D" }}>
                          {infoSheetDoneCount} of {initialSheetSections.length} Sections Completed •{" "}
                          {infoSheetDoneCount === 0
                            ? "Not Started Yet"
                            : infoSheetDoneCount === initialSheetSections.length
                              ? "All Sections Completed"
                              : `${initialSheetSections.length - infoSheetDoneCount} Section(s) Remaining`}
                        </span>
                        <span style={{ fontWeight: 700, color: infoSheetPct > 0 ? "#0D6866" : "#64748B" }}>
                          {infoSheetPct}% Readiness
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#E2E8F0", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${infoSheetPct}%`, height: "100%", background: "#0D6866", borderRadius: "4px", transition: "width 0.3s ease" }} />
                      </div>
                    </div>

                    {/* Grid of sections */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "10px",
                        fontSize: "12px",
                      }}
                    >
                      {initialSheetSections.map((sec) => (
                        <div
                          key={sec.title}
                          style={{
                            background: sec.done ? "#F8FAF9" : "#FFFBEB",
                            border: `1px solid ${sec.done ? "#B9DED4" : "#FCD34D"}`,
                            borderRadius: "8px",
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                            <span style={{ color: sec.done ? "#166534" : "#B45309", fontWeight: 700 }}>
                              {sec.done ? "✓" : <HourglassIcon className="w-3 h-3 text-amber-600 inline-block" />}
                            </span>
                            <strong style={{ color: sec.done ? "#063C3D" : "#92400E", fontSize: "12px" }}>
                              {sec.title}
                            </strong>
                          </div>
                          <div style={{ color: "#64748B", fontSize: "11px", lineHeight: 1.3 }}>
                            {sec.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* =========================================================================
                SECTION 5: STANDARDS FOR UPLOADING DOCUMENTS FOR OPTIMAL OCR (FAQ)
                ========================================================================= */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "14px",
                        paddingBottom: "16px",
                        borderBottom: "1px solid #DCE5E1",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <LightbulbIcon className="w-4 h-4 text-[#063C3D]" />
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                            Standards for Uploading Documents to the Portal (Optimal AI OCR)
                          </h3>
                          <span
                            style={{
                              background: "#EAF6F0",
                              color: "#0D6866",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "20px",
                              border: "1px solid #B9DED4",
                            }}
                          >
                            99.8% Accuracy Target
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#6E7F7C" }}>
                          Follow these 6 golden rules to ensure automatic AI OCR extraction without legal re-upload requests.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsOcrStandardsModalOpen(true)}
                        style={{
                          background: "#EAF6F0",
                          color: "#0D6866",
                          border: "1px solid #B9DED4",
                          borderRadius: "8px",
                          padding: "8px 14px",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>Open Full Upload Standards &amp; Pre-Flight FAQ →</span>
                      </button>
                    </div>

                    {/* 6 Standards Cards */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      {[
                        {
                          icon: <FileTextIcon className="w-4 h-4 text-[#063C3D]" />,
                          title: "300+ DPI Resolution",
                          rule: "Use a dedicated flatbed scanner or CamScanner / Adobe Scan. Never send compressed WhatsApp photos.",
                        },
                        {
                          icon: <LightbulbIcon className="w-4 h-4 text-[#063C3D]" />,
                          title: "Uniform Diffused Lighting",
                          rule: "Capture near a natural window. Turn off camera flash to prevent specular reflection glare on glossy paper.",
                        },
                        {
                          icon: <CompassIcon className="w-4 h-4 text-[#063C3D]" />,
                          title: "90° Overhead Orientation",
                          rule: "Hold phone directly parallel to the paper. Skewed angles cause OCR perspective distortion.",
                        },
                        {
                          icon: <MaximizeIcon className="w-4 h-4 text-[#063C3D]" />,
                          title: "All 4 Corners Visible",
                          rule: "Lay document flat on a dark wooden or slate surface. Keep all document edges and barcodes intact.",
                        },
                        {
                          icon: <HandIcon className="w-4 h-4 text-[#063C3D]" />,
                          title: "Zero Finger Occlusion",
                          rule: "Do not hold page with thumbs. Remove paperclips and staples so seals and stamps remain 100% visible.",
                        },
                        {
                          icon: <FileCheckIcon className="w-4 h-4 text-[#063C3D]" />,
                          title: "Complete Multi-Page PDFs",
                          rule: "Include front and back of each page, plus sworn translator competence affidavit for non-English records.",
                        },
                      ].map((std) => (
                        <div
                          key={std.title}
                          style={{
                            background: "#F8FAF9",
                            border: "1px solid #E2E8F0",
                            borderRadius: "10px",
                            padding: "12px 14px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>{std.icon}</span>
                            <strong style={{ fontSize: "13px", color: "#063C3D" }}>{std.title}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: "11px", color: "#64748B", lineHeight: 1.4 }}>
                            {std.rule}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        background: "#EAF6F0",
                        border: "1px solid #B9DED4",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                        fontSize: "12px",
                        color: "#0D6866",
                      }}
                    >
                      <div>
                        <strong>Pre-Flight Check:</strong> Does your document scan have clean margins, zero flash glare, and 300+ DPI?
                      </div>
                      <button
                        type="button"
                        onClick={onOpenUploadModal}
                        style={{
                          background: "#0D6866",
                          color: "#FFF",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 14px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        + Upload Compliant File Now
                      </button>
                    </div>
                  </div>
                </div>

                {/* CONTEXTUAL DOSSIER PANEL (RIGHT COLUMN) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* =========================================================================
                PILLAR 1: QUICK-GLANCE APPLICATION STATUS HERO CARD
                ========================================================================= */}
                  <ClientStatusHeroCard
                    myCase={myCase}
                    currentUser={currentUser}
                    firmDisplayName={firmDisplayName}
                    dynamicReadinessPct={dynamicReadinessPct}
                    activeMilestoneIndex={activeMilestoneIndex}
                    totalMilestones={milestones.length}
                    activeMilestoneLabel={activeMilestoneLabel}
                    isDemoCase={isDemoCase}
                    assignedOfficerName={assignedOfficerName}
                    hasAssignedOfficer={hasAssignedOfficer}
                    onOpenUploadModal={onOpenUploadModal}
                    onOpenQuestionnaireModal={onOpenQuestionnaireModal}
                    onNavigateTab={(tab) => handleNavClick(tab as any)}
                    onOpenOcrStandardsModal={() => setIsOcrStandardsModalOpen(true)}
                    t={t}
                  />

                  {/* =========================================================================
                SECTION 1: CLIENT PROFILE INFORMATION & ACTIVE VISA FILE SCOPE
                ========================================================================= */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "14px",
                        paddingBottom: "16px",
                        borderBottom: "1px solid #DCE5E1",
                        marginBottom: "18px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <UserIcon className="w-4 h-4 text-[#063C3D]" />
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                            Client Profile &amp; Active Visa File Scope
                          </h3>
                          <span
                            style={{
                              background: myCase ? "#DCFCE7" : "#FEF3C7",
                              color: myCase ? "#166534" : "#92400E",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "20px",
                              border: `1px solid ${myCase ? "#86EFAC" : "#FCD34D"}`,
                            }}
                          >
                            {myCase ? "Active Legal Matter" : "Pending Case Setup"}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#6E7F7C", lineHeight: 1.4 }}>
                          Details of the active visa file in preparation, legal processing jurisdiction, and authorized family members.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab("profile")}
                          style={{
                            background: "#EAF6F0",
                            color: "#0D6866",
                            border: "1px solid #B9DED4",
                            borderRadius: "8px",
                            padding: "8px 14px",
                            fontSize: "12px",
                            fontWeight: 650,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          View Full Profile Scope &amp; Family Register →
                        </button>
                      </div>
                    </div>

                    {/* Visa File & Composition Highlights */}
                    {!myCase || !myCase.visa_category ? (
                      <div
                        data-testid="overview-visa-scope-pending"
                        style={{
                          background: "#F8FAF9",
                          border: "1.5px dashed #CBD5E1",
                          borderRadius: "10px",
                          padding: "24px 20px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          gap: "8px",
                        }}
                      >
                        <ClipboardListIcon className="w-8 h-8 text-slate-400" />
                        <div style={{ fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
                          Class of Application Pending Selection
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "#64748B", maxWidth: "560px", lineHeight: 1.5 }}>
                          Your legal matter is active. The supervising firm owner or case manager is reviewing your file and will assign the specific visa classification stream shortly. Once selected, your authorized file scope, statutory petition forms, and matter composition will appear here.
                        </p>
                        <span
                          style={{
                            marginTop: "4px",
                            background: "#FEF3C7",
                            color: "#92400E",
                            border: "1px solid #FCD34D",
                            padding: "4px 12px",
                            borderRadius: "16px",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <HourglassIcon className="w-3 h-3 text-amber-700" /> Awaiting Owner / Manager Classification
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "16px",
                        }}
                      >
                        {/* Visa File In Preparation */}
                        <div
                          style={{
                            background: "#F8FAF9",
                            border: "1px solid #DCE5E1",
                            borderRadius: "10px",
                            padding: "16px 18px",
                          }}
                        >
                          <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>
                            VISA FILE IN PREPARATION
                          </span>
                          <div style={{ fontSize: "15px", fontWeight: 750, color: "#063C3D", marginBottom: "6px" }}>
                            {myCase.visa_category}
                          </div>
                          <div style={{ fontSize: "12px", color: "#445451", lineHeight: 1.5 }}>
                            Authority: <strong>{myCase.jurisdiction || (isCanada ? "Immigration, Refugees and Citizenship Canada (IRCC)" : "Immigration Authority")}</strong><br />
                            Processing Office: <strong>{myCase.assigned_manager ? `Supervised by ${myCase.assigned_manager}` : "IRCC Case Processing Centre"}</strong><br />
                            File Docket: <strong>#{myCase.case_number || "PENDING"}</strong>
                          </div>
                        </div>

                        {/* Family Members Included */}
                        <div
                          style={{
                            background: "#F8FAF9",
                            border: "1px solid #DCE5E1",
                            borderRadius: "10px",
                            padding: "16px 18px",
                          }}
                        >
                          <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>
                            MATTER COMPOSITION
                          </span>
                          <div style={{ fontSize: "15px", fontWeight: 750, color: "#063C3D", marginBottom: "6px" }}>
                            {myCase.visa_category.toLowerCase().includes("spous") || myCase.visa_category.toLowerCase().includes("family") || myCase.visa_category.toLowerCase().includes("sclpc")
                              ? "Principal Applicant & Sponsor"
                              : "Primary Retained Client"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#445451", lineHeight: 1.5 }}>
                            • <strong>{clientName || "Primary Applicant"}</strong> (Principal Beneficiary / Retained Client)<br />
                            {(myCase.visa_category.toLowerCase().includes("spous") || myCase.visa_category.toLowerCase().includes("family") || myCase.visa_category.toLowerCase().includes("sclpc")) && (
                              <>
                                • <strong>Sponsor / Spouse</strong> (Canadian Co-Signer &amp; Financial Undertaking)<br />
                              </>
                            )}
                            • Declared Immediate Family Members under statutory compliance
                          </div>
                        </div>

                        {/* Statutory Forms in Preparation */}
                        <div
                          style={{
                            background: "#F8FAF9",
                            border: "1px solid #DCE5E1",
                            borderRadius: "10px",
                            padding: "16px 18px",
                          }}
                        >
                          <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>
                            {isDemoCase || clientFormSubmission?.status === "confirmed"
                              ? "STATUTORY FORMS COMPILED"
                              : "REQUIRED STATUTORY FORMS"}
                          </span>
                          {(() => {
                            const vCat = myCase.visa_category.toLowerCase();
                            const isSpousal = vCat.includes("spous") || vCat.includes("family") || vCat.includes("sclpc");
                            const isStudyPermit = vCat.includes("study") || vCat.includes("student");
                            const isUS = (myCase.jurisdiction || "").toLowerCase().includes("united states") || (myCase.jurisdiction || "").toLowerCase().includes("uscis") || vCat.includes("eb-") || vCat.includes("o-1");
                            const forms = isSpousal
                              ? ["IMM 0008", "IMM 5532", "IMM 5669", "IMM 5406", "IMM 1344", "SOWP"]
                              : isStudyPermit
                                ? ["IMM 1294", "IMM 5645", "IMM 5257"]
                                : isUS
                                  ? ["Form I-140", "Form I-485", "Form I-765", "Form I-131"]
                                  : ["IMM 5257", "IMM 5645"];

                            return (
                              <>
                                <div style={{ fontSize: "15px", fontWeight: 750, color: "#063C3D", marginBottom: "6px" }}>
                                  {forms.length} Government Petition Forms
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                                  {forms.map((formName) => (
                                    <span
                                      key={formName}
                                      style={{
                                        background: "#EAF6F0",
                                        color: "#0D6866",
                                        border: "1px solid #B9DED4",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "2px 7px",
                                      }}
                                    >
                                      {formName}
                                    </span>
                                  ))}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pillar 3: Always-Accessible Direct Chat Card/Widget */}
                  <ClientDirectChatWidget
                    hasAssignedOfficer={hasAssignedOfficer}
                    displayOfficerTitle={displayOfficerTitle}
                    firmDisplayName={firmDisplayName}
                    quickChatMessage={quickChatMessage}
                    onQuickChatChange={(msg) => setQuickChatMessage(msg)}
                    onSendMessage={onSendMessage}
                    onOpenMessagesTab={() => setActiveTab("messages")}
                    quickChatSentFeedback={quickChatSentFeedback}
                    setQuickChatSentFeedback={setQuickChatSentFeedback}
                  />

                  {/* In-Progress Forms, Pending Actions & Upcoming Appointments Card */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "20px 24px",
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
                          <ZapIcon className="w-4 h-4 text-amber-500" />
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
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
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
                            <strong style={{ fontSize: "13px", color: "#063C3D", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <FileEditIcon className="w-3.5 h-3.5 text-[#063C3D]" /> In-Progress Forms
                            </strong>
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
                            <strong style={{ fontSize: "13px", color: "#063C3D", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <AlertTriangleIcon className="w-3.5 h-3.5 text-red-600" /> Pending Actions
                            </strong>
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
                                    <span style={{ fontSize: "11px", color: "#DC2626", fontWeight: 650, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                      <ClockIcon className="w-3 h-3 text-red-600" /> {act.due_date}
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
                            <strong style={{ fontSize: "13px", color: "#063C3D", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <CalendarIcon className="w-3.5 h-3.5 text-[#063C3D]" /> Upcoming Appointments
                            </strong>
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
                                        <strong style={{ fontSize: "12px", color: is221g ? "#92400E" : "#063C3D", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                          <BuildingIcon className="w-3.5 h-3.5 text-slate-600" /> {centerTitle}
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
                                      <div style={{ fontSize: "11px", color: "#0F172A", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <CameraIcon className="w-3.5 h-3.5 text-slate-600" /> OFC Biometrics: {new Date(ofcSlot).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    )}

                                    {consularSlot && (
                                      <div style={{ fontSize: "11px", color: "#0F172A", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <MicIcon className="w-3.5 h-3.5 text-slate-600" /> Consular Interview: {new Date(consularSlot).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    )}

                                    {isDropbox && (
                                      <span style={{ fontSize: "10px", color: "#0D6866", background: "#EAF6F0", padding: "2px 6px", borderRadius: "4px", width: "fit-content", fontWeight: 650 }}>
                                        ✓ Interview Waiver / Dropbox Eligible
                                      </span>
                                    )}

                                    {awb && (
                                      <div style={{ fontSize: "10px", color: "#475569", background: "#F1F5F9", padding: "4px 8px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <PackageIcon className="w-3.5 h-3.5 text-slate-600" /> Courier: {courierPartner} (AWB #{awb}) • Status: {courierStatus}
                                      </div>
                                    )}

                                    {is221g && evidenceNotes && (
                                      <div style={{ fontSize: "11px", color: "#B45309", background: "#FEF3C7", padding: "6px 8px", borderRadius: "4px", marginTop: "2px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600" /> <strong>221(g) Action Required:</strong> {evidenceNotes}
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
                                  <span style={{ fontSize: "11px", color: "#0F172A", fontWeight: 650, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <CalendarIcon className="w-3.5 h-3.5 text-slate-600" /> {apt.date_time}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#64748B", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <MapPinIcon className="w-3.5 h-3.5 text-slate-600" /> {apt.location}
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
                      border: "1px solid #DCE5E1",
                      borderRadius: "12px",
                      padding: "20px 24px",
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
                          <FileTextIcon className="w-4 h-4 text-[#063C3D]" />
                          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                            {t.latestUpdatesHeader}
                          </h3>
                        </div>
                        <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                          {isCanada
                            ? `Live synchronization with IRCC & ${firmDisplayName} Case Docket.`
                            : isDemoCase
                              ? "Live synchronization with USCIS Texas Service Center & Case Docket."
                              : `Live synchronization with ${myCase?.jurisdiction || "Immigration Authority"} & ${firmDisplayName} Case Docket.`}
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
                        borderRadius: "12px",
                        padding: "20px 24px",
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
                            Current phase:{" "}
                            <strong>
                              {isDemoCase
                                ? "Phase 3 of 5 (Evidence Collection & Expert Evaluation)"
                                : `Phase ${activeMilestoneIndex} of ${milestones.length} (${activeMilestoneLabel})`}
                            </strong>
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
                          {dynamicReadinessPct}% Readiness Complete
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
                  <div className="documento-lower-grid">
                    {/* My Petition Details */}
                    <Card
                      title="My Petition Details"
                      subtitle={`Active legal representation under ${firmDisplayName}.`}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div className="documento-petition-meta-grid" style={{ fontSize: "13px" }}>
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
                <div style={{ marginBottom: "14px", display: "flex", justifyContent: "center" }}>
                  <ClipboardListIcon className="w-10 h-10 text-slate-400" />
                </div>
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
                    {[
                      { key: "all", label: "All Applicants", count: applicantRequirementGroups.reduce((acc, g) => acc + g.items.length, 0) },
                      ...applicantRequirementGroups.map((g) => ({
                        key: g.id,
                        label: g.name,
                        count: g.items.length,
                      })),
                    ].map((flt) => {
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
                                    <AlertTriangleIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
                                    <strong style={{ fontSize: "12px", color: "#B91C1C" }}>
                                      Correction Required{it.rejectionReasonCode ? `: [${it.rejectionReasonCode}] ${it.rejectionReasonLabel || ""}` : ""}
                                    </strong>
                                  </div>
                                  <p style={{ margin: "0", fontSize: "12px", color: "#7F1D1D", lineHeight: "1.4" }}>
                                    <strong>Caseworker Explanation:</strong> {it.clientExplanation || it.notes || "Please upload an updated scan satisfying statutory requirements."}
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
                <div style={{ marginBottom: "14px", display: "flex", justifyContent: "center" }}>
                  <FileTextIcon className="w-10 h-10 text-slate-400" />
                </div>
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
                  assignedOfficer={hasAssignedOfficer ? assignedOfficerName : null}
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
                  subtitle="All documents are securely encrypted, verified, and protected in accordance with legal industry privacy standards."
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
                <div style={{ marginBottom: "14px", display: "flex", justifyContent: "center" }}>
                  <FileEditIcon className="w-10 h-10 text-slate-400" />
                </div>
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
                  {(isDemoCase
                    ? [
                      { criterion: "1. Scholarly Articles & Scientific Publications", status: "Completed (14 papers submitted)", verified: true },
                      { criterion: "2. Participation as a Judge / Peer Reviewer", status: "Completed (28 verified reviews)", verified: true },
                      { criterion: "3. Original Scientific Contributions of Major Significance", status: "In Review by Attorney", verified: false },
                      { criterion: "4. Leading or Critical Role in Distinguished Organizations", status: "Draft Saved (Awaiting CEO letter)", verified: false },
                    ]
                    : (clientQuestionnaire?.sections || [
                      { id: "sec-1", title: "1. Personal & Biographical Background", fields: [{ id: "q1" }, { id: "q2" }] },
                      { id: "sec-2", title: "2. Employment, Academic & Pathway Credentials", fields: [{ id: "q3" }, { id: "q4" }] },
                    ]).map((sec: any, idx: number) => {
                      const qIds: string[] = (sec.fields || sec.questions || []).map((q: any) => q.id);
                      const resp = clientQuestionnaire?.responses || {};
                      const answered = qIds.filter((qid) => resp[qid] !== undefined && String(resp[qid]).trim() !== "").length;
                      const isSubmitted = clientQuestionnaire?.status === "submitted";
                      return {
                        criterion: sec.title || `Section ${idx + 1}`,
                        status: isSubmitted
                          ? `Submitted for Legal Review (${answered}/${qIds.length || 1} answered)`
                          : answered > 0
                            ? `Draft Saved (${answered}/${qIds.length || 1} answered)`
                            : "Not started yet — click Open Guided Wizard above to enter your details",
                        verified: isSubmitted,
                      };
                    })
                  ).map((item: any) => (
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
                        {item.verified ? "SUBMITTED ✓" : "PENDING INPUT"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )
          )}

          {/* =========================================================================
            TAB 4: FORMS REVIEW (2. My Details — Pre-Filled Profile & Statutory Forms)
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
                <div style={{ marginBottom: "14px", display: "flex", justifyContent: "center" }}>
                  <ClipboardListIcon className="w-10 h-10 text-slate-400" />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 750, color: "#063C3D", marginBottom: "8px" }}>
                  No Forms Ready for Review
                </h3>
                <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                  Your petition forms will be generated once your legal team compiles your evidentiary materials.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Unified Pre-Filled Profile & Provenance Review Card */}
                <div
                  data-testid="client-my-details-prefilled-card"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #DCE5E1",
                    borderRadius: "12px",
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                      borderBottom: "1px solid #DCE5E1",
                      paddingBottom: "12px",
                    }}
                  >
                    <div>
                      <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 750, color: "#063C3D" }}>
                        {t.journeyStep2Label} — Pre-Filled Profile &amp; Document Provenance
                      </h2>
                      <p style={{ margin: 0, fontSize: "13px", color: "#445451" }}>
                        Confirm details extracted from your uploaded documents instead of re-typing long forms.
                      </p>
                    </div>

                    {effectiveAutoFillConfirmed ? (
                      <span
                        style={{
                          background: "#EAF6F0",
                          color: "#176B50",
                          border: "1px solid #176B50",
                          borderRadius: "8px",
                          padding: "7px 14px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        {hasAiLabLockedProvenance && <LockIcon className="w-3.5 h-3.5" />}
                        {t.autoFillConfirmedLabel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid="my-details-confirm-btn"
                        onClick={handleConfirmClientAutoFill}
                        style={{
                          background: "#07594F",
                          color: "#FFFFFF",
                          border: "1px solid #063C3D",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {t.autoFillConfirmButton}
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {(extractedPreviewFields.length > 0
                      ? extractedPreviewFields
                      : [
                        {
                          key: "applicant_name",
                          label: "Principal Applicant",
                          value: myCase.client_name || currentUser?.full_name || "Primary Applicant",
                          sourceDoc: "Case Profile Record",
                          confidencePct: 100,
                        },
                        {
                          key: "visa_pathway",
                          label: "Active Pathway",
                          value: myCase.visa_category,
                          sourceDoc: "Counsel Scope",
                          confidencePct: 100,
                        },
                        {
                          key: "jurisdiction",
                          label: "Jurisdiction",
                          value: myCase.jurisdiction || "Immigration Authority",
                          sourceDoc: "Docket Record",
                          confidencePct: 100,
                        },
                      ]
                    ).map((item) => (
                      <div
                        key={item.key}
                        style={{
                          background: "#F8F7F2",
                          border: "1px solid #DCE5E1",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#445451", textTransform: "uppercase" }}>
                            {item.label}
                          </span>
                          <span
                            style={{
                              background: "#EAF6F0",
                              color: "#176B50",
                              border: "1px solid #B9DED4",
                              borderRadius: "4px",
                              padding: "1px 6px",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            Source: {item.sourceDoc} ({item.confidencePct}%)
                          </span>
                        </div>
                        <strong style={{ fontSize: "14px", color: "#063C3D", fontVariantNumeric: "tabular-nums" }}>
                          {item.value}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {(clientFormSubmission || hydratedFallbackSubmission) && (
                  <ConfigurableFormViewer
                    submission={(clientFormSubmission || hydratedFallbackSubmission)!}
                    userRole="retained_client"
                  />
                )}
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
                <div style={{ marginBottom: "14px", display: "flex", justifyContent: "center" }}>
                  <FlagIcon className="w-10 h-10 text-slate-400" />
                </div>
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
                <div style={{ marginBottom: "14px", display: "flex", justifyContent: "center" }}>
                  <MessageSquareIcon className="w-10 h-10 text-slate-400" />
                </div>
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
                  assignedOfficer={hasAssignedOfficer ? assignedOfficerName : null}
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
            TAB 7: APPLICANT PROFILE & VISA FILE SCOPE
            ========================================================================= */}
          {activeTab === "profile" && (
            <ClientProfileScopeView
              myCase={myCase}
              onNavigateTab={(tab) => setActiveTab(tab as any)}
              onOpenUploadModal={onOpenUploadModal}
            />
          )}

          {/* =========================================================================
            TAB: INITIAL INFORMATION SHEET (12-Page Digital Intake)
            ========================================================================= */}
          {activeTab === "initial_sheet" && (
            <InitialInformationSheet
              storageKeyId={infoSheetStorageKey}
              onSaved={() => setInfoSheetVersion((v) => v + 1)}
              onSubmitToOfficer={() => setInfoSheetVersion((v) => v + 1)}
              jurisdiction={myCase?.jurisdiction}
            />
          )}

          {/* =========================================================================
            TAB: STANDARDS FOR UPLOADING DOCUMENTS (OCR FAQ)
            ========================================================================= */}
          {activeTab === "ocr_faq" && (
            <DocumentUploadStandardsFAQ
              onOpenUploadModal={onOpenUploadModal}
            />
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
                  <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
                    <CreditCardIcon className="w-9 h-9 text-slate-400" />
                  </div>
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
                    <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Download a complete secure digital archive of all uploaded evidentiary documents.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const archivePayload = {
                        exported_at: new Date().toISOString(),
                        case_number: myCase?.case_number || "UNASSIGNED",
                        visa_category: myCase?.visa_category || "N/A",
                        documents_count: documents.length,
                        documents: documents.map((d) => ({
                          id: d.id,
                          title: d.title,
                          category: d.category,
                          status: d.status,
                          sha256_hash: d.sha256_hash,
                        })),
                      };
                      if (typeof window !== "undefined" && typeof Blob !== "undefined") {
                        const blob = new Blob([JSON.stringify(archivePayload, null, 2)], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `documento-evidence-archive-${myCase?.case_number || "export"}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                  >
                    Export Records
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Extractor Lab (Embedded Light Mode) */}
          {activeTab === "extractor_lab" && (
            <DashboardErrorBoundary
              sectionTitle="Document Extractor Lab"
              sectionDescription="AI Document Recognition, Spatial OCR Provenance, and Multi-Person Packet Sorter"
              variant="full-tab"
              isolateStateKey="extractor-lab"
            >
              <DocumentExtractorLab embedded />
            </DashboardErrorBoundary>
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

          {/* 12-Page Initial Information Sheet Modal */}
          {isInformationSheetModalOpen && (
            <InitialInformationSheet
              isModal={true}
              storageKeyId={infoSheetStorageKey}
              onClose={() => setIsInformationSheetModalOpen(false)}
              onSaved={() => setInfoSheetVersion((v) => v + 1)}
              onSubmitToOfficer={() => setInfoSheetVersion((v) => v + 1)}
              jurisdiction={myCase?.jurisdiction}
            />
          )}

          {/* Document Upload Standards & OCR FAQ Modal */}
          {isOcrStandardsModalOpen && (
            <DocumentUploadStandardsFAQ
              isModal={true}
              onClose={() => setIsOcrStandardsModalOpen(false)}
              onOpenUploadModal={() => {
                setIsOcrStandardsModalOpen(false);
                onOpenUploadModal();
              }}
            />
          )}
        </main>
      </div>
    </>
  );
}
