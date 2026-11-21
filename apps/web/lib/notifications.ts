/**
 * Cross-platform Windows / macOS Desktop Notification & Minimal Chime utility
 * for Documento AI OCR & Document Extraction completion events.
 *
 * - Uses native Web Notifications API (renders in Windows 10/11 Action Center / Toast
 *   and macOS Notification Center) with click-to-focus back to the Documento tab.
 * - Synthesizes a minimal, low-volume two-tone Web Audio chime (G5 -> C6) with zero
 *   external audio assets, primed during user click gestures to satisfy browser
 *   autoplay policies on Chrome, Edge, and Safari.
 */

export interface ExtractionAlertPreferences {
  desktopEnabled: boolean;
  soundEnabled: boolean;
}

export interface ExtractionCompleteDetails {
  filename: string;
  fieldsCount: number;
  pagesCount?: number;
  personsCount?: number;
  documentsCount?: number;
  categoryLabel?: string;
  offlineFallback?: boolean;
  source?: "standalone_lab" | "paralegal_studio";
}

export interface ExtractionNotificationToastPayload {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  desktopDispatched: boolean;
  soundPlayed: boolean;
  permission: NotificationPermission | "unsupported";
  offlineFallback: boolean;
  details: ExtractionCompleteDetails;
}

const PREFS_STORAGE_KEY = "documento_extraction_alerts_v1";
const DEFAULT_PREFS: ExtractionAlertPreferences = {
  desktopEnabled: true,
  soundEnabled: true,
};

let sharedAudioContext: AudioContext | null = null;

function getAudioContextConstructor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

function getOrCreateAudioContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new Ctor();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function getExtractionAlertPrefs(): ExtractionAlertPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ExtractionAlertPreferences>;
    return {
      desktopEnabled:
        typeof parsed.desktopEnabled === "boolean"
          ? parsed.desktopEnabled
          : DEFAULT_PREFS.desktopEnabled,
      soundEnabled:
        typeof parsed.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : DEFAULT_PREFS.soundEnabled,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setExtractionAlertPrefs(
  patch: Partial<ExtractionAlertPreferences>
): ExtractionAlertPreferences {
  const next: ExtractionAlertPreferences = {
    ...getExtractionAlertPrefs(),
    ...patch,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
  return next;
}

export function getDesktopNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  return window.Notification.permission;
}

export async function requestDesktopNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  if (window.Notification.permission !== "default") {
    return window.Notification.permission;
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission;
  }
}

/**
 * Must be called synchronously inside a user click gesture (e.g., clicking
 * "Run AI Recognition & Extraction" or "Run AI Lab") so that:
 * 1. AudioContext is unlocked for deferred completion chimes (even minutes later).
 * 2. Native Windows/macOS OS notification permission is requested cleanly.
 */
export function primeExtractionNotifications(): void {
  if (typeof window === "undefined") return;
  const prefs = getExtractionAlertPrefs();

  if (prefs.soundEnabled) {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === "suspended") {
      try {
        void ctx.resume().catch(() => {});
      } catch {
        // Ignore browser autoplay restrictions
      }
    }
  }

  if (
    prefs.desktopEnabled &&
    typeof window.Notification !== "undefined" &&
    window.Notification.permission === "default"
  ) {
    try {
      const maybePromise = window.Notification.requestPermission();
      if (maybePromise && typeof maybePromise.catch === "function") {
        void maybePromise.catch(() => {});
      }
    } catch {
      // Ignore environments that block permission requests
    }
  }
}

/**
 * Plays a minimal, calm two-note ascending glass chime (G5 -> C6) using Web Audio API.
 * Low volume, ~450ms total, non-intrusive for quiet office environments.
 */
