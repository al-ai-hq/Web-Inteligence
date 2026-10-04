# M5 Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build read-only data connectors (PSI, CrUX) that run in parallel with agents during AUDITING stage, with graceful degradation on failure.

**Architecture:** Connector framework with generic interface + registry + runner. Connectors execute via `Promise.all` alongside agents during AUDITING. Failures add to `unavailable[]` blocks (same pattern as agent failures). No pipeline state machine changes.

**Tech Stack:** TypeScript, Vitest, Node.js fetch API, PSI API v5, CrUX API

**Spec:** docs/superpowers/specs/2026-10-03-m5-connectors-design.md

## Global Constraints

- No `any`/`@ts-ignore` — TypeScript strict mode only
- No client-side secrets — API keys via environment variables only
- No ORM — raw SQL or query builders only
- Vitest + Playwright only — no other test frameworks
- Reports private/non-indexed/deletable/7-day retention
- Keep everything local — no push/PR unless explicitly requested
- Connectors run in parallel with agents during AUDITING (not ENRICHING_OPTIONAL)
- Connector failures don't fail the audit — graceful degradation to `unavailable[]`

---

## File Structure

**Create:**
- `services/connectors/src/types.ts` — Connector, ConnectorResult, ConnectorData interfaces
- `services/connectors/src/runner.ts` — runConnectors() orchestrator
- `services/connectors/src/registry.ts` — Connector registry
- `services/connectors/src/psi/index.ts` — PSI connector implementation
- `services/connectors/src/psi/client.ts` — PSI API client
- `services/connectors/src/psi/types.ts` — PSI response types
- `services/connectors/src/crux/index.ts` — CrUX connector implementation
- `services/connectors/src/crux/client.ts` — CrUX API client
- `services/connectors/src/crux/types.ts` — CrUX response types
- `services/connectors/tests/runner.test.ts` — Runner unit tests
- `services/connectors/tests/psi.test.ts` — PSI connector tests
- `services/connectors/tests/crux.test.ts` — CrUX connector tests

**Modify:**
- `packages/audit-pipeline/src/pipeline.ts:24-36` — Add runConnectors to PipelineDeps
- `packages/audit-pipeline/src/pipeline.ts:78-82` — Parallel execution with Promise.all
- `packages/audit-pipeline/src/composer.ts:98-156` — Accept connectorResults parameter, merge into findings/unavailable
- `apps/web/src/services/container.ts:75-136` — Wire runConnectors in buildPipeline
- `apps/web/public/locales/en.json` — Add connector unavailability i18n keys
- `apps/web/public/locales/ar.json` — Add connector unavailability i18n keys

---

### Task 1: Connector Framework Types

**Files:**
- Create: `services/connectors/src/types.ts`
- Test: `services/connectors/tests/types.test.ts`

**Interfaces:**
- Produces: `Connector`, `ConnectorResult`, `ConnectorData`, `PsiData`, `CruxData`, `AuditContext`

- [ ] **Step 1: Write failing test for Connector interface**

```typescript
// services/connectors/tests/types.test.ts
import { describe, it, expect } from "vitest";
import type { Connector, ConnectorResult, AuditContext } from "../src/types.js";

describe("Connector types", () => {
  it("Connector interface has name and run method", () => {
    const connector: Connector = {
      name: "test",
      run: async (_url: string, _context: AuditContext) => ({
        ok: true,
        connector: "test",
        data: {},
      }),
    };
    expect(connector.name).toBe("test");
    expect(typeof connector.run).toBe("function");
  });

  it("ConnectorResult can be success", () => {
    const result: ConnectorResult = {
      ok: true,
      connector: "test",
      data: {},
    };
    expect(result.ok).toBe(true);
  });

  it("ConnectorResult can be failure", () => {
    const result: ConnectorResult = {
      ok: false,
      connector: "test",
      unavailable_reason_key: "unavailable.connector.test",
    };
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/types.test.ts`
Expected: FAIL — types not defined

- [ ] **Step 3: Define Connector and ConnectorResult types**

```typescript
// services/connectors/src/types.ts
export interface AuditContext {
  locale: "en" | "ar";
  tier: "free" | "rich" | "reduced" | "preview";
}

export interface Connector {
  name: string;
  run(url: string, context: AuditContext): Promise<ConnectorResult>;
}

export type ConnectorResult =
  | { ok: true; connector: string; data: ConnectorData }
  | { ok: false; connector: string; unavailable_reason_key: string };

export interface ConnectorData {
  psi?: PsiData;
  crux?: CruxData;
}

export interface PsiData {
  core_web_vitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
  opportunities: Array<{
    id: string;
    title: string;
    savings_ms?: number;
    severity: "high" | "medium" | "low";
  }>;
}

export interface CruxData {
  metrics: {
    lcp: { good: number; needs_improvement: number; poor: number };
    fid: { good: number; needs_improvement: number; poor: number };
    cls: { good: number; needs_improvement: number; poor: number };
  };
  origin: string;
  effective_connection_type: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/types.ts services/connectors/tests/types.test.ts
git commit -m "feat(connectors): add Connector, ConnectorResult, and data types"
```

