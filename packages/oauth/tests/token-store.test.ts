import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TokenStore } from "../src/token-store.js";
import type { OAuthToken } from "../src/types.js";

describe("TokenStore", () => {
  let store: TokenStore;
  let queries: Array<{ text: string; values: unknown[] }>;

  beforeEach(() => {
    process.env["WPI_OAUTH_ENCRYPTION_KEY"] = Buffer.alloc(32, "a").toString("base64");
    queries = [];
    const mockPool = {
      query: async (text: string, values: unknown[]) => {
        queries.push({ text, values });
        return { rows: [] };
      },
    };
    store = new TokenStore(mockPool as never);
  });

  afterEach(() => {
    delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
  });

  it("save encrypts tokens and upserts", async () => {
    const token: OAuthToken = {
      userId: "user-1",
      provider: "google",
      siteUrl: "https://example.com",
      accessToken: "access-token-123",
      refreshToken: "refresh-token-456",
      expiresAt: new Date("2026-10-05T00:00:00Z"),
    };

    await store.save(token);

    expect(queries).toHaveLength(1);
    expect(queries[0]!.text).toContain("INSERT INTO oauth_tokens");
    expect(queries[0]!.text).toContain("ON CONFLICT");
    expect(queries[0]!.values[0]).toBe("user-1");
    expect(queries[0]!.values[1]).toBe("google");
    expect(queries[0]!.values[2]).toBe("https://example.com");
    expect(Buffer.isBuffer(queries[0]!.values[3])).toBe(true);
    expect(Buffer.isBuffer(queries[0]!.values[4])).toBe(true);
  });

  it("findByUserAndSite returns null when not found", async () => {
    const result = await store.findByUserAndSite("user-1", "google", "https://example.com");
    expect(result).toBeNull();
  });

  it("findByUserAndSite returns row when found", async () => {
    const mockRow = {
      id: "uuid-1",
      user_id: "user-1",
      provider: "google",
      site_url: "https://example.com",
      access_token_encrypted: Buffer.from("encrypted"),
      expires_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    const mockPool = {
      query: async () => ({ rows: [mockRow] }),
    };
    const storeWithRow = new TokenStore(mockPool as never);

    const result = await storeWithRow.findByUserAndSite("user-1", "google", "https://example.com");
    expect(result).toEqual(mockRow);
  });

  it("decryptAccessToken decrypts the stored token", async () => {
    const { encrypt } = await import("../src/encryption.js");
    const encrypted = encrypt("my-access-token");
    const stored = {
      id: "uuid-1",
      user_id: "user-1",
      provider: "google",
      site_url: "https://example.com",
      access_token_encrypted: encrypted,
      refresh_token_encrypted: null,
      expires_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await store.decryptAccessToken(stored);
    expect(result).toBe("my-access-token");
  });

  it("delete removes the token", async () => {
    await store.delete("user-1", "google", "https://example.com");
    expect(queries).toHaveLength(1);
    expect(queries[0]!.text).toContain("DELETE FROM oauth_tokens");
  });
});
