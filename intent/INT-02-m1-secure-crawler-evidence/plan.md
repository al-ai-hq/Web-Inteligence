# Plan: M1 local SSRF suite

| Field | Value |
| --- | --- |
| Spec | `intent/INT-02-m1-secure-crawler-evidence/spec.md` (status: approved) |
| Status | done |
| Author | Cursor session (Grok 4.7), 2026-10-01. Plan mode was declined, so this file was written in Agent mode. No code was added. |
| Engineer approval | Ibrahim, 2026-10-01, by the message "I approve plan.md". |
| Tech lead approval | Ibrahim, 2026-10-01, by the message "I approve plan.md". Required for this high-risk SSRF slice. Role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Branch | `m1-secure-crawler` |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

Replace the SSRF placeholder with the local suite behind `pnpm test:ssrf`. The suite rejects non-public and metadata targets, re-checks every redirect, sitemap entry, and discovered link, keeps secret clients, database clients, and write tools off the fetch path, and labels a representative result as a sample.

Fixture ceilings stay test values in `evals/m1/ceilings.json`. They are not copied to `config/`. Product spend stays `0.00` USD. No Cloud Run sandbox, no staging network run, no Playwright worker, no public-web crawl, and no live DNS or TCP socket.

## Files

| Path | Change | Why |
| --- | --- | --- |
| `apps/web/src/ssrf/validate.ts` | Create | Scheme, userinfo, port, address class, metadata name, redirect, off-host, and ceiling decisions. Injected resolver and connector. No socket. |
| `apps/web/src/ssrf/sample.ts` | Create | Returns `coverage: "sample"`, `fetched_count`, and `site_wide_count: null`. |
| `apps/web/src/ssrf/suite.test.ts` | Create first | The failing suite. Vitest already includes `apps/web/src/**/*.test.ts`. |
| `evals/m1/ceilings.json` | Create | Test ceilings only, with `"role": "test_ceiling_not_product_limit"`. |
| `evals/m1/forbidden-references.json` | Create | Secret-manager and database client strings, plus the seven write-class names. |
| `package.json` | Change `test:ssrf` | Point it at `vitest run apps/web/src/ssrf/suite.test.ts`. |
| `apps/web/src/placeholders.test.ts` | Delete the SSRF case | Spec requirement 2. Keep the `e2e.mjs` case. |
| `scripts/placeholders/ssrf.mjs` | Delete | The command must no longer be able to print that the suite is not run. |
| `intent/INT-02-m1-secure-crawler-evidence/spec.md` | Sign-off already recorded | Ibrahim approved it on 2026-10-01. |

Do not add a workflow job. `.github/workflows/ci.yml` already runs `pnpm test:ssrf` in the `app` job. Do not add an npm dependency. Do not edit `config/`, schemas, scoring weights, or `scripts/placeholders/e2e.mjs`.

## Order of work

1. Add `evals/m1/ceilings.json` and `evals/m1/forbidden-references.json`.
2. Add `apps/web/src/ssrf/suite.test.ts` so it fails because `validate.ts` and `sample.ts` are absent. Do not set `.claude/state/test-lock`. This is not a bug fix.
3. Add `validate.ts` and `sample.ts` until the suite passes. The connector stub records the address it was given and does not open a socket. The resolver is the stub passed by the test.
4. Change `package.json` `test:ssrf` to `vitest run apps/web/src/ssrf/suite.test.ts`.
5. Remove the SSRF case from `placeholders.test.ts`. Delete `scripts/placeholders/ssrf.mjs`.
6. Run the proof commands below. Paste the output into the later pull request. `pnpm test:e2e` stays recorded as not run.
7. Stop. Do not start a later M1 slice.

## Behaviour the suite must pin

Reason codes are `scheme`, `userinfo`, `port`, `non_public_address`, `metadata`, `rebinding`, `redirect`, `off_host`, and `over_limit`. A refusal does not call the connector stub.

