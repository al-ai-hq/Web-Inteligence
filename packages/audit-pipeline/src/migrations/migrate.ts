import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

function packageRoot(metaUrl: string): string {
  let dir = dirname(fileURLToPath(metaUrl));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate package root (no package.json ancestor)");
    }
    dir = parent;
  }
}

export const MIGRATIONS_DIR = join(packageRoot(import.meta.url), "src", "migrations");

export interface MigrationResult {
  applied: string[];
}

export async function applyMigrations(
  pool: Pool,
  migrationsDir: string = MIGRATIONS_DIR,
): Promise<MigrationResult> {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const applied: string[] = [];
    for (const name of files) {
      const seen = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
      if (seen.rowCount && seen.rowCount > 0) {
        continue;
      }
      const sql = await readFile(join(migrationsDir, name), "utf-8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        applied.push(name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return { applied };
  } finally {
    client.release();
  }
}
