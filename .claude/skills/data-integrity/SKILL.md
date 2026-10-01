---
name: data-integrity
description: Keeps every stored or reported number tied to its source, fidelity label, integrity state and lineage. Use when adding, storing, aggregating, scoring, charting or reporting evidence, rule results, keyword data, Search Console data, AI observations or costs.
---

# Data integrity (policy skill)

Status: draft for review. Version 0.1.0. Owner: data engineer `<DECIDE_AT_M0: name>`. The owner signs off every change to this skill.

## When to use

- New tables, schemas, importers, adapters or API readers.
- Any calculation: scores, CTR, position, rates, deltas, costs.
- Report, chart, export or agent output that shows a number or a finding.

## Every value carries its lineage

Required fields (03-PRODUCTION-CONTRACTS "Evidence and fidelity"): `record_id, project_id, site_id, source_type, source_id, source_version, captured_at, as_of, market, language, device, method, methodology_version, fidelity_label, content_hash, parent_ids, validation_state`.

- IDs are UUID strings; times are RFC 3339 UTC; period dates are ISO 8601; markets ISO 3166-1 alpha-2 or `global`; languages BCP 47; money is a decimal string plus ISO 4217 currency.
- Evidence is immutable. A re-fetch creates a new version with its own content hash (02-DETAILED-SPECIFICATION §15).
- Schemas live in `schemas/` (JSON Schema draft 2020-12) and are validated by `scripts/check_schemas.py`.

## Vocabulary (use exactly)

| Field | Values |
| --- | --- |
| `fidelity_label` | `observed`, `computed`, `assessed`, `attested`, `user_supplied`, `estimated`, `unavailable` |
| `integrity_state` | `not_supplied`, `supplied_invalid`, `missing_field`, `measured_zero`, `filter_empty`, `valid`, `stale`, `error`, `not_applicable` |
| `evidence_state` (user-facing) | `verified`, `inferred`, `client_stated`, `estimated`, `not_verified`, `unavailable` |
| `rule_result` | `pass` (1.00), `partial` (0.50), `fail` (0.00), `not_applicable`, `unavailable`, `error` |

Mapping: observed and computed → `verified`; assessed → `inferred`; attested and user_supplied → `client_stated`; estimated → `estimated`; unavailable → `unavailable`; a check that could not complete → `not_verified`. Keep the original label; the mapping never erases it (01-PRODUCT-REQUIREMENTS §16).

## Missing is not zero

- Keep integrity states apart: `not_supplied` is not `measured_zero`, and `filter_empty` is not `error` (03).
- `not_applicable`, `unavailable` and `error` rule results leave the score denominator (02 §6). Every score shows "checked X of Y".
- An open circuit breaker or a skipped provider reports `unavailable`, never 0% (02 §18; v1-baseline §11.4).
- A keyword row with volume but no `volume_source` or `volume_period` stores volume as unknown; blank volume means unknown, never 0. Reports show "Not available (needs export)" and name the export (02 §7).
- A sample is not full coverage: disclose sampling and never present a sample count as a site-wide count (04 §2; 01 §8 "Crawling").

## Aggregation rules

From 02 §15 "Controls", 04 §9 and the skill's `references/performance-reporting.md`:

- Aggregate only the same units, periods, markets and sources. Never add Search Console clicks, GA4 sessions, provider observations and business outcomes together.
- CTR is computed from totals, never averaged across rows. Average position is weighted by impressions and labelled as an average.
- Rate changes are percentage points; count changes are percent; a zero base shows as "new".
- Compared periods have equal length. Search Console dates are Pacific Time; GA4 uses the property time zone; the latest 2-3 days of Search Console data are flagged incomplete.
- Annotate calendar effects (Ramadan, the two Eids, national days, Friday-Saturday weekends) before attributing a change to SEO.
- Never compute a CTR from the Search Console generative AI export (impressions only). GA4 AI-assistant referrals are a lower bound, not a visibility measure.
- No figure mixes keyword sources or markets (02 §19).

## Scores stay separate

Presence Readiness (0-100, deterministic, 7 categories) and Experience Effectiveness (separate, reviewed) are never blended with each other or with observed AI visibility or search performance (D-012). Readiness never supports a claim of presence in AI answers.

## Gates (enforce in code, not only in prompts)

From 02 §15 and §19:

- A report publishes only when 100% of its numbers carry lineage and a report tag, and headline numbers recompute from saved files.
- Every model claim maps to an evidence ID or fact ID; otherwise it is stripped and logged.
- Nightly recomputation of scores from stored rule results; a mismatch freezes the report and alerts.
- Charts: real data, source and period, one measure, at most 4 series, no dual axis.
- `estimated` or `user_supplied` data alone cannot justify a Tier 3 change.
- Entity conflicts (fact sheet vs site vs profile) are findings, never auto-resolved.
- Freshness limits come from `config/freshness.yaml`; stale data is marked and excluded from new plans.
- Cost ledger reconciles monthly with the Cloud Billing export (see the `cost-guard` skill).

## Checklist for a change

1. Does every new stored value have the lineage fields and a `fidelity_label`?
2. Are missing, zero, filtered-empty and not-applicable kept apart?
3. Is any rate averaged, any position unweighted, or any figure summed across sources, markets or periods?
4. Does a report or chart path enforce the 100% lineage gate?
5. Add expected-value fixtures for new formulas (01 §12) and list concerns in `spec.md`.

## Backed by

- `schemas/**` and `scripts/check_schemas.py`; `docs/state-machines.md`.
- Golden files in `evals/golden/` (Arabic normalization, cannibalization, report rendering).
- Product-agent evals for fabricated metrics and unavailable-as-zero regressions (`evals/product-agent/`).
