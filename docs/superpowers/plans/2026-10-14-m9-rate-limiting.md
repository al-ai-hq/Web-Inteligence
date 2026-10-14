# M9 Rate Limiting + Abuse Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `@wpi/rate-limiter` package that enforces per-IP anonymous audit limits, per-user signed-in quotas, and Cloudflare Turnstile challenges for suspicious IPs, then wire it into `POST /api/audits` and the landing-page audit form.

**Architecture:** A new `@wpi/rate-limiter` package exposes a `RateLimiter` port backed by an in-memory token bucket and a suspicious-IP failure tracker. `apps/web/src/app/api/audits/route.ts` calls the limiter before creating an audit, returns `X-RateLimit-*` headers on every response, and demands a Turnstile token when the IP is suspicious. The audit form conditionally renders a Turnstile widget when the server tells it to.

**Tech Stack:** TypeScript 5.6, Node.js 22, pnpm 9.12.0 workspaces, Vitest, Next.js 15 App Router, next-intl, Tailwind v4, Cloudflare Turnstile (implicit widget + server verify over HTTPS `fetch`).

**Spec:** docs/superpowers/specs/2026-10-14-m9-rate-limiting-design.md

**Cross-plan coordination:** `apps/web/src/services/container.ts` is touched by all three M9 plans. Implement this plan's Tasks 1-4 first to create the `@wpi/rate-limiter` package, then Task 5 to migrate the container off the legacy `@wpi/auth` `RateLimiter`. Production runtime Task 1 and email Task 8 will layer their changes on top of the same file.

## Global Constraints

