# Website Presence Intelligence: start-ready repository (V5)

This folder is ready for Claude Code to start development at milestone M0A. It merges the V4 production package with the detailed specification, fixes their inconsistencies, and adds everything V4 requires before the first build milestone.

It is **ready to start**, not a finished product. The application becomes production-ready only after each milestone passes its tests, reviews and human release gates (05-PROJECT-PLAN).

## What is here

- **Merged specification** in `docs/spec/` (start with `00-READ-ME-FIRST.md`), including the Claude Code model plan (`06-MODEL-PLAN.md`).
- **Contracts:** 87 JSON Schemas in `schemas/` with examples and negative tests; workflow state tables in `docs/state-machines.md`.
- **Configuration** in `config/`: 77 audit rules in 7 categories, scoring, 18 runtime agent tool allowlists, providers, crawler registry, budgets, retention, anonymous eligibility, prompt panels, 4 candidate connectors, dated policy facts.
- **Governance docs** in `docs/`: threat model, data classification, environments, IAM matrix, retention and deletion map, cost model, test strategy, rollback plan, eligibility policy, rubric draft, 8 runbooks, legal requirements list, and the decision, assumption, open-item and source registers.
- **Claude Code setup:** `CLAUDE.md`, `REVIEW.md`, `.claude/settings.json` (plan mode by default, permissions, hooks, sandbox), 8 tested hooks, 7 policy skills plus the vendored `marketing-seo-agent` skill, 7 subagents, and CI in `.github/workflows/ci.yml`.
- **Delivery scaffolding:** intent templates, the M0A and M0B intents, eval plans, golden-file instructions, post-mortem template, detection bands, content and brand templates.

## What only people can supply

Listed with owners in `docs/open-items.md`. The most important:

1. Confirm the budget reading (OI-001): is USD 150 one cap for hosting and AI calls together?
2. Name the accountable owners (OI-002).
3. Choose the Google Cloud organization and region, identity provider, first connector and runtime AI providers (OI-010 to OI-013).
4. Run Phase 0: manual audits of 10 sites to create the labelled evaluation set (OI-055).
5. Legal texts from counsel (OI-054).
6. The r2 skill references, if you have them (OI-004).

## How to start

1. Open this folder as a git repository and commit it as the first commit.
2. Install Python 3 (as `python3`) and `pip install pyyaml jsonschema`, then run the governance checks in `CLAUDE.md`. They should pass. Use Claude Code v2.1.284 or later. The project settings require the sandbox; if Claude Code refuses to start because the sandbox is unavailable, install what the Claude Code sandboxing docs list for your system rather than turning the sandbox off.
3. Resolve OI-001 to OI-005, or accept the stated assumptions in writing.
4. Start Claude Code in this folder. It opens in plan mode with `opusplan` (see `06-MODEL-PLAN.md`).
5. Accept the INT-00 intent (set its status to `accepted`), ask Claude Code to write the spec with the `intent-spec-plan` skill, approve the spec, then let it write the plan in plan mode and approve the plan. Each approval is yours, not Claude's.
6. Stop at the M0A exit gate, review the phase report, then do the same for M0B with `/model fable`.

The original V4 files in the parent folder are unchanged.
