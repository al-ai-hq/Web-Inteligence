# Website Presence Intelligence — Product Requirements (V5 start-ready, based on V4)

Version: 4.0 production specification  
Target platform: Google Cloud  
Status: authoritative production target; implemented through verified gates  
V5 adaptation status: draft for review. Every edit to the V4 text is listed in "Changes from V4" at the end.

> **Authority (D-001).** This document is the product authority. On conflict it wins over every other
> file in `docs/spec/`, unless a recorded decision in `docs/decisions.md` (all entries) says
> otherwise. Those decisions are already applied to this text. The full reference order is in §15
> ("Formal authority order").
>
> **Where to look next:**
>
> - `02-DETAILED-SPECIFICATION.md`: implementation detail where this document is silent. Where the two differ, this document wins. Section map in §18.
> - `03-PRODUCTION-CONTRACTS.md`: evidence fields, schema set, workflow states, agent tool boundaries, change-risk baseline.
> - `05-PROJECT-PLAN.md`: milestones (M0A to M13) and their exit gates.
> - `09-MERGE-DECISIONS.md`: how the inputs were merged. The decision register is `docs/decisions.md`.

## 1. Product decision

Build a bilingual Arabic/English Website Presence Intelligence platform that combines technical SEO, AEO, GEO, AI-answer observation, keyword and organic-performance intelligence, public-footprint analysis, experience/conversion review, content planning, safe remediation, and impact monitoring.

The product adopts the valuable public-product patterns identified in Savage Audit—broad audit coverage, representative site sampling, same-rubric comparisons, a Search Console action layer, public-proof analysis, configurable presentation, public opt-in examples, and evidence-backed action planning—while retaining stricter data fidelity, security, bilingual, provider-observation, and change-control requirements.

## 2. Users

- Marketing directors and growth leads.
- SEO, content, AEO, and GEO specialists.
- Founders and product marketers.
- Agencies managing multiple clients.
- Developers and technical leads implementing fixes.
- Arabic/English regional teams.
- Reviewers, approvers, and compliance/security owners.

## 3. Product goals

- Show whether a website can be found, understood, trusted, cited, used, and converted.
- Connect search demand and AI-answer gaps to exact pages and fixes.
- Explain the evidence and limits behind every result.
- Convert audits into safe, assignable, testable work.
- Support Arabic and English with equal functional quality.
- Apply approved changes without granting uncontrolled publishing power.
- Prove implementation and observe outcomes over time.

## 4. Non-goals

- Guaranteed rankings, citations, traffic, leads, or revenue.
- Link schemes, doorway pages, cloaking, fake reviews, or mass low-value content.
- Unapproved form submissions, orders, bookings, CMS edits, publishing, DNS, or CDN changes.
- Treating AI prose as a deterministic measurement.
- Publishing customer audits by default.
- Reproducing Savage Audit branding, named personas, copy, or undisclosed methods.
- Replacing professional legal, medical, financial, accessibility, or security review.

## 5. Core product areas

### 5.0 Anonymous-first acquisition and access

- Phase 1 requires no account, email address, or payment details.
- Every low-risk visitor is eligible for one complimentary comprehensive public-data audit.
- The first audit provides a representative crawl, Presence Readiness, Experience Effectiveness, public footprint, one comparison, selected AI observations, priority action board, and preliminary roadmap.
- The anonymous report is an interactive in-application web experience only.
- Anonymous users cannot download PDF, document, CSV, JSON, raw evidence, or full-report export files.
- The temporary report is private, unguessable, non-indexed, deletable, and expires after seven days.
- A signed temporary secret authorizes access to the report; it does not establish domain ownership.
- The second anonymous audit remains a useful reduced-scope audit. Later anonymous audits may use preview scope.
- Registration is required only for persistence, another comprehensive audit, history comparison, private data, connections, monitoring, collaboration, export, public publication, or remediation.
- Initial registration uses `User → Project → Site`. Organizations, agency workspaces, invitations, and advanced roles are deferred to the agency milestone.

### 5.1 Audit workspace

- Single-page, priority-page, representative-template, full bounded crawl, and imported-crawl modes.
- Explicit target, market, language, device, page/template scope, and evidence coverage.
- Live progress, partial results, failures, resume, cancellation, and cost state.
- Raw/normalized evidence viewer with hashes and provenance.

### 5.2 Presence Readiness

