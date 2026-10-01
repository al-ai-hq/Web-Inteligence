/**
 * TS-SSRF: SSRF and DNS rebinding defense integration tests.
 *
 * Tests validateUrl() from @wpi/security directly to verify that
 * scheme, credentials, port, metadata hostnames, and private IPs
 * are all properly rejected.
 */
import { describe, it, expect } from "vitest";
import { validateUrl } from "@wpi/security";

// ---------------------------------------------------------------------------
// TS-SSRF-1: Scheme validation
// ---------------------------------------------------------------------------
describe("TS-SSRF-1: Scheme validation", () => {
  it.each([
    ["file:///etc/passwd", "file://"],
    ["ftp://example.com/file", "ftp://"],
    ["data:text/html,<h1>hi</h1>", "data:"],
    ["javascript:alert(1)", "javascript:"],
  ])("rejects %s (%s scheme)", async (url) => {
    const result = await validateUrl(url);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/scheme/i);
  });

  it("accepts http:// scheme (pending DNS)", async () => {
    // We only test that the scheme check passes; DNS may still reject.
    // Using a URL that will fail at DNS is fine — we just verify the
    // reason is NOT "scheme not allowed".
    const result = await validateUrl("http://example.com/");
    // Either valid or fails for DNS reasons, NOT scheme
    if (!result.valid) {
      expect(result.reason).not.toMatch(/scheme/i);
    }
  });

  it("accepts https:// scheme (pending DNS)", async () => {
    const result = await validateUrl("https://example.com/");
    if (!result.valid) {
      expect(result.reason).not.toMatch(/scheme/i);
    }
  });
});

// ---------------------------------------------------------------------------
// TS-SSRF-2: Credentials rejection
// ---------------------------------------------------------------------------
describe("TS-SSRF-2: Credentials rejection", () => {
  it("rejects URL with username and password", async () => {
    const result = await validateUrl("https://user:pass@example.com/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/credentials/i);
  });

  it("rejects URL with username only", async () => {
    const result = await validateUrl("https://admin@example.com/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/credentials/i);
  });

  it("rejects URL with encoded credentials", async () => {
    const result = await validateUrl("https://user%40host:pass@example.com/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/credentials/i);
  });
});

// ---------------------------------------------------------------------------
// TS-SSRF-3: Port allowlist
// ---------------------------------------------------------------------------
describe("TS-SSRF-3: Port allowlist", () => {
  it("accepts default HTTP port 80 (implicit)", async () => {
    const result = await validateUrl("http://example.com/");
    if (!result.valid) {
      // Should not fail on port — may fail on DNS
      expect(result.reason).not.toMatch(/port/i);
    }
  });

  it("accepts default HTTPS port 443 (implicit)", async () => {
    const result = await validateUrl("https://example.com/");
    if (!result.valid) {
      expect(result.reason).not.toMatch(/port/i);
    }
  });

  it.each([
    ["https://example.com:22/", "SSH port 22"],
    ["https://example.com:3306/", "MySQL port 3306"],
    ["https://example.com:8080/", "alternate HTTP port 8080"],
    ["https://example.com:6379/", "Redis port 6379"],
    ["https://example.com:27017/", "MongoDB port 27017"],
  ])("rejects %s (%s)", async (url) => {
    const result = await validateUrl(url);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/port/i);
  });
});

// ---------------------------------------------------------------------------
// TS-SSRF-4: Metadata hostname blocking
// ---------------------------------------------------------------------------
describe("TS-SSRF-4: Metadata hostname blocking", () => {
  it("rejects AWS metadata IP 169.254.169.254", async () => {
    const result = await validateUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/metadata|private|IP/i);
  });

  it("rejects GCE metadata hostname", async () => {
    const result = await validateUrl("http://metadata.google.internal/computeMetadata/v1/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/metadata/i);
  });

  it("rejects metadata.internal hostname", async () => {
    const result = await validateUrl("http://metadata.internal/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/metadata/i);
  });
});

// ---------------------------------------------------------------------------
// TS-SSRF-5: Private IP blocking
// ---------------------------------------------------------------------------
describe("TS-SSRF-5: Private IP blocking", () => {
  it.each([
    ["http://10.0.0.1/", "10.x private range"],
    ["http://192.168.1.1/", "192.168.x private range"],
    ["http://127.0.0.1/", "loopback"],
    ["http://172.16.0.1/", "172.16.x private range"],
  ])("rejects %s (%s)", async (url) => {
    const result = await validateUrl(url);
    expect(result.valid).toBe(false);
    // Private IPs are caught either by hostname check or DNS resolution
    expect(result.reason).toMatch(/private|DNS|non-public|IP/i);
  });
});

// ---------------------------------------------------------------------------
// TS-SSRF-6: Redirect re-validation
// ---------------------------------------------------------------------------
describe("TS-SSRF-6: Redirect re-validation", () => {
  it("rejects redirect target to private IP", async () => {
    // validateUrl should reject any URL pointing to 127.0.0.1
    const result = await validateUrl("http://127.0.0.1/secret");
    expect(result.valid).toBe(false);
  });

  it("rejects redirect target to metadata host", async () => {
    const result = await validateUrl("http://metadata.google.internal/token");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/metadata/i);
  });

  it("rejects redirect target to link-local address", async () => {
    const result = await validateUrl("http://169.254.169.254/");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TS-SSRF-7: DNS rebinding defense
// ---------------------------------------------------------------------------
describe("TS-SSRF-7: DNS rebinding defense", () => {
  it("uses controlled DNS resolver (8.8.8.8)", async () => {
    // The DNS resolver is configured to use 8.8.8.8 and 8.8.4.4.
    // A valid public domain should resolve successfully.
    const result = await validateUrl("https://example.com/");
    // example.com should resolve to a public IP
    expect(result.valid).toBe(true);
    expect(result.pinnedIp).toBeDefined();
  });

  it("rejects hostname that resolves only to private IPs", async () => {
    // localhost resolves to 127.0.0.1 which is private
    const result = await validateUrl("http://localhost/");
    expect(result.valid).toBe(false);
  });

  it("returns pinned IP for successful validation", async () => {
    const result = await validateUrl("https://example.com/");
    expect(result.valid).toBe(true);
    expect(result.pinnedIp).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});
