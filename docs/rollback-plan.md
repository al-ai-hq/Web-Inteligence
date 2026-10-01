# Rollback plan

Status: draft for review
Owner role: Release manager
Sources: 01-PRODUCT-REQUIREMENTS §5.13, §8 (Changes), §15; 03-PRODUCTION-CONTRACTS (change workflow states, change risk baseline, release evidence); 04-CLAUDE-CODE-BUILD-PROMPT §15, §22, §24; 05-PROJECT-PLAN M0, M9, M13, §8; 09-MERGE-DECISIONS (automatic rollback adaptation); 02-DETAILED-SPECIFICATION §10, §15, §19; v1-baseline §10, §18 Phase 7; docs/decisions.md D-007, D-010
Last updated: 2026-09-30

## 1. Scope

Two kinds of rollback exist and must never be confused:

1. **Platform rollback**: our own code, database, configuration, methodology and infrastructure.
2. **Client-site rollback**: reverting a change the connector made on a client's CMS or
   repository (M9+). This is a write to a client system and follows the approval rules.

Every release names its rollback target before it ships (03-PRODUCTION-CONTRACTS release
evidence). A release without a tested rollback path does not ship.

## 2. Summary

| What | Mechanism | Who decides | Target time | Rehearsed |
|---|---|---|---|---|
| Web/API and other Cloud Run services | Shift traffic to the previous revision | Release manager or incident commander | ASSUMPTION: minutes | Weekly in staging (ASSUMPTION) |
| Cloud Run Jobs (crawl, render, deletion, processing) | Point the job at the previous image digest | Same | Minutes | Weekly |
| Feature behavior | Kill-switch flag (§6) | Same | Minutes | Weekly |
| Configuration (eligibility, providers, caps, freshness) | Redeploy the previous config version | Config owner with release manager | Minutes | Weekly |
| Methodology (rules, weights, caps) | Redeploy the previous methodology version; never relabel stored scores | Methodology owner | One release | Per methodology change |
| Database schema | Expand/contract migrations; down migration if safe; otherwise forward fix | Engineering lead | Per migration plan | On a staging copy before each prod migration |
| Database data (last resort) | Point-in-time restore plus deletion-queue re-apply | Incident commander with privacy owner | Hours | Monthly restore drill (ASSUMPTION) |
| Infrastructure | Revert the Terraform commit and apply through the pipeline | Cloud platform owner | One pipeline run | Per infrastructure change in staging |
| Client-site change (M9+) | Connector rollback from the stored snapshot (§5) | Per risk tier | Per tier | In sandbox for every connector |

## 3. Application and jobs

- Images are built once and deployed by digest. Every production deploy keeps the previous
  revision available.
- Deploys use gradual traffic shifts. ASSUMPTION: a small canary share first, then full traffic
  after the post-deploy checks in `docs/runbooks/deploy.md`.
- Rollback is one command in the pipeline tooling: shift 100% of traffic to the previous
  revision, or reset a job to the previous digest. It must not need a rebuild.
- If the new revision wrote data in a new format, the previous revision must still read it. This
  is why schema changes follow §4.

## 4. Database migrations

Policy: expand, migrate, contract.

1. **Expand**: add tables, columns or indexes in a backward-compatible way. The previous app
   revision must keep working against the expanded schema.
2. **Migrate**: backfill data in idempotent, resumable batches.
3. **Contract**: drop old columns or tables only in a later release, after the new code has run
   in production for an agreed period (ASSUMPTION: at least one full release cycle).

Rules:

- Each migration has a down script when the change is reversible, and CI runs up, down and up
  again on a copy.
- Destructive steps (drop, type narrowing, data rewrite) have no automatic down path. They need a
  forward-fix plan, an on-demand backup taken immediately before, and engineering-lead approval.
- Prefer forward fix for data problems: write a corrective migration rather than restore.
- Evidence records are immutable; a correction creates a new version (02 §15). Never "fix"
  evidence in place.
- Point-in-time restore is the last resort. After any restore, re-apply the deletion queue before
  the database serves traffic, so deleted data does not return (v1-baseline §10, TS-DR).
- Migrations run from the pipeline under the migrator identity (`docs/iam-matrix.md` §5), never
  from a workstation against production.

## 5. Configuration and methodology versions

- Config files carry source, checked date and owner (D-010). A config release is versioned and
  can be redeployed at its previous version without a code release.
- Rule weights and caps change only with a methodology version bump (enforced by a hook, Builder
  D). Every stored score keeps the methodology version that produced it. Rolling back
  methodology affects new audits only; stored scores are never recomputed or relabelled silently.
  A recomputation under a different version is a new, labelled result.
- Provider and model changes (IDs, prices, routing) roll back by redeploying the previous
  `config/providers.yaml` version. In-flight audits finish on the version they started with, or
  their affected sections are marked `unavailable`.
