import { describe, it, expect } from "vitest";
import { createFindOpportunitiesTool } from "../../src/tools/find-opportunities.js";
import { createWriteBriefTool } from "../../src/tools/write-brief.js";
import { createDraftArticleTool } from "../../src/tools/draft-article.js";
import type { ToolContext } from "../../src/tools/types.js";

const ctx: ToolContext = { audit_id: "a-1", project_id: "p-1", evidence_bucket: "b" } as ToolContext;

describe("find_opportunities", () => {
  it("identifies content opportunities from findings and keywords", async () => {
    const tool = createFindOpportunitiesTool();
    const result = await tool.execute(
      {
        findings: [
          { finding_id: "f-1", rule_id: "AEO-001", result_state: "not_verified", page_url: "https://example.com/page-a" },
        ],
        keyword_clusters: [
          { id: "c1", primary: "faq examples", keywords: ["faq examples", "faq templates"] },
        ],
      },
      ctx,
    );
    expect(result.source_tier).toBe("first_party");
    expect((result.data as Record<string, unknown>).opportunities).toBeDefined();
  });
});

describe("write_brief", () => {
  it("produces a content brief linked to evidence", async () => {
    const tool = createWriteBriefTool();
    const result = await tool.execute(
      {
        opportunity: {
          finding_id: "f-1",
          cluster_id: "c1",
          target_url: "https://example.com/page-a",
          primary_keyword: "faq examples",
        },
      },
      ctx,
    );
    expect(result.source_tier).toBe("first_party");
    const data = result.data as Record<string, unknown>;
    expect(data.brief).toBeDefined();
    expect(data.evidence_ids).toEqual(["f-1"]);
  });
});

describe("draft_article", () => {
  it("creates a draft from an approved brief", async () => {
    const tool = createDraftArticleTool();
    const result = await tool.execute(
      {
        brief_id: "brief-1",
        title: "FAQ Examples Guide",
        target_keyword: "faq examples",
        outline: ["Introduction", "Top 10 FAQ Examples", "Conclusion"],
      },
      ctx,
    );
    expect(result.source_tier).toBe("first_party");
    const data = result.data as Record<string, unknown>;
    expect(data.draft_id).toBeDefined();
    expect(data.status).toBe("draft");
  });

  it("rejects draft without approved brief", async () => {
    const tool = createDraftArticleTool();
    const result = await tool.execute(
      {
        brief_id: "",
        title: "Test",
        target_keyword: "test",
        outline: [],
      },
      ctx,
    );
    expect(result.limitations).toContain("Approved brief required");
  });
});
