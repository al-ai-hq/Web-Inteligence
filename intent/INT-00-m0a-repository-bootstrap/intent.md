# Intent: M0A repository and governance bootstrap

Status: accepted.

| Field | Value |
| --- | --- |
| ID | INT-00 |
| Status | accepted |
| Author (originator) | <DECIDE_AT_M0: product owner name> |
| Product owner | <DECIDE_AT_M0: name> |
| Tech lead | <DECIDE_AT_M0: name> |
| Milestone | M0A (05-PROJECT-PLAN §11) |
| Ticket | none |
| Created | 2026-09-30 |
| Amended | 2026-10-01, in session. The five amendments and the M0A toolchain choices below were accepted, then this file was reviewed. |
| Accepted | Ibrahim, 2026-10-01, by the message "accept" in this session. Product owner name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Risk class | high-risk: sets permissions, hooks, CI and the path to production infrastructure |

## Problem

The repository holds the specifications (`docs/spec/`), configuration drafts (`config/`), JSON Schemas (`schemas/`), governance documents (`docs/`), Claude Code hooks and skills (`.claude/`), Cursor rules, skills, agents and hooks (`.cursor/`, `AGENTS.md`), templates and the eval layout. `.claude/` remains the policy source. Cursor sessions follow `AGENTS.md` and `.cursor/` beside those Claude Code controls.

It has no application baseline yet: no package manifest or lockfile, no documented commands that a clean checkout can run, and the `app` job in `.github/workflows/ci.yml` does not run. A Claude Code session and a Cursor session can read the rules. Neither can yet prove that a clean checkout builds and passes its checks.

## Proposed outcome

From 05-PROJECT-PLAN §11 (M0A).

### Already present (preserve)

The start-ready tree already contains:

- specifications in `docs/spec/`
- configuration in `config/`
- JSON Schemas in `schemas/` and `scripts/check_schemas.py`
- configuration validation in `scripts/check_config.py`
- registers `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md` and `docs/sources.md`
- root `CLAUDE.md`, `.claude/settings.json`, the skills layout, the hook specification and `.claude/hooks/` tests
- `AGENTS.md`, `.cursor/rules/`, `.cursor/skills/` (links to `.claude/skills/`), `.cursor/agents/`, `.cursorignore`, `.cursor/hooks.json` and `.cursor/hooks/` tests
- CI jobs `governance` and `secrets` in `.github/workflows/ci.yml`
- the eval layout (`evals/`)

M0A preserves this tree. It does not recreate it, and it does not delete `.claude/`.

### M0A creates

- a package manager and lockfile, and the documented commands (install, lint, typecheck, unit tests, an SSRF-suite placeholder and a browser-test placeholder)
- a minimal workspace whose only implemented package is `apps/web`, with no product pages and no service runtime
- the `app` job in CI, live once `package.json` exists
- third-party GitHub Actions pinned to full commit SHAs
- nested instruction files only where a package exists; they must not weaken the root rules
- recorded command results in this intent's `release.md`, written at the end of implementation

## Affected users and systems

Engineers and reviewers; every Claude Code session and every Cursor session in this repository; GitHub Actions CI; the organization's managed Claude Code settings. Cursor sessions follow `AGENTS.md` and `.cursor/`. `.claude/` remains the policy source for both tools.

## Constraints

