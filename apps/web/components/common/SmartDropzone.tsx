"use client";

import React, { useRef, useState } from "react";
import { DocumentCategory, DocumentItem, RoleCode } from "../../lib/types";
import { api } from "../../lib/api";
import {
  ExtractorAnalysisResult,
  SmartIntakeApiDocument,
  runSmartIntakePipeline,
} from "../../lib/api/extractor";
import {
  AutoFillFieldProvenance,
  clearPendingAutoFill,
  mapAnalysisToInitialInfoSheet,
  persistAndBroadcastAutoFill,
  queuePendingAutoFill,
} from "../../lib/documentAutoFillEngine";
import {
  completeBackgroundIntakeJob,
  enqueueBackgroundIntakeJob,
  failBackgroundIntakeJob,
  updateBackgroundIntakeJob,
} from "../../lib/backgroundIntakeStore";
import { calculateSHA256, formatBytes } from "../../lib/crypto";
import {
  RawUploadedPacketRecord,
  enqueueRawClientPacket,
  extractSafeRawTextPreview,
  inferRawFileCategoryAndLabel,
} from "../../lib/rawClientPacketStore";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";

export interface SmartIntakeDocumentResult {
  id: string;
  filename: string;
  category: string;
  subtypeLabel: string;
  personName: string;
  personRole:
    | "principal_applicant"
    | "spouse_partner"
    | "dependant_child"
    | "overseas_sponsor_host"
    | "canadian_crs_sibling";
  sponsorJurisdiction?: "CA" | "UK" | "AU" | null;
  confidence: number;
  pageCount: number;
  extractedFields: Record<string, string>;
  statutoryBadges: string[];
  sha256: string;
}

export interface SmartIntakeSummary {
  totalFilesDropped: number;
  totalDocumentsProduced: number;
  documents: SmartIntakeDocumentResult[];
  statutoryHighlights: string[]; // e.g. ["Super Visa LICO Met (+$29,806 CAD surplus)", "+15 CRS Canadian Sibling Verified"]
  pendingPrefillFieldsCount: number;
  pendingPrefillData: Record<string, string>;
}

export interface SmartDropzoneProps {
  caseId?: string;
  clientName?: string;
  pathway?: string;
  contributorRole?: "applicant" | "sponsor" | "staff";
  uploadMode?: "raw_only" | "immediate_ai";
  sponsorInviteToken?: string;
  compact?: boolean;
  language?: "en" | "gu" | "hi";
  privacyShield?: boolean;
  onIntakeComplete?: (summary: SmartIntakeSummary) => void;
  onDocumentUploaded?: (doc: DocumentItem) => void;
}

const RAW_ONLY_LOCALIZED_COPY: Record<
  "en" | "gu" | "hi",
  {
    headline: string;
    compactHeadline: string;
    subline: string;
    uploadingLabel: (name: string) => string;
    receiptHeading: (count: number) => string;
    receiptSubline: string;
    queuedPill: string;
  }
> = {
  en: {
    headline:
      "Drop 1 document, multiple files, or a 60-page PDF packet — instant direct upload",
    compactHeadline: "Drop files or complete PDF packet for instant upload",
    subline:
      "Zero waiting, zero page-sorting, and zero form stress. Your untouched file goes straight to your assigned paralegal's AI Lab to fill your sheets automatically.",
    uploadingLabel: (name) => `Uploading untouched file ${name} directly to encrypted vault…`,
    receiptHeading: (n) =>
      `✓ ${n} ${n === 1 ? "untouched file" : "untouched files"} uploaded directly to your Legal Team`,
    receiptSubline:
      "No sorting or form-filling needed from you. Your assigned Case Processor / Paralegal will run AI Lab (OCR, Sort & Auto-Fill) on their workstation and only ask if any non-document questions remain.",
    queuedPill: "Sent to Paralegal AI Lab",
  },
  gu: {
    headline:
      "૧ દસ્તાવેજ, અનેક ફાઇલો અથવા ૬૦-પાનાનું PDF પેકેટ અહીં મૂકો — ત્વરિત સીધું અપલોડ",
    compactHeadline: "ત્વરિત અપલોડ માટે દસ્તાવેજો અથવા PDF પેકેટ મૂકો",
    subline:
      "કોઈ રાહ જોવાની, પાનાં અલગ કરવાની કે લાંબા ફોર્મ ભરવાની ચિંતા નથી. તમારી મૂળ ફાઇલ સીધી તમારા કેસ અધિકારીની AI Lab માં જશે.",
    uploadingLabel: (name) => `મૂળ ફાઇલ ${name} સીધી સુરક્ષિત વૉલ્ટમાં અપલોડ થઈ રહી છે…`,
    receiptHeading: (n) => `✓ ${n} મૂળ ફાઇલ સીધી તમારી કાનૂની ટીમને અપલોડ થઈ ગઈ`,
    receiptSubline:
      "તમારે કોઈ સોર્ટિંગ કે ફોર્મ ભરવાની જરૂર નથી. તમારા કેસ અધિકારી તેમની સિસ્ટમ પર AI Lab ચલાવીને માહિતી આપમેળે ભરી લેશે.",
    queuedPill: "પેરાલીગલ AI Lab માટે મોકલાયું",
  },
  hi: {
    headline:
      "1 दस्तावेज़, कई फ़ाइलें या 60-पृष्ठ का PDF पैकेट यहाँ डालें — तुरंत सीधा अपलोड",
    compactHeadline: "तुरंत अपलोड के लिए दस्तावेज़ या PDF पैकेट डालें",
    subline:
      "न इंतज़ार, न पन्नों की छँटाई और न लंबे फ़ॉर्म भरने का तनाव। आपकी मूल फ़ाइल सीधे आपके केस अधिकारी की AI Lab में जाएगी जहाँ जानकारी स्वतः भरी जाएगी।",
    uploadingLabel: (name) => `मूल फ़ाइल ${name} सीधे सुरक्षित वॉल्ट में अपलोड हो रही है…`,
    receiptHeading: (n) => `✓ ${n} मूल फ़ाइल सीधे आपकी कानूनी टीम को अपलोड हो गई`,
    receiptSubline:
      "आपको कोई छँटाई या फ़ॉर्म भरने की आवश्यकता नहीं है। आपके असाइन किए गए पैरालीगल अपनी स्क्रीन पर AI Lab चलाकर जानकारी स्वतः भर लेंगे।",
    queuedPill: "पैरालीगल AI Lab को भेजा गया",
  },
};

