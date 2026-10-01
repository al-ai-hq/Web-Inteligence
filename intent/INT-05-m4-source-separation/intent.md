# Intent: M4 source separation

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-05 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M4 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01. He confirmed the first slice is only a local check: it refuses to add a Search Console number to a GA4 number, and it keeps a missing optional source distinct from zero. There is no account and no claim flow. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-01, by the message "I accept this INT-05 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `73d1d4d`, which merges pull request 4 and includes M0A through the local M3 anonymous-export check. That fact does not reopen those milestones and does not authorize a further merge. |
| Risk class | standard for this slice. A later slice that registers a user, claims an anonymous audit, or connects Search Console or GA4 is high-risk. This slice does not. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01. This session does not set `accepted`.

## Problem

Search Console and GA4 measure different things. A later screen can add Search Console clicks to GA4 sessions and present the sum as one performance number. A missing optional source can also be stored as zero, so an absent connection looks like a measured empty result. The metric rules already say numbers from different sources are never added, and a missing value is not zero. Nobody has yet shown, in a local check, that a Search Console number stays apart from a GA4 number and that a missing optional source stays distinct from zero.

## Proposed outcome

A local check, with no account and no claim flow, shows all of these:

- A Search Console number and a GA4 number stay in separate totals. Adding one to the other is refused.
- A missing optional source is not shown as zero.
- Product spend stays `0.00` USD. There is no Search Console connection, no GA4 connection, and no live query.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The data engineer and the SEO lead. No service is deployed. No Google account is connected.

## Constraints

- D-004: claiming an anonymous audit never proves domain ownership. This slice has no claim flow.
- D-009: do not call Google Autocomplete or scrape search-result pages. Do not import `.claude/skills/marketing-seo-agent/scripts`.
- D-012: search performance stays apart from Presence Readiness, Experience Effectiveness, and observed AI visibility. This slice does not fold either source into a readiness score.
- D-014: a stored metric still belongs to its project. This slice does not add a new identity model.
- D-020: record the model the session shows.
- Data-integrity skill: aggregate only the same source. `not_supplied` is not `measured_zero`. A blank or missing value is unknown, never 0.
- Do not compute a CTR from the Search Console generative-AI export. That export has impressions only.
- `pnpm test:e2e` stays recorded as not run. There is no screen.

## Out of scope

- Reopening M0A, M0B, M1, M2, or M3. Starting M5. Merging any pull request.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`. That is not a secret in the diff.
- Registration, domain verification, anonymous-audit claiming, and connector ownership.
- Keyword uploads, Arabic normalization, clusters, cannibalization, striking distance, and golden files.
- CTR from totals, impression-weighted position, rate changes in percentage points, time zones, and the incomplete recent Search Console days. Those stay in the later expected-value catalogue (`docs/test-strategy.md` §6.3).
- A live Search Console or GA4 connection, OAuth, and a client-site fetch.
- Deploy, Terraform apply, a live provider call, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when a Search Console number is added to a GA4 number;
2. one case where a missing optional source stays distinct from zero.

The later M4 exit, expected-value formulas and a claim that does not grant domain or connector authority, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a later connection or a claim flow.

- Launch sequencing for public anonymous traffic (OI-005). Owner: product owner. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Arabic query normalization. Owner: methodology owner.
- The claim flow, and the proof that a claim does not grant domain or connector authority (D-004). Owner: security engineer and tech lead.

## Links

- Spec: `intent/INT-05-m4-source-separation/spec.md` (after acceptance)
- Plan: `intent/INT-05-m4-source-separation/plan.md` (after spec approval)
- Release: `intent/INT-05-m4-source-separation/release.md` (after implementation)
