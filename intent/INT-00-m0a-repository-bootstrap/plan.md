# Plan: M0A repository and governance bootstrap

| Field | Value |
| --- | --- |
| Spec | `intent/INT-00-m0a-repository-bootstrap/spec.md` (status: approved) |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Engineer approval | Ibrahim, 2026-10-01, by approving the M0A implementation plan and asking to implement it. |
| Tech lead approval | Ibrahim, 2026-10-01, same approval. The named tech-lead role remains `<DECIDE_AT_M0: name>` (OI-002). |
| Branch | `main`. Commits `f466a72` and `1f25117` are on `origin/main`. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

The whole approved M0A spec, in one slice. There is no smaller slice that satisfies the exit gate: the checkout needs the package manifest, the lockfile, the five commands, the one real unit test, the two placeholders, the CI pin, and the recorded results together.

No product pages, no Next.js install, no service runtime, no schema or config change, no hook-policy change, and no M0B work.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `package.json` | Create | Spec FR-1, FR-2, FR-3. `packageManager`, `engines.node` = `22.x`, root scripts. |
| `pnpm-workspace.yaml` | Create | Spec FR-1, FR-8. Members: `apps/web` only. |
| `pnpm-lock.yaml` | Create after the approved install | Spec FR-1. CI uses `--frozen-lockfile`. |
| `apps/web/package.json` | Create | Spec FR-8. `"name": "web"`, `"private": true`. |
| `apps/web/tsconfig.json` | Create | Spec FR-5. `strict` true. |
| `apps/web/src/workspace.ts` | Create after its test | Spec FR-6. One exported function. |
| `apps/web/src/workspace.test.ts` | Create before `workspace.ts` | Spec FR-6. Asserts the function's return value. |
| `apps/web/src/placeholders.test.ts` | Create before the scripts | Spec FR-7. Asserts exit 0 and the required words. |
| `apps/web/CLAUDE.md` | Create | Spec FR-9. Points at root `CLAUDE.md` and `AGENTS.md`. Adds no weaker rule. |
| `scripts/placeholders/ssrf.mjs` | Create after its test | Spec FR-7. Prints `not run` and `M1`, exits 0. |
| `scripts/placeholders/e2e.mjs` | Create after its test | Spec FR-7. Prints `not run` and `M3`, exits 0. |
| `eslint.config.js` | Create | Spec FR-4. Flat config. Lints `apps/web` and `scripts` only. |
| `vitest.config.ts` | Create | Spec FR-6. Runs the `apps/web` tests from the root `pnpm test`. |
| `.prettierrc.json` | Create | Accepted toolchain. Root install so `node_modules/.bin/prettier` exists. |
| `.prettierignore` | Create | Spec concern 8. Keeps Prettier off `docs/`, `config/`, `schemas/`, and the existing governance tree. |
| `.github/workflows/ci.yml` | Pin every `uses:` to a full commit SHA; keep the tag in a trailing comment; update the "until M0A" header | Spec FR-11, FR-12. |
| `.gitignore` | Add `.DS_Store` | Spec assumption. |
| `AGENTS.md` | Replace only the application-commands paragraph | Spec FR-13. |
| `CLAUDE.md` | Replace only the application-commands paragraph | Spec FR-13. |
| `.cursor/hooks/tests/test_gate.py` | Add one symlink test | Spec FR-10. |
| `docs/decisions.md` | Append D-020 and D-021 | Spec FR-14. Do not edit D-001 through D-019. |
| `docs/spec/06-MODEL-PLAN.md` | Append §8 | Spec FR-14. Do not edit §1–§7. |
| `docs/open-items.md` | Append the OI-020 toolchain closure | Spec FR-14. Leave the original row in place. |
| `docs/assumptions.md` | Append A-044 | ESLint flat config and package name `web`. Do not edit A-040. |
| `docs/sources.md` | Append the action-SHA sources | Spec concern 7. Checked date is the implementation date. |
| `intent/INT-00-m0a-repository-bootstrap/review.diff` | Create after the slice is complete, before reviewers | Spec FR-15. |
| `intent/INT-00-m0a-repository-bootstrap/release.md` | Create from `intent/_templates/release.md` after reviewers | Spec FR-15. |

Do not change `config/`, `schemas/`, `.claude/hooks/*.py`, `.claude/settings.json`, `.cursor/hooks.json`, `.cursor/hooks/gate.py`, `.cursor/agents/`, `.cursorignore`, or `intent/INT-01-m0b-contracts-threat-model-cost-proof/`.

## Order of work

Implementation starts only after this plan is approved. `pnpm install` is on the repository ask list. Stop and let the human approve that command when the hook asks. Do not install during plan review.

