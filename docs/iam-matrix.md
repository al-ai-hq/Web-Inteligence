# IAM matrix

Status: draft for review
Owner role: Security owner (with the Cloud platform owner)
Sources: 01-PRODUCT-REQUIREMENTS §10, §14; 03-PRODUCTION-CONTRACTS (agent tool boundaries); 04-CLAUDE-CODE-BUILD-PROMPT §3, §6, §19, §24; 05-PROJECT-PLAN M0, M0B, §4, §8; 07-SKILLS-AND-AGENTS §6, §8; 02-DETAILED-SPECIFICATION §12, §13, §17; v1-baseline §13; docs/decisions.md D-004, D-008, D-009, D-011
Last updated: 2026-09-30

## 1. Rules

- One service identity per service per environment (01 §10). Identities are never shared across
  services or environments.
- Capabilities are listed first. Predefined role names are candidates only.
  **Verify role names and scopes at M0B** against current Google Cloud IAM documentation, and
  prefer custom roles or resource-level bindings when a predefined role grants more than the
  capability column.
- Grant on the narrowest resource (one bucket, one secret, one queue, one job), not the project.
- No service-account keys anywhere (org policy, 02 §12). CI uses Workload Identity Federation.
- Only the `connector` identity may hold CMS/Git write credentials (03-PRODUCTION-CONTRACTS).
- Only the `provider-gateway` identity may hold AI and data-provider API keys.
- The crawl and render identities hold no credential except their own runtime identity.
- Database access uses a separate PostgreSQL role per service. ASSUMPTION: IAM database
  authentication where supported; role grants listed in §4.

Identity naming: `<service>@<prefix>-<env>-<app|crawl>`, for example
`crawl-job@<prefix>-prod-crawl`. `<prefix>` is `<DECIDE_AT_M0: project ID prefix>`.

## 2. Runtime service identities

The same identities exist in dev, staging and prod. Environment differences are in §3.

