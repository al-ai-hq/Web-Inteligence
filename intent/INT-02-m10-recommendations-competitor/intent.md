# Intent: M10 Recommendations Engine and Competitor Tracking

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| ID                  | INT-02                                                                  |
| Status              | draft                                                                   |
| Author (originator) | <DECIDE_AT_M10: product owner name>                                     |
| Product owner       | <DECIDE_AT_M10: name>                                                   |
| SEO lead            | <DECIDE_AT_M10: name>                                                   |
| Milestone           | M10 (docs/m9-roadmap.md Priority 2: User Engagement)                    |
| Ticket              | none                                                                    |
| Created             | 2026-10-14                                                              |
| Depends on          | M9 (Production Readiness) complete; M8 Content & Schema Studio complete |
| Risk class          | standard (no write-class tools, no CMS/Git writes, no new connectors)   |

## Problem

The M9 roadmap (docs/m9-roadmap.md Priority 2) lists four M10 items: Audit History & Comparisons, Competitor Tracking, Recommendations Engine, and Team Collaboration. Two of these — Recommendations Engine and Competitor Tracking — have design seeds prepared at `docs/superpowers/specs/2026-10-14-m10-recommendations-engine-seed.md` and `2026-10-14-m10-competitor-tracking-seed.md`. The seeds port frameworks from the `seo-agent-skill/` (outside repo) into WPI's vocabulary and constraint set, but no intent has been authored to formalize requirements, cite constraints, or define exit gates.

Without this intent, the M10 milestone cannot proceed through the repo's governance chain (intent → spec → plan → code). The seeds are input material; the intent is the contract that the product owner accepts and the spec author implements.

Audit History & Comparisons and Team Collaboration are deferred to a follow-up M10 intent or a later milestone (M11 or M12) to keep this intent focused on the two seeded items.

## Proposed outcome

From the M10 roadmap and the design seeds, complete and reviewed:

1. **Recommendations Engine** (`@wpi/recommendations` package):
   - Deterministic priority scoring function over audit findings: `Priority Score = (Impact × 2) − Effort − Timeline` (each 1–10), with all three inputs recorded alongside the score. Scores are a presentation-layer ranking; they never alter Presence Readiness, Experience Effectiveness, AI visibility, or search performance numbers (D-012 separation invariant).
   - Config-driven scoring thresholds in `config/recommendations/scoring.yaml` (source + date per D-010) that categorize findings into Quick Win / Strategic / Fill-In / Defer.
   - Industry classification (SaaS, e-commerce, local, publisher, professional services, or `generic`) derived from audit evidence (schema types, crawl signals) and user-declared business type (highest precedence). Classification shown to user with basis.
   - Playbook overlays in `config/recommendations/industry-playbooks.yaml` (D-010) that reorder or annotate recommendations; playbooks never add findings the rules engine did not produce.
   - Signed-in users can mark a recommendation "applied" (manual confirmation, no CMS write). Applied recommendations create outcome-log records keyed to the audit.
   - Outcome-tracking: when a later audit of the same site runs, the outcome log joins to the new findings and records measured deltas (metric, before, after, as-of times, `fidelity_label`) following CLAUDE.md metrics conventions (CTR from totals, impression-weighted position, percentage-point changes, explicit zero denominators).
   - Bilingual EN + AR for all new UI strings and report sections; native Arabic review required.

