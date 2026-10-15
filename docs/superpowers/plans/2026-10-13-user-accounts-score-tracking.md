# User Accounts and Score Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password accounts, persistent audit ownership, a score-trend dashboard, and a re-audit reminder — without disturbing the anonymous flow.

**Architecture:** One new package (`@wpi/auth`) handles password hashing (scrypt), session tokens (SHA-256-hashed), rate limiting, and zod schemas. Two new migrations (0016, 0017) add `users`, `sessions`, and a nullable `user_id` on `audits` (with `expires_at` now nullable). The web app gains `/login`, `/signup`, `/dashboard` routes, session-aware audit creation, and owned-access guards alongside the existing secret-link path.

**Tech Stack:** Node 22+, `crypto.scrypt`/`timingSafeEqual` (built-in), zod ^3.23.8, pg ^8.23.1, Next.js 15, next-intl, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-user-accounts-score-tracking-design.md`

## Global Constraints

- Node >= 22; pnpm workspace; strict TypeScript (`tsconfig.base.json`).
- Zero new runtime dependencies except `zod ^3.23.8` and `pg ^8.23.1` for `@wpi/auth`.
- scrypt: N=16384, r=8, p=1, 16-byte salt, 64-byte key, stored as `salt$hash` hex.
- Session tokens: 32 random bytes hex (64 chars); stored as SHA-256 hex; raw token only in cookie.
- Cookie: `wpi_session`, httpOnly, sameSite=lax, path=/, maxAge=2,592,000s (30 days), secure only when `NODE_ENV === "production"`.
- Sliding renewal: if `now - last_seen_at > 7 days`, extend `expires_at` to `now + 30 days` and update `last_seen_at`.
- Anonymous audits unchanged: 7-day expiry, secret link, eligibility cookie.
- Clean break: anonymous audits stay anonymous; no claim/migration flow.
- Owned audits: `user_id` set, `expires_at = NULL` (never expire).
- Exports denied for everyone (D-022); owned-access applies to report/status pages only.
- Bilingual UI (en/ar) with parity enforced by existing test.
- TDD: every production function has a failing test first. Commit per task.
- ESM `.js` relative imports in packages; extensionless imports in `apps/web`.
- Rate limiting: 10 failures per 15-minute window, per IP + per email, counters reset on success.
- Unknown-email verify burns scrypt time (constant-time defense).

---

### Task 1: `@wpi/auth` scaffold — password hashing and session cookie constants

**Files:**

- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/password.ts`
- Create: `packages/auth/src/session-cookie.ts`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/tests/password.test.ts`
- Create: `packages/auth/tests/session-cookie.test.ts`
- Modify: `pnpm-workspace.yaml` (add `packages/auth` if not already covered by glob)

**Interfaces:**

- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, stored: string): Promise<boolean>`, `SCRYPT_N`, `SCRYPT_R`, `SCRYPT_P`, `SALT_BYTES`, `KEY_BYTES`
- Produces: `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS`, `sessionCookieOptions(): ResponseCookie`
- Consumed by: Task 3 (auth service), Task 6 (container), Task 8 (routes), Task 9 (auth API), Task 11 (dashboard/layout)

- [ ] **Step 1: Verify pnpm-workspace.yaml covers packages/auth**

