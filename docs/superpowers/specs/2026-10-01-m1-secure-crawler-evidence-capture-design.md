# M1 Secure Crawler and Evidence Capture — Design Specification

**Date:** 2026-10-01  
**Status:** Draft  
**Milestone:** M1  
**Spec Owner:** WPI Team

---

## Overview

M1 delivers the secure crawler and evidence capture pipeline for the WPI V5 bilingual SEO/AEO/GEO audit platform. This subsystem fetches web content safely, renders JavaScript-heavy pages in isolation, processes evidence with tamper detection, and stores normalized audit data.

### Scope

- Cloud Workflow orchestration (sequential two-phase pipeline)
- Crawl Job (fetch + extract in one Cloud Run Job)
- Render Job (Playwright/Chromium in isolated Cloud Run Job)
- Evidence Processor (normalize, validate, hash verification)
- Shared security modules (URL validator, DNS resolver, robots/sitemap parsers)
- Malicious-site test fixtures (7 attack categories)
- Terraform infrastructure (two-project isolation)
- Configuration files (runtime limits)
- File structure and monorepo layout
- Test strategy (TS-SSRF, TS-RENDER, TS-MALSITE, TS-LOGREDACT, TS-IAC)

### Exit Criteria

- **TS-SSRF**: SSRF and DNS rebinding defense verified
- **TS-RENDER**: Renderer isolation verified
- **TS-MALSITE**: Malicious-site safety verified
- **TS-LOGREDACT**: Log and payload redaction verified
- **TS-IAC**: Infrastructure policy verified
- No internal/metadata reachability from crawl identities
- Secrets and databases inaccessible from crawl identities

### Design Decisions

- **Approach A**: Sequential two-phase workflow (crawl → render → evidence processor)
- **Orchestration**: Cloud Workflows
- **Stack**: TypeScript throughout (D-021), pnpm monorepo
- **Runtime**: Cloud Run Jobs for crawl and render (D-008)
- **Crawl structure**: One Cloud Run Job does fetch + extract (state machine)
- **Isolation**: Separate crawl project (threat model TB-02)
- **IAM**: crawl-job and render-job in crawl project; evidence-processor in app project
- **Render threshold**: < 500 bytes text content in raw HTML body triggers render
- **Representative sampling**: Sitemap + BFS merged, deduplicated
- **Crawl-limits defaults**: Derived from USD 150 monthly cap

---

## Section 1: Cloud Workflow Definition

The audit pipeline is orchestrated by a Cloud Workflow that sequences crawl, render (conditional), and evidence processing jobs. The workflow keeps state transitions close to actors and handles errors gracefully.

### Process Workflow

```mermaid
flowchart TD
    A[Start: audit_id, audit_scope] --> B[start_crawl_job]
    B --> C[Wait for crawl-job completion]
    C --> D{Crawl succeeded?}
    D -->|No| E[Transition: CRAWLING → FAILED]
    E --> F[Return error]
    D -->|Yes| G[Read render manifest from landing bucket]
    G --> H{Render needed?}
    H -->|No| I[Skip render job]
    H -->|Yes| J[start_render_job]
    J --> K[Wait for render-job completion]
    K --> L{Render succeeded?}
    L -->|No| M[Log warning, continue with raw evidence only]
    L -->|Yes| N[Rendered evidence in landing bucket]
    I --> O[start_evidence_processor]
    M --> O
    N --> O
    O --> P[Wait for evidence-processor completion]
    P --> Q{Processing succeeded?}
    Q -->|No| R[Transition: EXTRACTING → FAILED]
    R --> S[Return error]
    Q -->|Yes| T[Transition: EXTRACTING → AUDITING]
    T --> U[Return success: audit ready for agent analysis]
```

### Workflow Steps

1. **start_crawl_job**: Launch crawl-job Cloud Run Job in crawl project with `audit_id` and `audit_scope` parameters
2. **check_crawl_result**: Poll job status, wait for completion (15 min timeout)
3. **start_render_job** (conditional): If render manifest exists and has entries, launch render-job
4. **check_render_result**: Poll job status, wait for completion (5 min timeout)
5. **start_evidence_processor**: Launch evidence-processor Cloud Run Job in app project
6. **complete_audit**: Transition audit state to AUDITING, return success

### Error Handling

- **Crawl timeout**: Transition to FAILED, log "crawl timeout after 15 minutes"
- **Security rejection**: Crawl-job returns exit code 42, workflow transitions to FAILED, log "SSRF attempt blocked"
- **Render failure**: Log warning, continue with raw evidence only (partial audit)
- **Evidence processor failure**: Transition to FAILED, log "evidence processing failed"
- **Infrastructure failure**: Workflow retries up to 3 times with exponential backoff

### IAM Permissions

Workflow service account (`workflow-sa`) needs:
- `roles/run.invoker` on crawl-job and render-job (crawl project)
- `roles/run.invoker` on evidence-processor (app project)
- `roles/storage.objectViewer` on landing bucket (read render manifest)

---

## Section 2: Crawl Job

The crawl job is a single Cloud Run Job that performs two phases: **fetch** (HTTP requests with SSRF defense) and **extract** (parse HTML, extract headings, links, language, structured data). It runs in the crawl project with minimal IAM permissions.

### Process Workflow

