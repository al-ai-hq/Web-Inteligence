import { agentJobSchema, agentResultSchema, type AgentJob, type AgentResult } from "../runtime/types.js";

interface TaskHandlerDeps {
  executeAgent: (job: AgentJob) => Promise<AgentResult>;
  publishResult: (result: AgentResult) => Promise<void>;
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

  try {
    const result = await deps.executeAgent(parsed.data);
    const validated = agentResultSchema.safeParse(result);
    if (!validated.success) {
      return { status: 500, error: "Agent result failed schema validation" };
    }
    await deps.publishResult(validated.data);
    return { status: 200, body: validated.data };
  } catch (error) {
    return { status: 500, error: `Agent execution failed: ${String(error)}` };
  }
}
