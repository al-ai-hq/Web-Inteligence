# M6 — AI Visibility Laboratory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Visibility Laboratory — 5 provider adapters, prompt panel execution, response analysis, and metrics computation — to test how AI providers respond to prompts about audited websites.

**Architecture:** Extends the existing `ProviderAdapter` interface in `services/agents/src/providers/` with 4 new adapters (Claude, OpenAI, Perplexity, Grok), evolves the circuit breaker and cost tracker to match their JSON schemas, and adds a new `visibility/` module under `services/agents/src/` containing the panel runner, prompt builder, response analyzer, metrics engine, and lost-prompt analyzer.

**Tech Stack:** TypeScript (strict, ESM), Vitest, `@anthropic-ai/sdk`, `openai` (SDK for OpenAI + Perplexity + Grok), `yaml` (already a dependency), `zod` (already a dependency)

**Spec:** `docs/superpowers/specs/2026-10-09-m6-ai-visibility-laboratory-design.md`

## Global Constraints

- TypeScript strict mode with `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noPropertyAccessFromIndexSignature`
- ESM modules (`"type": "module"`), all imports use `.js` extension
- Vitest with `globals: false` — every test file must `import { describe, it, expect, vi } from "vitest"`
- Tests at `services/agents/tests/`, mirroring `src/` directory structure
- Run tests: `pnpm --filter @wpi/agents test`
- Build check: `pnpm --filter @wpi/agents build`
- AI Visibility results are never blended into Presence Readiness (D-012)
- Provider failures excluded from metric denominators; zero valid runs → "unavailable" not 0%
- Small-cell rule: <10 valid runs → counts not percentages

---

### Task 1: Visibility Types

**Files:**

- Create: `services/agents/src/visibility/types.ts`
- Test: `services/agents/tests/visibility/types.test.ts`

**Interfaces:**

- Consumes: JSON schemas at `schemas/prompt-run.schema.json`, `schemas/prompt-panel-run.schema.json`, `schemas/prompt-set.schema.json`, `schemas/citation.schema.json`, `schemas/accuracy-issue.schema.json`
- Produces: TypeScript interfaces used by all later visibility tasks — `PromptRun`, `PromptPanelRun`, `PromptSet`, `PromptTemplate`, `Citation`, `AccuracyIssue`, `VisibilityIntake`, `PanelRunResult`, `VisibilityMetrics`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/visibility/types.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/visibility/types.test.ts`
Expected: FAIL — module `../../src/visibility/types.js` not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/visibility/types.ts
export type Engine = "gemini" | "claude" | "openai" | "perplexity" | "grok";

export type PromptRunStatus =
  | "queued"
  | "running"
  | "valid"
  | "error"
  | "timeout"
  | "refused"
  | "skipped_budget"
  | "skipped_breaker";

export type PanelRunState =
  "APPROVED" | "BUILDING_PROMPTS" | "RUNNING" | "ANALYZING" | "COMPLETE" | "PARTIAL";

export type OwnerClass = "owned" | "competitor" | "third_party" | "unknown";

export type AccuracyIssueType =
  | "price"
  | "availability"
  | "location"
  | "service"
  | "ownership"
  | "founder"
  | "policy"
  | "contact"
  | "hours"
  | "claim"
  | "other";

export type AccuracyIssueStatus =
  | "open"
  | "correction_planned"
  | "owned_source_corrected"
  | "third_party_request_sent"
  | "recheck_resolved"
  | "recheck_persisting"
  | "escalated"
  | "dismissed";

export type EscalationReason =
  "legal" | "defamation" | "trademark" | "fraud" | "disputed_claim" | "wikipedia_wikidata";

export type CapCheckDecision =
  | "allowed"
  | "allowed_soft_cap_reached"
  | "denied_audit_hard_cap"
  | "denied_monthly_cap"
  | "denied_breaker_open";

export type PromptFamily =
  | "discovery"
  | "comparison"
  | "branded"
  | "citation"
  | "recommendation"
  | "how_to_choose"
  | "price"
  | "local"
  | "brand_facts";

export interface MentionSpan {
  start: number;
  end: number;
  text: string;
}

export interface PromptRunLineage {
  prompt_template_id: string;
  seed_ref: string | null;
}

export interface PromptRun {
  run_id: string;
  panel_run_id: string;
  audit_id: string;
  prompt_set_id: string;
  prompt_id: string;
  prompt_family: string;
  final_prompt: string;
  repeat_index: number;
  engine: Engine;
  model_id: string;
  market: string;
  language: "ar" | "en";
  location: string | null;
  authentication_state: string;
  started_at: Date;
  completed_at: Date;
  status: PromptRunStatus;
  error_class: string | null;
  counted_in_denominator: boolean | null;
  response_evidence_id: string | null;
  brand_mentioned: boolean | null;
  mention_spans: MentionSpan[];
  recommended: boolean | null;
  brand_url_cited: boolean | null;
  match_confidence: number | null;
  competitors_mentioned: string[];
  cited_urls: string[];
  citation_ids: string[];
  accuracy_issue_ids: string[];
  injection_suspected: boolean;
  analysis_method: string;
  lineage: PromptRunLineage;
}

export interface PromptPanelRun {
  panel_run_id: string;
  audit_id: string;
  prompt_set_id: string;
  project_id?: string;
  state: PanelRunState;
  planned_runs: number;
  valid_runs: number;
  failed_runs: number;
  skipped_runs: number;
  recheck_of_panel_run_id?: string;
  approved_by_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PromptTemplateEntry {
  id: string;
  panel: "free" | "connected";
  group?: string;
  category?: string;
  branded: boolean;
  text: string;
  placeholders: string[];
  source_reference?: string;
  needs_native_review?: boolean;
}

export interface PromptSet {
  prompt_set_id: string;
  purpose: "anonymous_audit" | "connected_panel" | "recheck";
  prompts: PromptTemplateEntry[];
  engines: { engine: Engine; included: boolean; omission_reason?: string }[];
  repeats: number;
  status: "draft" | "approved" | "retired";
}

export interface Citation {
  citation_id: string;
  url: string;
  owner_class: OwnerClass;
  position: number | null;
  in_final_answer: boolean;
  fetched_evidence_id: string | null;
}

export interface AccuracyIssueEscalation {
  required: boolean;
  reason: EscalationReason;
  owner_user_id: string | null;
}

export interface AccuracyIssue {
  issue_id: string;
  run_id: string;
  issue_type: AccuracyIssueType;
  claim: string;
  status: AccuracyIssueStatus;
  escalation: AccuracyIssueEscalation | null;
}

export interface BrandFact {
  claim: string;
  category: string;
}

export interface VisibilityIntake {
  brand_name: string;
  offering_description: string;
  target_audience: string;
  market: string;
  category: string;
  city: string | null;
  use_case: string | null;
  requirement: string | null;
  brand_domain: string;
  competitor_domains: string[];
  brand_aliases: string[];
  brand_facts: BrandFact[];
}

export interface VisibilityMetrics {
  mention_rate: number | null;
  recommendation_rate: number | null;
  domain_citation_rate: number | null;
  share_of_observed_mentions: number;
  accuracy_issue_count: number;
  provider_coverage: number;
  valid_runs: number;
  small_cell: boolean;
}

export interface PanelRunResult {
  panel_run: PromptPanelRun;
  runs: PromptRun[];
  citations: Citation[];
  accuracy_issues: AccuracyIssue[];
  metrics: VisibilityMetrics;
}

export interface LostPrompt {
  prompt_id: string;
  prompt_text: string;
  competitor_cited_urls: string[];
  gap_note: string;
  recheck_after: Date;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/visibility/types.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/visibility/types.ts services/agents/tests/visibility/types.test.ts
git commit -m "feat(M6): add visibility type definitions from JSON schemas"
```

