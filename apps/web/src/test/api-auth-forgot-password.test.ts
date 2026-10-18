import { describe, expect, it, afterEach } from "vitest";
import { InMemoryAuditStore, InMemoryOutcomeStore, TIER_SCOPES } from "@wpi/audit-pipeline";
import { InMemoryAuthService } from "@wpi/auth";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { StubEmailService } from "@wpi/email";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/forgot-password/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

function makeServices(): AuditServices {
  return {
    store: new InMemoryAuditStore(),
    outcomeStore: new InMemoryOutcomeStore(),
    dispatcher: { dispatch: () => Promise.resolve(undefined) },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new InMemoryRateLimiter(),
    validateUrl: () => Promise.resolve({ ok: true }),
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
    const first = sent[0];
    if (!first) throw new Error("expected one email");
    expect(first.to).toBe("reset@example.com");
    expect(first.subject).toBe("Reset your WPI password");
    expect(first.html).toContain("reset-password?token=");
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
