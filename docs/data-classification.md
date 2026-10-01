# Data classification

Status: draft for review
Owner role: Privacy owner (with the Security owner)
Sources: 01-PRODUCT-REQUIREMENTS §5.0, §8, §9, §11, §14; 03-PRODUCTION-CONTRACTS (evidence and fidelity); 04-CLAUDE-CODE-BUILD-PROMPT §3.1, §19, §24; 02-DETAILED-SPECIFICATION §13 (hard restrictions), §15, §16, §17; v1-baseline §9, §10, §13, §15; docs/decisions.md D-002, D-003, D-010, D-011
Last updated: 2026-09-30

## 1. Purpose

Every stored field belongs to one class. The class decides where the field may live, who may
read it, whether it may reach an AI model, what may be logged, and how long it is kept
(`docs/retention-deletion-map.md`). When a record mixes classes, the strictest class applies.

Data minimization is the default: do not collect a field that no requirement needs.
v1-baseline §9.3 lists what the product does not intentionally collect (payment data, phone
number, website credentials from anonymous visitors, sensitive personal data).

## 2. Classes

| Class | Name | Examples | Sensitivity |
|---|---|---|---|
| C0 | Public product content | Methodology pages, published policies, consented gallery projections (M12) | Public |
| C1 | Public page content (evidence) | Fetched HTML, rendered screenshots, robots.txt, sitemaps, JSON-LD, response headers, extracted text, hashes | Public source, integrity-critical, untrusted; may contain personal data published by the site |
| C2 | Anonymous audit and report | Submitted URL, business context, market, language, optional competitors and target keywords, report model, eligibility decision and reason codes | Confidential, temporary (7 days maximum, D-002) |
| C3 | Registered project data | Projects, sites, audits, findings, plans, fact register, brand terms, style guides, keyword uploads, change sets, approvals, snapshots | Confidential, tenant-private |
| C4 | Search Console and GA4 data | Queries, pages, clicks, impressions, positions, sessions, conversion events, generative AI export uploads | Confidential, tenant-private, restricted |
| C5 | Credentials and secrets | CMS/Git credentials, OAuth access and refresh tokens, provider API keys, webhook secrets, report access secrets, signing keys | Secret |
| C6 | Prompts and answers | Prompt sets, prompt text, provider answers, citations, mentions, accuracy issues, run metadata | Confidential; provider terms may restrict storage and display (02 §17) |
| C7 | Personal data | Registered user email and name, identity-provider subject ID, IP address and user agent in security logs, consent records, privacy-request correspondence | Personal |
| C8 | Operational and audit records | Application logs, security logs, audit log, cost ledger, deletion receipts, metrics | Internal; the audit log is integrity-critical |
| C9 | Licensed third-party data | Keyword Planner or licensed provider volumes, rank data, backlink exports | Confidential; display and storage limited by licence (02 §14) |

Notes:

- C1 is public at the source but not public in our system. A crawled page can contain names,
  emails or phone numbers. Store only what rules need, keep raw HTML for the shortest time
  (24 hours, v1-baseline §10), and do not reproduce unnecessary personal details in reports
  (v1-baseline §9.3).
- C2 visitor-supplied context (competitors, keywords, business description) is not public data.
  It must never be reused for another visitor, even when the public evidence is reused.
- The anonymous access secret is C5 even though the report is C2.

## 3. Handling rules

| Class | Storage | Encryption | Who may read | Export | Crawl sandbox |
|---|---|---|---|---|---|
| C0 | Cloud Storage or app | Default at rest | Anyone | Yes | n/a |
| C1 | Raw: crawl landing bucket then app evidence bucket; normalized: Cloud SQL and Cloud Storage | At rest (ASSUMPTION: CMEK through Cloud KMS for prod, 02 §12) | Evidence processor, owning audit's agents through job-scoped tools, the report holder | Registered only (D-002); never raw bulk to anonymous users | Written create-only; never read back |
| C2 | Cloud SQL, Cloud Storage | At rest | Holder of the access secret; operators only through audited admin views | Never (D-002) | Never present |
| C3 | Cloud SQL, Cloud Storage | At rest; CMEK for prod (ASSUMPTION) | Owning user (M4), later tenant roles (M11); agents through job-scoped tools | Owner only, server-side authorization | Never present |
| C4 | Cloud SQL (rows), Cloud Storage (uploads) | At rest; CMEK for prod (ASSUMPTION) | Owning project only; performance and keyword agents through tools | Owner only | Never present |
| C5 | Secret Manager, or envelope-encrypted with Cloud KMS; only hashes of access secrets in the database | Always | Only the one service identity that uses it (`docs/iam-matrix.md`) | Never | Never present |
| C6 | Cloud SQL, Cloud Storage | At rest | Owning audit or project | Registered only; subject to provider display terms | Never present |
| C7 | Identity provider (`<DECIDE_AT_M0: identity provider>`, D-011), Cloud SQL (minimal profile), security logs | At rest | Account owner; privacy owner for requests; security staff for security logs | To the data subject on request | Never present |
| C8 | Cloud Logging buckets, BigQuery, Cloud SQL | At rest; audit log in a locked bucket (02 §12) | Operators by role; audit log read-only to all | Aggregates only | Logs written, not read |
| C9 | Cloud SQL | At rest | Owning project | Only where the licence allows | Never present |