| Identity | Project | Runs as | May | Must not | Candidate predefined roles (verify at M0B) |
|---|---|---|---|---|---|
| `web-api` | app | Cloud Run service: Next.js UI and API | Serve UI and API; read and write application tables through its DB role, scoped by owner/project; create audits; enqueue work on named queues or start named workflows; verify report access secrets and mint report session cookies with one signing secret; read eligibility and feature-flag config; call the CAPTCHA and identity provider APIs; issue short-lived signed URLs for registered export objects (M3+) | Hold AI provider keys or call providers; hold CMS/Git/OAuth tokens; fetch arbitrary URLs; read the crawl landing bucket; change budget, breaker or methodology state; run DDL; issue any signed URL for an anonymous audit | `roles/cloudsql.client`, `roles/cloudtasks.enqueuer` (queue), `roles/workflows.invoker`, `roles/secretmanager.secretAccessor` (one secret), `roles/iam.serviceAccountTokenCreator` (on itself, for URL signing), `roles/logging.logWriter`, `roles/monitoring.metricWriter`, `roles/cloudtrace.agent` |
| `orchestrator` | app | Workflows execution identity | Run audit workflows; start the named crawl and render jobs in the crawl project with per-execution parameters; invoke internal services (evidence processor, agents, report composer); update job state | Read secrets; call providers; hold write credentials; start any job other than the named ones | `roles/run.invoker` (named services), a Cloud Run jobs executor role on the named crawl jobs (candidate `roles/run.jobsExecutorWithOverrides`), `roles/logging.logWriter` |
| `crawl-job` | crawl | Cloud Run Job: HTTP fetcher | Outbound HTTP(S) to public addresses that pass the URL validator, through Cloud NAT; create objects under its execution prefix in the landing bucket; write logs | Reach the app database, Secret Manager, any app-project resource, private networks or metadata; read, list or delete objects; call providers or app APIs; hold any other credential | `roles/storage.objectCreator` (landing bucket only), `roles/logging.logWriter` |
| `render-job` | crawl | Cloud Run Job: headless Chromium | Same as `crawl-job`, with its own prefix; every browser request passes the same validator | Same as `crawl-job`; use downloads, file URLs, WebSocket, WebRTC, service workers, GPU or a persistent profile (ASSUMPTION, confirm at M1) | `roles/storage.objectCreator` (landing bucket only), `roles/logging.logWriter` |
| `evidence-processor` | app | Cloud Run service or job: hash check, extraction, normalization, deterministic rules and scoring | Read and delete landing objects (cross-project, one bucket); verify hashes; write normalized evidence, rule results and scores; write to the app evidence bucket | Call providers; fetch URLs; read secrets; modify methodology config | `roles/storage.objectUser` or narrower custom role (landing bucket), `roles/storage.objectCreator` (evidence bucket), `roles/cloudsql.client` |
| `provider-gateway` | app | Cloud Run service: typed gateway to Vertex AI and approved external providers | Hold provider and data-provider API keys; enforce allowed data classes and tenant opt-in; run the pre-call cost check; write the cost ledger; run circuit breakers; call screening where configured; reach only provider hosts listed in `config/providers.yaml` | Accept caller-supplied hosts or URLs; hold CMS, GSC or GA4 tokens; forward C5 or C7 data; change its own caps; retry beyond policy | `roles/secretmanager.secretAccessor` (provider key secrets), `roles/aiplatform.user`, a Model Armor user role if adopted (verify name), `roles/cloudsql.client` |
| `agent-<name>` (one per agent: `auditor`, `visibility-tester`, `keyword-analyst`, `performance-analyst`, `planner`, `content-strategist`, `fixer`, `verifier`, `report-writer`; later agents get their own) | app | Cloud Run service per agent | Call only the tools in `config/agents/<agent-name>.yaml`; read job-scoped data through tools whose project and job scope come from the job context; call models only through the provider gateway; write only its own output records (drafts, findings, plans) | Hold any secret or provider key; hold a write-class tool (`apply_change`, `publish`, `write_cms`, `delete_content`, `upload_disavow`, `send_email`, `submit_form`); reach other projects' data; start crawl jobs directly; change a rule result or score | `roles/run.invoker` (provider gateway only), `roles/cloudsql.client` (per-agent DB role), `roles/logging.logWriter` |
| `connector` (M9) | app | Cloud Run service: deterministic, the only writer | Hold CMS/Git credentials and OAuth tokens (per-connection secrets); read platform state; snapshot; apply only approved, unexpired, hash-bound operations with idempotency keys; publish only with separate publish approval; read back; roll back per `docs/rollback-plan.md` §6 | Be called by any agent; act without a valid approval record; run models; reach hosts other than the connected platform's API; write outside the approved target, hash and expiry | `roles/secretmanager.secretAccessor` and `roles/secretmanager.secretVersionAdder` (connection secrets only), or `roles/cloudkms.cryptoKeyEncrypterDecrypter` for envelope encryption, `roles/cloudsql.client` |
| `source-reader` (M4) | app | Cloud Run service: read-only Search Console, GA4 and keyword imports | Hold read-only OAuth tokens; import rows for the owning project; validate property-to-site binding | Hold any write scope; send C4 data to external providers without opt-in | Same secret roles as `connector`, limited to read-token secrets; `roles/cloudsql.client` |
| `webhook-receiver` (M9) | app | Cloud Run service | Verify signatures; reject replayed event IDs; enqueue targeted re-audits for URLs of the connected site | Hold write credentials; trigger crawls of other URLs | `roles/secretmanager.secretAccessor` (webhook secrets), `roles/cloudtasks.enqueuer` |
| `export-renderer` (M3, registered only) | app | Cloud Run service or job | Render PDF, document, CSV and JSON from the canonical report model after checking an export authorization; write to the export bucket | Render for anonymous audits; fetch any network resource while rendering | `roles/storage.objectCreator` (export bucket), `roles/cloudsql.client` |
| `cost-guard` | app | Cloud Run service or function | Receive budget notifications; read the Billing export dataset; read provider usage reports imported by operators; reconcile the ledger; set budget states and global breakers; alert | Call providers; change billing accounts, budgets, IAM or caps; delete or stop cloud resources; deploy | `roles/pubsub.subscriber` (budget topic subscription), `roles/bigquery.dataViewer` (billing dataset), `roles/bigquery.jobUser`, `roles/cloudsql.client`, `roles/monitoring.metricWriter` |
| `scheduler` | app | Cloud Scheduler job identity | Invoke named workflows or endpoints: daily retention and deletion, nightly integrity checks, cost reconciliation; later keyword sync (M4) and monitoring (M10) | Invoke connector write endpoints; pass scope-changing parameters; hold secrets | `roles/workflows.invoker` or `roles/run.invoker` (named targets only) |
| `deletion-job` | app | Cloud Run Job | Delete expired or requested rows and objects in named buckets (including the crawl landing bucket); destroy secret versions on disconnect; delete identity-provider users on account deletion (M4); write deletion receipts | Read content beyond what locating targets needs; delete or edit the audit log; edit backups (they expire); act outside the retention map | `roles/storage.objectUser` or narrower (named buckets), `roles/cloudsql.client`, `roles/secretmanager.secretVersionManager` (connection secrets), identity-provider user-admin permission (depends on D-011) |

## 3. Environment differences

