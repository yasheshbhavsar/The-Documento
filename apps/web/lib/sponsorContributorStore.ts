/**
 * Sponsor & Family Contributor Privacy-Shield Store
 * Manages passwordless upload tokens for overseas sponsors (CA Super Visa, UK Appendix V,
 * AU Subclass 600) and +15 CRS Canadian siblings, syncing with localStorage, CustomEvents,
 * and live FastAPI endpoints (/api/v1/portal/contributor-links & /api/v1/portal/contribute/{token})
 * with instant deterministic local fallback for 100% offline and test reliability.
 */

export interface SponsorContributionUpload {
  id: string;
  subtypeLabel: string;
  category: string;
  uploadedAt: string;
  verified: boolean;
  received?: boolean;
  status?: "received_pending_review" | "verified";
  statusLabel?: string;
  sha256: string;
  filename?: string;
  statutoryBadge?: string; // e.g., "CRA NOA Line 15000: $88,400 CAD (LICO Met)" or "Canadian PR Card Verified"
  extractedSummary?: Record<string, string>;
  isPrivateToFirm: boolean;
}

export interface SponsorChecklistItem {
  id: string;
  label: string;
  hint: string;
  satisfied: boolean;
  uploaded?: boolean;
  received?: boolean;
  verified?: boolean;
  status?: "pending" | "received_pending_review" | "verified";
}

export interface SponsorInviteRecord {
  token: string;
  caseId: string;
  caseNumber: string;
  applicantName: string;
  pathway: string;
  sponsorName: string;
  relationship:
    | "child_grandchild"
    | "canadian_sibling"
    | "uk_sponsor"
    | "au_sponsor"
    | "spouse_cosigner";
  jurisdiction: "CA" | "UK" | "AU";
  privacyShield: boolean;
  requestedItems: SponsorChecklistItem[];
  createdAt: string;
  uploadedItems: SponsorContributionUpload[];
}

export const SPONSOR_INVITES_STORAGE_KEY = "documento_sponsor_invites_v1";
export const SPONSOR_UPDATED_EVENT = "documento:sponsor-contributions-updated";

let memoryInviteStore: Record<string, SponsorInviteRecord> = {};

function readAllInvites(): Record<string, SponsorInviteRecord> {
  if (typeof window === "undefined") {
    return { ...memoryInviteStore };
  }
  try {
    const raw = window.localStorage.getItem(SPONSOR_INVITES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      memoryInviteStore = parsed;
      return parsed;
    }
    return {};
  } catch {
    return { ...memoryInviteStore };
  }
}

