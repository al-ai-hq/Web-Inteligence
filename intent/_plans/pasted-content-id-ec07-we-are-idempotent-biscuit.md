# M0A Readiness Report and Implementation Plan

Status: draft for human approval. Nothing below has been implemented. Per `intent-spec-plan` and the user's instructions, this session stops here and waits for explicit approval before touching any application file.

## Context

The repository (`/Users/ibrahimabedrabboh/V5-start-Claude`) is the V5 "start-ready" package for Website Presence Intelligence: specifications, schemas, config, governance docs, and Claude Code tooling all exist, but there is no application code, no package manifest, no git history, and CI's `app` job cannot run yet. The user asked to begin milestone **M0A — Repository and Governance Bootstrap** (`intent/INT-00-m0a-repository-bootstrap/intent.md`), starting in plan mode, and to stop for explicit approval before implementing. This document is the readiness report and the M0A plan the user asked for, combined, so a single approval can unlock implementation.

---

## 1. Repository status and current contents

- **Not a git repository.** `git status` fails with "not a git repository". Per `README.md` step 1, M0A's first act is `git init` and the first commit.
- **No application code, no `package.json`, no lockfile, no `pnpm-workspace.yaml`.** `find` confirms none exist anywhere in the tree.
- **Governance layer is complete and currently passing:**
  - `.claude/settings.json`: plan mode default, `opusplan`/`high`, permission allow/ask/deny lists, sandbox with an explicit npm/PyPI/GitHub/Google/Terraform allow-list, 8 hooks wired (6 PreToolUse on Edit|Write, 3 on Bash, 1 PostToolUse).
  - `.claude/hooks/` — 8 hook scripts + `tests/test_hooks.py` (72 tests). **Ran now: `./.venv/bin/python -m unittest discover -s .claude/hooks/tests` → 72 passed, 0 failed.**
  - `schemas/` — 87 JSON Schemas with examples. **Ran now: `./.venv/bin/python scripts/check_schemas.py` → 87 files checked, 13 examples validated, 22 negative examples correctly rejected, OK.**
  - `config/` — 42 YAML files (77 rules across 7 categories, 18 agent tool allowlists, providers, crawler registry, budgets, retention, prompt panels, connectors). **Ran now: `./.venv/bin/python scripts/check_config.py` → 3627 checks passed, OK.**
  - `docs/` — decisions (D-001..D-019), assumptions (A-001..A-043), open items (OI-001..OI-056), threat model, IAM matrix, cost model, retention map, test strategy, rollback plan, state machines.
  - `.claude/skills/` — 7 policy skills + vendored `marketing-seo-agent`.
  - `.claude/agents/` — 7 subagent definitions matching `06-MODEL-PLAN.md` §4.
  - `.github/workflows/ci.yml` — `governance` job runs today; `secrets` (gitleaks) runs today; `app` job is gated on `package.json` existing (via a `detect` job) and will activate the moment M0A adds one.
- **Toolchain present on this machine (not yet pinned in the repo):** Node v24.18.1 (nvm), pnpm 12.3.4, corepack 11.16.0, npm 11.16.0, git 2.54.0, system `python3` 3.14.7 (Homebrew, **no** `pyyaml`/`jsonschema` installed), and a project `.venv` (already gitignored) with `pyyaml` 6.0.3 and `jsonschema` 4.26.0 — this is what made the governance checks above actually runnable.
- **Claude Code version:** 2.1.286, above the 06-MODEL-PLAN §1 minimum of v2.1.284.
- **`.claude/state/` does not exist** — no test-lock currently set.

## 2. Applicable requirements and constraints (from intent.md, 05 §11, 04 §24, docs registers)

- Deliver: package manager + lockfile + documented commands; root `CLAUDE.md` (present) and permission rules (present, to be reviewed); skills/hooks (present); decisions/assumptions/open-items/sources registers (present, to be appended); schema/config validation (present, passing); test/eval layout (present); CI governance+secrets+app checks.
- No application features in M0A (no crawling, no provider calls, no connector work).
- No hard-coded model IDs, prices, quotas, crawler tokens (D-010) — region/identity/connector/model-provider stay `<DECIDE_AT_M0: ...>` placeholders.
- Dev uses synthetic data only; no production credentials.
- Dangerous/destructive/secret-reading/production/broad-network ops denied by default; hooks deterministic, versioned, tested; no bypass-permissions mode.
- Third-party GitHub Actions pinned to full commit SHAs (intent.md constraint, OI-021).
- Policy skills that apply to M0A: `security-baseline`, `cost-guard`, `intent-spec-plan`.
- Exit gate (05 §11, test-strategy §5): a clean checkout runs lint, typecheck, unit tests, schema validation, secret scanning, and hook tests, with results recorded.