| Identity | dev | staging | prod |
|---|---|---|---|
| `provider-gateway` | Mocks by default; non-production keys with a small cap (ASSUMPTION) | Non-production keys; staging sub-budget | Production keys; production budgets |
| `connector` | Local sandbox credentials only | Vendor sandbox and test-site credentials | Client connections |
| `source-reader` | Fixtures only | Test properties owned by the team | Client properties |
| `crawl-job`, `render-job` | Fixture sites and SSRF test range | Fixture, labelled and malicious-site fixtures | Public internet |
| `cost-guard` | Reads the shared billing dataset filtered to dev | Filtered to staging | Filtered to prod, plus the combined-cap view for all projects |
| Human write access | Developers | Pipeline only | Break-glass only |

## 4. Database roles

ASSUMPTION: one PostgreSQL role per service; confirm the model at M0B together with the
row-level-security decision (`docs/threat-model.md` §7).

| DB role | Grants |
|---|---|
| `web_api` | Read/write application tables through owner/project scoping; read report models; no DDL |
| `evidence_processor` | Insert evidence, rule results and scores; no update of existing evidence (immutable) |
| `agent_<name>` | Select on job-scoped views; insert into its own output tables only |
| `connector` | Read change sets and approvals; write execution, snapshot and read-back records; read connection metadata |
| `cost_guard` | Read and write cost ledger, budget state and breaker tables |
| `deletion_job` | Delete on retention-governed tables; insert deletion receipts |
| `migrator` | DDL; used only by the pipeline |
| `readonly_ops` | Select on redacted operational views; no C2, C4, C5, C6 or C7 columns |

## 5. Pipeline and human identities

| Identity | Scope | May | Must not | Candidate roles (verify at M0B) |
|---|---|---|---|---|
| `ci-build` | artifacts project | Build and push images; write build provenance | Deploy; read runtime secrets | `roles/artifactregistry.writer` |
| `ci-deploy-dev`, `ci-deploy-staging` | one env | Deploy new Cloud Run revisions and job definitions using existing runtime identities | Change IAM; read secret values; read data | `roles/run.developer`, `roles/iam.serviceAccountUser` (on the runtime identities only), `roles/artifactregistry.reader` |
| `ci-deploy-prod` | prod | Same as above, only after release-manager authorization | Same as above; run without authorization | Same as above |
| `tf-plan-<env>` | one env | Read resource configuration for `terraform plan` | Change anything | `roles/viewer` or narrower, `roles/iam.securityReviewer` |
| `tf-apply-<env>` | one env | Apply reviewed Terraform from the pipeline; prod needs a change ticket | Run from a workstation; run without a reviewed plan | Broad; keep to the pipeline and review every grant it holds |
| `db-migrator-<env>` | one env | Run migrations | Read application data outside migrations | `roles/cloudsql.client`, DB role `migrator` |
| Claude Code sessions and CI agent jobs | repository, dev pipeline | Open pull requests; run tests; deploy to dev through the pipeline (ASSUMPTION) | Hold production or staging credentials; approve their own pull requests; read secrets (04 §24) | None in staging or prod |
| Developer (human) | dev | Console and deploy in dev | Standing write access to staging or prod | Environment-specific |
| Release manager (human) | prod | Authorize production releases and flag changes | Approve their own code changes | Release approval in CI |
| Cloud billing owner (human) | billing | Manage budgets, billing export, cap decisions | Deploy code | Billing roles on the billing account |
| Security owner (human) | all | Review IAM, audit logs, break-glass | Deploy alone to prod | `roles/iam.securityReviewer` |
| Break-glass admin (human) | prod | Time-bound elevated access during an incident, with a second person informed and a post-incident review | Use it for routine work | Just-in-time grant, logged |
| Admin console users | prod app | Operate through IAP-protected admin routes with MFA (04 §3, 02 §12) | Read secret values; approve client changes; view C2/C4 content without an audited reason | `roles/iap.httpsResourceAccessor` on the admin backend |

## 6. Invariants to test

These are checked by TS-IAC (policy checks on Terraform) and TS-AUTHZ:

1. No binding grants the crawl or render identity access to Cloud SQL, Secret Manager or any app-project resource.
2. No identity other than `connector` can read CMS/Git credential secrets.
3. No identity other than `provider-gateway` can read provider key secrets.
4. No agent identity holds any Secret Manager role.
5. No service-account keys exist.
6. No runtime identity can modify IAM, billing, budgets or Terraform state.
7. `ci-deploy-prod` can act only through the authorized release path.

## 7. Open decisions

- `<DECIDE_AT_M0: project ID prefix>`, `<DECIDE_AT_M0: identity provider>` (D-011).
- `<DECIDE_AT_M0B: custom roles versus predefined roles>` for each row.
- `<DECIDE_AT_M0B: IAM database authentication and row-level security>`.
- `<DECIDE_AT_M0B: whether agents read data through in-process tools with per-agent DB roles (assumed here) or through a separate tool service>`.
