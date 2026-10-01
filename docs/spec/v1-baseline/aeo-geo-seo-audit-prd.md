# Global AEO/GEO/SEO Audit Microsite

## Product Requirements Document, Audit Rules, and Implementation Plan

**Status:** Proposed implementation baseline  
**Version:** 1.0  
**Date:** 29 September 2026  
**Initial scale:** Approximately 30 completed audits per month  
**Interface and report languages:** Arabic and English  
**Market coverage:** Worldwide  

---

## 1. Executive decision summary

Build a bilingual microsite that accepts a public website, asks for the minimum business context needed to interpret it, runs a bounded technical and content audit, tests visibility across five major LLM provider families, and shows a complete report immediately. Email delivery is optional and occurs only after the report is available.

The product will have two measurement layers:

1. **Website Readiness Score, 0–100:** deterministic AEO, GEO, SEO, accessibility, entity, and technical checks.
2. **LLM Visibility Scorecard:** observed mentions, recommendations, and citations from time-specific tests. This is not blended into the readiness score and is not described as a stable ranking.

The initial LLM coverage is:

- OpenAI, representing the ChatGPT/OpenAI ecosystem through an API model with web search.
- Google Gemini with Google Search grounding.
- Anthropic Claude with web search.
- Perplexity Sonar or its current search-grounded successor.
- xAI Grok with web search.

The report must name the exact provider, model identifier, test language, location context, prompt, timestamp, and whether web search actually executed. API results must not be presented as identical to results from the corresponding consumer application.

The recommended operating ceiling is **USD 150 per month**, with a target normal spend of **USD 55–100 per month** at 30 audits. The service must pause optional LLM calls before exceeding the configured monthly limit.

---

## 2. Product definition

### 2.1 Product statement

The product gives any organization worldwide a free, evidence-backed assessment of how well its website can be discovered, understood, quoted, cited, and recommended by search engines and AI assistants.

### 2.2 User promise

> Enter your website, answer a few questions, and receive a full AEO, GEO, SEO, and multi-LLM visibility report directly in your browser. No payment and no required email address.

### 2.3 Primary users

- Business owners and marketing leaders.
- SEO and content professionals.
- Agencies assessing prospects or clients.
- Product and growth teams.
- Developers responsible for technical SEO.
- Nonprofits, institutions, publishers, professionals, and public organizations.

The product is not restricted to commercial businesses or a particular region.

### 2.4 Supported geography and language model

- The microsite interface supports Arabic and English.
- Reports support Arabic and English.
- Users select the country, region, or worldwide market relevant to the audit.
- Users select the primary language customers use when searching.
- The target website may use any language that the configured parsing and LLM providers can process.
- If the website language differs from the chosen report language, evidence remains in the source language and explanations are translated into the report language.
- Arabic pages are evaluated for `lang`, `dir="rtl"`, mixed-direction content, logical CSS, and Arabic metadata quality.

### 2.5 Non-goals for version 1

- Guaranteed search ranking or LLM recommendation.
- Claiming to reproduce consumer ChatGPT, Gemini, Claude, Perplexity, or Grok exactly.
- Full enterprise crawler coverage.
- Search Console or analytics account access.
- Continuous monitoring.
- Historical rank tracking.
- Paid reports, subscriptions, or checkout.
- Automated changes to the audited website.
- Backlink or keyword-volume claims without a licensed source.

---

## 3. Product principles

1. **Evidence before advice.** Every finding links to observable evidence.
2. **Deterministic scores.** LLM prose never determines the Website Readiness Score.
3. **Volatile results stay separate.** LLM visibility is a timestamped observation.
4. **Unavailable is not failed.** Tool failure or blocked access does not silently become zero.
5. **No contact gate.** The report appears before any email request.
6. **Data minimization.** Collect only what is needed to run or optionally deliver the audit.
7. **Global by design.** Country, location, currency, and language are explicit inputs.
8. **Safe crawling.** URL processing is isolated and protected against SSRF.
9. **No fabricated recommendations.** Suggested schema, FAQs, and content use confirmed facts only.
10. **Methodology transparency.** Show formulas, limitations, and methodology version.

---

## 4. User journey

### 4.1 Primary flow

1. Visitor selects Arabic or English.
2. Visitor enters a website URL.
3. System validates the URL without crawling private networks.
4. Visitor provides:
   - Organization name.
   - Organization type.
   - Main product or service.
   - Target country, region, city, or worldwide market.
   - Primary customer language.
   - Target audience.
   - Up to three known competitors, optional.
5. Visitor reviews the audit scope and starts the audit.
6. System creates an anonymous audit and returns its private status URL.
7. Background workers crawl and analyze the website.
8. The interface shows honest progress by completed job stage.
9. The report appears directly when sufficient sections complete.
10. Failed optional sections are labelled unavailable; successful sections still appear.
11. Visitor can:
    - Read the report.
    - Download the PDF.
    - Copy implementation recommendations.
    - Optionally enter an email address to receive a link.
    - Delete the audit immediately.

### 4.2 Email flow

- Email is optional and requested only after the report is generated.
- The email contains a private report link and optional PDF attachment or signed download link.
- The email is transactional, not marketing.
- Marketing consent, if ever added, must be a separate unchecked control.
- A delivery request must be idempotent to prevent duplicate messages.

### 4.3 Failure behavior

- If the homepage cannot be retrieved, produce a limited connectivity report.
- If some pages fail, report coverage and continue.
- If an LLM provider fails, mark that provider unavailable and continue.
- If PDF generation fails, preserve the web report and offer PDF retry.
- If email delivery fails, show the report and allow another delivery attempt.

---

## 5. Functional requirements

### 5.1 Landing page

