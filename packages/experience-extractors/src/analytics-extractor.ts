import * as cheerio from "cheerio";
import type { AnalyticsDetection, AnalyticsTag, EvidencePackage } from "./types.js";

export function extractAnalyticsDetection(evidence: EvidencePackage): AnalyticsDetection {
  const $ = cheerio.load(evidence.html);
  const tags: AnalyticsTag[] = [];

  $('script[src*="googletagmanager.com/gtag/js"]').each((_, element) => {
    const $el = $(element);
    const src = $el.attr("src") || "";
    const idMatch = src.match(/[?&]id=(G-[A-Z0-9]+)/i);

    if (idMatch) {
      tags.push({ type: "ga4", id: idMatch[1], detected: true });
    } else {
      tags.push({ type: "gtag", detected: true });
    }
  });

  $('script[src*="google-analytics.com/analytics.js"]').each(() => {
    tags.push({ type: "analytics.js", detected: true });
  });

  $("script").each((_, element) => {
    const $el = $(element);
    const inlineScript = $el.html() || "";

    const ga4Match = inlineScript.match(/gtag\(['"]config['"],\s*['"](G-[A-Z0-9]+)['"]/i);
    if (ga4Match && !tags.some((t) => t.type === "ga4" && t.id === ga4Match[1])) {
      tags.push({ type: "ga4", id: ga4Match[1], detected: true });
    }

    const uaMatch = inlineScript.match(/ga\(['"]create['"],\s*['"](UA-[0-9]+-[0-9]+)['"]/i);
    if (uaMatch) {
      tags.push({ type: "ua", id: uaMatch[1], detected: true });
    }
  });

  const hasAnalytics = tags.length > 0;
  const hasGA4 = tags.some((t) => t.type === "ga4");

  return {
    tags,
    hasAnalytics,
    hasGA4,
    tagCount: tags.length,
  };
}
