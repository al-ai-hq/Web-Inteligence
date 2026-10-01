# Release: M0B contracts, threat model and cost proof

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-01-m0b-contracts-threat-model-cost-proof/` |
| Milestone | M0B |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

The five M0B exit checks passed on this machine. The proof command exited 0. `pnpm test:ssrf` and `pnpm test:e2e` exited 0 and are recorded as not run. There is no commit yet. Branch: `m0b-contracts-cost-proof`. This record does not authorize a release. M1 has not started.

## Artifact versions

- Commit SHA: none. The work is local and uncommitted.
- Image digest: none.
- Schema versions: unchanged. 87 schema files.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Local interpreter: Python 3.14.7 (`.venv`). CI pins Python 3.12. That image was not executed for this step.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No merged pull request. The path list is in `intent/INT-01-m0b-contracts-threat-model-cost-proof/review.diff`, saved before this file existed. New proof files are `scripts/check_m0b_proofs.py` and `evals/m0b/`. One governance step was added to `.github/workflows/ci.yml`. A-045 and an OI-001 note were appended.

## Commands and checks actually run

Run on 2026-10-01 from the repository root with `./.venv/bin/python` unless noted.

| Command | Result |
| --- | --- |
| `scripts/check_m0b_proofs.py` | Passed. Exit 0. Printed the five `OK` lines below, the hosting lines, and `product spend 0.00 USD`. |
| `scripts/check_schemas.py` | Passed. 87 schemas, 13 examples, 22 negative examples. |
| `scripts/check_config.py` | Passed. 3627 checks. |
| `scripts/check_action_pins.py` | Passed. `OK: action pins checked in 1 workflow file(s).` |
| `python -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests, OK. |
| `python -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests, OK. |
| `pnpm test:ssrf` | Exit 0. Recorded as not run. Printed `pnpm test:ssrf is not run. The SSRF suite arrives at M1.` |
| `pnpm test:e2e` | Exit 0. Recorded as not run. Printed `pnpm test:e2e is not run. Browser journeys arrive at M3.` |
| GitHub Actions on Python 3.12 | Not run. No push. |

Proof stdout:

```text
OK: reproduce one score 100
OK: reject one invalid record
OK: trace one report number
OK: deny anonymous csv export
OK: hard stop at 140.00 USD (cap assumption unconfirmed)
hosting 25.00 USD is estimated and is not stopped
paid calls at 140.00 plus hosting 25.00 can exceed 150.00 until OI-031
OK: parent joins
product spend 0.00 USD
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests |
| M0B proofs | yes | | | Five exit checks plus parent joins |
| SSRF suite | | | yes | Placeholder only. Real suite is the M1 exit |
| Browser journeys | | | yes | Placeholder only. Real suite is the M3 exit |
| Schema and config checks | yes | | | Schemas and config were not edited |
| Action pin check | yes | | | No new third-party action |
| Golden files | | | yes | No rule change |
| Product-agent evals | | | yes | No product agent change |
| Build-agent evals | | | yes | No tasks exist (OI-025) |
| Python 3.12 CI image | | | yes | Local Python is 3.14.7 |

## Security, privacy and cost review

`security-reviewer` reported no Critical findings. It did not run commands. High findings and what was done before this record:

- The anonymous export helper returns the denial for every anonymous request and does not branch on format. The schema constraint and the negative example `export-authorization.anonymous-authorized.invalid.json` are the checks that reject an authorized anonymous export. The helper still returns `denied` / `anonymous_export_prohibited` / no artifact for the CSV fixture.
- Lineage `project_id` was not compared with the audit, and a null project id would have matched the anonymous report. The proof now requires the chain's `project_id` to match the audit and returns no report for a null project query.

Medium and low items left as notes: anonymous `expires_at` is not compared with `created_at` beyond the schema's `retention_days` maximum; approval hash equality is fixture data and is not rechecked in code; deletion joins in this proof use `subject_type` `audit` only; no instruction-like evidence string was added. No fetch path, secret, write-class tool, provider call, or deployed service was added.

`cost-reviewer` confirmed no paid call, no hosting resource, and `0.00` USD product spend. The refusal boundary matches the approved spec: greater than `140.00` is refused, `140.00` exactly is allowed, AI visibility is `unavailable`, Presence Readiness remains, hosting is not stopped. The reviewer also said `docs/cost-model.md` §7 asks for synthetic ledger entries and a `rich_audits_per_month` figure. Those are not in the approved spec's fixture. They stay out of this slice. The combined-cap gap is OI-031, and the proof output states it.

`verifier` could not run the shell. Its command rows are not run. From the files, it found Snapshot and Verification had no broken parent. Those two dangling `change_set_id` cases were added, and `scripts/check_m0b_proofs.py` was run again and passed. The command results above are from this implementation session.

Privacy: fixtures are synthetic. No personal data and no production credentials. Cost against the USD 150 product cap: `0.00` USD.

## Arabic and accessibility evidence

No screen was added. Arabic review and WCAG 2.2 AA evidence are not run.

## Unresolved risks

- D-005 and OI-001 stay open. The proof labels the cap unconfirmed.
- OI-031: paid calls can sit at `140.00` while estimated hosting is `25.00`, so a modelled month can pass `150.00`. Owner: cloud billing owner.
- OI-021 gitleaks organization licence. This change does not turn the `secrets` job green.
- Named owners remain `<DECIDE_AT_M0: name>` (OI-002).
- Python 3.12 in GitHub Actions was not executed for the new proof step.
- No commit exists, so rollback has not been rehearsed as a revert.

## Rollback

No production path. After a commit, rollback is `git revert` of the M0B commits on `m0b-contracts-cost-proof`. Hook scripts were not changed. Staging rehearsal: not run.

## Monitoring

No service is deployed. The later signal is a green `governance` job that includes `M0B proofs`, with this file still recording the two placeholders as not run.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

Appended, without rewriting earlier rows:

- A-045 in `docs/assumptions.md`
- M0B Stage 1 note after the M0A close paragraph in `docs/open-items.md`. OI-001 stays open.

No new decision row. Departures are in `plan.md`.

Reviewers: `security-reviewer`, `cost-reviewer`, and `verifier`. They did not approve, merge, or spawn subagents. The reviewer for the exit record is a person who did not author the fixtures. That person is still unnamed (OI-002).
