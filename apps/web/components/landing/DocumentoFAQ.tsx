"use client";

import React, { useState, useMemo } from "react";
import { InteractiveSectionBackground } from "./InteractiveSectionBackground";

interface FAQItem {
  id: string;
  question: string;
  category: "Coverage & Scope" | "Legal & Ethics" | "AI & Accuracy" | "Security & Privacy" | "Collaboration";
  answer: string;
  provenance: string;
}

const FAQS: FAQItem[] = [
  {
    id: "countries-supported",
    category: "Coverage & Scope",
    question: "Which destination countries and immigration categories does Documento support today?",
    answer:
      "Documento provides verified, operational casework pipelines for three primary jurisdictions: the United States (USCIS: EB-1A Extraordinary Ability, O-1A Nonimmigrant Talent, EB-2 National Interest Waiver, and L-1A Multinational Transferee), the United Kingdom (UKVI: Global Talent Visa via Tech Nation and academic endorsing bodies), and Canada (IRCC: Express Entry FSWP and PNP). Two additional jurisdictions—Australia (Subclass 858) and Germany (EU Blue Card & Chancenkarte)—are currently active in our regulatory pilot watchlist. We do not claim universal coverage for all world visas.",
    provenance: "STATUTORY PIPELINE CODEX § 4.1 // USCIS • UKVI • IRCC VERIFIED",
  },
  {
    id: "legal-advice-boundary",
    category: "Legal & Ethics",
    question: "Does Documento replace immigration attorneys or provide legal advice?",
    answer:
      "No. Documento is an immigration casework and evidence intelligence platform, not a law firm. Documento does not provide legal representation, statutory interpretation, or legal advice, and is not affiliated with USCIS, UKVI, IRCC, or any government body. Consequential legal conclusions, petition brief drafting, and final case authorization strictly require the evaluation and signature of a licensed immigration attorney or accredited representative.",
    provenance: "ABA MODEL RULES 5.3 & 5.5 // STATUTORY ETHICAL SEPARATION",
  },
  {
    id: "ai-accuracy",
    category: "AI & Accuracy",
    question: "How does Documento's AI assistance work, and can it hallucinate or fabricate facts?",
    answer:
      "Documento enforces 100% source provenance. Unlike general-purpose chatbots, our extraction engine binds every extracted fact (dates, names, citations, entity titles) to exact physical page coordinates and paragraph numbers within your uploaded exhibits. Every file receives an immutable SHA-256 cryptographic hash. If a document scan is blurred or contradictory, Documento flags a low-confidence discrepancy for attorney review rather than inventing a fact.",
    provenance: "OCR & PROVENANCE PROTOCOL // SHA-256 GEOMETRIC COORDINATE BINDING",
  },
  {
    id: "data-privacy",
    category: "Security & Privacy",
    question: "How are sensitive identity documents, passports, and tax records protected?",
    answer:
      "All documents are encrypted in transit via TLS 1.3 and at rest using AES-256 vault encryption. Documento enforces strict multi-tenant row- and schema-level isolation. Confidential attorney strategy notes, private partner deliberations, and case evaluation memos are enforced by backend security rules and are strictly inaccessible to client portal logins.",
    provenance: "NIST SP 800-88 / SOC-2 TYPE II // AES-256 VAULT ENCRYPTION",
  },
  {
    id: "client-collaboration",
    category: "Collaboration",
    question: "How do retained applicants and law firm paralegals collaborate in Documento?",
    answer:
      "Applicants receive a secure invite to their dedicated portal where they can complete structured multi-lingual questionnaires, review explicit document checklists with accepted formatting guidelines, upload records directly from a phone or computer, and message their assigned legal team. A dual waiting-state indicator shows exactly who holds the next action item ('Waiting on You' vs 'Waiting on Firm').",
    provenance: "DUAL-PORTAL INTERFACE // ASYMMETRIC PERMISSIONING MESH",
  },
  {
    id: "unlisted-categories",
    category: "Coverage & Scope",
    question: "What happens if my visa category is not currently listed as Available?",
    answer:
      "For unlisted or custom categories, law firms can still utilize Documento's core encrypted document vault, procedural task checklists, milestone tracking, and secure messaging hub. However, automated statutory criteria checklists and form mappings for those categories require confirmation or custom configuration. Contact our legal operations team to verify our roadmap schedule.",
    provenance: "REGULATORY ROADMAP TRACKER // CUSTOM FORM CONFIGURATION",
  },
  {
    id: "guarantee-outcomes",
    category: "Legal & Ethics",
    question: "Can Documento guarantee that an immigration petition or visa will be approved?",
    answer:
      "No. No software, attorney, or company can guarantee an immigration outcome. Government immigration authorities possess sovereign adjudicative discretion. Documento's role is to minimize administrative confusion, prevent avoidable evidentiary omissions, catch cross-exhibit discrepancies early, and ensure legal packages are assembled to the highest standards of clarity.",
    provenance: "GOVERNMENT DISCRETIONARY MANDATE // ZERO GUARANTEE POLICY",
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
        padding: "96px 24px 104px 24px",
        scrollMarginTop: "80px",
        background: "#FFFFFF",
        borderBottom: "1px solid #DCE7E3",
      }}
    >
      <InteractiveSectionBackground variant="dot-matrix" />
      {/* Anchor for #faq links */}
      <div id="faq" style={{ position: "relative", top: "-80px", visibility: "hidden" }} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "48px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: ~1/3 (Sticky Regulatory Intro, Search & Filter Rail) */}
        <div
          className="animate-on-scroll section-header-reveal faq-col-left"
          data-motion="left"
          style={{
            gridColumn: "span 4",
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            position: "sticky",
            top: "100px",
          }}
        >
          {/* Provenance Stamp */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#07594F",
            }}
          >
            Institutional Codex // Verification
          </div>

          {/* Heading - UNIFIED TEXT NODE TO PREVENT TESTING LIBRARY MATCH BREAKAGE */}
          <h2
            style={{
              fontSize: "clamp(30px, 3.4vw, 42px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.14,
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
              fontSize: "15px",
              color: "#445451",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            Clear, statutory answers regarding our supported jurisdictions, deterministic extraction, and ethical boundaries.
          </p>

          {/* Precision Search Box */}
          <div style={{ position: "relative", width: "100%", marginTop: "6px" }}>
            <input
              type="text"
              aria-label="Search frequently asked questions"
              placeholder="Search frequently asked questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 14px 13px 40px",
                borderRadius: "10px",
                border: "1.5px solid rgba(13, 104, 102, 0.18)",
                background: "#FFFFFF",
                fontSize: "13.5px",
                color: "#172322",
                outline: "none",
                boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
              }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0D6866"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ position: "absolute", left: "14px", top: "15px", pointerEvents: "none" }}
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
                  right: "12px",
                  top: "12px",
                  background: "#F1F6F4",
                  border: "1px solid rgba(13, 104, 102, 0.15)",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#063C3D",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: 0,
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
              gap: "5px",
              marginTop: "4px",
              background: "#FFFFFF",
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid rgba(13, 104, 102, 0.12)",
              boxShadow: "0 4px 16px -4px rgba(6, 60, 61, 0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 6px 10px 6px",
                borderBottom: "1px solid rgba(13, 104, 102, 0.08)",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#6E7F7C",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Codex Category
              </span>
              <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#0D6866", fontWeight: 600 }}>
                {filteredFaqs.length} / {FAQS.length} MATCHED
              </span>
            </div>

            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = getCategoryCount(cat);
              const label = cat === "ALL" ? "All Inquiries" : cat;

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
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: isSelected ? "#F1F6F4" : "transparent",
                    color: isSelected ? "#063C3D" : "#445451",
                    border: "none",
                    borderLeft: isSelected ? "3px solid #169B77" : "3px solid transparent",
                    fontSize: "13.5px",
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: isSelected ? "#0D6866" : "#6E7F7C",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(22, 155, 119, 0.15)" : "#F8F7F2",
                      border: isSelected ? "1px solid rgba(22, 155, 119, 0.25)" : "1px solid rgba(13, 104, 102, 0.08)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Regulatory Citation Callout */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#F1F6F4",
              border: "1px dashed rgba(13, 104, 102, 0.2)",
              fontSize: "12px",
              color: "#445451",
              lineHeight: 1.55,
            }}
          >
            <div style={{ fontWeight: 700, color: "#063C3D", marginBottom: "4px", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              ⚡ Statutory Transparency Notice
            </div>
            All answers conform to Documento’s published Technical Whitepaper v2.4 and ethical guidelines for AI-assisted legal operations.
          </div>
        </div>

        {/* RIGHT COLUMN: ~2/3 (Minimalist High-Density Accordion Folios) */}
        <div
          className="animate-on-scroll faq-col-right"
          data-motion="right"
          style={{
            gridColumn: "span 8",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {filteredFaqs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 32px",
                color: "#445451",
                fontSize: "14.5px",
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px dashed rgba(13, 104, 102, 0.22)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "#F1F6F4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                  color: "#0D6866",
                  fontSize: "20px",
                }}
              >
                🔍
              </div>
              <div style={{ fontWeight: 700, color: "#063C3D", fontSize: "16px", marginBottom: "8px" }}>
                No questions matched your search query
              </div>
              <p style={{ margin: "0 0 20px 0", fontSize: "13.5px", color: "#6E7F7C", maxWidth: "380px", marginInline: "auto" }}>
                No inquiry records in our regulatory codex match &quot;{searchQuery}&quot;. Try adjusting your keywords or reset active filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "1px solid #0D6866",
                  background: "#FFFFFF",
                  color: "#0D6866",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#0D6866";
                  e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.color = "#0D6866";
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredFaqs.map((item, idx) => {
              const isOpen = openId === item.id;
              const formattedIndex = `FAQ // ${(idx + 1).toString().padStart(2, "0")}`;

              return (
                <div
                  key={item.id}
                  className="spotlight-card"
                  style={{
                    background: isOpen ? "#FFFFFF" : "#FFFFFF",
                    border: isOpen ? "1.5px solid rgba(13, 104, 102, 0.38)" : "1px solid rgba(13, 104, 102, 0.14)",
                    borderRadius: "14px",
                    overflow: "hidden",
                    boxShadow: isOpen
                      ? "0 16px 36px -12px rgba(13, 104, 102, 0.12), 0 2px 6px rgba(0, 0, 0, 0.02)"
                      : "0 2px 8px rgba(6, 60, 61, 0.02)",
                    transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
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
                      padding: "20px 24px",
                      background: isOpen ? "#F8FCFA" : "#FFFFFF",
                      border: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "20px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
                      {/* Meta Stamp Row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 750,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            color: "#0D6866",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "rgba(13, 104, 102, 0.08)",
                          }}
                        >
                          {item.category}
                        </span>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontFamily: "monospace",
                            letterSpacing: "0.06em",
                            color: "#6E7F7C",
                          }}
                        >
                          {formattedIndex}
                        </span>
                      </div>

                      {/* Question Text */}
                      <span
                        style={{
                          fontSize: "16.5px",
                          fontWeight: 700,
                          color: isOpen ? "#063C3D" : "#172322",
                          lineHeight: 1.4,
                          letterSpacing: "-0.015em",
                          transition: "color 0.15s ease",
                        }}
                      >
                        {item.question}
                      </span>
                    </div>

                    {/* Rotating Refined Toggle Control */}
                    <span
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        border: isOpen ? "1px solid #169B77" : "1px solid rgba(13, 104, 102, 0.18)",
                        background: isOpen ? "#169B77" : "#F1F6F4",
                        color: isOpen ? "#FFFFFF" : "#0D6866",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        lineHeight: 1,
                        flexShrink: 0,
                        marginTop: "2px",
                        fontWeight: 400,
                        transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                        transition: "all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
                        padding: "18px 24px 24px 24px",
                        borderTop: "1px solid rgba(13, 104, 102, 0.08)",
                        background: "#FFFFFF",
                        animation: "faqAnswerReveal 240ms cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      <div
                        style={{
                          borderLeft: "3px solid #169B77",
                          paddingLeft: "16px",
                          fontSize: "14.5px",
                          color: "#384846",
                          lineHeight: 1.7,
                          marginBottom: "16px",
                        }}
                      >
                        {item.answer}
                      </div>

                      {/* Provenance Footer */}
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "5px 10px",
                          borderRadius: "4px",
                          background: "#F8F7F2",
                          border: "1px solid rgba(13, 104, 102, 0.1)",
                          fontSize: "10.5px",
                          fontFamily: "monospace",
                          color: "#0D6866",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <span style={{ color: "#169B77" }}>●</span>
                        <span>{item.provenance}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* High-Authority Pre-Footer Conversion Bar */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "72px auto 0 auto" }}>
        <div
          className="animate-on-scroll hover-lift"
          data-motion="scale"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, #063C3D 0%, #084B4B 55%, #0D6866 100%)",
            borderRadius: "24px",
            padding: "52px 56px",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "36px",
            boxShadow: "0 28px 64px -16px rgba(6, 60, 61, 0.35)",
            border: "1px solid rgba(94, 234, 212, 0.28)",
          }}
        >
          {/* Subtle Geometric Background Watermark */}
          <div
            style={{
              position: "absolute",
              right: "-40px",
              bottom: "-40px",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(94, 234, 212, 0.12) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, maxWidth: "660px" }}>
            {/* Status Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5EEAD4",
                background: "rgba(94, 234, 212, 0.12)",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(94, 234, 212, 0.28)",
                marginBottom: "16px",
              }}
            >
              <span>Production-Ready Casework Architecture</span>
            </div>

            {/* Main Headline - UNIFIED TEXT NODE */}
            <h3
              style={{
                fontSize: "clamp(24px, 2.8vw, 34px)",
                fontWeight: 700,
                color: "#FFFFFF",
                margin: "0 0 12px 0",
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                fontFamily: "var(--font-display, Inter, sans-serif)",
              }}
            >
              Ready to bring clarity and structure to your immigration casework?
            </h3>

            {/* Body */}
            <p style={{ fontSize: "15px", color: "#E2F2ED", margin: 0, lineHeight: 1.65, maxWidth: "580px" }}>
              Join immigration law firms and applicants using Documento to eliminate administrative chaos and assemble verified filings.
            </p>

            {/* Trust Micro-Bullets */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                marginTop: "20px",
                fontSize: "12px",
                color: "rgba(226, 242, 237, 0.8)",
                flexWrap: "wrap",
              }}
            >
              <span>🔒 Zero AI Training on Client Data</span>
              <span>•</span>
              <span>⚖️ Rule 1.6 &amp; 5.3 Safeguards</span>
              <span>•</span>
              <span>🛡️ AES-256 Vault Encryption</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
            <button
              type="button"
              onClick={() => onOpenLogin?.("firm")}
              style={{
                padding: "15px 28px",
                borderRadius: "12px",
                border: "none",
                background: "#5EEAD4",
                color: "#063C3D",
                fontSize: "14.5px",
                fontWeight: 750,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
                textAlign: "center",
              }}
            >
              Get Started as a Firm
            </button>

            <a
              href="#coverage"
              style={{
                padding: "13px 24px",
                borderRadius: "12px",
                border: "1px solid rgba(226, 242, 237, 0.3)",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 650,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
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
                transform: translateY(-4px);
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
