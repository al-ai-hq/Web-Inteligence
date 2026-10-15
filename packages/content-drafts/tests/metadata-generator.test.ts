import { describe, it, expect } from "vitest";
import { generateMetadata } from "../src/metadata-generator.js";

describe("generateMetadata", () => {
  it("calculates word count per language", () => {
    const content = [
      {
        language: "en" as const,
        title: "",
        meta_description: "",
        body: "This is a test body with words.",
        headings: [],
      },
      {
        language: "ar" as const,
        title: "",
        meta_description: "",
        body: "هذا نص اختباري",
        headings: [],
      },
    ];
    const metadata = generateMetadata(content);
    expect(metadata.word_count.en).toBeGreaterThan(0);
    expect(metadata.word_count.ar).toBeGreaterThan(0);
  });

  it("calculates reading time (200 words per minute)", () => {
    const words = Array(400).fill("word").join(" ");
    const content = [
      { language: "en" as const, title: "", meta_description: "", body: words, headings: [] },
    ];
    const metadata = generateMetadata(content);
    expect(metadata.reading_time_minutes.en).toBe(2);
  });
});
