# Release: M0A repository and governance bootstrap

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-00-m0a-repository-bootstrap/` |
| Milestone | M0A |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01T00:18:00Z (local proof). Close recorded 2026-10-01 after the push. Not a deploy. |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`. Ibrahim asked to close the M0A record on 2026-10-01. This file stays `draft`.

## Outcome and acceptance status

The M0A exit gate is met for lint, typecheck, unit tests, schema validation, config validation, hook tests, and the action-pin check. Those commands passed locally and again on GitHub Actions for commit `1f25117`. `pnpm test:ssrf` and `pnpm test:e2e` exit 0 and are recorded as not run. Secret scanning is configured and did not pass: the `secrets` job failed because the gitleaks action requires an organization licence (OI-021). That choice stays open. This record does not authorize a release.

## Artifact versions

- Commit SHAs on `origin/main`: `f466a72` (M0A baseline) and `1f25117` (session bootstrap and two plan drafts). Remote: `https://github.com/al-ai-hq/Web-Inteligence`.
- Image digest: none.
- Schema versions: unchanged. 87 schema files.
- `methodology_version`: unchanged. No rule or weight edit.
- Toolchain (D-021): pnpm 12.3.4, Node.js engine `22.x`, TypeScript 6.0.3, ESLint 10.11.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.0, Prettier 3.9.9, Vitest 5.0.2.
- Local interpreter for governance checks: Python 3.14.7 (`.venv/bin/python` and `python3`). CI pins Python 3.12. The `governance` job on run `36796058884` executed that image and passed.

## Migrations

None.

## Files changed

No merged pull request. The path list and contents are in `intent/INT-00-m0a-repository-bootstrap/review.diff`. New application files are the pnpm workspace, `apps/web`, placeholder scripts, ESLint, Vitest, Prettier, and `scripts/check_action_pins.py`.

## Commands and checks actually run

Run on 2026-10-01 from the repository root after the review fixes.

| Command | Result |
| --- | --- |
| `./.venv/bin/python -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests, OK. |
| `./.venv/bin/python -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests, OK. Includes `test_skill_links_point_at_claude_skills`. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schemas, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `./.venv/bin/python scripts/check_action_pins.py` | Passed. `OK: action pins checked in 1 workflow file(s).` |
| `pnpm lint` | Passed. Exit 0. |
| `pnpm typecheck` | Passed. Exit 0. |
| `pnpm test` | Passed. 2 files, 3 tests. |
| `pnpm test:ssrf` | Exit 0. Recorded as not run. Printed `pnpm test:ssrf is not run. The SSRF suite arrives at M1.` |
| `pnpm test:e2e` | Exit 0. Recorded as not run. Printed `pnpm test:e2e is not run. Browser journeys arrive at M3.` |
| `pnpm install --frozen-lockfile` | Passed after the lockfile was refreshed to the pinned versions. |
| GitHub Actions run `36796058884` on `1f25117` | `governance` passed (Python 3.12). `app` passed, including the two placeholders. `secrets` failed: `[al-ai-hq] is an organization. License key is required.` Run `36796033269` on `f466a72` was cancelled when the next push started. |
| `make tf-plan` | Not run. Outside the M0A exit. |

`pnpm test` failed once, before `workspace.ts` and the placeholder scripts existed, and passed after they were added.

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests |
| Unit / integration | yes | | | Vitest: `packageName()` returns `web`; placeholder scripts print the required words and exit 0 |
| SSRF suite | | | yes | Placeholder only. Real suite is the M1 exit |
| Browser journeys | | | yes | Placeholder only. Real suite is the M3 exit |
| Schema and config checks | yes | | | Unchanged product schemas and config |
| Action pin check | yes | | | `scripts/check_action_pins.py` |
| Golden files | | | yes | No rule or report change |
| Product-agent evals | | | yes | No product agent change |
| Build-agent evals | | | yes | No tasks exist (OI-025) |
| Python 3.12 CI image | yes | | | `governance` job on run `36796058884`. Local Python remains 3.14.7 |

## Security, privacy and cost review

`security-reviewer` reported no Critical and no High findings. Medium findings and what was done:

- The `app` job could be skipped by the `detect` job. The `detect` job and its `if:` were removed. `app` always runs.
- Future `uses:` lines were not checked. `scripts/check_action_pins.py` now runs in the governance job and passed locally.
- `.gitignore` now ignores `*.tfvars`, credential JSON names, key files, `.netrc`, and `.git-credentials`, and it re-allows env templates. `.cursorignore` was not changed: the edit was denied in this session.
- `release.md` was missing at review time. This file is that record.

Low findings left open: major-only tag comments, no Corepack integrity hash on `packageManager`, tests excluded from `tsc`, and the gitleaks organization licence (OI-021). The reviewer did not re-resolve the action SHAs and did not run commands. The verifier session could not run the shell, so its command rows are not run. The command results above are from this implementation session.

Privacy: no personal data and no production credentials. Cost against the USD 150 product cap: `0.00` USD. No paid call and no cloud resource.

## Arabic and accessibility evidence

No screen, copy, or document was added. Arabic review and WCAG 2.2 AA evidence are not run.

## Unresolved risks

- `.cursorignore` does not yet list the extra credential patterns that `.gitignore` now lists. Owner: security engineer. The edit was denied in the implementation session. Follow-up: a later intent if the file remains uneditable.
- OI-021 gitleaks licence for organization `al-ai-hq`. Confirmed by the failed `secrets` job on run `36796058884`. Owner: security engineer. Choosing a pinned CLI instead of the action is the same open decision.
- Action SHA comments name the major tag (`v4`, `v5`, `v2`), not an exact release. Owner: tech lead.
- Named owners remain `<DECIDE_AT_M0: name>` (OI-002).
- Rollback has not been rehearsed as a revert.

## Rollback

No production path. Rollback of the published baseline is `git revert` of `1f25117` and then `f466a72`, in that order. Hook scripts were not changed. Staging rehearsal: not run (`docs/rollback-plan.md` §9).

## Monitoring

No service is deployed. No detection band applies. The later signal is a green `governance` job and a green `app` job, with this file still recording the two placeholders as not run.

## Post-release verification

Nothing was deployed. The close check is the GitHub Actions run above: `governance` and `app` passed; `secrets` failed on the known licence gap.

## Decisions, assumptions and open items

Appended, without rewriting earlier rows:

- D-020 and D-021 in `docs/decisions.md`
- A-044 in `docs/assumptions.md`
- M0A toolchain closure note after the OI-020 table in `docs/open-items.md`. OI-021's licence question stays open.
- GitHub Actions pin table in `docs/sources.md`
- §8 in `docs/spec/06-MODEL-PLAN.md`

Departures recorded in `plan.md`: pnpm 12.3.4, TypeScript 6.0.3, the `test:e2e` CI step, removal of the `detect` job, the action-pin script, the `.gitignore` patterns, the denied `.cursorignore` edit, and the commits landing on `main`.

## Close

Ibrahim asked to close M0A on 2026-10-01. The implementation slice is closed. M0B has not started. The smallest human decision still blocking a green `secrets` job is OI-021: store a gitleaks organization licence, or replace the action with a pinned CLI. `.cursorignore` and OI-002 stay open. Proposed next milestone: M0B (`intent/INT-01-m0b-contracts-threat-model-cost-proof/intent.md`), after a Plan-mode review of that draft intent.
