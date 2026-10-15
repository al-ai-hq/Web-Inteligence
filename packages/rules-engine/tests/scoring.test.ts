import { describe, it, expect } from "vitest";
import type {
  RuleResult,
  LoadedRule,
  ScoringConfig,
  RuleCategory,
  ScoringContext,
} from "../src/types.js";
import {
  calculateCategoryScores,
  calculatePreCapReadiness,
  applyCriticalCaps,
  calculateConfidence,
  calculateScore,
} from "../src/scoring.js";

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<LoadedRule> = {}): LoadedRule {
  return {
    id: "CRW-001",
    category: "crawlability",
    title: "Test rule",
    importance_weight: 3,
    scored: true,
    evaluation: "deterministic",
    connected_tier_only: false,
    applicability: "All audits",
    standards: { pass: "pass", fail: "fail" },
    fidelity_label: "computed",
    ...overrides,
  };
}

function makeRuleResult(overrides: Partial<RuleResult> = {}): RuleResult {
  return {
    rule_id: "CRW-001",
    result: "pass",
    evidence_ids: ["e1"],
    scope: "site",
    affected_urls: [],
    ...overrides,
  };
}

function makeScoringConfig(overrides: Partial<ScoringConfig> = {}): ScoringConfig {
  return {
    methodology_version: "0.1.0-draft",
    category_weights: {
      crawlability: 20,
      on_page: 15,
      structured_data: 10,
      aeo: 20,
      geo: 15,
      i18n_accessibility: 10,
      performance_security: 10,
    },
    result_values: { pass: 1, partial: 0.5, fail: 0 },
    critical_caps: [
      { cap_id: "homepage_unretrievable", max_score: 20, trigger_rule: "CRW-001" },
      { cap_id: "sitewide_noindex", max_score: 25, trigger_rule: "CRW-003" },
      { cap_id: "robots_blocks_general_search", max_score: 30, trigger_rule: "CRW-004" },
      { cap_id: "empty_main_content", max_score: 45, trigger_rule: "DEL-001" },
      { cap_id: "https_unavailable", max_score: 60, trigger_rule: "PRF-001" },
      { cap_id: "spam_policy_confirmed", max_score: 50, trigger_rule: "SPAM-001" },
    ],
    confidence: { high_min_coverage: 0.9, medium_min_coverage: 0.7 },
    ...overrides,
  };
}

function makeCatalogRules(
  rules: Array<Partial<LoadedRule> & { id: string; category: RuleCategory }>,
): LoadedRule[] {
  return rules.map((r) => makeRule(r));
}

// ─── Category Score Calculation ───────────────────────────────────────────────