```mermaid
flowchart TD
    A[Start: audit_id, audit_scope] --> B[Load config: crawl-limits.yaml]
    B --> C[Read audit_scope from Cloud SQL]
    C --> D[URL Planning Phase]
    D --> D1{Sampling mode?}
    D1 -->|single_page| D2[Single URL]
    D1 -->|priority_pages| D3[Priority URLs from sitemap]
    D1 -->|representative_sample| D4[Sitemap + BFS merge, deduplicate]
    D1 -->|full_bounded| D5[BFS up to max_pages, max_depth]
    D2 --> E[Validate each URL with SSRF defense]
    D3 --> E
    D4 --> E
    D5 --> E
    E --> F{All URLs valid?}
    F -->|No| G[Log rejections, continue with valid URLs]
    F -->|Yes| H[Fetch Phase]
    G --> H
    H --> I[For each URL, concurrency=5]
    I --> I1[Resolve DNS via controlled resolver]
    I1 --> I2[Pin IP address]
    I2 --> I3[HTTP GET with timeout=30s]
    I3 --> I4{Redirect?}
    I4 -->|Yes| I5[Re-validate redirect URL with SSRF defense]
    I5 --> I6{Valid?}
    I6 -->|No| I7[Abort, log security rejection]
    I6 -->|Yes| I8[Follow redirect, repeat I3-I6]
    I4 -->|No| I9[Receive response]
    I8 --> I9
    I9 --> I10{Response size < 10 MB?}
    I10 -->|No| I11[Abort, log oversized response]
    I10 -->|Yes| I12[Decompress if needed]
    I11 --> J
    I12 --> I13{Decompressed size < 100 MB?}
    I13 -->|No| I14[Abort, log decompression bomb]
    I13 -->|Yes| I15[Hash content: SHA-256]
    I14 --> J
    I15 --> I16[Write raw evidence to landing bucket]
    I16 --> J[Extract Phase]
    J --> K[For each raw evidence]
    K --> K1[Parse HTML]
    K1 --> K2[Extract headings h1-h6]
    K2 --> K3[Extract links a[href]]
    K3 --> K4[Extract language, direction]
    K4 --> K5[Extract structured data JSON-LD]
    K5 --> K6[Calculate text content bytes]
    K6 --> K7{text_bytes < 500?}
    K7 -->|Yes| K8[Add to render manifest]
    K7 -->|No| K9[Skip render]
    K8 --> L
    K9 --> L
    L[Write render manifest to landing bucket]
    L --> M[Transition: VALIDATING → CRAWLING → EXTRACTING]
    M --> N[Exit 0: success]
```

### URL Planning

Four sampling modes from `audit_scope.sampling_mode`:

1. **single_page**: Fetch only the root URL
2. **priority_pages**: Fetch root + top N URLs from sitemap (sorted by priority)
3. **representative_sample**: Merge sitemap URLs with BFS-discovered URLs, deduplicate by normalized URL, cap at `max_pages`
4. **full_bounded**: BFS from root, follow links up to `max_depth`, cap at `max_pages`

### URL Validation (SSRF Defense)

Every URL validated before fetch:

1. **Scheme**: Only `http:` and `https:` allowed
2. **Credentials**: Reject URLs with `user:pass@host`
3. **Port**: Only 80 and 443 allowed
4. **Metadata hostnames**: Reject `metadata.google.internal`, `169.254.169.254`, etc.
5. **DNS resolution**: Resolve via controlled resolver (no system DNS), reject non-public addresses
6. **Address validation**: Reject loopback, private, link-local, shared, multicast, reserved, documentation, IPv6 local
7. **Address pinning**: Pin validated IP, set Host/SNI headers, connect to pinned IP

### Fetch Phase

- **Concurrency**: 5 parallel workers
- **Timeout**: 30s per request
- **Redirect handling**: Re-validate each redirect URL with full SSRF defense
- **Response size**: Abort if > 10 MB
- **Decompression**: Abort if decompressed > 100 MB
- **Content hash**: SHA-256 of response body
- **Evidence write**: Write to landing bucket with key `{audit_id}/raw/{url_hash}.json`

### Extract Phase

- **HTML parsing**: Use `cheerio` for fast, lenient parsing
- **Headings**: Extract h1-h6 text content
- **Links**: Extract `a[href]` with absolute URLs
- **Language**: Extract `<html lang="...">` and `<meta http-equiv="content-language">`
- **Direction**: Extract `<html dir="...">` and `<bdi dir="...">`
- **Structured data**: Extract JSON-LD from `<script type="application/ld+json">`
- **Text content**: Calculate byte length of visible text (exclude scripts, styles)
- **Render manifest**: If text < 500 bytes, add URL to manifest for render job

### IAM Permissions

Crawl job service account (`crawl-job-sa`) needs:
- `roles/storage.objectCreator` on landing bucket (write raw evidence)
- `roles/logging.logWriter` in crawl project (write logs)
- `roles/cloudsql.client` on app project (read audit_scope)

---

## Section 3: Render Job

The render job is a separate Cloud Run Job that uses Playwright/Chromium to render JavaScript-heavy pages. It runs in the crawl project with strict isolation to prevent SSRF via browser features.

### Process Workflow

```mermaid
flowchart TD
    A[Start: audit_id, render_manifest] --> B[Load config: render-limits.yaml]
    B --> C[Read render manifest from landing bucket]
    C --> D[Launch Playwright browser]
    D --> E[Configure browser context]
    E --> E1[Disable WebSocket]
    E1 --> E2[Disable WebRTC]
    E2 --> E3[Disable downloads]
    E3 --> E4[Disable file URLs]
    E4 --> E5[Disable service workers]
    E5 --> E6[Disable GPU]
    E6 --> E7[Set memory limit: 512 MB]
    E7 --> F[For each URL in manifest]
    F --> G[Set up request interception]
    G --> H{Request URL valid?}
    H -->|No| I[Abort request, log SSRF attempt]
    H -->|Yes| J[Allow request]
    I --> K{Next request?}
    J --> K
    K -->|Yes| G
    K -->|No| L[Navigate to URL]
    L --> M[Wait for network idle: 500ms]
    M --> N{Page timeout > 30s?}
    N -->|Yes| O[Abort page render, log timeout]
    N -->|No| P[Capture DOM snapshot]
    O --> Q{Next URL?}
    P --> Q
    Q -->|Yes| F
    Q -->|No| R[Close browser]
    R --> S[Write rendered evidence to landing bucket]
    S --> T[Exit 0: success]
```

