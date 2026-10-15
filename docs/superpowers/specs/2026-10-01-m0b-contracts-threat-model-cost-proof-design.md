# M0B Design: Contracts, Threat Model and Cost Proof

Status: draft for review
Date: 2026-10-01
Intent: INT-01
Approach: proof-driven (Option A)

## 1. Purpose

M0B validates that the governance documents hold together before M1 builds on them. The exit gate is 5 independent proofs that demonstrate: a score can be reproduced, an invalid record is rejected, a report number traces to evidence, an unauthorized action is denied, and the USD 150 hard stop works.

This is a validation milestone, not a design milestone. The contracts, schemas, state machines, threat model, and cost model already exist as drafts. We prove they are consistent by building the proofs; we fix gaps as the proofs expose them.

## 2. Approach: Proof-driven

Build the 5 exit-gate proof scripts first, against the schemas and config as they are today. Gaps and inconsistencies surface naturally when constructing valid fixtures, tracing lineage, or simulating the hard stop. Fix schemas, state machines, or governance docs only where a proof requires it.

What we do not do: audit all 87 schemas for completeness, add fields "just in case", or normalize naming across schemas that the proofs do not touch.

## 3. The 5 proof scripts

Each proof is a standalone Python script in `scripts/proofs/`. Fixtures live in `scripts/proofs/fixtures/proof_N/`. A runner script (`scripts/proofs/run_all.py`) executes all five and prints a summary.

### Proof 1: Reproduce one score

- **Input fixture**: A complete audit record with ~3 evidence objects, ~3 rule results, and a score result, all valid JSON against their schemas.
- **Logic**: Re-run the scoring formula from `config/scoring.yaml` (weights, caps) over the rule results. Compare the recomputed score to the stored `ScoreResult.total_score`. They must match exactly.
- **Schemas touched**: `audit`, `evidence-object`, `rule-result`, `score-result`, `finding`, `common` (enums for `rule_result`, `risk_tier`).
- **Passes when**: Recomputed score equals stored score, all evidence has valid `fidelity_label`, all rule results cite evidence.

### Proof 2: Reject one invalid record

- **Input fixture**: An audit request with a private/reserved IP URL (e.g., `http://169.254.169.254/`), plus a second fixture with an invalid `fidelity_label`.
- **Logic**: Validate each fixture against its schema. Check the URL against SSRF blocklist rules from `config/crawler-registry.yaml`. Verify the schema rejects unknown enum values.
- **Schemas touched**: `audit`, `audit-scope`, `common`, `capability-manifest`.
- **Passes when**: Both invalid fixtures fail validation with the expected error messages.

### Proof 3: Trace one report number to evidence

- **Input fixture**: A `ReportModel` with 2-3 numbers, each linked via `LineageRecord` to an `EvidenceObject` with a valid `fidelity_label`.
- **Logic**: For each number in the report, follow the lineage chain: `ReportModel` -> `LineageRecord` -> `EvidenceObject`. Verify every number has a complete chain, every evidence object has a `content_hash`, and no chain includes an `unavailable` label presented as `verified`.
- **Schemas touched**: `report-model`, `lineage-record`, `evidence-object`, `common`.
- **Passes when**: Every report number traces to at least one evidence object with a consistent fidelity mapping.

### Proof 4: Deny one unauthorized export or write

- **Input fixture**: An `ExportAuthorization` request from an `anonymous_visitor` for a download (not allowed per D-002), plus a `ChangeSet` approval attempt by a non-owner.
- **Logic**: Check the export request against anonymous-access rules (in-app only, no downloads). Check the change approval against the IAM matrix (only `project_owner` or `approver` can approve). Both must be denied.
- **Schemas touched**: `export-authorization`, `change-set`, `approval`, `common` (enums for `anonymous_access_state`, `change_state`).
- **Passes when**: Both unauthorized actions are correctly denied by the policy rules.

### Proof 5: Simulate the USD 150 hard stop

- **Input fixture**: A series of `CostLedgerEntry` records totaling USD 142, plus a new AI model call estimated at USD 9.00.
- **Logic**: Load `config/budgets.yaml` (monthly cap = 150, reserve = 10). Sum existing ledger entries. Check if the new call would push total past `cap - reserve` (140). The call must be blocked.
- **Schemas touched**: `cost-ledger-entry`, `provider-breaker`.
- **Passes when**: The cost guard blocks the call because `142 + 9 > 150 - 10`.

## 4. Schema gap closure

When a proof script needs a field, enum value, or cross-schema reference that does not exist yet, fix it inline. Only fix what the proof requires.

Process for each gap:

1. Proof script fails because a schema is missing a required field or has an incompatible type.
2. Check if the gap is in the schema or the fixture. Sometimes the fixture was wrong, not the schema.
3. Fix the schema with the minimum change: add the field, correct the enum, fix the `$ref`. Update `schemas/common.schema.json` if it is a shared enum or format.
4. Update `check_schemas.py` if the validation script needs to understand the new structure.
5. Re-run schema validation to confirm nothing else broke.
6. Continue the proof.

Schemas most likely to need fixes:

