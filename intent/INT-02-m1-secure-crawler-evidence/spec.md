# Spec: M1 local SSRF suite

| Field | Value |
| --- | --- |
| Intent | `intent/INT-02-m1-secure-crawler-evidence/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-01) |
| Status | approved |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "I approve spec.md". The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: security engineer (security-baseline), data engineer (data-integrity), SEO lead (google-search-guidance). Cost, connector, and Arabic owners have no change to sign in this spec. |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; connector-safety 0.1.0; google-search-guidance 0.1.0; arabic-rtl-a11y 0.1.0; marketing-seo-agent vendored snapshot 2026-09-30 (no version field in its SKILL.md) |
| Source sections read | accepted INT-02 text; `docs/spec/00-READ-ME-FIRST.md`; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §8 "Crawling", §12; `docs/spec/02-DETAILED-SPECIFICATION.md` §5, §17; `docs/spec/04-CLAUDE-CODE-BUILD-PROMPT.md` §6; `docs/spec/05-PROJECT-PLAN.md` §5; `docs/spec/06-MODEL-PLAN.md` §3, §8; `docs/test-strategy.md` §5, §6.1; `docs/threat-model.md` AC-09, AC-10; `docs/decisions.md` D-002, D-008, D-009, D-014, D-019, D-020, D-021; `schemas/evidence-object.schema.json`; `apps/web/src/placeholders.test.ts`; `scripts/placeholders/ssrf.mjs` |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

This spec defines the local SSRF suite that replaces the M0A placeholder. `pnpm test:ssrf` runs that suite. It passes only when a submitted URL, a redirect, a sitemap entry, and a discovered link cannot reach an internal or metadata address, when the local fetch path has no secret client, database client, or write tool, and when a representative result is labelled a sample.

The suite runs on this machine against fixtures and an in-process resolver stub. It does not add a Cloud Run sandbox, a staging network run, or a Playwright worker. It does not crawl the public web, call a provider, or spend.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `fable` at max is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. `pnpm test:ssrf` runs the local suite and exits 0 only when every case in this spec passes. Any failed case exits non-zero. The command no longer prints that the suite is not run. Source: accepted INT-02 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. `apps/web/src/placeholders.test.ts` stops asserting that the SSRF command prints `not run`. The browser-journey test still asserts that `scripts/placeholders/e2e.mjs` prints `not run` and `M3`. Source: D-021; accepted INT-02 text.
3. Schemes other than `http` and `https` are rejected before a connection. The suite includes `file`, `ftp`, `gopher`, `data`, `javascript`, `ws`, and `wss`. A URL with userinfo is rejected. Source: `docs/spec/04-CLAUDE-CODE-BUILD-PROMPT.md` §6; `docs/test-strategy.md` §6.1; security-baseline skill.
4. Ports other than 80 and 443 are rejected. Those two ports stay the assumption already written in `docs/threat-model.md` AC-09. This spec does not choose further product limits. Source: AC-09; OI-053.
5. Before a connection, and again on every redirect, the suite resolves the name, rejects the target when any answer is non-public, and pins the validated address for that hop. Rejected ranges are loopback, private, shared address space, link-local, multicast, reserved, documentation, "this network", and broadcast for IPv4, plus IPv6 loopback, unique local, link-local, and IPv4-mapped or IPv4-embedded forms that carry a non-public IPv4 address. Decimal, octal, hexadecimal, short, mixed, trailing-dot, case-variant, and internationalized host forms are normalized before the check. Source: 04 §6; `docs/test-strategy.md` §6.1; AC-09; AC-10.
6. Metadata targets are rejected by name and by address. The suite includes the hostname `metadata.google.internal` and the address `169.254.169.254`. A firewall is not the control under test. Source: 02 §17; AC-09.
7. DNS rebinding is tested with an in-process stub, not a staging resolver. The stub returns a public address at validation and a private address at connection; a mixed public and private answer; and a private IPv6 answer beside a public IPv4 answer. Each case is rejected. A connection that proceeds uses the pinned validated address. Source: AC-10; `docs/test-strategy.md` §6.1. The staging network run in that section is out of this spec.
8. Redirects are re-validated on every hop. The suite rejects a public-to-private hop, a hop to a non-HTTP scheme, a loop, and a chain one hop past the fixture ceiling. Sitemap entries and discovered links that point at a private address, a metadata target, or a host other than the validated target host are not fetched. Source: `docs/test-strategy.md` §6.1; accepted INT-02 text.
9. The local fetch module under test does not reference a Secret Manager client, a database client, or a write-class tool. Write-class names are `apply_change`, `publish`, `write_cms`, `delete_content`, `upload_disavow`, `send_email`, and `submit_form`, the same set `scripts/check_config.py` already guards. This is a source check. It does not prove a cloud identity. Source: accepted INT-02 text; D-009; connector-safety skill; security-baseline skill.
10. A representative result carries coverage `sample`, the count of fetched pages, and a disclosure that this count is not a site-wide count. A result that marks that same fetch set as full coverage fails the suite. The suite does not adopt a universal page cap. Source: 01 §8 "Crawling"; 01 §12; data-integrity skill. The "up to 20" sentence in 02 §5 stays an assumption and is not a requirement of this suite. 01 says free-audit page counts are not a fixed universal 20-page claim.
11. Fixture ceilings for redirect hops, response bytes, decompressed bytes, page count, depth, and duration live in the suite fixture, not in `config/`. One case per ceiling is one step past that fixture value and is refused. Those numbers are test values. They are not the product limits in OI-053. Source: OI-053; `docs/test-strategy.md` §6.1.
12. The suite does not import `.claude/skills/marketing-seo-agent/scripts`. It does not call Google Autocomplete or fetch a search-result page. Source: D-009; google-search-guidance skill.
13. Existing schemas, scoring weights, `config/budgets.yaml`, agent allowlists, and the M0A toolchain stay unchanged except the SSRF command and the SSRF half of `apps/web/src/placeholders.test.ts`. `methodology_version` stays `0.1.0-draft`. Source: accepted INT-02 text; D-021.

### Non-functional

1. The suite runs locally. It does not deploy, apply Terraform, call a live provider, crawl the public web, or use a production credential. Product spend is `0.00` USD. Source: accepted INT-02 text; D-019; cost-guard skill.
2. Fixtures use reserved documentation names and synthetic ids. They contain no secrets, tokens, emails, customer URLs, or raw page bodies from a live site. Source: security-baseline skill.
3. There is no screen. Arabic copy and WCAG evidence are not produced. Source: arabic-rtl-a11y skill.
4. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-02 text.
5. Evidence captured by a later milestone still needs lineage and a `fidelity_label`. This suite does not store an `EvidenceObject` and does not add a schema. Source: data-integrity skill; `schemas/evidence-object.schema.json`; D-014.

## Design

### Components and boundaries

The trust boundary is the URL and every hop, sitemap entry, and discovered link derived from it. Page text is data. The suite does not follow instructions found in a fixture body.

`pnpm test:ssrf` points at the suite instead of `scripts/placeholders/ssrf.mjs`. The suite is product test code. The skill fetcher in `page_audit.py` is not imported.

The resolver is an in-process stub. No system proxy is used, because a proxy would resolve names itself (AC-10). No Cloud Run job, no VPC firewall, and no browser process are part of this design.

The secret and database check reads the fetch module's source and fails if a forbidden client or write-class name appears. It does not open a network connection to Secret Manager or a database.

### Data contracts

No schema is added or changed. The sample result is a suite fixture with three fields: `coverage` equal to `sample`, `fetched_count` as an integer, and `site_wide_count` null. A fixture that sets `coverage` to `full` fails. Stored evidence, when a later spec adds it, still uses `schemas/evidence-object.schema.json` and carries `project_id` through lineage (D-014).

### State transitions

No workflow state is added. A rejected target ends as `refused` with a reason code from this set: `scheme`, `userinfo`, `port`, `non_public_address`, `metadata`, `rebinding`, `redirect`, `off_host`, `over_limit`. No retry follows a refusal. A refusal does not create an evidence object.

### Configuration

No `config/` file is added. Port 80 and 443 remain the AC-09 assumption, cited by the suite, not copied into a new limits file. Model ids, prices, quotas, and crawler tokens are not introduced (D-010).

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete call, no result-page fetch, no import of the skill scripts. No rule weight change. | SEO lead: robots and the crawler registry are not in this spec. |
| security-baseline | yes | Local validator covers scheme, userinfo, port, non-public ranges, metadata names, redirects, and an in-process rebinding stub. | Security engineer: this does not prove a cloud identity or a browser subresource. |
| arabic-rtl-a11y | no | No screen and no user-facing copy. | None for this spec. |
| data-integrity | yes | A representative result is `sample` and is not a site-wide count. No score is computed. | Data engineer: the disclosure is a suite fixture, not a stored `EvidenceObject`. |
| cost-guard | yes | No paid call and no hosting resource. Spend is `0.00` USD. | None for this spec. The combined cap stays unconfirmed (OI-001). |
| connector-safety | yes | The fetch path has no write-class tool. | None for this spec. The first connector stays open. |

## Areas of concern

1. The intent status word is still `draft`. Ibrahim accepted the text and told this session not to set `accepted`.
2. `docs/test-strategy.md` §6.1 asks for a staging network run and for renderer subresource checks. This spec excludes both, by the accepted intent bound. The four-line exit in 05 §5 is met locally for URL, redirect, sitemap, and discovered-link fetches. It is not met for a browser, and it is not met for a crawl-project identity. A later M1 spec owns those.
3. Requirement 9 can pass while a future package still reaches Secret Manager. The check is limited to the local fetch module named by the plan.
4. OI-053 is open. Fixture ceilings are not product limits. A plan that copies them into `config/` would decide OI-053 without the security engineer.
5. 02 §5 assumes a representative cap of 20 pages. 01 says that is not a fixed universal claim. This spec requires the sample label and does not require the number 20.
6. M0B commit `a36d305` was not on `origin/main` when this spec was written. This spec does not reopen M0B.
7. 04 §6 also requires robots, rate limits, and no-bypass. Those are not cases in this suite.

## Test and eval plan

The suite is `pnpm test:ssrf`. Cases, one fixture each unless noted:

- rejected schemes listed in requirement 3, plus one allowed `https` URL on port 443 using a documentation address;
- userinfo rejected;
- a port other than 80 or 443 rejected;
- one address in each rejected IPv4 and IPv6 class in requirement 5;
- one normalized encoding that hides a loopback address, rejected;
- `metadata.google.internal` and `169.254.169.254` rejected;
- three rebinding stub cases in requirement 7;
- public-to-private redirect, scheme-changing redirect, redirect loop, and one hop over the fixture ceiling;
- a sitemap entry and a discovered link to a private address, and one link to another host, not fetched;
- one over-ceiling case each for response bytes, decompressed bytes, page count, depth, and duration;
- source check for secret client, database client, and write-class names;
- representative result with `coverage` `sample` passes; the same result with `coverage` `full` fails.

No golden-file eval, product-agent eval, or browser journey. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. The suite is a local command. Rollback is reverting the commit that replaces the placeholder. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001). Hosting overrun stays open (OI-031).

## Assumptions and open items

- ASSUMPTION: ports 80 and 443, already recorded in `docs/threat-model.md` AC-09. Not a new assumption row.
- ASSUMPTION: fixture ceilings are test values only. Do not copy them to `docs/assumptions.md` as product limits.
- Leave OI-053 open. Leave OI-001, OI-010, OI-021, and OI-031 open.
- No new decision row. D-020 already covers the model name. The session model for this spec is Grok 4.7.
