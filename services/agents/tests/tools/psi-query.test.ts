import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPsiQueryTool } from "../../src/tools/psi-query.js";
import type { ToolContext } from "../../src/tools/types.js";

describe("psi_query", () => {
  it("calls PageSpeed Insights API and returns scores", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
            accessibility: { score: 0.92 },
          },
          audits: {
            "first-contentful-paint": { displayValue: "1.2 s", score: 0.9 },
          },
        },
      }),
    });

    const tool = createPsiQueryTool(mockFetch, "test-api-key");
    const ctx: ToolContext = {
      audit_id: "a-1",
      project_id: "p-1",
      evidence_bucket: "b",
    } as ToolContext;

    const result = await tool.execute({ url: "https://example.com", strategy: "mobile" }, ctx);
    expect(result.source_tier).toBe("third_party_verified");
    expect(result.data).toHaveProperty("performance_score", 0.85);
  });

  it("returns limitation on API failure", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });

    const tool = createPsiQueryTool(mockFetch, "test-api-key");
    const ctx: ToolContext = {
      audit_id: "a-1",
      project_id: "p-1",
      evidence_bucket: "b",
    } as ToolContext;

    const result = await tool.execute({ url: "https://example.com", strategy: "mobile" }, ctx);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
