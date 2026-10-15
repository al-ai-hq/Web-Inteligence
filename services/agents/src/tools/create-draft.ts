import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  brief_id: z.string(),
  project_id: z.string(),
  title_en: z.string(),
  title_ar: z.string().optional(),
  content_en: z.string(),
  content_ar: z.string().optional(),
  author: z.string(),
  brief_status: z.string().default("approved"),
  client_input_received: z.boolean().default(true),
  cluster_mapped: z.boolean().default(false),
  monthly_draft_count: z.number().default(0),
});

export function createCreateDraftTool(): Tool {
  return {
    name: "create_draft",
    description:
      "Creates a content draft from an approved brief. Checks draft gates before creating.",
    inputSchema: {
      type: "object",
      properties: {
        brief_id: { type: "string" },
        project_id: { type: "string" },
        title_en: { type: "string" },
        title_ar: { type: "string" },
        content_en: { type: "string" },
        content_ar: { type: "string" },
        author: { type: "string" },
        brief_status: { type: "string" },
        client_input_received: { type: "boolean" },
        cluster_mapped: { type: "boolean" },
        monthly_draft_count: { type: "number" },
      },
      required: ["brief_id", "project_id", "title_en", "content_en", "author"],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const data = inputSchema.parse(input);
      const { checkDraftGates } = await import("@wpi/content-drafts");
      const gates = checkDraftGates({
        briefStatus: data.brief_status,
        author: data.author,
        clientInputReceived: data.client_input_received,
        clusterMapped: data.cluster_mapped,
        monthlyDraftCount: data.monthly_draft_count,
      });
      if (!gates.ok) {
        return {
          data: { error: "Draft gates not met", reason: gates.error },
          source_tier: "first_party",
          limitations: [],
        };
      }
      return {
        data: {
          draft: {
            brief_id: data.brief_id,
            title_en: data.title_en,
            content_en: data.content_en,
            author: data.author,
            status: "draft",
          },
        },
        source_tier: "first_party",
        limitations: [],
      };
    },
  };
}
