import { describe, expect, test } from "vitest";
import { assignBand, compareByBand } from "../src/recommendation-band.js";

const thresholds = { quickWin: 8, strategic: 3, fillIn: -3 };

describe("assignBand", () => {
  test("uses inclusive lower bounds at each threshold", () => {
    expect(assignBand(18, thresholds)).toBe("quick_win");
    expect(assignBand(8, thresholds)).toBe("quick_win");
    expect(assignBand(7, thresholds)).toBe("strategic");
    expect(assignBand(3, thresholds)).toBe("strategic");
    expect(assignBand(2, thresholds)).toBe("fill_in");
    expect(assignBand(-3, thresholds)).toBe("fill_in");
    expect(assignBand(-4, thresholds)).toBe("defer");
  });
});

describe("compareByBand", () => {
  test("orders quick win ahead of strategic, fill-in and defer", () => {
    const bands = ["defer", "fill_in", "strategic", "quick_win"] as const;
    expect([...bands].sort(compareByBand)).toEqual([
      "quick_win",
      "strategic",
      "fill_in",
      "defer",
    ]);
  });

  test("is zero for the same band", () => {
    expect(compareByBand("strategic", "strategic")).toBe(0);
  });
});