### Renderer Isolation

Browser context configured to prevent SSRF via browser features:

- **WebSocket**: Disabled (no `ws://` or `wss://` connections)
- **WebRTC**: Disabled (no STUN/TURN requests)
- **Downloads**: Disabled (no file save prompts)
- **File URLs**: Disabled (no `file://` navigation or resource loading)
- **Service workers**: Disabled (no SW registration)
- **GPU**: Disabled (no WebGL context)

### Request Interception

Every request intercepted and validated:

1. Extract URL from request
2. Validate with URL validator (same as crawl job)
3. If invalid: abort request, log "SSRF attempt blocked"
4. If valid: allow request to proceed

### Resource Caps

- **Response size**: 10 MB per resource (abort if exceeded)
- **Decompressed size**: 100 MB per resource (abort if exceeded)
- **Per-page timeout**: 30s (abort page render if exceeded)
- **Total job timeout**: 5 min (terminate job if exceeded)
- **Memory limit**: 512 MB (Cloud Run enforces, OOM kills if exceeded)

### Evidence Output

Rendered evidence written to landing bucket with key `{audit_id}/rendered/{url_hash}.json`:

```json
{
  "url": "https://example.com/page",
  "rendered_at": "2026-10-01T12:00:00Z",
  "dom_snapshot": "<html>...</html>",
  "content_hash": "sha256:abc123...",
  "render_duration_ms": 1234
}
```

### IAM Permissions

Render job service account (`render-job-sa`) needs:
- `roles/storage.objectCreator` on landing bucket (write rendered evidence)
- `roles/storage.objectViewer` on landing bucket (read render manifest)
- `roles/logging.logWriter` in crawl project (write logs)

---

## Section 4: Evidence Processor

The evidence processor is a Cloud Run Job in the app project that reads raw and rendered evidence from the landing bucket, re-computes content hashes (AC-12), normalizes to the evidence-object schema, detects injection attempts, and writes normalized evidence to the app evidence bucket.

### Process Workflow

```mermaid
flowchart TD
    A[Start: audit_id] --> B[Read raw evidence from landing bucket]
    B --> C[Read rendered evidence from landing bucket]
    C --> D[For each evidence object]
    D --> E[Re-compute content hash: SHA-256]
    E --> F{Hash matches?}
    F -->|No| G[Log tampering detected, skip evidence]
    F -->|Yes| H[Normalize to evidence-object schema]
    G --> D
    H --> I[Detect injection attempts]
    I --> I1{XSS patterns?}
    I1 -->|Yes| I2[Set injection_suspected: true]
    I1 -->|No| I3{Prompt injection?}
    I3 -->|Yes| I2
    I3 -->|No| I4{CSV injection?}
    I4 -->|Yes| I2
    I4 -->|No| I5[Set injection_suspected: false]
    I2 --> J
    I5 --> J
    J[Merge raw + rendered evidence]
    J --> K{Both raw and rendered exist?}
    K -->|Yes| L[Combine into single evidence object]
    K -->|No| M[Use raw evidence only]
    L --> N[Write to evidence bucket]
    M --> N
    N --> O{Next evidence?}
    O -->|Yes| D
    O -->|No| P[Update audit record: EXTRACTING → AUDITING]
    P --> Q[Exit 0: success]
```

### Hash Verification (AC-12)

For each evidence object:

1. Read raw content from landing bucket
2. Re-compute SHA-256 hash
3. Compare with `content_hash` in evidence metadata
4. If mismatch: log "tampering detected", skip evidence
5. If match: proceed with normalization

### Normalization

Normalize each evidence object to the evidence-object schema:

```json
{
  "audit_id": "audit-123",
  "url": "https://example.com/page",
  "kind": "http_response",
  "fetched_at": "2026-10-01T12:00:00Z",
  "content_hash": "sha256:abc123...",
  "content_type": "text/html",
  "status_code": 200,
  "headers": {...},
  "body": "...",
  "raw_expires_at": "2026-10-02T12:00:00Z",
  "injection_suspected": false,
  "immutable": true
}
```

### Injection Detection

Scan evidence body for injection patterns:

- **XSS**: `<script>`, `javascript:`, `onerror=`, etc.
- **Prompt injection**: `<!-- AI: ... -->`, `<!-- ignore previous instructions -->`, etc.
- **CSV injection**: `=CMD|`, `+CMD|`, `-CMD|`, `@CMD|`, etc.

If any pattern detected: set `injection_suspected: true` in normalized evidence.

### Evidence Merging

If both raw and rendered evidence exist for a URL:

1. Merge into single evidence object
2. Include both `body` (raw HTML) and `rendered_dom` (rendered snapshot)
3. Set `kind: "http_response_with_render"`

### IAM Permissions

Evidence processor service account (`evidence-processor-sa`) needs:
- `roles/storage.objectViewer` on landing bucket (read raw + rendered evidence, cross-project)
- `roles/storage.objectCreator` on evidence bucket (write normalized evidence)
- `roles/cloudsql.client` on app project (read/write audit records)
- `roles/logging.logWriter` in app project (write logs)

---

## Section 5: Shared Security Modules

Shared TypeScript modules used by crawl-job, render-job, and evidence-processor. Published as internal package via pnpm workspace.

### Process Workflow

