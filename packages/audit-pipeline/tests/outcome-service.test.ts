import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleCategory, ScoreResult } from "@wpi/rules-engine";
import type { AuditContext } from "../src/audit-context.js";
import type { AuditRecord, AuditStore } from "../src/audit-store.js";
import { buildReportModel } from "../src/report-model.js";
import type { StoredReportEnvelope } from "../src/report-envelope.js";
import { InMemoryOutcomeStore } from "../src/in-memory-outcome-store.js";
import { recordOutcomeDeltas } from "../src/outcome-service.js";

const CONTEXT: AuditContext = {
  organization: "Acme",
  business_type: "saas",
  offering: "Workflow software",
  market: "Jordan",
  customer_language: "en",
  audience: "Operations teams",
};

const ALL_CATEGORIES: RuleCategory[] = [
  "crawlability",
  "on_page",
  "structured_data",
  "aeo",
  "geo",
  "i18n_accessibility",
  "performance_security",
];

function scoreResult(presence: number | null, categories: Partial<Record<RuleCategory, number>> = {}): ScoreResult {
  return {
    methodology_version: "0.1.0-m10",
    presence_readiness: presence,
    pre_cap_value: presence,
    applied_caps: [],
    categories: ALL_CATEGORIES.map((category) => ({
      category,
      value: categories[category] ?? null,
      measurable_weight: 0,
      total_weight: 0,
    })),
    coverage: 1,
    confidence: "high",
    unavailable_categories: [],
  };
}

interface AuditFixture {
  id: string;
  targetUrl: string;
  presence?: number | null;
  categories?: Partial<Record<RuleCategory, number>>;
  status?: AuditRecord["status"];
  createdAt?: string;
  updatedAt?: string;
  userId?: string | null;
}

function audit(fixture: AuditFixture): AuditRecord {
  const createdAt = fixture.createdAt ?? "2026-09-01T00:00:00.000Z";
  const report: StoredReportEnvelope = {
    report: buildReportModel({
      auditId: fixture.id,
      locale: "en",
      secretHash: "sha256:abc",
      expiresAt: null,
      userId: "user-1",
      summaryBullets: ["Summary"],
      findingIds: [],
      limitationsKeys: [],
      pagesChecked: 1,
      sampled: false,
      findings: [],
    }),
    findings: [],
    unavailable: [],
    action_board: [],
    costs: { currency: "USD", agents: [], total_usd: 0 },
    score: scoreResult(fixture.presence ?? null, fixture.categories ?? {}),
  };

  return {
    id: fixture.id,
    target_url: fixture.targetUrl,
    locale: "en",
    context: CONTEXT,
    tier: "rich",
    status: fixture.status ?? "READY_COMPLETE",
    secret_hash: "sha256:abc",
    user_id: "userId" in fixture ? (fixture.userId ?? null) : "user-1",
    failure_reason: null,
    report,
    costs: report.costs,
    created_at: createdAt,
    updated_at: fixture.updatedAt ?? createdAt,
    expires_at: null,
    deleted_at: null,
  };
}

/** The outcome service only reads history and single records, so a partial double is enough. */
function auditStore(records: AuditRecord[]): AuditStore {
  return {
    listByUser: () => Promise.resolve(records),
    getRaw: (id: string) => Promise.resolve(records.find((r) => r.id === id) ?? null),
  } as unknown as AuditStore;
}

async function markApplied(outcomes: InMemoryOutcomeStore, ruleId: string, appliedAuditId: string): Promise<void> {
  await outcomes.markApplied({
    userId: "user-1",
    ruleId,
    auditIdApplied: appliedAuditId,
    metric: "presence_readiness",
  });
}

