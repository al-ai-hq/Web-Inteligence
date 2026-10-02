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
        { id: "a1", secret: "s1", status_url: "/en/audit/a1" },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({
      ok: true,
      data: { id: "a1", secret: "s1", status_url: "/en/audit/a1" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audits",
      expect.objectContaining({ method: "POST" }),
    );
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
});

describe("mapCreateAuditError", () => {
  it("prefers the body error key", () => {
    expect(mapCreateAuditError(500, { error: "url_invalid" })).toBe("url_invalid");
  });

  it("maps 429 to rate_limited", () => {
    expect(mapCreateAuditError(429, {})).toBe("rate_limited");
  });

  it("maps everything else to generic", () => {
    expect(mapCreateAuditError(500, {})).toBe("generic");
  });
});