- Crawlability/indexability.
- On-page SEO and internal architecture.
- Structured data and entity clarity.
- AEO.
- GEO.
- Internationalization/accessibility.
- Performance/security posture.
- Versioned 0–100 score with weights, applicability, coverage, and critical caps.

### 5.3 Experience Effectiveness

- Design hierarchy.
- Copy and positioning clarity.
- UX and navigation.
- Trust and proof.
- Conversion path and measurement.
- Separate score and confidence; never merged into readiness.

### 5.4 Comparison studio

- URL versus URL.
- Domain versus domain.
- Competitor versus owned site.
- Old versus new.
- Production versus staging.
- Arabic versus English parity.
- Before versus after remediation.
- Equivalent method enforcement and category/rule deltas.

### 5.5 Template intelligence

- Page-type classification.
- Representative sampling.
- Recurring issue clusters.
- Template/component/CMS-field root cause.
- Affected-page scope and examples.
- Fix-once impact estimation without fabricated traffic outcomes.

### 5.6 Keyword and competitor intelligence

- User uploads and approved read-only providers.
- Arabic/English query preservation and normalization.
- Intent, clustering, SERP composition, search/business competitor separation.
- Owner-page mapping, cannibalization, gaps, and content opportunity.
- Source-specific volume, rank, CPC, difficulty, and date when supplied.

### 5.7 Search Console and analytics workbench

- Query/page/date/country/device/search-appearance analysis.
- Low CTR, configurable striking distance, content decay, ownership, and landing-page fit.
- Like-for-like comparisons, source formulas, timezones, filters, and freshness.
- GA4 landing-page engagement and confirmed conversion-event analysis.
- Strict separation from GSC and business records.

### 5.8 AI visibility laboratory

- Versioned prompt sets by market, language, category, intent, and funnel stage.
- Approved provider/search modes and repeats.
- Mention, recommendation, owned citation, all citations, competitor share, and accuracy issues.
- Lost-prompt and citation-source analysis.
- Cost, failure, and denominator transparency.

### 5.9 Public footprint and entity graph

- Owned social profiles and important listings.
- Reviews and public proof without fabricating sentiment or counts.
- Third-party references and cited sources.
- Brand names, transliterations, domain, category, address, phone, hours, offers, and service-area consistency.
- Knowledge/entity connections and correction opportunities.

### 5.10 Brand truth monitor

- Approved fact registry.
- Wrong/outdated AI-answer facts.
- Incorrect prices, availability, locations, services, ownership, and policies.
- Evidence-linked correction workflow.
- Scheduled rechecks.

### 5.11 Content and schema studio

- Opportunity maps, briefs, outlines, articles, landing pages, comparisons, FAQs, metadata, internal links, and schema drafts.
- Existing-page-first decision.
- Fact-input manifest.
- Arabic-native drafting and review.
- Regulated-claim and brand/legal review.
- Visible-content/schema consistency.

### 5.12 Action center

- Executive 8–12 action board.
- Complete backlog and 30/60/90 roadmap.
- Critical blockers, quick wins, strategic opportunities, measurement fixes, and polish.
- Impact, effort, confidence, urgency, risk, owner, dependency, evidence, implementation, validation, rollback, and review window.

### 5.13 Correction center

- Git PR and CMS/API adapters.
- Exact current/proposed preview.
- Draft, canary, bulk, publish, rollback, and validation states.
- Approval binding, expiry, idempotency, stale-state checks, conflict detection, and read-back.
- Separate edit/publish permission.

### 5.14 Impact ledger

- Link findings to recommendations, approvals, changes, releases, validation, and later outcomes.
- Equivalent before/after comparison.
- Implementation success versus business outcome.
- No unsupported causal attribution.

### 5.15 Monitoring and alerts

- Scheduled re-audits.
- Search/analytics changes.
- Content decay.
- AI-answer changes.
- public-footprint contradictions.
- schema, performance, accessibility, and indexing regressions.
- connector, budget, retention, and provider failures.
- quiet unchanged state.

### 5.16 Agency workspace

- Tenant-separated clients and projects.
- Roles for owner, analyst, reviewer, approver, executor, and viewer.
- White-label reports.
- Portfolio dashboards and bulk schedules.
- Client review/approval links.
- Methodology and template versioning.

### 5.17 Public gallery and benchmarks

- Disabled by default.
- Explicit domain-owner opt-in.
- Preview and redaction.
- No private evidence or sensitive findings.
- Search, filters, score bands, categories, trending, and leaderboard views.
- Removal, revocation, correction, expiry, and re-consent.
- Consent-safe aggregated benchmarks.

