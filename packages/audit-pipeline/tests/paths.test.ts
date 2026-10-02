import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/paths.js";

describe("paths", () => {
  it("resolves the repo root regardless of src/dist location", () => {
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "schemas", "report-model.schema.json"))).toBe(true);
  });
});