Environment rule: dev holds synthetic data only; staging holds test tenants and public labelled
sites with owner permission; no production data is copied to lower environments
(`docs/environments.md`, 05-PROJECT-PLAN §8).

## 4. AI model and provider rules

Two model paths exist. ASSUMPTION: the "internal path" is Google Cloud Vertex AI in the approved
region under the Google Cloud agreement; an "external provider" is any provider reached outside
that agreement (for example a provider's own API). Whether partner models served through Vertex
AI Model Garden count as internal for these rules is `<DECIDE_AT_M0: partner-model data terms>`.
Allowed data classes per provider are an owner decision (01 §14) and live in
`config/providers.yaml` with source, checked date and owner (D-010).

02 §13 and §17 require tenant opt-in only for external providers. `config/providers.yaml`
(`data_class_policy`) is stricter: it requires project opt-in for Search Console, analytics, fact
sheet, keyword upload and CMS content data on every provider, internal or external. Until the
owner decides allowed data classes per provider (01 §14), the stricter config rule applies. The
"Internal path" column shows the proposal the owner may adopt.

| Class | Internal path (proposal) | External providers | Conditions |
|---|---|---|---|
| C0 | Yes | Yes | None |
| C1 | Yes, minimized extracts | Yes, minimized extracts | Disclosed on the audit form before execution (v1-baseline §9.8); send extracted fields needed for the task, not whole raw pages; strip obvious personal details where the task does not need them (ASSUMPTION: Sensitive Data Protection where applicable, 04 §3) |
| C2 | Yes | Yes | Only fields needed to build prompts (brand, market, language, category, competitors); disclosed before execution |
| C3 | Proposal: yes for the owning project's tasks; today project opt-in (config) | Only with project opt-in per provider | Fact register and style guide only for the owning project's tasks |
| C4 | Proposal: yes for the owning project's analysis; today project opt-in (config) | Only with project opt-in per provider (02 §13, §17) | Deterministic metrics are computed by code; models receive only the rows a task needs |
| C5 | Never | Never | Credentials never enter prompts, crawl containers, reports, logs, fixtures or source control (04 §19) |
| C6 | Yes | Yes, as the observation itself | Prompts sent to a provider are the measured input; answers are stored under provider terms |
| C7 | Never | Never | Never send email, IP address or unrelated personal data to providers (v1-baseline §9.8) |
| C8 | Never | Never | Exception: a Claude Code diagnosis in the maintain loop may read redacted operational metrics, never raw logs with personal data |
| C9 | Only if the licence permits | Only if the licence permits and the tenant opts in | Recorded per provider in config |

Mapping to the data-class names in `config/providers.yaml` (which asks for this alignment at M0B):

| Config name | Class here | Config rule |
|---|---|---|
| `public_site_content` | C1 | Default allowed |
| `generated_prompts` | C2 (prompt-building fields), C6 (prompt text) | Default allowed |
| `search_console_data`, `analytics_data` | C4 | Project opt-in |
| `fact_sheet`, `keyword_uploads`, `cms_content` | C3 (keyword uploads may also be C9) | Project opt-in |
| `cms_credentials`, `oauth_tokens`, `api_keys` | C5 | Never sent |
| `email_address`, `ip_address`, `personal_data` | C7 | Never sent |

Opt-in rules: an opt-in is per project, per provider, per class; it is recorded with who, when
and which terms version; it can be withdrawn and withdrawal takes effect before the next call.
The provider gateway rejects a payload whose class is not allowed for that provider and records
the rejection.

## 5. Log redaction

Logs use structured fields from an allowlist. ASSUMPTION: anything not on the allowlist is
dropped, not masked. Tests plant canary values and check they never appear (TS-LOGREDACT).

Never log:

- access secrets, tokens, API keys, cookies, `Authorization` headers, signed URLs;
- email addresses, names, raw IP addresses in application logs (security logs may hold IP
  addresses for 30 days, v1-baseline §10);
- page text, HTML, screenshots, prompts, model answers (02 §13);
- submitted URLs, query strings, private URLs, Search Console queries (01 §11);
- CMS field values (log field names and value hashes only).

Log instead:

- audit, project and job UUIDs;
- a keyed hash of the normalized domain (ASSUMPTION: HMAC with a rotating key), so operators
  can correlate without storing the domain;
- stage, status, duration bucket, error class, cost figures, rule IDs, provider ID, breaker state.

Product analytics events (01 §11, v1-baseline §15) carry no secrets, raw page content, personal
search queries, OAuth tokens, submitted or private URLs, organization names or report IDs.

## 6. Labels in code and schemas

- Each schema field that holds C2, C4, C5, C6 or C7 data should carry a classification
  annotation so validators and the log redactor can use it. ASSUMPTION: the annotation
  mechanism is agreed with the schema owner (`schemas/**`) at M0B.
- Fidelity labels (`observed`, `computed`, `assessed`, `attested`, `user_supplied`, `estimated`,
  `unavailable`) describe how a value was produced. They are separate from data class and never
  replace it.

## 7. Open decisions

- `<DECIDE_AT_M0: identity provider>` (D-011) and where it stores C7 data.
- `<DECIDE_AT_M0: partner-model data terms>` for models served through Vertex AI Model Garden.
- `<DECIDE_AT_M0: runtime model providers and allowed data classes>` (01 §14, D-011).
- `<DECIDE_AT_M0B: CMEK scope>`: which buckets and databases use customer-managed keys in each environment.
