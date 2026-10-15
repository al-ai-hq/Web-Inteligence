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
    description:
      "Produces a content brief linked to specific audit evidence and keyword clusters. Checks for cannibalization and normalizes Arabic keywords.",
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
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { opportunity } = inputSchema.parse(input);
      const { normalizeArabicKeyword, checkCannibalization } = await import("@wpi/content-briefs");

      let normalizedKeyword = opportunity.primary_keyword ?? "";
      if (normalizedKeyword) {
        normalizedKeyword = normalizeArabicKeyword(normalizedKeyword);
      }

      const existingMappings = new Map<string, string>();
      const cannibalization = opportunity.cluster_id
        ? checkCannibalization(
            opportunity.cluster_id,
            opportunity.target_url ?? null,
            existingMappings,
          )
        : { ok: true as const };

      return {
        data: {
          brief: {
            target_url: opportunity.target_url,
            primary_keyword: normalizedKeyword,
            cluster_id: opportunity.cluster_id,
            recommended_sections: [
              "Address the gap identified in the audit finding",
              "Include relevant structured data",
              "Optimize for the target keyword cluster",
            ],
          },
          evidence_ids: [opportunity.finding_id],
          cannibalization_check: cannibalization,
        },
        source_tier: "first_party",
        limitations: !cannibalization.ok
          ? ["Cannibalization detected: cluster already mapped to existing page"]
          : [],
      };
    },
  };
}
