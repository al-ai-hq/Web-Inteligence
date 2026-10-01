# Runbook: provider outage

Status: draft for review
Owner role: Provider policy owner (AI engineer on call)
Sources: 01-PRODUCT-REQUIREMENTS §5.8, §8 (AI visibility), §15; 04-CLAUDE-CODE-BUILD-PROMPT §3, §19; 02-DETAILED-SPECIFICATION §18; v1-baseline §6.7, §11.2, §11.4; docs/decisions.md D-007, D-010; docs/cost-model.md §5
Last updated: 2026-09-30

## Trigger

A provider circuit breaker opens (3 consecutive timeouts or 5xx; D-007), a provider's error rate
rises, the provider reports an incident, or a model or feature is retired or its terms change.

## Steps

1. Confirm the breaker state and scope: one provider, one mode (for example web search), or all.
2. Let the breaker work: 15-minute cool-down, then one probe (D-007). Do not force it closed.
3. Check reports: the provider's results show `unavailable` with a reason; failed calls are
   excluded from denominators; nothing shows as 0% (01 §8, v1-baseline §6.7).
4. If the outage lasts (ASSUMPTION: over 2 hours, `<DECIDE_AT_M6>`), set
   `provider_<id>_enabled` off to stop probes and show a notice in the product.
5. Check spend: are failed calls billed? Reconcile the ledger for the affected window.
6. Retirement or terms change: update `config/providers.yaml` through a normal change with
   source, checked date and owner (D-010), and run the agent evals. Never change model IDs in code.
7. Recovery: re-enable the provider, watch the probe and error rate.
8. Record the window, affected audits and actions in the incident or operations log.

## Verification

- Audits during the outage completed their deterministic parts.
- No report shows a failed provider as a negative result.
- Ledger and provider usage agree for the window.

## Never

- Substitute another provider's answer for the failed one.
- Reuse an old observation as a new timestamped one (v1-baseline §11.2).
- Retry beyond policy (one retry for transient failures; none for policy refusals, v1-baseline §11.2).
- Bypass the cost guard to "catch up" missed observations.
- Treat provider failure as zero visibility.
