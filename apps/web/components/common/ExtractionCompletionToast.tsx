"use client";

import React, { useEffect, useState } from "react";
import {
  ExtractionNotificationToastPayload,
  getExtractionAlertPrefs,
  playMinimalCompletionChime,
  requestDesktopNotificationPermission,
  setExtractionAlertPrefs,
} from "../../lib/notifications";

export interface ExtractionCompletionToastProps {
  toast: ExtractionNotificationToastPayload | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function ExtractionCompletionToast({
  toast,
  onDismiss,
  autoDismissMs = 10000,
}: ExtractionCompletionToastProps) {
  const [hovered, setHovered] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!toast) return;
    setSoundEnabled(getExtractionAlertPrefs().soundEnabled);
    setPermission(toast.permission);
  }, [toast]);

  useEffect(() => {
    if (!toast || hovered || autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [toast, hovered, autoDismissMs, onDismiss]);

  if (!toast) return null;

  const handleEnableDesktop = async () => {
    setExtractionAlertPrefs({ desktopEnabled: true });
    const nextPerm = await requestDesktopNotificationPermission();
    setPermission(nextPerm);
    if (nextPerm === "granted") {
      try {
        new window.Notification("Documento Desktop Alerts Enabled", {
          body: "You will now receive Windows / macOS notifications when AI extraction finishes.",
          icon: "/documento-logo.png",
          silent: true,
        });
      } catch {
        // Ignore if browser restricts immediate follow-up
      }
      if (getExtractionAlertPrefs().soundEnabled) {
        playMinimalCompletionChime();
      }
    }
  };

  const handleToggleSound = () => {
    const next = setExtractionAlertPrefs({ soundEnabled: !soundEnabled });
    setSoundEnabled(next.soundEnabled);
    if (next.soundEnabled) {
      playMinimalCompletionChime();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="extraction-completion-toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: 1200,
        width: "min(410px, calc(100vw - 32px))",
        background: "#FFFFFF",
        border: toast.offlineFallback ? "1px solid #F2D7A5" : "1px solid #B9DED4",
        borderLeft: toast.offlineFallback ? "4px solid #A8620A" : "4px solid #176B50",
        borderRadius: "12px",
        boxShadow: "0 14px 36px rgba(6, 60, 61, 0.16)",
        padding: "14px 16px",
        color: "#172322",
        fontFamily:
          "var(--font-sans, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          aria-hidden="true"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: toast.offlineFallback ? "#FEF7EA" : "#EAF6F0",
            border: toast.offlineFallback ? "1px solid #F2D7A5" : "1px solid #B9DED4",
            color: toast.offlineFallback ? "#A8620A" : "#176B50",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 800,
            flexShrink: 0,
            marginTop: "1px",
          }}
        >
          ✓
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "13.5px",
                fontWeight: 750,
                color: "#063C3D",
                lineHeight: 1.3,
              }}
            >
              {toast.title}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss extraction completion notification"
              style={{
                background: "transparent",
                border: "none",
                color: "#6E7F7C",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                padding: "2px 4px",
                borderRadius: "4px",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              fontSize: "12.5px",
              color: "#445451",
              marginTop: "4px",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {toast.body}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "10px",
              paddingTop: "8px",
              borderTop: "1px solid #EEF3F1",
              fontSize: "11px",
              color: "#6E7F7C",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span>Completed at {toast.timestamp}</span>
              {toast.desktopDispatched && (
                <span
                  style={{
                    color: "#176B50",
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    borderRadius: "999px",
                    padding: "1px 7px",
                    fontWeight: 600,
                  }}
                >
                  OS Alert Sent
                </span>
              )}
              {!toast.desktopDispatched && permission === "default" && (
                <button
                  type="button"
                  onClick={handleEnableDesktop}
                  style={{
                    background: "#F1F6F4",
                    border: "1px solid #B9DED4",
                    color: "#0D6866",
                    borderRadius: "999px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  🔔 Enable Desktop Popups
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              title={soundEnabled ? "Mute completion chime" : "Unmute completion chime"}
              style={{
                background: "transparent",
                border: "1px solid #DCE5E1",
                borderRadius: "6px",
                padding: "2px 7px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#445451",
                cursor: "pointer",
              }}
            >
              {soundEnabled ? "🔊 Chime ON" : "🔇 Muted"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
