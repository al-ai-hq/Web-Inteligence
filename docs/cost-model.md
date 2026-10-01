# Cost model

Status: draft for review
Owner role: Cloud billing owner
Sources: 01-PRODUCT-REQUIREMENTS §5.19, §9, §14; 03-PRODUCTION-CONTRACTS (`CostLedgerEntry`, `ProviderBreaker`); 04-CLAUDE-CODE-BUILD-PROMPT §3, §19; 05-PROJECT-PLAN M0, M0B, M13, §7; 02-DETAILED-SPECIFICATION §15 (cost ledger control), §18; v1-baseline §11; docs/decisions.md D-005, D-006, D-007, D-010
Last updated: 2026-09-30

## 1. The rule

D-005: one hard monthly cap of **USD 150** covers everything: Google Cloud hosting and
infrastructure plus AI-model and data-provider calls. The cost guard tracks hosting (from the
Cloud Billing export) and paid calls (from its own ledger) as separate lines against the one cap.

ASSUMPTION: this is the conservative reading of the owner's answer "1 and 2". It is an open item
to confirm. ASSUMPTION: the cap covers every project on the billing account, including dev and
staging, and every external provider invoice.

This document contains no prices. Every price comes from the provider's official pricing page at
build time, is stored in config with source, checked date and owner (D-010), and is reviewed
monthly (02 §18, v1-baseline §11.3).

`config/budgets.yaml` holds the enforced values: the USD 150 cap, the USD 100 alert,
per-audit caps, retry and breaker settings, tracked lines, reconciliation and the degradation
order. This document adds the formulas, the reserve, the anonymous sub-budget and the M0B cost
proof. The config now holds `reserve` (USD 10, ASSUMPTION) and stops paid calls at the cap
minus the reserve. Keys this document proposes that the config does not yet hold: anonymous
sub-budget and pacing, reduced/preview per-audit caps, and the hosting-overrun behavior
(`hosting_overrun` is `<DECIDE_AT_M0>` in the config).

## 2. Cost lines

"Measured by" names where the number comes from. Provider invoices outside Google Cloud do not
appear in the Cloud Billing export, so the ledger and the provider's own usage report are the
sources for those lines.

| Line | Kind | Billed through | Measured by | Stoppable by application breakers |
|---|---|---|---|---|
| Cloud Run services (web/API, gateway, agents, connector, cost guard) | Hosting, fixed and variable | Google Cloud | Billing export by service and label | Partly (scale limits); stopping serves an outage |
| Cloud Run Jobs (crawl, render, deletion, evidence processing) | Hosting, variable | Google Cloud | Billing export; per-audit job duration in the ledger | Yes, by closing intake or reducing scope |
| Cloud SQL for PostgreSQL (instance, storage, backups) | Hosting, fixed | Google Cloud | Billing export | No |
| Cloud Storage (storage, operations, egress) | Hosting, variable | Google Cloud | Billing export | Partly (lifecycle, retention) |
| Load balancer and Cloud Armor | Hosting, fixed and per-request | Google Cloud | Billing export | No |
| Cloud NAT and static egress IP for the crawler | Hosting, fixed and variable | Google Cloud | Billing export | Partly |
| Network egress | Hosting, variable | Google Cloud | Billing export | Partly |
| Cloud Logging, Monitoring, Trace, Error Reporting | Hosting, variable | Google Cloud | Billing export; log volume per service | Partly (log levels, exclusions) |
| Workflows, Cloud Tasks, Pub/Sub, Cloud Scheduler | Hosting, variable | Google Cloud | Billing export | Partly |
| Secret Manager, Cloud KMS | Hosting, small fixed and per-operation | Google Cloud | Billing export | No |
| BigQuery (Billing export dataset, cost ledger copy, analytics) | Hosting, variable | Google Cloud | Billing export | Partly |
| Artifact Registry and CI builds | Hosting, variable | Google Cloud or CI vendor | Billing export or CI invoice | Partly |
| Identity provider (M4+) | Hosting, per-user | `<DECIDE_AT_M0: identity provider>` | Invoice or Billing export | No |
| CAPTCHA | Per assessment | `<DECIDE_AT_M0B: CAPTCHA provider>` | Invoice or Billing export | Yes (only used when suspicious) |
| Prompt and response screening, sensitive-data inspection (if adopted) | Per call | Google Cloud | Billing export; ledger | Yes |
| AI model calls on Vertex AI | Paid call | Google Cloud | Ledger (pre-call estimate, then actual usage); Billing export | Yes, pre-call check |
| AI model calls on external providers | Paid call | Each provider | Ledger; provider usage report or invoice | Yes, pre-call check |
| Search and grounding calls (provider web search, grounding) | Paid call | Provider | Ledger (search count per call, v1-baseline §12.5); provider usage | Yes, pre-call check |
| Keyword and rank data (Keyword Planner, licensed provider) (M4+) | Paid call or subscription | Provider | Ledger; invoice | Yes for per-call; no for subscriptions |
| Domain and DNS | Fixed | Registrar or Google Cloud | Invoice | No |