- Arabic and English localized routes.
- Clear explanation of what is tested.
- Clear statement that results are free.
- No claim of guaranteed rankings or recommendations.
- Methodology, Privacy, Terms, and Contact links.
- Example report with synthetic or clearly labelled demonstration data.

### 5.2 Audit form

- Server-side and client-side validation.
- Internationalized country and language selectors.
- Accessible labels and error messages.
- Progress saved temporarily in the browser.
- No phone number.
- No required email.

### 5.3 Crawler

- Fetch `robots.txt`, sitemap candidates, and the homepage.
- Select up to 20 HTML pages for the first release.
- Prioritize homepage, About, Contact, key service/product pages, FAQ, pricing, location, blog/article samples, and pages found in navigation or sitemap.
- Enforce same-site scope unless a redirect establishes the canonical host.
- Render JavaScript only when server HTML is insufficient.
- Record raw fetch evidence, timing, content type, final URL, status, and redirect chain.
- Respect a configurable crawl rate and concurrency limit.

### 5.4 Audit engine

- Execute versioned deterministic rules.
- Store rule input, result, evidence, applicability, and calculation contribution.
- Separate errors from failed rules.
- Calculate category scores and confidence.
- Generate prioritized findings without using LLMs to change pass/fail outcomes.

### 5.5 LLM visibility engine

- Generate exactly eight normalized prompts per audit.
- Run the same prompt semantics against five provider families.
- Use web search or grounding when supported.
- Capture provider response, search execution, citations, latency, usage, and error state.
- Detect organization mentions using aliases, normalized domains, and conservative fuzzy matching.
- Detect recommendations separately from incidental mentions.
- Detect citations of the audited domain separately from mentions.
- Extract other organizations mentioned as observed competitors.
- Preserve raw evidence for the allowed retention period.

### 5.6 Reporting

- Immediate private web report.
- Print-optimized PDF generated from the same normalized report data.
- Arabic PDF supports proper shaping, fonts, RTL, page breaks, and mixed-direction URLs.
- Each finding includes evidence, affected URLs, importance, recommended action, effort, and confidence.
- Show incomplete coverage prominently.
- Show provider and methodology limitations.

### 5.7 Administration

- View audit counts, success rate, provider failures, queue depth, average cost, and average duration.
- Disable a provider without redeploying.
- Configure per-provider model IDs and search limits.
- Configure monthly and per-audit cost caps.
- Delete an audit and its artifacts.
- Re-run a failed stage without duplicating completed billable work.

---

## 6. Standard scoring methodology

### 6.1 Score architecture

The product exposes four independent outputs:

1. **Website Readiness Score:** 0–100.
2. **Category scores:** seven scores from 0–100.
3. **LLM Visibility Scorecard:** observed rates and counts, not folded into readiness.
4. **Evidence Confidence:** High, Medium, or Low.

### 6.2 Website Readiness categories

| Category | Weight |
|---|---:|
| Crawlability and indexability | 20% |
| On-page technical SEO | 15% |
| Structured data and machine readability | 10% |
| Answer Engine Optimization content | 20% |
| GEO entity clarity, authority, and citations | 15% |
| Internationalization, accessibility, and mobile UX | 10% |
| Performance, security, and delivery quality | 10% |
| **Total** | **100%** |

### 6.3 Rule result scale

Each applicable rule returns one of:

- `pass = 1.00`
- `partial = 0.50`
- `fail = 0.00`
- `not_applicable`, excluded from the denominator
- `unavailable`, excluded from the score and reduces confidence
- `error`, excluded from the score and reduces confidence

A rule has an integer importance weight from 1 to 5 inside its category.

For category `c`:

```text
category_score_c =
  100 × Σ(rule_result × rule_weight)
        / Σ(applicable_rule_weight)
```

The overall score is:

```text
readiness_score = Σ(category_score_c × category_weight_c)
```

Calculate with full precision. Display the nearest whole number only at the presentation boundary.

### 6.4 Critical caps

Critical conditions apply transparent caps after the weighted score:

| Critical condition | Maximum overall score |
|---|---:|
| Homepage cannot be retrieved after safe retries | 20 |
| Site-wide `noindex` or equivalent on canonical pages | 25 |
| `robots.txt` blocks all general search crawling | 30 |
| Canonical domain resolves only to an unsafe/private address | No audit; security rejection |
| Valid homepage but main content is empty to both HTML and rendered extraction | 45 |
| HTTPS unavailable or certificate invalid | 60 |

The report must show both the pre-cap weighted score and the applied cap.

### 6.5 Evidence confidence

Confidence is based on weighted measurable coverage:

```text
coverage = measurable_applicable_weight / total_expected_applicable_weight
```

- **High:** coverage ≥ 90%, at least 10 pages inspected, and all critical stages completed.
- **Medium:** coverage ≥ 70% and the homepage plus at least four important pages inspected.
- **Low:** coverage < 70%, fewer than five pages inspected, or a critical stage failed.

Confidence is not statistical probability.

### 6.6 Priority formula

Priority determines recommendation order, not score contribution:

```text
priority_value = impact × reach × confidence_factor / effort
```

Where:

- `impact`: 1–5
- `reach`: number or share of important pages affected, normalized 1–5
- `confidence_factor`: High 1.0, Medium 0.75, Low 0.5
- `effort`: 1–5, where 1 is easiest

Display priorities as Critical, High, Medium, or Low using versioned thresholds.

### 6.7 LLM Visibility Scorecard

Use eight prompts across five provider families, producing up to 40 observations.

Prompt groups:

- Four unbranded discovery prompts.
- Two comparison or shortlist prompts.
- One branded knowledge prompt.
- One source/citation-oriented prompt.

Metrics:

```text
mention_rate = responses_mentioning_entity / valid_responses

recommendation_rate = responses_recommending_entity / valid_discovery_and_comparison_responses

domain_citation_rate = responses_citing_target_domain / valid_responses

provider_coverage = providers_with_valid_responses / configured_providers

share_of_observed_mentions = entity_mentions / all_extracted_organization_mentions
```

