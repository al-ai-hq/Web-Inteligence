import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

interface RuleEngine {
  evaluate(ruleId: string, evidenceId: string): Promise<Record<string, unknown>>;
}

const inputSchema = z.object({
  rule_id: z.string(),
  evidence_id: z.string(),
});

export function createEvalRuleTool(ruleEngine: RuleEngine): Tool {
  return {
    name: "eval_rule",
    description:
      "Runs a deterministic rule evaluation. The result is FINAL — do not re-score or override it.",
    inputSchema: {
      type: "object",
      properties: {
        rule_id: { type: "string" },
        evidence_id: { type: "string" },
      },
      required: ["rule_id", "evidence_id"],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { rule_id, evidence_id } = inputSchema.parse(input);
      try {
        const result = await ruleEngine.evaluate(rule_id, evidence_id);
        return {
          data: { ...result, final: true },
          source_tier: "first_party",
          limitations: ["Deterministic result — do not re-score"],
        };
      } catch {
        return {
          data: null,
          source_tier: "first_party",
          limitations: [`Rule evaluation failed: ${rule_id}`],
        };
      }
    },
  };
}
