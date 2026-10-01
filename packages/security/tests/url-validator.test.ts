import { describe, it, expect } from "vitest";
import { validateUrl } from "../src/url-validator.js";

describe("validateUrl", () => {
  it("accepts https URL", async () => {
    const result = await validateUrl("https://example.com/page");
    expect(result.valid).toBe(true);
  });

  it("accepts http URL", async () => {
    const result = await validateUrl("http://example.com/page");
    expect(result.valid).toBe(true);
  });

  it("rejects file:// scheme", async () => {
    const result = await validateUrl("file:///etc/passwd");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("scheme");
  });

  it("rejects ftp:// scheme", async () => {
    const result = await validateUrl("ftp://example.com/file");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("scheme");
  });

  it("rejects URL with credentials", async () => {
    const result = await validateUrl("https://user:pass@example.com");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("credentials");
  });

  it("rejects URL with @ in authority", async () => {
    const result = await validateUrl("https://user@example.com");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("credentials");
  });

  it("accepts port 443", async () => {
    const result = await validateUrl("https://example.com:443/page");
    expect(result.valid).toBe(true);
  });

  it("accepts port 80", async () => {
    const result = await validateUrl("http://example.com:80/page");
    expect(result.valid).toBe(true);
  });

  it("rejects port 8080", async () => {
    const result = await validateUrl("http://example.com:8080/page");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("port");
  });

  it("rejects port 22", async () => {
    const result = await validateUrl("http://example.com:22/page");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("port");
  });

  it("rejects metadata.google.internal", async () => {
    const result = await validateUrl("http://metadata.google.internal/computeMetadata");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("metadata");
  });

  it("rejects 169.254.169.254", async () => {
    const result = await validateUrl("http://169.254.169.254/computeMetadata");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("metadata");
  });
});
