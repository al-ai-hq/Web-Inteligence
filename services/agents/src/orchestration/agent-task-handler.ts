import {
  agentJobSchema,
  agentResultSchema,
  type AgentJob,
  type AgentResult,
} from "../runtime/types.js";

interface TaskHandlerDeps {
  executeAgent: (job: AgentJob) => Promise<AgentResult>;
  publishResult: (result: AgentResult) => Promise<void>;
  canProceed?: () => boolean;
  recordCost?: (cost: AgentResult["cost"]) => void;
}

interface TaskResult {
  status: number;
  body?: AgentResult;
  error?: string;
}

export async function handleAgentTask(
  payload: unknown,
  deps: TaskHandlerDeps,
): Promise<TaskResult> {
  const parsed = agentJobSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, error: `Invalid payload: ${parsed.error.message}` };
  }

  if (deps.canProceed !== undefined && !deps.canProceed()) {
    return { status: 429, error: "Budget cap reached" };
  }

  try {
    const result = await deps.executeAgent(parsed.data);
    const validated = agentResultSchema.safeParse(result);
    if (!validated.success) {
      return { status: 500, error: "Agent result failed schema validation" };
    }
    await deps.publishResult(validated.data);
    deps.recordCost?.(validated.data.cost);
    return { status: 200, body: validated.data };
  } catch (error) {
    return { status: 500, error: `Agent execution failed: ${String(error)}` };
  }
}