- Stack per D-008: strict TypeScript, Next.js on Cloud Run, Cloud Run Jobs, Cloud Tasks, Pub/Sub, Workflows, Cloud SQL for PostgreSQL, Cloud Storage, Secret Manager, KMS, Cloud Armor, Terraform. Identity Platform is the candidate identity provider, not yet decided (D-011).
- Toolchain accepted for M0A only, on 2026-10-01: pnpm; Node.js 22 recorded in `package.json`; Prettier; ESLint; Vitest; a minimal `apps/web` with no product pages and no service runtime. `pnpm test:ssrf` and `pnpm test:e2e` are placeholders that exit 0 and are recorded as not run. These choices apply to M0A. They do not decide later milestones.
- No application features in M0A: no crawling, no provider calls, no connector work before the foundation exit gate (05 §9).
- No hard-coded model IDs, prices, quotas or crawler tokens (D-010). Region, identity provider, first connector and runtime model providers stay placeholders (D-011).
- Development uses synthetic data only; no production credentials in dev or staging (05 §5 M0, §8).
- Claude Code controls stay (05 §11; 04-CLAUDE-CODE-BUILD-PROMPT §24): dangerous, destructive, secret-reading, production and broad network operations are denied by default; hooks are deterministic, versioned and tested; no bypass-permissions mode. Cursor controls in `AGENTS.md` and `.cursor/` stay beside them.
- Claude Code aliases in `docs/spec/06-MODEL-PLAN.md` are Claude Code values. A Cursor session records the model name the session actually shows and proposes an update to that file. A missing alias does not fail M0A. `AGENTS.md` cites D-020 and §8 of `06-MODEL-PLAN.md`. `docs/decisions.md` still ends at D-019, and `06-MODEL-PLAN.md` still ends at §7. Appending the decision row and the Cursor picker section waits for an approved plan.
- Third-party GitHub Actions are pinned to full commit SHAs (comment in `.github/workflows/ci.yml`).
- Policy skills that apply: `security-baseline`, `data-integrity`, `cost-guard`, `intent-spec-plan`.

## Out of scope

Application pages, services, crawler, rules engine, provider adapters, connectors, and Terraform for production. Those start after M0B.

Also out of scope for M0A: M0B contracts and the cost proof; live Google Cloud; `terraform apply`; provider calls; the identity-provider choice; the ADK language choice; eval thresholds; branch-protection admin changes; managed-settings deployment.

## Exit gate

From 05-PROJECT-PLAN §11: a clean checkout can run documented lint, typecheck, unit tests, schema validation, secret scanning, and hook tests; results are recorded in this intent's `release.md`.

Hook tests include both `.claude/hooks/tests` and `.cursor/hooks/tests`. `pnpm test:ssrf` and `pnpm test:e2e` are placeholders that exit 0. `release.md` records each command as passed, failed, or not run. The two placeholders are recorded as not run. The M1 exit owns the real SSRF suite.

The wider M0 exit also applies once M0A and M0B are done (05 §5): one harmless change completes the full artifact and review chain; canonical sources remain unchanged; budget and access boundaries are demonstrable.

## Open questions

These stay open. They do not block this amended intent.

- Secret scanning in CI: gitleaks-action or the pinned gitleaks CLI; licence need for an organization repository. Owner: security engineer. (OI-021)
- Who deploys the managed settings and managed hooks (`secret_scan.py`, `protect_prod_infra.py`, a release-authorization hook), and with which minimum Claude Code version. Owner: security engineer. (OI-024)
- Branch protection, code owners and required checks on `main`. Owner: tech lead.
- Change-ticket system and key format for `WPI_CHANGE_TICKET` (the hook expects `^[A-Z]+-[0-9]+$`). Owner: release manager. (OI-023)
- Named owners for product, methodology, security, privacy, data integrity, Arabic editorial quality, cloud billing, provider policy, connectors, content approval, production publishing, accessibility and incident response (07-SKILLS-AND-AGENTS §8). (OI-002)
- Workspace members beyond the minimal `apps/web`, including `packages/` and whether ADK agents are TypeScript or Python. Owner: tech lead.
- Confirm D-017 (GitHub Actions for pull-request checks; Cloud Build and Cloud Deploy for promotion). M0A wires GitHub Actions only. Owner: tech lead. (OI-022)
- Google Cloud organization and region, identity provider, runtime AI providers, and confirmation of the USD 150 cap. Owners as in `docs/open-items.md`. (D-011, OI-001, OI-010, OI-011, OI-013)

## Links

- Spec: `intent/INT-00-m0a-repository-bootstrap/spec.md` (after acceptance)
- Plan: `intent/INT-00-m0a-repository-bootstrap/plan.md` (after spec approval)
- Release: `intent/INT-00-m0a-repository-bootstrap/release.md` (after merge)
