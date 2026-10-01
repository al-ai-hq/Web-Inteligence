# V4 Production Contracts

V5 adaptation status: draft for review. Every edit to the V4 text is listed in "Changes from V4" at the end.

These contracts govern this Claude Code build of Website Presence Intelligence. Implement them as JSON Schema draft 2020-12 plus strict application types. Names below are conceptual until M0 approves the repository naming convention.

The JSON Schemas live in `schemas/`, one file per contract (`schemas/<kebab-name>.schema.json`), and are validated by `scripts/check_schemas.py`. The transition tables for the workflow states below are in `docs/state-machines.md`.

## Evidence and fidelity

Every value that reaches a report, score, plan, or change requires:

`record_id, project_id, site_id, source_type, source_id, source_version, captured_at, as_of, market, language, device, method, methodology_version, fidelity_label, content_hash, parent_ids, validation_state`

Allowed fidelity labels:

- `observed`: directly fetched or returned by an approved source.
- `computed`: deterministically derived from compatible observed inputs.
- `assessed`: rubric/model judgment from cited evidence.
- `attested`: confirmed by an authorized client representative.
- `user_supplied`: uploaded or entered, not independently verified.
- `estimated`: modeled by an identified third party.
- `unavailable`: not measured in this run.

Map each fidelity label to one user-facing evidence state (`evidence_state`) for reports. The mapping never erases the stored fidelity label.

| `fidelity_label` | `evidence_state` |
| --- | --- |
| `observed`, `computed` | `verified` |
| `assessed` | `inferred` |
| `attested`, `user_supplied` | `client_stated` |
| `estimated` | `estimated` |
| `unavailable` | `unavailable` |
| A check that could not complete (no fidelity label applies) | `not_verified` |

Preserve separate integrity states: `not_supplied`, `supplied_invalid`, `missing_field`, `measured_zero`, `filter_empty`, `valid`, `stale`, `error`, `not_applicable`.

## Minimum schema set

- `CapabilityManifest`
- `Audit`, `AuditScope`, `JobStage`, `Attempt`
- `EvidenceObject`, `LineageRecord`, `PolicyFact`
- `RuleDefinition`, `RuleResult`, `ScoreResult`, `Finding`
- `KeywordRow`, `KeywordCluster`, `PageOwnership`, `RankSnapshot`
- `PromptSet`, `PromptRun`, `Citation`, `AccuracyIssue`
- `PerformanceObservation`, `PerformanceDiagnosis`
- `FactRegister`, `EntityConflict`, `PublicSourceObservation`
- `CommerceItem`, `FeedObservation`, `MerchantIssue`, `PolicyConsistencyResult`
- `Location`, `ProfileObservation`, `NAPObservation`, `ReviewCase`
- `PlatformCapability`, `ImplementationPath`
- `MigrationBaseline`, `URLInventoryRow`, `RedirectRule`, `ParityResult`, `GoNoGoItem`, `RollbackTrigger`
- `ContentOpportunity`, `ContentBrief`, `ContentDraft`
- `Recommendation`, `PlanItem`, `Roadmap`
- `ChangeSet`, `ChangeOperation`, `Approval`, `Snapshot`, `Verification`, `Rollback`
- `WebhookEvent`, `ConnectorCapability`, `ProviderBreaker`, `CostLedgerEntry`
- `ReportModel`, `ExportAuthorization`, `RetentionRecord`, `DeletionReceipt`
- `ArchitecturePlan`, `PageMapRow`, `InternalLinkPlanRow`, `SERPOverlapObservation`
- `BacklinkObservation`, `ReferringDomainObservation`, `LinkTargetStatus`, `DisavowCandidate`
- `ComparisonClaim`, `ComparisonSource`, `ComparisonReview`
- `ProgrammaticTemplate`, `ProgrammaticRecord`, `GenerationBatch`, `SimilarityObservation`, `BatchDecision`
- `CrawlSnapshot`, `CrawlDiff`, `DiffReview`, `RegressionDecision`

Every schema must set required fields, enums, formats, length/range limits, `additionalProperties` policy, version, and upgrade/migration behavior.

## Workflow states

Audit:

`QUEUED → VALIDATING → CRAWLING → EXTRACTING → AUDITING → ENRICHING_OPTIONAL → COMPOSING → READY_PARTIAL|READY_COMPLETE|FAILED|CANCELLED|EXPIRED`

Connected analysis may add:

`IMPORTING → KEYWORD_SYNC → PERFORMANCE_DIAGNOSIS → PROMPT_PANEL → PLANNING`

Content:

`OPPORTUNITY → BRIEF_DRAFT → BRIEF_REVIEW → BRIEF_APPROVED → DRAFTING → CONTENT_REVIEW → CMS_DRAFT|PR_CREATED → VALIDATED → PUBLISHED_BY_HUMAN|REJECTED`

