# Intent: M3 anonymous report access

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-04 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M3 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01. He confirmed the first slice is only a local check: an anonymous request for PDF, document, CSV, JSON, evidence, or a task export is denied, with no artifact and no signed URL; stored report access is private and noindex (`public_gallery` false and `noindex` true); there is no screen; product spend stays `0.00` USD. |
| Text accepted | Ibrahim, 2026-10-01, by the message "I accept this INT-04 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | `origin/main` at `d8d3e18`, which merges pull request 3 and includes M0A, M0B, the local M1 SSRF suite, and the local M2 Presence Readiness check. That fact does not reopen those milestones and does not authorize a further merge. |
| Risk class | standard for this slice. A later slice that serves a live anonymous link, a cookie, or a screen is high-risk. This slice does not. |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01. This session does not set `accepted`.

## Problem

M0B can deny one anonymous CSV export. That proof does not show that the other anonymous downloads are denied, and it does not show that the stored report is private and `noindex`. A later screen can still offer a PDF, a document, JSON, an evidence bundle, or a task export, or it can mark the report as public. `schemas/report-model.schema.json` already has `noindex` and `public_gallery`. Nobody has yet shown, in a local check, that every anonymous export in D-002 is denied with no artifact and that the stored access stays private and non-indexed.

## Proposed outcome

A local check, with no screen, shows all of these:

- An anonymous request for a PDF, a document, a CSV, JSON, an evidence export, or a task export is denied. The denial creates no artifact and no signed URL.
- The stored report access has `public_gallery` false and `noindex` true.
- Product spend stays `0.00` USD. There is no deploy and no public report link.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `opusplan` at high in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

Anonymous report readers, the privacy owner, and the security engineer. No service is deployed. `scripts/check_m0b_proofs.py` is not edited.

## Constraints

- D-002: anonymous reports stay in-app. PDF, document, CSV, JSON, evidence, and task downloads are denied server-side. The link is private and unguessable. `noindex` is required. The report is deletable and expires within 7 days. This slice does not build the link, the deletion path, or the expiry clock.
- D-012: Presence Readiness, Experience Effectiveness, AI visibility, and search performance stay separate. This slice has no headline screen.
- D-014: a stored report still belongs to its project through the lineage already required.
- D-020: record the model the session shows.
- `docs/test-strategy.md` §6.2: the full anonymous catalogue also covers expired secrets, deletion, log canaries, and a registered export that succeeds. Those cases are not this slice.
- `pnpm test:e2e` stays recorded as not run. There is no screen, so Arabic copy, RTL layout, and WCAG evidence are not produced.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Out of scope

- Reopening M0A, M0B, M1, or M2. Starting M4. Merging any pull request.
- Closing OI-021. The secrets job on pull request 3 failed because organization `al-ai-hq` has no `GITLEAKS_LICENSE`. That is not a secret in the diff.
- The bilingual in-app report, comparison views, the action board, the 30/60/90 roadmap, charts, and download controls.
- Eligibility tiers, expiry enforcement, deletion across stores, claim, cookies, and a registered export that is allowed to succeed (OI-039, OI-036, OI-056, A-032, A-033).
- Editing `scripts/check_m0b_proofs.py`, changing weights, or bumping `methodology_version`.
- Deploy, Terraform apply, a live provider call, a client-site fetch, and product spend.

## Exit gate

From 05-PROJECT-PLAN §5, this first slice shows locally:

1. one denial for each anonymous export format named above, with no artifact and no signed URL;
2. stored access with `public_gallery` false and `noindex` true.

The later M3 exit, a bilingual in-app report with comparison tests and Arabic accessibility evidence, is not this slice. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block a later screen or a live link.

- Launch sequencing for public anonymous traffic (OI-005, A-012). Owner: product owner. The name remains `<DECIDE_AT_M0: name>` (OI-002).
- Backup retention versus the 7-day anonymous limit (OI-036). Owner: counsel and privacy owner.
- Eligibility thresholds (OI-039). Owner: product owner and security engineer.
- Whether a site owner can delete someone else's anonymous audit, and whether links may be shared (OI-056). Owner: counsel and product owner.
- Screen-reader and browser matrix (`<DECIDE_AT_M3>` in `docs/test-strategy.md`). Owner: frontend lead.

## Links

- Spec: `intent/INT-04-m3-anonymous-report-access/spec.md` (after acceptance)
- Plan: `intent/INT-04-m3-anonymous-report-access/plan.md` (after spec approval)
- Release: `intent/INT-04-m3-anonymous-report-access/release.md` (after implementation)
