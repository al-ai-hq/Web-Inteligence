import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditContext, AuditStore } from "@wpi/audit-pipeline";
import {
  buildReportModel,
  generateAuditSecret,
  hashAuditSecret,
  InMemoryAuditStore,
  InMemoryOutcomeStore,
  TIER_SCOPES,
} from "@wpi/audit-pipeline";
import type {
  RecommendationOutcome,
  StoredActionItem,
  StoredCosts,
  StoredReportEnvelope,
} from "@wpi/audit-pipeline";
import { SESSION_COOKIE_NAME } from "@wpi/auth";
import { InMemoryAuthService } from "@wpi/auth";
import { StubEmailService } from "@wpi/email";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { NextRequest, type NextResponse } from "next/server";
import { GET as statusGET, DELETE as auditDELETE } from "../app/api/audits/route";
import { POST as applyPOST } from "../app/api/audits/[id]/recommendations/[findingId]/apply/route";
import { GET as exportGET, POST as exportPOST } from "../app/api/export/route";
import { authorizeRecord } from "../services/access";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

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
    outcomeStore: new InMemoryOutcomeStore(),
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new InMemoryRateLimiter(),
    validateUrl: async () => ({ ok: true }),
    outputDir: "./output",
    geminiApiKey: undefined,
    emailService: new StubEmailService(),
  };
}

function statusRequest(id: string, secret?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/audits");
  url.searchParams.set("id", id);
  if (secret !== undefined) {
    url.searchParams.set("s", secret);
  }
  return new NextRequest(url);
}

function deleteRequest(id: string, secret?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/audits");
  url.searchParams.set("id", id);
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
    const outcome = await authorizeRecord(store, randomUUID(), "whatever", null);
    expect(outcome).toEqual({ kind: "not_found" });
  });

  it("returns not_found for a wrong or missing secret", async () => {
    const { store, id } = await seedStore();
    expect(await authorizeRecord(store, id, "wrong-secret", null)).toEqual({ kind: "not_found" });
    expect(await authorizeRecord(store, id, undefined, null)).toEqual({ kind: "not_found" });
  });

  it("authorizes the correct secret", async () => {
    const { store, id, secret } = await seedStore();
    const outcome = await authorizeRecord(store, id, secret, null);
    expect(outcome.kind).toBe("authorized");
    if (outcome.kind === "authorized") {
      expect(outcome.record.status).toBe("QUEUED");
    }
  });

  it("returns deleted for a soft-deleted record", async () => {
    const { store, id, secret } = await seedStore();
    await store.softDelete(id);
    const outcome = await authorizeRecord(store, id, secret, null);
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
    const outcome = await authorizeRecord(store, record.id, secret, null);
    expect(outcome.kind).toBe("expired");
  });
});

describe("GET /api/audits?id=...", () => {
  it("returns status for the correct secret with no-index headers", async () => {
    const { store, id, secret } = await seedStore();
    setAuditServicesForTests(makeServices(store));

    const response = await statusGET(statusRequest(id, secret));

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
    const response = await statusGET(statusRequest(unknownId, "whatever"));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a wrong secret", async () => {
    const { store, id } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const response = await statusGET(statusRequest(id, "wrong-secret"));
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/audits/[id]", () => {
  it("returns 404 for a wrong secret", async () => {
    const { store, id } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const response = await auditDELETE(deleteRequest(id, "wrong-secret"));
    expect(response.status).toBe(404);
  });

  it("soft-deletes the record with 204", async () => {
    const { store, id, secret } = await seedStore();
    setAuditServicesForTests(makeServices(store));

    const response = await auditDELETE(deleteRequest(id, secret));

    expect(response.status).toBe(204);
    const raw = await store.getRaw(id);
    expect(raw?.deleted_at).not.toBeNull();
  });
});

async function seedOwnedStore(): Promise<{
  store: InMemoryAuditStore;
  id: string;
  secret: string;
}> {
  const store = new InMemoryAuditStore();
  const secret = generateAuditSecret();
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: CONTEXT,
    tier: "rich",
    secretHash: hashAuditSecret(secret),
    ttlDays: 7,
    userId: "user-1",
  });
  return { store, id: record.id, secret };
}

