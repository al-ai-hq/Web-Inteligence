# Spec: <short title>

<!--
Template. Save as intent/<ID>-<slug>/spec.md next to its accepted intent.
Written in the Design stage after the product owner accepts the intent.
Apply the policy skills in .claude/skills/ and state every area of concern,
especially where two policies cannot both be satisfied.
-->

| Field | Value |
| --- | --- |
| Intent | `intent/<ID>-<slug>/intent.md` (status: accepted) |
| Status | draft |
| Author | <name, or "Claude Code session <id>"> |
| Product owner sign-off | <name, date, or "pending"> |
| Policy owner sign-offs | <owner: skill, date> for each flagged concern |
| Spec prompt version | <path or hash of the prompt used> |
| Skill versions | <skill name and version for each skill applied, including marketing-seo-agent> |
| Source sections read | <docs/spec/... sections> |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

<Three to five sentences: what will be built and why.>

## Requirements

### Functional

<Numbered, testable requirements. Each cites its source section.>

### Non-functional

<Security, privacy, performance, cost, accessibility, localization, retention. Cite sources.>

## Design

### Components and boundaries

<Services, modules and data flow. Mark trust boundaries (untrusted content, write paths).>

### Data contracts

<Schemas added or changed in schemas/, with $id and version. Fields keep lineage and fidelity labels.>

### State transitions

<States, actor, preconditions, idempotency key, retries, timeout, compensating action, audit event (03-PRODUCTION-CONTRACTS "Workflow states").>

### Configuration

<config/ files added or changed. No hard-coded model IDs, prices, quotas or crawler tokens (D-010).>

### UI (if any)

<Screens in Arabic and English. Link the approved mocks.>

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | | | |
| security-baseline | | | |
| arabic-rtl-a11y | | | |
| data-integrity | | | |
| cost-guard | | | |
| connector-safety | | | |

## Areas of concern

<Every conflict between policies or sources, every assumption that changes behavior, every item the named owner must decide. The product owner works through these first, with the policy owner.>

## Test and eval plan

<Unit, integration, browser, SSRF, authorization, injection, golden-file and product-agent eval cases. Name fixtures.>

## Rollout and rollback

<Feature flags (default off for high-risk modules), environments, rollback method, monitoring signal.>

## Cost

<Paid calls and hosting added, against the combined USD 150 monthly cap (D-005).>

## Assumptions and open items

<Each ASSUMPTION on its own line. Items to copy into docs/assumptions.md and docs/open-items.md.>
