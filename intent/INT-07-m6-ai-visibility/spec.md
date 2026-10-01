# Spec: M6 local AI visibility denominator

| Field | Value |
| --- | --- |
| Intent | `intent/INT-07-m6-ai-visibility/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-01) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "I approve spec.md." The status word stays `draft` because that message also says not to set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: methodology owner (denominator), data engineer (data-integrity) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0 |
| Source sections read | accepted INT-07 text; `docs/spec/05-PROJECT-PLAN.md` §5 M6; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.8 and the AI visibility bullets; `docs/spec/02-DETAILED-SPECIFICATION.md` §6; `docs/test-strategy.md` §6.3; `docs/decisions.md` D-006, D-009, D-010, D-011, D-012, D-020; data-integrity skill; cost-guard skill |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-01. This session does not set `approved`.

## Summary

This spec defines a local check that keeps an observed AI visibility result apart from Presence Readiness and from Experience Effectiveness. Eight prompts across five providers, with two providers failed, use a computed denominator of 24. The failures are excluded and are not stored as 0%. When every provider fails, the rate is `unavailable`, not 0%.

The check does not call a provider and does not choose the launch set. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the separation case, the denominator case, and the all-fail case all pass. Any failure exits non-zero. Source: accepted INT-07 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. An observed AI visibility result stays apart from Presence Readiness and from Experience Effectiveness. The check refuses a result that adds the visibility result to either score. Source: accepted INT-07 text; D-012.
3. The visibility result is not written into search performance. A case that does so fails the check. Source: D-012.
4. The denominator case is 8 prompts, 5 providers, and 2 providers failed. The valid denominator is computed as 8 × (5 − 2), which is 24. Failed providers are excluded. Source: `docs/test-strategy.md` §6.3; `docs/spec/02-DETAILED-SPECIFICATION.md` §6; `docs/spec/01-PRODUCT-REQUIREMENTS.md` AI visibility bullets.
5. A failed provider stored as 0% or as the number 0 fails the check. The passing result is shown as counts, with the denominator beside them. Source: accepted INT-07 text; `docs/test-strategy.md` §6.3; D-006.
6. When all 5 providers fail, the rate is `unavailable`. Storing that case as 0% or as the number 0 fails the check. Source: accepted INT-07 text; `docs/test-strategy.md` §6.3; data-integrity skill.
7. The check does not name a model ID and does not choose the launch set of providers. The five providers are synthetic slots. Source: D-010; D-011; accepted INT-07 text.
8. No schema file, no `config/` file, and no file under `config/prompt-panels/` is added or changed. The check does not edit the M4 or M5 commands. Source: accepted INT-07 text.

### Non-functional

1. The check runs on this machine. It does not call a provider, fetch a client site, call Google Autocomplete, or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-07 text; D-009.
2. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.
3. Fixtures are synthetic. They contain no secrets, customer prompt text, or live answers. Source: accepted INT-07 text.
4. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-07 text.
5. A provider gateway, repeats, a cost ledger, circuit breakers, prompt families, a provider version registry, and the rest of the observation catalogue stay out of this check. Source: accepted INT-07 text; `docs/spec/05-PROJECT-PLAN.md` §5.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not call a model. Stored rows are data. The command computes the valid denominator from the prompt count and the failed-provider count, and it refuses a merged score. It does not change a Presence Readiness or Experience Effectiveness result.

### Data contracts

No schema is added or changed. One fixture carries an observed AI visibility count kept apart from Presence Readiness and Experience Effectiveness. One fixture carries 8 prompts, 5 synthetic provider slots, and 2 failed slots, with a stored denominator that must equal the computed 24. One fixture carries 5 failed slots and a stored rate of `unavailable`. This fixture is not a full observation row.

### State transitions

No workflow state is added. A merged score ends as refused. An all-fail rate stays `unavailable`.

### Configuration

No `config/` file is edited. No model ID, price, or provider name is written.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete, no result-page scrape, and search performance stays apart from observed AI visibility. | SEO lead: this check is not a search-performance report. |
| security-baseline | yes | No fetch, no provider call, and no secret. | A later provider gateway stays out of this slice. |
| arabic-rtl-a11y | no | No screen. | Prompt language stays with the later laboratory. |
| data-integrity | yes | The visibility count stays apart from both scores. The denominator is 24. `unavailable` is not 0%. | Data engineer: this fixture is not a full observation row. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). |
| connector-safety | no | No connector and no write tool. | None for this spec. |

## Areas of concern

1. This spec stays `draft`. Ibrahim approved it on 2026-10-01 and said not to set `approved`. The INT-07 status word also stays `draft`.
2. The M6 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires a live provider gateway and the full observation catalogue. This check is the first slice only.
3. The launch set of providers stays `<DECIDE_AT_M0: runtime model providers>` (D-011). The five slots in this check are not that decision.
4. The 8 × configured-providers × 1 size is a configurable default (D-006). This check uses the documented fixture. It does not edit `config/prompt-panels/`.
5. OI-021 stays open. This spec does not close it.
6. Pull request 6 is already merged at `origin/main` `8753bf9`. This spec does not merge anything else, and it does not finish the later M5 exit.

## Test and eval plan

The local command covers:

- an observed AI visibility result kept apart from Presence Readiness and from Experience Effectiveness;
- a refusal when the visibility result is added to either score;
- a refusal when that result is written into search performance;
- a computed denominator of 24 from 8 prompts, 5 providers, and 2 failed providers;
- a failure when a failed provider is stored as 0% or as 0;
- an all-fail rate stored as `unavailable`;
- a failure when that all-fail rate is stored as 0% or as 0.

No browser journey, no golden-file eval, and no live provider call. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- No new assumption row.
- Leave D-011, the prompt-panel contents, and the USD 150 cap open.
- Leave OI-021 open.
- No new decision row.
