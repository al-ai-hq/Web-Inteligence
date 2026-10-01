# Competitor review: SavageAudit

SavageAudit is a low-price, entertainment-led page auditor. It scores six experience categories and layers AI-visibility readiness, online presence, Search Console and GA4 on top, but it does not apply fixes. Our platform is deeper on measurement and execution; SavageAudit is broader on conversion and experience, and stronger on growth loops.

Checked from its public pages, one public report and the pricing page (rendered in Chrome), late September 2026. It has no public code repositories.

## What it offers

| Area | What SavageAudit does | Page |
| --- | --- | --- |
| Core audit | Six categories: performance, SEO, design, copy, UX, conversion; single page in about 60 seconds | [Home](https://savageaudit.com/) |
| Modes | Page audit; full-site audit sampling key templates; compare two URLs with score deltas; before/after on Pro | [Full site](https://savageaudit.com/full-site-audit), [Compare](https://savageaudit.com/compare-websites) |
| AI visibility | Readiness checks: crawl posture, entity and footprint, citability | [AI visibility](https://savageaudit.com/ai-visibility-audit) |
| Online presence | Social profiles, reviews, unlinked mentions, consistency | [Online presence](https://savageaudit.com/internet-social-presence-audit) |
| Search Console | Low-CTR queries, striking-distance queries (positions 11–20), landing-page fit, decay; owner-only | [GSC dashboard](https://savageaudit.com/google-search-console-audit-dashboard) |
| GA4 and action plan | 8–12 actions with impact, effort, confidence and evidence; grouped as critical blockers, quick wins, growth opportunities, tracking fixes | [Action plan](https://savageaudit.com/ai-growth-action-plan) |
| Report | Screenshot, technical summary, category scores, metric chips (LCP, time to interactive), owner-only rewrite, share link and PDF | [Public report](https://savageaudit.com/roast/zPi8uBTdxN) |
| Tone | Six personas and three intensity levels | [Home](https://savageaudit.com/) |
| Growth loops | Public gallery (798 public reports when checked), leaderboard, share cards; free reports published to the gallery | [Gallery](https://savageaudit.com/gallery) |
| Pricing | Free $0; Pro $9/month (15 page audits, 2 full-site, 2 compare, PDFs, social enrichment, before/after, private by default); Agency "coming soon" (white-label, bulk URLs, team seats, API); 4 tokens for $4 | [Pricing](https://savageaudit.com/pricing) |

## How it appears to work

Inferred from public pages; not confirmed by the vendor.

- **Deterministic metrics, AI synthesis.** Its action-plan page says metrics such as CTR, position and sessions are calculated from source data, and AI turns the evidence into actions.
- **Lighthouse-style performance data.** The public report shows a performance score, LCP and time to interactive. ASSUMPTION: it runs PageSpeed Insights or Lighthouse.
- **Readiness-only AI visibility.** Its pages describe crawl, entity and proof checks; none describes sending live prompts to ChatGPT, Gemini or Perplexity.
- **Gated sharing.** A shared report showed 2 of 36 findings; the rest need sign-in.
- **Private Google data.** Search Console data stays in the owner view, never on public pages, cards or PDFs.
- **Hosting.** Report screenshots are served from AWS `ap-south-1`, and prices are shown in USD and INR, which suggests an India-based operator.

## Side by side

| Capability | SavageAudit | Our platform | Verdict which is better |
| --- | --- | --- | --- |
| Technical SEO | Page-level checks | Versioned rule catalog, 7 categories, evidence IDs | **Ours.** Versioned rules with evidence, and a score you can recompute. |
| Performance | Lighthouse-style metrics | PageSpeed Insights and CrUX field data | **Ours.** Adds real-user CrUX data, not just lab tests. |
| AEO/GEO readiness | Readiness checks; favors FAQ and answer blocks | Google-aligned rules; no chunking or llms.txt scoring | **Ours.** Follows Google's current guidance; theirs rewards FAQ blocks Google says aren't needed. |
| Live AI visibility | Not evident | 8 prompts × 5 providers: mentions, recommendations, citations, competitor share | **Ours.** Measures real answers from 5 AI providers; theirs only checks the page. |
| Design, copy, UX, conversion | Core categories | **Gap** | **SavageAudit.** We don't audit these yet. |
| Online presence and reviews | Yes | **Partial** (GEO-011 profile consistency) | **SavageAudit.** Ours checks profile consistency only. |
| Search Console opportunities | Low-CTR, striking distance, decay | **Partial** (queries, positions, clustering) | **SavageAudit.** It turns queries into fix lists; ours stops at mapping and positions. |
| GA4 | In the action plan | **Gap** (optional outcome tracking only) | **SavageAudit.** GA4 feeds its action plan. |
| Keyword uploads with volume | No | Yes | **Ours.** They have no keyword import. |
| Compare two sites, before/after | Yes | **Gap** | **SavageAudit.** We have no compare mode yet. |
| Full-site coverage | Template sampling | **Partial** (up to 20 pages, no template rollup) | **SavageAudit.** Samples by template; ours stops at 20 pages. |
| Apply fixes to the CMS | No | Yes, with approvals, snapshots, rollback | **Ours.** They stop at recommendations. |
| Content | Owner-only rewrite suggestions | Briefs and gated drafts | **Ours.** Keyword-based briefs and drafts, not one-page rewrites. |
| Data integrity | Metrics from source data | Fidelity labels, lineage, 100% lineage gate | **Ours.** Every number shows its source and reliability. |
| Arabic RTL | Not evident | Full bilingual | **Ours.** No Arabic support seen on theirs. |
| Sharing | Free reports public | Private by default | **Depends.** Ours suits client work; theirs spreads faster. |

## Features worth adopting

| Priority | Feature | How it fits our PRD | Guardrail |
| --- | --- | --- | --- |
| Must | Experience audit: design, copy, UX, conversion | New assessed categories from DOM and screenshot, reported as a separate Conversion Readiness score | Labelled "assessed"; Readiness Score stays deterministic |
| Must | Search Console opportunity engine | Low-CTR, striking distance (positions 11–20), decay and landing-page fit feed §7, §8 and §9 | Baselines from the site's own CTR-by-position data, never invented benchmarks |
| Must | Compare mode and before/after | Same rubric on two URLs or two dates; per-category deltas; competitor benchmarking | Each side counts against the cost caps |
| Should | Online presence audit | Official profiles, Business Profile, reviews where an API or the client supplies them, sameAs consistency; extends GEO-011 | No scraping against platform terms |
| Should | GA4 tracking readiness | Key events, organic landing-page engagement, a "tracking fixes" plan group | Read-only OAuth; owner-only data |
| Should | Action plan view | Top 8–12 actions grouped as critical blockers, quick wins, growth opportunities, tracking fixes, with why-now and evidence chips | Presentation layer over the §8 priority formula |
| Should | Template-aware full-site audit | Classify pages by type; roll recurring issues up per template. ASSUMPTION: 100-page cap on the connected tier | Crawl limits and robots rules still apply |
| Should | Page screenshots | Mobile and desktop per audited page in the report and PDF | Stored with evidence retention |
| Could | Shareable report links | Opt-in public link with Search Console, GA4 and keyword data stripped | Private by default |
| Could | Tone presets | Executive, Direct, Technical in Arabic and English | No celebrity personas; real names carry likeness risk |
| Could | Pricing mechanics | Free page audit, low-cost Pro, token top-ups, agency white-label, bulk URLs, API | Input to the open pricing decision |
| Could | Fast first results | First findings in about a minute while deeper stages continue | Unfinished stages show as pending, not scored |

## What not to copy

- **Public-by-default free reports.** They conflict with our privacy default and client confidentiality.
- **FAQ or answer-block requirements.** They conflict with Google's current guidance (PRD §3, AEO-009).
- **Readiness-only AI visibility.** Live multi-provider measurement is our clearest differentiator; keep it.
