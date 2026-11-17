"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ImmigrationCase,
  DocumentItem,
  ClientProfile,
  DocumentCategory,
} from "../../lib/types";
import { SmartDropzone, SmartIntakeSummary } from "../common/SmartDropzone";
import {
  getSponsorInvitesForCase,
  SponsorInviteRecord,
  SPONSOR_UPDATED_EVENT,
  enrichSponsorUploadFromAiLab,
} from "../../lib/sponsorContributorStore";
import {
  AutoFillFieldProvenance,
  persistAndBroadcastAutoFill,
  getAutoFillProvenance,
  mapAnalysisToInitialInfoSheet,
  mapPacketToInitialInfoSheet,
  confirmAndApplyPendingAutoFill,
  extractProfileFromAnalysis,
} from "../../lib/documentAutoFillEngine";
import {
  ExtractorAnalysisResult,
  runSmartIntakePipeline,
} from "../../lib/api/extractor";
import {
  RawUploadedPacketRecord,
  SortedChildDocSummary,
  RAW_PACKETS_UPDATED_EVENT,
  MISSING_QUESTIONS_UPDATED_EVENT,
  getRawPacketsForCase,
  getOrReconstructRawPacketFile,
  loadRawPacketFileAsync,
  markRawPacketProcessedByAiLab,
  computeMissingClientGaps,
  publishMissingQuestionsRequest,
  getMissingQuestionsRequest,
} from "../../lib/rawClientPacketStore";
import { getSavedInitialInfoSheetRecord } from "../portal/InitialInformationSheet";

export interface SplitScreenCaseStudioProps {
  caseItem: ImmigrationCase | null;
  documents: DocumentItem[];
  client?: ClientProfile | null;
  onDocumentUploaded?: (doc: DocumentItem) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
  onPushToForms?: (confirmedFields: Record<string, string>) => void;
  onClientProfileAutoFilled?: (profilePatch: Partial<ClientProfile>) => void;
}

type RoleBucketKey = "applicant" | "spouse_dependant" | "sponsor_host" | "crs_sibling";

interface NormalizedStudioField {
  id: string;
  docId: string;
  docTitle: string;
  fieldKey: string;
  label: string;
  value: string;
  confidencePct: number;
  pageNumber: number;
  // Normalized [ymin, xmin, ymax, xmax] in 0..100 percentage space
  bboxPct: [number, number, number, number];
  roleBucket: RoleBucketKey;
  confirmed: boolean;
}

// Official IRCC Super Visa Minimum Necessary Income (LICO) thresholds (CAD)
const IRCC_SUPER_VISA_LICO_CAD: Record<number, number> = {
  1: 29380,
  2: 36576,
  3: 44966,
  4: 54594,
  5: 61920,
  6: 69834,
  7: 77750,
};

function getLicoThresholdForFamilySize(size: number): number {
  const clamped = Math.max(1, Math.floor(size));
  if (clamped <= 7) {
    return IRCC_SUPER_VISA_LICO_CAD[clamped];
  }
  return IRCC_SUPER_VISA_LICO_CAD[7] + (clamped - 7) * 7916;
}

function mapToVaultCategory(rawCategory: string): DocumentCategory {
  if (rawCategory === "civil_status_family") return "civil_status";
  const valid: DocumentCategory[] = [
    "identity_passport",
    "civil_status",
    "visas_residence_permits",
    "educational_records",
    "employment_records",
    "financial_evidence",
    "travel_records",
    "insurance_accommodation",
    "police_medical",
    "government_correspondence",
    "translations_certifications",
    "supporting_evidence",
  ];
  return (valid.includes(rawCategory as DocumentCategory)
    ? rawCategory
    : "supporting_evidence") as DocumentCategory;
}

function normalizeBoundingBoxToPercent(
  rawBox: unknown,
  fallbackIndex: number
): [number, number, number, number] {
  if (Array.isArray(rawBox) && rawBox.length === 4) {
    const nums = rawBox.map((n) => Number(n));
    if (nums.every((n) => Number.isFinite(n))) {
      const maxVal = Math.max(...nums);
      if (maxVal <= 1.05) {
        return [
          Math.max(2, Math.min(92, nums[0] * 100)),
          Math.max(2, Math.min(92, nums[1] * 100)),
          Math.max(6, Math.min(98, nums[2] * 100)),
          Math.max(10, Math.min(98, nums[3] * 100)),
        ];
      }
      if (maxVal > 100) {
        // 0..1000 Gemini spatial coordinate grid
        return [
          Math.max(2, Math.min(92, nums[0] / 10)),
          Math.max(2, Math.min(92, nums[1] / 10)),
          Math.max(6, Math.min(98, nums[2] / 10)),
          Math.max(10, Math.min(98, nums[3] / 10)),
        ];
      }
      return [
        Math.max(2, Math.min(92, nums[0])),
        Math.max(2, Math.min(92, nums[1])),
        Math.max(6, Math.min(98, nums[2])),
        Math.max(10, Math.min(98, nums[3])),
      ];
    }
  }
  // Clean deterministic layout slot on page canvas when legacy fixture omits bbox
  const row = fallbackIndex % 6;
  const top = 16 + row * 12;
  return [top, 8, top + 9, 90];
}

function classifyDocumentRoleBucket(doc: DocumentItem): RoleBucketKey {
  const hay = `${doc.title || ""} ${doc.filename || ""} ${doc.category || ""} ${doc.person_role || ""} ${(doc as any).contributor_role || ""} ${doc.uploader_role || ""}`.toLowerCase();
  if (
    hay.includes("sibling") ||
    hay.includes("brother") ||
    hay.includes("sister") ||
    hay.includes("+15 crs")
  ) {
    return "crs_sibling";
  }
  if (
    doc.uploader_role === "sponsor" ||
    hay.includes("sponsor") ||
    hay.includes("host") ||
    hay.includes("noa") ||
    hay.includes("notice of assessment") ||
    hay.includes("line 15000") ||
    hay.includes("p60") ||
    hay.includes("sa302") ||
    hay.includes("vevo") ||
    hay.includes("1149") ||
    hay.includes("invitation")
  ) {
    return "sponsor_host";
  }
  if (
    hay.includes("spouse") ||
    hay.includes("dependant") ||
    hay.includes("dependent") ||
    hay.includes("marriage") ||
    hay.includes("child")
  ) {
    return "spouse_dependant";
  }
  return "applicant";
}

function parseCurrencyAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function SplitScreenCaseStudio({
  caseItem,
  documents,
  onDocumentUploaded,
  onDocumentUpdated,
  onPushToForms,
  onClientProfileAutoFilled,
}: SplitScreenCaseStudioProps) {
  const [localDocs, setLocalDocs] = useState<DocumentItem[]>([]);
  const [rawPacketsVersion, setRawPacketsVersion] = useState<number>(0);
  const [sheetSyncVersion, setSheetSyncVersion] = useState<number>(0);
  const [isRunningAiLab, setIsRunningAiLab] = useState<boolean>(false);
  const [aiLabProgressText, setAiLabProgressText] = useState<string>("");
  const [aiLabLastRunSummary, setAiLabLastRunSummary] = useState<{
    packetsProcessed: number;
    subDocsCreated: number;
    fieldsAutoFilled: number;
  } | null>(null);
  const [missingGapsPromptSent, setMissingGapsPromptSent] = useState<boolean>(false);

  const storageKey = caseItem?.id || "default_studio_case";

  // Subscribe to Raw Client/Sponsor Packet uploads and Auto-Fill sheet updates
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onRawUpdate = () => setRawPacketsVersion((v) => v + 1);
    const onSheetUpdate = () => setSheetSyncVersion((v) => v + 1);
    window.addEventListener(RAW_PACKETS_UPDATED_EVENT, onRawUpdate);
    window.addEventListener("documento-autofill-updated", onSheetUpdate);
    window.addEventListener(MISSING_QUESTIONS_UPDATED_EVENT, onSheetUpdate);
    return () => {
      window.removeEventListener(RAW_PACKETS_UPDATED_EVENT, onRawUpdate);
      window.removeEventListener("documento-autofill-updated", onSheetUpdate);
      window.removeEventListener(MISSING_QUESTIONS_UPDATED_EVENT, onSheetUpdate);
    };
  }, []);

  const rawStorePackets = useMemo<RawUploadedPacketRecord[]>(
    () => getRawPacketsForCase(caseItem?.id, caseItem?.case_number),
    [caseItem?.id, caseItem?.case_number, rawPacketsVersion]
  );

  // Merge passed-in documents, locally generated AI Lab sub-documents, and raw packets from Client/Sponsor portals
  const caseDocs = useMemo(() => {
    const filtered = caseItem
      ? documents.filter(
          (d) =>
            !d.case_id ||
            d.case_id === caseItem.id ||
            d.case_number === caseItem.case_number
        )
      : documents;

    // Local overrides/additions take precedence when AI Lab marks an original packet completed
    const byId = new Map<string, DocumentItem>();
    for (const d of filtered) {
      byId.set(d.id, d);
    }
    for (const ld of localDocs) {
      const prev = byId.get(ld.id);
      byId.set(ld.id, prev ? { ...prev, ...ld } : ld);
    }

    // Also surface any raw packet uploaded via Client Portal or Sponsor Portal (/contribute)
    for (const pkt of rawStorePackets) {
      const existingByVaultId = byId.get(pkt.vaultDocId);
      if (existingByVaultId) {
        byId.set(pkt.vaultDocId, {
          ...existingByVaultId,
          is_raw_packet: true,
          raw_packet_id: pkt.id,
          ai_lab_status: pkt.aiLabStatus,
          uploader_role: pkt.uploaderRole,
          is_private_to_firm: pkt.privacyShield,
        });
      } else {
        byId.set(pkt.vaultDocId, {
          id: pkt.vaultDocId,
          case_id: caseItem?.id || pkt.caseId,
          title: pkt.title || pkt.filename,
          filename: pkt.filename,
          category: (pkt.declaredCategory as DocumentCategory) || "supporting_evidence",
          file_size: pkt.fileSizeLabel,
          byte_size: pkt.fileSizeBytes,
          mime_type: pkt.mimeType,
          sha256_hash: pkt.sha256,
          status: pkt.aiLabStatus === "completed" ? "verified" : "under_review",
          processing_status: pkt.aiLabStatus === "completed" ? "completed" : "pending",
          verification_status: pkt.aiLabStatus === "completed" ? "verified" : "unverified",
          uploaded_at: pkt.uploadedAt,
          page_count: pkt.pageCountEstimate,
          ocr_applied: pkt.aiLabStatus === "completed",
          extracted_fields: [],
          is_raw_packet: true,
          raw_packet_id: pkt.id,
          ai_lab_status: pkt.aiLabStatus,
          uploader_role: pkt.uploaderRole,
          is_private_to_firm: pkt.privacyShield,
        });
      }
    }

    return Array.from(byId.values());
  }, [caseItem, documents, localDocs, rawStorePackets]);

  // Identify unprocessed raw uploads awaiting Paralegal's local AI Lab
  const pendingRawTargets = useMemo(() => {
    const targets: Array<{
      packetId: string;
      vaultDocId: string;
      filename: string;
      fileSizeLabel: string;
      sha256: string;
      uploaderRole: "applicant" | "sponsor";
      uploaderName: string;
      privacyShield: boolean;
      storePacket?: RawUploadedPacketRecord;
      docItem?: DocumentItem;
    }> = [];
    const seenVaultIds = new Set<string>();

    for (const pkt of rawStorePackets) {
      if (pkt.aiLabStatus === "pending") {
        seenVaultIds.add(pkt.vaultDocId);
        targets.push({
          packetId: pkt.id,
          vaultDocId: pkt.vaultDocId,
          filename: pkt.filename,
          fileSizeLabel: pkt.fileSizeLabel,
          sha256: pkt.sha256,
          uploaderRole: pkt.uploaderRole,
          uploaderName: pkt.uploaderName,
          privacyShield: pkt.privacyShield,
          storePacket: pkt,
        });
      }
    }

    for (const d of caseDocs) {
      if (
        d.is_raw_packet &&
        d.ai_lab_status !== "completed" &&
        !seenVaultIds.has(d.id)
      ) {
        seenVaultIds.add(d.id);
        targets.push({
          packetId: d.raw_packet_id || d.id,
          vaultDocId: d.id,
          filename: d.filename || d.title,
          fileSizeLabel: d.file_size || "PDF",
          sha256: d.sha256_hash || "",
          uploaderRole: d.uploader_role === "sponsor" ? "sponsor" : "applicant",
          uploaderName:
            d.uploader_role === "sponsor"
              ? "Sponsor Upload"
              : caseItem?.client_name || "Retained Client",
          privacyShield: Boolean(d.is_private_to_firm),
          docItem: d,
        });
      }
    }

    return targets;
  }, [rawStorePackets, caseDocs, caseItem?.client_name]);

  // Build Parent Original Packet -> Sorted Child Sub-Documents Tree for Left Pane
  const studioPacketTree = useMemo(() => {
    const parentPackets = caseDocs.filter((d) => d.is_raw_packet);
    const parentIds = new Set(parentPackets.map((p) => p.id));

    const packetGroups = parentPackets.map((parent) => {
      const children = caseDocs.filter((d) => d.parent_packet_id === parent.id);
      return {
        parent,
        children,
      };
    });

    const standaloneDocs = caseDocs.filter(
      (d) =>
        !d.is_raw_packet &&
        (!d.parent_packet_id || !parentIds.has(d.parent_packet_id))
    );

    return {
      packetGroups,
      standaloneDocs,
    };
  }, [caseDocs]);

  const [selectedDocId, setSelectedDocId] = useState<string>(caseDocs[0]?.id || "");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [licoFamilySize, setLicoFamilySize] = useState<number>(3);
  const [confirmedTimestamp, setConfirmedTimestamp] = useState<string | null>(null);
  const [confirmedFieldCount, setConfirmedFieldCount] = useState<number>(0);

  const sponsorLookupKey = caseItem?.id || caseItem?.case_number || "";
  const [sponsorInvites, setSponsorInvites] = useState<SponsorInviteRecord[]>(() =>
    getSponsorInvitesForCase(sponsorLookupKey)
  );

  useEffect(() => {
    if (caseDocs.length > 0 && !caseDocs.some((d) => d.id === selectedDocId)) {
      setSelectedDocId(caseDocs[0].id);
      setCurrentPage(1);
    }
  }, [caseDocs, selectedDocId]);

  useEffect(() => {
    const syncInvites = () => {
      setSponsorInvites(getSponsorInvitesForCase(sponsorLookupKey));
    };
    syncInvites();
    if (typeof window !== "undefined") {
      window.addEventListener(SPONSOR_UPDATED_EVENT, syncInvites);
      return () => window.removeEventListener(SPONSOR_UPDATED_EVENT, syncInvites);
    }
    return undefined;
  }, [sponsorLookupKey]);

  const selectedDoc = useMemo(
    () => caseDocs.find((d) => d.id === selectedDocId) || caseDocs[0] || null,
    [caseDocs, selectedDocId]
  );

  const normalizedFields = useMemo<NormalizedStudioField[]>(() => {
    const list: NormalizedStudioField[] = [];
    for (const doc of caseDocs) {
      const roleBucket = classifyDocumentRoleBucket(doc);
      const rawFields = doc.extracted_fields || [];
      rawFields.forEach((ef: any, idx: number) => {
        const key = String(ef.field_name || ef.key || ef.label || `field_${idx}`);
        const value = String(
          ef.value ?? ef.field_value ?? ef.normalized_value ?? ef.original_value ?? ""
        ).trim();
        if (!value) return;
        const rawConfCandidate = ef.confidence ?? ef.extraction_confidence ?? ef.ocr_confidence;
        const rawConf = typeof rawConfCandidate === "number" ? rawConfCandidate : 0.96;
        const confidencePct = Math.round(rawConf > 1 ? rawConf : rawConf * 100);
        const pageNumber = Number(ef.page_number || ef.source_page || 1) || 1;
        const bboxPct = normalizeBoundingBoxToPercent(
          ef.bounding_box || ef.source_location?.bounding_box || ef.bbox || ef.coordinates,
          idx
        );
        list.push({
          id: `${doc.id}::${key}::${idx}`,
          docId: doc.id,
          docTitle: doc.title || doc.filename || "Case Document",
          fieldKey: key,
          label: String(ef.label || ef.field_label || ef.field_name || key)
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase()),
          value,
          confidencePct,
          pageNumber,
          bboxPct,
          roleBucket,
          confirmed: Boolean(ef.is_confirmed || confirmedTimestamp),
        });
      });
    }
    return list;
  }, [caseDocs, confirmedTimestamp]);

  const totalPagesForSelectedDoc = useMemo(() => {
    if (!selectedDoc) return 1;
    const explicitPages = Number(selectedDoc.page_count || 0);
    const maxFieldPage = normalizedFields
      .filter((f) => f.docId === selectedDoc.id)
      .reduce((acc, f) => Math.max(acc, f.pageNumber), 1);
    return Math.max(1, explicitPages, maxFieldPage);
  }, [selectedDoc, normalizedFields]);

  const currentDocPageFields = useMemo(() => {
    if (!selectedDoc) return [];
    // If viewing an untouched Original Packet, also preview bounding boxes from its sorted child sub-documents mapped to their page numbers
    if (selectedDoc.is_raw_packet) {
      const childIds = new Set(
        caseDocs
          .filter((c) => c.parent_packet_id === selectedDoc.id)
          .map((c) => c.id)
      );
      const own = normalizedFields.filter(
        (f) => f.docId === selectedDoc.id && f.pageNumber === currentPage
      );
      if (own.length > 0) return own;
      return normalizedFields.filter(
        (f) => childIds.has(f.docId) && f.pageNumber === currentPage
      );
    }
    return normalizedFields.filter(
      (f) => f.docId === selectedDoc.id && f.pageNumber === currentPage
    );
  }, [normalizedFields, selectedDoc, currentPage, caseDocs]);

  // Live Initial Information Sheet + Missing Non-Document Gaps Summary (Right Pane)
  const initialSheetSummary = useMemo(() => {
    const saved = getSavedInitialInfoSheetRecord(storageKey);
    const provenance = saved?.fieldProvenance || getAutoFillProvenance(storageKey);
    const formData = saved?.formData || {};
    const gapReport = computeMissingClientGaps(
      formData,
      provenance,
      Boolean(saved?.isSubmitted),
      caseItem?.jurisdiction
    );
    const existingReq = getMissingQuestionsRequest(storageKey);

    const previewPairs: Array<{ label: string; value: string }> = [];
    if (formData.family_name || formData.given_names) {
      previewPairs.push({
        label: "Applicant Legal Name",
        value: `${formData.family_name || ""}${formData.given_names ? `, ${formData.given_names}` : ""}`.trim(),
      });
    }
    if (formData.dob) {
      previewPairs.push({ label: "Date of Birth", value: String(formData.dob) });
    }
    if (formData.passport_number) {
      previewPairs.push({ label: "Passport Number", value: String(formData.passport_number) });
    }
    if (formData.marital_status && formData.family?.spouse?.name) {
      previewPairs.push({
        label: "Spouse / Marital",
        value: `${formData.family.spouse.name} (${formData.marital_status})`,
      });
    } else if (formData.family?.father?.name || formData.family?.mother?.name) {
      previewPairs.push({
        label: "Parents Declared",
        value: [formData.family?.father?.name, formData.family?.mother?.name]
          .filter(Boolean)
          .join(" & "),
      });
    }
    if (Array.isArray(formData.education) && formData.education[0]?.school_name) {
      previewPairs.push({
        label: "Education",
        value: String(formData.education[0].school_name),
      });
    }
    if (Array.isArray(formData.employment) && formData.employment[0]?.company_name) {
      previewPairs.push({
        label: "Employer",
        value: String(formData.employment[0].company_name),
      });
    }

    return {
      saved,
      formData,
      provenance,
      verifiedFieldsCount: Math.max(
        gapReport.verifiedDocumentFieldsCount,
        previewPairs.length
      ),
      verifiedSectionsCount: gapReport.verifiedSectionKeys.length,
      missingGaps: gapReport.missingGaps,
      previewPairs,
      explicitlyPrompted: Boolean(
        missingGapsPromptSent || existingReq?.explicitlyPromptedByParalegal
      ),
    };
  }, [storageKey, caseItem?.jurisdiction, sheetSyncVersion, confirmedTimestamp, aiLabLastRunSummary, missingGapsPromptSent]);

  // Group documents & sponsor Privacy-Shield uploads into the 4 Role Graph buckets
  const roleGraphNodes = useMemo(() => {
    const sponsorHostInvites = sponsorInvites.filter((i) => i.relationship !== "canadian_sibling");
    const crsSiblingInvites = sponsorInvites.filter((i) => i.relationship === "canadian_sibling");

    const buildNode = (
      key: RoleBucketKey,
      title: string,
      subtitle: string,
      invitesForBucket: SponsorInviteRecord[] = []
    ) => {
      const docs = caseDocs.filter((d) => classifyDocumentRoleBucket(d) === key);
      const fields = normalizedFields.filter((f) => f.roleBucket === key);
      const sponsorUploads = invitesForBucket.flatMap((inv) =>
        inv.uploadedItems.map((u) => ({
          ...u,
          sponsorName: inv.sponsorName,
          jurisdiction: inv.jurisdiction,
          privacyShield: inv.privacyShield,
        }))
      );
      return {
        key,
        title,
        subtitle,
        docs,
        fields,
        sponsorUploads,
      };
    };

    return [
      buildNode(
        "applicant",
        "Principal Applicant",
        caseItem?.client_name || "Primary Beneficiary"
      ),
      buildNode(
        "spouse_dependant",
        "Spouse / Dependant",
        "Accompanying & Declared Immediate Family"
      ),
      buildNode(
        "sponsor_host",
        "CA/UK/AU Sponsor / Host",
        "Privacy-Shield Sponsor Uploads Unlocked for Legal Counsel",
        sponsorHostInvites
      ),
      buildNode(
        "crs_sibling",
        "+15 CRS Canadian Sibling",
        "IRCC Express Entry Blood/Adopted Sibling Verification",
        crsSiblingInvites
      ),
    ];
  }, [caseDocs, normalizedFields, sponsorInvites, caseItem?.client_name]);

  // =========================================================================
  // LIVE STATUTORY RULE CALCULATORS (Deterministic, Zero Vanity Numbers)
  // =========================================================================
  const statutoryMetrics = useMemo(() => {
    const allSponsorUploads = sponsorInvites.flatMap((i) => i.uploadedItems);
    const allDocHaystack = caseDocs
      .map((d) => `${d.title || ""} ${d.filename || ""} ${d.category || ""}`)
      .join(" ")
      .toLowerCase();
    const allSponsorHaystack = allSponsorUploads
      .map((u) => `${u.subtypeLabel} ${u.statutoryBadge || ""} ${u.filename || ""}`)
      .join(" ")
      .toLowerCase();

    // 1. IRCC Super Visa LICO (CRA NOA Line 15000 + $100k/365d Medical Insurance)
    let noaLine15000: number | null = null;
    for (const fld of normalizedFields) {
      const k = `${fld.fieldKey} ${fld.label}`.toLowerCase();
      if (k.includes("15000") || k.includes("total_income") || k.includes("noa") || k.includes("annual_income")) {
        const parsed = parseCurrencyAmount(fld.value);
        if (parsed) {
          noaLine15000 = parsed;
          break;
        }
      }
    }
    if (!noaLine15000) {
      for (const up of allSponsorUploads) {
        const fromSummary =
          parseCurrencyAmount(up.extractedSummary?.line_15000) ||
          parseCurrencyAmount(up.extractedSummary?.total_income) ||
          parseCurrencyAmount(up.statutoryBadge);
        if (fromSummary) {
          noaLine15000 = fromSummary;
          break;
        }
      }
    }
    const licoThreshold = getLicoThresholdForFamilySize(licoFamilySize);
    const licoMet = noaLine15000 !== null && noaLine15000 >= licoThreshold;
    const hasSuperVisaInsurance =
      allDocHaystack.includes("insurance") ||
      allDocHaystack.includes("100,000") ||
      allSponsorHaystack.includes("insurance") ||
      allSponsorHaystack.includes("100,000") ||
      normalizedFields.some((f) =>
        `${f.fieldKey} ${f.label} ${f.value}`.toLowerCase().includes("insurance")
      );

    // 2. Express Entry +15 CRS Sibling 3-Prong Check
    const hasSiblingPRorCitizen =
      allDocHaystack.includes("pr card") ||
      allDocHaystack.includes("citizenship") ||
      allSponsorHaystack.includes("pr card") ||
      allSponsorHaystack.includes("citizenship") ||
      sponsorInvites.some(
        (inv) =>
          inv.relationship === "canadian_sibling" &&
          inv.requestedItems.some((r) => r.id.includes("status") && r.satisfied)
      );
    const hasSiblingCanadianAddress =
      allDocHaystack.includes("utility") ||
      allDocHaystack.includes("hydro") ||
      allDocHaystack.includes("lease") ||
      allSponsorHaystack.includes("utility") ||
      allSponsorHaystack.includes("hydro") ||
      allSponsorHaystack.includes("lease") ||
      sponsorInvites.some(
        (inv) =>
          inv.relationship === "canadian_sibling" &&
          inv.requestedItems.some((r) => r.id.includes("residency") && r.satisfied)
      );
    const hasSharedParentProof =
      allDocHaystack.includes("birth") ||
      allSponsorHaystack.includes("birth") ||
      normalizedFields.some((f) =>
        `${f.fieldKey} ${f.label}`.toLowerCase().includes("parent") ||
        `${f.fieldKey} ${f.label}`.toLowerCase().includes("mother") ||
        `${f.fieldKey} ${f.label}`.toLowerCase().includes("father")
      ) ||
      sponsorInvites.some(
        (inv) =>
          inv.relationship === "canadian_sibling" &&
          inv.requestedItems.some((r) => r.id.includes("birth") && r.satisfied)
      );
    const siblingProngsCount =
      (hasSiblingPRorCitizen ? 1 : 0) +
      (hasSiblingCanadianAddress ? 1 : 0) +
      (hasSharedParentProof ? 1 : 0);

    // 3. UKVI 28-Day Continuous Funds
    let ukviClosingBalance: number | null = null;
    for (const fld of normalizedFields) {
      const k = `${fld.fieldKey} ${fld.label}`.toLowerCase();
      if (k.includes("balance") || k.includes("28_day") || k.includes("closing_funds")) {
        const parsed = parseCurrencyAmount(fld.value);
        if (parsed) {
          ukviClosingBalance = parsed;
          break;
        }
      }
    }
    const hasBankStatementEvidence =
      ukviClosingBalance !== null ||
      allDocHaystack.includes("bank") ||
      allDocHaystack.includes("statement") ||
      allSponsorHaystack.includes("hmrc") ||
      allSponsorHaystack.includes("p60");

    // 4. 6-Month Passport Validity Check
    let passportExpiryRaw: string | null = null;
    let passportDaysRemaining: number | null = null;
    for (const fld of normalizedFields) {
      const k = `${fld.fieldKey} ${fld.label}`.toLowerCase();
      if (k.includes("expiry") || k.includes("expiration")) {
        passportExpiryRaw = fld.value;
        const parsedMs = Date.parse(fld.value);
        if (!Number.isNaN(parsedMs)) {
          const nowMs = Date.now();
          passportDaysRemaining = Math.round((parsedMs - nowMs) / (1000 * 60 * 60 * 24));
        }
        break;
      }
    }
    const passportMeetsSixMonths =
      passportDaysRemaining !== null ? passportDaysRemaining >= 180 : null;

    return {
      noaLine15000,
      licoThreshold,
      licoMet,
      hasSuperVisaInsurance,
      hasSiblingPRorCitizen,
      hasSiblingCanadianAddress,
      hasSharedParentProof,
      siblingProngsCount,
      ukviClosingBalance,
      hasBankStatementEvidence,
      passportExpiryRaw,
      passportDaysRemaining,
      passportMeetsSixMonths,
    };
  }, [caseDocs, normalizedFields, sponsorInvites, licoFamilySize]);

  // =========================================================================
  // PARALEGAL LOCAL WORKSTATION AI LAB: OCR, PAGE-SORTING & IMMEDIATE AUTO-FILL
  // =========================================================================
  const handleRunAiLabOnRawUploads = async () => {
    if (isRunningAiLab || pendingRawTargets.length === 0) return;

    setIsRunningAiLab(true);
    setAiLabProgressText(
      `Running local workstation AI Lab on ${pendingRawTargets.length} untouched ${
        pendingRawTargets.length === 1 ? "packet" : "packets"
      }…`
    );

    try {
      const savedExisting = getSavedInitialInfoSheetRecord(storageKey);
      let mergedSheet: Record<string, any> = { ...(savedExisting?.formData || {}) };
      let mergedProvenance: Record<string, AutoFillFieldProvenance> = {
        ...(savedExisting?.fieldProvenance || {}),
        ...getAutoFillProvenance(storageKey),
      };
      const flatConfirmed: Record<string, string> = {};
      const createdSubDocs: DocumentItem[] = [];
      const updatedOriginals: DocumentItem[] = [];
      const nowIso = new Date().toISOString();
      let firstCreatedSubDocId = "";
      let profilePatch: Partial<ClientProfile> = {};

      for (const target of pendingRawTargets) {
        const rawFile = target.storePacket
          ? await loadRawPacketFileAsync(target.storePacket)
          : new File(
              [target.docItem?.extracted_text || `%PDF-1.4\n% ${target.filename}\n%%EOF`],
              target.filename,
              { type: target.docItem?.mime_type || "application/pdf" }
            );

        const pipelineRes = await runSmartIntakePipeline([rawFile], {
          caseId: caseItem?.id,
          contributorRole: target.uploaderRole === "sponsor" ? "sponsor" : "staff",
          pathway: caseItem?.visa_category,
          onProgress: (prog) => {
            setAiLabProgressText(prog.label);
          },
        });

        // Map multi-person packet sort directly if present
        if (pipelineRes.packetSortResult) {
          const pktMapped = mapPacketToInitialInfoSheet(
            pipelineRes.packetSortResult,
            mergedSheet as any
          );
          mergedSheet = { ...mergedSheet, ...pktMapped.updatedData };
          mergedProvenance = { ...mergedProvenance, ...pktMapped.provenance };
        }

        const childSummaries: SortedChildDocSummary[] = [];

        pipelineRes.documents.forEach((sdoc, sIdx) => {
          const childDocId = `ai-subdoc-${target.vaultDocId}-${sIdx + 1}`;
          if (!firstCreatedSubDocId) {
            firstCreatedSubDocId = childDocId;
          }

          const rawFieldsFromAnalysis = sdoc.analysis?.extracted_fields || [];
          const extractedFieldsForVault =
            rawFieldsFromAnalysis.length > 0
              ? rawFieldsFromAnalysis.map((ef, fIdx) => ({
                  id: `${childDocId}-fld-${fIdx}`,
                  field_name: ef.field_name,
                  field_label: ef.field_label,
                  original_value: ef.original_value,
                  normalized_value: ef.normalized_value,
                  field_value: ef.normalized_value || ef.original_value,
                  source_page: ef.source_page || 1,
                  page_number: ef.source_page || 1,
                  extraction_method: ef.extraction_method || "paralegal_ai_lab",
                  confidence: ef.calibrated_confidence || sdoc.confidence,
                  ocr_confidence: ef.ocr_confidence || sdoc.confidence,
                  extraction_confidence: ef.extraction_confidence || sdoc.confidence,
                  bounding_box: ef.bounding_box,
                  validation_status: "validated" as const,
                  is_manually_corrected: false,
                  is_confirmed: true,
                }))
              : Object.entries(sdoc.extractedFields).map(([k, v], fIdx) => {
                  const rowTop = 16 + (fIdx % 6) * 12;
                  return {
                    id: `${childDocId}-fld-${fIdx}`,
                    field_name: k,
                    field_label: k.replace(/_/g, " ").toUpperCase(),
                    original_value: v,
                    normalized_value: v,
                    field_value: v,
                    source_page: sdoc.pageNumbers?.[0] || 1,
                    page_number: sdoc.pageNumbers?.[0] || 1,
                    extraction_method: "paralegal_ai_lab",
                    confidence: sdoc.confidence,
                    ocr_confidence: sdoc.confidence,
                    extraction_confidence: sdoc.confidence,
                    bounding_box: [rowTop, 8, rowTop + 9, 90] as [
                      number,
                      number,
                      number,
                      number,
                    ],
                    validation_status: "validated" as const,
                    is_manually_corrected: false,
                    is_confirmed: true,
                  };
                });

          // Map child document into InitialInformationSheet & Client Profile
          const analysisForMapping: ExtractorAnalysisResult =
            sdoc.analysis || {
              status: "success",
              metadata: {
                filename: sdoc.filename,
                mime_type: "application/pdf",
                file_size_bytes: sdoc.sourceFile.size,
                sha256_hash: sdoc.sha256,
                page_count: sdoc.pageCount,
                detected_language: "en",
                total_blocks_detected: extractedFieldsForVault.length,
                overall_health_score: 96,
              },
              recognition: {
                category: sdoc.category,
                category_label: sdoc.subtypeLabel,
                confidence: sdoc.confidence,
                matched_keywords: [],
              },
              extracted_fields: extractedFieldsForVault.map((ef) => ({
                field_name: ef.field_name,
                field_label: ef.field_label || ef.field_name,
                original_value: ef.original_value || "",
                normalized_value: ef.normalized_value || "",
                source_page: ef.source_page || 1,
                ocr_confidence: ef.ocr_confidence || 0.96,
                extraction_confidence: ef.extraction_confidence || 0.96,
                calibrated_confidence: ef.confidence || 0.96,
                extraction_method: "paralegal_ai_lab",
                model_version: "doc-intel-v5.0",
                bounding_box: (ef.bounding_box as [number, number, number, number]) || [
                  0.16,
                  0.08,
                  0.25,
                  0.9,
                ],
                review_status: "VERIFIED",
              })),
              quality_findings: [],
              specialized_intelligence: {},
              ocr_summary: {
                ocr_applied: true,
                avg_page_confidence: sdoc.confidence,
                pages: [],
              },
              raw_text_preview: "",
            };

          const sheetMapped = mapAnalysisToInitialInfoSheet(
            analysisForMapping,
            mergedSheet as any
          );
          mergedSheet = { ...mergedSheet, ...sheetMapped.updatedData };
          mergedProvenance = { ...mergedProvenance, ...sheetMapped.provenance };

          if (sdoc.personRole === "principal_applicant") {
            const extractedProf = extractProfileFromAnalysis(
              analysisForMapping,
              sdoc.filename
            );
            if (extractedProf.firstName && !profilePatch.first_name) {
              profilePatch.first_name = extractedProf.firstName;
            }
            if (extractedProf.lastName && !profilePatch.last_name) {
              profilePatch.last_name = extractedProf.lastName;
            }
            if (extractedProf.nationality && !profilePatch.nationality) {
              profilePatch.nationality = extractedProf.nationality;
            }
            if (extractedProf.email && !profilePatch.email) {
              profilePatch.email = extractedProf.email;
            }
            if (extractedProf.phone && !profilePatch.phone) {
              profilePatch.phone = extractedProf.phone;
            }
          }

          const pageRangeLabel =
            sdoc.pageRange ||
            (sdoc.pageCount > 1 ? `Pages 1–${sdoc.pageCount}` : "Page 1");

          const childVaultDoc: DocumentItem = {
            id: childDocId,
            case_id: caseItem?.id,
            title: `${sdoc.subtypeLabel} — ${sdoc.personName}`,
            filename: sdoc.filename,
            category: mapToVaultCategory(sdoc.category),
            file_size: target.fileSizeLabel || "PDF",
            sha256_hash: sdoc.sha256,
            status: "verified",
            processing_status: "completed",
            verification_status: "verified",
            uploaded_at: nowIso,
            page_count: sdoc.pageCount,
            page_range: pageRangeLabel,
            page_numbers: sdoc.pageNumbers || [1],
            parent_packet_id: target.vaultDocId,
            person_role: sdoc.personRole,
            person_name: sdoc.personName,
            uploader_role: target.uploaderRole,
            is_private_to_firm: target.privacyShield,
            ocr_applied: true,
            extracted_fields: extractedFieldsForVault as any,
          };

          createdSubDocs.push(childVaultDoc);
          onDocumentUploaded?.(childVaultDoc);

          extractedFieldsForVault.forEach((ef) => {
            const val = String(ef.field_value || ef.normalized_value || "").trim();
            if (!val) return;
            flatConfirmed[ef.field_name] = val;
            mergedProvenance[ef.field_name] = {
              field_name: ef.field_name,
              field_label: ef.field_label || ef.field_name,
              value: val,
              source_type: "document_ocr",
              source_id: childDocId,
              source_document_title: childVaultDoc.title,
              source_page: ef.source_page || 1,
              confidence: ef.confidence || 0.96,
              bounding_box: ef.bounding_box as [number, number, number, number],
              extracted_at: nowIso,
              is_confirmed: true,
              locked_by_ai_lab: true,
            };
          });

          childSummaries.push({
            id: childDocId,
            title: childVaultDoc.title,
            filename: sdoc.filename,
            category: childVaultDoc.category as string,
            subtypeLabel: sdoc.subtypeLabel,
            personName: sdoc.personName,
            personRole: sdoc.personRole,
            pageRange: pageRangeLabel,
            pageNumbers: sdoc.pageNumbers || [1],
            pageCount: sdoc.pageCount,
            confidence: sdoc.confidence,
            extractedFieldsCount: extractedFieldsForVault.length,
          });

          if (target.uploaderRole === "sponsor" || sdoc.personRole === "overseas_sponsor_host") {
            enrichSponsorUploadFromAiLab(
              target.storePacket?.sponsorInviteToken || sponsorLookupKey,
              { sha256: target.sha256, filename: target.filename },
              {
                subtypeLabel: sdoc.subtypeLabel,
                category: mapToVaultCategory(sdoc.category),
                statutoryBadge: sdoc.statutoryBadges[0] || pipelineRes.statutoryHighlights[0],
                extractedSummary: sdoc.extractedFields,
              }
            );
          }
        });

        // Keep untouched Original Packet in Vault and mark its AI Lab tree completed
        const existingOriginal = caseDocs.find((d) => d.id === target.vaultDocId);
        const updatedOriginalDoc: DocumentItem = {
          ...(existingOriginal || ({} as DocumentItem)),
          id: target.vaultDocId,
          case_id: caseItem?.id,
          title: existingOriginal?.title || target.filename,
          filename: target.filename,
          category: existingOriginal?.category || "supporting_evidence",
          file_size: target.fileSizeLabel,
          sha256_hash: target.sha256,
          status: "verified",
          processing_status: "completed",
          verification_status: "verified",
          uploaded_at: existingOriginal?.uploaded_at || nowIso,
          page_count: Math.max(
            pipelineRes.totalPagesProcessed,
            existingOriginal?.page_count || 1
          ),
          ocr_applied: true,
          is_raw_packet: true,
          raw_packet_id: target.packetId,
          ai_lab_status: "completed",
          uploader_role: target.uploaderRole,
          is_private_to_firm: target.privacyShield,
        };
        updatedOriginals.push(updatedOriginalDoc);
        onDocumentUpdated?.(updatedOriginalDoc);

        markRawPacketProcessedByAiLab(target.packetId, {
          sortedChildren: childSummaries,
          autoFilledFieldsCount: Object.keys(mergedProvenance).length,
        });
      }

      // Mark all provenance fields confirmed & locked by AI Lab so Client Portal pre-completes them
      Object.keys(mergedProvenance).forEach((k) => {
        mergedProvenance[k] = {
          ...mergedProvenance[k],
          is_confirmed: true,
          locked_by_ai_lab: true,
        };
      });

      // Immediately persist & broadcast to Initial Information Sheet, Client Profile & Gov Forms
      persistAndBroadcastAutoFill(storageKey, {
        formData: mergedSheet,
        provenance: mergedProvenance,
        sourceDocId: firstCreatedSubDocId || updatedOriginals[0]?.id,
        sourceFilename: pendingRawTargets[0]?.filename || "Client Raw Packet",
      });

      if (Object.keys(profilePatch).length > 0) {
        onClientProfileAutoFilled?.(profilePatch);
      }

      const gapSummary = computeMissingClientGaps(
        mergedSheet,
        mergedProvenance,
        false,
        caseItem?.jurisdiction
      );
      publishMissingQuestionsRequest(storageKey, {
        requestedBy: caseItem?.assigned_manager || "Assigned Paralegal",
        aiFilledFieldsCount: Math.max(
          gapSummary.verifiedDocumentFieldsCount,
          Object.keys(flatConfirmed).length
        ),
        verifiedSectionsCount: gapSummary.verifiedSectionKeys.length,
        missingGaps: gapSummary.missingGaps,
        autoTriggeredByAiLab: true,
        explicitlyPromptedByParalegal: false,
      });

      setLocalDocs((prev) => [...createdSubDocs, ...updatedOriginals, ...prev]);
      if (firstCreatedSubDocId) {
        setSelectedDocId(firstCreatedSubDocId);
        setCurrentPage(1);
      }

      const totalFilled = Math.max(
        Object.keys(mergedProvenance).length,
        Object.keys(flatConfirmed).length
      );
      const stamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setConfirmedTimestamp(stamp);
      setConfirmedFieldCount(totalFilled);
      setAiLabLastRunSummary({
        packetsProcessed: pendingRawTargets.length,
        subDocsCreated: createdSubDocs.length,
        fieldsAutoFilled: totalFilled,
      });
      setSheetSyncVersion((v) => v + 1);
      onPushToForms?.(flatConfirmed);
    } finally {
      setIsRunningAiLab(false);
      setAiLabProgressText("");
    }
  };

  const handlePromptClientForMissingGaps = () => {
    publishMissingQuestionsRequest(storageKey, {
      requestedBy: caseItem?.assigned_manager || "Assigned Paralegal",
      aiFilledFieldsCount: initialSheetSummary.verifiedFieldsCount,
      verifiedSectionsCount: initialSheetSummary.verifiedSectionsCount,
      missingGaps: initialSheetSummary.missingGaps,
      autoTriggeredByAiLab: true,
      explicitlyPromptedByParalegal: true,
    });
    setMissingGapsPromptSent(true);
    setSheetSyncVersion((v) => v + 1);
  };

  const handleStaffSmartUpload = (doc: DocumentItem) => {
    setLocalDocs((prev) => [doc, ...prev]);
    setSelectedDocId(doc.id);
    setCurrentPage(1);
    onDocumentUploaded?.(doc);
  };

  const handleStaffIntakeComplete = (_summary: SmartIntakeSummary) => {
    setSheetSyncVersion((v) => v + 1);
  };

  const handleFocusField = (fld: NormalizedStudioField) => {
    setActiveFieldId(fld.id);
    if (fld.docId !== selectedDocId) {
      setSelectedDocId(fld.docId);
    }
    if (fld.pageNumber !== currentPage) {
      setCurrentPage(fld.pageNumber);
    }
  };

  const handleConfirmAndPushToForms = () => {
    confirmAndApplyPendingAutoFill(storageKey);
    let mergedSheet: Record<string, any> = {};
    let mergedProvenance: Record<string, AutoFillFieldProvenance> = {
      ...getAutoFillProvenance(storageKey),
    };
    let sourceDocId = selectedDoc?.id || caseDocs[0]?.id || "studio-doc";
    let sourceFilename = selectedDoc?.filename || selectedDoc?.title || "Case Evidence Vault";
    const nowIso = new Date().toISOString();

    for (const doc of caseDocs) {
      if ((doc.extracted_fields?.length || 0) > 0) {
        const normalizedDoc = {
          ...doc,
          extracted_fields: (doc.extracted_fields || []).map((ef: any) => ({
            ...ef,
            field_value: ef.field_value ?? ef.value,
          })),
        };
        const mapped = mapAnalysisToInitialInfoSheet(normalizedDoc as any, mergedSheet as any);
        mergedSheet = { ...mergedSheet, ...mapped.updatedData };
        mergedProvenance = { ...mergedProvenance, ...mapped.provenance };
        sourceDocId = doc.id;
        sourceFilename = doc.filename || doc.title || sourceFilename;
      }
    }

    const flatConfirmed: Record<string, string> = {};
    for (const fld of normalizedFields) {
      flatConfirmed[fld.fieldKey] = fld.value;
      if (!mergedSheet[fld.fieldKey]) {
        mergedSheet[fld.fieldKey] = fld.value;
      }
      mergedProvenance[fld.fieldKey] = {
        field_name: fld.fieldKey,
        field_label: fld.label,
        value: fld.value,
        source_type: "document_ocr",
        source_id: fld.docId,
        source_document_title: fld.docTitle,
        source_page: fld.pageNumber,
        confidence: fld.confidencePct / 100,
        bounding_box: fld.bboxPct,
        extracted_at: mergedProvenance[fld.fieldKey]?.extracted_at || nowIso,
        is_confirmed: true,
        locked_by_ai_lab: true,
      };
    }

    for (const [k, prov] of Object.entries(mergedProvenance)) {
      mergedProvenance[k] = {
        ...prov,
        is_confirmed: true,
        locked_by_ai_lab: true,
      };
    }

    persistAndBroadcastAutoFill(storageKey, {
      formData: mergedSheet,
      provenance: mergedProvenance,
      sourceDocId,
      sourceFilename,
    });

    const gapSummary = computeMissingClientGaps(
      mergedSheet,
      mergedProvenance,
      false,
      caseItem?.jurisdiction
    );
    publishMissingQuestionsRequest(storageKey, {
      requestedBy: caseItem?.assigned_manager || "Assigned Paralegal",
      aiFilledFieldsCount: Math.max(normalizedFields.length, Object.keys(mergedSheet).length),
      verifiedSectionsCount: gapSummary.verifiedSectionKeys.length,
      missingGaps: gapSummary.missingGaps,
      autoTriggeredByAiLab: true,
      explicitlyPromptedByParalegal: missingGapsPromptSent,
    });

    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setConfirmedTimestamp(stamp);
    setConfirmedFieldCount(Math.max(normalizedFields.length, Object.keys(mergedSheet).length));
    setSheetSyncVersion((v) => v + 1);
    onPushToForms?.(flatConfirmed);
  };

  return (
    <section
      data-testid="split-screen-case-studio"
      aria-label="Split-Screen Legal Case Studio"
      style={{
        background: "#F8F7F2",
        border: "1px solid #DCE5E1",
        borderRadius: "12px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Studio Top Bar */}
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
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
              Split-Screen Case Studio
            </h2>
            <span
              style={{
                background: "#EAF6F0",
                color: "#176B50",
                border: "1px solid #B9DED4",
                borderRadius: "6px",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {caseDocs.length} Vault File{caseDocs.length === 1 ? "" : "s"} • {normalizedFields.length} Provenance Field{normalizedFields.length === 1 ? "" : "s"}
            </span>
          </div>
          <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "#445451" }}>
            Untouched client packets alongside local AI Lab page-sorting, spatial OCR bounding boxes &amp; auto-filled Initial Information Sheet.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {confirmedTimestamp && (
            <span
              data-testid="studio-autofill-audit-banner"
              style={{
                background: "#EAF6F0",
                color: "#176B50",
                border: "1px solid #176B50",
                borderRadius: "8px",
                padding: "7px 12px",
                fontSize: "12px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ✓ {confirmedFieldCount} Field{confirmedFieldCount === 1 ? "" : "s"} Confirmed &amp; Pushed to Forms ({confirmedTimestamp})
            </span>
          )}
          <button
            type="button"
            data-testid="studio-confirm-autofill-btn"
            onClick={handleConfirmAndPushToForms}
            style={{
              background: "#063C3D",
              color: "#FFFFFF",
              border: "1px solid #063C3D",
              borderRadius: "8px",
              padding: "9px 16px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✓ 1-Click Confirm &amp; Push to Forms
          </button>
        </div>
      </div>

      {/* TOP INBOX BANNER: UNPROCESSED RAW CLIENT / SPONSOR UPLOADS -> 1-CLICK LOCAL AI LAB */}
      {(pendingRawTargets.length > 0 || isRunningAiLab || aiLabLastRunSummary) && (
        <div
          data-testid="studio-raw-packets-banner"
          style={{
            background: "#FFFFFF",
            border: pendingRawTargets.length > 0 ? "1.5px solid #07594F" : "1px solid #B9DED4",
            borderRadius: "10px",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
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
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span
                  style={{
                    background: pendingRawTargets.length > 0 ? "#EAF6F0" : "#F8F7F2",
                    color: "#063C3D",
                    border: "1px solid #B9DED4",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: 750,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {pendingRawTargets.length > 0
                    ? "Raw Client Inbox • Pending Local AI Lab"
                    : "Local AI Lab Completed"}
                </span>
                <strong style={{ fontSize: "14px", color: "#063C3D", fontVariantNumeric: "tabular-nums" }}>
                  {pendingRawTargets.length > 0
                    ? `${pendingRawTargets.length} Untouched Client / Sponsor ${
                        pendingRawTargets.length === 1 ? "File" : "Files"
                      } Ready for Workstation OCR, Sort & Auto-Fill`
                    : `✓ Processed ${aiLabLastRunSummary?.packetsProcessed || 1} Original ${
                        (aiLabLastRunSummary?.packetsProcessed || 1) === 1 ? "Packet" : "Packets"
                      } → ${aiLabLastRunSummary?.subDocsCreated || 1} Sorted Sub-Documents & ${
                        aiLabLastRunSummary?.fieldsAutoFilled || 0
                      } Sheet Fields Auto-Filled`}
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "#445451" }}>
                {pendingRawTargets.length > 0
                  ? "Client uploaded raw file(s) with zero wait. Run AI Lab on your local device to keep the untouched original alongside sorted sub-documents and auto-fill the Initial Information Sheet."
                  : "Original untouched packet is preserved in the Left Tree alongside its sorted child documents. Client Portal now pre-locks AI-verified fields and only asks remaining non-document gaps."}
              </span>
            </div>

            {pendingRawTargets.length > 0 && (
              <button
                type="button"
                data-testid="studio-run-ai-lab-btn"
                disabled={isRunningAiLab}
                onClick={() => void handleRunAiLabOnRawUploads()}
                style={{
                  background: "#07594F",
                  color: "#FFFFFF",
                  border: "1px solid #063C3D",
                  borderRadius: "8px",
                  padding: "9px 16px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: isRunningAiLab ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {isRunningAiLab
                  ? "Running Local AI Lab…"
                  : "⚡ Run AI Lab (OCR, Sort & Auto-Fill)"}
              </button>
            )}
          </div>

          {isRunningAiLab && aiLabProgressText && (
            <div
              data-testid="studio-ai-lab-progress"
              style={{
                padding: "8px 12px",
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "7px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#063C3D",
              }}
            >
              {aiLabProgressText}
            </div>
          )}

          {pendingRawTargets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {pendingRawTargets.map((t) => (
                <div
                  key={t.packetId}
                  data-testid={`studio-pending-raw-pill-${t.vaultDocId}`}
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "7px",
                    padding: "6px 10px",
                    fontSize: "11.5px",
                    color: "#063C3D",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <strong>{t.filename}</strong>
                  <span style={{ color: "#526663" }}>({t.fileSizeLabel})</span>
                  <span
                    style={{
                      background: t.uploaderRole === "sponsor" ? "#EAF6F0" : "#FFFFFF",
                      color: t.uploaderRole === "sponsor" ? "#176B50" : "#063C3D",
                      border: "1px solid #DCE5E1",
                      borderRadius: "999px",
                      padding: "1px 7px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                    }}
                  >
                    {t.uploaderRole === "sponsor"
                      ? t.privacyShield
                        ? "🔒 Sponsor (Counsel-Only)"
                        : "Sponsor Upload"
                      : "Retained Client"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Unified 3-Pane Studio Grid:
          1. Left: Raw Packet -> AI Lab Sorted Sub-Documents Tree + Compact Staff Dropzone
          2. Center: Live PDF Page + Spatial Bounding Boxes + Page/Zoom Controls
          3. Right: Auto-Filled Initial Info Sheet Summary + Role Graph + Live Statutory Calculators */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        {/* =====================================================================
            LEFT PANE: UNTOUCHED ORIGINAL PACKETS + SORTED SUB-DOCUMENTS TREE
            ===================================================================== */}
        <div
          data-testid="studio-left-document-pane"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ borderBottom: "1px solid #DCE5E1", paddingBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 750, color: "#063C3D" }}>
              Raw Client Packets → AI Sorted Tree
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#445451" }}>
              Untouched original uploads preserved alongside child sorted sub-documents and page ranges.
            </p>
          </div>

          <div
            data-testid="studio-packet-tree"
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {caseDocs.length === 0 && (
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px dashed #DCE5E1",
                  borderRadius: "8px",
                  padding: "18px 12px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#526663",
                }}
              >
                No client or staff files in vault yet.
              </div>
            )}

            {/* Parent Original Packets + Indented Sorted Child Sub-Documents */}
            {studioPacketTree.packetGroups.map(({ parent, children }) => {
              const isParentSelected = selectedDoc?.id === parent.id;
              const isSorted = parent.ai_lab_status === "completed";
              return (
                <div
                  key={parent.id}
                  data-testid={`packet-tree-group-${parent.id}`}
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    data-testid={`packet-tree-original-${parent.id}`}
                    onClick={() => {
                      setSelectedDocId(parent.id);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: isParentSelected ? "#EAF6F0" : "#FFFFFF",
                      border: isParentSelected ? "1.5px solid #07594F" : "1px solid #DCE5E1",
                      borderRadius: "7px",
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 750,
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "#EAF6F0",
                          color: "#063C3D",
                          border: "1px solid #B9DED4",
                        }}
                      >
                        Original Untouched Packet
                      </span>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: isSorted ? "#176B50" : "#8A5A10",
                        }}
                      >
                        {isSorted
                          ? `✓ Sorted (${children.length})`
                          : "⏳ Pending AI Lab"}
                      </span>
                    </div>
                    <strong style={{ fontSize: "12.5px", color: "#063C3D", wordBreak: "break-word" }}>
                      {parent.filename || parent.title}
                    </strong>
                    <span style={{ fontSize: "11px", color: "#526663", fontVariantNumeric: "tabular-nums" }}>
                      {parent.file_size || "PDF"} • {parent.page_count || 1}{" "}
                      {(parent.page_count || 1) === 1 ? "pg" : "pgs"}
                    </span>
                  </button>

                  {children.length > 0 && (
                    <div
                      data-testid={`packet-tree-children-${parent.id}`}
                      style={{
                        paddingLeft: "10px",
                        borderLeft: "2px solid #B9DED4",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {children.map((child) => {
                        const isChildSelected = selectedDoc?.id === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            data-testid={`packet-tree-subdoc-${child.id}`}
                            onClick={() => {
                              setSelectedDocId(child.id);
                              setCurrentPage(child.page_numbers?.[0] || 1);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              background: isChildSelected ? "#EAF6F0" : "#FFFFFF",
                              border: isChildSelected
                                ? "1.5px solid #07594F"
                                : "1px solid #DCE5E1",
                              borderRadius: "6px",
                              padding: "7px 9px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 650,
                                  color: "#063C3D",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {child.title}
                              </div>
                              <div style={{ fontSize: "10.5px", color: "#526663" }}>
                                {(child.category || "evidence").replace(/_/g, " ")} •{" "}
                                {(child.extracted_fields || []).length} OCR fields
                              </div>
                            </div>
                            <span
                              data-testid={`sorted-subdoc-range-${child.id}`}
                              style={{
                                flexShrink: 0,
                                background: "#F8F7F2",
                                border: "1px solid #DCE5E1",
                                borderRadius: "5px",
                                padding: "2px 6px",
                                fontSize: "10.5px",
                                fontWeight: 700,
                                color: "#07594F",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {child.page_range || `Page 1`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Standalone Vault Documents */}
            {studioPacketTree.standaloneDocs.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  data-testid={`packet-tree-standalone-${doc.id}`}
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isSelected ? "#EAF6F0" : "#F8F7F2",
                    border: isSelected ? "1.5px solid #07594F" : "1px solid #DCE5E1",
                    borderRadius: "7px",
                    padding: "8px 10px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 650,
                        color: "#063C3D",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {doc.title || doc.filename}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#526663" }}>
                      {(doc.category || "evidence").replace(/_/g, " ")}
                    </div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: "10.5px",
                      fontWeight: 700,
                      color: "#176B50",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {(doc.extracted_fields || []).length} fields
                  </span>
                </button>
              );
            })}
          </div>

          {/* Embedded Compact Staff SmartDropzone (Immediate Workstation AI Lab kept for Firm Staff) */}
          <div data-testid="studio-compact-dropzone" style={{ marginTop: "auto" }}>
            <SmartDropzone
              caseId={caseItem?.id}
              clientName={caseItem?.client_name}
              pathway={caseItem?.visa_category}
              contributorRole="staff"
              uploadMode="immediate_ai"
              compact
              onDocumentUploaded={handleStaffSmartUpload}
              onIntakeComplete={handleStaffIntakeComplete}
            />
          </div>
        </div>

        {/* =====================================================================
            CENTER PANE: LIVE PDF PAGE + SPATIAL OCR BOUNDING-BOX CANVAS
            ===================================================================== */}
        <div
          data-testid="studio-center-canvas-pane"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "10px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Document Selector + Page Switcher + Zoom Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              paddingBottom: "12px",
              borderBottom: "1px solid #DCE5E1",
            }}
          >
            <div style={{ flex: 1, minWidth: "180px" }}>
              <label
                htmlFor="studio-doc-selector"
                style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", marginBottom: "4px" }}
              >
                Active Vault Document
              </label>
              <select
                id="studio-doc-selector"
                data-testid="studio-doc-selector"
                value={selectedDoc?.id || ""}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "7px",
                  border: "1px solid #DCE5E1",
                  background: "#F8F7F2",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  color: "#063C3D",
                }}
              >
                {caseDocs.length === 0 ? (
                  <option value="">No documents uploaded yet — drop packet on left</option>
                ) : (
                  caseDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.is_raw_packet ? `[Original] ` : d.parent_packet_id ? `[Sorted ${d.page_range || "Sub-Doc"}] ` : ""}
                      {d.title || d.filename} ({(d.category || "evidence").replace(/_/g, " ")})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Page Switcher */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "7px",
                padding: "4px 8px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <button
                type="button"
                data-testid="studio-page-prev"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  border: "none",
                  background: "transparent",
                  color: currentPage <= 1 ? "#94A3B8" : "#063C3D",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: currentPage <= 1 ? "default" : "pointer",
                }}
              >
                ◀ Prev
              </button>
              <span data-testid="studio-page-indicator" style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D" }}>
                Page {currentPage} of {totalPagesForSelectedDoc}
              </span>
              <button
                type="button"
                data-testid="studio-page-next"
                disabled={currentPage >= totalPagesForSelectedDoc}
                onClick={() => setCurrentPage((p) => Math.min(totalPagesForSelectedDoc, p + 1))}
                style={{
                  border: "none",
                  background: "transparent",
                  color: currentPage >= totalPagesForSelectedDoc ? "#94A3B8" : "#063C3D",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: currentPage >= totalPagesForSelectedDoc ? "default" : "pointer",
                }}
              >
                Next ▶
              </button>
            </div>

            {/* Zoom Controls */}
            <div
              data-testid="studio-zoom-controls"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "7px",
                padding: "3px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {[75, 100, 125, 150].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomPct(z)}
                  style={{
                    padding: "4px 7px",
                    borderRadius: "5px",
                    border: "none",
                    background: zoomPct === z ? "#063C3D" : "transparent",
                    color: zoomPct === z ? "#FFFFFF" : "#445451",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {z}%
                </button>
              ))}
            </div>
          </div>

          {/* Interactive OCR Bounding-Box Document Canvas */}
          <div
            data-testid="studio-bbox-canvas"
            style={{
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              borderRadius: "8px",
              padding: "14px",
              minHeight: "340px",
              overflow: "auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            {!selectedDoc ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "#445451", fontSize: "13px" }}>
                <strong style={{ display: "block", color: "#063C3D", marginBottom: "4px" }}>
                  No Document Loaded in Canvas
                </strong>
                Drop a client or sponsor packet in the left pane to inspect spatial OCR bounding boxes.
              </div>
            ) : (
              <div
                data-testid="studio-document-page"
                style={{
                  position: "relative",
                  width: `${zoomPct}%`,
                  maxWidth: "100%",
                  minHeight: "300px",
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  padding: "16px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "6px",
                    borderBottom: "1px solid #DCE5E1",
                    paddingBottom: "8px",
                    marginBottom: "12px",
                    fontSize: "11.5px",
                    color: "#445451",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <strong style={{ color: "#063C3D" }}>{selectedDoc.title || selectedDoc.filename}</strong>
                    {selectedDoc.is_raw_packet && (
                      <span
                        style={{
                          background: "#EAF6F0",
                          color: "#063C3D",
                          border: "1px solid #B9DED4",
                          borderRadius: "4px",
                          padding: "1px 6px",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        Untouched Original
                      </span>
                    )}
                    {selectedDoc.page_range && (
                      <span
                        style={{
                          background: "#F8F7F2",
                          color: "#07594F",
                          border: "1px solid #DCE5E1",
                          borderRadius: "4px",
                          padding: "1px 6px",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {selectedDoc.page_range}
                      </span>
                    )}
                  </div>
                  <span>
                    Page {currentPage} • {currentDocPageFields.length} OCR Region{currentDocPageFields.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Spatial Bounding-Box Overlays */}
                <div style={{ position: "relative", height: "235px", background: "#FAFAF7", border: "1px dashed #DCE5E1", borderRadius: "4px" }}>
                  {currentDocPageFields.length === 0 ? (
                    <div style={{ padding: "40px 16px", textAlign: "center", fontSize: "12px", color: "#6E7F7C" }}>
                      {selectedDoc.is_raw_packet && selectedDoc.ai_lab_status !== "completed"
                        ? "Untouched raw upload loaded. Click '⚡ Run AI Lab (OCR, Sort & Auto-Fill)' above to extract spatial bounding boxes and auto-fill forms."
                        : `Document preview active (${selectedDoc.file_size || "PDF"}). Select or extract fields to highlight bounding-box coordinates.`}
                    </div>
                  ) : (
                    currentDocPageFields.map((fld) => {
                      const [ymin, xmin, ymax, xmax] = fld.bboxPct;
                      const isSelected = activeFieldId === fld.id;
                      return (
                        <button
                          key={fld.id}
                          type="button"
                          data-testid={`studio-bbox-${fld.fieldKey}`}
                          onMouseEnter={() => setActiveFieldId(fld.id)}
                          onClick={() => setActiveFieldId(fld.id)}
                          title={`${fld.label}: ${fld.value} [${ymin.toFixed(0)}, ${xmin.toFixed(0)}, ${ymax.toFixed(0)}, ${xmax.toFixed(0)}]`}
                          style={{
                            position: "absolute",
                            top: `${ymin}%`,
                            left: `${xmin}%`,
                            width: `${Math.max(18, xmax - xmin)}%`,
                            minHeight: `${Math.max(10, ymax - ymin)}%`,
                            background: isSelected ? "rgba(7, 89, 79, 0.16)" : "rgba(23, 107, 80, 0.08)",
                            border: isSelected ? "2px solid #063C3D" : "1px solid #176B50",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "6px",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "11px",
                            color: "#063C3D",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <strong>{fld.label}:</strong> {fld.value}
                          </span>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#176B50" }}>
                            {fld.confidencePct}%
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================================
            RIGHT PANE: AUTO-FILLED INITIAL INFO SHEET + ROLE GRAPH + CALCULATORS
            ===================================================================== */}
        <div
          data-testid="studio-right-intelligence-pane"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* 0. Auto-Filled Initial Information Sheet Summary & "Only Ask What's Missing" */}
          <div
            data-testid="studio-initial-sheet-summary"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "8px",
                borderBottom: "1px solid #DCE5E1",
                paddingBottom: "10px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 750, color: "#063C3D" }}>
                  Auto-Filled Initial Information Sheet
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#445451" }}>
                  AI Lab populates &amp; locks verified document details automatically; client is only asked remaining non-document gaps.
                </p>
              </div>
              <span
                style={{
                  background: initialSheetSummary.verifiedFieldsCount > 0 ? "#EAF6F0" : "#F8F7F2",
                  color: initialSheetSummary.verifiedFieldsCount > 0 ? "#176B50" : "#445451",
                  border: "1px solid #B9DED4",
                  borderRadius: "6px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {initialSheetSummary.verifiedFieldsCount} Auto-Filled • {initialSheetSummary.missingGaps.length} Non-Doc Gaps
              </span>
            </div>

            {initialSheetSummary.previewPairs.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "8px",
                }}
              >
                {initialSheetSummary.previewPairs.map((pair) => (
                  <div
                    key={pair.label}
                    style={{
                      background: "#EAF6F0",
                      border: "1px solid #B9DED4",
                      borderRadius: "7px",
                      padding: "7px 9px",
                      fontSize: "11.5px",
                    }}
                  >
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#176B50", textTransform: "uppercase" }}>
                      ✓ {pair.label}
                    </div>
                    <strong style={{ color: "#063C3D", display: "block", marginTop: "2px" }}>
                      {pair.value}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "7px",
                  padding: "9px 11px",
                  fontSize: "11.5px",
                  color: "#526663",
                }}
              >
                Run AI Lab on raw client packets (or confirm extracted fields) to auto-populate the 11-section Initial Information Sheet.
              </div>
            )}

            {initialSheetSummary.missingGaps.length > 0 && (
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D" }}>
                  Remaining Non-Document Client Questions ({initialSheetSummary.missingGaps.length}):
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {initialSheetSummary.missingGaps.map((gap) => (
                    <div
                      key={gap.sectionKey}
                      style={{
                        fontSize: "11px",
                        color: "#445451",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ color: "#07594F", fontWeight: 700 }}>•</span>
                      <span>
                        <strong>Sec {gap.sectionNumber}:</strong> {gap.label}
                      </span>
                    </div>
                  ))}
                </div>

                {initialSheetSummary.explicitlyPrompted ? (
                  <div
                    data-testid="studio-missing-gaps-sent-badge"
                    style={{
                      background: "#EAF6F0",
                      border: "1px solid #B9DED4",
                      color: "#176B50",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                    }}
                  >
                    ✓ Client Portal Prompted — Only Asking Remaining Non-Document Gaps
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="studio-request-missing-gaps-btn"
                    onClick={handlePromptClientForMissingGaps}
                    style={{
                      alignSelf: "flex-start",
                      background: "#FFFFFF",
                      color: "#063C3D",
                      border: "1px solid #063C3D",
                      borderRadius: "7px",
                      padding: "6px 12px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Ask Client Only What&apos;s Missing ({initialSheetSummary.missingGaps.length}) →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 1. Smart Family & Sponsor Role Graph */}
          <div
            data-testid="studio-role-graph"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ borderBottom: "1px solid #DCE5E1", paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 750, color: "#063C3D" }}>
                Smart Family &amp; Sponsor Role Graph
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#445451" }}>
                Entities &amp; Privacy-Shield sponsor records organized by statutory relationship. Hover or click a field to highlight its OCR bounding box.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
              {roleGraphNodes.map((node) => (
                <div
                  key={node.key}
                  data-testid={`role-node-${node.key}`}
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                    <div>
                      <strong style={{ fontSize: "13px", color: "#063C3D", display: "block" }}>
                        {node.title}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{node.subtitle}</span>
                    </div>
                    <span
                      style={{
                        background: node.docs.length + node.sponsorUploads.length > 0 ? "#EAF6F0" : "#FFFFFF",
                        color: node.docs.length + node.sponsorUploads.length > 0 ? "#176B50" : "#445451",
                        border: "1px solid #DCE5E1",
                        borderRadius: "6px",
                        padding: "2px 6px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {node.docs.length + node.sponsorUploads.length} file{node.docs.length + node.sponsorUploads.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Unlocked Privacy-Shield Sponsor Uploads for Legal Staff */}
                  {node.sponsorUploads.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {node.sponsorUploads.map((su) => (
                        <div
                          key={su.id}
                          data-testid={`unlocked-sponsor-upload-${su.id}`}
                          style={{
                            background: "#EAF6F0",
                            border: "1px solid #B9DED4",
                            borderRadius: "6px",
                            padding: "6px 8px",
                            fontSize: "11px",
                            color: "#063C3D",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "#176B50" }}>
                            🔓 Counsel Unlocked ({su.sponsorName} • {su.jurisdiction})
                          </div>
                          <div>{su.statutoryBadge || su.subtypeLabel}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extracted Fields Linked to Center BBox Canvas */}
                  {node.fields.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {node.fields.slice(0, 4).map((fld) => {
                        const isHovered = activeFieldId === fld.id;
                        return (
                          <button
                            key={fld.id}
                            type="button"
                            data-testid={`studio-entity-row-${fld.fieldKey}`}
                            onMouseEnter={() => handleFocusField(fld)}
                            onClick={() => handleFocusField(fld)}
                            style={{
                              background: isHovered ? "#EAF6F0" : "#FFFFFF",
                              border: `1px solid ${isHovered ? "#07594F" : "#DCE5E1"}`,
                              borderRadius: "6px",
                              padding: "5px 8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "6px",
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: "11.5px",
                              color: "#172322",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <strong>{fld.label}:</strong> {fld.value}
                            </span>
                            <span style={{ fontSize: "10px", color: "#176B50", fontWeight: 700 }}>
                              p.{fld.pageNumber}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : node.sponsorUploads.length === 0 ? (
                    <div style={{ fontSize: "11px", color: "#6E7F7C" }}>
                      No documents assigned to this role yet.
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Live Statutory Rule Calculators */}
          <div
            data-testid="studio-statutory-calculators"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid #DCE5E1", paddingBottom: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 750, color: "#063C3D" }}>
                  Live Statutory Rule Calculators
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#445451" }}>
                  Deterministic eligibility checks computed directly from vault evidence and sponsor uploads.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#063C3D", fontWeight: 650 }}>
                <label htmlFor="studio-lico-family-size">LICO Household Size:</label>
                <select
                  id="studio-lico-family-size"
                  data-testid="studio-lico-family-size"
                  value={licoFamilySize}
                  onChange={(e) => setLicoFamilySize(Number(e.target.value))}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #DCE5E1",
                    background: "#F8F7F2",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#063C3D",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} {sz === 1 ? "Person" : "Persons"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontVariantNumeric: "tabular-nums" }}>
              {/* Calculator 1: IRCC Super Visa LICO */}
              <div
                data-testid="calc-super-visa-lico"
                style={{
                  background: statutoryMetrics.licoMet ? "#EAF6F0" : "#F8F7F2",
                  border: `1px solid ${statutoryMetrics.licoMet ? "#B9DED4" : "#DCE5E1"}`,
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12.5px", color: "#063C3D" }}>IRCC Super Visa LICO</strong>
                  <span style={{ fontSize: "10.5px", fontWeight: 750, color: statutoryMetrics.licoMet ? "#176B50" : "#445451" }}>
                    {statutoryMetrics.noaLine15000 === null
                      ? "Awaiting CRA NOA"
                      : statutoryMetrics.licoMet
                        ? "✓ LICO Met"
                        : "Below LICO Floor"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#172322" }}>
                  NOA Line 15000:{" "}
                  <strong>
                    {statutoryMetrics.noaLine15000 !== null
                      ? `$${statutoryMetrics.noaLine15000.toLocaleString()} CAD`
                      : "Not Uploaded"}
                  </strong>
                </div>
                <div style={{ fontSize: "11px", color: "#445451" }}>
                  {licoFamilySize}-Person Threshold: <strong>${statutoryMetrics.licoThreshold.toLocaleString()} CAD</strong>
                </div>
                <div style={{ fontSize: "11px", color: statutoryMetrics.hasSuperVisaInsurance ? "#176B50" : "#6E7F7C", fontWeight: 600 }}>
                  {statutoryMetrics.hasSuperVisaInsurance
                    ? "✓ $100k / 365d Medical Policy on File"
                    : "⏳ $100k / 365d Medical Insurance Pending"}
                </div>
              </div>

              {/* Calculator 2: Express Entry +15 CRS Sibling */}
              <div
                data-testid="calc-crs-sibling"
                style={{
                  background: statutoryMetrics.siblingProngsCount === 3 ? "#EAF6F0" : "#F8F7F2",
                  border: `1px solid ${statutoryMetrics.siblingProngsCount === 3 ? "#B9DED4" : "#DCE5E1"}`,
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12.5px", color: "#063C3D" }}>Express Entry +15 CRS Sibling</strong>
                  <span style={{ fontSize: "10.5px", fontWeight: 750, color: statutoryMetrics.siblingProngsCount === 3 ? "#176B50" : "#445451" }}>
                    {statutoryMetrics.siblingProngsCount === 3
                      ? "✓ +15 CRS Verified"
                      : `${statutoryMetrics.siblingProngsCount}/3 Prongs`}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#172322", lineHeight: 1.45 }}>
                  <div>{statutoryMetrics.hasSiblingPRorCitizen ? "✓" : "○"} PR Card / Citizenship</div>
                  <div>{statutoryMetrics.hasSiblingCanadianAddress ? "✓" : "○"} CA Address Proof</div>
                  <div>{statutoryMetrics.hasSharedParentProof ? "✓" : "○"} Shared Parent Name</div>
                </div>
              </div>

              {/* Calculator 3: UKVI 28-Day Continuous Funds */}
              <div
                data-testid="calc-ukvi-28day"
                style={{
                  background: statutoryMetrics.hasBankStatementEvidence ? "#EAF6F0" : "#F8F7F2",
                  border: `1px solid ${statutoryMetrics.hasBankStatementEvidence ? "#B9DED4" : "#DCE5E1"}`,
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12.5px", color: "#063C3D" }}>UKVI 28-Day Funds</strong>
                  <span style={{ fontSize: "10.5px", fontWeight: 750, color: statutoryMetrics.hasBankStatementEvidence ? "#176B50" : "#445451" }}>
                    {statutoryMetrics.hasBankStatementEvidence ? "✓ Statement On File" : "Awaiting Statement"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#172322" }}>
                  28-Day Balance:{" "}
                  <strong>
                    {statutoryMetrics.ukviClosingBalance !== null
                      ? `£${statutoryMetrics.ukviClosingBalance.toLocaleString()}`
                      : statutoryMetrics.hasBankStatementEvidence
                        ? "Statement Uploaded"
                        : "Pending Upload"}
                  </strong>
                </div>
                <div style={{ fontSize: "11px", color: "#445451" }}>
                  Appendix Finance FIN 7.1 continuous 28-day &amp; ≤31-day recency window.
                </div>
              </div>

              {/* Calculator 4: 6-Month Passport Validity */}
              <div
                data-testid="calc-passport-validity"
                style={{
                  background: statutoryMetrics.passportMeetsSixMonths ? "#EAF6F0" : "#F8F7F2",
                  border: `1px solid ${statutoryMetrics.passportMeetsSixMonths ? "#B9DED4" : "#DCE5E1"}`,
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12.5px", color: "#063C3D" }}>6-Month Passport Validity</strong>
                  <span style={{ fontSize: "10.5px", fontWeight: 750, color: statutoryMetrics.passportMeetsSixMonths ? "#176B50" : "#445451" }}>
                    {statutoryMetrics.passportMeetsSixMonths === null
                      ? "Awaiting Bio Page"
                      : statutoryMetrics.passportMeetsSixMonths
                        ? "✓ Valid ≥ 6 Mos"
                        : "Renewal Advised"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#172322" }}>
                  Expiry:{" "}
                  <strong>{statutoryMetrics.passportExpiryRaw || "Not Extracted Yet"}</strong>
                </div>
                <div style={{ fontSize: "11px", color: "#445451" }}>
                  {statutoryMetrics.passportDaysRemaining !== null
                    ? `${statutoryMetrics.passportDaysRemaining} days remaining (180-day horizon)`
                    : "Upload passport bio page to compute remaining horizon"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
