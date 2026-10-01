# Content brief: <primary keyword or page topic>

<!--
Template for one content brief per keyword cluster (02-DETAILED-SPECIFICATION §9).
Field names match schemas/content-brief.schema.json. Brief states follow
03-PRODUCTION-CONTRACTS "Workflow states" (Content): BRIEF_DRAFT, BRIEF_REVIEW,
BRIEF_APPROVED, REJECTED.
Rules while filling it:
- Volume and position only from a named source; otherwise write
  "Not available (needs export)" and name the export that would fill it.
- Facts only from the approved fact sheet (by claim_id / fact_id) and cited
  evidence. Proof the client must supply is listed as an input needed, never invented.
- Check page ownership and cannibalization first: improving the page that already
  owns the cluster is usually the right brief.
Method reference: .claude/skills/marketing-seo-agent/references/content-briefs.md
-->

| Field | Value |
| --- | --- |
| `brief_id` | <uuid> |
| `cluster_id` | <uuid of the keyword cluster> |
| `opportunity_id` | <uuid of the content opportunity, or none> |
| `status` | BRIEF_DRAFT |
| `author_id` | <named human author (user uuid); required before any draft> |
| `approved_by_user_id` / `approved_at` | <set by the approver, not by an agent> |
| `needs_native_review` | <true for any Arabic output until a native reviewer signs off> |
| `created_at` | <RFC 3339 UTC> |
| `review_date` | <YYYY-MM-DD: when this page is re-checked against its cluster data> |

## 1. Page goal and audience

- `page_goal`: <what the page must achieve and the action it should drive (lead, order, booking, enquiry)>
- `audience`: <who it is for and what they want>

## 2. Target cluster

- `target_cluster`: primary keyword and variants in each language.

| Keyword | Language | Market | Avg. monthly volume | Source and period | Avg. position | Source and period |
| --- | --- | --- | --- | --- | --- | --- |
| <primary> | <ar-SA> | <SA> | <number, or "Not available (needs export)"> | <e.g. Google Keyword Planner, 2025-10 to 2026-09> | <number, or "Not available (needs export)"> | <Search Console, dates, Pacific Time> |

- `intent`: <informational | commercial | transactional | navigational>
- `market`: <ISO 3166-1 alpha-2 or `global`>. `language`: <BCP 47>.
- Never sum volumes across sources or markets (02 §7).

## 3. Target URL

- `target_url`: <existing page to improve, from the crawl> or `proposed_url`: <new page, only when no page owns the cluster>
- `slug`: <follows the site's convention; Arabic or transliterated slugs chosen once per site>
- Ownership check: <cluster mapping status (mapped | gap | cannibalized) with evidence IDs>

## 4. Observations (dated)

- `observations`: what ranks or gets cited, from licensed SERP data or observed AI citations. Never from scraped Google result pages (D-009).

| Date | URL examined | Note |
| --- | --- | --- |
| <YYYY-MM-DD> | <URL> | <page type, angle, trust signals> |

- `competitor_coverage`: <cited sources only>

## 5. Angle

- `angle`: <how this page will beat what already ranks or gets cited>

## 6. Outline

- `outline`: H1 and H2/H3 structure with notes per section. Write a separate outline per language when their results differ. Arabic is written from Arabic evidence, not translated.

## 7. Questions to answer

- `questions`: each with its source (Search Console query, keyword upload, visibility prompt). Do not claim "People Also Ask" unless a PAA box was observed.

| Question | Source |
| --- | --- |
| <question> | <source and date> |

## 8. Entities and terms

- `entities`: <concepts, products, places a complete answer needs>

## 9. Titles and meta descriptions

- `title_options`: 2-3 per language; front-load the topic; near 60 characters.
- `meta_options`: 2 per language, each giving a reason to click.

## 10. Facts and proof

- `fact_ids`: <claim_id values from the approved fact sheet>
- `proof_points_needed`: <prices, credentials, licences, results, real reviews, photos the client must supply>
- `first_hand_input_needed`: <the client's own experience, data or examples; without it, work stops at the brief>

## 11. Internal links and schema

- `internal_links`: <real URLs from the crawl, to and from this page>
- `schema_candidates`: <types that match visible content only; no promised rich results; FAQ rich results no longer appear in Google Search (02 §8)>

## 12. Length, CTA and regulated claims

- `length_guidance`: <based on what ranks, not a fixed number>
- `cta_notes`: <conversion notes>
- `regulated_claims`: <health, finance, legal or other claims flagged for professional review>

## 13. Success measures

- `success_measures`: <cluster impressions, clicks, average position (an average across impressions), prompt-panel re-test>. No forecast of rankings, traffic or citations.

## Draft gates

A draft starts only when every gate passes (02 §9). The system refuses otherwise and returns `blocked` with the reason.

- [ ] Brief status is `BRIEF_APPROVED`, set by a human approver.
- [ ] A named human author (`author_id`) is assigned.
- [ ] The client's first-hand input is present.
- [ ] No other page is mapped to this cluster (one page per cluster).
- [ ] The workspace is below its monthly draft cap (ASSUMPTION: 8 new-article drafts per month).
- [ ] Every fact comes from the fact sheet or cited evidence; unsupported sentences are removed before review.

After drafting:

- Drafts land in the CMS as drafts or as pull requests. A human publishes; the system never publishes.
- Arabic drafts get native review. AI assistance is disclosed where the workspace policy requires it.
- The page is re-checked on `review_date` against its cluster's Search Console data.
