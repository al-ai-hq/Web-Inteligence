import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadImagesAsContent } from "../../src/experience-reviewer/image-loader.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadImagesAsContent", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `image-loader-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns empty array when all screenshots are null", () => {
    const result = loadImagesAsContent({
      viewport: null,
      full_page: null,
      above_fold: null,
    });
    expect(result).toEqual([]);
  });

  it("loads viewport and above-fold images as base64", () => {
    const viewportPath = join(testDir, "viewport.png");
    const aboveFoldPath = join(testDir, "above_fold.png");
    writeFileSync(viewportPath, Buffer.from("viewport-data"));
    writeFileSync(aboveFoldPath, Buffer.from("above-fold-data"));

    const result = loadImagesAsContent({
      viewport: {
        evidence_id: "screenshot_viewport",
        path: viewportPath,
        mime_type: "image/png",
        width: 1280,
        height: 720,
      },
      full_page: null,
      above_fold: {
        evidence_id: "screenshot_above_fold",
        path: aboveFoldPath,
        mime_type: "image/png",
        width: 1280,
        height: 1080,
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("image");
    expect(result[0].mimeType).toBe("image/png");
    expect(result[0].data).toBe(Buffer.from("viewport-data").toString("base64"));
    expect(result[1].data).toBe(Buffer.from("above-fold-data").toString("base64"));
  });

  it("falls back to full-page when viewport and above-fold are missing", () => {
    const fullPath = join(testDir, "full.png");
    writeFileSync(fullPath, Buffer.from("full-page-data"));

    const result = loadImagesAsContent({
      viewport: null,
      full_page: {
        evidence_id: "screenshot_full_page",
        path: fullPath,
        mime_type: "image/png",
        width: 1280,
        height: 3000,
      },
      above_fold: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toBe(Buffer.from("full-page-data").toString("base64"));
  });

  it("does not include full-page when viewport is present", () => {
    const viewportPath = join(testDir, "viewport.png");
    const fullPath = join(testDir, "full.png");
    writeFileSync(viewportPath, Buffer.from("viewport-data"));
    writeFileSync(fullPath, Buffer.from("full-page-data"));

    const result = loadImagesAsContent({
      viewport: {
        evidence_id: "screenshot_viewport",
        path: viewportPath,
        mime_type: "image/png",
        width: 1280,
        height: 720,
      },
      full_page: {
        evidence_id: "screenshot_full_page",
        path: fullPath,
        mime_type: "image/png",
        width: 1280,
        height: 3000,
      },
      above_fold: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toBe(Buffer.from("viewport-data").toString("base64"));
  });
});
