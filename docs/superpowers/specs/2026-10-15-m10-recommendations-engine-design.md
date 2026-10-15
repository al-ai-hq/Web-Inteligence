# M10 Recommendations Engine — Design Spec

| Field | Value |
| ----- | ----- |
| Status | draft — pending implementation plan |
| Date | 2026-10-15 |
| Replaces | `docs/superpowers/specs/2026-10-14-m10-recommendations-engine-seed.md` as the binding M10 intent |
| Authority | `docs/decisions.md` D-012 (score separation), D-014 (project-scoped findings), CLAUDE.md data-integrity, security-baseline, arabic-rtl-a11y |

## Goal

Replace the existing rules-engine priority calculation with an impact/effort/timeline scoring model, surface ranked action items on the report as Quick Win / Strategic / Fill-In / Defer, add industry-specific playbook overlays, and close the loop by letting signed-in users mark recommendations applied and see measured score deltas on later audits.

## Architecture summary

Keep the work inside the existing `@wpi/rules-engine` and `@wpi/audit-pipeline` packages. The rules engine still outputs `Finding[]`; a new deterministic recommendation scorer converts findings into ranked `PriorityItem[]` using rule weight, category effort, and per-rule timeline. An industry classifier and playbook overlay reorder/annotate without adding findings. The composer maps enriched priority items into the report action board. A new `OutcomeStore` records signed-in users' "applied" marks and computes score deltas when the next audit for the same site completes. Anonymous reports remain read-only.

## Tech stack

- TypeScript, Zod for new config schemas, existing YAML config loader pattern
- `@wpi/rules-engine` for scoring and priority types
- `@wpi/audit-pipeline` for report envelope and outcome persistence
- `apps/web` Next.js App Router, next-intl, Tailwind v4
- Postgres migration following the existing `packages/audit-pipeline/src/migrations/00NN_*.sql` sequence

## Global constraints

- Priority scores are a presentation-layer ranking; they never alter Presence Readiness, Experience Effectiveness, AI visibility, or search performance numbers (D-012 separation).
- All stored numbers carry lineage: source, as-of timestamp, and fidelity label (CLAUDE.md production-contracts).
- Outcome deltas must be labelled `correlation_only` unless a controlled before/after measurement exists; the UI must not imply causation.
- "Mark applied" is an owned-record write — requires signed-in user and ownership guard.
- Anonymous reports stay read-only, in-app, 7-day expiry (D-002).
- Bilingual EN + AR for all new UI strings; native Arabic review required.
- No new paid LLM calls in this scope; deterministic scoring and outcome joins only.

## Functional requirements

### FR-1 Priority scoring replaces the existing formula

`packages/rules-engine/src/priority.ts` is replaced with a pure function:

```
priority_score = (impact_score × 2) − effort_score − timeline_score
```

Each input is an integer 1–10.

- `impact_score` is derived from the rule's existing `importance_weight` (1–5): `impact_score = importance_weight × 2`. This keeps the rules engine's presence-readiness methodology unchanged; priority is a downstream ranking layer.
- `effort_score` is looked up per `RuleCategory` from `config/recommendations/scoring.yaml`.
- `timeline_score` is read from a new optional `recommendation_timeline` field on each rule. If absent, a per-category default from the same config is used.

The output range is −18 to +18. The scorer returns `RecommendationPriorityItem[]` (a superset of the current `PriorityItem`) carrying all four scores plus the assigned band.

#### Default scoring config (`config/recommendations/scoring.yaml`)

```yaml
methodology_version: "0.1.0-m10"
scoring:
  formula: "(impact_score * 2) - effort_score - timeline_score"
  band_thresholds:
    quick_win: 8
    strategic: 3
    fill_in: -3
    defer: null  # anything below fill_in
  max_playbook_boost: 3
effort_by_category:
  crawlability: 4
  on_page: 3
  structured_data: 5
  aeo: 5
  geo: 7
  i18n_accessibility: 4
  performance_security: 6
timeline_default_by_category:
  crawlability: 4
  on_page: 3
  structured_data: 5
  aeo: 6
  geo: 7
  i18n_accessibility: 4
  performance_security: 5
```

### FR-2 Action board grouped into four bands

Thresholds live in `config/recommendations/scoring.yaml` and are owned by the SEO lead. The default calibration (changeable without code):

| Band | Priority score | Positioning |
| ---- | -------------- | ----------- |
| Quick Win | ≥ 8 | High impact, relatively low cost/time |
| Strategic | 3 – 7 | High impact, but larger investment |
| Fill-In | −3 – 2 | Lower impact but easy to pick up |
| Defer | < −3 | Low impact and high cost/time |

