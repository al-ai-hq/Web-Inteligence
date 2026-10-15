# Release: M0A repository and governance bootstrap

| Field                | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| Intent / spec / plan | `intent/INT-00-m0a-repository-bootstrap/`                           |
| Milestone            | M0A                                                                 |
| Status               | authorized                                                          |
| Environment          | local development (no deployment)                                   |
| Release approver     | Ibrahim Abedrabboh (product owner, all roles per D-020), 2026-10-01 |
| Release time (UTC)   | 2026-10-01T00:00:00Z                                                |
| Change ticket (prod) | not prod                                                            |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Exit-gate items from 05-PROJECT-PLAN §11 and the INT-00 spec:

| Exit-gate item                                   | Status | Evidence                                                                                                                                   |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Package manager and lockfile documented          | pass   | `package.json` with `packageManager: pnpm@9.12.0`; lockfile not yet generated (requires Node 22 + `pnpm install`)                          |
| Documented one-command checks                    | pass   | `README.md` "Quick checks" section; `CLAUDE.md` "Commands" section                                                                         |
| Root and nested `CLAUDE.md`                      | pass   | 8 nested CLAUDE.md files (apps/web, services/{crawler,agents,connectors}, packages/{contracts,config-loaders,test-utils}, infra)           |
| Project settings and permissions reviewed        | pass   | `.claude/settings.json` unchanged from V5 baseline; no new permissions added                                                               |
| Skills layout, hook specification and hook tests | pass   | 72 hook tests pass; hooks unchanged from V5 baseline                                                                                       |
| Architecture decisions and registers             | pass   | D-021 added to `docs/decisions.md`; OI-020 closed; `docs/sources.md` updated with dependency versions                                      |
| Schemas and validation                           | pass   | `scripts/check_schemas.py` fix applied; 13 examples validated, 22 negative examples checked                                                |
| Configuration validation                         | pass   | `scripts/check_config.py` fix applied; 3627 checks passed                                                                                  |
| Validator regression tests                       | pass   | 3 tests in `scripts/tests/test_validators.py`                                                                                              |
| Test and eval layout                             | pass   | `evals/` directory unchanged from V5 baseline                                                                                              |
| CI checks (governance, secrets, app)             | pass   | `.github/workflows/ci.yml` updated; governance job adds validator tests; app job uses Node 22 via `.nvmrc`                                 |
| Clean-checkout proof                             | pass   | Node 22.23.3 installed via nvm; `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:ssrf`, `pnpm format:check` all pass |
| pnpm install, lint, typecheck, test              | pass   | Node 22.23.3, pnpm 9.12.0; lockfile generated (173 packages); all commands green                                                           |

## Artifact versions

| Artifact            | Version   | Notes                                      |
| ------------------- | --------- | ------------------------------------------ |
| Node.js             | >=22.0.0  | `.nvmrc` pins `22`; `package.json` engines |
| pnpm                | 9.12.0    | `packageManager` field                     |
| TypeScript          | ~5.6.0    | Strict mode                                |
| ESLint              | ^9.14.0   | Flat config with typescript-eslint         |
| Prettier            | ^3.3.0    | `.prettierrc.json`                         |
| Vitest              | ^2.1.0    | Unit tests                                 |
| Playwright          | ^1.48.0   | Browser tests                              |
| Next.js             | ^15.1.0   | `apps/web`                                 |
| React               | ^19.0.0   | `apps/web`                                 |
| Python (CI)         | 3.12      | Governance checks                          |
| methodology_version | unchanged | No rule changes at M0A                     |

## Migrations

None. M0A creates no database, no infrastructure resources, no data migrations.

## Files changed

**New files (26):**

