# Release: M8 local content gate

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-09-m8-local-content-gate/` |
| Milestone | M8, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-02 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`. This file does not authorize a release, a deploy, or a merge.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-02 by the message "I approve plan.md." That message did not set `approved`. The plan status word is `done` because the local check was built. On 2026-10-02 Ibrahim accepted the local M8 exit gate. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check accepts a claim whose source is `synthetic_source`. A missing source and an empty source are refused. A new page passes only when the cannibalization result is `checked`. A missing result stays null. Storing it as `pass` is refused. A page passes only when its status is `unpublished`. A page stored as `published`, a `draft` status, and a `pull_request` field are refused. There is no CMS draft, no client pull request, and no automatic publishing. Product spend is `0.00` USD. `pnpm test:e2e` stays not run. M9 has not started.

The branch `m8-local-content-gate` was cut from `origin/main` at `5dc6646`. It is not pushed. OI-021 stays open.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved` or `accepted`.

## Artifact versions

- Commit SHA: parent `5dc6646`. This commit on `m8-local-content-gate` records the slice. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M8 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-09-m8-local-content-gate/review.diff`, saved before this file. This file is not in that diff. New files are `scripts/check_m8_content.py` and `evals/m8/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `package.json`, and the M0B through M7 check scripts are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-02. The verifier did not run these commands. The security reviewer did not run a command. The output below is the lead-session run.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m8_content.py` | Passed. Exit 0. Output below. |
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
OK: claim source is synthetic_source
OK: missing source is refused
OK: empty source is refused
OK: new page cannibalization result is checked
OK: missing cannibalization result is null
OK: missing cannibalization result is not stored as pass
OK: page status is unpublished
OK: published page is refused
OK: draft status is refused
OK: pull_request field is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M8 local content gate | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`security-reviewer` (`50c9f508-fdc5-4202-afe1-59dbe24dab33`) read `review.diff` and the on-disk script. It did not run a command. It did not approve the change. No Critical finding and no High finding. The script matched the diff hunk, 210 lines. Medium findings stay open. M-1: `classify_claim` accepts only the literal `synthetic_source`. The approved plan and the implementation request pin that source, so this slice does not widen it to every non-empty string. M-2: `classify_status` accepts only `unpublished`. The approved plan pins that status. The spec assumption that any status other than `published` would pass is narrower in the plan, and this slice follows the plan. M-3: the refusals are in-memory. This step does not guard a CMS or a stored page. No code change. Low findings stay open: no `project_id` on these synthetic rows; a malformed fixture can traceback; `pull_request` is checked on the status row and the same guard on the claim and page rows is not separately exercised; a page that omits `cannibalization_result` is not a separate assertion; one dead `expected is None` branch. OI-021 stays open.

`verifier` (`9f89be4e-836a-4faa-ba20-1c823a69afad`) compared the files with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof commands as not run for that review. It found OI-021 still open and no new register rows. It found `release.md` absent, which this file now fills. It did not see this file.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The security review found no High finding. Its Medium findings stay open as recorded above. M-1 and M-2 follow the approved plan. M-3 is the limit of a local check.
- The verifier did not execute the proof commands.
- OI-021 stays open. The content-approver name, the later schema types, and Arabic editorial review stay open.
- Ibrahim accepted the local exit gate. Citation evals, schema work, and the approval workflow stay out. This is not the full M8 exit.
- The branch is not pushed. This file does not authorize a merge.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m8_content.py`, `evals/m8/`, the CI step, and `intent/INT-09-m8-local-content-gate/` returns the tree to `origin/main` at `5dc6646`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
