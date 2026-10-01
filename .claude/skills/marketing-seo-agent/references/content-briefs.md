# Content briefs and SEO copy

A brief tells a writer exactly what page to build and why it should rank and be cited in AI answers. Copy written from the brief should read as if a knowledgeable local person wrote it for customers, with search requirements met quietly in the background.

Before briefing a new page, confirm no existing page already owns the topic (see cannibalization in `site-audit.md`). Often the right brief is to rework the page that already ranks.

## Before writing: look at the SERP

Search for the primary keyword in each target language and market. Record the date, then note:
- The page types that rank (service page, blog guide, listicle, marketplace, directory, video) and what that says about intent.
- The angles, sections, and questions the top results share. Also note what they all miss, because that gap is your chance to differentiate.
- Any trust signals the ranking pages show: prices, credentials, reviews, location details, photos.
- The questions people type, from Autocomplete (`scripts/suggest.py --expand questions`) and the SERP. If AI answers were observed for the main prompts, also note which pages they cite and what those pages do well.

## Brief template

Use these sections inside the report document:

1. **Page goal and audience**: who the page is for, what they want, and what action the page should drive.
2. **Target cluster**: the primary keyword and secondary keywords in Arabic and English, plus variants. Include volume and position only if an export provides them. Otherwise write `Not available (needs export)`.
3. **Search intent and SERP observations**: dated notes, with the URLs you examined.
4. **Recommended angle**: how the page will beat what already ranks.
5. **Outline**: the H1 and the H2/H3 structure, with notes on what each section must cover. Give each language its own outline if their SERPs differ.
6. **Questions to answer**: taken from the SERPs, competitor pages, and the user's customer knowledge. Don't claim they come from "People Also Ask" unless you actually saw a PAA box.
7. **Entities and terms to cover**: the concepts, product names, and locations that a complete answer needs.
8. **Title tag options**: 2–3 per language. Front-load the topic and keep roughly to 60 characters or fewer.
9. **Meta description options**: 2 per language, each giving a reason to click.
10. **URL slug**: see the slug guidance in `arabic-market-seo.md`.
11. **Internal links**: real URLs from the site, both to and from this page. If the site hasn't been crawled, say so and list the page types to link to instead.
12. **Schema**: the types that match the page content, e.g. `Service`, `LocalBusiness` or `MedicalClinic` (subtypes), `Product`, `Article`, `BreadcrumbList`.
13. **Proof points the client must supply**: prices, credentials, licenses, case results, real reviews, photos. List them as **inputs needed**. Never invent them.
14. **Length guidance**: base it on what ranks ("top results run about 800–1,500 words of substantive content"), not on a magic number.
15. **CTA and conversion notes**.

## Writing the copy

- **Arabic copy is written, not translated.** Build the Arabic version from the Arabic SERP and the Arabic keyword variants. The two language versions may need different emphasis.
- **Register**: use Modern Standard Arabic for web copy unless the brand's established voice or the user specifies a dialect. Flag any dialect terms you used, and recommend a native review for anything published.
- **Keywords**: put the primary term in the title, the H1, the opening paragraph, and at least one H2, where it reads naturally. Don't stuff keywords, and don't force every spelling variant into the text. Variants belong in keyword research, not in the copy.
- **Orthography**: write Arabic correctly (ة, ى, hamza) even when many users search without it. Search engines match the variants. Correct spelling is a trust signal.
- **Regulated topics**: health, finance, legal, and similar subjects need extra care. Flag every claim that needs professional or regulatory review. Keep claims conservative, and don't state specific regulations unless you've checked a source. Don't promise outcomes.
- **No invented urgency, discounts, availability, testimonials, statistics, or awards.**

### Answer-first writing (AEO / GEO)

These habits make a page easier for readers to use and for answer engines to quote. Google says its AI features need no special writing or chunking (see `ai-search-aeo-geo.md`), so present them to clients as good writing, not as a Google trick.

- **Answer at the top.** Under each question-style heading, answer in the first one or two sentences, then give the detail. About 40–60 words is a common target for that opening answer; it's a heuristic, not a rule.
- **Be specific and checkable.** Prices, ranges, hours, delivery areas, durations, and named standards or credentials all qualify. Every figure must come from the client or a cited source.
- **Use real HTML tables** for comparisons and specs, with honest pros and cons. A "Brand vs Competitor" page must be accurate and fair, with no invented competitor weaknesses.
- **Self-contained sections.** Each H2 section should make sense if quoted alone. Name the entity rather than writing "we" or "it" throughout.
- **Visible authorship and dates.** Show who wrote or medically reviewed the page, with real credentials, and a last-updated date that changes only when the content really changes.
- **Arabic answers in Arabic**, using the terms customers type, including common variants in natural places such as the questions themselves.

## Optimizing existing pages (titles, metas, on-page fixes)

Present each change as a table:

| URL | Element | Current | Proposed | Reason |
|---|---|---|---|---|

Get the current values from the crawl, not from memory. If a CMS is connected and the user wants the changes applied, follow `cms-changes.md`.
