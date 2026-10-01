# Runbook: connector mismatch

Status: draft for review
Owner role: Connector owner (integration engineer)
Sources: 01-PRODUCT-REQUIREMENTS §5.13, §8 (Changes), §15; 03-PRODUCTION-CONTRACTS (change workflow, change risk baseline); 04-CLAUDE-CODE-BUILD-PROMPT §15; 07-SKILLS-AND-AGENTS §6; 09-MERGE-DECISIONS (automatic rollback adaptation); 02-DETAILED-SPECIFICATION §10; docs/rollback-plan.md §6
Last updated: 2026-09-30

## Trigger

A change enters `MISMATCH`, `PARTIAL`, `ROLLBACK_REQUESTED` or `HUMAN_REVIEW`; read-back or public
validation fails; a conflict is detected; or the verifier requests rollback.

## Steps

1. **Pause.** Stop further operations for this change set and this site. If several sites show
   the same failure, set `connector_<id>_writes_enabled` off.
2. **Collect.** Snapshot value and hash; approved after-value and hash; the live value from a
   fresh connector read; the public page from a fresh crawl; connector logs with idempotency
   keys and platform responses.
3. **Classify.**

   | Case | What it means | Action |
   |---|---|---|
   | Not applied | The write failed | No rollback. Retry only with the same idempotency key and an unexpired approval, if the plan allows |
   | Partially applied | Some operations in a batch succeeded | Handle each operation on its own |
   | Transformed by the platform | Applied, but the platform changed it (sanitizing, truncating, encoding) | No automatic rollback. Human review; update the connector capability record |
   | Changed by someone else | The live value differs from what we applied and from the snapshot | Conflict. Never overwrite. Human review with the site owner |
   | Not yet public | Stored in the CMS but the public page differs (draft, cache, template binding) | No rollback. Check publish state and caches; keep "live on site" separate from "seen by Google" (02 §10) |
   | Wrong value applied | Our change was wrong | Roll back under `docs/rollback-plan.md` §6 |

4. **Decide.** Automatic rollback only when all five conditions in `docs/rollback-plan.md` §6
   hold. Otherwise the approver decides. Tier 3 always needs a human decision.
5. **Roll back.** Through the connector only: new idempotency key; confirm the live value still
   equals the value we applied; write the snapshot value; read back; validate the public page.
6. **Notify** the approver and the requester. Record the final state (`VERIFIED`, `ROLLED_BACK`
   or `HUMAN_REVIEW`) and link it in the impact ledger.
7. **Follow up.** If the connector behaved unexpectedly, open an incident when severity criteria
   apply, add a connector contract test, and update the capability record.

## Verification

- The live value equals the snapshot (rolled back) or the approved value (verified), confirmed by
  a fresh read and a fresh public fetch.
- The change record shows every step with actor, time and idempotency key.

## Never

- Overwrite a value someone else changed.
- Retry a write without its original idempotency key.
- Publish to fix a mismatch; publish is a separate permission.
- Touch fields or pages outside the approved change set.
- Roll back a Tier 3 change without a human decision.
- Delete content.