### 5.18 Report personality

- Executive, professional, direct, teaching, technical, and light-roast tones.
- Arabic-localized equivalents.
- Tone applied after facts and priority are finalized.
- No named-person imitation or abusive/regulated-context roast.

### 5.19 Anonymous eligibility and cost behavior

- Determine promotional eligibility through privacy-conscious signed-cookie, recent-domain, request-velocity, automation, and limited network-risk signals.
- Do not use invasive cross-site fingerprinting or treat a shared IP as a unique person.
- Reuse recent evidence when valid and disclose capture time.
- Preserve deterministic audit, evidence, core scores, and action plan before optional AI repetition or enrichment.
- Apply CAPTCHA, slower queue, reduced scope, or temporary refusal only when risk or budget requires it.
- Global safety and spending circuit breakers override first-audit eligibility.

## 6. Information architecture

- Home and new audit.
- Projects.
- Audit overview.
- Evidence and methodology.
- Presence Readiness.
- Experience Effectiveness.
- Templates and recurring issues.
- Keywords and competitors.
- Search Console and analytics.
- AI visibility laboratory.
- Public footprint and entity graph.
- Brand truth.
- Content and schema studio.
- Comparison studio.
- Action center.
- Correction center.
- Impact ledger.
- Monitoring.
- Reports and exports.
- Agency portfolio.
- Public gallery and benchmarks.
- Connections, approvals, budgets, retention, and administration.

## 7. Core data entities

- Organization, workspace, membership, role.
- Project, site, verified domain, market, language.
- Audit, audit scope, crawl job, page, template, response evidence.
- Evidence object, provenance, validation, normalization, reconciliation.
- Rule, methodology version, finding, score, cap, coverage.
- Experience rubric and reviewed judgment.
- Keyword source, query, cluster, SERP observation, page owner, cannibalization case.
- GSC and analytics import/connection with source-specific rows.
- Prompt set, provider run, citation, mention, competitor, accuracy issue.
- Public entity, profile, listing, review surface, third-party reference, fact.
- Content opportunity, brief, draft, fact input, schema draft.
- Recommendation, action, roadmap, assignment.
- Connector, credential reference, capability, resource.
- Change proposal, diff, approval, execution, read-back, validation, rollback.
- Impact observation and comparison window.
- Schedule, automation run, notification, budget event.
- Report, export, sharing consent, redaction, publication, revocation.
- Audit log, retention event, deletion verification, incident.

## 8. Functional requirements

### Evidence and methodology

- Every claim has evidence state, source tier, date, method version, limitations, and evidence IDs.
- Every metric declares grain, scope, numerator, denominator, formula, filters, timezone, and missing behavior.
- Headline metrics are reproducible.
- Stale provider/policy facts expire safely.

### Crawling

- SSRF-safe redirect-aware fetch and renderer isolation.
- Respect site policies and no-bypass behavior.
- Sample disclosures and site-wide count restrictions.
- Partial audits remain useful and honest.

### Scoring

- Deterministic readiness calculations.
- Separate reviewed experience calculations.
- Coverage and confidence shown beside scores.
- Critical caps and score versions visible.
- No arbitrary universal thresholds.

### Search and analytics

- Correct aggregate CTR and compatible position handling.
- Percentage points for rate changes.
- Zero denominators handled explicitly.
- GSC, GA4, ranking providers, AI observations, and business data remain distinct.

### AI visibility

- Readiness and observed presence are separate.
- Provider failures excluded from valid denominators.
- Results disclose provider, mode, prompt, repeat, market, language, and time.
- No unsupported category average or visibility promise.

### Content

- Existing page ownership checked first.
- Claims grounded in approved facts.
- Arabic receives native review.
- Publishing always gated.

### Changes

- Connector IDs come from live read results.
- Exact approval, expiry, hashes, and environment required.
- Canary, idempotency, read-back, validation, and rollback required.
- Slug change blocked without redirect and link plan.

### Public sharing

- Explicit opt-in and ownership verification.
- Private sources excluded.
- Redaction and preview before publication.
- Immediate revocation and removal workflow.

## 9. Non-functional requirements

