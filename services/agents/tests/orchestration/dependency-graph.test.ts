import { describe, it, expect } from "vitest";
import { DependencyGraph } from "../../src/orchestration/dependency-graph.js";

describe("DependencyGraph", () => {
  it("returns empty dependencies for auditor", () => {
    const graph = new DependencyGraph();
    expect(graph.getDependencies("auditor")).toEqual([]);
  });

  it("returns auditor as dependency for keyword-analyst", () => {
    const graph = new DependencyGraph();
    expect(graph.getDependencies("keyword-analyst")).toEqual(["auditor"]);
  });

  it("returns auditor and keyword-analyst as dependencies for content-strategist", () => {
    const graph = new DependencyGraph();
    expect(graph.getDependencies("content-strategist")).toEqual(["auditor", "keyword-analyst"]);
  });

  it("returns execution order respecting dependencies", () => {
    const graph = new DependencyGraph();
    const order = graph.getExecutionOrder(["auditor", "keyword-analyst", "content-strategist"]);
    expect(order[0]).toBe("auditor");
    const kwIndex = order.indexOf("keyword-analyst");
    const csIndex = order.indexOf("content-strategist");
    expect(kwIndex).toBeGreaterThan(order.indexOf("auditor"));
    expect(csIndex).toBeGreaterThan(kwIndex);
  });

  it("determines ready agents given completed set", () => {
    const graph = new DependencyGraph();
    const allAgents = ["auditor", "keyword-analyst", "content-strategist"];

    expect(graph.getReadyAgents(allAgents, [])).toEqual(["auditor"]);
    expect(graph.getReadyAgents(allAgents, ["auditor"])).toEqual(["keyword-analyst"]);
    expect(graph.getReadyAgents(allAgents, ["auditor", "keyword-analyst"])).toEqual(["content-strategist"]);
  });
});
