import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("../src/fetcher.js", () => ({
  fetchUrl: vi.fn(),
}));

vi.mock("../src/extractor.js", () => ({
  extractContent: vi.fn(),
}));

vi.mock("../src/url-planner.js", () => ({
  planUrls: vi.fn(),
}));

// Now import the module under test (after mocks are set up)
import { runCrawlJob } from "../src/index.js";
import { fetchUrl } from "../src/fetcher.js";
import { extractContent } from "../src/extractor.js";
import { planUrls } from "../src/url-planner.js";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetchUrl = vi.mocked(fetchUrl);
const mockExtractContent = vi.mocked(extractContent);
const mockPlanUrls = vi.mocked(planUrls);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearCrawlEnv() {
  for (const key of ["AUDIT_ID", "ROOT_URL", "SAMPLING_MODE", "SITEMAP_URL", "OUTPUT_DIR"]) {
    delete process.env[key];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runCrawlJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCrawlEnv();
    // Default: no config file found → use defaults
    mockExistsSync.mockReturnValue(false);
  });

  // -------------------------------------------------------------------------
  // 1. Missing AUDIT_ID throws
  // -------------------------------------------------------------------------
  it("throws when AUDIT_ID is missing", async () => {
    setEnv({ ROOT_URL: "https://example.com" });
    await expect(runCrawlJob()).rejects.toThrow("AUDIT_ID");
  });

  // -------------------------------------------------------------------------
  // 2. Missing ROOT_URL throws
  // -------------------------------------------------------------------------
  it("throws when ROOT_URL is missing", async () => {
    setEnv({ AUDIT_ID: "audit-1" });
    await expect(runCrawlJob()).rejects.toThrow("ROOT_URL");
  });

  // -------------------------------------------------------------------------
  // 3. Reads env vars and loads config defaults
  // -------------------------------------------------------------------------
  it("uses default config when no YAML file exists", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html><body>Hello</body></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc123",
      redirectChain: ["https://example.com"],
    });
    mockExtractContent.mockReturnValue({
      headings: [{ level: 1, text: "Hello" }],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    // planUrls should have been called with default config values
    expect(mockPlanUrls).toHaveBeenCalledWith(
      expect.objectContaining({
        rootUrl: "https://example.com",
        samplingMode: "single_page",
        maxPages: 20, // default
        maxDepth: 3, // default
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 4. Plans URLs correctly for single_page mode
  // -------------------------------------------------------------------------
  it("plans URLs correctly for single_page mode", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    expect(mockPlanUrls).toHaveBeenCalledWith(
      expect.objectContaining({
        samplingMode: "single_page",
        rootUrl: "https://example.com",
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 5. Fetches and extracts each URL
  // -------------------------------------------------------------------------
  it("fetches and extracts each planned URL", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
    });
    const urls = ["https://example.com/page1", "https://example.com/page2"];
    mockPlanUrls.mockResolvedValue(urls);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    expect(mockFetchUrl).toHaveBeenCalledTimes(2);
    expect(mockExtractContent).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 6. Writes evidence files with correct path and content
  // -------------------------------------------------------------------------
  it("writes evidence files to correct paths", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
      OUTPUT_DIR: "/tmp/test-output",
    });
    const url = "https://example.com";
    mockPlanUrls.mockResolvedValue([url]);
    mockFetchUrl.mockResolvedValue({
      body: "<html><body>Test</body></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "hash123",
      redirectChain: ["https://example.com"],
      contentType: "text/html",
    });
    mockExtractContent.mockReturnValue({
      headings: [{ level: 1, text: "Test" }],
      links: ["https://example.com/about"],
      language: "en",
      structuredData: [],
      textByteLength: 4,
    });

    await runCrawlJob();

    // Check that writeFileSync was called for the evidence file
    const evidenceCalls = mockWriteFileSync.mock.calls.filter((call) => {
      const path = call[0] as string;
      return path.includes("/raw/") && path.endsWith(".json");
    });
    expect(evidenceCalls.length).toBe(1);

    const evidencePath = evidenceCalls[0]![0] as string;
    const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 16);
    expect(evidencePath).toBe(`/tmp/test-output/audit-1/raw/${urlHash}.json`);

    // Verify evidence content
    const evidenceContent = JSON.parse(evidenceCalls[0]![1] as string);
    expect(evidenceContent.url).toBe(url);
    expect(evidenceContent.statusCode).toBe(200);
    expect(evidenceContent.contentHash).toBe("hash123");
    expect(evidenceContent.headings).toEqual([{ level: 1, text: "Test" }]);
    expect(evidenceContent.language).toBe("en");
    expect(evidenceContent.fetchedAt).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 7. Builds render manifest for thin HTML
  // -------------------------------------------------------------------------
  it("adds pages with thin HTML to render manifest", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
      OUTPUT_DIR: "/tmp/test-output",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    // textByteLength=100 < default threshold of 500 → should render
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 100,
    });

    await runCrawlJob();

    // Check render manifest was written
    const manifestCalls = mockWriteFileSync.mock.calls.filter((call) => {
      const path = call[0] as string;
      return path.includes("render-manifest.json");
    });
    expect(manifestCalls.length).toBe(1);

    const manifestPath = manifestCalls[0]![0] as string;
    expect(manifestPath).toBe("/tmp/test-output/audit-1/render-manifest.json");

    const manifestContent = JSON.parse(manifestCalls[0]![1] as string);
    expect(manifestContent.entries).toHaveLength(1);
    expect(manifestContent.entries[0].url).toBe("https://example.com");
    expect(manifestContent.threshold).toBe(500);
  });

  it("does not add pages with thick HTML to render manifest", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
      OUTPUT_DIR: "/tmp/test-output",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    // textByteLength=1000 >= default threshold of 500 → should NOT render
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    const manifestCalls = mockWriteFileSync.mock.calls.filter((call) => {
      const path = call[0] as string;
      return path.includes("render-manifest.json");
    });
    expect(manifestCalls.length).toBe(1);

    const manifestContent = JSON.parse(manifestCalls[0]![1] as string);
    expect(manifestContent.entries).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 8. Handles fetch errors gracefully
  // -------------------------------------------------------------------------
  it("continues with other URLs when a fetch fails", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com/good", "https://example.com/bad"]);

    // First call succeeds, second throws
    mockFetchUrl
      .mockResolvedValueOnce({
        body: "<html></html>",
        statusCode: 200,
        finalUrl: "https://example.com/good",
        contentHash: "abc",
        redirectChain: ["https://example.com/good"],
      })
      .mockRejectedValueOnce(new Error("Network error"));

    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    const result = await runCrawlJob();

    expect(result.urlsFetched).toBe(1);
    expect(result.urlsFailed).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 9. Returns correct CrawlResult
  // -------------------------------------------------------------------------
  it("returns correct CrawlResult with counts", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
      OUTPUT_DIR: "/tmp/test-output",
    });
    mockPlanUrls.mockResolvedValue([
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
    ]);

    mockFetchUrl
      .mockResolvedValueOnce({
        body: "<html></html>",
        statusCode: 200,
        finalUrl: "https://example.com/1",
        contentHash: "a",
        redirectChain: ["https://example.com/1"],
      })
      .mockResolvedValueOnce({
        body: "<html></html>",
        statusCode: 200,
        finalUrl: "https://example.com/2",
        contentHash: "b",
        redirectChain: ["https://example.com/2"],
      })
      .mockRejectedValueOnce(new Error("fail"));

    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    const result = await runCrawlJob();

    expect(result.auditId).toBe("audit-1");
    expect(result.urlsPlanned).toBe(3);
    expect(result.urlsFetched).toBe(2);
    expect(result.urlsFailed).toBe(1);
    expect(result.outputDir).toBe("/tmp/test-output");
  });

  // -------------------------------------------------------------------------
  // 10. Uses concurrency limit
  // -------------------------------------------------------------------------
  it("respects concurrency limit", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
    });

    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`);
    mockPlanUrls.mockResolvedValue(urls);

    let concurrentCount = 0;
    let maxConcurrent = 0;

    mockFetchUrl.mockImplementation(async () => {
      concurrentCount++;
      if (concurrentCount > maxConcurrent) {
        maxConcurrent = concurrentCount;
      }
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrentCount--;
      return {
        body: "<html></html>",
        statusCode: 200,
        finalUrl: "https://example.com",
        contentHash: "abc",
        redirectChain: ["https://example.com"],
      };
    });

    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    // Default concurrency is 5, so max concurrent should be <= 5
    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 11. Writes empty render manifest when all URLs fail
  // -------------------------------------------------------------------------
  it("writes empty render manifest when all URLs fail", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
      OUTPUT_DIR: "/tmp/test-output",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockRejectedValue(new Error("Network down"));

    const result = await runCrawlJob();

    expect(result.urlsFailed).toBe(1);
    expect(result.urlsFetched).toBe(0);

    const manifestCalls = mockWriteFileSync.mock.calls.filter((call) => {
      const path = call[0] as string;
      return path.includes("render-manifest.json");
    });
    expect(manifestCalls.length).toBe(1);

    const manifestContent = JSON.parse(manifestCalls[0]![1] as string);
    expect(manifestContent.entries).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 12. Defaults SAMPLING_MODE to single_page
  // -------------------------------------------------------------------------
  it("defaults SAMPLING_MODE to single_page when not set", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    expect(mockPlanUrls).toHaveBeenCalledWith(
      expect.objectContaining({
        samplingMode: "single_page",
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 13. Defaults OUTPUT_DIR to ./output
  // -------------------------------------------------------------------------
  it("defaults OUTPUT_DIR to ./output when not set", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    const result = await runCrawlJob();

    expect(result.outputDir).toBe("./output");
  });

  // -------------------------------------------------------------------------
  // 14. Creates output directories with mkdirSync
  // -------------------------------------------------------------------------
  it("creates output directories recursively", async () => {
    setEnv({
      AUDIT_ID: "audit-1",
      ROOT_URL: "https://example.com",
      SAMPLING_MODE: "single_page",
      OUTPUT_DIR: "/tmp/test-output",
    });
    mockPlanUrls.mockResolvedValue(["https://example.com"]);
    mockFetchUrl.mockResolvedValue({
      body: "<html></html>",
      statusCode: 200,
      finalUrl: "https://example.com",
      contentHash: "abc",
      redirectChain: ["https://example.com"],
    });
    mockExtractContent.mockReturnValue({
      headings: [],
      links: [],
      structuredData: [],
      textByteLength: 1000,
    });

    await runCrawlJob();

    // mkdirSync should have been called with recursive: true
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("/tmp/test-output/audit-1/raw"),
      { recursive: true },
    );
  });
});
