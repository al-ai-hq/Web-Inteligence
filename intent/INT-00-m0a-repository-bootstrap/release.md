# Release: M0A repository and governance bootstrap

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-00-m0a-repository-bootstrap/` |
| Milestone | M0A |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01T00:18:00Z (record time for this session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

The M0A exit gate is met for the commands that were run on this machine. A clean checkout can install from the lockfile and run lint, typecheck, unit tests, schema validation, config validation, secret-scanning configuration, hook tests, and the action-pin check. `pnpm test:ssrf` and `pnpm test:e2e` exit 0 and are recorded as not run. There is no pull request and no commit yet. This record does not authorize a release.

## Artifact versions

- Commit SHA: none. The repository still has no commits.
- Image digest: none.
- Schema versions: unchanged. 87 schema files.
- `methodology_version`: unchanged. No rule or weight edit.
- Toolchain (D-021): pnpm 12.3.4, Node.js engine `22.x`, TypeScript 6.0.3, ESLint 10.11.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.0, Prettier 3.9.9, Vitest 5.0.2.
- Local interpreter for governance checks: Python 3.14.7 (`.venv/bin/python` and `python3`). CI pins Python 3.12. That CI image was not executed here.

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
| GitHub Actions on Python 3.12 | Not run. No push and no pull request. |
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
| Python 3.12 CI image | | | yes | Local Python is 3.14.7 |

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

- `.cursorignore` does not yet list the extra credential patterns that `.gitignore` now lists. Owner: security engineer. Follow-up: a later intent if the file remains uneditable.
- OI-021 gitleaks licence for an organization repository. Owner: security engineer.
- Action SHA comments name the major tag (`v4`, `v5`, `v2`), not an exact release. Owner: tech lead.
- Python 3.12 in GitHub Actions was not executed. Owner: tech lead, on the first pull request.
- Named owners remain `<DECIDE_AT_M0: name>` (OI-002).
- No commit exists, so rollback has not been rehearsed as a revert.

## Rollback

No production path. After a commit, rollback is `git revert` of the M0A commits. Before any commit, delete the created paths and restore the edited files. Hook scripts were not changed. Staging rehearsal: not run (`docs/rollback-plan.md` §9).

## Monitoring

No service is deployed. No detection band applies. The later signal is a green `governance` job and a green `app` job, with this file still recording the two placeholders as not run.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

Appended, without rewriting earlier rows:

- D-020 and D-021 in `docs/decisions.md`
- A-044 in `docs/assumptions.md`
- M0A toolchain closure note after the OI-020 table in `docs/open-items.md`. OI-021's licence question stays open.
- GitHub Actions pin table in `docs/sources.md`
- §8 in `docs/spec/06-MODEL-PLAN.md`

Departures recorded in `plan.md`: pnpm 12.3.4, TypeScript 6.0.3, the `test:e2e` CI step, removal of the `detect` job, the action-pin script, the `.gitignore` patterns, and the denied `.cursorignore` edit.
