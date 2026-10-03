# Plan: M8 local content gate

| Field | Value |
| --- | --- |
| Spec | `intent/INT-09-m8-local-content-gate/spec.md`. Ibrahim approved that spec on 2026-10-02 by the message "I approve spec.md." The status word in that file stays `draft` because this session does not set `approved`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-02 (D-020). Plan stage only. The Cursor Plan mode switch was rejected, so this file was written without that switch. |
| Engineer approval | Ibrahim, 2026-10-02, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not fetch a page, open a CMS draft, open a client pull request, publish a page, change the cost guard, or touch production infrastructure. |
| Branch | `m8-local-content-gate`, cut from `origin/main` at `5dc6646` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-02. This session does not set `approved`. Status is `done` because the local check was built.

## Scope of this slice

Add one local command with three refusals. Product spend stays `0.00` USD.

The command exits 0 only when all three of these pass:

- A claim has the synthetic source `synthetic_source`. A missing source is refused. An empty source is refused. A missing source and an empty source are both no source.
- A new page has the cannibalization result `checked`. A missing cannibalization result stays null and the new page is refused. Storing that missing result as `pass` is refused.
- A page has status `unpublished`. A page stored as `published` is refused.

The check reads fixtures on this machine. It does not write a CMS draft, open a client pull request, or publish a page. It does not close OI-021. It does not start M9. The later M8 exit in `docs/spec/05-PROJECT-PLAN.md` §5 (citation evals, schema work, and an approval workflow) stays out of this slice.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m8/sourced-claim.json` | Create | One synthetic field: `source` `synthetic_source`. |
| `evals/m8/checked-page.json` | Create | A new page whose `cannibalization_result` is `checked`. |
| `evals/m8/unpublished-page.json` | Create | One synthetic field: `status` `unpublished`. |
| `scripts/check_m8_content.py` | Create | Local command. Python standard library only. It classifies the claim, the cannibalization result, and the page status. The stored rows must match that classification. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m8_content.py` after the existing M7 public footprint step. Name the step `M8 local content gate`. Add that name to the workflow header comment. No new action SHA. The gitleaks step stays as it is. |

`sourced-claim.json` is `{"source":"synthetic_source"}`. `checked-page.json` is `{"kind":"new_page","cannibalization_result":"checked"}`. `unpublished-page.json` is `{"status":"unpublished"}`. These fixtures are not a content brief, a citation record, or a change operation.

In-memory copies cover a missing source, an empty source, a whitespace-only source, a new page whose cannibalization result is null, a new page whose cannibalization result is `pass`, and a page whose status is `published`. The command fails if any of those copies is accepted. A `draft` status and a `pull_request` field also fail, because this slice has no CMS draft and no client pull request.

Do not edit `schemas/`, `config/`, `package.json`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, `scripts/check_m6_visibility.py`, or `scripts/check_m7_footprint.py`. Do not add a workflow action. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved. This plan does not implement the check.

1. Cut `m8-local-content-gate` from `origin/main` at `5dc6646`. Carry only `intent/INT-09-m8-local-content-gate/`. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the three fixtures under `evals/m8/`. Synthetic values only. No secrets and no customer page text.
3. Add `scripts/check_m8_content.py` so it exits 0 only when the sourced claim, the checked page, and the unpublished page pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-09-m8-local-content-gate/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M9.

## Behaviour the command must pin

- Accept the golden claim only when `source` is `synthetic_source`.
- Refuse a missing source. A missing source is a null value or a missing field.
- Refuse an empty source. An empty source is `""` or a value that is empty after trimming.
- Accept the new page only when `kind` is `new_page` and `cannibalization_result` is `checked`.
- A missing cannibalization result is null. Classifying null returns `{cannibalization_result: null}`. That result is not a pass, and a new page with that result is refused.
- Refuse a stored cannibalization result of `pass`. `pass` is not a substitute for null.
- Accept the page only when `status` is `unpublished`. Refuse `published`. Refuse `draft`.
- Refuse a `pull_request` field. This command does not open a client pull request.
- A fixture that only agrees with itself is not enough. The command classifies a non-empty synthetic source, a cannibalization result of `checked`, a null missing result, and an `unpublished` status. The stored row must match that classification.
- Print `product spend 0.00 USD`. No network, no provider call, no Google Autocomplete, no search-result scrape, and no client-site fetch.
- Do not import `.claude/skills/marketing-seo-agent/scripts`, including `cannibalization.py`.
- Do not score `llms.txt`, require an FAQ block, or promise a rich result.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A claim is stored with no source | Medium | The command classifies the source and fails when it is missing, empty, or whitespace only. | Data engineer |
| A missing cannibalization result is stored as `pass` | Medium | The passing result is `checked`. Null stays null. A copy that stores `pass` fails the check. | Data engineer |
| A page is stored as `published` | Medium | The passing status is `unpublished`. A copy with `published` fails the check. | Integration engineer |
| A CMS draft or a client pull request is treated as this check | Medium | Status `draft` and a `pull_request` field fail the check. This command does not call a CMS or open a pull request. | Integration engineer |
| The check is treated as the full M8 exit | Medium | Citation evals, schema work, and the approval workflow stay out. `pnpm test:e2e` stays not run. | Product owner |
| `cannibalization.py` is imported | Low | The file list is the three fixtures, one standard-library script, and one CI step. | Engineer |
| A live fetch or a connector write is added | Low | The file list has no connector and no fetch. Product spend stays `0.00` USD. | Engineer |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step and its header comment. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command classifies the source, the cannibalization result, the null missing result, and the unpublished status. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m8_content.py
python3 scripts/check_action_pins.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m8_content.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No live fetch.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic; the command does not fetch, call a CMS, open a pull request, publish a page, or store a secret.
- `verifier`: the diff matches this plan and the spec, a claim with no source is refused, a missing cannibalization result stays null and is not stored as `pass`, a page stored as `published` is refused, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword method, or a golden SEO file, and it does not import `cannibalization.py`.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave the content-approver name, the later schema types, and Arabic editorial review open. Leave OI-021 open.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m8_content.py`, `evals/m8/`, and the CI step returns the tree to `origin/main` at `5dc6646`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-02: The branch `m8-local-content-gate` was created at `5dc6646`. It was not pushed.
- 2026-10-02: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m8_content.py` passed on that system interpreter because the command uses the standard library only. No package was added.
