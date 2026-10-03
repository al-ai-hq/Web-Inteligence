# Release: M9 local write gate

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-10-m9-local-write-gate/` |
| Milestone | M9, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-03 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`. This file does not authorize a release, a deploy, or a merge.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-03 by the message "I approve plan.md." That message did not set `approved`. The plan status word is `done` because the local check was built. On 2026-10-03 Ibrahim accepted the local M9 exit gate. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check accepts a write only when `approvals` is `["synthetic_approval"]`. A missing approval and an empty approval list are refused. A change passes only when its status is `DRAFT` and it is not published. Storing that draft as published is refused, including when an edit approval is present. A `connector` field and a `pull_request` field are refused. There is no CMS write, no client pull request, and no staging run. No connector is chosen. No write-class tool is added. Product spend is `0.00` USD. `pnpm test:e2e` stays not run. M10 has not started.

The branch `m9-local-write-gate` was cut from `origin/main` at `e12afd7`. It is not pushed. OI-021 stays open.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved` or `accepted`.

## Artifact versions

- Commit SHA: parent `e12afd7`. This commit on `m9-local-write-gate` records the slice. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples. `change_state` still has no `PUBLISHED` value.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M9 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-10-m9-local-write-gate/review.diff`, saved before this file. This file is not in that diff. New files are `scripts/check_m9_write.py` and `evals/m9/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `config/agents/`, `package.json`, and the M0B through M8 check scripts are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-03. The verifier did not run these commands. The security reviewer did not run a command. The output below is the lead-session run.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m9_write.py` | Passed. Exit 0. Output below. |
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
OK: write approval is synthetic_approval
OK: missing approval is refused
OK: empty approval list is refused
OK: change status is DRAFT
OK: published draft is refused
OK: edit approval is not publication permission
OK: pull_request field is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M9 local write gate | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`security-reviewer` (`a3f22b70-e133-491c-91d6-0add0cb492ca`) read `review.diff` and the on-disk script. It did not run a command. It did not approve the change. No Critical finding and no High finding. The script matched the diff hunk, 153 lines. Medium findings stay open. M-1: the fixture approval is the string `synthetic_approval`, not a change-set approval object. The approved plan pins that list. M-2: publication is the fixture field `published`, not `mode` or `publish_approval_id`. The approved plan pins that field, and this slice does not add `PUBLISHED` to `change_state`. M-3: the classifiers accept the pinned fixture values. The approved plan requires that pin. M-4: the fixtures have no `project_id`. The spec already says they are not a full change set. Low findings stay open: `published` is checked with `is True`; two assertions repeat the same comparison; a malformed fixture can traceback; the `connector` and `pull_request` labels sit on top of the field-set check; the new CI step runs before the action-pin step. OI-021 stays open. `config/agents/` was not edited.

`verifier` (`59f0788c-d267-47c6-942d-7c56f0ded623`) compared the files with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof commands as not run for that review. It found OI-021 still open and no new register rows. It found `release.md` absent, which this file now fills. It did not see this file.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The security review found no High finding. Its Medium findings stay open as recorded above. They follow the approved plan. The fixtures are not a full change set.
- The verifier did not execute the proof commands.
- OI-021 stays open. The first connector (D-011), the impact ledger, and the owner names stay open.
- Ibrahim accepted the local exit gate. Staging scenarios, rollback, and the impact ledger stay out. This is not the full M9 exit.
- The branch is not pushed. This file does not authorize a merge.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m9_write.py`, `evals/m9/`, the CI step, and `intent/INT-10-m9-local-write-gate/` returns the tree to `origin/main` at `e12afd7`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
