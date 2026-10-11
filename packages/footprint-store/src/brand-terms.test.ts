import { describe, expect, it } from "vitest";
import { BrandTermsSchema } from "./brand-terms.js";

describe("BrandTermsSchema", () => {
  it("accepts valid brand terms", () => {
    const result = BrandTermsSchema.safeParse({
      preferred_name: "Example Business",
      forbidden_terms: ["Example Inc", "Example LLC"],
      tagline: "The best example",
    });
    expect(result.success).toBe(true);
  });

  it("accepts brand terms with empty forbidden_terms", () => {
    const result = BrandTermsSchema.safeParse({
      preferred_name: "Example",
      forbidden_terms: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts brand terms with all optional fields omitted", () => {
    const result = BrandTermsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
