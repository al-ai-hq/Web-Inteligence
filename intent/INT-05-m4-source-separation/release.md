# Release: M4 local source separation

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-05-m4-source-separation/` |
| Milestone | M4, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-01 by the message "approved". This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check keeps Search Console `12` and GA4 `40` in separate totals and refuses a combined total of `52`. A missing optional GA4 source stays `not_supplied`. That state is not `measured_zero` and it is not `0`. Product spend is `0.00` USD. There is no Search Console connection, no GA4 connection, and no claim flow.

The branch `m4-source-separation` was cut from `origin/main` at `73d1d4d`. It was not pushed. The change is uncommitted. OI-021 stays open. M5 has not started.

`spec.md` still shows the status word `draft`. Ibrahim approved that spec in the earlier message "I approve spec.md". This session did not edit that status word.

## Artifact versions

- Commit SHA: branch `m4-source-separation` points at `73d1d4d`. The slice is an uncommitted working tree on that commit. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M4 check: `/opt/homebrew/bin/python3` (Python 3.14.7). Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-05-m4-source-separation/review.diff`, saved before this file. New files are `scripts/check_m4_sources.py` and `evals/m4/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, and `scripts/check_m3_access.py` are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-01. The verifier did not run these commands. The security reviewer did not run a command.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m4_sources.py` | Passed. Exit 0. Run again after `separate_totals` was changed to sum rows that share a source. Output below is that later run. |
| `python3 scripts/check_schemas.py` | Failed, not a pass. `/opt/homebrew/bin/python3` has no `jsonschema`. |
| `python3 scripts/check_config.py` | Failed, not a pass. `/opt/homebrew/bin/python3` has no PyYAML. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schema files, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `python3 -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests. |
| `python3 -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests. |
| `python3 scripts/check_action_pins.py` | Passed. 1 workflow file. No new action SHA. |
| `pnpm test:e2e` | Not run. |
| `pnpm test:ssrf` | Not run. It is the M1 suite and is not this exit. |

```text
OK: separate search_console and ga4 totals
OK: combined total refused
OK: same-source rows are summed
OK: missing optional source is not_supplied
OK: not_supplied is not measured_zero
OK: not_supplied is not 0
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on `/opt/homebrew/bin/python3` |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M4 source separation | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer account id in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`verifier` (`a9ff5092-6d97-48b4-9be6-2bac27cec794`) compared the working tree with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the behaviour checks as partly done because exit 0 was not observed in that session. It found no Search Console connection, no GA4 connection, no claim flow, OI-021 still open, and M5 not started. It did not see this file or the later `separate_totals` change.

`security-reviewer` (`95584623-2812-43f6-8b2e-1b35c5974b79`) read the first script and did not run a command. It did not approve the change. No Critical finding. High: the pass path copied each row, and the row shape rejects `project_id` against D-014 and `schemas/performance-observation.schema.json`. After that review, `separate_totals` sums rows that share a source, and a stored `52` on `search_console` beside GA4 `40` is refused. The check was run again and exited 0. `review.diff` was saved again. That reviewer did not see the final script. The `project_id` and full-schema findings stay open: the approved spec says this fixture is not a stored metric row, and the plan keeps each row to `source`, `value`, and `integrity_state`. Medium findings left open: the golden fixture still has one row per source; the source list in this check is the two sources in the spec, while the performance-observation schema also allows `pagespeed` and `crux`; the rows have no `as_of` or `fidelity_label`. Low findings left open: a malformed fixture now fails through `fail()` for a missing `rows` or `totals` object; other malformed shapes can still traceback. The overlapping missing-source labels stay, and each negative copy still produces its own label.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The security reviewer's open findings above stay open. That reviewer did not see the final script.
- The verifier did not execute the proof commands and did not see the final script.
- OI-021 and OI-005 stay open.
- This slice is not the full M4 exit. Expected-value formulas and the claim flow stay out.
- The branch is not pushed, and the slice is not committed.

## Rollback

No production path. The slice is uncommitted. Removing `scripts/check_m4_sources.py`, `evals/m4/`, the CI step, and `intent/INT-05-m4-source-separation/` returns the tree to `origin/main` at `73d1d4d`. After a later commit, rollback is `git revert` of that commit. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
