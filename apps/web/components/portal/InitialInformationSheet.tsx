import React, { useState } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

export interface InitialInformationSheetProps {
  onSaved?: (data: any) => void;
  onSubmitToOfficer?: (data: any) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export function InitialInformationSheet({
  onSaved,
  onSubmitToOfficer,
  isModal = false,
  onClose,
}: InitialInformationSheetProps) {
  const [activeSection, setActiveSection] = useState<string>("applicant_biodata");
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Form State initialized with clean, schema-driven empty default values (No static personal data)
  const [formData, setFormData] = useState({
    // Page 1: Main Applicant
    family_name: "",
    given_names: "",
    dob: "",
    city_country_birth: "",
    gender: "MALE",
    first_language: "",
    residential_address: "",
    phone_number: "",
    email: "",
    marital_status: "SINGLE",
    date_of_marriage: "",
    divorced_details: "",

    // Entry & Refusals
    visited_canada: "NO",
    purpose_of_visit: "",
    date_of_entry: "",
    date_of_exit: "",
    place_last_entry: "",
    has_refusals: "NO",
    refusals_notes: "",

    // Page 2: Relatives in Canada
    relatives: [] as Array<{
      id: string;
      full_name: string;
      dob: string;
      birth_place: string;
      marital_status: string;
      relationship: string;
      current_address: string;
      status_in_canada: string;
    }>,

    // Education
    education: [] as Array<{
      id: string;
      start_date: string;
      end_date: string;
      field_of_study: string;
      school_name: string;
      city_country: string;
    }>,

    // Page 3: Employment History
    employment: [] as Array<{
      id: string;
      start_date: string;
      end_date: string;
      job_title: string;
      company_name: string;
      company_address: string;
    }>,

    // Page 3: Travel History
    travel: [] as Array<{
      id: string;
      start_date: string;
      end_date: string;
      destination: string;
      reason: string;
    }>,

    // Page 4: Family Information
    family: {
      mother: {
        name: "",
        dob: "",
        birth_place: "",
        address: "",
        marital_status: "",
        occupation: "",
      },
      father: {
        name: "",
        dob: "",
        birth_place: "",
        address: "",
        marital_status: "",
        occupation: "",
      },
      spouse: {
        name: "",
        dob: "",
        birth_place: "",
        address: "",
        marital_status: "",
        occupation: "",
      },
      sister: {
        name: "",
        dob: "",
        birth_place: "",
        address: "",
        marital_status: "",
        occupation: "",
      },
    },

    // Page 5: Additional Info
    passport_number: "",
    passport_issue_place: "",
    passport_issue_date: "",
    passport_expiry_date: "",
    eye_color: "",
    height_cm: "",
    express_entry_file: "",
    wes_reference: "",
    ielts_reading: "",
    ielts_writing: "",
    ielts_listening: "",
    ielts_speaking: "",
    has_lmia: "NO",
    original_entry_date: "",
    original_entry_purpose: "",
    original_entry_place: "",
    recent_entry_date: "",
    recent_entry_place: "",

    // Page 6: Address History
    addresses: [] as Array<{
      id: string;
      from: string;
      to: string;
      address: string;
    }>,

    // Pages 7-12: Sponsor Details & Relationship
    sponsor: {
      name: "",
      dob: "",
      sex: "FEMALE",
      birth_place: "",
      status_canada: "PR",
      pr_date: "",
      uci: "",
      passport_no: "",
      pr_card_no: "",
      marital_status: "MARRIED",
      marriage_date: "",
      spouse_name: "",
      current_address: "",
      email: "",
      phone: "",

      employment: [] as Array<{
        id: string;
        from: string;
        to: string;
        employer: string;
        role: string;
        salary: string;
      }>,

      education: [] as Array<{
        id: string;
        from: string;
        to: string;
        institution: string;
        degree: string;
        field: string;
      }>,

      first_met_date: "",
      first_met_where: "",
      first_met_circumstances: "",
      introduced_by: "NO",
      contact_before: "NO",
      living_together: "NO",
      living_together_since: "",
      languages_used: "",
      communication_frequency: "",
      friends_know: "NO",
      arranged_marriage: "NO",
      events: [] as Array<{
        id: string;
        date: string;
        name: string;
        location: string;
        guests: string;
        parents_attended: string;
      }>,
      is_pregnant: "NO",
    },

    // Page 12: Declaration
    declaration_signed: false,
    signature: "",
    signature_date: "",
    signature_place: "",
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFamilyChange = (member: "mother" | "father" | "spouse" | "sister", field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      family: {
        ...prev.family,
        [member]: {
          ...prev.family[member],
          [field]: value,
        },
      },
    }));
  };

