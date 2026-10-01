const DEPENDENCIES: Record<string, string[]> = {
  auditor: [],
  "keyword-analyst": ["auditor"],
  "content-strategist": ["auditor", "keyword-analyst"],
};

export class DependencyGraph {
  getDependencies(agentName: string): string[] {
    return DEPENDENCIES[agentName] ?? [];
  }

  getExecutionOrder(agents: string[]): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      for (const dep of this.getDependencies(name)) {
        if (agents.includes(dep)) {
          visit(dep);
        }
      }
      sorted.push(name);
    };

    for (const agent of agents) {
      visit(agent);
    }
    return sorted;
  }

  getReadyAgents(allAgents: string[], completed: string[]): string[] {
    return allAgents.filter((name) => {
      if (completed.includes(name)) return false;
      const deps = this.getDependencies(name);
      return deps.every((dep) => completed.includes(dep));
    });
  }
}