Rules:

- Zero valid responses produces `unavailable`, not 0%.
- Branded prompts do not count toward recommendation rate.
- A mention in a cited source list does not count as a recommendation.
- An organization name appearing only inside the submitted prompt does not count as a response mention.
- Display numerators and denominators beside every rate.
- Never describe the result as a universal AI ranking.
- Do not average provider percentages when denominators differ. Aggregate compatible counts.

### 6.8 LLM test repeatability

Version 1 runs one observation per prompt/provider to control cost. The report states that answers vary. A later monitoring product may run three repetitions and report consistency, but a single free audit must not imply repeatability it did not measure.

---

## 7. Audit-rule specification

Every rule record contains:

```text
id
methodology_version
category
title
description
importance_weight
applicability_condition
input_evidence
evaluation_method
pass_condition
partial_condition
fail_condition
result
affected_urls
recommendation_key
source_reference
confidence
```

### 7.1 Crawlability and indexability, 20%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| CRW-001 | Homepage reachable | 5 | Canonical homepage returns usable HTML after safe redirects |
| CRW-002 | Important pages reachable | 4 | At least 90% of selected important pages return usable 2xx responses |
| CRW-003 | Site-wide indexability | 5 | No unintended site-wide `noindex` or `X-Robots-Tag` block |
| CRW-004 | robots.txt availability and syntax | 3 | File is reachable or validly absent and contains no unintended general block |
| CRW-005 | XML sitemap | 3 | Valid sitemap exists and contains canonical indexable URLs |
| CRW-006 | Canonical consistency | 4 | Canonicals are absolute, valid, and consistent with final URLs |
| CRW-007 | Redirect health | 2 | No loops and no chain longer than two redirects for important pages |
| CRW-008 | Crawlable internal links | 3 | Important navigation uses resolvable links rather than inaccessible client-only actions |
| CRW-009 | Status-code integrity | 3 | No material soft 404 or important 4xx/5xx pages |
| CRW-010 | AI/search bot policy visibility | 2 | Relevant crawler directives are explicit and non-conflicting |

### 7.2 On-page technical SEO, 15%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| SEO-001 | Unique page title | 4 | Important pages have descriptive, unique titles |
| SEO-002 | Meta description | 2 | Important pages have useful, non-duplicated descriptions |
| SEO-003 | Single descriptive H1 | 3 | Each important page has a clear primary heading |
| SEO-004 | Heading hierarchy | 2 | Headings form an understandable hierarchy without major skips |
| SEO-005 | Internal linking | 4 | Important pages are linked contextually and through navigation |
| SEO-006 | Descriptive anchors | 2 | Links explain their destination outside isolated UI context |
| SEO-007 | Image alternatives | 2 | Informative images have useful alt text; decorative images are empty-alt |
| SEO-008 | Duplicate content indicators | 3 | Important pages do not materially duplicate each other without canonical handling |
| SEO-009 | Metadata consistency | 2 | Title, H1, description, canonical, and visible topic agree |
| SEO-010 | Open Graph/social metadata | 1 | Share metadata is complete and consistent |

### 7.3 Structured data and machine readability, 10%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| STR-001 | Parseable structured data | 5 | JSON-LD, RDFa, or Microdata parses without syntax errors |
| STR-002 | Appropriate organization/entity type | 4 | Entity type matches visible organization and page content |
| STR-003 | Required properties | 4 | Applicable Google-supported type contains required properties |
| STR-004 | Recommended factual properties | 2 | Useful confirmed properties are present |
| STR-005 | Visible-content consistency | 5 | Markup claims match visible page content |
| STR-006 | Stable entity identifiers | 3 | Entity uses consistent URL, name, logo, and `@id` where appropriate |
| STR-007 | Breadcrumb markup | 1 | Important hierarchical pages include valid breadcrumbs where useful |
| STR-008 | Unsupported/spam markup | 5 | No fabricated ratings, reviews, prices, or irrelevant schema |

Structured data recommendations must follow current Google-supported requirements. Correct structured data can improve understanding and eligibility, but never guarantees a rich result.

### 7.4 AEO content, 20%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| AEO-001 | Clear offering | 5 | Site states what it provides in concrete language |
| AEO-002 | Audience clarity | 3 | Site identifies who the offering serves |
| AEO-003 | Geographic availability | 3 | Service area or worldwide availability is explicit where relevant |
| AEO-004 | Pricing or pricing explanation | 3 | Price, range, quote process, or reason for absence is clear |
| AEO-005 | Process explanation | 3 | Important services explain how engagement or purchase works |
| AEO-006 | Direct question answers | 5 | Key customer questions receive concise answers near descriptive headings |
| AEO-007 | FAQ quality | 2 | FAQ content is useful, non-duplicative, and visible |
| AEO-008 | Comparison and selection guidance | 2 | Site explains suitability, trade-offs, or selection criteria |
| AEO-009 | Answer extractability | 4 | Pages contain self-contained passages that retain meaning when quoted |
| AEO-010 | Content freshness | 2 | Time-sensitive content shows meaningful update information |
| AEO-011 | Contact and next-step clarity | 2 | Users and machines can identify a clear next action |