Change:

`DRAFT → VALIDATED → PREVIEWED → AWAITING_APPROVAL → APPROVED → SNAPSHOTTING → APPLYING_CANARY → VERIFYING_CANARY → APPLYING → READ_BACK → PUBLIC_VALIDATION → VERIFIED|MISMATCH|PARTIAL|ROLLBACK_REQUESTED|ROLLED_BACK|HUMAN_REVIEW|REJECTED|EXPIRED`

Every transition specifies actor, preconditions, authorization, idempotency key, allowed retries, timeout, compensating action, audit event, and terminal behavior. The transition tables are in `docs/state-machines.md`.

## Agent tool boundaries

| Agent | Allowed tool classes | Prohibited |
|---|---|---|
| Intake coordinator | validate intake, build capability manifest | crawl, model/provider, write |
| Audit assessor | read normalized evidence, apply semantic rubric | technical score mutation, connector/write |
| Keyword analyst | validated imports, GSC reader, clustering/mapping, cannibalization | invented metrics, write |
| Performance analyst | source readers, deterministic metric calculator, calendar/status evidence | manual arithmetic, cross-source totals, write |
| Visibility observer | deterministic provider adapter results, entity/citation normalization | direct credentials, retries beyond policy, write |
| Commerce/local/entity analyst | normalized specialist evidence and confirmed facts | unverified edits, platform write |
| Planner | findings, opportunities, deterministic priority inputs | approval, apply, unsupported forecasts |
| Content strategist | evidence, approved fact register, style guide, gated brief/draft | publication, fabricated claims |
| Change planner | connector capabilities, current structured fields, exact diff | apply/publish credentials |
| Verifier | fresh fetch, rule evaluation, read-back, request rollback | direct arbitrary write |
| Report composer | canonical normalized report model | adding new facts/metrics |

Only the connector service may hold write credentials. It is deterministic and policy-enforced, not an LLM agent.

## Required configuration

- `config/providers.yaml`
- `config/crawler-registry.yaml`
- `config/freshness.yaml`
- `config/policy-facts.yaml` or database-backed equivalent
- `config/rules/*.yaml`
- `config/schema-requirements.yaml`
- `config/connectors/*.yaml`
- `schemas/fact-sheet.schema.json`
- `schemas/keyword-upload.schema.json`
- `templates/style-guide-ar.md`, `templates/style-guide-en.md`
- versioned prompt sets by language/market/use case

No model ID, price, quota, crawler token, platform field mapping, schema eligibility, or provider behavior is a permanent code constant unless it is a stable protocol fact backed by a test.

## Change risk baseline

- Tier 1: low-risk metadata/presentation fields; one approver; canary then bounded batch.
- Tier 2: titles, H1, visible content blocks, internal links, structured data; one approver with page-level diff; page-by-page rollout.
- Tier 3: indexability, canonicals, redirects, hreflang, sitemap, slugs, templates/themes, site-wide rules; two-person separation where implemented; staging or PR; one controlled change at a time.
- Forbidden: fabricated facts/reviews/ratings, hidden text, cloaking, link schemes, silent deletion, mass thin pages, or writes outside the approved target/hash/expiry.

Exact tiers remain versioned policy and require calibration before production.

## Release evidence

Every milestone release includes artifact versions, migrations, changed files, commands, tests/evals, unresolved risks, security/privacy/cost review, accessibility/Arabic evidence, rollback steps, monitoring, approver, release time, and post-release verification.

## Changes from V4

Source: V4 `PRODUCTION_CONTRACTS_V4.md`. All text not listed below is unchanged.

| # | Where | Change | Reason |
| --- | --- | --- | --- |
| 1 | Header | Added the line "V5 adaptation status: draft for review" | Writing rules: mark unreviewed edits |
| 2 | Intro | The V4 sentence saying the contracts are shared by the other V4 build package and Claude Code builds → "These contracts govern this Claude Code build of Website Presence Intelligence." | This repository is a Claude Code build only |
| 3 | Intro | Added: JSON Schemas live in `schemas/` (`schemas/<kebab-name>.schema.json`), validated by `scripts/check_schemas.py`; transition tables in `docs/state-machines.md` | Repository layout |
| 4 | Evidence and fidelity | Added the `fidelity_label` → `evidence_state` mapping table, including `not_verified` for a check that could not complete | Canonical vocabulary; 01 §15 ("mapped to user-facing evidence states without erasing the original label") |
| 5 | Workflow states | Added "The transition tables are in `docs/state-machines.md`." | Repository layout |
| 6 | New section | Added this "Changes from V4" list | Traceability |