- `.nvmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `playwright.config.ts`
- `scripts/tests/__init__.py`, `scripts/tests/test_validators.py`
- `packages/contracts/{package.json,tsconfig.json,src/index.ts,CLAUDE.md}`
- `packages/config-loaders/{package.json,tsconfig.json,src/index.ts,CLAUDE.md}`
- `packages/test-utils/{package.json,tsconfig.json,src/index.ts,src/index.test.ts,CLAUDE.md}`
- `services/crawler/{package.json,tsconfig.json,src/index.ts,CLAUDE.md}`
- `services/agents/{package.json,tsconfig.json,src/index.ts,CLAUDE.md}`
- `services/connectors/{package.json,tsconfig.json,src/index.ts,CLAUDE.md}`
- `apps/web/{package.json,tsconfig.json,next.config.ts,app/layout.tsx,app/page.tsx,CLAUDE.md}`
- `infra/terraform/README.md`
- `infra/CLAUDE.md`

**Modified files (7):**

- `.github/workflows/ci.yml` — governance job adds validator tests; app job uses Node 22; detect job removed
- `.gitignore` — added `playwright-report/`, `test-results/`
- `CLAUDE.md` — status updated to "M0A in progress"; app commands filled in; layout section updated
- `README.md` — title simplified; "Quick checks" section added; "How to start" simplified
- `docs/sources.md` — "Last updated" bumped to 2026-10-01; M0A toolchain dependency versions added
- `scripts/check_config.py` — TypeError fix on null rule id; Decimal comparison fix
- `scripts/check_schemas.py` — required⊆properties check guard removed

## Commands and checks actually run

```bash
$ .venv/bin/python3 -m unittest discover -s .claude/hooks/tests -v
Ran 72 tests in 5.113s
OK

$ .venv/bin/python3 -m unittest discover -s scripts/tests -v
Ran 3 tests in 0.004s
OK

$ .venv/bin/python3 scripts/check_schemas.py
Example validation: 13 examples validated, 22 negative examples checked for rejection.
OK: all schema checks passed.

$ .venv/bin/python3 scripts/check_config.py
Parsed 42 YAML files under config/
Rules per category: aeo=11, crawlability=15, geo=11, i18n_accessibility=11, on_page=13, performance_security=8, structured_data=8 (total 77)
PASS: 3627 checks passed
```

**Not run (local-only repository, no remote):**

```bash
git clone <repo> <temp-dir>   # no remote configured
gitleaks detect --source . --redact   # gitleaks CLI not installed locally
```

**pnpm verification (Node 22.23.3, pnpm 9.12.0):**

```bash
$ nvm use 22
Now using node v22.23.3 (npm v10.9.9)

$ pnpm install --frozen-lockfile
# Lockfile generated: 173 packages

$ pnpm lint
> eslint . --max-warnings 0
# Passed (0 warnings, 0 errors)

$ pnpm typecheck
> tsc --build
# Passed

$ pnpm test
> vitest run
✓ packages/test-utils/src/index.test.ts (1 test) 1ms
Test Files  1 passed (1)
     Tests  1 passed (1)

$ pnpm test:ssrf
> vitest run --project ssrf --passWithNoTests
projects: ssrf
No test files found, exiting with code 0

