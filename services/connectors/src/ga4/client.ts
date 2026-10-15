import type { Ga4DataResponse } from "./types.js";

const GA4_API_BASE = "https://analyticsdata.googleapis.com";

export class Ga4Client {
  constructor(
    private readonly accessToken: string,
    private readonly propertyId: string,
  ) {}

  async getPageMetrics(
    dateRange: { start: string; end: string },
    urls: string[],
  ): Promise<Ga4DataResponse> {
    const response = await fetch(`${GA4_API_BASE}/v1beta/properties/${this.propertyId}:runReport`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [dateRange],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "totalUsers" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "entrances" },
          { name: "exits" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            inListFilter: {
              values: urls.map((url) => new URL(url).pathname),
            },
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`GA4 Data API error: ${String(response.status)}`);
    }
    return (await response.json()) as Ga4DataResponse;
  }
}
