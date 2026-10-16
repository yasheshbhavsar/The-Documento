/**
 * Retained Client Localization Module (English, Gujarati, Hindi)
 * Specifically engineered for retained clients (client_applicant persona)
 * to ensure clients who do not speak English can comfortably navigate
 * their visa dashboard, understand file updates, and coordinate with their
 * case processing officers and immigration lawyers.
 */

export type ClientLanguage = "en" | "gu" | "hi";

export interface LanguageOption {
  code: ClientLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_CLIENT_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🇮🇳" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳" },
];

export interface ClientTranslations {
  // Brand & Portal Header
  portalTitle: string;
  portalSubtitle: string;
  languageSelectorLabel: string;
  languageHelpBadge: string;
  languageWelcomeBanner: string;

  // Navigation Items
  navOverview: string;
  navUpdates: string;
  navDocuments: string;
  navMessages: string;
  navQuestionnaire: string;
  navForms: string;
  navMilestones: string;
  navProfile: string;
  navBilling: string;
  navSettings: string;
  sectionsHeader: string;

  // Active Case Summary Card
  caseLabel: string;
  activeStatus: string;
  stageLabel: string;
  assignedOfficerTitle: string;
  onlineNowText: string;
  chatWithOfficerButton: string;

  // Overview Tab
  welcomeGreeting: string;
  actionRequiredNotice: string;
  missingDocsText: string;
  uploadEvidenceButton: string;
  caseStatusTitle: string;
  uscisReceiptNumber: string;
  priorityDateLabel: string;
  serviceCenterLabel: string;
  statusBadgeText: string;
  latestUpdatesHeader: string;
  viewAllUpdatesLink: string;
  viewAllUpdatesButton: string;
  milestonesTitle: string;

  // Visa File Updates Docket
  docketHeaderTitle: string;
  docketHeaderSubtitle: string;
  liveSyncText: string;
  filterAll: string;
  filterUSCIS: string;
  filterBiometrics: string;
  filterOfficerActions: string;
  filterFilings: string;
  searchUpdatesPlaceholder: string;
  legalSignificanceLabel: string;
  noticeNumberLabel: string;
  actingOfficerLabel: string;

  // Direct Document Uploader
  uploadHeaderTitle: string;
  uploadHeaderSubtitle: string;
  dropzoneTitle: string;
  dropzoneSubtitle: string;
  supportedFormatsText: string;
  sha256NoticeTitle: string;
  sha256NoticeDesc: string;
  categorySelectLabel: string;
  categoryPlaceholder: string;
  categories: {
    identity: string;
    academic: string;
    recommendation: string;
    publications: string;
    awards: string;
    financial: string;
  };
  confidentialNoteLabel: string;
  confidentialNotePlaceholder: string;
  uploadButtonText: string;
  uploadingButtonText: string;
  uploadSuccessNotice: string;

  // Chat with Case Officer & Messaging
  officerBannerTitle: string;
  officerBannerSubtitle: string;
  officerLegalPrivilegeBadge: string;
  officerOnlineStatusText: string;
  quickInquiryHeader: string;
  bilingualAssistantTitle: string;
  bilingualAssistantDesc: string;
  translateIncomingButton: string;
  hideTranslationButton: string;
  translationLabel: string;
  messagePlaceholder: string;
  sendMessageButton: string;
  promptChips: {
    timeline: { title: string; prompt: string };
    travel: { title: string; prompt: string };
    taxReturns: { title: string; prompt: string };
    approvalCopy: { title: string; prompt: string };
  };
}

