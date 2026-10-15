import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { EntityConflictStore } from "./entity-conflict-store.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("EntityConflictStore", () => {
  let pool: Pool;
  let store: EntityConflictStore;

  beforeEach(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
    store = new EntityConflictStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const validLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "third_party_unverified" as const,
    source_id: "nap-engine",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "automated",
    methodology_version: "1.0.0",
    fidelity_label: "disputed" as const,
    content_hash: "def456",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and retrieves an entity conflict", async () => {
    const created = await store.create(
      {
        fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
        fact_key: "phone",
        confirmed_value: { value: "+1-555-0100" },
        conflicting_value: { value: "+1-555-0200" },
        source_type: "nap_inconsistency",
        source_id: "google-profile",
        severity: "high",
      },
      validLineage,
    );

    expect(created.id).toBeDefined();
    expect(created.status).toBe("open");

    const retrieved = await store.getById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.fact_key).toBe("phone");
  });

  it("lists conflicts by fact_sheet_id", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440099";
    await store.create(
      {
        fact_sheet_id: factSheetId,
        fact_key: "phone",
        confirmed_value: null,
        conflicting_value: { value: "+1-555-0100" },
        source_type: "nap_inconsistency",
        severity: "medium",
      },
      validLineage,
    );
    await store.create(
      {
        fact_sheet_id: factSheetId,
        fact_key: "address",
        confirmed_value: null,
        conflicting_value: { value: "456 Oak Ave" },
        source_type: "extractor_disagreement",
        severity: "low",
      },
      validLineage,
    );

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(2);
  });

  it("resolves a conflict", async () => {
    const created = await store.create(
      {
        fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
        fact_key: "phone",
        confirmed_value: null,
        conflicting_value: { value: "+1-555-0200" },
        source_type: "nap_inconsistency",
        severity: "high",
      },
      validLineage,
    );

    const resolved = await store.resolve(
      created.id,
      { value: "+1-555-0100" },
      "user@example.com",
      "Confirmed correct phone number",
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.confirmed_value).toEqual({ value: "+1-555-0100" });
    expect(resolved.resolved_by).toBe("user@example.com");
    expect(resolved.resolution_note).toBe("Confirmed correct phone number");
  });

  it("dismisses a conflict", async () => {
    const created = await store.create(
      {
        fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
        fact_key: "email",
        confirmed_value: null,
        conflicting_value: { value: "old@example.com" },
        source_type: "connector_conflict",
        severity: "low",
      },
      validLineage,
    );

    const dismissed = await store.dismiss(created.id, "user@example.com", "False positive");
    expect(dismissed.status).toBe("dismissed");
    expect(dismissed.resolution_note).toBe("False positive");
  });
});
