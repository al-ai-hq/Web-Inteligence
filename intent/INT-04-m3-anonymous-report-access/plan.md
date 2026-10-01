# Plan: M3 local anonymous export denial

| Field | Value |
| --- | --- |
| Spec | `intent/INT-04-m3-anonymous-report-access/spec.md` (status: approved) |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01. Written in Plan mode. The local check was added after Ibrahim approved this plan. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "I approve plan.md". |
| Tech lead approval | not required. This slice does not add a live auth path, a cookie, tenant isolation code, SSRF, the cost guard, rule weights, or production infrastructure. |
| Branch | `m3-anonymous-report-access`, cut from `origin/main` at `d8d3e18`. Not pushed. It does not track `origin/main`. |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

Add one local command that denies an anonymous export and checks the stored access label. Product spend stays `0.00` USD.

An anonymous request for `pdf`, `document`, `csv`, `json`, `evidence_bundle`, `task_export`, or `full_report_copy` is denied with reason `anonymous_export_prohibited`, no artifact, and no signed URL. `web_interactive` is not an export. Stored access has `public_gallery` false and `noindex` true.

There is no screen. `scripts/check_m0b_proofs.py` is not edited. OI-021 stays open. M4 does not start.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `evals/m3/deny-anonymous.json` | Create | Seven anonymous export requests, one per format above, each stored as denied with `anonymous_export_prohibited` and no artifact or signed URL. |
| `evals/m3/access-private.json` | Create | Stored access with `public_gallery` false and `noindex` true. |
| `scripts/check_m3_access.py` | Create | Local command. Python standard library only. Does not import `scripts/check_m0b_proofs.py`. |
| `.github/workflows/ci.yml` | One governance step | Run `python3 scripts/check_m3_access.py` after the existing config check. No new action SHA. |
| `intent/INT-04-m3-anonymous-report-access/spec.md` | Sign-off already recorded | Ibrahim approved it on 2026-10-01. |

In-memory copies cover a denial that is authorized, a denial that carries an artifact or a signed URL, `public_gallery` true, and `noindex` false. The command fails if any of those copies is accepted. It also fails if `web_interactive` is treated as an export denial.

Do not edit `scripts/check_m0b_proofs.py`, `config/`, schemas, or `package.json`. Do not add a workflow action. Do not close OI-021. Leave the untracked Icon file out. `pnpm test:e2e` stays not run. `pnpm test:ssrf` is not this exit.

## Order of work

Do not start this list until the plan is approved.

1. Add the two fixtures under `evals/m3/`. Synthetic values only. No secrets, customer URLs, or page text.
2. Add `scripts/check_m3_access.py` so it exits 0 only when the seven denials and the access label pass, and the in-memory failures are refused. Do not set `.claude/state/test-lock`. This is not a bug fix.
3. Add the CI step. Run the proof commands below and paste the output. Record `pnpm test:e2e` as not run.
4. Save `intent/INT-04-m3-anonymous-report-access/review.diff`. Run `security-reviewer` and `verifier`. They do not approve, merge, or spawn subagents. Fill `release.md` from the template. Stop. Do not start M4.

## Behaviour the command must pin

- Deny anonymous `pdf`, `document`, `csv`, `json`, `evidence_bundle`, `task_export`, and `full_report_copy`.
- Each denial is `decision` `denied` and `denial_reason` `anonymous_export_prohibited`, with no artifact and no signed URL.
- Refuse a copy that sets `decision` to `authorized`, or that adds an artifact or a signed URL.
- Pass `public_gallery` false and `noindex` true. Refuse `public_gallery` true and `noindex` false.
- Do not classify `web_interactive` as an export denial.
- Print `product spend 0.00 USD`. No network, no provider call, and no client-site fetch.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| The new command edits the M0B proof | Low | `scripts/check_m0b_proofs.py` is not in the file list. | Engineer |
| One export format is left authorized | Medium | The seven formats are listed in the fixture and the command fails if any is missing or authorized. | Security engineer |
| `web_interactive` is denied as a download | Low | The command fails if that projection is treated as an export denial. | Security engineer |
| The check is treated as the full M3 exit | Medium | The screen, comparison views, action board, expiry, and deletion stay out. `pnpm test:e2e` stays not run. | Product owner |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
python3 scripts/check_m3_access.py
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
```

`check_m3_access.py` uses the standard library, so `python3` does not need PyYAML. If `python3 scripts/check_schemas.py` fails because `jsonschema` is missing, rerun the schema and config checks with `./.venv/bin/python` and record that departure. `pnpm test:e2e` is not an exit command. Record it as not run. `pnpm test:ssrf` is the M1 suite and is not this exit.

No Arabic or WCAG run. There is no screen.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: anonymous exports are denied with no artifact and no signed URL; access is private and `noindex`; fixtures have no secrets.
- `verifier`: the diff matches this plan and the approved spec, and the pasted command output is real.
- Arabic and accessibility review is not run.
- Cost review is not a separate subagent. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.

Reviewers do not approve, merge, or spawn subagents.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit. Removing `scripts/check_m3_access.py`, `evals/m3/`, and the CI step returns the tree to `origin/main` at `d8d3e18`. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-01: The branch `m3-anonymous-report-access` was created at `d8d3e18` and its upstream was removed so it does not track `origin/main`. It was not pushed.
- 2026-10-01: `python3 scripts/check_schemas.py` and `python3 scripts/check_config.py` failed on `/opt/homebrew/bin/python3` because `jsonschema` and PyYAML are not installed for that interpreter. Those checks passed with `./.venv/bin/python`. `python3 scripts/check_m3_access.py` passed on `/opt/homebrew/bin/python3` because that command uses the standard library only. No package was added.
- 2026-10-01: The security review found the first script only compared the fixture to itself. `export_decision` now computes the denial for an anonymous export. The stored row must match that decision. The check was run again and exited 0.
