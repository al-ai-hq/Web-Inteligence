# Keyword and competitor research

The goal is a set of topics the site can realistically win. Each topic has a clear intent, is mapped to one page, and is ranked by business value. A long list of keywords is not the goal.

## Data honesty comes first

Without an uploaded export, you **do not have** search volume, keyword difficulty, CPC, click-through estimates, or competitor traffic. Every column that would hold one of these must say `Not available (needs export)`. Do not substitute "estimated" numbers, "low/medium/high volume" guesses written as if they were data, or figures you remember from training. Those guesses end up in budget decisions.

What you can use honestly:
- **The user's own Search Console data**, if provided. It shows impressions, clicks, and average position for queries the site already appears for. This is real demand evidence, but only for queries where the site already shows.
- **SEO-tool exports** (Semrush, Ahrefs, Keyword Planner). Use their volume and difficulty figures, and name the tool, the database or country, and the export date.
- **Live SERP observation** through web search. This shows who ranks, which page types rank (service page, listicle, marketplace, directory, government site, video), how commercial the intent is, and which angles repeat. Record the date and the location or market you searched for.
- **Google Autocomplete** through `scripts/suggest.py`, set to the target language and country (`--hl ar --gl kw`). It shows phrasings and questions people actually type: price questions, "vs" comparisons, dialect wording, and religious or seasonal questions such as fasting or wudu with aligners. That's evidence a query exists, **not** a volume. Label it that way, and note that Arabic suggestions are partly pan-Arab even with a country set. The endpoint is undocumented: keep runs small, and if the script stops at a refusal, record that and rely on SERP observation.
- **The site and competitor pages themselves.** Look at the topics covered, the gaps, and how the pages are structured.

If the user wants volumes and hasn't provided an export, say which export would fill the gap. For example: a Semrush or Ahrefs keyword export for the target country, or Search Console > Performance > Queries for the last 3 months. Then give them the finished topic map, ready to be ranked once the numbers are in.

## Process

1. **Seed list.** Build the first list from the products and services, the words customers use (the user can tell you), competitor navigation and headings, SERP titles, and Autocomplete suggestions (`suggest.py --expand questions`). Cover both languages and all the variants in `arabic-market-seo.md`: MSA and dialect terms, spelling variants, English and transliterated terms, and Arabizi where the audience uses it. Only include a dialect variant if you see it in SERPs or data, or if the user confirms people use it.
2. **Intent labeling.** Tag each keyword as informational, commercial investigation, transactional, local (e.g. "near me", city names), or navigational (brand). Base the label on what the SERP shows, not on your intuition. If service pages rank, the intent is transactional, even when the wording sounds informational.
3. **Clustering.** Group keywords that one page can satisfy. Two queries belong together when their SERPs share most of the same top results. Check this for ambiguous pairs; don't guess. For Arabic, run `scripts/arabic_keywords.py --merge-prefixes` on any keyword export first, so spelling, article and preposition variants of the same query merge before you cluster. Check the groups marked `prefix_merged` before relying on them.
4. **Mapping.** Assign each cluster to one existing URL, or to "new page needed". Before planning a new page, check that no existing page already owns the cluster. Use `scripts/cannibalization.py` on a page+query export, or with `--crawl` on a crawl. If two pages compete, recommend one owner and have the other link to it.
5. **Answer-engine prompts.** For each priority cluster, write down how a customer would ask an AI assistant about it ("best clear aligners clinic in Kuwait", "كم سعر التقويم الشفاف في الكويت"). Those prompts seed the prompt panel in `ai-search-aeo-geo.md`. The question-style Autocomplete suggestions and the SERPs tell you which questions the page must answer.
6. **Prioritization.** Score each cluster on:
   - Business value: how close it is to revenue, based on what the user said about their offer.
   - Winnability: who holds the top results (marketplaces, government sites, and giant publishers are hard to displace), and whether the site already ranks nearby (from Search Console).
   - Effort: whether an existing page can be improved or a new page is needed.

   Explain the scoring in the report. Don't dress it up as a precise number.

## Competitor research

- **Search competitors vs business competitors.** The domains that rank for your clusters are your search competitors. They may include directories, marketplaces, or publishers the user doesn't think of as rivals. Report both groups when both are relevant.
- **For each main competitor**, look at the page types that rank, how they structure content (headings, depth, FAQs, comparison tables, prices shown, trust signals), their structured data (you can run `page_audit.py` on their pages), and how they handle Arabic and English.
- **Content gaps** are topics or questions that competitors' ranking pages cover and the user's site doesn't. Base each gap on specific pages you actually looked at, and link those pages in the appendix.
- **Don't state competitors' traffic, keyword counts, or authority scores** unless an export provides them.
- **Off-page and authority.** Compare referring domains and link sources only from a backlink export (Ahrefs, Semrush, Search Console Links). The legitimate ways to earn links and mentions are:
  - original data or tools worth citing;
  - digital PR;
  - converting unlinked brand mentions;
  - reclaiming broken links to the site;
  - accurate listings in the directories and marketplaces that rank.

  Never recommend buying links, link exchanges or private blog networks. Google rarely needs a disavow file, so suggest one only with evidence of a manual action or a clear link scheme.

## Output tables (in the report)

Main cluster table:

| Cluster | Primary keyword (AR / EN) | Variants | Intent | Volume | Current position | Mapped URL | Priority | Rationale |
|---|---|---|---|---|---|---|---|---|

- **Volume** holds the export figure plus the source, or `Not available (needs export)`.
- **Current position** comes from Search Console (average position and date range), or reads `Not ranking / no data`.

If it's relevant, add a competitor comparison table: domain, ranking page types, strengths, gaps, and evidence URLs.
