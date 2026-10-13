"use client";

import React, { useState, useMemo } from "react";

export interface ImmigrationPathway {
  id: string;
  code: string;
  title: string;
  country: string;
  countryCode: "US" | "UK" | "CA" | "AU" | "DE";
  flag: string;
  governingBody: string;
  category: "Employment & Skilled Worker" | "Nonimmigrant Talent" | "Permanent Residence" | "Multinational Transfer";
  status: "Available" | "Planned";
  applicantProfile: string;
  statutoryBasis: string;
  formSupport: string;
  caseNeeds: string[];
  documentWorkflows: string[];
  documentoFeatures: string[];
  summary: string;
}

export const VERIFIED_PATHWAYS: ImmigrationPathway[] = [
  {
    id: "us-eb1a",
    code: "EB-1A",
    title: "EB-1A Extraordinary Ability",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Individuals with extraordinary ability in the sciences, arts, education, business, or athletics demonstrated by sustained national or international acclaim.",
    statutoryBasis: "INA § 203(b)(1)(A); 8 CFR § 204.5(h); Kazarian v. USCIS (two-part evaluation).",
    formSupport: "Form I-140 (Immigrant Petition for Alien Workers) & Form ETA-750B / I-485 supplement.",
    summary: "Full 10-criteria evaluation engine, publication citation extraction, and Kazarian final merits assessment tracking.",
    caseNeeds: [
      "Satisfy at least 3 of 10 regulatory criteria or major one-time international prize",
      "Document sustained national or international acclaim and peer recognized impact",
      "Demonstrate substantial prospective benefit to the United States",
      "Compile comprehensive exhibit catalog with indexed legal briefs",
    ],
    documentWorkflows: [
      "Peer-reviewed journal publications and citation count verification (IEEE, Nature, PubMed)",
      "Original scientific patents, licensing agreements, and commercial adoption reports",
      "Leading or critical role letters from distinguished institutional employers",
      "Media coverage articles in major trade publications or mainstream media",
      "Independent peer recommendation letters and jury evaluation records",
    ],
    documentoFeatures: [
      "10-criteria statutory checklist engine with versioned USCIS policy memos",
      "Automated cross-exhibit date and biographic anomaly detection",
      "SHA-256 exhibit fingerprinting and automatic exhibit tab index generator",
      "Kazarian two-stage analysis scorecard for supervising attorney review",
    ],
  },
  {
    id: "us-o1a",
    code: "O-1A",
    title: "O-1A Extraordinary Ability Nonimmigrant",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Nonimmigrant Talent",
    status: "Available",
    applicantProfile: "Top-tier professionals in science, technology, education, or business seeking temporary nonimmigrant employment authorization.",
    statutoryBasis: "INA § 101(a)(15)(O)(i); 8 CFR § 214.2(o); Form I-129 O/P Supplement.",
    formSupport: "Form I-129 (Petition for a Nonimmigrant Worker) & O-Supplement.",
    summary: "Petitioner/agent itinerary tracking, advisory opinion letters, and nonimmigrant petition assembly.",
    caseNeeds: [
      "Qualifying U.S. petitioner or agent contract with detailed itinerary",
      "Peer group or labor organization advisory consultation opinion letter",
      "Evidence satisfying at least 3 of 8 regulatory evidentiary criteria",
      "Defined validity period up to 3 years with extension management",
    ],
    documentWorkflows: [
      "Petitioner support agreements, offer letters, and agent representation contracts",
      "Advisory opinion letters from recognized industry peer organizations",
      "Critical employment letters and compensation benchmarking evidence",
      "Commercial impact analyses, conference keynote documentation, and press articles",
    ],
    documentoFeatures: [
      "Form I-129 field mapping with biographic integrity checks",
      "Advisory opinion tracking queue with expiration watches",
      "Dual waiting-state indicator (waiting on petitioner vs waiting on peer advisory)",
      "Exhibit assembly with automated sequential stamp generator",
    ],
  },
  {
    id: "us-eb2-niw",
    code: "EB-2 NIW",
    title: "EB-2 National Interest Waiver (NIW)",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Advanced degree professionals or exceptional ability individuals whose proposed endeavor has substantial merit and national importance.",
    statutoryBasis: "INA § 203(b)(1)(B); Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016).",
    formSupport: "Form I-140 (Immigrant Petition) with National Interest Waiver request.",
    summary: "Dhanasar 3-prong analytical matrix, proposed endeavor roadmap, and waiver justification evidence.",
    caseNeeds: [
      "Proof of Advanced Degree (U.S. Master's/Ph.D. or foreign equivalent) or Exceptional Ability (3 of 6 criteria)",
      "Prong 1: Proposed endeavor has substantial merit and national importance",
      "Prong 2: Beneficiary is well positioned to advance the proposed endeavor",
      "Prong 3: On balance, beneficial to the U.S. to waive the job offer and PERM labor certification",
    ],
    documentWorkflows: [
      "Academic credentials, foreign credential evaluations, and official transcripts",
      "Detailed proposed endeavor statement and technical whitepapers",
      "Letters of support from U.S. government stakeholders, industry leaders, and academics",
      "Grant awards (NSF, NIH, DoD, DOE) and venture capital funding evidence",
    ],
    documentoFeatures: [
      "Dhanasar 3-prong matrix evidence organizer with strength indicators",
      "Credential evaluation cross-verification with diploma metadata",
      "Support letter argument alignment tracker",
      "Immutable audit log of all legal brief revisions and exhibit references",
    ],
  },
  {
    id: "us-l1a",
    code: "L-1A",
    title: "L-1A Intracompany Transferee Executive/Manager",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Multinational Transfer",
    status: "Available",
    applicantProfile: "Executives or managers transferring from a qualifying foreign entity to an affiliated U.S. branch, subsidiary, or parent company.",
    statutoryBasis: "INA § 101(a)(15)(L); 8 CFR § 214.2(l); Form I-129 L-Supplement.",
    formSupport: "Form I-129 (L-1A Supplement) or Form I-129S (Blanket L Petition).",
    summary: "Corporate relationship mapping, managerial organizational charts, and 1-year qualifying foreign employment audit.",
    caseNeeds: [
      "Qualifying corporate relationship (parent, branch, subsidiary, or affiliate)",
      "Continuous 1 year of full-time foreign employment within the 3 years preceding entry",
      "Managerial (personnel or functional) or executive capacity duties in both entities",
      "Physical office documentation for new office petitions or commercial viability proof",
    ],
    documentWorkflows: [
      "Corporate stock certificates, articles of incorporation, and ownership ledgers",
      "Detailed foreign and U.S. organizational charts with subordinate staff descriptions",
      "Foreign tax filings, payroll records, and employee W-2/equivalent records",
      "Commercial lease agreements and U.S. business operational bank statements",
    ],
    documentoFeatures: [
      "Organizational tier analyzer verifying managerial vs non-managerial reporting lines",
      "1-year foreign employment continuous timeline calculator",
      "Multi-entity document repository maintaining parent and affiliate corporate filings",
      "Blanket L vs individual petition profile toggles",
    ],
  },
  {
    id: "uk-gtv",
    code: "UK GTV",
    title: "UK Global Talent Visa",
    country: "United Kingdom",
    countryCode: "UK",
    flag: "🇬🇧",
    governingBody: "Home Office / UK Visas and Immigration (UKVI)",
    category: "Employment & Skilled Worker",
    status: "Available",
    applicantProfile: "Leaders or emerging leaders in digital technology, academia, research, arts, or culture seeking UK settlement pathways.",
    statutoryBasis: "UK Immigration Rules Appendix Global Talent; Endorsing Bodies (Tech Nation, Royal Society, British Academy, UKRI).",
    formSupport: "Stage 1 Endorsement Application & Stage 2 UKVI Visa Application.",
    summary: "Two-stage endorsement tracking, 10-piece evidence dossier builder, and reference letter verification.",
    caseNeeds: [
      "Stage 1 Endorsement from designated endorsing body (e.g. Tech Nation / British Academy)",
      "Mandatory Criterion: Proof of leading talent or exceptional promise in digital technology",
      "At least 2 Optional Criteria (innovation, sector contributions, significant revenue/academic impact)",
      "Strict limit of 10 supporting documents (maximum 3 A4 pages per exhibit)",
    ],
    documentWorkflows: [
      "3 letters of recommendation from senior figures in recognized digital tech organizations",
      "Proof of product innovation, open-source adoption, or technical IP ownership",
      "Evidence of business impact, commercial growth, or leading advisory roles",
      "Applicant personal statement and CV aligned to endorsement guidelines",
    ],
    documentoFeatures: [
      "Stage 1 vs Stage 2 dual-milestone pipeline tracker",
      "10-document limit enforcement engine with page-length guardrails",
      "Tech Nation criteria checklist mapping each exhibit to specific optional requirements",
      "Direct client-to-counsel evidence review portal with translation verification",
    ],
  },
  {
    id: "ca-ee",
    code: "CA Express Entry",
    title: "Canada Express Entry (FSWP & PNP)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "Immigration, Refugees and Citizenship Canada (IRCC)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Skilled professionals seeking Canadian permanent residence through the Federal Skilled Worker Program (FSWP) or Provincial Nominee Programs (PNP).",
    statutoryBasis: "Immigration and Refugee Protection Act (IRPA); Express Entry Ministerial Instructions; NOC / TEER Matrix.",
    formSupport: "Express Entry Profile & Post-ITA e-APR (electronic Application for Permanent Residence).",
    summary: "CRS point scoring simulator, NOC/TEER classification validation, and post-ITA 60-day evidence checklist.",
    caseNeeds: [
      "Comprehensive Ranking System (CRS) score optimization across core human capital factors",
      "Language test benchmarks (IELTS / CELPIP / TEF / TCF meeting CLB 7+ requirements)",
      "Educational Credential Assessment (ECA) report (WES, ICAS, CES)",
      "Proof of funds or valid Canadian job offer with provincial nomination alignment",
    ],
    documentWorkflows: [
      "Official language score sheets with test date validity tracking (2-year validity)",
      "ECA credential reports mapped to Canadian equivalency levels",
      "Reference letters verifying full-time skilled work experience under specific NOC/TEER codes",
      "Police certificates, medical examination receipts, and settlement fund bank letters",
    ],
    documentoFeatures: [
      "Automated NOC/TEER job duty cross-examination against reference letter texts",
      "Post-ITA 60-day filing clock with countdown notifications for urgent police certificates",
      "Settlement funds currency exchange rate converter and financial compliance flags",
      "Dependant family inclusion profile builder with biometric tracking",
    ],
  },
  {
    id: "au-gti",
    code: "AU Subclass 858",
    title: "Australia Global Talent Visa (Subclass 858)",
    country: "Australia",
    countryCode: "AU",
    flag: "🇦🇺",
    governingBody: "Department of Home Affairs (Australia)",
    category: "Employment & Skilled Worker",
    status: "Planned",
    applicantProfile: "Highly skilled individuals with internationally recognized achievements in target priority sectors (e.g. Digitech, Medtech, Clean Energy).",
    statutoryBasis: "Migration Act 1958; Migration Regulations 1994 Subclass 858; Target Sector Policy Notices.",
    formSupport: "Expression of Interest (EOI) & Form 47GT / Form 1000 Nominee.",
    summary: "Roadmap: Expression of Interest (EOI) builder, Australian nominator verification, and Fair Work high-income threshold analyzer.",
    caseNeeds: [
      "International record of exceptional and outstanding achievement in a target priority sector",
      "Prominence in the field with evidence of sustained leadership",
      "Nomination by an Australian citizen, permanent resident, or peak Australian industry body",
      "Ability to earn above the Fair Work High Income Threshold (FWHIT)",
    ],
    documentWorkflows: [
      "Form 1000 nomination dossier from peak Australian body or Australian citizen peer",
      "Salary benchmark documentation and contracts demonstrating FWHIT earning capacity",
      "International awards, conference keynotes, and commercial product deliverables",
    ],
    documentoFeatures: [
      "Regulatory source monitoring tracking Australian Department of Home Affairs policy circulars",
      "Target sector criteria tagging (Digital Technology, Health Industries, Renewable Energy)",
      "FWHIT financial benchmark tracking module (under current active development)",
    ],
  },
  {
    id: "de-bluecard",
    code: "DE Blue Card",
    title: "Germany EU Blue Card & Chancenkarte",
    country: "Germany",
    countryCode: "DE",
    flag: "🇩🇪",
    governingBody: "BAMF / Federal Foreign Office (Germany)",
    category: "Employment & Skilled Worker",
    status: "Planned",
    applicantProfile: "University graduates and skilled specialists with qualifying job offers in Germany or points-based Opportunity Card applicants.",
    statutoryBasis: "Aufenthaltsgesetz (AufenthG) § 18b; Fachkräfteeinwanderungsgesetz (FEG); BAMF minimum salary thresholds.",
    formSupport: "Antrag auf Erteilung eines Aufenthaltstitels (Residence Permit Application).",
    summary: "Roadmap: Anabin degree database integration, BAMF salary threshold calculator, and Chancenkarte points scorecard.",
    caseNeeds: [
      "Recognized German university degree or comparable foreign tertiary degree (Anabin H+)",
      "Binding employment contract or job offer meeting BAMF statutory minimum gross salary",
      "Federal Employment Agency (Bundesagentur für Arbeit) approval where applicable",
      "German health insurance proof and accommodation documentation",
    ],
    documentWorkflows: [
      "Anabin database statement of comparability and university accreditation documents",
      "Bilingual employment contract with detailed job description (Erklärung zum Beschäftigungsverhältnis)",
      "Professional practice authorization (Berufsausübungserlaubnis) for regulated professions",
    ],
    documentoFeatures: [
      "BAMF annual minimum salary threshold validator (standard vs shortage occupation tiers)",
      "Chancenkarte (Opportunity Card) points scoring simulator (language, age, experience)",
      "German consular visa appointment document checklist compiler (planned)",
    ],
  },
];

