import type { AgentJob, AgentResult, Finding } from "./types.js";
import type { Tool, ToolContext as ToolRuntimeContext } from "../tools/types.js";
import type { ProviderAdapter, ToolDefinition } from "../providers/types.js";

export interface ToolContext {
  audit_id: string;
  project_id: string;
  evidence_bucket: string;
}

export interface ExecuteAgentParams {
  agentName: string;
  allowedTools: string[];
  job: AgentJob;
  provider: ProviderAdapter;
  tools: Tool[];
  systemPrompt: string;
  userPrompt: string;
  toolContext: ToolContext;
  model?: string;
  maxIterations?: number;
}

const MAX_ITERATIONS = 10;

export async function executeAgent(params: ExecuteAgentParams): Promise<AgentResult> {
  const {
    agentName,
    allowedTools,
    job,
    provider,
    tools,
    systemPrompt,
    userPrompt,
    toolContext,
    model = "gemini-2.0-flash",
    maxIterations = MAX_ITERATIONS,
  } = params;

  const startTime = performance.now();
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  const toolDefs: ToolDefinition[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  let currentSystemPrompt = systemPrompt;
  let currentUserPrompt = userPrompt;

  for (let i = 0; i < maxIterations; i++) {
    const response = await provider.complete({
      model,
      systemPrompt: currentSystemPrompt,
      userPrompt: currentUserPrompt,
      toolDefinitions: toolDefs.length > 0 ? toolDefs : undefined,
    });

    totalTokensIn += response.usage.tokens_in;
    totalTokensOut += response.usage.tokens_out;

    if (response.finishReason === "stop" || !response.toolCalls || response.toolCalls.length === 0) {
      const parsed = parseAgentOutput(response.content, job, agentName, provider.name, totalTokensIn, totalTokensOut, startTime);
      return parsed;
    }

    const toolResults: string[] = [];
    for (const call of response.toolCalls) {
      if (!allowedTools.includes(call.name)) {
        throw new Error(`Tool '${call.name}' is not in the allowlist for agent '${agentName}'`);
      }

      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        throw new Error(`Tool '${call.name}' not found in registry`);
      }

      const ctx: ToolRuntimeContext = {
        audit_id: toolContext.audit_id,
        project_id: toolContext.project_id,
        evidence_bucket: toolContext.evidence_bucket,
      };

      const result = await tool.execute(call.arguments, ctx);
      toolResults.push(`Tool '${call.name}' result: ${JSON.stringify(result.data)}`);
    }

    currentUserPrompt = `${userPrompt}\n\nTool results:\n${toolResults.join("\n")}`;
  }

  return {
    job_id: job.job_id,
    agent_name: agentName,
    audit_id: job.audit_id,
    output_evidence_ids: [],
    result_state: "unavailable",
    findings: [],
    limitations: ["Max iterations reached"],
    cost: {
      engine: provider.name,
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
      usd: 0,
    },
    duration_ms: performance.now() - startTime,
  };
}

function parseAgentOutput(
  content: string,
  job: AgentJob,
  agentName: string,
  engine: string,
  tokensIn: number,
  tokensOut: number,
  startTime: number,
): AgentResult {
  try {
    const parsed = JSON.parse(content);
    const findings: Finding[] = (parsed.findings ?? []).map((f: Record<string, unknown>) => ({
      finding_id: String(f["finding_id"]),
      rule_id: f["rule_id"] as string | undefined,
      page_url: f["page_url"] as string | undefined,
      result_state: (f["result_state"] as Finding["result_state"]) ?? "inferred",
      confidence: (f["confidence"] as Finding["confidence"]) ?? "medium",
      evidence_ids: (f["evidence_ids"] as string[]) ?? [],
      data: (f["data"] as Record<string, unknown>) ?? {},
      limitations: (f["limitations"] as string[]) ?? [],
    }));

    return {
      job_id: job.job_id,
      agent_name: agentName,
      audit_id: job.audit_id,
      output_evidence_ids: parsed.output_evidence_ids ?? [],
      result_state: parsed.result_state ?? "inferred",
      findings,
      limitations: parsed.limitations ?? [],
      cost: {
        engine,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        usd: estimateCost(tokensIn, tokensOut),
      },
      duration_ms: performance.now() - startTime,
    };
  } catch {
    return {
      job_id: job.job_id,
      agent_name: agentName,
      audit_id: job.audit_id,
      output_evidence_ids: [],
      result_state: "unavailable",
      findings: [],
      limitations: ["Failed to parse model output"],
      cost: {
        engine,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        usd: estimateCost(tokensIn, tokensOut),
      },
      duration_ms: performance.now() - startTime,
    };
  }
}

function estimateCost(tokensIn: number, tokensOut: number): number {
  const INPUT_COST_PER_1K = 0.000075;
  const OUTPUT_COST_PER_1K = 0.0003;
  return (tokensIn / 1000) * INPUT_COST_PER_1K + (tokensOut / 1000) * OUTPUT_COST_PER_1K;
}
