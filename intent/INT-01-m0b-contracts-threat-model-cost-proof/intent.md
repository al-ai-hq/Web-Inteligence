# Intent: M0B contracts, threat model and cost proof

Status: accepted.

| Field | Value |
| --- | --- |
| ID | INT-01 |
| Status | accepted |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Security engineer | <DECIDE_AT_M0: name> |
| Milestone | M0B (05-PROJECT-PLAN §11) |
| Ticket | none |
| Created | 2026-09-30 |
| Amended | 2026-10-01. Ibrahim accepted the six amendments in the intent review: Cursor beside Claude Code; outcome bounded to the five proofs and the gaps they need; dependency on the closed M0A record; load tests, deletion demonstration and Stage 2 measurement stay out of this exit; Links added and ticket set to none; OI-001 does not block the Stage 1 proof. |
| Accepted | Ibrahim, 2026-10-01, by the message "I accept INT-01 with the six amendments in section 10". Product owner name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Depends on | INT-00 closed implementation record, commit `96c0daa` on `main`. OI-021 and the draft M0A `release.md` do not reopen M0A and do not block M0B. |
| Risk class | high-risk: defines authorization, anonymous access, write approvals, cost limits and rule weights |

## Problem

The contracts and governance documents exist as drafts: schemas in `schemas/`, state tables in `docs/state-machines.md`, and `docs/threat-model.md`, `docs/iam-matrix.md`, `docs/cost-model.md`, `docs/retention-deletion-map.md` and related files. Nobody has yet shown that they hold together: that an independent reviewer can reproduce a score, see an invalid record rejected, trace a report number to its evidence, watch an unauthorized export or write being denied, and see spending stop at the cap. Building M1 on untested contracts would spread errors into every later milestone.

## Proposed outcome

The existing drafts are the starting material. M0B proves the five exit checks and writes only the gaps those proofs need:

- parent-join rules for the schemas that have no `project_id` (D-014, OI-040);
- fixtures and a local check for one reproduced Presence Readiness score, one rejected invalid record, one traced report number, and one denied anonymous export;
- a modelled Stage 1 hard stop (D-019): synthetic ledger entries, an estimated hosting baseline labelled `estimated`, and a pre-call check that refuses the next paid call at the cap minus the reserve.

Region, identity provider, first connector, rule weights, hosting overrun, and the anonymous-backup conflict stay unchanged.

Cursor sessions run this milestone under `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source. `fable` at xhigh in `docs/spec/06-MODEL-PLAN.md` §3 is a Claude Code alias, not a Cursor picker value. The session records the model name it shows (D-020).

## Affected users and systems

Product owner, SEO lead (methodology), security engineer, data engineer, AI engineer, integration engineer, privacy counsel. Future services: crawler, rules engine, report, cost guard, connector. No service is deployed in this milestone.

## Constraints

- This milestone runs under `AGENTS.md` and `.cursor/`, with `.claude/` as the policy source (D-020). The model plan alias does not fail the milestone.
- D-002 anonymous reports: in-app only, no downloads, private link plus signed secret, `noindex`, deletable, 7-day expiry.
- D-003 registered evidence retention 30 days by default. D-004 `User → Project → Site`; claims never prove domain ownership.
- D-005 stays an assumption (OI-001). The Stage 1 proof uses the working reading: one combined USD 150 cap, with hosting and paid calls tracked as separate lines. OI-001 does not block that proof. The proof labels the cap unconfirmed.
- D-007 per-audit soft USD 3.00 and hard USD 4.00 and the breaker settings stay assumptions.
- D-012 Presence Readiness and Experience Effectiveness stay separate and are never blended with observed AI visibility or search performance.
- D-019: the M0B cost proof is modelled Stage 1 only. Measured cost on staging is after M1 and M6, before public anonymous traffic. Paid calls stop at the cap minus the reserve.
- Vocabulary from the canonical lists (fidelity labels, integrity states, evidence states, rule results, risk tiers, audit tiers).
- Rule categories and weights stay at v1-baseline §6.2 (crawlability 20, on_page 15, structured_data 10, aeo 20, geo 15, i18n_accessibility 10, performance_security 10). This milestone does not change them. A later weight change bumps `methodology_version`.
- Policy skills that apply: `security-baseline`, `data-integrity`, `cost-guard`, `connector-safety`, `google-search-guidance`.
- Proofs use scripts, fixtures and schema validation. There is no deployed service and no live provider call.
- Retry counts and timeouts in `docs/state-machines.md` stay assumptions. This milestone does not run load tests or cost calibration.
- The M0A toolchain (D-021) stays as closed. `pnpm test:ssrf` and `pnpm test:e2e` remain placeholders recorded as not run. They are not this exit.

## Out of scope

Crawler implementation (M1), deployed infrastructure, `terraform apply`, real provider calls, real connector writes, production credentials, and product spend.

Also out of scope: reopening M0A; changing the M0A toolchain; a deletion demonstration; resolving the backup-versus-7-day conflict (OI-036); choosing region, identity provider, or the first connector; changing weights or the SPAM-001 cap; deciding hosting overrun (OI-031); Stage 2 measured cost.

## Exit gate

From 05-PROJECT-PLAN §11: independent reviews can

1. reproduce one score;
2. reject one invalid record;
3. trace one report number;
4. deny one unauthorized export or write;
5. simulate the USD 150 hard stop.

Each proof is recorded in this intent's `release.md` with the command, fixture and reviewer. The reviewer is a person who did not author the fixture. Named owners stay open (OI-002).

Load tests, a deletion demonstration, and the measured Stage 2 cost proof are not part of this exit.

## Open questions

These stay open. None of them blocks the Stage 1 proof.

- D-005: is USD 150 one combined cap for hosting and paid calls? Owner: product owner with the cloud billing owner. The proof uses the combined-cap assumption and labels it unconfirmed (OI-001).
- When hosting alone approaches the cap, what does the cost guard do? Owner: product owner and cloud billing owner (OI-031). The hard-stop proof refuses the next paid call and does not stop hosting.
- Named reviewers and accountable owners (OI-002). Owner: product owner. Until names exist, independence means the reviewer did not author the fixture.
- Methodology sign-off on the starting weights, critical caps (including the proposed SPAM-001 cap of 50) and rule applicability. Owner: SEO lead. This milestone does not change them.
- Google Cloud region and data residency (`<DECIDE_AT_M0: region>`). Owner: product owner.
- Identity provider for the later `User → Project → Site` model. Owner: product owner and security engineer.
- Retention for change snapshots and approval records, and anonymous data in backups beyond 7 days (OI-036). Owner: privacy counsel. The conflict stays recorded.
- The first connector stays open (D-011). The approval model stays generic. Owner: integration engineer.

## Links

- Spec: `intent/INT-01-m0b-contracts-threat-model-cost-proof/spec.md` (after acceptance)
- Plan: `intent/INT-01-m0b-contracts-threat-model-cost-proof/plan.md` (after spec approval)
- Release: `intent/INT-01-m0b-contracts-threat-model-cost-proof/release.md` (after implementation)
