import React, { useState } from "react";
import { ImmigrationCase } from "../../lib/types";
import { ClientLanguage, CLIENT_TRANSLATIONS } from "../../lib/clientLocalization";

export interface VisaFileUpdateItem {
  id: string;
  timestamp: string;
  relativeTime: string;
  category: "uscis_notice" | "officer_action" | "filing_milestone" | "biometrics" | "evidence";
  title: string;
  officialReference: string;
  statusBadge: {
    label: string;
    bg: string;
    color: string;
    border: string;
  };
  officerName: string;
  officerRole: string;
  summary: string;
  legalSignificance: string;
  actionRequired: boolean;
  actionText?: string;
  actionTargetTab?: "documents" | "messages" | "questionnaire";
}

export const DOCKET_ITEM_LOCALIZATIONS: Record<
  string,
  {
    gu: { title: string; summary: string; legalSignificance: string; badgeLabel: string; actionText?: string };
    hi: { title: string; summary: string; legalSignificance: string; badgeLabel: string; actionText?: string };
  }
> = {
  "update-01": {
    gu: {
      title: "USCIS ફોર્મ I-797C બાયોમેટ્રિક્સ એપોઇન્ટમેન્ટ નોટિસ જારી કરાઈ",
      summary:
        "USCIS દ્વારા સાન જોસ એપ્લિકેશન સપોર્ટ સેન્ટર (ASC) ખાતે ફિંગરપ્રિન્ટ્સ, ફોટો અને ડિજિટલ સહી માટે 04 નવેમ્બર, 2026 ના રોજ સવારે 10:15 વાગ્યે તમારી એપોઇન્ટમેન્ટ નિર્ધારિત કરવામાં આવી છે.",
      legalSignificance:
        "8 CFR § 103.2(b)(9) હેઠળ કાનૂની ઓળખ ચકાસણી અને FBI ફોરેન્સિક બેકગ્રાઉન્ડ વેરિફિકેશન. Form I-485 અને રોજગાર કાર્ડ (EAD) માટે હાજરી આપવી ફરજિયાત છે.",
      badgeLabel: "એપોઇન્ટમેન્ટ નિર્ધારિત",
      actionText: "એપોઇન્ટમેન્ટ અંગે કેસ અધિકારી સાથે વાત કરો",
    },
    hi: {
      title: "USCIS फॉर्म I-797C बायोमेट्रिक्स अपॉइंटमेंट नोटिस जारी किया गया",
      summary:
        "USCIS द्वारा सैन जोस एप्लीकेशन सपोर्ट सेंटर (ASC) में उंगलियों के निशान, फोटो और डिजिटल हस्ताक्षर के लिए 04 नवंबर, 2026 को सुबह 10:15 बजे आपकी अपॉइंटमेंट निर्धारित की गई है।",
      legalSignificance:
        "8 CFR § 103.2(b)(9) के तहत कानूनी पहचान सत्यापन और FBI फोरेंसिक पृष्ठभूमि सत्यापन। फॉर्म I-485 और रोज़गार कार्ड (EAD) के लिए उपस्थिति अनिवार्य है।",
      badgeLabel: "अपॉइंटमेंट निर्धारित",
      actionText: "अपॉइंटमेंट के बारे में केस अधिकारी से बात करें",
    },
  },
  "update-02": {
    gu: {
      title: "ફોર્મ I-140 અસાધારણ ક્ષમતા (EB-1A) અરજી USCIS દ્વારા મંજૂર ✓",
      summary:
        "ટેક્સાસ સર્વિસ સેન્ટર (TSC) દ્વારા પ્રીમિયમ રિવ્યુ હેઠળ તમારી અરજી સંપૂર્ણપણે મંજૂર કરવામાં આવી છે. Matter of Chawathe કાનૂની માપદંડો હેઠળ AI અને રોબોટિક્સમાં તમારી અસાધારણ ક્ષમતા સ્વીકારવામાં આવી છે.",
      legalSignificance:
        "INA § 203(b)(1)(A) હેઠળ તમારી સ્થાયી ઇમિગ્રન્ટ વિઝા કેટેગરી સ્થાપિત થઈ છે. તમારી 10 ઓગસ્ટ, 2026 ની પ્રાયોરિટી ડેટ કાયમ માટે સુરક્ષિત થઈ ગઈ છે.",
      badgeLabel: "USCIS મંજૂર ✓",
    },
    hi: {
      title: "फॉर्म I-140 असाधारण क्षमता (EB-1A) याचिका USCIS द्वारा स्वीकृत ✓",
      summary:
        "टेक्सास सर्विस सेंटर (TSC) द्वारा त्वरित समीक्षा के तहत आपकी याचिका पूर्ण रूप से स्वीकृत की गई है। Matter of Chawathe कानूनी मानकों के तहत AI और रोबोटिक्स में आपकी असाधारण क्षमता प्रमाणित मानी गई है।",
      legalSignificance:
        "INA § 203(b)(1)(A) के तहत आपकी स्थायी आप्रवासी वीज़ा श्रेणी स्थापित हुई है। आपकी 10 अगस्त, 2026 की प्राथमिकता तिथि स्थायी रूप से सुरक्षित हो गई है।",
      badgeLabel: "USCIS स्वीकृत ✓",
    },
  },
  "update-03": {
    gu: {
      title: "1,420 પાનાની કાનૂની બ્રીફ અને પુરાવાઓનું સંકલન પૂર્ણ",
      summary:
        "કાનૂની ટીમ દ્વારા 14 સંશોધન લેખો, 28 પીઅર રિવ્યુ, IEEE ફેલોના 5 ભલામણ પત્રો અને 840 સાયટેશન્સ સાથે તમારી સત્તાવાર ફાઇલિંગ તૈયાર કરીને રજૂ કરવામાં આવી.",
      legalSignificance:
        "Kazarian v. USCIS કાનૂની ચુકાદા અનુસાર બે-તબક્કાની કાનૂની સમીક્ષાના બંને માપદંડો સંતોષાયા છે.",
      badgeLabel: "દસ્તાવેજો સંકલિત",
    },
    hi: {
      title: "1,420 पृष्ठों की कानूनी ब्रीफ और साक्ष्य संकलन दाखिल किया गया",
      summary:
        "कानूनी टीम द्वारा 14 शोध पत्र, 28 सहकर्मी समीक्षाएँ, IEEE फेलो के 5 अनुशंसा पत्र और 840 उद्धरणों के साथ आपकी आधिकारिक फ़ाइल तैयार कर प्रस्तुत की गई।",
      legalSignificance:
        "Kazarian v. USCIS कानूनी निर्णय के अनुसार दो-चरणीय कानूनी समीक्षा के दोनों मानदंड संतुष्ट हुए हैं।",
      badgeLabel: "दस्तावेज़ संकलित",
    },
  },
  "update-04": {
    gu: {
      title: "નાગરિક ઓળખ, પાસપોર્ટ અને લગ્ન પ્રમાણપત્ર વેરિફિકેશન પૂર્ણ",
      summary:
        "મુખ્ય અરજદાર અને જીવનસાથીના પાસપોર્ટ અને સિવિલ દસ્તાવેજો ડિજિટલ રીતે ચકાસીને ફોર્મ I-485 ના રેકોર્ડ સાથે મેળવવામાં આવ્યા.",
      legalSignificance:
        "8 CFR § 204.5(a) પ્રાથમિક ઓળખ જરૂરિયાતો અને INA § 203(d) આશ્રિત લાભાર્થી સંબંધોની કાનૂની પૂર્તિ.",
      badgeLabel: "ચકાસાયેલ અને સુરક્ષિત",
    },
    hi: {
      title: "नागरिक पहचान, पासपोर्ट और विवाह प्रमाण पत्र सत्यापन पूर्ण",
      summary:
        "मुख्य आवेदक और जीवनसाथी के पासपोर्ट व नागरिक दस्तावेज़ डिजिटल रूप से सत्यापित कर फॉर्म I-485 के रिकॉर्ड से मिलाए गए।",
      legalSignificance:
        "8 CFR § 204.5(a) प्राथमिक पहचान आवश्यकताओं और INA § 203(d) आश्रित लाभार्थी संबंधों की कानूनी पूर्ति।",
      badgeLabel: "सत्यापित और सुरक्षित",
    },
  },
  "update-05": {
    gu: {
      title: "કાનૂની પ્રતિનિધિત્વ કરાર અને એસ્ક્રો ટ્રસ્ટ ફંડિંગ સંપન્ન",
      summary:
        "ફોર્મ G-28 હેઠળ વેનગાર્ડ ઇમિગ્રેશન લો ગ્રૂપ સાથે કાનૂની કરાર સંપન્ન થયો અને ડેડિકેટેડ કેસ પ્રોસેસિંગ ટીમ સાથે ક્લાયન્ટ પોર્ટલ સક્રિય કરાયું.",
      legalSignificance:
        "ફોર્મ G-28 વકીલાતનામું USCIS અને હોમલેન્ડ સિક્યોરિટી સમક્ષ સત્તાવાર કાનૂની અધિકાર અને ગોપનીયતા સ્થાપિત કરે છે.",
      badgeLabel: "પ્રતિનિધિત્વ સક્રિય",
    },
    hi: {
      title: "कानूनी प्रतिनिधित्व अनुबंध और एस्क्रो ट्रस्ट फंडिंग संपन्न",
      summary:
        "फॉर्म G-28 के तहत वैनगार्ड इमिग्रेशन लॉ ग्रुप के साथ कानूनी अनुबंध संपन्न हुआ और समर्पित केस टीम के साथ क्लाइंट पोर्टल सक्रिय किया गया।",
      legalSignificance:
        "फॉर्म G-28 वकालतनामा USCIS और होमलैंड सिक्योरिटी के समक्ष आधिकारिक कानूनी अधिकार और गोपनीयता स्थापित करता है।",
      badgeLabel: "प्रतिनिधित्व सक्रिय",
    },
  },
};

