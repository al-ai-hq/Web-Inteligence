# services/crawler

Crawler service skeleton. No crawling logic at M0A (05 §9).

## Rules

- No credentials here. Crawling uses public endpoints only.
- Rate limiting and robots.txt compliance are mandatory when implemented.
- All crawler output goes through the evidence pipeline, never directly to the database.
