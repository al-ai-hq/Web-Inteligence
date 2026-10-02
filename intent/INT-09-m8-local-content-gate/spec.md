# Spec: M8 local content gate

| Field | Value |
| --- | --- |
| Intent | `intent/INT-09-m8-local-content-gate/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-02) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-02 |
| Product owner sign-off | Ibrahim, 2026-10-02, by the message "I approve spec.md." The status word stays `draft` because this session does not set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: methodology owner (content claims and cannibalization), data engineer (data-integrity), integration engineer (connector-safety), SEO lead (google-search-guidance) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0; connector-safety 0.1.0; arabic-rtl-a11y 0.1.0; marketing-seo-agent has no version field and is reference only (scripts not imported, D-009) |
| Source sections read | accepted INT-09 text; `docs/spec/05-PROJECT-PLAN.md` §5 M8; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.11; `docs/spec/02-DETAILED-SPECIFICATION.md` §8, §10, §20 risk row "New content or a title change cannibalizes existing pages"; `docs/test-strategy.md` §5 M8 row; `docs/decisions.md` D-009, D-012, D-016, D-020 |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-02. This session does not set `approved`.

## Summary

This spec defines a local check with three refusals. A claim with no source is refused. A new page is refused when the cannibalization result is missing, and that missing result is not stored as a pass. A page stored as published is refused.

The check does not write a CMS draft, open a client pull request, or publish a page. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the claim case, the new-page case, and the publication case all pass. Any failure exits non-zero. Source: accepted INT-09 text; `docs/spec/05-PROJECT-PLAN.md` §5 M8.
2. A passing claim has a source. A claim with no source is refused. A missing source and an empty source are both no source. Source: accepted INT-09 text; `docs/spec/02-DETAILED-SPECIFICATION.md` fabricated-claim rule cited by the M8 exit; `docs/test-strategy.md` §5 M8 row.
3. A new page is refused when its cannibalization result is missing. The missing result is null. Storing that missing result as a pass fails the check. Source: accepted INT-09 text; `docs/spec/02-DETAILED-SPECIFICATION.md` §8 and §10; `docs/spec/05-PROJECT-PLAN.md` §5 M8.
4. A page stored as `published` is refused. The check does not store a CMS draft, open a client pull request, or publish the page. Source: accepted INT-09 text; `docs/spec/05-PROJECT-PLAN.md` §5 M8 and §5 M9; D-016.
5. The check does not import `.claude/skills/marketing-seo-agent/scripts`, including `cannibalization.py`. Source: D-009; accepted INT-09 text.
6. No schema file and no `config/` file is added or changed. The check does not edit the M7 command. Source: accepted INT-09 text.

### Non-functional

1. The check runs on this machine. It does not fetch a page, call a CMS, or open a client repository. It does not call Google Autocomplete or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-09 text; D-009; D-016.
2. Fixtures are synthetic. They contain no secrets and no customer page text. Source: accepted INT-09 text.
3. The check does not blend a content claim into Presence Readiness, Experience Effectiveness, observed AI visibility, or search performance. Source: D-012.
4. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-09 text.
5. Briefs, bilingual drafts, schema build or validation, fact manifests, regulated-claim flags, Arabic editorial review, and the approval workflow stay out of this check. Source: accepted INT-09 text; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.11; `docs/spec/05-PROJECT-PLAN.md` §5 M8.
6. The check does not score `llms.txt`, require an FAQ block, or promise a rich result. Source: accepted INT-09 text; google-search-guidance 0.1.0.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not fetch a page and it does not call a connector. Stored rows are data. The command refuses a claim with no source, a new page whose cannibalization result is missing, a missing cannibalization result stored as a pass, and a page stored as `published`.

### Data contracts

No schema is added or changed. One fixture carries a claim with a synthetic source. One fixture carries a new page whose cannibalization result is present and is not a pass standing in for a missing result. One fixture carries a page that is not stored as `published`. These fixtures are not a content brief, a citation record, or a change operation.

A missing cannibalization result is null. It is not the value `pass`.

### State transitions

No workflow state is added. A claim with no source ends as refused. A missing cannibalization result stays null and does not become a pass. A page stays unpublished in this check. Nothing moves to `published`.

### Configuration

No `config/` file is edited. No model ID, price, or quota is written.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete, no result-page scrape, no `llms.txt` score, no required FAQ block, and no rich-result promise. | SEO lead: this check is not a content brief and not a search report. |
| security-baseline | yes | No fetch and no secret. | A later CMS or Git write stays out of this slice. |
| arabic-rtl-a11y | no | No screen and no generated copy. | Arabic editorial review stays open for a later draft. |
| data-integrity | yes | A claim without a source is refused. A missing cannibalization result is null, not a pass. | Data engineer: these fixtures are not a full content brief or a full lineage row. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). |
| connector-safety | yes | No CMS draft, no client pull request, and no automatic publishing. A page stored as `published` is refused. | Integration engineer: the first connector stays at M9. |

## Areas of concern

1. This spec stays `draft`. Ibrahim accepted the INT-09 text on 2026-10-02 and said not to set `accepted`. That acceptance does not approve this spec. The INT-09 status word also stays `draft`.
2. The M8 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires citation evals, schema work, and an approval workflow. This check is the first slice only.
3. This check refuses a claim with no source. It does not judge whether a present source is a real citation. Citation evals stay in the later M8 exit.
4. This check refuses a missing cannibalization result and refuses storing that missing result as `pass`. It does not copy `cannibalization.py` and it does not decide which existing page owns a cluster. That decision stays with the later keyword and content work.
5. The passing page in this check is a page that is not stored as `published`. The check does not invent a CMS draft status. A CMS draft and a client pull request belong to M9.
6. OI-021 stays open. This spec does not close it.
7. `origin/main` at `5dc6646` includes the local M7 check. This spec does not finish the later M7 exit and does not start M9.

## Test and eval plan

The local command covers:

- a claim that has a source;
- a refusal when the claim has no source, including a missing source and an empty source;
- a refusal when a new page is stored while the cannibalization result is missing;
- a refusal when that missing cannibalization result is stored as `pass`;
- a page that is not stored as `published`;
- a refusal when that page is stored as `published`.

No browser journey, no golden-file eval, and no live fetch. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- ASSUMPTION: a missing cannibalization result is JSON null, and the refused stand-in for that missing result is the value `pass`.
- ASSUMPTION: the passing page for this slice is any stored page whose status is not `published`. This slice does not name a CMS draft status.
- No new assumption row is appended in this stage.
- Leave the content-approver name, the later schema types, and Arabic editorial review open (OI-002).
- Leave OI-021 open.
- No new decision row.
