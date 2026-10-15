import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  url: z.string().url(),
});

export function createCruxQueryTool(fetchFn: typeof fetch, apiKey: string): Tool {
  return {
    name: "crux_query",
    description: "Queries Chrome UX Report API for real-user performance data (LCP, CLS).",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", format: "uri" } },
      required: ["url"],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { url } = inputSchema.parse(input);
      const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`;

      try {
        const response = await fetchFn(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            return {
              data: null,
              source_tier: "third_party_verified",
              limitations: ["Origin not found in CrUX dataset"],
            };
          }
          return {
            data: null,
            source_tier: "third_party_verified",
            limitations: [`CrUX API returned ${String(response.status)}`],
          };
        }

        const json = (await response.json()) as Record<string, unknown>;
        const record = json["record"] as Record<string, unknown> | undefined;
        const metrics = record?.["metrics"] as Record<string, Record<string, unknown>> | undefined;

        return {
          data: {
            lcp_p75:
              (
                metrics?.["largest_contentful_paint"]?.["percentiles"] as
                  Record<string, number> | undefined
              )?.["p75"] ?? null,
            cls_p75:
              (
                metrics?.["cumulative_layout_shift"]?.["percentiles"] as
                  Record<string, number> | undefined
              )?.["p75"] ?? null,
            url,
          },
          source_tier: "third_party_verified",
          limitations: [],
        };
      } catch (error) {
        return {
          data: null,
          source_tier: "third_party_verified",
          limitations: [`CrUX API request failed: ${String(error)}`],
        };
      }
    },
  };
}
