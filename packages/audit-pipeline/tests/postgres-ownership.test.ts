import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  PostgresAuditStore,
  hashAuditSecret,
  generateAuditSecret,
  type AuditContext,
} from "../src/index.js";
import { resetDatabase } from "./helpers/reset-database.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PostgresAuditStore ownership", () => {
  let pool: Pool;
  let store: PostgresAuditStore;

  const CONTEXT: AuditContext = {
    organization: "Test Org",
    business_type: "saas",
    offering: "Tooling",
    market: "Global",
    customer_language: "English",
    audience: "Developers",
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await resetDatabase(pool);
    store = new PostgresAuditStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'stub') RETURNING id",
      [email],
    );
    return result.rows[0].id;
  }

  it("creates owned audit with null expiry", async () => {
    const userId = await insertUser(`pg-own-${randomUUID()}@example.com`);
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
      userId,
    });
    expect(record.user_id).toBe(userId);
    expect(record.expires_at).toBeNull();
  });

  it("creates anonymous audit with 7-day expiry", async () => {
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "preview",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
    });
    expect(record.user_id).toBeNull();
    expect(record.expires_at).not.toBeNull();
  });

  it("listByUser returns newest-first", async () => {
    const userId = await insertUser(`pg-list-${randomUUID()}@example.com`);
    const s1 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com/1",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s1),
      ttlDays: 7,
      userId,
    });
    const s2 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com/2",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s2),
      ttlDays: 7,
      userId,
    });
    const records = await store.listByUser(userId);
    expect(records.length).toBe(2);
    expect(records[0].target_url).toBe("https://example.com/2");
  });
});
