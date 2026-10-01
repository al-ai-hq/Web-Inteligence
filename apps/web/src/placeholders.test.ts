import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

function runPlaceholder(script: string): string {
  return execFileSync(process.execPath, [path.join(root, script)], {
    encoding: "utf8",
  });
}

describe("placeholders", () => {
  it("records browser journeys as not run", () => {
    const output = runPlaceholder("scripts/placeholders/e2e.mjs");
    expect(output).toContain("not run");
    expect(output).toContain("M3");
  });
});
