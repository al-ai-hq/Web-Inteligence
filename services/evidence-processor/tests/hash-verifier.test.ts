import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { verifyHash } from "../src/hash-verifier.js";

describe("verifyHash", () => {
  it("returns match: true for correct hash", () => {
    const content = "hello world";
    const hash = createHash("sha256").update(content).digest("hex");
    const result = verifyHash(content, hash);
    expect(result.match).toBe(true);
  });

  it("returns match: false for incorrect hash", () => {
    const result = verifyHash(
      "hello world",
      "0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(result.match).toBe(false);
  });

  it("computes correct SHA-256", () => {
    const content = "hello world";
    const expected = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
    const result = verifyHash(content, expected);
    expect(result.computedHash).toBe(expected);
  });

  it("returns both hashes in result", () => {
    const content = "test content";
    const expectedHash = "abc123";
    const result = verifyHash(content, expectedHash);
    expect(result.expectedHash).toBe(expectedHash);
    expect(result.computedHash).toBe(createHash("sha256").update(content).digest("hex"));
  });

  it("handles empty string", () => {
    const emptyHash = createHash("sha256").update("").digest("hex");
    const result = verifyHash("", emptyHash);
    expect(result.match).toBe(true);
    expect(result.computedHash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("handles unicode content", () => {
    const content = "\u{1F600}\u{1F60D}\u{1F525}";
    const hash = createHash("sha256").update(content).digest("hex");
    const result = verifyHash(content, hash);
    expect(result.match).toBe(true);
  });

  it("handles large content (1MB)", () => {
    const content = "a".repeat(1024 * 1024);
    const hash = createHash("sha256").update(content).digest("hex");
    const result = verifyHash(content, hash);
    expect(result.match).toBe(true);
  });

  it("is case-sensitive on hash comparison", () => {
    const content = "hello world";
    const hash = createHash("sha256").update(content).digest("hex");
    const upperHash = hash.toUpperCase();
    const result = verifyHash(content, upperHash);
    expect(result.match).toBe(false);
  });
});
