import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export const agentConfigSchema = z.object({
  name: z.string(),
  milestone: z.string(),
  reads_untrusted_content: z.boolean(),
  model_tier: z.enum(["fast", "fast_plus_embedding", "strong_reasoning"]),
  tools: z.array(z.string()),
  forbidden_tools: z.array(z.string()),
});

export type AgentYamlConfig = z.infer<typeof agentConfigSchema>;

export function loadAgentConfig(path: string): AgentYamlConfig {
  return agentConfigSchema.parse(parse(readFileSync(path, "utf-8")) as unknown);
}
