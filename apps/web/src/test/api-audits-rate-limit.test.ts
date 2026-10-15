import { describe, expect, it, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
import { InMemoryAuthService } from "@wpi/auth";
import { StubEmailService } from "@wpi/email";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { POST } from "../app/api/audits/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

function makeServices(): AuditServices {
  return {
    store: new InMemoryAuditStore(),
    dispatcher: { dispatch: () => Promise.resolve(undefined) },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new InMemoryRateLimiter(),
    validateUrl: (url: string) =>
      Promise.resolve(
        url.startsWith("https://")
          ? { ok: true }
          : { ok: false, reason_key: "failure.url_invalid" },
      ),
    outputDir: "./output",
    geminiApiKey: undefined,
    emailService: new StubEmailService(),
  };
}

function postAudit(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/audits", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  setAuditServicesForTests(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/audits rate limiting", () => {
  it("allows 5 anonymous audits and blocks the 6th with 429", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    const body = {
      url: "https://example.com",
      locale: "en",
      context: {
        organization: "Org",
        business_type: "b2b",
        offering: "Stuff",
        market: "JO",
        customer_language: "English",
        audience: "Managers",
      },
    };

    for (let i = 0; i < 5; i++) {
      const response = await POST(postAudit(body));
      expect(response.status).toBe(201);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    }

    const blocked = await POST(postAudit(body));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("records failures and requires turnstile after 3 invalid submissions", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    const body = {
      url: "not-a-url",
      locale: "en",
      context: {
        organization: "Org",
        business_type: "b2b",
        offering: "Stuff",
        market: "JO",
        customer_language: "English",
        audience: "Managers",
      },
    };

    for (let i = 0; i < 3; i++) {
      const response = await POST(postAudit(body));
      expect(response.status).toBe(400);
    }

    const required = await POST(postAudit(body));
    expect(required.status).toBe(400);
    const json = (await required.json()) as { error?: string };
    expect(json.error).toBe("turnstile_required");
  });

  it("rejects an invalid turnstile token", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 })),
    );

    const invalidBody = {
      url: "not-a-url",
      locale: "en",
      context: {
        organization: "Org",
        business_type: "b2b",
        offering: "Stuff",
        market: "JO",
        customer_language: "English",
        audience: "Managers",
      },
    };

    for (let i = 0; i < 3; i++) {
      await POST(postAudit(invalidBody));
    }

    const response = await POST(postAudit({ ...invalidBody, turnstileToken: "bad" }));
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error?: string };
    expect(json.error).toBe("turnstile_required");
  });
});
