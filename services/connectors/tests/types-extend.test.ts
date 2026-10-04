import { describe, it, expect } from "vitest";
import type { AuditContext, GscData, Ga4Data, ConnectorData } from "../src/types.js";

describe("connector types extension", () => {
  it("AuditContext accepts optional auth", () => {
    const context: AuditContext = {
      locale: "en",
      tier: "rich",
      auth: { google: { accessToken: "test-token" } },
    };
    expect(context.auth?.google?.accessToken).toBe("test-token");
  });

  it("AuditContext works without auth (backwards compatible)", () => {
    const context: AuditContext = { locale: "en", tier: "free" };
    expect(context.auth).toBeUndefined();
  });

  it("ConnectorData accepts gsc and ga4", () => {
    const data: ConnectorData = {
      gsc: {
        search_analytics: {
          date_range: { start: "2026-09-01", end: "2026-10-01" },
          totals: { queries: 10, clicks: 5, impressions: 100, ctr: 0.05, average_position: 3.2 },
          by_page: [],
          by_country: [],
          top_queries: [],
        },
        index_coverage: { important_pages_total: 2, important_pages_indexed: 2, indexed_ratio: 1 },
      },
    };
    expect(data.gsc).toBeDefined();
  });

  it("Ga4Data has correct shape", () => {
    const data: Ga4Data = {
      date_range: { start: "2026-09-01", end: "2026-10-01" },
      timezone: "UTC",
      pages: [
        {
          url: "/about",
          pageviews: 100,
          unique_pageviews: 80,
          average_time_on_page_seconds: 45,
          bounce_rate: 0.3,
          entrances: 50,
          exits: 20,
        },
      ],
    };
    expect(data.pages).toHaveLength(1);
  });
});