---

### Task 2: Connector Registry

**Files:**
- Create: `services/connectors/src/registry.ts`
- Test: `services/connectors/tests/registry.test.ts`

**Interfaces:**
- Consumes: `Connector` from types.ts
- Produces: `getRegistry()`, `setRegistry()`

- [ ] **Step 1: Write failing test for registry**

```typescript
// services/connectors/tests/registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry, setRegistry } from "../src/registry.js";
import type { Connector } from "../src/types.js";

describe("registry", () => {
  beforeEach(() => {
    setRegistry([]);
  });

  it("returns empty array initially", () => {
    const registry = getRegistry();
    expect(registry).toEqual([]);
  });

  it("can set and get registry", () => {
    const mockConnector: Connector = {
      name: "test",
      run: async () => ({ ok: true, connector: "test", data: {} }),
    };
    setRegistry([mockConnector]);
    const registry = getRegistry();
    expect(registry).toHaveLength(1);
    expect(registry[0].name).toBe("test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/registry.test.ts`
Expected: FAIL — registry not defined

- [ ] **Step 3: Implement registry**

```typescript
// services/connectors/src/registry.ts
import type { Connector } from "./types.js";

let registry: Connector[] | null = null;

export function getRegistry(): Connector[] {
  if (registry === null) {
    registry = [];
  }
  return registry;
}

export function setRegistry(connectors: Connector[]): void {
  registry = connectors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/registry.ts services/connectors/tests/registry.test.ts
git commit -m "feat(connectors): add connector registry with get/set"
```

---

### Task 3: Connector Runner

**Files:**
- Create: `services/connectors/src/runner.ts`
- Test: `services/connectors/tests/runner.test.ts`

**Interfaces:**
- Consumes: `Connector`, `ConnectorResult`, `AuditContext` from types.ts, `getRegistry()` from registry.ts
- Produces: `runConnectors(url, context)`

- [ ] **Step 1: Write failing test for runner**

```typescript
// services/connectors/tests/runner.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { runConnectors } from "../src/runner.js";
import { setRegistry } from "../src/registry.js";
import type { Connector } from "../src/types.js";

describe("runConnectors", () => {
  beforeEach(() => {
    setRegistry([]);
  });

  it("runs all connectors in parallel", async () => {
    const mockConnectors: Connector[] = [
      {
        name: "test-1",
        run: async () => ({ ok: true, connector: "test-1", data: {} }),
      },
      {
        name: "test-2",
        run: async () => ({ ok: true, connector: "test-2", data: {} }),
      },
    ];
    setRegistry(mockConnectors);

    const results = await runConnectors("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("handles connector failure gracefully", async () => {
    const mockConnectors: Connector[] = [
      {
        name: "test-1",
        run: async () => ({ ok: true, connector: "test-1", data: {} }),
      },
      {
        name: "test-2",
        run: async () => {
          throw new Error("API down");
        },
      },
    ];
    setRegistry(mockConnectors);

    const results = await runConnectors("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    if (!results[1].ok) {
      expect(results[1].unavailable_reason_key).toBe("unavailable.connector.test-2");
    }
  });

  it("returns empty array when no connectors", async () => {
    const results = await runConnectors("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/runner.test.ts`
Expected: FAIL — runConnectors not defined

- [ ] **Step 3: Implement runner**

```typescript
// services/connectors/src/runner.ts
import { getRegistry } from "./registry.js";
import type { AuditContext, ConnectorResult } from "./types.js";

export async function runConnectors(
  url: string,
  context: AuditContext,
): Promise<ConnectorResult[]> {
  const connectors = getRegistry();
  const results = await Promise.allSettled(
    connectors.map((connector) => connector.run(url, context)),
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      ok: false as const,
      connector: connectors[index].name,
      unavailable_reason_key: `unavailable.connector.${connectors[index].name}`,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/runner.ts services/connectors/tests/runner.test.ts
git commit -m "feat(connectors): add runConnectors orchestrator with graceful failure"
```

---

### Task 4: PSI Connector Types

**Files:**
- Create: `services/connectors/src/psi/types.ts`

**Interfaces:**
- Produces: `PsiApiResponse`, `PsiAudit`

- [ ] **Step 1: Define PSI API response types**

```typescript
// services/connectors/src/psi/types.ts
export interface PsiApiResponse {
  lighthouseResult: {
    audits: Record<string, PsiAudit>;
  };
}

export interface PsiAudit {
  id: string;
  title: string;
  numericValue?: number;
  score?: number;
  details?: {
    items?: Array<{
      url?: string;
      wastedMs?: number;
    }>;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add services/connectors/src/psi/types.ts
git commit -m "feat(connectors): add PSI API response types"
```

---

### Task 5: PSI Client

