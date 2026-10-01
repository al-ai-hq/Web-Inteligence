# Intent: M6 AI visibility laboratory

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-07 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M6 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01, by the message "shall we start M6". This draft proposes the same kind of first slice as M4 and M5: a local check only. There is no live provider call. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-01, by the message "I accept this INT-07 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `8753bf9`, which merges pull request 6 and includes the local M5 Experience Effectiveness check. That fact does not finish the later M5 exit and does not authorize a further merge. |
| Risk class | standard for this slice. A live provider gateway, a cost-guard change, or a circuit breaker in production is high-risk. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01. This session does not set `accepted`.

## Problem

Observed AI visibility is a count of model answers. Presence Readiness is a deterministic score, and Experience Effectiveness is a reviewed score. A later screen can add an AI mention rate to either score, or treat a failed provider call as a measured zero. The product rules already say observed AI visibility stays apart from those scores, a failed provider leaves the denominator, and a rate with no valid responses is unavailable rather than 0%. Nobody has yet shown that, in a local check, with no provider call.

## Proposed outcome

A local check, with no provider call and no screen, shows all of these:

- An observed AI visibility result stays apart from Presence Readiness and from Experience Effectiveness. Adding one to either is refused.
- Eight prompts across five providers, with two providers failed, use a denominator of 24. The failures are excluded. They are not stored as 0%.
- When every provider fails, the rate is `unavailable`, not 0%.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The methodology owner. No service is deployed. No model provider is called.

## Constraints

- D-012: observed AI visibility stays apart from Presence Readiness, Experience Effectiveness, and search performance. This slice does not blend them.
- D-009: do not call Google Autocomplete or scrape search-result pages. Do not import `.claude/skills/marketing-seo-agent/scripts`.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.8: cost, failure, and denominator transparency. This slice does not choose providers.
- `docs/spec/02-DETAILED-SPECIFICATION.md` §6: numerators and denominators sit beside every rate. The launch set of providers stays open (D-011).
- `docs/test-strategy.md` §6.3: the AI valid-denominator fixture is 8 prompts times 5 providers with 2 providers failed, denominator 24, failures excluded, shown as counts. When all providers fail, the result is `unavailable`, not 0%.
- `config/prompt-panels/` is not edited. Provider choice stays `<DECIDE_AT_M0: runtime model providers>`.
- `pnpm test:e2e` stays recorded as not run. There is no screen.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, or M5. Starting M7. Merging any pull request.
- The later M5 exit: rubric agreement and calibration.
- The later M4 exit: expected-value formulas, and a claim that does not grant domain or connector authority.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- A provider gateway, repeats, a cost ledger, circuit breakers, prompt families, and a provider version registry.
- Mentions, recommendations, citations, competitor share, lost prompts, and cited-source gaps beyond the denominator case in this slice.
- A live provider call, a client-site fetch, and a search-result scrape.
- Deploy, Terraform apply, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when observed AI visibility is merged into Presence Readiness or Experience Effectiveness;
2. the documented denominator of 24 when two of five providers fail;
3. one case where every provider failure stays `unavailable`, not 0%.

The later M6 exit, a live provider gateway and the full observation catalogue, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a live laboratory.

- The launch set of runtime model providers (D-011). Owner: product owner. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Prompt-panel contents in `config/prompt-panels/`. Owner: methodology owner.
- The combined USD 150 cap (D-005, OI-001). Owner: product owner.

## Links

- Spec: `intent/INT-07-m6-ai-visibility/spec.md` (after acceptance)
- Plan: `intent/INT-07-m6-ai-visibility/plan.md` (after spec approval)
- Release: `intent/INT-07-m6-ai-visibility/release.md` (after implementation)
