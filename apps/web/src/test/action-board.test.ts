import { describe, expect, it } from "vitest";
import type { StoredActionItem } from "@wpi/audit-pipeline";
import {
  BAND_ORDER,
  applyPath,
  groupByBand,
  scoreSegments,
} from "../app/[locale]/audit/[id]/_components/action-board";

function item(overrides: Partial<StoredActionItem> = {}): StoredActionItem {
  return {
    title: "SAAS_AEO_003",
    detail: "Add FAQ schema to the pricing page.",
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

describe("BAND_ORDER", () => {
  it("lists bands from most to least actionable", () => {
    expect(BAND_ORDER).toEqual(["quick_win", "strategic", "fill_in", "defer"]);
  });
});

describe("groupByBand", () => {
  it("returns groups in band order", () => {
    const groups = groupByBand([
      item({ band: "defer", source_finding_id: "d" }),
      item({ band: "quick_win", source_finding_id: "q" }),
      item({ band: "fill_in", source_finding_id: "f" }),
      item({ band: "strategic", source_finding_id: "s" }),
    ]);
    expect(groups.map((g) => g.band)).toEqual(["quick_win", "strategic", "fill_in", "defer"]);
  });

  it("omits empty bands", () => {
    const groups = groupByBand([item({ band: "strategic" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.band).toBe("strategic");
  });

  it("keeps agent rows without a band instead of dropping them", () => {
    const groups = groupByBand([
      item({ band: null, source_finding_id: "agent-1" }),
      item({ band: "quick_win", source_finding_id: "q" }),
    ]);
    expect(groups.map((g) => g.band)).toEqual(["quick_win", null]);
    expect(groups[1]?.items.map((i) => i.source_finding_id)).toEqual(["agent-1"]);
  });

  it("returns no groups for an empty board", () => {
    expect(groupByBand([])).toEqual([]);
  });
});

describe("scoreSegments", () => {
  it("returns null when the score is absent", () => {
    expect(scoreSegments(null)).toBeNull();
  });

  it("maps a 1-10 score onto five segments", () => {
    expect(scoreSegments(0)).toBe(0);
    expect(scoreSegments(1)).toBe(1);
    expect(scoreSegments(5)).toBe(3);
    expect(scoreSegments(10)).toBe(5);
  });

  it("clamps out-of-range scores", () => {
    expect(scoreSegments(-2)).toBe(0);
    expect(scoreSegments(18)).toBe(5);
  });
});

describe("applyPath", () => {
  it("builds the mark-applied endpoint for an audit and finding", () => {
    expect(applyPath("audit-1", "finding-2")).toBe(
      "/api/audits/audit-1/recommendations/finding-2/apply",
    );
  });

  it("percent-encodes identifiers", () => {
    expect(applyPath("a b", "c/d")).toBe("/api/audits/a%20b/recommendations/c%2Fd/apply");
  });
});
