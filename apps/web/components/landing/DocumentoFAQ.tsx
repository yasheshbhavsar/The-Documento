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

const CATEGORIES = [
  "ALL",
  "Coverage & Scope",
  "Legal & Ethics",
  "AI & Accuracy",
  "Security & Privacy",
  "Collaboration",
] as const;

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

  const getCategoryCount = (cat: string) => {
    if (cat === "ALL") return FAQS.length;
    return FAQS.filter((f) => f.category === cat).length;
  };

  return (
    <section
      id="faq"
      style={{
        padding: "88px 24px",
        scrollMarginTop: "80px",
        borderBottom: "1px solid #DCE7E3",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "48px 56px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: ~1/3 (Intro, Search & Category Navigation List) */}
        <div
          className="animate-on-scroll faq-col-left"
          style={{
            gridColumn: "span 4",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            position: "sticky",
            top: "100px",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 650,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#07594F",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#169B77",
              }}
            />
            <span>FAQ &amp; Verification</span>
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: "clamp(28px, 3.2vw, 42px)",
              fontWeight: 700,
              color: "#073D40",
              lineHeight: 1.18,
              letterSpacing: "-0.025em",
              margin: 0,
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Frequently Asked Questions
          </h2>

          {/* Subheading */}
          <p
            style={{
              fontSize: "15.5px",
              color: "#5D6E7F",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Clear, verified answers regarding our supported jurisdictions, AI architecture, and legal boundaries.
          </p>

          {/* Search Box */}
          <div style={{ position: "relative", width: "100%", marginTop: "4px" }}>
            <input
              type="text"
              aria-label="Search frequently asked questions"
              placeholder="Search frequently asked questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                borderRadius: "8px",
                border: "1px solid #DCE7E3",
                background: "#FFFFFF",
                fontSize: "13.5px",
                color: "#073D40",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#07594F")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#DCE7E3")}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5D6E7F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ position: "absolute", left: "12px", top: "12px", pointerEvents: "none" }}
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
                  top: "9px",
                  background: "none",
                  border: "none",
                  color: "#5D6E7F",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Vertical Category Navigation List */}
          <div
            role="navigation"
            aria-label="FAQ Categories"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginTop: "8px",
              borderTop: "1px solid #DCE7E3",
              paddingTop: "14px",
            }}
          >
            <div
              style={{
                fontSize: "11.5px",
                fontWeight: 650,
                color: "#7B8E8B",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Browse By Topic
            </div>

            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = getCategoryCount(cat);
              const label = cat === "ALL" ? "All Questions" : cat;

              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    background: isSelected ? "#EAF5EF" : "transparent",
                    color: isSelected ? "#073D40" : "#5D6E7F",
                    border: "none",
                    borderLeft: isSelected ? "3px solid #169B77" : "3px solid transparent",
                    fontSize: "13.5px",
                    fontWeight: isSelected ? 650 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(234, 245, 239, 0.45)";
                      e.currentTarget.style.color = "#073D40";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#5D6E7F";
                    }
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: isSelected ? "#07594F" : "#7B8E8B",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isSelected ? "rgba(22, 155, 119, 0.15)" : "transparent",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Minimalist Open Accordion Rows separated by hairlines) */}
        <div
          className="animate-on-scroll delay-150 faq-col-right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            borderTop: "1px solid #DCE7E3",
          }}
        >
          {filteredFaqs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "#5D6E7F",
                fontSize: "14.5px",
              }}
            >
              <div style={{ marginBottom: "12px", fontSize: "20px" }}>🔍</div>
              <div style={{ fontWeight: 600, color: "#073D40", marginBottom: "6px" }}>
                No questions matched your search
              </div>
              <p style={{ margin: "0 0 16px 0", fontSize: "13.5px" }}>
                Try searching with different terms or reset your active filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #DCE7E3",
                  background: "#FFFFFF",
                  color: "#07594F",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredFaqs.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #DCE7E3",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <button
                    type="button"
                    id={`faq-btn-${item.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${item.id}`}
                    onClick={() => toggleItem(item.id)}
                    style={{
                      width: "100%",
                      padding: "22px 0",
                      background: "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "24px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 650,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "#169B77",
                        }}
                      >
                        {item.category}
                      </span>
                      <span
                        style={{
                          fontSize: "17px",
                          fontWeight: 650,
                          color: isOpen ? "#07594F" : "#073D40",
                          lineHeight: 1.35,
                          transition: "color 0.15s ease",
                        }}
                      >
                        {item.question}
                      </span>
                    </div>

                    {/* Plus / Minus Control on the far right */}
                    <span
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        border: "1px solid #DCE7E3",
                        background: isOpen ? "#EAF5EF" : "#FFFFFF",
                        color: isOpen ? "#07594F" : "#5D6E7F",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        lineHeight: 1,
                        flexShrink: 0,
                        marginTop: "2px",
                        fontWeight: 400,
                        transition: "all 0.15s ease",
                      }}
                      aria-hidden="true"
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      id={`faq-answer-${item.id}`}
                      role="region"
                      aria-labelledby={`faq-btn-${item.id}`}
                      style={{
                        padding: "0 0 24px 0",
                        fontSize: "15px",
                        color: "#5D6E7F",
                        lineHeight: 1.68,
                        maxWidth: "720px",
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

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1024px) {
              .faq-col-left,
              .faq-col-right {
                grid-column: span 12 !important;
                position: static !important;
              }
            }
          `,
        }}
      />
    </section>
  );
}
