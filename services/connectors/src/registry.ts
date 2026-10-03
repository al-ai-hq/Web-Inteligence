import type { Connector } from "./types.js";

let registry: Connector[] | null = null;

export function getRegistry(): Connector[] {
  if (registry === null) {
    registry = [];
  }
  return registry;
}

export function setRegistry(connectors: Connector[]): void {
  registry = connectors;
}
