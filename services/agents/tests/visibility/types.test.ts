import { describe, it, expect } from "vitest";
import type {
  PromptRun,
  PromptPanelRun,
  Citation,
  AccuracyIssue,
  VisibilityIntake,
  VisibilityMetrics,
} from "../../src/visibility/types.js";

describe("Visibility types", () => {
  it("PromptRun has required fields", () => {
    const run: PromptRun = {
      run_id: "run-1",
      panel_run_id: "pr-1",
      audit_id: "audit-1",
      prompt_id: "p-1",
      prompt_family: "discovery",
      final_prompt: "What providers offer X?",
      repeat_index: 0,
      engine: "gemini",
      model_id: "gemini-2.0-flash",
      market: "SA",
      language: "en",
      started_at: new Date(),
      completed_at: new Date(),
      status: "valid",
      counted_in_denominator: true,
      brand_mentioned: true,
      recommended: null,
      brand_url_cited: false,
      competitors_mentioned: [],
      cited_urls: [],
      accuracy_issue_ids: [],
      response_evidence_id: null,
      error_class: null,
      injection_suspected: false,
      match_confidence: null,
      citation_ids: [],
      mention_spans: [],
      analysis_method: "deterministic",
      location: null,
      authentication_state: "anonymous",
      prompt_set_id: "ps-1",
      lineage: { prompt_template_id: "free-discovery", seed_ref: null },
    };
    expect(run.run_id).toBe("run-1");
    expect(run.status).toBe("valid");
    expect(run.counted_in_denominator).toBe(true);
  });

  it("PromptPanelRun tracks state machine", () => {
    const panelRun: PromptPanelRun = {
      panel_run_id: "pr-1",
      audit_id: "audit-1",
      prompt_set_id: "ps-1",
      state: "APPROVED",
      planned_runs: 8,
      valid_runs: 0,
      failed_runs: 0,
      skipped_runs: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    expect(panelRun.state).toBe("APPROVED");
  });

  it("Citation classifies owner", () => {
    const citation: Citation = {
      citation_id: "c-1",
      url: "https://example.com",
      owner_class: "owned",
      position: 1,
      in_final_answer: true,
      fetched_evidence_id: null,
    };
    expect(citation.owner_class).toBe("owned");
  });

  it("AccuracyIssue tracks issue type and status", () => {
    const issue: AccuracyIssue = {
      issue_id: "ai-1",
      run_id: "run-1",
      issue_type: "price",
      claim: "Prices start at $10",
      status: "open",
      escalation: null,
    };
    expect(issue.status).toBe("open");
  });

  it("VisibilityIntake holds audit values for prompt filling", () => {
    const intake: VisibilityIntake = {
      brand_name: "Acme",
      offering_description: "cloud hosting",
      target_audience: "startups",
      market: "SA",
      category: "hosting",
      city: null,
      use_case: null,
      requirement: null,
      brand_domain: "acme.com",
      competitor_domains: ["competitor-a.com", "competitor-b.com"],
      brand_aliases: ["Acme Corp", "Acme Hosting"],
      brand_facts: [{ claim: "Founded in 2020", category: "other" }],
    };
    expect(intake.brand_name).toBe("Acme");
  });

  it("VisibilityMetrics supports unavailable state", () => {
    const metrics: VisibilityMetrics = {
      mention_rate: null,
      recommendation_rate: null,
      domain_citation_rate: null,
      share_of_observed_mentions: 0.5,
      accuracy_issue_count: 0,
      provider_coverage: 1.0,
      valid_runs: 0,
      small_cell: true,
    };
    expect(metrics.mention_rate).toBeNull();
    expect(metrics.small_cell).toBe(true);
  });
});
