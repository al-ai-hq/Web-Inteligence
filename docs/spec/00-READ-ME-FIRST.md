# Read Me First

Status: draft for review  
Last updated: 2026-09-30

This folder is the specification for Website Presence Intelligence. Read it in this order.

## Authority order

When two documents disagree, the higher one wins:

1. Law, provider terms and security requirements.
2. `01-PRODUCT-REQUIREMENTS.md` (V4, fixed).
3. Approved decisions in `docs/decisions.md`. A decision overrides 01 only where it says so (D-001).
4. `03-PRODUCTION-CONTRACTS.md`, `schemas/` and `docs/state-machines.md`.
5. Current primary documentation and standards (recorded in `docs/sources.md`, `08-REFERENCE-LIBRARY.md` and `config/policy-facts.yaml`). If a platform fact in a document below has changed, the current primary source wins and the document gets fixed.
6. `02-DETAILED-SPECIFICATION.md` (implementation detail).
7. Configuration in `config/`.
8. The vendored `marketing-seo-agent` skill and other advisory sources.

If you find a conflict, do not pick silently: record it in `docs/open-items.md` and ask.

## Documents

| File | What it is | Read when |
| --- | --- | --- |
| `01-PRODUCT-REQUIREMENTS.md` | What the product must do, for whom, and the acceptance criteria | Always first |
| `02-DETAILED-SPECIFICATION.md` | Rules, scoring, keywords, plans, content, corrections, automations, architecture, agents, integrity, data, security, cost | Designing any feature |
| `03-PRODUCTION-CONTRACTS.md` | Fidelity labels, evidence states, schema list, workflow states, agent tool boundaries, change risk tiers, release evidence | Any data or workflow work |
| `04-CLAUDE-CODE-BUILD-PROMPT.md` | The build prompt for Claude Code, with runtime agent instructions (Appendix A), data contracts (B) and tool allowlists (C) | Starting a session; building a runtime agent |
| `05-PROJECT-PLAN.md` | Milestones M0A-M13 with exit gates, Phase 0, intent backlog, human gates | Planning a milestone |
| `06-MODEL-PLAN.md` | Which Claude model builds each milestone, subagents and effort levels | Starting a milestone |
| `07-SKILLS-AND-AGENTS.md` | Runtime skills and agents, approval boundaries, build-time skills and subagents | Agent or skill work |
| `08-REFERENCE-LIBRARY.md` | Primary sources with checked dates | Before relying on any external fact |
| `09-MERGE-DECISIONS.md` | How V3, V4 and the detailed spec were merged, and what was rejected | Understanding why something is the way it is |
| `10-COMPETITOR-REVIEW.md` | SavageAudit feature and method review | Product decisions |
| `v1-baseline/aeo-geo-seo-audit-prd.md` | The original rule catalog, formulas, prompt set, privacy and retention baseline | Rule and scoring work |

## Outside `docs/spec/`

| Path | What it is |
| --- | --- |
| `schemas/` | JSON Schemas (draft 2020-12) for every contract, with examples and negative tests |
| `config/` | Rules, scoring, agents, providers, crawlers, budgets, retention, eligibility, prompt panels, connectors, policy facts |
| `docs/*.md` | Threat model, data classification, environments, IAM, retention map, cost model, test strategy, rollback plan, eligibility policy, state machines, registers |
| `docs/rubrics/`, `docs/runbooks/`, `docs/legal/` | Experience rubric draft, operations runbooks, legal requirements list |
| `intent/` | Templates and the first two milestone intents |
| `evals/`, `lessons/`, `ops/` | Evaluation plans, post-mortem template, detection bands |
| `.claude/` | Claude Code settings, hooks, skills and subagents |
| `templates/` | Style guides, brand fact sheet, brand terms, keyword upload, content brief |
