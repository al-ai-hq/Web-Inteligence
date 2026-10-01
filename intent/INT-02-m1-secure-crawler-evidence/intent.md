# Intent: M1 secure crawler and evidence capture

Status: draft.

| Field | Value |
| --- | --- |
| ID | INT-02 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Security engineer | <DECIDE_AT_M0: name> |
| Milestone | M1 (05-PROJECT-PLAN §5) |
| Ticket | none |
| Created | 2026-10-01 |
| Drafted from | Ibrahim, 2026-10-01, by the message "b", read as the review recommendation "accept with amendments". |
| Text accepted | Ibrahim, 2026-10-01, by the message "The reading of \"b\" is right. I accept this INT-02 text." The status word stays `draft` because that message also says not to set `accepted`. |
| Depends on | INT-01 local record, commit `a36d305`. On 2026-10-01, `origin/main` was still `96c0daa` and pull request 1 was open, so that commit was not on `main`. That fact does not reopen M0A or M0B. |
| Risk class | high-risk: SSRF, crawler isolation, evidence capture |

Status values: `draft`, `accepted`, `rejected`, `superseded`. Ibrahim accepted this text on 2026-10-01. This session does not set `accepted`.

## Problem

The product has no crawler. `pnpm test:ssrf` is a placeholder that prints that the suite is not run and then exits 0. The M0A and M0B release records both say that command is not run. Treating that exit code as a passed SSRF suite would hide the M1 exit. A later milestone that fetches a submitted URL, follows a redirect, or stores a page without this gate can reach an internal or metadata address, or can present a sample as a full-site count.

## Proposed outcome

A local, independent check shows all four of these:

- the SSRF suite passes, and the current placeholder is no longer the suite;
- no internal or metadata address is reachable through a submitted URL, a redirect, a sitemap entry, or a discovered link;
- the crawler path cannot read secrets or the application database, and it holds no write tool;
- a representative crawl is disclosed as a sample and is not a full-site count.

The check uses fixtures on this machine. It does not crawl the public web. Product spend stays `0.00` USD.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `fable` at max in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020). This draft was written in a session that showed Grok 4.7.

## Affected users and systems

Security engineer, tech lead, and the future crawl sandbox. No service is deployed in this intent. Evidence, when captured, belongs to a project (D-014).

## Constraints

- D-002: anonymous evidence stays in-app. No anonymous export. Retention is 7 days maximum.
- D-008: the later crawl runtime is an isolated job. This intent does not create that project.
- D-009: only the product crawler fetches. Do not import `.claude/skills/marketing-seo-agent/scripts`. The skill fetcher may seed expected results only. No Google Autocomplete and no search-result scraping.
- D-014: every stored evidence record is scoped to its project.
- D-019: measured cost on staging is after M1 and M6. This intent does not run that measurement.
- D-020: record the model the session shows.
- Security baseline: allow only `http` and `https`; reject credentials in URLs; reject private, loopback, link-local, metadata, and the other non-public ranges; re-check every redirect. Metadata names are blocked by name (02 §17; `docs/threat-model.md` AC-09 and AC-10).
- `docs/test-strategy.md` §6.1 is the suite catalogue for the local validator run. The staging network run in that section is not this exit.
- Port allowlist 80 and 443, and a representative cap of 20 pages, stay assumptions (`docs/threat-model.md` AC-09; 02 §5). OI-053 is not decided here.
- `methodology_version` stays `0.1.0-draft`. This intent does not change rule weights.

## Out of scope

- Reopening M0A or M0B. Starting M2. Scoring, reports, keywords, and connectors.
- Deploy, `terraform apply`, a live provider call, a client site, production credentials, and product spend.
- A Google Cloud crawl project, an egress firewall, and the staging network run. Those wait on region and project ids (OI-010).
- The Playwright render worker and `pnpm test:e2e`. Renderer blocking is a later M1 slice. Browser journeys stay the M3 placeholder.
- Region, identity provider, first connector, hosting overrun, the combined-cap question, and the anonymous-backup conflict (OI-010, OI-011, OI-012, OI-001, OI-031, OI-036).

## Exit gate

From 05-PROJECT-PLAN §5, shown locally:

1. an independent SSRF suite passes;
2. no internal or metadata address is reachable;
3. secrets and databases are inaccessible to the crawler;
4. samples are disclosed as samples.

`pnpm test:ssrf` counts only after it runs that suite. Until then it stays recorded as not run. `pnpm test:e2e` stays recorded as not run.

## Open questions

These stay open. They do not block this draft. They block numeric limits and any deployed sandbox in a later spec.

- Crawl-limit numbers beyond the existing assumptions (OI-053). Owner: security engineer and tech lead. Names remain `<DECIDE_AT_M0: name>` (OI-002).
- Whether a later M1 intent adds the Playwright render worker before or after OI-010. Owner: security engineer.
- Product domain for the crawler info URL (OI-014). Owner: product owner.

## Links

- Spec: `intent/INT-02-m1-secure-crawler-evidence/spec.md` (after acceptance)
- Plan: `intent/INT-02-m1-secure-crawler-evidence/plan.md` (after spec approval)
- Release: `intent/INT-02-m1-secure-crawler-evidence/release.md` (after implementation)
