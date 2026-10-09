import { describe, it, expect } from "vitest";
import { computeMetrics } from "../../src/visibility/metrics-engine.js";
import type { PromptRun } from "../../src/visibility/types.js";

function makeRun(overrides: Partial<PromptRun> = {}): PromptRun {
  return {
    run_id: `run-${Math.random()}`,
    panel_run_id: "pr-1",
    audit_id: "audit-1",
    prompt_set_id: "ps-1",
    prompt_id: "p-1",
    prompt_family: "discovery",
    final_prompt: "test",
    repeat_index: 0,
    engine: "gemini",
    model_id: "gemini-2.0-flash",
    market: "SA",
    language: "en",
    location: null,
    authentication_state: "anonymous",
    started_at: new Date(),
    completed_at: new Date(),
    status: "valid",
    error_class: null,
    counted_in_denominator: true,
    response_evidence_id: null,
    brand_mentioned: true,
    mention_spans: [],
    recommended: false,
    brand_url_cited: false,
    match_confidence: null,
    competitors_mentioned: [],
    cited_urls: [],
    citation_ids: [],
    accuracy_issue_ids: [],
    injection_suspected: false,
    analysis_method: "deterministic",
    lineage: { prompt_template_id: "t", seed_ref: null },
    ...overrides,
  };
}

describe("computeMetrics", () => {
  it("returns unavailable metrics when zero valid runs", () => {
    const runs = [makeRun({ status: "error", counted_in_denominator: null, brand_mentioned: null })];
    const metrics = computeMetrics(runs, 5);
    expect(metrics.mention_rate).toBeNull();
    expect(metrics.recommendation_rate).toBeNull();
    expect(metrics.domain_citation_rate).toBeNull();
    expect(metrics.valid_runs).toBe(0);
  });

  it("computes mention_rate from valid runs", () => {
    const runs = [
      makeRun({ brand_mentioned: true }),
      makeRun({ brand_mentioned: true }),
      makeRun({ brand_mentioned: false }),
      makeRun({ brand_mentioned: false }),
    ];
    const metrics = computeMetrics(runs, 5);
    expect(metrics.mention_rate).toBeCloseTo(0.5);
  });

  it("excludes non-valid runs from denominator", () => {
    const runs = [
      makeRun({ brand_mentioned: true }),
      makeRun({ status: "error", counted_in_denominator: null, brand_mentioned: null }),
      makeRun({ status: "timeout", counted_in_denominator: null, brand_mentioned: null }),
    ];
    const metrics = computeMetrics(runs, 5);
    expect(metrics.valid_runs).toBe(1);
    expect(metrics.mention_rate).toBeCloseTo(1.0);
  });

  it("applies small-cell rule when valid_runs < 10", () => {
    const runs = Array.from({ length: 9 }, (_, i) => makeRun({ brand_mentioned: i < 3 }));
    const metrics = computeMetrics(runs, 5);
    expect(metrics.small_cell).toBe(true);
  });

  it("disables small-cell rule when valid_runs >= 10", () => {
    const runs = Array.from({ length: 10 }, (_, i) => makeRun({ brand_mentioned: i < 5 }));
    const metrics = computeMetrics(runs, 5);
    expect(metrics.small_cell).toBe(false);
    expect(metrics.mention_rate).toBeCloseTo(0.5);
  });

  it("computes share_of_observed_mentions", () => {
    const runs = [
      makeRun({ competitors_mentioned: ["a.com"] }),
      makeRun({ competitors_mentioned: [] }),
    ];
    const metrics = computeMetrics(runs, 5);
    expect(metrics.share_of_observed_mentions).toBeCloseTo(0.5);
  });

  it("computes provider_coverage", () => {
    const runs = [
      makeRun({ engine: "gemini" }),
      makeRun({ engine: "claude" }),
      makeRun({ engine: "gemini" }),
    ];
    const metrics = computeMetrics(runs, 5);
    expect(metrics.provider_coverage).toBeCloseTo(2 / 5);
  });

  it("counts accuracy issues", () => {
    const runs = [
      makeRun({ accuracy_issue_ids: ["ai-1", "ai-2"] }),
      makeRun({ accuracy_issue_ids: ["ai-3"] }),
    ];
    const metrics = computeMetrics(runs, 5);
    expect(metrics.accuracy_issue_count).toBe(3);
  });
});
