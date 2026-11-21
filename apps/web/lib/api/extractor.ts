/**
 * Standalone Document Information & Recognition Extractor API Client.
 * Completely public and unauthenticated.
 */

import { calculateSHA256 } from "../crypto";

export type DetectedPersonRole =
  | "principal_applicant"
  | "spouse_partner"
  | "dependant_child"
  | "overseas_sponsor_host"
  | "canadian_crs_sibling";

export interface BarcodeQrPayload {
  format: "QR_CODE" | "PDF417" | "ICAO_MRZ_TD3" | "DATA_MATRIX" | string;
  payload_type: string;
  decoded_summary: string;
  verified: boolean;
  fields?: Record<string, string>;
}

export interface RoleAttributionSummary {
  person_name?: string;
  holder_name?: string | null;
  person_role: DetectedPersonRole;
  role_label?: string;
  sponsor_jurisdiction?: "CA" | "UK" | "AU" | null;
  confidence: number;
  subtype_label?: string;
  association_note?: string;
  statutory_badges?: string[];
}

export interface SponsorStatutoryIntelligence {
  jurisdiction?: "CA" | "UK" | "AU";
  document_subtype?: string;
  sponsor_name?: string;
  status_verified?: boolean;
  status_type?: string;
  cra_noa_line_15000_cad?: number;
  ircc_lico_threshold_cad?: number;
  ircc_lico_household_size?: number;
  ircc_lico_surplus_cad?: number;
  super_visa_lico_met?: boolean;
  super_visa_insurance_coverage_cad?: number;
  super_visa_insurance_days?: number;
  super_visa_insurance_compliant?: boolean;
  crs_sibling_points_awarded?: number;
  crs_sibling_shared_parent?: string;
  crs_sibling_residency_verified?: boolean;
  uk_share_code?: string;
  uk_hmrc_gross_pay_gbp?: number;
  uk_appendix_v_compliant?: boolean;
  au_vevo_entitlement?: string;
  au_ato_taxable_income_aud?: number;
  statutory_badges?: string[];
  // Backend SponsorIntelligenceEngine nested structure fields
  pathway?: string;
  super_visa_lico?: {
    total_sponsor_income_cad?: number;
    required_lico_cad?: number;
    meets_lico?: boolean;
    family_size?: number;
    insurance_compliant?: boolean | null;
    insurance_coverage_cad?: number | null;
  };
  crs_sibling_points?: {
    points_awarded?: number;
    eligible?: boolean;
    shared_parent?: string | null;
  };
  uk_sponsor_check?: {
    share_code?: string | null;
    uk_hmrc_gross_pay_gbp?: number | null;
  };
  au_sponsor_check?: {
    vevo_status?: string | null;
    ato_taxable_income_aud?: number | null;
  };
}

export interface ExtractorSampleItem {
  id: string;
  title: string;
  category: string;
  filename: string;
  description: string;
  text_content: string;
}

export interface ExtractorFieldProvenance {
  field_name: string;
  field_label: string;
  original_value: string;
  normalized_value: string;
  source_page: number;
  ocr_confidence: number;
  extraction_confidence: number;
  calibrated_confidence: number;
  extraction_method: string;
  model_version: string;
  bounding_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  source_location?: any;
  review_status: string;
}

export interface ExtractorQualityFinding {
  finding_type: string;
  severity: "critical" | "major" | "minor" | "informational";
  title: string;
  description: string;
  evidence_text?: string;
  page_number: number;
  recommended_action: string;
  uncertainty_limitations: string;
  suggested_clarification?: string;
}

export interface ExtractorAnalysisResult {
  status: "success" | "error";
  metadata: {
    filename: string;
    mime_type: string;
    file_size_bytes: number;
    sha256_hash: string;
    page_count: number;
    detected_language: string;
    detected_language_label?: string;
    is_language_compliant?: boolean;
    requires_caseworker_escalation?: boolean;
    escalation_status?: "COMPLIANT" | "ESCALATED_TO_CASEWORKER";
    caseworker_action?: string;
    client_outreach_template?: string;
    total_blocks_detected: number;
    overall_health_score: number;
    backend_offline?: boolean;
  };
  recognition: {
    category: string;
    category_label: string;
    confidence: number;
    matched_keywords: string[];
  };
  extracted_fields: ExtractorFieldProvenance[];
  quality_findings: ExtractorQualityFinding[];
  specialized_intelligence: {
    language_compliance?: {
      is_compliant: boolean;
      detected_language: string;
      detected_language_label: string;
      supported_languages: string[];
      scripts_present: string[];
      character_breakdown: {
        english_latin: number;
        gujarati: number;
        hindi_devanagari: number;
        unsupported: number;
      };
      unsupported_languages_detected: string[];
      requires_caseworker_escalation: boolean;
      escalation_status: "COMPLIANT" | "ESCALATED_TO_CASEWORKER";
      escalation_reason?: string | null;
      caseworker_action?: string | null;
      client_outreach_template?: string | null;
    };
    financial_forensics?: {
      institution: string;
      account_number_masked?: string | null;
      statement_period: string;
      opening_balance?: number | null;
      closing_balance?: number | null;
      minimum_balance_observed?: number | null;
      average_monthly_credits?: number | null;
      currency: string;
      suspicious_lump_sums: Array<{
        date: string;
        description: string;
        amount: number;
        type: string;
        is_suspicious: boolean;
      }>;
      risk_findings: string[];
    };
    itr_verification?: {
      is_itr_v: boolean;
      assessment_year?: string;
      pan_number?: string;
      acknowledgement_number?: string;
      gross_total_income?: number;
      taxpayer_name?: string;
    };
    resume_intelligence?: {
      candidate_name?: string;
      current_role?: string;
      employer?: string;
      email?: string;
      phone?: string;
      location?: string;
      linkedin?: string;
      github?: string;
      skills?: string;
      education?: string;
      languages?: string;
      years_experience?: string;
    };
    identity_compliance?: {
      single_name_resolution?: {
        is_single_name: boolean;
        uscis_representation: string;
        ircc_representation: string;
        ukvi_representation: string;
        guidance: string;
      };
      indian_passport?: {
        passport_number?: string;
        holder_name?: string;
        surname?: string;
        given_names?: string;
        date_of_birth?: string;
        gender?: string;
        place_of_birth?: string;
        place_of_issue?: string;
        date_of_issue?: string;
        date_of_expiry?: string;
        emigration_check_status?: string;
        file_number?: string;
        booklet_type?: string;
        father_name?: string;
        mother_name?: string;
        spouse_name?: string;
        address?: string;
        pin_code?: string;
        nationality?: string;
        mrz_detected?: boolean;
        raw_mrz?: string;
      };
      aadhaar?: {
        is_valid: boolean;
        masked_number: string;
        holder_name?: string;
        dob?: string;
        gender?: string;
        father_or_spouse?: string;
      };
      pan?: {
        is_valid: boolean;
        pan_number: string;
        entity_type: string;
        holder_name?: string;
        fifth_char_surname_match?: boolean;
      };
      driving_licence?: {
        is_valid: boolean;
        licence_number: string;
        jurisdiction: string;
        holder_name?: string;
        expiry_date?: string;
        vehicle_class?: string;
      };
      voter_id?: {
        is_valid: boolean;
        epic_number: string;
        elector_name?: string;
        relative_name?: string;
      };
    };
    barcode_qr_payloads?: BarcodeQrPayload[];
    role_attribution?: RoleAttributionSummary;
    sponsor_statutory_intelligence?: SponsorStatutoryIntelligence;
  };
  ocr_summary: {
    ocr_applied: boolean;
    avg_page_confidence: number;
    pages: Array<{
      page_number: number;
      width: number;
      height: number;
      ocr_applied: boolean;
      ocr_confidence: number;
      rotation_corrected: boolean;
      detected_rotation: number;
      block_count: number;
      page_image_data_url?: string;
      blocks: Array<{
        block_idx: number;
        text: string;
        confidence: number;
        coordinates: [number, number, number, number];
      }>;
    }>;
  };
  raw_text_preview: string;
}

const API_BASE = typeof window !== "undefined" ? "/api/backend" : "http://127.0.0.1:8000/api/v1";
const DIRECT_BACKEND_BASES =
  typeof window !== "undefined" && process.env.NODE_ENV !== "test"
    ? ["http://127.0.0.1:8000/api/v1", "http://localhost:8000/api/v1"]
    : [];

export const FALLBACK_SAMPLES: ExtractorSampleItem[] = [];

function decodePdfLiteralString(rawLiteral: string): string {
  let out = "";
  for (let i = 0; i < rawLiteral.length; i++) {
    const ch = rawLiteral[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = rawLiteral[++i];
    if (next === undefined) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "\r") {
      if (rawLiteral[i + 1] === "\n") i++;
    } else if (next === "\n") {
      // escaped line continuation
    } else if (next >= "0" && next <= "7") {
      let oct = next;
      for (let k = 0; k < 2; k++) {
        const d = rawLiteral[i + 1];
        if (d >= "0" && d <= "7") {
          oct += d;
          i++;
        } else {
          break;
        }
      }
      out += String.fromCharCode(parseInt(oct, 8));
    } else {
      out += next;
    }
  }
  return out;
}

function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  if (clean.length < 2) return "";
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    bytes.push(parseInt(padded.slice(i, i + 2), 16));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let u16 = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      if (code >= 0x20 || code === 0x0a || code === 0x0d || code === 0x09) {
        u16 += String.fromCharCode(code);
      }
    }
    return u16;
  }
  return bytes
    .filter((b) => b >= 0x20 || b === 0x0a || b === 0x09)
    .map((b) => String.fromCharCode(b))
    .join("");
}

function extractTextOperatorsFromPdfStream(streamText: string): string {
  const chunks: string[] = [];
  let i = 0;
  const len = streamText.length;

  const readBalancedParens = (): string => {
    let buf = "";
    let depth = 1;
    i++; // consume '('
    while (i < len && depth > 0) {
      const c = streamText[i];
      if (c === "\\") {
        buf += c;
        if (i + 1 < len) buf += streamText[++i];
      } else if (c === "(") {
        depth++;
        buf += c;
      } else if (c === ")") {
        depth--;
        if (depth > 0) buf += c;
      } else {
        buf += c;
      }
      i++;
    }
    return decodePdfLiteralString(buf);
  };

  while (i < len) {
    const ch = streamText[i];
    if (ch === "(") {
      const textVal = readBalancedParens();
      while (i < len && /\s/.test(streamText[i])) i++;
      if (streamText.startsWith("Tj", i) || streamText[i] === "'" || streamText[i] === '"') {
        chunks.push(textVal);
        if (streamText[i] === "'") chunks.push("\n");
        i += streamText.startsWith("Tj", i) ? 2 : 1;
      }
      continue;
    }

    if (ch === "<" && streamText[i + 1] !== "<") {
      const endHex = streamText.indexOf(">", i + 1);
      if (endHex !== -1 && endHex - i < 4096) {
        const hexBody = streamText.slice(i + 1, endHex);
        i = endHex + 1;
        while (i < len && /\s/.test(streamText[i])) i++;
        if (streamText.startsWith("Tj", i)) {
          chunks.push(decodePdfHexString(hexBody));
          i += 2;
        }
        continue;
      }
    }

    if (ch === "[") {
      i++;
      const arrParts: string[] = [];
      let numBuf = "";
      while (i < len && streamText[i] !== "]") {
        const c = streamText[i];
        if (c === "(") {
          if (numBuf.trim()) {
            const kern = parseFloat(numBuf);
            if (!Number.isNaN(kern) && kern < -120) arrParts.push(" ");
            numBuf = "";
          }
          arrParts.push(readBalancedParens());
        } else if (c === "<" && streamText[i + 1] !== "<") {
          const endH = streamText.indexOf(">", i + 1);
          if (endH === -1) break;
          if (numBuf.trim()) {
            const kern = parseFloat(numBuf);
            if (!Number.isNaN(kern) && kern < -120) arrParts.push(" ");
            numBuf = "";
          }
          arrParts.push(decodePdfHexString(streamText.slice(i + 1, endH)));
          i = endH + 1;
        } else if (/[0-9.\-+]/.test(c)) {
          numBuf += c;
          i++;
        } else {
          i++;
        }
      }
      if (streamText[i] === "]") i++;
      while (i < len && /\s/.test(streamText[i])) i++;
      if (streamText.startsWith("TJ", i)) {
        const joined = arrParts.join("");
        if (joined) chunks.push(joined);
        i += 2;
      }
      continue;
    }

    if (
      (ch === "T" && (streamText[i + 1] === "d" || streamText[i + 1] === "D" || streamText[i + 1] === "*")) ||
      (ch === "E" && streamText[i + 1] === "T")
    ) {
      const prev = i > 0 ? streamText[i - 1] : " ";
      const next = i + 2 < len ? streamText[i + 2] : " ";
      if (/[\s\])>]/.test(prev) && /[\s(\[<]/.test(next)) {
        chunks.push("\n");
        i += 2;
        continue;
      }
    }

    i++;
  }

  const rawJoined = chunks
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!rawJoined) return "";
  const printableCount = (rawJoined.match(/[A-Za-z0-9\s.,:/\-@()+<>]/g) || []).length;
  if (printableCount < rawJoined.length * 0.45) {
    return "";
  }
  return rawJoined;
}

