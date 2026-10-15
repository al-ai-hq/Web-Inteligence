import type { AuditContext, Connector, ConnectorResult } from "../types.js";
import type { Ga4Data } from "../types.js";
import type { Ga4DataResponse } from "./types.js";
import { Ga4Client } from "./client.js";

export class Ga4Connector implements Connector {
  name = "ga4";

  async run(url: string, context: AuditContext): Promise<ConnectorResult> {
    if (!context.auth?.google?.accessToken) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.auth.missing",
      };
    }

    const propertyId = process.env["WPI_GA4_PROPERTY_ID"];
    if (!propertyId) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.ga4.property_not_configured",
      };
    }

    try {
      const client = new Ga4Client(context.auth.google.accessToken, propertyId);
      const dateRange = {
        start: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "",
        end: new Date().toISOString().split("T")[0] ?? "",
      };

      const response = await client.getPageMetrics(dateRange, [url]);
      const ga4Data: Ga4Data = this.mapPageMetrics(response, dateRange);

      return {
        ok: true,
        connector: this.name,
        data: { ga4: ga4Data },
      };
    } catch {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.ga4",
      };
    }
  }

  private mapPageMetrics(
    response: Ga4DataResponse,
    dateRange: { start: string; end: string },
  ): Ga4Data {
    const timezone = response.metadata?.timezone ?? "UTC";
    const rows = response.rows ?? [];

    const pages = rows.map((row) => {
      const pagePath = row.dimensionValues[0]?.value ?? "";
      const pageviews = Number(row.metricValues[0]?.value ?? 0);
      const uniquePageviews = Number(row.metricValues[1]?.value ?? 0);
      const avgTimeOnPage = Number(row.metricValues[2]?.value ?? 0);
      const bounceRate = Number(row.metricValues[3]?.value ?? 0);
      const entrances = Number(row.metricValues[4]?.value ?? 0);
      const exits = Number(row.metricValues[5]?.value ?? 0);

      return {
        url: pagePath,
        pageviews,
        unique_pageviews: uniquePageviews,
        average_time_on_page_seconds: avgTimeOnPage,
        bounce_rate: bounceRate,
        entrances,
        exits,
      };
    });

    return {
      date_range: dateRange,
      timezone,
      pages,
    };
  }
}
