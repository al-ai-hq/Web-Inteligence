# Spec: M2 local Presence Readiness disclosure

| Field | Value |
| --- | --- |
| Intent | `intent/INT-03-m2-integrity-presence-readiness/intent.md` (status: accepted) |
| Status | approved |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "I approve spec.md". The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: methodology owner (data-integrity, scoring), SEO lead (google-search-guidance) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; data-integrity 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0; cost-guard 0.1.0; connector-safety 0.1.0; arabic-rtl-a11y 0.1.0; marketing-seo-agent vendored snapshot 2026-09-30 (no version field in its SKILL.md) |
| Source sections read | accepted INT-03 text; `docs/spec/05-PROJECT-PLAN.md` §5; `docs/spec/02-DETAILED-SPECIFICATION.md` §6, §15; `docs/spec/03-PRODUCTION-CONTRACTS.md`; `config/scoring.yaml`; `docs/decisions.md` D-009, D-010, D-012, D-014, D-019, D-020; `docs/open-items.md` OI-032, OI-033, OI-034, OI-055; `docs/test-strategy.md` §5; `scripts/check_m0b_proofs.py` |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

This spec defines a local check that recomputes one Presence Readiness score from stored rule results and discloses what that number is. The score stays the deterministic pre-cap value from `config/scoring.yaml`. It is not observed AI visibility, not Experience Effectiveness, and not search performance. A sample count is not a full-site count. An `unavailable` or `not_applicable` result is not a pass and stays out of the denominator.

