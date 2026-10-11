import type { Tool, ToolContext, ToolResult } from "./types.js";

export class ReadSpecialistEvidenceTool implements Tool {
  name = "read_specialist_evidence";
  description = "Read specialist evidence extracted from public profiles and third-party sources for the current audit.";
  inputSchema = {
    type: "object",
    properties: {
      evidence_type: {
        type: "string",
        enum: ["entity_profile", "nap_analysis", "public_source"],
        description: "Type of specialist evidence to retrieve",
      },
      audit_id: {
        type: "string",
        description: "Audit ID to retrieve evidence for",
      },
    },
    required: ["evidence_type"],
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const typedInput = input as { evidence_type: string; audit_id?: string };
    const auditId = typedInput.audit_id ?? context.audit_id;

    if (context.db) {
      const tableMap: Record<string, string> = {
        entity_profile: "profile_observations",
        nap_analysis: "nap_observations",
        public_source: "public_source_observations",
      };

      const table = tableMap[typedInput.evidence_type];
      if (!table) {
        return {
          data: [],
          source_tier: "third_party_unverified",
          limitations: [`Unknown evidence type: ${typedInput.evidence_type}`],
        };
      }

      const result = await context.db.query(
        `SELECT * FROM ${table} WHERE fact_sheet_id IN (
          SELECT id FROM fact_sheets WHERE project_id = $1
        ) ORDER BY created_at DESC LIMIT 50`,
        [context.project_id],
      );
      return {
        data: result.rows,
        source_tier: "third_party_unverified",
        limitations: ["Evidence is extracted automatically and may contain errors"],
      };
    }

    return {
      data: [],
      source_tier: "third_party_unverified",
      limitations: ["No database connection available"],
    };
  }
}
