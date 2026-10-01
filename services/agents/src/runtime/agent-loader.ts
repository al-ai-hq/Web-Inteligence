import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { agentConfigSchema, type AgentConfig } from "./types.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface AgentInstance {
  config: AgentConfig;
}

export class AgentLoader {
  private agents = new Map<string, AgentInstance>();
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async loadAll(dir: string): Promise<void> {
    const files = await readdir(dir);
    const yamlFiles = files.filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
    );

    for (const file of yamlFiles) {
      const content = await readFile(join(dir, file), "utf-8");
      const raw = parseYaml(content);
      const config = agentConfigSchema.parse(raw);
      this.loadFromConfig(config);
    }
  }

  loadFromConfig(config: AgentConfig): void {
    for (const tool of config.tools) {
      if (config.forbidden_tools.includes(tool)) {
        throw new Error(
          `Tool '${tool}' appears in both tools and forbidden_tools for agent '${config.name}'`,
        );
      }
    }

    this.registry.validateAllowlist(config.tools);

    this.agents.set(config.name, { config });
  }

  getAgent(name: string): AgentInstance | undefined {
    return this.agents.get(name);
  }

  listAgents(): AgentInstance[] {
    return [...this.agents.values()];
  }
}
