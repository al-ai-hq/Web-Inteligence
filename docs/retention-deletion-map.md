# Retention and deletion map

Status: draft for review
Owner role: Privacy owner
Sources: 01-PRODUCT-REQUIREMENTS §5.0, §5.17, §9, §12, §15; 03-PRODUCTION-CONTRACTS (`RetentionRecord`, `DeletionReceipt`); 04-CLAUDE-CODE-BUILD-PROMPT §3.1, §19; 05-PROJECT-PLAN M0, M0B, M10, M13; 02-DETAILED-SPECIFICATION §15, §16, §17; v1-baseline §9.6, §10; docs/decisions.md D-002, D-003, D-004
Last updated: 2026-09-30

## 1. Rules

- Anonymous reports and their evidence: 7 days maximum, deletable any time (D-002, 01 §9).
- Registered-project evidence: 30 days by default unless an approved plan says otherwise (D-003).
- Other items: v1-baseline §10 and 02-DETAILED-SPECIFICATION §16, adjusted to the rules above.
- When a provider's terms require a shorter period, the shorter period wins (v1-baseline §10).
- Every deletion produces a `DeletionReceipt` that records what was deleted, where, and what
  copies remain until when. It never contains the deleted content (v1-baseline §10).
- Every retention period is configuration with owner and checked date (D-010), not a constant.
  The machine-readable periods live in `config/retention.yaml`. This map adds stores,
  deletion mechanisms, downstream copies and verification. If the two disagree, raise it; do not
  ship until one is corrected.
- The report shows its expiry date (v1-baseline §10).

## 2. Deletion mechanisms

| ID | Mechanism | Used for |
|---|---|---|
| DM-1 | Daily retention workflow: Cloud Scheduler starts a Workflows run; the `deletion-job` deletes rows and objects past their `expires_at` and writes receipts | All time-based expiry |
| DM-2 | User-initiated deletion: immediate API call, authorized by the anonymous access secret or the signed-in owner; runs the same deletion code as DM-1 | Anonymous delete button (v1-baseline §9.6), registered delete actions, account deletion |
| DM-3 | Cloud Storage lifecycle rules on each bucket, set slightly longer than the policy period, as a backstop if DM-1 fails | Evidence, landing, export buckets |
| DM-4 | Secret Manager: destroy all secret versions on disconnect; revoke the token at the platform where it offers revocation (02 §16) | OAuth tokens, CMS credentials |
| DM-5 | Identity provider user deletion | Registered account deletion (M4+) |
| DM-6 | Log bucket retention setting | Application, security and request logs |
| DM-7 | BigQuery table or partition expiration | Analytics tables, cost aggregates |
| DM-8 | Deletion queue (tombstones) re-applied after any database restore, before traffic resumes | Backups (v1-baseline §10) |
| DM-9 | Provider-side request or setting, where the provider offers one; otherwise disclosed as a residual copy | Prompts and answers held by providers |

## 3. Anonymous audits

| Item | Class | Store | Retention | Deletion | Downstream copies | Verification |
|---|---|---|---|---|---|---|
| Intake record: submitted URL, business context, market, language, competitors, typed keywords | C2 | Cloud SQL | Until report expiry, 7 days maximum | DM-1, DM-2 | Backups (§6) | Receipt row counts |
| Access secret (keyed hash only) | C5 | Cloud SQL | Same as report | DM-1, DM-2 (delete invalidates it) | Backups hold the hash, not the secret | TS-ANON-ACCESS: link fails after delete and after expiry |
| Raw fetched HTML and rendered snapshots | C1 | Landing bucket, then app evidence bucket | 24 hours (v1-baseline §10), or earlier after extraction | Evidence processor deletes after extraction; DM-3 backstop | None beyond soft-delete window if enabled (§6) | Receipt lists object counts; lifecycle audit |
| Normalized evidence, hashes, evidence snippets, screenshots kept as evidence | C1 | Cloud SQL, app evidence bucket | 7 days maximum | DM-1, DM-2, DM-3 | Backups | Receipt |
| Rule results, scores, findings, action board, roadmap, report model | C2 | Cloud SQL | 7 days maximum | DM-1, DM-2 | Backups | Receipt |
| AI prompts, answers, citations (anonymous panel) | C6 | Cloud SQL, evidence bucket | 7 days maximum, shorter if provider terms require | DM-1, DM-2; DM-9 | Provider-side copies per provider terms | Receipt names each provider and its stated retention from `config/providers.yaml` |
| Cost ledger rows for the audit | C8 | Cloud SQL, BigQuery | ASSUMPTION: 12 months; rows hold audit UUID and amounts, no URL or domain | DM-7 | None | Reconciliation reports |
| Eligibility decision and reason codes | C2 | Cloud SQL | With the report, 7 days maximum | DM-1, DM-2 | Aggregated counts (no identifiers) in analytics | Receipt |
| Eligibility counters keyed by IP prefix or domain (keyed hashes) | C7 / C8 | Cloud SQL or cache | `<DECIDE_AT_M0>` in `config/retention.yaml`; ASSUMPTION for planning: up to 30 days, the v1 period for rate-limit logs (v1-baseline §10) | Window expiry | None | Counter expiry test in TS-ELIG |
| Signed eligibility cookie | C2 | Visitor's browser | `<DECIDE_AT_M0>` in `config/retention.yaml`, with legal review (v1-baseline §9.9); ASSUMPTION for planning: 30 days | Browser expiry; visitor can clear it | None | Cookie attributes test |
| Report session cookie | C5 | Visitor's browser | Session or until report expiry, whichever is first | Expiry | None | TS-ANON-ACCESS |
| Security and rate-limit logs (IP, user agent) | C7 | Cloud Logging | 30 days (v1-baseline §10) | DM-6 | None | Bucket retention setting checked by TS-IAC |

