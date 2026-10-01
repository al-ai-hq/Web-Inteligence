# Assumptions Register

Status: living register  
Owner role: Product owner (each row names the role that confirms it)  
Last updated: 2026-09-30

An assumption is a working choice made so work can continue. Each file also marks its own assumptions inline with `ASSUMPTION:`; this register lists the ones that affect more than one file, change cost or risk, or need an owner to confirm. When an assumption is confirmed or replaced, record the decision in `docs/decisions.md` and mark the row here.

## Budget and cost

| ID | Assumption | Confirms | Where used |
| --- | --- | --- | --- |
| A-001 | USD 150 is one combined monthly cap for hosting and paid calls (D-005). | Product owner | `config/budgets.yaml`, `docs/cost-model.md`, 01 §9 and §14, 02 §18 |
| A-002 | Per-audit caps USD 3.00 soft and USD 4.00 hard; breaker opens after 3 consecutive failures, 15-minute cool-down, one probe (D-007). | Cloud billing owner, after the M0B cost proof | `config/budgets.yaml`, 02 §18 |
| A-003 | A USD 10 reserve under the cap; paid calls stop at the cap minus the reserve; the v1 USD 100 alert applies to the combined total. | Cloud billing owner | `docs/cost-model.md`, `config/budgets.yaml` |
| A-004 | Anonymous audits spend from their own sub-budget with daily pacing; preview audits make no paid calls; reduced audits make no new AI observations. | Product owner | `docs/cost-model.md`, `config/anonymous-eligibility.yaml` |

## Product scope and sizes

| ID | Assumption | Confirms | Where used |
| --- | --- | --- | --- |
| A-010 | Rich anonymous audit up to 20 representative pages; reduced up to 10 pages without Experience Effectiveness, comparison or new AI observations; preview 1 page and up to 3 actions (D-006). | Product owner | `config/anonymous-eligibility.yaml`, `docs/anonymous-eligibility-policy.md` |
| A-011 | Free AI panel 8 prompts x configured providers x 1 run, shown as counts; connected panel 20-40 prompts x 3 runs. | Methodology owner | `config/prompt-panels/`, 02 §6 |
| A-012 | An invited readiness-only pilot after M3; no public anonymous traffic before M7 (OI-005). | Product owner | 05 §15 |
| A-013 | 10 Phase 0 sites: 5 client sites with written consent and 5 fixture site types. | SEO lead | 05 §13, `evals/golden/README.md` |

## Methodology

| ID | Assumption | Confirms | Where used |
| --- | --- | --- | --- |
| A-020 | GSC-001/002/003 sit in the crawlability category; AGT-001/002 in i18n and accessibility; SPAM-001 acts only through its proposed cap of 50. | Methodology owner | `config/rules/` |
| A-021 | Unscored rules have importance weight 0; when several critical caps apply, the lowest wins. | Methodology owner | `config/scoring.yaml` |
| A-022 | Assessed (model-judged) rules are AEO-001, AEO-006, AEO-009, GEO-005 and GEO-007; all others are deterministic. | Methodology owner | `config/rules/`, `config/agents/auditor.yaml` |
| A-023 | Experience Effectiveness starts with equal weights only as a calibration starting point; agreement is measured with weighted Cohen's kappa. | Methodology owner | `docs/rubrics/experience-effectiveness.md` |
| A-024 | Every runtime AI agent is treated as reading untrusted content, so none may hold a write tool. | Security engineer | `config/agents/` |

## Data, retention and security

| ID | Assumption | Confirms | Where used |
| --- | --- | --- | --- |
| A-030 | On claim, the anonymous link is revoked and the registered 30-day clock starts. | Product owner, privacy owner | `docs/state-machines.md`, `docs/retention-deletion-map.md` |
| A-031 | Audit logs and deletion receipts are kept 12 months; snapshots and approval records 12 months (exception to the 30-day default; needs approval). | Privacy owner, counsel | `docs/retention-deletion-map.md`, 02 §16 |
| A-032 | The anonymous report secret travels in the URL fragment and is exchanged for an HttpOnly cookie. | Security engineer | `docs/threat-model.md` |
| A-033 | Registered export links expire within 15 minutes, 5 downloads at most; a denied anonymous export returns HTTP 403. | Security engineer | `docs/state-machines.md`, `schemas/export-authorization.schema.json` |
| A-034 | Every provider requires tenant opt-in until the owner decides which providers count as internal (stricter than 02 §17). | Privacy owner | `config/providers.yaml`, `docs/data-classification.md` |
| A-035 | Each service has its own PostgreSQL role with IAM database authentication; row-level security is decided at M0B. | Security engineer | `docs/iam-matrix.md` |

## Build and tooling

| ID | Assumption | Confirms | Where used |
| --- | --- | --- | --- |
| A-040 | pnpm as package manager; Prettier as formatter; Python 3.12 in CI for governance checks. | Tech lead | `CLAUDE.md`, `.github/workflows/ci.yml`, `.claude/hooks/format_changed.py` |
| A-041 | A production project ID contains `-prod`, starts with `prod-`, or equals `prod` or `production`. | Tech lead | `.claude/hooks/protect_prod_infra.py` |
| A-042 | Rollback rehearsal weekly in staging; backup-restore drill monthly. | Tech lead | `docs/rollback-plan.md` |
| A-043 | Retry counts, timeouts and expiry windows in the state machines (backoff 2 s to 60 s; approval requests expire after 7 days). | Tech lead | `docs/state-machines.md` |
| A-044 | ESLint uses its flat config. The `apps/web` package name is `web` and the package is `private`. | Tech lead | `eslint.config.js`, `apps/web/package.json` |