**Files:**
- Create: `services/connectors/src/psi/client.ts`
- Test: `services/connectors/tests/psi-client.test.ts`

**Interfaces:**
- Consumes: `PsiApiResponse` from psi/types.ts, `PsiData` from types.ts
- Produces: `fetchPsiData(url, apiKey)`

- [ ] **Step 1: Write failing test for PSI client**

```typescript
// services/connectors/tests/psi-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPsiData } from "../src/psi/client.js";

describe("fetchPsiData", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches PSI data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          audits: {
            "largest-contentful-paint": { numericValue: 2500 },
            "max-potential-fid": { numericValue: 100 },
            "cumulative-layout-shift": { numericValue: 0.1 },
            "render-blocking-resources": {
              id: "render-blocking-resources",
              title: "Eliminate render-blocking resources",
              numericValue: 350,
            },
          },
        },
      }),
    } as Response);

    const data = await fetchPsiData("https://example.com", "test-key");
    expect(data.core_web_vitals.lcp).toBe(2500);
    expect(data.core_web_vitals.fid).toBe(100);
    expect(data.core_web_vitals.cls).toBe(0.1);
    expect(data.opportunities).toHaveLength(1);
  });

  it("throws on API error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(
      fetchPsiData("https://example.com", "test-key"),
    ).rejects.toThrow("PSI API returned 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/psi-client.test.ts`
Expected: FAIL — fetchPsiData not defined

- [ ] **Step 3: Implement PSI client**

```typescript
// services/connectors/src/psi/client.ts
import type { PsiData } from "../types.js";
import type { PsiApiResponse, PsiAudit } from "./types.js";

export async function fetchPsiData(
  url: string,
  apiKey: string,
): Promise<PsiData> {
  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy: "mobile",
    category: "performance",
  });

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
    { signal: AbortSignal.timeout(30_000) },
  );

  if (!response.ok) {
    throw new Error(`PSI API returned ${response.status}`);
  }

  const json = (await response.json()) as PsiApiResponse;
  return extractPsiData(json);
}

function extractPsiData(apiResponse: PsiApiResponse): PsiData {
  const audits = apiResponse.lighthouseResult.audits;

  return {
    core_web_vitals: {
      lcp: audits["largest-contentful-paint"]?.numericValue ?? 0,
      fid: audits["max-potential-fid"]?.numericValue ?? 0,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? 0,
    },
    opportunities: extractTopOpportunities(audits, 3),
  };
}

function extractTopOpportunities(
  audits: Record<string, PsiAudit>,
  limit: number,
): PsiData["opportunities"] {
  const opportunities: PsiData["opportunities"] = [];

  for (const [key, audit] of Object.entries(audits)) {
    if (audit.numericValue !== undefined && audit.numericValue > 0) {
      const severity =
        audit.numericValue > 500
          ? "high"
          : audit.numericValue > 200
            ? "medium"
            : "low";
      opportunities.push({
        id: key,
        title: audit.title,
        savings_ms: audit.numericValue,
        severity,
      });
    }
  }

  opportunities.sort((a, b) => (b.savings_ms ?? 0) - (a.savings_ms ?? 0));
  return opportunities.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/psi-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/psi/client.ts services/connectors/tests/psi-client.test.ts
git commit -m "feat(connectors): add PSI API client with Core Web Vitals extraction"
```

---

### Task 6: PSI Connector

**Files:**
- Create: `services/connectors/src/psi/index.ts`
- Test: `services/connectors/tests/psi.test.ts`

**Interfaces:**
- Consumes: `Connector` from types.ts, `fetchPsiData` from psi/client.ts
- Produces: `PsiConnector` class

- [ ] **Step 1: Write failing test for PSI connector**

```typescript
// services/connectors/tests/psi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PsiConnector } from "../src/psi/index.js";

describe("PsiConnector", () => {
  beforeEach(() => {
    vi.stubEnv("WPI_PSI_API_KEY", "test-key");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns unavailable when API key is missing", async () => {
    vi.stubEnv("WPI_PSI_API_KEY", undefined);
    const connector = new PsiConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe(
        "unavailable.connector.psi.missing_api_key",
      );
    }
  });

  it("fetches PSI data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          audits: {
            "largest-contentful-paint": { numericValue: 2500 },
            "max-potential-fid": { numericValue: 100 },
            "cumulative-layout-shift": { numericValue: 0.1 },
          },
        },
      }),
    } as Response);

    const connector = new PsiConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.psi).toBeDefined();
      expect(result.data.psi?.core_web_vitals.lcp).toBe(2500);
    }
  });

  it("handles API error gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const connector = new PsiConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe(
        "unavailable.connector.psi.api_error",
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/psi.test.ts`
Expected: FAIL — PsiConnector not defined

- [ ] **Step 3: Implement PSI connector**

