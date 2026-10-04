# Release: M12 local gallery gate

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-13-m12-local-gallery-gate/` |
| Milestone | M12, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-04 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`. This file does not authorize a release, a deploy, or a merge.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-04 by the message "I approve plan.md." That message did not set `approved`. The plan status word is `done` because the local check was built. On 2026-10-04 Ibrahim accepted the local M12 exit gate. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check accepts a report only when `report` is `anonymous` and the `consent` field is absent. An absent `consent` field and JSON `null` are missing. `""` and whitespace after trimming are empty. Missing and empty are both no consent. A stored `placement` of `public` is refused for the absent, null, empty, and whitespace rows. A row that contains `public_link` is refused. A row that contains `noindex` is refused. There is no public page and no public link. noindex is not changed. No write-class tool is added. Product spend is `0.00` USD. `pnpm test:e2e` stays not run. M13 has not started.

The branch `m12-local-gallery-gate` was cut from `origin/main` at `b56291b`. It is not pushed. OI-021 stays open. `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-16 as M12. That table was not edited.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved` or `accepted`.

## Artifact versions

- Commit SHA: parent `b56291b`. This commit on `m12-local-gallery-gate` records the slice. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M12 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD. That line is the check's own statement. It is not a measured cost proof (D-019 stage 2).

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-13-m12-local-gallery-gate/review.diff`, saved before this file. This file is not in that diff. The check script was not changed after the review. New files are `scripts/check_m12_gallery.py` and `evals/m12/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `config/agents/`, `package.json`, `docs/spec/05-PROJECT-PLAN.md`, and the M0B through M11 check scripts are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-04. The verifier did not run these commands. The security reviewer did not run a command. The output below is the lead-session run.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m12_gallery.py` | Passed. Exit 0. Output below. |
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
OK: missing consent stays out of the public gallery
OK: empty consent is no consent
OK: stored public placement is refused
OK: public_link is refused
OK: noindex is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M12 local gallery gate | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixture. No paid call and no budget change. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`security-reviewer` (`d1206f06-66bb-4dc3-8c87-f71278678417`) read `review.diff` and the on-disk script. It did not run a command. It did not approve the change. No Critical finding. No High finding. Two medium notes stay open because they follow the approved plan. A non-string consent value such as `false` or `0` is treated as present consent. The public-placement check matches the lowercase literal `public`. Four low notes stay open. The `placed` label repeats the `public` refusal. Nested `public_link` and `noindex` keys are not named. The present-consent assertion checks the safe direction. The empty-consent line rests on `consent_kind`. The smallest fixes those notes name would widen this slice past the approved plan, so the script was not changed. No write-class tool was added. The fixture holds the synthetic label `anonymous`. The public placement, `public_link`, and `noindex` refusals are present in the script.

`verifier` (`9e61413c-bf20-480b-92ed-e1128701bae4`) compared the files with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof commands as not run for that review. It found OI-021 still open, §14 still listing INT-16 as M12, no new register rows, and M13 not started. It found `release.md` absent, which this file now fills. It did not see this file. It ran beside the security reviewer, so it did not see that review.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- A non-string consent value is treated as present consent. A later gallery must treat `false`, `0`, and an empty object as no consent.
- The public-placement check matches the literal `public`. A later gate has to decide case and surrounding spaces.
- Removal, benchmarks, tones, and a live gallery stay out. This is not the full M12 exit.
- The verifier did not execute the proof commands. The security reviewer did not execute the check.
- OI-021 stays open. Owner names stay open.
- The branch is not pushed. This file does not authorize a merge.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m12_gallery.py`, `evals/m12/`, the CI step, and `intent/INT-13-m12-local-gallery-gate/` returns the tree to `origin/main` at `b56291b`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed. No page is public.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed. `docs/spec/05-PROJECT-PLAN.md` §14 was not edited.
