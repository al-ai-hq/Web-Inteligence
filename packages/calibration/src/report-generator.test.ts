import { describe, it, expect } from "vitest";
import { generateCalibrationReport } from "./report-generator.js";

describe("generateCalibrationReport", () => {
  it("should generate calibration report with overall metrics", () => {
    const caseResults = [
      {
        case_id: "case-001",
        model_results: [{ criterion_id: "EXP-DH-01", result: "pass" }],
        human_results: [{ criterion_id: "EXP-DH-01", result: "pass" }],
      },
    ];

    const report = generateCalibrationReport(
      caseResults,
      "gemini-pro-vision",
      "gemini-1.5-pro-002",
      "0.1.0-draft",
    );

    expect(report.generated_at).toBeDefined();
    expect(report.model_id).toBe("gemini-pro-vision");
    expect(report.overall.total_cases).toBe(1);
    expect(report.overall.exact_match_rate).toBe(1.0);
  });
});
