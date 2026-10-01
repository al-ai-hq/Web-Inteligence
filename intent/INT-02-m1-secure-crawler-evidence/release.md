# Release: M1 local SSRF suite

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/INT-02-m1-secure-crawler-evidence/` |
| Milestone | M1 |
| Status | draft |
| Environment | none. No deploy, no staging, no production. |
| Release approver | pending `<DECIDE_AT_M0: release manager name>` |
| Release time (UTC) | 2026-10-01 (record date for this local session, not a deploy) |
| Change ticket (prod) | not prod |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

Ibrahim did not accept the M1 exit gate. This record stays a draft. It does not authorize a release, a commit, or a pull request.

`pnpm test:ssrf` passed again after that refusal: 13 tests, exit 0. Unrecognized IPv6 forms, including `::`, `::127.0.0.1`, and `ff02::1`, are classified as non-public and refused. The earlier run of 12 tests is not the current suite.

Nothing was deployed. M2 has not started. Product spend is `0.00` USD.

## Artifact versions

- Commit SHA: none. The work is local and uncommitted on `m1-secure-crawler`.
- Image digest: none.
- Schema versions: unchanged. 87 schema files.
- `methodology_version`: unchanged, `0.1.0-draft`.
- Node toolchain: unchanged (D-021). No new npm dependency.
- Python for the passing schema checks: `./.venv/bin/python`, Python 3.14.7.
- Product spend: `0.00` USD.

## Migrations

None.

## Files changed

No pull request. The path list is in `intent/INT-02-m1-secure-crawler-evidence/review.diff`, saved before this file. New product files are `apps/web/src/ssrf/validate.ts`, `sample.ts`, and `suite.test.ts`, plus `evals/m1/ceilings.json` and `evals/m1/forbidden-references.json`. `package.json` `test:ssrf` now runs that suite. `scripts/placeholders/ssrf.mjs` is deleted. The browser placeholder remains.

## Commands and checks actually run

Run on 2026-10-01 from the repository root. The implementation session ran these. The reviewers did not.

| Command | Result |
| --- | --- |
| `pnpm test:ssrf` | Passed again after the exit was not accepted. 13 tests, exit 0. The new case is `rejects unrecognized IPv6 forms`. |
| `pnpm test` | Passed. 14 tests, 3 files. |
| `pnpm lint` | Passed after removing an unused parameter in the suite. |
| `pnpm typecheck` | Passed after the limit result stopped using the general refusal helper. |
| `python3 -m unittest discover -s .claude/hooks/tests` | Passed. 72 tests, OK. |
| `python3 -m unittest discover -s .cursor/hooks/tests` | Passed. 15 tests, OK. |
| `/opt/homebrew/bin/python3 scripts/check_schemas.py` | Failed. `jsonschema` is not installed for that interpreter. |
| `./.venv/bin/python scripts/check_schemas.py` | Passed. 87 schemas, 13 examples, 22 negative examples. |
| `./.venv/bin/python scripts/check_config.py` | Passed. 3627 checks. |
| `./.venv/bin/python scripts/check_action_pins.py` | Passed. |
| `./.venv/bin/python scripts/check_m0b_proofs.py` | Passed. Exit 0, including `product spend 0.00 USD`. Not a new behaviour of this slice. |
| `pnpm test:e2e` | Exit 0. Recorded as not run. Printed `pnpm test:e2e is not run. Browser journeys arrive at M3.` |
| GitHub Actions | Not run. No push. |

`pnpm test:ssrf` stdout after the IPv6 fix, with `--reporter=verbose`:

```text
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects schemes other than http and https 1ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects userinfo and a port other than 80 or 443 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects one address in each non-public class 1ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects unrecognized IPv6 forms 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects obfuscated loopback forms before a connection 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects metadata by name and by address 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > allows the stub public address and pins it 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > rejects rebinding and mixed answers 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > re-checks redirects and enforces the hop ceiling 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > does not fetch a private, metadata, or off-host link 1ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > allows a ceiling and refuses one step past it 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > labels a representative result as a sample 0ms
✓ apps/web/src/ssrf/suite.test.ts > local SSRF suite > keeps secret, database, and write-class names off the fetch path 1ms

Test Files  1 passed (1)
     Tests  13 passed (13)
