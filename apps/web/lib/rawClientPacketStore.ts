import { DocumentCategory } from "./types";

export const RAW_CLIENT_PACKETS_STORAGE_KEY = "documento_raw_client_packets_v1";
export const RAW_PACKETS_UPDATED_EVENT = "documento-raw-packets-updated";

export const MISSING_QUESTIONS_STORAGE_KEY = "documento_missing_client_questions_v1";
export const MISSING_QUESTIONS_UPDATED_EVENT = "documento-missing-questions-updated";

export interface SortedChildDocSummary {
  id: string;
  title: string;
  filename: string;
  category: string;
  subtypeLabel: string;
  personName: string;
  personRole: string;
  pageRange: string;
  pageNumbers: number[];
  pageCount: number;
  confidence: number;
  extractedFieldsCount: number;
}

export interface RawUploadedPacketRecord {
  id: string;
  vaultDocId: string;
  caseId: string;
  filename: string;
  title: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  sha256: string;
  uploaderRole: "applicant" | "sponsor";
  uploaderName: string;
  sponsorInviteToken?: string;
  privacyShield: boolean;
  declaredCategory?: string;
  officerNote?: string;
  rawTextPreview: string;
  pageCountEstimate: number;
  uploadedAt: string;
  aiLabStatus: "pending" | "completed";
  processedAt?: string;
  sortedChildren: SortedChildDocSummary[];
  autoFilledFieldsCount?: number;
}

export interface MissingGapItem {
  sectionKey: string;
  sectionNumber: number;
  label: string;
  reason: string;
  isNonDocumentDisclosure: boolean;
}

export interface MissingQuestionsRequestRecord {
  caseId: string;
  requestedAt: string;
  requestedBy: string;
  aiFilledFieldsCount: number;
  verifiedSectionsCount: number;
  missingGaps: MissingGapItem[];
  autoTriggeredByAiLab: boolean;
  explicitlyPromptedByParalegal: boolean;
}

// In-memory File object cache so Paralegal AI Lab in the same browser session
// reads exact raw binary bytes without localStorage bloat.
const rawPacketFileCache = new Map<string, File>();

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function inferRawFileCategoryAndLabel(filename: string): {
  category: DocumentCategory;
  subtypeLabel: string;
  estimatedPages: number;
} {
  const lower = (filename || "").toLowerCase();
  if (lower.includes("noa") || lower.includes("assessment") || lower.includes("15000") || lower.includes("hmrc") || lower.includes("p60") || lower.includes("sa302") || lower.includes("bank") || lower.includes("statement")) {
    return {
      category: "financial_evidence",
      subtypeLabel: lower.includes("noa") || lower.includes("cra")
        ? "Raw Sponsor Financial File (CRA NOA)"
        : "Raw Financial Evidence File",
      estimatedPages: 2,
    };
  }
  if (lower.includes("passport")) {
    return {
      category: "identity_passport",
      subtypeLabel: "Raw Passport Upload",
      estimatedPages: 2,
    };
  }
  if (lower.includes("pr_card") || lower.includes("pr-card") || lower.includes("pr card") || lower.includes("visa") || lower.includes("vevo") || lower.includes("evisa")) {
    return {
      category: "visas_residence_permits",
      subtypeLabel: "Raw Status / Visa Upload",
      estimatedPages: 1,
    };
  }
  if (lower.includes("marriage") || lower.includes("birth")) {
    return {
      category: "civil_status",
      subtypeLabel: "Raw Civil Status Upload",
      estimatedPages: 1,
    };
  }
  if (lower.includes("insurance") || lower.includes("medical_policy") || lower.includes("100k")) {
    return {
      category: "insurance_accommodation",
      subtypeLabel: "Raw Medical Insurance Policy Upload",
      estimatedPages: 2,
    };
  }
  if (lower.includes("degree") || lower.includes("diploma") || lower.includes("transcript") || lower.includes("wes")) {
    return {
      category: "educational_records",
      subtypeLabel: "Raw Educational Credential Upload",
      estimatedPages: 2,
    };
  }
  if (lower.includes("t4") || lower.includes("employment") || lower.includes("resume") || lower.includes("cv") || lower.includes("experience")) {
    return {
      category: "employment_records",
      subtypeLabel: "Raw Employment Record Upload",
      estimatedPages: 2,
    };
  }
  const isPacket =
    lower.includes("packet") ||
    lower.includes("merged") ||
    lower.includes("bundle") ||
    lower.includes("combined") ||
    lower.includes("all");
  return {
    category: "supporting_evidence",
    subtypeLabel: isPacket ? "Raw Multi-Document Client Packet" : "Raw Client Document Upload",
    estimatedPages: isPacket ? 6 : 1,
  };
}