```typescript
// services/connectors/src/psi/index.ts
import type { Connector, ConnectorResult, AuditContext } from "../types.js";
import { fetchPsiData } from "./client.js";

export class PsiConnector implements Connector {
  name = "psi";

  async run(url: string, _context: AuditContext): Promise<ConnectorResult> {
    const apiKey = process.env["WPI_PSI_API_KEY"];
    if (apiKey === undefined || apiKey === "") {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.psi.missing_api_key",
      };
    }

    try {
      const data = await fetchPsiData(url, apiKey);
      return { ok: true, connector: this.name, data: { psi: data } };
    } catch (error) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.psi.api_error",
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/psi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/psi/index.ts services/connectors/tests/psi.test.ts
git commit -m "feat(connectors): add PsiConnector with API key validation"
```

---

### Task 7: CrUX Connector Types

**Files:**
- Create: `services/connectors/src/crux/types.ts`

**Interfaces:**
- Produces: `CruxApiResponse`, `CruxMetric`

- [ ] **Step 1: Define CrUX API response types**

```typescript
// services/connectors/src/crux/types.ts
export interface CruxApiResponse {
  record: {
    key: {
      origin: string;
    };
    metrics: {
      largest_contentful_paint: CruxMetric;
      first_input_delay: CruxMetric;
      cumulative_layout_shift: CruxMetric;
      effective_connection_type?: {
        category: string;
      };
    };
  };
}

export interface CruxMetric {
  good?: {
    percent: number;
  };
  needs_improvement?: {
    percent: number;
  };
  poor?: {
    percent: number;
  };
  category?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add services/connectors/src/crux/types.ts
git commit -m "feat(connectors): add CrUX API response types"
```

---

### Task 8: CrUX Client

**Files:**
- Create: `services/connectors/src/crux/client.ts`
- Test: `services/connectors/tests/crux-client.test.ts`

**Interfaces:**
- Consumes: `CruxApiResponse` from crux/types.ts, `CruxData` from types.ts
- Produces: `fetchCruxData(origin)`

- [ ] **Step 1: Write failing test for CrUX client**

```typescript
// services/connectors/tests/crux-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCruxData } from "../src/crux/client.js";

describe("fetchCruxData", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches CrUX data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        record: {
          key: { origin: "https://example.com" },
          metrics: {
            largest_contentful_paint: {
              good: { percent: 75 },
              needs_improvement: { percent: 20 },
              poor: { percent: 5 },
            },
            first_input_delay: {
              good: { percent: 90 },
              needs_improvement: { percent: 8 },
              poor: { percent: 2 },
            },
            cumulative_layout_shift: {
              good: { percent: 80 },
              needs_improvement: { percent: 15 },
              poor: { percent: 5 },
            },
            effective_connection_type: {
              category: "4G",
            },
          },
        },
      }),
    } as Response);

    const data = await fetchCruxData("https://example.com");
    expect(data.metrics.lcp.good).toBe(75);
    expect(data.metrics.fid.needs_improvement).toBe(8);
    expect(data.metrics.cls.poor).toBe(5);
    expect(data.origin).toBe("https://example.com");
    expect(data.effective_connection_type).toBe("4G");
  });

  it("throws on API error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchCruxData("https://example.com")).rejects.toThrow(
      "CrUX API returned 404",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/crux-client.test.ts`
Expected: FAIL — fetchCruxData not defined

- [ ] **Step 3: Implement CrUX client**

```typescript
// services/connectors/src/crux/client.ts
import type { CruxData } from "../types.js";
import type { CruxApiResponse, CruxMetric } from "./types.js";

export async function fetchCruxData(origin: string): Promise<CruxData> {
  const response = await fetch(
    "https://chromeuxmetrics.googleapis.com/v1/records:queryRecord",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: origin }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`CrUX API returned ${response.status}`);
  }

  const json = (await response.json()) as CruxApiResponse;
  return extractCruxData(json, origin);
}

function extractCruxData(
  apiResponse: CruxApiResponse,
  origin: string,
): CruxData {
  const record = apiResponse.record;

  return {
    metrics: {
      lcp: extractMetricDistribution(record.metrics.largest_contentful_paint),
      fid: extractMetricDistribution(record.metrics.first_input_delay),
      cls: extractMetricDistribution(record.metrics.cumulative_layout_shift),
    },
    origin,
    effective_connection_type:
      record.metrics.effective_connection_type?.category ?? "unknown",
  };
}

function extractMetricDistribution(metric: CruxMetric): {
  good: number;
  needs_improvement: number;
  poor: number;
} {
  return {
    good: metric.good?.percent ?? 0,
    needs_improvement: metric.needs_improvement?.percent ?? 0,
    poor: metric.poor?.percent ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/crux-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/crux/client.ts services/connectors/tests/crux-client.test.ts
git commit -m "feat(connectors): add CrUX API client with metric distribution extraction"
```

---

### Task 9: CrUX Connector

**Files:**
- Create: `services/connectors/src/crux/index.ts`
- Test: `services/connectors/tests/crux.test.ts`

