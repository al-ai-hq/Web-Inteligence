# Spec: M12 local gallery gate

| Field | Value |
| --- | --- |
| Intent | `intent/INT-13-m12-local-gallery-gate/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-04) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-04 |
| Product owner sign-off | Ibrahim, 2026-10-04, by the message "I approve spec.md." The status word stays `draft` because this session does not set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: privacy owner (anonymous publication), security engineer (security-baseline) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; connector-safety 0.1.0; google-search-guidance 0.1.0; arabic-rtl-a11y 0.1.0 |
| Source sections read | accepted INT-13 text; `docs/spec/05-PROJECT-PLAN.md` §5 M12 and §14; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.17 and §5.18; `docs/test-strategy.md` §5 M12 row, TS-GALLERY, and TS-TONE; `docs/decisions.md` D-002, D-020; security-baseline 0.1.0 |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-04. This session does not set `approved`.

## Summary

This spec defines a local check with one refusal. Placing an anonymous report in a public gallery is refused when consent is missing.

The check does not publish a public page, create a public link, or change noindex. It does not add a write-class tool to `config/agents/*.yaml`. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opus` at xhigh is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when placing an anonymous report in a public gallery is refused because consent is missing. Any failure exits non-zero. Source: accepted INT-13 text; `docs/spec/05-PROJECT-PLAN.md` §5 M12.
2. The report is anonymous. Consent is missing. The command refuses placing that report in a public gallery. Storing the placement is refused. Source: accepted INT-13 text; D-002; security-baseline 0.1.0.
3. The check does not create a public page or a public link. It does not change noindex. The anonymous report stays in-app. Source: accepted INT-13 text; D-002.
4. No schema file, no `config/` file, and no `config/agents/*.yaml` file is added or changed. No write-class tool is added. The check does not edit the M11 command. Source: accepted INT-13 text.
5. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.

### Non-functional

1. The check runs on this machine. It does not publish a report, create a public link, or call a live provider. It does not call Google Autocomplete or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-13 text; D-009.
2. Fixtures are synthetic. They contain no secrets, no customer page text, and no live report identifiers. The anonymous report and the public gallery are labels in the fixture. Source: accepted INT-13 text.
3. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-13 text.
4. Search, filters, a leaderboard, benchmarks, redaction, removal, revocation, and the six tones stay out of this check. Source: accepted INT-13 text; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.17 and §5.18; `docs/spec/05-PROJECT-PLAN.md` §5 M12; `docs/test-strategy.md` §5 M12 row.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not query a database, serve a page, or hold a credential. The anonymous report is data. The command refuses placing that report in a public gallery when consent is missing. It does not publish the report.

### Data contracts

No schema is added or changed. One fixture is an anonymous report whose consent is missing. That row is not a public page, a public link, or a full stored report. noindex is not a field this check writes.

### State transitions

No workflow state is added. A placement with missing consent ends as refused. The report stays out of the public gallery.

### Configuration

No `config/` file is edited. No agent tool list is edited. The gallery is not enabled.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete and no result-page scrape. noindex is not changed. | SEO lead: this check is not a search report. |
| security-baseline | yes | An anonymous report with missing consent is not placed in a public gallery. No public link, no secret, and no write tool. | Privacy owner: this fixture is not a live publication check. |
| arabic-rtl-a11y | no | No screen. | Arabic review stays out of this slice. |
| data-integrity | yes | The refusal is the check result. The report is not stored as a public placement. | Data engineer: this fixture is not a full report record. |
| cost-guard | yes | No paid call and no public page. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). |
| connector-safety | yes | No connector write and no write-class tool. | Integration engineer: publication stays out of this slice. |

## Areas of concern

1. This spec stays `draft`. Ibrahim approved it on 2026-10-04 by the message "I approve spec.md" and this session does not set `approved`. The INT-13 status word also stays `draft`.
2. The M12 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires no private-data leak on a real gallery, proven removal, and tone invariance. This check is the first slice only.
3. A missing consent and an empty consent are both no consent. Ibrahim closed that question on 2026-10-04 in the message that approved this spec and asked for the plan. Missing is an absent `consent` field or JSON `null`. Empty is `""` or whitespace after trimming. This check does not place either one in the public gallery.
4. A report that is not anonymous, and a placement that already has explicit consent, are not this case. Domain-owner opt-in, redaction, and removal stay later (`docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.17).
5. OI-021 stays open. This spec does not close it.
6. `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-16 as M12. Ibrahim named this path. INT-16 stays that table's label. This spec does not edit that table.
7. `origin/main` at `b56291b` includes the local M11 check. This spec does not finish the later M11 exit and does not start M13.

## Test and eval plan

The local command covers:

- an anonymous report whose consent is missing;
- a refusal when that report would be placed in a public gallery;
- a refusal of a stored public placement for that report.

No browser journey, no public page, and no public link. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. The gallery stays disabled. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- ASSUMPTION: the anonymous report and the public gallery are synthetic labels. They are not a live report and not a live page.
- No new assumption row is appended in this stage.
- Leave gallery eligibility, retention, moderation, removal, tones, and the owner names open (OI-002).
- Leave OI-021 open.
- No new decision row. `docs/spec/05-PROJECT-PLAN.md` §14 is not edited.