### 7.5 GEO entity clarity, authority, and citations, 15%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| GEO-001 | Consistent entity name | 5 | Organization name is consistent across major pages and markup |
| GEO-002 | About/entity page | 4 | Site explains the organization, ownership, purpose, and history as applicable |
| GEO-003 | Contact identity | 4 | Legitimate contact details and service location are available where appropriate |
| GEO-004 | Author/editor identity | 3 | Advice or editorial content identifies responsible authors or reviewers |
| GEO-005 | Evidence for claims | 5 | Material claims have primary evidence, methodology, or attributable sources |
| GEO-006 | Source quality | 4 | Citations link to relevant authoritative or primary sources |
| GEO-007 | Original information | 3 | Site contributes specific facts, data, examples, or expert knowledge |
| GEO-008 | Entity connections | 2 | Official profiles and related entities are linked consistently |
| GEO-009 | Reputation signals on site | 2 | Credentials and case evidence are specific and verifiable, not fabricated |
| GEO-010 | Optional machine-readable summary | 1 | A maintained `llms.txt` may earn limited credit; absence is not a failure |

### 7.6 Internationalization, accessibility, and mobile UX, 10%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| I18N-001 | Document language | 4 | Every audited page declares the correct BCP 47 language |
| I18N-002 | Directionality | 4 | RTL pages use correct document direction and mixed-direction handling |
| I18N-003 | hreflang | 3 | Localized equivalents use reciprocal valid annotations where applicable |
| I18N-004 | Localized metadata | 3 | Titles, descriptions, headings, and structured data use the intended locale |
| A11Y-001 | Semantic landmarks | 2 | Main page regions use appropriate semantics |
| A11Y-002 | Accessible names | 3 | Interactive controls have meaningful accessible names |
| A11Y-003 | Keyboard/focus basics | 3 | Key flows are operable and visibly focused by keyboard |
| A11Y-004 | Contrast and reflow sample | 2 | Sampled pages meet baseline contrast and narrow-width reflow expectations |
| MOB-001 | Mobile viewport and layout | 3 | Pages declare viewport and avoid material horizontal overflow |

Do not claim full WCAG conformance from automated testing alone.

### 7.7 Performance, security, and delivery quality, 10%

| ID | Rule | Weight | Pass standard |
|---|---|---:|---|
| PRF-001 | HTTPS | 5 | Valid HTTPS is available and canonical |
| PRF-002 | Response timing | 3 | Sampled response and render measurements fall within disclosed thresholds |
| PRF-003 | Asset efficiency | 2 | No severe image, script, or stylesheet waste in sampled pages |
| PRF-004 | Layout stability sample | 2 | No major observed layout shift during sampled rendering |
| SEC-001 | Mixed content | 4 | No active mixed content on HTTPS pages |
| SEC-002 | Security headers | 2 | Baseline headers are present or absence is explained without overstating risk |
| SEC-003 | Broken resource load | 2 | No material first-party resource failures on sampled pages |
| DEL-001 | Rendered content parity | 4 | Core content is available to the configured renderer and not hidden behind failed execution |

---

## 8. LLM provider specification

### 8.1 Required provider adapters

| Adapter | Required capability | Report label |
|---|---|---|
| OpenAI | Responses API with web search forced when the test requires current web evidence | “OpenAI API with web search” |
| Google | Gemini API with Google Search grounding | “Gemini API grounded with Google Search” |
| Anthropic | Claude API with web search and a strict maximum search count | “Claude API with web search” |
| Perplexity | Current Sonar/search-grounded API with citations | “Perplexity API with web search” |
| xAI | Grok Responses API with web search; X Search is excluded from baseline unless explicitly selected | “Grok API with web search” |

The OpenAI Responses API supports web search with sourced answers. Gemini grounding returns search steps and URL citations. Claude web search returns citations and supports `max_uses`. xAI returns citations from its agent search tools. Provider capabilities and prices must be configuration, not hard-coded assumptions.

### 8.2 Consumer-product limitation

An API response can differ from ChatGPT, Gemini, Claude.ai, Perplexity, or Grok consumer experiences because of model selection, system instructions, account personalization, location, search index, experiments, and product-specific orchestration.

Every report must state:

> These tests use provider APIs configured for web search. They are comparable observations, not exact reproductions of each consumer application.

### 8.3 Standard prompt set

The prompt generator produces localized prompts from confirmed questionnaire values.

1. **Discovery:** Which organizations provide `[offering]` for `[audience]` in `[market]`?
2. **Shortlist:** Recommend reputable providers of `[offering]` in `[market]` and explain why.
3. **Scenario:** I need `[offering]` for `[use case]`. Which providers should I consider?
4. **Local/global discovery:** What are strong options for `[offering]` available to customers in `[market]`?
5. **Comparison:** Compare leading providers of `[offering]` for `[audience]` in `[market]`.
6. **Selection:** Which `[category]` providers best fit `[stated requirement]`?
7. **Branded knowledge:** What does `[organization]` do, and who does it serve?
8. **Citation/source:** What reliable sources explain `[organization]` and its `[offering]`?

Prompts must explicitly request organizations or providers. Avoid ambiguous prompts such as “best web app development,” which may produce technologies rather than companies.

### 8.4 Normalization

- Keep semantics constant across providers.
- Use the chosen customer language.
- Add the same approximate location where supported.
- Do not insert competitor names into unbranded prompts.
- Do not ask the model to mention the audited organization.
- Store the exact final prompt.
- Use bounded search/tool calls.
- Set temperature or equivalent to a low, documented value when available.

### 8.5 Entity matching

Positive matching requires one of:

- Exact normalized organization name.
- Approved alias supplied by the user or extracted from consistent official evidence.
- Exact canonical domain.

Fuzzy matching may suggest a candidate but cannot automatically confirm a mention below the configured confidence threshold. Ambiguous common names require domain or context confirmation.

### 8.6 Citation analysis

For every URL citation:

- Normalize the URL and registrable domain.
- Identify whether it belongs to the audited organization.
- Record the cited page and provider.
- Separate sources inspected by a model from sources cited in the final answer when the API exposes both.
- Do not invent a citation position when the provider does not return one.

---

## 9. Privacy policy baseline

This section is a product requirement and drafting baseline, not jurisdiction-specific legal advice. Final public wording requires qualified legal review because the service operates worldwide.

