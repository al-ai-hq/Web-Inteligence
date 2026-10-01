import type { PoolClient } from "pg";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  audit_id: string;
  project_id: string;
  evidence_bucket: string;
  db?: PoolClient;
}

export interface ToolResult {
  data: unknown;
  source_tier: "first_party" | "third_party_verified" | "third_party_unverified";
  limitations: string[];
}
