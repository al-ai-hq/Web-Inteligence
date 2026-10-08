import { describe, it, expect } from "vitest";
import { parseDimensionResponse } from "../../src/experience-reviewer/response-parser.js";

describe("parseDimensionResponse", () => {
  it("parses valid JSON response into findings", () => {
    const responseText = JSON.stringify({
      criteria: [
        {
          criterion_id: "EXP-DH-01",
          result: "pass",
          confidence: "high",
          rationale: "Clear visual hierarchy",
        },
        {
          criterion_id: "EXP-DH-02",
          result: "partial",
          confidence: "medium",
          rationale: "Some headings lack contrast",
        },
      ],
    });

    const { findings, score } = parseDimensionResponse(
      "design_hierarchy",
      responseText,
      "en",
      "us"
    );

    expect(findings).toHaveLength(2);
    expect(findings[0].result_state).toBe("pass");
    expect(findings[0].confidence).toBe("high");
    expect(findings[0].data.reviewer_trace.criterion_id).toBe("EXP-DH-01");
    expect(findings[0].data.reviewer_trace.reviewer_type).toBe("model");
    expect(findings[0].data.reviewer_trace.language).toBe("en");
    expect(findings[0].data.reviewer_trace.language_direction).toBe("ltr");
    expect(findings[1].result_state).toBe("partial");
    expect(score.score).toBeGreaterThan(0);
  });

  it("returns error findings when JSON parsing fails", () => {
    const { findings } = parseDimensionResponse(
      "design_hierarchy",
      "not valid json",
      "en",
      "us"
    );

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].result_state).toBe("error");
    expect(findings[0].confidence).toBe("low");
    expect(findings[0].data.reviewer_trace.rationale).toBe("Failed to parse model response");
  });

  it("sets language_direction to rtl for Arabic", () => {
    const responseText = JSON.stringify({
      criteria: [
        {
          criterion_id: "EXP-DH-01",
          result: "pass",
          confidence: "high",
          rationale: "Good hierarchy",
        },
      ],
    });

    const { findings } = parseDimensionResponse(
      "design_hierarchy",
      responseText,
      "ar",
      "sa"
    );

    expect(findings[0].data.reviewer_trace.language_direction).toBe("rtl");
  });
});
