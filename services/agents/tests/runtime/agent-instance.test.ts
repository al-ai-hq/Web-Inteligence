import { describe, it, expect, vi } from "vitest";
import { executeAgent } from "../../src/runtime/agent-instance.js";
import { getModelPricing } from "../../src/providers/model-resolver.js";
import type { AgentJob } from "../../src/runtime/types.js";
import type { Tool, ToolContext, ToolResult } from "../../src/tools/types.js";
import type { ProviderAdapter, CompletionResponse } from "../../src/providers/types.js";
import type { ToolContext as AgentToolContext } from "../../src/runtime/agent-instance.js";

function makeJob(overrides?: Partial<AgentJob>): AgentJob {
  return {
    job_id: "job-1",
    audit_id: "audit-1",
    project_id: "proj-1",
    agent_name: "auditor",
    input_evidence_ids: ["ev-1"],
    context: {
      site: "https://example.com",
      market: "US",
      language: "en",
    },
    capture_time: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function makeTool(name: string, data?: unknown): Tool {
  return {
    name,
    description: `Tool ${name}`,
    inputSchema: { type: "object", properties: {} },
    async execute(_input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      return { data: data ?? { result: "ok" }, source_tier: "first_party", limitations: [] };
    },
  };
}

describe("executeAgent", () => {
  it("rejects a tool call not in the allowlist", async () => {
    const provider: ProviderAdapter = {
      name: "gemini",
      async complete() {
        return {
          content: "",
          toolCalls: [{ name: "forbidden_tool", arguments: {} }],
          usage: { tokens_in: 10, tokens_out: 5 },
          finishReason: "tool_use",
        };
      },
      isAvailable() {
        return true;
      },
    };

    const tools = [makeTool("get_evidence")];
    const job = makeJob();

    await expect(
      executeAgent({
        agentName: "auditor",
        allowedTools: ["get_evidence"],
        job,
        provider,
        tools,
        systemPrompt: "You are an auditor.",
        userPrompt: "Analyze this evidence.",
        toolContext: {
          audit_id: "audit-1",
          project_id: "proj-1",
          evidence_bucket: "bucket",
        } as AgentToolContext,
      }),
    ).rejects.toThrowError("Tool 'forbidden_tool' is not in the allowlist for agent 'auditor'");
  });

  it("executes a tool and includes result in next prompt", async () => {
    let callCount = 0;
    const provider: ProviderAdapter = {
      name: "gemini",
      async complete(req) {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            toolCalls: [{ name: "get_evidence", arguments: { evidence_id: "ev-1" } }],
            usage: { tokens_in: 10, tokens_out: 5 },
            finishReason: "tool_use",
          };
        }
        return {
          content: JSON.stringify({
            findings: [],
            result_state: "verified",
            limitations: [],
          }),
          usage: { tokens_in: 20, tokens_out: 10 },
          finishReason: "stop",
        };
      },
      isAvailable() {
        return true;
      },
    };

    const tool = makeTool("get_evidence", { page_content: "test" });
    const job = makeJob();

    const result = await executeAgent({
      agentName: "auditor",
      allowedTools: ["get_evidence"],
      job,
      provider,
      tools: [tool],
      systemPrompt: "You are an auditor.",
      userPrompt: "Analyze this evidence.",
      toolContext: {
        audit_id: "audit-1",
        project_id: "proj-1",
        evidence_bucket: "bucket",
      } as AgentToolContext,
    });

    expect(result.job_id).toBe("job-1");
    expect(result.agent_name).toBe("auditor");
    expect(result.cost.engine).toBe("gemini");
    expect(result.cost.tokens_in).toBe(30);
    expect(result.duration_ms).toBeGreaterThan(0);
  });

  it("returns result when model finishes without tool calls", async () => {
    const provider: ProviderAdapter = {
      name: "gemini",
      async complete() {
        return {
          content: JSON.stringify({
            findings: [
              {
                finding_id: "f-1",
                rule_id: "AEO-001",
                result_state: "verified",
                confidence: "high",
                evidence_ids: ["ev-1"],
                data: {},
                limitations: [],
              },
            ],
            result_state: "verified",
            limitations: [],
          }),
          usage: { tokens_in: 50, tokens_out: 25 },
          finishReason: "stop",
        };
      },
      isAvailable() {
        return true;
      },
    };

    const job = makeJob();
    const result = await executeAgent({
      agentName: "auditor",
      allowedTools: [],
      job,
      provider,
      tools: [],
      systemPrompt: "You are an auditor.",
      userPrompt: "Analyze.",
      toolContext: {
        audit_id: "audit-1",
        project_id: "proj-1",
        evidence_bucket: "bucket",
      } as AgentToolContext,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.finding_id).toBe("f-1");
  });

  it("returns a pricing-derived non-zero cost when max iterations reached", async () => {
    const provider: ProviderAdapter = {
      name: "gemini",
      complete() {
        return Promise.resolve({
          content: "",
          toolCalls: [{ name: "get_evidence", arguments: {} }],
          usage: { tokens_in: 1000, tokens_out: 500 },
          finishReason: "tool_use",
        });
      },
      isAvailable() {
        return true;
      },
    };

    const job = makeJob();
    const result = await executeAgent({
      agentName: "auditor",
      allowedTools: ["get_evidence"],
      job,
      provider,
      tools: [makeTool("get_evidence")],
      systemPrompt: "You are an auditor.",
      userPrompt: "Analyze this evidence.",
      toolContext: {
        audit_id: "audit-1",
        project_id: "proj-1",
        evidence_bucket: "bucket",
      } as AgentToolContext,
      model: "gemini-2.0-flash",
      maxIterations: 1,
    });

    expect(result.result_state).toBe("unavailable");
    expect(result.cost.tokens_in).toBe(1000);
    expect(result.cost.tokens_out).toBe(500);
    const pricing = getModelPricing("gemini-2.0-flash");
    const expected = (1000 / 1000) * pricing.inputPer1k + (500 / 1000) * pricing.outputPer1k;
    expect(result.cost.usd).toBeGreaterThan(0);
    expect(result.cost.usd).toBeCloseTo(expected);
  });
});
