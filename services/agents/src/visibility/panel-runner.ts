// services/agents/src/visibility/panel-runner.ts
import type { ProviderAdapter } from "../providers/types.js";
import type { CostLedger } from "../providers/cost-ledger.js";
import { buildVisibilityPrompts, type FilledPrompt } from "./prompt-builder.js";
import { analyzeResponse } from "./response-analyzer.js";
import { computeMetrics } from "./metrics-engine.js";
import type {
  VisibilityIntake,
  PromptRun,
  PromptPanelRun,
  PanelRunResult,
  Citation,
  AccuracyIssue,
  PromptRunStatus,
} from "./types.js";

let runCounter = 0;
let panelRunCounter = 0;

interface TemplateInput {
  id: string;
  panel: "free" | "connected";
  category?: string;
  branded: boolean;
  text: string;
  placeholders: string[];
}

export class PanelRunner {
  async execute(
    intake: VisibilityIntake,
    templates: TemplateInput[],
    adapters: ProviderAdapter[],
    ledger: CostLedger,
    repeats: number,
  ): Promise<PanelRunResult> {
    const panelRunId = `pr-${++panelRunCounter}`;
    const filledPrompts = buildVisibilityPrompts(intake, templates[0]?.panel ?? "free", templates);

    const totalPlanned = filledPrompts.length * adapters.length * repeats;
    const panelRun: PromptPanelRun = {
      panel_run_id: panelRunId,
      audit_id: "pending",
      prompt_set_id: "pending",
      state: "RUNNING",
      planned_runs: totalPlanned,
      valid_runs: 0,
      failed_runs: 0,
      skipped_runs: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const runs: PromptRun[] = [];
    const allCitations: Citation[] = [];
    const allIssues: AccuracyIssue[] = [];

    for (const prompt of filledPrompts) {
      for (const adapter of adapters) {
        for (let rep = 0; rep < repeats; rep++) {
          runCounter++;
          const runId = `run-${runCounter}`;
          const startedAt = new Date();

          if (!adapter.isAvailable()) {
            runs.push(this.makeRun(runId, panelRunId, prompt, adapter.name, intake, startedAt, "skipped_breaker", null));
            panelRun.skipped_runs++;
            continue;
          }

          try {
            const response = await adapter.complete({
              model: adapter.name === "gemini" ? "gemini-2.0-flash" : "default",
              systemPrompt: "You are a helpful assistant answering questions about businesses and services.",
              userPrompt: prompt.final_prompt,
            });

            const analysis = analyzeResponse(response.content, intake, prompt.category ?? prompt.panel);

            ledger.postCallRecord({
              audit_id: "pending",
              provider: adapter.name,
              model_id: "default",
              tokens_in: response.usage.tokens_in,
              tokens_out: response.usage.tokens_out,
              amount: 0,
              workflow: "prompt_panel",
            });

            const run = this.makeRun(runId, panelRunId, prompt, adapter.name, intake, startedAt, "valid", null);
            run.brand_mentioned = analysis.brand_mentioned;
            run.mention_spans = analysis.mention_spans;
            run.competitors_mentioned = analysis.competitors_mentioned;
            run.citation_ids = analysis.citations.map((c) => c.citation_id);
            run.cited_urls = analysis.citations.map((c) => c.url);
            run.brand_url_cited = analysis.brand_url_cited;
            run.accuracy_issue_ids = analysis.accuracy_issues.map((a) => a.issue_id);
            run.counted_in_denominator = true;

            runs.push(run);
            allCitations.push(...analysis.citations);
            allIssues.push(...analysis.accuracy_issues);
            panelRun.valid_runs++;
          } catch {
            runs.push(this.makeRun(runId, panelRunId, prompt, adapter.name, intake, startedAt, "error", "provider_error"));
            panelRun.failed_runs++;
          }
        }
      }
    }

    panelRun.state = panelRun.failed_runs > 0 || panelRun.skipped_runs > 0 ? "PARTIAL" : "COMPLETE";
    panelRun.updated_at = new Date();

    const metrics = computeMetrics(runs, adapters.length);

    return { panel_run: panelRun, runs, citations: allCitations, accuracy_issues: allIssues, metrics };
  }

  private makeRun(
    runId: string,
    panelRunId: string,
    prompt: FilledPrompt,
    engine: string,
    intake: VisibilityIntake,
    startedAt: Date,
    status: PromptRunStatus,
    errorClass: string | null,
  ): PromptRun {
    return {
      run_id: runId,
      panel_run_id: panelRunId,
      audit_id: "pending",
      prompt_set_id: "pending",
      prompt_id: prompt.prompt_id,
      prompt_family: prompt.category ?? prompt.panel,
      final_prompt: prompt.final_prompt,
      repeat_index: 0,
      engine: engine as PromptRun["engine"],
      model_id: "default",
      market: intake.market,
      language: "en",
      location: null,
      authentication_state: "anonymous",
      started_at: startedAt,
      completed_at: new Date(),
      status,
      error_class: errorClass,
      counted_in_denominator: status === "valid" ? true : null,
      response_evidence_id: null,
      brand_mentioned: status === "valid" ? false : null,
      mention_spans: [],
      recommended: null,
      brand_url_cited: status === "valid" ? false : null,
      match_confidence: null,
      competitors_mentioned: [],
      cited_urls: [],
      citation_ids: [],
      accuracy_issue_ids: [],
      injection_suspected: false,
      analysis_method: "deterministic",
      lineage: { prompt_template_id: prompt.template_id, seed_ref: null },
    };
  }
}
