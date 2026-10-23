import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api, setAccessToken, getAccessToken, NetworkError, fallbackResponse } from "../lib/api";

describe("Priority 1 Launch Blocker Auditing & Production Auth/Fallback", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    setAccessToken(null);
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("stores and retrieves access tokens via setAccessToken and getAccessToken", () => {
    expect(getAccessToken()).toBeNull();
    const testJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-payload.signature";
    setAccessToken(testJwt);
    expect(getAccessToken()).toBe(testJwt);

    // Verify persistence in localStorage
    expect(localStorage.getItem("documento_access_token")).toBe(testJwt);

    // Verify token removal
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem("documento_access_token")).toBeNull();
  });

  it("attaches Authorization: Bearer <token> header to API requests when token is present", async () => {
    const testJwt = "sample.jwt.token.for.test";
    setAccessToken(testJwt);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "case-999", title: "Live Test Case" }],
    } as Response);

    const res = await api.getCases("master_admin");
    expect(fetchSpy).toHaveBeenCalled();
    const calledHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;

    expect(calledHeaders["Authorization"]).toBe(`Bearer ${testJwt}`);
    expect(calledHeaders["X-Organization-Id"]).toBeDefined();
    expect(res.isLiveBackend).toBe(true);
  });

  it("omits Authorization header when no access token is configured", async () => {
    setAccessToken(null);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await api.getCases("master_admin");
    expect(fetchSpy).toHaveBeenCalled();
    const calledHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;

    expect(calledHeaders["Authorization"]).toBeUndefined();
    expect(calledHeaders["X-Organization-Id"]).toBeDefined();
  });

  it("strictly disables silent mock fallback and throws NetworkError in production mode", async () => {
    (process.env as any).NODE_ENV = "production";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Database connection refused"));

    await expect(api.getCases("master_admin")).rejects.toThrow(NetworkError);
    await expect(api.getCases("master_admin")).rejects.toThrow(/Documento Production API unavailable/);
  });

  it("fallbackResponse helper returns data in dev/test mode but throws in production mode", () => {
    // 1. Test mode
    (process.env as any).NODE_ENV = "test";
    const testData = { key: "val" };
    const devRes = fallbackResponse(testData, "test-service");
    expect(devRes.isLiveBackend).toBe(false);
    expect(devRes.data).toEqual(testData);

    // 2. Production mode
    (process.env as any).NODE_ENV = "production";
    expect(() => fallbackResponse(testData, "test-service")).toThrowError(NetworkError);
    expect(() => fallbackResponse(testData, "test-service")).toThrowError(/Silent in-memory mock fallback is strictly disabled in production/);
  });
});
