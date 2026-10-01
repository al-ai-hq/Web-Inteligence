import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "../../src/orchestration/orchestrator.js";
import type { AgentJob } from "../../src/runtime/types.js";

describe("Orchestrator", () => {
  it("creates jobs for all agents in dependency order", () => {
    const orchestrator = new Orchestrator();
    const baseJob = {
      audit_id: "audit-1",
      project_id: "proj-1",
      input_evidence_ids: ["ev-1"],
      context: { site: "https://example.com", market: "US", language: "en" },
      capture_time: "2026-10-01T00:00:00Z",
    };

    const jobs = orchestrator.createJobs(baseJob, ["auditor", "keyword-analyst", "content-strategist"]);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]!.agent_name).toBe("auditor");
    expect(jobs[1]!.agent_name).toBe("keyword-analyst");
    expect(jobs[2]!.agent_name).toBe("content-strategist");
  });

  it("determines next agents to dispatch based on completed results", () => {
    const orchestrator = new Orchestrator();
    const allAgents = ["auditor", "keyword-analyst", "content-strategist"];

    expect(orchestrator.getNextAgents(allAgents, [])).toEqual(["auditor"]);
    expect(orchestrator.getNextAgents(allAgents, ["auditor"])).toEqual(["keyword-analyst"]);
    expect(orchestrator.getNextAgents(allAgents, ["auditor", "keyword-analyst"])).toEqual(["content-strategist"]);
    expect(orchestrator.getNextAgents(allAgents, ["auditor", "keyword-analyst", "content-strategist"])).toEqual([]);
  });

  it("checks if all agents are complete", () => {
    const orchestrator = new Orchestrator();
    const allAgents = ["auditor", "keyword-analyst", "content-strategist"];

    expect(orchestrator.isComplete(allAgents, ["auditor"])).toBe(false);
    expect(orchestrator.isComplete(allAgents, ["auditor", "keyword-analyst", "content-strategist"])).toBe(true);
  });
});
