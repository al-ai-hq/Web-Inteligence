# Plan: M10 local monitor gate

| Field | Value |
| --- | --- |
| Spec | `intent/INT-11-m10-local-monitor-gate/spec.md`. Ibrahim approved that spec on 2026-10-04 by the message "I approve spec.md." The status word in that file stays `draft` because this session does not set `approved`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-04 (D-020). Plan stage only. The Cursor Plan mode switch was rejected, so this file was written without that switch. |
| Engineer approval | Ibrahim, 2026-10-04, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not run a schedule, crawl a site, delete data, add a write-class tool, change the cost guard, or touch production infrastructure. |
| Branch | `m10-local-monitor-gate`, cut from `origin/main` at `f926be7` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-04. This session does not set `approved`. Status is `done` because the local check was built.

## Scope of this slice

Add one local command. Product spend stays `0.00` USD.

The command exits 0 only when both of these pass:

- A schedule has `adds_write` false and `adds_target` false. A schedule which adds a write is refused. A schedule which adds a new target is refused.
- An unchanged run has `state` `unchanged` and no raised alert. Storing a raised alert for that unchanged run is refused.

The check reads fixtures on this machine. It does not run a scheduler, crawl a site, or delete data. It does not add a write-class tool to `config/agents/*.yaml`. It does not edit `docs/spec/05-PROJECT-PLAN.md` §14. It does not close OI-021. It does not start M11. The later M10 exit in `docs/spec/05-PROJECT-PLAN.md` §5 stays out of this slice.

An alert count of `0` stays out of this slice. The quiet row has no alert. It is not stored as `0`.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m10/bounded-schedule.json` | Create | `adds_write` false and `adds_target` false. |
| `evals/m10/unchanged-run.json` | Create | `state` `unchanged`. No alert field. |
| `scripts/check_m10_monitor.py` | Create | Local command. Python standard library only. It classifies the bounded schedule and the quiet run. The stored rows must match that classification. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m10_monitor.py` after the existing M9 local write gate step. Name the step `M10 local monitor gate`. Add that name to the workflow header comment. No new action SHA. The gitleaks step stays as it is. |

`bounded-schedule.json` is `{"adds_write":false,"adds_target":false}`. `unchanged-run.json` is `{"state":"unchanged"}`. These fixtures are not a running schedule and not a deletion record.

In-memory copies cover `{"adds_write":true,"adds_target":false}`, `{"adds_write":false,"adds_target":true}`, and `{"state":"unchanged","alert":"raised"}`. The command fails if any of those copies is accepted.

Do not edit `schemas/`, `config/`, `config/agents/`, `package.json`, `docs/spec/05-PROJECT-PLAN.md`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, `scripts/check_m6_visibility.py`, `scripts/check_m7_footprint.py`, `scripts/check_m8_content.py`, or `scripts/check_m9_write.py`. Do not add a workflow action. Do not add a write-class tool. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved. This plan does not implement the check.

1. Cut `m10-local-monitor-gate` from `origin/main` at `f926be7`. Carry only `intent/INT-11-m10-local-monitor-gate/`. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the two fixtures under `evals/m10/`. Synthetic values only. No secrets and no customer page text.
3. Add `scripts/check_m10_monitor.py` so it exits 0 only when the bounded schedule and the quiet run pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-11-m10-local-monitor-gate/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M11.

## Behaviour the command must pin

- Accept the golden schedule only when `adds_write` is false and `adds_target` is false.
- Refuse a schedule whose `adds_write` is true.
- Refuse a schedule whose `adds_target` is true.
- Accept the golden run only when `state` is `unchanged` and no alert is stored.
- Refuse `{"state":"unchanged","alert":"raised"}`.
- Do not treat an alert count of `0` as the quiet row, and do not add that case to this slice.
- A fixture that only agrees with itself is not enough. The command classifies the two false flags and the unchanged state with no alert. The stored row must match that classification.
- Print `product spend 0.00 USD`. No network, no scheduler, no crawl, and no deletion.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A schedule adds a write | Medium | The command classifies `adds_write` and fails when it is true. | Integration engineer |
| A schedule adds a new target | Medium | The command classifies `adds_target` and fails when it is true. | Service owner |
| An unchanged run raises an alert | Medium | The passing row has no alert. A copy with `alert` `raised` fails the check. | Data engineer |
| A quiet run is stored as an alert count of `0` | Medium | That case stays out of this slice. The quiet row has no alert field. | Data engineer |
| The check is treated as the full M10 exit | Medium | Deletion, cost breakers, and a running schedule stay out. `pnpm test:e2e` stays not run. | Product owner |
| A write-class tool is added | Low | `config/agents/` is not in the file list. | Engineer |
| §14 is edited while naming this intent INT-11 | Low | `docs/spec/05-PROJECT-PLAN.md` is not in the file list. INT-14 remains the table's M10 row. | Product owner |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step and its header comment. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command classifies the flags and the quiet run. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m10_monitor.py
python3 scripts/check_action_pins.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m10_monitor.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No crawl. No deletion.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, run a schedule, crawl, delete, or store a secret.
- `verifier`: the diff matches this plan and the spec, a schedule that adds a write or a new target is refused, a raised alert on an unchanged run is refused, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword method, or a golden SEO file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave material-change rules, retention windows, and the owner names open. Leave OI-021 open. Leave §14 unchanged.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m10_monitor.py`, `evals/m10/`, and the CI step returns the tree to `origin/main` at `f926be7`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-04: The branch `m10-local-monitor-gate` was created at `f926be7`. It was not pushed.
- 2026-10-04: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m10_monitor.py` passed on that system interpreter because the command uses the standard library only. No package was added.
- 2026-10-04: Ibrahim's implementation message asked for `cost-reviewer` and `verifier`. The order of work in this plan names `security-reviewer`. `security-reviewer` was not run. `cost-reviewer` was run. The check script was not changed after that review.