---

### Task 2: Configurable Circuit Breaker

**Files:**

- Modify: `services/agents/src/providers/circuit-breaker.ts`
- Modify: `services/agents/tests/providers/circuit-breaker.test.ts`

**Interfaces:**

- Consumes: Nothing from earlier tasks
- Produces: `CircuitBreaker` class with constructor accepting `CircuitBreakerConfig`, exported `CircuitBreakerConfig` interface, `DEFAULT_CIRCUIT_BREAKER_CONFIG` constant

- [ ] **Step 1: Write failing tests for configurable thresholds**

Add these tests to the existing `services/agents/tests/providers/circuit-breaker.test.ts` file. Keep all existing tests — they must continue to pass with the default config.

Append to the existing file:

```typescript
// Append to existing describe block in services/agents/tests/providers/circuit-breaker.test.ts

it("accepts custom failure threshold", () => {
  const { CircuitBreaker } = await import("../../src/providers/circuit-breaker.js");
  const cb = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 15 * 60 * 1000 });
  for (let i = 0; i < 4; i++) cb.recordFailure();
  expect(cb.isAvailable()).toBe(true);
  cb.recordFailure();
  expect(cb.isAvailable()).toBe(false);
});

it("accepts custom cooldown period", () => {
  const { CircuitBreaker } = await import("../../src/providers/circuit-breaker.js");
  const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 });
  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  expect(cb.isAvailable()).toBe(false);

  vi.advanceTimersByTime(60_000);
  expect(cb.isAvailable()).toBe(true);
});

it("default constructor uses default config (backward compatible)", () => {
  const { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } =
    await import("../../src/providers/circuit-breaker.js");
  expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(3);
  expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.cooldownMs).toBe(15 * 60 * 1000);
  const cb = new CircuitBreaker();
  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  expect(cb.isAvailable()).toBe(false);
});
```

Note: the existing tests use `new CircuitBreaker()` with no args — they must still pass.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/providers/circuit-breaker.test.ts`
Expected: FAIL — `CircuitBreaker` constructor doesn't accept config, `DEFAULT_CIRCUIT_BREAKER_CONFIG` not exported

- [ ] **Step 3: Write minimal implementation**

Replace the entire content of `services/agents/src/providers/circuit-breaker.ts`:

```typescript
type State = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 15 * 60 * 1000,
};

export class CircuitBreaker {
  private state: State = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  isAvailable(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.config.cooldownMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.state === "half-open") {
      this.state = "open";
      this.openedAt = Date.now();
      return;
    }
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/providers/circuit-breaker.test.ts`
Expected: PASS (all original + 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/providers/circuit-breaker.ts services/agents/tests/providers/circuit-breaker.test.ts
git commit -m "feat(M6): make circuit breaker thresholds configurable"
```

---

### Task 3: Cost Ledger Evolution

**Files:**

- Create: `services/agents/src/providers/cost-ledger.ts`
- Test: `services/agents/tests/providers/cost-ledger.test.ts`

**Interfaces:**

- Consumes: `CapCheckDecision` from `visibility/types.ts`
- Produces: `CostLedger` class with `preCallCheck()`, `postCallRecord()`, `getMonthlyTotal()`, `getAuditCost()`. Exports `CostLedgerEntry`, `CostLedgerConfig`, `CapCheck` interfaces.

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/providers/cost-ledger.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CostLedger } from "../../src/providers/cost-ledger.js";

