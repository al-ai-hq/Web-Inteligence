import { describe, it, expect, vi } from "vitest";
import { createGscQueryTool } from "../../src/tools/gsc-query.js";
import type { ToolContext } from "../../src/tools/types.js";

describe("gsc_query", () => {
  it("calls Search Console API and returns query data", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [
          { keys: ["seo tips"], clicks: 150, impressions: 1200, ctr: 0.125, position: 3.2 },
          { keys: ["audit tools"], clicks: 80, impressions: 800, ctr: 0.1, position: 5.1 },
        ],
      }),
    });

    const tool = createGscQueryTool(mockFetch, "test-token");
    const ctx: ToolContext = { audit_id: "a-1", project_id: "p-1", evidence_bucket: "b" } as ToolContext;

    const result = await tool.execute(
      { site_url: "https://example.com", start_date: "2026-09-01", end_date: "2026-09-30" },
      ctx,
    );
    expect(result.source_tier).toBe("first_party");
    expect((result.data as Record<string, unknown>).rows).toHaveLength(2);
  });

  it("returns limitation on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 });

    const tool = createGscQueryTool(mockFetch, "test-token");
    const ctx: ToolContext = { audit_id: "a-1", project_id: "p-1", evidence_bucket: "b" } as ToolContext;

    const result = await tool.execute(
      { site_url: "https://example.com", start_date: "2026-09-01", end_date: "2026-09-30" },
      ctx,
    );
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