Claimed anonymous audits (M4): when a signed-in user claims an audit within its 7 days, it
becomes registered project data. ASSUMPTION: the registered 30-day clock starts at the claim, and
the anonymous access secret is revoked. Decide at M4. A claim never proves domain ownership (D-004).

## 4. Registered users and projects (M4+)

| Item | Class | Store | Retention | Deletion | Downstream copies | Verification |
|---|---|---|---|---|---|---|
| Account: email, name, identity-provider subject | C7 | Identity provider, Cloud SQL | Account lifetime; any retention after account deletion is `<DECIDE_AT_M0>` in `config/retention.yaml` (legal review) | DM-2 account deletion, DM-5 | Identity-provider backups per its terms; our backups | Receipt lists identity-provider deletion result |
| Projects and sites | C3 | Cloud SQL | Account lifetime or until deleted | DM-2 | Backups | Receipt |
| Normalized audit evidence, findings, scores | C1 / C3 | Cloud SQL, evidence bucket | 30 days default (D-003) or the approved plan's period | DM-1, DM-2, DM-3 | Backups | Receipt |
| Raw fetched HTML and snapshots | C1 | Landing and evidence buckets | 24 hours | As anonymous | As anonymous | As anonymous |
| Reports and registered exports (PDF, document, CSV, JSON) | C3 | Cloud SQL, export bucket | 30 days (v1-baseline §10) | DM-1, DM-2, DM-3; signed links expire (ASSUMPTION: minutes, decide at M3) | Copies the user downloaded are outside our control | Receipt; signed-link expiry test |
| AI prompts, answers, citations | C6 | Cloud SQL, evidence bucket | 30 days maximum, shorter where provider terms require (02 §16) | DM-1, DM-2, DM-9 | Provider-side copies | Receipt names providers |
| Prompt-panel derived counts without answer text | C3 | Cloud SQL | `<DECIDE_AT_M6>`; trend comparison across runs needs longer than 30 days, which needs an approved plan (D-003) | DM-2 | Backups | Receipt |
| Keyword uploads and derived clusters | C3 / C9 | Cloud Storage, Cloud SQL | 30 days: 02 §16 says "workspace setting"; ASSUMPTION in `config/retention.yaml`: the D-003 default applies until a project setting is approved | DM-1, DM-2 | Backups | Receipt |
| Search Console and GA4 imported rows | C4 | Cloud SQL | Workspace setting (02 §16); ASSUMPTION: 30 days default as evidence (D-003); decide at M4 | DM-1, DM-2 | Backups | Receipt |
| Search Console generative AI export uploads | C4 | Cloud Storage, Cloud SQL | Workspace setting (02 §16) | DM-1, DM-2 | Backups | Receipt |
| Licensed keyword or rank data | C9 | Cloud SQL | Per provider licence (02 §16) | DM-1 | Provider holds its own copy | Receipt |
| Server or CDN log uploads | C3 / C7 | Cloud Storage | ASSUMPTION: 30 days (02 §16) | DM-1, DM-2, DM-3 | Backups | Receipt |
| Fact register, brand terms, style guides | C3 | Cloud SQL | Project lifetime (02 §16 says workspace lifetime; under D-004 the unit is the Project) | DM-2 | Backups | Receipt |
| OAuth tokens, CMS/Git credentials | C5 | Secret Manager | Until disconnect; revoked on disconnect (02 §16) | DM-4 | None after destroy | Receipt records revocation response and destroyed versions |
| Change sets, approvals, snapshots, read-backs | C3 | Cloud SQL | ASSUMPTION: 12 months, pending legal review; an exception to the 30-day default that needs approval (02 §16, 01 §14) | DM-1 | Backups; audit-log entries | Receipt |
| Public gallery publication and consent record (M12) | C0 / C3 | Cloud SQL, public projection store | Until revocation or expiry; consent record per counsel | Revocation removes the projection immediately (01 §5.17) | Search-engine and third-party caches outside our control | TS-GALLERY |