export const CLIENT_TRANSLATIONS: Record<ClientLanguage, ClientTranslations> = {
  // =========================================================================
  // ENGLISH (DEFAULT)
  // =========================================================================
  en: {
    portalTitle: "Applicant Transparency Portal",
    portalSubtitle: "Direct legal visibility into your United States visa petition",
    languageSelectorLabel: "Language",
    languageHelpBadge: "Multilingual Client Access",
    languageWelcomeBanner: "Welcome to your client transparency portal. Real-time docket updates, direct document uploads, and case officer messaging are active.",

    navOverview: "My Petition Overview",
    navUpdates: "Visa File Updates",
    navDocuments: "Upload Documents (Evidence & Uploads)",
    navMessages: "Chat with Case Officer (Lawyer Messages)",
    navQuestionnaire: "Guided Questionnaire",
    navForms: "Review Application Forms",
    navMilestones: "Case Milestones",
    navProfile: "Applicant Profile",
    navBilling: "Retainers & Invoices",
    navSettings: "Privacy & Security",
    sectionsHeader: "Case Sections",

    caseLabel: "Case",
    activeStatus: "Active",
    stageLabel: "Stage: Evidence Gathering",
    assignedOfficerTitle: "Lead Case Processing Officer",
    onlineNowText: "🟢 Online • Direct Line",
    chatWithOfficerButton: "💬 Chat with Case Officer",

    welcomeGreeting: "Welcome back",
    actionRequiredNotice: "Action Required",
    missingDocsText: "items require your immediate submission",
    uploadEvidenceButton: "Upload Evidence Now",
    caseStatusTitle: "USCIS Petition Status & Official Docket",
    uscisReceiptNumber: "Receipt Number",
    priorityDateLabel: "Priority Date",
    serviceCenterLabel: "USCIS Service Center",
    statusBadgeText: "Form I-140 Approved ✓",
    latestUpdatesHeader: "Latest Visa Application File Updates & USCIS Status",
    viewAllUpdatesLink: "View All File Updates →",
    viewAllUpdatesButton: "View All File Updates →",
    milestonesTitle: "Immigration Case Milestones & Timeline",

    docketHeaderTitle: "Visa Application File Updates & USCIS Docket",
    docketHeaderSubtitle: "Official chronological ledger of USCIS notices, officer filings, biometrics, and statutory decisions.",
    liveSyncText: "Live Sync",
    filterAll: "All Updates",
    filterUSCIS: "USCIS Official Notices",
    filterBiometrics: "Biometrics",
    filterOfficerActions: "Officer Actions",
    filterFilings: "Evidentiary Filings",
    searchUpdatesPlaceholder: "Search updates by notice # or keyword...",
    legalSignificanceLabel: "Legal Significance & Statutory Authority:",
    noticeNumberLabel: "Official Ref:",
    actingOfficerLabel: "Acting Officer:",

    uploadHeaderTitle: "Direct Document Upload to Case Processing Officer",
    uploadHeaderSubtitle: "Directly transmit evidence files to your assigned case processing officer. Each document is cryptographically fingerprinted on your device.",
    dropzoneTitle: "Click to browse or drag and drop your file here",
    dropzoneSubtitle: "Secure direct upload to legal review queue",
    supportedFormatsText: "Accepted formats: PDF, JPEG, PNG, TIFF, WebP (Max 50MB per file)",
    sha256NoticeTitle: "SHA-256 Client-Side Cryptographic Fingerprinting Active",
    sha256NoticeDesc: "An immutable cryptographic hash is generated locally in your browser to guarantee tamper-proof chain of custody under USCIS standards.",
    categorySelectLabel: "Evidence Category",
    categoryPlaceholder: "Select evidentiary category...",
    categories: {
      identity: "Identity & Civil Documents (Passport, Birth Certificate)",
      academic: "Academic & Degree Credentials (Diplomas, Transcripts)",
      recommendation: "Expert Recommendation & Peer Testimonial Letters",
      publications: "Evidence of Published Material & Media Reports",
      awards: "Major Awards, Honors & High Remuneration Proof",
      financial: "Tax Returns, W-2s & Financial Compensation Evidence",
    },
    confidentialNoteLabel: "Confidential Note for Your Case Processing Officer (Optional)",
    confidentialNotePlaceholder: "Add any context or instructions for your reviewing officer...",
    uploadButtonText: "Upload Evidence File",
    uploadingButtonText: "Encrypting & Uploading...",
    uploadSuccessNotice: "Document securely uploaded and added to your evidence inventory.",

    officerBannerTitle: "Direct Case Processing Channel",
    officerBannerSubtitle: "Instant, privileged legal communication with your assigned legal specialist. Inquiries receive priority review.",
    officerLegalPrivilegeBadge: "8 CFR § 292.1 Privileged Legal Channel",
    officerOnlineStatusText: "Online Now (Avg reply < 15m)",
    quickInquiryHeader: "Quick-Action Case Inquiries (Click to compose):",
    bilingualAssistantTitle: "Language Translation Assistant",
    bilingualAssistantDesc: "You can send inquiries in your preferred language. Automatic translation assistance helps your legal team respond accurately and quickly.",
    translateIncomingButton: "Translate to My Language",
    hideTranslationButton: "Show Original English",
    translationLabel: "Official Translation",
    messagePlaceholder: "Type question or update for your legal team...",
    sendMessageButton: "Send Message",
    promptChips: {
      timeline: {
        title: "Can you confirm if my USCIS Form I-797 receipt notice has arrived?",
        prompt: "Can you confirm if my USCIS Form I-797 receipt notice has arrived?",
      },
      travel: {
        title: "Ask about travel outside US while petition is pending",
        prompt: "Dear Officer, is it safe for me to travel internationally while my visa petition is pending? Do I need advance authorization?",
      },
      taxReturns: {
        title: "Check if uploaded tax returns are sufficient",
        prompt: "Hello, I uploaded my recent tax returns. Could you please confirm if they satisfy all evidentiary requirements?",
      },
      approvalCopy: {
        title: "Request certified copy of Form I-797 approval notice",
        prompt: "Dear Officer, could you please provide a certified digital copy of my Form I-797 Approval Notice for my personal records?",
      },
    },
  },

  // =========================================================================
  // GUJARATI (ગુજરાતી)
  // =========================================================================
  gu: {
    portalTitle: "અરજદાર પારદર્શિતા પોર્ટલ (Applicant Transparency Portal)",
    portalSubtitle: "તમારી યુનાઇટેડ સ્ટેટ્સ વિઝા અરજીની સીધી કાનૂની વિગતો અને સ્થિતિ",
    languageSelectorLabel: "ભાષા (Language)",
    languageHelpBadge: "ગુજરાતી ભાષા સપોર્ટ સક્રિય",
    languageWelcomeBanner: "તમારા ક્લાયન્ટ પોર્ટલમાં સ્વાગત છે. જો તમે અંગ્રેજી ન સમજતા હો, તો પણ તમે તમારા કેસની સ્થિતિ સમજી શકો છો અને તમારા વિઝા પ્રોસેસિંગ અધિકારીઓ સાથે સીધી વાતચીત કરી શકો છો.",

    navOverview: "મારી અરજીની ઝાંખી (My Petition Overview)",
    navUpdates: "વિઝા ફાઇલ અપડેટ્સ (Visa File Updates)",
    navDocuments: "દસ્તાવેજો અપલોડ કરો (Evidence & Uploads)",
    navMessages: "કેસ અધિકારી સાથે વાતચીત (Lawyer Messages)",
    navQuestionnaire: "માર્ગદર્શિત પ્રશ્નાવલી (Guided Questionnaire)",
    navForms: "અરજી ફોર્મ્સની સમીક્ષા (Review Application Forms)",
    navMilestones: "કેસના મુખ્ય તબક્કા (Case Milestones)",
    navProfile: "અરજદારની પ્રોફાઇલ (Applicant Profile)",
    navBilling: "રીટેનર અને ઇન્વૉઇસેસ (Retainers & Invoices)",
    navSettings: "ગોપનીયતા અને સુરક્ષા (Privacy & Security)",
    sectionsHeader: "કેસ વિભાગો",

    caseLabel: "કેસ",
    activeStatus: "સક્રિય (Active)",
    stageLabel: "તબક્કો: પુરાવા એકત્રીકરણ (Evidence Gathering)",
    assignedOfficerTitle: "કેસ પ્રોસેસિંગ અધિકારી",
    onlineNowText: "🟢 ઓનલાઇન • સીધી લાઇન",
    chatWithOfficerButton: "💬 અધિકારી સાથે વાતચીત કરો",

    welcomeGreeting: "પાછા સ્વાગત છે",
    actionRequiredNotice: "ધ્યાન આપો - કાર્યવાહી જરૂરી છે",
    missingDocsText: "દસ્તાવેજો તાત્કાલિક સબમિટ કરવાના બાકી છે",
    uploadEvidenceButton: "હવે પુરાવા અપલોડ કરો",
    caseStatusTitle: "USCIS અરજી સ્થિતિ અને સત્તાવાર ડૉકેટ",
    uscisReceiptNumber: "પહોંચ નંબર (Receipt #)",
    priorityDateLabel: "પ્રાધાન્ય તારીખ (Priority Date)",
    serviceCenterLabel: "USCIS સેવા કેન્દ્ર",
    statusBadgeText: "ફોર્મ I-140 મંજૂર ✓ (Approved)",
    latestUpdatesHeader: "તાજેતરના વિઝા ફાઇલ અપડેટ્સ અને USCIS સ્થિતિ",
    viewAllUpdatesLink: "બધા વિઝા ફાઇલ અપડેટ્સ જુઓ →",
    viewAllUpdatesButton: "બધા વિઝા ફાઇલ અપડેટ્સ જુઓ →",
    milestonesTitle: "કેસના મુખ્ય તબક્કા અને પ્રગતિ (Case Milestones)",

    docketHeaderTitle: "વિઝા ફાઇલ અપડેટ્સ અને USCIS સત્તાવાર ડૉકેટ",
    docketHeaderSubtitle: "USCIS નોટિસો, વકીલની રજૂઆતો, બાયોમેટ્રિક્સ અને કાનૂની નિર્ણયોની તારીખવાર સત્તાવાર યાદી.",
    liveSyncText: "લાઇવ સિંક (Live Sync)",
    filterAll: "બધા અપડેટ્સ (All)",
    filterUSCIS: "USCIS સત્તાવાર સૂચનાઓ",
    filterBiometrics: "બાયોમેટ્રિક્સ (Biometrics)",
    filterOfficerActions: "અધિકારીની કાર્યવાહી",
    filterFilings: "પુરાવા સબમિશન (Filings)",
    searchUpdatesPlaceholder: "ફાઇલ અપડેટ્સ શોધો (દા.ત. બાયોમેટ્રિક્સ, મંજૂરી, I-797, કાઝારિયન)...",
    legalSignificanceLabel: "કાનૂની મહત્વ (Legal Significance):",
    noticeNumberLabel: "સત્તાવાર સંદર્ભ:",
    actingOfficerLabel: "કાર્યકારી અધિકારી:",

    uploadHeaderTitle: "વિઝા અરજીના પુરાવા અપલોડ કરો (Upload Document)",
    uploadHeaderSubtitle: "તમારા સોંપાયેલા કેસ પ્રોસેસિંગ અધિકારીને પુરાવાની ફાઇલો સીધી મોકલો. દરેક દસ્તાવેજ તમારા ઉપકરણ પર સુરક્ષિત રીતે એન્ક્રિપ્ટ થાય છે.",
    dropzoneTitle: "ફાઇલ પસંદ કરવા માટે ક્લિક કરો અથવા અહીં ખેંચીને લાવો (Drag & Drop)",
    dropzoneSubtitle: "કાનૂની સમીક્ષા ટીમ માટે સુરક્ષિત સીધું અપલોડ",
    supportedFormatsText: "માન્ય ફોર્મેટ્સ: PDF, JPEG, PNG, TIFF, WebP (મહત્તમ ફાઇલ કદ: 50MB)",
    sha256NoticeTitle: "SHA-256 ક્રિપ્ટોગ્રાફિક ફિંગરપ્રિન્ટિંગ સક્રિય છે",
    sha256NoticeDesc: "તમારી ફાઇલ સાથે કોઈ છેડછાડ ન થાય તેની ખાતરી માટે બ્રાઉઝરમાં આપોઆપ ડિજિટલ હેશ કોડ જનરેટ થાય છે.",
    categorySelectLabel: "દસ્તાવેજની શ્રેણી પસંદ કરો",
    categoryPlaceholder: "શ્રેણી પસંદ કરો...",
    categories: {
      identity: "ઓળખ અને નાગરિક દસ્તાવેજો (પાસપોર્ટ, આધાર, જન્મ પ્રમાણપત્ર)",
      academic: "શૈક્ષણિક ડિગ્રી અને પ્રમાણપત્રો (ડિપ્લોમા, માર્કશીટ)",
      recommendation: "નિષ્ણાત ભલામણ પત્રો (Expert Recommendation Letters)",
      publications: "પ્રકાશિત સંશોધન લેખો અને મીડિયા કવરેજ",
      awards: "પુરસ્કારો, સન્માન અને ઉચ્ચ પગારના પુરાવા",
      financial: "ટેક્સ રિટર્ન, W-2 અને નાણાકીય દસ્તાવેજો",
    },
    confidentialNoteLabel: "કેસ પ્રોસેસિંગ અધિકારી માટે ગુપ્ત નોંધ (વૈકલ્પિક)",
    confidentialNotePlaceholder: "તમારા કેસ અધિકારી માટે કોઈપણ વધારાની માહિતી અહીં લખો...",
    uploadButtonText: "પુરાવા ફાઇલ અપલોડ કરો (Upload File)",
    uploadingButtonText: "એન્ક્રિપ્ટ અને અપલોડ થઈ રહ્યું છે...",
    uploadSuccessNotice: "દસ્તાવેજ સુરક્ષિત રીતે અપલોડ થઈ ગયો છે અને તમારી ફાઇલમાં ઉમેરી દેવાયો છે.",

    officerBannerTitle: "કેસ પ્રોસેસિંગ અધિકારી સાથે સીધી વાતચીત",
    officerBannerSubtitle: "તમારા કેસ અધિકારી સાથે સીધો, સુરક્ષિત કાનૂની સંવાદ. તમારા પ્રશ્નોનો ઝડપી અને સચોટ જવાબ આપવામાં આવશે.",
    officerLegalPrivilegeBadge: "8 CFR § 292.1 વકીલ-અસીલ ગોપનીય વાતચીત (Attorney-Client Privilege)",
    officerOnlineStatusText: "હમણાં ઓનલાઇન (સરેરાશ જવાબ < 15 મિનિટ)",
    quickInquiryHeader: "ઝડપી પ્રશ્ન વિકલ્પો (સંદેશ બનાવવા માટે ક્લિક કરો):",
    bilingualAssistantTitle: "દ્વિભાષી ભાષા સહાયક (Gujarati & English Coordination)",
    bilingualAssistantDesc: "તમે ગુજરાતીમાં પ્રશ્ન પૂછી શકો છો. યુએસ વકીલ તરત સમજી શકે તે માટે અંગ્રેજી અનુવાદ સાથે સંદેશ તૈયાર થાય છે.",
    translateIncomingButton: "ગુજરાતીમાં અનુવાદ જુઓ",
    hideTranslationButton: "મૂળ અંગ્રેજી જુઓ",
    translationLabel: "સત્તાવાર ગુજરાતી અનુવાદ",
    messagePlaceholder: "તમારા વકીલ અથવા કેસ અધિકારી માટે અહીં પ્રશ્ન લખો...",
    sendMessageButton: "સંદેશ મોકલો (Send Message)",
    promptChips: {
      timeline: {
        title: "આગામી તબક્કા માટે અંદાજિત સમયરેખા પૂછો",
        prompt: "[ગુજરાતી]: નમસ્તે સારાહ, હું મારી વિઝા અરજીના આગામી તબક્કા માટે અંદાજિત સમયરેખા જાણવા માગું છું. આ તબક્કો ક્યારે પૂર્ણ થશે?\n[English for Officer]: Hello Sarah, could you please provide an estimated timeline for the next milestone in my petition? Thank you!",
      },
      travel: {
        title: "અરજી પેન્ડિંગ હોય ત્યારે વિદેશ મુસાફરી અંગે પૂછો",
        prompt: "[ગુજરાતી]: નમસ્તે અધિકારીશ્રી, મારી અરજી પેન્ડિંગ છે ત્યારે શું હું ભારત અથવા અન્ય દેશની યાત્રા કરી શકું? શું મારે એડવાન્સ પેરોલની જરૂર છે?\n[English for Officer]: Dear Case Officer, is it safe for me to travel internationally (e.g., to India) while my visa petition is pending? Do I need advance travel authorization?",
      },
      taxReturns: {
        title: "અપલોડ કરેલા ટેક્સ રિટર્ન પૂરતા છે કે નહીં તે ચકાસો",
        prompt: "[ગુજરાતી]: નમસ્તે, મેં મારા તાજેતરના ટેક્સ રિટર્ન અને W-2 અપલોડ કર્યા છે. કૃપા કરીને ચકાસીને જણાવો કે તે પૂરતા છે?\n[English for Officer]: Hello, I have uploaded my recent tax returns and W-2s. Could you please confirm if they satisfy all evidentiary requirements?",
      },
      approvalCopy: {
        title: "ફોર્મ I-797 મંજૂરી પત્રની પ્રમાણિત નકલની વિનંતી કરો",
        prompt: "[ગુજરાતી]: નમસ્તે, મારા અંગત રેકોર્ડ માટે મારા ફોર્મ I-797 મંજૂરી પત્રની પ્રમાણિત ડિજિટલ નકલ મોકલવા વિનંતી છે.\n[English for Officer]: Dear Officer, could you please provide a certified digital copy of my Form I-797 Approval Notice for my personal records?",
      },
    },
  },

  // =========================================================================
  // HINDI (हिन्दी)
  // =========================================================================
  hi: {
    portalTitle: "आवेदक पारदर्शिता पोर्टल (Applicant Transparency Portal)",
    portalSubtitle: "आपकी संयुक्त राज्य अमेरिका वीज़ा याचिका की सीधी कानूनी स्थिति और विवरण",
    languageSelectorLabel: "भाषा (Language)",
    languageHelpBadge: "हिन्दी भाषा सहायता सक्रिय",
    languageWelcomeBanner: "आपके क्लाइंट पारदर्शिता पोर्टल में स्वागत है। यदि आप अंग्रेज़ी नहीं भी जानते हैं, तब भी आप अपनी वीज़ा स्थिति समझ सकते हैं और अपने अधिकारियों से समन्वय कर सकते हैं।",

    navOverview: "मेरी याचिका का विवरण (My Petition Overview)",
    navUpdates: "वीज़ा फ़ाइल अपडेट (Visa File Updates)",
    navDocuments: "दस्तावेज़ अपलोड करें (Evidence & Uploads)",
    navMessages: "केस अधिकारी से चैट करें (Lawyer Messages)",
    navQuestionnaire: "निर्देशित प्रश्नावली (Guided Questionnaire)",
    navForms: "आवेदन फॉर्मों की समीक्षा (Review Application Forms)",
    navMilestones: "केस के प्रमुख पड़ाव (Case Milestones)",
    navProfile: "आवेदक प्रोफ़ाइल (Applicant Profile)",
    navBilling: "रिटेनर और चालान (Retainers & Invoices)",
    navSettings: "गोपनीयता और सुरक्षा (Privacy & Security)",
    sectionsHeader: "केस अनुभाग",

    caseLabel: "केस",
    activeStatus: "सक्रिय (Active)",
    stageLabel: "चरण: साक्ष्य संकलन (Evidence Gathering)",
    assignedOfficerTitle: "केस प्रोसेसिंग अधिकारी",
    onlineNowText: "🟢 ऑनलाइन • सीधी लाइन",
    chatWithOfficerButton: "💬 केस अधिकारी से चैट करें",

    welcomeGreeting: "वापसी पर स्वागत है",
    actionRequiredNotice: "ध्यान दें - कार्रवाई आवश्यक है",
    missingDocsText: "दस्तावेज़ तत्काल जमा किए जाने शेष हैं",
    uploadEvidenceButton: "अभी साक्ष्य अपलोड करें",
    caseStatusTitle: "USCIS याचिका स्थिति और आधिकारिक डॉकेट",
    uscisReceiptNumber: "रसीद संख्या (Receipt #)",
    priorityDateLabel: "प्राथमिकता तिथि (Priority Date)",
    serviceCenterLabel: "USCIS सेवा केंद्र",
    statusBadgeText: "फॉर्म I-140 स्वीकृत ✓ (Approved)",
    latestUpdatesHeader: "नवीनतम वीज़ा फ़ाइल अपडेट और USCIS स्थिति",
    viewAllUpdatesLink: "सभी वीज़ा फ़ाइल अपडेट देखें →",
    viewAllUpdatesButton: "सभी वीज़ा फ़ाइल अपडेट देखें →",
    milestonesTitle: "केस के महत्वपूर्ण चरण और प्रगति (Case Milestones)",

    docketHeaderTitle: "वीज़ा फ़ाइल अपडेट और USCIS आधिकारिक डॉकेट",
    docketHeaderSubtitle: "USCIS नोटिसों, वकील की दाखिलों, बायोमेट्रिक्स और कानूनी निर्णयों की तिथि-वार आधिकारिक सूची।",
    liveSyncText: "लाइव सिंक (Live Sync)",
    filterAll: "सभी अपडेट (All)",
    filterUSCIS: "USCIS आधिकारिक नोटिस",
    filterBiometrics: "बायोमेट्रिक्स (Biometrics)",
    filterOfficerActions: "अधिकारी की कार्रवाई",
    filterFilings: "साक्ष्य प्रस्तुतियाँ (Filings)",
    searchUpdatesPlaceholder: "फ़ाइल अपडेट खोजें (जैसे बायोमेट्रिक्स, स्वीकृति, I-797, कजारियन)...",
    legalSignificanceLabel: "कानूनी महत्व (Legal Significance):",
    noticeNumberLabel: "आधिकारिक संदर्भ:",
    actingOfficerLabel: "कार्यकारी अधिकारी:",

    uploadHeaderTitle: "वीज़ा याचिका साक्ष्य अपलोड करें (Upload Document)",
    uploadHeaderSubtitle: "अपने आवंटित केस प्रोसेसिंग अधिकारी को साक्ष्य फ़ाइलें सीधे भेजें। प्रत्येक दस्तावेज़ आपके डिवाइस पर सुरक्षित रूप से एन्क्रिप्ट होता है।",
    dropzoneTitle: "फ़ाइल चुनने के लिए क्लिक करें या यहाँ खींचकर छोड़ें (Drag & Drop)",
    dropzoneSubtitle: "कानूनी समीक्षा टीम के लिए सुरक्षित सीधा अपलोड",
    supportedFormatsText: "स्वीकृत प्रारूप: PDF, JPEG, PNG, TIFF, WebP (अधिकतम फ़ाइल आकार: 50MB)",
    sha256NoticeTitle: "SHA-256 क्रिप्टोग्राफ़िक फ़िंगरप्रिंटिंग सक्रिय है",
    sha256NoticeDesc: "दस्तावेज़ की प्रामाणिकता और अखंडता सुनिश्चित करने के लिए आपके ब्राउज़र में स्वचालित डिजिटल हैश उत्पन्न होता है।",
    categorySelectLabel: "दस्तावेज़ श्रेणी चुनें",
    categoryPlaceholder: "श्रेणी चुनें...",
    categories: {
      identity: "पहचान और नागरिक दस्तावेज़ (पासपोर्ट, आधार, जन्म प्रमाण पत्र)",
      academic: "शैक्षणिक डिग्री और प्रमाण पत्र (डिप्लोमा, अंकतालिका)",
      recommendation: "विशेषज्ञ अनुशंसा पत्र (Expert Recommendation Letters)",
      publications: "प्रकाशित शोध लेख और मीडिया कवरेज साक्ष्य",
      awards: "प्रमुख पुरस्कार, सम्मान और उच्च वेतन के साक्ष्य",
      financial: "टैक्स रिटर्न, W-2 और वित्तीय दस्तावेज़",
    },
    confidentialNoteLabel: "केस प्रोसेसिंग अधिकारी के लिए गोपनीय नोट (वैकल्पिक)",
    confidentialNotePlaceholder: "अपने केस अधिकारी के लिए कोई विशेष जानकारी यहाँ लिखें...",
    uploadButtonText: "साक्ष्य फ़ाइल अपलोड करें (Upload File)",
    uploadingButtonText: "एन्क्रिप्ट और अपलोड हो रहा है...",
    uploadSuccessNotice: "दस्तावेज़ सुरक्षित रूप से अपलोड हो गया है और आपकी फ़ाइल में जोड़ दिया गया है।",

    officerBannerTitle: "केस प्रोसेसिंग अधिकारी से सीधी बातचीत",
    officerBannerSubtitle: "अपने केस अधिकारी के साथ विशेषाधिकार प्राप्त सीधा कानूनी संवाद। आपके प्रश्नों की प्राथमिकता समीक्षा की जाती है।",
    officerLegalPrivilegeBadge: "8 CFR § 292.1 वकील-मुवक्किल विशेषाधिकार प्राप्त संचार (Attorney-Client Privilege)",
    officerOnlineStatusText: "अभी ऑनलाइन (औसत उत्तर समय < 15 मिनट)",
    quickInquiryHeader: "त्वरित प्रश्न विकल्प (संदेश तैयार करने के लिए क्लिक करें):",
    bilingualAssistantTitle: "द्विभाषी भाषा सहायक (Hindi & English Coordination)",
    bilingualAssistantDesc: "आप हिन्दी में प्रश्न पूछ सकते हैं। अमेरिकी वकील तुरंत समझ सके इसलिए अंग्रेज़ी अनुवाद के साथ संदेश तैयार होता है।",
    translateIncomingButton: "हिन्दी में अनुवाद देखें",
    hideTranslationButton: "मूल अंग्रेज़ी देखें",
    translationLabel: "आधिकारिक हिन्दी अनुवाद",
    messagePlaceholder: "अपने वकील या केस अधिकारी के लिए यहाँ प्रश्न लिखें...",
    sendMessageButton: "संदेश भेजें (Send Message)",
    promptChips: {
      timeline: {
        title: "अगले पड़ाव के लिए अनुमानित समय सीमा पूछें",
        prompt: "[हिन्दी]: नमस्ते सारा, मैं अपनी वीज़ा याचिका के अगले चरण के लिए अनुमानित समय सीमा जानना चाहता हूँ। यह कब तक पूरा होगा?\n[English for Officer]: Hello Sarah, could you please provide an estimated timeline for the next milestone in my petition? Thank you!",
      },
      travel: {
        title: "याचिका लंबित होने पर विदेश यात्रा के बारे में पूछें",
        prompt: "[हिन्दी]: नमस्ते अधिकारी महोदय, क्या याचिका लंबित होने के दौरान मेरे लिए भारत या विदेश यात्रा करना सुरक्षित है? क्या मुझे अग्रिम पैरोल की आवश्यकता है?\n[English for Officer]: Dear Case Officer, is it safe for me to travel internationally (e.g., to India) while my visa petition is pending? Do I need advance travel authorization?",
      },
      taxReturns: {
        title: "अपलोड किए गए टैक्स रिटर्न पर्याप्त हैं या नहीं यह जाँचें",
        prompt: "[हिन्दी]: नमस्ते, मैंने अपने हालिया टैक्स रिटर्न और W-2 अपलोड किए हैं। कृपया पुष्टि करें कि क्या वे सभी आवश्यकताओं को पूरा करते हैं?\n[English for Officer]: Hello, I have uploaded my recent tax returns and W-2s. Could you please confirm if they satisfy all evidentiary requirements?",
      },
      approvalCopy: {
        title: "फॉर्म I-797 स्वीकृति पत्र की प्रमाणित प्रति का अनुरोध करें",
        prompt: "[हिन्दी]: नमस्ते, कृपया मेरे व्यक्तिगत रिकॉर्ड के लिए मेरे फॉर्म I-797 स्वीकृति पत्र की प्रमाणित डिजिटल प्रति प्रदान करें।\n[English for Officer]: Dear Officer, could you please provide a certified digital copy of my Form I-797 Approval Notice for my personal records?",
      },
    },
  },
};

