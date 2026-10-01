# Arabic and regional market SEO

These are working notes for Arabic content and for Arabic-speaking markets, particularly Saudi Arabia, Kuwait, Qatar and Jordan. Treat any market as a project setting that the request or the site establishes. Don't assume one by default.

## hreflang and market targeting

- **Code format.** A code is a language (ISO 639-1), optionally followed by a region (ISO 3166-1 alpha-2): `ar`, `ar-SA`, `ar-KW`, `ar-QA`, `ar-JO`, `en-SA` and so on. A region on its own (`SA`) is invalid. `ar-AE` is valid, but `ar-UAE` is not.
- **When to use region codes.** Add market-specific codes only when the content really differs by market: prices, currency, availability, delivery areas, legal text. If one Arabic page serves every market, `ar` alone is correct and simpler.
- **Rules for every hreflang set:**
  - Each page lists itself as well as its alternates.
  - Every alternate links back to it (return tags).
  - Every URL in the set returns 200, is indexable and is canonical.
  - Add `x-default` for the language selector or the fallback page.
- **Canonicals and hreflang must agree.** An Arabic page must not canonicalize to the English page. That tells Google the Arabic page is a duplicate.
- **URL structure.** Subfolders (`/ar-sa/`, `/en-kw/`) are the simplest option and share domain signals. ccTLDs (`.sa`, `.com.kw`, `.qa`, `.jo`) give a strong local signal, but each builds authority separately. Any consistent structure works. Don't recommend a migration unless there's a clear, evidenced problem with the current one.
- **Language redirects.** Don't redirect crawlers or users away from a language version based on IP address or browser language. Offer a visible language switcher instead.

## RTL and markup

- **Page direction.** Set `<html lang="ar" dir="rtl">` on Arabic pages. Where Arabic and English are mixed in one element, handle direction with `dir="auto"` or `<bdi>` for embedded Latin text, numbers and prices.
- **Mirroring.** Use logical CSS properties (`margin-inline-start`). Don't mirror everything blindly: logos, code, phone numbers and media controls usually stay left-to-right.
- **Localize every language version fully.** Alt text, titles, meta descriptions, Open Graph tags and structured data text (`name`, `description`) should be in the page's own language.
- **Numbers in structured data.** Prices and phone numbers must use standard digits (0–9), with `.` as the decimal separator. For visible copy, pick one numeral style for the whole site and stick to it.

## Arabic queries: variants to account for

A single topic in Arabic can reach search as many different strings. Collect them during research. Then merge them with `scripts/arabic_keywords.py` when you measure, so one topic doesn't look like several small ones.

What the script merges:
- **By default:** the orthography variants below (alef forms, ة/ه, ى/ي, hamza seats, diacritics, tatweel, Arabic-Indic digits).
- **With `--merge-prefixes`:** also the definite article and attached prepositions (ال، وال، بال، كال، فال، لل) and a standalone في, so بالرياض and في الرياض group together. This is light stemming and can occasionally merge unrelated words, so review every group marked `prefix_merged`.
- **Never:** singular vs plural and dialect synonyms. Group those at clustering, by SERP overlap.

- **Orthography.**
  - Alef forms: أ / إ / آ / ا.
  - Ta marbuta written as ha: ة / ه.
  - Alef maqsura and ya: ى / ي.
  - Hamza on its seat or dropped.
  - Diacritics are rare in queries.
- **Morphology.**
  - With or without the definite article ال.
  - Attached prepositions (بالرياض vs في الرياض).
  - Singular vs plural.
- **Dialect vocabulary.** Everyday product and service words can differ between Gulf, Levantine and other varieties. Include a dialect term only when SERPs, the user's data or the client confirm that people use it, and flag it for native review.
- **English and transliteration.**
  - Many users in these markets search in English for some categories, such as tech, luxury, B2B and expat-facing services.
  - Some search English loanwords written in Arabic script.
  - Some use Arabizi (Arabic written in Latin letters and digits).
  - Check which of these patterns apply to the category. Don't assume them.

Normalization is for **grouping and measuring only**. Published copy uses correct spelling.

## Arabic URL slugs

- **Arabic slugs.** Arabic-script slugs work in search and show up readably in results. They become long percent-encoded strings when copied into some apps, analytics tools and ad platforms.
- **Transliterated or English slugs.** These are shorter to share but carry no Arabic keyword.
- **Choosing.** Either approach is acceptable. Choose one per site and apply it consistently. Never change existing URLs without 301 redirects and updated internal links.

## Local search

- **Business listings.** Google Business Profile with the name, categories, hours and address in the right language. Keep name, address and phone consistent across the site, the map listing and directories.
- **Location pages.** Only build separate branch or city pages when each one has unique, useful content: address, map, hours, services, staff, directions. Pages that change nothing but the city name are doorway pages.
- **Reviews.** Only genuine ones. Never write or suggest fake ones.

## Calendar effects for reporting and content planning

These are fixed or predictable events that shift demand. Account for them before blaming SEO for a change.

- **Religious calendar.** Ramadan, Eid al-Fitr and Eid al-Adha move about 11 days earlier each Gregorian year.
- **National days.**
  - Saudi Arabia: 23 September (plus Founding Day on 22 February).
  - Kuwait: 25–26 February.
  - Qatar: 18 December.
  - Jordan: Independence Day, 25 May.
- **Other seasons.** White Friday / Black Friday in November, summer travel, and school calendars.
- **Weekends.** The weekend is Friday–Saturday in Saudi Arabia, Kuwait, Qatar and Jordan. The UAE moved to a Saturday–Sunday weekend in 2022.
- **Currencies.** SAR, QAR and AED are shown with 2 decimals. KWD, JOD and BHD are shown with 3.
