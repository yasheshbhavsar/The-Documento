"use client";

import React, { useEffect, useState } from "react";
import {
  BackgroundIntakeJob,
  dismissBackgroundIntakeJob,
  getBackgroundIntakeJobs,
  subscribeBackgroundIntakeJobs,
} from "../../lib/backgroundIntakeStore";
import { confirmAndApplyPendingAutoFill } from "../../lib/documentAutoFillEngine";

export function BackgroundProcessingTray(): React.JSX.Element | null {
  const [jobs, setJobs] = useState<BackgroundIntakeJob[]>(() => getBackgroundIntakeJobs());
  const [appliedJobIds, setAppliedJobIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setJobs(getBackgroundIntakeJobs());
    return subscribeBackgroundIntakeJobs((nextJobs) => {
      setJobs(nextJobs);
    });
  }, []);

  if (jobs.length === 0) {
    return null;
  }

  const handleApplyPrefill = (job: BackgroundIntakeJob) => {
    const key = job.caseId || "default_client";
    confirmAndApplyPendingAutoFill(key);
    setAppliedJobIds((prev) => ({ ...prev, [job.id]: true }));
  };

  return (
    <aside
      aria-label="Background document processing tray"
      data-testid="background-processing-tray"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9990,
        width: "min(410px, calc(100vw - 32px))",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {jobs.map((job) => {
        const pct =
          job.status === "completed"
            ? 100
            : Math.min(96, Math.max(8, Math.round((job.currentPage / Math.max(1, job.totalPages)) * 100)));
        const isDone = job.status === "completed";
        const isErr = job.status === "error";
        const prefillApplied = Boolean(appliedJobIds[job.id]);

        return (
          <div
            key={job.id}
            data-testid={`bg-intake-job-${job.id}`}
            style={{
              backgroundColor: "#FFFFFF",
              border: isErr ? "1px solid #DC2626" : "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "13px 15px",
              boxShadow: "0 8px 24px rgba(6, 60, 61, 0.08)",
              color: "#063C3D",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 7px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.01em",
                      backgroundColor: isErr ? "#FEF2F2" : isDone ? "#EAF6F0" : "#F8F7F2",
                      color: isErr ? "#B91C1C" : isDone ? "#176B50" : "#07594F",
                      border: isErr
                        ? "1px solid #FECACA"
                        : isDone
                          ? "1px solid #C6E7D8"
                          : "1px solid #DCE5E1",
                    }}
                  >
                    {isErr ? "Intake Alert" : isDone ? "✓ Intake Complete" : "Background Intake"}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#526663",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {isDone
                      ? `${job.totalPages} ${job.totalPages === 1 ? "page" : "pages"}`
                      : `Page ${job.currentPage} of ${job.totalPages}`}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: "#063C3D",
                    wordBreak: "break-word",
                  }}
                >
                  {isDone && job.completionSummary ? job.completionSummary : job.progressText}
                </div>
              </div>

              <button
                type="button"
                aria-label="Dismiss background task"
                data-testid={`dismiss-bg-job-${job.id}`}
                onClick={() => dismissBackgroundIntakeJob(job.id)}
                style={{
                  background: "transparent",
                  border: "1px solid #DCE5E1",
                  borderRadius: "6px",
                  width: "24px",
                  height: "24px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#526663",
                  fontSize: "13px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Flat progress track */}
            <div
              style={{
                marginTop: "9px",
                height: "4px",
                width: "100%",
                backgroundColor: "#EEF2F0",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: isErr ? "#DC2626" : isDone ? "#176B50" : "#07594F",
                  transition: "width 180ms ease-out",
                }}
              />
            </div>

            {isDone && (job.pendingPrefillCount ?? 0) > 0 && (
              <div
                style={{
                  marginTop: "9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                {prefillApplied ? (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#176B50",
                      backgroundColor: "#EAF6F0",
                      padding: "4px 9px",
                      borderRadius: "6px",
                    }}
                  >
                    ✓ Applied to Profile & Forms
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyPrefill(job)}
                    style={{
                      backgroundColor: "#063C3D",
                      color: "#FFFFFF",
                      border: "1px solid #063C3D",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✨ Apply {job.pendingPrefillCount} Extracted Fields
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
