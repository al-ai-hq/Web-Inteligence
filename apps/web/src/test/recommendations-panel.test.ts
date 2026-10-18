import { describe, expect, it } from "vitest";
import type { RecommendationOutcome, StoredActionItem } from "@wpi/audit-pipeline";
import {
  formatDelta,
  measureLabelKey,
  measuredOutcomes,
  openQuickWins,
  pendingOutcomes,
} from "../services/recommendation-view";

function outcome(overrides: Partial<RecommendationOutcome> = {}): RecommendationOutcome {
  return {
    id: "outcome-1",
    user_id: "user-1",
    rule_id: "SAAS_AEO_003",
    audit_id_applied: "audit-1",
    audit_id_measured: null,
    metric: "presence_readiness",
    value_before: null,
    value_after: null,
    as_of_before: null,
    as_of_after: null,
    fidelity_label: "correlation_only",
    source: "user_marked_applied",
    created_at: "2026-10-15T00:00:00.000Z",
    updated_at: "2026-10-15T00:00:00.000Z",
    ...overrides,
  };
}

function actionItem(overrides: Partial<StoredActionItem> = {}): StoredActionItem {
  return {
    title: "SAAS_AEO_003",
    detail: "Add FAQ schema.",
    severity: "high",
    confidence: "high",
    source_finding_id: "finding-1",
    category: "aeo",
    impact_score: 8,
    effort_score: 3,
    timeline_score: 2,
    priority_score: 14,
    band: "quick_win",
    playbook_note_key: null,
    ...overrides,
  };
}

describe("measureLabelKey", () => {
  it("maps the overall score to its report label", () => {
    expect(measureLabelKey("presence_readiness")).toBe("score_title");
  });

  it("maps each rule category to its category label", () => {
    expect(measureLabelKey("crawlability")).toBe("score_category_crawlability");
    expect(measureLabelKey("i18n_accessibility")).toBe("score_category_i18n_accessibility");
  });
});

describe("formatDelta", () => {
  it("returns null when either side is missing", () => {
    expect(formatDelta(null, 70)).toBeNull();
    expect(formatDelta(60, null)).toBeNull();
  });

  it("signs percentage-point changes", () => {
    expect(formatDelta(62.4, 71.2)).toBe("+9");
    expect(formatDelta(71, 68)).toBe("-3");
    expect(formatDelta(60, 60)).toBe("0");
  });
});

describe("pendingOutcomes", () => {
  it("keeps applied records that no later audit has measured", () => {
    const rows = [outcome({ id: "a" }), outcome({ id: "b", audit_id_measured: "audit-2" })];
    expect(pendingOutcomes(rows).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("measuredOutcomes", () => {
  it("keeps records with a measuring audit and both values present", () => {
    const rows = [
      outcome({ id: "a", audit_id_measured: "audit-2", value_before: 60, value_after: 70 }),
      outcome({ id: "b", audit_id_measured: "audit-2", value_before: null, value_after: 70 }),
      outcome({ id: "c" }),
    ];
    expect(measuredOutcomes(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("openQuickWins", () => {
  it("returns quick wins the user has not marked applied", () => {
    const items = [
      actionItem({ title: "A", source_finding_id: "f-a" }),
      actionItem({ title: "B", source_finding_id: "f-b" }),
      actionItem({ title: "C", source_finding_id: "f-c", band: "defer" }),
    ];
    expect(openQuickWins(items, new Set(["B"])).map((i) => i.title)).toEqual(["A"]);
  });

  it("ignores agent rows without a band", () => {
    expect(openQuickWins([actionItem({ band: null })], new Set())).toEqual([]);
  });
});
