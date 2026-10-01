# Plan: M6 local AI visibility denominator

| Field | Value |
| --- | --- |
| Spec | `intent/INT-07-m6-ai-visibility/spec.md`. Ibrahim approved that spec on 2026-10-01 by the message "I approve spec.md" and said not to set `approved`. This plan does not edit `spec.md`, so the status word in that file stays `draft`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01 (D-020). Plan stage only. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not add a provider gateway, a cost-guard change, a circuit breaker, a live provider call, rule weights, or production infrastructure. |
| Branch | `m6-ai-visibility`, cut from `origin/main` at `8753bf9` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-01. This session does not set `approved`.

## Scope of this slice

Add one local command that keeps an observed AI visibility count apart from Presence Readiness and Experience Effectiveness, computes a valid denominator of 24, and keeps an all-fail rate as `unavailable`. Product spend stays `0.00` USD.

The command exits 0 only when all three of these pass:

- Observed AI visibility `24` stays apart from Presence Readiness `31` and Experience Effectiveness `22`. Adding `24` to either score is refused. `24` is not written into search performance.
- Eight prompts across five synthetic provider slots, with two slots failed, produce a denominator of 24. The command computes `8 × (5 − 2)`. The failures are excluded. They are not stored as `0%` or as `0`. The passing result is counts, with that denominator beside them.
- When all five slots fail, the rate is `unavailable`, not `0%` and not `0`.

`24`, `31`, and `22` are fixture inputs. They are not mention rates, criterion weights, or a calibrated score. `slot_1` through `slot_5` are synthetic slots. They are not model IDs and they are not the launch set of providers.

The check reads fixtures on this machine. It does not call a provider. It does not edit `config/prompt-panels/`. It does not close OI-021. It does not start M7. The later M6 exit in `docs/spec/05-PROJECT-PLAN.md` §5 (a live provider gateway and the full observation catalogue) stays out of this slice.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m6/separate-visibility.json` | Create | Three synthetic fields: `observed_ai_visibility` `24`, `presence_readiness` `31`, and `experience_effectiveness` `22`. No other score field. |
| `evals/m6/valid-denominator.json` | Create | `prompt_count` `8` and five slots, `slot_1` through `slot_3` with outcome `valid`, `slot_4` and `slot_5` with outcome `failed`. Stored counts must match the computed denominator `24`. |
| `evals/m6/all-failed.json` | Create | The same five slots, each with outcome `failed`. Stored rate `unavailable`. |
| `scripts/check_m6_visibility.py` | Create | Local command. Python standard library only. It computes the separate counts and the denominator from the slot outcomes. The stored rows must match that computation. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m6_visibility.py` after the existing M5 experience-effectiveness step. No new action SHA. The gitleaks step stays as it is. |

Each provider slot has only `slot` and `outcome`. The passing denominator result has only `prompt_count`, `provider_count`, `failed_provider_count`, and `denominator`. It has no percentage. This fixture is not a full observation row.

In-memory copies cover `24` added to `31` or to `22`, `24` written into `search_performance`, a stored denominator of `40`, a failed slot stored as `0%` or as `0`, and an all-fail rate stored as `0%` or as `0`. The command fails if any of those copies is accepted.

Do not edit `schemas/`, `config/`, `config/prompt-panels/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, or `scripts/check_m5_experience.py`. Do not add a workflow action. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved.

1. Cut `m6-ai-visibility` from `origin/main` at `8753bf9`. Carry only `intent/INT-07-m6-ai-visibility/`. The current checkout is `main` at that same commit. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the three fixtures under `evals/m6/`. Synthetic values only. No secrets, customer prompt text, live answers, or model IDs.
3. Add `scripts/check_m6_visibility.py` so it exits 0 only when the separate counts, the denominator, and the all-fail rate pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-07-m6-ai-visibility/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M7.

## Behaviour the command must pin

- Keep observed AI visibility `24`, Presence Readiness `31`, and Experience Effectiveness `22` as separate values. Refuse a merged total, including `55` (`24 + 31`) and `46` (`24 + 22`), whether it is stored on either score or beside them.
- Refuse a copy that writes `24` into `search_performance`.
- Count slots whose outcome is `failed`. The valid denominator is `prompt_count × (provider_count − failed_provider_count)`. For the golden inputs that is `8 × (5 − 2) = 24`.
- Accept the golden denominator only when the stored counts are `prompt_count` `8`, `provider_count` `5`, `failed_provider_count` `2`, and `denominator` `24`.
- Refuse a stored denominator of `40`, which is `8 × 5` with the failures left in.
- Refuse a failed slot stored as `0%` or as `0`. The passing counts have no percentage field.
- When every slot is `failed`, accept the rate only as `unavailable`. Refuse `0%` and refuse `0`.
- Refuse a `model_id` field. This command does not write a provider name or a model ID.
- A fixture that only agrees with itself is not enough. The command counts the failed slots and multiplies. The stored denominator must match that result.
- Print `product spend 0.00 USD`. No network, no provider call, no Google Autocomplete, no search-result scrape, and no client-site fetch.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| The visibility count is added to a score and the sum is accepted | Medium | The command computes `24 + 31` and `24 + 22` and fails when either sum is stored. | Data engineer |
| Failed providers stay in the denominator | Medium | The command counts failed slots and computes `8 × (5 − 2)`. A stored `40` fails the check. | Data engineer |
| A failed provider is stored as `0%` or as `0` | Medium | Those copies fail. The all-fail rate passes only as `unavailable`. | Data engineer |
| The five slots are treated as the launch providers | Medium | The slots are named `slot_1` through `slot_5`. A `model_id` field fails the check. D-011 stays open. | Methodology owner |
| The check is treated as the full M6 exit | Medium | The gateway, catalogue, repeats, and circuit breakers stay out. `pnpm test:e2e` stays not run. | Product owner |
| A live provider call is added | Low | The file list is the three fixtures, one standard-library script, and one CI step. Product spend stays `0.00` USD. | Engineer |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command counts failed slots and multiplies by the prompt count. The stored denominator must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m6_visibility.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m6_visibility.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No live provider call.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, call a provider, or store a secret.
- `verifier`: the diff matches this plan and the spec, the visibility count stays apart from both scores, the denominator is the computed `24`, `unavailable` stays distinct from `0%` and from `0`, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword, content, or a golden file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave D-011, the prompt-panel contents, and the USD 150 cap open. Leave OI-021 open.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m6_visibility.py`, `evals/m6/`, and the CI step returns the tree to `origin/main` at `8753bf9`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-01: The branch `m6-ai-visibility` was created at `8753bf9`. It was not pushed.
- 2026-10-01: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m6_visibility.py` passed on that system interpreter because the command uses the standard library only. No package was added.
- 2026-10-01: The security review found a zero test on every count value, and a check that required the visibility count to equal the denominator. The zero test now stays on a failed slot and on the all-fail rate. The visibility count stays a separate fixture input. An in-memory copy with one failed slot must recompute the denominator as `32`. The status word was not set to `approved`.
