# Threat model

Status: draft for review
Owner role: Security owner
Sources: 01-PRODUCT-REQUIREMENTS §5.0, §5.13, §5.17, §5.19, §8, §9, §10, §12, §15; 03-PRODUCTION-CONTRACTS (agent tool boundaries, change risk baseline); 04-CLAUDE-CODE-BUILD-PROMPT §3.1, §6, §13, §15, §19, §24; 05-PROJECT-PLAN M0, M0B, M1, M4, M9, M11, §7, §8; 07-SKILLS-AND-AGENTS §6, §9; 02-DETAILED-SPECIFICATION §12, §13, §17, §18, §20; v1-baseline §13, §21; docs/decisions.md D-002, D-004, D-005, D-006, D-007, D-009
Last updated: 2026-09-30

## 1. Purpose

This document names what WPI protects, where trust changes, how each boundary can be abused,
which control stops the abuse, and which test proves the control works. Test IDs refer to suites
in `docs/test-strategy.md`. A control without a passing test is a plan, not a control.

Review points: M0B baseline; before each milestone that adds a boundary (M1 crawler, M4
registration and Search Console/GA4, M6 providers, M9 first connector, M11 agency tenancy, M12
gallery); after every security incident; after any change to `docs/iam-matrix.md`.

Method: trust boundaries first, then abuse cases per boundary. Impact ratings are initial
judgments. ASSUMPTION: ratings are re-done at M0B with the named security owner.

## 2. Assets

| ID | Asset | Data class (`docs/data-classification.md`) | Why it matters |
|---|---|---|---|
| A-01 | Monthly budget (USD 150 combined cap, D-005) | n/a | Exhausting it stops paid features for everyone and can exceed the owner's limit |
| A-02 | Anonymous report, its audit context and its access secret | C2, C5 | Private by default (D-002); leakage exposes visitor intent and context |
| A-03 | Evidence and scores (integrity) | C1, C3 | Wrong evidence produces wrong advice; reused evidence spreads the error |
| A-04 | Registered project data, fact register, keyword uploads | C3 | Tenant-private business data |
| A-05 | Search Console and GA4 data | C4 | Tenant-private, contains query and landing-page data |
| A-06 | CMS/Git credentials, OAuth tokens, provider API keys, signing keys | C5 | Direct write power or spend power |
| A-07 | Change sets, approvals, snapshots | C3 | Control live client sites |
| A-08 | Methodology, rules, weights, eligibility and cost config | Internal | Tampering changes every score or every limit |
| A-09 | Audit log (access, approval, execution, publication, deletion) | C8 | Accountability; must be append-only |
| A-10 | Personal data (registered user identity, security logs with IP) | C7 | Legal obligations; minimization |
| A-11 | Cloud runtime identities and metadata tokens | C5 | Pivot into the platform |
| A-12 | Repository, CI pipeline, Claude Code sessions | Internal | Supply chain for everything above |
| A-13 | Public gallery projections (M12) | C0 after consent | Publication without consent or with private data |
| A-14 | Availability for legitimate visitors | n/a | Abuse controls can wrongly refuse real users |

## 3. Trust boundaries

| ID | Boundary | What crosses it | Main risks |
|---|---|---|---|
| TB-01 | Anonymous visitor to edge and web/API | URLs, business context, cookies, report requests | Denial-of-wallet, link guessing, export bypass, injection into stored data |
| TB-02 | App project to crawl sandbox, and sandbox to the internet | Crawl jobs out; raw evidence back through a landing bucket | SSRF, DNS rebinding, renderer escape, evidence tampering |
| TB-03 | App to AI providers (through the provider gateway) | Prompts out; answers and citations back | Data leakage to providers, spend, injected answers |
| TB-04 | Connector and source reader to CMS/Git/Search Console/GA4 | OAuth tokens, reads, approved writes | Confused deputy, stale writes, replay, token theft |
| TB-05 | Runtime agents to untrusted content | Crawled text, provider answers, MCP output reach model context | Prompt injection, excessive agency, score tampering |
| TB-06 | Registered user to tenant data (M4+), tenant to tenant (M11+) | Record IDs, object paths, signed URLs | Cross-tenant access, IDOR |
| TB-07 | Admin and operators to admin console and cloud projects | Admin actions, break-glass | Misuse, account takeover |
| TB-08 | CI and Claude Code to repository and cloud | Code, config, deploys | Injected instructions, secret exposure, unreviewed release |
| TB-09 | Inbound webhooks and schedules to orchestration (M9, M10) | Events, timers | Forgery, replay, scope broadening |

