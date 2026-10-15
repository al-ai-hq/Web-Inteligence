# M4 Web Frontend (Free-Audit Vertical Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build apps/web (Next.js App Router) as the free-audit vertical slice: a bilingual (en/ar) anonymous landing page that creates an audit, runs the M0B crawl → extract → M3 agent pipeline through a new `@wpi/audit-pipeline` package, and renders a private, non-indexed, deletable report — plus a deterministic stub mode for E2E.

**Architecture:** Approach A — a new `packages/audit-pipeline` workspace package owns the audit state machine, Postgres store port, composer, report-model builder/validator, agent stage, pipeline orchestrator, and dispatchers; apps/web is a thin Next.js shell (next-intl, Tailwind v4) whose route handlers and server components call into it. The pipeline runs in-process per HTTP request server (Cloud Tasks deferred); `WPI_DISPATCH_MODE=stub` swaps the real pipeline for a canned 6-stage fake so Playwright E2E never needs Postgres or Gemini.

**Tech Stack:** pnpm workspace, TypeScript strict (no `any`, no `@ts-ignore`), Next.js 15 App Router + next-intl 4 + Tailwind CSS v4, zod, `pg` (plain SQL migrations, no ORM), Ajv 2020-12, Vitest, Playwright (chromium), Gemini via `@wpi/agents`.

**Spec:** `docs/superpowers/specs/2026-10-02-m4-web-frontend-design.md` (binding authority — conflicts resolve against it)

## Global Constraints

From spec §10 plus repo rules — every task implicitly includes these:

- pnpm workspace monorepo; strict TypeScript; **no `any`, no `@ts-ignore`**.
- React Server Components by default; `"use client"` only where required; **no client-side secrets or API keys**.
- Every page sets `lang` and `dir` (rtl for Arabic).
- **Exactly one new i18n dependency: `next-intl`.** No ORM. No new test runners beyond Vitest + Playwright (chromium).
- All copy exists in both locales with identical key sets; Arabic is natively authored MSA.
- Reports: private, non-indexed (`X-Robots-Tag: noindex, nofollow` + metadata robots), in-app only, deletable, 7-day retention; **export structurally denied**; degraded sections show `unavailable` + reason, never 0%.
- Audit state machine (verbatim, 03-PRODUCTION-CONTRACTS §audit): `QUEUED → VALIDATING → CRAWLING → EXTRACTING → AUDITING → ENRICHING_OPTIONAL → COMPOSING → READY_PARTIAL|READY_COMPLETE|FAILED|CANCELLED|EXPIRED`; terminals absorbing except → EXPIRED; guarded writes `WHERE status NOT IN ('EXPIRED','CANCELLED') AND deleted_at IS NULL`; zero-row match ⇒ pipeline stops.
- Everything stays local — **no remote, no push, no PR** (no git remote exists).
- Repo-root `pnpm lint` is RED at baseline (~81 pre-existing errors): the gate is **error count not increased**, not zero.
- **Never stage the user's pre-existing dirty files.** Each task's commit steps stage only the exact paths that task created/modified. Never `git add -A` or `git add .`.
- Apps/web uses bundler module resolution (no `.js` import suffixes in `apps/web/**`); all other packages use NodeNext (`.js` suffixes required).
- Import ordering convention: `node:*` builtins first, then external packages, then `@wpi/*`, then relative.

---

### Task 1: Scaffold `@wpi/audit-pipeline` + audit state machine

**Files:**

- Create: `packages/audit-pipeline/package.json`
- Create: `packages/audit-pipeline/tsconfig.json`
- Create: `packages/audit-pipeline/vitest.config.ts`
- Create: `packages/audit-pipeline/src/index.ts`
- Create: `packages/audit-pipeline/src/workflow-states.ts`
- Test: `packages/audit-pipeline/tests/workflow-states.test.ts`
- Modify: root `pnpm-workspace.yaml` — verify `packages/*` glob already covers `packages/audit-pipeline` (it does: `packages/*`); no change needed if confirmed.
- Modify: `services/agents/package.json` — add `exports` map (currently missing; `import "@wpi/agents"` would not resolve)
- Modify: `services/crawler/package.json` — add `exports` map
- Modify: `services/evidence-processor/package.json` — add `exports` map
- Modify: `services/render-job/package.json` — add `exports` map

**Interfaces:**

- Consumes: nothing (first task).
- Produces: `AUDIT_STATUSES`, `AuditStatus`, `TERMINAL_STATUSES`, `TerminalStatus`, `isTerminal(status)`, `canTransition(from, to)` — used by Tasks 6, 7, 11, 12.

- [ ] **Step 1: Create package scaffold files**

`packages/audit-pipeline/package.json`:

```json
{
  "name": "@wpi/audit-pipeline",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@wpi/agents": "workspace:*",
    "@wpi/crawler": "workspace:*",
    "@wpi/evidence-processor": "workspace:*",
    "@wpi/render-job": "workspace:*",
    "@wpi/security": "workspace:*",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "pg": "^8.23.1",
    "yaml": "^2.5.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/pg": "^8.23.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

`packages/audit-pipeline/tsconfig.json` (mirrors `packages/security/tsconfig.json`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

`packages/audit-pipeline/vitest.config.ts` (mirrors `services/agents/vitest.config.ts`):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
```

`packages/audit-pipeline/src/index.ts` (placeholder for now):

```ts
export const AUDIT_PIPELINE_VERSION = "0.0.0";
```

**Exports-map fix for the four service packages.** `packages/security/package.json` already has an `exports` map, but `@wpi/agents`, `@wpi/crawler`, `@wpi/evidence-processor`, and `@wpi/render-job` do not — without it, importing them from `@wpi/audit-pipeline` fails module resolution. In each of the four `package.json` files, add this field directly after the `"type": "module",` line (keep all existing fields):

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
},
```

- [ ] **Step 2: Write the failing tests**

`packages/audit-pipeline/tests/workflow-states.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AUDIT_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  isTerminal,
} from "../src/workflow-states.js";

