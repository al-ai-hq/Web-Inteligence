# Environments

Status: draft for review
Owner role: Cloud platform owner
Sources: 01-PRODUCT-REQUIREMENTS §10, §14; 04-CLAUDE-CODE-BUILD-PROMPT §3, §24; 05-PROJECT-PLAN M0, M0B, §8; 02-DETAILED-SPECIFICATION §12, §17; v1-baseline §13.3; docs/decisions.md D-005, D-008, D-011
Last updated: 2026-09-30

## 1. Layout

Six Google Cloud projects: one application project and one crawl-sandbox project per
environment (02 §12). V4 asks for separate development, staging and production projects where
feasible and a distinct least-privilege identity per service (01 §10).

| Project | Purpose | Main services |
|---|---|---|
| `<prefix>-dev-app` | Development application | Cloud Run services, Cloud SQL, Cloud Storage, Workflows, Cloud Tasks, Pub/Sub, Secret Manager |
| `<prefix>-dev-crawl` | Development crawl sandbox | Cloud Run Jobs (HTTP fetcher, renderer), Cloud NAT, landing bucket |
| `<prefix>-staging-app` | Staging application | Same as dev-app, production-like sizing where cost allows |
| `<prefix>-staging-crawl` | Staging crawl sandbox | Same as dev-crawl |
| `<prefix>-prod-app` | Production application | Same, plus load balancer and Cloud Armor |
| `<prefix>-prod-crawl` | Production crawl sandbox | Same as dev-crawl |

`<prefix>` is `<DECIDE_AT_M0: project ID prefix>`.

Shared projects, ASSUMPTION, decide at M0B:

| Project | Purpose | Why separate |
|---|---|---|
| `<prefix>-billing` | Cloud Billing export dataset (BigQuery) and budget notification topic | The cost guard in each environment reads one billing source; engineers do not need billing admin |
| `<prefix>-artifacts` | Artifact Registry for container images | Images are built once and promoted by digest |
| `<prefix>-tfstate` | Terraform state bucket | State is sensitive; no runtime identity can read it |

All projects sit in one folder under the organization, with org policies: no service-account
key creation, allowed resource locations, and any model-feature constraints the chosen providers
need (02 §12). All projects link to one billing account, so all of them count against the
USD 150 combined cap (D-005, `docs/cost-model.md`).

## 2. Region and data residency

- Region: `<DECIDE_AT_M0: region>` (D-011).
- For Gulf data-residency needs, 02 §12 notes that Google lists `me-central1` (Doha) and
  `me-central2` (Dammam) for regional generative AI APIs. Before choosing, verify at M0 that every
  required service and model is available in the candidate region: Cloud Run services and jobs,
  Cloud SQL for PostgreSQL, Workflows, Cloud Tasks, Cloud Scheduler, Pub/Sub, Secret Manager,
  Cloud KMS, load balancing and Cloud Armor, the identity provider, the CAPTCHA provider, the
  chosen Vertex AI models, and any screening service. Record each result as a policy fact with
  source and checked date.
- Pin these to the chosen location: Cloud SQL instance and backups, Cloud Storage buckets, log
  buckets, BigQuery datasets, KMS key rings, Artifact Registry.
- Residency limits: external AI providers process prompts wherever their terms say. Search
  Console and GA4 data stay under Google's own terms. The privacy policy must disclose transfers
  (v1-baseline §9.7, `docs/legal/README.md`).
- Crawling is global by nature: the crawler fetches public pages wherever they are hosted.

## 3. What each environment may contain

