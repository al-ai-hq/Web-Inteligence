import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditContext } from "@wpi/audit-pipeline";
import {
  mapCreateAuditError,
  submitAudit,
} from "./create-audit-client";

const CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

const PAYLOAD = {
  url: "https://example.com",
  locale: "en" as const,
  context: CONTEXT,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitAudit", () => {
  it("posts to /api/audits and returns the success payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { id: "a1", secret: "s1", status_url: "/en/audit/a1", redirect_url: null },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({
      ok: true,
      data: { id: "a1", secret: "s1", status_url: "/en/audit/a1", redirect_url: null },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audits",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("includes redirect_url when present in the 201 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { id: "a2", secret: "s2", status_url: "/en/audit/a2", redirect_url: "/en/dashboard" },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({
      ok: true,
      data: { id: "a2", secret: "s2", status_url: "/en/audit/a2", redirect_url: "/en/dashboard" },
    });
  });

  it("rejects a 201 body with non-string non-null redirect_url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { id: "a3", secret: "s3", status_url: "/en/audit/a3", redirect_url: 42 },
          201,
        ),
      ),
    );

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("maps a 400 url_invalid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "url_invalid" }, 400)),
    );

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "url_invalid" });
  });

  it("maps a 429 response to rate_limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("maps network failure to generic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("maps a malformed 201 body to generic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ nope: true }, 201)),
    );

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("returns a generic error when a 201 response body is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(null, 201)),
    );

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("includes turnstileToken in the request body when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { id: "a1", secret: "s1", status_url: "/en/audit/a1", redirect_url: null },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitAudit({ ...PAYLOAD, turnstileToken: "test-token" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audits",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"turnstileToken\":\"test-token\""),
      }),
    );
  });

  it("maps a turnstile_required response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "turnstile_required" }, 429)),
    );

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "turnstile_required" });
  });
});

describe("mapCreateAuditError", () => {
  it("prefers the body error key", () => {
    expect(mapCreateAuditError(500, { error: "url_invalid" })).toBe("url_invalid");
  });

  it("maps 429 to rate_limited", () => {
    expect(mapCreateAuditError(429, {})).toBe("rate_limited");
  });

  it("maps turnstile_required body error", () => {
    expect(mapCreateAuditError(429, { error: "turnstile_required" })).toBe("turnstile_required");
  });

  it("maps everything else to generic", () => {
    expect(mapCreateAuditError(500, {})).toBe("generic");
  });
});
