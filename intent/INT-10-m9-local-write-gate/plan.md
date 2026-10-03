# Plan: M9 local write gate

| Field | Value |
| --- | --- |
| Spec | `intent/INT-10-m9-local-write-gate/spec.md`. Ibrahim approved that spec on 2026-10-03 by the message "I approve spec.md." The status word in that file stays `draft` because this session does not set `approved`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-03 (D-020). Plan stage only. |
| Engineer approval | Ibrahim, 2026-10-03, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not write to a CMS, open a client pull request, run a staging scenario, change the cost guard, or touch production infrastructure. |
| Branch | `m9-local-write-gate`, cut from `origin/main` at `e12afd7` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-03. This session does not set `approved`. Status is `done` because the local check was built.

## Scope of this slice

Add one local command. Product spend stays `0.00` USD.

The command exits 0 only when both of these pass:

- A write has the approval list `["synthetic_approval"]`. A missing approval is refused. An empty approval list is refused. A missing approval and an empty list are both no approval.
- A change has status `DRAFT` and is not published. Publication of that draft is refused. An edit approval on that draft is not publication permission.

The check reads fixtures on this machine. It does not choose a connector. It does not add a write-class tool to `config/agents/*.yaml`. It does not write to a CMS, open a client pull request, or run a staging scenario. It does not close OI-021. It does not start M10. The later M9 exit in `docs/spec/05-PROJECT-PLAN.md` §5 stays out of this slice.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m9/approved-write.json` | Create | One synthetic field: `approvals` `["synthetic_approval"]`. |
| `evals/m9/draft-change.json` | Create | One synthetic field: `status` `DRAFT`. The row is not published. |
| `scripts/check_m9_write.py` | Create | Local command. Python standard library only. It classifies the approval list and the unpublished draft. The stored rows must match that classification. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m9_write.py` after the existing M8 local content gate step. Name the step `M9 local write gate`. Add that name to the workflow header comment. No new action SHA. The gitleaks step stays as it is. |

`approved-write.json` is `{"approvals":["synthetic_approval"]}`. `draft-change.json` is `{"status":"DRAFT"}`. These fixtures are not a full change set.

In-memory copies cover a missing `approvals` field, `approvals` `[]`, `{"status":"DRAFT","published":true}`, and `{"status":"DRAFT","approvals":["synthetic_approval"],"published":true}`. The command fails if any of those copies is accepted. A `connector` field and a `pull_request` field also fail.

Do not edit `schemas/`, `config/`, `config/agents/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, `scripts/check_m6_visibility.py`, `scripts/check_m7_footprint.py`, or `scripts/check_m8_content.py`. Do not add a workflow action. Do not add a write-class tool. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved. This plan does not implement the check.

1. Cut `m9-local-write-gate` from `origin/main` at `e12afd7`. Carry only `intent/INT-10-m9-local-write-gate/`. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the two fixtures under `evals/m9/`. Synthetic values only. No secrets, no connector credentials, and no customer page text.
3. Add `scripts/check_m9_write.py` so it exits 0 only when the approved write and the unpublished draft pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-10-m9-local-write-gate/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M10.

## Behaviour the command must pin

- Accept the golden write only when `approvals` is the one-item list `synthetic_approval`.
- Refuse a missing `approvals` field. Refuse `approvals` `[]`.
- Accept the change only when `status` is `DRAFT` and it is not published.
- Refuse `{"status":"DRAFT","published":true}`.
- Refuse `{"status":"DRAFT","approvals":["synthetic_approval"],"published":true}`. The edit approval does not permit publication.
- Refuse a `connector` field and a `pull_request` field. This command does not choose Git or CMS and does not open a client pull request.
- A fixture that only agrees with itself is not enough. The command classifies the approval list, the `DRAFT` state, and the unpublished draft. The stored row must match that classification.
- Print `product spend 0.00 USD`. No network, no provider call, no Google Autocomplete, no search-result scrape, and no connector call.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.
- Do not add `PUBLISHED` to `schemas/common.schema.json` `change_state`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A write is stored with no approval | Medium | The command classifies the approval list and fails when the field is missing or the list is empty. | Integration engineer |
| A draft is stored as published | Medium | The passing status is `DRAFT` and the row is not published. A copy with `published` true fails the check. | Integration engineer |
| An edit approval is treated as publication permission | Medium | A draft that also carries `synthetic_approval` and `published` true fails the check. | Integration engineer |
| A connector or a client pull request is treated as this check | Medium | A `connector` field and a `pull_request` field fail the check. This command does not call a CMS or open a pull request. | Integration engineer |
| The check is treated as the full M9 exit | Medium | Staging scenarios and the impact ledger stay out. `pnpm test:e2e` stays not run. | Product owner |
| A write-class tool is added | Low | `config/agents/` is not in the file list. | Engineer |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step and its header comment. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command classifies the approval list and the unpublished draft. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m9_write.py
python3 scripts/check_action_pins.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m9_write.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No live fetch. No staging run.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, call a CMS, open a pull request, publish a page, or store a secret.
- `verifier`: the diff matches this plan and the spec, a write with no approval is refused, publication of a `DRAFT` is refused, an edit approval is not publication permission, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword method, or a golden SEO file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave the first connector, the impact ledger, and the owner names open. Leave OI-021 open.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m9_write.py`, `evals/m9/`, and the CI step returns the tree to `origin/main` at `e12afd7`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-03: The branch `m9-local-write-gate` was created at `e12afd7`. It was not pushed.
- 2026-10-03: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m9_write.py` passed on that system interpreter because the command uses the standard library only. No package was added.
