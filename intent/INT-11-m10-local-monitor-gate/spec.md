# Spec: M10 local monitor gate

| Field | Value |
| --- | --- |
| Intent | `intent/INT-11-m10-local-monitor-gate/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-04) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-04 |
| Product owner sign-off | Ibrahim, 2026-10-04, by the message "I approve spec.md." The status word stays `draft` because this session does not set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: service owner (monitoring), cloud billing owner (cost-guard), integration engineer (connector-safety), data engineer (data-integrity) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; cost-guard 0.1.0; connector-safety 0.1.0; data-integrity 0.1.0; google-search-guidance 0.1.0; security-baseline 0.1.0; arabic-rtl-a11y 0.1.0 |
| Source sections read | accepted INT-11 text; `docs/spec/05-PROJECT-PLAN.md` §5 M10 and §14; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.15; `docs/test-strategy.md` §5 M10 row and TS-MONITOR; `docs/decisions.md` D-005, D-016, D-019, D-020; cost-guard 0.1.0; connector-safety 0.1.0 |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-04. This session does not set `approved`.

## Summary

This spec defines a local check with three results. A schedule which adds a write is refused. A schedule which adds a new target is refused. An unchanged run does not raise an alert.

The check does not run a scheduler, crawl a site, or delete data. It does not add a write-class tool to `config/agents/*.yaml`. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `opusplan` at high is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when the schedule case and the unchanged-run case both pass. Any failure exits non-zero. Source: accepted INT-11 text; `docs/spec/05-PROJECT-PLAN.md` §5 M10.
2. A passing schedule does not add a write and does not add a new target. A schedule which adds a write is refused. A schedule which adds a new target is refused. Source: accepted INT-11 text; connector-safety 0.1.0 ("A schedule does not authorize crossing a write gate"); `docs/test-strategy.md` TS-MONITOR.
3. An unchanged run does not raise an alert. Storing a raised alert for that unchanged run fails the check. Source: accepted INT-11 text; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.15; `docs/test-strategy.md` TS-MONITOR.
4. No schema file, no `config/` file, and no `config/agents/*.yaml` file is added or changed. No write-class tool is added. The check does not edit the M9 command. Source: accepted INT-11 text.
5. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.

### Non-functional

1. The check runs on this machine. It does not start a scheduler, crawl a site, delete data, or call a connector. It does not call Google Autocomplete or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-11 text; D-005; D-009; cost-guard 0.1.0.
2. Fixtures are synthetic. They contain no secrets, no connector credentials, and no customer page text. Source: accepted INT-11 text.
3. The check does not read or write another project's records. Source: D-014.
4. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-11 text.
5. A running schedule, a crawl, retention deletion, a restore, a cost breaker, evidence linkage for a material alert, and incident-to-intent feedback stay out of this check. Source: accepted INT-11 text; `docs/spec/05-PROJECT-PLAN.md` §5 M10; `docs/test-strategy.md` §5 M10 row.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not start a job and it does not hold a write credential. Stored rows are data. The command refuses a schedule that adds a write, refuses a schedule that adds a new target, and refuses a raised alert on an unchanged run. A schedule does not cross a write gate, and this slice does not write.

### Data contracts

No schema is added or changed. One fixture carries a schedule that does not add a write and does not add a new target. One fixture carries an unchanged run with no raised alert. These fixtures are not a running schedule and not a deletion record.

### State transitions

No workflow state is added. A schedule that adds a write ends as refused. A schedule that adds a new target ends as refused. An unchanged run stays quiet.

### Configuration

No `config/` file is edited. No agent tool list is edited. No budget is raised. No schedule is registered.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete and no result-page scrape. | SEO lead: this check is not a search report. |
| security-baseline | yes | No fetch, no secret, and no connector credential. | A later crawl stays out of this slice. |
| arabic-rtl-a11y | no | No screen. | Arabic review stays out of this slice. |
| data-integrity | yes | An unchanged run does not raise an alert. The quiet result is not a measured change. | Data engineer: whether a quiet run may be stored as an alert count of `0` stays open. |
| cost-guard | yes | No paid call, no schedule that runs, and no budget change. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). The measured cost proof stays at D-019 stage 2. |
| connector-safety | yes | A schedule that adds a write is refused. No write-class tool is added. No deletion and no connector call. | Integration engineer: a later deletion workflow stays out of this slice. |

## Areas of concern

1. This spec stays `draft`. Ibrahim approved it on 2026-10-04 by the message "I approve spec.md" and this session does not set `approved`. The INT-11 status word also stays `draft`.
2. The M10 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires evidence-linked material alerts, deletion, and cost breakers. This check is the first slice only.
3. An unchanged run does not raise an alert. Whether that quiet run may be stored as an alert count of `0` stays open for the plan. A count of `0` can be read as a measured event.
4. This check refuses a schedule that adds a write or a new target. It does not run the schedule, and it does not decide which live URL is in scope.
5. OI-021 stays open. This spec does not close it.
6. `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-14 as M10. Ibrahim named this path. This spec does not edit that table.
7. `origin/main` at `f926be7` includes the local M9 check. This spec does not finish the later M9 exit and does not start M11.

## Test and eval plan

The local command covers:

- a schedule that does not add a write and does not add a new target;
- a refusal when that schedule adds a write;
- a refusal when that schedule adds a new target;
- an unchanged run that does not raise an alert;
- a refusal when that unchanged run is stored with a raised alert.

No browser journey, no crawl, and no deletion. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- ASSUMPTION: a raised alert is a stored alert on an unchanged run. The quiet passing row has no raised alert.
- The question of storing that quiet run as an alert count of `0` stays open for the plan.
- No new assumption row is appended in this stage.
- Leave material-change rules, retention windows, and the owner names open (OI-002).
- Leave OI-021 open.
- No new decision row. `docs/spec/05-PROJECT-PLAN.md` §14 is not edited.
