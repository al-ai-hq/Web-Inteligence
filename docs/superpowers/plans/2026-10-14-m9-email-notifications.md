# M9 Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small, testable `@wpi/email` package with Resend and stub adapters plus bilingual EN/AR templates, and wire audit-completion and password-reset emails asynchronously into the web app.

**Architecture:** A new `@wpi/email` package exposes a port (`EmailService`) and two adapters: `ResendEmailService` for production and `StubEmailService` for tests/local dev. Plain-text/HTML templates live under `src/templates/` with per-locale modules. `apps/web/src/services/container.ts` builds the chosen adapter and injects it into the audit-pipeline `onComplete` hook and the new `/api/auth/forgot-password` and `/api/auth/reset-password` routes. Password-reset tokens are hashed and short-lived in a new `password_reset_tokens` table managed by `@wpi/auth`.

**Tech Stack:** TypeScript 5.6, Node.js 22, pnpm 9.12.0 workspaces, Vitest, Next.js 15 App Router, `pg`, `zod`, Resend (HTTPS `fetch`), next-intl, Tailwind v4.

**Spec:** docs/superpowers/specs/2026-10-14-m9-email-notifications-design.md

**Cross-plan coordination:** `apps/web/src/services/container.ts` is touched by all three M9 plans. Implement this plan's Task 8 after production runtime Task 1 and rate-limiting Task 5 have landed, so `emailService` is added on top of the already-migrated `InMemoryRateLimiter` container.

## Global Constraints

- Add a small, testable email abstraction (`@wpi/email`) with a Resend adapter and bilingual EN/AR templates. Send audit-completion and password-reset emails asynchronously from the web app without blocking API responses.
- Provider: Resend; free tier covers pilot. `EMAIL_FROM_ADDRESS` must be a domain verified in Resend before pilot launch.
- Template format: plain text + minimal HTML; bilingual copy.
- Async strategy: fire-and-forget Promise; no external queue for pilot.
- Weekly digest is deferred to M10.
- Email bodies never include the raw report JSON or attachments (D-002).
- Reset tokens are single-use, hashed, and short-lived (15 minutes).
- Do not log email bodies or reset tokens.
- No secrets are committed to the repository; credentials live in fly secrets or gitignored local `.env*.local` files.
- Strict TypeScript with `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- ESM only; package scripts and Node entrypoints use explicit `.js` extensions.
- Follow existing package layout, tsconfig, Vitest, zod, migration SQL naming, API route structure, and i18n key conventions.
- Do not deploy, provision, or spend on production infrastructure without explicit human authorization.

---

### Task 1: Create the `@wpi/email` package skeleton

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/vitest.config.ts`
- Create: `packages/email/src/index.ts`
- Create: `packages/email/src/types.ts`
- Modify: `tsconfig.json` (root project references)

**Interfaces:**
- Consumes: none
- Produces: `@wpi/email` workspace package exporting `EmailService`, `EmailLocale`, `SendEmailRequest`, `EmailSendError`

