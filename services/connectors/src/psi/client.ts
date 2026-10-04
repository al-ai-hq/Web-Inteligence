// services/connectors/src/psi/client.ts
import type { PsiData } from "../types.js";
import type { PsiApiResponse, PsiAudit } from "./types.js";

export async function fetchPsiData(
  url: string,
  apiKey: string,
): Promise<PsiData> {
  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy: "mobile",
    category: "performance",
  });

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
    { signal: AbortSignal.timeout(30_000) },
  );

  if (!response.ok) {
    throw new Error(`PSI API returned ${response.status}`);
  }

  const json = (await response.json()) as PsiApiResponse;
  return extractPsiData(json);
}

function extractPsiData(apiResponse: PsiApiResponse): PsiData {
  const audits = apiResponse.lighthouseResult.audits;

  return {
    core_web_vitals: {
      lcp: audits["largest-contentful-paint"]?.numericValue ?? 0,
      fid: audits["max-potential-fid"]?.numericValue ?? 0,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? 0,
    },
    opportunities: extractTopOpportunities(audits, 3),
  };
}

function extractTopOpportunities(
  audits: Record<string, PsiAudit>,
  limit: number,
): PsiData["opportunities"] {
  const opportunities: PsiData["opportunities"] = [];

  for (const [key, audit] of Object.entries(audits)) {
    if (
      audit.title &&
      audit.numericValue !== undefined &&
      audit.numericValue > 0
    ) {
      const severity =
        audit.numericValue > 500
          ? "high"
          : audit.numericValue > 200
            ? "medium"
            : "low";
      opportunities.push({
        id: key,
        title: audit.title,
        savings_ms: audit.numericValue,
        severity,
      });
    }
  }

  opportunities.sort((a, b) => (b.savings_ms ?? 0) - (a.savings_ms ?? 0));
  return opportunities.slice(0, limit);
}
