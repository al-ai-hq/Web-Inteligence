import { describe, expect, it } from "vitest";
import type { FindingSection } from "../src/report-envelope.js";
import { SECTION_BY_AGENT } from "../src/report-envelope.js";

describe("FindingSection includes entity", () => {
  it("includes 'entity' as a valid FindingSection", () => {
    const section: FindingSection = "entity";
    expect(section).toBe("entity");
  });

  it("maps entity-analyst agent to entity section", () => {
    expect(SECTION_BY_AGENT["entity-analyst"]).toBe("entity");
  });
});
