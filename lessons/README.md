# Lessons (post-mortems)

Status: draft for review. Owner: incident-response owner `<DECIDE_AT_M0: name>`; each entry is owned by the service owner of the affected area.

A lesson closes the loop: an incident, a near miss, a breached detection band or a repeated review finding becomes a written record, at least one new intent, and a new test or eval case (05-PROJECT-PLAN §1, §6 "Monitoring"; `docs/runbooks/incident.md`).

## When to write one

- Any production incident, rollback, data exposure, unauthorized write, or cost-guard hard stop.
- A breach at the 2σ or 3σ tier of a band in `ops/detection/bands.yaml` that needed action.
- A control that failed or was bypassed (hook, review, gate, approval).
- The same mistake flagged twice in review.

## Rules

- Blameless: describe systems, signals and decisions, not people's faults.
- Facts only, with times in RFC 3339 UTC and links to evidence (logs, runs, pull requests). Mark anything unconfirmed as unconfirmed.
- No secrets, tokens, personal data, client data or raw page text. Link to access-controlled evidence instead.
- Claude may draft the diagnosis; the service owner triages it and owns the entry. Claude writes proposals as a new intent or a pull request, never a direct production change.
- Every entry adds at least one test or eval case and one new intent, or says why not.

## File name

`lessons/YYYY-MM-DD-<kebab-slug>.md`, dated on the day the incident started.

## Template

```markdown
# Lesson: <short title>

| Field | Value |
| --- | --- |
| Status | draft / reviewed / closed |
| Severity | <per docs/runbooks/incident.md> |
| Service owner | <name> |
| Incident commander | <name, or "not an incident"> |
| Started / detected / resolved (UTC) | <RFC 3339> / <RFC 3339> / <RFC 3339> |
| Environments | <dev, staging, prod> |
| Related release | <intent/<ID>-<slug>/release.md, commit SHA> |

## Summary
<Three to five sentences: what happened, impact, how it ended.>

## Impact
<Users, projects or audits affected; data affected; cost; duration. Counts with their source.>

## Detection
<Which signal fired (band, alert, user report, review). How long from start to detection.
If a band fired, which tier (1σ, 2σ, 3σ) and which Western Electric rule.>

## Timeline (UTC)
| Time | Event | Evidence |
| --- | --- | --- |

## Root cause
<Technical and process causes. Separate confirmed causes from hypotheses.>

## What went well

## What went poorly

## Where we got lucky

## Actions
| Action | Type (fix, test/eval, detection, docs, process) | Intent / PR | Owner | Due |
| --- | --- | --- | --- | --- |

## Test or eval added
<Suite and case ID (for example TS-EVAL-AGENT case, golden case, unit test), or why none.>

## Follow-up
<Changes to bands, runbooks, CLAUDE.md "Things Claude gets wrong", hooks or policy skills.>
```

## Index

None yet.