## 3. Confirmed decisions (already settled; M0A must not relitigate)

- D-001 (V4 is product authority), D-008 (stack: TypeScript/Next.js/Cloud Run/..., pnpm ASSUMPTION), D-009 (no Autocomplete/result scraping), D-010 (no hard-coded model facts), D-014 (project isolation), D-017 (GitHub Actions for PR checks; Cloud Build/Deploy for promotion — ASSUMPTION, confirmed by user this session for M0A purposes), D-018 (Claude Code model assignments per 06-MODEL-PLAN).
- User's pasted instructions for this session: Opus 5.5 high effort leads planning; Sonnet 5.5 implements after approval; a separate Opus 5.5 context reviews independently — consistent with 06-MODEL-PLAN's M0A row (`opusplan`, high; reviewers `security-reviewer` [opus, xhigh], `verifier` [sonnet, high]).

## 4. Decisions requiring human approval (answered this session, recorded here for the record)

| # | Decision | This session's answer | Where it lands |
|---|---|---|---|
| 1 | Model discrepancy: mid-session the harness reported the active model as "Sonnet 5" (`claude-sonnet-5`) instead of Opus 5.5, and 06-MODEL-PLAN's alias table names "Sonnet 5.5" (not "Sonnet 5") | **Noted, not silently resolved.** Continuing in this session. Recorded as a new open item (below) for the tech lead to recheck model availability/aliases per 06-MODEL-PLAN §7 and close OI-003. This report itself was substantially produced once the harness had already switched; the user should treat any planning judgment in this document as needing the tech lead's confirmation that model identity, not just model capability, was as intended. | New OI; `docs/decisions.md` note at M0A close |
| 2 | Node version for `engines.node` / CI | **Node 22 (Active LTS)**, not the locally installed Node 24 | `package.json`, `.github/workflows/ci.yml` (`setup-node` reads `engines.node`) |
| 3 | CI Action pinning (OI-021) | **Pin now**, in M0A: every `uses:` in `ci.yml` moves to a full commit SHA (tag kept in a trailing comment), including `gitleaks/gitleaks-action`. The gitleaks **licence** question (org-repo requirement) stays a separate open item for whoever owns GitHub org billing — it is not an engineering choice this session can make | `.github/workflows/ci.yml` |
| 4 | Workspace scaffolding (OI-020) | **Real placeholder workspace now**: `apps/web`, `services/crawler`, `services/agents`, `services/connectors` as pnpm workspace packages, each with one trivial `.ts` file and one passing test, so `pnpm lint/typecheck/test` are genuine, CI-enforced commands on day one, not no-ops | New `package.json`, `pnpm-workspace.yaml`, four package folders |

## 5. Recommended assumptions (conservative, reversible, do not change product scope/security/architecture/cost)

