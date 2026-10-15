import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { ClientLanguageBar } from "../components/portal/ClientLanguageBar";
import { VisaFileUpdatesView } from "../components/portal/VisaFileUpdatesView";
import { CaseOfficerChatBanner } from "../components/portal/CaseOfficerChatBanner";
import { DirectDocumentUploader } from "../components/portal/DirectDocumentUploader";
import { SecureMessagingHub } from "../components/portal/SecureMessagingHub";
import {
  CLIENT_TRANSLATIONS,
  getSavedClientLanguage,
  saveClientLanguage,
} from "../lib/clientLocalization";
import {
  FIXTURE_CASES,
  FIXTURE_DOCUMENTS,
  FIXTURE_MESSAGES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_INVOICES,
} from "../lib/api";

describe("Retained Client Localization — Gujarati (ગુજરાતી) & Hindi (हिन्दी) Support", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. ClientLanguageBar & Storage Persistence", () => {
    it("renders English, Gujarati, and Hindi options with native labels and flags", () => {
      const handleLanguageChange = vi.fn();
      render(
        <ClientLanguageBar
          currentLanguage="en"
          onLanguageChange={handleLanguageChange}
        />
      );

      // Verify all 3 supported languages are rendered with native scripts
      expect(screen.getByRole("button", { name: /English/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /ગુજરાતી/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /हिन्दी/i })).toBeDefined();

      // Click Gujarati button
      const gujaratiBtn = screen.getByRole("button", { name: /ગુજરાતી/i });
      fireEvent.click(gujaratiBtn);
      expect(handleLanguageChange).toHaveBeenCalledWith("gu");

      // Click Hindi button
      const hindiBtn = screen.getByRole("button", { name: /हिन्दी/i });
      fireEvent.click(hindiBtn);
      expect(handleLanguageChange).toHaveBeenCalledWith("hi");
    });

    it("correctly saves and retrieves language preference from localStorage", () => {
      expect(getSavedClientLanguage()).toBe("en");

      saveClientLanguage("gu");
      expect(getSavedClientLanguage()).toBe("gu");
      expect(localStorage.getItem("documento_client_language")).toBe("gu");

      saveClientLanguage("hi");
      expect(getSavedClientLanguage()).toBe("hi");
      expect(localStorage.getItem("documento_client_language")).toBe("hi");
    });
  });

  describe("2. ClientPortal Language Switching (English -> Gujarati -> Hindi)", () => {
    it("dynamically localizes sidebar, active case card, overview headers, and tabs into Gujarati", async () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Default is English
      expect(screen.getAllByText(/My Petition Overview/i).length).toBeGreaterThan(0);

      // Click Gujarati language button on the persistent banner
      const gujaratiBtn = screen.getByRole("button", { name: /ગુજરાતી/i });
      fireEvent.click(gujaratiBtn);

      await waitFor(() => {
        // Localized navigation items in Gujarati
        expect(screen.getAllByText(/મારી અરજીની ઝાંખી/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/વિઝા ફાઇલ અપડેટ્સ/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/દસ્તાવેજો અપલોડ કરો/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/કેસ અધિકારી સાથે વાતચીત/i).length).toBeGreaterThan(0);

        // Localized sidebar officer card
        expect(screen.getAllByText(/કેસ પ્રોસેસિંગ અધિકારી/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/અધિકારી સાથે વાતચીત કરો/i).length).toBeGreaterThan(0);

        // Localized overview headers
        expect(screen.getAllByText(/તાજેતરના વિઝા ફાઇલ અપડેટ્સ/i).length).toBeGreaterThan(0);
      });
    });

    it("dynamically localizes sidebar, active case card, overview headers, and tabs into Hindi", async () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Click Hindi language button
      const hindiBtn = screen.getByRole("button", { name: /हिन्दी/i });
      fireEvent.click(hindiBtn);

      await waitFor(() => {
        // Localized navigation items in Hindi
        expect(screen.getAllByText(/मेरी याचिका का विवरण/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/वीज़ा फ़ाइल अपडेट/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/दस्तावेज़ अपलोड करें/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/केस अधिकारी से चैट करें/i).length).toBeGreaterThan(0);

        // Localized sidebar officer card
        expect(screen.getAllByText(/केस प्रोसेसिंग अधिकारी/i).length).toBeGreaterThan(0);

        // Localized overview headers
        expect(screen.getAllByText(/नवीनतम वीज़ा फ़ाइल अपडेट/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe("3. CaseOfficerChatBanner Bilingual Prompts for Non-English Speaking Clients", () => {
    it("generates bilingual dual-language prompts in Gujarati paired with English for US attorneys", () => {
      const handleSelectPrompt = vi.fn();
      render(
        <CaseOfficerChatBanner
          caseNumber="CASE-US-8841"
          visaCategory="EB-1A Extraordinary Ability"
          language="gu"
          onSelectPrompt={handleSelectPrompt}
        />
      );

      // Privilege badge in Gujarati
      expect(screen.getByText(/8 CFR § 292.1/i)).toBeDefined();

      // Quick inquiry prompt chip in Gujarati
      const receiptPromptBtn = screen.getByText(/ફોર્મ I-797/i);
      expect(receiptPromptBtn).toBeDefined();

      fireEvent.click(receiptPromptBtn);

      // Verified dual-language output: Gujarati for client reassurance, English for attorney action
      expect(handleSelectPrompt).toHaveBeenCalledWith(
        expect.stringContaining("[ગુજરાતી]:")
      );
      expect(handleSelectPrompt).toHaveBeenCalledWith(
        expect.stringContaining("[English for Officer]:")
      );
    });

    it("generates bilingual dual-language prompts in Hindi paired with English for US attorneys", () => {
      const handleSelectPrompt = vi.fn();
      render(
        <CaseOfficerChatBanner
          caseNumber="CASE-US-8841"
          visaCategory="EB-1A Extraordinary Ability"
          language="hi"
          onSelectPrompt={handleSelectPrompt}
        />
      );

      // Quick inquiry prompt chip in Hindi
      const travelPromptBtn = screen.getByText(/विदेश यात्रा/i);
      expect(travelPromptBtn).toBeDefined();

      fireEvent.click(travelPromptBtn);

      // Verified dual-language output: Hindi for client reassurance, English for attorney action
      expect(handleSelectPrompt).toHaveBeenCalledWith(
        expect.stringContaining("[हिन्दी]:")
      );
      expect(handleSelectPrompt).toHaveBeenCalledWith(
        expect.stringContaining("[English for Officer]:")
      );
    });
  });

  describe("4. VisaFileUpdatesView In-Depth Localization", () => {
    it("renders statutory docket items and legal authorities in authentic Gujarati", () => {
      render(
        <VisaFileUpdatesView
          myCase={FIXTURE_CASES[0]}
          language="gu"
          onNavigateTab={vi.fn()}
        />
      );

      // Header in Gujarati
      expect(screen.getByText(/વિઝા ફાઇલ અપડેટ્સ અને USCIS સત્તાવાર ડૉકેટ/i)).toBeDefined();

      // Biometrics update in Gujarati
      expect(screen.getByText(/USCIS ફોર્મ I-797C બાયોમેટ્રિક્સ એપોઇન્ટમેન્ટ નોટિસ જારી કરાઈ/i)).toBeDefined();
      expect(screen.getByText(/સાન જોસ એપ્લિકેશન સપોર્ટ સેન્ટર/i)).toBeDefined();

      // Legal significance in Gujarati
      expect(screen.getByText(/8 CFR § 103.2\(b\)\(9\) હેઠળ કાનૂની ઓળખ ચકાસણી/i)).toBeDefined();

      // Filter pills in Gujarati
      expect(screen.getByRole("button", { name: /બધા અપડેટ્સ/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /બાયોમેટ્રિક્સ/i })).toBeDefined();
    });

    it("renders statutory docket items and legal authorities in authentic Hindi", () => {
      render(
        <VisaFileUpdatesView
          myCase={FIXTURE_CASES[0]}
          language="hi"
          onNavigateTab={vi.fn()}
        />
      );

      // Header in Hindi
      expect(screen.getByText(/वीज़ा फ़ाइल अपडेट और USCIS आधिकारिक डॉकेट/i)).toBeDefined();

      // Approval update in Hindi
      expect(screen.getByText(/फॉर्म I-140 असाधारण क्षमता \(EB-1A\) याचिका USCIS द्वारा स्वीकृत ✓/i)).toBeDefined();

      // Legal significance in Hindi
      expect(screen.getByText(/INA § 203\(b\)\(1\)\(A\) के तहत आपकी स्थायी आप्रवासी वीज़ा श्रेणी/i)).toBeDefined();

      // Filter pills in Hindi
      expect(screen.getByRole("button", { name: /सभी अपडेट/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /बायोमेट्रिक्स/i })).toBeDefined();
    });
  });

  describe("5. DirectDocumentUploader In-Depth Localization", () => {
    it("localizes document uploader header, notes, and instructions in Gujarati", () => {
      render(
        <DirectDocumentUploader
          caseId="case-01"
          language="gu"
          onDocumentUploaded={vi.fn()}
        />
      );

      expect(screen.getAllByText(/પુરાવા ફાઇલ અપલોડ કરો/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/કેસ પ્રોસેસિંગ અધિકારી માટે ગુપ્ત નોંધ/i)).toBeDefined();
      expect(
        screen.getByPlaceholderText(/તમારા કેસ અધિકારી માટે કોઈપણ વધારાની માહિતી અહીં લખો/i)
      ).toBeDefined();
    });

    it("localizes document uploader header, notes, and instructions in Hindi", () => {
      render(
        <DirectDocumentUploader
          caseId="case-01"
          language="hi"
          onDocumentUploaded={vi.fn()}
        />
      );

      expect(screen.getAllByText(/साक्ष्य फ़ाइल अपलोड करें/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/केस प्रोसेसिंग अधिकारी के लिए गोपनीय नोट/i)).toBeDefined();
      expect(
        screen.getByPlaceholderText(/अपने केस अधिकारी के लिए कोई विशेष जानकारी यहाँ लिखें/i)
      ).toBeDefined();
    });
  });

  describe("6. SecureMessagingHub Incoming Message Translation", () => {
    it("provides on-demand translation toggle into Gujarati for English legal advice", async () => {
      render(
        <SecureMessagingHub
          caseId="case-01"
          isStaffMode={false}
          language="gu"
          onSendMessage={vi.fn()}
        />
      );

      // Wait for thread messages to load
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /અનુવાદ જુઓ/i }).length).toBeGreaterThan(0);
      });

      const translateButtons = screen.getAllByRole("button", { name: /અનુવાદ જુઓ/i });
      fireEvent.click(translateButtons[0]);

      // Verify Gujarati translation is displayed
      await waitFor(() => {
        expect(screen.getAllByText(/ગુજરાતી અનુવાદ/i).length).toBeGreaterThan(0);
      });
    });

    it("provides on-demand translation toggle into Hindi for English legal advice", async () => {
      render(
        <SecureMessagingHub
          caseId="case-01"
          isStaffMode={false}
          language="hi"
          onSendMessage={vi.fn()}
        />
      );

      // Wait for thread messages to load
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /अनुवाद देखें/i }).length).toBeGreaterThan(0);
      });

      const translateButtons = screen.getAllByRole("button", { name: /अनुवाद देखें/i });
      fireEvent.click(translateButtons[0]);

      // Verify Hindi translation is displayed
      await waitFor(() => {
        expect(screen.getAllByText(/हिन्दी अनुवाद/i).length).toBeGreaterThan(0);
      });
    });
  });
});
