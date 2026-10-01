# Organic performance reporting

The job is to explain what changed, why, and what to do about it. The numbers are evidence for that explanation. Don't just restate the dashboard.

## Before calculating anything

- **Inspect every file.** Check the column names, the date range in each file, any filters that were applied (GSC exports include a `Filters` sheet or CSV), the currency, and the header comment lines. GA4 CSV exports begin with `#` lines, so use `pd.read_csv(..., comment='#')` or skip those lines.
- **Align periods.** Compare periods of equal length. Where you can, match the weekday mix too: the weekend is Friday–Saturday in Saudi Arabia, Kuwait, Qatar and Jordan. Use year-over-year comparisons when seasonality matters. Ramadan and the two Eids move about 11 days earlier each Gregorian year, so a YoY comparison can put Ramadan in one period and not the other. Check the dates and say so.
- **Watch for incomplete data.** Search Console data for the most recent 2–3 days is often incomplete. Exclude those days or flag them.
- **Know each tool's timezone.** Search Console reports dates in Pacific Time. GA4 uses the property's timezone. State both whenever day-level alignment matters.
- **Keep sources separate.** GSC clicks are not GA4 sessions, and platform-reported conversions are not business orders. Report each source on its own and never add them together. If the user provides business records, reconcile against them.

## Metric rules

- **CTR** = total clicks ÷ total impressions, calculated for the group as a whole. Never average row-level CTRs.
- **Average position** for a group is the impression-weighted mean of the row positions. Never use a simple mean.
- **Rates vs counts.** Report changes in rates (CTR, conversion rate) in **percentage points**. Report changes in counts as %.
- **Zero denominators.** When the base period is zero, the % change is undefined. Write "new" or "n/a", not 0% or ∞.
- **GSC totals don't reconcile.** Query-level totals are lower than site totals because of anonymized queries, and page-level and property-level aggregation differ. Don't expect these to match and don't "correct" them.
- **Currency formatting.** Show KWD, JOD and BHD with 3 decimals, and SAR, QAR and AED with 2. That applies to every amount, including approximate ones in prose ("about 14.010 JOD per order", not "about 14 JOD"). Label the currency on every figure.

## Diagnose the change

Clicks = impressions × CTR. So first work out which of the two moved, then where:

1. **Trend shape.** Plot or scan the daily data. A step change on a particular date points to a specific cause, such as a site release, a migration, a template change, tracking, or a confirmed Google update. Check the Google Search Status Dashboard for that date and cite it. A gradual slide points to competition, content decay, or falling demand.
2. **Segments.** Split the change by page, query cluster, brand vs non-brand, country, device, and search appearance if it was exported. Find the segments that account for most of the change. Usually a few pages explain most of it.
3. **Brand vs non-brand.** Build the brand term list from the brand name, its Arabic and English spellings, common misspellings and transliterations, and confirm it with the user if you can. Brand demand reflects marketing activity and seasonality. Non-brand performance reflects SEO.
4. **Position vs CTR.** If position fell, it's a ranking problem, so look at the page, its competitors and the SERP. If position held but CTR fell, look for SERP changes (AI Overviews, ads, packs) or title and snippet changes.
5. **Merge variants.** For Arabic queries, merge spelling variants with `scripts/arabic_keywords.py` before ranking queries (add `--merge-prefixes` for article and preposition forms, and check the groups it marks `prefix_merged`). Otherwise one topic shows up as several smaller rows and its importance is understated.
6. **Cannibalization.** If a page+query export is available, run `scripts/cannibalization.py`, with the same `--merge-prefixes` choice you used for the keyword merge. Two of the site's own URLs trading positions for the same queries can look like a ranking drop.

State each conclusion with how confident you are in it and what evidence supports it. If the data can't separate two explanations, say so and name the check that would decide between them, for example "URL Inspection on /ar/delivery" or "the release log for Aug 10–14".

## Opportunities worth reporting

- **Striking distance.** Queries or pages with an average position around 5–20 and meaningful impressions. Treat this as a heuristic range, not a benchmark.
- **High impressions, low CTR** relative to the page's position. These are candidates for rewriting the title and meta description.
- **Cannibalization.** Several URLs from the site trading impressions for the same query cluster.

## Google AI features (Search Console)

If the user can export Search Console's **Generative AI performance report** (all sites since 31 August 2026), add it as its own section. It shows impressions of the site's links in AI Overviews and AI Mode, by page, country, date and device. It has no clicks, so never combine it with clicks from the Performance report to calculate a CTR.

## AI assistant referrals (GA4)

GA4 shows real, measurable traffic from AI assistants. Look for sources such as `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com` and `claude.ai`. ChatGPT links often carry `utm_source=chatgpt.com`. Report these sessions and their conversions as their own line.

This number is a lower bound, because many AI answers produce no click. Use it as trend evidence alongside the prompt panel in `ai-search-aeo-geo.md`, never as a measure of AI visibility on its own.

## Check the numbers before writing

Recompute the headline numbers from the saved files with a script before writing them into the report: totals, changes, top pages and the money figures. It's easy for text and tables to drift from the CSVs they came from. A number that doesn't reproduce from a file doesn't go in the report.