The check does not add a rules engine, does not edit `scripts/check_m0b_proofs.py`, and does not change weights or `methodology_version`. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opus` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the recompute, the disclosure, and the invalid-result case all pass. Any failure exits non-zero. Source: accepted INT-03 text; `docs/spec/05-PROJECT-PLAN.md` §5.
2. The command reads `config/scoring.yaml` and refuses to run if `methodology_version` is not `0.1.0-draft` or if the seven category weights are not 20, 15, 10, 20, 15, 10, and 10 for crawlability, on_page, structured_data, aeo, geo, i18n_accessibility, and performance_security. Source: accepted INT-03 text; D-010; `config/scoring.yaml`.
3. The valid fixture holds seven stored rule results, one in each category, each `pass` with `importance_weight` 1. Rule IDs are `CRW-001`, `SEO-001`, `STR-001`, `AEO-001`, `GEO-001`, `I18N-001`, and `PRF-001`. The check recomputes each category score as 100 and the pre-cap Presence Readiness as 100. No critical cap is applied. Calculation uses decimal arithmetic. Source: `config/scoring.yaml` `formulas`; the same inputs as `scripts/check_m0b_proofs.py`. This spec does not change that M0B command.
4. The disclosure on that result is `score_name` `presence_readiness`, `methodology_version` `0.1.0-draft`, `deterministic` true, `coverage` `sample`, and `site_wide_count` null. `experience_effectiveness`, `ai_visibility`, and `search_performance` are absent. A disclosure that sets `coverage` to `full`, or that includes any of those three measurements, fails the check. Source: D-012; accepted INT-03 text; data-integrity skill.
5. `llms.txt` is not a scored input. The fixture contains no FAQ requirement and no rich-result promise. Source: google-search-guidance skill; accepted INT-03 text.
6. One invalid fixture stores a rule result of `unavailable`, and another stores `not_applicable`. Each is presented as if it were `pass`. Both presentations fail the check. Those two results stay out of the denominator, matching `config/scoring.yaml` `rule_results`. Source: accepted INT-03 text; data-integrity skill.
7. The check does not decide the category score when the denominator is 0. The `<DECIDE_AT_M0>` line in `config/scoring.yaml` stays unchanged. Source: OI-033; accepted INT-03 text.
8. `config/scoring.yaml`, `config/rules/`, schemas, and `scripts/check_m0b_proofs.py` stay unchanged. `methodology_version` stays `0.1.0-draft`. Source: accepted INT-03 text; D-010.

### Non-functional

1. The check runs on this machine. It does not deploy, apply Terraform, call a provider, or fetch a client site. Product spend is `0.00` USD. Source: accepted INT-03 text; D-019; cost-guard skill.
2. Fixtures are synthetic. They contain no secrets, customer URLs, or live page text. Source: security-baseline skill.
3. There is no screen. Arabic copy and WCAG evidence are not produced. The Arabic display name in `config/scoring.yaml` is not edited. Source: arabic-rtl-a11y skill.
4. `pnpm test:e2e` stays the placeholder recorded as not run. `pnpm test:ssrf` is the M1 suite and is not this exit. Source: accepted INT-03 text.
5. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.

## Design

### Components and boundaries

The check is a local command beside `scripts/check_m0b_proofs.py`. It reads scoring config and fixtures. It does not fetch, score a live site, or write a rule file. Stored rule results are data. The command recomputes the number and compares it with the disclosure. It does not let model prose change a pass or fail.

`scripts/check_m0b_proofs.py` stays the M0B proof. This command is a separate check so M2 does not reopen that file.

### Data contracts

No schema is added or changed. The disclosure is a suite fixture, not a new `ScoreResult` field. A later spec may store it. Until then the fixture carries `score_name`, `methodology_version`, `deterministic`, `coverage`, and `site_wide_count`.

### State transitions

No workflow state is added. A failed disclosure or a false pass ends as `refused`. A refusal does not write a score.

### Configuration

No `config/` file is edited. Weights and `methodology_version` are read, not written (D-010).

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | `llms.txt` is not scored. No FAQ requirement. No rich-result promise. No skill-script import. | SEO lead: partial standards and STR-003 stay open (OI-033, OI-034). |
| security-baseline | yes | No fetch and no secret in fixtures. | None for this spec. |
| arabic-rtl-a11y | no | No screen. | Native review of the Arabic score name stays later. |
| data-integrity | yes | The score is recomputed, labelled `computed` in spirit, and kept apart from other measurements. `unavailable` and `not_applicable` leave the denominator. | Data engineer: the disclosure is a fixture, not a stored score row. |
| cost-guard | yes | No paid call and no hosting. Spend is `0.00` USD. | None for this spec. |
| connector-safety | no | No write tool and no connector. | None for this spec. |

## Areas of concern

1. Ibrahim approved this spec on 2026-10-01. The methodology owner and SEO lead sign-offs in the table above are still pending.
2. M0B already recomputes 100 from the same seven passes. This check adds the disclosure and the false-pass refusal. It must not be treated as the full M2 exit in `docs/test-strategy.md` §5.
3. The zero-denominator category score stays undecided. A fixture that removes every measurable rule is out of this spec.
4. OI-032, OI-033, and OI-034 stay open. This spec does not align rule keys or fill partial standards.
5. Pull request 2 is not merged. This spec does not merge it.
6. D-021 still says `pnpm test:ssrf` is not run. The M1 suite on this branch replaced that placeholder. This spec does not rewrite D-021.

## Test and eval plan

The local command covers:

- recompute of pre-cap Presence Readiness 100 from the seven passing results;
- disclosure pass for `presence_readiness`, `0.1.0-draft`, `deterministic` true, `coverage` `sample`, and `site_wide_count` null;
- disclosure fail when `coverage` is `full`;
- disclosure fail when Experience Effectiveness, AI visibility, or search performance is present;
- refusal when `unavailable` is shown as `pass`;
- refusal when `not_applicable` is shown as `pass`;
- refusal if `methodology_version` or a category weight in `config/scoring.yaml` differs from the values in requirement 2.

No golden-file eval, product-agent eval, or browser journey. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- No new assumption row. Weights and `methodology_version` are the current config, not a new choice.
- Leave OI-032, OI-033, OI-034, and OI-055 open.
- No new decision row. Do not bump `methodology_version`.