- Eligibility and cost config roll back the same way. When in doubt, the safer state is the more
  restrictive one (lower tiers, lower caps).

## 6. Connector changes on client sites (M9+)

Sources: 03-PRODUCTION-CONTRACTS change workflow and risk tiers, 04 §15, 09-MERGE-DECISIONS
(automatic rollback adaptation), 02 §10.

Before any write, the connector stores a snapshot and hash of the current value. After the write
it reads the value back and runs public validation.

Automatic rollback is allowed only when all of these hold (01 §15, "adapted rather than copied"):

1. the approval explicitly authorized automatic rollback;
2. the rollback target matches the stored snapshot;
3. the connector supports atomic or reliable reversal for that field;
4. deterministic read-back detects an exact mismatch;
5. the change is Tier 1 or Tier 2.

Otherwise the change moves to `HUMAN_REVIEW`. Tier 3 changes roll back only on a human decision
(02 §4, §10 apply the same conditions).

Rollback is itself a write:

- it uses its own idempotency key and is recorded as a `Rollback` record;
- before writing, the connector compares the live value with the value it applied; if someone
  else has changed the field since, it does not overwrite and moves to `HUMAN_REVIEW`
  (`docs/runbooks/connector-mismatch.md`);
- it reads back after the rollback and records the result;
- it never publishes as a side effect; publish is a separate permission;
- a slug change rolls back together with its redirect and internal-link changes, as one unit.

Before M11, 02 §17 states (ASSUMPTION) that Tier 3 changes cannot be approved until a project
has a second approver; how approvers are assigned before M11 is open
(`<DECIDE_AT_M0: approver assignment before M11>`). ASSUMPTION: when Tier 3 changes become
possible, they are delivered as pull requests or staging changes, so their rollback is a revert
of that pull request.

## 7. Kill switches

Flag names are proposals. The authoritative list and defaults live in configuration (`config/`, owner: config owner); no flag file exists yet.
High-risk modules default to off (05 §8). Flipping a flag is audit-logged with who, when and why.

| Flag (proposed) | Effect when off |
|---|---|
| `anonymous_intake_enabled` | New anonymous audits show the capacity message (`refused`) |
| `anonymous_rich_tier_enabled` | First audits run as `reduced` |
| `paid_calls_enabled` (global) and `provider_<id>_enabled` | No paid calls, or none to that provider; sections `unavailable` |
| `render_job_enabled` | HTML-only crawling; rendered checks `unavailable` |
| `evidence_reuse_enabled` | Every audit crawls fresh |
| `registered_exports_enabled` | Exports unavailable for everyone (anonymous exports are always denied regardless) |
| `connector_writes_enabled` (global) and `connector_<id>_writes_enabled` | No client-site writes; drafts and previews only |
| `publish_enabled` | No publish actions, even with approval |
| `scheduled_automations_enabled` | Schedules pause; retention deletion is exempt and keeps running |
| `public_gallery_enabled` | Gallery hidden; publications withdrawn from view |
| `agent_<name>_enabled` | That agent's steps are skipped and marked `unavailable` |

Retention and deletion jobs have no kill switch in normal operation. Pausing them needs the
privacy owner's approval and a recorded reason.

## 8. Infrastructure

- All infrastructure changes go through Terraform in the pipeline (02 §12). Rollback is a revert
  commit, a reviewed plan and an apply.
- Terraform state is versioned; restore it only with the cloud platform owner.
- Break-glass console changes during an incident are reconciled into Terraform within one working
  day (ASSUMPTION).

## 9. Rehearsal cadence

| Rehearsal | Where | Cadence |
|---|---|---|
| App revision rollback, job digest rollback, kill-switch flip and restore | Staging | ASSUMPTION: weekly |
| Config and methodology version rollback | Staging | ASSUMPTION: weekly, with the app rehearsal |
| Migration up/down/up on a copy | CI and staging | Every migration |
| Point-in-time restore with deletion-queue re-apply | Isolated staging instance | ASSUMPTION: monthly, and before M13 |
| Connector rollback, including conflict and partial failure | Vendor sandbox | Every connector change; before each connector release |
| Full release rollback on the release candidate | Staging | Before every production release |

05 M0 exit needs one harmless change to complete the full chain including rollback; 01 §15 needs
a rollback rehearsal for release. Record each rehearsal (date, what, result, time taken) in the
release evidence.

## 10. Never

- Never roll back by editing production data or evidence by hand.
- Never restore a backup without re-applying the deletion queue.
- Never relabel stored scores with a different methodology version.
- Never roll back a client-site change over a value someone else has since changed.
- Never publish as part of a rollback.
- Never delete the previous revision or image before the new release has passed its monitoring window.
