# Website Presence Intelligence — Skills and Agents (V5 start-ready, based on V4)

Status: production implementation aid. It does not grant access, connector scopes, spending, publishing rights, or production authority.  
V5 adaptation status: draft for review. §10 maps the V4 roles to the runtime agent configs in this repository; §11 lists the Claude Code build-time skills and subagents.

## 1. Design decision

Use one orchestration layer with narrow workers. Keep deterministic calculations, security gates, approvals, and data-integrity enforcement outside LLM discretion. An agent can propose a change; only policy-enforced workflows can authorize and execute it.

## 2. Skill catalog

| Skill | Required behavior | Key prohibitions | Primary evals |
|---|---|---|---|
| Scope and capability intake | Establish site, market, language, business goal, evidence, permissions, and missing states | No long generic questionnaire; no assumed client | capability manifest accuracy |
| Secure site audit | Sample or crawl approved public URLs; preserve response evidence | No private networks, bypass, uncontrolled redirects, or site-wide claims from samples | SSRF, scope, sampling |
| Technical SEO | Crawlability, indexability, canonicals, hreflang, schema, performance evidence | No index claims without first-party evidence | rule fixtures and lineage |
| Keyword and competitor research | Preserve source metrics; cluster intent; distinguish competitor types | No invented volume, difficulty, traffic, authority, or rank history | missing metrics, clustering |
| Page ownership and cannibalization | Identify one intended owner per cluster from compatible evidence | No automatic merge/delete | owner and conflict fixtures |
| Arabic market SEO | Query variants, RTL, hreflang, localization, seasonal context | No dialect assumptions; normalization never rewrites evidence | native review, variant tests |
| AEO/GEO assessment | Separate Access, Parse, Act, Footprint, Observed presence | No readiness-to-visibility inference | provider and evidence-state evals |
| AI prompt-panel operations | Evidence-built prompts; reproducible multi-engine runs; explicit omissions | No personal-account dependency or single-run visibility claims | denominator, repeat, provider-failure evals |
| E-commerce SEO | Catalog, facets, variants, lifecycle, schema, feeds, Merchant Center, policy facts | No revenue uplift or feed metrics without compatible evidence | reconciliation and applicability fixtures |
| Local SEO | Profiles, locations/service areas, NAP, reviews, local SERPs and AI answers | No citywide rank inference from one location | public/owner state and location fixtures |
| Entity and reputation | Confirmed fact register, cited-source tracing, legitimate corrections | No fake reviews, undisclosed paid editing, or invented notability | fact-conflict and escalation evals |
| Platform capability | Resolve fixes for Shopify, Salla, Zid, WooCommerce, Magento, Webflow, headless | No write plan from provisional platform detection | platform/version capability fixtures |
| Migration control | Baseline, inventory, redirect map, parity, go/no-go, rollback, monitoring | No zero-loss promise or unverified completion claim | redirect, parity, rollback scenarios |
| Site architecture | Owner-page map, hierarchy, navigation, URLs, internal links, language/market variants | No page per keyword variant or URL change outside migration control | ownership, overlap, orphan, hand-off fixtures |
| Backlink analysis | Source-separated exports, anchors, targets, loss/reclamation and gap review | No synthetic health score, automated disavow, buying, or outreach without authority | source separation and disavow-boundary tests |
| Comparison pages | Fair, dated, sourced comparisons with claim freshness and review | No invented competitor facts, ratings, or implied endorsement | claim, freshness, trademark and schema evals |
| Programmatic SEO governance | Unique value, record quality, templates, similarity, batches, monitoring | No doorway/thin pages or uncontrolled publishing | duplicate, missing-data, canary and stop-condition tests |
| Change monitoring | Immutable baselines, deterministic diffs, confirmation and release linkage | No traffic inference or automatic regression verdict from a diff alone | snapshot parity and severity/review fixtures |
| Organic performance diagnosis | Align periods and sources; reproduce CTR/position/change metrics | No averaged row CTR; no incompatible source totals | expected-value fixtures |
| Content strategy and briefing | Evidence-linked briefs; prefer improving an owner page | No fabricated facts, proof, reviews, urgency, or citations | grounding and claim checks |
| Bilingual report composition | One dataset to EN/AR web, PDF, document, CSV, JSON | No retyped chart numbers or hidden missing data | parity and RTL checks |
| Change planning | Exact IDs, current state, diff, risks, rollback, validation | No write from a recommendation | stale-state and conflict tests |
| Change execution | Apply exact, unexpired approval; canary; read-back | No implicit publish or scope expansion | idempotency, read-back, rollback |
| Monitoring | Compare like with like; notify only on material action | No noisy unchanged notifications | meaningful-change fixtures |
| Policy and cost governance | Provider registry, budgets, retention, circuit breakers | No self-expanded budgets or provider scopes | budget and expiry tests |