1. Add the symlink test to `.cursor/hooks/tests/test_gate.py`. It lists the eight directories in `.cursor/skills/` and fails unless each is a symlink into `.claude/skills/`. Run `.venv/bin/python -m unittest discover -s .cursor/hooks/tests`. This test should pass before any other edit, because the symlinks already exist (spec FR-10).
2. Add root `package.json`, `pnpm-workspace.yaml`, `apps/web/package.json`, `apps/web/tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `.prettierrc.json`, and `.prettierignore`. Set `engines.node` to `22.x`. If `pnpm --version` prints a 9.x or 10.x version, set `packageManager` to `pnpm@` plus that exact version. If `pnpm` is missing, stop and ask for pnpm 10 to be installed. Do not install Next.js, React, or Playwright (spec FR-1, FR-2, FR-4, FR-5, FR-8).
3. Write `apps/web/src/workspace.test.ts` and `apps/web/src/placeholders.test.ts` before the function and the scripts. The placeholder test runs `node scripts/placeholders/ssrf.mjs` and `node scripts/placeholders/e2e.mjs` and expects exit 0 plus the words below (spec FR-6, FR-7).
4. Ask approval, then run `pnpm install` once to write `pnpm-lock.yaml`. Dev dependencies are pnpm's TypeScript, ESLint, `typescript-eslint`, Prettier, and Vitest only (spec non-functional 4).
5. Run `pnpm test` and confirm the new tests fail because `workspace.ts` and the placeholder scripts are absent.
6. Add `apps/web/src/workspace.ts` exporting one function whose return value the test already names. Add `scripts/placeholders/ssrf.mjs` printing `pnpm test:ssrf is not run. The SSRF suite arrives at M1.` Add `scripts/placeholders/e2e.mjs` printing `pnpm test:e2e is not run. Browser journeys arrive at M3.` Both scripts exit 0. Wire root scripts: `lint`, `typecheck`, `test`, `test:ssrf`, `test:e2e` (spec FR-3, FR-6, FR-7).
7. Add `apps/web/CLAUDE.md`. Add `.DS_Store` to `.gitignore` (spec FR-9 and the gitignore assumption).
8. Resolve each current action tag to its commit SHA with `gh` and pin it in `.github/workflows/ci.yml`. Tags stay in trailing comments. Majors stay: `actions/checkout@v4`, `actions/setup-python@v5`, `gitleaks/gitleaks-action@v2`, `pnpm/action-setup@v4`, `actions/setup-node@v4`. If `gh` cannot authenticate, stop and ask. Do not invent a SHA. Leave the gitleaks licence question as OI-021 (spec FR-12, concern 7).
9. Replace only the application-commands paragraph in `AGENTS.md` and `CLAUDE.md`. State the five commands, state that the two placeholders are recorded as not run, and keep `make tf-plan ENV=dev` as a documented command outside the M0A exit (spec FR-13).
10. Append D-020 and D-021 to `docs/decisions.md`. Append §8 to `docs/spec/06-MODEL-PLAN.md`. Append the OI-020 note, A-044, and the SHA sources. Texts are fixed below (spec FR-14).
11. Run the proof commands. Paste real output into the later pull request. Do not reformat `docs/` (spec test plan, concern 8).
12. Write `review.diff` for the paths in the Files table. The repository has no base commit, so include `git diff` for modified files and a no-index diff for new files. Do not put the whole start-ready tree in that diff (spec FR-15).
13. Run `security-reviewer` and `verifier` from `.cursor/agents/`. The writer does not review the change. Address material findings in this same slice and update this plan if the files change (06-MODEL-PLAN §3).
14. Fill `release.md`. Record `pnpm test:ssrf` and `pnpm test:e2e` as not run. Stop. Do not start M0B. Do not commit or push unless the user asks.

### Register text to append

D-020, date 2026-10-01, status decided: Cursor sessions use `AGENTS.md` and `.cursor/` beside Claude Code. `.claude/` remains the policy source. Claude Code aliases in `docs/spec/06-MODEL-PLAN.md` are not Cursor picker values. The session records the model name it actually shows. A missing alias does not fail the milestone.

D-021, date 2026-10-01, status decided: M0A toolchain is pnpm, Node.js 22, Prettier, ESLint, and Vitest. The only implemented package is `apps/web`, with no product pages and no service runtime. `pnpm test:ssrf` and `pnpm test:e2e` exit 0 and are recorded as not run. This decision does not choose later-milestone tooling.

§8 title: Cursor model picker. State that the picker has no `fable`, `opus`, `opusplan`, `sonnet`, or `haiku` alias. Map risk from §2 to the strongest model the picker shows. Record the name the session shows. Propose a decisions-register append for any substitution. Do not change shared settings before that append is approved. Note that this session's Stage 1 model was Grok 4.7.

OI-020 append, without deleting the original row: toolchain choices for M0A are closed by D-021. Playwright is not installed. The browser command is the M3 placeholder.

A-044: ESLint flat config, and the `apps/web` package name `web` with `private` true. Confirms: tech lead. Where used: `eslint.config.js`, `apps/web/package.json`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A green `app` job is read as SSRF coverage | Medium | Script text, unit test, `AGENTS.md`, `CLAUDE.md`, and `release.md` say not run | Security engineer, at the reviewer step |
| Action SHA lookup is wrong or offline | Medium | Use `gh` against the current tag. Stop if it fails. Do not type a SHA from memory | Tech lead |
| `pnpm install` pulls more than the five tools | Medium | Declare only TypeScript, ESLint, `typescript-eslint`, Prettier, and Vitest. Review the lockfile diff | Tech lead |
| Prettier reformats the specification tree | Low | `.prettierignore` plus no format-all command | Tech lead |
| First `review.diff` swallows the untracked start-ready tree | Medium | Diff only the Files table paths | Verifier |
| D-020 is appended twice | Low | Append only if the ID is still absent | Author of the implementation |
| Hook policy is weakened to get a green check | Low | No edits to hook scripts or `.cursor/hooks.json`. Existing hook tests must pass | Security reviewer |

## Proof

Local interpreter: `./.venv/bin/python`. CI uses Python 3.12. Run both the local interpreter and, if `python3` is a different version, report that version. Paste real output. A placeholder exit of 0 is recorded as not run in `release.md`.

```bash
./.venv/bin/python -m unittest discover -s .claude/hooks/tests
./.venv/bin/python -m unittest discover -s .cursor/hooks/tests
./.venv/bin/python scripts/check_schemas.py
./.venv/bin/python scripts/check_config.py
pnpm lint
pnpm typecheck
pnpm test
pnpm test:ssrf
pnpm test:e2e
```

No browser screenshot. No Arabic or English UI. No eval run. No `make tf-plan`. No `terraform` command. No `gcloud` command.

## Security, privacy, cost, Arabic/accessibility review

`security-reviewer` reads `review.diff` and checks: no fetch path, no secret, no write-class tool, no import of `marketing-seo-agent` scripts, no hook or ignore-file weakening, action SHAs present, and the SSRF placeholder labeled not run.

`verifier` runs the proof commands, compares each Files row and each order step with the tree, and checks the four registers were appended rather than rewritten.

Cost: `0.00` USD against the product cap. No Arabic or accessibility evidence, because there is no screen. Privacy: no personal data and no production credentials.

## Rollback

No production path and no deployed revision. After a commit, rollback is `git revert` of the M0A commits. Before any commit, rollback is to delete the created paths in the Files table and restore the modified paths from git. Hook files are not part of the change, so they stay. This rollback is not a staging rehearsal. `docs/rollback-plan.md` §9 stays a later cadence. `release.md` says the staging rehearsal was not run.

## Departures from the plan

- 2026-10-01: `pnpm --version` is 12.3.4, which is outside the plan's 9.x or 10.x branch. `packageManager` is `pnpm@12.3.4`, the version that writes the lockfile. pnpm was already installed, so implementation did not stop to ask for pnpm 10.
- 2026-10-01: `pnpm install` resolved TypeScript 7.0.2. `typescript-eslint` 8.71.0 cannot lint that compiler. TypeScript is pinned to the resolved 6.0.3. The other dev dependencies are pinned to the versions `pnpm list` printed on 2026-10-01.
- 2026-10-01: `.github/workflows/ci.yml` `app` job also runs `pnpm test:e2e`. The approved spec requires that command in the app job. The previous workflow stopped at `pnpm test:ssrf`.
- 2026-10-01: After security review, the `detect` job was removed so the `app` job cannot be skipped, `scripts/check_action_pins.py` was added to the governance job, and `.gitignore` gained credential filename patterns. `.cursorignore` could not be edited in this session (write denied) and is unchanged.
- 2026-10-01: The first commit landed on `main`, not on `m0a-repository-bootstrap`. Ibrahim asked to push to `https://github.com/al-ai-hq/Web-Inteligence`.
- 2026-10-01: Ibrahim asked to close M0A. Plan status is `done`. `release.md` stays `draft` and does not authorize a release. GitHub Actions run `36796058884` passed `governance` and `app` and failed `secrets` on the gitleaks organization licence (OI-021).
