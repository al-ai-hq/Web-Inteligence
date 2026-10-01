# Plan: M2 local Presence Readiness disclosure

| Field | Value |
| --- | --- |
| Spec | `intent/INT-03-m2-integrity-presence-readiness/spec.md` (status: approved) |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01. This file was written after Ibrahim approved the spec in this chat. The local check was added after Ibrahim approved this plan. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "I approve plan.md". |
| Tech lead approval | not required. This slice does not change rule weights, caps, or `methodology_version`. Role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Branch | `m2-presence-readiness`, cut from `m1-secure-crawler` at `afa0cdc` when Ibrahim asked to commit. Not pushed. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

Add one local command that recomputes pre-cap Presence Readiness as 100 from seven stored passes, discloses that number as Presence Readiness at `methodology_version` `0.1.0-draft` with coverage `sample`, and refuses an `unavailable` or `not_applicable` result shown as `pass`.

Weights stay 20, 15, 10, 20, 15, 10, and 10. `scripts/check_m0b_proofs.py` is not edited. Pull request 2 is not merged. Product spend stays `0.00` USD. No rules engine, no screen, no deploy, and no client-site fetch.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m2/pass-seven.json` | Create | Seven stored passes, one per category, importance 1. Rule IDs `CRW-001`, `SEO-001`, `STR-001`, `AEO-001`, `GEO-001`, `I18N-001`, `PRF-001`. Disclosure expects `presence_readiness`, `0.1.0-draft`, `deterministic` true, `coverage` `sample`, `site_wide_count` null. |
| `evals/m2/disclosure-full.json` | Create | Same passes with `coverage` `full`. Must fail. |
| `evals/m2/disclosure-blended.json` | Create | Same passes plus one of `experience_effectiveness`, `ai_visibility`, or `search_performance`. Must fail. |
| `evals/m2/unavailable-as-pass.json` | Create | A stored `unavailable` result presented as `pass`. Must fail and stay out of the denominator. |
| `evals/m2/not-applicable-as-pass.json` | Create | A stored `not_applicable` result presented as `pass`. Must fail and stay out of the denominator. |
| `scripts/check_m2_readiness.py` | Create | Reads `config/scoring.yaml` and the fixtures. Decimal arithmetic. Standard library plus PyYAML, already installed for `scripts/check_config.py`. No new npm package. No import from `.claude/skills/marketing-seo-agent/scripts`. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m2_readiness.py` after the existing config check. Reuse the Python 3.12 setup and the existing `pyyaml` install. Add no action SHA. |
| `intent/INT-03-m2-integrity-presence-readiness/spec.md` | Sign-off recorded | Ibrahim approved it on 2026-10-01. |

Do not edit `config/scoring.yaml`, `config/rules/`, schemas, `scripts/check_m0b_proofs.py`, or `package.json`. Do not add a workflow action.

## Order of work

Do not start this list until the plan is approved.

1. Add the five fixtures under `evals/m2/`. Synthetic ids only. No secrets, customer URLs, or page text.
2. Add `scripts/check_m2_readiness.py` so the invalid fixtures fail the check and the valid fixture passes only when the recompute and the disclosure match. Do not set `.claude/state/test-lock`. This is not a bug fix.
3. Recompute each category score as 100 and pre-cap Presence Readiness as 100. Use `decimal` arithmetic. Apply no critical cap. Leave `not_applicable`, `unavailable`, and `error` out of the denominator. Do not decide a category score when the denominator is 0.
4. Refuse to run if `methodology_version` is not `0.1.0-draft` or if the seven category weights differ from 20, 15, 10, 20, 15, 10, and 10.
5. Fail a disclosure whose `coverage` is `full`, or that includes Experience Effectiveness, AI visibility, or search performance. `llms.txt`, an FAQ requirement, and a rich-result promise are not inputs.
6. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.
7. Save `intent/INT-03-m2-integrity-presence-readiness/review.diff`. Run `seo-method-checker` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M3.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| The new command edits the M0B proof or the weights | Low | This plan does not list those files as edits. A weight change is out of scope. | Methodology owner |
| The score 100 is presented as a full-site count or as AI visibility | Medium | The valid disclosure requires `coverage` `sample` and `site_wide_count` null, and fails if the other measurements are present. | SEO lead |
| Float rounding changes 100 | Low | Use decimal arithmetic, matching the spec. | Tech lead |
| Pull request 2 is merged from this slice | Low | This plan does not merge it. The later branch is cut from `m1-secure-crawler`. | Tech lead |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m2_readiness.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`pnpm test:ssrf` is not this exit. `pnpm test:e2e` stays recorded as not run. Product spend stays `0.00` USD.

## Security, privacy, cost, Arabic/accessibility review

No fetch, no secret, and no customer content. `seo-method-checker` checks that the disclosure does not blend scores and does not score `llms.txt`. `verifier` compares the command output with this plan. There is no screen, so no Arabic or accessibility review. No paid call and no hosting.

## Rollback

Revert the commit that adds `scripts/check_m2_readiness.py`, `evals/m2/`, and the CI step. No deploy and no staging rehearsal.

## Departures from the plan

- 2026-10-01: `python3 scripts/check_m2_readiness.py` on `/opt/homebrew/bin/python3` failed because PyYAML is not installed for that interpreter. That invocation stays recorded as failed, not run. The readiness, schema, config, action-pin, M0B proof, and hook commands passed with `./.venv/bin/python` (Python 3.14.7). No package was added. The CI step still runs `python3` after the existing `pip install pyyaml jsonschema` step.
- 2026-10-01: Ibrahim accepted the local exit and asked to commit on `m2-presence-readiness`. The branch was created from `m1-secure-crawler` at `afa0cdc`. It was not pushed. Pull request 2 was not merged.
