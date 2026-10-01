import { describe, it, expect, vi } from "vitest";
import { createGetEvidenceTool } from "../../src/tools/get-evidence.js";
import type { ToolContext } from "../../src/tools/types.js";

describe("get_evidence", () => {
  it("reads evidence from storage by ID", async () => {
    const mockStorage = {
      async read(_bucket: string, path: string) {
        if (path.includes("ev-1")) {
          return { page_url: "https://example.com", content: "<html>test</html>" };
        }
        throw new Error("Not found");
      },
    };

    const tool = createGetEvidenceTool(mockStorage);
    const ctx: ToolContext = {
      audit_id: "audit-1",
      project_id: "proj-1",
      evidence_bucket: "evidence-bucket",
    } as ToolContext;

    const result = await tool.execute({ evidence_id: "ev-1" }, ctx);
    expect(result.source_tier).toBe("first_party");
    expect(result.data).toEqual({ page_url: "https://example.com", content: "<html>test</html>" });
  });

  it("returns limitation when evidence not found", async () => {
    const mockStorage = {
      async read() {
        throw new Error("Not found");
      },
    };

    const tool = createGetEvidenceTool(mockStorage);
    const ctx: ToolContext = {
      audit_id: "audit-1",
      project_id: "proj-1",
      evidence_bucket: "evidence-bucket",
    } as ToolContext;

    const result = await tool.execute({ evidence_id: "missing" }, ctx);
    expect(result.limitations).toContain("Evidence not found: missing");
  });
});
