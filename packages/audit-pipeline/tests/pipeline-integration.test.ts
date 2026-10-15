import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";
import { TIER_SCOPES, type TierName } from "../src/eligibility.js";
import { runAuditPipeline, type PipelineDeps } from "../src/pipeline.js";
import type { ComposerAgentOutcome } from "../src/report-envelope.js";
import type { EvidenceBundle, PageRuleResult } from "@wpi/rules-engine";

/* ---------------------------------------------------------------------------
 * Test helpers (mirroring pipeline.test.ts patterns)
 * ------------------------------------------------------------------------- */

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

/**
 * Build PipelineDeps including the runRulesEngine port.
 * The base runRulesEngine returns an empty array; tests override as needed.
 */
function makeDeps(store: InMemoryAuditStore, overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    store,
    validateUrl: async () => ({ ok: true }),
    crawl: async () => undefined,
    render: async () => undefined,
    processEvidence: async () => ["ev-1", "ev-2"],
    runRulesEngine: async () => [],
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
    secretHash: "sha256:" + "a".repeat(64),
    ttlDays: 7,
  });
  return record.id;
}

/* ---------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------- */

describe("pipeline + rules engine integration", () => {
  it("calls runRulesEngine before agents and connectors", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const callOrder: string[] = [];

    const result = await runAuditPipeline(
      makeDeps(store, {
        runRulesEngine: async (_bundle: EvidenceBundle) => {
          callOrder.push("rules");
          return [];
        },
        runAgents: async () => {
          callOrder.push("agents");
          return [outcome("auditor", true, [verifiedFinding()])];
        },
        runConnectors: async () => {
          callOrder.push("connectors");
          return [];
        },
      }),
      auditId,
    );

    expect(result).toBe("completed");
    expect(callOrder).toEqual(["rules", "agents", "connectors"]);
  });

  it("passes an EvidenceBundle with correct tier and locale", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store, "rich");
    let receivedBundle: EvidenceBundle | undefined;

    const result = await runAuditPipeline(
      makeDeps(store, {
        runRulesEngine: async (bundle: EvidenceBundle) => {
          receivedBundle = bundle;
          return [];
        },
      }),
      auditId,
    );

    expect(result).toBe("completed");
    expect(receivedBundle).toBeDefined();
    expect(receivedBundle!.tier).toBe("rich");
    expect(receivedBundle!.locale).toBe("en");
    expect(receivedBundle!.site.root_url).toBe("https://example.com");
  });

  it("completes successfully when rules engine returns results", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const ruleResults: PageRuleResult[] = [
      {
        rule_id: "CRW-001",
        page_id: "site",
        result: "pass",
        evidence_ids: [],
        scope: "site",
        affected_urls: ["https://example.com"],
      },
    ];

    const result = await runAuditPipeline(
      makeDeps(store, {
        runRulesEngine: async () => ruleResults,
      }),
      auditId,
    );

    expect(result).toBe("completed");
  });

  it("skips rules engine gracefully when runRulesEngine is not provided", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);

    // Build deps WITHOUT runRulesEngine (simulating existing callers)
    const { runRulesEngine: _omit, ...depsWithoutRules } = makeDeps(store);

    const result = await runAuditPipeline(depsWithoutRules as PipelineDeps, auditId);
    expect(result).toBe("completed");
  });
});
