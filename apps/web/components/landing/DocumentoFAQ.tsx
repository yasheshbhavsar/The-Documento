"use client";

import React, { useState, useMemo } from "react";

interface FAQItem {
  id: string;
  question: string;
  category: "Coverage & Scope" | "Legal & Ethics" | "AI & Accuracy" | "Security & Privacy" | "Collaboration";
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "countries-supported",
    category: "Coverage & Scope",
    question: "Which destination countries and immigration categories does Documento support today?",
    answer:
      "Documento provides verified, operational casework pipelines for three primary jurisdictions: the United States (USCIS: EB-1A Extraordinary Ability, O-1A Nonimmigrant Talent, EB-2 National Interest Waiver, and L-1A Multinational Transferee), the United Kingdom (UKVI: Global Talent Visa via Tech Nation and academic endorsing bodies), and Canada (IRCC: Express Entry FSWP and PNP). Two additional jurisdictions—Australia (Subclass 858) and Germany (EU Blue Card & Chancenkarte)—are currently active in our regulatory pilot watchlist. We do not claim universal coverage for all world visas.",
  },
  {
    id: "legal-advice-boundary",
    category: "Legal & Ethics",
    question: "Does Documento replace immigration attorneys or provide legal advice?",
    answer:
      "No. Documento is an immigration casework and evidence intelligence platform, not a law firm. Documento does not provide legal representation, statutory interpretation, or legal advice, and is not affiliated with USCIS, UKVI, IRCC, or any government body. Consequential legal conclusions, petition brief drafting, and final case authorization strictly require the evaluation and signature of a licensed immigration attorney or accredited representative.",
  },
  {
    id: "ai-accuracy",
    category: "AI & Accuracy",
    question: "How does Documento's AI assistance work, and can it hallucinate or fabricate facts?",
    answer:
      "Documento enforces 100% source provenance. Unlike general-purpose chatbots, our extraction engine binds every extracted fact (dates, names, citations, entity titles) to exact physical page coordinates and paragraph numbers within your uploaded exhibits. Every file receives an immutable SHA-256 cryptographic hash. If a document scan is blurred or contradictory, Documento flags a low-confidence discrepancy for attorney review rather than inventing a fact.",
  },
  {
    id: "data-privacy",
    category: "Security & Privacy",
    question: "How are sensitive identity documents, passports, and tax records protected?",
    answer:
      "All documents are encrypted in transit via TLS 1.3 and at rest using AES-256 vault encryption. Documento enforces strict multi-tenant row- and schema-level isolation. Confidential attorney strategy notes, private partner deliberations, and case evaluation memos are enforced by backend security rules and are strictly inaccessible to client portal logins.",
  },
  {
    id: "client-collaboration",
    category: "Collaboration",
    question: "How do retained applicants and law firm paralegals collaborate in Documento?",
    answer:
      "Applicants receive a secure invite to their dedicated portal where they can complete structured multi-lingual questionnaires, review explicit document checklists with accepted formatting guidelines, upload records directly from a phone or computer, and message their assigned legal team. A dual waiting-state indicator shows exactly who holds the next action item ('Waiting on You' vs 'Waiting on Firm').",
  },
  {
    id: "unlisted-categories",
    category: "Coverage & Scope",
    question: "What happens if my visa category is not currently listed as Available?",
    answer:
      "For unlisted or custom categories, law firms can still utilize Documento's core encrypted document vault, procedural task checklists, milestone tracking, and secure messaging hub. However, automated statutory criteria checklists and form mappings for those categories require confirmation or custom configuration. Contact our legal operations team to verify our roadmap schedule.",
  },
  {
    id: "guarantee-outcomes",
    category: "Legal & Ethics",
    question: "Can Documento guarantee that an immigration petition or visa will be approved?",
    answer:
      "No. No software, attorney, or company can guarantee an immigration outcome. Government immigration authorities possess sovereign adjudicative discretion. Documento's role is to minimize administrative confusion, prevent avoidable evidentiary omissions, catch cross-exhibit discrepancies early, and ensure legal packages are assembled to the highest standards of clarity.",
  },
];

export function DocumentoFAQ() {
  const [openId, setOpenId] = useState<string | null>("countries-supported");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((item) => {
      const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faq"
      style={{
        padding: "80px 24px",
        background: "#F8F7F2",
        borderBottom: "1px solid #DCE5E1",
      }}
    >
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
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
            <span>Truthful &amp; Transparent Answers</span>
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
            Frequently Asked Questions
          </h2>

          <p style={{ fontSize: "16px", color: "#445451", lineHeight: 1.6, margin: "0 auto 28px auto", maxWidth: "660px" }}>
            Clear answers derived directly from our verified product capabilities, legal governance architecture, and current release scope.
          </p>

          {/* Search Bar */}
          <div style={{ maxWidth: "480px", margin: "0 auto 20px auto", position: "relative" }}>
            <input
              type="text"
              placeholder="Search frequently asked questions..."
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

          {/* Category Filter Pills */}
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px" }}>
            {["ALL", "Coverage & Scope", "Legal & Ethics", "AI & Accuracy", "Security & Privacy", "Collaboration"].map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: selectedCategory === cat ? "#0D6866" : "#DCE5E1",
                    background: selectedCategory === cat ? "#0D6866" : "#FFFFFF",
                    color: selectedCategory === cat ? "#FFFFFF" : "#445451",
                    fontSize: "12px",
                    fontWeight: selectedCategory === cat ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat === "ALL" ? "All Questions" : cat}
                </button>
              )
            )}
          </div>
        </div>

        {/* Accordion Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredFaqs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px",
                background: "#FFFFFF",
                borderRadius: "12px",
                border: "1px dashed #DCE5E1",
                color: "#6E7F7C",
                fontSize: "14px",
              }}
            >
              No questions matched your search query. Try resetting filters.
            </div>
          ) : (
            filteredFaqs.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid",
                    borderColor: isOpen ? "#0D6866" : "#DCE5E1",
                    borderRadius: "12px",
                    overflow: "hidden",
                    transition: "border-color 0.15s ease",
                    boxShadow: isOpen ? "0 4px 16px rgba(13, 104, 102, 0.06)" : "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%",
                      padding: "18px 22px",
                      background: "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#0D6866",
                          background: "#DDEFE8",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          marginRight: "8px",
                        }}
                      >
                        {item.category}
                      </span>
                      <span style={{ fontSize: "16px", fontWeight: 650, color: "#063C3D" }}>
                        {item.question}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "18px",
                        color: isOpen ? "#0D6866" : "#6E7F7C",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      ▾
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        padding: "0 22px 20px 22px",
                        fontSize: "14px",
                        color: "#445451",
                        lineHeight: 1.6,
                        borderTop: "1px solid #F1F6F4",
                        paddingTop: "14px",
                      }}
                    >
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