describe("CostLedger", () => {
  let ledger: CostLedger;

  beforeEach(() => {
    ledger = new CostLedger({
      monthlyHardCap: 150.0,
      paidStopAt: 140.0,
      perAuditSoftCap: 3.0,
      perAuditHardCap: 4.0,
    });
  });

  it("preCallCheck returns allowed when under all caps", () => {
    const result = ledger.preCallCheck("audit-1", 0.01);
    expect(result.decision).toBe("allowed");
    expect(result.month_to_date).toBeCloseTo(0);
  });

  it("preCallCheck returns denied_monthly_cap when monthly total exceeds paidStopAt", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 0,
      tokens_out: 0,
      amount: 140.0,
      workflow: "prompt_panel",
    });
    const result = ledger.preCallCheck("audit-2", 0.01);
    expect(result.decision).toBe("denied_monthly_cap");
  });

  it("preCallCheck returns denied_audit_hard_cap when audit cost exceeds hard cap", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 0,
      tokens_out: 0,
      amount: 4.0,
      workflow: "prompt_panel",
    });
    const result = ledger.preCallCheck("audit-1", 0.01);
    expect(result.decision).toBe("denied_audit_hard_cap");
  });

  it("preCallCheck returns allowed_soft_cap_reached when audit exceeds soft cap but not hard cap", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 0,
      tokens_out: 0,
      amount: 3.5,
      workflow: "prompt_panel",
    });
    const result = ledger.preCallCheck("audit-1", 0.01);
    expect(result.decision).toBe("allowed_soft_cap_reached");
  });

  it("postCallRecord stores entry with source post_call_actual", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 1000,
      tokens_out: 500,
      amount: 0.001,
      workflow: "prompt_panel",
    });
    expect(ledger.getAuditCost("audit-1").total_usd).toBeCloseTo(0.001);
    expect(ledger.getAuditCost("audit-1").call_count).toBe(1);
  });

  it("getMonthlyTotal sums across audits", () => {
    ledger.postCallRecord({
      audit_id: "a1",
      provider: "gemini",
      model_id: "m",
      tokens_in: 0,
      tokens_out: 0,
      amount: 1.0,
      workflow: "prompt_panel",
    });
    ledger.postCallRecord({
      audit_id: "a2",
      provider: "claude",
      model_id: "m",
      tokens_in: 0,
      tokens_out: 0,
      amount: 2.0,
      workflow: "anonymous_audit",
    });
    expect(ledger.getMonthlyTotal()).toBeCloseTo(3.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/providers/cost-ledger.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/providers/cost-ledger.ts
import type { CapCheckDecision } from "../visibility/types.js";

export interface CostLedgerConfig {
  monthlyHardCap: number;
  paidStopAt: number;
  perAuditSoftCap: number;
  perAuditHardCap: number;
}

export interface CapCheck {
  decision: CapCheckDecision;
  month_to_date: number;
  checked_at: Date;
}

export interface PostCallInput {
  audit_id: string;
  provider: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  amount: number;
  workflow:
    | "anonymous_audit"
    | "registered_audit"
    | "prompt_panel"
    | "keyword_sync"
    | "content"
    | "verification"
    | "report"
    | "other";
}

interface LedgerEntry {
  entry_id: string;
  occurred_at: Date;
  line: "paid_call";
  entry_type: "actual";
  provider: string;
  model_id: string;
  audit_id: string;
  workflow: string;
  tokens: { input: number; output: number };
  amount: number;
  source: "post_call_actual";
  reconciled: boolean;
}

const DEFAULT_CONFIG: CostLedgerConfig = {
  monthlyHardCap: 150.0,
  paidStopAt: 140.0,
  perAuditSoftCap: 3.0,
  perAuditHardCap: 4.0,
};

let entryCounter = 0;

export class CostLedger {
  private entries: LedgerEntry[] = [];
  private config: CostLedgerConfig;

  constructor(config?: Partial<CostLedgerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  preCallCheck(auditId: string, _estimatedCost: number): CapCheck {
    const monthToDate = this.getMonthlyTotal();
    const auditCost = this.getAuditCost(auditId).total_usd;

    let decision: CapCheckDecision;
    if (monthToDate >= this.config.paidStopAt) {
      decision = "denied_monthly_cap";
    } else if (auditCost >= this.config.perAuditHardCap) {
      decision = "denied_audit_hard_cap";
    } else if (auditCost > this.config.perAuditSoftCap) {
      decision = "allowed_soft_cap_reached";
    } else {
      decision = "allowed";
    }

    return { decision, month_to_date: monthToDate, checked_at: new Date() };
  }

  postCallRecord(input: PostCallInput): void {
    entryCounter++;
    this.entries.push({
      entry_id: `cle-${entryCounter}`,
      occurred_at: new Date(),
      line: "paid_call",
      entry_type: "actual",
      provider: input.provider,
      model_id: input.model_id,
      audit_id: input.audit_id,
      workflow: input.workflow,
      tokens: { input: input.tokens_in, output: input.tokens_out },
      amount: input.amount,
      source: "post_call_actual",
      reconciled: false,
    });
  }

  getAuditCost(auditId: string): { total_usd: number; call_count: number } {
    const auditEntries = this.entries.filter((e) => e.audit_id === auditId);
    return {
      total_usd: auditEntries.reduce((sum, e) => sum + e.amount, 0),
      call_count: auditEntries.length,
    };
  }

  getMonthlyTotal(): number {
    return this.entries.reduce((sum, e) => sum + e.amount, 0);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/providers/cost-ledger.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/providers/cost-ledger.ts services/agents/tests/providers/cost-ledger.test.ts
git commit -m "feat(M6): add cost ledger with pre-call cap checks"
```

---

### Task 4: Model Resolver and CompletionRequest Extensions

**Files:**

- Modify: `services/agents/src/providers/model-resolver.ts`
- Modify: `services/agents/src/providers/types.ts`
- Modify: `services/agents/tests/providers/model-resolver.test.ts`
- Test: `services/agents/tests/providers/types.test.ts` (append)

**Interfaces:**

- Consumes: Nothing from earlier tasks
- Produces: Extended `CompletionRequest` with `webSearch` and `location` fields; `MODEL_PRICING` with entries for Claude, OpenAI, Perplexity, Grok models; `resolveModelForProvider()` function

- [ ] **Step 1: Write failing tests**

Append to existing `services/agents/tests/providers/model-resolver.test.ts`:

```typescript
// Append to existing describe block

it("returns pricing for Claude model", async () => {
  const { getModelPricing } = await import("../../src/providers/model-resolver.js");
  const pricing = getModelPricing("claude-sonnet-4-20250514");
  expect(pricing.inputPer1k).toBeGreaterThan(0);
  expect(pricing.outputPer1k).toBeGreaterThan(0);
});

it("returns pricing for OpenAI model", async () => {
  const { getModelPricing } = await import("../../src/providers/model-resolver.js");
  const pricing = getModelPricing("gpt-4o");
  expect(pricing.inputPer1k).toBeGreaterThan(0);
  expect(pricing.outputPer1k).toBeGreaterThan(0);
});

it("returns pricing for Perplexity model", async () => {
  const { getModelPricing } = await import("../../src/providers/model-resolver.js");
  const pricing = getModelPricing("sonar-pro");
  expect(pricing.inputPer1k).toBeGreaterThan(0);
  expect(pricing.outputPer1k).toBeGreaterThan(0);
});

it("returns pricing for Grok model", async () => {
  const { getModelPricing } = await import("../../src/providers/model-resolver.js");
  const pricing = getModelPricing("grok-3");
  expect(pricing.inputPer1k).toBeGreaterThan(0);
  expect(pricing.outputPer1k).toBeGreaterThan(0);
});
```

Create new test file `services/agents/tests/providers/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { CompletionRequest } from "../../src/providers/types.js";

describe("CompletionRequest extensions", () => {
  it("accepts webSearch field", () => {
    const req: CompletionRequest = {
      model: "gpt-4o",
      systemPrompt: "test",
      userPrompt: "test",
      webSearch: { enabled: true, maxUses: 2 },
    };
    expect(req.webSearch?.enabled).toBe(true);
    expect(req.webSearch?.maxUses).toBe(2);
  });

  it("accepts location field", () => {
    const req: CompletionRequest = {
      model: "gemini-2.0-flash",
      systemPrompt: "test",
      userPrompt: "test",
      location: { market: "SA", language: "ar" },
    };
    expect(req.location?.market).toBe("SA");
  });

  it("webSearch and location are optional", () => {
    const req: CompletionRequest = {
      model: "gemini-2.0-flash",
      systemPrompt: "test",
      userPrompt: "test",
    };
    expect(req.webSearch).toBeUndefined();
    expect(req.location).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/agents && npx vitest run tests/providers/model-resolver.test.ts tests/providers/types.test.ts`
Expected: FAIL — new pricing entries don't exist, `webSearch`/`location` fields don't exist on `CompletionRequest`

- [ ] **Step 3: Write minimal implementation**

Modify `services/agents/src/providers/types.ts` — add to `CompletionRequest`:

```typescript
export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  content?: ContentPart[];
  toolDefinitions?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  webSearch?: { enabled: boolean; maxUses?: number };
  location?: { market: string; language: string };
}
```

Modify `services/agents/src/providers/model-resolver.ts` — add pricing entries:

```typescript
const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-2.0-flash": FLASH_PRICING,
  "gemini-2.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.01 },
  "claude-sonnet-4-20250514": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "sonar-pro": { inputPer1k: 0.001, outputPer1k: 0.001 },
  "grok-3": { inputPer1k: 0.003, outputPer1k: 0.015 },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/agents && npx vitest run tests/providers/model-resolver.test.ts tests/providers/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/providers/types.ts services/agents/src/providers/model-resolver.ts services/agents/tests/providers/model-resolver.test.ts services/agents/tests/providers/types.test.ts
git commit -m "feat(M6): extend CompletionRequest with webSearch/location, add provider pricing"
```

---

### Task 5: Claude Adapter

**Files:**

- Create: `services/agents/src/providers/claude-adapter.ts`
- Test: `services/agents/tests/providers/claude-adapter.test.ts`

**Interfaces:**

- Consumes: `ProviderAdapter`, `CompletionRequest`, `CompletionResponse` from `providers/types.ts`; `CircuitBreaker` from `providers/circuit-breaker.ts`; `CostLedger` from `providers/cost-ledger.ts`
- Produces: `ClaudeAdapter` class implementing `ProviderAdapter`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/providers/claude-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

import { ClaudeAdapter } from "../../src/providers/claude-adapter.js";

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeAdapter("test-api-key");
  });

  it("has name set to claude", () => {
    expect(adapter.name).toBe("claude");
  });

  it("reports available when circuit breaker is closed", () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it("calls Claude API and returns completion response", async () => {
    const { __mockCreate } = (await import("@anthropic-ai/sdk")) as {
      __mockCreate: ReturnType<typeof vi.fn>;
    };
    __mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hello from Claude!" }],
      usage: { input_tokens: 20, output_tokens: 10 },
      stop_reason: "end_turn",
    });

    const result = await adapter.complete({
      model: "claude-sonnet-4-20250514",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.content).toBe("Hello from Claude!");
    expect(result.usage.tokens_in).toBe(20);
    expect(result.usage.tokens_out).toBe(10);
    expect(result.finishReason).toBe("stop");
  });

  it("throws when webSearch is enabled (not supported)", async () => {
    await expect(
      adapter.complete({
        model: "claude-sonnet-4-20250514",
        systemPrompt: "test",
        userPrompt: "test",
        webSearch: { enabled: true },
      }),
    ).rejects.toThrow("web search not supported");
  });

  it("reports unavailable after 3 consecutive failures", async () => {
    const { __mockCreate } = (await import("@anthropic-ai/sdk")) as {
      __mockCreate: ReturnType<typeof vi.fn>;
    };
    __mockCreate.mockRejectedValue(new Error("API down"));

    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({
          model: "claude-sonnet-4-20250514",
          systemPrompt: "test",
          userPrompt: "test",
        })
        .catch(() => {});
    }

    expect(adapter.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/providers/claude-adapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/providers/claude-adapter.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class ClaudeAdapter implements ProviderAdapter {
  name = "claude";
  private client: Anthropic;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (request.webSearch?.enabled) {
      throw new Error("Claude: web search not supported");
    }

    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Claude adapter unavailable");
    }

    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
      });

      this.breaker.recordSuccess();

      const textBlock = response.content.find((b) => b.type === "text");
      const content = textBlock?.type === "text" ? textBlock.text : "";

      const finishReason: CompletionResponse["finishReason"] =
        response.stop_reason === "end_turn"
          ? "stop"
          : response.stop_reason === "max_tokens"
            ? "max_tokens"
            : response.stop_reason === "tool_use"
              ? "tool_use"
              : "error";

      return {
        content,
        usage: {
          tokens_in: response.usage.input_tokens,
          tokens_out: response.usage.output_tokens,
        },
        finishReason,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
```

- [ ] **Step 4: Install dependency**

Run: `pnpm --filter @wpi/agents add @anthropic-ai/sdk`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/providers/claude-adapter.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add services/agents/src/providers/claude-adapter.ts services/agents/tests/providers/claude-adapter.test.ts package.json services/agents/package.json pnpm-lock.yaml
git commit -m "feat(M6): add Claude provider adapter"
```

---

### Task 6: OpenAI Adapter

**Files:**

- Create: `services/agents/src/providers/openai-adapter.ts`
- Test: `services/agents/tests/providers/openai-adapter.test.ts`

**Interfaces:**

- Consumes: `ProviderAdapter`, `CompletionRequest`, `CompletionResponse` from `providers/types.ts`; `CircuitBreaker`; `CostLedger`
- Produces: `OpenAIAdapter` class implementing `ProviderAdapter`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/providers/openai-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

import { OpenAIAdapter } from "../../src/providers/openai-adapter.js";

describe("OpenAIAdapter", () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIAdapter("test-api-key");
  });

  it("has name set to openai", () => {
    expect(adapter.name).toBe("openai");
  });

  it("calls OpenAI API and returns completion response", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Hello from OpenAI!" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 15, completion_tokens: 8 },
    });

    const result = await adapter.complete({
      model: "gpt-4o",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.content).toBe("Hello from OpenAI!");
    expect(result.usage.tokens_in).toBe(15);
    expect(result.usage.tokens_out).toBe(8);
    expect(result.finishReason).toBe("stop");
  });

  it("maps length finish reason to max_tokens", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Partial" }, finish_reason: "length" }],
      usage: { prompt_tokens: 10, completion_tokens: 100 },
    });

    const result = await adapter.complete({
      model: "gpt-4o",
      systemPrompt: "test",
      userPrompt: "test",
    });

    expect(result.finishReason).toBe("max_tokens");
  });

  it("reports unavailable after 3 consecutive failures", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockRejectedValue(new Error("API down"));

    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({ model: "gpt-4o", systemPrompt: "t", userPrompt: "t" })
        .catch(() => {});
    }

    expect(adapter.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/providers/openai-adapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/providers/openai-adapter.ts
import OpenAI from "openai";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class OpenAIAdapter implements ProviderAdapter {
  name = "openai";
  private client: OpenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — OpenAI adapter unavailable");
    }

    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      messages.push({ role: "user", content: request.userPrompt });

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
      });

      this.breaker.recordSuccess();

      const choice = response.choices[0];
      const content = choice?.message?.content ?? "";
      const sdkReason = choice?.finish_reason ?? "";

      const finishReason: CompletionResponse["finishReason"] =
        sdkReason === "stop"
          ? "stop"
          : sdkReason === "length"
            ? "max_tokens"
            : sdkReason === "tool_calls"
              ? "tool_use"
              : "error";

      return {
        content,
        usage: {
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
        },
        finishReason,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
```

- [ ] **Step 4: Install dependency**

Run: `pnpm --filter @wpi/agents add openai`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/providers/openai-adapter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add services/agents/src/providers/openai-adapter.ts services/agents/tests/providers/openai-adapter.test.ts pnpm-lock.yaml
git commit -m "feat(M6): add OpenAI provider adapter"
```

---

### Task 7: Perplexity and Grok Adapters

**Files:**

- Create: `services/agents/src/providers/perplexity-adapter.ts`
- Create: `services/agents/src/providers/grok-adapter.ts`
- Test: `services/agents/tests/providers/perplexity-adapter.test.ts`
- Test: `services/agents/tests/providers/grok-adapter.test.ts`

**Interfaces:**

- Consumes: `ProviderAdapter`, `CompletionRequest`, `CompletionResponse`; `CircuitBreaker`; `openai` SDK (both use OpenAI-compatible APIs)
- Produces: `PerplexityAdapter`, `GrokAdapter` classes

- [ ] **Step 1: Write failing tests**

```typescript
// services/agents/tests/providers/perplexity-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

import { PerplexityAdapter } from "../../src/providers/perplexity-adapter.js";

describe("PerplexityAdapter", () => {
  let adapter: PerplexityAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PerplexityAdapter("test-api-key");
  });

  it("has name set to perplexity", () => {
    expect(adapter.name).toBe("perplexity");
  });

  it("calls Perplexity API and returns completion", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Perplexity answer" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 30, completion_tokens: 15 },
    });

    const result = await adapter.complete({
      model: "sonar-pro",
      systemPrompt: "You are helpful.",
      userPrompt: "What is X?",
    });

    expect(result.content).toBe("Perplexity answer");
    expect(result.usage.tokens_in).toBe(30);
    expect(result.finishReason).toBe("stop");
  });

  it("reports unavailable after 3 failures", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockRejectedValue(new Error("down"));
    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({ model: "sonar-pro", systemPrompt: "t", userPrompt: "t" })
        .catch(() => {});
    }
    expect(adapter.isAvailable()).toBe(false);
  });
});
```

```typescript
// services/agents/tests/providers/grok-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

import { GrokAdapter } from "../../src/providers/grok-adapter.js";

describe("GrokAdapter", () => {
  let adapter: GrokAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GrokAdapter("test-api-key");
  });

  it("has name set to grok", () => {
    expect(adapter.name).toBe("grok");
  });

  it("calls Grok API and returns completion", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Grok answer" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 25, completion_tokens: 12 },
    });

    const result = await adapter.complete({
      model: "grok-3",
      systemPrompt: "You are helpful.",
      userPrompt: "What is X?",
    });

    expect(result.content).toBe("Grok answer");
    expect(result.finishReason).toBe("stop");
  });

  it("reports unavailable after 3 failures", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockRejectedValue(new Error("down"));
    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({ model: "grok-3", systemPrompt: "t", userPrompt: "t" })
        .catch(() => {});
    }
    expect(adapter.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/agents && npx vitest run tests/providers/perplexity-adapter.test.ts tests/providers/grok-adapter.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write minimal implementations**

```typescript
// services/agents/src/providers/perplexity-adapter.ts
import OpenAI from "openai";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class PerplexityAdapter implements ProviderAdapter {
  name = "perplexity";
  private client: OpenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.perplexity.ai",
    });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Perplexity adapter unavailable");
    }

    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      messages.push({ role: "user", content: request.userPrompt });

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
      });

      this.breaker.recordSuccess();

      const choice = response.choices[0];
      return {
        content: choice?.message?.content ?? "",
        usage: {
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
        },
        finishReason: choice?.finish_reason === "stop" ? "stop" : "error",
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
```

```typescript
// services/agents/src/providers/grok-adapter.ts
import OpenAI from "openai";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class GrokAdapter implements ProviderAdapter {
  name = "grok";
  private client: OpenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Grok adapter unavailable");
    }

    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      messages.push({ role: "user", content: request.userPrompt });

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
      });

      this.breaker.recordSuccess();

      const choice = response.choices[0];
      const sdkReason = choice?.finish_reason ?? "";
      const finishReason: CompletionResponse["finishReason"] =
        sdkReason === "stop" ? "stop" : sdkReason === "length" ? "max_tokens" : "error";

      return {
        content: choice?.message?.content ?? "",
        usage: {
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
        },
        finishReason,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/agents && npx vitest run tests/providers/perplexity-adapter.test.ts tests/providers/grok-adapter.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/providers/perplexity-adapter.ts services/agents/src/providers/grok-adapter.ts services/agents/tests/providers/perplexity-adapter.test.ts services/agents/tests/providers/grok-adapter.test.ts
git commit -m "feat(M6): add Perplexity and Grok provider adapters"
```

---

### Task 8: Adapter Factory

**Files:**

- Create: `services/agents/src/providers/adapter-factory.ts`
- Test: `services/agents/tests/providers/adapter-factory.test.ts`

**Interfaces:**

- Consumes: `GeminiAdapter`, `ClaudeAdapter`, `OpenAIAdapter`, `PerplexityAdapter`, `GrokAdapter`; `ProviderAdapter` type
- Produces: `createAdapter(engine, apiKey)` function returning `ProviderAdapter`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/providers/adapter-factory.test.ts
import { describe, it, expect } from "vitest";
import { createAdapter } from "../../src/providers/adapter-factory.js";

describe("createAdapter", () => {
  it("creates GeminiAdapter for gemini", () => {
    const adapter = createAdapter("gemini", "key");
    expect(adapter.name).toBe("gemini");
  });

  it("creates ClaudeAdapter for claude", () => {
    const adapter = createAdapter("claude", "key");
    expect(adapter.name).toBe("claude");
  });

  it("creates OpenAIAdapter for openai", () => {
    const adapter = createAdapter("openai", "key");
    expect(adapter.name).toBe("openai");
  });

  it("creates PerplexityAdapter for perplexity", () => {
    const adapter = createAdapter("perplexity", "key");
    expect(adapter.name).toBe("perplexity");
  });

  it("creates GrokAdapter for grok", () => {
    const adapter = createAdapter("grok", "key");
    expect(adapter.name).toBe("grok");
  });

  it("throws for unknown engine", () => {
    expect(() => createAdapter("unknown" as any, "key")).toThrow("Unknown engine");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/providers/adapter-factory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/providers/adapter-factory.ts
import type { Engine } from "../visibility/types.js";
import type { ProviderAdapter } from "./types.js";
import { GeminiAdapter } from "./gemini-adapter.js";
import { ClaudeAdapter } from "./claude-adapter.js";
import { OpenAIAdapter } from "./openai-adapter.js";
import { PerplexityAdapter } from "./perplexity-adapter.js";
import { GrokAdapter } from "./grok-adapter.js";

export function createAdapter(engine: Engine, apiKey: string): ProviderAdapter {
  switch (engine) {
    case "gemini":
      return new GeminiAdapter(apiKey);
    case "claude":
      return new ClaudeAdapter(apiKey);
    case "openai":
      return new OpenAIAdapter(apiKey);
    case "perplexity":
      return new PerplexityAdapter(apiKey);
    case "grok":
      return new GrokAdapter(apiKey);
    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/providers/adapter-factory.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/providers/adapter-factory.ts services/agents/tests/providers/adapter-factory.test.ts
git commit -m "feat(M6): add adapter factory for engine-based instantiation"
```

---

### Task 9: Visibility Prompt Builder

**Files:**

- Create: `services/agents/src/visibility/prompt-builder.ts`
- Test: `services/agents/tests/visibility/prompt-builder.test.ts`

**Interfaces:**

- Consumes: `VisibilityIntake` from `visibility/types.ts`; template YAML at `config/prompt-panels/templates/en.yaml`
- Produces: `buildVisibilityPrompts(intake, panelTier, templates)` function returning `FilledPrompt[]`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/visibility/prompt-builder.test.ts
import { describe, it, expect } from "vitest";
import { buildVisibilityPrompts } from "../../src/visibility/prompt-builder.js";
import type { VisibilityIntake } from "../../src/visibility/types.js";

const intake: VisibilityIntake = {
  brand_name: "Acme",
  offering_description: "cloud hosting",
  target_audience: "startups",
  market: "Saudi Arabia",
  category: "hosting",
  city: "Riyadh",
  use_case: "e-commerce",
  requirement: "high uptime",
  brand_domain: "acme.com",
  competitor_domains: ["rival.com"],
  brand_aliases: ["Acme Corp"],
  brand_facts: [],
};

describe("buildVisibilityPrompts", () => {
  it("fills free panel templates with intake values", () => {
    const templates = [
      {
        id: "free-discovery",
        panel: "free" as const,
        branded: false,
        text: "Which organizations provide {offering} for {audience} in {market}?",
        placeholders: ["offering", "audience", "market"],
      },
      {
        id: "free-branded-knowledge",
        panel: "free" as const,
        branded: true,
        text: "What does {brand} do, and who does it serve?",
        placeholders: ["brand"],
      },
    ];

    const result = buildVisibilityPrompts(intake, "free", templates);
    expect(result).toHaveLength(2);
    expect(result[0]!.final_prompt).toBe(
      "Which organizations provide cloud hosting for startups in Saudi Arabia?",
    );
    expect(result[0]!.prompt_id).toBe("free-discovery");
    expect(result[1]!.final_prompt).toBe("What does Acme do, and who does it serve?");
  });

  it("fills connected panel templates", () => {
    const templates = [
      {
        id: "panel-local",
        panel: "connected" as const,
        category: "local",
        branded: false,
        text: "Which providers offer {offering} near {city}?",
        placeholders: ["offering", "city"],
      },
    ];

    const result = buildVisibilityPrompts(intake, "connected", templates);
    expect(result).toHaveLength(1);
    expect(result[0]!.final_prompt).toBe("Which providers offer cloud hosting near Riyadh?");
  });

  it("throws when required placeholder is missing", () => {
    const noCity: VisibilityIntake = { ...intake, city: null };
    const templates = [
      {
        id: "panel-local",
        panel: "connected" as const,
        category: "local",
        branded: false,
        text: "Which providers offer {offering} near {city}?",
        placeholders: ["offering", "city"],
      },
    ];

    expect(() => buildVisibilityPrompts(noCity, "connected", templates)).toThrow(
      "Missing value for placeholder: city",
    );
  });

  it("throws when unresolved placeholder remains", () => {
    const templates = [
      {
        id: "test",
        panel: "free" as const,
        branded: false,
        text: "What about {unknown_placeholder}?",
        placeholders: ["unknown_placeholder"],
      },
    ];

    expect(() => buildVisibilityPrompts(intake, "free", templates)).toThrow(
      "Missing value for placeholder: unknown_placeholder",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/visibility/prompt-builder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/visibility/prompt-builder.ts
import type { VisibilityIntake } from "./types.js";

interface TemplateInput {
  id: string;
  panel: "free" | "connected";
  category?: string;
  branded: boolean;
  text: string;
  placeholders: string[];
}

export interface FilledPrompt {
  prompt_id: string;
  panel: "free" | "connected";
  category?: string;
  branded: boolean;
  final_prompt: string;
  template_id: string;
}

const INTAKE_MAP: Record<string, keyof VisibilityIntake> = {
  brand: "brand_name",
  offering: "offering_description",
  audience: "target_audience",
  market: "market",
  city: "city",
  category: "category",
  use_case: "use_case",
  requirement: "requirement",
};

export function buildVisibilityPrompts(
  intake: VisibilityIntake,
  _panelTier: "free" | "connected",
  templates: TemplateInput[],
): FilledPrompt[] {
  return templates.map((tpl) => {
    let filled = tpl.text;

    for (const ph of tpl.placeholders) {
      const intakeKey = INTAKE_MAP[ph];
      if (!intakeKey) {
        throw new Error(`Missing value for placeholder: ${ph}`);
      }
      const value = intake[intakeKey];
      if (value === null || value === undefined) {
        throw new Error(`Missing value for placeholder: ${ph}`);
      }
      filled = filled.replaceAll(`{${ph}}`, String(value));
    }

    const unresolved = filled.match(/\{(\w+)\}/);
    if (unresolved) {
      throw new Error(`Missing value for placeholder: ${unresolved[1]}`);
    }

    return {
      prompt_id: tpl.id,
      panel: tpl.panel,
      category: tpl.category,
      branded: tpl.branded,
      final_prompt: filled,
      template_id: tpl.id,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/visibility/prompt-builder.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/visibility/prompt-builder.ts services/agents/tests/visibility/prompt-builder.test.ts
git commit -m "feat(M6): add visibility prompt builder with template filling"
```

---

### Task 10: Response Analyzer

**Files:**

- Create: `services/agents/src/visibility/response-analyzer.ts`
- Test: `services/agents/tests/visibility/response-analyzer.test.ts`

**Interfaces:**

- Consumes: `VisibilityIntake`, `Citation`, `AccuracyIssue`, `MentionSpan` from `visibility/types.ts`
- Produces: `analyzeResponse(responseText, intake, promptFamily)` function returning `AnalysisResult`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/visibility/response-analyzer.test.ts
import { describe, it, expect } from "vitest";
import { analyzeResponse } from "../../src/visibility/response-analyzer.js";
import type { VisibilityIntake } from "../../src/visibility/types.js";

const intake: VisibilityIntake = {
  brand_name: "Acme",
  offering_description: "cloud hosting",
  target_audience: "startups",
  market: "SA",
  category: "hosting",
  city: "Riyadh",
  use_case: null,
  requirement: null,
  brand_domain: "acme.com",
  competitor_domains: ["rival.com", "competitor.io"],
  brand_aliases: ["Acme Corp", "Acme Hosting"],
  brand_facts: [
    { claim: "Founded in 2020", category: "other" },
    { claim: "Based in Riyadh", category: "location" },
  ],
};

describe("analyzeResponse", () => {
  it("detects brand mention by name", () => {
    const result = analyzeResponse("Acme is a great cloud hosting provider.", intake, "discovery");
    expect(result.brand_mentioned).toBe(true);
    expect(result.mention_spans.length).toBeGreaterThan(0);
    expect(result.mention_spans[0]!.text).toBe("Acme");
  });

  it("detects brand mention by alias", () => {
    const result = analyzeResponse("I recommend Acme Corp for hosting.", intake, "discovery");
    expect(result.brand_mentioned).toBe(true);
  });

  it("returns brand_mentioned false when brand not in response", () => {
    const result = analyzeResponse("The best providers are Rival and Others.", intake, "discovery");
    expect(result.brand_mentioned).toBe(false);
    expect(result.competitors_mentioned).toContain("rival.com");
  });

  it("detects competitor mentions", () => {
    const result = analyzeResponse(
      "Check out rival.com and competitor.io for hosting.",
      intake,
      "comparison",
    );
    expect(result.competitors_mentioned.length).toBe(2);
  });

  it("classifies citations by domain ownership", () => {
    const result = analyzeResponse(
      "Visit https://acme.com for details, or see https://rival.com/pricing and https://review-site.com/acme-review",
      intake,
      "citation",
    );
    expect(result.citations).toHaveLength(3);
    expect(result.citations[0]!.owner_class).toBe("owned");
    expect(result.citations[0]!.position).toBe(1);
    expect(result.citations[1]!.owner_class).toBe("competitor");
    expect(result.citations[1]!.position).toBe(2);
    expect(result.citations[2]!.owner_class).toBe("third_party");
    expect(result.citations[2]!.position).toBe(3);
  });

  it("sets brand_url_cited when owned domain appears", () => {
    const result = analyzeResponse("See https://acme.com for more.", intake, "discovery");
    expect(result.brand_url_cited).toBe(true);
  });

  it("returns empty citations when no URLs present", () => {
    const result = analyzeResponse("Acme is a hosting company.", intake, "discovery");
    expect(result.citations).toHaveLength(0);
    expect(result.brand_url_cited).toBe(false);
  });

  it("detects accuracy issues against brand facts", () => {
    const result = analyzeResponse(
      "Acme was founded in 2018 and is based in Dubai.",
      intake,
      "brand_facts",
    );
    expect(result.accuracy_issues.length).toBeGreaterThan(0);
  });

  it("returns no accuracy issues for non-brand-facts families", () => {
    const result = analyzeResponse("Acme was founded in 2018.", intake, "discovery");
    expect(result.accuracy_issues).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/visibility/response-analyzer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/visibility/response-analyzer.ts
import type {
  VisibilityIntake,
  Citation,
  AccuracyIssue,
  MentionSpan,
  OwnerClass,
} from "./types.js";

export interface AnalysisResult {
  brand_mentioned: boolean;
  mention_spans: MentionSpan[];
  competitors_mentioned: string[];
  citations: Citation[];
  brand_url_cited: boolean;
  accuracy_issues: AccuracyIssue[];
}

const URL_REGEX = /https?:\/\/[^\s)"'>]+/g;

let citationCounter = 0;
let issueCounter = 0;

function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifyUrl(url: string, intake: VisibilityIntake): OwnerClass {
  const domain = getDomain(url);
  if (!domain) return "unknown";
  if (domain === intake.brand_domain || domain.endsWith(`.${intake.brand_domain}`)) return "owned";
  if (intake.competitor_domains.some((cd) => domain === cd || domain.endsWith(`.${cd}`)))
    return "competitor";
  return "third_party";
}

function findMentions(
  text: string,
  intake: VisibilityIntake,
): { brandSpans: MentionSpan[]; competitorDomains: string[] } {
  const brandSpans: MentionSpan[] = [];
  const names = [intake.brand_name, ...intake.brand_aliases];

  for (const name of names) {
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      brandSpans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }
  }

  const competitorDomains: string[] = [];
  for (const cd of intake.competitor_domains) {
    const domainName = cd.replace(/\.\w+$/, "").replace(/^www\./, "");
    const regex = new RegExp(`\\b${escapeRegex(domainName)}\\b`, "gi");
    if (regex.test(text)) {
      competitorDomains.push(cd);
    }
  }

  return { brandSpans, competitorDomains };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkFacts(text: string, intake: VisibilityIntake, runId: string): AccuracyIssue[] {
  const issues: AccuracyIssue[] = [];
  for (const fact of intake.brand_facts) {
    if (!text.toLowerCase().includes(fact.claim.toLowerCase())) {
      const contradictingPatterns = [/\d{4}/g];
      for (const pattern of contradictingPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          const factNumbers = fact.claim.match(/\d{4}/g) ?? [];
          for (const fn of factNumbers) {
            if (matches.some((m) => m !== fn)) {
              issueCounter++;
              issues.push({
                issue_id: `ai-${issueCounter}`,
                run_id: runId,
                issue_type: fact.category === "location" ? "location" : "other",
                claim: `Response contradicts: ${fact.claim}`,
                status: "open",
                escalation: null,
              });
              break;
            }
          }
        }
      }
    }
  }
  return issues;
}

export function analyzeResponse(
  responseText: string,
  intake: VisibilityIntake,
  promptFamily: string,
): AnalysisResult {
  const { brandSpans, competitorDomains } = findMentions(responseText, intake);

  const urls = extractUrls(responseText);
  citationCounter = 0;
  const citations: Citation[] = urls.map((url) => {
    citationCounter++;
    return {
      citation_id: `c-${citationCounter}`,
      url,
      owner_class: classifyUrl(url, intake),
      position: citationCounter,
      in_final_answer: true,
      fetched_evidence_id: null,
    };
  });

  const brandUrlCited = citations.some((c) => c.owner_class === "owned");

  const accuracyIssues =
    promptFamily === "brand_facts" || promptFamily === "branded"
      ? checkFacts(responseText, intake, "pending")
      : [];

  return {
    brand_mentioned: brandSpans.length > 0,
    mention_spans: brandSpans,
    competitors_mentioned: competitorDomains,
    citations,
    brand_url_cited: brandUrlCited,
    accuracy_issues: accuracyIssues,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/visibility/response-analyzer.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/visibility/response-analyzer.ts services/agents/tests/visibility/response-analyzer.test.ts
git commit -m "feat(M6): add response analyzer with mention, citation, and accuracy detection"
```

---

### Task 11: Metrics Engine

**Files:**

- Create: `services/agents/src/visibility/metrics-engine.ts`
- Test: `services/agents/tests/visibility/metrics-engine.test.ts`

**Interfaces:**

- Consumes: `PromptRun`, `VisibilityMetrics` from `visibility/types.ts`
- Produces: `computeMetrics(runs, totalConfiguredProviders)` function returning `VisibilityMetrics`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/visibility/metrics-engine.test.ts
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
    const runs = [
      makeRun({ status: "error", counted_in_denominator: null, brand_mentioned: null }),
    ];
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/visibility/metrics-engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/visibility/metrics-engine.ts
import type { PromptRun, VisibilityMetrics } from "./types.js";

export function computeMetrics(
  runs: PromptRun[],
  totalConfiguredProviders: number,
): VisibilityMetrics {
  const validRuns = runs.filter((r) => r.status === "valid" && r.counted_in_denominator === true);
  const validCount = validRuns.length;
  const smallCell = validCount < 10;

  const mentionRate =
    validCount === 0
      ? null
      : validRuns.filter((r) => r.brand_mentioned === true).length / validCount;

  const brandMentionedRuns = validRuns.filter((r) => r.brand_mentioned === true);
  const recommendationRate =
    brandMentionedRuns.length === 0
      ? null
      : brandMentionedRuns.filter((r) => r.recommended === true).length / brandMentionedRuns.length;

  const domainCitationRate =
    validCount === 0
      ? null
      : validRuns.filter((r) => r.brand_url_cited === true).length / validCount;

  const brandMentionCount = brandMentionedRuns.length;
  const totalMentionCount = validRuns.reduce(
    (sum, r) => sum + (r.brand_mentioned ? 1 : 0) + (r.competitors_mentioned?.length ?? 0),
    0,
  );
  const shareOfMentions = totalMentionCount === 0 ? 0 : brandMentionCount / totalMentionCount;

  const accuracyIssueCount = validRuns.reduce(
    (sum, r) => sum + (r.accuracy_issue_ids?.length ?? 0),
    0,
  );

  const enginesWithValid = new Set(validRuns.map((r) => r.engine));
  const providerCoverage =
    totalConfiguredProviders === 0 ? 0 : enginesWithValid.size / totalConfiguredProviders;

  return {
    mention_rate: mentionRate,
    recommendation_rate: recommendationRate,
    domain_citation_rate: domainCitationRate,
    share_of_observed_mentions: shareOfMentions,
    accuracy_issue_count: accuracyIssueCount,
    provider_coverage: providerCoverage,
    valid_runs: validCount,
    small_cell: smallCell,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/visibility/metrics-engine.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/visibility/metrics-engine.ts services/agents/tests/visibility/metrics-engine.test.ts
git commit -m "feat(M6): add metrics engine with valid denominators and small-cell rule"
```

---

### Task 12: Lost-Prompt Analyzer

**Files:**

- Create: `services/agents/src/visibility/lost-prompt-analyzer.ts`
- Test: `services/agents/tests/visibility/lost-prompt-analyzer.test.ts`

**Interfaces:**

- Consumes: `PromptRun`, `Citation`, `LostPrompt` from `visibility/types.ts`
- Produces: `findLostPrompts(runs, citations)` function returning `LostPrompt[]`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/visibility/lost-prompt-analyzer.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/visibility/lost-prompt-analyzer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/agents/src/visibility/lost-prompt-analyzer.ts
import type { PromptRun, Citation, LostPrompt } from "./types.js";

export function findLostPrompts(runs: PromptRun[], _citations: Citation[]): LostPrompt[] {
  const lostByPrompt = new Map<string, { run: PromptRun; urls: string[] }>();

  for (const run of runs) {
    if (run.status !== "valid") continue;
    if (run.brand_mentioned) continue;
    if (!run.competitors_mentioned || run.competitors_mentioned.length === 0) continue;

    const existing = lostByPrompt.get(run.prompt_id);
    const urls = run.cited_urls ?? [];
    if (existing) {
      existing.urls.push(...urls);
    } else {
      lostByPrompt.set(run.prompt_id, { run, urls: [...urls] });
    }
  }

  const fourWeeksMs = 4 * 7 * 24 * 60 * 60 * 1000;
  const recheckAfter = new Date(Date.now() + fourWeeksMs);

  return Array.from(lostByPrompt.values()).map(({ run, urls }) => ({
    prompt_id: run.prompt_id,
    prompt_text: run.final_prompt,
    competitor_cited_urls: [...new Set(urls)],
    gap_note: `Competitors cited in response but brand not mentioned. Competitors: ${run.competitors_mentioned.join(", ")}`,
    recheck_after: recheckAfter,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/visibility/lost-prompt-analyzer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/visibility/lost-prompt-analyzer.ts services/agents/tests/visibility/lost-prompt-analyzer.test.ts
git commit -m "feat(M6): add lost-prompt analyzer for competitor-only prompts"
```

---

### Task 13: Panel Runner

**Files:**

- Create: `services/agents/src/visibility/panel-runner.ts`
- Test: `services/agents/tests/visibility/panel-runner.test.ts`

**Interfaces:**

- Consumes: `ProviderAdapter` from `providers/types.ts`; `CostLedger` from `providers/cost-ledger.ts`; `buildVisibilityPrompts`, `FilledPrompt` from `visibility/prompt-builder.ts`; `analyzeResponse` from `visibility/response-analyzer.ts`; `computeMetrics` from `visibility/metrics-engine.ts`; `PromptRun`, `PromptPanelRun`, `PanelRunResult`, `VisibilityIntake` from `visibility/types.ts`
- Produces: `PanelRunner` class with `execute(intake, templates, adapters, ledger)` method returning `PanelRunResult`

- [ ] **Step 1: Write failing test**

```typescript
// services/agents/tests/visibility/panel-runner.test.ts
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
  {
    id: "free-discovery",
    panel: "free" as const,
    branded: false,
    text: "Which organizations provide {offering} for {audience} in {market}?",
    placeholders: ["offering", "audience", "market"],
  },
];

describe("PanelRunner", () => {
  it("executes prompts across adapters and returns results", async () => {
    const adapters = [
      mockAdapter("gemini", "Acme is great."),
      mockAdapter("claude", "I recommend Acme."),
    ];
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

    const result = await runner.execute(intake, templates, adapters, ledger, 2);

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
      {
        name: "claude",
        isAvailable: () => true,
        complete: vi.fn().mockRejectedValue(new Error("fail")),
      } as unknown as ProviderAdapter,
    ];
    const ledger = new CostLedger();
    const runner = new PanelRunner();

    const result = await runner.execute(intake, templates, adapters, ledger, 1);

    expect(result.panel_run.state).toBe("PARTIAL");
    expect(result.panel_run.valid_runs).toBe(1);
    expect(result.panel_run.failed_runs).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npx vitest run tests/visibility/panel-runner.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
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
            runs.push(
              this.makeRun(
                runId,
                panelRunId,
                prompt,
                adapter.name,
                intake,
                startedAt,
                "skipped_breaker",
                null,
              ),
            );
            panelRun.skipped_runs++;
            continue;
          }

          try {
            const response = await adapter.complete({
              model: adapter.name === "gemini" ? "gemini-2.0-flash" : "default",
              systemPrompt:
                "You are a helpful assistant answering questions about businesses and services.",
              userPrompt: prompt.final_prompt,
            });

            const analysis = analyzeResponse(
              response.content,
              intake,
              prompt.category ?? prompt.panel,
            );

            ledger.postCallRecord({
              audit_id: "pending",
              provider: adapter.name,
              model_id: "default",
              tokens_in: response.usage.tokens_in,
              tokens_out: response.usage.tokens_out,
              amount: 0,
              workflow: "prompt_panel",
            });

            const run = this.makeRun(
              runId,
              panelRunId,
              prompt,
              adapter.name,
              intake,
              startedAt,
              "valid",
              null,
            );
            run.brand_mentioned = analysis.brand_mentioned;
            run.mention_spans = analysis.mention_spans;
            run.competitors_mentioned = analysis.competitors_mentioned;
            run.citations = analysis.citations.map((c) => c.citation_id);
            run.cited_urls = analysis.citations.map((c) => c.url);
            run.brand_url_cited = analysis.brand_url_cited;
            run.accuracy_issue_ids = analysis.accuracy_issues.map((a) => a.issue_id);
            run.counted_in_denominator = true;

            runs.push(run);
            allCitations.push(...analysis.citations);
            allIssues.push(...analysis.accuracy_issues);
            panelRun.valid_runs++;
          } catch {
            runs.push(
              this.makeRun(
                runId,
                panelRunId,
                prompt,
                adapter.name,
                intake,
                startedAt,
                "error",
                "provider_error",
              ),
            );
            panelRun.failed_runs++;
          }
        }
      }
    }

    panelRun.state = panelRun.failed_runs > 0 || panelRun.skipped_runs > 0 ? "PARTIAL" : "COMPLETE";
    panelRun.updated_at = new Date();

    const metrics = computeMetrics(runs, adapters.length);

    return {
      panel_run: panelRun,
      runs,
      citations: allCitations,
      accuracy_issues: allIssues,
      metrics,
    };
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
```

Note: The `PromptRun` type needs a `citations` field. Add `citations: string[]` to the `PromptRun` interface in `visibility/types.ts` if not already present — it maps to `citation_ids`. Actually, looking at the types, `citation_ids` already exists. Let me fix the panel runner to use `citation_ids` instead of `citations`:

In the panel runner, change `run.citations = ...` to `run.citation_ids = analysis.citations.map((c) => c.citation_id)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npx vitest run tests/visibility/panel-runner.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/visibility/panel-runner.ts services/agents/tests/visibility/panel-runner.test.ts
git commit -m "feat(M6): add panel runner with state machine and budget/breaker checks"
```

---

### Task 14: Visibility Module Index and Barrel Exports

**Files:**

- Create: `services/agents/src/visibility/index.ts`
- Modify: `services/agents/src/index.ts`

**Interfaces:**

- Consumes: All visibility modules
- Produces: Public API for the visibility module

- [ ] **Step 1: Create visibility index**

```typescript
// services/agents/src/visibility/index.ts
export { PanelRunner } from "./panel-runner.js";
export { buildVisibilityPrompts } from "./prompt-builder.js";
export type { FilledPrompt } from "./prompt-builder.js";
export { analyzeResponse } from "./response-analyzer.js";
export type { AnalysisResult } from "./response-analyzer.js";
export { computeMetrics } from "./metrics-engine.js";
export { findLostPrompts } from "./lost-prompt-analyzer.js";
export type {
  PromptRun,
  PromptPanelRun,
  PanelRunResult,
  VisibilityIntake,
  VisibilityMetrics,
  Citation,
  AccuracyIssue,
  LostPrompt,
  Engine,
  PromptRunStatus,
  PanelRunState,
} from "./types.js";
```

- [ ] **Step 2: Add exports to main index**

Add these lines to `services/agents/src/index.ts`:

```typescript
export { PanelRunner } from "./visibility/panel-runner.js";
export { buildVisibilityPrompts } from "./visibility/prompt-builder.js";
export { analyzeResponse } from "./visibility/response-analyzer.js";
export { computeMetrics } from "./visibility/metrics-engine.js";
export { findLostPrompts } from "./visibility/lost-prompt-analyzer.js";
export { createAdapter } from "./providers/adapter-factory.js";
export { CostLedger } from "./providers/cost-ledger.js";
export type { CostLedgerEntry, CostLedgerConfig, CapCheck } from "./providers/cost-ledger.js";
export type { CircuitBreakerConfig } from "./providers/circuit-breaker.js";
export { DEFAULT_CIRCUIT_BREAKER_CONFIG } from "./providers/circuit-breaker.js";
```

- [ ] **Step 3: Build and verify**

Run: `pnpm --filter @wpi/agents build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add services/agents/src/visibility/index.ts services/agents/src/index.ts
git commit -m "feat(M6): export visibility module and new provider components"
```

---

### Task 15: Full Suite Verification

**Files:** None — verification only

- [ ] **Step 1: Run full agents test suite**

Run: `pnpm --filter @wpi/agents test`
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run TypeScript build**

Run: `pnpm --filter @wpi/agents build`
Expected: exit 0, no type errors

- [ ] **Step 3: Run workspace-wide build**

Run: `pnpm -r build`
Expected: exit 0, no downstream breakage

- [ ] **Step 4: Run workspace-wide tests**

Run: `pnpm test`
Expected: All tests pass across all packages

- [ ] **Step 5: Verify exit criteria**

Check each exit criterion from the spec:

1. ✅ All 5 provider adapters pass unit tests (gemini existing + claude, openai, perplexity, grok new)
2. ✅ Panel runner executes free panel end-to-end (tested in Task 13)
3. ✅ Metrics engine produces correct rates with valid denominators (Task 11)
4. ✅ Small-cell rule activates when valid_runs < 10 (Task 11)
5. ✅ Zero valid runs → metric = null/unavailable (Task 11)
6. ✅ Cost ledger records pre-call checks and post-call actuals (Task 3)
7. ✅ Circuit breakers are configurable per provider (Task 2)
8. ✅ Lost-prompt analysis identifies competitor-only prompts (Task 12)
9. ✅ AI Visibility types are separate from Presence Readiness (Task 1)
10. ✅ Provider failures excluded from denominators (Task 11, 13)
