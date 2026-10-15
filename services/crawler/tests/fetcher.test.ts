import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { CrawlConfig } from "../src/config/schema.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("undici", () => ({
  request: vi.fn(),
  Agent: vi.fn().mockImplementation(function () {
    return { close: vi.fn() };
  }),
}));

vi.mock("@wpi/security", async () => {
  const actual = await vi.importActual<typeof import("@wpi/security")>("@wpi/security");
  return {
    ...actual,
    validateUrl: vi.fn(),
  };
});

import { request } from "undici";
import { validateUrl } from "@wpi/security";
import { fetchUrl } from "../src/fetcher.js";

const mockRequest = vi.mocked(request);
const mockValidateUrl = vi.mocked(validateUrl);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function defaultConfig(overrides?: Partial<CrawlConfig>): CrawlConfig {
  return {
    max_pages: 10,
    max_depth: 3,
    timeout_seconds: 60,
    request_timeout_seconds: 30,
    concurrency: 2,
    render_text_threshold_bytes: 1_000_000,
    allowed_ports: [80, 443],
    max_response_size_bytes: 10 * 1024 * 1024, // 10 MB
    max_decompressed_size_bytes: 100 * 1024 * 1024, // 100 MB
    ...overrides,
  };
}

function mockResponse(
  statusCode: number,
  body: string,
  headers?: Record<string, string | string[]>,
) {
  return {
    statusCode,
    headers: headers ?? {},
    body: {
      text: async () => body,
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  // Default: validateUrl succeeds
  mockValidateUrl.mockResolvedValue({ valid: true, pinnedIp: "93.184.216.34" });
});

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
describe("fetchUrl", () => {
  it("returns body, hash, status, and finalUrl on successful fetch", async () => {
    const body = "<html>Hello</html>";
    mockRequest.mockResolvedValueOnce(mockResponse(200, body, { "content-type": "text/html" }));

    const result = await fetchUrl("https://example.com/", defaultConfig());

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(body);
    expect(result.finalUrl).toBe("https://example.com/");
    expect(result.contentHash).toBe(createHash("sha256").update(body).digest("hex"));
    expect(result.redirectChain).toEqual(["https://example.com/"]);
    expect(result.contentType).toBe("text/html");
  });

  it("computes correct SHA-256 content hash", async () => {
    const body = "test content for hashing";
    mockRequest.mockResolvedValueOnce(mockResponse(200, body));

    const result = await fetchUrl("https://example.com/", defaultConfig());

    const expectedHash = createHash("sha256").update(body).digest("hex");
    expect(result.contentHash).toBe(expectedHash);
  });

  it("follows redirect after re-validating the new URL", async () => {
    const redirectUrl = "https://example.com/final";
    // First request: 301 redirect
    mockRequest.mockResolvedValueOnce(mockResponse(301, "", { location: redirectUrl }));
    // Second request: 200 OK
    mockRequest.mockResolvedValueOnce(
      mockResponse(200, "final body", { "content-type": "text/html" }),
    );

    const result = await fetchUrl("https://example.com/", defaultConfig());

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("final body");
    expect(result.finalUrl).toBe(redirectUrl);
    // validateUrl called for initial URL and redirect target
    expect(mockValidateUrl).toHaveBeenCalledTimes(2);
    expect(mockValidateUrl).toHaveBeenCalledWith("https://example.com/");
    expect(mockValidateUrl).toHaveBeenCalledWith(redirectUrl);
  });

  it("throws when redirect target is blocked by SSRF validation", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse(302, "", { location: "http://metadata.google.internal/" }),
    );
    // Second call to validateUrl returns invalid
    mockValidateUrl.mockResolvedValueOnce({ valid: true, pinnedIp: "93.184.216.34" });
    mockValidateUrl.mockResolvedValueOnce({ valid: false, reason: "metadata hostname blocked" });

    await expect(fetchUrl("https://example.com/", defaultConfig())).rejects.toThrow(
      /SSRF|metadata hostname blocked/i,
    );
  });

  it("throws when redirect target resolves to private IP (127.0.0.1)", async () => {
    mockRequest.mockResolvedValueOnce(mockResponse(302, "", { location: "https://localhost/" }));
    mockValidateUrl.mockResolvedValueOnce({ valid: true, pinnedIp: "93.184.216.34" });
    mockValidateUrl.mockResolvedValueOnce({ valid: false, reason: "private IP blocked" });

    await expect(fetchUrl("https://example.com/", defaultConfig())).rejects.toThrow(
      /SSRF|private IP blocked/i,
    );
  });

  it("throws when max redirects (10) exceeded", async () => {
    // Every request returns a redirect
    for (let i = 0; i < 12; i++) {
      mockRequest.mockResolvedValueOnce(
        mockResponse(302, "", { location: `https://example.com/redirect-${i}` }),
      );
    }

    await expect(fetchUrl("https://example.com/", defaultConfig())).rejects.toThrow(
      /max redirects/i,
    );
  });

  it("throws when response body exceeds max_response_size_bytes", async () => {
    const smallConfig = defaultConfig({ max_response_size_bytes: 10 });
    const largeBody = "x".repeat(100);
    mockRequest.mockResolvedValueOnce(mockResponse(200, largeBody));

    await expect(fetchUrl("https://example.com/", smallConfig)).rejects.toThrow(
      /too large|response size/i,
    );
  });

  it("throws when initial URL fails validation", async () => {
    mockValidateUrl.mockResolvedValueOnce({ valid: false, reason: "scheme not allowed" });

    await expect(fetchUrl("ftp://example.com/", defaultConfig())).rejects.toThrow(
      /SSRF|scheme not allowed/i,
    );
    // Should not have made any HTTP request
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("records all URLs in the redirect chain", async () => {
    const chain = [
      "https://example.com/",
      "https://example.com/step1",
      "https://example.com/step2",
      "https://example.com/final",
    ];

    // First two are redirects
    mockRequest.mockResolvedValueOnce(mockResponse(301, "", { location: chain[1] }));
    mockRequest.mockResolvedValueOnce(mockResponse(301, "", { location: chain[2] }));
    mockRequest.mockResolvedValueOnce(mockResponse(301, "", { location: chain[3] }));
    mockRequest.mockResolvedValueOnce(mockResponse(200, "done"));

    const result = await fetchUrl(chain[0]!, defaultConfig());

    expect(result.redirectChain).toEqual(chain);
  });

  it("applies request_timeout_seconds from config", async () => {
    mockRequest.mockResolvedValueOnce(mockResponse(200, "ok"));

    await fetchUrl("https://example.com/", defaultConfig({ request_timeout_seconds: 15 }));

    expect(mockRequest).toHaveBeenCalledWith(
      "https://93.184.216.34/",
      expect.objectContaining({
        headersTimeout: 15_000,
        bodyTimeout: 15_000,
      }),
    );
  });

  it("throws when response body exceeds max_decompressed_size_bytes", async () => {
    const smallConfig = defaultConfig({ max_decompressed_size_bytes: 50 });
    const largeBody = "x".repeat(200);
    mockRequest.mockResolvedValueOnce(mockResponse(200, largeBody));

    await expect(fetchUrl("https://example.com/", smallConfig)).rejects.toThrow(
      /decompressed|too large/i,
    );
  });

  it("throws on 3xx redirect without location header", async () => {
    mockRequest.mockResolvedValueOnce(mockResponse(302, ""));

    await expect(fetchUrl("https://example.com/", defaultConfig())).rejects.toThrow(
      /redirect.*location/i,
    );
  });
});
