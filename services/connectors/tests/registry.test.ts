import { describe, it, expect, afterEach } from "vitest";
import { getRegistry, setRegistry } from "../src/registry.js";

describe("registry", () => {
  afterEach(() => {
    setRegistry([]);
  });

  it("default registry includes psi, crux, gsc, ga4", () => {
    setRegistry([]);
    const registry = getRegistry();
    const names = registry.map((c) => c.name);
    expect(names).toContain("psi");
    expect(names).toContain("crux");
    expect(names).toContain("gsc");
    expect(names).toContain("ga4");
  });
});
