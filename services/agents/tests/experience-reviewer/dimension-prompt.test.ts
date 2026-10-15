import { describe, it, expect } from "vitest";
import { buildDimensionPrompt } from "../../src/experience-reviewer/dimension-prompt.js";
import type { ExperienceEvidencePackage } from "@wpi/core";
import type { ContentPart } from "../../src/providers/types.js";

const mockEvidence: ExperienceEvidencePackage = {
  page_url: "https://example.com",
  language: "en",
  market: "us",
  screenshots: {
    viewport: null,
    full_page: null,
    above_fold: null,
  },
  extractor_results: {
    heading: { h1_count: 1, h1_text: "Welcome" },
    form: { form_count: 1, forms: [] },
    contact: { email_count: 1, phone_count: 0 },
    policy: { privacy_link: true, terms_link: false },
    language: { detected: "en", switcher: true },
    analytics: { ga4: true, gtm: false },
    viewport: { meta_viewport: true, responsive: true },
    wayfinding: { breadcrumbs: true, sitemap_link: false },
  } as any,
  readiness_results: {
    score: 85,
    categories: [],
    confidence: "high",
  },
};

describe("buildDimensionPrompt", () => {
  it("builds system prompt with dimension title and criteria", () => {
    const imageParts: ContentPart[] = [];
    const { systemPrompt, content } = buildDimensionPrompt(
      "design_hierarchy",
      mockEvidence,
      imageParts,
    );

    expect(systemPrompt).toContain("Design hierarchy");
    expect(systemPrompt).toContain("EXP-DH-01");
    expect(systemPrompt).toContain("JSON");
    expect(content.length).toBeGreaterThan(0);
  });

  it("includes extractor results in text content", () => {
    const imageParts: ContentPart[] = [];
    const { content } = buildDimensionPrompt("design_hierarchy", mockEvidence, imageParts);

    const textPart = content.find((p) => p.type === "text");
    expect(textPart).toBeDefined();
    expect(textPart!.text).toContain("https://example.com");
    expect(textPart!.text).toContain("en");
    expect(textPart!.text).toContain("us");
  });

  it("includes image parts in content array", () => {
    const imageParts: ContentPart[] = [
      { type: "image", mimeType: "image/png", data: "base64data" },
    ];
    const { content } = buildDimensionPrompt("design_hierarchy", mockEvidence, imageParts);

    expect(content).toHaveLength(2);
    expect(content[0].type).toBe("text");
    expect(content[1].type).toBe("image");
  });
});
