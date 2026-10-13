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
