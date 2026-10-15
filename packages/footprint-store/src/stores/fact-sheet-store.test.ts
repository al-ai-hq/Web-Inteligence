import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { FactSheetStore } from "./fact-sheet-store.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("FactSheetStore", () => {
  let pool: Pool;
  let store: FactSheetStore;

  beforeEach(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
    store = new FactSheetStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const validLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "first_party" as const,
    source_id: "manual-entry",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "manual",
    methodology_version: "1.0.0",
    fidelity_label: "confirmed" as const,
    content_hash: "abc123",
    parent_ids: [],
    validation_state: "validated" as const,
  };

  it("creates and retrieves a fact sheet", async () => {
    const created = await store.create(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        site_url: "https://example.com",
        business_name: "Example Business",
        phone: "+1-555-0100",
      },
      validLineage,
    );

    expect(created.id).toBeDefined();
    expect(created.business_name).toBe("Example Business");
    expect(created.status).toBe("draft");

    const retrieved = await store.getById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.business_name).toBe("Example Business");
  });

  it("lists fact sheets by project_id", async () => {
    const projectId = "550e8400-e29b-41d4-a716-446655440099";
    await store.create(
      {
        project_id: projectId,
        site_url: "https://example1.com",
        business_name: "Business 1",
      },
      validLineage,
    );
    await store.create(
      {
        project_id: projectId,
        site_url: "https://example2.com",
        business_name: "Business 2",
      },
      validLineage,
    );

    const list = await store.listByProject(projectId);
    expect(list.length).toBe(2);
  });

  it("updates a fact sheet", async () => {
    const created = await store.create(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        site_url: "https://example.com",
        business_name: "Old Name",
      },
      validLineage,
    );

    const updated = await store.update(
      created.id,
      {
        business_name: "New Name",
        phone: "+1-555-9999",
      },
      validLineage,
    );

    expect(updated.business_name).toBe("New Name");
    expect(updated.phone).toBe("+1-555-9999");
  });

  it("confirms a fact sheet", async () => {
    const created = await store.create(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        site_url: "https://example.com",
        business_name: "Example",
      },
      validLineage,
    );

    const confirmed = await store.confirm(created.id, "user@example.com");
    expect(confirmed.status).toBe("confirmed");
  });
});
