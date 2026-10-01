# Release: M5 local Experience Effectiveness separation

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-06-m5-experience-effectiveness/` |
| Milestone | M5, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-01 by the message "Approved". This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check keeps Experience Effectiveness `18` and Presence Readiness `64` apart and refuses their sum, `82`. A subjective result stays `assessed` and `inferred`. A deterministic finding stays `observed` or `computed`, and `verified`. Product spend is `0.00` USD. There is no screen, no weight change, no live page review, and no form submission.

The branch `m5-experience-effectiveness` was cut from `origin/main` at `8389469`. It was not pushed. The change is uncommitted. OI-021 stays open. M6 has not started.

`spec.md` still shows the status word `draft`. Ibrahim said "go ahead" before the plan was written. This session did not set `approved` on that spec.

## Artifact versions

- Commit SHA: branch `m5-experience-effectiveness` points at `8389469`. The slice is an uncommitted working tree on that commit. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M5 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-06-m5-experience-effectiveness/review.diff`, saved before this file. New files are `scripts/check_m5_experience.py` and `evals/m5/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `docs/rubrics/experience-effectiveness.md`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, and `scripts/check_m4_sources.py` are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-01. The verifier did not run these commands. The security reviewer did not run a command.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m5_experience.py` | Passed. Exit 0. Output below. |
| `python3 scripts/check_schemas.py` | Failed, not a pass. Python 3.14.7 has no `jsonschema`. |
| `python3 scripts/check_config.py` | Failed, not a pass. Python 3.14.7 has no PyYAML. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schema files, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `python3 -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests. |
| `python3 -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests. |
| `python3 scripts/check_action_pins.py` | Passed. 1 workflow file. No new action SHA. |
| `pnpm test:e2e` | Not run. |
| `pnpm test:ssrf` | Not run. It is the M1 suite and is not this exit. |

```text
OK: experience effectiveness and presence readiness stay apart
OK: merged total refused
OK: neither score is written into observed AI visibility or search performance
OK: a weight field is refused
OK: subjective result is assessed and inferred
OK: deterministic finding is observed or computed, and verified
OK: assessed stored as observed or computed is refused
OK: inferred stored as verified is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M5 experience separation | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`verifier` (`c41518b6-baaf-47de-97d8-bbb469518fc6`) compared the working tree with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof output as partly done because it did not observe a command exit. It found OI-021 still open and M6 not started. It did not see this file.

`security-reviewer` (`de932e14-b90f-49cd-9cff-f3d41f3b4bb4`) read the script and the diff and did not run a command. It did not approve the change. No Critical finding. High: implementation proceeded while `spec.md` is still `draft`. That status word stays `draft`. Medium findings left open: `separate_scores` returns the fixture inputs `18` and `64` rather than deriving them from criteria; the fidelity map is the three labels in this slice, not every value in `schemas/common.schema.json`; the merged-total refusal is exact addition of those two inputs; the fixtures are not schema-validated. Low findings left open: the new CI step sits before the action-pin step, matching the M3 and M4 order; the refusal tokens are tied to the subjective kind; the fixtures have no `project_id`; `score_errors` can append `blended` twice. The criterion derivation stays out because this slice does not set a weight. The spec says this fixture is not a reviewer trace.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The spec status word is still `draft`. A product-owner approval of that file is still open.
- The security reviewer's open findings above stay open. That reviewer did not run the check.
- The verifier did not execute the proof commands and did not see this file.
- OI-021 stays open. The `<DECIDE_AT_M5>` weight, viewport, and calibration decisions stay open.
- This slice is not the full M5 exit. Rubric agreement and calibration stay out.
- The branch is not pushed, and the slice is not committed.

## Rollback

No production path. The slice is uncommitted. Removing `scripts/check_m5_experience.py`, `evals/m5/`, the CI step, and `intent/INT-06-m5-experience-effectiveness/` returns the tree to `origin/main` at `8389469`. After a later commit, rollback is `git revert` of that commit. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
