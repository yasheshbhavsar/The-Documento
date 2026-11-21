import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  __resetNotificationAudioContextForTests,
  buildExtractionNotificationCopy,
  getExtractionAlertPrefs,
  notifyExtractionComplete,
  playMinimalCompletionChime,
  primeExtractionNotifications,
  setExtractionAlertPrefs,
} from "../lib/notifications";

describe("Cross-platform Extraction Completion Notifications & Minimal Chime", () => {
  const originalNotification = globalThis.Notification;
  const originalAudioContext = (window as any).AudioContext;

  beforeEach(() => {
    window.localStorage.clear();
    __resetNotificationAudioContextForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).Notification = originalNotification;
    (window as any).AudioContext = originalAudioContext;
  });

  it("builds concise summary copy for single docs, multi-person packets, and Paralegal Studio", () => {
    const packetCopy = buildExtractionNotificationCopy({
      filename: "pdf24_merged.pdf",
      pagesCount: 28,
      personsCount: 2,
      fieldsCount: 19,
    });
    expect(packetCopy.title).toContain("AI Extraction Complete");
    expect(packetCopy.body).toBe("pdf24_merged.pdf • 28 pages • 2 person folders • 19 fields extracted.");

    const studioCopy = buildExtractionNotificationCopy({
      filename: "Client_Packet.pdf",
      documentsCount: 4,
      fieldsCount: 12,
      source: "paralegal_studio",
    });
    expect(studioCopy.title).toContain("Paralegal AI Lab Complete");
    expect(studioCopy.body).toBe("Client_Packet.pdf • 4 documents sorted • 12 fields extracted.");
  });

  it("primes AudioContext and requests OS Notification permission inside user gesture", () => {
    const resumeSpy = vi.fn().mockResolvedValue(undefined);
    const requestPermissionSpy = vi.fn().mockResolvedValue("granted");

    (window as any).AudioContext = vi.fn(function (this: any) {
      this.state = "suspended";
      this.resume = resumeSpy;
      this.currentTime = 0;
      this.destination = {};
    });

    const MockNotif: any = vi.fn();
    MockNotif.permission = "default";
    MockNotif.requestPermission = requestPermissionSpy;
    (globalThis as any).Notification = MockNotif;

    primeExtractionNotifications();

    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
  });

  it("plays minimal 2-tone Web Audio chime and dispatches native OS Notification when granted", () => {
    const oscStarts: number[] = [];
    const mockCtx = {
      state: "running",
      currentTime: 1.0,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn(() => ({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn((t: number) => oscStarts.push(t)),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      })),
    };
    (window as any).AudioContext = vi.fn(function () {
      return mockCtx;
    });

    const closeSpy = vi.fn();
    const createdNotifs: Array<{ title: string; options: any; instance: any }> = [];
    const MockNotif: any = vi.fn(function (this: any, title: string, options: any) {
      this.title = title;
      this.options = options;
      this.close = closeSpy;
      this.onclick = null;
      createdNotifs.push({ title, options, instance: this });
    });
    MockNotif.permission = "granted";
    (globalThis as any).Notification = MockNotif;

    const focusSpy = vi.spyOn(window, "focus").mockImplementation(() => {});

    const payload = notifyExtractionComplete({
      filename: "pdf24_merged.pdf",
      pagesCount: 14,
      personsCount: 2,
      fieldsCount: 24,
    });

    expect(payload.soundPlayed).toBe(true);
    expect(payload.desktopDispatched).toBe(true);
    expect(oscStarts.length).toBe(3); // G5 + C6 + subtle harmonic shimmer
    expect(createdNotifs.length).toBe(1);
    expect(createdNotifs[0].title).toContain("AI Extraction Complete");
    expect(createdNotifs[0].options.icon).toBe("/documento-logo.png");
    expect(createdNotifs[0].options.silent).toBe(true); // avoids OS double-chime

    // Clicking OS notification brings browser tab to foreground
    createdNotifs[0].instance.onclick();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("respects user mute and desktop-alert disable preferences cleanly", () => {
    setExtractionAlertPrefs({ soundEnabled: false, desktopEnabled: false });
    expect(getExtractionAlertPrefs()).toEqual({ soundEnabled: false, desktopEnabled: false });

    const MockNotif: any = vi.fn();
    MockNotif.permission = "granted";
    (globalThis as any).Notification = MockNotif;

    const payload = notifyExtractionComplete({
      filename: "passport.pdf",
      pagesCount: 1,
      fieldsCount: 6,
    });

    expect(payload.soundPlayed).toBe(false);
    expect(payload.desktopDispatched).toBe(false);
    expect(MockNotif).not.toHaveBeenCalled();
  });

  it("degrades safely with zero exceptions when Web Audio and Notification APIs are absent", () => {
    (window as any).AudioContext = undefined;
    (globalThis as any).Notification = undefined;

    expect(playMinimalCompletionChime()).toBe(false);
    const payload = notifyExtractionComplete({
      filename: "scan.webp",
      pagesCount: 1,
      fieldsCount: 3,
    });
    expect(payload.soundPlayed).toBe(false);
    expect(payload.desktopDispatched).toBe(false);
    expect(payload.permission).toBe("unsupported");
  });
});
