export interface AgentResult {
  findings: any[];
  data: Record<string, any>;
}

export interface Agent {
  name: string;
  execute(evidence: any): Promise<AgentResult>;
}
