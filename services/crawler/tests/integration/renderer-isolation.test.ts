/**
 * TS-RENDER: Renderer isolation integration tests.
 *
 * Tests interceptRequest() from the render-job request-interceptor.
 * Verifies that the renderer's security boundary properly blocks
 * private IPs, metadata hosts, non-HTTP schemes, and localhost.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InterceptableRequest } from "../../../render-job/src/request-interceptor.js";
import { interceptRequest } from "../../../render-job/src/request-interceptor.js";

// ---------------------------------------------------------------------------
// Mocks — interceptRequest calls validateUrl which does real DNS.
// We mock @wpi/security to control DNS outcomes deterministically.
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
beforeEach(() => {
  vi.clearAllMocks();
  // Suppress console.warn from interceptRequest during tests
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// TS-RENDER-1: Request interception — blocks private IPs
// ---------------------------------------------------------------------------
describe("TS-RENDER-1: Request interception blocks private IPs", () => {
  it("blocks request to 10.0.0.1", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://10.0.0.1/secret"));
    expect(allowed).toBe(false);
  });

  it("blocks request to 192.168.1.1", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://192.168.1.1/admin"));
    expect(allowed).toBe(false);
  });

  it("blocks request to 127.0.0.1", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://127.0.0.1/"));
    expect(allowed).toBe(false);
  });

  it("blocks request to 169.254.169.254 (metadata)", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "metadata IP blocked" });
    const allowed = await interceptRequest(
      mockRequest("http://169.254.169.254/latest/meta-data/"),
    );
    expect(allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TS-RENDER-2: Scheme validation — only http: and https:
// ---------------------------------------------------------------------------
describe("TS-RENDER-2: Scheme validation", () => {
  it("blocks file:// scheme", async () => {
    // interceptRequest checks scheme before validateUrl
    const allowed = await interceptRequest(mockRequest("file:///etc/passwd"));
    expect(allowed).toBe(false);
  });

  it("blocks javascript: scheme", async () => {
    const allowed = await interceptRequest(mockRequest("javascript:alert(1)"));
    expect(allowed).toBe(false);
  });

  it("blocks data: scheme", async () => {
    const allowed = await interceptRequest(mockRequest("data:text/html,<h1>hi</h1>"));
    expect(allowed).toBe(false);
  });

  it("blocks ftp:// scheme", async () => {
    const allowed = await interceptRequest(mockRequest("ftp://example.com/file"));
    expect(allowed).toBe(false);
  });

  it("allows http:// when validateUrl passes", async () => {
    mockValidateUrl.mockResolvedValue({ valid: true, pinnedIp: "93.184.216.34" });
    const allowed = await interceptRequest(mockRequest("http://example.com/"));
    expect(allowed).toBe(true);
  });

  it("allows https:// when validateUrl passes", async () => {
    mockValidateUrl.mockResolvedValue({ valid: true, pinnedIp: "93.184.216.34" });
    const allowed = await interceptRequest(mockRequest("https://example.com/"));
    expect(allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TS-RENDER-3: SSRF defense in renderer — metadata hosts
// ---------------------------------------------------------------------------
describe("TS-RENDER-3: SSRF defense for metadata hosts", () => {
  it("blocks metadata.google.internal", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "metadata hostname blocked" });
    const allowed = await interceptRequest(
      mockRequest("http://metadata.google.internal/computeMetadata/v1/"),
    );
    expect(allowed).toBe(false);
  });

  it("blocks metadata.internal", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "metadata hostname blocked" });
    const allowed = await interceptRequest(mockRequest("http://metadata.internal/"));
    expect(allowed).toBe(false);
  });

  it("blocks 169.254.169.254 (AWS metadata)", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "metadata IP blocked" });
    const allowed = await interceptRequest(
      mockRequest("http://169.254.169.254/latest/meta-data/iam/security-credentials/"),
    );
    expect(allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TS-RENDER-4: Localhost blocking
// ---------------------------------------------------------------------------
describe("TS-RENDER-4: Localhost blocking", () => {
  it("blocks localhost hostname", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "DNS resolution returned only non-public addresses" });
    const allowed = await interceptRequest(mockRequest("http://localhost/"));
    expect(allowed).toBe(false);
  });

  it("blocks 127.0.0.1", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://127.0.0.1:3000/"));
    expect(allowed).toBe(false);
  });

  it("blocks [::1] IPv6 loopback", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://[::1]/"));
    expect(allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TS-RENDER-5: Invalid URLs
// ---------------------------------------------------------------------------
describe("TS-RENDER-5: Invalid URL handling", () => {
  it("blocks completely invalid URL strings", async () => {
    const allowed = await interceptRequest(mockRequest("not-a-url"));
    expect(allowed).toBe(false);
  });

  it("blocks empty string URL", async () => {
    const allowed = await interceptRequest(mockRequest(""));
    expect(allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TS-RENDER-6: Resource type does not bypass security
// ---------------------------------------------------------------------------
describe("TS-RENDER-6: Resource type does not bypass security", () => {
  it("blocks private IP even for image resource type", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://10.0.0.1/img.png", "image"));
    expect(allowed).toBe(false);
  });

  it("blocks private IP even for script resource type", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://10.0.0.1/evil.js", "script"));
    expect(allowed).toBe(false);
  });

  it("blocks private IP even for stylesheet resource type", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP blocked" });
    const allowed = await interceptRequest(mockRequest("http://10.0.0.1/style.css", "stylesheet"));
    expect(allowed).toBe(false);
  });
});
