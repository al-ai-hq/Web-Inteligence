# Spec: M9 local write gate

| Field | Value |
| --- | --- |
| Intent | `intent/INT-10-m9-local-write-gate/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-03) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-03 |
| Product owner sign-off | Ibrahim, 2026-10-03, by the message "I approve spec.md." The status word stays `draft` because this session does not set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: integration engineer (connector-safety), tech lead (write path), data engineer (data-integrity), security engineer (security-baseline) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; connector-safety 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0; arabic-rtl-a11y 0.1.0; marketing-seo-agent has no version field and is reference only (scripts not imported, D-009) |
| Source sections read | accepted INT-10 text; `docs/spec/05-PROJECT-PLAN.md` §5 M9 and §14; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.13, §5.14; `docs/spec/03-PRODUCTION-CONTRACTS.md` change states; `schemas/change-set.schema.json` `mode` and `approvals`; `schemas/common.schema.json` `change_state`; `docs/test-strategy.md` §5 M9 row; `docs/decisions.md` D-009, D-011, D-014, D-016, D-020; connector-safety 0.1.0 |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-03. This session does not set `approved`.

## Summary

This spec defines a local gate with two refusals. A write with no approval is refused. Publication is refused when the change is only a draft.

The check does not choose a connector. It does not write to a CMS, open a client pull request, or run a staging scenario. It does not add a write-class tool to `config/agents/*.yaml`. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `fable` at max is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the approval case and the publication case both pass. Any failure exits non-zero. Source: accepted INT-10 text; `docs/spec/05-PROJECT-PLAN.md` §5 M9.
2. A passing write has an approval. A write with no approval is refused. A missing approval and an empty approval list are both no approval. Source: accepted INT-10 text; `schemas/change-set.schema.json` `approvals`; connector-safety 0.1.0.
3. Publication is refused when the change is only a draft. The draft state is `DRAFT` from `schemas/common.schema.json` `change_state`. Storing that draft as published fails the check. An edit approval does not count as publication permission. Source: accepted INT-10 text; `schemas/change-set.schema.json` `mode` description "Publish is a separate permission with its own Approval."; connector-safety 0.1.0.
4. The check does not choose Git or CMS. The first connector stays `<DECIDE_AT_M0: first connector>` (D-011). Source: accepted INT-10 text; D-011.
5. No schema file, no `config/` file, and no `config/agents/*.yaml` file is added or changed. No write-class tool is added. The check does not edit the M8 command. Source: accepted INT-10 text.
6. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.

### Non-functional

1. The check runs on this machine. It does not call a CMS, open a client repository, or run a staging scenario. It does not call Google Autocomplete or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-10 text; D-009; D-016.
2. Fixtures are synthetic. They contain no secrets, no connector credentials, and no customer page text. Source: accepted INT-10 text.
3. The check does not read or write another project's records. Source: D-014.
4. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-10 text.
5. Exact live IDs, snapshots, hashes, canary, idempotency, read-back, rollback, webhooks, the staging scenarios, and the impact ledger stay out of this check. Source: accepted INT-10 text; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.13, §5.14; `docs/spec/05-PROJECT-PLAN.md` §5 M9; `docs/test-strategy.md` §5 M9 row.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not call a connector and it does not hold a write credential. Stored rows are data. The command refuses a write with no approval and refuses publication of a draft. Only the connector service may write, and this slice does not write.

### Data contracts

No schema is added or changed. One fixture carries a write with one synthetic approval. One fixture carries a change whose state is `DRAFT` and that is not published. These fixtures are not a full change set. `schemas/common.schema.json` `change_state` has no `PUBLISHED` value. This check does not add one.

A missing approval is an empty list. It is not a passing write.

### State transitions

No workflow state is added. A write with no approval ends as refused. A draft stays `DRAFT`. Nothing in this check moves that draft to a published state.

### Configuration

No `config/` file is edited. No agent tool list is edited. No connector name is written.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete and no result-page scrape. | SEO lead: this check is not a search report. |
| security-baseline | yes | No fetch, no secret, and no connector credential. | A later connector write stays out of this slice. |
| arabic-rtl-a11y | no | No screen. | Arabic review stays out of this slice. |
| data-integrity | yes | A write without an approval is refused. A draft is not stored as published. | Data engineer: these fixtures are not a full change set and not an impact-ledger row. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). |
| connector-safety | yes | No CMS write, no client pull request, and no staging run. Publication of a draft is refused. Edit approval is not publication permission. No write-class tool is added. | Integration engineer: the first connector stays undecided (D-011). |

## Areas of concern

1. This spec stays `draft`. Ibrahim approved it on 2026-10-03 by the message "I approve spec.md" and this session does not set `approved`. The INT-10 status word also stays `draft`.
2. The M9 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires a connector, the staging scenarios, and an impact ledger. This check is the first slice only.
3. `schemas/common.schema.json` `change_state` includes `DRAFT` and does not include `PUBLISHED`. This check refuses publication of a draft. It does not add a schema state.
4. This check refuses a missing approval and an empty approval list. It does not bind an approval to a live target, a field, a before/after hash, an environment, or an expiry. That binding stays in the later M9 exit.
5. The first connector stays open (D-011). This spec does not choose Git or CMS.
6. OI-021 stays open. This spec does not close it.
7. `docs/spec/05-PROJECT-PLAN.md` §14 lists INT-10 as M8A and INT-13 as M9. Ibrahim named this path. This spec does not edit that table.
8. `origin/main` at `e12afd7` includes the local M8 check. This spec does not finish the later M8 exit and does not start M10.

## Test and eval plan

The local command covers:

- a write that has an approval;
- a refusal when the approval is missing;
- a refusal when the approval list is empty;
- a change whose state is `DRAFT` and that is not published;
- a refusal when that draft is stored as published.

No browser journey, no staging scenario, and no live fetch. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- ASSUMPTION: a write with no approval is either a missing approval or an empty approval list.
- ASSUMPTION: the draft in this slice is the change state `DRAFT`. Publication of that draft is the refused store. This slice does not add `PUBLISHED` to `change_state`.
- No new assumption row is appended in this stage.
- Leave the first connector, the impact ledger, and the owner names open (D-011, OI-002).
- Leave OI-021 open.
- No new decision row.