**Interfaces:**
- Consumes: `Connector` from types.ts, `fetchCruxData` from crux/client.ts
- Produces: `CruxConnector` class

- [ ] **Step 1: Write failing test for CrUX connector**

```typescript
// services/connectors/tests/crux.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CruxConnector } from "../src/crux/index.js";

describe("CruxConnector", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches CrUX data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        record: {
          key: { origin: "https://example.com" },
          metrics: {
            largest_contentful_paint: {
              good: { percent: 75 },
              needs_improvement: { percent: 20 },
              poor: { percent: 5 },
            },
            first_input_delay: {
              good: { percent: 90 },
              needs_improvement: { percent: 8 },
              poor: { percent: 2 },
            },
            cumulative_layout_shift: {
              good: { percent: 80 },
              needs_improvement: { percent: 15 },
              poor: { percent: 5 },
            },
            effective_connection_type: {
              category: "4G",
            },
          },
        },
      }),
    } as Response);

    const connector = new CruxConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.crux).toBeDefined();
      expect(result.data.crux?.metrics.lcp.good).toBe(75);
    }
  });

  it("handles API error gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const connector = new CruxConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe(
        "unavailable.connector.crux.api_error",
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/connectors && npm test tests/crux.test.ts`
Expected: FAIL — CruxConnector not defined

- [ ] **Step 3: Implement CrUX connector**

```typescript
// services/connectors/src/crux/index.ts
import type { Connector, ConnectorResult, AuditContext } from "../types.js";
import { fetchCruxData } from "./client.js";

export class CruxConnector implements Connector {
  name = "crux";

  async run(url: string, _context: AuditContext): Promise<ConnectorResult> {
    try {
      const origin = new URL(url).origin;
      const data = await fetchCruxData(origin);
      return { ok: true, connector: this.name, data: { crux: data } };
    } catch (error) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.crux.api_error",
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/connectors && npm test tests/crux.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/connectors/src/crux/index.ts services/connectors/tests/crux.test.ts
git commit -m "feat(connectors): add CruxConnector with origin extraction"
```

---

### Task 10: Register Connectors

**Files:**
- Modify: `services/connectors/src/registry.ts`
- Modify: `services/connectors/src/index.ts`

**Interfaces:**
- Consumes: `PsiConnector` from psi/index.ts, `CruxConnector` from crux/index.ts
- Produces: Updated registry with default connectors

- [ ] **Step 1: Update registry to include default connectors**

```typescript
// services/connectors/src/registry.ts
import type { Connector } from "./types.js";
import { PsiConnector } from "./psi/index.js";
import { CruxConnector } from "./crux/index.js";

let registry: Connector[] | null = null;

export function getRegistry(): Connector[] {
  if (registry === null) {
    registry = [new PsiConnector(), new CruxConnector()];
  }
  return registry;
}

export function setRegistry(connectors: Connector[]): void {
  registry = connectors;
}
```

- [ ] **Step 2: Update public exports**

```typescript
// services/connectors/src/index.ts
export { runConnectors } from "./runner.js";
export { getRegistry, setRegistry } from "./registry.js";
export type {
  Connector,
  ConnectorResult,
  ConnectorData,
  PsiData,
  CruxData,
  AuditContext,
} from "./types.js";
```

- [ ] **Step 3: Run all connector tests**

Run: `cd services/connectors && npm test`
Expected: PASS — all tests pass

- [ ] **Step 4: Commit**

```bash
git add services/connectors/src/registry.ts services/connectors/src/index.ts
git commit -m "feat(connectors): register PSI and CrUX connectors by default"
```

---

### Task 11: Pipeline Integration

**Files:**
- Modify: `packages/audit-pipeline/src/pipeline.ts:24-36` (PipelineDeps interface)
- Modify: `packages/audit-pipeline/src/pipeline.ts:78-82` (parallel execution)
- Test: `packages/audit-pipeline/tests/pipeline-connectors.test.ts`

**Interfaces:**
- Consumes: `ConnectorResult` from @wpi/connectors
- Produces: Updated `PipelineDeps` with `runConnectors`

- [ ] **Step 1: Write failing test for pipeline with connectors**

