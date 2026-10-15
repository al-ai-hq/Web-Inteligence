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
