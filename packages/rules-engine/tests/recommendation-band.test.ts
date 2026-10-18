import { describe, expect, test } from "vitest";
import { assignPresentation } from "../src/recommendation-band.js";

const thresholds = { quickWin: 8, strategic: 3, fillIn: -3 };

describe("assignPresentation", () => {
  test("maps each band onto its group, horizon and display band", () => {
    expect(assignPresentation(12, thresholds)).toEqual({
      band: "quick_win",
      group: "quick_win",
      horizon: "0-30d",
      display_band: 1,
    });
    expect(assignPresentation(3, thresholds)).toEqual({
      band: "strategic",
      group: "strategic_opportunity",
      horizon: "31-60d",
      display_band: 2,
    });
    expect(assignPresentation(-3, thresholds)).toEqual({
      band: "fill_in",
      group: "polish",
      horizon: "31-60d",
      display_band: 3,
    });
    expect(assignPresentation(-4, thresholds)).toEqual({
      band: "defer",
      group: "polish",
      horizon: "61-90d",
      display_band: 4,
    });
  });

  test("uses inclusive lower bounds at each threshold", () => {
    expect(assignPresentation(8, thresholds).band).toBe("quick_win");
    expect(assignPresentation(7, thresholds).band).toBe("strategic");
    expect(assignPresentation(-3, thresholds).band).toBe("fill_in");
    expect(assignPresentation(-4, thresholds).band).toBe("defer");
  });
});
