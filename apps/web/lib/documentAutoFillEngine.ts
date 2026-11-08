import {
  ExtractorAnalysisResult,
  ExtractorFieldProvenance,
  PacketSortResult,
  PacketSortedDocument,
  analyzeDocumentStandalone,
} from "./api/extractor";
import {
  DocumentItem,
  ClientProfile,
  ImmigrationCase,
  FormSchemaItem,
  FormSubmissionItem,
  FormFieldAnswer,
  FormSchemaField,
  FormSchemaSection,
} from "./types";
import { INITIAL_INFO_SHEET_STORAGE_KEY } from "../components/portal/InitialInformationSheet";

export interface AutoFillFieldProvenance {
  field_name: string;
  field_label: string;
  value: any;
  source_type: "document_ocr" | "client_profile" | "user_provided" | "ai_generated";
  source_id?: string;
  source_document_title?: string;
  source_page?: number;
  source_location?: string;
  confidence?: number;
  excerpt?: string;
  bounding_box?: [number, number, number, number];
  extracted_at: string;
  is_confirmed?: boolean;
}

export interface AutoFillClientProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  passportNumber: string;
  currentField?: string;
  highestDegree?: string;
  roleDescription?: string;
  suggestedJurisdiction?: string;
  suggestedVisaCategory?: string;
  confidence: number;
  sourceDocumentName: string;
}

export interface AutoFillSheetResult {
  updatedData: Record<string, any>;
  provenance: Record<string, AutoFillFieldProvenance>;
  fieldsFilledCount: number;
}

/**
 * Normalizes any recognized date string into canonical DD/MM/YYYY representation.
 * Handles ISO (YYYY-MM-DD), slash/dash formats, named months, and Date.parse fallbacks.
 */
export function normalizeDateToDDMMYYYY(rawDate?: string | null): string {
  if (!rawDate || typeof rawDate !== "string") return "";
  const trimmed = rawDate.trim();
  if (!trimmed) return "";

  // 1. Slashes: DD/MM/YYYY or MM/DD/YYYY
  const slashParts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashParts) {
    const p1 = parseInt(slashParts[1], 10);
    const p2 = parseInt(slashParts[2], 10);
    const y = slashParts[3];
    // If first is month (<=12) and second is day (>12)
    if (p1 <= 12 && p2 > 12) {
      return `${String(p2).padStart(2, "0")}/${String(p1).padStart(2, "0")}/${y}`;
    }
    return `${String(p1).padStart(2, "0")}/${String(p2).padStart(2, "0")}/${y}`;
  }

  // 2. DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, "0");
    const m = ddmmyyyy[2].padStart(2, "0");
    const y = ddmmyyyy[3];
    return `${d}/${m}/${y}`;
  }

  // 3. YYYY-MM-DD or YYYY/MM/DD
  const yyyymmdd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, "0");
    const d = yyyymmdd[3].padStart(2, "0");
    return `${d}/${m}/${y}`;
  }

  const monthLookup: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };

  // 4. "14 May 1990" or "14-May-1990" or "14 May, 1990"
  const dayMonthWord = trimmed.match(/^(\d{1,2})[,\s-]+([A-Za-z]+)[,\s-]+(\d{4})/);
  if (dayMonthWord) {
    const d = dayMonthWord[1].padStart(2, "0");
    const mKey = dayMonthWord[2].toLowerCase();
    const m = monthLookup[mKey];
    const y = dayMonthWord[3];
    if (m) return `${d}/${m}/${y}`;
  }

  // 5. "May 14, 1990" or "May 14 1990"
  const monthWordDay = trimmed.match(/^([A-Za-z]+)[,\s-]+(\d{1,2})[,\s-]+(\d{4})/);
  if (monthWordDay) {
    const mKey = monthWordDay[1].toLowerCase();
    const d = monthWordDay[2].padStart(2, "0");
    const m = monthLookup[mKey];
    const y = monthWordDay[3];
    if (m) return `${d}/${m}/${y}`;
  }


  // 7. Date.parse fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getUTCDate()).padStart(2, "0");
    const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const y = String(parsed.getUTCFullYear());
    return `${d}/${m}/${y}`;
  }

  return trimmed;
}

/**
 * Canonical Immigration Form Schemas for USCIS I-140, G-28, I-485, and IRCC IMM 5257.
 */
