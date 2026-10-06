import { describe, it, expect } from "vitest";
import type {
  Finding,
  RuleResult,
  LoadedRule,
  RuleCategory,
  ConfidenceLevel,
} from "../src/types.js";
import { calculatePriority } from "../src/priority.js";

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

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    rule_id: "CRW-001",
    severity: "high",
    evidence_ids: ["e1"],
    category: "crawlability",
    evidence_state: "verified",
    affected_scope: { sampled: true, urls: ["https://example.com/"] },
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

// ─── Priority Value Calculation (spec §8.2) ──────────────────────────────────

describe("calculatePriority", () => {
  describe("priority_value formula", () => {
    it("calculates priority_value = impact * reach * confidence_factor / effort", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 4, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "critical",
        category: "crawlability",
        affected_scope: { sampled: true, urls: ["u1", "u2", "u3", "u4"] },
      });
      // impact=4, reach=ceil(5*4/10)=2, confidence_factor=1.0 (high), effort=2 (crawlability)
      // priority_value = 4 * 2 * 1.0 / 2 = 4.0
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 10,
      });
      expect(items).toHaveLength(1);
      expect(items[0].priority_value).toBe(4);
    });

    it("uses medium confidence_factor of 0.75", () => {
      const rule = makeRule({ id: "SEO-001", importance_weight: 3, category: "on_page" });
      const finding = makeFinding({
        rule_id: "SEO-001",
        severity: "high",
        category: "on_page",
        affected_scope: { sampled: true, urls: ["u1", "u2", "u3", "u4", "u5"] },
      });
      // impact=3, reach=ceil(5*5/10)=3, confidence_factor=0.75, effort=2 (on_page)
      // priority_value = 3 * 3 * 0.75 / 2 = 3.375
      const items = calculatePriority([finding], [rule], {
        confidence_level: "medium",
        pages_checked: 10,
      });
      expect(items[0].priority_value).toBeCloseTo(3.375);
    });

    it("uses low confidence_factor of 0.5", () => {
      const rule = makeRule({ id: "GEO-001", importance_weight: 5, category: "geo" });
      const finding = makeFinding({
        rule_id: "GEO-001",
        severity: "critical",
        category: "geo",
        affected_scope: { sampled: true, urls: ["u1", "u2"] },
      });
      // impact=5, reach=ceil(5*2/10)=1, confidence_factor=0.5, effort=4 (geo)
      // priority_value = 5 * 1 * 0.5 / 4 = 0.625
      const items = calculatePriority([finding], [rule], {
        confidence_level: "low",
        pages_checked: 10,
      });
      expect(items[0].priority_value).toBeCloseTo(0.625);
    });

    it("clamps reach to minimum 1", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 3, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "high",
        category: "crawlability",
        affected_scope: { sampled: true, urls: [] },
      });
      // 0 affected pages → reach should be 1 (minimum)
      // impact=3, reach=1, confidence_factor=1.0, effort=2
      // priority_value = 3 * 1 * 1.0 / 2 = 1.5
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 10,
      });
      expect(items[0].priority_value).toBe(1.5);
    });

    it("clamps reach to maximum 5", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 3, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "high",
        category: "crawlability",
        affected_scope: { sampled: true, urls: Array.from({ length: 20 }, (_, i) => `u${i}`) },
      });
      // 20 affected out of 10 checked → ceil(5*20/10) = 10 → clamped to 5
      // impact=3, reach=5, confidence_factor=1.0, effort=2
      // priority_value = 3 * 5 * 1.0 / 2 = 7.5
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 10,
      });
      expect(items[0].priority_value).toBe(7.5);
    });
  });

  describe("effort per category", () => {
    it("uses effort=2 for crawlability", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 2, category: "crawlability" });
      const finding = makeFinding({ rule_id: "CRW-001", category: "crawlability" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      // impact=2, reach=ceil(5*1/5)=1, effort=2 → 2*1*1.0/2 = 1.0
      expect(items[0].priority_value).toBe(1.0);
    });

    it("uses effort=2 for on_page", () => {
      const rule = makeRule({ id: "SEO-001", importance_weight: 2, category: "on_page" });
      const finding = makeFinding({ rule_id: "SEO-001", category: "on_page" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].priority_value).toBe(1.0);
    });

    it("uses effort=3 for structured_data", () => {
      const rule = makeRule({ id: "STR-001", importance_weight: 3, category: "structured_data" });
      const finding = makeFinding({ rule_id: "STR-001", category: "structured_data" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      // impact=3, reach=1, effort=3 → 3*1*1.0/3 = 1.0
      expect(items[0].priority_value).toBe(1.0);
    });

    it("uses effort=3 for aeo", () => {
      const rule = makeRule({ id: "AEO-001", importance_weight: 3, category: "aeo" });
      const finding = makeFinding({ rule_id: "AEO-001", category: "aeo" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].priority_value).toBe(1.0);
    });

    it("uses effort=4 for geo", () => {
      const rule = makeRule({ id: "GEO-001", importance_weight: 4, category: "geo" });
      const finding = makeFinding({ rule_id: "GEO-001", category: "geo" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      // impact=4, reach=1, effort=4 → 4*1*1.0/4 = 1.0
      expect(items[0].priority_value).toBe(1.0);
    });

    it("uses effort=3 for i18n_accessibility", () => {
      const rule = makeRule({ id: "I18N-001", importance_weight: 3, category: "i18n_accessibility" });
      const finding = makeFinding({ rule_id: "I18N-001", category: "i18n_accessibility" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].priority_value).toBe(1.0);
    });

    it("uses effort=3 for performance_security", () => {
      const rule = makeRule({ id: "PRF-001", importance_weight: 3, category: "performance_security" });
      const finding = makeFinding({ rule_id: "PRF-001", category: "performance_security" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].priority_value).toBe(1.0);
    });
  });

  describe("group assignment", () => {
    it("assigns critical_blocker for critical severity findings", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 4 });
      const finding = makeFinding({ rule_id: "CRW-001", severity: "critical" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].group).toBe("critical_blocker");
    });

    it("assigns quick_win when effort<=2 and impact>=3", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 3, category: "crawlability" });
      const finding = makeFinding({ rule_id: "CRW-001", severity: "high" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      // effort=2 (crawlability), impact=3 → quick_win
      expect(items[0].group).toBe("quick_win");
    });

    it("assigns strategic_opportunity when effort>=4", () => {
      const rule = makeRule({ id: "GEO-001", importance_weight: 2, category: "geo" });
      const finding = makeFinding({ rule_id: "GEO-001", severity: "medium", category: "geo" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      // effort=4 (geo) → strategic_opportunity
      expect(items[0].group).toBe("strategic_opportunity");
    });

    it("assigns polish for remaining findings", () => {
      const rule = makeRule({ id: "STR-001", importance_weight: 2, category: "structured_data" });
      const finding = makeFinding({ rule_id: "STR-001", severity: "low" });
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      // effort=3, impact=2 → not quick_win (impact<3), not strategic (effort<4) → polish
      expect(items[0].group).toBe("polish");
    });

    it("assigns measurement_fix for unavailable results", () => {
      const rule = makeRule({ id: "GSC-001", importance_weight: 3, category: "crawlability" });
      const unavailableResult = makeRuleResult({
        rule_id: "GSC-001",
        result: "unavailable",
      });
      const items = calculatePriority([], [rule], {
        confidence_level: "high",
        pages_checked: 5,
        unavailable_results: [unavailableResult],
      });
      expect(items).toHaveLength(1);
      expect(items[0].group).toBe("measurement_fix");
    });
  });

  describe("display band assignment", () => {
    it("assigns band 1 for priority_value >= 10", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 5, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "critical",
        affected_scope: { sampled: true, urls: Array.from({ length: 10 }, (_, i) => `u${i}`) },
      });
      // impact=5, reach=5, effort=2, confidence=high → 5*5*1.0/2 = 12.5 → band 1
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 10,
      });
      expect(items[0].display_band).toBe(1);
    });

    it("assigns band 2 for priority_value >= 6 and < 10", () => {
      const rule = makeRule({ id: "SEO-001", importance_weight: 4, category: "on_page" });
      const finding = makeFinding({
        rule_id: "SEO-001",
        severity: "high",
        affected_scope: { sampled: true, urls: ["u1", "u2", "u3"] },
      });
      // impact=4, reach=ceil(5*3/10)=2, effort=2 → 4*2*1.0/2 = 4.0
      // That's band 3. Let me adjust for band 2.
      // Need >=6: impact=4, reach=ceil(5*5/5)=5, effort=2 → 4*5*1.0/2 = 10 → band 1
      // Try: impact=3, reach=5, effort=2 → 3*5*1.0/2 = 7.5 → band 2
      const rule2 = makeRule({ id: "SEO-001", importance_weight: 3, category: "on_page" });
      const finding2 = makeFinding({
        rule_id: "SEO-001",
        severity: "high",
        affected_scope: { sampled: true, urls: ["u1", "u2", "u3", "u4", "u5"] },
      });
      const items = calculatePriority([finding2], [rule2], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].display_band).toBe(2);
    });

    it("assigns band 3 for priority_value >= 3 and < 6", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 3, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "high",
        affected_scope: { sampled: true, urls: ["u1", "u2"] },
      });
      // impact=3, reach=ceil(5*2/5)=2, effort=2 → 3*2*1.0/2 = 3.0 → band 3
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].display_band).toBe(3);
    });

    it("assigns band 4 for priority_value < 3", () => {
      const rule = makeRule({ id: "STR-001", importance_weight: 1, category: "structured_data" });
      const finding = makeFinding({
        rule_id: "STR-001",
        severity: "low",
        affected_scope: { sampled: true, urls: ["u1"] },
      });
      // impact=1, reach=1, effort=3 → 1*1*1.0/3 = 0.333 → band 4
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].display_band).toBe(4);
    });
  });

  describe("horizon assignment", () => {
    it("assigns 0-30d for critical display band", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 5, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "critical",
        affected_scope: { sampled: true, urls: Array.from({ length: 10 }, (_, i) => `u${i}`) },
      });
      // priority_value = 5*5*1.0/2 = 12.5 → band 1 → 0-30d
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 10,
      });
      expect(items[0].horizon).toBe("0-30d");
    });

    it("assigns 0-30d for critical_blocker group regardless of band", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 4, category: "crawlability" });
      const finding = makeFinding({
        rule_id: "CRW-001",
        severity: "critical",
        affected_scope: { sampled: true, urls: [] },
      });
      // Even with low reach, critical_blocker → 0-30d
      const items = calculatePriority([finding], [rule], {
        confidence_level: "low",
        pages_checked: 10,
      });
      expect(items[0].group).toBe("critical_blocker");
      expect(items[0].horizon).toBe("0-30d");
    });

    it("assigns 31-60d for high or medium display band", () => {
      const rule = makeRule({ id: "SEO-001", importance_weight: 3, category: "on_page" });
      const finding = makeFinding({
        rule_id: "SEO-001",
        severity: "high",
        affected_scope: { sampled: true, urls: ["u1", "u2"] },
      });
      // impact=3, reach=2, effort=2 → 3*2*1.0/2 = 3.0 → band 3 → 31-60d
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].display_band).toBe(3);
      expect(items[0].horizon).toBe("31-60d");
    });

    it("assigns 61-90d for low display band", () => {
      const rule = makeRule({ id: "STR-001", importance_weight: 1, category: "structured_data" });
      const finding = makeFinding({
        rule_id: "STR-001",
        severity: "low",
        affected_scope: { sampled: true, urls: ["u1"] },
      });
      // impact=1, reach=1, effort=3 → 0.333 → band 4 → 61-90d
      const items = calculatePriority([finding], [rule], {
        confidence_level: "high",
        pages_checked: 5,
      });
      expect(items[0].display_band).toBe(4);
      expect(items[0].horizon).toBe("61-90d");
    });
  });

  describe("sorting", () => {
    it("sorts by priority_value descending", () => {
      const rules = [
        makeRule({ id: "CRW-001", importance_weight: 5, category: "crawlability" }),
        makeRule({ id: "SEO-001", importance_weight: 2, category: "on_page" }),
        makeRule({ id: "STR-001", importance_weight: 3, category: "structured_data" }),
      ];
      const findings = [
        makeFinding({ rule_id: "SEO-001", severity: "medium", category: "on_page" }),
        makeFinding({ rule_id: "CRW-001", severity: "critical", category: "crawlability" }),
        makeFinding({ rule_id: "STR-001", severity: "high", category: "structured_data" }),
      ];
      const items = calculatePriority(findings, rules, {
        confidence_level: "high",
        pages_checked: 5,
      });
      // CRW-001: 5*1*1.0/2 = 2.5 (critical_blocker)
      // STR-001: 3*1*1.0/3 = 1.0 (polish)
      // SEO-001: 2*1*1.0/2 = 1.0 (polish)
      // But critical_blockers sort first, then by priority_value
      expect(items[0].rule_id).toBe("CRW-001");
      expect(items[0].group).toBe("critical_blocker");
      // Remaining sorted by priority_value desc
      expect(items[1].priority_value).toBeGreaterThanOrEqual(items[2].priority_value);
    });

    it("sorts measurement_fix items after critical_blockers", () => {
      const rules = [
        makeRule({ id: "CRW-001", importance_weight: 5, category: "crawlability" }),
        makeRule({ id: "GSC-001", importance_weight: 3, category: "crawlability" }),
      ];
      const findings = [
        makeFinding({ rule_id: "CRW-001", severity: "critical", category: "crawlability" }),
      ];
      const unavailable = [
        makeRuleResult({ rule_id: "GSC-001", result: "unavailable" }),
      ];
      const items = calculatePriority(findings, rules, {
        confidence_level: "high",
        pages_checked: 5,
        unavailable_results: unavailable,
      });
      // critical_blocker first, then measurement_fix
      expect(items[0].group).toBe("critical_blocker");
      expect(items[1].group).toBe("measurement_fix");
    });
  });

  describe("measurement_fix priority_value", () => {
    it("calculates with impact=weight, reach=5, effort=1", () => {
      const rule = makeRule({ id: "GSC-001", importance_weight: 3, category: "crawlability" });
      const unavailable = makeRuleResult({ rule_id: "GSC-001", result: "unavailable" });
      const items = calculatePriority([], [rule], {
        confidence_level: "high",
        pages_checked: 10,
        unavailable_results: [unavailable],
      });
      // impact=3, reach=5, effort=1, confidence_factor=1.0
      // priority_value = 3 * 5 * 1.0 / 1 = 15
      expect(items[0].priority_value).toBe(15);
      expect(items[0].group).toBe("measurement_fix");
    });
  });
});