- WCAG 2.2 AA target with recorded verification.
- Full Arabic RTL and mixed-direction support.
- Strong tenant and record authorization.
- Encryption in transit and at rest.
- Bounded retries, timeouts, idempotency, circuit breakers, and dead-letter handling.
- Anonymous report and evidence retention default of seven days, with earlier user deletion.
- Registered-project retention defaults to 30 days unless an approved plan/policy specifies otherwise.
- User deletion and downstream deletion verification.
- USD 150 monthly application budget until revised. It is one hard cap that covers Google Cloud hosting and infrastructure plus paid AI-model and data-provider calls (D-005; ASSUMPTION: owner to confirm). The cost guard tracks hosting and paid calls as separate lines against the one cap. See `docs/cost-model.md`.
- No secrets or raw sensitive evidence in logs or prompts.
- Auditability for every access, approval, execution, publication, and deletion.

## 10. Google Cloud deployment

Deploy Next.js/API to Cloud Run; crawl/render tasks to isolated Cloud Run Jobs; use Cloud Tasks/Pub/Sub and Workflows for orchestration; Cloud SQL PostgreSQL for relational state; Cloud Storage for evidence/reports; Secret Manager and optional KMS for credentials; Cloud Armor and load balancing for edge protection; Cloud Logging/Monitoring for operations; Cloud Scheduler for automations; Vertex AI plus approved external providers through a controlled gateway.

Use separate development, staging, and production projects where feasible. Give each service a distinct least-privilege identity. Production write connectors must not be available to crawl or report workers.

## 11. Product analytics

Track audit requested, anonymous eligibility class, scope selected, audit completed/partial/failed, report viewed, section/finding/evidence/action viewed, registration prompt selected, registered export requested/completed, comparison created, recommendation accepted/edited/rejected, draft generated, approval requested/decided, canary applied, change applied/read-back/validated/rolled back, monitor material change, public share consented/revoked, and deletion completed.

No event may contain secrets, raw page content, personal search queries, OAuth tokens, or private URLs unless an approved data design explicitly requires and protects them.

## 12. Acceptance criteria

The product cannot enter controlled production until:

- crawler SSRF and renderer-isolation suites pass;
- deterministic rules and scores reproduce independently;
- experience rubrics have evidence and reviewer calibration;
- samples are never presented as full coverage;
- Arabic/English flows and reports pass manual review;
- web/PDF/document/chart data agree;
- anonymous reports remain in-app and every anonymous PDF/document/CSV/JSON/evidence export attempt is denied server-side;
- temporary report links are unguessable, non-indexed, expire after seven days, support deletion, and can be claimed after registration without implying domain ownership;
- one rich, second reduced, later preview, and suspicious-request pathways preserve their defined value and cost controls;
- GSC and analytics formulas pass expected-value fixtures;
- readiness and observed AI visibility cannot be confused in UI or exports;
- public-footprint findings preserve source and confidence;
- content generation rejects fabricated facts and citations;
- correction workflows pass stale, conflict, replay, wrong-tenant, partial-failure, read-back, and rollback tests;
- public gallery passes consent, redaction, revocation, and leakage tests;
- cost, retention, deletion, observability, incident, and accessibility controls work;
- production release and publishing retain named human gates.

## 13. Success measures

- Completed and useful partial-audit rate.
- Valid finding precision from reviewed samples.
- Time to first defensible finding and action plan.
- Percentage of headline metrics independently reproduced.
- Recommendation acceptance/edit/rejection reasons.
- Draft-to-validated-change rate.
- Read-back mismatch and rollback rates.
- Material-change alert precision.
- Arabic and English task success.
- Search/AI observations linked to implemented actions without claiming unsupported causality.
- Cost per completed audit and provider/crawl budget adherence.
- Public-share revocation and privacy-request completion.

Do not set success thresholds until pilot evidence exists.

## 14. Decisions requiring approval

- Methodology weights, caps, and experience rubric.
- Google Cloud organization, region, billing, and environments.
- Phase 2 identity provider and minimal `User → Project → Site` model; advanced tenant/agency design is deferred.
- First CMS or Git connector.
- Model providers and allowed data classes.
- Prompt-panel size, repeats, markets, and cost allocation.
- Content and regulated-claim policy.
- Production approvers and separation of duties.
- Public-gallery eligibility, consent, retention, moderation, and removal policy.
- Agency white-label and benchmark privacy policy.
- Exceptions to retention and USD 150 budget. The budget covers Google Cloud hosting plus paid AI-model and data-provider calls as one cap (D-005; ASSUMPTION: owner to confirm; see `docs/cost-model.md`).