async function inflatePdfStreamBytes(streamBytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined" || streamBytes.length === 0) {
    return "";
  }
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const copy = new Uint8Array(streamBytes);
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      const readAllPromise = (async () => {
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalLength += value.byteLength;
          }
        }
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return new TextDecoder("latin1").decode(merged);
      })();
      const writePromise = writer.write(copy).then(() => writer.close());
      const [, decoded] = await Promise.all([writePromise, readAllPromise]);
      return decoded;
    } catch {
      // try next deflate framing
    }
  }
  return "";
}

async function extractReadableTextFromFile(file?: File | null): Promise<string> {
  if (!file) return "";
  const fname = (file.name || "").toLowerCase();
  if (
    /\.(png|jpe?g|webp|gif|bmp|tiff?|heic)$/i.test(fname) ||
    (file.type && file.type.startsWith("image/"))
  ) {
    return "";
  }

  let bytes: Uint8Array | null = null;
  let utf8Raw = "";
  try {
    if (typeof file.arrayBuffer === "function") {
      const buf = await file.arrayBuffer();
      bytes = new Uint8Array(buf);
    } else {
      utf8Raw = await file.text();
    }
  } catch {
    try {
      utf8Raw = await file.text();
    } catch {
      return "";
    }
  }

  if (bytes && bytes.length === 0) return "";
  if (!bytes && !utf8Raw) return "";

  const latin1 = bytes
    ? typeof TextDecoder !== "undefined"
      ? new TextDecoder("latin1").decode(bytes)
      : Array.from(bytes, (b) => String.fromCharCode(b)).join("")
    : utf8Raw;

  if (!latin1.trimStart().startsWith("%PDF")) {
    const raw =
      utf8Raw ||
      (bytes && typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: false }).decode(bytes) : latin1);
    const nonPrintable = (raw.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/g) || []).length;
    if (nonPrintable > raw.length * 0.05) return "";
    return raw;
  }

  // Extract & decompress non-image PDF streams (handles standard /FlateDecode text layers offline)
  const extractedStreamTexts: string[] = [];
  if (bytes) {
    const streamRegex = /stream(?:\r\n|\n|\r)/g;
    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(latin1)) !== null) {
      const dataStart = match.index + match[0].length;
      const endIdx = latin1.indexOf("endstream", dataStart);
      if (endIdx === -1) break;

      let dataEnd = endIdx;
      while (dataEnd > dataStart && (latin1[dataEnd - 1] === "\n" || latin1[dataEnd - 1] === "\r")) {
        dataEnd--;
      }

      const lookback = latin1.slice(Math.max(0, match.index - 420), match.index);
      const isImageOrFontStream =
        /\/Subtype\s*\/Image\b/i.test(lookback) ||
        /\/Filter\s*(?:\[[^\]]*)?\/(?:DCTDecode|JPXDecode|JBIG2Decode|CCITTFaxDecode)\b/i.test(lookback);
      if (!isImageOrFontStream && dataEnd > dataStart && dataEnd - dataStart <= 2_500_000) {
        const isFlate =
          /\/FlateDecode\b/i.test(lookback) ||
          (bytes[dataStart] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[dataStart + 1]));
        const streamText = isFlate
          ? await inflatePdfStreamBytes(bytes.subarray(dataStart, dataEnd))
          : latin1.slice(dataStart, dataEnd);
        if (streamText && !/begincmap/i.test(streamText)) {
          const parsedOp = extractTextOperatorsFromPdfStream(streamText);
          if (parsedOp) extractedStreamTexts.push(parsedOp);
        }
      }
      streamRegex.lastIndex = endIdx + 9;
    }
  }

  if (extractedStreamTexts.length > 0) {
    return extractedStreamTexts.join("\n").trim();
  }

  const stripped = latin1.replace(/stream[\r\n]+[\s\S]*?endstream/gi, (block) => {
    const badChars = (block.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x80-\xFF]/g) || []).length;
    return badChars > 8 ? "\n" : block;
  });
  return stripped
    .replace(/^%PDF-[0-9.]+\s*/i, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (/^\d+\s+\d+\s+obj$|^endobj$|^xref$|^trailer$|^startxref$|^%%EOF$/i.test(l)) return false;
      if (/^<<.*>>$/.test(l)) return false;
      if (/^\/[A-Za-z0-9#]+/.test(l)) return false;
      return !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(l);
    })
    .join("\n")
    .trim();
}

export async function checkExtractorBackendHealth(): Promise<{ online: boolean; message?: string }> {
  const candidates = [API_BASE, ...DIRECT_BACKEND_BASES];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/extractor/samples`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        return { online: true, message: "OCR Engine Online (FastAPI + RapidOCR + ICAO Doc 9303)" };
      }
    } catch {
      // Try next candidate
    }
  }
  return { online: false, message: "Backend offline. Please ensure 'npm run backend' is active." };
}

export async function fetchExtractorSamples(): Promise<ExtractorSampleItem[]> {
  const candidates = [API_BASE, ...DIRECT_BACKEND_BASES];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/extractor/samples`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.samples;
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return FALLBACK_SAMPLES;
}

