# Runbook: rollback

Status: draft for review
Owner role: Release manager (the incident commander during an incident)
Sources: 03-PRODUCTION-CONTRACTS (release evidence); 04-CLAUDE-CODE-BUILD-PROMPT §22; 05-PROJECT-PLAN M13; 02-DETAILED-SPECIFICATION §15; v1-baseline §10; docs/rollback-plan.md
Last updated: 2026-09-30

## Trigger

Any of: a post-deploy metric outside its band; a failed smoke check; the nightly integrity job
finds wrong or unlineaged numbers; a security defect introduced by a release; a cost anomaly after
a release. For client-site changes use `docs/runbooks/connector-mismatch.md` instead.

## Steps

1. Declare the rollback in the release or incident channel. Freeze further deploys.
2. If users are being harmed now, first flip the matching kill switch (`docs/rollback-plan.md` §7).
3. Classify what to roll back:

   | Type | Action |
   |---|---|
   | Service revision | Shift 100% of traffic to the previous revision |
   | Job | Reset the job to the previous image digest |
   | Configuration | Redeploy the previous config version |
   | Methodology | Redeploy the previous methodology version (affects new audits only) |
   | Migration | Run the tested down script if the change is reversible; otherwise apply the forward fix |
   | Data (last resort) | Point-in-time restore with the incident commander and privacy owner, then re-apply the deletion queue before serving |
   | Infrastructure | Revert the Terraform commit; plan; apply through the pipeline |

4. Run the smoke checks from `docs/runbooks/deploy.md` step 9 against the restored state.
5. Watch metrics until they return to their bands.
6. Keep the failed revision and its logs for analysis; do not delete them.
7. Record the timeline, what was rolled back, how long it took and the evidence.
8. Open a `lessons/` entry and a new intent. Add a regression test or eval case.

## Verification

- Previous version serves 100% of traffic, or the forward fix is live.
- Smoke checks pass; the integrity job reports no unlineaged numbers.
- After any restore: the deletion-queue re-apply completed and records past `expires_at` count zero.

## Never

- Edit production data or evidence by hand.
- Restore a backup without re-applying the deletion queue.
- Relabel stored scores with another methodology version.
- Delete the failed revision before the analysis is done.
- Roll back client-site changes from this runbook.