```typescript
// packages/audit-pipeline/tests/pipeline-connectors.test.ts
import { describe, it, expect } from "vitest";
import { runAuditPipeline, InMemoryAuditStore } from "../src/index.js";
import type { ConnectorResult } from "@wpi/connectors";

describe("pipeline with connectors", () => {
  it("runs connectors in parallel with agents", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await store.create({
      target_url: "https://example.com",
      locale: "en",
      tier: "free",
      context: {},
      secret_hash: "test-hash",
      expires_at: "2026-10-10T00:00:00Z",
    });

    const outcome = await runAuditPipeline(
      {
        store,
        validateUrl: async () => ({ ok: true }),
        crawl: async () => {},
        render: async () => {},
        processEvidence: async () => [],
        runAgents: async () => [],
        runConnectors: async () => [
          {
            ok: true,
            connector: "psi",
            data: {
              psi: {
                core_web_vitals: { lcp: 2500, fid: 100, cls: 0.1 },
                opportunities: [],
              },
            },
          },
          {
            ok: true,
            connector: "crux",
            data: {
              crux: {
                metrics: {
                  lcp: { good: 75, needs_improvement: 20, poor: 5 },
                  fid: { good: 90, needs_improvement: 8, poor: 2 },
                  cls: { good: 80, needs_improvement: 15, poor: 5 },
                },
                origin: "https://example.com",
                effective_connection_type: "4G",
              },
            },
          },
        ],
        tierScopes: {
          free: {
            maxPages: 1,
            comparisons: 0,
            aiVisibilityPanel: false,
            actionBoardCap: 5,
          },
          rich: {
            maxPages: 10,
            comparisons: 3,
            aiVisibilityPanel: true,
            actionBoardCap: 10,
          },
          reduced: {
            maxPages: 5,
            comparisons: 0,
            aiVisibilityPanel: false,
            actionBoardCap: 5,
          },
          preview: {
            maxPages: 1,
            comparisons: 0,
            aiVisibilityPanel: false,
            actionBoardCap: 3,
          },
        },
      },
      auditId,
    );

    expect(outcome).toBe("partial");
    const record = await store.getRaw(auditId);
    expect(record?.status).toBe("READY_PARTIAL");
  });

  it("continues when connectors fail", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await store.create({
      target_url: "https://example.com",
      locale: "en",
      tier: "free",
      context: {},
      secret_hash: "test-hash",
      expires_at: "2026-10-10T00:00:00Z",
    });

    const outcome = await runAuditPipeline(
      {
        store,
        validateUrl: async () => ({ ok: true }),
        crawl: async () => {},
        render: async () => {},
        processEvidence: async () => [],
        runAgents: async () => [],
        runConnectors: async () => [
          {
            ok: false,
            connector: "psi",
            unavailable_reason_key: "unavailable.connector.psi",
          },
        ],
        tierScopes: {
          free: {
            maxPages: 1,
            comparisons: 0,
            aiVisibilityPanel: false,
            actionBoardCap: 5,
          },
          rich: {
            maxPages: 10,
            comparisons: 3,
            aiVisibilityPanel: true,
            actionBoardCap: 10,
          },
          reduced: {
            maxPages: 5,
            comparisons: 0,
            aiVisibilityPanel: false,
            actionBoardCap: 5,
          },
          preview: {
            maxPages: 1,
            comparisons: 0,
            aiVisibilityPanel: false,
            actionBoardCap: 3,
          },
        },
      },
      auditId,
    );

    expect(outcome).toBe("partial");
    const record = await store.getRaw(auditId);
    expect(record?.status).toBe("READY_PARTIAL");
    expect(record?.report?.unavailable).toContainEqual(
      expect.objectContaining({
        reason_key: "unavailable.connector.psi",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/audit-pipeline && npm test tests/pipeline-connectors.test.ts`
Expected: FAIL — runConnectors not in PipelineDeps

- [ ] **Step 3: Add runConnectors to PipelineDeps**

```typescript
// packages/audit-pipeline/src/pipeline.ts (lines 24-36)
export interface PipelineDeps {
  store: AuditStore;
  validateUrl: (url: string) => Promise<{ ok: boolean; reason_key?: string }>;
  crawl: (record: AuditRecord, scope: TierScope) => Promise<void>;
  render: (record: AuditRecord) => Promise<void>;
  processEvidence: (record: AuditRecord) => Promise<string[]>;
  runAgents: (
    record: AuditRecord,
    evidenceIds: string[],
    scope: TierScope,
  ) => Promise<ComposerAgentOutcome[]>;
  runConnectors: (
    url: string,
    context: AuditContext,
  ) => Promise<ConnectorResult[]>;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
}
```

Add import at top:
```typescript
import type { ConnectorResult, AuditContext } from "@wpi/connectors";
```

- [ ] **Step 4: Update pipeline to run connectors in parallel**

```typescript
// packages/audit-pipeline/src/pipeline.ts (lines 78-82)
await requireTransition(deps.store, auditId, "AUDITING");
const [outcomes, connectorResults] = await Promise.all([
  deps.runAgents(raw, evidenceIds, scope),
  deps.runConnectors(raw.target_url, {
    locale: raw.locale,
    tier: raw.tier,
  }),
]);

await requireTransition(deps.store, auditId, "COMPOSING");
const composed = composeSections(outcomes, connectorResults, scope);
```

- [ ] **Step 5: Run test to verify it fails (composer signature mismatch)**

Run: `cd packages/audit-pipeline && npm test tests/pipeline-connectors.test.ts`
Expected: FAIL — composeSections signature mismatch

- [ ] **Step 6: Commit**

