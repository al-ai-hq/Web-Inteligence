import { describe, it, expect } from "vitest";
import { validateSchema } from "../src/validator.js";

describe("validateSchema", () => {
  it("validates a correct Article schema", () => {
    const result = validateSchema({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Test",
      author: { name: "John" },
      datePublished: "2026-10-12",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports missing required properties", () => {
    const result = validateSchema({
      "@context": "https://schema.org",
      "@type": "Article",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
