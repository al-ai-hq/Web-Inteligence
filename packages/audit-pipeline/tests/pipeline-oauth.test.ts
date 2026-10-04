import { describe, it, expect } from "vitest";
import { runAuditPipeline } from "../src/pipeline.js";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext, ConnectorResult } from "@wpi/connectors";
import type { TokenStore } from "@wpi/oauth";

class InMemoryTokenStore {
  private tokens = new Map<string, { accessToken: string }>();

  async save(opts: {
    userId: string;
    provider: string;
    siteUrl: string;
    accessToken: string;
    expiresAt: Date;
  }): Promise<void> {
    this.tokens.set(
      `${opts.userId}:${opts.provider}:${opts.siteUrl}`,
      { accessToken: opts.accessToken },
    );
  }

  async findByUserAndSite(
    userId: string,
    provider: string,
    siteUrl: string,
  ): Promise<{ access_token_encrypted: Buffer } | null> {
    const key = `${userId}:${provider}:${siteUrl}`;
    const token = this.tokens.get(key);
    if (!token) return null;
    return { access_token_encrypted: Buffer.from(token.accessToken) };
  }

  async decryptAccessToken(stored: {
    access_token_encrypted: Buffer;
  }): Promise<string> {
    return stored.access_token_encrypted.toString("utf8");
  }
}

describe("pipeline with OAuth tokens", () => {
  it("passes auth context to connectors when token exists", async () => {
    const store = new InMemoryAuditStore();
    const tokenStore = new InMemoryTokenStore();

    await tokenStore.save({
      userId: "user-1",
      provider: "google",
      siteUrl: "https://example.com",
      accessToken: "test-access-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      tier: "rich",
      context: {
        organization: "Test",
        business_type: "test",
        offering: "test",
        market: "test",
        customer_language: "English",
        audience: "test",
      },
      secretHash: "sha256:" + "a".repeat(64),
      ttlDays: 7,
    });
    const auditId = record.id;

    let capturedContext: AuditContext | undefined;
    await runAuditPipeline(
      {
        store,
        tokenStore: tokenStore as unknown as TokenStore,
        userId: "user-1",
        validateUrl: async () => ({ ok: true }),
        crawl: async () => {},
        render: async () => {},
        processEvidence: async () => [],
        runAgents: async () => [],
        runConnectors: async (_url: string, context: AuditContext) => {
          capturedContext = context;
          return [];
        },
        tierScopes: {
          free: {
            comparisons: 0,
            aiVisibilityPanel: false,
            maxPages: 1,
            actionBoardCap: 5,
          },
          rich: {
            comparisons: 3,
            aiVisibilityPanel: true,
            maxPages: 10,
            actionBoardCap: 20,
          },
          reduced: {
            comparisons: 1,
            aiVisibilityPanel: false,
            maxPages: 5,
            actionBoardCap: 10,
          },
          preview: {
            comparisons: 0,
            aiVisibilityPanel: false,
            maxPages: 1,
            actionBoardCap: 5,
          },
        },
      },
      auditId,
    );

    expect(capturedContext?.auth?.google?.accessToken).toBe(
      "test-access-token",
    );
  });

  it("continues without auth when no token exists", async () => {
    const store = new InMemoryAuditStore();
    const tokenStore = new InMemoryTokenStore();

    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      tier: "rich",
      context: {
        organization: "Test",
        business_type: "test",
        offering: "test",
        market: "test",
        customer_language: "English",
        audience: "test",
      },
      secretHash: "sha256:" + "a".repeat(64),
      ttlDays: 7,
    });
    const auditId = record.id;

    let capturedContext: AuditContext | undefined;
    await runAuditPipeline(
      {
        store,
        tokenStore: tokenStore as unknown as TokenStore,
        userId: "user-1",
        validateUrl: async () => ({ ok: true }),
        crawl: async () => {},
        render: async () => {},
        processEvidence: async () => [],
        runAgents: async () => [],
        runConnectors: async (_url: string, context: AuditContext) => {
          capturedContext = context;
          return [];
        },
        tierScopes: {
          free: {
            comparisons: 0,
            aiVisibilityPanel: false,
            maxPages: 1,
            actionBoardCap: 5,
          },
          rich: {
            comparisons: 3,
            aiVisibilityPanel: true,
            maxPages: 10,
            actionBoardCap: 20,
          },
          reduced: {
            comparisons: 1,
            aiVisibilityPanel: false,
            maxPages: 5,
            actionBoardCap: 10,
          },
          preview: {
            comparisons: 0,
            aiVisibilityPanel: false,
            maxPages: 1,
            actionBoardCap: 5,
          },
        },
      },
      auditId,
    );

    expect(capturedContext?.auth).toBeUndefined();
  });
});
