import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CostTracker,
  type AgentResult,
  type ExecuteAgentParams,
} from "@wpi/agents";
import {
  M4_AGENT_NAMES,
  runAgentStage,
  type AgentStageDeps,
} from "../src/agent-stage.js";
import { FsEvidenceStorage } from "../src/evidence-storage.js";
import { agentConfigSchema, loadAgentConfig } from "../src/agent-config.js";
import { REPO_ROOT } from "../src/paths.js";
import type { AuditContext } from "../src/audit-context.js";

const AUDIT_ID = "11111111-1111-4111-8111-111111111111";

const AUDIT_CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

function stubResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    job_id: "job-1",
    agent_name: "auditor",
    audit_id: AUDIT_ID,
    output_evidence_ids: [],
    result_state: "verified",
    findings: [
      {
        finding_id: "f-1",
        result_state: "verified",
        confidence: "high",
        evidence_ids: ["ev-1"],
        data: { title: "T", recommendation: "R", severity: "high" },
        limitations: [],
      },
    ],
    limitations: [],
    cost: { engine: "stub-model", tokens_in: 10, tokens_out: 5, usd: 0.01 },
    duration_ms: 1,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AgentStageDeps> = {}): AgentStageDeps {
  const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
  runner.mockResolvedValue(stubResult());
  return {
    auditId: AUDIT_ID,
    projectId: "proj-1",
    targetUrl: "https://example.com",
    context: AUDIT_CONTEXT,
    evidenceIds: ["ev-1", "ev-2"],
    outputDir: "./output",
    geminiApiKey: "test-key",
    runner,
    ...overrides,
  };
}

describe("runAgentStage", () => {
  it("returns one outcome per M4 agent in declared order, mapping findings and cost", async () => {
    const outcomes = await runAgentStage(makeDeps());
    expect(outcomes.map((outcome) => outcome.agent_name)).toEqual([...M4_AGENT_NAMES]);
    expect(outcomes[0]?.findings[0]?.finding_id).toBe("f-1");
    expect(outcomes[0]?.cost).toEqual({
      engine: "stub-model",
      tokens_in: 10,
      tokens_out: 5,
      usd: 0.01,
    });
  });

  it("records a cost entry per agent", async () => {
    const costTracker = new CostTracker();
    const recordSpy = vi.spyOn(costTracker, "record");
    await runAgentStage(makeDeps({ costTracker }));
    expect(recordSpy).toHaveBeenCalledTimes(3);
    expect(recordSpy.mock.calls[0]?.[0]).toMatchObject({
      audit_id: AUDIT_ID,
      agent_name: "auditor",
      model: "stub-model",
    });
  });

  it("returns unavailable outcomes for every agent without running when the cost budget is exhausted", async () => {
    const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
    runner.mockResolvedValue(stubResult());
    const outcomes = await runAgentStage(
      makeDeps({ costTracker: new CostTracker({ perAuditHardCap: 0 }), runner }),
    );
    expect(
      outcomes.every(
        (outcome) => !outcome.ok && outcome.unavailable_reason_key === "unavailable.budget_cap",
      ),
    ).toBe(true);
    expect(runner).not.toHaveBeenCalled();
  });

  it("passes the config-filtered tool allowlist to the runner", async () => {
    const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
    runner.mockResolvedValue(stubResult());
    await runAgentStage(makeDeps({ runner }));
    const calls = runner.mock.calls.map((call) => call[0] as ExecuteAgentParams);
    const auditorCall = calls.find((params) => params.agentName === "auditor");
    expect(auditorCall?.allowedTools).toEqual(["get_evidence", "validate_schema"]);
    const contentCall = calls.find((params) => params.agentName === "content-strategist");
    expect(contentCall?.allowedTools).toEqual([
      "find_opportunities",
      "write_brief",
      "draft_article",
    ]);
  });

  it("marks an agent unavailable when its result_state is unavailable", async () => {
    const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
    runner.mockResolvedValue(stubResult({ result_state: "unavailable" }));
    const outcomes = await runAgentStage(makeDeps({ runner }));
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.unavailable_reason_key).toBe("unavailable.agent.auditor");
  });
});

describe("loadAgentConfig", () => {
  it("parses the real auditor agent config", () => {
    const config = loadAgentConfig(join(REPO_ROOT, "config", "agents", "auditor.yaml"));
    expect(config.name).toBe("auditor");
    expect(config.model_tier).toBe("fast");
    expect(agentConfigSchema.safeParse(config).success).toBe(true);
  });
});

describe("FsEvidenceStorage", () => {
  it("reads JSON evidence laid out as evidence/{auditId}/{evidenceId}.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wpi-evidence-"));
    try {
      await mkdir(join(dir, "evidence", "audit-1"), { recursive: true });
      await writeFile(
        join(dir, "evidence", "audit-1", "ev-1.json"),
        JSON.stringify({ title: "Page", url: "https://example.com" }),
      );
      const storage = new FsEvidenceStorage(dir);
      const data = await storage.read("ignored-bucket", "evidence/audit-1/ev-1.json");
      expect(data).toEqual({ title: "Page", url: "https://example.com" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
