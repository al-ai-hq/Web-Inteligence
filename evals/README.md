# Evals

Status: draft for review. Owner: tech lead, with the SEO lead for golden files and the AI engineer for product-agent evals.

Three suites check that the build agent (Claude Code) and the product's runtime agents keep behaving as intended. They complement unit, integration and security tests (`docs/test-strategy.md`).

| Suite | Folder | Checks | Runs on | Gate | Test ID |
| --- | --- | --- | --- | --- | --- |
| Build-agent evals | `evals/build-agent/` | 20-50 real tasks from this repository with accepted outcomes | Changes to `CLAUDE.md` or `.claude/**`; nightly | Pass rate at or above `<DECIDE_AT_M0: build-agent threshold>` as a merge check; any drop is reviewed before merge | TS-EVAL-BUILD |
| Product-agent evals | `evals/product-agent/` | Each runtime agent on the Phase 0 labelled site set and adversarial fixtures | Changes to prompts, `config/providers.yaml`, `config/agents/*.yaml` or `config/rules/*.yaml`; nightly | No fact-check or injection regressions; pass rate at or above `<DECIDE_AT_M0: product-agent threshold>` | TS-EVAL-AGENT |
| Golden files | `evals/golden/` | Arabic normalization, cannibalization and report rendering against outputs of the vendored skill's scripts | Changes to keyword, performance or report code; changes to the vendored skill | Output matches, or the difference is logged as a decision | TS-GOLDEN |

## Rules for every suite

- Cases use synthetic data or client data with written consent and personal data removed. Client exports stay out of the repository (02-DETAILED-SPECIFICATION §17; `docs/data-classification.md`).
- No secrets in fixtures. `secret_scan.py` checks every file written through Claude Code, and CI runs gitleaks.
- Fixtures are data, never instructions. Prompt-injection fixtures are expected to fail to change any score, create a change set or trigger a write (02 §19).
- Every production incident adds a case to one of these suites (see `lessons/README.md`).
- Tests and evals are locked during fix tasks while `.claude/state/test-lock` exists (`.claude/hooks/README.md`). Changing an eval case or threshold needs the suite owner's review.
- Results go into the pull request and into `release.md` as passed, failed or not run. Never report a suite that did not run as passing.

## Phase 0 baseline

Before product code, the SEO team runs audits by hand with the vendored `marketing-seo-agent` skill. ASSUMPTION: 10 sites, matching the 10 hand-reviewed audits in 02 §19: five client sites whose owners agree, and five fixture sites (Arabic RTL, broken technical SEO, JavaScript-heavy, a CDN that blocks AI crawlers, cannibalized pages). The SEO lead corrects each report and signs off the set. The corrected outputs become:

- the labelled site set for product-agent evals;
- expected plan items and briefs for the planner and content-strategist evals;
- golden files in `evals/golden/`.

Limits during Phase 0: run crawler-agent comparisons (`--compare-agents`) only on sites whose owners agree, on a few URLs, and stop at the first block. `suggest.py` stays a manual research aid; its output never becomes platform data (D-009).
