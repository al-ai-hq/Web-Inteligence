import type { Pool } from "pg";
import type { OAuthToken, StoredToken } from "./types.js";
import { encrypt, decrypt } from "./encryption.js";

export class TokenStore {
  constructor(private readonly pool: Pool) {}

  async save(token: OAuthToken): Promise<void> {
    const accessTokenEncrypted = encrypt(token.accessToken);
    const refreshTokenEncrypted = token.refreshToken
      ? encrypt(token.refreshToken)
      : null;

    await this.pool.query(
      `INSERT INTO oauth_tokens (
        user_id, provider, site_url,
        access_token_encrypted, refresh_token_encrypted, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, provider, site_url)
      DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()`,
      [
        token.userId,
        token.provider,
        token.siteUrl,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        token.expiresAt,
      ],
    );
  }

  async findByUserAndSite(
    userId: string,
    provider: string,
    siteUrl: string,
  ): Promise<StoredToken | null> {
    const result = await this.pool.query<StoredToken>(
      `SELECT * FROM oauth_tokens
       WHERE user_id = $1 AND provider = $2 AND site_url = $3`,
      [userId, provider, siteUrl],
    );
    return result.rows[0] ?? null;
  }

  async decryptAccessToken(stored: StoredToken): Promise<string> {
    return decrypt(stored.access_token_encrypted);
  }

  async delete(userId: string, provider: string, siteUrl: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM oauth_tokens
       WHERE user_id = $1 AND provider = $2 AND site_url = $3`,
      [userId, provider, siteUrl],
    );
  }
}