## 3. Agent topology

```text
Human owner / approver
        │
        ▼
Intake & Capability Coordinator
        │ immutable evidence IDs + typed jobs
        ├── Secure Crawl Worker
        ├── Keyword & SERP Analyst
        ├── AEO/GEO Observer
        ├── Commerce & Feed Analyst
        ├── Local Presence Analyst
        ├── Entity & Reputation Analyst
        ├── Platform Capability Resolver
        ├── Migration Controller
        ├── Architecture Strategist
        ├── Backlink Analyst
        ├── Comparison Claim Reviewer
        ├── Programmatic SEO Governor
        ├── Change Monitor
        └── First-party Data Readers
                     │
                     ▼
        Integrity & Methodology Reviewer
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
Deterministic Audit       Content Strategist
          └──────────┬──────────┘
                     ▼
              Report Composer
                     ▼
               Change Planner
                     ▼ exact approval gate
               Change Executor
                     ▼
              Release Verifier
```

The Arabic market reviewer is a mandatory review role whenever Arabic is in scope. The policy and cost governor can stop any stage but cannot approve a business change.

## 4. Handoff contract

Every agent output must include:

- `job_id`, `project_id`, target site, market, language, and capture time;
- input evidence IDs and their integrity states;
- method/rule/prompt/provider version;
- result state: verified, inferred, not verified, or unavailable;
- source tier for external claims;
- limitations and missing inputs;
- recommended next action and whether human review is required;
- cost, duration, and retry metadata where applicable;
- no executable instructions copied from crawled content.

## 5. Recommended connectors

Availability must be confirmed during implementation. MCP is preferred only when the server exposes exact tools, auth, scopes, and auditability needed; otherwise use the provider’s supported API through a narrow adapter.

| Priority | Connector | Default mode | Write gate |
|---|---|---|---|
| 1 | Google Search Console | read-only | not applicable |
| 2 | GA4 | read-only | not applicable |
| 3 | Cloud Storage / approved file intake | scoped read/write to project objects | object policy and retention |
| 4 | GitHub/GitLab/Bitbucket | read; then pull-request draft | exact repository/branch approval |
| 5 | One pilot CMS | read; then draft-only | exact resource and field approval |
| 6 | Keyword-data provider | read-only | cost/license approval |
| 7 | CDN/DNS | read-only initially | separate high-risk authorization |
| 8 | Google Business Profile | read-only first | exact profile/field approval; owner-controlled verification |
| 9 | Google Merchant Center / Merchant API | read-only first | exact account/data-source/item approval |
| 10 | Shopify, Salla, Zid, WooCommerce, Magento, Webflow | read; then draft or narrow change | exact store/site/item/field and publish approval |

For each connector record provider, installation state, owner, auth method, exact scopes, target resources, rate limits, data classes, read/write tools, approval policy, audit-log behavior, staging support, test status, and fallback.

## 6. Approval boundaries

- Crawl consent does not grant CMS access.
- Read access does not grant write access.
- A report recommendation does not approve a change.
- Edit approval does not approve publication.
- One resource approval does not authorize a template or bulk change.
- A schedule does not authorize crossing a write gate.
- A successful canary does not authorize unlisted targets.

## 7. Attached skill disposition

The 30 September 2026 package contributed domain patterns, report structure, Arabic handling, CMS safeguards, and specialist playbooks for e-commerce, local SEO, entity/reputation, platforms, AI prompt panels, and migrations. This repository vendors the version fixed on 30 September 2026 at `.claude/skills/marketing-seo-agent/`. It does not yet include the later r2 references (backlinks, comparison pages, programmatic SEO, site architecture, change monitoring, `crawl_diff.py`) or the e-commerce, local, entity, platform and migration references that V4 attributes to the skill release; adding them is an open item (`docs/open-items.md`).

Its scripts remain reference prototypes, not application runtime components. The crawler is not production-safe without the product's SSRF, DNS-rebinding, redirect-chain, egress, size, timeout, and isolation controls. Time-sensitive provider, platform, schema, Merchant Center, Business Profile, shopping, and migration claims must enter the policy-fact registry and be reverified against primary sources before release or client-facing use.

## 8. Ownership required before build

Assign named accountable owners for product, methodology, security, privacy, data integrity, Arabic editorial quality, cloud billing, provider policy, connectors, content approval, production publishing, accessibility, and incident response. A person may hold multiple roles, but proposer, approver, and executor must remain separated for consequential changes.

