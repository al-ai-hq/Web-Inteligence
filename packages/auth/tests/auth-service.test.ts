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
    if (!result) throw new Error("expected user");
    expect(result.email).toBe("user@example.com");
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
    if (!found) throw new Error("expected user");
    expect(found.id).toBe(user.id);
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

describe("InMemoryAuthService password reset", () => {
  it("finds a user by id", async () => {
    const auth = new InMemoryAuthService();
    const user = await auth.createUser("find@example.com", "password123");
    const found = await auth.findUserById(user.id);
    expect(found).not.toBeNull();
    if (!found) throw new Error("expected user");
    expect(found.email).toBe("find@example.com");
  });

  it("returns null for unknown user id", async () => {
    const auth = new InMemoryAuthService();
    expect(await auth.findUserById("no-such-id")).toBeNull();
  });
});