Check at M0B which services bill while idle (for example a database instance, a minimum
instance setting, a load-balancer forwarding rule or a static IP). Those form the fixed part of
the hosting baseline.

## 3. Formulas

Definitions (all USD per calendar month unless stated):

- `monthly_cap` = 150 (D-005).
- `hosting_baseline` = fixed hosting (idle cost of all projects) + variable hosting at the
  forecast audit volume.
- `reserve` = spend held back for Billing export delay, price changes and rounding.
  ASSUMPTION: USD 10.
- `paid_calls` = AI model, search/grounding and data-provider calls, as recorded in the ledger.
- `per_audit_hard_cap` = USD 4.00 paid-call cap per audit (D-007). Soft cap USD 3.00.

The cap identity:

```text
monthly_cap = hosting_baseline + paid_calls + reserve
paid_call_budget = monthly_cap - hosting_baseline - reserve
```

Worst-case rich-audit capacity, if the whole paid-call budget went to anonymous rich audits and
every audit reached its hard cap:

```text
rich_audits_per_month = floor((150 - hosting_baseline - reserve) / per_audit_hard_cap)
```

Refined capacity, when variable hosting per audit is measured separately from the baseline
(then `hosting_baseline` holds only the fixed part):

```text
rich_audits_per_month = floor((150 - hosting_fixed - reserve - other_paid_commitments)
                              / (per_audit_hard_cap + hosting_variable_per_rich_audit))
```

`other_paid_commitments` covers everything else that spends from the same budget: reduced and
preview audits, registered audits, connected prompt panels, keyword data, and paid calls made in
dev and staging for evals.

Mixed workload check (must hold every month):

```text
paid_call_budget >= sum over tiers t of (audits_t x cap_t)
                    + registered_paid + panel_paid + keyword_data + test_calls
```

`cap_t` is the per-audit hard cap for each tier. ASSUMPTION: the rich tier uses D-007
(USD 4.00); reduced and preview caps are `<DECIDE_AT_M0B>`; preview makes no paid AI calls.

Model spend per audit follows 02 §18:

```text
monthly_model_cost = A x (P x sum over providers p of c_p + s)
```

`A` audits per month, `P` prompts per provider (D-006 default 8), `c_p` cost of one observation on
provider `p` including its search calls, `s` summarization cost per audit.

Scale warning: a full connected panel (40 prompts x 5 providers x 3 runs) is 600 paid
observations per workspace per run (02 §18). Its size and cadence are plan configuration.

## 4. Illustrative capacity

**Illustrative, not a price quote.** Hosting baselines below are placeholders to show the
formula, not estimates. Reserve USD 10. Hard cap USD 4.00 (D-007). Worst case: every audit reaches
its hard cap and nothing else spends from the paid budget.

| hosting_baseline | reserve | paid_call_budget (150 - h - r) | per_audit_hard_cap | rich_audits_per_month (floor) |
|---|---|---|---|---|
| USD 40 | USD 10 | USD 100 | USD 4.00 | 25 |
| USD 70 | USD 10 | USD 70 | USD 4.00 | 17 |
| USD 100 | USD 10 | USD 40 | USD 4.00 | 10 |

Reading the table: every extra USD 4.00 of hosting removes one worst-case rich audit. Average
per-audit cost is expected to sit below the hard cap, but capacity planning uses the cap because
the cap is the only number the system guarantees.

## 5. Enforcement

| Mechanism | Acts on | Speed |
|---|---|---|
| Pre-call check in the provider gateway | Every paid call: per-audit, daily anonymous allowance, monthly paid budget | Immediate, before the call |
| Per-audit caps (D-007) | Soft: skip optional retries and summaries. Hard: stop paid calls, mark sections `unavailable` | Immediate |
| Circuit breaker per provider (D-007) | Opens after 3 consecutive timeouts or 5xx; 15-minute cool-down; one probe; results `unavailable`, never 0% | Immediate |
| Cloud Billing budgets | Alert only; notifications go to Pub/Sub and the cost guard (02 §18) | Delayed by Billing export latency; measure it at M0B |
| Cost guard | Computes month-end forecast = hosting forecast + paid spent + paid committed; sets budget state and global breakers | On each notification and on a schedule (ASSUMPTION: hourly) |
| Reconciliation | Ledger versus Billing export and provider usage reports; alert if variance exceeds 5% (ASSUMPTION, 02 §15) | Monthly (`config/budgets.yaml`); ASSUMPTION: plus a daily check |

