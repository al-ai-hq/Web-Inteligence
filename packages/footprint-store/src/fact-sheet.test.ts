import { describe, expect, it } from "vitest";
import { FactSheetSchema, FactSheetCreateSchema } from "./fact-sheet.js";

describe("FactSheetSchema", () => {
  const validFactSheet = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_url: "https://example.com",
    business_name: "Example Business",
    description: "A test business",
    phone: "+1-555-0100",
    email: "contact@example.com",
    address_line1: "123 Main St",
    address_line2: null,
    address_locality: "Anytown",
    address_region: "CA",
    address_postal_code: "90210",
    address_country: "US",
    geo_latitude: 34.0522,
    geo_longitude: -118.2437,
    social_profiles: { google: "https://g.page/example", facebook: "https://fb.com/example" },
    brand_terms: { preferred_name: "Example", forbidden_terms: ["Example Inc"] },
    operating_hours: { monday: "9:00-17:00", tuesday: "9:00-17:00" },
    status: "draft",
    lineage: {
      record_id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "550e8400-e29b-41d4-a716-446655440001",
      site_id: null,
      source_type: "first_party",
      source_id: "manual-entry",
      source_version: "1.0.0",
      captured_at: "2026-10-11T10:00:00Z",
      as_of: "2026-10-11T10:00:00Z",
      market: "US",
      language: "en",
      device: "desktop",
      method: "manual",
      methodology_version: "1.0.0",
      fidelity_label: "confirmed",
      content_hash: "abc123",
      parent_ids: [],
      validation_state: "validated",
    },
    created_at: "2026-10-11T10:00:00Z",
    updated_at: "2026-10-11T10:00:00Z",
  };

  it("accepts a valid fact sheet", () => {
    const result = FactSheetSchema.safeParse(validFactSheet);
    expect(result.success).toBe(true);
  });

  it("rejects fact sheet with invalid status", () => {
    const result = FactSheetSchema.safeParse({
      ...validFactSheet,
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("FactSheetCreateSchema", () => {
  it("accepts minimal create input", () => {
    const result = FactSheetCreateSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440001",
      site_url: "https://example.com",
      business_name: "Example Business",
    });
    expect(result.success).toBe(true);
  });

  it("rejects create without required business_name", () => {
    const result = FactSheetCreateSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440001",
      site_url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });
});
