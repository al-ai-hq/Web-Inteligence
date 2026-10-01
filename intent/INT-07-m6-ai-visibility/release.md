# Release: M6 local AI visibility denominator

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-07-m6-ai-visibility/` |
| Milestone | M6, first local slice only |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim approved `plan.md` on 2026-10-01 by the message "I approve plan.md" and said not to set `approved`. This file stays a draft. It does not authorize a release, a deploy, or a merge.

The local check keeps observed AI visibility `24` apart from Presence Readiness `31` and Experience Effectiveness `22`, and refuses the sums `55` and `46`. Eight prompts across five synthetic slots, with two slots failed, compute a denominator of `24`. A copy with one failed slot recomputes the denominator as `32`. When every slot fails, the rate is `unavailable`, not `0%` and not `0`. Product spend is `0.00` USD. There is no provider call. M7 has not started.

The branch `m6-ai-visibility` was cut from `origin/main` at `8753bf9`. It was not pushed. The change is uncommitted. OI-021 stays open.

`spec.md` and `intent.md` still show the status word `draft`. This session did not set `approved`.

## Artifact versions

- Commit SHA: branch `m6-ai-visibility` points at `8753bf9`. The slice is an uncommitted working tree on that commit. Not pushed.
- Image digest: none.
- Schema versions: unchanged. 87 schema files, 13 examples, 22 negative examples.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Python for the passing M6 check: Python 3.14.7 at `/opt/homebrew/opt/python@3.14/bin/python3.14`. Schema and config checks passed with `./.venv/bin/python`.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request for this slice. The path list is in `intent/INT-07-m6-ai-visibility/review.diff`, saved before this file. New files are `scripts/check_m6_visibility.py` and `evals/m6/`. One `run` step was added to `.github/workflows/ci.yml`. No new action SHA. `schemas/`, `config/`, `config/prompt-panels/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, and `scripts/check_m5_experience.py` are not in the diff. The untracked Icon file is not in the diff.

## Commands and checks actually run

Lead session, 2026-10-01. The verifier did not run these commands. The security reviewer did not run a command. The output below is the run after the review fixes.

| Command | Result |
| --- | --- |
| `python3 scripts/check_m6_visibility.py` | Passed. Exit 0. Output below is the run after the review fixes. |
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
OK: valid denominator is 24
OK: a different failure count is recomputed
OK: failed providers are not stored as 0% or 0
OK: observed AI visibility stays apart from both scores
OK: merged totals refused
OK: visibility count is not written into search performance
OK: all-fail rate is unavailable
OK: all-fail rate is not 0% or 0
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests, on Python 3.14.7 |
| Unit / integration | | | yes | No Vitest run in this slice |
| SSRF suite | | | yes | M1 suite. Not this exit |
| M6 AI visibility | yes | | | Local command above |
| Golden files | | | yes | Not this slice |
| Product-agent evals | | | yes | |
| Build-agent evals | | | yes | |
| `pnpm test:e2e` | | | yes | Placeholder stays not run |

## Security, privacy and cost review

No fetch, no secret, and no customer prompt text in the fixtures. No paid call and no hosting. Product spend `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

`verifier` (`5c0640aa-e00b-47ae-895c-f2dc2178639d`) compared the working tree with the plan and did not run a command. It did not approve the change. It found the scheduled files present and the forbidden files absent. It marked the proof output as not done for that review because it did not observe a command exit. It found OI-021 still open and M7 not started. It did not see this file or the later script change.

`security-reviewer` (`88baee37-ae41-4a30-913c-d95a6395978f`) read the first script and did not run a command. It did not approve the change. No Critical finding and no High finding. Medium: a zero test refused any count whose value was `0`, and the separation case required the visibility count to equal the denominator. After that review, the zero test stays on a failed slot and on the all-fail rate, the visibility count is no longer tied to the denominator, and an in-memory copy with one failed slot must recompute the denominator as `32`. The check was run again and exited 0. `review.diff` was saved again. That reviewer did not see the final script. Low findings left open: the merge check covers visibility added to either score, not readiness added to experience effectiveness; a merged total stored as a string or a float is not the integer check; a malformed fixture can still traceback; `rate_errors` applies to the all-fail case; `search_performance` can be appended twice.

Reviewers do not approve, merge, or spawn subagents.

## Arabic and accessibility evidence

No screen. No Arabic or accessibility review.

## Unresolved risks

- The security reviewer's open low findings above stay open. That reviewer did not see the final script.
- The verifier did not execute the proof commands and did not see the final script.
- OI-021 stays open. D-011, the prompt-panel contents, and the USD 150 cap stay open.
- This slice is not the full M6 exit. A live provider gateway and the observation catalogue stay out.
- The branch is not pushed, and the slice is not committed.

## Rollback

No production path. The slice is uncommitted. Removing `scripts/check_m6_visibility.py`, `evals/m6/`, the CI step, and `intent/INT-07-m6-ai-visibility/` returns the tree to `origin/main` at `8753bf9`. After a later commit, rollback is `git revert` of that commit. Staging rehearsal was not run.

## Monitoring

None. Nothing was deployed.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new row in `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, or `docs/sources.md`. OI-021 was not closed.
