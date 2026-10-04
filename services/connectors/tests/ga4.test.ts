import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Ga4Connector } from "../src/ga4/connector.js";
import type { AuditContext } from "../src/types.js";

describe("Ga4Connector", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    process.env["WPI_GA4_PROPERTY_ID"] = "123456";
  });

  afterEach(() => {
    delete process.env["WPI_GA4_PROPERTY_ID"];
  });

  it("returns unavailable when auth is missing", async () => {
    const connector = new Ga4Connector();
    const context: AuditContext = { locale: "en", tier: "rich" };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe("unavailable.auth.missing");
    }
  });

  it("returns unavailable when property ID is not configured", async () => {
    delete process.env["WPI_GA4_PROPERTY_ID"];
    const connector = new Ga4Connector();
    const context: AuditContext = {
      locale: "en",
      tier: "rich",
      auth: { google: { accessToken: "test-token" } },
    };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe("unavailable.ga4.property_not_configured");
    }
  });

  it("returns unavailable when API fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const connector = new Ga4Connector();
    const context: AuditContext = {
      locale: "en",
      tier: "rich",
      auth: { google: { accessToken: "test-token" } },
    };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe("unavailable.connector.ga4");
    }
  });

  it("returns GA4 data on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          {
            dimensionValues: [{ value: "/about" }],
            metricValues: [
              { value: "100" },
              { value: "80" },
              { value: "45" },
              { value: "0.3" },
              { value: "50" },
              { value: "20" },
            ],
          },
        ],
        metadata: { timezone: "America/New_York" },
      }),
    } as Response);

    const connector = new Ga4Connector();
    const context: AuditContext = {
      locale: "en",
      tier: "rich",
      auth: { google: { accessToken: "test-token" } },
    };
    const result = await connector.run("https://example.com", context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ga4).toBeDefined();
      expect(result.data.ga4!.pages).toHaveLength(1);
      expect(result.data.ga4!.pages[0]!.pageviews).toBe(100);
      expect(result.data.ga4!.timezone).toBe("America/New_York");
    }
  });
});
