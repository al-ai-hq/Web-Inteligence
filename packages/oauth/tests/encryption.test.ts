import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "../src/encryption.js";

const HEX_KEY = Buffer.alloc(32, "a").toString("hex");
const B64_KEY = Buffer.alloc(32, "a").toString("base64");

describe("encryption", () => {
  beforeEach(() => {
    process.env["ENCRYPTION_KEY"] = HEX_KEY;
  });

  afterEach(() => {
    delete process.env["ENCRYPTION_KEY"];
    delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
  });

  it("encrypts and decrypts plaintext with ENCRYPTION_KEY (hex)", () => {
    const plaintext = "test-access-token";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("falls back to WPI_OAUTH_ENCRYPTION_KEY (base64)", () => {
    delete process.env["ENCRYPTION_KEY"];
    process.env["WPI_OAUTH_ENCRYPTION_KEY"] = B64_KEY;
    const plaintext = "test-access-token";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "test-access-token";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toEqual(encrypted2);
  });

  it("throws if encryption key is missing", () => {
    delete process.env["ENCRYPTION_KEY"];
    delete process.env["WPI_OAUTH_ENCRYPTION_KEY"];
    expect(() => encrypt("test")).toThrow(
      "ENCRYPTION_KEY (or WPI_OAUTH_ENCRYPTION_KEY) environment variable is required",
    );
  });

  it("throws if ENCRYPTION_KEY is wrong length", () => {
    process.env["ENCRYPTION_KEY"] = Buffer.alloc(16, "a").toString("hex");
    expect(() => encrypt("test")).toThrow(
      "ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)",
    );
  });

  it("decrypt throws on tampered ciphertext", () => {
    const encrypted = encrypt("test-token");
    encrypted[20] = (encrypted[20]! + 1) % 256;
    expect(() => decrypt(encrypted)).toThrow();
  });
});
