import { describe, it, expect } from "vitest";
import type { RuleResult, LoadedRule, RuleCategory } from "../src/types.js";
import { generateFindings } from "../src/findings.js";

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

// ─── Severity Mapping (spec §8.1) ────────────────────────────────────────────

describe("generateFindings", () => {
  describe("severity mapping", () => {
    it("maps fail + weight>=4 to critical severity", () => {
      const rule = makeRule({ id: "CRW-001", importance_weight: 4, category: "crawlability" });
      const result = makeRuleResult({ rule_id: "CRW-001", result: "fail", evidence_ids: ["ev1"] });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("critical");
      expect(findings[0].rule_id).toBe("CRW-001");
      expect(findings[0].category).toBe("crawlability");
    });

    it("maps fail + critical_cap present to critical severity (even with low weight)", () => {
      const rule = makeRule({
        id: "SPAM-001",
        importance_weight: 0,
        scored: false,
        critical_cap: "spam_policy_confirmed",
        category: "on_page",
      });
      const result = makeRuleResult({
        rule_id: "SPAM-001",
        result: "fail",
        cap_trigger: true,
        evidence_ids: ["ev1"],
      });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("critical");
    });

    it("maps fail + weight=3 to high severity", () => {
      const rule = makeRule({ id: "SEO-001", importance_weight: 3, category: "on_page" });
      const result = makeRuleResult({ rule_id: "SEO-001", result: "fail", evidence_ids: ["ev1"] });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("high");
    });

    it("maps fail + weight<=2 to medium severity", () => {
      const rule = makeRule({ id: "STR-001", importance_weight: 2, category: "structured_data" });
      const result = makeRuleResult({ rule_id: "STR-001", result: "fail", evidence_ids: ["ev1"] });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("medium");
    });

    it("maps partial + weight>=4 to high severity", () => {
      const rule = makeRule({ id: "AEO-001", importance_weight: 5, category: "aeo" });
      const result = makeRuleResult({ rule_id: "AEO-001", result: "partial", evidence_ids: ["ev1"] });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("high");
    });

    it("maps partial + weight=3 to medium severity", () => {
      const rule = makeRule({ id: "GEO-001", importance_weight: 3, category: "geo" });
      const result = makeRuleResult({ rule_id: "GEO-001", result: "partial", evidence_ids: ["ev1"] });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("medium");
    });

    it("maps partial + weight<=2 to low severity", () => {
      const rule = makeRule({ id: "I18N-001", importance_weight: 1, category: "i18n_accessibility" });
      const result = makeRuleResult({ rule_id: "I18N-001", result: "partial", evidence_ids: ["ev1"] });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("low");
    });
  });

  describe("filtering", () => {
    it("excludes pass results (no finding)", () => {
      const rule = makeRule({ id: "CRW-001", result: "pass" as any });
      const result = makeRuleResult({ rule_id: "CRW-001", result: "pass" });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(0);
    });

    it("excludes not_applicable results", () => {
      const rule = makeRule({ id: "SEO-011" });
      const result = makeRuleResult({ rule_id: "SEO-011", result: "not_applicable" });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(0);
    });

    it("excludes unavailable results", () => {
      const rule = makeRule({ id: "GSC-001" });
      const result = makeRuleResult({ rule_id: "GSC-001", result: "unavailable" });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(0);
    });

    it("excludes error results", () => {
      const rule = makeRule({ id: "CRW-002" });
      const result = makeRuleResult({ rule_id: "CRW-002", result: "error" });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(0);
    });

    it("excludes report-only unscored rules (no critical_cap) even on fail", () => {
      // GSC-003, GEO-010, AGT-002 are report-only: no finding produced
      const rule = makeRule({
        id: "GSC-003",
        importance_weight: 0,
        scored: false,
        category: "crawlability",
      });
      const result = makeRuleResult({ rule_id: "GSC-003", result: "fail" });
      const findings = generateFindings([result], [rule]);
      expect(findings).toHaveLength(0);
    });
  });

  describe("evidence_state mapping", () => {
    it("maps deterministic evaluation to verified", () => {
      const rule = makeRule({ id: "CRW-001", evaluation: "deterministic" });
      const result = makeRuleResult({ rule_id: "CRW-001", result: "fail" });
      const findings = generateFindings([result], [rule]);
      expect(findings[0].evidence_state).toBe("verified");
    });

    it("maps assessed evaluation to inferred", () => {
      const rule = makeRule({ id: "SEO-005", evaluation: "assessed" });
      const result = makeRuleResult({ rule_id: "SEO-005", result: "fail" });
      const findings = generateFindings([result], [rule]);
      expect(findings[0].evidence_state).toBe("inferred");
    });

    it("maps attested evaluation to client_stated", () => {
      const rule = makeRule({ id: "GSC-003", evaluation: "attested", importance_weight: 0, scored: false, critical_cap: "test_cap" });
      const result = makeRuleResult({ rule_id: "GSC-003", result: "fail" });
      const findings = generateFindings([result], [rule]);
      expect(findings[0].evidence_state).toBe("client_stated");
    });
  });

  describe("finding structure", () => {
    it("includes evidence_ids from the rule result", () => {
      const rule = makeRule({ id: "CRW-001" });
      const result = makeRuleResult({
        rule_id: "CRW-001",
        result: "fail",
        evidence_ids: ["ev1", "ev2", "ev3"],
      });
      const findings = generateFindings([result], [rule]);
      expect(findings[0].evidence_ids).toEqual(["ev1", "ev2", "ev3"]);
    });

    it("includes rationale when present on the result", () => {
      const rule = makeRule({ id: "SEO-005" });
      const result = makeRuleResult({
        rule_id: "SEO-005",
        result: "fail",
        rationale: "Missing meta description",
      });
      const findings = generateFindings([result], [rule]);
      expect(findings[0].rationale).toBe("Missing meta description");
    });

    it("sets affected_scope.sampled to true always", () => {
      const rule = makeRule({ id: "CRW-001" });
      const result = makeRuleResult({
        rule_id: "CRW-001",
        result: "fail",
        affected_urls: ["https://example.com/", "https://example.com/about"],
      });
      const findings = generateFindings([result], [rule]);
      expect(findings[0].affected_scope.sampled).toBe(true);
      expect(findings[0].affected_scope.urls).toEqual([
        "https://example.com/",
        "https://example.com/about",
      ]);
    });

    it("handles multiple findings from multiple failed results", () => {
      const rules = [
        makeRule({ id: "CRW-001", importance_weight: 4, category: "crawlability" }),
        makeRule({ id: "SEO-001", importance_weight: 3, category: "on_page" }),
        makeRule({ id: "STR-001", importance_weight: 2, category: "structured_data" }),
      ];
      const results = [
        makeRuleResult({ rule_id: "CRW-001", result: "fail" }),
        makeRuleResult({ rule_id: "SEO-001", result: "partial" }),
        makeRuleResult({ rule_id: "STR-001", result: "fail" }),
      ];
      const findings = generateFindings(results, rules);
      expect(findings).toHaveLength(3);
      expect(findings.map((f) => f.severity)).toEqual(["critical", "medium", "medium"]);
    });
  });
});
