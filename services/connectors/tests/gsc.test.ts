import { describe, it, expect, vi, beforeEach } from "vitest";
import { GscConnector } from "../src/gsc/connector.js";
import type { AuditContext } from "../src/types.js";

describe("GscConnector", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("returns unavailable when auth is missing", async () => {
    const connector = new GscConnector();
    const context: AuditContext = { locale: "en", tier: "rich" };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe("unavailable.auth.missing");
    }
  });

  it("returns unavailable when API fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const connector = new GscConnector();
    const context: AuditContext = {
      locale: "en",
      tier: "rich",
      auth: { google: { accessToken: "test-token" } },
    };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe("unavailable.connector.gsc");
    }
  });

  it("returns GSC data on success", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("searchAnalytics")) {
        return {
          ok: true,
          json: async () => ({
            rows: [
              {
                keys: ["query1", "https://example.com/", "usa"],
                clicks: 10,
                impressions: 100,
                ctr: 0.1,
                position: 3.5,
              },
            ],
          }),
        } as Response;
      }
      if (urlStr.includes("urlInspection")) {
        return {
          ok: true,
          json: async () => ({
            inspectionResult: {
              indexStatusResult: { verdict: "VERDICT_PASSED" },
            },
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const connector = new GscConnector();
    const context: AuditContext = {
      locale: "en",
      tier: "rich",
      auth: { google: { accessToken: "test-token" } },
    };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.gsc).toBeDefined();
      expect(result.data.gsc!.search_analytics.totals.clicks).toBe(10);
      expect(result.data.gsc!.index_coverage.important_pages_total).toBe(2);
    }
  });
});
