# Spec: M0A repository and governance bootstrap

| Field | Value |
| --- | --- |
| Intent | `intent/INT-00-m0a-repository-bootstrap/intent.md` (status: accepted, 2026-10-01) |
| Status | approved |
| Author | Qoder agent session 7ad412ff-ada7-4dd7-a092-b42da4ea0df7, 2026-10-01 |
| Product owner sign-off | approved by Ibrahim Abedrabboh (product owner, D-020), 2026-10-01 |
| Policy owner sign-offs | security engineer: security-baseline approved, 2026-10-01; cloud billing owner: cost-guard approved, 2026-10-01; data engineer: data-integrity approved, 2026-10-01. All roles held by the product owner per D-020; sign-offs recorded per role. |
| Spec prompt version | Stage 2 prompt shape in `.claude/skills/intent-spec-plan/SKILL.md` v0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; cost-guard 0.1.0; data-integrity 0.1.0. Assessed and not applied: google-search-guidance, arabic-rtl-a11y, connector-safety, marketing-seo-agent (see Policy conformance). |
| Source sections read | docs/spec/00-READ-ME-FIRST; 01 §9, §14; 02 §12, §13, §17, §18; 03-PRODUCTION-CONTRACTS ("Agent tool boundaries", "Workflow states"); 04-CLAUDE-CODE-BUILD-PROMPT §24; 05-PROJECT-PLAN §5, §9, §11, §12; 06-MODEL-PLAN §1, §5; 07-SKILLS-AND-AGENTS §8; 09-MERGE-DECISIONS; `docs/decisions.md` D-001–D-021; `docs/open-items.md`; `docs/assumptions.md`; `docs/threat-model.md`; `docs/cost-model.md`; `docs/test-strategy.md`; `docs/environments.md`; `.claude/hooks/README.md`; `.claude/settings.json`; `.github/workflows/ci.yml`; `scripts/check_schemas.py`; `scripts/check_config.py` |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

M0A turns this governance-only repository into a runnable application baseline without adding any product feature. It adds the pnpm workspace, lockfile, strict TypeScript configuration, lint and format configs, unit and browser test runners, and the documented one-command checks; it wires the `app` CI job so a clean checkout proves lint, typecheck, unit tests, schema validation, secret scanning and hook tests. The workspace skeleton (`apps/web`, `services/{crawler,agents,connectors}`, `packages/{contracts,config-loaders,test-utils}`, `infra/terraform`) is created empty, with nested `CLAUDE.md` files that carry the split-trust and policy rules into each directory. Governance toolchain defects found in the pre-M0A audit (validator crash, skipped schema check, CI dependency duplication, tag-pinned actions) are fixed as part of the baseline. No crawling, no provider calls, no connector work, no deployed infrastructure (05 §9); the exit gate is the recorded clean-checkout proof in `release.md`.

## Requirements

### Functional

