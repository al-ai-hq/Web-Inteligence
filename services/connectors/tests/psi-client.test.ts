// services/connectors/tests/psi-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPsiData } from "../src/psi/client.js";

describe("fetchPsiData", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches PSI data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          audits: {
            "largest-contentful-paint": { numericValue: 2500 },
            "max-potential-fid": { numericValue: 100 },
            "cumulative-layout-shift": { numericValue: 0.1 },
            "render-blocking-resources": {
              id: "render-blocking-resources",
              title: "Eliminate render-blocking resources",
              numericValue: 350,
            },
          },
        },
      }),
    } as Response);

    const data = await fetchPsiData("https://example.com", "test-key");
    expect(data.core_web_vitals.lcp).toBe(2500);
    expect(data.core_web_vitals.fid).toBe(100);
    expect(data.core_web_vitals.cls).toBe(0.1);
    expect(data.opportunities).toHaveLength(1);
  });

  it("throws on API error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchPsiData("https://example.com", "test-key")).rejects.toThrow(
      "PSI API returned 500",
    );
  });
});
