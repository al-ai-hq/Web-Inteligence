import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { CreateAuditInput } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";

const CONTEXT: AuditContext = {
  organization: "Example Ltd",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Facility managers",
};

function input(overrides: Partial<CreateAuditInput> = {}): CreateAuditInput {
  return {
    targetUrl: "https://example.com",
    locale: "en",
    context: CONTEXT,
    tier: "rich",
    secretHash: "sha256:abc",
    ttlDays: 7,
    ...overrides,
  };
}

describe("InMemoryAuditStore", () => {
  it("creates a QUEUED audit with a uuid id and 7-day expiry", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.status).toBe("QUEUED");
    expect(record.failure_reason).toBeNull();
    expect(record.report).toBeNull();
    const expires = new Date(record.expires_at).getTime();
    const created = new Date(record.created_at).getTime();
    expect(expires - created).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("getActive returns not_found / deleted / expired", async () => {
    const store = new InMemoryAuditStore();
    expect(await store.getActive("missing")).toBe("not_found");
    const record = await store.create(input());
    await store.softDelete(record.id);
    expect(await store.getActive(record.id)).toBe("deleted");
    const shortLived = await store.create(input({ ttlDays: 0 }));
    expect(await store.getActive(shortLived.id)).toBe("expired");
  });

  it("getActive lazily flips an expired row to EXPIRED", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input({ ttlDays: 0 }));
    await store.getActive(record.id);
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("EXPIRED");
  });

  it("rejects an invalid transition", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    await expect(store.transition(record.id, "COMPOSING")).rejects.toThrow(
      /Invalid transition/,
    );
  });

  it("walks the happy path QUEUED -> ... -> READY_COMPLETE", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      const next = await store.transition(record.id, status);
      expect(next).not.toBe("terminal");
    }
    const done = await store.transition(record.id, "READY_COMPLETE");
    expect(done).not.toBe("terminal");
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("READY_COMPLETE");
  });

  it("returns terminal for transitions after EXPIRED or CANCELLED", async () => {
    const store = new InMemoryAuditStore();
    const expired = await store.create(input({ ttlDays: 0 }));
    await store.getActive(expired.id);
    expect(await store.transition(expired.id, "VALIDATING")).toBe("terminal");
  });

  it("setFailure after a terminal READY status is a no-op returning terminal", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING", "READY_COMPLETE"]) {
      await store.transition(record.id, status);
    }
    const result = await store.setFailure(record.id, "failure.pipeline_error");
    expect(result).toBe("terminal");
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("READY_COMPLETE");
  });

  it("setFailure stores the reason key and optional costs", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    await store.transition(record.id, "VALIDATING");
    await store.setFailure(record.id, "failure.url_invalid");
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("FAILED");
    expect(raw?.failure_reason).toBe("failure.url_invalid");
  });

  it("setOutcome stores report and costs", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      await store.transition(record.id, status);
    }
    const envelope = {
      report: {} as never,
      findings: [],
      unavailable: [],
      action_board: [],
      costs: { currency: "USD" as const, agents: [], total_usd: 0 },
    };
    const done = await store.setOutcome(record.id, "READY_COMPLETE", envelope.report, envelope.costs);
    expect(done.status).toBe("READY_COMPLETE");
    const raw = await store.getRaw(record.id);
    expect(raw?.costs).toEqual({ currency: "USD", agents: [], total_usd: 0 });
  });

  it("sweepExpired flips rows past their expiry and counts them", async () => {
    const store = new InMemoryAuditStore();
    await store.create(input({ ttlDays: 0 }));
    await store.create(input({ ttlDays: 7 }));
    const count = await store.sweepExpired();
    expect(count).toBe(1);
  });

  it("softDelete is idempotent", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    expect(await store.softDelete(record.id)).toBe(true);
    expect(await store.softDelete(record.id)).toBe(false);
    expect(await store.softDelete("missing")).toBe(false);
  });
});
