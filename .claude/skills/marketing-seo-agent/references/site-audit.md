# Site audit

An audit finds the issues that stop important pages from being crawled, indexed, understood or chosen in search, and ranks the fixes by business impact. It is not a list of every imperfection the crawl turned up.

## Scope the crawl

- **No crawler export available**: take a bounded sample with `scripts/page_audit.py`. Include the homepage plus 2–3 URLs for each important template (category, product/service, article, location, contact), taken from the sitemap or the navigation. For a first pass, 15–40 pages is usually enough. State the sample size and how you chose it in the report. Findings from a sample describe templates, not the whole site.
- **Screaming Frog, Sitebulb or similar export provided**: use it for site-wide counts (e.g., "212 of 1,480 indexable URLs lack a meta description"). Spot-check a few rows with a live fetch.
- **Search Console Page indexing or Crawl stats export provided**: this is the only reliable view of what Google actually indexed. Without it, say that index coverage is not verified.

Example run:

```bash
python scripts/page_audit.py https://example.com/ar/ --sitemap-sample 20 --out work/crawl.json
python scripts/page_audit.py --urls-file work/urls.txt --out work/crawl.json
python scripts/page_audit.py https://example.com/ar/ --compare-agents 3 --out work/agents.json
```

The script fetches only public http(s) addresses on ports 80 and 443 (plus any port you type in the URL), re-checks every redirect hop, caps each response at 15 MB and samples sitemap URLs only from the audited site. For a staging site on a private network that the user owns, add `--allow-private`; cloud metadata addresses stay blocked. A refused URL shows as an `UnsafeURL` error: report it, don't work around it.

`--compare-agents` fetches the first few URLs as a browser, Googlebot, Bingbot and the main AI crawlers, then compares what each receives: status, title, language, word count and structured data. Run it in every audit on a handful of key URLs (homepage and one page per main template). A site that serves different HTML to different agents, such as a Googlebot-only prerender or a CDN blocking AI bots, has a problem that a normal crawl hides.

The script's `issues` list is a first pass. Read the extracted data yourself before you report anything. A "canonical points elsewhere" flag, for example, can be correct on a paginated or parameter URL.

## Checklist, grouped by what it protects