function writeAllInvites(
  records: Record<string, SponsorInviteRecord>,
  detail?: { token?: string; caseId?: string; action?: string }
): void {
  memoryInviteStore = { ...records };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPONSOR_INVITES_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(
      new CustomEvent(SPONSOR_UPDATED_EVENT, {
        detail: {
          ...detail,
          timestamp: new Date().toISOString(),
        },
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

function buildDefaultRequestedItems(
  relationship: SponsorInviteRecord["relationship"],
  jurisdiction: "CA" | "UK" | "AU"
): Array<{ id: string; label: string; hint: string; satisfied: boolean }> {
  if (relationship === "canadian_sibling") {
    return [
      {
        id: "ca-sib-status",
        label: "Canadian PR Card or Citizenship Certificate",
        hint: "Front and back of Permanent Resident Card or Canadian Citizenship Certificate (+15 CRS points).",
        satisfied: false,
      },
      {
        id: "ca-sib-residency",
        label: "Active Canadian Utility Bill or Residential Lease",
        hint: "Recent Hydro, gas, municipal tax, or lease statement confirming current residence in Canada.",
        satisfied: false,
      },
      {
        id: "ca-sib-birth",
        label: "Birth Certificate Showing Shared Parent",
        hint: "Civil birth record or passport parent endorsement matching at least one parent with the applicant.",
        satisfied: false,
      },
    ];
  }

  if (relationship === "uk_sponsor" || jurisdiction === "UK") {
    return [
      {
        id: "uk-status",
        label: "British Passport or UKVI eVisa Share Code",
        hint: "Biodata page of British passport or 9-character Home Office right-to-reside Share Code.",
        satisfied: false,
      },
      {
        id: "uk-hmrc",
        label: "HMRC P60 / SA302 Tax Summary & Payslips",
        hint: "Latest HMRC P60 or SA302 tax calculation plus 6 months of UK bank/salary statements.",
        satisfied: false,
      },
      {
        id: "uk-council-tax",
        label: "UK Council Tax Bill or Tenancy Agreement",
        hint: "Proof of adequate UK accommodation under Immigration Rules Appendix V.",
        satisfied: false,
      },
      {
        id: "uk-undertaking",
        label: "Signed UK Sponsor Undertaking Letter",
        hint: "Confirming relationship, visit dates, accommodation address, and maintenance support.",
        satisfied: false,
      },
    ];
  }

  if (relationship === "au_sponsor" || jurisdiction === "AU") {
    return [
      {
        id: "au-status",
        label: "Australian Passport or VEVO Entitlement Check",
        hint: "Australian citizen passport bio page or current Department of Home Affairs VEVO check.",
        satisfied: false,
      },
      {
        id: "au-ato-noa",
        label: "ATO Notice of Assessment & Bank Statements",
        hint: "Australian Taxation Office Notice of Assessment verifying financial capacity.",
        satisfied: false,
      },
      {
        id: "au-residency",
        label: "Australian Council Rates Notice or Utility Bill",
        hint: "Evidence of settled residential address in Australia.",
        satisfied: false,
      },
      {
        id: "au-form-1149",
        label: "Form 1149 / Signed Sponsor Invitation Letter",
        hint: "Completed Subclass 600 sponsorship undertaking or family invitation letter.",
        satisfied: false,
      },
    ];
  }

  if (relationship === "spouse_cosigner") {
    return [
      {
        id: "ca-cosigner-status",
        label: "Co-Signer Canadian PR Card or Passport",
        hint: "Proof of Canadian Permanent Residence or Citizenship for co-signing spouse/partner.",
        satisfied: false,
      },
      {
        id: "ca-cosigner-noa",
        label: "Co-Signer CRA Notice of Assessment (Line 15000)",
        hint: "Most recent CRA NOA combining household LICO income under IRPR s. 133.",
        satisfied: false,
      },
      {
        id: "ca-cosigner-t4",
        label: "Co-Signer T4 Slip & Employment Letter",
        hint: "Employer confirmation letter and T4 statement of remuneration paid.",
        satisfied: false,
      },
    ];
  }

  // Default: child_grandchild + CA (Canada Super Visa / Family TRV Host)
  return [
    {
      id: "ca-host-status",
      label: "Canadian PR Card or Canadian Passport",
      hint: "Front & back of Canadian Permanent Resident Card or Canadian Passport bio page.",
      satisfied: false,
    },
    {
      id: "ca-cra-noa",
      label: "CRA Notice of Assessment (Line 15000)",
      hint: "Most recent tax year CRA NOA verifying Super Visa Minimum Necessary Income (LICO).",
      satisfied: false,
    },
    {
      id: "ca-t4-emp",
      label: "T4 Tax Slip & Employment Verification Letter",
      hint: "Canadian employer letter confirming position, start date, and annual CAD salary.",
      satisfied: false,
    },
    {
      id: "ca-supervisa-ins",
      label: "Super Visa $100,000 CAD Medical Insurance",
      hint: "Paid policy valid for at least 365 days from an authorized Canadian insurance company.",
      satisfied: false,
    },
    {
      id: "ca-host-letter",
      label: "Signed Host Invitation & Financial Promise Letter",
      hint: "Signed invitation stating household size and financial support undertaking.",
      satisfied: false,
    },
  ];
}

function doesUploadSatisfyItem(
  item: { id: string; label: string },
  upload: Omit<SponsorContributionUpload, "id" | "uploadedAt">
): boolean {
  const haystack = `${upload.subtypeLabel} ${upload.category} ${upload.filename || ""} ${upload.statutoryBadge || ""}`.toLowerCase();
  const id = item.id.toLowerCase();

  if (id.includes("noa") || id.includes("ato")) {
    return (
      haystack.includes("noa") ||
      haystack.includes("notice of assessment") ||
      haystack.includes("line 15000") ||
      haystack.includes("cra") ||
      haystack.includes("ato")
    );
  }
  if (id.includes("hmrc")) {
    return (
      haystack.includes("hmrc") ||
      haystack.includes("p60") ||
      haystack.includes("sa302") ||
      haystack.includes("payslip") ||
      haystack.includes("financial")
    );
  }
  if (id.includes("status")) {
    return (
      haystack.includes("pr card") ||
      haystack.includes("permanent resident") ||
      haystack.includes("passport") ||
      haystack.includes("citizenship") ||
      haystack.includes("share code") ||
      haystack.includes("evisa") ||
      haystack.includes("vevo") ||
      upload.category === "identity_passport" ||
      upload.category === "visas_residence_permits"
    );
  }
  if (id.includes("ins")) {
    return (
      haystack.includes("insurance") ||
      haystack.includes("medical") ||
      haystack.includes("100,000") ||
      haystack.includes("100k")
    );
  }
  if (id.includes("residency") || id.includes("council")) {
    return (
      haystack.includes("utility") ||
      haystack.includes("hydro") ||
      haystack.includes("lease") ||
      haystack.includes("tenancy") ||
      haystack.includes("council") ||
      haystack.includes("rates")
    );
  }
  if (id.includes("birth")) {
    return haystack.includes("birth") || haystack.includes("parent") || upload.category === "civil_status";
  }
  if (id.includes("t4") || id.includes("emp")) {
    return (
      haystack.includes("t4") ||
      haystack.includes("employment") ||
      haystack.includes("salary") ||
      upload.category === "employment_records"
    );
  }
  if (id.includes("letter") || id.includes("undertaking") || id.includes("1149")) {
    return (
      haystack.includes("invitation") ||
      haystack.includes("undertaking") ||
      haystack.includes("1149") ||
      haystack.includes("letter")
    );
  }
  return false;
}

function fireBackgroundBackendSync(endpointPath: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return;
  }
  const candidates = [`/api/v1${endpointPath}`, `/api/backend${endpointPath}`];
  void (async () => {
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res && res.ok) break;
      } catch {
        // Offline or proxy unreachable — local store already persisted synchronously
      }
    }
  })();
}