export function playMinimalCompletionChime(): boolean {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes: Array<{
      freq: number;
      start: number;
      duration: number;
      peakGain: number;
      type: OscillatorType;
    }> = [
      // Gentle G5 foundation tone
      { freq: 783.99, start: 0, duration: 0.24, peakGain: 0.055, type: "sine" },
      // Warm ascending C6 resolution tone
      { freq: 1046.5, start: 0.095, duration: 0.36, peakGain: 0.065, type: "sine" },
      // Whisper-quiet upper octave shimmer for crisp clarity on laptop speakers
      { freq: 2093.0, start: 0.095, duration: 0.22, peakGain: 0.015, type: "triangle" },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.linearRampToValueAtTime(note.peakGain, now + note.start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    return true;
  } catch {
    return false;
  }
}

export function buildExtractionNotificationCopy(
  details: ExtractionCompleteDetails
): { title: string; body: string } {
  const title = details.offlineFallback
    ? "Documento Extraction Complete (Local Mode)"
    : details.source === "paralegal_studio"
      ? "Paralegal AI Lab Complete — Ready to Review"
      : "AI Extraction Complete — Ready to Review";

  const parts: string[] = [];
  if (details.filename) {
    parts.push(details.filename);
  }
  if (typeof details.pagesCount === "number" && details.pagesCount > 0) {
    parts.push(`${details.pagesCount} ${details.pagesCount === 1 ? "page" : "pages"}`);
  }
  if (typeof details.personsCount === "number" && details.personsCount > 1) {
    parts.push(`${details.personsCount} person folders`);
  } else if (typeof details.documentsCount === "number" && details.documentsCount > 1) {
    parts.push(`${details.documentsCount} documents sorted`);
  }
  if (details.fieldsCount > 0) {
    parts.push(
      `${details.fieldsCount} ${details.fieldsCount === 1 ? "field" : "fields"} extracted`
    );
  } else if (details.categoryLabel) {
    parts.push(details.categoryLabel);
  }

  const body =
    parts.length > 0
      ? `${parts.join(" • ")}.`
      : "Document recognition and structured extraction finished cleanly.";

  return { title, body };
}

/**
 * Triggers:
 * 1. Minimal gentle completion chime (if soundEnabled).
 * 2. Native Windows / macOS OS Desktop Notification (if desktopEnabled & permission === "granted").
 * 3. Returns a structured toast payload for rendering an in-app completion popup card.
 */
export function notifyExtractionComplete(
  details: ExtractionCompleteDetails
): ExtractionNotificationToastPayload {
  const prefs = getExtractionAlertPrefs();
  const permission = getDesktopNotificationPermission();
  const { title, body } = buildExtractionNotificationCopy(details);

  let soundPlayed = false;
  if (prefs.soundEnabled) {
    soundPlayed = playMinimalCompletionChime();
  }

  let desktopDispatched = false;
  if (
    prefs.desktopEnabled &&
    typeof window !== "undefined" &&
    typeof window.Notification !== "undefined" &&
    window.Notification.permission === "granted"
  ) {
    try {
      const notification = new window.Notification(title, {
        body,
        icon: "/documento-logo.png",
        badge: "/documento-logo.png",
        tag: "documento-ai-extraction-complete",
        // Keep OS sound silent when our Web Audio chime plays to avoid double-chime;
        // if Web Audio couldn't play (e.g., background tab restriction), let OS play default subtle ping.
        silent: soundPlayed,
        requireInteraction: false,
      });

      notification.onclick = () => {
        try {
          window.focus();
          notification.close();
        } catch {
          // Ignore focus errors
        }
      };

      // Tidy up Windows Action Center / macOS Notification Center banner after 12s
      window.setTimeout(() => {
        try {
          notification.close();
        } catch {
          // Ignore close errors
        }
      }, 12000);

      desktopDispatched = true;
    } catch {
      desktopDispatched = false;
    }
  }

  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return {
    id: `extract-done-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    body,
    timestamp,
    desktopDispatched,
    soundPlayed,
    permission,
    offlineFallback: Boolean(details.offlineFallback),
    details,
  };
}

/** Test-only helper to reset cached AudioContext between unit tests. */
export function __resetNotificationAudioContextForTests(): void {
  sharedAudioContext = null;
}
