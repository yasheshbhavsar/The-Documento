"use client";

import React, { useState, useMemo } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

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

export interface DocumentoFAQProps {
  onOpenLogin?: (portal?: "firm" | "client") => void;
}

export function DocumentoFAQ({ onOpenLogin }: DocumentoFAQProps = {}) {
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
      id="faq-content"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "88px 24px",
        scrollMarginTop: "80px",
        borderBottom: "1px solid rgba(13, 104, 102, 0.1)",
      }}
    >
      <InteractiveSectionBackground variant="dot-matrix" />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "40px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: ~1/3 (Intro, Search & Category Navigation List) */}
        <div
          className="animate-on-scroll section-header-reveal faq-col-left"
          data-motion="left"
          style={{
            gridColumn: "span 4",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
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
              fontSize: "11.5px",
              fontWeight: 650,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "#0D6866",
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
              fontSize: "clamp(28px, 3.2vw, 40px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
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
              color: "#526664",
              lineHeight: 1.65,
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
                padding: "11px 14px 11px 38px",
                borderRadius: "10px",
                border: "1px solid rgba(13, 104, 102, 0.16)",
                background: "#FFFFFF",
                fontSize: "13.5px",
                color: "#063C3D",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#0D6866")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(13, 104, 102, 0.16)")}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#526664"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ position: "absolute", left: "12px", top: "13px", pointerEvents: "none" }}
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
                  color: "#526664",
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
              marginTop: "6px",
              borderTop: "1px solid rgba(13, 104, 102, 0.1)",
              paddingTop: "16px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 650,
                color: "#6B8280",
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
                    borderRadius: "8px",
                    background: isSelected ? "#EAF5EF" : "transparent",
                    color: isSelected ? "#063C3D" : "#526664",
                    border: "none",
                    borderLeft: isSelected ? "2.5px solid #169B77" : "2.5px solid transparent",
                    fontSize: "13.5px",
                    fontWeight: isSelected ? 650 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(234, 245, 239, 0.45)";
                      e.currentTarget.style.color = "#063C3D";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#526664";
                    }
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: isSelected ? "#0D6866" : "#6B8280",
                      padding: "1px 6px",
                      borderRadius: "999px",
                      background: isSelected ? "rgba(22, 155, 119, 0.12)" : "transparent",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Minimal Accordion Cards) */}
        <div
          className="animate-on-scroll faq-col-right"
          data-motion="right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {filteredFaqs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "#526664",
                fontSize: "14.5px",
                background: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid rgba(13, 104, 102, 0.12)",
              }}
            >
              <div style={{ fontWeight: 600, color: "#063C3D", marginBottom: "6px" }}>
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
                  borderRadius: "8px",
                  border: "1px solid rgba(13, 104, 102, 0.18)",
                  background: "#FFFFFF",
                  color: "#0D6866",
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
                  className="spotlight-card"
                  style={{
                    background: isOpen ? "#F8FCFA" : "#FFFFFF",
                    border: isOpen ? "1.5px solid rgba(13, 104, 102, 0.28)" : "1px solid rgba(13, 104, 102, 0.12)",
                    borderRadius: "14px",
                    padding: "0 24px",
                    boxShadow: isOpen
                      ? "0 12px 30px -10px rgba(13, 104, 102, 0.08)"
                      : "0 4px 12px -4px rgba(6, 60, 61, 0.03)",
                    transition:
                      "background-color 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
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
                      padding: "20px 0",
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
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#169B77",
                        }}
                      >
                        {item.category}
                      </span>
                      <span
                        style={{
                          fontSize: "16px",
                          fontWeight: 650,
                          color: isOpen ? "#0D6866" : "#063C3D",
                          lineHeight: 1.38,
                          letterSpacing: "-0.01em",
                          transition: "color 0.15s ease",
                        }}
                      >
                        {item.question}
                      </span>
                    </div>

                    {/* Rotating Plus Control */}
                    <span
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        border: isOpen ? "1px solid #169B77" : "1px solid rgba(13, 104, 102, 0.18)",
                        background: isOpen ? "#169B77" : "#FFFFFF",
                        color: isOpen ? "#FFFFFF" : "#526664",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        lineHeight: 1,
                        flexShrink: 0,
                        marginTop: "2px",
                        fontWeight: 400,
                        transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                        transition:
                          "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms ease, color 200ms ease, border-color 200ms ease",
                      }}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      id={`faq-answer-${item.id}`}
                      role="region"
                      aria-labelledby={`faq-btn-${item.id}`}
                      style={{
                        padding: "0 0 22px 0",
                        borderTop: "1px solid rgba(13, 104, 102, 0.08)",
                        paddingTop: "14px",
                        fontSize: "14.5px",
                        color: "#526664",
                        lineHeight: 1.68,
                        maxWidth: "720px",
                        animation: "faqAnswerReveal 260ms cubic-bezier(0.22, 1, 0.36, 1)",
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

      {/* Next Step Conversion Bar */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1200px", margin: "64px auto 0 auto" }}>
        <div
          className="animate-on-scroll hover-lift"
          data-motion="scale"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
            borderRadius: "20px",
            padding: "44px 48px",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "28px",
            boxShadow: "0 24px 56px -14px rgba(6, 60, 61, 0.22)",
            border: "1px solid rgba(94, 234, 212, 0.22)",
          }}
        >
          <div style={{ position: "relative", zIndex: 1, maxWidth: "600px" }}>
            <div
              className="spring-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontSize: "11px",
                fontWeight: 650,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5EEAD4",
                background: "rgba(94, 234, 212, 0.12)",
                padding: "4px 10px",
                borderRadius: "999px",
                border: "1px solid rgba(94, 234, 212, 0.28)",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#5EEAD4",
                  display: "inline-block",
                }}
                className="status-dot-pulse"
              />
              <span>Production-Ready Casework Architecture</span>
            </div>
            <h3
              style={{
                fontSize: "clamp(22px, 2.5vw, 28px)",
                fontWeight: 700,
                color: "#FFFFFF",
                margin: "0 0 8px 0",
                lineHeight: 1.22,
                letterSpacing: "-0.02em",
              }}
            >
              Ready to bring clarity and structure to your immigration casework?
            </h3>
            <p style={{ fontSize: "14.5px", color: "#E2F2ED", margin: 0, lineHeight: 1.6 }}>
              Join immigration law firms and applicants using Documento to eliminate administrative chaos and assemble verified filings.
            </p>
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onOpenLogin?.("firm")}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                border: "none",
                background: "#5EEAD4",
                color: "#063C3D",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#5EEAD4")}
            >
              Get Started as a Firm
            </button>

            <a
              href="#coverage"
              style={{
                padding: "12px 20px",
                borderRadius: "10px",
                border: "1px solid rgba(226, 242, 237, 0.35)",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
                backdropFilter: "blur(4px)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")}
            >
              Explore Supported Pathways →
            </a>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes faqAnswerReveal {
              0% {
                opacity: 0;
                transform: translateY(-6px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }
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
