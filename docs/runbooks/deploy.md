# Runbook: deploy

Status: draft for review
Owner role: Release manager
Sources: 03-PRODUCTION-CONTRACTS (release evidence); 04-CLAUDE-CODE-BUILD-PROMPT §22, §24; 05-PROJECT-PLAN §8, M13; docs/environments.md §5; docs/test-strategy.md §4; docs/rollback-plan.md
Last updated: 2026-09-30

## Trigger

A release candidate has passed staging and a production release is requested.

## Preconditions

- Merge gate and release gate green on the release commit (`docs/test-strategy.md` §4).
- Manual accessibility and Arabic sign-offs recorded for changed user-facing surfaces.
- Rollback rehearsed on this release candidate in staging (`docs/rollback-plan.md` §9).
- Release evidence drafted: artifact versions, migrations, changed files, commands, tests and
  evals, unresolved risks, security/privacy/cost review, accessibility/Arabic evidence, rollback
  steps, monitoring, approver (03-PRODUCTION-CONTRACTS).

## Steps

1. Record the release: commit SHA, image digests, config version, methodology version, migration list.
2. Name the rollback target: previous revision and digest per service and job, previous config version.
3. Check that migrations in this release are expand-only, or have an approved forward-fix plan
   (`docs/rollback-plan.md` §4).
4. Check the budget state is not in hard stop and the release does not raise fixed hosting
   (minimum instances, database tier) without a cost review (`docs/cost-model.md`).
5. Check that new high-risk features are behind flags that default to off (05 §8). Turning a flag
   on is a separate, later change.
6. Release manager authorizes the release in the pipeline. The author of the change, human or
   agent, cannot authorize it.
7. Pipeline runs the migrations under the migrator identity and verifies them.
8. Pipeline deploys new revisions with a small traffic share (ASSUMPTION: canary first).
9. Smoke checks in production: health endpoints; one anonymous audit of a WPI-owned test site
   (ASSUMPTION: a site we control, `<DECIDE_AT_M0B>`); `noindex` present; an anonymous export
   request is denied; the log canary does not appear in logs.
10. Shift traffic to 100% in steps. Watch the monitoring window (ASSUMPTION: 30 minutes,
    `<DECIDE_AT_M0B>`): 5xx rate, latency, audit failure rate, cost per audit, breaker openings.
11. Record release time, approver, results and post-release verification in the release evidence.

## Verification

- All traffic on the new revisions; metrics within their normal bands.
- Smoke checks passed and recorded.
- Previous revisions still available for rollback.

## If something is wrong

Stop the traffic shift and follow `docs/runbooks/rollback.md`.

## Never

- Deploy from a workstation, or apply production Terraform outside the pipeline.
- Approve your own change, or let an agent approve a release.
- Ship a release without release evidence or without a named rollback target.
- Turn on a high-risk flag in the same step as the code deploy.
- Ship a contract (destructive) migration together with the code that stops using the old column.
- Use bypass-permissions modes or production credentials in a Claude Code session.
