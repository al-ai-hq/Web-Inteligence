# Intent: M7 public footprint

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-08 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M7 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01, by the message "Start M7. Write the INT-08 intent." This draft proposes the same kind of first slice as M5 and M6: a local check only. There is no live public-source fetch and no correction is applied. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-01, by the message "I accept this INT-08 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `c01dbd4`, which merges pull request 7 and includes the local M6 AI visibility check. That fact does not finish the later M6 exit and does not authorize a further merge. |
| Risk class | standard for this slice. A live public-source fetch is SSRF-adjacent, and applying a correction is a connector write. This slice does not add those. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01. This session does not set `accepted`.

## Problem

A public footprint fact can be shown with no source, a missing review count can be filled in with a number, and a correction can be stored as if it had already been applied. The product rules already say sources and confidence stay visible, reviews and counts are not fabricated, and a correction stays governed. Nobody has yet shown that, in a local check, with no live fetch and no write.

## Proposed outcome

A local check, with no live fetch and no screen, shows all of these:

- A public fact shows its source and a confidence label. A fact with no source is refused.
- A missing review count is not stored as a number. That includes `0`.
- A correction stays unapplied. Storing it as applied is refused.
- Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The methodology owner. No service is deployed. No public page is fetched. No connector writes.

## Constraints

- D-009: do not call Google Autocomplete or scrape search-result pages. Do not import `.claude/skills/marketing-seo-agent/scripts`. This slice does not fetch a profile, a listing, or a review page.
- D-016: a correction is not applied unless the governed conditions hold. This slice does not apply one.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.9: reviews and public proof do not fabricate sentiment or counts. A correction opportunity is not itself a write.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.10: a correction workflow stays evidence-linked. This slice does not edit the fact registry.
- `docs/spec/02-DETAILED-SPECIFICATION.md` §10: a change is applied only by the connector, after approval. Fabricated reviews, ratings, and claims are forbidden.
- `docs/spec/02-DETAILED-SPECIFICATION.md` §13: no fabricated reviews, ratings, testimonials, prices, availability, credentials, or claims.
- `docs/test-strategy.md` §5: the M7 evidence is no fabricated reviews or counts, with sources and confidence visible.
- `pnpm test:e2e` stays recorded as not run. There is no screen.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, M4, M5, or M6. Starting M8. Merging any pull request.
- The later M6 exit: a live provider gateway and the full observation catalogue.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- Approved public-source discovery, the entity graph, the brand fact registry, hallucination monitoring, and earned-evidence recommendations.
- A live fetch, a review-site scrape, a connector write, and a client-site change.
- Deploy, Terraform apply, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one public fact whose source and confidence label are visible, and one refusal when the source is missing;
2. one refusal when a missing review count is stored as a number, including `0`;
3. one refusal when a correction is stored as applied.

The later M7 exit, approved discovery and a governed correction workflow in the product, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block live discovery and a correction workflow.

- Which public sources are approved for discovery. Owner: product owner. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Which review and listing platforms are in scope. Owner: methodology owner.
- Arabic name transliteration during fact consistency. Owner: Arabic editorial owner.

## Links

- Spec: `intent/INT-08-m7-public-footprint/spec.md` (after acceptance)
- Plan: `intent/INT-08-m7-public-footprint/plan.md` (after spec approval)
- Release: `intent/INT-08-m7-public-footprint/release.md` (after implementation)
