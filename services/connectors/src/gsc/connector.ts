import type { AuditContext, Connector, ConnectorResult } from "../types.js";
import type { GscData } from "../types.js";
import type { GscSearchAnalyticsResponse } from "./types.js";
import { GscClient } from "./client.js";

export class GscConnector implements Connector {
  name = "gsc";

  async run(url: string, context: AuditContext): Promise<ConnectorResult> {
    if (!context.auth?.google?.accessToken) {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.auth.missing",
      };
    }

    try {
      const client = new GscClient(context.auth.google.accessToken);
      const siteUrl = new URL(url).origin;
      const dateRange = {
        start: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
        end: new Date().toISOString().split("T")[0]!,
      };

      const [analytics, indexCoverage] = await Promise.all([
        client.getSearchAnalytics(siteUrl, dateRange),
        this.computeIndexCoverage(client, siteUrl, url),
      ]);

      const gscData: GscData = {
        search_analytics: this.mapSearchAnalytics(analytics, dateRange),
        index_coverage: indexCoverage,
      };

      return {
        ok: true,
        connector: this.name,
        data: { gsc: gscData },
      };
    } catch {
      return {
        ok: false,
        connector: this.name,
        unavailable_reason_key: "unavailable.connector.gsc",
      };
    }
  }

  private async computeIndexCoverage(
    client: GscClient,
    siteUrl: string,
    targetUrl: string,
  ): Promise<GscData["index_coverage"]> {
    const importantPages = [`${siteUrl}/`, targetUrl];

    let indexedCount = 0;
    for (const page of importantPages) {
      try {
        const inspection = await client.inspectUrl(siteUrl, page);
        if (inspection.inspectionResult?.indexStatusResult?.verdict === "VERDICT_PASSED") {
          indexedCount++;
        }
      } catch {
        // URL inspection failed for this page, skip
      }
    }

    return {
      important_pages_total: importantPages.length,
      important_pages_indexed: indexedCount,
      indexed_ratio: indexedCount / importantPages.length,
    };
  }

  private mapSearchAnalytics(
    response: GscSearchAnalyticsResponse,
    dateRange: { start: string; end: string },
  ): GscData["search_analytics"] {
    const rows = response.rows ?? [];

    const totals = rows.reduce(
      (acc, row) => ({
        queries: acc.queries + 1,
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0,
        average_position: 0,
      }),
      { queries: 0, clicks: 0, impressions: 0, ctr: 0, average_position: 0 },
    );
    totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    totals.average_position =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) /
          totals.impressions
        : 0;

    const byPage = new Map<string, GscData["search_analytics"]["by_page"][number]>();
    const byCountry = new Map<string, GscData["search_analytics"]["by_country"][number]>();
    const topQueries: GscData["search_analytics"]["top_queries"] = [];

    for (const row of rows) {
      const page = row.keys[1];
      const country = row.keys[2];
      const query = row.keys[0];

      if (page) {
        const existing = byPage.get(page) ?? {
          url: page,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          average_position: 0,
        };
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
        byPage.set(page, existing);
      }

      if (country) {
        const existing = byCountry.get(country) ?? {
          country,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          average_position: 0,
        };
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
        byCountry.set(country, existing);
      }

      if (query) {
        topQueries.push({
          query,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          average_position: row.position,
        });
      }
    }

    return {
      date_range: dateRange,
      totals,
      by_page: Array.from(byPage.values()),
      by_country: Array.from(byCountry.values()),
      top_queries: topQueries.slice(0, 100),
    };
  }
}
