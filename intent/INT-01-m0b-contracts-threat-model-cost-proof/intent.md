# Intent: M0B contracts, threat model and cost proof

Status: draft for review.

| Field | Value |
| --- | --- |
| ID | INT-01 |
| Status | draft |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Security engineer | <DECIDE_AT_M0: name> |
| Milestone | M0B (05-PROJECT-PLAN §11) |
| Ticket | <tracker ID, or "none"> |
| Created | 2026-09-30 |
| Depends on | INT-00 (M0A exit gate passed) |
| Risk class | high-risk: defines authorization, anonymous access, write approvals, cost limits and rule weights |

## Problem

The contracts and governance documents exist as drafts: schemas in `schemas/`, state tables in `docs/state-machines.md`, and `docs/threat-model.md`, `docs/iam-matrix.md`, `docs/cost-model.md`, `docs/retention-deletion-map.md` and related files. Nobody has yet shown that they hold together: that an independent reviewer can reproduce a score, see an invalid record rejected, trace a report number to its evidence, watch an unauthorized export or write being denied, and see spending stop at the cap. Building M1 on untested contracts would spread errors into every later milestone.

## Proposed outcome

From 05-PROJECT-PLAN §11 (M0B), complete and reviewed:

- full JSON Schemas (draft 2020-12) for the contracts in 03-PRODUCTION-CONTRACTS "Minimum schema set", with required fields, enums, formats, limits, `additionalProperties` policy, version and upgrade behavior;
- state machines with actor, preconditions, authorization, idempotency key, retries, timeout, compensating action, audit event and terminal behavior (03 "Workflow states");
- the source, fidelity and lineage model, and evidence immutability;
- the anonymous-access abuse model (D-002) and the connector approval model;
- the project and IAM matrix, and the egress design for the crawler;
- budget math and circuit breakers for the combined USD 150 cap (D-005, D-007);
- the retention and deletion map (D-002, D-003);
- test fixtures for each item above.

The mandatory artifacts before M1 in 04-CLAUDE-CODE-BUILD-PROMPT §24 are all present.

## Affected users and systems

Product owner, SEO lead (methodology), security engineer, data engineer, AI engineer, integration engineer, privacy counsel. Future services: crawler, rules engine, report, cost guard, connector.

## Constraints

- D-002 anonymous reports: in-app only, no downloads, private link plus signed secret, `noindex`, deletable, 7-day expiry.
- D-003 registered evidence retention 30 days by default. D-004 `User → Project → Site`; claims never prove domain ownership.
- D-005 one combined USD 150 monthly cap (hosting plus paid calls, tracked as separate lines); D-007 per-audit soft USD 3.00 and hard USD 4.00 and the breaker settings are ASSUMPTIONS.
- D-012 Presence Readiness and Experience Effectiveness stay separate and are never blended with observed AI visibility or search performance.
- Vocabulary from the canonical lists (fidelity labels, integrity states, evidence states, rule results, risk tiers, audit tiers).
- Rule categories and weights from v1-baseline §6.2 (crawlability 20, on_page 15, structured_data 10, aeo 20, geo 15, i18n_accessibility 10, performance_security 10); any weight change bumps `methodology_version` (`.claude/hooks/methodology_bump.py`).
- Policy skills that apply: `security-baseline`, `data-integrity`, `cost-guard`, `connector-safety`, `google-search-guidance`.
- No application runtime yet: proofs may use scripts, fixtures and schema validation, not deployed services. The cost proof at M0B is the modelled Stage 1 in `docs/cost-model.md` §7 (D-019); the measured Stage 2 runs after M1 and M6, before public anonymous traffic.

## Out of scope

Crawler implementation (M1), deployed infrastructure, real provider calls, real connectors.

## Exit gate

From 05-PROJECT-PLAN §11: independent reviews can

1. reproduce one score;
2. reject one invalid record;
3. trace one report number;
4. deny one unauthorized export or write;
5. simulate the USD 150 hard stop.

Each proof is recorded in this intent's `release.md` with the command, fixture and reviewer.

## Open questions

- D-005: is USD 150 one combined cap for hosting and paid calls? Owner: product owner with the cloud billing owner.
- When hosting alone approaches the cap, what does the cost guard do, given that hosting cannot be switched off like a provider call? Owner: product owner and AI engineer.
- Who are the independent reviewers for each proof, and are they separate from the authors? Owner: product owner.
- Methodology sign-off on the starting weights, critical caps (including the proposed SPAM-001 cap of 50) and rule applicability. Owner: SEO lead.
- Google Cloud region and data residency (`<DECIDE_AT_M0: region>`), which affect the IAM matrix and egress design. Owner: product owner.
- Identity provider for the later `User → Project → Site` model. Owner: product owner and security engineer.
- Retention for change snapshots and approval records (02-DETAILED-SPECIFICATION §16 has a 12-month ASSUMPTION pending legal review). Owner: privacy counsel.
- Whether the connector approval model is designed generically now, since the first connector is still open (D-011). Owner: integration engineer.
