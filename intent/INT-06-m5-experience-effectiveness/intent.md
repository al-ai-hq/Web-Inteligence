# Intent: M5 Experience Effectiveness

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-06 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M5 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01, by the message "so we need to strat m5". This draft proposes the same kind of first slice as M2 and M4: a local check only. There is no screen and no calibration. Product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-01, by the message "I accept this INT-06 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `8389469`, which merges pull request 5 and includes the local M4 source-separation check. That fact does not finish the later M4 exit and does not authorize a further merge. |
| Risk class | standard for this slice. Setting rubric or rule weights is high-risk. This slice does not. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01. This session does not set `accepted`.

## Problem

Presence Readiness is a deterministic score. Experience Effectiveness is a reviewed score. A later screen can add them together, or store a reviewer's judgment as if the crawler had measured it. The product rules already say the two scores stay apart, and a subjective result stays distinguishable from a deterministic finding. Nobody has yet shown that, in a local check, an Experience Effectiveness result stays apart from Presence Readiness and stays labelled as a review rather than a measurement.

## Proposed outcome

A local check, with no screen and no weight change, shows all of these:

- An Experience Effectiveness result stays apart from Presence Readiness. Adding one to the other is refused. Neither is blended with observed AI visibility or with search performance.
- A subjective rubric result stays distinguishable from a deterministic finding.
- Product spend stays `0.00` USD. There is no live page review and no form submission.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

The methodology owner and the UX/conversion reviewer. No service is deployed. No page is fetched for this check.

## Constraints

- D-012: Experience Effectiveness stays separate from Presence Readiness, observed AI visibility, and search performance. This slice does not blend them.
- D-009: do not call Google Autocomplete or scrape search-result pages. Do not import `.claude/skills/marketing-seo-agent/scripts`.
- D-020: record the model the session shows.
- `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.3: Experience Effectiveness is a separate score and confidence. It is never merged into readiness.
- `docs/rubrics/experience-effectiveness.md`: the rubric is draft, not calibrated, and no weight is fixed. A judgment is `assessed` / `inferred`. A deterministic sub-check is `observed` or `computed` / `verified`. The reviewer sees a captured evidence package. There is no live browsing during review.
- `docs/spec/02-DETAILED-SPECIFICATION.md` §19: the product never submits forms, creates accounts, orders, or books anything.
- Criterion weights and dimension weights stay `<DECIDE_AT_M5>`. This slice does not set them.
- `pnpm test:e2e` stays recorded as not run. There is no screen.

## Out of scope

- Reopening M0A, M0B, M1, M2, M3, or M4. Starting M6. Merging any pull request.
- The later M4 exit: expected-value formulas, and a claim that does not grant domain or connector authority.
- Closing OI-021. The secrets job fails because organization `al-ai-hq` has no `GITLEAKS_LICENSE`.
- Rubric agreement, calibration, and fixed weights.
- Separate score screens, comparison views, and regulated-context tone restrictions.
- A live crawl, a live review, form submission, and a client-site fetch.
- Deploy, Terraform apply, a live provider call, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one refusal when an Experience Effectiveness result is merged into Presence Readiness;
2. one case where a subjective rubric result stays distinguishable from a deterministic finding.

The later M5 exit, rubric agreement and calibration reviewed, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block calibration and a screen.

- Criterion weights and dimension weights (`<DECIDE_AT_M5>` in `docs/rubrics/experience-effectiveness.md`). Owner: methodology owner. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Screenshot viewport sizes (`<DECIDE_AT_M5>`). Owner: methodology owner.
- Arabic judgments during calibration. Owner: Arabic editorial owner.

## Links

- Spec: `intent/INT-06-m5-experience-effectiveness/spec.md` (after acceptance)
- Plan: `intent/INT-06-m5-experience-effectiveness/plan.md` (after spec approval)
- Release: `intent/INT-06-m5-experience-effectiveness/release.md` (after implementation)
