# Plan: <short title>

<!--
Template. Save as intent/<ID>-<slug>/plan.md. Written in plan mode after the
spec is approved. An engineer approves every plan; plans that touch connector
write paths, auth, tenant isolation, SSRF, the cost guard, rule weights or
production infrastructure also need the tech lead. When the implementation
departs from the plan, update this file in the same commit.
-->

| Field | Value |
| --- | --- |
| Spec | `intent/<ID>-<slug>/spec.md` (status: approved) |
| Status | draft |
| Author | <name, or "Claude Code session <id>"> |
| Engineer approval | <name, date, or "pending"> |
| Tech lead approval | <name, date, "pending", or "not required"> |
| Branch | <branch name> |

Status values: `draft`, `approved`, `in_progress`, `done`, `abandoned`. Only a human sets `approved`.

## Scope of this slice

<The smallest coherent slice of the spec this plan delivers (05-PROJECT-PLAN section 11 "Implementation loop").>

## Files

| Path | Change | Why |
| --- | --- | --- |
| | | |

## Order of work

1. <Failing test first for bug fixes; set the test lock if the task is a fix.>
2. <...>

## Risks

| Risk | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- |
| | | | |

## Proof

Commands Claude Code runs and pastes into the pull request, with real output:

```bash
python3 -m unittest discover -s .claude/hooks/tests
python3 scripts/check_schemas.py
python3 scripts/check_config.py
# after M0A: pnpm lint && pnpm typecheck && pnpm test && pnpm test:ssrf
```

<Add feature-specific tests, eval runs and UI screenshots in Arabic and English.>

## Security, privacy, cost, Arabic/accessibility review

<What each reviewer or subagent should check in this change.>

## Rollback

<Exact steps to undo this change, and how it was rehearsed if it touches production paths.>

## Departures from the plan

<Dated entries, added in the same commit as the departing code.>