**needs_human_review:** true.

## 15. V4 production closure

V4 adopts the strongest production controls from the reviewed PRD and mega prompt while preserving every final V3 product decision.

### Adopted

- Formal authority order: law/provider terms/security → V4 PRD → approved decisions → current primary documentation → standards → versioned registries → client-confirmed data → observed evidence → advisory sources.
- Fidelity labels: `observed`, `computed`, `assessed`, `attested`, `user_supplied`, `estimated`, `unavailable`, mapped to user-facing evidence states without erasing the original label.
- Typed JSON Schema draft 2020-12 contracts for evidence, findings, keyword rows/clusters, rank snapshots, prompt runs, plans, content, changes, approvals, snapshots, verification, lineage, webhooks, commerce, local, entity, platform, and migration records.
- Explicit idempotent workflow states, attempts, timings, errors, cost, methodology version, and immutable evidence references.
- Exact agent tool allowlists. Agents that consume untrusted content cannot reach write tools; only the connector service holds write credentials.
- Risk-tiered changes, canaries, snapshots, idempotency, read-back, verification, conflict detection, and rollback.
- Provider-specific circuit breakers, pre-call cost checks, price/version registry, and Billing export reconciliation.
- Config artifacts for providers, crawlers, rules, schema eligibility, freshness, connector capabilities, fact sheets, brand terms, style guides, keyword uploads, prompts, and policy facts.
- Runbooks, threat model, source register, decisions, assumptions, open-items register, release evidence, and phase reports.

### V3 decisions preserved over conflicting references

- The first eligible anonymous audit is rich but remains an in-application web report.
- Anonymous users get no PDF, document, CSV, JSON, evidence bundle, task export, or email-link gate.
- Anonymous report/evidence retention is seven days maximum, not 30 days.
- The second anonymous audit is useful but reduced; later anonymous audits may be previews.
- Registration begins only for persistence, another comprehensive audit, private connections, monitoring, collaboration, exports, publication, or remediation.
- Initial identity remains `User → Project → Site`; advanced organizations, agency tenancy, invitations, and roles arrive later.
- Prompt-panel size, providers, repeats, and cadence are configuration constrained by evidence needs, provider terms, and budget; fixed high-cost counts are not universal defaults.

### Adapted rather than copied

- Automatic rollback is allowed only when the approval explicitly authorizes it, the rollback target matches the stored snapshot, the connector supports atomic/reliable reversal, and deterministic read-back detects an exact low/medium-risk mismatch. Otherwise pause for human review.
- Free-audit page counts use representative sampling and cost/risk limits, not a fixed universal 20-page claim.
- MCP is a build/calibration integration when suitable. Production uses audited native APIs or a production-approved MCP server with equivalent auth, scopes, tenancy, logging, and contract tests.
- All time-sensitive claims from the reviewed files enter the policy-fact registry and must be reverified against current primary sources before implementation.

### Production release criteria

- No unresolved critical security, privacy, data-loss, cross-tenant, or write-safety defect.
- One full harmless change completes intent → spec → plan → implementation → tests/evals → review → staging → release evidence → rollback rehearsal.
- Every reported number has lineage and a fidelity label; headline values independently recompute.
- Anonymous export denial, seven-day deletion, private-link expiry, noindex, reduced-repeat behavior, and claim-after-registration tests pass.
- Every enabled connector passes sandbox contract, denial, stale-state, replay, partial-failure, read-back, and rollback tests.
- Arabic and English journeys pass functional parity, native review, and WCAG 2.2 AA verification appropriate to the release.

## 16. Latest marketing SEO skill integration requirements

These requirements incorporate the 30 September 2026 skill release. They supplement, and do not replace, the anonymous-access, evidence, security, cost, and approval rules above.

### E-commerce intelligence

- Audit categories, subcategories, products, variants, filtered/sorted URLs, pagination, out-of-stock/discontinued items, seasonal hubs, and marketplace overlap.
- Reconcile visible product facts, raw HTML, canonicals, structured data, feeds, Merchant Center, language, currency, price, availability, shipping, returns, warranty, and seller identity.
- Keep GSC clicks, Merchant Center clicks, GA4 sessions, and business orders separate.
- Never estimate revenue uplift, demand, feed performance, or disapproval counts.

### Local presence intelligence

