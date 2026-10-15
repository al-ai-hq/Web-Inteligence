// services/connectors/src/crux/client.ts
import type { CruxData } from "../types.js";
import type { CruxApiResponse, CruxMetric } from "./types.js";

export async function fetchCruxData(origin: string): Promise<CruxData> {
  const response = await fetch("https://chromeuxmetrics.googleapis.com/v1/records:queryRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: origin }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`CrUX API returned ${response.status}`);
  }

  const json = (await response.json()) as CruxApiResponse;
  return extractCruxData(json, origin);
}

function extractCruxData(apiResponse: CruxApiResponse, origin: string): CruxData {
  const record = apiResponse.record;

  return {
    metrics: {
      lcp: extractMetricDistribution(record.metrics.largest_contentful_paint),
      fid: extractMetricDistribution(record.metrics.first_input_delay),
      cls: extractMetricDistribution(record.metrics.cumulative_layout_shift),
    },
    origin,
    effective_connection_type: record.metrics.effective_connection_type?.category ?? "unknown",
  };
}

function extractMetricDistribution(metric: CruxMetric): {
  good: number;
  needs_improvement: number;
  poor: number;
} {
  return {
    good: metric.good?.percent ?? 0,
    needs_improvement: metric.needs_improvement?.percent ?? 0,
    poor: metric.poor?.percent ?? 0,
  };
}
