import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditContext, AuditStore } from "@wpi/audit-pipeline";
import {
  generateAuditSecret,
  hashAuditSecret,
  InMemoryAuditStore,
  TIER_SCOPES,
} from "@wpi/audit-pipeline";
import { InMemoryAuthService, RateLimiter } from "@wpi/auth";
import { NextRequest } from "next/server";
import { GET as statusGET } from "../app/api/audits/[id]/status/route";
import { DELETE as auditDELETE } from "../app/api/audits/[id]/route";
import { GET as exportGET, POST as exportPOST } from "../app/api/export/route";
import { authorizeRecord } from "../services/access";
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

async function seedStore(): Promise<{ store: InMemoryAuditStore; id: string; secret: string }> {
  const store = new InMemoryAuditStore();
  const secret = generateAuditSecret();
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: CONTEXT,
    tier: "preview",
    secretHash: hashAuditSecret(secret),
    ttlDays: 7,
  });
  return { store, id: record.id, secret };
}

function makeServices(store: AuditStore): AuditServices {
  return {
    store,
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new RateLimiter(),
    validateUrl: async () => ({ ok: true }),
    outputDir: "./output",
    geminiApiKey: undefined,
  };
}

function statusRequest(id: string, secret?: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/audits/${id}/status`);
  if (secret !== undefined) {
    url.searchParams.set("s", secret);
  }
  return new NextRequest(url);
}

function deleteRequest(id: string, secret?: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/audits/${id}`);
  if (secret !== undefined) {
    url.searchParams.set("s", secret);
  }
  return new NextRequest(url, { method: "DELETE" });
}

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("authorizeRecord", () => {
  it("returns not_found for an unknown id", async () => {
    const { store } = await seedStore();
    const outcome = await authorizeRecord(store, randomUUID(), "whatever");
    expect(outcome).toEqual({ kind: "not_found" });
  });

  it("returns not_found for a wrong or missing secret", async () => {
    const { store, id } = await seedStore();
    expect(await authorizeRecord(store, id, "wrong-secret")).toEqual({ kind: "not_found" });
    expect(await authorizeRecord(store, id, undefined)).toEqual({ kind: "not_found" });
  });

  it("authorizes the correct secret", async () => {
    const { store, id, secret } = await seedStore();
    const outcome = await authorizeRecord(store, id, secret);
    expect(outcome.kind).toBe("authorized");
    if (outcome.kind === "authorized") {
      expect(outcome.record.status).toBe("QUEUED");
    }
  });

  it("returns deleted for a soft-deleted record", async () => {
    const { store, id, secret } = await seedStore();
    await store.softDelete(id);
    const outcome = await authorizeRecord(store, id, secret);
    expect(outcome).toEqual({ kind: "deleted" });
  });

  it("returns expired for an expired record", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "preview",
      secretHash: hashAuditSecret(secret),
      ttlDays: 0,
    });
    const outcome = await authorizeRecord(store, record.id, secret);
    expect(outcome.kind).toBe("expired");
  });
});

describe("GET /api/audits/[id]/status", () => {
  it("returns status for the correct secret with no-index headers", async () => {
    const { store, id, secret } = await seedStore();
    setAuditServicesForTests(makeServices(store));

    const response = await statusGET(statusRequest(id, secret), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      status: string;
      failure_reason: string | null;
      has_report: boolean;
    };
    expect(body.status).toBe("QUEUED");
    expect(body.has_report).toBe(false);
    expect(body.failure_reason).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 for an unknown id", async () => {
    const { store } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const unknownId = randomUUID();
    const response = await statusGET(statusRequest(unknownId, "whatever"), {
      params: Promise.resolve({ id: unknownId }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a wrong secret", async () => {
    const { store, id } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const response = await statusGET(statusRequest(id, "wrong-secret"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/audits/[id]", () => {
  it("returns 404 for a wrong secret", async () => {
    const { store, id } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const response = await auditDELETE(deleteRequest(id, "wrong-secret"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });

  it("soft-deletes the record with 204", async () => {
    const { store, id, secret } = await seedStore();
    setAuditServicesForTests(makeServices(store));

    const response = await auditDELETE(deleteRequest(id, secret), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(204);
    const raw = await store.getRaw(id);
    expect(raw?.deleted_at).not.toBeNull();
  });
});

describe("export denial", () => {
  it("denies GET and POST with 403 export_denied", async () => {
    const getResponse = await exportGET();
    expect(getResponse.status).toBe(403);
    const getBody = (await getResponse.json()) as { error: string };
    expect(getBody.error).toBe("export_denied");

    const postResponse = await exportPOST();
    expect(postResponse.status).toBe(403);
    const postBody = (await postResponse.json()) as { error: string };
    expect(postBody.error).toBe("export_denied");
  });
});
