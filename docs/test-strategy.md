# Test strategy

Status: draft for review
Owner role: Engineering lead (with the Security owner, Methodology owner and Accessibility owner)
Sources: 01-PRODUCT-REQUIREMENTS §8, §9, §12, §15; 03-PRODUCTION-CONTRACTS (release evidence); 04-CLAUDE-CODE-BUILD-PROMPT §6, §21, §24, §25; 05-PROJECT-PLAN M0A-M13, §7, §8, §11; 07-SKILLS-AND-AGENTS §2; 02-DETAILED-SPECIFICATION §6, §7, §15, §18, §19; v1-baseline §6, §16, §17; docs/decisions.md D-002, D-006, D-007, D-009
Last updated: 2026-09-30

## 1. Principles

- A control is real only when a test proves it. `docs/threat-model.md` maps each abuse case to a
  suite below.
- Deterministic results get expected-value tests. Model output gets evals. Neither replaces the other.
- A bug fix starts with a failing test committed first. The test-lock hook stops an agent from
  weakening it (`.claude/hooks/test_lock.py`).
- No milestone is complete from documentation, hooks or mocked integrations alone (05 §11).
- Test data: dev uses synthetic data only; staging uses test tenants and public labelled sites
  with owner permission (05 §8). Client exports never enter the repository; fixtures keep only
  what a test needs, with personal data removed.
- Report what was run honestly: passed, failed, not run (04 §24 phase report).

## 2. Layers

From 05-PROJECT-PLAN §7 and 02-DETAILED-SPECIFICATION §19. Tools are chosen at M0A and recorded
in `docs/decisions.md`.

| Layer | Covers | Runs in |
|---|---|---|
| Unit | Rules, formulas, parsing, normalization, scoring, filters, URL and IP classification, cost gates, retention dates | CI, every PR |
| Schema and config | JSON Schema validation, invalid-record rejection, config completeness (owner, source, checked date) | CI, every PR (`scripts/check_schemas.py`, `scripts/check_config.py`) |
| Golden files | Outputs of the skill's reference scripts on Phase 0 fixtures | CI when keyword, performance, report or extraction code changes |
| Adapter fixtures | Every imported or connected source (Search Console, GA4, keyword uploads, providers) | CI |
| Integration | Queues, workflows, storage, database, provider gateway, connectors against sandboxes | CI (emulators where possible) and staging |
| Security | SSRF, rendering isolation, XSS, prompt injection, CSV injection, authorization, OAuth, replay, supply chain, denial-of-wallet | CI and staging |
| Browser end-to-end | Core English and Arabic journeys, reports, approvals, consent, deletion | Staging |
| Accessibility | Automated checks plus manual keyboard, reflow, contrast, screen reader, PDF and RTL review | CI (automated), release (manual) |
| Agent evals | Fabricated metrics, sample generalization, readiness/presence confusion, unsupported content, stale policies, approval overreach | CI on relevant changes; nightly |
| Load and cost | Defined workloads with stopping thresholds; budget hard-stop simulation | Staging, before release |
| Operational drills | Rollback rehearsal, backup restore with re-deletion, incident drill | Staging, scheduled |

## 3. Suite catalog

Gate: **M** blocks merge; **R** blocks release to production; **N** nightly or scheduled.

