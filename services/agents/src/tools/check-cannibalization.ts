import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  mappings: z.array(
    z.object({
      cluster_id: z.string(),
      url: z.string(),
    }),
  ),
});

export function createCheckCannibalizationTool(): Tool {
  return {
    name: "check_cannibalization",
    description:
      "Detects when multiple URLs are mapped to the same keyword cluster (cannibalization).",
    inputSchema: {
      type: "object",
      properties: {
        mappings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cluster_id: { type: "string" },
              url: { type: "string" },
            },
            required: ["cluster_id", "url"],
          },
        },
      },
      required: ["mappings"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { mappings } = inputSchema.parse(input);

      const clusterUrls = new Map<string, string[]>();
      for (const m of mappings) {
        const urls = clusterUrls.get(m.cluster_id) ?? [];
        urls.push(m.url);
        clusterUrls.set(m.cluster_id, urls);
      }

      const cannibalized = [...clusterUrls.entries()]
        .filter(([, urls]) => urls.length > 1)
        .map(([cluster_id, urls]) => ({ cluster_id, urls }));

      return Promise.resolve({
        data: { cannibalized },
        source_tier: "first_party",
        limitations: [],
      });
    },
  };
}