The crawl sandbox, agents, provider gateway and reports never hold CMS/Git write credentials.
Only the deterministic `connector` service can change a client site (03-PRODUCTION-CONTRACTS).

## 4. Abuse cases, controls and proving tests

Each row lists mitigations, where each is implemented, and the test suite that proves it.

### 4.1 TB-01 Anonymous visitor

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-01 | Denial-of-wallet on the anonymous rich audit: a script requests many rich audits with fresh cookies from rotating IPs, each spending up to the USD 4.00 hard cap (D-007) | Pre-call cost check on every paid call (provider gateway, cost ledger); per-audit soft/hard caps (D-007); a separate anonymous paid-call sub-budget with daily pacing (`docs/cost-model.md` §6); monthly hard stop (cost guard); velocity, automation and domain signals with CAPTCHA and slower queue (`docs/anonymous-eligibility-policy.md`, `config/anonymous-eligibility.yaml`); paid AI calls run only after the crawl proves a real, reachable site; same-domain evidence reuse with capture time disclosed; Cloud Armor rate limits at the edge | TS-COST (hard-stop simulation, pacing, per-audit caps), TS-ELIG (velocity and CAPTCHA escalation), TS-LOAD (abuse workload) |
| AC-02 | Denial-of-wallet through expensive targets: huge sites, slow "tarpit" servers, render-heavy pages, redirect chains | Page, depth, byte, decompressed-byte, duration and concurrency limits in the crawler (crawl-limits configuration, not yet in `config/`: `<DECIDE_AT_M1: crawl-limits config file>`); render only when HTML is thin; Cloud Run Jobs max duration and parallelism set in Terraform; per-audit hosting variable cost tracked in the ledger | TS-SSRF limits cases, TS-MALSITE (tarpit, bomb, loop), TS-LOAD |
| AC-03 | Crawler used against third parties: many audits of one target domain, or audits as a traffic generator | Per-target-domain rate and concurrency limits; same-domain evidence reuse; robots and site-policy respect with no bypass (01 §8); static egress IP published for complaints (ASSUMPTION) | TS-ELIG (per-domain limits), TS-MALSITE (robots-blocked site) |
| AC-04 | Report link guessing, leakage or replay | Unguessable audit ID plus a separate signed access secret (D-002); the secret is never logged; ASSUMPTION: the link carries the secret in the URL fragment, the page exchanges it for an HttpOnly, Secure, SameSite cookie, so it never appears in server, load-balancer or Referer logs; `Referrer-Policy: no-referrer`; `noindex` header and meta; constant-time comparison against a keyed hash; attempt rate limits; expiry at 7 days; deletion invalidates the secret | TS-ANON-ACCESS (guessing, interchange of secrets between audits, expiry, deletion, noindex, log canary) |
| AC-05 | Anonymous export bypass: direct calls to export endpoints, print or "download" routes, bulk scraping of the report JSON | Server-side export authorization on every export route and object: anonymous callers always denied (D-002, 04 §13); export renderer refuses jobs without an `ExportAuthorization` record; anonymous report API returns the web projection only, paginated, rate-limited; no signed object URLs are ever issued for anonymous audits | TS-ANON-EXPORT |
| AC-06 | Stored XSS through crawled titles, meta, JSON-LD, SVG, or model output rendered in the report | Render all evidence and model text as text through framework escaping; no raw HTML insertion of evidence; strict Content Security Policy with nonces; links only `http`/`https` with `rel="noopener noreferrer nofollow"`; crawled SVG never inlined; screenshots served as images only (ASSUMPTION: from a separate content origin) | TS-XSS, TS-MALSITE |
| AC-07 | Claim abuse: a user claims an anonymous audit and treats it as proof of domain ownership or connector authority | Claim grants access to the report only; domain ownership needs separate verification; connector authority needs the site owner's own OAuth or credentials (05 M4 exit). ASSUMPTION: claiming revokes the anonymous secret, decision at M4 | TS-ANON-ACCESS (claim cases), TS-AUTHZ |
| AC-08 | Unfair refusal of legitimate users behind shared IPs (availability harm) | IP is a rate signal, never a person; shared-IP limits sized for NAT and carrier networks; escalation goes to CAPTCHA or slower queue before refusal; accessible CAPTCHA alternative (`docs/anonymous-eligibility-policy.md` §5) | TS-ELIG (shared-IP fairness, cookie loss) |

