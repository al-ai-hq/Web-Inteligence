import { describe, it, expect } from "vitest";
import { createValidateSchemaTool } from "../../src/tools/validate-schema.js";
import type { ToolContext } from "../../src/tools/types.js";

describe("validate_schema", () => {
  it("validates valid structured data", async () => {
    const tool = createValidateSchemaTool();
    const ctx: ToolContext = {
      audit_id: "audit-1",
      project_id: "proj-1",
      evidence_bucket: "bucket",
    } as ToolContext;

    const result = await tool.execute(
      {
        structured_data: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [],
        },
        schema_type: "FAQPage",
      },
      ctx,
    );

    expect(result.data).toHaveProperty("valid", true);
    expect(result.source_tier).toBe("first_party");
  });

  it("reports errors for invalid structured data", async () => {
    const tool = createValidateSchemaTool();
    const ctx: ToolContext = {
      audit_id: "audit-1",
      project_id: "proj-1",
      evidence_bucket: "bucket",
    } as ToolContext;

    const result = await tool.execute(
      {
        structured_data: { "@type": "NotARealType" },
        schema_type: "NotARealType",
      },
      ctx,
    );

    expect(result.data).toHaveProperty("valid", false);
    expect((result.data as Record<string, unknown>).errors).toBeDefined();
  });
});
