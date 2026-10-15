import { describe, expect, it } from "vitest";
import {
  ProfileObservationSchema,
  PublicSourceObservationSchema,
  NapObservationSchema,
} from "./observations.js";

const baseLineage = {
  record_id: "550e8400-e29b-41d4-a716-446655440000",
  project_id: "550e8400-e29b-41d4-a716-446655440001",
  site_id: null,
  source_type: "third_party_unverified" as const,
  source_id: "google-extractor",
  source_version: "1.0.0",
  captured_at: "2026-10-11T10:00:00Z",
  as_of: "2026-10-11T10:00:00Z",
  market: "US",
  language: "en",
  device: "desktop",
  method: "automated",
  methodology_version: "1.0.0",
  fidelity_label: "extracted",
  content_hash: "abc123",
  parent_ids: [],
  validation_state: "unvalidated",
};

describe("ProfileObservationSchema", () => {
  it("accepts a valid profile observation", () => {
    const result = ProfileObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440010",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_email: null,
      extracted_address: {
        street: "123 Main St",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
      extracted_hours: { monday: "9:00-17:00" },
      extracted_social: { facebook: "https://fb.com/example" },
      extraction_confidence: 0.85,
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects observation with confidence out of range", () => {
    const result = ProfileObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440010",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example",
      extracted_phone: null,
      extracted_email: null,
      extracted_address: null,
      extracted_hours: null,
      extracted_social: null,
      extraction_confidence: 1.5,
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("PublicSourceObservationSchema", () => {
  it("accepts a valid public source observation", () => {
    const result = PublicSourceObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440020",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_platform: "google",
      source_url: "https://google.com/maps/place/example",
      discovered_at: "2026-10-11T10:00:00Z",
      profile_data: { name: "Example Business", phone: "+1-555-0100" },
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("NapObservationSchema", () => {
  it("accepts a valid NAP observation", () => {
    const result = NapObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440030",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://yelp.com/biz/example",
      name_value: "Example Business",
      phone_value: "+1-555-0100",
      address_value: {
        street: "123 Main St",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
      consistency_score: 0.92,
      inconsistencies: [{ field: "phone", expected: "+1-555-0200", actual: "+1-555-0100" }],
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects observation with consistency_score out of range", () => {
    const result = NapObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440030",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://yelp.com/biz/example",
      name_value: null,
      phone_value: null,
      address_value: null,
      consistency_score: -0.1,
      inconsistencies: [],
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});
