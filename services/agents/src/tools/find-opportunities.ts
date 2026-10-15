import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  findings: z.array(
    z.object({
      finding_id: z.string(),
      rule_id: z.string().optional(),
      result_state: z.string(),
      page_url: z.string().optional(),
    }),
  ),
  keyword_clusters: z.array(
    z.object({
      id: z.string(),
      primary: z.string(),
      keywords: z.array(z.string()),
    }),
  ),
});

export function createFindOpportunitiesTool(): Tool {
  return {
    name: "find_opportunities",
    description:
      "Identifies content opportunities by cross-referencing audit findings with keyword clusters.",
    inputSchema: {
      type: "object",
      properties: {
        findings: { type: "array" },
        keyword_clusters: { type: "array" },
      },
      required: ["findings", "keyword_clusters"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { findings, keyword_clusters } = inputSchema.parse(input);

      const problemFindings = findings.filter(
        (f) => f.result_state === "not_verified" || f.result_state === "inferred",
      );

      const opportunities = problemFindings.map((f, i) => {
        const matchingCluster = keyword_clusters[i % keyword_clusters.length];
        return {
          finding_id: f.finding_id,
          page_url: f.page_url,
          cluster_id: matchingCluster?.id,
          primary_keyword: matchingCluster?.primary,
          opportunity_type: f.result_state,
        };
      });

      return Promise.resolve({
        data: { opportunities },
        source_tier: "first_party",
        limitations: [],
      });
    },
  };
}
