# Intent: <short title>

<!--
Template. Copy to intent/<ID>-<kebab-slug>/intent.md. Write the problem in the
originator's own words. Keep it short: an intent says what and why, not how.
Artifact chain (05-PROJECT-PLAN section 1):
intent.md -> spec.md -> plan.md -> code/tests/evals -> review -> release.md -> lessons -> new intent
-->

| Field | Value |
| --- | --- |
| ID | INT-<nn> |
| Status | draft |
| Author (originator) | <name and role> |
| Product owner | <DECIDE_AT_M0: name> |
| Milestone | <M0A, M0B, M1, ...> |
| Ticket | <tracker ID, or "none"> |
| Created | <YYYY-MM-DD> |
| Risk class | <standard, or high-risk: connector write paths, auth, tenant isolation, SSRF, cost guard, rule weights, production infrastructure> |

Status values: `draft`, `accepted`, `rejected`, `superseded`. The product owner accepts an intent by merging it or by recording acceptance in the pull request. Claude Code never sets `accepted`.

## Problem

<What is wrong or missing today, for whom, and how we know. Link evidence: tickets, lessons/, audit findings, metrics.>

## Proposed outcome

<What is true when this is done, in observable terms. No implementation detail.>

## Affected users and systems

<Users, roles and services touched. Name the owning service for each.>

## Constraints

<Decisions (D-xxx), spec sections (docs/spec/...), policy skills that apply, budget, data classes, deadlines. Cite repository paths, e.g. "02-DETAILED-SPECIFICATION §7".>

## Out of scope

<What this intent will not do.>

## Exit gate

<The check that proves the outcome, taken from the milestone plan where one exists (05-PROJECT-PLAN).>

## Open questions

<Questions that block the spec, each with the person who can answer it.>

## Links

- Spec: `intent/<ID>-<slug>/spec.md` (after acceptance)
- Plan: `intent/<ID>-<slug>/plan.md` (after spec approval)
- Release: `intent/<ID>-<slug>/release.md` (after merge)
