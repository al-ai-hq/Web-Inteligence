/**
 * TS-LOGREDACT: Log and payload redaction integration tests.
 *
 * Verifies that sensitive data (URLs with credentials, query params,
 * internal paths) is redacted in log output from interceptRequest().
 *
 * The redactUrl() function is private in request-interceptor.ts and
 * returns only the hostname. We test it indirectly by capturing
 * console.warn output during interceptRequest() calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InterceptableRequest } from "../../../render-job/src/request-interceptor.js";
import { interceptRequest } from "../../../render-job/src/request-interceptor.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@wpi/security", () => ({
  validateUrl: vi.fn(),
}));

import { validateUrl } from "@wpi/security";

const mockValidateUrl = vi.mocked(validateUrl);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockRequest(url: string, resourceType = "document"): InterceptableRequest {
  return {
    url: () => url,
    resourceType: () => resourceType,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
let warnSpy: ReturnType<typeof vi.spyOn>;
let warnMessages: string[];

beforeEach(() => {
  vi.clearAllMocks();
  warnMessages = [];
  warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnMessages.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// TS-LOGREDACT-1: URL redaction — query params not leaked
// ---------------------------------------------------------------------------
describe("TS-LOGREDACT-1: URL redaction in warnings", () => {
  it("redacts query parameters from URL in warning log", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    await interceptRequest(
      mockRequest("http://10.0.0.1/admin?token=secret123&user=admin"),
    );
    expect(warnMessages.length).toBeGreaterThan(0);
    const logOutput = warnMessages.join("\n");
    // The full URL with query params should NOT appear
    expect(logOutput).not.toContain("token=secret123");
    expect(logOutput).not.toContain("user=admin");
    expect(logOutput).not.toContain("?token=");
  });

  it("redacts path from URL in warning log", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    await interceptRequest(mockRequest("http://10.0.0.1/secret/internal/path"));
    const logOutput = warnMessages.join("\n");
    // The path should not appear in the log
    expect(logOutput).not.toContain("/secret/internal/path");
  });

  it("shows only hostname in warning log", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "metadata hostname blocked" });
    await interceptRequest(
      mockRequest("http://metadata.google.internal/computeMetadata/v1/?format=json"),
    );
    const logOutput = warnMessages.join("\n");
    // Hostname should be present
    expect(logOutput).toContain("metadata.google.internal");
    // But not the full path or query
    expect(logOutput).not.toContain("/computeMetadata");
    expect(logOutput).not.toContain("format=json");
  });
});

// ---------------------------------------------------------------------------
// TS-LOGREDACT-2: Credentials redaction
// ---------------------------------------------------------------------------
describe("TS-LOGREDACT-2: Credentials redaction in logs", () => {
  it("redacts credentials embedded in URL", async () => {
    // interceptRequest will parse the URL and redact it
    // Even though validateUrl would reject credentials, the log should
    // not contain the username or password
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "credentials not allowed" });
    await interceptRequest(mockRequest("http://admin:s3cretP@ss@example.com/admin"));
    const logOutput = warnMessages.join("\n");
    expect(logOutput).not.toContain("admin:s3cretP@ss");
    expect(logOutput).not.toContain("s3cretP@ss");
  });

  it("does not leak API keys from URL path in logs", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    await interceptRequest(
      mockRequest("http://10.0.0.1/api/v1?key=sk-live-abc123xyz"),
    );
    const logOutput = warnMessages.join("\n");
    expect(logOutput).not.toContain("sk-live-abc123xyz");
    expect(logOutput).not.toContain("key=");
  });
});

// ---------------------------------------------------------------------------
// TS-LOGREDACT-3: Error message redaction
// ---------------------------------------------------------------------------
describe("TS-LOGREDACT-3: Error context redaction", () => {
  it("warning includes SSRF attempt context without leaking full URL", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "port not allowed" });
    await interceptRequest(mockRequest("http://example.com:8080/admin?password=test"));
    const logOutput = warnMessages.join("\n");
    // Should mention SSRF blocking
    expect(logOutput).toMatch(/SSRF|blocked/i);
    // Should include the reason
    expect(logOutput).toMatch(/port/i);
    // Should NOT include the password or full path
    expect(logOutput).not.toContain("password=test");
    expect(logOutput).not.toContain("/admin?");
  });

  it("warning for invalid URL does not leak content", async () => {
    // Completely invalid URL
    await interceptRequest(mockRequest("not-a-valid-url-at-all"));
    const logOutput = warnMessages.join("\n");
    // Should have some warning
    expect(warnMessages.length).toBeGreaterThan(0);
    // Should indicate invalid URL
    expect(logOutput).toMatch(/invalid/i);
  });

  it("warning for disallowed scheme includes scheme info safely", async () => {
    await interceptRequest(mockRequest("file:///etc/passwd"));
    const logOutput = warnMessages.join("\n");
    expect(warnMessages.length).toBeGreaterThan(0);
    // Should mention the scheme
    expect(logOutput).toMatch(/file:/i);
    // Should NOT contain the actual file path
    expect(logOutput).not.toContain("/etc/passwd");
  });
});

// ---------------------------------------------------------------------------
// TS-LOGREDACT-4: Allowed requests produce no warnings
// ---------------------------------------------------------------------------
describe("TS-LOGREDACT-4: Allowed requests produce no warnings", () => {
  it("does not log warning for allowed request", async () => {
    mockValidateUrl.mockResolvedValue({ valid: true, pinnedIp: "93.184.216.34" });
    const allowed = await interceptRequest(mockRequest("https://example.com/page"));
    expect(allowed).toBe(true);
    expect(warnMessages.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TS-LOGREDACT-5: Invalid URL handling
// ---------------------------------------------------------------------------
describe("TS-LOGREDACT-5: Invalid URL redaction", () => {
  it("handles empty URL without leaking data", async () => {
    await interceptRequest(mockRequest(""));
    const logOutput = warnMessages.join("\n");
    expect(warnMessages.length).toBeGreaterThan(0);
    // Should handle gracefully
    expect(logOutput).toMatch(/SSRF|blocked|invalid/i);
  });

  it("handles data: URI without executing or leaking content", async () => {
    await interceptRequest(mockRequest("data:text/html,<script>document.cookie</script>"));
    const logOutput = warnMessages.join("\n");
    expect(warnMessages.length).toBeGreaterThan(0);
    // The actual script content should not be in the log
    expect(logOutput).not.toContain("document.cookie");
  });
});
