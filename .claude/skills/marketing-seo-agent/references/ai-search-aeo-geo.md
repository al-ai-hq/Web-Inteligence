# AI search visibility: AEO, GEO and agent readiness

This reference covers three related jobs. Measure and report each one separately:

- **AEO (answer engine optimization):** being the answer or a cited source in answer surfaces such as Google AI Overviews, AI Mode, featured snippets and assistants.
- **GEO (generative engine optimization):** being mentioned, cited or recommended by generative engines such as ChatGPT, Gemini, Perplexity, Copilot and Claude.
- **Agent readiness:** AI browsing agents can complete a task on the site, such as booking, ordering or sending an enquiry.

Ordinary SEO is the base layer for all three. Google's AI features draw on Google's index, and Copilot draws on Bing's. ChatGPT, Perplexity and Claude run their own crawlers and search indexes. A page that can't be crawled, indexed or read won't be cited, however well it's written.

**For Google specifically, AEO/GEO is SEO.** Google's AI optimization guide (Search Central, last updated 10 July 2026) says three things:
- optimizing for its generative AI search "is optimizing for the search experience, and thus still SEO";
- you don't need llms.txt, special markup or Markdown files;
- you don't need to break content into small chunks or write in a special way for AI.

So never sell "chunking" or AI-only rewrites as a Google tactic. The answer-first habits in this skill are good writing for readers and for other engines, not a Google trick.

## Evidence discipline (read first)

This field changes monthly and is full of vendor claims. Grade every source you rely on:

| Tier | Source | How to use it |
|---|---|---|
| 1 | Primary platform docs: Google Search Central (including its AI optimization guide), Bing Webmaster, OpenAI / Anthropic / Perplexity crawler docs, Chrome for Developers | Can support a recommendation. Cite it with its date. |
| 2 | Independent studies that publish their method and sample | Can support a recommendation. State the sample and period. |
| 3 | Vendor blogs, tool marketing, "we saw X% lift" posts | A hypothesis to test, never a fact. Say so. |

- **Trace statistics to their origin.** Ten articles quoting one vendor study are still one data point.
- **Don't promise outcomes.** AI answers are non-deterministic and models change. Write "improves the likelihood of being cited", never "will get cited", and never attach a projected citation or traffic lift.
- **Separate what you observed from what you think.** Observed presence (layer 5) and readiness (layers 1–4) are different kinds of evidence. Never infer one from the other.

## The five layers

Work through the layers in order, because a failure in an early layer makes later work pointless. Record each check in the scorecard as *Pass*, *Partial*, *Fail* or *Not checked*, with its evidence.

### 1. Access: can AI systems reach the content?

- **robots.txt, per crawler.** `page_audit.py` applies the robots.txt rules (RFC 9309 matching) to every crawled URL, not just the homepage. Each vendor documents different behavior, so describe the effect of blocking vendor by vendor. Blocking a training crawler is a legitimate business choice. Blocking a search crawler reduces or removes the site from that engine's answers. Present both as decisions for the user, not errors.

  | Operator | Crawler or token | Used for | robots.txt | Effect of blocking |
  |---|---|---|---|---|
  | Google | `Googlebot` | Search, including AI Overviews and AI Mode | Followed | Removes the page from Search and its AI features |
  | Google | `Google-Extended` (token only) | Gemini training, and grounding in Gemini Apps and Vertex AI | Followed | No effect on Google Search; may reduce use in Gemini answers |
  | Google | `Google-Agent` | Agents on Google infrastructure acting for a user | Generally ignored (user-requested) | Little; handle agent traffic at the server if needed |
  | Microsoft | `Bingbot` | Bing, which Copilot draws on | Followed | Removes the site from Bing and weakens Copilot visibility |
  | OpenAI | `OAI-SearchBot` | ChatGPT search | Followed | Not shown in ChatGPT search answers, though it can still appear as a navigational link |
  | OpenAI | `ChatGPT-User` | Actions a user asks ChatGPT to take | "May not apply"; not used for search inclusion | Limited |
  | OpenAI | `GPTBot` | Model training | Followed | Training only |
  | Anthropic | `Claude-SearchBot` | Search indexing | Followed | May reduce visibility in Claude's search results |
  | Anthropic | `Claude-User` | Fetches when a user asks | Followed | May reduce visibility for user-directed searches |
  | Anthropic | `ClaudeBot` | Model training | Followed | Training only; doesn't stop the other two |
  | Perplexity | `PerplexityBot` | Perplexity search results (not training) | Followed | Reduces appearance in Perplexity results |
  | Perplexity | `Perplexity-User` | Fetches when a user asks | Generally ignored (user-requested) | Limited |
  | Others | `Applebot-Extended` (token only), `CCBot`, `Bytespider`, `meta-externalagent` | Training / datasets | Varies | Training only |

  Recheck the vendors' crawler pages before quoting this table, because these details change. Control tokens such as `Google-Extended` and `Applebot-Extended` have no user agent of their own, so they never appear in logs.