1. pnpm workspace with committed `pnpm-lock.yaml`; `package.json` records the package manager (corepack) and Node 22 LTS in `engines`; `.nvmrc` matches (D-021; 05 §11).
2. Workspace layout per D-021: `apps/web` (Next.js, strict TypeScript, single placeholder page), `services/crawler`, `services/agents`, `services/connectors`, `packages/contracts`, `packages/config-loaders`, `packages/test-utils` as skeleton packages with no application logic, `infra/terraform/{dev,staging,prod}` as empty module skeletons (05 §9, §11).
3. Documented commands in `README.md` and root `CLAUDE.md`: install, lint, typecheck, unit tests, browser tests, `test:ssrf` (placeholder), schema validation, config validation, secret scan, hook tests; each runs from a clean checkout (05 §11 exit gate).
4. Strict TypeScript throughout: root `tsconfig.base.json` with `strict` and recommended strictness flags; every workspace package extends it (D-008).
5. ESLint (flat config) and Prettier at the root, applied to all workspaces; `.claude/hooks/format_changed.py` keeps its Prettier assumption unchanged (D-021; OI-020).
6. Vitest for unit tests with at least one passing smoke test per workspace package; Playwright installed and configured for browser tests (D-021; 02 §19 test layout).
7. `pnpm test:ssrf` exists as a documented placeholder suite that reports "pending M1" and exits successfully; the real SSRF suite lands with the M1 crawler (intent deliverable 1; `.claude/skills/security-baseline` checklist).
8. Nested `CLAUDE.md` in `apps/web`, each `services/*`, `packages/*` and `infra/` stating local rules; `services/connectors/CLAUDE.md` states that only this service may hold write credentials and that no agent holds write-class tools (03 "Agent tool boundaries"; 02 §13).
9. Root `CLAUDE.md` updated with the real app commands; `.claude/settings.json` permission rules reviewed and re-confirmed in the phase report (intent deliverable 2).
10. CI (`.github/workflows/ci.yml`): the `app` job runs install, lint, typecheck and unit tests on Node 22; the `governance` job keeps running hook tests, `check_schemas.py` and `check_config.py` and installs Python dependencies from `requirements-dev.txt` instead of duplicated inline lists; the `secrets` job keeps scanning; all third-party actions are pinned to full commit SHAs per the workflow's own comment (intent deliverable 7; OI-021 partial).
11. Governance toolchain fixes: `scripts/check_config.py` no longer crashes (TypeError) on a missing or `None` rule id and its messages match its Decimal comparison; `scripts/check_schemas.py` applies the required⊆properties check also when a schema omits `"type": "object"` (pre-M0A audit findings; intent deliverables 5 and 6).
12. Registers stay current: D-020 and D-021 are appended, OI-001..OI-005 and OI-020 are closed, A-001/A-012/A-040 are marked (done at spec stage; `docs/decisions.md`, `docs/open-items.md`, `docs/assumptions.md`).

### Non-functional

1. No application features: no crawling, no provider or model calls, no connector code, no production infrastructure (05 §9; intent "Out of scope").
2. No hard-coded model IDs, prices, quotas or crawler tokens in any new file (D-010); new configuration carries source, checked date and owner where applicable.
3. Synthetic data only; no production credentials in any environment; nothing new reads secrets (05 §5, §8; security-baseline "Secrets and credentials").
4. Reproducible bootstrap: lockfile with integrity hashes, pinned `packageManager`, pinned action SHAs, single documented Node version (05 §11; security-baseline).
5. Cost: M0A adds USD 0 paid calls and USD 0 hosting against the combined USD 150 monthly cap (D-005, confirmed by D-020; cost-guard checklist item 4). See Cost.
6. Security: new package scripts and CI steps introduce no network fetch of untrusted content at build time beyond package registry installs with lockfile integrity; `secret_scan.py` coverage is unchanged and green (security-baseline; `.claude/hooks/README.md`).
7. Accessibility and RTL: out of scope for product UI (none exists); the placeholder page still sets valid `lang`/`dir` and passes axe-level basics so later UI work starts clean (arabic-rtl-a11y, minimal application).

## Design

### Components and boundaries

- pnpm workspaces. Dependency direction: `apps/web` and `services/*` may depend on `packages/*`; `packages/*` never depend on `apps/` or `services/`; nothing depends on `apps/web`.
- `packages/contracts`: placeholder for TypeScript types generated from `schemas/`; generation itself is M0B work (OI-032, OI-040). Skeleton only.
- `packages/config-loaders`: placeholder for runtime loaders of `config/` YAML validated against `schemas/`; skeleton only.
- `packages/test-utils`: shared fixtures and helpers; starts empty with a smoke test.
- Trust boundary (documented, not yet enforced by code): `services/connectors` is the only future holder of write credentials; every other service and all agents are read-only against client systems (03 "Agent tool boundaries"). The boundary is carried by nested `CLAUDE.md` rules and the existing `agent_allowlist_guard.py` hook.
- No new runtime trust boundaries: M0A deploys nothing, stores no data, and fetches nothing except package installs.

### Data contracts

