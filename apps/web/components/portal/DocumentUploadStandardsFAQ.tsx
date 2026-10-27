import React, { useState } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

export interface DocumentUploadStandardsFAQProps {
  onClose?: () => void;
  onOpenUploadModal?: () => void;
  isModal?: boolean;
}

export function DocumentUploadStandardsFAQ({
  onClose,
  onOpenUploadModal,
  isModal = false,
}: DocumentUploadStandardsFAQProps) {
  const [activeRule, setActiveRule] = useState<number>(1);
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    resolution: true,
    corners: true,
    lighting: true,
    orientation: true,
    pdfFormat: true,
  });

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);

  const rules = [
    {
      id: 1,
      badge: "Rule 1",
      title: "Minimum 300 DPI Optical Clarity",
      summary: "Crisp, readable text without pixelation or camera blur.",
      details:
        "Documento's AI OCR engine inspects character micro-details to distinguish lookalike letters (such as '0' vs 'O', '8' vs 'B', and '1' vs 'I'). When documents are photographed at low resolution or compressed heavily by messaging apps, optical character confidence drops. Always select high-resolution scanning or 300+ DPI PDF export.",
      goodExample: "Sharp scanned PDF with distinct numbers and unblurred signatures.",
      badExample: "Low-res screenshot or thumbnail image with pixelated text.",
      icon: "🔍",
    },
    {
      id: 2,
      badge: "Rule 2",
      title: "Zero Flash Glare & Uniform Diffused Light",
      summary: "No whiteout reflection spots on glossy lamination.",
      details:
        "Passports, Permanent Resident (PR) cards, driver's licenses, and laminated diplomas have reflective glossy coatings. Direct smartphone camera flashes create severe whiteout glare that blinds the OCR camera over vital numbers. Turn off flash completely. Use indirect, diffused overhead daylight or room lighting.",
      goodExample: "Soft, uniform daylight positioned from the side with zero hot spots.",
      badExample: "Harsh camera flash right in the center creating an unreadable white glare spot.",
      icon: "💡",
    },
    {
      id: 3,
      badge: "Rule 3",
      title: "Full Borders & All 4 Corners Visible",
      summary: "Place flat on a dark contrasting surface; do not crop edges.",
      details:
        "Government adjudicators and our automated edge-detection pipeline verify document authenticity by inspecting full paper margins, page corner geometries, and seal stamps. Lay your document completely flat on a dark wooden table or solid desk. Keep all four corners and edges inside the frame with 1-2 cm of border background.",
      goodExample: "Entire document centered on dark background with all 4 corners clearly visible.",
      badExample: "Document cropped tightly at the bottom, cutting off the passport MRZ code lines.",
      icon: "📐",
    },
    {
      id: 4,
      badge: "Rule 4",
      title: "Zero Finger Occlusion & Clean Flat Pages",
      summary: "Keep fingers, thumbs, and shadows off the paper surface.",
      details:
        "Holding a document with your fingers often obscures stamps, dates, or margin notations. If the paper curls, gently hold the outermost corner outside the text area or use small paperweights away from text. Ensure your phone or hand does not cast a dark shadow across the page.",
      goodExample: "Document resting flat on a table with zero hands or fingers in the image.",
      badExample: "Thumb holding down the passport page, obscuring the issue date and passport number.",
      icon: "✋",
    },
    {
      id: 5,
      badge: "Rule 5",
      title: "Square 90° Overhead Orientation",
      summary: "Photograph straight from above; no oblique perspective angles.",
      details:
        "Skewed or angled scans (e.g., shot from a 45-degree angle while sitting down) distort perspective geometry and cause line warping. Hold your phone or scanner squarely parallel to the page (a strict 90° birds-eye overhead angle). Verify text is oriented right-side up.",
      goodExample: "Camera positioned squarely overhead; rectangular document with parallel edges.",
      badExample: "Slanted photo taken from the side with trapezoidal perspective distortion.",
      icon: "📐",
    },
    {
      id: 6,
      badge: "Rule 6",
      title: "Multi-Page Documents as a Single Continuous PDF",
      summary: "Combine multi-page records into one chronological PDF.",
      details:
        "For multi-page records—such as 12-page intake sheets, bank statements, academic transcripts, or tenancy leases—do not upload individual separate image files. Merge all sequential pages into one orderly, uncompressed PDF file. This preserves page numbering and allows AI evidence indexing across pages.",
      goodExample: "1 single 12-page PDF containing all sections in consecutive order.",
      badExample: "12 individual JPEG files uploaded out of order with different orientations.",
      icon: "📑",
    },
    {
      id: 7,
      badge: "Rule 7",
      title: "Full-Color Scans of Original Documents",
      summary: "Color scans preserve official ink stamps, notary seals, and security threads.",
      details:
        "Government immigration authorities frequently reject black-and-white photocopies because ink authenticity, colored seal stamps, and security fibers cannot be verified. Scan your original physical document in full color to guarantee rapid acceptance by your supervising case manager and IRCC/USCIS officers.",
      goodExample: "Full-color scan showing blue ink signatures and red government stamp seals.",
      badExample: "Low-contrast black-and-white photocopy with grainy, faded text.",
      icon: "🎨",
    },
  ];

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner */}
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
          boxShadow: "0 4px 14px rgba(6, 60, 61, 0.15)",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Documento AI Extraction Standards
            </span>
            <Badge variant="verified" style={{ background: "#22C55E", color: "#FFFFFF", border: "none" }}>
              High-Precision OCR
            </Badge>
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.01em" }}>
            Standards for Uploading Documents for Optimal OCR
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#DCE5E1", lineHeight: 1.5, maxWidth: "680px" }}>
            Documento uses advanced computer vision and neural OCR to automatically extract and verify your passport numbers, marriage records, and dates. Following these standards ensures <strong>99.8% first-pass accuracy</strong> and prevents government rejection or delays.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close standards guide"
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
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)")}
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick Visual Comparison: DO vs DON'T */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {/* DO Card */}
        <div
          style={{
            background: "#F0FDF4",
            border: "1.5px solid #86EFAC",
            borderRadius: "12px",
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(22, 101, 52, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "#166534",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              ✓
            </span>
            <strong style={{ fontSize: "15px", color: "#166534", fontWeight: 750 }}>
              DO: Ideal Upload Quality (Instant OCR Extraction)
            </strong>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "13px",
              color: "#166534",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              lineHeight: 1.4,
            }}
          >
            <li>Flat document placed on a dark, non-reflective desk or surface.</li>
            <li>All four corners and outer page margins completely visible.</li>
            <li>Soft, natural room lighting without flash reflection or hot spots.</li>
            <li>Camera held directly parallel (90° overhead angle) to avoid slant.</li>
            <li>Multi-page records assembled sequentially in a single clean PDF.</li>
            <li>Original color scans with clearly legible signatures and red/blue ink seals.</li>
          </ul>
        </div>

        {/* DON'T Card */}
        <div
          style={{
            background: "#FEF2F2",
            border: "1.5px solid #FCA5A5",
            borderRadius: "12px",
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(220, 38, 38, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "#DC2626",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              ✕
            </span>
            <strong style={{ fontSize: "15px", color: "#991B1B", fontWeight: 750 }}>
              DON'T: Common Pitfalls That Fail OCR Processing
            </strong>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "13px",
              color: "#991B1B",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              lineHeight: 1.4,
            }}
          >
            <li>Camera flash turned ON, creating a blinding white reflection on laminate.</li>
            <li>Document held in hand with thumbs covering text, seals, or passport MRZ lines.</li>
            <li>Angled photos taken at 45° resulting in trapezoidal distortion.</li>
            <li>Corners cropped out or edges missing from the frame.</li>
            <li>Faded, low-contrast black-and-white photocopies.</li>
            <li>Dozens of scattered individual image screenshots for multi-page statements.</li>
          </ul>
        </div>
      </div>

      {/* Interactive Rules Explorer */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE5E1",
          borderRadius: "14px",
          padding: "22px",
          boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
            The 7 Core Standards for Legal &amp; Immigration OCR
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#6E7F7C" }}>
            Select each standard to review specific instructions and technical criteria.
          </p>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            marginBottom: "16px",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          {rules.map((r) => {
            const isSelected = activeRule === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRule(r.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: isSelected ? "1.5px solid #0D6866" : "1px solid #E2E8F0",
                  background: isSelected ? "#EAF6F0" : "#F8FAF9",
                  color: isSelected ? "#0D6866" : "#475569",
                  fontSize: "12px",
                  fontWeight: isSelected ? 750 : 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{r.icon}</span>
                <span>{r.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Rule Detail Card */}
        {(() => {
          const rule = rules.find((r) => r.id === activeRule) || rules[0];
          return (
            <div
              style={{
                background: "#F8FAF9",
                border: "1px solid #B9DED4",
                borderRadius: "10px",
                padding: "20px 22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px" }}>{rule.icon}</span>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>
                    {rule.badge} • Technical Standard
                  </div>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
                    {rule.title}
                  </h4>
                </div>
              </div>

              <p style={{ margin: "10px 0 16px 0", fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>
                {rule.details}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #86EFAC",
                    borderRadius: "8px",
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 750, color: "#166534", display: "block", marginBottom: "2px" }}>
                    ✓ Recommended Implementation
                  </span>
                  <span style={{ fontSize: "12px", color: "#1E293B" }}>{rule.goodExample}</span>
                </div>
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #FCA5A5",
                    borderRadius: "8px",
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 750, color: "#991B1B", display: "block", marginBottom: "2px" }}>
                    ✕ What to Avoid
                  </span>
                  <span style={{ fontSize: "12px", color: "#1E293B" }}>{rule.badExample}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Interactive Pre-Upload Self-Checklist */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #B9DED4",
          borderRadius: "14px",
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "14px",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 750, color: "#063C3D" }}>
              Interactive Pre-Flight OCR Checklist
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
              Verify these 5 checks before clicking upload to guarantee instant verification.
            </p>
          </div>
          <Badge variant={allChecked ? "verified" : "review"}>
            {allChecked ? "100% OCR Ready ✓" : "Verification in Progress"}
          </Badge>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            {
              key: "resolution",
              label: "Clarity & Resolution: Text is sharp, dark, and perfectly readable upon zooming in.",
            },
            {
              key: "corners",
              label: "Complete Framing: All 4 outer corners and margins are visible without cropping.",
            },
            {
              key: "lighting",
              label: "Zero Reflection: No white camera flash reflection or glare on laminated surfaces.",
            },
            {
              key: "orientation",
              label: "Overhead Perspective: Shot straight from above (90°) and oriented right-side up.",
            },
            {
              key: "pdfFormat",
              label: "File Completeness: Multi-page document combined into a single continuous PDF.",
            },
          ].map((item) => (
            <label
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "#1E293B",
                cursor: "pointer",
                padding: "8px 12px",
                borderRadius: "8px",
                background: checklist[item.key] ? "#F0FDF4" : "#F8FAF9",
                border: checklist[item.key] ? "1px solid #BBF7D0" : "1px solid #E2E8F0",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="checkbox"
                checked={checklist[item.key]}
                onChange={() => toggleCheck(item.key)}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#0D6866" }}
              />
              <span style={{ fontWeight: checklist[item.key] ? 650 : 500 }}>{item.label}</span>
            </label>
          ))}
        </div>

        {onOpenUploadModal && (
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              size="md"
              onClick={onOpenUploadModal}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                fontWeight: 650,
                borderRadius: "8px",
                padding: "10px 20px",
              }}
            >
              + Proceed to Upload Document
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Standards for Uploading Documents FAQ"
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
            maxWidth: "880px",
            width: "100%",
            maxHeight: "90vh",
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
