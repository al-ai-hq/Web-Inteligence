---
name: cost-guard
description: Keeps spending inside the USD 150 monthly cap with pre-call checks, circuit breakers and graceful degradation. Use when adding or changing a paid call, a scheduled job, audit sizing, retries, caching, or infrastructure that adds hosting cost.
---

# Cost guard (policy skill)

Status: draft for review. Version 0.1.0. Owner: AI engineer `<DECIDE_AT_M0: name>`, with the cloud billing owner. The owner signs off every change to this skill.

## When to use

- A new provider adapter, model call, search call or keyword-data call.
- Prompt panels, audit sizes, retries, schedules, monitoring or re-audits.
- New Google Cloud resources or anything that raises hosting cost.

## The cap

- One hard monthly cap of USD 150 covers everything: Google Cloud hosting and infrastructure plus AI-model and data-provider calls (D-005; 04-CLAUDE-CODE-BUILD-PROMPT §19; 01-PRODUCT-REQUIREMENTS §9). ASSUMPTION: read as one combined cap; the owner is to confirm.
- The cost guard tracks hosting (from the Cloud Billing export) and paid calls as separate lines against the one cap (D-005).
- Proposed configuration (02-DETAILED-SPECIFICATION §18, v1-baseline §11.2): monthly alert at USD 100; monthly hard stop at USD 150. Per audit (D-007, ASSUMPTION): soft USD 3.00 (skip optional retries and summaries), hard USD 4.00 (stop paid calls, mark sections unavailable).
- Caps, sizes, prices, quotas and model IDs are configuration with a source, checked date and owner, never constants (D-006, D-010). Prices come from each provider's official page and are reviewed monthly (02 §18).

## Enforce before every paid call

- Check per-audit, per-project, per-provider, per-workflow and monthly caps before the call, not after (02 §13 "Guardrails"; 04 §19).
- Cloud Billing budgets only alert. A cost-guard function acts on their Pub/Sub notifications (02 §18).
- The cost ledger records every call: provider, model ID, tokens, search calls, latency and the price-table version (02 §18). Reconcile monthly with the Billing export in BigQuery; ASSUMPTION: alert when variance exceeds 5% (02 §15).
- No agent or schedule can raise its own budget (07-SKILLS-AND-AGENTS §2 "Policy and cost governance"; 05-PROJECT-PLAN §4).

## Circuit breakers

- One breaker per provider. ASSUMPTION (D-007): it opens after 3 consecutive timeouts or 5xx errors, skips the provider for 15 minutes, then sends one probe; success closes it (02 §18).
- An open breaker marks that provider's results `unavailable`, never 0%, and the audit completes (02 §19).
- Provider failures leave valid denominators (01 §8 "AI visibility").

## Retries and reuse

From v1-baseline §11.2:

- At most one automatic retry for a transient provider failure.
- Never retry an invalid or policy-refused prompt.
- Cache only when lawful and methodologically valid; never reuse an old result as a new timestamped observation. Reused evidence discloses its capture time (01 §5.19).

## Degradation order

Keep the deterministic audit, evidence, core scores and action plan before optional AI repetition or enrichment (01 §5.19). As projected monthly spend rises (v1-baseline §11.4, plus 02 §18):

1. 70%: disable automatic provider retries.
2. 85%: reduce optional report-summarization tokens.
3. 95%: drop the lowest-priority provider. v1 named Grok; the runtime provider set is open (D-011), so the order lives in configuration.
4. 100%: deterministic website audits continue; AI visibility shows "unavailable due to the monthly limit".
5. Near a property's URL Inspection quota: pause Search Console verification calls.

Never represent a skipped provider as a negative result. Under budget pressure, reduce scope before denying service (D-006): anonymous audits step down through `rich`, `reduced`, `preview`, `refused` (`audit_tier`), and global spending breakers override first-audit eligibility (01 §5.19).

## Sizes (defaults are ASSUMPTIONS, D-006)

- Anonymous first audit: up to 20 representative pages.
- Free AI panel: 8 prompts x configured providers x 1 run, shown as counts.
- Connected panel: 20-40 prompts x 3 runs. A full panel (40 prompts, 5 providers, 3 runs) is 600 paid observations per run (02 §18), so size and cadence are set per plan.

## Proof required

- Simulate the USD 150 hard stop: paid calls stop within one cost-guard cycle (02 §19; M0B exit gate in 05 §11).
- Breaker tests: open, skip, probe, close; `unavailable` shown, audit completes.
- Load and cost tests with defined workloads and stopping thresholds (05 §7).
- The cost model and its math live in `docs/cost-model.md`.

## Checklist for a change

1. Does the new call pass through the cost guard with a pre-call check?
2. Is the price read from configuration with source and checked date?
3. What happens when the breaker is open or the cap is reached? Is it `unavailable`, never 0%?
4. Does the change add hosting cost? Put the estimate in `spec.md` against the combined cap.
5. Name the owner who approves any change to caps.

## Backed by

- Subagent `cost-reviewer` if defined in `.claude/agents/`.
- `docs/cost-model.md`; `config/providers.yaml` (price-table version).
- Detection bands in `ops/detection/bands.yaml` (cost per audit is a later candidate).
