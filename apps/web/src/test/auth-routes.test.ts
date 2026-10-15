import { afterEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore, TIER_SCOPES } from "@wpi/audit-pipeline";
import { InMemoryAuthService } from "@wpi/auth";
import { StubEmailService } from "@wpi/email";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/route";
import { setAuditServicesForTests, type AuditServices } from "../services/container";

function makeServices(): AuditServices {
  const store = new InMemoryAuditStore();
  return {
    store,
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

describe("POST /api/auth?action=signup", () => {
  it("creates a user and sets session cookie", async () => {
    setAuditServicesForTests(makeServices());
    const response = await POST(
      authRequest("http://localhost:3000/api/auth?action=signup", {
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
    await POST(authRequest("http://localhost:3000/api/auth?action=signup", body));
    const response = await POST(authRequest("http://localhost:3000/api/auth?action=signup", body));
    expect(response.status).toBe(409);
  });

  it("rejects short password with 400", async () => {
    setAuditServicesForTests(makeServices());
    const response = await POST(
      authRequest("http://localhost:3000/api/auth?action=signup", {
        email: "short@example.com",
        password: "short",
        confirm_password: "short",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth?action=login", () => {
  it("returns 200 and sets cookie on success", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    await services.auth.createUser("login@example.com", "password123");

    const response = await POST(
      authRequest("http://localhost:3000/api/auth?action=login", {
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

    const response = await POST(
      authRequest("http://localhost:3000/api/auth?action=login", {
        email: "wrong@example.com",
        password: "wrong-password",
      }),
    );
    expect(response.status).toBe(401);
  });
});

describe("POST /api/auth?action=logout", () => {
  it("clears the session cookie", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    const user = await services.auth.createUser("out@example.com", "password123");
    const session = await services.auth.createSession(user.id);

    const request = new NextRequest("http://localhost:3000/api/auth?action=logout", {
      method: "POST",
      headers: { cookie: `wpi_session=${session.token}` },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("wpi_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
