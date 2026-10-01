import { describe, it, expect } from "vitest";
import { createEvalRuleTool } from "../../src/tools/eval-rule.js";
import type { ToolContext } from "../../src/tools/types.js";

describe("eval_rule", () => {
  it("evaluates a deterministic rule and returns final result", async () => {
    const mockRuleEngine = {
      async evaluate(ruleId: string, _evidenceId: string) {
        if (ruleId === "AEO-001") {
          return { pass: true, score: 0.9, details: "FAQ schema present" };
        }
        throw new Error(`Unknown rule: ${ruleId}`);
      },
    };

    const tool = createEvalRuleTool(mockRuleEngine);
    const ctx: ToolContext = {
      audit_id: "audit-1",
      project_id: "proj-1",
      evidence_bucket: "bucket",
    } as ToolContext;

    const result = await tool.execute({ rule_id: "AEO-001", evidence_id: "ev-1" }, ctx);
    expect(result.source_tier).toBe("first_party");
    expect(result.data).toEqual({ pass: true, score: 0.9, details: "FAQ schema present", final: true });
  });

  it("returns limitation for unknown rule", async () => {
    const mockRuleEngine = {
      async evaluate() {
        throw new Error("Unknown rule");
      },
    };

    const tool = createEvalRuleTool(mockRuleEngine);
    const ctx: ToolContext = {
      audit_id: "audit-1",
      project_id: "proj-1",
      evidence_bucket: "bucket",
    } as ToolContext;

    const result = await tool.execute({ rule_id: "UNKNOWN", evidence_id: "ev-1" }, ctx);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
