# Intent: M2 integrity and Presence Readiness

Status: accepted.

| Field | Value |
| --- | --- |
| ID | INT-03 |
| Status | accepted |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Methodology owner | <DECIDE_AT_M0: name> |
| Milestone | M2 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01, by the message "Implement the plan as specified" on the M2 intent review. That review recommended accept with amendments. Both bounds in that review are in this text. |
| Text accepted | Ibrahim, 2026-10-01, by the message "1. Yes, build locally (b)". |
| Depends on | Local records on `m1-secure-crawler`: M0B proofs, commit `a36d305`, and the local SSRF suite, commit `afa0cdc`. On 2026-10-01, `origin/main` was `96c0daa` and pull request https://github.com/al-ai-hq/Web-Inteligence/pull/2 was open and not merged. That fact does not reopen M0A, M0B, or M1, and it does not authorize a merge. |
| Risk class | standard for this slice. A later slice that changes rule weights is high-risk. This slice does not. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01 by the message "1. Yes, build locally (b)".

## Problem

M0B can recompute one Presence Readiness score of 100 from seven passing rule results. That number does not say what it is. A later screen can present it as observed AI visibility, as Experience Effectiveness, as search performance, or as a full-site count taken from a sample. Invalid rule results can also be shown as passes. The rule files and `config/scoring.yaml` exist, and `methodology_version` is `0.1.0-draft`. Nobody has yet shown, in a local check, that one recomputed score stays Presence Readiness and that an `unavailable` or `not_applicable` result is not a pass.

## Proposed outcome

A local check, with no new rules engine, shows all of these:

- One Presence Readiness score is recomputed from stored rule results that already match the current weights in `config/scoring.yaml`. Category weights stay 20, 15, 10, 20, 15, 10, and 10. `methodology_version` stays `0.1.0-draft`.
- The disclosure names the score Presence Readiness, names `methodology_version`, and says the score is deterministic. The same disclosure says the result is not observed AI visibility, not Experience Effectiveness, and not search performance.
- A sample count on that result is not presented as a full-site count.
- One invalid case is refused: a stored result of `unavailable` or `not_applicable` is not shown as `pass`, and it stays out of the score denominator.
- Product spend stays `0.00` USD. There is no deploy and no crawl of the public web.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opus` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

Methodology owner, SEO lead, and the future rules engine. No service is deployed. The M0B proof command is not edited.

## Constraints

- D-009: do not import `.claude/skills/marketing-seo-agent/scripts`. No Google Autocomplete and no search-result scraping.
- D-010: weights, caps, and `methodology_version` stay in `config/`. This intent does not hard-code a new model ID, price, quota, or crawler token.
- D-012: Presence Readiness and Experience Effectiveness stay separate. Neither is blended with observed AI visibility or search performance.
- D-014: a stored score still belongs to its project through the lineage already required.
- D-019: this intent adds no paid call and no hosting. Measured cost stays later.
- D-020: record the model the session shows.
- `config/scoring.yaml` `rule_results`: `pass`, `partial`, and `fail` stay in the denominator. `not_applicable`, `unavailable`, and `error` stay out. Do not decide the category score when the denominator is 0. That line remains `<DECIDE_AT_M0>`.
- Do not score `llms.txt`. Do not require FAQ blocks. Do not promise rich results.
- `pnpm test:ssrf` is the local M1 suite. It is not this exit. `pnpm test:e2e` stays recorded as not run.
- The Arabic display name in `config/scoring.yaml` stays as written. This intent has no screen, so native review is not run.

## Out of scope

- Merging pull request 2. Reopening M0A, M0B, or M1. Starting M3.
- A rules engine that evaluates every category. Template or page classification, recurring-issue clustering, and an evidence viewer.
- Any weight change, critical-cap change, or `methodology_version` bump.
- Partial standards, schema-property lists, and rule-key alignment (OI-032, OI-033, OI-034), including SPAM-001 confirmation.
- Golden-file extraction and the full TS-SCORE catalogue. Labelled sites are not in this repository (OI-055).
- Deploy, Terraform apply, a live provider call, a client-site fetch, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one Presence Readiness score recomputed from stored rule results;
2. a disclosure that the score is Presence Readiness at `methodology_version` `0.1.0-draft`, not a full-site count and not AI visibility;
3. one refusal when `unavailable` or `not_applicable` is shown as `pass`.

The later M2 exit, a full rules pass and golden fixtures, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a later rules engine.

- The category score when no measurable rule remains (OI-033). Owner: methodology owner. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Partial standards and the SPAM-001 cap confirmation (OI-033). Owner: methodology owner.
- Rule config keys versus `RuleDefinition` (OI-032). Owner: methodology owner and tech lead.

## Links

- Spec: `intent/INT-03-m2-integrity-presence-readiness/spec.md` (after acceptance)
- Plan: `intent/INT-03-m2-integrity-presence-readiness/plan.md` (after spec approval)
- Release: `intent/INT-03-m2-integrity-presence-readiness/release.md` (after implementation)
