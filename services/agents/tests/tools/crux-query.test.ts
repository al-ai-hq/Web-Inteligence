import { describe, it, expect, vi } from "vitest";
import { createCruxQueryTool } from "../../src/tools/crux-query.js";
import type { ToolContext } from "../../src/tools/types.js";

describe("crux_query", () => {
  it("calls CrUX API and returns real-user metrics", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record: {
          metrics: {
            largest_contentful_paint: { percentiles: { p75: 2500 } },
            cumulative_layout_shift: { percentiles: { p75: 0.1 } },
          },
        },
      }),
    });

    const tool = createCruxQueryTool(mockFetch, "test-api-key");
    const ctx: ToolContext = { audit_id: "a-1", project_id: "p-1", evidence_bucket: "b" } as ToolContext;

    const result = await tool.execute({ url: "https://example.com" }, ctx);
    expect(result.source_tier).toBe("third_party_verified");
    expect(result.data).toHaveProperty("lcp_p75", 2500);
  });

  it("returns limitation when origin not in CrUX dataset", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 });

    const tool = createCruxQueryTool(mockFetch, "test-api-key");
    const ctx: ToolContext = { audit_id: "a-1", project_id: "p-1", evidence_bucket: "b" } as ToolContext;

    const result = await tool.execute({ url: "https://obscure-site.example" }, ctx);
    expect(result.limitations).toContain("Origin not found in CrUX dataset");
  });
});
