import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../src/migrations/migrate.js";
import { PostgresOutcomeStore } from "../src/postgres-outcome-store.js";
import { resetDatabase } from "./helpers/reset-database.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PostgresOutcomeStore", () => {
  let pool: Pool;
  let store: PostgresOutcomeStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await resetDatabase(pool);
    store = new PostgresOutcomeStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  /** A dedicated owner per test keeps the unique key from coupling the cases. */
  async function fixture(): Promise<{ userId: string; auditIdApplied: string; auditIdMeasured: string }> {
    const user = await pool.query<{ id: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'stub') RETURNING id",
      [`pg-outcome-${randomUUID()}@example.com`],
    );
    const userId = user.rows[0].id;

    async function insertAudit(): Promise<string> {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO audits (target_url, locale, tier, status, secret_hash, user_id, expires_at)
         VALUES ('https://example.com', 'en', 'rich', 'READY_COMPLETE', 'sha256:abc', $1::uuid, now() + interval '30 days')
         RETURNING id`,
        [userId],
      );
      return result.rows[0].id;
    }

    return { userId, auditIdApplied: await insertAudit(), auditIdMeasured: await insertAudit() };
  }

  const input = (f: { userId: string; auditIdApplied: string }) => ({
    userId: f.userId,
    ruleId: "CRW-001",
    auditIdApplied: f.auditIdApplied,
    metric: "presence_readiness" as const,
  });

  it("applies migration 0019 idempotently", async () => {
    const second = await applyMigrations(pool);
    expect(second.applied).toEqual([]);
    const exists = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'recommendation_outcomes'",
    );
    expect(exists.rowCount).toBe(1);
  });

  it("rejects a metric outside the allowed set", async () => {
    const f = await fixture();
    await expect(
      store.markApplied({ ...input(f), metric: "serp_position" as never }),
    ).rejects.toThrow();
  });

  it("marks applied once and returns the existing row on repeat", async () => {
    const f = await fixture();
    const first = await store.markApplied(input(f));
    const again = await store.markApplied(input(f));

    expect(again.id).toBe(first.id);
    expect(first.audit_id_measured).toBeNull();
    expect(first.fidelity_label).toBe("correlation_only");
    expect(first.source).toBe("user_marked_applied");
    expect(await store.listPendingForUser(f.userId)).toHaveLength(1);
  });

  it("keeps a zero measurement as zero rather than null", async () => {
    const f = await fixture();
    await store.markApplied({ ...input(f), ruleId: "SEO-004", metric: "on_page" });
    await store.recordDeltas({
      userId: f.userId,
      auditIdMeasured: f.auditIdMeasured,
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [
        { ruleId: "SEO-004", metric: "on_page", auditIdApplied: f.auditIdApplied, valueBefore: 0, valueAfter: 0 },
      ],
    });

    const rows = await store.listForAudit(f.auditIdMeasured);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value_before).toBe(0);
    expect(rows[0]?.value_after).toBe(0);
  });

  it("writes timestamps to the as-of columns and closes the pending row", async () => {
    const f = await fixture();
    await store.markApplied(input(f));
    const delta = {
      ruleId: "CRW-001",
      metric: "presence_readiness" as const,
      auditIdApplied: f.auditIdApplied,
      valueBefore: 41.5,
      valueAfter: 63.25,
    };

    const measured = await store.recordDeltas({
      userId: f.userId,
      auditIdMeasured: f.auditIdMeasured,
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [delta],
    });

    expect(measured).toHaveLength(1);
    expect(measured[0]?.as_of_before).toBe("2026-09-01T00:00:00.000Z");
    expect(measured[0]?.value_before).toBeCloseTo(41.5);

    // A second measurement of the same mark must not overwrite the first comparison.
    const rerun = await store.recordDeltas({
      userId: f.userId,
      auditIdMeasured: f.auditIdMeasured,
      asOfBefore: "2026-09-01T00:00:00.000Z",
      asOfAfter: "2026-10-01T00:00:00.000Z",
      deltas: [{ ...delta, valueAfter: 99 }],
    });
    expect(rerun).toHaveLength(0);
  });

  it("deletes outcomes when the audit they were applied to is removed", async () => {
    const f = await fixture();
    await store.markApplied({ ...input(f), ruleId: "GEO-001" });

    await pool.query("DELETE FROM audits WHERE id = $1::uuid", [f.auditIdApplied]);
    const remaining = await pool.query(
      "SELECT 1 FROM recommendation_outcomes WHERE user_id = $1::uuid AND rule_id = 'GEO-001'",
      [f.userId],
    );
    expect(remaining.rowCount).toBe(0);
  });
});
