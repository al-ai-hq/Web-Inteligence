# Sources Register

Status: living register  
Owner role: Tech lead (SEO sources: SEO lead)  
Last updated: 2026-09-30

Every external fact the product or its build depends on is listed here with the date it was checked. External product and platform facts also live in `config/policy-facts.yaml` with review and expiry dates. Recheck a source before relying on it in code or client-facing guidance, and add a new row with the new date.

## Project documents

| Source | Location | Notes |
| --- | --- | --- |
| V4 production package (8 files), reviewed 30 Sep 2026 | Adapted into `docs/spec/01`, `03`, `04`, `05`, `07`, `08`, `09`; originals are kept in the parent folder | Product authority (D-001) |
| Detailed PRD, build prompt, build plan and reference library (30 Sep 2026) | Adapted into `docs/spec/02`, `04` appendices, `05` §12-§17, `08` | Implementation detail |
| v1 baseline PRD | `docs/spec/v1-baseline/aeo-geo-seo-audit-prd.md` | Rule catalog, scoring formulas, prompt set, privacy baseline, retention, budget |
| Competitor review (SavageAudit), late Sep 2026 | `docs/spec/10-COMPETITOR-REVIEW.md` | Feature patterns only; no copying of branding, personas or copy |
| marketing-seo-agent skill, fixed 30 Sep 2026 | `.claude/skills/marketing-seo-agent/` | Method reference; scripts are reference implementations (D-009) |
| The AI-Native SDLC Playbook (Anthropic), supplied by the owner | Not included in this folder | Basis for 05 §12 |

## Claude Code documentation (checked 30 Sep 2026)

| Page | Used for |
| --- | --- |
| [Model configuration](https://code.claude.com/docs/en/model-config) | Aliases (`fable`, `opus`, `opusplan`, `sonnet`, `haiku`, `best`), effort levels, pinning model IDs, Fable requirements |
| [What's new, week 36](https://code.claude.com/docs/en/whats-new/2026-w36) | Claude Fable 5.1 availability in Claude Code (v2.1.257+); project `bypassPermissions` no longer takes effect |
| [Sub-agents](https://code.claude.com/docs/en/sub-agents) | Frontmatter fields for `.claude/agents/*.md`; spawn depth |
| [Settings](https://code.claude.com/docs/en/settings) and [example settings files](https://code.claude.com/docs/en/settings-example) | `.claude/settings.json` structure, permissions, sandbox, precedence |
| [Hooks](https://code.claude.com/docs/en/hooks) | Hook registration, PreToolUse input, blocking with exit code 2 |

## GitHub Actions pins (checked 1 Oct 2026)

Resolved with `gh api repos/<owner>/<repo>/commits/<tag>` on 2026-10-01. Each SHA is the commit the tag pointed at that day.

| Action | Tag | Commit |
| --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout/commit/11d5960a326750d5838078e36cf38b85af677262) | v4 | `11d5960a326750d5838078e36cf38b85af677262` |
| [actions/setup-python](https://github.com/actions/setup-python/commit/a26af69be951a213d495a4c3e4e4022e16d87065) | v5 | `a26af69be951a213d495a4c3e4e4022e16d87065` |
| [actions/setup-node](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020) | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| [pnpm/action-setup](https://github.com/pnpm/action-setup/commit/b906affcce14559ad1aafd4ab0e942779e9f58b1) | v4 | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |
| [gitleaks/gitleaks-action](https://github.com/gitleaks/gitleaks-action/commit/ff98106e4c7b2bc287b24eaf42907196329070c7) | v2 | `ff98106e4c7b2bc287b24eaf42907196329070c7` |

## Search, platform and standards sources

The full list of Google Search, Google Cloud, search-data, connector, standards and provider references, with checked dates, is in `docs/spec/08-REFERENCE-LIBRARY.md` ("Sources checked" section). Facts from those pages that the product relies on are in `config/policy-facts.yaml`.
