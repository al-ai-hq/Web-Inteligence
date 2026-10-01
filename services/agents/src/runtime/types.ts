import { z } from "zod";

export const agentJobSchema = z.object({
  job_id: z.string(),
  audit_id: z.string(),
  project_id: z.string(),
  agent_name: z.string(),
  input_evidence_ids: z.array(z.string()),
  context: z.object({
    site: z.string().url(),
    market: z.string(),
    language: z.string(),
    business_goal: z.string().optional(),
  }),
  capture_time: z.string(),
});

export type AgentJob = z.infer<typeof agentJobSchema>;

export const findingSchema = z.object({
  finding_id: z.string(),
  rule_id: z.string().optional(),
  page_url: z.string().optional(),
  result_state: z.enum(["verified", "inferred", "not_verified", "unavailable"]),
  confidence: z.enum(["high", "medium", "low"]),
  evidence_ids: z.array(z.string()),
  data: z.record(z.unknown()),
  limitations: z.array(z.string()),
});

export type Finding = z.infer<typeof findingSchema>;

export const agentResultSchema = z.object({
  job_id: z.string(),
  agent_name: z.string(),
  audit_id: z.string(),
  output_evidence_ids: z.array(z.string()),
  result_state: z.enum(["verified", "inferred", "not_verified", "unavailable"]),
  findings: z.array(findingSchema),
  limitations: z.array(z.string()),
  cost: z.object({
    engine: z.string(),
    tokens_in: z.number(),
    tokens_out: z.number(),
    usd: z.number(),
  }),
  duration_ms: z.number(),
});

export type AgentResult = z.infer<typeof agentResultSchema>;

export const agentConfigSchema = z.object({
  name: z.string(),
  milestone: z.string(),
  reads_untrusted_content: z.boolean(),
  model_tier: z.string(),
  tools: z.array(z.string()),
  forbidden_tools: z.array(z.string()),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;
