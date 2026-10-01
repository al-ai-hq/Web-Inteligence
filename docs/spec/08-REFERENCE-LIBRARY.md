# Website Presence Intelligence V4 — Reference Library for Claude Code

This is a candidate-source register derived from the reviewed reference library. It is not independent proof that any linked fact remains current. Claude Code must re-open the applicable primary source at implementation time, record the checked date and relevant version in `docs/sources.md`, and store time-sensitive facts in the policy-fact registry. V4 product decisions and security controls take precedence.

Links were last checked 29–30 Sep 2026 and must be rechecked at implementation.

V5 adaptation status: draft for review. Every edit to the V4 text is listed in "Changes from V4" at the end.

## Files to prepare

| File | Contents | Owner |
| --- | --- | --- |
| `docs/spec/v1-baseline/aeo-geo-seo-audit-prd.md` (v1) | Baseline rule catalog, scoring, LLM tests, privacy, retention, security | Product |
| `docs/spec/01-PRODUCT-REQUIREMENTS.md`, `02-DETAILED-SPECIFICATION.md`, `03-PRODUCTION-CONTRACTS.md`, `04-CLAUDE-CODE-BUILD-PROMPT.md`, `05-PROJECT-PLAN.md`, `06-MODEL-PLAN.md`, `07-SKILLS-AND-AGENTS.md`, `08-REFERENCE-LIBRARY.md`, `09-MERGE-DECISIONS.md`, `10-COMPETITOR-REVIEW.md` | Product authority, implementation detail, typed contracts, Claude Code build contract, delivery plan, model plan, skills and agents, this reference library, merge decisions, and competitor review | Product |
| `.claude/skills/marketing-seo-agent/` (vendored) | The version fixed on 30 Sep 2026. SEO method references; scripts used as reference implementations and golden-file generators; IBM Plex Sans Arabic font with its OFL licence | SEO lead |
| `brand-fact-sheet.json` per client | Legal name, aliases, logo, official profiles, address, contact, approved claims with evidence links | Client |
| `brand-terms.csv` per client | Arabic and English brand names, misspellings and transliterations for the brand vs non-brand split | Client and SEO lead |
| `style-guide-ar.md`, `style-guide-en.md` | Register, terminology, forbidden phrases, brand voice | Client and localization reviewer |
| `keyword-upload.schema.json` and `keywords-template.csv` | CSV columns and rules from 02-DETAILED-SPECIFICATION §7 | SEO and content strategist |
| `freshness.yaml` | Maximum data age per type | Data engineer |
| `crawler-registry.yaml` | Crawler token, operator, purpose, doc URL, last checked | SEO lead |
| `providers.yaml` | Provider, access route, model ID, region, price-table version, search limits | AI engineer |
| `rules/*.yaml` and rubrics | Rule ID, weight, applicability, pass, partial and fail tests, rubrics for assessed rules | SEO lead |
| `schema-requirements.yaml` | Google-supported types with required and recommended properties | SEO lead |
| `connectors/*.yaml` | Allowed fields, limits, publish rules and webhook secret references per CMS | Integration engineer |
| `content-brief.template.md` | Brief fields and draft gates from 02 §9 | SEO and content strategist |
| Prompt templates (ar, en) | Free-tier visibility prompts and the connected prompt panel in six categories per market and language. Sizes are configurable (D-006). Defaults (ASSUMPTION): free tier 8 prompts × configured providers × 1 run, shown as counts; connected panel 20–40 prompts × 3 runs; scope shrinks under budget pressure. Sizes in `config/prompt-panels/*.yaml`; anonymous audit scope in `config/anonymous-eligibility.yaml` | SEO lead |
| Labelled evaluation set | Sites across CMS types and both languages, with expected results from the Phase 0 manual audits (05-PROJECT-PLAN, Phase 0) | SEO lead |
| `threat-model.md` | Assets, trust boundaries, abuse cases, mitigations | Security |
| Privacy policy, terms, DPA, subprocessor list | Legal texts per market | Counsel |
| `runbooks/` | Deploy, rollback, incident, provider outage, key rotation, deletion | Platform |

## Google Search guidance