### 9.1 Roles

- The service operator is the controller for accountless audit requests, delivery emails, security logs, and product analytics.
- LLM, hosting, email, storage, and monitoring providers act as subprocessors or independent providers according to their terms.
- Public website content is processed only to provide the user-requested audit.

### 9.2 Data collected

- Submitted website URL.
- Organization name and business context.
- Selected market, audience, language, and offering.
- Public content retrieved from the submitted site.
- Audit results and generated report.
- LLM prompts, responses, citations, and usage metadata.
- Optional email address.
- Essential security data such as IP address, user agent, request time, and abuse signals.
- Consent state for optional analytics or marketing.

### 9.3 Data not intentionally collected

- Payment information.
- Phone number.
- Website credentials.
- Private analytics or Search Console data.
- Sensitive personal data from the visitor.

If public pages contain sensitive personal information, the crawler must minimize storage and avoid reproducing unnecessary personal details in the report.

### 9.4 Purposes

- Validate and crawl the submitted public website.
- Generate and display the audit.
- Provide the optional report email.
- Prevent abuse and secure the service.
- Measure aggregated product reliability and cost.
- Meet legal obligations.

### 9.5 Lawful-basis model

- Audit processing: performance of the user-requested service or legitimate interests, depending on jurisdiction.
- Optional transactional email: requested service delivery.
- Necessary security logs: legitimate interests and legal obligations.
- Non-essential analytics: consent where required.
- Marketing: separate explicit consent only.

### 9.6 User controls

- Run the audit without providing an email address.
- Delete the audit immediately from the report page.
- Request access, correction, deletion, restriction, or export where applicable.
- Withdraw non-essential consent.
- Contact the operator and relevant supervisory authority.

### 9.7 International transfers and subprocessors

The public policy must name or link to a current subprocessor list. It must explain that providers may process data in other countries and identify the transfer safeguards used where legally required.

### 9.8 Provider disclosure

The audit form must disclose before execution that public website content and generated prompts will be sent to the configured LLM providers to perform visibility tests. Do not send the visitor’s email address, IP address, or unrelated personal data to LLM providers.

### 9.9 Cookies and analytics

- Use only an essential cookie or local-storage key for audit continuity without consent.
- Load non-essential analytics only after valid consent where required.
- Keep analytics events free of URLs that may contain personal data, email addresses, page content, or report text.
- Provide a persistent consent-preference control.

### 9.10 Public policy sections

The released Privacy Policy must include:

1. Operator identity and contact details.
2. Data categories.
3. Sources of data.
4. Purposes and lawful bases.
5. LLM and other recipients.
6. International transfers.
7. Retention schedule.
8. Security practices.
9. User rights and request procedure.
10. Cookies and analytics.
11. Children’s privacy.
12. Automated processing explanation.
13. Policy update procedure and effective date.

### 9.11 Children

The service is not directed to children. Do not knowingly collect optional delivery addresses from users below the applicable minimum age without the required authorization.

---

## 10. Retention schedule

Use a short default because the service has no account requirement and Google Search grounding may impose provider-specific storage and display restrictions.

| Data | Active retention | Deletion behavior |
|---|---:|---|
| Raw fetched HTML and rendered snapshots | 24 hours | Delete after extraction; retain hashes and necessary evidence snippets only |
| Normalized crawl evidence and findings | 30 days | Delete with audit or automatically at expiry |
| Raw LLM prompts and responses | 30 days maximum | Delete earlier when provider terms require it |
| Generated web report | 30 days | Private URL expires; data deleted |
| Generated PDF | 30 days | Object deleted and signed links invalidated |
| Optional delivery email address | 30 days after last delivery attempt | Delete unless separately consented for another purpose |
| Delivery logs without message content | 30 days | Aggregate success metrics may remain non-identifying |
| IP/security and rate-limit logs | 30 days | Delete or irreversibly aggregate |
| Application error logs | 30 days | Redact URLs, page content, prompts, and email addresses |
| Encrypted backups | Up to 35 days after source deletion | Expire automatically; restore process reapplies deletion queue |
| Aggregated anonymous metrics | Indefinite | Must not permit re-identification |
| Separate marketing consent record, if introduced | Until withdrawal plus required legal proof period | Store separately from audit content |

Requirements:

- Show the report expiration date.
- Allow immediate user deletion.
- Run a daily deletion job.
- Record deletion completion without retaining deleted content.
- Apply provider-specific rules when shorter or more restrictive.
- Review Google Grounding display, storage, and citation requirements before launch and on provider changes.

---

## 11. Monthly API and infrastructure budget

### 11.1 Workload assumptions

```text
Completed audits per month: 30
Pages per audit: maximum 20
LLM prompts per audit: 8
Providers per prompt: 5
Maximum provider observations: 30 × 8 × 5 = 1,200
PDFs per month: approximately 30
Optional emails: assume 15–25
```

This is an estimate. Actual cost depends on model IDs, output length, provider search behavior, currencies, taxes, free allowances, and retries.

### 11.2 Recommended cost controls

- Per-audit soft budget: **USD 3.00**.
- Per-audit hard budget: **USD 4.00**.
- Monthly alert: **USD 100**.
- Monthly hard stop: **USD 150**.
- Maximum output per LLM response: about 700–1,000 tokens.
- Maximum provider search uses per prompt: 1–2.
- Maximum automatic retry: one retry for a transient provider failure.
- Do not retry invalid or policy-rejected prompts automatically.
- Cache only when lawful and methodologically valid; never reuse an old result as a new timestamped observation.

### 11.3 Estimated monthly envelope