Degradation order against the month-end forecast of total spend, as in `config/budgets.yaml`
(`degradation_order`, percentages of the USD 150 cap, projected spend including hosting,
ASSUMPTION). Rows marked "proposal" are ASSUMPTIONS the config leaves open.

| Forecast reaches | Action |
|---|---|
| USD 100 | Alert admins (02 §18 monthly alert) |
| 70% | Disable automatic provider retries (v1-baseline §11.4) |
| 85% | Reduce optional summarization tokens (v1-baseline §11.4). Proposal: anonymous rich audits also drop optional enrichment and repeat observations |
| 95% | Mark providers with `degradation_priority: drop_first` in `config/providers.yaml` temporarily unavailable (v1-baseline §11.4). Proposal: anonymous rich audits run without AI observations |
| Paid-call budget exhausted (total forecast reaches `monthly_cap - reserve`) | Stop all paid calls; deterministic audits continue; AI sections read "unavailable: monthly limit" (v1-baseline §11.4). The config's final degradation step and `paid_calls_stop_at` both use cap minus reserve, so Billing export delay cannot push real spend past USD 150 |
| Hosting forecast alone reaches `monthly_cap - reserve` | Proposal (config `hosting_overrun` is `<DECIDE_AT_M0>`): close new anonymous intake (tier `refused`, capacity reason) and page the cloud billing owner (`docs/runbooks/budget-hard-stop.md`) |

The application never unlinks billing, deletes resources or stops production services as an
automatic cost control. Hosting reductions are human decisions.

## 6. Anonymous sub-budget and pacing

ASSUMPTION, decide at M0B:

- The anonymous tiers spend from a separate paid sub-budget, so abuse of the anonymous path
  cannot consume the budget reserved for registered and connected work.
- Daily pacing: `daily_anonymous_allowance = remaining_anonymous_sub_budget / days_left_in_month`,
  recomputed daily. A rich audit starts with paid calls only while the remaining daily allowance
  is at least `per_audit_hard_cap`. Unused allowance rolls forward.
- When the allowance is short, the eligibility policy downgrades the tier
  (`docs/anonymous-eligibility-policy.md` §6), it does not silently cut sections.

## 7. Cost proof (two stages)

05-PROJECT-PLAN M0B requires independent reviewers to "simulate the USD 150 hard stop". M0B has
no deployed services, crawler or provider gateway yet (`intent/INT-01-.../intent.md`), so the
proof runs in two stages (D-019):

- **Stage 1, modelled proof at M0B.** Use the formulas in §3, `config/budgets.yaml`, synthetic
  ledger entries and an *estimated* hosting baseline for the planned topology, built from Google
  Cloud's published pricing and labelled `estimated`. Show in a test harness that the pre-call
  check refuses the next paid call at `monthly_cap - reserve`, that AI sections become
  `unavailable` (never 0%), and that deterministic results still complete. Compute the range of
  `rich_audits_per_month` for the estimate. This closes the M0B gate.
- **Stage 2, measured proof before any public anonymous traffic.** Run §7.1 to §7.5 on staging
  once M1 (crawler, hosting baseline) and M6 (provider gateway, ledger) exist. The public
  anonymous launch (05 §15, OI-005) waits for this stage to pass.

The steps below describe Stage 2. Stage 1 uses the same checks with synthetic inputs.

### 7.1 Prerequisites

1. Cloud Billing export to BigQuery enabled for the billing account, into the billing project
   (`docs/environments.md` §1).
2. Every resource labelled with at least `env`, `service` and `component`. ASSUMPTION: label keys
   agreed at M0B; unlabelled spend is reported as its own line.
3. Staging deployed with the production topology and sizing (minimum instances, database tier,
   load balancer, NAT), even if production sizing is later reduced.
4. The cost ledger, provider gateway pre-call check and per-audit caps working in staging.
5. The Phase 0 labelled sites available with owner permission (02 §19).
   ASSUMPTION: 10 sites, including an Arabic RTL site, a JavaScript-heavy site and a large site.
6. Price tables in config with source and checked date (D-010).

### 7.2 Measure the hosting baseline