- Support storefront, service-area, hybrid, single-location, and multi-location businesses.
- Audit public Business Profile evidence, owner-only data when supplied, branches, categories, hours, seasonal exceptions, location pages, `LocalBusiness`, NAP, reviews, citations, and local AI answers.
- Record observation location. Area-wide/grid ranking requires a supplied local-rank export.

### Entity and reputation operations

- Maintain a client-confirmed, dated fact register covering names, transliterations, ownership, relationships, locations, contacts, policies, licences, and material claims.
- Tie wrong AI facts to exact runs and cited sources; correct owned sources first, use legitimate third-party processes, and re-test consistently.
- Escalate legal, defamation, trademark, fraud, disputed claims, and Wikipedia/Wikidata work to named human owners.

### Platform-aware implementation

- Maintain versioned capability matrices for Shopify, Salla, Zid, WordPress/WooCommerce, Magento/Adobe Commerce, Webflow, and custom/headless builds.
- Treat platform detection as provisional. Confirm it before write planning and bind each fix to a supported field, template, app/plugin, API, or code path.

### Migration and replatforming control

- Support domain, host/CDN, HTTPS, URL, CMS/platform, redesign, language/market, merger, and ccTLD migrations.
- Require a dated baseline, complete URL inventory, redirect map, staging parity diff, go/no-go evidence, named owners, rollback triggers, launch log, and post-launch monitoring.
- Preserve Arabic URL encoding, language ownership, hreflang, canonicals, structured-data IDs, feeds, analytics, consent, listings, and bot behavior.
- Never promise no traffic loss or treat an unobserved statement as verified.

### AI prompt-panel method

- Build prompts from observed queries, customer questions, site facts, intent, funnel stage, language, and market.
- Default engines are Google AI surfaces, ChatGPT, Perplexity, Gemini, and Claude; add Copilot when Bing matters.
- Record prompt/run IDs, engine/mode/model where exposed, market, language, location, authentication state, date/time, repeats, response outcome, mentions, recommendations, citations, competitors, errors, and cost.
- Explain every omitted default engine. Use supported APIs or governed product accounts, not customer personal browser sessions.

### Policy and data model additions

- Add commerce catalog/feed/merchant/policy records, local location/profile/NAP/review records, platform capability records, and migration baseline/redirect/parity/go-no-go/rollback records.
- Every time-sensitive provider, schema, shopping, Business Profile, platform, and migration fact stores its primary source, checked date, owner, review date, and expiry.
- Specialist modules are capability-gated. Inapplicable modules are out of scope, not missing-data warnings.

## 17. Latest reference expansion

### Site strategy and architecture

- Produce evidence-linked page maps, owner-page assignments, hierarchy/navigation models, URL policies, and internal-link plans.
- Use compatible market/language/device/date SERP-overlap evidence only when supplied or approved; record source and method. No universal overlap threshold becomes a product rule without calibration.
- Preserve the existing page that owns demand unless a reviewed merge/redirect plan justifies change. Every URL change enters migration control.

### Backlink intelligence

- Accept dated Search Console, Bing Webmaster Tools, or licensed-tool exports and keep every source/index separate.
- Analyze referring domains, anchors, linked pages, lost/broken targets, competitor gaps, and legitimate reclamation/earning opportunities.
- Label authority, toxicity, and spam scores as vendor-specific. Never present them as Google metrics or calculate a synthetic backlink-health score.
- Disavow preparation requires evidence, exceptional justification, legal/SEO review, existing-file reconciliation, and verified property-owner execution. The product never uploads a disavow file automatically.

### Comparison pages

- Support `X vs Y`, alternatives, and best-for-use-case pages only when demand, audience value, and page ownership justify them.
- Every competitor claim requires a dated source and neutral/fair presentation. Pricing, features, availability, and performance claims need freshness and correction paths.
- Require brand/legal review for trademarks, comparative advertising, regulated claims, and market-specific risk. Structured data must match the page and cannot imply nonexistent ratings or offers.

### Programmatic SEO

- Require a unique-value test, authoritative dataset, record-level completeness, stable identifiers, template validation, duplicate/similarity screening, indexability rules, and explicit source ownership before generation.
- Roll out in small approved batches with canaries, QA samples, sitemap/internal-link controls, monitoring, and pause/merge/remove criteria.
- Prohibit doorway pages, city/keyword swaps, thin transformations, automated translation without real localized data, and publishing pages merely to increase index count.

### Change monitoring

