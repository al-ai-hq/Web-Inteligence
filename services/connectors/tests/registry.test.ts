import { describe, it, expect, beforeEach } from "vitest";
import { getRegistry, setRegistry } from "../src/registry.js";
import type { Connector } from "../src/types.js";

describe("registry", () => {
  beforeEach(() => {
    setRegistry([]);
  });

  it("returns empty array initially", () => {
    const registry = getRegistry();
    expect(registry).toEqual([]);
  });

  it("can set and get registry", () => {
    const mockConnector: Connector = {
      name: "test",
      run: async () => ({ ok: true, connector: "test", data: {} }),
    };
    setRegistry([mockConnector]);
    const registry = getRegistry();
    expect(registry).toHaveLength(1);
    expect(registry[0].name).toBe("test");
  });
});
