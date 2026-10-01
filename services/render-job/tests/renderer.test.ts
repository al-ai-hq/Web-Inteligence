import { vi, describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const mockClose = vi.fn();
const mockContent = vi.fn();
const mockGoto = vi.fn();
const mockRoute = vi.fn();
const mockNewPage = vi.fn();
const mockNewContext = vi.fn();
const mockAbort = vi.fn();
const mockContinue = vi.fn();
const mockContextOn = vi.fn();
const mockPageOn = vi.fn();

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(() =>
      Promise.resolve({
        newContext: mockNewContext,
        close: mockClose,
      }),
    ),
  },
}));

vi.mock("../src/request-interceptor.js", () => ({
  interceptRequest: vi.fn(() => Promise.resolve(true)),
}));

import { chromium } from "playwright";
import { interceptRequest } from "../src/request-interceptor.js";
import { renderPage } from "../src/renderer.js";
import type { RenderConfig } from "../src/config/schema.js";

const mockLaunch = vi.mocked(chromium.launch);
const mockInterceptRequest = vi.mocked(interceptRequest);

const defaultConfig: RenderConfig = {
  per_page_timeout_seconds: 30,
  total_job_timeout_seconds: 120,
  max_response_size_bytes: 10_000_000,
  max_decompressed_size_bytes: 50_000_000,
  memory_limit_mb: 512,
  network_idle_timeout_ms: 5000,
};

function setupMockChain() {
  const mockPage = {
    route: mockRoute,
    goto: mockGoto,
    content: mockContent,
    on: mockPageOn,
  };

  const mockContext = {
    newPage: mockNewPage,
    on: mockContextOn,
  };

  mockNewContext.mockResolvedValue(mockContext);
  mockNewPage.mockResolvedValue(mockPage);
  mockGoto.mockResolvedValue(undefined);
  mockContent.mockResolvedValue("<html><body>Test</body></html>");

  // Setup route handler to capture and invoke it
  mockRoute.mockImplementation(async (_pattern: string, handler: Function) => {
    // Store handler for later invocation in tests if needed
    (mockRoute as any).__handler = handler;
  });

  return { mockPage, mockContext };
}

describe("renderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockChain();
    mockInterceptRequest.mockResolvedValue(true);
  });

  it("launches browser with correct args", async () => {
    await renderPage({ url: "https://example.com", config: defaultConfig });

    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining([
          "--disable-gpu",
          "--no-sandbox",
        ]),
      }),
    );
  });

  it("creates context with serviceWorkers blocked", async () => {
    await renderPage({ url: "https://example.com", config: defaultConfig });

    expect(mockNewContext).toHaveBeenCalledWith(
      expect.objectContaining({
        javaScriptEnabled: true,
        serviceWorkers: "block",
      }),
    );
  });

  it("sets up request interception", async () => {
    const { mockPage } = setupMockChain();
    await renderPage({ url: "https://example.com", config: defaultConfig });

    expect(mockPage.route).toHaveBeenCalledWith(
      "**/*",
      expect.any(Function),
    );
  });

  it("navigates to URL and captures DOM snapshot", async () => {
    const expectedHtml = "<html><body>Hello World</body></html>";
    mockContent.mockResolvedValue(expectedHtml);

    const result = await renderPage({
      url: "https://example.com/page",
      config: defaultConfig,
    });

    expect(mockGoto).toHaveBeenCalledWith(
      "https://example.com/page",
      expect.objectContaining({
        waitUntil: "networkidle",
      }),
    );
    expect(result.domSnapshot).toBe(expectedHtml);
  });

  it("returns correct RenderResult shape", async () => {
    const html = "<html><body>Test content</body></html>";
    mockContent.mockResolvedValue(html);

    const result = await renderPage({
      url: "https://example.com",
      config: defaultConfig,
    });

    expect(result).toHaveProperty("url", "https://example.com");
    expect(result).toHaveProperty("renderedAt");
    expect(result).toHaveProperty("domSnapshot", html);
    expect(result).toHaveProperty("contentHash");
    expect(result).toHaveProperty("renderDurationMs");
    expect(typeof result.renderedAt).toBe("string");
    expect(typeof result.contentHash).toBe("string");
    expect(typeof result.renderDurationMs).toBe("number");
    // Verify ISO timestamp
    expect(new Date(result.renderedAt).toISOString()).toBe(result.renderedAt);
  });

  it("contentHash is SHA-256 of domSnapshot", async () => {
    const html = "<html><body>Hash me</body></html>";
    mockContent.mockResolvedValue(html);

    const result = await renderPage({
      url: "https://example.com",
      config: defaultConfig,
    });

    const expectedHash = createHash("sha256").update(html).digest("hex");
    expect(result.contentHash).toBe(expectedHash);
  });

  it("closes browser even on error", async () => {
    mockGoto.mockRejectedValue(new Error("Navigation failed"));

    await expect(
      renderPage({ url: "https://example.com", config: defaultConfig }),
    ).rejects.toThrow("Navigation failed");

    expect(mockClose).toHaveBeenCalled();
  });

  it("respects per_page_timeout", async () => {
    const config: RenderConfig = {
      ...defaultConfig,
      per_page_timeout_seconds: 15,
    };

    await renderPage({ url: "https://example.com", config });

    expect(mockGoto).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        timeout: 15000,
      }),
    );
  });

  it("aborts blocked requests", async () => {
    mockInterceptRequest.mockResolvedValue(false);

    let capturedHandler: Function | undefined;
    mockRoute.mockImplementation(async (_pattern: string, handler: Function) => {
      capturedHandler = handler;
    });

    await renderPage({ url: "https://example.com", config: defaultConfig });

    // Invoke the route handler with a mock route
    expect(capturedHandler).toBeDefined();
    const mockRequest = { url: () => "https://evil.com/malware", resourceType: () => "script" };
    const mockRouteObj = {
      request: () => mockRequest,
      continue: mockContinue,
      abort: mockAbort,
    };

    await capturedHandler!(mockRouteObj);

    expect(mockAbort).toHaveBeenCalled();
    expect(mockContinue).not.toHaveBeenCalled();
  });

  it("continues allowed requests", async () => {
    mockInterceptRequest.mockResolvedValue(true);

    let capturedHandler: Function | undefined;
    mockRoute.mockImplementation(async (_pattern: string, handler: Function) => {
      capturedHandler = handler;
    });

    await renderPage({ url: "https://example.com", config: defaultConfig });

    expect(capturedHandler).toBeDefined();
    const mockRequest = { url: () => "https://cdn.example.com/script.js", resourceType: () => "script" };
    const mockRouteObj = {
      request: () => mockRequest,
      continue: mockContinue,
      abort: mockAbort,
    };

    await capturedHandler!(mockRouteObj);

    expect(mockContinue).toHaveBeenCalled();
    expect(mockAbort).not.toHaveBeenCalled();
  });
});
