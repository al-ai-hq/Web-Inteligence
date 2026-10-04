import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";
import { TIER_SCOPES, type TierName } from "../src/eligibility.js";
import { runAuditPipeline, type PipelineDeps } from "../src/pipeline.js";
import type { ComposerAgentOutcome } from "../src/report-envelope.js";

const AUDIT_CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

function outcome(
  agentName: string,
  ok: boolean,
  findings: ComposerAgentOutcome["findings"] = [],
): ComposerAgentOutcome {
  return {
    agent_name: agentName,
    ok,
    findings,
    limitations: [],
    cost: { engine: "stub", tokens_in: 1, tokens_out: 1, usd: 0.001 },
  };
}

function verifiedFinding(): ComposerAgentOutcome["findings"][number] {
  return {
    finding_id: "f-1",
    result_state: "verified",
    confidence: "high",
    evidence_ids: ["ev-1"],
    data: { title: "Missing meta description", recommendation: "Add one", severity: "high" },
    limitations: [],
  };
}

function makeDeps(
  store: InMemoryAuditStore,
  overrides: Partial<PipelineDeps> = {},
): PipelineDeps {
  return {
    store,
    validateUrl: async () => ({ ok: true }),
    crawl: async () => undefined,
    render: async () => undefined,
    processEvidence: async () => ["ev-1", "ev-2"],
    runAgents: async () => [
      outcome("auditor", true, [verifiedFinding()]),
      outcome("keyword-analyst", true),
      outcome("content-strategist", true),
    ],
    runConnectors: async () => [],
    tierScopes: TIER_SCOPES,
    ...overrides,
  };
}

async function seedAudit(store: InMemoryAuditStore, tier: TierName = "rich"): Promise<string> {
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: AUDIT_CONTEXT,
    tier,
    // Deviation from the brief's "sha256:seed" placeholder: the report-model
    // schema requires secret_hash to match ^sha256:[0-9a-f]{64}$ and the
    // pipeline validates the composed report against the real schemas (Task 9
    // ruling), so an invalid placeholder hash would fail the happy-path test.
    // Same fix as the Task 9 report-model test; no assertion depends on the
    // hash value.
    secretHash: "sha256:" + "a".repeat(64),
    ttlDays: 7,
  });
  return record.id;
}

describe("runAuditPipeline", () => {
  it("runs the happy path and stores a READY_COMPLETE envelope", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("completed");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("READY_COMPLETE");
    expect(raw?.report?.report.audit_id).toBe(auditId);
    expect(raw?.report?.findings).toHaveLength(1);
    expect(raw?.report?.action_board.length).toBeGreaterThan(0);
    expect(raw?.report?.report.content.limitations_keys).toContain(
      "limitation.sample_not_full_site",
    );
    expect(raw?.costs?.total_usd).toBeCloseTo(0.003, 5);
  });

  it("lands on READY_PARTIAL when every agent succeeds but returns no findings", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        runAgents: async () => [
          outcome("auditor", true),
          outcome("keyword-analyst", true),
          outcome("content-strategist", true),
        ],
      }),
      auditId,
    );
    expect(result).toBe("partial");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("READY_PARTIAL");
  });

  it("fails with the validator reason when URL validation rejects", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        validateUrl: async () => ({ ok: false, reason_key: "failure.url_invalid" }),
      }),
      auditId,
    );
    expect(result).toBe("failed");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("FAILED");
    expect(raw?.failure_reason).toBe("failure.url_invalid");
  });

  it("records unavailable blocks for failed agents and still composes", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        runAgents: async () => [
          outcome("auditor", false),
          outcome("keyword-analyst", true),
          outcome("content-strategist", false),
        ],
      }),
      auditId,
    );
    expect(result).toBe("partial");
    const raw = await store.getRaw(auditId);
    const sections = (raw?.report?.unavailable ?? []).map((block) => block.section);
    expect(sections).toContain("technical");
    expect(sections).toContain("content");
    expect(raw?.report?.report.content.summary_bullets).toEqual(["report.summary.keywords"]);
  });

  it("fails with failure.tier_refused when the tier is refused", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store, "refused");
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("failed");
    const raw = await store.getRaw(auditId);
    expect(raw?.failure_reason).toBe("failure.tier_refused");
  });

  it("stops without touching a soft-deleted audit", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    await store.softDelete(auditId);
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("stopped");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("QUEUED");
  });

  it("stops when the audit is mid-flight (not QUEUED)", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    await store.transition(auditId, "VALIDATING");
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("stopped");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("VALIDATING");
  });

  it("fails with failure.pipeline_error when crawl throws", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        crawl: async () => {
          throw new Error("crawl boom");
        },
      }),
      auditId,
    );
    expect(result).toBe("failed");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("FAILED");
    expect(raw?.failure_reason).toBe("failure.pipeline_error");
  });
});
