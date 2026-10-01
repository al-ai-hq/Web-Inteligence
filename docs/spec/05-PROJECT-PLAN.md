# Website Presence Intelligence — Project Plan (V5 start-ready, based on V4)

Version: 4.0 production execution plan  
Architecture: Google Cloud only  
Delivery approach: AI-native SDLC with human production gates  
V5 adaptation status: draft for review. §1-§11 are the V4 plan with the small fixes listed at the end; §12-§17 add the operating model, Phase 0, the intent backlog, launch sequencing, measures and gates. Model assignments are in 06-MODEL-PLAN.

## 1. Delivery strategy

The complete target scope in 01-PRODUCT-REQUIREMENTS is accepted as the target product, but it must not be built in one release. Use the artifact chain:

`intent.md → spec.md → plan.md → code/tests/evals → review → release.md → lessons.md → new intent`

Every milestone must preserve deterministic behavior, evidence lineage, security, Arabic/English parity, accessibility, cost controls, and rollback. Google Cloud is the implementation target; other platforms remain a research stream with no delivery dependency.

## 1.1 Closure decision: anonymous-first launch

Phase 1 launches with one comprehensive public-data audit for every low-risk anonymous visitor. It requires no registration, email, or payment details. The report remains inside the website and is accessible through a private unguessable temporary link for seven days. Anonymous users receive no built-in PDF, document, CSV, JSON, raw-evidence, or full-report download.

The second anonymous audit remains useful but uses reduced scope; later anonymous audits may use preview scope. Registration begins only when the user requests another comprehensive audit, persistence, history, private connections, monitoring, collaboration, exports, public publication, or remediation.

The first registered model is `User → Project → Site`. Full organization/client workspace/role tenancy is deferred until the agency milestone.

## 2. Workstreams

1. Product and methodology governance.
2. Google Cloud foundation and security.
3. Secure crawling and rendering.
4. Evidence and integrity platform.
5. Deterministic Presence Readiness.
6. Reviewed Experience Effectiveness.
7. Keyword, SERP, GSC, and analytics intelligence.
8. AEO/GEO observation and public footprint.
9. Content/schema studio.
10. Reports, comparison, and action planning.
11. Connectors and controlled remediation.
12. Impact ledger and monitoring.
13. Agency, public gallery, and benchmarks.
14. Operations, privacy, accessibility, and launch.

## 3. Required skills

### Product and domain

- Technical SEO and crawling/indexing.
- Keyword research, SERP intent, rank data, and cannibalization.
- AEO, GEO, AI-answer measurement, and citation analysis.
- Public entity, local SEO, reviews, and digital footprint.
- Content strategy, editorial systems, and structured data.
- UX research, information architecture, copy, trust, and conversion.
- Arabic SEO, localization, editorial review, RTL, and GCC markets.
- Organic analytics and measurement design.

### Engineering

- Strict TypeScript and Next.js.
- Secure network programming, SSRF defense, browser isolation, and crawling.
- PostgreSQL, query design, lineage, reconciliation, and tenant authorization.
- Cloud Run, Cloud Run Jobs, Cloud Tasks, Pub/Sub, Workflows, Cloud SQL, Cloud Storage, Cloud Armor, IAM, Secret Manager, KMS, logging, and budgets.
- Queues, retries, idempotency, scheduling, dead letters, and workflow state.
- OAuth and CMS/Git adapters.
- Accessible bilingual UI and report generation.
- AI provider gateways, prompts, evals, and cost accounting.

### Governance and quality

- Threat modeling, privacy, retention, legal/provider review, incident response.
- Evidence/source grading and methodology calibration.
- Deterministic expected-value tests.
- Agent and prompt evals.
- Accessibility and Arabic manual QA.
- Change management, approvals, rollback, and release verification.

## 4. Agent responsibilities

Use narrow agents/workers:

