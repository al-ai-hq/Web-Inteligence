import { describe, expect, it } from "vitest";
import { ReadConfirmedFactsTool } from "../../src/tools/read-confirmed-facts.js";

describe("ReadConfirmedFactsTool", () => {
  it("has correct name and description", () => {
    const tool = new ReadConfirmedFactsTool();
    expect(tool.name).toBe("read_confirmed_facts");
    expect(tool.description).toBeTruthy();
  });

  it("has input schema with optional fact_sheet_id", () => {
    const tool = new ReadConfirmedFactsTool();
    expect(tool.inputSchema).toHaveProperty("properties.fact_sheet_id");
  });

  it("returns data with source_tier third_party_verified", async () => {
    const tool = new ReadConfirmedFactsTool();
    const result = await tool.execute(
      { fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001" },
      { audit_id: "test-audit-id", project_id: "test-project", evidence_bucket: "/tmp/test" },
    );
    expect(result.source_tier).toBe("third_party_verified");
    expect(result.data).toBeDefined();
  });
});