| ID | Suite | Contents | First milestone | Gate |
|---|---|---|---|---|
| TS-UNIT | Unit | See layers | M0A | M |
| TS-SCHEMA | Schemas | Every schema validates its fixtures; one invalid record per schema is rejected; evidence immutability and hash checks | M0A / M0B | M |
| TS-CONFIG | Config | Required keys, owner/source/checked date, no model IDs or prices in code (D-010) | M0A | M |
| TS-HOOK | Claude Code hooks | Each hook blocks its target and allows the benign case | M0A | M |
| TS-IAC | Infrastructure policy | Terraform validate; IAM invariants in `docs/iam-matrix.md` §6; no service-account keys; log-bucket retention; firewall denies | M0B | M |
| TS-SUPPLY | Supply chain | Lockfile integrity, dependency and image vulnerability scan, pinned base images, forbidden imports of skill scripts into `services/` | M0A | M |
| TS-GOLDEN | Golden files | §6.4 | M2 (M4 for keyword files) | M |
| TS-METRIC | Expected-value metric fixtures | §6.3 | M4 (AI rates M6) | M |
| TS-SCORE | Score reproduction | Category and readiness formulas, critical caps, coverage and confidence, "checked X of Y", independent recomputation of headline numbers | M0B (one score), M2 (full) | M |
| TS-SSRF | SSRF and DNS rebinding | §6.1 | M1 | M, R (staging network run) |
| TS-RENDER | Renderer isolation | Subresource validation, disabled features, resource caps | M1 | M, R |
| TS-MALSITE | Malicious-site fixtures | Injection text, XSS payloads, decompression bombs, tarpits, redirect loops, cloaking, robots-blocked, oversized | M1 | M |
| TS-XSS | Output encoding | Evidence and model text rendered as text; CSP present; link schemes | M3 | M |
| TS-CSVINJ | Export injection | Formula-prefixed cells escaped in CSV; document and PDF exports built from the report model | M3 (registered exports) | M |
| TS-INJ | Prompt injection | Injection fixtures cannot change a score, create a change set, trigger a write, reveal data or alter report scope (02 §19, v1-baseline §16.3) | M2 | M |
| TS-ALLOWLIST | Agent tool allowlists | No agent that reads untrusted content has a write-class tool; tools take scope from job context | M0B | M |
| TS-AUTHZ | Authorization | Two-user IDOR matrix on every record and object type; signed URL scope; admin and scheduler limits; cross-tenant at M11 | M3 (anonymous), M4 | M |
| TS-ANON-ACCESS | Anonymous access | §6.2 | M3 | M, R |
| TS-ANON-EXPORT | Anonymous export denial | §6.2 | M0B (one denial), M3 | M, R |
| TS-ELIG | Eligibility | Rich, reduced, preview, refused, suspicious; shared-IP fairness; cookie loss and tampering; evidence reuse isolation; challenge escalation and accessible fallback | M3 | M, R |
| TS-COST | Cost controls | Pre-call check, per-audit soft/hard caps, breakers (3 failures, 15-minute cool-down, one probe; D-007), monthly hard stop within one cost-guard cycle, anonymous sub-budget under abuse, "unavailable" never 0% | M0B (simulation), M6 | M, R |
| TS-LOGREDACT | Log and payload redaction | Canary secrets, emails, URLs and page text never appear in logs, analytics events or provider payloads | M1 | M |
| TS-OAUTH | OAuth | State, PKCE where applicable, token encryption, rotation, revocation on disconnect, narrow scopes | M4 | M |
| TS-APPROVAL | Approval binding | Replay, expiry, stale state, wrong tenant, self-approval, double apply on retry, edit versus publish | M9 | M, R |
| TS-CONNECTOR | Connector contract | Sandbox contract, denial, stale-state, conflict, partial failure, read-back mismatch, slug/redirect bundling, rollback (01 §15, 05 M9) | M9 | R |
| TS-WEBHOOK | Webhooks | Invalid signatures and replayed IDs rejected | M9 | M |
| TS-DELETE | Retention and deletion | Expiry and user deletion across every store in `docs/retention-deletion-map.md`; receipts complete; nothing past `expires_at` | M0B (design), M3 | M, R |
| TS-DR | Restore and re-delete | Restore a backup to an isolated instance; the deletion queue re-applies before serving | M10 | N, R (M13) |
| TS-PARITY | Report parity | Web, PDF, document, CSV, JSON and chart numbers agree with the canonical report model (01 §12) | M3 | M, R |
| TS-E2E | Browser journeys | English and Arabic: audit, report, delete, expiry, eligibility messages; later registration, claim, approvals, consent | M3 | R |
| TS-A11Y-AUTO | Automated accessibility | WCAG 2.2 AA automated subset on every page state | M3 | M |
| TS-A11Y-MANUAL | Manual accessibility | §6.6 | M3 | R |
| TS-AR-REVIEW | Arabic native review | §6.6 | M3 | R |
| TS-EVAL-AGENT | Product-agent evals | §6.5 | M2 (auditor), per agent milestone | M (on relevant changes), N |
| TS-EVAL-BUILD | Build-agent evals | Real repository tasks with accepted outcomes; run on changes to `CLAUDE.md` or `.claude/**` (cases under `evals/`) | M0A | M (on relevant changes), N |
| TS-RUBRIC | Experience rubric calibration | Two-reviewer agreement on Phase 0 sites (`docs/rubrics/experience-effectiveness.md` §6) | M5 | R |
| TS-MONITOR | Monitoring | Unchanged state stays quiet; material changes alert with evidence; schedules cannot broaden scope | M10 | M |
| TS-GALLERY | Public gallery | Consent, redaction, revocation, leakage | M12 | R |
| TS-TONE | Tone invariance | Identical evidence, scores, severity and priority across tones | M12 | M |
| TS-LOAD | Load and cost | Defined workloads including a scripted abuse run; stopping thresholds | M0B (cost), M13 | R |
| TS-ROLLBACK | Rollback rehearsal | `docs/rollback-plan.md` §9 | M0A (first harmless change) | N (weekly), R |

