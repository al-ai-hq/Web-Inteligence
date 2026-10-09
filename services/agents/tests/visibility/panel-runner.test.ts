import { describe, it, expect, vi } from "vitest";
import { PanelRunner } from "../../src/visibility/panel-runner.js";
import type { ProviderAdapter, CompletionResponse } from "../../src/providers/types.js";
import type { VisibilityIntake } from "../../src/visibility/types.js";
import { CostLedger } from "../../src/providers/cost-ledger.js";

function mockAdapter(name: string, response: string): ProviderAdapter {
  return {
    name,
    isAvailable: () => true,
    complete: vi.fn().mockResolvedValue({
      content: response,
      usage: { tokens_in: 10, tokens_out: 5 },
      finishReason: "stop",
    } satisfies CompletionResponse),
  };
}

function unavailableAdapter(name: string): ProviderAdapter {
  return {
    name,
    isAvailable: () => false,
    complete: vi.fn(),
  };
}

const intake: VisibilityIntake = {
  brand_name: "Acme",
  offering_description: "hosting",
  target_audience: "startups",
  market: "SA",
  category: "hosting",
  city: null,
  use_case: null,
  requirement: null,
  brand_domain: "acme.com",
  competitor_domains: ["rival.com"],
  brand_aliases: [],
  brand_facts: [],
};

const templates = [
  { id: "free-discovery", panel: "free" as const, branded: false, text: "Which organizations provide {offering} for {audience} in {market}?", placeholders: ["offering", "audience", "market"] },
];

describe("PanelRunner", () => {
  it("executes prompts across adapters and returns results", async () => {
    const adapters = [mockAdapter("gemini", "Acme is great."), mockAdapter("claude", "I recommend Acme.")];
    const ledger = new CostLedger();
    const runner = new PanelRunner();

    const result = await runner.execute(intake, templates, adapters, ledger, 1);

    expect(result.panel_run.state).toBe("COMPLETE");
    expect(result.runs.length).toBe(2);
    expect(result.runs.every((r) => r.status === "valid")).toBe(true);
    expect(result.metrics.valid_runs).toBe(2);
  });

  it("creates skipped_breaker runs when adapter is unavailable", async () => {
    const adapters = [unavailableAdapter("gemini"), mockAdapter("claude", "Acme is good.")];
    const ledger = new CostLedger();
    const runner = new PanelRunner();

    const result = await runner.execute(intake, templates, adapters, ledger, 1);

    const skipped = result.runs.filter((r) => r.status === "skipped_breaker");
    expect(skipped.length).toBe(1);
    expect(skipped[0]!.counted_in_denominator).toBeNull();
  });

  it("creates error runs when adapter throws", async () => {
    const failingAdapter: ProviderAdapter = {
      name: "openai",
      isAvailable: () => true,
      complete: vi.fn().mockRejectedValue(new Error("API down")),
    };
    const adapters = [failingAdapter];
    const ledger = new CostLedger();
    const runner = new PanelRunner();

    const result = await runner.execute(intake, templates, adapters, ledger, 1);

    expect(result.runs[0]!.status).toBe("error");
    expect(result.runs[0]!.counted_in_denominator).toBeNull();
    expect(result.panel_run.state).toBe("PARTIAL");
  });

  it("sets state to COMPLETE when all runs valid", async () => {
    const adapters = [mockAdapter("gemini", "Acme hosting is top.")];
    const ledger = new CostLedger();
    const runner = new PanelRunner();

    const result = await runner.execute(intake, templates, adapters, ledger, 1);

    expect(result.panel_run.state).toBe("COMPLETE");
    expect(result.panel_run.failed_runs).toBe(0);
  });

  it("sets state to PARTIAL when some runs fail", async () => {
    const adapters = [
      mockAdapter("gemini", "Acme is great."),
      { name: "claude", isAvailable: () => true, complete: vi.fn().mockRejectedValue(new Error("fail")) } as unknown as ProviderAdapter,
    ];
    const ledger = new CostLedger();
    const runner = new PanelRunner();

    const result = await runner.execute(intake, templates, adapters, ledger, 1);

    expect(result.panel_run.state).toBe("PARTIAL");
    expect(result.panel_run.valid_runs).toBe(1);
    expect(result.panel_run.failed_runs).toBe(1);
  });
});