```bash
git add packages/audit-pipeline/src/pipeline.ts
git commit -m "feat(pipeline): add runConnectors to PipelineDeps and parallel execution"
```

---

### Task 12: Composer Integration

**Files:**
- Modify: `packages/audit-pipeline/src/composer.ts:98-156`
- Test: `packages/audit-pipeline/tests/composer-connectors.test.ts`

**Interfaces:**
- Consumes: `ConnectorResult` from @wpi/connectors
- Produces: Updated `composeSections` signature

- [ ] **Step 1: Write failing test for composer with connectors**

```typescript
// packages/audit-pipeline/tests/composer-connectors.test.ts
import { describe, it, expect } from "vitest";
import { composeSections } from "../src/composer.js";
import type { ConnectorResult } from "@wpi/connectors";

describe("composeSections with connectors", () => {
  it("merges connector results into unavailable", () => {
    const connectorResults: ConnectorResult[] = [
      {
        ok: false,
        connector: "psi",
        unavailable_reason_key: "unavailable.connector.psi",
      },
    ];

    const result = composeSections([], connectorResults, {
      maxPages: 1,
      comparisons: 0,
      aiVisibilityPanel: false,
      actionBoardCap: 5,
    });

    expect(result.unavailable).toContainEqual({
      section: "performance",
      reason_key: "unavailable.connector.psi",
    });
  });

  it("notes connector availability", () => {
    const connectorResults: ConnectorResult[] = [
      {
        ok: true,
        connector: "psi",
        data: {
          psi: {
            core_web_vitals: { lcp: 2500, fid: 100, cls: 0.1 },
            opportunities: [],
          },
        },
      },
    ];

    const result = composeSections([], connectorResults, {
      maxPages: 1,
      comparisons: 0,
      aiVisibilityPanel: false,
      actionBoardCap: 5,
    });

    expect(result.summary_bullets).toContain("report.summary.performance");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/audit-pipeline && npm test tests/composer-connectors.test.ts`
Expected: FAIL — composeSections signature mismatch

- [ ] **Step 3: Update composeSections signature and implementation**

```typescript
// packages/audit-pipeline/src/composer.ts (lines 98-156)
import type { ConnectorResult } from "@wpi/connectors";

export function composeSections(
  outcomes: ComposerAgentOutcome[],
  connectorResults: ConnectorResult[],
  scope: TierScope,
): ComposeResult {
  const findings: StoredFinding[] = [];
  const unavailable: UnavailableBlock[] = [];
  const costLines: StoredCostLine[] = [];
  const availableSections = new Set<string>();

  for (const outcome of outcomes) {
    const section = SECTION_BY_AGENT[outcome.agent_name] ?? "technical";
    if (!outcome.ok) {
      unavailable.push({
        section,
        reason_key: outcome.unavailable_reason_key ?? `unavailable.agent.${outcome.agent_name}`,
      });
      continue;
    }
    availableSections.add(section);
    for (const finding of outcome.findings) {
      if (finding.result_state === "unavailable") {
        continue;
      }
      findings.push({
        id: randomUUID(),
        agent: outcome.agent_name,
        section,
        severity: deriveSeverity(finding.data),
        state: finding.result_state,
        confidence: finding.confidence,
        evidence_ids: [...finding.evidence_ids],
        data: { ...finding.data },
      });
    }
    if (outcome.cost) {
      costLines.push({
        agent: outcome.agent_name,
        engine: outcome.cost.engine,
        tokens_in: outcome.cost.tokens_in,
        tokens_out: outcome.cost.tokens_out,
        usd: outcome.cost.usd,
      });
    }
  }

  for (const result of connectorResults) {
    if (!result.ok) {
      unavailable.push({
        section: "performance",
        reason_key: result.unavailable_reason_key,
      });
      continue;
    }
    availableSections.add("performance");
  }

  return {
    findings,
    unavailable,
    action_board: deriveActionItems(findings, scope.actionBoardCap),
    summary_bullets: SECTION_ORDER.filter((section) => availableSections.has(section)).map(
      (section) => `report.summary.${section}`,
    ),
    costs: {
      currency: "USD",
      agents: costLines,
      total_usd: costLines.reduce((sum, line) => sum + line.usd, 0),
    },
  };
}
```

Update SECTION_ORDER:
```typescript
const SECTION_ORDER = ["technical", "keywords", "content", "performance"] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/audit-pipeline && npm test tests/composer-connectors.test.ts`
Expected: PASS

- [ ] **Step 5: Run all pipeline tests**