Run: `grep 'packages/' pnpm-workspace.yaml`
Expected: A glob like `packages/*` that already covers `packages/auth`. If it says `packages/*`, no change needed.

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@wpi/auth",
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
  "dependencies": {
    "zod": "^3.23.8",
    "pg": "^8.23.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.23.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=22"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write failing tests for password.ts**

Create `packages/auth/tests/password.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  SALT_BYTES,
  KEY_BYTES,
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
} from "../src/password.js";

describe("hashPassword", () => {
  it("returns salt$hash with correct hex lengths", async () => {
    const result = await hashPassword("test-password");
    const parts = result.split("$");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(SALT_BYTES * 2);
    expect(parts[1]).toHaveLength(KEY_BYTES * 2);
  });

  it("produces unique salts for each call", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for the wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it.each(["", "no-separator", "$deadbeef", "zz$deadbeef"])(
    "returns false for malformed stored value: %s",
    async (malformed) => {
      expect(await verifyPassword("anything", malformed)).toBe(false);
    },
  );
});

describe("constants", () => {
  it("exports scrypt parameters", () => {
    expect(SCRYPT_N).toBe(16384);
    expect(SCRYPT_R).toBe(8);
    expect(SCRYPT_P).toBe(1);
    expect(SALT_BYTES).toBe(16);
    expect(KEY_BYTES).toBe(64);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run tests/password.test.ts`
Expected: FAIL — `Cannot find module '../src/password.js'`

- [ ] **Step 6: Implement password.ts**

Create `packages/auth/src/password.ts`:

```typescript
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export const SCRYPT_N = 16384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SALT_BYTES = 16;
export const KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const separator = stored.indexOf("$");
  if (separator === -1) {
    return false;
  }
  const saltHex = stored.slice(0, separator);
  const expectedHex = stored.slice(separator + 1);
  if (saltHex.length === 0 || expectedHex.length === 0) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const actual = await scrypt(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return timingSafeEqual(actual, expected);
}
```

- [ ] **Step 7: Run password tests to verify they pass**

Run: `cd packages/auth && npx vitest run tests/password.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 8: Write failing tests for session-cookie.ts**

Create `packages/auth/tests/session-cookie.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "../src/session-cookie.js";

describe("session cookie constants", () => {
  it("exports the cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("wpi_session");
  });

  it("exports 30-day max age in seconds", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});

describe("sessionCookieOptions", () => {
  afterEach(() => {
    delete process.env["NODE_ENV"];
  });

  it("returns the correct shape", () => {
    const opts = sessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("sets secure=true when NODE_ENV is production", () => {
    process.env["NODE_ENV"] = "production";
    expect(sessionCookieOptions().secure).toBe(true);
  });

  it("sets secure=false when NODE_ENV is not production", () => {
    process.env["NODE_ENV"] = "development";
    expect(sessionCookieOptions().secure).toBe(false);
  });
});
```

- [ ] **Step 9: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run tests/session-cookie.test.ts`
Expected: FAIL — `Cannot find module '../src/session-cookie.js'`

- [ ] **Step 10: Implement session-cookie.ts**

Create `packages/auth/src/session-cookie.ts`:

```typescript
export const SESSION_COOKIE_NAME = "wpi_session";
export const SESSION_MAX_AGE_SECONDS = 2_592_000;

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env["NODE_ENV"] === "production",
  };
}
```

- [ ] **Step 11: Run session-cookie tests to verify they pass**

Run: `cd packages/auth && npx vitest run tests/session-cookie.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 12: Create index.ts barrel**

Create `packages/auth/src/index.ts`:

```typescript
export * from "./password.js";
export * from "./session-cookie.js";
```

- [ ] **Step 13: Build and run all @wpi/auth tests**

Run: `cd packages/auth && pnpm build && pnpm test`
Expected: Build exit 0, 12 tests pass

- [ ] **Step 14: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): scaffold @wpi/auth with password hashing and session cookie constants"
```

---

### Task 2: Zod schemas and rate limiter

**Files:**

- Create: `packages/auth/src/schemas.ts`
- Create: `packages/auth/src/rate-limit.ts`
- Modify: `packages/auth/src/index.ts`
- Create: `packages/auth/tests/schemas.test.ts`
- Create: `packages/auth/tests/rate-limit.test.ts`

**Interfaces:**

- Produces: `signupSchema`, `loginSchema`, `emailSchema`, `passwordSchema`
- Produces: `class RateLimiter` with `isBlocked(key, now?)`, `recordFailure(key, now?)`, `reset(key)`
- Consumed by: Task 9 (auth API routes)

- [ ] **Step 1: Write failing tests for schemas.ts**

Create `packages/auth/tests/schemas.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { signupSchema, loginSchema } from "../src/schemas.js";

describe("signupSchema", () => {
  it("trims and lowercases email", () => {
    const result = signupSchema.safeParse({
      email: "  User@Example.COM  ",
      password: "long-enough",
      confirm_password: "long-enough",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects password mismatch", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "long-enough",
      confirm_password: "different",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short passwords", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "short",
      confirm_password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({
      email: "not-an-email",
      password: "long-enough",
      confirm_password: "long-enough",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("parses valid login", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "some-password",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run tests/schemas.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schemas.ts**

Create `packages/auth/src/schemas.ts`:

```typescript
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8).max(128);

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm_password: passwordSchema,
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "password_mismatch",
    path: ["confirm_password"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
```

- [ ] **Step 4: Run schemas tests to verify they pass**

Run: `cd packages/auth && npx vitest run tests/schemas.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write failing tests for rate-limit.ts**

Create `packages/auth/tests/rate-limit.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/rate-limit.js";

const NOW = 1_000_000;
const MINUTE = 60 * 1000;

describe("RateLimiter", () => {
  it("blocks after maxFailures", () => {
    const limiter = new RateLimiter({ maxFailures: 3, windowMs: 15 * MINUTE });
    limiter.recordFailure("key", NOW);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(false);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(true);
  });

  it("unblocks after window elapses", () => {
    const limiter = new RateLimiter({ maxFailures: 3, windowMs: 15 * MINUTE });
    limiter.recordFailure("key", NOW);
    limiter.recordFailure("key", NOW);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW + 15 * MINUTE)).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter({ maxFailures: 1, windowMs: 15 * MINUTE });
    limiter.recordFailure("a", NOW);
    expect(limiter.isBlocked("a", NOW)).toBe(true);
    expect(limiter.isBlocked("b", NOW)).toBe(false);
  });

  it("resets a key", () => {
    const limiter = new RateLimiter({ maxFailures: 1, windowMs: 15 * MINUTE });
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(true);
    limiter.reset("key");
    expect(limiter.isBlocked("key", NOW)).toBe(false);
  });

  it("defaults to 10 failures / 15 minutes", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure("key", NOW);
    }
    expect(limiter.isBlocked("key", NOW)).toBe(false);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run tests/rate-limit.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement rate-limit.ts**

Create `packages/auth/src/rate-limit.ts`:

```typescript
export interface RateLimitOptions {
  maxFailures: number;
  windowMs: number;
}

interface WindowState {
  failures: number;
  windowStart: number;
}

export const RATE_LIMIT_MAX_FAILURES = 10;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export class RateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(options: Partial<RateLimitOptions> = {}) {
    this.maxFailures = options.maxFailures ?? RATE_LIMIT_MAX_FAILURES;
    this.windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  }

  isBlocked(key: string, now: number = Date.now()): boolean {
    const state = this.windows.get(key);
    if (!state) {
      return false;
    }
    if (now - state.windowStart >= this.windowMs) {
      this.windows.delete(key);
      return false;
    }
    return state.failures >= this.maxFailures;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const state = this.windows.get(key);
    if (!state || now - state.windowStart >= this.windowMs) {
      this.windows.set(key, { failures: 1, windowStart: now });
      return;
    }
    state.failures += 1;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
```

- [ ] **Step 8: Run rate-limit tests to verify they pass**

Run: `cd packages/auth && npx vitest run tests/rate-limit.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Update index.ts barrel**

Edit `packages/auth/src/index.ts`:

```typescript
export * from "./password.js";
export * from "./session-cookie.js";
export * from "./schemas.js";
export * from "./rate-limit.js";
```

- [ ] **Step 10: Build and run all @wpi/auth tests**

Run: `cd packages/auth && pnpm build && pnpm test`
Expected: Build exit 0, 22 tests pass

- [ ] **Step 11: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): add zod schemas and rate limiter"
```

---

### Task 3: AuthService interface and InMemoryAuthService

**Files:**

- Create: `packages/auth/src/auth-service.ts`
- Modify: `packages/auth/src/index.ts`
- Create: `packages/auth/tests/auth-service.test.ts`

**Interfaces:**

- Produces: `AuthService` interface, `InMemoryAuthService`, `SessionUser`, `CreatedSession`, `DuplicateEmailError`, `generateSessionToken()`, `hashToken(token)`, `SESSION_TTL_MS`, `SESSION_RENEWAL_THRESHOLD_MS`
- Consumed by: Task 5 (PgAuthService), Task 6 (container), Task 8 (routes), Task 9 (auth API)

- [ ] **Step 1: Write failing tests for auth-service.ts**

Create `packages/auth/tests/auth-service.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  InMemoryAuthService,
  DuplicateEmailError,
  generateSessionToken,
  hashToken,
  SESSION_TTL_MS,
  SESSION_RENEWAL_THRESHOLD_MS,
} from "../src/auth-service.js";

function makeClock() {
  const state = { current: 1_000_000 };
  return {
    state,
    now: () => state.current,
    advance(ms: number) {
      state.current += ms;
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("InMemoryAuthService", () => {
  it("normalizes email on create", async () => {
    const auth = new InMemoryAuthService();
    const user = await auth.createUser("  User@Example.COM  ", "password123");
    expect(user.email).toBe("user@example.com");
  });

  it("rejects duplicate email", async () => {
    const auth = new InMemoryAuthService();
    await auth.createUser("user@example.com", "password123");
    await expect(auth.createUser("  USER@Example.COM  ", "other-password")).rejects.toThrow(
      DuplicateEmailError,
    );
  });

  it("verifies credentials with padded uppercase email", async () => {
    const auth = new InMemoryAuthService();
    await auth.createUser("user@example.com", "password123");
    const result = await auth.verifyCredentials("  USER@Example.COM  ", "password123");
    expect(result).not.toBeNull();
    expect(result!.email).toBe("user@example.com");
  });

  it("returns null for unknown email", async () => {
    const auth = new InMemoryAuthService();
    const started = Date.now();
    const result = await auth.verifyCredentials("unknown@example.com", "password123");
    expect(result).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });

  it("returns null for wrong password", async () => {
    const auth = new InMemoryAuthService();
    await auth.createUser("user@example.com", "password123");
    expect(await auth.verifyCredentials("user@example.com", "wrong")).toBeNull();
  });

  it("creates a session with a 64-char hex token", async () => {
    const clock = makeClock();
    const auth = new InMemoryAuthService(clock.now);
    const user = await auth.createUser("user@example.com", "password123");
    const session = await auth.createSession(user.id);
    expect(session.token).toMatch(/^[0-9a-f]{64}$/);
    expect(session.expiresAt.getTime()).toBe(clock.state.current + SESSION_TTL_MS);
  });

  it("retrieves session user by token hash", async () => {
    const auth = new InMemoryAuthService();
    const user = await auth.createUser("user@example.com", "password123");
    const session = await auth.createSession(user.id);
    const found = await auth.getSessionUser(hashToken(session.token));
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
  });

  it("returns null for expired session", async () => {
    const clock = makeClock();
    const auth = new InMemoryAuthService(clock.now);
    const user = await auth.createUser("user@example.com", "password123");
    const session = await auth.createSession(user.id);
    clock.advance(SESSION_TTL_MS + 1);
    expect(await auth.getSessionUser(hashToken(session.token))).toBeNull();
  });

  it("does not renew when last_seen_at is within threshold", async () => {
    const clock = makeClock();
    const auth = new InMemoryAuthService(clock.now);
    const user = await auth.createUser("user@example.com", "password123");
    const session = await auth.createSession(user.id);
    const tokenHash = hashToken(session.token);

    clock.advance(6 * DAY_MS);
    await auth.getSessionUser(tokenHash);

    clock.advance(SESSION_TTL_MS - 6 * DAY_MS + DAY_MS);
    expect(await auth.getSessionUser(tokenHash)).toBeNull();
  });

  it("renews session when last_seen_at exceeds threshold", async () => {
    const clock = makeClock();
    const auth = new InMemoryAuthService(clock.now);
    const user = await auth.createUser("user@example.com", "password123");
    const session = await auth.createSession(user.id);
    const tokenHash = hashToken(session.token);

    clock.advance(8 * DAY_MS);
    await auth.getSessionUser(tokenHash);

    clock.advance(SESSION_TTL_MS - 8 * DAY_MS + DAY_MS);
    expect(await auth.getSessionUser(tokenHash)).not.toBeNull();
  });

  it("destroys a session", async () => {
    const auth = new InMemoryAuthService();
    const user = await auth.createUser("user@example.com", "password123");
    const session = await auth.createSession(user.id);
    const tokenHash = hashToken(session.token);
    expect(await auth.getSessionUser(tokenHash)).not.toBeNull();
    await auth.destroySession(tokenHash);
    expect(await auth.getSessionUser(tokenHash)).toBeNull();
  });

  it("generates independent tokens", async () => {
    const auth = new InMemoryAuthService();
    const user = await auth.createUser("user@example.com", "password123");
    const a = await auth.createSession(user.id);
    const b = await auth.createSession(user.id);
    expect(a.token).not.toBe(b.token);
  });

  it("rejects session creation for unknown user", async () => {
    const auth = new InMemoryAuthService();
    await expect(auth.createSession("no-such-user")).rejects.toThrow(/Unknown user/);
  });
});

describe("generateSessionToken", () => {
  it("returns a 64-char hex string", () => {
    expect(generateSessionToken()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashToken", () => {
  it("returns a SHA-256 hex digest", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken("test-token"));
  });
});

describe("constants", () => {
  it("exports TTL and renewal threshold", () => {
    expect(SESSION_TTL_MS).toBe(30 * DAY_MS);
    expect(SESSION_RENEWAL_THRESHOLD_MS).toBe(7 * DAY_MS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run tests/auth-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement auth-service.ts**

Create `packages/auth/src/auth-service.ts`:

```typescript
import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("email_taken");
    this.name = "DuplicateEmailError";
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

interface StoredSession {
  userId: string;
  expiresAt: number;
  lastSeenAt: number;
}

export interface AuthService {
  createUser(email: string, password: string): Promise<SessionUser>;
  verifyCredentials(email: string, password: string): Promise<SessionUser | null>;
  createSession(userId: string): Promise<CreatedSession>;
  getSessionUser(tokenHash: string): Promise<SessionUser | null>;
  destroySession(tokenHash: string): Promise<void>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemoryAuthService implements AuthService {
  private readonly usersByEmail = new Map<string, StoredUser>();
  private readonly sessionsByTokenHash = new Map<string, StoredSession>();
  private userCounter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  async createUser(email: string, password: string): Promise<SessionUser> {
    const normalized = normalizeEmail(email);
    if (this.usersByEmail.has(normalized)) {
      throw new DuplicateEmailError();
    }
    this.userCounter += 1;
    const user: StoredUser = {
      id: `user-${this.userCounter}`,
      email: normalized,
      passwordHash: await hashPassword(password),
    };
    this.usersByEmail.set(normalized, user);
    return { id: user.id, email: user.email };
  }

  async verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
    const user = this.usersByEmail.get(normalizeEmail(email));
    if (!user) {
      await hashPassword(password);
      return null;
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return null;
    }
    return { id: user.id, email: user.email };
  }

  async createSession(userId: string): Promise<CreatedSession> {
    const user = [...this.usersByEmail.values()].find((candidate) => candidate.id === userId);
    if (!user) {
      throw new Error(`Unknown user ${userId}`);
    }
    const current = this.now();
    const token = generateSessionToken();
    this.sessionsByTokenHash.set(hashToken(token), {
      userId,
      expiresAt: current + SESSION_TTL_MS,
      lastSeenAt: current,
    });
    return { token, expiresAt: new Date(current + SESSION_TTL_MS) };
  }

  async getSessionUser(tokenHash: string): Promise<SessionUser | null> {
    const current = this.now();
    const session = this.sessionsByTokenHash.get(tokenHash);
    if (!session) {
      return null;
    }
    if (current >= session.expiresAt) {
      this.sessionsByTokenHash.delete(tokenHash);
      return null;
    }
    if (current - session.lastSeenAt > SESSION_RENEWAL_THRESHOLD_MS) {
      session.expiresAt = current + SESSION_TTL_MS;
      session.lastSeenAt = current;
    }
    const user = [...this.usersByEmail.values()].find(
      (candidate) => candidate.id === session.userId,
    );
    return user ? { id: user.id, email: user.email } : null;
  }

  async destroySession(tokenHash: string): Promise<void> {
    this.sessionsByTokenHash.delete(tokenHash);
  }
}
```

- [ ] **Step 4: Update index.ts barrel**

Edit `packages/auth/src/index.ts`:

```typescript
export * from "./password.js";
export * from "./session-cookie.js";
export * from "./schemas.js";
export * from "./rate-limit.js";
export * from "./auth-service.js";
```

- [ ] **Step 5: Build and run all @wpi/auth tests**

Run: `cd packages/auth && pnpm build && pnpm test`
Expected: Build exit 0, all tests pass (including the 15 auth-service tests)

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): add AuthService interface and InMemoryAuthService"
```

---

### Task 4: Migrations 0016/0017 and audit store ownership

**Files:**

- Create: `packages/audit-pipeline/src/migrations/0016_create_users_sessions.sql`
- Create: `packages/audit-pipeline/src/migrations/0017_audits_user_ownership.sql`
- Modify: `packages/audit-pipeline/src/audit-store.ts`
- Modify: `packages/audit-pipeline/src/postgres-audit-store.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Create: `packages/audit-pipeline/tests/audit-ownership.test.ts`
- Create: `packages/audit-pipeline/tests/postgres-ownership.test.ts`
- Create: `packages/audit-pipeline/vitest.config.ts`
- Modify: `apps/web/src/services/access.ts`

**Interfaces:**

- Consumes: `AuditStore` interface from Task 4's own file (same package)
- Produces: `AuditRecord.user_id: string | null`, `AuditRecord.expires_at: string | null`, `CreateAuditInput.userId?: string | null`, `AuditStore.listByUser(userId): Promise<AuditRecord[]>`
- Consumed by: Task 6 (POST route), Task 8 (access guard), Task 10 (dashboard)

- [ ] **Step 1: Write migration 0016**

Create `packages/audit-pipeline/src/migrations/0016_create_users_sessions.sql`:

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
```

- [ ] **Step 2: Write migration 0017**

Create `packages/audit-pipeline/src/migrations/0017_audits_user_ownership.sql`:

```sql
ALTER TABLE audits ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE audits ALTER COLUMN expires_at DROP NOT NULL;
CREATE INDEX audits_user_id_idx ON audits (user_id);
```

- [ ] **Step 3: Write failing ownership tests for InMemoryAuditStore**

Create `packages/audit-pipeline/tests/audit-ownership.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryAuditStore,
  hashAuditSecret,
  generateAuditSecret,
  type AuditContext,
} from "../src/index.js";

const CONTEXT: AuditContext = {
  organization: "Test Org",
  business_type: "saas",
  offering: "Tooling",
  market: "Global",
  customer_language: "English",
  audience: "Developers",
};

describe("InMemoryAuditStore ownership", () => {
  it("sets expires_at to null and user_id for owned audits", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
      userId: "user-1",
    });
    expect(record.user_id).toBe("user-1");
    expect(record.expires_at).toBeNull();
  });

  it("keeps 7-day expiry and null user_id for anonymous audits", async () => {
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
    expect(record.user_id).toBeNull();
    expect(record.expires_at).not.toBeNull();
  });

  it("getActive returns owned audit as alive", async () => {
    const store = new InMemoryAuditStore();
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
      userId: "user-1",
    });
    const result = await store.getActive(record.id);
    expect(result).not.toBe("not_found");
    expect(result).not.toBe("deleted");
    expect(result).not.toBe("expired");
  });

  it("listByUser returns newest-first and excludes soft-deleted", async () => {
    const store = new InMemoryAuditStore();
    const s1 = generateAuditSecret();
    const r1 = await store.create({
      targetUrl: "https://example.com/1",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s1),
      ttlDays: 7,
      userId: "user-1",
    });
    await new Promise((r) => setTimeout(r, 2));
    const s2 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com/2",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s2),
      ttlDays: 7,
      userId: "user-1",
    });
    await store.softDelete(r1.id);

    const records = await store.listByUser("user-1");
    expect(records).toHaveLength(1);
    expect(records[0]!.target_url).toBe("https://example.com/2");
  });

  it("listByUser isolates between users", async () => {
    const store = new InMemoryAuditStore();
    const s1 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s1),
      ttlDays: 7,
      userId: "user-1",
    });
    const s2 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s2),
      ttlDays: 7,
      userId: "user-2",
    });

    expect(await store.listByUser("user-1")).toHaveLength(1);
    expect(await store.listByUser("user-2")).toHaveLength(1);
    expect(await store.listByUser("user-3")).toHaveLength(0);
  });

  it("sweepExpired skips owned audits (null expires_at)", async () => {
    vi.useFakeTimers();
    try {
      const store = new InMemoryAuditStore();
      const s1 = generateAuditSecret();
      const owned = await store.create({
        targetUrl: "https://example.com/owned",
        locale: "en",
        context: CONTEXT,
        tier: "rich",
        secretHash: hashAuditSecret(s1),
        ttlDays: 7,
        userId: "user-1",
      });
      const s2 = generateAuditSecret();
      const anon = await store.create({
        targetUrl: "https://example.com/anon",
        locale: "en",
        context: CONTEXT,
        tier: "preview",
        secretHash: hashAuditSecret(s2),
        ttlDays: 7,
      });

      vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
      await store.sweepExpired();

      const ownedRaw = await store.getRaw(owned.id);
      expect(ownedRaw!.status).not.toBe("EXPIRED");
      const anonRaw = await store.getRaw(anon.id);
      expect(anonRaw!.status).toBe("EXPIRED");
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd packages/audit-pipeline && npx vitest run tests/audit-ownership.test.ts`
Expected: FAIL — `userId` not in `CreateAuditInput`, `listByUser` not on `AuditStore`

- [ ] **Step 5: Update AuditRecord, CreateAuditInput, AuditStore interface, and InMemoryAuditStore**

In `packages/audit-pipeline/src/audit-store.ts`:

1. In `AuditRecord` interface (line 14–29), change line 27:
   - Old: `expires_at: string;`
   - New: `expires_at: string | null;`
   - Add after `secret_hash: string;`: `user_id: string | null;`

2. In `CreateAuditInput` interface (line 31–38), add:
   - `userId?: string | null;`

3. In `AuditStore` interface (line 43–61), add:
   - `listByUser(userId: string): Promise<AuditRecord[]>;`

4. In `InMemoryAuditStore.create()` (line 68–88):
   - Add `user_id: assignment.userId ?? null,` in the record construction
   - Change line 83 from:
     `expires_at: new Date(now.getTime() + assignment.ttlDays * DAY_MS).toISOString(),`
     to:
     `expires_at: assignment.userId != null ? null : new Date(now.getTime() + assignment.ttlDays * DAY_MS).toISOString(),`

5. In `InMemoryAuditStore.getActive()` (line 103), change:
   - Old: `if (new Date(row.expires_at).getTime() <= Date.now()) {`
   - New: `if (row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now()) {`

6. In `InMemoryAuditStore.sweepExpired()` (line 174–188), add `row.expires_at !== null &&` to the filter condition.

7. Add new method to `InMemoryAuditStore`:

```typescript
async listByUser(userId: string): Promise<AuditRecord[]> {
  const records = [...this.rows.values()]
    .filter((row) => row.user_id === userId && row.deleted_at === null)
    .map((row) => structuredClone(row));
  records.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return records;
}
```

- [ ] **Step 6: Update PostgresAuditStore**

In `packages/audit-pipeline/src/postgres-audit-store.ts`:

1. In `AuditRow` interface (line 17–32), change:
   - `expires_at: Date;` → `expires_at: Date | null;`
   - Add: `user_id: string | null;`

2. In `rowToRecord()` (line 38–55):
   - Change `expires_at: iso(row.expires_at),` → `expires_at: row.expires_at ? iso(row.expires_at) : null,`
   - Add: `user_id: row.user_id,`

3. In `create()` (line 62–81), change the SQL and params:
   - SQL:
     ```sql
     INSERT INTO audits (target_url, locale, tier, context, status, secret_hash, user_id, expires_at)
     VALUES ($1, $2, $3, $4, 'QUEUED', $5, $6::uuid, CASE WHEN $6::uuid IS NULL THEN now() + make_interval(days => $7) ELSE NULL END)
     RETURNING *
     ```
   - Params: `[input.targetUrl, input.locale, input.tier, JSON.stringify(input.context), input.secretHash, input.userId ?? null, input.ttlDays]`

4. In `getActive()` (line 96), change:
   - Old: `if (new Date(raw.expires_at).getTime() <= Date.now()) {`
   - New: `if (raw.expires_at !== null && new Date(raw.expires_at).getTime() <= Date.now()) {`

5. Add new method:

```typescript
async listByUser(userId: string): Promise<AuditRecord[]> {
  const result = await this.pool.query<AuditRow>(
    "SELECT * FROM audits WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
    [userId],
  );
  return result.rows.map(rowToRecord);
}
```

- [ ] **Step 7: Run ownership tests to verify they pass**

Run: `cd packages/audit-pipeline && npx vitest run tests/audit-ownership.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 8: Write failing Postgres ownership tests**

Create `packages/audit-pipeline/tests/postgres-ownership.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  PostgresAuditStore,
  applyMigrations,
  hashAuditSecret,
  generateAuditSecret,
  type AuditContext,
} from "../src/index.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PostgresAuditStore ownership", () => {
  let pool: Pool;
  let store: PostgresAuditStore;

  const CONTEXT: AuditContext = {
    organization: "Test Org",
    business_type: "saas",
    offering: "Tooling",
    market: "Global",
    customer_language: "English",
    audience: "Developers",
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("DROP TABLE IF EXISTS audits CASCADE");
    await pool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    await applyMigrations(pool);
    store = new PostgresAuditStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'stub') RETURNING id",
      [email],
    );
    return result.rows[0].id;
  }

  it("creates owned audit with null expiry", async () => {
    const userId = await insertUser(`pg-own-${randomUUID()}@example.com`);
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
      userId,
    });
    expect(record.user_id).toBe(userId);
    expect(record.expires_at).toBeNull();
  });

  it("creates anonymous audit with 7-day expiry", async () => {
    const secret = generateAuditSecret();
    const record = await store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "preview",
      secretHash: hashAuditSecret(secret),
      ttlDays: 7,
    });
    expect(record.user_id).toBeNull();
    expect(record.expires_at).not.toBeNull();
  });

  it("listByUser returns newest-first", async () => {
    const userId = await insertUser(`pg-list-${randomUUID()}@example.com`);
    const s1 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com/1",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s1),
      ttlDays: 7,
      userId,
    });
    const s2 = generateAuditSecret();
    await store.create({
      targetUrl: "https://example.com/2",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: hashAuditSecret(s2),
      ttlDays: 7,
      userId,
    });
    const records = await store.listByUser(userId);
    expect(records.length).toBe(2);
    expect(records[0].target_url).toBe("https://example.com/2");
  });
});
```

- [ ] **Step 9: Create vitest.config.ts to disable file parallelism**

Create `packages/audit-pipeline/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
```

- [ ] **Step 10: Update access.ts null-guard for expires_at**

In `apps/web/src/services/access.ts`, change line 38:

- Old: `if (new Date(raw.expires_at).getTime() <= Date.now()) {`
- New: `if (raw.expires_at !== null && new Date(raw.expires_at).getTime() <= Date.now()) {`

- [ ] **Step 11: Run existing audit-pipeline tests to verify no regressions**

Run: `cd packages/audit-pipeline && pnpm test`
Expected: All tests pass (including existing `postgres-audit-store.test.ts` if DATABASE_URL is set)

- [ ] **Step 12: Commit**

```bash
git add packages/audit-pipeline/ apps/web/src/services/access.ts
git commit -m "feat(audit-pipeline): add user ownership migrations and store support"
```

---

### Task 5: PgAuthService

**Files:**

- Create: `packages/auth/src/pg-auth-service.ts`
- Modify: `packages/auth/src/index.ts`
- Create: `packages/auth/tests/pg-auth-service.test.ts`

**Interfaces:**

- Consumes: `AuthService`, `hashPassword`, `verifyPassword`, `generateSessionToken`, `hashToken`, `SESSION_TTL_MS`, `DuplicateEmailError`
- Produces: `PgAuthService implements AuthService`
- Consumed by: Task 6 (container wiring)

- [ ] **Step 1: Write failing gated tests for PgAuthService**

Create `packages/auth/tests/pg-auth-service.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import {
  PgAuthService,
  DuplicateEmailError,
  hashToken,
  SESSION_TTL_MS,
} from "../src/pg-auth-service.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PgAuthService", () => {
  let pool: Pool;
  let auth: PgAuthService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    const sql = await readFile(
      new URL(
        "../../audit-pipeline/src/migrations/0016_create_users_sessions.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pool.query(sql);
    auth = new PgAuthService(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and verifies a user", async () => {
    const email = `pg-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    expect(user.email).toBe(email);
    const verified = await auth.verifyCredentials(email, "password123");
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe(user.id);
  });

  it("rejects duplicate email", async () => {
    const email = `pg-${randomUUID()}@example.com`;
    await auth.createUser(email, "password123");
    await expect(auth.createUser(email, "other-pass")).rejects.toThrow(DuplicateEmailError);
  });

  it("returns null for unknown email with latency", async () => {
    const started = Date.now();
    const result = await auth.verifyCredentials(`unknown-${randomUUID()}@example.com`, "pass");
    expect(result).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });

  it("full session lifecycle", async () => {
    const email = `pg-sess-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    const session = await auth.createSession(user.id);
    expect(session.token).toMatch(/^[0-9a-f]{64}$/);

    const found = await auth.getSessionUser(hashToken(session.token));
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);

    await auth.destroySession(hashToken(session.token));
    expect(await auth.getSessionUser(hashToken(session.token))).toBeNull();
  });

  it("returns null for expired session and deletes the row", async () => {
    const email = `pg-exp-${randomUUID()}@example.com`;
    const user = await auth.createUser(email, "password123");
    const session = await auth.createSession(user.id);
    const tokenHash = hashToken(session.token);

    await pool.query(
      "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
      [tokenHash],
    );

    expect(await auth.getSessionUser(tokenHash)).toBeNull();
    const check = await pool.query("SELECT 1 FROM sessions WHERE token_hash = $1", [tokenHash]);
    expect(check.rowCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run tests/pg-auth-service.test.ts`
Expected: FAIL — `PgAuthService` not exported (or skipped if no DATABASE_URL)

- [ ] **Step 3: Implement pg-auth-service.ts**

Create `packages/auth/src/pg-auth-service.ts`:

```typescript
import type { Pool } from "pg";
import { hashPassword, verifyPassword } from "./password.js";
import {
  DuplicateEmailError,
  generateSessionToken,
  hashToken,
  SESSION_TTL_MS,
  SESSION_RENEWAL_THRESHOLD_MS,
  type AuthService,
  type CreatedSession,
  type SessionUser,
} from "./auth-service.js";

export class PgAuthService implements AuthService {
  constructor(private readonly pool: Pool) {}

  async createUser(email: string, password: string): Promise<SessionUser> {
    const normalized = email.trim().toLowerCase();
    const hash = await hashPassword(password);
    try {
      const result = await this.pool.query<{ id: string; email: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [normalized, hash],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error("User insert returned no row");
      }
      return { id: row.id, email: row.email };
    } catch (error) {
      if ("code" in (error as object) && (error as { code: string }).code === "23505") {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  async verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
    const normalized = email.trim().toLowerCase();
    const result = await this.pool.query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [normalized],
    );
    const row = result.rows[0];
    if (!row) {
      await hashPassword(password);
      return null;
    }
    if (!(await verifyPassword(password, row.password_hash))) {
      return null;
    }
    return { id: row.id, email: row.email };
  }

  async createSession(userId: string): Promise<CreatedSession> {
    const token = generateSessionToken();
    const tokenHashValue = hashToken(token);
    const ttlSeconds = SESSION_TTL_MS / 1000;
    const result = await this.pool.query<{ expires_at: Date }>(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2::uuid, now() + make_interval(secs => $3))
       RETURNING expires_at`,
      [tokenHashValue, userId, ttlSeconds],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Session insert returned no row");
    }
    return { token, expiresAt: row.expires_at };
  }

  async getSessionUser(tokenHash: string): Promise<SessionUser | null> {
    const renewalSeconds = SESSION_RENEWAL_THRESHOLD_MS / 1000;
    const ttlSeconds = SESSION_TTL_MS / 1000;

    await this.pool.query(
      `UPDATE sessions
       SET expires_at = now() + make_interval(secs => $2),
           last_seen_at = now()
       WHERE token_hash = $1
         AND expires_at > now()
         AND now() - last_seen_at > make_interval(secs => $3)`,
      [tokenHash, ttlSeconds, renewalSeconds],
    );

    const result = await this.pool.query<{ id: string; email: string }>(
      `SELECT u.id, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash],
    );

    if (!result.rows[0]) {
      await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
      return null;
    }

    const row = result.rows[0];
    return { id: row.id, email: row.email };
  }

  async destroySession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }
}
```

- [ ] **Step 4: Update index.ts barrel**

Add to `packages/auth/src/index.ts`:

```typescript
export * from "./pg-auth-service.js";
```

- [ ] **Step 5: Build and run all @wpi/auth tests**

Run: `cd packages/auth && pnpm build && pnpm test`
Expected: Build exit 0, all non-gated tests pass. Gated pg-auth tests are skipped without DATABASE_URL.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): add PgAuthService with sliding renewal"
```

---

### Task 6: Container wiring and POST route session branch

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/src/services/container.ts`
- Modify: `apps/web/src/app/api/audits/route.ts`
- Modify: `apps/web/src/test/api-audits-post.test.ts`
- Modify: `apps/web/src/test/api-routes.test.ts`

**Interfaces:**

- Consumes: `InMemoryAuthService`, `PgAuthService`, `RateLimiter`, `AuthService` from `@wpi/auth`
- Produces: `AuditServices.auth`, `AuditServices.rateLimiter`, POST route reads session and passes `userId`
- Consumed by: Task 8 (access guard), Task 9 (auth API)

- [ ] **Step 1: Add @wpi/auth dependency to apps/web**

In `apps/web/package.json`, insert `"@wpi/auth": "workspace:*",` after `"@wpi/audit-pipeline": "workspace:*",` (alphabetical order: "audit" < "auth").

- [ ] **Step 2: Write failing tests for session-aware POST**

In `apps/web/src/test/api-audits-post.test.ts`:

1. Add imports at the top:

```typescript
import { InMemoryAuthService, RateLimiter } from "@wpi/auth";
```

2. In `makeServices()`, add after `cookieSecret`:

```typescript
auth: new InMemoryAuthService(),
rateLimiter: new RateLimiter(),
```

3. Add a `cookie` parameter to `makeRequest`:

```typescript
function makeRequest(body: unknown, cookie?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/audits", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
```

4. Add two new test cases inside the `describe("POST /api/audits")` block:

```typescript
it("creates an owned audit when signed in", async () => {
  const store = new InMemoryAuditStore();
  const auth = new InMemoryAuthService();
  setAuditServicesForTests({
    ...makeServices(store),
    auth,
  });

  const user = await auth.createUser("owner@example.com", "password123");
  const session = await auth.createSession(user.id);

  const response = await POST(makeRequest(VALID_BODY, `wpi_session=${session.token}`));

  expect(response.status).toBe(201);
  const body = (await response.json()) as { id: string; redirect_url: string | null };
  expect(body.redirect_url).toBe("/en/dashboard");

  const raw = await store.getRaw(body.id);
  expect(raw?.user_id).toBe(user.id);
  expect(raw?.expires_at).toBeNull();
});

it("returns redirect_url null for anonymous POST", async () => {
  const store = new InMemoryAuditStore();
  setAuditServicesForTests(makeServices(store));

  const response = await POST(makeRequest(VALID_BODY, "wpi_session=garbage"));
  expect(response.status).toBe(201);
  const body = (await response.json()) as { redirect_url: string | null };
  expect(body.redirect_url).toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @wpi/web test -- --run src/test/api-audits-post.test.ts`
Expected: FAIL — `auth` and `rateLimiter` not in `AuditServices`

- [ ] **Step 4: Update AuditServices interface and container**

In `apps/web/src/services/container.ts`:

1. Add imports:

```typescript
import { InMemoryAuthService, PgAuthService, RateLimiter } from "@wpi/auth";
import type { AuthService } from "@wpi/auth";
```

2. Add to `AuditServices` interface (after `cookieSecret: string;`):

```typescript
auth: AuthService;
rateLimiter: RateLimiter;
```

3. In the stub return (around line 300–304), add after `cookieSecret`:

```typescript
auth: new InMemoryAuthService(),
rateLimiter: new RateLimiter(),
```

4. In the non-stub return (around line 340–348), add after `cookieSecret,`:

```typescript
auth: new PgAuthService(pool),
rateLimiter: new RateLimiter(),
```

- [ ] **Step 5: Update POST route to read session**

In `apps/web/src/app/api/audits/route.ts`:

1. Add import:

```typescript
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
```

2. After `const services = await getAuditServices();` (line 30), add:

```typescript
const sessionTokenHash = hashToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "");
const user = await services.auth.getSessionUser(sessionTokenHash);
```

3. In the `store.create()` call, add `userId: user?.id ?? null,`

4. In the response body, add `redirect_url`:

```typescript
{ id: record.id, secret, status_url: `/${parsed.data.locale}/audit/${record.id}`, redirect_url: user ? `/${parsed.data.locale}/dashboard` : null }
```

- [ ] **Step 6: Update api-routes.test.ts makeServices**

In `apps/web/src/test/api-routes.test.ts`, add `auth` and `rateLimiter` to the `makeServices()` function:

```typescript
import { InMemoryAuthService, RateLimiter } from "@wpi/auth";

function makeServices(store: AuditStore): AuditServices {
  return {
    store,
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new RateLimiter(),
    validateUrl: async () => ({ ok: true }),
    outputDir: "./output",
    geminiApiKey: undefined,
  };
}
```

- [ ] **Step 7: Run all web tests**

Run: `pnpm --filter @wpi/web test -- --run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat(web): wire auth services into container and add session-aware audit creation"
```

---

### Task 7: i18n keys for auth, dashboard, account, and new status stages

**Files:**

- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/ar.json`

**Interfaces:**

- Consumes: existing `nav`, `status` namespaces
- Produces: new keys in `nav`, `status`, plus new `auth`, `dashboard`, `account` namespaces

- [ ] **Step 1: Add keys to en.json**

In `apps/web/src/messages/en.json`:

1. In `nav`, add:

```json
"sign_in": "Sign in",
"sign_up": "Sign up",
"sign_out": "Sign out",
"dashboard": "Dashboard"
```

2. In `status`, add:

```json
"stage_ENRICHING_OPTIONAL": "Enriching",
"stage_FAILED": "Failed",
"stage_EXPIRED": "Expired",
"stage_CANCELLED": "Cancelled"
```

3. Add new top-level namespace `auth`:

```json
"auth": {
  "signup_title": "Create your account",
  "login_title": "Sign in",
  "email_label": "Email",
  "password_label": "Password",
  "confirm_password_label": "Confirm password",
  "sign_up": "Sign up",
  "sign_in": "Sign in",
  "have_account": "Already have an account? Sign in",
  "need_account": "Need an account? Sign up",
  "error_invalid_input": "Please check your details and try again.",
  "error_email_taken": "An account with this email already exists.",
  "error_invalid_credentials": "Incorrect email or password.",
  "error_rate_limited": "Too many attempts. Please try again later.",
  "error_generic": "Something went wrong. Please try again.",
  "error_password_mismatch": "Passwords do not match."
}
```

4. Add new top-level namespace `dashboard`:

```json
"dashboard": {
  "title": "Your audits",
  "score": "Score: {score}",
  "site": "Site",
  "date": "Date",
  "status": "Status",
  "view_report": "View report",
  "empty_title": "No audits yet",
  "empty_body": "Run your first audit to start tracking your presence readiness over time.",
  "empty_cta": "Run your first audit",
  "reminder": "Your last audit was {days} days ago — re-run to see your trend",
  "dismiss": "Dismiss"
}
```

5. Add new top-level namespace `account`:

```json
"account": {
  "report_signup_cta": "Sign up to keep reports forever →"
}
```

- [ ] **Step 2: Add matching keys to ar.json**

Same structure with Arabic translations:

1. In `nav`:

```json
"sign_in": "تسجيل الدخول",
"sign_up": "إنشاء حساب",
"sign_out": "تسجيل الخروج",
"dashboard": "لوحة التحكم"
```

2. In `status`:

```json
"stage_ENRICHING_OPTIONAL": "إثراء",
"stage_FAILED": "فشل",
"stage_EXPIRED": "منتهي",
"stage_CANCELLED": "ملغى"
```

3. New `auth` namespace:

```json
"auth": {
  "signup_title": "أنشئ حسابك",
  "login_title": "تسجيل الدخول",
  "email_label": "البريد الإلكتروني",
  "password_label": "كلمة المرور",
  "confirm_password_label": "تأكيد كلمة المرور",
  "sign_up": "إنشاء حساب",
  "sign_in": "تسجيل الدخول",
  "have_account": "لديك حساب بالفعل؟ سجّل الدخول",
  "need_account": "ليس لديك حساب؟ أنشئ حساباً",
  "error_invalid_input": "يرجى التحقق من بياناتك والمحاولة مرة أخرى.",
  "error_email_taken": "يوجد حساب بالفعل بهذا البريد الإلكتروني.",
  "error_invalid_credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "error_rate_limited": "محاولات كثيرة جدًا. يرجى المحاولة لاحقًا.",
  "error_generic": "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
  "error_password_mismatch": "كلمتا المرور غير متطابقتين."
}
```

4. New `dashboard` namespace:

```json
"dashboard": {
  "title": "تدقيقاتك",
  "score": "النتيجة: {score}",
  "site": "الموقع",
  "date": "التاريخ",
  "status": "الحالة",
  "view_report": "عرض التقرير",
  "empty_title": "لا توجد تدقيقات بعد",
  "empty_body": "شغّل تدقيقك الأول لتبدأ في تتبع جاهزية حضورك الرقمي بمرور الوقت.",
  "empty_cta": "شغّل تدقيقك الأول",
  "reminder": "آخر تدقيق لك كان قبل {days} يومًا — أعد التشغيل لمشاهدة تطور نتيجتك",
  "dismiss": "تجاهل"
}
```

5. New `account` namespace:

```json
"account": {
  "report_signup_cta": "أنشئ حسابًا للاحتفاظ بتقاريرك للأبد ←"
}
```

- [ ] **Step 3: Run parity test**

Run: `pnpm --filter @wpi/web test -- --run`
Expected: All tests pass (the i18n parity test enforces matching keys)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/messages/
git commit -m "feat(web): add i18n keys for auth, dashboard, account, and new status stages"
```

---

### Task 8: Owned-access guard and caller updates

**Files:**

- Modify: `apps/web/src/services/access.ts`
- Modify: `apps/web/src/app/[locale]/audit/[id]/page.tsx`
- Modify: `apps/web/src/app/api/audits/[id]/status/route.ts`
- Modify: `apps/web/src/app/api/audits/[id]/route.ts`
- Modify: `apps/web/src/test/api-routes.test.ts`

**Interfaces:**

- Consumes: `authorizeRecord` gains 4th param `userId?: string | null`
- Consumes: `services.auth.getSessionUser(tokenHash)` from container
- Produces: owned audits accessible without `?s=` for the owner

- [ ] **Step 1: Write failing tests for owned access**

In `apps/web/src/test/api-routes.test.ts`, add a helper and 3 tests:

```typescript
async function seedOwnedStore(): Promise<{
  store: InMemoryAuditStore;
  id: string;
  secret: string;
}> {
  const store = new InMemoryAuditStore();
  const secret = generateAuditSecret();
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: CONTEXT,
    tier: "rich",
    secretHash: hashAuditSecret(secret),
    ttlDays: 7,
    userId: "user-1",
  });
  return { store, id: record.id, secret };
}

describe("authorizeRecord owned access", () => {
  it("authorizes the owner without a secret", async () => {
    const { store, id } = await seedOwnedStore();
    const outcome = await authorizeRecord(store, id, undefined, "user-1");
    expect(outcome.kind).toBe("authorized");
  });

  it("returns not_found for a different user", async () => {
    const { store, id } = await seedOwnedStore();
    const outcome = await authorizeRecord(store, id, undefined, "user-2");
    expect(outcome.kind).toBe("not_found");
  });

  it("returns not_found when userId is undefined and no secret", async () => {
    const { store, id } = await seedOwnedStore();
    const outcome = await authorizeRecord(store, id, undefined, undefined);
    expect(outcome.kind).toBe("not_found");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wpi/web test -- --run src/test/api-routes.test.ts`
Expected: FAIL — `authorizeRecord` takes 3 args, not 4

- [ ] **Step 3: Update authorizeRecord**

In `apps/web/src/services/access.ts`, change the signature and add the owned-access branch:

```typescript
export async function authorizeRecord(
  store: AuditStore,
  id: string,
  secret: string | undefined,
  userId?: string | null,
): Promise<AccessOutcome> {
  const raw = await store.getRaw(id);
  if (raw === null) {
    return { kind: "not_found" };
  }
  const ownedByCaller = userId !== undefined && userId !== null && raw.user_id === userId;
  if (!ownedByCaller && !hashesMatch(hashAuditSecret(secret ?? ""), raw.secret_hash)) {
    return { kind: "not_found" };
  }
  if (raw.deleted_at !== null) {
    return { kind: "deleted" };
  }
  if (raw.expires_at !== null && new Date(raw.expires_at).getTime() <= Date.now()) {
    await store.transition(id, "EXPIRED").catch(() => undefined);
    return { kind: "expired" };
  }
  return { kind: "authorized", record: raw };
}
```

- [ ] **Step 4: Update the audit page to pass session userId**

In `apps/web/src/app/[locale]/audit/[id]/page.tsx`:

1. Add imports:

```typescript
import { cookies } from "next/headers";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
```

2. After `const services = await getAuditServices();` (line 37), add:

```typescript
const cookieStore = await cookies();
const user = await services.auth.getSessionUser(
  hashToken(cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ""),
);
```

3. Change line 38 from:

```typescript
const outcome = await authorizeRecord(services.store, id, s);
```

to:

```typescript
const outcome = await authorizeRecord(services.store, id, s, user?.id ?? null);
```

4. After the `ReportView` return (around line 81–86), add a signup CTA for anonymous users. Add import:

```typescript
import { getTranslations } from "next-intl/server";
```

And before the return, add:

```typescript
const tAccount = await getTranslations({ locale, namespace: "account" });
```

Then wrap the ReportView return to include the CTA:

```tsx
return (
  <>
    <ReportView record={{ ...safeRecord, report }} locale={locale} secret={s ?? ""} />
    {user === null ? (
      <p className="mt-6 text-center">
        <Link href="/signup" className="underline">
          {tAccount("report_signup_cta")}
        </Link>
      </p>
    ) : null}
  </>
);
```

- [ ] **Step 5: Update status route to pass session userId**

In `apps/web/src/app/api/audits/[id]/status/route.ts`:

1. Add import:

```typescript
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
```

2. After `const services = await getAuditServices();` (line 23), add:

```typescript
const user = await services.auth.getSessionUser(
  hashToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? ""),
);
```

3. Change the authorizeRecord call:

```typescript
const outcome = await authorizeRecord(services.store, id, secret, user?.id ?? null);
```

- [ ] **Step 6: Update DELETE route to pass session userId**

In `apps/web/src/app/api/audits/[id]/route.ts`:

1. Add import:

```typescript
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
```

2. After `const services = await getAuditServices();` (line 18), add:

```typescript
const user = await services.auth.getSessionUser(
  hashToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? ""),
);
```

3. Change the authorizeRecord call:

```typescript
const outcome = await authorizeRecord(services.store, id, secret, user?.id ?? null);
```

- [ ] **Step 7: Run all web tests**

Run: `pnpm --filter @wpi/web test -- --run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add owned-access branch to authorizeRecord and update all callers"
```

---

### Task 9: Auth API routes (signup, login, logout)

**Files:**

- Create: `apps/web/src/services/client-ip.ts`
- Create: `apps/web/src/app/api/auth/signup/route.ts`
- Create: `apps/web/src/app/api/auth/login/route.ts`
- Create: `apps/web/src/app/api/auth/logout/route.ts`
- Create: `apps/web/src/test/auth-routes.test.ts`

**Interfaces:**

- Consumes: `signupSchema`, `loginSchema`, `DuplicateEmailError`, `SESSION_COOKIE_NAME`, `sessionCookieOptions`, `hashToken` from `@wpi/auth`
- Consumes: `getAuditServices()` for `auth` and `rateLimiter`
- Produces: POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout

- [ ] **Step 1: Write failing tests for auth routes**

Create `apps/web/src/test/auth-routes.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
import { InMemoryAuthService, RateLimiter } from "@wpi/auth";
import { NextRequest } from "next/server";
import { POST as signupPOST } from "../app/api/auth/signup/route";
import { POST as loginPOST } from "../app/api/auth/login/route";
import { POST as logoutPOST } from "../app/api/auth/logout/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

function makeServices(): AuditServices {
  const store = new InMemoryAuditStore();
  return {
    store,
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new RateLimiter(),
    validateUrl: async () => ({ ok: true }),
    outputDir: "./output",
    geminiApiKey: undefined,
  };
}

function authRequest(url: string, body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("POST /api/auth/signup", () => {
  it("creates a user and sets session cookie", async () => {
    setAuditServicesForTests(makeServices());
    const response = await signupPOST(
      authRequest("http://localhost:3000/api/auth/signup", {
        email: "new@example.com",
        password: "password123",
        confirm_password: "password123",
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("wpi_session=");
  });

  it("rejects duplicate email with 409", async () => {
    setAuditServicesForTests(makeServices());
    const body = {
      email: "dup@example.com",
      password: "password123",
      confirm_password: "password123",
    };
    await signupPOST(authRequest("http://localhost:3000/api/auth/signup", body));
    const response = await signupPOST(authRequest("http://localhost:3000/api/auth/signup", body));
    expect(response.status).toBe(409);
  });

  it("rejects short password with 400", async () => {
    setAuditServicesForTests(makeServices());
    const response = await signupPOST(
      authRequest("http://localhost:3000/api/auth/signup", {
        email: "short@example.com",
        password: "short",
        confirm_password: "short",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 and sets cookie on success", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    await services.auth.createUser("login@example.com", "password123");

    const response = await loginPOST(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "login@example.com",
        password: "password123",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("wpi_session=");
  });

  it("returns 401 for wrong password", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    await services.auth.createUser("wrong@example.com", "password123");

    const response = await loginPOST(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "wrong@example.com",
        password: "wrong-password",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rate-limits after 10 failures", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    await services.auth.createUser("rated@example.com", "password123");

    for (let i = 0; i < 10; i++) {
      await loginPOST(
        authRequest("http://localhost:3000/api/auth/login", {
          email: "rated@example.com",
          password: "wrong",
        }),
      );
    }

    const response = await loginPOST(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "rated@example.com",
        password: "wrong",
      }),
    );
    expect(response.status).toBe(429);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    const user = await services.auth.createUser("out@example.com", "password123");
    const session = await services.auth.createSession(user.id);

    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { cookie: `wpi_session=${session.token}` },
    });
    const response = await logoutPOST(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("wpi_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wpi/web test -- --run src/test/auth-routes.test.ts`
Expected: FAIL — route modules not found

- [ ] **Step 3: Implement client-ip.ts**

Create `apps/web/src/services/client-ip.ts`:

```typescript
import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
```

- [ ] **Step 4: Implement signup route**

Create `apps/web/src/app/api/auth/signup/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import {
  signupSchema,
  DuplicateEmailError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@wpi/auth";
import { getAuditServices } from "../../../../services/container";
import { getClientIp } from "../../../../services/client-ip";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const services = await getAuditServices();
  const ip = getClientIp(request);
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${parsed.data.email}`;

  if (services.rateLimiter.isBlocked(ipKey) || services.rateLimiter.isBlocked(emailKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const user = await services.auth.createUser(parsed.data.email, parsed.data.password);
    const session = await services.auth.createSession(user.id);
    services.rateLimiter.reset(ipKey);
    services.rateLimiter.reset(emailKey);

    const response = NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      services.rateLimiter.recordFailure(ipKey);
      services.rateLimiter.recordFailure(emailKey);
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implement login route**

Create `apps/web/src/app/api/auth/login/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { loginSchema, SESSION_COOKIE_NAME, sessionCookieOptions } from "@wpi/auth";
import { getAuditServices } from "../../../../services/container";
import { getClientIp } from "../../../../services/client-ip";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const services = await getAuditServices();
  const ip = getClientIp(request);
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${parsed.data.email}`;

  if (services.rateLimiter.isBlocked(ipKey) || services.rateLimiter.isBlocked(emailKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const user = await services.auth.verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    services.rateLimiter.recordFailure(ipKey);
    services.rateLimiter.recordFailure(emailKey);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const session = await services.auth.createSession(user.id);
  services.rateLimiter.reset(ipKey);
  services.rateLimiter.reset(emailKey);

  const response = NextResponse.json({ id: user.id, email: user.email }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
  return response;
}
```

- [ ] **Step 6: Implement logout route**

Create `apps/web/src/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { hashToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@wpi/auth";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const services = await getAuditServices();
    await services.auth.destroySession(hashToken(token));
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
```

- [ ] **Step 7: Run auth route tests**

Run: `pnpm --filter @wpi/web test -- --run src/test/auth-routes.test.ts`
Expected: All tests pass

- [ ] **Step 8: Run all web tests**

Run: `pnpm --filter @wpi/web test -- --run`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add auth API routes for signup, login, and logout"
```

---

### Task 10: Dashboard page with trend chart and audit list

**Files:**

- Create: `apps/web/src/app/[locale]/_components/trend-series.ts`
- Create: `apps/web/src/app/[locale]/_components/trend-chart.tsx`
- Create: `apps/web/src/app/[locale]/_components/audit-list.tsx`
- Create: `apps/web/src/app/[locale]/_components/reminder-banner.tsx`
- Create: `apps/web/src/app/[locale]/dashboard/page.tsx`
- Create: `apps/web/src/test/trend-series.test.ts`

**Interfaces:**

- Consumes: `AuditStore.listByUser()`, `services.auth.getSessionUser()`
- Produces: Dashboard page at `/[locale]/dashboard`

- [ ] **Step 1: Write failing tests for trend-series.ts**

Create `apps/web/src/test/trend-series.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildTrendSeries } from "../app/[locale]/_components/trend-series";

describe("buildTrendSeries", () => {
  it("extracts scores from completed audits", () => {
    const records = [
      {
        created_at: "2026-10-01T00:00:00Z",
        report: { score: { presence_readiness: 65 } },
      },
      {
        created_at: "2026-10-05T00:00:00Z",
        report: { score: { presence_readiness: 72 } },
      },
    ];
    const points = buildTrendSeries(records);
    expect(points).toEqual([
      { date: "2026-10-01T00:00:00Z", score: 65 },
      { date: "2026-10-05T00:00:00Z", score: 72 },
    ]);
  });

  it("skips audits with null score", () => {
    const records = [
      { created_at: "2026-10-01T00:00:00Z", report: null },
      {
        created_at: "2026-10-05T00:00:00Z",
        report: { score: { presence_readiness: 72 } },
      },
    ];
    const points = buildTrendSeries(records);
    expect(points).toHaveLength(1);
    expect(points[0]!.score).toBe(72);
  });

  it("sorts ascending by date from newest-first input", () => {
    const records = [
      {
        created_at: "2026-10-10T00:00:00Z",
        report: { score: { presence_readiness: 80 } },
      },
      {
        created_at: "2026-10-01T00:00:00Z",
        report: { score: { presence_readiness: 60 } },
      },
    ];
    const points = buildTrendSeries(records);
    expect(points[0]!.date).toBe("2026-10-01T00:00:00Z");
    expect(points[1]!.date).toBe("2026-10-10T00:00:00Z");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wpi/web test -- --run src/test/trend-series.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement trend-series.ts**

Create `apps/web/src/app/[locale]/_components/trend-series.ts`:

```typescript
export interface TrendPoint {
  date: string;
  score: number;
}

interface TrendRecord {
  created_at: string;
  report: { score: { presence_readiness: number | null } | null } | null;
}

export function buildTrendSeries(records: TrendRecord[]): TrendPoint[] {
  return [...records]
    .filter((record) => typeof record.report?.score?.presence_readiness === "number")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((record) => ({
      date: record.created_at,
      score: record.report?.score?.presence_readiness as number,
    }));
}
```

- [ ] **Step 4: Run trend-series tests**

Run: `pnpm --filter @wpi/web test -- --run src/test/trend-series.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement trend-chart.tsx**

Create `apps/web/src/app/[locale]/_components/trend-chart.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { buildTrendSeries, type TrendPoint } from "./trend-series";

const WIDTH = 560;
const HEIGHT = 180;
const PAD_X = 32;
const PAD_Y = 16;
const SCORE_LINE_COLOR = "#2563eb";

interface TrendRecord {
  created_at: string;
  report: { score: { presence_readiness: number | null } | null } | null;
}

export function TrendChart({ records, locale }: { records: TrendRecord[]; locale: string }) {
  const t = useTranslations("dashboard");
  const points = buildTrendSeries(records);

  if (points.length === 0) {
    return null;
  }

  const stepX = points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;

  const pathD = points
    .map((point, i) => {
      const x = PAD_X + i * stepX;
      const y = HEIGHT - PAD_Y - (point.score / 100) * (HEIGHT - PAD_Y * 2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full max-w-xl"
      aria-label={t("title")}
    >
      {[0, 50, 100].map((value) => {
        const y = HEIGHT - PAD_Y - (value / 100) * (HEIGHT - PAD_Y * 2);
        return (
          <g key={value}>
            <line x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke="#e5e5e5" strokeWidth={1} />
            <text x={4} y={y + 4} className="fill-neutral-400" fontSize={10}>
              {value}
            </text>
          </g>
        );
      })}
      <path d={pathD} fill="none" stroke={SCORE_LINE_COLOR} strokeWidth={2} />
      {points.map((point, i) => {
        const x = PAD_X + i * stepX;
        const y = HEIGHT - PAD_Y - (point.score / 100) * (HEIGHT - PAD_Y * 2);
        return (
          <circle key={point.date} cx={x} cy={y} r={3} fill={SCORE_LINE_COLOR}>
            <title>
              {dateFormatter.format(new Date(point.date))}: {point.score}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 6: Implement audit-list.tsx**

Create `apps/web/src/app/[locale]/_components/audit-list.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { AuditRecord } from "@wpi/audit-pipeline";
import { Link } from "../../../i18n/navigation";

export async function AuditList({ records, locale }: { records: AuditRecord[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-start">
          <th className="py-2">{t("site")}</th>
          <th className="py-2">{t("date")}</th>
          <th className="py-2">{t("status")}</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {records.map((record) => {
          const hostname = new URL(record.target_url).hostname;
          const score = record.report?.score?.presence_readiness ?? null;
          return (
            <tr key={record.id} className="border-b border-neutral-100">
              <td className="py-2">{hostname}</td>
              <td className="py-2">{dateFormatter.format(new Date(record.created_at))}</td>
              <td className="py-2">
                {tStatus(`stage_${record.status}`)}
                {score !== null ? (
                  <span className="ms-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                    {score}%
                  </span>
                ) : null}
              </td>
              <td className="py-2">
                <Link href={`/audit/${record.id}`} className="underline">
                  {t("view_report")}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 7: Implement reminder-banner.tsx**

Create `apps/web/src/app/[locale]/_components/reminder-banner.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function ReminderBanner({ days }: { days: number }) {
  const t = useTranslations("dashboard");
  const [dismissed, setDismissed] = useState(false);

  if (days < 14 || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-4 text-sm">
      <p>{t("reminder", { days })}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ms-4 text-neutral-500 underline"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Implement dashboard page**

Create `apps/web/src/app/[locale]/dashboard/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { Link, redirect } from "../../../i18n/navigation";
import { getAuditServices } from "../../../services/container";
import { TrendChart } from "../_components/trend-chart";
import { AuditList } from "../_components/audit-list";
import { ReminderBanner } from "../_components/reminder-banner";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const services = await getAuditServices();
  const cookieStore = await cookies();
  const user = await services.auth.getSessionUser(
    hashToken(cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ""),
  );

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const records = await services.store.listByUser(user.id);

  if (records.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("empty_title")}</h1>
        <p className="text-neutral-600">{t("empty_body")}</p>
        <Link
          href="/#audit-form"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 font-medium text-white"
        >
          {t("empty_cta")}
        </Link>
      </div>
    );
  }

  const latestScore = records[0]?.report?.score?.presence_readiness ?? null;

  const daysSinceLastAudit = Math.floor(
    (Date.now() - new Date(records[0]!.created_at).getTime()) / DAY_MS,
  );

  return (
    <div className="space-y-8 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {latestScore !== null ? (
        <p className="text-lg">{t("score", { score: latestScore })}</p>
      ) : null}
      <TrendChart records={records} locale={locale} />
      <AuditList records={records} locale={locale} />
      <ReminderBanner days={daysSinceLastAudit} />
    </div>
  );
}
```

- [ ] **Step 9: Run all web tests and typecheck**

Run: `pnpm --filter @wpi/web test -- --run && pnpm --filter @wpi/web typecheck`
Expected: All tests pass, typecheck exit 0

- [ ] **Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add dashboard page with trend chart, audit list, and reminder banner"
```

---

### Task 11: Login/signup pages, header, and form redirect

**Files:**

- Create: `apps/web/src/app/[locale]/_components/auth-form.tsx`
- Create: `apps/web/src/app/[locale]/_components/sign-out-button.tsx`
- Create: `apps/web/src/app/[locale]/login/page.tsx`
- Create: `apps/web/src/app/[locale]/signup/page.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/_components/audit-form.tsx`
- Modify: `apps/web/src/app/[locale]/_components/create-audit-client.ts`

**Interfaces:**

- Consumes: auth API routes from Task 9, i18n keys from Task 7
- Produces: `/[locale]/login`, `/[locale]/signup` pages, header auth links, form redirect for signed-in users

- [ ] **Step 1: Implement auth-form.tsx**

Create `apps/web/src/app/[locale]/_components/auth-form.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "../../../i18n/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirm_password") ?? "");

    if (mode === "signup" && password !== confirmPassword) {
      setError(t("error_password_mismatch"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: Record<string, string> = { email, password };
    if (mode === "signup") {
      body["confirm_password"] = confirmPassword;
    }

    let response: Response;
    try {
      response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError(t("error_generic"));
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const responseBody = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(t(`error_${responseBody?.error ?? "generic"}`));
      setSubmitting(false);
      return;
    }

    window.location.assign(`/${locale}/dashboard`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">
        {t(mode === "signup" ? "signup_title" : "login_title")}
      </h1>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t("email_label")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {t("password_label")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      {mode === "signup" ? (
        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium">
            {t("confirm_password_label")}
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting
          ? t(mode === "signup" ? "sign_up" : "sign_in")
          : t(mode === "signup" ? "sign_up" : "sign_in")}
      </button>
      <p className="text-sm text-neutral-600">
        {mode === "signup" ? (
          <>
            {t("have_account")}{" "}
            <Link href="/login" className="underline">
              {t("sign_in")}
            </Link>
          </>
        ) : (
          <>
            {t("need_account")}{" "}
            <Link href="/signup" className="underline">
              {t("sign_up")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Implement sign-out-button.tsx**

Create `apps/web/src/app/[locale]/_components/sign-out-button.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <button type="button" onClick={() => void handleSignOut()} className="text-sm">
      {t("sign_out")}
    </button>
  );
}
```

- [ ] **Step 3: Create login page**

Create `apps/web/src/app/[locale]/login/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import { AuthForm } from "../_components/auth-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthForm mode="login" />;
}
```

- [ ] **Step 4: Create signup page**

Create `apps/web/src/app/[locale]/signup/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import { AuthForm } from "../_components/auth-form";

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthForm mode="signup" />;
}
```

- [ ] **Step 5: Update layout.tsx header**

In `apps/web/src/app/[locale]/layout.tsx`:

1. Add imports:

```typescript
import { cookies } from "next/headers";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { getAuditServices } from "../../services/container";
import { SignOutButton } from "./_components/sign-out-button";
```

2. After `setRequestLocale(locale);` (line 46), add:

```typescript
const services = await getAuditServices();
const cookieStore = await cookies();
const user = await services.auth.getSessionUser(
  hashToken(cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ""),
);
```

3. Replace the header nav `<div>` (lines 60–64) with:

```tsx
<div className="flex gap-4 text-sm">
  <Link href="/methodology">{t("methodology")}</Link>
  <Link href="/privacy">{t("privacy")}</Link>
  <Link href="/terms">{t("terms")}</Link>
  {user ? (
    <>
      <Link href="/dashboard">{t("dashboard")}</Link>
      <span className="max-w-[12rem] truncate text-neutral-500" title={user.email}>
        {user.email}
      </span>
      <SignOutButton />
    </>
  ) : (
    <>
      <Link href="/login">{t("sign_in")}</Link>
      <Link href="/signup" className="rounded-md bg-blue-600 px-3 py-1.5 text-white">
        {t("sign_up")}
      </Link>
    </>
  )}
</div>
```

- [ ] **Step 6: Update audit-form.tsx redirect**

In `apps/web/src/app/[locale]/_components/audit-form.tsx`, change the success branch (lines 45–49):

Old:

```typescript
if (result.ok) {
  window.location.assign(`${result.data.status_url}?s=${encodeURIComponent(result.data.secret)}`);
  return;
}
```

New:

```typescript
if (result.ok) {
  window.location.assign(
    result.data.redirect_url
      ? result.data.redirect_url
      : `${result.data.status_url}?s=${encodeURIComponent(result.data.secret)}`,
  );
  return;
}
```

- [ ] **Step 7: Update create-audit-client.ts**

In `apps/web/src/app/[locale]/_components/create-audit-client.ts`:

1. Add `redirect_url` to `CreateAuditSuccess`:

```typescript
export interface CreateAuditSuccess {
  id: string;
  secret: string;
  status_url: string;
  redirect_url: string | null;
}
```

2. Add validation guard in the 201 branch:

```typescript
if (
  typeof candidate.id === "string" &&
  typeof candidate.secret === "string" &&
  typeof candidate.status_url === "string" &&
  (candidate.redirect_url === null || typeof candidate.redirect_url === "string")
) {
```

- [ ] **Step 8: Run all web tests and typecheck**

Run: `pnpm --filter @wpi/web test -- --run && pnpm --filter @wpi/web typecheck`
Expected: All tests pass, typecheck exit 0

- [ ] **Step 9: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add login/signup pages, header auth links, and form redirect for signed-in users"
```

---

### Task 12: Stub score and e2e account journey

**Files:**

- Modify: `packages/audit-pipeline/src/dispatcher.ts`
- Modify: `packages/audit-pipeline/tests/dispatcher.test.ts`
- Create: `apps/web/e2e/account-journey.spec.ts`

**Interfaces:**

- Consumes: `ScoreResult` from `@wpi/rules-engine`
- Produces: StubDispatcher emits `score: { presence_readiness: 72, ... }` instead of `score: null`

- [ ] **Step 1: Write failing test for stub score**

In `packages/audit-pipeline/tests/dispatcher.test.ts`, add a test inside the existing StubDispatcher describe block:

```typescript
it("emits a stub score with presence_readiness 72", async () => {
  const store = new InMemoryAuditStore();
  const secret = "sha256:" + "a".repeat(64);
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    context: {
      organization: "Test",
      business_type: "saas",
      offering: "Tooling",
      market: "Global",
      customer_language: "English",
      audience: "Developers",
    },
    tier: "preview",
    secretHash: secret,
    ttlDays: 7,
  });
  const dispatcher = new StubDispatcher(store, 0);
  await dispatcher.dispatch(record.id);
  const raw = await store.getRaw(record.id);
  expect(raw?.report?.score?.presence_readiness).toBe(72);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/audit-pipeline && npx vitest run tests/dispatcher.test.ts`
Expected: FAIL — `expected undefined to be 72`

- [ ] **Step 3: Implement stub score in dispatcher.ts**

In `packages/audit-pipeline/src/dispatcher.ts`:

1. Add import at the top:

```typescript
import type { ScoreResult } from "@wpi/rules-engine";
```

2. Before the envelope construction (before line 143), add:

```typescript
const score: ScoreResult = {
  methodology_version: "stub",
  presence_readiness: 72,
  pre_cap_value: 72,
  applied_caps: [],
  categories: [],
  coverage: 0.5,
  confidence: "low",
  unavailable_categories: [],
};
```

3. Change `score: null,` (line 149) to `score,`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/audit-pipeline && npx vitest run tests/dispatcher.test.ts`
Expected: PASS

- [ ] **Step 5: Write e2e account journey test**

Create `apps/web/e2e/account-journey.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

test("signed-in user runs audit and sees score on dashboard", async ({ page }) => {
  const email = `wpi-e2e-${Date.now()}@example.com`;

  await page.goto("/en/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-123");
  await page.getByLabel("Confirm password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Run your first audit" }).click();
  await page.waitForURL(/\/en\/#audit-form/);

  await page.fill("#url", "https://example.com");
  await page.fill("#organization", "E2E Org");
  await page.fill("#business_type", "SaaS");
  await page.fill("#offering", "Email tooling");
  await page.fill("#market", "Global");
  await page.fill("#customer_language", "en");
  await page.fill("#audience", "Marketers");
  await page.click("button[type=submit]");

  await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 });

  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByText("Score: 72").count();
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBeGreaterThan(0);

  await page.getByRole("link", { name: "View report" }).first().click();
  await page.waitForURL(/\/en\/audit\//, { timeout: 15_000 });

  expect(page.url()).not.toContain("?s=");
  await expect(page.getByText("72%").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/en/dashboard");
  await page.waitForURL(/\/en\/login/, { timeout: 10_000 });
});

test("anonymous user sees signup CTA on report", async ({ page }) => {
  await page.goto("/en");
  await page.fill("#url", "https://example.com");
  await page.fill("#organization", "Anon Org");
  await page.fill("#business_type", "SaaS");
  await page.fill("#offering", "Tooling");
  await page.fill("#market", "Global");
  await page.fill("#customer_language", "en");
  await page.fill("#audience", "Developers");
  await page.click("button[type=submit]");

  await page.waitForURL(/\?s=/, { timeout: 15_000 });

  await expect(page.getByText("Sign up to keep reports forever")).toPass({
    timeout: 60_000,
  });
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
```

- [ ] **Step 6: Build all packages**

Run: `pnpm -r build`
Expected: Exit 0

- [ ] **Step 7: Run e2e tests**

Run: `pnpm --filter @wpi/web exec playwright test`
Expected: All e2e tests pass (including the existing `audit-journey.spec.ts`)

- [ ] **Step 8: Commit**

```bash
git add packages/audit-pipeline/ apps/web/
git commit -m "feat: emit stub score and add e2e account journey test"
```

---

### Task 13: Spec fix and full verification

**Files:**

- Modify: `docs/superpowers/specs/2026-10-13-user-accounts-score-tracking-design.md`

- [ ] **Step 1: Fix spec line 150**

The spec says:

> The export-authorization path gains the same owned-access branch.

This is inaccurate — exports stay denied for everyone per D-022. Change line 150 to:

> Exports remain denied for everyone (D-022); owned-access applies to report and status pages only.

- [ ] **Step 2: Run full build**

Run: `pnpm -r build`
Expected: Exit 0

- [ ] **Step 3: Run full typecheck**

Run: `pnpm -r typecheck`
Expected: Exit 0

- [ ] **Step 4: Run full test suite**

Run: `pnpm -r test`
Expected: All tests pass across all packages

- [ ] **Step 5: Optional — run gated Postgres tests**

If a Postgres instance is available:
Run: `WPI_TEST_DATABASE_URL=postgresql://... pnpm -r test`
Expected: Gated tests in `postgres-audit-store.test.ts`, `postgres-ownership.test.ts`, and `pg-auth-service.test.ts` pass

- [ ] **Step 6: Commit spec fix**

```bash
git add docs/superpowers/specs/
git commit -m "docs: clarify export path stays denied per D-022"
```
