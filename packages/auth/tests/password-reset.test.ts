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
