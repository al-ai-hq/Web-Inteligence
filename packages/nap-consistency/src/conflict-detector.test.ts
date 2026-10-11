import { describe, expect, it } from "vitest";
import { detectConflicts } from "./conflict-detector.js";
import type { NapConsistencyResult } from "./engine.js";

describe("detectConflicts", () => {
  it("generates a high-severity conflict for phone mismatch", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://yelp.com/biz/example",
        consistency_score: 0.75,
        inconsistencies: [
          { field: "phone", expected: "+1-555-0100", actual: "+1-555-0200" },
        ],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.fact_key).toBe("phone");
    expect(conflicts[0]!.severity).toBe("high");
    expect(conflicts[0]!.source_type).toBe("nap_inconsistency");
  });

  it("generates medium-severity for name mismatch", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://facebook.com/example",
        consistency_score: 0.8,
        inconsistencies: [
          { field: "name", expected: "Example Business", actual: "Example Biz LLC" },
        ],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.severity).toBe("medium");
  });

  it("generates low-severity for address field mismatch", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://yelp.com/biz/example",
        consistency_score: 0.9,
        inconsistencies: [
          { field: "address.street", expected: "123 Main St", actual: "123 Main Street" },
        ],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.severity).toBe("low");
  });

  it("returns empty array when no inconsistencies", () => {
    const results: NapConsistencyResult[] = [
      { source_url: "https://example.com", consistency_score: 1.0, inconsistencies: [] },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts).toEqual([]);
  });

  it("aggregates conflicts from multiple sources", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://yelp.com/biz/example",
        consistency_score: 0.5,
        inconsistencies: [
          { field: "phone", expected: "+1-555-0100", actual: "+1-555-0200" },
          { field: "name", expected: "Example Business", actual: "Example Biz" },
        ],
      },
      {
        source_url: "https://facebook.com/example",
        consistency_score: 0.75,
        inconsistencies: [
          { field: "phone", expected: "+1-555-0100", actual: "+1-555-0300" },
        ],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(3);
  });
});
