import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  site_url: z.string().url(),
  start_date: z.string(),
  end_date: z.string(),
});

export function createGscQueryTool(fetchFn: typeof fetch, accessToken: string): Tool {
  return {
    name: "gsc_query",
    description: "Queries Google Search Console API for search performance data (queries, clicks, impressions, position).",
    inputSchema: {
      type: "object",
      properties: {
        site_url: { type: "string", format: "uri" },
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
      required: ["site_url", "start_date", "end_date"],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { site_url, start_date, end_date } = inputSchema.parse(input);
      const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site_url)}/searchAnalytics/query`;

      try {
        const response = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            startDate: start_date,
            endDate: end_date,
            dimensions: ["query"],
          }),
        });

        if (!response.ok) {
          return { data: null, source_tier: "first_party", limitations: [`GSC API returned ${String(response.status)}`] };
        }

        const json = (await response.json()) as Record<string, unknown>;
        return {
          data: { rows: json["rows"] ?? [], site_url, start_date, end_date },
          source_tier: "first_party",
          limitations: [],
        };
      } catch (error) {
        return {
          data: null,
          source_tier: "first_party",
          limitations: [`GSC API request failed: ${String(error)}`],
        };
      }
    },
  };
}
