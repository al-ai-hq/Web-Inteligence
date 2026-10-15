import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
import { InMemoryAuthService } from "@wpi/auth";
import { StubEmailService } from "@wpi/email";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { NextRequest } from "next/server";
import { POST } from "../app/api/audits/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

const VALID_BODY = {
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

function makeServices(): AuditServices {
  return {
    store: new InMemoryAuditStore(),
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new InMemoryRateLimiter(),
    validateUrl: async (url: string) =>
      url.startsWith("https://") ? { ok: true } : { ok: false, reason_key: "failure.url_invalid" },
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
  delete process.env["TURNSTILE_SECRET_KEY"];
});

describe("POST /api/audits rate limiting integration", () => {
  it("returns rate limit headers on every response", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);

    const success = await POST(postAudit(VALID_BODY));
    expect(success.status).toBe(201);
    expect(success.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(success.headers.get("X-RateLimit-Remaining")).toMatch(/^\d+$/);
    expect(success.headers.get("X-RateLimit-Reset")).toMatch(/^\d+$/);

    const invalid = await POST(postAudit({ ...VALID_BODY, url: "ftp://example.com" }));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(invalid.headers.get("X-RateLimit-Remaining")).toMatch(/^\d+$/);
    expect(invalid.headers.get("X-RateLimit-Reset")).toMatch(/^\d+$/);
  });

  it("limits signed-in users to 50 audits per calendar month", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    const user = await services.auth.createUser("owner@example.com", "password123");
    const session = await services.auth.createSession(user.id);
    const cookie = `wpi_session=${session.token}`;

    for (let i = 0; i < 50; i++) {
      const response = await POST(postAudit(VALID_BODY, { cookie }));
      expect(response.status).toBe(201);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("50");
    }

    const blocked = await POST(postAudit(VALID_BODY, { cookie }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("X-RateLimit-Limit")).toBe("50");
    expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(blocked.headers.get("X-RateLimit-Reset")).toMatch(/^\d+$/);
    expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("accepts a valid turnstile token while the IP is suspicious", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    );

    const invalidBody = { ...VALID_BODY, url: "not-a-url" };

    for (let i = 0; i < 3; i++) {
      const response = await POST(postAudit(invalidBody));
      expect(response.status).toBe(400);
    }

    const required = await POST(postAudit(invalidBody));
    expect(required.status).toBe(400);
    const requiredJson = (await required.json()) as { error?: string };
    expect(requiredJson.error).toBe("turnstile_required");

    const verified = await POST(postAudit({ ...VALID_BODY, turnstileToken: "valid-token" }));
    expect(verified.status).toBe(201);
  });

  it("rejects an invalid turnstile token while the IP is suspicious", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 })),
    );

    const invalidBody = { ...VALID_BODY, url: "not-a-url" };

    for (let i = 0; i < 3; i++) {
      const response = await POST(postAudit(invalidBody));
      expect(response.status).toBe(400);
    }

    const required = await POST(postAudit(invalidBody));
    expect(required.status).toBe(400);
    const requiredJson = (await required.json()) as { error?: string };
    expect(requiredJson.error).toBe("turnstile_required");

    const rejected = await POST(postAudit({ ...invalidBody, turnstileToken: "bad-token" }));
    expect(rejected.status).toBe(400);
    const rejectedJson = (await rejected.json()) as { error?: string };
    expect(rejectedJson.error).toBe("turnstile_required");
  });
});