describe("calculateCategoryScores", () => {
  it("calculates weighted score for a category with all pass results", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "CRW-002", category: "crawlability", importance_weight: 4 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }),
      makeRuleResult({ rule_id: "CRW-002", result: "pass" }),
    ];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    const crawlScore = scores.find((s) => s.category === "crawlability");
    expect(crawlScore).toBeDefined();
    // All pass: 100 * (1*5 + 1*4) / (5+4) = 100 * 9/9 = 100
    expect(crawlScore!.value).toBeCloseTo(100);
    expect(crawlScore!.measurable_weight).toBe(9);
    expect(crawlScore!.total_weight).toBe(9);
  });

  it("calculates weighted score with mixed pass/partial/fail results", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "CRW-002", category: "crawlability", importance_weight: 4 },
      { id: "CRW-003", category: "crawlability", importance_weight: 3 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }), // 1 * 5 = 5
      makeRuleResult({ rule_id: "CRW-002", result: "partial" }), // 0.5 * 4 = 2
      makeRuleResult({ rule_id: "CRW-003", result: "fail" }), // 0 * 3 = 0
    ];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    const crawlScore = scores.find((s) => s.category === "crawlability");
    // 100 * (5 + 2 + 0) / (5 + 4 + 3) = 100 * 7 / 12 = 58.333...
    expect(crawlScore!.value).toBeCloseTo(58.333, 2);
    expect(crawlScore!.measurable_weight).toBe(12);
    expect(crawlScore!.total_weight).toBe(12);
  });

  it("excludes unavailable/not_applicable/error results from denominator", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "CRW-002", category: "crawlability", importance_weight: 4 },
      { id: "CRW-003", category: "crawlability", importance_weight: 3 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }),
      makeRuleResult({ rule_id: "CRW-002", result: "unavailable" }),
      makeRuleResult({ rule_id: "CRW-003", result: "not_applicable" }),
    ];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    const crawlScore = scores.find((s) => s.category === "crawlability");
    // Only CRW-001 is measurable: 100 * (1*5) / 5 = 100
    expect(crawlScore!.value).toBeCloseTo(100);
    expect(crawlScore!.measurable_weight).toBe(5);
    expect(crawlScore!.total_weight).toBe(12);
  });

  it("returns null value when denominator is empty (no measurable rules)", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
    ]);
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "unavailable" })];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    const crawlScore = scores.find((s) => s.category === "crawlability");
    expect(crawlScore!.value).toBeNull();
    expect(crawlScore!.measurable_weight).toBe(0);
    expect(crawlScore!.total_weight).toBe(5);
  });

  it("excludes unscored rules (importance_weight = 0) from denominator", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5, scored: true },
      { id: "GSC-003", category: "crawlability", importance_weight: 0, scored: false },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }),
      makeRuleResult({ rule_id: "GSC-003", result: "pass" }),
    ];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    const crawlScore = scores.find((s) => s.category === "crawlability");
    // Only CRW-001 counts: 100 * (1*5) / 5 = 100
    expect(crawlScore!.value).toBeCloseTo(100);
    expect(crawlScore!.total_weight).toBe(5);
  });

  it("returns scores for all 7 categories", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "SEO-001", category: "on_page", importance_weight: 3 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }),
      makeRuleResult({ rule_id: "SEO-001", result: "fail" }),
    ];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    expect(scores).toHaveLength(7);
    const categories = scores.map((s) => s.category);
    expect(categories).toContain("crawlability");
    expect(categories).toContain("on_page");
    expect(categories).toContain("structured_data");
    expect(categories).toContain("aeo");
    expect(categories).toContain("geo");
    expect(categories).toContain("i18n_accessibility");
    expect(categories).toContain("performance_security");
  });

  it("categories with no rules get null value", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
    ]);
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "pass" })];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);

    const aeoScore = scores.find((s) => s.category === "aeo");
    expect(aeoScore!.value).toBeNull();
    expect(aeoScore!.measurable_weight).toBe(0);
    expect(aeoScore!.total_weight).toBe(0);
  });
});

// ─── Pre-cap Readiness ────────────────────────────────────────────────────────

describe("calculatePreCapReadiness", () => {
  it("calculates weighted average of available categories", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "SEO-001", category: "on_page", importance_weight: 3 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }), // crawlability = 100
      makeRuleResult({ rule_id: "SEO-001", result: "fail" }), // on_page = 0
    ];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);
    const readiness = calculatePreCapReadiness(scores, config);

    // crawlability: 100 * 20/100 = 20
    // on_page: 0 * 15/100 = 0
    // Other 5 categories are null → excluded
    // Renormalized: (20 + 0) / (20 + 15) * 100 = 20/35 * 100 = 57.14...
    // Wait, the formula is: Σ(category_value × category_weight / 100) over available categories
    // But we need to renormalize. Let me re-read the spec.
    // Spec §7.2: "readiness_pre_cap = SUM over the 7 categories of (category_score_c * category_weight_c / 100)"
    // But with renormalization for null categories.
    // Actually the spec says: "null categories drop out of both numerator and denominator (renormalize over available categories)"
    // So: sum(cat_score * cat_weight) / sum(cat_weight) for available categories
    // = (100 * 20 + 0 * 15) / (20 + 15) = 2000 / 35 = 57.14...
    expect(readiness).toBeCloseTo(57.143, 2);
  });

  it("returns null when all categories are unavailable", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
    ]);
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "unavailable" })];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);
    const readiness = calculatePreCapReadiness(scores, config);

    expect(readiness).toBeNull();
  });

  it("handles single available category correctly", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
    ]);
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "partial" })];
    const config = makeScoringConfig();
    const scores = calculateCategoryScores(results, rules, config);
    const readiness = calculatePreCapReadiness(scores, config);

    // Only crawlability available: score = 50, weight = 20
    // Renormalized: 50 * 20 / 20 = 50
    expect(readiness).toBeCloseTo(50);
  });
});

// ─── Critical Caps ────────────────────────────────────────────────────────────

