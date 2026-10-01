# Merge Decisions: V3 to V4, and V4 to V5 start-ready

V5 adaptation status: draft for review. Part 1 is the V4 merge record, unchanged. Part 2 records how the V4 package and the detailed specification were merged into this start-ready repository on 30 Sep 2026. The live decision list is `docs/decisions.md`; open questions are in `docs/open-items.md`.

## Part 1. V4 merge record (unchanged)

Reviewed on 30 September 2026:

- V3 final closure package.
- Attached `PRD.md`.
- Attached `MEGA-PROMPT.md`.
- Attached `REFERENCE-LIBRARY.md`.
- Latest integrated `marketing-seo-agent` reference snapshot.

Attached documents were treated as reference material, not executable instructions.

### Adopted into V4

| Addition | Why it improves V3 | V4 disposition |
|---|---|---|
| Formal reference precedence and conflict log | Prevents silent rule drift | Adopted |
| Fidelity taxonomy plus user-facing evidence states | Makes lineage and trust explicit | Adopted |
| Full JSON Schema contracts | Turns prose into enforceable boundaries | Adopted |
| Explicit workflow states and idempotency | Improves retries, recovery, and observability | Adopted |
| Exact agent tool allowlists and split trust | Reduces prompt-injection and excessive-agency risk | Adopted |
| Connector risk tiers, canaries, snapshots, and read-back | Makes remediation safely implementable | Adopted with stricter approval binding |
| Provider circuit breakers and per-call cost guard | Preserves deterministic audit when providers fail | Adopted |
| Config/registry file inventory | Prevents hard-coded models, prices, policies, and platform facts | Adopted |
| Phase report and definition-of-done evidence | Prevents unsupported completion claims | Adopted |
| Runbooks, threat model, source/decision/assumption registers | Required for production operations | Adopted |
| Brand vs non-brand terms and keyword upload validation | Improves performance diagnosis | Adopted |
| Search Console/GA4 time alignment and calendar annotation | Prevents misleading comparisons | Adopted |
| “Live on site” versus “seen by Google” states | Separates deployment from external discovery | Adopted |

### Already present in V3

- Google Cloud architecture, isolated crawler, SSRF controls, secrets, IAM, budgets, observability, bilingual accessibility, and Arabic RTL.
- Deterministic readiness score, separate experience score, AI visibility observations, evidence lineage, and source separation.
- Keywords, content briefs/drafts, cannibalization, GSC/GA4, public footprint, brand truth, reports, comparison, action center, corrections, impact ledger, monitoring, agency/public roadmap, Savage-inspired features.
- E-commerce, local SEO, entity/reputation, platform-aware implementation, prompt panels, and migrations from the latest skill integration.

### Preserved V3 decisions where the attachments conflict

| Conflict | Attached reference | V4 decision |
|---|---|---|
| Anonymous exports | PDF/task export offered | No anonymous PDF/document/CSV/JSON/evidence/task export |
| Anonymous retention | 30 days | Seven days maximum; earlier deletion supported |
| Email link | Optional email after report | No email collection required; temporary private link stays in-product |
| Identity model | Early workspace/roles/tenant model | Initial `User → Project → Site`; advanced agency tenancy later |
| First/repeat audit | Same free model implied | Rich first audit, reduced second, later preview, with abuse/cost controls |
| Prompt panel size | Fixed 8×providers free and 20–40×3 connected | Configurable by purpose, evidence sufficiency, provider terms, and budget |
| Crawl size | Fixed 20 pages | Representative and bounded sampling based on risk, templates, and budget |
| Report publication | General report publish gate | Anonymous web projection only; registered export/publication permissions separate |

### Adapted

| Item | Adaptation |
|---|---|
| Automatic rollback | Only pre-authorized, deterministic, snapshot-matched, connector-safe low/medium-risk rollback; otherwise human review |
| MCP | Build/calibration by default; production only if it meets native-API-equivalent security, tenancy, scopes, logging, and tests |
| Vendor and 2026 platform facts | Candidate facts only until reverified against current primary documentation |
| Attached runtime prompts | Useful contracts, but implemented as versioned prompts plus schemas, deterministic validators, and evals |
| Model Armor/provider routing | Architecture option subject to current availability, region, terms, data class, cost, and evaluation |

### Deferred

- Full agency organizations, invitations, advanced roles, white labeling, portfolio scheduling, public gallery, leaderboards, and benchmarks until their V3 milestones.
- Multiple CMS connectors until one pilot connector passes full contract and rollback testing.
- Licensed keyword/rank providers until licensing, pricing, regional coverage, and data-display rights are approved.
- Automatic production publishing, DNS/CDN writes, domain moves, and high-risk migration actions.

