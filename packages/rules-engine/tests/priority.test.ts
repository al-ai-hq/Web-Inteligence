import { describe, expect, it } from "vitest";
import { calculatePriority } from "../src/priority.js";
import type {
  Finding,
  LoadedRule,
  RecommendationScoringConfig,
  RuleCategory,
  Severity,
} from "../src/types.js";

const config: RecommendationScoringConfig = {
  methodology_version: "0.1.0-m10",
  bandThresholds: { quickWin: 8, strategic: 3, fillIn: -3 },
  maxPlaybookBoost: 3,
  effortByCategory: {
    crawlability: 4,
    on_page: 3,
    structured_data: 5,
    aeo: 5,
    geo: 7,
    i18n_accessibility: 4,
    performance_security: 6,
  },
  timelineDefaultByCategory: {
    crawlability: 4,
    on_page: 3,
    structured_data: 5,
    aeo: 6,
    geo: 7,
    i18n_accessibility: 4,
    performance_security: 5,
  },
};

function rule(
  id: string,
  importance_weight: number,
  category: RuleCategory,
  extra: Partial<LoadedRule> = {},
): LoadedRule {
  return {
    id,
    category,
    title: id,
    importance_weight,
    scored: true,
    evaluation: "deterministic",
    connected_tier_only: false,
    applicability: "All",
    standards: {},
    fidelity_label: "computed",
    ...extra,
  };
}

function finding(
  rule_id: string,
  category: RuleCategory,
  severity: Severity = "high",
): Finding {
  return {
    rule_id,
    severity,
    evidence_ids: [`ev-${rule_id}`],
    rationale: `rationale for ${rule_id}`,
    category,
    evidence_state: "verified",
    affected_scope: { sampled: true, urls: ["/a"] },
  };
}

const options = { industry: "generic", siteStage: "growth" } as const;

