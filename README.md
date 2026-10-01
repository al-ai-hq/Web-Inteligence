# Website Presence Intelligence (WPI)

Bilingual (Arabic/English) platform that audits websites for SEO, AEO and GEO, observes AI-answer visibility, plans fixes, and applies approved changes safely. Target: Google Cloud.

M0A (repository bootstrap) is in progress. The application becomes production-ready only after each milestone passes its tests, reviews and human release gates (05-PROJECT-PLAN).

## Quick checks

Run from the repository root. All should pass green.

```bash
# Governance (Python 3.12+ with pyyaml and jsonschema)
python3 -m unittest discover -s .claude/hooks/tests    # 72 hook tests
python3 -m unittest discover -s scripts/tests           # validator regression tests
python3 scripts/check_schemas.py                        # 87 schemas + examples
python3 scripts/check_config.py                         # 3,600+ config checks

# Application (Node 22 LTS, pnpm)
nvm use && corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

## What is here

- **Merged specification** in `docs/spec/` (start with `00-READ-ME-FIRST.md`), including the Claude Code model plan (`06-MODEL-PLAN.md`).
- **Contracts:** 87 JSON Schemas in `schemas/` with examples and negative tests; workflow state tables in `docs/state-machines.md`.
- **Configuration** in `config/`: 77 audit rules in 7 categories, scoring, 18 runtime agent tool allowlists, providers, crawler registry, budgets, retention, anonymous eligibility, prompt panels, 4 candidate connectors, dated policy facts.
- **Workspace:** pnpm monorepo with `apps/web` (Next.js), `services/{crawler,agents,connectors}`, `packages/{contracts,config-loaders,test-utils}`, strict TypeScript, ESLint, Prettier, Vitest, Playwright.
- **Governance docs** in `docs/`: threat model, data classification, environments, IAM matrix, retention and deletion map, cost model, test strategy, rollback plan, eligibility policy, rubric draft, 8 runbooks, legal requirements list, and the decision, assumption, open-item and source registers.
- **Claude Code setup:** `CLAUDE.md`, `REVIEW.md`, `.claude/settings.json` (plan mode by default, permissions, hooks, sandbox), 8 tested hooks, 7 policy skills plus the vendored `marketing-seo-agent` skill, 7 subagents, and CI in `.github/workflows/ci.yml`.
- **Delivery scaffolding:** intent templates, the M0A and M0B intents, eval plans, golden-file instructions, post-mortem template, detection bands, content and brand templates.

## What only people can supply

Listed with owners in `docs/open-items.md`. The most important:

1. Name the accountable owners (OI-002).
2. Choose the Google Cloud organization and region, identity provider, first connector and runtime AI providers (OI-010 to OI-013).
3. Run Phase 0: manual audits of 10 sites to create the labelled evaluation set (OI-055).
4. Legal texts from counsel (OI-054).

## How to start

1. Install Python 3.12+ as `python3`, then `pip install pyyaml jsonschema`.
2. Install Node 22 LTS (`nvm install 22 && nvm use 22`) and enable corepack (`corepack enable`).
3. Run the quick checks above. They should all pass green.
4. Start Claude Code in this folder. It opens in plan mode (see `06-MODEL-PLAN.md`).
5. Continue from the current milestone. Stop at each exit gate, review the phase report, then proceed.
