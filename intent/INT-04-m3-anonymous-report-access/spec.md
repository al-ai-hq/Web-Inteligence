# Spec: M3 local anonymous export denial

| Field | Value |
| --- | --- |
| Intent | `intent/INT-04-m3-anonymous-report-access/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-01) |
| Status | approved |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "I approve spec.md". The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: security engineer (security-baseline). Arabic review has no screen to sign. |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; arabic-rtl-a11y 0.1.0 |
| Source sections read | accepted INT-04 text; `docs/spec/05-PROJECT-PLAN.md` §1.1, §5; `docs/decisions.md` D-002, D-012, D-014, D-020; `docs/test-strategy.md` §6.2; `schemas/report-model.schema.json`; `schemas/export-authorization.schema.json`; `schemas/common.schema.json` `report_projection`; `scripts/check_m0b_proofs.py` `deny_export` |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

This spec defines a local check that denies an anonymous export and labels the stored report private and `noindex`. The denied formats are PDF, document, CSV, JSON, evidence, and task export. Each denial has no artifact and no signed URL. `public_gallery` is false and `noindex` is true.

The check does not add a screen, a route, or a download. It does not edit `scripts/check_m0b_proofs.py`. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when every denial and the access label pass. Any failure exits non-zero. Source: accepted INT-04 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. An anonymous request for each of `pdf`, `document`, `csv`, `json`, `evidence_bundle`, and `task_export` is denied. Those names are the export values in `schemas/common.schema.json` `report_projection`, excluding `web_interactive`. The in-app web view is not an export. Source: accepted INT-04 text; D-002; `schemas/export-authorization.schema.json`.
3. The same denial applies to `full_report_copy`. It is the remaining export value in that enum, and `docs/spec/05-PROJECT-PLAN.md` §1.1 forbids a full-report download for an anonymous user. Source: D-002; `schemas/common.schema.json`.
4. Each denial is `decision` `denied`, `denial_reason` `anonymous_export_prohibited`, with no artifact and no signed URL. A result that creates an artifact or a signed URL fails the check. Source: accepted INT-04 text; D-002; the same denial reason as `scripts/check_m0b_proofs.py` `deny_export`. This spec does not change that command.
5. One stored report access has `public_gallery` false and `noindex` true. A record with `public_gallery` true, or `noindex` false, fails the check. Source: accepted INT-04 text; `schemas/report-model.schema.json` `access`.
6. `web_interactive` is not denied as an export. The check does not treat the in-app projection as a download. Source: `schemas/export-authorization.schema.json` format description.
7. No schema file and no `config/` file is added or changed. `scripts/check_m0b_proofs.py` stays unchanged. Source: accepted INT-04 text.

### Non-functional

1. The check runs on this machine. It does not deploy, apply Terraform, call a provider, or fetch a client site. It does not create a public report link or a download. Product spend is `0.00` USD. Source: accepted INT-04 text; security-baseline skill.
2. Fixtures are synthetic. They contain no secrets, customer URLs, or live page text. Source: security-baseline skill.
3. There is no screen. Arabic copy, RTL layout, and WCAG evidence are not produced. Source: arabic-rtl-a11y skill; accepted INT-04 text.
4. `pnpm test:e2e` stays the placeholder recorded as not run. `pnpm test:ssrf` is not this exit. Source: accepted INT-04 text.
5. Expiry, deletion, eligibility, cookies, and a registered export that succeeds stay out of this check. Source: `docs/test-strategy.md` §6.2; accepted INT-04 text.

## Design

### Components and boundaries

The check is a local command beside `scripts/check_m0b_proofs.py`. It reads fixtures. It does not serve a route and does not write a schema. An export request is data. The command denies the anonymous request and compares the stored access labels. It does not issue a URL.

`scripts/check_m0b_proofs.py` stays the M0B proof. This command is separate so M3 does not reopen that file.

### Data contracts

No schema is added or changed. The denial and the access labels are suite fixtures. They use the existing fields `decision`, `denial_reason`, `format`, `noindex`, and `public_gallery`. `web_interactive` stays the only anonymous projection.

### State transitions

No workflow state is added. A denied export ends as `denied` and does not create an artifact.

### Configuration

No `config/` file is edited.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | no | No search behavior is added. | None for this spec. |
| security-baseline | yes | Anonymous exports are denied with no artifact and no signed URL. Access is `noindex` and not a public gallery. | Security engineer: expiry, deletion, and the live link stay later. |
| arabic-rtl-a11y | no | No screen and no download control. | Native review stays with the later screen. |
| data-integrity | no | No score is computed. | D-012 still applies when a screen exists. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | None for this spec. |
| connector-safety | no | No write tool and no connector. | None for this spec. |

## Areas of concern

1. Ibrahim approved this spec on 2026-10-01. The INT-04 status word stays `draft` because the acceptance message says not to set `accepted`. The security-engineer sign-off in the table above is still pending.
2. M0B already denies one anonymous CSV. This check adds the other export formats and the private/`noindex` label. It must not be treated as the full M3 exit in `docs/spec/05-PROJECT-PLAN.md` §5.
3. `docs/test-strategy.md` §6.2 also requires denial after expiry or deletion, a log canary, and a registered export that succeeds. Those cases are out of this spec.
4. OI-021 stays open. This spec does not close it.
5. Pull request 3 is already merged at `origin/main` `d8d3e18`. This spec does not merge anything else.

## Test and eval plan

The local command covers:

- denial of `pdf`, `document`, `csv`, `json`, `evidence_bundle`, `task_export`, and `full_report_copy` for an anonymous caller;
- each denial has reason `anonymous_export_prohibited`, no artifact, and no signed URL;
- failure when any of those formats is authorized or carries an artifact or a signed URL;
- pass when `public_gallery` is false and `noindex` is true;
- failure when `public_gallery` is true or `noindex` is false;
- `web_interactive` is not classified as an export denial.

No browser journey, no golden-file eval, and no product-agent eval. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- No new assumption row. The denial reason is the existing `anonymous_export_prohibited` value.
- Leave OI-005, OI-021, OI-036, OI-039, and OI-056 open.
- No new decision row.