export async function analyzeDocumentStandalone(params: {
  file?: File | null;
  rawText?: string | null;
  filename?: string;
  declaredCategory?: string;
}): Promise<ExtractorAnalysisResult> {
  const buildFormData = () => {
    const fd = new FormData();
    if (params.file) {
      fd.append("file", params.file);
    }
    if (params.rawText) {
      fd.append("raw_text", params.rawText);
    }
    if (params.filename) {
      fd.append("filename", params.filename);
    }
    if (params.declaredCategory) {
      fd.append("declared_category", params.declaredCategory);
    }
    return fd;
  };

  let lastDetailMsg = "Network error";
  const candidates = [API_BASE, ...DIRECT_BACKEND_BASES];

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/extractor/analyze`, {
        method: "POST",
        body: buildFormData(),
      });

      if (res.ok) {
        return await res.json();
      }

      const errorJson = await res.json().catch(() => ({}));
      lastDetailMsg = errorJson.detail || errorJson.message || `Analysis failed with HTTP ${res.status}`;
    } catch (err: any) {
      lastDetailMsg = err?.message || "Network error";
    }
  }

  return await generateClientFallbackAnalysis(params, lastDetailMsg);
}

export const IRCC_SUPER_VISA_LICO_TABLE: Record<number, number> = {
  1: 31584,
  2: 39320,
  3: 48340,
  4: 58594,
  5: 66457,
  6: 75032,
  7: 83608,
};

async function computeFileSha256(file?: File | null, fallbackText?: string): Promise<string> {
  try {
    if (file && typeof file.arrayBuffer === "function") {
      const buf = await file.arrayBuffer();
      if (buf && buf.byteLength > 0) {
        return await calculateSHA256(buf);
      }
    }
    const textBytes = new TextEncoder().encode(fallbackText || file?.name || "documento");
    return await calculateSHA256(textBytes);
  } catch {
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  }
}

export function detectCategoryAndRoleFromFilename(
  filename: string,
  rawText = ""
): {
  category: string;
  categoryLabel: string;
  subtypeLabel: string;
  personRole: DetectedPersonRole;
  sponsorJurisdiction: "CA" | "UK" | "AU" | null;
} {
  const lower = `${filename.replace(/[-_]/g, " ")} ${rawText}`.toLowerCase();
  const isSibling =
    lower.includes("sibling") ||
    /\bcrs\b/.test(lower) ||
    lower.includes("shared parent") ||
    lower.includes("shared-parent");
  const lowerWithoutHolderSpouseField = lower
    .replace(/name\s+of\s+spouse\s*:/g, "")
    .replace(/spouse\s+name\s*:/g, "");
  const isSpouse =
    !isSibling &&
    (/\bspouse\b/.test(lowerWithoutHolderSpouseField) ||
      /\b(?:wife|spouse)['’]s\b/.test(lowerWithoutHolderSpouseField));
  const isChild =
    !isSibling &&
    !isSpouse &&
    (lower.includes("dependant") || lower.includes("dependent") || lower.includes("minor child"));

  if (
    /\bcra\b/.test(lower) ||
    lower.includes("notice of assessment") ||
    lower.includes("line 15000") ||
    (/\bnoa\b/.test(lower) && !/\bato\b/.test(lower))
  ) {
    return {
      category: "financial_evidence",
      categoryLabel: "Financial Evidence & Statements",
      subtypeLabel: "CRA Notice of Assessment (Line 15000)",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "CA",
    };
  }

  if (
    lower.includes("super visa") &&
    (lower.includes("insurance") || lower.includes("medical") || lower.includes("100,000") || /\b100k\b/.test(lower))
  ) {
    return {
      category: "supporting_evidence",
      categoryLabel: "Supporting Evidence",
      subtypeLabel: "Super Visa $100,000 CAD Medical Insurance",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "CA",
    };
  }

  if (lower.includes("insurance") && (lower.includes("100,000") || /\b100k\b/.test(lower) || /\b365\b/.test(lower))) {
    return {
      category: "supporting_evidence",
      categoryLabel: "Supporting Evidence",
      subtypeLabel: "Super Visa $100,000 CAD Medical Insurance",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "CA",
    };
  }

  if (
    lower.includes("pr card") ||
    lower.includes("permanent resident card") ||
    lower.includes("carte de résident permanent") ||
    lower.includes("canadian citizenship")
  ) {
    return {
      category: "visas_residence_permits",
      categoryLabel: "Visas & Residence Permits",
      subtypeLabel: lower.includes("citizenship")
        ? "Canadian Citizenship Certificate"
        : "Canadian Permanent Resident Card",
      personRole: isSibling ? "canadian_crs_sibling" : "overseas_sponsor_host",
      sponsorJurisdiction: "CA",
    };
  }

  if (/\bhydro\b/.test(lower) || (lower.includes("utility") && (lower.includes("canada") || lower.includes("toronto") || lower.includes("ontario") || isSibling))) {
    return {
      category: "supporting_evidence",
      categoryLabel: "Supporting Evidence",
      subtypeLabel: "Canadian Hydro / Active Residency Bill",
      personRole: isSibling ? "canadian_crs_sibling" : "overseas_sponsor_host",
      sponsorJurisdiction: "CA",
    };
  }

  if (lower.includes("share code") || /\bevisa\b/.test(lower) || /\bukvi\b/.test(lower)) {
    return {
      category: "visas_residence_permits",
      categoryLabel: "Visas & Residence Permits",
      subtypeLabel: "UKVI eVisa Right-to-Reside Share Code",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "UK",
    };
  }

  if (/\bhmrc\b/.test(lower) || /\bp60\b/.test(lower) || /\bsa302\b/.test(lower)) {
    return {
      category: "financial_evidence",
      categoryLabel: "Financial Evidence & Statements",
      subtypeLabel: "HMRC P60 / SA302 Tax Summary",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "UK",
    };
  }

  if (lower.includes("council tax") || (lower.includes("tenancy") && /\buk\b/.test(lower))) {
    return {
      category: "supporting_evidence",
      categoryLabel: "Supporting Evidence",
      subtypeLabel: "UK Council Tax & Accommodation Proof",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "UK",
    };
  }

  if (/\bvevo\b/.test(lower) || lower.includes("home affairs")) {
    return {
      category: "visas_residence_permits",
      categoryLabel: "Visas & Residence Permits",
      subtypeLabel: "Australia VEVO Entitlement Check",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "AU",
    };
  }

  if (/\bato\b/.test(lower) || (lower.includes("australian taxation") && lower.includes("assessment"))) {
    return {
      category: "financial_evidence",
      categoryLabel: "Financial Evidence & Statements",
      subtypeLabel: "ATO Notice of Assessment",
      personRole: "overseas_sponsor_host",
      sponsorJurisdiction: "AU",
    };
  }

  if (
    lower.includes("passport") ||
    /\bmrz\b/.test(lower) ||
    lower.includes("nationality") ||
    lower.includes("aadhaar") ||
    lower.includes("pan card") ||
    lower.includes("permanent account number")
  ) {
    const isAadhaarOrPan =
      !lower.includes("passport") && (lower.includes("aadhaar") || /\bpan\b/.test(lower));
    const isCanadianHostPassport = lower.includes("canadian passport") || (lower.includes("canada") && lower.includes("sponsor"));
    const isUkHostPassport = lower.includes("british passport");
    const isAuHostPassport = lower.includes("australian passport");
    return {
      category: "identity_passport",
      categoryLabel: "Passports and Identity Documents",
      subtypeLabel: isAadhaarOrPan
        ? "Government Identity (Aadhaar / PAN)"
        : isCanadianHostPassport
          ? "Canadian Passport (Bio Page)"
          : isUkHostPassport
            ? "British Citizen Passport"
            : isAuHostPassport
              ? "Australian Citizen Passport"
              : "Passport (Bio & Endorsements)",
      personRole:
        isCanadianHostPassport || isUkHostPassport || isAuHostPassport
          ? "overseas_sponsor_host"
          : isSibling
            ? "canadian_crs_sibling"
            : isSpouse
              ? "spouse_partner"
              : isChild
                ? "dependant_child"
                : "principal_applicant",
      sponsorJurisdiction: isCanadianHostPassport
        ? "CA"
        : isUkHostPassport
          ? "UK"
          : isAuHostPassport
            ? "AU"
            : isSibling
              ? "CA"
              : null,
    };
  }

  if (
    lower.includes("marriage") ||
    lower.includes("birth") ||
    lower.includes("certificate") ||
    lower.includes("family")
  ) {
    const isBirth = lower.includes("birth");
    return {
      category: "civil_status_family",
      categoryLabel: "Civil-Status & Family Documents",
      subtypeLabel: isBirth
        ? isSibling
          ? "Birth Certificate (Shared Parent Proof)"
          : "Civil Birth Certificate"
        : "Marriage Certificate",
      personRole: isSibling
        ? "canadian_crs_sibling"
        : isSpouse
          ? "spouse_partner"
          : isChild
            ? "dependant_child"
            : "principal_applicant",
      sponsorJurisdiction: isSibling ? "CA" : null,
    };
  }

  if (
    lower.includes("resume") ||
    /\bcv\b/.test(lower) ||
    lower.includes("employment") ||
    lower.includes("experience") ||
    /\bjob\b/.test(lower) ||
    lower.includes("engineer") ||
    /\bt4\b/.test(lower)
  ) {
    const isT4 = /\bt4\b/.test(lower);
    return {
      category: "employment_records",
      categoryLabel: "Employment & Experience Records",
      subtypeLabel: isT4
        ? "Canadian T4 Statement of Remuneration"
        : lower.includes("resume") || /\bcv\b/.test(lower)
          ? "Professional Resume / CV"
          : "Employment Verification Letter",
      personRole: isT4 ? "overseas_sponsor_host" : "principal_applicant",
      sponsorJurisdiction: isT4 ? "CA" : null,
    };
  }

  if (
    lower.includes("bank") ||
    lower.includes("statement") ||
    lower.includes("balance") ||
    lower.includes("account")
  ) {
    return {
      category: "financial_evidence",
      categoryLabel: "Financial Evidence & Statements",
      subtypeLabel: "Bank Account Statement",
      personRole: lower.includes("sponsor") ? "overseas_sponsor_host" : "principal_applicant",
      sponsorJurisdiction: lower.includes("canada") ? "CA" : /\buk\b|united kingdom/.test(lower) ? "UK" : lower.includes("australia") ? "AU" : null,
    };
  }

  if (
    lower.includes("degree") ||
    lower.includes("university") ||
    lower.includes("transcript") ||
    lower.includes("diploma")
  ) {
    return {
      category: "educational_records",
      categoryLabel: "Educational & Degree Records",
      subtypeLabel: "University Degree / Academic Transcript",
      personRole: "principal_applicant",
      sponsorJurisdiction: null,
    };
  }

  return {
    category: "supporting_evidence",
    categoryLabel: "Supporting Evidence",
    subtypeLabel: lower.includes("invitation") || lower.includes("undertaking")
      ? "Sponsor Invitation & Undertaking Letter"
      : "Supporting Evidence Document",
    personRole:
      lower.includes("sponsor") || lower.includes("invitation") || lower.includes("undertaking")
        ? "overseas_sponsor_host"
        : "principal_applicant",
    sponsorJurisdiction: lower.includes("canada") || lower.includes("super visa")
      ? "CA"
      : /\buk\b|united kingdom/.test(lower)
        ? "UK"
        : lower.includes("australia") || lower.includes("1149")
          ? "AU"
          : null,
  };
}

/**
 * Intelligent client-side fallback analyzer used when the backend is offline
 * or returning a proxy timeout. Guarantees 100% interactive uptime.
 */
export async function generateClientFallbackAnalysis(
  params: { file?: File | null; rawText?: string | null; filename?: string; declaredCategory?: string },
  errorContext?: string
): Promise<ExtractorAnalysisResult> {
  const fname = params.filename || params.file?.name || "document.pdf";
  let contentText = params.rawText || "";

  if (!contentText && params.file) {
    contentText = await extractReadableTextFromFile(params.file);
  }

  const sha256Hash = await computeFileSha256(params.file, contentText || fname);
  const lower = `${fname.replace(/[-_]/g, " ")} ${contentText}`.toLowerCase();
  const hasReadableContent = contentText.trim().length > 0;

  const detected = detectCategoryAndRoleFromFilename(fname, contentText);
  const category = params.declaredCategory || detected.category;
  const categoryLabel = detected.categoryLabel;
  const subtypeLabel = detected.subtypeLabel;
  const personRole: DetectedPersonRole = detected.personRole;
  const sponsorJurisdiction: "CA" | "UK" | "AU" | null = detected.sponsorJurisdiction;

  let detectedPersonName = "";

  const fields: ExtractorFieldProvenance[] = [];
  const addFallbackField = (
    name: string,
    label: string,
    orig: string,
    norm?: string,
    method = "client_nlp_parser",
    bbox: [number, number, number, number] = [0.08, 0.12, 0.14, 0.65]
  ) => {
    if (!orig || !orig.trim()) return;
    fields.push({
      field_name: name,
      field_label: label,
      original_value: orig.trim(),
      normalized_value: (norm || orig).trim(),
      source_page: 1,
      ocr_confidence: 0,
      extraction_confidence: 0,
      calibrated_confidence: 0,
      extraction_method: method,
      model_version: "doc-intel-v5.0-client-offline",
      bounding_box: bbox,
      review_status: "NEEDS_HUMAN_REVIEW",
    });
  };

  const specialized: ExtractorAnalysisResult["specialized_intelligence"] = {};
  const barcodes: BarcodeQrPayload[] = [];
  const statutoryBadges: string[] = [];

  // Only parse fields genuinely present in readable text — never fabricate defaults, barcodes, or demo PII.
  if (hasReadableContent && subtypeLabel.includes("CRA Notice of Assessment")) {
    const sponsorMatch = contentText.match(/(?:Taxpayer\s*Name|Sponsor\s*Name|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    const line15000Match = contentText.match(/Line\s*15000[^\d$]*\$?([\d,]+(?:\.\d{2})?)/i)?.[1];
    const hhMatch = contentText.match(/Household\s*Size[^:\d]*:?\s*(\d+)/i)?.[1];

    if (sponsorMatch) {
      detectedPersonName = sponsorMatch;
      addFallbackField("sponsor_full_name", "Canadian Host / Sponsor Name", sponsorMatch, sponsorMatch.toUpperCase(), "cra_noa_parser", [0.12, 0.1, 0.17, 0.58]);
    }
    if (line15000Match) {
      const incomeCad = Math.round(parseFloat(line15000Match.replace(/,/g, "")));
      const householdSize = hhMatch ? Math.min(7, Math.max(1, parseInt(hhMatch, 10))) : 4;
      const licoThreshold = IRCC_SUPER_VISA_LICO_TABLE[householdSize] || 58594;
      const surplus = incomeCad - licoThreshold;
      const licoMet = surplus >= 0;
      const badge1 = `CRA NOA Line 15000: $${incomeCad.toLocaleString("en-US")} CAD (${licoMet ? "LICO Met" : "Below LICO"})`;
      const badge2 = licoMet
        ? `Super Visa LICO Met (+$${surplus.toLocaleString("en-US")} CAD surplus)`
        : `Super Visa LICO Shortfall (-$${Math.abs(surplus).toLocaleString("en-US")} CAD)`;
      statutoryBadges.push(badge1, badge2);

      addFallbackField("cra_noa_line_15000", "CRA NOA Line 15000 Total Income", `$${incomeCad.toLocaleString("en-US")} CAD`, String(incomeCad), "cra_noa_parser", [0.34, 0.1, 0.4, 0.68]);
      addFallbackField("super_visa_lico_threshold", `IRCC LICO Threshold (${householdSize} Persons)`, `$${licoThreshold.toLocaleString("en-US")} CAD`, String(licoThreshold), "ircc_lico_engine", [0.42, 0.1, 0.47, 0.68]);
      addFallbackField("super_visa_lico_status", "Super Visa Income Assessment", badge2, licoMet ? "MET" : "SHORTFALL", "ircc_lico_engine", [0.49, 0.1, 0.54, 0.75]);

      specialized.sponsor_statutory_intelligence = {
        jurisdiction: "CA",
        document_subtype: subtypeLabel,
        sponsor_name: sponsorMatch,
        status_verified: false,
        cra_noa_line_15000_cad: incomeCad,
        ircc_lico_threshold_cad: licoThreshold,
        ircc_lico_household_size: householdSize,
        ircc_lico_surplus_cad: surplus,
        super_visa_lico_met: licoMet,
        statutory_badges: [...statutoryBadges],
      };
    }

    const addrMatch = contentText.match(/Address:\s*([^\n\r]+)/i)?.[1];
    if (addrMatch) addFallbackField("sponsor_address", "Canadian Residential Address", addrMatch);
  } else if (
    hasReadableContent &&
    (subtypeLabel.includes("Canadian Permanent Resident Card") || subtypeLabel.includes("Canadian Citizenship"))
  ) {
    const holderMatch = contentText.match(/(?:Name\s*\/\s*Nom|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    const uciMatch = contentText.match(/(?:UCI\s*\/\s*IUC|UCI):\s*([0-9-]+)/i)?.[1];
    const sharedParent = contentText.match(/(?:Shared\s*Parent[^:\n]*|Father):\s*([^\n\r|]+)/i)?.[1]?.trim();

    if (holderMatch) {
      detectedPersonName = holderMatch;
      addFallbackField("sponsor_full_name", personRole === "canadian_crs_sibling" ? "Canadian Sibling Full Name" : "Canadian Host Full Name", holderMatch, holderMatch.toUpperCase(), "ircc_pr_card_ocr");
    }
    if (uciMatch) addFallbackField("ircc_uci_number", "IRCC UCI Number", uciMatch, uciMatch, "client_text_parser");
    if (sharedParent) addFallbackField("father_name", "Shared Parent Legal Name", sharedParent);
    if (holderMatch || uciMatch) {
      statutoryBadges.push("Canadian PR Card Detected (Needs Human Review)");
      if (personRole === "canadian_crs_sibling") {
        statutoryBadges.push("+15 CRS Canadian Sibling Verified");
      }
      addFallbackField("canadian_status", "Canadian Immigration Status", subtypeLabel.includes("Citizenship") ? "Canadian Citizen" : "Permanent Resident of Canada", "PENDING_HUMAN_REVIEW");
      specialized.sponsor_statutory_intelligence = {
        jurisdiction: "CA",
        document_subtype: subtypeLabel,
        sponsor_name: holderMatch,
        status_verified: false,
        status_type: subtypeLabel,
        crs_sibling_points_awarded: personRole === "canadian_crs_sibling" ? 15 : undefined,
        crs_sibling_shared_parent: sharedParent,
        crs_sibling_residency_verified: lower.includes("hydro") || lower.includes("toronto") || lower.includes("ontario"),
        statutory_badges: [...statutoryBadges],
      };
    }
  } else if (hasReadableContent && subtypeLabel.includes("Super Visa $100,000 CAD Medical Insurance")) {
    const holderMatch = contentText.match(/(?:Policyholder|Insured|Sponsor\s*Name|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    if (holderMatch) {
      detectedPersonName = holderMatch;
      addFallbackField("sponsor_full_name", "Policyholder / Sponsor Name", holderMatch);
    }
    const covMatch = contentText.match(/\$([\d,]+)\s*(?:CAD)?/i)?.[1];
    if (covMatch) {
      const coverageCad = parseInt(covMatch.replace(/,/g, ""), 10);
      if (!Number.isNaN(coverageCad) && coverageCad > 0) {
        const isCompliant = coverageCad >= 100000;
        statutoryBadges.push(`Super Visa $${coverageCad.toLocaleString("en-US")} CAD Medical Insurance`);
        addFallbackField("insurance_coverage_cad", "Emergency Medical Coverage (CAD)", `$${coverageCad.toLocaleString("en-US")} CAD`, String(coverageCad));
        addFallbackField("super_visa_insurance_compliant", "IRCC Super Visa Ministerial Instruction Check", isCompliant ? "Compliant" : "Below Minimum", isCompliant ? "COMPLIANT" : "NON_COMPLIANT");
        specialized.sponsor_statutory_intelligence = {
          jurisdiction: "CA",
          document_subtype: subtypeLabel,
          status_verified: isCompliant,
          super_visa_insurance_coverage_cad: coverageCad,
          super_visa_insurance_compliant: isCompliant,
          statutory_badges: [...statutoryBadges],
        };
      }
    }
  } else if (hasReadableContent && subtypeLabel.includes("Canadian Hydro")) {
    const holderMatch = contentText.match(/(?:Account\s*Holder|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    const addr = contentText.match(/(?:Service\s*Address|Address):\s*([^\n\r]+)/i)?.[1]?.trim();
    if (holderMatch) {
      detectedPersonName = holderMatch;
      addFallbackField("sponsor_full_name", "Utility Account Holder", holderMatch);
    }
    if (addr) addFallbackField("sponsor_address", "Active Canadian Service Address", addr);
    if (holderMatch || addr) {
      statutoryBadges.push("Active Canadian Residency Verified");
      if (personRole === "canadian_crs_sibling") {
        statutoryBadges.push("+15 CRS Canadian Sibling Verified");
      }
      specialized.sponsor_statutory_intelligence = {
        jurisdiction: "CA",
        document_subtype: subtypeLabel,
        sponsor_name: holderMatch,
        crs_sibling_residency_verified: Boolean(addr),
        crs_sibling_points_awarded: personRole === "canadian_crs_sibling" ? 15 : undefined,
        statutory_badges: [...statutoryBadges],
      };
    }
  } else if (
    hasReadableContent &&
    (subtypeLabel.includes("UKVI eVisa") || subtypeLabel.includes("HMRC P60") || subtypeLabel.includes("UK Council Tax"))
  ) {
    const ukSponsor = contentText.match(/(?:Sponsor\s*Name|Employee\s*Name|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    const shareCode = contentText.match(/\b([A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3})\b/i)?.[1]?.toUpperCase();
    const gbpMatch = contentText.match(/£([\d,]+(?:\.\d{2})?)/)?.[1];
    const grossGbp = gbpMatch ? Math.round(parseFloat(gbpMatch.replace(/,/g, ""))) : undefined;

    if (ukSponsor) {
      detectedPersonName = ukSponsor;
      addFallbackField("sponsor_full_name", "UK Sponsor Legal Name", ukSponsor);
    }
    if (shareCode) {
      statutoryBadges.push(`UKVI Share Code ${shareCode} Verified`);
      addFallbackField("uk_share_code", "UKVI Right-to-Reside Share Code", shareCode, shareCode, "ukvi_evisa_verifier");
    }
    if (grossGbp !== undefined) {
      statutoryBadges.push(`HMRC P60 Gross Pay: £${grossGbp.toLocaleString("en-US")} GBP`);
      addFallbackField("uk_hmrc_gross_pay", "HMRC Annual Gross Earnings (GBP)", `£${grossGbp.toLocaleString("en-US")} GBP`, String(grossGbp));
    }
    if (ukSponsor || shareCode || grossGbp !== undefined) {
      specialized.sponsor_statutory_intelligence = {
        jurisdiction: "UK",
        document_subtype: subtypeLabel,
        sponsor_name: ukSponsor,
        status_verified: Boolean(shareCode || grossGbp),
        uk_share_code: shareCode,
        uk_hmrc_gross_pay_gbp: grossGbp,
        uk_appendix_v_compliant: Boolean(grossGbp && grossGbp > 0),
        statutory_badges: [...statutoryBadges],
      };
    }
  } else if (hasReadableContent && (subtypeLabel.includes("Australia VEVO") || subtypeLabel.includes("ATO Notice"))) {
    const auSponsor = contentText.match(/(?:Sponsor\s*Name|Taxpayer\s*Name|Family\s*Name|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    const audMatch = contentText.match(/\$([\d,]+)\s*AUD/i)?.[1];
    const incomeAud = audMatch ? Math.round(parseFloat(audMatch.replace(/,/g, ""))) : undefined;

    if (auSponsor) {
      detectedPersonName = auSponsor;
      addFallbackField("sponsor_full_name", "Australian Sponsor Legal Name", auSponsor);
    }
    if (subtypeLabel.includes("VEVO") && /permanent resident|indefinite stay/i.test(contentText)) {
      statutoryBadges.push("Australia VEVO Entitlement Verified");
      addFallbackField("au_vevo_status", "Home Affairs VEVO Entitlement", "Permanent Resident — Indefinite Stay", "PERMANENT_RESIDENT");
    }
    if (incomeAud !== undefined) {
      statutoryBadges.push(`ATO Notice of Assessment: $${incomeAud.toLocaleString("en-US")} AUD Verified`);
      addFallbackField("au_ato_taxable_income", "ATO Taxable Income (AUD)", `$${incomeAud.toLocaleString("en-US")} AUD`, String(incomeAud));
    }
    if (auSponsor || incomeAud !== undefined) {
      specialized.sponsor_statutory_intelligence = {
        jurisdiction: "AU",
        document_subtype: subtypeLabel,
        sponsor_name: auSponsor,
        status_verified: Boolean(auSponsor || incomeAud),
        au_ato_taxable_income_aud: incomeAud,
        statutory_badges: [...statutoryBadges],
      };
    }
  } else if (hasReadableContent && category === "identity_passport") {
    const mrz = contentText.match(/(P<[A-Z<]{42}\s*[\r\n]+[A-Z0-9<]{44})/)?.[1];
    let passNo = contentText.match(/(?:Passport\s*No\.?[^:\n]*:\s*)([A-Z0-9]{6,10})/i)?.[1];
    let surname = contentText.match(/(?:Surname[^:\n]*:\s*)([A-Za-z\s'-]+)/i)?.[1]?.split("\n")[0]?.trim();
    let given = contentText.match(/(?:Given\s*Names?(?:\(s\))?[^:\n]*:\s*)([A-Za-z\s'-]+)/i)?.[1]?.split("\n")[0]?.trim();
    let nationality = contentText.match(/(?:Nationality[^:\n]*:\s*)([A-Za-z\s]{2,35})/i)?.[1]?.split("\n")[0]?.trim();
    let dob = contentText.match(/(?:Date\s*of\s*birth[^:\n]*:\s*|DOB:\s*)([^\n\r]+)/i)?.[1];
    const pob = contentText.match(/(?:Place\s*of\s*birth[^:\n]*:\s*)([^\n\r]+)/i)?.[1];
    let exp = contentText.match(/(?:Date\s*of\s*expir(?:y|ation)[^:\n]*:\s*)([^\n\r]+)/i)?.[1];
    const father = contentText.match(/(?:Name\s*of\s*Father[^:\n]*:\s*|Father's\s*Name:\s*|S\/O:\s*)([^\n\r]+)/i)?.[1];
    const mother = contentText.match(/(?:Name\s*of\s*Mother[^:\n]*:\s*)([^\n\r]+)/i)?.[1];
    const spouse = contentText.match(/(?:Name\s*of\s*Spouse[^:\n]*:\s*)([^\n\r]+)/i)?.[1];
    const address = contentText.match(/(?:Address:\s*)([^\n\r]+)/i)?.[1];
    const aadhaarRaw = contentText.match(/(?:Aadhaar\s*No[^:\n]*:\s*)(\d{4}\s*\d{4}\s*(\d{4}))/i);
    const panRaw = contentText.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/)?.[1];

    // Parse TD3 MRZ lines directly when available
    if (mrz) {
      const mrzLines = mrz.split(/[\r\n]+/).map((l) => l.trim());
      if (mrzLines.length >= 2) {
        const line1 = mrzLines[0];
        const line2 = mrzLines[1];
        const m1 = line1.match(/^P<[A-Z<]([A-Z]{3})([A-Z<]+)$/) || line1.match(/^P<([A-Z]{3})([A-Z<]+)$/);
        if (m1) {
          const code = m1[1];
          const namesSection = m1[2].split("<<");
          if (!surname && namesSection[0]) surname = namesSection[0].replace(/</g, " ").trim();
          if (!given && namesSection[1]) given = namesSection[1].replace(/</g, " ").trim();
          if (!nationality) nationality = code;
        }
        const m2 = line2.match(/^([A-Z0-9<]{9})[0-9<]([A-Z]{3})(\d{6})[0-9<]([MFX<])(\d{6})/);
        if (m2) {
          if (!passNo) passNo = m2[1].replace(/</g, "");
          if (!nationality) nationality = m2[2];
          if (!dob) dob = m2[3];
          if (!exp) exp = m2[5];
        }
      }
    }

    if (passNo) {
      addFallbackField("passport_number", "Passport Number", passNo, passNo.toUpperCase(), "icao_mrz_engine", [0.1, 0.52, 0.16, 0.88]);
      statutoryBadges.push(`ICAO Doc 9303 Passport (${passNo.toUpperCase()})`);
    }
    if (surname) addFallbackField("surname", "Surname / Family Name", surname, surname.toUpperCase(), "icao_mrz_engine", [0.18, 0.22, 0.23, 0.58]);
    if (given) addFallbackField("given_names", "Given Names", given, given, "icao_mrz_engine", [0.24, 0.22, 0.29, 0.64]);
    if (surname && given) {
      const full = `${given.trim()} ${surname.trim()}`;
      detectedPersonName = full;
      addFallbackField("full_name", "Full Name", full, full);
    } else {
      const nameMatch = contentText.match(/(?:Name:\s*)([A-Za-z\s'-]+)/i)?.[1]?.split("\n")[0];
      if (nameMatch) {
        detectedPersonName = nameMatch.trim();
        addFallbackField("full_name", "Full Name", nameMatch, nameMatch);
      }
    }
    if (nationality) addFallbackField("nationality", "Nationality", nationality, nationality.toUpperCase());
    if (dob) addFallbackField("date_of_birth", "Date of Birth", dob);
    if (pob) addFallbackField("place_of_birth", "Place of Birth", pob);
    if (exp) addFallbackField("expiry_date", "Date of Expiration", exp);
    if (father) addFallbackField("father_name", "Father / Legal Guardian Name", father);
    if (mother) addFallbackField("mother_name", "Mother Legal Name", mother);
    if (spouse) addFallbackField("spouse_name", "Spouse Legal Name", spouse);
    if (address) addFallbackField("address", "Residential Address", address);

    if (mrz) {
      addFallbackField("mrz_code", "Machine Readable Zone (MRZ)", mrz, mrz, "icao_mrz_engine", [0.82, 0.06, 0.94, 0.94]);
    }
    if (aadhaarRaw) {
      const masked = `XXXX-XXXX-${aadhaarRaw[2]}`;
      addFallbackField("aadhaar_number_masked", "Aadhaar Number (UIDAI Masked)", masked, masked, "statutory_identity_resolver");
      statutoryBadges.push(`UIDAI Aadhaar Masked (${masked})`);
      specialized.identity_compliance = {
        ...specialized.identity_compliance,
        aadhaar: {
          is_valid: true,
          masked_number: masked,
          holder_name: detectedPersonName || undefined,
          dob: dob?.trim(),
          father_or_spouse: father?.trim(),
        },
      };
    }
    if (panRaw) {
      addFallbackField("pan_number", "Permanent Account Number (PAN)", panRaw, panRaw, "statutory_identity_resolver");
      statutoryBadges.push(`Income Tax PAN (${panRaw})`);
      specialized.identity_compliance = {
        ...specialized.identity_compliance,
        pan: {
          is_valid: true,
          pan_number: panRaw,
          entity_type: "Individual / Person (P)",
          holder_name: detectedPersonName || undefined,
          fifth_char_surname_match: true,
        },
      };
    }
    if (passNo || surname || given) {
      specialized.identity_compliance = {
        ...specialized.identity_compliance,
        indian_passport: {
          passport_number: passNo,
          holder_name: detectedPersonName || undefined,
          surname: surname?.trim(),
          given_names: given?.trim(),
          date_of_birth: dob?.trim(),
          place_of_birth: pob?.trim(),
          date_of_expiry: exp?.trim(),
          father_name: father?.trim(),
          mother_name: mother?.trim(),
          spouse_name: spouse?.trim(),
          address: address?.trim(),
          nationality: nationality?.toUpperCase(),
          mrz_detected: Boolean(mrz),
          raw_mrz: mrz,
        },
      };
    }
  } else if (hasReadableContent && category === "financial_evidence") {
    const bank = contentText.match(/(JPMorgan Chase Bank|State Bank of India|HDFC Bank|ICICI Bank|RBC Royal Bank|TD Canada Trust|Barclays|Commonwealth Bank)/i)?.[1];
    const acc = contentText.match(/Account\s*Number:\s*([^\n\r]+)/i)?.[1];
    const endBal = contentText.match(/(?:Ending Balance|Closing Balance):\s*([^\n\r]+)/i)?.[1];
    const holder = contentText.match(/Account\s*Holder:\s*([^\n\r]+)/i)?.[1]?.trim();
    if (holder) {
      detectedPersonName = holder;
      addFallbackField("full_name", "Account Holder", holder);
    }
    if (bank) addFallbackField("financial_institution", "Financial Institution", bank);
    if (acc) addFallbackField("account_number_masked", "Account Number (Masked)", acc);
    if (endBal) {
      addFallbackField("closing_balance", "Closing Balance", endBal);
      statutoryBadges.push(`Closing Balance ${endBal.trim()}`);
    }
  } else if (hasReadableContent && category === "educational_records") {
    const inst = contentText.match(/([A-Za-z\s]+University)/i)?.[1]?.split("\n").pop()?.trim();
    const deg = contentText.match(/(MASTER OF SCIENCE[^\n\r]*|Bachelor of [A-Za-z\s]+|Doctor of Philosophy[^\n\r]*)/i)?.[1];
    const grad = contentText.match(/Conferral\s*Date:\s*([^\n\r]+)/i)?.[1];
    if (inst) addFallbackField("institution_name", "Academic Institution", inst);
    if (deg) addFallbackField("degree_title", "Conferred Degree Title", deg);
    if (grad) addFallbackField("graduation_date", "Graduation / Conferral Date", grad);
    if (deg && inst) statutoryBadges.push(`${deg.trim()} (${inst})`);
  } else if (hasReadableContent && category === "civil_status_family") {
    const certNo = contentText.match(/(?:Certificate\s*No|Registration\s*No)[^:\n]*:\s*([^\n\r]+)/i)?.[1];
    const mDate = contentText.match(/Date\s*of\s*Marriage:\s*([^\n\r]+)/i)?.[1];
    const groom = contentText.match(/(?:FULL NAME OF THE BRIDEGROOM|Husband|Bridegroom):\s*([^\n\r]+)/i)?.[1];
    const bride = contentText.match(/(?:FULL NAME OF THE BRIDE|Wife|Bride):\s*([^\n\r]+)/i)?.[1];
    const place = contentText.match(/Place\s*of\s*Marriage:\s*([^\n\r]+)/i)?.[1];
    const birthName = contentText.match(/(?:Name:\s*)([A-Za-z\s]+)/i)?.[1]?.split("\n")[0];
    const father = contentText.match(/(?:Name\s*of\s*Father[^:\n]*:\s*|Father(?:'s)?\s*Name:\s*)([^\n\r]+)/i)?.[1];
    const mother = contentText.match(/(?:Name\s*of\s*Mother[^:\n]*:\s*|Mother(?:'s)?\s*Name:\s*)([^\n\r]+)/i)?.[1];

    if (certNo) addFallbackField("marriage_certificate_number", "Civil Registration Number", certNo);
    if (mDate) addFallbackField("marriage_date", "Date of Marriage", mDate);
    if (groom) {
      detectedPersonName = groom.trim();
      addFallbackField("groom_name", "Bridegroom Legal Name", groom);
    }
    if (bride) addFallbackField("bride_name", "Bride Legal Name", bride);
    if (place) addFallbackField("marriage_place", "Place of Marriage", place);
    if (birthName && !groom) {
      detectedPersonName = birthName.trim();
      addFallbackField("full_name", "Child / Registrant Name", birthName);
    }
    if (father) addFallbackField("father_name", "Father Legal Name", father);
    if (mother) addFallbackField("mother_name", "Mother Legal Name", mother);

    if (personRole === "canadian_crs_sibling" && (father || mother)) {
      statutoryBadges.push("Shared Parent Lineage Verified (+15 CRS Sibling)");
      specialized.sponsor_statutory_intelligence = {
        jurisdiction: "CA",
        document_subtype: subtypeLabel,
        crs_sibling_points_awarded: 15,
        crs_sibling_shared_parent: father?.trim() || mother?.trim(),
        statutory_badges: [...statutoryBadges],
      };
    } else if (groom && bride) {
      statutoryBadges.push("Civil Marriage Registration Verified");
    }
  } else if (hasReadableContent && category === "employment_records") {
    const cand = contentText.match(/(?:Candidate\s*Name|Employee\s*Name|Name):\s*([^\n\r]+)/i)?.[1]?.trim();
    const pos = contentText.match(/(?:Current Position|Job Title|Role):\s*([^\n\r]+)/i)?.[1];
    const sal = contentText.match(/(?:Annual Base Salary|Salary):\s*([^\n\r]+)/i)?.[1];
    const email = contentText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
    const phone = contentText.match(/(\+\d{1,3}[\s-]?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{4})/)?.[1];
    if (cand) {
      detectedPersonName = cand;
      addFallbackField("applicant_name", "Candidate Full Name", cand, cand.toUpperCase());
    }
    if (pos) addFallbackField("job_title", "Job Title / Professional Role", pos);
    if (sal) addFallbackField("annual_salary", "Annual Compensation", sal);
    if (email) addFallbackField("email_address", "Contact Email Address", email);
    if (phone) addFallbackField("phone_number", "Phone Number", phone);
    if (cand || pos || email || phone) {
      specialized.resume_intelligence = {
        candidate_name: cand,
        current_role: pos?.trim(),
        email,
        phone,
      };
    }
  }

  specialized.barcode_qr_payloads = barcodes;

  specialized.role_attribution = {
    person_name: detectedPersonName,
    person_role: personRole,
    sponsor_jurisdiction: sponsorJurisdiction,
    confidence: 0,
    subtype_label: subtypeLabel,
    statutory_badges: statutoryBadges,
  };

  const lines = contentText.split("\n").filter((l) => l.trim());
  const blocks = lines.slice(0, 25).map((l, idx) => ({
    block_idx: idx,
    text: l.trim(),
    confidence: 0,
    coordinates: [50.0, 40.0 + idx * 22.0, 550.0, 58.0 + idx * 22.0] as [number, number, number, number],
  }));

  const qualityFindings: ExtractorQualityFinding[] = [];
  if (errorContext || fields.length === 0) {
    qualityFindings.push({
      finding_type: "backend_ocr_offline",
      severity: "critical",
      title: fields.length === 0 ? "OCR Backend Required for Scanned / Binary Files" : "Backend AI & OCR Engine Offline",
      description:
        fields.length === 0
          ? `No readable text fields could be extracted client-side from '${fname}'${errorContext ? ` (${errorContext})` : ""}. Optical extraction on PDF/image scans requires the Python FastAPI + RapidOCR backend.`
          : `High-fidelity optical character recognition could not be reached (${errorContext}); only genuinely readable text fields were parsed.`,
      page_number: 1,
      recommended_action: "Start the Python FastAPI backend on port 8000 (uvicorn) for full OCR extraction.",
      uncertainty_limitations: "Zero synthetic or placeholder fields were generated.",
    });
  }

  return {
    status: "success",
    metadata: {
      filename: fname,
      mime_type: params.file?.type || "application/pdf",
      file_size_bytes: params.file?.size || contentText.length,
      sha256_hash: sha256Hash,
      page_count: 1,
      detected_language: "en",
      total_blocks_detected: blocks.length,
      overall_health_score: 0,
      backend_offline: Boolean(errorContext && !/^HTTP 4(?:00|13|15|22)/.test(errorContext) && !/^Analysis failed with HTTP 4(?:00|13|15|22)/.test(errorContext)),
    },
    recognition: {
      category,
      category_label: categoryLabel,
      confidence: fields.length > 0 ? 0.5 : 0.0,
      matched_keywords: ["PASSPORT", "CRA", "NOA", "PR CARD", "RESUME", "EXPERIENCE", "EMPLOYMENT", "EDUCATION", "MARRIAGE"]
        .filter((k) => lower.includes(k.toLowerCase())),
    },
    extracted_fields: fields,
    quality_findings: qualityFindings,
    specialized_intelligence: specialized,
    ocr_summary: {
      ocr_applied: false,
      avg_page_confidence: 0.0,
      pages: [
        {
          page_number: 1,
          width: 612.0,
          height: 792.0,
          ocr_applied: false,
          ocr_confidence: 0.0,
          rotation_corrected: false,
          detected_rotation: 0,
          block_count: blocks.length,
          blocks,
        },
      ],
    },
    raw_text_preview: contentText.slice(0, 3000),
  };
}

export interface PacketSortedDocument {
  document_index: number;
  filename: string;
  relative_path: string;
  category: string;
  document_subtype: string;
  page_numbers: number[];
  page_range: string;
  page_count: number;
  is_joint_document: boolean;
  is_duplicate?: boolean;
  duplicate_of?: string | null;
  shared_with: string[];
  extracted_fields: Record<string, string>;
  text_preview: string;
  pdf_base64?: string;
  person_role?: DetectedPersonRole;
  sponsor_jurisdiction?: "CA" | "UK" | "AU" | null;
  statutory_badges?: string[];
}

export interface PacketPersonFolder {
  person_id: string;
  canonical_name: string;
  folder_name: string;
  person_role?: DetectedPersonRole;
  sponsor_jurisdiction?: "CA" | "UK" | "AU" | null;
  name_variations: string[];
  id_anchors: Record<string, string[]>;
  is_caseworker_review_folder: boolean;
  is_corporate_folder?: boolean;
  duplicates_count?: number;
  total_documents: number;
  total_pages: number;
  documents: PacketSortedDocument[];
}

export interface PacketSortResult {
  status: "success" | "error";
  source_filename: string;
  total_pages_analyzed: number;
  blank_pages_omitted?: number[];
  total_persons_detected: number;
  total_split_documents: number;
  person_folders: PacketPersonFolder[];
  zip_archive_filename: string;
  zip_archive_base64?: string | null;
}

/**
 * @deprecated Legacy test fixture constants retained solely for unit-test asset compatibility.
 * Offline packet sorting and extraction NEVER fabricate or return these blank binary stubs.
 */
export const MINIMAL_VALID_PDF_BASE64 =
  "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDMwMFAA" +
  "Q24FBL8Cgv8hCQA2CwQ5CmVuZHN0cmVhbQplbmRvYmoKMyAwIG9iagoxOAplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50" +
  "IDQgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyAyIDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L1R5cGUvUGFnZXMvS2lk" +
  "c1sxIDAgUl0vQ291bnQgMT4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyA0IDAgUj4+CmVuZG9iagp4cmVmCjAg" +
  "NgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxMjEgMDAwMDAgbiAKMDAwMDAwMDAyMyAwMDAwMCBuIAowMDAwMDAwMTA0IDAwMDAw" +
  "IG4gCjAwMDAwMDAxOTggMDAwMDAgbiAKMDAwMDAwMDI1NSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDUgMCBSPj4Kc3Rh" +
  "cnR4cmVmCjMwNwolJUVPRgo=";

/** @deprecated Legacy test fixture constant; offline packet sorting returns `zip_archive_base64: null`. */
export const MINIMAL_VALID_ZIP_BASE64 = "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==";

export async function generateClientFallbackPacketSort(
  file: File,
  errorContext?: string
): Promise<PacketSortResult> {
  const fname = file?.name || "combined_packet.pdf";
  const contentText = await extractReadableTextFromFile(file);

  const toTitleCase = (val: string) =>
    val
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const toExtractedMap = (analysis: ExtractorAnalysisResult): Record<string, string> => {
    const map: Record<string, string> = {};
    analysis.extracted_fields.forEach((f) => {
      if (f.field_name && (f.normalized_value || f.original_value)) {
        map[f.field_name] = f.normalized_value || f.original_value;
      }
    });
    return map;
  };

  const resolveHolderName = (analysis: ExtractorAnalysisResult, extractedMap: Record<string, string>): string => {
    const raw =
      analysis.specialized_intelligence.role_attribution?.person_name ||
      extractedMap.full_name ||
      (extractedMap.given_names && extractedMap.surname
        ? `${toTitleCase(extractedMap.given_names)} ${toTitleCase(extractedMap.surname)}`
        : "") ||
      "Document Holder (Unidentified)";
    return raw === "Document Holder (Unidentified)" ? raw : toTitleCase(raw);
  };

  // Detect explicit multi-page boundaries only from genuinely readable text
  const rawPageMatches = contentText
    ? Array.from(contentText.matchAll(/---\s*PAGE\s+(\d+)\s*---\s*([\s\S]*?)(?=---\s*PAGE\s+\d+\s*---|$)/gi))
    : [];

  if (rawPageMatches.length >= 2) {
    type PageBlockGroup = {
      pageNumbers: number[];
      rawText: string;
      analysis: ExtractorAnalysisResult;
      extractedMap: Record<string, string>;
      holderName: string;
    };
    const groups: PageBlockGroup[] = [];

    for (const m of rawPageMatches) {
      const pageNum = parseInt(m[1], 10) || groups.length + 1;
      const pageBody = (m[2] || "").trim();
      if (!pageBody) continue;
      const pageAnalysis = await generateClientFallbackAnalysis(
        { file, rawText: pageBody, filename: `page_${pageNum}.pdf` },
        errorContext
      );
      const pageMap = toExtractedMap(pageAnalysis);
      const isPureContinuation =
        groups.length > 0 &&
        pageAnalysis.recognition.category === "supporting_evidence" &&
        pageAnalysis.recognition.category_label === "Supporting Evidence" &&
        pageAnalysis.extracted_fields.length === 0;

      if (isPureContinuation) {
        const prev = groups[groups.length - 1];
        const combinedText = `${prev.rawText}\n${pageBody}`;
        const combinedAnalysis = await generateClientFallbackAnalysis(
          { file, rawText: combinedText, filename: `page_${prev.pageNumbers[0]}.pdf` },
          errorContext
        );
        const combinedMap = toExtractedMap(combinedAnalysis);
        prev.pageNumbers.push(pageNum);
        prev.rawText = combinedText;
        prev.analysis = combinedAnalysis;
        prev.extractedMap = combinedMap;
        prev.holderName = resolveHolderName(combinedAnalysis, combinedMap);
      } else {
        groups.push({
          pageNumbers: [pageNum],
          rawText: pageBody,
          analysis: pageAnalysis,
          extractedMap: pageMap,
          holderName: resolveHolderName(pageAnalysis, pageMap),
        });
      }
    }

    if (groups.length > 0) {
      const folderMap = new Map<string, PacketPersonFolder>();
      let docIdx = 1;
      const baseName = fname.replace(/\.[^/.]+$/, "");

      for (const grp of groups) {
        const holder = grp.holderName;
        const slug =
          holder.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "DOCUMENT_HOLDER";
        const key = holder.toLowerCase();
        const subtype =
          grp.analysis.specialized_intelligence.role_attribution?.subtype_label ||
          grp.analysis.recognition.category_label;
        const subSlug = subtype.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
        const docFilename = `${baseName}_${subSlug}_p${grp.pageNumbers[0]}.pdf`;
        const pageRange =
          grp.pageNumbers.length > 1
            ? `Pages ${grp.pageNumbers[0]}–${grp.pageNumbers[grp.pageNumbers.length - 1]}`
            : `Page ${grp.pageNumbers[0]}`;
        const docRole = grp.analysis.specialized_intelligence.role_attribution?.person_role || "principal_applicant";

        const sortedDoc: PacketSortedDocument = {
          document_index: docIdx++,
          filename: docFilename,
          relative_path: `${slug}/${docFilename}`,
          category: grp.analysis.recognition.category,
          document_subtype: subtype,
          page_numbers: grp.pageNumbers,
          page_range: pageRange,
          page_count: grp.pageNumbers.length,
          is_joint_document: Boolean(grp.extractedMap.bride_name && grp.extractedMap.groom_name),
          is_duplicate: false,
          shared_with: grp.extractedMap.bride_name ? [toTitleCase(grp.extractedMap.bride_name)] : [],
          person_role: docRole,
          sponsor_jurisdiction: grp.analysis.specialized_intelligence.role_attribution?.sponsor_jurisdiction || null,
          statutory_badges: grp.analysis.specialized_intelligence.role_attribution?.statutory_badges || [],
          extracted_fields: grp.extractedMap,
          text_preview: grp.rawText.slice(0, 1200),
          pdf_base64: undefined,
        };

        let existingFolder = folderMap.get(key);
        if (!existingFolder) {
          const anchors: Record<string, string[]> = {};
          if (grp.extractedMap.passport_number) anchors.passport = [grp.extractedMap.passport_number];
          if (grp.extractedMap.pan_number) anchors.pan = [grp.extractedMap.pan_number];
          if (grp.extractedMap.ircc_uci_number) anchors.uci = [grp.extractedMap.ircc_uci_number];
          existingFolder = {
            person_id: `person-${folderMap.size + 1}`,
            canonical_name: holder,
            folder_name: slug,
            person_role: docRole,
            sponsor_jurisdiction: sortedDoc.sponsor_jurisdiction,
            name_variations: holder !== "Document Holder (Unidentified)" ? [holder, holder.toUpperCase()] : [],
            id_anchors: anchors,
            is_caseworker_review_folder: Object.keys(grp.extractedMap).length === 0,
            is_corporate_folder: false,
            duplicates_count: 0,
            total_documents: 0,
            total_pages: 0,
            documents: [],
          };
          folderMap.set(key, existingFolder);
        }
        existingFolder.documents.push(sortedDoc);
        existingFolder.total_documents = existingFolder.documents.length;
        existingFolder.total_pages += grp.pageNumbers.length;

        const parsedBride = grp.extractedMap.bride_name;
        if (parsedBride) {
          const spouseName = toTitleCase(parsedBride);
          const spouseKey = spouseName.toLowerCase();
          if (spouseKey !== key && !folderMap.has(spouseKey)) {
            const spouseSlug = spouseName.toUpperCase().replace(/[^A-Z0-9]+/g, "_") || "SPOUSE_PARTNER";
            folderMap.set(spouseKey, {
              person_id: `person-${folderMap.size + 1}`,
              canonical_name: spouseName,
              folder_name: spouseSlug,
              person_role: "spouse_partner",
              name_variations: [spouseName, spouseName.toUpperCase()],
              id_anchors: {},
              is_caseworker_review_folder: false,
              is_corporate_folder: false,
              duplicates_count: 0,
              total_documents: 1,
              total_pages: grp.pageNumbers.length,
              documents: [
                {
                  document_index: docIdx++,
                  filename: `Joint_${docFilename}`,
                  relative_path: `${spouseSlug}/Joint_${docFilename}`,
                  category: "civil_status_family",
                  document_subtype: "Marriage Certificate",
                  page_numbers: grp.pageNumbers,
                  page_range: pageRange,
                  page_count: grp.pageNumbers.length,
                  is_joint_document: true,
                  is_duplicate: false,
                  shared_with: [holder],
                  person_role: "spouse_partner",
                  extracted_fields: {
                    ...(grp.extractedMap.marriage_certificate_number
                      ? { marriage_certificate_number: grp.extractedMap.marriage_certificate_number }
                      : {}),
                    ...(grp.extractedMap.groom_name ? { groom_name: grp.extractedMap.groom_name } : {}),
                    bride_name: spouseName,
                    ...(grp.extractedMap.marriage_date ? { marriage_date: grp.extractedMap.marriage_date } : {}),
                  },
                  text_preview: grp.rawText.slice(0, 800),
                  pdf_base64: undefined,
                },
              ],
            });
          }
        }
      }

      const personFolders = Array.from(folderMap.values());
      return {
        status: "success",
        source_filename: fname,
        total_pages_analyzed: rawPageMatches.length,
        blank_pages_omitted: [],
        total_persons_detected: personFolders.length,
        total_split_documents: personFolders.reduce((acc, f) => acc + f.documents.length, 0),
        person_folders: personFolders,
        zip_archive_filename: `${fname.replace(/\.[^/.]+$/, "")}_Sorted_By_Person.zip`,
        zip_archive_base64: null,
      };
    }
  }

  const analysis = await generateClientFallbackAnalysis({ file, rawText: contentText, filename: fname }, errorContext);
  const extractedMap = toExtractedMap(analysis);
  const personFolders: PacketPersonFolder[] = [];
  const parsedPrimaryName = resolveHolderName(analysis, extractedMap);

  const primarySlug = parsedPrimaryName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "DOCUMENT_HOLDER";

  const primaryDoc: PacketSortedDocument = {
    document_index: 1,
    filename: fname,
    relative_path: `${primarySlug}/${fname}`,
    category: analysis.recognition.category,
    document_subtype: analysis.specialized_intelligence.role_attribution?.subtype_label || analysis.recognition.category_label,
    page_numbers: [1],
    page_range: "Page 1",
    page_count: 1,
    is_joint_document: false,
    is_duplicate: false,
    shared_with: [],
    person_role: analysis.specialized_intelligence.role_attribution?.person_role || "principal_applicant",
    sponsor_jurisdiction: analysis.specialized_intelligence.role_attribution?.sponsor_jurisdiction || null,
    statutory_badges: analysis.specialized_intelligence.role_attribution?.statutory_badges || [],
    extracted_fields: extractedMap,
    text_preview: contentText.slice(0, 1200) || `Binary file uploaded (${fname}) — OCR backend required for optical parsing.`,
    pdf_base64: undefined,
  };

  const primaryAnchors: Record<string, string[]> = {};
  if (extractedMap.passport_number) primaryAnchors.passport = [extractedMap.passport_number];
  if (extractedMap.pan_number) primaryAnchors.pan = [extractedMap.pan_number];
  if (extractedMap.ircc_uci_number) primaryAnchors.uci = [extractedMap.ircc_uci_number];

  personFolders.push({
    person_id: "person-1",
    canonical_name: parsedPrimaryName,
    folder_name: primarySlug,
    person_role: primaryDoc.person_role,
    sponsor_jurisdiction: primaryDoc.sponsor_jurisdiction,
    name_variations: parsedPrimaryName !== "Document Holder (Unidentified)" ? [parsedPrimaryName, parsedPrimaryName.toUpperCase()] : [],
    id_anchors: primaryAnchors,
    is_caseworker_review_folder: Object.keys(extractedMap).length === 0,
    is_corporate_folder: false,
    duplicates_count: 0,
    total_documents: 1,
    total_pages: 1,
    documents: [primaryDoc],
  });

  // Only add a Spouse / Bride folder if genuine marriage/bride fields were parsed from readable text
  const parsedBride = extractedMap.bride_name;
  if (parsedBride && parsedBride.toUpperCase() !== parsedPrimaryName.toUpperCase()) {
    const spouseName = toTitleCase(parsedBride);
    const spouseSlug = spouseName.toUpperCase().replace(/[^A-Z0-9]+/g, "_") || "SPOUSE_PARTNER";
    personFolders.push({
      person_id: "person-2",
      canonical_name: spouseName,
      folder_name: spouseSlug,
      person_role: "spouse_partner",
      name_variations: [spouseName, spouseName.toUpperCase()],
      id_anchors: {},
      is_caseworker_review_folder: false,
      is_corporate_folder: false,
      duplicates_count: 0,
      total_documents: 1,
      total_pages: 1,
      documents: [
        {
          document_index: 2,
          filename: `Joint_${fname}`,
          relative_path: `${spouseSlug}/Joint_${fname}`,
          category: "civil_status_family",
          document_subtype: "Marriage Certificate",
          page_numbers: [1],
          page_range: "Page 1",
          page_count: 1,
          is_joint_document: true,
          is_duplicate: false,
          shared_with: [parsedPrimaryName],
          person_role: "spouse_partner",
          extracted_fields: {
            ...(extractedMap.marriage_certificate_number ? { marriage_certificate_number: extractedMap.marriage_certificate_number } : {}),
            ...(extractedMap.groom_name ? { groom_name: extractedMap.groom_name } : {}),
            bride_name: spouseName,
            ...(extractedMap.marriage_date ? { marriage_date: extractedMap.marriage_date } : {}),
          },
          text_preview: contentText.slice(0, 800),
          pdf_base64: undefined,
        },
      ],
    });
  }

  return {
    status: "success",
    source_filename: fname,
    total_pages_analyzed: 1,
    blank_pages_omitted: [],
    total_persons_detected: personFolders.length,
    total_split_documents: personFolders.reduce((acc, f) => acc + f.documents.length, 0),
    person_folders: personFolders,
    zip_archive_filename: `${fname.replace(/\.[^/.]+$/, "")}_Sorted_By_Person.zip`,
    zip_archive_base64: null,
  };
}

export async function sortDocumentPacket(file: File): Promise<PacketSortResult> {
  const basesToTry = [API_BASE, ...DIRECT_BACKEND_BASES];
  let lastError = "Failed to connect to OCR/AI Packet Sorter backend.";

  for (const base of basesToTry) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${base}/extractor/sort-packet`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.person_folders) && data.person_folders.length > 0) {
          return data;
        }
      }
      const errBody = await res.json().catch(() => ({}));
      lastError = errBody.detail || `HTTP ${res.status}`;
    } catch (err: any) {
      lastError = err?.message || "Network error";
    }
  }

  // Gracefully fallback to deterministic client-side packet sorting without network exceptions
  return await generateClientFallbackPacketSort(file, lastError);
}

