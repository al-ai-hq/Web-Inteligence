# Detection bands

Status: draft for review. Owner: service owner (platform) `<DECIDE_AT_M0: name>`, with the release manager.

This folder holds the configuration for detecting problems in the WPI platform itself after a deploy: `bands.yaml`, and later the band-check script and its unit tests. It maintains the platform. It never acts on client sites; those changes follow the connector approval flow (02-DETAILED-SPECIFICATION §10).

## How it works

1. A deterministic script (not a model) reads each metric in `bands.yaml`, computes its baseline and bands, and applies the rules. It is version-controlled and unit-tested. ASSUMPTION: the script and its tests are written at M10 (05-PROJECT-PLAN §5 "Monitoring and automation"); `bands.yaml` is committed now so the first metric is agreed early.
2. Nothing happens below 1σ.
3. On a breach, the tier decides what happens:

| Tier | Action | What runs | Output |
| --- | --- | --- | --- |
| 1σ | `log` | Script only | A log entry. No notification. |
| 2σ | `diagnose` | Claude, headless, with read-only tools: `Read`, `Grep`, `Bash(gcloud logging read *)` | A diagnosis written as a new intent (`intent/<ID>-<slug>/intent.md`, status `draft`) for the service owner to triage |
| 3σ | `propose` | Claude, headless, same read-only tools | A proposal through a pull request, or a pointer to a pre-approved runbook (`runbook:rollback` = `docs/runbooks/rollback.md`). A human runs the runbook. |

- Breach-triggered runs get no production write access; managed settings deny it. They cannot deploy, roll back or change configuration themselves.
- A confidence gate sits between headless stages; findings the owner dismisses are recorded and used to tune the bands.
- Every fixed incident adds a test or eval case and a `lessons/` entry (see `lessons/README.md`).

## Baseline and rules

- `baseline: rolling_30d`: mean and standard deviation over the previous 30 days of the metric, excluding the window being tested. ASSUMPTION: the minimum history before bands are trusted is `<DECIDE_AT_M0: minimum samples>`; below it, the script logs only.
- `rules: western_electric`: the standard Western Electric run rules on the metric series. ASSUMPTION for the mapping to tiers:

| Western Electric rule | Tier |
| --- | --- |
| One point beyond 3σ | 3σ |
| Two of three consecutive points beyond 2σ on the same side | 2σ |
| Four of five consecutive points beyond 1σ on the same side | 1σ |
| Eight consecutive points on the same side of the mean | 1σ |

Only the upper side matters for an error rate; a drop in 5xx is not a breach.

## The first metric

`post_deploy_5xx_rate`: the share of responses with status 5xx from the web and API service after a deploy. ASSUMPTION: this is the first metric because it has a stable rolling baseline and maps directly to the rollback runbook. Open for M0A/M10:

- the exact metric source (Cloud Monitoring or a log-based metric) and window length;
- the read-only identity the diagnose step uses for `gcloud logging read` on production logs, which must not be able to change anything;
- the service owner who triages.

## Adding a metric

Add one metric at a time, each with its own bands, source, owner and tests. Later candidates: audit failure rate, p95 audit latency, cost per audit, provider error rate (which also feeds the circuit breakers), verification mismatch rate, prompt-screening detection rate, prompt-panel run failure rate, CI test failure rate.

A new metric enters `bands.yaml` through a pull request with:

- the metric definition and source;
- a backtest of the bands on at least the baseline window, if history exists;
- the tier actions and routes, with any new runbook added under `docs/runbooks/` first.