None added or changed. `schemas/` content is untouched at M0A (validator robustness fixes in requirement 11 change checking behavior, not contracts); schema content fixes belong to M0B (OI-032, OI-040). `config/` product YAML is untouched; the CRW-011 fidelity-label conflict and the anonymous-eligibility degradation-step mismatch found in the audit stay open for M0B methodology work.

### State transitions

None. No `docs/state-machines.md` workflow is created or modified; M0A produces repository artifacts, not records.

### Configuration

New root and workspace files only: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.base.json`, per-package `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, `playwright.config.ts`, per-package manifests, `infra/terraform/{dev,staging,prod}` placeholders, and the CI workflow edit. No `config/` product YAML changes. No model IDs, prices, quotas or tokens anywhere (D-010).

### UI (if any)

One placeholder page in `apps/web` ("WPI — repository bootstrap"), bilingual Arabic/English static text with correct `lang`/`dir`, no product functionality. It is not product UI; no mocks are required (ASSUMPTION; see Areas of concern for confirmation).

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | No | No crawler, no SEO method code, no Search content at M0A (05 §9). | None. |
| security-baseline | Yes | Secrets stay out of source control (`.gitignore`, gitleaks job); no production credentials; actions pinned to SHAs; lockfile integrity; split-trust boundary documented in `services/connectors/CLAUDE.md`; permission rules in `.claude/settings.json` re-reviewed. | Hooks fail open when `python3` is missing (audit finding); managed-settings deployment owner and minimum Claude Code version unnamed; branch protection pending a remote. See Areas of concern. |
| arabic-rtl-a11y | Minimal | Placeholder page sets `lang`/`dir` correctly in both languages; no product UI to audit. | None. |
| data-integrity | Yes (governance data) | Registers stay append-only with dated marks; no schemas, numbers, scores or reports added; validator fixes make existing checks stricter, never looser. | `check_schemas.py` and `check_config.py` fixes change tooling behavior; data engineer confirms the stricter checks. |
| cost-guard | Yes | USD 0 paid calls, USD 0 hosting added; CI minutes noted against the cap question in Areas of concern; no scheduled jobs added. | Whether GitHub Actions minutes (once a remote exists) count inside the D-005 combined cap is undecided. |
| connector-safety | No | No connector code; `services/connectors` is an empty skeleton carrying the write-credential rules. | None. |

## Areas of concern

1. **Runtime mismatch (owner: tech lead).** This work is executed in Qoder, not Claude Code: `.claude/settings.json` permissions and `.claude/hooks/` do not fire natively here. Verification is the hook test suite plus self-enforced discipline; the phase report must record the actual runtime, and the managed-settings deployment question (who deploys, minimum Claude Code version) stays open for the security engineer.
2. **Node version skew (owner: tech lead).** D-021 decided Node 22 LTS; the development machine currently runs Node 24 (v24.x via nvm). The plan must either switch the machine to Node 22 via `.nvmrc` or the tech lead revisits D-021 before implementation.
3. **Python version skew (owner: tech lead).** CI pins Python 3.12; the local virtualenv is Python 3.14.7. Governance checks pass on 3.14.7 today; ASSUMPTION: keep CI at 3.12 and treat 3.14.x compatibility as best-effort until a failure appears.
4. **Hooks fail open without python3 (owner: security engineer).** On a machine without `python3`, Claude Code hook invocations would error and, depending on configuration, not block. Options: document `python3` as a hard prerequisite, or make hooks fail closed. Decide before managed settings are deployed.
5. **Validator strictness change (owner: data engineer).** Requirement 11 makes `check_schemas.py` apply required⊆properties even without `"type": "object"` and stops `check_config.py` crashing on bad rule ids. Stricter checks may surface new findings in existing files; those findings are fixed or registered, not silenced.
6. **Secret-scanning route (owner: security engineer).** OI-021 stays open: gitleaks-action may need a licence for organization repositories. ASSUMPTION: use the pinned gitleaks CLI in CI (no licence question, full SHA pinning) unless the security engineer chooses otherwise.
7. **No remote, no branch protection (owner: tech lead).** The repository is local-only by owner choice. Creating a GitHub remote, pushing, branch protection, code owners and required checks are human actions outside this spec's execution scope; ASSUMPTION: a feature branch plus human review of the diff substitutes for a pull request until a remote exists.
8. **CI minutes and the cap (owner: cloud billing owner).** Once a remote exists, private-repo GitHub Actions minutes beyond the free tier cost money outside Google Cloud. Whether they count inside the D-005 combined USD 150 cap is undecided.
9. **`WPI_CHANGE_TICKET` format (owner: release manager).** The hook expects `^[A-Z]+-[0-9]+$`; the tracker and key format are unchosen. No M0A work depends on it.
10. **Stale plan drafts kept (owner: product owner, informational).** `intent/_plans/` holds two stale drafts from a previous workspace, kept by owner decision at the first commit; they are referenced nowhere and must not be treated as current plans.

