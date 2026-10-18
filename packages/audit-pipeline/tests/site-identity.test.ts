import { describe, expect, it } from "vitest";
import type { AuditContext } from "../src/audit-context.js";
import type { AuditRecord, AuditStore } from "../src/audit-store.js";
import { deriveSiteStage, normalizeDomain } from "../src/site-identity.js";

const CONTEXT: AuditContext = {
  organization: "Acme",
  business_type: "saas",
  offering: "Workflow software",
  market: "Jordan",
  customer_language: "en",
  audience: "Operations teams",
};

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: "audit-1",
    target_url: "https://example.com/",
    locale: "en",
    context: CONTEXT,
    tier: "rich",
    status: "READY_COMPLETE",
    secret_hash: "h",
    user_id: "user-1",
    failure_reason: null,
    report: null,
    costs: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function storeWith(records: AuditRecord[]): AuditStore {
  return { listByUser: () => Promise.resolve(records) } as unknown as AuditStore;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("normalizeDomain", () => {
  it("ignores scheme, path and www", () => {
    expect(normalizeDomain("http://www.Example.com/products?utm_source=x")).toBe("example.com");
    expect(normalizeDomain("https://example.com:8443/")).toBe("example.com");
  });

  it("keeps subdomains distinct", () => {
    expect(normalizeDomain("https://blog.example.com/")).toBe("blog.example.com");
  });

  it("returns null for a value that is not a URL", () => {
    expect(normalizeDomain("not a url")).toBeNull();
  });
});

describe("deriveSiteStage", () => {
  it("falls back to growth for anonymous audits, which have no history", async () => {
    const stage = await deriveSiteStage(storeWith([]), null, "https://example.com/", "a-1");
    expect(stage).toBe("growth");
  });

  it("falls back to growth when the target cannot be parsed", async () => {
    const stage = await deriveSiteStage(
      storeWith([]),
      "user-1",
      "not a url",
      "a-1",
    );
    expect(stage).toBe("growth");
  });

  it("reports new when the domain has no earlier completed audit", async () => {
    const stage = await deriveSiteStage(
      storeWith([
        record({ id: "a-1" }),
        record({ id: "a-2", status: "FAILED" }),
        record({ id: "a-3", target_url: "https://other.com/" }),
      ]),
      "user-1",
      "https://www.example.com/",
      "a-1",
    );
    expect(stage).toBe("new");
  });

  it("ignores the audit currently being scored", async () => {
    const stage = await deriveSiteStage(
      storeWith([record({ id: "a-1", created_at: daysAgo(700) })]),
      "user-1",
      "https://example.com/",
      "a-1",
    );
    expect(stage).toBe("new");
  });

  it("scores by the age of the oldest completed audit on the domain", async () => {
    const store = storeWith([
      record({ id: "old", target_url: "http://www.example.com/", created_at: daysAgo(400) }),
      record({ id: "new", target_url: "https://example.com/blog", created_at: daysAgo(10) }),
    ]);

    expect(await deriveSiteStage(store, "user-1", "https://example.com/", "current")).toBe("growth");
  });

  it("reports mature past three years", async () => {
    const store = storeWith([record({ id: "old", created_at: daysAgo(1200) })]);
    expect(await deriveSiteStage(store, "user-1", "https://example.com/", "current")).toBe("mature");
  });
});
