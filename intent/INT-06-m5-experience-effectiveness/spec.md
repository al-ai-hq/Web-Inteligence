# Spec: M5 local Experience Effectiveness separation

| Field | Value |
| --- | --- |
| Intent | `intent/INT-06-m5-experience-effectiveness/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-01) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | pending. Ibrahim accepted the intent text by the message "I accept this INT-06 text" and said not to set `accepted`. He has not approved this spec. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: methodology owner (rubric), data engineer (data-integrity) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0 |
| Source sections read | accepted INT-06 text; `docs/spec/05-PROJECT-PLAN.md` §5 M5; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.3; `docs/rubrics/experience-effectiveness.md` §1, §2, §3, §5; `docs/spec/02-DETAILED-SPECIFICATION.md` §19; `docs/decisions.md` D-009, D-012, D-020; data-integrity skill |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

This spec defines a local check that keeps an Experience Effectiveness result apart from Presence Readiness, and keeps a subjective rubric result distinguishable from a deterministic finding. A judgment stays `assessed` and `inferred`. A deterministic finding stays `observed` or `computed`, and `verified`.

The check does not set a weight, calibrate the rubric, or review a live page. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the separation case and the label case both pass. Any failure exits non-zero. Source: accepted INT-06 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. An Experience Effectiveness result and a Presence Readiness result stay in separate scores. The check refuses a result that adds one to the other. Source: accepted INT-06 text; D-012; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.3; `docs/rubrics/experience-effectiveness.md` §1.
3. Neither score is written into observed AI visibility or into search performance. A case that does so fails the check. Source: D-012.
4. A subjective rubric result uses `fidelity_label` `assessed` and `evidence_state` `inferred`. Source: `docs/rubrics/experience-effectiveness.md` §2; data-integrity skill.
5. A deterministic finding uses `fidelity_label` `observed` or `computed`, and `evidence_state` `verified`. Source: `docs/rubrics/experience-effectiveness.md` §2; data-integrity skill.
6. Storing `assessed` as `observed` or as `computed` fails the check. Storing `inferred` as `verified` fails the check. Source: accepted INT-06 text; `docs/rubrics/experience-effectiveness.md` §2.
7. The check does not set a criterion weight or a dimension weight, and it does not bump `methodology_version`. Source: accepted INT-06 text; `docs/rubrics/experience-effectiveness.md` §5.
8. No schema file and no `config/` file is added or changed. The check does not edit the M2 readiness command. Source: accepted INT-06 text.

### Non-functional

1. The check runs on this machine. It does not fetch a client site, review a live page, submit a form, create an account, place an order, or make a booking. It does not call a provider, call Google Autocomplete, or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-06 text; D-009; `docs/spec/02-DETAILED-SPECIFICATION.md` §19; `docs/rubrics/experience-effectiveness.md` §3.
2. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.
3. Fixtures are synthetic. They contain no secrets, customer page text, or reviewer identities. Source: accepted INT-06 text.
4. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-06 text.
5. Rubric agreement, calibration, fixed weights, score screens, comparison views, and regulated-context tone stay out of this check. Source: accepted INT-06 text; `docs/spec/05-PROJECT-PLAN.md` §5.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not fetch a page and it does not call a model. Stored rows are data. The command refuses a merged score and refuses a judgment labelled as a measurement. It does not change a Presence Readiness rule result.

### Data contracts

No schema is added or changed. One fixture carries two scores, Experience Effectiveness and Presence Readiness, kept apart. The other carries a subjective result and a deterministic finding, each with `fidelity_label` and `evidence_state`. This fixture is not a full reviewer trace.

### State transitions

No workflow state is added. A merged score ends as refused. A subjective result stays `assessed` and `inferred`.

### Configuration

No `config/` file is edited. No weight is written.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete, no result-page scrape, and search performance stays apart from both scores. | SEO lead: this check is not a search-performance report. |
| security-baseline | yes | No fetch, no form submission, and no account. | A later live review stays out of this slice. |
| arabic-rtl-a11y | no | No screen. | Arabic judgments stay with calibration. |
| data-integrity | yes | The two scores stay apart. `assessed` is not `observed`. `inferred` is not `verified`. | Data engineer: this fixture is not a full reviewer trace. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | None for this spec. |
| connector-safety | no | No connector and no write tool. | None for this spec. |

## Areas of concern

1. This spec is `draft`. Ibrahim has not approved it. The INT-06 status word stays `draft` because the acceptance message says not to set `accepted`.
2. The M5 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires rubric agreement and calibration. This check is the first slice only.
3. Criterion weights and dimension weights stay `<DECIDE_AT_M5>`. The equal-weight note in `docs/rubrics/experience-effectiveness.md` §4 is a calibration starting point, not a value this check may use.
4. OI-021 stays open. This spec does not close it.
5. Pull request 5 is already merged at `origin/main` `8389469`. This spec does not merge anything else, and it does not finish the later M4 exit.

## Test and eval plan

The local command covers:

- an Experience Effectiveness score and a Presence Readiness score kept apart;
- a refusal when those scores are added;
- a refusal when either score is written into observed AI visibility or search performance;
- a subjective result stored as `assessed` and `inferred`;
- a deterministic finding stored as `observed` or `computed`, and `verified`;
- a failure when `assessed` is stored as `observed` or `computed`;
- a failure when `inferred` is stored as `verified`.

No browser journey, no golden-file eval, and no live provider call. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- No new assumption row.
- Leave the `<DECIDE_AT_M5>` weight, viewport, and calibration decisions open.
- Leave OI-021 open.
- No new decision row.
