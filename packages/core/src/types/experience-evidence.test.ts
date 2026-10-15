import { describe, it, expect } from "vitest";
import type { ScreenshotRef, ExperienceEvidencePackage } from "./experience-evidence.js";

describe("ScreenshotRef", () => {
  it("has file path and dimensions", () => {
    const ref: ScreenshotRef = {
      evidence_id: "screenshot_viewport",
      path: "/tmp/evidence/viewport.png",
      mime_type: "image/png",
      width: 1280,
      height: 720,
    };
    expect(ref.path).toBe("/tmp/evidence/viewport.png");
    expect(ref.mime_type).toBe("image/png");
    expect(ref.width).toBe(1280);
  });
});

describe("ExperienceEvidencePackage", () => {
  it("accepts ScreenshotRef objects in screenshots field", () => {
    const pkg: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "us",
      screenshots: {
        viewport: {
          evidence_id: "screenshot_viewport",
          path: "/tmp/viewport.png",
          mime_type: "image/png",
          width: 1280,
          height: 720,
        },
        full_page: null,
        above_fold: {
          evidence_id: "screenshot_above_fold",
          path: "/tmp/above_fold.png",
          mime_type: "image/png",
          width: 1280,
          height: 1080,
        },
      },
      extractor_results: {} as any,
      readiness_results: {
        score: 85,
        categories: [],
        confidence: "high",
      },
    };
    expect(pkg.screenshots.viewport?.path).toBe("/tmp/viewport.png");
    expect(pkg.screenshots.full_page).toBeNull();
  });
});