2. **Competitor Tracking** (`@wpi/competitors` package):
   - Watchlist: signed-in users add competitor URLs (max `<DECIDE_AT_M10>` per project) to a project-scoped watchlist. Duplicate/same-site validation. Bilingual UI.
   - Monthly automated competitor audit: scheduler dispatches the existing audit pipeline per watchlist entry. Each competitor audit is a normal audit record (project-scoped, same schema, same scoring) tagged `role=competitor`. Cost per audit metered against D-005 and shown before enabling the schedule.
   - Gap analysis compares the user's latest audit vs each competitor's latest audit on dimensions WPI actually measures: rules findings present/absent (M2 categories), Presence Readiness score delta, Experience dimension deltas (M5), Core Web Vitals from PSI/CrUX (M5). Never blends these into one number (D-012) — deltas reported per dimension.
   - Content-gap view: topics/subpages where the competitor site has substantive indexed-style content and the user's site has thin/missing equivalents, derived from crawl evidence (titles, headings, page counts per section). Labeled as crawl-inference with `fidelity_label`, never as "ranking data".
   - Keyword-gap view is export-driven: the user uploads their own GSC query export (and optionally a competitor's from a tool they license); WPI computes overlap/gaps offline. WPI itself never queries SERPs (D-009). Uploaded files: CSV schema-validated, personal data redaction reminder shown, retention per `docs/data-classification.md`.
   - Monitoring cadence: weekly diff of the latest two competitor audits (what changed), surfaced on the dashboard as a movement log with as-of timestamps.
   - Dashboard: competitor list, per-dimension delta table, movement log, CWV comparison — bilingual EN + AR, logical CSS/RTL.
   - Anonymous reports: competitor features are signed-in only (D-002 alignment — anonymous flow stays minimal and read-only).

## Affected users and systems

**Users:** signed-in users (recommendations engine, competitor tracking), product owner (scoring thresholds, playbook content), SEO lead (industry classification logic, playbook accuracy), data engineer (CSV upload schema, outcome-log joins).

**Systems:**

- `apps/web` — new UI pages (action board, competitor dashboard, CSV upload)
- `packages/recommendations` (new) — priority scoring, industry classification, playbook overlay, outcome log
- `packages/competitors` (new) — watchlist store, scheduler, gap analysis engine
- `services/audit-pipeline` — reuse existing pipeline for competitor audits (no changes to pipeline itself)
- `config/recommendations/` (new) — scoring.yaml, industry-playbooks.yaml
- `schemas/` — new schemas for recommendation-priority, recommendation-outcome, competitor-watchlist, competitor-gap

## Constraints

- **D-002** anonymous reports: in-app only, no downloads, private link plus signed secret, `noindex`, deletable, 7-day expiry. Competitor features are signed-in only.
- **D-005** one combined USD 150 monthly cap (hosting plus paid calls). Competitor audits reuse the existing pipeline; recommend `agents_enabled=false` for competitor runs to keep cost near zero (rules + connectors cover gap analysis). Monthly schedule spends by default once enabled — needs explicit user confirmation + budget display.
- **D-009** never call Google Autocomplete or scrape search-result pages. Keyword-gap is export-driven (user uploads CSV). WPI never queries SERPs.
- **D-010** no hard-coded model IDs, prices, quotas, or crawler tokens. Scoring thresholds and playbook content come from `config/recommendations/` with source + date per entry.
- **D-012** Presence Readiness, Experience Effectiveness, AI visibility, and search performance stay separate and are never blended. Priority scores are a downstream ranking layer, not a rule-weight change — no `methodology_version` bump required.
- **D-014** every record belongs to a project. Watchlist, gap records, outcome-log entries are project-scoped.
- **CLAUDE.md:75** never import `.claude/skills/marketing-seo-agent/scripts` or any skill scripts into product code; port the logic and test it against `evals/golden/`. The `forbidden_endpoints.py` hook blocks application code that imports or runs skill scripts.
- **CLAUDE.md conventions:** every stored or shown number carries source, as-of time and `fidelity_label`; metrics follow CLAUDE.md rules (CTR from totals, impression-weighted position, rate changes in percentage points, zero denominators explicit); Arabic UI uses logical CSS, `dir` from locale, bidi-isolate URLs and code; Arabic copy needs native review.
- **Policy skills that apply:** `security-baseline` (SSRF validation for competitor URLs, owned-record write guards), `data-integrity` (outcome deltas must not imply causation; correlation-only records need `fidelity_label`), `cost-guard` (monthly schedule spends by default — explicit user confirmation), `arabic-rtl-a11y` (new UI in logical CSS, bidi-isolated URLs), `google-search-guidance` (D-009 is binding; export-driven keyword gap is the compliant substitute).
- **Skill governance:** the seeds port logic from `seo-agent-skill/` (outside repo) into product code. Nothing is imported. The vendored `.claude/skills/marketing-seo-agent/` (pinned 30 Sep 2026, SHA-256 locked) remains the golden oracle for existing capabilities; the new packages do not alter it.

## Out of scope

- Audit History & Comparisons (M10 roadmap item #1) — deferred to follow-up intent or M11.
- Team Collaboration (M10 roadmap item #4) — deferred to follow-up intent or M12.
- CMS/Git write access — M10 ends at "mark applied" (manual confirmation). Publishing is the connector service's domain and is explicitly out of scope (split-trust boundary, CLAUDE.md layout).
- Third-party backlink data (Ahrefs/SEMrush) — not in M1–M8 connectors; paid API adds cost. Defer to a future decision.
- AI Visibility Lab integration for competitor domains — M6 measures user's brand; competitor AEO measurement is a new cost + design question. Out of scope for M10.
- Changes to the existing audit pipeline, rules engine, or connectors — M10 reuses them as-is.

## Exit gate

From the M10 roadmap and the design seeds, independent reviews can:

1. Reproduce one priority score from a finding (deterministic function, inputs recorded).
2. Show that a priority score does not alter Presence Readiness, Experience Effectiveness, AI visibility, or search performance numbers (D-012 separation).
3. Demonstrate that a competitor audit is a normal audit record tagged `role=competitor`, project-scoped (D-014).
4. Show that a keyword-gap analysis runs on user-uploaded CSV only, with no SERP queries (D-009 compliance).
5. Demonstrate that a monthly competitor schedule displays cost before enabling and respects the USD 150 cap (D-005).
6. Show that outcome-log deltas carry source, as-of, and `fidelity_label`, and that correlation-only records are labeled as such (data-integrity).
7. Verify bilingual EN + AR for all new UI strings and report sections (arabic-rtl-a11y).

Each proof is recorded in this intent's `release.md` with the command, fixture and reviewer.

## Open questions

- **<DECIDE_AT_M10>** Who owns scoring threshold values in `config/recommendations/scoring.yaml` — SEO lead sign-off required? Owner: product owner with SEO lead.
- **<DECIDE_AT_M10>** Does industry classification run on every audit (recompute) or persist per site and refresh? Owner: SEO lead.
- **<DECIDE_AT_M10>** Is "site stage" user-declared only, or derived from first-audit date? (Derivation needs an audit-history retention rule.) Owner: product owner with data engineer.
- **<DECIDE_AT_M10>** Minimum evidence before the outcome log is shown to users (e.g., hide deltas until 2 measured audits exist)? Owner: SEO lead.
- **<DECIDE_AT_M10>** Watchlist size cap per project (proposal: 5 on Hobby-tier hosting)? Owner: product owner.
- **<DECIDE_AT_M10>** Do competitor audits run agents (paid) or rules+connectors only (near-free)? Proposal: rules+connectors only. Owner: product owner with AI engineer.
- **<DECIDE_AT_M10>** CSV export format spec for keyword-gap (GSC UI export vs GSC API export vs third-party CSV) — one schema or per-source mappers? Owner: data engineer.
- **<DECIDE_AT_M10>** Retention of competitor audit records (same 7-day anonymous rule cannot apply — these are owned; confirm owned-audit retention)? Owner: privacy counsel.
- **<DECIDE_AT_M10>** Does gap analysis include AI Visibility Lab prompts against competitor domains? (M6 measures user's brand; competitor AEO measurement is a new cost + design question. Proposal: out of scope for M10.) Owner: product owner with AI engineer.

## Links

- Seeds: `docs/superpowers/specs/2026-10-14-m10-recommendations-engine-seed.md`, `2026-10-14-m10-competitor-tracking-seed.md`
- Spec: `intent/INT-02-m10-recommendations-competitor/spec.md` (after acceptance)
- Plan: `intent/INT-02-m10-recommendations-competitor/plan.md` (after spec approval)
- Release: `intent/INT-02-m10-recommendations-competitor/release.md` (after merge)
- M10 seed for M11 (deferred): `docs/superpowers/specs/2026-10-14-m11-ai-content-assistant-seed.md`
