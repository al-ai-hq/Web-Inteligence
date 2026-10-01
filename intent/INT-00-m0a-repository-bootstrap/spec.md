# Spec: M0A repository and governance bootstrap

| Field | Value |
| --- | --- |
| Intent | `intent/INT-00-m0a-repository-bootstrap/intent.md` (status: accepted) |
| Status | approved |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "approved" in this session. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: security engineer (security-baseline), tech lead (toolchain and CI) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; google-search-guidance 0.1.0; arabic-rtl-a11y 0.1.0; connector-safety 0.1.0; marketing-seo-agent vendored snapshot 2026-09-30 (no version field in its SKILL.md) |
| Source sections read | `AGENTS.md`; `CLAUDE.md`; `docs/spec/00-READ-ME-FIRST.md`; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §9, §10, §15; `docs/spec/02-DETAILED-SPECIFICATION.md` §12; `docs/spec/03-PRODUCTION-CONTRACTS.md` (evidence, agent tool boundaries, required configuration); `docs/spec/04-CLAUDE-CODE-BUILD-PROMPT.md` §24; `docs/spec/05-PROJECT-PLAN.md` §5 M0, §8, §9, §11, §12; `docs/spec/06-MODEL-PLAN.md` §1–§7; `docs/spec/07-SKILLS-AND-AGENTS.md` §8–§11; `docs/decisions.md`; `docs/assumptions.md`; `docs/open-items.md`; `docs/test-strategy.md` §4–§5; `docs/rollback-plan.md` §9; `.github/workflows/ci.yml` |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

M0A adds the application toolchain to the start-ready repository so a clean checkout can install, lint, typecheck, and run one real unit test. The package manager is pnpm. Node.js is 22. Formatting is Prettier, linting is ESLint, and unit tests use Vitest. The only implemented package is `apps/web`, with no product pages and no service runtime.

Cursor controls stay beside the Claude Code controls. `.claude/` remains the policy source. Existing schemas, config, hooks, skills, and registers are preserved. `pnpm test:ssrf` and `pnpm test:e2e` exist as placeholders that exit 0 and are recorded as not run. The milestone adds no paid calls, no cloud resources, and no connector or crawler code.

## Requirements

### Functional