- **What the server actually returns.** robots.txt is only a request. CDNs and firewalls can block AI bots whatever robots.txt says, and some CDNs offer one-click or default AI-bot blocking. Run `page_audit.py <url> --compare-agents` on a handful of key URLs to fetch them as a browser, Googlebot, Bingbot and the main AI crawlers, then compare the status, title, language, word count and structured data each one gets. Keep it to a few URLs. If a site blocks you, record the result; never retry with tricks to get around the block. A 403, a challenge page or much thinner content for one agent is a finding. Label it *Inferred*: CDNs may verify real bots by IP, so a test with a spoofed user agent can differ from what the real crawler sees. Confirm in CDN or server logs, or in the CDN's bot settings.
- **Crawl logs.** If the user provides server or CDN logs, count requests and status codes per AI crawler for key URLs. That shows what bots actually receive. Verify real bots against the vendors' published IP ranges, since user agents can be faked.
- **Index eligibility.** Google says a page must be indexed and eligible to show with a snippet to appear as a link in its AI features. `noindex`, `nosnippet` and restrictive `max-snippet` values limit this.
- **Search Console inclusion setting.** A site must also be included in "Search generative AI features" in Search Console to be eligible for Google's generative AI features. Ask the user to confirm this setting; you can't see it without access.
- **Bing.** For Copilot, check Bing indexing (Bing Webmaster Tools, if the user has it).

### 2. Parse: can they read and extract it?

- **Content is in the HTML a non-rendering bot receives.** Many AI crawlers render little or no JavaScript. `--compare-agents` shows when only Googlebot gets full content, for example through a Googlebot-only prerender. That's a common, high-impact finding.
- **Answers are extractable.** Put a direct answer near the top of each section. Use clear question-style headings. State facts in text (prices, hours, delivery areas, specs), not only in images or PDFs, and put comparisons in real HTML tables.
- **Length.** No platform has published a "token budget". Long pages aren't penalized as such, but an answer buried deep in a long page is harder to extract. Treat length as a readability judgment, not a hard limit.
- **Structured data.** Use `Organization` or `LocalBusiness` with `sameAs`, `Product` / `Offer`, `Article` with author, and `BreadcrumbList`. Every value must match the visible content. `FAQPage` no longer produces Google rich results (as of May 2026). It's harmless, but don't present it as a citation lever.
- **Language.** Use one language per URL, correct `lang` and `dir`, and reciprocal hreflang. Engines pick sources per language, so Arabic answers need Arabic pages.
- **llms.txt.** This is an optional convention. Google has said it doesn't use llms.txt for Search, including AI features, and no major answer engine has confirmed using it to choose citations. Chrome Lighthouse's Agentic browsing category does check for it. Rate it low priority and cheap. If the site publishes one, it must be kept current, because a stale file points agents at dead pages.

### 3. Act: can agents complete tasks? (only for sites with key task flows)

- **Audit tasks, not pages.** List the 3–5 tasks that matter: book, order, request a quote, contact. Check each flow for patterns that stop agents:
  - custom widgets (date pickers, dropdowns) with no native input underneath;
  - fields with placeholder text but no label;
  - a CAPTCHA before any value is delivered;
  - forced account creation;
  - file upload in the critical path;
  - large layout shifts.
- **WebMCP.** This lets a page declare its tools to AI agents. As of September 2026 it's in a Chrome origin trial (from Chrome 149) and subject to change, so check the current Chrome docs before recommending it.
  - **Declarative API:** attributes on a standard `<form>`: `toolname`, `tooldescription`, `toolparamdescription`, and optionally `toolautosubmit`.
  - **Imperative API:** `document.modelContext.registerTool()`, unregistered by aborting the `AbortSignal` passed at registration.

  Recommend it only for sites whose key tasks run through forms and whose team can ship and maintain it. Don't use attribute or API names from third-party templates that don't match Chrome's documentation.
- **Lighthouse.** The Agentic browsing category is experimental and needs Chrome 150 or later. Its WebMCP audits also need origin-trial registration. It reports a fraction of checks passed rather than a score, and audits:
  - registered WebMCP tools;
  - forms missing declarative WebMCP;
  - WebMCP schema validity;
  - llms.txt;
  - accessibility for agents;
  - layout stability.

  If Lighthouse is available, run it and cite the version and date.
- **Testing with a real browser agent.** Do this only with the user's permission. Never submit a form, place an order or make a booking during a test. Stop at the final confirmation step unless the user explicitly authorizes a specific, named test submission.

### 4. Footprint: what do third-party sources say?

AI answers lean heavily on sources other than the brand's own site.