| Cost area | Expected range |
|---|---:|
| Five-provider LLM visibility tests | USD 20–60 |
| One economical model for report summarization/translation | USD 2–10 |
| Web application and worker compute | USD 10–25 |
| Managed PostgreSQL | USD 0–15 |
| Object storage and bandwidth | USD 0–5 |
| Transactional email | USD 0–2 |
| Monitoring/error reporting | USD 0–10 |
| Domain and miscellaneous monthly equivalent | USD 2–5 |
| **Expected total** | **USD 34–132** |
| **Recommended operating target** | **USD 55–100** |
| **Configured maximum** | **USD 150** |

The upper range protects against search tools issuing multiple calls and against provider price changes. Current public pricing illustrates why configuration is necessary: OpenAI web search is priced per search call plus model tokens; Anthropic lists a separate per-search charge plus tokens; Gemini grounding may charge per executed search query after an allowance; xAI prices server-side search tools separately. Prices must be read from official provider pricing pages before launch and reviewed monthly.

### 11.4 Degradation order at the budget limit

When projected monthly spend reaches thresholds:

1. At 70%, disable automatic provider retries.
2. At 85%, reduce optional report-summarization tokens.
3. At 95%, keep OpenAI, Gemini, Claude, and Perplexity; mark Grok temporarily unavailable.
4. At 100%, continue deterministic website audits and report LLM visibility as unavailable due to the monthly limit.

Never silently represent a skipped provider as a negative result.

---

## 12. Technical architecture

### 12.1 Recommended stack

- TypeScript monorepo.
- Next.js application with server-rendered marketing and report pages.
- PostgreSQL with a type-safe query layer.
- Background job queue with idempotent stages.
- Isolated crawl workers using HTTP parsing first and browser rendering only when needed.
- Private S3-compatible object storage for PDFs and temporary evidence.
- Headless Chromium for PDF output.
- Transactional email provider behind an adapter.
- Provider-specific LLM adapters behind a shared interface.
- OpenTelemetry-compatible logs and traces, with strict redaction.

### 12.2 Component flow

```text
Browser
  │
  ├─ create audit ───────────────► Web application/API
  │                                  │
  │                                  ├─ validate URL and quota
  │                                  ├─ store audit
  │                                  └─ enqueue workflow
  │
  ◄─ private status/report URL ──────┘
                                     │
                                     ▼
                                Job orchestrator
                                  │    │    │
                                  │    │    ├─ LLM provider adapters
                                  │    ├─ deterministic audit engine
                                  └─ safe crawler/browser worker
                                           │
                                           ▼
                                      PostgreSQL + object storage
                                           │
                                           ├─ web report
                                           ├─ PDF renderer
                                           └─ optional email delivery
```

### 12.3 Job stages

```text
VALIDATING
QUEUED
FETCHING_DISCOVERY_FILES
CRAWLING
RENDERING_SELECTED_PAGES
RUNNING_DETERMINISTIC_RULES
RUNNING_LLM_TESTS
CALCULATING_SCORES
GENERATING_REPORT
GENERATING_PDF
COMPLETE | PARTIAL | FAILED
```

Each stage is idempotent and stores attempt count, timestamps, cost, and failure classification.

### 12.4 Core data entities

- `audits`
- `audit_inputs`
- `crawl_targets`
- `crawl_fetches`
- `page_documents`
- `rule_definitions`
- `rule_results`
- `findings`
- `llm_test_prompts`
- `llm_test_runs`
- `llm_mentions`
- `llm_citations`
- `report_versions`
- `report_artifacts`
- `email_deliveries`
- `consent_events`
- `deletion_jobs`
- `cost_ledger`

### 12.5 Provider adapter contract

Each adapter accepts:

```text
audit_id
prompt_id
prompt_text
prompt_language
approximate_location
maximum_search_uses
maximum_output_tokens
timeout
```

It returns:

```text
provider
model_id
started_at
completed_at
search_executed
search_usage
response_text
citations
sources_considered, when exposed
token_usage
estimated_cost
provider_request_id
status
error_class
```

---

## 13. Security requirements

### 13.1 SSRF controls

The audit endpoint accepts attacker-controlled URLs. Before every connection and redirect:

- Allow only HTTP and HTTPS.
- Reject credentials embedded in URLs.
- Normalize hostname and port.
- Resolve all addresses.
- Reject loopback, private, link-local, multicast, reserved, and documentation networks.
- Reject cloud metadata endpoints.
- Pin or revalidate resolved addresses to prevent DNS rebinding.
- Reapply validation after every redirect.
- Limit redirects, bytes, decompressed bytes, pages, depth, and duration.
- Restrict destination ports to an allowlist.
- Block local files and non-HTTP protocols.
- Strip platform credentials and sensitive headers.
- Isolate browser workers with no access to internal services or secrets.

### 13.2 Prompt-injection controls

- Treat all crawled text as untrusted evidence.
- Do not expose general tools or secrets to report-generation prompts.
- Delimit evidence from instructions.
- Use a fixed system policy that forbids following instructions from crawled pages.
- Generate deterministic rule results before any LLM summarization.
- Validate LLM output against a strict schema.
- Prevent generated links or code from executing.
- Record prompt templates by version.

### 13.3 Application controls

- Server-side Zod validation.
- Parameterized database queries.
- Rate limits by IP, normalized domain, and anonymous audit token.
- CSRF protection where cookie-authenticated mutation exists.
- Secure, HttpOnly, SameSite cookies for administrative sessions.
- Content Security Policy and standard security headers.
- Private unguessable report identifiers.
- Signed expiring artifact URLs.
- Secrets stored only in the deployment secret manager.
- Least-privilege provider keys and separate production/staging credentials.
- Audit deletion authorization tied to a one-time secret stored separately from the public ID.

---

## 14. Accessibility and internationalization

