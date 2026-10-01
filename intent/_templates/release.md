# Release: <short title>

<!--
Template. Save as intent/<ID>-<slug>/release.md. Fields follow
03-PRODUCTION-CONTRACTS "Release evidence" and the phase report format in
04-CLAUDE-CODE-BUILD-PROMPT section 24. Agent or prompt output cannot approve
its own release (05-PROJECT-PLAN section 8).
-->

| Field | Value |
| --- | --- |
| Intent / spec / plan | `intent/<ID>-<slug>/` |
| Milestone | <M0A, M0B, ...> |
| Status | draft |
| Environment | <dev, staging, prod> |
| Release approver | <DECIDE_AT_M0: release manager name>, <date> |
| Release time (UTC) | <RFC 3339> |
| Change ticket (prod) | <KEY-123 or "not prod"> |

Status values: `draft`, `authorized`, `released`, `rolled_back`, `abandoned`. Only the release approver sets `authorized`.

## Outcome and acceptance status

<Which exit-gate items pass, fail or were not run.>

## Artifact versions

<Commit SHA, image digests, schema versions, methodology_version, prompt and skill versions, config versions.>

## Migrations

<Database and data migrations, with reversibility.>

## Files changed

<Summary or link to the merged pull request.>

## Commands and checks actually run

<Command, result, link to CI run. Never report a check that was not run as passing.>

## Tests and evals

| Suite | Passed | Failed | Not run | Notes |
| --- | --- | --- | --- | --- |
| Hook tests | | | | |
| Unit / integration | | | | |
| SSRF suite | | | | |
| Golden files | | | | |
| Product-agent evals | | | | |
| Build-agent evals | | | | |

## Security, privacy and cost review

<Findings and their resolution. Cost impact against the combined USD 150 cap.>

## Arabic and accessibility evidence

<Screenshots in both languages, manual keyboard and screen-reader notes, native-review status.>

## Unresolved risks

<Each risk with owner and follow-up intent.>

## Rollback

<Exact rollback steps and when they were last rehearsed in staging.>

## Monitoring

<Signals watched after release; detection bands in ops/detection/bands.yaml.>

## Post-release verification

<What was checked after release, by whom, with result.>

## Decisions, assumptions and open items

<Entries added to docs/decisions.md, docs/assumptions.md and docs/open-items.md.>