The composer maps each item to `StoredActionItem` and adds band, impact/effort/timeline scores, and playbook metadata. The report action board is rendered grouped by band, with bands ordered Quick Win → Strategic → Fill-In → Defer. Items inside a band keep severity/confidence ordering.

### FR-3 Industry classification and playbooks

Industry classification is derived per audit. Precedence of signals:

1. `business_type` from the audit form context (explicit user declaration).
2. Schema types found during the crawl (e.g., `Product`, `LocalBusiness`, `Organization`).
3. Content/URL heuristics (e.g., `/shop/`, `/blog/`, `/services/` path segments).
4. Fallback to `generic`.

Supported industries for M10: `saas`, `ecommerce`, `local`, `publisher`, `professional_services`, `generic`.

Playbooks live in `config/recommendations/industry-playbooks.yaml`. A playbook contains:

- `playbook_id` and display name (EN + AR).
- A list of `rule_id` entries with optional `boost` (integer added to priority_score) and `note_key` (i18n key for an inline annotation).
- Playbook entries never create findings; they only reorder or annotate items the rules engine already produced.

The classifier's basis (which signal decided the industry) is stored on the audit report so the UI can show it.

#### Example playbook config

```yaml
playbooks:
  - playbook_id: saas
    display_name:
      en: SaaS
      ar: SaaS
    entries:
      - rule_id: AEO-003
        boost: 2
        note_key: playbook_saas_aeo_003
      - rule_id: PRF-002
        boost: 1
  - playbook_id: ecommerce
    display_name:
      en: E-commerce
      ar: التجارة الإلكترونية
    entries:
      - rule_id: STR-001
        boost: 2
        note_key: playbook_ecommerce_str_001
```

### FR-4 Site stage

Site stage is `new` (< 1 year), `growth` (1–3 years), or `mature` (3+ years). It is used to adjust effort/timeline defaults and to filter playbook notes. Derivation precedence:

1. User-declared value in the audit form, if present.
2. For signed-in users: time since the first audit for the same site in `audits`.
3. Default to `growth`.

Site stage is shown on the report alongside the industry classification.

### FR-5 Signed-in users can mark recommendations applied

On the report action board, each item shown to the signed-in owner of the audit has a "Mark as applied" control. Clicking it:

- Creates an outcome record keyed by `(user_id, rule_id, audit_id_applied)` with status `applied` and `measured_audit_id` null.
- Is idempotent for the same user/rule/applied-audit tuple.
- Is denied for anonymous users and non-owners.

### FR-6 Later audits record measured deltas

When a new audit completes for a signed-in user and the same site (same normalized domain), the outcome service:

1. Finds all `applied` outcome records for that user + site whose `measured_audit_id` is null.
2. For each record, copies the new audit's metric values into `value_after` and the previous audit's values into `value_before`.
3. Sets `measured_audit_id` to the new audit's id and `fidelity_label` to `correlation_only`.
4. Computes deltas for:
   - Overall `presence_readiness`
   - Each `RuleCategory` score

Metrics follow CLAUDE.md conventions: percentage-point changes, explicit numerators/denominators where applicable, and no averaging of incompatible denominators.

### FR-7 Minimum evidence for showing deltas

Deltas are surfaced only when:

- At least two completed audits exist for the same user and site.
- The newer audit completed after the recommendation was marked applied.
- The metric has a non-null value in both audits.

Until then, the applied mark is shown as "pending measurement".

### FR-8 Bilingual UI

All new report strings, dashboard strings, and button labels are added to the `report` and `dashboard` namespaces in both EN and AR catalogs. URLs and code values are bidi-isolated.

## Data contracts

### `RecommendationPriorityItem`

Extends the existing `PriorityItem` in `@wpi/rules-engine`:

```typescript
export type RecommendationBand = "quick_win" | "strategic" | "fill_in" | "defer";

export interface RecommendationPriorityItem extends PriorityItem {
  impact_score: number;      // 1–10
  effort_score: number;      // 1–10
  timeline_score: number;    // 1–10
  priority_score: number;    // −18 to +18
  band: RecommendationBand;
  playbook_id: string | null;
  playbook_note_key: string | null;
  industry_classification: string;
  site_stage: string;
}
```

The old `priority_value`, `group`, `horizon`, and `display_band` fields are removed from the type; the composer will no longer reference them.

