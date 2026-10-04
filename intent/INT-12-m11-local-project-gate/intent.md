# Intent: M11 local project gate

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-12 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M11 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-04 |
| Drafted from | Ibrahim, 2026-10-04. The first slice is only a local check. It refuses a read of project B while the caller is in project A. There is no invitation, no live workspace, and no bulk schedule. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-04, by the message "I accept this INT-12 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `fd23f59`, which merges pull request 11 and includes the local M10 monitor gate. That fact does not finish the later M10 exit and does not authorize a further merge. |
| Risk class | standard for this slice. An organization, an invitation, a live workspace, and a bulk schedule are high-risk. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Only the product owner sets `accepted`. This session does not.

## Problem

A caller in project A can be shown a record that belongs to project B. The product rules already say every record belongs to one project and a query for one project must not return another project's record. Nobody has yet shown that refusal in a local check, with no invitation and no spend.

## Proposed outcome

A local check, with no live workspace and no screen, shows all of these:

- A read of project B is refused while the caller is in project A.
- There is no invitation and no bulk schedule.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `fable` at xhigh in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The security engineer and the tech lead. No service is deployed. No organization is created. No invitation is sent. No bulk schedule runs.

## Constraints

- Until this agency work, every record belongs to one project. A query for one project must not return another project's record (D-014). This slice checks that rule locally.
- D-004: identity starts as `User → Project → Site`. Organizations, invitations, and advanced roles arrive with the later agency work. Claiming an anonymous audit does not prove domain ownership. This slice does not send an invitation.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.16: the agency workspace includes roles, portfolios, bulk schedules, and client review links. Those stay later.
- `docs/spec/05-PROJECT-PLAN.md` §5 M11: the exit is that cross-tenant tests pass and bulk work stays budgeted and scoped. This slice is the local gate only.
- `docs/test-strategy.md` §5: the M11 row is the cross-tenant authorization test and budgeted bulk work. Bulk work is not this slice.
- `pnpm test:e2e` stays recorded as not run. There is no screen.
- `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-15 as M11. Ibrahim named this file `intent/INT-12-m11-local-project-gate/intent.md` on 2026-10-04. This stage does not edit that table.
- This slice does not add `organization_id`.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, M5, M6, M8, M9, or M10. Starting M8A, M8B, M8C, or M12. Merging any pull request.
- The later M10 exit: a running schedule, evidence-linked material alerts, deletion, and cost breakers.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- An organization, an invitation, an agency role, a live workspace, a portfolio, a bulk schedule, a branded report, a client review link, a template, an evidence export, and an audit log.
- `organization_id`.
- A write-class tool in `config/agents/*.yaml`.
- A live fetch, a client-site change, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when a caller in project A reads a record that belongs to project B.

The later M11 exit, invitations, and bulk schedules are not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a live workspace.

- Which agency roles exist. The names remain `<DECIDE_AT_M0: name>` for the owners (OI-002).
- How a bulk schedule stays inside the budget. Owner: cloud billing owner.
- Who the security engineer and the tech lead are. The names remain `<DECIDE_AT_M0: name>` (OI-002).

## Links

- Spec: `intent/INT-12-m11-local-project-gate/spec.md` (after acceptance)
- Plan: `intent/INT-12-m11-local-project-gate/plan.md` (after spec approval)
- Release: `intent/INT-12-m11-local-project-gate/release.md` (after implementation)
