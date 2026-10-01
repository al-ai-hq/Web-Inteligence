import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  keywords: z.array(
    z.object({
      query: z.string(),
      clicks: z.number().optional(),
      impressions: z.number().optional(),
      position: z.number().optional(),
    }),
  ),
});

export function createImportKeywordsTool(): Tool {
  return {
    name: "import_keywords",
    description: "Imports a list of keywords with optional metrics (clicks, impressions, position).",
    inputSchema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: {
            type: "object",
            properties: {
              query: { type: "string" },
              clicks: { type: "number" },
              impressions: { type: "number" },
              position: { type: "number" },
            },
            required: ["query"],
          },
        },
      },
      required: ["keywords"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { keywords } = inputSchema.parse(input);
      return Promise.resolve({
        data: { keywords, count: keywords.length },
        source_tier: "first_party",
        limitations: [],
      });
    },
  };
}
