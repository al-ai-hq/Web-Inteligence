# Model Plan for Building with Claude Code

Status: draft for review  
Owner role: Tech lead (with the security engineer for high-risk milestones)  
Sources: Claude Code model configuration and sub-agent docs, checked 30 Sep 2026 (see `docs/sources.md`); 05-PROJECT-PLAN; 03-PRODUCTION-CONTRACTS  
Last updated: 2026-09-30

This plan says which Claude model builds each milestone, which models the subagents use, how hard each one thinks, and who approves the result. It covers Claude Code, the build tool. The product's own runtime AI models are separate: they live in `config/providers.yaml` and `config/agents/*.yaml` and are decided at M0B (D-011).

## 1. Models available in Claude Code

Checked in the Claude Code docs on 30 Sep 2026. Recheck before M0A; model names and aliases change.

| Alias | Model | Use it for | Notes |
| --- | --- | --- | --- |
| `fable` | Claude Fable 5.1 | The hardest, longest, most ambiguous work: architecture, security-critical code, root-cause investigation | 1M-token context. Needs Claude Code v2.1.257 or later. Never the default: select it with `/model fable` or `claude --model fable`. Some plans bill it from usage credits, with a consent prompt in interactive sessions. The alias table lists Fable 5.1 for Google Cloud's Agent Platform; confirm it is enabled for your project. |
| `opus` | Claude Opus 5.5 | Planning, design review, independent security review, complex implementation | Default model on most plans. Needs Claude Code v2.1.280 or later. 1M context natively on the Anthropic API. |
| `opusplan` | Opus in plan mode, Sonnet when executing | Routine milestones: Opus writes the plan, Sonnet implements the approved plan | Fits the playbook rule that a human approves every plan. |
| `sonnet` | Claude Sonnet 5.5 | Day-to-day implementation, tests, UI, fixtures | Needs Claude Code v2.1.284 or later. 1M context natively on the Anthropic API. |
| `haiku` | The current Haiku model (Haiku 4.5 at the time of writing) | Simple, fast, low-risk work: registers, formatting, summaries | Resolution varies by provider; check `/model`. |
| `best` | Fable where available, otherwise Opus | Not used in this plan | Too implicit for an auditable plan. |

**Minimum Claude Code version:** v2.1.284, the highest of the three requirements above (OI-024).

**Security-flagged requests are served by another model.** The docs state that when a request to Fable 5.1 or Opus 5.5 is flagged as cybersecurity-related, it re-runs on Opus 4.8; for Sonnet 5.5 it re-runs on Sonnet 5. Expect this during M1 (SSRF and DNS-rebinding code and tests) and security reviews. It does not change the plan: the same plan approval, independent review and human gate apply, and the phase report should note which model actually served the security work if Claude Code shows it.

**If Claude Code runs through Google Cloud's Agent Platform:** aliases resolve differently there (the docs' table shows `sonnet` resolving to an older Sonnet on that route). Pin exact model IDs in user or managed settings with `ANTHROPIC_DEFAULT_FABLE_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_HAIKU_MODEL`, using the IDs from the provider's model page (`<DECIDE_AT_M0: Claude Code access route and pinned model IDs>`).

## 2. How to choose

Pick the model by risk and ambiguity, not by the size of the milestone.

| Work type | Lead model | Effort | Why |
| --- | --- | --- | --- |
| Security boundaries, write paths, tenancy, money | `fable` (fallback `opus`) | `xhigh`, `max` for the hardest slices | A mistake leaks data, spends money or changes a client's site. Long, careful investigation and self-verification matter most. |
| Contracts, architecture, cost proof | `fable` (fallback `opus`) | `xhigh` | Decisions that every later milestone depends on. |
| Deterministic rules, formulas, scoring | `opus` | `high` | Correctness is testable; needs care, not days of exploration. |
| Product features with clear specs | `opusplan` | `high` | Opus plans, Sonnet builds; the plan is approved by a human in between. |
| Tests, fixtures, UI parity checks | `sonnet` | `high` | Well-defined, high volume. |
| Registers, summaries, formatting | `haiku` | `low` | Cheap and fast; no judgment calls. |

