import type { Tool } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  resolveAll(names: string[]): Tool[] {
    return names.map((name) => {
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return tool;
    });
  }

  validateAllowlist(names: string[]): void {
    for (const name of names) {
      if (!this.tools.has(name)) {
        throw new Error(`Tool not registered: ${name}`);
      }
    }
  }
}
