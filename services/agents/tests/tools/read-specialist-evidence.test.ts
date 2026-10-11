import { describe, expect, it } from "vitest";
import { ReadSpecialistEvidenceTool } from "../../src/tools/read-specialist-evidence.js";

describe("ReadSpecialistEvidenceTool", () => {
  it("has correct name and description", () => {
    const tool = new ReadSpecialistEvidenceTool();
    expect(tool.name).toBe("read_specialist_evidence");
    expect(tool.description).toBeTruthy();
  });

  it("has input schema requiring evidence_type", () => {
    const tool = new ReadSpecialistEvidenceTool();
    expect(tool.inputSchema).toHaveProperty("properties.evidence_type");
    expect(tool.inputSchema.required).toContain("evidence_type");
  });

  it("returns data with source_tier third_party_unverified", async () => {
    const tool = new ReadSpecialistEvidenceTool();
    const result = await tool.execute(
      { evidence_type: "entity_profile", audit_id: "test-audit-id" },
      { audit_id: "test-audit-id", project_id: "test-project", evidence_bucket: "/tmp/test" },
    );
    expect(result.source_tier).toBe("third_party_unverified");
    expect(result.data).toBeDefined();
  });
});
