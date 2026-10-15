# M9 Production Runtime + Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the WPI web app on fly.io with `WPI_DISPATCH_MODE=in_process`, a managed Postgres database, production secrets, persistent data, release-time migrations, and a database-aware health check.

**Architecture:** The single `apps/web` container reads production secrets from fly.io and runs the audit pipeline in-process against the same Postgres database. Migrations run as a release command before traffic is routed, and `/api/health` confirms the database connection is alive.

**Tech Stack:** Next.js 15 App Router, Node.js 22, pnpm 9.12.0 workspaces, TypeScript 5.6, `pg` 8.x, Vitest, fly.io managed Postgres, fly secrets, Docker multi-stage build.

**Spec:** docs/superpowers/specs/2026-10-14-m9-production-runtime-database-design.md

**Cross-plan coordination:** `apps/web/src/services/container.ts` is touched by all three M9 plans. Implement this plan's Task 1 after the `@wpi/rate-limiter` package exists (rate-limiting Tasks 1-4) so the container can import `InMemoryRateLimiter`. Email notifications will layer `emailService` on top of the same file in email Task 8.

## Global Constraints

- No secrets are committed to the repository; all production credentials live in fly secrets or gitignored local `.env*.local` files.
- `WPI_DISPATCH_MODE=stub` is refused when `NODE_ENV=production`.
- `WPI_DISPATCH_MODE=in_process` requires a real `DATABASE_URL` and `COOKIE_SECRET` before the container attempts to connect.
- All 17 existing migrations (`packages/audit-pipeline/src/migrations/0001-0017.sql`) must apply exactly once and be idempotent on re-run.
- The release command must exit non-zero on migration failure so the deploy stops before serving traffic.
- Local development keeps Docker Postgres parity; no environment-specific SQL files.
- Strict TypeScript with `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- ESM only; package scripts and Node entrypoints use explicit `.js` extensions.
- Follow existing package layout, tsconfig, Vitest, and zod conventions.
- Do not deploy, provision, or spend on production infrastructure without explicit human authorization.

---

### Task 1: Align production environment variable names

**Files:**

- Modify: `packages/oauth/src/encryption.ts:7-17`
- Modify: `packages/audit-pipeline/src/migrations/migrate-cli.ts:7-9`
- Modify: `apps/web/src/services/container.ts:285-339`
- Modify: `apps/web/src/app/api/oauth/google/route.ts:106`
- Modify: `apps/web/src/test/container.test.ts:8,34`
- Modify: `apps/web/playwright.config.ts:14`
- Modify: `apps/web/.env.local` (gitignored local template)
- Modify: `README.md:69-79`
- Test: `packages/oauth/tests/encryption.test.ts`

**Interfaces:**

- Consumes: `process.env.DATABASE_URL`, `process.env.WPI_DATABASE_URL`, `process.env.COOKIE_SECRET`, `process.env.AUDIT_COOKIE_SECRET`, `process.env.ENCRYPTION_KEY`, `process.env.WPI_OAUTH_ENCRYPTION_KEY`
- Produces: normalized production secrets used by `in_process` runtime, migration runner, and OAuth encryption.

- [ ] **Step 1: Write the failing test**
      Replace `packages/oauth/tests/encryption.test.ts` so it expects the new `ENCRYPTION_KEY` (32-byte hex) and the legacy `WPI_OAUTH_ENCRYPTION_KEY` (base64) fallback.

  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { encrypt, decrypt } from "../src/encryption.js";

  const HEX_KEY = Buffer.alloc(32, "a").toString("hex");
  const B64_KEY = Buffer.alloc(32, "a").toString("base64");

  describe("encryption", () => {
    beforeEach(() => {
      process.env["ENCRYPTION_KEY"] = HEX_KEY;
    });

    afterEach(() => {
      delete process.env["ENCRYPTION_KEY"];
      delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
    });

    it("encrypts and decrypts plaintext with ENCRYPTION_KEY (hex)", () => {
      const plaintext = "test-access-token";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("falls back to WPI_OAUTH_ENCRYPTION_KEY (base64)", () => {
      delete process.env["ENCRYPTION_KEY"];
      process.env["WPI_OAUTH_ENCRYPTION_KEY"] = B64_KEY;
      const plaintext = "test-access-token";
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it("produces different ciphertexts for same plaintext (random IV)", () => {
      const plaintext = "test-access-token";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it("throws if encryption key is missing", () => {
      delete process.env["ENCRYPTION_KEY"];
      delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY (or WPI_OAUTH_ENCRYPTION_KEY) environment variable is required",
      );
    });

    it("throws if ENCRYPTION_KEY is wrong length", () => {
      process.env["ENCRYPTION_KEY"] = Buffer.alloc(16, "a").toString("hex");
      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)",
      );
    });

    it("decrypt throws on tampered ciphertext", () => {
      const encrypted = encrypt("test-token");
      encrypted[20] = (encrypted[20]! + 1) % 256;
      expect(() => decrypt(encrypted)).toThrow();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  pnpm --filter @wpi/oauth test
  ```

  Expected: FAIL — tests using `ENCRYPTION_KEY` throw because `packages/oauth/src/encryption.ts` still only reads `WPI_OAUTH_ENCRYPTION_KEY`.