```mermaid
flowchart TD
    A[URL Validator] --> A1[Check scheme: http/https only]
    A1 --> A2[Check credentials: reject user:pass@]
    A2 --> A3[Check port: 80, 443 only]
    A3 --> A4[Check metadata hostnames]
    A4 --> A5[Resolve DNS via controlled resolver]
    A5 --> A6[Validate resolved addresses]
    A6 --> A7[Pin validated IP]
    A7 --> A8[Return: valid URL + pinned IP]
    
    B[Controlled DNS Resolver] --> B1[Query explicit DNS server: 8.8.8.8, 8.8.4.4]
    B1 --> B2[No caching: fresh resolution each time]
    B2 --> B3[Reject non-public addresses]
    B3 --> B4[Return: resolved IP addresses]
    
    C[Robots Parser] --> C1[Fetch robots.txt]
    C1 --> C2[Parse according to RFC 9309]
    C2 --> C3[Check if URL allowed for user-agent]
    C3 --> C4[Return: allowed/disallowed]
    
    D[Sitemap Parser] --> D1[Fetch sitemap.xml]
    D1 --> D2[Parse XML]
    D2 --> D3{Sitemap index?}
    D3 -->|Yes| D4[Recursively parse child sitemaps]
    D3 -->|No| D5[Extract URLs with priority]
    D4 --> D5
    D5 --> D6[Sort by priority descending]
    D6 --> D7[Return: prioritized URL list]
```

### URL Validator

Validates URLs for SSRF defense:

```typescript
function validateUrl(url: string): ValidationResult {
  // 1. Parse URL
  // 2. Check scheme: http/https only
  // 3. Check credentials: reject user:pass@
  // 4. Check port: 80, 443 only
  // 5. Check metadata hostnames: metadata.google.internal, 169.254.169.254
  // 6. Resolve DNS via controlled resolver
  // 7. Validate resolved addresses (no private, loopback, link-local, etc.)
  // 8. Pin validated IP
  // 9. Return: { valid: true, pinnedIp: "1.2.3.4" } or { valid: false, reason: "..." }
}
```

### Controlled DNS Resolver

Resolves hostnames with DNS rebinding defense:

```typescript
function resolveDns(hostname: string): string[] {
  // 1. Query explicit DNS server (8.8.8.8, 8.8.4.4)
  // 2. No caching: fresh resolution each time
  // 3. Reject non-public addresses
  // 4. Return: array of IP addresses
}
```

### Robots Parser

Parses robots.txt according to RFC 9309:

```typescript
function parseRobots(robotsTxt: string, userAgent: string, url: string): boolean {
  // 1. Parse robots.txt
  // 2. Check if URL allowed for user-agent
  // 3. Return: true if allowed, false if disallowed
}
```

### Sitemap Parser

Parses XML sitemaps:

```typescript
function parseSitemap(sitemapUrl: string): string[] {
  // 1. Fetch sitemap.xml
  // 2. Parse XML
  // 3. If sitemap index: recursively parse child sitemaps
  // 4. Extract URLs with priority
  // 5. Sort by priority descending
  // 6. Return: prioritized URL list
}
```

---

## Section 6: Malicious-Site Test Fixtures

Test fixtures that simulate malicious websites to verify crawler safety. Fixture server runs locally for integration tests.

### Process Workflow

```mermaid
flowchart TD
    A[Fixture Server] --> B[Injection Payloads]
    A --> C[Decompression Bombs]
    A --> D[Tarpits]
    A --> E[Redirect Loops]
    A --> F[Cloaking]
    A --> G[Robots-Blocked Pages]
    A --> H[Oversized Content]
    
    B --> B1[XSS: script>alert/xss/script]
    B --> B2[Prompt injection: AI: ignore...]
    B --> B3[CSV injection: CMD|/C calc]
    
    C --> C1[gzip bomb: 1 MB → 1 GB]
    
    D --> D1[Slow response: 1 byte/sec for 60s]
    
    E --> E1[Infinite loop: A → B → A → B]
    E --> E2[Long chain: A → B → C → ... → K]
    
    F --> F1[Different content for different user-agents]
    
    G --> G1[Page disallowed in robots.txt]
    
    H --> H1[HTML page > 10 MB]
```

### Fixture Categories

1. **Injection payloads**: XSS, prompt injection, CSV injection
2. **Decompression bombs**: gzip bomb (1 MB compressed → 1 GB decompressed)
3. **Tarpits**: Slow response (1 byte/sec for 60s)
4. **Redirect loops**: Infinite loop (A → B → A → B), long chain (A → B → C → ... → K)
5. **Cloaking**: Different content for different user-agents
6. **Robots-blocked pages**: Page disallowed in robots.txt
7. **Oversized content**: HTML page > 10 MB

### Fixture Server

Express server in `services/crawler/tests/fixtures/server.ts` that serves malicious content on localhost:

```typescript
app.get('/xss', (req, res) => {
  res.send('<html><body><script>alert("xss")</script></body></html>');
});

app.get('/gzip-bomb', (req, res) => {
  const bomb = createGzipBomb(); // 1 MB compressed → 1 GB decompressed
  res.setHeader('Content-Encoding', 'gzip');
  res.send(bomb);
});

app.get('/tarpit', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  let i = 0;
  const interval = setInterval(() => {
    res.write('a');
    i++;
    if (i >= 60) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
});
```

### Test Execution

Integration tests verify crawler safety:

```typescript
test('TS-MALSITE: XSS payload does not execute', async () => {
  const result = await crawlJob('http://localhost:3000/xss');
  expect(result.evidence.body).toContain('<script>');
  expect(result.executed).toBe(false);
});

test('TS-MALSITE: gzip bomb detected', async () => {
  const result = await crawlJob('http://localhost:3000/gzip-bomb');
  expect(result.aborted).toBe(true);
  expect(result.reason).toContain('decompression bomb');
});
```

---

## Section 7: Terraform Infrastructure

Infrastructure defined in Terraform across two projects: crawl project (isolated, no database or secrets) and app project (database, secrets, application logic).

