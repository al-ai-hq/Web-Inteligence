# Release: M10 local monitor gate

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-11-m10-local-monitor-gate/` |
| Milestone | M10, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-04 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`. This file does not authorize a release, a deploy, or a merge.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-04 by the message "I approve plan.md." That message did not set `approved`. The plan status word is `done` because the local check was built. On 2026-10-04 Ibrahim accepted the local M10 exit gate. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check accepts a schedule only when `adds_write` is false and `adds_target` is false. A schedule which adds a write is refused. A schedule which adds a new target is refused. An unchanged run passes only when `state` is `unchanged` and no alert is stored. Storing `alert` `raised` on that run is refused. An alert count of `0` stays out of this slice. There is no scheduler, no crawl, and no deletion. No write-class tool is added. Product spend is `0.00` USD. `pnpm test:e2e` stays not run. M11 has not started.

The branch `m10-local-monitor-gate` was cut from `origin/main` at `f926be7`. It is not pushed. OI-021 stays open. `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-14 as M10. That table was not edited.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved` or `accepted`.

## Artifact versions

- Commit SHA: parent `f926be7`. This commit on `m10-local-monitor-gate` records the slice. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M10 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD. That line is the check's own statement. It is not a measured cost proof (D-019 stage 2).

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-11-m10-local-monitor-gate/review.diff`, saved before this file. This file is not in that diff. The diff was refreshed once after the reviewers so the plan records that `cost-reviewer` ran. The check script was not changed after the review. New files are `scripts/check_m10_monitor.py` and `evals/m10/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `config/agents/`, `package.json`, `docs/spec/05-PROJECT-PLAN.md`, and the M0B through M9 check scripts are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-04. The verifier did not run these commands. The cost reviewer did not run a command. The output below is the lead-session run.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m10_monitor.py` | Passed. Exit 0. Output below. |
| `python3 scripts/check_schemas.py` | Failed, not a pass. Python 3.14.7 has no `jsonschema`. Exit 1. |
| `python3 scripts/check_config.py` | Failed, not a pass. Python 3.14.7 has no PyYAML. Exit 2. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schema files, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `python3 -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests. |
| `python3 -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests. |
| `python3 scripts/check_action_pins.py` | Passed. 1 workflow file. No new action SHA. |
| `pnpm test:e2e` | Not run. |
| `pnpm test:ssrf` | Not run. It is the M1 suite and is not this exit. |

```text
OK: schedule does not add a write or a new target
OK: schedule which adds a write is refused
OK: schedule which adds a new target is refused
OK: unchanged run does not raise an alert
OK: raised alert on an unchanged run is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M10 local monitor gate | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixtures. No paid call and no budget change. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`cost-reviewer` (`764690bb-de6f-4ce7-8157-b7b690ad5057`) read `review.diff` and the on-disk script before the plan departure line was added. It did not run a command. It did not approve the change. No cost rule is broken. The script matched the diff hunk, 127 lines. Two notes stay open. Cadence, prompt-panel size, and provider count can still change spend on a later running schedule (`docs/cost-model.md` §3, D-006). This gate does not refuse those. The schedule row is pinned to exactly two fields, so a later cadence or budget field would fail this check until the gate is widened. The printed spend line is an assertion, not a measurement. `security-reviewer` was not run. Ibrahim's implementation message asked for `cost-reviewer` and `verifier`.

`verifier` (`bffdc22e-635f-4188-bd47-06a5b98b23be`) compared the files with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof commands as not run for that review. It found OI-021 still open, §14 still listing INT-14 as M10, and no new register rows. It found `release.md` absent, which this file now fills. It did not see this file. It noted the plan's order of work names `security-reviewer`.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- Cadence, prompt-panel size, and provider count stay unproven. A later running schedule must still refuse a wider spend. This local gate does not.
- The schedule fixture is an exact two-field row. A later record that adds cadence, a budget, or `project_id` needs a wider gate.
- The printed `0.00` USD is not the measured cost proof. D-019 stage 2 stays later.
- The verifier did not execute the proof commands. `security-reviewer` was not run.
- OI-021 stays open. Material-change rules, retention windows, and the owner names stay open.
- Ibrahim accepted the local exit gate. Deletion and cost breakers stay out. This is not the full M10 exit.
- The branch is not pushed. This file does not authorize a merge.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m10_monitor.py`, `evals/m10/`, the CI step, and `intent/INT-11-m10-local-monitor-gate/` returns the tree to `origin/main` at `f926be7`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed. No schedule runs.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed. `docs/spec/05-PROJECT-PLAN.md` §14 was not edited.
