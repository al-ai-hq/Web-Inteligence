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
