import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { applyMigrations } from "../src/migrations/migrate.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("migrations", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("DROP TABLE IF EXISTS password_reset_tokens CASCADE");
    await pool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("applies migration 0018 and creates password_reset_tokens", async () => {
    const result = await applyMigrations(pool);
    expect(result.applied).toContain("0018_password_reset_tokens.sql");

    const columns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'password_reset_tokens'`,
    );
    const names = columns.rows.map((r) => r.column_name);
    expect(names).toContain("token_hash");
    expect(names).toContain("user_id");
    expect(names).toContain("expires_at");
    expect(names).toContain("used_at");
  });
});
