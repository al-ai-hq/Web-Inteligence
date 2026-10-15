import { describe, it, expect } from "vitest";
import { createImportKeywordsTool } from "../../src/tools/import-keywords.js";
import { createClusterKeywordsTool } from "../../src/tools/cluster-keywords.js";
import { createMapKeywordsTool } from "../../src/tools/map-keywords.js";
import { createCheckCannibalizationTool } from "../../src/tools/check-cannibalization.js";
import type { ToolContext } from "../../src/tools/types.js";

const ctx: ToolContext = {
  audit_id: "a-1",
  project_id: "p-1",
  evidence_bucket: "b",
} as ToolContext;

describe("import_keywords", () => {
  it("accepts a keyword list and returns structured data", async () => {
    const tool = createImportKeywordsTool();
    const result = await tool.execute(
      {
        keywords: [
          { query: "seo tips", clicks: 100, impressions: 1000, position: 3.2 },
          { query: "audit tools", clicks: 50, impressions: 500, position: 5.1 },
        ],
      },
      ctx,
    );
    expect(result.source_tier).toBe("first_party");
    expect((result.data as Record<string, unknown>).count).toBe(2);
  });
});

describe("cluster_keywords", () => {
  it("groups keywords by intent similarity", async () => {
    const tool = createClusterKeywordsTool();
    const result = await tool.execute(
      {
        keywords: [
          { query: "seo tips", intent: "informational" },
          { query: "how to improve seo", intent: "informational" },
          { query: "buy seo tools", intent: "transactional" },
        ],
      },
      ctx,
    );
    const data = result.data as { clusters: Array<{ keywords: string[] }> };
    expect(data.clusters.length).toBeGreaterThanOrEqual(2);
  });
});

describe("map_keywords", () => {
  it("maps keyword clusters to URLs", async () => {
    const tool = createMapKeywordsTool();
    const result = await tool.execute(
      {
        clusters: [{ id: "c1", keywords: ["seo tips", "how to seo"], primary: "seo tips" }],
        urls: [{ url: "https://example.com/seo-guide", title: "SEO Guide" }],
      },
      ctx,
    );
    expect(result.source_tier).toBe("first_party");
    expect((result.data as Record<string, unknown>).mappings).toBeDefined();
  });
});

describe("check_cannibalization", () => {
  it("detects when multiple URLs target the same cluster", async () => {
    const tool = createCheckCannibalizationTool();
    const result = await tool.execute(
      {
        mappings: [
          { cluster_id: "c1", url: "https://example.com/page-a" },
          { cluster_id: "c1", url: "https://example.com/page-b" },
        ],
      },
      ctx,
    );
    const data = result.data as { cannibalized: Array<{ cluster_id: string; urls: string[] }> };
    expect(data.cannibalized).toHaveLength(1);
    expect(data.cannibalized[0]!.cluster_id).toBe("c1");
  });

  it("returns empty when no cannibalization", async () => {
    const tool = createCheckCannibalizationTool();
    const result = await tool.execute(
      {
        mappings: [
          { cluster_id: "c1", url: "https://example.com/page-a" },
          { cluster_id: "c2", url: "https://example.com/page-b" },
        ],
      },
      ctx,
    );
    const data = result.data as { cannibalized: unknown[] };
    expect(data.cannibalized).toHaveLength(0);
  });
});
