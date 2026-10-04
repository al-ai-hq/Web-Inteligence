import type { Connector } from "./types.js";
import { PsiConnector } from "./psi/index.js";
import { CruxConnector } from "./crux/index.js";
import { GscConnector } from "./gsc/index.js";
import { Ga4Connector } from "./ga4/index.js";

let registry: Connector[] | null = null;

export function getRegistry(): Connector[] {
  if (registry === null || registry.length === 0) {
    registry = [
      new PsiConnector(),
      new CruxConnector(),
      new GscConnector(),
      new Ga4Connector(),
    ];
  }
  return registry;
}

export function setRegistry(connectors: Connector[]): void {
  registry = connectors;
}
