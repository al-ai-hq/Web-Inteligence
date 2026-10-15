import { describe, expect, it } from "vitest";
import { composeSections } from "../src/composer.js";
import type { ComposerAgentOutcome } from "../src/report-envelope.js";
import type { RulesEngineOutput } from "../src/composer.js";
import type { Finding, PriorityItem, ScoreResult } from "@wpi/rules-engine";
import { TIER_SCOPES } from "../src/eligibility.js";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function outcome(overrides: Partial<ComposerAgentOutcome> = {}): ComposerAgentOutcome {
  return {
    agent_name: "auditor",
    ok: true,
    findings: [],
    limitations: [],
    ...overrides,
  };
}

function rulesEngineOutput(overrides: Partial<RulesEngineOutput> = {}): RulesEngineOutput {
  return {
    findings: [],
    priority_items: [],
    score: null,
    unavailable_categories: [],
    ...overrides,
  };
}

/* ---------------------------------------------------------------------------
 * Step 1–2: Finding merge with deterministic-first ordering
 * ------------------------------------------------------------------------- */

describe("composeSections with rules engine findings", () => {
  it("maps rules engine Finding → StoredFinding with correct section, state, confidence", () => {
    const reFinding: Finding = {
      rule_id: "CRW-001",
      severity: "critical",
      evidence_ids: ["ev-1", "ev-2"],
      rationale: "robots.txt blocks Googlebot",
      category: "crawlability",
      evidence_state: "verified",
      affected_scope: { sampled: true, urls: ["https://example.com/"] },
    };

    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({ findings: [reFinding] }),
    );

    expect(composed.findings).toHaveLength(1);
    const sf = composed.findings[0]!;
    expect(sf.agent).toBe("rules-engine");
    expect(sf.section).toBe("technical"); // crawlability → technical
    expect(sf.severity).toBe("critical");
    expect(sf.state).toBe("verified"); // verified → verified
    expect(sf.confidence).toBe("high"); // verified → high
    expect(sf.evidence_ids).toEqual(["ev-1", "ev-2"]);
    expect(sf.data["rule_id"]).toBe("CRW-001");
    expect(sf.data["rationale"]).toBe("robots.txt blocks Googlebot");
    expect(sf.data["category"]).toBe("crawlability");
  });

  it("maps evidence_state inferred → state inferred, confidence medium", () => {
    const reFinding: Finding = {
      rule_id: "AEO-001",
      severity: "medium",
      evidence_ids: ["ev-3"],
      category: "aeo",
      evidence_state: "inferred",
      affected_scope: { sampled: true },
    };

    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({ findings: [reFinding] }),
    );

    const sf = composed.findings[0]!;
    expect(sf.section).toBe("content"); // aeo → content
    expect(sf.state).toBe("inferred");
    expect(sf.confidence).toBe("medium");
  });

  it("maps evidence_state client_stated → state not_verified, confidence low", () => {
    const reFinding: Finding = {
      rule_id: "GEO-001",
      severity: "low",
      evidence_ids: [],
      category: "geo",
      evidence_state: "client_stated",
      affected_scope: { sampled: true },
    };

    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({ findings: [reFinding] }),
    );

    const sf = composed.findings[0]!;
    expect(sf.section).toBe("entity"); // geo → entity
    expect(sf.state).toBe("not_verified");
    expect(sf.confidence).toBe("low");
  });

  it("maps performance_security category to performance section", () => {
    const reFinding: Finding = {
      rule_id: "PRF-001",
      severity: "high",
      evidence_ids: ["ev-5"],
      category: "performance_security",
      evidence_state: "verified",
      affected_scope: { sampled: true },
    };

    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({ findings: [reFinding] }),
    );

    expect(composed.findings[0]!.section).toBe("performance");
  });

  it("merges agent findings and rules engine findings together", () => {
    const agentOutcome = outcome({
      agent_name: "auditor",
      findings: [
        {
          finding_id: "agent-1",
          result_state: "verified",
          confidence: "high",
          evidence_ids: ["ev-a"],
          data: { severity: "high", recommendation: "Fix title" },
          limitations: [],
        },
      ],
    });

    const reFinding: Finding = {
      rule_id: "CRW-003",
      severity: "critical",
      evidence_ids: ["ev-r"],
      category: "crawlability",
      evidence_state: "verified",
      affected_scope: { sampled: true },
    };

    const composed = composeSections(
      [agentOutcome],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({ findings: [reFinding] }),
    );

    expect(composed.findings).toHaveLength(2);
    // Deterministic-first ordering: rules engine findings before agent findings
    expect(composed.findings[0]!.agent).toBe("rules-engine");
    expect(composed.findings[1]!.agent).toBe("auditor");
    const agents = composed.findings.filter((f) => f.agent === "auditor");
    const rules = composed.findings.filter((f) => f.agent === "rules-engine");
    expect(agents).toHaveLength(1);
    expect(rules).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------------------
 * Step 3–4: Unavailable blocks from rules engine
 * ------------------------------------------------------------------------- */

describe("composeSections with rules engine unavailable categories", () => {
  it("generates unavailable blocks from rules engine unavailable_categories", () => {
    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({
        unavailable_categories: ["aeo", "geo"],
        score: {
          methodology_version: "2.0.0",
          presence_readiness: 72,
          pre_cap_value: 72,
          applied_caps: [],
          categories: [],
          coverage: 0.7,
          confidence: "medium",
          unavailable_categories: ["aeo", "geo"],
        } as ScoreResult,
      }),
    );

    const unavailableKeys = composed.unavailable.map((b) => b.reason_key);
    expect(unavailableKeys).toContain("unavailable.category.aeo");
    expect(unavailableKeys).toContain("unavailable.category.geo");
  });

  it("does NOT include hardcoded unavailable.score when score is present", () => {
    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({
        score: {
          methodology_version: "2.0.0",
          presence_readiness: 50,
          pre_cap_value: 55,
          applied_caps: [],
          categories: [],
          coverage: 0.8,
          confidence: "medium",
          unavailable_categories: [],
        } as ScoreResult,
      }),
    );

    const unavailableKeys = composed.unavailable.map((b) => b.reason_key);
    expect(unavailableKeys).not.toContain("unavailable.score");
    // experience_effectiveness is now handled separately (D-012) and always
    // appears when no experience-reviewer outcome is present
    expect(unavailableKeys).toContain("unavailable.experience_effectiveness");
  });

  it("still includes hardcoded unavailable blocks when no score is provided", () => {
    const composed = composeSections([], [], TIER_SCOPES.rich);

    const unavailableKeys = composed.unavailable.map((b) => b.reason_key);
    expect(unavailableKeys).toContain("unavailable.score");
    expect(unavailableKeys).toContain("unavailable.experience_effectiveness");
  });
});