describe("workflow states", () => {
  it("exposes exactly the 12 contract statuses in pipeline order", () => {
    expect([...AUDIT_STATUSES]).toEqual([
      "QUEUED",
      "VALIDATING",
      "CRAWLING",
      "EXTRACTING",
      "AUDITING",
      "ENRICHING_OPTIONAL",
      "COMPOSING",
      "READY_PARTIAL",
      "READY_COMPLETE",
      "FAILED",
      "CANCELLED",
      "EXPIRED",
    ]);
  });

  it("allows the happy path QUEUED through COMPOSING to READY_COMPLETE", () => {
    expect(canTransition("QUEUED", "VALIDATING")).toBe(true);
    expect(canTransition("VALIDATING", "CRAWLING")).toBe(true);
    expect(canTransition("CRAWLING", "EXTRACTING")).toBe(true);
    expect(canTransition("EXTRACTING", "AUDITING")).toBe(true);
    expect(canTransition("AUDITING", "COMPOSING")).toBe(true);
    expect(canTransition("COMPOSING", "READY_COMPLETE")).toBe(true);
    expect(canTransition("COMPOSING", "READY_PARTIAL")).toBe(true);
  });

  it("allows failure from every active stage", () => {
    expect(canTransition("VALIDATING", "FAILED")).toBe(true);
    expect(canTransition("CRAWLING", "FAILED")).toBe(true);
    expect(canTransition("EXTRACTING", "FAILED")).toBe(true);
    expect(canTransition("AUDITING", "FAILED")).toBe(true);
    expect(canTransition("ENRICHING_OPTIONAL", "FAILED")).toBe(true);
    expect(canTransition("COMPOSING", "FAILED")).toBe(true);
  });

  it("allows only EXPIRED out of terminal states", () => {
    expect(canTransition("READY_COMPLETE", "EXPIRED")).toBe(true);
    expect(canTransition("READY_PARTIAL", "EXPIRED")).toBe(true);
    expect(canTransition("FAILED", "EXPIRED")).toBe(true);
    expect(canTransition("CANCELLED", "EXPIRED")).toBe(true);
    expect(canTransition("READY_COMPLETE", "CRAWLING")).toBe(false);
    expect(canTransition("FAILED", "COMPOSING")).toBe(false);
    expect(canTransition("EXPIRED", "EXPIRED")).toBe(false);
  });

  it("rejects skips and backwards moves", () => {
    expect(canTransition("QUEUED", "CRAWLING")).toBe(false);
    expect(canTransition("CRAWLING", "VALIDATING")).toBe(false);
    expect(canTransition("QUEUED", "FAILED")).toBe(false);
  });

  it("classifies terminals", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(isTerminal(status)).toBe(true);
    }
    expect(isTerminal("CRAWLING")).toBe(false);
    expect(isTerminal("QUEUED")).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: FAIL — cannot resolve `../src/workflow-states.js` (module not found).

- [ ] **Step 4: Write minimal implementation**

`packages/audit-pipeline/src/workflow-states.ts`:

```ts
export const AUDIT_STATUSES = [
  "QUEUED",
  "VALIDATING",
  "CRAWLING",
  "EXTRACTING",
  "AUDITING",
  "ENRICHING_OPTIONAL",
  "COMPOSING",
  "READY_PARTIAL",
  "READY_COMPLETE",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const TERMINAL_STATUSES = [
  "READY_PARTIAL",
  "READY_COMPLETE",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminal(status: AuditStatus): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

const TRANSITIONS: Record<AuditStatus, readonly AuditStatus[]> = {
  QUEUED: ["VALIDATING"],
  VALIDATING: ["CRAWLING", "FAILED"],
  CRAWLING: ["EXTRACTING", "FAILED"],
  EXTRACTING: ["AUDITING", "FAILED"],
  AUDITING: ["COMPOSING", "FAILED"],
  ENRICHING_OPTIONAL: ["COMPOSING", "FAILED"],
  COMPOSING: ["READY_PARTIAL", "READY_COMPLETE", "FAILED"],
  READY_PARTIAL: ["EXPIRED"],
  READY_COMPLETE: ["EXPIRED"],
  FAILED: ["EXPIRED"],
  CANCELLED: ["EXPIRED"],
  EXPIRED: [],
};

export function canTransition(from: AuditStatus, to: AuditStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
```

Replace `packages/audit-pipeline/src/index.ts` with:

```ts
export const AUDIT_PIPELINE_VERSION = "0.0.0";

export { AUDIT_STATUSES, TERMINAL_STATUSES, canTransition, isTerminal } from "./workflow-states.js";
export type { AuditStatus, TerminalStatus } from "./workflow-states.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS (7 tests).

- [ ] **Step 6: Install workspace links**

Run: `pnpm install`
Expected: lockfile updated, `@wpi/audit-pipeline` linked.

- [ ] **Step 7: Commit**

```bash
git add packages/audit-pipeline/package.json packages/audit-pipeline/tsconfig.json packages/audit-pipeline/vitest.config.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/src/workflow-states.ts packages/audit-pipeline/tests/workflow-states.test.ts services/agents/package.json services/crawler/package.json services/evidence-processor/package.json services/render-job/package.json pnpm-lock.yaml
git commit -m "feat(audit-pipeline): scaffold package with audit state machine"
```

---

### Task 2: Audit context schema (zod)

**Files:**

- Create: `packages/audit-pipeline/src/audit-context.ts`
- Test: `packages/audit-pipeline/tests/audit-context.test.ts`
- Modify: `packages/audit-pipeline/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `LOCALES`, `Locale`, `auditContextSchema`, `AuditContext`, `createAuditRequestSchema`, `CreateAuditRequest` — used by Tasks 6 (store context field), 10 (agent stage), 15 (POST route).

- [ ] **Step 1: Write the failing tests**

`packages/audit-pipeline/tests/audit-context.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditContextSchema, createAuditRequestSchema } from "../src/audit-context.js";

const validContext = {
  organization: "Example Ltd",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Facility managers",
};

describe("auditContextSchema", () => {
  it("accepts the six required questions from 02-DETAILED-SPECIFICATION §Context", () => {
    expect(auditContextSchema.parse(validContext)).toEqual(validContext);
  });

  it("accepts optional competitors and up to 10 target keywords", () => {
    const parsed = auditContextSchema.parse({
      ...validContext,
      competitors: "competitor-a.com",
      target_keywords: ["office chairs", "standing desks"],
    });
    expect(parsed.target_keywords).toHaveLength(2);
  });

  it("rejects more than 10 target keywords", () => {
    const keywords = Array.from({ length: 11 }, (_, i) => `keyword-${i}`);
    expect(
      auditContextSchema.safeParse({ ...validContext, target_keywords: keywords }).success,
    ).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(auditContextSchema.safeParse({ ...validContext, bonus: "x" }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { organization: _omitted, ...incomplete } = validContext;
    expect(auditContextSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe("createAuditRequestSchema", () => {
  it("accepts url, locale, context", () => {
    const parsed = createAuditRequestSchema.parse({
      url: "https://example.com",
      locale: "ar",
      context: validContext,
    });
    expect(parsed.locale).toBe("ar");
  });

  it("rejects unknown locales and unknown top-level keys", () => {
    expect(
      createAuditRequestSchema.safeParse({
        url: "https://example.com",
        locale: "fr",
        context: validContext,
      }).success,
    ).toBe(false);
    expect(
      createAuditRequestSchema.safeParse({
        url: "https://example.com",
        locale: "en",
        context: validContext,
        extra: 1,
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: FAIL — `audit-context.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/audit-pipeline/src/audit-context.ts`:

```ts
import { z } from "zod";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const auditContextSchema = z
  .object({
    organization: z.string().min(1).max(200),
    business_type: z.string().min(1).max(200),
    offering: z.string().min(1).max(300),
    market: z.string().min(1).max(200),
    customer_language: z.string().min(1).max(50),
    audience: z.string().min(1).max(300),
    competitors: z.string().max(500).optional(),
    target_keywords: z.array(z.string().min(1).max(100)).max(10).optional(),
  })
  .strict();

export type AuditContext = z.infer<typeof auditContextSchema>;

export const createAuditRequestSchema = z
  .object({
    url: z.string().min(1).max(2048),
    locale: z.enum(LOCALES),
    context: auditContextSchema,
  })
  .strict();

export type CreateAuditRequest = z.infer<typeof createAuditRequestSchema>;
```

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export { LOCALES, auditContextSchema, createAuditRequestSchema } from "./audit-context.js";
export type { AuditContext, CreateAuditRequest, Locale } from "./audit-context.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS (12 tests total across the package).

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/audit-context.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/audit-context.test.ts
git commit -m "feat(audit-pipeline): audit context and create-audit request schemas"
```

---

### Task 3: Secret-link helpers (audit secret + eligibility cookie)

**Files:**

- Create: `packages/audit-pipeline/src/secrets.ts`
- Test: `packages/audit-pipeline/tests/secrets.test.ts`
- Modify: `packages/audit-pipeline/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `ELIGIBILITY_COOKIE_NAME`, `generateAuditSecret()`, `hashAuditSecret(secret)`, `EligibilityCounts`, `signEligibilityCookie(counts, secret)`, `verifyEligibilityCookie(value, secret)`, `incrementEligibilityCookie(counts, tier, secret)` — used by Tasks 4, 15, 16.

- [ ] **Step 1: Write the failing tests**

`packages/audit-pipeline/tests/secrets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  signEligibilityCookie,
  verifyEligibilityCookie,
} from "../src/secrets.js";

describe("audit secret", () => {
  it("generates 43-char base64url secrets", () => {
    const secret = generateAuditSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes deterministically with sha256: prefix", () => {
    expect(hashAuditSecret("abc")).toBe(hashAuditSecret("abc"));
    expect(hashAuditSecret("abc")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("eligibility cookie", () => {
  const counts = { rich_count: 1, reduced_count: 0, preview_count: 2 };

  it("round-trips sign -> verify", () => {
    const signed = signEligibilityCookie(counts, "test-secret");
    expect(verifyEligibilityCookie(signed, "test-secret")).toEqual(counts);
  });

  it("rejects a tampered body", () => {
    const signed = signEligibilityCookie(counts, "test-secret");
    const [body, mac] = signed.split(".");
    const forged = Buffer.from(
      JSON.stringify({ rich_count: 99, reduced_count: 0, preview_count: 0 }),
    ).toString("base64url");
    expect(verifyEligibilityCookie(`${forged}.${mac}`, "test-secret")).toBeNull();
  });

  it("rejects a wrong secret", () => {
    const signed = signEligibilityCookie(counts, "test-secret");
    expect(verifyEligibilityCookie(signed, "other-secret")).toBeNull();
  });

  it("rejects garbage, empty, and multi-dot values", () => {
    expect(verifyEligibilityCookie("", "s")).toBeNull();
    expect(verifyEligibilityCookie("nonsense", "s")).toBeNull();
    expect(verifyEligibilityCookie("a.b.c", "s")).toBeNull();
  });

  it("rejects a valid MAC over non-integer counts", () => {
    const body = Buffer.from(
      JSON.stringify({ rich_count: -1, reduced_count: 0, preview_count: 0 }),
    ).toString("base64url");
    const signed = signEligibilityCookie(counts, "s").split(".")[1];
    const forged = `${body}.${signed}`;
    expect(verifyEligibilityCookie(forged, "s")).toBeNull();
  });

  it("increments only the consumed tier", () => {
    const next = JSON.parse(
      Buffer.from(
        incrementEligibilityCookie(counts, "reduced", "s").split(".")[0] ?? "",
        "base64url",
      ).toString("utf8"),
    ) as { rich_count: number; reduced_count: number; preview_count: number };
    expect(next).toEqual({ rich_count: 1, reduced_count: 1, preview_count: 2 });
  });

  it("uses a stable cookie name", () => {
    expect(ELIGIBILITY_COOKIE_NAME).toBe("wpi_eligibility");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: FAIL — `secrets.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/audit-pipeline/src/secrets.ts`:

```ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ELIGIBILITY_COOKIE_NAME = "wpi_eligibility";

export function generateAuditSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAuditSecret(secret: string): string {
  return `sha256:${createHash("sha256").update(secret, "utf8").digest("hex")}`;
}

export interface EligibilityCounts {
  rich_count: number;
  reduced_count: number;
  preview_count: number;
}

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

export function signEligibilityCookie(counts: EligibilityCounts, secret: string): string {
  const body = Buffer.from(JSON.stringify(counts), "utf8").toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function verifyEligibilityCookie(value: string, secret: string): EligibilityCounts | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const expected = mac(body, secret);
  const given = value.slice(dot + 1);
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(given, "utf8");
  if (expectedBuf.length !== givenBuf.length || !timingSafeEqual(expectedBuf, givenBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      rich_count?: unknown;
      reduced_count?: unknown;
      preview_count?: unknown;
    };
    const isCount = (v: unknown): v is number =>
      typeof v === "number" && Number.isInteger(v) && v >= 0;
    if (
      !isCount(parsed.rich_count) ||
      !isCount(parsed.reduced_count) ||
      !isCount(parsed.preview_count)
    ) {
      return null;
    }
    return {
      rich_count: parsed.rich_count,
      reduced_count: parsed.reduced_count,
      preview_count: parsed.preview_count,
    };
  } catch {
    return null;
  }
}

export function incrementEligibilityCookie(
  counts: EligibilityCounts,
  tier: "rich" | "reduced" | "preview",
  secret: string,
): string {
  const next: EligibilityCounts =
    tier === "rich"
      ? { ...counts, rich_count: counts.rich_count + 1 }
      : tier === "reduced"
        ? { ...counts, reduced_count: counts.reduced_count + 1 }
        : { ...counts, preview_count: counts.preview_count + 1 };
  return signEligibilityCookie(next, secret);
}
```

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export {
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  signEligibilityCookie,
  verifyEligibilityCookie,
} from "./secrets.js";
export type { EligibilityCounts } from "./secrets.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/secrets.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/secrets.test.ts
git commit -m "feat(audit-pipeline): audit secrets and signed eligibility cookie"
```

---

### Task 4: Tier scopes and eligibility decision

**Files:**

- Create: `packages/audit-pipeline/src/eligibility.ts`
- Test: `packages/audit-pipeline/tests/eligibility.test.ts`
- Modify: `packages/audit-pipeline/src/index.ts`

**Interfaces:**

- Consumes: `EligibilityCounts` (Task 3).
- Produces: `TIER_NAMES`, `TierName`, `TierScope {maxPages, actionBoardCap, comparisons, roadmap, aiVisibilityPanel}`, `TIER_SCOPES` (constant), `decideTier(counts)`, `loadTierScopes(configPath)` — used by Tasks 8, 11, 12, 15.

- [ ] **Step 1: Write the failing tests**

`packages/audit-pipeline/tests/eligibility.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TIER_SCOPES, decideTier, loadTierScopes } from "../src/eligibility.js";

describe("decideTier", () => {
  it("gives rich when rich quota unused, then reduced, then preview", () => {
    expect(decideTier({ rich_count: 0, reduced_count: 5, preview_count: 5 })).toBe("rich");
    expect(decideTier({ rich_count: 1, reduced_count: 0, preview_count: 5 })).toBe("reduced");
    expect(decideTier({ rich_count: 1, reduced_count: 1, preview_count: 0 })).toBe("preview");
    expect(decideTier({ rich_count: 1, reduced_count: 1, preview_count: 9 })).toBe("preview");
  });
});

describe("TIER_SCOPES", () => {
  it("matches config/anonymous-eligibility.yaml values", () => {
    expect(TIER_SCOPES.rich).toEqual({
      maxPages: 20,
      actionBoardCap: 12,
      comparisons: 1,
      roadmap: true,
      aiVisibilityPanel: true,
    });
    expect(TIER_SCOPES.reduced).toEqual({
      maxPages: 10,
      actionBoardCap: 12,
      comparisons: 0,
      roadmap: false,
      aiVisibilityPanel: false,
    });
    expect(TIER_SCOPES.preview).toEqual({
      maxPages: 1,
      actionBoardCap: 3,
      comparisons: 0,
      roadmap: false,
      aiVisibilityPanel: false,
    });
  });
});

describe("loadTierScopes", () => {
  it("maps snake_case YAML scope to TierScope", () => {
    const dir = mkdtempSync(join(tmpdir(), "wpi-elig-"));
    const configPath = join(dir, "anonymous-eligibility.yaml");
    writeFileSync(
      configPath,
      [
        'version: "0.1.0-draft"',
        "tiers:",
        "  rich:",
        "    scope:",
        "      max_representative_pages: 20",
        "      comparisons: 1",
        '      ai_visibility_panel: "config/prompt-panels/free-panel.yaml"',
        "      action_board: { min: 8, max: 12 }",
        "      preliminary_roadmap: true",
        "  reduced:",
        "    scope:",
        "      max_representative_pages: 10",
        "      comparisons: 0",
        "      ai_visibility_panel: false",
        "      action_board: { min: 8, max: 12 }",
        "      preliminary_roadmap: false",
        "  preview:",
        "    scope:",
        "      max_representative_pages: 1",
        "      comparisons: 0",
        "      ai_visibility_panel: false",
        "      action_board: { min: 0, max: 3 }",
        "      preliminary_roadmap: false",
        "",
      ].join("\n"),
      "utf8",
    );
    const scopes = loadTierScopes(configPath);
    expect(scopes.rich).toEqual({
      maxPages: 20,
      actionBoardCap: 12,
      comparisons: 1,
      roadmap: true,
      aiVisibilityPanel: true,
    });
    expect(scopes.preview).toEqual({
      maxPages: 1,
      actionBoardCap: 3,
      comparisons: 0,
      roadmap: false,
      aiVisibilityPanel: false,
    });
  });

  it("throws when a tier scope is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "wpi-elig-"));
    const configPath = join(dir, "broken.yaml");
    writeFileSync(
      configPath,
      "tiers:\n  rich:\n    scope:\n      max_representative_pages: 20\n",
      "utf8",
    );
    expect(() => loadTierScopes(configPath)).toThrow(/reduced/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: FAIL — `eligibility.js` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/audit-pipeline/src/eligibility.ts`:

```ts
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { EligibilityCounts } from "./secrets.js";

export const TIER_NAMES = ["rich", "reduced", "preview", "refused"] as const;
export type TierName = (typeof TIER_NAMES)[number];

export interface TierScope {
  maxPages: number;
  actionBoardCap: number;
  comparisons: number;
  roadmap: boolean;
  aiVisibilityPanel: boolean;
}

export const TIER_SCOPES: Record<Exclude<TierName, "refused">, TierScope> = {
  rich: {
    maxPages: 20,
    actionBoardCap: 12,
    comparisons: 1,
    roadmap: true,
    aiVisibilityPanel: true,
  },
  reduced: {
    maxPages: 10,
    actionBoardCap: 12,
    comparisons: 0,
    roadmap: false,
    aiVisibilityPanel: false,
  },
  preview: {
    maxPages: 1,
    actionBoardCap: 3,
    comparisons: 0,
    roadmap: false,
    aiVisibilityPanel: false,
  },
};

export function decideTier(counts: EligibilityCounts): Exclude<TierName, "refused"> {
  if (counts.rich_count === 0) return "rich";
  if (counts.reduced_count === 0) return "reduced";
  return "preview";
}

export function loadTierScopes(
  configPath: string,
): Record<Exclude<TierName, "refused">, TierScope> {
  const raw = parseYaml(readFileSync(configPath, "utf-8")) as {
    tiers?: Record<string, { scope?: Record<string, unknown> }>;
  };
  const tiers = raw.tiers;
  if (!tiers) {
    throw new Error(`Invalid eligibility config: missing tiers in ${configPath}`);
  }
  const out = {} as Record<Exclude<TierName, "refused">, TierScope>;
  for (const tier of ["rich", "reduced", "preview"] as const) {
    const scope = tiers[tier]?.scope;
    if (!scope) {
      throw new Error(`Invalid eligibility config: missing scope for tier ${tier}`);
    }
    const panel = scope["ai_visibility_panel"];
    const board = scope["action_board"] as { min?: number; max?: number } | undefined;
    out[tier] = {
      maxPages: scope["max_representative_pages"] as number,
      actionBoardCap: board?.max ?? 0,
      comparisons: scope["comparisons"] as number,
      roadmap: scope["preliminary_roadmap"] === true,
      aiVisibilityPanel: typeof panel === "string" && panel !== "none",
    };
  }
  return out;
}
```

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export { TIER_NAMES, TIER_SCOPES, decideTier, loadTierScopes } from "./eligibility.js";
export type { TierName, TierScope } from "./eligibility.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/eligibility.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/eligibility.test.ts
git commit -m "feat(audit-pipeline): tier scopes and eligibility decision"
```

---

### Task 5: Crawler `MAX_PAGES` env override

The pipeline needs to cap the crawler per tier without editing `config/crawl-limits.yaml`. Add a small resolver that lets an env var tighten (never loosen) the YAML-configured cap.

**Files:**

- Create: `services/crawler/src/max-pages.ts`
- Modify: `services/crawler/src/index.ts` (plan call site, ~line 126)
- Test: `services/crawler/tests/max-pages.test.ts`

**Interfaces:**

- Consumes: `config.max_pages` from the crawler's existing YAML config loading.
- Produces: `resolveMaxPages(configMaxPages: number, envValue: string | undefined): number`, exported from `services/crawler/src/index.ts`. The pipeline (Task 15) sets `MAX_PAGES` env to the tier's `scope.maxPages` before invoking `runCrawlJob`.

- [ ] **Step 1: Write the failing test**

`services/crawler/tests/max-pages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveMaxPages } from "../src/max-pages.js";

describe("resolveMaxPages", () => {
  it("returns the config value when the env var is undefined", () => {
    expect(resolveMaxPages(10, undefined)).toBe(10);
  });

  it("returns the config value when the env var is empty", () => {
    expect(resolveMaxPages(10, "")).toBe(10);
  });

  it("returns the config value when the env var is not a number", () => {
    expect(resolveMaxPages(10, "not-a-number")).toBe(10);
  });

  it("clamps values below 1 up to 1", () => {
    expect(resolveMaxPages(10, "-5")).toBe(1);
    expect(resolveMaxPages(10, "0")).toBe(1);
  });

  it("clamps values above the config cap down to the cap", () => {
    expect(resolveMaxPages(10, "25")).toBe(10);
  });

  it("passes a valid in-range value through", () => {
    expect(resolveMaxPages(20, "7")).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wpi/crawler test -- max-pages`
Expected: FAIL — cannot resolve `../src/max-pages.js` (module not found).

- [ ] **Step 3: Implement `max-pages.ts`**

`services/crawler/src/max-pages.ts`:

```ts
export function resolveMaxPages(configMaxPages: number, envValue: string | undefined): number {
  if (envValue === undefined || envValue === "") {
    return configMaxPages;
  }
  const parsed = Number.parseInt(envValue, 10);
  if (Number.isNaN(parsed)) {
    return configMaxPages;
  }
  return Math.min(Math.max(parsed, 1), configMaxPages);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @wpi/crawler test -- max-pages`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire it into the plan call site**

In `services/crawler/src/index.ts`, add to the relative imports:

```ts
import { resolveMaxPages } from "./max-pages.js";
```

Change the `planUrls` call (~line 126) from:

```ts
maxPages: config.max_pages,
```

to:

```ts
maxPages: resolveMaxPages(config.max_pages, process.env["MAX_PAGES"]),
```

Add to the export list at the bottom of `services/crawler/src/index.ts`:

```ts
export { resolveMaxPages } from "./max-pages.js";
```

- [ ] **Step 6: Run the full crawler suite**

Run: `pnpm --filter @wpi/crawler test`
Expected: PASS — all pre-existing crawler tests still green.

- [ ] **Step 7: Commit**

```bash
git add services/crawler/src/max-pages.ts services/crawler/src/index.ts services/crawler/tests/max-pages.test.ts
git commit -m "feat(crawler): MAX_PAGES env override clamped to config cap"
```

---

### Task 6: Report envelope types + shared paths + `AuditStore` port + in-memory store

**Files:**

- Create: `packages/audit-pipeline/src/paths.ts`
- Create: `packages/audit-pipeline/src/report-envelope.ts`
- Create: `packages/audit-pipeline/src/audit-store.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/audit-store.test.ts`
- Test: `packages/audit-pipeline/tests/paths.test.ts`

**Interfaces:**

- Consumes: `AuditContext` (Task 2), `TierName`, `TierScope` (Task 4), `canTransition`, `isTerminal` (Task 1).
- Produces (used by Tasks 7, 8, 9, 10, 11, 12, 15, 16): `REPO_ROOT`; types `FindingSection`, `FindingSeverity`, `FindingState`, `StoredFinding`, `UnavailableBlock`, `StoredCostLine`, `StoredCosts`, `StoredActionItem`, `ComposerFinding`, `ComposerAgentOutcome`, `ReportSampleDisclosure`, `ReportModel`, `StoredReportEnvelope`; `SECTION_BY_AGENT`; `AuditRecord`, `CreateAuditInput`, `GetActiveResult`, `TransitionResult`, `AuditStore`, `InMemoryAuditStore`.

- [ ] **Step 1: Write the failing tests**

`packages/audit-pipeline/tests/paths.test.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/paths.js";

describe("paths", () => {
  it("resolves the repo root regardless of src/dist location", () => {
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "schemas", "report-model.schema.json"))).toBe(true);
  });
});
```

`packages/audit-pipeline/tests/audit-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { CreateAuditInput } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";

const CONTEXT: AuditContext = {
  organization: "Example Ltd",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Facility managers",
};

function input(overrides: Partial<CreateAuditInput> = {}): CreateAuditInput {
  return {
    targetUrl: "https://example.com",
    locale: "en",
    context: CONTEXT,
    tier: "rich",
    secretHash: "sha256:abc",
    ttlDays: 7,
    ...overrides,
  };
}

describe("InMemoryAuditStore", () => {
  it("creates a QUEUED audit with a uuid id and 7-day expiry", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.status).toBe("QUEUED");
    expect(record.failure_reason).toBeNull();
    expect(record.report).toBeNull();
    const expires = new Date(record.expires_at).getTime();
    const created = new Date(record.created_at).getTime();
    expect(expires - created).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("getActive returns not_found / deleted / expired", async () => {
    const store = new InMemoryAuditStore();
    expect(await store.getActive("missing")).toBe("not_found");
    const record = await store.create(input());
    await store.softDelete(record.id);
    expect(await store.getActive(record.id)).toBe("deleted");
    const shortLived = await store.create(input({ ttlDays: 0 }));
    expect(await store.getActive(shortLived.id)).toBe("expired");
  });

  it("getActive lazily flips an expired row to EXPIRED", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input({ ttlDays: 0 }));
    await store.getActive(record.id);
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("EXPIRED");
  });

  it("rejects an invalid transition", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    await expect(store.transition(record.id, "COMPOSING")).rejects.toThrow(/Invalid transition/);
  });

  it("walks the happy path QUEUED -> ... -> READY_COMPLETE", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      const next = await store.transition(record.id, status);
      expect(next).not.toBe("terminal");
    }
    const done = await store.transition(record.id, "READY_COMPLETE");
    expect(done).not.toBe("terminal");
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("READY_COMPLETE");
  });

  it("returns terminal for transitions after EXPIRED or CANCELLED", async () => {
    const store = new InMemoryAuditStore();
    const expired = await store.create(input({ ttlDays: 0 }));
    await store.getActive(expired.id);
    expect(await store.transition(expired.id, "VALIDATING")).toBe("terminal");
  });

  it("setFailure after a terminal READY status is a no-op returning terminal", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    for (const status of [
      "VALIDATING",
      "CRAWLING",
      "EXTRACTING",
      "AUDITING",
      "COMPOSING",
      "READY_COMPLETE",
    ]) {
      await store.transition(record.id, status);
    }
    const result = await store.setFailure(record.id, "failure.pipeline_error");
    expect(result).toBe("terminal");
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("READY_COMPLETE");
  });

  it("setFailure stores the reason key and optional costs", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    await store.transition(record.id, "VALIDATING");
    await store.setFailure(record.id, "failure.url_invalid");
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("FAILED");
    expect(raw?.failure_reason).toBe("failure.url_invalid");
  });

  it("setOutcome stores report and costs", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      await store.transition(record.id, status);
    }
    const envelope = {
      report: {} as never,
      findings: [],
      unavailable: [],
      action_board: [],
      costs: { currency: "USD" as const, agents: [], total_usd: 0 },
    };
    const done = await store.setOutcome(
      record.id,
      "READY_COMPLETE",
      envelope.report,
      envelope.costs,
    );
    expect(done.status).toBe("READY_COMPLETE");
    const raw = await store.getRaw(record.id);
    expect(raw?.costs).toEqual({ currency: "USD", agents: [], total_usd: 0 });
  });

  it("sweepExpired flips rows past their expiry and counts them", async () => {
    const store = new InMemoryAuditStore();
    await store.create(input({ ttlDays: 0 }));
    await store.create(input({ ttlDays: 7 }));
    const count = await store.sweepExpired();
    expect(count).toBe(1);
  });

  it("softDelete is idempotent", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create(input());
    expect(await store.softDelete(record.id)).toBe(true);
    expect(await store.softDelete(record.id)).toBe(false);
    expect(await store.softDelete("missing")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: FAIL — `../src/paths.js` and `../src/audit-store.js` do not exist.

- [ ] **Step 3: Implement `paths.ts`**

`packages/audit-pipeline/src/paths.ts`:

```ts
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot(metaUrl: string): string {
  let dir = dirname(fileURLToPath(metaUrl));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate package root (no package.json ancestor)");
    }
    dir = parent;
  }
}

export const REPO_ROOT = join(packageRoot(import.meta.url), "..", "..");
```

- [ ] **Step 4: Implement `report-envelope.ts`**

`packages/audit-pipeline/src/report-envelope.ts`:

```ts
export type FindingSection = "technical" | "keywords" | "content";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingState = "verified" | "inferred" | "not_verified";

export const SECTION_BY_AGENT: Record<string, FindingSection> = {
  auditor: "technical",
  "keyword-analyst": "keywords",
  "content-strategist": "content",
};

export interface StoredFinding {
  id: string;
  agent: string;
  section: FindingSection;
  severity: FindingSeverity;
  state: FindingState;
  confidence: "high" | "medium" | "low";
  evidence_ids: string[];
  data: Record<string, unknown>;
}

export interface UnavailableBlock {
  section: FindingSection | "comparison" | "ai_visibility_panel";
  reason_key: string;
}

export interface StoredCostLine {
  agent: string;
  engine: string;
  tokens_in: number;
  tokens_out: number;
  usd: number;
}

export interface StoredCosts {
  currency: "USD";
  agents: StoredCostLine[];
  total_usd: number;
}

export interface StoredActionItem {
  title: string;
  detail: string;
  severity: FindingSeverity;
  confidence: "high" | "medium" | "low";
  source_finding_id: string;
}

export interface ComposerFinding {
  finding_id: string;
  result_state: "verified" | "inferred" | "not_verified" | "unavailable";
  confidence: "high" | "medium" | "low";
  evidence_ids: string[];
  data: Record<string, unknown>;
  limitations: string[];
}

export interface ComposerAgentOutcome {
  agent_name: string;
  ok: boolean;
  findings: ComposerFinding[];
  limitations: string[];
  cost?: { engine: string; tokens_in: number; tokens_out: number; usd: number };
  unavailable_reason_key?: string;
}

export interface ReportSampleDisclosure {
  pages_checked: number;
  sampled: boolean;
}

export interface ReportModel {
  report_id: string;
  audit_id: string;
  version: number;
  access_class: "anonymous";
  languages: string[];
  allowed_projections: string[];
  access: {
    link_id: string;
    secret_hash: string;
    noindex?: boolean;
    public_gallery?: boolean;
  };
  tone: "professional";
  content: {
    summary_bullets: string[];
    score_result_ids: string[];
    finding_ids: string[];
    prompt_run_ids: string[];
    roadmap_id: string | null;
    data_gaps: { metric_key: string; needed_export_key: string }[];
    limitations_keys: string[];
    sample_disclosure: ReportSampleDisclosure;
  };
  lineage_coverage: {
    numbers_total: number;
    numbers_with_lineage: number;
    ratio: number;
  };
  status: "ready";
  needs_native_review: boolean;
  retention_days: number;
  created_at: string;
  expires_at: string;
}

export interface StoredReportEnvelope {
  report: ReportModel;
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  costs: StoredCosts;
}
```

- [ ] **Step 5: Implement `audit-store.ts`**

`packages/audit-pipeline/src/audit-store.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { AuditContext } from "./audit-context.js";
import type { TierName } from "./eligibility.js";
import type { StoredCosts, StoredReportEnvelope } from "./report-envelope.js";
import { canTransition, isTerminal } from "./workflow-states.js";

export interface AuditRecord {
  id: string;
  target_url: string;
  locale: "en" | "ar";
  context: AuditContext;
  tier: TierName;
  status: string;
  secret_hash: string;
  failure_reason: string | null;
  report: StoredReportEnvelope | null;
  costs: StoredCosts | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  deleted_at: string | null;
}

export interface CreateAuditInput {
  targetUrl: string;
  locale: "en" | "ar";
  context: AuditContext;
  tier: TierName;
  secretHash: string;
  ttlDays: number;
}

export type GetActiveResult = AuditRecord | "not_found" | "deleted" | "expired";
export type TransitionResult = AuditRecord | "terminal";

export interface AuditStore {
  create(input: CreateAuditInput): Promise<AuditRecord>;
  getActive(id: string): Promise<GetActiveResult>;
  getRaw(id: string): Promise<AuditRecord | null>;
  transition(id: string, to: string): Promise<TransitionResult>;
  setFailure(id: string, reasonKey: string, costs?: StoredCosts): Promise<TransitionResult>;
  setOutcome(
    id: string,
    to: "READY_PARTIAL" | "READY_COMPLETE",
    report: StoredReportEnvelope,
    costs: StoredCosts,
  ): Promise<AuditRecord>;
  sweepExpired(now?: Date): Promise<number>;
  softDelete(id: string): Promise<boolean>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class InMemoryAuditStore implements AuditStore {
  private readonly rows = new Map<string, AuditRecord>();

  async create(assignment: CreateAuditInput): Promise<AuditRecord> {
    const now = new Date();
    const record: AuditRecord = {
      id: randomUUID(),
      target_url: assignment.targetUrl,
      locale: assignment.locale,
      context: structuredClone(assignment.context),
      tier: assignment.tier,
      status: "QUEUED",
      secret_hash: assignment.secretHash,
      failure_reason: null,
      report: null,
      costs: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + assignment.ttlDays * DAY_MS).toISOString(),
      deleted_at: null,
    };
    this.rows.set(record.id, record);
    return structuredClone(record);
  }

  async getRaw(id: string): Promise<AuditRecord | null> {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async getActive(id: string): Promise<GetActiveResult> {
    const row = this.rows.get(id);
    if (!row) {
      return "not_found";
    }
    if (row.deleted_at) {
      return "deleted";
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      row.status = "EXPIRED";
      row.updated_at = new Date().toISOString();
      return "expired";
    }
    return structuredClone(row);
  }

  async transition(id: string, to: string): Promise<TransitionResult> {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`Audit ${id} not found`);
    }
    if (row.deleted_at || row.status === "EXPIRED" || row.status === "CANCELLED") {
      return "terminal";
    }
    if (!canTransition(row.status, to)) {
      throw new Error(`Invalid transition ${row.status} -> ${to}`);
    }
    row.status = to;
    row.updated_at = new Date().toISOString();
    return structuredClone(row);
  }

  async setFailure(id: string, reasonKey: string, costs?: StoredCosts): Promise<TransitionResult> {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`Audit ${id} not found`);
    }
    if (row.deleted_at || row.status === "EXPIRED" || row.status === "CANCELLED") {
      return "terminal";
    }
    if (isTerminal(row.status)) {
      return "terminal";
    }
    row.status = "FAILED";
    row.failure_reason = reasonKey;
    if (costs) {
      row.costs = structuredClone(costs);
    }
    row.updated_at = new Date().toISOString();
    return structuredClone(row);
  }

  async setOutcome(
    id: string,
    to: "READY_PARTIAL" | "READY_COMPLETE",
    report: StoredReportEnvelope,
    costs: StoredCosts,
  ): Promise<AuditRecord> {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`Audit ${id} not found`);
    }
    if (row.deleted_at || row.status === "EXPIRED" || row.status === "CANCELLED") {
      throw new Error(`Audit ${id} is ${row.deleted_at ? "deleted" : row.status}`);
    }
    if (!canTransition(row.status, to)) {
      throw new Error(`Invalid transition ${row.status} -> ${to}`);
    }
    row.status = to;
    row.report = structuredClone(report);
    row.costs = structuredClone(costs);
    row.updated_at = new Date().toISOString();
    return structuredClone(row);
  }

  async sweepExpired(now: Date = new Date()): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (
        row.status !== "EXPIRED" &&
        !row.deleted_at &&
        new Date(row.expires_at).getTime() <= now.getTime()
      ) {
        row.status = "EXPIRED";
        row.updated_at = now.toISOString();
        count += 1;
      }
    }
    return count;
  }

  async softDelete(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.deleted_at) {
      return false;
    }
    row.deleted_at = new Date().toISOString();
    row.updated_at = row.deleted_at;
    return true;
  }
}
```

- [ ] **Step 6: Export from the package index**

Replace the placeholder body of `packages/audit-pipeline/src/index.ts` with:

```ts
export { AUDIT_STATUSES, TERMINAL_STATUSES, canTransition, isTerminal } from "./workflow-states.js";
export type { AuditStatus, TerminalStatus } from "./workflow-states.js";
export { LOCALES, auditContextSchema, createAuditRequestSchema } from "./audit-context.js";
export type { AuditContext, CreateAuditRequest } from "./audit-context.js";
export {
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  signEligibilityCookie,
  verifyEligibilityCookie,
} from "./secrets.js";
export { TIER_NAMES, TIER_SCOPES, decideTier, loadTierScopes } from "./eligibility.js";
export type { TierName, TierScope } from "./eligibility.js";
export { REPO_ROOT } from "./paths.js";
export { InMemoryAuditStore } from "./audit-store.js";
export type {
  AuditRecord,
  AuditStore,
  CreateAuditInput,
  GetActiveResult,
  TransitionResult,
} from "./audit-store.js";
export { SECTION_BY_AGENT } from "./report-envelope.js";
export type {
  ComposerAgentOutcome,
  ComposerFinding,
  FindingSection,
  FindingSeverity,
  FindingState,
  ReportModel,
  ReportSampleDisclosure,
  StoredActionItem,
  StoredCostLine,
  StoredCosts,
  StoredFinding,
  StoredReportEnvelope,
  UnavailableBlock,
} from "./report-envelope.js";
```

(Keep accumulating exports in this file in later tasks — each task appends its own block in the same style.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS — Task 1/2/3/4 suites plus the new store and paths suites.

- [ ] **Step 8: Commit**

```bash
git add packages/audit-pipeline/src/paths.ts packages/audit-pipeline/src/report-envelope.ts packages/audit-pipeline/src/audit-store.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/paths.test.ts packages/audit-pipeline/tests/audit-store.test.ts
git commit -m "feat(audit-pipeline): report envelope types, AuditStore port, in-memory store"
```

---

### Task 7: SQL migrations + `PostgresAuditStore` + migrate CLI

**Files:**

- Create: `packages/audit-pipeline/src/migrations/0001_create_audits.sql`
- Create: `packages/audit-pipeline/src/migrations/migrate.ts`
- Create: `packages/audit-pipeline/src/migrations/migrate-cli.ts`
- Create: `packages/audit-pipeline/src/postgres-audit-store.ts`
- Modify: `packages/audit-pipeline/package.json` (add `bin`)
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/postgres-audit-store.test.ts` (skipped unless `WPI_TEST_DATABASE_URL` is set)

**Interfaces:**

- Consumes: `AuditStore` port + `AuditRecord` (Task 6), `canTransition` (Task 1), `packageRoot` via `REPO_ROOT` (Task 6).
- Produces: `applyMigrations(pool, migrationsDir?)`, `MIGRATIONS_DIR`, `PostgresAuditStore` (implements `AuditStore`), `MigrationResult { applied: string[] }`, and a `wpi-migrate` bin. Used by Task 15 (container) and Task 20 (docs/verification).

- [ ] **Step 1: Write the SQL migration**

`packages/audit-pipeline/src/migrations/0001_create_audits.sql` — spec §3 DDL verbatim (plus the `tier` column):

```sql
CREATE TABLE audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','ar')),
  tier text NOT NULL CHECK (tier IN ('rich','reduced','preview','refused')),
  context jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('QUEUED','VALIDATING','CRAWLING','EXTRACTING','AUDITING','ENRICHING_OPTIONAL','COMPOSING','READY_PARTIAL','READY_COMPLETE','FAILED','CANCELLED','EXPIRED')),
  failure_reason text,
  secret_hash text NOT NULL,
  report jsonb,
  costs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz
);
CREATE INDEX audits_expires_at_idx ON audits (expires_at);
```

- [ ] **Step 2: Write the failing test**

`packages/audit-pipeline/tests/postgres-audit-store.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../src/migrations/migrate.js";
import { PostgresAuditStore } from "../src/postgres-audit-store.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PostgresAuditStore", () => {
  let pool: Pool;
  let store: PostgresAuditStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("DROP TABLE IF EXISTS audits CASCADE");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    await applyMigrations(pool);
    store = new PostgresAuditStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const CONTEXT = {
    organization: "Example Ltd",
    business_type: "e-commerce",
    offering: "Office furniture",
    market: "Saudi Arabia",
    customer_language: "Arabic",
    audience: "Facility managers",
  };

  function input() {
    return {
      targetUrl: "https://example.com",
      locale: "en" as const,
      context: CONTEXT,
      tier: "rich" as const,
      secretHash: "sha256:abc",
      ttlDays: 7,
    };
  }

  it("applies the migration idempotently", async () => {
    const second = await applyMigrations(pool);
    expect(second.applied).toEqual([]);
  });

  it("create inserts a QUEUED row and round-trips the record", async () => {
    const record = await store.create(input());
    expect(record.status).toBe("QUEUED");
    expect(record.context).toEqual(CONTEXT);
    const raw = await store.getRaw(record.id);
    expect(raw?.secret_hash).toBe("sha256:abc");
  });

  it("the status CHECK constraint rejects invalid states", async () => {
    await expect(
      pool.query(
        "INSERT INTO audits (target_url, locale, tier, status, secret_hash, expires_at) VALUES ($1, 'en', 'rich', 'BOGUS', 'h', now() + interval '7 days')",
        ["https://example.com"],
      ),
    ).rejects.toThrow();
  });

  it("transition walks the happy path and honors the guarded write", async () => {
    const record = await store.create(input());
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      const next = await store.transition(record.id, status);
      expect(next).not.toBe("terminal");
    }
    const invalid = await store.transition(record.id, "QUEUED");
    expect(invalid).toBe("terminal");
  });

  it("transition on a CANCELLED row returns terminal without writing", async () => {
    const record = await store.create(input());
    await pool.query("UPDATE audits SET status = 'CANCELLED' WHERE id = $1", [record.id]);
    const result = await store.transition(record.id, "VALIDATING");
    expect(result).toBe("terminal");
  });

  it("sweepExpired flips only expired rows", async () => {
    const record = await store.create(input({ ttlDays: 0 }));
    await store.transition(record.id, "VALIDATING");
    const count = await store.sweepExpired();
    expect(count).toBeGreaterThanOrEqual(1);
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("EXPIRED");
  });

  it("softDelete marks deleted exactly once", async () => {
    const record = await store.create(input());
    expect(await store.softDelete(record.id)).toBe(true);
    expect(await store.softDelete(record.id)).toBe(false);
    expect(await store.getActive(record.id)).toBe("deleted");
  });
});
```

- [ ] **Step 3: Implement the migration runner**

`packages/audit-pipeline/src/migrations/migrate.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

function packageRoot(metaUrl: string): string {
  let dir = dirname(fileURLToPath(metaUrl));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate package root (no package.json ancestor)");
    }
    dir = parent;
  }
}

export const MIGRATIONS_DIR = join(packageRoot(import.meta.url), "src", "migrations");

export interface MigrationResult {
  applied: string[];
}

export async function applyMigrations(
  pool: Pool,
  migrationsDir: string = MIGRATIONS_DIR,
): Promise<MigrationResult> {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
    const applied: string[] = [];
    for (const name of files) {
      const seen = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
      if (seen.rowCount && seen.rowCount > 0) {
        continue;
      }
      const sql = await readFile(join(migrationsDir, name), "utf-8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        applied.push(name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return { applied };
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Implement the migrate CLI**

`packages/audit-pipeline/src/migrations/migrate-cli.ts`:

```ts
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { applyMigrations } from "./migrate.js";

async function main(): Promise<void> {
  const connectionString = process.env["WPI_DATABASE_URL"];
  if (!connectionString) {
    throw new Error("WPI_DATABASE_URL is required to run migrations");
  }
  const pool = new Pool({ connectionString });
  try {
    const result = await applyMigrations(pool);
    console.log(
      `Applied ${result.applied.length} migration(s): ${result.applied.join(", ") || "none"}`,
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

Add to `packages/audit-pipeline/package.json`, inside the top-level object (after `"scripts"`):

```json
"bin": {
  "wpi-migrate": "./dist/migrations/migrate-cli.js"
},
```

- [ ] **Step 5: Implement `PostgresAuditStore`**

`packages/audit-pipeline/src/postgres-audit-store.ts`:

```ts
import type { Pool, QueryResultRow } from "pg";
import type { AuditContext } from "./audit-context.js";
import type {
  AuditRecord,
  AuditStore,
  CreateAuditInput,
  GetActiveResult,
  TransitionResult,
} from "./audit-store.js";
import type { TierName } from "./eligibility.js";
import type { StoredCosts, StoredReportEnvelope } from "./report-envelope.js";
import { canTransition, isTerminal } from "./workflow-states.js";

interface AuditRow extends QueryResultRow {
  id: string;
  target_url: string;
  locale: string;
  tier: string;
  context: unknown;
  status: string;
  failure_reason: string | null;
  secret_hash: string;
  report: unknown;
  costs: unknown;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  deleted_at: Date | null;
}

function iso(value: Date): string {
  return value.toISOString();
}

function rowToRecord(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    target_url: row.target_url,
    locale: row.locale as "en" | "ar",
    context: row.context as AuditContext,
    tier: row.tier as TierName,
    status: row.status,
    secret_hash: row.secret_hash,
    failure_reason: row.failure_reason,
    report: (row.report as StoredReportEnvelope | null) ?? null,
    costs: (row.costs as StoredCosts | null) ?? null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    expires_at: iso(row.expires_at),
    deleted_at: row.deleted_at ? iso(row.deleted_at) : null,
  };
}

const GUARD = "status NOT IN ('EXPIRED','CANCELLED') AND deleted_at IS NULL";

export class PostgresAuditStore implements AuditStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateAuditInput): Promise<AuditRecord> {
    const result = await this.pool.query<AuditRow>(
      `INSERT INTO audits (target_url, locale, tier, context, status, secret_hash, expires_at)
       VALUES ($1, $2, $3, $4, 'QUEUED', $5, now() + make_interval(days => $6))
       RETURNING *`,
      [
        input.targetUrl,
        input.locale,
        input.tier,
        JSON.stringify(input.context),
        input.secretHash,
        input.ttlDays,
      ],
    );
    return rowToRecord(result.rows[0]);
  }

  async getRaw(id: string): Promise<AuditRecord | null> {
    const result = await this.pool.query<AuditRow>("SELECT * FROM audits WHERE id = $1", [id]);
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async getActive(id: string): Promise<GetActiveResult> {
    const raw = await this.getRaw(id);
    if (!raw) {
      return "not_found";
    }
    if (raw.deleted_at) {
      return "deleted";
    }
    if (new Date(raw.expires_at).getTime() <= Date.now()) {
      await this.transition(id, "EXPIRED").catch(() => undefined);
      return "expired";
    }
    return raw;
  }

  async transition(id: string, to: string): Promise<TransitionResult> {
    const raw = await this.getRaw(id);
    if (!raw) {
      throw new Error(`Audit ${id} not found`);
    }
    if (raw.deleted_at || raw.status === "EXPIRED" || raw.status === "CANCELLED") {
      return "terminal";
    }
    if (!canTransition(raw.status, to)) {
      throw new Error(`Invalid transition ${raw.status} -> ${to}`);
    }
    const result = await this.pool.query<AuditRow>(
      `UPDATE audits SET status = $2, updated_at = now()
       WHERE id = $1 AND ${GUARD}
       RETURNING *`,
      [id, to],
    );
    if (!result.rows[0]) {
      return "terminal";
    }
    return rowToRecord(result.rows[0]);
  }

  async setFailure(id: string, reasonKey: string, costs?: StoredCosts): Promise<TransitionResult> {
    const raw = await this.getRaw(id);
    if (!raw) {
      throw new Error(`Audit ${id} not found`);
    }
    if (raw.deleted_at || isTerminal(raw.status)) {
      return "terminal";
    }
    const result = await this.pool.query<AuditRow>(
      `UPDATE audits
       SET status = 'FAILED', failure_reason = $2, costs = COALESCE($3, costs), updated_at = now()
       WHERE id = $1 AND ${GUARD}
       RETURNING *`,
      [id, reasonKey, costs ? JSON.stringify(costs) : null],
    );
    if (!result.rows[0]) {
      return "terminal";
    }
    return rowToRecord(result.rows[0]);
  }

  async setOutcome(
    id: string,
    to: "READY_PARTIAL" | "READY_COMPLETE",
    report: StoredReportEnvelope,
    costs: StoredCosts,
  ): Promise<AuditRecord> {
    const raw = await this.getRaw(id);
    if (!raw) {
      throw new Error(`Audit ${id} not found`);
    }
    if (!canTransition(raw.status, to)) {
      throw new Error(`Invalid transition ${raw.status} -> ${to}`);
    }
    const result = await this.pool.query<AuditRow>(
      `UPDATE audits
       SET status = $2, report = $3, costs = $4, updated_at = now()
       WHERE id = $1 AND ${GUARD}
       RETURNING *`,
      [id, to, JSON.stringify(report), JSON.stringify(costs)],
    );
    if (!result.rows[0]) {
      throw new Error(`Audit ${id} could not accept outcome (guarded row missing)`);
    }
    return rowToRecord(result.rows[0]);
  }

  async sweepExpired(now: Date = new Date()): Promise<number> {
    const result = await this.pool.query(
      `UPDATE audits SET status = 'EXPIRED', updated_at = now()
       WHERE deleted_at IS NULL AND status <> 'EXPIRED' AND expires_at <= $1`,
      [now],
    );
    return result.rowCount ?? 0;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE audits SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
```

- [ ] **Step 6: Export from the package index**

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export { MIGRATIONS_DIR, applyMigrations } from "./migrations/migrate.js";
export { PostgresAuditStore } from "./postgres-audit-store.js";
export type { MigrationResult } from "./migrations/migrate.js";
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS — the Postgres suite reports as skipped unless `WPI_TEST_DATABASE_URL` is set; everything else green. If you have a local Postgres, run `createdb wpi_test && WPI_TEST_DATABASE_URL=postgres://localhost:5432/wpi_test pnpm --filter @wpi/audit-pipeline test` to exercise it.

- [ ] **Step 8: Install workspace link for the new bin**

Run: `pnpm install`
Expected: completes; `wpi-migrate` becomes resolvable via `pnpm --filter @wpi/audit-pipeline exec wpi-migrate`.

- [ ] **Step 9: Commit**

```bash
git add packages/audit-pipeline/src/migrations packages/audit-pipeline/src/postgres-audit-store.ts packages/audit-pipeline/package.json packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/postgres-audit-store.test.ts pnpm-lock.yaml
git commit -m "feat(audit-pipeline): SQL migrations, PostgresAuditStore, wpi-migrate CLI"
```

---

### Task 8: Composer — findings, unavailable blocks, action board, costs

**Files:**

- Create: `packages/audit-pipeline/src/composer.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/composer.test.ts`

**Interfaces:**

- Consumes: `FindingSection`, `FindingSeverity`, `StoredFinding`, `StoredActionItem`, `StoredCostLine`, `StoredCosts`, `UnavailableBlock`, `ComposerAgentOutcome`, `SECTION_BY_AGENT` (Task 6), `TierScope` (Task 4).
- Produces: `deriveSeverity(data)`, `deriveUnavailable(scope)`, `deriveActionItems(findings, cap)`, `ComposeResult`, `composeSections(outcomes, scope)` — used by Tasks 11, 12.

- [ ] **Step 1: Write the failing test**

`packages/audit-pipeline/tests/composer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  composeSections,
  deriveActionItems,
  deriveSeverity,
  deriveUnavailable,
} from "../src/composer.js";
import type { ComposerAgentOutcome, StoredFinding } from "../src/report-envelope.js";
import { TIER_SCOPES } from "../src/eligibility.js";

function finding(overrides: Partial<StoredFinding> = {}): StoredFinding {
  return {
    id: "f1",
    agent: "auditor",
    section: "technical",
    severity: "high",
    state: "verified",
    confidence: "high",
    evidence_ids: ["ev1"],
    data: {},
    ...overrides,
  };
}

function outcome(overrides: Partial<ComposerAgentOutcome> = {}): ComposerAgentOutcome {
  return {
    agent_name: "auditor",
    ok: true,
    findings: [],
    limitations: [],
    ...overrides,
  };
}

describe("deriveSeverity", () => {
  it("maps a valid severity value from finding data", () => {
    expect(deriveSeverity({ severity: "critical" })).toBe("critical");
  });

  it("defaults to info for missing or out-of-enum values", () => {
    expect(deriveSeverity({})).toBe("info");
    expect(deriveSeverity({ severity: "ultra" })).toBe("info");
    expect(deriveSeverity({ severity: 3 })).toBe("info");
  });
});

describe("deriveUnavailable", () => {
  it("always reports score and experience/deferred blocks", () => {
    const blocks = deriveUnavailable(TIER_SCOPES.rich);
    const keys = blocks.map((b) => b.reason_key);
    expect(keys).toContain("unavailable.score");
    expect(keys).toContain("unavailable.experience_effectiveness");
    expect(
      blocks.every(
        (b) =>
          b.section === "technical" ||
          b.section === "comparison" ||
          b.section === "ai_visibility_panel",
      ),
    ).toBe(true);
  });

  it("adds comparison for tiers with comparisons > 0 and the panel when enabled", () => {
    const rich = deriveUnavailable(TIER_SCOPES.rich);
    expect(
      rich.some((b) => b.section === "comparison" && b.reason_key === "unavailable.comparison"),
    ).toBe(true);
    expect(
      rich.some(
        (b) =>
          b.section === "ai_visibility_panel" && b.reason_key === "unavailable.ai_visibility_panel",
      ),
    ).toBe(true);
  });

  it("omits comparison and panel for preview", () => {
    const preview = deriveUnavailable(TIER_SCOPES.preview);
    expect(preview.some((b) => b.section === "comparison")).toBe(false);
    expect(preview.some((b) => b.section === "ai_visibility_panel")).toBe(false);
  });
});

describe("deriveActionItems", () => {
  it("keeps only findings with a recommendation and caps the board", () => {
    const findings = [
      finding({
        id: "a",
        data: { title: "T", recommendation: "Do A" },
        confidence: "high",
        severity: "high",
      }),
      finding({ id: "b", data: { recommendation: "Do B" }, confidence: "low", severity: "low" }),
      finding({ id: "c", data: { title: "No rec" } }),
    ];
    const items = deriveActionItems(findings, 1);
    expect(items).toHaveLength(1);
    expect(items[0]?.source_finding_id).toBe("a");
    expect(items[0]?.title).toBe("T");
    expect(items[0]?.detail).toBe("Do A");
  });

  it("falls back to a truncated recommendation as the title", () => {
    const items = deriveActionItems([finding({ data: { recommendation: "x".repeat(80) } })], 12);
    expect(items[0]?.title).toBe("x".repeat(60));
  });

  it("sorts by confidence then severity descending", () => {
    const items = deriveActionItems(
      [
        finding({ id: "low", confidence: "low", data: { recommendation: "L" } }),
        finding({ id: "high", confidence: "high", data: { recommendation: "H" } }),
      ],
      12,
    );
    expect(items[0]?.source_finding_id).toBe("high");
  });
});

describe("composeSections", () => {
  it("collects ok outcomes' findings into stored findings and maps cost lines", () => {
    const result = composeSections(
      [
        outcome({
          agent_name: "auditor",
          findings: [
            {
              finding_id: "agent-1",
              result_state: "verified",
              confidence: "high",
              evidence_ids: ["ev-1"],
              data: { title: "T", recommendation: "R", severity: "high" },
              limitations: [],
            },
          ],
          cost: { engine: "gemini-2.0-flash", tokens_in: 10, tokens_out: 5, usd: 0.01 },
        }),
      ],
      TIER_SCOPES.rich,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.agent).toBe("auditor");
    expect(result.findings[0]?.section).toBe("technical");
    expect(result.findings[0]?.severity).toBe("high");
    expect(result.findings[0]?.id).not.toBe("agent-1");
    expect(result.costs.total_usd).toBeCloseTo(0.01);
    expect(result.summary_bullets).toContain("report.summary.technical");
  });

  it("skips unavailable findings and non-mapped agents default to technical", () => {
    const result = composeSections(
      [
        outcome({
          agent_name: "auditor",
          findings: [
            {
              finding_id: "u1",
              result_state: "unavailable",
              confidence: "low",
              evidence_ids: [],
              data: {},
              limitations: [],
            },
          ],
        }),
        outcome({
          agent_name: "mystery-agent",
          ok: false,
          unavailable_reason_key: "unavailable.generic",
        }),
      ],
      TIER_SCOPES.preview,
    );
    expect(result.findings).toHaveLength(0);
    expect(result.unavailable).toContainEqual({
      section: "technical",
      reason_key: "unavailable.generic",
    });
  });

  it("summary bullets only cover sections whose agent succeeded", () => {
    const result = composeSections(
      [
        outcome({ agent_name: "auditor" }),
        outcome({
          agent_name: "keyword-analyst",
          ok: false,
          unavailable_reason_key: "unavailable.agent.keyword-analyst",
        }),
        outcome({ agent_name: "content-strategist" }),
      ],
      TIER_SCOPES.reduced,
    );
    expect(result.summary_bullets).toEqual(["report.summary.technical", "report.summary.content"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wpi/audit-pipeline test -- composer`
Expected: FAIL — `../src/composer.js` does not exist.

- [ ] **Step 3: Implement `composer.ts`**

`packages/audit-pipeline/src/composer.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { TierScope } from "./eligibility.js";
import type {
  ComposerAgentOutcome,
  FindingSeverity,
  StoredActionItem,
  StoredCostLine,
  StoredCosts,
  StoredFinding,
  UnavailableBlock,
} from "./report-envelope.js";
import { SECTION_BY_AGENT } from "./report-envelope.js";

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

const CONFIDENCE_ORDER: Record<"high" | "medium" | "low", number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SECTION_ORDER = ["technical", "keywords", "content"] as const;

export function deriveSeverity(data: Record<string, unknown>): FindingSeverity {
  const value = data["severity"];
  if (value === "critical" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "info";
}

export function deriveUnavailable(scope: TierScope): UnavailableBlock[] {
  const blocks: UnavailableBlock[] = [
    { section: "technical", reason_key: "unavailable.score" },
    { section: "technical", reason_key: "unavailable.experience_effectiveness" },
  ];
  if (scope.comparisons > 0) {
    blocks.push({ section: "comparison", reason_key: "unavailable.comparison" });
  }
  if (scope.aiVisibilityPanel) {
    blocks.push({ section: "ai_visibility_panel", reason_key: "unavailable.ai_visibility_panel" });
  }
  return blocks;
}

export function deriveActionItems(findings: StoredFinding[], cap: number): StoredActionItem[] {
  const items: StoredActionItem[] = [];
  for (const finding of findings) {
    const recommendation = finding.data["recommendation"];
    if (typeof recommendation !== "string" || recommendation.length === 0) {
      continue;
    }
    const titleValue = finding.data["title"];
    const title =
      typeof titleValue === "string" && titleValue.length > 0
        ? titleValue
        : recommendation.slice(0, 60);
    items.push({
      title,
      detail: recommendation,
      severity: finding.severity,
      confidence: finding.confidence,
      source_finding_id: finding.id,
    });
  }
  items.sort((a, b) => {
    const byConfidence = CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
    if (byConfidence !== 0) {
      return byConfidence;
    }
    return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  });
  return items.slice(0, cap);
}

export interface ComposeResult {
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  summary_bullets: string[];
  costs: StoredCosts;
}

export function composeSections(outcomes: ComposerAgentOutcome[], scope: TierScope): ComposeResult {
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @wpi/audit-pipeline test -- composer`
Expected: PASS.

- [ ] **Step 5: Export from the package index**

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export {
  composeSections,
  deriveActionItems,
  deriveSeverity,
  deriveUnavailable,
} from "./composer.js";
export type { ComposeResult } from "./composer.js";
```

- [ ] **Step 6: Run the full package suite and commit**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS.

```bash
git add packages/audit-pipeline/src/composer.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/composer.test.ts
git commit -m "feat(audit-pipeline): composer for findings, unavailable blocks, action board"
```

---

### Task 9: Report-model builder + Ajv 2020-12 validator against `schemas/`

**Files:**

- Create: `packages/audit-pipeline/src/report-model.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/report-model.test.ts`

**Interfaces:**

- Consumes: `StoredFinding` (Task 6), `REPO_ROOT` (Task 6), `schemas/report-model.schema.json` + `schemas/common.schema.json` (repo root, pre-existing).
- Produces: `BuildReportModelParams`, `buildReportModel(params): ReportModel`, `validateReportModel(report: unknown, schemasDir: string): void` — used by Tasks 11 and 12.

- [ ] **Step 1: Write the failing test**

`packages/audit-pipeline/tests/report-model.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/paths.js";
import { buildReportModel, validateReportModel } from "../src/report-model.js";

const SCHEMAS = join(REPO_ROOT, "schemas");

function params() {
  return {
    auditId: "1f0a9c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    locale: "en" as const,
    secretHash: "sha256:abc",
    expiresAt: new Date("2030-01-01T00:00:00.000Z").toISOString(),
    summaryBullets: ["report.summary.technical"],
    findingIds: ["a1a1a1a1-1111-4111-8111-111111111111"],
    limitationsKeys: ["limitation.score_engine_deferred"],
    pagesChecked: 3,
    sampled: true,
    findings: [],
  };
}

describe("buildReportModel", () => {
  it("emits a report that validates against the real schema", () => {
    const report = buildReportModel(params());
    expect(() => validateReportModel(report, SCHEMAS)).not.toThrow();
  });

  it("uses real uuids for report_id/audit_id and a 32-char link_id", () => {
    const report = buildReportModel(params());
    expect(report.report_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(report.audit_id).toBe("1f0a9c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b");
    expect(report.access.link_id).toBe("1f0a9c2e3b4d4e5f8a9b0c1d2e3f4a5b");
    expect(report.access.noindex).toBe(true);
    expect(report.access.public_gallery).toBe(false);
  });

  it("carries the anonymous M4 projection set and 7-day retention", () => {
    const report = buildReportModel(params());
    expect(report.access_class).toBe("anonymous");
    expect(report.allowed_projections).toEqual(["web_interactive"]);
    expect(report.languages).toEqual(["en"]);
    expect(report.retention_days).toBe(7);
    expect(report.content.sample_disclosure).toEqual({ pages_checked: 3, sampled: true });
    expect(report.lineage_coverage.ratio).toBe(1);
  });
});

describe("validateReportModel", () => {
  it("throws with Ajv detail for a tampered report", () => {
    const report = buildReportModel(params()) as Record<string, unknown>;
    report["retention_days"] = 30;
    expect(() => validateReportModel(report, SCHEMAS)).toThrow(/retention_days|must be/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wpi/audit-pipeline test -- report-model`
Expected: FAIL — `../src/report-model.js` does not exist.

- [ ] **Step 3: Implement `report-model.ts`**

`packages/audit-pipeline/src/report-model.ts`:

```ts
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ReportModel, StoredFinding } from "./report-envelope.js";

export interface BuildReportModelParams {
  auditId: string;
  locale: "en" | "ar";
  secretHash: string;
  expiresAt: string;
  summaryBullets: string[];
  findingIds: string[];
  limitationsKeys: string[];
  pagesChecked: number;
  sampled: boolean;
  findings: StoredFinding[];
}

export function buildReportModel(params: BuildReportModelParams): ReportModel {
  const withLineage = params.findings.filter((finding) => finding.evidence_ids.length > 0).length;
  return {
    report_id: randomUUID(),
    audit_id: params.auditId,
    version: 1,
    access_class: "anonymous",
    languages: [params.locale],
    allowed_projections: ["web_interactive"],
    access: {
      link_id: params.auditId.replace(/-/g, ""),
      secret_hash: params.secretHash,
      noindex: true,
      public_gallery: false,
    },
    tone: "professional",
    content: {
      summary_bullets: params.summaryBullets,
      score_result_ids: [],
      finding_ids: params.findingIds,
      prompt_run_ids: [],
      roadmap_id: null,
      data_gaps: [],
      limitations_keys: params.limitationsKeys,
      sample_disclosure: {
        pages_checked: params.pagesChecked,
        sampled: params.sampled,
      },
    },
    lineage_coverage: {
      numbers_total: withLineage,
      numbers_with_lineage: withLineage,
      ratio: 1,
    },
    status: "ready",
    needs_native_review: false,
    retention_days: 7,
    created_at: new Date().toISOString(),
    expires_at: params.expiresAt,
  };
}

export function validateReportModel(report: unknown, schemasDir: string): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const common = JSON.parse(
    readFileSync(join(schemasDir, "common.schema.json"), "utf-8"),
  ) as object;
  ajv.addSchema(common, "common.schema.json");
  const schema = JSON.parse(
    readFileSync(join(schemasDir, "report-model.schema.json"), "utf-8"),
  ) as object;
  const validate = ajv.compile(schema);
  if (!validate(report)) {
    const details = (validate.errors ?? [])
      .map((error) => `${error.instancePath} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`Report model failed schema validation: ${details}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @wpi/audit-pipeline test -- report-model`
Expected: PASS.

- [ ] **Step 5: Export from the package index**

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export { buildReportModel, validateReportModel } from "./report-model.js";
export type { BuildReportModelParams } from "./report-model.js";
```

- [ ] **Step 6: Run the full package suite and commit**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS.

```bash
git add packages/audit-pipeline/src/report-model.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/report-model.test.ts
git commit -m "feat(audit-pipeline): report model builder + Ajv 2020-12 validator"
```

### Task 10: Agent stage — agents package exports, evidence storage, config loader, per-agent run

**Files:**

- Modify: `services/agents/src/tools/get-evidence.ts:4` — add `export` to `StorageReader` (one word)
- Modify: `services/agents/src/index.ts` — replace whole file (adds 9 tool-factory exports + 2 type exports)
- Create: `packages/audit-pipeline/src/evidence-storage.ts`
- Create: `packages/audit-pipeline/src/agent-config.ts`
- Create: `packages/audit-pipeline/src/agent-stage.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/agent-stage.test.ts`

**Interfaces:**

- Consumes: from `@wpi/agents` — `executeAgent`, `AgentResult` (`{job_id, agent_name, audit_id, output_evidence_ids, result_state, findings: Finding[], limitations, cost: {engine, tokens_in, tokens_out, usd}, duration_ms}`), `ExecuteAgentParams` (`{agentName, allowedTools, job, provider, tools, systemPrompt, userPrompt, toolContext: {audit_id, project_id, evidence_bucket}, model?, maxIterations?}`), `GeminiAdapter(apiKey: string)`, `Orchestrator.createJobs(baseJob: Omit<AgentJob, "job_id" | "agent_name">, agents: string[]): AgentJob[]`, `ToolRegistry.register/get/resolveAll`, `buildSystemPrompt({agentName, modelTier, readsUntrustedContent})`, `buildUserPrompt({job, evidenceContext})`, `resolveModel(tier: string)`, `CostTracker.record({audit_id, agent_name, model, tokens_in, tokens_out, usd})` and `CostTracker.canProceed(auditId)`; from earlier tasks — `AuditContext` (Task 2), `REPO_ROOT` (Task 6), `ComposerAgentOutcome` (Task 6, `report-envelope.ts`); the `yaml` dependency from Task 1's package.json
- Produces: `M4_AGENT_NAMES: readonly ["auditor", "keyword-analyst", "content-strategist"]`, `M4AgentName`, `AgentStageDeps`, `runAgentStage(deps: AgentStageDeps): Promise<ComposerAgentOutcome[]>`, `FsEvidenceStorage(outputDir: string)` implementing `StorageReader`, `agentConfigSchema`, `AgentYamlConfig`, `loadAgentConfig(path: string): AgentYamlConfig` — consumed by Task 11 (`runAgents` wiring) and Task 15 (container)

- [ ] **Step 1: Write the failing test**

`packages/audit-pipeline/tests/agent-stage.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CostTracker, type AgentResult, type ExecuteAgentParams } from "@wpi/agents";
import { M4_AGENT_NAMES, runAgentStage, type AgentStageDeps } from "../src/agent-stage.js";
import { FsEvidenceStorage } from "../src/evidence-storage.js";
import { agentConfigSchema, loadAgentConfig } from "../src/agent-config.js";
import { REPO_ROOT } from "../src/paths.js";
import type { AuditContext } from "../src/audit-context.js";

const AUDIT_ID = "11111111-1111-4111-8111-111111111111";

const AUDIT_CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

function stubResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    job_id: "job-1",
    agent_name: "auditor",
    audit_id: AUDIT_ID,
    output_evidence_ids: [],
    result_state: "verified",
    findings: [
      {
        finding_id: "f-1",
        result_state: "verified",
        confidence: "high",
        evidence_ids: ["ev-1"],
        data: { title: "T", recommendation: "R", severity: "high" },
        limitations: [],
      },
    ],
    limitations: [],
    cost: { engine: "stub-model", tokens_in: 10, tokens_out: 5, usd: 0.01 },
    duration_ms: 1,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AgentStageDeps> = {}): AgentStageDeps {
  const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
  runner.mockResolvedValue(stubResult());
  return {
    auditId: AUDIT_ID,
    projectId: "proj-1",
    targetUrl: "https://example.com",
    context: AUDIT_CONTEXT,
    evidenceIds: ["ev-1", "ev-2"],
    outputDir: "./output",
    geminiApiKey: "test-key",
    runner,
    ...overrides,
  };
}

describe("runAgentStage", () => {
  it("returns one outcome per M4 agent in declared order, mapping findings and cost", async () => {
    const outcomes = await runAgentStage(makeDeps());
    expect(outcomes.map((outcome) => outcome.agent_name)).toEqual([...M4_AGENT_NAMES]);
    expect(outcomes[0]?.findings[0]?.finding_id).toBe("f-1");
    expect(outcomes[0]?.cost).toEqual({
      engine: "stub-model",
      tokens_in: 10,
      tokens_out: 5,
      usd: 0.01,
    });
  });

  it("records a cost entry per agent", async () => {
    const costTracker = new CostTracker();
    const recordSpy = vi.spyOn(costTracker, "record");
    await runAgentStage(makeDeps({ costTracker }));
    expect(recordSpy).toHaveBeenCalledTimes(3);
    expect(recordSpy.mock.calls[0]?.[0]).toMatchObject({
      audit_id: AUDIT_ID,
      agent_name: "auditor",
      model: "stub-model",
    });
  });

  it("returns unavailable outcomes for every agent without running when the cost budget is exhausted", async () => {
    const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
    runner.mockResolvedValue(stubResult());
    const outcomes = await runAgentStage(
      makeDeps({ costTracker: new CostTracker({ perAuditHardCap: 0 }), runner }),
    );
    expect(
      outcomes.every(
        (outcome) => !outcome.ok && outcome.unavailable_reason_key === "unavailable.budget_cap",
      ),
    ).toBe(true);
    expect(runner).not.toHaveBeenCalled();
  });

  it("passes the config-filtered tool allowlist to the runner", async () => {
    const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
    runner.mockResolvedValue(stubResult());
    await runAgentStage(makeDeps({ runner }));
    const calls = runner.mock.calls.map((call) => call[0] as ExecuteAgentParams);
    const auditorCall = calls.find((params) => params.agentName === "auditor");
    expect(auditorCall?.allowedTools).toEqual(["get_evidence", "validate_schema"]);
    const contentCall = calls.find((params) => params.agentName === "content-strategist");
    expect(contentCall?.allowedTools).toEqual([
      "find_opportunities",
      "write_brief",
      "draft_article",
    ]);
  });

  it("marks an agent unavailable when its result_state is unavailable", async () => {
    const runner = vi.fn<(params: ExecuteAgentParams) => Promise<AgentResult>>();
    runner.mockResolvedValue(stubResult({ result_state: "unavailable" }));
    const outcomes = await runAgentStage(makeDeps({ runner }));
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.unavailable_reason_key).toBe("unavailable.agent.auditor");
  });
});

describe("loadAgentConfig", () => {
  it("parses the real auditor agent config", () => {
    const config = loadAgentConfig(join(REPO_ROOT, "config", "agents", "auditor.yaml"));
    expect(config.name).toBe("auditor");
    expect(config.model_tier).toBe("fast");
    expect(agentConfigSchema.safeParse(config).success).toBe(true);
  });
});

describe("FsEvidenceStorage", () => {
  it("reads JSON evidence laid out as evidence/{auditId}/{evidenceId}.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wpi-evidence-"));
    try {
      await mkdir(join(dir, "evidence", "audit-1"), { recursive: true });
      await writeFile(
        join(dir, "evidence", "audit-1", "ev-1.json"),
        JSON.stringify({ title: "Page", url: "https://example.com" }),
      );
      const storage = new FsEvidenceStorage(dir);
      const data = await storage.read("ignored-bucket", "evidence/audit-1/ev-1.json");
      expect(data).toEqual({ title: "Page", url: "https://example.com" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wpi/audit-pipeline test -- agent-stage`
Expected: FAIL — Vitest cannot resolve `../src/agent-stage.js` (module not found). This run uses the stale `@wpi/agents` build output, which still has everything the test imports from `@wpi/agents`; only the new pipeline modules are missing.

- [ ] **Step 3: Implement the five pieces**

**(3a) Export `StorageReader` from `services/agents/src/tools/get-evidence.ts`.** Change line 4 from:

```ts
interface StorageReader {
```

to:

```ts
export interface StorageReader {
```

**(3b) Replace `services/agents/src/index.ts` with:**

```ts
export { AgentLoader } from "./runtime/agent-loader.js";
export { executeAgent } from "./runtime/agent-instance.js";
export type { ExecuteAgentParams } from "./runtime/agent-instance.js";
export { ToolRegistry } from "./tools/registry.js";
export { GeminiAdapter } from "./providers/gemini-adapter.js";
export { resolveModel } from "./providers/model-resolver.js";
export { CircuitBreaker } from "./providers/circuit-breaker.js";
export { CostTracker } from "./providers/cost-tracker.js";
export { buildSystemPrompt, buildUserPrompt } from "./providers/prompt-builder.js";
export { Orchestrator } from "./orchestration/orchestrator.js";
export { DependencyGraph } from "./orchestration/dependency-graph.js";
export { handleAgentTask } from "./orchestration/agent-task-handler.js";
export { createGetEvidenceTool } from "./tools/get-evidence.js";
export type { StorageReader } from "./tools/get-evidence.js";
export { createImportKeywordsTool } from "./tools/import-keywords.js";
export { createClusterKeywordsTool } from "./tools/cluster-keywords.js";
export { createMapKeywordsTool } from "./tools/map-keywords.js";
export { createCheckCannibalizationTool } from "./tools/check-cannibalization.js";
export { createFindOpportunitiesTool } from "./tools/find-opportunities.js";
export { createWriteBriefTool } from "./tools/write-brief.js";
export { createDraftArticleTool } from "./tools/draft-article.js";
export { createValidateSchemaTool } from "./tools/validate-schema.js";

export type { AgentJob, AgentResult, Finding, AgentConfig } from "./runtime/types.js";
export type { Tool, ToolContext, ToolResult } from "./tools/types.js";
export type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./providers/types.js";
```

**(3c) `packages/audit-pipeline/src/evidence-storage.ts`:**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { StorageReader } from "@wpi/agents";

export class FsEvidenceStorage implements StorageReader {
  constructor(private readonly outputDir: string) {}

  async read(_bucket: string, path: string): Promise<unknown> {
    const raw = await readFile(join(this.outputDir, path), "utf8");
    return JSON.parse(raw) as unknown;
  }
}
```

**(3d) `packages/audit-pipeline/src/agent-config.ts`:**

```ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export const agentConfigSchema = z.object({
  name: z.string(),
  milestone: z.string(),
  reads_untrusted_content: z.boolean(),
  model_tier: z.enum(["fast", "fast_plus_embedding", "strong_reasoning"]),
  tools: z.array(z.string()),
  forbidden_tools: z.array(z.string()),
});

export type AgentYamlConfig = z.infer<typeof agentConfigSchema>;

export function loadAgentConfig(path: string): AgentYamlConfig {
  return agentConfigSchema.parse(parse(readFileSync(path, "utf-8")) as unknown);
}
```

**(3e) `packages/audit-pipeline/src/agent-stage.ts`:**

```ts
import { join } from "node:path";
import {
  buildSystemPrompt,
  buildUserPrompt,
  createCheckCannibalizationTool,
  createClusterKeywordsTool,
  createDraftArticleTool,
  createFindOpportunitiesTool,
  createGetEvidenceTool,
  createImportKeywordsTool,
  createMapKeywordsTool,
  createValidateSchemaTool,
  createWriteBriefTool,
  executeAgent,
  GeminiAdapter,
  Orchestrator,
  resolveModel,
  ToolRegistry,
  type AgentResult,
  type CostTracker,
  type ExecuteAgentParams,
} from "@wpi/agents";
import { loadAgentConfig } from "./agent-config.js";
import type { AuditContext } from "./audit-context.js";
import { FsEvidenceStorage } from "./evidence-storage.js";
import { REPO_ROOT } from "./paths.js";
import type { ComposerAgentOutcome } from "./report-envelope.js";

export const M4_AGENT_NAMES = ["auditor", "keyword-analyst", "content-strategist"] as const;

export type M4AgentName = (typeof M4_AGENT_NAMES)[number];

export interface AgentStageDeps {
  auditId: string;
  projectId: string;
  targetUrl: string;
  context: AuditContext;
  evidenceIds: string[];
  outputDir: string;
  geminiApiKey: string;
  costTracker?: CostTracker;
  runner?: (params: ExecuteAgentParams) => Promise<AgentResult>;
}

export async function runAgentStage(deps: AgentStageDeps): Promise<ComposerAgentOutcome[]> {
  if (deps.costTracker !== undefined && !deps.costTracker.canProceed(deps.auditId)) {
    return M4_AGENT_NAMES.map((agentName) => ({
      agent_name: agentName,
      ok: false,
      findings: [],
      limitations: [],
      unavailable_reason_key: "unavailable.budget_cap",
    }));
  }

  const registry = new ToolRegistry();
  registry.register(createGetEvidenceTool(new FsEvidenceStorage(deps.outputDir)));
  registry.register(createImportKeywordsTool());
  registry.register(createClusterKeywordsTool());
  registry.register(createMapKeywordsTool());
  registry.register(createCheckCannibalizationTool());
  registry.register(createFindOpportunitiesTool());
  registry.register(createWriteBriefTool());
  registry.register(createDraftArticleTool());
  registry.register(createValidateSchemaTool());

  const provider = new GeminiAdapter(deps.geminiApiKey);
  const orchestrator = new Orchestrator();
  const runner = deps.runner ?? executeAgent;

  const outcomes: ComposerAgentOutcome[] = [];
  for (const agentName of M4_AGENT_NAMES) {
    const config = loadAgentConfig(join(REPO_ROOT, "config", "agents", `${agentName}.yaml`));
    const allowedNames = config.tools.filter((toolName) => registry.get(toolName) !== undefined);
    const tools = registry.resolveAll(allowedNames);
    const jobs = orchestrator.createJobs(
      {
        audit_id: deps.auditId,
        project_id: deps.projectId,
        input_evidence_ids: deps.evidenceIds,
        context: {
          site: deps.targetUrl,
          market: deps.context.market,
          language: deps.context.customer_language,
          business_goal: deps.context.offering,
        },
        capture_time: new Date().toISOString(),
      },
      [config.name],
    );
    const job = jobs[0];
    if (job === undefined) {
      throw new Error(`Orchestrator returned no job for agent ${config.name}`);
    }
    const result = await runner({
      agentName: config.name,
      allowedTools: allowedNames,
      job,
      provider,
      tools,
      systemPrompt: buildSystemPrompt({
        agentName: config.name,
        modelTier: config.model_tier,
        readsUntrustedContent: config.reads_untrusted_content,
      }),
      userPrompt: buildUserPrompt({
        job,
        evidenceContext:
          deps.evidenceIds.length > 0
            ? `Evidence files available via get_evidence for ids: ${deps.evidenceIds.join(", ")}`
            : "No evidence files available.",
      }),
      toolContext: {
        audit_id: deps.auditId,
        project_id: deps.projectId,
        evidence_bucket: deps.outputDir,
      },
      model: resolveModel(config.model_tier),
    });
    const ok = result.result_state !== "unavailable";
    deps.costTracker?.record({
      audit_id: deps.auditId,
      agent_name: config.name,
      model: result.cost.engine,
      tokens_in: result.cost.tokens_in,
      tokens_out: result.cost.tokens_out,
      usd: result.cost.usd,
    });
    outcomes.push({
      agent_name: config.name,
      ok,
      findings: result.findings.map((finding) => ({
        finding_id: finding.finding_id,
        result_state: finding.result_state,
        confidence: finding.confidence,
        evidence_ids: [...finding.evidence_ids],
        data: { ...finding.data },
        limitations: [...finding.limitations],
      })),
      limitations: [...result.limitations],
      cost: {
        engine: result.cost.engine,
        tokens_in: result.cost.tokens_in,
        tokens_out: result.cost.tokens_out,
        usd: result.cost.usd,
      },
      unavailable_reason_key: ok ? undefined : `unavailable.agent.${config.name}`,
    });
  }
  return outcomes;
}
```

**(3f) Append to `packages/audit-pipeline/src/index.ts`:**

```ts
export { M4_AGENT_NAMES, runAgentStage } from "./agent-stage.js";
export type { AgentStageDeps, M4AgentName } from "./agent-stage.js";
export { FsEvidenceStorage } from "./evidence-storage.js";
export { agentConfigSchema, loadAgentConfig } from "./agent-config.js";
export type { AgentYamlConfig } from "./agent-config.js";
```

- [ ] **Step 4: Rebuild workspace packages**

Run: `pnpm -r build`
Expected: exit 0. This step compiles the updated `services/agents` (with the new exports) into `dist/` so the Step 5 test run can resolve `StorageReader`, `ExecuteAgentParams`, and the nine tool factories through the `@wpi/agents` exports map added in Task 1.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @wpi/audit-pipeline test -- agent-stage`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

Before staging, run `git diff --stat -- services/agents` and confirm exactly two files changed (`src/index.ts` and `src/tools/get-evidence.ts`). If anything else under `services/agents` differs, STOP and report — do not stage.

```bash
git add services/agents/src/index.ts services/agents/src/tools/get-evidence.ts packages/audit-pipeline/src/evidence-storage.ts packages/audit-pipeline/src/agent-config.ts packages/audit-pipeline/src/agent-stage.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/agent-stage.test.ts
git commit -m "feat(audit-pipeline): agent stage with per-agent tool allowlists and cost tracking"
```

---

### Task 11: Audit pipeline orchestrator

**Files:**

- Create: `packages/audit-pipeline/src/pipeline.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/pipeline.test.ts`

**Interfaces:**

- Consumes: `AuditStore`/`AuditRecord` (Task 6), `composeSections` (Task 8), `buildReportModel`/`validateReportModel` (Task 9), `TIER_SCOPES`/`TierName`/`TierScope` (Task 4), `REPO_ROOT` (Task 6), `ComposerAgentOutcome` (Task 6).
- Produces: `PipelineDeps`, `PipelineOutcome = "completed" | "partial" | "failed" | "stopped"`, `PipelineStoppedError`, `BASE_LIMITATION_KEYS`, `runAuditPipeline(deps: PipelineDeps, auditId: string): Promise<PipelineOutcome>` — consumed by Task 15 (container wires `InProcessDispatcher` to it).

- [ ] **Step 1: Write the failing test**

`packages/audit-pipeline/tests/pipeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";
import { TIER_SCOPES, type TierName } from "../src/eligibility.js";
import { runAuditPipeline, type PipelineDeps } from "../src/pipeline.js";
import type { ComposerAgentOutcome } from "../src/report-envelope.js";

const AUDIT_CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

function outcome(
  agentName: string,
  ok: boolean,
  findings: ComposerAgentOutcome["findings"] = [],
): ComposerAgentOutcome {
  return {
    agent_name: agentName,
    ok,
    findings,
    limitations: [],
    cost: { engine: "stub", tokens_in: 1, tokens_out: 1, usd: 0.001 },
  };
}

function verifiedFinding(): ComposerAgentOutcome["findings"][number] {
  return {
    finding_id: "f-1",
    result_state: "verified",
    confidence: "high",
    evidence_ids: ["ev-1"],
    data: { title: "Missing meta description", recommendation: "Add one", severity: "high" },
    limitations: [],
  };
}

function makeDeps(store: InMemoryAuditStore, overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    store,
    validateUrl: async () => ({ ok: true }),
    crawl: async () => undefined,
    render: async () => undefined,
    processEvidence: async () => ["ev-1", "ev-2"],
    runAgents: async () => [
      outcome("auditor", true, [verifiedFinding()]),
      outcome("keyword-analyst", true),
      outcome("content-strategist", true),
    ],
    tierScopes: TIER_SCOPES,
    ...overrides,
  };
}

async function seedAudit(store: InMemoryAuditStore, tier: TierName = "rich"): Promise<string> {
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: AUDIT_CONTEXT,
    tier,
    secretHash: "sha256:seed",
    ttlDays: 7,
  });
  return record.id;
}

describe("runAuditPipeline", () => {
  it("runs the happy path and stores a READY_COMPLETE envelope", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("completed");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("READY_COMPLETE");
    expect(raw?.report?.report.audit_id).toBe(auditId);
    expect(raw?.report?.findings).toHaveLength(1);
    expect(raw?.report?.action_board.length).toBeGreaterThan(0);
    expect(raw?.report?.report.content.limitations_keys).toContain(
      "limitation.sample_not_full_site",
    );
    expect(raw?.costs?.total_usd).toBeCloseTo(0.003, 5);
  });

  it("lands on READY_PARTIAL when every agent succeeds but returns no findings", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        runAgents: async () => [
          outcome("auditor", true),
          outcome("keyword-analyst", true),
          outcome("content-strategist", true),
        ],
      }),
      auditId,
    );
    expect(result).toBe("partial");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("READY_PARTIAL");
  });

  it("fails with the validator reason when URL validation rejects", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        validateUrl: async () => ({ ok: false, reason_key: "failure.url_invalid" }),
      }),
      auditId,
    );
    expect(result).toBe("failed");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("FAILED");
    expect(raw?.failure_reason).toBe("failure.url_invalid");
  });

  it("records unavailable blocks for failed agents and still composes", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        runAgents: async () => [
          outcome("auditor", false),
          outcome("keyword-analyst", true),
          outcome("content-strategist", false),
        ],
      }),
      auditId,
    );
    expect(result).toBe("partial");
    const raw = await store.getRaw(auditId);
    const sections = (raw?.report?.unavailable ?? []).map((block) => block.section);
    expect(sections).toContain("technical");
    expect(sections).toContain("content");
    expect(raw?.report?.report.content.summary_bullets).toEqual(["report.summary.keywords"]);
  });

  it("fails with failure.tier_refused when the tier is refused", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store, "refused");
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("failed");
    const raw = await store.getRaw(auditId);
    expect(raw?.failure_reason).toBe("failure.tier_refused");
  });

  it("stops without touching a soft-deleted audit", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    await store.softDelete(auditId);
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("stopped");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("QUEUED");
  });

  it("stops when the audit is mid-flight (not QUEUED)", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    await store.transition(auditId, "VALIDATING");
    const result = await runAuditPipeline(makeDeps(store), auditId);
    expect(result).toBe("stopped");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("VALIDATING");
  });

  it("fails with failure.pipeline_error when crawl throws", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);
    const result = await runAuditPipeline(
      makeDeps(store, {
        crawl: async () => {
          throw new Error("crawl boom");
        },
      }),
      auditId,
    );
    expect(result).toBe("failed");
    const raw = await store.getRaw(auditId);
    expect(raw?.status).toBe("FAILED");
    expect(raw?.failure_reason).toBe("failure.pipeline_error");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wpi/audit-pipeline test -- pipeline`
Expected: FAIL — `../src/pipeline.js` does not exist.

- [ ] **Step 3: Implement `pipeline.ts`**

`packages/audit-pipeline/src/pipeline.ts`:

```ts
import { join } from "node:path";
import type { AuditRecord, AuditStore } from "./audit-store.js";
import { composeSections } from "./composer.js";
import type { TierName, TierScope } from "./eligibility.js";
import { REPO_ROOT } from "./paths.js";
import { buildReportModel, validateReportModel } from "./report-model.js";
import type { ComposerAgentOutcome } from "./report-envelope.js";

export const BASE_LIMITATION_KEYS = [
  "limitation.score_engine_deferred",
  "limitation.deterministic_rules_deferred",
  "limitation.external_api_tools_unavailable",
] as const;

export type PipelineOutcome = "completed" | "partial" | "failed" | "stopped";

export class PipelineStoppedError extends Error {
  constructor(auditId: string) {
    super(`Pipeline stopped for audit ${auditId}`);
    this.name = "PipelineStoppedError";
  }
}

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
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
}

async function requireTransition(store: AuditStore, auditId: string, to: string): Promise<void> {
  const result = await store.transition(auditId, to);
  if (result === "terminal") {
    throw new PipelineStoppedError(auditId);
  }
}

export async function runAuditPipeline(
  deps: PipelineDeps,
  auditId: string,
): Promise<PipelineOutcome> {
  try {
    const raw = await deps.store.getRaw(auditId);
    if (raw === null || raw.deleted_at !== null || raw.status !== "QUEUED") {
      throw new PipelineStoppedError(auditId);
    }
    await requireTransition(deps.store, auditId, "VALIDATING");

    const validation = await deps.validateUrl(raw.target_url);
    if (!validation.ok) {
      await deps.store.setFailure(auditId, validation.reason_key ?? "failure.url_invalid");
      return "failed";
    }

    const scope =
      raw.tier === "rich" || raw.tier === "reduced" || raw.tier === "preview"
        ? deps.tierScopes[raw.tier]
        : undefined;
    if (scope === undefined) {
      await deps.store.setFailure(auditId, "failure.tier_refused");
      return "failed";
    }

    await requireTransition(deps.store, auditId, "CRAWLING");
    await deps.crawl(raw, scope);

    await requireTransition(deps.store, auditId, "EXTRACTING");
    await deps.render(raw);
    const evidenceIds = await deps.processEvidence(raw);

    await requireTransition(deps.store, auditId, "AUDITING");
    const outcomes = await deps.runAgents(raw, evidenceIds, scope);

    await requireTransition(deps.store, auditId, "COMPOSING");
    const composed = composeSections(outcomes, scope);
    const limitationsKeys = [
      ...BASE_LIMITATION_KEYS,
      ...(evidenceIds.length > 0 ? ["limitation.sample_not_full_site"] : []),
    ];
    const report = buildReportModel({
      auditId,
      locale: raw.locale,
      secretHash: raw.secret_hash,
      expiresAt: raw.expires_at,
      summaryBullets: composed.summary_bullets,
      findingIds: composed.findings.map((finding) => finding.id),
      limitationsKeys,
      pagesChecked: evidenceIds.length,
      sampled: evidenceIds.length > 0,
      findings: composed.findings,
    });
    validateReportModel(report, join(REPO_ROOT, "schemas"));
    const envelope = {
      report,
      findings: composed.findings,
      unavailable: composed.unavailable,
      action_board: composed.action_board,
      costs: composed.costs,
    };
    const to =
      composed.findings.length > 0 ? ("READY_COMPLETE" as const) : ("READY_PARTIAL" as const);
    await deps.store.setOutcome(auditId, to, envelope, envelope.costs);
    return to === "READY_COMPLETE" ? "completed" : "partial";
  } catch (error) {
    if (error instanceof PipelineStoppedError) {
      return "stopped";
    }
    await deps.store.setFailure(auditId, "failure.pipeline_error").catch(() => undefined);
    return "failed";
  }
}
```

- [ ] **Step 4: Export from the package index**

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export { BASE_LIMITATION_KEYS, PipelineStoppedError, runAuditPipeline } from "./pipeline.js";
export type { PipelineDeps, PipelineOutcome } from "./pipeline.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @wpi/audit-pipeline test -- pipeline`
Expected: PASS (8 tests).

- [ ] **Step 6: Run the full package suite and commit**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS.

```bash
git add packages/audit-pipeline/src/pipeline.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/pipeline.test.ts
git commit -m "feat(audit-pipeline): audit pipeline orchestrator"
```

---

### Task 12: Dispatchers (in-process + stub) and scoped env

**Files:**

- Create: `packages/audit-pipeline/src/dispatcher.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Test: `packages/audit-pipeline/tests/dispatcher.test.ts`

**Interfaces:**

- Consumes: `AuditStore`/`AuditRecord` (Task 6), `buildReportModel`/`validateReportModel` (Task 9), `deriveActionItems`/`deriveUnavailable` (Task 8), `TIER_SCOPES` (Task 4), `REPO_ROOT` (Task 6), `StoredFinding`/`StoredReportEnvelope` (Task 6).
- Produces: `JobDispatcher` (`{dispatch(jobId: string): Promise<void>}`), `InProcessDispatcher(run)` (serializes jobs through one chain; a rejected run rejects only its own dispatch promise and never blocks the next), `scopedEnv(overrides, fn)` (set/delete env vars for the duration of `fn`, restore in `finally`), `sleep(ms)`, `StubDispatcher(store, delayMs?)` (dev/e2e engine that walks QUEUED → READY_COMPLETE with two deterministic findings, no network, no LLM) — consumed by Task 15 (container).

- [ ] **Step 1: Write the failing test**

`packages/audit-pipeline/tests/dispatcher.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditStore } from "../src/audit-store.js";
import type { AuditContext } from "../src/audit-context.js";
import { InProcessDispatcher, scopedEnv, sleep, StubDispatcher } from "../src/dispatcher.js";

const AUDIT_CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

describe("StubDispatcher", () => {
  it("drives a QUEUED audit to READY_COMPLETE with stub findings", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: AUDIT_CONTEXT,
      tier: "rich",
      secretHash: "sha256:seed",
      ttlDays: 7,
    });
    const dispatcher = new StubDispatcher(store, 10);
    await dispatcher.dispatch(record.id);
    const raw = await store.getRaw(record.id);
    expect(raw?.status).toBe("READY_COMPLETE");
    expect(raw?.report?.findings).toHaveLength(2);
    expect(raw?.report?.report.content.summary_bullets).toEqual([
      "report.summary.technical",
      "report.summary.content",
    ]);
  });
});

describe("InProcessDispatcher", () => {
  it("runs dispatched jobs one at a time in dispatch order", async () => {
    const events: string[] = [];
    const dispatcher = new InProcessDispatcher(async (jobId) => {
      events.push(`start:${jobId}`);
      await sleep(20);
      events.push(`end:${jobId}`);
    });
    const first = dispatcher.dispatch("a");
    const second = dispatcher.dispatch("b");
    await Promise.all([first, second]);
    expect(events).toEqual(["start:a", "end:a", "start:b", "end:b"]);
  });

  it("does not block the next job when a run rejects", async () => {
    const run = vi.fn<(jobId: string) => Promise<void>>();
    run.mockRejectedValueOnce(new Error("boom"));
    run.mockResolvedValueOnce(undefined);
    const dispatcher = new InProcessDispatcher(run);
    await expect(dispatcher.dispatch("a")).rejects.toThrow("boom");
    await expect(dispatcher.dispatch("b")).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("scopedEnv", () => {
  it("applies overrides for the callback and restores prior values", async () => {
    process.env["WPI_SCOPED_TEST"] = "before";
    try {
      await scopedEnv({ WPI_SCOPED_TEST: "during", WPI_SCOPED_NEW: "added" }, async () => {
        expect(process.env["WPI_SCOPED_TEST"]).toBe("during");
        expect(process.env["WPI_SCOPED_NEW"]).toBe("added");
      });
      expect(process.env["WPI_SCOPED_TEST"]).toBe("before");
      expect(process.env["WPI_SCOPED_NEW"]).toBeUndefined();
    } finally {
      delete process.env["WPI_SCOPED_TEST"];
      delete process.env["WPI_SCOPED_NEW"];
    }
  });

  it("deletes variables whose override is undefined and restores them", async () => {
    process.env["WPI_SCOPED_TEST"] = "before";
    try {
      await scopedEnv({ WPI_SCOPED_TEST: undefined }, async () => {
        expect(process.env["WPI_SCOPED_TEST"]).toBeUndefined();
      });
      expect(process.env["WPI_SCOPED_TEST"]).toBe("before");
    } finally {
      delete process.env["WPI_SCOPED_TEST"];
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wpi/audit-pipeline test -- dispatcher`
Expected: FAIL — `../src/dispatcher.js` does not exist.

- [ ] **Step 3: Implement `dispatcher.ts`**

`packages/audit-pipeline/src/dispatcher.ts`:

```ts
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AuditStore } from "./audit-store.js";
import { deriveActionItems, deriveUnavailable } from "./composer.js";
import { TIER_SCOPES } from "./eligibility.js";
import { REPO_ROOT } from "./paths.js";
import { buildReportModel, validateReportModel } from "./report-model.js";
import type { StoredFinding, StoredReportEnvelope } from "./report-envelope.js";

export interface JobDispatcher {
  dispatch(jobId: string): Promise<void>;
}

export class InProcessDispatcher implements JobDispatcher {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly run: (jobId: string) => Promise<void>) {}

  dispatch(jobId: string): Promise<void> {
    const task = this.chain.then(() => this.run(jobId));
    this.chain = task.catch(() => undefined);
    return task;
  }
}

export async function scopedEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BASE_KEYS = [
  "limitation.score_engine_deferred",
  "limitation.deterministic_rules_deferred",
  "limitation.external_api_tools_unavailable",
];

function stubFinding(
  agent: string,
  section: StoredFinding["section"],
  title: string,
  recommendation: string,
): StoredFinding {
  return {
    id: randomUUID(),
    agent,
    section,
    severity: "high",
    state: "verified",
    confidence: "high",
    evidence_ids: [],
    data: { title, recommendation, severity: "high" },
  };
}

export class StubDispatcher implements JobDispatcher {
  constructor(
    private readonly store: AuditStore,
    private readonly delayMs = 150,
  ) {}

  async dispatch(jobId: string): Promise<void> {
    try {
      await this.advance(jobId);
    } catch (error) {
      console.error(`[stub-dispatcher] audit ${jobId} failed`, error);
      await this.store.setFailure(jobId, "failure.pipeline_error").catch(() => undefined);
    }
  }

  private async advance(jobId: string): Promise<void> {
    const initial = await this.store.getRaw(jobId);
    if (initial === null || initial.deleted_at !== null) {
      return;
    }
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      await sleep(this.delayMs);
      const result = await this.store.transition(jobId, status);
      if (result === "terminal") {
        return;
      }
    }
    await sleep(this.delayMs);
    const record = await this.store.getRaw(jobId);
    if (record === null || record.deleted_at !== null) {
      return;
    }
    const scope =
      record.tier === "rich" || record.tier === "reduced" || record.tier === "preview"
        ? TIER_SCOPES[record.tier]
        : TIER_SCOPES.preview;
    const findings: StoredFinding[] = [
      stubFinding(
        "auditor",
        "technical",
        "Missing meta description on key pages",
        "Add unique meta descriptions to all sampled pages.",
      ),
      stubFinding(
        "content-strategist",
        "content",
        "Thin content on service pages",
        "Expand service pages with 300+ words of original content.",
      ),
    ];
    const report = buildReportModel({
      auditId: jobId,
      locale: record.locale,
      secretHash: record.secret_hash,
      expiresAt: record.expires_at,
      summaryBullets: ["report.summary.technical", "report.summary.content"],
      findingIds: findings.map((finding) => finding.id),
      limitationsKeys: [...BASE_KEYS],
      pagesChecked: 1,
      sampled: false,
      findings,
    });
    validateReportModel(report, join(REPO_ROOT, "schemas"));
    const envelope: StoredReportEnvelope = {
      report,
      findings,
      unavailable: deriveUnavailable(scope),
      action_board: deriveActionItems(findings, scope.actionBoardCap),
      costs: { currency: "USD", agents: [], total_usd: 0 },
    };
    await this.store.setOutcome(jobId, "READY_COMPLETE", envelope, envelope.costs);
  }
}
```

- [ ] **Step 4: Export from the package index**

Append to `packages/audit-pipeline/src/index.ts`:

```ts
export { InProcessDispatcher, scopedEnv, sleep, StubDispatcher } from "./dispatcher.js";
export type { JobDispatcher } from "./dispatcher.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @wpi/audit-pipeline test -- dispatcher`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full package suite and commit**

Run: `pnpm --filter @wpi/audit-pipeline test`
Expected: PASS.

```bash
git add packages/audit-pipeline/src/dispatcher.ts packages/audit-pipeline/src/index.ts packages/audit-pipeline/tests/dispatcher.test.ts
git commit -m "feat(audit-pipeline): in-process + stub dispatchers with scoped env"
```

---

### Task 13: Web i18n foundation — next-intl, Tailwind v4, bilingual catalogs

**Files:**

- Delete: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx` (Task 1 placeholders)
- Modify: `apps/web/next.config.ts` (remove built-in `i18n` key — incompatible with next-intl app router), `apps/web/package.json`, `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.mjs`, `apps/web/vitest.config.ts`, `apps/web/src/i18n/routing.ts`, `apps/web/src/i18n/navigation.ts`, `apps/web/src/i18n/request.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/messages/en.json`, `apps/web/src/messages/ar.json`
- Test: `apps/web/src/i18n/parity.test.ts`

**Interfaces:**

- Consumes: nothing from the pipeline yet (this task is self-contained).
- Produces: `routing` (next-intl routing config, locales `["en","ar"]`, default `"en"`); `Link`/`redirect`/`usePathname`/`useRouter` from `src/i18n/navigation.ts`; message namespaces `common`, `nav`, `landing`, `form`, `status`, `report`, `failure`, `unavailable`, `limitation`, `error`, `pages` (identical key trees in en.json and ar.json — enforced by the parity test); root layout at `src/app/[locale]/layout.tsx` that sets `dir="rtl"` for Arabic and provides both font variables.

- [ ] **Step 1: Delete the placeholder app dir and write the failing parity test**

```bash
rm -r /Users/ibrahimabedrabboh/Qoder/Qoder/apps/web/app
```

`apps/web/src/i18n/parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function keyPaths(value: JsonValue, prefix = ""): string[] {
  if (typeof value === "string") {
    return [prefix];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      keyPaths(entry, prefix === "" ? `[${index}]` : `${prefix}[${index}]`),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      keyPaths(entry, prefix === "" ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
}

function nonEmptyStrings(value: JsonValue): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(nonEmptyStrings);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(nonEmptyStrings);
  }
  return [];
}

describe("message catalog parity", () => {
  it("en and ar expose identical key paths", () => {
    expect(keyPaths(en as JsonValue).sort()).toEqual(keyPaths(ar as JsonValue).sort());
  });

  it("contains no empty strings", () => {
    for (const [name, catalog] of [
      ["en", en],
      ["ar", ar],
    ] as const) {
      const strings = nonEmptyStrings(catalog as JsonValue);
      expect(strings.length).toBeGreaterThan(0);
      for (const text of strings) {
        expect(text.trim().length, `${name} catalog has an empty string`).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Update package.json + tsconfig.json, install, run the test to verify it fails**

Replace `apps/web/package.json` with:

```json
{
  "name": "@wpi/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@wpi/agents": "workspace:*",
    "@wpi/audit-pipeline": "workspace:*",
    "@wpi/crawler": "workspace:*",
    "@wpi/evidence-processor": "workspace:*",
    "@wpi/render-job": "workspace:*",
    "@wpi/security": "workspace:*",
    "next": "^15.1.0",
    "next-intl": "^4.14.8",
    "pg": "^8.23.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.13.0",
    "@playwright/test": "^1.49.0",
    "@types/pg": "^8.23.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.1"
  }
}
```

(The six `@wpi/*` workspace deps and `pg` are required up front: pnpm's strict isolation means the Task 15 container cannot import packages that are not direct dependencies of `apps/web`. `@playwright/test` lands now so Task 19 needs no second install.)

Replace `apps/web/tsconfig.json` with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "noEmit": true,
    "incremental": true
  },
  "include": ["app", "next-env.d.ts", "src", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Run:

```bash
cd /Users/ibrahimabedrabboh/Qoder/Qoder && pnpm install
pnpm --filter @wpi/web test
```

Expected: FAIL — cannot resolve `../messages/en.json` (files do not exist yet).

- [ ] **Step 3: Implement the i18n foundation**

`apps/web/next.config.ts` (full replacement — the built-in `i18n` key must go):

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(config);
```

`apps/web/postcss.config.mjs`:

```mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

(The include pattern itself contains no brackets, so `[locale]` directories never match it — route tests therefore live in `src/test/` from Task 15 onward.)

`apps/web/src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
});
```

`apps/web/src/i18n/navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
```

`apps/web/src/i18n/request.ts`:

```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

`apps/web/src/middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

`apps/web/src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-inter), var(--font-plex-arabic), ui-sans-serif, system-ui, sans-serif;
}
```

`apps/web/src/app/[locale]/layout.tsx`:

```tsx
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Link } from "../../i18n/navigation";
import { routing } from "../../i18n/routing";
import "../../app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "600"],
  variable: "--font-plex-arabic",
});

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("brand") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${plexArabic.variable}`}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <NextIntlClientProvider>
          <header className="border-b border-neutral-200">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-semibold">
                {t("brand")}
              </Link>
              <div className="flex gap-4 text-sm">
                <Link href="/methodology">{t("methodology")}</Link>
                <Link href="/privacy">{t("privacy")}</Link>
                <Link href="/terms">{t("terms")}</Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

> Note: `next/font/google` downloads fonts at build time. If the executor's environment is offline, replace the `Inter`/`IBM_Plex_Sans_Arabic` imports with a plain CSS font stack in `globals.css` (`--font-sans: ui-sans-serif, system-ui, "Segoe UI", "Noto Sans Arabic", sans-serif;`) and drop the `className` font variables from `<html>`. Everything else in this task is unaffected.

`apps/web/src/messages/en.json`:

```json
{
  "common": {
    "loading": "Loading…"
  },
  "nav": {
    "brand": "WPI Audit",
    "methodology": "Methodology",
    "privacy": "Privacy",
    "terms": "Terms"
  },
  "landing": {
    "hero_title": "See how AI engines and search engines read your site",
    "hero_subtitle": "A free, anonymous audit of your pages for SEO, AEO, and GEO — no signup, no email, results in minutes.",
    "cta": "Start your free audit",
    "how_title": "How it works",
    "how_step1_title": "Tell us about your business",
    "how_step1_body": "Share your site and a few facts about your offering, market, and customers.",
    "how_step2_title": "We audit your pages",
    "how_step2_body": "Our agents crawl a sample of your pages and analyze technical, keyword, and content signals.",
    "how_step3_title": "Get your action board",
    "how_step3_body": "Receive prioritized recommendations you can act on immediately.",
    "no_signup": "No signup required. Reports are private and deleted after 7 days."
  },
  "form": {
    "title": "Run a free audit",
    "url_label": "Your website URL",
    "url_placeholder": "https://example.com",
    "organization": "Organization name",
    "business_type": "Business type",
    "offering": "Products or services offered",
    "market": "Target market",
    "customer_language": "Customer language",
    "audience": "Target audience",
    "competitors": "Main competitors (optional)",
    "target_keywords": "Target keywords (optional, comma-separated)",
    "target_keywords_hint": "Up to 10 keywords, separated by commas.",
    "submit": "Run my audit",
    "submitting": "Running…",
    "error_url_invalid": "Please enter a valid URL starting with http:// or https://.",
    "error_rate_limited": "You have used all of your free audits. Try again later.",
    "error_generic": "Something went wrong. Please try again."
  },
  "status": {
    "title": "Your audit is running",
    "subtitle": "This usually takes a few minutes. You can keep this tab open.",
    "stage_QUEUED": "Queued",
    "stage_VALIDATING": "Validating URL",
    "stage_CRAWLING": "Crawling pages",
    "stage_EXTRACTING": "Extracting content",
    "stage_AUDITING": "Running agents",
    "stage_COMPOSING": "Composing report",
    "stage_READY_PARTIAL": "Ready with limited scope",
    "stage_READY_COMPLETE": "Ready",
    "failed_title": "This audit failed",
    "expired": "This report has expired. Reports are kept for 7 days.",
    "deleted": "This report has been deleted.",
    "not_found": "We could not find this report.",
    "start_new": "Start a new audit"
  },
  "report": {
    "sections_title": "Findings by area",
    "section_technical": "Technical",
    "section_keywords": "Keywords",
    "section_content": "Content",
    "findings_title": "Findings",
    "action_board_title": "Action board",
    "unavailable_title": "Unavailable sections",
    "limitations_title": "Limitations",
    "sample_disclosure": "Based on a sample of {pages} pages, not your full site.",
    "evidence_label": "Evidence",
    "claim_cta": "Claim this audit (coming soon)",
    "delete_audit": "Delete this audit",
    "delete_confirm": "Delete this audit permanently? This cannot be undone.",
    "severity_critical": "Critical",
    "severity_high": "High",
    "severity_medium": "Medium",
    "severity_low": "Low",
    "severity_info": "Info",
    "state_verified": "Verified",
    "state_inferred": "Inferred",
    "state_not_verified": "Not verified",
    "confidence_high": "High confidence",
    "confidence_medium": "Medium confidence",
    "confidence_low": "Low confidence",
    "summary_technical": "Technical summary",
    "summary_keywords": "Keyword summary",
    "summary_content": "Content summary"
  },
  "failure": {
    "url_invalid": "The URL could not be validated.",
    "pipeline_error": "The audit failed unexpectedly. Please start a new audit.",
    "tier_refused": "You have used all of your free audits."
  },
  "unavailable": {
    "score": "The scoring engine is not available in this release.",
    "experience_effectiveness": "The experience effectiveness panel is not available in this release.",
    "comparison": "Competitor comparison is not available at this tier.",
    "ai_visibility_panel": "The AI visibility panel is not available at this tier.",
    "budget_cap": "This section is unavailable because the audit reached its budget cap.",
    "generic": "This section is unavailable.",
    "technical": "The technical audit section could not be produced.",
    "keywords": "The keyword section could not be produced.",
    "content": "The content section could not be produced.",
    "agent": {
      "auditor": "The technical audit agent could not run.",
      "keyword-analyst": "The keyword analysis agent could not run.",
      "content-strategist": "The content strategy agent could not run."
    }
  },
  "limitation": {
    "sample_not_full_site": "Findings are based on a sample of pages, not the full site.",
    "score_engine_deferred": "Numeric scores are deferred to a later release.",
    "deterministic_rules_deferred": "Deterministic rule checks are deferred to a later release.",
    "external_api_tools_unavailable": "External API tools were unavailable during this audit."
  },
  "error": {
    "not_found": "Page not found.",
    "generic": "Something went wrong."
  },
  "pages": {
    "methodology": {
      "title": "Methodology",
      "p1": "We crawl a representative sample of your pages and analyze them with specialized agents for technical health, keyword strategy, and content quality.",
      "p2": "Each finding carries a verification state and confidence level. Verified findings were directly observed on your pages; inferred findings are drawn from combined evidence.",
      "p3": "Recommendations are prioritized on your action board so you can fix the highest-impact issues first."
    },
    "privacy": {
      "title": "Privacy",
      "p1": "This audit is anonymous. We do not ask for your name, email, or payment details.",
      "p2": "Reports are private: they are not indexed by search engines and are deleted after 7 days.",
      "p3": "We store only the audit findings, the pages sampled, and a cookie that counts your free audits."
    },
    "terms": {
      "title": "Terms",
      "p1": "The free audit is provided as-is, with no guarantee of completeness or accuracy.",
      "p2": "Only audit sites you own or are authorized to review.",
      "p3": "Do not use the service to probe sites that prohibit automated access."
    }
  }
}
```

`apps/web/src/messages/ar.json`:

```json
{
  "common": {
    "loading": "جارٍ التحميل…"
  },
  "nav": {
    "brand": "تدقيق WPI",
    "methodology": "المنهجية",
    "privacy": "الخصوصية",
    "terms": "الشروط"
  },
  "landing": {
    "hero_title": "اكتشف كيف تقرأ محركات الذكاء الاصطناعي ومحركات البحث موقعك",
    "hero_subtitle": "تدقيق مجاني ومجهول لصفحاتك من حيث تحسين محركات البحث وظهور الإجابات وظهور الذكاء الاصطناعي التوليدي — دون تسجيل ودون بريد إلكتروني، والنتائج خلال دقائق.",
    "cta": "ابدأ تدقيقك المجاني",
    "how_title": "كيف يعمل",
    "how_step1_title": "أخبرنا عن نشاطك التجاري",
    "how_step1_body": "شارك رابط موقعك وبعض المعلومات عن عروضك وسوقك وعملائك.",
    "how_step2_title": "نُدقق صفحاتك",
    "how_step2_body": "يفحص وكلاؤنا عينة من صفحاتك ويحللون الإشارات التقنية والكلمات المفتاحية والمحتوى.",
    "how_step3_title": "احصل على لوحة الإجراءات",
    "how_step3_body": "تستلم توصيات مرتبة حسب الأولوية يمكنك العمل عليها فورًا.",
    "no_signup": "لا حاجة للتسجيل. التقارير خاصة وتُحذف بعد 7 أيام."
  },
  "form": {
    "title": "شغّل تدقيقًا مجانيًا",
    "url_label": "رابط موقعك",
    "url_placeholder": "https://example.com",
    "organization": "اسم المؤسسة",
    "business_type": "نوع النشاط",
    "offering": "المنتجات أو الخدمات المقدمة",
    "market": "السوق المستهدف",
    "customer_language": "لغة العملاء",
    "audience": "الجمهور المستهدف",
    "competitors": "أبرز المنافسون (اختياري)",
    "target_keywords": "الكلمات المفتاحية المستهدفة (اختيارية، مفصولة بفواصل)",
    "target_keywords_hint": "حتى 10 كلمات مفتاحية مفصولة بفواصل.",
    "submit": "شغّل تدقيقي",
    "submitting": "جارٍ التشغيل…",
    "error_url_invalid": "يرجى إدخال رابط صحيح يبدأ بـ http:// أو https://.",
    "error_rate_limited": "لقد استخدمت جميع تدقيقاتك المجانية. حاول مرة أخرى لاحقًا.",
    "error_generic": "حدث خطأ ما. يرجى المحاولة مرة أخرى."
  },
  "status": {
    "title": "تدقيقك قيد التشغيل",
    "subtitle": "عادةً يستغرق ذلك بضع دقائق. يمكنك إبقاء هذه الصفحة مفتوحة.",
    "stage_QUEUED": "في قائمة الانتظار",
    "stage_VALIDATING": "التحقق من الرابط",
    "stage_CRAWLING": "فحص الصفحات",
    "stage_EXTRACTING": "استخراج المحتوى",
    "stage_AUDITING": "تشغيل الوكلاء",
    "stage_COMPOSING": "إعداد التقرير",
    "stage_READY_PARTIAL": "جاهز بنطاق محدود",
    "stage_READY_COMPLETE": "جاهز",
    "failed_title": "فشل هذا التدقيق",
    "expired": "انتهت صلاحية هذا التقرير. تُحفظ التقارير لمدة 7 أيام.",
    "deleted": "تم حذف هذا التقرير.",
    "not_found": "لم نتمكن من العثور على هذا التقرير.",
    "start_new": "ابدأ تدقيقًا جديدًا"
  },
  "report": {
    "sections_title": "النتائج حسب المجال",
    "section_technical": "التقني",
    "section_keywords": "الكلمات المفتاحية",
    "section_content": "المحتوى",
    "findings_title": "النتائج",
    "action_board_title": "لوحة الإجراءات",
    "unavailable_title": "الأقسام غير المتاحة",
    "limitations_title": "القيود",
    "sample_disclosure": "استنادًا إلى عينة من {pages} صفحات، وليس موقعك بالكامل.",
    "evidence_label": "الدليل",
    "claim_cta": "استلم هذا التدقيق (قريبًا)",
    "delete_audit": "احذف هذا التدقيق",
    "delete_confirm": "هل تريد حذف هذا التدقيق نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.",
    "severity_critical": "حرج",
    "severity_high": "مرتفع",
    "severity_medium": "متوسط",
    "severity_low": "منخفض",
    "severity_info": "معلومة",
    "state_verified": "مُوثّق",
    "state_inferred": "مُستنتج",
    "state_not_verified": "غير موثّق",
    "confidence_high": "ثقة عالية",
    "confidence_medium": "ثقة متوسطة",
    "confidence_low": "ثقة منخفضة",
    "summary_technical": "الملخص التقني",
    "summary_keywords": "ملخص الكلمات المفتاحية",
    "summary_content": "ملخص المحتوى"
  },
  "failure": {
    "url_invalid": "تعذّر التحقق من صحة الرابط.",
    "pipeline_error": "فشل التدقيق بشكل غير متوقع. يرجى بدء تدقيق جديد.",
    "tier_refused": "لقد استخدمت جميع تدقيقاتك المجانية."
  },
  "unavailable": {
    "score": "محرك الدرجات غير متاح في هذا الإصدار.",
    "experience_effectiveness": "لوحة فعالية التجربة غير متاحة في هذا الإصدار.",
    "comparison": "مقارنة المنافسين غير متاحة في هذه الفئة.",
    "ai_visibility_panel": "لوحة ظهور الذكاء الاصطناعي غير متاحة في هذه الفئة.",
    "budget_cap": "هذا القسم غير متاح لأن التدقيق بلغ حد الميزانية.",
    "generic": "هذا القسم غير متاح.",
    "technical": "تعذّر إنتاج قسم التدقيق التقني.",
    "keywords": "تعذّر إنتاج قسم الكلمات المفتاحية.",
    "content": "تعذّر إنتاج قسم المحتوى.",
    "agent": {
      "auditor": "تعذّر تشغيل وكيل التدقيق التقني.",
      "keyword-analyst": "تعذّر تشغيل وكيل تحليل الكلمات المفتاحية.",
      "content-strategist": "تعذّر تشغيل وكيل استراتيجية المحتوى."
    }
  },
  "limitation": {
    "sample_not_full_site": "تستند النتائج إلى عينة من الصفحات، وليس إلى الموقع بالكامل.",
    "score_engine_deferred": "الدرجات الرقمية مؤجلة إلى إصدار لاحق.",
    "deterministic_rules_deferred": "فحوصات القواعد الحتمية مؤجلة إلى إصدار لاحق.",
    "external_api_tools_unavailable": "لم تكن أدوات الواجهات الخارجية متاحة أثناء هذا التدقيق."
  },
  "error": {
    "not_found": "الصفحة غير موجودة.",
    "generic": "حدث خطأ ما."
  },
  "pages": {
    "methodology": {
      "title": "المنهجية",
      "p1": "نفحص عينة ممثلة من صفحاتك ونحللها بوكلاء متخصصين في السلامة التقنية واستراتيجية الكلمات المفتاحية وجودة المحتوى.",
      "p2": "تحمل كل نتيجة حالة توثيق ومستوى ثقة. النتائج الموثّقة رُصدت مباشرة على صفحاتك، والنتائج المُستنتجة تُستخلص من أدلة مجمعة.",
      "p3": "تُرتب التوصيات في لوحة الإجراءات حسب الأولوية لتتمكن من معالجة القضايا الأكثر تأثيرًا أولًا."
    },
    "privacy": {
      "title": "الخصوصية",
      "p1": "هذا التدقيق مجهول. لا نطلب اسمك أو بريدك الإلكتروني أو تفاصيل الدفع.",
      "p2": "التقارير خاصة: لا تُفهرس بواسطة محركات البحث وتُحذف بعد 7 أيام.",
      "p3": "نخزن نتائج التدقيق والصفحات المفحوصة فقط، بالإضافة إلى ملف تعريف ارتباط يعدّ تدقيقاتك المجانية."
    },
    "terms": {
      "title": "الشروط",
      "p1": "يُقدَّم التدقيق المجاني كما هو، دون ضمان للاكتمال أو الدقة.",
      "p2": "لا تُدقق إلا المواقع التي تملكها أو تملك إذنًا بمراجعتها.",
      "p3": "لا تستخدم الخدمة لفحص مواقع تحظر الوصول الآلي إليها."
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes, then typecheck**

```bash
pnpm --filter @wpi/web test
```

Expected: PASS (2 tests).

```bash
pnpm --filter @wpi/web exec tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/vitest.config.ts apps/web/src/i18n apps/web/src/middleware.ts "apps/web/src/app/[locale]/layout.tsx" apps/web/src/app/globals.css apps/web/src/messages apps/web/app pnpm-lock.yaml
git commit -m "feat(web): i18n foundation with next-intl, Tailwind v4, bilingual catalogs"
```

---

### Task 14: Landing page and audit form client

**Files:**

- Create: `apps/web/src/app/[locale]/_components/create-audit-client.ts`, `apps/web/src/app/[locale]/_components/audit-form.tsx`, `apps/web/src/app/[locale]/page.tsx`
- Test: `apps/web/src/app/[locale]/_components/create-audit-client.test.ts`

**Interfaces:**

- Consumes: wire shape `{url, locale, context}` from Task 2 (`createAuditRequestSchema`); `AuditContext` type from `@wpi/audit-pipeline` (Task 2). POST /api/audits (Task 15) responds 201 `{id, secret, status_url}`, 400 `{error: "url_invalid"}`, 429 `{}`, other `{}`.
- Produces: `CreateAuditPayload {url: string; locale: "en" | "ar"; context: AuditContext}`; `CreateAuditSuccess {id: string; secret: string; status_url: string}`; `CreateAuditError = "url_invalid" | "rate_limited" | "generic"`; `CreateAuditResult = {ok: true; data: CreateAuditSuccess} | {ok: false; error: CreateAuditError}`; `mapCreateAuditError(status: number, body: {error?: unknown}): CreateAuditError`; `submitAudit(payload: CreateAuditPayload): Promise<CreateAuditResult>`; `<AuditForm />` client component; landing page RSC at `src/app/[locale]/page.tsx`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/[locale]/_components/create-audit-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditContext } from "@wpi/audit-pipeline";
import { mapCreateAuditError, submitAudit } from "./create-audit-client";

const CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

const PAYLOAD = {
  url: "https://example.com",
  locale: "en" as const,
  context: CONTEXT,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitAudit", () => {
  it("posts to /api/audits and returns the success payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "a1", secret: "s1", status_url: "/en/audit/a1" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({
      ok: true,
      data: { id: "a1", secret: "s1", status_url: "/en/audit/a1" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audits",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps a 400 url_invalid response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "url_invalid" }, 400)));

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "url_invalid" });
  });

  it("maps a 429 response to rate_limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("maps network failure to generic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("maps a malformed 201 body to generic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ nope: true }, 201)));

    const result = await submitAudit(PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
  });
});

describe("mapCreateAuditError", () => {
  it("prefers the body error key", () => {
    expect(mapCreateAuditError(500, { error: "url_invalid" })).toBe("url_invalid");
  });

  it("maps 429 to rate_limited", () => {
    expect(mapCreateAuditError(429, {})).toBe("rate_limited");
  });

  it("maps everything else to generic", () => {
    expect(mapCreateAuditError(500, {})).toBe("generic");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @wpi/web test
```

Expected: FAIL — cannot resolve `./create-audit-client`.

- [ ] **Step 3: Implement the client, form, and landing page**

`apps/web/src/app/[locale]/_components/create-audit-client.ts`:

```ts
import type { AuditContext } from "@wpi/audit-pipeline";

export interface CreateAuditPayload {
  url: string;
  locale: "en" | "ar";
  context: AuditContext;
}

export interface CreateAuditSuccess {
  id: string;
  secret: string;
  status_url: string;
}

export type CreateAuditError = "url_invalid" | "rate_limited" | "generic";

export type CreateAuditResult =
  { ok: true; data: CreateAuditSuccess } | { ok: false; error: CreateAuditError };

export function mapCreateAuditError(status: number, body: { error?: unknown }): CreateAuditError {
  if (body.error === "url_invalid") {
    return "url_invalid";
  }
  if (status === 429) {
    return "rate_limited";
  }
  return "generic";
}

export async function submitAudit(payload: CreateAuditPayload): Promise<CreateAuditResult> {
  let response: Response;
  try {
    response = await fetch("/api/audits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: "generic" };
  }

  let body: unknown = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (response.status === 201) {
    const candidate = body as Partial<CreateAuditSuccess>;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.secret === "string" &&
      typeof candidate.status_url === "string"
    ) {
      return { ok: true, data: candidate as CreateAuditSuccess };
    }
    return { ok: false, error: "generic" };
  }

  return mapCreateAuditError(response.status, body as { error?: unknown });
}
```

`apps/web/src/app/[locale]/_components/audit-form.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { submitAudit } from "./create-audit-client";

export function AuditForm() {
  const t = useTranslations("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    const competitors = String(form.get("competitors") ?? "").trim();
    const targetKeywords = String(form.get("target_keywords") ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0)
      .slice(0, 10);
    const locale = document.documentElement.lang === "ar" ? "ar" : "en";

    const result = await submitAudit({
      url,
      locale,
      context: {
        organization: String(form.get("organization") ?? ""),
        business_type: String(form.get("business_type") ?? ""),
        offering: String(form.get("offering") ?? ""),
        market: String(form.get("market") ?? ""),
        customer_language: String(form.get("customer_language") ?? ""),
        audience: String(form.get("audience") ?? ""),
        ...(competitors.length > 0 ? { competitors } : {}),
        ...(targetKeywords.length > 0 ? { target_keywords: targetKeywords } : {}),
      },
    });

    if (result.ok) {
      window.location.assign(
        `${result.data.status_url}?s=${encodeURIComponent(result.data.secret)}`,
      );
      return;
    }
    setError(t(`error_${result.error}`));
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <div>
        <label htmlFor="url" className="block text-sm font-medium">
          {t("url_label")}
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder={t("url_placeholder")}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="organization" className="block text-sm font-medium">
            {t("organization")}
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="business_type" className="block text-sm font-medium">
            {t("business_type")}
          </label>
          <input
            id="business_type"
            name="business_type"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="offering" className="block text-sm font-medium">
            {t("offering")}
          </label>
          <input
            id="offering"
            name="offering"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="market" className="block text-sm font-medium">
            {t("market")}
          </label>
          <input
            id="market"
            name="market"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="customer_language" className="block text-sm font-medium">
            {t("customer_language")}
          </label>
          <input
            id="customer_language"
            name="customer_language"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="audience" className="block text-sm font-medium">
            {t("audience")}
          </label>
          <input
            id="audience"
            name="audience"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label htmlFor="competitors" className="block text-sm font-medium">
          {t("competitors")}
        </label>
        <input
          id="competitors"
          name="competitors"
          type="text"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="target_keywords" className="block text-sm font-medium">
          {t("target_keywords")}
        </label>
        <input
          id="target_keywords"
          name="target_keywords"
          type="text"
          aria-describedby="target_keywords_hint"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
        <p id="target_keywords_hint" className="mt-1 text-sm text-neutral-500">
          {t("target_keywords_hint")}
        </p>
      </div>
      {error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
```

(Only the six required context inputs carry `required`; `competitors` and `target_keywords` are optional per the Task 2 schema and stay unmarked.)

`apps/web/src/app/[locale]/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import { AuditForm } from "./_components/audit-form";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <div className="space-y-12">
      <nav className="flex justify-end gap-4 text-sm" aria-label="Language">
        <Link href="/" locale="en" className={locale === "en" ? "font-semibold underline" : ""}>
          English
        </Link>
        <Link href="/" locale="ar" className={locale === "ar" ? "font-semibold underline" : ""}>
          العربية
        </Link>
      </nav>
      <section className="space-y-4 py-8 text-center">
        <h1 className="text-3xl font-semibold">{t("hero_title")}</h1>
        <p className="mx-auto max-w-2xl text-neutral-600">{t("hero_subtitle")}</p>
        <a
          href="#audit-form"
          className="inline-block rounded bg-neutral-900 px-6 py-3 font-medium text-white"
        >
          {t("cta")}
        </a>
      </section>
      <section id="audit-form">
        <AuditForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("how_title")}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          <li className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">{t("how_step1_title")}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t("how_step1_body")}</p>
          </li>
          <li className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">{t("how_step2_title")}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t("how_step2_body")}</p>
          </li>
          <li className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">{t("how_step3_title")}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t("how_step3_body")}</p>
          </li>
        </ol>
        <p className="text-sm text-neutral-500">{t("no_signup")}</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes, then typecheck**

```bash
pnpm --filter @wpi/web test
pnpm --filter @wpi/web exec tsc --noEmit
```

Expected: PASS (all Task 13 + 14 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/[locale]/_components/create-audit-client.ts" "apps/web/src/app/[locale]/_components/create-audit-client.test.ts" "apps/web/src/app/[locale]/_components/audit-form.tsx" "apps/web/src/app/[locale]/page.tsx"
git commit -m "feat(web): landing page and audit form client"
```

---

### Task 15: Audit services container, instrumentation, POST /api/audits

**Files:**

- Create: `apps/web/src/services/container.ts`, `apps/web/src/instrumentation.ts`, `apps/web/src/app/api/audits/route.ts`
- Test: `apps/web/src/test/container.test.ts`, `apps/web/src/test/api-audits-post.test.ts`

**Interfaces:**

- Consumes: `AuditStore`/`InMemoryAuditStore`/`PostgresAuditStore`/`applyMigrations`/`MIGRATIONS_DIR` (Task 7); `JobDispatcher`/`InProcessDispatcher`/`StubDispatcher`/`runAuditPipeline` (Task 11) and `scopedEnv` (Task 12); `TIER_SCOPES`/`TierScope`/`TierName`/`loadTierScopes`/`decideTier` (Task 4); `ELIGIBILITY_COOKIE_NAME`/`generateAuditSecret`/`hashAuditSecret`/`verifyEligibilityCookie`/`incrementEligibilityCookie` (Task 3); `createAuditRequestSchema` (Task 2); `runAgentStage`/`M4_AGENT_NAMES`/`CostTracker` (Task 10); `ComposerAgentOutcome` (Task 8); `REPO_ROOT` (Task 6); `validateUrl` from `@wpi/security`; `runCrawlJob` from `@wpi/crawler`; `runRenderJob` from `@wpi/render-job`; `runEvidenceProcessor` from `@wpi/evidence-processor`.
- Produces: `AuditServices {store: AuditStore; dispatcher: JobDispatcher; tierScopes: Record<Exclude<TierName, "refused">, TierScope>; cookieSecret: string; validateUrl: (url: string) => Promise<{ok: boolean; reason_key?: string}>; outputDir: string; geminiApiKey: string | undefined}`; `getAuditServices(): Promise<AuditServices>` (initializes once, caches); `setAuditServicesForTests(value: AuditServices | null): void`; `register()` in instrumentation that warms the container on the nodejs runtime; `POST /api/audits` returning 201 `{id, secret, status_url}` + signed eligibility cookie, or 400.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/test/container.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "@wpi/audit-pipeline";
import { getAuditServices, setAuditServicesForTests } from "../services/container";

const ENV_KEYS = ["WPI_DISPATCH_MODE", "AUDIT_COOKIE_SECRET", "WPI_DATABASE_URL"] as const;

afterEach(() => {
  setAuditServicesForTests(null);
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("getAuditServices", () => {
  it("builds stub-mode services by default", async () => {
    const services = await getAuditServices();
    expect(services.store).toBeInstanceOf(InMemoryAuditStore);
    expect(services.geminiApiKey).toBeUndefined();
    expect((await services.validateUrl("https://example.com")).ok).toBe(true);
    expect((await services.validateUrl("not-a-url")).ok).toBe(false);
  });

  it("caches the same instance across calls", async () => {
    const first = await getAuditServices();
    const second = await getAuditServices();
    expect(second).toBe(first);
  });

  it("rejects in_process mode without required env", async () => {
    process.env["WPI_DISPATCH_MODE"] = "in_process";
    await expect(getAuditServices()).rejects.toThrow(/WPI_DATABASE_URL/);
  });
});
```

`apps/web/src/test/api-audits-post.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore, TIER_SCOPES, type AuditStore } from "@wpi/audit-pipeline";
import type { NextRequest } from "next/server";
import type { AuditContext } from "@wpi/audit-pipeline";
import { POST } from "../app/api/audits/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

const CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

const VALID_BODY = {
  url: "https://example.com",
  locale: "en",
  context: CONTEXT,
};

function makeServices(store: AuditStore): AuditServices {
  return {
    store,
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    validateUrl: async (url: string) =>
      url.startsWith("https://") || url.startsWith("http://")
        ? { ok: true }
        : { ok: false, reason_key: "failure.url_invalid" },
    outputDir: "./output",
    geminiApiKey: undefined,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/audits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("POST /api/audits", () => {
  it("creates an audit, dispatches it, and sets the eligibility cookie", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; secret: string; status_url: string };
    expect(typeof body.id).toBe("string");
    expect(typeof body.secret).toBe("string");
    expect(body.status_url).toBe(`/en/audit/${body.id}`);
    expect(response.headers.get("set-cookie")).toContain("wpi_eligibility=");

    const raw = await store.getRaw(body.id);
    expect(raw?.status).toBe("QUEUED");
    expect(raw?.tier).toBe("rich");
  });

  it("rejects non-http(s) URLs with 400 url_invalid", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest({ ...VALID_BODY, url: "ftp://example.com" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("url_invalid");
  });

  it("rejects bodies missing required context fields", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));
    const { audience: _omitted, ...incomplete } = CONTEXT;

    const response = await POST(
      makeRequest({ url: "https://example.com", locale: "en", context: incomplete }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const store = new InMemoryAuditStore();
    setAuditServicesForTests(makeServices(store));

    const response = await POST(makeRequest("{not json"));

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @wpi/web test
```

Expected: FAIL — cannot resolve `../services/container`.

- [ ] **Step 3: Implement the container, instrumentation, and POST route**

`apps/web/src/services/container.ts`:

```ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { CostTracker } from "@wpi/agents";
import {
  InMemoryAuditStore,
  InProcessDispatcher,
  M4_AGENT_NAMES,
  MIGRATIONS_DIR,
  PostgresAuditStore,
  REPO_ROOT,
  runAgentStage,
  runAuditPipeline,
  StubDispatcher,
  TIER_SCOPES,
  scopedEnv,
  loadTierScopes,
  type AuditRecord,
  type AuditStore,
  type ComposerAgentOutcome,
  type JobDispatcher,
  type TierName,
  type TierScope,
} from "@wpi/audit-pipeline";
import { runCrawlJob } from "@wpi/crawler";
import { runEvidenceProcessor } from "@wpi/evidence-processor";
import { runRenderJob } from "@wpi/render-job";
import { validateUrl } from "@wpi/security";
import { Pool } from "pg";

export interface AuditServices {
  store: AuditStore;
  dispatcher: JobDispatcher;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
  cookieSecret: string;
  validateUrl: (url: string) => Promise<{ ok: boolean; reason_key?: string }>;
  outputDir: string;
  geminiApiKey: string | undefined;
}

let services: AuditServices | null = null;

export function setAuditServicesForTests(value: AuditServices | null): void {
  services = value;
}

export async function getAuditServices(): Promise<AuditServices> {
  if (services !== null) {
    return services;
  }
  services = await buildServices();
  return services;
}

type PipelineFields = Pick<
  AuditServices,
  "store" | "tierScopes" | "validateUrl" | "outputDir" | "geminiApiKey"
>;

function buildPipeline(fields: PipelineFields) {
  return {
    store: fields.store,
    tierScopes: fields.tierScopes,
    validateUrl: fields.validateUrl,
    outputDir: fields.outputDir,
    geminiApiKey: fields.geminiApiKey,
    crawl: (record: AuditRecord, scope: TierScope) =>
      scopedEnv(
        {
          AUDIT_ID: record.id,
          ROOT_URL: record.target_url,
          SITEMAP_URL: `${new URL(record.target_url).origin}/sitemap.xml`,
          SAMPLING_MODE: scope.maxPages <= 1 ? "single_page" : "representative_sample",
          MAX_PAGES: String(scope.maxPages),
          OUTPUT_DIR: fields.outputDir,
        },
        () => runCrawlJob(),
      ),
    render: (record: AuditRecord) =>
      scopedEnv({ AUDIT_ID: record.id, OUTPUT_DIR: fields.outputDir }, () => runRenderJob()),
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
  };
}

function localValidateUrl(url: string): { ok: boolean; reason_key?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { ok: true };
    }
    return { ok: false, reason_key: "failure.url_invalid" };
  } catch {
    return { ok: false, reason_key: "failure.url_invalid" };
  }
}

async function buildServices(): Promise<AuditServices> {
  const dispatchMode = process.env["WPI_DISPATCH_MODE"] ?? "in_process";
  const outputDir = process.env["WPI_OUTPUT_DIR"] ?? "./output";

  if (dispatchMode === "stub") {
    const store = new InMemoryAuditStore();
    const fields: PipelineFields = {
      store,
      tierScopes: TIER_SCOPES,
      validateUrl: async (url) => localValidateUrl(url),
      outputDir,
      geminiApiKey: undefined,
    };
    return {
      ...fields,
      dispatcher: new StubDispatcher(store),
      cookieSecret: process.env["AUDIT_COOKIE_SECRET"] ?? "stub-cookie-secret",
    };
  }

  const databaseUrl = process.env["WPI_DATABASE_URL"];
  const cookieSecret = process.env["AUDIT_COOKIE_SECRET"];
  if (databaseUrl === undefined || cookieSecret === undefined) {
    throw new Error(
      "WPI_DATABASE_URL and AUDIT_COOKIE_SECRET are required when WPI_DISPATCH_MODE is not 'stub'",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await applyMigrations(pool, MIGRATIONS_DIR);
  const store = new PostgresAuditStore(pool);
  await store.sweepExpired();

  const fields: PipelineFields = {
    store,
    tierScopes: loadTierScopes(join(REPO_ROOT, "config", "anonymous-eligibility.yaml")),
    validateUrl: async (url) => {
      try {
        const result = await validateUrl(url);
        return result.valid ? { ok: true } : { ok: false, reason_key: "failure.url_invalid" };
      } catch {
        return { ok: false, reason_key: "failure.url_invalid" };
      }
    },
    outputDir,
    geminiApiKey: process.env["WPI_GEMINI_API_KEY"],
  };

  return {
    ...fields,
    dispatcher: new InProcessDispatcher((jobId) => runAuditPipeline(buildPipeline(fields), jobId)),
    cookieSecret,
  };
}
```

`apps/web/src/instrumentation.ts`:

```ts
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") {
    return;
  }
  const { getAuditServices } = await import("./services/container");
  await getAuditServices();
}
```

`apps/web/src/app/api/audits/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import {
  createAuditRequestSchema,
  decideTier,
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  verifyEligibilityCookie,
} from "@wpi/audit-pipeline";
import { getAuditServices } from "../../../services/container";

export const runtime = "nodejs";

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  const parsed = createAuditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  const services = await getAuditServices();
  const urlCheck = await services.validateUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  // reCAPTCHA enforcement lands with the identity decision (docs/decisions.md D-011).
  void process.env["WPI_RECAPTCHA_SECRET"];

  const counts = verifyEligibilityCookie(
    request.cookies.get(ELIGIBILITY_COOKIE_NAME)?.value ?? "",
    services.cookieSecret,
  ) ?? { rich_count: 0, reduced_count: 0, preview_count: 0 };

  const tier = decideTier(counts);
  const secret = generateAuditSecret();
  const record = await services.store.create({
    targetUrl: parsed.data.url,
    locale: parsed.data.locale,
    context: parsed.data.context,
    tier,
    secretHash: hashAuditSecret(secret),
    ttlDays: 7,
  });

  void services.dispatcher.dispatch(record.id);

  const response = NextResponse.json(
    { id: record.id, secret, status_url: `/${parsed.data.locale}/audit/${record.id}` },
    { status: 201 },
  );
  response.cookies.set(
    ELIGIBILITY_COOKIE_NAME,
    incrementEligibilityCookie(counts, tier, services.cookieSecret),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: process.env["NODE_ENV"] === "production",
    },
  );
  return response;
}
```

- [ ] **Step 4: Rebuild workspace packages, run the tests to verify they pass**

```bash
pnpm -r build
pnpm --filter @wpi/web test
```

(The `pnpm -r build` is required: the container imports `runAuditPipeline` and the dispatchers from `@wpi/audit-pipeline`'s `dist`, which was last built at Task 10 — before Tasks 11–12 added those modules.)

Expected: PASS (all tests from Tasks 2–16 so far in web, plus container + POST tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/container.ts apps/web/src/instrumentation.ts apps/web/src/app/api/audits/route.ts apps/web/src/test/container.test.ts apps/web/src/test/api-audits-post.test.ts
git commit -m "feat(web): audit services container, instrumentation, POST /api/audits"
```

---

### Task 16: Access guard, status/DELETE routes, export denial

**Files:**

- Create: `apps/web/src/services/access.ts`, `apps/web/src/app/api/audits/[id]/status/route.ts`, `apps/web/src/app/api/audits/[id]/route.ts`, `apps/web/src/app/api/export/route.ts`, `apps/web/src/app/api/export/[...path]/route.ts`
- Test: `apps/web/src/test/api-routes.test.ts`

**Interfaces:**

- Consumes: `hashAuditSecret` (Task 3); `AuditRecord`/`AuditStore` (Task 6); `AuditServices`/`setAuditServicesForTests` (Task 15).
- Produces: `AccessOutcome = {kind: "authorized"; record: AuditRecord} | {kind: "not_found"} | {kind: "deleted"} | {kind: "expired"}`; `authorizeRecord(store: AuditStore, id: string, secret: string | undefined): Promise<AccessOutcome>`; `GET /api/audits/[id]/status` (200 `{id, status, failure_reason, has_report}` / 404 `{error: "not_found"}` / 410 `{error: "deleted"|"expired"}`, all with `X-Robots-Tag: noindex, nofollow` + `Cache-Control: no-store`); `DELETE /api/audits/[id]` (204 / 404 / 410); every `/api/export/*` method returns 403 `{error: "export_denied"}`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/test/api-routes.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditContext, AuditStore } from "@wpi/audit-pipeline";
import {
  generateAuditSecret,
  hashAuditSecret,
  InMemoryAuditStore,
  TIER_SCOPES,
} from "@wpi/audit-pipeline";
import type { NextRequest } from "next/server";
import { GET as statusGET } from "../app/api/audits/[id]/status/route";
import { DELETE as auditDELETE } from "../app/api/audits/[id]/route";
import { GET as exportGET, POST as exportPOST } from "../app/api/export/route";
import { authorizeRecord } from "../services/access";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

const CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

async function seedStore(): Promise<{ store: InMemoryAuditStore; id: string; secret: string }> {
  const store = new InMemoryAuditStore();
  const secret = generateAuditSecret();
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: CONTEXT,
    tier: "preview",
    secretHash: hashAuditSecret(secret),
    ttlDays: 7,
  });
  return { store, id: record.id, secret };
}

function makeServices(store: AuditStore): AuditServices {
  return {
    store,
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    validateUrl: async () => ({ ok: true }),
    outputDir: "./output",
    geminiApiKey: undefined,
  };
}

function statusRequest(id: string, secret?: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/audits/${id}/status`);
  if (secret !== undefined) {
    url.searchParams.set("s", secret);
  }
  return new NextRequest(url);
}

function deleteRequest(id: string, secret?: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/audits/${id}`);
  if (secret !== undefined) {
    url.searchParams.set("s", secret);
  }
  return new NextRequest(url, { method: "DELETE" });
}

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("authorizeRecord", () => {
  it("returns not_found for an unknown id", async () => {
    const { store } = await seedStore();
    const outcome = await authorizeRecord(store, randomUUID(), "whatever");
    expect(outcome).toEqual({ kind: "not_found" });
  });

  it("returns not_found for a wrong or missing secret", async () => {
    const { store, id } = await seedStore();
    expect(await authorizeRecord(store, id, "wrong-secret")).toEqual({ kind: "not_found" });
    expect(await authorizeRecord(store, id, undefined)).toEqual({ kind: "not_found" });
  });

  it("authorizes the correct secret", async () => {
    const { store, id, secret } = await seedStore();
    const outcome = await authorizeRecord(store, id, secret);
    expect(outcome.kind).toBe("authorized");
    if (outcome.kind === "authorized") {
      expect(outcome.record.status).toBe("QUEUED");
    }
  });

  it("returns deleted for a soft-deleted record", async () => {
    const { store, id, secret } = await seedStore();
    await store.softDelete(id);
    const outcome = await authorizeRecord(store, id, secret);
    expect(outcome).toEqual({ kind: "deleted" });
  });

  it("returns expired for an expired record", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "preview",
      secretHash: hashAuditSecret(secret),
      ttlDays: 0,
    });
    const outcome = await authorizeRecord(store, record.id, secret);
    expect(outcome.kind).toBe("expired");
  });
});

describe("GET /api/audits/[id]/status", () => {
  it("returns status for the correct secret with no-index headers", async () => {
    const { store, id, secret } = await seedStore();
    setAuditServicesForTests(makeServices(store));

    const response = await statusGET(statusRequest(id, secret), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      status: string;
      failure_reason: string | null;
      has_report: boolean;
    };
    expect(body.status).toBe("QUEUED");
    expect(body.has_report).toBe(false);
    expect(body.failure_reason).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 for an unknown id", async () => {
    const { store } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const unknownId = randomUUID();
    const response = await statusGET(statusRequest(unknownId, "whatever"), {
      params: Promise.resolve({ id: unknownId }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a wrong secret", async () => {
    const { store, id } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const response = await statusGET(statusRequest(id, "wrong-secret"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/audits/[id]", () => {
  it("returns 404 for a wrong secret", async () => {
    const { store, id } = await seedStore();
    setAuditServicesForTests(makeServices(store));
    const response = await auditDELETE(deleteRequest(id, "wrong-secret"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });

  it("soft-deletes the record with 204", async () => {
    const { store, id, secret } = await seedStore();
    setAuditServicesForTests(makeServices(store));

    const response = await auditDELETE(deleteRequest(id, secret), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(204);
    const raw = await store.getRaw(id);
    expect(raw?.deleted_at).not.toBeNull();
  });
});

describe("export denial", () => {
  it("denies GET and POST with 403 export_denied", async () => {
    const getResponse = await exportGET();
    expect(getResponse.status).toBe(403);
    const getBody = (await getResponse.json()) as { error: string };
    expect(getBody.error).toBe("export_denied");

    const postResponse = await exportPOST();
    expect(postResponse.status).toBe(403);
    const postBody = (await postResponse.json()) as { error: string };
    expect(postBody.error).toBe("export_denied");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @wpi/web test
```

Expected: FAIL — cannot resolve `../services/access`.

- [ ] **Step 3: Implement the access guard and routes**

`apps/web/src/services/access.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { hashAuditSecret, type AuditRecord, type AuditStore } from "@wpi/audit-pipeline";

export type AccessOutcome =
  | { kind: "authorized"; record: AuditRecord }
  | { kind: "not_found" }
  | { kind: "deleted" }
  | { kind: "expired" };

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function authorizeRecord(
  store: AuditStore,
  id: string,
  secret: string | undefined,
): Promise<AccessOutcome> {
  const raw = await store.getRaw(id);
  if (raw === null) {
    return { kind: "not_found" };
  }
  if (!hashesMatch(hashAuditSecret(secret ?? ""), raw.secret_hash)) {
    return { kind: "not_found" };
  }
  if (raw.deleted_at !== null) {
    return { kind: "deleted" };
  }
  if (new Date(raw.expires_at).getTime() <= Date.now()) {
    await store.transition(id, "EXPIRED").catch(() => undefined);
    return { kind: "expired" };
  }
  return { kind: "authorized", record: raw };
}
```

`apps/web/src/app/api/audits/[id]/status/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authorizeRecord } from "../../../../../services/access";
import { getAuditServices } from "../../../../../services/container";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_INDEX_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX_HEADERS });
  }

  const services = await getAuditServices();
  const secret = request.nextUrl.searchParams.get("s") ?? undefined;
  const outcome = await authorizeRecord(services.store, id, secret);

  if (outcome.kind === "authorized") {
    return NextResponse.json(
      {
        id,
        status: outcome.record.status,
        failure_reason: outcome.record.failure_reason,
        has_report: outcome.record.report !== null,
      },
      { headers: NO_INDEX_HEADERS },
    );
  }
  if (outcome.kind === "deleted" || outcome.kind === "expired") {
    return NextResponse.json({ error: outcome.kind }, { status: 410, headers: NO_INDEX_HEADERS });
  }
  return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX_HEADERS });
}
```

`apps/web/src/app/api/audits/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authorizeRecord } from "../../../../services/access";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const services = await getAuditServices();
  const secret = request.nextUrl.searchParams.get("s") ?? undefined;
  const outcome = await authorizeRecord(services.store, id, secret);

  if (outcome.kind === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (outcome.kind === "deleted" || outcome.kind === "expired") {
    return NextResponse.json({ error: outcome.kind }, { status: 410 });
  }
  const deleted = await services.store.softDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
```

`apps/web/src/app/api/export/route.ts` (and identical content for `apps/web/src/app/api/export/[...path]/route.ts`):

```ts
import { NextResponse } from "next/server";

function deny(): NextResponse {
  return NextResponse.json({ error: "export_denied" }, { status: 403 });
}

export async function GET(): Promise<NextResponse> {
  return deny();
}

export async function POST(): Promise<NextResponse> {
  return deny();
}

export async function PUT(): Promise<NextResponse> {
  return deny();
}

export async function PATCH(): Promise<NextResponse> {
  return deny();
}

export async function DELETE(): Promise<NextResponse> {
  return deny();
}
```

- [ ] **Step 4: Run the test to verify it passes, then typecheck**

```bash
pnpm --filter @wpi/web test
pnpm --filter @wpi/web exec tsc --noEmit
```

Expected: PASS (all web tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/access.ts "apps/web/src/app/api/audits/[id]/route.ts" "apps/web/src/app/api/audits/[id]/status/route.ts" apps/web/src/app/api/export/route.ts "apps/web/src/app/api/export/[...path]/route.ts" apps/web/src/test/api-routes.test.ts
git commit -m "feat(web): access guard, status/delete routes, export denial"
```

---

### Task 17: Audit status page with poller, report view, and self-delete

**Files:**

- Create: `apps/web/src/services/audit-view.ts`, `apps/web/src/app/[locale]/audit/[id]/page.tsx`, `apps/web/src/app/[locale]/audit/[id]/_components/status-poller.tsx`, `apps/web/src/app/[locale]/audit/[id]/_components/report-view.tsx`, `apps/web/src/app/[locale]/audit/[id]/_components/delete-button.tsx`, `apps/web/src/app/[locale]/not-found.tsx`
- Test: `apps/web/src/test/audit-view.test.ts`

**Interfaces:**

- Consumes: `authorizeRecord` (Task 16), `getAuditServices` (Task 15), `AuditRecord`/`StoredReportEnvelope` (Task 6), `Link` (Task 13), message namespaces `status`/`report`/`error` (Task 13).
- Produces: `AuditView = {kind: "running"} | {kind: "ready"} | {kind: "failed"; reasonKey: string}`; `describeAuditView(status: string, failureReason: string | null): AuditView`; `<StatusPoller auditId secret />` (client, polls GET /api/audits/[id]/status every 3s, refreshes on READY/FAILED); `<ReportView record locale secret />` (server, renders findings/unavailable/limitations/action board/delete); audit page RSC with `robots: noindex, nofollow` metadata; `[locale]/not-found.tsx`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/test/audit-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeAuditView } from "../services/audit-view";

describe("describeAuditView", () => {
  it("maps READY_COMPLETE and READY_PARTIAL to ready", () => {
    expect(describeAuditView("READY_COMPLETE", null)).toEqual({ kind: "ready" });
    expect(describeAuditView("READY_PARTIAL", null)).toEqual({ kind: "ready" });
  });

  it("maps FAILED to failed with the stored reason", () => {
    expect(describeAuditView("FAILED", "failure.url_invalid")).toEqual({
      kind: "failed",
      reasonKey: "failure.url_invalid",
    });
  });

  it("falls back to a generic failure reason", () => {
    expect(describeAuditView("FAILED", null)).toEqual({
      kind: "failed",
      reasonKey: "failure.pipeline_error",
    });
  });

  it("maps every other status to running", () => {
    expect(describeAuditView("QUEUED", null)).toEqual({ kind: "running" });
    expect(describeAuditView("CRAWLING", null)).toEqual({ kind: "running" });
    expect(describeAuditView("COMPOSING", null)).toEqual({ kind: "running" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @wpi/web test
```

Expected: FAIL — cannot resolve `../services/audit-view`.

- [ ] **Step 3: Implement `audit-view.ts` and run the test to verify it passes**

`apps/web/src/services/audit-view.ts`:

```ts
export type AuditView =
  { kind: "running" } | { kind: "ready" } | { kind: "failed"; reasonKey: string };

export function describeAuditView(status: string, failureReason: string | null): AuditView {
  if (status === "READY_COMPLETE" || status === "READY_PARTIAL") {
    return { kind: "ready" };
  }
  if (status === "FAILED") {
    return { kind: "failed", reasonKey: failureReason ?? "failure.pipeline_error" };
  }
  return { kind: "running" };
}
```

```bash
pnpm --filter @wpi/web test
```

Expected: PASS.

- [ ] **Step 4: Implement the audit page and components**

`apps/web/src/app/[locale]/audit/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { StoredReportEnvelope } from "@wpi/audit-pipeline";
import { Link } from "../../../../i18n/navigation";
import { authorizeRecord } from "../../../../services/access";
import { getAuditServices } from "../../../../services/container";
import { describeAuditView } from "../../../../services/audit-view";
import { ReportView } from "./_components/report-view";
import { StatusPoller } from "./_components/status-poller";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<{
  robots: { index: boolean; follow: boolean };
  referrer: string;
}> {
  return { robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { locale, id } = await params;
  const { s } = await searchParams;
  setRequestLocale(locale);

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const services = await getAuditServices();
  const outcome = await authorizeRecord(services.store, id, s);

  if (outcome.kind === "not_found" || outcome.kind === "deleted") {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "status" });

  if (outcome.kind === "expired") {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("expired")}</h1>
        <Link href="/" className="underline">
          {t("start_new")}
        </Link>
      </div>
    );
  }

  const view = describeAuditView(outcome.record.status, outcome.record.failure_reason);

  if (view.kind === "failed") {
    const reason = view.reasonKey.startsWith("failure.")
      ? view.reasonKey.slice("failure.".length)
      : view.reasonKey;
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("failed_title")}</h1>
        <p className="text-neutral-600">{t(reason)}</p>
        <Link href="/" className="underline">
          {t("start_new")}
        </Link>
      </div>
    );
  }

  if (view.kind === "running" || outcome.record.report === null) {
    return <StatusPoller auditId={id} secret={s ?? ""} />;
  }

  return <ReportView record={outcome.record} locale={locale} secret={s ?? ""} />;
}
```

`apps/web/src/app/[locale]/audit/[id]/_components/status-poller.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 3000;

const STAGES = ["QUEUED", "VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"] as const;

export function StatusPoller({ auditId, secret }: { auditId: string; secret: string }) {
  const t = useTranslations("status");
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/audits/${auditId}/status?s=${encodeURIComponent(secret)}`,
            { cache: "no-store" },
          );
          if (!response.ok || stopped) {
            return;
          }
          const body = (await response.json()) as {
            status: string;
            has_report: boolean;
          };
          if (stopped) {
            return;
          }
          setCurrentStatus(body.status);
          if (body.has_report || body.status === "FAILED") {
            stopped = true;
            clearInterval(interval);
            router.refresh();
          }
        } catch {
          // Transient fetch failure; the next tick retries.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [auditId, router, secret]);

  const currentIndex =
    currentStatus !== null ? STAGES.indexOf(currentStatus as (typeof STAGES)[number]) : -1;

  return (
    <div className="space-y-6 py-16 text-center" aria-live="polite">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-neutral-600">{t("subtitle")}</p>
      <ol className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
        {STAGES.map((stage, index) => (
          <li
            key={stage}
            aria-current={index <= currentIndex ? "step" : undefined}
            className={
              index <= currentIndex
                ? "rounded-full bg-neutral-900 px-3 py-1 text-sm text-white"
                : "rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-500"
            }
          >
            {t(`stage_${stage}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

`apps/web/src/app/[locale]/audit/[id]/_components/report-view.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { StoredFinding, StoredReportEnvelope } from "@wpi/audit-pipeline";
import { Link } from "../../../../../i18n/navigation";
import { DeleteButton } from "./delete-button";

const SECTIONS = ["technical", "keywords", "content"] as const;

const SUMMARY_LABEL_KEYS: Record<string, string> = {
  "report.summary.technical": "summary_technical",
  "report.summary.keywords": "summary_keywords",
  "report.summary.content": "summary_content",
};

function firstString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function findingTitle(finding: StoredFinding): string {
  return (
    firstString(finding.data, ["title", "summary"]) ??
    firstString(finding.data, ["recommendation", "description", "detail"]) ??
    finding.id
  );
}

function findingDetail(finding: StoredFinding): string | undefined {
  return firstString(finding.data, ["recommendation", "description", "detail"]);
}

export async function ReportView({
  record,
  locale,
  secret,
}: {
  record: AuditRecordWithReport;
  locale: string;
  secret: string;
}) {
  const t = await getTranslations({ locale, namespace: "report" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const envelope = record.report;

  return (
    <div className="space-y-10 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("sections_title")}</h1>
        <p className="text-sm text-neutral-600">{tStatus(`stage_${record.status}`)}</p>
        {envelope.report.content.sample_disclosure.sampled ? (
          <p className="text-sm text-neutral-500">
            {t("sample_disclosure", {
              pages: envelope.report.content.sample_disclosure.pages_checked,
            })}
          </p>
        ) : null}
      </header>

      {envelope.report.content.summary_bullets.length > 0 ? (
        <ul className="list-disc space-y-1 ps-6">
          {envelope.report.content.summary_bullets.map((bullet) => (
            <li key={bullet}>{t(SUMMARY_LABEL_KEYS[bullet] ?? bullet)}</li>
          ))}
        </ul>
      ) : null}

      {SECTIONS.map((section) => {
        const findings = envelope.findings.filter((finding) => finding.section === section);
        if (findings.length === 0) {
          return null;
        }
        return (
          <section key={section} className="space-y-4">
            <h2 className="text-xl font-semibold">{t(`section_${section}`)}</h2>
            <ul className="space-y-3">
              {findings.map((finding) => (
                <li key={finding.id} className="rounded border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">
                      {t(`severity_${finding.severity}`)}
                    </span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                      {t(`state_${finding.state}`)}
                    </span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                      {t(`confidence_${finding.confidence}`)}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{findingTitle(finding)}</p>
                  {findingDetail(finding) !== undefined ? (
                    <p className="mt-1 text-sm text-neutral-600">{findingDetail(finding)}</p>
                  ) : null}
                  {finding.evidence_ids.length > 0 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      {finding.evidence_ids
                        .map((evidenceId) => `${t("evidence_label")} ${evidenceId.slice(0, 8)}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {envelope.action_board.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("action_board_title")}</h2>
          <ol className="space-y-2">
            {envelope.action_board.map((item) => (
              <li key={item.source_finding_id} className="rounded border border-neutral-200 p-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-neutral-600">{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {envelope.unavailable.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t("unavailable_title")}</h2>
          <ul className="list-disc space-y-1 ps-6 text-sm text-neutral-600">
            {envelope.unavailable.map((block) => (
              <li key={`${block.section}:${block.reason_key}`}>{t(block.reason_key)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {envelope.report.content.limitations_keys.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t("limitations_title")}</h2>
          <ul className="list-disc space-y-1 ps-6 text-sm text-neutral-600">
            {envelope.report.content.limitations_keys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-6">
        <button
          type="button"
          disabled
          className="rounded bg-neutral-200 px-4 py-2 text-sm text-neutral-500"
        >
          {t("claim_cta")}
        </button>
        <Link href="/" className="text-sm underline">
          {tStatus("start_new")}
        </Link>
        <DeleteButton auditId={record.id} secret={secret} />
      </div>
    </div>
  );
}
```

(The report view imports one more type — add this line above `ReportView`, after the other imports:

```ts
type AuditRecordWithReport = AuditRecord & { report: StoredReportEnvelope };
```

and extend the type import at the top to `import type { AuditRecord, StoredFinding, StoredReportEnvelope } from "@wpi/audit-pipeline";`)

`apps/web/src/app/[locale]/audit/[id]/_components/delete-button.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "../../../../../i18n/navigation";

export function DeleteButton({ auditId, secret }: { auditId: string; secret: string }) {
  const t = useTranslations("report");
  const router = useRouter();

  async function handleDelete(): Promise<void> {
    if (!window.confirm(t("delete_confirm"))) {
      return;
    }
    const response = await fetch(`/api/audits/${auditId}?s=${encodeURIComponent(secret)}`, {
      method: "DELETE",
    });
    if (response.status === 204) {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      className="text-sm text-red-600 underline"
    >
      {t("delete_audit")}
    </button>
  );
}
```

`apps/web/src/app/[locale]/not-found.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function LocaleNotFound() {
  const t = await getTranslations("error");
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-neutral-600">{t("not_found")}</p>
    </div>
  );
}
```

- [ ] **Step 5: Run the full web suite and typecheck**

```bash
pnpm --filter @wpi/web test
pnpm --filter @wpi/web exec tsc --noEmit
```

Expected: PASS, typecheck clean. (Page rendering behavior is verified end-to-end by Task 19.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/audit-view.ts apps/web/src/test/audit-view.test.ts "apps/web/src/app/[locale]/audit" "apps/web/src/app/[locale]/not-found.tsx"
git commit -m "feat(web): audit status page with poller and report view"
```

---

### Task 18: Static pages (Methodology, Privacy, Terms) and decision D-022

**Files:**

- Create: `apps/web/src/app/[locale]/methodology/page.tsx`, `apps/web/src/app/[locale]/privacy/page.tsx`, `apps/web/src/app/[locale]/terms/page.tsx`
- Modify: `docs/decisions.md` (append-only register)

**Interfaces:**

- Consumes: `pages.methodology`/`pages.privacy`/`pages.terms` message namespaces (Task 13).
- Produces: three static RSC pages reachable from the header nav.

- [ ] **Step 1: Create the three static pages**

`apps/web/src/app/[locale]/methodology/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.methodology" });
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p>{t("p1")}</p>
      <p>{t("p2")}</p>
      <p>{t("p3")}</p>
    </article>
  );
}
```

`apps/web/src/app/[locale]/privacy/page.tsx` — identical shape with namespace `pages.privacy`; `apps/web/src/app/[locale]/terms/page.tsx` — identical shape with namespace `pages.terms`.

- [ ] **Step 2: Record decision D-022**

Append to `docs/decisions.md` (the register is append-only; D-021 is currently the last row):

```markdown
| D-022 | 2026-10-02 | Tailwind CSS v4 (via @tailwindcss/postcss) with logical CSS properties (ps-/pe-/ms-/me-) for RTL support | Single styling dependency; logical properties make RTL automatic | M4-web spec §4 | Decided |
```

- [ ] **Step 3: Typecheck and run the web suite**

```bash
pnpm --filter @wpi/web exec tsc --noEmit
pnpm --filter @wpi/web test
```

Expected: clean, PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/methodology" "apps/web/src/app/[locale]/privacy" "apps/web/src/app/[locale]/terms" docs/decisions.md
git commit -m "feat(web): static pages and decision D-022"
```

---

### Task 19: Playwright e2e — audit journey and accessibility

**Files:**

- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/audit-journey.spec.ts`

**Interfaces:**

- Consumes: stub dispatcher (Task 12, via `WPI_DISPATCH_MODE=stub` — completes an audit in ~1s with no network), form field ids from Task 14, report headings from Task 17, DELETE route from Task 16.
- Produces: `pnpm --filter @wpi/web exec playwright test` — 5 tests (EN journey incl. delete, AR journey, axe on landing EN/AR, axe on report).

- [ ] **Step 1: Install the Chromium browser**

```bash
pnpm --filter @wpi/web exec playwright install chromium
```

Expected: browser downloaded (or already present). Requires network.

- [ ] **Step 2: Write the config and the spec**

`apps/web/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://127.0.0.1:3100/en",
    env: {
      WPI_DISPATCH_MODE: "stub",
      AUDIT_COOKIE_SECRET: "e2e-cookie-secret",
      PORT: "3100",
    },
    timeout: 120000,
    reuseExistingServer: !process.env["CI"],
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

`apps/web/e2e/audit-journey.spec.ts`:

```ts
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const CONTEXT_FIELDS: Array<[string, string]> = [
  ["organization", "Example Corp"],
  ["business_type", "e-commerce"],
  ["offering", "Office furniture"],
  ["market", "Saudi Arabia"],
  ["customer_language", "Arabic"],
  ["audience", "Procurement managers"],
];

async function fillAuditForm(page: Page): Promise<void> {
  await page.fill("#url", "https://example.com");
  for (const [id, value] of CONTEXT_FIELDS) {
    await page.fill(`#${id}`, value);
  }
  await page.click("button[type=submit]");
}

async function expectReportVisible(page: Page, sectionsHeading: string): Promise<void> {
  await page.waitForURL(/\/audit\//, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: sectionsHeading })).toBeVisible({
    timeout: 15000,
  });
}

test("completes an audit in English and allows deletion", async ({ page }) => {
  await page.goto("/en");
  await fillAuditForm(page);
  await page.waitForURL(/\/en\/audit\//, { timeout: 15000 });
  await expectReportVisible(page, "Findings by area");

  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toBe("noindex, nofollow");

  await expect(page.getByRole("heading", { name: "Action board" })).toBeVisible();

  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete this audit" }).click();
  await page.waitForURL(/\/en$/, { timeout: 10000 });
});

test("renders Arabic landing and completes an audit in Arabic", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("اكتشف كيف تقرأ");

  await fillAuditForm(page);
  await page.waitForURL(/\/ar\/audit\//, { timeout: 15000 });
  await expectReportVisible(page, "النتائج حسب المجال");
});

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

test("landing page meets WCAG AA in English and Arabic", async ({ page }) => {
  await page.goto("/en");
  await expectNoSeriousViolations(page);
  await page.goto("/ar");
  await expectNoSeriousViolations(page);
});

test("report page meets WCAG AA", async ({ page }) => {
  await page.goto("/en");
  await fillAuditForm(page);
  await expectReportVisible(page, "Findings by area");
  await expectNoSeriousViolations(page);
});
```

- [ ] **Step 3: Run the e2e suite to verify it passes**

```bash
pnpm --filter @wpi/web exec playwright test
```

Expected: 5 passed. The stub dispatcher advances the audit to READY_COMPLETE within ~1s, so the poller refreshes into the report on its first or second 3s tick.

- [ ] **Step 4: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e
git commit -m "test(web): Playwright e2e audit journey with accessibility checks"
```

---

### Task 20: Final verification and README

**Files:**

- Modify: `README.md` (append M4-web section)

**Interfaces:**

- Consumes: everything built in Tasks 1–19.
- Produces: a green workspace and setup docs for the next engineer.

- [ ] **Step 1: Run the full workspace test suite**

```bash
pnpm -r --no-bail test
```

Expected: every package passes (agents, audit-pipeline incl. unit suites, web).

- [ ] **Step 2: Typecheck and build**

```bash
pnpm typecheck
pnpm --filter @wpi/web build
```

Expected: typecheck clean; `next build` succeeds. (Note: `next build` downloads Google Fonts unless the Task 13 offline fallback was applied.)

- [ ] **Step 3: Lint must not regress**

```bash
pnpm lint 2>&1 | tail -3
```

Expected: the trailing problem count does not exceed the pre-existing baseline of 81 errors — M4-web code must add zero new lint errors.

- [ ] **Step 4: Postgres store suite (if a local database is available)**

```bash
WPI_TEST_DATABASE_URL="postgres://localhost:5432/wpi_test" pnpm --filter @wpi/audit-pipeline test
```

Expected: PASS. (Skip if no local Postgres — the in-memory suites cover the same interface; the Postgres suite runs in CI.)

- [ ] **Step 5: Append the M4-web section to README.md**

````markdown
## M4-web: free audit (apps/web)

### Prerequisites

- Node.js 20+, pnpm 9+
- PostgreSQL 13+ (only for `in_process` mode and the Postgres store tests; `WPI_DISPATCH_MODE=stub` needs no database)

### Setup

```bash
pnpm install
createdb wpi_dev
createdb wpi_test
pnpm --filter @wpi/audit-pipeline exec wpi-migrate
```
````

### Environment variables (apps/web)

| Variable                | Required                            | Purpose                                                                                                    |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `WPI_DISPATCH_MODE`     | no (default `in_process`)           | `stub` runs a deterministic no-network pipeline for local dev and E2E; `in_process` runs the real pipeline |
| `WPI_DATABASE_URL`      | yes unless `WPI_DISPATCH_MODE=stub` | Postgres connection string for the audit store                                                             |
| `AUDIT_COOKIE_SECRET`   | yes unless `WPI_DISPATCH_MODE=stub` | HMAC secret for the signed eligibility cookie                                                              |
| `WPI_GEMINI_API_KEY`    | no                                  | Enables the agent stage; without it agent sections render as `unavailable` with a reason                   |
| `WPI_OUTPUT_DIR`        | no (default `./output`)             | Crawler/evidence output directory                                                                          |
| `WPI_TEST_DATABASE_URL` | no                                  | Enables the `PostgresAuditStore` test suite                                                                |

### Tests

```bash
pnpm --filter @wpi/web exec playwright install chromium   # once
pnpm -r --no-bail test                                    # unit + route tests
pnpm --filter @wpi/web exec playwright test               # E2E (runs in stub mode)
```

````

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(readme): M4-web setup, env vars, and test commands"
````