describe("applyCriticalCaps", () => {
  it("returns pre-cap value when no caps are triggered", () => {
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }),
      makeRuleResult({ rule_id: "CRW-003", result: "pass" }),
    ];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 75.5, config);

    expect(caps.readiness).toBeCloseTo(75.5);
    expect(caps.appliedCaps).toHaveLength(0);
  });

  it("caps score to 20 when CRW-001 (homepage) fails", () => {
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "fail" })];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 75.5, config);

    expect(caps.readiness).toBeCloseTo(20);
    expect(caps.appliedCaps).toHaveLength(1);
    expect(caps.appliedCaps[0].cap_id).toBe("homepage_unretrievable");
    expect(caps.appliedCaps[0].max_score).toBe(20);
    expect(caps.appliedCaps[0].rule_id).toBe("CRW-001");
  });

  it("caps score to 25 when CRW-003 (sitewide noindex) fails", () => {
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-003", result: "fail" })];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(25);
    expect(caps.appliedCaps[0].cap_id).toBe("sitewide_noindex");
  });

  it("caps score to 30 when CRW-004 (robots blocks) fails", () => {
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-004", result: "fail" })];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(30);
    expect(caps.appliedCaps[0].cap_id).toBe("robots_blocks_general_search");
  });

  it("caps score to 45 when DEL-001 (empty main content) fails", () => {
    const results: RuleResult[] = [makeRuleResult({ rule_id: "DEL-001", result: "fail" })];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(45);
    expect(caps.appliedCaps[0].cap_id).toBe("empty_main_content");
  });

  it("caps score to 60 when PRF-001 (HTTPS unavailable) fails", () => {
    const results: RuleResult[] = [makeRuleResult({ rule_id: "PRF-001", result: "fail" })];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(60);
    expect(caps.appliedCaps[0].cap_id).toBe("https_unavailable");
  });

  it("caps score to 50 when SPAM-001 fails with cap_trigger", () => {
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "SPAM-001", result: "fail", cap_trigger: true }),
    ];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(50);
    expect(caps.appliedCaps[0].cap_id).toBe("spam_policy_confirmed");
  });

  it("does NOT trigger SPAM-001 cap when cap_trigger is false", () => {
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "SPAM-001", result: "fail", cap_trigger: false }),
    ];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(80);
    expect(caps.appliedCaps).toHaveLength(0);
  });

  it("does NOT trigger SPAM-001 cap when result is pass", () => {
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "SPAM-001", result: "pass", cap_trigger: true }),
    ];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(80);
    expect(caps.appliedCaps).toHaveLength(0);
  });

  it("applies lowest cap when multiple caps trigger", () => {
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "fail" }), // cap 20
      makeRuleResult({ rule_id: "PRF-001", result: "fail" }), // cap 60
    ];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 80, config);

    expect(caps.readiness).toBeCloseTo(20);
    expect(caps.appliedCaps).toHaveLength(2);
  });

  it("does not raise score when pre-cap is already below cap", () => {
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "fail" }), // cap 20
    ];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, 15, config);

    // Pre-cap 15 < cap 20, so readiness stays at 15
    expect(caps.readiness).toBeCloseTo(15);
    // Cap is still recorded as triggered even though it didn't change the score
    expect(caps.appliedCaps).toHaveLength(1);
    expect(caps.appliedCaps[0].cap_id).toBe("homepage_unretrievable");
  });

  it("handles null pre-cap value", () => {
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "fail" })];
    const config = makeScoringConfig();
    const caps = applyCriticalCaps(results, null, config);

    expect(caps.readiness).toBeNull();
    expect(caps.appliedCaps).toHaveLength(0);
  });
});

// ─── Confidence ───────────────────────────────────────────────────────────────

