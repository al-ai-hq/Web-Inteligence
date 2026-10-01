import { describe, it, expect, beforeEach } from "vitest";
import { AgentLoader } from "../../src/runtime/agent-loader.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { Tool, ToolContext, ToolResult } from "../../src/tools/types.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

describe("AgentLoader", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(makeTool("get_evidence"));
    registry.register(makeTool("eval_rule"));
    registry.register(makeTool("apply_change"));
    registry.register(makeTool("publish"));
  });

  it("loads a valid agent config from YAML", async () => {
    const loader = new AgentLoader(registry);
    const fixturesDir = join(__dirname, "fixtures");
    await loader.loadAll(fixturesDir);
    const agent = loader.getAgent("test-agent");
    expect(agent).toBeDefined();
    expect(agent!.config.name).toBe("test-agent");
    expect(agent!.config.model_tier).toBe("fast");
    expect(agent!.config.tools).toEqual(["get_evidence", "eval_rule"]);
  });

  it("lists all loaded agents", async () => {
    const loader = new AgentLoader(registry);
    const fixturesDir = join(__dirname, "fixtures");
    await loader.loadAll(fixturesDir);
    const agents = loader.listAgents();
    expect(agents.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when a tool in config is not registered", async () => {
    const emptyRegistry = new ToolRegistry();
    const loader = new AgentLoader(emptyRegistry);
    const fixturesDir = join(__dirname, "fixtures");
    await expect(loader.loadAll(fixturesDir)).rejects.toThrowError("Tool not registered");
  });

  it("throws when a tool appears in both tools and forbidden_tools", async () => {
    const loader = new AgentLoader(registry);
    // We need a fixture where a tool is in both lists.
    // For now, test that the loader validates this constraint.
    // This will be tested via a programmatically created config.
    expect(() =>
      loader.loadFromConfig({
        name: "conflict-agent",
        milestone: "M3",
        reads_untrusted_content: true,
        model_tier: "fast",
        tools: ["get_evidence", "apply_change"],
        forbidden_tools: ["apply_change"],
      }),
    ).toThrowError("Tool 'apply_change' appears in both tools and forbidden_tools");
  });

  it("returns undefined for unknown agent name", async () => {
    const loader = new AgentLoader(registry);
    expect(loader.getAgent("nonexistent")).toBeUndefined();
  });

  it("rejects a config that fails schema validation (fail-closed)", async () => {
    const loader = new AgentLoader(registry);
    const invalidDir = join(__dirname, "fixtures", "invalid");
    await expect(loader.loadAll(invalidDir)).rejects.toThrowError();
    expect(loader.getAgent("bad-agent")).toBeUndefined();
  });
});
