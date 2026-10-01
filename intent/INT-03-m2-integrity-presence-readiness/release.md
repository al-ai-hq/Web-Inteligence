# Release: M2 local Presence Readiness disclosure

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-03-m2-integrity-presence-readiness/` |
| Milestone | M2, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim accepted the local M2 exit gate on 2026-10-01. This file stays a draft. It does not authorize a release, a deploy, or a merge.

`./.venv/bin/python scripts/check_m2_readiness.py` exited 0. It recomputed pre-cap Presence Readiness 100, disclosed `presence_readiness` at `methodology_version` `0.1.0-draft` with coverage `sample`, refused coverage `full`, refused a blended measurement, refused `unavailable` and `not_applicable` shown as `pass`, and left the weights unchanged. Product spend is `0.00` USD.

`/opt/homebrew/bin/python3` failed and is recorded as failed, not run. `pnpm test:ssrf` and `pnpm test:e2e` stay not run.

Pull request https://github.com/al-ai-hq/Web-Inteligence/pull/2 was not merged. M3 has not started.

## Artifact versions

- Commit SHA: this commit on `m2-presence-readiness`, cut from `m1-secure-crawler` at `afa0cdc`. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing checks: `./.venv/bin/python`, Python 3.14.7. `/opt/homebrew/bin/python3` has no PyYAML.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-03-m2-integrity-presence-readiness/review.diff`, saved before this file. New files are `scripts/check_m2_readiness.py` and `evals/m2/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `scripts/check_m0b_proofs.py` is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-01. The reviewers did not run these commands.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m2_readiness.py` | Failed, not run. `/opt/homebrew/bin/python3` has no PyYAML (`No module named 'yaml'`). This is not a pass. |
| `./.venv/bin/python scripts/check_m2_readiness.py` | Passed. Exit 0. Output below. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schema files, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `./.venv/bin/python -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests. |
| `./.venv/bin/python -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests. |
| `./.venv/bin/python scripts/check_m0b_proofs.py` | Passed. Exit 0, including `product spend 0.00 USD`. The file was not edited. |
| `./.venv/bin/python scripts/check_action_pins.py` | Passed. 1 workflow file. No new action SHA. |
| `pnpm test:e2e` | Not run. |
| `pnpm test:ssrf` | Not run. It is the M1 suite and is not this exit. |

```text
OK: recompute presence readiness 100
OK: disclosure presence_readiness 0.1.0-draft sample
OK: refuse coverage full
OK: refuse blended measurement
OK: refuse unavailable shown as pass
OK: refuse not_applicable shown as pass
OK: methodology_version and weights unchanged
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M2 readiness | yes | | | Local command above |
| M0B proofs | yes | | | Unchanged script, re-run |
| Golden files | | | yes | OI-055. Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer URL in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`seo-method-checker` (`d3b29884-b013-4ceb-9f37-859c7762397c`) reported pass from the files. Ask mode blocked its shell. It did not run the readiness command. It found no blend, no `llms.txt` score, no FAQ requirement, and no rich-result promise.

`verifier` (`863f2426-1935-4f8f-ae22-352ac1e7bb4d`) compared the saved diff with the plan and did not run commands. It found the scheduled files present and the forbidden files absent. It noted that `release.md` was not in the diff, which matches this order, and that the OK lines are recorded here rather than pasted into `plan.md`.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review. The Arabic display name in `config/scoring.yaml` was not edited.

## Unresolved risks

- OI-032, OI-033, OI-034, and OI-055 stay open. The zero-denominator category score stays `<DECIDE_AT_M0>`.
- Methodology owner and SEO lead sign-offs on the spec are still pending.
- This slice is not the full M2 rules-engine exit.
- Pull request 2 is still open. Merging it is not part of this record.

## Rollback

No production path. Rollback of a later commit is `git revert` of that commit. Removing `scripts/check_m2_readiness.py`, `evals/m2/`, and the CI step returns the tree to the M1 suite plus the M0B proofs. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. The spec says this slice adds none.
