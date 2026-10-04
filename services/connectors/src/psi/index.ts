// services/connectors/src/psi/index.ts
import type { Connector, ConnectorResult, AuditContext } from "../types.js";
import { fetchPsiData } from "./client.js";

export class PsiConnector implements Connector {
  name = "psi";

  async run(url: string, _context: AuditContext): Promise<ConnectorResult> {
    const apiKey = process.env["WPI_PSI_API_KEY"];
    if (apiKey === undefined || apiKey === "") {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.psi.missing_api_key",
      };
    }

    try {
      const data = await fetchPsiData(url, apiKey);
      return { ok: true, connector: this.name, data: { psi: data } };
    } catch (error) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.psi.api_error",
      };
    }
  }
}