- Intake and Capability Coordinator.
- Secure Crawl Worker.
- Deterministic Audit Worker.
- Experience Review Worker.
- Keyword and SERP Analyst.
- Arabic Market Reviewer.
- Search Console and Analytics Analyst.
- AEO/GEO Observer.
- Public Footprint and Entity Analyst.
- Brand Truth Monitor.
- Content Strategist.
- Integrity and Methodology Reviewer.
- Report and Comparison Composer.
- Change Planner.
- Change Executor.
- Release Verifier.
- Policy, Privacy, and Cost Governor.

Scraped content is data, never instruction. Agents exchange typed contracts and immutable evidence IDs. No agent may grant itself connectors, broader scopes, budgets, targets, retention, publication, or production rights.

## 5. Milestones

### M0 — Governance and Google Cloud foundation

Deliver:

- approved intent/spec/plan templates;
- architecture decisions and Google Cloud project layout;
- threat model, data classification, IAM matrix, budget model, retention policy;
- methodology registry and evidence/source states;
- connector capability catalog;
- agent contracts, eval ownership, branch protection, and release gates;
- development/staging foundation without production credentials.
- anonymous-access threat model, signed temporary access design, seven-day deletion, no-index behavior, rich/reduced/preview eligibility policy, and global cost circuit breakers;
- future-compatible audit-claim contract without implementing registration or advanced tenancy.

Exit: one harmless change completes the full artifact/review chain; canonical sources remain unchanged; budget and access boundaries are demonstrable.

### M1 — Secure crawler and evidence capture

Deliver:

- URL/DNS/redirect validation;
- isolated HTTP and Playwright workers;
- robots/policy controls;
- bounded representative/full crawl modes;
- raw evidence hashing and response provenance;
- malicious-site fixtures and partial-result behavior;
- authorized crawler-response comparison.

Exit: independent SSRF suite passes; no internal/metadata reachability; secrets and databases are inaccessible; samples are disclosed correctly.

### M2 — Integrity and Presence Readiness

Deliver:

- normalization, reconciliation, capability gates, and invalidation;
- versioned seven-category deterministic rules;
- coverage, weights, pre-cap score, critical caps, and lineage;
- template/page classification and recurring issue clustering;
- evidence viewer and methodology disclosure.

Exit: independent score reproduction and golden fixtures pass; invalid data cannot produce valid-looking results.

### M3 — Reports, comparison, and action board

Deliver:

- canonical report model;
- bilingual interactive in-application anonymous web report;
- canonical report projections for later registered PDF/document/CSV/JSON exports, kept inaccessible to anonymous users;
- single, representative, full, dual-URL, domain, language, staging, and before/after views;
- executive 8–12 action board and 30/60/90 roadmap;
- accessible charts and evidence-linked findings;
- professional presentation tones first.

Exit: anonymous report remains private, non-indexed, in-app, deletable, and seven-day limited; anonymous export endpoints deny access; Arabic RTL/accessibility and equivalent comparison tests pass.

### M4 — Keywords, SERPs, GSC, and analytics

Deliver:

- upload contracts and source metadata;
- Arabic query preservation/normalization;
- intent, clusters, search/business competitors, owner pages, cannibalization;
- read-only Search Console and optional GA4;
- low CTR, configurable striking distance, content decay, and landing-page fit;
- correct formulas, periods, timezones, and reconciliation.
- minimal registration, `User → Project → Site`, domain verification, anonymous-audit claiming, and secure connector ownership required for private sources.

Exit: expected-value tests pass; incompatible sources never combine; absent optional data is not an error; claiming an anonymous audit does not grant domain or connector authority.

### M5 — Experience Effectiveness

Deliver:

- versioned design, copy, UX, trust, conversion, and measurement rubrics;
- page evidence, confidence, and reviewer records;
- form/navigation/mobile/proof/message/CTA checks;
- separate score and comparison views;
- regulated-context tone restrictions.

Exit: rubric agreement and calibration reviewed; subjective results remain distinguishable from deterministic findings.

### M6 — AI visibility laboratory

Deliver:

- Access, Parse, Act, Footprint, and Observed Presence result sets;
- prompt families, provider gateway, repeats, cost ledger, and circuit breakers;
- mentions, recommendations, owned/all citations, competitor share, accuracy issues;
- lost-prompt and cited-source gap analysis;
- provider/policy version registry and expiry.