- [ ] **Step 3: Write minimal implementation**
  1. Replace `packages/oauth/src/encryption.ts` with the dual-source implementation:
     ```ts
     import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

     const ALGORITHM = "aes-256-gcm";
     const IV_LENGTH = 12;
     const AUTH_TAG_LENGTH = 16;

     function getEncryptionKey(): Buffer {
       const hexKey = process.env["ENCRYPTION_KEY"];
       if (hexKey) {
         const keyBuffer = Buffer.from(hexKey, "hex");
         if (keyBuffer.length !== 32) {
           throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)");
         }
         return keyBuffer;
       }

       const b64Key = process.env["WPI_OAUTH_ENCRYPTION_KEY"];
       if (b64Key) {
         const keyBuffer = Buffer.from(b64Key, "base64");
         if (keyBuffer.length !== 32) {
           throw new Error("WPI_OAUTH_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
         }
         return keyBuffer;
       }

       throw new Error(
         "ENCRYPTION_KEY (or WPI_OAUTH_ENCRYPTION_KEY) environment variable is required",
       );
     }

     export function encrypt(plaintext: string): Buffer {
       const key = getEncryptionKey();
       const iv = randomBytes(IV_LENGTH);
       const cipher = createCipheriv(ALGORITHM, key, iv);

       const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
       const authTag = cipher.getAuthTag();

       return Buffer.concat([iv, authTag, encrypted]);
     }

     export function decrypt(encrypted: Buffer): string {
       const key = getEncryptionKey();
       const iv = encrypted.subarray(0, IV_LENGTH);
       const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
       const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

       const decipher = createDecipheriv(ALGORITHM, key, iv);
       decipher.setAuthTag(authTag);

       const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

       return decrypted.toString("utf8");
     }
     ```
  2. Update `packages/audit-pipeline/src/migrations/migrate-cli.ts` to read `DATABASE_URL` first, falling back to `WPI_DATABASE_URL`:
     ```ts
     import { resolve } from "node:path";
     import { pathToFileURL } from "node:url";
     import { Pool } from "pg";
     import { applyMigrations } from "./migrate.js";

     async function main(): Promise<void> {
       const connectionString = process.env["DATABASE_URL"] ?? process.env["WPI_DATABASE_URL"];
       if (!connectionString) {
         throw new Error("DATABASE_URL (or WPI_DATABASE_URL) is required to run migrations");
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
  3. Update `apps/web/src/services/container.ts` to read `DATABASE_URL`/`COOKIE_SECRET` with legacy fallbacks and fail fast in `in_process` mode.
     - Replace the `RateLimiter` import from `@wpi/auth` with:
       ```ts
       import { InMemoryRateLimiter } from "@wpi/rate-limiter";
       ```
     - Add two helpers near the top of `buildServices`:
       ```ts
       function readDatabaseUrl(): string | undefined {
         return process.env["DATABASE_URL"] ?? process.env["WPI_DATABASE_URL"];
       }

       function readCookieSecret(): string | undefined {
         return process.env["COOKIE_SECRET"] ?? process.env["AUDIT_COOKIE_SECRET"];
       }
       ```
     - Then replace the `buildServices` body from the dispatch-mode read through the `in_process` guard with:
     ```ts
     async function buildServices(): Promise<AuditServices> {
       const dispatchMode = process.env["WPI_DISPATCH_MODE"] ?? "stub";

       if (process.env["NODE_ENV"] === "production" && dispatchMode === "stub") {
         throw new Error(
           "Refusing to start with WPI_DISPATCH_MODE=stub in production. Set WPI_DISPATCH_MODE=in_process or WPI_DISPATCH_MODE=memory.",
         );
       }

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
           cookieSecret: readCookieSecret() ?? "stub-cookie-secret",
           auth: new InMemoryAuthService(),
           rateLimiter: new InMemoryRateLimiter(),
         };
       }

       const databaseUrl = readDatabaseUrl();
       const cookieSecret = readCookieSecret();

       if (dispatchMode === "memory") {
         const store = new InMemoryAuditStore();
         const fields: PipelineFields = {
           store,
           tierScopes: loadTierScopes(join(REPO_ROOT, "config", "anonymous-eligibility.yaml")),
           validateUrl: async (url) => localValidateUrl(url),
           outputDir,
           geminiApiKey: process.env["GEMINI_API_KEY"],
         };
         return {
           ...fields,
           cookieSecret: cookieSecret ?? "demo-cookie-secret",
           dispatcher: new StubDispatcher(store),
           auth: new InMemoryAuthService(),
           rateLimiter: new InMemoryRateLimiter(),
         };
       }

       if (databaseUrl === undefined || cookieSecret === undefined) {
         throw new Error(
           "DATABASE_URL and COOKIE_SECRET are required when WPI_DISPATCH_MODE=in_process",
         );
       }

       const pool = new Pool({ connectionString: databaseUrl });
       await applyMigrations(pool);
       const store = new PostgresAuditStore(pool);
       await store.sweepExpired();
       const tokenStore = new TokenStore(pool);

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
         tokenStore,
         pool,
       };

       return {
         ...fields,
         dispatcher: new InProcessDispatcher(async (jobId) => {
           await runAuditPipeline(buildPipeline(fields), jobId);
         }),
         cookieSecret,
         auth: new PgAuthService(pool),
         rateLimiter: new InMemoryRateLimiter(),
       };
     }
     ```
  4. Update `apps/web/src/app/api/oauth/google/route.ts` line 106 to:
     ```ts
     const databaseUrl = process.env["DATABASE_URL"] ?? process.env["WPI_DATABASE_URL"];
     ```
  5. Update `apps/web/src/test/container.test.ts` to clear the new names and assert on `DATABASE_URL`:
     ```ts
     import { afterEach, describe, expect, it } from "vitest";
     import { InMemoryAuditStore } from "@wpi/audit-pipeline";
     import { getAuditServices, setAuditServicesForTests } from "../services/container";

     const ENV_KEYS = [
       "WPI_DISPATCH_MODE",
       "COOKIE_SECRET",
       "DATABASE_URL",
       "WPI_DATABASE_URL",
       "AUDIT_COOKIE_SECRET",
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
         await expect(getAuditServices()).rejects.toThrow(/DATABASE_URL/);
       });
     });
     ```
  6. Update `apps/web/playwright.config.ts` to use `COOKIE_SECRET`:
     ```ts
     env: {
       WPI_DISPATCH_MODE: "stub",
       COOKIE_SECRET: "e2e-cookie-secret",
       PORT: "3100",
     },
     ```
  7. Update the local template `apps/web/.env.local`:
     ```bash
     # WPI Local Development Environment

     # Audit pipeline
     WPI_DISPATCH_MODE=in_process
     DATABASE_URL=postgres://stratum:stratum_secure_password_2024@localhost:5432/wpi_dev
     COOKIE_SECRET=2e82ce552a2ad52e10e187f867f3350dcee2fd40e2bc0f439b95e7ca89ad070b

     # OAuth token encryption (32 bytes as 64 hex characters)
     ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

     # Google OAuth (fill in after creating Google Cloud project)
     GOOGLE_OAUTH_CLIENT_ID=PLACEHOLDER_GOOGLE_OAUTH_CLIENT_ID
     GOOGLE_OAUTH_CLIENT_SECRET=PLACEHOLDER_GOOGLE_OAUTH_CLIENT_SECRET

     # App URL (used for OAuth callback redirect)
     NEXT_PUBLIC_APP_URL=http://localhost:3000
     ```
  8. Update the environment table in `README.md`:
     ```markdown
     | Variable                | Required                            | Purpose                                                                                               |
     | ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
     | `WPI_DISPATCH_MODE`     | no (default `stub`)                 | `stub` runs a deterministic no-network pipeline; `in_process` runs the real pipeline against Postgres |
     | `DATABASE_URL`          | yes unless `WPI_DISPATCH_MODE=stub` | Postgres connection string for the audit store (legacy `WPI_DATABASE_URL` still works)                |
     | `COOKIE_SECRET`         | yes unless `WPI_DISPATCH_MODE=stub` | HMAC secret for the signed eligibility cookie (legacy `AUDIT_COOKIE_SECRET` still works)              |
     | `ENCRYPTION_KEY`        | yes for OAuth token storage         | 32-byte hex AES-256-GCM key for OAuth tokens (legacy `WPI_OAUTH_ENCRYPTION_KEY` base64 still works)   |
     | `WPI_GEMINI_API_KEY`    | no                                  | Enables the agent stage                                                                               |
     | `WPI_OUTPUT_DIR`        | no (default `./output`)             | Crawler/evidence output directory                                                                     |
     | `WPI_TEST_DATABASE_URL` | no                                  | Enables the Postgres-backed test suites                                                               |
     ```
     Also change the setup example command to:
     ```bash
     DATABASE_URL="postgres://localhost:5432/wpi_dev" pnpm --filter @wpi/audit-pipeline exec wpi-migrate
     ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  pnpm --filter @wpi/oauth test
  pnpm typecheck
  pnpm test
  ```

  Expected: PASS — `packages/oauth` tests pass, root typecheck is clean, and the container test rejects `in_process` without `DATABASE_URL`.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/oauth/src/encryption.ts packages/oauth/tests/encryption.test.ts
  git add packages/audit-pipeline/src/migrations/migrate-cli.ts
  git add apps/web/src/services/container.ts apps/web/src/app/api/oauth/google/route.ts
  git add apps/web/src/test/container.test.ts apps/web/playwright.config.ts
  git add apps/web/.env.local README.md
  git commit -m "$(cat <<'EOF'
     Align production secrets with spec names (DATABASE_URL, COOKIE_SECRET, ENCRYPTION_KEY)

     - OAuth encryption now prefers ENCRYPTION_KEY (hex) and falls back to
       WPI_OAUTH_ENCRYPTION_KEY (base64).
     - Migration runner and web container now read DATABASE_URL/COOKIE_SECRET
       with legacy fallbacks.
     - Boot guard rejects in_process mode without DATABASE_URL.
     EOF
  )"
  ```

