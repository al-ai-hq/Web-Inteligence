# Intent: M9 local write gate

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-10 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M9 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-03 |
| Drafted from | Ibrahim, 2026-10-03. The first slice is a local gate only. A write with no approval is refused. Publication is refused when the change is only a draft. There is no CMS write, no client pull request, and no staging run. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-03, by the message "I accept this INT-10 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `e12afd7`, which merges pull request 9 and includes the local M8 content gate. That fact does not finish the later M8 exit and does not authorize a further merge. |
| Risk class | standard for this slice. A CMS write, a client pull request, and a staging connector run are high-risk. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Only the product owner sets `accepted`. This session does not.

## Problem

A change can be stored as a write when nobody has approved it. A change that is only a draft can be stored as published. The product rules already say only the connector service writes, a write needs an approval bound to the target, and publication is a separate permission. Nobody has yet shown those two refusals in a local check, with no CMS write and no spend.

## Proposed outcome

A local check, with no CMS write and no screen, shows all of these:

- A write with no approval is refused.
- Publication is refused when the change is only a draft.
- There is no client pull request and no staging run.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `fable` at max in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The integration engineer and the tech lead. No service is deployed. No page is written. No CMS is called. No client repository is opened.

## Constraints

- Only the connector service writes. A write needs an approval bound to the target. Publication is a separate permission. This slice does not write.
- D-009: do not call Google Autocomplete or scrape search-result pages. Do not import `.claude/skills/marketing-seo-agent/scripts`.
- D-014: every stored record stays scoped to its project. This slice does not add a cross-project read.
- D-016: automatic rollback only under the governed conditions. This slice does not roll back a live change.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.13 and §5.14: the correction center keeps edit and publish apart. The impact ledger is later.
- `docs/spec/05-PROJECT-PLAN.md` §5 M9: the exit includes one connector, bound approvals, rollback, a separate publication permission, an impact ledger, and the staging scenarios. This slice is the local gate only.
- `docs/test-strategy.md` §5: the M9 rows cover approval binding and the connector contract. Those staging scenarios are not this slice.
- `schemas/change-set.schema.json`: publish is a separate permission. This slice does not edit that schema.
- `pnpm test:e2e` stays recorded as not run. There is no screen.
- `docs/spec/05-PROJECT-PLAN.md` §14 lists INT-10 as M8A and INT-13 as M9. Ibrahim named this file `intent/INT-10-m9-local-write-gate/intent.md` on 2026-10-03. This stage does not edit that table.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, M5, M6, or M8. Starting M8A, M8B, M8C, or M10. Merging any pull request.
- The later M8 exit: citation evals, schema work, and an approval workflow for content.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- Choosing the first Git or CMS connector (D-011).
- Exact live IDs, snapshots, hashes, canary, idempotency, read-back, public validation, rollback, webhooks, and the impact ledger.
- A CMS write, a client-repository pull request, a staging run, and a connector credential.
- A write-class tool in `config/agents/*.yaml`.
- A live fetch, a client-site change, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when a write has no approval;
2. one refusal when publication is stored for a change that is only a draft.

The later M9 exit, the staging scenarios, and the impact ledger are not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a real connector.

- Which connector is first, Git or CMS. The choice remains `<DECIDE_AT_M0: first connector>` (D-011).
- Who the integration engineer and the tech lead are. The names remain `<DECIDE_AT_M0: name>` (OI-002).
- How the impact ledger links a finding to a later outcome. Owner: data engineer.

## Links

- Spec: `intent/INT-10-m9-local-write-gate/spec.md` (after acceptance)
- Plan: `intent/INT-10-m9-local-write-gate/plan.md` (after spec approval)
- Release: `intent/INT-10-m9-local-write-gate/release.md` (after implementation)
