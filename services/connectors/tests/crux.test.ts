// services/connectors/tests/crux.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CruxConnector } from "../src/crux/index.js";

describe("CruxConnector", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches CrUX data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        record: {
          key: { origin: "https://example.com" },
          metrics: {
            largest_contentful_paint: {
              good: { percent: 75 },
              needs_improvement: { percent: 20 },
              poor: { percent: 5 },
            },
            first_input_delay: {
              good: { percent: 90 },
              needs_improvement: { percent: 8 },
              poor: { percent: 2 },
            },
            cumulative_layout_shift: {
              good: { percent: 80 },
              needs_improvement: { percent: 15 },
              poor: { percent: 5 },
            },
            effective_connection_type: {
              category: "4G",
            },
          },
        },
      }),
    } as Response);

    const connector = new CruxConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.crux).toBeDefined();
      expect(result.data.crux?.metrics.lcp.good).toBe(75);
    }
  });

  it("handles API error gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const connector = new CruxConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe(
        "unavailable.connector.crux.api_error",
      );
    }
  });
});
