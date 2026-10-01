# Spec: M4 local source separation

| Field | Value |
| --- | --- |
| Intent | `intent/INT-05-m4-source-separation/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-01) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | pending. Ibrahim accepted the intent text by the message "I accept this INT-05 text". He has not approved this spec. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: data engineer (data-integrity), SEO lead (google-search-guidance) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; data-integrity 0.1.0; google-search-guidance 0.1.0 |
| Source sections read | accepted INT-05 text; `docs/spec/05-PROJECT-PLAN.md` §5; `docs/decisions.md` D-004, D-009, D-012, D-014, D-020; `docs/test-strategy.md` §6.3; data-integrity skill; google-search-guidance skill |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

This spec defines a local check that keeps Search Console numbers apart from GA4 numbers and keeps a missing optional source apart from zero. `not_supplied` is not `measured_zero`. There is no account and no claim flow.

The check does not connect Search Console or GA4. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the source-separation case and the missing-source case both pass. Any failure exits non-zero. Source: accepted INT-05 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. A Search Console number and a GA4 number stay in separate totals. The check refuses a result that adds one to the other. Source: accepted INT-05 text; data-integrity skill.
3. A missing optional source is `not_supplied`. It is not `measured_zero`, and it is not the number 0. Source: accepted INT-05 text; data-integrity skill.
4. `not_supplied` and `measured_zero` stay different integrity states. A case that stores `not_supplied` as `measured_zero` fails the check. Source: accepted INT-05 text; data-integrity skill.
5. The fixture does not fold either source into Presence Readiness, Experience Effectiveness, or observed AI visibility. Source: D-012.
6. The fixture does not compute a CTR from a Search Console generative-AI export. Source: google-search-guidance skill.
7. No schema file and no `config/` file is added or changed. Source: accepted INT-05 text.

### Non-functional

1. The check runs on this machine. It does not connect Search Console or GA4, call a provider, or fetch a client site. It does not call Google Autocomplete or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-05 text; D-009.
2. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.
3. Fixtures are synthetic. They contain no secrets, customer account ids, or live query text. Source: accepted INT-05 text.
4. There is no account, no claim flow, and no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-05 text; D-004.
5. CTR from totals, impression-weighted position, rate changes in percentage points, time zones, and the incomplete recent Search Console days stay out of this check. Source: accepted INT-05 text; `docs/test-strategy.md` §6.3.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not call Google. Stored rows are data. The command refuses a combined total and refuses a missing source labelled as zero. It does not create a user or a connector.

### Data contracts

No schema is added or changed. The fixture carries a source name, a number or a missing marker, and an integrity state. Search Console and GA4 are the only two sources in this check.

### State transitions

No workflow state is added. A combined total ends as refused. A missing source stays `not_supplied`.

### Configuration

No `config/` file is edited.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete, no result-page scrape, and no CTR from the generative-AI export. | SEO lead: the later formula catalogue stays open. |
| security-baseline | no | No fetch and no account. | Claiming and connector ownership stay later. |
| arabic-rtl-a11y | no | No screen. | Arabic query normalization stays later. |
| data-integrity | yes | Sources stay separate. `not_supplied` is not `measured_zero`. | Data engineer: this fixture is not a stored metric row with full lineage. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | None for this spec. |
| connector-safety | no | No connector and no write tool. | None for this spec. |

## Areas of concern

1. This spec is `draft`. Ibrahim has not approved it. The INT-05 status word stays `draft` because the acceptance message says not to set `accepted`.
2. The M4 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires expected-value formulas and a claim that does not grant domain or connector authority. This check is the first slice only.
3. OI-021 stays open. This spec does not close it.
4. Pull request 4 is already merged at `origin/main` `73d1d4d`. This spec does not merge anything else.

## Test and eval plan

The local command covers:

- a Search Console number and a GA4 number kept in separate totals;
- a refusal when those numbers are added;
- a missing optional source stored as `not_supplied`, not as `measured_zero` and not as 0;
- a failure when `not_supplied` is stored as `measured_zero`.

No browser journey, no golden-file eval, and no live provider call. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- No new assumption row.
- Leave OI-005 and OI-021 open.
- No new decision row.