- [ ] **Step 1: Write the failing test**
  Create `packages/email/tests/types.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { EmailSendError, type EmailLocale, type SendEmailRequest } from "../src/index.js";

  describe("@wpi/email public API", () => {
    it("exports the EmailLocale union", () => {
      const locale: EmailLocale = "en";
      expect(locale).toBe("en");
    });

    it("exports a typed EmailSendError", () => {
      const error = new EmailSendError("boom", new Error("cause"));
      expect(error.name).toBe("EmailSendError");
      expect(error.message).toBe("boom");
      expect(error.cause).toBeInstanceOf(Error);
    });

    it("SendEmailRequest accepts the required fields", () => {
      const request: SendEmailRequest = {
        to: "user@example.com",
        subject: "subject",
        html: "<p>html</p>",
        text: "text",
        locale: "ar",
      };
      expect(request.locale).toBe("ar");
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: FAIL — `packages/email/src/index.ts` does not exist, so Vitest cannot resolve imports.

- [ ] **Step 3: Write minimal implementation**
  1. Create `packages/email/package.json`:
     ```json
     {
       "name": "@wpi/email",
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
  2. Create `packages/email/tsconfig.json`:
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
  3. Create `packages/email/vitest.config.ts`:
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
  4. Create `packages/email/src/types.ts`:
     ```ts
     export type EmailLocale = "en" | "ar";

     export interface SendEmailRequest {
       to: string;
       subject: string;
       html: string;
       text: string;
       locale: EmailLocale;
     }

     export interface EmailService {
       send(request: SendEmailRequest): Promise<{ id?: string }>;
     }

     export class EmailSendError extends Error {
       constructor(
         message: string,
         public readonly cause?: unknown,
       ) {
         super(message);
         this.name = "EmailSendError";
       }
     }
     ```
  5. Create `packages/email/src/index.ts`:
     ```ts
     export type { EmailLocale, SendEmailRequest, EmailService } from "./types.js";
     export { EmailSendError } from "./types.js";
     ```
  6. Add the package to root project references in `tsconfig.json`:
     ```json
     {
       "files": [],
       "references": [
         { "path": "packages/core" },
         { "path": "packages/contracts" },
         { "path": "packages/config-loaders" },
         { "path": "packages/test-utils" },
         { "path": "packages/calibration" },
         { "path": "packages/email" },
         { "path": "services/crawler" },
         { "path": "services/agents" },
         { "path": "services/connectors" },
         { "path": "apps/web" }
       ]
     }
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @wpi/email test
  ```
  Expected: PASS — `types.test.ts` runs and the public API tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/email tsconfig.json pnpm-lock.yaml
  git commit -m "Add @wpi/email package skeleton and shared types"
  ```

---

### Task 2: Implement the stub email adapter

**Files:**
- Create: `packages/email/src/stub-adapter.ts`
- Modify: `packages/email/src/index.ts`
- Modify: `packages/email/tests/types.test.ts` → rename/extend into `packages/email/tests/email-service.test.ts`

**Interfaces:**
- Consumes: `SendEmailRequest`
- Produces: `StubEmailService`

- [ ] **Step 1: Write the failing test**
  Replace `packages/email/tests/types.test.ts` with `packages/email/tests/email-service.test.ts`:
  ```ts
  import { describe, expect, it, beforeEach } from "vitest";
  import { StubEmailService } from "../src/index.js";
  import type { SendEmailRequest } from "../src/index.js";

  describe("StubEmailService", () => {
    let service: StubEmailService;

    beforeEach(() => {
      service = new StubEmailService();
    });

    it("captures sent emails", async () => {
      const request: SendEmailRequest = {
        to: "user@example.com",
        subject: "subject",
        html: "<p>html</p>",
        text: "text",
        locale: "en",
      };

      const result = await service.send(request);

      expect(result.id).toBe("stub-email-id");
      expect(service.getSent()).toEqual([request]);
    });

    it("isolation between instances", async () => {
      const other = new StubEmailService();
      await service.send({
        to: "a@example.com",
        subject: "s",
        html: "h",
        text: "t",
        locale: "en",
      });
      expect(other.getSent()).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: FAIL — `StubEmailService` is not exported from `@wpi/email`.

- [ ] **Step 3: Write minimal implementation**
  1. Create `packages/email/src/stub-adapter.ts`:
     ```ts
     import type { EmailService, SendEmailRequest } from "./types.js";

     export class StubEmailService implements EmailService {
       private readonly sent: SendEmailRequest[] = [];

       async send(request: SendEmailRequest): Promise<{ id?: string }> {
         this.sent.push(request);
         return { id: "stub-email-id" };
       }

       getSent(): SendEmailRequest[] {
         return [...this.sent];
       }

       clear(): void {
         this.sent.length = 0;
       }
     }
     ```
  2. Export it from `packages/email/src/index.ts`:
     ```ts
     export type { EmailLocale, SendEmailRequest, EmailService } from "./types.js";
     export { EmailSendError } from "./types.js";
     export { StubEmailService } from "./stub-adapter.js";
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: PASS — stub adapter tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/email
  git commit -m "Add stub email adapter for tests and local dev"
  ```

---

### Task 3: Implement the Resend email adapter

**Files:**
- Create: `packages/email/src/resend-adapter.ts`
- Modify: `packages/email/src/index.ts`
- Modify: `packages/email/tests/email-service.test.ts`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` (via factory), `SendEmailRequest`
- Produces: `ResendEmailService`, `createResendEmailService()`

- [ ] **Step 1: Write the failing test**
  Append to `packages/email/tests/email-service.test.ts`:
  ```ts
  import { describe, expect, it, vi, afterEach } from "vitest";
  import { ResendEmailService, EmailSendError } from "../src/index.js";

  describe("ResendEmailService", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("calls the Resend API and returns the message id", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "resend-msg-id" }), { status: 200 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const service = new ResendEmailService({ apiKey: "re_test", from: "from@example.com" });
      const result = await service.send({
        to: "to@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
        locale: "en",
      });

      expect(result.id).toBe("resend-msg-id");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer re_test",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            from: "from@example.com",
            to: "to@example.com",
            subject: "Hello",
            html: "<p>Hello</p>",
            text: "Hello",
          }),
        }),
      );
    });

    it("throws EmailSendError on Resend failure", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const service = new ResendEmailService({ apiKey: "re_test", from: "from@example.com" });

      await expect(
        service.send({
          to: "to@example.com",
          subject: "Hello",
          html: "<p>Hello</p>",
          text: "Hello",
          locale: "en",
        }),
      ).rejects.toThrow(EmailSendError);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: FAIL — `ResendEmailService` and `createResendEmailService` are not defined.

- [ ] **Step 3: Write minimal implementation**
  1. Create `packages/email/src/resend-adapter.ts`:
     ```ts
     import { EmailSendError } from "./types.js";
     import type { EmailService, SendEmailRequest } from "./types.js";

     export interface ResendEmailServiceConfig {
       apiKey: string;
       from: string;
     }

     export class ResendEmailService implements EmailService {
       constructor(private readonly config: ResendEmailServiceConfig) {}

       async send(request: SendEmailRequest): Promise<{ id?: string }> {
         const response = await fetch("https://api.resend.com/emails", {
           method: "POST",
           headers: {
             Authorization: `Bearer ${this.config.apiKey}`,
             "Content-Type": "application/json",
           },
           body: JSON.stringify({
             from: this.config.from,
             to: request.to,
             subject: request.subject,
             html: request.html,
             text: request.text,
           }),
         });

         if (!response.ok) {
           const body = await response.text().catch(() => "unknown");
           throw new EmailSendError(
             `Resend returned ${response.status}: ${body}`,
             { status: response.status },
           );
         }

         const data = (await response.json()) as { id?: string };
         return { id: data.id };
       }
     }

     export function createResendEmailService(): ResendEmailService {
       const apiKey = process.env["RESEND_API_KEY"];
       const from = process.env["EMAIL_FROM_ADDRESS"];
       if (!apiKey || !from) {
         throw new Error(
           "RESEND_API_KEY and EMAIL_FROM_ADDRESS environment variables are required",
         );
       }
       return new ResendEmailService({ apiKey, from });
     }
     ```
  2. Export from `packages/email/src/index.ts`:
     ```ts
     export type { EmailLocale, SendEmailRequest, EmailService } from "./types.js";
     export { EmailSendError } from "./types.js";
     export { StubEmailService } from "./stub-adapter.js";
     export { ResendEmailService, createResendEmailService } from "./resend-adapter.js";
     export type { ResendEmailServiceConfig } from "./resend-adapter.js";
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: PASS — Resend adapter tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/email
  git commit -m "Add Resend email adapter with typed errors"
  ```

---

### Task 4: Implement bilingual email templates

**Files:**
- Create: `packages/email/src/templates/audit-completion/context.ts`
- Create: `packages/email/src/templates/audit-completion/en.ts`
- Create: `packages/email/src/templates/audit-completion/ar.ts`
- Create: `packages/email/src/templates/audit-completion/index.ts`
- Create: `packages/email/src/templates/password-reset/context.ts`
- Create: `packages/email/src/templates/password-reset/en.ts`
- Create: `packages/email/src/templates/password-reset/ar.ts`
- Create: `packages/email/src/templates/password-reset/index.ts`
- Modify: `packages/email/src/index.ts`
- Modify: `packages/email/tests/email-service.test.ts`

**Interfaces:**
- Consumes: `AuditCompletionContext`, `PasswordResetContext`
- Produces: `auditCompletionTemplate`, `passwordResetTemplate`

- [ ] **Step 1: Write the failing test**
  Append to `packages/email/tests/email-service.test.ts`:
  ```ts
  import {
    auditCompletionTemplate,
    passwordResetTemplate,
  } from "../src/index.js";

  describe("email templates", () => {
    it("renders English audit-completion email", () => {
      const result = auditCompletionTemplate({
        locale: "en",
        siteUrl: "https://example.com",
        score: 72,
        reportUrl: "https://app.test/en/audit/abc",
      });

      expect(result.subject).toBe("Your WPI audit for example.com is ready");
      expect(result.html).toContain("https://app.test/en/audit/abc");
      expect(result.text).toContain("https://app.test/en/audit/abc");
      expect(result.text).toContain("72%");
    });

    it("renders Arabic audit-completion email", () => {
      const result = auditCompletionTemplate({
        locale: "ar",
        siteUrl: "https://example.com",
        score: 72,
        reportUrl: "https://app.test/ar/audit/abc",
      });

      expect(result.subject).toBe("تقرير WPI لموقع example.com جاهز");
      expect(result.html).toContain("https://app.test/ar/audit/abc");
      expect(result.text).toContain("example.com");
    });

    it("renders English password-reset email", () => {
      const result = passwordResetTemplate({
        locale: "en",
        resetUrl: "https://app.test/reset-password?token=abc123",
        expiresInMinutes: 15,
      });

      expect(result.subject).toBe("Reset your WPI password");
      expect(result.html).toContain("https://app.test/reset-password?token=abc123");
      expect(result.text).toContain("15 minutes");
    });

    it("renders Arabic password-reset email", () => {
      const result = passwordResetTemplate({
        locale: "ar",
        resetUrl: "https://app.test/reset-password?token=abc123",
        expiresInMinutes: 15,
      });

      expect(result.subject).toBe("إعادة تعيين كلمة مرور WPI");
      expect(result.html).toContain("https://app.test/reset-password?token=abc123");
      expect(result.text).toContain("15");
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: FAIL — template functions are not exported.

- [ ] **Step 3: Write minimal implementation**
  1. Create `packages/email/src/templates/audit-completion/context.ts`:
     ```ts
     export interface AuditCompletionContext {
       siteUrl: string;
       score: number;
       reportUrl: string;
     }
     ```
  2. Create `packages/email/src/templates/audit-completion/en.ts`:
     ```ts
     import type { AuditCompletionContext } from "./context.js";

     export function auditCompletionEn(context: AuditCompletionContext) {
       const site = new URL(context.siteUrl).hostname;
       const subject = `Your WPI audit for ${site} is ready`;
       const html = `<!DOCTYPE html>
  <html lang="en" dir="ltr">
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
      <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
      <p>Your Presence Readiness score is <strong>${context.score}%</strong>.</p>
      <p><a href="${context.reportUrl}" style="color: #2563eb;">View your full report</a></p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
      <p style="font-size: 0.875rem; color: #6b7280;">This link is private. Do not forward it.</p>
    </body>
  </html>`;
       const text = `Your WPI audit for ${site} is ready.\n\nScore: ${context.score}%\n\nView your report: ${context.reportUrl}\n\nThis link is private. Do not forward it.`;
       return { subject, html, text };
     }
     ```
  3. Create `packages/email/src/templates/audit-completion/ar.ts`:
     ```ts
     import type { AuditCompletionContext } from "./context.js";

     export function auditCompletionAr(context: AuditCompletionContext) {
       const site = new URL(context.siteUrl).hostname;
       const subject = `تقرير WPI لموقع ${site} جاهز`;
       const html = `<!DOCTYPE html>
  <html lang="ar" dir="rtl">
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
      <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
      <p>درجة جاهزية الحضور الرقمي: <strong>${context.score}%</strong>.</p>
      <p><a href="${context.reportUrl}" style="color: #2563eb;">عرض التقرير الكامل</a></p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
      <p style="font-size: 0.875rem; color: #6b7280;">هذا الرابط خاص. لا تعمّمه.</p>
    </body>
  </html>`;
       const text = `تقرير WPI لموقع ${site} جاهز.\n\nالدرجة: ${context.score}%\n\nعرض التقرير: ${context.reportUrl}\n\nهذا الرابط خاص. لا تعمّمه.`;
       return { subject, html, text };
     }
     ```
  4. Create `packages/email/src/templates/audit-completion/index.ts`:
     ```ts
     import type { EmailLocale } from "../../types.js";
     import { auditCompletionAr } from "./ar.js";
     import type { AuditCompletionContext } from "./context.js";
     import { auditCompletionEn } from "./en.js";

     export type { AuditCompletionContext };

     export function auditCompletionTemplate(
       context: AuditCompletionContext & { locale: EmailLocale },
     ) {
       const { locale, ...rest } = context;
       const rendered = locale === "ar" ? auditCompletionAr(rest) : auditCompletionEn(rest);
       return {
         subject: rendered.subject,
         html: rendered.html,
         text: rendered.text,
       };
     }
     ```
  5. Create `packages/email/src/templates/password-reset/context.ts`:
     ```ts
     export interface PasswordResetContext {
       resetUrl: string;
       expiresInMinutes: number;
     }
     ```
  6. Create `packages/email/src/templates/password-reset/en.ts`:
     ```ts
     import type { PasswordResetContext } from "./context.js";

     export function passwordResetEn(context: PasswordResetContext) {
       const subject = "Reset your WPI password";
       const html = `<!DOCTYPE html>
  <html lang="en" dir="ltr">
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
      <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
      <p>Click the link below to reset your password. It expires in ${context.expiresInMinutes} minutes.</p>
      <p><a href="${context.resetUrl}" style="color: #2563eb;">Reset my password</a></p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
      <p style="font-size: 0.875rem; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </body>
  </html>`;
       const text = `Reset your WPI password.\n\nUse this link to reset your password. It expires in ${context.expiresInMinutes} minutes:\n\n${context.resetUrl}\n\nIf you did not request this, you can ignore this email.`;
       return { subject, html, text };
     }
     ```
  7. Create `packages/email/src/templates/password-reset/ar.ts`:
     ```ts
     import type { PasswordResetContext } from "./context.js";

     export function passwordResetAr(context: PasswordResetContext) {
       const subject = "إعادة تعيين كلمة مرور WPI";
       const html = `<!DOCTYPE html>
  <html lang="ar" dir="rtl">
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
      <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
      <p>اضغط الرابط أدناه لإعادة تعيين كلمة المرور. ينتهي صلاحيته خلال ${context.expiresInMinutes} دقيقة.</p>
      <p><a href="${context.resetUrl}" style="color: #2563eb;">إعادة تعيين كلمة المرور</a></p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
      <p style="font-size: 0.875rem; color: #6b7280;">إذا لم تطلب هذا، يمكنك تجاهل البريد.</p>
    </body>
  </html>`;
       const text = `إعادة تعيين كلمة مرور WPI.\n\nاستخدم هذا الرابط لإعادة تعيين كلمة المرور. ينتهي صلاحيته خلال ${context.expiresInMinutes} دقيقة:\n\n${context.resetUrl}\n\nإذا لم تطلب هذا، يمكنك تجاهل البريد.`;
       return { subject, html, text };
     }
     ```
  8. Create `packages/email/src/templates/password-reset/index.ts`:
     ```ts
     import type { EmailLocale } from "../../types.js";
     import type { PasswordResetContext } from "./context.js";
     import { passwordResetAr } from "./ar.js";
     import { passwordResetEn } from "./en.js";

     export type { PasswordResetContext };

     export function passwordResetTemplate(
       context: PasswordResetContext & { locale: EmailLocale },
     ) {
       const { locale, ...rest } = context;
       const rendered = locale === "ar" ? passwordResetAr(rest) : passwordResetEn(rest);
       return {
         subject: rendered.subject,
         html: rendered.html,
         text: rendered.text,
       };
     }
     ```
  9. Update `packages/email/src/index.ts`:
     ```ts
     export type { EmailLocale, SendEmailRequest, EmailService } from "./types.js";
     export { EmailSendError } from "./types.js";
     export { StubEmailService } from "./stub-adapter.js";
     export { ResendEmailService, createResendEmailService } from "./resend-adapter.js";
     export type { ResendEmailServiceConfig } from "./resend-adapter.js";
     export { auditCompletionTemplate } from "./templates/audit-completion/index.js";
     export type { AuditCompletionContext } from "./templates/audit-completion/index.js";
     export { passwordResetTemplate } from "./templates/password-reset/index.js";
     export type { PasswordResetContext } from "./templates/password-reset/index.js";
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/email test
  ```
  Expected: PASS — template tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/email
  git commit -m "Add bilingual EN/AR email templates"
  ```

---

### Task 5: Add the password-reset database migration

**Files:**
- Create: `packages/audit-pipeline/src/migrations/0018_password_reset_tokens.sql`
- Create: `packages/audit-pipeline/tests/migrations.test.ts`

**Interfaces:**
- Consumes: existing `users` table
- Produces: `password_reset_tokens` table

- [ ] **Step 1: Write the failing test**
  Create `packages/audit-pipeline/tests/migrations.test.ts`:
  ```ts
  import { describe, expect, it, beforeAll, afterAll } from "vitest";
  import { Pool } from "pg";
  import { applyMigrations } from "../src/migrations/migrate.js";

  const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

  describe.skipIf(!DATABASE_URL)("migrations", () => {
    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({ connectionString: DATABASE_URL });
      await pool.query("DROP TABLE IF EXISTS password_reset_tokens CASCADE");
      await pool.query("DROP TABLE IF EXISTS sessions CASCADE");
      await pool.query("DROP TABLE IF EXISTS users CASCADE");
      await pool.query("DROP TABLE IF EXISTS schema_migrations");
    });

    afterAll(async () => {
      await pool.end();
    });

    it("applies migration 0018 and creates password_reset_tokens", async () => {
      const result = await applyMigrations(pool);
      expect(result.applied).toContain("0018_password_reset_tokens.sql");

      const columns = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'password_reset_tokens'`,
      );
      const names = columns.rows.map((r) => r.column_name);
      expect(names).toContain("token_hash");
      expect(names).toContain("user_id");
      expect(names).toContain("expires_at");
      expect(names).toContain("used_at");
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  WPI_TEST_DATABASE_URL=postgres://stratum:stratum_secure_password_2024@localhost:5432/wpi_test pnpm --filter @wpi/audit-pipeline test tests/migrations.test.ts
  ```
  Expected: FAIL — migration file `0018_password_reset_tokens.sql` does not exist.

- [ ] **Step 3: Write minimal implementation**
  Create `packages/audit-pipeline/src/migrations/0018_password_reset_tokens.sql`:
  ```sql
  CREATE TABLE password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  );
  CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  WPI_TEST_DATABASE_URL=postgres://stratum:stratum_secure_password_2024@localhost:5432/wpi_test pnpm --filter @wpi/audit-pipeline test tests/migrations.test.ts
  ```
  Expected: PASS — migration applies and columns exist.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audit-pipeline/src/migrations/0018_password_reset_tokens.sql packages/audit-pipeline/tests/migrations.test.ts
  git commit -m "Add password_reset_tokens migration"
  ```

