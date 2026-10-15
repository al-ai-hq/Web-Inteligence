import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";
import { InProcessDispatcher, scopedEnv, sleep, StubDispatcher } from "../src/dispatcher.js";

const AUDIT_CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

describe("StubDispatcher", () => {
  it("emits a stub score with presence_readiness 72", async () => {
    const store = new InMemoryAuditStore();
    const secret = "sha256:" + "a".repeat(64);
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: {
        organization: "Test",
        business_type: "saas",
        offering: "Tooling",
        market: "Global",
        customer_language: "English",
        audience: "Developers",
      },
      tier: "preview",
      secretHash: secret,
      ttlDays: 7,
    });
    const dispatcher = new StubDispatcher(store, 0);
    await dispatcher.dispatch(record.id);
    const raw = await store.getRaw(record.id);
    expect(raw?.report?.score?.presence_readiness).toBe(72);
  });

  it("drives a QUEUED audit to READY_COMPLETE with stub findings", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: AUDIT_CONTEXT,
      tier: "rich",
      // Adjudicated fixture repair: secret_hash must match the
      // schemas/common.schema.json content_hash pattern ^sha256:[0-9a-f]{64}$.
      secretHash: "sha256:" + "a".repeat(64),
      ttlDays: 7,
    });
    const dispatcher = new StubDispatcher(store, 10);
    await dispatcher.dispatch(record.id);
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("READY_COMPLETE");
    expect(raw?.report?.findings).toHaveLength(2);
    expect(raw?.report?.report.content.summary_bullets).toEqual([
      "report.summary.technical",
      "report.summary.content",
    ]);
  });
});

describe("InProcessDispatcher", () => {
  it("runs dispatched jobs one at a time in dispatch order", async () => {
    const events: string[] = [];
    const dispatcher = new InProcessDispatcher(async (jobId) => {
      events.push(`start:${jobId}`);
      await sleep(20);
      events.push(`end:${jobId}`);
    });
    const first = dispatcher.dispatch("a");
    const second = dispatcher.dispatch("b");
    await Promise.all([first, second]);
    expect(events).toEqual(["start:a", "end:a", "start:b", "end:b"]);
  });

  it("does not block the next job when a run rejects", async () => {
    const run = vi.fn<(jobId: string) => Promise<void>>();
    run.mockRejectedValueOnce(new Error("boom"));
    run.mockResolvedValueOnce(undefined);
    const dispatcher = new InProcessDispatcher(run);
    await expect(dispatcher.dispatch("a")).rejects.toThrow("boom");
    await expect(dispatcher.dispatch("b")).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("scopedEnv", () => {
  it("applies overrides for the callback and restores prior values", async () => {
    process.env["WPI_SCOPED_TEST"] = "before";
    try {
      await scopedEnv({ WPI_SCOPED_TEST: "during", WPI_SCOPED_NEW: "added" }, async () => {
        expect(process.env["WPI_SCOPED_TEST"]).toBe("during");
        expect(process.env["WPI_SCOPED_NEW"]).toBe("added");
      });
      expect(process.env["WPI_SCOPED_TEST"]).toBe("before");
      expect(process.env["WPI_SCOPED_NEW"]).toBeUndefined();
    } finally {
      delete process.env["WPI_SCOPED_TEST"];
      delete process.env["WPI_SCOPED_NEW"];
    }
  });

  it("deletes variables whose override is undefined and restores them", async () => {
    process.env["WPI_SCOPED_TEST"] = "before";
    try {
      await scopedEnv({ WPI_SCOPED_TEST: undefined }, async () => {
        expect(process.env["WPI_SCOPED_TEST"]).toBeUndefined();
      });
      expect(process.env["WPI_SCOPED_TEST"]).toBe("before");
    } finally {
      delete process.env["WPI_SCOPED_TEST"];
    }
  });
});