Exit: valid denominators, exact observation metadata, provider failure handling, and readiness/presence separation pass.

### M7 — Public footprint, entity graph, and brand truth

Deliver:

- approved public-source discovery;
- profiles, listings, reviews, third-party references, and fact consistency;
- entity graph and brand fact registry;
- hallucination/outdated-fact monitoring;
- legitimate correction and earned-evidence recommendations.

Exit: sources and confidence are visible; no fabricated reviews/counts; correction actions remain governed.

### M8 — Content and schema studio

Deliver:

- existing-page-first opportunity workflow;
- briefs, bilingual outlines, drafts, metadata, internal links, comparisons, direct answers;
- schema builder/diff/validation;
- fact manifests, regulated-claim flags, Arabic editorial review;
- brand and content approval workflow.

Exit: fabricated-claim/citation evals pass; cannibalization checks precede new pages; no automatic publishing.

### M9 — First safe connector and impact ledger

Deliver:

- one Git PR or CMS draft connector;
- exact IDs, read/current state, hashes, diffs, approval, expiry, canary, idempotency, read-back, validation, rollback;
- separate publication permission;
- finding-to-outcome impact ledger;
- before/after re-audit.

Exit: staging passes stale, conflict, replay, wrong tenant, denial, partial failure, read-back mismatch, slug/redirect, and rollback scenarios.

### M10 — Monitoring and automation

Deliver:

- scheduled crawls and data refresh;
- content decay, AI answer, brand fact, public footprint, schema, performance, and indexing monitoring;
- meaningful-change filters and quiet unchanged behavior;
- retention deletion, cost, connector, and provider health workflows;
- incident-to-intent feedback.

Exit: schedules cannot broaden scope or cross write gates; material alerts are evidence-linked; deletion and cost breakers work.

### M11 — Agency platform

Deliver:

- tenant-separated workspaces and roles;
- portfolios, bulk schedules, branded reports, client review/approval links;
- methodology versions and reusable templates;
- client evidence export and audit logs.
- organization/client workspace hierarchy, invitations, and advanced tenant roles introduced here rather than Phase 1.

Exit: cross-tenant security tests pass; bulk work remains budgeted and scoped.

### M12 — Public gallery, leaderboard, benchmarks, and tones

Deliver:

- ownership verification and explicit publication consent;
- preview/redaction/public-safe report projection;
- gallery, search, filters, score bands, trending, and leaderboard;
- removal/revocation/correction/expiry;
- consent-safe aggregated benchmarks;
- executive, professional, direct, teaching, technical, and light-roast tones without named-person imitation.

Exit: no private data leaks; consent and removal are proven; tone invariance tests confirm identical evidence, scores, severity, and priority.

### M13 — Controlled production launch

Deliver:

- production IAM, observability, runbooks, restore/redelete, backups, incident response, provider/legal review;
- accessibility and Arabic QA evidence;
- cost/load/security tests;
- rollout flags, pilot cohort, rollback rehearsal, and release decision.

Exit: named human production gate; rollback and incident drills pass; pilot findings receive manual validation.

## 6. Cross-milestone workflows

### Audit to plan

`INTAKE → CAPABILITY → SAFE CRAWL/IMPORT → INTEGRITY → READINESS → EXPERIENCE → KEYWORDS/GSC → AI/PUBLIC FOOTPRINT → REVIEW → REPORT → ACTION BOARD → ROADMAP`

### Content

`OPPORTUNITY → OWNER/CANNIBALIZATION → SERP/PROMPT EVIDENCE → BRIEF → FACTS → DRAFT → AR/EN REVIEW → APPROVAL → DRAFT/PR → VALIDATE`

### Correction

`IDS → CURRENT STATE → SNAPSHOT/HASH → DIFF → RISK → APPROVAL → CANARY → APPLY → READ-BACK → PUBLIC VALIDATION → IMPACT LEDGER → CLOSE/ROLLBACK`

### Public sharing