/**
 * Pre-compiled authentic translations for standard case messages so that
 * retained clients can read lawyer / officer correspondence directly in Gujarati or Hindi.
 */
export const MESSAGE_TRANSLATIONS: Record<
  string,
  { gu: string; hi: string }
> = {
  default_welcome: {
    gu: "નમસ્તે! અમે તમારા પ્રારંભિક પીઅર-રિવ્યુ પત્રો અને પ્રકાશનોની સમીક્ષા કરી છે. કાઝારિયન કાનૂની માળખા હેઠળ તમારા પુરાવા અત્યંત મજબૂત જણાય છે. અમે આગામી તબક્કા માટે ફોર્મ તૈયાર કરી રહ્યા છીએ.",
    hi: "नमस्ते! हमने आपके प्रारंभिक सहकर्मी-समीक्षा पत्रों और प्रकाशनों की समीक्षा की है। कजारियन कानूनी ढांचे के तहत आपके साक्ष्य अत्यधिक मजबूत प्रतीत होते हैं। हम अगले चरण के लिए फॉर्म तैयार कर रहे हैं।",
  },
  default_status: {
    gu: "તમારી વિઝા અરજી ફાઇલિંગ માટે તૈયાર છે. અમે તમામ સિવિલ દસ્તાવેજો ચકાસી લીધા છે અને USCIS પોર્ટલ પર અપડેટ સબમિટ કર્યું છે.",
    hi: "आपकी वीज़ा याचिका दाखिल करने के लिए तैयार है। हमने सभी नागरिक दस्तावेजों की पुष्टि कर ली है और USCIS पोर्टल पर अपडेट जमा कर दिया है।",
  },
};

/**
 * Safely read stored client language preference from localStorage,
 * defaulting to English ("en").
 */
export function getSavedClientLanguage(): ClientLanguage {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("documento_client_language");
    if (saved === "gu" || saved === "hi" || saved === "en") {
      return saved;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return "en";
}

/**
 * Save client language preference to localStorage.
 */
export function saveClientLanguage(lang: ClientLanguage): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("documento_client_language", lang);
  } catch {
    // Ignore storage errors
  }
}