---

### Task 6: Extend `@wpi/auth` with password-reset methods

**Files:**
- Modify: `packages/auth/src/auth-service.ts`
- Modify: `packages/auth/src/pg-auth-service.ts`
- Modify: `packages/auth/src/schemas.ts`
- Modify: `packages/auth/src/index.ts`
- Create: `packages/auth/tests/password-reset.test.ts`
- Modify: `packages/auth/tests/auth-service.test.ts`
- Modify: `packages/auth/tests/pg-auth-service.test.ts`

**Interfaces:**
- Consumes: `password_reset_tokens` table, `users` table, scrypt password hashing
- Produces: `AuthService.findUserById`, `AuthService.createPasswordResetToken`, `AuthService.consumePasswordResetToken`, `forgotPasswordSchema`, `resetPasswordSchema`

- [ ] **Step 1: Write the failing test**
  Create `packages/auth/tests/password-reset.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { InMemoryAuthService } from "../src/auth-service.js";

  function makeClock() {
    const state = { current: 1_000_000 };
    return {
      state,
      now: () => state.current,
      advance: (ms: number) => {
        state.current += ms;
      },
    };
  }

  const MINUTE_MS = 60 * 1000;

  describe("password reset tokens", () => {
    it("creates a token for an existing user", async () => {
      const auth = new InMemoryAuthService();
      const user = await auth.createUser("reset@example.com", "password123");
      const token = await auth.createPasswordResetToken("reset@example.com");

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const found = await auth.findUserById(user.id);
      expect(found?.email).toBe("reset@example.com");
    });

    it("returns null for an unknown email", async () => {
      const auth = new InMemoryAuthService();
      const token = await auth.createPasswordResetToken("missing@example.com");
      expect(token).toBeNull();
    });

    it("consumes a token and updates the password", async () => {
      const auth = new InMemoryAuthService();
      await auth.createUser("reset@example.com", "password123");
      const token = await auth.createPasswordResetToken("reset@example.com");
      if (!token) throw new Error("token expected");

      const ok = await auth.consumePasswordResetToken(token, "new-password-123");
      expect(ok).toBe(true);

      const verified = await auth.verifyCredentials("reset@example.com", "new-password-123");
      expect(verified).not.toBeNull();
    });

    it("rejects a reused token", async () => {
      const auth = new InMemoryAuthService();
      await auth.createUser("reset@example.com", "password123");
      const token = await auth.createPasswordResetToken("reset@example.com");
      if (!token) throw new Error("token expected");

      await auth.consumePasswordResetToken(token, "new-password-123");
      const ok = await auth.consumePasswordResetToken(token, "another-password");
      expect(ok).toBe(false);
    });

    it("rejects an expired token", async () => {
      const clock = makeClock();
      const auth = new InMemoryAuthService(clock.now);
      await auth.createUser("reset@example.com", "password123");
      const token = await auth.createPasswordResetToken("reset@example.com");
      if (!token) throw new Error("token expected");

      clock.advance(16 * MINUTE_MS);
      const ok = await auth.consumePasswordResetToken(token, "new-password-123");
      expect(ok).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/auth test tests/password-reset.test.ts
  ```
  Expected: FAIL — `createPasswordResetToken` and `consumePasswordResetToken` do not exist on `InMemoryAuthService`.

