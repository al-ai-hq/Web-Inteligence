// services/connectors/tests/crux-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCruxData } from "../src/crux/client.js";

describe("fetchCruxData", () => {
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

    const data = await fetchCruxData("https://example.com");
    expect(data.metrics.lcp.good).toBe(75);
    expect(data.metrics.fid.needs_improvement).toBe(8);
    expect(data.metrics.cls.poor).toBe(5);
    expect(data.origin).toBe("https://example.com");
    expect(data.effective_connection_type).toBe("4G");
  });

  it("throws on API error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchCruxData("https://example.com")).rejects.toThrow("CrUX API returned 404");
  });
});
