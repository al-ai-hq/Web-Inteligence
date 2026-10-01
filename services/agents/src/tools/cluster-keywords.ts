import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  keywords: z.array(
    z.object({
      query: z.string(),
      intent: z.string().optional(),
    }),
  ),
});

export function createClusterKeywordsTool(): Tool {
  return {
    name: "cluster_keywords",
    description: "Groups keywords by intent similarity into clusters.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: {
            type: "object",
            properties: {
              query: { type: "string" },
              intent: { type: "string" },
            },
            required: ["query"],
          },
        },
      },
      required: ["keywords"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { keywords } = inputSchema.parse(input);

      const intentGroups = new Map<string, string[]>();
      for (const kw of keywords) {
        const intent = kw.intent ?? "unclassified";
        const group = intentGroups.get(intent) ?? [];
        group.push(kw.query);
        intentGroups.set(intent, group);
      }

      const clusters = [...intentGroups.entries()].map(([intent, kws], i) => ({
        id: `cluster-${String(i)}`,
        intent,
        keywords: kws,
        primary: kws[0] ?? "",
      }));

      return Promise.resolve({
        data: { clusters },
        source_tier: "first_party",
        limitations: [],
      });
    },
  };
}