## 5. Platform and operations

| Item | Class | Store | Retention | Deletion |
|---|---|---|---|---|
| Application error logs (redacted) | C8 | Cloud Logging | 30 days (v1-baseline §10) | DM-6 |
| Request logs at the load balancer (no secrets in URLs) | C7 / C8 | Cloud Logging | 30 days (ASSUMPTION, same as security logs) | DM-6 |
| Audit log (access, approval, execution, publication, deletion) | C8 | Locked log bucket (02 §12) | `<DECIDE_AT_M0>` in `config/retention.yaml` (legal review); ASSUMPTION for planning: 12 months | DM-6 after the lock period |
| Deletion receipts | C8 | Cloud SQL | `<DECIDE_AT_M0>` in `config/retention.yaml`; ASSUMPTION for planning: 12 months | DM-1 |
| Cost ledger and Billing export | C8 | Cloud SQL, BigQuery | ASSUMPTION: 12 months | DM-7 |
| Aggregated anonymous metrics | C8 | BigQuery | Indefinite, only if they cannot re-identify anyone (v1-baseline §10) | Not deleted |
| Privacy-request correspondence | C7 | Ticketing system `<DECIDE_AT_M0: support tool>` | Per counsel | Manual |
| Registries: rules, crawlers, providers, prices | Internal | Repository | Versioned indefinitely (02 §16) | n/a |
| Labelled evaluation sites and golden files | C1 (minimized) | Repository `evals/` | Internal; no personal data | Manual review |

## 6. Backups and soft delete

- Database backups: ASSUMPTION: automated backups and point-in-time recovery retained up to 35
  days after source deletion (v1-baseline §10). Backups are never edited. They expire on schedule.
- Restore rule: any restore re-applies the deletion queue (DM-8) before the restored database
  serves traffic. This is tested by TS-DR.
- Anonymous data in backups: a backup can hold anonymous data for up to the backup window after
  its 7-day expiry. Counsel must confirm that the public statement "7 days maximum" refers to
  active data and that the privacy policy discloses backup expiry. Until confirmed, this is an
  open conflict (§9).
- Cloud Storage soft delete and object versioning: decide per bucket at M0B. ASSUMPTION:
  versioning off for evidence, landing and export buckets; any soft-delete window counts as a
  residual copy and is listed on the receipt.

## 7. DeletionReceipt

`schemas/deletion-receipt.schema.json` (version 0.1.0) records: `receipt_id`,
`deletion_request_id`, `subject_type`, `subject_id`, `trigger`, `requested_at`, `completed_at`,
`stores` (each with `store`, `outcome`, `verified_at`), `backup_expiry_by`,
`content_retained` (always `false`) and `verified`. The request side is
`schemas/deletion-request.schema.json`.

A receipt must let a reviewer answer:

- what subject was deleted and why (trigger);
- when it was requested and completed;
- which stores were checked, the outcome in each, and when each was verified;
- when backup copies expire;
- that no deleted content was retained.

Gaps between this map and schema 0.1.0, to raise with the schema owner:

- `stores` has no values for Secret Manager, the identity provider or provider-side copies, so
  token destruction (DM-4), identity deletion (DM-5) and provider residual copies (DM-9) cannot be
  recorded;
- `subject_type` has no `connection` (disconnect) value, and `trigger` has no `disconnect` value;
- there is no per-store count of deleted rows or objects;
- there is no field for external call results (token revocation at the platform).

A receipt never contains deleted content, URLs, domains or personal data beyond the subject UUID.

## 8. Verification

- TS-DELETE runs expiry and user deletion against every store in §3 and §4 and checks receipts.
- TS-DR restores a backup into an isolated instance and proves the deletion queue re-applies.
- The nightly integrity job counts records past `expires_at`; any count above zero alerts.
- M0B exit and M10 exit include a deletion demonstration (05-PROJECT-PLAN).

## 9. Open decisions and conflicts

- Anonymous data in backups beyond 7 days (v1-baseline §10 backup window versus D-002). Counsel.
  `config/retention.yaml` records the same conflict.
- Eligibility counter window and cookie lifetime: `<DECIDE_AT_M0>` in `config/retention.yaml`, with counsel.
- Audit log and receipt retention (`<DECIDE_AT_M0>`); snapshots and approvals 12 months is an
  exception to the 30-day default that needs approval (02 §16, 01 §14).
- Search Console/GA4 row retention and prompt-panel history: `<DECIDE_AT_M4>`, `<DECIDE_AT_M6>`.
- v1-baseline §10 sets 30 days for anonymous reports and evidence; D-002 overrides it to 7 days
  maximum (02 §16 already applies this).
- DeletionReceipt schema gaps listed in §7.