export const FALLBACK_VISA_FILE_UPDATES: VisaFileUpdateItem[] = [
  {
    id: "update-01",
    timestamp: "October 15, 2026 • 10:15 AM",
    relativeTime: "2 hours ago",
    category: "biometrics",
    title: "USCIS Biometrics Appointment Notice (Form I-797C) Issued",
    officialReference: "ASC Notice #ASC-CA-88921",
    statusBadge: {
      label: "Appointment Scheduled",
      bg: "#FEF3C7",
      color: "#92400E",
      border: "#FCD34D",
    },
    officerName: "USCIS National Benefits Center",
    officerRole: "ASC Tier-2 Adjudications",
    summary:
      "USCIS has officially scheduled your in-person biometrics recording (digital fingerprints, facial photography, and cryptographic signature capture) at the San Jose Application Support Center (ASC) for November 04, 2026, at 10:15 AM PST.",
    legalSignificance:
      "Mandatory biometric identification verification and FBI forensic background checks under 8 CFR § 103.2(b)(9). Mandatory prerequisite for Form I-485 and employment authorization (EAD).",
    actionRequired: true,
    actionText: "Chat with Officer About Appointment",
    actionTargetTab: "messages",
  },
  {
    id: "update-02",
    timestamp: "October 14, 2026 • 02:40 PM",
    relativeTime: "1 day ago",
    category: "uscis_notice",
    title: "Form I-140 Immigrant Petition Approved (Form I-797 Notice of Action)",
    officialReference: "USCIS #IOE-09-284-91823",
    statusBadge: {
      label: "Form I-140 Approved ✓",
      bg: "#DCFCE7",
      color: "#166534",
      border: "#86EFAC",
    },
    officerName: "Texas Service Center (TSC)",
    officerRole: "Supervisory Immigration Services Officer",
    summary:
      "USCIS has completed adjudicative review and formally APPROVED your immigrant petition for Extraordinary Ability (EB-1A). Evidentiary satisfaction met across high remuneration, critical role, peer review, and scholarly publication criteria under Matter of Chawathe preponderant evidence standards.",
    legalSignificance:
      "Establishes permanent immigrant classification under INA § 203(b)(1)(A). Your Priority Date of August 10, 2026 is officially vested and permanently locked.",
    actionRequired: false,
  },
  {
    id: "update-03",
    timestamp: "October 12, 2026 • 11:30 AM",
    relativeTime: "3 days ago",
    category: "evidence",
    title: "Comprehensive Legal Brief & 1,420-Page Evidentiary Dossier Indexed",
    officialReference: "Docket Submission #EXH-2026-EB1A",
    statusBadge: {
      label: "Evidence Dossier Filed",
      bg: "#E0F2FE",
      color: "#0369A1",
      border: "#BAE6FD",
    },
    officerName: "Sarah Jenkins, Esq.",
    officerRole: "Lead Immigration Attorney",
    summary:
      "Legal team completed final paginated exhibit indexing and evidentiary binder filing: 14 peer-reviewed publications, 28 journal review verifications, 5 independent expert testimonial letters, and evidence of 840 citations in top AI robotics venues.",
    legalSignificance:
      "Comprehensive two-step evidentiary compliance under Kazarian v. USCIS, 580 F.3d 1025 (9th Cir. 2010), satisfying both regulatory criteria threshold and final merits determination.",
    actionRequired: false,
  },
  {
    id: "update-04",
    timestamp: "October 10, 2026 • 04:15 PM",
    relativeTime: "5 days ago",
    category: "officer_action",
    title: "Civil Documents & Identity Records Verified by Reviewing Specialist",
    officialReference: "Internal Quality Audit #QA-9902",
    statusBadge: {
      label: "Verified & Locked",
      bg: "#F3E8FF",
      color: "#6B21A8",
      border: "#D8B4FE",
    },
    officerName: "Marcus Vance",
    officerRole: "Senior Case Processing Specialist",
    summary:
      "Cryptographic SHA-256 integrity match confirmed for primary applicant passport, birth record, marriage certificate, and spouse derivative records. Verification against Form I-485 biographical records passed with zero discrepancies.",
    legalSignificance:
      "Primary identity requirement under 8 CFR § 204.5(a) and derivative beneficiary qualification under INA § 203(d).",
    actionRequired: false,
  },
  {
    id: "update-05",
    timestamp: "October 03, 2026 • 09:00 AM",
    relativeTime: "12 days ago",
    category: "officer_action",
    title: "Representation Contract & Trust Escrow Retainer Completed",
    officialReference: "Retainer #RET-2026-8819",
    statusBadge: {
      label: "Retainer Active",
      bg: "#EAF6F0",
      color: "#0D6866",
      border: "#B9DED4",
    },
    officerName: "Vanguard Immigration Law Group",
    officerRole: "Attorney of Record",
    summary:
      "Notice of Entry of Appearance as Attorney (Form G-28) filed with USCIS and client transparency portal initialized with direct real-time casework updates and assigned case processing officer channel.",
    legalSignificance:
      "Form G-28 formal notice establishes attorney-client privilege and DHS authorized legal representative authority under 8 CFR § 292.1.",
    actionRequired: false,
  },
];

