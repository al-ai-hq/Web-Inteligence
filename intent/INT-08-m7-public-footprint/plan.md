# Plan: M7 local public footprint

| Field | Value |
| --- | --- |
| Spec | `intent/INT-08-m7-public-footprint/spec.md`. Ibrahim approved that spec on 2026-10-01 by the message "I approve spec.md" and said not to set `approved`. This plan does not edit `spec.md`, so the status word in that file stays `draft`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01 (D-020). Plan stage only. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not fetch a public page, apply a correction, add a connector write, change the cost guard, or touch production infrastructure. |
| Branch | `m7-public-footprint`, cut from `origin/main` at `c01dbd4` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-01. This session does not set `approved`.

## Scope of this slice

Add one local command that keeps a public fact tied to a source and a confidence label, keeps a missing review count null, and keeps a correction unapplied. Product spend stays `0.00` USD.

The command exits 0 only when all three of these pass:

- The fact source is the synthetic label `synthetic_source` and the confidence label is `medium`. A missing source is refused. A missing confidence label is refused. `high` and `low` remain legal confidence labels. `medium` is a fixture label, not a calibrated judgment.
- A missing review count is null. Storing it as `0` or as any other number, including `4`, is refused.
- The correction status is `pending`. Storing it as `applied` is refused.

`synthetic_source` is not a URL and not a platform name. This slice does not cover a displayed review count of `0`.

The check reads fixtures on this machine. It does not fetch a page and it does not send a correction. It does not close OI-021. It does not start M8. The later M7 exit in `docs/spec/05-PROJECT-PLAN.md` §5 (approved discovery, an entity graph, and a governed correction workflow in the product) stays out of this slice.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m7/sourced-fact.json` | Create | Two synthetic fields: `source` `synthetic_source` and `confidence` `medium`. No other field. |
| `evals/m7/missing-review-count.json` | Create | One synthetic field: `review_count` null. |
| `evals/m7/unapplied-correction.json` | Create | One synthetic field: `status` `pending`. |
| `scripts/check_m7_footprint.py` | Create | Local command. Python standard library only. It classifies the fact, the missing count, and the correction. The stored rows must match that classification. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m7_footprint.py` after the existing M6 AI visibility step. No new action SHA. The gitleaks step stays as it is. |

The fact has only `source` and `confidence`. The count has only `review_count`. The correction has only `status`. These fixtures are not a full public-source observation and not a full change operation.

In-memory copies cover a missing source, a missing confidence label, a confidence label outside `high`, `medium`, and `low`, a source that is a URL, `review_count` `0`, `review_count` `4`, and status `applied`. The command fails if any of those copies is accepted.

Do not edit `schemas/`, `config/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, or `scripts/check_m6_visibility.py`. Do not add a workflow action. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved.

1. Cut `m7-public-footprint` from `origin/main` at `c01dbd4`. Carry only `intent/INT-08-m7-public-footprint/`. The current checkout is `main` at that same commit. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the three fixtures under `evals/m7/`. Synthetic values only. No secrets, customer page text, live review text, or platform names.
3. Add `scripts/check_m7_footprint.py` so it exits 0 only when the fact, the missing count, and the unapplied correction pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-08-m7-public-footprint/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M8.

## Behaviour the command must pin

- Accept the golden fact only when `source` is `synthetic_source` and `confidence` is `medium`.
- Accept `high` and `low` as confidence labels on that same synthetic source. Refuse a confidence label outside `high`, `medium`, and `low`.
- Refuse a missing source and a missing confidence label.
- Refuse a source that starts with `http`. This command does not fetch.
- Accept the missing review count only when `review_count` is null. Refuse `0`. Refuse any other number, including `4`.
- Do not accept an `as_displayed` field. A displayed zero stays out of this slice.
- Accept the correction only when `status` is `pending`. Refuse `applied`.
- Refuse a `platform_name` field. This command does not choose a review platform or a listing platform.
- A fixture that only agrees with itself is not enough. The command classifies a non-empty synthetic source, a confidence label in the allowed set, a null review count, and a `pending` correction. The stored row must match that classification.
- Print `product spend 0.00 USD`. No network, no provider call, no Google Autocomplete, no search-result scrape, and no client-site fetch.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A fact is stored with no source | Medium | The command classifies the source and fails when it is missing or empty. | Data engineer |
| A missing review count is stored as `0` or as another number | Medium | The passing value is null. Copies that use `0` or `4` fail the check. | Data engineer |
| A correction is stored as `applied` | Medium | The passing status is `pending`. A copy with `applied` fails the check. | Integration engineer |
| The synthetic source is treated as an approved platform | Medium | The source is the label `synthetic_source`. A URL and a `platform_name` field fail the check. | Methodology owner |
| A displayed zero is treated as this missing-count case | Medium | An `as_displayed` field fails the check. That case stays out of this slice. | Data engineer |
| The check is treated as the full M7 exit | Medium | Discovery, the entity graph, and a live correction workflow stay out. `pnpm test:e2e` stays not run. | Product owner |
| A live fetch or a connector write is added | Low | The file list is the three fixtures, one standard-library script, and one CI step. Product spend stays `0.00` USD. | Engineer |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command classifies the source, the confidence label, the null count, and the pending correction. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m7_footprint.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m7_footprint.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No live fetch.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, call a connector, or store a secret.
- `verifier`: the diff matches this plan and the spec, the source and confidence label stay visible, the missing review count stays null, the correction stays `pending`, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword, content, or a golden file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave the approved public sources, review platforms, listing platforms, and Arabic transliteration open. Leave OI-021 open.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m7_footprint.py`, `evals/m7/`, and the CI step returns the tree to `origin/main` at `c01dbd4`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-01: The branch `m7-public-footprint` was created at `c01dbd4`. It was not pushed.
- 2026-10-01: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m7_footprint.py` passed on that system interpreter because the command uses the standard library only. No package was added.
- 2026-10-01: The security review found the source check only refused a lowercase `http` prefix, and the `high` and `low` cases were built by the same function that checked them. The source check now refuses a trimmed, case-folded `http` prefix, a `//` prefix, and any `://`. `high` and `low` are literal stored rows. A platform name inside the source value stays open: this slice does not keep a platform blocklist. The status word was not set to `approved`.
