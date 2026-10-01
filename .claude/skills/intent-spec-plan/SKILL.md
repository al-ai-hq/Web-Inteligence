---
name: intent-spec-plan
description: Writes intent.md, spec.md and plan.md one stage at a time from intent/_templates/ and stops for human approval after each stage. Use when starting, capturing, specifying or planning a feature, milestone, fix or incident follow-up.
---

# Intent, spec and plan (process skill)

Status: draft for review. Version 0.1.0. Owner: product owner `<DECIDE_AT_M0: name>`, with the tech lead for plans.

Every change follows the artifact chain `intent.md → spec.md → plan.md → code/tests/evals → review → release.md → lessons → new intent` (05-PROJECT-PLAN §1, §11; 04-CLAUDE-CODE-BUILD-PROMPT §24). The committed files are the audit trail of who asked for what, what the agent produced and who approved it.

## Hard rules

- Write one artifact per stage, then stop and ask for approval. Do not start the next stage in the same turn.
- Never set an approval status yourself (`accepted`, `approved`, `authorized`). Only the named human does, by editing the status or merging the pull request.
- Proceed to the next stage only when the previous file shows the human-set status, or the human says in this conversation that they approved it; then record who and when in the file's table.
- Cite repository paths (`docs/spec/...`, `config/...`, `schemas/...`), never chat.
- Mark unknowns: `ASSUMPTION:` for defaults you chose, `<DECIDE_AT_M0: ...>` for owner decisions. Never invent prices, model IDs, quotas, API fields or Google requirements.
- Work one approved milestone at a time and stop at its exit gate (05 §9, §11).

## Stage 1: intent

1. Pick the next free ID (`INT-<nn>`) by listing `intent/`. Create `intent/<ID>-<kebab-slug>/intent.md` from `intent/_templates/intent.md`.
2. Write the problem in the originator's own words. Keep the outcome observable and free of implementation detail.
3. Fill constraints from `docs/decisions.md` (all entries) and the spec sections that apply. Take the exit gate from `docs/spec/05-PROJECT-PLAN.md` when the intent maps to a milestone.
4. Set the risk class. High-risk: connector write paths, auth, tenant isolation, SSRF, cost guard, rule weights, production infrastructure.
5. Status `draft`. Stop. Ask the product owner to accept it (merge or recorded acceptance).

## Stage 2: spec

Start only after the intent is `accepted`.

1. Read the intent and the cited sections of `docs/spec/` (01 is the product authority; 02 supplies implementation detail where 01 is silent, D-001).
2. Load the policy skills that apply: `google-search-guidance`, `security-baseline`, `arabic-rtl-a11y`, `data-integrity`, `cost-guard`, `connector-safety`, and the vendored `marketing-seo-agent` references for SEO method.
3. Use this prompt shape:

   ```text
   Read intent/<ID>-<slug>/intent.md and the cited sections of docs/spec/.
   Produce a requirements and design spec for our codebase. Apply the available
   skills so the spec conforms to our security, data-integrity, Arabic RTL, cost,
   connector and Google Search policies. Save it as intent/<ID>-<slug>/spec.md.
   Describe clearly any areas of concern, especially where you cannot satisfy
   contradicting policies.
   ```

4. Fill `intent/_templates/spec.md`: requirements with sources, design, data contracts, state transitions, configuration, the policy-conformance table, areas of concern, test and eval plan, rollout and rollback, cost.
5. Record the prompt version and every skill version used.
6. For UI work, link mocks of the screens in both languages; they are reviewed before the spec is approved.
7. Status `draft`. Stop. The product owner works through flagged concerns with the named policy owners and approves.

## Stage 3: plan

Start only after the spec is `approved`. Work in plan mode.

1. Inspect the repository first: status, manifests, lockfiles, scripts, settings, hooks, config and relevant code. Preserve unrelated work (04 §24).
2. Fill `intent/_templates/plan.md`: the smallest coherent slice, files, order of work, risks, proof commands, reviews, rollback.
3. Bug fixes start with a failing test committed first. Ask the engineer to set `.claude/state/test-lock` for the fix (`.claude/hooks/README.md`).
4. Status `draft`. Stop. An engineer approves every plan; high-risk plans also need the tech lead.
5. During implementation, update `plan.md` in the same commit whenever the work departs from it.

## After the plan

- Implement the slice, run the proof commands, and paste real output into the pull request. Report checks as passed, failed or not run.
- A code owner approves the pull request; the agent that wrote it never approves it.
- After merge, fill `intent/_templates/release.md` as `release.md`; the release approver authorizes production.
- Incidents and review findings become `lessons/` entries and new intents (see `lessons/README.md`).
- Update `docs/decisions.md`, `docs/assumptions.md`, `docs/open-items.md` and `docs/sources.md` for every milestone (04 §24).

## Phase report (end of each milestone)

1. Outcome and acceptance status. 2. Files changed. 3. Decisions and assumptions added. 4. Commands and checks actually run. 5. Tests and evals: passed, failed, not run. 6. Security, privacy, cost, Arabic/accessibility and rollback evidence. 7. Open items and the smallest required human decision. 8. Proposed next milestone; do not start it automatically (04 §24).