function fireBackgroundMultipartUploadSync(token: string, entry: SponsorContributionUpload): void {
  if (typeof window === "undefined" || typeof fetch !== "function" || typeof FormData === "undefined") {
    return;
  }
  const encodedToken = encodeURIComponent(token);
  const candidates = [
    `/api/v1/portal/contribute/${encodedToken}/upload`,
    `/api/backend/portal/contribute/${encodedToken}/upload`,
  ];
  void (async () => {
    for (const url of candidates) {
      try {
        const fd = new FormData();
        const syntheticText = [
          entry.subtypeLabel,
          entry.filename || "sponsor_evidence.pdf",
          entry.statutoryBadge || "",
          Object.entries(entry.extractedSummary || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n"),
        ].join("\n");
        const blob = new Blob([syntheticText], { type: "application/pdf" });
        fd.append("file", blob, entry.filename || "sponsor_evidence.pdf");
        fd.append("privacy_shield", String(entry.isPrivateToFirm));
        const res = await fetch(url, {
          method: "POST",
          body: fd,
        });
        if (res && res.ok) return;
      } catch {
        // Fallback to JSON metadata sync or local store
      }
    }
    fireBackgroundBackendSync(`/portal/contribute/${encodedToken}`, {
      id: entry.id,
      subtype_label: entry.subtypeLabel,
      category: entry.category,
      verified: entry.verified,
      status: entry.status || (entry.verified ? "received_verified" : "received_pending_review"),
      sha256: entry.sha256,
      filename: entry.filename,
      statutory_badge: entry.statutoryBadge,
      extracted_summary: entry.extractedSummary,
      is_private_to_firm: entry.isPrivateToFirm,
    });
  })();
}

function normalizeRelationship(raw: unknown): SponsorInviteRecord["relationship"] {
  const s = String(raw || "").toLowerCase();
  if (s.includes("sibling")) return "canadian_sibling";
  if (s.includes("uk")) return "uk_sponsor";
  if (s.includes("au")) return "au_sponsor";
  if (s.includes("cosigner") || s.includes("spouse")) return "spouse_cosigner";
  return "child_grandchild";
}

function normalizeJurisdiction(raw: unknown): "CA" | "UK" | "AU" {
  const s = String(raw || "").toUpperCase();
  if (s === "UK" || s.includes("UNITED KINGDOM")) return "UK";
  if (s === "AU" || s.includes("AUSTRALIA")) return "AU";
  return "CA";
}

export async function fetchSponsorInviteByTokenFromBackend(
  token: string
): Promise<SponsorInviteRecord | null> {
  if (!token) return null;
  if (typeof fetch !== "function") {
    return getSponsorInviteByToken(token);
  }

  const encoded = encodeURIComponent(token);
  const candidates = [
    `/api/v1/portal/contribute/${encoded}`,
    `/api/backend/portal/contribute/${encoded}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res || !res.ok) continue;
      const data = await res.json();
      if (!data || typeof data !== "object") continue;

      const all = readAllInvites();
      const existing = all[token];
      const jurisdiction = normalizeJurisdiction(data.jurisdiction ?? existing?.jurisdiction);
      const relationship = normalizeRelationship(data.relationship ?? existing?.relationship);
      const defaultItems = buildDefaultRequestedItems(relationship, jurisdiction);

      const requestedItems: SponsorChecklistItem[] = Array.isArray(data.requested_items)
        ? data.requested_items.map((item: any, idx: number) => {
            const rawStatus = String(item.status || "pending");
            const isVerified = rawStatus === "verified" || Boolean(item.verified);
            const isReceived =
              isVerified ||
              rawStatus === "received_verified" ||
              rawStatus === "received_pending_review" ||
              Boolean(item.satisfied || item.received || item.uploaded);
            const fallbackHint =
              defaultItems[idx]?.hint ||
              "Official statutory sponsor evidence required for this application.";
            return {
              id: String(item.item_id || item.id || `sponsor_item_${idx + 1}`),
              label: String(item.label || item.title || "Required Sponsor Evidence"),
              hint: String(item.hint || fallbackHint),
              satisfied: isReceived,
              uploaded: isReceived,
              received: isReceived,
              verified: isVerified,
              status: isVerified ? "verified" : isReceived ? "received_pending_review" : "pending",
            };
          })
        : existing?.requestedItems || defaultItems;

      const uploadedItems: SponsorContributionUpload[] = Array.isArray(data.uploaded_summaries)
        ? data.uploaded_summaries.map((sum: any, idx: number) => {
            const isVerified = Boolean(sum.verified);
            return {
              id: String(sum.contribution_id || sum.id || `spn-doc-${idx + 1}`),
              subtypeLabel: String(sum.subtype_label || sum.subtypeLabel || "Sponsor Evidence"),
              category: String(sum.category || "financial_evidence"),
              uploadedAt: String(sum.uploaded_at || sum.uploadedAt || new Date().toISOString()),
              verified: isVerified,
              received: true,
              status: isVerified ? "verified" : "received_pending_review",
              statusLabel: isVerified ? "✓ Verified" : "Received (Pending Review)",
              sha256: String(sum.sha256 || ""),
              filename: sum.filename ? String(sum.filename) : undefined,
              statutoryBadge:
                sum.statutory_pass_badge || sum.statutoryBadge
                  ? String(sum.statutory_pass_badge || sum.statutoryBadge)
                  : undefined,
              isPrivateToFirm:
                sum.privacy_shield !== undefined
                  ? Boolean(sum.privacy_shield)
                  : Boolean(data.privacy_shield ?? true),
            };
          })
        : existing?.uploadedItems || [];

      const mergedRecord: SponsorInviteRecord = {
        token,
        caseId: existing?.caseId || String(data.case_id || "CASE-SPONSOR"),
        caseNumber: existing?.caseNumber || String(data.case_number || "CASE-SPONSOR"),
        applicantName:
          String(data.applicant_first_name || existing?.applicantName || "Applicant"),
        pathway: String(
          data.pathway ||
            existing?.pathway ||
            (jurisdiction === "CA"
              ? "Canada Super Visa (Parents & Grandparents)"
              : jurisdiction === "UK"
                ? "UK Standard Visitor (Family Sponsored)"
                : "Australia Visitor Visa (Subclass 600 Sponsored)")
        ),
        sponsorName: String(data.sponsor_name || existing?.sponsorName || "Family Sponsor"),
        relationship,
        jurisdiction,
        privacyShield:
          data.privacy_shield !== undefined
            ? Boolean(data.privacy_shield)
            : existing?.privacyShield ?? true,
        requestedItems,
        createdAt: existing?.createdAt || new Date().toISOString(),
        uploadedItems:
          uploadedItems.length > 0 ? uploadedItems : existing?.uploadedItems || [],
      };

      all[token] = mergedRecord;
      writeAllInvites(all, { token, caseId: mergedRecord.caseId, action: "backend_synced" });
      return mergedRecord;
    } catch {
      // Offline or unreachable — continue to fallback
    }
  }

  return getSponsorInviteByToken(token);
}

export async function fetchCaseSponsorContributionsFromBackend(
  caseId: string
): Promise<SponsorContributionUpload[]> {
  if (!caseId) return [];
  if (typeof fetch === "function") {
    const encoded = encodeURIComponent(caseId);
    const candidates = [
      `/api/v1/portal/cases/${encoded}/sponsor-contributions`,
      `/api/backend/portal/cases/${encoded}/sponsor-contributions`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: "GET" });
        if (!res || !res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.contributions)) {
          return data.contributions.map((c: any, idx: number) => {
            const isVerified = Boolean(c.verified);
            return {
              id: String(c.contribution_id || `spn-contrib-${idx + 1}`),
              subtypeLabel: String(c.subtype_label || "Sponsor Evidence"),
              category: String(c.category || "financial_evidence"),
              uploadedAt: String(c.uploaded_at || new Date().toISOString()),
              verified: isVerified,
              received: true,
              status: isVerified ? "verified" : "received_pending_review",
              statusLabel: isVerified ? "✓ Verified" : "Received (Pending Review)",
              sha256: String(c.sha256 || ""),
              filename: c.filename ? String(c.filename) : undefined,
              statutoryBadge: c.statutory_pass_badge ? String(c.statutory_pass_badge) : undefined,
              isPrivateToFirm: Boolean(c.privacy_shield ?? true),
            };
          });
        }
      } catch {
        // Offline fallback
      }
    }
  }
  return getSponsorInvitesForCase(caseId).flatMap((inv) => inv.uploadedItems);
}

export function createSponsorInviteLink(params: {
  caseId: string;
  caseNumber?: string;
  applicantName?: string;
  pathway?: string;
  sponsorName: string;
  relationship: SponsorInviteRecord["relationship"];
  jurisdiction: "CA" | "UK" | "AU";
  privacyShield?: boolean;
}): SponsorInviteRecord {
  const all = readAllInvites();
  const randomPart = Math.random().toString(36).slice(2, 10);
  const token = `spn_${params.jurisdiction.toLowerCase()}_${Date.now().toString(36)}_${randomPart}`;

  const record: SponsorInviteRecord = {
    token,
    caseId: params.caseId,
    caseNumber: params.caseNumber || "CASE-INTAKE",
    applicantName: params.applicantName || "Principal Applicant",
    pathway:
      params.pathway ||
      (params.jurisdiction === "CA"
        ? params.relationship === "canadian_sibling"
          ? "Canada Express Entry (+15 CRS Sibling)"
          : "Canada Super Visa (Parents & Grandparents)"
        : params.jurisdiction === "UK"
          ? "UK Standard Visitor (Family Sponsored)"
          : "Australia Visitor Visa (Subclass 600 Sponsored)"),
    sponsorName: params.sponsorName.trim() || "Family Sponsor",
    relationship: params.relationship,
    jurisdiction: params.jurisdiction,
    privacyShield: params.privacyShield !== undefined ? params.privacyShield : true,
    requestedItems: buildDefaultRequestedItems(params.relationship, params.jurisdiction).map(
      (item) => ({
        ...item,
        uploaded: false,
        received: false,
        verified: false,
        status: "pending",
      })
    ),
    createdAt: new Date().toISOString(),
    uploadedItems: [],
  };

  all[token] = record;
  writeAllInvites(all, { token, caseId: record.caseId, action: "created" });

  fireBackgroundBackendSync("/portal/contributor-links", {
    token: record.token,
    case_id: record.caseId,
    case_number: record.caseNumber,
    applicant_name: record.applicantName,
    applicant_first_name: record.applicantName.trim().split(/\s+/)[0] || "Applicant",
    pathway: record.pathway,
    sponsor_name: record.sponsorName,
    relationship: record.relationship,
    jurisdiction: record.jurisdiction,
    privacy_shield: record.privacyShield,
    requested_items: record.requestedItems,
  });

  return record;
}

export function getSponsorInvitesForCase(caseId: string): SponsorInviteRecord[] {
  if (!caseId) return [];
  const all = readAllInvites();
  return Object.values(all)
    .filter((rec) => rec.caseId === caseId || rec.caseNumber === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSponsorInviteByToken(token: string): SponsorInviteRecord | null {
  if (!token) return null;
  const all = readAllInvites();
  return all[token] || null;
}

export function updateSponsorInvitePrivacyShield(
  token: string,
  privacyShield: boolean
): SponsorInviteRecord | null {
  if (!token) return null;
  const all = readAllInvites();
  const existing = all[token];
  if (!existing) return null;

  const updated: SponsorInviteRecord = {
    ...existing,
    privacyShield,
  };
  all[token] = updated;
  writeAllInvites(all, { token, caseId: updated.caseId, action: "privacy_updated" });
  return updated;
}

export function recordSponsorContributionUpload(
  token: string,
  upload: Omit<SponsorContributionUpload, "id" | "uploadedAt">
): SponsorInviteRecord | null {
  if (!token) return null;
  const all = readAllInvites();
  const existing = all[token];
  if (!existing) return null;

  const isVerified = Boolean(upload.verified);
  const entry: SponsorContributionUpload = {
    ...upload,
    verified: isVerified,
    received: true,
    status: isVerified ? "verified" : "received_pending_review",
    statusLabel: isVerified ? "✓ Verified" : "Received (Pending Review)",
    id: `spn-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    uploadedAt: new Date().toISOString(),
  };

  let matchedAnyChecklist = false;
  const nextRequestedItems: SponsorChecklistItem[] = existing.requestedItems.map((item) => {
    if (item.satisfied) {
      if (isVerified && !item.verified && doesUploadSatisfyItem(item, upload)) {
        return {
          ...item,
          verified: true,
          status: "verified",
        };
      }
      return item;
    }
    if (doesUploadSatisfyItem(item, upload)) {
      matchedAnyChecklist = true;
      return {
        ...item,
        satisfied: true,
        uploaded: true,
        received: true,
        verified: isVerified,
        status: isVerified ? "verified" : "received_pending_review",
      };
    }
    return item;
  });

  // If upload didn't match a specific keyword, mark first open supporting item as received
  if (!matchedAnyChecklist) {
    const firstUnsatisfiedIdx = nextRequestedItems.findIndex((i) => !i.satisfied);
    if (
      firstUnsatisfiedIdx !== -1 &&
      (upload.category === "supporting_evidence" || upload.received || isVerified)
    ) {
      nextRequestedItems[firstUnsatisfiedIdx] = {
        ...nextRequestedItems[firstUnsatisfiedIdx],
        satisfied: true,
        uploaded: true,
        received: true,
        verified: isVerified,
        status: isVerified ? "verified" : "received_pending_review",
      };
    }
  }

  const updated: SponsorInviteRecord = {
    ...existing,
    requestedItems: nextRequestedItems,
    uploadedItems: [entry, ...existing.uploadedItems],
  };

  all[token] = updated;
  writeAllInvites(all, { token, caseId: updated.caseId, action: "upload_recorded" });

  fireBackgroundMultipartUploadSync(token, entry);

  return updated;
}

export function buildSponsorShareUrl(token: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://app.documento.legal";
  return `${origin}/contribute?token=${encodeURIComponent(token)}`;
}

export function enrichSponsorUploadFromAiLab(
  caseIdOrToken: string,
  matcher: { sha256?: string; filename?: string },
  enrichment: {
    subtypeLabel?: string;
    category?: string;
    statutoryBadge?: string;
    extractedSummary?: Record<string, string>;
  }
): void {
  if (!caseIdOrToken) return;
  const all = readAllInvites();
  let changed = false;
  let updatedToken = "";
  let updatedCaseId = "";

  for (const [token, rec] of Object.entries(all)) {
    if (token !== caseIdOrToken && rec.caseId !== caseIdOrToken && rec.caseNumber !== caseIdOrToken) {
      continue;
    }
    const nextUploads = rec.uploadedItems.map((up) => {
      const matchesSha = Boolean(matcher.sha256 && up.sha256 === matcher.sha256);
      const matchesName = Boolean(
        matcher.filename &&
          up.filename &&
          up.filename.toLowerCase() === matcher.filename.toLowerCase()
      );
      if (!matchesSha && !matchesName) return up;
      changed = true;
      updatedToken = token;
      updatedCaseId = rec.caseId;
      return {
        ...up,
        verified: true,
        received: true,
        status: "verified" as const,
        statusLabel: "✓ Verified",
        subtypeLabel: enrichment.subtypeLabel || up.subtypeLabel,
        category: enrichment.category || up.category,
        statutoryBadge: enrichment.statutoryBadge || up.statutoryBadge,
        extractedSummary: {
          ...(up.extractedSummary || {}),
          ...(enrichment.extractedSummary || {}),
        },
      };
    });

    if (changed) {
      const nextRequested: SponsorChecklistItem[] = rec.requestedItems.map((item) => {
        const satisfiedByVerified = nextUploads.some(
          (u) => u.verified && doesUploadSatisfyItem(item, u)
        );
        const satisfiedNow =
          item.satisfied || nextUploads.some((u) => doesUploadSatisfyItem(item, u));
        if (!satisfiedNow) return item;
        return {
          ...item,
          satisfied: true,
          uploaded: true,
          received: true,
          verified: satisfiedByVerified || Boolean(item.verified),
          status:
            satisfiedByVerified || item.verified ? "verified" : "received_pending_review",
        };
      });
      all[token] = {
        ...rec,
        requestedItems: nextRequested,
        uploadedItems: nextUploads,
      };
    }
  }

  if (changed) {
    writeAllInvites(all, {
      token: updatedToken,
      caseId: updatedCaseId,
      action: "ai_lab_enriched",
    });
  }
}
