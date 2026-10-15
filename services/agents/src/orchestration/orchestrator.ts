import { DependencyGraph } from "./dependency-graph.js";
import type { AgentJob } from "../runtime/types.js";
import { randomUUID } from "node:crypto";

export class Orchestrator {
  private graph = new DependencyGraph();

  createJobs(baseJob: Omit<AgentJob, "job_id" | "agent_name">, agents: string[]): AgentJob[] {
    const ordered = this.graph.getExecutionOrder(agents);
    return ordered.map((agentName) => ({
      ...baseJob,
      job_id: randomUUID(),
      agent_name: agentName,
    }));
  }

  getNextAgents(allAgents: string[], completed: string[]): string[] {
    return this.graph.getReadyAgents(allAgents, completed);
  }

  isComplete(allAgents: string[], completed: string[]): boolean {
    return allAgents.every((name) => completed.includes(name));
  }
}
