# Plan: M0B contracts, threat model and cost proof

| Field | Value |
| --- | --- |
| Spec | `intent/INT-01-m0b-contracts-threat-model-cost-proof/spec.md` (status: approved) |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Engineer approval | Ibrahim, 2026-10-01, by the message "I approve plan.md. Implement only that plan, locally, on this machine." The named engineer role remains `<DECIDE_AT_M0: name>` (OI-002). |
| Tech lead approval | Ibrahim, 2026-10-01, same message. The named tech-lead role remains `<DECIDE_AT_M0: name>` (OI-002). |
| Branch | `m0b-contracts-cost-proof` |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

The whole approved M0B spec, in one slice. The five proofs, the parent-join check, and the CI step ship together.

No crawler, no deployed service, no Terraform, no live provider call, no rule-weight change, no M0A toolchain change, and no M1 work. Product spend stays `0.00` USD.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `scripts/check_m0b_proofs.py` | Create | Spec proof command. Standard library plus `jsonschema`. |
| `evals/m0b/score-fixture.json` | Create | Seven `pass` rules and the stored score of 100. |
| `evals/m0b/trace-fixture.json` | Create | Report headline linked to the score, rule results, and one evidence object. |
| `evals/m0b/export-fixture.json` | Create | Anonymous CSV denial. |
| `evals/m0b/cost-fixture.json` | Create | Refuse above `140.00`, allow a call that lands on `140.00`. |
| `evals/m0b/project-joins.json` | Create | Seven parent joins, one valid set and one broken case each. |
| `.github/workflows/ci.yml` | Add one governance step | `python3 scripts/check_m0b_proofs.py` after the action-pin step. No new action SHA. |
| `docs/assumptions.md` | Append A-045 | Equality rule for the paid-call stop. Do not rewrite earlier rows. |
| `docs/open-items.md` | Append a note | OI-001 stays open and does not block Stage 1. |
| `intent/INT-01-m0b-contracts-threat-model-cost-proof/review.diff` | Create after the proofs pass | Input for the reviewers. |
| `intent/INT-01-m0b-contracts-threat-model-cost-proof/release.md` | Create after the reviewers | Record command, fixture, and reviewer. Status stays `draft`. |

Do not edit `config/budgets.yaml`, `config/scoring.yaml`, `config/agents/`, `schemas/`, hooks, or the M0A toolchain.

## Order of work

1. Write the fixtures and `scripts/check_m0b_proofs.py`.
2. Run the script until it exits 0. The checks are: Presence Readiness recomputed as 100; the ready-without-full-lineage report rejected; headline 100 traced to evidence; anonymous CSV denied and `fixer` has no write-class tool; paid call `0.01` refused at paid-to-date `140.00` and allowed at `139.99`; seven parent joins.
3. Add the CI step. Run `scripts/check_schemas.py` and `scripts/check_config.py`. Record `pnpm test:ssrf` and `pnpm test:e2e` as not run.
4. Append A-045 and the OI-001 note.
5. Save `review.diff`. Run `security-reviewer`, `cost-reviewer`, and `verifier` locally. They do not approve, merge, or spawn subagents.
6. Write `release.md` and stop. Do not start M1.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| Float arithmetic moves the score off 100 | Low | Use `Decimal` for the score and for money | Data engineer |
| A new `config/*.yaml` fails `check_config.py` | Low | Join rules stay in `evals/m0b/` | Tech lead |
| The `secrets` job stays red | High | OI-021 stays open. This slice does not change gitleaks | Security engineer |
| Hosting `25.00` is mistaken for part of the stop line | Medium | The script prints that hosting is estimated and is not stopped | Cloud billing owner |

## Proof

```bash
python3 scripts/check_m0b_proofs.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
python3 scripts/check_action_pins.py
```

`pnpm test:ssrf` and `pnpm test:e2e` stay placeholders recorded as not run. Paste real output into `release.md`.

## Security, privacy, cost, Arabic/accessibility review

`security-reviewer` reads `review.diff` and checks: no fetch path, no secret, anonymous export denied, parent joins, no write-class tool added.

`cost-reviewer` checks: no paid call, threshold `140.00` from `config/budgets.yaml`, refusal is `unavailable`, hosting is not stopped, product spend `0.00` USD.

`verifier` compares the files and commands with this plan.

No screen, so no Arabic or accessibility evidence.

## Rollback

`git revert` of the M0B commits on `m0b-contracts-cost-proof`. No service and no staging rehearsal.

## Departures from the plan

- 2026-10-01: After the first security and cost reviews, the proof also checks lineage `project_id` against the audit, rejects a null project query, requires distinct report `link_id` values, and copies the change-set hashes into the approval binding. The hard-stop output prints that hosting `25.00` is estimated and is not stopped, and that paid calls at `140.00` plus that hosting line can exceed `150.00` until OI-031.
- 2026-10-01: The approved spec's hard stop uses aggregate paid-call cases. Synthetic `CostLedgerEntry` rows and `rich_audits_per_month` are not in this slice. D-019's Stage 1 refusal clause is what the script proves.
- 2026-10-01: The verifier's file review found no broken parent for Snapshot or Verification. Those two dangling `change_set_id` cases were added before `release.md`.
