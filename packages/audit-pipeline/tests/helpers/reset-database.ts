import type { Pool } from "pg";
import { applyMigrations } from "../../src/migrations/migrate.js";

/**
 * Drops every object in the test schema, leaving an empty database.
 *
 * Listing tables one by one left later migrations behind, so a suite that ran
 * second failed with "relation already exists" once another suite had reset only
 * part of the schema.
 */
export async function dropTestSchema(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

/** Empties the schema and brings it up to the current migration set. */
export async function resetDatabase(pool: Pool): Promise<void> {
  await dropTestSchema(pool);
  await applyMigrations(pool);
}