---

### Task 2: Make migrations runnable in the production Docker image

**Files:**

- Modify: `packages/audit-pipeline/src/migrations/migrate.ts:29-32`
- Modify: `packages/audit-pipeline/package.json:8-12`
- Modify: `Dockerfile`
- Modify: `fly.toml`
- Create: `packages/audit-pipeline/tests/migrate-dir.test.ts`

**Interfaces:**

- Consumes: `process.env.WPI_MIGRATIONS_DIR`, `DATABASE_URL`
- Produces: release-time migration command, Docker image with migration artifacts, fly.toml deploy configuration.

- [ ] **Step 1: Write the failing test**
      Create `packages/audit-pipeline/tests/migrate-dir.test.ts`:

  ```ts
  import { mkdtemp, writeFile } from "node:fs/promises";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { afterAll, beforeAll, describe, expect, it } from "vitest";
  import { Pool } from "pg";
  import { applyMigrations } from "../src/migrations/migrate.js";

  const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

  describe.skipIf(!DATABASE_URL)("applyMigrations WPI_MIGRATIONS_DIR override", () => {
    let pool: Pool;
    let migrationsDir: string;

    beforeAll(async () => {
      pool = new Pool({ connectionString: DATABASE_URL });
      migrationsDir = await mkdtemp(join(tmpdir(), "wpi-migrations-"));
      await writeFile(
        join(migrationsDir, "0001_test.sql"),
        "CREATE TABLE IF NOT EXISTS migration_dir_test (id serial PRIMARY KEY);",
      );
      await pool.query("DROP TABLE IF EXISTS migration_dir_test");
      await pool.query("DROP TABLE IF EXISTS schema_migrations");
      process.env["WPI_MIGRATIONS_DIR"] = migrationsDir;
    });

    afterAll(async () => {
      delete process.env["WPI_MIGRATIONS_DIR"];
      await pool.query("DROP TABLE IF EXISTS migration_dir_test");
      await pool.end();
    });

    it("applies migrations from the directory in WPI_MIGRATIONS_DIR", async () => {
      const result = await applyMigrations(pool);
      expect(result.applied).toContain("0001_test.sql");
      const check = await pool.query("SELECT 1 FROM migration_dir_test");
      expect(check.rowCount).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  WPI_TEST_DATABASE_URL="postgres://localhost:5432/wpi_test" pnpm --filter @wpi/audit-pipeline test
  ```

  Expected: FAIL — `applyMigrations` ignores `WPI_MIGRATIONS_DIR`, so the temp `0001_test.sql` migration is not applied.

