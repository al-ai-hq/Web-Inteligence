import type { Pool } from "pg";
import { hashPassword, verifyPassword } from "./password.js";
import {
  DuplicateEmailError,
  generateSessionToken,
  hashToken,
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
  SESSION_RENEWAL_THRESHOLD_MS,
  type AuthService,
  type CreatedSession,
  type SessionUser,
} from "./auth-service.js";

export class PgAuthService implements AuthService {
  constructor(private readonly pool: Pool) {}

  async createUser(email: string, password: string): Promise<SessionUser> {
    const normalized = email.trim().toLowerCase();
    const hash = await hashPassword(password);
    try {
      const result = await this.pool.query<{ id: string; email: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [normalized, hash],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error("User insert returned no row");
      }
      return { id: row.id, email: row.email };
    } catch (error) {
      if ("code" in (error as object) && (error as { code: string }).code === "23505") {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<SessionUser | null> {
    const normalized = email.trim().toLowerCase();
    const result = await this.pool.query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [normalized],
    );
    const row = result.rows[0];
    if (!row) {
      await hashPassword(password);
      return null;
    }
    if (!(await verifyPassword(password, row.password_hash))) {
      return null;
    }
    return { id: row.id, email: row.email };
  }

  async createSession(userId: string): Promise<CreatedSession> {
    const token = generateSessionToken();
    const tokenHashValue = hashToken(token);
    const ttlSeconds = SESSION_TTL_MS / 1000;
    const result = await this.pool.query<{ expires_at: Date }>(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2::uuid, now() + make_interval(secs => $3))
       RETURNING expires_at`,
      [tokenHashValue, userId, ttlSeconds],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Session insert returned no row");
    }
    return { token, expiresAt: row.expires_at };
  }

  async getSessionUser(tokenHash: string): Promise<SessionUser | null> {
    const renewalSeconds = SESSION_RENEWAL_THRESHOLD_MS / 1000;
    const ttlSeconds = SESSION_TTL_MS / 1000;

    await this.pool.query(
      `UPDATE sessions
       SET expires_at = now() + make_interval(secs => $2),
           last_seen_at = now()
       WHERE token_hash = $1
         AND expires_at > now()
         AND now() - last_seen_at > make_interval(secs => $3)`,
      [tokenHash, ttlSeconds, renewalSeconds],
    );

    const result = await this.pool.query<{ id: string; email: string }>(
      `SELECT u.id, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash],
    );

    if (!result.rows[0]) {
      await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
      return null;
    }

    const row = result.rows[0];
    return { id: row.id, email: row.email };
  }

  async destroySession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  async findUserById(userId: string): Promise<SessionUser | null> {
    const result = await this.pool.query<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE id = $1",
      [userId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email } : null;
  }

  async createPasswordResetToken(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    const userResult = await this.pool.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [normalized],
    );
    const user = userResult.rows[0];
    if (!user) {
      return null;
    }
    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    const ttlSeconds = PASSWORD_RESET_TTL_MS / 1000;
    await this.pool.query(
      `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
       VALUES ($1, $2::uuid, now() + make_interval(secs => $3))`,
      [tokenHash, user.id, ttlSeconds],
    );
    return token;
  }

  async consumePasswordResetToken(
    token: string,
    newPassword: string,
  ): Promise<boolean> {
    const tokenHash = hashToken(token);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tokenResult = await client.query<{ user_id: string }>(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = $1
           AND expires_at > now()
           AND used_at IS NULL
         FOR UPDATE`,
        [tokenHash],
      );
      const row = tokenResult.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return false;
      }
      const newHash = await hashPassword(newPassword);
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2::uuid", [
        newHash,
        row.user_id,
      ]);
      await client.query(
        "UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1",
        [tokenHash],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
