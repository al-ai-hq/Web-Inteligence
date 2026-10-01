import { describe, it, expect, vi } from "vitest";
import { handleAgentTask } from "../../src/orchestration/agent-task-handler.js";
import type { AgentJob, AgentResult } from "../../src/runtime/types.js";

function makeJob(): AgentJob {
  return {
    job_id: "job-1",
    audit_id: "audit-1",
    project_id: "proj-1",
    agent_name: "auditor",
    input_evidence_ids: ["ev-1"],
    context: { site: "https://example.com", market: "US", language: "en" },
    capture_time: "2026-10-01T00:00:00Z",
  };
}

function makeResult(): AgentResult {
  return {
    job_id: "job-1",
    agent_name: "auditor",
    audit_id: "audit-1",
    output_evidence_ids: [],
    result_state: "verified",
    findings: [],
    limitations: [],
    cost: { engine: "gemini", tokens_in: 100, tokens_out: 50, usd: 0.001 },
    duration_ms: 1000,
  };
}

describe("handleAgentTask budget gate and cost record", () => {
  it("returns 429 and does not execute or publish when canProceed returns false", async () => {
    const mockExecute = vi.fn();
    const mockPublish = vi.fn();

    const result = await handleAgentTask(makeJob(), {
      executeAgent: mockExecute,
      publishResult: mockPublish,
      canProceed: () => false,
    });

    expect(result.status).toBe(429);
    expect(result.error).toBe("Budget cap reached");
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("proceeds when canProceed returns true", async () => {
    const mockExecute = vi.fn().mockResolvedValue(makeResult());
    const mockPublish = vi.fn().mockResolvedValue(undefined);
    const job = makeJob();

    const result = await handleAgentTask(job, {
      executeAgent: mockExecute,
      publishResult: mockPublish,
      canProceed: () => true,
    });

    expect(result.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith(job);
    expect(mockPublish).toHaveBeenCalled();
  });

  it("records cost with result.cost on the success path", async () => {
    const mockExecute = vi.fn().mockResolvedValue(makeResult());
    const recordCost = vi.fn();

    const result = await handleAgentTask(makeJob(), {
      executeAgent: mockExecute,
      publishResult: vi.fn().mockResolvedValue(undefined),
      recordCost,
    });

    expect(result.status).toBe(200);
    expect(recordCost).toHaveBeenCalledTimes(1);
    expect(recordCost).toHaveBeenCalledWith(makeResult().cost);
  });

  it("does not record cost on invalid payload (400)", async () => {
    const recordCost = vi.fn();

    const result = await handleAgentTask({}, {
      executeAgent: vi.fn(),
      publishResult: vi.fn(),
      recordCost,
    });

    expect(result.status).toBe(400);
    expect(recordCost).not.toHaveBeenCalled();
  });

  it("does not record cost when execution fails (500)", async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error("Provider unavailable"));
    const recordCost = vi.fn();

    const result = await handleAgentTask(makeJob(), {
      executeAgent: mockExecute,
      publishResult: vi.fn(),
      recordCost,
    });

    expect(result.status).toBe(500);
    expect(recordCost).not.toHaveBeenCalled();
  });

  it("does not record cost when result fails schema validation (500)", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      ...makeResult(),
      result_state: "bogus_state",
    });
    const recordCost = vi.fn();

    const result = await handleAgentTask(makeJob(), {
      executeAgent: mockExecute,
      publishResult: vi.fn(),
      recordCost,
    });

    expect(result.status).toBe(500);
    expect(recordCost).not.toHaveBeenCalled();
  });
});

describe("handleAgentTask", () => {
  it("returns 400 for invalid payload", async () => {
    const result = await handleAgentTask({} as AgentJob, {
      executeAgent: vi.fn(),
      publishResult: vi.fn(),
    });
    expect(result.status).toBe(400);
  });

  it("executes agent and publishes result", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      job_id: "job-1",
      agent_name: "auditor",
      audit_id: "audit-1",
      output_evidence_ids: [],
      result_state: "verified",
      findings: [],
      limitations: [],
      cost: { engine: "gemini", tokens_in: 100, tokens_out: 50, usd: 0.001 },
      duration_ms: 1000,
    });
    const mockPublish = vi.fn().mockResolvedValue(undefined);

    const job: AgentJob = {
      job_id: "job-1",
      audit_id: "audit-1",
      project_id: "proj-1",
      agent_name: "auditor",
      input_evidence_ids: ["ev-1"],
      context: { site: "https://example.com", market: "US", language: "en" },
      capture_time: "2026-10-01T00:00:00Z",
    };

    const result = await handleAgentTask(job, {
      executeAgent: mockExecute,
      publishResult: mockPublish,
    });

    expect(result.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith(job);
    expect(mockPublish).toHaveBeenCalled();
  });

  it("returns 500 when agent execution fails", async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error("Provider unavailable"));

    const job: AgentJob = {
      job_id: "job-1",
      audit_id: "audit-1",
      project_id: "proj-1",
      agent_name: "auditor",
      input_evidence_ids: ["ev-1"],
      context: { site: "https://example.com", market: "US", language: "en" },
      capture_time: "2026-10-01T00:00:00Z",
    };

    const result = await handleAgentTask(job, {
      executeAgent: mockExecute,
      publishResult: vi.fn(),
    });

    expect(result.status).toBe(500);
  });

  it("returns 500 and does not publish when agent result fails schema validation", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      job_id: "job-1",
      agent_name: "auditor",
      audit_id: "audit-1",
      output_evidence_ids: [],
      result_state: "bogus_state",
      findings: [],
      limitations: [],
      cost: { engine: "gemini", tokens_in: 0, tokens_out: 0, usd: 0 },
      duration_ms: 1,
    });
    const mockPublish = vi.fn();
    const job: AgentJob = {
      job_id: "job-1",
      audit_id: "audit-1",
      project_id: "proj-1",
      agent_name: "auditor",
      input_evidence_ids: ["ev-1"],
      context: { site: "https://example.com", market: "US", language: "en" },
      capture_time: "2026-10-01T00:00:00Z",
    };
    const result = await handleAgentTask(job, { executeAgent: mockExecute, publishResult: mockPublish });
    expect(result.status).toBe(500);
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
