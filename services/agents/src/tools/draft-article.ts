import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  brief_id: z.string(),
  title: z.string(),
  target_keyword: z.string(),
  outline: z.array(z.string()),
});

export function createDraftArticleTool(): Tool {
  return {
    name: "draft_article",
    description: "Creates a content draft from an approved brief. Drafts only — a human publishes.",
    inputSchema: {
      type: "object",
      properties: {
        brief_id: { type: "string" },
        title: { type: "string" },
        target_keyword: { type: "string" },
        outline: { type: "array", items: { type: "string" } },
      },
      required: ["brief_id", "title", "target_keyword", "outline"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { brief_id, title, target_keyword, outline } = inputSchema.parse(input);

      if (!brief_id) {
        return Promise.resolve({
          data: null,
          source_tier: "first_party",
          limitations: ["Approved brief required"],
        });
      }

      return Promise.resolve({
        data: {
          draft_id: `draft-${String(Date.now())}`,
          title,
          target_keyword,
          outline,
          status: "draft",
          brief_id,
        },
        source_tier: "first_party",
        limitations: ["Draft only — requires human review and publishing"],
      });
    },
  };
}