| Item | dev | staging | prod |
|---|---|---|---|
| Data | Synthetic only (05 §8) | Test tenants; public labelled sites whose owners agreed; synthetic Search Console/GA4 fixtures | Real users and projects |
| Personal data | None | Test accounts only (team members, with consent) | Yes, per `docs/data-classification.md` |
| Crawl targets | Local fixture sites and the SSRF test range | Fixture sites, labelled sites, malicious-site fixtures | Any public site that passes validation |
| AI provider calls | Off by default; mocks and recorded fixtures. ASSUMPTION: real calls only with a per-run approval and a small dev sub-budget | Real calls within the staging sub-budget, for evals and cost proof | Real calls within production budgets |
| Provider credentials | Non-production keys or none | Non-production keys (05 §8) | Production keys |
| CMS/Git connectors | Local sandboxes (for example a WordPress container) | Vendor sandboxes and test sites (02 §19) | Real client connections (M9+) |
| Search Console/GA4 | Fixtures | Test properties the team owns | Client properties |
| Public gallery | Off | Off except M12 tests | Off by default (01 §5.17) |
| Feature flags | Anything may be on | Mirrors the planned prod state plus the change under test | High-risk modules off by default (05 §8) |
| Human access | Developers may use the console | Read-only console; changes through the pipeline | No standing human write access; break-glass only |
| Claude Code | May deploy to dev through the pipeline (ASSUMPTION) | No direct access | No access |

Never copy production data into dev or staging. Bugs are reproduced with synthetic fixtures.

## 4. Crawl project rules (all environments)

- No access to the application database, Secret Manager or any app-project resource.
- Egress through Cloud NAT with a static IP; firewall denies private, shared, link-local, IPv6
  local and metadata ranges (02 §17). The application-level validator still runs on every
  connection and redirect.
- The crawl and render identities can only create objects in the landing bucket. ASSUMPTION:
  the landing bucket lives in the crawl project; the app-side evidence processor reads it,
  verifies hashes, copies evidence into the app evidence bucket and deletes raw objects within
  24 hours (v1-baseline §10). Decide the bucket placement at M0B.
- The crawler cannot call application APIs. The orchestrator starts jobs and reads completion
  from the job status and a manifest object.

## 5. Promotion path

```text
branch -> pull request (CI merge gate) -> main
  -> build once: image by digest in Artifact Registry
  -> dev (automatic)
  -> staging (automatic after merge-gate and staging checks pass)
  -> prod (release manager authorization + release evidence)
```

- Code, configuration and infrastructure follow the same path. Config files are versioned with
  source, checked date and owner (D-010).
- The production release requires the release evidence in 03-PRODUCTION-CONTRACTS (release
  evidence) and the release gates in `docs/test-strategy.md` §4.
- Terraform: plan in the pull request; apply to dev and staging from the pipeline; apply to prod
  only from the pipeline with a change ticket. Never apply prod from a workstation.
- Database migrations run from the pipeline under a migrator identity
  (`docs/rollback-plan.md` §4).
- CI platform: the repository's merge gate runs in GitHub Actions (`.github/workflows/ci.yml`). The deploy tooling is `<DECIDE_AT_M0A: deploy platform>`; 02 §12 names Cloud Build
  and Cloud Deploy. Either way, CI authenticates to Google Cloud with Workload Identity Federation,
  never with service-account keys.

## 6. Environment sub-budgets

The combined cap is shared by all projects (D-005). ASSUMPTION: split as below until the M0B
cost proof replaces it with measured numbers (`docs/cost-model.md` §7).

| Line | Allocation |
|---|---|
| dev hosting and calls | `<DECIDE_AT_M0B>` |
| staging hosting and calls | `<DECIDE_AT_M0B>` |
| prod hosting | `<DECIDE_AT_M0B>` |
| prod paid calls (anonymous and registered) | Remainder after hosting and reserve |
| reserve | USD 10 (ASSUMPTION, `docs/cost-model.md`) |

ASSUMPTION: dev and staging scale to zero outside working hours where the service allows it,
to lower the hosting baseline.

## 7. Open decisions

- `<DECIDE_AT_M0: region>` and data residency per market.
- `<DECIDE_AT_M0: project ID prefix>` and the organization/folder that owns the projects.
- `<DECIDE_AT_M0A: deploy platform>` (GitHub Actions already runs the merge gate).
- `<DECIDE_AT_M0B: shared billing, artifacts and state projects>`.
- `<DECIDE_AT_M0B: landing bucket placement>`.
- Whether dev and staging paid calls come out of the same USD 150 (conservative reading of D-005, assumed here).
