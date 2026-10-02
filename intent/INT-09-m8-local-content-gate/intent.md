# Intent: M8 local content gate

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-09 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M8 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01. The first slice is a local check with three refusals. A claim with no source is refused. A new page is refused when the cannibalization result is missing. A missing cannibalization result is not stored as a pass. A page stored as published is refused. There is no CMS draft, no client pull request, and no automatic publishing. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-02, by the message "I accept this INT-09 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `5dc6646`, which merges pull request 8 and includes the local M7 public-footprint check. That fact does not finish the later M7 exit and does not authorize a further merge. |
| Risk class | standard for this slice. A CMS draft, a client pull request, and automatic publishing are connector writes. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Only the product owner sets `accepted`. This session does not.

## Problem

A content claim can be stored with no source. A new page can be stored before anyone has checked whether it cannibalizes an existing page, and a missing cannibalization result can be stored as a pass. A page can be stored as published. The product rules already say a claim needs a source, a cannibalization check comes before a new page, and nothing is published automatically. Nobody has yet shown those three refusals in a local check, with no CMS write and no spend.

## Proposed outcome

A local check, with no CMS draft and no screen, shows all of these:

- A claim with no source is refused.
- A new page is refused when the cannibalization result is missing. That missing result is not stored as a pass.
- A page stored as published is refused.
- There is no client pull request and no automatic publishing.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The content approver and the methodology owner. No service is deployed. No page is written. No CMS is called.

## Constraints

- D-009: do not call Google Autocomplete or scrape search-result pages. Do not import `.claude/skills/marketing-seo-agent/scripts`. The cannibalization gate is not a copy of `cannibalization.py`.
- D-012: Presence Readiness, Experience Effectiveness, observed AI visibility, and search performance stay apart. This slice does not blend a content claim into those scores.
- D-016: a change is not applied unless the governed conditions hold. This slice does not publish.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.11: content work is existing-page-first. This slice does not write a brief, a draft, or schema.
- `docs/spec/02-DETAILED-SPECIFICATION.md` §8 and §10: cannibalization is checked before a new page and before a title or H1 change. Fabricated claims are forbidden.
- `docs/spec/05-PROJECT-PLAN.md` §5 M8: the exit includes fabricated-claim checks, a cannibalization check before a new page, and no automatic publishing. This slice is the local gate only.
- `docs/test-strategy.md` §5: M8 evidence includes fabricated claims rejected and cannibalization checks before new pages.
- `pnpm test:e2e` stays recorded as not run. There is no screen.
- Do not score `llms.txt`, require FAQ blocks, or promise rich results.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, M5, M6, or M7. Starting M9, M8A, M8B, or M8C. Merging any pull request.
- The later M7 exit: approved public-source discovery, the entity graph, and a live correction workflow.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- Briefs, bilingual outlines, drafts, metadata, internal links, comparisons, direct answers, schema build or validation, fact manifests, regulated-claim flags, and Arabic editorial review.
- A CMS draft, a client-repository pull request, a connector write, and automatic publishing.
- A live fetch, a client-site change, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when a claim has no source;
2. one refusal when a new page is stored while the cannibalization result is missing, and that missing result is not stored as a pass;
3. one refusal when a page is stored as published.

The later M8 exit, citation evals, schema work, and an approval workflow, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block briefs, schema, and publishing.

- Who the content approver is. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Which schema types the later studio may emit. Owner: methodology owner.
- Arabic editorial review for drafts. Owner: Arabic editorial owner.

## Links

- Spec: `intent/INT-09-m8-local-content-gate/spec.md` (after acceptance)
- Plan: `intent/INT-09-m8-local-content-gate/plan.md` (after spec approval)
- Release: `intent/INT-09-m8-local-content-gate/release.md` (after implementation)