- Anonymous limit: 5 audits per hour per IP (token bucket capacity 5, refill 5 per hour).
- Signed-in quota: 50 audits per calendar month per user, project-scoped per D-014 (pilot uses the user’s own ID as the project ID until a project model is added).
- Suspicious detection: 3 failed audit submissions in 10 minutes per IP marks the IP suspicious for 1 hour; while suspicious every submission needs a valid Turnstile token.
- Storage backend: in-memory; acceptable for pilot, resets on process restart.
- IP extraction: use the first IP in `X-Forwarded-For` via the existing `apps/web/src/services/client-ip.ts` helper.
- Rate-limit responses are intentionally generic about whether the limit is IP-based or user-based.
- Turnstile tokens are single-use, verified server-side, and never logged.
- No secrets committed to the repository; `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` live in fly secrets or gitignored `.env*.local` files.
- Strict TypeScript with `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- ESM only; package scripts and Node entrypoints use explicit `.js` extensions.
- Follow existing package layout, tsconfig, Vitest, zod, i18n, and API route conventions.
- Do not deploy, provision, or spend on production infrastructure without explicit human authorization.

---

### Task 1: Scaffold the `@wpi/rate-limiter` package and shared types

**Files:**
- Create: `packages/rate-limiter/package.json`
- Create: `packages/rate-limiter/tsconfig.json`
- Create: `packages/rate-limiter/vitest.config.ts`
- Create: `packages/rate-limiter/src/index.ts`
- Create: `packages/rate-limiter/src/types.ts`
- Modify: `tsconfig.json` (root project references)

**Interfaces:**
- Consumes: none
- Produces: `@wpi/rate-limiter` package exporting `RateLimitResult`, `RateLimiter`, `TokenBucket`, `InMemoryRateLimiter`, `verifyTurnstileToken`

- [ ] **Step 1: Write the failing test**
  Create `packages/rate-limiter/tests/types.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import {
    InMemoryRateLimiter,
    TokenBucket,
    verifyTurnstileToken,
    type RateLimitResult,
  } from "../src/index.js";

  describe("@wpi/rate-limiter public API", () => {
    it("exports InMemoryRateLimiter", () => {
      const limiter = new InMemoryRateLimiter();
      expect(limiter).toBeDefined();
    });

    it("exports TokenBucket", () => {
      const bucket = new TokenBucket({ capacity: 5, refillRateMs: 60 * 60 * 1000 });
      expect(bucket.consume(1)).toBe(true);
    });

    it("exports verifyTurnstileToken", () => {
      expect(typeof verifyTurnstileToken).toBe("function");
    });

    it("RateLimitResult has the expected shape", () => {
      const result: RateLimitResult = {
        allowed: true,
        limit: 5,
        remaining: 3,
        resetAt: new Date(),
      };
      expect(result.remaining).toBe(3);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/rate-limiter test
  ```
  Expected: FAIL — `packages/rate-limiter/src/index.ts` does not exist, so Vitest cannot resolve imports.

- [ ] **Step 3: Write minimal implementation**
  1. Create `packages/rate-limiter/package.json`:
     ```json
     {
       "name": "@wpi/rate-limiter",
       "version": "0.1.0",
       "private": true,
       "type": "module",
       "main": "./dist/index.js",
       "types": "./dist/index.d.ts",
       "exports": {
         ".": {
           "types": "./dist/index.d.ts",
           "default": "./dist/index.js"
         }
       },
       "scripts": {
         "build": "tsc",
         "test": "vitest run",
         "typecheck": "tsc --noEmit"
       },
       "devDependencies": {
         "@types/node": "^22.0.0",
         "typescript": "^5.6.0",
         "vitest": "^2.1.0"
       },
       "engines": {
         "node": ">=22"
       }
     }
     ```
  2. Create `packages/rate-limiter/tsconfig.json`:
     ```json
     {
       "extends": "../../tsconfig.base.json",
       "compilerOptions": {
         "outDir": "./dist",
         "rootDir": "./src",
         "types": ["node"]
       },
       "include": ["src/**/*"],
       "exclude": ["node_modules", "dist", "tests"]
     }
     ```
  3. Create `packages/rate-limiter/vitest.config.ts`:
     ```ts
     import { defineConfig } from "vitest/config";

     export default defineConfig({
       test: {
         globals: false,
         environment: "node",
         include: ["tests/**/*.test.ts"],
       },
     });
     ```
  4. Create `packages/rate-limiter/src/types.ts`:
     ```ts
     export interface RateLimitResult {
       allowed: boolean;
       limit: number;
       remaining: number;
       resetAt: Date;
     }

     export interface RateLimiter {
       checkAnonymous(ip: string, now?: Date): Promise<RateLimitResult>;
       checkUser(userId: string, projectId: string, now?: Date): Promise<RateLimitResult>;
       recordFailure(ip: string, now?: Date): Promise<void>;
       isSuspicious(ip: string, now?: Date): Promise<boolean>;
     }
     ```
  5. Create `packages/rate-limiter/src/index.ts`:
     ```ts
     export type { RateLimitResult, RateLimiter } from "./types.js";
     export { TokenBucket } from "./token-bucket.js";
     export { InMemoryRateLimiter } from "./in-memory-rate-limiter.js";
     export { verifyTurnstileToken } from "./turnstile-client.js";
     ```
  6. Add the package to root project references in `tsconfig.json`:
     ```json
     { "path": "packages/rate-limiter" }
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @wpi/rate-limiter test
  ```
  Expected: PASS — the public API tests resolve and pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/rate-limiter tsconfig.json pnpm-lock.yaml
  git commit -m "Scaffold @wpi/rate-limiter package and shared types"
  ```

---

### Task 2: Implement the token bucket

**Files:**
- Create: `packages/rate-limiter/src/token-bucket.ts`
- Create: `packages/rate-limiter/tests/token-bucket.test.ts`

**Interfaces:**
- Consumes: `{ capacity: number; refillRateMs: number }`
- Produces: `TokenBucket` with `consume(amount, now?)`, `state(now?)`

- [ ] **Step 1: Write the failing test**
  Create `packages/rate-limiter/tests/token-bucket.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { TokenBucket } from "../src/token-bucket.js";

  const HOUR_MS = 60 * 60 * 1000;

  describe("TokenBucket", () => {
    it("allows requests while tokens remain", () => {
      const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
      expect(bucket.consume(1, new Date(0))).toBe(true);
      expect(bucket.consume(1, new Date(0))).toBe(true);
      expect(bucket.consume(3, new Date(0))).toBe(true);
      expect(bucket.consume(1, new Date(0))).toBe(false);
    });

    it("refills tokens after the refill interval", () => {
      const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
      expect(bucket.consume(5, new Date(0))).toBe(true);
      expect(bucket.consume(1, new Date(HOUR_MS))).toBe(true);
    });

    it("reports remaining and reset time", () => {
      const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
      bucket.consume(2, new Date(0));
      const state = bucket.state(new Date(0));
      expect(state.remaining).toBe(3);
      expect(state.resetAt.getTime()).toBe(HOUR_MS);
    });

    it("does not accumulate beyond capacity", () => {
      const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
      bucket.consume(5, new Date(0));
      expect(bucket.consume(1, new Date(3 * HOUR_MS))).toBe(true);
      expect(bucket.consume(5, new Date(3 * HOUR_MS))).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/rate-limiter test tests/token-bucket.test.ts
  ```
  Expected: FAIL — `TokenBucket` is not defined.

- [ ] **Step 3: Write minimal implementation**
  Create `packages/rate-limiter/src/token-bucket.ts`:
  ```ts
  export interface TokenBucketState {
    remaining: number;
    resetAt: Date;
  }

  export interface TokenBucketOptions {
    capacity: number;
    refillRateMs: number;
  }

  export class TokenBucket {
    private readonly capacity: number;
    private readonly refillRateMs: number;
    private tokens: number;
    private lastRefillAt: number;

    constructor(options: TokenBucketOptions) {
      this.capacity = options.capacity;
      this.refillRateMs = options.refillRateMs;
      this.tokens = options.capacity;
      this.lastRefillAt = 0;
    }

    private refill(nowMs: number): void {
      if (nowMs < this.lastRefillAt) {
        return;
      }
      const elapsed = nowMs - this.lastRefillAt;
      const refills = Math.floor(elapsed / this.refillRateMs);
      if (refills > 0) {
        this.tokens = Math.min(this.capacity, this.tokens + refills * this.capacity);
        this.lastRefillAt += refills * this.refillRateMs;
      }
    }

    consume(amount: number, now: Date = new Date()): boolean {
      const nowMs = now.getTime();
      this.refill(nowMs);
      if (this.tokens < amount) {
        return false;
      }
      this.tokens -= amount;
      return true;
    }

    state(now: Date = new Date()): TokenBucketState {
      const nowMs = now.getTime();
      this.refill(nowMs);
      let resetAtMs = this.lastRefillAt + this.refillRateMs;
      if (resetAtMs <= nowMs) {
        resetAtMs = nowMs + this.refillRateMs;
      }
      return {
        remaining: Math.max(0, this.tokens),
        resetAt: new Date(resetAtMs),
      };
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/rate-limiter test tests/token-bucket.test.ts
  ```
  Expected: PASS — token bucket tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/rate-limiter
  git commit -m "Implement token bucket for rate limiting"
  ```

---

### Task 3: Implement the in-memory rate limiter

**Files:**
- Create: `packages/rate-limiter/src/in-memory-rate-limiter.ts`
- Create: `packages/rate-limiter/tests/in-memory-rate-limiter.test.ts`

**Interfaces:**
- Consumes: `TokenBucket`, `RateLimiter` port, constants from spec
- Produces: `InMemoryRateLimiter` implementing `RateLimiter`

- [ ] **Step 1: Write the failing test**
  Create `packages/rate-limiter/tests/in-memory-rate-limiter.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { InMemoryRateLimiter } from "../src/in-memory-rate-limiter.js";

  const HOUR_MS = 60 * 60 * 1000;
  const MINUTE_MS = 60 * 1000;

  describe("InMemoryRateLimiter", () => {
    it("allows 5 anonymous requests then blocks the 6th in the same hour", async () => {
      const limiter = new InMemoryRateLimiter();
      const ip = "1.2.3.4";
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkAnonymous(ip, new Date(0));
        expect(result.allowed).toBe(true);
      }
      const blocked = await limiter.checkAnonymous(ip, new Date(0));
      expect(blocked.allowed).toBe(false);
      expect(blocked.limit).toBe(5);
      expect(blocked.remaining).toBe(0);
    });

    it("refills the anonymous bucket after one hour", async () => {
      const limiter = new InMemoryRateLimiter();
      const ip = "1.2.3.4";
      for (let i = 0; i < 5; i++) {
        await limiter.checkAnonymous(ip, new Date(0));
      }
      const result = await limiter.checkAnonymous(ip, new Date(HOUR_MS));
      expect(result.allowed).toBe(true);
    });

    it("tracks different IPs independently", async () => {
      const limiter = new InMemoryRateLimiter();
      await limiter.checkAnonymous("1.2.3.4", new Date(0));
      const other = await limiter.checkAnonymous("5.6.7.8", new Date(0));
      expect(other.remaining).toBe(4);
    });

    it("allows 50 signed-in requests per calendar month", async () => {
      const limiter = new InMemoryRateLimiter();
      const userId = "user-1";
      const projectId = "project-1";
      for (let i = 0; i < 50; i++) {
        const result = await limiter.checkUser(userId, projectId, new Date("2026-10-01T00:00:00Z"));
        expect(result.allowed).toBe(true);
      }
      const blocked = await limiter.checkUser(userId, projectId, new Date("2026-10-15T00:00:00Z"));
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("resets the user quota at the start of a new month", async () => {
      const limiter = new InMemoryRateLimiter();
      const userId = "user-1";
      const projectId = "project-1";
      for (let i = 0; i < 50; i++) {
        await limiter.checkUser(userId, projectId, new Date("2026-10-31T23:59:00Z"));
      }
      const nextMonth = await limiter.checkUser(userId, projectId, new Date("2026-11-01T00:00:01Z"));
      expect(nextMonth.allowed).toBe(true);
      expect(nextMonth.remaining).toBe(49);
    });

    it("marks an IP suspicious after 3 failures", async () => {
      const limiter = new InMemoryRateLimiter();
      const ip = "1.2.3.4";
      expect(await limiter.isSuspicious(ip, new Date(0))).toBe(false);
      await limiter.recordFailure(ip, new Date(0));
      await limiter.recordFailure(ip, new Date(0));
      await limiter.recordFailure(ip, new Date(0));
      expect(await limiter.isSuspicious(ip, new Date(0))).toBe(true);
    });

    it("keeps an IP suspicious for one hour", async () => {
      const limiter = new InMemoryRateLimiter();
      const ip = "1.2.3.4";
      await limiter.recordFailure(ip, new Date(0));
      await limiter.recordFailure(ip, new Date(0));
      await limiter.recordFailure(ip, new Date(0));
      expect(await limiter.isSuspicious(ip, new Date(59 * MINUTE_MS))).toBe(true);
      expect(await limiter.isSuspicious(ip, new Date(61 * MINUTE_MS))).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/rate-limiter test tests/in-memory-rate-limiter.test.ts
  ```
  Expected: FAIL — `InMemoryRateLimiter` is not defined.

- [ ] **Step 3: Write minimal implementation**
  Create `packages/rate-limiter/src/in-memory-rate-limiter.ts`:
  ```ts
  import { TokenBucket } from "./token-bucket.js";
  import type { RateLimitResult, RateLimiter } from "./types.js";

  export const ANONYMOUS_CAPACITY = 5;
  export const ANONYMOUS_REFILL_MS = 60 * 60 * 1000;
  export const USER_CAPACITY = 50;
  export const SUSPICIOUS_THRESHOLD = 3;
  export const SUSPICIOUS_WINDOW_MS = 10 * 60 * 1000;
  export const SUSPICIOUS_DURATION_MS = 60 * 60 * 1000;

  interface FailureWindow {
    failures: number;
    windowStart: number;
  }

  export class InMemoryRateLimiter implements RateLimiter {
    private readonly anonymous = new Map<string, TokenBucket>();
    private readonly users = new Map<string, TokenBucket>();
    private readonly failures = new Map<string, FailureWindow>();
    private readonly suspiciousUntil = new Map<string, number>();

    async checkAnonymous(ip: string, now: Date = new Date()): Promise<RateLimitResult> {
      let bucket = this.anonymous.get(ip);
      if (!bucket) {
        bucket = new TokenBucket({ capacity: ANONYMOUS_CAPACITY, refillRateMs: ANONYMOUS_REFILL_MS });
        this.anonymous.set(ip, bucket);
      }
      const allowed = bucket.consume(1, now);
      const state = bucket.state(now);
      return {
        allowed,
        limit: ANONYMOUS_CAPACITY,
        remaining: allowed ? state.remaining : state.remaining,
        resetAt: state.resetAt,
      };
    }

    async checkUser(
      userId: string,
      projectId: string,
      now: Date = new Date(),
    ): Promise<RateLimitResult> {
      const key = `user:${userId}:project:${projectId}`;
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const keyWithMonth = `${key}:month:${monthStart.toISOString()}`;

      let bucket = this.users.get(keyWithMonth);
      if (!bucket) {
        bucket = new TokenBucket({
          capacity: USER_CAPACITY,
          refillRateMs: Number.POSITIVE_INFINITY,
        });
        bucket.consume(0, monthStart);
        this.users.set(keyWithMonth, bucket);
      }

      const allowed = bucket.consume(1, now);
      const state = bucket.state(now);
      return {
        allowed,
        limit: USER_CAPACITY,
        remaining: state.remaining,
        resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
      };
    }

    async recordFailure(ip: string, now: Date = new Date()): Promise<void> {
      const nowMs = now.getTime();
      const current = this.failures.get(ip);
      if (!current || nowMs - current.windowStart >= SUSPICIOUS_WINDOW_MS) {
        this.failures.set(ip, { failures: 1, windowStart: nowMs });
        return;
      }
      current.failures += 1;
      if (current.failures >= SUSPICIOUS_THRESHOLD) {
        this.suspiciousUntil.set(ip, nowMs + SUSPICIOUS_DURATION_MS);
      }
    }

    async isSuspicious(ip: string, now: Date = new Date()): Promise<boolean> {
      const until = this.suspiciousUntil.get(ip);
      if (!until) {
        return false;
      }
      if (now.getTime() >= until) {
        this.suspiciousUntil.delete(ip);
        return false;
      }
      return true;
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/rate-limiter test tests/in-memory-rate-limiter.test.ts
  ```
  Expected: PASS — in-memory limiter tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/rate-limiter
  git commit -m "Implement in-memory rate limiter with token bucket and suspicious-IP tracker"
  ```

---

### Task 4: Implement the Turnstile client

**Files:**
- Create: `packages/rate-limiter/src/turnstile-client.ts`
- Create: `packages/rate-limiter/tests/turnstile-client.test.ts`

**Interfaces:**
- Consumes: `TURNSTILE_SECRET_KEY`, `turnstileToken`, optional `ip`
- Produces: `verifyTurnstileToken(token, ip)` returning `Promise<boolean>`

- [ ] **Step 1: Write the failing test**
  Create `packages/rate-limiter/tests/turnstile-client.test.ts`:
  ```ts
  import { describe, expect, it, vi, afterEach } from "vitest";
  import { verifyTurnstileToken } from "../src/turnstile-client.js";

  describe("verifyTurnstileToken", () => {
    afterEach(() => {
      delete process.env["TURNSTILE_SECRET_KEY"];
      vi.restoreAllMocks();
    });

    it("returns true when Cloudflare reports success", async () => {
      process.env["TURNSTILE_SECRET_KEY"] = "secret";
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const ok = await verifyTurnstileToken("token", "1.2.3.4");
      expect(ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "secret", response: "token", remoteip: "1.2.3.4" }),
        }),
      );
    });

    it("returns false when Cloudflare reports failure", async () => {
      process.env["TURNSTILE_SECRET_KEY"] = "secret";
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const ok = await verifyTurnstileToken("token");
      expect(ok).toBe(false);
    });

    it("returns false when the request throws", async () => {
      process.env["TURNSTILE_SECRET_KEY"] = "secret";
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;

      const ok = await verifyTurnstileToken("token");
      expect(ok).toBe(false);
    });

    it("returns false when TURNSTILE_SECRET_KEY is missing", async () => {
      delete process.env["TURNSTILE_SECRET_KEY"];
      const ok = await verifyTurnstileToken("token");
      expect(ok).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/rate-limiter test tests/turnstile-client.test.ts
  ```
  Expected: FAIL — `verifyTurnstileToken` is not defined.

- [ ] **Step 3: Write minimal implementation**
  Create `packages/rate-limiter/src/turnstile-client.ts`:
  ```ts
  export async function verifyTurnstileToken(
    token: string,
    ip?: string,
  ): Promise<boolean> {
    const secret = process.env["TURNSTILE_SECRET_KEY"];
    if (!secret) {
      return false;
    }

    const body: Record<string, string> = { secret, response: token };
    if (ip) {
      body.remoteip = ip;
    }

    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        return false;
      }
      const data = (await response.json()) as { success?: boolean };
      return data.success === true;
    } catch {
      return false;
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/rate-limiter test tests/turnstile-client.test.ts
  ```
  Expected: PASS — Turnstile client tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/rate-limiter
  git commit -m "Add Cloudflare Turnstile verification client"
  ```

---

### Task 5: Replace the legacy auth rate limiter with `@wpi/rate-limiter`

**Files:**
- Modify: `apps/web/src/services/container.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/test/container.test.ts`
- Modify: `apps/web/src/test/api-audits-post.test.ts`
- Modify: `apps/web/src/test/auth-routes.test.ts`
- Delete: `packages/auth/src/rate-limit.ts`
- Delete: `packages/auth/tests/rate-limit.test.ts`
- Modify: `packages/auth/src/index.ts`

**Interfaces:**
- Consumes: `RateLimiter` from `@wpi/rate-limiter`
- Produces: `AuditServices.rateLimiter` typed to the new `@wpi/rate-limiter` interface

- [ ] **Step 1: Write the failing test**
  Update `apps/web/src/test/container.test.ts` to expect the new rate limiter:
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { InMemoryAuditStore } from "@wpi/audit-pipeline";
  import { InMemoryRateLimiter } from "@wpi/rate-limiter";
  import {
    getAuditServices,
    setAuditServicesForTests,
  } from "../services/container";

  const ENV_KEYS = [
    "WPI_DISPATCH_MODE",
    "AUDIT_COOKIE_SECRET",
    "WPI_DATABASE_URL",
  ] as const;

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
      expect(services.rateLimiter).toBeInstanceOf(InMemoryRateLimiter);
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

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/web test src/test/container.test.ts
  ```
  Expected: FAIL — container imports `RateLimiter` from `@wpi/auth` and the type does not match `InMemoryRateLimiter`.

- [ ] **Step 3: Write minimal implementation**
  1. Add `"@wpi/rate-limiter": "workspace:*"` to `apps/web/package.json` `dependencies`.
  2. In `apps/web/src/services/container.ts`:
     - Replace `import { InMemoryAuthService, PgAuthService, RateLimiter } from "@wpi/auth";` with:
       ```ts
       import { InMemoryAuthService, PgAuthService } from "@wpi/auth";
       import { InMemoryRateLimiter } from "@wpi/rate-limiter";
       ```
     - Replace `rateLimiter: RateLimiter;` in `AuditServices` with:
       ```ts
       rateLimiter: import("@wpi/rate-limiter").RateLimiter;
       ```
       Or add an import type line and use `RateLimiter` directly.
     - Replace every `rateLimiter: new RateLimiter()` in `buildServices` with `rateLimiter: new InMemoryRateLimiter()`.
  3. In test helpers (`apps/web/src/test/api-audits-post.test.ts` and `apps/web/src/test/auth-routes.test.ts`), replace `RateLimiter` import from `@wpi/auth` with `InMemoryRateLimiter` from `@wpi/rate-limiter` and update the helper objects.
  4. Delete `packages/auth/src/rate-limit.ts` and `packages/auth/tests/rate-limit.test.ts`.
  5. Remove `export * from "./rate-limit.js";` from `packages/auth/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @wpi/rate-limiter build
  pnpm --filter @wpi/web test src/test/container.test.ts
  ```
  Expected: PASS — container builds and exposes the new rate limiter.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web packages/auth packages/rate-limiter pnpm-lock.yaml
  git commit -m "Replace legacy auth rate limiter with @wpi/rate-limiter"
  ```

---

### Task 6: Add rate-limit and Turnstile checks to `POST /api/audits`

**Files:**
- Modify: `apps/web/src/app/api/audits/route.ts`
- Modify: `apps/web/src/app/api/audits/route.test.ts` (or create `apps/web/src/test/api-audits-rate-limit.test.ts`)
- Modify: `apps/web/src/app/[locale]/_components/create-audit-client.ts`

**Interfaces:**
- Consumes: `services.rateLimiter`, `getClientIp`, `verifyTurnstileToken`, request body `turnstileToken`
- Produces: `201` with `X-RateLimit-*` headers, `429` with `Retry-After` and bilingual message, `400` when Turnstile is required/fails

- [ ] **Step 1: Write the failing test**
  Create `apps/web/src/test/api-audits-rate-limit.test.ts`:
  ```ts
  import { describe, expect, it, afterEach, vi } from "vitest";
  import { NextRequest } from "next/server";
  import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
  import { InMemoryAuthService } from "@wpi/auth";
  import { InMemoryRateLimiter } from "@wpi/rate-limiter";
  import { POST } from "../app/api/audits/route";
  import { setAuditServicesForTests, type AuditServices } from "../services/container";

  function makeServices(): AuditServices {
    return {
      store: new InMemoryAuditStore(),
      dispatcher: { dispatch: async () => undefined },
      tierScopes: TIER_SCOPES,
      cookieSecret: "test-cookie-secret",
      auth: new InMemoryAuthService(),
      rateLimiter: new InMemoryRateLimiter(),
      validateUrl: async (url: string) =>
        url.startsWith("https://") ? { ok: true } : { ok: false, reason_key: "failure.url_invalid" },
      outputDir: "./output",
      geminiApiKey: undefined,
    };
  }

  function postAudit(body: unknown, headers?: Record<string, string>): NextRequest {
    return new NextRequest("http://localhost:3000/api/audits", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        ...(headers ?? {}),
      },
      body: JSON.stringify(body),
    });
  }

  afterEach(() => {
    setAuditServicesForTests(null);
    vi.restoreAllMocks();
  });

  describe("POST /api/audits rate limiting", () => {
    it("allows 5 anonymous audits and blocks the 6th with 429", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);
      const body = {
        url: "https://example.com",
        locale: "en",
        context: {
          organization: "Org",
          business_type: "b2b",
          offering: "Stuff",
          market: "JO",
          customer_language: "English",
          audience: "Managers",
        },
      };

      for (let i = 0; i < 5; i++) {
        const response = await POST(postAudit(body));
        expect(response.status).toBe(201);
        expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
      }

      const blocked = await POST(postAudit(body));
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);
    });

    it("records failures and requires turnstile after 3 invalid submissions", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);
      const body = {
        url: "not-a-url",
        locale: "en",
        context: {
          organization: "Org",
          business_type: "b2b",
          offering: "Stuff",
          market: "JO",
          customer_language: "English",
          audience: "Managers",
        },
      };

      for (let i = 0; i < 3; i++) {
        const response = await POST(postAudit(body));
        expect(response.status).toBe(400);
      }

      const required = await POST(postAudit(body));
      expect(required.status).toBe(400);
      const json = (await required.json()) as { error?: string };
      expect(json.error).toBe("turnstile_required");
    });

    it("rejects an invalid turnstile token", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      ) as unknown as typeof fetch;

      const invalidBody = {
        url: "not-a-url",
        locale: "en",
        context: {
          organization: "Org",
          business_type: "b2b",
          offering: "Stuff",
          market: "JO",
          customer_language: "English",
          audience: "Managers",
        },
      };

      for (let i = 0; i < 3; i++) {
        await POST(postAudit(invalidBody));
      }

      const response = await POST(
        postAudit({ ...invalidBody, turnstileToken: "bad" }),
      );
      expect(response.status).toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/web test src/test/api-audits-rate-limit.test.ts
  ```
  Expected: FAIL — the route does not read `turnstileToken` or call the new limiter methods.

- [ ] **Step 3: Write minimal implementation**
  1. Update `apps/web/src/app/api/audits/route.ts`:
     - Add imports:
       ```ts
       import { verifyTurnstileToken } from "@wpi/rate-limiter";
       import { getClientIp } from "../../../services/client-ip";
       ```
     - Add helper to attach rate-limit headers:
       ```ts
       function rateLimitHeaders(result: { limit: number; remaining: number; resetAt: Date }): Record<string, string> {
         return {
           "X-RateLimit-Limit": String(result.limit),
           "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
           "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
         };
       }
       ```
     - In `POST`, after reading the body and before creating the audit, add:
       ```ts
       const services = await getAuditServices();
       const ip = getClientIp(request);

       const suspicious = await services.rateLimiter.isSuspicious(ip);
       if (suspicious) {
         const token = (body as { turnstileToken?: string }).turnstileToken;
         if (!token || !(await verifyTurnstileToken(token, ip))) {
           const result = await services.rateLimiter.checkAnonymous(ip);
           return NextResponse.json(
             { error: "turnstile_required" },
             {
               status: 400,
               headers: rateLimitHeaders(result),
             },
           );
         }
       }

       const user = cookieValue
         ? await services.auth.getSessionUser(hashToken(cookieValue))
         : null;

       const rateLimitResult = user
         ? await services.rateLimiter.checkUser(user.id, user.id)
         : await services.rateLimiter.checkAnonymous(ip);

       if (!rateLimitResult.allowed) {
         const retryAfter = Math.max(
           0,
           Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000),
         );
         return NextResponse.json(
           { error: "rate_limited" },
           {
             status: 429,
             headers: {
               ...rateLimitHeaders(rateLimitResult),
               "Retry-After": String(retryAfter),
             },
           },
         );
       }

       // proceed with validation; on failure call recordFailure
       const urlCheck = await services.validateUrl(parsed.data.url);
       if (!urlCheck.ok) {
         await services.rateLimiter.recordFailure(ip);
         return NextResponse.json(
           { error: "url_invalid" },
           { status: 400, headers: rateLimitHeaders(rateLimitResult) },
         );
       }
       ```
     - Wrap the existing `urlCheck` block so failures call `recordFailure`.
     - Add `headers: rateLimitHeaders(rateLimitResult)` to the final `201` response.
  2. Update `apps/web/src/app/[locale]/_components/create-audit-client.ts`:
     - Add `turnstileToken?: string` to `CreateAuditPayload`.
     - Include it in the JSON body in `submitAudit`.
     - Add `"turnstile_required"` to `CreateAuditError` and `mapCreateAuditError`.

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/web test src/test/api-audits-rate-limit.test.ts
  ```
  Expected: PASS — rate-limit and Turnstile tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web
  git commit -m "Add rate-limit and Turnstile checks to POST /api/audits"
  ```

---

### Task 7: Add the Turnstile widget to the audit form

**Files:**
- Modify: `apps/web/src/app/[locale]/_components/audit-form.tsx`
- Modify: `apps/web/src/app/[locale]/_components/create-audit-client.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/ar.json`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `submitAudit` result, i18n `rateLimit` keys
- Produces: audit form that renders Turnstile when required and resubmits with a token

- [ ] **Step 1: Write the failing test**
  Run the web typecheck:
  ```bash
  pnpm --filter @wpi/web typecheck
  ```
  Expected: FAIL — the form references a `Turnstile` component and `turnstileToken` state that do not exist yet.

- [ ] **Step 2: Run test to verify it fails**
  (Same command; confirm TypeScript errors reference the missing pieces.)

- [ ] **Step 3: Write minimal implementation**
  1. Install the lightweight React wrapper:
     ```bash
     pnpm --filter @wpi/web add @marsidev/react-turnstile
     ```
  2. Add i18n keys under a new `rateLimit` object in both message files:
     - `apps/web/src/messages/en.json`:
       ```json
       "rateLimit": {
         "anonymous": "Too many audits from this network. Please try again in {{minutes}} minutes.",
         "userQuota": "You have reached your monthly audit limit ({{limit}}).",
         "turnstileRequired": "Please complete the security check to continue.",
         "turnstileFailed": "Security check failed. Please try again."
       }
       ```
     - `apps/web/src/messages/ar.json`:
       ```json
       "rateLimit": {
         "anonymous": "عدد كبير من التدقيقات من هذا الشبكة. يرجى المحاولة مرة أخرى بعد {{minutes}} دقيقة.",
         "userQuota": "لقد وصلت إلى الحد الأقصى للتدقيقات الشهرية ({{limit}}).",
         "turnstileRequired": "يرجى إكمال التحقق الأمني للمتابعة.",
         "turnstileFailed": "فشل التحقق الأمني. يرجى المحاولة مرة أخرى."
       }
       ```
  3. Update `apps/web/src/app/[locale]/_components/create-audit-client.ts`:
     - Add `turnstileToken?: string` to `CreateAuditPayload`.
     - Add `"turnstile_required"` to `CreateAuditError`.
     - In `submitAudit`, include `turnstileToken` in the body.
     - In `mapCreateAuditError`, map `body.error === "turnstile_required"` to `"turnstile_required"`.
  4. Update `apps/web/src/app/[locale]/_components/audit-form.tsx`:
     - Import `Turnstile`:
       ```tsx
       import { Turnstile } from "@marsidev/react-turnstile";
       ```
     - Add state:
       ```tsx
       const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
       const [turnstileRequired, setTurnstileRequired] = useState(false);
       ```
     - Pass `turnstileToken ?? undefined` to `submitAudit`.
     - After a `turnstile_required` error, set `turnstileRequired: true` and `setSubmitting(false)`.
     - Render the widget before the submit button when `turnstileRequired`:
       ```tsx
       {turnstileRequired ? (
         <div className="flex justify-center">
           <Turnstile
             siteKey={process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? ""}
             onSuccess={(token) => setTurnstileToken(token)}
           />
         </div>
       ) : null}
       ```
     - Disable the submit button until a token is available when Turnstile is required.

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/web typecheck
  pnpm --filter @wpi/web test src/app/\[locale\]/_components/create-audit-client.test.ts
  ```
  Expected: PASS — TypeScript compiles and the existing client tests still pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web
  git commit -m "Add Turnstile widget to audit form"
  ```

---

### Task 8: Add integration tests and run full verification

**Files:**
- Create: `apps/web/src/test/api-audits-rate-limit-integration.test.ts` (optional, if not already covered)
- Modify: `apps/web/src/test/api-audits-post.test.ts` (ensure rate limiter property uses new type)
- Modify: `apps/web/.env.local`

**Interfaces:**
- Consumes: `@wpi/rate-limiter`, `POST /api/audits`
- Produces: verified rate-limit and Turnstile behavior

- [ ] **Step 1: Write the failing test**
  Run the full verification suite:
  ```bash
  pnpm typecheck
  pnpm test
  pnpm lint
  pnpm format:check
  ```
  Expected: FAIL if any existing tests still reference the deleted `@wpi/auth` `RateLimiter` or if formatting is off.

- [ ] **Step 2: Run test to verify it fails**
  (Same command; note failures.)

- [ ] **Step 3: Write minimal implementation**
  1. Update any remaining test helpers that import `RateLimiter` from `@wpi/auth` to use `InMemoryRateLimiter` from `@wpi/rate-limiter`.
  2. Add placeholders to `apps/web/.env.local`:
     ```bash
     NEXT_PUBLIC_TURNSTILE_SITE_KEY=
     TURNSTILE_SECRET_KEY=
     ```
  3. Run `pnpm format` if needed.

- [ ] **Step 4: Run test to verify it passes**
  Run the full verification suite again:
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @wpi/rate-limiter build
  pnpm typecheck
  pnpm test
  pnpm lint
  pnpm format:check
  ```
  Expected: all commands pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web packages/rate-limiter packages/auth pnpm-lock.yaml
  git commit -m "Rate limiting integration tests and verification"
  ```

---

## Self-review checklist

Before marking the milestone complete, verify:

- **Spec coverage:**
  - [ ] `@wpi/rate-limiter` package exists with `RateLimiter` port, `TokenBucket`, `InMemoryRateLimiter`, and `verifyTurnstileToken`.
  - [ ] Anonymous audits are limited to 5 per hour per IP.
  - [ ] Signed-in users are limited to 50 audits per calendar month (key includes user + project ID).
  - [ ] Suspicious detection triggers after 3 failed submissions in 10 minutes per IP and lasts 1 hour.
  - [ ] `POST /api/audits` returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` on every response.
  - [ ] `429` responses include a `Retry-After` header.
  - [ ] Turnstile token is required and server-verified while the IP is suspicious.
  - [ ] Bilingual `rateLimit` i18n keys exist in `en.json` and `ar.json`.

- **Placeholder scan:**
  - [ ] No `TBD`, `TODO`, `implement later`, or `write tests for the above` remain.
  - [ ] No real Turnstile secrets committed (`.env.local` placeholders are empty).

- **Type consistency:**
  - [ ] All new code uses strict TypeScript, `import type` for type-only imports, and `.js` extensions.
  - [ ] `AuditServices.rateLimiter` is typed to the new `@wpi/rate-limiter` interface everywhere.
  - [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm format:check` pass.

### Critical Files for Implementation

- `packages/rate-limiter/src/token-bucket.ts`
- `packages/rate-limiter/src/in-memory-rate-limiter.ts`
- `packages/rate-limiter/src/turnstile-client.ts`
- `apps/web/src/services/container.ts`
- `apps/web/src/app/api/audits/route.ts`
- `apps/web/src/app/[locale]/_components/audit-form.tsx`
- `apps/web/src/app/[locale]/_components/create-audit-client.ts`