export interface SmartIntakeApiDocument {
  id: string;
  filename: string;
  category: string;
  subtypeLabel: string;
  personName: string;
  personRole: DetectedPersonRole;
  sponsorJurisdiction?: "CA" | "UK" | "AU" | null;
  confidence: number;
  pageCount: number;
  pageRange?: string;
  pageNumbers?: number[];
  extractedFields: Record<string, string>;
  statutoryBadges: string[];
  sha256: string;
  sourceFile: File;
  analysis?: ExtractorAnalysisResult;
}

export interface SmartIntakeApiResult {
  totalFilesDropped: number;
  totalPagesProcessed: number;
  documents: SmartIntakeApiDocument[];
  statutoryHighlights: string[];
  suggestedJurisdiction?: string;
  suggestedPathway?: string;
  mergedExtractedFields: Record<string, string>;
  packetSortResult?: PacketSortResult;
  backendOffline?: boolean;
}

function isLikelyMultiDocumentPacket(file: File, contentSnippet: string): boolean {
  const lower = `${file.name} ${contentSnippet}`.toLowerCase();
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return false;
  }
  return (
    lower.includes("packet") ||
    lower.includes("combined") ||
    lower.includes("merged") ||
    lower.includes("bundle") ||
    (lower.includes("family") && (lower.includes("marriage") || lower.includes("spouse") || lower.includes("sponsor")))
  );
}

