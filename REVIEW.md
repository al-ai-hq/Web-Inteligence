# Review instructions

Used by automated code review and by reviewer subagents. Findings inform the human code owner; they do not approve or block a PR on their own.

## Passes

- **Bugs:** logic errors, edge cases, regressions, wrong formulas (CTR from totals, impression-weighted position, percentage points for rates, zero denominators).
- **Security:** SSRF and redirect handling, injection (SQL, XSS, CSV, prompt), project isolation (`project_id` on every query), secrets and personal data in logs, anonymous export denial, approval binding.
- **Compliance with the spec:** matches the milestone `spec.md` and `plan.md`, `docs/spec/03-PRODUCTION-CONTRACTS.md` and `schemas/`; split trust (no write tool for any AI agent); fidelity labels and evidence states; cost caps and circuit breakers; change risk tiers.
- **Localization and accessibility:** Arabic and English parity, `lang` and `dir`, bidi isolation, WCAG 2.2 AA on changed UI.
- **Method:** matches the SEO method (vendored `marketing-seo-agent` skill and `evals/golden/`); no promised rankings, rich results or AI citations.

## Important means

Would break behavior, leak data, cross projects, spend outside the budget, bypass an approval, or change a client site without the approval flow.

## Cap the nits

At most five; summarize the rest in one line.

## Do not report

Generated files, lockfiles, anything CI already enforces, and style preferences already handled by the formatter.

## Tune

Review this file monthly. When review flags the same mistake twice, add it to "Things Claude gets wrong" in `CLAUDE.md`.
