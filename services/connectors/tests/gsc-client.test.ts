import { describe, it, expect, vi, beforeEach } from "vitest";
import { GscClient } from "../src/gsc/client.js";

describe("GscClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("getSearchAnalytics sends correct request", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    } as Response);

    const client = new GscClient("test-token");
    await client.getSearchAnalytics("https://example.com", {
      start: "2026-09-01",
      end: "2026-10-01",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("webmasters/v3/sites"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("getSearchAnalytics throws on non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const client = new GscClient("bad-token");
    await expect(
      client.getSearchAnalytics("https://example.com", {
        start: "2026-09-01",
        end: "2026-10-01",
      }),
    ).rejects.toThrow("GSC Search Analytics API error: 401");
  });

  it("inspectUrl sends correct request", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ inspectionResult: {} }),
    } as Response);

    const client = new GscClient("test-token");
    await client.inspectUrl("https://example.com", "https://example.com/about");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("urlInspection/inspect"),
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("inspectUrl throws on non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const client = new GscClient("bad-token");
    await expect(
      client.inspectUrl("https://example.com", "https://example.com/about"),
    ).rejects.toThrow("GSC URL Inspection API error: 403");
  });
});
