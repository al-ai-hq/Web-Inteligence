import { describe, expect, it } from "vitest";
import { InMemoryOutcomeStore } from "../src/in-memory-outcome-store.js";

const BASE = {
  userId: "user-1",
  ruleId: "CRW-001",
  auditIdApplied: "audit-1",
  metric: "presence_readiness" as const,
};

describe("InMemoryOutcomeStore.markApplied", () => {
  it("creates a pending outcome with no measured value", async () => {
    const store = new InMemoryOutcomeStore();
    const outcome = await store.markApplied(BASE);

    expect(outcome.user_id).toBe("user-1");
    expect(outcome.audit_id_measured).toBeNull();
    expect(outcome.value_before).toBeNull();
    expect(outcome.fidelity_label).toBe("correlation_only");
    expect(outcome.source).toBe("user_marked_applied");
  });

  it("is idempotent for the same user, rule, applied audit and metric", async () => {
    const store = new InMemoryOutcomeStore();
    const first = await store.markApplied(BASE);
    const second = await store.markApplied(BASE);

    expect(second.id).toBe(first.id);
    expect(await store.listPendingForUser("user-1")).toHaveLength(1);
  });

  it("keeps separate rows per metric and per rule", async () => {
    const store = new InMemoryOutcomeStore();
    await store.markApplied(BASE);
    await store.markApplied({ ...BASE, metric: "crawlability" });
    await store.markApplied({ ...BASE, ruleId: "SEO-004" });

    expect(await store.listPendingForUser("user-1")).toHaveLength(3);
  });

  it("does not leak rows across users", async () => {
    const store = new InMemoryOutcomeStore();
    await store.markApplied(BASE);
    expect(await store.listPendingForUser("user-2")).toHaveLength(0);
  });
});

describe("InMemoryOutcomeStore.recordDeltas", () => {
  it("fills in the measured values and as-of timestamps", async () => {
    const store = new InMemoryOutcomeStore();
    await store.markApplied(BASE);

    const updated = await store.recordDeltas({
      userId: "user-1",
      auditIdMeasured: "audit-2",
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [{ ruleId: "CRW-001", metric: "presence_readiness", auditIdApplied: "audit-1", valueBefore: 41, valueAfter: 63 }],
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]?.value_before).toBe(41);
    expect(updated[0]?.value_after).toBe(63);
    expect(updated[0]?.as_of_before).toBe("2026-09-01T00:00:00.000Z");
    expect(updated[0]?.audit_id_measured).toBe("audit-2");
  });

  it("leaves an outcome measured once out of later runs", async () => {
    const store = new InMemoryOutcomeStore();
    await store.markApplied(BASE);
    await store.recordDeltas({
      userId: "user-1",
      auditIdMeasured: "audit-2",
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [{ ruleId: "CRW-001", metric: "presence_readiness", auditIdApplied: "audit-1", valueBefore: 41, valueAfter: 63 }],
    });

    const second = await store.recordDeltas({
      userId: "user-1",
      auditIdMeasured: "audit-3",
      asOfBefore: "2026-10-01T00:00:00.000Z",
      asOfAfter: "2026-11-01T00:00:00.000Z",
      deltas: [{ ruleId: "CRW-001", metric: "presence_readiness", auditIdApplied: "audit-1", valueBefore: 63, valueAfter: 70 }],
    });

    expect(second).toHaveLength(0);
    const rows = await store.listForAudit("audit-2");
    expect(rows[0]?.value_after).toBe(63);
  });

  it("does not measure a pending outcome recorded against another audit", async () => {
    const store = new InMemoryOutcomeStore();
    await store.markApplied(BASE);
    await store.markApplied({ ...BASE, auditIdApplied: "audit-9" });

    const updated = await store.recordDeltas({
      userId: "user-1",
      auditIdMeasured: "audit-2",
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [
        {
          ruleId: "CRW-001",
          metric: "presence_readiness",
          auditIdApplied: "audit-1",
          valueBefore: 41,
          valueAfter: 63,
        },
      ],
    });

    expect(updated).toHaveLength(1);
    expect(await store.listPendingForUser("user-1")).toHaveLength(1);
  });

  it("ignores deltas for rules that were never marked applied", async () => {
    const store = new InMemoryOutcomeStore();
    await store.markApplied(BASE);

    const updated = await store.recordDeltas({
      userId: "user-1",
      auditIdMeasured: "audit-2",
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [
        {
          ruleId: "GEO-002",
          metric: "geo",
          auditIdApplied: "audit-1",
          valueBefore: 10,
          valueAfter: 20,
        },
      ],
    });

    expect(updated).toHaveLength(0);
  });
});

describe("InMemoryOutcomeStore.listForAudit", () => {
  it("returns outcomes both applied and measured against the audit", async () => {
    const store = new InMemoryOutcomeStore();
    const applied = await store.markApplied(BASE);
    await store.recordDeltas({
      userId: "user-1",
      auditIdMeasured: "audit-2",
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [{ ruleId: "CRW-001", metric: "presence_readiness", auditIdApplied: "audit-1", valueBefore: 41, valueAfter: 63 }],
    });

    expect(await store.listForAudit("audit-1")).toHaveLength(1);
    expect(await store.listForAudit("audit-2")).toHaveLength(1);
    expect(await store.listForAudit(applied.id)).toHaveLength(0);
    expect(await store.listForAudit("unrelated")).toHaveLength(0);
  });
});
