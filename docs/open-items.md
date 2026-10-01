# Open Items Register

Status: living register  
Owner role: Product owner  
Last updated: 2026-09-30

Every item names what it blocks and who decides. Close an item by adding the decision to `docs/decisions.md` and writing `closed by D-xxx` here. Placeholders in files use `<DECIDE_AT_M0: ...>` (or the milestone that needs the answer); search for them with `grep -rn "DECIDE_AT" .`.

## Before M0A starts (owner)

| ID | Item | Blocks | Decides | Where |
| --- | --- | --- | --- | --- |
| OI-001 | Confirm D-005: is USD 150 one combined monthly cap for hosting and paid calls? If hosting is budgeted separately, the anonymous rich audit becomes much more affordable. | M0B cost proof; `config/budgets.yaml`; `docs/cost-model.md` | Product owner, cloud billing owner | D-005 |
| OI-002 | Name the accountable owners: product, methodology, security, privacy, data integrity, Arabic editorial, cloud billing, provider policy, connectors, content approval, production publishing, accessibility, incident response. One person may hold several roles, but proposer, approver and executor stay separate for consequential changes. | Every human gate | Product owner | 07 §8; 05 §17 |
| OI-003 | Claude Code access route (Anthropic plan or Google Cloud Agent Platform), whether Fable is enabled, and pinned model IDs if routing through Google Cloud. | M0A | Tech lead | 06-MODEL-PLAN §1, §5 |
| OI-004 | Add the r2 version of the marketing-seo-agent skill (site architecture, backlinks, comparison pages, programmatic SEO, change monitoring, `crawl_diff.py`) and the e-commerce, local, entity, platform and migration references, if you have them. Reconcile them with the fixes in the vendored 30 Sep version. | Golden files for M8A-M8C; change-monitoring fixtures | SEO lead | 07 §7; 08; `evals/golden/README.md` |
| OI-005 | Launch sequencing: the first anonymous audit in 01 §5.0 needs capabilities built at M5-M7. Choose: public launch after M7, or an invited readiness-only pilot after M3 (ASSUMPTION in 05 §15). | Release planning | Product owner | 05 §15 |

## M0 decisions

| ID | Item | Blocks | Decides | Where |
| --- | --- | --- | --- | --- |
| OI-010 | Google Cloud organization, billing account, region and data residency; project ID prefix. | M0A infrastructure; `docs/environments.md` | Cloud billing owner, security engineer, counsel | D-011 |
| OI-011 | Identity provider (Identity Platform is the candidate) and what `mfa_verified` means. | M4 registration | Tech lead, security engineer | D-008, D-011 |
| OI-012 | First CMS or Git connector (WordPress, Webflow, Shopify or GitHub pull requests). | M9 | Product owner, integration engineer | `config/connectors/` (all `status: candidate`) |
| OI-013 | Runtime AI providers for launch, the data classes each may receive, and tenant opt-in rules. The provider lists differ: the detailed spec includes Grok; V4 names Google AI surfaces, ChatGPT, Perplexity, Gemini and Claude, plus Copilot when Bing matters. | M6; `config/providers.yaml` | Product owner, privacy owner, AI engineer | 02 §6; 01 §16 |
| OI-014 | Product domain. | Crawler user-agent info URL; legal texts | Product owner | `config/crawler-registry.yaml` |
| OI-015 | How a project gets a second approver before invitations arrive at M11. Until then, Tier 3 changes cannot be approved. | Tier 3 changes at M9 | Product owner, security engineer | 02 §10, §17; D-004 |

## M0A (repository bootstrap)

| ID | Item | Blocks | Decides | Where |
| --- | --- | --- | --- | --- |
| OI-020 | Toolchain: confirm pnpm, choose the Node version, formatter and linter (the format hook assumes Prettier), test runners, Playwright for browser tests. | App commands in `CLAUDE.md` and CI | Tech lead | D-008; `intent/INT-00-m0a-repository-bootstrap/intent.md` |
| OI-021 | Pin GitHub Actions to commit SHAs; choose gitleaks action or pinned CLI (the action may need a licence for organization repositories). | CI hardening | Tech lead | `.github/workflows/ci.yml` |
| OI-022 | Confirm D-017 (GitHub Actions for PR checks, Cloud Build and Cloud Deploy for build and promotion). | Pipeline | Tech lead | D-017 |
| OI-023 | Change-ticket system and key format (the production-infra hook expects `^[A-Z]+-[0-9]+$` in `WPI_CHANGE_TICKET`). | Production infrastructure edits | Tech lead | `.claude/hooks/protect_prod_infra.py` |
| OI-024 | Managed settings: who deploys them; minimum Claude Code version (v2.1.284 or later for the models in 06-MODEL-PLAN); the release-authorization hook for production deploys; deploying `secret_scan` and `protect_prod_infra` as managed hooks. | Organization controls | Security engineer | `.claude/hooks/README.md` |
| OI-025 | Eval pass-rate thresholds for build-agent and product-agent evals; the eval runner (claude-code-action through Vertex AI, or managed Code Review). | Merge gates | Tech lead | `evals/` |

M0A toolchain closure, 2026-10-01: pnpm, Node.js 22, Prettier, ESLint, and Vitest are closed by D-021. Playwright is not installed. `pnpm test:e2e` is the placeholder recorded as not run; browser journeys arrive at M3. OI-021's action SHA pin is done. The gitleaks organization-licence question stays open.

M0A close, 2026-10-01: commits `f466a72` and `1f25117` are on `origin/main`. GitHub Actions run `36796058884` passed `governance` (Python 3.12) and `app`. The `secrets` job failed because `gitleaks-action` requires a licence for organization `al-ai-hq`. OI-021 stays open. `.cursorignore` was not changed.