export const CANONICAL_FORM_SCHEMAS: Record<string, FormSchemaItem> = {
  USCIS_I140: {
    id: "schema-i140",
    form_code: "USCIS_I140",
    name: "Form I-140: Immigrant Petition for Alien Workers",
    jurisdiction: "United States (USCIS)",
    pathway: "EB-1A Extraordinary Ability",
    description: "Petition to classify an alien as eligible for an immigrant visa under INA § 203(b)(1)(A).",
    versions: [
      {
        id: "ver-i140-2026",
        version_number: "v2026.1",
        is_active: true,
        effective_date: "2026-01-01",
        schema_definition: {
          sections: [
            {
              id: "part1_petitioner",
              title: "Part 1. Information About the Person or Organization Filing This Petition",
              description: "Petitioner identifying and contact information.",
              fields: [
                {
                  key: "petitioner_is_self",
                  label: "Is the beneficiary self-petitioning?",
                  field_type: "boolean",
                  required: true,
                  default: true,
                  source_mapping_hint: "case.is_self_petition",
                },
                {
                  key: "petitioner_family_name",
                  label: "Family Name (Last Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "petitioner_given_name",
                  label: "Given Name (First Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "petitioner_company_name",
                  label: "Company or Organization Name (if petitioning entity)",
                  field_type: "text",
                  required: false,
                  conditional: {
                    depends_on_field: "petitioner_is_self",
                    operator: "equals",
                    expected_value: false,
                  },
                },
                {
                  key: "petitioner_email",
                  label: "Primary Contact Email Address",
                  field_type: "text",
                  required: true,
                  validation_rules: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
                  source_mapping_hint: "profile.email",
                },
              ],
            },
            {
              id: "part2_petition_type",
              title: "Part 2. Petition Type & Classification",
              description: "Select the statutory immigrant classification being sought.",
              fields: [
                {
                  key: "visa_classification",
                  label: "Requested Immigrant Classification",
                  field_type: "select",
                  required: true,
                  options: [
                    { value: "EB1A_EXTRAORDINARY", label: "Alien of Extraordinary Ability (INA § 203(b)(1)(A))" },
                    { value: "EB1B_PROFESSOR", label: "Outstanding Professor or Researcher (INA § 203(b)(1)(B))" },
                    { value: "EB1C_MANAGER", label: "Multinational Executive or Manager (INA § 203(b)(1)(C))" },
                    { value: "EB2_NIW", label: "Member of Professions with Advanced Degree / NIW (INA § 203(b)(2))" },
                  ],
                  default: "EB1A_EXTRAORDINARY",
                  source_mapping_hint: "case.visa_category",
                },
              ],
            },
            {
              id: "part3_beneficiary_bio",
              title: "Part 3. Information About the Alien (Beneficiary)",
              description: "Biographical data and identity identifiers matching passport.",
              fields: [
                {
                  key: "beneficiary_family_name",
                  label: "Beneficiary Family Name (Last Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "beneficiary_given_name",
                  label: "Beneficiary Given Name (First Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "beneficiary_passport_number",
                  label: "Passport Number",
                  field_type: "text",
                  required: true,
                  validation_rules: { regex: "^[A-Z0-9]{6,12}$" },
                  source_mapping_hint: "doc.ocr.passport_number",
                },
                {
                  key: "beneficiary_country_of_citizenship",
                  label: "Country of Citizenship / Nationality",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.nationality",
                },
                {
                  key: "beneficiary_alien_number",
                  label: "Alien Registration Number (A-Number, if any)",
                  field_type: "text",
                  required: false,
                  validation_rules: { regex: "^A?\\d{9}$" },
                  source_mapping_hint: "doc.ocr.alien_number",
                },
              ],
            },
            {
              id: "part4_processing",
              title: "Part 4. Processing Information & Sensitive Inadmissibility Background",
              description: "Statutory background questions requiring certified legal counsel review.",
              fields: [
                {
                  key: "prior_removal_or_criminal_record",
                  label: "Has the beneficiary ever been in removal proceedings or convicted of a criminal offense?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
                {
                  key: "removal_details_notes",
                  label: "Explanation of Prior Proceedings / Incidents (if applicable)",
                  field_type: "textarea",
                  required: false,
                  conditional: {
                    depends_on_field: "prior_removal_or_criminal_record",
                    operator: "equals",
                    expected_value: true,
                  },
                },
              ],
            },
            {
              id: "part8_endeavor",
              title: "Part 8. Proposed Endeavor & Extraordinary Ability Rationale",
              description: "Summary statement of proposed national importance endeavor.",
              fields: [
                {
                  key: "proposed_endeavor_summary",
                  label: "Proposed Endeavor Statement (Drafted by AI Synthesis)",
                  field_type: "textarea",
                  required: true,
                  source_mapping_hint: "case.title",
                },
                {
                  key: "soc_code",
                  label: "Standard Occupational Classification (SOC Code)",
                  field_type: "text",
                  required: true,
                  default: "19-1029",
                },
              ],
            },
          ],
        },
      },
    ],
  },

  USCIS_G28: {
    id: "schema-g28",
    form_code: "USCIS_G28",
    name: "Form G-28: Notice of Entry of Appearance as Attorney or Accredited Representative",
    jurisdiction: "United States (USCIS)",
    pathway: "Statutory Representation",
    description: "Notice of formal legal representation before USCIS, ICE, and CBP.",
    versions: [
      {
        id: "ver-g28-2026",
        version_number: "v2026.1",
        is_active: true,
        effective_date: "2026-01-01",
        schema_definition: {
          sections: [
            {
              id: "part1_attorney",
              title: "Part 1. Information About Attorney or Accredited Representative",
              description: "Attorney licensing and law practice contact credentials.",
              fields: [
                {
                  key: "attorney_family_name",
                  label: "Attorney Family Name (Last Name)",
                  field_type: "text",
                  required: true,
                  default: "Law Group",
                },
                {
                  key: "attorney_given_name",
                  label: "Attorney Given Name (First Name)",
                  field_type: "text",
                  required: true,
                  default: "Managing Partner",
                },
                {
                  key: "attorney_address",
                  label: "Law Practice Physical Address",
                  field_type: "textarea",
                  required: true,
                  default: "100 Montgomery St, Suite 2400, San Francisco, CA 94104",
                },
                {
                  key: "attorney_email",
                  label: "Attorney Official Email",
                  field_type: "text",
                  required: true,
                  default: "notices@immilaw.example.com",
                },
                {
                  key: "attorney_phone",
                  label: "Attorney Direct Phone",
                  field_type: "text",
                  required: true,
                  default: "+1-415-555-0199",
                },
                {
                  key: "licensing_authority",
                  label: "Bar Licensing Authority / State Bar",
                  field_type: "text",
                  required: true,
                  default: "State Bar of California",
                },
                {
                  key: "bar_number",
                  label: "Bar License Number / Identifier",
                  field_type: "text",
                  required: true,
                  default: "318492",
                },
              ],
            },
            {
              id: "part2_eligibility",
              title: "Part 2. Eligibility Information",
              description: "Certifications of attorney standing and professional responsibility.",
              fields: [
                {
                  key: "is_attorney_in_good_standing",
                  label: "I am an attorney in good standing of the bar of the highest court of the state specified.",
                  field_type: "boolean",
                  required: true,
                  default: true,
                },
                {
                  key: "is_subject_to_order",
                  label: "Am I subject to any order restricting practice before USCIS or DHS?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
              ],
            },
            {
              id: "part3_matter",
              title: "Part 3. Notice of Appearance",
              description: "Proceeding or underlying petition matter scope.",
              fields: [
                {
                  key: "appearance_matter_type",
                  label: "Appearance Pertains to Matter / Form",
                  field_type: "text",
                  required: true,
                  default: "Form I-140 Immigrant Petition for Alien Worker",
                },
                {
                  key: "receipt_number_if_any",
                  label: "Receipt Number (if proceeding has been receipted)",
                  field_type: "text",
                  required: false,
                },
              ],
            },
            {
              id: "part4_client",
              title: "Part 4. Client / Applicant Information",
              description: "Represented client personal details matching passport identity.",
              fields: [
                {
                  key: "client_family_name",
                  label: "Client Family Name",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "client_given_name",
                  label: "Client Given Name",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "client_dob",
                  label: "Client Date of Birth (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.dob",
                },
                {
                  key: "client_country_citizenship",
                  label: "Country of Citizenship",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.nationality",
                },
                {
                  key: "client_alien_number",
                  label: "Alien Registration Number (A-Number)",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "client_email",
                  label: "Client Email Address",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.email",
                },
                {
                  key: "client_phone",
                  label: "Client Contact Phone",
                  field_type: "text",
                  required: false,
                  source_mapping_hint: "profile.phone",
                },
              ],
            },
            {
              id: "part5_consents",
              title: "Part 5. Consent and Sign-off",
              description: "Notices and original document delivery consents.",
              fields: [
                {
                  key: "consent_send_notices_to_attorney",
                  label: "I consent to have USCIS send notices to my attorney's address.",
                  field_type: "boolean",
                  required: true,
                  default: true,
                },
                {
                  key: "consent_send_secure_docs_to_attorney",
                  label: "I consent to have USCIS send secure identity documents to my attorney.",
                  field_type: "boolean",
                  required: true,
                  default: true,
                },
              ],
            },
          ],
        },
      },
    ],
  },

  USCIS_I485: {
    id: "schema-i485",
    form_code: "USCIS_I485",
    name: "Form I-485: Application to Register Permanent Residence or Adjust Status",
    jurisdiction: "United States (USCIS)",
    pathway: "Adjustment of Status",
    description: "Application for adjustment of immigration status to lawful permanent resident under INA § 245.",
    versions: [
      {
        id: "ver-i485-2026",
        version_number: "v2026.1",
        is_active: true,
        effective_date: "2026-01-01",
        schema_definition: {
          sections: [
            {
              id: "part1_applicant_bio",
              title: "Part 1. Information About You (Applicant)",
              description: "Applicant legal name, civil identifiers, and current physical residence.",
              fields: [
                {
                  key: "applicant_family_name",
                  label: "Family Name (Last Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "applicant_given_name",
                  label: "Given Name (First Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "other_names_used",
                  label: "All Other Names Used (Maiden, Aliases)",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "date_of_birth",
                  label: "Date of Birth (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.dob",
                },
                {
                  key: "country_of_birth",
                  label: "Country of Birth",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "country_of_citizenship",
                  label: "Country of Citizenship / Nationality",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.nationality",
                },
                {
                  key: "alien_registration_number",
                  label: "Alien Registration Number (A-Number)",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "ssn",
                  label: "U.S. Social Security Number (if any)",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "current_residential_address",
                  label: "Current Physical Residential Address",
                  field_type: "textarea",
                  required: true,
                  source_mapping_hint: "doc.ocr.address",
                },
                {
                  key: "phone_number",
                  label: "Daytime Telephone Number",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.phone",
                },
                {
                  key: "email_address",
                  label: "Applicant Email Address",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.email",
                },
              ],
            },
            {
              id: "part2_app_type",
              title: "Part 2. Application Type or Filing Category",
              description: "Statutory immigrant category and underlying petition.",
              fields: [
                {
                  key: "underlying_petition_category",
                  label: "Underlying Immigrant Petition / Basis of Eligibility",
                  field_type: "text",
                  required: true,
                  default: "Employment-Based 1st Preference (EB-1A Extraordinary Ability)",
                },
                {
                  key: "receipt_number",
                  label: "Underlying Petition Receipt Number",
                  field_type: "text",
                  required: false,
                },
              ],
            },
            {
              id: "part3_arrival",
              title: "Part 3. Additional Information About You",
              description: "Most recent authorized entry to the United States and travel passport details.",
              fields: [
                {
                  key: "place_of_last_arrival",
                  label: "Place of Last Authorized Arrival (Port of Entry)",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "date_of_last_arrival",
                  label: "Date of Last Arrival (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "i94_number",
                  label: "Form I-94 Arrival-Departure Record Number",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "passport_number",
                  label: "Passport Number Used for Most Recent Travel",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.passport_number",
                },
                {
                  key: "passport_country_of_issue",
                  label: "Passport Country of Issuance",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "passport_expiration_date",
                  label: "Passport Expiration Date (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.expiry_date",
                },
              ],
            },
            {
              id: "part4_parents",
              title: "Part 4. Information About Your Parents",
              description: "Parental biodata and vital statistics.",
              fields: [
                {
                  key: "father_family_name",
                  label: "Father's Legal Family Name",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "father_given_name",
                  label: "Father's Given Name(s)",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "mother_family_name",
                  label: "Mother's Legal Family Name at Birth",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "mother_given_name",
                  label: "Mother's Given Name(s)",
                  field_type: "text",
                  required: true,
                },
              ],
            },
            {
              id: "part5_marital",
              title: "Part 5. Information About Your Marital History",
              description: "Current marital status and spouse identifying details.",
              fields: [
                {
                  key: "current_marital_status",
                  label: "Current Marital Status",
                  field_type: "select",
                  required: true,
                  options: [
                    { value: "SINGLE", label: "Single / Never Married" },
                    { value: "MARRIED", label: "Married" },
                    { value: "DIVORCED", label: "Divorced" },
                    { value: "WIDOWED", label: "Widowed" },
                  ],
                  default: "SINGLE",
                },
                {
                  key: "spouse_family_name",
                  label: "Spouse Legal Family Name",
                  field_type: "text",
                  required: false,
                  conditional: {
                    depends_on_field: "current_marital_status",
                    operator: "equals",
                    expected_value: "MARRIED",
                  },
                },
                {
                  key: "spouse_given_name",
                  label: "Spouse Given Name(s)",
                  field_type: "text",
                  required: false,
                  conditional: {
                    depends_on_field: "current_marital_status",
                    operator: "equals",
                    expected_value: "MARRIED",
                  },
                },
                {
                  key: "date_of_marriage",
                  label: "Date of Current Marriage (DD/MM/YYYY)",
                  field_type: "text",
                  required: false,
                  conditional: {
                    depends_on_field: "current_marital_status",
                    operator: "equals",
                    expected_value: "MARRIED",
                  },
                },
              ],
            },
            {
              id: "part8_inadmissibility",
              title: "Part 8. General Eligibility and Inadmissibility Grounds",
              description: "Mandatory statutory inadmissibility disclosures under INA § 212.",
              fields: [
                {
                  key: "inadmissibility_arrests_citations",
                  label: "Have you ever been arrested, cited, charged, or convicted of any crime or offense anywhere in the world?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
                {
                  key: "inadmissibility_violations",
                  label: "Have you ever violated the terms of a nonimmigrant visa or unlawfully remained in the United States?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
              ],
            },
          ],
        },
      },
    ],
  },

  IRCC_IMM5257: {
    id: "schema-imm5257",
    form_code: "IRCC_IMM5257",
    name: "Form IMM 5257: Application for Visitor Visa (Temporary Resident Visa)",
    jurisdiction: "Canada (IRCC)",
    pathway: "Temporary Resident Visa / Visitor",
    description: "Statutory application to enter Canada as a temporary resident under the Immigration and Refugee Protection Act (IRPA).",
    versions: [
      {
        id: "ver-imm5257-2026",
        version_number: "v2026.1",
        is_active: true,
        effective_date: "2026-01-01",
        schema_definition: {
          sections: [
            {
              id: "sec1_personal",
              title: "Section 1. Personal Details",
              description: "Applicant biographical identity matching international passport.",
              fields: [
                {
                  key: "uci_number",
                  label: "Universal Client Identification (UCI / Client ID, if any)",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "family_name",
                  label: "Family Name (Surname as in passport)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "given_names",
                  label: "Given Name(s) (First & middle names)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "alias_used",
                  label: "Have you ever used any other name?",
                  field_type: "text",
                  required: false,
                },
                {
                  key: "gender",
                  label: "Gender / Sex",
                  field_type: "select",
                  required: true,
                  options: [
                    { value: "MALE", label: "Male" },
                    { value: "FEMALE", label: "Female" },
                    { value: "OTHER", label: "Other / Non-Binary" },
                  ],
                  default: "MALE",
                },
                {
                  key: "date_of_birth",
                  label: "Date of Birth (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.dob",
                },
                {
                  key: "place_of_birth_city",
                  label: "City / Town of Birth",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "place_of_birth_country",
                  label: "Country or Territory of Birth",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "citizenship",
                  label: "Citizenship / Nationality",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.nationality",
                },
                {
                  key: "current_country_of_residence",
                  label: "Current Country or Territory of Residence",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "marital_status",
                  label: "Current Marital Status",
                  field_type: "select",
                  required: true,
                  options: [
                    { value: "SINGLE", label: "Single / Never Married" },
                    { value: "MARRIED", label: "Married" },
                    { value: "COMMON_LAW", label: "Common-Law" },
                    { value: "DIVORCED", label: "Divorced" },
                    { value: "WIDOWED", label: "Widowed" },
                  ],
                  default: "SINGLE",
                },
              ],
            },
            {
              id: "sec2_passport",
              title: "Section 2. Passport / Travel Document",
              description: "Valid travel document details for international travel.",
              fields: [
                {
                  key: "passport_number",
                  label: "Passport Number",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.passport_number",
                },
                {
                  key: "country_of_issue",
                  label: "Country or Territory of Issue",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "issue_date",
                  label: "Issue Date (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "expiry_date",
                  label: "Expiry Date (DD/MM/YYYY)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.expiry_date",
                },
              ],
            },
            {
              id: "sec3_contact",
              title: "Section 3. Contact Information",
              description: "Residential address and electronic communication coordinates.",
              fields: [
                {
                  key: "residential_address",
                  label: "Full Residential Address",
                  field_type: "textarea",
                  required: true,
                  source_mapping_hint: "doc.ocr.address",
                },
                {
                  key: "phone_number",
                  label: "Telephone Number",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.phone",
                },
                {
                  key: "email_address",
                  label: "Email Address",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.email",
                },
              ],
            },
            {
              id: "sec4_details_visit",
              title: "Section 4. Details of Visit to Canada",
              description: "Purpose of travel, available maintenance funds, and Canadian contacts.",
              fields: [
                {
                  key: "purpose_of_visit",
                  label: "Purpose of Visit",
                  field_type: "text",
                  required: true,
                  default: "Business / Scientific Collaboration",
                },
                {
                  key: "funds_available_cad",
                  label: "Funds Available for Stay (CAD)",
                  field_type: "text",
                  required: true,
                  default: "$10,000",
                },
                {
                  key: "inviting_person_or_institution",
                  label: "Name of Person or Institution Inviting You",
                  field_type: "text",
                  required: false,
                },
              ],
            },
            {
              id: "sec5_employment_edu",
              title: "Section 5. Education & Employment",
              description: "Post-secondary credentials and current employment background.",
              fields: [
                {
                  key: "current_occupation",
                  label: "Current Occupation / Activity",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "employer_name",
                  label: "Company / Employer / Facility Name",
                  field_type: "text",
                  required: true,
                },
                {
                  key: "post_secondary_education_completed",
                  label: "Have you had any post-secondary education?",
                  field_type: "boolean",
                  required: true,
                  default: true,
                },
              ],
            },
            {
              id: "sec6_background",
              title: "Section 6. Background Statutory Questions",
              description: "Statutory questions under IRPA regarding refusals, criminality, and health.",
              fields: [
                {
                  key: "prior_visa_refusal_canada_or_other",
                  label: "Have you ever remained beyond your authorized stay or been refused a visa or entry to Canada or any other country?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
                {
                  key: "prior_criminal_charges",
                  label: "Have you ever committed, been arrested for, or convicted of any criminal offense in any country?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
              ],
            },
          ],
        },
      },
    ],
  },
};

/**
 * Extracts a normalized AutoFillClientProfile from an ExtractorAnalysisResult.
 */
export function extractProfileFromAnalysis(
  analysis: ExtractorAnalysisResult,
  filename?: string
): AutoFillClientProfile {
  const spec = analysis.specialized_intelligence || {};
  const passport = spec.identity_compliance?.indian_passport;
  const resume = spec.resume_intelligence;
  const fields = analysis.extracted_fields || [];

  const getFieldVal = (names: string[]): string => {
    for (const n of names) {
      const match = fields.find(
        (f) => f.field_name.toLowerCase() === n.toLowerCase()
      );
      if (match?.normalized_value) return match.normalized_value;
      if (match?.original_value) return match.original_value;
    }
    return "";
  };

  // 1. First & Last Names
  let firstName = "";
  let lastName = "";

  if (passport?.given_names || passport?.surname) {
    firstName = passport.given_names || "";
    lastName = passport.surname || "";
  } else if (passport?.holder_name) {
    const parts = passport.holder_name.trim().split(/\s+/);
    if (parts.length > 1) {
      lastName = parts[parts.length - 1];
      firstName = parts.slice(0, -1).join(" ");
    } else {
      firstName = parts[0] || "";
    }
  } else if (resume?.candidate_name) {
    const parts = resume.candidate_name.trim().split(/\s+/);
    if (parts.length > 1) {
      lastName = parts[parts.length - 1];
      firstName = parts.slice(0, -1).join(" ");
    } else {
      firstName = parts[0] || "";
    }
  } else {
    const fn = getFieldVal(["given_names", "first_name", "applicant_given_names"]);
    const ln = getFieldVal(["surname", "family_name", "last_name", "applicant_family_name"]);
    if (fn || ln) {
      firstName = fn;
      lastName = ln;
    } else {
      const full = getFieldVal(["full_name", "applicant_name", "holder_name", "candidate_name"]);
      if (full) {
        const parts = full.trim().split(/\s+/);
        if (parts.length > 1) {
          lastName = parts[parts.length - 1];
          firstName = parts.slice(0, -1).join(" ");
        } else {
          firstName = parts[0] || "";
        }
      }
    }
  }

  // 2. Email
  const email =
    resume?.email ||
    getFieldVal(["email", "email_address", "contact_email"]) ||
    "";

  // 3. Phone
  const phone =
    resume?.phone ||
    getFieldVal(["phone", "phone_number", "mobile_number", "contact_phone"]) ||
    "";

  // 4. Nationality
  let nationality =
    passport?.nationality ||
    getFieldVal(["nationality", "citizenship", "country_of_citizenship"]) ||
    "";
  if (!nationality) {
    if (passport || spec.identity_compliance?.aadhaar || spec.identity_compliance?.pan) {
      nationality = "India";
    }
  }

  // 5. Passport Number
  const passportNumber =
    passport?.passport_number ||
    getFieldVal(["passport_number", "passport_no"]) ||
    "";

  // 6. Current Field / Role
  const currentField =
    resume?.current_role ||
    getFieldVal(["job_title", "current_position", "field_of_study", "occupation"]) ||
    "";

  // 7. Highest Degree
  let highestDegree = "";
  if (Array.isArray(resume?.education) && resume.education.length > 0) {
    highestDegree = resume.education[0];
  } else {
    const deg = getFieldVal(["degree_title", "conferred_degree", "degree"]);
    const inst = getFieldVal(["institution_name", "university", "school_name"]);
    if (deg) {
      highestDegree = inst ? `${deg}, ${inst}` : deg;
    }
  }

  // 8. Role Description
  const roleDescription =
    getFieldVal(["criticalRoleDescription", "proposed_endeavor_summary", "job_description"]) ||
    (currentField ? `Key contributor and specialist serving as ${currentField}.` : "");

  // 9. Suggested Jurisdiction & Pathway
  let suggestedJurisdiction = "United States (USCIS)";
  let suggestedVisaCategory = "EB-1A Extraordinary Ability";
  const cat = analysis.recognition?.category || "";
  const keywords = analysis.recognition?.matched_keywords || [];
  const textBlob = `${analysis.metadata?.filename || ""} ${keywords.join(" ")}`.toLowerCase();

  if (textBlob.includes("canada") || textBlob.includes("ircc") || textBlob.includes("express entry")) {
    suggestedJurisdiction = "Canada (IRCC)";
    suggestedVisaCategory = "Express Entry / Federal Skilled Worker";
  }

  const confidence = analysis.recognition?.confidence || 0.95;
  const sourceDocumentName = analysis.metadata?.filename || filename || "Uploaded Document";

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    nationality: nationality.trim(),
    passportNumber: passportNumber.trim(),
    currentField: currentField.trim(),
    highestDegree: highestDegree.trim(),
    roleDescription: roleDescription.trim(),
    suggestedJurisdiction,
    suggestedVisaCategory,
    confidence,
    sourceDocumentName,
  };
}

/**
 * Deterministically extracts client onboarding profile directly from a browser File.
 */
export async function extractProfileFromDocument(file: File): Promise<AutoFillClientProfile> {
  const analysis = await analyzeDocumentStandalone({ file, filename: file.name });
  return extractProfileFromAnalysis(analysis, file.name);
}

/**
 * Maps an extraction result (ExtractorAnalysisResult or DocumentItem) into the InitialInformationSheet
 * structure, attaching full provenance and DD/MM/YYYY date normalization.
 */
export function mapAnalysisToInitialInfoSheet(
  analysis: ExtractorAnalysisResult | DocumentItem,
  existingSheet?: any
): AutoFillSheetResult {
  const updatedData: Record<string, any> = { ...(existingSheet || {}) };
  const provenance: Record<string, AutoFillFieldProvenance> = {};
  let fieldsFilledCount = 0;

  const now = new Date().toISOString();

  // Normalize inputs to field list and specialized data
  let fieldList: Array<{ name: string; label: string; value: string; page?: number; confidence?: number; bbox?: [number, number, number, number] }> = [];
  let sourceDocId = "doc-ocr";
  let sourceTitle = "Uploaded Document";
  let spec: ExtractorAnalysisResult["specialized_intelligence"] = {};

  if ("metadata" in analysis) {
    sourceDocId = analysis.metadata.sha256_hash || "doc-ocr";
    sourceTitle = analysis.metadata.filename || "Uploaded Evidence";
    spec = analysis.specialized_intelligence || {};
    fieldList = (analysis.extracted_fields || []).map((f) => ({
      name: f.field_name,
      label: f.field_label,
      value: f.normalized_value || f.original_value,
      page: f.source_page || 1,
      confidence: f.extraction_confidence || 0.95,
      bbox: f.bounding_box,
    }));
  } else if ("extracted_fields" in analysis && Array.isArray(analysis.extracted_fields)) {
    sourceDocId = analysis.id || analysis.sha256_hash || "doc-ocr";
    sourceTitle = analysis.title || "Uploaded Evidence";
    fieldList = (analysis.extracted_fields as any[]).map((f) => ({
      name: f.field_name,
      label: f.field_label || f.field_name,
      value: f.normalized_value || f.field_value || f.original_value,
      page: f.source_page || 1,
      confidence: f.confidence || f.extraction_confidence || 0.95,
    }));
  }

  const findVal = (names: string[]): { val: string; fieldItem?: (typeof fieldList)[0] } => {
    for (const n of names) {
      const match = fieldList.find((f) => f.name.toLowerCase() === n.toLowerCase());
      if (match && match.value?.trim()) return { val: match.value.trim(), fieldItem: match };
    }
    return { val: "" };
  };

  const applyField = (fieldName: string, label: string, value: any, page = 1, conf = 0.95) => {
    if (!value || (typeof value === "string" && !value.trim())) return;
    updatedData[fieldName] = value;
    provenance[fieldName] = {
      field_name: fieldName,
      field_label: label,
      value,
      source_type: "document_ocr",
      source_id: sourceDocId,
      source_document_title: sourceTitle,
      source_page: page,
      confidence: conf,
      extracted_at: now,
      is_confirmed: false,
    };
    fieldsFilledCount++;
  };

  const passport = spec.identity_compliance?.indian_passport;
  const resume = spec.resume_intelligence;

  // 1. Surname / Family Name
  const surnameMatch = findVal(["surname", "family_name", "last_name", "applicant_family_name"]);
  const surVal = passport?.surname || surnameMatch.val;
  if (surVal) applyField("family_name", "Family Name / Surname", surVal.toUpperCase(), surnameMatch.fieldItem?.page);

  // 2. Given Names
  const givenMatch = findVal(["given_names", "first_name", "applicant_given_names"]);
  const givVal = passport?.given_names || givenMatch.val;
  if (givVal) applyField("given_names", "Given Name(s)", givVal, givenMatch.fieldItem?.page);

  // Fallback to full name splitting
  if (!surVal && !givVal) {
    const fullMatch = findVal(["full_name", "applicant_name", "holder_name", "candidate_name"]);
    const fullVal = passport?.holder_name || resume?.candidate_name || fullMatch.val;
    if (fullVal) {
      const parts = fullVal.trim().split(/\s+/);
      if (parts.length > 1) {
        applyField("family_name", "Family Name / Surname", parts[parts.length - 1].toUpperCase());
        applyField("given_names", "Given Name(s)", parts.slice(0, -1).join(" "));
      } else {
        applyField("given_names", "Given Name(s)", parts[0]);
      }
    }
  }

  // 3. Date of Birth (Normalized to DD/MM/YYYY)
  const dobMatch = findVal(["date_of_birth", "dob", "birth_date"]);
  const rawDob = passport?.date_of_birth || dobMatch.val;
  if (rawDob) {
    applyField("dob", "Date of Birth (DD/MM/YYYY)", normalizeDateToDDMMYYYY(rawDob), dobMatch.fieldItem?.page);
  }

  // 4. Place of Birth / City & Country
  const pobMatch = findVal(["place_of_birth", "birth_place", "city_country_birth"]);
  const pobVal = passport?.place_of_birth || pobMatch.val;
  if (pobVal) applyField("city_country_birth", "City & Country of Birth", pobVal, pobMatch.fieldItem?.page);

  // 5. Gender
  const genderMatch = findVal(["gender", "sex"]);
  const rawGender = passport?.gender || genderMatch.val;
  if (rawGender) {
    const g = rawGender.toUpperCase();
    const normalizedGender = g.startsWith("F") ? "FEMALE" : g.startsWith("M") ? "MALE" : "OTHER";
    applyField("gender", "Gender", normalizedGender, genderMatch.fieldItem?.page);
  }

  // 6. Passport Number & Passport Details
  const passMatch = findVal(["passport_number", "passport_no"]);
  const passVal = passport?.passport_number || passMatch.val;
  if (passVal) applyField("passport_number", "Passport Number", passVal.toUpperCase(), passMatch.fieldItem?.page);

  const passIssueMatch = findVal(["place_of_issue", "passport_issue_place"]);
  const passIssueVal = passport?.place_of_issue || passIssueMatch.val;
  if (passIssueVal) applyField("passport_issue_place", "Passport Issue Place", passIssueVal);

  const passIssueDateMatch = findVal(["date_of_issue", "passport_issue_date"]);
  const passIssueDateVal = passport?.date_of_issue || passIssueDateMatch.val;
  if (passIssueDateVal) {
    applyField("passport_issue_date", "Passport Issue Date", normalizeDateToDDMMYYYY(passIssueDateVal));
  }

  const passExpMatch = findVal(["date_of_expiry", "expiry_date", "passport_expiry_date"]);
  const passExpVal = passport?.date_of_expiry || passExpMatch.val;
  if (passExpVal) {
    applyField("passport_expiry_date", "Passport Expiry Date", normalizeDateToDDMMYYYY(passExpVal));
  }

  // 7. Residential Address
  const addrMatch = findVal(["address", "residential_address", "residence", "current_address"]);
  const addrVal = passport?.address || resume?.location || addrMatch.val;
  if (addrVal) applyField("residential_address", "Residential Address", addrVal, addrMatch.fieldItem?.page);

  // 8. Contact (Email & Phone)
  const emailMatch = findVal(["email", "email_address", "contact_email"]);
  const emailVal = resume?.email || emailMatch.val;
  if (emailVal) applyField("email", "Email Address", emailVal);

  const phoneMatch = findVal(["phone", "phone_number", "mobile_number", "contact_phone"]);
  const phoneVal = resume?.phone || phoneMatch.val;
  if (phoneVal) applyField("phone_number", "Phone Number", phoneVal);

  // 9. Civil Status / Marriage
  const groomMatch = findVal(["groom_name", "bridegroom_name"]);
  const brideMatch = findVal(["bride_name"]);
  const marriageDateMatch = findVal(["marriage_date", "date_of_marriage"]);
  if (marriageDateMatch.val || groomMatch.val || brideMatch.val || passport?.spouse_name) {
    applyField("marital_status", "Marital Status", "MARRIED");
    if (marriageDateMatch.val) {
      applyField("date_of_marriage", "Date of Marriage", normalizeDateToDDMMYYYY(marriageDateMatch.val));
    }
    const spouseVal = passport?.spouse_name || brideMatch.val || groomMatch.val;
    if (spouseVal) {
      updatedData.family = updatedData.family || {};
      updatedData.family.spouse = {
        ...(updatedData.family.spouse || {}),
        name: spouseVal,
      };
      provenance["family.spouse.name"] = {
        field_name: "family.spouse.name",
        field_label: "Spouse Full Name",
        value: spouseVal,
        source_type: "document_ocr",
        source_id: sourceDocId,
        source_document_title: sourceTitle,
        source_page: 1,
        confidence: 0.95,
        extracted_at: now,
      };
      fieldsFilledCount++;
    }
  }

  // 10. Parents Information
  if (passport?.father_name) {
    updatedData.family = updatedData.family || {};
    updatedData.family.father = {
      ...(updatedData.family.father || {}),
      name: passport.father_name,
    };
    provenance["family.father.name"] = {
      field_name: "family.father.name",
      field_label: "Father Full Name",
      value: passport.father_name,
      source_type: "document_ocr",
      source_id: sourceDocId,
      source_document_title: sourceTitle,
      confidence: 0.95,
      extracted_at: now,
    };
    fieldsFilledCount++;
  }

  if (passport?.mother_name) {
    updatedData.family = updatedData.family || {};
    updatedData.family.mother = {
      ...(updatedData.family.mother || {}),
      name: passport.mother_name,
    };
    provenance["family.mother.name"] = {
      field_name: "family.mother.name",
      field_label: "Mother Full Name",
      value: passport.mother_name,
      source_type: "document_ocr",
      source_id: sourceDocId,
      source_document_title: sourceTitle,
      confidence: 0.95,
      extracted_at: now,
    };
    fieldsFilledCount++;
  }

  // 11. Education Credentials
  const instMatch = findVal(["institution_name", "university", "school_name"]);
  const degMatch = findVal(["degree_title", "conferred_degree", "degree"]);
  const gradMatch = findVal(["graduation_date", "conferral_date"]);
  if (instMatch.val || degMatch.val) {
    updatedData.education = updatedData.education || [];
    const exists = updatedData.education.some(
      (e: any) => e.school_name === (instMatch.val || "University")
    );
    if (!exists) {
      updatedData.education.push({
        id: `edu-${Date.now()}-${updatedData.education.length + 1}`,
        start_date: "01/09/2015",
        end_date: normalizeDateToDDMMYYYY(gradMatch.val || "16/06/2019"),
        field_of_study: degMatch.val || "Computer Science",
        school_name: instMatch.val || "University",
        city_country: "United States",
      });
      fieldsFilledCount++;
    }
  }

  // 12. Employment Records
  const jobMatch = findVal(["job_title", "current_position", "role"]);
  const compMatch = findVal(["company_name", "employer"]);
  if (jobMatch.val || compMatch.val) {
    updatedData.employment = updatedData.employment || [];
    const exists = updatedData.employment.some(
      (em: any) => em.company_name === (compMatch.val || "Enterprise")
    );
    if (!exists) {
      updatedData.employment.push({
        id: `emp-${Date.now()}-${updatedData.employment.length + 1}`,
        start_date: "01/01/2021",
        end_date: "Present",
        job_title: jobMatch.val || "Staff Engineer",
        company_name: compMatch.val || "Enterprise Technology Corp",
        company_address: addrVal || "San Francisco, CA",
      });
      fieldsFilledCount++;
    }
  }

  return { updatedData, provenance, fieldsFilledCount };
}

/**
 * Maps multi-document packet sorting results into InitialInformationSheet data.
 */
export function mapPacketToInitialInfoSheet(
  packet: PacketSortResult,
  existingSheet?: any
): AutoFillSheetResult {
  let mergedData: Record<string, any> = { ...(existingSheet || {}) };
  let mergedProvenance: Record<string, AutoFillFieldProvenance> = {};
  let totalCount = 0;

  for (const person of packet.person_folders || []) {
    for (const doc of person.documents || []) {
      const docItem: DocumentItem = {
        id: (doc as any).document_id || `${person.person_id}-doc-${doc.document_index}`,
        title: doc.filename,
        category: doc.category || doc.document_subtype,
        file_size: "1.0 MB",
        sha256_hash: `${person.person_id}-${doc.document_index}`,
        version: 1,
        is_current_version: true,
        processing_status: "completed",
        verification_status: "verified",
        status: "verified",
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        extracted_fields: Object.entries(doc.extracted_fields || {}).map(([k, v], idx) => ({
          id: `f-${idx}`,
          field_name: k,
          field_label: k.replace(/_/g, " ").toUpperCase(),
          original_value: v,
          normalized_value: v,
          field_value: v,
          source_page: 1,
          extraction_method: "packet_sorter",
          confidence: 0.95,
          ocr_confidence: 0.95,
          extraction_confidence: 0.95,
          validation_status: "unvalidated",
          is_manually_corrected: false,
        })),
      };

      const res = mapAnalysisToInitialInfoSheet(docItem, mergedData);
      mergedData = res.updatedData;
      mergedProvenance = { ...mergedProvenance, ...res.provenance };
      totalCount += res.fieldsFilledCount;
    }
  }

  return { updatedData: mergedData, provenance: mergedProvenance, fieldsFilledCount: totalCount };
}

/**
 * Dynamically hydrates canonical immigration forms (I-140, G-28, I-485, IMM 5257)
 * using client profiles, cases, and extracted document OCR answers.
 */
export function hydrateCanonicalForm(
  formCode: "USCIS_I140" | "USCIS_G28" | "USCIS_I485" | "IRCC_IMM5257" | string,
  caseItem: ImmigrationCase | null,
  client: ClientProfile | null,
  documents: DocumentItem[] = [],
  customAnswers?: Record<string, any>
): FormSubmissionItem {
  const schema = CANONICAL_FORM_SCHEMAS[formCode] || CANONICAL_FORM_SCHEMAS["USCIS_I140"];
  const answers: Record<string, FormFieldAnswer> = {};
  const now = new Date().toISOString();

  // Combine all document fields into a lookup
  const docFields: Record<string, { val: string; docId: string; docTitle: string; page: number; conf: number }> = {};
  for (const doc of documents) {
    for (const f of doc.extracted_fields || []) {
      const key = f.field_name.toLowerCase();
      const val = f.normalized_value || (f as any).field_value || f.original_value;
      if (val && !docFields[key]) {
        docFields[key] = {
          val: String(val),
          docId: doc.id,
          docTitle: doc.title,
          page: f.source_page || 1,
          conf: f.confidence || (f as any).extraction_confidence || 0.95,
        };
      }
    }
  }

  const sections = schema.versions[0]?.schema_definition?.sections || [];
  let totalRequiredFields = 0;
  let answeredFields = 0;
  let hasUnconfirmedAi = false;

  for (const sec of sections) {
    for (const field of sec.fields) {
      if (field.required) totalRequiredFields++;

      let answerValue: any = customAnswers?.[field.key];
      let sourceType: FormFieldAnswer["source_type"] = "user_provided";
      let sourceLabel = "User Entry";
      let sourceId: string | undefined = undefined;
      let sourceDocId: string | undefined = undefined;
      let sourcePage: number | undefined = undefined;
      let confidence: number | undefined = undefined;
      let isConfirmed = false;

      if (answerValue === undefined) {
        if (field.key.startsWith("attorney_")) {
          answerValue =
            field.default !== undefined
              ? field.default
              : field.key === "attorney_family_name"
                ? "Law Group"
                : field.key === "attorney_given_name"
                  ? "Managing Partner"
                  : "";
          sourceType = "user_provided";
          sourceLabel = "Attorney Record";
          isConfirmed = true;
        } else if (
          field.key.includes("family_name") ||
          field.key === "petitioner_family_name" ||
          field.key === "beneficiary_family_name" ||
          field.key === "client_family_name" ||
          field.key === "applicant_family_name"
        ) {
          answerValue = client?.last_name || "";
          sourceType = "client_profile";
          sourceLabel = "Client Profile";
          isConfirmed = true;
        } else if (
          field.key.includes("given_name") ||
          field.key === "petitioner_given_name" ||
          field.key === "beneficiary_given_name" ||
          field.key === "client_given_name" ||
          field.key === "applicant_given_name"
        ) {
          answerValue = client?.first_name || "";
          sourceType = "client_profile";
          sourceLabel = "Client Profile";
          isConfirmed = true;
        } else if (field.key.includes("email") || field.key === "petitioner_email" || field.key === "client_email" || field.key === "email_address") {
          answerValue = client?.email || "";
          sourceType = "client_profile";
          sourceLabel = "Client Profile";
          isConfirmed = true;
        } else if (field.key.includes("phone") || field.key === "client_phone" || field.key === "phone_number") {
          answerValue = client?.phone || "";
          sourceType = "client_profile";
          sourceLabel = "Client Profile";
          isConfirmed = true;
        } else if (field.key.includes("citizenship") || field.key === "beneficiary_country_of_citizenship" || field.key === "client_country_citizenship" || field.key === "country_of_citizenship") {
          answerValue = client?.nationality || docFields["nationality"]?.val || "United States";
          sourceType = client?.nationality ? "client_profile" : "document_ocr";
          sourceLabel = client?.nationality ? "Client Profile" : (docFields["nationality"]?.docTitle || "Document OCR");
          sourceDocId = docFields["nationality"]?.docId;
          sourcePage = docFields["nationality"]?.page;
          confidence = docFields["nationality"]?.conf;
          isConfirmed = Boolean(client?.nationality);
        } else if (field.key.includes("passport_number") || field.key === "beneficiary_passport_number") {
          const m = docFields["passport_number"] || docFields["passport_no"];
          if (m) {
            answerValue = m.val;
            sourceType = "document_ocr";
            sourceLabel = m.docTitle;
            sourceDocId = m.docId;
            sourcePage = m.page;
            confidence = m.conf;
            hasUnconfirmedAi = true;
          }
        } else if (field.key.includes("dob") || field.key === "date_of_birth" || field.key === "client_dob") {
          const m = docFields["date_of_birth"] || docFields["dob"];
          if (m) {
            answerValue = normalizeDateToDDMMYYYY(m.val);
            sourceType = "document_ocr";
            sourceLabel = m.docTitle;
            sourceDocId = m.docId;
            sourcePage = m.page;
            confidence = m.conf;
            hasUnconfirmedAi = true;
          }
        } else if (field.key === "residential_address" || field.key === "current_residential_address") {
          const m = docFields["address"] || docFields["residential_address"];
          if (m) {
            answerValue = m.val;
            sourceType = "document_ocr";
            sourceLabel = m.docTitle;
            sourceDocId = m.docId;
            sourcePage = m.page;
            confidence = m.conf;
            hasUnconfirmedAi = true;
          }
        } else if (field.key === "visa_classification") {
          answerValue = caseItem?.visa_category?.includes("EB-1A") ? "EB1A_EXTRAORDINARY" : "EB1A_EXTRAORDINARY";
          sourceType = "client_profile";
          sourceLabel = "Case Strategy";
          isConfirmed = true;
        } else if (field.key === "proposed_endeavor_summary") {
          answerValue = caseItem?.title
            ? `Advanced scientific endeavor in support of ${caseItem.title}`
            : "High-impact technological research of national importance.";
          sourceType = "ai_generated";
          sourceLabel = "AI Synthesis Brief";
          confidence = 0.92;
          hasUnconfirmedAi = true;
        } else if (field.key === "prior_removal_or_criminal_record" || field.key === "inadmissibility_arrests_citations" || field.key === "prior_criminal_charges") {
          // Statutory sensitive fields always require human certified review
          answerValue = false;
          sourceType = "user_provided";
          sourceLabel = "Legal Questionnaire";
          isConfirmed = false;
        } else if (field.default !== undefined) {
          answerValue = field.default;
        }
      }

      if (answerValue !== undefined && answerValue !== "") {
        answeredFields++;
        answers[field.key] = {
          value: answerValue,
          source_type: sourceType,
          source_label: sourceLabel,
          source_id: sourceId,
          source_document_id: sourceDocId,
          source_page: sourcePage,
          extraction_confidence: confidence,
          is_confirmed: isConfirmed,
        };
      }
    }
  }

  const completion = totalRequiredFields > 0 ? Math.min(100, Math.round((answeredFields / totalRequiredFields) * 100)) : 100;

  return {
    id: `sub-${formCode.toLowerCase()}-${Date.now()}`,
    case_id: caseItem?.id || "case-01",
    form_code: formCode,
    form_name: schema.name,
    version_number: schema.versions[0]?.version_number || "v2026.1",
    status: "draft",
    completion_percentage: completion,
    has_unconfirmed_ai_fields: hasUnconfirmedAi,
    sensitive_fields_reviewed: false,
    revision_number: 1,
    answers,
    schema_definition: schema.versions[0]?.schema_definition,
  };
}

/**
 * Persists updated auto-fill information to local storage and broadcasts
 * the 'documento-autofill-updated' custom event.
 */
export function persistAndBroadcastAutoFill(
  storageKeyId: string,
  payload: {
    formData?: any;
    provenance?: Record<string, AutoFillFieldProvenance>;
    sourceDocId?: string;
    sourceFilename?: string;
  }
): void {
  if (typeof window === "undefined") return;

  const effectiveKey = storageKeyId || "default_client";

  try {
    const raw = window.localStorage.getItem(INITIAL_INFO_SHEET_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const existing = map[effectiveKey] || {};

    const mergedFormData = payload.formData
      ? {
          ...(existing.formData || {}),
          ...payload.formData,
          family: {
            ...(existing.formData?.family || {}),
            ...(payload.formData.family || {}),
          },
          sponsor: {
            ...(existing.formData?.sponsor || {}),
            ...(payload.formData.sponsor || {}),
          },
        }
      : existing.formData;

    const mergedProvenance = payload.provenance
      ? {
          ...(existing.fieldProvenance || {}),
          ...payload.provenance,
        }
      : existing.fieldProvenance;

    map[effectiveKey] = {
      ...existing,
      formData: mergedFormData,
      fieldProvenance: mergedProvenance,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(INITIAL_INFO_SHEET_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota or parsing fallback
  }

  // Dispatch custom broadcast event
  const detail = {
    storageKeyId: effectiveKey,
    ...payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent("documento-autofill-updated", { detail }));
}

/**
 * Retrieves persisted auto-fill provenance mapping for a given client / case.
 */
export function getAutoFillProvenance(storageKeyId: string): Record<string, AutoFillFieldProvenance> {
  if (typeof window === "undefined" || !storageKeyId) return {};
  try {
    const raw = window.localStorage.getItem(INITIAL_INFO_SHEET_STORAGE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw);
    return map[storageKeyId]?.fieldProvenance || {};
  } catch {
    return {};
  }
}
