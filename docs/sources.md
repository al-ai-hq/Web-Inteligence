# Sources Register

Status: living register  
Owner role: Tech lead (SEO sources: SEO lead)  
Last updated: 2026-10-01

Every external fact the product or its build depends on is listed here with the date it was checked. External product and platform facts also live in `config/policy-facts.yaml` with review and expiry dates. Recheck a source before relying on it in code or client-facing guidance, and add a new row with the new date.

## Project documents

| Source                                                                     | Location                                                                                                 | Notes                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| V4 production package (8 files), reviewed 30 Sep 2026                      | Adapted into `docs/spec/01`, `03`, `04`, `05`, `07`, `08`, `09`; originals are kept in the parent folder | Product authority (D-001)                                                       |
| Detailed PRD, build prompt, build plan and reference library (30 Sep 2026) | Adapted into `docs/spec/02`, `04` appendices, `05` §12-§17, `08`                                         | Implementation detail                                                           |
| v1 baseline PRD                                                            | `docs/spec/v1-baseline/aeo-geo-seo-audit-prd.md`                                                         | Rule catalog, scoring formulas, prompt set, privacy baseline, retention, budget |
| Competitor review (SavageAudit), late Sep 2026                             | `docs/spec/10-COMPETITOR-REVIEW.md`                                                                      | Feature patterns only; no copying of branding, personas or copy                 |
| marketing-seo-agent skill, fixed 30 Sep 2026                               | `.claude/skills/marketing-seo-agent/`                                                                    | Method reference; scripts are reference implementations (D-009)                 |
| The AI-Native SDLC Playbook (Anthropic), supplied by the owner             | Not included in this folder                                                                              | Basis for 05 §12                                                                |

## Claude Code documentation (checked 30 Sep 2026)

| Page                                                                                                                                | Used for                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Model configuration](https://code.claude.com/docs/en/model-config)                                                                 | Aliases (`fable`, `opus`, `opusplan`, `sonnet`, `haiku`, `best`), effort levels, pinning model IDs, Fable requirements |
| [What's new, week 36](https://code.claude.com/docs/en/whats-new/2026-w36)                                                           | Claude Fable 5.1 availability in Claude Code (v2.1.257+); project `bypassPermissions` no longer takes effect           |
| [Sub-agents](https://code.claude.com/docs/en/sub-agents)                                                                            | Frontmatter fields for `.claude/agents/*.md`; spawn depth                                                              |
| [Settings](https://code.claude.com/docs/en/settings) and [example settings files](https://code.claude.com/docs/en/settings-example) | `.claude/settings.json` structure, permissions, sandbox, precedence                                                    |
| [Hooks](https://code.claude.com/docs/en/hooks)                                                                                      | Hook registration, PreToolUse input, blocking with exit code 2                                                         |

## Search, platform and standards sources

The full list of Google Search, Google Cloud, search-data, connector, standards and provider references, with checked dates, is in `docs/spec/08-REFERENCE-LIBRARY.md` ("Sources checked" section). Facts from those pages that the product relies on are in `config/policy-facts.yaml`.

## M0A toolchain dependency versions (chosen 2026-10-01)

| Package             | Version  | Notes                                                                          |
| ------------------- | -------- | ------------------------------------------------------------------------------ |
| pnpm                | 9.12.0   | `packageManager` field in root `package.json`; committed lockfile              |
| Node.js             | >=22.0.0 | LTS per D-021; `.nvmrc` pins `22`; CI reads from `.nvmrc`                      |
| TypeScript          | ~5.6.0   | Strict mode; `tsconfig.base.json` shared across workspace                      |
| ESLint              | ^9.14.0  | Flat config (`eslint.config.mjs`) with `typescript-eslint` strict type-checked |
| `@eslint/js`        | ^9.14.0  | Core rules                                                                     |
| `typescript-eslint` | ^8.15.0  | Strict type-checked config                                                     |
| Prettier            | ^3.3.0   | `.prettierrc.json`; format hook assumes Prettier                               |
| Vitest              | ^2.1.0   | Unit tests; workspace projects in `vitest.config.ts`                           |
| `@playwright/test`  | ^1.48.0  | Browser and SSRF-adjacent tests; `playwright.config.ts`                        |
| Next.js             | ^15.1.0  | `apps/web`; React 19                                                           |
| React               | ^19.0.0  | `apps/web`                                                                     |
| Python (CI)         | 3.12     | Governance checks in CI; local dev uses 3.14 with venv                         |