describe("calculatePriority", () => {
  it("scores (impact x 2) - effort - timeline with impact = weight x 2", () => {
    // weight 5 -> impact 10; on_page effort 3, timeline 3 -> 20 - 3 - 3 = 14
    const items = calculatePriority([finding("R-1", "on_page")], [rule("R-1", 5, "on_page")], config, options);
    expect(items).toHaveLength(1);
    expect(items[0].impact_score).toBe(10);
    expect(items[0].effort_score).toBe(3);
    expect(items[0].timeline_score).toBe(3);
    expect(items[0].priority_score).toBe(14);
    expect(items[0].band).toBe("quick_win");
  });

  it("stays inside the documented -18..+18 range at both extremes", () => {
    // Highest this config can produce: on_page (effort 3, timeline 3) at weight 5.
    const max = calculatePriority([finding("R-1", "on_page")], [rule("R-1", 5, "on_page")], config, options);
    // Lowest: geo (effort 7) with a slow 10-week timeline at weight 1.
    const min = calculatePriority(
      [finding("R-1", "geo")],
      [rule("R-1", 1, "geo", { recommendation_timeline: 10 })],
      config,
      options,
    );
    expect(max[0].priority_score).toBe(14);
    expect(min[0].priority_score).toBe(-13);
    expect(max[0].priority_score).toBeLessThanOrEqual(18);
    expect(min[0].priority_score).toBeGreaterThanOrEqual(-18);
  });

  it("uses the rule-level recommendation_timeline when present", () => {
    const items = calculatePriority(
      [finding("R-1", "aeo")],
      [rule("R-1", 3, "aeo", { recommendation_timeline: 9 })],
      config,
      options,
    );
    expect(items[0].timeline_score).toBe(9);
  });

  it("falls back to the category default timeline when the rule has none", () => {
    const items = calculatePriority([finding("R-1", "aeo")], [rule("R-1", 3, "aeo")], config, options);
    expect(items[0].timeline_score).toBe(config.timelineDefaultByCategory.aeo);
  });

  it("assigns each band at its inclusive threshold", () => {
    const bandFor = (weight: number, category: RuleCategory, timeline?: number) =>
      calculatePriority(
        [finding("R-1", category)],
        [rule("R-1", weight, category, timeline === undefined ? {} : { recommendation_timeline: timeline })],
        config,
        options,
      )[0].band;

    expect(bandFor(5, "on_page")).toBe("quick_win"); // 20-3-3 = 14
    expect(bandFor(4, "on_page")).toBe("quick_win"); // 16-3-3 = 10
    expect(bandFor(4, "structured_data")).toBe("strategic"); // 16-5-5 = 6
    expect(bandFor(3, "performance_security")).toBe("fill_in"); // 12-6-5 = 1
    expect(bandFor(2, "performance_security")).toBe("fill_in"); // 8-6-5 = -3
    expect(bandFor(1, "geo")).toBe("defer"); // 4-7-7 = -10
  });

  it("carries finding evidence and rationale through unchanged", () => {
    const items = calculatePriority([finding("R-1", "on_page")], [rule("R-1", 5, "on_page")], config, options);
    expect(items[0].evidence_ids).toEqual(["ev-R-1"]);
    expect(items[0].rationale).toBe("rationale for R-1");
    expect(items[0].severity).toBe("high");
    expect(items[0].category).toBe("on_page");
  });

  it("records the industry classification and site stage as provenance", () => {
    const items = calculatePriority([finding("R-1", "on_page")], [rule("R-1", 5, "on_page")], config, {
      industry: "saas",
      siteStage: "launch",
    });
    expect(items[0].industry_classification).toBe("saas");
    expect(items[0].site_stage).toBe("launch");
    expect(items[0].playbook_id).toBeNull();
    expect(items[0].playbook_note_key).toBeNull();
  });

  it("skips findings whose rule is not in the catalog", () => {
    const items = calculatePriority(
      [finding("R-1", "on_page"), finding("UNKNOWN", "on_page")],
      [rule("R-1", 5, "on_page")],
      config,
      options,
    );
    expect(items).toHaveLength(1);
    expect(items[0].rule_id).toBe("R-1");
  });

  it("returns an empty board for no findings", () => {
    expect(calculatePriority([], [rule("R-1", 5, "on_page")], config, options)).toEqual([]);
  });

  it("orders bands quick win -> strategic -> fill-in -> defer", () => {
    const findings = [
      finding("DEFER", "geo"),
      finding("FILLIN", "performance_security"),
      finding("QUICK", "on_page"),
      finding("STRAT", "structured_data"),
    ];
    const rules = [
      rule("DEFER", 1, "geo"),
      rule("FILLIN", 2, "performance_security"),
      rule("QUICK", 5, "on_page"),
      rule("STRAT", 4, "structured_data"),
    ];
    const items = calculatePriority(findings, rules, config, options);
    expect(items.map((i) => i.band)).toEqual(["quick_win", "strategic", "fill_in", "defer"]);
  });

  it("orders by severity then score inside a band", () => {
    // Both land in quick_win: 14 and 13. The lower-scoring item is more severe.
    const findings = [finding("LOWW", "on_page", "low"), finding("CRIT", "on_page", "critical")];
    const rules = [rule("LOWW", 5, "on_page"), rule("CRIT", 4, "crawlability")];
    const items = calculatePriority(findings, rules, config, options);
    expect(items.map((i) => i.rule_id)).toEqual(["CRIT", "LOWW"]);
  });

  it("clamps impact into its documented 1..10 input domain", () => {
    // importance_weight is meant to be 1..5; a malformed 0 or 9 must not escape the domain.
    const low = calculatePriority([finding("R-1", "on_page")], [rule("R-1", 0, "on_page")], config, options);
    expect(low[0].impact_score).toBe(1);
    const high = calculatePriority([finding("R-1", "on_page")], [rule("R-1", 9, "on_page")], config, options);
    expect(high[0].impact_score).toBe(10);
  });
});
