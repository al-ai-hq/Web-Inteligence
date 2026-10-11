import type { Tool, ToolContext, ToolResult } from "./types.js";

export class ReadConfirmedFactsTool implements Tool {
  name = "read_confirmed_facts";
  description = "Read confirmed facts from the fact sheet register. These are human-verified facts that the Fixer and brief writer may use.";
  inputSchema = {
    type: "object",
    properties: {
      fact_sheet_id: {
        type: "string",
        description: "Specific fact sheet ID to read from. If omitted, reads all confirmed fact sheets for the project.",
      },
    },
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const typedInput = input as { fact_sheet_id?: string };

    if (context.db) {
      if (typedInput.fact_sheet_id) {
        const result = await context.db.query(
          `SELECT * FROM fact_register WHERE fact_sheet_id = $1 ORDER BY fact_key`,
          [typedInput.fact_sheet_id],
        );
        return {
          data: result.rows,
          source_tier: "third_party_verified",
          limitations: [],
        };
      }

      const result = await context.db.query(
        `SELECT fr.* FROM fact_register fr
         JOIN fact_sheets fs ON fr.fact_sheet_id = fs.id
         WHERE fs.project_id = $1 AND fs.status = 'confirmed'
         ORDER BY fr.fact_key`,
        [context.project_id],
      );
      return {
        data: result.rows,
        source_tier: "third_party_verified",
        limitations: [],
      };
    }

    return {
      data: [],
      source_tier: "third_party_verified",
      limitations: ["No database connection available"],
    };
  }
}