- Target WCAG 2.2 AA.
- Use semantic headings, landmarks, forms, and tables.
- Ensure complete keyboard flow and visible focus.
- Provide accessible progress updates without excessive announcements.
- Do not rely on color alone for pass/fail states.
- Support 200% zoom and narrow-screen reflow.
- Respect reduced-motion settings.
- Arabic uses appropriate fonts, `lang="ar"`, `dir="rtl"`, and logical CSS.
- Keep URLs, code, model IDs, formulas, and provider names in isolated LTR spans.
- PDF structure must preserve reading order and selectable text.

Automated checks do not establish full WCAG conformance. Manual keyboard, screen-reader, reflow, and contrast validation are required before launch.

---

## 15. Analytics specification

Use first-party, privacy-conscious events:

| Event | Trigger | Allowed parameters |
|---|---|---|
| `audit_started` | Audit accepted | interface language, target market type |
| `audit_stage_completed` | A stage completes | stage, duration bucket, status |
| `audit_completed` | Report becomes available | status, pages bucket, providers completed count |
| `report_pdf_downloaded` | Signed PDF download starts | report language |
| `report_email_requested` | User submits optional email | report language; never the address |
| `report_deleted` | User deletes audit | age bucket |
| `audit_failed` | Terminal failure | safe error class |

Do not send submitted URLs, organization names, page content, prompts, citations, report IDs, email addresses, IP addresses, or raw error messages to analytics destinations.

---

## 16. Acceptance criteria

### 16.1 Product

- A visitor completes an audit without an account, payment, phone, or email.
- The report is visible immediately after processing.
- Email delivery is optional and available only after report generation.
- Arabic and English flows are complete and equivalent.
- The report states its scope, timestamp, methodology version, and limitations.

### 16.2 Audit correctness

- Every displayed score can be recalculated from stored rule results.
- Unavailable rules are excluded rather than scored as failure.
- Critical caps are visible and tested.
- Each finding includes evidence and affected URL.
- LLM metrics show numerator and denominator.
- The same normalized prompt semantics are used across providers.
- Provider errors do not lower mention or citation rates.

### 16.3 Security

- SSRF tests cover private IPv4/IPv6, redirects, DNS rebinding, encoded hosts, metadata services, and alternate ports.
- Crawled prompt injection cannot call tools, reveal secrets, change score results, or alter report scope.
- Report and deletion tokens cannot be guessed or interchanged.
- Deletion removes active data and queues backup-expiry handling.

### 16.4 Performance

- The web interface becomes interactive within a reasonable mobile budget under the defined test environment.
- A normal 20-page audit completes within a target of 5 minutes.
- A partial report appears if an optional provider exceeds its timeout.
- Report status updates do not require aggressive polling.
- PDF generation completes within 60 seconds after the report is ready.

### 16.5 Accessibility

- Funnel and report are keyboard-operable.
- Form errors are programmatically associated.
- Progress states are announced appropriately.
- Tables have captions and headers.
- Arabic reading and focus order are correct.

---

## 17. Test plan

### 17.1 Unit tests

- URL normalization and IP classification.
- Score formulas and denominators.
- Critical caps.
- Priority formula.
- Entity alias matching.
- Citation normalization.
- Language and direction detection.
- Rule applicability.
- Retention-date calculation.
- Cost ledger and budget gates.

### 17.2 Integration tests

- Static HTML site.
- JavaScript-rendered site.
- Multilingual site.
- Arabic RTL site.
- Site-wide `noindex`.
- Robots-blocked site.
- Invalid sitemap.
- Redirect loop.
- Slow origin.
- Oversized response.
- Provider timeout and partial completion.
- PDF generation and optional email delivery.

### 17.3 Security tests

- Private and loopback IPv4/IPv6.
- Decimal, octal, hexadecimal, and mixed-encoding addresses.
- DNS rebinding fixture.
- Redirect from public to private address.
- Cloud metadata endpoints.
- Non-HTTP protocols.
- Decompression bomb.
- Malicious HTML and prompt injection.
- Cross-audit report/deletion authorization.
- Rate-limit bypass attempts.

### 17.4 End-to-end tests

- English global business.
- Arabic regional organization.
- Non-English target website with English report.
- Audit without email.
- Audit followed by optional email.
- Partial provider outage.
- Immediate deletion.
- Expired report.

---

## 18. Implementation plan

### Phase 0: Decisions and repository foundation

**Outputs**

- Confirm product name and brand.
- Confirm deployment platform.
- Confirm provider accounts and regional availability.
- Confirm operator legal identity and contact address.
- Create repository, environments, CI, secret management, and dependency policy.

**Exit criteria**

- Architecture decision record approved.
- Development and staging environments operational.
- No production keys used in development.

### Phase 1: Bilingual product shell

**Build**

- Arabic and English landing pages.
- Methodology, Privacy, Terms, and Contact pages.
- Audit form and validation.
- Country, market, customer-language, and report-language fields.
- Accessible responsive design system.

**Exit criteria**

- Complete keyboard flow.
- Correct RTL/LTR rendering.
- Server validation matches client validation.

### Phase 2: Safe crawl platform

**Build**

- URL safety service.
- Anonymous audits and private tokens.
- Queue and job state machine.
- HTTP crawler, discovery-file fetcher, page selector, and evidence store.
- Browser-rendering fallback.
- Rate and size limits.

**Exit criteria**

- SSRF suite passes.
- Static and JavaScript test sites produce stored evidence.
- Partial crawl failures are recoverable.

### Phase 3: Deterministic audit engine

**Build**

- Versioned rule registry.
- Rules in Sections 7.1–7.7.
- Score, cap, confidence, and priority calculators.
- Finding templates in Arabic and English.
- Evidence viewer for internal QA.

**Exit criteria**

- Golden fixtures reproduce expected scores.
- Every score is explainable and recalculable.
- No LLM output changes deterministic results.

### Phase 4: Multi-LLM visibility

**Build**