```

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Local SSRF suite | yes | | | `pnpm test:ssrf`, 13 tests after the IPv6 fix |
| Unit tests | yes | | | 14 tests, including the suite and the browser placeholder |
| Hook tests | yes | | | 72 Claude hook tests and 15 Cursor hook tests |
| Schema, config, action pins | yes | | | Passed with `./.venv/bin/python` |
| Homebrew `python3` schema check | | yes | | Missing `jsonschema` |
| Browser journeys | | | yes | Placeholder only |
| Staging network SSRF run | | | yes | Out of this slice |
| Playwright render checks | | | yes | Out of this slice |
| Golden files and agent evals | | | yes | No rule change |

## Security, privacy and cost review

`security-reviewer` (session e26bd6b7-f705-4738-89e5-ac177d9e47ec) read the diff and did not run commands. It does not approve.

Clean on the containment checks: no live fetch, no socket, no `node:dns` or `node:net`, metadata name and `169.254.169.254` refused, rebinding uses the injected stub, the denylist matches `WRITE_CLASS_TOOLS`, fixtures have no secrets, and there is no Cloud Run job, staging run, Playwright worker, or paid call.

Open findings, not fixed in this session:

- High, fixed after Ibrahim did not accept the exit: unrecognized IPv6 now classifies as non-public. The suite refuses `::`, `::127.0.0.1`, and `ff02::1`. Embedded IPv4 in mapped, compatible, 6to4, and NAT64 forms uses the IPv4 classifier. Global unicast `2000::/3` stays public, except documentation `2001:db8::/32`. The exit gate is still not accepted.
- Medium: some reserved ranges are not classified; the linked-URL connector is never called, so an empty call list does not prove a fetch was possible; byte and duration ceilings apply only when the caller passes `observed`; the connector does not record the hostname for SNI; `AGENTS.md`, `CLAUDE.md`, and the CI step still call `pnpm test:ssrf` a placeholder; metadata-by-name is only `metadata.google.internal`.
- Low: the suite file is excluded from `pnpm typecheck`; `1.2.3.4` is a routable address used only as a stub answer and is not dialled; two different public answers are refused as rebinding; redirect refusals collapse to reason `redirect`.

Obfuscated IPv4 forms in the suite are normalized by the runtime URL parser to `127.0.0.1` before this code classifies them. The suite then refuses that address. The code does not open a socket.

`verifier` (session 3f0ffa55-6d6d-42d4-aff1-fdf58897af38) compared the files with the plan and did not run commands. The file list matches the plan. The recorded departure is the Python interpreter. Sitemap entries and discovered links share one function.

Privacy: fixtures are synthetic. No personal data and no production credentials. Cost against the USD 150 cap: `0.00` USD. No new dependency.

## Arabic and accessibility evidence

No screen was added. Arabic review and WCAG 2.2 AA evidence are not run.

## Unresolved risks

- The exit gate is not accepted. The unrecognized-IPv6 finding is fixed in the working tree and is not committed. The medium findings from the security review stay open. Owner: security engineer. Names remain `<DECIDE_AT_M0: name>` (OI-002).
- This source scan does not prove a cloud identity. The crawl project, egress firewall, and staging network run wait on region (OI-010).
- Fixture ceilings are test values. OI-053 stays open.
- D-005 and OI-001 stay open. OI-031 stays open. OI-021 stays open.
- `AGENTS.md` and `CLAUDE.md` still say `pnpm test:ssrf` is not run. The command now runs the suite. Those sentences were not in the approved file list.

## Rollback

No production path. After a commit, rollback is `git revert` of that commit on `m1-secure-crawler`. Restoring `scripts/placeholders/ssrf.mjs` and the old `test:ssrf` script returns the placeholder. Staging rehearsal: not run.

## Monitoring

No service is deployed. The later signal is a green `app` job whose `pnpm test:ssrf` step runs this suite.

## Post-release verification

Not run. Nothing was released.

## Decisions, assumptions and open items

No new decision, assumption, or open-item row. Fixture ceilings were not copied into `docs/assumptions.md`. OI-053 stays open.

One departure is in `plan.md`: the schema checks that passed used `./.venv/bin/python`, not `/opt/homebrew/bin/python3`.

Reviewers: `security-reviewer` and `verifier`. They did not approve, merge, or spawn subagents. The test-writer named in the plan was not run. The user asked for the security reviewer and the verifier only.
