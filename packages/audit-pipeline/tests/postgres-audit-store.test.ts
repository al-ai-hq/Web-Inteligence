import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../src/migrations/migrate.js";
import { PostgresAuditStore } from "../src/postgres-audit-store.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PostgresAuditStore", () => {
  let pool: Pool;
  let store: PostgresAuditStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("DROP TABLE IF EXISTS audits CASCADE");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    await applyMigrations(pool);
    store = new PostgresAuditStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const CONTEXT = {
    organization: "Example Ltd",
    business_type: "e-commerce",
    offering: "Office furniture",
    market: "Saudi Arabia",
    customer_language: "Arabic",
    audience: "Facility managers",
  };

  function input(overrides: { ttlDays?: number } = {}) {
    return {
      targetUrl: "https://example.com",
      locale: "en" as const,
      context: CONTEXT,
      tier: "rich" as const,
      secretHash: "sha256:abc",
      ttlDays: 7,
      ...overrides,
    };
  }

  it("applies the migration idempotently", async () => {
    const second = await applyMigrations(pool);
    expect(second.applied).toEqual([]);
  });

  it("create inserts a QUEUED row and round-trips the record", async () => {
    const record = await store.create(input());
    expect(record.status).toBe("QUEUED");
    expect(record.context).toEqual(CONTEXT);
    const raw = await store.getRaw(record.id);
    expect(raw?.secret_hash).toBe("sha256:abc");
  });

  it("the status CHECK constraint rejects invalid states", async () => {
    await expect(
      pool.query(
        "INSERT INTO audits (target_url, locale, tier, status, secret_hash, expires_at) VALUES ($1, 'en', 'rich', 'BOGUS', 'h', now() + interval '7 days')",
        ["https://example.com"],
      ),
    ).rejects.toThrow();
  });

  it("transition walks the happy path and honors the guarded write", async () => {
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      const next = await store.transition(record.id, status);
      expect(next).not.toBe("terminal");
    }
    const invalid = await store.transition(record.id, "QUEUED");
    expect(invalid).toBe("terminal");
  });

  it("transition on a CANCELLED row returns terminal without writing", async () => {
    const record = await store.create(input());
    await pool.query("UPDATE audits SET status = 'CANCELLED' WHERE id = $1", [record.id]);
    const result = await store.transition(record.id, "VALIDATING");
    expect(result).toBe("terminal");
  });

  it("sweepExpired flips only expired rows", async () => {
    const record = await store.create(input({ ttlDays: 0 }));
    await store.transition(record.id, "VALIDATING");
    const count = await store.sweepExpired();
    expect(count).toBeGreaterThanOrEqual(1);
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("EXPIRED");
  });

  it("softDelete marks deleted exactly once", async () => {
    const record = await store.create(input());
    expect(await store.softDelete(record.id)).toBe(true);
    expect(await store.softDelete(record.id)).toBe(false);
    expect(await store.getActive(record.id)).toBe("deleted");
  });
});
