import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  opportunity: z.object({
    finding_id: z.string(),
    cluster_id: z.string().optional(),
    target_url: z.string().optional(),
    primary_keyword: z.string().optional(),
  }),
});

export function createWriteBriefTool(): Tool {
  return {
    name: "write_brief",
    description: "Produces a content brief linked to specific audit evidence and keyword clusters.",
    inputSchema: {
      type: "object",
      properties: {
        opportunity: {
          type: "object",
          properties: {
            finding_id: { type: "string" },
            cluster_id: { type: "string" },
            target_url: { type: "string" },
            primary_keyword: { type: "string" },
          },
          required: ["finding_id"],
        },
      },
      required: ["opportunity"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { opportunity } = inputSchema.parse(input);

      return Promise.resolve({
        data: {
          brief: {
            target_url: opportunity.target_url,
            primary_keyword: opportunity.primary_keyword,
            cluster_id: opportunity.cluster_id,
            recommended_sections: [
              "Address the gap identified in the audit finding",
              "Include relevant structured data",
              "Optimize for the target keyword cluster",
            ],
          },
          evidence_ids: [opportunity.finding_id],
        },
        source_tier: "first_party",
        limitations: [],
      });
    },
  };
}