`OWNERSHIP → OPT-IN → SAFE PROJECTION → PREVIEW/REDACT → CONSENT → PUBLISH → MONITOR → REVOKE/EXPIRE`

### Monitoring

`SCHEDULE → FRESH EVIDENCE → EQUIVALENT COMPARISON → MATERIALITY → DIAGNOSIS → QUIET/NOTIFY → NEW INTENT`

## 7. Testing program

Maintain:

- unit tests for rules, formulas, parsing, normalization, scoring, and filters;
- adapter fixtures for every imported/connected source;
- integration tests for queues, workflows, storage, database, providers, and connectors;
- browser tests for core EN/AR journeys, reports, approvals, public consent, and deletion;
- SSRF, XSS, prompt injection, CSV injection, authz, OAuth, replay, supply-chain, and denial-of-wallet tests;
- accessibility automation plus manual keyboard, reflow, contrast, screen-reader, PDF, and RTL checks;
- agent evals for fabricated metrics, sample generalization, readiness/presence confusion, unsupported content, stale policies, and approval overreach;
- load/cost tests with defined workloads and stopping thresholds.
- anonymous rich/reduced/preview eligibility, shared-IP fairness, signed-cookie loss, evidence reuse, CAPTCHA escalation, temporary access expiry, deletion, claim, non-indexing, and export-denial tests.

## 8. Release policy

- Feature flags default high-risk modules off.
- Development may use synthetic data only.
- Staging uses test tenants and non-production credentials.
- Production requires named approval, verified targets, scope, rollback, monitoring, and budget.
- Agent or prompt output cannot approve its own release.
- Public sharing and production publishing remain separate release surfaces.

## 9. Immediate next action

Run an M0 product review to approve (open items are tracked in `docs/open-items.md`):

1. Presence and Experience scoring governance.
2. Google Cloud organization, region, environment, and USD 150 allocation (D-005: one combined cap for hosting and paid calls; ASSUMPTION to confirm).
3. Phase 2 identity provider and minimal `User → Project → Site` model; keep advanced tenancy deferred to M11.
4. First Search Console/GA4 and Git/CMS connectors.
5. Model/provider and prompt-panel budget.
6. Public-footprint source policy.
7. Content and regulated-claim approval policy.
8. Gallery, leaderboard, benchmarks, consent, moderation, removal, and retention.
9. Named security, methodology, Arabic, privacy, content, production, and publishing owners.

Then implement M0 only. Do not begin crawling or production connector work before the foundation exit gate.

**Confidence:** High that this plan covers the accepted target feature set and preserves Google Cloud.  
**needs_human_review:** true — methodology, architecture ownership, providers, connector scopes, public sharing, production gates, and budget allocation require accountable approval.

## 10. Latest skill delivery extension

Add these workstreams without changing the anonymous-first closure:

1. E-commerce, Merchant Center, feed, and marketplace intelligence.
2. Local presence, Business Profile, location/service-area, NAP, and review intelligence.
3. Confirmed brand facts, entity/reputation correction, and cited-source monitoring.
4. Platform capability matrices for Shopify, Salla, Zid, WooCommerce, Magento, Webflow, and headless builds.
5. Reproducible AI prompt panels with Claude included by default and explicit omission reasons.
6. Migration/replatforming baselines, redirect maps, parity, go/no-go, launch evidence, rollback, and monitoring.

### M8A — Specialist commerce, local, entity, and platform packs

Deliver product/category/variant/facet/pagination rules; page/schema/feed/Merchant reconciliation; local profile/location/NAP/review checks; a confirmed fact register; cited-source correction workflow; platform capability resolver; policy-fact expiry; and anonymized platform fixtures.

Exit: applicability, source separation, reconciliation, policy-expiry, Arabic parity, human-escalation, and no-fabrication fixtures pass.

### M8B — Migration control plane

Deliver baseline and URL-inventory contracts; redirect-map import/generation; one-hop validation; staging/production parity; go/no-go evidence; Arabic URL and hreflang tests; launch log; rollback triggers; and post-launch monitoring.

Exit: simulated domain, CMS, redesign, and language migrations pass redirect, parity, tracking, rollback, and evidence-state tests. No production launch action is automatic.

