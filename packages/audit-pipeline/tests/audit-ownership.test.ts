import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryAuditStore,
  hashAuditSecret,
  generateAuditSecret,
  type AuditContext,
} from "../src/index.js";

const CONTEXT: AuditContext = {
  organization: "Test Org",
  business_type: "saas",
  offering: "Tooling",
  market: "Global",
  customer_language: "English",
  audience: "Developers",
};

describe("InMemoryAuditStore ownership", () => {
  it("sets expires_at to null and user_id for owned audits", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
      userId: "user-1",
    });
    expect(record.user_id).toBe("user-1");
    expect(record.expires_at).toBeNull();
  });

  it("keeps 7-day expiry and null user_id for anonymous audits", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "preview",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
    });
    expect(record.user_id).toBeNull();
    expect(record.expires_at).not.toBeNull();
  });

  it("getActive returns owned audit as alive", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
      userId: "user-1",
    });
    const result = await store.getActive(record.id);
    expect(result).not.toBe("not_found");
    expect(result).not.toBe("deleted");
    expect(result).not.toBe("expired");
  });

  it("listByUser returns newest-first and excludes soft-deleted", async () => {
    const store = new InMemoryAuditStore();
    const s1 = generateAuditSecret();
    const r1 = await store.create({
      targetUrl: "https://example.com/1",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s1),
      ttlDays: 7,
      userId: "user-1",
    });
    await new Promise((r) => setTimeout(r, 2));
    const s2 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com/2",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s2),
      ttlDays: 7,
      userId: "user-1",
    });
    await store.softDelete(r1.id);

    const records = await store.listByUser("user-1");
    expect(records).toHaveLength(1);
    expect(records[0]!.target_url).toBe("https://example.com/2");
  });

  it("listByUser isolates between users", async () => {
    const store = new InMemoryAuditStore();
    const s1 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s1),
      ttlDays: 7,
      userId: "user-1",
    });
    const s2 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s2),
      ttlDays: 7,
      userId: "user-2",
    });

    expect(await store.listByUser("user-1")).toHaveLength(1);
    expect(await store.listByUser("user-2")).toHaveLength(1);
    expect(await store.listByUser("user-3")).toHaveLength(0);
  });

  it("sweepExpired skips owned audits (null expires_at)", async () => {
    vi.useFakeTimers();
    try {
      const store = new InMemoryAuditStore();
      const s1 = generateAuditSecret();
      const owned = await store.create({
        targetUrl: "https://example.com/owned",
        locale: "en",
        context: CONTEXT,
        tier: "rich",
        secretHash: hashAuditSecret(s1),
        ttlDays: 7,
        userId: "user-1",
      });
      const s2 = generateAuditSecret();
      const anon = await store.create({
        targetUrl: "https://example.com/anon",
        locale: "en",
        context: CONTEXT,
        tier: "preview",
        secretHash: hashAuditSecret(s2),
        ttlDays: 7,
      });

      vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
      await store.sweepExpired();

      const ownedRaw = await store.getRaw(owned.id);
      expect(ownedRaw!.status).not.toBe("EXPIRED");
      const anonRaw = await store.getRaw(anon.id);
      expect(anonRaw!.status).toBe("EXPIRED");
    } finally {
      vi.useRealTimers();
    }
  });
});
