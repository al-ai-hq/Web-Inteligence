# Intent: M0A repository and governance bootstrap

Status: accepted (recorded in-session; no pull request in this local-only repository).

| Field | Value |
| --- | --- |
| ID | INT-00 |
| Status | accepted — by Ibrahim Abedrabboh, product owner, in conversation on 2026-10-01 (per `.claude/skills/intent-spec-plan/SKILL.md`: human approved in conversation, recorded here) |
| Author (originator) | Ibrahim Abedrabboh (product owner) |
| Product owner | Ibrahim Abedrabboh (D-020: holds all owner roles until others are named) |
| Tech lead | Ibrahim Abedrabboh (D-020) |
| Milestone | M0A (05-PROJECT-PLAN §11) |
| Ticket | <tracker ID, or "none"> |
| Created | 2026-09-30 |
| Risk class | high-risk: sets permissions, hooks, CI and the path to production infrastructure |

## Problem

The repository holds the specifications (`docs/spec/`), configuration drafts (`config/`), JSON Schemas (`schemas/`), governance documents (`docs/`), Claude Code hooks and skills (`.claude/`), templates and eval layout. It has no application baseline yet: no package manifest or lockfile, no documented one-command checks, and the `app` job in `.github/workflows/ci.yml` does not run. A Claude Code session can read the rules but cannot yet prove that a clean checkout builds and passes its checks.

## Proposed outcome

From 05-PROJECT-PLAN §11 (M0A): the real application repository baseline exists, with:

- package manager and lockfile, and the documented commands (install, lint, typecheck, unit tests, SSRF suite placeholder);
- root and nested `CLAUDE.md`, project settings and reviewed permission rules in `.claude/settings.json`;
- the skills layout, hook specification and hook tests (`.claude/hooks/`);
- architecture decisions and the source, assumption, decision and open-item registers (`docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, `docs/sources.md`);
- schemas and their validation (`scripts/check_schemas.py`), configuration validation (`scripts/check_config.py`);
- test and eval layout (`evals/`), and CI checks (`governance`, `secrets`, `app`).

## Affected users and systems

Engineers and reviewers; every Claude Code session in this repository; GitHub Actions CI; the organization's managed Claude Code settings.

## Constraints

- Stack per D-008: strict TypeScript, Next.js on Cloud Run, Cloud Run Jobs, Cloud Tasks, Pub/Sub, Workflows, Cloud SQL for PostgreSQL, Cloud Storage, Secret Manager, KMS, Cloud Armor, Terraform. Identity Platform is the candidate identity provider, not yet decided (D-011). ASSUMPTION: pnpm as package manager, to confirm here.
- No application features in M0A: no crawling, no provider calls, no connector work before the foundation exit gate (05 §9).
- No hard-coded model IDs, prices, quotas or crawler tokens (D-010). Region, identity provider, first connector and runtime model providers stay placeholders (D-011).
- Development uses synthetic data only; no production credentials in dev or staging (05 §5 M0, §8).
- Claude Code controls (05 §11; 04-CLAUDE-CODE-BUILD-PROMPT §24): dangerous, destructive, secret-reading, production and broad network operations are denied by default; hooks are deterministic, versioned and tested; no bypass-permissions mode.
- Third-party GitHub Actions are pinned to full commit SHAs (comment in `.github/workflows/ci.yml`).
- Policy skills that apply: `security-baseline`, `cost-guard`, `intent-spec-plan`.

## Out of scope

Application pages, services, crawler, rules engine, provider adapters, connectors, Terraform for production. Those start after M0B.

## Exit gate

From 05-PROJECT-PLAN §11: a clean checkout can run documented lint, typecheck, unit tests, schema validation, secret scanning, and hook tests; results are recorded (in this intent's `release.md`).

The wider M0 exit also applies once M0A and M0B are done (05 §5): one harmless change completes the full artifact and review chain; canonical sources remain unchanged; budget and access boundaries are demonstrable.

## Open questions

- Confirm pnpm and choose the Node.js version (recorded in `package.json` for CI). Owner: tech lead.
- Workspace layout under `apps/`, `services/`, `packages/`, and whether ADK agents are TypeScript or Python. Owner: tech lead.
- Formatter and linter choice. `format_changed.py` assumes Prettier; confirm or change the hook. Owner: tech lead.
- Test runners for unit, browser (Playwright is referenced in the specs) and the SSRF suite. Owner: tech lead and security engineer.
- Secret scanning in CI: gitleaks-action or the pinned gitleaks CLI; licence need for an organization repository. Owner: security engineer.
- Who deploys the managed settings and managed hooks (`secret_scan.py`, `protect_prod_infra.py`, a release-authorization hook), and with which minimum Claude Code version. Owner: security engineer.
- Branch protection, code owners and required checks on `main`. Owner: tech lead.
- Change-ticket system and key format for `WPI_CHANGE_TICKET` (the hook expects `^[A-Z]+-[0-9]+$`). Owner: release manager.
- Named owners for product, methodology, security, privacy, data integrity, Arabic editorial quality, cloud billing, provider policy, connectors, content approval, production publishing, accessibility and incident response (07-SKILLS-AND-AGENTS §8).

Resolution status at acceptance (2026-10-01): the toolchain questions (pnpm, Node 22 LTS, Prettier + ESLint, Vitest + Playwright, workspace layout, ADK agents in TypeScript) are answered by D-021; the named-owners question is answered by D-020 (product owner holds all roles for now). The remaining questions (gitleaks route and licence, managed-settings deployment, branch protection, `WPI_CHANGE_TICKET` format) move into `spec.md` as open items for the engineer who approves the plan.