Rules that apply to every milestone:

- Start every change in plan mode (the project default in `.claude/settings.json`). An engineer approves the plan before any edit.
- The model that wrote a change never reviews or approves it. Reviews run in a separate subagent with read-only tools, and a human code owner approves the PR.
- Never use bypass-permissions mode. Auto mode only for routine work listed in 05-PROJECT-PLAN §12, never for the high-risk areas in this table's first row.
- If Fable is not enabled for the account, or its credits are exhausted, use `opus` with effort `xhigh` and add a second independent review.

## 3. Plan per milestone

"Lead" is the main Claude Code session. "Reviewers" are the subagents in §4 that must run before the PR is opened. "Human gate" is the approval that closes the milestone (05-PROJECT-PLAN §17).

| Milestone | Lead model and effort | Why this model | Reviewers (subagents) | Human gate |
| --- | --- | --- | --- | --- |
| M0A Repository and governance bootstrap | `opusplan`, high | Clear tasks, but it sets conventions everything else follows | `security-reviewer` (settings, hooks, CI), `verifier` | Tech lead |
| M0B Contracts, threat model, IAM, cost proof | `fable`, xhigh | Cross-cutting design with many open decisions; the modelled cost proof (Stage 1, D-019) sets the budget rules the measured proof later checks | `security-reviewer`, `cost-reviewer`, `verifier` | Tech lead, security engineer, cloud billing owner |
| M1 Secure crawler and evidence capture | `fable`, max for SSRF and DNS-rebinding code; xhigh otherwise | Highest-risk code in the product | `security-reviewer`, `test-writer` (SSRF suite), `verifier` | Security engineer |
| M2 Integrity and Presence Readiness | `opus`, high | Deterministic rules and formulas with golden fixtures | `seo-method-checker`, `test-writer`, `verifier` | Methodology owner |
| M3 Reports, comparison, action board | `opusplan`, high | Clear specs; large UI surface in two languages | `rtl-a11y-checker`, `security-reviewer` (anonymous link and export denial), `verifier` | Product owner, Arabic reviewer |
| M4 Keywords, Search Console, GA4, minimal registration | `opusplan`, high; switch to `fable` for registration, claiming and domain verification | Metrics are well specified; identity and claiming are security-sensitive | `security-reviewer`, `seo-method-checker`, `test-writer` | Tech lead, security engineer |
| M5 Experience Effectiveness | `opusplan`, high | Rubric-driven; calibration is human work | `seo-method-checker`, `rtl-a11y-checker` | Methodology owner |
| M6 AI visibility laboratory | `opus`, xhigh | Provider gateway, cost ledger and circuit breakers spend money | `cost-reviewer`, `security-reviewer`, `test-writer` | Cloud billing owner, AI engineer |
| M7 Public footprint, entity graph, brand truth | `opusplan`, high | Clear specs; source separation checked by tests | `seo-method-checker`, `verifier` | Methodology owner |
| M8 Content and schema studio | `opusplan`, high | Clear specs; fabricated-claim evals catch errors | `seo-method-checker`, `test-writer` | Content approver |
| M8A Commerce, local, entity, platform packs | `opusplan`, high | Many small, well-specified modules | `seo-method-checker`, `verifier` | Methodology owner |
| M8B Migration control plane | `opus`, xhigh | Redirect and parity errors are costly for clients | `seo-method-checker`, `test-writer`, `verifier` | Tech lead |
| M8C Architecture, backlinks, scaled content, change monitoring | `opusplan`, high | Clear specs; gates are deterministic | `seo-method-checker`, `test-writer` | Methodology owner |
| M9 First safe connector and impact ledger | `fable`, max | The only write path to client sites | `security-reviewer`, `test-writer` (stale, replay, rollback), `verifier` | Tech lead, integration engineer, security engineer |
| M10 Monitoring and automation | `opusplan`, high | Schedules must not widen scope; mostly workflow code | `cost-reviewer`, `verifier` | Service owner |
| M11 Agency platform and advanced tenancy | `fable`, xhigh | Cross-tenant isolation | `security-reviewer`, `test-writer` | Security engineer |
| M12 Public gallery, benchmarks, tones | `opus`, xhigh | Privacy leakage and consent | `security-reviewer`, `rtl-a11y-checker` | Privacy owner, product owner |
| M13 Controlled production launch | `fable`, xhigh | Hardening, incident drills, root-cause work | `security-reviewer`, `cost-reviewer`, `verifier` | Release manager (named production gate) |