### 4.2 TB-02 Crawl sandbox

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-09 | SSRF to internal networks or cloud metadata through the submitted URL, redirects, sitemap entries, or browser subresources | Only `http`/`https`; no credentials in URLs; port allowlist (ASSUMPTION: 80 and 443, as the skill's `page_audit.py` defaults); resolve all addresses and reject loopback, private, link-local, shared, multicast, reserved, documentation, metadata and IPv6 local ranges; re-validate on every redirect hop and every subresource; block metadata hostnames explicitly, because platform metadata endpoints are not covered by VPC firewall rules alone (02 §17); crawler in its own project with no database, secret or app-project access; egress firewall denies private and metadata ranges; the crawler identity can only create objects in one landing bucket (`docs/iam-matrix.md`) | TS-SSRF, TS-IAC (crawler identity and firewall policy) |
| AC-10 | DNS rebinding and mixed public/private resolution | Resolve once, reject if any answer is non-public, pin the validated address for the connection, set Host/SNI to the name; repeat per hop; no system proxy for the fetcher (a proxy would resolve names itself) | TS-SSRF rebinding fixtures with a controlled DNS server |
| AC-11 | Renderer escape or resource exhaustion from a malicious page | Separate render job and identity; request interception applies the same URL validator to every browser request; WebSocket, WebRTC, downloads, file URLs, service workers and GPU disabled (ASSUMPTION, confirm at M1); response, decompression, time and memory caps; Chromium patch cadence tracked as a policy fact (ASSUMPTION: rebuild on each upstream security release) | TS-RENDER, TS-MALSITE (decompression bomb, oversized, infinite scroll) |
| AC-12 | Evidence tampering or poisoning: a compromised crawler writes altered evidence; a site cloaks content for our crawler; poisoned evidence is reused for another visitor | Crawler writes create-only; evidence processor re-computes content hashes and rejects mismatches; evidence is immutable, re-fetch creates a new version (02 §15); user-agent-only comparisons labelled `assessed`/inferred (04 §6); evidence reuse limited to public evidence with capture time shown and no visitor-supplied inputs | TS-SCHEMA (hash and immutability), TS-ELIG (reuse cases), TS-MALSITE (cloaking fixture) |

### 4.3 TB-03 AI providers

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-13 | Sensitive data sent to an external provider (credentials, personal data, Search Console data without opt-in) | Provider gateway is the only path to providers; it enforces the allowed data classes per provider (`docs/data-classification.md` §4) and tenant opt-in (02 §17); prompts are built from typed fields, never raw credential stores; disclosure on the audit form that public content and generated prompts go to configured providers (v1-baseline §9.8) | TS-LOGREDACT (canary values never reach provider payloads), TS-UNIT gateway classification |
| AC-14 | Provider key theft or open-proxy use of the gateway | Keys only in Secret Manager, readable only by the gateway identity; gateway accepts provider IDs from `config/providers.yaml`, never caller-supplied hosts or URLs; per-provider circuit breakers (D-007) | TS-IAC, TS-UNIT gateway routing |
| AC-15 | Budget or methodology tampering: someone raises caps or changes weights without approval | Caps, weights and eligibility live in versioned config with owner and checked date (D-010); changes need review and a methodology version bump; cost guard cannot raise its own limits (07 §2 policy and cost governance); config checks in CI | TS-CONFIG, TS-HOOK (methodology bump guard) |

### 4.4 TB-04 Connectors and data sources

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-16 | Confused deputy: the platform's authority is used for the requester's benefit (connector writes to a site the user does not control; an agent tool call names another project's IDs; a Search Console property not bound to the site; a webhook triggers a crawl of an arbitrary URL) | Connections require the site owner's own OAuth or credentials; connector IDs come from live read results (01 §8 Changes); tools take project and job scope from the job context, never from model arguments; property-to-site binding checked before import; webhooks can only trigger re-audits of URLs on the connected site | TS-AUTHZ, TS-CONNECTOR, TS-WEBHOOK |
| AC-17 | Replayed or tampered approvals: reuse for another target, after expiry, after the page changed, or double apply on retry | Approval binds target, field, before/after hash, environment, edit or publish mode, approver and expiry (04 §15); single use; idempotency key per operation; connector compares live before-hash with the approval before writing (stale-state check); publish is a separate permission | TS-APPROVAL (replay, expiry, stale, wrong tenant, double apply) |
| AC-18 | Separation-of-duties bypass for Tier 3 | Requester cannot approve; Tier 3 needs two approvers (03 risk baseline, 02 §17). Before M11 (`User → Project → Site`, D-004), 02 §17 states as an ASSUMPTION that Tier 3 changes cannot be approved until a project has a second approver; approver assignment before M11 is open. ASSUMPTION: Tier 3 changes, once possible, go through pull requests or staging only | TS-APPROVAL (self-approval, missing second approver), TS-CONNECTOR |
| AC-19 | OAuth attacks: forged callback, code interception, over-broad scopes, token leakage | `state` and PKCE where applicable; narrowest scopes; token encryption at rest; rotation and revocation on disconnect; tokens never reach a model, log or crawl container (04 §19) | TS-OAUTH, TS-LOGREDACT |
| AC-20 | Webhook forgery and replay (M9) | Signature verification per platform; replayed event IDs rejected (02 §19) | TS-WEBHOOK |
| AC-21 | Stale or conflicting writes overwrite someone else's change | Three-way check (snapshot, approved after-value, live value) before write and before rollback; conflicts pause for human review (`docs/runbooks/connector-mismatch.md`) | TS-CONNECTOR (conflict, partial failure, read-back mismatch) |

### 4.5 TB-05 Runtime agents and prompt injection

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-22 | Prompt injection in crawled pages, provider answers or MCP output makes an agent call tools, change scores, create change sets, reveal data, or embed exfiltration links | Deterministic rules run before any model; models cannot change a rule result; agents that read untrusted content have no write-class tools (`config/agents/<agent-name>.yaml`, CONTEXT write-class list); output must validate against a schema; the `fixer` receives structured fields, never raw HTML (02 §13); prompt screening (ASSUMPTION: Model Armor where available, 02 §12); detections on evidence become finding flags, the audit continues; model output rendered as text only | TS-INJ, TS-ALLOWLIST, TS-XSS |
| AC-23 | Excessive agency: an agent widens its own scope, budget or tools | Allowlists are config reviewed by humans; agents cannot edit config or grant themselves connectors, scopes, budgets, targets, retention, publication or production rights (05 §4) | TS-ALLOWLIST, TS-CONFIG, TS-EVAL-AGENT (approval overreach) |

### 4.6 TB-06 Registered users and tenants

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-24 | Cross-tenant access through guessed or swapped IDs (audit, project, site, evidence, export), shared caches, reused signed URLs, or evidence reuse carrying another visitor's context | Owner and project ID on every row, enforced in every query at the data-access layer (ASSUMPTION: plus PostgreSQL row-level security, decide at M0B); object paths prefixed by project; short-lived signed URLs bound to one object; cache keys include the owner scope; evidence reuse limited to public data | TS-AUTHZ (two-user IDOR matrix), TS-ELIG (reuse isolation) |
| AC-25 | Stored XSS or CSV/formula injection in registered exports | Escape all cells that begin with `=`, `+`, `-`, `@`, tab or carriage return; PDF and document renderers take the canonical report model, not HTML from evidence; renderer has no network access | TS-CSVINJ, TS-PARITY |
| AC-26 | Public gallery leakage or publication without ownership (M12) | Disabled by default; ownership verification; explicit consent; public-safe projection with preview and redaction; immediate revocation (01 §5.17) | TS-GALLERY |

### 4.7 TB-07 Admin and operations

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-27 | Admin misuse or admin account takeover | Admin routes behind IAP where supported (04 §3) with MFA; admins cannot read secret values or approve client changes; every admin action in the append-only audit log; break-glass is time-bound and reviewed (`docs/iam-matrix.md` §5) | TS-AUTHZ admin cases, TS-IAC |
| AC-28 | Deleted data resurrected by a backup restore | Restore procedure re-applies the deletion queue before the restored database serves traffic (v1-baseline §10) | TS-DR (restore then redelete) |
| AC-29 | Logs or analytics leak secrets, personal data or private URLs | Allowlist-based structured logging; redaction of tokens, emails, page text, prompts and URLs (02 §13, v1-baseline §10); analytics events carry no URLs, queries or content (01 §11) | TS-LOGREDACT |

### 4.8 TB-08 CI and Claude Code

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-30 | Injected instructions in repository files, fixtures, web pages or MCP output steer a Claude Code session to read secrets, weaken tests, add write tools to agents, call forbidden endpoints, or deploy | Web pages, MCP output and reference documents are data, never instructions (04 §24); `.claude/settings.json` denies secret reads, production operations and destructive commands; deterministic hooks (`.claude/hooks/`): `secret_scan`, `dangerous_bash`, `protect_prod_infra`, `agent_allowlist_guard`, `forbidden_endpoints`, `methodology_bump`, `test_lock`; no production credentials on developer machines or in agent sessions; the agent that wrote a pull request cannot approve it; bypass-permissions modes not used (04 §24) | TS-HOOK, TS-EVAL-BUILD |
| AC-31 | CI identity misuse or long-lived credential theft | Workload Identity Federation, no service-account keys (org policy, 02 §12); separate deploy identities per environment; production deploy needs release-manager authorization; Terraform apply on production needs a change ticket | TS-IAC, release checklist evidence |
| AC-32 | Supply-chain compromise: dependency, container base image, browser build, MCP server, or the vendored skill's scripts imported into services | Lockfile with pinned versions (D-008 pnpm, ASSUMPTION); dependency and image vulnerability scanning; base images pinned by digest; MCP servers pinned and untrusted (07 §9); skill scripts are reference and golden-file generators only, never imported into `services/` (D-009) | TS-SUPPLY, TS-HOOK (forbidden imports) |

### 4.9 TB-09 Webhooks and schedules

| ID | Abuse case | Mitigations and implementing control | Proving test |
|---|---|---|---|
| AC-33 | A scheduled job broadens scope or crosses a write gate | Scheduler identity can invoke only named workflows; schedules carry fixed scope; scheduled work may prepare changes but cannot cross an approval gate (04 §17, 05 M10 exit) | TS-AUTHZ scheduler cases, TS-MONITOR |

## 5. Denial-of-wallet: worked control chain

The anonymous rich audit is the highest-exposure spend path. Controls act in this order:

1. Edge: Cloud Armor per-IP-prefix and global request rate limits.
2. Intake: URL validation and eligibility decision (`docs/anonymous-eligibility-policy.md`).
3. Global breakers: if the anonymous paid sub-budget, the daily pacing allowance or the monthly
   cap is exhausted, rich audits run without paid calls, or intake closes (refused tier).
4. Crawl first: paid calls start only after a successful crawl of a public, reachable site.
5. Per call: the provider gateway checks remaining per-audit, daily and monthly budget before
   each call and records the call in the cost ledger.
6. Per audit: soft cap USD 3.00 skips optional retries and summaries; hard cap USD 4.00 stops
   paid calls and marks sections `unavailable` (D-007).
7. Reconciliation: the cost guard compares the ledger with the Billing export and provider usage
   reports, and alerts on variance (ASSUMPTION: 5%, 02 §15).

Proof: TS-COST simulates a scripted abuse run in staging and must show that total paid spend
never exceeds the configured sub-budget and that deterministic audits still complete.

## 6. Residual risks

| Risk | Why it remains | Owner |
|---|---|---|
| Cookie clearing and IP rotation can obtain more rich audits | No invasive fingerprinting by design (01 §5.19) | Product owner; bounded by budget controls |
| Provider-side retention of prompts and answers | Outside our control; governed by provider terms | Privacy owner and counsel |
| Backups hold deleted data until expiry | Backups are not edited in place | Privacy owner |
| Zero-day in the headless browser | Isolation limits blast radius; patching has a lag | Security owner |
| Hosting spend cannot be stopped by application breakers without an outage | Combined cap (D-005) includes hosting | Cloud billing owner (`docs/runbooks/budget-hard-stop.md`) |

## 7. Open decisions

- `<DECIDE_AT_M0: region>` and data residency (affects where evidence and logs live).
- `<DECIDE_AT_M0B: row-level security in PostgreSQL or application-layer scoping only>`.
- `<DECIDE_AT_M0B: whether the report access secret travels in the URL fragment>` (ASSUMPTION above).
- `<DECIDE_AT_M0B: CAPTCHA provider>`; 02 §12 names reCAPTCHA Enterprise, which adds a subprocessor.
- `<DECIDE_AT_M4: whether claiming revokes the anonymous secret>`.
- `<DECIDE_AT_M0: approver assignment before M11>` (02 §17): until then Tier 3 changes cannot be approved.
- Whether anonymous report links may be shared by the holder or are strictly bearer-private
  (v1-baseline §22 item 6); D-002 makes them private and unguessable but does not forbid sharing.
