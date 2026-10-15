import { describe, expect, it } from "vitest";
import {
  categoryLabelKey,
  formatScorePercentage,
} from "../app/[locale]/audit/[id]/_components/score-card";

describe("formatScorePercentage", () => {
  it("returns N/A for null", () => {
    expect(formatScorePercentage(null)).toBe("N/A");
  });

  it("rounds to integer", () => {
    expect(formatScorePercentage(73.6)).toBe("74%");
    expect(formatScorePercentage(73.4)).toBe("73%");
  });

  it("handles boundary values", () => {
    expect(formatScorePercentage(0)).toBe("0%");
    expect(formatScorePercentage(100)).toBe("100%");
  });
});

describe("categoryLabelKey", () => {
  it("maps each category to its i18n key", () => {
    expect(categoryLabelKey("crawlability")).toBe("score_category_crawlability");
    expect(categoryLabelKey("on_page")).toBe("score_category_on_page");
    expect(categoryLabelKey("structured_data")).toBe("score_category_structured_data");
    expect(categoryLabelKey("aeo")).toBe("score_category_aeo");
    expect(categoryLabelKey("geo")).toBe("score_category_geo");
    expect(categoryLabelKey("i18n_accessibility")).toBe("score_category_i18n_accessibility");
    expect(categoryLabelKey("performance_security")).toBe("score_category_performance_security");
  });
});
