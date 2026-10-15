import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { applyMigrations } from "../src/migrations/migrate.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("applyMigrations WPI_MIGRATIONS_DIR override", () => {
  let pool: Pool;
  let migrationsDir: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    migrationsDir = await mkdtemp(join(tmpdir(), "wpi-migrations-"));
    await writeFile(
      join(migrationsDir, "0001_test.sql"),
      "CREATE TABLE IF NOT EXISTS migration_dir_test (id serial PRIMARY KEY);\n-- Insert a row so the test's rowCount > 0 assertion has data to verify.\nINSERT INTO migration_dir_test DEFAULT VALUES;",
    );
    await pool.query("DROP TABLE IF EXISTS migration_dir_test");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    process.env["WPI_MIGRATIONS_DIR"] = migrationsDir;
  });

  afterAll(async () => {
    delete process.env["WPI_MIGRATIONS_DIR"];
    await pool.query("DROP TABLE IF EXISTS migration_dir_test");
    await pool.end();
    await rm(migrationsDir, { recursive: true, force: true });
  });

  it("applies migrations from the directory in WPI_MIGRATIONS_DIR", async () => {
    const result = await applyMigrations(pool);
    expect(result.applied).toContain("0001_test.sql");
    const check = await pool.query("SELECT 1 FROM migration_dir_test");
    expect(check.rowCount).toBeGreaterThan(0);
  });
});