- Maintain a fixed critical-URL set and immutable known-good snapshots with capture time, release ID, crawler/method version, and coverage.
- Run like-for-like post-change snapshots and deterministic diffs for status, redirects, robots directives, canonicals, hreflang, language/direction, metadata, headings, structured data, content, links, sitemaps, agent parity, and applicable commerce/accessibility signals.
- Treat diff severity as triage, not verdict. Confirm critical/high rows against the live page and release intent before declaring a regression.
- Support CI failure thresholds for approved pipelines, but never configure or alter a client's CI without authorization.

## 18. Where the detail lives

This document states what the product must do. `02-DETAILED-SPECIFICATION.md` states how, where this document is silent. Where they differ, this document wins (D-001).

| Topic | Requirements here | Implementation detail |
| --- | --- | --- |
| Scoring method and audit rules | §5.2; §8 "Scoring" | 02 §6 |
| Keyword and rank intelligence | §5.6; §5.7 | 02 §7 |
| Optimization plan and action board | §5.12 | 02 §8 |
| Content briefs and drafts | §5.11; §8 "Content" | 02 §9 |
| Correction engine and connectors | §5.13; §8 "Changes" | 02 §10 |
| Automations and workflows | §5.15 | 02 §11 |
| Google Cloud architecture | §10 | 02 §12 |
| Runtime agents, skills and guardrails | §15 "Adopted" | 02 §13 |
| Data integrity and fidelity | §8 "Evidence and methodology"; §15 | 02 §15 |
| Data requirements and retention | §7; §9 | 02 §16 |
| Security, privacy and compliance | §9 | 02 §17 |
| Cost controls and circuit breakers | §5.19; §9 | 02 §18 |

Machine-readable and supporting artifacts:

- `schemas/`: JSON Schema draft 2020-12 files for the contracts in `03-PRODUCTION-CONTRACTS.md`, validated by `scripts/check_schemas.py`.
- `config/`: configurable sizes, budgets, providers, registries and agent tool allowlists (D-006, D-010), for example `config/anonymous-eligibility.yaml`, `config/prompt-panels/*.yaml`, `config/budgets.yaml` and `config/agents/<agent-name>.yaml`.
- `docs/state-machines.md`: transition tables for the audit, content and change workflows listed in `03-PRODUCTION-CONTRACTS.md`.
- `docs/cost-model.md`: budget math for the USD 150 cap (D-005).

## Changes from V4

Source: V4 `PRODUCT_REQUIREMENTS_V4_CLAUDE_CODE.md`. All text not listed below is unchanged.

| # | Where | Change | Reason |
| --- | --- | --- | --- |
| 1 | Title | "Website Presence Intelligence V4 — Final Production Product Requirements (Claude Code Build)" → "Website Presence Intelligence — Product Requirements (V5 start-ready, based on V4)" | V5 repository naming |
| 2 | Header | Added the line "V5 adaptation status: draft for review". The V4 version and status lines are kept | Writing rules: mark unreviewed edits |
| 3 | Header | Added the authority note and pointers to 02, 03, 05 and 09 | D-001 |
| 4 | §9 | "USD 150 monthly application budget until revised." kept, followed by: one hard cap covering Google Cloud hosting plus paid AI-model and data-provider calls (ASSUMPTION: owner to confirm), tracked as separate lines, see `docs/cost-model.md` | D-005 |
| 5 | §14 | "Exceptions to retention and USD 150 budget." kept, followed by the same budget-scope sentence and pointer | D-005 |
| 6 | Section order | "16. V4 production closure" renumbered to 15. Its position (after §14) and text are unchanged | Numbers run 1 to 17 in order |
| 7 | Section order | "15. Latest marketing SEO skill integration requirements" renumbered to 16 and moved from the end of the file to sit between §15 and §17. Text unchanged | Numbers run 1 to 17 in order |
| 8 | Section order | "17. Latest reference expansion" keeps its number; it is now the last V4 section. Text unchanged | Numbers run 1 to 17 in order |
| 9 | Internal references | None needed updating. The V4 text has no numbered cross-references; "the ... rules above" in §16 still points to earlier sections | Checked |
| 10 | Leftover wording | No leftover "V2" wording and no reference to the other V4 build package found in the V4 source. "V3" in §15 is kept because it names the preserved V3 decisions | Checked |
| 11 | New §18 | Added "Where the detail lives" | Navigation for Claude Code |
| 12 | New section | Added this "Changes from V4" list | Traceability |
