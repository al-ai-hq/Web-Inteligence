# Release: M3 local anonymous export denial

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-04-m3-anonymous-report-access/` |
| Milestone | M3, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim accepted the local M3 exit gate on 2026-10-01. This file stays a draft. It does not authorize a release, a deploy, or a merge.

`python3 scripts/check_m3_access.py` exited 0. An anonymous `pdf`, `document`, `csv`, `json`, `evidence_bundle`, `task_export`, or `full_report_copy` is denied by `export_decision` with reason `anonymous_export_prohibited`, no artifact, and no signed URL. `web_interactive` is not an export. Stored access has `public_gallery` false and `noindex` true. Product spend is `0.00` USD.

The branch `m3-anonymous-report-access` was cut from `origin/main` at `d8d3e18`. It was not pushed. OI-021 stays open. M4 has not started.

## Artifact versions

- Commit SHA: this commit on `m3-anonymous-report-access`, cut from `origin/main` at `d8d3e18`. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M3 check: `/opt/homebrew/bin/python3`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-04-m3-anonymous-report-access/review.diff`, saved after the `export_decision` fix and before this file. New files are `scripts/check_m3_access.py` and `evals/m3/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `scripts/check_m0b_proofs.py` is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-01. The reviewers did not run these commands.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m3_access.py` | Passed. Exit 0, including after `export_decision` was added. Output below. |
| `python3 scripts/check_schemas.py` | Failed, not a pass. `/opt/homebrew/bin/python3` has no `jsonschema`. |
| `python3 scripts/check_config.py` | Failed, not a pass. `/opt/homebrew/bin/python3` has no PyYAML. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schema files, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `./.venv/bin/python -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests. |
| `./.venv/bin/python -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests. |
| `./.venv/bin/python scripts/check_m0b_proofs.py` | Passed. Exit 0, including `product spend 0.00 USD`. The file was not edited. |
| `./.venv/bin/python scripts/check_action_pins.py` | Passed. 1 workflow file. No new action SHA. |
| `pnpm test:e2e` | Not run. |
| `pnpm test:ssrf` | Not run. It is the M1 suite and is not this exit. |

```text
OK: deny anonymous exports
OK: web_interactive is not an export
OK: access public_gallery false noindex true
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M3 access | yes | | | Local command above |
| M0B proofs | yes | | | Unchanged script, re-run |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer URL in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`security-reviewer` (`d089776d-8e44-40c7-aa87-cb1614cb206d`) read the first script and did not run a command. It did not pass the slice. The high finding was that the script only restated the fixture. `export_decision` was added after that review, the check was run again, and `review.diff` was saved again. That reviewer did not see the final script. Medium findings left open: the fixture is not an `ExportAuthorization` record and does not assert `download`; print routes, signed-URL issuance, and an audit-log entry are not in this slice; `link_id` and `secret_hash` are not in the access fixture. The low finding about naming the failing field was fixed in the same edit.

`verifier` (`337d2358-9563-4c58-948e-240d61350b07`) compared the pre-fix diff with the plan and did not run commands. It found the scheduled files present and the forbidden files absent. It did not see `export_decision` or this file.

A second `security-reviewer` pass (`0a060f07-66dd-4239-985a-b7e3744143a5`) read the final `review.diff` and `export_decision`. It found no high issue. It did not run a command. The medium gaps stay open: no `ExportAuthorization` record, print route, audit log, `link_id`, or `secret_hash`.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The security reviewer's medium findings above stay open.
- OI-021, OI-005, OI-036, OI-039, and OI-056 stay open.
- This slice is not the full M3 exit. There is no bilingual report, comparison view, or action board.
- The branch is not pushed.

## Rollback

No production path. Rollback of a later commit is `git revert` of that commit. Removing `scripts/check_m3_access.py`, `evals/m3/`, and the CI step returns the tree to `origin/main` at `d8d3e18`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
