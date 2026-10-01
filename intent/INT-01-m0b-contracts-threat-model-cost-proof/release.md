# M0B Release Notes

Date: 2026-10-01
Intent: INT-01
Status: PASS

## Exit Gate

| Proof | Command | Fixture | Status |
|-------|---------|---------|--------|
| 1. Reproduce score | `python3 -m scripts.proofs.proof_1_reproduce_score` | `scripts/proofs/fixtures/proof_1/` | PASS |
| 2. Reject invalid record | `python3 -m scripts.proofs.proof_2_reject_invalid` | `scripts/proofs/fixtures/proof_2/` | PASS |
| 3. Trace lineage | `python3 -m scripts.proofs.proof_3_trace_lineage` | `scripts/proofs/fixtures/proof_3/` | PASS |
| 4. Deny unauthorized | `python3 -m scripts.proofs.proof_4_deny_unauthorized` | `scripts/proofs/fixtures/proof_4/` | PASS |
| 5. Cost hard stop | `python3 -m scripts.proofs.proof_5_cost_hard_stop` | `scripts/proofs/fixtures/proof_5/` | PASS |

Runner: `pnpm proofs` -- 5/5 passed

## Schema Changes

None required -- all proofs passed against schemas as-is.

## Governance Doc Changes

None required.

## Open Assumptions

| Placeholder | Assumption | Review by |
|-------------|-----------|-----------|
| Google Cloud region | us-central1 | M4 |
| Identity provider | Google Identity Platform | M4 |
| Retention for change snapshots | 12 months | M4 legal |
| Hosting overrun | alert_only | M0 |
| Anonymous sub-budget | USD 30 | M1 |
| Reduced/preview per-audit caps | 1.50/0.50 | M1 |

## Verification

- `pnpm proofs`: 5/5 passed. Exit gate: OPEN.
  ```
  PASS: score reproduced — pre_cap=77.50, stored=77.5
  PASS: SSRF URL rejected, invalid fidelity_label rejected (1 schema error(s))
  PASS: all 2 report numbers trace to evidence
  PASS: anonymous export denied, self-approval detected and blocked
  PASS: cost guard blocked call — month_to_date 142.00 >= paid_calls_stop_at 140.00; projected 151.00 > monthly_cap 150.00; estimate 9.00 > per_audit_hard 4.00
  5/5 passed. Exit gate: OPEN.
  ```
- `pnpm lint`: pass (eslint . --max-warnings 0)
- `pnpm typecheck`: pass (tsc --build)
- `pnpm test`: pass (1/1 test — packages/test-utils/src/index.test.ts)
- `pnpm format:check`: fail (23 pre-existing files with formatting issues, none introduced by M0B)

## Reviewer

Ibrahim -- independent reviewer. Timestamp of passing run: 2026-10-01T12:15:58Z.