### 1. Crawlability and indexability (usually the highest impact)
- HTTP status of key URLs. Look for redirect chains, redirect loops, soft 404s (a 200 status with "not found" content), and 5xx errors.
- robots.txt: check whether it blocks important paths, CSS or JS, and whether it declares a sitemap. The script applies the rules to every crawled URL. It reports "unknown" when robots.txt returns HTML (often a bot challenge) or a server error; check those by hand.
- Meta robots and `X-Robots-Tag`: look for `noindex` or `nofollow` on pages that should rank.
- Canonicals: self-referencing on indexable pages. Flag canonicals pointing to redirected or 404 URLs, canonicals on Arabic pages pointing to English pages (or the reverse), and conflicts between canonical and hreflang.
- Sitemaps: check that they exist and are valid, that they list only indexable 200 URLs, and that `lastmod` values are believable (if every URL has the same `lastmod`, it's usually auto-generated). Also check the sitemap doesn't list other sitemaps as if they were pages.
- Host consolidation: http→https, www vs non-www, and trailing-slash consistency should each resolve to one version.
- JavaScript dependence: if the raw HTML has almost no body text or links but the page looks full in a browser, rendering may be the problem. Recommend confirming with URL Inspection in Search Console. Don't claim that Google can't render the page.
- Different content for different agents: compare the `--compare-agents` output. A different language, title, word count or structured data for Googlebot than for other agents means dynamic rendering or bot rules are in play. Report what each agent gets.

### 2. International and Arabic setup
See `arabic-market-seo.md` for detail. Check these:
- `<html lang>`, and `dir="rtl"` on Arabic pages.
- hreflang: valid language-region codes, a self-reference on each page, return tags between alternates, `x-default` where it makes sense, and consistency with canonicals.
- A consistent URL structure for each language and market.
- No automatic redirect based on IP or browser language that stops crawlers from reaching the other language versions.
- One language per URL. A page that mixes Arabic and English body copy with no clear primary language gives search engines an ambiguous document. Split it into per-language URLs.

### 3. On-page relevance
- Title: present, unique across pages, front-loads the main topic, and is not truncated badly. As a rule of thumb, stay near 60 characters or fewer. Google truncates by pixel width, so Arabic lengths are only a rough guide.
- Meta description: present, unique, and useful. Google often rewrites descriptions, so a weak one is a low-priority issue.
- H1: one clear H1 that matches the intent of the page, with a sensible H2/H3 hierarchy.
- Content: does it answer the query the page targets? Treat word count as a weak signal. Thin pages matter when they are meant to rank.
- Internal links: important pages should be linked from navigation or hubs, with descriptive anchors. Look for orphan pages and for the Arabic and English versions linking to each other.
- Images: `alt` text on meaningful images (and in Arabic on Arabic pages), sensible file names, and lazy loading below the fold.
- Duplicate or near-duplicate pages: parameter URLs, printer versions, city pages whose content is the same apart from the city name.
- Cannibalization: two of the site's pages targeting the same primary query. Check this **before proposing any title, H1 or meta change**, so the fix doesn't move a query from the page that owns it to another page.
  - With a Search Console page+query export, run `scripts/cannibalization.py export.csv`.
  - Without one, run `scripts/cannibalization.py --crawl work/crawl.json --keywords "…"`. It lists pages whose titles or H1s share the same primary term.
  - The page with the most clicks and impressions on a query owns it. Other pages should link to the owner rather than compete with it.

### 4. Structured data
- Parse the JSON-LD types on each template and compare them with what the page is: `Organization` with `logo` and `sameAs` on the homepage, `LocalBusiness` or a subtype for physical locations, `Product` with offers on product pages, `Article` on blog posts, `BreadcrumbList` wherever breadcrumbs appear.
- Check required and recommended properties against Google's current structured data docs before you call a page eligible for a rich result.
- Google stopped showing FAQ rich results for all sites, including government and health sites, in May 2026. HowTo rich results were deprecated before that. `FAQPage` is still a valid Schema.org type and existing markup does no harm, but never promise a rich result from it.
- Markup must describe content that is visible on the page. Never add reviews or ratings to markup unless they exist on the page and are genuine.

### 5. Page experience and performance
- A fetch can't measure Core Web Vitals. Use a PageSpeed Insights, CrUX or Lighthouse export if one is provided. If the shell can reach the PageSpeed Insights API, you may query it and cite the run date. Otherwise list CWV as **not verified**.
- Judge field data (CrUX, the 75th percentile of real users) against Google's "good" thresholds: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Lab results (Lighthouse) help debugging but aren't what Google assesses, so label which one you're quoting.
- Things the HTML can show (label these as weak proxies): HTML size, number of scripts and stylesheets, a missing viewport meta tag, images without dimensions, and render-blocking resources in `<head>`.

### 6. AI search readiness (AEO / GEO)
Include this in every audit, at least the Access and Parse layers, and expand it when the user asks about AI visibility. `ai-search-aeo-geo.md` has the five-layer method and the scorecard.

The script reports robots.txt access per crawler, whether `/llms.txt` exists, and (with `--compare-agents`) what AI crawlers actually receive. If Lighthouse is available, its Agentic browsing category adds agent-accessibility and WebMCP checks.

## Severity

| Severity | Meaning | Example |
|---|---|---|
| Critical | Stops key pages being indexed or found, site-wide or on revenue pages | `noindex` on service pages, robots.txt blocking `/ar/`, Arabic canonicals pointing to English |
| High | Significantly weakens rankings or CTR for important pages | duplicate titles across a category template, broken hreflang between markets |
| Medium | Real issue, limited scope or impact | missing `BreadcrumbList` schema, thin content on secondary pages |
| Low | Polish | long meta descriptions, missing alt text on decorative images |

Each issue in the report states:
- **Evidence**: the example URLs and what was observed.
- **Scope**: sample count, or a site-wide count if you have an export.
- **Why it matters**: one sentence.
- **Fix**: specific enough that a developer or content editor can act on it.
- **Verification**: whether it was *Verified*, *Inferred* or *Not verified*.
