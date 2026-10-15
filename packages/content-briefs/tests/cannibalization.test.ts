import { describe, it, expect } from "vitest";
import { checkCannibalization } from "../src/cannibalization.js";

describe("checkCannibalization", () => {
  it("allows new page when cluster is not mapped", () => {
    const mappings = new Map<string, string>();
    const result = checkCannibalization("cluster-1", null, mappings);
    expect(result.ok).toBe(true);
  });

  it("rejects new page when cluster is already mapped", () => {
    const mappings = new Map<string, string>([["cluster-1", "/existing-page"]]);
    const result = checkCannibalization("cluster-1", null, mappings);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cluster-1");
    expect(result.error).toContain("/existing-page");
  });

  it("allows existing page improvement even when cluster is mapped", () => {
    const mappings = new Map<string, string>([["cluster-1", "/existing-page"]]);
    const result = checkCannibalization("cluster-1", "/existing-page", mappings);
    expect(result.ok).toBe(true);
  });

  it("allows new page for different cluster", () => {
    const mappings = new Map<string, string>([["cluster-1", "/page-1"]]);
    const result = checkCannibalization("cluster-2", null, mappings);
    expect(result.ok).toBe(true);
  });
});