describe("calculateConfidence", () => {
  it("returns high confidence when coverage >= 0.90 and context conditions met", () => {
    const ctx: ScoringContext = {
      pages_inspected: 12,
      critical_stages_completed: ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING"],
    };
    const confidence = calculateConfidence(0.92, ctx);
    expect(confidence).toBe("high");
  });

  it("returns medium confidence when coverage >= 0.70 and context conditions met", () => {
    const ctx: ScoringContext = {
      pages_inspected: 6,
      homepage_inspected: true,
    };
    const confidence = calculateConfidence(0.75, ctx);
    expect(confidence).toBe("medium");
  });

  it("returns low confidence when coverage < 0.70", () => {
    const confidence = calculateConfidence(0.5, {});
    expect(confidence).toBe("low");
  });

  it("returns low when coverage is high but pages_inspected < 10", () => {
    const ctx: ScoringContext = {
      pages_inspected: 5,
      critical_stages_completed: ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING"],
    };
    const confidence = calculateConfidence(0.95, ctx);
    expect(confidence).toBe("low");
  });

  it("returns low when coverage is high but critical stage failed", () => {
    const ctx: ScoringContext = {
      pages_inspected: 15,
      critical_stages_completed: ["VALIDATING", "CRAWLING", "EXTRACTING"], // AUDITING missing
    };
    const confidence = calculateConfidence(0.95, ctx);
    expect(confidence).toBe("low");
  });

  it("returns medium when coverage >= 0.70 but homepage not inspected", () => {
    const ctx: ScoringContext = {
      pages_inspected: 8,
      homepage_inspected: false,
    };
    const confidence = calculateConfidence(0.8, ctx);
    expect(confidence).toBe("low");
  });

  it("falls back to low when no context provided (medium conditions unverifiable)", () => {
    // Without context, high requires pages_inspected >= 10 and all stages → can't be high
    // Without context, medium requires homepage_inspected and pages_inspected >= 5 → can't be medium
    const confidenceHigh = calculateConfidence(0.95, {});
    expect(confidenceHigh).toBe("low");

    const confidenceMedium = calculateConfidence(0.75, {});
    expect(confidenceMedium).toBe("low");

    const confidenceLow = calculateConfidence(0.5, {});
    expect(confidenceLow).toBe("low");
  });
});

// ─── Full Score Calculation ───────────────────────────────────────────────────

describe("calculateScore", () => {
  it("produces a complete ScoreResult with all fields", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "SEO-001", category: "on_page", importance_weight: 3 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }),
      makeRuleResult({ rule_id: "SEO-001", result: "pass" }),
    ];
    const config = makeScoringConfig();
    const score = calculateScore(results, rules, config, {});

    expect(score.methodology_version).toBe("0.1.0-draft");
    expect(score.presence_readiness).not.toBeNull();
    expect(score.pre_cap_value).not.toBeNull();
    expect(score.categories).toHaveLength(7);
    expect(score.applied_caps).toHaveLength(0);
    expect(typeof score.coverage).toBe("number");
    expect(["high", "medium", "low"]).toContain(score.confidence);
  });

  it("applies critical cap to final readiness", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
      { id: "SEO-001", category: "on_page", importance_weight: 3 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "fail" }), // triggers cap at 20
      makeRuleResult({ rule_id: "SEO-001", result: "pass" }),
    ];
    const config = makeScoringConfig();
    const score = calculateScore(results, rules, config, {});

    expect(score.pre_cap_value).toBeGreaterThan(20);
    expect(score.presence_readiness).toBeCloseTo(20);
    expect(score.applied_caps).toHaveLength(1);
    expect(score.applied_caps[0].cap_id).toBe("homepage_unretrievable");
  });

  it("returns null readiness when no categories are measurable", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
    ]);
    const results: RuleResult[] = [makeRuleResult({ rule_id: "CRW-001", result: "unavailable" })];
    const config = makeScoringConfig();
    const score = calculateScore(results, rules, config, {});

    expect(score.presence_readiness).toBeNull();
    expect(score.pre_cap_value).toBeNull();
    expect(score.unavailable_categories).toContain("crawlability");
  });

  it("calculates coverage correctly", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5, scored: true },
      { id: "CRW-002", category: "crawlability", importance_weight: 4, scored: true },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass" }), // measurable
      makeRuleResult({ rule_id: "CRW-002", result: "unavailable" }), // not measurable
    ];
    const config = makeScoringConfig();
    const score = calculateScore(results, rules, config, {});

    // coverage = 5 / (5 + 4) = 0.555...
    expect(score.coverage).toBeCloseTo(5 / 9, 4);
  });

  it("only uses site-scope results for scoring (excludes template scope)", () => {
    const rules = makeCatalogRules([
      { id: "CRW-001", category: "crawlability", importance_weight: 5 },
    ]);
    const results: RuleResult[] = [
      makeRuleResult({ rule_id: "CRW-001", result: "pass", scope: "site" }),
      makeRuleResult({
        rule_id: "CRW-001",
        result: "fail",
        scope: "template",
        template_cluster_key: "blog:d2",
      }),
    ];
    const config = makeScoringConfig();
    const score = calculateScore(results, rules, config, {});

    // Only site-scope result counts: pass → 100
    const crawlScore = score.categories.find((c) => c.category === "crawlability");
    expect(crawlScore!.value).toBeCloseTo(100);
  });
});
