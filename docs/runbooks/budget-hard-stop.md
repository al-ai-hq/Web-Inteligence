# Runbook: budget hard stop

Status: draft for review
Owner role: Cloud billing owner
Sources: 01-PRODUCT-REQUIREMENTS §5.19, §9, §14; 04-CLAUDE-CODE-BUILD-PROMPT §19; 05-PROJECT-PLAN M0B; 02-DETAILED-SPECIFICATION §15, §18; v1-baseline §11.4; docs/decisions.md D-005, D-007; docs/cost-model.md; docs/anonymous-eligibility-policy.md §6
Last updated: 2026-09-30

## Trigger

The cost guard reports "paid-call budget exhausted" or "hosting forecast at cap minus reserve";
a Billing budget alert at 100%; or reconciliation variance above 5% (ASSUMPTION, 02 §15).

## Automatic actions (verify they happened)

- Paid calls stopped at the provider gateway.
- AI sections show "unavailable: monthly limit", never 0%.
- Anonymous tiers downgraded as `docs/anonymous-eligibility-policy.md` §6 says.
- If the hosting forecast triggered: new anonymous intake closed with the capacity message.
- Nothing was stopped, deleted or unlinked from billing.

## Steps

1. Confirm the state in the cost-guard view. Start one test audit and check that the
   deterministic parts complete and AI sections are `unavailable`.
2. Reconcile the ledger with the Billing export and provider usage reports. Spend that bypassed
   the provider gateway is a SEV2 incident (`docs/runbooks/incident.md`).
3. Find the driver:
   - abuse: eligibility metrics, velocity, per-domain counts;
   - bug: retry loop, runaway job, missing cap check;
   - price change: compare the price table's checked date with the provider page;
   - hosting growth: minimum instances, database tier, log volume, non-production spend.
4. Contain the driver through normal reviewed changes: tighten eligibility config, block
   abusive sources at the edge, fix the bug, reduce hosting (scale down dev and staging, lower
   minimum instances, log exclusions).
5. Owner decides for the rest of the month, recorded in `docs/decisions.md`:
   stay stopped until the month resets; resume with reduced scope; or raise the cap. Raising the
   cap is an exception to the USD 150 budget and needs explicit owner approval (01 §14, D-005).
6. Communicate: product banner; registered users told which paid features are paused.
7. Month reset: the cost guard resets the budget state at the start of the billing month
   (`<DECIDE_AT_M0B: billing-month timezone>`). Confirm paid calls resume under daily pacing.
8. Record the event, driver and decision; write a `lessons/` entry if a control failed.

## Verification

- No paid call is recorded in the ledger after the stop time until an approved resume.
- Ledger and Billing export agree within the variance threshold after reconciliation.

## Never

- Raise the cap without a recorded owner decision.
- Unlink billing, delete resources or stop production services as a cost control.
- Pause retention or deletion jobs to save money.
- Show a stopped feature as a 0% or negative result, or hide the stop from users.
- Route calls around the provider gateway.
