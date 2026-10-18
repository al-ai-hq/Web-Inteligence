import { describe, expect, test } from "vitest";
import { applyPlaybook } from "../src/playbook-overlay.js";
import type {
  IndustryPlaybook,
  RecommendationPriorityItem,
  RecommendationScoringConfig,
} from "../src/types.js";

const config: RecommendationScoringConfig = {
  methodology_version: "test",
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

function item(rule_id: string, priority_score: number): RecommendationPriorityItem {
  return {
    rule_id,
    severity: "medium",
    category: "aeo",
    evidence_ids: [],
    impact_score: 5,
    effort_score: 5,
    timeline_score: 5,
    priority_score,
    band: "strategic",
    playbook_id: null,
    playbook_note_key: null,
    industry_classification: "generic",
    site_stage: "growth",
  };
}

function playbook(entries: IndustryPlaybook["entries"]): IndustryPlaybook {
  return { playbook_id: "saas", display_name: { en: "SaaS", ar: "SaaS" }, entries };
}

describe("applyPlaybook", () => {
  test("boosts a matching rule and leaves unmatched rules alone", () => {
    const result = applyPlaybook(
      [item("AEO-003", 6), item("AEO-004", 6)],
      playbook([{ rule_id: "AEO-003", boost: 2, note_key: "note" }]),
      config,
    );
    expect(result[0].priority_score).toBe(8);
    expect(result[0].playbook_id).toBe("saas");
    expect(result[0].playbook_note_key).toBe("note");
    expect(result[1].priority_score).toBe(6);
    expect(result[1].playbook_id).toBeNull();
  });

  test("caps the boost at maxPlaybookBoost", () => {
    const result = applyPlaybook(
      [item("AEO-003", 6)],
      playbook([{ rule_id: "AEO-003", boost: 50, note_key: null }]),
      config,
    );
    expect(result[0].priority_score).toBe(9);
  });

  test("re-derives the band from the boosted score", () => {
    const result = applyPlaybook(
      [item("AEO-003", 6)],
      playbook([{ rule_id: "AEO-003", boost: 2, note_key: null }]),
      config,
    );
    expect(result[0].priority_score).toBe(8);
    expect(result[0].band).toBe("quick_win");
  });

  test("never boosts a negative score toward a higher band", () => {
    const result = applyPlaybook(
      [item("AEO-003", -4)],
      playbook([{ rule_id: "AEO-003", boost: 2, note_key: null }]),
      config,
    );
    expect(result[0].priority_score).toBe(-2);
    expect(result[0].band).toBe("fill_in");
  });

  test("clamps a negative configured boost to zero", () => {
    const result = applyPlaybook(
      [item("AEO-003", 6)],
      playbook([{ rule_id: "AEO-003", boost: -5, note_key: null }]),
      config,
    );
    expect(result[0].priority_score).toBe(6);
  });

  test("does not mutate the input items", () => {
    const items = [item("AEO-003", 6)];
    applyPlaybook(items, playbook([{ rule_id: "AEO-003", boost: 2, note_key: null }]), config);
    expect(items[0].priority_score).toBe(6);
    expect(items[0].playbook_id).toBeNull();
  });

  test("handles an empty playbook", () => {
    const items = [item("AEO-003", 6)];
    expect(applyPlaybook(items, playbook([]), config)).toEqual(items);
  });
});
