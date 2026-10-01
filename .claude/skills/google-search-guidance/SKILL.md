---
name: google-search-guidance
description: Applies current Google Search guidance, the repository precedence rules and decision D-009. Use when writing or reviewing audit rules, crawler registry entries, planner actions, briefs, report wording or structured-data advice.
---

# Google Search guidance (policy skill)

Status: draft for review. Version 0.1.0. Owner: SEO lead `<DECIDE_AT_M0: name>`. The owner signs off every change to this skill.

## When to use

- Adding or changing a rule in `config/rules/*.yaml`, a rubric, or the crawler registry.
- Planner, content-brief or report features that explain Google behavior to users.
- Any spec that mentions AI Overviews, AI Mode, llms.txt, FAQ markup, snippets, Google-Extended, Search Console or Autocomplete.

## Precedence

1. Authority order (01-PRODUCT-REQUIREMENTS §15): law, provider terms and security; V4 PRD; approved decisions (`docs/decisions.md`); current primary documentation; standards; versioned registries; client-confirmed data; observed evidence; advisory sources.
2. For Google Search, Google's own guidance beats advisory material. For other assistants, advisory tactics run as labelled experiments (02-DETAILED-SPECIFICATION §3).
3. Grade every external source (04-CLAUDE-CODE-BUILD-PROMPT §4): `source_tier` 1 = primary documentation or open standard; 2 = independent study with published method and sample; 3 = vendor claim, usable only as a hypothesis. Ten articles quoting one study count as one source.
4. A registry entry that contradicts current docs is marked "needs review"; never merge conflicts silently (02 §3).

## Google positions to apply

Each of these is a time-sensitive policy fact. Store it in the policy-fact registry (`config/policy-facts.yaml`) with primary source, checked date, owner, review date and expiry, and reverify before release (04 §23; 01 §15 "Policy and data model additions"). Links are in `docs/spec/08-REFERENCE-LIBRARY.md`.

- **AI features are still SEO.** Google's AI optimization guide says optimizing for its generative AI search is SEO, and that llms.txt, special markup and "chunking" are not needed (02 §1; `.claude/skills/marketing-seo-agent/references/ai-search-aeo-geo.md`).
  - AEO-009 is reader-first organization with no chunking requirement (02 §6).
  - GEO-010: llms.txt is reported, unscored (weight 0). A published file that points to dead pages is flagged.
  - Answer-first writing is presented as good writing, never as a Google tactic (02 §9).
- **Snippet eligibility.** A page must be indexed and eligible for a snippet to appear as a link in AI features; `nosnippet` and restrictive `max-snippet` limit this (CRW-012, 02 §6).
- **Crawler controls.** Google controls AI features in Search through Googlebot rules and snippet controls. Google-Extended governs training and grounding in other Google systems, is a control token with no user agent, and never appears in logs. Google-Agent is user-triggered and generally ignores robots.txt (02 §6 "AI crawler registry").
  - Blocking a training bot is a business choice: report it, do not fail it (CRW-010).
  - When low Gemini visibility coincides with a Google-Extended block, the report names that cause (02 §6).
- **Search Console.** The AI-features setting (GSC-002) is `attested` when no API can read it. The generative AI performance report is a UI export, observational and unscored (GSC-003); it has impressions only, so never compute a CTR from it (02 §6). URL Inspection quotas and the Search Analytics row limit are configuration, not constants (D-010).
- **Structured data.** Recommend only markup that matches visible, verified content (04 §12). FAQ rich results stopped appearing in Google Search on 7 May 2026 and HowTo was deprecated earlier; existing FAQPage markup is harmless but is not a lever. Never promise a rich result (02 §8).
- **Spam policies.** No scaled or templated thin pages, doorway patterns, hidden text, cloaking, link schemes or fabricated review markup. SPAM-001 is a Critical flag (ASSUMPTION from 02 §6: overall cap 50, pending calibration). Never plan one page per query variant or fan-out query (02 §8). Location pages need unique content (skill `references/arabic-market-seo.md`).
- **Indexing API.** Not used; it covers only job-posting and livestream pages (02 §10).
- **Recrawl timing.** Google may take days to months to recrawl, so reports separate "live on site" from "seen by Google" (02 §10).

## Data policy (D-009)

- The product never calls Google Autocomplete and never scrapes Google result pages (02 §7, §20). Autocomplete shows that a phrasing exists, not its volume; analysts may use it by hand only.
- Competitor positions come only from a licensed provider with a data licence (02 §7, §14).
- Only the product's sandboxed crawler fetches in production. The skill's `suggest.py` and `page_audit.py` fetchers stay manual research tools.

## Claims the product never makes

- No ranking, traffic, citation or recommendation guarantee or forecast. Use wording such as "improves the likelihood of being cited" (01 §4; 04 §2).
- Readiness checks never support a claim about presence in AI answers (D-012; 02 §6).
- Other assistants are measured, not assumed to behave like Google. Tactics without published support are labelled "hypothesis" (02 §8).

## Checklist for a change

1. Which Google position above does the change rely on? Is it in the policy-fact registry with a checked date that has not expired?
2. Is every new source graded, with tier 3 used only as a hypothesis?
3. Does any output promise a rich result, ranking or citation? Remove it.
4. Does any rule score llms.txt, require FAQ blocks or reward chunked content? Remove it.
5. Does any code call Autocomplete or a result page, or import the skill's scripts? The `forbidden_endpoints.py` hook blocks it; fix the design.
6. Record areas of concern in `spec.md` for the SEO lead.

## Backed by

- Hook: `.claude/hooks/forbidden_endpoints.py`.
- Golden files and product-agent evals: `evals/golden/`, `evals/product-agent/`.
- Method references: `.claude/skills/marketing-seo-agent/references/site-audit.md`, `ai-search-aeo-geo.md`, `content-briefs.md`.
