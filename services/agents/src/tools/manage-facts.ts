import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  claim_text: z.string(),
  regulated: z.boolean().optional(),
});

export function createManageFactsTool(): Tool {
  return {
    name: "manage_facts",
    description: "Analyzes a claim for regulated content. Flags health, finance, or legal topics.",
    inputSchema: {
      type: "object",
      properties: {
        claim_text: { type: "string" },
        regulated: { type: "boolean" },
      },
      required: ["claim_text"],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const data = inputSchema.parse(input);
      const { flagRegulatedClaim } = await import("@wpi/fact-manifests");
      const result = flagRegulatedClaim({ statement: data.claim_text });
      return {
        data: { claim_text: data.claim_text, ...result },
        source_tier: "first_party",
        limitations: result.requires_review
          ? [`Regulated topic detected: ${result.topic}. Professional review required.`]
          : [],
      };
    },
  };
}