### `StoredActionItem` enrichment

```typescript
export interface StoredActionItem {
  title: string;
  detail: string;
  severity: FindingSeverity;
  confidence: "high" | "medium" | "low";
  source_finding_id: string;
  // new
  impact_score: number;
  effort_score: number;
  timeline_score: number;
  priority_score: number;
  band: RecommendationBand;
  playbook_note_key: string | null;
}
```

### `RecommendationOutcome` (outcome log record)

```typescript
export interface RecommendationOutcome {
  id: string;
  user_id: string;
  rule_id: string;
  audit_id_applied: string;
  audit_id_measured: string | null;
  metric: "presence_readiness" | RuleCategory;
  value_before: number | null;
  value_after: number | null;
  as_of_before: string | null;  // ISO timestamp of the before audit
  as_of_after: string | null;   // ISO timestamp of the after audit
  fidelity_label: "correlation_only" | "measured" | "inferred";
  source: "user_marked_applied";
  created_at: string;
  updated_at: string;
}
```

### Database table

`packages/audit-pipeline/src/migrations/0019_recommendation_outcomes.sql`:

```sql
CREATE TABLE recommendation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  audit_id_applied UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  audit_id_measured UUID REFERENCES audits(id) ON DELETE SET NULL,
  metric TEXT NOT NULL,
  value_before NUMERIC,
  value_after NUMERIC,
  as_of_before TIMESTAMPTZ,
  as_of_after TIMESTAMPTZ,
  fidelity_label TEXT NOT NULL DEFAULT 'correlation_only',
  source TEXT NOT NULL DEFAULT 'user_marked_applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, rule_id, audit_id_applied, metric)
);

CREATE INDEX idx_recommendation_outcomes_user_applied
  ON recommendation_outcomes(user_id, audit_id_applied);
CREATE INDEX idx_recommendation_outcomes_user_rule_pending
  ON recommendation_outcomes(user_id, rule_id) WHERE audit_id_measured IS NULL;
```

## Architecture

### Component flow

```mermaid
flowchart LR
    A[Audit form<br/>URL + business_type + site_stage] --> B[Pipeline runs rules engine]
    B --> C[Finding[]]
    C --> D[Industry classifier<br/>business_type > schema > heuristic]
    D --> E[Playbook overlay<br/>config/recommendations/industry-playbooks.yaml]
    E --> F[Recommendation scorer<br/>impact × 2 − effort − timeline]
    F --> G[RecommendationPriorityItem[]]
    G --> H[Composer<br/>maps to StoredActionItem[]]
    H --> I[StoredReportEnvelope]
    I --> J[Report UI<br/>grouped action board]
    J --> K[User marks applied<br/>signed-in owner only]
    K --> L[(recommendation_outcomes<br/>applied, measured_audit_id null)]
    M[Next audit completes] --> N[Outcome service joins<br/>same user + site]
    N --> L
    L --> O[Dashboard shows deltas<br/>correlation_only]
```

### Package boundaries

- `@wpi/rules-engine`
  - `priority.ts` → new pure scoring function
  - `types.ts` → `RecommendationPriorityItem`, `RecommendationBand`
  - `config-loader.ts` → load `recommendation_timeline` from rule YAML and recommendation configs
- `@wpi/audit-pipeline`
  - `report-envelope.ts` → extend `StoredActionItem`
  - `composer.ts` → consume new `PriorityItem` shape, drop old `mapPriorityItem` mapping
  - `outcome-store.ts` (new) → `OutcomeStore` interface
  - `in-memory-outcome-store.ts` (new) → in-memory implementation
  - `postgres-outcome-store.ts` (new) → Postgres implementation
  - `audit-store.ts` → no schema change; outcome service filters `listByUser` by normalized domain in code
- `apps/web`
  - Report page → render grouped action board, show "Mark as applied"
  - Dashboard → show recommendations and deltas
  - API routes → `POST /api/audits/[id]/recommendations/[findingId]/apply`

### Industry classification

The classifier is a pure function in `@wpi/rules-engine`:

```typescript
export interface IndustrySignals {
  business_type?: string;
  schema_types?: string[];
  url_paths?: string[];
}

export function classifyIndustry(signals: IndustrySignals): {
  industry: Industry;
  basis: string;
};
```

Mapping (first match wins):

