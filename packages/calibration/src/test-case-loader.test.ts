import { describe, it, expect } from "vitest";
import { loadTestCases } from "./test-case-loader.js";

describe("loadTestCases", () => {
  it("should load calibration test cases from directory", () => {
    const cases = loadTestCases("config/calibration-cases/");

    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThan(0);

    const firstCase = cases[0];
    expect(firstCase!.case_id).toBeDefined();
    expect(firstCase!.evidence_package).toBeDefined();
    expect(firstCase!.human_results).toBeDefined();
  });
});
