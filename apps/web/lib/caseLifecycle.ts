/**
 * Canonical 6-Stage Case Lifecycle Helper
 *
 * Implements the standard 6-stage case lifecycle:
 * 1. Intake
 * 2. Evidence Gathering
 * 3. Caseworker Review
 * 4. Package Assembly
 * 5. Attorney Signoff
 * 6. Filed with Agency
 */

export type CanonicalStageKey =
  | "intake"
  | "evidence_gathering"
  | "caseworker_review"
  | "package_assembly"
  | "attorney_signoff"
  | "filed_with_agency";

export interface CanonicalStageDefinition {
  step: number;
  key: CanonicalStageKey;
  label: string;
  shortLabel: string;
  badgeVariant: "neutral" | "info" | "warning" | "action" | "success" | "verified";
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  description: string;
}

export const CANONICAL_6_STAGES: CanonicalStageDefinition[] = [
  {
    step: 1,
    key: "intake",
    label: "Intake",
    shortLabel: "1. Intake",
    badgeVariant: "neutral",
    badgeBg: "#F1F5F9",
    badgeColor: "#475569",
    badgeBorder: "#CBD5E1",
    description: "Client retained, representation authorized, background questionnaire in progress",
  },
  {
    step: 2,
    key: "evidence_gathering",
    label: "Evidence Gathering",
    shortLabel: "2. Evidence Gathering",
    badgeVariant: "info",
    badgeBg: "#E0F2FE",
    badgeColor: "#0369A1",
    badgeBorder: "#BAE6FD",
    description: "Applicant evidentiary records, identity proofs, and credentials collection",
  },
  {
    step: 3,
    key: "caseworker_review",
    label: "Caseworker Review",
    shortLabel: "3. Caseworker Review",
    badgeVariant: "warning",
    badgeBg: "#FEF3C7",
    badgeColor: "#B45309",
    badgeBorder: "#FDE68A",
    description: "Specialist legal analysis, discrepancy verification, and criteria evaluation",
  },
  {
    step: 4,
    key: "package_assembly",
    label: "Package Assembly",
    shortLabel: "4. Package Assembly",
    badgeVariant: "action",
    badgeBg: "#EFF6FF",
    badgeColor: "#1D4ED8",
    badgeBorder: "#BFDBFE",
    description: "Exhibit collation, statutory forms generation, and pagination indexing",
  },
  {
    step: 5,
    key: "attorney_signoff",
    label: "Attorney Signoff",
    shortLabel: "5. Attorney Signoff",
    badgeVariant: "success",
    badgeBg: "#ECFDF5",
    badgeColor: "#047857",
    badgeBorder: "#A7F3D0",
    description: "Final supervisory counsel brief review, representation execution, and clearance",
  },
  {
    step: 6,
    key: "filed_with_agency",
    label: "Filed with Agency",
    shortLabel: "6. Filed with Agency",
    badgeVariant: "verified",
    badgeBg: "#F5F3FF",
    badgeColor: "#6D28D9",
    badgeBorder: "#DDD6FE",
    description: "Submitted to immigration authority with active official receipt docket",
  },
];

export function normalizeCaseStage(rawStatus?: string | null): CanonicalStageKey {
  const s = (rawStatus || "").toLowerCase().trim();
  switch (s) {
    case "intake":
    case "inquiry":
      return "intake";
    case "evidence_gathering":
    case "gathering":
    case "awaiting_documents":
      return "evidence_gathering";
    case "caseworker_review":
    case "review":
    case "processing":
    case "internal_review":
    case "awaiting_client":
      return "caseworker_review";
    case "package_assembly":
    case "assembly":
    case "ready_for_approval":
      return "package_assembly";
    case "attorney_signoff":
    case "ready":
    case "approved_for_submission":
      return "attorney_signoff";
    case "filed_with_agency":
    case "filed":
    case "submitted":
    case "decision_received":
    case "approved":
    case "closed":
    case "archived":
      return "filed_with_agency";
    default:
      return "intake";
  }
}

export function getCaseStageInfo(rawStatus?: string | null): CanonicalStageDefinition {
  const key = normalizeCaseStage(rawStatus);
  return CANONICAL_6_STAGES.find((st) => st.key === key) || CANONICAL_6_STAGES[0];
}

export function formatCaseStageBadge(rawStatus?: string | null): { label: string; variant: CanonicalStageDefinition["badgeVariant"] } {
  const info = getCaseStageInfo(rawStatus);
  return { label: info.label, variant: info.badgeVariant };
}