| Proof         | Schemas at risk                                     | Likely gaps                               |
| ------------- | --------------------------------------------------- | ----------------------------------------- |
| 1 (score)     | `score-result`, `rule-result`, `common`             | Scoring formula fields, weight references |
| 2 (reject)    | `audit`, `audit-scope`, `common`                    | SSRF validation rules, enum strictness    |
| 3 (lineage)   | `report-model`, `lineage-record`, `evidence-object` | Lineage chain fields, fidelity mapping    |
| 4 (deny)      | `export-authorization`, `change-set`, `approval`    | Authorization check logic, actor enums    |
| 5 (cost stop) | `cost-ledger-entry`, `provider-breaker`             | Ledger summation fields, breaker state    |

## 5. Governance doc updates

Governance docs are updated only when a proof exposes a gap, not in a separate review pass.

| Doc                              | When it gets updated                                                                                                          | What changes                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/state-machines.md`         | If a proof fixture needs a transition that is not in the table, or a transition references a schema field that does not exist | Add or fix the transition row; align actor names with `common.schema.json` enums |
| `docs/threat-model.md`           | If Proof 4 reveals an IAM gap not in the abuse-case table                                                                     | Add the abuse case, control, and test reference                                  |
| `docs/cost-model.md`             | If Proof 5 reveals a formula or config mismatch                                                                               | Fix the formula or the config, not both. Config is the source of truth           |
| `docs/iam-matrix.md`             | If Proof 4 shows an actor/permission pair that is missing or wrong                                                            | Add the row; align with `common.schema.json` actor enums                         |
| `docs/retention-deletion-map.md` | Only if a proof touches retention (unlikely for the 5 proofs)                                                                 | Probably untouched at M0B                                                        |

Rule: A governance doc change must be traceable to a specific proof failure. Observations that do not block a proof are flagged as open items in `release.md`.

Config files (`config/budgets.yaml`, `config/scoring.yaml`, etc.) are treated as code, not docs. If a proof fails because config is wrong, fix the config and note it in the proof output.

## 6. Assumptions for open decisions

| Placeholder                                            | Assumption                                                   | Rationale                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Google Cloud region                                    | `us-central1`                                                | Default for most GCP services, low latency to US users, well-documented. Can move later if data residency requires it. |
| Identity provider (M4+)                                | Google Identity Platform (or Firebase Auth)                  | Already in the GCP ecosystem, integrates with Cloud IAM, minimal new vendor.                                           |
| Retention for change snapshots and approval records    | 12 months (per 02-DETAILED-SPECIFICATION 16 ASSUMPTION)      | Already documented as an assumption pending legal review. Flag for M4 legal review.                                    |
| Hosting overrun behavior (`hosting_overrun` in config) | `<alert_only>`                                               | Hosting cannot be switched off like a provider call. Alerting is the only practical v1 response.                       |
| Anonymous sub-budget                                   | USD 30 of the paid-call budget reserved for anonymous audits | Prevents anonymous traffic from consuming the entire budget before registered users get service.                       |
| Reduced/preview per-audit caps                         | reduced: USD 1.50, preview: USD 0.50                         | Proportional to the tier scope. `rich` keeps the full USD 4.00 hard cap.                                               |

Each assumption is recorded in two places: the config file where it applies, and `release.md` as an open item flagged for review.

No assumption blocks a proof. If an assumption turns out to be wrong, the proof still validates the contract logic; only the specific value changes.

## 7. Exit gate execution

### File structure

```
scripts/
  proofs/
    run_all.py
    proof_1_reproduce_score.py
    proof_2_reject_invalid.py
    proof_3_trace_lineage.py
    proof_4_deny_unauthorized.py
    proof_5_cost_hard_stop.py
    fixtures/
      proof_1/
      proof_2/
      proof_3/
      proof_4/
      proof_5/
```

### Runner output

Each proof script loads its fixtures, validates against schemas using `jsonschema` (Python, draft 2020-12), runs the proof logic, and prints PASS or FAIL with a one-line reason. Exit 0 on pass, 1 on fail.

The runner collects results:

```
Proof 1: Reproduce score ............ PASS
Proof 2: Reject invalid record ...... PASS
Proof 3: Trace report number ........ PASS
Proof 4: Deny unauthorized .......... PASS
Proof 5: Simulate USD 150 hard stop . PASS

5/5 passed. Exit gate: OPEN.
```

### pnpm script

Add to `package.json`:

```json
"proofs": "python3 scripts/proofs/run_all.py"
```

### Release documentation

`intent/INT-01-m0b-contracts-threat-model-cost-proof/release.md` contains:

1. Exit-gate table: each of the 5 proofs, the command to run it, the fixture it uses, and pass/fail status.
2. Schema changes log: every schema fix made during proof building, with the reason (which proof required it).
3. Governance doc changes: every doc update, linked to the proof that triggered it.
4. Open assumptions: the table from Section 6, flagged for review.
5. Reviewer sign-off: Ibrahim as independent reviewer, with the timestamp of the passing run.

### M0B exit criteria

The milestone is complete when:

1. `pnpm proofs` passes 5/5
2. `pnpm lint` passes
3. `pnpm typecheck` passes
4. `pnpm test` passes
5. `pnpm format:check` passes
6. `release.md` documents all of the above with actual output
