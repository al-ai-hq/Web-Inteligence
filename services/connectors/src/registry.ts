import type { Connector } from "./types.js";
import { PsiConnector } from "./psi/index.js";
import { CruxConnector } from "./crux/index.js";

let registry: Connector[] | null = null;

export function getRegistry(): Connector[] {
  if (registry === null) {
    registry = [new PsiConnector(), new CruxConnector()];
  }
  return registry;
}

export function setRegistry(connectors: Connector[]): void {
  registry = connectors;
}
