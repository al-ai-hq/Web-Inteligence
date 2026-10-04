import { describe, it, expect, beforeEach } from "vitest";
import { runConnectors } from "../src/runner.js";
import { setRegistry } from "../src/registry.js";
import type { Connector } from "../src/types.js";

describe("runConnectors", () => {
  beforeEach(() => {
    setRegistry([]);
  });

  it("runs all connectors in parallel", async () => {
    const mockConnectors: Connector[] = [
      {
        name: "test-1",
        run: async () => ({ ok: true, connector: "test-1", data: {} }),
      },
      {
        name: "test-2",
        run: async () => ({ ok: true, connector: "test-2", data: {} }),
      },
    ];
    setRegistry(mockConnectors);

    const results = await runConnectors("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("handles connector failure gracefully", async () => {
    const mockConnectors: Connector[] = [
      {
        name: "test-1",
        run: async () => ({ ok: true, connector: "test-1", data: {} }),
      },
      {
        name: "test-2",
        run: async () => {
          throw new Error("API down");
        },
      },
    ];
    setRegistry(mockConnectors);

    const results = await runConnectors("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    if (!results[1].ok) {
      expect(results[1].unavailable_reason_key).toBe("unavailable.connector.test-2");
    }
  });

  it("returns empty array when no connectors", async () => {
    const results = await runConnectors("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(results).toEqual([]);
  });
});
