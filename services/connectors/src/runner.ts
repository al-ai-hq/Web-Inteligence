import { getRegistry } from "./registry.js";
import type { AuditContext, ConnectorResult } from "./types.js";

export async function runConnectors(
  url: string,
  context: AuditContext,
): Promise<ConnectorResult[]> {
  const connectors = getRegistry();
  const results = await Promise.allSettled(
    connectors.map((connector) => connector.run(url, context)),
  );

  return connectors.map((connector, index) => {
    const result = results[index];
    if (!result) {
      return {
        ok: false as const,
        connector: connector.name,
        unavailable_reason_key: `unavailable.connector.${connector.name}`,
      };
    }
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      ok: false as const,
      connector: connector.name,
      unavailable_reason_key: `unavailable.connector.${connector.name}`,
    };
  });
}
