import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryAuditStore,
  TIER_SCOPES,
  type AuditStore,
} from "@wpi/audit-pipeline";
import { NextRequest } from "next/server";
import type { AuditContext } from "@wpi/audit-pipeline";
import { POST } from "../app/api/audits/route";
import {
  setAuditServicesForTests,
  type AuditServices,
} from "../services/container";

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
    validateUrl: async (url: string) =>
      url.startsWith("https://") || url.startsWith("http://")
        ? { ok: true }
        : { ok: false, reason_key: "failure.url_invalid" },
    outputDir: "./output",
    geminiApiKey: undefined,
    pool: null,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/audits", {
    method: "POST",
    headers: { "content-type": "application/json" },
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

  it("still returns 201 when the dispatcher rejects", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests({
      ...makeServices(store),
      dispatcher: { dispatch: async () => { throw new Error("boom"); } },
    });
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