- **Formatter/linter:** Prettier (already assumed by `format_changed.py`, A-040) + ESLint (flat config) with `@typescript-eslint`. Reversible: swapping either only touches `package.json` devDependencies and two config files.
- **Test runner:** Vitest for unit tests (fast, native ESM/TS, works well in a pnpm workspace); Playwright reserved for later browser/E2E milestones per `docs/test-strategy.md` (not installed at M0A — no browser tests exist yet). `pnpm test:ssrf` is a **placeholder script** at M0A (`echo "no SSRF suite yet (M1)" && exit 0`) since the crawler doesn't exist until M1 — this satisfies "documented commands" without fabricating a suite that has nothing to test yet. This is flagged explicitly in `plan.md`, not hidden.
- **TypeScript config:** `strict: true`, isolated per-package `tsconfig.json` extending a root `tsconfig.base.json`; `moduleResolution: "bundler"`, ES2022 target — ordinary, reversible defaults for a Next.js + Node services monorepo.
- **Package manager version pin:** `packageManager` field in root `package.json` set to the pnpm version installed here (`pnpm@12.3.4`), per Corepack convention; CI's `pnpm/action-setup@<sha>` reads it with no explicit version argument, matching `ci.yml`'s existing comment.
- **gitleaks in CI:** keep `gitleaks/gitleaks-action`, pin its SHA; do **not** attempt to resolve the licence question (org decision, out of an engineering session's authority) — record as a new open item rather than guessing.
- **Eval pass-rate thresholds (OI-025):** left as `<DECIDE_AT_M0: ...>` — not an M0A engineering decision; `evals/build-agent/` stays empty (per its own README: "None yet. The first tasks come from INT-00 and INT-01 once they merge"), so no threshold is enforceable yet regardless.
- **CODEOWNERS / branch protection:** add a minimal `CODEOWNERS` file at M0A (low-risk, reversible, and directly supports "a code owner approves the PR, never the agent that wrote it" — 05 §12/§17). Actual branch-protection *settings* on GitHub are an org/admin action outside this session's tool access; note this as a manual step for the tech lead.

## 6. Proposed M0A implementation plan

### Scope of this slice
Repository and governance bootstrap only: git init, package manager + lockfile, minimal real workspace packages (no product logic), CI `app` job activation, CODEOWNERS, docs-register updates. No crawler, no rules engine, no UI, no provider calls — matches intent.md "Out of scope".

### Files expected to be created or changed

| Path | Change | Why |
|---|---|---|
| `.git/` | Created (`git init`, initial commit) | README step 1; nothing to diff against otherwise |
| `package.json` (root) | New | Workspace root, scripts (`lint`, `typecheck`, `test`, `test:ssrf` placeholder), `packageManager`, `engines.node` |
| `pnpm-workspace.yaml` | New | Declares `apps/*`, `services/*` |
| `pnpm-lock.yaml` | New (generated by `pnpm install`) | Reproducible installs; CI uses `--frozen-lockfile` |
| `tsconfig.base.json`, per-package `tsconfig.json` | New | Strict TypeScript (CLAUDE.md conventions) |
| `.eslintrc`/`eslint.config.*`, `.prettierrc` | New | Documented lint/format commands |
| `vitest.config.ts` (root, or per-package) | New | Documented unit-test command |
| `apps/web/`, `services/crawler/`, `services/agents/`, `services/connectors/` | New, minimal placeholder packages (one `.ts` + one passing `.test.ts` each) | Makes `pnpm lint/typecheck/test` real from day one; matches the planned layout in root `CLAUDE.md` |
| `.github/workflows/ci.yml` | Edit | Pin every `uses:` to a full commit SHA (tag kept as trailing comment); no logic change otherwise — `app` job already gates on `package.json` existing and will now run |
| `CODEOWNERS` | New | Supports "a code owner approves the PR" (05 §17) |
| `CLAUDE.md` | Edit | Replace the "Application commands are created at M0A" placeholder section with the real, now-true commands; note Node 22/pnpm pin |
| `docs/decisions.md` | Append only | D-020 (Node 22), D-021 (CI action pinning approach), any other M0A decision — never rewrite D-001..D-019 |
| `docs/assumptions.md` | Append only | Formatter/linter/test-runner choices, `test:ssrf` placeholder note |
| `docs/open-items.md` | Append/close | Close OI-020, OI-021, OI-022 (mark `closed by D-0xx`); add the new model-discrepancy open item; leave OI-023/OI-024/OI-025 open (org/security-engineer decisions, not this session's to make) |
| `docs/sources.md` | Append | Node 22 LTS status, pnpm/corepack version checked today |
| `intent/INT-00-m0a-repository-bootstrap/intent.md` | Edit | Fill originator/product-owner/tech-lead placeholders **only if the user supplies names**; otherwise leave as `<DECIDE_AT_M0: ...>` — never invented |
| `intent/INT-00-m0a-repository-bootstrap/spec.md` | New | Per `intent-spec-plan` skill, stage 2 (written and approved *before* this plan, if the process is followed strictly — see note below) |
| `intent/INT-00-m0a-repository-bootstrap/plan.md` | New | This plan, formalized from the template, once approved |
| `intent/INT-00-m0a-repository-bootstrap/review.diff` | New, after implementation | `git diff` saved before reviewer subagents run (06-MODEL-PLAN §4) |
| `intent/INT-00-m0a-repository-bootstrap/release.md` | New, after review | Phase report per 04 §24 |

**Process note:** `.claude/skills/intent-spec-plan/SKILL.md` prescribes `intent.md → spec.md → plan.md`, one stage at a time, with a stop for approval after each. The user's pasted instructions directly requested a plan-mode readiness report + plan in one pass and explicitly said to remain in plan mode until they approve "the final plan" — I am treating that as the user's explicit override of the skill's one-stage-at-a-time cadence for this milestone (their instruction takes precedence over the skill per `CLAUDE.md`/skill precedence rules), while still writing `spec.md` and `plan.md` as real committed artifacts once implementation starts, so the audit trail the skill requires still exists. If the user instead wants the strict stage-by-stage flow (intent acceptance → spec approval → plan approval, as three separate approval points), say so and I will split this into those three stops.

### Order of work (after approval)

1. `git init`; add `.gitignore` is already present; first commit of the current tree as-is (baseline).
2. Write `intent/INT-00.../spec.md` from the template (stage 2), citing 05 §11, 04 §24, this report's decisions.
3. Write `intent/INT-00.../plan.md` from the template (stage 3), mirroring this document.
4. Root tooling: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint/Prettier configs, Vitest config.
5. `pnpm install` (ask-gated per `.claude/settings.json` — will prompt).
6. Minimal placeholder packages in `apps/web`, `services/crawler`, `services/agents`, `services/connectors`, each with one passing test.
7. Update `.github/workflows/ci.yml`: pin `uses:` lines to commit SHAs (requires resolving each tag to a SHA — done via `git ls-remote` against the public actions repos, not a guess).
8. Add `CODEOWNERS`.
9. Update `CLAUDE.md` commands section, `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md`, `docs/sources.md` (append-only).
10. Run every check (governance + new app checks); record real output.
11. Save `git diff` as `intent/INT-00.../review.diff`.
12. Run reviewer subagents: `security-reviewer` (settings/hooks/CI/package supply chain) and `verifier` (runs the checks, compares against `plan.md`) — per 06-MODEL-PLAN §3 M0A row. This is the "separate Opus 5.5 context for independent review" the user asked for (`security-reviewer` is configured as `opus`, `xhigh`).
13. Address material findings.
14. Write `intent/INT-00.../release.md` (phase report).
15. Stop at the M0A exit gate; do not start M0B.

### Tests and validation commands

```bash
# Governance (already passing today, rerun after every change):
./.venv/bin/python -m unittest discover -s .claude/hooks/tests
./.venv/bin/python scripts/check_schemas.py
./.venv/bin/python scripts/check_config.py

# New application checks, once package.json exists:
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:ssrf   # placeholder exit-0 script at M0A; real suite arrives at M1
```

All commands will actually be run and their real output pasted into the phase report — per CLAUDE.md, "Never claim a check passed without its command and output."

### Security, privacy, cost, Arabic/RTL, accessibility, rollback considerations

- **Security:** no secrets introduced (hooks + CI gitleaks already gate this); CI action pinning closes a real supply-chain gap that exists today (tags, not SHAs); no change to `.claude/settings.json` permission/sandbox model; `test:ssrf` stays an explicit placeholder, never a fabricated pass.
- **Privacy:** no data of any kind flows in M0A; all new code is scaffolding.
- **Cost:** Node/pnpm/CI changes have no runtime cost; `cost-guard` skill is not triggered (no paid calls added).
- **Arabic/RTL/accessibility:** not applicable — no UI exists yet; `arabic-rtl-a11y`/`rtl-a11y-checker` are not part of the M0A reviewer set per 06-MODEL-PLAN.
- **Rollback:** the whole milestone is additive scaffolding on a brand-new repo; rollback is `git revert` of the M0A commit(s) — no production system exists to roll back.

## 7. Risks and blockers

- **Model identity discrepancy** (see §4.1) — the tech lead should recheck aliases before M0B, which needs `fable`.
- **Gitleaks org licence** unresolved — CI's `secrets` job may need `GITLEAKS_LICENSE` for an organization-owned repo; unknown until the repo is pushed to its final GitHub org.
- **No named owners yet** (OI-002) — intent.md's originator/product-owner/tech-lead fields stay placeholders unless the user supplies names now.
- **`test:ssrf` has nothing to test until M1** — documented as a placeholder, not hidden, but flag it so nobody mistakes it for real SSRF coverage.
- **Branch protection / required checks on `main`** cannot be configured by this session (no GitHub admin API access requested or authorized) — a manual step for the tech lead after the repo is pushed.

## 8. M0A acceptance criteria (from 05-PROJECT-PLAN §11, test-strategy §5)

A clean checkout (after `pnpm install`) runs, with real recorded output:
1. `pnpm lint` — passes
2. `pnpm typecheck` — passes
3. `pnpm test` (TS-UNIT, on the placeholder packages) — passes
4. `./.venv/bin/python scripts/check_schemas.py` (TS-SCHEMA) — passes (already does)
5. `./.venv/bin/python scripts/check_config.py` (TS-CONFIG) — passes (already does)
6. gitleaks / secret scan (TS-SUPPLY partial) — passes
7. `./.venv/bin/python -m unittest discover -s .claude/hooks/tests` (TS-HOOK) — passes (already does)
8. CI's `app` job activates (no longer skipped by the `detect` job) and is green on a real PR.

## 9. Smallest questions still needing a human decision

1. **Names** for intent.md's `<DECIDE_AT_M0: product owner name>` / tech lead / originator — leave as placeholders, or supply them now?
2. **Gitleaks licence**: does this GitHub org already have one, or should `secrets` job stay on the free-tier action and risk a future failure?
3. Should `CLAUDE.md`'s "Application commands are created at M0A" section be rewritten now to state the real commands as confirmed facts (recommended), or kept as an ASSUMPTION pending a second look after `pnpm install` actually runs once?

---

**Nothing above has been implemented.** Awaiting explicit approval of this plan before creating/editing any application file, running `git init`, or running `pnpm install`.
