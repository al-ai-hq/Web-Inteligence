# Report document template

Use this structure for every deliverable. Scale it to the job. A content brief doesn't need a long findings section, and an audit doesn't need a brief. Drop any section that would be empty rather than filling it with generic text.

Write in the user's language. Put the conclusion first. Write the report as Markdown with one `#` title. `scripts/build_report.py` turns it into the HTML page and PDF (see `report-export.md`), so keep to plain Markdown: headings, lists, pipe tables and ```` ```chart ```` blocks, with no raw HTML.

---

**Title:** `[Brand / site] — [SEO Audit | Keyword & Competitor Research | Content Brief: <page> | Organic Performance & AI Visibility Report] — [Market(s)] — [Date]`

## 1. Summary
- 3–5 bullets a marketing director can act on without reading further. Cover what's happening, why it matters to the business, and the top three actions.
- Give an overall assessment in one sentence. If the evidence is thin, say that here rather than hiding it at the end.
- When real headline numbers exist, open the summary with a `kpi` chart block (3–5 tiles). If a single chart shows the finding (for example a daily trend with the change date marked), put it right after the bullets.

## 2. Scope and data sources

| Source | What it covered | Date / period | Limitations |
|---|---|---|---|
| Live crawl (`page_audit.py`) | 24 pages, homepage + 4 templates, sampled from sitemap | crawled 2026-09-29 | raw HTML only; CWV not measured |
| GSC export | Queries, Pages, Dates; web search; all countries | 2026-07-01 → 2026-08-31 (PT) | anonymized queries excluded from query totals |
| SERP observation | 12 queries, Arabic + English, Saudi Arabia | 2026-09-29 | point-in-time, personalization possible |

List the assumptions made, each prefixed `ASSUMPTION:`.

## 3. Findings
Organize by job. Use the tables and formats from the relevant reference file (audit issues by severity, keyword clusters, the brief, KPI tables). Each finding carries its evidence and a verification tag: *Verified*, *Inferred*, or *Not verified*.

Put a chart next to the finding it proves, built from the same CSV as the table beside it. `report-export.md` lists which charts suit each job.

## 4. Prioritized action plan

| # | Action | Page(s) | Why (evidence) | Impact | Effort | Owner | Verify by |
|---|---|---|---|---|---|---|---|

- Order the actions by business impact on key pages, then effort, then confidence.
- Impact and Effort are High / Medium / Low judgments, and the report must say so. They are not forecasts. Never attach traffic or revenue projections unless a stated model and real inputs support them.
- **Owner** is the role that does the work: developer, content, SEO, or client. Don't assign named people unless the user has given you names.
- **Verify by** is how you'll know it worked: a GSC query or page to watch, a re-crawl, or URL Inspection.

## 5. Data gaps and next steps
- What was not available, and what it blocked. For example: "Search volume not available. Export Semrush keyword data for Saudi Arabia to finalize priorities."
- The smallest next action for the user to take.

## Appendix
- Full tables (or a pointer to an attached CSV if the table is long), the crawl summary, the SERP notes with URLs, and the method used (brand-term list, clustering approach, thresholds and where they came from).
