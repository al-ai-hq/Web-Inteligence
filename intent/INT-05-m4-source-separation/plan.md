# Plan: M4 local source separation

| Field | Value |
| --- | --- |
| Spec | `intent/INT-05-m4-source-separation/spec.md`. Ibrahim approved that spec on 2026-10-01 by the message "I approve spec.md". This plan does not edit `spec.md`, so the status word in that file stays `draft`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01 (D-020). Plan stage only. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "approved". |
| Tech lead approval | not required. This slice does not add a live auth path, a claim flow, tenant isolation code, SSRF, a cost-guard change, rule weights, a Search Console connection, a GA4 connection, or production infrastructure. |
| Branch | `m4-source-separation`, cut from `origin/main` at `73d1d4d`. Not pushed. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

Add one local command that keeps a Search Console number apart from a GA4 number, and keeps a missing optional source as `not_supplied`. Product spend stays `0.00` USD.

The command exits 0 only when both of these pass:

- Search Console `12` and GA4 `40` stay in separate totals. A result that adds them is refused.
- The optional GA4 source is `not_supplied` with a missing marker. `not_supplied` is not `measured_zero` and is not the number 0.

The check reads fixtures on this machine. It does not connect Search Console or GA4. It does not add a claim flow. It does not close OI-021. It does not start M5. The later M4 exit in `docs/spec/05-PROJECT-PLAN.md` §5 (expected-value formulas, and a claim that does not grant domain or connector authority) stays out of this slice.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m4/separate-sources.json` | Create | Two synthetic rows: Search Console value `12` with `integrity_state` `valid`, and GA4 value `40` with `integrity_state` `valid`. |
| `evals/m4/missing-source.json` | Create | One synthetic row: source `ga4`, value `null`, `integrity_state` `not_supplied`. `null` is the missing marker. |
| `scripts/check_m4_sources.py` | Create | Local command. Python standard library only. It computes the separate totals and the missing-source state. The stored rows must match that computation. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m4_sources.py` after the existing M3 access step. No new action SHA. The gitleaks step stays as it is. |

Each row has only `source`, `value`, and `integrity_state`. Search Console and GA4 are the only sources. The passing files have no `ctr` field and no Presence Readiness, Experience Effectiveness, or observed AI visibility field.

In-memory copies cover a combined total of `52`, a missing row stored as `measured_zero`, a missing row stored as `0`, a third source, a CTR on `search_console_generative_ai_export`, and either number written into a readiness, experience, or AI-visibility field. The command fails if any of those copies is accepted.

Do not edit `schemas/`, `config/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, or `scripts/check_m3_access.py`. Do not add a workflow action. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved.

1. Cut `m4-source-separation` from `origin/main` at `73d1d4d`. Carry only `intent/INT-05-m4-source-separation/`. The current checkout is `m3-anonymous-report-access` at `ad2ad15`, which is the parent of that merge. Do not commit this slice on the M3 branch. Leave the untracked Icon file out.
2. Add the two fixtures under `evals/m4/`. Synthetic values only. No secrets, customer account ids, or live query text.
3. Add `scripts/check_m4_sources.py` so it exits 0 only when the separate totals and the missing-source row pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-05-m4-source-separation/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M5.

## Behaviour the command must pin

- Keep Search Console `12` and GA4 `40` as separate totals. Refuse a combined total, including `52`.
- Accept the optional GA4 row only when `integrity_state` is `not_supplied` and `value` is `null`.
- Refuse that row when `integrity_state` is `measured_zero`.
- Refuse that row when `value` is `0`, or when `not_supplied` is paired with any number.
- Refuse a source other than `search_console` or `ga4`.
- Refuse a CTR computed from `search_console_generative_ai_export`. This command does not compute a CTR.
- Refuse a copy that writes either number into Presence Readiness, Experience Effectiveness, or observed AI visibility.
- A fixture that only agrees with itself is not enough. The command computes the result, and the stored row must match it.
- Print `product spend 0.00 USD`. No network, no provider call, no Google Autocomplete, no search-result scrape, and no client-site fetch.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| The two numbers are added and the sum is accepted | Medium | The command computes separate totals and fails on a combined total, including `52`. | Data engineer |
| `not_supplied` is stored as `measured_zero` or as `0` | Medium | The passing row is `null` plus `not_supplied`. Copies that use `measured_zero` or `0` fail the check. | Data engineer |
| The check is treated as the full M4 exit | Medium | Formulas, time zones, registration, domain verification, and the claim flow stay out. `pnpm test:e2e` stays not run. | Product owner |
| A live Search Console or GA4 call is added | Low | The file list is the two fixtures, one standard-library script, and one CI step. Product spend stays `0.00` USD. | Engineer |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command computes the totals and the missing-source state. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m4_sources.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m4_sources.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No live provider call.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, connect an account, or add a claim flow.
- `verifier`: the diff matches this plan and the approved spec, the two sources stay apart, `not_supplied` stays distinct from `measured_zero` and from `0`, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change keywords, scores, or golden files.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave OI-005 and OI-021 open.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m4_sources.py`, `evals/m4/`, and the CI step returns the tree to `origin/main` at `73d1d4d`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-01: The branch `m4-source-separation` was created at `73d1d4d`. It was not pushed.
- 2026-10-01: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on `/opt/homebrew/bin/python3` because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m4_sources.py` passed on `/opt/homebrew/bin/python3` because that command uses the standard library only. No package was added.
- 2026-10-01: The security review found the pass path copied each row into the result. `separate_totals` now sums rows that share a source. A stored value equal to the Search Console total plus the GA4 total is refused, including `52` stored on `search_console` beside GA4 `40`. The row stays `source`, `value`, and `integrity_state`. `project_id` and `schemas/performance-observation.schema.json` stay out of this slice.