- Five provider adapters.
- Versioned prompt generator.
- Search/citation capture.
- Entity, recommendation, competitor, and citation extraction.
- Cost ledger, timeouts, retries, and provider circuit breakers.

**Exit criteria**

- Eight prompts run against all available providers.
- Raw evidence and usage are stored.
- Provider failures generate `unavailable` states.
- Monthly and per-audit caps are enforced.

### Phase 5: Report and PDF

**Build**

- Executive summary.
- Category breakdown.
- Issue list and page inventory.
- LLM comparison matrix.
- Competitor and citation sections.
- 30/60/90-day plan.
- Suggested schema and content briefs generated from confirmed facts.
- Print styles and Chromium PDF pipeline.

**Exit criteria**

- Web and PDF values match.
- Arabic PDF reading order and shaping pass manual review.
- Partial reports remain useful and honest.

### Phase 6: Optional email, retention, and deletion

**Build**

- Optional email form after report completion.
- Transactional delivery adapter.
- Retention timestamps and expiry jobs.
- User-initiated deletion.
- Backup deletion queue.
- Consent records and cookie preferences.

**Exit criteria**

- No email is requested before report display.
- Delivery is idempotent.
- Deletion and expiry tests pass.

### Phase 7: QA and controlled launch

**Build and verify**

- Accessibility review.
- Threat model and penetration-oriented tests.
- Provider terms and citation-display review.
- Load test above expected scale.
- Cost simulation at 30, 100, and 300 monthly audits.
- Methodology calibration against a labelled set of websites.

**Exit criteria**

- No unresolved critical security finding.
- Legal text approved.
- Cost caps proven.
- Ten internal audits manually reviewed against source evidence.
- Launch runbook and rollback procedure approved.

---

## 19. Initial backlog

### Epic A: Product and localization

- Establish bilingual route and translation architecture.
- Build landing, funnel, status, report, privacy, terms, and methodology pages.
- Add Arabic fonts and bidirectional content utilities.

### Epic B: Audit orchestration

- Create audit API and anonymous token model.
- Implement queue workflow and status stream.
- Add idempotency and retry policy.

### Epic C: Safe crawling

- Implement SSRF-safe URL resolver.
- Implement HTTP crawler and discovery parsing.
- Implement browser fallback and resource limits.
- Add fixture sites for failure modes.

### Epic D: Deterministic rules

- Implement rule registry and scoring.
- Add crawlability and SEO rules.
- Add structured-data rules.
- Add AEO and GEO rules.
- Add accessibility, internationalization, performance, and security samples.

### Epic E: LLM visibility

- Implement provider-neutral interface.
- Add OpenAI, Gemini, Claude, Perplexity, and Grok adapters.
- Add prompt generator and entity matcher.
- Add citation and competitor extraction.
- Add usage/cost ledger.

### Epic F: Reporting

- Implement normalized report schema.
- Build web report components.
- Build PDF renderer.
- Add optional email delivery.
- Add deletion and expiry.

### Epic G: Operations

- Add metrics, traces, alerts, and redaction.
- Add provider health and circuit breakers.
- Add admin controls and cost limits.
- Add launch and incident runbooks.

---

## 20. Launch metrics

For the first 30 monthly users, measure:

- Audit start-to-completion rate.
- Median and 95th percentile completion time.
- Partial-report rate.
- Per-provider success rate.
- Average and maximum cost per completed audit.
- Average pages inspected.
- PDF generation success rate.
- Optional email-request rate.
- Email delivery success rate.
- Audit deletion rate.
- User-reported finding accuracy.

Do not use a fabricated benchmark for success. Establish the first-month baseline, then set thresholds from observed performance and business goals.

---

## 21. Material risks and responses

| Risk | Response |
|---|---|
| LLM answers vary | Timestamp results, name models, preserve prompts, separate visibility from readiness |
| API output differs from consumer products | Label API test method explicitly |
| Global privacy requirements differ | Minimize data, obtain legal review, disclose subprocessors and transfers |
| Google grounded-result terms restrict storage/use | Enforce provider-specific retention and display rules |
| SSRF exposes internal systems | Isolate workers and validate every connection and redirect |
| Prompt injection changes analysis | Deterministic rules, tool isolation, strict schemas, untrusted-content boundaries |
| Free usage is abused | Per-domain/IP limits, quotas, budget caps, circuit breakers |
| A score appears more certain than evidence | Show formulas, coverage, confidence, caps, and unavailable states |
| Suggestions invent facts | Generate only from confirmed evidence and require human review labels |
| Provider prices change | Configuration-based models, monthly price review, hard budget limit |

---

## 22. Decisions still required before coding

1. Product name and domain.
2. Operator legal entity, country, and privacy contact.
3. Hosting region and deployment platform.
4. Exact provider accounts and production model IDs.
5. Transactional email provider and sender domain.
6. Whether audit links may be shared or are strictly bearer-private.
7. Whether the first release supports sites above 20 pages through sampling only.
8. Brand identity and desired visual direction.

None of these decisions changes the scoring methodology described here. They affect implementation configuration, legal text, and deployment.

---

## 23. Primary technical references

- [OpenAI web search documentation](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Gemini grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Anthropic web-search documentation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool)
- [Anthropic pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- [Perplexity API documentation](https://docs.perplexity.ai/)
- [xAI citations documentation](https://docs.x.ai/developers/tools/citations)
- [xAI API pricing](https://docs.x.ai/developers/pricing)
- [Google structured-data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Google structured-data gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google crawling and indexing guidance](https://developers.google.com/search/docs/crawling-indexing)

---

## 24. Recommended next action

Create the repository and implement Phase 0 followed by Phase 1. Before connecting paid APIs, build the provider-neutral adapter contract, cost ledger, deterministic rule registry, and test fixtures. This prevents provider-specific behavior from defining the product methodology.