- [ ] **Step 3: Write minimal implementation**
  1. Update `packages/audit-pipeline/src/migrations/migrate.ts` so the default migrations directory honors `WPI_MIGRATIONS_DIR`:
     ```ts
     export async function applyMigrations(
       pool: Pool,
       migrationsDir: string = process.env["WPI_MIGRATIONS_DIR"] ?? MIGRATIONS_DIR,
     ): Promise<MigrationResult> {
       // ... existing body unchanged
     }
     ```
  2. Add the production migration script to `packages/audit-pipeline/package.json`:
     ```json
     {
       "scripts": {
         "build": "tsc",
         "test": "vitest run",
         "typecheck": "tsc --noEmit",
         "migrate:prod": "node ./dist/migrations/migrate-cli.js"
       }
     }
     ```
  3. Replace `Dockerfile` with a build that compiles `@wpi/audit-pipeline` and copies migration artifacts into the runner:
     ```dockerfile
     # Build stage
     FROM node:22-alpine AS builder
     RUN apk add --no-cache libc6-compat
     RUN corepack enable
     WORKDIR /app

     # Copy entire monorepo
     COPY . .

     # Copy config files into apps/web/config for the build
     COPY config ./apps/web/config

     # Install all workspace dependencies
     RUN pnpm install --frozen-lockfile

     # Build Next.js app and the audit-pipeline migration package
     RUN pnpm --filter @wpi/web build
     RUN pnpm --filter @wpi/audit-pipeline build

     # Production runner
     FROM node:22-alpine AS runner
     WORKDIR /app

     ENV NODE_ENV=production

     RUN addgroup --system --gid 1001 nodejs
     RUN adduser --system --uid 1001 nextjs

     # Copy the standalone output (preserves apps/web layout) and static assets
     COPY --from=builder /app/apps/web/.next/standalone ./
     COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

     # Copy migration artifacts so the release command can run migrations
     COPY --from=builder /app/packages/audit-pipeline/package.json ./packages/audit-pipeline/package.json
     COPY --from=builder /app/packages/audit-pipeline/dist ./packages/audit-pipeline/dist
     COPY --from=builder /app/packages/audit-pipeline/src/migrations ./packages/audit-pipeline/src/migrations

     RUN chown -R nextjs:nodejs /app

     USER nextjs

     EXPOSE 3000

     ENV HOSTNAME="0.0.0.0"

     CMD ["node", "apps/web/server.js"]
     ```
  4. Replace `fly.toml` with the production runtime configuration:
     ```toml
     # fly.toml app configuration file generated for wpi-web-delicate-dawn-7818 on 2026-10-14T11:29:09+03:00
     #
     # See https://fly.io/docs/reference/configuration/ for information about how to use this file.
     #

     app = 'wpi-web-delicate-dawn-7818'
     primary_region = 'fra'

     [env]
       WPI_DISPATCH_MODE = 'in_process'
       WPI_MIGRATIONS_DIR = '/app/packages/audit-pipeline/src/migrations'

     [deploy]
       release_command = "node packages/audit-pipeline/dist/migrations/migrate-cli.js"

     [build]
     [http_service]
       internal_port = 3000
       force_https = true
       auto_stop_machines = 'stop'
       auto_start_machines = true
       min_machines_running = 0
       processes = ['app']

     [[services]]
       protocol = 'tcp'
       internal_port = 3000
       processes = ['app']

       [[services.ports]]
         port = 80
         handlers = ['http']
         force_https = true

       [[services.ports]]
         port = 443
         handlers = ['tls', 'http']

       [[services.http_checks]]
         interval = "15s"
         timeout = "5s"
         grace_period = "10s"
         method = "get"
         path = "/api/health"
         protocol = "http"

       [services.concurrency]
         type = 'requests'
         hard_limit = 250
         soft_limit = 200

     [[vm]]
       memory = '1gb'
       cpus = 1
       memory_mb = 1024
     ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  WPI_TEST_DATABASE_URL="postgres://localhost:5432/wpi_test" pnpm --filter @wpi/audit-pipeline test
  ```

  Expected: PASS — the new test confirms migrations are loaded from `WPI_MIGRATIONS_DIR`.

  Then validate the Docker build locally:

  ```bash
  docker build -t wpi-web-m9 -f Dockerfile .
  ```

  Expected: image builds successfully and the final layer contains `/app/packages/audit-pipeline/dist/migrations/migrate-cli.js` and `/app/packages/audit-pipeline/src/migrations`.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audit-pipeline/src/migrations/migrate.ts
  git add packages/audit-pipeline/package.json
  git add packages/audit-pipeline/tests/migrate-dir.test.ts
  git add Dockerfile fly.toml
  git commit -m "$(cat <<'EOF'
     Make migrations runnable as a release command in the production image

     - applyMigrations honors WPI_MIGRATIONS_DIR.
     - Adds migrate:prod script and copies migration artifacts into the Docker runner.
     - fly.toml switches to in_process and runs migrations before app start.
     EOF
  )"
  ```

---

### Task 3: Add /api/health route and fly.io health check

**Files:**

- Create: `apps/web/src/app/api/health/route.ts`
- Create: `apps/web/src/app/api/health/route.test.ts`
- Modify: `fly.toml` (already updated in Task 2; verify `[[services.http_checks]]`)

**Interfaces:**

- Consumes: `getAuditServices()` from `apps/web/src/services/container.ts`
- Produces: `GET /api/health` returning `{ status: "ok" }` after confirming the database connection.

- [ ] **Step 1: Write the failing test**
      Create `apps/web/src/app/api/health/route.test.ts`:

  ```ts
  import { describe, it, expect, afterEach } from "vitest";
  import { NextRequest } from "next/server";
  import { GET } from "./route";
  import { setAuditServicesForTests, type AuditServices } from "../../../../services/container";

  afterEach(() => {
    setAuditServicesForTests(null);
  });

  describe("GET /api/health", () => {
    it("returns 200 ok without a database pool", async () => {
      const response = await GET(new NextRequest("http://localhost:3000/api/health"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });

    it("pings the database when a pool is available", async () => {
      let pinged = false;
      const fakeServices = {
        pool: {
          query: async (sql: string) => {
            pinged = true;
            expect(sql).toBe("SELECT 1");
            return { rows: [{ one: 1 }] };
          },
        },
      } as unknown as AuditServices;

      setAuditServicesForTests(fakeServices);

      const response = await GET(new NextRequest("http://localhost:3000/api/health"));
      expect(response.status).toBe(200);
      expect(pinged).toBe(true);
      expect(await response.json()).toEqual({ status: "ok" });
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  pnpm --filter @wpi/web test
  ```

  Expected: FAIL — `apps/web/src/app/api/health/route.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**
      Create `apps/web/src/app/api/health/route.ts`:

  ```ts
  import { NextResponse, type NextRequest } from "next/server";
  import { getAuditServices } from "../../../services/container";

  export const runtime = "nodejs";

  export async function GET(_request: NextRequest): Promise<NextResponse> {
    const services = await getAuditServices();
    if (services.pool) {
      await services.pool.query("SELECT 1");
    }
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  pnpm --filter @wpi/web test
  ```

  Expected: PASS — both health route tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/src/app/api/health/route.ts apps/web/src/app/api/health/route.test.ts
  git commit -m "$(cat <<'EOF'
     Add database-aware /api/health route

     - Health check returns 200 {status: ok} and pings the Postgres pool
       when running in in_process mode.
     - fly.io HTTP health check already configured in Task 2.
     EOF
  )"
  ```

---

### Task 4: Provision fly.io Postgres and set production secrets

**Files:**

- No tracked file changes (all operations are fly.io dashboard/CLI state).
- Record evidence in: `intent/INT-03-m9-production-readiness/release.md` after the deploy succeeds.

**Interfaces:**

- Consumes: fly.io CLI access and authorized production credentials.
- Produces: managed Postgres cluster `wpi-web-db`, attached `DATABASE_URL`, and encrypted fly secrets.

- [ ] **Step 1: Provision the production database**

  ```bash
  flyctl postgres create \
    --name wpi-web-db \
    --region fra \
    --vm-size shared-cpu-1x \
    --volume-size 10
  ```

  Expected: cluster `wpi-web-db` is created in region `fra`.

- [ ] **Step 2: Attach the database to the web app**

  ```bash
  flyctl postgres attach wpi-web-db --app wpi-web-delicate-dawn-7818
  ```

  Expected: `DATABASE_URL` is added to the app secrets automatically.

- [ ] **Step 3: Set the remaining production secrets**
      Export the real values in your shell first, then run:

  ```bash
  flyctl secrets set \
    DATABASE_URL="$DATABASE_URL" \
    ENCRYPTION_KEY="$(openssl rand -hex 32)" \
    COOKIE_SECRET="$(openssl rand -hex 32)" \
    GOOGLE_OAUTH_CLIENT_ID="$GOOGLE_OAUTH_CLIENT_ID" \
    GOOGLE_OAUTH_CLIENT_SECRET="$GOOGLE_OAUTH_CLIENT_SECRET" \
    RESEND_API_KEY="$RESEND_API_KEY" \
    TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY" \
    --app wpi-web-delicate-dawn-7818
  ```

  Expected: fly.io reports the secrets were set and will be available to the next deploy.

- [ ] **Step 4: Verify secrets are registered**

  ```bash
  flyctl secrets list --app wpi-web-delicate-dawn-7818
  ```

  Expected: `DATABASE_URL`, `ENCRYPTION_KEY`, `COOKIE_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `RESEND_API_KEY`, and `TURNSTILE_SECRET_KEY` are all listed.

- [ ] **Step 5: Validate the fly configuration**
  ```bash
  flyctl config validate --app wpi-web-delicate-dawn-7818
  ```
  Expected: `fly.toml` validates without errors.

---

### Task 5: Deploy and verify persistence

**Files:**

- Record evidence in: `intent/INT-03-m9-production-readiness/release.md`

**Interfaces:**

- Consumes: CI pipeline, fly.io deploy, production database.
- Produces: deployed production app with persistent data.

- [ ] **Step 1: Run pre-deploy checks locally**

  ```bash
  pnpm typecheck
  pnpm test
  pnpm --filter @wpi/web build
  pnpm --filter @wpi/audit-pipeline build
  DATABASE_URL="postgres://localhost:5432/wpi_dev" pnpm --filter @wpi/audit-pipeline migrate:prod
  ```

  Expected: all commands exit 0 and the local migration run reports the 17 migrations applied (or already present).

- [ ] **Step 2: Confirm the local migration idempotency**

  ```bash
  DATABASE_URL="postgres://localhost:5432/wpi_dev" pnpm --filter @wpi/audit-pipeline migrate:prod
  ```

  Expected: second run reports `Applied 0 migration(s): none`.

- [ ] **Step 3: Deploy to fly.io**

  ```bash
  flyctl deploy --app wpi-web-delicate-dawn-7818
  ```

  Expected: release command runs migrations, the container starts, and the deploy reports success.

- [ ] **Step 4: Run post-deploy health and persistence checks**

  ```bash
  curl -sf https://wpi-web-delicate-dawn-7818.fly.dev/api/health
  ```

  Expected: returns `{"status":"ok"}` with HTTP 200.

  Then verify data survives a redeploy:
  1. Sign up a test user via the production UI and note the email.
  2. Connect to the production database:
     ```bash
     flyctl postgres connect --app wpi-web-db --command "SELECT email FROM users WHERE email = 'test-user@example.com';"
     ```
     Expected: the user row exists.
  3. Submit an audit and note its ID.
  4. Confirm the audit row:
     ```bash
     flyctl postgres connect --app wpi-web-db --command "SELECT id, status FROM audits WHERE id = '<audit-id>';"
     ```
     Expected: the audit row exists with status `QUEUED` or later.
  5. Redeploy:
     ```bash
     flyctl deploy --app wpi-web-delicate-dawn-7818
     ```
  6. Sign out and sign back in; the session should persist.
  7. Re-run the user/audit queries; the rows should still exist.

- [ ] **Step 5: Record the phase report**
      Append the evidence to `intent/INT-03-m9-production-readiness/release.md`:
  - commands run and their outputs (typecheck, tests, deploy, health curl, DB queries),
  - files changed,
  - secrets source (fly secrets, none in repo),
  - rollback procedure (redeploy previous image via `flyctl deploy --image <ref>` or restore from fly.io volume snapshot).

---

## Self-review

- **Spec coverage:** Postgres provisioning, secrets, `WPI_DISPATCH_MODE=in_process`, release-time migrations via `migrate:prod`, `/api/health`, Docker/runtime changes, pre/post-deploy verification, and rollback are all covered.
- **Placeholder scan:** No `TBD`, `TODO`, or `implement later`. Secret values are supplied via shell variables or `openssl rand`; concrete commands are provided.
- **Type consistency:** All new/modified files use strict TypeScript, `import type` for type-only imports, and match the existing ESM workspace conventions.

### Critical Files for Implementation

- `/Users/ibrahimabedrabboh/Qoder/Qoder/apps/web/src/services/container.ts`
- `/Users/ibrahimabedrabboh/Qoder/Qoder/packages/audit-pipeline/src/migrations/migrate-cli.ts`
- `/Users/ibrahimabedrabboh/Qoder/Qoder/packages/audit-pipeline/src/migrations/migrate.ts`
- `/Users/ibrahimabedrabboh/Qoder/Qoder/packages/oauth/src/encryption.ts`
- `/Users/ibrahimabedrabboh/Qoder/Qoder/fly.toml`