- [ ] **Step 3: Write minimal implementation**
  1. Update `packages/auth/src/schemas.ts`:
     ```ts
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

     export const forgotPasswordSchema = z.object({
       email: emailSchema,
     });

     export const resetPasswordSchema = z.object({
       token: z.string().min(1),
       password: passwordSchema,
     });
     ```
  2. Replace `packages/auth/src/auth-service.ts` with:
     ```ts
     import { createHash, randomBytes } from "node:crypto";
     import { hashPassword, verifyPassword } from "./password.js";

     export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
     export const SESSION_RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
     export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

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

     interface StoredPasswordResetToken {
       userId: string;
       expiresAt: number;
       used: boolean;
     }

     export interface AuthService {
       createUser(email: string, password: string): Promise<SessionUser>;
       verifyCredentials(email: string, password: string): Promise<SessionUser | null>;
       createSession(userId: string): Promise<CreatedSession>;
       getSessionUser(tokenHash: string): Promise<SessionUser | null>;
       destroySession(tokenHash: string): Promise<void>;
       findUserById(userId: string): Promise<SessionUser | null>;
       createPasswordResetToken(email: string): Promise<string | null>;
       consumePasswordResetToken(token: string, newPassword: string): Promise<boolean>;
     }

     function normalizeEmail(email: string): string {
       return email.trim().toLowerCase();
     }

     export class InMemoryAuthService implements AuthService {
       private readonly usersByEmail = new Map<string, StoredUser>();
       private readonly usersById = new Map<string, StoredUser>();
       private readonly sessionsByTokenHash = new Map<string, StoredSession>();
       private readonly passwordResetTokens = new Map<string, StoredPasswordResetToken>();
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
         this.usersById.set(user.id, user);
         return { id: user.id, email: user.email };
       }

       async verifyCredentials(
         email: string,
         password: string,
       ): Promise<SessionUser | null> {
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
         const user = this.usersById.get(userId);
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
         const user = this.usersById.get(session.userId);
         return user ? { id: user.id, email: user.email } : null;
       }

       async destroySession(tokenHash: string): Promise<void> {
         this.sessionsByTokenHash.delete(tokenHash);
       }

       async findUserById(userId: string): Promise<SessionUser | null> {
         const user = this.usersById.get(userId);
         return user ? { id: user.id, email: user.email } : null;
       }

       async createPasswordResetToken(email: string): Promise<string | null> {
         const normalized = normalizeEmail(email);
         const user = this.usersByEmail.get(normalized);
         if (!user) {
           return null;
         }
         const token = generateSessionToken();
         const tokenHash = hashToken(token);
         this.passwordResetTokens.set(tokenHash, {
           userId: user.id,
           expiresAt: this.now() + PASSWORD_RESET_TTL_MS,
           used: false,
         });
         return token;
       }

       async consumePasswordResetToken(
         token: string,
         newPassword: string,
       ): Promise<boolean> {
         const tokenHash = hashToken(token);
         const stored = this.passwordResetTokens.get(tokenHash);
         if (!stored || stored.used || this.now() >= stored.expiresAt) {
           return false;
         }
         const user = this.usersById.get(stored.userId);
         if (!user) {
           return false;
         }
         user.passwordHash = await hashPassword(newPassword);
         stored.used = true;
         this.passwordResetTokens.delete(tokenHash);
         return true;
       }
     }
     ```
  3. Replace `packages/auth/src/pg-auth-service.ts` with:
     ```ts
     import type { Pool } from "pg";
     import { hashPassword, verifyPassword } from "./password.js";
     import {
       DuplicateEmailError,
       generateSessionToken,
       hashToken,
       PASSWORD_RESET_TTL_MS,
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

       async verifyCredentials(
         email: string,
         password: string,
       ): Promise<SessionUser | null> {
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

       async findUserById(userId: string): Promise<SessionUser | null> {
         const result = await this.pool.query<{ id: string; email: string }>(
           "SELECT id, email FROM users WHERE id = $1",
           [userId],
         );
         const row = result.rows[0];
         return row ? { id: row.id, email: row.email } : null;
       }

       async createPasswordResetToken(email: string): Promise<string | null> {
         const normalized = email.trim().toLowerCase();
         const userResult = await this.pool.query<{ id: string }>(
           "SELECT id FROM users WHERE email = $1",
           [normalized],
         );
         const user = userResult.rows[0];
         if (!user) {
           return null;
         }
         const token = generateSessionToken();
         const tokenHash = hashToken(token);
         const ttlSeconds = PASSWORD_RESET_TTL_MS / 1000;
         await this.pool.query(
           `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
            VALUES ($1, $2::uuid, now() + make_interval(secs => $3))`,
           [tokenHash, user.id, ttlSeconds],
         );
         return token;
       }

       async consumePasswordResetToken(
         token: string,
         newPassword: string,
       ): Promise<boolean> {
         const tokenHash = hashToken(token);
         const client = await this.pool.connect();
         try {
           await client.query("BEGIN");
           const tokenResult = await client.query<{ user_id: string }>(
             `SELECT user_id FROM password_reset_tokens
              WHERE token_hash = $1
                AND expires_at > now()
                AND used_at IS NULL
              FOR UPDATE`,
             [tokenHash],
           );
           const row = tokenResult.rows[0];
           if (!row) {
             await client.query("ROLLBACK");
             return false;
           }
           const newHash = await hashPassword(newPassword);
           await client.query("UPDATE users SET password_hash = $1 WHERE id = $2::uuid", [
             newHash,
             row.user_id,
           ]);
           await client.query(
             "UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1",
             [tokenHash],
           );
           await client.query("COMMIT");
           return true;
         } catch (error) {
           await client.query("ROLLBACK").catch(() => undefined);
           throw error;
         } finally {
           client.release();
         }
       }
     }
     ```
  4. Ensure `packages/auth/src/index.ts` contains wildcard exports (no change needed):
     ```ts
     export * from "./password.js";
     export * from "./session-cookie.js";
     export * from "./schemas.js";
     export * from "./rate-limit.js";
     export * from "./auth-service.js";
     export * from "./pg-auth-service.js";
     ```
  5. Append to `packages/auth/tests/auth-service.test.ts`:
     ```ts
     describe("InMemoryAuthService password reset", () => {
       it("finds a user by id", async () => {
         const auth = new InMemoryAuthService();
         const user = await auth.createUser("find@example.com", "password123");
         const found = await auth.findUserById(user.id);
         expect(found).not.toBeNull();
         expect(found!.email).toBe("find@example.com");
       });

       it("returns null for unknown user id", async () => {
         const auth = new InMemoryAuthService();
         expect(await auth.findUserById("no-such-id")).toBeNull();
       });
     });
     ```
  6. Update `packages/auth/tests/pg-auth-service.test.ts` `beforeAll` to apply migrations `0016_create_users_sessions.sql` and `0018_password_reset_tokens.sql`, and append tests for `createPasswordResetToken` and `consumePasswordResetToken`:
     ```ts
     beforeAll(async () => {
       pool = new Pool({ connectionString: DATABASE_URL });
       await pool.query("DROP TABLE IF EXISTS password_reset_tokens CASCADE");
       await pool.query("DROP TABLE IF EXISTS sessions CASCADE");
       await pool.query("DROP TABLE IF EXISTS users CASCADE");
       await pool.query("DROP TABLE IF EXISTS schema_migrations");
       const usersSql = await readFile(
         new URL("../../audit-pipeline/src/migrations/0016_create_users_sessions.sql", import.meta.url),
         "utf8",
       );
       const tokensSql = await readFile(
         new URL("../../audit-pipeline/src/migrations/0018_password_reset_tokens.sql", import.meta.url),
         "utf8",
       );
       await pool.query(usersSql);
       await pool.query(tokensSql);
       auth = new PgAuthService(pool);
     });
     ```
     Append inside the `describe` block:
     ```ts
     it("creates and consumes a password reset token", async () => {
       const email = `pg-reset-${randomUUID()}@example.com`;
       const user = await auth.createUser(email, "password123");
       const token = await auth.createPasswordResetToken(email);
       expect(token).toMatch(/^[0-9a-f]{64}$/);

       const ok = await auth.consumePasswordResetToken(token!, "new-password-123");
       expect(ok).toBe(true);

       const verified = await auth.verifyCredentials(email, "new-password-123");
       expect(verified).not.toBeNull();
       expect(verified!.id).toBe(user.id);
     });

     it("returns null token for unknown email", async () => {
       const token = await auth.createPasswordResetToken(`missing-${randomUUID()}@example.com`);
       expect(token).toBeNull();
     });

     it("rejects a reused token", async () => {
       const email = `pg-reset-reuse-${randomUUID()}@example.com`;
       await auth.createUser(email, "password123");
       const token = await auth.createPasswordResetToken(email);
       await auth.consumePasswordResetToken(token!, "new-password-123");
       const ok = await auth.consumePasswordResetToken(token!, "another-password");
       expect(ok).toBe(false);
     });
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/auth test
  ```
  Expected: PASS — all auth tests pass, including new password-reset tests.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/auth
  git commit -m "Add password reset token methods to @wpi/auth"
  ```

---

### Task 7: Add the `onComplete` hook to `@wpi/audit-pipeline`

**Files:**
- Modify: `packages/audit-pipeline/src/pipeline.ts`
- Modify: `packages/audit-pipeline/tests/pipeline.test.ts`

**Interfaces:**
- Consumes: optional `onComplete(record: AuditRecord)` callback
- Produces: `PipelineDeps.onComplete`

- [ ] **Step 1: Write the failing test**
  Append to `packages/audit-pipeline/tests/pipeline.test.ts`:
  ```ts
  describe("onComplete callback", () => {
    it("calls onComplete with the completed record", async () => {
      const store = new InMemoryAuditStore();
      const auditId = await seedAudit(store);
      const onComplete = vi.fn().mockResolvedValue(undefined);

      const result = await runAuditPipeline(makeDeps(store, { onComplete }), auditId);

      expect(result).toBe("completed");
      expect(onComplete).toHaveBeenCalledTimes(1);
      const record = onComplete.mock.calls[0]![0] as AuditRecord;
      expect(record.id).toBe(auditId);
      expect(record.status).toBe("READY_COMPLETE");
    });

    it("does not fail the audit when onComplete throws", async () => {
      const store = new InMemoryAuditStore();
      const auditId = await seedAudit(store);
      const onComplete = vi.fn().mockRejectedValue(new Error("email boom"));

      const result = await runAuditPipeline(makeDeps(store, { onComplete }), auditId);

      expect(result).toBe("completed");
      const raw = await store.getRaw(auditId);
      expect(raw?.status).toBe("READY_COMPLETE");
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/audit-pipeline test tests/pipeline.test.ts
  ```
  Expected: FAIL — `onComplete` is not a known property of `PipelineDeps`.

- [ ] **Step 3: Write minimal implementation**
  1. Add to `PipelineDeps` in `packages/audit-pipeline/src/pipeline.ts`:
     ```ts
     onComplete?: (record: AuditRecord) => Promise<void> | void;
     ```
  2. After `await deps.store.setOutcome(auditId, to, envelope, envelope.costs);` and before the `return`, add:
     ```ts
     if (deps.onComplete) {
       try {
         await deps.onComplete(record);
       } catch (error) {
         console.warn(`onComplete failed for audit ${auditId}:`, error);
       }
     }
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/audit-pipeline test tests/pipeline.test.ts
  ```
  Expected: PASS — onComplete tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audit-pipeline
  git commit -m "Add onComplete hook to audit pipeline"
  ```

---

### Task 8: Wire email service and audit-completion callback into the web container

**Files:**
- Modify: `apps/web/src/services/container.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/test/container.test.ts`
- Modify: `apps/web/src/test/auth-routes.test.ts`
- Modify: `apps/web/src/test/api-audits-post.test.ts`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `NEXT_PUBLIC_APP_URL`
- Produces: `AuditServices.emailService`, `buildReportUrl`, pipeline `onComplete`

- [ ] **Step 1: Write the failing test**
  Replace `apps/web/src/test/container.test.ts` content to assert email service presence:
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { InMemoryAuditStore } from "@wpi/audit-pipeline";
  import { StubEmailService } from "@wpi/email";
  import {
    getAuditServices,
    setAuditServicesForTests,
  } from "../services/container";

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
      expect(services.emailService).toBeInstanceOf(StubEmailService);
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
  Also update the two `makeServices` helpers in `apps/web/src/test/auth-routes.test.ts` and `apps/web/src/test/api-audits-post.test.ts` to add `emailService: new StubEmailService()`.

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/web test src/test/container.test.ts
  ```
  Expected: FAIL — `emailService` is missing from `AuditServices` and the test helpers.

- [ ] **Step 3: Write minimal implementation**
  1. Add `"@wpi/email": "workspace:*"` to `apps/web/package.json` `dependencies`.
  2. In `apps/web/src/services/container.ts`:
     - Add imports:
       ```ts
       import {
         StubEmailService,
         ResendEmailService,
         auditCompletionTemplate,
         type EmailService,
       } from "@wpi/email";
       ```
     - Add `emailService: EmailService` to the `AuditServices` interface.
     - Add a helper near the top:
       ```ts
       function buildReportUrl(record: AuditRecord, appUrl: string): string {
         return `${appUrl}/${record.locale}/audit/${record.id}`;
       }
       ```
     - Add a helper to pick the email adapter:
       ```ts
       function buildEmailService(): EmailService {
         const apiKey = process.env["RESEND_API_KEY"];
         const from = process.env["EMAIL_FROM_ADDRESS"];
         if (apiKey && from) {
           return new ResendEmailService({ apiKey, from });
         }
         return new StubEmailService();
       }
       ```
     - In each `buildServices` branch (stub, memory, in_process), add `emailService: buildEmailService()` to the returned object.
     - In the `InProcessDispatcher` callback, pass `onComplete` to the pipeline:
       ```ts
       onComplete: async (record: AuditRecord) => {
         if (!record.user_id) return;
         const user = await services.auth.findUserById(record.user_id);
         if (!user) return;
         const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
         const { subject, html, text } = auditCompletionTemplate({
           locale: record.locale,
           siteUrl: record.target_url,
           score: record.report?.score?.presence_readiness ?? 0,
           reportUrl: buildReportUrl(record, appUrl),
         });
         void services.emailService
           .send({
             to: user.email,
             subject,
             html,
             text,
             locale: record.locale,
           })
           .catch((error: unknown) => {
             console.error("Failed to send audit completion email:", error);
           });
       },
       ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @wpi/email build
  pnpm --filter @wpi/web test src/test/container.test.ts
  ```
  Expected: PASS — container builds and exposes a stub email service.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web packages/email
  git commit -m "Wire email service and audit-completion callback into web container"
  ```

---

### Task 9: Add the forgot-password API route

**Files:**
- Create: `apps/web/src/app/api/auth/forgot-password/route.ts`
- Create: `apps/web/src/test/api-auth-forgot-password.test.ts`
- Modify: `apps/web/src/test/auth-routes.test.ts` (add `emailService` to `makeServices`)

**Interfaces:**
- Consumes: `POST { email }`, `AuthService.createPasswordResetToken`, `EmailService`
- Produces: `200 { ok: true }` regardless of user existence; sends password-reset email when token created

- [ ] **Step 1: Write the failing test**
  Create `apps/web/src/test/api-auth-forgot-password.test.ts`:
  ```ts
  import { describe, expect, it, afterEach } from "vitest";
  import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
  import { InMemoryAuthService } from "@wpi/auth";
  import { InMemoryRateLimiter } from "@wpi/rate-limiter";
  import { StubEmailService } from "@wpi/email";
  import { NextRequest } from "next/server";
  import { POST } from "../app/api/auth/forgot-password/route";
  import { setAuditServicesForTests, type AuditServices } from "../services/container";

  function makeServices(): AuditServices {
    return {
      store: new InMemoryAuditStore(),
      dispatcher: { dispatch: async () => undefined },
      tierScopes: TIER_SCOPES,
      cookieSecret: "test-cookie-secret",
      auth: new InMemoryAuthService(),
      rateLimiter: new InMemoryRateLimiter(),
      validateUrl: async () => ({ ok: true }),
      outputDir: "./output",
      geminiApiKey: undefined,
      emailService: new StubEmailService(),
    };
  }

  function forgotPasswordRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  afterEach(() => {
    setAuditServicesForTests(null);
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns 200 for an existing user and sends an email", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);
      await services.auth.createUser("reset@example.com", "password123");

      const response = await POST(forgotPasswordRequest({ email: "reset@example.com" }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);

      const sent = (services.emailService as StubEmailService).getSent();
      expect(sent).toHaveLength(1);
      expect(sent[0]!.to).toBe("reset@example.com");
      expect(sent[0]!.subject).toBe("Reset your WPI password");
      expect(sent[0]!.html).toContain("reset-password?token=");
    });

    it("returns 200 for an unknown user and sends no email", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);

      const response = await POST(forgotPasswordRequest({ email: "unknown@example.com" }));

      expect(response.status).toBe(200);
      expect((services.emailService as StubEmailService).getSent()).toHaveLength(0);
    });

    it("returns 400 for invalid input", async () => {
      setAuditServicesForTests(makeServices());
      const response = await POST(forgotPasswordRequest({ email: "not-an-email" }));
      expect(response.status).toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/web test src/test/api-auth-forgot-password.test.ts
  ```
  Expected: FAIL — route file `apps/web/src/app/api/auth/forgot-password/route.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**
  Create `apps/web/src/app/api/auth/forgot-password/route.ts`:
  ```ts
  import { NextResponse, type NextRequest } from "next/server";
  import { forgotPasswordSchema } from "@wpi/auth";
  import { passwordResetTemplate } from "@wpi/email";
  import { getAuditServices } from "../../../../services/container";

  export const runtime = "nodejs";

  export async function POST(request: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const services = await getAuditServices();
    const token = await services.auth.createPasswordResetToken(parsed.data.email);
    if (token) {
      const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      const { subject, html, text } = passwordResetTemplate({
        locale: "en",
        resetUrl,
        expiresInMinutes: 15,
      });
      void services.emailService
        .send({
          to: parsed.data.email,
          subject,
          html,
          text,
          locale: "en",
        })
        .catch((error: unknown) => {
          console.error("Failed to send password reset email:", error);
        });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/web test src/test/api-auth-forgot-password.test.ts
  ```
  Expected: PASS — forgot-password route tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web
  git commit -m "Add forgot-password API route"
  ```

---

### Task 10: Add the reset-password API route

**Files:**
- Create: `apps/web/src/app/api/auth/reset-password/route.ts`
- Create: `apps/web/src/test/api-auth-reset-password.test.ts`

**Interfaces:**
- Consumes: `POST { token, password }`, `AuthService.consumePasswordResetToken`
- Produces: `200 { ok: true }` on success, `400 { error: "invalid_token" }` on failure

- [ ] **Step 1: Write the failing test**
  Create `apps/web/src/test/api-auth-reset-password.test.ts`:
  ```ts
  import { describe, expect, it, afterEach } from "vitest";
  import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
  import { InMemoryAuthService } from "@wpi/auth";
  import { InMemoryRateLimiter } from "@wpi/rate-limiter";
  import { StubEmailService } from "@wpi/email";
  import { NextRequest } from "next/server";
  import { POST } from "../app/api/auth/reset-password/route";
  import { setAuditServicesForTests, type AuditServices } from "../services/container";

  function makeServices(): AuditServices {
    return {
      store: new InMemoryAuditStore(),
      dispatcher: { dispatch: async () => undefined },
      tierScopes: TIER_SCOPES,
      cookieSecret: "test-cookie-secret",
      auth: new InMemoryAuthService(),
      rateLimiter: new InMemoryRateLimiter(),
      validateUrl: async () => ({ ok: true }),
      outputDir: "./output",
      geminiApiKey: undefined,
      emailService: new StubEmailService(),
    };
  }

  function resetPasswordRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  afterEach(() => {
    setAuditServicesForTests(null);
  });

  describe("POST /api/auth/reset-password", () => {
    it("resets the password with a valid token", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);
      await services.auth.createUser("reset@example.com", "password123");
      const token = await services.auth.createPasswordResetToken("reset@example.com");
      if (!token) throw new Error("token expected");

      const response = await POST(resetPasswordRequest({ token, password: "new-password-123" }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);

      const verified = await services.auth.verifyCredentials("reset@example.com", "new-password-123");
      expect(verified).not.toBeNull();
    });

    it("returns 400 for an invalid token", async () => {
      setAuditServicesForTests(makeServices());
      const response = await POST(
        resetPasswordRequest({ token: "invalid-token", password: "new-password-123" }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("invalid_token");
    });

    it("returns 400 for a short password", async () => {
      setAuditServicesForTests(makeServices());
      const response = await POST(resetPasswordRequest({ token: "abc", password: "short" }));
      expect(response.status).toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/web test src/test/api-auth-reset-password.test.ts
  ```
  Expected: FAIL — route file `apps/web/src/app/api/auth/reset-password/route.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**
  Create `apps/web/src/app/api/auth/reset-password/route.ts`:
  ```ts
  import { NextResponse, type NextRequest } from "next/server";
  import { resetPasswordSchema } from "@wpi/auth";
  import { getAuditServices } from "../../../../services/container";

  export const runtime = "nodejs";

  export async function POST(request: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const services = await getAuditServices();
    const ok = await services.auth.consumePasswordResetToken(
      parsed.data.token,
      parsed.data.password,
    );
    if (!ok) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/web test src/test/api-auth-reset-password.test.ts
  ```
  Expected: PASS — reset-password route tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web
  git commit -m "Add reset-password API route"
  ```

---

### Task 11: Add forgot-password and reset-password UI pages

**Files:**
- Create: `apps/web/src/app/[locale]/forgot-password/page.tsx`
- Create: `apps/web/src/app/[locale]/_components/forgot-password-form.tsx`
- Create: `apps/web/src/app/[locale]/reset-password/page.tsx`
- Create: `apps/web/src/app/[locale]/_components/reset-password-form.tsx`
- Modify: `apps/web/src/app/[locale]/_components/auth-form.tsx`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/ar.json`

**Interfaces:**
- Consumes: `/api/auth/forgot-password`, `/api/auth/reset-password`, next-intl `auth` namespace
- Produces: localized forgot-password and reset-password pages

- [ ] **Step 1: Write the failing test**
  Run the typecheck for the web app:
  ```bash
  pnpm --filter @wpi/web typecheck
  ```
  Expected: FAIL — new pages import `ForgotPasswordForm` and `ResetPasswordForm` components that do not exist.

- [ ] **Step 2: Run test to verify it fails**
  (Same command as Step 1; confirm the TypeScript errors reference missing components.)

- [ ] **Step 3: Write minimal implementation**
  1. Add i18n keys to `apps/web/src/messages/en.json` inside the `auth` object:
     ```json
     "forgot_password_title": "Reset your password",
     "forgot_password_body": "Enter your email and we will send you a reset link.",
     "send_reset_link": "Send reset link",
     "reset_password_title": "Choose a new password",
     "reset_password_button": "Reset password",
     "forgot_password_link": "Forgot password?",
     "back_to_login": "Back to login",
     "reset_success": "Your password has been updated. Sign in to continue.",
     "error_invalid_token": "This reset link is invalid or has expired.",
     "error_password_too_short": "Password must be at least 8 characters."
     ```
  2. Add the corresponding Arabic keys to `apps/web/src/messages/ar.json` inside the `auth` object:
     ```json
     "forgot_password_title": "إعادة تعيين كلمة المرور",
     "forgot_password_body": "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.",
     "send_reset_link": "إرسال رابط إعادة التعيين",
     "reset_password_title": "اختر كلمة مرور جديدة",
     "reset_password_button": "إعادة تعيين كلمة المرور",
     "forgot_password_link": "نسيت كلمة المرور؟",
     "back_to_login": "العودة إلى تسجيل الدخول",
     "reset_success": "تم تحديث كلمة المرور. سجّل الدخول للمتابعة.",
     "error_invalid_token": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية.",
     "error_password_too_short": "يجب أن تكون كلمة المرور 8 أحرف على الأقل."
     ```
  3. Create `apps/web/src/app/[locale]/_components/forgot-password-form.tsx`:
     ```tsx
     "use client";

     import { useLocale, useTranslations } from "next-intl";
     import { useState } from "react";
     import { Link } from "../../../i18n/navigation";

     export function ForgotPasswordForm() {
       const t = useTranslations("auth");
       const locale = useLocale();
       const [submitting, setSubmitting] = useState(false);
       const [sent, setSent] = useState(false);
       const [error, setError] = useState<string | null>(null);

       async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
         event.preventDefault();
         if (submitting) return;
         const email = String(new FormData(event.currentTarget).get("email") ?? "");
         setSubmitting(true);
         setError(null);

         try {
           const response = await fetch("/api/auth/forgot-password", {
             method: "POST",
             headers: { "content-type": "application/json" },
             body: JSON.stringify({ email }),
           });
           if (!response.ok) {
             const body = (await response.json().catch(() => null)) as { error?: string } | null;
             setError(t(`error_${body?.error ?? "generic"}`));
             setSubmitting(false);
             return;
           }
           setSent(true);
         } catch {
           setError(t("error_generic"));
         } finally {
           setSubmitting(false);
         }
       }

       const inputClasses =
         "mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-surface-900 shadow-sm outline-none transition-all placeholder:text-surface-700/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
       const labelClasses = "block text-sm font-medium text-surface-800";

       return (
         <div className="flex min-h-[60vh] items-center justify-center py-16">
           <form
             onSubmit={handleSubmit}
             className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-surface-200 bg-white p-6 shadow-lg shadow-surface-200/50 sm:p-8"
           >
             <div className="space-y-1">
               <h1 className="text-xl font-bold text-surface-900">{t("forgot_password_title")}</h1>
               <div className="h-1 w-12 rounded-full bg-brand-500" />
             </div>
             <p className="text-sm text-surface-700">{t("forgot_password_body")}</p>
             {sent ? (
               <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                 {t("reset_success")}
               </div>
             ) : (
               <>
                 <div>
                   <label htmlFor="email" className={labelClasses}>
                     {t("email_label")}
                   </label>
                   <input
                     id="email"
                     name="email"
                     type="email"
                     required
                     autoComplete="email"
                     className={inputClasses}
                   />
                 </div>
                 {error ? (
                   <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                     {error}
                   </div>
                 ) : null}
                 <button
                   type="submit"
                   disabled={submitting}
                   className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 disabled:opacity-60"
                 >
                   {submitting ? t("submitting") : t("send_reset_link")}
                 </button>
               </>
             )}
             <p className="text-center text-sm text-surface-700">
               <Link href={`/${locale}/login`} className="font-medium text-brand-600 hover:text-brand-700">
                 {t("back_to_login")}
               </Link>
             </p>
           </form>
         </div>
       );
     }
     ```
  4. Create `apps/web/src/app/[locale]/forgot-password/page.tsx`:
     ```tsx
     import { setRequestLocale } from "next-intl/server";
     import { ForgotPasswordForm } from "../_components/forgot-password-form";

     export default async function ForgotPasswordPage({
       params,
     }: {
       params: Promise<{ locale: string }>;
     }) {
       const { locale } = await params;
       setRequestLocale(locale);
       return <ForgotPasswordForm />;
     }
     ```
  5. Create `apps/web/src/app/[locale]/_components/reset-password-form.tsx`:
     ```tsx
     "use client";

     import { useLocale, useTranslations } from "next-intl";
     import { useState } from "react";
     import { Link } from "../../../i18n/navigation";

     export function ResetPasswordForm({ token }: { token: string }) {
       const t = useTranslations("auth");
       const locale = useLocale();
       const [submitting, setSubmitting] = useState(false);
       const [done, setDone] = useState(false);
       const [error, setError] = useState<string | null>(null);

       async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
         event.preventDefault();
         if (submitting) return;
         const password = String(new FormData(event.currentTarget).get("password") ?? "");
         setSubmitting(true);
         setError(null);

         try {
           const response = await fetch("/api/auth/reset-password", {
             method: "POST",
             headers: { "content-type": "application/json" },
             body: JSON.stringify({ token, password }),
           });
           if (!response.ok) {
             const body = (await response.json().catch(() => null)) as { error?: string } | null;
             setError(t(`error_${body?.error ?? "generic"}`));
             setSubmitting(false);
             return;
           }
           setDone(true);
         } catch {
           setError(t("error_generic"));
         } finally {
           setSubmitting(false);
         }
       }

       const inputClasses =
         "mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-surface-900 shadow-sm outline-none transition-all placeholder:text-surface-700/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
       const labelClasses = "block text-sm font-medium text-surface-800";

       return (
         <div className="flex min-h-[60vh] items-center justify-center py-16">
           <form
             onSubmit={handleSubmit}
             className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-surface-200 bg-white p-6 shadow-lg shadow-surface-200/50 sm:p-8"
           >
             <div className="space-y-1">
               <h1 className="text-xl font-bold text-surface-900">{t("reset_password_title")}</h1>
               <div className="h-1 w-12 rounded-full bg-brand-500" />
             </div>
             {done ? (
               <div className="space-y-4">
                 <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                   {t("reset_success")}
                 </div>
                 <Link
                   href={`/${locale}/login`}
                   className="block w-full rounded-xl bg-brand-600 px-6 py-3 text-center font-semibold text-white hover:bg-brand-700"
                 >
                   {t("sign_in")}
                 </Link>
               </div>
             ) : (
               <>
                 <div>
                   <label htmlFor="password" className={labelClasses}>
                     {t("password_label")}
                   </label>
                   <input
                     id="password"
                     name="password"
                     type="password"
                     required
                     minLength={8}
                     autoComplete="new-password"
                     className={inputClasses}
                   />
                 </div>
                 {error ? (
                   <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                     {error}
                   </div>
                 ) : null}
                 <button
                   type="submit"
                   disabled={submitting}
                   className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 disabled:opacity-60"
                 >
                   {submitting ? t("submitting") : t("reset_password_button")}
                 </button>
               </>
             )}
           </form>
         </div>
       );
     }
     ```
  6. Create `apps/web/src/app/[locale]/reset-password/page.tsx`:
     ```tsx
     import { setRequestLocale } from "next-intl/server";
     import { ResetPasswordForm } from "../_components/reset-password-form";

     export default async function ResetPasswordPage({
       params,
       searchParams,
     }: {
       params: Promise<{ locale: string }>;
       searchParams: Promise<{ token?: string }>;
     }) {
       const { locale } = await params;
       const { token } = await searchParams;
       setRequestLocale(locale);
       return <ResetPasswordForm token={token ?? ""} />;
     }
     ```
  7. Add forgot-password link to `apps/web/src/app/[locale]/_components/auth-form.tsx` inside the login form, below the password field when `mode === "login"`:
     ```tsx
     {mode === "login" ? (
       <div className="text-right">
         <Link
           href={`/${locale}/forgot-password`}
           className="text-sm font-medium text-brand-600 hover:text-brand-700"
         >
           {t("forgot_password_link")}
         </Link>
       </div>
     ) : null}
     ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/web typecheck
  ```
  Expected: PASS — TypeScript compiles the new pages and components.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web
  git commit -m "Add forgot-password and reset-password UI pages"
  ```

---

### Task 12: Add web integration tests for email flows

**Files:**
- Create: `apps/web/src/test/api-audits-email.test.ts`
- Modify: `apps/web/src/test/api-audits-post.test.ts` (ensure `emailService` in `makeServices`)

**Interfaces:**
- Consumes: `POST /api/audits`, audit pipeline completion, `StubEmailService`
- Produces: verified audit-completion email with correct report link

- [ ] **Step 1: Write the failing test**
  Create `apps/web/src/test/api-audits-email.test.ts`:
  ```ts
  import { describe, expect, it, afterEach } from "vitest";
  import {
    InMemoryAuditStore,
    TIER_SCOPES,
    runAuditPipeline,
    type PipelineDeps,
    type AuditRecord,
  } from "@wpi/audit-pipeline";
  import { InMemoryAuthService } from "@wpi/auth";
  import { InMemoryRateLimiter } from "@wpi/rate-limiter";
  import { StubEmailService, auditCompletionTemplate } from "@wpi/email";
  import type { AuditContext } from "@wpi/audit-pipeline";

  import { setAuditServicesForTests, type AuditServices } from "../services/container";

  const CONTEXT: AuditContext = {
    organization: "Example Corp",
    business_type: "e-commerce",
    offering: "Office furniture",
    market: "Saudi Arabia",
    customer_language: "Arabic",
    audience: "Procurement managers",
  };

  function makeServices(): AuditServices {
    return {
      store: new InMemoryAuditStore(),
      dispatcher: { dispatch: async () => undefined },
      tierScopes: TIER_SCOPES,
      cookieSecret: "test-cookie-secret",
      auth: new InMemoryAuthService(),
      rateLimiter: new InMemoryRateLimiter(),
      validateUrl: async (url: string) =>
        url.startsWith("https://") || url.startsWith("http://")
          ? { ok: true }
          : { ok: false, reason_key: "failure.url_invalid" },
      outputDir: "./output",
      geminiApiKey: undefined,
      emailService: new StubEmailService(),
    };
  }

  function makePipelineDeps(services: AuditServices): PipelineDeps {
    return {
      store: services.store,
      validateUrl: services.validateUrl,
      crawl: async () => undefined,
      render: async () => undefined,
      processEvidence: async () => ["ev-1"],
      runAgents: async () => [
        {
          agent_name: "auditor",
          ok: true,
          findings: [
            {
              finding_id: "f-1",
              result_state: "verified",
              confidence: "high",
              evidence_ids: ["ev-1"],
              data: { title: "Missing meta description", recommendation: "Add one", severity: "high" },
              limitations: [],
            },
          ],
          limitations: [],
          cost: { engine: "stub", tokens_in: 1, tokens_out: 1, usd: 0.001 },
        },
        { agent_name: "keyword-analyst", ok: true, findings: [], limitations: [] },
        { agent_name: "content-strategist", ok: true, findings: [], limitations: [] },
      ],
      runConnectors: async () => [],
      tierScopes: services.tierScopes,
    };
  }

  afterEach(() => {
    setAuditServicesForTests(null);
  });

  describe("audit completion email", () => {
    it("sends an email to the owning user when the audit completes", async () => {
      const services = makeServices();
      setAuditServicesForTests(services);
      const user = await services.auth.createUser("owner@example.com", "password123");
      const record = await services.store.create({
        targetUrl: "https://example.com",
        locale: "en",
        context: CONTEXT,
        tier: "rich",
        secretHash: "sha256:" + "a".repeat(64),
        ttlDays: 7,
        userId: user.id,
      });

      await runAuditPipeline(
        {
          ...makePipelineDeps(services),
          onComplete: async (completed: AuditRecord) => {
            if (!completed.user_id) return;
            const owner = await services.auth.findUserById(completed.user_id);
            if (!owner) return;
            const { subject, html, text } = auditCompletionTemplate({
              locale: completed.locale,
              siteUrl: completed.target_url,
              score: completed.report?.score?.presence_readiness ?? 0,
              reportUrl: `http://localhost:3000/${completed.locale}/audit/${completed.id}`,
            });
            void services.emailService
              .send({ to: owner.email, subject, html, text, locale: completed.locale })
              .catch(() => undefined);
          },
        },
        record.id,
      );

      const sent = (services.emailService as StubEmailService).getSent();
      expect(sent).toHaveLength(1);
      expect(sent[0]!.to).toBe("owner@example.com");
      expect(sent[0]!.subject).toBe("Your WPI audit for example.com is ready");
      expect(sent[0]!.html).toContain(`/en/audit/${record.id}`);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  pnpm --filter @wpi/web test src/test/api-audits-email.test.ts
  ```
  Expected: FAIL — `emailService` missing from `AuditServices` type or `makeServices` helper.

- [ ] **Step 3: Write minimal implementation**
  Update `apps/web/src/test/api-audits-post.test.ts` `makeServices` to include `emailService: new StubEmailService()`. No production code change is needed beyond the container work in Task 8.

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  pnpm --filter @wpi/web test src/test/api-audits-email.test.ts
  ```
  Expected: PASS — audit completion email is captured by the stub adapter.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web
  git commit -m "Add web integration test for audit completion email"
  ```

---

### Task 13: Update environment placeholders and run full verification

**Files:**
- Modify: `apps/web/.env.local`
- Modify: `README.md` (add email env vars to local dev section)

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `NEXT_PUBLIC_APP_URL`
- Produces: documented local dev defaults

- [ ] **Step 1: Write the failing test**
  Run the format check:
  ```bash
  pnpm format:check
  ```
  Expected: FAIL or warnings if new code violates formatting.

- [ ] **Step 2: Run test to verify it fails**
  (Same command as Step 1; note any formatting issues.)

- [ ] **Step 3: Write minimal implementation**
  1. Update `apps/web/.env.local` to add email placeholders after the existing `NEXT_PUBLIC_APP_URL` line:
     ```bash
     # Email (Resend for production; leave blank to use the stub adapter locally)
     RESEND_API_KEY=
     EMAIL_FROM_ADDRESS=noreply@example.com
     ```
  2. Add a short section to `README.md` under local environment variables listing `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS`.
  3. Run `pnpm format` to fix any formatting issues.

- [ ] **Step 4: Run test to verify it passes**
  Run the full verification suite:
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @wpi/email build
  pnpm --filter @wpi/email test
  pnpm --filter @wpi/auth test
  pnpm --filter @wpi/audit-pipeline test
  pnpm --filter @wpi/web test
  pnpm typecheck
  pnpm lint
  pnpm format:check
  ```
  Expected: all commands pass.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/.env.local README.md
  git commit -m "Document email environment variables and apply formatting"
  ```

---

## Self-review checklist

Before marking the milestone complete, verify:

- **Spec coverage:**
  - [ ] `@wpi/email` package exists with `EmailService` port, `ResendEmailService`, `StubEmailService`, and typed `EmailSendError`.
  - [ ] Bilingual EN/AR templates exist for `audit-completion` and `password-reset` and produce the spec subjects.
  - [ ] `password_reset_tokens` table migration is present and applied.
  - [ ] `@wpi/auth` supports `findUserById`, `createPasswordResetToken`, and `consumePasswordResetToken`.
  - [ ] Audit pipeline has an `onComplete` hook that receives the completed record.
  - [ ] Web container wires the email adapter and sends an audit-completion email to signed-in owners via a fire-and-forget Promise.
  - [ ] `POST /api/auth/forgot-password` validates email, creates a token, sends an email, and returns `200` for all inputs.
  - [ ] `POST /api/auth/reset-password` validates token and password, updates the password, and returns `200` on success or `400` on invalid token.
  - [ ] Forgot-password and reset-password UI pages exist and are reachable.

- **Placeholder scan:**
  - [ ] No `TBD`, `TODO`, `implement later`, or `write tests for the above` remain in new or modified code.
  - [ ] No real secrets committed (`.env.local` contains only empty/default values).

- **Type consistency:**
  - [ ] All new code uses strict TypeScript, `import type` for type-only imports, and `.js` extensions.
  - [ ] `pnpm typecheck` passes across the workspace.
  - [ ] `pnpm lint` and `pnpm format:check` pass.

### Critical Files for Implementation

- `packages/email/src/resend-adapter.ts`
- `packages/email/src/stub-adapter.ts`
- `packages/email/src/templates/audit-completion/index.ts`
- `packages/email/src/templates/password-reset/index.ts`
- `packages/auth/src/auth-service.ts`
- `packages/auth/src/pg-auth-service.ts`
- `packages/audit-pipeline/src/pipeline.ts`
- `apps/web/src/services/container.ts`
- `apps/web/src/app/api/auth/forgot-password/route.ts`
- `apps/web/src/app/api/auth/reset-password/route.ts`
