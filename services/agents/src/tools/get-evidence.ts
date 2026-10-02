import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

export interface StorageReader {
  read(bucket: string, path: string): Promise<unknown>;
}

const inputSchema = z.object({
  evidence_id: z.string(),
});

export function createGetEvidenceTool(storage: StorageReader): Tool {
  return {
    name: "get_evidence",
    description: "Reads crawled evidence from Cloud Storage by evidence ID. Returns page content, extracted data, structured data, and metadata.",
    inputSchema: { type: "object", properties: { evidence_id: { type: "string" } }, required: ["evidence_id"] },
    async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
      const { evidence_id } = inputSchema.parse(input);
      try {
        const data = await storage.read(
          context.evidence_bucket,
          `evidence/${context.audit_id}/${evidence_id}.json`,
        );
        return {
          data,
          source_tier: "first_party",
          limitations: [],
        };
      } catch {
        return {
          data: null,
          source_tier: "first_party",
          limitations: [`Evidence not found: ${evidence_id}`],
        };
      }
    },
  };
}