Phase 0 (manual audits) does not use Claude Code; the SEO lead runs the `marketing-seo-agent` skill in the Claude app.

## 4. Subagents

Defined in `.claude/agents/`. None of them can approve, merge, deploy or spawn other subagents (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` is 1 in `.claude/settings.json`).

Before running reviewers, the lead session saves the change as `intent/<id>/review.diff` (`git diff` against the base branch), because `security-reviewer` and `cost-reviewer` have no shell. `verifier`, `seo-method-checker` and `rtl-a11y-checker` have Bash so they can run checks; they must not modify files, and the lead session should run reviews in the default (manual) permission mode, not `acceptEdits`, so any write they attempt still prompts.

| Subagent | Model and effort | Tools | Job |
| --- | --- | --- | --- |
| `security-reviewer` | `opus`, xhigh | Read, Grep, Glob | Independent review of diffs touching fetch, redirects, auth, sessions, secrets, project isolation, connectors, exports and prompts; checks against `docs/threat-model.md` |
| `cost-reviewer` | `opus`, high | Read, Grep, Glob | Every new paid call goes through the cost guard, respects `config/budgets.yaml`, and degrades in the documented order |
| `verifier` | `sonnet`, high | Read, Grep, Glob, Bash | Runs the checks, compares behavior with `plan.md`, and reports passed, failed or not run with the commands used |
| `test-writer` | `sonnet`, high | Read, Grep, Glob, Edit, Write, Bash | Writes failing tests first; cannot edit tests while the test lock is set |
| `seo-method-checker` | `sonnet`, high | Read, Grep, Glob, Bash | Compares rule, keyword, content, performance and report output with the vendored skill and the golden files |
| `rtl-a11y-checker` | `sonnet`, high | Read, Grep, Glob, Bash | Arabic and English parity, `lang`/`dir`, bidi, keyboard, focus, contrast, reflow (WCAG 2.2 AA target) |
| `docs-registrar` | `haiku`, low | Read, Grep, Glob, Edit | Appends decisions, assumptions, open items and sources to the `docs/` registers after a milestone; never rewrites history |

## 5. Settings that implement this plan

- Project default model: `opusplan`, effort `high` (`.claude/settings.json`). Switch per milestone with `/model fable` or `/model opus` as §3 says, and raise effort with `/effort xhigh` or `/effort max` where §3 says so.
- Default permission mode: plan.
- Keep personal model preferences in `.claude/settings.local.json`, not in the shared file.
- If the organization routes Claude Code through Google Cloud, set the pinned model IDs (§1) in managed settings so every developer uses the same versions.

## 6. Cost of the build itself

Fable sessions may draw usage credits. Budget them for M0B, M1, M9, M11 and M13, where they matter most. Everything else runs on `opusplan`, `opus` or `sonnet`. This build cost is separate from the product's USD 150 monthly cap (D-005), which covers the running product only.

## 7. Review this plan

Recheck §1 before M0A and at every milestone start: model availability, aliases and plan billing change often. Record changes in `docs/decisions.md`.

## 8. Cursor model picker

Checked in this repository's Cursor session on 1 Oct 2026. Cursor has no `fable`, `opus`, `opusplan`, `sonnet`, or `haiku` alias. Those names in §1 are Claude Code values.

Pick the lead model from §2's risk table, using the strongest model the Cursor picker shows for that risk. Record the name the session actually shows in the phase report. A missing alias does not fail the milestone. Propose any substitution as an append to `docs/decisions.md`. Do not change shared settings before that append is approved.

This repository's M0A intent review ran as Grok 4.7 (D-020). `.cursor/agents/` wins when the same subagent name exists under `.claude/agents/`. This section does not change those pins.