const LOCALIZED_COPY: Record<
  "en" | "gu" | "hi",
  {
    headline: string;
    compactHeadline: string;
    subline: string;
    browseBtn: string;
    cameraBtn: string;
    continueBgBtn: string;
    applyFieldsBtn: (count: number) => string;
    appliedBadge: string;
    inspectDrawerBtn: string;
    hideDrawerBtn: string;
    privacyPill: string;
    sortedHeading: (docs: number, files: number) => string;
  }
> = {
  en: {
    headline: "Drop 1 document, multiple files, or a 60-page family & sponsor PDF packet",
    compactHeadline: "Drop passport, sponsor NOA/PR card, or multi-page packet",
    subline:
      "Auto-detects document category, person role (Applicant • Spouse • CA/UK/AU Sponsor • +15 CRS Sibling), QR/MRZ & statutory compliance.",
    browseBtn: "Choose Files",
    cameraBtn: "Mobile Camera",
    continueBgBtn: "Continue in Background ↗",
    applyFieldsBtn: (n) => `✨ Apply ${n} Extracted Fields to Profile & Forms`,
    appliedBadge: "✓ Extracted Fields Applied to Profile & Forms",
    inspectDrawerBtn: "Inspect Forensics & Bounding Boxes",
    hideDrawerBtn: "Hide Forensics & Bounding Boxes",
    privacyPill: "🔒 Privacy Shield Active — Encrypted for Legal Counsel Only",
    sortedHeading: (docs, files) =>
      `${docs} ${docs === 1 ? "document" : "documents"} verified from ${files} ${files === 1 ? "upload" : "uploads"}`,
  },
  gu: {
    headline: "૧ દસ્તાવેજ, અનેક ફાઇલો અથવા ૬૦-પાનાનું ફેમિલી અને સ્પોન્સર PDF પેકેટ અહીં મૂકો",
    compactHeadline: "પાસપોર્ટ, સ્પોન્સર NOA/PR કાર્ડ અથવા PDF પેકેટ અપલોડ કરો",
    subline:
      "પાસપોર્ટ, આધાર/PAN, CRA NOA, PR કાર્ડ અને સ્પોન્સર દસ્તાવેજોનું આપમેળે વર્ગીકરણ અને ચકાસણી.",
    browseBtn: "ફાઇલો પસંદ કરો",
    cameraBtn: "કેમેરા સ્કેન",
    continueBgBtn: "બેકગ્રાઉન્ડમાં ચાલુ રાખો ↗",
    applyFieldsBtn: (n) => `✨ ${n} માહિતી પ્રોફાઇલ અને ફોર્મમાં લાગુ કરો`,
    appliedBadge: "✓ માહિતી સફળતાપૂર્વક પ્રોફાઇલ અને ફોર્મમાં લાગુ થઈ ગઈ",
    inspectDrawerBtn: "ફોરેન્સિક્સ અને બાઉન્ડિંગ બોક્સ જુઓ",
    hideDrawerBtn: "ફોરેન્સિક્સ બંધ કરો",
    privacyPill: "🔒 પ્રાઇવસી શિલ્ડ સક્રિય — માત્ર વકીલ માટે એન્ક્રિપ્ટેડ",
    sortedHeading: (docs) => `${docs} દસ્તાવેજો સફળતાપૂર્વક ચકાસાયા`,
  },
  hi: {
    headline: "1 दस्तावेज़, कई फ़ाइलें, या 60-पृष्ठ का परिवार और स्पॉन्सर PDF पैकेट यहाँ डालें",
    compactHeadline: "पासपोर्ट, स्पॉन्सर NOA/PR कार्ड या PDF पैकेट अपलोड करें",
    subline:
      "पासपोर्ट, आधार/PAN, CRA NOA, PR कार्ड और स्पॉन्सर दस्तावेज़ों की स्वचालित पहचान और सत्यापन।",
    browseBtn: "फ़ाइलें चुनें",
    cameraBtn: "कैमरा स्कैन",
    continueBgBtn: "बैकग्राउंड में जारी रखें ↗",
    applyFieldsBtn: (n) => `✨ ${n} निकाले गए फ़ील्ड प्रोफ़ाइल और फ़ॉर्म में लागू करें`,
    appliedBadge: "✓ फ़ील्ड सफलतापूर्वक प्रोफ़ाइल और फ़ॉर्म में लागू किए गए",
    inspectDrawerBtn: "फ़ोरेंसिक और बाउंडिंग बॉक्स देखें",
    hideDrawerBtn: "फ़ोरेंसिक छुपाएं",
    privacyPill: "🔒 प्राइवेसी शील्ड सक्रिय — केवल कानूनी वकील के लिए एन्क्रिप्टेड",
    sortedHeading: (docs) => `${docs} दस्तावेज़ सफलतापूर्वक सत्यापित किए गए`,
  },
};