### Additional required roles

- Commerce and Feed Analyst.
- Local Presence Analyst.
- Entity and Reputation Analyst.
- Platform Capability Resolver.
- Migration Controller.
- Prompt Panel Methodologist.

### Additional workflow contracts

- Prompt panel: `APPROVE SCOPE/BUDGET → EVIDENCE-BUILT PROMPTS → NORMALIZED RUNS → CAPTURE ANSWERS/CITATIONS/ERRORS → VALID-DENOMINATOR ANALYSIS → FIXES → IDENTICAL RECHECK`.
- Commerce: `CATALOG SAMPLE → CRAWL/TEMPLATES → FEED/MERCHANT IMPORTS → RECONCILIATION → FIXES → CONNECTOR-GATED VALIDATION`.
- Local/entity: `CONFIRMED FACTS → PUBLIC/OWNER EVIDENCE → CONSISTENCY → CORRECTION QUEUE → HUMAN-OWNED PLATFORM ACTIONS → RECHECK`.
- Migration: `BASELINE → INVENTORY → REDIRECT MAP → STAGING PARITY → GO/NO-GO → LAUNCH EVIDENCE → MONITOR → CLOSE/ROLLBACK`.

## 11. V4 production sequence for Claude Code

### M0A — Repository and governance bootstrap

Deliver the real application repository baseline, package manager/lockfile, commands, root/nested `CLAUDE.md`, project settings, permission rules, skills layout, hook specification, architecture decisions, source/assumption/decision/open-item registers, schemas, test/eval layout, and CI checks.

Exit: a clean checkout can run documented lint, typecheck, unit tests, schema validation, secret scanning, and hook tests; results are recorded.

### M0B — Contracts, threat model, and cost proof

Deliver full JSON Schemas, state machines, source/fidelity/lineage model, evidence immutability, anonymous-access abuse model, connector approval model, project/IAM matrix, egress design, budget math, circuit breakers, retention/deletion map, and test fixtures.

Exit: independent reviews can reproduce one score, reject one invalid record, trace one report number, deny one unauthorized export/write, and simulate the USD 150 hard stop.

### Implementation loop

For each later milestone Claude Code must: read scoped instructions/skills; inspect current code/status; write/update intent/spec/plan; implement the smallest coherent slice; run proportional checks/evals; review security, privacy, cost, Arabic/English, accessibility, and rollback; produce release evidence; stop at the exit gate.

### Claude Code repository controls

- `CLAUDE.md` contains durable project governance; nested files narrow local context without weakening higher-level rules.
- `.claude/settings.json` defines reviewed permissions. Dangerous, destructive, secret-reading, production, and broad network operations are denied by default.
- Hooks enforce deterministic local checks only and are themselves versioned and tested.
- Skills have explicit triggers, contracts, validators, fixtures, and owners.
- Subagents receive disjoint least-privilege scopes and cannot approve or release their own output.
- No milestone is complete from documentation, hooks, or mocked integrations alone.

### M8C — Architecture, backlinks, scaled-content governance, and change monitoring

Deliver:

- page-map and internal-link-plan contracts;
- optional approved SERP-overlap imports with source/method metadata;
- backlink export adapters and source-separated analysis;
- broken/lost-link target validation and disavow review boundary;
- comparison-claim registry with freshness and legal-review flags;
- programmatic template/record/batch contracts, unique-value gate, similarity/data-quality tests, canary rollout, and stop conditions;
- immutable crawl baselines, production-grade diff engine, regression review workflow, and optional CI threshold output;
- Arabic/English and market-specific fixtures for each module.

Exit: fixtures prove no cross-source backlink totals, no automated disavow, no page-per-variant architecture, no thin/doorway batch, no unsupported comparison claim, and no unconfirmed diff marked as a regression.

## 12. AI-native SDLC operating model (from the build plan)

Every change moves through the same artifact chain. Each stage commits a file the next stage reads, and a named human approves at each gate (AI-Native SDLC Playbook, supplied by the owner).