### Process Workflow

```mermaid
flowchart TD
    A[Crawl Project] --> B[Cloud Run Jobs]
    A --> C[Service Accounts]
    A --> D[Cloud Storage]
    A --> E[VPC + Egress Firewall]
    A --> F[Cloud NAT + Static IP]
    
    B --> B1[crawl-job]
    B --> B2[render-job]
    
    C --> C1[crawl-job-sa]
    C --> C2[render-job-sa]
    
    D --> D1[landing bucket]
    
    E --> E1[deny egress: private, metadata]
    E --> E2[allow egress: public 80, 443]
    
    G[App Project] --> H[Cloud Run Jobs]
    G --> I[Cloud Run Services]
    G --> J[Cloud SQL]
    G --> K[Cloud Storage]
    G --> L[Service Accounts]
    G --> M[Cloud Workflows]
    G --> N[Secret Manager]
    
    H --> H1[evidence-processor]
    
    I --> I1[Next.js app]
    I --> I2[API]
    
    J --> J1[PostgreSQL]
    
    K --> K1[evidence bucket]
    
    L --> L1[evidence-processor-sa]
    L --> L2[workflow-sa]
    
    M --> M1[audit-pipeline]
    
    N --> N1[API keys]
    N --> N2[OAuth tokens]
    
    O[Cross-Project IAM] --> P[evidence-processor-sa reads landing bucket]
    O --> Q[workflow-sa invokes crawl-job, render-job]
```

### Crawl Project Resources

**Cloud Run Jobs:**
- `crawl-job`: 2 CPU, 4 GB memory, 15 min timeout
- `render-job`: 2 CPU, 2 GB memory, 5 min timeout

**Service Accounts:**
- `crawl-job-sa`: write to landing bucket, write logs, read audit_scope from Cloud SQL
- `render-job-sa`: write to landing bucket, read render manifest, write logs

**Cloud Storage:**
- Landing bucket: 1-day retention, uniform bucket-level access

