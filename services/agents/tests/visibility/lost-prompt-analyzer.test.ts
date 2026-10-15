import { describe, it, expect } from "vitest";
import { findLostPrompts } from "../../src/visibility/lost-prompt-analyzer.js";
import type { PromptRun, Citation } from "../../src/visibility/types.js";

function makeRun(overrides: Partial<PromptRun> = {}): PromptRun {
  return {
    run_id: "run-1",
    panel_run_id: "pr-1",
    audit_id: "audit-1",
    prompt_set_id: "ps-1",
    prompt_id: "p-1",
    prompt_family: "discovery",
    final_prompt: "test prompt",
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
    brand_mentioned: false,
    mention_spans: [],
    recommended: null,
    brand_url_cited: false,
    match_confidence: null,
    competitors_mentioned: ["rival.com"],
    cited_urls: ["https://rival.com/services"],
    citation_ids: ["c-1"],
    accuracy_issue_ids: [],
    injection_suspected: false,
    analysis_method: "deterministic",
    lineage: { prompt_template_id: "t", seed_ref: null },
    ...overrides,
  };
}

describe("findLostPrompts", () => {
  it("identifies prompts where competitors appear but brand does not", () => {
    const runs = [
      makeRun({
        run_id: "r1",
        prompt_id: "p1",
        brand_mentioned: false,
        competitors_mentioned: ["rival.com"],
        cited_urls: ["https://rival.com/page"],
      }),
      makeRun({
        run_id: "r2",
        prompt_id: "p2",
        brand_mentioned: true,
        competitors_mentioned: ["rival.com"],
        cited_urls: [],
      }),
    ];
    const citations: Citation[] = [
      {
        citation_id: "c-1",
        url: "https://rival.com/page",
        owner_class: "competitor",
        position: 1,
        in_final_answer: true,
        fetched_evidence_id: null,
      },
    ];

    const lost = findLostPrompts(runs, citations);
    expect(lost).toHaveLength(1);
    expect(lost[0]!.prompt_id).toBe("p1");
    expect(lost[0]!.competitor_cited_urls).toContain("https://rival.com/page");
  });

  it("returns empty when brand is mentioned in all runs", () => {
    const runs = [makeRun({ brand_mentioned: true, competitors_mentioned: [] })];
    const lost = findLostPrompts(runs, []);
    expect(lost).toHaveLength(0);
  });

  it("returns empty when no competitors mentioned either", () => {
    const runs = [makeRun({ brand_mentioned: false, competitors_mentioned: [] })];
    const lost = findLostPrompts(runs, []);
    expect(lost).toHaveLength(0);
  });

  it("sets recheck_after to 4 weeks from now", () => {
    const runs = [makeRun({ brand_mentioned: false, competitors_mentioned: ["rival.com"] })];
    const lost = findLostPrompts(runs, []);
    const fourWeeks = 4 * 7 * 24 * 60 * 60 * 1000;
    const expected = Date.now() + fourWeeks;
    expect(lost[0]!.recheck_after.getTime()).toBeGreaterThan(expected - 1000);
    expect(lost[0]!.recheck_after.getTime()).toBeLessThan(expected + 1000);
  });
});
