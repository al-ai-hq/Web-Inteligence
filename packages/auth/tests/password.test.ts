import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  SALT_BYTES,
  KEY_BYTES,
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
} from "../src/password.js";

describe("hashPassword", () => {
  it("returns salt$hash with correct hex lengths", async () => {
    const result = await hashPassword("test-password");
    const parts = result.split("$");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(SALT_BYTES * 2);
    expect(parts[1]).toHaveLength(KEY_BYTES * 2);
  });

  it("produces unique salts for each call", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for the wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it.each(["", "no-separator", "$deadbeef", "zz$deadbeef"])(
    "returns false for malformed stored value: %s",
    async (malformed) => {
      expect(await verifyPassword("anything", malformed)).toBe(false);
    },
  );
});

describe("constants", () => {
  it("exports scrypt parameters", () => {
    expect(SCRYPT_N).toBe(16384);
    expect(SCRYPT_R).toBe(8);
    expect(SCRYPT_P).toBe(1);
    expect(SALT_BYTES).toBe(16);
    expect(KEY_BYTES).toBe(64);
  });
});
