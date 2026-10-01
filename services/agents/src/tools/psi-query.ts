import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const inputSchema = z.object({
  url: z.string().url(),
  strategy: z.enum(["mobile", "desktop"]).default("mobile"),
});

export function createPsiQueryTool(fetchFn: typeof fetch, apiKey: string): Tool {
  return {
    name: "psi_query",
    description: "Queries Google PageSpeed Insights API for Lighthouse scores and performance metrics.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        strategy: { type: "string", enum: ["mobile", "desktop"] },
      },
      required: ["url"],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { url, strategy } = inputSchema.parse(input);
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}`;

      try {
        const response = await fetchFn(endpoint);
        if (!response.ok) {
          return { data: null, source_tier: "third_party_verified", limitations: [`PSI API returned ${String(response.status)}`] };
        }
        const json = (await response.json()) as Record<string, unknown>;
        const lr = json["lighthouseResult"] as Record<string, unknown> | undefined;
        const categories = lr?.["categories"] as Record<string, Record<string, unknown>> | undefined;

        return {
          data: {
            performance_score: categories?.["performance"]?.["score"] ?? null,
            accessibility_score: categories?.["accessibility"]?.["score"] ?? null,
            url,
            strategy,
          },
          source_tier: "third_party_verified",
          limitations: [],
        };
      } catch (error) {
        return {
          data: null,
          source_tier: "third_party_verified",
          limitations: [`PSI API request failed: ${String(error)}`],
        };
      }
    },
  };
}
