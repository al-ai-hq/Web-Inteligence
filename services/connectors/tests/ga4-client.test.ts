import { describe, it, expect, vi, beforeEach } from "vitest";
import { Ga4Client } from "../src/ga4/client.js";

describe("Ga4Client", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("getPageMetrics sends correct request", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    } as Response);

    const client = new Ga4Client("test-token", "123456");
    await client.getPageMetrics({ start: "2026-09-01", end: "2026-10-01" }, [
      "https://example.com/about",
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("properties/123456:runReport"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("getPageMetrics throws on non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const client = new Ga4Client("bad-token", "123456");
    await expect(
      client.getPageMetrics({ start: "2026-09-01", end: "2026-10-01" }, [
        "https://example.com/about",
      ]),
    ).rejects.toThrow("GA4 Data API error: 403");
  });

  it("getPageMetrics extracts page paths from URLs", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    } as Response);

    const client = new Ga4Client("test-token", "123456");
    await client.getPageMetrics({ start: "2026-09-01", end: "2026-10-01" }, [
      "https://example.com/about",
      "https://example.com/contact",
    ]);

    const callBody = JSON.parse(vi.mocked(global.fetch).mock.calls[0]![1]!.body as string);
    expect(callBody.dimensionFilter.filter.inListFilter.values).toEqual(["/about", "/contact"]);
  });
});
