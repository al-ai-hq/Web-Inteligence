import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { DuplicateEmailError, hashToken, SESSION_TTL_MS } from "../src/auth-service.js";
import { PgAuthService } from "../src/pg-auth-service.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PgAuthService", () => {
  let pool: Pool;
  let auth: PgAuthService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("DROP TABLE IF EXISTS password_reset_tokens CASCADE");
    await pool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    const usersSql = await readFile(
      new URL(
        "../../audit-pipeline/src/migrations/0016_create_users_sessions.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const tokensSql = await readFile(
      new URL(
        "../../audit-pipeline/src/migrations/0018_password_reset_tokens.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pool.query(usersSql);
    await pool.query(tokensSql);
    auth = new PgAuthService(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and verifies a user", async () => {
    const email = `pg-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    expect(user.email).toBe(email);
    const verified = await auth.verifyCredentials(email, "password123");
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe(user.id);
  });

  it("rejects duplicate email", async () => {
    const email = `pg-${randomUUID()}@example.com`;
    await auth.createUser(email, "password123");
    await expect(auth.createUser(email, "other-pass")).rejects.toThrow(DuplicateEmailError);
  });

  it("returns null for unknown email with latency", async () => {
    const started = Date.now();
    const result = await auth.verifyCredentials(`unknown-${randomUUID()}@example.com`, "pass");
    expect(result).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });

  it("full session lifecycle", async () => {
    const email = `pg-sess-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    const session = await auth.createSession(user.id);
    expect(session.token).toMatch(/^[0-9a-f]{64}$/);

    const found = await auth.getSessionUser(hashToken(session.token));
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);

    await auth.destroySession(hashToken(session.token));
    expect(await auth.getSessionUser(hashToken(session.token))).toBeNull();
  });

  it("returns null for expired session and deletes the row", async () => {
    const email = `pg-exp-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    const session = await auth.createSession(user.id);
    const tokenHash = hashToken(session.token);

    await pool.query(
      "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
      [tokenHash],
    );

    expect(await auth.getSessionUser(tokenHash)).toBeNull();
    const check = await pool.query("SELECT 1 FROM sessions WHERE token_hash = $1", [tokenHash]);
    expect(check.rowCount).toBe(0);
  });

  it("creates and consumes a password reset token", async () => {
    const email = `pg-reset-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    const token = await auth.createPasswordResetToken(email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const ok = await auth.consumePasswordResetToken(token!, "new-password-123");
    expect(ok).toBe(true);

    const verified = await auth.verifyCredentials(email, "new-password-123");
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe(user.id);
  });

  it("returns null token for unknown email", async () => {
    const token = await auth.createPasswordResetToken(`missing-${randomUUID()}@example.com`);
    expect(token).toBeNull();
  });

  it("rejects a reused token", async () => {
    const email = `pg-reset-reuse-${randomUUID()}@example.com`;
    await auth.createUser(email, "password123");
    const token = await auth.createPasswordResetToken(email);
    await auth.consumePasswordResetToken(token!, "new-password-123");
    const ok = await auth.consumePasswordResetToken(token!, "another-password");
    expect(ok).toBe(false);
  });
});