- **Find the sources engines actually use.** Look at which third-party domains appear in the SERPs for your prompts, and in AI answers when you observe them: directories, marketplaces, delivery apps, review platforms, "best X in [city]" articles, press, forums. In GCC markets, Instagram, TikTok and marketplace listings often rank and get cited for commercial Arabic queries, so include social and marketplace presence.
- **Entity consistency.** The brand name (Arabic, English and common transliterations), address, phone, hours and categories should match across the site, Google Business Profile, social bios and directories. Conflicting facts produce wrong AI answers.
- **Authority.** Earned mentions and links come from original data, digital PR, and converting unlinked mentions. Count links and referring domains only from a backlink export. Never state domain authority scores or link counts without one.
- **Wikipedia / Wikidata.** Only for genuinely notable entities. Never suggest writing a promotional article.

### 5. Observed presence: what do AI answers actually say?

Presence can't be inferred from search results or readiness checks. There are five valid sources:

- **Search Console's Generative AI performance report.** It covers AI Overviews and AI Mode and has been available to all sites since 31 August 2026. It counts **impressions only** (links to the site shown in an AI feature), by page, country, date and device, and can be exported. It's Google's own first-party measure, so use it first for Google. It says nothing about clicks or other engines.
- **A prompt panel you or the user actually ran.** Running a panel through a browser, APIs or billed tools means dozens to hundreds of requests, so get the user's approval first. The default is to hand the user the panel sheet to run, or to use their tool export.
  - **Prompt set:** 20–40 prompts per market and language, written the way customers ask. Include Arabic in the dialect customers actually use, and flag it for native review. Cover these categories:
    - recommendation ("best … in Amman");
    - comparison ("X vs Y");
    - how to choose;
    - price / cost;
    - local;
    - brand facts ("does [brand] deliver to …").

    Brand-free prompts are the real test. Brand prompts check accuracy.
  - **Engines:** the ones the audience uses, stated explicitly. Options are Google AI Overviews / AI Mode, ChatGPT with search, Gemini, Perplexity, Copilot and Claude.
  - **Repeats:** answers vary, so run each prompt at least 3 times (or on 3 different days). Use a clean or logged-out profile where possible, and a fixed location and language.
  - **Record for every run:** date, engine and mode, location, prompt, brand mentioned (Y/N), brand URL cited (URL), competitors mentioned, cited URLs, and accuracy problems.
- **Exports from AI-visibility tools**, when the user provides them or asks for a connector. Name the tool, prompt set, engines, market and date.
- **GA4 referrals from AI assistants.** See `performance-reporting.md`. This is a lower bound, because many answers produce no click.
- **The Search Console Performance report** still counts AI-feature clicks inside ordinary Web search totals. The Generative AI report above is the place for AI-specific impressions.

**Metrics.** Always state the denominator and n:

- **Mention rate** = runs where the brand is mentioned ÷ runs.
- **Citation rate** = runs citing a brand-owned URL ÷ runs.
- **Share of voice** = brand mentions ÷ mentions of all tracked brands, across the same runs.
- **Accuracy issues** = count of runs with wrong facts about the brand, with examples.

Report by engine and by prompt category. With small n (under about 10 runs in a cell), show the counts and don't present percentages as stable. Never quote "category averages" you didn't measure.

**Lost-prompt analysis.** List the prompts where competitors are mentioned or cited and the brand isn't. The cited URLs are the evidence of what engines prefer, so fetch them (`page_audit.py`) and note what they have that the brand's pages lack: format, specificity, freshness, third-party vs owned, language.

**Fix pack.** Tie every fix to specific lost prompts and to its evidence, and give its impact as High / Medium / Low judgment only. Recheck the same panel after a stated interval (4–6 weeks is typical, because indexes and answers take time to refresh), and compare like with like.

## Scorecard format (in the report)

| Layer | Check | Status | Verification | Evidence | Fix |
|---|---|---|---|---|---|
| Access | Search AI crawlers allowed by robots.txt on crawled URLs | *Pass* | *Verified* | robots.txt fetched 2026-09-30; 24 crawled URLs checked | — |
| Access | Server response to AI crawlers | *Fail* | *Inferred* | Spoofed OAI-SearchBot gets 403 on /ar/ (`--compare-agents`); CDN may treat the real bot differently | Check the CDN bot settings and logs; allow verified search crawlers |
| Parse | Main content in raw HTML | *Partial* | *Verified* | Only Googlebot gets prerendered HTML | Serve the prerender to all verified crawlers or use SSR |

Show "checked X of Y" instead of an overall percentage score unless every check was actually run.

## Writing for answers (AEO content)

`content-briefs.md` covers answer-first writing: a direct answer in the first sentences under question headings, specific facts, honest comparisons, and one page per intent. The same brief format applies. What changes is that the target includes AI answers as well as rankings.