1. A pnpm workspace exists at the repository root, with `package.json` `packageManager` set to an exact pnpm version and a committed lockfile. CI installs with `pnpm install --frozen-lockfile`. Source: accepted intent; D-008; `.github/workflows/ci.yml`.
2. `package.json` `engines.node` is `22.x`, which is what `actions/setup-node` reads through `node-version-file: package.json`. Source: accepted intent.
3. Root scripts exist and succeed on a clean install: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:ssrf`, `pnpm test:e2e`. Source: accepted intent; `AGENTS.md`; `docs/test-strategy.md` §4.
4. `pnpm lint` runs ESLint on the TypeScript this milestone adds. It does not lint `docs/`, `config/`, `schemas/`, or `.claude/`. Source: accepted intent.
5. `pnpm typecheck` runs the TypeScript compiler with `strict` true and reports no errors. Source: D-008; `.cursor/rules/wpi-code.mdc`.
6. `pnpm test` runs Vitest and executes at least one real unit test in `apps/web`. The test calls a function this milestone adds and checks its return value. Source: accepted intent; `docs/test-strategy.md` §5 M0A (TS-UNIT).
7. `pnpm test:ssrf` prints a line that contains `not run` and `M1`, then exits 0. `pnpm test:e2e` prints a line that contains `not run` and `M3`, then exits 0. A unit test asserts both the exit code and those words. Source: accepted intent exit gate.
8. `apps/web` is the only workspace package. It has no Next.js app, no React UI, no product route, no copy, and no server script. `services/` and `packages/` are not created as packages. Source: accepted intent.
9. A nested instruction file is added only for `apps/web`. It points back to root `CLAUDE.md` and `AGENTS.md` and adds no weaker rule. Source: accepted intent; `docs/spec/05-PROJECT-PLAN.md` §11.
10. The start-ready tree stays in place: `docs/spec/`, `config/`, `schemas/`, the four registers, `.claude/`, `AGENTS.md`, `.cursor/rules/`, `.cursor/agents/`, `.cursorignore`, `.cursor/hooks.json`, `.cursor/hooks/gate.py`, and the eval layout. `.claude/` is not deleted. `.cursor/skills/*` remain symlinks to `.claude/skills/*`, and a test fails if any of those entries is a regular directory. Source: accepted intent; `AGENTS.md`.
11. The `governance` CI job keeps both hook suites, `scripts/check_schemas.py`, and `scripts/check_config.py`, on Python 3.12. The `secrets` job keeps gitleaks. The `app` job runs the five pnpm commands above once `package.json` exists. Source: `.github/workflows/ci.yml`; accepted intent; A-040.
12. Every `uses:` in `.github/workflows/ci.yml` is pinned to a full commit SHA, with the previous tag kept in a trailing comment. The action major is unchanged. The gitleaks organization-licence question stays open (OI-021). Source: comment in `.github/workflows/ci.yml`; OI-021.
13. `AGENTS.md` and `CLAUDE.md` list the commands that exist after this milestone, and they say that `pnpm test:ssrf` and `pnpm test:e2e` are placeholders recorded as not run. Source: `CLAUDE.md` application-commands section; accepted intent.
14. Implementation appends, and does not rewrite, register rows for: the M0A toolchain acceptance; Cursor as a session surface beside Claude Code (the row `AGENTS.md` already cites as D-020); and a new `docs/spec/06-MODEL-PLAN.md` §8 that states Claude Code aliases are not Cursor picker values, the session records the model name it actually shows, and a missing alias does not fail the milestone. Source: accepted intent; D-018; `docs/spec/06-MODEL-PLAN.md` §7.
15. `release.md` is filled from `intent/_templates/release.md` at the end of implementation. For each command it records passed, failed, or not run. The SSRF and browser placeholders are recorded as not run. `intent/INT-00-m0a-repository-bootstrap/review.diff` is the git diff saved before review. Neither file is part of this specification stage. Source: `docs/spec/05-PROJECT-PLAN.md` §11; `docs/spec/06-MODEL-PLAN.md` §4.
16. No file under `config/agents/` gains a write-class tool. No product code imports `.claude/skills/marketing-seo-agent/scripts`. No rule weight changes, so `methodology_version` stays as it is. Source: D-009; `security-baseline`; `data-integrity`.

### Non-functional

1. Secrets stay out of source, lockfile comments, fixtures, logs, and prompts. `.cursorignore`, `.gitignore`, `secret_scan.py`, and the Cursor read hook stay in force. Source: `security-baseline`; `docs/spec/04-CLAUDE-CODE-BUILD-PROMPT.md` §24.
2. The milestone does not deploy, publish, spend, call a provider, connect a Google Cloud account, or write to a client system. `terraform apply` and `terraform destroy` stay denied. Source: accepted intent; D-016; `.claude/hooks/protect_prod_infra.py`.
3. Hook deny behavior is unchanged. Tests in `.claude/hooks/tests` and `.cursor/hooks/tests` still pass. Source: `docs/spec/05-PROJECT-PLAN.md` §11; `.claude/hooks/README.md`.
4. Dependency install uses the lockfile. New packages are pnpm, TypeScript, ESLint, Prettier, and Vitest, plus the ESLint TypeScript support those tools require. No browser binary and no Playwright download. Source: accepted intent; `docs/threat-model.md` supply-chain row.
5. Cost against the product cap is zero. There is no new paid call and no new Google Cloud resource. Agent build usage is outside the USD 150 product cap. Source: D-005; `cost-guard`; `docs/spec/06-MODEL-PLAN.md` §6.
6. No user-facing screen, Arabic copy, or English copy is added. WCAG 2.2 AA and RTL rules apply when the first screen exists, which is not this milestone. Source: `arabic-rtl-a11y`; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §9.
7. No schema, fidelity label, score, or evidence record is added or changed. `scripts/check_schemas.py` and `scripts/check_config.py` still pass. Source: `data-integrity`; `docs/spec/03-PRODUCTION-CONTRACTS.md`.
8. Rollback of this milestone is a git revert of its commits. There is no deployed revision to roll back. Source: `docs/rollback-plan.md` §8–§9; accepted intent.

## Design

### Components and boundaries

The repository stays one pnpm workspace. Trust boundaries that already exist stay where they are.

| Path | Role in M0A |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Workspace manifest and lockfile |
| `apps/web` | The only package. Strict TypeScript library, one exported function, one Vitest file, one nested instruction file |
| `scripts/placeholders/` | Two node scripts for the SSRF and browser placeholders |
| `.github/workflows/ci.yml` | Same three jobs. Actions pinned to SHAs. `app` becomes live because `package.json` exists |
| `.claude/`, `.cursor/` | Unchanged policy and hook behavior, except the skill-symlink test and the command text in `AGENTS.md` |
| `config/`, `schemas/`, `docs/spec/` except the new §8 | Unchanged product behavior |

`apps/web` does not fetch URLs, read secrets, or call a model. Untrusted page content, CMS content, and provider output do not enter this milestone. The connector write path is not created. The crawler is not created.

Prettier is installed at the repository root so `.claude/hooks/format_changed.py` and the Cursor `afterFileEdit` hook find `node_modules/.bin/prettier`. M0A does not reformat the existing specification tree. The hook formats files changed after Prettier is installed.

### Data contracts

No schema is added or changed. No `$id` changes. Lineage and fidelity fields stay as defined in `docs/spec/03-PRODUCTION-CONTRACTS.md` and `schemas/`.

### State transitions

No workflow state is added. The milestone's own artifact states are the ones in `docs/spec/05-PROJECT-PLAN.md` §12: this spec is `draft` until the product owner sets `approved`. Implementation does not start from this spec alone.

### Configuration

No file under `config/` is added or changed. Model IDs, prices, quotas, and crawler tokens stay in `config/` (D-010). The toolchain versions live in `package.json` and the lockfile, not in audit config.

Register updates happen in the implementation stage, by append:

- `docs/decisions.md`: one row confirming the M0A toolchain (pnpm, Node.js 22, Prettier, ESLint, Vitest, minimal `apps/web`, placeholders recorded as not run), and one row for the Cursor session surface that `AGENTS.md` cites as D-020. Earlier rows stay as written.
- `docs/spec/06-MODEL-PLAN.md`: new §8 only. §1–§7 stay as written.
- `docs/open-items.md`: append a closure note for the decided part of OI-020. Leave OI-021 and the section 7 items in the accepted intent open.
- `docs/assumptions.md` and `docs/sources.md`: append only if implementation needs a new row. A-040 is not rewritten in place.

### UI (if any)

None. No Arabic or English screen, and no mock.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | No product change | No rule, crawler registry, report wording, `llms.txt` score, FAQ requirement, or Autocomplete call is added. | None for M0A. SEO lead review waits for rule work. |
| security-baseline | Yes | Hooks, ignore files, gitleaks, and the agent allowlist stay. No fetch path is added. Placeholders are labeled not run so a green `app` job is not SSRF evidence. Actions are pinned to SHAs. | Security engineer confirms the placeholder wording and the SHA pin before the pull request. |
| arabic-rtl-a11y | No UI | No screen or copy. The first later screen uses logical CSS, `lang`, and `dir`. | None until a screen exists. |
| data-integrity | Yes, by preservation | No new stored number, score, or schema. Existing schema and config checks still pass. No weight change. | None for M0A. |
| cost-guard | Yes, by exclusion | No paid call, schedule, retry, or cloud resource. Product cap exposure is USD 0. | Cloud billing owner has nothing new to approve. OI-001 stays open for M0B. |
| connector-safety | No connector | No write path, approval, or webhook. Agent `tools` lists stay free of write-class names. | None until M9. |

`marketing-seo-agent` is not imported into `apps/web`. Its scripts stay reference implementations (D-009).

## Areas of concern

1. D-008 names Next.js on Cloud Run as the product stack. This milestone's accepted constraint is a minimal `apps/web` with no product pages and no service runtime. The design reserves `apps/web` for that later Next.js app and does not install Next.js now. The tech lead confirms that delay at spec approval.
2. `pnpm test:ssrf` exiting 0 can be mistaken for a passed SSRF suite. The required unit test, the script text, `AGENTS.md`, `CLAUDE.md`, and `release.md` all say the suite is not run. The real suite remains the M1 exit in `docs/spec/05-PROJECT-PLAN.md` §11 and `docs/test-strategy.md` TS-SSRF.
3. `AGENTS.md` cites D-020 and `06-MODEL-PLAN.md` §8, and those texts do not exist yet. This spec defines them. They are appended only during implementation, after the plan is approved. This session's model is Grok 4.7. That name is recorded here and is the example the §8 rule is meant to capture.
4. `.cursor/agents/security-reviewer.md` and `cost-reviewer.md` pin `claude-opus-5[effort=high]`. `.claude/agents/security-reviewer.md` and `docs/spec/06-MODEL-PLAN.md` §4 pin `opus` at `xhigh` for security review. This milestone does not change either pin. The tech lead decides any later alignment.
5. `docs/test-strategy.md` maps TS-EVAL-BUILD and a rollback rehearsal to M0A. `evals/build-agent/README.md` says tasks start after M0A, and no staging project exists. This spec follows the accepted intent and `05` §11. Those suites are recorded as not run. OI-025 stays open.
6. Exact pnpm, TypeScript, ESLint, Prettier, and Vitest versions are whatever the implementation resolves and commits in the lockfile. They are not hard-coded in this spec. ASSUMPTION: ESLint uses its flat config. ASSUMPTION: the `apps/web` package name is `web` and `private` is true.
7. Pinning actions requires the commit SHA that each current tag points at. Those SHAs are looked up at implementation time. This spec does not invent them. The gitleaks licence for an organization repository stays OI-021.
8. Once Prettier is installed, the format hook rewrites later edits. A large format-all of `docs/` is out of scope.
9. Named owners remain `<DECIDE_AT_M0: name>` (OI-002). Policy sign-off on this spec is pending.

## Test and eval plan

Run from a clean checkout after install. Record the command and the result. Do not call a placeholder result a pass of TS-SSRF or TS-E2E.

| Check | Command | Expected |
| --- | --- | --- |
| Claude hook tests | `python3 -m unittest discover -s .claude/hooks/tests` | Pass. The local tool is `.venv/bin/python` when that is the interpreter in use. CI uses Python 3.12. |
| Cursor hook tests | `python3 -m unittest discover -s .cursor/hooks/tests` | Pass, including the new symlink assertion. |
| Schemas | `python3 scripts/check_schemas.py` | Pass. No schema diff. |
| Config | `python3 scripts/check_config.py` | Pass. No config diff. |
| Lint | `pnpm lint` | Exit 0. |
| Typecheck | `pnpm typecheck` | Exit 0 under `strict`. |
| Unit tests | `pnpm test` | Exit 0. Includes the `apps/web` value test and the placeholder-script test. |
| SSRF placeholder | `pnpm test:ssrf` | Exit 0, and `release.md` says not run. |
| Browser placeholder | `pnpm test:e2e` | Exit 0, and `release.md` says not run. |
| Secret scan | `secrets` job in `.github/workflows/ci.yml` | Job present and pinned. Not run locally in this spec. |
| Build-agent evals | `evals/build-agent/` | Not run. No tasks exist. |
| Product-agent evals | `evals/product-agent/` | Not run. No product agent change. |
| Golden files | `evals/golden/` | Not run. No rule or report change. |

Fixtures: none beyond the unit-test input inside `apps/web`. No network fixture, no secret fixture, and no crawled page.

Reviewers before the pull request, from `docs/spec/06-MODEL-PLAN.md` §3: `security-reviewer` and `verifier`. They run in a later stage, after `review.diff` exists. The writer of the change does not review it.

## Rollout and rollback

No feature flag. No deploy. High-risk product modules are absent, so there is nothing to default off.

The change rolls out by merge to `main`. Rollback is `git revert` of the M0A commits. Production monitoring does not apply. The signal that the milestone is in place is a green `governance` job and a green `app` job on the merge commit, with `release.md` listing the placeholder commands as not run.

`make tf-plan` is not an M0A exit command. No environment is created.

## Cost

Paid product calls added: none. Hosting added: none. Estimated new spend against the USD 150 combined cap: `0.00` USD. D-005 stays an assumption (OI-001) and is not decided here.

Registry and GitHub Actions minutes are outside that cap. No budget, price, or quota constant is added to application code.

## Assumptions and open items

ASSUMPTION: ESLint flat config.

ASSUMPTION: the `apps/web` package name is `web` and the package is `private`.

ASSUMPTION: pnpm, TypeScript, ESLint, Prettier, and Vitest versions are the versions committed in the lockfile at implementation.

ASSUMPTION: `.DS_Store` is added to `.gitignore` so the untracked file is not part of the first commit.

Items that stay open, copied from the accepted intent: OI-001, OI-002, OI-003, OI-004, OI-005, OI-010, OI-011, OI-012, OI-013, OI-021, OI-022, OI-023, OI-024, OI-025, the ADK language, `packages/`, branch-protection admin settings, and managed-settings deployment.

OI-020 is partly decided for M0A: pnpm, Node.js 22, Prettier, ESLint, and Vitest. Playwright is not installed. The closure note is appended at implementation.
