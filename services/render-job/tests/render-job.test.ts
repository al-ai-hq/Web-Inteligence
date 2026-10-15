import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

// Mock node:fs
vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock yaml parser
vi.mock("yaml", () => ({
  parse: vi.fn(),
}));

// Mock renderer
vi.mock("../src/renderer.js", () => ({
  renderPage: vi.fn(),
}));

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { renderPage } from "../src/renderer.js";
import { runRenderJob } from "../src/index.js";
import type { RenderResult } from "../src/renderer.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockParseYaml = vi.mocked(parseYaml);
const mockRenderPage = vi.mocked(renderPage);

function makeRenderResult(url: string, overrides?: Partial<RenderResult>): RenderResult {
  return {
    url,
    renderedAt: "2026-01-01T00:00:00.000Z",
    domSnapshot: "<html><body>Test</body></html>",
    contentHash: createHash("sha256").update("<html><body>Test</body></html>").digest("hex"),
    renderDurationMs: 100,
    ...overrides,
  };
}

function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

describe("runRenderJob", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Default: config file does not exist, use defaults
    mockExistsSync.mockReturnValue(false);
    // Default: renderPage succeeds
    mockRenderPage.mockImplementation(async ({ url }) => makeRenderResult(url));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when AUDIT_ID is missing", async () => {
    delete process.env["AUDIT_ID"];
    await expect(runRenderJob()).rejects.toThrow("AUDIT_ID");
  });

  it("reads env vars and uses defaults when no config file exists", async () => {
    process.env["AUDIT_ID"] = "audit-123";
    process.env["OUTPUT_DIR"] = "./test-output";

    const manifest = { entries: [], threshold: 1000 };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    const result = await runRenderJob();

    expect(result.auditId).toBe("audit-123");
    // Should have read manifest from correct path
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining("test-output/audit-123/render-manifest.json"),
      "utf-8",
    );
  });

  it("loads config from yaml file when it exists", async () => {
    process.env["AUDIT_ID"] = "audit-123";
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(((path: string) => {
      if (typeof path === "string" && path.includes("render-limits.yaml")) {
        return "per_page_timeout_seconds: 10\n";
      }
      return JSON.stringify({ entries: [], threshold: 1000 });
    }) as any);
    mockParseYaml.mockReturnValue({
      per_page_timeout_seconds: 10,
      total_job_timeout_seconds: 120,
      max_response_size_bytes: 10_000_000,
      max_decompressed_size_bytes: 50_000_000,
      memory_limit_mb: 512,
      network_idle_timeout_ms: 500,
    });

    await runRenderJob();

    expect(mockParseYaml).toHaveBeenCalled();
  });

  it("throws when manifest file does not exist", async () => {
    process.env["AUDIT_ID"] = "audit-123";
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    await expect(runRenderJob()).rejects.toThrow();
  });

  it("returns urlsRendered: 0 for empty manifest", async () => {
    process.env["AUDIT_ID"] = "audit-123";
    const manifest = { entries: [], threshold: 1000 };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    const result = await runRenderJob();

    expect(result.urlsRendered).toBe(0);
    expect(result.urlsFailed).toBe(0);
    expect(mockRenderPage).not.toHaveBeenCalled();
  });

  it("calls renderPage for each URL in manifest", async () => {
    process.env["AUDIT_ID"] = "audit-123";
    const manifest = {
      entries: [
        { url: "https://example.com/page1", textByteLength: 100 },
        { url: "https://example.com/page2", textByteLength: 200 },
        { url: "https://example.com/page3", textByteLength: 300 },
      ],
      threshold: 1000,
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    const result = await runRenderJob();

    expect(mockRenderPage).toHaveBeenCalledTimes(3);
    expect(mockRenderPage).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/page1" }),
    );
    expect(mockRenderPage).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/page2" }),
    );
    expect(mockRenderPage).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/page3" }),
    );
    expect(result.urlsRendered).toBe(3);
    expect(result.urlsFailed).toBe(0);
  });

  it("writes rendered evidence files to correct paths", async () => {
    process.env["AUDIT_ID"] = "audit-456";
    process.env["OUTPUT_DIR"] = "./evidence";

    const manifest = {
      entries: [{ url: "https://example.com/page1", textByteLength: 100 }],
      threshold: 1000,
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    const renderResult = makeRenderResult("https://example.com/page1");
    mockRenderPage.mockResolvedValue(renderResult);

    await runRenderJob();

    const expectedHash = urlHash("https://example.com/page1");
    const expectedPath = `evidence/audit-456/rendered/${expectedHash}.json`;

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(`audit-456/rendered`), {
      recursive: true,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining(expectedPath),
      JSON.stringify(renderResult, null, 2),
    );
  });

  it("handles render errors gracefully and continues", async () => {
    process.env["AUDIT_ID"] = "audit-789";
    const manifest = {
      entries: [
        { url: "https://example.com/good1", textByteLength: 100 },
        { url: "https://example.com/bad", textByteLength: 200 },
        { url: "https://example.com/good2", textByteLength: 300 },
      ],
      threshold: 1000,
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    mockRenderPage.mockImplementation(async ({ url }) => {
      if (url === "https://example.com/bad") {
        throw new Error("Render failed");
      }
      return makeRenderResult(url);
    });

    const result = await runRenderJob();

    expect(result.urlsRendered).toBe(2);
    expect(result.urlsFailed).toBe(1);
    // Should still have written evidence for the good URLs
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
  });

  it("returns correct RenderJobResult with counts", async () => {
    process.env["AUDIT_ID"] = "audit-counts";
    process.env["OUTPUT_DIR"] = "./out";

    const manifest = {
      entries: [
        { url: "https://a.com", textByteLength: 10 },
        { url: "https://b.com", textByteLength: 20 },
        { url: "https://c.com", textByteLength: 30 },
        { url: "https://d.com", textByteLength: 40 },
      ],
      threshold: 1000,
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    let callCount = 0;
    mockRenderPage.mockImplementation(async ({ url }) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("fail");
      }
      return makeRenderResult(url);
    });

    const result = await runRenderJob();

    expect(result.auditId).toBe("audit-counts");
    expect(result.urlsRendered).toBe(3);
    expect(result.urlsFailed).toBe(1);
    expect(result.outputDir).toBe("./out");
  });

  it("uses default OUTPUT_DIR when not set", async () => {
    process.env["AUDIT_ID"] = "audit-default";
    delete process.env["OUTPUT_DIR"];

    const manifest = { entries: [], threshold: 1000 };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    const result = await runRenderJob();

    expect(result.outputDir).toBe("./output");
  });

  it("passes config to renderPage", async () => {
    process.env["AUDIT_ID"] = "audit-config";
    const manifest = {
      entries: [{ url: "https://example.com", textByteLength: 100 }],
      threshold: 1000,
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    await runRenderJob();

    expect(mockRenderPage).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          per_page_timeout_seconds: expect.any(Number),
          total_job_timeout_seconds: expect.any(Number),
        }),
      }),
    );
  });
});
