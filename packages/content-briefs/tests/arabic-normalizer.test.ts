import { describe, it, expect } from "vitest";
import { normalizeArabicKeyword, processKeywordVariants } from "../src/arabic-normalizer.js";

describe("normalizeArabicKeyword", () => {
  it("normalizes alef variants to bare alef", () => {
    expect(normalizeArabicKeyword("إسلام")).toBe("اسلام");
    expect(normalizeArabicKeyword("أحمد")).toBe("احمد");
    expect(normalizeArabicKeyword("آلة")).toBe("اله");
  });

  it("normalizes taa marbuta to haa", () => {
    expect(normalizeArabicKeyword("مدينة")).toBe("مدينه");
  });

  it("normalizes alef maqsura to yaa", () => {
    expect(normalizeArabicKeyword("على")).toBe("علي");
  });

  it("normalizes hamza variants to waw", () => {
    expect(normalizeArabicKeyword("سؤال")).toBe("سوال");
    expect(normalizeArabicKeyword("لائحة")).toBe("لاوحه");
  });

  it("removes diacritics (tashkeel)", () => {
    expect(normalizeArabicKeyword("مُحَمَّد")).toBe("محمد");
  });

  it("handles combined normalizations", () => {
    expect(normalizeArabicKeyword("إِسْلَامِيَّة")).toBe("اسلاميه");
  });

  it("leaves English keywords unchanged", () => {
    expect(normalizeArabicKeyword("SEO")).toBe("SEO");
  });
});

describe("processKeywordVariants", () => {
  it("adds normalized form for Arabic keywords", () => {
    const variants = [{ keyword: "مدينة", language: "ar" as const }];
    const result = processKeywordVariants(variants);
    expect(result[0]!.normalized).toBe("مدينه");
  });

  it("does not normalize English keywords", () => {
    const variants = [{ keyword: "SEO", language: "en" as const }];
    const result = processKeywordVariants(variants);
    expect(result[0]!.normalized).toBe("SEO");
  });
});