/* ---------------------------------------------------------------------------
 * Step 5–6: Action board from priority items
 * ------------------------------------------------------------------------- */

describe("composeSections with rules engine priority items", () => {
  it("maps PriorityItem → StoredActionItem", () => {
    const priorityItem: PriorityItem = {
      rule_id: "CRW-001",
      severity: "critical",
      priority_value: 12.5,
      group: "critical_blocker",
      horizon: "0-30d",
      display_band: 1,
      category: "crawlability",
      evidence_ids: ["ev-1"],
      rationale: "Fix robots.txt",
    };

    // Need a finding so source_finding_id can be set
    const reFinding: Finding = {
      rule_id: "CRW-001",
      severity: "critical",
      evidence_ids: ["ev-1"],
      category: "crawlability",
      evidence_state: "verified",
      affected_scope: { sampled: true },
    };

    const composed = composeSections(
      [],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({
        findings: [reFinding],
        priority_items: [priorityItem],
      }),
    );

    expect(composed.action_board.length).toBeGreaterThanOrEqual(1);
    const actionItem = composed.action_board.find((a) => a.title === "CRW-001");
    expect(actionItem).toBeDefined();
    expect(actionItem!.severity).toBe("critical");
    expect(actionItem!.detail).toBe("Fix robots.txt");
    expect(actionItem!.source_finding_id).toBeTruthy();
  });

  it("action board includes both agent-derived and rules engine items", () => {
    const agentOutcome = outcome({
      agent_name: "auditor",
      findings: [
        {
          finding_id: "agent-1",
          result_state: "verified",
          confidence: "high",
          evidence_ids: ["ev-a"],
          data: { severity: "high", recommendation: "Fix title tag" },
          limitations: [],
        },
      ],
    });

    const priorityItem: PriorityItem = {
      rule_id: "CRW-003",
      severity: "critical",
      priority_value: 15,
      group: "critical_blocker",
      horizon: "0-30d",
      display_band: 1,
      category: "crawlability",
      evidence_ids: ["ev-r"],
      rationale: "Sitemap missing",
    };

    const reFinding: Finding = {
      rule_id: "CRW-003",
      severity: "critical",
      evidence_ids: ["ev-r"],
      category: "crawlability",
      evidence_state: "verified",
      affected_scope: { sampled: true },
    };

    const composed = composeSections(
      [agentOutcome],
      [],
      TIER_SCOPES.rich,
      rulesEngineOutput({
        findings: [reFinding],
        priority_items: [priorityItem],
      }),
    );

    // Should have at least 2 items: one from agent, one from rules engine
    expect(composed.action_board.length).toBeGreaterThanOrEqual(2);
    const titles = composed.action_board.map((a) => a.title);
    expect(titles).toContain("CRW-003"); // from rules engine
  });
});

/* ---------------------------------------------------------------------------
 * Step 7: Limitation keys removed
 * ------------------------------------------------------------------------- */

describe("limitation keys", () => {
  it("BASE_LIMITATION_KEYS no longer includes score_engine_deferred or deterministic_rules_deferred", async () => {
    const { BASE_LIMITATION_KEYS } = await import("../src/pipeline.js");
    expect(BASE_LIMITATION_KEYS).not.toContain("limitation.score_engine_deferred");
    expect(BASE_LIMITATION_KEYS).not.toContain("limitation.deterministic_rules_deferred");
    expect(BASE_LIMITATION_KEYS).toContain("limitation.external_api_tools_unavailable");
  });
});

/* ---------------------------------------------------------------------------
 * Step 8: Score field on StoredReportEnvelope
 * ------------------------------------------------------------------------- */

describe("score field on StoredReportEnvelope", () => {
  it("StoredReportEnvelope type includes optional score field", async () => {
    // Type-level check: importing StoredReportEnvelope should have a score property
    const { composeSections: cs } = await import("../src/composer.js");

    const scoreResult: ScoreResult = {
      methodology_version: "2.0.0",
      presence_readiness: 72.5,
      pre_cap_value: 80,
      applied_caps: [],
      categories: [],
      coverage: 0.85,
      confidence: "medium",
      unavailable_categories: ["aeo"],
    };

    const composed = cs([], [], TIER_SCOPES.rich, rulesEngineOutput({ score: scoreResult }));

    expect(composed.score).toEqual(scoreResult);
    expect(composed.score!.presence_readiness).toBe(72.5);
    expect(composed.score!.methodology_version).toBe("2.0.0");
  });

  it("score is null when no rules engine output is provided", () => {
    const composed = composeSections([], [], TIER_SCOPES.rich);
    expect(composed.score).toBeNull();
  });
});