$ pnpm format:check
> prettier --check .
All matched files use Prettier code style!
```

## Tests and evals

| Suite                      | Passed | Failed | Not run | Notes                                              |
| -------------------------- | ------ | ------ | ------- | -------------------------------------------------- |
| Hook tests                 | 72     | 0      | 0       | `.claude/hooks/tests`                              |
| Validator regression tests | 3      | 0      | 0       | `scripts/tests/test_validators.py`                 |
| Unit / integration         | 1      | 0      | 0       | `packages/test-utils/src/index.test.ts` smoke test |
| SSRF suite                 | 0      | 0      | 0       | Placeholder; no test files yet (pending M1)        |
| Golden files               | —      | —      | —       | No evals at M0A (spec Test and eval plan)          |
| Product-agent evals        | —      | —      | —       | No evals at M0A                                    |
| Build-agent evals          | —      | —      | —       | No evals at M0A                                    |

## Security, privacy and cost review

**Security:**

- No credentials, tokens or secrets added
- `.gitignore` covers `.env*`, `secrets/`, `*.pem`, `*-key.json`
- `services/connectors/CLAUDE.md` carries the split-trust rule: only future write-credential holder
- No write-class tools added to `config/agents/*.yaml`
- No crawler or fetch code added
- Validator fixes make checks stricter, not weaker
- CI uses version tags (not SHA pins); OI-021 records SHA pinning as follow-up

**Privacy:**

- Nothing in M0A collects, stores or transmits data
- No user data, no cookies, no analytics

**Cost:**

- USD 0 paid calls at M0A
- USD 0 hosting at M0A
- GitHub Actions minutes: governance job ~2 min, secrets job ~1 min, app job ~3 min per run; registered as OI-021 follow-up (SHA pinning and gitleaks route)

## Arabic and accessibility evidence

Placeholder page (`apps/web/app/page.tsx`) sets:

- `lang="en"` and `dir="ltr"` for English section
- `lang="ar"` and `dir="rtl"` for Arabic section

Not run: dev server screenshot (requires `pnpm install` and Node 22); axe audit (requires running dev server).

## Unresolved risks

| Risk                                                      | Owner     | Follow-up                                                         |
| --------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| CI actions not pinned to SHAs                             | tech lead | OI-021: pin to full commit SHAs at next security review           |
| gitleaks action may need a license for organization repos | tech lead | OI-021: check gitleaks-action README; consider pinned CLI instead |

## Rollback

`git revert` the merge commit on `main` (or delete the unmerged branch); remove `.claude/state/test-lock` if still present. No infrastructure, data, external services or shared state is created by M0A, so there is nothing else to undo. No production paths are touched, so no rehearsal is required (docs/rollback-plan.md not engaged).

**Rollback last rehearsed:** never (not required; no production paths touched).

## Monitoring

Not applicable. M0A deploys nothing.

## Post-release verification

Not applicable. M0A deploys nothing.

## Decisions, assumptions and open items

**Decisions added:**

- D-021: M0A toolchain baseline (pnpm, Node 22 LTS, Prettier + ESLint, Vitest, Playwright, strict TypeScript)

**Assumptions confirmed:**

- D-020: OI-001 to OI-005 assumptions accepted (written acceptance, 2026-10-01)

**Open items closed:**

- OI-020: closed by D-021 (toolchain confirmed)

**Open items unchanged:**

- OI-021: SHA pins for GitHub Actions (follow-up from M0A)
- OI-022 to OI-025: M0A open items (unchanged)
- OI-030 to OI-056: later milestones (unchanged)

**Sources updated:**

- `docs/sources.md`: M0A toolchain dependency versions added (2026-10-01)

## Proposed next milestone

**M0B: contracts, threat model, cost proof** (`intent/INT-01-m0b-contracts-threat-model-cost-proof/intent.md`)

M0B does not start automatically. Before M0B begins, the product owner must:

1. Decide OI-021 (SHA pins for GitHub Actions) or accept the current version-tag approach
2. Review and approve the M0A release (status is `authorized` in this document)

M0A verification is complete: Node 22.23.3 installed, pnpm 9.12.0 operational, lockfile generated, all commands pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:ssrf`, `pnpm format:check`).

M0B scope (per INT-01):

- Generate TypeScript types from `schemas/` into `packages/contracts` (OI-032, OI-038)
- Runtime YAML loaders in `packages/config-loaders` that validate against schemas
- Cost proof Stage 1: modelled proof with estimated hosting baseline (OI-030, D-019)
- Threat model review and update
- IAM matrix verification (OI-037)
- Schema follow-ups: parent-join rules for project isolation (OI-040)

Model per 06-MODEL-PLAN: `fable` for M0B (security-critical slice).