  const handleSponsorChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      sponsor: {
        ...prev.sponsor,
        [field]: value,
      },
    }));
  };

  const handleAddRelative = () => {
    setFormData((prev) => ({
      ...prev,
      relatives: [
        ...prev.relatives,
        {
          id: `rel-${Date.now()}`,
          full_name: "",
          dob: "",
          birth_place: "",
          marital_status: "SINGLE",
          relationship: "SISTER",
          current_address: "",
          status_in_canada: "CITIZEN",
        },
      ],
    }));
  };

  const handleRemoveRelative = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      relatives: prev.relatives.filter((r) => r.id !== id),
    }));
  };

  const handleAddEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: `edu-${Date.now()}`,
          start_date: "",
          end_date: "",
          field_of_study: "",
          school_name: "",
          city_country: "",
        },
      ],
    }));
  };

  const handleRemoveEducation = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }));
  };

  const handleAddEmployment = () => {
    setFormData((prev) => ({
      ...prev,
      employment: [
        ...prev.employment,
        {
          id: `emp-${Date.now()}`,
          start_date: "",
          end_date: "",
          job_title: "",
          company_name: "",
          company_address: "",
        },
      ],
    }));
  };

  const handleRemoveEmployment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      employment: prev.employment.filter((e) => e.id !== id),
    }));
  };

  const handleAddTravel = () => {
    setFormData((prev) => ({
      ...prev,
      travel: [
        ...prev.travel,
        {
          id: `trv-${Date.now()}`,
          start_date: "",
          end_date: "",
          destination: "",
          reason: "",
        },
      ],
    }));
  };

  const handleRemoveTravel = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      travel: prev.travel.filter((t) => t.id !== id),
    }));
  };

  const handleAddAddress = () => {
    setFormData((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses,
        {
          id: `addr-${Date.now()}`,
          from: "",
          to: "",
          address: "",
        },
      ],
    }));
  };

  const handleRemoveAddress = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((a) => a.id !== id),
    }));
  };

  const handleAddSponsorEvent = () => {
    setFormData((prev) => ({
      ...prev,
      sponsor: {
        ...prev.sponsor,
        events: [
          ...prev.sponsor.events,
          {
            id: `ev-${Date.now()}`,
            date: "",
            name: "",
            location: "",
            guests: "",
            parents_attended: "YES",
          },
        ],
      },
    }));
  };

  const handleRemoveSponsorEvent = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      sponsor: {
        ...prev.sponsor,
        events: prev.sponsor.events.filter((_, i) => i !== idx),
      },
    }));
  };

  const handleSaveDraft = () => {
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
    if (onSaved) onSaved(formData);
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    if (onSubmitToOfficer) onSubmitToOfficer(formData);
  };

  const sections = [
    { key: "applicant_biodata", label: "1. Main Applicant Biodata", icon: "👤" },
    { key: "entry_refusals", label: "2. Entry & Refusal History", icon: "✈️" },
    { key: "relatives", label: "3. Relatives in Canada", icon: "👥" },
    { key: "education", label: "4. Education History", icon: "🎓" },
    { key: "employment", label: "5. Employment (10-Yr)", icon: "💼" },
    { key: "travel", label: "6. Travel History (10-Yr)", icon: "🗺️" },
    { key: "family", label: "7. Family Information Register", icon: "👨‍👩‍👧" },
    { key: "additional", label: "8. Passport & Language Scores", icon: "🛂" },
    { key: "addresses", label: "9. Address History (No Gaps)", icon: "🏠" },
    { key: "sponsor", label: "10. Sponsor & Relationship Details", icon: "💍" },
    { key: "declaration", label: "11. Declaration & Signing", icon: "✍️" },
  ];

  const applicantDisplayName =
    formData.family_name || formData.given_names
      ? `${formData.family_name}${formData.given_names ? `, ${formData.given_names}` : ""}`
      : "Applicant Intake In Progress";

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Form Header Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
          color: "#FFFFFF",
          borderRadius: "14px",
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 4px 14px rgba(6, 60, 61, 0.12)",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Statutory Immigration Intake • 12-Page Record
            </span>
            <Badge
              variant={isSubmitted ? "verified" : "review"}
              style={{ background: isSubmitted ? "#22C55E" : "#F59E0B", color: "#FFFFFF", border: "none" }}
            >
              {isSubmitted ? "Submitted to Case Officer ✓" : "Intake In Progress"}
            </Badge>
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.01em" }}>
            Main Applicant Initial Information Sheet
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#DCE5E1", lineHeight: 1.5, maxWidth: "720px" }}>
            Primary Applicant: <strong>{applicantDisplayName}</strong> • Dates formatted in <strong>DD/MM/YYYY</strong> • All data synchronized with official civil and travel documents.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {isSavedNotice && (
            <span style={{ fontSize: "12px", background: "rgba(34, 197, 94, 0.2)", color: "#86EFAC", padding: "6px 12px", borderRadius: "6px" }}>
              ✓ Progress Saved!
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              fontWeight: 650,
              borderRadius: "8px",
            }}
          >
            💾 Save Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            style={{
              background: "#FFFFFF",
              color: "#063C3D",
              fontWeight: 700,
              border: "none",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            {isSubmitted ? "✓ Re-Submit to Officer" : "🚀 Submit to Officer"}
          </Button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close information sheet"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#FFFFFF",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Official Intake Guidelines Notice */}
      <div
        style={{
          background: "#FEF7EA",
          border: "1px solid #FCD34D",
          borderRadius: "10px",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "20px" }}>📌</span>
        <div style={{ fontSize: "12px", color: "#8A5A10", lineHeight: 1.5 }}>
          <strong>Statutory Filing Instructions:</strong> Kindly fill out the information for all your family members whether they are accompanying or not (e.g. Spouse, Children, Parents, Siblings). Ensure all dates follow the format <strong>DD/MM/YYYY</strong>. Full completeness avoids processing delays or IRCC statutory procedural fairness letters (PFL).
        </div>
      </div>

      {/* Main Layout: Left Section Tabs & Right Form View */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Navigation Section Selector */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#6E7F7C",
              textTransform: "uppercase",
              padding: "6px 10px 8px 10px",
              borderBottom: "1px solid #E2E8F0",
              marginBottom: "4px",
            }}
          >
            Intake Sections (12 Pages)
          </div>

          {sections.map((sec) => {
            const isActive = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveSection(sec.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: isActive ? "1px solid #B9DED4" : "1px solid transparent",
                  background: isActive ? "#EAF6F0" : "transparent",
                  color: isActive ? "#0D6866" : "#334155",
                  fontSize: "12px",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{sec.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sec.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Section Detail Content Container */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "14px",
            padding: "24px 28px",
            boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
          }}
        >
          {/* Section 1: Main Applicant Biodata */}
          {activeSection === "applicant_biodata" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                  Section 1: Main Applicant Biodata &amp; Civil Identity
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                  As recorded on official international passport and civil records.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Family Name / Surname *
                  </label>
                  <input
                    type="text"
                    value={formData.family_name}
                    placeholder="Enter family name (as in passport)"
                    onChange={(e) => handleInputChange("family_name", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Given Name(s) (First Name &amp; Middle Name) *
                  </label>
                  <input
                    type="text"
                    value={formData.given_names}
                    placeholder="Enter given name(s)"
                    onChange={(e) => handleInputChange("given_names", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Date of Birth (DD/MM/YYYY) *
                  </label>
                  <input
                    type="text"
                    value={formData.dob}
                    placeholder="DD/MM/YYYY"
                    onChange={(e) => handleInputChange("dob", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Gender *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange("gender", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    First Language *
                  </label>
                  <input
                    type="text"
                    value={formData.first_language}
                    placeholder="Native / first language"
                    onChange={(e) => handleInputChange("first_language", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                  City and Country of Birth (as per passport) *
                </label>
                <input
                  type="text"
                  value={formData.city_country_birth}
                  placeholder="e.g. City, Province/State, Country"
                  onChange={(e) => handleInputChange("city_country_birth", e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Current Residential Address *
                </label>
                <input
                  type="text"
                  value={formData.residential_address}
                  placeholder="Street address, unit, city, postal code, country"
                  onChange={(e) => handleInputChange("residential_address", e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    placeholder="e.g. +1 (555) 000-0000"
                    onChange={(e) => handleInputChange("phone_number", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    placeholder="applicant@domain.com"
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Marital Status *
                  </label>
                  <select
                    value={formData.marital_status}
                    onChange={(e) => handleInputChange("marital_status", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  >
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="COMMON_LAW">Common-Law</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>
                    Date of Marriage (DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={formData.date_of_marriage}
                    placeholder="DD/MM/YYYY (if applicable)"
                    onChange={(e) => handleInputChange("date_of_marriage", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Entry & Refusals */}
          {activeSection === "entry_refusals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                  Section 2: Previous Travel &amp; Refusal History
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                  Official record of Canadian entries, departures, and any worldwide visa refusals.
                </p>
              </div>

              <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "8px" }}>
                  Have you visited Canada before? (YES / NO)
                </label>
                <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="visited_canada"
                      value="YES"
                      checked={formData.visited_canada === "YES"}
                      onChange={() => handleInputChange("visited_canada", "YES")}
                    />
                    YES
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="visited_canada"
                      value="NO"
                      checked={formData.visited_canada === "NO"}
                      onChange={() => handleInputChange("visited_canada", "NO")}
                    />
                    NO
                  </label>
                </div>

                {formData.visited_canada === "YES" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 650, color: "#475569" }}>Purpose of Visit</label>
                      <input
                        type="text"
                        placeholder="e.g. Study, Work, Tourism"
                        value={formData.purpose_of_visit}
                        onChange={(e) => handleInputChange("purpose_of_visit", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 650, color: "#475569" }}>Date of Entry (DD/MM/YYYY)</label>
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={formData.date_of_entry}
                        onChange={(e) => handleInputChange("date_of_entry", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 650, color: "#475569" }}>Place of Last Entry</label>
                      <input
                        type="text"
                        placeholder="e.g. Toronto Pearson Airport"
                        value={formData.place_last_entry}
                        onChange={(e) => handleInputChange("place_last_entry", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 650, color: "#475569" }}>Most Recent Entry Date</label>
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={formData.recent_entry_date}
                        onChange={(e) => handleInputChange("recent_entry_date", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #DCE5E1" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "8px" }}>
                  Have you had any kind of Refusal for Canada or any other country? (YES / NO)
                </label>
                <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="has_refusals"
                      value="YES"
                      checked={formData.has_refusals === "YES"}
                      onChange={() => handleInputChange("has_refusals", "YES")}
                    />
                    YES
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="has_refusals"
                      value="NO"
                      checked={formData.has_refusals === "NO"}
                      onChange={() => handleInputChange("has_refusals", "NO")}
                    />
                    NO (Never refused)
                  </label>
                </div>
                <input
                  type="text"
                  value={formData.refusals_notes}
                  onChange={(e) => handleInputChange("refusals_notes", e.target.value)}
                  placeholder="Provide refusal details (Date, Type of Refusal, Country) if YES, or note None"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                />
              </div>
            </div>
          )}

          {/* Section 3: Relatives in Canada */}
          {activeSection === "relatives" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                    Section 3: Relatives Living in Destination Country (Canada)
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                    Family members currently residing in Canada (e.g. Sibling, Parent, Extended Family).
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddRelative} style={{ fontWeight: 650 }}>
                  + Add Relative
                </Button>
              </div>

              {formData.relatives.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "10px",
                    padding: "28px",
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>👥</div>
                  No relatives currently recorded. Click <strong>&quot;+ Add Relative&quot;</strong> to declare family members residing in Canada.
                </div>
              ) : (
                formData.relatives.map((rel, idx) => (
                  <div
                    key={rel.id}
                    style={{
                      background: "#F8FAF9",
                      border: "1px solid #B9DED4",
                      borderRadius: "10px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "13px", color: "#063C3D" }}>
                        Relative #{idx + 1}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveRelative(rel.id)}
                        style={{ background: "transparent", border: "none", color: "#DC2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", fontSize: "12px" }}>
                      <div>
                        <label style={{ color: "#64748B", display: "block", marginBottom: "2px" }}>Full Name</label>
                        <input
                          type="text"
                          value={rel.full_name}
                          placeholder="Full Legal Name"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              relatives: prev.relatives.map((r) => (r.id === rel.id ? { ...r, full_name: val } : r)),
                            }));
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                      <div>
                        <label style={{ color: "#64748B", display: "block", marginBottom: "2px" }}>Relationship</label>
                        <input
                          type="text"
                          value={rel.relationship}
                          placeholder="e.g. Sister, Brother, Parent"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              relatives: prev.relatives.map((r) => (r.id === rel.id ? { ...r, relationship: val } : r)),
                            }));
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                      <div>
                        <label style={{ color: "#64748B", display: "block", marginBottom: "2px" }}>Status in Canada</label>
                        <input
                          type="text"
                          value={rel.status_in_canada}
                          placeholder="e.g. Citizen, PR, Student"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              relatives: prev.relatives.map((r) => (r.id === rel.id ? { ...r, status_in_canada: val } : r)),
                            }));
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Section 4: Education History */}
          {activeSection === "education" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                    Section 4: Complete Education History (Secondary &amp; Post-Secondary)
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                    All schools, colleges, and university degrees completed or attempted.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddEducation} style={{ fontWeight: 650 }}>
                  + Add Education Record
                </Button>
              </div>

              {formData.education.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "10px",
                    padding: "28px",
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>🎓</div>
                  No education records added yet. Click <strong>&quot;+ Add Education Record&quot;</strong> to add your academic history.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {formData.education.map((edu, idx) => (
                    <div
                      key={edu.id}
                      style={{
                        background: "#F8FAF9",
                        border: "1px solid #DCE5E1",
                        borderRadius: "8px",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866" }}>Record #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEducation(edu.id)}
                          style={{ background: "transparent", border: "none", color: "#DC2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={edu.school_name}
                          placeholder="Institution / School Name"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              education: prev.education.map((item) => (item.id === edu.id ? { ...item, school_name: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={edu.field_of_study}
                          placeholder="Field of Study / Degree"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              education: prev.education.map((item) => (item.id === edu.id ? { ...item, field_of_study: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={edu.start_date}
                          placeholder="Start (DD/MM/YYYY)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              education: prev.education.map((item) => (item.id === edu.id ? { ...item, start_date: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={edu.end_date}
                          placeholder="End (DD/MM/YYYY)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              education: prev.education.map((item) => (item.id === edu.id ? { ...item, end_date: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={edu.city_country}
                          placeholder="City, Country"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              education: prev.education.map((item) => (item.id === edu.id ? { ...item, city_country: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 5: Employment History */}
          {activeSection === "employment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                    Section 5: Employment History (Last 5–10 Years, No Gaps)
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                    Complete chronological employment history matching statutory requirements.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddEmployment} style={{ fontWeight: 650 }}>
                  + Add Employment Record
                </Button>
              </div>

              {formData.employment.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "10px",
                    padding: "28px",
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>💼</div>
                  No employment history added yet. Click <strong>&quot;+ Add Employment Record&quot;</strong> to record continuous employment.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {formData.employment.map((emp, idx) => (
                    <div
                      key={emp.id}
                      style={{
                        background: "#F8FAF9",
                        border: "1px solid #DCE5E1",
                        borderRadius: "8px",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866" }}>Employment #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployment(emp.id)}
                          style={{ background: "transparent", border: "none", color: "#DC2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={emp.job_title}
                          placeholder="Job Title / Position"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              employment: prev.employment.map((item) => (item.id === emp.id ? { ...item, job_title: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={emp.company_name}
                          placeholder="Company / Employer Name"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              employment: prev.employment.map((item) => (item.id === emp.id ? { ...item, company_name: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={emp.start_date}
                          placeholder="From (DD/MM/YYYY)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              employment: prev.employment.map((item) => (item.id === emp.id ? { ...item, start_date: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={emp.end_date}
                          placeholder="To (DD/MM/YYYY or PRESENT)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              employment: prev.employment.map((item) => (item.id === emp.id ? { ...item, end_date: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={emp.company_address}
                          placeholder="Company City & Address"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              employment: prev.employment.map((item) => (item.id === emp.id ? { ...item, company_address: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 6: Travel History */}
          {activeSection === "travel" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                    Section 6: Travel History of the Last 10 Years
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                    All international visits, personal trips, and holidays outside country of origin.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddTravel} style={{ fontWeight: 650 }}>
                  + Add Travel Record
                </Button>
              </div>

              {formData.travel.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "10px",
                    padding: "28px",
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>🗺️</div>
                  No international travel recorded yet. Click <strong>&quot;+ Add Travel Record&quot;</strong> to record trips.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {formData.travel.map((trv, idx) => (
                    <div
                      key={trv.id}
                      style={{
                        background: "#F8FAF9",
                        border: "1px solid #DCE5E1",
                        borderRadius: "8px",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866" }}>Trip #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTravel(trv.id)}
                          style={{ background: "transparent", border: "none", color: "#DC2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={trv.destination}
                          placeholder="Destination Country & City"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              travel: prev.travel.map((item) => (item.id === trv.id ? { ...item, destination: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={trv.reason}
                          placeholder="Purpose of Trip (e.g. Tourism, Business)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              travel: prev.travel.map((item) => (item.id === trv.id ? { ...item, reason: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={trv.start_date}
                          placeholder="Departure (DD/MM/YYYY)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              travel: prev.travel.map((item) => (item.id === trv.id ? { ...item, start_date: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={trv.end_date}
                          placeholder="Return (DD/MM/YYYY)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              travel: prev.travel.map((item) => (item.id === trv.id ? { ...item, end_date: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 7: Family Register */}
          {activeSection === "family" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                  Section 7: Family Information Register (Immediate Family)
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                  Please provide all details even if the family member is deceased (Form IMM 5406 statutory compliance).
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* Mother */}
                <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #DCE5E1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>Mother</span>
                  <input
                    type="text"
                    value={formData.family.mother.name}
                    placeholder="Mother's Full Legal Name"
                    onChange={(e) => handleFamilyChange("mother", "name", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input
                      type="text"
                      value={formData.family.mother.dob}
                      placeholder="DOB (DD/MM/YYYY)"
                      onChange={(e) => handleFamilyChange("mother", "dob", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                    <input
                      type="text"
                      value={formData.family.mother.birth_place}
                      placeholder="Birth City, Country"
                      onChange={(e) => handleFamilyChange("mother", "birth_place", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.family.mother.address}
                    placeholder="Residential Address"
                    onChange={(e) => handleFamilyChange("mother", "address", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <input
                    type="text"
                    value={formData.family.mother.occupation}
                    placeholder="Occupation / Status"
                    onChange={(e) => handleFamilyChange("mother", "occupation", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                </div>

                {/* Father */}
                <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #DCE5E1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>Father</span>
                  <input
                    type="text"
                    value={formData.family.father.name}
                    placeholder="Father's Full Legal Name"
                    onChange={(e) => handleFamilyChange("father", "name", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input
                      type="text"
                      value={formData.family.father.dob}
                      placeholder="DOB (DD/MM/YYYY)"
                      onChange={(e) => handleFamilyChange("father", "dob", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                    <input
                      type="text"
                      value={formData.family.father.birth_place}
                      placeholder="Birth City, Country"
                      onChange={(e) => handleFamilyChange("father", "birth_place", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.family.father.address}
                    placeholder="Residential Address"
                    onChange={(e) => handleFamilyChange("father", "address", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <input
                    type="text"
                    value={formData.family.father.occupation}
                    placeholder="Occupation / Status"
                    onChange={(e) => handleFamilyChange("father", "occupation", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                </div>

                {/* Spouse */}
                <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #DCE5E1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>Spouse / Partner</span>
                  <input
                    type="text"
                    value={formData.family.spouse.name}
                    placeholder="Spouse's Full Legal Name"
                    onChange={(e) => handleFamilyChange("spouse", "name", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input
                      type="text"
                      value={formData.family.spouse.dob}
                      placeholder="DOB (DD/MM/YYYY)"
                      onChange={(e) => handleFamilyChange("spouse", "dob", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                    <input
                      type="text"
                      value={formData.family.spouse.birth_place}
                      placeholder="Birth City, Country"
                      onChange={(e) => handleFamilyChange("spouse", "birth_place", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.family.spouse.address}
                    placeholder="Residential Address"
                    onChange={(e) => handleFamilyChange("spouse", "address", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <input
                    type="text"
                    value={formData.family.spouse.occupation}
                    placeholder="Current Occupation"
                    onChange={(e) => handleFamilyChange("spouse", "occupation", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                </div>

                {/* Sibling */}
                <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #DCE5E1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>Sibling</span>
                  <input
                    type="text"
                    value={formData.family.sister.name}
                    placeholder="Sibling's Full Legal Name"
                    onChange={(e) => handleFamilyChange("sister", "name", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input
                      type="text"
                      value={formData.family.sister.dob}
                      placeholder="DOB (DD/MM/YYYY)"
                      onChange={(e) => handleFamilyChange("sister", "dob", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                    <input
                      type="text"
                      value={formData.family.sister.birth_place}
                      placeholder="Birth City, Country"
                      onChange={(e) => handleFamilyChange("sister", "birth_place", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.family.sister.address}
                    placeholder="Residential Address"
                    onChange={(e) => handleFamilyChange("sister", "address", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <input
                    type="text"
                    value={formData.family.sister.occupation}
                    placeholder="Occupation / Status"
                    onChange={(e) => handleFamilyChange("sister", "occupation", e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 8: Additional Information & Passport */}
          {activeSection === "additional" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                  Section 8: Additional Information, Passport &amp; Language Scores
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                  Passports, physical attributes, and standardized examination records.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>Passport Number</label>
                  <input
                    type="text"
                    value={formData.passport_number}
                    placeholder="e.g. Passport ID Number"
                    onChange={(e) => handleInputChange("passport_number", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>Place of Issue</label>
                  <input
                    type="text"
                    value={formData.passport_issue_place}
                    placeholder="e.g. Issuing City / Authority"
                    onChange={(e) => handleInputChange("passport_issue_place", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>Issue Date</label>
                  <input
                    type="text"
                    value={formData.passport_issue_date}
                    placeholder="DD/MM/YYYY"
                    onChange={(e) => handleInputChange("passport_issue_date", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>Expiry Date</label>
                  <input
                    type="text"
                    value={formData.passport_expiry_date}
                    placeholder="DD/MM/YYYY"
                    onChange={(e) => handleInputChange("passport_expiry_date", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>Color of Eyes</label>
                  <input
                    type="text"
                    value={formData.eye_color}
                    placeholder="e.g. Brown, Black, Blue"
                    onChange={(e) => handleInputChange("eye_color", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 650, color: "#334155", display: "block", marginBottom: "4px" }}>Height in CM</label>
                  <input
                    type="text"
                    value={formData.height_cm}
                    placeholder="e.g. 175 CM"
                    onChange={(e) => handleInputChange("height_cm", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ background: "#F8FAF9", padding: "14px 16px", borderRadius: "8px", border: "1px solid #B9DED4" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "8px" }}>
                  IELTS / CELPIP / PTE Language Test Breakdown
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Reading</label>
                    <input
                      type="text"
                      value={formData.ielts_reading}
                      placeholder="e.g. 7.0"
                      onChange={(e) => handleInputChange("ielts_reading", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Writing</label>
                    <input
                      type="text"
                      value={formData.ielts_writing}
                      placeholder="e.g. 7.0"
                      onChange={(e) => handleInputChange("ielts_writing", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Listening</label>
                    <input
                      type="text"
                      value={formData.ielts_listening}
                      placeholder="e.g. 7.5"
                      onChange={(e) => handleInputChange("ielts_listening", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Speaking</label>
                    <input
                      type="text"
                      value={formData.ielts_speaking}
                      placeholder="e.g. 7.0"
                      onChange={(e) => handleInputChange("ielts_speaking", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 9: Address History */}
          {activeSection === "addresses" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                    Section 9: Address History (Since Age 18, Zero Gaps)
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                    Complete residency history covering all residential addresses since age 18.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddAddress} style={{ fontWeight: 650 }}>
                  + Add Address Record
                </Button>
              </div>

              {formData.addresses.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAF9",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "10px",
                    padding: "28px",
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>🏠</div>
                  No past addresses added yet. Click <strong>&quot;+ Add Address Record&quot;</strong> to record continuous residential history.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {formData.addresses.map((addr, idx) => (
                    <div
                      key={addr.id}
                      style={{
                        background: "#F8FAF9",
                        border: "1px solid #DCE5E1",
                        borderRadius: "8px",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866" }}>Address #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddress(addr.id)}
                          style={{ background: "transparent", border: "none", color: "#DC2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={addr.address}
                        placeholder="Street Address, City, State/Province, Country"
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            addresses: prev.addresses.map((item) => (item.id === addr.id ? { ...item, address: val } : item)),
                          }));
                        }}
                        style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          value={addr.from}
                          placeholder="From (DD/MM/YYYY)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              addresses: prev.addresses.map((item) => (item.id === addr.id ? { ...item, from: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                        <input
                          type="text"
                          value={addr.to}
                          placeholder="To (DD/MM/YYYY or PRESENT)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              addresses: prev.addresses.map((item) => (item.id === addr.id ? { ...item, to: val } : item)),
                            }));
                          }}
                          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 10: Sponsor & Relationship Details */}
          {activeSection === "sponsor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                  Section 10: Sponsor Personal Details &amp; Relationship History
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                  Sponsor credentials, employment, and comprehensive relationship history.
                </p>
              </div>

              <div style={{ background: "#F8FAF9", padding: "16px", borderRadius: "10px", border: "1px solid #B9DED4", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "13px", fontWeight: 750, color: "#063C3D" }}>
                  Sponsor Legal Identity &amp; Status
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Sponsor Full Legal Name</label>
                    <input
                      type="text"
                      value={formData.sponsor.name}
                      placeholder="Sponsor's Full Name"
                      onChange={(e) => handleSponsorChange("name", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Status in Canada</label>
                    <select
                      value={formData.sponsor.status_canada}
                      onChange={(e) => handleSponsorChange("status_canada", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    >
                      <option value="CITIZEN">Canadian Citizen</option>
                      <option value="PR">Permanent Resident (PR)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Date of Birth</label>
                    <input
                      type="text"
                      value={formData.sponsor.dob}
                      placeholder="DD/MM/YYYY"
                      onChange={(e) => handleSponsorChange("dob", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>UCI / Client ID</label>
                    <input
                      type="text"
                      value={formData.sponsor.uci}
                      placeholder="UCI Identifier"
                      onChange={(e) => handleSponsorChange("uci", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>PR Confirmation Date</label>
                    <input
                      type="text"
                      value={formData.sponsor.pr_date}
                      placeholder="MM/YYYY or DD/MM/YYYY"
                      onChange={(e) => handleSponsorChange("pr_date", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Sponsor Phone</label>
                    <input
                      type="text"
                      value={formData.sponsor.phone}
                      placeholder="+1 (555) 000-0000"
                      onChange={(e) => handleSponsorChange("phone", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "2px" }}>Sponsor Email</label>
                    <input
                      type="email"
                      value={formData.sponsor.email}
                      placeholder="sponsor@domain.com"
                      onChange={(e) => handleSponsorChange("email", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Relationship Questions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "2px" }}>First Met in Person (Date)</label>
                    <input
                      type="text"
                      value={formData.sponsor.first_met_date}
                      placeholder="e.g. July 2020 or DD/MM/YYYY"
                      onChange={(e) => handleSponsorChange("first_met_date", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "2px" }}>First Met (Location)</label>
                    <input
                      type="text"
                      value={formData.sponsor.first_met_where}
                      placeholder="e.g. City, Country"
                      onChange={(e) => handleSponsorChange("first_met_where", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "2px" }}>Circumstances of First Meeting</label>
                  <input
                    type="text"
                    value={formData.sponsor.first_met_circumstances}
                    placeholder="Briefly describe the circumstances of how you met"
                    onChange={(e) => handleSponsorChange("first_met_circumstances", e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "2px" }}>Living Together Now? (YES / NO)</label>
                    <select
                      value={formData.sponsor.living_together}
                      onChange={(e) => handleSponsorChange("living_together", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    >
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "2px" }}>Living Together Since</label>
                    <input
                      type="text"
                      value={formData.sponsor.living_together_since}
                      placeholder="e.g. Date / Milestone"
                      onChange={(e) => handleSponsorChange("living_together_since", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <strong style={{ color: "#063C3D" }}>Ceremonies &amp; Relationship Milestone Events:</strong>
                    <Button variant="outline" size="sm" onClick={handleAddSponsorEvent} style={{ fontSize: "11px", padding: "3px 8px" }}>
                      + Add Event
                    </Button>
                  </div>
                  {formData.sponsor.events.length === 0 ? (
                    <div style={{ background: "#F8FAF9", padding: "12px", borderRadius: "6px", border: "1px dashed #CBD5E1", color: "#64748B", textAlign: "center" }}>
                      No milestone events recorded yet. Click <strong>&quot;+ Add Event&quot;</strong> to record ceremonies and receptions.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {formData.sponsor.events.map((ev, idx) => (
                        <div key={idx} style={{ background: "#F1F5F9", padding: "8px 10px", borderRadius: "6px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "6px", alignItems: "center" }}>
                          <input
                            type="text"
                            value={ev.name}
                            placeholder="Event / Ceremony Name"
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                sponsor: {
                                  ...prev.sponsor,
                                  events: prev.sponsor.events.map((item, i) => (i === idx ? { ...item, name: val } : item)),
                                },
                              }));
                            }}
                            style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "11px" }}
                          />
                          <input
                            type="text"
                            value={ev.date}
                            placeholder="Date (DD/MM/YYYY)"
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                sponsor: {
                                  ...prev.sponsor,
                                  events: prev.sponsor.events.map((item, i) => (i === idx ? { ...item, date: val } : item)),
                                },
                              }));
                            }}
                            style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "11px" }}
                          />
                          <input
                            type="text"
                            value={ev.location}
                            placeholder="Location / City"
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                sponsor: {
                                  ...prev.sponsor,
                                  events: prev.sponsor.events.map((item, i) => (i === idx ? { ...item, location: val } : item)),
                                },
                              }));
                            }}
                            style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "11px" }}
                          />
                          <input
                            type="text"
                            value={ev.guests}
                            placeholder="Approx Guests"
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                sponsor: {
                                  ...prev.sponsor,
                                  events: prev.sponsor.events.map((item, i) => (i === idx ? { ...item, guests: val } : item)),
                                },
                              }));
                            }}
                            style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "11px" }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSponsorEvent(idx)}
                            style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer", fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 11: Declaration & Signing */}
          {activeSection === "declaration" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 750, color: "#063C3D" }}>
                  Section 11: Statutory Declaration &amp; Electronic Confirmation
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                  Legal acknowledgement and electronic submission to supervising legal team.
                </p>
              </div>

              <div
                style={{
                  background: "#F8FAF9",
                  border: "1.5px solid #0D6866",
                  borderRadius: "10px",
                  padding: "18px 20px",
                }}
              >
                <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#1E293B", lineHeight: 1.6, fontStyle: "italic" }}>
                  &ldquo;I declare that the above-mentioned information is true and correct to the best of my knowledge and nothing has been concealed therein. I have all documentary proof to verify the above information which can be submitted upon Request.&rdquo;
                </p>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#063C3D", fontWeight: 650, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.declaration_signed}
                      onChange={(e) => handleInputChange("declaration_signed", e.target.checked)}
                    />
                    I confirm and agree to this statutory declaration under penalty of law.
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "4px" }}>
                      Electronic Signature (Type Full Legal Name) *
                    </label>
                    <input
                      type="text"
                      value={formData.signature}
                      placeholder="Type your full legal name to sign"
                      onChange={(e) => handleInputChange("signature", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        fontSize: "14px",
                        color: "#0D6866",
                        fontWeight: 650,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#063C3D", display: "block", marginBottom: "4px" }}>
                      Date &amp; Place of Signing
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      <input
                        type="text"
                        value={formData.signature_date}
                        placeholder="DD/MM/YYYY"
                        onChange={(e) => handleInputChange("signature_date", e.target.value)}
                        style={{ padding: "10px 12px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "12px" }}
                      />
                      <input
                        type="text"
                        value={formData.signature_place}
                        placeholder="City, Country"
                        onChange={(e) => handleInputChange("signature_place", e.target.value)}
                        style={{ padding: "10px 12px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "12px" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSaveDraft}
                  style={{ borderRadius: "8px", fontWeight: 650 }}
                >
                  Save as In-Progress Draft
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSubmit}
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    borderRadius: "8px",
                    padding: "10px 24px",
                  }}
                >
                  {isSubmitted ? "✓ Information Sheet Submitted" : "🚀 Submit Initial Information Sheet"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Main Applicant Initial Information Sheet"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(6, 60, 61, 0.45)",
          backdropFilter: "blur(4px)",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            maxWidth: "1080px",
            width: "100%",
            maxHeight: "92vh",
            overflowY: "auto",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(6, 60, 61, 0.2)",
            position: "relative",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
}
