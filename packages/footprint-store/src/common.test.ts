import { describe, expect, it } from "vitest";
import { LineageSchema, UUIDSchema } from "./common.js";

describe("UUIDSchema", () => {
  it("accepts a valid UUID", () => {
    const result = UUIDSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("rejects an invalid UUID", () => {
    const result = UUIDSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

describe("LineageSchema", () => {
  const validLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: "550e8400-e29b-41d4-a716-446655440002",
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
    content_hash: "abc123def456",
    parent_ids: [],
    validation_state: "validated",
  };

  it("accepts valid lineage with all required fields", () => {
    const result = LineageSchema.safeParse(validLineage);
    expect(result.success).toBe(true);
  });

  it("accepts lineage with optional audit_id", () => {
    const result = LineageSchema.safeParse({
      ...validLineage,
      audit_id: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(result.success).toBe(true);
  });

  it("rejects lineage missing required fields", () => {
    const { record_id, ...incomplete } = validLineage;
    const result = LineageSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("rejects lineage with invalid UUID in record_id", () => {
    const result = LineageSchema.safeParse({
      ...validLineage,
      record_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