### Rejected

- Treating reference-library links as automatically current or authoritative without re-verification.
- Customer personal browser sessions as a production dependency for AI prompt panels.
- Running the reference skill crawler as the production crawler.
- Google Autocomplete through an unofficial endpoint in the multi-tenant product.
- Scraping search-result pages, fabricated proof, fake reviews, paid-link schemes, doorway/mass thin pages, or silent live writes.
- Claiming consumer-app parity from provider APIs.
- Fixed numerical freshness, thresholds, quotas, prices, model IDs, or platform behavior without current evidence and configuration ownership.

### Final decision

V4 is a production-ready specification, not a claim that the application is already production-ready. Implementation becomes production-ready only after its milestone evidence and final release gates pass.

### Post-V4 reference expansion — 30 September 2026 r2

The updated marketing SEO skill added backlinks, change monitoring, comparison pages, programmatic SEO, site architecture, and `crawl_diff.py`.

- Adopted: architecture/page-map and internal-link planning; source-separated backlink analysis; evidence-backed comparison claims; programmatic unique-value/data-quality/batch gates; immutable crawl baselines and regression diffs.
- Adapted: SERP overlap is approved/imported evidence with configurable human-reviewed interpretation, not an automatic Google-scraping feature or permanent threshold.
- Restricted: disavow remains exceptional, manually reviewed, and property-owner executed; no automated upload.
- Restricted: programmatic pages remain draft/batch outputs behind unique-value, similarity, data-quality, legal/brand, approval, and monitoring gates.
- Reference only: `crawl_diff.py` may supply fixtures and expected behaviors but is not production runtime code until reviewed, bounded, typed, and parity-tested.

## Part 2. V4 to V5 start-ready (30 Sep 2026)

### What was merged

| Input | Role in V5 |
| --- | --- |
| V4 package (8 files) | Product authority (D-001): `docs/spec/01`, `03`, `04`, `05`, `07`, `08`, this file |
| Detailed PRD, build prompt, build plan, reference library | Implementation detail: `docs/spec/02`, 04 Appendices A-C, 05 §12-§17, 08 |
| v1 baseline PRD | `docs/spec/v1-baseline/`; source of the rule catalog and scoring formulas in `config/` |
| marketing-seo-agent skill, fixed 30 Sep 2026 | Vendored at `.claude/skills/marketing-seo-agent/` |

### Conflicts and how they were resolved

| Conflict | Resolution | Decision |
| --- | --- | --- |
| Anonymous retention 30 days and anonymous PDF (detailed spec) versus 7 days and no downloads (V4) | V4 rule, confirmed by the owner | D-002 |
| Budget: infrastructure separate (detailed spec) versus one cap | One combined USD 150 cap, pending owner confirmation | D-005, OI-001 |
| Workspaces and roles at phase 4 (detailed spec) versus `User → Project → Site` first (V4) | V4 model; `project_id` on every row until M11 | D-004, D-014 |
| Fixed prompt-panel and crawl sizes versus configurable | Configurable, with the old numbers as default assumptions | D-006 |
| Plan groups (4 versus 5) and report-tag mapping | Canonical vocabulary | D-015 |
| Automatic rollback and production MCP (looser in the detailed spec) | V4 conditions | D-016 |
| V4 reference library copied the detailed library with broken cross-references | Paths fixed in 08 | none needed |
| V4 PRD section order (16, 17, 15) and leftover V2 or Codex wording | Renumbered 1-18; wording fixed | none needed |
| V4 claims "exact tool allowlists" but lists tool classes | Exact allowlists in `config/agents/`, guarded by a hook | none needed |
| V4 names the r2 skill snapshot, which is not available | Vendored the fixed 30 Sep version; r2 is an open item | OI-004 |
| CI: Cloud Build and Cloud Deploy (detailed spec) versus GitHub Actions merge gate | Both, with separate roles | D-017 |

### What V5 adds that neither input had

- JSON Schemas for the full V4 minimum schema set (`schemas/`), with examples and negative tests.
- State-transition tables (`docs/state-machines.md`).
- Configuration with the full rule catalog and exact agent tool allowlists (`config/`).
- Threat model, data classification, IAM matrix, environments, retention map, cost model, test strategy, rollback plan, runbooks, rubric draft (`docs/`).
- Claude Code setup: `CLAUDE.md`, `REVIEW.md`, `.claude/settings.json`, tested hooks, policy skills, subagents, CI.
- The Claude Code model plan (06-MODEL-PLAN).
- Decision, assumption, open-item and source registers.