export function DocumentoCoverageExplorer() {
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Available" | "Planned">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedPathwayId, setExpandedPathwayId] = useState<string>("us-eb1a");

  const filteredPathways = useMemo(() => {
    return VERIFIED_PATHWAYS.filter((p) => {
      const matchesCountry = selectedCountry === "ALL" || p.countryCode === selectedCountry;
      const matchesCategory = selectedCategory === "ALL" || p.category === selectedCategory;
      const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        p.title.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.country.toLowerCase().includes(query) ||
        p.statutoryBasis.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query);

      return matchesCountry && matchesCategory && matchesStatus && matchesSearch;
    });
  }, [selectedCountry, selectedCategory, statusFilter, searchQuery]);

  const activePathway = useMemo(() => {
    return (
      VERIFIED_PATHWAYS.find((p) => p.id === expandedPathwayId) ||
      filteredPathways[0] ||
      VERIFIED_PATHWAYS[0]
    );
  }, [expandedPathwayId, filteredPathways]);

  const stats = useMemo(() => {
    const available = VERIFIED_PATHWAYS.filter((p) => p.status === "Available");
    const planned = VERIFIED_PATHWAYS.filter((p) => p.status === "Planned");
    const countries = new Set(available.map((p) => p.country));
    return {
      availableCount: available.length,
      plannedCount: planned.length,
      activeJurisdictionsCount: countries.size,
    };
  }, []);

  return (
    <section
      id="coverage"
      style={{
        padding: "80px 24px",
        background: "#FFFFFF",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Section Eyebrow & Title */}
        <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "820px", margin: "0 auto 40px auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 14px",
              borderRadius: "20px",
              background: "#DDEFE8",
              border: "1px solid #B9DED4",
              fontSize: "12px",
              fontWeight: 600,
              color: "#063C3D",
              marginBottom: "16px",
            }}
          >
            <span>Verified Immigration Scope &amp; Jurisdiction Explorer</span>
          </div>

          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.2,
              letterSpacing: "-0.025em",
              margin: "0 0 16px 0",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Explicit pathway coverage. Zero exaggerated claims.
          </h2>

          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: "0 0 24px 0" }}>
            Explore the exact immigration and visa categories supported in Documento. We distinguish operational, code-verified rule systems from planned expansion jurisdictions.
          </p>

          {/* Scope Statistics Pill Bar */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "10px 18px",
              borderRadius: "12px",
              background: "#F8F7F2",
              border: "1px solid #DCE5E1",
              fontSize: "13px",
              color: "#063C3D",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#176B50" }} />
              <span>
                <strong>{stats.activeJurisdictionsCount} Active Jurisdictions</strong> (US, UK, Canada)
              </span>
            </div>
            <span style={{ color: "#DCE5E1" }}>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0D6866" }} />
              <span>
                <strong>{stats.availableCount} Operational Pathways</strong> Available
              </span>
            </div>
            <span style={{ color: "#DCE5E1" }}>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8A5A10" }} />
              <span>
                <strong>{stats.plannedCount} Roadmap Pathways</strong> (Australia &amp; Germany in Pilot Watchlist)
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          className="animate-on-scroll delay-100"
          style={{
            background: "#F8F7F2",
            borderRadius: "14px",
            border: "1px solid #DCE5E1",
            padding: "20px",
            marginBottom: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Top row: Search input & Status toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            {/* Search Box */}
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "440px" }}>
              <input
                type="text"
                placeholder="Search visa name, statutory basis, or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  color: "#172322",
                  outline: "none",
                }}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6E7F7C"
                strokeWidth="2"
                style={{ position: "absolute", left: "12px", top: "12px" }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "10px",
                    background: "none",
                    border: "none",
                    color: "#6E7F7C",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Segmented Buttons */}
            <div
              style={{
                display: "inline-flex",
                background: "#E7EFEB",
                borderRadius: "8px",
                padding: "3px",
                gap: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: statusFilter === "ALL" ? 650 : 500,
                  background: statusFilter === "ALL" ? "#FFFFFF" : "transparent",
                  color: statusFilter === "ALL" ? "#063C3D" : "#445451",
                  boxShadow: statusFilter === "ALL" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                All Statuses
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("Available")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: statusFilter === "Available" ? 650 : 500,
                  background: statusFilter === "Available" ? "#FFFFFF" : "transparent",
                  color: statusFilter === "Available" ? "#176B50" : "#445451",
                  boxShadow: statusFilter === "Available" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                Available Now ({stats.availableCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("Planned")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: statusFilter === "Planned" ? 650 : 500,
                  background: statusFilter === "Planned" ? "#FFFFFF" : "transparent",
                  color: statusFilter === "Planned" ? "#8A5A10" : "#445451",
                  boxShadow: statusFilter === "Planned" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                Roadmap / Planned ({stats.plannedCount})
              </button>
            </div>
          </div>

          {/* Bottom row: Country filters & Category filters */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              borderTop: "1px solid #DCE5E1",
              paddingTop: "14px",
            }}
          >
            {/* Country Pills */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 650, color: "#6E7F7C", marginRight: "4px" }}>
                Country:
              </span>
              {[
                { code: "ALL", label: "All Countries" },
                { code: "US", label: "🇺🇸 United States" },
                { code: "UK", label: "🇬🇧 United Kingdom" },
                { code: "CA", label: "🇨🇦 Canada" },
                { code: "AU", label: "🇦🇺 Australia (Planned)" },
                { code: "DE", label: "🇩🇪 Germany (Planned)" },
              ].map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCountry(c.code)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: selectedCountry === c.code ? "#0D6866" : "#DCE5E1",
                    background: selectedCountry === c.code ? "#0D6866" : "#FFFFFF",
                    color: selectedCountry === c.code ? "#FFFFFF" : "#445451",
                    fontSize: "12px",
                    fontWeight: selectedCountry === c.code ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Category Pills */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 650, color: "#6E7F7C", marginRight: "4px" }}>
                Category:
              </span>
              {[
                { key: "ALL", label: "All" },
                { key: "Permanent Residence", label: "Permanent Residence" },
                { key: "Employment & Skilled Worker", label: "Skilled Employment" },
                { key: "Nonimmigrant Talent", label: "Nonimmigrant Talent" },
                { key: "Multinational Transfer", label: "Multinational Transfer" },
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: selectedCategory === cat.key ? "#063C3D" : "#DCE5E1",
                    background: selectedCategory === cat.key ? "#063C3D" : "#FFFFFF",
                    color: selectedCategory === cat.key ? "#FFFFFF" : "#445451",
                    fontSize: "12px",
                    fontWeight: selectedCategory === cat.key ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Empty Search State */}
        {filteredPathways.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "#F8F7F2",
              borderRadius: "14px",
              border: "1px dashed #DCE5E1",
              marginBottom: "32px",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
            <h3 style={{ fontSize: "18px", fontWeight: 650, color: "#063C3D", margin: "0 0 6px 0" }}>
              No matching visa categories found
            </h3>
            <p style={{ fontSize: "14px", color: "#6E7F7C", margin: "0 0 18px 0" }}>
              We could not find any verified pathways matching your current filter selections.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCountry("ALL");
                setSelectedCategory("ALL");
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 18px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Master-Detail Interactive Explorer Layout */}
        {filteredPathways.length > 0 && (
          <div
            className="animate-on-scroll delay-150"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
              gap: "24px",
              alignItems: "start",
            }}
          >
            {/* Left Column: Interactive Cards List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 650, color: "#6E7F7C", marginBottom: "4px" }}>
                Showing {filteredPathways.length} of {VERIFIED_PATHWAYS.length} documented pathways:
              </div>

              {filteredPathways.map((p) => {
                const isSelected = activePathway?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setExpandedPathwayId(p.id)}
                    style={{
                      background: isSelected ? "#F1F6F4" : "#FFFFFF",
                      border: "1px solid",
                      borderColor: isSelected ? "#0D6866" : "#DCE5E1",
                      borderRadius: "12px",
                      padding: "18px 20px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 4px 16px rgba(13, 104, 102, 0.12)"
                        : "0 2px 4px rgba(6, 60, 61, 0.02)",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "#B9DED4";
                        e.currentTarget.style.background = "#FAFDFB";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "#DCE5E1";
                        e.currentTarget.style.background = "#FFFFFF";
                      }
                    }}
                  >
                    {/* Top Row: Code + Country Badge + Status Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "18px" }}>{p.flag}</span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#063C3D",
                            background: "#DDEFE8",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {p.code}
                        </span>
                        <span style={{ fontSize: "12px", color: "#6E7F7C" }}>{p.country}</span>
                      </div>

                      {p.status === "Available" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "#EAF6F0",
                            color: "#176B50",
                            fontSize: "11px",
                            fontWeight: 650,
                            padding: "3px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#176B50" }} />
                          Operational
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "#FEF7EA",
                            color: "#8A5A10",
                            fontSize: "11px",
                            fontWeight: 650,
                            padding: "3px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8A5A10" }} />
                          Roadmap Pilot
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#063C3D",
                        margin: "0 0 6px 0",
                      }}
                    >
                      {p.title}
                    </h3>

                    {/* Summary */}
                    <p style={{ fontSize: "13px", color: "#445451", margin: "0 0 10px 0", lineHeight: 1.45 }}>
                      {p.summary}
                    </p>

                    {/* Bottom Metadata */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        color: "#6E7F7C",
                        borderTop: "1px solid #E7EFEB",
                        paddingTop: "8px",
                      }}
                    >
                      <span>{p.category}</span>
                      <span style={{ color: isSelected ? "#0D6866" : "#6E7F7C", fontWeight: 600 }}>
                        {isSelected ? "Inspecting Details →" : "Click to Inspect"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Deep Inspection Panel for Selected Pathway */}
            {activePathway && (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #0D6866",
                  borderRadius: "16px",
                  padding: "28px",
                  boxShadow: "0 8px 30px rgba(6, 60, 61, 0.08)",
                  position: "sticky",
                  top: "90px",
                }}
              >
                {/* Header */}
                <div style={{ borderBottom: "1px solid #DCE5E1", paddingBottom: "18px", marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "24px" }}>{activePathway.flag}</span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>
                          {activePathway.governingBody}
                        </div>
                        <h3
                          style={{
                            fontSize: "22px",
                            fontWeight: 750,
                            color: "#063C3D",
                            margin: 0,
                            fontFamily: "var(--font-display, Inter, sans-serif)",
                          }}
                        >
                          {activePathway.title}
                        </h3>
                      </div>
                    </div>

                    {activePathway.status === "Available" ? (
                      <span
                        style={{
                          background: "#EAF6F0",
                          color: "#176B50",
                          border: "1px solid #B9DED4",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        ✓ Operational in Current Release
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#FEF7EA",
                          color: "#8A5A10",
                          border: "1px solid #F6D8A6",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        ⏳ Roadmap Scope • Pilot Watchlist
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.5, marginTop: "10px" }}>
                    <strong>Statutory Authority:</strong> {activePathway.statutoryBasis}
                  </div>
                  <div style={{ fontSize: "13px", color: "#445451", lineHeight: 1.5, marginTop: "4px" }}>
                    <strong>Official Forms:</strong> {activePathway.formSupport}
                  </div>
                </div>

                {/* Target Profile */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", marginBottom: "6px" }}>
                    Intended Applicant Profile
                  </div>
                  <p style={{ fontSize: "14px", color: "#445451", lineHeight: 1.5, margin: 0 }}>
                    {activePathway.applicantProfile}
                  </p>
                </div>

                {/* Case Management Needs */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", marginBottom: "8px" }}>
                    Critical Evidentiary Requirements
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activePathway.caseNeeds.map((need, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#172322", lineHeight: 1.45 }}>
                        <span style={{ color: "#0D6866", fontWeight: 700 }}>•</span>
                        <span>{need}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document Workflows */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", marginBottom: "8px" }}>
                    Handled Document Workflows
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activePathway.documentWorkflows.map((flow, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#F8F7F2",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #E7EFEB",
                          fontSize: "12px",
                          color: "#445451",
                          lineHeight: 1.4,
                        }}
                      >
                        📄 {flow}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documento Built-in Features */}
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", marginBottom: "8px" }}>
                    Documento Operational Capabilities
                  </div>
                  <div style={{ display: "grid", gap: "6px" }}>
                    {activePathway.documentoFeatures.map((feat, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#063C3D", fontWeight: 550 }}>
                        <span style={{ color: "#176B50" }}>✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Call to Action for Pathway */}
                <div
                  style={{
                    background: "#F1F6F4",
                    border: "1px solid #B9DED4",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                      Manage {activePathway.code} in Documento
                    </div>
                    <div style={{ fontSize: "12px", color: "#445451" }}>
                      {activePathway.status === "Available"
                        ? "Immediate access through firm workspace or applicant portal."
                        : "Contact our legal operations team to join our roadmap pilot."}
                    </div>
                  </div>

                  <a
                    href="#pathway-finder"
                    style={{
                      background: "#0D6866",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 650,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>Check Case Eligibility</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