## 4. Gates

**Merge gate (every pull request).** `.github/workflows/ci.yml` already runs hook tests,
`scripts/check_schemas.py`, `scripts/check_config.py`, a secret scan, and, once `package.json`
exists, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:ssrf`. The full merge gate is:
lint, typecheck, TS-UNIT, TS-SCHEMA, TS-CONFIG, secret scan, TS-HOOK, TS-SUPPLY, and every suite marked M that the change can affect. Security-critical suites
(TS-SSRF, TS-ANON-EXPORT, TS-ALLOWLIST, TS-AUTHZ, TS-LOGREDACT) run on every pull request once
they exist, regardless of the changed paths. Changes to prompts, `config/providers.yaml` or
`config/rules/*.yaml` also run TS-EVAL-AGENT against the pass-rate threshold
(`<DECIDE_AT_M0A: eval threshold>`). Changes to `CLAUDE.md` or `.claude/**` run TS-EVAL-BUILD
and TS-HOOK.

**Release gate (staging to production).** All merge suites green on the release commit, plus
every suite marked R for the milestone, the manual accessibility and Arabic sign-offs for changed
user-facing surfaces, a rollback rehearsal on the release candidate, and the release evidence in
03-PRODUCTION-CONTRACTS. A named human authorizes the release; agent output cannot approve its
own release (05 §8).

**Scheduled.** Nightly: TS-EVAL-AGENT, TS-EVAL-BUILD, integrity recomputation of scores and
lineage coverage. Weekly: TS-ROLLBACK in staging (ASSUMPTION, `docs/rollback-plan.md`). Monthly:
TS-DR (ASSUMPTION), price and policy-fact review.

## 5. Milestone mapping

| Milestone | Exit evidence required from tests |
|---|---|
| M0A | Clean checkout runs lint, typecheck, TS-UNIT, TS-SCHEMA, TS-CONFIG, secret scan, TS-HOOK; results recorded (05 M0A) |
| M0B | Reproduce one score (TS-SCORE); reject one invalid record (TS-SCHEMA); trace one report number (lineage fixture); deny one unauthorized export and one unauthorized write (TS-ANON-EXPORT, TS-ALLOWLIST); simulate the USD 150 hard stop (TS-COST, `docs/cost-model.md` §7) |
| M1 | TS-SSRF, TS-RENDER, TS-MALSITE, TS-LOGREDACT; no internal or metadata reachability; secrets and databases inaccessible from crawl identities (TS-IAC) |
| M2 | TS-SCORE full, TS-GOLDEN (extraction), TS-INJ; invalid data cannot produce valid-looking results |
| M3 | TS-ANON-ACCESS, TS-ANON-EXPORT, TS-ELIG, TS-PARITY, TS-XSS, TS-DELETE, TS-E2E, TS-A11Y-AUTO, TS-A11Y-MANUAL, TS-AR-REVIEW |
| M4 | TS-METRIC (Search Console/GA4), TS-GOLDEN (keywords, cannibalization), TS-OAUTH, TS-AUTHZ; claim does not grant domain or connector authority |
| M5 | TS-RUBRIC; experience results stay distinguishable from deterministic findings |
| M6 | TS-METRIC (AI rates), TS-COST (breakers, provider failure), TS-EVAL-AGENT (readiness/presence confusion) |
| M7 | TS-EVAL-AGENT: no fabricated reviews or counts; sources and confidence visible |
| M8, M8A-C | TS-EVAL-AGENT: fabricated claims and citations rejected; cannibalization checks precede new pages; specialist fixtures (05 M8A-C exits) |
| M9 | TS-APPROVAL, TS-CONNECTOR, TS-WEBHOOK, TS-ROLLBACK for connector writes |
| M10 | TS-MONITOR, TS-DELETE (scheduled), TS-DR, TS-COST (breakers in schedules) |
| M11 | TS-AUTHZ cross-tenant; bulk work stays budgeted and scoped |
| M12 | TS-GALLERY, TS-TONE |
| M13 | TS-LOAD, TS-COST at planned volume, penetration test, TS-DR, incident and rollback drills, full manual accessibility and Arabic review |

## 6. Suite details

### 6.1 SSRF and DNS rebinding (TS-SSRF)

Sources: 04 §6, v1-baseline §13.1, §16.3, §17.3, 02 §17. The suite runs the URL validator in
unit form on every pull request and runs the real crawl job against a controlled test range in
staging before release.

- Schemes: `file`, `ftp`, `gopher`, `data`, `javascript`, `ws`, `wss` rejected; only `http` and `https`.
- Credentials in URLs rejected; ports outside the allowlist rejected.
- IPv4: loopback, private, shared address space, link-local including the metadata address,
  multicast, reserved, documentation, "this network" and broadcast ranges rejected.
- IPv6: loopback, unique local, link-local, IPv4-mapped and IPv4-embedding forms that carry a
  private IPv4 address rejected.
- Encodings: decimal, octal, hexadecimal, short and mixed forms, trailing dots, case variants and
  internationalized hostnames normalize before checks.
- Metadata hostnames rejected by name and by address.
- DNS rebinding: a controlled resolver returns a public address at validation and a private one
  at connection; mixed public/private answers; private AAAA with public A. All rejected; the
  connection uses the pinned validated address.
- Redirects: public to private, to a non-HTTP scheme, loops, over the hop limit; each hop re-validated.
- Sitemap entries and discovered links to private addresses or other hosts are not fetched.
- Renderer: subresources, iframes, fetch calls and WebSocket attempts to private addresses are blocked.
- Limits: oversized responses, decompression bombs, slow-drip responses, page, depth and duration caps.
- Isolation: from inside the crawl job, attempts to reach the app database, Secret Manager or app
  APIs fail; the runtime token can only create landing objects.

The skill's `page_audit.py` contains a hardened fetcher (30 Sep 2026). Its behavior may seed
expected results, but production code is the product crawler only (D-009).

### 6.2 Anonymous access and export denial (TS-ANON-ACCESS, TS-ANON-EXPORT)

- For every export route and format (PDF, document, CSV, JSON, evidence bundle, task export,
  full-report copy, any server-side print route, any signed-URL issuance): anonymous callers are
  denied server-side with and without a valid anonymous access secret, with an expired secret and
  with a deleted audit. No object is created, no signed URL issued, and an audit-log entry is
  written. A registered owner with an export authorization succeeds (positive control).
- The anonymous report API returns only the web projection; bulk raw evidence is not exposed.
- The anonymous report UI has no download controls (TS-E2E).
- Links: audit IDs and secrets are unguessable; a secret for audit A never opens audit B; the
  secret never appears in server, load-balancer or analytics logs (canary check); `noindex` is
  present; access fails after 7 days and immediately after deletion.
- Claim after registration (M4): the claim works within 7 days, grants report access only, and
  never grants domain verification or connector authority.

### 6.3 Expected-value metric fixtures (TS-METRIC)

Each fixture states grain, scope, numerator, denominator, formula, filters, timezone and missing
behavior (01 §8). Examples:

| Fixture | Input | Expected |
|---|---|---|
| Aggregate CTR from totals | Row A: 10 clicks, 100 impressions; row B: 0 clicks, 900 impressions | 10 / 1000 = 1.0%, not the mean of row CTRs (5.0%) |
| Impression-weighted position | Position 2 with 100 impressions; position 12 with 900 impressions | (2 x 100 + 12 x 900) / 1000 = 11.0 |
| Rate change | CTR 2.0% then 3.0% | +1.0 percentage points (shown separately from +50% relative) |
| Zero denominator | 0 impressions | CTR `unavailable`, not 0% |
| Zero base | Clicks 0 then 40 | Shown as "new", not an infinite percentage (02 §15) |
| Period alignment | Search Console dates in Pacific Time, GA4 in property timezone; last 2-3 Search Console days | Compared periods equal length; recent days flagged incomplete (02 §15) |
| No mixed sources | Volume from two providers | Figure blocked (02 §19) |
| Keyword volume without source | Volume present, source or period missing | Stored as unknown, never zero (02 §7) |
| AI valid denominator | 8 prompts x 5 providers; 2 providers failed | Denominator 24; failures excluded; shown as counts (v1-baseline §6.7) |
| No valid responses | All providers failed | `unavailable`, not 0% |
| Small cells | Fewer than 10 runs in a cell | Counts, not percentages (02 §6) |
| Branded prompts | Branded prompt mentions the brand | Excluded from recommendation rate (v1-baseline §6.7) |

### 6.4 Golden files from the skill scripts (TS-GOLDEN, Phase 0)

Phase 0: before product code, the SEO lead runs the vendored skill
(`.claude/skills/marketing-seo-agent/`, fixed 30 Sep 2026) on the labelled sites and corrects the
outputs. ASSUMPTION: 10 sites (02 §19 names 10 hand-reviewed audits), including an Arabic RTL
site, a site with broken technical SEO, a JavaScript-heavy site, a CDN that blocks AI crawlers and
a site with cannibalized pages. The corrected outputs become golden files under `evals/golden/`
and the labelled set for agent evals.

| Script | Golden output | Product code it checks |
|---|---|---|
| `arabic_keywords.py` | Normalized keys and merged metrics (CTR from totals, impression-weighted position), with and without `--merge-prefixes` | Keyword ingest and Arabic matching normalization |
| `cannibalization.py` | Conflict lists from page+query fixtures (thresholds recorded with the file) | Cannibalization detection |
| `page_audit.py` | Extraction JSON from saved HTML fixtures (`--html-file`), offline | Extraction and rule inputs |
| `build_report.py` | HTML structure: RTL detection, table alignment, severity markers, chart data (not bytes or dates) | Report rendering and parity |

Rules:

- Goldens are produced from saved fixtures, not live fetches, so they are reproducible.
- `suggest.py` never produces platform data or golden files (D-009).
- A difference between product output and a golden file is either fixed or logged as a decision
  (for example, definite-article grouping happens at clustering, not normalization, 02 §7).
- When the skill is updated, the goldens are re-run and every difference becomes an intent.
- 04 §25 names `crawl_diff.py` as a reference and fixture generator; it is not in the fixed
  30 Sep 2026 skill snapshot, so change-monitoring goldens wait until it is supplied.

### 6.5 Agent evals (TS-EVAL-AGENT)

Sources: 05 §7, 02 §19, 07 §2. Each agent gets eval cases on the Phase 0 labelled set:

- fabricated metrics or numbers without a tool source;
- generalizing from a sample to a site-wide claim;
- confusing Presence Readiness with observed AI visibility or search performance (D-012);
- unsupported content: facts not in the fact register, invented citations, reviews, prices;
- stale policy facts used after expiry;
- approval overreach: proposing to apply, publish or widen scope;
- injection fixtures (with TS-INJ);
- Arabic output: dialect assumptions flagged, normalization never rewriting evidence;
- tone invariance (M12, with TS-TONE).

Thresholds: `<DECIDE_AT_M0A: eval pass-rate threshold>`; any drop is reviewed before merge.
Every production incident adds a case.

### 6.6 Accessibility and Arabic manual review (TS-A11Y-MANUAL, TS-AR-REVIEW)

- Target WCAG 2.2 AA with recorded verification (01 §9). Automated checks do not establish
  conformance (v1-baseline §14).
- Manual checks per release for changed surfaces: keyboard-only flow and visible focus, screen
  reader in both languages, reflow and 200% zoom, contrast, reduced motion, error messages linked
  to fields, progress announcements, tables with captions and headers, charts with text
  alternatives, PDF reading order and selectable text (registered exports).
- RTL: `lang` and `dir`, logical CSS, bidi isolation of URLs, code, model names and formulas,
  Arabic reading and focus order (v1-baseline §16.5, 04 §20).
- Arabic native review: every user-facing Arabic string and generated Arabic content is reviewed
  by a native reviewer; findings recorded with the release evidence.
- Screen-reader and browser matrix: `<DECIDE_AT_M3>`.

## 7. Evidence

Each release records suite results, commands run, versions, failures and waivers in the release
evidence (03-PRODUCTION-CONTRACTS). A waiver names the owner, the risk and the expiry date.
Flaky tests are quarantined only with an owner and a fix date; a quarantined security suite
blocks release.

## 8. Open decisions

- `<DECIDE_AT_M0A: test runners and tools>`, `<DECIDE_AT_M0A: eval pass-rate threshold>`.
- `<DECIDE_AT_M0B: controlled DNS rebinding test infrastructure in staging>`.
- `<DECIDE_AT_M3: screen-reader and browser matrix>`.
- Phase 0 site list and owner permissions (02 §19); `crawl_diff.py` availability.
