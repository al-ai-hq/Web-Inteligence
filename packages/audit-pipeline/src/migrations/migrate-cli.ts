import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { applyMigrations } from "./migrate.js";

async function main(): Promise<void> {
  const connectionString = process.env["WPI_DATABASE_URL"];
  if (!connectionString) {
    throw new Error("WPI_DATABASE_URL is required to run migrations");
  }
  const pool = new Pool({ connectionString });
  try {
    const result = await applyMigrations(pool);
    console.log(`Applied ${result.applied.length} migration(s): ${result.applied.join(", ") || "none"}`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
