# Spec: M11 local project gate

| Field | Value |
| --- | --- |
| Intent | `intent/INT-12-m11-local-project-gate/intent.md` (status word: draft; text accepted by Ibrahim on 2026-10-04) |
| Status | draft |
| Author | Cursor session (Grok 4.7), 2026-10-04 |
| Product owner sign-off | Ibrahim, 2026-10-04, by the message "I approve spec.md." The status word stays `draft` because this session does not set `approved`. The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: security engineer (security-baseline), tech lead (project isolation), data engineer (data-integrity) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; connector-safety 0.1.0; google-search-guidance 0.1.0; arabic-rtl-a11y 0.1.0 |
| Source sections read | accepted INT-12 text; `docs/spec/05-PROJECT-PLAN.md` §5 M11 and §14; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.16; `docs/test-strategy.md` §5 M11 row and TS-AUTHZ; `docs/decisions.md` D-004, D-014, D-020; security-baseline 0.1.0 |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Ibrahim approved this spec on 2026-10-04. This session does not set `approved`.

## Summary

This spec defines a local check with one refusal. A read of project B is refused while the caller is in project A.

The check does not send an invitation, open a live workspace, or run a bulk schedule. It does not add `organization_id`. It does not add a write-class tool to `config/agents/*.yaml`. Product spend stays `0.00` USD.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. `fable` at xhigh is not a Cursor picker value. This spec was written in a session that showed Grok 4.7 (D-020).

## Requirements

### Functional

1. A local command exits 0 only when a caller in project A is kept to project A, and a read of project B is refused. Any failure exits non-zero. Source: accepted INT-12 text; `docs/spec/05-PROJECT-PLAN.md` §5 M11.
2. The caller is in project A. A record that belongs to project A may be read. A record that belongs to project B is refused. Source: accepted INT-12 text; D-014; security-baseline 0.1.0.
3. The check does not add `organization_id`. Identity stays `User → Project → Site`. Source: accepted INT-12 text; D-004; D-014.
4. No schema file, no `config/` file, and no `config/agents/*.yaml` file is added or changed. No write-class tool is added. The check does not edit the M10 command. Source: accepted INT-12 text.
5. The check does not import `.claude/skills/marketing-seo-agent/scripts`. Source: D-009.

### Non-functional

1. The check runs on this machine. It does not create an organization, send an invitation, open a live workspace, or run a bulk schedule. It does not call Google Autocomplete or scrape a search-result page. Product spend is `0.00` USD. Source: accepted INT-12 text; D-009.
2. Fixtures are synthetic. They contain no secrets, no customer records, and no live project identifiers. Project A and project B are labels in the fixture. Source: accepted INT-12 text.
3. There is no screen. `pnpm test:e2e` stays the placeholder recorded as not run. Source: accepted INT-12 text.
4. Agency roles, portfolios, branded reports, client review links, templates, evidence export, audit logs, and budgeted bulk work stay out of this check. Source: accepted INT-12 text; `docs/spec/01-PRODUCT-REQUIREMENTS.md` §5.16; `docs/spec/05-PROJECT-PLAN.md` §5 M11; `docs/test-strategy.md` §5 M11 row.

## Design

### Components and boundaries

The check is a local command. It reads fixtures. It does not query a database and it does not hold a credential. Stored rows are data. The command returns the project A record to the caller in project A and refuses the project B record. A query for one project does not return another project's record.

### Data contracts

No schema is added or changed. One fixture carries a caller in project A, one record owned by project A, and one record owned by project B. These rows are not a workspace, an invitation, or a full stored record. `organization_id` is absent.

### State transitions

No workflow state is added. A cross-project read ends as refused. The caller stays in project A.

### Configuration

No `config/` file is edited. No agent tool list is edited. No organization is registered.

### UI (if any)

None.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | yes | No Autocomplete and no result-page scrape. | SEO lead: this check is not a search report. |
| security-baseline | yes | A read of project B is refused while the caller is in project A. No secret and no write tool. | Security engineer: this fixture is not a live authorization check. |
| arabic-rtl-a11y | no | No screen. | Arabic review stays out of this slice. |
| data-integrity | yes | The returned record stays the project A record. Project B is not mixed into that result. | Data engineer: these fixtures are not a full project record. |
| cost-guard | yes | No paid call and no bulk schedule. Spend is `0.00` USD. | The USD 150 cap stays unconfirmed (D-005, OI-001). |
| connector-safety | yes | No connector write and no write-class tool. | Integration engineer: a later client workspace stays out of this slice. |

## Areas of concern

1. This spec stays `draft`. Ibrahim approved it on 2026-10-04 by the message "I approve spec.md" and this session does not set `approved`. The INT-12 status word also stays `draft`.
2. The M11 exit in `docs/spec/05-PROJECT-PLAN.md` §5 also requires cross-tenant tests on a live workspace and bulk work that stays budgeted and scoped. This check is the first slice only.
3. This check uses the labels project A and project B. It does not create those projects and it does not add `organization_id`.
4. A record with no `project_id` is not this case. The later agency work still has to decide how a missing owner is stored. This check covers a record that belongs to project B.
5. OI-021 stays open. This spec does not close it.
6. `docs/spec/05-PROJECT-PLAN.md` §14 still lists INT-15 as M11. Ibrahim named this path. This spec does not edit that table.
7. `origin/main` at `fd23f59` includes the local M10 check. This spec does not finish the later M10 exit and does not start M12.

## Test and eval plan

The local command covers:

- a caller in project A;
- a record owned by project A that the caller may read;
- a refusal when that caller reads a record owned by project B.

No browser journey, no invitation, and no bulk schedule. `pnpm test:e2e` is not run.

## Rollout and rollback

No feature flag and no environment. Rollback is reverting the commit that adds the command and fixtures. No staging rehearsal is in this spec.

## Cost

Paid calls added: none. Hosting added: none. Product spend: `0.00` USD. The USD 150 cap stays an unconfirmed assumption (D-005, OI-001).

## Assumptions and open items

- ASSUMPTION: project A and project B are synthetic labels. They are not live project identifiers.
- No new assumption row is appended in this stage.
- Leave agency roles, invitations, bulk budgets, and the owner names open (OI-002).
- Leave OI-021 open.
- No new decision row. `docs/spec/05-PROJECT-PLAN.md` §14 is not edited.
