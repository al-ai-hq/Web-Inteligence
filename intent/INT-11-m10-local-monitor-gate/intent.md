# Intent: M10 local monitor gate

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-11 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M10 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-04 |
| Drafted from | Ibrahim, 2026-10-04. The first slice is only a local check. It refuses a schedule which adds a write or a new target, and it keeps an unchanged run from raising an alert. Product spend stays `0.00` USD. There is no scheduler, no crawl, and no deletion. |
| Text accepted | Ibrahim, 2026-10-04, by the message "I accept this INT-11 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `f926be7`, which merges pull request 10 and includes the local M9 write gate. That fact does not finish the later M9 exit and does not authorize a further merge. |
| Risk class | standard for this slice. A schedule that runs, a crawl, a deletion, and a cost breaker are high-risk. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Only the product owner sets `accepted`. This session does not.

## Problem

A schedule can be stored so that it adds a write or a new target. An unchanged run can be stored as an alert. The product rules already say a schedule cannot widen its scope or cross a write gate, and an unchanged run stays quiet. Nobody has yet shown those two results in a local check, with no scheduler and no spend.

## Proposed outcome

A local check, with no scheduler and no screen, shows all of these:

- A schedule which adds a write is refused.
- A schedule which adds a new target is refused.
- An unchanged run does not raise an alert.
- There is no crawl and no deletion.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The service owner and the cloud billing owner. No service is deployed. No schedule runs. No site is crawled. No data is deleted.

## Constraints

- A schedule cannot widen its scope or cross a write gate. An unchanged run stays quiet. A material alert needs evidence. This slice does not run a schedule.
- D-005: the USD 150 monthly cap stays one combined cap. This slice does not spend and does not raise a budget.
- D-016: automatic rollback only under the governed conditions. This slice does not roll back a live change.
- D-019: the measured cost proof is stage 2. This slice does not run it.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.15: monitoring includes a quiet unchanged state. Scheduled crawls and deletion stay later.
- `docs/spec/05-PROJECT-PLAN.md` §5 M10: the exit includes schedules that cannot broaden scope or cross write gates, evidence-linked material alerts, and working deletion and cost breakers. This slice is the local gate only.
- `docs/test-strategy.md` §5: the M10 monitor row includes a quiet unchanged state and schedules that cannot broaden scope. Deletion, restore, and cost breakers are not this slice.
- `pnpm test:e2e` stays recorded as not run. There is no screen.
- `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-14 as M10. Ibrahim named this file `intent/INT-11-m10-local-monitor-gate/intent.md` on 2026-10-04. This stage does not edit that table.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, M5, M6, M8, or M9. Starting M8A, M8B, M8C, or M11. Merging any pull request.
- The later M9 exit: a connector, the staging scenarios, and the impact ledger.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- A schedule that runs, a crawl, a data refresh, retention deletion, a restore, a cost breaker, and a connector.
- Evidence linkage for a material alert, and incident-to-intent feedback.
- A write-class tool in `config/agents/*.yaml`.
- A live fetch, a client-site change, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when a schedule adds a write;
2. one refusal when a schedule adds a new target;
3. one unchanged run that does not raise an alert.

The later M10 exit, deletion, and the cost breakers are not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a running schedule.

- Whether a quiet run is stored as no alert, rather than as an alert count of `0`. Owner: data engineer.
- What counts as a material change. Owner: service owner.
- Who the service owner and the cloud billing owner are. The names remain `<DECIDE_AT_M0: name>` (OI-002).

## Links

- Spec: `intent/INT-11-m10-local-monitor-gate/spec.md` (after acceptance)
- Plan: `intent/INT-11-m10-local-monitor-gate/plan.md` (after spec approval)
- Release: `intent/INT-11-m10-local-monitor-gate/release.md` (after implementation)
