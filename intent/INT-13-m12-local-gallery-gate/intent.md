# Intent: M12 local gallery gate

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-13 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M12 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-04 |
| Drafted from | Ibrahim, 2026-10-04. The first slice is only a local check. It refuses placing an anonymous report in a public gallery when consent is missing. There is no public page and no public link. Product spend stays `0.00` USD. Use `intent/INT-13-m12-local-gallery-gate/intent.md`. INT-16 stays the §14 label. |
| Text accepted | Ibrahim, 2026-10-04, by the message "I accept this INT-13 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `b56291b`, which merges pull request 12 and includes the local M11 project gate. That fact does not finish the later M11 exit and does not authorize a further merge. |
| Risk class | standard for this slice. A public page, a public link, and publication are high-risk. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Only the product owner sets `accepted`. This session does not.

## Problem

An anonymous report can be placed in a public gallery when consent is missing. The product rules already say an anonymous report stays private, noindex, and in-app, and that it is not placed in a public gallery without explicit consent. Nobody has yet shown that refusal in a local check, with no public page and no spend.

## Proposed outcome

A local check, with no public page and no public link, shows all of these:

- Placing an anonymous report in a public gallery is refused when consent is missing.
- There is no public page and no public link.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opus` at xhigh in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The privacy owner and the product owner. No service is deployed. No public page is published. No public link is created.

## Constraints

- An anonymous report is an in-app web report only. It stays private, noindex, and deletable, and it is not placed in a public gallery without explicit consent (D-002). This slice checks that refusal locally.
- `security-baseline` 0.1.0: an anonymous report uses an unguessable link, stays noindex, and denies export server-side. This slice does not change noindex and does not create a link.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.17: the gallery is disabled by default and needs an explicit opt-in. Search, filters, a leaderboard, benchmarks, redaction, and removal stay later.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.18: tones stay later. Tone does not change evidence, scores, severity, or priority.
- `docs/spec/05-PROJECT-PLAN.md` §5 M12: the exit is no private-data leak, proven consent and removal, and tone invariance. This slice is the local gate only.
- `docs/test-strategy.md` §5: the M12 row is TS-GALLERY and TS-TONE. Those full suites are not this slice.
- `pnpm test:e2e` stays recorded as not run. There is no screen.
- `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-16 as M12. Ibrahim named this file `intent/INT-13-m12-local-gallery-gate/intent.md` on 2026-10-04. INT-16 stays that table's label. This stage does not edit that table.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, or M11. Starting M8A, M8B, M8C, or M13. Merging any pull request.
- The later M11 exit: invitations, agency roles, a live workspace, and a bulk schedule.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- A public page, a public link, a noindex change, a gallery, search, filters, a leaderboard, benchmarks, redaction, removal, revocation, and the six tones.
- A write-class tool in `config/agents/*.yaml`.
- A live fetch, a client-site change, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when an anonymous report would be placed in a public gallery and consent is missing.

The later M12 exit, removal, and tone invariance are not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a public gallery.

- Whether a missing consent and an empty consent are both no consent. Owner: product owner. This blocks the spec, not this draft.
- Public-gallery eligibility, retention, moderation, and removal (`docs/spec/01-PRODUCT-REQUIREMENTS.md` §14). Owner: privacy owner.
- Who the privacy owner and the product owner are. The names remain `<DECIDE_AT_M0: name>` (OI-002).

## Links

- Spec: `intent/INT-13-m12-local-gallery-gate/spec.md` (after acceptance)
- Plan: `intent/INT-13-m12-local-gallery-gate/plan.md` (after spec approval)
- Release: `intent/INT-13-m12-local-gallery-gate/release.md` (after implementation)