Run: `cd packages/audit-pipeline && npm test`
Expected: PASS — all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/audit-pipeline/src/composer.ts packages/audit-pipeline/tests/composer-connectors.test.ts
git commit -m "feat(composer): accept connectorResults and merge into unavailable/summary"
```

---

### Task 13: Container Wiring

**Files:**
- Modify: `apps/web/src/services/container.ts:75-136`

**Interfaces:**
- Consumes: `runConnectors` from @wpi/connectors
- Produces: Updated `buildPipeline` with `runConnectors`

- [ ] **Step 1: Import runConnectors**

```typescript
// apps/web/src/services/container.ts (add import)
import { runConnectors } from "@wpi/connectors";
```

- [ ] **Step 2: Add runConnectors to buildPipeline**

```typescript
// apps/web/src/services/container.ts (lines 75-136, add after runAgents)
function buildPipeline(fields: PipelineFields) {
  return {
    store: fields.store,
    tierScopes: fields.tierScopes,
    validateUrl: fields.validateUrl,
    outputDir: fields.outputDir,
    geminiApiKey: fields.geminiApiKey,
    crawl: async (record: AuditRecord, scope: TierScope) => {
      await scopedEnv(
        {
          AUDIT_ID: record.id,
          ROOT_URL: record.target_url,
          SITEMAP_URL: `${new URL(record.target_url).origin}/sitemap.xml`,
          SAMPLING_MODE: scope.maxPages <= 1 ? "single_page" : "representative_sample",
          MAX_PAGES: String(scope.maxPages),
          OUTPUT_DIR: fields.outputDir,
        },
        () => runCrawlJob(),
      );
    },
    render: async (record: AuditRecord) => {
      await scopedEnv(
        { AUDIT_ID: record.id, OUTPUT_DIR: fields.outputDir },
        () => runRenderJob(),
      );
    },
    processEvidence: async (record: AuditRecord): Promise<string[]> => {
      await runEvidenceProcessor();
      const files = await readdir(join(fields.outputDir, record.id, "evidence"));
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(/\.json$/, ""));
    },
    runAgents: async (
      record: AuditRecord,
      evidenceIds: string[],
      _scope: TierScope,
    ): Promise<ComposerAgentOutcome[]> => {
      if (fields.geminiApiKey === undefined) {
        return M4_AGENT_NAMES.map((agentName) => ({
          agent_name: agentName,
          ok: false,
          findings: [],
          limitations: [],
          unavailable_reason_key: `unavailable.agent.${agentName}`,
        }));
      }
      return runAgentStage({
        auditId: record.id,
        projectId: record.id,
        targetUrl: record.target_url,
        context: record.context,
        evidenceIds,
        outputDir: fields.outputDir,
        geminiApiKey: fields.geminiApiKey,
        costTracker: new CostTracker(),
      });
    },
    runConnectors: async (url: string, context: { locale: "en" | "ar"; tier: string }) => {
      return runConnectors(url, {
        locale: context.locale,
        tier: context.tier as "free" | "rich" | "reduced" | "preview",
      });
    },
  };
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/services/container.ts
git commit -m "feat(web): wire runConnectors in buildPipeline"
```

---

### Task 14: i18n Keys

**Files:**
- Modify: `apps/web/public/locales/en.json`
- Modify: `apps/web/public/locales/ar.json`

- [ ] **Step 1: Add English i18n keys**

```json
// apps/web/public/locales/en.json (add to unavailable section)
{
  "unavailable": {
    "connector": {
      "psi": {
        "missing_api_key": "Performance data unavailable: API key not configured",
        "api_error": "Performance data unavailable: API error"
      },
      "crux": {
        "api_error": "Real-user metrics unavailable: API error"
      }
    }
  }
}
```

- [ ] **Step 2: Add Arabic i18n keys**

```json
// apps/web/public/locales/ar.json (add to unavailable section)
{
  "unavailable": {
    "connector": {
      "psi": {
        "missing_api_key": "بيانات الأداء غير متاحة: لم يتم تكوين مفتاح API",
        "api_error": "بيانات الأداء غير متاحة: خطأ في API"
      },
      "crux": {
        "api_error": "مقاييس المستخدمين الحقيقيين غير متاحة: خطأ في API"
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/locales/en.json apps/web/public/locales/ar.json
git commit -m "feat(i18n): add connector unavailability keys for EN/AR"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS — all tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Build all packages**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Verify connectors package exports**

Run: `cd services/connectors && npm run build`
Expected: PASS — dist/ created with index.js, runner.js, registry.js, psi/, crux/

---

## Self-Review

**Spec coverage:**
- ✅ PSI connector with API key validation
- ✅ CrUX connector (public API, no key)
- ✅ Parallel execution during AUDITING
- ✅ Graceful degradation to unavailable[]
- ✅ Core Web Vitals extraction
- ✅ Top 3 opportunities
- ✅ No pipeline state machine changes
- ✅ i18n keys for unavailability

**Placeholder scan:**
- ✅ No "TBD", "TODO", "implement later"
- ✅ All code blocks complete
- ✅ All test code complete

**Type consistency:**
- ✅ `Connector` interface used consistently
- ✅ `ConnectorResult` discriminated union used consistently
- ✅ `AuditContext` shape matches across all files
- ✅ `runConnectors` signature matches in pipeline, container, and runner
- ✅ `composeSections` signature updated consistently