describe("authorizeRecord owned access", () => {
  it("authorizes the owner without a secret", async () => {
    const { store, id } = await seedOwnedStore();
    const outcome = await authorizeRecord(store, id, undefined, "user-1");
    expect(outcome.kind).toBe("authorized");
  });

  it("returns not_found for a different user", async () => {
    const { store, id } = await seedOwnedStore();
    const outcome = await authorizeRecord(store, id, undefined, "user-2");
    expect(outcome.kind).toBe("not_found");
  });

  it("returns not_found when userId is null and no secret", async () => {
    const { store, id } = await seedOwnedStore();
    const outcome = await authorizeRecord(store, id, undefined, null);
    expect(outcome.kind).toBe("not_found");
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

describe("POST /api/audits/[id]/recommendations/[findingId]/apply", () => {
  const FINDING_ID = "finding-crw-001";

  async function seedReport(store: InMemoryAuditStore, userId: string): Promise<string> {
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(generateAuditSecret()),
      ttlDays: 7,
      userId,
    });
    const item: StoredActionItem = {
      title: "CRW-001",
      detail: "Serve a reachable robots.txt",
      severity: "critical",
      confidence: "high",
      source_finding_id: FINDING_ID,
      category: "crawlability",
      impact_score: 10,
      effort_score: 2,
      timeline_score: 1,
      priority_score: 17,
      band: "quick_win",
      playbook_note_key: null,
    };
    const costs: StoredCosts = { currency: "USD", agents: [], total_usd: 0 };
    const envelope: StoredReportEnvelope = {
      report: buildReportModel({
        auditId: record.id,
        locale: "en",
        secretHash: record.secret_hash,
        expiresAt: record.expires_at,
        userId,
        summaryBullets: [],
        findingIds: [FINDING_ID],
        limitationsKeys: [],
        pagesChecked: 1,
        sampled: false,
        findings: [],
      }),
      findings: [],
      unavailable: [],
      action_board: [item],
      costs,
      score: null,
    };
    for (const state of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      await store.transition(record.id, state);
    }
    await store.setOutcome(record.id, "READY_COMPLETE", envelope, costs);
    return record.id;
  }

  async function makeSession(store: InMemoryAuditStore, email: string) {
    const services = makeServices(store);
    const user = await services.auth.createUser(email, "correct-horse-battery");
    const session = await services.auth.createSession(user.id);
    setAuditServicesForTests(services);
    return { services, user, session };
  }

  function applyRequest(id: string, findingId: string, token?: string): NextRequest {
    const request = new NextRequest(
      `http://localhost:3000/api/audits/${id}/recommendations/${findingId}/apply`,
      { method: "POST" },
    );
    if (token !== undefined) {
      request.cookies.set(SESSION_COOKIE_NAME, token);
    }
    return request;
  }

  /** Next.js hands dynamic segments to the handler as a promise of params. */
  function callApply(id: string, findingId: string, token?: string): Promise<NextResponse> {
    return applyPOST(applyRequest(id, findingId, token), {
      params: Promise.resolve({ id, findingId }),
    });
  }

  it("records the mark for the rule category and the overall score", async () => {
    const store = new InMemoryAuditStore();
    const { user, session } = await makeSession(store, "owner@example.com");
    const id = await seedReport(store, user.id);

    const response = await callApply(id, FINDING_ID, session.token);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { outcomes: RecommendationOutcome[] };
    expect(body.outcomes.map((outcome) => outcome.metric).sort()).toEqual([
      "crawlability",
      "presence_readiness",
    ]);
    expect(body.outcomes[0]).toMatchObject({
      rule_id: "CRW-001",
      audit_id_applied: id,
      audit_id_measured: null,
      fidelity_label: "correlation_only",
      source: "user_marked_applied",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is idempotent for the same rule and audit", async () => {
    const store = new InMemoryAuditStore();
    const { services, user, session } = await makeSession(store, "owner@example.com");
    const id = await seedReport(store, user.id);

    const first = await callApply(id, FINDING_ID, session.token);
    const again = await callApply(id, FINDING_ID, session.token);

    const firstBody = (await first.json()) as { outcomes: RecommendationOutcome[] };
    const againBody = (await again.json()) as { outcomes: RecommendationOutcome[] };
    expect(againBody.outcomes.map((outcome) => outcome.id)).toEqual(
      firstBody.outcomes.map((outcome) => outcome.id),
    );
    // Two clicks are still one mark per metric.
    expect(await services.outcomeStore.listPendingForUser(user.id)).toHaveLength(2);
  });

  it("rejects an anonymous request", async () => {
    const store = new InMemoryAuditStore();
    const services = makeServices(store);
    setAuditServicesForTests(services);
    const id = await seedReport(store, "some-other-user");

    const response = await callApply(id, FINDING_ID);

    expect(response.status).toBe(401);
  });

  it("returns 404 for a signed-in non-owner", async () => {
    const store = new InMemoryAuditStore();
    const { session } = await makeSession(store, "intruder@example.com");
    const id = await seedReport(store, randomUUID());

    const response = await callApply(id, FINDING_ID, session.token);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a finding that is not on the board", async () => {
    const store = new InMemoryAuditStore();
    const { user, session } = await makeSession(store, "owner@example.com");
    const id = await seedReport(store, user.id);

    const response = await callApply(id, "finding-unknown", session.token);

    expect(response.status).toBe(404);
    expect((await response.json()) as { error: string }).toEqual({ error: "finding_not_found" });
  });
});
