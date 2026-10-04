// services/connectors/src/crux/index.ts
import type { Connector, ConnectorResult, AuditContext } from "../types.js";
import { fetchCruxData } from "./client.js";

export class CruxConnector implements Connector {
  name = "crux";

  async run(url: string, _context: AuditContext): Promise<ConnectorResult> {
    try {
      const origin = new URL(url).origin;
      const data = await fetchCruxData(origin);
      return { ok: true, connector: this.name, data: { crux: data } };
    } catch (error) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.crux.api_error",
      };
    }
  }
}
