# Plan: M12 local gallery gate

| Field | Value |
| --- | --- |
| Spec | `intent/INT-13-m12-local-gallery-gate/spec.md`. Ibrahim approved that spec on 2026-10-04 by the message "I approve spec.md." The status word in that file stays `draft` because this session does not set `approved`. |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-04 (D-020). Plan stage only. The Cursor Plan mode switch was not used, so this file was written without that switch. |
| Engineer approval | Ibrahim, 2026-10-04, by the message "I approve plan.md." That message did not set the status word to `approved`. This session later set Status to `done` after the check was built. |
| Tech lead approval | not required. This slice does not publish a page, create a public link, change noindex, add a write-class tool, or touch production infrastructure. |
| Branch | `m12-local-gallery-gate`, cut from `origin/main` at `b56291b` when implementation starts. Not created by this plan. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Ibrahim approved this plan on 2026-10-04. This session does not set `approved`. Status is `done` because the local check was built.

## Scope of this slice

Add one local command. Product spend stays `0.00` USD.

The command exits 0 only when all of these pass:

- The report is `anonymous`. Consent is missing or empty. Both are no consent. The report is not placed in a public gallery.
- A stored public placement of that report is refused.
- A row that contains `public_link` is refused. A row that contains `noindex` is refused.

The check reads fixtures on this machine. It does not publish a public page, create a public link, or change noindex. It does not add a write-class tool to `config/agents/*.yaml`. It does not edit `docs/spec/05-PROJECT-PLAN.md` §14. It does not close OI-021. It does not start M13. The later M12 exit in `docs/spec/05-PROJECT-PLAN.md` §5 stays out of this slice.

`anonymous` and `public` are synthetic labels. They are not a live report and not a live page.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m12/missing-consent.json` | Create | Anonymous report with the `consent` field absent. |
| `scripts/check_m12_gallery.py` | Create | Local command. Python standard library only. It refuses a public placement when consent is missing or empty. The stored row must match that result. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m12_gallery.py` after the existing M11 local project gate step. Name the step `M12 local gallery gate`. Add that name to the workflow header comment. No new action SHA. The gitleaks step stays as it is. |

`missing-consent.json` is `{"report":"anonymous"}`. This fixture is not a public page and not a public link.

Missing consent is an absent `consent` field or JSON `null`. Empty consent is `""` or whitespace after trimming. Both are no consent.

An in-memory copy `{"report":"anonymous","placement":"public"}` is refused. The same refusal holds when `consent` is `null`, `""`, or whitespace and `placement` is `public`. A copy that adds `public_link` is refused. A copy that adds `noindex` is refused.

Do not edit `schemas/`, `config/`, `config/agents/`, `package.json`, `docs/spec/05-PROJECT-PLAN.md`, `scripts/check_m0b_proofs.py`, `scripts/check_m2_readiness.py`, `scripts/check_m3_access.py`, `scripts/check_m4_sources.py`, `scripts/check_m5_experience.py`, `scripts/check_m6_visibility.py`, `scripts/check_m7_footprint.py`, `scripts/check_m8_content.py`, `scripts/check_m9_write.py`, `scripts/check_m10_monitor.py`, or `scripts/check_m11_project.py`. Do not add a workflow action. Do not add a write-class tool. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved. This plan does not implement the check.

1. Cut `m12-local-gallery-gate` from `origin/main` at `b56291b`. Carry only `intent/INT-13-m12-local-gallery-gate/`. Do not commit this slice on `main`. Leave the untracked Icon file out.
2. Add the fixture under `evals/m12/`. Synthetic labels only. No secrets and no live report identifiers.
3. Add `scripts/check_m12_gallery.py` so it exits 0 only when the missing-consent report stays out of the gallery and a stored public placement is refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
4. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
5. Save `intent/INT-13-m12-local-gallery-gate/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M13.

## Behaviour the command must pin

- Accept the golden report only when `report` is `anonymous`, the `consent` field is absent, and `placement`, `public_link`, and `noindex` are absent.
- Treat an absent `consent` field and JSON `null` as missing. Treat `""` and whitespace after trimming as empty. Missing and empty are both no consent.
- Refuse `{"report":"anonymous","placement":"public"}`.
- Refuse that public placement when `consent` is `null`, `""`, or whitespace.
- Refuse a row that contains `public_link`. Refuse a row that contains `noindex`.
- A fixture that only agrees with itself is not enough. The command keeps the report out of the gallery when consent is no consent. The stored row must match that result.
- A consent value other than missing or empty is not this case. The command does not place that report in the gallery.
- Print `product spend 0.00 USD`. No network, no public page, and no public link.
- Do not import `.claude/skills/marketing-seo-agent/scripts`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| An anonymous report with no consent is placed in the gallery | Medium | The command treats missing and empty consent as no consent and fails a stored `placement` of `public`. | Privacy owner |
| The check creates a public link | Medium | A row that contains `public_link` fails the check. No page is served. | Security engineer |
| noindex is changed | Medium | A row that contains `noindex` fails the check. No robots or meta value is written. | Security engineer |
| The labels are treated as a live report | Medium | `anonymous` and `public` are fixture labels. No report is published. | Privacy owner |
| The check is treated as the full M12 exit | Medium | Removal, benchmarks, and tones stay out. `pnpm test:e2e` stays not run. | Product owner |
| A write-class tool is added | Low | `config/agents/` is not in the file list. | Engineer |
| §14 is edited while naming this intent INT-13 | Low | `docs/spec/05-PROJECT-PLAN.md` is not in the file list. INT-16 remains the table's M12 row. | Product owner |
| OI-021 is closed while editing CI | Low | The only CI edit is the new step and its header comment. The gitleaks step and OI-021 stay unchanged. | Tech lead |
| The script compares a fixture only to itself | Medium | The command computes no consent from the stored fields. The stored row must match that result. | Engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m12_gallery.py
python3 scripts/check_action_pins.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m12_gallery.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen. No golden-file eval. No public page. No public link.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: fixtures are synthetic labels; the command does not publish a report, create a link, change noindex, or store a secret.
- `verifier`: the diff matches this plan and the spec, missing and empty consent are both no consent, a stored public placement is refused, `public_link` and `noindex` are absent from the golden row, and the pasted command output is real.
- Arabic and accessibility review is not run.
- `seo-method-checker` is not run. This slice does not change a rule, a keyword method, or a golden SEO file.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

No new decision row. No new assumption row. Leave gallery eligibility, retention, moderation, removal, tones, and the owner names open. Leave OI-021 open. Leave §14 unchanged.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m12_gallery.py`, `evals/m12/`, and the CI step returns the tree to `origin/main` at `b56291b`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-04: The branch `m12-local-gallery-gate` was created at `b56291b`. It was not pushed.
- 2026-10-04: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on Python 3.14.7 (`/opt/homebrew/opt/python@3.14/bin/python3.14`) because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m12_gallery.py` passed on that system interpreter because the command uses the standard library only. No package was added.