function readAllRawPackets(): RawUploadedPacketRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RAW_CLIENT_PACKETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAllRawPackets(records: RawUploadedPacketRecord[], detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RAW_CLIENT_PACKETS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota exceptions cleanly
  }
  window.dispatchEvent(new CustomEvent(RAW_PACKETS_UPDATED_EVENT, { detail: detail || {} }));
}

export async function extractSafeRawTextPreview(file: File): Promise<string> {
  try {
    const slice = file.slice(0, 32768);
    if (typeof slice.text === "function") {
      const txt = await slice.text();
      return txt || "";
    }
    if (typeof file.text === "function") {
      const txt = await file.text();
      return (txt || "").slice(0, 32768);
    }
  } catch {
    // Ignore binary decode issues
  }
  return "";
}

export function enqueueRawClientPacket(params: {
  file: File;
  vaultDocId: string;
  caseId?: string;
  title?: string;
  sha256: string;
  uploaderRole: "applicant" | "sponsor";
  uploaderName?: string;
  sponsorInviteToken?: string;
  privacyShield?: boolean;
  declaredCategory?: string;
  officerNote?: string;
  rawTextPreview?: string;
}): RawUploadedPacketRecord {
  const inferred = inferRawFileCategoryAndLabel(params.file.name);
  const sizeBasedPages = Math.max(
    inferred.estimatedPages,
    Math.min(60, Math.max(1, Math.ceil((params.file.size || 2048) / 8192)))
  );
  const id = `raw-pkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record: RawUploadedPacketRecord = {
    id,
    vaultDocId: params.vaultDocId,
    caseId: params.caseId || "default_client",
    filename: params.file.name || "Client_Upload.pdf",
    title: params.title || params.file.name || inferred.subtypeLabel,
    mimeType: params.file.type || "application/pdf",
    fileSizeBytes: params.file.size || 0,
    fileSizeLabel: formatSize(params.file.size || 0),
    sha256: params.sha256,
    uploaderRole: params.uploaderRole,
    uploaderName:
      params.uploaderName ||
      (params.uploaderRole === "sponsor" ? "Family Sponsor" : "Retained Client"),
    sponsorInviteToken: params.sponsorInviteToken,
    privacyShield: Boolean(params.privacyShield),
    declaredCategory: params.declaredCategory || inferred.category,
    officerNote: params.officerNote,
    rawTextPreview: params.rawTextPreview || "",
    pageCountEstimate: sizeBasedPages,
    uploadedAt: new Date().toISOString(),
    aiLabStatus: "pending",
    sortedChildren: [],
  };

  rawPacketFileCache.set(record.id, params.file);
  rawPacketFileCache.set(record.vaultDocId, params.file);
  void persistRawFileToIndexedDB(record.id, params.file);
  void persistRawFileToIndexedDB(record.vaultDocId, params.file);

  const existing = readAllRawPackets().filter(
    (r) => !(r.caseId === record.caseId && r.sha256 === record.sha256 && r.filename === record.filename && r.aiLabStatus === "pending")
  );
  writeAllRawPackets([record, ...existing], {
    action: "raw_packet_enqueued",
    caseId: record.caseId,
    packetId: record.id,
  });

  // If rawTextPreview wasn't pre-extracted synchronously, hydrate it asynchronously without blocking
  if (!record.rawTextPreview) {
    void extractSafeRawTextPreview(params.file).then((snippet) => {
      if (!snippet) return;
      const latest = readAllRawPackets();
      const idx = latest.findIndex((item) => item.id === record.id);
      if (idx !== -1 && !latest[idx].rawTextPreview) {
        latest[idx] = { ...latest[idx], rawTextPreview: snippet };
        writeAllRawPackets(latest, { action: "raw_text_cached", packetId: record.id });
      }
    });
  }

  return record;
}

const RAW_PACKET_IDB_NAME = "documento_raw_packets_idb_v1";
const RAW_PACKET_IDB_STORE = "packet_files";

function openRawPacketIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (!settled) {
        settled = true;
        resolve(db);
      }
    };
    const timer = setTimeout(() => finish(null), 500);
    try {
      const req = indexedDB.open(RAW_PACKET_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          if (!req.result.objectStoreNames.contains(RAW_PACKET_IDB_STORE)) {
            req.result.createObjectStore(RAW_PACKET_IDB_STORE);
          }
        } catch {
          // ignore schema creation issues
        }
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        finish(req.result);
      };
      req.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        finish(null);
      };
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

async function persistRawFileToIndexedDB(key: string, file: File): Promise<void> {
  try {
    const db = await openRawPacketIndexedDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(RAW_PACKET_IDB_STORE, "readwrite");
        tx.objectStore(RAW_PACKET_IDB_STORE).put(file, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  } catch {
    // non-fatal
  }
}

async function readRawFileFromIndexedDB(key: string): Promise<File | null> {
  try {
    const db = await openRawPacketIndexedDB();
    if (!db) return null;
    return await new Promise<File | null>((resolve) => {
      try {
        const tx = db.transaction(RAW_PACKET_IDB_STORE, "readonly");
        const getReq = tx.objectStore(RAW_PACKET_IDB_STORE).get(key);
        getReq.onsuccess = () => {
          const val = getReq.result;
          db.close();
          if (val instanceof File) {
            resolve(val);
          } else if (val instanceof Blob) {
            resolve(new File([val], key, { type: val.type || "application/pdf" }));
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export function getOrReconstructRawPacketFile(packet: RawUploadedPacketRecord): File {
  const cached =
    rawPacketFileCache.get(packet.id) || rawPacketFileCache.get(packet.vaultDocId);
  if (cached) return cached;

  const content = packet.rawTextPreview || `%PDF-1.4\n% ${packet.filename}\n%%EOF`;
  return new File([content], packet.filename, {
    type: packet.mimeType || "application/pdf",
  });
}

export async function loadRawPacketFileAsync(packet: RawUploadedPacketRecord): Promise<File> {
  const cached =
    rawPacketFileCache.get(packet.id) || rawPacketFileCache.get(packet.vaultDocId);
  if (cached) return cached;

  const idbById = await readRawFileFromIndexedDB(packet.id);
  if (idbById) {
    const named =
      idbById.name === packet.filename
        ? idbById
        : new File([idbById], packet.filename, { type: packet.mimeType || idbById.type || "application/pdf" });
    rawPacketFileCache.set(packet.id, named);
    rawPacketFileCache.set(packet.vaultDocId, named);
    return named;
  }

  const idbByVault = await readRawFileFromIndexedDB(packet.vaultDocId);
  if (idbByVault) {
    const named =
      idbByVault.name === packet.filename
        ? idbByVault
        : new File([idbByVault], packet.filename, { type: packet.mimeType || idbByVault.type || "application/pdf" });
    rawPacketFileCache.set(packet.id, named);
    rawPacketFileCache.set(packet.vaultDocId, named);
    return named;
  }

  return getOrReconstructRawPacketFile(packet);
}

export function getRawPacketsForCase(
  caseId?: string | null,
  caseNumber?: string | null
): RawUploadedPacketRecord[] {
  const all = readAllRawPackets();
  if (!caseId && !caseNumber) return all;
  return all.filter(
    (pkt) =>
      pkt.caseId === caseId ||
      (caseNumber && pkt.caseId === caseNumber) ||
      pkt.caseId === "default_client" ||
      pkt.caseId === "client-portal-intake"
  );
}

export function getPendingRawPacketsForCase(
  caseId?: string | null,
  caseNumber?: string | null
): RawUploadedPacketRecord[] {
  return getRawPacketsForCase(caseId, caseNumber).filter(
    (pkt) => pkt.aiLabStatus === "pending"
  );
}

export function markRawPacketProcessedByAiLab(
  packetIdOrVaultDocId: string,
  result: {
    sortedChildren: SortedChildDocSummary[];
    autoFilledFieldsCount: number;
  }
): RawUploadedPacketRecord | null {
  const all = readAllRawPackets();
  const idx = all.findIndex(
    (p) => p.id === packetIdOrVaultDocId || p.vaultDocId === packetIdOrVaultDocId
  );
  if (idx === -1) return null;

  const updated: RawUploadedPacketRecord = {
    ...all[idx],
    aiLabStatus: "completed",
    processedAt: new Date().toISOString(),
    sortedChildren: result.sortedChildren,
    autoFilledFieldsCount: result.autoFilledFieldsCount,
  };
  all[idx] = updated;
  writeAllRawPackets(all, {
    action: "raw_packet_processed",
    caseId: updated.caseId,
    packetId: updated.id,
  });
  return updated;
}

export function computeMissingClientGaps(
  formData: Record<string, any> | null | undefined,
  provenance: Record<string, any> | null | undefined,
  isSubmitted: boolean = false,
  jurisdiction?: string | null
): {
  verifiedDocumentFieldsCount: number;
  verifiedSectionKeys: string[];
  missingGaps: MissingGapItem[];
} {
  const f = formData || {};
  const prov = provenance || {};
  const jur = (jurisdiction || f.jurisdiction || "").toLowerCase();
  const isCanada = jur.includes("canada") || jur.includes("ircc");

  const verifiedDocumentFieldsCount = Object.values(prov).filter(
    (p: any) => p && (p.is_confirmed || p.locked_by_ai_lab || p.source_type === "document_ocr")
  ).length;

  const verifiedSectionKeys: string[] = [];
  if (f.family_name?.trim() || f.given_names?.trim() || f.dob?.trim()) {
    verifiedSectionKeys.push("applicant_biodata");
  }
  if (f.passport_number?.trim()) {
    verifiedSectionKeys.push("additional");
  }
  if (Array.isArray(f.education) && f.education.length > 0) {
    verifiedSectionKeys.push("education");
  }
  if (Array.isArray(f.employment) && f.employment.length > 0) {
    verifiedSectionKeys.push("employment");
  }
  const fam = f.family || {};
  if (["mother", "father", "spouse", "sister"].some((m) => Boolean(fam[m]?.name?.trim()))) {
    verifiedSectionKeys.push("family");
  }
  if ((Array.isArray(f.addresses) && f.addresses.length > 0) || f.residential_address?.trim()) {
    verifiedSectionKeys.push("addresses");
  }
  if (Array.isArray(f.relatives) && f.relatives.length > 0) {
    verifiedSectionKeys.push("relatives");
  }
  if (f.sponsor?.name?.trim() || f.sponsor?.uci?.trim()) {
    verifiedSectionKeys.push("sponsor");
  }

  const missingGaps: MissingGapItem[] = [];

  // 1. Entry & Visa Refusal Disclosures (Statutory non-document question)
  const hasRefusalAnswered = Boolean(
    isSubmitted ||
      f.refusal_disclosure_confirmed ||
      f.refusals_notes?.trim() ||
      f.purpose_of_visit?.trim() ||
      f.date_of_entry?.trim()
  );
  if (!hasRefusalAnswered) {
    missingGaps.push({
      sectionKey: "entry_refusals",
      sectionNumber: 2,
      label: isCanada
        ? "Prior Visa Refusal & Canadian Entry Disclosures"
        : "Prior Worldwide Visa Refusal & Entry Disclosures",
      reason: "Statutory admissibility disclosure cannot be inferred from identity documents alone.",
      isNonDocumentDisclosure: true,
    });
  }

  // 2. 10-Year International Travel History
  const hasTravelAnswered = Boolean(
    isSubmitted ||
      f.no_international_travel_confirmed ||
      (Array.isArray(f.travel) && f.travel.length > 0)
  );
  if (!hasTravelAnswered) {
    missingGaps.push({
      sectionKey: "travel",
      sectionNumber: 6,
      label: "10-Year Personal Travel History (or Confirm 'No Trips')",
      reason: "Personal holiday and border-crossing dates not stamped on bio page.",
      isNonDocumentDisclosure: true,
    });
  }

  // 3. Final Statutory Declaration & E-Signature
  const hasSignedDeclaration = Boolean(f.declaration_signed && f.signature?.trim());
  if (!hasSignedDeclaration) {
    missingGaps.push({
      sectionKey: "declaration",
      sectionNumber: 11,
      label: "Final Statutory Declaration & Client E-Signature",
      reason: "Client must personally sign off after reviewing AI-filled details.",
      isNonDocumentDisclosure: true,
    });
  }

  return {
    verifiedDocumentFieldsCount,
    verifiedSectionKeys,
    missingGaps,
  };
}

function readAllMissingRequests(): Record<string, MissingQuestionsRequestRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MISSING_QUESTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function publishMissingQuestionsRequest(
  caseId: string,
  payload: Omit<MissingQuestionsRequestRecord, "caseId" | "requestedAt">
): MissingQuestionsRequestRecord {
  const key = caseId || "default_client";
  const record: MissingQuestionsRequestRecord = {
    ...payload,
    caseId: key,
    requestedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const all = readAllMissingRequests();
      all[key] = record;
      window.localStorage.setItem(MISSING_QUESTIONS_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore storage quota errors
    }
    window.dispatchEvent(
      new CustomEvent(MISSING_QUESTIONS_UPDATED_EVENT, { detail: record })
    );
  }
  return record;
}

export function getMissingQuestionsRequest(
  caseId?: string | null
): MissingQuestionsRequestRecord | null {
  if (!caseId && typeof window === "undefined") return null;
  const all = readAllMissingRequests();
  if (caseId && all[caseId]) return all[caseId];
  return all["default_client"] || null;
}

export function removeRawPacketsForCase(caseId: string): void {
  if (!caseId || typeof window === "undefined") return;
  const existing = readAllRawPackets();
  const removed = existing.filter((r) => r.caseId === caseId);
  if (removed.length > 0) {
    for (const r of removed) {
      rawPacketFileCache.delete(r.id);
      rawPacketFileCache.delete(r.vaultDocId);
    }
    writeAllRawPackets(
      existing.filter((r) => r.caseId !== caseId),
      { action: "case_deleted", caseId }
    );
  }
  try {
    const missingAll = readAllMissingRequests();
    if (missingAll[caseId]) {
      delete missingAll[caseId];
      window.localStorage.setItem(MISSING_QUESTIONS_STORAGE_KEY, JSON.stringify(missingAll));
      window.dispatchEvent(new CustomEvent(MISSING_QUESTIONS_UPDATED_EVENT, { detail: { caseId } }));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function clearRawPacketStoreInMemoryCache(): void {
  rawPacketFileCache.clear();
  void openRawPacketIndexedDB().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(RAW_PACKET_IDB_STORE, "readwrite");
      tx.objectStore(RAW_PACKET_IDB_STORE).clear();
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
    }
  });
}