## 9. Claude Code development skills and controls

- Repository governance through root and scoped `CLAUDE.md` files.
- Versioned project skills with explicit triggers, contracts, validators, fixtures, and owners.
- Reviewed `.claude/settings.json` permissions for shell, filesystem, network, MCP, secrets, destructive actions, and production.
- Deterministic hooks for secret scanning, forbidden-command checks, schema validation, formatting, generated-file consistency, and test gates. Hooks never substitute for runtime application authorization.
- Subagents are optional, least-privilege, and assigned disjoint tasks. They cannot approve, merge, release, or widen their own permissions.
- MCP servers are treated as untrusted connectors and require pinned configuration, scoped authentication, output validation, and auditability.

## 10. Runtime agents in this repository

The machine-readable definitions are `config/agents/<name>.yaml` (tools, forbidden tools, milestone, model tier). The `agent_allowlist_guard` hook blocks any write-class tool in those files. Runtime instructions are in 04-CLAUDE-CODE-BUILD-PROMPT Appendix A.

| V4 role (§3, 03 tool boundaries) | Config file | Built at |
| --- | --- | --- |
| Intake and Capability Coordinator | `intake-coordinator.yaml` | M2 |
| Audit assessor / Deterministic Audit (semantic rules) | `auditor.yaml` | M2 |
| Keyword and SERP Analyst | `keyword-analyst.yaml` | M4 |
| Search Console and Analytics Analyst / Performance analyst | `performance-analyst.yaml` | M4 |
| AEO/GEO Observer / Visibility observer | `visibility-tester.yaml` | M6 |
| Planner | `planner.yaml` | M3 |
| Report and Comparison Composer | `report-writer.yaml` | M3 |
| Entity and Reputation Analyst | `entity-analyst.yaml` | M7 |
| Content Strategist | `content-strategist.yaml` | M8 |
| Commerce and Feed Analyst | `commerce-analyst.yaml` | M8A |
| Local Presence Analyst | `local-analyst.yaml` | M8A |
| Architecture Strategist, Backlink Analyst, Comparison Claim Reviewer, Programmatic SEO Governor, Change Monitor | `architecture-strategist.yaml`, `backlink-analyst.yaml`, `comparison-reviewer.yaml`, `programmatic-governor.yaml`, `change-monitor.yaml` | M8C |
| Change Planner | `fixer.yaml` | M9 |
| Release Verifier (verification of applied changes) | `verifier.yaml` | M9 |
| Change Executor | Not an agent: the deterministic connector service | M9 |
| Policy, Privacy and Cost Governor | Not an agent: the deterministic cost guard and policy checks | M0B onward |
| Arabic Market Reviewer, Integrity and Methodology Reviewer | Human review roles, supported by checks | Every milestone with Arabic or scoring in scope |

The Platform Capability Resolver, Migration Controller and Prompt Panel Methodologist roles (§3 and 05-PROJECT-PLAN §10) have no config file yet; add them when M8A, M8B and M6 are designed.

## 11. Claude Code build-time skills and subagents

These steer Claude Code while it builds the product. They are separate from the runtime agents above.

| Skill (`.claude/skills/`) | Use |
| --- | --- |
| `intent-spec-plan` | Writes `intent.md`, `spec.md` and `plan.md` from the templates and stops for approval |
| `security-baseline` | SSRF, secrets, isolation, split trust |
| `data-integrity` | Fidelity labels, lineage, aggregation rules |
| `cost-guard` | Paid-call caps, circuit breakers, degradation order |
| `connector-safety` | Risk tiers, approvals, snapshots, idempotency, read-back |
| `google-search-guidance` | Google Search Central precedence and the forbidden-tactics list |
| `arabic-rtl-a11y` | `lang`, `dir`, bidi, WCAG 2.2 AA, Arabic PDF shaping |
| `marketing-seo-agent` (vendored, fixed 30 Sep 2026) | SEO method reference; scripts are reference implementations and golden-file generators only (D-009) |

Subagents (`.claude/agents/`): `security-reviewer`, `cost-reviewer`, `verifier`, `test-writer`, `seo-method-checker`, `rtl-a11y-checker`, `docs-registrar`. Their models, tools and the milestones that use them are in 06-MODEL-PLAN §3 and §4.

## Changes from V4

- Title changed.
- Added V5 status note.
- Skill snapshot path corrected; missing r2 and specialist references flagged.
- Added §10 (runtime agent mapping) and §11 (Claude Code build-time skills and subagents).
