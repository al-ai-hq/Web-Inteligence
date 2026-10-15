import { describe, expect, it } from "vitest";
import { computeNapConsistency } from "./engine.js";

describe("computeNapConsistency", () => {
  const baseFactSheet = {
    business_name: "Example Business",
    phone: "+1-555-0100",
    address: {
      street: "123 Main St",
      city: "Anytown",
      region: "CA",
      postal_code: "90210",
      country: "US",
    },
  };

  it("returns score 1.0 when all NAP fields match exactly", () => {
    const observation = {
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_address: {
        street: "123 Main St",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.consistency_score).toBe(1.0);
    expect(result.inconsistencies).toEqual([]);
  });

  it("detects phone number mismatch", () => {
    const observation = {
      source_url: "https://yelp.com/biz/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0200",
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.consistency_score).toBeLessThan(1.0);
    expect(result.inconsistencies).toContainEqual(
      expect.objectContaining({ field: "phone", expected: "+1-555-0100", actual: "+1-555-0200" }),
    );
  });

  it("detects business name mismatch", () => {
    const observation = {
      source_url: "https://facebook.com/example",
      extracted_name: "Example Biz LLC",
      extracted_phone: "+1-555-0100",
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.inconsistencies).toContainEqual(expect.objectContaining({ field: "name" }));
  });

  it("detects address field mismatch", () => {
    const observation = {
      source_url: "https://yelp.com/biz/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_address: {
        street: "456 Oak Ave",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.inconsistencies).toContainEqual(
      expect.objectContaining({ field: "address.street" }),
    );
  });

  it("handles missing observation fields gracefully", () => {
    const observation = {
      source_url: "https://example.com",
      extracted_name: null,
      extracted_phone: null,
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.inconsistencies).toEqual([]);
    expect(result.consistency_score).toBe(1.0);
  });

  it("normalizes phone numbers before comparison", () => {
    const observation = {
      source_url: "https://example.com",
      extracted_name: "Example Business",
      extracted_phone: "+15550100",
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    const phoneInconsistencies = result.inconsistencies.filter((i) => i.field === "phone");
    expect(phoneInconsistencies).toEqual([]);
  });
});
