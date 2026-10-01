import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { Tool, ToolContext, ToolResult } from "../../src/tools/types.js";

function makeTool(name: string): Tool {
  return {
    name,
    description: `Tool ${name}`,
    inputSchema: { type: "object", properties: {} },
    async execute(_input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      return { data: {}, source_tier: "first_party", limitations: [] };
    },
  };
}

describe("ToolRegistry", () => {
  it("registers and retrieves a tool by name", () => {
    const registry = new ToolRegistry();
    const tool = makeTool("get_evidence");
    registry.register(tool);
    expect(registry.get("get_evidence")).toBe(tool);
  });

  it("returns undefined for unregistered tool", () => {
    const registry = new ToolRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("resolves multiple tool names", () => {
    const registry = new ToolRegistry();
    const t1 = makeTool("get_evidence");
    const t2 = makeTool("eval_rule");
    registry.register(t1);
    registry.register(t2);
    const resolved = registry.resolveAll(["get_evidence", "eval_rule"]);
    expect(resolved).toEqual([t1, t2]);
  });

  it("throws when resolving an unregistered tool name", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool("get_evidence"));
    expect(() => registry.resolveAll(["get_evidence", "missing"])).toThrowError(
      "Unknown tool: missing",
    );
  });

  it("validates allowlist: all names exist in registry", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool("get_evidence"));
    registry.register(makeTool("eval_rule"));
    expect(() => registry.validateAllowlist(["get_evidence", "eval_rule"])).not.toThrow();
  });

  it("validates allowlist: throws on unknown tool", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool("get_evidence"));
    expect(() => registry.validateAllowlist(["get_evidence", "unknown_tool"])).toThrowError(
      "Tool not registered: unknown_tool",
    );
  });
});
