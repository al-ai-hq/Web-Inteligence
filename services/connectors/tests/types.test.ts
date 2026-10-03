import { describe, it, expect } from "vitest";
import type { Connector, ConnectorResult, AuditContext } from "../src/types.js";

describe("Connector types", () => {
  it("Connector interface has name and run method", () => {
    const connector: Connector = {
      name: "test",
      run: async (_url: string, _context: AuditContext) => ({
        ok: true,
        connector: "test",
        data: {},
      }),
    };
    expect(connector.name).toBe("test");
    expect(typeof connector.run).toBe("function");
  });

  it("ConnectorResult can be success", () => {
    const result: ConnectorResult = {
      ok: true,
      connector: "test",
      data: {},
    };
    expect(result.ok).toBe(true);
  });

  it("ConnectorResult can be failure", () => {
    const result: ConnectorResult = {
      ok: false,
      connector: "test",
      unavailable_reason_key: "unavailable.connector.test",
    };
    expect(result.ok).toBe(false);
  });
});
