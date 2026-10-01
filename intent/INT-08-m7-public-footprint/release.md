# Release: M7 local public footprint

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-08-m7-public-footprint/` |
| Milestone | M7, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-01 by the message "I approve plan.md" and said not to set `approved`. On 2026-10-01 Ibrahim accepted the local M7 exit gate. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check keeps a public fact on the synthetic source `synthetic_source` with confidence `medium`. `high` and `low` stay legal labels. A missing review count stays null, not `0` and not `4`. A correction stays `pending`, not `applied`. A trimmed or uppercase URL source is refused. Product spend is `0.00` USD. There is no fetch and no connector write. `pnpm test:e2e` stays not run. M8 has not started.

The branch `m7-public-footprint` was cut from `origin/main` at `c01dbd4`. It is not pushed. OI-021 stays open.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved`.

## Artifact versions

- Commit SHA: parent `c01dbd4`. This commit on `m7-public-footprint` records the slice. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M7 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-08-m7-public-footprint/review.diff`, saved before this file. New files are `scripts/check_m7_footprint.py` and `evals/m7/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, and `scripts/check_m6_visibility.py` are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-01. The verifier did not run these commands. The security reviewer did not run a command. The output below is the run after the review fixes.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m7_footprint.py` | Passed. Exit 0. Output below is the run after the review fixes. |
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
OK: public fact shows a source and a confidence label
OK: missing source is refused
OK: missing confidence label is refused
OK: missing review count is null
OK: missing review count is not 0
OK: missing review count is not another number
OK: correction stays pending
OK: applied correction is refused
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M7 public footprint | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer page text in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`verifier` (`7f8f7e13-89fc-4f0e-b98d-f430c084d77e`) compared the working tree with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof output as not done for that review because it did not observe a command exit. It found OI-021 still open and M8 not started. It did not see this file or the later script change.

`security-reviewer` (`012c67a7-7b7e-4e5c-b3e3-d6de839e5e54`) read the first script and did not run a command. It did not approve the change. No Critical finding and no High finding. Medium: the source check only refused a lowercase `http` prefix. After that review, the check also refuses a trimmed, case-folded `http` prefix, a `//` prefix, and any `://`. `high` and `low` are checked as literal stored rows. The check was run again and exited 0. `review.diff` was saved again. That reviewer did not see the final script. Left open: a platform name inside the source value is not a blocklist, because this slice does not choose platforms. Low findings left open: a non-integer zero is refused by the classification but not labelled `zero`; a missing count key uses a `False` sentinel; some failure branches are duplicates; a malformed fixture can still traceback.

`security-reviewer` (`794fd086-c694-4b4f-8372-f83548d81eda`) read the final script in `review.diff` and did not run a command. It did not approve the change. No Critical finding and no High finding. Medium findings stay open: `javascript:` and `file:` are not refused, and a non-label string can still be stored as a source. Nothing in this slice fetches that source.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The second security review found no High finding. Its Medium findings stay open: `javascript:` and `file:` are not refused, and a non-label string can still be stored as a source.
- The verifier did not execute the proof commands and did not see the final script.
- OI-021 stays open. Approved public sources, review platforms, listing platforms, and Arabic transliteration stay open.
- Ibrahim accepted the local exit gate. Approved discovery, the entity graph, and a live correction workflow stay out.
- A displayed review count of `0` stays out of this slice.
- The branch is not pushed.

## Rollback

No production path. Rollback of this commit is `git revert` of that commit. Removing `scripts/check_m7_footprint.py`, `evals/m7/`, the CI step, and `intent/INT-08-m7-public-footprint/` returns the tree to `origin/main` at `c01dbd4`. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
