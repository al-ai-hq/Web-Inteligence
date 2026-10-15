import { afterEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore, TIER_SCOPES, type AuditStore } from "@wpi/audit-pipeline";
import { InMemoryAuthService } from "@wpi/auth";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { NextRequest } from "next/server";
import type { AuditContext } from "@wpi/audit-pipeline";
import { POST } from "../app/api/audits/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

const CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

const VALID_BODY = {
  url: "https://example.com",
  locale: "en",
  context: CONTEXT,
};

function makeServices(store: AuditStore): AuditServices {
  return {
    store,
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new InMemoryRateLimiter(),
    validateUrl: async (url: string) =>
      url.startsWith("https://") || url.startsWith("http://")
        ? { ok: true }
        : { ok: false, reason_key: "failure.url_invalid" },
    outputDir: "./output",
    geminiApiKey: undefined,
  };
}

function makeRequest(body: unknown, cookie?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/audits", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("POST /api/audits", () => {
  it("creates an audit, dispatches it, and sets the eligibility cookie", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; secret: string; status_url: string };
    expect(typeof body.id).toBe("string");
    expect(typeof body.secret).toBe("string");
    expect(body.status_url).toBe(`/en/audit/${body.id}`);
    expect(response.headers.get("set-cookie")).toContain("wpi_eligibility=");

    const raw = await store.getRaw(body.id);
    expect(raw?.status).toBe("QUEUED");
    expect(raw?.tier).toBe("rich");
  });

  it("rejects non-http(s) URLs with 400 url_invalid", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest({ ...VALID_BODY, url: "ftp://example.com" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("url_invalid");
  });

  it("rejects bodies missing required context fields", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));
    const { audience: _omitted, ...incomplete } = CONTEXT;

    const response = await POST(
      makeRequest({ url: "https://example.com", locale: "en", context: incomplete }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest("{not json"));

    expect(response.status).toBe(400);
  });

  it("rejects unknown top-level fields with 400 url_invalid", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest({ ...VALID_BODY, extraField: "x" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("url_invalid");
  });

  it("still returns 201 when the dispatcher rejects", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests({
      ...makeServices(store),
      dispatcher: {
        dispatch: async () => {
          throw new Error("boom");
        },
      },
    });
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("creates an owned audit when signed in", async () => {
    const store = new InMemoryAuditStore();
    const auth = new InMemoryAuthService();
    setAuditServicesForTests({
      ...makeServices(store),
      auth,
    });

    const user = await auth.createUser("owner@example.com", "password123");
    const session = await auth.createSession(user.id);

    const response = await POST(makeRequest(VALID_BODY, `wpi_session=${session.token}`));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; redirect_url: string | null };
    expect(body.redirect_url).toBe("/en/dashboard");

    const raw = await store.getRaw(body.id);
    expect(raw?.user_id).toBe(user.id);
    expect(raw?.expires_at).toBeNull();
  });

  it("returns redirect_url null for anonymous POST", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest(VALID_BODY, "wpi_session=garbage"));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { redirect_url: string | null };
    expect(body.redirect_url).toBeNull();
  });
});
