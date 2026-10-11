import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { PublicSourceObservationStore, ProfileObservationStore, NapObservationStore } from "./observation-stores.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PublicSourceObservationStore", () => {
  let pool: Pool;
  let store: PublicSourceObservationStore;

  beforeEach(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
    store = new PublicSourceObservationStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

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
    fidelity_label: "extracted" as const,
    content_hash: "abc123",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and lists public source observations", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440001";
    await store.create({
      fact_sheet_id: factSheetId,
      source_platform: "google",
      source_url: "https://google.com/maps/place/example",
      discovered_at: "2026-10-11T10:00:00Z",
      profile_data: { name: "Example Business", phone: "+1-555-0100" },
    }, baseLineage);

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(1);
    expect(list[0]!.source_platform).toBe("google");
  });
});

describe.skipIf(!DATABASE_URL)("ProfileObservationStore", () => {
  let pool: Pool;
  let store: ProfileObservationStore;

  beforeEach(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
    store = new ProfileObservationStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const baseLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440010",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "third_party_unverified" as const,
    source_id: "profile-extractor",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "automated",
    methodology_version: "1.0.0",
    fidelity_label: "extracted" as const,
    content_hash: "def456",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and lists profile observations", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440001";
    await store.create({
      fact_sheet_id: factSheetId,
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_email: null,
      extracted_address: { street: "123 Main St", city: "Anytown" },
      extracted_hours: { monday: "9:00-17:00" },
      extracted_social: { facebook: "https://fb.com/example" },
      extraction_confidence: 0.85,
    }, baseLineage);

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(1);
    expect(list[0]!.extracted_name).toBe("Example Business");
    expect(list[0]!.extraction_confidence).toBe(0.85);
  });
});

describe.skipIf(!DATABASE_URL)("NapObservationStore", () => {
  let pool: Pool;
  let store: NapObservationStore;

  beforeEach(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
    store = new NapObservationStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const baseLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440020",
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
    fidelity_label: "extracted" as const,
    content_hash: "ghi789",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and lists NAP observations", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440001";
    await store.create({
      fact_sheet_id: factSheetId,
      source_url: "https://yelp.com/biz/example",
      name_value: "Example Business",
      phone_value: "+1-555-0100",
      address_value: { street: "123 Main St", city: "Anytown" },
      consistency_score: 0.92,
      inconsistencies: [{ field: "phone", expected: "+1-555-0200", actual: "+1-555-0100" }],
    }, baseLineage);

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(1);
    expect(list[0]!.consistency_score).toBe(0.92);
    expect(list[0]!.inconsistencies.length).toBe(1);
  });
});
