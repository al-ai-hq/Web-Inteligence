import { describe, expect, it } from "vitest";
import { EntityConflictSchema } from "./entity-conflict.js";

describe("EntityConflictSchema", () => {
  const validConflict = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
    fact_key: "phone",
    confirmed_value: { value: "+1-555-0100" },
    conflicting_value: { value: "+1-555-0200" },
    source_type: "nap_inconsistency",
    source_id: "google-profile",
    severity: "high",
    status: "open",
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    lineage: {
      record_id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "550e8400-e29b-41d4-a716-446655440002",
      site_id: null,
      source_type: "third_party_unverified",
      source_id: "nap-engine",
      source_version: "1.0.0",
      captured_at: "2026-10-11T10:00:00Z",
      as_of: "2026-10-11T10:00:00Z",
      market: "US",
      language: "en",
      device: "desktop",
      method: "automated",
      methodology_version: "1.0.0",
      fidelity_label: "disputed",
      content_hash: "def456",
      parent_ids: [],
      validation_state: "unvalidated",
    },
    created_at: "2026-10-11T10:00:00Z",
    updated_at: "2026-10-11T10:00:00Z",
  };

  it("accepts a valid entity conflict", () => {
    const result = EntityConflictSchema.safeParse(validConflict);
    expect(result.success).toBe(true);
  });

  it("rejects conflict with invalid severity", () => {
    const result = EntityConflictSchema.safeParse({
      ...validConflict,
      severity: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects conflict with invalid status", () => {
    const result = EntityConflictSchema.safeParse({
      ...validConflict,
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts resolved conflict with resolution fields", () => {
    const result = EntityConflictSchema.safeParse({
      ...validConflict,
      status: "resolved",
      resolved_by: "user@example.com",
      resolved_at: "2026-10-11T12:00:00Z",
      resolution_note: "Confirmed correct phone number",
    });
    expect(result.success).toBe(true);
  });
});