M0B Stage 1, 2026-10-01: OI-001 stays open. The modelled proof uses the combined-cap assumption and labels it unconfirmed. That assumption does not block the Stage 1 proof.

## M0B (contracts, threat model, cost proof)

| ID | Item | Blocks | Decides | Where |
| --- | --- | --- | --- | --- |
| OI-030 | Cost proof (D-019). Stage 1 at M0B: modelled proof with an estimated hosting baseline; set the reserve (ASSUMPTION USD 10), the anonymous sub-budget, and caps for reduced and preview audits. Stage 2 after M1 and M6: measured proof on staging; decide whether the anonymous rich audit is affordable before any public anonymous traffic. | M0B gate (Stage 1); anonymous launch (Stage 2) | Cloud billing owner, product owner | `docs/cost-model.md` §7; `config/budgets.yaml` |
| OI-031 | What the cost guard does when hosting alone approaches the cap (hosting cannot be switched off like a model call). | `config/budgets.yaml` `hosting_overrun` | Cloud billing owner | D-005 |
| OI-032 | Align the rule config keys (`id`, `standards.*`, `evaluation`) with the `RuleDefinition` schema keys (`rule_id`, `pass/partial/fail_condition`, `evaluation_method`), or add a loader mapping. Keep one source of `methodology_version` (it is repeated in 8 config files today). | M2 rules engine | Methodology owner, tech lead | `config/rules/`; `schemas/rule-definition.schema.json` |
| OI-033 | Fill the `partial` standards for scored rules (sources give only pass standards) and the thresholds still marked `<DECIDE_AT_M0>` (priority bands, PRF-002 timing, SEC-002 header list, restrictive max-snippet values, SPAM-001 confirmation). | M2 scoring | Methodology owner | `config/rules/`; `config/scoring.yaml` |
| OI-034 | Fill required and recommended properties per schema type from Google's current docs (all are `to_verify_at_m0b: true`); until then STR-003 returns unavailable. | M2 structured-data rules | SEO lead | `config/schema-requirements.yaml` |
| OI-035 | Verify the 7 policy facts marked `needs_verification` and the 10 crawler documentation URLs marked `<confirm>`. | Client-facing guidance | SEO lead | `config/policy-facts.yaml`; `config/crawler-registry.yaml` |
| OI-036 | **Conflicts with D-002 until decided.** Backups: v1 keeps encrypted backups up to 35 days after deletion, longer than the 7-day anonymous limit. Decide whether anonymous data is excluded from backups or the privacy text explains backup expiry. | Retention compliance | Counsel, privacy owner | `config/retention.yaml`; `docs/retention-deletion-map.md` |
| OI-037 | IAM: verify role names, custom versus predefined roles, CMEK scope, row-level security, how agents access data. | M0B IAM matrix | Security engineer | `docs/iam-matrix.md` |
| OI-038 | Schema follow-ups: an `ExperienceJudgment` schema or an extension of `RuleResult` for rubric judgments; an `x-data-class` annotation keyword; keep or drop the added `PromptPanelRun` and `DeletionRequest` schemas; `DeletionReceipt` gaps (Secret Manager, identity provider and provider-side copies). | M0B contracts | Tech lead, data engineer | `schemas/`; `docs/data-classification.md` |
| OI-040 | Several schemas (for example Approval, ReportModel, Snapshot, ChangeOperation, Verification, DeletionRequest, WebhookEvent) have no `project_id` of their own. Add a nullable `project_id` or write the parent-join rule for each, so project isolation can be tested (D-014). | M0B contracts; isolation tests | Tech lead, security engineer | `schemas/`; D-014 |
| OI-039 | Anonymous eligibility thresholds: velocity and automation signals, cookie windows, retry-after period, CAPTCHA provider, the budget step that downgrades tiers, evidence-reuse window. | M3/M4 anonymous flow | Product owner, security engineer | `config/anonymous-eligibility.yaml`; `docs/anonymous-eligibility-policy.md` |

## Later milestones

| ID | Item | Milestone | Decides | Where |
| --- | --- | --- | --- | --- |
| OI-050 | Experience Effectiveness weights and calibration (all `<DECIDE_AT_M5>`). | M5 | Methodology owner | `docs/rubrics/experience-effectiveness.md` |
| OI-051 | Prompt families: V4 lists nine, the detailed spec six; consolidate. Panel size, repeats, markets and cost allocation per plan. | M6 | Methodology owner, product owner | `config/prompt-panels/` |
| OI-052 | Arabic prompt templates need native review before use. | M6 | Arabic editorial owner | `config/prompt-panels/templates/ar.yaml` |
| OI-053 | Crawl fetch limits config (ports, bytes, redirects, depth, duration) and feature-flag file with kill switches. | M1 | Security engineer, tech lead | `docs/threat-model.md`; `docs/rollback-plan.md` |
| OI-054 | Legal texts: privacy policy, terms, DPA, subprocessor list, cookie notice, gallery consent terms. Not drafted here; counsel must write them. | Before any public traffic | Counsel | `docs/legal/README.md` |
| OI-055 | Phase 0: pick the 10 sites (5 client sites with written owner consent, 5 fixture sites) and run the manual audits to create the labelled evaluation set and golden files. | M2 evals onward | SEO lead | 05 §13; `evals/golden/README.md` |
| OI-056 | Whether a site owner can ask us to delete anonymous audits of their site made by others; whether anonymous links may be shared. | M3 | Counsel, product owner | `docs/threat-model.md` |
