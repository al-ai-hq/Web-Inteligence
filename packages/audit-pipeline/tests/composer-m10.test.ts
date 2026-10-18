import { describe, expect, it } from "vitest";
import type { RecommendationPriorityItem } from "@wpi/rules-engine";
import { deriveActionItems, mapPriorityItem } from "../src/composer.js";
import type { StoredFinding } from "../src/report-envelope.js";

function recommendation(overrides: Partial<RecommendationPriorityItem> = {}): RecommendationPriorityItem {
  return {
    rule_id: "SEO-001",
    severity: "high",
    category: "on_page",
    evidence_ids: ["ev-1"],
    rationale: "Title tag is missing on 4 pages",
    impact_score: 10,
    effort_score: 3,
    timeline_score: 3,
    priority_score: 14,
    band: "quick_win",
    playbook_id: "saas",
    playbook_note_key: "playbook_saas_seo_001",
    industry_classification: "saas",
    site_stage: "growth",
    ...overrides,
  };
}

function agentFinding(id: string): StoredFinding {
  return {
    id,
    agent: "auditor",
    section: "technical",
    severity: "high",
    state: "verified",
    confidence: "high",
    evidence_ids: [],
    data: { recommendation: "add alt text to product images" },
  };
}

describe("mapPriorityItem", () => {
  it("carries the four scores and the band into the stored action item", () => {
    const stored = mapPriorityItem(recommendation(), "fid-1");
    expect(stored.impact_score).toBe(10);
    expect(stored.effort_score).toBe(3);
    expect(stored.timeline_score).toBe(3);
    expect(stored.priority_score).toBe(14);
    expect(stored.band).toBe("quick_win");
    expect(stored.playbook_note_key).toBe("playbook_saas_seo_001");
    expect(stored.source_finding_id).toBe("fid-1");
  });

  it("uses the rule rationale as the detail and falls back to the rule id", () => {
    expect(mapPriorityItem(recommendation(), "fid-1").detail).toBe(
      "Title tag is missing on 4 pages",
    );
    const bare = recommendation({ rationale: undefined });
    expect(mapPriorityItem(bare, "fid-1").detail).toBe("SEO-001");
    expect(mapPriorityItem(bare, "fid-1").title).toBe("SEO-001");
  });

  it("keeps severity from the finding and marks deterministic rules as high confidence", () => {
    const stored = mapPriorityItem(recommendation({ severity: "critical", band: "defer" }), "fid-1");
    expect(stored.severity).toBe("critical");
    expect(stored.confidence).toBe("high");
  });

  it("leaves playbook metadata empty when no playbook matched", () => {
    const stored = mapPriorityItem(
      recommendation({ playbook_id: null, playbook_note_key: null }),
      "fid-1",
    );
    expect(stored.playbook_note_key).toBeNull();
  });
});

describe("deriveActionItems", () => {
  it("marks agent-derived items as un-scored rather than inventing numbers", () => {
    const items = deriveActionItems([agentFinding("f1")], 12);
    expect(items).toHaveLength(1);
    expect(items[0].band).toBeNull();
    expect(items[0].impact_score).toBeNull();
    expect(items[0].effort_score).toBeNull();
    expect(items[0].timeline_score).toBeNull();
    expect(items[0].priority_score).toBeNull();
    expect(items[0].playbook_note_key).toBeNull();
  });
});