| Signal | Industry |
| ------ | -------- |
| `business_type` in {saas, software, technology, b2b} | saas |
| `business_type` in {ecommerce, retail, shop, store} | ecommerce |
| `business_type` in {local, restaurant, clinic, service_area} | local |
| `business_type` in {publisher, blog, news, media} | publisher |
| `business_type` in {professional_services, agency, consulting, law, accounting} | professional_services |
| `schema_types` contains `Product` or `Offer` | ecommerce |
| `schema_types` contains `LocalBusiness` | local |
| `schema_types` contains `NewsArticle` or `BlogPosting` | publisher |
| URL path contains `/shop/`, `/product/`, `/cart/` | ecommerce |
| URL path contains `/blog/`, `/news/`, `/articles/` | publisher |
| URL path contains `/services/`, `/consulting/` | professional_services |
| default | generic |

### Playbook overlay

The overlay is a pure function:

```typescript
export function applyPlaybook(
  items: RecommendationPriorityItem[],
  playbook: Playbook,
): RecommendationPriorityItem[];
```

For each item whose `rule_id` appears in the playbook:

- Add the playbook's `boost` to `priority_score`.
- Set `playbook_note_key` if the entry has one.

Boosts are additive and capped so a single boost cannot move an item more than one band. The cap is configurable in `config/recommendations/scoring.yaml` (`max_playbook_boost: 3`).

### Outcome service

The outcome service is owned by `@wpi/audit-pipeline`. It exposes:

```typescript
export interface OutcomeStore {
  markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome>;
  listPendingForUser(userId: string): Promise<RecommendationOutcome[]>;
  recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]>;
  listForAudit(auditId: string): Promise<RecommendationOutcome[]>;
}
```

`recordDeltas` is called by the pipeline when an audit transitions to `READY_COMPLETE` and the audit has a `user_id`. It:

1. Normalizes the audit's target URL to domain.
2. Finds the user's most recent previous completed audit for the same domain.
3. For each pending outcome record, copies before/after metric values from the two audits.
4. Sets `fidelity_label = 'correlation_only'` and `measured_audit_id` to the new audit.

## UI/UX

### Report action board

- Group items under band headings with badge colors:
  - Quick Win: emerald
  - Strategic: brand/indigo
  - Fill-In: amber
  - Defer: slate
- Each item shows severity badge, confidence badge, title, detail, and mini indicators for impact/effort/timeline (e.g., three 1–10 dots).
- Signed-in owner sees "Mark as applied" button. After clicking, the button shows "Applied — pending measurement" until a later audit closes the loop.
- Anonymous users and non-owners see no action controls.

### Dashboard recommendations panel

- Shows open recommendations from the latest audit (applied but not yet measured, plus unapplied Quick Wins).
- When deltas exist, shows a card: "Since [date], Presence Readiness moved from X to Y (+Z points). This is a correlation, not a guaranteed result of any action."
- Each delta carries its `fidelity_label` visibly.

## Security and policy

- `authorizeRecord` ownership guard on "Mark applied" API route.
- Rate-limit the apply endpoint per user (reuses existing `@wpi/rate-limiter`).
- Outcome records are scoped to `user_id`; no cross-user reads.
- Deltas are labelled `correlation_only`; marketing or export copy must not imply causation.

## Testing strategy

- Unit tests for the scorer: verify all input combinations produce expected bands.
- Unit tests for the classifier: verify each signal precedence.
- Unit tests for the playbook overlay: verify boosts cap correctly and annotations attach.
- Unit tests for the outcome service: verify before/after values and fidelity labels.
- Integration test: signed-in user marks an item applied; a second audit triggers delta recording.
- Playwright e2e: report page shows grouped board; dashboard shows pending/reported outcomes.

## Out-of-scope for M10

- CMS integration or automatic verification that a recommendation was implemented.
- Forecasting rankings, traffic, or revenue from recommendations.
- Playbooks that add new findings not produced by the rules engine.
- Outcome tracking for anonymous users.

## Resolved open questions from seed spec

| Seed question | Resolution |
| ------------- | ---------- |
| Who owns scoring threshold values? | SEO lead owns `config/recommendations/scoring.yaml`; defaults are provided and can be calibrated without code changes. |
| Industry classification: recompute or persist? | Recompute per audit from signals; `business_type` has highest precedence. No separate site registry needed. |
| Site stage: user-declared or derived? | User-declared if provided; otherwise derived from audit history for signed-in users; default `growth`. |
| Minimum evidence before showing deltas? | Show deltas only when two completed audits exist and the newer audit completed after the applied mark. |
| Playbook scope? | Reorder and annotate only; never add findings. |
| Outcome metrics? | Overall `presence_readiness` and per-category scores. |
