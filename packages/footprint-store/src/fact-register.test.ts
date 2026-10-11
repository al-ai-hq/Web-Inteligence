import { describe, expect, it } from "vitest";
import { FactRegisterEntrySchema } from "./fact-register.js";

describe("FactRegisterEntrySchema", () => {
  const validEntry = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
    fact_key: "business_name",
    fact_value: { value: "Example Business" },
    source_type: "manual",
    source_id: "user-entry",
    confidence: 1.0,
    lineage: {
      record_id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "550e8400-e29b-41d4-a716-446655440002",
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

  it("accepts a valid fact register entry", () => {
    const result = FactRegisterEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("rejects entry with confidence out of range", () => {
    const result = FactRegisterEntrySchema.safeParse({
      ...validEntry,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects entry with invalid source_type", () => {
    const result = FactRegisterEntrySchema.safeParse({
      ...validEntry,
      source_type: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
