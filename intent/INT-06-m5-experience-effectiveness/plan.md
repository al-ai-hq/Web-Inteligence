# Plan: M5 local Experience Effectiveness separation

| Field | Value |
| --- | --- |
| Spec | `intent/INT-06-m5-experience-effectiveness/spec.md`. Ibrahim said "go ahead" on 2026-10-01 after being told that spec needs approval before a plan. This plan does not edit `spec.md`, so the status word in that file stays `draft`. This session does not set `approved`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01 (D-020). Plan stage only. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "Approved". |
| Tech lead approval | not required. This slice does not set a rubric or rule weight, add a live review, submit a form, change tenant isolation, add SSRF, change the cost guard, or touch production infrastructure. |
| Branch | `m5-experience-effectiveness`, cut from `origin/main` at `8389469` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

Add one local command that keeps an Experience Effectiveness score apart from Presence Readiness, and keeps a subjective rubric result distinguishable from a deterministic finding. Product spend stays `0.00` USD.

The command exits 0 only when both of these pass:

- Experience Effectiveness `18` and Presence Readiness `64` stay in separate scores. A result that adds them is refused. Neither number is written into observed AI visibility or search performance.
- A subjective result is `fidelity_label` `assessed` and `evidence_state` `inferred`. A deterministic finding is `observed` or `computed`, and `evidence_state` `verified`. `assessed` stored as `observed` or `computed` is refused. `inferred` stored as `verified` is refused.

`18` and `64` are fixture inputs. They are not criterion weights, dimension weights, or a calibrated score.

The check reads fixtures on this machine. It does not set a weight, calibrate the rubric, review a live page, or submit a form. It does not close OI-021. It does not start M6. The later M5 exit in `docs/spec/05-PROJECT-PLAN.md` §5 (rubric agreement and calibration) stays out of this slice.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m5/separate-scores.json` | Create | Two synthetic scores: `experience_effectiveness` `18` and `presence_readiness` `64`. No other score field. |
| `evals/m5/result-labels.json` | Create | Three synthetic rows: `assessed` / `inferred`, `observed` / `verified`, and `computed` / `verified`. |
| `scripts/check_m5_experience.py` | Create | Local command. Python standard library only. It computes the separate scores and the evidence state from the fidelity label. The stored rows must match that computation. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m5_experience.py` after the existing M4 source-separation step. No new action SHA. The gitleaks step stays as it is. |

The score fixture has only `experience_effectiveness` and `presence_readiness`. The label rows have only `fidelity_label` and `evidence_state`. This fixture is not a reviewer trace and is not a stored finding row.

In-memory copies cover a merged total of `82`, either number written into `observed_ai_visibility` or `search_performance`, `assessed` stored as `observed`, `assessed` stored as `computed`, and `inferred` stored as `verified`. The command fails if any of those copies is accepted.

Do not edit `schemas/`, `config/`, `docs/rubrics/experience-effectiveness.md`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, or `scripts/check_m4_sources.py`. Do not add a workflow action. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved.

1. Cut `m5-experience-effectiveness` from `origin/main` at `8389469`. Carry only `intent/INT-06-m5-experience-effectiveness/`. The current checkout is `main` at that same commit. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the two fixtures under `evals/m5/`. Synthetic values only. No secrets, customer page text, or reviewer identities.
3. Add `scripts/check_m5_experience.py` so it exits 0 only when the separate scores and the label rows pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-06-m5-experience-effectiveness/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M6.

## Behaviour the command must pin

- Keep Experience Effectiveness `18` and Presence Readiness `64` as separate scores. Refuse a merged total, including `82`, whether it is stored on either score or beside them.
- Refuse a copy that writes `18` or `64` into `observed_ai_visibility` or `search_performance`.
- Map `fidelity_label` to `evidence_state` using the mapping in `schemas/common.schema.json`: `assessed` becomes `inferred`; `observed` becomes `verified`; `computed` becomes `verified`. The stored `evidence_state` must equal that mapping.
- Accept the subjective row only as `assessed` and `inferred`.
- Accept a deterministic row only as `observed` or `computed`, with `verified`.
- Refuse `assessed` stored as `observed` or as `computed`.
- Refuse `inferred` stored as `verified`.
- Refuse a weight field. This command does not write a criterion weight, a dimension weight, or `methodology_version`.
- A fixture that only agrees with itself is not enough. The command computes the separate scores and the evidence state. The stored row must match that result.
- Print `product spend 0.00 USD`. No network, no provider call, no Google Autocomplete, no search-result scrape, no client-site fetch, and no form submission.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| The two scores are added and the sum is accepted | Medium | The command computes separate scores and fails on a merged total, including `82`. | Data engineer |
| A judgment is stored as a measurement | Medium | `assessed` must map to `inferred`. Copies that store `observed`, `computed`, or `verified` on that judgment fail the check. | Data engineer |
| The fixture numbers are treated as rubric weights | Medium | `18` and `64` are named as fixture inputs. A weight field fails the check. `methodology_version` stays unchanged. | Methodology owner |
| The check is treated as the full M5 exit | Medium | Calibration, agreement, screens, and regulated-context tone stay out. `pnpm test:e2e` stays not run. | Product owner |
| A live page review or a form submission is added | Low | The file list is the two fixtures, one standard-library script, and one CI step. Product spend stays `0.00` USD. | Engineer |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command computes the separate scores and maps each fidelity label to its evidence state. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m5_experience.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m5_experience.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No live provider call.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, submit a form, or review a live page.
- `verifier`: the diff matches this plan and the spec, the two scores stay apart, `assessed` stays `inferred`, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword, content, or a golden file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave the `<DECIDE_AT_M5>` weight, viewport, and calibration decisions open. Leave OI-021 open.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m5_experience.py`, `evals/m5/`, and the CI step returns the tree to `origin/main` at `8389469`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-01: The branch `m5-experience-effectiveness` was created at `8389469`. It was not pushed.
- 2026-10-01: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m5_experience.py` passed on that system interpreter because the command uses the standard library only. No package was added.
- 2026-10-01: `security-reviewer` and `verifier` did not approve this change and did not run the proof commands. Their findings stay open. The spec status word stays `draft`. `separate_scores` keeps the fixture inputs `18` and `64` as themselves. The command computes their sum and refuses `82`. It does not derive those inputs from criteria, because this slice does not set a weight. The fidelity map covers `assessed`, `observed`, and `computed` only. `attested`, `user_supplied`, `estimated`, and `unavailable` stay out of this slice. The fixtures are not validated against `schemas/`.