| Reference | Use it for |
| --- | --- |
| [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) | Eligibility, controls, measurement for AI Overviews and AI Mode |
| [Optimizing for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) | What helps and what to ignore (llms.txt, chunking, inauthentic mentions) |
| [New controls for website owners](https://blog.google/products-and-platforms/products/search/new-controls-website-owners/) | Search Console AI-features setting, rolled out worldwide 31 Aug 2026 |
| [Generative AI performance reports](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) | GSC-003 data |
| [Search Essentials](https://developers.google.com/search/docs/essentials) | Technical requirements and key practices |
| [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | SPAM-001 and the forbidden list |
| [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Content rubrics |
| [Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) | Rules for drafted copy |
| [Third-party SEO advice](https://developers.google.com/search/docs/fundamentals/third-party-seo) | Screening GEO claims |
| [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | On-page baseline |
| [Structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) and [feature gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) | STR rules and `schema-requirements.yaml` |
| [FAQPage structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage) | FAQ rich results stopped appearing on 7 May 2026; the Planner never promises them |
| [Robots meta tag and X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) | Snippet and indexing controls |
| [Google's robots.txt interpretation](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec) | CRW-004 |
| [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) | Google-Extended entry in the registry |
| [Google-Agent](https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) | Registry entry; user-triggered, generally ignores robots.txt |
| [Localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions) | I18N-003 |
| [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) | Renderer fallback, DEL-001 |
| [Agent-friendly websites (web.dev)](https://web.dev/articles/ai-agent-site-ux) | AGT-001 |
| [WebMCP (Chrome)](https://developer.chrome.com/docs/ai/webmcp) | AGT-002; origin trial from Chrome 149 |
| [Lighthouse agentic browsing](https://developer.chrome.com/docs/lighthouse/agentic-browsing) | AGT-002; needs Chrome 150 |
| [Google Search Status Dashboard](https://status.search.google.com/) | Dating ranking updates in performance diagnosis |

## Google Cloud platform

| Reference | Use it for |
| --- | --- |
| [Introducing Gemini Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform) | Product naming and scope |
| [Agent Platform documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform) | Models, grounding, embeddings, evaluation, security controls |
| [Model versions and lifecycle](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) | Choosing model IDs; retirement dates |
| [Grounding with Google Search](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search) | Gemini visibility tests; display terms |
| [Claude web search on Agent Platform](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/web-search) | Claude tests; org policy |
| [Model Armor integrations](https://docs.cloud.google.com/model-armor/integrations) | Guardrail design and limits |
| [Agent Development Kit](https://google.github.io/adk-docs/) | Agents, tools, evaluation |
| [Next.js documentation](https://nextjs.org/docs) | Web app and API |
| [Cloud Run](https://cloud.google.com/run/docs) | Services and jobs |
| [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres) | Application database |
| [Workflows](https://cloud.google.com/workflows/docs) and [Cloud Tasks](https://cloud.google.com/tasks/docs) | Orchestration and throttling |
| [Identity-Aware Proxy](https://cloud.google.com/iap/docs) | Admin routes |
| [Secret Manager](https://cloud.google.com/secret-manager/docs) | Tokens and keys |
| [Cloud Armor](https://cloud.google.com/armor/docs) | WAF and rate limits |
| [Billing budgets](https://cloud.google.com/billing/docs/how-to/budgets) | Alerts feeding the cost guard |
| [Secure AI Framework (SAIF)](https://saif.google) | AI security review |

## Search data APIs

| Reference | Use it for |
| --- | --- |
| [Search Console API](https://developers.google.com/webmaster-tools) | Performance, sitemaps, URL Inspection |
| [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) | Query and position data for keyword intelligence |
| [Search Console data access and limits](https://support.google.com/webmasters/answer/12919192) | 50,000 rows per day per type per property |
| [Generative AI performance report (Search)](https://support.google.com/webmasters/answer/16984139) | GSC-003 export contents |
| [URL Inspection API quotas](https://developers.google.com/search/blog/2022/01/url-inspection-api) | GSC-001 sampling |
| [Google Ads API: Keyword Planning](https://developers.google.com/google-ads/api/docs/keyword-planning/overview) and [historical metrics](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics) | Optional search-volume source; caching |
| [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started) | Lab data |
| [CrUX API](https://developer.chrome.com/docs/crux/api) | Field data |
| [Web Vitals](https://web.dev/articles/vitals) | Thresholds and definitions |
| [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) | Organic and AI-assistant referral sessions for the performance analyst |

## Connector APIs

| Reference | Use it for |
| --- | --- |
| [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/) | WordPress connector |
| [Webflow: Update Page Metadata](https://developers.webflow.com/data/reference/pages-and-components/pages/update-page-settings) | Webflow page SEO fields |
| [Shopify REST Admin API notice](https://shopify.dev/docs/api/admin-rest) and [Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql) | Shopify connector |
| [Wix REST API](https://dev.wix.com/docs/rest) | Coverage check before building |
| [Contentful webhooks](https://www.contentful.com/developers/docs/concepts/webhooks/) and [Sanity webhooks](https://www.sanity.io/docs/webhooks) | Headless CMS change detection; verify signing options at build |
| [GitHub Apps](https://docs.github.com/en/apps) | Pull-request path |
| [IndexNow](https://www.indexnow.org/documentation) | Optional change notifications |

## Keyword data and MCP

| Reference | Use it for |
| --- | --- |
| [Ahrefs API documentation](https://docs.ahrefs.com/) | Optional licensed keyword and rank data |
| [Semrush API documentation](https://developer.semrush.com/api/) | Optional licensed keyword and competitor data |
| [Model Context Protocol](https://modelcontextprotocol.io) | MCP servers used during build and calibration |

## Build process (AI-native SDLC)

| Reference | Use it for |
| --- | --- |
| [Claude Code admin setup](https://code.claude.com/docs/en/admin-setup) | Organization decisions for the build team |
| [Settings reference](https://code.claude.com/docs/en/settings) | Managed settings and permissions |
| [Hooks guide](https://code.claude.com/docs/en/hooks-guide) | Build guardrails and approval gates |
| [Skills](https://code.claude.com/docs/en/skills) | Policy encoded as versioned skills |
| [Sandboxing](https://code.claude.com/docs/en/sandboxing) | Isolated agent execution |
| [Monitoring (OpenTelemetry)](https://code.claude.com/docs/en/monitoring-usage) | Session and gate metrics |
| [Enterprise deployment via Vertex](https://code.claude.com/docs/en/third-party-integrations) | Routing Claude Code through Google Cloud |

## Standards and security

| Reference | Use it for |
| --- | --- |
| [RFC 9309 Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309) | robots.txt parsing |
| [Sitemaps protocol](https://www.sitemaps.org/protocol.html) | CRW-005 |
| [Schema.org](https://schema.org) | Type and property definitions |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | App target and A11Y rules |
| [W3C: HTML dir attribute](https://www.w3.org/International/questions/qa-html-dir) | Arabic RTL rules |
| [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Crawler isolation |
| [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) | Injection and excessive-agency threats |
| [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) | Governance review |

## LLM providers and AI crawlers

| Reference | Use it for |
| --- | --- |
| [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search) | OpenAI adapter |
| [OpenAI crawlers](https://platform.openai.com/docs/bots) | Registry entries |
| [Anthropic web search tool](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool) | Claude adapter details |
| [Perplexity API](https://docs.perplexity.ai/) | Perplexity adapter |
| [xAI citations](https://docs.x.ai/developers/tools/citations) | Grok adapter |
| [llms.txt proposal](https://llmstxt.org) | Optional file for non-Google systems |
| [GEO: Generative Engine Optimization (arXiv)](https://arxiv.org/abs/2311.09735) | Research background; treat findings as hypotheses to test |

Crawler pages for Anthropic, Perplexity, Apple and Common Crawl change often; confirm each current URL when seeding the registry.

## Latest marketing SEO reference modules

These r2 references are NOT in this repository yet. Open item: add the r2 skill snapshot (`marketing-seo-agent-2026-09-30-r2`). The vendored fixed skill is at `.claude/skills/marketing-seo-agent/` and does not contain the files below. Until the snapshot is added, 01 §17 and 09-MERGE-DECISIONS ("Post-V4 reference expansion") are the only in-repository statements of these requirements.

- `references/site-architecture.md`: evidence-linked page maps, hierarchy, URLs, navigation and internal links.
- `references/backlinks.md`: source-separated link analysis and conservative disavow boundaries.
- `references/comparison-pages.md`: fair, sourced comparison and alternatives pages.
- `references/programmatic-seo.md`: unique-value, data-quality, sampling and batch controls.
- `references/change-monitoring.md`: known-good baselines and regression review.
- `scripts/crawl_diff.py`: reference implementation and fixture source only.

## Skills already in your Claude workspace

The supplied `marketing-seo-agent` skill is the method reference (02 §13). These others can serve as checklists while writing rules and fixtures: seo-technical, seo-schema, seo-hreflang, seo-sitemap, seo-content, seo-geo, seo-google, answer-engine-optimization, geo-optimization, searchfit-seo:ai-visibility. Where one conflicts with Google's guidance above, Google's guidance wins.

## Sources checked for 02-DETAILED-SPECIFICATION

- [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features), updated 10 Dec 2025
- [Optimizing for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), updated 10 Jul 2026
- [New controls for website owners](https://blog.google/products-and-platforms/products/search/new-controls-website-owners/), updated 31 Aug 2026
- [Generative AI performance report (Search)](https://support.google.com/webmasters/answer/16984139), checked 29 Sep 2026
- [Search Console data access and limits](https://support.google.com/webmasters/answer/12919192), checked 29 Sep 2026
- Independent check that the generative AI report is not in the Search Analytics API ([Cogny](https://cogny.com/blog/google-search-console-generative-ai-performance-report)), checked 29 Sep 2026
- [Google Ads API: Keyword Planning](https://developers.google.com/google-ads/api/docs/keyword-planning/overview), checked 29 Sep 2026
- [Introducing Gemini Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform)
- [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes)
- [Grounding with Google Search](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search)
- [Claude web search on Agent Platform](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/web-search)
- [Model Armor integrations](https://docs.cloud.google.com/model-armor/integrations), updated 24 Sep 2026
- [URL Inspection API announcement](https://developers.google.com/search/blog/2022/01/url-inspection-api)
- [Shopify REST Admin API reference](https://shopify.dev/docs/api/admin-rest)
- [Webflow Update Page Metadata](https://developers.webflow.com/data/reference/pages-and-components/pages/update-page-settings)
- SavageAudit public pages, a public report and the pricing page, checked late September 2026 (see 10-COMPETITOR-REVIEW.md)
- The AI-Native SDLC Playbook (Anthropic, supplied by the product owner) for the build plan
- The `marketing-seo-agent` skill (supplied by the product owner), reviewed and fixed 30 Sep 2026
- [FAQPage structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage): FAQ rich results stopped appearing on 7 May 2026, checked 30 Sep 2026
- [Google-Agent](https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent), checked 30 Sep 2026
- [WebMCP](https://developer.chrome.com/docs/ai/webmcp) and [Lighthouse agentic browsing](https://developer.chrome.com/docs/lighthouse/agentic-browsing), checked 30 Sep 2026
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1), updated 24 Sep 2026
- [Google Search Status Dashboard](https://status.search.google.com/), checked 30 Sep 2026

## Changes from V4

Source: V4 `REFERENCE_LIBRARY_V4_CLAUDE_CODE.md`. No external link was added or removed. All text not listed below is unchanged. Old companion file names are written here without their `.md` extension, so a search for leftover references finds only live ones.

| # | Where | Change | Reason |
| --- | --- | --- | --- |
| 1 | Intro | Added "Links were last checked 29–30 Sep 2026 and must be rechecked at implementation." | Source freshness |
| 2 | Intro | Added the line "V5 adaptation status: draft for review" | Writing rules: mark unreviewed edits |
| 3 | Files to prepare, v1 row | "`aeo-geo-seo-audit-prd.md` (v1)" → "`docs/spec/v1-baseline/aeo-geo-seo-audit-prd.md` (v1)" | Repository paths |
| 4 | Files to prepare, V4 row | The five V4 package file names → the `docs/spec/` files 01 to 10; contents column extended to match | Repository paths |
| 5 | Files to prepare, skill row | "`marketing-seo-agent.skill`" → "`.claude/skills/marketing-seo-agent/` (vendored)" | Repository paths |
| 6 | Files to prepare, keyword row | "CSV columns and rules from PRD §7" → "… from 02-DETAILED-SPECIFICATION §7" | Repository paths |
| 7 | Files to prepare, brief row | "Brief fields and draft gates from PRD §9" → "… from 02 §9" | Repository paths |
| 8 | Files to prepare, prompt row | "The 8 free-tier visibility prompts, and the 20–40 prompt panel …" → sizes configurable; defaults 8 × configured providers × 1 (counts) and 20–40 × 3 (ASSUMPTION); shrink under budget pressure; `config/prompt-panels/*.yaml` and `config/anonymous-eligibility.yaml` | D-006 |
| 9 | Files to prepare, evaluation row | "(`BUILD-PLAN`)" → "(05-PROJECT-PLAN, Phase 0)" | Repository paths |
| 10 | Latest marketing SEO reference modules | The `shared/upstream/marketing-seo-agent-2026-09-30-r2/…` paths → a statement that these r2 references are not in this repository yet (open item: add the r2 snapshot), the vendored skill location, and the same six module names and descriptions without the missing path prefix | Files not present |
| 11 | Skills already in your Claude workspace | "(PRD §13)" → "(02 §13)" | Repository paths |
| 12 | Sources heading | "Sources checked for this PRD" → "Sources checked for 02-DETAILED-SPECIFICATION" | Repository paths |
| 13 | Sources checked | "(see `COMPETITOR-REVIEW`)" → "(see 10-COMPETITOR-REVIEW.md)" | Repository paths |
| 14 | Sources checked | "supplied by you" → "supplied by the product owner" (2 places) | No chat references |
| 15 | New section | Added this "Changes from V4" list | Traceability |