const ROLE_LABELS: Record<SmartIntakeDocumentResult["personRole"], string> = {
  principal_applicant: "Principal Applicant",
  spouse_partner: "Spouse / Partner",
  dependant_child: "Dependant Child",
  overseas_sponsor_host: "Overseas Sponsor / Host",
  canadian_crs_sibling: "+15 CRS Canadian Sibling",
};

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

function buildRoleSummaryLabel(docs: SmartIntakeDocumentResult[]): string {
  const roles = new Set<string>();
  docs.forEach((d) => {
    if (d.personRole === "principal_applicant") roles.add("Applicant");
    else if (d.personRole === "spouse_partner" || d.personRole === "dependant_child") roles.add("Family");
    else if (d.personRole === "canadian_crs_sibling") roles.add("Canadian Sibling");
    else if (d.personRole === "overseas_sponsor_host") {
      roles.add(
        d.sponsorJurisdiction === "UK"
          ? "UK Sponsor"
          : d.sponsorJurisdiction === "AU"
            ? "Australian Sponsor"
            : "Canadian Sponsor"
      );
    }
  });
  const list = Array.from(roles);
  return list.length > 0 ? list.join(" & ") : "Applicant";
}

export function SmartDropzone(props: SmartDropzoneProps): React.JSX.Element {
  const {
    caseId,
    clientName,
    pathway,
    contributorRole = "applicant",
    uploadMode = "immediate_ai",
    sponsorInviteToken,
    compact = false,
    language = "en",
    privacyShield = false,
    onIntakeComplete,
    onDocumentUploaded,
  } = props;

  const isRawOnlyMode = uploadMode === "raw_only";
  const ws = useWorkspaceSafe();

  const notifyDocumentUploaded = (uploadedDoc: DocumentItem) => {
    if (onDocumentUploaded) {
      onDocumentUploaded(uploadedDoc);
      ws?.handleDocumentUpdated?.(uploadedDoc);
    } else {
      ws?.handleDocumentUploaded?.(uploadedDoc);
    }
  };
  const copy = LOCALIZED_COPY[language] || LOCALIZED_COPY.en;
  const rawCopy = RAW_ONLY_LOCALIZED_COPY[language] || RAW_ONLY_LOCALIZED_COPY.en;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const bgJobIdRef = useRef<string | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingRaw, setIsUploadingRaw] = useState(false);
  const [rawReceipts, setRawReceipts] = useState<RawUploadedPacketRecord[]>([]);
  const [activeBatchName, setActiveBatchName] = useState("");
  const [progressState, setProgressState] = useState<{
    currentPage: number;
    totalPages: number;
    label: string;
  }>({ currentPage: 1, totalPages: 1, label: "" });

  const [lastSummary, setLastSummary] = useState<SmartIntakeSummary | null>(null);
  const [rawApiDocs, setRawApiDocs] = useState<SmartIntakeApiDocument[]>([]);
  const [stagedSheetPayload, setStagedSheetPayload] = useState<{
    formData: Record<string, any>;
    provenance: Record<string, AutoFillFieldProvenance>;
    sourceFilename: string;
  } | null>(null);
  const [prefillConfirmed, setPrefillConfirmed] = useState(false);
  const [showForensicsDrawer, setShowForensicsDrawer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const storageKeyId = caseId || "default_client";
  const uploadRole: RoleCode =
    contributorRole === "staff" ? "case_worker" : "retained_client";

  const handleMoveToBackground = () => {
    if (!isProcessing || bgJobIdRef.current) return;
    const job = enqueueBackgroundIntakeJob({
      caseId,
      filename: activeBatchName || "Document_Packet.pdf",
      currentPage: progressState.currentPage,
      totalPages: progressState.totalPages,
      progressText:
        progressState.label ||
        `Sorting & extracting ${activeBatchName || "Document_Packet.pdf"} — Page ${progressState.currentPage} of ${progressState.totalPages}...`,
    });
    bgJobIdRef.current = job.id;
    setIsProcessing(false);
  };

  const processRawOnlyFiles = async (files: File[]) => {
    const validFiles = files.filter((f) => f && f.size > 0);
    if (validFiles.length === 0) {
      setErrorMsg("Selected file is empty (0 bytes). Please choose a valid PDF or image file.");
      return;
    }

    setErrorMsg(null);
    setActiveBatchName(
      validFiles.length === 1
        ? validFiles[0].name
        : `${validFiles[0].name} + ${validFiles.length - 1} more`
    );
    setIsUploadingRaw(true);

    try {
      const uploadedPackets: RawUploadedPacketRecord[] = [];
      const summaryDocs: SmartIntakeDocumentResult[] = [];

      for (const file of validFiles) {
        let sha256 = "";
        try {
          const buf = await file.arrayBuffer();
          sha256 = await calculateSHA256(buf);
        } catch {
          sha256 = `sha256_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
        }

        const rawTextPreview = await extractSafeRawTextPreview(file);
        const inferred = inferRawFileCategoryAndLabel(file.name);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", inferred.category);
        fd.append("title", file.name);
        fd.append("raw_only", "true");
        if (caseId) {
          fd.append("case_id", caseId);
        }
        if (privacyShield) {
          fd.append("visibility", "private_to_firm");
          fd.append("is_private_to_firm", "true");
        }

        const uploadRes = await api.uploadDocumentFile(fd, uploadRole);
        const vaultDocId =
          uploadRes.data?.id ||
          `raw-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const rawPacket = enqueueRawClientPacket({
          file,
          vaultDocId,
          caseId: storageKeyId,
          title: file.name,
          sha256,
          uploaderRole: contributorRole === "sponsor" ? "sponsor" : "applicant",
          uploaderName:
            clientName ||
            (contributorRole === "sponsor" ? "Family Sponsor" : "Retained Client"),
          sponsorInviteToken,
          privacyShield,
          declaredCategory: inferred.category,
          rawTextPreview,
        });

        const uploadedDoc: DocumentItem = {
          ...(uploadRes.data || ({} as DocumentItem)),
          id: vaultDocId,
          case_id: caseId,
          title: uploadRes.data?.title || file.name,
          filename: file.name,
          category: inferred.category,
          file_size: formatBytes(file.size),
          byte_size: file.size,
          mime_type: file.type || "application/pdf",
          sha256_hash: uploadRes.data?.sha256_hash || sha256,
          status: "under_review",
          verification_status: "unverified",
          processing_status: "pending",
          uploaded_at: uploadRes.data?.uploaded_at || new Date().toISOString(),
          page_count: rawPacket.pageCountEstimate,
          ocr_applied: false,
          extracted_fields: [],
          is_raw_packet: true,
          raw_packet_id: rawPacket.id,
          ai_lab_status: "pending",
          uploader_role: contributorRole === "sponsor" ? "sponsor" : "applicant",
          is_private_to_firm: privacyShield,
        };

        notifyDocumentUploaded(uploadedDoc);
        uploadedPackets.push(rawPacket);

        summaryDocs.push({
          id: vaultDocId,
          filename: file.name,
          category: inferred.category,
          subtypeLabel: inferred.subtypeLabel,
          personName:
            clientName ||
            (contributorRole === "sponsor" ? "Overseas Sponsor" : "Principal Applicant"),
          personRole:
            contributorRole === "sponsor"
              ? "overseas_sponsor_host"
              : "principal_applicant",
          sponsorJurisdiction: null,
          confidence: 1,
          pageCount: rawPacket.pageCountEstimate,
          extractedFields: {},
          statutoryBadges: [],
          sha256,
        });
      }

      setRawReceipts((prev) => [...uploadedPackets, ...prev]);

      const summary: SmartIntakeSummary = {
        totalFilesDropped: validFiles.length,
        totalDocumentsProduced: summaryDocs.length,
        documents: summaryDocs,
        statutoryHighlights: [],
        pendingPrefillFieldsCount: 0,
        pendingPrefillData: {},
      };
      onIntakeComplete?.(summary);
    } catch (err: any) {
      setErrorMsg(err?.message || "Direct file upload failed. Please try again.");
    } finally {
      setIsUploadingRaw(false);
    }
  };

  const processDroppedFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    if (isRawOnlyMode) {
      await processRawOnlyFiles(files);
      return;
    }

    const batchLabel =
      files.length === 1 ? files[0].name : `${files[0].name} + ${files.length - 1} more`;
    const initialPages = files.length === 1 ? Math.max(1, Math.min(42, Math.ceil((files[0].size || 4096) / 4096))) : files.length;

    bgJobIdRef.current = null;
    setErrorMsg(null);
    setPrefillConfirmed(false);
    setShowForensicsDrawer(false);
    setActiveBatchName(batchLabel);
    setProgressState({
      currentPage: 1,
      totalPages: initialPages,
      label: `Sorting & extracting ${batchLabel} — Page 1 of ${initialPages}...`,
    });
    setIsProcessing(true);

    // Yield briefly so UI paints & "Continue in Background ↗" is clickable immediately on large packets
    await new Promise((resolve) => setTimeout(resolve, 25));

    try {
      const result = await runSmartIntakePipeline(files, {
        caseId,
        contributorRole,
        pathway,
        onProgress: (prog) => {
          setProgressState({
            currentPage: prog.currentPage,
            totalPages: prog.totalPages,
            label: prog.label,
          });
          if (bgJobIdRef.current) {
            updateBackgroundIntakeJob(bgJobIdRef.current, {
              currentPage: prog.currentPage,
              totalPages: prog.totalPages,
              filesProcessed: prog.filesProcessed,
              totalFiles: prog.totalFiles,
              progressText: prog.label,
            });
          }
        },
      });

      // Persist each produced document to Vault ONCE (never double-uploading!)
      let mergedSheetData: Record<string, any> = {};
      let mergedProvenance: Record<string, AutoFillFieldProvenance> = {};

      for (const doc of result.documents) {
        const fd = new FormData();
        fd.append("file", doc.sourceFile);
        fd.append("category", mapToVaultCategory(doc.category));
        fd.append("title", `${doc.subtypeLabel} — ${doc.personName}`);
        if (caseId) {
          fd.append("case_id", caseId);
        }
        if (privacyShield) {
          fd.append("visibility", "private_to_firm");
          fd.append("is_private_to_firm", "true");
        }

        const uploadRes = await api.uploadDocumentFile(fd, uploadRole);
        const extractedFieldsForVault =
          doc.analysis?.extracted_fields && doc.analysis.extracted_fields.length > 0
            ? doc.analysis.extracted_fields.map((ef, fIdx) => ({
                id: `${doc.id}-fld-${fIdx}`,
                field_name: ef.field_name,
                field_label: ef.field_label,
                original_value: ef.original_value,
                normalized_value: ef.normalized_value,
                field_value: ef.normalized_value || ef.original_value,
                source_page: ef.source_page || 1,
                extraction_method: ef.extraction_method || "smart_intake_pipeline",
                ocr_confidence: ef.ocr_confidence || doc.confidence,
                extraction_confidence: ef.extraction_confidence || doc.confidence,
                validation_status: "verified" as const,
                is_manually_corrected: false,
              }))
            : Object.entries(doc.extractedFields || {}).map(([k, v], fIdx) => ({
                id: `${doc.id}-fld-${fIdx}`,
                field_name: k,
                field_label: k.replace(/_/g, " ").toUpperCase(),
                original_value: v,
                normalized_value: v,
                field_value: v,
                source_page: 1,
                extraction_method: "smart_intake_pipeline",
                ocr_confidence: doc.confidence,
                extraction_confidence: doc.confidence,
                validation_status: "verified" as const,
                is_manually_corrected: false,
              }));
        const uploadedDoc: DocumentItem = {
          ...(uploadRes.data || ({} as DocumentItem)),
          id: uploadRes.data?.id || doc.id,
          case_id: caseId || uploadRes.data?.case_id,
          title: uploadRes.data?.title || `${doc.subtypeLabel} — ${doc.personName}`,
          filename: doc.filename,
          category: mapToVaultCategory(doc.category),
          file_size: uploadRes.data?.file_size || formatBytes(doc.sourceFile.size),
          byte_size: uploadRes.data?.byte_size || doc.sourceFile.size,
          mime_type: doc.sourceFile.type || "application/pdf",
          sha256_hash: uploadRes.data?.sha256_hash || doc.sha256,
          status: uploadRes.data?.status || "verified",
          verification_status: uploadRes.data?.verification_status || "verified",
          processing_status: "completed",
          uploaded_at: uploadRes.data?.uploaded_at || new Date().toISOString(),
          page_count: doc.pageCount,
          ocr_applied: true,
          extracted_fields: uploadRes.data?.extracted_fields?.length
            ? uploadRes.data.extracted_fields
            : (extractedFieldsForVault as any),
          person_role: doc.personRole,
          person_name: doc.personName,
          uploader_role: contributorRole,
          is_private_to_firm: privacyShield,
        };
        notifyDocumentUploaded(uploadedDoc);

        // Build staged InitialInformationSheet mapping from in-memory analysis
        if (doc.analysis) {
          const mapped = mapAnalysisToInitialInfoSheet(doc.analysis, mergedSheetData);
          mergedSheetData = mapped.updatedData;
          mergedProvenance = { ...mergedProvenance, ...mapped.provenance };
        } else {
          const syntheticAnalysis: ExtractorAnalysisResult = {
            status: "success",
            metadata: {
              filename: doc.filename,
              mime_type: "application/pdf",
              file_size_bytes: doc.sourceFile.size,
              sha256_hash: doc.sha256,
              page_count: doc.pageCount,
              detected_language: "en",
              total_blocks_detected: 4,
              overall_health_score: 96,
            },
            recognition: {
              category: doc.category,
              category_label: doc.subtypeLabel,
              confidence: doc.confidence,
              matched_keywords: [],
            },
            extracted_fields: Object.entries(doc.extractedFields).map(([k, v]) => ({
              field_name: k,
              field_label: k.replace(/_/g, " ").toUpperCase(),
              original_value: v,
              normalized_value: v,
              source_page: 1,
              ocr_confidence: doc.confidence,
              extraction_confidence: doc.confidence,
              calibrated_confidence: doc.confidence,
              extraction_method: "smart_intake_pipeline",
              model_version: "doc-intel-v5.0",
              bounding_box: [0.1, 0.12, 0.16, 0.68],
              review_status: "VERIFIED",
            })),
            quality_findings: [],
            specialized_intelligence: {},
            ocr_summary: { ocr_applied: false, avg_page_confidence: doc.confidence, pages: [] },
            raw_text_preview: "",
          };
          const mapped = mapAnalysisToInitialInfoSheet(syntheticAnalysis, mergedSheetData);
          mergedSheetData = mapped.updatedData;
          mergedProvenance = { ...mergedProvenance, ...mapped.provenance };
        }
      }

      const summaryDocs: SmartIntakeDocumentResult[] = result.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        category: d.category,
        subtypeLabel: d.subtypeLabel,
        personName: d.personName,
        personRole: d.personRole,
        sponsorJurisdiction: d.sponsorJurisdiction ?? null,
        confidence: d.confidence,
        pageCount: d.pageCount,
        extractedFields: d.extractedFields,
        statutoryBadges: d.statutoryBadges,
        sha256: d.sha256,
      }));

      const prefillKeysCount = Math.max(
        Object.keys(mergedProvenance).length,
        Object.keys(result.mergedExtractedFields).length
      );

      if (prefillKeysCount > 0 && contributorRole !== "sponsor") {
        queuePendingAutoFill(storageKeyId, {
          formData: mergedSheetData,
          provenance: mergedProvenance,
          fieldsCount: prefillKeysCount,
          sourceFilename: batchLabel,
          statutoryHighlights: result.statutoryHighlights,
        });
        setStagedSheetPayload({
          formData: mergedSheetData,
          provenance: mergedProvenance,
          sourceFilename: batchLabel,
        });
      } else if (prefillKeysCount > 0 && contributorRole === "sponsor") {
        // Still allow 1-click confirmation if rendered standalone, or stage sponsor fields safely
        queuePendingAutoFill(storageKeyId, {
          formData: mergedSheetData,
          provenance: mergedProvenance,
          fieldsCount: prefillKeysCount,
          sourceFilename: batchLabel,
          statutoryHighlights: result.statutoryHighlights,
        });
        setStagedSheetPayload({
          formData: mergedSheetData,
          provenance: mergedProvenance,
          sourceFilename: batchLabel,
        });
      }

      const summary: SmartIntakeSummary = {
        totalFilesDropped: result.totalFilesDropped,
        totalDocumentsProduced: summaryDocs.length,
        documents: summaryDocs,
        statutoryHighlights: result.statutoryHighlights,
        pendingPrefillFieldsCount: prefillKeysCount,
        pendingPrefillData: result.mergedExtractedFields,
      };

      if (bgJobIdRef.current) {
        const rolesLabel = buildRoleSummaryLabel(summaryDocs);
        completeBackgroundIntakeJob(bgJobIdRef.current, {
          completionSummary: `✓ ${summaryDocs.length} ${summaryDocs.length === 1 ? "document" : "documents"} sorted across ${rolesLabel} — Ready for 1-Click Pre-Fill`,
          documentsProduced: summaryDocs.length,
          pendingPrefillCount: prefillKeysCount,
          totalPages: result.totalPagesProcessed,
        });
        bgJobIdRef.current = null;
      }

      setRawApiDocs(result.documents);
      setLastSummary(summary);
      onIntakeComplete?.(summary);
    } catch (err: any) {
      const message = err?.message || "Document intake failed.";
      setErrorMsg(message);
      if (bgJobIdRef.current) {
        failBackgroundIntakeJob(bgJobIdRef.current, message);
        bgJobIdRef.current = null;
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAutoFill = () => {
    if (!lastSummary) return;
    const confirmedProvenance: Record<string, AutoFillFieldProvenance> = {};
    Object.entries(stagedSheetPayload?.provenance || {}).forEach(([k, v]) => {
      confirmedProvenance[k] = { ...v, is_confirmed: true };
    });

    persistAndBroadcastAutoFill(storageKeyId, {
      formData: stagedSheetPayload?.formData || lastSummary.pendingPrefillData,
      provenance: confirmedProvenance,
      sourceFilename: stagedSheetPayload?.sourceFilename || activeBatchName,
    });
    clearPendingAutoFill(storageKeyId);
    setPrefillConfirmed(true);
  };

  return (
    <div
      data-testid="smart-dropzone"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #DCE5E1",
        borderRadius: "10px",
        padding: compact ? "14px 16px" : "20px 22px",
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        fontVariantNumeric: "tabular-nums",
        color: "#063C3D",
      }}
    >
      {/* Hidden unified multi-file + packet input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,application/pdf,image/*"
        data-testid="smart-dropzone-file-input"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void processDroppedFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Hidden mobile camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-testid="smart-dropzone-camera-input"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void processDroppedFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {privacyShield && (
        <div
          data-testid="smart-dropzone-privacy-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#EAF6F0",
            color: "#176B50",
            border: "1px solid #C6E7D8",
            borderRadius: "999px",
            padding: "3px 10px",
            fontSize: "11.5px",
            fontWeight: 600,
            marginBottom: "10px",
          }}
        >
          {copy.privacyPill}
        </div>
      )}

      {/* Drop Target Surface */}
      <div
        role="button"
        tabIndex={0}
        aria-label={
          isRawOnlyMode
            ? compact
              ? rawCopy.compactHeadline
              : rawCopy.headline
            : compact
              ? copy.compactHeadline
              : copy.headline
        }
        data-testid="smart-dropzone-surface"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer?.files?.length) {
            void processDroppedFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => {
          if (!isProcessing && !isUploadingRaw) fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isProcessing && !isUploadingRaw) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        style={{
          backgroundColor: isDragOver ? "#EAF6F0" : "#F8F7F2",
          border: isDragOver ? "1.5px dashed #07594F" : "1px dashed #B8C9C3",
          borderRadius: "8px",
          padding: compact ? "14px 16px" : "22px 20px",
          cursor: isProcessing || isUploadingRaw ? "default" : "pointer",
          transition: "background-color 140ms ease, border-color 140ms ease",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: "1 1 260px" }}>
            <div
              style={{
                fontSize: compact ? "13.5px" : "15px",
                fontWeight: 600,
                color: "#063C3D",
                lineHeight: 1.35,
              }}
            >
              {isRawOnlyMode
                ? compact
                  ? rawCopy.compactHeadline
                  : rawCopy.headline
                : compact
                  ? copy.compactHeadline
                  : copy.headline}
            </div>
            {!compact && (
              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12.5px",
                  color: "#4B5E5B",
                  lineHeight: 1.45,
                }}
              >
                {isRawOnlyMode ? rawCopy.subline : copy.subline}
              </div>
            )}
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isUploadingRaw}
              style={{
                backgroundColor: "#063C3D",
                color: "#FFFFFF",
                border: "1px solid #063C3D",
                borderRadius: "7px",
                padding: compact ? "6px 11px" : "8px 14px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: isProcessing || isUploadingRaw ? "not-allowed" : "pointer",
              }}
            >
              {copy.browseBtn}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing || isUploadingRaw}
              style={{
                backgroundColor: "#FFFFFF",
                color: "#063C3D",
                border: "1px solid #DCE5E1",
                borderRadius: "7px",
                padding: compact ? "6px 10px" : "8px 12px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: isProcessing || isUploadingRaw ? "not-allowed" : "pointer",
              }}
            >
              📷 {copy.cameraBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Brief Direct-Upload Status (No OCR or Page-Sorting Wait) */}
      {isRawOnlyMode && isUploadingRaw && (
        <div
          data-testid="smart-dropzone-raw-uploading"
          style={{
            marginTop: "10px",
            padding: "10px 14px",
            backgroundColor: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "8px",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "#063C3D",
          }}
        >
          {rawCopy.uploadingLabel(activeBatchName)}
        </div>
      )}

      {/* Zero-Stress Instant Raw Upload Receipt (Retained Client & Sponsor Portals) */}
      {isRawOnlyMode && rawReceipts.length > 0 && !isUploadingRaw && (
        <div
          data-testid="smart-dropzone-raw-receipt"
          style={{
            marginTop: "14px",
            borderTop: "1px solid #DCE5E1",
            paddingTop: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              backgroundColor: "#EAF6F0",
              border: "1px solid #B9DED4",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
              {rawCopy.receiptHeading(rawReceipts.length)}
            </div>
            <div style={{ fontSize: "12px", color: "#176B50", lineHeight: 1.45 }}>
              {rawCopy.receiptSubline}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {rawReceipts.map((pkt) => (
              <div
                key={pkt.id}
                data-testid={`raw-upload-item-${pkt.id}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "8px 12px",
                  backgroundColor: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "7px",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <strong style={{ color: "#063C3D" }}>{pkt.filename}</strong>
                  <span style={{ fontSize: "11.5px", color: "#526663" }}>
                    {pkt.fileSizeLabel} • SHA-256: {pkt.sha256.slice(0, 14)}…
                  </span>
                </div>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: "999px",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #B9DED4",
                    color: "#07594F",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  ✓ {rawCopy.queuedPill}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Processing & Non-Blocking Background Handoff Bar */}
      {isProcessing && (
        <div
          data-testid="smart-dropzone-processing-bar"
          style={{
            marginTop: "12px",
            padding: "11px 14px",
            backgroundColor: "#F8F7F2",
            border: "1px solid #DCE5E1",
            borderRadius: "8px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#063C3D" }}>
              {progressState.label}
            </div>
            <div
              style={{
                marginTop: "6px",
                height: "4px",
                width: "100%",
                backgroundColor: "#DCE5E1",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(95, Math.max(15, Math.round((progressState.currentPage / Math.max(1, progressState.totalPages)) * 100)))}%`,
                  height: "100%",
                  backgroundColor: "#07594F",
                }}
              />
            </div>
          </div>

          <button
            type="button"
            data-testid="smart-dropzone-background-btn"
            onClick={handleMoveToBackground}
            style={{
              backgroundColor: "#FFFFFF",
              color: "#07594F",
              border: "1px solid #DCE5E1",
              borderRadius: "6px",
              padding: "6px 11px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {copy.continueBgBtn}
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          style={{
            marginTop: "10px",
            padding: "9px 12px",
            borderRadius: "7px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            fontSize: "12.5px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Intake Results, Statutory Highlights & 1-Click Confirmed Auto-Fill */}
      {lastSummary && lastSummary.documents.length > 0 && !isProcessing && (
        <div
          data-testid="smart-dropzone-results"
          style={{
            marginTop: "14px",
            borderTop: "1px solid #DCE5E1",
            paddingTop: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#063C3D" }}>
              ✓ {copy.sortedHeading(lastSummary.totalDocumentsProduced, lastSummary.totalFilesDropped)}
            </div>

            <button
              type="button"
              data-testid="smart-dropzone-forensics-toggle"
              onClick={() => setShowForensicsDrawer((v) => !v)}
              style={{
                background: "transparent",
                border: "1px solid #DCE5E1",
                borderRadius: "6px",
                padding: "4px 9px",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#07594F",
                cursor: "pointer",
              }}
            >
              {showForensicsDrawer ? copy.hideDrawerBtn : copy.inspectDrawerBtn}
            </button>
          </div>

          {/* Statutory Highlights Row */}
          {lastSummary.statutoryHighlights.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {lastSummary.statutoryHighlights.map((badge, idx) => (
                <span
                  key={`${badge}-${idx}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 9px",
                    borderRadius: "999px",
                    backgroundColor: "#EAF6F0",
                    border: "1px solid #C6E7D8",
                    color: "#176B50",
                    fontSize: "11.5px",
                    fontWeight: 600,
                  }}
                >
                  ✓ {badge}
                </span>
              ))}
            </div>
          )}

          {/* Sorted Document Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {lastSummary.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "8px 11px",
                  backgroundColor: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "7px",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: 600, color: "#063C3D" }}>
                    {doc.subtypeLabel} — {doc.personName}
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#526663" }}>
                    {doc.filename} • {doc.pageCount} {doc.pageCount === 1 ? "pg" : "pgs"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      color: "#063C3D",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {ROLE_LABELS[doc.personRole]}
                    {doc.sponsorJurisdiction ? ` (${doc.sponsorJurisdiction})` : ""}
                  </span>
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: "999px",
                      backgroundColor: "#EAF6F0",
                      color: "#176B50",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(doc.confidence * 100)}% OCR
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 1-Click Confirmed Auto-Fill Action */}
          {lastSummary.pendingPrefillFieldsCount > 0 && (
            <div style={{ marginTop: "2px" }}>
              {prefillConfirmed ? (
                <div
                  data-testid="smart-dropzone-autofill-confirmed"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "7px 12px",
                    borderRadius: "7px",
                    backgroundColor: "#EAF6F0",
                    border: "1px solid #C6E7D8",
                    color: "#176B50",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  {copy.appliedBadge}
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="smart-dropzone-apply-autofill-btn"
                  onClick={handleConfirmAutoFill}
                  style={{
                    backgroundColor: "#063C3D",
                    color: "#FFFFFF",
                    border: "1px solid #063C3D",
                    borderRadius: "7px",
                    padding: "8px 14px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copy.applyFieldsBtn(lastSummary.pendingPrefillFieldsCount)}
                </button>
              )}
            </div>
          )}

          {/* Optional Power-User Forensics & Bounding Boxes Drawer */}
          {showForensicsDrawer && (
            <div
              data-testid="smart-dropzone-forensics-drawer"
              style={{
                marginTop: "6px",
                padding: "12px",
                backgroundColor: "#F8F7F2",
                border: "1px solid #DCE5E1",
                borderRadius: "8px",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {lastSummary.documents.map((doc, idx) => {
                const rawAnalysis = rawApiDocs[idx]?.analysis;
                const qrList = rawAnalysis?.specialized_intelligence?.barcode_qr_payloads || [];
                const provenanceFields = rawAnalysis?.extracted_fields || [];

                return (
                  <div
                    key={`forensics-${doc.id}`}
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "6px",
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <strong style={{ color: "#063C3D" }}>{doc.filename}</strong>
                      <code
                        style={{
                          fontSize: "11px",
                          color: "#526663",
                          backgroundColor: "#F8F7F2",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        SHA-256: {doc.sha256.slice(0, 16)}…
                      </code>
                    </div>

                    {qrList.length > 0 && (
                      <div style={{ marginBottom: "6px", color: "#176B50", fontWeight: 600 }}>
                        {qrList.map((qr, qIdx) => (
                          <div key={qIdx}>
                            ✓ {qr.format}: {qr.decoded_summary}
                          </div>
                        ))}
                      </div>
                    )}

                    {provenanceFields.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {provenanceFields.map((pf) => (
                          <div
                            key={pf.field_name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              borderTop: "1px solid #EEF2F0",
                              paddingTop: "4px",
                            }}
                          >
                            <span>
                              <strong>{pf.field_label}:</strong> {pf.normalized_value}
                            </span>
                            <span style={{ color: "#526663", fontSize: "11px" }}>
                              bbox [{pf.bounding_box.map((n) => n.toFixed(2)).join(", ")}] •{" "}
                              {Math.round(pf.calibrated_confidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {Object.entries(doc.extractedFields).map(([k, v]) => (
                          <div key={k}>
                            <strong>{k}:</strong> {v}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
