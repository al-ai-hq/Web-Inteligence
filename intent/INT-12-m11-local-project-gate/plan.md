# Plan: M11 local project gate

| Field | Value |
| --- | --- |
| Spec | `intent/INT-12-m11-local-project-gate/spec.md`. Ibrahim approved that spec on 2026-10-04 by the message "I approve spec.md." The status word in that file stays `draft` because this session does not set `approved`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-04 (D-020). Plan stage only. The Cursor Plan mode switch was rejected, so this file was written without that switch. |
| Engineer approval | Ibrahim, 2026-10-04, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not create an organization, send an invitation, open a live workspace, run a bulk schedule, add a write-class tool, or touch production infrastructure. |
| Branch | `m11-local-project-gate`, cut from `origin/main` at `fd23f59` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-04. This session does not set `approved`. Status is `done` because the local check was built.

## Scope of this slice

Add one local command. Product spend stays `0.00` USD.

The command exits 0 only when both of these pass:

- The caller is `project_a`. A record whose `project_id` is `project_a` may be read.
- A record whose `project_id` is `project_b` is refused while that caller is in `project_a`.

The check reads fixtures on this machine. It does not add `organization_id`. It does not add a write-class tool to `config/agents/*.yaml`. It does not send an invitation, open a live workspace, or run a bulk schedule. It does not edit `docs/spec/05-PROJECT-PLAN.md` §14. It does not close OI-021. It does not start M12. The later M11 exit in `docs/spec/05-PROJECT-PLAN.md` §5 stays out of this slice.

`project_a` and `project_b` are synthetic labels. They are not live project identifiers.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m11/project-a-read.json` | Create | Caller `project_a` and record `project_id` `project_a`. |
| `scripts/check_m11_project.py` | Create | Local command. Python standard library only. It keeps the read to the caller's project. The stored row must match that result. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m11_project.py` after the existing M10 local monitor gate step. Name the step `M11 local project gate`. Add that name to the workflow header comment. No new action SHA. The gitleaks step stays as it is. |

`project-a-read.json` is `{"caller":"project_a","project_id":"project_a"}`. This fixture is not a workspace and not an invitation.

An in-memory copy `{"caller":"project_a","project_id":"project_b"}` is refused. A copy that adds `organization_id` is also refused.

Do not edit `schemas/`, `config/`, `config/agents/`, `package.json`, `docs/spec/05-PROJECT-PLAN.md`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, `scripts/check_m6_visibility.py`, `scripts/check_m7_footprint.py`, `scripts/check_m8_content.py`, `scripts/check_m9_write.py`, or `scripts/check_m10_monitor.py`. Do not add a workflow action. Do not add a write-class tool. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved. This plan does not implement the check.

1. Cut `m11-local-project-gate` from `origin/main` at `fd23f59`. Carry only `intent/INT-12-m11-local-project-gate/`. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the fixture under `evals/m11/`. Synthetic labels only. No secrets and no live project identifiers.
3. Add `scripts/check_m11_project.py` so it exits 0 only when the project A read passes and the project B read is refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-12-m11-local-project-gate/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M12.

## Behaviour the command must pin

- Accept the golden read only when `caller` is `project_a` and `project_id` is `project_a`.
- Refuse `{"caller":"project_a","project_id":"project_b"}`.
- Refuse a row that contains `organization_id`.
- A fixture that only agrees with itself is not enough. The command keeps a read when the record's `project_id` equals the caller's project. The stored row must match that result.
- Print `product spend 0.00 USD`. No network, no invitation, no live workspace, and no bulk schedule.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A caller in project A reads project B | Medium | The command compares `project_id` with the caller and fails when they differ. | Security engineer |
| `organization_id` is added in this slice | Medium | A row that contains `organization_id` fails the check. No schema edit adds that field. | Tech lead |
| The labels are treated as live projects | Medium | `project_a` and `project_b` are fixture labels. No project is created. | Security engineer |
| The check is treated as the full M11 exit | Medium | Invitations, roles, and bulk schedules stay out. `pnpm test:e2e` stays not run. | Product owner |
| A write-class tool is added | Low | `config/agents/` is not in the file list. | Engineer |
| §14 is edited while naming this intent INT-12 | Low | `docs/spec/05-PROJECT-PLAN.md` is not in the file list. INT-15 remains the table's M11 row. | Product owner |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step and its header comment. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command compares the record's project with the caller. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m11_project.py
python3 scripts/check_action_pins.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m11_project.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No invitation. No bulk schedule.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic labels; the command does not query a database, create a project, send an invitation, or store a secret.
- `verifier`: the diff matches this plan and the spec, a project A record may be read, a project B record is refused, `organization_id` is absent, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword method, or a golden SEO file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave agency roles, invitations, bulk budgets, and the owner names open. Leave OI-021 open. Leave §14 unchanged.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m11_project.py`, `evals/m11/`, and the CI step returns the tree to `origin/main` at `fd23f59`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-04: The branch `m11-local-project-gate` was created at `fd23f59`. It was not pushed.
- 2026-10-04: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m11_project.py` passed on that system interpreter because the command uses the standard library only. No package was added.
- 2026-10-04: `security-reviewer` and `verifier` ran. The check script was not changed after that review. Two medium notes stay open because this plan pins the caller to `project_a` and stores that caller on the same golden row. They are recorded in `release.md`.
