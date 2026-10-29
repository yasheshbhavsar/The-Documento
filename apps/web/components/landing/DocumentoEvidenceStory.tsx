"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DocumentoEvidenceStory.module.css";

function FileGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 3.75h7l4 4v12.5h-11z" />
      <path d="M13.5 3.75v4.5H18M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="m12 2.75 1.9 6.1 6.1 1.9-6.1 1.9-1.9 6.1-1.9-6.1-6.1-1.9 6.1-1.9z" />
      <path d="m19 15 .9 2.1 2.1.9-2.1.9L19 22l-.9-3.1-2.1-.9 2.1-.9z" />
    </svg>
  );
}

const sourceDocuments = [
  { id: "passport", title: "Passport scan", detail: "Identity details", tone: "mint" },
  { id: "employer", title: "Employer letter", detail: "Employment dates", tone: "blue" },
  { id: "cv", title: "Curriculum vitae", detail: "Work history", tone: "sand" },
  { id: "finance", title: "Bank statement", detail: "Financial evidence", tone: "mint" },
];

export function DocumentoEvidenceStory() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="evidence-story"
      className={styles.section}
      aria-labelledby="evidence-story-title"
    >
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            From scattered files to structured evidence
          </span>
          <h2 id="evidence-story-title">Less searching. Clearer next steps.</h2>
          <p>
            Documento organizes documents, compares key details, and surfaces
            potential issues for professional review.
          </p>
        </header>

        <div
          className={`${styles.storyCanvas} ${isVisible ? styles.isVisible : ""}`}
        >
          <div className={styles.canvasTopbar}>
            <div className={styles.canvasIdentity}>
              <span className={styles.brandMark} aria-hidden="true">D</span>
              <span>Documento <span className={styles.identityDivider}>/</span> Evidence workflow</span>
            </div>
            <span className={styles.syntheticLabel}>Illustrative workflow · Synthetic data</span>
          </div>

          <div className={styles.flowArea}>
            <svg
              className={styles.connections}
              viewBox="0 0 1000 360"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="doc-flow-gradient" x1="0" x2="1">
                  <stop offset="0%" stopColor="#6FC5B3" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#2A9288" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#B9DED4" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              <path className={styles.flowLine} d="M 280 128 C 342 128, 362 162, 432 180" />
              <path className={styles.flowLineSecondary} d="M 280 226 C 342 226, 374 201, 432 180" />
              <path className={styles.flowLine} d="M 568 180 C 634 152, 656 128, 720 128" />
              <path className={styles.flowLineSecondary} d="M 568 180 C 634 205, 658 226, 720 226" />
              <circle className={styles.flowDot} r="4">
                <animateMotion dur="3.8s" repeatCount="indefinite" path="M 280 128 C 342 128, 362 162, 432 180" />
              </circle>
              <circle className={`${styles.flowDot} ${styles.flowDotDelayed}`} r="4">
                <animateMotion dur="4.4s" begin="-2s" repeatCount="indefinite" path="M 568 180 C 634 152, 656 128, 720 128" />
              </circle>
            </svg>

            <div className={styles.stageGrid}>
              <section className={styles.stage} aria-label="Collect client documents">
                <div className={styles.stageHeading}>
                  <span className={styles.stageNumber}>01</span>
                  <div>
                    <h3>Collect</h3>
                    <p>Different files, one place</p>
                  </div>
                </div>
                <div className={styles.sourceGrid}>
                  {sourceDocuments.map((doc, index) => (
                    <article
                      key={doc.id}
                      className={`${styles.sourceDocument} ${styles[`sourceTone_${doc.tone}`]} ${styles[`sourceDoc_${index + 1}`]} `}
                    >
                      <span className={styles.fileIcon}><FileGlyph /></span>
                      <span className={styles.sourceText}>
                        <strong>{doc.title}</strong>
                        <span>{doc.detail}</span>
                      </span>
                    </article>
                  ))}
                </div>
                <div className={styles.stageFootnote}>
                  <span className={styles.statusDot} />
                  Client uploads received
                </div>
              </section>

              <section className={styles.engineStage} aria-label="Documento document intelligence">
                <div className={styles.engineOrbit} aria-hidden="true">
                  <span className={styles.orbitNode} />
                  <span className={styles.orbitNode} />
                  <span className={styles.orbitNode} />
                </div>
                <div className={styles.engineCore}>
                  <div className={styles.engineIcon}><SparkGlyph /></div>
                  <span className={styles.engineName}>Documento</span>
                  <span className={styles.engineCaption}>Evidence intelligence</span>
                </div>
                <div className={styles.engineSteps} aria-label="Processing steps">
                  <span>Read</span>
                  <i />
                  <span>Classify</span>
                  <i />
                  <span>Compare</span>
                </div>
              </section>

              <section className={styles.stage} aria-label="Organized evidence and review">
                <div className={styles.stageHeading}>
                  <span className={`${styles.stageNumber} ${styles.stageNumberFinal}`}>02</span>
                  <div>
                    <h3>Clarify</h3>
                    <p>Evidence with context</p>
                  </div>
                </div>
                <div className={styles.caseEvidence}>
                  <div className={styles.evidenceHeader}>
                    <div>
                      <span className={styles.microLabel}>ILLUSTRATIVE CASE</span>
                      <strong>Case evidence</strong>
                    </div>
                    <span className={styles.evidenceCount}>4 files</span>
                  </div>
                  <div className={styles.evidenceRow}>
                    <span className={styles.evidenceGlyph}><FileGlyph /></span>
                    <span className={styles.evidenceCopy}><strong>Identity</strong><span>Passport details</span></span>
                    <span className={styles.verifiedState}><span />Matched</span>
                  </div>
                  <div className={styles.evidenceRow}>
                    <span className={styles.evidenceGlyph}><FileGlyph /></span>
                    <span className={styles.evidenceCopy}><strong>Employment</strong><span>Letter + CV</span></span>
                    <span className={styles.reviewState}>Review</span>
                  </div>
                  <div className={styles.evidenceRow}>
                    <span className={styles.evidenceGlyph}><FileGlyph /></span>
                    <span className={styles.evidenceCopy}><strong>Financial</strong><span>Bank statement</span></span>
                    <span className={styles.verifiedState}><span />Sorted</span>
                  </div>
                  <div className={styles.discrepancy}>
                    <span className={styles.warningMark}>!</span>
                    <div>
                      <strong>Possible date mismatch</strong>
                      <p>Employer letter: Sep 2021 · CV: Oct 2021</p>
                    </div>
                  </div>
                  <div className={styles.humanReviewNote}>
                    <span className={styles.reviewRing} />
                    Requires professional review
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className={styles.canvasFooter}>
            <span><i className={styles.footerCheck} /> Organized evidence</span>
            <span className={styles.footerDivider} />
            <span><i className={styles.footerCheck} /> Source-linked findings</span>
            <span className={styles.footerDivider} />
            <span><i className={styles.footerCheck} /> Human-reviewed decisions</span>
          </div>
        </div>
        <p className={styles.disclaimer}>
          Illustrative demonstration only. AI highlights potential inconsistencies; it does not make final legal determinations.
        </p>
      </div>
    </section>
  );
}
