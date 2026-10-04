# Release: M11 local project gate

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-12-m11-local-project-gate/` |
| Milestone | M11, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-04 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`. This file does not authorize a release, a deploy, or a merge.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-04 by the message "I approve plan.md." That message did not set `approved`. The plan status word is `done` because the local check was built. On 2026-10-04 Ibrahim accepted the local M11 exit gate. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check accepts a read only when `caller` is `project_a` and `project_id` is `project_a`. A record whose `project_id` is `project_b` is refused while that caller is in `project_a`. A row that contains `organization_id` is refused. `project_a` and `project_b` are synthetic labels. There is no invitation, no live workspace, and no bulk schedule. No write-class tool is added. Product spend is `0.00` USD. `pnpm test:e2e` stays not run. M12 has not started.

The branch `m11-local-project-gate` was cut from `origin/main` at `fd23f59`. It is not pushed. OI-021 stays open. `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-15 as M11. That table was not edited.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved` or `accepted`.

## Artifact versions

- Commit SHA: parent `fd23f59`. This commit on `m11-local-project-gate` records the slice. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M11 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD. That line is the check's own statement. It is not a measured cost proof (D-019 stage 2).

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-12-m11-local-project-gate/review.diff`. That file matches the staged diff and is the diff the reviewers read. This file is not in that diff. The check script was not changed after the review. New files are `scripts/check_m11_project.py` and `evals/m11/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `config/agents/`, `package.json`, `docs/spec/05-PROJECT-PLAN.md`, and the M0B through M10 check scripts are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-04. The verifier did not run these commands. The security reviewer did not run a command. The output below is the lead-session run.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m11_project.py` | Passed. Exit 0. Output below. |
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
OK: project A record may be read
OK: project B record is refused
OK: organization_id is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M11 local project gate | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixture. No paid call and no budget change. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`security-reviewer` (`26be8d12-4ed5-4ce7-85d3-3541f1b90c6f`) read the final `review.diff` and the on-disk script. It did not run a command. It did not approve the change. No Critical finding. No High finding. Two medium notes stay open because they follow the approved plan. The kept read is pinned to the label `project_a` (`scripts/check_m11_project.py`). The project B row and the `organization_id` row are built in memory, not stored as fixtures. Three low notes stay open: the `organization_id` refusal also follows from the exact field set, the second empty-error assertion cannot fire after the equality check, and the labels are compared as exact strings. The smallest fixes those notes name would widen this slice past the approved plan, so the script was not changed. No write-class tool was added. The fixture holds the synthetic label `project_a`.

`verifier` (`85b567ab-01d9-4fbf-b1ab-252eb18368e5`) compared the final diff with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof commands as not run for that review. It found OI-021 still open, §14 still listing INT-15 as M11, no new register rows, and M12 not started. It found this file present, still a draft, and outside the diff.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The kept read is pinned to the label `project_a`. A later cross-tenant test must take the caller's project from the session and cover each caller against each record.
- The project B refusal and the `organization_id` refusal are in-memory rows. A later gate can store those rows as fixtures.
- Invitations, agency roles, live workspaces, and bulk schedules stay out. This is not the full M11 exit.
- The verifier did not execute the proof commands. The security reviewer did not execute the check.
- OI-021 stays open. Owner names stay open. `organization_id` stays out of this slice.
- The branch is not pushed. This file does not authorize a merge.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m11_project.py`, `evals/m11/`, the CI step, and `intent/INT-12-m11-local-project-gate/` returns the tree to `origin/main` at `fd23f59`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed. No workspace is live.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed. `docs/spec/05-PROJECT-PLAN.md` §14 was not edited.
