import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "../src/encryption.js";

describe("encryption", () => {
  beforeEach(() => {
    process.env["WPI_OAUTH_ENCRYPTION_KEY"] = Buffer.alloc(32, "a").toString("base64");
  });

  afterEach(() => {
    delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
  });

  it("encrypts and decrypts plaintext", () => {
    const plaintext = "test-access-token";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "test-access-token";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toEqual(encrypted2);
  });

  it("throws if encryption key is missing", () => {
    delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
    expect(() => encrypt("test")).toThrow(
      "WPI_OAUTH_ENCRYPTION_KEY environment variable is required",
    );
  });

  it("throws if encryption key is wrong length", () => {
    process.env["WPI_OAUTH_ENCRYPTION_KEY"] = Buffer.alloc(16, "a").toString("base64");
    expect(() => encrypt("test")).toThrow(
      "WPI_OAUTH_ENCRYPTION_KEY must be 32 bytes (base64-encoded)",
    );
  });

  it("decrypt throws on tampered ciphertext", () => {
    const encrypted = encrypt("test-token");
    encrypted[20] = (encrypted[20]! + 1) % 256;
    expect(() => decrypt(encrypted)).toThrow();
  });
});