1. Leave staging idle for a measurement window. ASSUMPTION: 7 days.
2. Query the Billing export grouped by project, service, SKU and label. Record the daily idle cost.
3. Extrapolate to a 30-day month for staging. Scale to production and dev using their planned
   sizing, and add shared projects. The sum is `hosting_fixed`.
4. Record the observed delay between usage and its appearance in the export. Size `reserve` to
   cover at least the spend that can happen during that delay at the planned daily rate.
5. Record whether the billing account currency is USD and how taxes appear. Decide whether the cap
   is before or after tax: `<DECIDE_AT_M0B: cap currency and tax treatment>`.

### 7.3 Measure per-audit cost

1. Run each labelled site as a rich anonymous audit in staging. ASSUMPTION: 3 runs per site on
   different days, with the default D-006 sizes and the configured providers.
2. For each run record from the ledger: paid-call cost per provider, search/grounding count,
   tokens, retries, breaker events, and whether the soft or hard cap fired.
3. Record variable hosting per run: crawl and render job duration, Cloud Run request time,
   storage written, egress and log volume, using labels and job metadata.
4. Reconcile ledger totals with the Billing export (Vertex AI and Google Cloud lines) and with
   each external provider's usage report. Variance above 5% (ASSUMPTION) blocks the proof until
   the price table or the ledger is fixed.
5. Report p50, p95 and maximum for paid cost and for variable hosting per audit, per site type.
   Repeat for the reduced and preview tiers.

### 7.4 Simulate the hard stop

1. In staging, set a test cap just above current spend, or inject synthetic ledger entries, so
   the cap is crossed during a test run. Use a test budget on the staging project with a low
   amount to exercise the real budget-notification path.
2. Start several rich audits while the cap is crossed. Expected results:
   - the next paid call is refused by the pre-call check;
   - AI sections show `unavailable` with the monthly-limit reason, never 0%;
   - deterministic evidence, Presence Readiness, findings and the action plan still complete;
   - eligibility downgrades new anonymous audits as §5 and §6 describe;
   - alerts reach the cloud billing owner;
   - the stop takes effect within one cost-guard cycle (02 §19).
3. Simulate a hosting-forecast breach and check that anonymous intake closes with the capacity
   message and that no resource is stopped or deleted.
4. Simulate an abuse run (scripted anonymous audits from many cookies and IP prefixes) and check
   that anonymous paid spend never exceeds the anonymous sub-budget (TS-COST, TS-LOAD).
5. Record the evidence in the M0B release evidence.

### 7.5 Decide affordability

Compute `rich_audits_per_month` with the measured `hosting_fixed`, `reserve` and the measured
hard-cap hit rate. Compare it with expected anonymous demand:
`<DECIDE_AT_M0B: expected anonymous audits per month>` (v1-baseline §11.1 assumed 30 completed
audits per month).

The anonymous rich audit is affordable when capacity covers expected demand after all other
paid commitments. ASSUMPTION: the owner sets the required margin.

If it is not affordable, choose one or more, cheapest to product value first:

1. **Reduce rich scope**: fewer representative pages, fewer providers or prompts in the free
   panel, comparison only when the budget state is normal (D-006 sizes are configuration).
2. **Cache and reuse evidence**: reuse same-domain public evidence within its freshness window,
   with capture time disclosed (01 §5.19); never reuse an old AI observation as a new one
   (v1-baseline §11.2).
3. **Lower AI observations**: run fewer observations per rich audit, or run them for the rich
   tier only; results stay counts with numerators and denominators.
4. **Lower hosting**: minimum instances 0 where acceptable, smaller database tier, dev and
   staging scaled down outside working hours, fewer always-on services.
5. **Raise the cap or split it**: an owner decision. Options: raise USD 150, or confirm that the
   owner's "1 and 2" meant separate hosting and paid-call budgets (the source text of 02 §1
   assumed infrastructure was budgeted separately; see 02 appendix, change 8). Record the outcome
   in `docs/decisions.md`.

## 8. Open decisions

- Confirm the D-005 reading (combined cap, all projects, all provider invoices).
- `<DECIDE_AT_M0B: reserve>` (USD 10 assumed), `<DECIDE_AT_M0B: cap currency and tax treatment>`.
- `<DECIDE_AT_M0B: anonymous sub-budget share>` and pacing.
- `<DECIDE_AT_M0B: reduced and preview per-audit caps>`.
- `<DECIDE_AT_M0B: expected anonymous audits per month>` and the required margin.
- Whether the rich audit's comparison target counts inside the 20-page default (D-006) or adds pages.
- BigQuery is needed for the Billing export (02 §12) but is not listed in D-008; confirm it.
