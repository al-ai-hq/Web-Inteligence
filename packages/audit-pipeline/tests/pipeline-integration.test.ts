import { describe, expect, it } from "vitest";
import { loadConfig, loadRecommendationConfig, RuleCatalog } from "@wpi/rules-engine";
import type { EvidenceBundle, PageRuleResult } from "@wpi/rules-engine";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";
import type { OutcomeStore } from "../src/outcome-store.js";
import { TIER_SCOPES, type TierName } from "../src/eligibility.js";
import { runAuditPipeline, type PipelineDeps } from "../src/pipeline.js";
import type { ComposerAgentOutcome } from "../src/report-envelope.js";

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

    const result = await runAuditPipeline(depsWithoutRules, auditId);
    expect(result).toBe("completed");
  });
});

describe("pipeline + outcome tracking", () => {
  const OWNER = "11111111-1111-4111-8111-111111111111";

  /** Records which users were asked for pending marks; never measures anything. */
  function spyOutcomeStore(lookedUp: string[]): OutcomeStore {
    const unused = () => {
      throw new Error("not exercised by this test");
    };
    return {
      markApplied: unused,
      listPendingForUser: async (userId: string) => {
        lookedUp.push(userId);
        return [];
      },
      recordDeltas: unused,
      listForAudit: unused,
    };
  }

  async function seedOwnedAudit(store: InMemoryAuditStore): Promise<string> {
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: AUDIT_CONTEXT,
      tier: "rich",
      secretHash: "sha256:" + "a".repeat(64),
      ttlDays: 7,
      userId: OWNER,
    });
    return record.id;
  }

  it("closes pending outcome marks after a completed owned audit", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedOwnedAudit(store);
    const lookedUp: string[] = [];

    const result = await runAuditPipeline(
      makeDeps(store, { outcomeStore: spyOutcomeStore(lookedUp) }),
      auditId,
    );

    expect(result).toBe("completed");
    expect(lookedUp).toEqual([OWNER]);
  });

  it("leaves outcomes alone for an anonymous audit", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const lookedUp: string[] = [];

    const result = await runAuditPipeline(
      makeDeps(store, { outcomeStore: spyOutcomeStore(lookedUp) }),
      auditId,
    );

    expect(result).toBe("completed");
    expect(lookedUp).toEqual([]);
  });

  it("still completes the audit when outcome recording throws", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedOwnedAudit(store);

    const failing: OutcomeStore = {
      ...spyOutcomeStore([]),
      listPendingForUser: async () => {
        throw new Error("outcome store unavailable");
      },
    };

    const result = await runAuditPipeline(makeDeps(store, { outcomeStore: failing }), auditId);

    // A delta-computation failure must not cost the user the report they waited for.
    expect(result).toBe("completed");
    expect((await store.getRaw(auditId))?.status).toBe("READY_COMPLETE");
  });
});

describe("pipeline + recommendation provenance", () => {
  const failedRuleResult: PageRuleResult = {
    rule_id: "CRW-001",
    page_id: "site",
    result: "fail",
    evidence_ids: [],
    cap_trigger: true,
  };

  function realRulesConfig() {
    const { rules, scoring } = loadConfig();
    return {
      rules,
      scoring,
      catalog: new RuleCatalog(rules),
      recommendation: loadRecommendationConfig(),
    };
  }

  it("stores the industry and the signal that decided it on the report", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);

    const result = await runAuditPipeline(
      makeDeps(store, {
        runRulesEngine: async () => [failedRuleResult],
        loadRulesConfig: realRulesConfig,
      }),
      auditId,
    );

    expect(result).toBe("completed");
    const record = await store.getRaw(auditId);
    expect(record?.report?.recommendations?.industry).toBe("ecommerce");
    expect(record?.report?.recommendations?.basis).toBe("business_type:e-commerce");
    expect(record?.report?.action_board[0]?.band).toBeDefined();
  });

  it("omits recommendation provenance when the rules engine produced nothing", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);

    await runAuditPipeline(
      makeDeps(store, { loadRulesConfig: realRulesConfig }),
      auditId,
    );

    const record = await store.getRaw(auditId);
    expect(record?.report?.recommendations).toBeUndefined();
  });
});
