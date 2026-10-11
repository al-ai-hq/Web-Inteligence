import { describe, expect, it } from "vitest";
import { LocationSchema } from "./location.js";

describe("LocationSchema", () => {
  it("accepts a valid location", () => {
    const result = LocationSchema.safeParse({
      address_line1: "123 Main St",
      address_line2: "Suite 100",
      address_locality: "Anytown",
      address_region: "CA",
      address_postal_code: "90210",
      address_country: "US",
      latitude: 34.0522,
      longitude: -118.2437,
    });
    expect(result.success).toBe(true);
  });

  it("accepts location with null optional fields", () => {
    const result = LocationSchema.safeParse({
      address_line1: "123 Main St",
      address_line2: null,
      address_locality: "Anytown",
      address_region: "CA",
      address_postal_code: "90210",
      address_country: "US",
      latitude: null,
      longitude: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects location with latitude out of range", () => {
    const result = LocationSchema.safeParse({
      address_line1: "123 Main St",
      address_line2: null,
      address_locality: "Anytown",
      address_region: "CA",
      address_postal_code: "90210",
      address_country: "US",
      latitude: 91,
      longitude: -118.2437,
    });
    expect(result.success).toBe(false);
  });
});