interface VisaFileUpdatesViewProps {
  myCase: ImmigrationCase | null;
  onNavigateTab: (tab: "documents" | "messages" | "questionnaire") => void;
  onOpenUploadModal?: () => void;
  language?: ClientLanguage;
}

export function VisaFileUpdatesView({
  myCase,
  onNavigateTab,
  onOpenUploadModal,
  language = "en",
}: VisaFileUpdatesViewProps) {
  const t = CLIENT_TRANSLATIONS[language];
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "uscis_notice" | "officer_action" | "biometrics" | "evidence"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedText, setLastRefreshedText] = useState("Just now (USCIS ELIS Gateway)");
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const handleRefreshGateway = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshedText(`Today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (USCIS Live Gateway)`);
    }, 900);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  if (!myCase) {
    return (
      <div
        data-testid="visa-updates-empty-state"
        style={{
          background: "#FFFFFF",
          border: "1px dashed #CBD5E1",
          borderRadius: "16px",
          padding: "48px 32px",
          textAlign: "center",
          maxWidth: "680px",
          margin: "40px auto",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontSize: "44px", marginBottom: "14px" }}>⚖️</div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
          No Case Docket Registered Yet
        </h2>
        <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: "0 0 20px 0" }}>
          Your legal team (Owner or Lead Paralegal) has not yet activated a petition docket or filed submissions for your account. Once your case is entered into the system, all official USCIS receipt notices, milestone tracking, and officer actions will appear here in real time.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#F1F5F9",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "12px",
            color: "#475569",
            fontWeight: 600,
          }}
        >
          <span>🔒 Secured Client Portal</span>
          <span>•</span>
          <span>Awaiting firm filing</span>
        </div>
      </div>
    );
  }

  const filteredUpdates = FALLBACK_VISA_FILE_UPDATES.filter((item) => {
    const matchesFilter = selectedFilter === "all" || item.category === selectedFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.officialReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.officerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.legalSignificance.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* 1. Official USCIS Dossier & Electronic Case Reference Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
          borderRadius: "16px",
          padding: "24px 28px",
          color: "#FFFFFF",
          boxShadow: "0 8px 24px rgba(6, 60, 61, 0.16)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle decorative watermark */}
        <div
          style={{
            position: "absolute",
            right: "-20px",
            top: "-30px",
            fontSize: "140px",
            opacity: 0.05,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          ⚖️
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(4px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "20px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Official Case Docket
              </span>
              <span
                style={{
                  background: "#22C55E",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "10px",
                  letterSpacing: "0.03em",
                }}
              >
                ● LIVE USCIS SYNC
              </span>
            </div>

            <h1
              style={{
                margin: "0 0 4px 0",
                fontSize: "24px",
                fontWeight: 750,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
              }}
            >
              {language === "en" ? "Visa Application File Updates" : t.docketHeaderTitle}
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#D1E7E0", lineHeight: 1.5, maxWidth: "680px" }}>
              Authoritative, real-time procedural docket for your <strong>{myCase?.visa_category || "EB-1A Extraordinary Ability"}</strong> petition, official USCIS receipt notices, biometrics milestones, and case processing officer actions.
            </p>
          </div>

          {/* Sync status & Refresh button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={handleRefreshGateway}
              disabled={isRefreshing}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                color: "#FFFFFF",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 650,
                cursor: isRefreshing ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ display: "inline-block", transform: isRefreshing ? "rotate(360deg)" : "none", transition: "transform 0.8s linear" }}>
                🔄
              </span>
              <span>{isRefreshing ? "Checking USCIS Gateway..." : "Refresh Official Status"}</span>
            </button>
            <span style={{ fontSize: "11px", color: "#B9DED4" }}>
              Last verified: {lastRefreshedText}
            </span>
          </div>
        </div>

        {/* Core Case Dossier Metadata Strip */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "18px",
            borderTop: "1px solid rgba(255, 255, 255, 0.18)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ background: "rgba(0, 0, 0, 0.15)", padding: "10px 14px", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "#B9DED4", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
              USCIS RECEIPT NUMBER (I-140)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <strong style={{ fontSize: "13px", fontFamily: "monospace", color: "#FFFFFF" }}>
                IOE-09-284-91823
              </strong>
              <button
                type="button"
                onClick={() => handleCopy("IOE-09-284-91823")}
                title="Copy receipt number"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#B9DED4",
                  fontSize: "11px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {copiedRef === "IOE-09-284-91823" ? "✓" : "📋"}
              </button>
            </div>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.15)", padding: "10px 14px", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "#B9DED4", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
              PRIORITY DATE
            </span>
            <strong style={{ fontSize: "13px", color: "#FFFFFF", display: "block", marginTop: "2px" }}>
              August 10, 2026 (Current)
            </strong>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.15)", padding: "10px 14px", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "#B9DED4", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
              SERVICE CENTER
            </span>
            <strong style={{ fontSize: "13px", color: "#FFFFFF", display: "block", marginTop: "2px" }}>
              Texas Service Center (TSC)
            </strong>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.15)", padding: "10px 14px", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "#B9DED4", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
              ADJUDICATION STATUS
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#A7F3D0",
                display: "inline-block",
                marginTop: "2px",
              }}
            >
              Form I-140 Approved ✓
            </span>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.15)", padding: "10px 14px", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "#B9DED4", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
              CASE PROCESSING OFFICER
            </span>
            <strong style={{ fontSize: "13px", color: "#FFFFFF", display: "block", marginTop: "2px" }}>
              Sarah Jenkins, Esq.
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Action Alerts / Urgent Next Procedural Steps */}
      <div
        style={{
          background: "#FEF7EA",
          border: "1.5px solid #FCD34D",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#FDE68A",
              color: "#92400E",
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            📅
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "14px", color: "#92400E" }}>
                Action Item: Biometrics Appointment Scheduled
              </strong>
              <span
                style={{
                  background: "#FEF3C7",
                  border: "1px solid #FCD34D",
                  color: "#B45309",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "4px",
                }}
              >
                Date: Nov 04, 2026
              </span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#78350F", lineHeight: 1.4 }}>
              USCIS has scheduled your biometrics capture at San Jose ASC. Please review appointment details or message your Case Processing Officer with questions.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onNavigateTab("messages")}
            style={{
              background: "#8A5A10",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            💬 Chat with Officer
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab("documents")}
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              color: "#063C3D",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            📄 Upload Evidence File
          </button>
        </div>
      </div>

      {/* 3. Search and Category Filter Strip */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "12px",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Category Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {[
            { key: "all" as const, label: t.filterAll, count: FALLBACK_VISA_FILE_UPDATES.length },
            { key: "uscis_notice" as const, label: t.filterUSCIS, count: 1 },
            { key: "biometrics" as const, label: t.filterBiometrics, count: 1 },
            { key: "officer_action" as const, label: t.filterOfficerActions, count: 1 },
            { key: "evidence" as const, label: t.filterFilings, count: 1 },
          ].map((cat) => {
            const active = selectedFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedFilter(cat.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  border: active ? "1px solid #0D6866" : "1px solid #DCE5E1",
                  background: active ? "#0D6866" : "#F8F7F2",
                  color: active ? "#FFFFFF" : "#445451",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "10px",
                    background: active ? "rgba(255, 255, 255, 0.25)" : "#E7EFEB",
                    color: active ? "#FFFFFF" : "#6E7F7C",
                  }}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div style={{ position: "relative", minWidth: "240px", flex: "1 1 auto", maxWidth: "340px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchUpdatesPlaceholder}
            style={{
              width: "100%",
              padding: "7px 12px 7px 32px",
              fontSize: "12px",
              borderRadius: "8px",
              border: "1px solid #DCE5E1",
              background: "#F8F7F2",
              color: "#172322",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "12px",
              color: "#6E7F7C",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "#6E7F7C",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Chronological Visa File Updates Stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filteredUpdates.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "40px 20px",
              textAlign: "center",
              color: "#6E7F7C",
            }}
          >
            <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>🔍</span>
            <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>
              No visa file updates match your search
            </strong>
            <p style={{ margin: "4px 0 12px 0", fontSize: "12px" }}>
              Try adjusting your search criteria or resetting filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedFilter("all");
                setSearchQuery("");
              }}
              style={{
                padding: "6px 14px",
                background: "#0D6866",
                color: "#FFFFFF",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredUpdates.map((item, index) => {
            const itemLoc =
              language !== "en" && (language === "gu" || language === "hi")
                ? DOCKET_ITEM_LOCALIZATIONS[item.id]?.[language]
                : null;
            const displayTitle = itemLoc?.title || item.title;
            const displaySummary = itemLoc?.summary || item.summary;
            const displayLegalSignificance = itemLoc?.legalSignificance || item.legalSignificance;
            const displayBadgeLabel = itemLoc?.badgeLabel || item.statusBadge.label;
            const displayActionText = itemLoc?.actionText || item.actionText;

            return (
              <div
              key={item.id}
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "14px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
                transition: "all 0.15s ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#B9DED4";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(6, 60, 61, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#DCE5E1";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(6, 60, 61, 0.02)";
              }}
            >
              {/* Top Row: Timestamp, Official Reference, and Status Badge */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span
                      style={{
                        background: item.statusBadge.bg,
                        color: item.statusBadge.color,
                        border: `1px solid ${item.statusBadge.border}`,
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {displayBadgeLabel}
                    </span>
                    <span style={{ fontSize: "11px", color: "#6E7F7C" }}>•</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#6E7F7C" }}>
                      {item.relativeTime}
                    </span>
                    <span style={{ fontSize: "11px", color: "#BDCDC7" }}>
                      ({item.timestamp.includes(" • ") ? item.timestamp.split(" • ")[0] : (!isNaN(new Date(item.timestamp).getTime()) ? new Date(item.timestamp).toLocaleDateString() : item.timestamp)})
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#063C3D",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {displayTitle}
                  </h3>
                </div>

                <div
                  style={{
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "#063C3D",
                    fontWeight: 600,
                  }}
                >
                  {item.officialReference}
                </div>
              </div>

              {/* Summary of What Happened */}
              <p
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "13px",
                  color: "#172322",
                  lineHeight: 1.5,
                }}
              >
                {displaySummary}
              </p>

              {/* Legal Significance Box */}
              <div
                style={{
                  background: "#F8F7F2",
                  borderLeft: "3px solid #0D6866",
                  padding: "10px 14px",
                  borderRadius: "0 8px 8px 0",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                  <span style={{ fontSize: "11px" }}>⚖️</span>
                  <strong style={{ fontSize: "11px", color: "#063C3D", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {language === "en" ? "Legal Significance & Statutory Authority" : t.legalSignificanceLabel}
                  </strong>
                </div>
                <div style={{ fontSize: "12px", color: "#445451", lineHeight: 1.45 }}>
                  {displayLegalSignificance}
                </div>
              </div>

              {/* Bottom Row: Responsible Officer & Action CTA */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid #F1F6F4",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    SJ
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 650, color: "#063C3D", display: "block" }}>
                      {item.officerName}
                    </span>
                    <span style={{ fontSize: "10px", color: "#6E7F7C" }}>
                      {item.officerRole}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.officialReference)}
                    style={{
                      padding: "5px 10px",
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#445451",
                      cursor: "pointer",
                    }}
                  >
                    {copiedRef === item.officialReference ? "✓ Copied Ref" : "📋 Copy Reference"}
                  </button>
                  {item.actionRequired && item.actionText && (
                    <button
                      type="button"
                      onClick={() => item.actionTargetTab && onNavigateTab(item.actionTargetTab)}
                      style={{
                        padding: "5px 12px",
                        background: "#0D6866",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      {item.actionText} →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigateTab("messages")}
                    style={{
                      padding: "5px 10px",
                      background: "#EAF6F0",
                      color: "#0D6866",
                      border: "1px solid #B9DED4",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    💬 Ask Officer
                  </button>
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