**VPC and Egress Firewall:**
- Deny egress to private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Deny egress to link-local (169.254.0.0/16, includes metadata)
- Deny egress to loopback (127.0.0.0/8)
- Deny egress to shared (100.64.0.0/10)
- Deny egress to reserved/documentation (192.0.0.0/24, 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
- Deny egress to multicast (224.0.0.0/4)
- Deny egress to reserved (240.0.0.0/4)
- Deny egress to IPv6 private (fc00::/7)
- Deny egress to IPv6 link-local (fe80::/10)
- Deny egress to IPv6 multicast (ff00::/8)
- Allow egress to public internet on ports 80, 443

**Cloud NAT and Static Egress IP:**
- Static IP for allowlisting by target sites
- Cloud NAT for outbound internet access

### App Project Resources

**Cloud Run Jobs:**
- `evidence-processor`: 1 CPU, 2 GB memory, 10 min timeout

**Cloud Run Services:**
- Next.js app
- API

**Cloud SQL:**
- PostgreSQL: audit records, audit scope

**Cloud Storage:**
- Evidence bucket: versioning enabled, 30-day retention

**Service Accounts:**
- `evidence-processor-sa`: read landing bucket (cross-project), write evidence bucket, read/write audit records, write logs
- `workflow-sa`: invoke crawl-job, render-job, evidence-processor, read landing bucket

**Cloud Workflows:**
- `audit-pipeline`: orchestrates crawl → render → evidence processor

**Secret Manager:**
- API keys, OAuth tokens (not accessible from crawl project)

### Cross-Project IAM

- `evidence-processor-sa` reads from landing bucket (storage.objectViewer)
- `workflow-sa` invokes crawl-job and render-job in crawl project (roles/run.invoker)

### Environment Differences

- **Dev**: Fixture sites on localhost, no real Cloud Run Jobs (run locally), landing bucket is local directory
- **Staging**: Fixture sites + malicious-site fixtures on Cloud Run, real Cloud Run Jobs, landing bucket in crawl project
- **Prod**: Public internet, real Cloud Run Jobs, landing bucket in crawl project, static egress IP for allowlisting

---

## Section 8: Configuration Files

Two configuration files control runtime limits. Values derived from USD 150 monthly cap and representative-audit capacity table.

### Process Workflow

```mermaid
flowchart TD
    A[Job Startup] --> B[Load config file from /config/]
    B --> C{Config file exists?}
    C -->|No| D[Load bundled defaults from src/config/defaults.ts]
    C -->|Yes| E[Parse YAML]
    D --> F[Validate with zod schema]
    E --> F
    F --> G{Valid?}
    G -->|No| H[Exit 1: invalid config]
    G -->|Yes| I[Use config values]
```

### `config/crawl-limits.yaml`

```yaml
# Crawl job limits
max_pages: 20                    # representative sample capacity
max_depth: 3                     # BFS depth limit
timeout_seconds: 900             # 15 min total job timeout (state machine A5)
request_timeout_seconds: 30      # per-request timeout
concurrency: 5                   # parallel fetch workers
render_text_threshold_bytes: 500 # trigger render when raw HTML body < 500 bytes text
allowed_ports:                   # AC-09 port allowlist
  - 80
  - 443
max_response_size_bytes: 10485760      # 10 MB per response
max_decompressed_size_bytes: 104857600 # 100 MB decompressed
```

### `config/render-limits.yaml`

```yaml
# Render job limits (Playwright/Chromium)
per_page_timeout_seconds: 30     # AC-11 per-page timeout
total_job_timeout_seconds: 300   # 5 min total job timeout
max_response_size_bytes: 10485760      # 10 MB per resource
max_decompressed_size_bytes: 104857600 # 100 MB decompressed
memory_limit_mb: 512             # AC-11 memory cap
network_idle_timeout_ms: 500     # wait for network idle before snapshot
```

### Configuration Loading

- Both files loaded at job startup from `/config/crawl-limits.yaml` and `/config/render-limits.yaml` (mounted by Cloud Run)
- Fallback to bundled defaults in `services/crawler/src/config/defaults.ts` if files missing
- No environment variable overrides — all limits in config files only (D-010: no hard-coded quotas)
- Schema validation at startup with `zod` — job fails fast if config invalid

### Why These Values

- **max_pages: 20** — cost model shows 20 pages × 3 depth × 5 concurrent fits USD 150 cap for ~150 representative audits/month
- **max_depth: 3** — balances coverage vs. crawl time; deeper pages rarely add SEO value
- **timeout_seconds: 900** — matches state machine A5 transition timeout (15 min)
- **render_text_threshold_bytes: 500** — user-specified threshold for "thin HTML"
- **allowed_ports: [80, 443]** — standard HTTP/HTTPS only (AC-09)
- **max_response_size_bytes: 10 MB** — prevents memory exhaustion from oversized responses
- **max_decompressed_size_bytes: 100 MB** — prevents decompression bombs (AC-11)
- **memory_limit_mb: 512** — Cloud Run job memory limit for render job
- **per_page_timeout_seconds: 30** — prevents tarpits and slow-loris attacks
- **total_job_timeout_seconds: 300** — render job should finish fast; if not, something is wrong

---

## Section 9: File Structure and Monorepo Layout

Complete directory structure for the crawler service and supporting infrastructure.

### Process Workflow

```mermaid
flowchart TD
    A[services/crawler/] --> B[packages/security/]
    A --> C[jobs/crawl-job/]
    A --> D[jobs/render-job/]
    A --> E[jobs/evidence-processor/]
    A --> F[workflows/]
    A --> G[config/]
    A --> H[tests/]
    
    B --> B1[URL validator]
    B --> B2[DNS resolver]
    B --> B3[Robots parser]
    B --> B4[Sitemap parser]
    
    C --> C1[URL planner]
    C --> C2[Fetcher]
    C --> C3[Extractor]
    C --> C4[Render manifest]
    C --> C5[Evidence writer]
    
    D --> D1[Renderer]
    D --> D2[Request interceptor]
    D --> D3[Evidence writer]
    
    E --> E1[Hash verifier]
    E --> E2[Normalizer]
    E --> E3[Injection detector]
    E --> E4[Merger]
    E --> E5[Evidence writer]
    
    F --> F1[audit-workflow.yaml]
    
    G --> G1[crawl-limits.yaml]
    G --> G2[render-limits.yaml]
    
    H --> H1[fixtures/]
    H --> H2[integration/]
    H --> H3[e2e/]
```

### Directory Structure

```
services/crawler/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.json
│
├── packages/
│   └── security/                   # shared security modules (Section 5)
│       ├── package.json
│       ├── src/
│       │   ├── url-validator.ts    # SSRF defense, scheme/port/credentials validation
│       │   ├── dns-resolver.ts     # controlled DNS, rebinding defense
│       │   ├── robots-parser.ts    # RFC 9309 robots.txt parser
│       │   ├── sitemap-parser.ts   # XML sitemap parser
│       │   └── index.ts
│       └── tests/
│           ├── url-validator.test.ts
│           ├── dns-resolver.test.ts
│           ├── robots-parser.test.ts
│           └── sitemap-parser.test.ts
│
├── jobs/
│   ├── crawl-job/                  # Cloud Run Job: fetch + extract (Section 2)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts            # entry point, config loading
│   │   │   ├── url-planner.ts      # sampling modes, BFS, sitemap merge
│   │   │   ├── fetcher.ts          # HTTP client with redirect re-validation
│   │   │   ├── extractor.ts        # headings, links, language, structured data
│   │   │   ├── render-manifest.ts  # generate render manifest (< 500 bytes threshold)
│   │   │   └── evidence-writer.ts  # write raw evidence to landing bucket
│   │   └── tests/
│   │       ├── url-planner.test.ts
│   │       ├── fetcher.test.ts
│   │       ├── extractor.test.ts
│   │       └── render-manifest.test.ts
│   │
│   ├── render-job/                 # Cloud Run Job: Playwright rendering (Section 3)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts            # entry point, config loading
│   │   │   ├── renderer.ts         # Playwright browser management
│   │   │   ├── request-interceptor.ts  # URL validation per request
│   │   │   └── evidence-writer.ts  # write rendered evidence to landing bucket
│   │   └── tests/
│   │       ├── renderer.test.ts
│   │       └── request-interceptor.test.ts
│   │
│   └── evidence-processor/         # Cloud Run Job: normalize + validate (Section 4)
│       ├── package.json
│       ├── src/
│       │   ├── index.ts            # entry point
│       │   ├── hash-verifier.ts    # re-compute content hashes (AC-12)
│       │   ├── normalizer.ts       # normalize to evidence-object schema
│       │   ├── injection-detector.ts   # XSS, prompt injection, CSV injection
│       │   ├── merger.ts           # merge raw + rendered evidence
│       │   └── evidence-writer.ts  # write to app evidence bucket
│       └── tests/
│           ├── hash-verifier.test.ts
│           ├── normalizer.test.ts
│           ├── injection-detector.test.ts
│           └── merger.test.ts
│
├── workflows/
│   └── audit-workflow.yaml         # Cloud Workflow definition (Section 1)
│
├── config/
│   ├── crawl-limits.yaml           # Section 8
│   └── render-limits.yaml          # Section 8
│
└── tests/
    ├── fixtures/                   # malicious-site test fixtures (Section 6)
    │   ├── server.ts               # fixture server
    │   ├── injection-payloads/     # XSS, prompt injection, CSV injection
    │   ├── decompression-bombs/
    │   ├── tarpits/
    │   ├── redirect-loops/
    │   ├── cloaking/
    │   ├── robots-blocked/
    │   └── oversized-content/
    │
    ├── integration/                # integration tests
    │   ├── ssrf-defense.test.ts    # TS-SSRF
    │   ├── renderer-isolation.test.ts  # TS-RENDER
    │   ├── malicious-sites.test.ts # TS-MALSITE
    │   └── log-redaction.test.ts   # TS-LOGREDACT
    │
    └── e2e/                        # end-to-end tests
        └── full-pipeline.test.ts   # crawl → render → evidence processor
```

### Key Structural Decisions

- **packages/security/** — shared modules used by crawl-job, render-job, and evidence-processor; published as internal package via pnpm workspace
- **jobs/** — each Cloud Run Job is a separate package with its own dependencies; crawl-job and render-job in crawl project; evidence-processor in app project (deployed separately)
- **workflows/** — Cloud Workflow YAML definitions; deployed to app project
- **config/** — runtime configuration files; mounted by Cloud Run at `/config/`
- **tests/fixtures/** — malicious-site test fixtures; fixture server runs locally for integration tests
- **tests/integration/** — test suites mapped to exit criteria (TS-SSRF, TS-RENDER, TS-MALSITE, TS-LOGREDACT)
- **tests/e2e/** — full pipeline tests for dev/staging environments

### Deployment Mapping

- **Crawl project**: `jobs/crawl-job/`, `jobs/render-job/`, `packages/security/`, `config/`
- **App project**: `jobs/evidence-processor/`, `workflows/`, `packages/security/` (subset), `config/` (subset)
- **CI/CD**: pnpm workspace builds all packages; deployment scripts push specific jobs to specific projects

---

## Section 10: Test Strategy Specifics

Detailed test cases mapped to M1 exit criteria. All tests run in CI/CD pipeline; integration tests use fixture server.

### Process Workflow

```mermaid
flowchart TD
    A[Unit Tests] --> A1[packages/security unit tests]
    A --> A2[jobs unit tests]
    
    B[Integration Tests] --> B1[TS-SSRF]
    B --> B2[TS-RENDER]
    B --> B3[TS-MALSITE]
    B --> B4[TS-LOGREDACT]
    
    C[E2E Tests] --> C1[TS-IAC]
    C --> C2[Full pipeline]
    
    D[CI/CD Pipeline] --> D1[On every PR: unit + integration]
    D --> D2[On staging deploy: E2E]
```

### TS-SSRF: SSRF and DNS Rebinding Defense

**Test cases:**

1. **Scheme validation**: Reject `file://`, `ftp://`, `gopher://`, `data:`, `javascript:` URLs; accept only `http://` and `https://`
2. **Credentials rejection**: Reject URLs with `user:pass@host` format; reject URLs with `@` in authority
3. **Port allowlist**: Accept ports 80 and 443; reject ports 22, 3306, 5432, 8080, 9090, etc.; reject port 0, negative ports, ports > 65535
4. **Metadata hostname blocking**: Reject `metadata.google.internal`, `169.254.169.254`, `metadata.internal`; reject any hostname resolving to `169.254.0.0/16`
5. **DNS resolution validation**: Resolve hostname via controlled DNS resolver (no system DNS); reject if any resolved address is in private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 100.64.0.0/10, 192.0.0.0/24, 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4, IPv6: fc00::/7, fe80::/10, ff00::/8, ::1/128)
6. **Address pinning**: Resolve once, pin validated IP address; set `Host` header and SNI to original hostname; connect to pinned IP, not hostname (prevents DNS rebinding)
7. **Redirect re-validation**: On each redirect (3xx response), validate new URL with full SSRF checks; reject redirect to private IP, metadata host, non-HTTP scheme; test redirect chain: `public → public → private` (reject at step 3)
8. **DNS rebinding attack**: Mock DNS server returns public IP on first query, private IP on second; verify crawler rejects second resolution; verify crawler uses pinned IP, not re-resolved hostname

### TS-RENDER: Renderer Isolation

**Test cases:**

1. **Disabled features**: WebSocket connections blocked (verify no `ws://` or `wss://` requests); WebRTC blocked (verify no STUN/TURN requests); downloads blocked (verify no file save prompts); file URLs blocked (reject `file://` in navigation or resource loading); service workers disabled (verify no SW registration); GPU disabled (verify no WebGL context)
2. **Request interception**: Every request passes through URL validator; block requests to private IPs, metadata hosts, non-HTTP schemes; test: page tries to load `http://169.254.169.254/computeMetadata` → blocked; test: page tries to load `http://localhost:8080/admin` → blocked
3. **Resource caps**: Response size > 10 MB → request aborted; decompressed size > 100 MB → request aborted; per-page timeout > 30s → page render aborted; total job timeout > 5 min → job terminated; memory usage > 512 MB → job OOM killed (verify Cloud Run enforces)
4. **Network idle detection**: Wait for network idle (500ms no requests) before snapshot; verify snapshot captured after idle, not during loading

### TS-MALSITE: Malicious-Site Fixtures

**Test cases:**

1. **Injection payloads**: XSS: `<script>alert('xss')</script>` in HTML body → crawler does not execute, stores raw; prompt injection: `<!-- AI: ignore previous instructions -->` → stored raw, flagged by evidence processor; CSV injection: `=CMD|'/C calc'!A0` in text content → stored raw, flagged by evidence processor
2. **Decompression bombs**: gzip bomb: 1 MB compressed → 1 GB decompressed → crawler aborts at 100 MB limit; verify crawler logs "decompression bomb detected" and does not crash
3. **Tarpits**: Slow response: 1 byte/sec for 60s → crawler aborts at 30s timeout; verify crawler logs "request timeout" and moves to next URL
4. **Redirect loops**: Infinite redirect: A → B → A → B → ... → crawler detects loop after 10 hops; redirect chain: A → B → C → D → E → F → G → H → I → J → K → crawler stops at max_depth or max_pages
5. **Cloaking**: Different content for different user-agents → crawler uses consistent user-agent; verify crawler logs user-agent used
6. **Robots-blocked pages**: Page disallowed in robots.txt → crawler skips, logs "robots-blocked"; verify evidence does not include blocked page content
7. **Oversized content**: HTML page > 10 MB → crawler aborts, logs "response too large"; verify crawler does not crash or OOM

### TS-LOGREDACT: Log and Payload Redaction

**Test cases:**

1. **URL redaction**: URL with query params: `https://example.com/page?token=secret123` → log shows `https://example.com/page?token=[REDACTED]`; URL with credentials: `https://user:pass@example.com` → rejected before logging (TS-SSRF)
2. **Header redaction**: `Authorization: Bearer token123` → log shows `Authorization: [REDACTED]`; `Cookie: session=abc123` → log shows `Cookie: [REDACTED]`; `X-API-Key: key123` → log shows `X-API-Key: [REDACTED]`
3. **Response body redaction**: Response contains API key pattern (`sk-...`, `ghp_...`, etc.) → evidence processor flags, does not redact raw (raw is immutable); normalized evidence includes `injection_suspected: true` flag
4. **Error message redaction**: Error includes URL with credentials → redact before logging; stack trace includes environment variables → redact before logging

### TS-IAC: Infrastructure Policy (Manual + Automated)

**Test cases:**

1. **Crawl project isolation**: Verify crawl-job-sa has no access to Cloud SQL (app project); verify crawl-job-sa has no access to Secret Manager (app project); verify crawl-job-sa has no access to evidence bucket (app project); automated: `gcloud iam testable-permissions-list` for crawl-job-sa
2. **Egress firewall**: From crawl-job container, attempt to reach `10.0.0.1` → connection refused; from crawl-job container, attempt to reach `169.254.169.254` → connection refused; from crawl-job container, attempt to reach `https://example.com` → success; automated: integration test runs curl commands from within Cloud Run Job
3. **Landing bucket access**: Verify crawl-job-sa can write to landing bucket (storage.objectCreator); verify crawl-job-sa cannot read from landing bucket (no storage.objectViewer); verify evidence-processor-sa can read from landing bucket (cross-project); automated: attempt read/write operations, verify IAM denies/allows
4. **Evidence bucket immutability**: Verify evidence bucket has versioning enabled; attempt to overwrite evidence object → creates new version, does not replace; verify 30-day retention policy in lifecycle rules

### Test Execution

- **Unit tests**: run in CI on every PR (packages/security unit tests, job unit tests)
- **Integration tests**: run in CI on every PR (TS-SSRF, TS-RENDER, TS-MALSITE, TS-LOGREDACT)
  - Fixture server runs on localhost
  - Cloud Run Jobs run locally in dev mode (no real Cloud Run)
  - Landing bucket is local directory in dev
- **E2E tests**: run in staging environment (TS-IAC)
  - Real Cloud Run Jobs in crawl project
  - Real landing bucket in crawl project
  - Real evidence bucket in app project
  - Fixture sites + malicious-site fixtures deployed to Cloud Run

### Exit Criteria Mapping

- **TS-SSRF**: all 8 test categories pass → SSRF and DNS rebinding defense verified
- **TS-RENDER**: all 4 test categories pass → renderer isolation verified
- **TS-MALSITE**: all 7 test categories pass → malicious-site safety verified
- **TS-LOGREDACT**: all 4 test categories pass → log and payload redaction verified
- **TS-IAC**: all 4 test categories pass → infrastructure policy verified
- **No internal/metadata reachability**: TS-SSRF + TS-IAC verify no access to private IPs or metadata
- **Secrets/databases inaccessible from crawl identities**: TS-IAC verifies crawl-job-sa has no access to Secret Manager or Cloud SQL

---

## Appendix A: State Machine Integration

M1 implements the following audit workflow state transitions:

- **A3**: VALIDATING → CRAWLING (URL safety verified, DNS resolved/pinned/public, CapabilityManifest and AuditScope written)
- **A5**: CRAWLING → EXTRACTING (fetch plan finished, raw evidence hashed and stored, redirects re-validated per hop; 15 min timeout)
- **A6**: CRAWLING → FAILED (security rejection or zero usable responses)
- **A7**: EXTRACTING → AUDITING (extraction done, headless render where HTML was thin; actor is "extractor (part of crawler job)"; 10 min timeout)

## Appendix B: IAM Matrix

| Identity | Project | Permissions |
|----------|---------|-------------|
| crawl-job-sa | crawl | Write landing bucket, write logs, read audit_scope (app project) |
| render-job-sa | crawl | Write landing bucket, read render manifest, write logs |
| evidence-processor-sa | app | Read landing bucket (cross-project), write evidence bucket, read/write audit records, write logs |
| workflow-sa | app | Invoke crawl-job, render-job (crawl project), invoke evidence-processor (app project), read landing bucket |

## Appendix C: Cost Model

Crawl and render jobs are hosting variable costs. Per-audit job duration tracked in ledger. Cloud NAT and static egress IP are hosting costs.

- **Crawl job**: 2 CPU, 4 GB memory, 15 min timeout
- **Render job**: 2 CPU, 2 GB memory, 5 min timeout
- **Evidence processor**: 1 CPU, 2 GB memory, 10 min timeout

Cost model shows 20 pages × 3 depth × 5 concurrent fits USD 150 cap for ~150 representative audits/month.

---

**End of Design Specification**
