import type { GscSearchAnalyticsResponse, GscUrlInspectionResponse } from "./types.js";

const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";

export class GscClient {
  constructor(private readonly accessToken: string) {}

  async getSearchAnalytics(
    siteUrl: string,
    dateRange: { start: string; end: string },
  ): Promise<GscSearchAnalyticsResponse> {
    const response = await fetch(
      `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
          dimensions: ["query", "page", "country"],
          rowLimit: 1000,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`GSC Search Analytics API error: ${String(response.status)}`);
    }
    return (await response.json()) as GscSearchAnalyticsResponse;
  }

  async inspectUrl(siteUrl: string, inspectionUrl: string): Promise<GscUrlInspectionResponse> {
    const response = await fetch(`${GSC_API_BASE}/urlInspection/inspect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        siteUrl,
        inspectionUrl,
      }),
    });
    if (!response.ok) {
      throw new Error(`GSC URL Inspection API error: ${String(response.status)}`);
    }
    return (await response.json()) as GscUrlInspectionResponse;
  }
}
