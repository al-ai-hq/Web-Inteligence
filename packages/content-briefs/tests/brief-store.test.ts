import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { PostgresBriefStore } from "../src/brief-store.js";
import type { ContentBrief } from "../src/types.js";

const DATABASE_URL = process.env["WPI_TEST_DATABASE_URL"];

describe.skipIf(!DATABASE_URL)("PostgresBriefStore", () => {
  let pool: Pool;
  let store: PostgresBriefStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    store = new PostgresBriefStore(pool);
    await pool.query("DELETE FROM content_briefs");
  });

  afterAll(async () => {
    await pool.end();
  });

  const sampleBrief: Omit<ContentBrief, "id" | "created_at" | "updated_at"> = {
    project_id: "00000000-0000-0000-0000-000000000001",
    audit_id: null,
    status: "draft",
    opportunity_type: "unmapped_cluster",
    opportunity_ref: "cluster-1",
    page_goal: "Inform users",
    audience: "Developers",
    target_action: "Read article",
    target_url: null,
    proposed_slug: "test-article",
    primary_keyword: "test",
    keyword_variants: [{ keyword: "test", language: "en", normalized: "test" }],
    intent: "informational",
    market: "SA",
    volume: 100,
    volume_source: "gsc",
    position: 5.2,
    position_source: "gsc",
    observations: [],
    recommended_angle: "Test angle",
    outlines: [{ language: "en", headings: [{ level: 1, text: "Test" }] }],
    questions: [],
    entities: [],
    terms: [],
    titles: [{ language: "en", text: "Test Title" }],
    meta_descriptions: [{ language: "en", text: "Test description" }],
    fact_sheet_ids: [],
    inputs_needed: [],
    internal_links: [],
    schema_types: [],
    length_guidance: { min_words: 500, max_words: 1000, basis: "test" },
    cta: "Learn more",
    conversion_notes: "Notes",
    regulated_topic: null,
    success_measures: [],
    review_date: "2026-11-01",
    created_by: "test@example.com",
    approved_by: null,
    approved_at: null,
  };

  it("creates a brief and returns it with id", async () => {
    const brief = await store.create(sampleBrief);
    expect(brief.id).toBeDefined();
    expect(brief.status).toBe("draft");
    expect(brief.created_at).toBeDefined();
  });

  it("retrieves a brief by id", async () => {
    const created = await store.create(sampleBrief);
    const retrieved = await store.getById(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.primary_keyword).toBe("test");
  });

  it("updates a brief", async () => {
    const created = await store.create(sampleBrief);
    const updated = await store.update(created.id, {
      status: "approved",
      approved_by: "admin@example.com",
    });
    expect(updated.status).toBe("approved");
    expect(updated.approved_by).toBe("admin@example.com");
  });

  it("lists briefs by project_id", async () => {
    const projectId = "00000000-0000-0000-0000-000000000002";
    await store.create({ ...sampleBrief, project_id: projectId });
    await store.create({ ...sampleBrief, project_id: projectId });
    const briefs = await store.listByProject(projectId);
    expect(briefs.length).toBe(2);
  });
});
