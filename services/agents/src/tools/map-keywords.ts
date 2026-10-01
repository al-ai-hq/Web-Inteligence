import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  clusters: z.array(
    z.object({
      id: z.string(),
      keywords: z.array(z.string()),
      primary: z.string(),
    }),
  ),
  urls: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional(),
    }),
  ),
});

export function createMapKeywordsTool(): Tool {
  return {
    name: "map_keywords",
    description: "Maps keyword clusters to the most relevant URLs.",
    inputSchema: {
      type: "object",
      properties: {
        clusters: { type: "array" },
        urls: { type: "array" },
      },
      required: ["clusters", "urls"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { clusters, urls } = inputSchema.parse(input);

      const mappings = clusters.map((cluster) => ({
        cluster_id: cluster.id,
        primary_keyword: cluster.primary,
        mapped_url: urls[0]?.url ?? null,
      }));

      return Promise.resolve({
        data: { mappings },
        source_tier: "first_party",
        limitations: urls.length === 0 ? ["No URLs provided for mapping"] : [],
      });
    },
  };
}