| Stage | Artifact committed | Human gate | Starts the next stage |
| --- | --- | --- | --- |
| Plan | `intent/<id>/intent.md` | Product owner accepts it | Accepted intent starts design |
| Design | `intent/<id>/spec.md` | Product owner signs off; flagged concerns go to the named policy owner | Approved spec starts plan mode |
| Build | `intent/<id>/plan.md`, code and tests | An engineer approves every plan; a code owner approves the PR, never the agent that wrote it | Merged PR starts the pipeline |
| Test | Test output in the PR; eval results in the check run | Merge check on the eval pass rate | Green checks allow merge |
| Deploy | Release record `intent/<id>/release.md` | Release manager authorizes production | Deploy starts monitoring |
| Maintain | `lessons/*.md` and a new intent | Service owner triages | A breach or ticket writes the next intent |

Auto mode is for routine work once hooks and tests are in place: UI copy, rule fixtures, docs and non-security refactors. Never use it for connector write paths, auth, project isolation, SSRF, the cost guard or infrastructure.

Templates: `intent/_templates/`. The `intent-spec-plan` skill writes the three files and stops for approval. Plans touching connector write paths, auth, tenant or project isolation, SSRF, the cost guard or rule weights also need a tech lead. Which Claude model runs each milestone and each subagent is in 06-MODEL-PLAN.

Controls already in this repository:

- `CLAUDE.md` and `REVIEW.md` at the root.
- `.claude/settings.json`: permission baseline, plan mode by default, hooks, sandbox.
- `.claude/hooks/`: secret scan, forbidden endpoints, agent allowlist guard, methodology bump, production-infra protection, test lock, dangerous shell commands, formatter. Tested by `.claude/hooks/tests/`.
- `.claude/skills/`: seven policy skills plus the vendored `marketing-seo-agent` method skill.
- `.claude/agents/`: seven least-privilege subagents (06-MODEL-PLAN §4).
- `.github/workflows/ci.yml`: governance checks now; application checks switch on after M0A.
- `evals/`, `lessons/`, `ops/detection/bands.yaml`.

Adoption order (playbook): intents, `CLAUDE.md`, plan mode, feedback loop and hooks first; then skills, subagents, evals and PR review; then spec generation from intents; then CI/CD; last, closing the loop from monitoring to new intents.

## 13. Phase 0: manual audits with the skill (runs alongside M0)

Before product code, the SEO lead does the platform's work by hand with the vendored `marketing-seo-agent` skill. This tests the method on real sites and produces the ground truth the build is checked against.

- **Sites.** ASSUMPTION: 10 sites, matching the 10 hand-reviewed audits in 02-DETAILED-SPECIFICATION §19. Five client sites whose owners agree in writing, and five fixture sites: Arabic RTL, broken technical SEO, JavaScript-heavy, a CDN that blocks AI crawlers, and cannibalized pages.
- **Jobs.** Audit, keyword research, one brief, a performance report (where the client shares Search Console and GA4 exports) and an AI-visibility check with a small prompt panel.
- **Review.** The SEO lead corrects each report. Corrected outputs become the labelled site set for product-agent evals (`evals/product-agent/`), expected plan items and briefs, and golden files (`evals/golden/`) from `arabic_keywords.py`, `cannibalization.py` and `build_report.py`.
- **Timing.** Record how long each job takes and which steps were manual. The slowest steps inform the order of intents.
- **Limits.** `--compare-agents` only on sites whose owners agree, on a few URLs, stopping at the first block. `suggest.py` stays a manual research aid; its output never becomes product data. Client exports stay out of the repository; fixtures keep only what tests need, with personal data removed.

Exit: the SEO lead signs off the corrected reports as the eval baseline.

## 14. Milestone backlog as intents

One intent per milestone to start; large milestones split into several intents during design.