- Reject `file`, `ftp`, `gopher`, `data`, `javascript`, `ws`, and `wss`. Reject userinfo. Reject a port other than 80 or 443.
- Reject one address in each class: `127.0.0.1`, `10.0.0.1`, `100.64.0.1`, `169.254.1.1`, `224.0.0.1`, `240.0.0.1`, `192.0.2.1`, `0.0.0.1`, `255.255.255.255`, `::1`, `fc00::1`, `fe80::1`, and `::ffff:10.0.0.1`.
- Reject a loopback address written as a decimal, octal, hexadecimal, short, or trailing-dot form before any connection.
- Reject `metadata.google.internal` and `169.254.169.254` with reason `metadata`.
- The allow case uses the stub name `allowed.example` resolving to `1.2.3.4` on port 443. Requirement 5 rejects documentation ranges, so this is not `192.0.2.1`. The stub does not dial `1.2.3.4`.
- Rebinding stub: public `1.2.3.4` at validation and `10.0.0.1` at connection; one answer set containing both; public `1.2.3.4` beside private `fc00::1`. All three refuse with `rebinding`. When a check allows a target, the connector receives only the pinned address.
- Redirects: a public-to-private hop, a hop to `file:`, a loop, and a fourth hop when the ceiling is 3 all refuse with `redirect`. A chain of 3 public hops is allowed. Each hop is classified again.
- A sitemap entry and a discovered link to `10.0.0.1`, to `169.254.169.254`, or to a host other than the validated target host are not fetched (`off_host` or `non_public_address` or `metadata`). The connector attempt count stays 0.
- Ceilings in the fixture: redirect hops 3, response bytes 1024, decompressed bytes 2048, pages 2, depth 1, duration milliseconds 1000. One step past each refuses with `over_limit`. A value equal to the ceiling is allowed. These numbers are not product limits (OI-053).
- `forbidden-references.json` lists `SecretManagerServiceClient`, `@google-cloud/secret-manager`, `pg`, `mysql2`, `mongodb`, `prisma`, `typeorm`, and `knex`, plus the write-class names. The test reads `WRITE_CLASS_TOOLS` in `scripts/check_config.py` and fails if the JSON set differs. It scans `apps/web/src/ssrf/*.ts` except test files.
- `sample.ts` returns coverage `sample`. The suite fails a result that sets coverage `full`.

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| A test opens a real socket or resolver | Medium | Inject the stub. Assert the connector records no call on refusal. Do not import `node:dns` or `node:net`. | Security engineer |
| Fixture ceilings get copied into `config/` | Medium | The JSON `role` field says they are test ceilings. No `config/` edit is in this plan. | Tech lead |
| The source scan misses a new client name | Medium | The denylist is explicit. It does not prove a cloud identity. Say that in `release.md`. | Security engineer |
| `pnpm test` and `pnpm test:ssrf` disagree | Low | The suite file matches the Vitest include pattern, so `pnpm test` runs it too. `test:ssrf` runs that file alone. | Tech lead |
| Documentation address used as the allow case | Low | `192.0.2.1` is a rejected documentation address. The allow stub uses `1.2.3.4` and does not contact it. | Security engineer |

## Proof

Run from the repository root after implementation. Paste the output. Do not claim a command passed unless it was run.

```bash
pnpm test:ssrf
pnpm test
pnpm lint
pnpm typecheck
python3 -m unittest discover -s .claude/hooks/tests
python3 -m unittest discover -s .cursor/hooks/tests
python3 scripts/check_schemas.py
python3 scripts/check_config.py
python3 scripts/check_action_pins.py
```

`pnpm test:e2e` is not an exit command. Record it as not run. `python3 scripts/check_m0b_proofs.py` should still pass and is not part of this slice's new behaviour.

No Arabic or WCAG run. There is no screen.

## Security, privacy, cost, Arabic/accessibility review

- `security-reviewer`: no live fetch, no socket, metadata rejected by name, rebinding uses the stub, write-class names stay out of the fetch path, fixtures have no secrets.
- `test-writer`: the suite covers the case list above and fails before the implementation exists.
- `verifier`: the diff matches this plan and the approved spec, and the pasted command output is real.
- Cost review is not a separate subagent for this slice. The diff must show no paid call, no hosting resource, and no new dependency. Product spend `0.00` USD.
- Arabic and accessibility review is not run.

Reviewers do not approve, merge, or spawn subagents.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit on `m1-secure-crawler`. Restoring `scripts/placeholders/ssrf.mjs` and the old `test:ssrf` script returns the placeholder. Staging rehearsal is not part of this slice.

## Departures from the plan

- 2026-10-01: `python3 scripts/check_schemas.py` on `/opt/homebrew/bin/python3` failed because `jsonschema` is not installed for that interpreter. The schema, config, action-pin, and M0B proof commands passed with `./.venv/bin/python` (Python 3.14.7). No product dependency was added.
- 2026-10-01: Ibrahim did not accept the M1 exit. Unrecognized IPv6 forms now classify as non-public, including `::`, an IPv4-compatible loopback, and addresses outside global unicast. Embedded IPv4 in mapped, compatible, 6to4, and NAT64 forms uses the IPv4 classifier. The suite gained those cases. No Cloud Run sandbox, staging network run, or Playwright worker was added.
