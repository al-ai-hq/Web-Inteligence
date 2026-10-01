# Spec: M7 local public footprint

| Field | Value |
| --- | --- |
| Intent | `intent/INT-08-m7-public-footprint/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-01) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "I approve spec.md." The status word stays `draft` because that message also says not to set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: methodology owner (footprint facts), data engineer (data-integrity), integration engineer (connector-safety) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0; connector-safety 0.1.0 |
| Source sections read | accepted INT-08 text; `docs/spec/05-PROJECT-PLAN.md` §5 M7; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.9, §5.10; `docs/spec/02-DETAILED-SPECIFICATION.md` §10, §13; `docs/test-strategy.md` §5; `schemas/public-source-observation.schema.json`; `schemas/common.schema.json` `confidence_level`; `schemas/change-operation.schema.json` `status`; `docs/decisions.md` D-009, D-016, D-020; data-integrity skill; connector-safety skill |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-01. This session does not set `approved`.

## Summary

This spec defines a local check that keeps a public fact tied to a source and a confidence label, keeps a missing review count from being stored as a number, and keeps a correction unapplied. A missing review count stays null. It is not `0` and it is not any other number. A correction stored as `applied` is refused.

The check does not fetch a page and does not send a correction. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the fact case, the missing-count case, and the correction case all pass. Any failure exits non-zero. Source: accepted INT-08 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. A passing public fact shows a source and a confidence label. The confidence label is one of `high`, `medium`, or `low`. A fact with no source is refused. A fact with no confidence label is refused. Source: accepted INT-08 text; `schemas/common.schema.json` `confidence_level`; `docs/test-strategy.md` §5.
3. A missing review count is null. Storing it as `0` or as any other number fails the check. Source: accepted INT-08 text; `schemas/public-source-observation.schema.json` description "recorded only as displayed; never estimated"; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.9; `docs/spec/02-DETAILED-SPECIFICATION.md` §13.
4. A correction stays `pending`. Storing it as `applied` fails the check. Source: accepted INT-08 text; `schemas/change-operation.schema.json` `status`; `docs/spec/02-DETAILED-SPECIFICATION.md` §10; D-016.
5. The check does not choose a public source, a review platform, or a listing platform. The source in the fixture is a synthetic label. Source: accepted INT-08 text.
6. No schema file and no `config/` file is added or changed. The check does not edit the M6 command. Source: accepted INT-08 text.

### Non-functional

1. The check runs on this machine. It does not fetch a profile, a listing, a review page, or a client site. It does not call Google Autocomplete or scrape a search-result page. It does not send a correction. Product spend is `0.00` USD. Source: accepted INT-08 text; D-009; D-016.
2. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.
3. Fixtures are synthetic. They contain no secrets, customer page text, or live review text. Source: accepted INT-08 text.
4. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-08 text.
5. Approved public-source discovery, the entity graph, the brand fact registry, hallucination monitoring, and earned-evidence recommendations stay out of this check. Source: accepted INT-08 text; `docs/spec/05-PROJECT-PLAN.md` §5.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not fetch a page and it does not call a connector. Stored rows are data. The command refuses a fact with no source, a missing review count stored as a number, and a correction stored as `applied`.

### Data contracts

No schema is added or changed. One fixture carries a synthetic source and a confidence label from `confidence_level`. One fixture carries a missing review count as null. One fixture carries a correction whose status is `pending`. These fixtures are not a full public-source observation and not a full change operation.

### State transitions

No workflow state is added. A missing source ends as refused. A missing review count stays null. A correction stays `pending`.

### Configuration

No `config/` file is edited. No platform name is written.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete and no result-page scrape. | SEO lead: this check is not a search report. |
| security-baseline | yes | No fetch and no secret. | A later public-source fetch stays out of this slice. |
| arabic-rtl-a11y | no | No screen. | Arabic name transliteration stays open. |
| data-integrity | yes | The source and the confidence label are visible. A missing review count is null, not a number. Counts are not estimated. | Data engineer: this fixture is not a full public-source observation. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). |
| connector-safety | yes | The correction stays `pending`. Nothing is applied or published. | Integration engineer: a later correction workflow stays out of this slice. |

## Areas of concern

1. This spec stays `draft`. Ibrahim approved it on 2026-10-01 and said not to set `approved`. The INT-08 status word also stays `draft`.
2. The M7 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires approved discovery, an entity graph, and a governed correction workflow in the product. This check is the first slice only.
3. `schemas/public-source-observation.schema.json` allows a displayed review count of `0` when `as_displayed` is true. This check does not cover that displayed-zero case. It covers a missing count, which stays null.
4. The approved public sources, review platforms, and listing platforms stay open. The synthetic source in this check is not that decision.
5. OI-021 stays open. This spec does not close it.
6. Pull request 7 is already merged at `origin/main` `c01dbd4`. This spec does not merge anything else, and it does not finish the later M6 exit.

## Test and eval plan

The local command covers:

- a public fact with a source and a confidence label of `high`, `medium`, or `low`;
- a refusal when the source is missing;
- a refusal when the confidence label is missing;
- a missing review count stored as null;
- a refusal when that missing count is stored as `0` or as any other number;
- a correction stored as `pending`;
- a refusal when that correction is stored as `applied`.

No browser journey, no golden-file eval, and no live fetch. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- No new assumption row.
- Leave the approved public sources, review platforms, listing platforms, and Arabic transliteration open.
- Leave OI-021 open.
- No new decision row.