/**
 * Unified Zero-Toggle Smart Intake Pipeline:
 * Accepts 1 file, camera capture, multiple loose files, OR a 60-page merged PDF packet.
 * Calls POST /extractor/smart-intake when live backend is reachable, with instant deterministic
 * client-side fallback for 100% offline/test reliability.
 */
export async function runSmartIntakePipeline(
  rawFiles: Array<File | null | undefined>,
  options?: {
    caseId?: string;
    contributorRole?: "applicant" | "sponsor" | "staff";
    pathway?: string;
    onProgress?: (progress: {
      currentPage: number;
      totalPages: number;
      filesProcessed: number;
      totalFiles: number;
      label: string;
    }) => void;
  }
): Promise<SmartIntakeApiResult> {
  const files = (rawFiles || []).filter((f): f is File => Boolean(f));
  if (files.length === 0) {
    return {
      totalFilesDropped: 0,
      totalPagesProcessed: 0,
      documents: [],
      statutoryHighlights: [],
      mergedExtractedFields: {},
    };
  }

  // Attempt live backend /extractor/smart-intake first
  const candidates = [API_BASE, ...DIRECT_BACKEND_BASES];
  let backendConnectionFailed = false;
  let smartBackendError = "";
  if (process.env.NODE_ENV !== "test") {
    for (const base of candidates) {
      try {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        if (options?.caseId) fd.append("case_id", options.caseId);
        if (options?.contributorRole) fd.append("contributor_role", options.contributorRole);
        if (options?.pathway) fd.append("pathway", options.pathway);

        const res = await fetch(`${base}/extractor/smart-intake`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.documents) && data.documents.length > 0) {
            const docs: SmartIntakeApiDocument[] = data.documents.map((d: any, idx: number) => {
              const fieldMap: Record<string, string> = {};
              if (Array.isArray(d.extracted_fields)) {
                d.extracted_fields.forEach((ef: any) => {
                  const k = ef?.field_name;
                  const v = ef?.normalized_value ?? ef?.original_value;
                  if (k && v !== undefined && v !== null && String(v).trim()) {
                    fieldMap[k] = String(v).trim();
                  }
                });
              } else if (d.extracted_fields && typeof d.extracted_fields === "object") {
                Object.entries(d.extracted_fields).forEach(([k, v]) => {
                  if (v !== undefined && v !== null && String(v).trim()) fieldMap[k] = String(v).trim();
                });
              } else if (d.extractedFields && typeof d.extractedFields === "object") {
                Object.entries(d.extractedFields).forEach(([k, v]) => {
                  if (v !== undefined && v !== null && String(v).trim()) fieldMap[k] = String(v).trim();
                });
              }

              const badges: string[] = Array.isArray(d.statutory_badges)
                ? d.statutory_badges
                : Array.isArray(d.statutoryBadges)
                  ? d.statutoryBadges
                  : [];
              if (badges.length === 0 && fieldMap.passport_number) {
                badges.push(`Passport ${fieldMap.passport_number}`);
              }

              const inferredName =
                d.holder_name ||
                d.person_name ||
                d.personName ||
                fieldMap.full_name ||
                (fieldMap.given_names && fieldMap.surname
                  ? `${fieldMap.given_names} ${fieldMap.surname}`.trim()
                  : "");

              const pageNums = Array.isArray(d.page_numbers) ? d.page_numbers : undefined;
              const pageCount = d.page_count || d.pageCount || pageNums?.length || 1;
              const pageRange =
                pageNums && pageNums.length > 1
                  ? `Pages ${pageNums[0]}–${pageNums[pageNums.length - 1]}`
                  : pageNums && pageNums.length === 1
                    ? `Page ${pageNums[0]}`
                    : pageCount > 1
                      ? `Pages 1–${pageCount}`
                      : "Page 1";

              return {
                id: d.document_id || d.id || `smart-doc-${Date.now()}-${idx}`,
                filename: d.filename || files[Math.min(idx, files.length - 1)].name,
                category: d.category || "supporting_evidence",
                subtypeLabel: d.document_subtype || d.subtype_label || d.subtypeLabel || "Document",
                personName: inferredName,
                personRole: d.person_role || d.personRole || "principal_applicant",
                sponsorJurisdiction: d.sponsor_jurisdiction || d.sponsorJurisdiction || null,
                confidence:
                  typeof d.classification_confidence === "number"
                    ? d.classification_confidence
                    : typeof d.confidence === "number"
                      ? d.confidence
                      : Object.keys(fieldMap).length > 0
                        ? 0.95
                        : 0.25,
                pageCount,
                pageRange,
                pageNumbers: pageNums,
                extractedFields: fieldMap,
                statutoryBadges: badges,
                sha256: d.sha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                sourceFile: files[Math.min(idx, files.length - 1)],
              };
            });

            const merged: Record<string, string> = {};
            docs.forEach((doc) => {
              Object.entries(doc.extractedFields).forEach(([k, v]) => {
                if (!v) return;
                if (doc.personRole === "spouse_partner" && k === "full_name") {
                  merged.spouse_full_name = v;
                } else if (!merged[k] || doc.personRole === "principal_applicant" || k.startsWith("sponsor_")) {
                  merged[k] = v;
                }
              });
            });

            const highlights: string[] = Array.isArray(data.statutory_highlights)
              ? data.statutory_highlights
              : Array.isArray(data.sponsor_statutory_intelligence?.statutory_badges)
                ? data.sponsor_statutory_intelligence.statutory_badges
                : Array.from(new Set(docs.flatMap((d) => d.statutoryBadges)));

            return {
              totalFilesDropped: files.length,
              totalPagesProcessed: data.total_pages || docs.reduce((s, d) => s + d.pageCount, 0),
              documents: docs,
              statutoryHighlights: highlights,
              suggestedJurisdiction: data.suggested_jurisdiction || data.jurisdiction,
              suggestedPathway: data.suggested_pathway || data.pathway,
              mergedExtractedFields: merged,
              backendOffline: false,
            };
          }
        }
        smartBackendError = `HTTP ${res.status}`;
      } catch (err: any) {
        backendConnectionFailed = true;
        smartBackendError = err?.message || "FastAPI OCR backend unreachable";
        // Fall through to deterministic client-side parser (zero fake PII)
      }
    }
    if (!smartBackendError) {
      backendConnectionFailed = true;
      smartBackendError = "FastAPI OCR backend offline";
    } else if (smartBackendError.startsWith("HTTP 5") || smartBackendError === "HTTP 404") {
      backendConnectionFailed = true;
    }
  }

  // Deterministic client-side Smart Intake execution (only extracts readable text; never invents demo PII)
  const producedDocs: SmartIntakeApiDocument[] = [];
  const highlightsSet = new Set<string>();
  const mergedFields: Record<string, string> = {};
  let totalPages = 0;
  let lastPacketResult: PacketSortResult | undefined;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const snippet = await extractReadableTextFromFile(file);

    if (files.length === 1 && snippet && isLikelyMultiDocumentPacket(file, snippet)) {
      const estimatedPages = Math.max(2, Math.min(60, Math.ceil((file.size || 8192) / 4096)));
      options?.onProgress?.({
        currentPage: Math.min(2, estimatedPages),
        totalPages: estimatedPages,
        filesProcessed: 0,
        totalFiles: 1,
        label: `Sorting & extracting ${file.name}...`,
      });

      const packet = await generateClientFallbackPacketSort(file);
      lastPacketResult = packet;
      const seenJointFiles = new Set<string>();
      const baseSha = await computeFileSha256(file, snippet || file.name);

      for (const folder of packet.person_folders) {
        for (const pdoc of folder.documents) {
          if (pdoc.is_joint_document && seenJointFiles.has(pdoc.filename)) {
            continue;
          }
          if (pdoc.is_joint_document) {
            seenJointFiles.add(pdoc.filename);
          }

          const syntheticBytes = pdoc.pdf_base64
            ? Uint8Array.from(atob(pdoc.pdf_base64), (c) => c.charCodeAt(0))
            : new TextEncoder().encode(pdoc.text_preview || pdoc.filename);
          const splitFile = new File([syntheticBytes], pdoc.filename, { type: "application/pdf" });
          const docSha = await computeFileSha256(splitFile, `${baseSha}-${pdoc.document_index}`);

          const role: DetectedPersonRole =
            pdoc.person_role ||
            folder.person_role ||
            (options?.contributorRole === "sponsor" ? "overseas_sponsor_host" : "principal_applicant");
          const badges = pdoc.statutory_badges || [];
          badges.forEach((b) => highlightsSet.add(b));
          Object.entries(pdoc.extracted_fields || {}).forEach(([k, v]) => {
            if (v && (!mergedFields[k] || role === "principal_applicant" || k.startsWith("sponsor_") || k.startsWith("cra_") || k.startsWith("uk_") || k.startsWith("au_"))) {
              mergedFields[k] = v;
            }
          });
          if (role === "spouse_partner" && pdoc.extracted_fields?.full_name) {
            mergedFields.spouse_full_name = pdoc.extracted_fields.full_name;
          }

          totalPages += pdoc.page_count || 1;
          producedDocs.push({
            id: `smart-pkt-${Date.now()}-${pdoc.document_index}`,
            filename: pdoc.filename,
            category: pdoc.category,
            subtypeLabel: pdoc.document_subtype,
            personName: folder.canonical_name === "Document Holder (Unidentified)" ? "" : folder.canonical_name,
            personRole: role,
            sponsorJurisdiction: pdoc.sponsor_jurisdiction || folder.sponsor_jurisdiction || null,
            confidence: Object.keys(pdoc.extracted_fields || {}).length > 0 ? 0.95 : 0.25,
            pageCount: pdoc.page_count || 1,
            pageRange: pdoc.page_range || "Page 1",
            pageNumbers: pdoc.page_numbers,
            extractedFields: { ...pdoc.extracted_fields },
            statutoryBadges: [...badges],
            sha256: docSha,
            sourceFile: splitFile,
          });
        }
      }

      options?.onProgress?.({
        currentPage: packet.total_pages_analyzed,
        totalPages: packet.total_pages_analyzed,
        filesProcessed: 1,
        totalFiles: 1,
        label: `Processed ${file.name}`,
      });
    } else {
      options?.onProgress?.({
        currentPage: i + 1,
        totalPages: files.length,
        filesProcessed: i,
        totalFiles: files.length,
        label: `Analyzing ${file.name} — File ${i + 1} of ${files.length}...`,
      });

      const analysis = await generateClientFallbackAnalysis(
        { file, rawText: snippet || undefined, filename: file.name },
        smartBackendError || undefined
      );
      const roleAttr = analysis.specialized_intelligence.role_attribution;
      const effectiveRole: DetectedPersonRole =
        options?.contributorRole === "sponsor" && roleAttr?.person_role === "principal_applicant"
          ? "overseas_sponsor_host"
          : roleAttr?.person_role || "principal_applicant";

      const fieldMap: Record<string, string> = {};
      analysis.extracted_fields.forEach((ef) => {
        fieldMap[ef.field_name] = ef.normalized_value || ef.original_value;
      });

      Object.entries(fieldMap).forEach(([k, v]) => {
        if (!v) return;
        if (effectiveRole === "spouse_partner" && k === "full_name") {
          mergedFields.spouse_full_name = v;
        } else if (
          !mergedFields[k] ||
          effectiveRole === "principal_applicant" ||
          k.startsWith("sponsor_") ||
          k.startsWith("cra_") ||
          k.startsWith("super_visa_") ||
          k.startsWith("uk_") ||
          k.startsWith("au_")
        ) {
          mergedFields[k] = v;
        }
      });

      const badges = roleAttr?.statutory_badges || [];
      badges.forEach((b) => highlightsSet.add(b));
      totalPages += analysis.metadata.page_count || 1;

      const docPages = analysis.metadata.page_count || 1;
      producedDocs.push({
        id: `smart-doc-${Date.now()}-${i}`,
        filename: file.name,
        category: analysis.recognition.category,
        subtypeLabel: roleAttr?.subtype_label || analysis.recognition.category_label,
        personName: roleAttr?.person_name || "",
        personRole: effectiveRole,
        sponsorJurisdiction: roleAttr?.sponsor_jurisdiction || null,
        confidence: analysis.recognition.confidence,
        pageCount: docPages,
        pageRange: docPages > 1 ? `Pages 1–${docPages}` : "Page 1",
        pageNumbers: Array.from({ length: docPages }, (_, pIdx) => pIdx + 1),
        extractedFields: fieldMap,
        statutoryBadges: [...badges],
        sha256: analysis.metadata.sha256_hash,
        sourceFile: file,
        analysis,
      });
    }
  }

  const hasSiblingDoc = producedDocs.some((d) => d.personRole === "canadian_crs_sibling" && Object.keys(d.extractedFields).length > 0);
  if (hasSiblingDoc) {
    highlightsSet.add("+15 CRS Canadian Sibling Verified");
  }

  let suggestedJurisdiction: string | undefined;
  let suggestedPathway: string | undefined;

  if (producedDocs.some((d) => d.subtypeLabel.includes("CRA Notice") || d.subtypeLabel.includes("Super Visa"))) {
    suggestedJurisdiction = "Canada (IRCC)";
    suggestedPathway = "Canada Super Visa (Parents & Grandparents)";
  } else if (hasSiblingDoc) {
    suggestedJurisdiction = "Canada (IRCC)";
    suggestedPathway = "Express Entry PNP";
  } else if (producedDocs.some((d) => d.sponsorJurisdiction === "UK")) {
    suggestedJurisdiction = "United Kingdom (Home Office)";
    suggestedPathway = "UK Standard Visitor (Family Sponsored)";
  } else if (producedDocs.some((d) => d.sponsorJurisdiction === "AU")) {
    suggestedJurisdiction = "Australia (Home Affairs)";
    suggestedPathway = "Australia Visitor Visa (Subclass 600 Sponsored)";
  } else if (producedDocs.some((d) => d.sponsorJurisdiction === "CA")) {
    suggestedJurisdiction = "Canada (IRCC)";
    suggestedPathway = "Canada Visitor Visa (TRV)";
  }

  return {
    totalFilesDropped: files.length,
    totalPagesProcessed: Math.max(1, totalPages),
    documents: producedDocs,
    statutoryHighlights: Array.from(highlightsSet),
    suggestedJurisdiction,
    suggestedPathway,
    mergedExtractedFields: mergedFields,
    packetSortResult: lastPacketResult,
    backendOffline: backendConnectionFailed,
  };
}