| Intent | Milestone | Scope summary | Main spec sections | Exit gate |
| --- | --- | --- | --- | --- |
| INT-00 | M0A | Repository and governance bootstrap | 01 §15; this plan §11 | §11 M0A exit |
| INT-01 | M0B | Contracts, threat model, IAM, cost proof | 03; `schemas/`; `docs/threat-model.md`; `docs/cost-model.md` | §11 M0B exit |
| INT-02 | M1 | Secure crawler and evidence capture | 01 §8; 02 §5, §12, §17 | §5 M1 exit |
| INT-03 | M2 | Integrity and Presence Readiness | 02 §6, §15; `config/rules/`, `config/scoring.yaml` | §5 M2 exit |
| INT-04 | M3 | Reports, comparison, action board | 01 §5.0, §5.4, §5.12; 02 §8 | §5 M3 exit |
| INT-05 | M4 | Keywords, Search Console, GA4, minimal registration | 02 §7, §13 | §5 M4 exit |
| INT-06 | M5 | Experience Effectiveness | 01 §5.3; `docs/rubrics/experience-effectiveness.md` | §5 M5 exit |
| INT-07 | M6 | AI visibility laboratory | 01 §5.8; 02 §6, §18; `config/prompt-panels/` | §5 M6 exit |
| INT-08 | M7 | Public footprint, entity graph, brand truth | 01 §5.9, §5.10 | §5 M7 exit |
| INT-09 | M8 | Content and schema studio | 02 §9 | §5 M8 exit |
| INT-10 | M8A | Commerce, local, entity, platform packs | 01 §16 | §10 M8A exit |
| INT-11 | M8B | Migration control plane | 01 §16 | §10 M8B exit |
| INT-12 | M8C | Architecture, backlinks, scaled content, change monitoring | 01 §17 | §11 M8C exit |
| INT-13 | M9 | First safe connector and impact ledger | 02 §10; `config/connectors/` | §5 M9 exit |
| INT-14 | M10 | Monitoring and automation | 02 §11 | §5 M10 exit |
| INT-15 | M11 | Agency platform and advanced tenancy | 01 §5.16 | §5 M11 exit |
| INT-16 | M12 | Public gallery, benchmarks, tones | 01 §5.17, §5.18 | §5 M12 exit |
| INT-17 | M13 | Controlled production launch | 01 §12, §15 | §5 M13 exit |

INT-00 and INT-01 are already drafted in `intent/`.

## 15. Launch sequencing (decision needed)

01 §5.0 promises the first anonymous audit Experience Effectiveness, public footprint, a comparison and selected AI observations. Those capabilities are built at M5, M6 and M7. Two options:

1. **Launch after M7** with the full first audit as specified (later public launch, one launch).
2. **Internal pilot after M3** with a readiness-only report for invited testers, then public launch after M7.

ASSUMPTION: option 2 for learning, with no public anonymous traffic before M7. Either way, public anonymous traffic also waits for the measured cost proof (Stage 2, D-019). Recorded in `docs/open-items.md` for the product owner.

## 16. Measures

| Stage | Leading | Lagging |
| --- | --- | --- |
| Plan | Time to a committed intent | Share of intents accepted |
| Design | Time from intent to spec | Spec edits after planning starts |
| Build | Share merged from the first pass | Rework cycles per change |
| Test | First-pass CI success | Review time per PR; change failure rate |
| Deploy | Time to first review; gate wait time | Defects caught before merge versus escaped |
| Maintain | Breach-to-intent time | Findings merged as fixes; repeat incidents |

Do not set targets until pilot evidence exists (01 §13).

## 17. Human gates in this plan

- Accepting intents and specs (product owner).
- Approving every plan; a tech lead for high-risk plans (see §12).
- Approving PRs (code owner; never the agent that wrote the change).
- Authorizing production releases (release manager).
- Approving live changes on client sites (02 §10; 03 change risk baseline).
- Signing off the Phase 0 reports as the eval baseline, and later changes to the vendored skill (SEO lead).
- Triaging monitoring findings (service owner).

## Changes from V4

- Title changed.
- Added V5 status note.
- Replaced leftover "V2 scope" wording.
- Replaced leftover "V2 M0" wording.
- Added D-005 note.
- Added §12-§17 (operating model from the build plan, Phase 0, intent backlog, launch sequencing, measures, human gates).
