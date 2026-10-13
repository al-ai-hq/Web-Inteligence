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

function authRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): NextRequest {
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
    const response = await signupPOST(
      authRequest("http://localhost:3000/api/auth/signup", body),
    );
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