## Test and eval plan

- Existing governance suites must stay green, run with the repository virtualenv: `.venv/bin/python -m unittest discover -s .claude/hooks/tests` (72 hook tests), `.venv/bin/python scripts/check_schemas.py` (87 schemas, 13 examples, 22 negative examples), `.venv/bin/python scripts/check_config.py` (3627 checks). After requirement 11, the two validators gain regression tests for the fixed cases (invalid/None rule id; required-key check without `"type": "object"`).
- New: Vitest smoke tests in every workspace package (`pnpm test`), lint (`pnpm lint`), typecheck (`pnpm typecheck`), Playwright placeholder (`pnpm test:browser` installs browsers on demand), SSRF placeholder (`pnpm test:ssrf`, reports pending M1).
- Clean-checkout proof (exit gate): fresh `git clone`, `pnpm install`, then every documented command in requirement 3; full command output is pasted into `intent/INT-00-m0a-repository-bootstrap/release.md` (05 §11).
- No product-agent or golden-file evals at M0A; `evals/` layout is unchanged (05 §11; `evals/README.md`).

## Rollout and rollback

- Work lands on a feature branch (ASSUMPTION: `m0a/bootstrap`) and is merged locally after human review of the diff, substituting for a pull request until a remote exists (Areas of concern 7).
- No feature flags: M0A ships no product code. No environments are touched: development only, nothing deployed (docs/environments.md).
- Rollback is `git revert` of the milestone commits; there is no infrastructure, data or external state to roll back.
- Monitoring signal: the `app` CI job passes on the merge commit once a remote exists; locally, the clean-checkout proof in `release.md` is the signal.

## Cost

USD 0 paid calls and USD 0 hosting added. No Google Cloud resources are created, no provider or model is called, and no schedule runs. The only prospective cost is GitHub Actions minutes after a remote is created (Areas of concern 8). The combined USD 150 monthly cap (D-005, confirmed by D-020) is untouched.

## Assumptions and open items

- ASSUMPTION: the `apps/web` placeholder page is not product UI and needs no approved mocks (requirement: Design / UI).
- ASSUMPTION: pinned gitleaks CLI for the `secrets` job unless the security engineer decides otherwise (Areas of concern 6).
- ASSUMPTION: feature branch plus human diff review substitutes for a pull request while the repository is local-only (Areas of concern 7).
- ASSUMPTION: CI Python stays 3.12 with local 3.14.x tolerated while green (Areas of concern 3).
- ASSUMPTION: CI Node matches D-021 (22 LTS) once the skew in Areas of concern 2 is resolved.
- To copy into `docs/open-items.md` after approval (new IDs): hooks fail-open without `python3` (security engineer); branch protection, code owners and required checks once a remote exists (tech lead); GitHub Actions minutes vs the D-005 cap (cloud billing owner); `WPI_CHANGE_TICKET` tracker and key format (release manager); managed-settings deployment owner and minimum Claude Code version (security engineer).
- Already tracked: OI-021 (gitleaks route and licence), OI-032 and OI-040 (schema/config alignment, `project_id` coverage; M0B), OI-022 (confirm D-017 pipeline), plus the register updates D-020/D-021 recorded at this spec's stage.