describe("recordOutcomeDeltas", () => {
  beforeEach(() => {
    // Marks are stamped with wall-clock time, so pin "now" before every fixture
    // audit: the minimum-evidence rule only measures marks that predate the audit.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("measures a pending outcome against the previous and current audit", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({ id: "audit-1", targetUrl: "https://example.com", presence: 40 });
    await markApplied(outcomes, "CRW-001", "audit-1");
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
    });

    const measured = await recordOutcomeDeltas(outcomes, auditStore([first, current]), current);

    expect(measured).toBe(1);
    const rows = await outcomes.listForAudit("audit-2");
    expect(rows[0]?.value_before).toBe(40);
    expect(rows[0]?.value_after).toBe(63);
    expect(rows[0]?.as_of_before).toBe("2026-09-01T00:00:00.000Z");
    expect(rows[0]?.as_of_after).toBe("2026-10-01T12:00:00.000Z");
    expect(rows[0]?.fidelity_label).toBe("correlation_only");
  });

  it("reads a per-category metric from the category scores", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({
      id: "audit-1",
      targetUrl: "https://example.com",
      presence: 40,
      categories: { crawlability: 20 },
    });
    await outcomes.markApplied({
      userId: "user-1",
      ruleId: "CRW-001",
      auditIdApplied: "audit-1",
      metric: "crawlability",
    });
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 63,
      categories: { crawlability: 88 },
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([first, current]), current)).toBe(1);
    const rows = await outcomes.listForAudit("audit-2");
    expect(rows[0]?.value_before).toBe(20);
    expect(rows[0]?.value_after).toBe(88);
  });

  it("matches a bare domain and a www or subpath target as the same site", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({ id: "audit-1", targetUrl: "https://www.example.com/", presence: 40 });
    await markApplied(outcomes, "CRW-001", "audit-1");
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com/blog",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([first, current]), current)).toBe(1);
  });

  it("needs an earlier completed audit of the same site before measuring", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({ id: "audit-1", targetUrl: "https://example.com", presence: 40 });
    await markApplied(outcomes, "CRW-001", "audit-1");
    const current = audit({ id: "audit-2", targetUrl: "https://other.com", presence: 63 });

    expect(await recordOutcomeDeltas(outcomes, auditStore([first, current]), current)).toBe(0);
    expect(await outcomes.listPendingForUser("user-1")).toHaveLength(1);
  });

  it("does not measure when either audit lacks the metric", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({ id: "audit-1", targetUrl: "https://example.com", presence: null });
    await markApplied(outcomes, "CRW-001", "audit-1");
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([first, current]), current)).toBe(0);
    expect(await outcomes.listPendingForUser("user-1")).toHaveLength(1);
  });

  it("does not measure when the newer audit lacks the metric", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({ id: "audit-1", targetUrl: "https://example.com", presence: 40 });
    await outcomes.markApplied({
      userId: "user-1",
      ruleId: "GEO-002",
      auditIdApplied: "audit-1",
      metric: "geo",
    });
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([first, current]), current)).toBe(0);
    expect(await outcomes.listPendingForUser("user-1")).toHaveLength(1);
  });

  it("ignores audits with no owner", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const current = audit({ id: "audit-1", targetUrl: "https://example.com", presence: 63, userId: null });

    expect(await recordOutcomeDeltas(outcomes, auditStore([current]), current)).toBe(0);
  });

  it("leaves outcomes marked applied after this audit started pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
    const outcomes = new InMemoryOutcomeStore();
    const first = audit({ id: "audit-1", targetUrl: "https://example.com", presence: 40 });
    await markApplied(outcomes, "CRW-001", "audit-1");
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([first, current]), current)).toBe(0);
    expect(await outcomes.listPendingForUser("user-1")).toHaveLength(1);
  });

  it("compares against the most recent earlier completed audit, not the oldest", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const oldest = audit({ id: "audit-1", targetUrl: "https://example.com", presence: 10 });
    const middle = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 40,
      createdAt: "2026-09-15T00:00:00.000Z",
    });
    await markApplied(outcomes, "CRW-001", "audit-2");
    const current = audit({
      id: "audit-3",
      targetUrl: "https://example.com",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([oldest, current, middle]), current)).toBe(1);
    const rows = await outcomes.listForAudit("audit-3");
    expect(rows[0]?.value_before).toBe(40);
    expect(rows[0]?.as_of_before).toBe("2026-09-15T00:00:00.000Z");
  });

  it("skips history rows that never reached a completed state", async () => {
    const outcomes = new InMemoryOutcomeStore();
    const failed = audit({
      id: "audit-1",
      targetUrl: "https://example.com",
      presence: 40,
      status: "FAILED",
    });
    await markApplied(outcomes, "CRW-001", "audit-1");
    const current = audit({
      id: "audit-2",
      targetUrl: "https://example.com",
      presence: 63,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(await recordOutcomeDeltas(outcomes, auditStore([failed, current]), current)).toBe(0);
  });
});
